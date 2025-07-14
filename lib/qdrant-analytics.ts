/**
 * Enhanced Qdrant Vector Collections for Network Statistics & Token Analytics
 * 
 * Extends the existing Qdrant setup to support advanced semantic search
 * and vector indexing for analytics data and network statistics.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { qdrantClient } from '@/lib/qdrant';

/**
 * Generate a simple embedding for text content
 * Uses a hash-based approach for demonstration - in production, use proper embedding models
 */
function generateSimpleEmbedding(text: string): number[] {
  // Simple hash-based embedding for demonstration
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Generate 384-dimensional vector
  const vector = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.sin(hash + i) * 0.1;
  }
  
  return vector;
}
export const ANALYTICS_COLLECTIONS = {
  NETWORK_STATS: 'network_statistics',
  TOKEN_ANALYTICS: 'token_analytics', 
  DEX_ANALYTICS: 'dex_analytics',
  VALIDATOR_ANALYTICS: 'validator_analytics',
  PROGRAM_ANALYTICS: 'program_analytics',
  CROSS_CHAIN_ANALYTICS: 'cross_chain_analytics'
} as const;

// Type definitions for analytics data
export interface NetworkStatsEntry {
  id: string;
  timestamp: number;
  slot: number;
  tps: number;
  averageSlotTime: number;
  totalTransactions: number;
  totalAccounts: number;
  totalValidators: number;
  stakingRatio: number;
  inflation: number;
  epochInfo: {
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    absoluteSlot: number;
  };
  clusterInfo: {
    version: string;
    feature_set: string;
  };
  performance: {
    blockhash: string;
    lamportsPerSignature: number;
    lastValidBlockHeight: number;
  };
  metadata?: Record<string, any>;
}

export interface TokenAnalyticsEntry {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  timestamp: number;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  totalSupply: number;
  circulatingSupply?: number;
  holders: number;
  transfers24h: number;
  uniqueWallets24h: number;
  liquidityPools: Array<{
    dex: string;
    poolAddress: string;
    tvl: number;
    volume24h: number;
  }>;
  socialMetrics?: {
    twitterFollowers?: number;
    discordMembers?: number;
    telegramMembers?: number;
    sentiment?: number;
  };
  technicalAnalysis?: {
    rsi: number;
    macd: number;
    support: number;
    resistance: number;
  };
  metadata?: Record<string, any>;
}

export interface DEXAnalyticsEntry {
  id: string;
  dexName: string;
  timestamp: number;
  totalVolumeUSD: number;
  volume24hUSD: number;
  totalTrades: number;
  trades24h: number;
  uniqueTraders24h: number;
  totalLiquidity: number;
  activePairs: number;
  topPairs: Array<{
    pairAddress: string;
    tokenA: string;
    tokenB: string;
    volume24h: number;
    liquidity: number;
    priceChange24h: number;
  }>;
  feeMetrics: {
    totalFeesCollected: number;
    fees24h: number;
    averageFeePerTrade: number;
  };
  metadata?: Record<string, any>;
}

export interface ValidatorAnalyticsEntry {
  id: string;
  validatorAddress: string;
  name?: string;
  timestamp: number;
  stakeAmount: number;
  commission: number;
  apy: number;
  uptime: number;
  voteCredits: number;
  skipRate: number;
  dataCenter?: string;
  version?: string;
  delegators: number;
  epochPerformance: {
    slotsLeader: number;
    slotsSkipped: number;
    votingHistory: number[];
  };
  metadata?: Record<string, any>;
}

/**
 * Initialize enhanced analytics collections
 */
