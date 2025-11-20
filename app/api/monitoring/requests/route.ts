import { NextRequest, NextResponse } from 'next/server';
import { RequestResponseLogger } from '@/lib/api/request-logger';
import logger from '@/lib/logging/logger';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('Request/Response logs requested', {
      component: 'RequestLogsRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    const requestLogger = RequestResponseLogger.getInstance();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : undefined;
    const method = searchParams.get('method') || undefined;
    const status = searchParams.get('status') ? parseInt(searchParams.get('status')!, 10) : undefined;
    const path = searchParams.get('path') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;
    const completedOnly = searchParams.get('completedOnly') === 'true';
    const statsOnly = searchParams.get('stats') === 'true';
    const timeframe = parseInt(searchParams.get('timeframe') || '3600000', 10); // Default 1 hour
    
    if (statsOnly) {
      // Return only statistics
      const stats = requestLogger.getStats(timeframe);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      return NextResponse.json({
        success: true,
        data: {
          stats,
          timeframe,
          generatedAt: Date.now(),
          processingTime
        }
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Processing-Time': processingTime.toFixed(2) + 'ms'
        }
      });
    }
    
    // Get request/response logs
    const logs = requestLogger.getLogs({
      limit,
      since,
      method,
      status,
      path,
      userId,
      sessionId,
      completedOnly
    });
    
    // Get statistics
    const stats = requestLogger.getStats(timeframe);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    logger.info('Request/Response logs generated', {
      component: 'RequestLogsRoute',
      metadata: {
        logsCount: logs.length,
        timeframe,
        processingTime,
        filters: { method, status, path, userId, sessionId, completedOnly }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        logs,
        stats,
        meta: {
          totalCount: logs.length,
          timeframe,
          filters: {
            limit,
            since,
            method,
            status,
            path,
            userId,
            sessionId,
            completedOnly
          },
          generatedAt: Date.now(),
          processingTime
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Processing-Time': processingTime.toFixed(2) + 'ms',
        'X-Logs-Count': logs.length.toString()
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to generate request/response logs', {
      component: 'RequestLogsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate request/response logs',
        code: 'REQUEST_LOGS_ERROR',
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
    logger.info('Request/Response logs clear requested', {
      component: 'RequestLogsRoute',
      metadata: {
        userAgent: request.headers.get('user-agent')
      }
    });

    const requestLogger = RequestResponseLogger.getInstance();
    requestLogger.clearLogs();
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.info('Request/Response logs cleared', {
      component: 'RequestLogsRoute',
      metadata: { processingTime }
    });

    return NextResponse.json({
      success: true,
      message: 'Request/Response logs cleared successfully',
      clearedAt: Date.now(),
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to clear request/response logs', {
      component: 'RequestLogsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear request/response logs',
        code: 'REQUEST_LOGS_CLEAR_ERROR'
      },
      { status: 500 }
    );
  }
}

// Get specific log by ID
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { requestId } = await request.json();
    
    if (!requestId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request ID is required',
          code: 'MISSING_REQUEST_ID'
        },
        { status: 400 }
      );
    }

    const requestLogger = RequestResponseLogger.getInstance();
    const log = requestLogger.getLogById(requestId);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    if (!log) {
      return NextResponse.json(
        {
          success: false,
          error: 'Log not found',
          code: 'LOG_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    logger.info('Specific request/response log retrieved', {
      component: 'RequestLogsRoute',
      metadata: {
        requestId,
        processingTime,
        completed: log.completed
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        log,
        meta: {
          requestId,
          generatedAt: Date.now(),
          processingTime
        }
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to retrieve specific request/response log', {
      component: 'RequestLogsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve log',
        code: 'LOG_RETRIEVAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Health check for the requests endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}