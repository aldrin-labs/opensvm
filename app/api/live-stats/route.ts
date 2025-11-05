/**
 * Real-time blockchain statistics
 */

import { NextRequest } from 'next/server';
import { tieredRateLimiter } from '@/lib/rate-limiter-tiers';
import { createSimpleSSEResponse } from '@/lib/sse-handler';

export async function GET(req: NextRequest) {
  // Check rate limit for realtime tier
  const rateLimitResult = await tieredRateLimiter.checkLimit(req, 'realtime');
  
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    );
  }

  // Return SSE stream for real-time data
  const isSSE = req.headers.get('accept')?.includes('text/event-stream');
  
  if (isSSE) {
    return createSimpleSSEResponse();
  }
  
  // Return JSON response for regular requests
  return new Response(
    JSON.stringify({
      status: 'active',
      endpoint: 'live-stats',
      description: 'Real-time blockchain statistics',
      connectionType: 'Server-Sent Events (SSE)',
      timestamp: Date.now()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
