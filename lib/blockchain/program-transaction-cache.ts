/**
 * Program Transaction Cache
 * 
 * Separate cache for program transaction results to avoid type conflicts
 * with the main transaction cache.
 */

import type { ProgramTransactionResult } from './program-transaction-fetcher';

// Simple in-memory cache for program transaction data
class ProgramTransactionCache {
  private cache = new Map<string, ProgramTransactionResult>();
  private maxSize = 500; // Maximum number of cached program results
  private ttl = 5 * 60 * 1000; // 5 minutes TTL
  private timestamps = new Map<string, number>();

  set(key: string, result: ProgramTransactionResult): void {
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
    
    this.cache.set(key, result);
    this.timestamps.set(key, Date.now());
  }

  get(key: string): ProgramTransactionResult | null {
    const timestamp = this.timestamps.get(key);
    
    if (!timestamp) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - timestamp > this.ttl) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key) || null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      memoryUsage: Array.from(this.cache.keys())
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.timestamps.delete(key);
    });
  }
}

// Export singleton instance
export const programTransactionCache = new ProgramTransactionCache();
