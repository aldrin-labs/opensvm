/**
 * PoUW Delegation & Liquid Staking System
 *
 * Extends the base staking system with:
 * - Delegation: Stake to validators and earn rewards
 * - Liquid Staking: Receive stOMCP tokens for delegated stake
 * - Commission: Validators earn commission on delegator rewards
 * - Undelegation: Cooldown period before funds are released
 *
 * @module pouw-delegation
 */

import { createHash } from 'crypto';
import {
  getStakeInfo,
  getCurrentEpoch,
  getAllStakers,
  isCurrentValidator,
} from './pouw-staking';

// ============================================================================
// Configuration
// ============================================================================

// Minimum delegation amount
const MIN_DELEGATION_AMOUNT = BigInt(100_000_000_000); // 100 $OMCP

// Undelegation cooldown period
const UNDELEGATION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Default validator commission rate (basis points)
const DEFAULT_COMMISSION_RATE = 1000; // 10%

// Maximum commission rate
const MAX_COMMISSION_RATE = 5000; // 50%

// Minimum commission rate
const MIN_COMMISSION_RATE = 0; // 0%

// stOMCP exchange rate precision
const EXCHANGE_RATE_PRECISION = BigInt(1e18);

// Initial exchange rate (1:1)
const INITIAL_EXCHANGE_RATE = EXCHANGE_RATE_PRECISION;

// Reward distribution interval
const REWARD_DISTRIBUTION_INTERVAL_MS = 60000; // 1 minute

// ============================================================================
// Types
// ============================================================================

export interface Delegation {
  delegatorId: string;
  validatorId: string;
  amount: bigint;
  stOMCPBalance: bigint;
  delegatedAt: number;
  lastRewardClaim: number;
  pendingRewards: bigint;
}

