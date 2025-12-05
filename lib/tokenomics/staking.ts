/**
 * SVMAI Tokenomics - Staking System
 *
 * Manages token staking with time-locked multipliers and rewards.
 */

import {
  StakePosition,
  StakeDuration,
  StakeConfig,
  STAKE_CONFIGS,
  TokenAmount,
  toTokenAmount,
  fromTokenAmount,
} from './types';

// ============================================================================
// In-Memory Store (Replace with database in production)
// ============================================================================

const stakePositions: Map<string, StakePosition> = new Map();
const walletStakes: Map<string, Set<string>> = new Map(); // wallet -> stake IDs

// Staking pool state
let totalStaked: TokenAmount = BigInt(0);
let totalEffectiveStaked: TokenAmount = BigInt(0);
let rewardPool: TokenAmount = BigInt(0);
let lastRewardDistribution: number = Date.now();

// ============================================================================
// Staking Configuration
// ============================================================================

export function getStakeConfig(duration: StakeDuration): StakeConfig {
  const config = STAKE_CONFIGS.find(c => c.duration === duration);
  if (!config) {
    throw new Error(`Unknown stake duration: ${duration}`);
  }
  return config;
}

export function getAllStakeConfigs(): StakeConfig[] {
  return STAKE_CONFIGS;
}

// ============================================================================
// Stake Operations
// ============================================================================

/**
 * Create a new stake position
 */
