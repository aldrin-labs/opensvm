import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { qdrantClient } from '@/lib/search/qdrant';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import {
  authenticate,
  getOrders,
  placeOrder,
  cancelOrder,
  getTrades,
  getMarket,
  type PlaceOrderParams,
} from '@/lib/bank/kalshi-client';

const KALSHI_CREDENTIALS_COLLECTION = 'svm_bank_kalshi_credentials';

interface StoredCredentials {
  userWallet: string;
  encryptedEmail: string;
  encryptedPassword: string;
  memberId?: string;
  isDemo: boolean;
}

/**
 * Helper to get authenticated token
 */
async function getAuthToken(userWallet: string): Promise<string> {
  const results = await qdrantClient.scroll(KALSHI_CREDENTIALS_COLLECTION, {
    filter: {
      must: [{ key: 'userWallet', match: { value: userWallet } }]
    },
    limit: 1,
    with_payload: true
  });

  if (results.points.length === 0) {
    throw new Error('Kalshi account not connected');
  }

  const stored = results.points[0].payload as StoredCredentials;

  const email = Buffer.from(
    decryptPrivateKey(stored.encryptedEmail, userWallet)
  ).toString('utf-8');
  const password = Buffer.from(
    decryptPrivateKey(stored.encryptedPassword, userWallet)
  ).toString('utf-8');

  const auth = await authenticate({ email, password });
  return auth.token;
}

/**
 * GET /api/bank/kalshi/orders
 * Get user's orders or trade history
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'orders';
    const ticker = searchParams.get('ticker');
    const status = searchParams.get('status') as 'open' | 'pending' | 'filled' | 'cancelled' | null;
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit');

    const token = await getAuthToken(session.walletAddress);

    switch (action) {
      case 'orders': {
        const result = await getOrders(token, {
          ticker: ticker || undefined,
          status: status || undefined,
          cursor: cursor || undefined,
          limit: limit ? parseInt(limit) : 50,
        });

        return NextResponse.json(result);
      }

      case 'trades': {
        const result = await getTrades(token, {
          ticker: ticker || undefined,
          cursor: cursor || undefined,
          limit: limit ? parseInt(limit) : 50,
        });

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Kalshi orders error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bank/kalshi/orders
 * Place a new order
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const {
      ticker,
      side,
      action,
      count,
      type = 'limit',
      price,
      expirationTs,
    } = body;

    // Validate required fields
    if (!ticker || !side || !action || !count) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, side, action, count' },
        { status: 400 }
      );
    }

    // Validate side
    if (!['yes', 'no'].includes(side)) {
      return NextResponse.json(
        { error: 'Side must be "yes" or "no"' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['buy', 'sell'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['limit', 'market'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "limit" or "market"' },
        { status: 400 }
      );
    }

    // Validate price for limit orders
    if (type === 'limit') {
      if (price === undefined || price < 1 || price > 99) {
        return NextResponse.json(
          { error: 'Limit orders require price between 1 and 99 cents' },
          { status: 400 }
        );
      }
    }

    // Validate count
    if (count < 1) {
      return NextResponse.json(
        { error: 'Count must be at least 1' },
        { status: 400 }
      );
    }

    // Verify market exists and is open
    try {
      const marketData = await getMarket(ticker);
      if (marketData.market.status !== 'open') {
        return NextResponse.json(
          { error: `Market is ${marketData.market.status}, not accepting orders` },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid market ticker' },
        { status: 400 }
      );
    }

    const token = await getAuthToken(session.walletAddress);

    const orderParams: PlaceOrderParams = {
      ticker,
      side,
      action,
      count,
      type,
      price: type === 'limit' ? price : undefined,
      expiration_ts: expirationTs,
    };

    const result = await placeOrder(token, orderParams);

    return NextResponse.json({
      success: true,
      order: result.order,
    });

  } catch (error) {
    console.error('Kalshi place order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to place order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bank/kalshi/orders
 * Cancel an order
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required' },
        { status: 400 }
      );
    }

    const token = await getAuthToken(session.walletAddress);
    const result = await cancelOrder(token, orderId);

    return NextResponse.json({
      success: true,
      order: result.order,
    });

  } catch (error) {
    console.error('Kalshi cancel order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
