/**
 * MCP Webhook Events Stream API
 *
 * Real-time webhook event streaming via Server-Sent Events.
 * Subscribe to blockchain events for specified addresses.
 *
 * @module app/api/mcp/webhooks/stream
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WebhookEvent {
  type: string;
  timestamp: number;
  target: string;
  data: any;
}

/**
 * GET /api/mcp/webhooks/stream?targets=ADDR1,ADDR2&events=wallet.sol_received,token.large_transfer
 *
 * Stream webhook events in real-time
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targets = searchParams.get('targets')?.split(',').filter(Boolean) || [];
  const eventTypes = searchParams.get('events')?.split(',').filter(Boolean) || [
    'wallet.transaction',
    'wallet.sol_received',
    'wallet.sol_sent',
    'token.large_transfer',
  ];

  if (targets.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing targets parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventType: string, data: any) => {
        const event = [
          `event: ${eventType}`,
          `data: ${JSON.stringify(data)}`,
          '',
          '',
        ].join('\n');
        controller.enqueue(encoder.encode(event));
      };

      // Heartbeat
      const heartbeat = setInterval(() => {
        send('heartbeat', { streamId, timestamp: Date.now() });
      }, 15000);

      // Send subscription confirmation
      send('subscribed', {
        streamId,
        targets,
        eventTypes,
        timestamp: Date.now(),
      });

      try {
        // Simulate blockchain events
        let eventCount = 0;
        const maxEvents = 50; // Stop after 50 events for demo

        while (eventCount < maxEvents) {
          await sleep(2000 + Math.random() * 3000); // 2-5 seconds between events

          // Generate random event
          const target = targets[Math.floor(Math.random() * targets.length)];
          const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

          const event = generateEvent(eventType, target);
          send(eventType, event);

          eventCount++;
        }

        send('complete', {
          streamId,
          message: 'Stream completed (demo limit reached)',
          eventsDelivered: eventCount,
        });

      } catch (error) {
        send('error', {
          streamId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateEvent(eventType: string, target: string): WebhookEvent {
  const timestamp = Date.now();
  const signature = `sig_${timestamp}_${Math.random().toString(36).slice(2, 10)}`;

  switch (eventType) {
    case 'wallet.sol_received':
      return {
        type: eventType,
        timestamp,
        target,
        data: {
          signature,
          amount: Math.random() * 100,
          from: generateAddress(),
          slot: Math.floor(Math.random() * 1000000) + 250000000,
        },
      };

    case 'wallet.sol_sent':
      return {
        type: eventType,
        timestamp,
        target,
        data: {
          signature,
          amount: Math.random() * 50,
          to: generateAddress(),
          slot: Math.floor(Math.random() * 1000000) + 250000000,
        },
      };

    case 'wallet.token_received':
      return {
        type: eventType,
        timestamp,
        target,
        data: {
          signature,
          token: {
            symbol: ['USDC', 'BONK', 'JUP', 'RAY'][Math.floor(Math.random() * 4)],
            mint: generateAddress(),
          },
          amount: Math.random() * 10000,
          from: generateAddress(),
        },
      };

    case 'token.large_transfer':
      return {
        type: eventType,
        timestamp,
        target,
        data: {
          signature,
          token: {
            symbol: 'SOL',
            mint: 'So11111111111111111111111111111111111111112',
          },
          amount: 100 + Math.random() * 900,
          valueUsd: 10000 + Math.random() * 90000,
          from: generateAddress(),
          to: generateAddress(),
        },
      };

    case 'wallet.transaction':
    default:
      return {
        type: 'wallet.transaction',
        timestamp,
        target,
        data: {
          signature,
          type: ['transfer', 'swap', 'stake', 'nft_mint'][Math.floor(Math.random() * 4)],
          success: Math.random() > 0.05,
          fee: Math.floor(Math.random() * 10000),
          slot: Math.floor(Math.random() * 1000000) + 250000000,
        },
      };
  }
}

function generateAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
