import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


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
    isVirtual?: boolean;
  };
  ammState?: {
    type: string;
    dex: string;
    poolAddress: string;
    liquidity: number;
    baseReserve: number;
    quoteReserve: number;
    constantProduct: number;
    fee: number;
    volume24h: number;
    trades24h: number;
    priceImpact: {
      buy100: number;
      buy1000: number;
      sell100: number;
      sell1000: number;
    };
    virtualOrderbook?: any;
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
  'BONK/USDC': 'BONK',
  'JUP/USDC': 'JUP',
  'PYTH/USDC': 'PYTH',
};

// Solana mint addresses for Birdeye API
const MINT_ADDRESSES: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'MNGO': 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
  'SRM': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
};

// Cache to track logged warnings (prevent spam)
const loggedWarnings = new Set<string>();

/**
 * Calculate price impact for a given trade size on an AMM
 */
function calculatePriceImpact(tradeSize: number, poolData: any): number {
  if (!poolData || !poolData.base?.reserve || !poolData.quote?.reserve) {
    return 0;
  }

  const baseReserve = poolData.base.reserve;
  const quoteReserve = poolData.quote.reserve;
  const k = baseReserve * quoteReserve; // constant product

  // For buying (positive tradeSize), we're adding quote and removing base
  // For selling (negative tradeSize), we're adding base and removing quote
  const isBuy = tradeSize > 0;
  const absSize = Math.abs(tradeSize);

  if (isBuy) {
    // Buying: quote in, base out
    const newQuoteReserve = quoteReserve + absSize;
    const newBaseReserve = k / newQuoteReserve;
    const baseOut = baseReserve - newBaseReserve;
    const effectivePrice = absSize / baseOut;
    const spotPrice = quoteReserve / baseReserve;
    return ((effectivePrice - spotPrice) / spotPrice) * 100;
  } else {
    // Selling: base in, quote out
    const newBaseReserve = baseReserve + absSize;
    const newQuoteReserve = k / newBaseReserve;
    const quoteOut = quoteReserve - newQuoteReserve;
    const effectivePrice = quoteOut / absSize;
    const spotPrice = quoteReserve / baseReserve;
    return ((spotPrice - effectivePrice) / spotPrice) * 100;
  }
}

/**
 * Generate a virtual orderbook from AMM curve parameters
 */
function generateVirtualOrderbook(currentPrice: number, poolData: any): any {
  const bids: Array<{ price: number; amount: number }> = [];
  const asks: Array<{ price: number; amount: number }> = [];

  // Generate 10 levels on each side
  for (let i = 0; i < 10; i++) {
    // Calculate price levels based on liquidity depth
    const priceStep = currentPrice * 0.002 * (i + 1); // 0.2% steps

    // Bid side (buy orders)
    const bidPrice = currentPrice - priceStep;
    const bidAmount = calculateAmountAtPrice(bidPrice, poolData, false);
    if (bidPrice > 0 && bidAmount > 0) {
      bids.push({ price: bidPrice, amount: bidAmount });
    }

    // Ask side (sell orders)
    const askPrice = currentPrice + priceStep;
    const askAmount = calculateAmountAtPrice(askPrice, poolData, true);
    if (askAmount > 0) {
      asks.push({ price: askPrice, amount: askAmount });
    }
  }

  const spread = asks.length > 0 && bids.length > 0
    ? asks[0].price - bids[0].price
    : 0;
  const spreadPercent = bids.length > 0 && spread > 0
    ? (spread / bids[0].price) * 100
    : 0;

  return { bids, asks, spread, spreadPercent, isVirtual: true };
}

/**
 * Calculate available amount at a specific price on AMM curve
 */
function calculateAmountAtPrice(targetPrice: number, poolData: any, isBuy: boolean): number {
  if (!poolData || !poolData.base?.reserve || !poolData.quote?.reserve) {
    // Return synthetic amount based on liquidity
    const liquidity = poolData?.liquidity || 100000;
    return liquidity / (targetPrice * 100); // Simple approximation
  }

  const baseReserve = poolData.base.reserve;
  const quoteReserve = poolData.quote.reserve;
  const k = baseReserve * quoteReserve;
  const currentPrice = quoteReserve / baseReserve;

  // Calculate how much needs to be traded to reach target price
  if (isBuy) {
    // For buys, price increases
    if (targetPrice <= currentPrice) return 0;
    const newBaseReserve = Math.sqrt(k / targetPrice);
    return baseReserve - newBaseReserve;
  } else {
    // For sells, price decreases
    if (targetPrice >= currentPrice) return 0;
    const newBaseReserve = Math.sqrt(k / targetPrice);
    return newBaseReserve - baseReserve;
  }
}

/**
 * Fetch comprehensive market data from Birdeye API
 */
