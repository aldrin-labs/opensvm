import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logging/logger';
import PerformanceMonitor from '@/lib/performance/monitor';

interface APIMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  cached: boolean;
  userAgent?: string;
  ip?: string;
  timestamp: number;
  size?: number;
  error?: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
}

class APIMetricsCollector {
  private static instance: APIMetricsCollector;
  private metrics: APIMetrics[] = [];
  private cache = new Map<string, CacheEntry>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxMetrics = 10000; // Keep last 10k metrics
  private maxCacheSize = 1000; // Max 1000 cached entries

  static getInstance(): APIMetricsCollector {
    if (!APIMetricsCollector.instance) {
      APIMetricsCollector.instance = new APIMetricsCollector();
    }
    return APIMetricsCollector.instance;
  }

  private constructor() {
    // Clean up old metrics and cache entries periodically
    setInterval(() => {
      this.cleanupMetrics();
      this.cleanupCache();
    }, 60000); // Every minute
  }

  private cleanupMetrics(): void {
    if (this.metrics.length > this.maxMetrics) {
      const excess = this.metrics.length - this.maxMetrics;
      this.metrics.splice(0, excess);
    }

    // Remove metrics older than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // If cache is still too large, remove LRU entries
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries()).sort((a, b) => 
        a[1].lastAccessed - b[1].lastAccessed
      );
      
      const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private generateCacheKey(request: NextRequest): string {
    const url = new URL(request.url);
    const key = `${request.method}:${url.pathname}:${url.search}`;
    
    // Include user-specific data if needed
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `${key}:user:${userId}`;
    }
    
