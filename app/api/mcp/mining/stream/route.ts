/**
 * Mining Events SSE Stream
 *
 * GET /api/mcp/mining/stream - Subscribe to real-time mining events
 *
 * Query params:
 * - types: Comma-separated event types to filter (optional)
 * - serverId: Filter events for specific server (optional)
 * - minReward: Minimum reward amount in UI units (optional)
 *
 * @module app/api/mcp/mining/stream
 */

import { NextRequest } from 'next/server';
import {
  miningEvents,
  formatSSE,
  createSSEHeaders,
  MiningEventType,
  MiningEvent,
} from '../../../../../api/src/mcp-mining-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Valid event types for filtering
const VALID_EVENT_TYPES: MiningEventType[] = [
  'challenge_created',
  'challenge_completed',
  'challenge_expired',
  'reward_minted',
  'tokens_staked',
  'tokens_transferred',
  'leaderboard_update',
  'network_stats',
  'pouw_work_created',
  'pouw_work_submitted',
  'pouw_work_accepted',
  'pouw_work_rejected',
  'worker_joined',
  'worker_milestone',
  'epoch_change',
  'halving_approaching',
  'heartbeat',
];

/**
 * GET /api/mcp/mining/stream
 *
 * Server-Sent Events stream for real-time mining updates.
 *
 * Example usage:
 * ```javascript
 * const eventSource = new EventSource('/api/mcp/mining/stream?types=reward_minted,challenge_completed');
 *
 * eventSource.addEventListener('reward_minted', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Reward minted:', data.data.amountUi, 'OMCP');
 * });
 *
 * eventSource.addEventListener('challenge_completed', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Challenge completed by', data.metadata.serverId);
 * });
 * ```
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse filters
  const typesParam = searchParams.get('types');
  const serverId = searchParams.get('serverId');
  const minRewardParam = searchParams.get('minReward');

  // Validate and parse event types
  let types: MiningEventType[] | undefined;
  if (typesParam) {
    const requestedTypes = typesParam.split(',').map(t => t.trim()) as MiningEventType[];
    types = requestedTypes.filter(t => VALID_EVENT_TYPES.includes(t));
    if (types.length === 0) {
      types = undefined; // If no valid types, show all
    }
  }

  // Parse min reward
  const minReward = minRewardParam ? parseFloat(minRewardParam) : undefined;

  // Create a ReadableStream for SSE
  const encoder = new TextEncoder();
  let subscriptionId: string | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent: MiningEvent = {
        id: `connect_${Date.now()}`,
        type: 'heartbeat',
        timestamp: Date.now(),
        data: {
          connected: true,
          filters: {
            types: types || 'all',
            serverId: serverId || 'all',
            minReward: minReward || 0,
          },
          message: 'Connected to mining event stream',
        },
      };
      controller.enqueue(encoder.encode(formatSSE(connectEvent)));

      // Subscribe to mining events
      subscriptionId = miningEvents.subscribe({
        send: (event: MiningEvent) => {
          try {
            controller.enqueue(encoder.encode(formatSSE(event)));
          } catch (error) {
            // Stream closed
            if (subscriptionId) {
              miningEvents.unsubscribe(subscriptionId);
            }
          }
        },
        filters: {
          types,
          serverId: serverId || undefined,
          minReward,
        },
      });
    },

    cancel() {
      if (subscriptionId) {
        miningEvents.unsubscribe(subscriptionId);
        subscriptionId = null;
      }
    },
  });

  return new Response(stream, {
    headers: createSSEHeaders(),
  });
}
