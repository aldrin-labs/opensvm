/**
 * SVMAI Tokenomics - Credits System
 *
 * Manages pay-per-query credits, purchases, and usage tracking.
 */

import {
  UserCredits,
  CreditPack,
  CREDIT_PACKS,
  ToolCreditCost,
  ToolCategory,
  AccessTier,
  TokenAmount,
  toTokenAmount,
  fromTokenAmount,
} from './types';
import { getTierBenefits } from './access-tiers';

// ============================================================================
// Tool Credit Costs
// ============================================================================

export const TOOL_CREDIT_COSTS: ToolCreditCost[] = [
  // Basic Tools (1-5 credits)
  { toolName: 'get_transaction', category: 'basic', baseCost: 1, computeMultiplier: 1, description: 'Fetch transaction details' },
  { toolName: 'get_account_portfolio', category: 'basic', baseCost: 2, computeMultiplier: 1, description: 'Get account portfolio' },
  { toolName: 'get_account_transactions', category: 'basic', baseCost: 2, computeMultiplier: 1.5, description: 'List account transactions' },
  { toolName: 'get_blocks', category: 'basic', baseCost: 1, computeMultiplier: 1, description: 'Get recent blocks' },
  { toolName: 'get_token_metadata', category: 'basic', baseCost: 1, computeMultiplier: 1, description: 'Get token metadata' },
  { toolName: 'search', category: 'basic', baseCost: 2, computeMultiplier: 1, description: 'Search transactions/accounts' },
  { toolName: 'get_network_status', category: 'basic', baseCost: 0, computeMultiplier: 1, description: 'Network health check (free)' },

  // Advanced Tools (5-20 credits)
  { toolName: 'explain_transaction', category: 'advanced', baseCost: 5, computeMultiplier: 1, description: 'Human-readable tx explanation' },
  { toolName: 'analyze_transaction', category: 'advanced', baseCost: 10, computeMultiplier: 1.5, description: 'Deep transaction analysis' },
  { toolName: 'get_account_stats', category: 'advanced', baseCost: 8, computeMultiplier: 1, description: 'Account statistics' },
  { toolName: 'get_token_ohlcv', category: 'advanced', baseCost: 5, computeMultiplier: 1, description: 'Token price data' },
  { toolName: 'get_token_markets', category: 'advanced', baseCost: 5, computeMultiplier: 1, description: 'Token market info' },
  { toolName: 'find_wallet_path', category: 'advanced', baseCost: 15, computeMultiplier: 2, description: 'Find path between wallets' },

  // AI Tools (20-50 credits)
  { toolName: 'ask_ai', category: 'ai', baseCost: 25, computeMultiplier: 1.5, description: 'AI-powered analysis' },
  { toolName: 'compress_result', category: 'ai', baseCost: 10, computeMultiplier: 1, description: 'AI result compression' },

  // Forensics Tools (30-100 credits)
  { toolName: 'investigate', category: 'forensics', baseCost: 50, computeMultiplier: 2, description: 'Autonomous investigation' },
  { toolName: 'investigate_with_template', category: 'forensics', baseCost: 40, computeMultiplier: 1.5, description: 'Template-based investigation' },

  // Enterprise Tools (50-200 credits)
  { toolName: 'batch_execute', category: 'enterprise', baseCost: 10, computeMultiplier: 3, description: 'Batch tool execution' },
  { toolName: 'execute_pipeline', category: 'enterprise', baseCost: 20, computeMultiplier: 2, description: 'Execute tool pipeline' },
];

// ============================================================================
// In-Memory Store (Replace with database in production)
// ============================================================================

const userCredits: Map<string, UserCredits> = new Map();
const usageLog: Map<string, Array<{ toolName: string; credits: number; timestamp: number }>> = new Map();

// ============================================================================
// Credit Pack Operations
// ============================================================================

export function getCreditPacks(): CreditPack[] {
  return CREDIT_PACKS;
}

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find(p => p.id === packId);
}

/**
 * Calculate effective price with tier discount
 */
