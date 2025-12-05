/**
 * Mining Events API
 *
 * GET /api/mcp/mining - Get mining event stats and recent events
 *
 * @module app/api/mcp/mining
 */

import { NextRequest, NextResponse } from 'next/server';
import { miningEvents, MiningEventType } from '../../../../api/src/mcp-mining-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
 * GET /api/mcp/mining
 *
 * Query params:
 * - action: 'stats' | 'recent' | 'snapshot' | 'event-types'
 * - limit: Number of recent events (default 20)
 * - types: Comma-separated event types to filter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';
    const limit = parseInt(searchParams.get('limit') || '20');
    const typesParam = searchParams.get('types');

    switch (action) {
      case 'stats':
        const stats = miningEvents.getStats();
        return NextResponse.json({
          ...stats,
          streamEndpoint: '/api/mcp/mining/stream',
          timestamp: Date.now(),
        });

      case 'recent':
        let types: MiningEventType[] | undefined;
        if (typesParam) {
          const requestedTypes = typesParam.split(',').map(t => t.trim()) as MiningEventType[];
          types = requestedTypes.filter(t => VALID_EVENT_TYPES.includes(t));
        }
        const events = miningEvents.getRecentEvents(limit, types);
        return NextResponse.json({
          events,
          count: events.length,
          timestamp: Date.now(),
        });

      case 'snapshot':
        const snapshot = miningEvents.getNetworkSnapshot();
        return NextResponse.json(snapshot);

      case 'event-types':
        return NextResponse.json({
          types: VALID_EVENT_TYPES,
          descriptions: {
            challenge_created: 'New PoW challenge created',
            challenge_completed: 'PoW challenge solved and verified',
            challenge_expired: 'Challenge expired without solution',
            reward_minted: 'OMCP tokens minted as reward',
            tokens_staked: 'Tokens staked for trust boost',
            tokens_transferred: 'Token transfer between addresses',
            leaderboard_update: 'Top miners leaderboard changed',
            network_stats: 'Periodic network statistics update',
            pouw_work_created: 'New Proof-of-Useful-Work challenge',
            pouw_work_submitted: 'Work result submitted for review',
            pouw_work_accepted: 'Work accepted, reward distributed',
            pouw_work_rejected: 'Work rejected due to low quality',
            worker_joined: 'New worker joined the network',
            worker_milestone: 'Worker reached achievement milestone',
            epoch_change: 'Mining epoch changed, rewards halved',
            halving_approaching: 'Warning: halving event approaching',
            heartbeat: 'Periodic connection keepalive',
          },
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
