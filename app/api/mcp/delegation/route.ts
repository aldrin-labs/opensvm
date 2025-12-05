/**
 * Delegation & Liquid Staking API
 *
 * Endpoints for stake delegation to validators and liquid staking tokens.
 *
 * POST /api/mcp/delegation - Delegate, undelegate, transfer stOMCP
 * GET /api/mcp/delegation - Query delegations, validators, stats
 *
 * @module app/api/mcp/delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  // Validator profile
  setValidatorProfile,
  getValidatorProfile,
  getAllValidatorProfiles,
  // Delegation
  delegate,
  requestUndelegate,
  completeUndelegate,
  cancelUndelegate,
  // Liquid staking
  transferStOMCP,
  withdrawStOMCPFromDelegation,
  getStOMCPBalance,
  // Rewards
  distributeRewards,
  claimRewards,
  // Queries
  getDelegation,
  getDelegatorDelegations,
  getValidatorDelegators,
  getUndelegationRequests,
  getUndelegationRequest,
  getExchangeRate,
  getDelegationStats,
  getTopValidatorsByDelegation,
} from '../../../../api/src/pouw-delegation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/delegation
 *
 * Query params:
 * - action: 'stats' | 'delegation' | 'delegator_delegations' | 'validator_delegators' |
 *           'undelegation_requests' | 'undelegation' | 'exchange_rate' | 'validators' |
 *           'validator_profile' | 'stomcp_balance'
 * - delegatorId: For delegation and balance queries
 * - validatorId: For validator-specific queries
 * - requestId: For undelegation request queries
 * - limit: For pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats': {
        const stats = getDelegationStats();
        return NextResponse.json({
          ...stats,
          totalDelegated: stats.totalDelegated.toString(),
          totalStOMCPSupply: stats.totalStOMCPSupply.toString(),
          averageDelegation: stats.averageDelegation.toString(),
          totalPendingUndelegation: stats.totalPendingUndelegation.toString(),
          message: 'Delegation and liquid staking statistics',
        });
      }

      case 'delegation': {
        const delegatorId = searchParams.get('delegatorId');
        const validatorId = searchParams.get('validatorId');
        if (!delegatorId || !validatorId) {
          return NextResponse.json(
            { error: 'Missing delegatorId or validatorId parameter' },
            { status: 400 }
          );
        }

        const delegation = getDelegation(delegatorId, validatorId);
        if (!delegation) {
          return NextResponse.json({
            delegatorId,
            validatorId,
            delegated: false,
            message: 'No delegation found',
          });
        }

        return NextResponse.json({
          delegatorId: delegation.delegatorId,
          validatorId: delegation.validatorId,
          amount: delegation.amount.toString(),
          stOMCPBalance: delegation.stOMCPBalance.toString(),
          delegatedAt: delegation.delegatedAt,
          lastRewardClaim: delegation.lastRewardClaim,
          pendingRewards: delegation.pendingRewards.toString(),
        });
      }

      case 'delegator_delegations': {
        const delegatorId = searchParams.get('delegatorId');
        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId parameter' }, { status: 400 });
        }

        const delegations = getDelegatorDelegations(delegatorId);
        return NextResponse.json({
          delegatorId,
          delegations: delegations.map(d => ({
            validatorId: d.validatorId,
            amount: d.amount.toString(),
            stOMCPBalance: d.stOMCPBalance.toString(),
            delegatedAt: d.delegatedAt,
            pendingRewards: d.pendingRewards.toString(),
          })),
          count: delegations.length,
          totalDelegated: delegations.reduce((sum, d) => sum + d.amount, BigInt(0)).toString(),
        });
      }

      case 'validator_delegators': {
        const validatorId = searchParams.get('validatorId');
        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId parameter' }, { status: 400 });
        }

        const delegators = getValidatorDelegators(validatorId);
        return NextResponse.json({
          validatorId,
          delegators: delegators.map(d => ({
            delegatorId: d.delegatorId,
            amount: d.amount.toString(),
            stOMCPBalance: d.stOMCPBalance.toString(),
            delegatedAt: d.delegatedAt,
          })),
          count: delegators.length,
          totalDelegated: delegators.reduce((sum, d) => sum + d.amount, BigInt(0)).toString(),
        });
      }

      case 'undelegation_requests': {
        const delegatorId = searchParams.get('delegatorId');
        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId parameter' }, { status: 400 });
        }

        const requests = getUndelegationRequests(delegatorId);
        return NextResponse.json({
          delegatorId,
          requests: requests.map(r => ({
            id: r.id,
            validatorId: r.validatorId,
            amount: r.amount.toString(),
            stOMCPAmount: r.stOMCPAmount.toString(),
            requestedAt: r.requestedAt,
            availableAt: r.availableAt,
            status: r.status,
            timeRemaining: Math.max(0, r.availableAt - Date.now()),
          })),
          count: requests.length,
        });
      }

      case 'undelegation': {
        const requestId = searchParams.get('requestId');
        if (!requestId) {
          return NextResponse.json({ error: 'Missing requestId parameter' }, { status: 400 });
        }

        const request = getUndelegationRequest(requestId);
        if (!request) {
          return NextResponse.json({ error: 'Undelegation request not found' }, { status: 404 });
        }

        return NextResponse.json({
          id: request.id,
          delegatorId: request.delegatorId,
          validatorId: request.validatorId,
          amount: request.amount.toString(),
          stOMCPAmount: request.stOMCPAmount.toString(),
          requestedAt: request.requestedAt,
          availableAt: request.availableAt,
          status: request.status,
          timeRemaining: Math.max(0, request.availableAt - Date.now()),
          canComplete: request.status === 'pending' && Date.now() >= request.availableAt,
        });
      }

      case 'exchange_rate': {
        const rate = getExchangeRate();
        return NextResponse.json({
          ...rate,
          message: 'Current stOMCP to OMCP exchange rate',
        });
      }

      case 'validators': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const validators = getTopValidatorsByDelegation(limit);
        return NextResponse.json({
          validators: validators.map(v => ({
            validatorId: v.validatorId,
            commissionRate: v.commissionRate / 100 + '%',
            totalDelegated: v.totalDelegated.toString(),
            delegatorCount: v.delegatorCount,
            rewardsDistributed: v.rewardsDistributed.toString(),
            description: v.description,
            website: v.website,
          })),
          count: validators.length,
        });
      }

      case 'validator_profile': {
        const validatorId = searchParams.get('validatorId');
        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId parameter' }, { status: 400 });
        }

        const profile = getValidatorProfile(validatorId);
        if (!profile) {
          return NextResponse.json({
            validatorId,
            hasProfile: false,
            message: 'Validator profile not found',
          });
        }

        return NextResponse.json({
          validatorId: profile.validatorId,
          commissionRate: profile.commissionRate,
          commissionRatePercent: profile.commissionRate / 100 + '%',
          totalDelegated: profile.totalDelegated.toString(),
          delegatorCount: profile.delegatorCount,
          rewardsDistributed: profile.rewardsDistributed.toString(),
          createdAt: profile.createdAt,
          description: profile.description,
          website: profile.website,
        });
      }

      case 'stomcp_balance': {
        const address = searchParams.get('address');
        if (!address) {
          return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
        }

        const balance = getStOMCPBalance(address);
        return NextResponse.json({
          address,
          freeBalance: balance.freeBalance.toString(),
          delegatedBalance: balance.delegatedBalance.toString(),
          totalBalance: balance.totalBalance.toString(),
          omcpValue: balance.omcpValue.toString(),
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Invalid action: ${action}`,
            validActions: [
              'stats',
              'delegation',
              'delegator_delegations',
              'validator_delegators',
              'undelegation_requests',
              'undelegation',
              'exchange_rate',
              'validators',
              'validator_profile',
              'stomcp_balance',
            ],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/delegation
 *
 * Body:
 * - action: 'delegate' | 'request_undelegate' | 'complete_undelegate' | 'cancel_undelegate' |
 *           'transfer_stomcp' | 'withdraw_stomcp' | 'claim_rewards' | 'distribute_rewards' |
 *           'set_validator_profile'
 * - Parameters vary by action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'delegate': {
        const { delegatorId, validatorId, amount } = body;

        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId' }, { status: 400 });
        }
        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId' }, { status: 400 });
        }
        if (!amount) {
          return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
        }

        const result = delegate(delegatorId, validatorId, BigInt(amount));

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        const balance = getStOMCPBalance(delegatorId);

        return NextResponse.json({
          success: true,
          delegatorId,
          validatorId,
          amountDelegated: amount,
          stOMCPReceived: result.stOMCPReceived?.toString(),
          totalStOMCPBalance: balance.totalBalance.toString(),
          message: 'Delegation successful',
        });
      }

      case 'request_undelegate': {
        const { delegatorId, validatorId, stOMCPAmount } = body;

        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId' }, { status: 400 });
        }
        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId' }, { status: 400 });
        }
        if (!stOMCPAmount) {
          return NextResponse.json({ error: 'Missing stOMCPAmount' }, { status: 400 });
        }

        const result = requestUndelegate(delegatorId, validatorId, BigInt(stOMCPAmount));

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          requestId: result.requestId,
          delegatorId,
          validatorId,
          stOMCPAmount,
          availableAt: result.availableAt,
          cooldownDays: 7,
          message: 'Undelegation request created. Funds available after 7 day cooldown.',
        });
      }

      case 'complete_undelegate': {
        const { requestId } = body;

        if (!requestId) {
          return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        }

        const result = completeUndelegate(requestId);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          requestId,
          amountReturned: result.amountReturned?.toString(),
          message: 'Undelegation completed. Funds returned.',
        });
      }

      case 'cancel_undelegate': {
        const { requestId, delegatorId } = body;

        if (!requestId) {
          return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        }
        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId' }, { status: 400 });
        }

        const result = cancelUndelegate(requestId, delegatorId);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          requestId,
          message: 'Undelegation cancelled. stOMCP restored.',
        });
      }

      case 'transfer_stomcp': {
        const { from, to, amount } = body;

        if (!from) {
          return NextResponse.json({ error: 'Missing from address' }, { status: 400 });
        }
        if (!to) {
          return NextResponse.json({ error: 'Missing to address' }, { status: 400 });
        }
        if (!amount) {
          return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
        }

        const result = transferStOMCP(from, to, BigInt(amount));

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          from,
          to,
          amount,
          message: 'stOMCP transfer successful',
        });
      }

      case 'withdraw_stomcp': {
        const { delegatorId, validatorId, amount } = body;

        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId' }, { status: 400 });
        }
        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId' }, { status: 400 });
        }
        if (!amount) {
          return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
        }

        const result = withdrawStOMCPFromDelegation(delegatorId, validatorId, BigInt(amount));

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        const balance = getStOMCPBalance(delegatorId);

        return NextResponse.json({
          success: true,
          delegatorId,
          validatorId,
          amountWithdrawn: amount,
          newFreeBalance: balance.freeBalance.toString(),
          message: 'stOMCP withdrawn to free balance. Now transferable.',
        });
      }

      case 'claim_rewards': {
        const { delegatorId, validatorId } = body;

        if (!delegatorId) {
          return NextResponse.json({ error: 'Missing delegatorId' }, { status: 400 });
        }

        const result = claimRewards(delegatorId, validatorId);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          delegatorId,
          validatorId: validatorId || 'all',
          claimedAmount: result.claimed.toString(),
          message: 'Rewards claimed successfully',
        });
      }

      case 'distribute_rewards': {
        const { validatorId, totalRewards } = body;

        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId' }, { status: 400 });
        }
        if (!totalRewards) {
          return NextResponse.json({ error: 'Missing totalRewards' }, { status: 400 });
        }

        const result = distributeRewards(validatorId, BigInt(totalRewards));

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          validatorId,
          totalRewards,
          distributed: result.distributed.toString(),
          delegatorCount: result.delegatorCount,
          message: 'Rewards distributed to delegators',
        });
      }

      case 'set_validator_profile': {
        const { validatorId, commissionRate, description, website } = body;

        if (!validatorId) {
          return NextResponse.json({ error: 'Missing validatorId' }, { status: 400 });
        }

        const result = setValidatorProfile(validatorId, {
          commissionRate,
          description,
          website,
        });

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        const profile = getValidatorProfile(validatorId);

        return NextResponse.json({
          success: true,
          validatorId,
          profile: profile ? {
            commissionRate: profile.commissionRate,
            commissionRatePercent: profile.commissionRate / 100 + '%',
            description: profile.description,
            website: profile.website,
          } : null,
          message: 'Validator profile updated',
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Invalid action: ${action}`,
            validActions: [
              'delegate',
              'request_undelegate',
              'complete_undelegate',
              'cancel_undelegate',
              'transfer_stomcp',
              'withdraw_stomcp',
              'claim_rewards',
              'distribute_rewards',
              'set_validator_profile',
            ],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
