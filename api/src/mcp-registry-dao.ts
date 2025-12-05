/**
 * MCP Registry DAO Governance
 *
 * Decentralized governance for the MCP server registry:
 * - Server listing approval/rejection votes
 * - Featured server curation
 * - Grant allocation for server developers
 * - Parameter changes (fees, thresholds)
 * - Emergency actions (delistings, pauses)
 *
 * Governance Model:
 * - Quadratic voting for fair representation
 * - Time-weighted voting power (longer stakes = more power)
 * - Delegation support
 * - Timelock for execution
 */

import { UnifiedMCPRegistry, type UnifiedServer } from './mcp-registry-unified.js';

// ============================================================================
// Types
// ============================================================================

export type DAOProposalType =
  | 'listing_approval'      // Approve new server listing
  | 'listing_removal'       // Remove server from registry
  | 'featured_curation'     // Vote for featured servers
  | 'grant_allocation'      // Allocate funds to developers
  | 'parameter_change'      // Change registry parameters
  | 'emergency_action';     // Emergency delistings/pauses

export type DAOProposalStatus =
  | 'draft'                 // Being created
  | 'pending'               // Awaiting voting start
  | 'active'                // Voting in progress
  | 'passed'                // Passed, awaiting execution
  | 'rejected'              // Did not pass
  | 'executed'              // Successfully executed
  | 'vetoed'                // Vetoed by guardian
  | 'expired';              // Expired without execution

export interface DAOVoter {
  wallet: string;
  votingPower: bigint;
  delegatedPower: bigint;
  totalPower: bigint;
  stakeDuration: string;
  multiplier: number;
}

export interface DAOVote {
  voter: string;
  proposalId: string;
  support: 'for' | 'against' | 'abstain';
  votingPower: bigint;
  quadraticPower: bigint;  // sqrt(votingPower) for quadratic voting
  reason?: string;
  timestamp: number;
}

export interface DAOProposal {
  id: string;
  type: DAOProposalType;
  title: string;
  description: string;
  proposer: string;
  status: DAOProposalStatus;

  // Targets
  targetServerId?: string;
  targetServers?: string[];
  targetWallet?: string;
  parameterKey?: string;
  parameterValue?: any;

  // Grant specific
  grantAmount?: bigint;
  grantRecipient?: string;
  grantMilestones?: string[];

  // Voting
  votesFor: bigint;
  votesAgainst: bigint;
  votesAbstain: bigint;
  quadraticFor: bigint;
  quadraticAgainst: bigint;
  voterCount: number;
  quorum: bigint;

  // Timeline
  createdAt: number;
  votingStartBlock: number;
  votingEndBlock: number;
  executionETA?: number;
  executedAt?: number;

  // Metadata
  discussionUrl?: string;
  ipfsHash?: string;
}

export interface CurationRound {
  id: string;
  startTime: number;
  endTime: number;
  totalVotingPower: bigint;
  servers: Map<string, bigint>;  // serverId -> total votes
  voters: Map<string, Map<string, bigint>>;  // voter -> serverId -> votes
  winners: string[];
  status: 'active' | 'ended' | 'finalized';
}

export interface GrantProgram {
  id: string;
  name: string;
  description: string;
  totalBudget: bigint;
  remainingBudget: bigint;
  minGrant: bigint;
  maxGrant: bigint;
  applicationDeadline: number;
  status: 'open' | 'reviewing' | 'closed';
  applications: GrantApplication[];
}

export interface GrantApplication {
  id: string;
  programId: string;
  applicant: string;
  serverId?: string;
  title: string;
  description: string;
  requestedAmount: bigint;
  milestones: { description: string; amount: bigint; deadline: number }[];
  status: 'submitted' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  votes: Map<string, boolean>;
  submittedAt: number;
}

// ============================================================================
// Configuration
// ============================================================================

