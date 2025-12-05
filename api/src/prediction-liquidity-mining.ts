#!/usr/bin/env bun
/**
 * Prediction Markets Liquidity Mining
 *
 * Yield farming rewards for liquidity providers in prediction pools.
 * Incentivizes early adoption with token rewards.
 *
 * Features:
 * - Time-weighted liquidity tracking
 * - Lock duration boost multipliers (1x-3x)
 * - Multi-pool support (per-market pools)
 * - Emission schedule with halving
 * - Referral bonuses
 * - Leaderboard and statistics
 *
 * Reward Formula:
 * reward = (userLiquidity / totalLiquidity) * emissionRate * lockBoost * marketBoost
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type Platform = 'kalshi' | 'polymarket' | 'manifold';
export type LockDuration = '7d' | '30d' | '90d' | '180d' | '365d';

export interface LiquidityPool {
  id: string;
  marketId: string;
  platform: Platform;
  title: string;
  totalLiquidity: number;         // Total USD in pool
  totalShares: number;            // LP shares issued
  rewardRate: number;             // SVMAI tokens per second
  boostMultiplier: number;        // Market-specific boost (1-3x)
  createdAt: number;
  lastRewardUpdate: number;
  accumulatedRewardsPerShare: number;
  isActive: boolean;
}

export interface LiquidityPosition {
  id: string;
  poolId: string;
  provider: string;               // Wallet address
  liquidity: number;              // USD amount
  shares: number;                 // LP shares
  lockDuration: LockDuration;
  lockExpiry: number;             // Timestamp when lock expires
  lockBoost: number;              // Multiplier from lock duration
  rewardDebt: number;             // For reward calculation
  pendingRewards: number;         // Unclaimed rewards
  claimedRewards: number;         // Total claimed
  referrer?: string;              // Referral address
  createdAt: number;
  lastClaimAt?: number;
}

export interface RewardClaim {
  id: string;
  positionId: string;
  provider: string;
  poolId: string;
  amount: number;
  timestamp: number;
  txSignature?: string;
}

export interface EmissionSchedule {
  startTime: number;
  initialRate: number;            // Tokens per second
  halvingInterval: number;        // Seconds between halvings
  minRate: number;                // Floor rate after halvings
}

export interface ReferralConfig {
  /** Bonus to referrer (e.g., 0.1 = 10% of referred rewards) */
  referrerBonus: number;
  /** Bonus to referred user (e.g., 0.05 = 5% extra) */
  refereeBonus: number;
  /** Minimum liquidity to qualify for referral */
  minLiquidity: number;
}

export interface MiningConfig {
  emission: EmissionSchedule;
  referral: ReferralConfig;
  /** Lock duration -> boost multiplier */
  lockBoosts: Record<LockDuration, number>;
  /** Early withdrawal penalty (e.g., 0.1 = 10%) */
  earlyWithdrawalPenalty: number;
  /** Minimum liquidity per position */
  minLiquidity: number;
  /** Maximum positions per provider */
  maxPositionsPerProvider: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MiningConfig = {
  emission: {
    startTime: Date.now(),
    initialRate: 10,              // 10 SVMAI per second
    halvingInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
    minRate: 0.1,
  },
  referral: {
    referrerBonus: 0.1,           // 10% of referree's rewards
    refereeBonus: 0.05,           // 5% extra for referred users
    minLiquidity: 100,            // $100 minimum
  },
  lockBoosts: {
    '7d': 1.0,
    '30d': 1.25,
    '90d': 1.5,
    '180d': 2.0,
    '365d': 3.0,
  },
  earlyWithdrawalPenalty: 0.1,
  minLiquidity: 10,               // $10 minimum
  maxPositionsPerProvider: 10,
};

// ============================================================================
// Liquidity Mining Engine
// ============================================================================

export class LiquidityMiningEngine extends EventEmitter {
  private config: MiningConfig;
  private pools = new Map<string, LiquidityPool>();
  private positions = new Map<string, LiquidityPosition>();
  private claims: RewardClaim[] = [];
  private positionCounter = 0;
  private claimCounter = 0;
  private poolCounter = 0;