    return key;
  }

  private isCacheable(request: NextRequest, response: NextResponse): boolean {
    // Only cache GET requests
    if (request.method !== 'GET') return false;
    
    // Don't cache if response has errors
    if (response.status >= 400) return false;
    
    // Don't cache if explicitly disabled
    if (response.headers.get('cache-control')?.includes('no-cache')) return false;
    
    // Don't cache user-specific endpoints
    const url = new URL(request.url);
    if (url.pathname.includes('/user/') || url.pathname.includes('/account/')) return false;
    
    return true;
  }

  public async middleware(request: NextRequest, handler: () => Promise<NextResponse>): Promise<NextResponse> {
    const startTime = performance.now();
    const timestamp = Date.now();
    const endpoint = new URL(request.url).pathname;
    const method = request.method;
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    let cached = false;
    let response: NextResponse;
    
    if (method === 'GET') {
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry && (timestamp - cachedEntry.timestamp) < cachedEntry.ttl) {
        // Cache hit
        cached = true;
        cachedEntry.hitCount++;
        cachedEntry.lastAccessed = timestamp;
        
        response = NextResponse.json(cachedEntry.data, {
          status: 200,
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Timestamp': cachedEntry.timestamp.toString(),
            'X-Cache-TTL': cachedEntry.ttl.toString(),
            'X-Cache-Hit-Count': cachedEntry.hitCount.toString()
          }
        });
        
        logger.debug('API cache hit', {
          component: 'APIMetricsCollector',
          metadata: {
            endpoint,
            method,
            cacheKey,
            hitCount: cachedEntry.hitCount,
            age: timestamp - cachedEntry.timestamp
          }
        });
      }
    }
    
    if (!cached) {
      // Execute the actual handler
      try {
        response = await handler();
        
        // Cache successful GET responses
        if (this.isCacheable(request, response)) {
          try {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            
            // Determine TTL based on endpoint
            let ttl = this.defaultTTL;
            if (endpoint.includes('/block/') || endpoint.includes('/transaction/')) {
              ttl = 30 * 60 * 1000; // 30 minutes for block/transaction data
            } else if (endpoint.includes('/search/')) {
              ttl = 10 * 60 * 1000; // 10 minutes for search results
            }
            
            this.cache.set(cacheKey, {
              data,
              timestamp,
              ttl,
              hitCount: 0,
              lastAccessed: timestamp
            });
            
            // Add cache headers
            response.headers.set('X-Cache', 'MISS');
            response.headers.set('X-Cache-TTL', ttl.toString());
            
            logger.debug('API response cached', {
              component: 'APIMetricsCollector',
              metadata: {
                endpoint,
                method,
                cacheKey,
                ttl,
                dataSize: JSON.stringify(data).length
              }
            });
          } catch (error) {
            // Failed to cache (e.g., non-JSON response), continue without caching
            logger.debug('Failed to cache API response', {
              component: 'APIMetricsCollector',
              metadata: {
                endpoint,
                method,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            });
          }
        }
      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Record error metrics
        const errorMetric: APIMetrics = {
          endpoint,
          method,
          responseTime,
          statusCode: 500,
          cached: false,
          userAgent: request.headers.get('user-agent') || undefined,
          ip: this.getClientIP(request),
          timestamp,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        this.addMetric(errorMetric);
        
        logger.error('API handler error', {
          component: 'APIMetricsCollector',
          metadata: {
            endpoint,
            method,
            responseTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
        throw error;
      }
    }
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    // Calculate response size
    let size: number | undefined;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      size = parseInt(contentLength, 10);
    }
    
    // Record metrics
    const metric: APIMetrics = {
      endpoint,
      method,
      responseTime,
      statusCode: response.status,
      cached,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: this.getClientIP(request),
      timestamp,
      size
    };
    
    this.addMetric(metric);
    
    // Add performance headers
    response.headers.set('X-Response-Time', responseTime.toFixed(2) + 'ms');
    response.headers.set('X-Request-ID', `${timestamp}-${Math.random().toString(36).substr(2, 9)}`);
    
    // Log API request
    logger.apiRequest(method, endpoint, responseTime, response.status, {
      metadata: {
        cached,
        size,
        userAgent: request.headers.get('user-agent'),
        ip: this.getClientIP(request)
      }
    });
    
    // Track custom performance metric
    const performanceMonitor = PerformanceMonitor.getInstance();
    performanceMonitor.trackCustomMetric('api-response-time', responseTime, {
      endpoint,
      method,
      statusCode: response.status,
      cached
    });
    
    return response;
  }

  private getClientIP(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown'
    );
  }

  private addMetric(metric: APIMetrics): void {
    this.metrics.push(metric);
    
    // Trim metrics if too many
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  public getMetrics(options?: {
    endpoint?: string;
    method?: string;
    since?: number;
    limit?: number;
  }): APIMetrics[] {
    let filtered = [...this.metrics];
    
    if (options?.endpoint) {
      filtered = filtered.filter(m => m.endpoint.includes(options.endpoint!));
    }
    
    if (options?.method) {
      filtered = filtered.filter(m => m.method === options.method);
    }
    
    if (options?.since) {
      filtered = filtered.filter(m => m.timestamp >= options.since!);
    }
    
    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getPerformanceStats(timeframe: number = 3600000): { // Default 1 hour
    total: number;
    avgResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    slowestEndpoints: Array<{ endpoint: string; avgTime: number }>;
    statusCodes: Record<number, number>;
    methodDistribution: Record<string, number>;
  } {
    const since = Date.now() - timeframe;
    const recentMetrics = this.getMetrics({ since });
    
    if (recentMetrics.length === 0) {
      return {
        total: 0,
        avgResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        slowestEndpoints: [],
        statusCodes: {},
        methodDistribution: {}
      };
    }
    
    const total = recentMetrics.length;
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const avgResponseTime = totalTime / total;
    
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / total) * 100;
    
    const cachedCount = recentMetrics.filter(m => m.cached).length;
    const cacheHitRate = (cachedCount / total) * 100;
    
    // Group by endpoint for slowest analysis
    const endpointTimes: Record<string, number[]> = {};
    recentMetrics.forEach(m => {
      if (!endpointTimes[m.endpoint]) {
        endpointTimes[m.endpoint] = [];
      }
      endpointTimes[m.endpoint].push(m.responseTime);
    });
    
    const slowestEndpoints = Object.entries(endpointTimes)
      .map(([endpoint, times]) => ({
        endpoint,
        avgTime: times.reduce((sum, t) => sum + t, 0) / times.length
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);
    
    // Status code distribution
    const statusCodes: Record<number, number> = {};
    recentMetrics.forEach(m => {
      statusCodes[m.statusCode] = (statusCodes[m.statusCode] || 0) + 1;
    });
    
    // Method distribution
    const methodDistribution: Record<string, number> = {};
    recentMetrics.forEach(m => {
      methodDistribution[m.method] = (methodDistribution[m.method] || 0) + 1;
    });
    
    return {
      total,
      avgResponseTime,
      errorRate,
      cacheHitRate,
      slowestEndpoints,
      statusCodes,
      methodDistribution
    };
  }

  public getCacheStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    entries: Array<{
      key: string;
      hits: number;
      age: number;
      size: number;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hitCount,
      age: now - entry.timestamp,
      size: JSON.stringify(entry.data).length
    }));
    
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const totalRequests = this.metrics.filter(m => m.method === 'GET').length;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    return {
      size: this.cache.size,
      hitRate,
      totalHits,
      entries: entries.sort((a, b) => b.hits - a.hits)
    };
  }

  public clearCache(): void {
    this.cache.clear();
    logger.info('API cache cleared', {
      component: 'APIMetricsCollector'
    });
  }

  public clearMetrics(): void {
    this.metrics = [];
    logger.info('API metrics cleared', {
      component: 'APIMetricsCollector'
    });
  }
}

// Helper function to wrap API routes with monitoring
export function withAPIMetrics<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const collector = APIMetricsCollector.getInstance();
    return collector.middleware(request, () => handler(request, ...args));
  }) as T;
}

// Middleware for automatic monitoring (for use in middleware.ts)
export async function apiMetricsMiddleware(request: NextRequest): Promise<NextResponse | undefined> {
  // Only monitor API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return undefined;
  }
  
  // Skip monitoring for certain endpoints
  const skipPaths = ['/api/docs/', '/api/monitoring/', '/api/health'];
  if (skipPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return undefined;
  }
  
  const collector = APIMetricsCollector.getInstance();
  
  // This is a passthrough - the actual monitoring happens in withAPIMetrics wrapper
  // We just set up headers here for tracking
  const response = NextResponse.next();
  response.headers.set('X-API-Monitoring', 'true');
  
  return response;
}

export { APIMetricsCollector };
export default APIMetricsCollector;