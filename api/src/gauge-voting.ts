#!/usr/bin/env bun
/**
 * Gauge Voting for Liquidity Mining Rewards Distribution
 *
 * Based on Curve's gauge weight voting system.
 * veSVMAI holders vote to direct reward emissions to different pools.
 *
 * Mechanics:
 * - Each epoch (1 week), votes are tallied
 * - Pool weights determine share of emissions
 * - Users can vote for multiple pools (split their veSVMAI)
 * - Votes persist until changed
 * - Bribes can incentivize votes toward specific pools
 */

import { EventEmitter } from 'events';
import { VeTokenEngine, getVeTokenEngine } from './vetoken-model.js';

// ============================================================================
// Types
// ============================================================================

export interface Gauge {
  id: string;
  poolId: string;
  name: string;
  currentWeight: number;       // 0-1 (relative weight this epoch)
  totalVotes: number;          // Total veSVMAI voting for this gauge
  voterCount: number;
  bribes: Bribe[];
  createdAt: number;
  isActive: boolean;
}

export interface Vote {
  id: string;
  voter: string;
  gaugeId: string;
  weight: number;              // % of voter's veSVMAI (0-100)
  veAmount: number;            // Actual veSVMAI at time of vote
  epoch: number;
  createdAt: number;
}

export interface Bribe {
  id: string;
  gaugeId: string;
  token: string;               // Bribe token (e.g., "SVMAI", "SOL")
  amount: number;
  depositor: string;
  epoch: number;
  claimed: Map<string, number>; // voter -> claimed amount
  createdAt: number;
}

export interface Epoch {
  number: number;
  startTime: number;
  endTime: number;
  totalVotes: number;
  gaugeWeights: Map<string, number>;
  finalized: boolean;
}

export interface GaugeConfig {
  epochDuration: number;       // Duration in ms (default: 1 week)
  minGaugeWeight: number;      // Minimum weight to receive emissions (0.01 = 1%)
  maxUserWeight: number;       // Max weight per gauge per user (100 = 100%)
  bribeClaimDelay: number;     // Delay before bribes can be claimed
}

// ============================================================================
// Default Configuration
// ============================================================================

const WEEK = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: GaugeConfig = {
  epochDuration: WEEK,
  minGaugeWeight: 0.01,        // 1% minimum
  maxUserWeight: 100,          // Can put 100% in one gauge
  bribeClaimDelay: WEEK,       // 1 week delay
};

// ============================================================================
// Gauge Controller
// ============================================================================

export class GaugeController extends EventEmitter {
  private config: GaugeConfig;
  private veEngine: VeTokenEngine;
  private gauges = new Map<string, Gauge>();
  private votes = new Map<string, Vote>();       // voteId -> Vote
  private voterVotes = new Map<string, Map<string, string>>(); // voter -> gaugeId -> voteId
  private epochs: Epoch[] = [];
  private currentEpoch: number = 0;
  private gaugeCounter = 0;
  private voteCounter = 0;
  private bribeCounter = 0;

  constructor(veEngine?: VeTokenEngine, config: Partial<GaugeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.veEngine = veEngine || getVeTokenEngine();

    // Initialize first epoch
    this.initializeEpoch();
  }

  // --------------------------------------------------------------------------
  // Epoch Management
  // --------------------------------------------------------------------------

  private initializeEpoch(): void {
    const now = Date.now();
    const epoch: Epoch = {
      number: this.currentEpoch,
      startTime: now,
      endTime: now + this.config.epochDuration,
      totalVotes: 0,
      gaugeWeights: new Map(),
      finalized: false,
    };

    this.epochs.push(epoch);
    this.emit('epoch_started', { epoch: this.currentEpoch });
  }

