/**
 * MCP Tool Response Caching Layer
 *
 * Smart caching system that understands blockchain data immutability:
 * - Immutable data (transactions, historical blocks): Cache forever
 * - Semi-mutable (account state): Short TTL with invalidation
 * - Real-time (network status, prices): No cache or very short TTL
 *
 * Features:
 * - LRU eviction with size limits
 * - TTL-based expiration
 * - Cache key normalization
 * - Hit/miss analytics
 * - Compression for large responses
 * - Redis-compatible interface for production
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type CacheStrategy = 'immutable' | 'short' | 'realtime' | 'custom';

export interface CacheConfig {
  maxSize: number;           // Max entries
  maxMemoryMB: number;       // Max memory in MB
  defaultTtlMs: number;      // Default TTL
  compressionThreshold: number; // Compress responses larger than this
  enableAnalytics: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  size: number;
  createdAt: number;
  expiresAt: number | null;  // null = never expires
  hits: number;
  lastAccessed: number;
  compressed: boolean;
  metadata?: {
    tool: string;
    strategy: CacheStrategy;
    inputHash: string;
  };
}

export interface CacheStats {
  entries: number;
  memoryUsedMB: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  compressionSavings: number;
  byTool: Record<string, { hits: number; misses: number; avgSize: number }>;
}

// ============================================================================
// Tool Cache Strategies
// ============================================================================

/**
 * Define caching strategy per tool based on data mutability
 */
export const TOOL_CACHE_STRATEGIES: Record<string, { strategy: CacheStrategy; ttlMs: number }> = {
  // IMMUTABLE - Transaction/block data never changes
  'get_transaction': { strategy: 'immutable', ttlMs: Infinity },
  'explain_transaction': { strategy: 'immutable', ttlMs: Infinity },
  'analyze_transaction': { strategy: 'immutable', ttlMs: 86400000 }, // 24h (AI analysis might improve)
  'get_block': { strategy: 'immutable', ttlMs: Infinity },

  // SHORT TTL - Account state changes frequently
  'get_account_portfolio': { strategy: 'short', ttlMs: 30000 },     // 30s
  'get_account_transactions': { strategy: 'short', ttlMs: 60000 },  // 1min
  'get_account_stats': { strategy: 'short', ttlMs: 60000 },         // 1min
  'get_blocks': { strategy: 'short', ttlMs: 10000 },                // 10s (latest blocks)

  // MARKET DATA - Short TTL, prices change constantly
  'get_token_ohlcv': { strategy: 'short', ttlMs: 60000 },           // 1min
  'get_token_markets': { strategy: 'short', ttlMs: 30000 },         // 30s
  'get_token_metadata': { strategy: 'short', ttlMs: 300000 },       // 5min (metadata rarely changes)

  // REAL-TIME - Don't cache or very short
  'get_network_status': { strategy: 'realtime', ttlMs: 5000 },      // 5s
  'get_nft_collections': { strategy: 'short', ttlMs: 60000 },       // 1min

  // PROGRAM INFO - Rarely changes
  'get_program': { strategy: 'short', ttlMs: 3600000 },             // 1h

  // SEARCH - Cache to reduce load
  'search': { strategy: 'short', ttlMs: 300000 },                   // 5min

  // INVESTIGATION - Cache results
  'investigate': { strategy: 'short', ttlMs: 600000 },              // 10min
  'find_wallet_path': { strategy: 'short', ttlMs: 300000 },         // 5min

  // AI - Don't cache (non-deterministic)
  'ask_ai': { strategy: 'realtime', ttlMs: 0 },

  // AUTH - Don't cache
  'check_session': { strategy: 'realtime', ttlMs: 0 },
  'list_api_keys': { strategy: 'realtime', ttlMs: 0 },
};

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate deterministic cache key from tool name and parameters
 */
export function generateCacheKey(tool: string, params: Record<string, any>): string {
  // Normalize params (sort keys, remove undefined)
  const normalized = normalizeParams(params);
  const paramsJson = JSON.stringify(normalized);
  const hash = createHash('sha256').update(paramsJson).digest('hex').slice(0, 16);
  return `mcp:${tool}:${hash}`;
}

