/**
 * API version information
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
  
  if (!isAuthenticated && !['health', 'status', 'version'].includes('version')) {
    return NextResponse.json(
      { error: 'Authentication required. Please provide x-api-key header.' },
      { status: 401 }
    );
  }

  // Return mock data for now
  return NextResponse.json({
    "version": "1.0.0",
    "build": "production",
    "commit": "abc123def",
    "timestamp": "2025-11-02T14:44:42.510Z"
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
    message: 'API version information - POST endpoint',
    timestamp: Date.now()
  });
}
