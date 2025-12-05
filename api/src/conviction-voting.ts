#!/usr/bin/env bun
/**
 * Conviction Voting System
 *
 * A continuous governance mechanism where voting power (conviction)
 * accumulates over time. No fixed voting periods - proposals pass
 * when accumulated conviction crosses a dynamic threshold.
 *
 * Key Features:
 * - Conviction grows exponentially while staked
 * - Conviction decays when moved away
 * - Dynamic threshold based on requested funds/impact
 * - No voter fatigue - set and forget voting
 * - Rewards long-term commitment
 *
 * Based on: https://medium.com/giveth/conviction-voting-a-novel-continuous-decision-making-alternative-to-governance-62e215ad2b3d
 */

import { EventEmitter } from 'events';
import { VeTokenEngine, getVeTokenEngine } from './vetoken-model.js';

// ============================================================================
// Types
// ============================================================================

export type ProposalType = 'funding' | 'parameter' | 'signal' | 'emergency';
export type ProposalStatus = 'active' | 'passed' | 'executed' | 'withdrawn' | 'rejected';

export interface ConvictionProposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  proposer: string;

  // Funding proposals
  requestedAmount?: number;       // Amount requested from treasury
  beneficiary?: string;           // Who receives funds

  // Parameter proposals
  parameterKey?: string;
  parameterValue?: unknown;

  // Conviction tracking
  currentConviction: number;      // Current accumulated conviction
  threshold: number;              // Conviction needed to pass
  stakedVotes: Map<string, StakedVote>;

  // Timestamps
  createdAt: number;
  lastUpdated: number;
  passedAt?: number;
  executedAt?: number;

  status: ProposalStatus;
}

export interface StakedVote {
  voter: string;
  amount: number;                 // veSVMAI staked
  conviction: number;             // Accumulated conviction
  stakedAt: number;               // When vote was staked
  lastUpdated: number;            // Last conviction update
}

export interface ConvictionConfig {
  /** Half-life for conviction growth (ms). Lower = faster growth */
  convictionGrowthHalfLife: number;
  /** Decay rate when unstaking (0-1). Higher = faster decay */
  decayRate: number;
  /** Minimum stake to vote */
  minStake: number;
  /** Minimum conviction to pass any proposal */
  minConviction: number;
  /** Maximum funding per proposal (% of treasury) */
  maxFundingPercentage: number;
  /** Spending limit that affects threshold calculation */
  spendingLimit: number;
  /** Alpha parameter for threshold curve (0-1) */
  alpha: number;
  /** Update interval for conviction calculations (ms) */
  updateInterval: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DAY = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: ConvictionConfig = {
  convictionGrowthHalfLife: 3 * DAY,  // Conviction doubles every 3 days
  decayRate: 0.5,                      // 50% decay per half-life when unstaked
  minStake: 100,                       // Minimum 100 veSVMAI
  minConviction: 1000,                 // Minimum conviction to pass
  maxFundingPercentage: 0.1,           // Max 10% of treasury per proposal
  spendingLimit: 1000000,              // 1M SVMAI spending limit
  alpha: 0.9,                          // Threshold curve parameter
  updateInterval: 60 * 60 * 1000,      // Update every hour
};

// ============================================================================
// Conviction Voting Engine
// ============================================================================

export class ConvictionVotingEngine extends EventEmitter {
  private config: ConvictionConfig;
  private veEngine: VeTokenEngine;
  private proposals = new Map<string, ConvictionProposal>();
  private voterProposals = new Map<string, Set<string>>(); // voter -> proposal IDs
  private proposalCounter = 0;
  private treasuryBalance = 10000000; // Initial treasury (10M)

  constructor(
    veEngine?: VeTokenEngine,
    config: Partial<ConvictionConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.veEngine = veEngine || getVeTokenEngine();
  }

  // --------------------------------------------------------------------------
  // Proposal Management
  // --------------------------------------------------------------------------

  /**
   * Create a new proposal
   */
  createProposal(
    type: ProposalType,
    title: string,
    description: string,
    proposer: string,
    options?: {
      requestedAmount?: number;
      beneficiary?: string;
      parameterKey?: string;
      parameterValue?: unknown;
    }
  ): ConvictionProposal {
    // Validate funding request
    if (type === 'funding') {
      if (!options?.requestedAmount || options.requestedAmount <= 0) {
        throw new Error('Funding proposals require a positive requestedAmount');
      }

      const maxAllowed = this.treasuryBalance * this.config.maxFundingPercentage;
      if (options.requestedAmount > maxAllowed) {
        throw new Error(`Requested amount exceeds maximum (${maxAllowed})`);
      }
    }

    this.proposalCounter++;
    const now = Date.now();

    // Calculate threshold based on proposal type and requested amount
    const threshold = this.calculateThreshold(type, options?.requestedAmount);

    const proposal: ConvictionProposal = {
      id: `CONV-${this.proposalCounter}`,
      type,
      title,
      description,
      proposer,
      requestedAmount: options?.requestedAmount,
      beneficiary: options?.beneficiary || proposer,
      parameterKey: options?.parameterKey,
      parameterValue: options?.parameterValue,
      currentConviction: 0,
      threshold,
      stakedVotes: new Map(),
      createdAt: now,
      lastUpdated: now,
      status: 'active',
    };

    this.proposals.set(proposal.id, proposal);

    this.emit('proposal_created', {
      proposalId: proposal.id,
      type,
      title,
      threshold,
    });

    return proposal;
  }

