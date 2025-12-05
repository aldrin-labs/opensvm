/**
 * PoUW Staking System
 *
 * Combines Proof-of-Stake with Proof-of-Useful-Work for maximum security.
 * Features:
 * - Stake $OMCP tokens for mining rights
 * - Dynamic difficulty scaling based on data sensitivity
 * - Slashing for malicious behavior
 * - Validator epochs with rotation
 *
 * @module pouw-staking
 */

import { createHash } from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

// Minimum stake to participate in mining (in lamports)
const MIN_STAKE_AMOUNT = BigInt(1000_000_000_000); // 1000 $OMCP

// Minimum stake to become a validator
const MIN_VALIDATOR_STAKE = BigInt(10000_000_000_000); // 10000 $OMCP

// Epoch duration in milliseconds
const EPOCH_DURATION_MS = 3600000; // 1 hour

// Maximum validators per epoch
const MAX_VALIDATORS_PER_EPOCH = 21;

// Slashing percentages (basis points - 10000 = 100%)
const SLASHING_RATES = {
  consensus_disagreement: 100, // 1% for disagreeing with consensus
  missed_consensus: 50, // 0.5% for missing assigned consensus
  fraud_detected: 2500, // 25% for detected fraud
  repeated_violations: 5000, // 50% for repeated violations
};

// Difficulty scaling factors
const DIFFICULTY_LEVELS = {
  trivial: { workers: 3, threshold: 0.67, reward_multiplier: 0.5 },
  standard: { workers: 5, threshold: 0.67, reward_multiplier: 1.0 },
  important: { workers: 7, threshold: 0.75, reward_multiplier: 1.5 },
  critical: { workers: 11, threshold: 0.80, reward_multiplier: 2.0 },
  maximum: { workers: 15, threshold: 0.85, reward_multiplier: 3.0 },
};

// ============================================================================
// Types
// ============================================================================

export interface StakeInfo {
  stakerId: string;
  stakedAmount: bigint;
  stakedAt: number;
  lockedUntil: number;
  slashedAmount: bigint;
  violations: StakingViolation[];
  isValidator: boolean;
  validatorRank?: number;
}

export interface StakingViolation {
  type: keyof typeof SLASHING_RATES;
  timestamp: number;
  amount: bigint;
  challengeId?: string;
  details: string;
}

export interface Epoch {
  id: number;
  startTime: number;
  endTime: number;
  validators: string[];
  validatorStakes: Map<string, bigint>;
  challengesProcessed: number;
  rewardsDistributed: bigint;
  slashingsApplied: number;
  status: 'active' | 'completed' | 'finalizing';
}

export interface DifficultyAssessment {
  level: keyof typeof DIFFICULTY_LEVELS;
  requiredWorkers: number;
  consensusThreshold: number;
  rewardMultiplier: number;
  reasons: string[];
}

export interface ValidatorElectionResult {
  validators: string[];
  stakes: Map<string, bigint>;
  totalStake: bigint;
  epoch: number;
}

// ============================================================================
// State
// ============================================================================

// All stakers
const stakes = new Map<string, StakeInfo>();

// Current and past epochs
const epochs: Epoch[] = [];
let currentEpochId = 0;

// Pending slashings (to be applied at epoch end)
const pendingSlashings: Map<string, { amount: bigint; reason: string }[]> = new Map();

// Challenge difficulty cache
const difficultyCache = new Map<string, DifficultyAssessment>();

// ============================================================================
// Staking Operations
// ============================================================================

/**
 * Stake tokens for mining/validation rights
 */
