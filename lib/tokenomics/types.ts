/**
 * SVMAI Tokenomics - Type Definitions
 *
 * Comprehensive type system for the $SVMAI token utility platform.
 */

// ============================================================================
// Core Token Types
// ============================================================================

export const SVMAI_DECIMALS = 9;
export const SVMAI_MINT = 'svmai...'; // TODO: Replace with actual mint address

export type TokenAmount = bigint;

export function toTokenAmount(amount: number): TokenAmount {
  return BigInt(Math.floor(amount * Math.pow(10, SVMAI_DECIMALS)));
}

export function fromTokenAmount(amount: TokenAmount): number {
  return Number(amount) / Math.pow(10, SVMAI_DECIMALS);
}

// ============================================================================
// Access Tiers
// ============================================================================

export type AccessTier = 'free' | 'basic' | 'pro' | 'enterprise' | 'whale';

export interface TierConfig {
  tier: AccessTier;
  minTokens: number;
  name: string;
  description: string;
  color: string;
  benefits: TierBenefits;
}

export interface TierBenefits {
  // Rate Limits
  requestsPerMinute: number;
  requestsPerDay: number;
  concurrentConnections: number;

  // Data Access
  historicalDataDays: number;
  maxResultsPerQuery: number;

  // Tool Access
  basicTools: boolean;
  advancedTools: boolean;
  aiTools: boolean;
  forensicsTools: boolean;
  enterpriseTools: boolean;

  // Features
  priorityQueue: boolean;
  customAlerts: number;
  apiKeys: number;
  teamMembers: number;
  whiteLabel: boolean;
  dedicatedSupport: boolean;
  slaGuarantee: boolean;

  // Credits
  monthlyCredits: number;
  creditDiscount: number; // percentage
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 'free',
    minTokens: 0,
    name: 'Free',
    description: 'Basic access for exploration',
    color: '#9CA3AF',
    benefits: {
      requestsPerMinute: 10,
      requestsPerDay: 100,
      concurrentConnections: 1,
      historicalDataDays: 7,
      maxResultsPerQuery: 50,
      basicTools: true,
      advancedTools: false,
      aiTools: false,
      forensicsTools: false,
      enterpriseTools: false,
      priorityQueue: false,
      customAlerts: 0,
      apiKeys: 1,
      teamMembers: 1,
      whiteLabel: false,
      dedicatedSupport: false,
      slaGuarantee: false,
      monthlyCredits: 100,
      creditDiscount: 0,
    },
  },
  {
    tier: 'basic',
    minTokens: 100,
    name: 'Basic',
    description: 'For casual users and researchers',
    color: '#60A5FA',
    benefits: {
      requestsPerMinute: 30,
      requestsPerDay: 1000,
      concurrentConnections: 3,
      historicalDataDays: 30,
      maxResultsPerQuery: 200,
      basicTools: true,
      advancedTools: true,
      aiTools: false,
      forensicsTools: false,
      enterpriseTools: false,
      priorityQueue: false,
      customAlerts: 5,
      apiKeys: 3,
      teamMembers: 1,
      whiteLabel: false,
      dedicatedSupport: false,
      slaGuarantee: false,
      monthlyCredits: 500,
      creditDiscount: 5,
    },
  },
  {
    tier: 'pro',
    minTokens: 1000,
    name: 'Pro',
    description: 'For power users and developers',
    color: '#A78BFA',
    benefits: {
      requestsPerMinute: 100,
      requestsPerDay: 10000,
      concurrentConnections: 10,
      historicalDataDays: 90,
      maxResultsPerQuery: 1000,
      basicTools: true,
      advancedTools: true,
      aiTools: true,
      forensicsTools: true,
      enterpriseTools: false,
      priorityQueue: true,
      customAlerts: 25,
      apiKeys: 10,
      teamMembers: 5,
      whiteLabel: false,
      dedicatedSupport: false,
      slaGuarantee: false,
      monthlyCredits: 2500,
      creditDiscount: 10,
    },
  },
  {
    tier: 'enterprise',
    minTokens: 10000,
    name: 'Enterprise',
    description: 'For teams and businesses',
    color: '#F59E0B',
    benefits: {
      requestsPerMinute: 500,
      requestsPerDay: 100000,
      concurrentConnections: 50,
      historicalDataDays: 365,
      maxResultsPerQuery: 10000,
      basicTools: true,
      advancedTools: true,
      aiTools: true,
      forensicsTools: true,
      enterpriseTools: true,
      priorityQueue: true,
      customAlerts: 100,
      apiKeys: 50,
      teamMembers: 25,
      whiteLabel: true,
      dedicatedSupport: true,
      slaGuarantee: true,
      monthlyCredits: 15000,
      creditDiscount: 20,
    },
  },
  {
    tier: 'whale',
    minTokens: 100000,
    name: 'Whale',
    description: 'Unlimited access for major holders',
    color: '#EF4444',
    benefits: {
      requestsPerMinute: -1, // unlimited
      requestsPerDay: -1,
      concurrentConnections: -1,
      historicalDataDays: -1, // all time
      maxResultsPerQuery: -1,
      basicTools: true,
      advancedTools: true,
      aiTools: true,
      forensicsTools: true,
      enterpriseTools: true,
      priorityQueue: true,
      customAlerts: -1,
      apiKeys: -1,
      teamMembers: -1,
      whiteLabel: true,
      dedicatedSupport: true,
      slaGuarantee: true,
      monthlyCredits: -1, // unlimited
      creditDiscount: 30,
    },
  },
];

