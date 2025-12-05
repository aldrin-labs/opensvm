import { NextRequest, NextResponse } from 'next/server';

/**
 * Gauge Proposals REST API
 *
 * Endpoints:
 * - GET /api/gauge-proposals - List proposals with filters
 * - POST /api/gauge-proposals - Create new gauge proposal
 * - PUT /api/gauge-proposals - Vote on or finalize proposal
 */

type ProposalStatus = 'pending' | 'active' | 'vetoed' | 'passed' | 'rejected' | 'slashed';

interface GaugeProposal {
  id: string;
  poolId: string;
  poolName: string;
  description: string;
  proposer: string;
  deposit: number;
  createdAt: number;
  proposalEnd: number;
  activationTime?: number;
  status: ProposalStatus;
  supportVotes: number;
  vetoVotes: number;
  voters: Map<string, 'support' | 'veto'>;
  gaugeId?: string;
}

// Configuration
const CONFIG = {
  minDeposit: 1000,
  proposalPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  vetoThreshold: 0.1,
  supportThreshold: 0.5,
  minParticipation: 0.01,
  activationDelay: 2 * 24 * 60 * 60 * 1000, // 2 days
  slashPercentage: 0.5,
};

// Mock storage
const proposals = new Map<string, GaugeProposal>();
const veBalances = new Map<string, number>();
const existingGauges = new Set<string>();
let proposalCounter = 0;
let treasury = 0;

// Initialize test data
veBalances.set('alice', 10000);
veBalances.set('bob', 5000);
veBalances.set('charlie', 2000);
veBalances.set('dave', 1000);

function getVeBalance(address: string): number {
  return veBalances.get(address) || 0;
}

function getTotalVeSupply(): number {
  let total = 0;
  for (const balance of veBalances.values()) {
    total += balance;
  }
  return total;
}

