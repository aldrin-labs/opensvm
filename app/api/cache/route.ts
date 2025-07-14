/**
 * Cache Management API
 * 
 * Provides endpoints for cache monitoring, statistics, and manual invalidation
 * for operational management and debugging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiCache, analyticsCache, blockchainCache } from '@/lib/cache/redis-compatible-cache';
import { CacheInvalidator } from '@/lib/cache/cache-middleware';

interface CacheStatsResponse {
  success: boolean;
  data: {
    api: any;
    analytics: any;
    blockchain: any;
    overall: {
      totalEntries: number;
      totalHitRate: number;
      totalMissRate: number;
      averageResponseTime: number;
    };
  };
  timestamp: number;
}

/**
 * GET /api/cache/stats - Get cache statistics
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';

    // Collect stats from all cache instances
    const [apiStats, analyticsStats, blockchainStats] = await Promise.all([
      apiCache.info(),
      analyticsCache.info(),
      blockchainCache.info()
    ]);

    // Calculate overall statistics
    const totalEntries = apiStats.totalEntries + analyticsStats.totalEntries + blockchainStats.totalEntries;
    const totalHits = apiStats.totalHits + analyticsStats.totalHits + blockchainStats.totalHits;
    const totalMisses = apiStats.totalMisses + analyticsStats.totalMisses + blockchainStats.totalMisses;
    const totalRequests = totalHits + totalMisses;

    const overall = {
      totalEntries,
      totalHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalMissRate: totalRequests > 0 ? totalMisses / totalRequests : 0,
      averageResponseTime: 0 // Could be enhanced with actual timing data
    };

    const response: CacheStatsResponse = {
      success: true,
      data: {
        api: apiStats,
        analytics: analyticsStats,
        blockchain: blockchainStats,
        overall
      },
      timestamp: Date.now()
    };

    // Support different response formats
    if (format === 'prometheus') {
      const prometheusMetrics = generatePrometheusMetrics(response.data);
      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Cache-Entries': totalEntries.toString(),
        'X-Cache-Hit-Rate': (overall.totalHitRate * 100).toFixed(2)
      }
    });

  } catch (error) {
    console.error('Cache stats error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve cache statistics',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

/**
 * POST /api/cache/invalidate - Invalidate cache entries
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { 
      pattern, 
      tags, 
      namespace = 'api', 
      type = 'pattern' 
    } = body;

    let invalidatedCount = 0;

    if (type === 'pattern' && pattern) {
      invalidatedCount = await CacheInvalidator.invalidateByPattern(pattern, namespace);
    } else if (type === 'tags' && tags) {
      invalidatedCount = await CacheInvalidator.invalidateByTags(tags, namespace);
    } else if (type === 'all') {
      // Invalidate all caches
      await Promise.all([
        apiCache.flushall(),
        analyticsCache.flushall(),
        blockchainCache.flushall()
      ]);
      invalidatedCount = -1; // Indicates full flush
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid invalidation request. Provide pattern, tags, or type=all',
        timestamp: Date.now()
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        invalidatedCount,
        pattern,
        tags,
        namespace,
        type
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Cache invalidation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to invalidate cache',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

/**
 * DELETE /api/cache/cleanup - Cleanup expired entries
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const namespace = url.searchParams.get('namespace') as 'api' | 'analytics' | 'blockchain';

    let cleanupResults: Array<{ namespace: string; cleaned: number }> = [];

    if (namespace) {
      // Cleanup specific namespace
      const cache = namespace === 'analytics' ? analyticsCache : 
                   namespace === 'blockchain' ? blockchainCache : apiCache;
      const cleaned = await cache.cleanup();
      cleanupResults.push({ namespace, cleaned });
    } else {
      // Cleanup all caches
      const [apiCleaned, analyticsCleaned, blockchainCleaned] = await Promise.all([
        apiCache.cleanup(),
        analyticsCache.cleanup(),
        blockchainCache.cleanup()
      ]);
      
      cleanupResults = [
        { namespace: 'api', cleaned: apiCleaned },
        { namespace: 'analytics', cleaned: analyticsCleaned },
        { namespace: 'blockchain', cleaned: blockchainCleaned }
      ];
    }

    const totalCleaned = cleanupResults.reduce((sum, result) => sum + result.cleaned, 0);

    return NextResponse.json({
      success: true,
      data: {
        totalCleaned,
        results: cleanupResults
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Cache cleanup error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup cache',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

/**
 * PUT /api/cache/warmup - Warmup cache with predefined data
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { items, namespace = 'api' } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: 'Items must be an array of cache entries',
        timestamp: Date.now()
      }, { status: 400 });
    }

    const cache = namespace === 'analytics' ? analyticsCache : 
                 namespace === 'blockchain' ? blockchainCache : apiCache;

    await cache.warmup(items);

    return NextResponse.json({
      success: true,
      data: {
        warmedUpCount: items.length,
        namespace
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Cache warmup error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to warmup cache',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

/**
 * Generate Prometheus-compatible metrics
 */
function generatePrometheusMetrics(data: any): string {
  const timestamp = Date.now();
  
  return `
# HELP opensvm_cache_entries_total Total number of cache entries
# TYPE opensvm_cache_entries_total gauge
opensvm_cache_entries_total{namespace="api"} ${data.api.totalEntries} ${timestamp}
opensvm_cache_entries_total{namespace="analytics"} ${data.analytics.totalEntries} ${timestamp}
opensvm_cache_entries_total{namespace="blockchain"} ${data.blockchain.totalEntries} ${timestamp}

# HELP opensvm_cache_hit_rate Cache hit rate percentage
# TYPE opensvm_cache_hit_rate gauge
opensvm_cache_hit_rate{namespace="api"} ${(data.api.hitRate * 100).toFixed(2)} ${timestamp}
opensvm_cache_hit_rate{namespace="analytics"} ${(data.analytics.hitRate * 100).toFixed(2)} ${timestamp}
opensvm_cache_hit_rate{namespace="blockchain"} ${(data.blockchain.hitRate * 100).toFixed(2)} ${timestamp}

# HELP opensvm_cache_memory_usage_bytes Memory usage in bytes
# TYPE opensvm_cache_memory_usage_bytes gauge
opensvm_cache_memory_usage_bytes{namespace="api"} ${data.api.memoryUsage} ${timestamp}
opensvm_cache_memory_usage_bytes{namespace="analytics"} ${data.analytics.memoryUsage} ${timestamp}
opensvm_cache_memory_usage_bytes{namespace="blockchain"} ${data.blockchain.memoryUsage} ${timestamp}

# HELP opensvm_cache_eviction_count Total cache evictions
# TYPE opensvm_cache_eviction_count counter
opensvm_cache_eviction_count{namespace="api"} ${data.api.evictionCount} ${timestamp}
opensvm_cache_eviction_count{namespace="analytics"} ${data.analytics.evictionCount} ${timestamp}
opensvm_cache_eviction_count{namespace="blockchain"} ${data.blockchain.evictionCount} ${timestamp}

# HELP opensvm_cache_overall_hit_rate Overall cache hit rate
# TYPE opensvm_cache_overall_hit_rate gauge
opensvm_cache_overall_hit_rate ${(data.overall.totalHitRate * 100).toFixed(2)} ${timestamp}
`.trim();
}