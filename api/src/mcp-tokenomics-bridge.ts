/**
 * MCP Governance - Tokenomics Integration Bridge
 *
 * Connects MCP advanced governance with the existing lib/tokenomics module
 * for real $SVMAI token integration.
 *
 * Features:
 * - Staking integration with voting power calculation
 * - Governance integration with proposal system
 * - Event emission for real-time updates
 */

import { UnifiedMCPRegistry } from './mcp-registry-unified.js';
import { AdvancedGovernance, AdvancedGovernanceConfig } from './mcp-advanced-governance.js';

// ============================================================================
// Types
// ============================================================================

export interface TokenomicsStake {
  id: string;
  wallet: string;
  amount: bigint;
  duration: StakeDuration;
  startTime: number;
  endTime: number;
  multiplier: number;
  effectiveAmount: bigint;
  rewards: bigint;
  claimed: bigint;
  status: 'active' | 'unlocked' | 'withdrawn';
}

export type StakeDuration = '7d' | '30d' | '90d' | '180d' | '365d';

export interface StakeConfig {
  duration: StakeDuration;
  durationDays: number;
  multiplier: number;
  earlyUnstakePenalty: number;
  rewardBoost: number;
}

export interface GovernanceEventEmitter {
  emit: (event: string, data: any) => void;
}

// ============================================================================
// Stake Configuration
// ============================================================================

export const STAKE_CONFIGS: StakeConfig[] = [
  { duration: '7d', durationDays: 7, multiplier: 1.0, earlyUnstakePenalty: 5, rewardBoost: 0 },
  { duration: '30d', durationDays: 30, multiplier: 1.25, earlyUnstakePenalty: 10, rewardBoost: 10 },
  { duration: '90d', durationDays: 90, multiplier: 1.5, earlyUnstakePenalty: 15, rewardBoost: 25 },
  { duration: '180d', durationDays: 180, multiplier: 2.0, earlyUnstakePenalty: 20, rewardBoost: 50 },
  { duration: '365d', durationDays: 365, multiplier: 3.0, earlyUnstakePenalty: 25, rewardBoost: 100 },
];

// ============================================================================
// Tokenomics Bridge
// ============================================================================

export class MCPTokenomicsBridge {
  private governance: AdvancedGovernance;
  private stakes = new Map<string, TokenomicsStake[]>();
  private eventEmitter?: GovernanceEventEmitter;
  private totalStaked = BigInt(0);
  private rewardPool = BigInt(0);

  constructor(
    registry: UnifiedMCPRegistry,
    governanceConfig?: Partial<AdvancedGovernanceConfig>,
    eventEmitter?: GovernanceEventEmitter
  ) {
    this.governance = new AdvancedGovernance(registry, governanceConfig);
    this.eventEmitter = eventEmitter;
  }

  // ==========================================================================
  // Staking Integration
  // ==========================================================================

