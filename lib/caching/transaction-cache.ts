'use client';

import type { DetailedTransactionInfo } from '@/lib/solana/solana';

// Simple in-memory cache for transaction data
class TransactionCache {
  private cache = new Map<string, DetailedTransactionInfo>();
  private maxSize = 1000; // Maximum number of cached transactions
  private ttl = 5 * 60 * 1000; // 5 minutes TTL
  private timestamps = new Map<string, number>();

  set(signature: string, transaction: DetailedTransactionInfo): void {
    // Clean up expired entries before adding new ones
    this.cleanup();
    
    // If cache is at max size, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.timestamps.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.timestamps.delete(oldestKey);
      }
    }
    
    this.cache.set(signature, transaction);
    this.timestamps.set(signature, Date.now());
  }

  get(signature: string): DetailedTransactionInfo | null {
    const timestamp = this.timestamps.get(signature);
    
    // Check if entry has expired
    if (timestamp && Date.now() - timestamp > this.ttl) {
      this.cache.delete(signature);
      this.timestamps.delete(signature);
      return null;
    }
    
    return this.cache.get(signature) || null;
  }

  has(signature: string): boolean {
    const timestamp = this.timestamps.get(signature);
    
    // Check if entry has expired
    if (timestamp && Date.now() - timestamp > this.ttl) {
      this.cache.delete(signature);
      this.timestamps.delete(signature);
      return false;
    }
    
    return this.cache.has(signature);
  }

  delete(signature: string): boolean {
    this.timestamps.delete(signature);
    return this.cache.delete(signature);
  }

  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [signature, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.ttl) {
        expiredKeys.push(signature);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.timestamps.delete(key);
    }
  }

  // Get cache statistics
  getStats() {
    this.cleanup();
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage in bytes
    let size = 0;
    for (const [key, value] of this.cache.entries()) {
      size += key.length * 2; // String character size
      size += JSON.stringify(value).length * 2; // Rough estimate of object size
    }
    return size;
  }
}

// Export singleton instance
export const transactionCache = new TransactionCache();

// Export the class for testing or custom instances
export { TransactionCache };

// Helper functions for working with cached transactions
export function getCachedTransaction(signature: string): DetailedTransactionInfo | null {
  return transactionCache.get(signature);
}

export function setCachedTransaction(signature: string, transaction: DetailedTransactionInfo): void {
  transactionCache.set(signature, transaction);
}

export function removeCachedTransaction(signature: string): boolean {
  return transactionCache.delete(signature);
}

export function clearTransactionCache(): void {
  transactionCache.clear();
}

export function getTransactionCacheStats() {
  return transactionCache.getStats();
}

// Export cache helpers object
export const cacheHelpers = {
  get: getCachedTransaction,
  set: setCachedTransaction,
  remove: removeCachedTransaction,
  clear: clearTransactionCache,
  stats: getTransactionCacheStats
};