  constructor(config: Partial<MiningConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Pool Management
  // --------------------------------------------------------------------------

  /**
   * Create a new liquidity pool for a market
   */
  createPool(
    marketId: string,
    platform: Platform,
    title: string,
    boostMultiplier: number = 1.0
  ): LiquidityPool {
    this.poolCounter++;
    const pool: LiquidityPool = {
      id: `POOL-${this.poolCounter}`,
      marketId,
      platform,
      title,
      totalLiquidity: 0,
      totalShares: 0,
      rewardRate: this.getCurrentEmissionRate(),
      boostMultiplier: Math.min(3, Math.max(1, boostMultiplier)),
      createdAt: Date.now(),
      lastRewardUpdate: Date.now(),
      accumulatedRewardsPerShare: 0,
      isActive: true,
    };

    this.pools.set(pool.id, pool);

    this.emit('pool_created', pool);

    return pool;
  }

  /**
   * Get pool by ID
   */
  getPool(poolId: string): LiquidityPool | null {
    return this.pools.get(poolId) || null;
  }

  /**
   * Get all active pools
   */
  getActivePools(): LiquidityPool[] {
    return Array.from(this.pools.values()).filter(p => p.isActive);
  }

  /**
   * Deactivate a pool (no new deposits, existing can withdraw)
   */
  deactivatePool(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (pool) {
      pool.isActive = false;
      this.emit('pool_deactivated', pool);
    }
  }

  /**
   * Set market boost multiplier
   */
  setPoolBoost(poolId: string, boost: number): void {
    const pool = this.pools.get(poolId);
    if (pool) {
      pool.boostMultiplier = Math.min(3, Math.max(1, boost));
      this.emit('pool_boost_updated', { poolId, boost: pool.boostMultiplier });
    }
  }

  // --------------------------------------------------------------------------
  // Liquidity Positions
  // --------------------------------------------------------------------------

  /**
   * Add liquidity to a pool
   */
  addLiquidity(
    poolId: string,
    provider: string,
    amount: number,
    lockDuration: LockDuration,
    referrer?: string
  ): LiquidityPosition {
    const pool = this.pools.get(poolId);
    if (!pool) throw new Error('Pool not found');
    if (!pool.isActive) throw new Error('Pool is not active');
    if (amount < this.config.minLiquidity) {
      throw new Error(`Minimum liquidity is $${this.config.minLiquidity}`);
    }

    // Check max positions
    const providerPositions = this.getProviderPositions(provider);
    if (providerPositions.length >= this.config.maxPositionsPerProvider) {
      throw new Error(`Maximum ${this.config.maxPositionsPerProvider} positions per provider`);
    }

    // Validate referrer
    if (referrer) {
      if (referrer === provider) {
        throw new Error('Cannot refer yourself');
      }
      if (amount < this.config.referral.minLiquidity) {
        referrer = undefined; // Not enough for referral bonus
      }
    }

    // Update pool rewards before adding liquidity
    this.updatePoolRewards(poolId);

    // Calculate shares (1:1 for first deposit, proportional after)
    const shares = pool.totalLiquidity === 0
      ? amount
      : (amount * pool.totalShares) / pool.totalLiquidity;

    // Calculate lock expiry
    const lockMs = this.getLockDurationMs(lockDuration);
    const lockExpiry = Date.now() + lockMs;

    this.positionCounter++;
    const position: LiquidityPosition = {
      id: `LP-${this.positionCounter}`,
      poolId,
      provider,
      liquidity: amount,
      shares,
      lockDuration,
      lockExpiry,
      lockBoost: this.config.lockBoosts[lockDuration],
      rewardDebt: shares * pool.accumulatedRewardsPerShare,
      pendingRewards: 0,
      claimedRewards: 0,
      referrer,
      createdAt: Date.now(),
    };

    this.positions.set(position.id, position);

    // Update pool totals
    pool.totalLiquidity += amount;
    pool.totalShares += shares;

    this.emit('liquidity_added', {
      position,
      pool,
    });

    return position;
  }

  /**
   * Remove liquidity from pool
   */
  removeLiquidity(positionId: string): {
    liquidity: number;
    rewards: number;
    penalty: number;
  } {
    const position = this.positions.get(positionId);
    if (!position) throw new Error('Position not found');

    const pool = this.pools.get(position.poolId);
    if (!pool) throw new Error('Pool not found');

    // Update rewards before removal
    this.updatePoolRewards(position.poolId);
    this.updatePositionRewards(positionId);

    // Check for early withdrawal
    const isEarly = Date.now() < position.lockExpiry;
    let penalty = 0;
    let liquidityReturned = position.liquidity;

    if (isEarly) {
      penalty = position.liquidity * this.config.earlyWithdrawalPenalty;
      liquidityReturned -= penalty;
    }

    // Claim any pending rewards
    const rewards = position.pendingRewards;

    // Update pool totals
    pool.totalLiquidity -= position.liquidity;
    pool.totalShares -= position.shares;

    // Remove position
    this.positions.delete(positionId);

    this.emit('liquidity_removed', {
      positionId,
      provider: position.provider,
      liquidity: liquidityReturned,
      rewards,
      penalty,
      isEarly,
    });

    return {
      liquidity: liquidityReturned,
      rewards,
      penalty,
    };
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): LiquidityPosition | null {
    return this.positions.get(positionId) || null;
  }

  /**
   * Get all positions for a provider
   */
  getProviderPositions(provider: string): LiquidityPosition[] {
    return Array.from(this.positions.values()).filter(p => p.provider === provider);
  }

  // --------------------------------------------------------------------------
  // Reward Calculation & Distribution
  // --------------------------------------------------------------------------

  /**
   * Get current emission rate (with halving)
   */
  getCurrentEmissionRate(): number {
    const elapsed = Date.now() - this.config.emission.startTime;
    const halvings = Math.floor(elapsed / this.config.emission.halvingInterval);

    const rate = this.config.emission.initialRate / Math.pow(2, halvings);
    return Math.max(rate, this.config.emission.minRate);
  }

  /**
   * Update pool's accumulated rewards per share
   */
  updatePoolRewards(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (!pool || pool.totalShares === 0) return;

    const now = Date.now();
    const elapsed = (now - pool.lastRewardUpdate) / 1000; // Convert to seconds

    if (elapsed <= 0) return;

    const emissionRate = this.getCurrentEmissionRate();
    const poolRewards = elapsed * emissionRate * pool.boostMultiplier;
    const rewardsPerShare = poolRewards / pool.totalShares;

    pool.accumulatedRewardsPerShare += rewardsPerShare;
    pool.lastRewardUpdate = now;
  }

  /**
   * Update position's pending rewards
   */
  updatePositionRewards(positionId: string): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    const pool = this.pools.get(position.poolId);
    if (!pool) return;

    const baseReward = position.shares * pool.accumulatedRewardsPerShare - position.rewardDebt;
    const boostedReward = baseReward * position.lockBoost;

    // Add referral bonus if applicable
    let refereeBonus = 0;
    if (position.referrer) {
      refereeBonus = boostedReward * this.config.referral.refereeBonus;
    }

    position.pendingRewards = boostedReward + refereeBonus;
    position.rewardDebt = position.shares * pool.accumulatedRewardsPerShare;
  }

