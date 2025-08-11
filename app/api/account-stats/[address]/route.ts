import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';
import { PublicKey, Connection } from '@solana/web3.js';
import type { ConfirmedSignatureInfo } from '@solana/web3.js';
import { memoryCache } from '@/lib/cache';
import { queryFlipside } from '@/lib/flipside';

const BATCH_SIZE = 1000;
const MAX_BATCHES = 3;
const CACHE_TTL = 300; // 5 minutes
const CACHE_ERROR_TTL = 60; // 1 minute
const QUERY_TIMEOUT = 5000; // 5 seconds
const API_TIMEOUT = 10000; // 10 seconds

interface AccountStats {
  totalTransactions: string | number;
  tokenTransfers: number;
  lastUpdated: number;
}

type TransferCount = {
  transfer_count: number;
}

async function getSignatureCount(pubkey: PublicKey, connection: Connection): Promise<string | number> {
  const cacheKey = `signatures-${pubkey.toBase58()}`;
  const cachedData = memoryCache.get<number>(cacheKey);
  if (cachedData !== null) {
    return cachedData;
  }

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

  memoryCache.set(cacheKey, count, CACHE_TTL);
  return count;
}

async function getTokenTransfers(address: string): Promise<number> {
  const cacheKey = `transfers-${address}`;
  const cachedData = memoryCache.get<number>(cacheKey);
  if (cachedData !== null) {
    return cachedData;
  }

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
      memoryCache.set(cacheKey, transferCount, CACHE_TTL);
      return transferCount;
    }

    // If query fails or returns no results, try getting cached data
    const cachedCount = memoryCache.get<number>(cacheKey);
    if (cachedCount !== null) {
      return cachedCount;
    }

    return 0;
  } catch (error) {
    console.error('Error querying Flipside:', error);
    // Return 0 and cache it to prevent repeated timeouts
    memoryCache.set(cacheKey, 0, CACHE_ERROR_TTL);
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
    const { address } = await params;

    // Add overall API timeout
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('API timeout'));
      }, API_TIMEOUT);
    });

    const cacheKey = `account-stats-${address}`;
    const cachedStats = memoryCache.get<AccountStats>(cacheKey);

    // Return cached data and refresh in background if stale
    if (cachedStats) {
      const age = Date.now() - cachedStats.lastUpdated;
      if (age > CACHE_TTL * 1000) {
        // Refresh in background if cache is stale
        refreshAccountStats(address, cacheKey).catch(console.error);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      return NextResponse.json(cachedStats, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
        }
      });
    }

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

    memoryCache.set(cacheKey, stats, CACHE_TTL);

    return NextResponse.json(stats, {
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

// Background refresh function
async function refreshAccountStats(address: string, cacheKey: string) {
  try {
    const connection = await getConnection();
    const pubkey = new PublicKey(address);

    const [totalTransactions, tokenTransfers] = await Promise.all([
      getSignatureCount(pubkey, connection),
      getTokenTransfers(address)
    ]);

    const stats: AccountStats = {
      totalTransactions,
      tokenTransfers,
      lastUpdated: Date.now()
    };

    memoryCache.set(cacheKey, stats, CACHE_TTL);
  } catch (error) {
    console.error('Error refreshing account stats:', error);
  }
}
