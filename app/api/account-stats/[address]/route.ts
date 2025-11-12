import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';
import { PublicKey, Connection } from '@solana/web3.js';
import type { ConfirmedSignatureInfo } from '@solana/web3.js';
import { queryFlipside } from '@/lib/flipside';
import { createCache } from '@/lib/api-cache';

const BATCH_SIZE = 1000;
const MAX_BATCHES = 3;
const QUERY_TIMEOUT = 5000; // 5 seconds
const API_TIMEOUT = 10000; // 10 seconds

// Create cache instance for account stats (5 min cache, 1 min refresh threshold)
const accountStatsCache = createCache<AccountStats>({
  duration: 5 * 60 * 1000,
  refreshThreshold: 60 * 1000
});

interface AccountStats {
  totalTransactions: string | number;
  tokenTransfers: number;
  lastUpdated: number;
}

type TransferCount = {
  transfer_count: number;
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

async function getTokenTransfers(address: string): Promise<number> {
  const query = `
    WITH recent_transfers AS (
      SELECT 
        DATE_TRUNC('minute', block_timestamp) as ts,
        COUNT(DISTINCT tx_id) as tx_count
      FROM solana.core.fact_transfers
      WHERE block_timestamp >= DATEADD('hour', -24, CURRENT_TIMESTAMP())
      AND (tx_to = '${address}' OR tx_from = '${address}')
      GROUP BY 1
    )
    SELECT COUNT(*) as transfer_count
    FROM recent_transfers
  `;

  // Add timeout to prevent hanging
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<number>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Flipside query timeout'));
    }, QUERY_TIMEOUT);
  });

  try {
    // Race between query and timeout
    const results = await Promise.race([
      queryFlipside<TransferCount>(query),
      timeoutPromise
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (Array.isArray(results) && results.length > 0) {
      const transferCount = Number(results[0]?.transfer_count) || 0;
      return transferCount;
    }

    return 0;
  } catch (error) {
    console.error('Error querying Flipside:', error);
    return 0;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
      const [totalTransactions, tokenTransfers] = await Promise.race([
        Promise.all([
          getSignatureCount(pubkey, connection),
          getTokenTransfers(address)
        ]),
        timeoutPromise
      ]) as [string | number, number];

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const stats: AccountStats = {
        totalTransactions,
        tokenTransfers,
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