  /**
   * Calculate threshold based on proposal type and amount
   * Higher funding requests require more conviction
   */
  private calculateThreshold(type: ProposalType, requestedAmount?: number): number {
    const baseThreshold = this.config.minConviction;

    switch (type) {
      case 'signal':
        // Signal proposals just need minimum conviction
        return baseThreshold;

      case 'emergency':
        // Emergency proposals have lower threshold but need quick action
        return baseThreshold * 0.5;

      case 'parameter':
        // Parameter changes need moderate conviction
        return baseThreshold * 2;

      case 'funding': {
        if (!requestedAmount) return baseThreshold;

        // Threshold increases with requested amount
        // Using conviction voting formula: threshold = requested * (supply / (supply - requested))^alpha
        const supply = this.config.spendingLimit;
        const ratio = supply / (supply - Math.min(requestedAmount, supply * 0.9));
        const multiplier = Math.pow(ratio, this.config.alpha);

        return Math.max(baseThreshold, requestedAmount * multiplier);
      }

      default:
        return baseThreshold;
    }
  }

  /**
   * Withdraw a proposal (only by proposer, only if not passed)
   */
  withdrawProposal(proposalId: string, caller: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.proposer !== caller) {
      throw new Error('Only proposer can withdraw');
    }

    if (proposal.status !== 'active') {
      throw new Error('Can only withdraw active proposals');
    }

    proposal.status = 'withdrawn';

    // Return all staked votes
    for (const vote of proposal.stakedVotes.values()) {
      this.voterProposals.get(vote.voter)?.delete(proposalId);
    }
    proposal.stakedVotes.clear();

    this.emit('proposal_withdrawn', { proposalId });
  }

  // --------------------------------------------------------------------------
  // Voting
  // --------------------------------------------------------------------------

  /**
   * Stake veSVMAI on a proposal to build conviction
   */
  stakeVote(proposalId: string, voter: string, amount: number): StakedVote {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status !== 'active') {
      throw new Error('Can only vote on active proposals');
    }

    if (amount < this.config.minStake) {
      throw new Error(`Minimum stake is ${this.config.minStake}`);
    }

    // Check voter has enough veSVMAI
    const veBalance = this.veEngine.getCurrentVeBalance(voter);

    // Calculate total already staked
    const alreadyStaked = this.getVoterTotalStaked(voter);
    const existingVote = proposal.stakedVotes.get(voter);
    const existingStake = existingVote?.amount || 0;

    if (alreadyStaked - existingStake + amount > veBalance) {
      throw new Error(`Insufficient veSVMAI. Have: ${veBalance}, Already staked: ${alreadyStaked - existingStake}`);
    }

    const now = Date.now();

    // Update or create vote
    if (existingVote) {
      // Adding to existing stake - keep accumulated conviction
      existingVote.amount += amount;
      existingVote.lastUpdated = now;
    } else {
      const vote: StakedVote = {
        voter,
        amount,
        conviction: 0,
        stakedAt: now,
        lastUpdated: now,
      };
      proposal.stakedVotes.set(voter, vote);

      // Track voter's proposals
      if (!this.voterProposals.has(voter)) {
        this.voterProposals.set(voter, new Set());
      }
      this.voterProposals.get(voter)!.add(proposalId);
    }

    this.emit('vote_staked', {
      proposalId,
      voter,
      amount,
      totalStaked: proposal.stakedVotes.get(voter)!.amount,
    });