export function stake(
  stakerId: string,
  amount: bigint,
  lockDurationMs: number = 0
): { success: boolean; error?: string } {
  if (amount < MIN_STAKE_AMOUNT) {
    return {
      success: false,
      error: `Minimum stake is ${MIN_STAKE_AMOUNT} lamports`,
    };
  }

  const existing = stakes.get(stakerId);
  const now = Date.now();

  if (existing) {
    // Add to existing stake
    existing.stakedAmount += amount;
    existing.lockedUntil = Math.max(existing.lockedUntil, now + lockDurationMs);
    existing.isValidator = existing.stakedAmount >= MIN_VALIDATOR_STAKE;
  } else {
    // New stake
    stakes.set(stakerId, {
      stakerId,
      stakedAmount: amount,
      stakedAt: now,
      lockedUntil: now + lockDurationMs,
      slashedAmount: BigInt(0),
      violations: [],
      isValidator: amount >= MIN_VALIDATOR_STAKE,
    });
  }

  console.log(`[PoUW Staking] ${stakerId} staked ${amount} lamports`);

  // Check if validator set needs update
  if (amount >= MIN_VALIDATOR_STAKE) {
    updateValidatorRankings();
  }

  return { success: true };
}

/**
 * Unstake tokens (subject to lock period)
 */
export function unstake(
  stakerId: string,
  amount: bigint
): { success: boolean; error?: string; availableAt?: number } {
  const info = stakes.get(stakerId);

  if (!info) {
    return { success: false, error: 'No stake found' };
  }

  if (info.lockedUntil > Date.now()) {
    return {
      success: false,
      error: 'Stake is still locked',
      availableAt: info.lockedUntil,
    };
  }

  if (amount > info.stakedAmount) {
    return { success: false, error: 'Insufficient staked amount' };
  }

  info.stakedAmount -= amount;
  info.isValidator = info.stakedAmount >= MIN_VALIDATOR_STAKE;

  if (info.stakedAmount === BigInt(0)) {
    stakes.delete(stakerId);
  }

  console.log(`[PoUW Staking] ${stakerId} unstaked ${amount} lamports`);

  return { success: true };
}

/**
 * Get stake info for a staker
 */
export function getStakeInfo(stakerId: string): StakeInfo | null {
  return stakes.get(stakerId) || null;
}

/**
 * Get all stakers sorted by stake amount
 */
export function getAllStakers(): StakeInfo[] {
  return Array.from(stakes.values()).sort(
    (a, b) => Number(b.stakedAmount - a.stakedAmount)
  );
}

// ============================================================================
// Slashing
// ============================================================================

/**
 * Apply slashing for a violation
 */
export function slash(
  stakerId: string,
  violationType: keyof typeof SLASHING_RATES,
  challengeId?: string,
  details?: string
): { slashed: boolean; amount: bigint; reason: string } {
  const info = stakes.get(stakerId);

  if (!info) {
    return { slashed: false, amount: BigInt(0), reason: 'No stake found' };
  }

  // Calculate slashing amount
  const rate = SLASHING_RATES[violationType];
  const slashAmount = (info.stakedAmount * BigInt(rate)) / BigInt(10000);

  // Record violation
  const violation: StakingViolation = {
    type: violationType,
    timestamp: Date.now(),
    amount: slashAmount,
    challengeId,
    details: details || `Slashed for ${violationType}`,
  };
  info.violations.push(violation);

  // Apply slashing
  info.stakedAmount -= slashAmount;
  info.slashedAmount += slashAmount;

  // Check for repeated violations - apply extra penalty
  const recentViolations = info.violations.filter(
    v => Date.now() - v.timestamp < 86400000 // 24 hours
  );
  if (recentViolations.length >= 3) {
    const extraSlash = (info.stakedAmount * BigInt(SLASHING_RATES.repeated_violations)) / BigInt(10000);
    info.stakedAmount -= extraSlash;
    info.slashedAmount += extraSlash;

    info.violations.push({
      type: 'repeated_violations',
      timestamp: Date.now(),
      amount: extraSlash,
      details: 'Extra penalty for repeated violations within 24 hours',
    });
  }

  // Update validator status
  info.isValidator = info.stakedAmount >= MIN_VALIDATOR_STAKE;

  console.log(`[PoUW Staking] Slashed ${stakerId} for ${slashAmount} lamports (${violationType})`);

  return {
    slashed: true,
    amount: slashAmount,
    reason: violation.details,
  };
}

/**
 * Queue slashing for epoch end (for consensus violations)
 */
export function queueSlashing(
  stakerId: string,
  amount: bigint,
  reason: string
): void {
  const pending = pendingSlashings.get(stakerId) || [];
  pending.push({ amount, reason });
  pendingSlashings.set(stakerId, pending);
}

