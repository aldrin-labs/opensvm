/**
 * Transaction Analysis Cache Service
 * 
 * This service provides comprehensive caching for transaction analysis data using Qdrant including:
 * - Parsed instructions and account changes
 * - AI explanations and analysis results
 * - Related transaction discovery results
 * - Program registry and instruction definitions
 */

import { qdrantClient } from './qdrant';
// Disable Qdrant cache if server URL not set
const DISABLE_QDRANT_CACHE = !process.env.QDRANT_SERVER;
// Qdrant cache calls should only run on the server side
import type { TransactionExplanation } from './ai-transaction-analyzer';
import type { AccountChangesAnalysis } from './account-changes-analyzer';
import type { ParsedInstructionInfo } from './instruction-parser-service';
import type { RelatedTransactionResult } from './related-transaction-finder';
import { memoryCache } from './cache';

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
  PARSED_INSTRUCTIONS: 60 * 60 * 24 * 1000, // 24 hours - instructions don't change
  ACCOUNT_CHANGES: 60 * 60 * 24 * 1000, // 24 hours - account changes don't change
  AI_EXPLANATIONS: 60 * 60 * 12 * 1000, // 12 hours - reduce API costs
  RELATED_TRANSACTIONS: 60 * 60 * 2 * 1000, // 2 hours - may find new related transactions
  PROGRAM_REGISTRY: 60 * 60 * 24 * 7 * 1000, // 1 week - program definitions are stable
  TRANSACTION_METRICS: 60 * 60 * 24 * 1000, // 24 hours - metrics don't change
  DEFI_ANALYSIS: 60 * 60 * 6 * 1000, // 6 hours - DeFi data may update
} as const;

// Qdrant collection names for caching
const CACHE_COLLECTIONS = {
  TRANSACTION_ANALYSIS: 'transaction_analysis_cache',
} as const;

// Cache entry types
const CACHE_TYPES = {
  PARSED_INSTRUCTIONS: 'parsed_instructions',
  ACCOUNT_CHANGES: 'account_changes',
  AI_EXPLANATION: 'ai_explanation',
  RELATED_TRANSACTIONS: 'related_transactions',
  PROGRAM_INFO: 'program_info',
  INSTRUCTION_DEFINITION: 'instruction_definition',
  TRANSACTION_METRICS: 'transaction_metrics',
  DEFI_ANALYSIS: 'defi_analysis',
} as const;

// Interfaces for cached data
export interface CachedParsedInstructions {
  signature: string;
  instructions: ParsedInstructionInfo[];
  timestamp: number;
  version: string; // For cache invalidation when parsing logic changes
}

export interface CachedAccountChanges {
  signature: string;
  analysis: AccountChangesAnalysis;
  timestamp: number;
  version: string;
}

export interface CachedAIExplanation {
  signature: string;
  explanation: TransactionExplanation;
  timestamp: number;
  analysisOptions?: {
    detailLevel?: 'basic' | 'detailed' | 'technical';
    focusAreas?: string[];
  };
}

export interface CachedRelatedTransactions {
  signature: string;
  result: RelatedTransactionResult;
  timestamp: number;
  queryHash: string; // Hash of query parameters for cache key uniqueness
}

export interface CachedTransactionMetrics {
  signature: string;
  metrics: any; // Transaction metrics data
  timestamp: number;
}

export interface CachedDeFiAnalysis {
  signature: string;
  analysis: any; // DeFi analysis data
  timestamp: number;
}

// Cache statistics interface
export interface CacheStatistics {
  totalEntries: number;
  entriesByType: Record<string, number>;
  memoryUsage: number; // Estimated in bytes
  hitRate: number; // Cache hit rate percentage
  oldestEntry: number; // Timestamp of oldest entry
  newestEntry: number; // Timestamp of newest entry
}

class TransactionAnalysisCache {
  private hitCount = 0;
  private missCount = 0;
  private readonly currentVersion = '1.0.0'; // Increment when cache structure changes

