/**
 * Semantic Search API for Analytics Data
 * 
 * Provides semantic search capabilities for network statistics,
 * token analytics, and other blockchain data using Qdrant vector search.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCache, CACHE_CONFIGS } from '@/lib/cache/cache-middleware';
import { 
  searchNetworkStats, 
  searchTokenAnalytics, 
  getLatestNetworkStats,
  getTokenAnalyticsByMint 
} from '@/lib/qdrant-analytics';

interface SearchRequest {
  query: string;
  type: 'network' | 'token' | 'all';
  filters?: {
    timeRange?: { start: number; end: number };
    minValue?: number;
    maxValue?: number;
    limit?: number;
  };
}

interface SearchResponse {
  success: boolean;
  data: {
    networkStats?: any[];
    tokenAnalytics?: any[];
    totalResults: number;
    queryTime: number;
  };
  query: string;
  type: string;
  timestamp: number;
}

async function performSemanticSearch(searchParams: SearchRequest): Promise<any> {
  const startTime = Date.now();
  const { query, type, filters = {} } = searchParams;
  const { limit = 50, timeRange, minValue, maxValue } = filters;

  let networkStats: any[] = [];
  let tokenAnalytics: any[] = [];

  try {
    if (type === 'network' || type === 'all') {
      networkStats = await searchNetworkStats(query, {
        limit: Math.floor(limit / (type === 'all' ? 2 : 1)),
        timeRange,
        minTPS: minValue,
        maxTPS: maxValue
      });
    }

    if (type === 'token' || type === 'all') {
      tokenAnalytics = await searchTokenAnalytics(query, {
        limit: Math.floor(limit / (type === 'all' ? 2 : 1)),
        timeRange,
        minMarketCap: minValue,
        minVolume: maxValue
      });
    }

    return {
      networkStats,
      tokenAnalytics,
      totalResults: networkStats.length + tokenAnalytics.length,
      queryTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Semantic search error:', error);
    throw error;
  }
}

async function handleSemanticSearch(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type') as 'network' | 'token' | 'all' || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const startTime = url.searchParams.get('start_time');
    const endTime = url.searchParams.get('end_time');
    const minValue = url.searchParams.get('min_value');
    const maxValue = url.searchParams.get('max_value');

    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter "q" is required',
        timestamp: Date.now()
      }, { status: 400 });
    }

    // Prepare search parameters
    const searchParams: SearchRequest = {
      query,
      type,
      filters: {
        limit: Math.min(limit, 100), // Cap at 100 results
        ...(startTime && endTime && {
          timeRange: {
            start: parseInt(startTime),
            end: parseInt(endTime)
          }
        }),
        ...(minValue && { minValue: parseFloat(minValue) }),
        ...(maxValue && { maxValue: parseFloat(maxValue) })
      }
    };

    // Perform semantic search
    const searchResults = await performSemanticSearch(searchParams);

    const response: SearchResponse = {
      success: true,
      data: searchResults,
      query,
      type,
      timestamp: Date.now()
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Search-Type': type,
        'X-Results-Count': searchResults.totalResults.toString(),
        'X-Query-Time': `${searchResults.queryTime}ms`
      }
    });

  } catch (error) {
    console.error('Semantic search API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during semantic search',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// Export with caching middleware
export const GET = withCache({
  ttl: 5 * 60 * 1000, // 5 minutes cache
  namespace: 'analytics',
  tags: ['search', 'semantic'],
  enableDebug: true,
  cacheKeyGenerator: (req: NextRequest) => {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const type = url.searchParams.get('type') || 'all';
    const filters = Array.from(url.searchParams.entries())
      .filter(([key]) => !['q', 'type'].includes(key))
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `semantic-search:${encodeURIComponent(query)}:${type}:${filters}`;
  }
})(handleSemanticSearch);