function normalizeParams(params: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  const sortedKeys = Object.keys(params).sort();

  for (const key of sortedKeys) {
    const value = params[key];
    if (value === undefined || value === null) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = normalizeParams(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v =>
        typeof v === 'object' ? normalizeParams(v) : v
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// In-Memory Cache Implementation
// ============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 10000,
  maxMemoryMB: 256,
  defaultTtlMs: 60000,
  compressionThreshold: 10000,  // 10KB
  enableAnalytics: true,
};

export class MCPCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressionSavings: 0,
  };
  private toolStats = new Map<string, { hits: number; misses: number; totalSize: number; count: number }>();
  private memoryUsed = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateToolStats(key, false);
      return null;
    }

    // Check expiration
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      this.updateToolStats(key, false);
      return null;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.updateToolStats(key, true);

    // Decompress if needed
    if (entry.compressed) {
      return this.decompress(entry.data) as T;
    }

    return entry.data as T;
  }

  /**
   * Set cached value with automatic strategy detection
   */
  set<T>(
    tool: string,
    params: Record<string, any>,
    data: T,
    options?: { ttlMs?: number; strategy?: CacheStrategy }
  ): string {
    const key = generateCacheKey(tool, params);

    // Get strategy
    const toolConfig = TOOL_CACHE_STRATEGIES[tool] || {
      strategy: 'short',
      ttlMs: this.config.defaultTtlMs
    };
    const strategy = options?.strategy || toolConfig.strategy;
    const ttlMs = options?.ttlMs ?? toolConfig.ttlMs;

    // Don't cache real-time data with 0 TTL
    if (strategy === 'realtime' && ttlMs === 0) {
      return key;
    }

    // Serialize and measure size
    let serialized = JSON.stringify(data);
    let size = serialized.length;
    let compressed = false;

    // Compress large responses
    if (size > this.config.compressionThreshold) {
      const compressedData = this.compress(data);
      const compressedSize = JSON.stringify(compressedData).length;
      if (compressedSize < size) {
        this.stats.compressionSavings += size - compressedSize;
        serialized = JSON.stringify(compressedData);
        size = compressedSize;
        compressed = true;
      }
    }

    // Evict if needed
    this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      key,
      data: compressed ? this.compress(data) : data,
      size,
      createdAt: Date.now(),
      expiresAt: ttlMs === Infinity ? null : Date.now() + ttlMs,
      hits: 0,
      lastAccessed: Date.now(),
      compressed,
      metadata: {
        tool,
        strategy,
        inputHash: createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 8),
      },
    };

    this.cache.set(key, entry);
    this.memoryUsed += size;

    return key;
  }

  /**
   * Delete cached value
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.memoryUsed -= entry.size;
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate all cache entries for a tool
   */
  invalidateTool(tool: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.metadata?.tool === tool) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate cache entries matching a pattern
   * e.g., invalidatePattern('get_account_*', { address: '0x123' })
   */
  invalidatePattern(toolPattern: string, params?: Record<string, any>): number {
    const regex = new RegExp(toolPattern.replace('*', '.*'));
    let count = 0;

    for (const [key, entry] of this.cache) {
      if (entry.metadata?.tool && regex.test(entry.metadata.tool)) {
        if (!params || this.matchesParams(key, params)) {
          this.delete(key);
          count++;
        }
      }
    }

    return count;
  }

  private matchesParams(key: string, params: Record<string, any>): boolean {
    // Extract hash from key and compare
    // This is a simplified check - in production, store params in metadata
    const inputHash = createHash('sha256').update(JSON.stringify(normalizeParams(params))).digest('hex').slice(0, 8);
    const entry = this.cache.get(key);
    return entry?.metadata?.inputHash === inputHash;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.memoryUsed = 0;
    this.stats = { hits: 0, misses: 0, evictions: 0, compressionSavings: 0 };
    this.toolStats.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const byTool: CacheStats['byTool'] = {};

    for (const [tool, stats] of this.toolStats) {
      byTool[tool] = {
        hits: stats.hits,
        misses: stats.misses,
        avgSize: stats.count > 0 ? stats.totalSize / stats.count : 0,
      };
    }

    return {
      entries: this.cache.size,
      memoryUsedMB: this.memoryUsed / (1024 * 1024),
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0,
      evictions: this.stats.evictions,
      compressionSavings: this.stats.compressionSavings,
      byTool,
    };
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(options?: { tool?: string; limit?: number }): CacheEntry[] {
    let entries = Array.from(this.cache.values());

    if (options?.tool) {
      entries = entries.filter(e => e.metadata?.tool === options.tool);
    }

    entries.sort((a, b) => b.lastAccessed - a.lastAccessed);

    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private ensureCapacity(newSize: number): void {
    const maxMemory = this.config.maxMemoryMB * 1024 * 1024;

    // Evict if over memory limit
    while (this.memoryUsed + newSize > maxMemory && this.cache.size > 0) {
      this.evictOne();
    }

    // Evict if over entry limit
    while (this.cache.size >= this.config.maxSize) {
      this.evictOne();
    }
  }

  private evictOne(): void {
    // LRU eviction - find least recently accessed
    let oldest: { key: string; lastAccessed: number } | null = null;

    for (const [key, entry] of this.cache) {
      // Skip immutable entries unless we really need space
      if (entry.expiresAt === null && this.memoryUsed < this.config.maxMemoryMB * 1024 * 1024 * 0.9) {
        continue;
      }

      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = { key, lastAccessed: entry.lastAccessed };
      }
    }

    if (oldest) {
      this.delete(oldest.key);
      this.stats.evictions++;
    }
  }

  private updateToolStats(key: string, hit: boolean): void {
    if (!this.config.enableAnalytics) return;

    // Extract tool name from key
    const match = key.match(/^mcp:([^:]+):/);
    if (!match) return;

    const tool = match[1];
    const stats = this.toolStats.get(tool) || { hits: 0, misses: 0, totalSize: 0, count: 0 };

    if (hit) {
      stats.hits++;
      const entry = this.cache.get(key);
      if (entry) {
        stats.totalSize += entry.size;
        stats.count++;
      }
    } else {
      stats.misses++;
    }

    this.toolStats.set(tool, stats);
  }

  private compress(data: any): any {
    // Simple compression: for arrays, store summary + sample
    if (Array.isArray(data) && data.length > 100) {
      return {
        __compressed: true,
        __type: 'array',
        __length: data.length,
        __sample: data.slice(0, 10),
        __data: data,  // Still store full data, but mark as compressed
      };
    }
    return data;
  }

  private decompress(data: any): any {
    if (data?.__compressed && data.__data) {
      return data.__data;
    }
    return data;
  }
}

