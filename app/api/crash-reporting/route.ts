import { NextRequest, NextResponse } from 'next/server';
import { CrashReporter } from '@/lib/crash/crash-reporter';
import logger from '@/lib/logging/logger';

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const crashData = await request.json();
    
    logger.info('Crash report received', {
      component: 'CrashReportingRoute',
      metadata: {
        crashId: crashData.id,
        type: crashData.type,
        severity: crashData.severity,
        fingerprint: crashData.fingerprint,
        component: crashData.context?.component
      }
    });

    // In a real implementation, this would:
    // 1. Validate the crash data
    // 2. Store in database for analytics
    // 3. Send to external crash reporting services (Sentry, Bugsnag, etc.)
    // 4. Trigger alerts for critical crashes
    // 5. Update crash aggregations
    // 6. Notify development team if needed

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: 'Crash report processed',
      crashId: crashData.id,
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

    logger.error('Failed to process crash report', {
      component: 'CrashReportingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process crash report',
        code: 'CRASH_PROCESSING_FAILED'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('Crash reports requested', {
      component: 'CrashReportingRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    const crashReporter = CrashReporter.getInstance();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const type = searchParams.get('type') as any;
    const severity = searchParams.get('severity') as any;
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const aggregated = searchParams.get('aggregated') === 'true';
    const crashId = searchParams.get('crashId');
    const fingerprint = searchParams.get('fingerprint');

    let data: any = {};

    if (crashId) {
      // Get specific crash
      data.crash = crashReporter.getCrashById(crashId);
      if (!data.crash) {
        return NextResponse.json(
          {
            success: false,
            error: 'Crash not found',
            code: 'CRASH_NOT_FOUND'
          },
          { status: 404 }
        );
      }
    } else if (fingerprint) {
      // Get specific aggregation
      data.aggregation = crashReporter.getAggregationByFingerprint(fingerprint);
      if (!data.aggregation) {
        return NextResponse.json(
          {
            success: false,
            error: 'Aggregation not found',
            code: 'AGGREGATION_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      // Convert Set to Array for JSON serialization
      data.aggregation = {
        ...data.aggregation,
        uniqueUsers: Array.from(data.aggregation.uniqueUsers)
      };
    } else if (aggregated) {
      // Get crash aggregations
      data.aggregations = crashReporter.getAggregations().map(agg => ({
        ...agg,
        uniqueUsers: Array.from(agg.uniqueUsers),
        crashes: agg.crashes.slice(0, 5) // Only include first 5 crashes per aggregation
      }));
    } else {
      // Get individual crashes
      data.crashes = crashReporter.getCrashes({ type, severity, since, limit });
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    logger.info('Crash reports generated', {
      component: 'CrashReportingRoute',
      metadata: {
        type,
        severity,
        limit,
        aggregated,
        processingTime,
        resultCount: data.crashes?.length || data.aggregations?.length || (data.crash ? 1 : 0)
      }
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        filters: { type, severity, since, limit, aggregated, crashId, fingerprint },
        generatedAt: Date.now(),
        processingTime
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Processing-Time': processingTime.toFixed(2) + 'ms'
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to generate crash reports', {
      component: 'CrashReportingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate crash reports',
        code: 'CRASH_REPORTS_ERROR',
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
    const { fingerprint, action, assignee, notes } = await request.json();
    
    if (!fingerprint || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Fingerprint and action are required',
          code: 'MISSING_PARAMETERS'
        },
        { status: 400 }
      );
    }

    const crashReporter = CrashReporter.getInstance();
    let result = false;

    switch (action) {
      case 'resolve':
        result = crashReporter.resolveAggregation(fingerprint, assignee, notes);
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
          error: 'Aggregation not found',
          code: 'AGGREGATION_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    logger.info(`Crash aggregation ${action} completed`, {
      component: 'CrashReportingRoute',
      metadata: {
        fingerprint,
        action,
        assignee,
        processingTime
      }
    });

    return NextResponse.json({
      success: true,
      message: `Crash aggregation ${action} completed successfully`,
      fingerprint,
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to process crash action', {
      component: 'CrashReportingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process crash action',
        code: 'CRASH_ACTION_FAILED'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('Crash data clear requested', {
      component: 'CrashReportingRoute',
      metadata: {
        userAgent: request.headers.get('user-agent')
      }
    });

    const crashReporter = CrashReporter.getInstance();
    crashReporter.clearCrashes();
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.info('Crash data cleared', {
      component: 'CrashReportingRoute',
      metadata: { processingTime }
    });

    return NextResponse.json({
      success: true,
      message: 'Crash data cleared successfully',
      clearedAt: Date.now(),
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to clear crash data', {
      component: 'CrashReportingRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear crash data',
        code: 'CRASH_CLEAR_FAILED'
      },
      { status: 500 }
    );
  }
}

// Health check for the crash reporting endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}