export function createStake(
  wallet: string,
  amount: TokenAmount,
  duration: StakeDuration
): StakePosition {
  const config = getStakeConfig(duration);
  const now = Date.now();

  const stake: StakePosition = {
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

  // Update stores
  stakePositions.set(stake.id, stake);

  const walletStakeIds = walletStakes.get(wallet) || new Set();
  walletStakeIds.add(stake.id);
  walletStakes.set(wallet, walletStakeIds);

  // Update totals
  totalStaked += amount;
  totalEffectiveStaked += stake.effectiveAmount;

  return stake;
}

/**
 * Get a stake by ID
 */
export function getStake(stakeId: string): StakePosition | undefined {
  return stakePositions.get(stakeId);
}

/**
 * Get all stakes for a wallet
 */
export function getWalletStakes(wallet: string): StakePosition[] {
  const stakeIds = walletStakes.get(wallet);
  if (!stakeIds) return [];

  return Array.from(stakeIds)
    .map(id => stakePositions.get(id))
    .filter((s): s is StakePosition => s !== undefined);
}

/**
 * Get total staked amount for a wallet
 */
export function getWalletTotalStaked(wallet: string): {
  staked: TokenAmount;
  effective: TokenAmount;
  pendingRewards: TokenAmount;
} {
  const stakes = getWalletStakes(wallet);

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
 * Check if a stake can be unlocked
 */
export function canUnstake(stakeId: string): {
  canUnstake: boolean;
  isEarly: boolean;
  penalty: number;
  returnAmount: TokenAmount;
} {
  const stake = stakePositions.get(stakeId);
  if (!stake) {
    throw new Error(`Stake not found: ${stakeId}`);
  }

  if (stake.status !== 'active') {
    return {
      canUnstake: false,
      isEarly: false,
      penalty: 0,
      returnAmount: BigInt(0),
    };
  }

  const now = Date.now();
  const isEarly = now < stake.endTime;

  if (isEarly) {
    const config = getStakeConfig(stake.duration);
    const penalty = config.earlyUnstakePenalty / 100;
    const penaltyAmount = BigInt(Math.floor(Number(stake.amount) * penalty));
    const returnAmount = stake.amount - penaltyAmount;

    return {
      canUnstake: true,
      isEarly: true,
      penalty: config.earlyUnstakePenalty,
      returnAmount,
    };
  }

  return {
    canUnstake: true,
    isEarly: false,
    penalty: 0,
    returnAmount: stake.amount,
  };
}

/**
 * Unstake tokens
 */
export function unstake(stakeId: string): {
  success: boolean;
  returnAmount: TokenAmount;
  penalty: TokenAmount;
  rewards: TokenAmount;
} {
  const stake = stakePositions.get(stakeId);
  if (!stake) {
    throw new Error(`Stake not found: ${stakeId}`);
  }

  if (stake.status !== 'active') {
    throw new Error(`Stake is not active: ${stakeId}`);
  }

  const unstakeInfo = canUnstake(stakeId);
  const penalty = stake.amount - unstakeInfo.returnAmount;
  const unclaimedRewards = stake.rewards - stake.claimed;

  // Update stake status
  stake.status = 'withdrawn';

  // Update totals
  totalStaked -= stake.amount;
  totalEffectiveStaked -= stake.effectiveAmount;

  // Add penalty to reward pool
  if (penalty > BigInt(0)) {
    rewardPool += penalty;
  }

  return {
    success: true,
    returnAmount: unstakeInfo.returnAmount,
    penalty,
    rewards: unclaimedRewards,
  };
}

/**
 * Claim pending rewards
 */
export function claimRewards(stakeId: string): TokenAmount {
  const stake = stakePositions.get(stakeId);
  if (!stake) {
    throw new Error(`Stake not found: ${stakeId}`);
  }

  const pendingRewards = stake.rewards - stake.claimed;
  stake.claimed = stake.rewards;

  return pendingRewards;
}

/**
 * Claim all rewards for a wallet
 */
export function claimAllRewards(wallet: string): TokenAmount {
  const stakes = getWalletStakes(wallet);
  let totalClaimed = BigInt(0);

  for (const stake of stakes) {
    if (stake.status === 'active') {
      const pending = stake.rewards - stake.claimed;
      stake.claimed = stake.rewards;
      totalClaimed += pending;
    }
  }

  return totalClaimed;
}

// ============================================================================
// Reward Distribution
// ============================================================================

/**
 * Add tokens to the reward pool
 */
export function addToRewardPool(amount: TokenAmount): void {
  rewardPool += amount;
}

/**
 * Distribute rewards to all stakers proportionally
 */
export function distributeRewards(): {
  distributed: TokenAmount;
  recipients: number;
} {
  if (totalEffectiveStaked === BigInt(0) || rewardPool === BigInt(0)) {
    return { distributed: BigInt(0), recipients: 0 };
  }

  let distributed = BigInt(0);
  let recipients = 0;

  for (const stake of stakePositions.values()) {
    if (stake.status !== 'active') continue;

    // Calculate proportional reward
    const share = Number(stake.effectiveAmount) / Number(totalEffectiveStaked);
    const reward = BigInt(Math.floor(Number(rewardPool) * share));

    // Apply reward boost based on duration
    const config = getStakeConfig(stake.duration);
    const boostedReward = BigInt(Math.floor(Number(reward) * (1 + config.rewardBoost / 100)));

    stake.rewards += boostedReward;
    distributed += boostedReward;
    recipients++;
  }

  // Reset reward pool (some dust may remain due to rounding)
  rewardPool = BigInt(0);
  lastRewardDistribution = Date.now();

  return { distributed, recipients };
}

/**
 * Calculate APY for a stake duration
 */
export function calculateAPY(duration: StakeDuration): number {
  const config = getStakeConfig(duration);

  // Base APY from multiplier
  const baseAPY = (config.multiplier - 1) * 100;

  // Add reward boost
  const totalAPY = baseAPY + config.rewardBoost;

  return totalAPY;
}

// ============================================================================
// Liquid Staking (stSVMAI)
// ============================================================================

export interface LiquidStakePosition {
  stakeId: string;
  stSvmaiAmount: TokenAmount;
  exchangeRate: number; // stSVMAI per SVMAI
}

const liquidPositions: Map<string, LiquidStakePosition> = new Map();
let totalStSvmai: TokenAmount = BigInt(0);

/**
 * Get current exchange rate for liquid staking
 */
export function getExchangeRate(): number {
  if (totalStSvmai === BigInt(0)) return 1;
  return Number(totalStaked) / Number(totalStSvmai);
}

/**
 * Mint stSVMAI for a stake
 */
export function mintLiquidStake(stakeId: string): LiquidStakePosition {
  const stake = stakePositions.get(stakeId);
  if (!stake) {
    throw new Error(`Stake not found: ${stakeId}`);
  }

  const exchangeRate = getExchangeRate();
  const stSvmaiAmount = BigInt(Math.floor(Number(stake.amount) / exchangeRate));

  const liquidPosition: LiquidStakePosition = {
    stakeId,
    stSvmaiAmount,
    exchangeRate,
  };

  liquidPositions.set(stakeId, liquidPosition);
  totalStSvmai += stSvmaiAmount;

  return liquidPosition;
}

// ============================================================================
// Pool Statistics
// ============================================================================

export function getPoolStats(): {
  totalStaked: TokenAmount;
  totalEffectiveStaked: TokenAmount;
  rewardPool: TokenAmount;
  totalStakers: number;
  averageMultiplier: number;
  lastDistribution: number;
  totalStSvmai: TokenAmount;
  exchangeRate: number;
} {
  const activeStakers = new Set<string>();
  let totalMultiplier = 0;
  let stakeCount = 0;

  for (const stake of stakePositions.values()) {
    if (stake.status === 'active') {
      activeStakers.add(stake.wallet);
      totalMultiplier += stake.multiplier;
      stakeCount++;
    }
  }

  return {
    totalStaked,
    totalEffectiveStaked,
    rewardPool,
    totalStakers: activeStakers.size,
    averageMultiplier: stakeCount > 0 ? totalMultiplier / stakeCount : 1,
    lastDistribution: lastRewardDistribution,
    totalStSvmai,
    exchangeRate: getExchangeRate(),
  };
}

// ============================================================================
// Update Stake Status (call periodically)
// ============================================================================

export function updateStakeStatuses(): number {
  const now = Date.now();
  let updated = 0;

  for (const stake of stakePositions.values()) {
    if (stake.status === 'active' && now >= stake.endTime) {
      stake.status = 'unlocked';
      updated++;
    }
  }

  return updated;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  getStakeConfig,
  getAllStakeConfigs,
  createStake,
  getStake,
  getWalletStakes,
  getWalletTotalStaked,
  canUnstake,
  unstake,
  claimRewards,
  claimAllRewards,
  addToRewardPool,
  distributeRewards,
  calculateAPY,
  getExchangeRate,
  mintLiquidStake,
  getPoolStats,
  updateStakeStatuses,
};