  /**
   * Advance to next epoch (called automatically or manually)
   */
  advanceEpoch(): Epoch {
    // Finalize current epoch
    const current = this.epochs[this.currentEpoch];
    if (current) {
      this.finalizeEpoch(current);
    }

    // Start new epoch
    this.currentEpoch++;
    this.initializeEpoch();

    // Recalculate votes with decayed veSVMAI
    this.recalculateAllVotes();

    return this.epochs[this.currentEpoch];
  }

  private finalizeEpoch(epoch: Epoch): void {
    // Calculate final weights
    const totalVotes = this.getTotalVotes();

    for (const gauge of this.gauges.values()) {
      const weight = totalVotes > 0 ? gauge.totalVotes / totalVotes : 0;
      epoch.gaugeWeights.set(gauge.id, weight);
      gauge.currentWeight = weight;
    }

    epoch.totalVotes = totalVotes;
    epoch.finalized = true;

    this.emit('epoch_finalized', {
      epoch: epoch.number,
      weights: Object.fromEntries(epoch.gaugeWeights),
    });
  }

  /**
   * Get current epoch info
   */
  getCurrentEpoch(): Epoch {
    return this.epochs[this.currentEpoch];
  }

  /**
   * Check if epoch should advance
   */
  shouldAdvanceEpoch(): boolean {
    const current = this.epochs[this.currentEpoch];
    return current && Date.now() >= current.endTime;
  }

  // --------------------------------------------------------------------------
  // Gauge Management
  // --------------------------------------------------------------------------

  /**
   * Create a new gauge for a liquidity pool
   */
  createGauge(poolId: string, name: string): Gauge {
    this.gaugeCounter++;
    const gauge: Gauge = {
      id: `GAUGE-${this.gaugeCounter}`,
      poolId,
      name,
      currentWeight: 0,
      totalVotes: 0,
      voterCount: 0,
      bribes: [],
      createdAt: Date.now(),
      isActive: true,
    };

    this.gauges.set(gauge.id, gauge);

    this.emit('gauge_created', gauge);

    return gauge;
  }

  /**
   * Get gauge by ID
   */
  getGauge(gaugeId: string): Gauge | null {
    return this.gauges.get(gaugeId) || null;
  }

  /**
   * Get all active gauges
   */
  getActiveGauges(): Gauge[] {
    return Array.from(this.gauges.values()).filter(g => g.isActive);
  }

  /**
   * Deactivate a gauge (no new votes, existing votes remain)
   */
  deactivateGauge(gaugeId: string): void {
    const gauge = this.gauges.get(gaugeId);
    if (gauge) {
      gauge.isActive = false;
      this.emit('gauge_deactivated', { gaugeId });
    }
  }

  // --------------------------------------------------------------------------
  // Voting
  // --------------------------------------------------------------------------

  /**
   * Vote for a gauge with a portion of veSVMAI
   * @param voter Voter address
   * @param gaugeId Gauge to vote for
   * @param weight Percentage of veSVMAI to allocate (0-100)
   */
  vote(voter: string, gaugeId: string, weight: number): Vote {
    const gauge = this.gauges.get(gaugeId);
    if (!gauge) throw new Error('Gauge not found');
    if (!gauge.isActive) throw new Error('Gauge is not active');

    if (weight < 0 || weight > this.config.maxUserWeight) {
      throw new Error(`Weight must be between 0 and ${this.config.maxUserWeight}`);
    }

    // Check total weight doesn't exceed 100%
    const totalWeight = this.getVoterTotalWeight(voter);
    const existingVote = this.getVoterVoteForGauge(voter, gaugeId);
    const existingWeight = existingVote?.weight || 0;

    if (totalWeight - existingWeight + weight > 100) {
      throw new Error('Total vote weight cannot exceed 100%');
    }

    // Get voter's veSVMAI balance
    const veBalance = this.veEngine.getCurrentVeBalance(voter);
    if (veBalance <= 0) {
      throw new Error('Must have veSVMAI to vote');
    }

    const veAmount = (veBalance * weight) / 100;

    // Remove existing vote if any
    if (existingVote) {
      gauge.totalVotes -= existingVote.veAmount;
      if (existingVote.veAmount > 0) {
        gauge.voterCount--;
      }
      this.votes.delete(existingVote.id);
    }

    // Create new vote
    this.voteCounter++;
    const vote: Vote = {
      id: `VOTE-${this.voteCounter}`,
      voter,
      gaugeId,
      weight,
      veAmount,
      epoch: this.currentEpoch,
      createdAt: Date.now(),
    };

    this.votes.set(vote.id, vote);

    // Track voter's votes
    if (!this.voterVotes.has(voter)) {
      this.voterVotes.set(voter, new Map());
    }
    this.voterVotes.get(voter)!.set(gaugeId, vote.id);

    // Update gauge
    gauge.totalVotes += veAmount;
    if (veAmount > 0) {
      gauge.voterCount++;
    }

    this.emit('vote_cast', {
      voter,
      gaugeId,
      weight,
      veAmount,
    });

    return vote;
  }

