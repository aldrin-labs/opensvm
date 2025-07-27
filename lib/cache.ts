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
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
    
    // Enforce size limit with LRU eviction
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const memoryCache = new MemoryCache();
export { memoryCache };
