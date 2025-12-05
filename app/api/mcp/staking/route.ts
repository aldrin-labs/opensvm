/**
 * Staking API
 *
 * Proof-of-Stake mining system with validator epochs,
 * slashing for malicious behavior, and difficulty scaling.
 *
 * POST /api/mcp/staking - Stake, unstake, slash operations
 * GET /api/mcp/staking - Query stakes, epochs, validators
 *
 * @module app/api/mcp/staking
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  stake,
  unstake,
  getStakeInfo,
  getAllStakers,
  slash,
  assessDifficulty,
  getDifficultyConfig,
  getCurrentEpoch,
  getEpoch,
  isCurrentValidator,
  getStakingStats,
  getValidatorLeaderboard,
  ensureEpochStarted,
} from '../../../../api/src/pouw-staking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ensure epoch is started when API loads
ensureEpochStarted();

/**
 * GET /api/mcp/staking
 *
 * Query params:
 * - action: 'stats' | 'stake_info' | 'leaderboard' | 'epoch' | 'difficulty' | 'validators'
 * - stakerId: For 'stake_info' action
 * - epochId: For 'epoch' action (optional, defaults to current)
 * - workType, inputData: For 'difficulty' action (JSON encoded)
 * - limit: For 'leaderboard' action (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats': {
        const stats = getStakingStats();
        return NextResponse.json({
          ...stats,
          // Convert BigInt to string for JSON
          totalStaked: stats.totalStaked.toString(),
          totalSlashed: stats.totalSlashed.toString(),
          averageStake: stats.averageStake.toString(),
          minStakeRequired: stats.minStakeRequired.toString(),
          minValidatorStake: stats.minValidatorStake.toString(),
          epochTimeRemainingMs: stats.epochTimeRemaining,
          message: 'Proof-of-Stake mining statistics',
        });
      }

      case 'stake_info': {
        const stakerId = searchParams.get('stakerId');
        if (!stakerId) {
          return NextResponse.json({ error: 'Missing stakerId parameter' }, { status: 400 });
        }

        const info = getStakeInfo(stakerId);
        if (!info) {
          return NextResponse.json({
            stakerId,
            staked: false,
            message: 'No stake found for this address',
          });
        }

        return NextResponse.json({
          stakerId: info.stakerId,
          stakedAmount: info.stakedAmount.toString(),
          stakedAt: info.stakedAt,
          lockedUntil: info.lockedUntil,
          slashedAmount: info.slashedAmount.toString(),
          violations: info.violations.map(v => ({
            ...v,
            amount: v.amount.toString(),
          })),
          isValidator: info.isValidator,
          validatorRank: info.validatorRank,
        });
      }

      case 'leaderboard': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const leaderboard = getValidatorLeaderboard(limit);

        return NextResponse.json({
          validators: leaderboard.map(v => ({
            ...v,
            stakedAmount: v.stakedAmount.toString(),
          })),
          count: leaderboard.length,
          timestamp: Date.now(),
        });
      }

      case 'epoch': {
        const epochIdParam = searchParams.get('epochId');
        const epoch = epochIdParam ? getEpoch(parseInt(epochIdParam)) : getCurrentEpoch();

        if (!epoch) {
          return NextResponse.json({
            error: 'Epoch not found',
            hint: epochIdParam ? 'Check epoch ID' : 'No active epoch',
          }, { status: 404 });
        }

        return NextResponse.json({
          id: epoch.id,
          startTime: epoch.startTime,
          endTime: epoch.endTime,
          timeRemaining: Math.max(0, epoch.endTime - Date.now()),
          validators: epoch.validators,
          validatorCount: epoch.validators.length,
          challengesProcessed: epoch.challengesProcessed,
          rewardsDistributed: epoch.rewardsDistributed.toString(),
          slashingsApplied: epoch.slashingsApplied,
          status: epoch.status,
        });
      }

      case 'validators': {
        const epoch = getCurrentEpoch();
        if (!epoch) {
          return NextResponse.json({
            validators: [],
            message: 'No active epoch',
          });
        }

        const validatorDetails = epoch.validators.map(v => {
          const stake = epoch.validatorStakes.get(v);
          const info = getStakeInfo(v);
          return {
            stakerId: v,
            stakedAmount: stake?.toString() || '0',
            violationCount: info?.violations.length || 0,
            rank: info?.validatorRank || 0,
          };
        });

        return NextResponse.json({
          epochId: epoch.id,
          validators: validatorDetails,
          count: validatorDetails.length,
          totalStake: Array.from(epoch.validatorStakes.values())
            .reduce((sum, s) => sum + s, BigInt(0)).toString(),
        });
      }

      case 'difficulty': {
        const workType = searchParams.get('workType');
        if (!workType) {
          return NextResponse.json({ error: 'Missing workType parameter' }, { status: 400 });
        }

        let inputData = {};
        const inputDataParam = searchParams.get('inputData');
        if (inputDataParam) {
          try {
            inputData = JSON.parse(inputDataParam);
          } catch {
            return NextResponse.json({ error: 'Invalid inputData JSON' }, { status: 400 });
          }
        }

        const assessment = assessDifficulty(workType, inputData);

        return NextResponse.json({
          workType,
          ...assessment,
          config: getDifficultyConfig(assessment.level),
        });
      }

      case 'all_stakers': {
        const stakers = getAllStakers();
        return NextResponse.json({
          stakers: stakers.map(s => ({
            stakerId: s.stakerId,
            stakedAmount: s.stakedAmount.toString(),
            isValidator: s.isValidator,
            validatorRank: s.validatorRank,
            violationCount: s.violations.length,
          })),
          count: stakers.length,
        });
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}`,
          validActions: ['stats', 'stake_info', 'leaderboard', 'epoch', 'validators', 'difficulty', 'all_stakers'],
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
 * POST /api/mcp/staking
 *
 * Body:
 * - action: 'stake' | 'unstake' | 'slash' | 'check_validator'
 * - For stake: stakerId, amount, lockDurationMs (optional)
 * - For unstake: stakerId, amount
 * - For slash: stakerId, violationType, challengeId (optional), details (optional)
 * - For check_validator: stakerId
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'stake': {
        const { stakerId, amount, lockDurationMs } = body;

        if (!stakerId) {
          return NextResponse.json({ error: 'Missing stakerId' }, { status: 400 });
        }
        if (!amount) {
          return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
        }

        const result = stake(
          stakerId,
          BigInt(amount),
          lockDurationMs || 0
        );

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error,
          }, { status: 400 });
        }

        const info = getStakeInfo(stakerId);
        return NextResponse.json({
          success: true,
          stakerId,
          newBalance: info?.stakedAmount.toString(),
          isValidator: info?.isValidator,
          validatorRank: info?.validatorRank,
          message: 'Stake successful',
        });
      }

      case 'unstake': {
        const { stakerId, amount } = body;

        if (!stakerId) {
          return NextResponse.json({ error: 'Missing stakerId' }, { status: 400 });
        }
        if (!amount) {
          return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
        }

        const result = unstake(stakerId, BigInt(amount));

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error,
            availableAt: result.availableAt,
          }, { status: 400 });
        }

        const info = getStakeInfo(stakerId);
        return NextResponse.json({
          success: true,
          stakerId,
          remainingBalance: info?.stakedAmount.toString() || '0',
          isValidator: info?.isValidator || false,
          message: 'Unstake successful',
        });
      }

      case 'slash': {
        const { stakerId, violationType, challengeId, details } = body;

        if (!stakerId) {
          return NextResponse.json({ error: 'Missing stakerId' }, { status: 400 });
        }
        if (!violationType) {
          return NextResponse.json({ error: 'Missing violationType' }, { status: 400 });
        }

        const validTypes = [
          'consensus_disagreement',
          'missed_consensus',
          'fraud_detected',
          'repeated_violations',
        ];
        if (!validTypes.includes(violationType)) {
          return NextResponse.json({
            error: `Invalid violationType: ${violationType}`,
            validTypes,
          }, { status: 400 });
        }

        const result = slash(stakerId, violationType, challengeId, details);

        return NextResponse.json({
          success: result.slashed,
          slashedAmount: result.amount.toString(),
          reason: result.reason,
          stakeInfo: getStakeInfo(stakerId) ? {
            remainingStake: getStakeInfo(stakerId)!.stakedAmount.toString(),
            totalSlashed: getStakeInfo(stakerId)!.slashedAmount.toString(),
            isValidator: getStakeInfo(stakerId)!.isValidator,
          } : null,
        });
      }

      case 'check_validator': {
        const { stakerId } = body;

        if (!stakerId) {
          return NextResponse.json({ error: 'Missing stakerId' }, { status: 400 });
        }

        const isValidator = isCurrentValidator(stakerId);
        const info = getStakeInfo(stakerId);
        const epoch = getCurrentEpoch();

        return NextResponse.json({
          stakerId,
          isValidator,
          validatorRank: info?.validatorRank,
          currentEpoch: epoch?.id,
          epochValidatorCount: epoch?.validators.length,
          stakedAmount: info?.stakedAmount.toString() || '0',
        });
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}`,
          validActions: ['stake', 'unstake', 'slash', 'check_validator'],
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
