import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface MarketDataResponse {
  market: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
  orderBook?: {
    bids: Array<{ price: number; amount: number }>;
    asks: Array<{ price: number; amount: number }>;
    spread: number;
    spreadPercent: number;
  };
  recentTrades?: Array<{
    id: string;
    price: number;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: number;
  }>;
  isRealData: boolean;
  dataSource?: string;
}

// Token mapping for different markets
const TOKEN_MAP: Record<string, string> = {
  'SOL/USDC': 'SOL',
  'SOL/USDT': 'SOL',
  'RAY/USDC': 'RAY',
  'ORCA/USDC': 'ORCA',
  'MNGO/USDC': 'MNGO',
  'SRM/USDC': 'SRM',
};

/**
 * Fetch real price data from Jupiter API
 */
async function fetchJupiterPrice(token: string): Promise<{
  price: number;
  dataSource: string;
} | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`https://price.jup.ag/v6/price?ids=${token}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenSVM/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.data?.[token]?.price) {
        return {
          price: data.data[token].price,
          dataSource: 'Jupiter API',
        };
      }
    }
  } catch (error) {
    console.warn(`Jupiter price fetch failed for ${token}:`, error);
  }
  return null;
}

/**
 * Fetch real price data from CoinGecko API
 */
async function fetchCoinGeckoPrice(token: string): Promise<{
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  dataSource: string;
} | null> {
  try {
    const tokenIds: Record<string, string> = {
      'SOL': 'solana',
      'RAY': 'raydium',
      'ORCA': 'orca',
      'MNGO': 'mango-markets',
      'SRM': 'serum',
    };

    const coinGeckoId = tokenIds[token];
    if (!coinGeckoId) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_high_low_24h=true`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const tokenData = data[coinGeckoId];
      
      if (tokenData?.usd) {
        return {
          price: tokenData.usd,
          change24h: tokenData.usd_24h_change || 0,
          high24h: tokenData.usd_24h_high || tokenData.usd,
          low24h: tokenData.usd_24h_low || tokenData.usd,
          volume24h: tokenData.usd_24h_vol || 0,
          dataSource: 'CoinGecko API',
        };
      }
    }
  } catch (error) {
    console.warn(`CoinGecko price fetch failed for ${token}:`, error);
  }
  return null;
}

/**
 * Generate mock orderbook for development
 * In production, this would fetch from DEX APIs (Raydium, Jupiter, Orca)
 */
function generateMockOrderBook(basePrice: number) {
  const bids: Array<{ price: number; amount: number }> = [];
  const asks: Array<{ price: number; amount: number }> = [];
  
  for (let i = 0; i < 10; i++) {
    const bidPrice = basePrice - (i * basePrice * 0.001); // 0.1% steps down
    const askPrice = basePrice + (i * basePrice * 0.001); // 0.1% steps up
    const amount = 10 + Math.random() * 90; // 10-100 tokens
    
    bids.push({ price: bidPrice, amount });
    asks.push({ price: askPrice, amount });
  }
  
  const spread = asks[0].price - bids[0].price;
  const spreadPercent = (spread / bids[0].price) * 100;
  
  return { bids, asks, spread, spreadPercent };
}

/**
 * Generate mock recent trades
 * In production, this would fetch from DEX transaction history
 */
function generateMockTrades(basePrice: number) {
  const trades: Array<{
    id: string;
    price: number;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: number;
  }> = [];
  
  const now = Date.now();
  
  for (let i = 0; i < 20; i++) {
    const variance = (Math.random() - 0.5) * basePrice * 0.002; // ±0.2%
    trades.push({
      id: `trade-${now}-${i}`,
      price: basePrice + variance,
      amount: Math.random() * 10 + 0.1,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      timestamp: now - i * 5000, // 5 seconds apart
    });
  }
  
  return trades;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get('market') || 'SOL/USDC';
    
    const baseToken = TOKEN_MAP[market] || 'SOL';
    
    // Try to fetch real data from multiple sources
    const [jupiterData, coinGeckoData] = await Promise.allSettled([
      fetchJupiterPrice(baseToken),
      fetchCoinGeckoPrice(baseToken),
    ]);
    
    // Use CoinGecko as primary (has more complete data), Jupiter as fallback
    let marketData: MarketDataResponse;
    
    if (coinGeckoData.status === 'fulfilled' && coinGeckoData.value) {
      const data = coinGeckoData.value;
      marketData = {
        market,
        price: data.price,
        change24h: data.change24h,
        volume24h: data.volume24h,
        high24h: data.high24h,
        low24h: data.low24h,
        lastUpdate: Date.now(),
        orderBook: generateMockOrderBook(data.price),
        recentTrades: generateMockTrades(data.price),
        isRealData: true,
        dataSource: data.dataSource,
      };
    } else if (jupiterData.status === 'fulfilled' && jupiterData.value) {
      const data = jupiterData.value;
      // Jupiter only provides price, estimate other values
      marketData = {
        market,
        price: data.price,
        change24h: 0, // Not available from Jupiter alone
        volume24h: 0, // Not available
        high24h: data.price * 1.02, // Estimate ±2%
        low24h: data.price * 0.98,
        lastUpdate: Date.now(),
        orderBook: generateMockOrderBook(data.price),
        recentTrades: generateMockTrades(data.price),
        isRealData: true,
        dataSource: `${data.dataSource} (price only)`,
      };
    } else {
      // Fallback to mock data with clear indication
      const mockPrice = 150 + Math.random() * 50; // $150-200 for SOL
      marketData = {
        market,
        price: mockPrice,
        change24h: (Math.random() - 0.5) * 10,
        volume24h: Math.random() * 1000000,
        high24h: mockPrice * 1.05,
        low24h: mockPrice * 0.95,
        lastUpdate: Date.now(),
        orderBook: generateMockOrderBook(mockPrice),
        recentTrades: generateMockTrades(mockPrice),
        isRealData: false,
        dataSource: 'Mock Data (Development Mode)',
      };
    }
    
    return NextResponse.json(marketData);
    
  } catch (error) {
    console.error('Market data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