export async function initializeAnalyticsCollections(): Promise<void> {
  try {
    // Helper function to create collection with error handling
    const createCollection = async (name: string, description: string) => {
      try {
        const exists = await qdrantClient.getCollection(name).catch(() => null);
        
        if (!exists) {
          await qdrantClient.createCollection(name, {
            vectors: {
              size: 384, // Standard embedding dimension
              distance: 'Cosine'
            },
            optimizers_config: {
              default_segment_number: 2,
              max_segment_size: 100000,
              memmap_threshold: 50000,
              indexing_threshold: 10000
            }
          });
          console.log(`Created ${name} collection for ${description}`);
        } else {
          console.log(`Collection ${name} already exists`);
        }
      } catch (error: any) {
        console.warn(`Failed to create collection ${name}:`, error?.message);
      }
    };

    // Create analytics collections
    await createCollection(ANALYTICS_COLLECTIONS.NETWORK_STATS, 'network statistics');
    await createCollection(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, 'token analytics');
    await createCollection(ANALYTICS_COLLECTIONS.DEX_ANALYTICS, 'DEX analytics');
    await createCollection(ANALYTICS_COLLECTIONS.VALIDATOR_ANALYTICS, 'validator analytics');
    await createCollection(ANALYTICS_COLLECTIONS.PROGRAM_ANALYTICS, 'program analytics');
    await createCollection(ANALYTICS_COLLECTIONS.CROSS_CHAIN_ANALYTICS, 'cross-chain analytics');

    // Create indexes for analytics collections
    await createAnalyticsIndexes();

    console.log('Analytics collections initialized successfully');
  } catch (error) {
    console.error('Error initializing analytics collections:', error);
    throw error;
  }
}

/**
 * Create indexes for efficient querying
 */
async function createAnalyticsIndexes(): Promise<void> {
  const createIndex = async (collection: string, field: string) => {
    try {
      await qdrantClient.createPayloadIndex(collection, {
        field_name: field,
        field_schema: 'keyword'
      });
      console.log(`Created index for ${field} in ${collection}`);
    } catch (error: any) {
      if (error?.data?.status?.error?.includes('already exists') ||
          error?.message?.includes('already exists')) {
        console.log(`Index for ${field} in ${collection} already exists`);
      } else {
        console.warn(`Failed to create index for ${field} in ${collection}:`, error?.message);
      }
    }
  };

  // Network stats indexes
  await createIndex(ANALYTICS_COLLECTIONS.NETWORK_STATS, 'timestamp');
  await createIndex(ANALYTICS_COLLECTIONS.NETWORK_STATS, 'slot');

  // Token analytics indexes  
  await createIndex(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, 'mint');
  await createIndex(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, 'symbol');
  await createIndex(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, 'timestamp');

  // DEX analytics indexes
  await createIndex(ANALYTICS_COLLECTIONS.DEX_ANALYTICS, 'dexName');
  await createIndex(ANALYTICS_COLLECTIONS.DEX_ANALYTICS, 'timestamp');

  // Validator analytics indexes
  await createIndex(ANALYTICS_COLLECTIONS.VALIDATOR_ANALYTICS, 'validatorAddress');
  await createIndex(ANALYTICS_COLLECTIONS.VALIDATOR_ANALYTICS, 'timestamp');
}

/**
 * Store network statistics entry
 */
export async function storeNetworkStats(stats: NetworkStatsEntry): Promise<void> {
  try {
    // Generate embedding from network stats content
    const textContent = `network stats tps ${stats.tps} slot ${stats.slot} validators ${stats.totalValidators} accounts ${stats.totalAccounts} staking ${stats.stakingRatio} epoch ${stats.epochInfo.epoch}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(ANALYTICS_COLLECTIONS.NETWORK_STATS, {
      wait: true,
      points: [{
        id: stats.id,
        vector,
        payload: stats as any
      }]
    });
  } catch (error) {
    console.error('Error storing network stats:', error);
    throw error;
  }
}

/**
 * Store token analytics entry
 */
export async function storeTokenAnalytics(analytics: TokenAnalyticsEntry): Promise<void> {
  try {
    // Generate rich embedding from token data
    const textContent = `token ${analytics.symbol} ${analytics.name} mint ${analytics.mint} price ${analytics.price || 0} volume ${analytics.volume24h || 0} market cap ${analytics.marketCap || 0} holders ${analytics.holders} transfers ${analytics.transfers24h} liquidity pools ${analytics.liquidityPools.map(p => p.dex).join(' ')}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, {
      wait: true,
      points: [{
        id: analytics.id,
        vector,
        payload: analytics as any
      }]
    });
  } catch (error) {
    console.error('Error storing token analytics:', error);
    throw error;
  }
}

/**
 * Store DEX analytics entry
 */
export async function storeDEXAnalytics(analytics: DEXAnalyticsEntry): Promise<void> {
  try {
    const textContent = `dex ${analytics.dexName} volume ${analytics.volume24hUSD} trades ${analytics.trades24h} liquidity ${analytics.totalLiquidity} pairs ${analytics.activePairs} fees ${analytics.feeMetrics.fees24h}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(ANALYTICS_COLLECTIONS.DEX_ANALYTICS, {
      wait: true,
      points: [{
        id: analytics.id,
        vector,
        payload: analytics as any
      }]
    });
  } catch (error) {
    console.error('Error storing DEX analytics:', error);
    throw error;
  }
}

/**
 * Store validator analytics entry
 */
export async function storeValidatorAnalytics(analytics: ValidatorAnalyticsEntry): Promise<void> {
  try {
    const textContent = `validator ${analytics.validatorAddress} ${analytics.name || ''} stake ${analytics.stakeAmount} commission ${analytics.commission} apy ${analytics.apy} uptime ${analytics.uptime} delegators ${analytics.delegators}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(ANALYTICS_COLLECTIONS.VALIDATOR_ANALYTICS, {
      wait: true,
      points: [{
        id: analytics.id,
        vector,
        payload: analytics as any
      }]
    });
  } catch (error) {
    console.error('Error storing validator analytics:', error);
    throw error;
  }
}

/**
 * Semantic search for network statistics
 */
export async function searchNetworkStats(
  query: string,
  options: {
    limit?: number;
    timeRange?: { start: number; end: number };
    minTPS?: number;
    maxTPS?: number;
  } = {}
): Promise<NetworkStatsEntry[]> {
  try {
    const { limit = 50, timeRange, minTPS, maxTPS } = options;
    
    // Generate query embedding
    const queryVector = generateSimpleEmbedding(query);
    
    // Build filter
    const filter: any = { must: [] };
    
    if (timeRange) {
      filter.must.push({
        key: 'timestamp',
        range: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      });
    }
    
    if (minTPS !== undefined) {
      filter.must.push({
        key: 'tps',
        range: { gte: minTPS }
      });
    }
    
    if (maxTPS !== undefined) {
      filter.must.push({
        key: 'tps',
        range: { lte: maxTPS }
      });
    }

    const result = await qdrantClient.search(ANALYTICS_COLLECTIONS.NETWORK_STATS, {
      vector: queryVector,
      filter: filter.must.length > 0 ? filter : undefined,
      limit,
      with_payload: true
    });

    return result.map(point => point.payload as unknown as NetworkStatsEntry);
  } catch (error) {
    console.error('Error searching network stats:', error);
    return [];
  }
}

/**
 * Semantic search for token analytics
 */
export async function searchTokenAnalytics(
  query: string,
  options: {
    limit?: number;
    timeRange?: { start: number; end: number };
    minMarketCap?: number;
    minVolume?: number;
    dexFilter?: string[];
  } = {}
): Promise<TokenAnalyticsEntry[]> {
  try {
    const { limit = 50, timeRange, minMarketCap, minVolume, dexFilter } = options;
    
    const queryVector = generateSimpleEmbedding(query);
    
    const filter: any = { must: [] };
    
    if (timeRange) {
      filter.must.push({
        key: 'timestamp',
        range: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      });
    }
    
    if (minMarketCap !== undefined) {
      filter.must.push({
        key: 'marketCap',
        range: { gte: minMarketCap }
      });
    }
    
    if (minVolume !== undefined) {
      filter.must.push({
        key: 'volume24h',
        range: { gte: minVolume }
      });
    }

    const result = await qdrantClient.search(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, {
      vector: queryVector,
      filter: filter.must.length > 0 ? filter : undefined,
      limit,
      with_payload: true
    });

    let tokens = result.map(point => point.payload as unknown as TokenAnalyticsEntry);
    
    // Apply DEX filter post-search if needed
    if (dexFilter && dexFilter.length > 0) {
      tokens = tokens.filter(token => 
        token.liquidityPools.some(pool => dexFilter.includes(pool.dex))
      );
    }

    return tokens;
  } catch (error) {
    console.error('Error searching token analytics:', error);
    return [];
  }
}

