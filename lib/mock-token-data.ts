/**
 * Mock token market data service
 * This simulates real-time token data for the token pages
 * In production, this would be replaced with actual Moralis API calls
 */

import type { TokenMarketData, TokenGainerData, NewTokenData, TokenListResponse } from '@/types/token-market';

// Sample token data that simulates real Solana tokens
const sampleTokens: TokenMarketData[] = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    price: 98.45,
    priceChange24h: 5.23,
    priceChangePercentage24h: 5.6,
    marketCap: 45678900000,
    volume24h: 1234567890,
    decimals: 9,
    supply: 463917394,
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    price: 1.00,
    priceChange24h: 0.001,
    priceChangePercentage24h: 0.1,
    marketCap: 28543210000,
    volume24h: 987654321,
    decimals: 6,
    supply: 28543210000,
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    price: 1.00,
    priceChange24h: -0.002,
    priceChangePercentage24h: -0.2,
    marketCap: 1876543210,
    volume24h: 456789123,
    decimals: 6,
    supply: 1876543210,
  },
  {
    address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    symbol: 'MSOL',
    name: 'Marinade Staked SOL',
    price: 108.32,
    priceChange24h: 6.78,
    priceChangePercentage24h: 6.7,
    marketCap: 1234567890,
    volume24h: 45678901,
    decimals: 9,
    supply: 11398423,
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    price: 0.000045,
    priceChange24h: 0.000012,
    priceChangePercentage24h: 36.4,
    marketCap: 2876543210,
    volume24h: 234567890,
    decimals: 5,
    supply: 93014061311064,
  },
  {
    address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    symbol: 'JITO',
    name: 'Jito',
    price: 3.45,
    priceChange24h: -0.23,
    priceChangePercentage24h: -6.3,
    marketCap: 456789123,
    volume24h: 12345678,
    decimals: 9,
    supply: 132411923,
  },
  {
    address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    symbol: 'POPCAT',
    name: 'POPCAT',
    price: 1.23,
    priceChange24h: 0.45,
    priceChangePercentage24h: 57.8,
    marketCap: 1234567890,
    volume24h: 567890123,
    decimals: 9,
    supply: 979988213,
    isNew: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  },
  {
    address: 'DJnPTQZAWCAhvM5rp4R7FEzGrHhDGgNSB9BYKcvb6EGz',
    symbol: 'PEPE',
    name: 'PEPE',
    price: 0.0000234,
    priceChange24h: 0.0000089,
    priceChangePercentage24h: 61.3,
    marketCap: 987654321,
    volume24h: 345678901,
    decimals: 8,
    supply: 42069000000000,
    isNew: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  }
];

/**
 * Simulate real-time price updates
 */
function addRandomVariation(baseValue: number, variationPercent: number = 5): number {
  const variation = (Math.random() - 0.5) * 2 * (variationPercent / 100);
  return baseValue * (1 + variation);
}

/**
 * Get simulated token market data with real-time updates
 */
function getUpdatedTokenData(tokens: TokenMarketData[]): TokenMarketData[] {
  return tokens.map(token => ({
    ...token,
    price: token.price ? addRandomVariation(token.price, 2) : undefined,
    priceChange24h: token.priceChange24h ? addRandomVariation(token.priceChange24h, 10) : undefined,
    priceChangePercentage24h: token.priceChangePercentage24h ? addRandomVariation(token.priceChangePercentage24h, 10) : undefined,
    volume24h: token.volume24h ? addRandomVariation(token.volume24h, 15) : undefined,
  }));
}

/**
 * Get all tokens with pagination
 */
export async function getAllTokens(
  limit: number = 50,
  cursor?: string
): Promise<TokenListResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const updatedTokens = getUpdatedTokenData(sampleTokens);
  const sortedTokens = updatedTokens.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  
  const startIndex = cursor ? parseInt(cursor) : 0;
  const endIndex = Math.min(startIndex + limit, sortedTokens.length);
  const tokens = sortedTokens.slice(startIndex, endIndex);
  
  return {
    tokens,
    hasMore: endIndex < sortedTokens.length,
    cursor: endIndex < sortedTokens.length ? endIndex.toString() : undefined,
    total: sortedTokens.length
  };
}

/**
 * Get top gaining tokens
 */
export async function getTopGainers(limit: number = 50): Promise<TokenGainerData[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const updatedTokens = getUpdatedTokenData(sampleTokens);
  const gainers = updatedTokens
    .filter(token => (token.priceChangePercentage24h || 0) > 0)
    .sort((a, b) => (b.priceChangePercentage24h || 0) - (a.priceChangePercentage24h || 0))
    .slice(0, limit) as TokenGainerData[];
  
  return gainers;
}

/**
 * Get new token listings
 */
export async function getNewListings(limit: number = 50, daysBack: number = 7): Promise<NewTokenData[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 700));
  
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const updatedTokens = getUpdatedTokenData(sampleTokens);
  
  const newTokens = updatedTokens
    .filter(token => token.isNew && token.createdAt && new Date(token.createdAt) > cutoffDate)
    .map(token => {
      const daysOld = Math.floor((Date.now() - new Date(token.createdAt!).getTime()) / (24 * 60 * 60 * 1000));
      return {
        ...token,
        daysOld,
        isNew: true as const,
        createdAt: token.createdAt!
      } as NewTokenData;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  
  return newTokens;
}

/**
 * Get trending tokens (for future use)
 */
export async function getTrendingTokens(limit: number = 50): Promise<TokenMarketData[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const updatedTokens = getUpdatedTokenData(sampleTokens);
  const trending = updatedTokens
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, limit);
  
  return trending;
}