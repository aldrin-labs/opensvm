import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from './solana-connection';

// Major Solana DEX Program IDs
export const DEX_PROGRAM_IDS = {
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  ORCA: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  OPENBOOK: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
  METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'
} as const;

export interface TokenPrice {
  mint: string;
  symbol: string;
  price: number;
  priceUsd: number;
  volume24h: number;
  change24h: number;
  source: string;
  timestamp: number;
  liquidity?: number;
}

export interface LiquidityPool {
  address: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  liquidity: number;
  volume24h: number;
  fees24h: number;
  apy: number;
  dex: string;
  timestamp: number;
}

export interface DEXAggregatedData {
  prices: TokenPrice[];
  pools: LiquidityPool[];
  totalLiquidity: number;
  totalVolume24h: number;
}

/**
 * Fetches token prices from Jupiter aggregator API
 */
export async function getJupiterPrices(tokenMints: string[]): Promise<TokenPrice[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch('https://price.jup.ag/v6/price?ids=' + tokenMints.join(','), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenSVM/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const data = await response.json();
    const prices: TokenPrice[] = [];

    for (const [mint, priceData] of Object.entries(data.data || {})) {
      if (typeof priceData === 'object' && priceData !== null) {
        const price = priceData as any;
        prices.push({
          mint,
          symbol: price.symbol || 'UNKNOWN',
          price: price.price || 0,
          priceUsd: price.price || 0,
          volume24h: price.volume24h || 0,
          change24h: price.change24h || 0,
          source: 'Jupiter',
          timestamp: Date.now(),
        });
      }
    }

    return prices;
  } catch (error) {
    console.warn('Jupiter API unavailable, using fallback data:', error);
    // Return fallback data for common tokens
    return getMockTokenPrices(tokenMints);
  }
}

/**
 * Provides mock token prices as fallback
 */
function getMockTokenPrices(tokenMints: string[]): TokenPrice[] {
  const mockPrices: { [key: string]: TokenPrice } = {
    'So11111111111111111111111111111111111111112': {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      price: 98.50,
      priceUsd: 98.50,
      volume24h: 1250000000,
      change24h: 2.3,
      source: 'Mock',
      timestamp: Date.now(),
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      price: 1.0005,
      priceUsd: 1.0005,
      volume24h: 890000000,
      change24h: 0.05,
      source: 'Mock',
      timestamp: Date.now(),
    },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      price: 0.9998,
      priceUsd: 0.9998,
      volume24h: 780000000,
      change24h: -0.02,
      source: 'Mock',
      timestamp: Date.now(),
    },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
      mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      symbol: 'mSOL',
      price: 102.75,
      priceUsd: 102.75,
      volume24h: 45000000,
      change24h: 3.1,
      source: 'Mock',
      timestamp: Date.now(),
    },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'RAY',
      price: 2.45,
      priceUsd: 2.45,
      volume24h: 28000000,
      change24h: -1.8,
      source: 'Mock',
      timestamp: Date.now(),
    },
  };

  return tokenMints
    .map(mint => mockPrices[mint])
    .filter(Boolean);
}

/**
 * Fetches Raydium pool information
 */
export async function getRaydiumPools(): Promise<LiquidityPool[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenSVM/1.0',
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Raydium API error: ${response.status}`);
    }

    const data = await response.json();
    const pools: LiquidityPool[] = [];

    // Process official pools
    const officialPools = data.official || [];
    for (const pool of officialPools.slice(0, 10)) { // Limit to top 10 pools
      pools.push({
        address: pool.id,
        tokenA: pool.baseMint,
        tokenB: pool.quoteMint,
        tokenASymbol: pool.baseSymbol || 'UNKNOWN',
        tokenBSymbol: pool.quoteSymbol || 'UNKNOWN',
        liquidity: pool.liquidity || 0,
        volume24h: pool.volume24h || 0,
        fees24h: pool.fee24h || 0,
        apy: pool.apy || 0,
        dex: 'Raydium',
        timestamp: Date.now(),
      });
    }

    return pools;
  } catch (error) {
    console.warn('Raydium API unavailable, using mock data:', error);
    return getMockRaydiumPools();
  }
}

/**
 * Provides mock Raydium pools as fallback
 */
function getMockRaydiumPools(): LiquidityPool[] {
  return [
    {
      address: 'mock_raydium_sol_usdc',
      tokenA: 'So11111111111111111111111111111111111111112',
      tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      tokenASymbol: 'SOL',
      tokenBSymbol: 'USDC',
      liquidity: 12500000,
      volume24h: 4500000,
      fees24h: 13500,
      apy: 12.5,
      dex: 'Raydium',
      timestamp: Date.now(),
    },
    {
      address: 'mock_raydium_ray_sol',
      tokenA: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      tokenB: 'So11111111111111111111111111111111111111112',
      tokenASymbol: 'RAY',
      tokenBSymbol: 'SOL',
      liquidity: 8750000,
      volume24h: 2100000,
      fees24h: 6300,
      apy: 18.7,
      dex: 'Raydium',
      timestamp: Date.now(),
    },
  ];
}

/**
 * Fetches Orca pool information
 */
export async function getOrcaPools(): Promise<LiquidityPool[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.orca.so/v1/whirlpool/list', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenSVM/1.0',
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Orca API error: ${response.status}`);
    }

    const data = await response.json();
    const pools: LiquidityPool[] = [];

    // Process whirlpools
    const whirlpools = data.whirlpools || [];
    for (const pool of whirlpools.slice(0, 10)) { // Limit to top 10 pools
      pools.push({
        address: pool.address,
        tokenA: pool.tokenA?.mint || '',
        tokenB: pool.tokenB?.mint || '',
        tokenASymbol: pool.tokenA?.symbol || 'UNKNOWN',
        tokenBSymbol: pool.tokenB?.symbol || 'UNKNOWN',
        liquidity: pool.tvl || 0,
        volume24h: pool.volume24h || 0,
        fees24h: pool.fees24h || 0,
        apy: pool.apy || 0,
        dex: 'Orca',
        timestamp: Date.now(),
      });
    }

    return pools;
  } catch (error) {
    console.warn('Orca API unavailable, using mock data:', error);
    return getMockOrcaPools();
  }
}

