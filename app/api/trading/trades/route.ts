import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export const runtime = 'edge';

interface Trade {
  id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
  dex?: string;
  txHash?: string;
}

/**
 * Fetch recent trades from Birdeye API
 */
async function fetchBirdeyeTrades(mint: string, limit: number = 50): Promise<Trade[]> {
  if (!process.env.BIRDEYE_API_KEY) {
    console.warn('BIRDEYE_API_KEY not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/txs/token?address=${mint}&tx_type=swap&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': process.env.BIRDEYE_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`Birdeye trades API returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.data?.items) {
      return [];
    }

    // Map Birdeye response to our Trade format
    const trades: Trade[] = data.data.items.map((item: any, index: number) => ({
      id: item.txHash || `trade-${Date.now()}-${index}`,
      price: item.pricePair || 0,
      amount: item.base?.uiAmount || item.quote?.uiAmount || 0,
      side: item.base?.uiChangeAmount > 0 ? 'buy' : 'sell',
      timestamp: (item.blockUnixTime || Math.floor(Date.now() / 1000)) * 1000,
      dex: item.source || 'Unknown',
      txHash: item.txHash,
    }));

    return trades.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to fetch Birdeye trades:', error);
    return [];
  }
}

/**
 * Generate mock trades for development
 */
function generateMockTrades(basePrice: number, limit: number = 50): Trade[] {
  const trades: Trade[] = [];
  const now = Date.now();

  for (let i = 0; i < limit; i++) {
    const variance = (Math.random() - 0.5) * basePrice * 0.002; // ±0.2%
    trades.push({
      id: `mock-trade-${now}-${i}`,
      price: basePrice + variance,
      amount: Math.random() * 10 + 0.1,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      timestamp: now - i * 5000, // 5 seconds apart
      dex: ['Raydium', 'Orca', 'Jupiter'][Math.floor(Math.random() * 3)],
    });
  }

  return trades;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mint = searchParams.get('mint') || 'So11111111111111111111111111111111111111112'; // SOL by default
    const limit = parseInt(searchParams.get('limit') || '50');
    const source = searchParams.get('source') || 'auto'; // 'auto', 'birdeye', or 'mock'

    let trades: Trade[] = [];
    let isRealData = false;
    let dataSource = 'Mock Data';

    // Try Birdeye if auto or explicitly requested
    if (source === 'auto' || source === 'birdeye') {
      trades = await fetchBirdeyeTrades(mint, limit);
      if (trades.length > 0) {
        isRealData = true;
        dataSource = 'Birdeye API';
      }
    }

    // Fallback to mock data
    if (trades.length === 0) {
      const basePrice = 150 + Math.random() * 50; // SOL price range
      trades = generateMockTrades(basePrice, limit);
      isRealData = false;
      dataSource = 'Mock Data';
    }

    return NextResponse.json({
      trades,
      isRealData,
      dataSource,
      count: trades.length,
      mint,
      lastUpdate: Date.now(),
    });

  } catch (error) {
    console.error('Trades API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