  /**
   * Claim pending rewards
   */
  claimRewards(positionId: string): RewardClaim {
    const position = this.positions.get(positionId);
    if (!position) throw new Error('Position not found');

    // Update rewards first
    this.updatePoolRewards(position.poolId);
    this.updatePositionRewards(positionId);

    const amount = position.pendingRewards;
    if (amount <= 0) throw new Error('No rewards to claim');

    // Handle referral bonus to referrer
    if (position.referrer) {
      const referrerBonus = amount * this.config.referral.referrerBonus;
      // In production, this would credit the referrer's account
      this.emit('referral_bonus', {
        referrer: position.referrer,
        referee: position.provider,
        bonus: referrerBonus,
      });
    }

    // Create claim record
    this.claimCounter++;
    const claim: RewardClaim = {
      id: `CLAIM-${this.claimCounter}`,
      positionId,
      provider: position.provider,
      poolId: position.poolId,
      amount,
      timestamp: Date.now(),
    };

    this.claims.push(claim);

    // Update position
    position.claimedRewards += amount;
    position.pendingRewards = 0;
    position.lastClaimAt = Date.now();

    this.emit('rewards_claimed', claim);

    return claim;
  }

  /**
   * Get pending rewards for a position
   */
  getPendingRewards(positionId: string): number {
    const position = this.positions.get(positionId);
    if (!position) return 0;

    // Calculate without modifying state
    const pool = this.pools.get(position.poolId);
    if (!pool || pool.totalShares === 0) return position.pendingRewards;

    const now = Date.now();
    const elapsed = (now - pool.lastRewardUpdate) / 1000;
    const emissionRate = this.getCurrentEmissionRate();
    const additionalRewardsPerShare = (elapsed * emissionRate * pool.boostMultiplier) / pool.totalShares;

    const currentAccumulated = pool.accumulatedRewardsPerShare + additionalRewardsPerShare;
    const baseReward = position.shares * currentAccumulated - position.rewardDebt;
    const boostedReward = baseReward * position.lockBoost;

    let refereeBonus = 0;
    if (position.referrer) {
      refereeBonus = boostedReward * this.config.referral.refereeBonus;
    }

    return boostedReward + refereeBonus + position.pendingRewards;
  }

  // --------------------------------------------------------------------------
  // Statistics & Leaderboard
  // --------------------------------------------------------------------------

  /**
   * Get provider's total stats across all positions
   */
  getProviderStats(provider: string): {
    totalLiquidity: number;
    totalShares: number;
    totalPendingRewards: number;
    totalClaimedRewards: number;
    positionCount: number;
    avgLockBoost: number;
  } {
    const positions = this.getProviderPositions(provider);

    if (positions.length === 0) {
      return {
        totalLiquidity: 0,
        totalShares: 0,
        totalPendingRewards: 0,
        totalClaimedRewards: 0,
        positionCount: 0,
        avgLockBoost: 0,
      };
    }

    let totalLiquidity = 0;
    let totalShares = 0;
    let totalPendingRewards = 0;
    let totalClaimedRewards = 0;
    let totalLockBoost = 0;

    for (const pos of positions) {
      totalLiquidity += pos.liquidity;
      totalShares += pos.shares;
      totalPendingRewards += this.getPendingRewards(pos.id);
      totalClaimedRewards += pos.claimedRewards;
      totalLockBoost += pos.lockBoost;
    }

    return {
      totalLiquidity,
      totalShares,
      totalPendingRewards,
      totalClaimedRewards,
      positionCount: positions.length,
      avgLockBoost: totalLockBoost / positions.length,
    };
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalPools: number;
    activePools: number;
    totalLiquidity: number;
    totalProviders: number;
    currentEmissionRate: number;
    totalRewardsClaimed: number;
  } {
    const pools = Array.from(this.pools.values());
    const activePools = pools.filter(p => p.isActive);
    const totalLiquidity = pools.reduce((sum, p) => sum + p.totalLiquidity, 0);

    const providers = new Set(Array.from(this.positions.values()).map(p => p.provider));

    const totalRewardsClaimed = this.claims.reduce((sum, c) => sum + c.amount, 0);

    return {
      totalPools: pools.length,
      activePools: activePools.length,
      totalLiquidity,
      totalProviders: providers.size,
      currentEmissionRate: this.getCurrentEmissionRate(),
      totalRewardsClaimed,
    };
  }

  /**
   * Get leaderboard by total liquidity
   */
  getLeaderboard(limit: number = 10): Array<{
    rank: number;
    provider: string;
    totalLiquidity: number;
    totalRewards: number;
    positionCount: number;
  }> {
    // Group by provider
    const providerStats = new Map<string, {
      totalLiquidity: number;
      totalRewards: number;
      positionCount: number;
    }>();

    for (const position of this.positions.values()) {
      const existing = providerStats.get(position.provider) || {
        totalLiquidity: 0,
        totalRewards: 0,
        positionCount: 0,
      };

      existing.totalLiquidity += position.liquidity;
      existing.totalRewards += this.getPendingRewards(position.id) + position.claimedRewards;
      existing.positionCount++;

      providerStats.set(position.provider, existing);
    }

    // Sort by liquidity and return top N
    return Array.from(providerStats.entries())
      .sort((a, b) => b[1].totalLiquidity - a[1].totalLiquidity)
      .slice(0, limit)
      .map(([provider, stats], index) => ({
        rank: index + 1,
        provider,
        ...stats,
      }));
  }