/**
 * Provides mock Orca pools as fallback
 */
function getMockOrcaPools(): LiquidityPool[] {
  return [
    {
      address: 'mock_orca_sol_usdt',
      tokenA: 'So11111111111111111111111111111111111111112',
      tokenB: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      tokenASymbol: 'SOL',
      tokenBSymbol: 'USDT',
      liquidity: 9800000,
      volume24h: 3200000,
      fees24h: 9600,
      apy: 15.3,
      dex: 'Orca',
      timestamp: Date.now(),
    },
    {
      address: 'mock_orca_msol_sol',
      tokenA: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      tokenB: 'So11111111111111111111111111111111111111112',
      tokenASymbol: 'mSOL',
      tokenBSymbol: 'SOL',
      liquidity: 6500000,
      volume24h: 1800000,
      fees24h: 5400,
      apy: 21.2,
      dex: 'Orca',
      timestamp: Date.now(),
    },
  ];
}

/**
 * Aggregates data from multiple DEXs
 */
export async function aggregateDEXData(tokenMints?: string[]): Promise<DEXAggregatedData> {
  const defaultTokens = [
    'So11111111111111111111111111111111111111112', // SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // RAY
  ];

  const mints = tokenMints || defaultTokens;

  try {
    // Fetch data in parallel
    const [prices, raydiumPools, orcaPools] = await Promise.allSettled([
      getJupiterPrices(mints),
      getRaydiumPools(),
      getOrcaPools(),
    ]);

    const allPrices = prices.status === 'fulfilled' ? prices.value : [];
    const allPools = [
      ...(raydiumPools.status === 'fulfilled' ? raydiumPools.value : []),
      ...(orcaPools.status === 'fulfilled' ? orcaPools.value : []),
    ];

    const totalLiquidity = allPools.reduce((sum, pool) => sum + pool.liquidity, 0);
    const totalVolume24h = allPools.reduce((sum, pool) => sum + pool.volume24h, 0);

    return {
      prices: allPrices,
      pools: allPools,
      totalLiquidity,
      totalVolume24h,
    };
  } catch (error) {
    console.error('Error aggregating DEX data:', error);
    return {
      prices: [],
      pools: [],
      totalLiquidity: 0,
      totalVolume24h: 0,
    };
  }
}

/**
 * Monitors real-time account changes for liquidity pools
 */
export async function monitorLiquidityPools(
  poolAddresses: string[],
  callback: (poolAddress: string, data: any) => void
): Promise<void> {
  try {
    const connection = await getConnection();
    
    for (const poolAddress of poolAddresses) {
      try {
        const pubkey = new PublicKey(poolAddress);
        
        // Subscribe to account changes
        connection.onAccountChange(pubkey, (accountInfo, context) => {
          callback(poolAddress, {
            accountInfo,
            context,
            timestamp: Date.now(),
          });
        });
      } catch (error) {
        console.error(`Error monitoring pool ${poolAddress}:`, error);
      }
    }
  } catch (error) {
    console.error('Error setting up pool monitoring:', error);
  }
}

/**
 * Detects basic arbitrage opportunities between DEXs
 */
export interface ArbitrageOpportunity {
  tokenMint: string;
  tokenSymbol: string;
  buyDEX: string;
  sellDEX: string;
  buyPrice: number;
  sellPrice: number;
  priceDifference: number;
  profitPercentage: number;
  timestamp: number;
}

export function detectArbitrageOpportunities(prices: TokenPrice[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const pricesByToken = new Map<string, TokenPrice[]>();
  
  // Group prices by token
  for (const price of prices) {
    if (!pricesByToken.has(price.mint)) {
      pricesByToken.set(price.mint, []);
    }
    pricesByToken.get(price.mint)!.push(price);
  }
  
  // Find arbitrage opportunities
  for (const [tokenMint, tokenPrices] of pricesByToken) {
    if (tokenPrices.length < 2) continue;
    
    // Sort by price
    tokenPrices.sort((a, b) => a.price - b.price);
    
    const lowestPrice = tokenPrices[0];
    const highestPrice = tokenPrices[tokenPrices.length - 1];
    
    const priceDifference = highestPrice.price - lowestPrice.price;
    const profitPercentage = (priceDifference / lowestPrice.price) * 100;
    
    // Only consider opportunities with >0.5% profit potential
    if (profitPercentage > 0.5) {
      opportunities.push({
        tokenMint,
        tokenSymbol: lowestPrice.symbol,
        buyDEX: lowestPrice.source,
        sellDEX: highestPrice.source,
        buyPrice: lowestPrice.price,
        sellPrice: highestPrice.price,
        priceDifference,
        profitPercentage,
        timestamp: Date.now(),
      });
    }
  }
  
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}