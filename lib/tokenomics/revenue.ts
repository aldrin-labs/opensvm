/**
 * SVMAI Tokenomics - Revenue Distribution
 *
 * Manages platform revenue collection and distribution to stakeholders.
 */

import {
  RevenueConfig,
  RevenueReport,
  DEFAULT_REVENUE_CONFIG,
  TokenAmount,
  toTokenAmount,
  fromTokenAmount,
} from './types';
import { addToRewardPool, getPoolStats } from './staking';

// ============================================================================
// Revenue Tracking
// ============================================================================

interface RevenueEntry {
  id: string;
  timestamp: number;
  source: 'subscription' | 'credits' | 'marketplace' | 'enterprise' | 'premium' | 'listing_fee' | 'featured';
  amount: TokenAmount;
  description: string;
  processed: boolean;
}

const revenueEntries: RevenueEntry[] = [];
const burnedTokens: TokenAmount[] = [];
const treasuryBalance: { balance: TokenAmount; transactions: Array<{ amount: TokenAmount; timestamp: number; type: 'in' | 'out' }> } = {
  balance: BigInt(0),
  transactions: [],
};
const teamBalance: { balance: TokenAmount; vested: TokenAmount } = {
  balance: BigInt(0),
  vested: BigInt(0),
};

// ============================================================================
// Revenue Collection
// ============================================================================

/**
 * Record revenue from any source
 */
export function recordRevenue(
  source: RevenueEntry['source'],
  amount: TokenAmount,
  description: string
): RevenueEntry {
  const entry: RevenueEntry = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    source,
    amount,
    description,
    processed: false,
  };

  revenueEntries.push(entry);
  return entry;
}

/**
 * Get unprocessed revenue
 */
export function getUnprocessedRevenue(): RevenueEntry[] {
  return revenueEntries.filter(e => !e.processed);
}

/**
 * Get total revenue by period
 */
export function getRevenueByPeriod(
  startTime: number,
  endTime: number
): {
  total: TokenAmount;
  bySource: Record<RevenueEntry['source'], TokenAmount>;
  entries: RevenueEntry[];
} {
  const entries = revenueEntries.filter(
    e => e.timestamp >= startTime && e.timestamp <= endTime
  );

  const bySource: Record<string, TokenAmount> = {
    subscription: BigInt(0),
    credits: BigInt(0),
    marketplace: BigInt(0),
    enterprise: BigInt(0),
    premium: BigInt(0),
    listing_fee: BigInt(0),
    featured: BigInt(0),
  };

  let total = BigInt(0);
  for (const entry of entries) {
    bySource[entry.source] += entry.amount;
    total += entry.amount;
  }

  return {
    total,
    bySource: bySource as Record<RevenueEntry['source'], TokenAmount>,
    entries,
  };
}

// ============================================================================
// Revenue Distribution
// ============================================================================

/**
 * Distribute accumulated revenue according to config
 */
