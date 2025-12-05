/**
 * MCP Governance REST API
 *
 * Full governance operations for MCP server DAO.
 *
 * GET /api/mcp/governance - List proposals
 * GET /api/mcp/governance?id=xxx - Get specific proposal
 * GET /api/mcp/governance?action=stats - Get governance statistics
 * GET /api/mcp/governance?action=stake&wallet=xxx - Get wallet stake info
 * GET /api/mcp/governance?action=predictions&id=xxx - Get prediction market
 * POST /api/mcp/governance - Create proposal, vote, stake, boost, or rage quit
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Types (Edge Runtime compatible)
// ============================================================================

type VotingMode = 'simple' | 'quadratic' | 'conviction' | 'holographic';
type ProposalStatus = 'draft' | 'pending' | 'active' | 'boosted' | 'rage_quit_window' | 'passed' | 'rejected' | 'executed' | 'cancelled';
type StakeDuration = '7d' | '30d' | '90d' | '180d' | '365d';

interface ProposalAction {
  target: string;
  function: string;
  params: Record<string, any>;
  value?: string; // BigInt as string for JSON
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: string;
  status: ProposalStatus;
  votingMode: VotingMode;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  voterCount: number;
  convictionFor: number;
  convictionAgainst: number;
  boosted: boolean;
  totalBoostStake: string;
  rageQuitEligible: boolean;
  quorum: string;
  effectiveQuorum: string;
  requiredConviction: number;
  createdAt: number;
  votingStartsAt: number;
  votingEndsAt: number;
  executionETA?: number;
  gracePeriodEndsAt?: number;
  actions: ProposalAction[];
}

interface StakeInfo {
  wallet: string;
  amount: string;
  stakedAt: number;
  duration: number;
  votingPower: string;
  effectiveAmount: string;
}

interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  boostedProposals: number;
  totalRageQuits: number;
  treasuryBalance: string;
  totalStaked: string;
  stakersCount: number;
  features: {
    conviction: boolean;
    rageQuit: boolean;
    holographic: boolean;
    predictionMarkets: boolean;
  };
}

// ============================================================================
// In-Memory Store (Edge Runtime compatible)
// ============================================================================

const proposals = new Map<string, Proposal>();
const stakes = new Map<string, StakeInfo>();
const votes = new Map<string, Map<string, { support: string; votingPower: string; timestamp: number }>>();
const boosts = new Map<string, Array<{ booster: string; prediction: string; stake: string; timestamp: number }>>();
const rageQuits = new Map<string, Array<{ wallet: string; status: string; claimable: string; timestamp: number }>>();
const predictionMarkets = new Map<string, { yesShares: string; noShares: string; yesPrice: number; noPrice: number }>();

let proposalCounter = 0;
let treasuryBalance = BigInt(10_000_000) * BigInt(1e9);

// Configuration
const CONFIG = {
  proposalThreshold: BigInt(1000) * BigInt(1e9),
  boostStakeRequired: BigInt(5000) * BigInt(1e9),
  regularQuorumPercent: 10,
  boostedQuorumPercent: 2,
  gracePeriodMs: 3 * 24 * 60 * 60 * 1000,
  minStakeDurationMs: 7 * 24 * 60 * 60 * 1000,
  features: {
    conviction: true,
    rageQuit: true,
    holographic: true,
    predictionMarkets: true,
  },
};

// Stake duration multipliers
const STAKE_MULTIPLIERS: Record<StakeDuration, number> = {
  '7d': 1.0,
  '30d': 1.25,
  '90d': 1.5,
  '180d': 2.0,
  '365d': 3.0,
};

// ============================================================================
// Helper Functions
// ============================================================================

function bigIntToString(value: bigint): string {
  return value.toString();
}

function stringToBigInt(value: string): bigint {
  return BigInt(value);
}

function getTotalStaked(): bigint {
  let total = BigInt(0);
  for (const stake of stakes.values()) {
    total += stringToBigInt(stake.amount);
  }
  return total || BigInt(1);
}

function calculateVotingPower(amount: bigint, duration: StakeDuration): bigint {
  const multiplier = STAKE_MULTIPLIERS[duration] || 1.0;
  return BigInt(Math.floor(Number(amount) * multiplier));
}

function initializePredictionMarket(proposalId: string) {
  predictionMarkets.set(proposalId, {
    yesShares: '0',
    noShares: '0',
    yesPrice: 0.5,
    noPrice: 0.5,
  });
}

function serializeProposal(p: Proposal): any {
  return {
    ...p,
    votesFor: p.votesFor.toString(),
    votesAgainst: p.votesAgainst.toString(),
    votesAbstain: p.votesAbstain.toString(),
    totalBoostStake: p.totalBoostStake.toString(),
    quorum: p.quorum.toString(),
    effectiveQuorum: p.effectiveQuorum.toString(),
  };
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');
  const wallet = searchParams.get('wallet');
  const status = searchParams.get('status') as ProposalStatus | null;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

  try {
    // Get specific proposal
    if (id && !action) {
      const proposal = proposals.get(id);
      if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }

      const proposalVotes = votes.get(id);
      const proposalBoosts = boosts.get(id) || [];
      const proposalRageQuits = rageQuits.get(id) || [];
      const market = predictionMarkets.get(id);

      return NextResponse.json({
        proposal: serializeProposal(proposal),
        votes: proposalVotes ? Array.from(proposalVotes.entries()).map(([voter, v]) => ({ voter, ...v })) : [],
        boosts: proposalBoosts,
        rageQuits: proposalRageQuits,
        prediction: market,
      });
    }

    // Get governance statistics
    if (action === 'stats') {
      const allProposals = Array.from(proposals.values());

      return NextResponse.json({
        stats: {
          totalProposals: allProposals.length,
          activeProposals: allProposals.filter(p => ['pending', 'active', 'boosted', 'rage_quit_window'].includes(p.status)).length,
          passedProposals: allProposals.filter(p => p.status === 'passed' || p.status === 'executed').length,
          boostedProposals: allProposals.filter(p => p.boosted).length,
          totalRageQuits: Array.from(rageQuits.values()).flat().filter(r => r.status === 'processed').length,
          treasuryBalance: bigIntToString(treasuryBalance),
          totalStaked: bigIntToString(getTotalStaked()),
          stakersCount: stakes.size,
          features: CONFIG.features,
        } as GovernanceStats,
      });
    }

    // Get wallet stake info
    if (action === 'stake' && wallet) {
      const stake = stakes.get(wallet);
      if (!stake) {
        return NextResponse.json({
          wallet,
          staked: false,
          message: 'No stake found for this wallet',
        });
      }

      return NextResponse.json({
        wallet,
        staked: true,
        stake: {
          ...stake,
          canPropose: stringToBigInt(stake.votingPower) >= CONFIG.proposalThreshold,
          canBoost: stringToBigInt(stake.votingPower) >= CONFIG.boostStakeRequired,
        },
      });
    }

    // Get prediction market for proposal
    if (action === 'predictions' && id) {
      const market = predictionMarkets.get(id);
      if (!market) {
        return NextResponse.json({ error: 'Market not found' }, { status: 404 });
      }

      return NextResponse.json({
        proposalId: id,
        market,
        interpretation: {
          willPass: `${(market.yesPrice * 100).toFixed(1)}%`,
          willFail: `${(market.noPrice * 100).toFixed(1)}%`,
        },
      });
    }

    // List proposals with filtering
    let filtered = Array.from(proposals.values());

    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      proposals: paged.map(serializeProposal),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: start + pageSize < total,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, wallet, ...params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    switch (action) {
      // ======================================================================
      // STAKING
      // ======================================================================
      case 'stake': {
        const { amount, duration } = params as { amount: string; duration: StakeDuration };

        if (!amount || !duration) {
          return NextResponse.json({ error: 'Amount and duration required' }, { status: 400 });
        }

        const amountBigInt = stringToBigInt(amount);
        const votingPower = calculateVotingPower(amountBigInt, duration);

        const stakeInfo: StakeInfo = {
          wallet,
          amount,
          stakedAt: Date.now(),
          duration: parseInt(duration) * 24 * 60 * 60 * 1000,
          votingPower: bigIntToString(votingPower),
          effectiveAmount: bigIntToString(votingPower),
        };

        stakes.set(wallet, stakeInfo);

        return NextResponse.json({
          success: true,
          stake: stakeInfo,
          message: `Staked ${amount} tokens for ${duration}`,
        }, { status: 201 });
      }

      case 'unstake': {
        const stake = stakes.get(wallet);
        if (!stake) {
          return NextResponse.json({ error: 'No stake found' }, { status: 404 });
        }

        const now = Date.now();
        const isEarly = now < stake.stakedAt + stake.duration;
        const penalty = isEarly ? 0.1 : 0; // 10% early unstake penalty
        const returnAmount = BigInt(Math.floor(Number(stringToBigInt(stake.amount)) * (1 - penalty)));

        stakes.delete(wallet);

        return NextResponse.json({
          success: true,
          returned: bigIntToString(returnAmount),
          penalty: penalty * 100 + '%',
          wasEarly: isEarly,
        });
      }

      // ======================================================================
      // PROPOSALS
      // ======================================================================
      case 'createProposal': {
        const { title, description, type, votingMode, actions, rageQuitEligible } = params as {
          title: string;
          description: string;
          type: string;
          votingMode?: VotingMode;
          actions: ProposalAction[];
          rageQuitEligible?: boolean;
        };

        if (!title || !description) {
          return NextResponse.json({ error: 'Title and description required' }, { status: 400 });
        }

        const stake = stakes.get(wallet);
        if (!stake || stringToBigInt(stake.votingPower) < CONFIG.proposalThreshold) {
          return NextResponse.json({
            error: 'Insufficient stake to create proposal',
            required: bigIntToString(CONFIG.proposalThreshold),
            have: stake?.votingPower || '0',
          }, { status: 403 });
        }

        proposalCounter++;
        const id = `MCP-GOV-${proposalCounter}`;
        const now = Date.now();
        const totalStaked = getTotalStaked();
        const quorum = (totalStaked * BigInt(CONFIG.regularQuorumPercent)) / BigInt(100);

        const proposal: Proposal = {
          id,
          title,
          description,
          proposer: wallet,
          type: type || 'general',
          status: 'pending',
          votingMode: votingMode || 'conviction',
          votesFor: '0',
          votesAgainst: '0',
          votesAbstain: '0',
          voterCount: 0,
          convictionFor: 0,
          convictionAgainst: 0,
          boosted: false,
          totalBoostStake: '0',
          rageQuitEligible: rageQuitEligible !== false && !['parameter_change', 'emergency'].includes(type),
          quorum: bigIntToString(quorum),
          effectiveQuorum: bigIntToString(quorum),
          requiredConviction: 100,
          createdAt: now,
          votingStartsAt: now + 12 * 60 * 60 * 1000, // 12 hour delay
          votingEndsAt: now + 5 * 24 * 60 * 60 * 1000, // 5 day voting
          actions: actions || [],
        };

        proposals.set(id, proposal);
        votes.set(id, new Map());

        if (CONFIG.features.predictionMarkets) {
          initializePredictionMarket(id);
        }

        return NextResponse.json({
          success: true,
          proposal: serializeProposal(proposal),
          message: `Proposal '${title}' created successfully`,
        }, { status: 201 });
      }

      // ======================================================================
      // VOTING
      // ======================================================================
      case 'vote': {
        const { proposalId, support, reason } = params as {
          proposalId: string;
          support: 'for' | 'against' | 'abstain';
          reason?: string;
        };

        if (!proposalId || !support) {
          return NextResponse.json({ error: 'ProposalId and support required' }, { status: 400 });
        }

        const proposal = proposals.get(proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        const stake = stakes.get(wallet);
        if (!stake) {
          return NextResponse.json({ error: 'No stake found' }, { status: 403 });
        }

        // Check if already voted
        const proposalVotes = votes.get(proposalId) || new Map();
        if (proposalVotes.has(wallet)) {
          return NextResponse.json({ error: 'Already voted on this proposal' }, { status: 409 });
        }

        // Auto-activate if in voting period
        const now = Date.now();
        if (proposal.status === 'pending' && now >= proposal.votingStartsAt && now <= proposal.votingEndsAt) {
          proposal.status = proposal.boosted ? 'boosted' : 'active';
        }

        if (!['active', 'boosted'].includes(proposal.status)) {
          return NextResponse.json({ error: `Cannot vote on proposal with status: ${proposal.status}` }, { status: 400 });
        }

        const votingPower = stringToBigInt(stake.votingPower);

        // Update tallies
        proposal.voterCount++;
        switch (support) {
          case 'for':
            proposal.votesFor = bigIntToString(stringToBigInt(proposal.votesFor) + votingPower);
            break;
          case 'against':
            proposal.votesAgainst = bigIntToString(stringToBigInt(proposal.votesAgainst) + votingPower);
            break;
          case 'abstain':
            proposal.votesAbstain = bigIntToString(stringToBigInt(proposal.votesAbstain) + votingPower);
            break;
        }

        proposalVotes.set(wallet, {
          support,
          votingPower: stake.votingPower,
          timestamp: now,
        });
        votes.set(proposalId, proposalVotes);

        return NextResponse.json({
          success: true,
          vote: {
            proposalId,
            voter: wallet,
            support,
            votingPower: stake.votingPower,
            reason,
          },
          message: `Vote '${support}' cast successfully`,
        });
      }

      // ======================================================================
      // HOLOGRAPHIC BOOSTING
      // ======================================================================
      case 'boost': {
        const { proposalId, prediction } = params as {
          proposalId: string;
          prediction: 'pass' | 'fail';
        };

        if (!CONFIG.features.holographic) {
          return NextResponse.json({ error: 'Holographic consensus not enabled' }, { status: 400 });
        }

        if (!proposalId || !prediction) {
          return NextResponse.json({ error: 'ProposalId and prediction required' }, { status: 400 });
        }

        const proposal = proposals.get(proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        if (proposal.boosted) {
          return NextResponse.json({ error: 'Proposal already boosted' }, { status: 409 });
        }

        const stake = stakes.get(wallet);
        if (!stake || stringToBigInt(stake.votingPower) < CONFIG.boostStakeRequired) {
          return NextResponse.json({
            error: 'Insufficient stake to boost',
            required: bigIntToString(CONFIG.boostStakeRequired),
            have: stake?.votingPower || '0',
          }, { status: 403 });
        }

        // Apply boost
        proposal.boosted = true;
        proposal.status = 'boosted';
        proposal.totalBoostStake = bigIntToString(CONFIG.boostStakeRequired);

        const totalStaked = getTotalStaked();
        proposal.effectiveQuorum = bigIntToString((totalStaked * BigInt(CONFIG.boostedQuorumPercent)) / BigInt(100));
        proposal.votingEndsAt = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 day fast track

        const proposalBoosts = boosts.get(proposalId) || [];
        proposalBoosts.push({
          booster: wallet,
          prediction,
          stake: bigIntToString(CONFIG.boostStakeRequired),
          timestamp: Date.now(),
        });
        boosts.set(proposalId, proposalBoosts);

        return NextResponse.json({
          success: true,
          boost: {
            proposalId,
            booster: wallet,
            prediction,
            stake: bigIntToString(CONFIG.boostStakeRequired),
          },
          proposal: serializeProposal(proposal),
          message: `Proposal boosted with '${prediction}' prediction`,
        });
      }

      // ======================================================================
      // RAGE QUIT
      // ======================================================================
      case 'rageQuit': {
        const { proposalId } = params as { proposalId: string };

        if (!CONFIG.features.rageQuit) {
          return NextResponse.json({ error: 'Rage quit not enabled' }, { status: 400 });
        }

        if (!proposalId) {
          return NextResponse.json({ error: 'ProposalId required' }, { status: 400 });
        }

        const proposal = proposals.get(proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        if (!proposal.rageQuitEligible) {
          return NextResponse.json({ error: 'This proposal is not eligible for rage quit' }, { status: 400 });
        }

        if (!['rage_quit_window', 'passed'].includes(proposal.status)) {
          return NextResponse.json({ error: 'Proposal not in rage quit window' }, { status: 400 });
        }

        const stake = stakes.get(wallet);
        if (!stake) {
          return NextResponse.json({ error: 'No stake found' }, { status: 404 });
        }

        // Check stake duration
        if (Date.now() - stake.stakedAt < CONFIG.minStakeDurationMs) {
          return NextResponse.json({
            error: 'Stake too recent to rage quit',
            minDuration: CONFIG.minStakeDurationMs / (24 * 60 * 60 * 1000) + ' days',
          }, { status: 400 });
        }

        // Calculate pro-rata share
        const totalStaked = getTotalStaked();
        const stakeAmount = stringToBigInt(stake.amount);
        const sharePercent = Number((stakeAmount * BigInt(10000)) / totalStaked) / 10000;
        const claimable = (treasuryBalance * BigInt(Math.floor(sharePercent * 10000))) / BigInt(10000);

        // Process rage quit
        treasuryBalance -= claimable;
        stakes.delete(wallet);

        const proposalRageQuits = rageQuits.get(proposalId) || [];
        proposalRageQuits.push({
          wallet,
          status: 'processed',
          claimable: bigIntToString(claimable),
          timestamp: Date.now(),
        });
        rageQuits.set(proposalId, proposalRageQuits);

        return NextResponse.json({
          success: true,
          rageQuit: {
            wallet,
            proposalId,
            burnedStake: stake.amount,
            claimedTreasury: bigIntToString(claimable),
            sharePercent: (sharePercent * 100).toFixed(4) + '%',
          },
          message: 'Rage quit processed successfully',
        });
      }

      // ======================================================================
      // PREDICTION MARKET
      // ======================================================================
      case 'buyPrediction': {
        const { proposalId, outcome, amount } = params as {
          proposalId: string;
          outcome: 'yes' | 'no';
          amount: string;
        };

        if (!CONFIG.features.predictionMarkets) {
          return NextResponse.json({ error: 'Prediction markets not enabled' }, { status: 400 });
        }

        const market = predictionMarkets.get(proposalId);
        if (!market) {
          return NextResponse.json({ error: 'Market not found' }, { status: 404 });
        }

        const amountBigInt = stringToBigInt(amount);

        // Update shares (simplified AMM)
        if (outcome === 'yes') {
          const newYes = stringToBigInt(market.yesShares) + amountBigInt;
          market.yesShares = bigIntToString(newYes);
        } else {
          const newNo = stringToBigInt(market.noShares) + amountBigInt;
          market.noShares = bigIntToString(newNo);
        }

        // Update prices
        const totalYes = stringToBigInt(market.yesShares) + BigInt(1e18);
        const totalNo = stringToBigInt(market.noShares) + BigInt(1e18);
        const total = totalYes + totalNo;
        market.yesPrice = Number(totalYes) / Number(total);
        market.noPrice = 1 - market.yesPrice;

        return NextResponse.json({
          success: true,
          purchase: {
            proposalId,
            outcome,
            amount,
            newPrice: outcome === 'yes' ? market.yesPrice : market.noPrice,
          },
          market,
        });
      }

      // ======================================================================
      // FINALIZE PROPOSAL
      // ======================================================================
      case 'finalize': {
        const { proposalId } = params as { proposalId: string };

        const proposal = proposals.get(proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        if (['passed', 'rejected', 'executed'].includes(proposal.status)) {
          return NextResponse.json({ proposal: serializeProposal(proposal) });
        }

        const now = Date.now();
        if (now < proposal.votingEndsAt) {
          return NextResponse.json({ error: 'Voting period not ended' }, { status: 400 });
        }

        // Determine outcome
        const totalVotes = stringToBigInt(proposal.votesFor) + stringToBigInt(proposal.votesAgainst);
        const meetsQuorum = totalVotes >= stringToBigInt(proposal.effectiveQuorum);
        const passed = meetsQuorum && stringToBigInt(proposal.votesFor) > stringToBigInt(proposal.votesAgainst);

        if (passed) {
          if (proposal.rageQuitEligible && CONFIG.features.rageQuit) {
            proposal.status = 'rage_quit_window';
            proposal.gracePeriodEndsAt = now + CONFIG.gracePeriodMs;
            proposal.executionETA = proposal.gracePeriodEndsAt;
          } else {
            proposal.status = 'passed';
            proposal.executionETA = now;
          }
        } else {
          proposal.status = 'rejected';
        }

        return NextResponse.json({
          success: true,
          proposal: serializeProposal(proposal),
          outcome: {
            passed,
            meetsQuorum,
            forVotes: proposal.votesFor,
            againstVotes: proposal.votesAgainst,
            quorumRequired: proposal.effectiveQuorum,
          },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
