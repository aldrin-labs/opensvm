/**
 * SVMAI Governance API
 *
 * DAO governance endpoints for proposal management and voting.
 *
 * GET /api/governance - Get all proposals
 * GET /api/governance?id=xxx - Get specific proposal
 * GET /api/governance?action=stats - Get governance statistics
 * GET /api/governance?action=power&wallet=xxx - Get voting power
 * POST /api/governance - Create proposal or vote
 */

import { NextRequest, NextResponse } from 'next/server';

// Types
type ProposalStatus = 'pending' | 'active' | 'passed' | 'rejected' | 'executed';
type ProposalType = 'parameter' | 'treasury' | 'upgrade' | 'feature' | 'emergency' | 'text';

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: ProposalType;
  status: ProposalStatus;
  votesFor: string;
  votesAgainst: string;
  quorum: string;
  startTime: number;
  endTime: number;
  discussionUrl?: string;
  actions?: Array<{ target: string; function: string; params: Record<string, any> }>;
}

interface Vote {
  voter: string;
  support: boolean;
  votingPower: string;
  reason?: string;
  timestamp: number;
}

// Mock data
const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'SVMAI-1',
    title: 'Increase Staking Rewards by 25%',
    description: 'This proposal increases the staking reward rate from 40% to 50% of platform revenue to incentivize long-term holding and reduce circulating supply.',
    proposer: 'Hx8f...4kZp',
    type: 'parameter',
    status: 'active',
    votesFor: '2,450,000',
    votesAgainst: '380,000',
    quorum: '1,000,000',
    startTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
    endTime: Date.now() + 1 * 24 * 60 * 60 * 1000,
    discussionUrl: 'https://forum.osvm.ai/proposals/1',
    actions: [
      { target: 'staking', function: 'setRewardRate', params: { rate: 50 } },
    ],
  },
  {
    id: 'SVMAI-2',
    title: 'Fund Community Developer Grants',
    description: 'Allocate 500,000 SVMAI from treasury for community developer grants to build MCP tools and integrations.',
    proposer: '7pQx...mN3v',
    type: 'treasury',
    status: 'passed',
    votesFor: '4,200,000',
    votesAgainst: '850,000',
    quorum: '1,000,000',
    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
    endTime: Date.now() - 4 * 24 * 60 * 60 * 1000,
    actions: [
      { target: 'treasury', function: 'transfer', params: { recipient: 'grants-multisig', amount: '500000' } },
    ],
  },
  {
    id: 'SVMAI-3',
    title: 'Add Quadratic Voting Option',
    description: 'Enable optional quadratic voting for future proposals to give smaller holders more influence.',
    proposer: 'Bk2m...x9Lp',
    type: 'feature',
    status: 'pending',
    votesFor: '0',
    votesAgainst: '0',
    quorum: '1,000,000',
    startTime: Date.now() + 1 * 24 * 60 * 60 * 1000,
    endTime: Date.now() + 4 * 24 * 60 * 60 * 1000,
    actions: [
      { target: 'governance', function: 'setQuadraticVoting', params: { enabled: true } },
    ],
  },
  {
    id: 'SVMAI-4',
    title: 'Reduce Free Tier Rate Limits',
    description: 'Reduce free tier from 100 to 50 requests/day to encourage token holding.',
    proposer: 'Dp4k...n8Wq',
    type: 'parameter',
    status: 'rejected',
    votesFor: '320,000',
    votesAgainst: '1,850,000',
    quorum: '1,000,000',
    startTime: Date.now() - 14 * 24 * 60 * 60 * 1000,
    endTime: Date.now() - 11 * 24 * 60 * 60 * 1000,
    actions: [
      { target: 'tokenomics', function: 'setTierLimit', params: { tier: 'free', limit: 50 } },
    ],
  },
];

const MOCK_VOTES: Record<string, Vote[]> = {
  'SVMAI-1': [
    { voter: 'Hx8f...4kZp', support: true, votingPower: '50,000', reason: 'Good for long-term holders', timestamp: Date.now() - 1.5 * 24 * 60 * 60 * 1000 },
    { voter: '7pQx...mN3v', support: true, votingPower: '120,000', timestamp: Date.now() - 1.2 * 24 * 60 * 60 * 1000 },
    { voter: 'Bk2m...x9Lp', support: false, votingPower: '80,000', reason: 'Treasury needs funds too', timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000 },
  ],
  'SVMAI-2': [
    { voter: 'Hx8f...4kZp', support: true, votingPower: '50,000', timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000 },
    { voter: '7pQx...mN3v', support: true, votingPower: '120,000', timestamp: Date.now() - 5.5 * 24 * 60 * 60 * 1000 },
  ],
};

const GOVERNANCE_STATS = {
  totalProposals: 4,
  activeProposals: 1,
  passedProposals: 1,
  rejectedProposals: 1,
  executedProposals: 0,
  totalVotesCast: 156,
  uniqueVoters: 89,
  averageParticipation: 0.65,
  treasuryBalance: '2,500,000',
  totalVotingPower: '8,450,000',
};

