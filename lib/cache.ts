type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Handle zero or negative TTL - don't store the value
    if (ttlSeconds <= 0) {
      return;
    }
    
    const expiresAt = Date.now() + ttlSeconds * 1000;
    
    // If key exists, delete it first to update position (LRU)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    this.cache.set(key, { value, expiresAt });
    
    // Enforce size limit with proper LRU eviction
    while (this.cache.size > this.maxSize) {
      // Delete the first (oldest) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      } else {
        break; // Safety break if no keys found
      }
    }
  }

  get<T>(key: string): T | null {
    // Clean up expired entries opportunistically
    this.cleanupExpired();
    
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU (delete and re-add)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const memoryCache = new MemoryCache();
export { memoryCache, MemoryCache };
