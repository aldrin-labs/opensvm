import { NextRequest, NextResponse } from 'next/server';
import { APIMetricsCollector } from '@/lib/api/middleware';
import logger from '@/lib/logging/logger';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('API monitoring metrics requested', {
      component: 'APIMonitoringRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    const collector = APIMetricsCollector.getInstance();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const timeframe = parseInt(searchParams.get('timeframe') || '3600000', 10); // Default 1 hour
    const endpoint = searchParams.get('endpoint') || undefined;
    const method = searchParams.get('method') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    
    // Get metrics and stats
    const metrics = collector.getMetrics({ 
      endpoint, 
      method, 
      since: Date.now() - timeframe,
      limit 
    });
    
    const performanceStats = collector.getPerformanceStats(timeframe);
    const cacheStats = collector.getCacheStats();
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    logger.info('API monitoring metrics generated', {
      component: 'APIMonitoringRoute',
      metadata: {
        metricsCount: metrics.length,
        timeframe,
        processingTime,
        endpoint,
        method
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        performance: {
          ...performanceStats,
          timeframe,
          generatedAt: Date.now(),
          processingTime
        },
        cache: cacheStats,
        summary: {
          totalRequests: metrics.length,
          timeframeHours: timeframe / (1000 * 60 * 60),
          averageResponseTime: performanceStats.avgResponseTime,
          errorRate: performanceStats.errorRate,
          cacheHitRate: performanceStats.cacheHitRate,
          mostActiveEndpoints: performanceStats.slowestEndpoints.slice(0, 5)
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Processing-Time': processingTime.toFixed(2) + 'ms',
        'X-Metrics-Count': metrics.length.toString()
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to generate API monitoring metrics', {
      component: 'APIMonitoringRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate API monitoring metrics',
        code: 'API_MONITORING_ERROR',
        details: process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : 'Unknown error'
        } : undefined
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('API monitoring data clear requested', {
      component: 'APIMonitoringRoute',
      metadata: {
        userAgent: request.headers.get('user-agent')
      }
    });

    const collector = APIMetricsCollector.getInstance();
    const { searchParams } = new URL(request.url);
    const clearType = searchParams.get('type') || 'all';
    
    switch (clearType) {
      case 'metrics':
        collector.clearMetrics();
        logger.info('API metrics cleared via API', {
          component: 'APIMonitoringRoute'
        });
        break;
      case 'cache':
        collector.clearCache();
        logger.info('API cache cleared via API', {
          component: 'APIMonitoringRoute'
        });
        break;
      case 'all':
      default:
        collector.clearMetrics();
        collector.clearCache();
        logger.info('All API monitoring data cleared via API', {
          component: 'APIMonitoringRoute'
        });
        break;
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: `${clearType === 'all' ? 'All data' : clearType} cleared successfully`,
      clearedAt: Date.now(),
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to clear API monitoring data', {
      component: 'APIMonitoringRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear API monitoring data',
        code: 'API_MONITORING_CLEAR_ERROR'
      },
      { status: 500 }
    );
  }
}

// Health check for the monitoring endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}