/**
 * SVMAI Tokenomics - Security Module
 *
 * Security checks, anti-gaming measures, and validation.
 */

import {
  TokenAmount,
  AccessTier,
  StakeDuration,
  toTokenAmount,
  fromTokenAmount,
} from './types';
import { getWalletTotalStaked } from './staking';

// ============================================================================
// Anti-Flash Loan Protection
// ============================================================================

/**
 * Snapshot-based voting power
 * Voting power is determined at proposal creation, not at vote time
 */
export interface VotingSnapshot {
  proposalId: string;
  blockNumber: number;
  timestamp: number;
  walletBalances: Map<string, TokenAmount>;
  totalSupply: TokenAmount;
}

const votingSnapshots: Map<string, VotingSnapshot> = new Map();

/**
 * Create a voting snapshot for a proposal
 */
export function createVotingSnapshot(
  proposalId: string,
  blockNumber: number,
  walletBalances: Map<string, TokenAmount>,
  totalSupply: TokenAmount
): VotingSnapshot {
  const snapshot: VotingSnapshot = {
    proposalId,
    blockNumber,
    timestamp: Date.now(),
    walletBalances,
    totalSupply,
  };

  votingSnapshots.set(proposalId, snapshot);
  return snapshot;
}

/**
 * Get voting power at snapshot time (anti-flash loan)
 */
export function getSnapshotVotingPower(
  proposalId: string,
  wallet: string
): TokenAmount {
  const snapshot = votingSnapshots.get(proposalId);
  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  return snapshot.walletBalances.get(wallet) || BigInt(0);
}

// ============================================================================
// Stake Lock Validation
// ============================================================================

/**
 * Minimum stake duration to prevent stake-vote-unstake attacks
 */
export const MIN_STAKE_FOR_GOVERNANCE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if stake is eligible for governance
 */
export function isStakeEligibleForGovernance(
  stakeStartTime: number,
  proposalStartTime: number
): boolean {
  // Stake must exist before proposal was created
  return stakeStartTime < proposalStartTime - MIN_STAKE_FOR_GOVERNANCE;
}

/**
 * Cooldown period after unstaking before re-staking
 */
export const RESTAKE_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

const lastUnstakeTime: Map<string, number> = new Map();

export function recordUnstake(wallet: string): void {
  lastUnstakeTime.set(wallet, Date.now());
}

export function canRestake(wallet: string): { allowed: boolean; waitTime?: number } {
  const lastUnstake = lastUnstakeTime.get(wallet);
  if (!lastUnstake) {
    return { allowed: true };
  }

  const elapsed = Date.now() - lastUnstake;
  if (elapsed >= RESTAKE_COOLDOWN) {
    return { allowed: true };
  }

  return { allowed: false, waitTime: RESTAKE_COOLDOWN - elapsed };
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimits: Map<string, Map<string, RateLimitEntry>> = new Map();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'api:default': { windowMs: 60000, maxRequests: 60 },
  'api:credits': { windowMs: 60000, maxRequests: 10 },
  'api:stake': { windowMs: 300000, maxRequests: 5 },
  'api:governance': { windowMs: 60000, maxRequests: 20 },
  'api:vote': { windowMs: 3600000, maxRequests: 10 },
};

/**
 * Check and update rate limit
 */
export function checkRateLimit(
  wallet: string,
  action: string,
  config?: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const limitConfig = config || DEFAULT_RATE_LIMITS[action] || DEFAULT_RATE_LIMITS['api:default'];
  const now = Date.now();

  // Get or create wallet's rate limit map
  let walletLimits = rateLimits.get(wallet);
  if (!walletLimits) {
    walletLimits = new Map();
    rateLimits.set(wallet, walletLimits);
  }

  // Get or create action's rate limit entry
  let entry = walletLimits.get(action);
  if (!entry || now - entry.windowStart >= limitConfig.windowMs) {
    entry = { count: 0, windowStart: now };
  }

  // Check limit
  if (entry.count >= limitConfig.maxRequests) {
    const resetIn = limitConfig.windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetIn };
  }

  // Update count
  entry.count++;
  walletLimits.set(action, entry);

  return {
    allowed: true,
    remaining: limitConfig.maxRequests - entry.count,
    resetIn: limitConfig.windowMs - (now - entry.windowStart),
  };
}

// ============================================================================
// Input Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate wallet address
 */
