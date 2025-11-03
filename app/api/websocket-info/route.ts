/**
 * WebSocket info endpoint
 * Returns SSE stream connection info
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

  // Return SSE info or create SSE stream
  const isSSE = req.headers.get('accept')?.includes('text/event-stream');
  
  if (isSSE) {
    return createSimpleSSEResponse();
  }
  
  // Return WebSocket/SSE connection info
  return new Response(
    JSON.stringify({
      status: 'available',
      endpoints: {
        transactions: '/api/stream/transactions',
        blocks: '/api/stream/blocks',
        notifications: '/api/notifications',
        alerts: '/api/alerts'
      },
      connectionType: 'Server-Sent Events (SSE)',
      maxConnections: 5,
      rateLimit: {
        tier: 'realtime',
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      }
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