// ============================================================================
// Staking Types
// ============================================================================

export type StakeDuration = '7d' | '30d' | '90d' | '180d' | '365d';

export interface StakeConfig {
  duration: StakeDuration;
  durationDays: number;
  multiplier: number; // e.g., 1.0, 1.5, 2.0
  earlyUnstakePenalty: number; // percentage
  rewardBoost: number; // percentage boost on staking rewards
}

export const STAKE_CONFIGS: StakeConfig[] = [
  { duration: '7d', durationDays: 7, multiplier: 1.0, earlyUnstakePenalty: 0, rewardBoost: 0 },
  { duration: '30d', durationDays: 30, multiplier: 1.25, earlyUnstakePenalty: 5, rewardBoost: 10 },
  { duration: '90d', durationDays: 90, multiplier: 1.5, earlyUnstakePenalty: 10, rewardBoost: 25 },
  { duration: '180d', durationDays: 180, multiplier: 1.75, earlyUnstakePenalty: 15, rewardBoost: 50 },
  { duration: '365d', durationDays: 365, multiplier: 2.0, earlyUnstakePenalty: 20, rewardBoost: 100 },
];

export interface StakePosition {
  id: string;
  wallet: string;
  amount: TokenAmount;
  duration: StakeDuration;
  startTime: number;
  endTime: number;
  multiplier: number;
  effectiveAmount: TokenAmount; // amount * multiplier
  rewards: TokenAmount;
  claimed: TokenAmount;
  status: 'active' | 'unlocked' | 'withdrawn';
}

// ============================================================================
// Credits System
// ============================================================================

export type ToolCategory = 'basic' | 'advanced' | 'ai' | 'forensics' | 'enterprise';

export interface ToolCreditCost {
  toolName: string;
  category: ToolCategory;
  baseCost: number; // credits
  computeMultiplier: number; // for complex queries
  description: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceTokens: number;
  bonusCredits: number;
  discount: number; // percentage
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', name: 'Starter', credits: 500, priceTokens: 50, bonusCredits: 0, discount: 0 },
  { id: 'basic', name: 'Basic', credits: 2500, priceTokens: 225, bonusCredits: 250, discount: 10, popular: true },
  { id: 'pro', name: 'Pro', credits: 10000, priceTokens: 800, bonusCredits: 2000, discount: 20 },
  { id: 'enterprise', name: 'Enterprise', credits: 50000, priceTokens: 3500, bonusCredits: 15000, discount: 30 },
];

export interface UserCredits {
  wallet: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  totalEarned: number; // from rewards, referrals, etc.
  monthlyAllocation: number;
  monthlyUsed: number;
  resetDate: number;
}

// ============================================================================
// Subscription Types
// ============================================================================

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'annual' | 'lifetime';

export interface SubscriptionConfig {
  plan: SubscriptionPlan;
  name: string;
  durationDays: number;
  priceTokens: number;
  discount: number;
  tier: AccessTier;
  features: string[];
}

export const SUBSCRIPTION_CONFIGS: SubscriptionConfig[] = [
  {
    plan: 'monthly',
    name: 'Monthly Pro',
    durationDays: 30,
    priceTokens: 100,
    discount: 0,
    tier: 'pro',
    features: ['All Pro features', 'Cancel anytime', '2,500 credits/month'],
  },
  {
    plan: 'quarterly',
    name: 'Quarterly Pro',
    durationDays: 90,
    priceTokens: 270,
    discount: 10,
    tier: 'pro',
    features: ['All Pro features', '10% discount', '7,500 credits/quarter'],
  },
  {
    plan: 'annual',
    name: 'Annual Pro',
    durationDays: 365,
    priceTokens: 960,
    discount: 20,
    tier: 'pro',
    features: ['All Pro features', '2 months free', '30,000 credits/year', 'Priority support'],
  },
  {
    plan: 'lifetime',
    name: 'Lifetime Access',
    durationDays: -1,
    priceTokens: 5000,
    discount: 0,
    tier: 'enterprise',
    features: ['Permanent Enterprise access', 'All future features', 'Unlimited credits', 'Founding member badge'],
  },
];

