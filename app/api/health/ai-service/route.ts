import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


/**
 * AI Service Health Check Endpoint
 * 
 * This endpoint provides health status for the AI service including:
 * - Service availability
 * - Response time
 * - Recent error rates
 * - Circuit breaker status
 */

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    aiService: {
      available: boolean;
      responseTime?: number;
      error?: string;
    };
    dependencies: {
      openRouter: boolean;
      solanaRPC: boolean;
    };
  };
  metrics?: {
    uptime: number;
    requestCount: number;
    errorRate: string;
    averageResponseTime: number;
  };
}

// Simple in-memory metrics tracking
class HealthMetrics {
  private static startTime = Date.now();
  private static requestCount = 0;
  private static errorCount = 0;
  private static responseTimes: number[] = [];
  private static readonly MAX_RESPONSE_TIMES = 100;

  static recordRequest(responseTime: number, isError: boolean) {
    this.requestCount++;
    if (isError) this.errorCount++;
    
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.MAX_RESPONSE_TIMES) {
      this.responseTimes.shift();
    }
  }

  static getMetrics() {
    const uptime = Date.now() - this.startTime;
    const errorRate = this.requestCount > 0 
      ? ((this.errorCount / this.requestCount) * 100).toFixed(2)
      : '0.00';
    
    const averageResponseTime = this.responseTimes.length > 0
      ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
      : 0;

    return {
      uptime,
      requestCount: this.requestCount,
      errorRate,
      averageResponseTime
    };
  }

  static reset() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }
}

/**
 * Perform a lightweight health check on the AI service
 */
async function checkAIServiceHealth(): Promise<{
  available: boolean;
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
  const timeout = 5000; // 5 second timeout for health check

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Use a simple test question that should respond quickly
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/getAnswer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        question: 'Health check',
        _healthCheck: true // Flag to indicate this is a health check
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      HealthMetrics.recordRequest(responseTime, true);
      return {
        available: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    HealthMetrics.recordRequest(responseTime, false);
    return {
      available: true,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    HealthMetrics.recordRequest(responseTime, true);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      responseTime,
      error: errorMessage
    };
  }
}

/**
 * Check if required environment variables are configured
 */
function checkDependencies(): { openRouter: boolean; solanaRPC: boolean } {
  return {
    openRouter: !!process.env.OPENROUTER_API_KEY,
    solanaRPC: !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  };
}

/**
 * GET /api/health/ai-service
 * Returns health status of the AI service
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check dependencies first (fast)
    const dependencies = checkDependencies();

    // If critical dependencies are missing, return unhealthy immediately
    if (!dependencies.openRouter) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          aiService: {
            available: false,
            error: 'OpenRouter API key not configured'
          },
          dependencies
        }
      };

      return NextResponse.json(result, { status: 503 });
    }

    // Perform AI service health check
    const aiServiceCheck = await checkAIServiceHealth();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (aiServiceCheck.available && aiServiceCheck.responseTime! < 3000) {
      status = 'healthy';
    } else if (aiServiceCheck.available) {
      status = 'degraded'; // Available but slow
    } else {
      status = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        aiService: aiServiceCheck,
        dependencies
      },
      metrics: HealthMetrics.getMetrics()
    };

    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(result, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    const result: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        aiService: {
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        dependencies: checkDependencies()
      }
    };

    return NextResponse.json(result, { 
      status: 503,
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
  }
}

/**
 * POST /api/health/ai-service
 * Reset health metrics (for admin use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === 'reset') {
      HealthMetrics.reset();
      return NextResponse.json({ 
        success: true, 
        message: 'Health metrics reset' 
      });
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Unknown action' 
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
