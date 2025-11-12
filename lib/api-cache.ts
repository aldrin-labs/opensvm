/**
 * Reusable API Caching Utility
 * Provides consistent caching with background refresh for all API routes
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

export interface CacheConfig {
  duration?: number; // Cache duration in ms (default: 5 minutes)
  refreshThreshold?: number; // Background refresh threshold in ms (default: 1 minute)
}

export class APICache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private ongoingUpdates = new Set<string>();
  private duration: number;
  private refreshThreshold: number;

  constructor(config: CacheConfig = {}) {
    this.duration = config.duration ?? 5 * 60 * 1000; // 5 minutes default
    this.refreshThreshold = config.refreshThreshold ?? 60 * 1000; // 1 minute default
  }

  /**
   * Get cached data if available and valid
   * Triggers background refresh if data is older than refresh threshold
   */
  async get(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<{ data: T; cached: boolean; cacheAge: number | null }> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached) {
      const cacheAge = now - cached.timestamp;

      // If cache is still valid
      if (cacheAge < this.duration) {
        // Trigger background refresh if needed
        if (cacheAge > this.refreshThreshold) {
          console.log(`Cache is ${Math.round(cacheAge / 1000)}s old, triggering background refresh for ${key}`);
          this.updateInBackground(key, fetchFn).catch(err =>
            console.error('Background update error:', err)
          );
        }

        console.log(`Returning cached data for ${key} (age: ${Math.round(cacheAge / 1000)}s)`);
        return {
          data: cached.data,
          cached: true,
          cacheAge: Math.round(cacheAge / 1000)
        };
      }
    }

    // Fetch fresh data
    console.log(`Fetching fresh data for ${key}`);
    const data = await fetchFn();

    // Cache the results
    this.cache.set(key, {
      data,
      timestamp: now
    });

    return {
      data,
      cached: false,
      cacheAge: null
    };
  }

  /**
   * Update cache in background without blocking
   */
  private async updateInBackground(key: string, fetchFn: () => Promise<T>): Promise<void> {
    if (this.ongoingUpdates.has(key)) {
      console.log(`Background update already in progress for ${key}`);
      return;
    }

    this.ongoingUpdates.add(key);
    console.log(`Starting background cache update for ${key}`);

    try {
      const data = await fetchFn();
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      console.log(`Background cache update completed for ${key}`);
    } catch (error) {
      console.error(`Background cache update failed for ${key}:`, error);
    } finally {
      this.ongoingUpdates.delete(key);
    }
  }

  /**
   * Manually set cache entry
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      ongoingUpdates: this.ongoingUpdates.size
    };
  }
}

/**
 * Create a new cache instance
 */
export function createCache<T = any>(config?: CacheConfig): APICache<T> {
  return new APICache<T>(config);
}

/**
 * Default cache instance for general use
 */
export const defaultCache = new APICache();
