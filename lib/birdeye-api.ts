// Birdeye API integration for Solana token market data
// This is the PRIMARY API for token price/market data (replaces Moralis)

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';

// Cache for API responses to improve performance
const apiCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for real-time market data

export interface TokenOverview {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: number;
  v24hUSD: number; // 24h volume
  v24hChangePercent: number;
  liquidity: number;
  mc: number; // market cap
  holder: number;
  supply: number;
  lastTradeUnixTime: number;
}

export interface BirdeyeResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Make a cached API request to Birdeye
 */
async function makeApiRequest(
  endpoint: string,
  params: Record<string, any> = {},
  forceRefresh: boolean = false
): Promise<any> {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

  if (!BIRDEYE_API_KEY) {
    console.warn('⚠️  Birdeye API key not configured');
    return null;
  }

  // Check cache
  if (!forceRefresh && apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log(`✓ Using cached Birdeye data for ${endpoint}`);
    return apiCache[cacheKey].data;
  }

  try {
    const url = new URL(endpoint, BIRDEYE_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': BIRDEYE_API_KEY
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('⚠️  Rate limit exceeded for Birdeye API');
        return null;
      }
      console.error(`⚠️  Birdeye API error ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Cache the response
    apiCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    return data;
  } catch (error: any) {
    console.error(`⚠️  Birdeye API request failed:`, error.message);
    return null;
  }
}

/**
 * Get comprehensive token overview including price, volume, liquidity
 */
export async function getTokenOverview(address: string): Promise<TokenOverview | null> {
  const response = await makeApiRequest(`/defi/token_overview`, { address });
  
  if (!response || response.success === false) {
    return null;
  }

  return response.data as TokenOverview;
}

/**
 * Get token price (simpler method if you only need price)
 */
export async function getTokenPrice(address: string): Promise<{ price: number; address: string } | null> {
  const response = await makeApiRequest(`/defi/price`, { address });
  
  if (!response || response.success === false) {
    return null;
  }

  return {
    price: response.data?.value || 0,
    address
  };
}

/**
 * Get OHLCV candlestick data for charting
 */
export async function getOHLCV(
  address: string,
  type: string = '15m',
  time_from?: number,
  time_to?: number
): Promise<any> {
  const params: Record<string, any> = { address, type: type || '15m' };
  
  if (time_from) params.time_from = time_from;
  if (time_to) params.time_to = time_to;

  const response = await makeApiRequest(`/defi/ohlcv`, params);
  
  if (!response || response.success === false) {
    return null;
  }

  return response.data;
}

/**
 * Get market depth / orderbook
 */
export async function getOrderbook(
  address: string,
  offset: number = 100
): Promise<any> {
  const response = await makeApiRequest(`/defi/v2/orderbook`, { address, offset });
  
  if (!response || response.success === false) {
    return null;
  }

  return response.data;
}

/**
 * Get multiple token prices in one call (batch)
 */
export async function getMultiPrice(addresses: string[]): Promise<Record<string, number>> {
  const response = await makeApiRequest(`/defi/multi_price`, { 
    list_address: addresses.join(',') 
  });
  
  if (!response || response.success === false) {
    return {};
  }

  const result: Record<string, number> = {};
  const data = response.data || {};
  
  for (const [address, info] of Object.entries(data)) {
    result[address] = (info as any)?.value || 0;
  }

  return result;
}

/**
 * Get token security and holder information
 */
export async function getTokenSecurity(address: string): Promise<any> {
  const response = await makeApiRequest(`/defi/token_security`, { address });
  
  if (!response || response.success === false) {
    return null;
  }

  return response.data;
}

/**
 * Search for tokens by name or symbol
 */
export async function searchTokens(query: string, limit: number = 10): Promise<any[]> {
  const response = await makeApiRequest(`/defi/v3/search`, { 
    keyword: query,
    chain: 'solana',
    limit
  });
  
  if (!response || response.success === false) {
    return [];
  }

  return response.data?.items || [];
}
