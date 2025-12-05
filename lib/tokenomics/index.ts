/**
 * SVMAI Tokenomics - Main Module
 *
 * Comprehensive tokenomics system for the $SVMAI token.
 *
 * Features:
 * - Access Tiers: Token-gated feature access
 * - Staking: Time-locked staking with multipliers
 * - Credits: Pay-per-query usage system
 * - Marketplace: Tool creator economy
 * - Revenue: Distribution to stakeholders
 */

// Re-export all types
export * from './types';

// Re-export modules
export * as accessTiers from './access-tiers';
export * as staking from './staking';
export * as credits from './credits';
export * as marketplace from './marketplace';
export * as revenue from './revenue';
export * as governance from './governance';
export * as solanaIntegration from './solana-integration';
export * as security from './security';

// Import for TokenomicsManager
import {
  AccessTier,
  TokenAmount,
  UserAccount,
  StakePosition,
  toTokenAmount,
  fromTokenAmount,
  TIER_CONFIGS,
} from './types';
import {
  calculateTier,
  calculateEffectiveBalance,
  getTierBenefits,
  checkRateLimit,
  hasToolAccess,
} from './access-tiers';
import {
  createStake,
  getWalletStakes,
  getWalletTotalStaked,
  unstake,
  claimAllRewards,
  getPoolStats,
} from './staking';
import {
  getUserCredits,
  setMonthlyAllocation,
  consumeCredits,
  canAffordTool,
  purchaseCredits,
} from './credits';
import {
  recordRevenue,
  distributeRevenue,
  getTreasuryStatus,
  getTotalBurned,
} from './revenue';

// ============================================================================
// Tokenomics Manager - Unified Interface
// ============================================================================

export class TokenomicsManager {
  private userAccounts: Map<string, UserAccount> = new Map();

  /**
   * Get or create user account
   */
  async getAccount(wallet: string, tokenBalance?: TokenAmount): Promise<UserAccount> {
    let account = this.userAccounts.get(wallet);

    if (!account) {
      account = this.createAccount(wallet, tokenBalance || BigInt(0));
    } else if (tokenBalance !== undefined) {
      // Update token balance if provided
      await this.updateTokenBalance(wallet, tokenBalance);
      account = this.userAccounts.get(wallet)!;
    }

    return account;
  }

  /**
   * Create new user account
   */
  private createAccount(wallet: string, tokenBalance: TokenAmount): UserAccount {
    const stakes = getWalletStakes(wallet);
    const effectiveBalance = calculateEffectiveBalance(tokenBalance, stakes);
    const tier = calculateTier(effectiveBalance);
    const credits = getUserCredits(wallet);

    // Set monthly allocation based on tier
    setMonthlyAllocation(wallet, tier);

    const account: UserAccount = {
      wallet,
      tier,
      tokenBalance,
      stakedBalance: getWalletTotalStaked(wallet).staked,
      effectiveBalance,
      credits,
      stakes,
      referralCode: this.generateReferralCode(wallet),
      referralEarnings: BigInt(0),
      achievements: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
    };

    this.userAccounts.set(wallet, account);
    return account;
  }

  /**
   * Update user's token balance (from on-chain)
   */
  async updateTokenBalance(wallet: string, newBalance: TokenAmount): Promise<UserAccount> {
    const account = this.userAccounts.get(wallet) || this.createAccount(wallet, newBalance);

    account.tokenBalance = newBalance;
    account.effectiveBalance = calculateEffectiveBalance(newBalance, account.stakes);
    account.tier = calculateTier(account.effectiveBalance);
    account.lastActive = Date.now();

    // Update monthly allocation if tier changed
    setMonthlyAllocation(wallet, account.tier);

    this.userAccounts.set(wallet, account);
    return account;
  }

  /**
   * Stake tokens
   */
  async stake(
    wallet: string,
    amount: TokenAmount,
    duration: '7d' | '30d' | '90d' | '180d' | '365d'
  ): Promise<StakePosition> {
    const account = await this.getAccount(wallet);

    if (amount > account.tokenBalance) {
      throw new Error('Insufficient balance');
    }

    const stake = createStake(wallet, amount, duration);

    // Update account
    account.stakes = getWalletStakes(wallet);
    account.stakedBalance = getWalletTotalStaked(wallet).staked;
    account.effectiveBalance = calculateEffectiveBalance(account.tokenBalance, account.stakes);
    account.tier = calculateTier(account.effectiveBalance);

    this.userAccounts.set(wallet, account);
    return stake;
  }

