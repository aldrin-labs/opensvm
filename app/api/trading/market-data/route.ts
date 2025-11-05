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

// Cache to track logged warnings (prevent spam)
const loggedWarnings = new Set<string>();

/**
 * Fetch real price data from Moralis API with retry logic
 */
async function fetchMoralisPrice(token: string, retries = 2): Promise<{
  price: number;
  dataSource: string;
} | null> {
  // Moralis token address mapping for Solana
  const tokenAddresses: Record<string, string> = {
    'SOL': 'So11111111111111111111111111111111111111112', // Wrapped SOL
    'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    'MNGO': 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
    'SRM': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  };

  const tokenAddress = tokenAddresses[token];
  if (!tokenAddress) {
    console.warn(`No Moralis address mapping for token: ${token}`);
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Moralis EVM API endpoint for token price
      // Note: Using public endpoint - for production, add X-API-Key header
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2/erc20/${tokenAddress}/price?chain=solana`,
        {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-Key': process.env.MORALIS_API_KEY || '',
          },
          cache: 'no-store',
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.usdPrice) {
          return {
            price: parseFloat(data.usdPrice),
            dataSource: 'Moralis API',
          };
        }
      } else if (response.status === 429) {
        // Rate limited, wait before retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      } else if (response.status === 401 || response.status === 403) {
        // API key issue, don't retry - log warning only once
        const warningKey = `moralis-auth-${token}`;
        if (!loggedWarnings.has(warningKey)) {
          console.warn(`Moralis API authentication failed for ${token}. Consider adding MORALIS_API_KEY env variable.`);
          loggedWarnings.add(warningKey);
        }
        break;
      }
    } catch (error) {
      if (attempt === retries) {
        console.warn(`Moralis price fetch failed for ${token} after ${retries + 1} attempts:`, error instanceof Error ? error.message : 'Unknown error');
      } else {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }
  }
  return null;
}

/**
 * Fetch real price data from CoinGecko API with retry logic
 */
async function fetchCoinGeckoPrice(token: string, retries = 2): Promise<{
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  dataSource: string;
} | null> {
  const tokenIds: Record<string, string> = {
    'SOL': 'solana',
    'RAY': 'raydium',
    'ORCA': 'orca',
    'MNGO': 'mango-markets',
    'SRM': 'serum',
  };

  const coinGeckoId = tokenIds[token];
  if (!coinGeckoId) return null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased to 5s

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_high_low_24h=true`,
        {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store',
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
      } else if (response.status === 429) {
        // Rate limited, wait before retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    } catch (error) {
      if (attempt === retries) {
        console.warn(`CoinGecko price fetch failed for ${token} after ${retries + 1} attempts:`, error instanceof Error ? error.message : 'Unknown error');
      } else {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }
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
    
    // Try to fetch real data from multiple sources (Moralis, CoinGecko)
    const [moralisData, coinGeckoData] = await Promise.allSettled([
      fetchMoralisPrice(baseToken),
      fetchCoinGeckoPrice(baseToken),
    ]);
    
    // Use CoinGecko as primary (has more complete data), Moralis as fallback
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
    } else if (moralisData.status === 'fulfilled' && moralisData.value) {
      const data = moralisData.value;
      // Moralis only provides price, estimate other values
      marketData = {
        market,
        price: data.price,
        change24h: 0, // Not available from Moralis alone
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
