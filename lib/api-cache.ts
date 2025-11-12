/**
 * Reusable API Caching Utility - Qdrant-based persistent storage
 * Provides consistent caching with background refresh for all API routes
 * Uses Qdrant vector database for persistent, distributed cache storage
 */

import { qdrantClient } from './qdrant';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  key: string;
}

export interface CacheConfig {
  duration?: number; // Cache duration in ms (default: 5 minutes)
  refreshThreshold?: number; // Background refresh threshold in ms (default: 1 minute)
}

// Collection name for API cache
const CACHE_COLLECTION = 'api_cache';

// Track collection initialization
let collectionInitialized = false;

/**
 * Initialize Qdrant collection for API cache
 */
async function ensureCacheCollection(): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  // Check if already initialized
  if (collectionInitialized) return;

  try {
    const exists = await qdrantClient.getCollection(CACHE_COLLECTION).catch(() => null);

    if (!exists) {
      await qdrantClient.createCollection(CACHE_COLLECTION, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created api_cache collection');
    }

    // Ensure indexes exist for efficient querying
    const ensureIndex = async (fieldName: string, fieldType: 'keyword' | 'integer' = 'keyword') => {
      try {
        await qdrantClient.createPayloadIndex(CACHE_COLLECTION, {
          field_name: fieldName,
          field_schema: fieldType
        });
      } catch (error: any) {
        if (!error?.data?.status?.error?.includes('already exists') &&
            !error?.message?.includes('already exists')) {
          console.warn(`Failed to create index for ${fieldName}:`, error?.message);
        }
      }
    };

    await ensureIndex('key', 'keyword');
    await ensureIndex('timestamp', 'integer');

    collectionInitialized = true;
    console.log('API cache collection initialized successfully');
  } catch (error) {
    console.error('Error initializing API cache collection:', error);
    throw error;
  }
}

/**
 * Generate a simple embedding for cache key
 */
function generateCacheEmbedding(key: string): number[] {
  const hash = key.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const vector = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.sin(hash + i) * 0.1;
  }

  return vector;
}

export class APICache<T = any> {
  private ongoingUpdates = new Set<string>();
  private duration: number;
  private refreshThreshold: number;

  constructor(config: CacheConfig = {}) {
    this.duration = config.duration ?? 5 * 60 * 1000; // 5 minutes default
    this.refreshThreshold = config.refreshThreshold ?? 60 * 1000; // 1 minute default
  }

  /**
   * Get cached data from Qdrant if available and valid
   * Triggers background refresh if data is older than refresh threshold
   */
  async get(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<{ data: T; cached: boolean; cacheAge: number | null }> {
    // Skip Qdrant in browser - fetch fresh data
    if (typeof window !== 'undefined') {
      const data = await fetchFn();
      return { data, cached: false, cacheAge: null };
    }

    try {
      await ensureCacheCollection();

      // Search for cached entry by exact key match using scroll
      const result = await qdrantClient.scroll(CACHE_COLLECTION, {
        filter: {
          must: [{ key: 'key', match: { value: key } }]
        },
        limit: 1,
        with_payload: true,
        with_vector: false
      });

      const now = Date.now();

      if (result.points && result.points.length > 0) {
        const cached = result.points[0].payload as any;
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
          
          // Deserialize data from JSON string
          const deserializedData = JSON.parse(cached.data) as T;
          
          return {
            data: deserializedData,
            cached: true,
            cacheAge: Math.round(cacheAge / 1000)
          };
        } else {
          console.log(`Cache expired for ${key} (age: ${Math.round(cacheAge / 1000)}s)`);
        }
      }

      // Fetch fresh data
      console.log(`Fetching fresh data for ${key}`);
      const data = await fetchFn();

      // Cache the results in Qdrant
      await this.set(key, data);

      return {
        data,
        cached: false,
        cacheAge: null
      };
    } catch (error) {
      console.error(`Error accessing Qdrant cache for ${key}:`, error);
      // Fallback to fetching fresh data if Qdrant fails
      const data = await fetchFn();
      return { data, cached: false, cacheAge: null };
    }
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
      await this.set(key, data);
      console.log(`Background cache update completed for ${key}`);
    } catch (error) {
      console.error(`Background cache update failed for ${key}:`, error);
    } finally {
      this.ongoingUpdates.delete(key);
    }
  }

  /**
   * Manually set cache entry in Qdrant
   */
  async set(key: string, data: T): Promise<void> {
    // Skip in browser
    if (typeof window !== 'undefined') return;

    try {
      await ensureCacheCollection();

      // Serialize data to JSON string for storage
      const serializedData = JSON.stringify(data);

      const entry = {
        data: serializedData,
        timestamp: Date.now(),
        key
      };

      const vector = generateCacheEmbedding(key);
      const pointId = crypto.randomUUID();

      await qdrantClient.upsert(CACHE_COLLECTION, {
        wait: true,
        points: [{
          id: pointId,
          vector,
          payload: entry
        }]
      });
    } catch (error) {
      console.error(`Error setting cache in Qdrant for ${key}:`, error);
      // Don't throw - caching failures shouldn't break the application
    }
  }

  /**
   * Clear specific cache entry from Qdrant
   */
  async delete(key: string): Promise<void> {
    // Skip in browser
    if (typeof window !== 'undefined') return;

    try {
      await ensureCacheCollection();

      await qdrantClient.delete(CACHE_COLLECTION, {
        wait: true,
        filter: {
          must: [{ key: 'key', match: { value: key } }]
        }
      });
    } catch (error) {
      console.error(`Error deleting cache from Qdrant for ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries from Qdrant
   */
  async clear(): Promise<void> {
    // Skip in browser
    if (typeof window !== 'undefined') return;

    try {
      await ensureCacheCollection();

      // Delete entire collection and recreate
      await qdrantClient.deleteCollection(CACHE_COLLECTION);
      collectionInitialized = false;
      await ensureCacheCollection();
    } catch (error) {
      console.error('Error clearing cache from Qdrant:', error);
    }
  }

  /**
   * Get cache statistics from Qdrant
   */
  async getStats(): Promise<{ size: number; ongoingUpdates: number }> {
    // Skip in browser
    if (typeof window !== 'undefined') {
      return { size: 0, ongoingUpdates: 0 };
    }

    try {
      await ensureCacheCollection();

      const countResult = await qdrantClient.count(CACHE_COLLECTION);

      return {
        size: countResult.count,
        ongoingUpdates: this.ongoingUpdates.size
      };
    } catch (error) {
      console.error('Error getting cache stats from Qdrant:', error);
      return { size: 0, ongoingUpdates: 0 };
    }
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