export const DAO_CONFIG = {
  // Voting thresholds
  proposalThreshold: BigInt(1000) * BigInt(1e9),     // 1,000 tokens to propose
  quorumPercentage: 4,                                // 4% of total supply
  passingThreshold: 50,                               // 50% to pass

  // Timeline (in blocks, assuming 400ms/block)
  votingDelayBlocks: 6570,                           // ~12 hours
  votingPeriodBlocks: 46080,                         // ~5 days
  timelockDelayBlocks: 13140,                        // ~24 hours
  gracePeriodBlocks: 65700,                          // ~7 days

  // Quadratic voting
  enableQuadraticVoting: true,
  quadraticCoefficient: 1,

  // Curation
  featuredSlots: 5,
  curationRoundDays: 14,

  // Grants
  minGrantAmount: BigInt(100) * BigInt(1e9),         // 100 tokens
  maxGrantAmount: BigInt(50000) * BigInt(1e9),       // 50,000 tokens
  grantTreasuryPercent: 20,                          // 20% of revenue to grants

  // Emergency
  guardianMultisig: 'GuardianMultisig11111111111111111111111111',
  emergencyQuorum: 10,                               // 10% for emergency actions
};

// ============================================================================
// DAO Governance Manager
// ============================================================================

export class MCPRegistryDAO {
  private proposals = new Map<string, DAOProposal>();
  private votes = new Map<string, Map<string, DAOVote>>();  // proposalId -> voter -> vote
  private voters = new Map<string, DAOVoter>();
  private delegations = new Map<string, string>();  // delegator -> delegatee
  private curationRounds = new Map<string, CurationRound>();
  private grantPrograms = new Map<string, GrantProgram>();
  private registry: UnifiedMCPRegistry;
  private proposalCount = 0;
  private currentBlock = 0;

  constructor(registry: UnifiedMCPRegistry) {
    this.registry = registry;
  }

  // ==========================================================================
  // Voting Power
  // ==========================================================================

  /**
   * Register a voter with their staking info
   */
  registerVoter(wallet: string, stakedAmount: bigint, stakeDuration: string): DAOVoter {
    const multiplier = this.getStakingMultiplier(stakeDuration);
    const votingPower = stakedAmount * BigInt(Math.floor(multiplier * 100)) / BigInt(100);

    // Calculate delegated power
    let delegatedPower = BigInt(0);
    for (const [delegator, delegatee] of this.delegations) {
      if (delegatee === wallet) {
        const delegatorVoter = this.voters.get(delegator);
        if (delegatorVoter) {
          delegatedPower += delegatorVoter.votingPower;
        }
      }
    }

    const voter: DAOVoter = {
      wallet,
      votingPower,
      delegatedPower,
      totalPower: votingPower + delegatedPower,
      stakeDuration,
      multiplier,
    };

    this.voters.set(wallet, voter);
    return voter;
  }

  private getStakingMultiplier(duration: string): number {
    const multipliers: Record<string, number> = {
      '7d': 1.0,
      '30d': 1.25,
      '90d': 1.5,
      '180d': 1.75,
      '365d': 2.0,
    };
    return multipliers[duration] || 1.0;
  }

  /**
   * Delegate voting power to another address
   */
  delegate(delegator: string, delegatee: string): void {
    if (delegator === delegatee) {
      throw new Error('Cannot delegate to self');
    }

    const voter = this.voters.get(delegator);
    if (!voter) {
      throw new Error('Delegator not registered');
    }

    this.delegations.set(delegator, delegatee);

    // Update delegatee's power
    const delegateeVoter = this.voters.get(delegatee);
    if (delegateeVoter) {
      delegateeVoter.delegatedPower += voter.votingPower;
      delegateeVoter.totalPower = delegateeVoter.votingPower + delegateeVoter.delegatedPower;
    }

    console.log(`[DAO] Delegated: ${delegator} -> ${delegatee}`);
  }