export function calculatePackPrice(packId: string, tier: AccessTier): {
  pack: CreditPack;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  totalCredits: number;
} {
  const pack = getCreditPack(packId);
  if (!pack) {
    throw new Error(`Unknown credit pack: ${packId}`);
  }

  const tierBenefits = getTierBenefits(tier);
  const tierDiscount = tierBenefits.creditDiscount;
  const totalDiscount = Math.min(50, pack.discount + tierDiscount); // Cap at 50%

  const finalPrice = Math.floor(pack.priceTokens * (1 - totalDiscount / 100));
  const totalCredits = pack.credits + pack.bonusCredits;

  return {
    pack,
    originalPrice: pack.priceTokens,
    discount: totalDiscount,
    finalPrice,
    totalCredits,
  };
}

/**
 * Purchase credits with tokens
 */
export function purchaseCredits(
  wallet: string,
  packId: string,
  tier: AccessTier
): {
  success: boolean;
  creditsAdded: number;
  tokensCost: number;
  newBalance: number;
} {
  const priceInfo = calculatePackPrice(packId, tier);

  // Get or create user credits
  let credits = userCredits.get(wallet);
  if (!credits) {
    credits = createUserCredits(wallet);
  }

  // Add credits
  credits.balance += priceInfo.totalCredits;
  credits.totalPurchased += priceInfo.totalCredits;
  userCredits.set(wallet, credits);

  return {
    success: true,
    creditsAdded: priceInfo.totalCredits,
    tokensCost: priceInfo.finalPrice,
    newBalance: credits.balance,
  };
}

// ============================================================================
// User Credits Management
// ============================================================================

function createUserCredits(wallet: string): UserCredits {
  const now = Date.now();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  const credits: UserCredits = {
    wallet,
    balance: 0,
    totalPurchased: 0,
    totalUsed: 0,
    totalEarned: 0,
    monthlyAllocation: 0,
    monthlyUsed: 0,
    resetDate: nextMonth.getTime(),
  };

  userCredits.set(wallet, credits);
  return credits;
}

export function getUserCredits(wallet: string): UserCredits {
  let credits = userCredits.get(wallet);
  if (!credits) {
    credits = createUserCredits(wallet);
  }

  // Check if monthly reset is needed
  if (Date.now() >= credits.resetDate) {
    resetMonthlyCredits(wallet);
    credits = userCredits.get(wallet)!;
  }

  return credits;
}

/**
 * Set monthly credit allocation based on tier
 */
export function setMonthlyAllocation(wallet: string, tier: AccessTier): void {
  const benefits = getTierBenefits(tier);
  const credits = getUserCredits(wallet);

  credits.monthlyAllocation = benefits.monthlyCredits === -1 ? Infinity : benefits.monthlyCredits;
  userCredits.set(wallet, credits);
}

/**
 * Reset monthly credits (called at start of each month)
 */
function resetMonthlyCredits(wallet: string): void {
  const credits = userCredits.get(wallet);
  if (!credits) return;

  const now = Date.now();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  credits.monthlyUsed = 0;
  credits.resetDate = nextMonth.getTime();

  userCredits.set(wallet, credits);
}

/**
 * Add earned credits (from referrals, rewards, etc.)
 */
export function addEarnedCredits(wallet: string, amount: number, reason: string): void {
  const credits = getUserCredits(wallet);
  credits.balance += amount;
  credits.totalEarned += amount;
  userCredits.set(wallet, credits);
}

// ============================================================================
// Credit Usage
// ============================================================================

export function getToolCreditCost(toolName: string): ToolCreditCost | undefined {
  return TOOL_CREDIT_COSTS.find(t => t.toolName === toolName);
}

/**
 * Calculate credits needed for a tool call
 */
export function calculateToolCost(
  toolName: string,
  complexity: number = 1 // 1 = normal, higher = more compute
): number {
  const toolCost = getToolCreditCost(toolName);
  if (!toolCost) {
    return 5; // Default cost for unknown tools
  }

  return Math.ceil(toolCost.baseCost * toolCost.computeMultiplier * complexity);
}

/**
 * Check if user has enough credits
 */
export function canAffordTool(
  wallet: string,
  toolName: string,
  complexity: number = 1
): {
  canAfford: boolean;
  cost: number;
  balance: number;
  monthlyRemaining: number;
} {
  const credits = getUserCredits(wallet);
  const cost = calculateToolCost(toolName, complexity);

  // Check monthly allocation first (if not unlimited)
  const monthlyRemaining = credits.monthlyAllocation === Infinity
    ? Infinity
    : credits.monthlyAllocation - credits.monthlyUsed;

  // Can use from monthly allocation or purchased balance
  const availableCredits = Math.min(monthlyRemaining, Infinity) + credits.balance;
  const canAfford = availableCredits >= cost;

  return {
    canAfford,
    cost,
    balance: credits.balance,
    monthlyRemaining: monthlyRemaining === Infinity ? -1 : monthlyRemaining,
  };
}

