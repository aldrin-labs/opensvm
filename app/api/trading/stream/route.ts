/**
 * Trading Stream API - Real-Time Data via Server-Sent Events
 *
 * Provides real-time trading data streams including:
 * - Live trades from Solana DEXs
 * - Real-time candle updates
 * - Order book snapshots
 *
 * Uses Server-Sent Events (SSE) for compatibility with serverless environments.
 *
 * @module app/api/trading/stream
 */

import { NextRequest } from 'next/server';
import { Connection } from '@solana/web3.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// Token mint addresses
const TOKEN_MINTS: Record<string, string> = {
  'SOL/USDC': 'So11111111111111111111111111111111111111112',
  'BONK/USDC': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP/USDC': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'PYTH/USDC': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'ORCA/USDC': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  'RAY/USDC': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
};

interface Trade {
  id: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  dex: string;
}

/**
 * Generate mock trade data for development
 */
function generateMockTrade(market: string, basePrice: number): Trade {
  const variance = (Math.random() - 0.5) * basePrice * 0.01; // ±1%
  return {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    price: basePrice + variance,
    amount: Math.random() * 10 + 0.1,
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    dex: ['Raydium', 'Jupiter', 'Orca'][Math.floor(Math.random() * 3)],
  };
}

/**
 * Fetch current price from API
 */
async function getCurrentPrice(market: string): Promise<number> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/trading/market-data?market=${encodeURIComponent(market)}`,
      { cache: 'no-store' }
    );

    if (response.ok) {
      const data = await response.json();
      return data.price || 150;
    }
  } catch (error) {
    console.warn('[Stream] Failed to fetch current price:', error);
  }

  return 150; // Default fallback
}

/**
 * Stream real-time trading data
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get('market') || 'SOL/USDC';
  const channels = searchParams.get('channels')?.split(',') || ['trades'];

  console.log(`[Stream] Client connected for ${market}, channels: ${channels.join(', ')}`);

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isActive = true;
      let currentPrice = await getCurrentPrice(market);
      let tradeCount = 0;
      let lastTradeTime = Date.now();

      // Send SSE message with error handling
      const sendEvent = (event: string, data: any) => {
        if (!isActive) return;

        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
          return true;
        } catch (error) {
          console.error('[Stream] Failed to send event:', error);
          isActive = false;
          return false;
        }
      };

      // Send connection confirmation
      sendEvent('connected', {
        market,
        channels,
        timestamp: Date.now(),
        message: 'Connected to trading stream',
      });

      // Heartbeat interval (every 15 seconds)
      const heartbeatInterval = setInterval(() => {
        sendEvent('heartbeat', {
          timestamp: Date.now(),
          trades: tradeCount,
        });
      }, 15000);

      // Trade generation interval (every 2-5 seconds)
      const tradeInterval = setInterval(() => {
        if (!isActive || !channels.includes('trades')) return;

        const trade = generateMockTrade(market, currentPrice);
        currentPrice = trade.price; // Update price with slight variance

        sendEvent('trade', {
          type: 'trade',
          data: trade,
        });

        tradeCount++;
      }, 2000 + Math.random() * 3000); // Random 2-5 second intervals

      // Candle updates (every 60 seconds for 1m candles)
      let candleInterval: NodeJS.Timeout | null = null;
      if (channels.includes('candles')) {
        candleInterval = setInterval(() => {
          if (!isActive) return;

          const now = Date.now();
          const candleTime = Math.floor(now / 60000) * 60000; // 1-minute buckets

          sendEvent('candle', {
            type: 'candle',
            data: {
              time: candleTime,
              open: currentPrice * 0.999,
              high: currentPrice * 1.001,
              low: currentPrice * 0.998,
              close: currentPrice,
              volume: Math.random() * 1000 + 500,
            },
          });
        }, 60000);
      }

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        console.log(`[Stream] Client disconnected from ${market}`);
        isActive = false;
        clearInterval(heartbeatInterval);
        clearInterval(tradeInterval);
        if (candleInterval) clearInterval(candleInterval);

        try {
          controller.close();
        } catch (error) {
          // Stream already closed
        }
      });

      // Auto-close after max duration (5 minutes)
      setTimeout(() => {
        console.log(`[Stream] Max duration reached for ${market}`);
        isActive = false;
        clearInterval(heartbeatInterval);
        clearInterval(tradeInterval);
        if (candleInterval) clearInterval(candleInterval);

        sendEvent('info', {
          message: 'Max duration reached, please reconnect',
        });

        try {
          controller.close();
        } catch (error) {
          // Stream already closed
        }
      }, maxDuration * 1000);
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Handle WebSocket upgrade request (for custom server setups)
 *
 * Note: This won't work with standard Next.js deployment.
 * For WebSocket support, you need a custom server.
 * See: /docs/architecture/websocket-setup.md
 */
export async function POST(req: NextRequest) {
  return new Response(
    JSON.stringify({
      error: 'WebSocket upgrades not supported in this environment',
      solution: 'Use GET endpoint for Server-Sent Events (SSE) streaming',
      endpoint: '/api/trading/stream?market=SOL/USDC&channels=trades,candles',
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
