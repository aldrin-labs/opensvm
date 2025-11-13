import { NextRequest, NextResponse } from 'next/server';
import { memoryCache } from '@/lib/cache';
import { getTokenOverview } from '@/lib/birdeye-api';

const CACHE_TTL = 300; // 5 minutes
const CACHE_ERROR_TTL = 60; // 1 minute
const API_TIMEOUT = 10000; // 10 seconds

interface TokenStats {
  mint: string;
  txCount: number;
  volume: number;
  lastUpdated: number;
}

// Background refresh function
async function refreshTokenStats(account: string, mint: string, cacheKey: string): Promise<void> {
  try {
    const stats = await getTokenStats(account, mint);
    memoryCache.set(cacheKey, stats, CACHE_TTL);
  } catch (error) {
    console.error('Error refreshing token stats:', error);
  }
}

async function getTokenStats(account: string, mint: string): Promise<TokenStats> {
  const cacheKey = `token-stats-${account}-${mint}`;
  const cachedData = memoryCache.get<TokenStats>(cacheKey);
  if (cachedData !== null) {
    return cachedData;
  }

  try {
    // Fetch token data from Birdeye
    const tokenData = await getTokenOverview(mint);
    
    if (tokenData) {
      const stats: TokenStats = {
        mint,
        txCount: tokenData.holder || 0, // Use holder count as proxy for activity
        volume: tokenData.v24hUSD || 0, // 24h volume in USD
        lastUpdated: Date.now()
      };
      
      memoryCache.set(cacheKey, stats, CACHE_TTL);
      return stats;
    }
  } catch (error) {
    console.error('Error fetching Birdeye token data:', error);
  }

  // Return empty stats on error
  const emptyStats = {
    mint,
    txCount: 0,
    volume: 0,
    lastUpdated: Date.now()
  };
  memoryCache.set(cacheKey, emptyStats, CACHE_ERROR_TTL);
  return emptyStats;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ account: string; mint: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { account, mint } = await params;

    // Add overall API timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API timeout')), API_TIMEOUT);
    });

    const cacheKey = `token-stats-${account}-${mint}`;
    const cachedStats = memoryCache.get<TokenStats>(cacheKey);
    
    // Return cached data and refresh in background if stale
    if (cachedStats) {
      const age = Date.now() - cachedStats.lastUpdated;
      if (age > CACHE_TTL * 1000) {
        // Refresh in background if cache is stale
        refreshTokenStats(account, mint, cacheKey).catch(console.error);
      }
      return NextResponse.json(cachedStats, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
        }
      });
    }

    // Race between data fetching and timeout
    const stats = await Promise.race([
      getTokenStats(account, mint),
      timeoutPromise
    ]) as TokenStats;

    memoryCache.set(cacheKey, stats, CACHE_TTL);

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Error fetching token stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token stats' },
      { status: 500 }
    );
  }
}