/**
 * Apply all pending slashings (called at epoch end)
 */
export function applyPendingSlashings(): number {
  let count = 0;

  for (const [stakerId, slashings] of pendingSlashings.entries()) {
    const info = stakes.get(stakerId);
    if (!info) continue;

    for (const { amount, reason } of slashings) {
      const actualSlash = amount > info.stakedAmount ? info.stakedAmount : amount;
      info.stakedAmount -= actualSlash;
      info.slashedAmount += actualSlash;

      info.violations.push({
        type: 'consensus_disagreement',
        timestamp: Date.now(),
        amount: actualSlash,
        details: reason,
      });

      count++;
    }

    info.isValidator = info.stakedAmount >= MIN_VALIDATOR_STAKE;
  }

  pendingSlashings.clear();
  return count;
}

// ============================================================================
// Difficulty Scaling
// ============================================================================

/**
 * Assess difficulty level for a work type and input data
 */
export function assessDifficulty(
  workType: string,
  inputData: any
): DifficultyAssessment {
  const cacheKey = createHash('md5').update(`${workType}_${JSON.stringify(inputData)}`).digest('hex');

  // Check cache
  const cached = difficultyCache.get(cacheKey);
  if (cached) return cached;

  const reasons: string[] = [];
  let level: keyof typeof DIFFICULTY_LEVELS = 'standard';

  // Analyze work type
  switch (workType) {
    case 'pattern_detection':
      level = 'important';
      reasons.push('Pattern detection requires higher verification');
      break;

    case 'wallet_classification':
      if (inputData.classification === 'suspicious' || inputData.classification === 'whale') {
        level = 'critical';
        reasons.push('High-value wallet classification');
      } else {
        level = 'important';
        reasons.push('Wallet classification affects user trust');
      }
      break;

    case 'entity_extraction':
      if (inputData.entityType === 'exchange' || inputData.entityType === 'defi_protocol') {
        level = 'critical';
        reasons.push('Entity extraction for critical infrastructure');
      } else {
        level = 'standard';
      }
      break;

    case 'transaction_indexing':
      // Base difficulty
      level = 'standard';

      // Increase for high-value transactions
      if (inputData.totalValue && inputData.totalValue > 1000000) {
        level = 'important';
        reasons.push('High-value transactions detected');
      }

      // Increase for DeFi transactions
      if (inputData.programs?.some((p: string) =>
        ['Jupiter', 'Raydium', 'Orca', 'Marinade'].some(name => p.includes(name))
      )) {
        level = level === 'important' ? 'critical' : 'important';
        reasons.push('DeFi protocol transactions');
      }
      break;

    case 'fraud_detection':
      level = 'maximum';
      reasons.push('Fraud detection requires maximum verification');
      break;

    default:
      level = 'trivial';
      reasons.push('Unknown work type - using minimal verification');
  }

  // Check data volume
  const dataSize = JSON.stringify(inputData).length;
  if (dataSize > 100000) {
    const nextLevel = getHigherDifficulty(level);
    if (nextLevel !== level) {
      level = nextLevel;
      reasons.push('Large data volume requires additional verification');
    }
  }

  const config = DIFFICULTY_LEVELS[level];
  const assessment: DifficultyAssessment = {
    level,
    requiredWorkers: config.workers,
    consensusThreshold: config.threshold,
    rewardMultiplier: config.reward_multiplier,
    reasons,
  };

  // Cache for 5 minutes
  difficultyCache.set(cacheKey, assessment);
  setTimeout(() => difficultyCache.delete(cacheKey), 300000);

  return assessment;
}

/**
 * Get the next higher difficulty level
 */
function getHigherDifficulty(current: keyof typeof DIFFICULTY_LEVELS): keyof typeof DIFFICULTY_LEVELS {
  const levels: (keyof typeof DIFFICULTY_LEVELS)[] = ['trivial', 'standard', 'important', 'critical', 'maximum'];
  const idx = levels.indexOf(current);
  return idx < levels.length - 1 ? levels[idx + 1]! : current;
}

