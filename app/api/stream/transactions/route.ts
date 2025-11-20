/**
 * Real-time transaction stream endpoint using SSE
 */

import { NextRequest } from 'next/server';
import { transactionStreamManager } from '@/lib/api/sse-handler';
import { tieredRateLimiter } from '@/lib/api/rate-limiter-tiers';
import { getConnection } from '@/lib/solana/solana-connection-server';

// Extend global type for initialization tracking
declare global {
  // eslint-disable-next-line no-var
  var transactionStreamInitialized: boolean | undefined;
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
  return transactionStreamManager.createSSEStream(req);
}

// Simulate transaction streaming (in production, this would connect to real Solana websocket)
if (typeof globalThis !== 'undefined' && !globalThis.transactionStreamInitialized) {
  globalThis.transactionStreamInitialized = true;
  
  // Simulate transactions every few seconds
  setInterval(async () => {
    try {
      // For demo, just send mock transactions
      const mockTransaction = {
        signature: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        slot: Math.floor(Math.random() * 1000000) + 200000000,
        timestamp: Date.now(),
        type: ['transfer', 'swap', 'stake', 'unstake'][Math.floor(Math.random() * 4)],
        amount: Math.random() * 100,
        from: `${Math.random().toString(36).substr(2, 8)}...${Math.random().toString(36).substr(2, 4)}`,
        to: `${Math.random().toString(36).substr(2, 8)}...${Math.random().toString(36).substr(2, 4)}`,
        fee: Math.random() * 0.01
      };
      
      // Broadcast to all connected clients
      transactionStreamManager.broadcast(mockTransaction, 'transaction');
    } catch (error) {
      // Silent fail for demo
    }
  }, 5000); // Every 5 seconds
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