  /**
   * Create a stake position and register with governance
   */
  createStake(
    wallet: string,
    amount: bigint,
    duration: StakeDuration
  ): TokenomicsStake {
    const config = this.getStakeConfig(duration);
    const now = Date.now();

    const stake: TokenomicsStake = {
      id: `stake-${wallet}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      wallet,
      amount,
      duration,
      startTime: now,
      endTime: now + config.durationDays * 24 * 60 * 60 * 1000,
      multiplier: config.multiplier,
      effectiveAmount: BigInt(Math.floor(Number(amount) * config.multiplier)),
      rewards: BigInt(0),
      claimed: BigInt(0),
      status: 'active',
    };

    // Store stake
    const walletStakes = this.stakes.get(wallet) || [];
    walletStakes.push(stake);
    this.stakes.set(wallet, walletStakes);

    // Update totals
    this.totalStaked += amount;

    // Register with governance
    this.syncStakeToGovernance(wallet);

    // Emit event
    this.emit('stake_created', {
      stakeId: stake.id,
      wallet,
      amount: amount.toString(),
      duration,
      effectiveAmount: stake.effectiveAmount.toString(),
      multiplier: config.multiplier,
    });

    return stake;
  }

  /**
   * Get stake configuration for a duration
   */
  getStakeConfig(duration: StakeDuration): StakeConfig {
    const config = STAKE_CONFIGS.find(c => c.duration === duration);
    if (!config) {
      throw new Error(`Unknown stake duration: ${duration}`);
    }
    return config;
  }

  /**
   * Get all stakes for a wallet
   */
  getWalletStakes(wallet: string): TokenomicsStake[] {
    return this.stakes.get(wallet) || [];
  }

  /**
   * Get total staked for a wallet
   */
  getWalletTotalStaked(wallet: string): {
    staked: bigint;
    effective: bigint;
    pendingRewards: bigint;
  } {
    const stakes = this.getWalletStakes(wallet);

    let staked = BigInt(0);
    let effective = BigInt(0);
    let pendingRewards = BigInt(0);

    for (const stake of stakes) {
      if (stake.status === 'active') {
        staked += stake.amount;
        effective += stake.effectiveAmount;
        pendingRewards += stake.rewards - stake.claimed;
      }
    }

    return { staked, effective, pendingRewards };
  }

  /**
   * Sync stake data to governance system
   */
  private syncStakeToGovernance(wallet: string): void {
    const { effective } = this.getWalletTotalStaked(wallet);
    this.governance.registerStake(wallet, effective);
  }

  /**
   * Unstake tokens
   */
  unstake(stakeId: string): {
    success: boolean;
    returnAmount: bigint;
    penalty: bigint;
    rewards: bigint;
  } {
    // Find stake
    let targetStake: TokenomicsStake | undefined;
    let wallet: string | undefined;

    for (const [w, stakes] of this.stakes.entries()) {
      const stake = stakes.find(s => s.id === stakeId);
      if (stake) {
        targetStake = stake;
        wallet = w;
        break;
      }
    }

    if (!targetStake || !wallet) {
      throw new Error(`Stake not found: ${stakeId}`);
    }

    if (targetStake.status !== 'active') {
      throw new Error(`Stake is not active: ${stakeId}`);
    }

    const config = this.getStakeConfig(targetStake.duration);
    const now = Date.now();
    const isEarly = now < targetStake.endTime;

    let returnAmount = targetStake.amount;
    let penalty = BigInt(0);

    if (isEarly) {
      penalty = BigInt(Math.floor(Number(targetStake.amount) * (config.earlyUnstakePenalty / 100)));
      returnAmount = targetStake.amount - penalty;
      this.rewardPool += penalty; // Add penalty to reward pool
    }

    const unclaimedRewards = targetStake.rewards - targetStake.claimed;

    // Update stake status
    targetStake.status = 'withdrawn';
    this.totalStaked -= targetStake.amount;

    // Re-sync with governance
    this.syncStakeToGovernance(wallet);

    // Emit event
    this.emit('stake_withdrawn', {
      stakeId,
      wallet,
      returnAmount: returnAmount.toString(),
      penalty: penalty.toString(),
      rewards: unclaimedRewards.toString(),
      wasEarly: isEarly,
    });

    return {
      success: true,
      returnAmount,
      penalty,
      rewards: unclaimedRewards,
    };
  }

  // ==========================================================================
  // Governance Integration
  // ==========================================================================

  /**
   * Create a governance proposal
   */
  createProposal(
    proposer: string,
    params: {
      title: string;
      description: string;
      type: string;
      actions: Array<{ target: string; function: string; params: Record<string, any> }>;
      votingMode?: 'simple' | 'quadratic' | 'conviction' | 'holographic';
    }
  ) {
    const proposal = this.governance.createProposal(proposer, params);

    this.emit('proposal_created', {
      proposalId: proposal.id,
      title: proposal.title,
      proposer,
      type: proposal.type,
      votingMode: proposal.votingMode,
    });

    return proposal;
  }

  /**
   * Cast a vote on a proposal
   */
  vote(
    proposalId: string,
    voter: string,
    support: 'for' | 'against' | 'abstain',
    reason?: string
  ) {
    const result = this.governance.vote(proposalId, voter, support, reason);

    this.emit('vote_cast', {
      proposalId,
      voter,
      support,
      votingPower: result.votingPower.toString(),
      conviction: result.conviction,
      reason,
    });

    return result;
  }

  /**
   * Boost a proposal (holographic consensus)
   */
  boostProposal(
    proposalId: string,
    booster: string,
    prediction: 'pass' | 'fail'
  ) {
    const boost = this.governance.boostProposal(proposalId, booster, prediction);

    this.emit('boost_applied', {
      proposalId,
      booster,
      prediction,
      stakeAmount: boost.stakeAmount.toString(),
    });

    return boost;
  }

  /**
   * Request rage quit
   */
  requestRageQuit(wallet: string, proposalId: string) {
    const request = this.governance.requestRageQuit(wallet, proposalId);

    this.emit('rage_quit_requested', {
      requestId: request.id,
      wallet,
      proposalId,
      claimableAmount: request.claimableAmount.toString(),
    });

    return request;
  }

  /**
   * Process rage quit
   */
  processRageQuit(requestId: string) {
    const result = this.governance.processRageQuit(requestId);

    this.emit('rage_quit_processed', {
      requestId,
      burned: result.burned.toString(),
      claimed: result.claimed.toString(),
    });

    // Remove stakes for the wallet that rage quit
    for (const [wallet, stakes] of this.stakes.entries()) {
      for (const stake of stakes) {
        if (stake.status === 'active') {
          const govStake = this.governance.getStake(wallet);
          if (!govStake) {
            stake.status = 'withdrawn';
            this.totalStaked -= stake.amount;
          }
        }
      }
    }

    return result;
  }

  /**
   * Buy prediction market shares
   */
  buyPredictionShares(
    proposalId: string,
    buyer: string,
    outcome: 'yes' | 'no',
    amount: bigint
  ) {
    const result = this.governance.buyPredictionShares(proposalId, buyer, outcome, amount);

    this.emit('prediction_update', {
      proposalId,
      buyer,
      outcome,
      amount: amount.toString(),
      shares: result.shares.toString(),
      newPrice: result.price,
    });

    return result;
  }

  /**
   * Finalize a proposal
   */
  finalizeProposal(proposalId: string) {
    const proposal = this.governance.finalizeProposal(proposalId);

    this.emit('proposal_finalized', {
      proposalId,
      status: proposal.status,
      votesFor: proposal.votesFor.toString(),
      votesAgainst: proposal.votesAgainst.toString(),
      passed: proposal.status === 'passed' || proposal.status === 'rage_quit_window',
    });

    return proposal;
  }

  /**
   * Execute a proposal
   */
  executeProposal(proposalId: string) {
    const result = this.governance.execute(proposalId);

    this.emit('proposal_executed', {
      proposalId,
      success: result.success,
      results: result.results,
    });

    return result;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  getProposal(id: string) {
    return this.governance.getProposal(id);
  }

  getActiveProposals() {
    return this.governance.getActiveProposals();
  }

  getMarketPrediction(proposalId: string) {
    return this.governance.getMarketPrediction(proposalId);
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const govStats = this.governance.getStats();

    return {
      governance: govStats,
      staking: {
        totalStaked: this.totalStaked.toString(),
        rewardPool: this.rewardPool.toString(),
        totalStakers: this.stakes.size,
        stakesByDuration: this.getStakesByDuration(),
      },
    };
  }

  private getStakesByDuration(): Record<StakeDuration, { count: number; amount: string }> {
    const result: Record<string, { count: number; amount: bigint }> = {};

    for (const [, stakes] of this.stakes.entries()) {
      for (const stake of stakes) {
        if (stake.status !== 'active') continue;

        if (!result[stake.duration]) {
          result[stake.duration] = { count: 0, amount: BigInt(0) };
        }
        result[stake.duration].count++;
        result[stake.duration].amount += stake.amount;
      }
    }

    // Convert bigints to strings for serialization
    const serialized: Record<StakeDuration, { count: number; amount: string }> = {} as any;
    for (const [duration, data] of Object.entries(result)) {
      serialized[duration as StakeDuration] = {
        count: data.count,
        amount: data.amount.toString(),
      };
    }

    return serialized;
  }

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  private emit(event: string, data: any) {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, {
        type: event,
        timestamp: Date.now(),
        data,
      });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let bridgeInstance: MCPTokenomicsBridge | null = null;

export function getMCPTokenomicsBridge(
  registry?: UnifiedMCPRegistry,
  config?: Partial<AdvancedGovernanceConfig>,
  emitter?: GovernanceEventEmitter
): MCPTokenomicsBridge {
  if (!bridgeInstance && registry) {
    bridgeInstance = new MCPTokenomicsBridge(registry, config, emitter);
  }
  if (!bridgeInstance) {
    throw new Error('Bridge not initialized. Provide registry on first call.');
  }
  return bridgeInstance;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MCPTokenomicsBridge,
  getMCPTokenomicsBridge,
  STAKE_CONFIGS,
};