/**
 * Get difficulty configuration by level
 */
export function getDifficultyConfig(level: keyof typeof DIFFICULTY_LEVELS) {
  return DIFFICULTY_LEVELS[level];
}

// ============================================================================
// Epochs & Validator Elections
// ============================================================================

/**
 * Start a new epoch with validator election
 */
export function startNewEpoch(): Epoch {
  // Finalize current epoch
  if (epochs.length > 0) {
    const current = epochs[epochs.length - 1]!;
    if (current.status === 'active') {
      current.status = 'finalizing';
      applyPendingSlashings();
      current.status = 'completed';
    }
  }

  // Elect new validators
  const election = electValidators();

  // Create new epoch
  const newEpoch: Epoch = {
    id: ++currentEpochId,
    startTime: Date.now(),
    endTime: Date.now() + EPOCH_DURATION_MS,
    validators: election.validators,
    validatorStakes: election.stakes,
    challengesProcessed: 0,
    rewardsDistributed: BigInt(0),
    slashingsApplied: 0,
    status: 'active',
  };

  epochs.push(newEpoch);

  console.log(`[PoUW Staking] Started epoch ${newEpoch.id} with ${election.validators.length} validators`);

  return newEpoch;
}

/**
 * Elect validators for the new epoch
 * Uses stake-weighted selection with randomization
 */
export function electValidators(): ValidatorElectionResult {
  // Get all eligible validators (stake >= MIN_VALIDATOR_STAKE)
  const eligible = Array.from(stakes.values())
    .filter(s => s.isValidator && s.stakedAmount >= MIN_VALIDATOR_STAKE)
    .sort((a, b) => Number(b.stakedAmount - a.stakedAmount));

  if (eligible.length === 0) {
    return {
      validators: [],
      stakes: new Map(),
      totalStake: BigInt(0),
      epoch: currentEpochId + 1,
    };
  }

  // Calculate total stake
  const totalStake = eligible.reduce((sum, s) => sum + s.stakedAmount, BigInt(0));

  // Select validators
  const selectedValidators: string[] = [];
  const selectedStakes = new Map<string, bigint>();

  // Always include top stakers (70% of slots)
  const guaranteedSlots = Math.floor(MAX_VALIDATORS_PER_EPOCH * 0.7);
  for (let i = 0; i < Math.min(guaranteedSlots, eligible.length); i++) {
    selectedValidators.push(eligible[i]!.stakerId);
    selectedStakes.set(eligible[i]!.stakerId, eligible[i]!.stakedAmount);
  }

  // Fill remaining slots with stake-weighted random selection
  const remainingSlots = MAX_VALIDATORS_PER_EPOCH - selectedValidators.length;
  const remainingEligible = eligible.slice(guaranteedSlots);

  if (remainingSlots > 0 && remainingEligible.length > 0) {
    const remainingTotalStake = remainingEligible.reduce((sum, s) => sum + s.stakedAmount, BigInt(0));

    for (let i = 0; i < Math.min(remainingSlots, remainingEligible.length); i++) {
      // Stake-weighted random selection
      const random = BigInt(Math.floor(Math.random() * Number(remainingTotalStake)));
      let cumulative = BigInt(0);

      for (const staker of remainingEligible) {
        if (selectedValidators.includes(staker.stakerId)) continue;

        cumulative += staker.stakedAmount;
        if (cumulative >= random) {
          selectedValidators.push(staker.stakerId);
          selectedStakes.set(staker.stakerId, staker.stakedAmount);
          break;
        }
      }
    }
  }

  // Update validator rankings
  selectedValidators.forEach((v, i) => {
    const info = stakes.get(v);
    if (info) info.validatorRank = i + 1;
  });

  return {
    validators: selectedValidators,
    stakes: selectedStakes,
    totalStake,
    epoch: currentEpochId + 1,
  };
}

/**
 * Update validator rankings based on current stakes
 */
function updateValidatorRankings(): void {
  const sorted = Array.from(stakes.values())
    .filter(s => s.isValidator)
    .sort((a, b) => Number(b.stakedAmount - a.stakedAmount));

  sorted.forEach((s, i) => {
    s.validatorRank = i + 1;
  });
}