  /**
   * Remove vote from a gauge
   */
  removeVote(voter: string, gaugeId: string): void {
    const vote = this.getVoterVoteForGauge(voter, gaugeId);
    if (!vote) throw new Error('No vote to remove');

    const gauge = this.gauges.get(gaugeId);
    if (gauge) {
      gauge.totalVotes -= vote.veAmount;
      gauge.voterCount--;
    }

    this.votes.delete(vote.id);
    this.voterVotes.get(voter)?.delete(gaugeId);

    this.emit('vote_removed', { voter, gaugeId });
  }

  /**
   * Get voter's vote for a specific gauge
   */
  getVoterVoteForGauge(voter: string, gaugeId: string): Vote | null {
    const voteId = this.voterVotes.get(voter)?.get(gaugeId);
    if (!voteId) return null;
    return this.votes.get(voteId) || null;
  }

  /**
   * Get all votes by a voter
   */
  getVoterVotes(voter: string): Vote[] {
    const voteIds = this.voterVotes.get(voter);
    if (!voteIds) return [];

    return Array.from(voteIds.values())
      .map(id => this.votes.get(id))
      .filter((v): v is Vote => v !== undefined);
  }

  /**
   * Get total weight allocated by voter
   */
  getVoterTotalWeight(voter: string): number {
    const votes = this.getVoterVotes(voter);
    return votes.reduce((sum, v) => sum + v.weight, 0);
  }