  /**
   * Get pool leaderboard
   */
  getPoolLeaderboard(poolId: string, limit: number = 10): Array<{
    rank: number;
    provider: string;
    liquidity: number;
    shares: number;
    lockBoost: number;
    pendingRewards: number;
  }> {
    const poolPositions = Array.from(this.positions.values())
      .filter(p => p.poolId === poolId)
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, limit);

    return poolPositions.map((pos, index) => ({
      rank: index + 1,
      provider: pos.provider,
      liquidity: pos.liquidity,
      shares: pos.shares,
      lockBoost: pos.lockBoost,
      pendingRewards: this.getPendingRewards(pos.id),
    }));
  }

  // --------------------------------------------------------------------------
  // APR Calculation
  // --------------------------------------------------------------------------

  /**
   * Calculate estimated APR for a pool
   */
  getPoolAPR(poolId: string, tokenPrice: number = 1): number {
    const pool = this.pools.get(poolId);
    if (!pool || pool.totalLiquidity === 0) return 0;

    const emissionRate = this.getCurrentEmissionRate();
    const yearlyEmission = emissionRate * 365 * 24 * 60 * 60;
    const poolShare = pool.boostMultiplier; // Relative to other pools
    const poolYearlyRewards = yearlyEmission * poolShare;
    const rewardsValueUSD = poolYearlyRewards * tokenPrice;

    return (rewardsValueUSD / pool.totalLiquidity) * 100;
  }

  /**
   * Calculate estimated APR for a position (including lock boost)
   */
  getPositionAPR(positionId: string, tokenPrice: number = 1): number {
    const position = this.positions.get(positionId);
    if (!position) return 0;

    const poolAPR = this.getPoolAPR(position.poolId, tokenPrice);
    return poolAPR * position.lockBoost;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getLockDurationMs(duration: LockDuration): number {
    const day = 24 * 60 * 60 * 1000;
    switch (duration) {
      case '7d': return 7 * day;
      case '30d': return 30 * day;
      case '90d': return 90 * day;
      case '180d': return 180 * day;
      case '365d': return 365 * day;
    }
  }
}

// ============================================================================
// Referral Tracking
// ============================================================================

export class ReferralTracker {
  private referrals = new Map<string, string>(); // referee -> referrer
  private referralCount = new Map<string, number>(); // referrer -> count
  private referralEarnings = new Map<string, number>(); // referrer -> total earned

  recordReferral(referrer: string, referee: string): void {
    if (this.referrals.has(referee)) {
      throw new Error('User already has a referrer');
    }
    if (referrer === referee) {
      throw new Error('Cannot refer yourself');
    }

    this.referrals.set(referee, referrer);
    this.referralCount.set(referrer, (this.referralCount.get(referrer) || 0) + 1);
  }

  getReferrer(referee: string): string | null {
    return this.referrals.get(referee) || null;
  }

  recordEarnings(referrer: string, amount: number): void {
    this.referralEarnings.set(
      referrer,
      (this.referralEarnings.get(referrer) || 0) + amount
    );
  }

  getReferralStats(referrer: string): {
    referralCount: number;
    totalEarnings: number;
  } {
    return {
      referralCount: this.referralCount.get(referrer) || 0,
      totalEarnings: this.referralEarnings.get(referrer) || 0,
    };
  }

  getTopReferrers(limit: number = 10): Array<{
    referrer: string;
    count: number;
    earnings: number;
  }> {
    return Array.from(this.referralCount.entries())
      .map(([referrer, count]) => ({
        referrer,
        count,
        earnings: this.referralEarnings.get(referrer) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

// ============================================================================
// Exports
// ============================================================================

let engineInstance: LiquidityMiningEngine | null = null;

export function getLiquidityMiningEngine(config?: Partial<MiningConfig>): LiquidityMiningEngine {
  if (!engineInstance) {
    engineInstance = new LiquidityMiningEngine(config);
  }
  return engineInstance;
}

export default {
  LiquidityMiningEngine,
  ReferralTracker,
  getLiquidityMiningEngine,
  DEFAULT_CONFIG,
};