/**
 * Get current epoch
 */
export function getCurrentEpoch(): Epoch | null {
  if (epochs.length === 0) return null;

  const current = epochs[epochs.length - 1]!;

  // Check if epoch has expired
  if (current.status === 'active' && Date.now() > current.endTime) {
    // Auto-start new epoch
    return startNewEpoch();
  }

  return current;
}

/**
 * Get epoch by ID
 */
export function getEpoch(epochId: number): Epoch | null {
  return epochs.find(e => e.id === epochId) || null;
}

/**
 * Check if an address is a validator in the current epoch
 */
export function isCurrentValidator(stakerId: string): boolean {
  const epoch = getCurrentEpoch();
  return epoch?.validators.includes(stakerId) || false;
}

/**
 * Record challenge processed in current epoch
 */
export function recordChallengeProcessed(rewards: bigint): void {
  const epoch = getCurrentEpoch();
  if (epoch) {
    epoch.challengesProcessed++;
    epoch.rewardsDistributed += rewards;
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get staking statistics
 */
export function getStakingStats(): {
  totalStaked: bigint;
  totalSlashed: bigint;
  stakerCount: number;
  validatorCount: number;
  currentEpoch: number;
  epochTimeRemaining: number;
  averageStake: bigint;
  minStakeRequired: bigint;
  minValidatorStake: bigint;
} {
  let totalStaked = BigInt(0);
  let totalSlashed = BigInt(0);
  let validatorCount = 0;

  for (const stake of stakes.values()) {
    totalStaked += stake.stakedAmount;
    totalSlashed += stake.slashedAmount;
    if (stake.isValidator) validatorCount++;
  }

  const epoch = getCurrentEpoch();
  const epochTimeRemaining = epoch ? Math.max(0, epoch.endTime - Date.now()) : 0;

  return {
    totalStaked,
    totalSlashed,
    stakerCount: stakes.size,
    validatorCount,
    currentEpoch: currentEpochId,
    epochTimeRemaining,
    averageStake: stakes.size > 0 ? totalStaked / BigInt(stakes.size) : BigInt(0),
    minStakeRequired: MIN_STAKE_AMOUNT,
    minValidatorStake: MIN_VALIDATOR_STAKE,
  };
}

/**
 * Get validator leaderboard
 */
export function getValidatorLeaderboard(limit: number = 20): {
  rank: number;
  stakerId: string;
  stakedAmount: bigint;
  isActive: boolean;
  violationCount: number;
}[] {
  const epoch = getCurrentEpoch();
  const activeValidators = new Set(epoch?.validators || []);

  return getAllStakers()
    .filter(s => s.isValidator)
    .slice(0, limit)
    .map((s, i) => ({
      rank: i + 1,
      stakerId: s.stakerId,
      stakedAmount: s.stakedAmount,
      isActive: activeValidators.has(s.stakerId),
      violationCount: s.violations.length,
    }));
}

// ============================================================================
// Auto-Epoch Management
// ============================================================================

// Start first epoch on module load
let epochStarted = false;
export function ensureEpochStarted(): void {
  if (!epochStarted) {
    startNewEpoch();
    epochStarted = true;
  }
}

// Check epoch expiration every minute
setInterval(() => {
  const epoch = getCurrentEpoch();
  if (epoch && epoch.status === 'active' && Date.now() > epoch.endTime) {
    startNewEpoch();
  }
}, 60000);

// ============================================================================
// Exports
// ============================================================================

export default {
  // Staking
  stake,
  unstake,
  getStakeInfo,
  getAllStakers,

  // Slashing
  slash,
  queueSlashing,
  applyPendingSlashings,

  // Difficulty
  assessDifficulty,
  getDifficultyConfig,

  // Epochs
  startNewEpoch,
  getCurrentEpoch,
  getEpoch,
  electValidators,
  isCurrentValidator,
  recordChallengeProcessed,

  // Stats
  getStakingStats,
  getValidatorLeaderboard,
  ensureEpochStarted,
};
