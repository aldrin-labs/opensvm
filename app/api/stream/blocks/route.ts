/**
 * Real-time block stream endpoint using SSE
 */

import { NextRequest } from 'next/server';
import { blockStreamManager } from '@/lib/sse-handler';
import { tieredRateLimiter } from '@/lib/rate-limiter-tiers';

// Extend global type for initialization tracking
declare global {
  var blockStreamInitialized: boolean | undefined;
}

export async function GET(req: NextRequest) {
  // Check rate limit for realtime tier
  const rateLimitResult = await tieredRateLimiter.checkLimit(req, 'realtime');
  
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded for real-time streams',
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

  // Create SSE stream
  return blockStreamManager.createSSEStream(req);
}

// Simulate block streaming
if (typeof globalThis !== 'undefined' && !globalThis.blockStreamInitialized) {
  globalThis.blockStreamInitialized = true;
  
  // Simulate new blocks every 10 seconds
  setInterval(() => {
    try {
      const mockBlock = {
        slot: Math.floor(Math.random() * 1000000) + 200000000,
        blockhash: Math.random().toString(36).substr(2, 15),
        parentSlot: Math.floor(Math.random() * 1000000) + 199999000,
        timestamp: Date.now(),
        transactionCount: Math.floor(Math.random() * 1000) + 100,
        rewards: Math.random() * 10,
        feeTotal: Math.random() * 5
      };
      
      // Broadcast to all connected clients
      blockStreamManager.broadcast(mockBlock, 'block');
    } catch (error) {
      // Silent fail for demo
    }
  }, 10000); // Every 10 seconds
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
    }
  });
}
