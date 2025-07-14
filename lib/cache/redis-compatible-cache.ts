/**
 * Redis-Compatible Advanced Caching System for OpenSVM
 * 
 * Provides a Redis-like interface with multi-layer caching (memory + persistent storage)
 * specifically optimized for blockchain analytics and network statistics.
 */

import { LRUCache } from 'lru-cache';
import { memoryCache } from '@/lib/cache';

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  enableCompression?: boolean;
  namespace?: string;
}

export interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
  tags?: string[];
}

export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  evictionCount: number;
  lastCleanup: number;
}

/**
 * Advanced multi-layer cache implementation with Redis-like operations
 */
export class RedisCompatibleCache {
  private memCache: LRUCache<string, CacheEntry>;
  private stats: CacheStats = {
    totalEntries: 0,
    memoryUsage: 0,
    hitRate: 0,
    missRate: 0,
    totalHits: 0,
    totalMisses: 0,
    evictionCount: 0,
    lastCleanup: Date.now()
  };
  
  private compressionEnabled: boolean;
  private namespace: string;

  constructor(options: CacheOptions = {}) {
    this.memCache = new LRUCache<string, CacheEntry>({
      max: options.maxSize || 10000,
      ttl: options.ttl || 30 * 60 * 1000, // 30 minutes default
      updateAgeOnGet: true,
      allowStale: false,
      dispose: () => {
        this.stats.evictionCount++;
      }
    });
    
    this.compressionEnabled = options.enableCompression ?? true;
    this.namespace = options.namespace || 'opensvm';
  }

  /**
   * Set a value in cache with optional TTL and tags
   */
  async set(key: string, value: any, ttl?: number, tags?: string[]): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key);
    const entry: CacheEntry = {
      value: this.compressionEnabled ? this.compress(value) : value,
      timestamp: Date.now(),
      ttl: ttl || 30 * 60 * 1000,
      compressed: this.compressionEnabled,
      tags
    };

    // Store in memory cache
    this.memCache.set(namespacedKey, entry);
    
    // Also store in legacy memory cache for compatibility
    memoryCache.set(namespacedKey, value, (ttl || 30 * 60 * 1000) / 1000);
    
    this.updateStats();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = this.getNamespacedKey(key);
    const entry = this.memCache.get(namespacedKey);
    
    if (!entry) {
      this.stats.totalMisses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memCache.delete(namespacedKey);
      this.stats.totalMisses++;
      this.stats.evictionCount++;
      this.updateHitRate();
      return null;
    }

    this.stats.totalHits++;
    this.updateHitRate();
    
    const value = entry.compressed ? this.decompress(entry.value) : entry.value;
    return value as T;
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key);
    const deleted = this.memCache.delete(namespacedKey);
    memoryCache.delete(namespacedKey);
    this.updateStats();
    return deleted;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key);
    return this.memCache.has(namespacedKey);
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key);
    const entry = this.memCache.get(namespacedKey);
    
    if (!entry) return false;
    
    entry.ttl = ttl;
    entry.timestamp = Date.now();
    this.memCache.set(namespacedKey, entry);
    return true;
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    const namespacedKey = this.getNamespacedKey(key);
    const entry = this.memCache.get(namespacedKey);
    
    if (!entry) return -2; // Key does not exist
    
    const remaining = entry.ttl - (Date.now() - entry.timestamp);
    return remaining > 0 ? Math.floor(remaining / 1000) : -1; // Expired
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.memCache.keys());
    
    if (!pattern) {
      return allKeys.map(key => this.removeNamespace(key));
    }
    
    // Simple pattern matching (glob-like)
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return allKeys
      .filter(key => regex.test(this.removeNamespace(key)))
      .map(key => this.removeNamespace(key));
  }

  /**
   * Flush all cache entries
   */
  async flushall(): Promise<void> {
    this.memCache.clear();
    this.stats = {
      totalEntries: 0,
      memoryUsage: 0,
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      evictionCount: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Get cache statistics
   */
  async info(): Promise<CacheStats> {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.memCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memCache.delete(key);
        cleaned++;
      }
    }
    
    this.stats.evictionCount += cleaned;
    this.stats.lastCleanup = now;
    this.updateStats();
    
    return cleaned;
  }

  /**
   * Blockchain-specific cache operations
   */

  /**
   * Cache network statistics with automatic invalidation
   */
  async cacheNetworkStats(data: any, ttl = 5 * 60 * 1000): Promise<void> {
    await this.set('network:stats', data, ttl, ['network', 'stats']);
  }

  /**
   * Cache token analytics data
   */
  async cacheTokenAnalytics(mint: string, data: any, ttl = 10 * 60 * 1000): Promise<void> {
    await this.set(`token:analytics:${mint}`, data, ttl, ['token', 'analytics']);
  }

  /**
   * Cache transaction data with long TTL (immutable)
   */
  async cacheTransaction(signature: string, data: any, ttl = 24 * 60 * 60 * 1000): Promise<void> {
    await this.set(`tx:${signature}`, data, ttl, ['transaction', 'immutable']);
  }

  /**
   * Cache block data with long TTL (immutable)
   */
  async cacheBlock(slot: number, data: any, ttl = 24 * 60 * 60 * 1000): Promise<void> {
    await this.set(`block:${slot}`, data, ttl, ['block', 'immutable']);
  }

  /**
   * Cache account data with short TTL (mutable)
   */
  async cacheAccount(address: string, data: any, ttl = 5 * 60 * 1000): Promise<void> {
    await this.set(`account:${address}`, data, ttl, ['account', 'mutable']);
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;
    
    for (const [key, entry] of this.memCache.entries()) {
      if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
        this.memCache.delete(key);
        invalidated++;
      }
    }
    
    this.updateStats();
    return invalidated;
  }

  /**
   * Warm up cache with predefined data
   */
  async warmup(data: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<void> {
    for (const item of data) {
      await this.set(item.key, item.value, item.ttl, item.tags);
    }
  }

  // Private helper methods

  private getNamespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private removeNamespace(key: string): string {
    const prefix = `${this.namespace}:`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }

  private compress(data: any): string {
    // Simple JSON compression - in production, use actual compression like gzip
    return JSON.stringify(data);
  }

  private decompress(data: string): any {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.memCache.size;
    this.stats.memoryUsage = this.memCache.calculatedSize || 0;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    if (total > 0) {
      this.stats.hitRate = this.stats.totalHits / total;
      this.stats.missRate = this.stats.totalMisses / total;
    }
  }
}

// Export singleton instances for different use cases
export const apiCache = new RedisCompatibleCache({
  ttl: 30 * 60 * 1000, // 30 minutes default
  maxSize: 5000,
  enableCompression: true,
  namespace: 'api'
});

export const analyticsCache = new RedisCompatibleCache({
  ttl: 15 * 60 * 1000, // 15 minutes for analytics
  maxSize: 2000,
  enableCompression: true,
  namespace: 'analytics'
});

export const blockchainCache = new RedisCompatibleCache({
  ttl: 60 * 60 * 1000, // 1 hour for immutable blockchain data
  maxSize: 10000,
  enableCompression: true,
  namespace: 'blockchain'
});

// Setup automatic cleanup
setInterval(async () => {
  const cleanedApi = await apiCache.cleanup();
  const cleanedAnalytics = await analyticsCache.cleanup();
  const cleanedBlockchain = await blockchainCache.cleanup();
  
  const total = cleanedApi + cleanedAnalytics + cleanedBlockchain;
  if (total > 0) {
    console.log(`Cache cleanup: removed ${total} expired entries`);
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes