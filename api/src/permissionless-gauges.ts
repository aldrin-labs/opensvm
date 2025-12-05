#!/usr/bin/env bun
/**
 * Permissionless Gauge Creation System
 *
 * Allows anyone to create gauges for new pools with a deposit.
 * Removes admin bottleneck for new pool incentives.
 *
 * Key Features:
 * - Deposit requirement to create gauge (anti-spam)
 * - Proposal period before gauge goes live
 * - Community veto mechanism
 * - Automatic gauge activation after proposal passes
 * - Slashing for malicious gauge proposals
 * - Gauge performance tracking
 */

import { EventEmitter } from 'events';
import { VeTokenEngine, getVeTokenEngine } from './vetoken-model.js';
import { GaugeController, getGaugeController, Gauge } from './gauge-voting.js';

// ============================================================================
// Types
// ============================================================================

export type ProposalStatus = 'pending' | 'active' | 'vetoed' | 'passed' | 'rejected' | 'slashed';

export interface GaugeProposal {
  id: string;
  poolId: string;
  poolName: string;
  description: string;
  proposer: string;
  deposit: number;           // SVMAI deposited
  createdAt: number;
  proposalEnd: number;       // When voting ends
  activationTime?: number;   // When gauge becomes active
  status: ProposalStatus;
  supportVotes: number;      // veSVMAI supporting
  vetoVotes: number;         // veSVMAI vetoing
  voters: Map<string, 'support' | 'veto'>;
  gaugeId?: string;          // ID of created gauge (if passed)
}

export interface GaugeMetrics {
  gaugeId: string;
  poolId: string;
  totalVolumeRouted: number;
  totalFeesGenerated: number;
  uniqueUsers: number;
  avgTVL: number;
  performanceScore: number;  // 0-100
  createdAt: number;
}

export interface PermissionlessConfig {
  /** Minimum deposit to propose a gauge (in SVMAI) */
  minDeposit: number;
  /** Proposal period duration (ms) */
  proposalPeriod: number;
  /** Veto threshold (% of total veSVMAI needed to veto) */
  vetoThreshold: number;
  /** Support threshold (% of voting veSVMAI needed to pass) */
  supportThreshold: number;
  /** Minimum participation (% of total veSVMAI that must vote) */
  minParticipation: number;
  /** Cooldown between proposals from same address */
  proposalCooldown: number;
  /** Slash percentage for vetoed proposals */
  slashPercentage: number;
  /** Grace period before activation (ms) */
  activationDelay: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const DEFAULT_CONFIG: PermissionlessConfig = {
  minDeposit: 1000,          // 1000 SVMAI
  proposalPeriod: 7 * DAY,   // 7 days voting
  vetoThreshold: 0.1,        // 10% can veto
  supportThreshold: 0.5,     // 50% support needed
  minParticipation: 0.01,    // 1% must vote
  proposalCooldown: 7 * DAY, // 7 days between proposals
  slashPercentage: 0.5,      // 50% slash on veto
  activationDelay: 2 * DAY,  // 2 days grace period
};

// ============================================================================
// Permissionless Gauge Manager
// ============================================================================

export class PermissionlessGaugeManager extends EventEmitter {
  private config: PermissionlessConfig;
  private veEngine: VeTokenEngine;
  private gaugeController: GaugeController;
  private proposals = new Map<string, GaugeProposal>();
  private proposalCounter = 0;
  private proposerCooldowns = new Map<string, number>(); // proposer -> cooldown end
  private gaugeMetrics = new Map<string, GaugeMetrics>();
  private treasury = 0; // Accumulated slashed funds

  constructor(
    veEngine?: VeTokenEngine,
    gaugeController?: GaugeController,
    config: Partial<PermissionlessConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.veEngine = veEngine || getVeTokenEngine();
    this.gaugeController = gaugeController || getGaugeController();
  }

  // --------------------------------------------------------------------------
  // Proposal Management
  // --------------------------------------------------------------------------

  /**
   * Propose a new gauge
   */
  propose(
    proposer: string,
    poolId: string,
    poolName: string,
    description: string,
    deposit: number
  ): GaugeProposal {
    // Validations
    if (deposit < this.config.minDeposit) {
      throw new Error(`Minimum deposit is ${this.config.minDeposit} SVMAI`);
    }

    // Check cooldown
    const cooldownEnd = this.proposerCooldowns.get(proposer);
    if (cooldownEnd && Date.now() < cooldownEnd) {
      throw new Error(`Cooldown active until ${new Date(cooldownEnd).toISOString()}`);
    }

    // Check for duplicate pool
    for (const proposal of this.proposals.values()) {
      if (proposal.poolId === poolId && ['pending', 'active', 'passed'].includes(proposal.status)) {
        throw new Error('Gauge proposal for this pool already exists');
      }
    }

    // Check existing gauge
    const existingGauges = this.gaugeController.getActiveGauges();
    if (existingGauges.some(g => g.poolId === poolId)) {
      throw new Error('Gauge for this pool already exists');
    }

    this.proposalCounter++;
    const proposal: GaugeProposal = {
      id: `PROP-${this.proposalCounter}`,
      poolId,
      poolName,
      description,
      proposer,
      deposit,
      createdAt: Date.now(),
      proposalEnd: Date.now() + this.config.proposalPeriod,
      status: 'pending',
      supportVotes: 0,
      vetoVotes: 0,
      voters: new Map(),
    };

    this.proposals.set(proposal.id, proposal);

    // Set cooldown
    this.proposerCooldowns.set(proposer, Date.now() + this.config.proposalCooldown);

    this.emit('proposal_created', {
      proposalId: proposal.id,
      poolId,
      poolName,
      proposer,
      deposit,
    });

    return proposal;
  }

  /**
   * Vote on a gauge proposal
   */
  vote(proposalId: string, voter: string, support: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status !== 'pending') {
      throw new Error('Proposal is not in voting period');
    }

    if (Date.now() >= proposal.proposalEnd) {
      throw new Error('Voting period has ended');
    }

    // Get voter's veSVMAI
    const voterVe = this.veEngine.getCurrentVeBalance(voter);
    if (voterVe <= 0) {
      throw new Error('Must have veSVMAI to vote');
    }

    // Check if already voted
    const existingVote = proposal.voters.get(voter);
    if (existingVote) {
      // Update vote
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

    this.emit('proposal_voted', {
      proposalId,
      voter,
      support,
      veAmount: voterVe,
    });
  }

  /**
   * Finalize a proposal after voting period
   */
  finalize(proposalId: string): GaugeProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status !== 'pending') {
      throw new Error('Proposal already finalized');
    }

    if (Date.now() < proposal.proposalEnd) {
      throw new Error('Voting period not ended');
    }

    const totalVeSupply = this.veEngine.getTotalVeSupply();
    const totalVotes = proposal.supportVotes + proposal.vetoVotes;
    const participation = totalVeSupply > 0 ? totalVotes / totalVeSupply : 0;

    // Check veto first (can block even with low participation)
    if (proposal.vetoVotes / totalVeSupply >= this.config.vetoThreshold) {
      proposal.status = 'vetoed';

      // Slash deposit
      const slashAmount = proposal.deposit * this.config.slashPercentage;
      this.treasury += slashAmount;
      const returnAmount = proposal.deposit - slashAmount;

      this.emit('proposal_vetoed', {
        proposalId,
        slashed: slashAmount,
        returned: returnAmount,
      });

      return proposal;
    }

    // Check minimum participation
    if (participation < this.config.minParticipation) {
      proposal.status = 'rejected';

      // Return full deposit (no penalty for low participation)
      this.emit('proposal_rejected', {
        proposalId,
        reason: 'Insufficient participation',
        returned: proposal.deposit,
      });

      return proposal;
    }

    // Check support threshold
    const supportRatio = totalVotes > 0 ? proposal.supportVotes / totalVotes : 0;

    if (supportRatio >= this.config.supportThreshold) {
      proposal.status = 'passed';
      proposal.activationTime = Date.now() + this.config.activationDelay;

      this.emit('proposal_passed', {
        proposalId,
        supportRatio,
        activationTime: proposal.activationTime,
      });
    } else {
      proposal.status = 'rejected';

      // Return deposit (lost vote, not malicious)
      this.emit('proposal_rejected', {
        proposalId,
        reason: 'Insufficient support',
        returned: proposal.deposit,
      });
    }

    return proposal;
  }

  /**
   * Activate a passed proposal (creates the gauge)
   */
  activate(proposalId: string): Gauge {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status !== 'passed') {
      throw new Error('Proposal must be passed to activate');
    }

    if (!proposal.activationTime || Date.now() < proposal.activationTime) {
      throw new Error('Activation delay not elapsed');
    }

    // Create the gauge
    const gauge = this.gaugeController.createGauge(proposal.poolId, proposal.poolName);
    proposal.gaugeId = gauge.id;
    proposal.status = 'active';

    // Initialize metrics
    this.gaugeMetrics.set(gauge.id, {
      gaugeId: gauge.id,
      poolId: proposal.poolId,
      totalVolumeRouted: 0,
      totalFeesGenerated: 0,
      uniqueUsers: 0,
      avgTVL: 0,
      performanceScore: 50, // Start neutral
      createdAt: Date.now(),
    });

    this.emit('gauge_activated', {
      proposalId,
      gaugeId: gauge.id,
      poolId: proposal.poolId,
    });

    return gauge;
  }

  // --------------------------------------------------------------------------
  // Performance Tracking
  // --------------------------------------------------------------------------

  /**
   * Update gauge metrics (called periodically)
   */
  updateMetrics(
    gaugeId: string,
    volumeRouted: number,
    feesGenerated: number,
    uniqueUsers: number,
    tvl: number
  ): void {
    const metrics = this.gaugeMetrics.get(gaugeId);
    if (!metrics) throw new Error('Gauge metrics not found');

    metrics.totalVolumeRouted += volumeRouted;
    metrics.totalFeesGenerated += feesGenerated;
    metrics.uniqueUsers = Math.max(metrics.uniqueUsers, uniqueUsers);

    // Rolling average TVL
    metrics.avgTVL = (metrics.avgTVL * 0.9) + (tvl * 0.1);

    // Calculate performance score
    metrics.performanceScore = this.calculatePerformanceScore(metrics);

    this.emit('metrics_updated', { gaugeId, metrics });
  }

  private calculatePerformanceScore(metrics: GaugeMetrics): number {
    // Simple scoring: volume + fees + users + TVL
    // Normalize each to 0-25 range, sum to 0-100

    const ageWeeks = (Date.now() - metrics.createdAt) / (7 * DAY);

    // Volume per week
    const weeklyVolume = ageWeeks > 0 ? metrics.totalVolumeRouted / ageWeeks : 0;
    const volumeScore = Math.min(25, weeklyVolume / 10000);

    // Fees per week
    const weeklyFees = ageWeeks > 0 ? metrics.totalFeesGenerated / ageWeeks : 0;
    const feeScore = Math.min(25, weeklyFees / 100);

    // User engagement
    const userScore = Math.min(25, metrics.uniqueUsers / 40);

    // TVL health
    const tvlScore = Math.min(25, metrics.avgTVL / 100000);

    return Math.round(volumeScore + feeScore + userScore + tvlScore);
  }

  /**
   * Get gauge metrics
   */
  getMetrics(gaugeId: string): GaugeMetrics | null {
    return this.gaugeMetrics.get(gaugeId) || null;
  }

  /**
   * Get gauges ranked by performance
   */
  getPerformanceRanking(): Array<GaugeMetrics & { rank: number }> {
    return Array.from(this.gaugeMetrics.values())
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .map((m, i) => ({ ...m, rank: i + 1 }));
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): GaugeProposal | null {
    return this.proposals.get(proposalId) || null;
  }

  /**
   * Get all proposals by status
   */
  getProposalsByStatus(status: ProposalStatus): GaugeProposal[] {
    return Array.from(this.proposals.values()).filter(p => p.status === status);
  }

  /**
   * Get proposals requiring action (voting ended, not finalized)
   */
  getPendingFinalization(): GaugeProposal[] {
    const now = Date.now();
    return Array.from(this.proposals.values()).filter(
      p => p.status === 'pending' && now >= p.proposalEnd
    );
  }

  /**
   * Get proposals ready for activation
   */
  getReadyForActivation(): GaugeProposal[] {
    const now = Date.now();
    return Array.from(this.proposals.values()).filter(
      p => p.status === 'passed' && p.activationTime && now >= p.activationTime
    );
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get global stats
   */
  getStats(): {
    totalProposals: number;
    pendingProposals: number;
    activeGauges: number;
    vetoedProposals: number;
    totalDeposited: number;
    treasuryBalance: number;
    avgPassRate: number;
  } {
    const proposals = Array.from(this.proposals.values());
    const pending = proposals.filter(p => p.status === 'pending').length;
    const active = proposals.filter(p => p.status === 'active').length;
    const vetoed = proposals.filter(p => p.status === 'vetoed').length;
    const finalized = proposals.filter(p => ['active', 'rejected', 'vetoed'].includes(p.status));
    const passed = proposals.filter(p => ['active', 'passed'].includes(p.status)).length;

    const totalDeposited = proposals.reduce((sum, p) => sum + p.deposit, 0);

    return {
      totalProposals: proposals.length,
      pendingProposals: pending,
      activeGauges: active,
      vetoedProposals: vetoed,
      totalDeposited,
      treasuryBalance: this.treasury,
      avgPassRate: finalized.length > 0 ? passed / finalized.length : 0,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

let managerInstance: PermissionlessGaugeManager | null = null;

export function getPermissionlessGaugeManager(
  veEngine?: VeTokenEngine,
  gaugeController?: GaugeController,
  config?: Partial<PermissionlessConfig>
): PermissionlessGaugeManager {
  if (!managerInstance) {
    managerInstance = new PermissionlessGaugeManager(veEngine, gaugeController, config);
  }
  return managerInstance;
}

export default {
  PermissionlessGaugeManager,
  getPermissionlessGaugeManager,
  DEFAULT_CONFIG,
};