  /**
   * Remove delegation
   */
  undelegate(delegator: string): void {
    const delegatee = this.delegations.get(delegator);
    if (!delegatee) return;

    const voter = this.voters.get(delegator);
    const delegateeVoter = this.voters.get(delegatee);

    if (voter && delegateeVoter) {
      delegateeVoter.delegatedPower -= voter.votingPower;
      delegateeVoter.totalPower = delegateeVoter.votingPower + delegateeVoter.delegatedPower;
    }

    this.delegations.delete(delegator);
    console.log(`[DAO] Undelegated: ${delegator}`);
  }

  // ==========================================================================
  // Proposal Creation
  // ==========================================================================

  /**
   * Create a new proposal
   */
  createProposal(
    proposer: string,
    type: DAOProposalType,
    params: {
      title: string;
      description: string;
      targetServerId?: string;
      targetServers?: string[];
      targetWallet?: string;
      parameterKey?: string;
      parameterValue?: any;
      grantAmount?: bigint;
      grantRecipient?: string;
      grantMilestones?: string[];
      discussionUrl?: string;
    }
  ): DAOProposal {
    const voter = this.voters.get(proposer);
    if (!voter || voter.totalPower < DAO_CONFIG.proposalThreshold) {
      throw new Error(
        `Insufficient voting power. Required: ${DAO_CONFIG.proposalThreshold}, have: ${voter?.totalPower || 0}`
      );
    }

    this.proposalCount++;
    const id = `MCP-DAO-${this.proposalCount}`;

    const proposal: DAOProposal = {
      id,
      type,
      title: params.title,
      description: params.description,
      proposer,
      status: 'pending',
      targetServerId: params.targetServerId,
      targetServers: params.targetServers,
      targetWallet: params.targetWallet,
      parameterKey: params.parameterKey,
      parameterValue: params.parameterValue,
      grantAmount: params.grantAmount,
      grantRecipient: params.grantRecipient,
      grantMilestones: params.grantMilestones,
      votesFor: BigInt(0),
      votesAgainst: BigInt(0),
      votesAbstain: BigInt(0),
      quadraticFor: BigInt(0),
      quadraticAgainst: BigInt(0),
      voterCount: 0,
      quorum: this.calculateQuorum(),
      createdAt: Date.now(),
      votingStartBlock: this.currentBlock + DAO_CONFIG.votingDelayBlocks,
      votingEndBlock: this.currentBlock + DAO_CONFIG.votingDelayBlocks + DAO_CONFIG.votingPeriodBlocks,
      discussionUrl: params.discussionUrl,
    };

    this.proposals.set(id, proposal);
    this.votes.set(id, new Map());

    console.log(`[DAO] Proposal created: ${id} - ${params.title}`);
    return proposal;
  }

  private calculateQuorum(): bigint {
    let totalPower = BigInt(0);
    for (const voter of this.voters.values()) {
      totalPower += voter.votingPower;
    }
    return (totalPower * BigInt(DAO_CONFIG.quorumPercentage)) / BigInt(100);
  }

  // ==========================================================================
  // Voting
  // ==========================================================================

  /**
   * Cast a vote on a proposal
   */
  vote(
    proposalId: string,
    voter: string,
    support: 'for' | 'against' | 'abstain',
    reason?: string
  ): DAOVote {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Check if voting is active
    if (proposal.status !== 'active') {
      // Auto-activate if in voting period
      if (
        this.currentBlock >= proposal.votingStartBlock &&
        this.currentBlock <= proposal.votingEndBlock
      ) {
        proposal.status = 'active';
      } else {
        throw new Error(`Proposal is not active (status: ${proposal.status})`);
      }
    }

    // Check if already voted
    const proposalVotes = this.votes.get(proposalId)!;
    if (proposalVotes.has(voter)) {
      throw new Error('Already voted on this proposal');
    }

    // Get voting power
    const voterInfo = this.voters.get(voter);
    if (!voterInfo || voterInfo.totalPower === BigInt(0)) {
      throw new Error('No voting power');
    }

    // Calculate quadratic power
    const quadraticPower = DAO_CONFIG.enableQuadraticVoting
      ? BigInt(Math.floor(Math.sqrt(Number(voterInfo.totalPower))))
      : voterInfo.totalPower;

    const vote: DAOVote = {
      voter,
      proposalId,
      support,
      votingPower: voterInfo.totalPower,
      quadraticPower,
      reason,
      timestamp: Date.now(),
    };

    // Record vote
    proposalVotes.set(voter, vote);
    proposal.voterCount++;

    // Update tallies
    switch (support) {
      case 'for':
        proposal.votesFor += voterInfo.totalPower;
        proposal.quadraticFor += quadraticPower;
        break;
      case 'against':
        proposal.votesAgainst += voterInfo.totalPower;
        proposal.quadraticAgainst += quadraticPower;
        break;
      case 'abstain':
        proposal.votesAbstain += voterInfo.totalPower;
        break;
    }

    console.log(`[DAO] Vote cast: ${voter} voted ${support} on ${proposalId}`);
    return vote;
  }