  /**
   * Initialize the cache collection in Qdrant
   */
  private async ensureCacheCollection(): Promise<void> {
    // Skip if Qdrant not configured or in browser
    if (DISABLE_QDRANT_CACHE || typeof window !== 'undefined') return;
    try {
      const exists = await qdrantClient.getCollection(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS).catch(() => null);
      
      if (!exists) {
        await qdrantClient.createCollection(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
          vectors: {
            size: 384, // Dimension for embeddings
            distance: 'Cosine'
          }
        });
        console.log('Created transaction analysis cache collection');
      }

      // Ensure indexes exist with appropriate schema types
      const indexFields = ['cacheType', 'signature', 'programId', 'discriminator', 'expiresAt'];
      for (const field of indexFields) {
        // Use 'float' for numeric fields, otherwise 'keyword'
        const fieldSchema: 'keyword' | 'float' = field === 'expiresAt' ? 'float' : 'keyword';
        try {
          await qdrantClient.createPayloadIndex(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
            field_name: field,
            field_schema: fieldSchema
          });
        } catch (error: any) {
          // Ignore if index already exists
          if (!error?.message?.includes('already exists')) {
            console.warn(`Failed to create index for ${field}:`, error?.message);
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring cache collection:', error);
    }
  }

  /**
   * Generate a valid point ID for Qdrant (must be UUID or unsigned integer)
   */
  private generatePointId(content: string): string {
    // Create a hash of the content and convert to a UUID-like format
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert hash to a positive number and format as UUID
    const positiveHash = Math.abs(hash);
    const hashStr = positiveHash.toString(16).padStart(8, '0');
    
    // Generate additional components to create a full UUID
    const part1 = hashStr.slice(0, 8);
    const part2 = (Math.abs(hash * 2) % 0xFFFF).toString(16).padStart(4, '0');
    const part3 = (Math.abs(hash * 3) % 0xFFFF).toString(16).padStart(4, '0');
    const part4 = (Math.abs(hash * 5) % 0xFFFF).toString(16).padStart(4, '0');
    const part5 = (Math.abs(hash * 7) % 0xFFFFFFFFFF).toString(16).padStart(12, '0');
    
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }

  /**
   * Generate a simple embedding for cache content
   */
  private generateCacheEmbedding(content: string): number[] {
    const hash = content.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const vector = new Array(384).fill(0);
    for (let i = 0; i < 384; i++) {
      vector[i] = Math.sin(hash + i) * 0.1;
    }
    
    return vector;
  }

  /**
   * Cache parsed instructions for a transaction
   */
  async cacheParsedInstructions(
    signature: string,
    instructions: ParsedInstructionInfo[]
  ): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const cachedData: CachedParsedInstructions = {
        signature,
        instructions,
        timestamp: Date.now(),
        version: this.currentVersion
      };

      const content = `${signature} parsed_instructions ${JSON.stringify(instructions)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.PARSED_INSTRUCTIONS;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.PARSED_INSTRUCTIONS}_${signature}`),
          vector,
          payload: {
            ...cachedData,
            cacheType: CACHE_TYPES.PARSED_INSTRUCTIONS,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching parsed instructions:', error);
    }
  }

  /**
   * Get cached parsed instructions for a transaction
   */
  async getCachedParsedInstructions(signature: string): Promise<ParsedInstructionInfo[] | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.PARSED_INSTRUCTIONS } },
            { key: 'signature', match: { value: signature } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as unknown as CachedParsedInstructions;
        if (this.isValidVersion(cached.version)) {
          this.hitCount++;
          return cached.instructions;
        }
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached parsed instructions:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache account changes analysis for a transaction
   */
  async cacheAccountChanges(
    signature: string,
    analysis: AccountChangesAnalysis
  ): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const cachedData: CachedAccountChanges = {
        signature,
        analysis,
        timestamp: Date.now(),
        version: this.currentVersion
      };

      const content = `${signature} account_changes ${JSON.stringify(analysis)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.ACCOUNT_CHANGES;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.ACCOUNT_CHANGES}_${signature}`),
          vector,
          payload: {
            ...cachedData,
            cacheType: CACHE_TYPES.ACCOUNT_CHANGES,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching account changes:', error);
    }
  }

  /**
   * Get cached account changes analysis for a transaction
   */
  async getCachedAccountChanges(signature: string): Promise<AccountChangesAnalysis | null> {
    // Skip cache lookup in browser or if Qdrant not configured
    if (DISABLE_QDRANT_CACHE || typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.ACCOUNT_CHANGES } },
            { key: 'signature', match: { value: signature } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as unknown as CachedAccountChanges;
        if (this.isValidVersion(cached.version)) {
          this.hitCount++;
          return cached.analysis;
        }
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached account changes:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache AI explanation for a transaction
   */
  async cacheAIExplanation(
    signature: string,
    explanation: TransactionExplanation,
    analysisOptions?: {
      detailLevel?: 'basic' | 'detailed' | 'technical';
      focusAreas?: string[];
    }
  ): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const optionsHash = this.hashQueryOptions(analysisOptions);
      const cachedData: CachedAIExplanation = {
        signature,
        explanation,
        timestamp: Date.now(),
        analysisOptions
      };

      const content = `${signature} ai_explanation ${optionsHash} ${JSON.stringify(explanation)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.AI_EXPLANATIONS;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.AI_EXPLANATION}_${signature}_${optionsHash}`),
          vector,
          payload: {
            ...cachedData,
            cacheType: CACHE_TYPES.AI_EXPLANATION,
            optionsHash,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching AI explanation:', error);
    }
  }

  /**
   * Get cached AI explanation for a transaction
   */
  async getCachedAIExplanation(
    signature: string,
    analysisOptions?: {
      detailLevel?: 'basic' | 'detailed' | 'technical';
      focusAreas?: string[];
    }
  ): Promise<TransactionExplanation | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const optionsHash = this.hashQueryOptions(analysisOptions);
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.AI_EXPLANATION } },
            { key: 'signature', match: { value: signature } },
            { key: 'optionsHash', match: { value: optionsHash } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as unknown as CachedAIExplanation;
        this.hitCount++;
        return cached.explanation;
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached AI explanation:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache related transactions result
   */
  async cacheRelatedTransactions(
    signature: string,
    result: RelatedTransactionResult,
    queryOptions?: any
  ): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const queryHash = this.hashQueryOptions(queryOptions);
      const cachedData: CachedRelatedTransactions = {
        signature,
        result,
        timestamp: Date.now(),
        queryHash
      };

      const content = `${signature} related_transactions ${queryHash} ${JSON.stringify(result)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.RELATED_TRANSACTIONS;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.RELATED_TRANSACTIONS}_${signature}_${queryHash}`),
          vector,
          payload: {
            ...cachedData,
            cacheType: CACHE_TYPES.RELATED_TRANSACTIONS,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching related transactions:', error);
    }
  }

  /**
   * Get cached related transactions result
   */
  async getCachedRelatedTransactions(
    signature: string,
    queryOptions?: any
  ): Promise<RelatedTransactionResult | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const queryHash = this.hashQueryOptions(queryOptions);
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.RELATED_TRANSACTIONS } },
            { key: 'signature', match: { value: signature } },
            { key: 'queryHash', match: { value: queryHash } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as unknown as CachedRelatedTransactions;
        this.hitCount++;
        return cached.result;
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached related transactions:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache program information
   */
  async cacheProgramInfo(programId: string, programInfo: any): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const content = `${programId} program_info ${JSON.stringify(programInfo)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.PROGRAM_REGISTRY;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.PROGRAM_INFO}_${programId}`),
          vector,
          payload: {
            programId,
            programInfo,
            timestamp: Date.now(),
            cacheType: CACHE_TYPES.PROGRAM_INFO,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching program info:', error);
    }
  }

  /**
   * Get cached program information
   */
  async getCachedProgramInfo(programId: string): Promise<any | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.PROGRAM_INFO } },
            { key: 'programId', match: { value: programId } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as any;
        this.hitCount++;
        return cached.programInfo;
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached program info:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache instruction definition
   */
  async cacheInstructionDefinition(
    programId: string,
    discriminator: string,
    definition: any
  ): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const content = `${programId} ${discriminator} instruction_definition ${JSON.stringify(definition)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.PROGRAM_REGISTRY;
      const pointId = this.generatePointId(`${CACHE_TYPES.INSTRUCTION_DEFINITION}_${programId}_${discriminator}`);

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: pointId,
          vector,
          payload: {
            programId,
            discriminator,
            definition,
            timestamp: Date.now(),
            cacheType: CACHE_TYPES.INSTRUCTION_DEFINITION,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching instruction definition:', error);
      console.error('Full error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        data: (error as any)?.data,
        headers: (error as any)?.headers
      });
    }
  }

  /**
   * Get cached instruction definition
   */
  async getCachedInstructionDefinition(
    programId: string,
    discriminator: string
  ): Promise<any | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.INSTRUCTION_DEFINITION } },
            { key: 'programId', match: { value: programId } },
            { key: 'discriminator', match: { value: discriminator } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as any;
        this.hitCount++;
        return cached.definition;
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached instruction definition:', error);
      console.error('Full error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        data: (error as any)?.data,
        headers: (error as any)?.headers
      });
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache transaction metrics
   */
  async cacheTransactionMetrics(signature: string, metrics: any): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const cachedData: CachedTransactionMetrics = {
        signature,
        metrics,
        timestamp: Date.now()
      };

      const content = `${signature} transaction_metrics ${JSON.stringify(metrics)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.TRANSACTION_METRICS;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.TRANSACTION_METRICS}_${signature}`),
          vector,
          payload: {
            ...cachedData,
            cacheType: CACHE_TYPES.TRANSACTION_METRICS,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching transaction metrics:', error);
    }
  }

  /**
   * Get cached transaction metrics
   */
  async getCachedTransactionMetrics(signature: string): Promise<any | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.TRANSACTION_METRICS } },
            { key: 'signature', match: { value: signature } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as unknown as CachedTransactionMetrics;
        this.hitCount++;
        return cached.metrics;
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached transaction metrics:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache DeFi analysis
   */
  async cacheDeFiAnalysis(signature: string, analysis: any): Promise<void> {
    // Skip caching in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      const cachedData: CachedDeFiAnalysis = {
        signature,
        analysis,
        timestamp: Date.now()
      };

      const content = `${signature} defi_analysis ${JSON.stringify(analysis)}`;
      const vector = this.generateCacheEmbedding(content);
      const expiresAt = Date.now() + CACHE_TTL.DEFI_ANALYSIS;

      await qdrantClient.upsert(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        points: [{
          id: this.generatePointId(`${CACHE_TYPES.DEFI_ANALYSIS}_${signature}`),
          vector,
          payload: {
            ...cachedData,
            cacheType: CACHE_TYPES.DEFI_ANALYSIS,
            expiresAt
          }
        }]
      });
    } catch (error) {
      console.error('Error caching DeFi analysis:', error);
    }
  }

  /**
   * Get cached DeFi analysis
   */
  async getCachedDeFiAnalysis(signature: string): Promise<any | null> {
    // Skip cache lookup in browser
    if (typeof window !== 'undefined') return null;
    try {
      await this.ensureCacheCollection();
      
      const result = await qdrantClient.search(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vector: new Array(384).fill(0),
        filter: {
          must: [
            { key: 'cacheType', match: { value: CACHE_TYPES.DEFI_ANALYSIS } },
            { key: 'signature', match: { value: signature } },
            { key: 'expiresAt', range: { gt: Date.now() } }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const cached = result[0].payload as unknown as CachedDeFiAnalysis;
        this.hitCount++;
        return cached.analysis;
      }

      this.missCount++;
      return null;
    } catch (error) {
      console.error('Error getting cached DeFi analysis:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Invalidate cache for a specific transaction
   */
  async invalidateTransaction(signature: string): Promise<void> {
    // Skip invalidation in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      // Delete all cache entries for this transaction
      await qdrantClient.delete(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        filter: {
          must: [
            { key: 'signature', match: { value: signature } }
          ]
        }
      });
    } catch (error) {
      console.error('Error invalidating transaction cache:', error);
    }
  }

  /**
   * Invalidate all cache entries
   */
  async invalidateAll(): Promise<void> {
    // Skip invalidation in browser
    if (typeof window !== 'undefined') return;
    try {
      await qdrantClient.deleteCollection(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS);
      await this.ensureCacheCollection();
      this.hitCount = 0;
      this.missCount = 0;
    } catch (error) {
      console.error('Error invalidating all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(): Promise<CacheStatistics> {
    // Skip statistics in browser
    if (typeof window !== 'undefined') {
      return {
        totalEntries: 0,
        entriesByType: {},
        memoryUsage: 0,
        hitRate: 0,
        oldestEntry: Date.now(),
        newestEntry: Date.now(),
      };
    }
    try {
      await this.ensureCacheCollection();
      
      const countResult = await qdrantClient.count(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS);
      const totalRequests = this.hitCount + this.missCount;
      const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

      // Get entries by type
      const entriesByType: Record<string, number> = {};
      for (const cacheType of Object.values(CACHE_TYPES)) {
        const typeCount = await qdrantClient.count(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
          filter: {
            must: [{ key: 'cacheType', match: { value: cacheType } }]
          }
        });
        entriesByType[cacheType] = typeCount.count;
      }

      return {
        totalEntries: countResult.count,
        entriesByType,
        memoryUsage: 0, // Would need to be estimated
        hitRate,
        oldestEntry: Date.now(), // Would need to be tracked
        newestEntry: Date.now(), // Would need to be tracked
      };
    } catch (error) {
      console.error('Error getting cache statistics:', error);
      return {
        totalEntries: 0,
        entriesByType: {},
        memoryUsage: 0,
        hitRate: 0,
        oldestEntry: Date.now(),
        newestEntry: Date.now(),
      };
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(signatures: string[]): Promise<void> {
    // Skip warm-up in browser
    if (typeof window !== 'undefined') return;
    console.log(`Warming up cache for ${signatures.length} transactions`);
    // Implementation would pre-load frequently accessed transactions
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpiredEntries(): Promise<void> {
    // Skip cleanup in browser
    if (typeof window !== 'undefined') return;
    try {
      await this.ensureCacheCollection();
      
      await qdrantClient.delete(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        wait: true,
        filter: {
          must: [
            { key: 'expiresAt', range: { lt: Date.now() } }
          ]
        }
      });
      
      console.log('Cleanup completed - expired entries removed');
    } catch (error) {
      console.error('Error cleaning up expired entries:', error);
    }
  }

  /**
   * Hash query options for cache key generation
   */
  private hashQueryOptions(options?: any): string {
    if (!options) return 'default';
    
    try {
      const sortedOptions = JSON.stringify(options, Object.keys(options).sort());
      return this.simpleHash(sortedOptions);
    } catch (error) {
      console.warn('Error hashing query options:', error);
      return 'error';
    }
  }

  /**
   * Simple hash function for generating short cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if cached version is compatible with current version
   */
  private isValidVersion(cachedVersion: string): boolean {
    return cachedVersion === this.currentVersion;
  }
}

// Export singleton instance
export const transactionAnalysisCache = new TransactionAnalysisCache();

// Export utility functions
export function generateCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}

export function isCacheEnabled(): boolean {
  return typeof window !== 'undefined' && 'localStorage' in window;
}

export function getCacheSize(): number {
  // Estimate cache size - this is a simplified implementation
  try {
    const cacheData = JSON.stringify(memoryCache);
    return new Blob([cacheData]).size;
  } catch (error) {
    return 0;
  }
}

// Cache warming utilities
export async function warmUpTransactionCache(signatures: string[]): Promise<void> {
  await transactionAnalysisCache.warmUpCache(signatures);
}

// Cache management utilities
export function clearTransactionCache(): void {
  transactionAnalysisCache.invalidateAll();
}

export function invalidateTransactionCache(signature: string): void {
  transactionAnalysisCache.invalidateTransaction(signature);
}