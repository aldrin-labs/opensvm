import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { PublicKey, Connection } from '@solana/web3.js';
import type { ConfirmedSignatureInfo } from '@solana/web3.js';
import { createCache } from '@/lib/caching/api-cache';

const BATCH_SIZE = 1000;
const MAX_BATCHES = 3;
const API_TIMEOUT = 10000; // 10 seconds

// Create cache instance for account stats (5 min cache, 1 min refresh threshold)
const accountStatsCache = createCache<AccountStats>({
  duration: 5 * 60 * 1000,
  refreshThreshold: 60 * 1000
});

interface AccountStats {
  totalTransactions: string | number;
  lastUpdated: number;
}

async function getSignatureCount(pubkey: PublicKey, connection: Connection): Promise<string | number> {
  const batches = [];
  let before: string | null = null;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const options: { limit: number; before?: string } = { limit: BATCH_SIZE };
    if (before !== null) {
      options.before = before;
    }

    batches.push(
      connection.getSignaturesForAddress(pubkey, options)
        .then((signatures: ConfirmedSignatureInfo[]) => {
          const lastSignature = signatures[signatures.length - 1];
          if (lastSignature && lastSignature.signature) {
            before = lastSignature.signature;
          }
          return signatures;
        })
    );
  }

  const results = await Promise.all(batches);
  const allSignatures = results.flatMap(batch => batch);
  const count = allSignatures.length === MAX_BATCHES * BATCH_SIZE
    ? `${allSignatures.length}+`
    : allSignatures.length;

  return count;
}

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  try {
    // Get the address from params - properly awaited in Next.js 15
    const params = await context.params;
    const { address } = params;

    // Validate address format before proceeding
    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Invalid address parameter' },
        { status: 400 }
      );
    }

    // Validate Solana address format
    try {
      new PublicKey(address);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        { status: 400 }
      );
    }

    // Add overall API timeout
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('API timeout'));
      }, API_TIMEOUT);
    });

    // Use cache with background refresh
    const result = await accountStatsCache.get(address, async () => {
      const connection = await getConnection();
      const pubkey = new PublicKey(address);

      // Race between data fetching and timeout
      const totalTransactions = await Promise.race([
        getSignatureCount(pubkey, connection),
        timeoutPromise
      ]) as string | number;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const stats: AccountStats = {
        totalTransactions,
        lastUpdated: Date.now()
      };

      return stats;
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return NextResponse.json({
      ...result.data,
      cached: result.cached,
      cacheAge: result.cacheAge
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Error fetching account stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account stats' },
      { status: 500 }
    );
  }
}
