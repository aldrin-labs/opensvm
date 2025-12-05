#!/usr/bin/env bun
/**
 * Vote-Escrowed SVMAI (veSVMAI) Token Model
 *
 * Based on Curve's veToken design for long-term alignment.
 *
 * Key Mechanics:
 * - Lock SVMAI for 1 week to 4 years
 * - Receive veSVMAI proportional to lock time
 * - veSVMAI decays linearly to 0 at lock expiry
 * - veSVMAI grants:
 *   - Voting power in gauge voting
 *   - Boosted LP rewards (up to 2.5x)
 *   - Protocol fee sharing
 *   - Governance participation
 *
 * Lock Time -> veSVMAI Conversion:
 * - 4 years: 1 SVMAI = 1 veSVMAI
 * - 2 years: 1 SVMAI = 0.5 veSVMAI
 * - 1 year:  1 SVMAI = 0.25 veSVMAI
 * - 1 week:  1 SVMAI = 0.0048 veSVMAI
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface VeLock {
  id: string;
  owner: string;
  amount: number;           // SVMAI locked
  lockEnd: number;          // Lock expiry timestamp
  veBalance: number;        // Initial veSVMAI at lock time
  createdAt: number;
}

export interface VeBalance {
  owner: string;
  lockedAmount: number;     // Total SVMAI locked
  veBalance: number;        // Current veSVMAI (after decay)
  votingPower: number;      // Relative voting power (0-1)
  locks: VeLock[];
  lastUpdate: number;
}

export interface VeConfig {
  /** Maximum lock duration in seconds (4 years) */
  maxLockTime: number;
  /** Minimum lock duration in seconds (1 week) */
  minLockTime: number;
  /** Maximum boost from veSVMAI (2.5x) */
  maxBoost: number;
  /** Protocol fee share for veSVMAI holders */
  feeShareRate: number;
  /** Early unlock penalty (50%) */
  earlyUnlockPenalty: number;
}

export interface VeStats {
  totalLocked: number;
  totalVeSupply: number;
  holders: number;
  avgLockTime: number;
  decayRate: number;        // veSVMAI decay per second
}

// ============================================================================
// Default Configuration
// ============================================================================

const WEEK = 7 * 24 * 60 * 60 * 1000;
const YEAR = 365 * 24 * 60 * 60 * 1000;
const MAX_LOCK = 4 * YEAR;

const DEFAULT_CONFIG: VeConfig = {
  maxLockTime: MAX_LOCK,
  minLockTime: WEEK,
  maxBoost: 2.5,
  feeShareRate: 0.5,        // 50% of protocol fees to veSVMAI holders
  earlyUnlockPenalty: 0.5,  // 50% penalty
};

// ============================================================================
// veToken Engine
// ============================================================================

export class VeTokenEngine extends EventEmitter {
  private config: VeConfig;
  private locks = new Map<string, VeLock>();
  private lockCounter = 0;
  private ownerLocks = new Map<string, Set<string>>(); // owner -> lock IDs
  private totalLocked = 0;
  private accumulatedFees = 0;
  private lastFeeDistribution = Date.now();

