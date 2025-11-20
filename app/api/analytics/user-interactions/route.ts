import { NextRequest, NextResponse } from 'next/server';
import { UserInteractionTracker } from '@/lib/analytics/user-interaction-tracker';
import logger from '@/lib/logging/logger';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { session, heatmapData } = await request.json();
    
    logger.info('User interaction session data received', {
      component: 'UserInteractionsRoute',
      metadata: {
        sessionId: session?.sessionId,
        interactions: session?.interactions?.length || 0,
        heatmapPoints: heatmapData?.length || 0,
        duration: session?.duration,
        pagesVisited: session?.performance?.pagesVisited
      }
    });

    // In a real implementation, this would:
    // 1. Validate the session data
    // 2. Store in analytics database
    // 3. Process for user behavior insights
    // 4. Update user journey analytics
    // 5. Feed into conversion funnel analysis

    // For now, we'll just log and acknowledge
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: 'User interaction data processed',
      sessionId: session?.sessionId,
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

    logger.error('Failed to process user interaction data', {
      component: 'UserInteractionsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process user interaction data',
        code: 'USER_INTERACTION_PROCESSING_FAILED'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('User interaction analytics requested', {
      component: 'UserInteractionsRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    const tracker = UserInteractionTracker.getInstance();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const type = searchParams.get('type') || 'summary';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const sessionId = searchParams.get('sessionId') || undefined;
    
    let data: any = {};

    switch (type) {
      case 'interactions':
        data.interactions = tracker.getInteractions(limit);
        break;
        
      case 'session':
        if (sessionId) {
          // In a real implementation, would fetch from database
          data.session = tracker.getCurrentSessionData();
        } else {
          data.session = tracker.getCurrentSessionData();
        }
        break;
        
      case 'heatmap':
        const heatmapType = searchParams.get('heatmapType') as any;
        data.heatmap = tracker.getHeatmapData(heatmapType);
        break;
        
      case 'flows':
        data.flows = tracker.getUserFlows();
        break;
        
      case 'config':
        data.config = tracker.getConfig();
        break;
        
      case 'summary':
      default:
        const currentSession = tracker.getCurrentSessionData();
        data = {
          currentSession: {
            sessionId: currentSession?.sessionId,
            startTime: currentSession?.startTime,
            interactions: currentSession?.interactions.length || 0,
            pagesVisited: currentSession?.performance.pagesVisited || 0,
            device: currentSession?.device
          },
          recentInteractions: tracker.getInteractions(10),
          heatmapPoints: tracker.getHeatmapData().length,
          userFlows: tracker.getUserFlows().slice(0, 5),
          config: {
            isTracking: tracker.getConfig().trackClicks, // Simple indicator
            sampleRate: tracker.getConfig().sampleRate,
            respectDoNotTrack: tracker.getConfig().respectDoNotTrack
          }
        };
        break;
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    logger.info('User interaction analytics generated', {
      component: 'UserInteractionsRoute',
      metadata: {
        type,
        processingTime,
        dataPoints: Array.isArray(data) ? data.length : Object.keys(data).length
      }
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        type,
        limit,
        sessionId,
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

    logger.error('Failed to generate user interaction analytics', {
      component: 'UserInteractionsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate user interaction analytics',
        code: 'USER_INTERACTION_ANALYTICS_ERROR',
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
    const { action, config } = await request.json();
    
    const tracker = UserInteractionTracker.getInstance();
    let result = { success: false, message: '' };

    switch (action) {
      case 'updateConfig':
        if (config) {
          tracker.updateConfig(config);
          result = { success: true, message: 'Configuration updated successfully' };
          
          logger.info('User interaction tracking config updated', {
            component: 'UserInteractionsRoute',
            metadata: { updatedConfig: config }
          });
        }
        break;
        
      case 'clearData':
        tracker.clearData();
        result = { success: true, message: 'User interaction data cleared successfully' };
        
        logger.info('User interaction data cleared', {
          component: 'UserInteractionsRoute'
        });
        break;
        
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Supported actions: updateConfig, clearData',
            code: 'INVALID_ACTION'
          },
          { status: 400 }
        );
    }
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return NextResponse.json({
      ...result,
      processingTime
    });

  } catch (error) {
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    logger.error('Failed to process user interaction action', {
      component: 'UserInteractionsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process user interaction action',
        code: 'USER_INTERACTION_ACTION_FAILED'
      },
      { status: 500 }
    );
  }
}

// Health check for the user interactions endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}