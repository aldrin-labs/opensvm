/**
 * Advanced Caching Middleware for OpenSVM API Routes
 * 
 * Provides intelligent caching with cache-first strategies, invalidation,
 * and performance monitoring for blockchain analytics endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiCache, analyticsCache, blockchainCache } from '@/lib/cache/redis-compatible-cache';

export interface CacheConfig {
  ttl?: number;
  cacheKeyGenerator?: (req: NextRequest) => string;
  shouldCache?: (req: NextRequest, res: NextResponse) => boolean;
  tags?: string[];
  namespace?: 'api' | 'analytics' | 'blockchain';
  bypassParam?: string;
  enableDebug?: boolean;
}

export interface CacheMiddlewareOptions extends CacheConfig {
  forceRefreshParam?: string;
  varyHeaders?: string[];
  etag?: boolean;
}

/**
 * Cache middleware factory for API routes
 */
export function createCacheMiddleware(config: CacheMiddlewareOptions = {}) {
  const {
    ttl = 30 * 60 * 1000, // 30 minutes default
    cacheKeyGenerator,
    shouldCache,
    tags = [],
    namespace = 'api',
    bypassParam = 'cache_bypass',
    forceRefreshParam = 'force_refresh',
    varyHeaders = [],
    etag = true,
    enableDebug = false
  } = config;

  // Select appropriate cache based on namespace
  const cache = namespace === 'analytics' ? analyticsCache : 
                namespace === 'blockchain' ? blockchainCache : apiCache;

  return async function cacheMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = cacheKeyGenerator ? 
      cacheKeyGenerator(req) : 
      generateDefaultCacheKey(req);

    // Check for cache bypass parameters
    const url = new URL(req.url);
    const shouldBypass = url.searchParams.has(bypassParam);
    const shouldForceRefresh = url.searchParams.has(forceRefreshParam);

    let cached: any = null;
    let cacheHit = false;

    // Try to get from cache if not bypassing
    if (!shouldBypass && !shouldForceRefresh) {
      cached = await cache.get(cacheKey);
      if (cached) {
        cacheHit = true;
        
        // Create response with cached data
        const response = new NextResponse(JSON.stringify(cached.data), {
          status: cached.status || 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000).toString(),
            'Cache-Control': `max-age=${Math.floor(cached.ttl / 1000)}`,
            ...(cached.headers || {})
          }
        });

        // Add debug headers if enabled
        if (enableDebug) {
          response.headers.set('X-Cache-Debug', JSON.stringify({
            hit: true,
            key: cacheKey,
            age: Date.now() - cached.timestamp,
            namespace
          }));
        }

        // Log cache hit
        if (enableDebug) {
          console.log(`Cache HIT: ${cacheKey} (${Date.now() - startTime}ms)`);
        }

        return response;
      }
    }

    // Execute the handler if cache miss or bypass
    try {
      const response = await handler(req);
      
      // Clone response to read data
      const responseClone = response.clone();
      const responseData = await responseClone.json();

      // Check if we should cache this response
      const shouldCacheResponse = shouldCache ? 
        shouldCache(req, response) : 
        response.status === 200;

      // Cache successful responses
      if (shouldCacheResponse && !shouldBypass) {
        const cacheData = {
          data: responseData,
          status: response.status,
          timestamp: Date.now(),
          ttl,
          headers: extractCacheableHeaders(response, varyHeaders)
        };

        await cache.set(cacheKey, cacheData, ttl, tags);
        
        if (enableDebug) {
          console.log(`Cache SET: ${cacheKey} (${Date.now() - startTime}ms)`);
        }
      }

      // Add cache headers to response
      const newResponse = new NextResponse(JSON.stringify(responseData), {
        status: response.status,
        headers: response.headers
      });

      newResponse.headers.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
      newResponse.headers.set('X-Cache-Key', cacheKey);
      newResponse.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
      
      if (!cacheHit && shouldCacheResponse) {
        newResponse.headers.set('Cache-Control', `max-age=${Math.floor(ttl / 1000)}`);
      }

      // Add ETag if enabled
      if (etag && shouldCacheResponse) {
        const hash = generateETag(responseData);
        newResponse.headers.set('ETag', hash);
      }

      // Add debug headers if enabled
      if (enableDebug) {
        newResponse.headers.set('X-Cache-Debug', JSON.stringify({
          hit: cacheHit,
          key: cacheKey,
          cached: shouldCacheResponse && !shouldBypass,
          responseTime: Date.now() - startTime,
          namespace
        }));
      }

      return newResponse;

    } catch (error) {
      console.error('Cache middleware error:', error);
      
      // Return original handler response on error
      const response = await handler(req);
      response.headers.set('X-Cache', 'ERROR');
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
      
      return response;
    }
  };
}

/**
 * Generate default cache key from request
 */
function generateDefaultCacheKey(req: NextRequest): string {
  const url = new URL(req.url);
  const path = url.pathname;
  const query = url.searchParams.toString();
  const method = req.method;
  
  return `${method}:${path}${query ? `?${query}` : ''}`;
}

/**
 * Extract cacheable headers from response
 */