export interface Subscription {
  id: string;
  wallet: string;
  plan: SubscriptionPlan;
  tier: AccessTier;
  startTime: number;
  endTime: number; // -1 for lifetime
  autoRenew: boolean;
  status: 'active' | 'cancelled' | 'expired';
  paymentHistory: Payment[];
}

export interface Payment {
  id: string;
  timestamp: number;
  amount: TokenAmount;
  type: 'subscription' | 'credits' | 'marketplace' | 'feature';
  description: string;
  txSignature?: string;
}

// ============================================================================
// Marketplace Types
// ============================================================================

export interface MarketplaceToolListing {
  id: string;
  authorWallet: string;
  toolName: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  pricePerCall: number; // credits
  monthlyPrice?: number; // tokens for unlimited
  revenueShare: number; // percentage to author (default 70%)
  totalRevenue: TokenAmount;
  totalCalls: number;
  rating: number;
  verified: boolean;
  featured: boolean;
  featuredUntil?: number;
  createdAt: number;
}

export interface ToolPurchase {
  id: string;
  buyerWallet: string;
  toolId: string;
  type: 'per_call' | 'monthly' | 'lifetime';
  amount: TokenAmount;
  credits: number;
  timestamp: number;
}

// ============================================================================
// Revenue Distribution
// ============================================================================

export interface RevenueConfig {
  platformShare: number; // percentage (default 30%)
  creatorShare: number; // percentage (default 70%)
  burnRate: number; // percentage of platform share to burn (default 10%)
  stakingRewards: number; // percentage of platform share to stakers (default 40%)
  treasuryShare: number; // percentage to DAO treasury (default 20%)
  teamShare: number; // percentage to team (default 30%)
}

export const DEFAULT_REVENUE_CONFIG: RevenueConfig = {
  platformShare: 30,
  creatorShare: 70,
  burnRate: 10,
  stakingRewards: 40,
  treasuryShare: 20,
  teamShare: 30,
};

export interface RevenueReport {
  period: string; // e.g., "2024-12"
  totalRevenue: TokenAmount;
  breakdown: {
    subscriptions: TokenAmount;
    credits: TokenAmount;
    marketplace: TokenAmount;
    enterprise: TokenAmount;
    premium: TokenAmount;
  };
  distribution: {
    burned: TokenAmount;
    stakingRewards: TokenAmount;
    treasury: TokenAmount;
    team: TokenAmount;
    creators: TokenAmount;
  };
}

// ============================================================================
// User Account Types
// ============================================================================

export interface UserAccount {
  wallet: string;
  tier: AccessTier;
  tokenBalance: TokenAmount;
  stakedBalance: TokenAmount;
  effectiveBalance: TokenAmount; // tokens + (staked * multiplier)
  credits: UserCredits;
  subscription?: Subscription;
  stakes: StakePosition[];
  referralCode: string;
  referredBy?: string;
  referralEarnings: TokenAmount;
  achievements: Achievement[];
  createdAt: number;
  lastActive: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: number;
  burnCost?: number; // tokens burned to unlock
}

// ============================================================================
// Referral System
// ============================================================================

export interface ReferralConfig {
  rewardPercentage: number; // percentage of referee's spend
  rewardDurationDays: number; // how long rewards last
  minPurchaseForReward: number; // minimum purchase to trigger reward
  maxRewardsPerReferrer: number; // cap on total rewards
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  rewardPercentage: 10,
  rewardDurationDays: 365,
  minPurchaseForReward: 10,
  maxRewardsPerReferrer: 10000,
};

export interface Referral {
  id: string;
  referrerWallet: string;
  refereeWallet: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  totalRewards: TokenAmount;
  status: 'active' | 'expired' | 'capped';
}

// ============================================================================
// Governance Types
// ============================================================================

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: 'parameter' | 'feature' | 'treasury' | 'emergency';
  status: 'pending' | 'active' | 'passed' | 'rejected' | 'executed';
  votesFor: TokenAmount;
  votesAgainst: TokenAmount;
  quorum: TokenAmount;
  startTime: number;
  endTime: number;
  executionTime?: number;
}

export interface Vote {
  proposalId: string;
  voter: string;
  amount: TokenAmount;
  support: boolean;
  timestamp: number;
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  TokenAmount,
  AccessTier,
  TierConfig,
  TierBenefits,
  StakeDuration,
  StakeConfig,
  StakePosition,
  ToolCategory,
  ToolCreditCost,
  CreditPack,
  UserCredits,
  SubscriptionPlan,
  SubscriptionConfig,
  Subscription,
  Payment,
  MarketplaceToolListing,
  ToolPurchase,
  RevenueConfig,
  RevenueReport,
  UserAccount,
  Achievement,
  ReferralConfig,
  Referral,
  GovernanceProposal,
  Vote,
};