  constructor(config: Partial<VeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Lock Management
  // --------------------------------------------------------------------------

  /**
   * Lock SVMAI tokens to receive veSVMAI
   */
  createLock(owner: string, amount: number, lockDuration: number): VeLock {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (lockDuration < this.config.minLockTime) {
      throw new Error(`Minimum lock duration is ${this.config.minLockTime / WEEK} weeks`);
    }

    if (lockDuration > this.config.maxLockTime) {
      throw new Error(`Maximum lock duration is ${this.config.maxLockTime / YEAR} years`);
    }

    // Calculate veSVMAI: amount * (lockDuration / maxLockTime)
    const veBalance = this.calculateVeBalance(amount, lockDuration);
    const lockEnd = Date.now() + lockDuration;

    this.lockCounter++;
    const lock: VeLock = {
      id: `VELOCK-${this.lockCounter}`,
      owner,
      amount,
      lockEnd,
      veBalance,
      createdAt: Date.now(),
    };

    this.locks.set(lock.id, lock);

    // Track owner's locks
    if (!this.ownerLocks.has(owner)) {
      this.ownerLocks.set(owner, new Set());
    }
    this.ownerLocks.get(owner)!.add(lock.id);

    this.totalLocked += amount;

    this.emit('lock_created', lock);

    return lock;
  }

  /**
   * Increase lock amount (extends veSVMAI)
   */
  increaseAmount(lockId: string, additionalAmount: number): VeLock {
    const lock = this.locks.get(lockId);
    if (!lock) throw new Error('Lock not found');

    if (Date.now() >= lock.lockEnd) {
      throw new Error('Lock has expired');
    }

    const remainingTime = lock.lockEnd - Date.now();
    const additionalVe = this.calculateVeBalance(additionalAmount, remainingTime);

    lock.amount += additionalAmount;
    lock.veBalance += additionalVe;
    this.totalLocked += additionalAmount;

    this.emit('lock_increased', { lockId, additionalAmount, newTotal: lock.amount });

    return lock;
  }

  /**
   * Extend lock duration (increases veSVMAI)
   */
  extendLock(lockId: string, newLockEnd: number): VeLock {
    const lock = this.locks.get(lockId);
    if (!lock) throw new Error('Lock not found');

    if (newLockEnd <= lock.lockEnd) {
      throw new Error('New lock end must be after current lock end');
    }

    const newDuration = newLockEnd - Date.now();
    if (newDuration > this.config.maxLockTime) {
      throw new Error(`Maximum lock duration is ${this.config.maxLockTime / YEAR} years`);
    }

    // Recalculate veSVMAI with new duration
    lock.veBalance = this.calculateVeBalance(lock.amount, newDuration);
    lock.lockEnd = newLockEnd;

    this.emit('lock_extended', { lockId, newLockEnd });

    return lock;
  }

  /**
   * Withdraw after lock expires
   */
  withdraw(lockId: string): { amount: number; penalty: number } {
    const lock = this.locks.get(lockId);
    if (!lock) throw new Error('Lock not found');

    const isExpired = Date.now() >= lock.lockEnd;
    let penalty = 0;
    let amount = lock.amount;

    if (!isExpired) {
      // Early unlock with penalty
      penalty = lock.amount * this.config.earlyUnlockPenalty;
      amount = lock.amount - penalty;
    }

    // Remove lock
    this.locks.delete(lockId);
    this.ownerLocks.get(lock.owner)?.delete(lockId);
    this.totalLocked -= lock.amount;

    this.emit('withdrawn', {
      lockId,
      owner: lock.owner,
      amount,
      penalty,
      isEarly: !isExpired,
    });

    return { amount, penalty };
  }

  /**
   * Get current veSVMAI balance (with decay)
   */
  getCurrentVeBalance(owner: string): number {
    const lockIds = this.ownerLocks.get(owner);
    if (!lockIds) return 0;

    let totalVe = 0;
    const now = Date.now();

    for (const lockId of lockIds) {
      const lock = this.locks.get(lockId);
      if (!lock) continue;

      if (now >= lock.lockEnd) {
        // Lock expired, no veSVMAI
        continue;
      }

      // Linear decay: veBalance * (timeRemaining / originalDuration)
      const originalDuration = lock.lockEnd - lock.createdAt;
      const timeRemaining = lock.lockEnd - now;
      const decayedVe = lock.veBalance * (timeRemaining / originalDuration);

      totalVe += decayedVe;
    }

    return totalVe;
  }

  /**
   * Get full balance info for owner
   */
  getBalance(owner: string): VeBalance {
    const lockIds = this.ownerLocks.get(owner);
    const locks: VeLock[] = [];
    let lockedAmount = 0;

    if (lockIds) {
      for (const lockId of lockIds) {
        const lock = this.locks.get(lockId);
        if (lock) {
          locks.push(lock);
          lockedAmount += lock.amount;
        }
      }
    }

    const veBalance = this.getCurrentVeBalance(owner);
    const totalVeSupply = this.getTotalVeSupply();
    const votingPower = totalVeSupply > 0 ? veBalance / totalVeSupply : 0;

    return {
      owner,
      lockedAmount,
      veBalance,
      votingPower,
      locks,
      lastUpdate: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Voting Power
  // --------------------------------------------------------------------------

  /**
   * Get voting power for an owner (0-1 relative to total)
   */
  getVotingPower(owner: string): number {
    const veBalance = this.getCurrentVeBalance(owner);
    const totalVeSupply = this.getTotalVeSupply();

    if (totalVeSupply === 0) return 0;
    return veBalance / totalVeSupply;
  }

  /**
   * Get total veSVMAI supply (with all decays applied)
   */
  getTotalVeSupply(): number {
    let total = 0;
    const now = Date.now();

    for (const lock of this.locks.values()) {
      if (now >= lock.lockEnd) continue;

      const originalDuration = lock.lockEnd - lock.createdAt;
      const timeRemaining = lock.lockEnd - now;
      const decayedVe = lock.veBalance * (timeRemaining / originalDuration);

      total += decayedVe;
    }

    return total;
  }

  // --------------------------------------------------------------------------
  // LP Boost
  // --------------------------------------------------------------------------

  /**
   * Calculate LP reward boost based on veSVMAI balance
   * Boost = min(maxBoost, 1 + (veBalance / totalVeSupply) * (maxBoost - 1))
   */
  calculateBoost(owner: string, poolShare: number = 0): number {
    const veBalance = this.getCurrentVeBalance(owner);
    const totalVeSupply = this.getTotalVeSupply();

    if (totalVeSupply === 0 || veBalance === 0) {
      return 1.0; // No boost
    }

    // Curve-style boost calculation
    const veShare = veBalance / totalVeSupply;
    const boost = 1 + veShare * (this.config.maxBoost - 1);

    return Math.min(boost, this.config.maxBoost);
  }

  /**
   * Get effective boost for LP position
   */
  getEffectiveLPBoost(
    owner: string,
    userLiquidity: number,
    totalLiquidity: number
  ): {
    baseBoost: number;
    veBoost: number;
    effectiveBoost: number;
    boostedRewardShare: number;
  } {
    const userShare = totalLiquidity > 0 ? userLiquidity / totalLiquidity : 0;
    const veBoost = this.calculateBoost(owner, userShare);

    // Effective boost caps at 2.5x the base rewards
    const effectiveBoost = Math.min(veBoost, this.config.maxBoost);

    return {
      baseBoost: 1.0,
      veBoost,
      effectiveBoost,
      boostedRewardShare: userShare * effectiveBoost,
    };
  }

  // --------------------------------------------------------------------------
  // Fee Distribution
  // --------------------------------------------------------------------------

  /**
   * Add protocol fees for distribution
   */
  addFees(amount: number): void {
    this.accumulatedFees += amount;
    this.emit('fees_added', { amount, total: this.accumulatedFees });
  }

  /**
   * Calculate claimable fees for an owner
   */
  getClaimableFees(owner: string): number {
    const veBalance = this.getCurrentVeBalance(owner);
    const totalVeSupply = this.getTotalVeSupply();

    if (totalVeSupply === 0) return 0;

    const share = veBalance / totalVeSupply;
    return this.accumulatedFees * this.config.feeShareRate * share;
  }

  /**
   * Claim accumulated fees
   */
  claimFees(owner: string): number {
    const claimable = this.getClaimableFees(owner);

    if (claimable <= 0) {
      throw new Error('No fees to claim');
    }

    // Deduct from accumulated (simplified - in production track per-user claims)
    const veBalance = this.getCurrentVeBalance(owner);
    const totalVeSupply = this.getTotalVeSupply();
    const share = veBalance / totalVeSupply;

    this.accumulatedFees -= claimable / this.config.feeShareRate;

    this.emit('fees_claimed', { owner, amount: claimable });

    return claimable;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get global veToken statistics
   */
  getStats(): VeStats {
    const locks = Array.from(this.locks.values());
    const totalVeSupply = this.getTotalVeSupply();

    let totalLockTime = 0;
    const now = Date.now();

    for (const lock of locks) {
      if (now < lock.lockEnd) {
        totalLockTime += lock.lockEnd - now;
      }
    }

    const activeLocks = locks.filter(l => now < l.lockEnd);
    const avgLockTime = activeLocks.length > 0 ? totalLockTime / activeLocks.length : 0;

    // Decay rate: total veSVMAI that decays per second
    const decayRate = totalVeSupply / (avgLockTime / 1000 || 1);

    return {
      totalLocked: this.totalLocked,
      totalVeSupply,
      holders: this.ownerLocks.size,
      avgLockTime,
      decayRate,
    };
  }

  /**
   * Get leaderboard of veSVMAI holders
   */
  getLeaderboard(limit: number = 10): Array<{
    rank: number;
    owner: string;
    veBalance: number;
    lockedAmount: number;
    votingPower: number;
  }> {
    const balances: Array<{
      owner: string;
      veBalance: number;
      lockedAmount: number;
    }> = [];

    for (const owner of this.ownerLocks.keys()) {
      const balance = this.getBalance(owner);
      balances.push({
        owner,
        veBalance: balance.veBalance,
        lockedAmount: balance.lockedAmount,
      });
    }

    const totalVe = this.getTotalVeSupply();

    return balances
      .sort((a, b) => b.veBalance - a.veBalance)
      .slice(0, limit)
      .map((b, index) => ({
        rank: index + 1,
        owner: b.owner,
        veBalance: b.veBalance,
        lockedAmount: b.lockedAmount,
        votingPower: totalVe > 0 ? b.veBalance / totalVe : 0,
      }));
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private calculateVeBalance(amount: number, lockDuration: number): number {
    return amount * (lockDuration / this.config.maxLockTime);
  }

  /**
   * Get lock by ID
   */
  getLock(lockId: string): VeLock | null {
    return this.locks.get(lockId) || null;
  }
}

// ============================================================================
// Exports
// ============================================================================

let engineInstance: VeTokenEngine | null = null;

export function getVeTokenEngine(config?: Partial<VeConfig>): VeTokenEngine {
  if (!engineInstance) {
    engineInstance = new VeTokenEngine(config);
  }
  return engineInstance;
}

export const WEEK_MS = WEEK;
export const YEAR_MS = YEAR;
export const MAX_LOCK_MS = MAX_LOCK;

export default {
  VeTokenEngine,
  getVeTokenEngine,
  WEEK_MS,
  YEAR_MS,
  MAX_LOCK_MS,
  DEFAULT_CONFIG,
};