/**
 * Consume credits for a tool call
 */
export function consumeCredits(
  wallet: string,
  toolName: string,
  complexity: number = 1
): {
  success: boolean;
  creditsUsed: number;
  fromMonthly: number;
  fromBalance: number;
  newBalance: number;
} {
  const affordCheck = canAffordTool(wallet, toolName, complexity);
  if (!affordCheck.canAfford) {
    return {
      success: false,
      creditsUsed: 0,
      fromMonthly: 0,
      fromBalance: 0,
      newBalance: affordCheck.balance,
    };
  }

  const credits = getUserCredits(wallet);
  const cost = affordCheck.cost;

  // Use monthly allocation first, then purchased balance
  let fromMonthly = 0;
  let fromBalance = 0;

  if (credits.monthlyAllocation !== Infinity) {
    const monthlyAvailable = credits.monthlyAllocation - credits.monthlyUsed;
    fromMonthly = Math.min(monthlyAvailable, cost);
    credits.monthlyUsed += fromMonthly;
  } else {
    fromMonthly = cost; // Unlimited monthly
  }

  fromBalance = cost - fromMonthly;
  if (fromBalance > 0) {
    credits.balance -= fromBalance;
  }

  credits.totalUsed += cost;
  userCredits.set(wallet, credits);

  // Log usage
  const log = usageLog.get(wallet) || [];
  log.push({ toolName, credits: cost, timestamp: Date.now() });
  usageLog.set(wallet, log);

  return {
    success: true,
    creditsUsed: cost,
    fromMonthly,
    fromBalance,
    newBalance: credits.balance,
  };
}

// ============================================================================
// Usage Analytics
// ============================================================================

export function getUsageHistory(
  wallet: string,
  days: number = 30
): Array<{ toolName: string; credits: number; timestamp: number }> {
  const log = usageLog.get(wallet) || [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return log.filter(entry => entry.timestamp >= cutoff);
}

export function getUsageSummary(wallet: string): {
  totalCreditsUsed: number;
  averageDaily: number;
  topTools: Array<{ toolName: string; count: number; credits: number }>;
  projectedMonthlyUsage: number;
} {
  const history = getUsageHistory(wallet, 30);

  // Calculate totals
  const totalCreditsUsed = history.reduce((sum, entry) => sum + entry.credits, 0);
  const averageDaily = totalCreditsUsed / 30;

  // Group by tool
  const toolUsage = new Map<string, { count: number; credits: number }>();
  for (const entry of history) {
    const current = toolUsage.get(entry.toolName) || { count: 0, credits: 0 };
    current.count++;
    current.credits += entry.credits;
    toolUsage.set(entry.toolName, current);
  }

  const topTools = Array.from(toolUsage.entries())
    .map(([toolName, data]) => ({ toolName, ...data }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 10);

  return {
    totalCreditsUsed,
    averageDaily,
    topTools,
    projectedMonthlyUsage: averageDaily * 30,
  };
}

// ============================================================================
// Credit Transfer
// ============================================================================

export function transferCredits(
  fromWallet: string,
  toWallet: string,
  amount: number
): { success: boolean; error?: string } {
  const fromCredits = getUserCredits(fromWallet);

  if (fromCredits.balance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const toCredits = getUserCredits(toWallet);

  fromCredits.balance -= amount;
  toCredits.balance += amount;

  userCredits.set(fromWallet, fromCredits);
  userCredits.set(toWallet, toCredits);

  return { success: true };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  TOOL_CREDIT_COSTS,
  getCreditPacks,
  getCreditPack,
  calculatePackPrice,
  purchaseCredits,
  getUserCredits,
  setMonthlyAllocation,
  addEarnedCredits,
  getToolCreditCost,
  calculateToolCost,
  canAffordTool,
  consumeCredits,
  getUsageHistory,
  getUsageSummary,
  transferCredits,
};