  /**
   * Unstake tokens
   */
  async unstakePosition(wallet: string, stakeId: string): Promise<{
    returnAmount: TokenAmount;
    penalty: TokenAmount;
    rewards: TokenAmount;
  }> {
    const result = unstake(stakeId);

    // Update account
    const account = await this.getAccount(wallet);
    account.stakes = getWalletStakes(wallet);
    account.stakedBalance = getWalletTotalStaked(wallet).staked;
    account.effectiveBalance = calculateEffectiveBalance(account.tokenBalance, account.stakes);
    account.tier = calculateTier(account.effectiveBalance);

    this.userAccounts.set(wallet, account);

    return {
      returnAmount: result.returnAmount,
      penalty: result.penalty,
      rewards: result.rewards,
    };
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(wallet: string): Promise<TokenAmount> {
    return claimAllRewards(wallet);
  }

  /**
   * Check if user can use a tool
   */
  async canUseTool(
    wallet: string,
    toolName: string,
    toolCategory: 'basic' | 'advanced' | 'ai' | 'forensics' | 'enterprise'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    cost: number;
  }> {
    const account = await this.getAccount(wallet);

    // Check tier access
    if (!hasToolAccess(account.tier, toolCategory)) {
      return {
        allowed: false,
        reason: `${toolCategory} tools require ${this.getRequiredTierForCategory(toolCategory)} tier`,
        cost: 0,
      };
    }

    // Check credits
    const affordCheck = canAffordTool(wallet, toolName);
    if (!affordCheck.canAfford) {
      return {
        allowed: false,
        reason: `Insufficient credits. Need ${affordCheck.cost}, have ${affordCheck.balance + (affordCheck.monthlyRemaining === -1 ? Infinity : affordCheck.monthlyRemaining)}`,
        cost: affordCheck.cost,
      };
    }

    return {
      allowed: true,
      cost: affordCheck.cost,
    };
  }

  /**
   * Use a tool (consume credits)
   */
  async useTool(wallet: string, toolName: string): Promise<{
    success: boolean;
    creditsUsed: number;
    newBalance: number;
  }> {
    const result = consumeCredits(wallet, toolName);
    return {
      success: result.success,
      creditsUsed: result.creditsUsed,
      newBalance: result.newBalance,
    };
  }

  /**
   * Purchase credit pack
   */
  async purchaseCreditPack(wallet: string, packId: string): Promise<{
    creditsAdded: number;
    tokensCost: number;
    newBalance: number;
  }> {
    const account = await this.getAccount(wallet);
    return purchaseCredits(wallet, packId, account.tier);
  }

  /**
   * Check rate limits
   */
  async checkRateLimits(
    wallet: string,
    requestsThisMinute: number,
    requestsToday: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const account = await this.getAccount(wallet);
    return checkRateLimit(account.tier, requestsThisMinute, requestsToday);
  }

  /**
   * Get platform statistics
   */
  getStats(): {
    totalUsers: number;
    stakingPool: ReturnType<typeof getPoolStats>;
    treasury: ReturnType<typeof getTreasuryStatus>;
    totalBurned: TokenAmount;
    tierDistribution: Record<AccessTier, number>;
  } {
    const tierDistribution: Record<AccessTier, number> = {
      free: 0,
      basic: 0,
      pro: 0,
      enterprise: 0,
      whale: 0,
    };

    for (const account of this.userAccounts.values()) {
      tierDistribution[account.tier]++;
    }

    return {
      totalUsers: this.userAccounts.size,
      stakingPool: getPoolStats(),
      treasury: getTreasuryStatus(),
      totalBurned: getTotalBurned(),
      tierDistribution,
    };
  }

  /**
   * Trigger revenue distribution
   */
  async distributeRevenue(): Promise<ReturnType<typeof distributeRevenue>> {
    return distributeRevenue();
  }

  // Helper methods
  private generateReferralCode(wallet: string): string {
    return `REF-${wallet.slice(0, 6).toUpperCase()}`;
  }

  private getRequiredTierForCategory(category: string): string {
    switch (category) {
      case 'basic': return 'Free';
      case 'advanced': return 'Basic';
      case 'ai': return 'Pro';
      case 'forensics': return 'Pro';
      case 'enterprise': return 'Enterprise';
      default: return 'Free';
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const tokenomics = new TokenomicsManager();

// ============================================================================
// Utility Functions
// ============================================================================

export function formatTokenAmount(amount: TokenAmount): string {
  const value = fromTokenAmount(amount);
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

export function getTierEmoji(tier: AccessTier): string {
  const emojis: Record<AccessTier, string> = {
    free: '',
    basic: '',
    pro: '',
    enterprise: '',
    whale: '',
  };
  return emojis[tier];
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  TokenomicsManager,
  tokenomics,
  formatTokenAmount,
  getTierEmoji,
};