/**
 * Get latest network statistics
 */
export async function getLatestNetworkStats(limit = 10): Promise<NetworkStatsEntry[]> {
  try {
    const result = await qdrantClient.search(ANALYTICS_COLLECTIONS.NETWORK_STATS, {
      vector: new Array(384).fill(0), // Dummy vector for filtered search
      filter: {
        must: [{
          key: 'timestamp',
          range: { 
            gte: Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
          }
        }]
      },
      limit,
      with_payload: true
    });

    const stats = result.map(point => point.payload as unknown as NetworkStatsEntry);
    return stats.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error getting latest network stats:', error);
    return [];
  }
}

/**
 * Get token analytics by mint
 */
export async function getTokenAnalyticsByMint(mint: string): Promise<TokenAnalyticsEntry | null> {
  try {
    const result = await qdrantClient.search(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{
          key: 'mint',
          match: { value: mint }
        }]
      },
      limit: 1,
      with_payload: true
    });

    if (result.length === 0) return null;
    
    return result[0].payload as unknown as TokenAnalyticsEntry;
  } catch (error) {
    console.error('Error getting token analytics by mint:', error);
    return null;
  }
}

/**
 * Batch ingestion for network statistics
 */
export async function batchIngestNetworkStats(statsArray: NetworkStatsEntry[]): Promise<void> {
  try {
    const points = statsArray.map(stats => {
      const textContent = `network stats tps ${stats.tps} slot ${stats.slot} validators ${stats.totalValidators} accounts ${stats.totalAccounts}`;
      const vector = generateSimpleEmbedding(textContent);
      
      return {
        id: stats.id,
        vector,
        payload: stats as any
      };
    });

    await qdrantClient.upsert(ANALYTICS_COLLECTIONS.NETWORK_STATS, {
      wait: true,
      points
    });

    console.log(`Batch ingested ${statsArray.length} network stats entries`);
  } catch (error) {
    console.error('Error batch ingesting network stats:', error);
    throw error;
  }
}

/**
 * Batch ingestion for token analytics
 */
export async function batchIngestTokenAnalytics(analyticsArray: TokenAnalyticsEntry[]): Promise<void> {
  try {
    const points = analyticsArray.map(analytics => {
      const textContent = `token ${analytics.symbol} ${analytics.name} mint ${analytics.mint} price ${analytics.price || 0}`;
      const vector = generateSimpleEmbedding(textContent);
      
      return {
        id: analytics.id,
        vector,
        payload: analytics as any
      };
    });

    await qdrantClient.upsert(ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS, {
      wait: true,
      points
    });

    console.log(`Batch ingested ${analyticsArray.length} token analytics entries`);
  } catch (error) {
    console.error('Error batch ingesting token analytics:', error);
    throw error;
  }
}

/**
 * Cleanup old analytics data
 */
export async function cleanupOldAnalyticsData(retentionDays = 30): Promise<void> {
  try {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    const collections = [
      ANALYTICS_COLLECTIONS.NETWORK_STATS,
      ANALYTICS_COLLECTIONS.TOKEN_ANALYTICS,
      ANALYTICS_COLLECTIONS.DEX_ANALYTICS,
      ANALYTICS_COLLECTIONS.VALIDATOR_ANALYTICS
    ];

    for (const collection of collections) {
      await qdrantClient.delete(collection, {
        wait: true,
        filter: {
          must: [{
            key: 'timestamp',
            range: { lt: cutoffTime }
          }]
        }
      });
    }

    console.log(`Cleaned up analytics data older than ${retentionDays} days`);
  } catch (error) {
    console.error('Error cleaning up old analytics data:', error);
  }
}