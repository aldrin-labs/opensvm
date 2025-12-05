#!/usr/bin/env bun
/**
 * SVMAI Staking + Liquidity Mining Integration
 *
 * Connects LP rewards to SVMAI staking for compound boosts.
 * Staking + LP = higher yields and deeper ecosystem engagement.
 *
 * Tiers & Boosts:
 * - Bronze (100 SVMAI):    1.1x LP boost
 * - Silver (1,000 SVMAI):  1.25x LP boost
 * - Gold (10,000 SVMAI):   1.5x LP boost
 * - Platinum (100,000 SVMAI): 2.0x LP boost
 * - Diamond (1,000,000 SVMAI): 3.0x LP boost
 *
 * Features:
 * - Tier-based LP reward multipliers
 * - Staking duration bonuses
 * - Auto-compound rewards to staking
 * - Cross-product loyalty bonuses
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type StakingTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface StakingPosition {
  id: string;
  wallet: string;
  amount: number;            // SVMAI staked
  lockDuration: number;      // Days
  lockExpiry: number;        // Timestamp
  stakingMultiplier: number; // Duration-based multiplier
  tier: StakingTier;
  createdAt: number;
}

export interface TierConfig {
  minStake: number;
  lpBoostMultiplier: number;
  votingPower: number;
  feeDiscount: number;       // % discount on platform fees
}

export interface IntegrationConfig {
  tiers: Record<StakingTier, TierConfig>;
  durationMultipliers: Record<string, number>;
  autoCompoundFee: number;   // % fee for auto-compound
  loyaltyBonusRate: number;  // Extra bonus for using both products
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: IntegrationConfig = {
  tiers: {
    none: { minStake: 0, lpBoostMultiplier: 1.0, votingPower: 0, feeDiscount: 0 },
    bronze: { minStake: 100, lpBoostMultiplier: 1.1, votingPower: 1, feeDiscount: 0.05 },
    silver: { minStake: 1000, lpBoostMultiplier: 1.25, votingPower: 2, feeDiscount: 0.1 },
    gold: { minStake: 10000, lpBoostMultiplier: 1.5, votingPower: 5, feeDiscount: 0.15 },
    platinum: { minStake: 100000, lpBoostMultiplier: 2.0, votingPower: 10, feeDiscount: 0.2 },
    diamond: { minStake: 1000000, lpBoostMultiplier: 3.0, votingPower: 25, feeDiscount: 0.3 },
  },
  durationMultipliers: {
    '7d': 1.0,
    '30d': 1.1,
    '90d': 1.2,
    '180d': 1.4,
    '365d': 1.75,
  },
  autoCompoundFee: 0.01,     // 1% fee
  loyaltyBonusRate: 0.1,     // 10% bonus for staking + LP
};

// ============================================================================
// Staking Integration
// ============================================================================

export class StakingIntegration extends EventEmitter {
  private config: IntegrationConfig;
  private stakingPositions = new Map<string, StakingPosition>();
  private positionCounter = 0;
  private walletToPosition = new Map<string, string>(); // wallet -> position ID

  constructor(config: Partial<IntegrationConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      tiers: { ...DEFAULT_CONFIG.tiers, ...config.tiers },
      durationMultipliers: { ...DEFAULT_CONFIG.durationMultipliers, ...config.durationMultipliers },
    };
  }

  // --------------------------------------------------------------------------
  // Staking Operations
  // --------------------------------------------------------------------------

  /**
   * Stake SVMAI tokens
   */
  stake(
    wallet: string,
    amount: number,
    lockDurationDays: number
  ): StakingPosition {
    // Check if wallet already has a position
    const existingId = this.walletToPosition.get(wallet);
    if (existingId) {
      // Add to existing position
      return this.addToStake(existingId, amount);
    }

    // Calculate tier
    const tier = this.calculateTier(amount);

    // Calculate duration multiplier
    const durationKey = this.getDurationKey(lockDurationDays);
    const stakingMultiplier = this.config.durationMultipliers[durationKey] || 1.0;

    this.positionCounter++;
    const position: StakingPosition = {
      id: `STAKE-${this.positionCounter}`,
      wallet,
      amount,
      lockDuration: lockDurationDays,
      lockExpiry: Date.now() + lockDurationDays * 24 * 60 * 60 * 1000,
      stakingMultiplier,
      tier,
      createdAt: Date.now(),
    };

    this.stakingPositions.set(position.id, position);
    this.walletToPosition.set(wallet, position.id);

    this.emit('staked', position);

    return position;
  }

  /**
   * Add to existing stake
   */
  addToStake(positionId: string, amount: number): StakingPosition {
    const position = this.stakingPositions.get(positionId);
    if (!position) throw new Error('Position not found');

    position.amount += amount;
    position.tier = this.calculateTier(position.amount);

    this.emit('stake_increased', { positionId, amount, newTotal: position.amount });

    return position;
  }

  /**
   * Unstake tokens
   */
  unstake(positionId: string, amount?: number): {
    returned: number;
    penalty: number;
    remaining: number;
  } {
    const position = this.stakingPositions.get(positionId);
    if (!position) throw new Error('Position not found');

    const unstakeAmount = amount || position.amount;
    if (unstakeAmount > position.amount) {
      throw new Error('Insufficient staked balance');
    }

    // Check for early withdrawal penalty
    const isEarly = Date.now() < position.lockExpiry;
    const penalty = isEarly ? unstakeAmount * 0.1 : 0;
    const returned = unstakeAmount - penalty;

    position.amount -= unstakeAmount;

    if (position.amount === 0) {
      this.stakingPositions.delete(positionId);
      this.walletToPosition.delete(position.wallet);
    } else {
      position.tier = this.calculateTier(position.amount);
    }

    this.emit('unstaked', {
      positionId,
      amount: unstakeAmount,
      returned,
      penalty,
      isEarly,
    });

    return {
      returned,
      penalty,
      remaining: position.amount,
    };
  }

  /**
   * Get staking position for wallet
   */
  getPosition(wallet: string): StakingPosition | null {
    const positionId = this.walletToPosition.get(wallet);
    if (!positionId) return null;
    return this.stakingPositions.get(positionId) || null;
  }

  // --------------------------------------------------------------------------
  // Tier System
  // --------------------------------------------------------------------------

  /**
   * Calculate tier based on staked amount
   */
  calculateTier(amount: number): StakingTier {
    const tiers = this.config.tiers;

    if (amount >= tiers.diamond.minStake) return 'diamond';
    if (amount >= tiers.platinum.minStake) return 'platinum';
    if (amount >= tiers.gold.minStake) return 'gold';
    if (amount >= tiers.silver.minStake) return 'silver';
    if (amount >= tiers.bronze.minStake) return 'bronze';
    return 'none';
  }

  /**
   * Get tier config
   */
  getTierConfig(tier: StakingTier): TierConfig {
    return this.config.tiers[tier];
  }

  /**
   * Get all tier thresholds
   */
  getAllTiers(): Array<{ tier: StakingTier; config: TierConfig }> {
    return Object.entries(this.config.tiers).map(([tier, config]) => ({
      tier: tier as StakingTier,
      config,
    }));
  }

  // --------------------------------------------------------------------------
  // LP Integration
  // --------------------------------------------------------------------------

  /**
   * Get compound boost from staking + LP position
   */
  getCompoundBoost(
    wallet: string,
    lpLockBoost: number = 1
  ): {
    lpLockBoost: number;
    stakingMultiplier: number;
    tierBonus: number;
    loyaltyBonus: number;
    totalBoost: number;
    tier: StakingTier;
    stakedAmount: number;
  } {
    const position = this.getPosition(wallet);

    if (!position) {
      return {
        lpLockBoost,
        stakingMultiplier: 1,
        tierBonus: 0,
        loyaltyBonus: 0,
        totalBoost: lpLockBoost,
        tier: 'none',
        stakedAmount: 0,
      };
    }

    const tierConfig = this.getTierConfig(position.tier);
    const stakingMultiplier = tierConfig.lpBoostMultiplier;

    // Loyalty bonus for using both staking and LP
    const loyaltyBonus = lpLockBoost > 1 ? this.config.loyaltyBonusRate : 0;

    // Total boost = LP lock boost * staking tier multiplier * (1 + loyalty bonus)
    const totalBoost = lpLockBoost * stakingMultiplier * (1 + loyaltyBonus);

    return {
      lpLockBoost,
      stakingMultiplier,
      tierBonus: stakingMultiplier - 1,
      loyaltyBonus,
      totalBoost,
      tier: position.tier,
      stakedAmount: position.amount,
    };
  }

  /**
   * Calculate effective APR with staking boost
   */
  getEffectiveAPR(
    baseAPR: number,
    wallet: string,
    lpLockBoost: number = 1
  ): {
    baseAPR: number;
    effectiveAPR: number;
    boost: ReturnType<typeof this.getCompoundBoost>;
  } {
    const boost = this.getCompoundBoost(wallet, lpLockBoost);
    const effectiveAPR = baseAPR * boost.totalBoost;

    return {
      baseAPR,
      effectiveAPR,
      boost,
    };
  }

  // --------------------------------------------------------------------------
  // Auto-Compound
  // --------------------------------------------------------------------------

  /**
   * Auto-compound LP rewards into staking position
   */
  autoCompound(
    wallet: string,
    lpRewards: number
  ): {
    compounded: number;
    fee: number;
    newStakedAmount: number;
    newTier: StakingTier;
  } {
    const fee = lpRewards * this.config.autoCompoundFee;
    const compounded = lpRewards - fee;

    let position = this.getPosition(wallet);

    if (!position) {
      // Create new staking position with compounded rewards
      position = this.stake(wallet, compounded, 30); // Default 30-day lock
    } else {
      this.addToStake(position.id, compounded);
    }

    this.emit('auto_compounded', {
      wallet,
      rewards: lpRewards,
      compounded,
      fee,
      newStakedAmount: position.amount,
    });

    return {
      compounded,
      fee,
      newStakedAmount: position.amount,
      newTier: position.tier,
    };
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get global staking statistics
   */
  getGlobalStats(): {
    totalStaked: number;
    totalStakers: number;
    tierDistribution: Record<StakingTier, number>;
    avgStake: number;
  } {
    const positions = Array.from(this.stakingPositions.values());
    const totalStaked = positions.reduce((sum, p) => sum + p.amount, 0);

    const tierDistribution: Record<StakingTier, number> = {
      none: 0,
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
    };

    for (const pos of positions) {
      tierDistribution[pos.tier]++;
    }

    return {
      totalStaked,
      totalStakers: positions.length,
      tierDistribution,
      avgStake: positions.length > 0 ? totalStaked / positions.length : 0,
    };
  }

  /**
   * Get wallet's full profile
   */
  getWalletProfile(wallet: string): {
    position: StakingPosition | null;
    tier: StakingTier;
    tierConfig: TierConfig;
    nextTier: StakingTier | null;
    amountToNextTier: number;
    lpBoostMultiplier: number;
    votingPower: number;
    feeDiscount: number;
  } {
    const position = this.getPosition(wallet);
    const tier = position?.tier || 'none';
    const tierConfig = this.getTierConfig(tier);

    // Calculate next tier
    const tierOrder: StakingTier[] = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const currentIndex = tierOrder.indexOf(tier);
    const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
    const amountToNextTier = nextTier
      ? this.config.tiers[nextTier].minStake - (position?.amount || 0)
      : 0;

    return {
      position,
      tier,
      tierConfig,
      nextTier,
      amountToNextTier: Math.max(0, amountToNextTier),
      lpBoostMultiplier: tierConfig.lpBoostMultiplier,
      votingPower: tierConfig.votingPower,
      feeDiscount: tierConfig.feeDiscount,
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getDurationKey(days: number): string {
    if (days >= 365) return '365d';
    if (days >= 180) return '180d';
    if (days >= 90) return '90d';
    if (days >= 30) return '30d';
    return '7d';
  }
}

// ============================================================================
// Exports
// ============================================================================

let integrationInstance: StakingIntegration | null = null;

export function getStakingIntegration(config?: Partial<IntegrationConfig>): StakingIntegration {
  if (!integrationInstance) {
    integrationInstance = new StakingIntegration(config);
  }
  return integrationInstance;
}

export default {
  StakingIntegration,
  getStakingIntegration,
  DEFAULT_CONFIG,
};
