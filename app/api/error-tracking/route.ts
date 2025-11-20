import { NextRequest, NextResponse } from 'next/server';
import { ErrorBoundaryService } from '@/lib/error/error-boundary-service';
import logger from '@/lib/logging/logger';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const errorData = await request.json();
    
    logger.info('Error report received via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        errorId: errorData.id,
        severity: errorData.severity,
        category: errorData.category,
        component: errorData.context?.component,
        fingerprint: errorData.fingerprint
      }
    });

    // In a real implementation, this would:
    // 1. Validate the error data
    // 2. Send to external error tracking services (Sentry, LogRocket, etc.)
    // 3. Store in database for analytics
    // 4. Trigger alerts for critical errors
    // 5. Aggregate similar errors

    // For now, we'll just log and acknowledge
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: 'Error report received',
      errorId: errorData.id,
      processingTime
    }, {
      status: 201,
      headers: {
        'X-Processing-Time': processingTime.toFixed(2) + 'ms'
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to process error report', {
      component: 'ErrorTrackingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process error report',
        code: 'ERROR_TRACKING_FAILED'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('Error reports requested via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    const errorService = ErrorBoundaryService.getInstance();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const severity = searchParams.get('severity') as any;
    const category = searchParams.get('category') as any;
    const component = searchParams.get('component') || undefined;
    const resolved = searchParams.get('resolved') ? searchParams.get('resolved') === 'true' : undefined;
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const statsOnly = searchParams.get('stats') === 'true';
    const timeframe = parseInt(searchParams.get('timeframe') || '86400000', 10); // Default 24 hours

    if (statsOnly) {
      // Return only statistics
      const stats = errorService.getErrorStats(timeframe);
      
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
    
    // Get error reports
    const errors = errorService.getErrors({
      severity,
      category,
      component,
      resolved,
      since,
      limit
    });
    
    // Get statistics
    const stats = errorService.getErrorStats(timeframe);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    logger.info('Error reports generated via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        errorsCount: errors.length,
        timeframe,
        processingTime,
        filters: { severity, category, component, resolved }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        errors,
        stats,
        meta: {
          totalCount: errors.length,
          timeframe,
          filters: {
            severity,
            category,
            component,
            resolved,
            since,
            limit
          },
          generatedAt: Date.now(),
          processingTime
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Processing-Time': processingTime.toFixed(2) + 'ms',
        'X-Errors-Count': errors.length.toString()
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to generate error reports via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate error reports',
        code: 'ERROR_REPORTS_ERROR',
        details: process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : 'Unknown error'
        } : undefined
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { errorId, action } = await request.json();
    
    if (!errorId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error ID and action are required',
          code: 'MISSING_PARAMETERS'
        },
        { status: 400 }
      );
    }

    const errorService = ErrorBoundaryService.getInstance();
    let result = false;

    switch (action) {
      case 'resolve':
        result = errorService.resolveError(errorId);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Supported actions: resolve',
            code: 'INVALID_ACTION'
          },
          { status: 400 }
        );
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error not found',
          code: 'ERROR_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    logger.info(`Error ${action} action completed via API`, {
      component: 'ErrorTrackingRoute',
      metadata: {
        errorId,
        action,
        processingTime
      }
    });

    return NextResponse.json({
      success: true,
      message: `Error ${action} completed successfully`,
      errorId,
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to process error action via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process error action',
        code: 'ERROR_ACTION_FAILED'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('Error reports clear requested via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        userAgent: request.headers.get('user-agent')
      }
    });

    const errorService = ErrorBoundaryService.getInstance();
    const { searchParams } = new URL(request.url);
    const clearType = searchParams.get('type') || 'all';
    
    switch (clearType) {
      case 'resolved':
        errorService.clearResolvedErrors();
        logger.info('Resolved errors cleared via API', {
          component: 'ErrorTrackingRoute'
        });
        break;
      case 'all':
      default:
        errorService.clearErrors();
        logger.info('All errors cleared via API', {
          component: 'ErrorTrackingRoute'
        });
        break;
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: `${clearType === 'all' ? 'All errors' : 'Resolved errors'} cleared successfully`,
      clearedAt: Date.now(),
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to clear error reports via API', {
      component: 'ErrorTrackingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear error reports',
        code: 'ERROR_CLEAR_FAILED'
      },
      { status: 500 }
    );
  }
}

// Health check for the error tracking endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}