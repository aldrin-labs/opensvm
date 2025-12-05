import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { qdrantClient } from '@/lib/search/qdrant';
import { encryptPrivateKey, decryptPrivateKey } from '@/lib/bank/encryption';
import {
  authenticate,
  getMarkets,
  getEvents,
  searchMarkets,
  getCategories,
  getBalance,
  getPositions,
  type KalshiCredentials,
} from '@/lib/bank/kalshi-client';

const KALSHI_CREDENTIALS_COLLECTION = 'svm_bank_kalshi_credentials';

// Ensure collection exists
async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === KALSHI_CREDENTIALS_COLLECTION);

    if (!exists) {
      await qdrantClient.createCollection(KALSHI_CREDENTIALS_COLLECTION, {
        vectors: { size: 4, distance: 'Cosine' }
      });
      console.log('Created Kalshi credentials collection');
    }
  } catch (error) {
    console.error('Error ensuring collection:', error);
  }
}

interface StoredCredentials {
  userWallet: string;
  encryptedEmail: string;
  encryptedPassword: string;
  memberId?: string;
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * GET /api/bank/kalshi
 * Get markets, events, or check connection status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'markets';

    switch (action) {
      case 'markets': {
        const status = searchParams.get('status') as 'open' | 'closed' | 'settled' | null;
        const eventTicker = searchParams.get('event_ticker');
        const cursor = searchParams.get('cursor');
        const limit = searchParams.get('limit');

        const result = await getMarkets({
          status: status || 'open',
          event_ticker: eventTicker || undefined,
          cursor: cursor || undefined,
          limit: limit ? parseInt(limit) : 20,
        });

        return NextResponse.json(result);
      }

      case 'events': {
        const status = searchParams.get('status');
        const cursor = searchParams.get('cursor');
        const limit = searchParams.get('limit');

        const result = await getEvents({
          status: status || undefined,
          cursor: cursor || undefined,
          limit: limit ? parseInt(limit) : 20,
        });

        return NextResponse.json(result);
      }

      case 'search': {
        const query = searchParams.get('q');
        if (!query) {
          return NextResponse.json({ error: 'Search query required' }, { status: 400 });
        }

        const result = await searchMarkets(query);
        return NextResponse.json(result);
      }

      case 'categories': {
        const categories = await getCategories();
        return NextResponse.json({ categories });
      }

      case 'status': {
        // Check if user has connected Kalshi account
        await ensureCollection();
        const userWallet = session.walletAddress;

        const results = await qdrantClient.scroll(KALSHI_CREDENTIALS_COLLECTION, {
          filter: {
            must: [{ key: 'userWallet', match: { value: userWallet } }]
          },
          limit: 1,
          with_payload: true
        });

        if (results.points.length === 0) {
          return NextResponse.json({
            connected: false,
            isDemo: null,
          });
        }

        const stored = results.points[0].payload as StoredCredentials;

        // Try to get balance to verify connection
        try {
          const email = Buffer.from(
            decryptPrivateKey(stored.encryptedEmail, userWallet)
          ).toString('utf-8');
          const password = Buffer.from(
            decryptPrivateKey(stored.encryptedPassword, userWallet)
          ).toString('utf-8');

          const auth = await authenticate({ email, password });
          const balance = await getBalance(auth.token);
          const positions = await getPositions(auth.token);

          return NextResponse.json({
            connected: true,
            isDemo: stored.isDemo,
            memberId: auth.member_id,
            balance: balance.balance / 100, // Convert cents to dollars
            portfolioValue: balance.portfolio_value / 100,
            positionCount: positions.market_positions?.length || 0,
          });
        } catch (error) {
          console.error('Kalshi connection check failed:', error);
          return NextResponse.json({
            connected: false,
            error: 'Connection failed - credentials may be invalid',
            isDemo: stored.isDemo,
          });
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Kalshi API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bank/kalshi
 * Connect Kalshi account with credentials
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await ensureCollection();
    const userWallet = session.walletAddress;
    const body = await req.json();

    const { email, password, isDemo = true } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Verify credentials work
    let auth;
    try {
      auth = await authenticate({ email, password } as KalshiCredentials);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid Kalshi credentials', details: error instanceof Error ? error.message : 'Auth failed' },
        { status: 401 }
      );
    }

    // Encrypt credentials using user's wallet address as seed
    const encryptedEmail = encryptPrivateKey(
      Buffer.from(email, 'utf-8'),
      userWallet
    );
    const encryptedPassword = encryptPrivateKey(
      Buffer.from(password, 'utf-8'),
      userWallet
    );

    // Check if credentials already exist
    const existing = await qdrantClient.scroll(KALSHI_CREDENTIALS_COLLECTION, {
      filter: {
        must: [{ key: 'userWallet', match: { value: userWallet } }]
      },
      limit: 1,
      with_payload: true
    });

    const now = Date.now();
    const id = existing.points.length > 0
      ? existing.points[0].id as string
      : `kalshi-${userWallet}-${now}`;

    const credentials: StoredCredentials = {
      userWallet,
      encryptedEmail,
      encryptedPassword,
      memberId: auth.member_id,
      isDemo,
      createdAt: existing.points.length > 0
        ? (existing.points[0].payload as StoredCredentials).createdAt
        : now,
      updatedAt: now,
    };

    await qdrantClient.upsert(KALSHI_CREDENTIALS_COLLECTION, {
      points: [{
        id,
        vector: [0.1, 0.1, 0.1, 0.1],
        payload: credentials,
      }]
    });

    // Get initial balance
    const balance = await getBalance(auth.token);

    return NextResponse.json({
      success: true,
      connected: true,
      memberId: auth.member_id,
      isDemo,
      balance: balance.balance / 100,
      portfolioValue: balance.portfolio_value / 100,
    });

  } catch (error) {
    console.error('Kalshi connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bank/kalshi
 * Disconnect Kalshi account
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await ensureCollection();
    const userWallet = session.walletAddress;

    // Find and delete credentials
    const existing = await qdrantClient.scroll(KALSHI_CREDENTIALS_COLLECTION, {
      filter: {
        must: [{ key: 'userWallet', match: { value: userWallet } }]
      },
      limit: 1,
      with_payload: true
    });

    if (existing.points.length > 0) {
      await qdrantClient.delete(KALSHI_CREDENTIALS_COLLECTION, {
        points: [existing.points[0].id as string]
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Kalshi account disconnected',
    });

  } catch (error) {
    console.error('Kalshi disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