    return proposal.stakedVotes.get(voter)!;
  }

  /**
   * Unstake veSVMAI from a proposal (conviction decays)
   */
  unstakeVote(proposalId: string, voter: string, amount: number): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const vote = proposal.stakedVotes.get(voter);
    if (!vote) throw new Error('No stake found');

    if (amount > vote.amount) {
      throw new Error('Cannot unstake more than staked');
    }

    // Apply decay to conviction when unstaking
    const unstakeRatio = amount / vote.amount;
    vote.conviction *= (1 - unstakeRatio * this.config.decayRate);
    vote.amount -= amount;
    vote.lastUpdated = Date.now();

    if (vote.amount === 0) {
      proposal.stakedVotes.delete(voter);
      this.voterProposals.get(voter)?.delete(proposalId);
    }

    this.emit('vote_unstaked', {
      proposalId,
      voter,
      amount,
      remainingStake: vote.amount,
    });
  }

  /**
   * Move stake from one proposal to another
   */
  moveStake(
    fromProposalId: string,
    toProposalId: string,
    voter: string,
    amount: number
  ): void {
    this.unstakeVote(fromProposalId, voter, amount);
    this.stakeVote(toProposalId, voter, amount);

    this.emit('stake_moved', {
      from: fromProposalId,
      to: toProposalId,
      voter,
      amount,
    });
  }

  // --------------------------------------------------------------------------
  // Conviction Calculation
  // --------------------------------------------------------------------------

  /**
   * Update conviction for all proposals
   * Should be called periodically (e.g., every hour)
   */
  updateAllConviction(): Array<{
    proposalId: string;
    oldConviction: number;
    newConviction: number;
    passed: boolean;
  }> {
    const updates: Array<{
      proposalId: string;
      oldConviction: number;
      newConviction: number;
      passed: boolean;
    }> = [];

    for (const proposal of this.proposals.values()) {
      if (proposal.status !== 'active') continue;

      const oldConviction = proposal.currentConviction;
      this.updateProposalConviction(proposal);

      const passed = proposal.currentConviction >= proposal.threshold;

      updates.push({
        proposalId: proposal.id,
        oldConviction,
        newConviction: proposal.currentConviction,
        passed,
      });

      if (passed) {
        this.passProposal(proposal);
      }
    }

    return updates;
  }

  /**
   * Update conviction for a single proposal
   */
  private updateProposalConviction(proposal: ConvictionProposal): void {
    const now = Date.now();
    let totalConviction = 0;

    for (const vote of proposal.stakedVotes.values()) {
      // Calculate conviction growth since last update
      const timeSinceUpdate = now - vote.lastUpdated;
      const growthFactor = this.calculateGrowthFactor(timeSinceUpdate);

      // Conviction grows based on staked amount and time
      // New conviction = old conviction * growth + new stake contribution
      const maxConviction = vote.amount * 10; // Max 10x stake as conviction
      vote.conviction = Math.min(
        maxConviction,
        vote.conviction * growthFactor + vote.amount * (growthFactor - 1)
      );
      vote.lastUpdated = now;

      totalConviction += vote.conviction;
    }

    proposal.currentConviction = totalConviction;
    proposal.lastUpdated = now;
  }

  /**
   * Calculate growth factor based on time elapsed
   * Uses half-life formula for smooth growth
   */
  private calculateGrowthFactor(timeElapsed: number): number {
    // Growth factor = 2^(t/half_life)
    // This means conviction doubles every half_life period
    const halfLives = timeElapsed / this.config.convictionGrowthHalfLife;
    return Math.pow(2, halfLives);
  }

  /**
   * Get conviction progress for a proposal
   */
  getConvictionProgress(proposalId: string): {
    current: number;
    threshold: number;
    percentage: number;
    estimatedTimeToPass: number | null;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    // Update conviction first
    if (proposal.status === 'active') {
      this.updateProposalConviction(proposal);
    }

    const percentage = (proposal.currentConviction / proposal.threshold) * 100;

    // Estimate time to pass based on current growth rate
    let estimatedTimeToPass: number | null = null;
    if (proposal.currentConviction > 0 && proposal.currentConviction < proposal.threshold) {
      // Calculate based on half-life growth
      const remaining = proposal.threshold / proposal.currentConviction;
      const halfLivesNeeded = Math.log2(remaining);
      estimatedTimeToPass = halfLivesNeeded * this.config.convictionGrowthHalfLife;
    }

    return {
      current: proposal.currentConviction,
      threshold: proposal.threshold,
      percentage: Math.min(100, percentage),
      estimatedTimeToPass,
    };
  }

  // --------------------------------------------------------------------------
  // Proposal Passing & Execution
  // --------------------------------------------------------------------------

  private passProposal(proposal: ConvictionProposal): void {
    proposal.status = 'passed';
    proposal.passedAt = Date.now();

    this.emit('proposal_passed', {
      proposalId: proposal.id,
      type: proposal.type,
      conviction: proposal.currentConviction,
      threshold: proposal.threshold,
    });
  }

  /**
   * Execute a passed proposal
   */
  executeProposal(proposalId: string, executor: string): unknown {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status !== 'passed') {
      throw new Error('Can only execute passed proposals');
    }

    proposal.status = 'executed';
    proposal.executedAt = Date.now();

    let result: unknown;

    switch (proposal.type) {
      case 'funding':
        if (proposal.requestedAmount && proposal.requestedAmount <= this.treasuryBalance) {
          this.treasuryBalance -= proposal.requestedAmount;
          result = {
            type: 'funding',
            amount: proposal.requestedAmount,
            beneficiary: proposal.beneficiary,
            newTreasuryBalance: this.treasuryBalance,
          };
        }
        break;

      case 'parameter':
        result = {
          type: 'parameter',
          key: proposal.parameterKey,
          value: proposal.parameterValue,
        };
        break;

      case 'signal':
        result = {
          type: 'signal',
          title: proposal.title,
        };
        break;

      case 'emergency':
        result = {
          type: 'emergency',
          description: proposal.description,
        };
        break;
    }

    // Return staked votes
    for (const vote of proposal.stakedVotes.values()) {
      this.voterProposals.get(vote.voter)?.delete(proposalId);
    }

    this.emit('proposal_executed', {
      proposalId,
      executor,
      result,
    });

    return result;
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): ConvictionProposal | null {
    const proposal = this.proposals.get(proposalId);
    if (proposal && proposal.status === 'active') {
      this.updateProposalConviction(proposal);
    }
    return proposal || null;
  }

  /**
   * Get all active proposals
   */
  getActiveProposals(): ConvictionProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.status === 'active')
      .map(p => {
        this.updateProposalConviction(p);
        return p;
      });
  }

  /**
   * Get proposals by status
   */
  getProposalsByStatus(status: ProposalStatus): ConvictionProposal[] {
    return Array.from(this.proposals.values()).filter(p => p.status === status);
  }

  /**
   * Get voter's staked proposals
   */
  getVoterStakes(voter: string): Array<{
    proposalId: string;
    proposal: ConvictionProposal;
    stake: StakedVote;
  }> {
    const proposalIds = this.voterProposals.get(voter);
    if (!proposalIds) return [];

    const stakes: Array<{
      proposalId: string;
      proposal: ConvictionProposal;
      stake: StakedVote;
    }> = [];

    for (const proposalId of proposalIds) {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) continue;

      const stake = proposal.stakedVotes.get(voter);
      if (!stake) continue;

      stakes.push({ proposalId, proposal, stake });
    }

    return stakes;
  }

  /**
   * Get total veSVMAI staked by voter
   */
  getVoterTotalStaked(voter: string): number {
    const stakes = this.getVoterStakes(voter);
    return stakes.reduce((sum, s) => sum + s.stake.amount, 0);
  }

  /**
   * Get proposals ranked by conviction progress
   */
  getProposalRanking(): Array<{
    proposal: ConvictionProposal;
    progress: number;
    estimatedTimeToPass: number | null;
  }> {
    return this.getActiveProposals()
      .map(p => {
        const progress = this.getConvictionProgress(p.id);
        return {
          proposal: p,
          progress: progress.percentage,
          estimatedTimeToPass: progress.estimatedTimeToPass,
        };
      })
      .sort((a, b) => b.progress - a.progress);
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get overall statistics
   */
  getStats(): {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    executedProposals: number;
    totalStaked: number;
    treasuryBalance: number;
    avgConvictionProgress: number;
  } {
    const all = Array.from(this.proposals.values());
    const active = all.filter(p => p.status === 'active');

    let totalStaked = 0;
    let totalProgress = 0;

    for (const proposal of active) {
      this.updateProposalConviction(proposal);
      for (const vote of proposal.stakedVotes.values()) {
        totalStaked += vote.amount;
      }
      totalProgress += (proposal.currentConviction / proposal.threshold) * 100;
    }

    return {
      totalProposals: all.length,
      activeProposals: active.length,
      passedProposals: all.filter(p => p.status === 'passed').length,
      executedProposals: all.filter(p => p.status === 'executed').length,
      totalStaked,
      treasuryBalance: this.treasuryBalance,
      avgConvictionProgress: active.length > 0 ? totalProgress / active.length : 0,
    };
  }

  /**
   * Set treasury balance (for testing/admin)
   */
  setTreasuryBalance(balance: number): void {
    this.treasuryBalance = balance;
  }

  /**
   * Get treasury balance
   */
  getTreasuryBalance(): number {
    return this.treasuryBalance;
  }
}

// ============================================================================
// Exports
// ============================================================================

let engineInstance: ConvictionVotingEngine | null = null;

export function getConvictionVotingEngine(
  veEngine?: VeTokenEngine,
  config?: Partial<ConvictionConfig>
): ConvictionVotingEngine {
  if (!engineInstance) {
    engineInstance = new ConvictionVotingEngine(veEngine, config);
  }
  return engineInstance;
}

export default {
  ConvictionVotingEngine,
  getConvictionVotingEngine,
  DEFAULT_CONFIG,
};