export interface UndelegationRequest {
  id: string;
  delegatorId: string;
  validatorId: string;
  amount: bigint;
  stOMCPAmount: bigint;
  requestedAt: number;
  availableAt: number;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface ValidatorProfile {
  validatorId: string;
  commissionRate: number; // basis points
  totalDelegated: bigint;
  delegatorCount: number;
  rewardsDistributed: bigint;
  createdAt: number;
  description?: string;
  website?: string;
}

export interface LiquidStakingPool {
  totalDelegated: bigint;
  totalStOMCPSupply: bigint;
  exchangeRate: bigint;
  rewardsAccumulated: bigint;
  lastExchangeRateUpdate: number;
}

export interface DelegationStats {
  totalDelegated: bigint;
  totalStOMCPSupply: bigint;
  exchangeRate: string;
  delegatorCount: number;
  validatorCount: number;
  averageDelegation: bigint;
  pendingUndelegations: number;
  totalPendingUndelegation: bigint;
}

// ============================================================================
// State
// ============================================================================

// All delegations (key: delegatorId-validatorId)
const delegations = new Map<string, Delegation>();

// Delegator index (key: delegatorId, value: Set of validatorIds)
const delegatorIndex = new Map<string, Set<string>>();

// Validator index (key: validatorId, value: Set of delegatorIds)
const validatorIndex = new Map<string, Set<string>>();

// Undelegation requests
const undelegationRequests = new Map<string, UndelegationRequest>();

// Validator profiles
const validatorProfiles = new Map<string, ValidatorProfile>();

// Liquid staking pool
const liquidStakingPool: LiquidStakingPool = {
  totalDelegated: BigInt(0),
  totalStOMCPSupply: BigInt(0),
  exchangeRate: INITIAL_EXCHANGE_RATE,
  rewardsAccumulated: BigInt(0),
  lastExchangeRateUpdate: Date.now(),
};

// stOMCP balances (for transferred tokens)
const stOMCPBalances = new Map<string, bigint>();

// ============================================================================
// Helper Functions
// ============================================================================

function getDelegationKey(delegatorId: string, validatorId: string): string {
  return `${delegatorId}-${validatorId}`;
}

function generateUndelegationId(delegatorId: string, validatorId: string): string {
  return createHash('md5')
    .update(`${delegatorId}-${validatorId}-${Date.now()}-${Math.random()}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Convert OMCP amount to stOMCP based on current exchange rate
 */
function omcpToStOMCP(omcpAmount: bigint): bigint {
  return (omcpAmount * EXCHANGE_RATE_PRECISION) / liquidStakingPool.exchangeRate;
}

/**
 * Convert stOMCP amount to OMCP based on current exchange rate
 */
function stOMCPToOMCP(stOMCPAmount: bigint): bigint {
  return (stOMCPAmount * liquidStakingPool.exchangeRate) / EXCHANGE_RATE_PRECISION;
}

// ============================================================================
// Validator Profile Management
// ============================================================================

/**
 * Register or update validator profile
 */
export function setValidatorProfile(
  validatorId: string,
  options: {
    commissionRate?: number;
    description?: string;
    website?: string;
  }
): { success: boolean; error?: string } {
  // Verify validator has enough stake
  const stakeInfo = getStakeInfo(validatorId);
  if (!stakeInfo || !stakeInfo.isValidator) {
    return {
      success: false,
      error: 'Address is not a validator (insufficient stake)',
    };
  }

  const existing = validatorProfiles.get(validatorId);
  const commissionRate = options.commissionRate ?? existing?.commissionRate ?? DEFAULT_COMMISSION_RATE;

  // Validate commission rate
  if (commissionRate < MIN_COMMISSION_RATE || commissionRate > MAX_COMMISSION_RATE) {
    return {
      success: false,
      error: `Commission rate must be between ${MIN_COMMISSION_RATE / 100}% and ${MAX_COMMISSION_RATE / 100}%`,
    };
  }

  if (existing) {
    // Update existing profile
    existing.commissionRate = commissionRate;
    if (options.description !== undefined) existing.description = options.description;
    if (options.website !== undefined) existing.website = options.website;
  } else {
    // Create new profile
    validatorProfiles.set(validatorId, {
      validatorId,
      commissionRate,
      totalDelegated: BigInt(0),
      delegatorCount: 0,
      rewardsDistributed: BigInt(0),
      createdAt: Date.now(),
      description: options.description,
      website: options.website,
    });
  }

  console.log(`[PoUW Delegation] Validator ${validatorId} profile set with ${commissionRate / 100}% commission`);

  return { success: true };
}

/**
 * Get validator profile
 */
export function getValidatorProfile(validatorId: string): ValidatorProfile | null {
  return validatorProfiles.get(validatorId) || null;
}

/**
 * Get all validator profiles
 */
export function getAllValidatorProfiles(): ValidatorProfile[] {
  return Array.from(validatorProfiles.values());
}

// ============================================================================
// Delegation Operations
// ============================================================================

/**
 * Delegate stake to a validator
 * Returns stOMCP tokens representing the delegation
 */
export function delegate(
  delegatorId: string,
  validatorId: string,
  amount: bigint
): { success: boolean; stOMCPReceived?: bigint; error?: string } {
  // Validate amount
  if (amount < MIN_DELEGATION_AMOUNT) {
    return {
      success: false,
      error: `Minimum delegation is ${MIN_DELEGATION_AMOUNT} lamports`,
    };
  }

  // Verify validator exists and has a profile
  let profile = validatorProfiles.get(validatorId);
  if (!profile) {
    // Auto-create profile with default commission
    const createResult = setValidatorProfile(validatorId, {});
    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error || 'Validator not eligible',
      };
    }
    profile = validatorProfiles.get(validatorId)!;
  }

  // Calculate stOMCP to mint
  const stOMCPAmount = omcpToStOMCP(amount);

  // Get or create delegation
  const key = getDelegationKey(delegatorId, validatorId);
  const existing = delegations.get(key);

  if (existing) {
    // Add to existing delegation
    existing.amount += amount;
    existing.stOMCPBalance += stOMCPAmount;
    existing.pendingRewards = BigInt(0); // Claim pending rewards on new delegation
  } else {
    // Create new delegation
    delegations.set(key, {
      delegatorId,
      validatorId,
      amount,
      stOMCPBalance: stOMCPAmount,
      delegatedAt: Date.now(),
      lastRewardClaim: Date.now(),
      pendingRewards: BigInt(0),
    });

    // Update indexes
    const delegatorValidators = delegatorIndex.get(delegatorId) || new Set();
    delegatorValidators.add(validatorId);
    delegatorIndex.set(delegatorId, delegatorValidators);

    const validatorDelegators = validatorIndex.get(validatorId) || new Set();
    validatorDelegators.add(delegatorId);
    validatorIndex.set(validatorId, validatorDelegators);

    profile.delegatorCount++;
  }

  // Update pool and profile
  liquidStakingPool.totalDelegated += amount;
  liquidStakingPool.totalStOMCPSupply += stOMCPAmount;
  profile.totalDelegated += amount;

  console.log(`[PoUW Delegation] ${delegatorId} delegated ${amount} to ${validatorId}, received ${stOMCPAmount} stOMCP`);

  return {
    success: true,
    stOMCPReceived: stOMCPAmount,
  };
}

/**
 * Request undelegation (subject to cooldown)
 */
export function requestUndelegate(
  delegatorId: string,
  validatorId: string,
  stOMCPAmount: bigint
): { success: boolean; requestId?: string; availableAt?: number; error?: string } {
  const key = getDelegationKey(delegatorId, validatorId);
  const delegation = delegations.get(key);

  if (!delegation) {
    return {
      success: false,
      error: 'No delegation found',
    };
  }

  if (stOMCPAmount > delegation.stOMCPBalance) {
    return {
      success: false,
      error: 'Insufficient stOMCP balance',
    };
  }

  // Calculate OMCP value at current exchange rate
  const omcpValue = stOMCPToOMCP(stOMCPAmount);

  const now = Date.now();
  const availableAt = now + UNDELEGATION_COOLDOWN_MS;
  const requestId = generateUndelegationId(delegatorId, validatorId);

  // Create undelegation request
  undelegationRequests.set(requestId, {
    id: requestId,
    delegatorId,
    validatorId,
    amount: omcpValue,
    stOMCPAmount,
    requestedAt: now,
    availableAt,
    status: 'pending',
  });

  // Lock the stOMCP (reduce balance immediately)
  delegation.stOMCPBalance -= stOMCPAmount;
  delegation.amount -= omcpValue > delegation.amount ? delegation.amount : omcpValue;

  // Update pool
  liquidStakingPool.totalStOMCPSupply -= stOMCPAmount;

  console.log(`[PoUW Delegation] ${delegatorId} requested undelegation of ${stOMCPAmount} stOMCP (${omcpValue} OMCP) from ${validatorId}`);

  return {
    success: true,
    requestId,
    availableAt,
  };
}

/**
 * Complete undelegation after cooldown
 */
export function completeUndelegate(
  requestId: string
): { success: boolean; amountReturned?: bigint; error?: string } {
  const request = undelegationRequests.get(requestId);

  if (!request) {
    return {
      success: false,
      error: 'Undelegation request not found',
    };
  }

  if (request.status !== 'pending') {
    return {
      success: false,
      error: `Request already ${request.status}`,
    };
  }

  if (Date.now() < request.availableAt) {
    return {
      success: false,
      error: `Cooldown not complete. Available at ${new Date(request.availableAt).toISOString()}`,
    };
  }

  // Update validator profile
  const profile = validatorProfiles.get(request.validatorId);
  if (profile) {
    profile.totalDelegated -= request.amount;
  }

  // Update pool
  liquidStakingPool.totalDelegated -= request.amount;

  // Clean up delegation if fully undelegated
  const key = getDelegationKey(request.delegatorId, request.validatorId);
  const delegation = delegations.get(key);
  if (delegation && delegation.stOMCPBalance === BigInt(0) && delegation.amount === BigInt(0)) {
    delegations.delete(key);

    // Update indexes
    const delegatorValidators = delegatorIndex.get(request.delegatorId);
    if (delegatorValidators) {
      delegatorValidators.delete(request.validatorId);
      if (delegatorValidators.size === 0) {
        delegatorIndex.delete(request.delegatorId);
      }
    }

    const validatorDelegators = validatorIndex.get(request.validatorId);
    if (validatorDelegators) {
      validatorDelegators.delete(request.delegatorId);
      if (validatorDelegators.size === 0) {
        validatorIndex.delete(request.validatorId);
      }
    }

    if (profile) {
      profile.delegatorCount--;
    }
  }

  // Mark request as completed
  request.status = 'completed';

  console.log(`[PoUW Delegation] Undelegation completed: ${request.amount} OMCP returned to ${request.delegatorId}`);

  return {
    success: true,
    amountReturned: request.amount,
  };
}

/**
 * Cancel a pending undelegation request
 */
export function cancelUndelegate(
  requestId: string,
  delegatorId: string
): { success: boolean; error?: string } {
  const request = undelegationRequests.get(requestId);

  if (!request) {
    return {
      success: false,
      error: 'Undelegation request not found',
    };
  }

  if (request.delegatorId !== delegatorId) {
    return {
      success: false,
      error: 'Not authorized to cancel this request',
    };
  }

  if (request.status !== 'pending') {
    return {
      success: false,
      error: `Request already ${request.status}`,
    };
  }

  // Restore the stOMCP
  const key = getDelegationKey(request.delegatorId, request.validatorId);
  const delegation = delegations.get(key);
  if (delegation) {
    delegation.stOMCPBalance += request.stOMCPAmount;
    delegation.amount += request.amount;
  }

  // Update pool
  liquidStakingPool.totalStOMCPSupply += request.stOMCPAmount;

  // Mark request as cancelled
  request.status = 'cancelled';

  console.log(`[PoUW Delegation] Undelegation cancelled: ${request.stOMCPAmount} stOMCP restored to ${delegatorId}`);

  return { success: true };
}

// ============================================================================
// Liquid Staking Token Operations
// ============================================================================

/**
 * Transfer stOMCP tokens to another address
 */
export function transferStOMCP(
  from: string,
  to: string,
  amount: bigint
): { success: boolean; error?: string } {
  // Get total stOMCP balance for sender (from all delegations + free balance)
  let senderBalance = stOMCPBalances.get(from) || BigInt(0);

  // Check if sender has enough in free balance
  if (senderBalance < amount) {
    return {
      success: false,
      error: 'Insufficient stOMCP balance for transfer',
    };
  }

  // Perform transfer
  senderBalance -= amount;
  if (senderBalance === BigInt(0)) {
    stOMCPBalances.delete(from);
  } else {
    stOMCPBalances.set(from, senderBalance);
  }

  const recipientBalance = stOMCPBalances.get(to) || BigInt(0);
  stOMCPBalances.set(to, recipientBalance + amount);

  console.log(`[PoUW Delegation] Transferred ${amount} stOMCP from ${from} to ${to}`);

  return { success: true };
}

/**
 * Withdraw stOMCP from delegation to make it transferable
 */
export function withdrawStOMCPFromDelegation(
  delegatorId: string,
  validatorId: string,
  amount: bigint
): { success: boolean; error?: string } {
  const key = getDelegationKey(delegatorId, validatorId);
  const delegation = delegations.get(key);

  if (!delegation) {
    return {
      success: false,
      error: 'No delegation found',
    };
  }

  if (amount > delegation.stOMCPBalance) {
    return {
      success: false,
      error: 'Insufficient stOMCP in delegation',
    };
  }

  // Move from delegation to free balance
  delegation.stOMCPBalance -= amount;
  const freeBalance = stOMCPBalances.get(delegatorId) || BigInt(0);
  stOMCPBalances.set(delegatorId, freeBalance + amount);

  // Note: The OMCP remains delegated even after stOMCP is withdrawn
  // The stOMCP holder can redeem later through normal undelegation

  console.log(`[PoUW Delegation] Withdrew ${amount} stOMCP from delegation to free balance`);

  return { success: true };
}

/**
 * Get stOMCP balance for an address
 */
export function getStOMCPBalance(address: string): {
  freeBalance: bigint;
  delegatedBalance: bigint;
  totalBalance: bigint;
  omcpValue: bigint;
} {
  const freeBalance = stOMCPBalances.get(address) || BigInt(0);

  // Sum delegated stOMCP across all validators
  let delegatedBalance = BigInt(0);
  const validators = delegatorIndex.get(address);
  if (validators) {
    for (const validatorId of validators) {
      const delegation = delegations.get(getDelegationKey(address, validatorId));
      if (delegation) {
        delegatedBalance += delegation.stOMCPBalance;
      }
    }
  }

  const totalBalance = freeBalance + delegatedBalance;
  const omcpValue = stOMCPToOMCP(totalBalance);

  return {
    freeBalance,
    delegatedBalance,
    totalBalance,
    omcpValue,
  };
}

// ============================================================================
// Reward Distribution
// ============================================================================

/**
 * Distribute rewards to delegators
 * Called by validators or automatically at epoch end
 */
export function distributeRewards(
  validatorId: string,
  totalRewards: bigint
): { success: boolean; distributed: bigint; delegatorCount: number; error?: string } {
  const profile = validatorProfiles.get(validatorId);
  if (!profile) {
    return {
      success: false,
      distributed: BigInt(0),
      delegatorCount: 0,
      error: 'Validator profile not found',
    };
  }

  if (profile.totalDelegated === BigInt(0)) {
    return {
      success: true,
      distributed: BigInt(0),
      delegatorCount: 0,
    };
  }

  // Calculate validator commission
  const commission = (totalRewards * BigInt(profile.commissionRate)) / BigInt(10000);
  const delegatorRewards = totalRewards - commission;

  // Distribute to delegators proportionally
  const delegators = validatorIndex.get(validatorId);
  if (!delegators || delegators.size === 0) {
    return {
      success: true,
      distributed: BigInt(0),
      delegatorCount: 0,
    };
  }

  let distributed = BigInt(0);
  let count = 0;

  for (const delegatorId of delegators) {
    const key = getDelegationKey(delegatorId, validatorId);
    const delegation = delegations.get(key);
    if (!delegation || delegation.amount === BigInt(0)) continue;

    // Calculate proportional reward
    const share = (delegation.amount * delegatorRewards) / profile.totalDelegated;
    delegation.pendingRewards += share;
    distributed += share;
    count++;
  }

  // Update exchange rate (rewards increase the value of stOMCP)
  if (liquidStakingPool.totalStOMCPSupply > BigInt(0)) {
    liquidStakingPool.rewardsAccumulated += delegatorRewards;
    liquidStakingPool.exchangeRate =
      ((liquidStakingPool.totalDelegated + liquidStakingPool.rewardsAccumulated) * EXCHANGE_RATE_PRECISION) /
      liquidStakingPool.totalStOMCPSupply;
    liquidStakingPool.lastExchangeRateUpdate = Date.now();
  }

  profile.rewardsDistributed += distributed;

  console.log(`[PoUW Delegation] Distributed ${distributed} OMCP rewards to ${count} delegators of ${validatorId}`);

  return {
    success: true,
    distributed,
    delegatorCount: count,
  };
}

/**
 * Claim pending rewards for a delegator
 */
export function claimRewards(
  delegatorId: string,
  validatorId?: string
): { success: boolean; claimed: bigint; error?: string } {
  let totalClaimed = BigInt(0);

  const validators = validatorId
    ? new Set([validatorId])
    : delegatorIndex.get(delegatorId);

  if (!validators || validators.size === 0) {
    return {
      success: false,
      claimed: BigInt(0),
      error: 'No delegations found',
    };
  }

  for (const vid of validators) {
    const key = getDelegationKey(delegatorId, vid);
    const delegation = delegations.get(key);
    if (!delegation) continue;

    if (delegation.pendingRewards > BigInt(0)) {
      totalClaimed += delegation.pendingRewards;
      delegation.pendingRewards = BigInt(0);
      delegation.lastRewardClaim = Date.now();
    }
  }

  console.log(`[PoUW Delegation] ${delegatorId} claimed ${totalClaimed} OMCP in rewards`);

  return {
    success: true,
    claimed: totalClaimed,
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get delegation info
 */
export function getDelegation(delegatorId: string, validatorId: string): Delegation | null {
  return delegations.get(getDelegationKey(delegatorId, validatorId)) || null;
}

/**
 * Get all delegations for a delegator
 */
export function getDelegatorDelegations(delegatorId: string): Delegation[] {
  const validators = delegatorIndex.get(delegatorId);
  if (!validators) return [];

  return Array.from(validators)
    .map(v => delegations.get(getDelegationKey(delegatorId, v)))
    .filter((d): d is Delegation => d !== undefined);
}

/**
 * Get all delegators for a validator
 */
export function getValidatorDelegators(validatorId: string): Delegation[] {
  const delegators = validatorIndex.get(validatorId);
  if (!delegators) return [];

  return Array.from(delegators)
    .map(d => delegations.get(getDelegationKey(d, validatorId)))
    .filter((del): del is Delegation => del !== undefined);
}

/**
 * Get undelegation requests for a delegator
 */
export function getUndelegationRequests(delegatorId: string): UndelegationRequest[] {
  return Array.from(undelegationRequests.values()).filter(
    r => r.delegatorId === delegatorId
  );
}

/**
 * Get undelegation request by ID
 */
export function getUndelegationRequest(requestId: string): UndelegationRequest | null {
  return undelegationRequests.get(requestId) || null;
}

/**
 * Get current exchange rate
 */
export function getExchangeRate(): {
  rate: string;
  omcpPerStOMCP: string;
  lastUpdate: number;
} {
  const rate = liquidStakingPool.exchangeRate;
  return {
    rate: rate.toString(),
    omcpPerStOMCP: (Number(rate) / Number(EXCHANGE_RATE_PRECISION)).toFixed(18),
    lastUpdate: liquidStakingPool.lastExchangeRateUpdate,
  };
}

/**
 * Get delegation statistics
 */
export function getDelegationStats(): DelegationStats {
  let pendingUndelegations = 0;
  let totalPendingUndelegation = BigInt(0);

  for (const request of undelegationRequests.values()) {
    if (request.status === 'pending') {
      pendingUndelegations++;
      totalPendingUndelegation += request.amount;
    }
  }

  return {
    totalDelegated: liquidStakingPool.totalDelegated,
    totalStOMCPSupply: liquidStakingPool.totalStOMCPSupply,
    exchangeRate: (Number(liquidStakingPool.exchangeRate) / Number(EXCHANGE_RATE_PRECISION)).toFixed(18),
    delegatorCount: delegatorIndex.size,
    validatorCount: validatorIndex.size,
    averageDelegation:
      delegatorIndex.size > 0
        ? liquidStakingPool.totalDelegated / BigInt(delegatorIndex.size)
        : BigInt(0),
    pendingUndelegations,
    totalPendingUndelegation,
  };
}

/**
 * Get top validators by delegated amount
 */
export function getTopValidatorsByDelegation(limit: number = 20): ValidatorProfile[] {
  return Array.from(validatorProfiles.values())
    .sort((a, b) => Number(b.totalDelegated - a.totalDelegated))
    .slice(0, limit);
}

// ============================================================================
// Auto-Processing
// ============================================================================

// Process completed undelegations periodically
setInterval(() => {
  const now = Date.now();
  for (const [requestId, request] of undelegationRequests.entries()) {
    if (request.status === 'pending' && now >= request.availableAt) {
      // Auto-complete undelegation
      completeUndelegate(requestId);
    }
  }
}, 60000); // Check every minute

// ============================================================================
// Exports
// ============================================================================

export default {
  // Validator profile
  setValidatorProfile,
  getValidatorProfile,
  getAllValidatorProfiles,

  // Delegation
  delegate,
  requestUndelegate,
  completeUndelegate,
  cancelUndelegate,

  // Liquid staking
  transferStOMCP,
  withdrawStOMCPFromDelegation,
  getStOMCPBalance,

  // Rewards
  distributeRewards,
  claimRewards,

  // Queries
  getDelegation,
  getDelegatorDelegations,
  getValidatorDelegators,
  getUndelegationRequests,
  getUndelegationRequest,
  getExchangeRate,
  getDelegationStats,
  getTopValidatorsByDelegation,
};