export function distributeRevenue(
  config: RevenueConfig = DEFAULT_REVENUE_CONFIG
): {
  totalDistributed: TokenAmount;
  burned: TokenAmount;
  toStakers: TokenAmount;
  toTreasury: TokenAmount;
  toTeam: TokenAmount;
} {
  const unprocessed = getUnprocessedRevenue();
  if (unprocessed.length === 0) {
    return {
      totalDistributed: BigInt(0),
      burned: BigInt(0),
      toStakers: BigInt(0),
      toTreasury: BigInt(0),
      toTeam: BigInt(0),
    };
  }

  // Calculate total platform revenue (after creator share)
  let totalPlatformRevenue = BigInt(0);
  for (const entry of unprocessed) {
    // Platform share is already calculated when recording marketplace revenue
    totalPlatformRevenue += entry.amount;
    entry.processed = true;
  }

  // Distribute according to config
  const burnAmount = BigInt(Math.floor(Number(totalPlatformRevenue) * (config.burnRate / 100)));
  const stakingAmount = BigInt(Math.floor(Number(totalPlatformRevenue) * (config.stakingRewards / 100)));
  const treasuryAmount = BigInt(Math.floor(Number(totalPlatformRevenue) * (config.treasuryShare / 100)));
  const teamAmount = BigInt(Math.floor(Number(totalPlatformRevenue) * (config.teamShare / 100)));

  // Execute distribution
  if (burnAmount > BigInt(0)) {
    burnedTokens.push(burnAmount);
  }

  if (stakingAmount > BigInt(0)) {
    addToRewardPool(stakingAmount);
  }

  if (treasuryAmount > BigInt(0)) {
    treasuryBalance.balance += treasuryAmount;
    treasuryBalance.transactions.push({
      amount: treasuryAmount,
      timestamp: Date.now(),
      type: 'in',
    });
  }

  if (teamAmount > BigInt(0)) {
    teamBalance.balance += teamAmount;
  }

  return {
    totalDistributed: totalPlatformRevenue,
    burned: burnAmount,
    toStakers: stakingAmount,
    toTreasury: treasuryAmount,
    toTeam: teamAmount,
  };
}

// ============================================================================
// Burn Tracking
// ============================================================================

/**
 * Get total tokens burned
 */
export function getTotalBurned(): TokenAmount {
  return burnedTokens.reduce((sum, b) => sum + b, BigInt(0));
}

/**
 * Get burn history
 */
export function getBurnHistory(): Array<{ amount: TokenAmount; timestamp: number }> {
  // In production, track timestamps properly
  return burnedTokens.map((amount, i) => ({
    amount,
    timestamp: Date.now() - (burnedTokens.length - i) * 24 * 60 * 60 * 1000,
  }));
}

/**
 * Manual burn (e.g., for feature unlocks)
 */
export function burnTokens(amount: TokenAmount, reason: string): void {
  burnedTokens.push(amount);
  recordRevenue('premium', amount, `Burn: ${reason}`);
}

// ============================================================================
// Treasury Management
// ============================================================================

/**
 * Get treasury status
 */
export function getTreasuryStatus(): {
  balance: TokenAmount;
  totalIn: TokenAmount;
  totalOut: TokenAmount;
  recentTransactions: Array<{ amount: TokenAmount; timestamp: number; type: 'in' | 'out' }>;
} {
  const totalIn = treasuryBalance.transactions
    .filter(t => t.type === 'in')
    .reduce((sum, t) => sum + t.amount, BigInt(0));

  const totalOut = treasuryBalance.transactions
    .filter(t => t.type === 'out')
    .reduce((sum, t) => sum + t.amount, BigInt(0));

  return {
    balance: treasuryBalance.balance,
    totalIn,
    totalOut,
    recentTransactions: treasuryBalance.transactions.slice(-20),
  };
}

/**
 * Withdraw from treasury (governance approved)
 */
export function withdrawFromTreasury(
  amount: TokenAmount,
  reason: string
): { success: boolean; error?: string } {
  if (amount > treasuryBalance.balance) {
    return { success: false, error: 'Insufficient treasury balance' };
  }

  treasuryBalance.balance -= amount;
  treasuryBalance.transactions.push({
    amount,
    timestamp: Date.now(),
    type: 'out',
  });

  return { success: true };
}

// ============================================================================
// Buyback & Burn
// ============================================================================

interface BuybackEvent {
  id: string;
  timestamp: number;
  usdAmount: number;
  tokensBought: TokenAmount;
  tokensBurned: TokenAmount;
  averagePrice: number;
}

const buybackHistory: BuybackEvent[] = [];

/**
 * Record a buyback event
 */