export function validateWalletAddress(address: string): ValidationResult {
  const errors: string[] = [];

  if (!address) {
    errors.push('Wallet address is required');
  } else if (address.length < 32 || address.length > 44) {
    errors.push('Invalid wallet address length');
  } else if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)) {
    errors.push('Invalid wallet address format (must be base58)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate token amount
 */
export function validateTokenAmount(
  amount: TokenAmount | number | string,
  options?: { min?: number; max?: number }
): ValidationResult {
  const errors: string[] = [];

  let numAmount: number;
  try {
    if (typeof amount === 'bigint') {
      numAmount = fromTokenAmount(amount);
    } else if (typeof amount === 'string') {
      numAmount = parseFloat(amount);
    } else {
      numAmount = amount;
    }
  } catch {
    errors.push('Invalid token amount format');
    return { valid: false, errors };
  }

  if (isNaN(numAmount)) {
    errors.push('Token amount must be a number');
  } else if (numAmount < 0) {
    errors.push('Token amount cannot be negative');
  } else if (options?.min !== undefined && numAmount < options.min) {
    errors.push(`Token amount must be at least ${options.min}`);
  } else if (options?.max !== undefined && numAmount > options.max) {
    errors.push(`Token amount cannot exceed ${options.max}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate stake duration
 */
export function validateStakeDuration(duration: string): ValidationResult {
  const validDurations = ['7d', '30d', '90d', '180d', '365d'];
  const errors: string[] = [];

  if (!validDurations.includes(duration)) {
    errors.push(`Invalid stake duration. Must be one of: ${validDurations.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate proposal input
 */
export function validateProposalInput(input: {
  title?: string;
  description?: string;
  type?: string;
  actions?: any[];
}): ValidationResult {
  const errors: string[] = [];

  // Title validation
  if (!input.title) {
    errors.push('Proposal title is required');
  } else if (input.title.length < 10) {
    errors.push('Proposal title must be at least 10 characters');
  } else if (input.title.length > 200) {
    errors.push('Proposal title cannot exceed 200 characters');
  }

  // Description validation
  if (!input.description) {
    errors.push('Proposal description is required');
  } else if (input.description.length < 50) {
    errors.push('Proposal description must be at least 50 characters');
  } else if (input.description.length > 10000) {
    errors.push('Proposal description cannot exceed 10,000 characters');
  }

  // Type validation
  const validTypes = ['parameter', 'treasury', 'upgrade', 'feature', 'emergency', 'text'];
  if (!input.type) {
    errors.push('Proposal type is required');
  } else if (!validTypes.includes(input.type)) {
    errors.push(`Invalid proposal type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Actions validation
  if (input.type !== 'text' && (!input.actions || input.actions.length === 0)) {
    errors.push('Non-text proposals must have at least one action');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Economic Safeguards
// ============================================================================

/**
 * Maximum single stake amount (prevent whale dominance)
 */
export const MAX_SINGLE_STAKE = toTokenAmount(10_000_000); // 10M tokens

/**
 * Maximum voting power percentage (prevent 51% attacks)
 */
export const MAX_VOTING_POWER_PERCENT = 10; // 10% of total

/**
 * Check if stake amount is within limits
 */
export function validateStakeAmount(
  wallet: string,
  newStakeAmount: TokenAmount,
  totalStaked: TokenAmount
): ValidationResult {
  const errors: string[] = [];

  // Check single stake limit
  if (newStakeAmount > MAX_SINGLE_STAKE) {
    errors.push(`Single stake cannot exceed ${fromTokenAmount(MAX_SINGLE_STAKE).toLocaleString()} tokens`);
  }

  // Check total stake concentration
  const currentStaked = getWalletTotalStaked(wallet).staked;
  const totalAfterStake = currentStaked + newStakeAmount;
  const newTotalStaked = totalStaked + newStakeAmount;

  const percentOfTotal = (Number(totalAfterStake) / Number(newTotalStaked)) * 100;
  if (percentOfTotal > MAX_VOTING_POWER_PERCENT) {
    errors.push(`Stake would give you ${percentOfTotal.toFixed(1)}% of voting power, exceeding ${MAX_VOTING_POWER_PERCENT}% limit`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Treasury spend limits
 */
export const TREASURY_LIMITS = {
  singleSpendMax: toTokenAmount(1_000_000), // 1M per proposal
  monthlySpendMax: toTokenAmount(5_000_000), // 5M per month
  emergencyReserve: toTokenAmount(2_000_000), // Always keep 2M
};

let monthlyTreasurySpend = BigInt(0);
let monthlyResetDate = getNextMonthStart();

function getNextMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

/**
 * Validate treasury spend
 */
export function validateTreasurySpend(
  amount: TokenAmount,
  currentBalance: TokenAmount
): ValidationResult {
  const errors: string[] = [];

  // Reset monthly counter if needed
  if (Date.now() >= monthlyResetDate) {
    monthlyTreasurySpend = BigInt(0);
    monthlyResetDate = getNextMonthStart();
  }

  // Check single spend limit
  if (amount > TREASURY_LIMITS.singleSpendMax) {
    errors.push(`Single treasury spend cannot exceed ${fromTokenAmount(TREASURY_LIMITS.singleSpendMax).toLocaleString()} tokens`);
  }

  // Check monthly limit
  if (monthlyTreasurySpend + amount > TREASURY_LIMITS.monthlySpendMax) {
    const remaining = TREASURY_LIMITS.monthlySpendMax - monthlyTreasurySpend;
    errors.push(`Monthly treasury spend limit reached. Remaining: ${fromTokenAmount(remaining).toLocaleString()} tokens`);
  }

  // Check emergency reserve
  if (currentBalance - amount < TREASURY_LIMITS.emergencyReserve) {
    errors.push(`Spend would reduce treasury below emergency reserve of ${fromTokenAmount(TREASURY_LIMITS.emergencyReserve).toLocaleString()} tokens`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Record treasury spend (call after successful execution)
 */
export function recordTreasurySpend(amount: TokenAmount): void {
  monthlyTreasurySpend += amount;
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  wallet: string;
  details: Record<string, any>;
  success: boolean;
  error?: string;
  ipHash?: string;
}

const auditLog: AuditLogEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 100000;

/**
 * Log an action for audit
 */
export function logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...entry,
  };

  auditLog.push(fullEntry);

  // Trim if too large
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_SIZE);
  }

  return fullEntry;
}

/**
 * Get audit log entries
 */
export function getAuditLog(options?: {
  wallet?: string;
  action?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): AuditLogEntry[] {
  let entries = [...auditLog];

  if (options?.wallet) {
    entries = entries.filter(e => e.wallet === options.wallet);
  }
  if (options?.action) {
    entries = entries.filter(e => e.action === options.action);
  }
  if (options?.startTime) {
    entries = entries.filter(e => e.timestamp >= options.startTime!);
  }
  if (options?.endTime) {
    entries = entries.filter(e => e.timestamp <= options.endTime!);
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);

  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

// ============================================================================
// Suspicious Activity Detection
// ============================================================================

export interface SuspiciousActivityAlert {
  id: string;
  timestamp: number;
  type: 'rapid_staking' | 'vote_manipulation' | 'credit_abuse' | 'sybil' | 'other';
  wallet: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  resolved: boolean;
}

const suspiciousAlerts: SuspiciousActivityAlert[] = [];

/**
 * Check for rapid stake/unstake patterns
 */
export function detectRapidStaking(wallet: string): SuspiciousActivityAlert | null {
  const recentStakes = getAuditLog({
    wallet,
    action: 'stake',
    startTime: Date.now() - 24 * 60 * 60 * 1000,
  });

  const recentUnstakes = getAuditLog({
    wallet,
    action: 'unstake',
    startTime: Date.now() - 24 * 60 * 60 * 1000,
  });

  // Flag if more than 5 stake/unstake operations in 24h
  if (recentStakes.length + recentUnstakes.length > 5) {
    const alert: SuspiciousActivityAlert = {
      id: `alert-${Date.now()}`,
      timestamp: Date.now(),
      type: 'rapid_staking',
      wallet,
      severity: 'medium',
      description: 'Unusual number of stake/unstake operations detected',
      evidence: {
        stakeCount: recentStakes.length,
        unstakeCount: recentUnstakes.length,
        period: '24h',
      },
      resolved: false,
    };

    suspiciousAlerts.push(alert);
    return alert;
  }

  return null;
}

/**
 * Get unresolved alerts
 */
export function getUnresolvedAlerts(): SuspiciousActivityAlert[] {
  return suspiciousAlerts.filter(a => !a.resolved);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Anti-flash loan
  createVotingSnapshot,
  getSnapshotVotingPower,

  // Stake locks
  MIN_STAKE_FOR_GOVERNANCE,
  RESTAKE_COOLDOWN,
  isStakeEligibleForGovernance,
  recordUnstake,
  canRestake,

  // Rate limiting
  checkRateLimit,

  // Validation
  validateWalletAddress,
  validateTokenAmount,
  validateStakeDuration,
  validateProposalInput,
  validateStakeAmount,
  validateTreasurySpend,

  // Economic safeguards
  MAX_SINGLE_STAKE,
  MAX_VOTING_POWER_PERCENT,
  TREASURY_LIMITS,
  recordTreasurySpend,

  // Audit
  logAudit,
  getAuditLog,

  // Detection
  detectRapidStaking,
  getUnresolvedAlerts,
};
