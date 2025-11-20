import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { v4 as uuidv4 } from 'uuid';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


const COLLECTION_NAME = 'svm_bank_wallets';

interface StoredWallet {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

/**
 * GET /api/bank/wallets
 * List all managed wallets for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    // Get authenticated user from session
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userWallet = session.walletAddress;
    
    // Search for user's wallets
    const results = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'userWallet',
            match: { value: userWallet }
          }
        ]
      },
      limit: 100,
      with_payload: true
    });

    const wallets = results.points.map((point: any) => ({
      id: point.payload.id,
      address: point.payload.address,
      name: point.payload.name,
      balance: 0, // Will be fetched from Solana
      tokens: [],
      createdAt: point.payload.createdAt
    }));

    return NextResponse.json({
      wallets,
      total: wallets.length
    });
    
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