export function recordBuyback(
  usdAmount: number,
  tokensBought: TokenAmount,
  averagePrice: number
): BuybackEvent {
  const event: BuybackEvent = {
    id: `buyback-${Date.now()}`,
    timestamp: Date.now(),
    usdAmount,
    tokensBought,
    tokensBurned: tokensBought,
    averagePrice,
  };

  buybackHistory.push(event);
  burnedTokens.push(tokensBought);

  return event;
}

/**
 * Get buyback history
 */
export function getBuybackHistory(): BuybackEvent[] {
  return buybackHistory;
}

/**
 * Get buyback statistics
 */
export function getBuybackStats(): {
  totalUsdSpent: number;
  totalTokensBurned: TokenAmount;
  averagePrice: number;
  events: number;
} {
  const totalUsdSpent = buybackHistory.reduce((sum, e) => sum + e.usdAmount, 0);
  const totalTokensBurned = buybackHistory.reduce((sum, e) => sum + e.tokensBurned, BigInt(0));

  return {
    totalUsdSpent,
    totalTokensBurned,
    averagePrice: buybackHistory.length > 0
      ? totalUsdSpent / Number(fromTokenAmount(totalTokensBurned))
      : 0,
    events: buybackHistory.length,
  };
}

// ============================================================================
// Revenue Reports
// ============================================================================

/**
 * Generate monthly revenue report
 */
export function generateRevenueReport(year: number, month: number): RevenueReport {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const periodRevenue = getRevenueByPeriod(startDate.getTime(), endDate.getTime());
  const stakingStats = getPoolStats();
  const treasuryStatus = getTreasuryStatus();

  // Calculate distributions for the period
  const config = DEFAULT_REVENUE_CONFIG;
  const platformTotal = periodRevenue.total;

  const burned = BigInt(Math.floor(Number(platformTotal) * (config.burnRate / 100)));
  const toStakers = BigInt(Math.floor(Number(platformTotal) * (config.stakingRewards / 100)));
  const toTreasury = BigInt(Math.floor(Number(platformTotal) * (config.treasuryShare / 100)));
  const toTeam = BigInt(Math.floor(Number(platformTotal) * (config.teamShare / 100)));

  // Estimate creator share (70% of marketplace revenue)
  const creatorShare = BigInt(Math.floor(Number(periodRevenue.bySource.marketplace) * 0.7 / 0.3));

  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    totalRevenue: periodRevenue.total,
    breakdown: {
      subscriptions: periodRevenue.bySource.subscription,
      credits: periodRevenue.bySource.credits,
      marketplace: periodRevenue.bySource.marketplace,
      enterprise: periodRevenue.bySource.enterprise,
      premium: periodRevenue.bySource.premium,
    },
    distribution: {
      burned,
      stakingRewards: toStakers,
      treasury: toTreasury,
      team: toTeam,
      creators: creatorShare,
    },
  };
}

/**
 * Get all-time revenue summary
 */
export function getAllTimeRevenueSummary(): {
  totalRevenue: TokenAmount;
  totalBurned: TokenAmount;
  totalToStakers: TokenAmount;
  treasuryBalance: TokenAmount;
  teamBalance: TokenAmount;
  totalCreatorPayouts: TokenAmount;
} {
  const totalRevenue = revenueEntries.reduce((sum, e) => sum + e.amount, BigInt(0));

  return {
    totalRevenue,
    totalBurned: getTotalBurned(),
    totalToStakers: getPoolStats().rewardPool, // Simplified
    treasuryBalance: treasuryBalance.balance,
    teamBalance: teamBalance.balance,
    totalCreatorPayouts: BigInt(0), // Track separately in production
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  recordRevenue,
  getUnprocessedRevenue,
  getRevenueByPeriod,
  distributeRevenue,
  getTotalBurned,
  getBurnHistory,
  burnTokens,
  getTreasuryStatus,
  withdrawFromTreasury,
  recordBuyback,
  getBuybackHistory,
  getBuybackStats,
  generateRevenueReport,
  getAllTimeRevenueSummary,
};
