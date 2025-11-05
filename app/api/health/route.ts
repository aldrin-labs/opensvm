/**
 * Health check endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { tieredRateLimiter } from '@/lib/rate-limiter-tiers';

export async function GET(req: NextRequest) {
  // Health check uses special tier with higher limits
  const rateLimitResult = await tieredRateLimiter.checkLimit(req, 'health');
  
  // Even if rate limited, return health status
  const headers: Record<string, string> = {};
  if (!rateLimitResult.allowed) {
    headers['X-RateLimit-Exceeded'] = 'true';
  }

  return NextResponse.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed / 1024 / 1024,
      total: process.memoryUsage().heapTotal / 1024 / 1024
    },
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0'
  }, {
    status: 200,
    headers
  });
}
