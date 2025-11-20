import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export const runtime = 'edge';

interface PoolData {
  symbol: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  dex: string;
  poolAddress: string;
  source: string;
}

/**
 * Fetch all trading pools/pairs for a specific token from Birdeye API
 */
async function fetchTokenPools(tokenMint: string, dexFilter?: string): Promise<PoolData[]> {
  if (!process.env.BIRDEYE_API_KEY) {
    console.warn('BIRDEYE_API_KEY not configured');
    return [];
  }

  const pools: PoolData[] = [];

  try {
    // Use Birdeye's token pairs endpoint to get all trading pairs for this token
    const response = await fetch(
      `https://public-api.birdeye.so/defi/v2/tokens/pair?address=${tokenMint}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': process.env.BIRDEYE_API_KEY,
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) {
      console.error(`Birdeye pairs API returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.data?.items) {
      console.log('No pairs found for token:', tokenMint);
      return [];
    }

    // Map Birdeye response to our PoolData format
    data.data.items.forEach((pair: any) => {
      // Apply DEX filter if specified
      if (dexFilter && dexFilter !== 'all' && pair.source?.toLowerCase() !== dexFilter.toLowerCase()) {
        return;
      }

      const baseSymbol = pair.baseToken?.symbol || 'UNKNOWN';
      const quoteSymbol = pair.quoteToken?.symbol || 'UNKNOWN';

      pools.push({
        symbol: `${baseSymbol}/${quoteSymbol}`,
        baseToken: baseSymbol,
        quoteToken: quoteSymbol,
        price: pair.price || 0,
        change24h: pair.priceChange24hPercent || 0,
        volume24h: pair.volume24h || pair.v24hUSD || 0,
        liquidity: pair.liquidity || pair.liquidityUSD || 0,
        dex: pair.source || 'Unknown',
        poolAddress: pair.address || pair.poolAddress || '',
        source: 'Birdeye',
      });
    });

    console.log(`Found ${pools.length} pools for token ${tokenMint}`);
  } catch (error) {
    console.error('Failed to fetch token pools:', error);
  }

  return pools;
}

/**
 * Generate mock pools for development/testing
 */
function generateMockPools(tokenSymbol: string): PoolData[] {
  const quoteTokens = ['USDC', 'SOL', 'USDT', 'BONK', 'JUP'];
  const dexes = ['Raydium', 'Orca', 'Meteora', 'Jupiter', 'Phoenix'];

  return quoteTokens.map((quote, index) => ({
    symbol: `${tokenSymbol}/${quote}`,
    baseToken: tokenSymbol,
    quoteToken: quote,
    price: Math.random() * 10,
    change24h: (Math.random() - 0.5) * 20,
    volume24h: Math.random() * 1000000,
    liquidity: Math.random() * 500000,
    dex: dexes[index % dexes.length],
    poolAddress: `mock-pool-${tokenSymbol}-${quote}-${Date.now()}`,
    source: 'Mock',
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get('token');
    const tokenSymbol = searchParams.get('symbol'); // For mock data
    const dexFilter = searchParams.get('dex');

    if (!tokenMint && !tokenSymbol) {
      return NextResponse.json(
        { error: 'Missing required parameter: token (mint address) or symbol' },
        { status: 400 }
      );
    }

    let pools: PoolData[] = [];
    let isRealData = false;
    let dataSource = 'Mock Data';

    // Try to fetch real data if we have a mint address
    if (tokenMint) {
      pools = await fetchTokenPools(tokenMint, dexFilter || undefined);
      if (pools.length > 0) {
        isRealData = true;
        dataSource = 'Birdeye API';
      }
    }

    // Fallback to mock data if no real data or only symbol provided
    if (pools.length === 0 && tokenSymbol) {
      pools = generateMockPools(tokenSymbol);
      isRealData = false;
      dataSource = 'Mock Data (Development)';
    }

    // Sort by liquidity (highest first)
    pools.sort((a, b) => b.liquidity - a.liquidity);

    return NextResponse.json({
      pools,
      isRealData,
      dataSource,
      count: pools.length,
      token: tokenMint || tokenSymbol,
      dexFilter: dexFilter || 'all',
      lastUpdate: Date.now(),
    });

  } catch (error) {
    console.error('Pools API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool data' },
      { status: 500 }
    );
  }
}
