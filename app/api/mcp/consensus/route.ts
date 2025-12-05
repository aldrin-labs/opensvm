/**
 * Consensus API
 *
 * Byzantine fault-tolerant verification for PoUW results.
 * Multiple workers independently verify the same data,
 * consensus is reached when 2/3+ workers agree.
 *
 * POST /api/mcp/consensus - Create challenge, submit result, manage workers
 * GET /api/mcp/consensus - Query challenges and stats
 *
 * @module app/api/mcp/consensus
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createConsensusChallenge,
  submitConsensusResult,
  getConsensusChallenge,
  getConsensusResult,
  getWorkerChallenges,
  getConsensusStats,
  getWorkerConsensusStats,
  registerWorkerAvailability,
  heartbeat,
} from '../../../../api/src/pouw-consensus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/consensus
 *
 * Query params:
 * - action: 'stats' | 'challenge' | 'result' | 'worker_challenges' | 'worker_stats'
 * - challengeId: For 'challenge' and 'result' actions
 * - workerId: For 'worker_challenges' and 'worker_stats' actions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats': {
        const stats = getConsensusStats();
        return NextResponse.json({
          ...stats,
          message: 'Cross-worker consensus statistics for Byzantine fault tolerance',
        });
      }

      case 'challenge': {
        const challengeId = searchParams.get('challengeId');
        if (!challengeId) {
          return NextResponse.json({ error: 'Missing challengeId parameter' }, { status: 400 });
        }

        const challenge = getConsensusChallenge(challengeId);
        if (!challenge) {
          return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
        }

        return NextResponse.json({
          id: challenge.id,
          workType: challenge.workType,
          assignedWorkers: challenge.assignedWorkers,
          submissionCount: challenge.submissions.size,
          status: challenge.status,
          createdAt: challenge.createdAt,
          expiresAt: challenge.expiresAt,
          consensusConfidence: challenge.consensusConfidence,
        });
      }

      case 'result': {
        const challengeId = searchParams.get('challengeId');
        if (!challengeId) {
          return NextResponse.json({ error: 'Missing challengeId parameter' }, { status: 400 });
        }

        const result = getConsensusResult(challengeId);
        if (!result) {
          return NextResponse.json({
            error: 'Consensus not yet reached',
            hint: 'Challenge may still be pending or voting',
          }, { status: 404 });
        }

        return NextResponse.json(result);
      }

      case 'worker_challenges': {
        const workerId = searchParams.get('workerId');
        if (!workerId) {
          return NextResponse.json({ error: 'Missing workerId parameter' }, { status: 400 });
        }

        const challenges = getWorkerChallenges(workerId);
        return NextResponse.json({
          workerId,
          pendingChallenges: challenges.map(c => ({
            id: c.id,
            workType: c.workType,
            inputData: c.inputData,
            expiresAt: c.expiresAt,
          })),
          count: challenges.length,
        });
      }

      case 'worker_stats': {
        const workerId = searchParams.get('workerId');
        if (!workerId) {
          return NextResponse.json({ error: 'Missing workerId parameter' }, { status: 400 });
        }

        const stats = getWorkerConsensusStats(workerId);
        if (!stats) {
          return NextResponse.json({
            workerId,
            challengesParticipated: 0,
            consensusAgreements: 0,
            consensusDisagreements: 0,
            agreementRate: 0,
            message: 'Worker has no consensus history',
          });
        }

        return NextResponse.json(stats);
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}`,
          validActions: ['stats', 'challenge', 'result', 'worker_challenges', 'worker_stats'],
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/consensus
 *
 * Body:
 * - action: 'create_challenge' | 'submit_result' | 'register_worker' | 'heartbeat'
 * - For create_challenge: workType, inputData, requiredWorkers (optional)
 * - For submit_result: challengeId, workerId, result
 * - For register_worker/heartbeat: workerId
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_challenge': {
        const { workType, inputData, requiredWorkers } = body;

        if (!workType) {
          return NextResponse.json({ error: 'Missing workType' }, { status: 400 });
        }
        if (!inputData) {
          return NextResponse.json({ error: 'Missing inputData' }, { status: 400 });
        }

        const challenge = createConsensusChallenge(workType, inputData, requiredWorkers);

        if (!challenge) {
          return NextResponse.json({
            error: 'Could not create consensus challenge',
            reason: 'Not enough workers available (minimum 3 required)',
            hint: 'Workers must register and send heartbeats to be considered available',
          }, { status: 503 });
        }

        return NextResponse.json({
          success: true,
          challengeId: challenge.id,
          assignedWorkers: challenge.assignedWorkers,
          expiresAt: challenge.expiresAt,
          message: `Challenge created with ${challenge.assignedWorkers.length} workers`,
        });
      }

      case 'submit_result': {
        const { challengeId, workerId, result } = body;

        if (!challengeId) {
          return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });
        }
        if (!workerId) {
          return NextResponse.json({ error: 'Missing workerId' }, { status: 400 });
        }
        if (result === undefined) {
          return NextResponse.json({ error: 'Missing result' }, { status: 400 });
        }

        const submission = submitConsensusResult(challengeId, workerId, result);

        if (!submission.accepted) {
          return NextResponse.json({
            success: false,
            reason: submission.reason,
          }, { status: 400 });
        }

        // Check if consensus has been reached
        const consensusResult = getConsensusResult(challengeId);

        return NextResponse.json({
          success: true,
          message: 'Result submitted successfully',
          consensusReached: !!consensusResult?.achieved,
          consensusResult: consensusResult,
        });
      }

      case 'register_worker': {
        const { workerId } = body;

        if (!workerId) {
          return NextResponse.json({ error: 'Missing workerId' }, { status: 400 });
        }

        registerWorkerAvailability(workerId);

        return NextResponse.json({
          success: true,
          workerId,
          message: 'Worker registered for consensus challenges',
          note: 'Send heartbeats every 30 seconds to remain available',
        });
      }

      case 'heartbeat': {
        const { workerId } = body;

        if (!workerId) {
          return NextResponse.json({ error: 'Missing workerId' }, { status: 400 });
        }

        heartbeat(workerId);

        // Return pending challenges for this worker
        const challenges = getWorkerChallenges(workerId);

        return NextResponse.json({
          success: true,
          workerId,
          timestamp: Date.now(),
          pendingChallenges: challenges.length,
          challenges: challenges.map(c => ({
            id: c.id,
            workType: c.workType,
            expiresAt: c.expiresAt,
          })),
        });
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}`,
          validActions: ['create_challenge', 'submit_result', 'register_worker', 'heartbeat'],
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