  /**
   * Finalize voting and determine outcome
   */
  finalizeVoting(proposalId: string): DAOProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'active') {
      throw new Error('Proposal is not active');
    }

    if (this.currentBlock < proposal.votingEndBlock) {
      throw new Error('Voting period not ended');
    }

    const totalVotes = proposal.votesFor + proposal.votesAgainst;

    // Check quorum
    if (totalVotes < proposal.quorum) {
      proposal.status = 'rejected';
      console.log(`[DAO] Proposal ${proposalId} rejected: quorum not met`);
      return proposal;
    }

    // Determine outcome (using quadratic votes if enabled)
    const forVotes = DAO_CONFIG.enableQuadraticVoting ? proposal.quadraticFor : proposal.votesFor;
    const againstVotes = DAO_CONFIG.enableQuadraticVoting ? proposal.quadraticAgainst : proposal.votesAgainst;
    const totalQuadratic = forVotes + againstVotes;

    const passingPercent = totalQuadratic > 0
      ? Number((forVotes * BigInt(100)) / totalQuadratic)
      : 0;

    if (passingPercent >= DAO_CONFIG.passingThreshold) {
      proposal.status = 'passed';
      proposal.executionETA = Date.now() + DAO_CONFIG.timelockDelayBlocks * 400;
      console.log(`[DAO] Proposal ${proposalId} passed with ${passingPercent}%`);
    } else {
      proposal.status = 'rejected';
      console.log(`[DAO] Proposal ${proposalId} rejected with ${passingPercent}%`);
    }

    return proposal;
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute a passed proposal
   */
  execute(proposalId: string): { success: boolean; result?: any; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { success: false, error: 'Proposal not found' };
    }

    if (proposal.status !== 'passed') {
      return { success: false, error: 'Proposal not passed' };
    }

    if (proposal.executionETA && Date.now() < proposal.executionETA) {
      return { success: false, error: 'Timelock not expired' };
    }

    try {
      let result: any;

      switch (proposal.type) {
        case 'listing_approval':
          if (proposal.targetServerId) {
            this.registry.update(proposal.targetServerId, {
              status: 'online',
              premium: { featured: false, verifiedAuthor: false },
            });
            result = { approved: proposal.targetServerId };
          }
          break;

        case 'listing_removal':
          if (proposal.targetServerId) {
            this.registry.remove(proposal.targetServerId);
            result = { removed: proposal.targetServerId };
          }
          break;

        case 'featured_curation':
          if (proposal.targetServers) {
            for (const serverId of proposal.targetServers) {
              this.registry.update(serverId, {
                premium: { featured: true, verifiedAuthor: true },
              });
            }
            result = { featured: proposal.targetServers };
          }
          break;

        case 'grant_allocation':
          result = {
            grantAmount: proposal.grantAmount,
            recipient: proposal.grantRecipient,
            milestones: proposal.grantMilestones,
          };
          break;

        case 'parameter_change':
          result = {
            parameter: proposal.parameterKey,
            newValue: proposal.parameterValue,
          };
          break;

        case 'emergency_action':
          if (proposal.targetServerId) {
            this.registry.update(proposal.targetServerId, { status: 'offline' });
            result = { emergency: proposal.targetServerId };
          }
          break;
      }

      proposal.status = 'executed';
      proposal.executedAt = Date.now();
      console.log(`[DAO] Proposal ${proposalId} executed`);

      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Execution failed' };
    }
  }

  /**
   * Guardian veto (emergency only)
   */
  veto(proposalId: string, guardian: string): boolean {
    if (guardian !== DAO_CONFIG.guardianMultisig) {
      throw new Error('Only guardian multisig can veto');
    }

    const proposal = this.proposals.get(proposalId);
    if (!proposal) return false;

    if (proposal.status === 'executed') {
      throw new Error('Cannot veto executed proposal');
    }

    proposal.status = 'vetoed';
    console.log(`[DAO] Proposal ${proposalId} vetoed by guardian`);
    return true;
  }

  // ==========================================================================
  // Curation Rounds
  // ==========================================================================

  /**
   * Start a new curation round for featured servers
   */
  startCurationRound(): CurationRound {
    const id = `CURATION-${Date.now()}`;
    const round: CurationRound = {
      id,
      startTime: Date.now(),
      endTime: Date.now() + DAO_CONFIG.curationRoundDays * 24 * 60 * 60 * 1000,
      totalVotingPower: BigInt(0),
      servers: new Map(),
      voters: new Map(),
      winners: [],
      status: 'active',
    };

    this.curationRounds.set(id, round);
    console.log(`[DAO] Curation round started: ${id}`);
    return round;
  }

  /**
   * Vote in curation round
   */
  curateVote(roundId: string, voter: string, serverId: string, amount: bigint): void {
    const round = this.curationRounds.get(roundId);
    if (!round || round.status !== 'active') {
      throw new Error('Curation round not active');
    }

    const voterInfo = this.voters.get(voter);
    if (!voterInfo || voterInfo.totalPower < amount) {
      throw new Error('Insufficient voting power');
    }

    // Get or create voter's allocations
    let voterAllocations = round.voters.get(voter);
    if (!voterAllocations) {
      voterAllocations = new Map();
      round.voters.set(voter, voterAllocations);
    }

    // Check total allocated
    let totalAllocated = BigInt(0);
    for (const alloc of voterAllocations.values()) {
      totalAllocated += alloc;
    }

    if (totalAllocated + amount > voterInfo.totalPower) {
      throw new Error('Would exceed voting power');
    }

    // Add vote
    const currentVotes = round.servers.get(serverId) || BigInt(0);
    round.servers.set(serverId, currentVotes + amount);

    const voterServerVotes = voterAllocations.get(serverId) || BigInt(0);
    voterAllocations.set(serverId, voterServerVotes + amount);

    round.totalVotingPower += amount;
  }

  /**
   * Finalize curation round
   */
  finalizeCurationRound(roundId: string): string[] {
    const round = this.curationRounds.get(roundId);
    if (!round) {
      throw new Error('Round not found');
    }

    if (Date.now() < round.endTime) {
      throw new Error('Round not ended');
    }

    // Sort servers by votes
    const sorted = Array.from(round.servers.entries())
      .sort((a, b) => Number(b[1] - a[1]));

    // Select top servers
    round.winners = sorted.slice(0, DAO_CONFIG.featuredSlots).map(([id]) => id);
    round.status = 'finalized';

    // Update registry
    for (const serverId of round.winners) {
      this.registry.update(serverId, {
        premium: { featured: true, verifiedAuthor: true },
      });
    }

    console.log(`[DAO] Curation round finalized: ${round.winners.join(', ')}`);
    return round.winners;
  }

  // ==========================================================================
  // Grant Programs
  // ==========================================================================

  /**
   * Create a grant program
   */
  createGrantProgram(params: {
    name: string;
    description: string;
    totalBudget: bigint;
    applicationDeadline: number;
  }): GrantProgram {
    const id = `GRANT-${Date.now()}`;
    const program: GrantProgram = {
      id,
      name: params.name,
      description: params.description,
      totalBudget: params.totalBudget,
      remainingBudget: params.totalBudget,
      minGrant: DAO_CONFIG.minGrantAmount,
      maxGrant: DAO_CONFIG.maxGrantAmount,
      applicationDeadline: params.applicationDeadline,
      status: 'open',
      applications: [],
    };

    this.grantPrograms.set(id, program);
    console.log(`[DAO] Grant program created: ${params.name}`);
    return program;
  }

  /**
   * Submit grant application
   */
  submitGrantApplication(
    programId: string,
    applicant: string,
    params: {
      serverId?: string;
      title: string;
      description: string;
      requestedAmount: bigint;
      milestones: { description: string; amount: bigint; deadline: number }[];
    }
  ): GrantApplication {
    const program = this.grantPrograms.get(programId);
    if (!program || program.status !== 'open') {
      throw new Error('Grant program not open');
    }

    if (Date.now() > program.applicationDeadline) {
      throw new Error('Application deadline passed');
    }

    if (params.requestedAmount < program.minGrant || params.requestedAmount > program.maxGrant) {
      throw new Error(`Amount must be between ${program.minGrant} and ${program.maxGrant}`);
    }

    const application: GrantApplication = {
      id: `APP-${Date.now()}`,
      programId,
      applicant,
      serverId: params.serverId,
      title: params.title,
      description: params.description,
      requestedAmount: params.requestedAmount,
      milestones: params.milestones,
      status: 'submitted',
      votes: new Map(),
      submittedAt: Date.now(),
    };

    program.applications.push(application);
    console.log(`[DAO] Grant application submitted: ${params.title}`);
    return application;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  getProposal(id: string): DAOProposal | null {
    return this.proposals.get(id) || null;
  }

  getActiveProposals(): DAOProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.status === 'active' || p.status === 'pending');
  }

  getVoter(wallet: string): DAOVoter | null {
    return this.voters.get(wallet) || null;
  }

  getActiveCurationRound(): CurationRound | null {
    for (const round of this.curationRounds.values()) {
      if (round.status === 'active') return round;
    }
    return null;
  }

  getOpenGrantPrograms(): GrantProgram[] {
    return Array.from(this.grantPrograms.values())
      .filter(p => p.status === 'open');
  }

  /**
   * Get DAO statistics
   */
  getStats(): {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    totalVoters: number;
    totalVotingPower: bigint;
    activeCurationRounds: number;
    totalGrantsAllocated: bigint;
  } {
    let passedCount = 0;
    let activeCount = 0;
    for (const p of this.proposals.values()) {
      if (p.status === 'passed' || p.status === 'executed') passedCount++;
      if (p.status === 'active') activeCount++;
    }

    let totalPower = BigInt(0);
    for (const v of this.voters.values()) {
      totalPower += v.votingPower;
    }

    let grantsAllocated = BigInt(0);
    for (const program of this.grantPrograms.values()) {
      grantsAllocated += program.totalBudget - program.remainingBudget;
    }

    return {
      totalProposals: this.proposals.size,
      activeProposals: activeCount,
      passedProposals: passedCount,
      totalVoters: this.voters.size,
      totalVotingPower: totalPower,
      activeCurationRounds: Array.from(this.curationRounds.values())
        .filter(r => r.status === 'active').length,
      totalGrantsAllocated: grantsAllocated,
    };
  }

  /**
   * Advance block number (for testing)
   */
  advanceBlock(blocks: number = 1): void {
    this.currentBlock += blocks;
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let globalDAO: MCPRegistryDAO | null = null;

export function getRegistryDAO(registry: UnifiedMCPRegistry): MCPRegistryDAO {
  if (!globalDAO) {
    globalDAO = new MCPRegistryDAO(registry);
  }
  return globalDAO;
}

// ============================================================================
// Exports
// ============================================================================

export const registryDAO = {
  MCPRegistryDAO,
  getRegistryDAO,
  DAO_CONFIG,
};