async function fetchBirdeyeMarketData(token: string, retries = 2): Promise<{
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  orderBook?: any;
  dataSource: string;
} | null> {
  const mintAddress = MINT_ADDRESSES[token];
  if (!mintAddress || !process.env.BIRDEYE_API_KEY) {
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Fetch token overview from Birdeye
      const response = await fetch(
        `https://public-api.birdeye.so/defi/token_overview?address=${mintAddress}`,
        {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': process.env.BIRDEYE_API_KEY,
          },
          cache: 'no-store',
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const tokenData = data.data;

          // Try to fetch orderbook data OR AMM pool data
          let orderBookData = null;
          let poolData = null;

          try {
            // First try orderbook
            const orderbookResponse = await fetch(
              `https://public-api.birdeye.so/defi/orderbook?address=${mintAddress}&offset=50`,
              {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'X-API-KEY': process.env.BIRDEYE_API_KEY,
                },
              }
            );

            if (orderbookResponse.ok) {
              const obData = await orderbookResponse.json();
              if (obData.success && obData.data) {
                orderBookData = obData.data;
              }
            }

            // If no orderbook, try to get AMM pool data
            if (!orderBookData || (orderBookData.bids?.length === 0 && orderBookData.asks?.length === 0)) {
              // Fetch top pools for this token
              const poolsResponse = await fetch(
                `https://public-api.birdeye.so/defi/v2/markets?address=${mintAddress}&sort_by=liquidity&sort_type=desc&limit=3`,
                {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json',
                    'X-API-KEY': process.env.BIRDEYE_API_KEY,
                    'x-chain': 'solana',
                  },
                }
              );

              if (poolsResponse.ok) {
                const poolsData = await poolsResponse.json();
                if (poolsData.success && poolsData.data?.items?.length > 0) {
                  poolData = poolsData.data.items[0]; // Use top liquidity pool
                }
              }
            }
          } catch (error) {
            console.warn('Failed to fetch orderbook/pool data:', error);
          }

          // Process orderbook if available
          let orderBook = null;
          let ammState = null;

          if (orderBookData && orderBookData.bids?.length > 0) {
            const bids = (orderBookData.bids || []).slice(0, 10).map((bid: any) => ({
              price: bid.price || 0,
              amount: bid.size || 0,
            }));
            const asks = (orderBookData.asks || []).slice(0, 10).map((ask: any) => ({
              price: ask.price || 0,
              amount: ask.size || 0,
            }));

            const spread = asks.length > 0 && bids.length > 0
              ? asks[0].price - bids[0].price
              : 0;
            const spreadPercent = bids.length > 0 && spread > 0
              ? (spread / bids[0].price) * 100
              : 0;

            orderBook = { bids, asks, spread, spreadPercent };
          }
          // If no orderbook but have pool data, create AMM state
          else if (poolData) {
            ammState = {
              type: 'AMM',
              dex: poolData.source || 'Unknown DEX',
              poolAddress: poolData.address,
              liquidity: poolData.liquidity || 0,
              baseReserve: poolData.base?.reserve || 0,
              quoteReserve: poolData.quote?.reserve || 0,
              constantProduct: poolData.liquidity || 0, // Approximate k value
              fee: poolData.fee || 0.003, // Default 0.3% for most AMMs
              volume24h: poolData.volume24h || 0,
              trades24h: poolData.trade24h || 0,
              priceImpact: {
                buy100: calculatePriceImpact(100, poolData),
                buy1000: calculatePriceImpact(1000, poolData),
                sell100: calculatePriceImpact(-100, poolData),
                sell1000: calculatePriceImpact(-1000, poolData),
              },
              // Generate virtual orderbook from AMM curve
              virtualOrderbook: generateVirtualOrderbook(tokenData.price, poolData),
            };
          }

          return {
            price: tokenData.price || 0,
            change24h: tokenData.priceChange24hPercent || 0,
            high24h: tokenData.price24hHigh || tokenData.price,
            low24h: tokenData.price24hLow || tokenData.price,
            volume24h: tokenData.v24hUSD || 0,
            orderBook: orderBook || ammState?.virtualOrderbook || undefined,
            ammState: ammState || undefined,
            dataSource: 'Birdeye API',
          };
        }
      } else if (response.status === 429) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    } catch (error) {
      if (attempt === retries) {
        console.warn(`Birdeye fetch failed for ${token}:`, error instanceof Error ? error.message : 'Unknown error');
      } else {
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }
  }
  return null;
}

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

    // Try to fetch real data from multiple sources (Birdeye, CoinGecko, Moralis)
    const [birdeyeData, coinGeckoData, moralisData] = await Promise.allSettled([
      fetchBirdeyeMarketData(baseToken),
      fetchCoinGeckoPrice(baseToken),
      fetchMoralisPrice(baseToken),
    ]);

    // Use Birdeye as primary (has orderbook), CoinGecko as secondary, Moralis as fallback
    let marketData: MarketDataResponse;

    if (birdeyeData.status === 'fulfilled' && birdeyeData.value) {
      const data = birdeyeData.value;
      marketData = {
        market,
        price: data.price,
        change24h: data.change24h,
        volume24h: data.volume24h,
        high24h: data.high24h,
        low24h: data.low24h,
        lastUpdate: Date.now(),
        orderBook: data.orderBook || generateMockOrderBook(data.price),
        ammState: data.ammState,
        recentTrades: generateMockTrades(data.price),
        isRealData: true,
        dataSource: data.dataSource,
      };
    } else if (coinGeckoData.status === 'fulfilled' && coinGeckoData.value) {
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