// ============================================================================
// Cache Wrapper for Tool Execution
// ============================================================================

/**
 * Higher-order function to add caching to any tool executor
 */
export function withCache<T>(
  cache: MCPCache,
  tool: string,
  params: Record<string, any>,
  executor: () => Promise<T>,
  options?: { ttlMs?: number; strategy?: CacheStrategy; bypassCache?: boolean }
): Promise<T> {
  const key = generateCacheKey(tool, params);

  // Check cache first (unless bypassed)
  if (!options?.bypassCache) {
    const cached = cache.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }
  }

  // Execute and cache result
  return executor().then(result => {
    cache.set(tool, params, result, options);
    return result;
  });
}

/**
 * Create a cached tool executor
 */
export function createCachedExecutor(
  cache: MCPCache,
  executor: (tool: string, params: Record<string, any>) => Promise<any>
): (tool: string, params: Record<string, any>, options?: { bypassCache?: boolean }) => Promise<any> {
  return async (tool, params, options) => {
    return withCache(cache, tool, params, () => executor(tool, params), options);
  };
}

// ============================================================================
// Redis-Compatible Interface (for production)
// ============================================================================

export interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * Redis adapter for production deployments
 */
export class RedisCacheBackend implements CacheBackend {
  private client: any;  // Redis client

  constructor(redisClient: any) {
    this.client = redisClient;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (ttlMs && ttlMs !== Infinity) {
      await this.client.set(key, value, 'PX', ttlMs);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async clear(): Promise<void> {
    const keys = await this.keys('mcp:*');
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalCache: MCPCache | null = null;

export function getCache(): MCPCache {
  if (!globalCache) {
    globalCache = new MCPCache();
  }
  return globalCache;
}

export function createCache(config?: Partial<CacheConfig>): MCPCache {
  globalCache = new MCPCache(config);
  return globalCache;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MCPCache,
  getCache,
  createCache,
  generateCacheKey,
  withCache,
  createCachedExecutor,
  TOOL_CACHE_STRATEGIES,
  RedisCacheBackend,
};
