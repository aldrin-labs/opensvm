/**
 * System metrics and performance data
 */

import { NextRequest, NextResponse } from 'next/server';
import { tieredRateLimiter } from '@/lib/api/rate-limiter-tiers';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET(req: NextRequest) {
  // Check rate limit for admin tier
  const rateLimitResult = await tieredRateLimiter.checkLimit(req, 'admin');
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    );
  }

  // Check for API key (simplified auth check)
  const apiKey = req.headers.get('x-api-key');
  const isAuthenticated = apiKey && apiKey.length > 10; // Simple validation
  
  if (!isAuthenticated && !['health', 'status', 'version'].includes('metrics')) {
    return NextResponse.json(
      { error: 'Authentication required. Please provide x-api-key header.' },
      { status: 401 }
    );
  }

  // Return mock data for now
  return NextResponse.json({
    "cpu": {
      "usage": 45.2,
      "cores": 8
    },
    "memory": {
      "used": 2.4,
      "total": 16,
      "percentage": 15
    },
    "disk": {
      "used": 120,
      "total": 500,
      "percentage": 24
    },
    "network": {
      "in": 1234567,
      "out": 9876543
    },
    "timestamp": 1762094682510
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    }
  });
}

export async function POST(req: NextRequest) {
  // Check rate limit
  const rateLimitResult = await tieredRateLimiter.checkLimit(req, 'admin');
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // Check for API key
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Return success for POST requests
  return NextResponse.json({
    success: true,
    message: 'System metrics and performance data - POST endpoint',
    timestamp: Date.now()
  });
}