function extractCacheableHeaders(response: NextResponse, varyHeaders: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  
  for (const header of varyHeaders) {
    const value = response.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  }
  
  return headers;
}

/**
 * Generate ETag from response data
 */
function generateETag(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `"${Math.abs(hash).toString(36)}"`;
}

/**
 * Predefined cache configurations for common endpoints
 */
export const CACHE_CONFIGS = {
  // Network statistics - high frequency updates
  NETWORK_STATS: {
    ttl: 5 * 60 * 1000, // 5 minutes
    namespace: 'analytics' as const,
    tags: ['network', 'stats'],
    enableDebug: true
  },

  // Token analytics - medium frequency updates
  TOKEN_ANALYTICS: {
    ttl: 10 * 60 * 1000, // 10 minutes
    namespace: 'analytics' as const,
    tags: ['token', 'analytics'],
    enableDebug: true,
    cacheKeyGenerator: (req: NextRequest) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const mint = pathParts[pathParts.length - 1];
      return `token:analytics:${mint}:${url.searchParams.toString()}`;
    }
  },

  // Transaction data - immutable, long cache
  TRANSACTION_DATA: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    namespace: 'blockchain' as const,
    tags: ['transaction', 'immutable'],
    enableDebug: false,
    cacheKeyGenerator: (req: NextRequest) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const signature = pathParts[pathParts.length - 1];
      return `tx:${signature}`;
    }
  },

  // Block data - immutable, long cache
  BLOCK_DATA: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    namespace: 'blockchain' as const,
    tags: ['block', 'immutable'],
    enableDebug: false,
    cacheKeyGenerator: (req: NextRequest) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const slot = pathParts[pathParts.length - 1];
      return `block:${slot}`;
    }
  },

  // Account data - mutable, short cache
  ACCOUNT_DATA: {
    ttl: 5 * 60 * 1000, // 5 minutes
    namespace: 'api' as const,
    tags: ['account', 'mutable'],
    enableDebug: true,
    cacheKeyGenerator: (req: NextRequest) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const address = pathParts[pathParts.length - 1];
      return `account:${address}:${url.searchParams.toString()}`;
    }
  },

  // Search results - medium cache
  SEARCH_RESULTS: {
    ttl: 15 * 60 * 1000, // 15 minutes
    namespace: 'api' as const,
    tags: ['search'],
    enableDebug: true,
    cacheKeyGenerator: (req: NextRequest) => {
      const url = new URL(req.url);
      const query = url.searchParams.get('q') || '';
      const filters = Array.from(url.searchParams.entries())
        .filter(([key]) => key !== 'q')
        .sort()
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      return `search:${encodeURIComponent(query)}:${filters}`;
    }
  },

  // Program data - semi-immutable
  PROGRAM_DATA: {
    ttl: 30 * 60 * 1000, // 30 minutes
    namespace: 'api' as const,
    tags: ['program'],
    enableDebug: false,
    cacheKeyGenerator: (req: NextRequest) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const address = pathParts[pathParts.length - 1];
      return `program:${address}`;
    }
  }
} as const;

/**
 * Cache invalidation utilities
 */
export class CacheInvalidator {
  static async invalidateByPattern(pattern: string, namespace: 'api' | 'analytics' | 'blockchain' = 'api'): Promise<number> {
    const cache = namespace === 'analytics' ? analyticsCache : 
                  namespace === 'blockchain' ? blockchainCache : apiCache;
    
    const keys = await cache.keys(pattern);
    let invalidated = 0;
    
    for (const key of keys) {
      await cache.del(key);
      invalidated++;
    }
    
    return invalidated;
  }

  static async invalidateByTags(tags: string[], namespace: 'api' | 'analytics' | 'blockchain' = 'api'): Promise<number> {
    const cache = namespace === 'analytics' ? analyticsCache : 
                  namespace === 'blockchain' ? blockchainCache : apiCache;
    
    return cache.invalidateByTags(tags);
  }

  static async invalidateNetworkData(): Promise<void> {
    await Promise.all([
      this.invalidateByTags(['network', 'stats'], 'analytics'),
      this.invalidateByPattern('network:*', 'analytics')
    ]);
  }

  static async invalidateTokenData(mint?: string): Promise<void> {
    if (mint) {
      await Promise.all([
        this.invalidateByPattern(`token:*:${mint}*`, 'analytics'),
        this.invalidateByPattern(`token:analytics:${mint}*`, 'analytics')
      ]);
    } else {
      await this.invalidateByTags(['token', 'analytics'], 'analytics');
    }
  }

  static async invalidateAccountData(address?: string): Promise<void> {
    if (address) {
      await this.invalidateByPattern(`account:${address}*`, 'api');
    } else {
      await this.invalidateByTags(['account', 'mutable'], 'api');
    }
  }
}

/**
 * Wrapper function to easily apply cache middleware to API routes
 */
export function withCache(config: CacheMiddlewareOptions) {
  return function (handler: (req: NextRequest) => Promise<NextResponse>) {
    const middleware = createCacheMiddleware(config);
    return (req: NextRequest) => middleware(req, handler);
  };
}