const GOVERNANCE_CONFIG = {
  proposalThreshold: 1000,
  quorumPercentage: 10,
  votingDelayDays: 1,
  votingPeriodDays: 3,
  timelockDelayDays: 2,
  gracePeriodDays: 7,
  votingPowerSource: 'staked',
  quadraticVoting: false,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');
  const wallet = searchParams.get('wallet');
  const status = searchParams.get('status');

  try {
    // Get governance statistics
    if (action === 'stats') {
      return NextResponse.json({
        stats: GOVERNANCE_STATS,
        config: GOVERNANCE_CONFIG,
      });
    }

    // Get voting power for a wallet
    if (action === 'power' && wallet) {
      // Mock voting power calculation
      const stakedBalance = '1,500';
      const delegatedTo = undefined;
      const delegatedFrom = ['Abc...123'];
      const delegatedPower = '500';
      const totalPower = '2,000';

      return NextResponse.json({
        wallet,
        stakedBalance,
        delegatedTo,
        delegatedFrom,
        delegatedPower,
        totalVotingPower: totalPower,
        canCreateProposal: parseFloat(totalPower.replace(',', '')) >= GOVERNANCE_CONFIG.proposalThreshold,
      });
    }

    // Get delegation info
    if (action === 'delegation' && wallet) {
      return NextResponse.json({
        wallet,
        delegatedTo: null,
        delegatedFrom: [],
        totalDelegatedPower: '0',
      });
    }

    // Get specific proposal
    if (id) {
      const proposal = MOCK_PROPOSALS.find(p => p.id === id);
      if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }

      const votes = MOCK_VOTES[id] || [];
      const hasQuorum = parseFloat(proposal.votesFor.replace(/,/g, '')) + parseFloat(proposal.votesAgainst.replace(/,/g, '')) >= parseFloat(proposal.quorum.replace(/,/g, ''));

      return NextResponse.json({
        proposal,
        votes,
        voteCount: votes.length,
        hasQuorum,
        timeRemaining: Math.max(0, proposal.endTime - Date.now()),
      });
    }

    // Get all proposals (with optional status filter)
    let proposals = [...MOCK_PROPOSALS];
    if (status) {
      proposals = proposals.filter(p => p.status === status);
    }

    return NextResponse.json({
      proposals,
      total: proposals.length,
      config: GOVERNANCE_CONFIG,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, wallet } = body;

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    switch (action) {
      case 'create_proposal': {
        const { title, description, type, actions, discussionUrl } = body;

        if (!title || !description || !type) {
          return NextResponse.json(
            { error: 'Missing required fields: title, description, type' },
            { status: 400 }
          );
        }

        // Mock proposal creation
        const newProposal: Proposal = {
          id: `SVMAI-${MOCK_PROPOSALS.length + 1}`,
          title,
          description,
          proposer: wallet.slice(0, 4) + '...' + wallet.slice(-4),
          type,
          status: 'pending',
          votesFor: '0',
          votesAgainst: '0',
          quorum: '1,000,000',
          startTime: Date.now() + GOVERNANCE_CONFIG.votingDelayDays * 24 * 60 * 60 * 1000,
          endTime: Date.now() + (GOVERNANCE_CONFIG.votingDelayDays + GOVERNANCE_CONFIG.votingPeriodDays) * 24 * 60 * 60 * 1000,
          discussionUrl,
          actions,
        };

        return NextResponse.json({
          success: true,
          proposal: newProposal,
          message: 'Proposal created successfully',
        });
      }

      case 'vote': {
        const { proposalId, support, reason } = body;

        if (!proposalId || support === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields: proposalId, support' },
            { status: 400 }
          );
        }

        const proposal = MOCK_PROPOSALS.find(p => p.id === proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        if (proposal.status !== 'active') {
          return NextResponse.json(
            { error: `Cannot vote on proposal with status: ${proposal.status}` },
            { status: 400 }
          );
        }

        // Mock vote recording
        const vote: Vote = {
          voter: wallet.slice(0, 4) + '...' + wallet.slice(-4),
          support,
          votingPower: '1,500', // Mock voting power
          reason,
          timestamp: Date.now(),
        };

        return NextResponse.json({
          success: true,
          vote,
          message: `Vote ${support ? 'for' : 'against'} recorded successfully`,
        });
      }

      case 'delegate': {
        const { delegatee } = body;

        if (!delegatee) {
          return NextResponse.json({ error: 'Delegatee address required' }, { status: 400 });
        }

        if (delegatee === wallet) {
          return NextResponse.json({ error: 'Cannot delegate to self' }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          delegator: wallet,
          delegatee,
          message: 'Voting power delegated successfully',
        });
      }

      case 'undelegate': {
        return NextResponse.json({
          success: true,
          wallet,
          message: 'Delegation removed successfully',
        });
      }

      case 'queue': {
        const { proposalId } = body;

        const proposal = MOCK_PROPOSALS.find(p => p.id === proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        if (proposal.status !== 'passed') {
          return NextResponse.json(
            { error: 'Only passed proposals can be queued' },
            { status: 400 }
          );
        }

        const executionETA = Date.now() + GOVERNANCE_CONFIG.timelockDelayDays * 24 * 60 * 60 * 1000;

        return NextResponse.json({
          success: true,
          proposalId,
          executionETA,
          message: 'Proposal queued for execution',
        });
      }

      case 'execute': {
        const { proposalId } = body;

        const proposal = MOCK_PROPOSALS.find(p => p.id === proposalId);
        if (!proposal) {
          return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          proposalId,
          executedAt: Date.now(),
          results: proposal.actions?.map(a => ({
            action: a,
            success: true,
          })) || [],
          message: 'Proposal executed successfully',
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
