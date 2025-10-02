import { NextRequest, NextResponse } from 'next/server';
import { HealthChecker } from '@/lib/anthropic-proxy/health/HealthChecker';

// Create a singleton health checker instance
const healthChecker = new HealthChecker(60000); // Check every 60 seconds

/**
 * GET /api/health/anthropic
 * Returns health status of Anthropic API backends (OpenRouter and direct Anthropic)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const backend = searchParams.get('backend');
    const useCache = searchParams.get('cache') !== 'false';

    // If specific backend requested
    if (backend) {
      // Check if cached result is fresh
      if (useCache && healthChecker.isCacheFresh(backend)) {
        const cached = healthChecker.getCachedHealth(backend);
        if (cached) {
          return NextResponse.json({
            cached: true,
            ...cached,
          });
        }
      }

      // Perform fresh check
      let result;
      if (backend === 'openrouter') {
        result = await healthChecker.checkOpenRouterHealth();
      } else if (backend === 'anthropic') {
        result = await healthChecker.checkAnthropicHealth();
      } else {
        return NextResponse.json(
          { error: 'Invalid backend. Use "openrouter" or "anthropic"' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        cached: false,
        ...result,
      });
    }

    // Return all backend health status
    const results = await healthChecker.getAllHealthStatus();
    
    return NextResponse.json({
      backends: results,
      timestamp: new Date(),
      allHealthy: results.every(r => r.isHealthy),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
