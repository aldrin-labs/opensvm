/**
 * Block Data Cache Manager for OpenSVM Block Explorer Enhancements
 * 
 * This module provides specialized caching for block data with different TTL strategies,
 * cache warming, and performance optimization for the block explorer.
 */

import { memoryCache } from '../cache';
import { cacheManager as persistentCache } from './persistent-cache';
import { CacheConfig, CacheEntry } from '@/lib/types/block.types';
import { BlockDetails } from '@/lib/solana';
import { getConnection } from '@/lib/solana-connection-server';

// ============================================================================
// Cache Configuration
// ============================================================================

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  blockData: {
    ttl: Infinity, // Confirmed blocks are immutable
    strategy: 'immutable'
  },
  blockList: {
    ttl: 30000, // 30 seconds
    strategy: 'stale-while-revalidate'
  },
  analytics: {
    ttl: 300000, // 5 minutes
    strategy: 'background-refresh'
  },
  visitStats: {
    ttl: 60000, // 1 minute
    strategy: 'real-time-update'
  }
};

// ============================================================================
// Block Cache Manager
// ============================================================================

export class BlockCacheManager {
  private static instance: BlockCacheManager | null = null;
  private config: CacheConfig;
  private cache = new Map<string, CacheEntry>();
  private backgroundRefreshTasks = new Map<string, NodeJS.Timeout>();
  private warmupInProgress = false;
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    backgroundRefreshes: 0,
    warmupBlocks: 0
  };

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.setupPeriodicCleanup();
  }

  public static getInstance(config?: Partial<CacheConfig>): BlockCacheManager {
    if (!BlockCacheManager.instance) {
      BlockCacheManager.instance = new BlockCacheManager(config);
    }
    return BlockCacheManager.instance;
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey);
      this.metrics.evictions++;
      this.metrics.misses++;
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    entry.hits++;
    this.metrics.hits++;

    // Handle stale-while-revalidate strategy
    if (this.isStale(entry) && entry.key.includes('blocks:list')) {
      this.scheduleBackgroundRefresh(key);
    }

    return entry.data as T;
  }

  async set<T>(key: string, data: T, customTtl?: number): Promise<void> {
    const cacheKey = this.getCacheKey(key);
    const ttl = customTtl || this.getTtlForKey(key);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      key: cacheKey,
      hits: 0,
      lastAccessed: now
    };

    this.cache.set(cacheKey, entry);

    // Enforce cache size limits
    this.enforceSize();

    // Set up background refresh for analytics data
    if (key.includes('analytics') && this.config.analytics.strategy === 'background-refresh') {
      this.scheduleBackgroundRefresh(key, ttl * 0.8); // Refresh at 80% of TTL
    }
  }

  async delete(key: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(key);
    const deleted = this.cache.delete(cacheKey);

    // Cancel any background refresh tasks
    const refreshTask = this.backgroundRefreshTasks.get(cacheKey);
    if (refreshTask) {
      clearTimeout(refreshTask);
      this.backgroundRefreshTasks.delete(cacheKey);
    }

    return deleted;
  }

  async invalidate(pattern: string): Promise<number> {
    let invalidated = 0;
    const regex = new RegExp(pattern);

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(entry.key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  // ============================================================================
  // Block-Specific Cache Methods
  // ============================================================================

  async getBlockData(slot: number): Promise<BlockDetails | null> {
    const key = `block:${slot}`;
    return this.get<BlockDetails>(key);
  }

  async setBlockData(slot: number, blockData: BlockDetails): Promise<void> {
    const key = `block:${slot}`;

    // Determine if block is confirmed (immutable)
    const currentSlot = await this.getCurrentSlot();
    const isConfirmed = slot < currentSlot - 32; // 32 slots for finalization

    const ttl = isConfirmed ? Infinity : 300000; // 5 minutes for recent blocks
    await this.set(key, blockData, ttl);
  }

  async getBlockList(limit: number, before?: number): Promise<any | null> {
    const key = `blocks:list:${limit}:${before || 'latest'}`;
    return this.get(key);
  }

  async setBlockList(limit: number, before: number | undefined, data: any): Promise<void> {
    const key = `blocks:list:${limit}:${before || 'latest'}`;
    await this.set(key, data);
  }

  async getBlockStats(): Promise<any | null> {
    const key = 'blocks:stats';
    return this.get(key);
  }

  async setBlockStats(stats: any): Promise<void> {
    const key = 'blocks:stats';
    await this.set(key, stats);
  }

  async getAnalytics(blockSlot: number, type: string): Promise<any | null> {
    const key = `analytics:${type}:${blockSlot}`;
    return this.get(key);
  }

  async setAnalytics(blockSlot: number, type: string, data: any): Promise<void> {
    const key = `analytics:${type}:${blockSlot}`;
    await this.set(key, data);
  }

  async getVisitStats(blockSlot: number): Promise<any | null> {
    const key = `visit:${blockSlot}`;
    return this.get(key);
  }

  async setVisitStats(blockSlot: number, stats: any): Promise<void> {
    const key = `visit:${blockSlot}`;
    await this.set(key, stats);
  }

  // ============================================================================
  // Cache Warming
  // ============================================================================

  async warmCache(): Promise<void> {
    if (this.warmupInProgress) {
      console.log('Cache warmup already in progress');
      return;
    }

    this.warmupInProgress = true;
    console.log('Starting block cache warmup...');

    try {
      const connection = await getConnection();
      const currentSlot = await connection.getSlot();

      // Warm up last 100 blocks
      const blocksToWarm = 100;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < blocksToWarm; i++) {
        const slot = currentSlot - i;

        promises.push(
          this.warmBlock(slot).catch(error => {
            console.warn(`Failed to warm block ${slot}:`, error.message);
          })
        );

        // Process in batches of 10 to avoid overwhelming the RPC
        if (promises.length >= 10) {
          await Promise.all(promises);
          promises.length = 0;

          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Process remaining promises
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      console.log(`Cache warmup completed. Warmed ${this.metrics.warmupBlocks} blocks.`);
    } catch (error) {
      console.error('Cache warmup failed:', error);
    } finally {
      this.warmupInProgress = false;
    }
  }

  private async warmBlock(slot: number): Promise<void> {
    // Check if block is already cached
    const existing = await this.getBlockData(slot);
    if (existing) {
      return;
    }

    try {
      // This would typically call the actual block fetching function
      // For now, we'll just mark it as warmed
      this.metrics.warmupBlocks++;
    } catch (error) {
      // Silently fail for individual blocks during warmup
      console.debug(`Failed to warm block ${slot}:`, error);
    }
  }

  // ============================================================================
  // Background Refresh
  // ============================================================================

  private scheduleBackgroundRefresh(key: string, delay?: number): void {
    const cacheKey = this.getCacheKey(key);

    // Cancel existing refresh task
    const existingTask = this.backgroundRefreshTasks.get(cacheKey);
    if (existingTask) {
      clearTimeout(existingTask);
    }

    // Schedule new refresh
    const refreshDelay = delay || 30000; // Default 30 seconds
    const task = setTimeout(async () => {
      try {
        await this.refreshData(key);
        this.metrics.backgroundRefreshes++;
      } catch (error) {
        console.warn(`Background refresh failed for ${key}:`, error);
      } finally {
        this.backgroundRefreshTasks.delete(cacheKey);
      }
    }, refreshDelay);

    this.backgroundRefreshTasks.set(cacheKey, task);
  }

  private async refreshData(key: string): Promise<void> {
    // This would implement the actual data refresh logic
    // For now, we'll just log the refresh attempt
    console.debug(`Background refresh triggered for ${key}`);

    // TODO: Implement actual refresh logic based on key type
    // - For block lists: fetch latest blocks
    // - For analytics: recalculate analytics data
    // - For stats: fetch latest network stats
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === Infinity) {
      return false;
    }
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private isStale(entry: CacheEntry): boolean {
    if (entry.ttl === Infinity) {
      return false;
    }
    // Consider stale at 80% of TTL
    return Date.now() - entry.timestamp > entry.ttl * 0.8;
  }

  private getTtlForKey(key: string): number {
    if (key.startsWith('block:')) {
      return this.config.blockData.ttl;
    } else if (key.startsWith('blocks:list')) {
      return this.config.blockList.ttl;
    } else if (key.startsWith('analytics:')) {
      return this.config.analytics.ttl;
    } else if (key.startsWith('visit:')) {
      return this.config.visitStats.ttl;
    }
    return 300000; // Default 5 minutes
  }

  private getCacheKey(key: string): string {
    return `block_cache:${key}`;
  }

  private async getCurrentSlot(): Promise<number> {
    try {
      const connection = await getConnection();
      return await connection.getSlot();
    } catch (error) {
      console.warn('Failed to get current slot:', error);
      return 0;
    }
  }

  private enforceSize(): void {
    const maxEntries = 10000; // Configurable limit

    if (this.cache.size <= maxEntries) {
      return;
    }

    // Convert to array and sort by last accessed time (LRU)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove oldest 10% of entries
    const toRemove = Math.floor(this.cache.size * 0.1);

    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.metrics.evictions++;
    }
  }

  private setupPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`Cache cleanup: removed ${cleaned} expired entries`);
      this.metrics.evictions += cleaned;
    }
  }

  // ============================================================================
  // Metrics and Monitoring
  // ============================================================================

  getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses;

    return {
      ...this.metrics,
      hitRate: totalRequests > 0 ? this.metrics.hits / totalRequests : 0,
      totalEntries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      backgroundTasks: this.backgroundRefreshTasks.size
    };
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(entry.data).length * 2; // UTF-16 encoding
      totalSize += 200; // Overhead for entry metadata
    }

    return totalSize;
  }

  // ============================================================================
  // Integration with Existing Cache Systems
  // ============================================================================

  async getFromMemoryCache<T>(key: string): Promise<T | null> {
    return memoryCache.get<T>(key);
  }

  async setToMemoryCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    memoryCache.set(key, data, ttlSeconds);
  }

  async getFromPersistentCache<T>(key: string): Promise<T | null> {
    return persistentCache.get<T>(key);
  }

  async setToPersistentCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    return persistentCache.set(key, data, ttl);
  }

  // ============================================================================
  // Cleanup and Shutdown
  // ============================================================================

  async shutdown(): Promise<void> {
    console.log('Block cache manager shutting down...');

    // Cancel all background refresh tasks
    for (const task of this.backgroundRefreshTasks.values()) {
      clearTimeout(task);
    }
    this.backgroundRefreshTasks.clear();

    // Final cleanup
    this.cleanup();

    // Clear cache
    this.cache.clear();

    console.log('Block cache manager shutdown complete');
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const blockCacheManager = BlockCacheManager.getInstance({
  blockData: {
    ttl: Infinity, // Confirmed blocks never expire
    strategy: 'immutable'
  },
  blockList: {
    ttl: 30000, // 30 seconds for block lists
    strategy: 'stale-while-revalidate'
  },
  analytics: {
    ttl: 300000, // 5 minutes for analytics
    strategy: 'background-refresh'
  },
  visitStats: {
    ttl: 60000, // 1 minute for visit stats
    strategy: 'real-time-update'
  }
});

// ============================================================================
// Cache Metrics API Endpoint Support
// ============================================================================

export async function getCacheMetrics() {
  const blockMetrics = blockCacheManager.getMetrics();
  const persistentStats = await persistentCache.stats();

  return {
    blockCache: blockMetrics,
    persistentCache: persistentStats,
    timestamp: Date.now()
  };
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

if (typeof process !== 'undefined') {
  const shutdown = async () => {
    await blockCacheManager.shutdown();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}