  /**
   * Recalculate all votes with current veSVMAI balances
   */
  private recalculateAllVotes(): void {
    // Reset gauge totals
    for (const gauge of this.gauges.values()) {
      gauge.totalVotes = 0;
      gauge.voterCount = 0;
    }

    // Recalculate each vote
    for (const vote of this.votes.values()) {
      const veBalance = this.veEngine.getCurrentVeBalance(vote.voter);
      vote.veAmount = (veBalance * vote.weight) / 100;
      vote.epoch = this.currentEpoch;

      const gauge = this.gauges.get(vote.gaugeId);
      if (gauge) {
        gauge.totalVotes += vote.veAmount;
        if (vote.veAmount > 0) {
          gauge.voterCount++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Bribes
  // --------------------------------------------------------------------------

  /**
   * Add a bribe to incentivize votes for a gauge
   */
  addBribe(
    gaugeId: string,
    depositor: string,
    token: string,
    amount: number
  ): Bribe {
    const gauge = this.gauges.get(gaugeId);
    if (!gauge) throw new Error('Gauge not found');

    this.bribeCounter++;
    const bribe: Bribe = {
      id: `BRIBE-${this.bribeCounter}`,
      gaugeId,
      token,
      amount,
      depositor,
      epoch: this.currentEpoch,
      claimed: new Map(),
      createdAt: Date.now(),
    };

    gauge.bribes.push(bribe);

    this.emit('bribe_added', {
      gaugeId,
      token,
      amount,
      depositor,
    });

    return bribe;
  }

  /**
   * Get claimable bribe amount for a voter
   */
  getClaimableBribe(voter: string, bribeId: string): number {
    for (const gauge of this.gauges.values()) {
      const bribe = gauge.bribes.find(b => b.id === bribeId);
      if (!bribe) continue;

      // Check claim delay
      if (Date.now() < bribe.createdAt + this.config.bribeClaimDelay) {
        return 0;
      }

      // Check if already claimed
      if (bribe.claimed.has(voter)) {
        return 0;
      }

      // Calculate share based on votes
      const voterVote = this.getVoterVoteForGauge(voter, gauge.id);
      if (!voterVote || voterVote.veAmount === 0) {
        return 0;
      }

      const share = voterVote.veAmount / gauge.totalVotes;
      return bribe.amount * share;
    }

    return 0;
  }

  /**
   * Claim a bribe
   */
  claimBribe(voter: string, bribeId: string): number {
    const claimable = this.getClaimableBribe(voter, bribeId);
    if (claimable <= 0) {
      throw new Error('No bribe to claim');
    }

    // Find and update bribe
    for (const gauge of this.gauges.values()) {
      const bribe = gauge.bribes.find(b => b.id === bribeId);
      if (bribe) {
        bribe.claimed.set(voter, claimable);

        this.emit('bribe_claimed', {
          voter,
          bribeId,
          amount: claimable,
        });

        return claimable;
      }
    }

    throw new Error('Bribe not found');
  }

  /**
   * Get all bribes for a gauge
   */
  getGaugeBribes(gaugeId: string): Bribe[] {
    const gauge = this.gauges.get(gaugeId);
    return gauge?.bribes || [];
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get total votes across all gauges
   */
  getTotalVotes(): number {
    let total = 0;
    for (const gauge of this.gauges.values()) {
      total += gauge.totalVotes;
    }
    return total;
  }

  /**
   * Get gauge weights (relative distribution)
   */
  getGaugeWeights(): Array<{
    gaugeId: string;
    name: string;
    poolId: string;
    weight: number;
    totalVotes: number;
    voterCount: number;
    activeBribes: number;
  }> {
    const totalVotes = this.getTotalVotes();

    return Array.from(this.gauges.values())
      .filter(g => g.isActive)
      .map(g => ({
        gaugeId: g.id,
        name: g.name,
        poolId: g.poolId,
        weight: totalVotes > 0 ? g.totalVotes / totalVotes : 0,
        totalVotes: g.totalVotes,
        voterCount: g.voterCount,
        activeBribes: g.bribes.filter(b => b.epoch === this.currentEpoch).length,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get voting statistics
   */
  getStats(): {
    currentEpoch: number;
    epochEndsIn: number;
    totalGauges: number;
    activeGauges: number;
    totalVotes: number;
    totalVoters: number;
    totalBribes: number;
  } {
    const epoch = this.getCurrentEpoch();
    const activeBribes = Array.from(this.gauges.values())
      .flatMap(g => g.bribes)
      .filter(b => b.epoch === this.currentEpoch).length;

    return {
      currentEpoch: this.currentEpoch,
      epochEndsIn: epoch ? epoch.endTime - Date.now() : 0,
      totalGauges: this.gauges.size,
      activeGauges: Array.from(this.gauges.values()).filter(g => g.isActive).length,
      totalVotes: this.getTotalVotes(),
      totalVoters: this.voterVotes.size,
      totalBribes: activeBribes,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

let controllerInstance: GaugeController | null = null;

export function getGaugeController(
  veEngine?: VeTokenEngine,
  config?: Partial<GaugeConfig>
): GaugeController {
  if (!controllerInstance) {
    controllerInstance = new GaugeController(veEngine, config);
  }
  return controllerInstance;
}

export default {
  GaugeController,
  getGaugeController,
  DEFAULT_CONFIG,
};
