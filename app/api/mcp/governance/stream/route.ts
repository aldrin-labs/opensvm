/**
 * MCP Governance Event Streaming API
 *
 * Server-Sent Events (SSE) endpoint for real-time governance updates.
 *
 * GET /api/mcp/governance/stream - Subscribe to all events
 * GET /api/mcp/governance/stream?proposalId=xxx - Subscribe to specific proposal
 * GET /api/mcp/governance/stream?types=vote,boost,rageQuit - Filter event types
 *
 * Event Types:
 * - proposal_created: New proposal created
 * - proposal_updated: Proposal status changed
 * - vote_cast: Vote recorded
 * - boost_applied: Holographic boost applied
 * - rage_quit: Rage quit processed
 * - prediction_update: Prediction market price change
 * - stake_change: Staking event (stake/unstake)
 * - heartbeat: Keep-alive ping (every 30s)
 */

import { NextRequest } from 'next/server';

// ============================================================================
// Types
// ============================================================================

interface GovernanceEvent {
  type: string;
  timestamp: number;
  data: any;
}

// ============================================================================
// Event Store (In-Memory)
// ============================================================================

// Global event buffer for broadcasting
const eventBuffer: GovernanceEvent[] = [];
const MAX_BUFFER_SIZE = 1000;

// Subscriber tracking
const subscribers = new Map<string, {
  controller: ReadableStreamDefaultController<Uint8Array>;
  filters: {
    proposalId?: string;
    types?: string[];
  };
}>();

// ============================================================================
// Event Broadcasting
// ============================================================================

export function broadcastGovernanceEvent(event: GovernanceEvent) {
  // Add to buffer
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  // Broadcast to all subscribers
  for (const [id, subscriber] of subscribers.entries()) {
    try {
      // Apply filters
      if (subscriber.filters.proposalId && event.data?.proposalId !== subscriber.filters.proposalId) {
        continue;
      }
      if (subscriber.filters.types?.length && !subscriber.filters.types.includes(event.type)) {
        continue;
      }

      const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      subscriber.controller.enqueue(new TextEncoder().encode(sseData));
    } catch (error) {
      // Subscriber disconnected, clean up
      subscribers.delete(id);
    }
  }
}

// Heartbeat to keep connections alive
setInterval(() => {
  const heartbeat: GovernanceEvent = {
    type: 'heartbeat',
    timestamp: Date.now(),
    data: {
      subscriberCount: subscribers.size,
      eventBufferSize: eventBuffer.length,
    },
  };

  for (const [id, subscriber] of subscribers.entries()) {
    try {
      const sseData = `event: heartbeat\ndata: ${JSON.stringify(heartbeat)}\n\n`;
      subscriber.controller.enqueue(new TextEncoder().encode(sseData));
    } catch {
      subscribers.delete(id);
    }
  }
}, 30000);

// ============================================================================
// Demo Event Generator (for testing)
// ============================================================================

function startDemoEvents() {
  // Simulate governance activity for demo purposes
  const events = [
    { type: 'proposal_created', data: { proposalId: 'MCP-GOV-DEMO', title: 'Demo Proposal', proposer: 'demo-wallet' } },
    { type: 'vote_cast', data: { proposalId: 'MCP-GOV-DEMO', voter: 'voter-1', support: 'for', votingPower: '1000000000000' } },
    { type: 'prediction_update', data: { proposalId: 'MCP-GOV-DEMO', yesPrice: 0.65, noPrice: 0.35 } },
    { type: 'boost_applied', data: { proposalId: 'MCP-GOV-DEMO', booster: 'booster-1', prediction: 'pass' } },
    { type: 'vote_cast', data: { proposalId: 'MCP-GOV-DEMO', voter: 'voter-2', support: 'for', votingPower: '5000000000000' } },
    { type: 'stake_change', data: { wallet: 'new-staker', action: 'stake', amount: '10000000000000', duration: '90d' } },
  ];

  let index = 0;

  // Send a demo event every 10 seconds
  setInterval(() => {
    if (subscribers.size > 0) {
      const event = events[index % events.length];
      broadcastGovernanceEvent({
        ...event,
        timestamp: Date.now(),
      });
      index++;
    }
  }, 10000);
}

// Start demo events (only in development)
if (process.env.NODE_ENV !== 'production') {
  startDemoEvents();
}

// ============================================================================
// GET Handler (SSE Stream)
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get('proposalId') || undefined;
  const types = searchParams.get('types')?.split(',') || undefined;
  const includeRecent = searchParams.get('includeRecent') === 'true';

  const subscriberId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const stream = new ReadableStream({
    start(controller) {
      // Register subscriber
      subscribers.set(subscriberId, {
        controller,
        filters: { proposalId, types },
      });

      // Send initial connection message
      const connectMsg = {
        type: 'connected',
        timestamp: Date.now(),
        data: {
          subscriberId,
          filters: { proposalId, types },
          message: 'Connected to governance event stream',
        },
      };
      controller.enqueue(new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify(connectMsg)}\n\n`));

      // Optionally send recent events
      if (includeRecent) {
        const recentEvents = eventBuffer
          .filter(e => {
            if (proposalId && e.data?.proposalId !== proposalId) return false;
            if (types?.length && !types.includes(e.type)) return false;
            return true;
          })
          .slice(-20); // Last 20 matching events

        for (const event of recentEvents) {
          const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseData));
        }
      }
    },

    cancel() {
      // Clean up on disconnect
      subscribers.delete(subscriberId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// ============================================================================
// POST Handler (Emit Event - Internal Use)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data, apiKey } = body;

    // Simple API key validation (in production, use proper auth)
    if (apiKey !== process.env.GOVERNANCE_STREAM_API_KEY && process.env.NODE_ENV === 'production') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!type || !data) {
      return new Response(JSON.stringify({ error: 'Type and data required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event: GovernanceEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    broadcastGovernanceEvent(event);

    return new Response(JSON.stringify({
      success: true,
      event,
      subscriberCount: subscribers.size,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export for use by main governance route
export { broadcastGovernanceEvent as emitGovernanceEvent };
