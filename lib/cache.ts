import 'server-only';
import { Redis } from 'ioredis';

// Singleton Redis client
let redisClient: Redis | null = null;

// Cache configuration
const CACHE_CONFIG = {
  validators: {
    ttl: 300, // 5 minutes
    key: 'validators:data'
  },
  slots: {
    ttl: 30, // 30 seconds
    key: 'slots:data'
  },
  blocks: {
    ttl: 60, // 1 minute
    key: 'blocks'
  },
  transactions: {
    ttl: 300, // 5 minutes
    key: 'tx'
  },
  aiResponses: {
    ttl: 3600, // 1 hour
    key: 'ai'
  },
  rpcResponses: {
    ttl: 10, // 10 seconds for volatile data
    key: 'rpc'
  }
} as const;

// Initialize Redis connection
export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.log('Redis URL not configured, caching disabled');
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableOfflineQueue: false,
        lazyConnect: true
      });

      redisClient.on('error', (err: Error) => {
        console.error('Redis connection error:', err);
      });

      redisClient.on('connect', () => {
        console.log('Redis connected successfully');
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      return null;
    }
  }

  return redisClient;
}

// Generic cache operations
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const data = await client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, serialized);
      } else {
        await client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },

  async flush(): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.flushdb();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }
};

// Specialized cache functions for different data types
export const validatorsCache = {
  async get() {
    return cache.get(`${CACHE_CONFIG.validators.key}`);
  },
  
  async set(data: any) {
    return cache.set(
      `${CACHE_CONFIG.validators.key}`,
      data,
      CACHE_CONFIG.validators.ttl
    );
  },
  
  async invalidate() {
    return cache.del(`${CACHE_CONFIG.validators.key}`);
  }
};

export const slotsCache = {
  async get(slot?: number) {
    const key = slot ? `${CACHE_CONFIG.slots.key}:${slot}` : CACHE_CONFIG.slots.key;
    return cache.get(key);
  },
  
  async set(data: any, slot?: number) {
    const key = slot ? `${CACHE_CONFIG.slots.key}:${slot}` : CACHE_CONFIG.slots.key;
    return cache.set(key, data, CACHE_CONFIG.slots.ttl);
  },
  
  async invalidate(slot?: number) {
    const key = slot ? `${CACHE_CONFIG.slots.key}:${slot}` : CACHE_CONFIG.slots.key;
    return cache.del(key);
  }
};

export const blocksCache = {
  async get(blockNumber: number) {
    return cache.get(`${CACHE_CONFIG.blocks.key}:${blockNumber}`);
  },
  
  async set(blockNumber: number, data: any) {
    return cache.set(
      `${CACHE_CONFIG.blocks.key}:${blockNumber}`,
      data,
      CACHE_CONFIG.blocks.ttl
    );
  }
};

export const transactionCache = {
  async get(signature: string) {
    return cache.get(`${CACHE_CONFIG.transactions.key}:${signature}`);
  },
  
  async set(signature: string, data: any) {
    return cache.set(
      `${CACHE_CONFIG.transactions.key}:${signature}`,
      data,
      CACHE_CONFIG.transactions.ttl
    );
  }
};

export const aiCache = {
  async get(questionHash: string) {
    return cache.get(`${CACHE_CONFIG.aiResponses.key}:${questionHash}`);
  },
  
  async set(questionHash: string, response: any) {
    return cache.set(
      `${CACHE_CONFIG.aiResponses.key}:${questionHash}`,
      response,
      CACHE_CONFIG.aiResponses.ttl
    );
  }
};

// Helper to create cache key from object
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
    if (params[key] !== undefined && params[key] !== null) {
      acc[key] = params[key];
    }
    return acc;
  }, {} as Record<string, any>);
  
  return `${prefix}:${JSON.stringify(sortedParams)}`;
}

// Decorator for caching async functions
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyPrefix: string,
  ttlSeconds: number
): T {
  return (async (...args: any[]) => {
    const cacheKey = createCacheKey(keyPrefix, { args });
    
    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${keyPrefix}`);
      return cached;
    }
    
    // If not in cache, execute function
    console.log(`Cache miss for ${keyPrefix}`);
    const result = await fn(...args);
    
    // Store in cache
    await cache.set(cacheKey, result, ttlSeconds);
    
    return result;
  }) as T;
}
