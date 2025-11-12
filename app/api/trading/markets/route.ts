import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttlMs: number = 60000) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

// Popular Solana tokens - expanded list for better coverage
const FALLBACK_TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', name: 'Solana' },
  { symbol: 'OVSM', mint: 'opensVMmW27Loo5w4Yx4FbqXNvMCKLrgXUFTZZR8Vz', name: 'OpenSVM' }, // Added OVSM
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk' },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', name: 'Jupiter' },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', name: 'Pyth Network' },
  { symbol: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', name: 'Orca' },
  { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', name: 'Raydium' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat' },
  { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', name: 'Jito' },
  { symbol: 'MNGO', mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac', name: 'Mango' },
  { symbol: 'MSOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name: 'Marinade SOL' },
  { symbol: 'SHDW', mint: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y', name: 'Shadow' },
  { symbol: 'KMNO', mint: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', name: 'Kamino' },
  { symbol: 'BSOL', mint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', name: 'BlazeStake SOL' },
  { symbol: 'SAMO', mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', name: 'Samoyedcoin' },
  { symbol: 'STEP', mint: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT', name: 'Step Finance' },
  { symbol: 'FIDA', mint: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp', name: 'Bonfida' },
  { symbol: 'HNT', mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux', name: 'Helium' },
  { symbol: 'RENDER', mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', name: 'Render' },
  { symbol: 'MOBILE', mint: 'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6', name: 'Helium Mobile' },
  { symbol: 'IOT', mint: 'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns', name: 'Helium IOT' }
];

interface MarketData {
  symbol: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  change24h: number;
  volume24h: number;
  source: string;
  marketCap?: number;
  liquidity?: number;
  mint?: string;
  dex?: string; // Added DEX information
  poolAddress?: string; // Added pool address
}

/**
 * Fetch trending/top tokens from Birdeye API
 */
async function fetchBirdeyeMarkets(type: string = 'trending'): Promise<MarketData[]> {
  if (!process.env.BIRDEYE_API_KEY) {
    console.warn('BIRDEYE_API_KEY not configured');
    return [];
  }

  // Check cache first
  const cacheKey = `birdeye_markets_${type}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`Using cached data for ${type} markets`);
    return cached;
  }

  const markets: MarketData[] = [];

  try {
    // Map type to Birdeye sort parameters
    let sortBy = 'v24hUSD'; // default to volume
    let sortType = 'desc';
    let limit = 100; // Get up to 100 tokens

    switch (type) {
      case 'trending':
        sortBy = 'v24hChangePercent'; // Sort by volume change
        break;
      case 'gainers':
        sortBy = 'priceChange24hPercent';
        sortType = 'desc';
        break;
      case 'losers':
        sortBy = 'priceChange24hPercent';
        sortType = 'asc';
        break;
      case 'volume':
        sortBy = 'v24hUSD';
        break;
      case 'marketcap':
        sortBy = 'mc';
        break;
    }

    // Try different Birdeye endpoints based on type
    let response;

    if (type === 'trending' || type === 'gainers' || type === 'losers') {
      // Use price gainers/losers endpoint for trending
      const interval = '24h';
      const sort = type === 'losers' ? 'asc' : 'desc';
      response = await fetch(
        `https://public-api.birdeye.so/defi/price_change/24h?type=${type === 'losers' ? 'loser' : 'gainer'}&offset=0&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': process.env.BIRDEYE_API_KEY,
            'x-chain': 'solana',
          },
        }
      );
    } else {
      // Use token list endpoint for other types
      response = await fetch(
        `https://public-api.birdeye.so/defi/tokenlist?sort_by=${sortBy}&sort_type=${sortType}&limit=${limit}&offset=0`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': process.env.BIRDEYE_API_KEY,
            'x-chain': 'solana',
          },
        }
      );
    }

    if (response.ok) {
      const data = await response.json();

      // Handle different response formats
      let tokens = [];
      if (data.data?.tokens) {
        tokens = data.data.tokens;
      } else if (data.data?.items) {
        tokens = data.data.items;
      } else if (Array.isArray(data.data)) {
        tokens = data.data;
      }

      // Map Birdeye response to our MarketData format
      tokens.forEach((token: any) => {
        // Only include tokens with reasonable data
        if ((token.address || token.mint) && token.symbol && (token.price > 0 || token.currentPrice > 0)) {
          markets.push({
            symbol: `${token.symbol}/USDC`,
            baseToken: token.symbol,
            quoteToken: 'USDC',
            price: token.price || token.currentPrice || 0,
            change24h: token.priceChange24hPercent || token.priceChangePercent || 0,
            volume24h: token.v24hUSD || token.volume24h || 0,
            source: 'Birdeye',
            marketCap: token.mc || token.marketCap || 0,
            liquidity: token.liquidity || 0,
            mint: token.address || token.mint,
          });
        }
      });

      console.log(`Fetched ${markets.length} markets from Birdeye (${type})`);
    } else {
      console.error(`Birdeye API returned status ${response.status}`);
    }
  } catch (error) {
    console.error('Birdeye tokenlist failed:', error);
  }

  // If we don't have enough markets, always fetch our curated list
  if (markets.length < 10) {
    console.log('Fetching individual token data for better coverage...');
    const fallbackPromises = FALLBACK_TOKENS.map(async (token) => {
        try {
          const resp = await fetch(
            `https://public-api.birdeye.so/defi/token_overview?address=${token.mint}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
              },
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.data) {
              const tokenData = data.data;
              return {
                symbol: `${token.symbol}/USDC`,
                baseToken: token.symbol,
                quoteToken: 'USDC',
                price: tokenData.price || 0,
                change24h: tokenData.priceChange24hPercent || 0,
                volume24h: tokenData.v24hUSD || 0,
                source: 'Birdeye',
                marketCap: tokenData.mc || 0,
                liquidity: tokenData.liquidity || 0,
                mint: token.mint,
              };
            }
          }
        } catch (error) {
          console.error(`Failed to fetch fallback data for ${token.symbol}:`, error);
        }
        return null;
      });

    const fallbackResults = await Promise.allSettled(fallbackPromises);
    fallbackResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        markets.push(result.value);
      }
    });
    console.log(`Added ${markets.length} tokens from fallback list`);
  }

  // Cache the results for 1 minute
  if (markets.length > 0) {
    setCache(cacheKey, markets, 60000);
  }

  return markets;
}

/**
 * Fetch market data from CoinGecko API as fallback
 */
async function fetchCoinGeckoMarkets(): Promise<MarketData[]> {
  try {
    // Fetch top 100 coins by market cap from CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const markets: MarketData[] = [];

      // Filter for Solana ecosystem tokens (you can expand this logic)
      data.forEach((token: any) => {
        // Include all tokens, not just Solana specific ones for diversity
        if (token.symbol && token.current_price > 0) {
          markets.push({
            symbol: `${token.symbol.toUpperCase()}/USDC`,
            baseToken: token.symbol.toUpperCase(),
            quoteToken: 'USDC',
            price: token.current_price || 0,
            change24h: token.price_change_percentage_24h || 0,
            volume24h: token.total_volume || 0,
            source: 'CoinGecko',
            marketCap: token.market_cap || 0,
          });
        }
      });

      console.log(`Fetched ${markets.length} markets from CoinGecko`);
      return markets;
    }
  } catch (error) {
    console.error('Failed to fetch CoinGecko data:', error);
  }

  return [];
}

/**
 * Generate mock market data as fallback
 */
function generateMockMarkets(): MarketData[] {
  // Generate 50+ mock tokens for better UX during development
  const mockTokens = [
    'SOL', 'BONK', 'JUP', 'PYTH', 'ORCA', 'RAY', 'WIF', 'JTO',
    'MNGO', 'SRM', 'STEP', 'FIDA', 'SABER', 'MSOL', 'USDC', 'USDT',
    'DUST', 'FORGE', 'GST', 'GENE', 'AURY', 'ATLAS', 'POLIS', 'MEAN',
    'SLIM', 'COPE', 'ROPE', 'MEDIA', 'TULIP', 'ORCA', 'SHDW', 'SAMO',
    'NINJA', 'LIKE', 'MAPS', 'OXY', 'PERP', 'RATIO', 'SNSY', 'SOLC',
    'SUNNY', 'SLRS', 'APEX', 'BANANA', 'BLOCK', 'BOKU', 'CHEEMS', 'DINO',
    'FROG', 'GRAPE', 'HAWK', 'HONEY', 'KITTY', 'MANGO', 'MEOW', 'NANA',
  ];

  return mockTokens.map(symbol => ({
    symbol: `${symbol}/USDC`,
    baseToken: symbol,
    quoteToken: 'USDC',
    price: Math.random() * 100,
    change24h: (Math.random() - 0.5) * 40,
    volume24h: Math.random() * 10000000,
    source: 'Mock',
    marketCap: Math.random() * 100000000,
    liquidity: Math.random() * 5000000,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'trending';
    const limit = parseInt(searchParams.get('limit') || '100');
    const dexFilter = searchParams.get('dex'); // New: DEX filter parameter

    // Try to fetch real data from multiple sources
    const [birdeyeData, coinGeckoData] = await Promise.allSettled([
      fetchBirdeyeMarkets(type),
      fetchCoinGeckoMarkets(),
    ]);

    let markets: MarketData[] = [];
    let isRealData = false;
    let dataSource = 'Mock Data';

    // Use Birdeye as primary source
    if (birdeyeData.status === 'fulfilled' && birdeyeData.value.length > 0) {
      markets = birdeyeData.value;
      isRealData = true;
      dataSource = 'Birdeye API';
    }
    // Use CoinGecko as fallback
    else if (coinGeckoData.status === 'fulfilled' && coinGeckoData.value.length > 0) {
      markets = coinGeckoData.value;
      isRealData = true;
      dataSource = 'CoinGecko API';
    }
    // Use mock data as last resort
    else {
      markets = generateMockMarkets();
      isRealData = false;
      dataSource = 'Mock Data (Development)';
    }

    // If not using Birdeye (which already sorts), apply sorting
    if (dataSource !== 'Birdeye API') {
      switch (type) {
        case 'trending':
          // Sort by volume and positive change
          markets.sort((a, b) => {
            const scoreA = a.volume24h * (1 + Math.max(0, a.change24h / 100));
            const scoreB = b.volume24h * (1 + Math.max(0, b.change24h / 100));
            return scoreB - scoreA;
          });
          break;
        case 'gainers':
          markets.sort((a, b) => b.change24h - a.change24h);
          break;
        case 'losers':
          markets.sort((a, b) => a.change24h - b.change24h);
          break;
        case 'volume':
          markets.sort((a, b) => b.volume24h - a.volume24h);
          break;
        case 'marketcap':
        default:
          // Default sort by market cap
          markets.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
      }
    }

    // Apply DEX filter if specified
    if (dexFilter && dexFilter !== 'all') {
      markets = markets.filter(market => 
        market.dex?.toLowerCase() === dexFilter.toLowerCase()
      );
    }

    // Apply limit
    if (limit && limit > 0) {
      markets = markets.slice(0, limit);
    }

    return NextResponse.json({
      markets,
      isRealData,
      dataSource,
      count: markets.length,
      totalAvailable: markets.length,
      type,
      lastUpdate: Date.now(),
    });

  } catch (error) {
    console.error('Markets API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