function serializeProposal(proposal: GaugeProposal) {
  return {
    ...proposal,
    voters: Object.fromEntries(proposal.voters),
    participation: getTotalVeSupply() > 0
      ? (proposal.supportVotes + proposal.vetoVotes) / getTotalVeSupply()
      : 0,
    supportRatio: (proposal.supportVotes + proposal.vetoVotes) > 0
      ? proposal.supportVotes / (proposal.supportVotes + proposal.vetoVotes)
      : 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ProposalStatus | null;
    const proposalId = searchParams.get('id');
    const action = searchParams.get('action');

    // Get specific proposal
    if (proposalId) {
      const proposal = proposals.get(proposalId);
      if (!proposal) {
        return NextResponse.json(
          { success: false, error: 'Proposal not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: serializeProposal(proposal)
      });
    }

    // Get proposals pending finalization
    if (action === 'pending-finalization') {
      const now = Date.now();
      const pending = Array.from(proposals.values())
        .filter(p => p.status === 'pending' && now >= p.proposalEnd)
        .map(serializeProposal);

      return NextResponse.json({
        success: true,
        data: { proposals: pending }
      });
    }

    // Get proposals ready for activation
    if (action === 'ready-activation') {
      const now = Date.now();
      const ready = Array.from(proposals.values())
        .filter(p => p.status === 'passed' && p.activationTime && now >= p.activationTime)
        .map(serializeProposal);

      return NextResponse.json({
        success: true,
        data: { proposals: ready }
      });
    }

    // Get stats
    if (action === 'stats') {
      const allProposals = Array.from(proposals.values());
      const pending = allProposals.filter(p => p.status === 'pending').length;
      const active = allProposals.filter(p => p.status === 'active').length;
      const vetoed = allProposals.filter(p => p.status === 'vetoed').length;
      const finalized = allProposals.filter(p => ['active', 'rejected', 'vetoed'].includes(p.status));
      const passed = allProposals.filter(p => ['active', 'passed'].includes(p.status)).length;

      return NextResponse.json({
        success: true,
        data: {
          totalProposals: allProposals.length,
          pendingProposals: pending,
          activeGauges: active,
          vetoedProposals: vetoed,
          totalDeposited: allProposals.reduce((sum, p) => sum + p.deposit, 0),
          treasuryBalance: treasury,
          avgPassRate: finalized.length > 0 ? passed / finalized.length : 0,
        }
      });
    }

    // Filter by status
    let filtered = Array.from(proposals.values());
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      success: true,
      data: {
        proposals: filtered.map(serializeProposal),
        total: filtered.length,
      }
    });

  } catch (error) {
    console.error('[Gauge Proposals API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposer, poolId, poolName, description, deposit } = body;

    // Validations
    if (!proposer || !poolId || !poolName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: proposer, poolId, poolName' },
        { status: 400 }
      );
    }

    if (!deposit || deposit < CONFIG.minDeposit) {
      return NextResponse.json(
        { success: false, error: `Minimum deposit is ${CONFIG.minDeposit} SVMAI` },
        { status: 400 }
      );
    }

    // Check for duplicate pool
    for (const proposal of proposals.values()) {
      if (proposal.poolId === poolId && ['pending', 'active', 'passed'].includes(proposal.status)) {
        return NextResponse.json(
          { success: false, error: 'Gauge proposal for this pool already exists' },
          { status: 400 }
        );
      }
    }

    // Check existing gauge
    if (existingGauges.has(poolId)) {
      return NextResponse.json(
        { success: false, error: 'Gauge for this pool already exists' },
        { status: 400 }
      );
    }

    proposalCounter++;
    const proposal: GaugeProposal = {
      id: `PROP-${proposalCounter}`,
      poolId,
      poolName,
      description: description || '',
      proposer,
      deposit,
      createdAt: Date.now(),
      proposalEnd: Date.now() + CONFIG.proposalPeriod,
      status: 'pending',
      supportVotes: 0,
      vetoVotes: 0,
      voters: new Map(),
    };

    proposals.set(proposal.id, proposal);

    return NextResponse.json({
      success: true,
      data: {
        proposal: serializeProposal(proposal),
        votingEnds: new Date(proposal.proposalEnd).toISOString(),
      }
    });

  } catch (error) {
    console.error('[Gauge Proposals API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, proposalId, voter, support } = body;

    const proposal = proposals.get(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Vote on proposal
    if (action === 'vote') {
      if (!voter) {
        return NextResponse.json(
          { success: false, error: 'Voter address required' },
          { status: 400 }
        );
      }

      if (proposal.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Proposal is not in voting period' },
          { status: 400 }
        );
      }

      if (Date.now() >= proposal.proposalEnd) {
        return NextResponse.json(
          { success: false, error: 'Voting period has ended' },
          { status: 400 }
        );
      }

      const voterVe = getVeBalance(voter);
      if (voterVe <= 0) {
        return NextResponse.json(
          { success: false, error: 'Must have veSVMAI to vote' },
          { status: 400 }
        );
      }

      // Update existing vote if any
      const existingVote = proposal.voters.get(voter);
      if (existingVote) {
        if (existingVote === 'support') {
          proposal.supportVotes -= voterVe;
        } else {
          proposal.vetoVotes -= voterVe;
        }
      }

      // Record new vote
      if (support) {
        proposal.supportVotes += voterVe;
        proposal.voters.set(voter, 'support');
      } else {
        proposal.vetoVotes += voterVe;
        proposal.voters.set(voter, 'veto');
      }

      return NextResponse.json({
        success: true,
        data: {
          proposal: serializeProposal(proposal),
          voted: support ? 'support' : 'veto',
          veAmount: voterVe,
        }
      });
    }

    // Finalize proposal
    if (action === 'finalize') {
      if (proposal.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Proposal already finalized' },
          { status: 400 }
        );
      }

      if (Date.now() < proposal.proposalEnd) {
        return NextResponse.json(
          { success: false, error: 'Voting period not ended' },
          { status: 400 }
        );
      }

      const totalVeSupply = getTotalVeSupply();
      const totalVotes = proposal.supportVotes + proposal.vetoVotes;
      const participation = totalVeSupply > 0 ? totalVotes / totalVeSupply : 0;

      let result: { status: ProposalStatus; reason: string; slashed?: number; returned?: number };

      // Check veto first
      if (proposal.vetoVotes / totalVeSupply >= CONFIG.vetoThreshold) {
        proposal.status = 'vetoed';
        const slashAmount = proposal.deposit * CONFIG.slashPercentage;
        treasury += slashAmount;
        result = {
          status: 'vetoed',
          reason: 'Veto threshold reached',
          slashed: slashAmount,
          returned: proposal.deposit - slashAmount,
        };
      }
      // Check minimum participation
      else if (participation < CONFIG.minParticipation) {
        proposal.status = 'rejected';
        result = {
          status: 'rejected',
          reason: 'Insufficient participation',
          returned: proposal.deposit,
        };
      }
      // Check support threshold
      else {
        const supportRatio = totalVotes > 0 ? proposal.supportVotes / totalVotes : 0;

        if (supportRatio >= CONFIG.supportThreshold) {
          proposal.status = 'passed';
          proposal.activationTime = Date.now() + CONFIG.activationDelay;
          result = {
            status: 'passed',
            reason: `Support ratio ${(supportRatio * 100).toFixed(1)}% exceeded threshold`,
            returned: proposal.deposit,
          };
        } else {
          proposal.status = 'rejected';
          result = {
            status: 'rejected',
            reason: 'Insufficient support',
            returned: proposal.deposit,
          };
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          proposal: serializeProposal(proposal),
          result,
        }
      });
    }

    // Activate proposal (create gauge)
    if (action === 'activate') {
      if (proposal.status !== 'passed') {
        return NextResponse.json(
          { success: false, error: 'Proposal must be passed to activate' },
          { status: 400 }
        );
      }

      if (!proposal.activationTime || Date.now() < proposal.activationTime) {
        return NextResponse.json(
          { success: false, error: 'Activation delay not elapsed' },
          { status: 400 }
        );
      }

      // Create gauge
      proposal.gaugeId = `GAUGE-${proposal.poolId}`;
      proposal.status = 'active';
      existingGauges.add(proposal.poolId);

      return NextResponse.json({
        success: true,
        data: {
          proposal: serializeProposal(proposal),
          gauge: {
            id: proposal.gaugeId,
            poolId: proposal.poolId,
            name: proposal.poolName,
          }
        }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: vote, finalize, or activate' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Gauge Proposals API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
