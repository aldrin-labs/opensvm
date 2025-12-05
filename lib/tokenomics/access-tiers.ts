/**
 * SVMAI Tokenomics - Access Tier System
 *
 * Manages user access tiers based on token holdings and staking.
 */

import {
  AccessTier,
  TierConfig,
  TierBenefits,
  TIER_CONFIGS,
  TokenAmount,
  fromTokenAmount,
  StakePosition,
  STAKE_CONFIGS,
} from './types';

// ============================================================================
// Tier Calculation
// ============================================================================

/**
 * Calculate effective balance including staking multipliers
 */
export function calculateEffectiveBalance(
  tokenBalance: TokenAmount,
  stakes: StakePosition[]
): TokenAmount {
  let effective = tokenBalance;

  for (const stake of stakes) {
    if (stake.status === 'active') {
      // Add the multiplied stake amount
      effective += stake.effectiveAmount;
    }
  }

  return effective;
}

/**
 * Determine access tier based on effective token balance
 */
export function calculateTier(effectiveBalance: TokenAmount): AccessTier {
  const balance = fromTokenAmount(effectiveBalance);

  // Check tiers from highest to lowest
  for (let i = TIER_CONFIGS.length - 1; i >= 0; i--) {
    if (balance >= TIER_CONFIGS[i].minTokens) {
      return TIER_CONFIGS[i].tier;
    }
  }

  return 'free';
}

/**
 * Get tier configuration
 */
export function getTierConfig(tier: AccessTier): TierConfig {
  const config = TIER_CONFIGS.find(t => t.tier === tier);
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  return config;
}

/**
 * Get tier benefits
 */
export function getTierBenefits(tier: AccessTier): TierBenefits {
  return getTierConfig(tier).benefits;
}

/**
 * Check if a tier has access to a specific tool category
 */
export function hasToolAccess(
  tier: AccessTier,
  toolCategory: 'basic' | 'advanced' | 'ai' | 'forensics' | 'enterprise'
): boolean {
  const benefits = getTierBenefits(tier);

  switch (toolCategory) {
    case 'basic':
      return benefits.basicTools;
    case 'advanced':
      return benefits.advancedTools;
    case 'ai':
      return benefits.aiTools;
    case 'forensics':
      return benefits.forensicsTools;
    case 'enterprise':
      return benefits.enterpriseTools;
    default:
      return false;
  }
}

/**
 * Check rate limit for a tier
 */
export function checkRateLimit(
  tier: AccessTier,
  requestsThisMinute: number,
  requestsToday: number
): { allowed: boolean; reason?: string } {
  const benefits = getTierBenefits(tier);

  // -1 means unlimited
  if (benefits.requestsPerMinute !== -1 && requestsThisMinute >= benefits.requestsPerMinute) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${benefits.requestsPerMinute} requests per minute`,
    };
  }

  if (benefits.requestsPerDay !== -1 && requestsToday >= benefits.requestsPerDay) {
    return {
      allowed: false,
      reason: `Daily limit exceeded: ${benefits.requestsPerDay} requests per day`,
    };
  }

  return { allowed: true };
}

/**
 * Get tokens needed for next tier
 */
export function getTokensForNextTier(currentTier: AccessTier): {
  nextTier: AccessTier | null;
  tokensNeeded: number;
} {
  const currentIndex = TIER_CONFIGS.findIndex(t => t.tier === currentTier);

  if (currentIndex === TIER_CONFIGS.length - 1) {
    return { nextTier: null, tokensNeeded: 0 };
  }

  const nextConfig = TIER_CONFIGS[currentIndex + 1];
  const currentConfig = TIER_CONFIGS[currentIndex];

  return {
    nextTier: nextConfig.tier,
    tokensNeeded: nextConfig.minTokens - currentConfig.minTokens,
  };
}

/**
 * Calculate tier progress percentage
 */
export function getTierProgress(effectiveBalance: TokenAmount): {
  currentTier: AccessTier;
  progress: number;
  nextTier: AccessTier | null;
  tokensToNext: number;
} {
  const balance = fromTokenAmount(effectiveBalance);
  const currentTier = calculateTier(effectiveBalance);
  const currentIndex = TIER_CONFIGS.findIndex(t => t.tier === currentTier);

  if (currentIndex === TIER_CONFIGS.length - 1) {
    return {
      currentTier,
      progress: 100,
      nextTier: null,
      tokensToNext: 0,
    };
  }

  const currentMin = TIER_CONFIGS[currentIndex].minTokens;
  const nextMin = TIER_CONFIGS[currentIndex + 1].minTokens;
  const nextTier = TIER_CONFIGS[currentIndex + 1].tier;

  const progress = ((balance - currentMin) / (nextMin - currentMin)) * 100;
  const tokensToNext = nextMin - balance;

  return {
    currentTier,
    progress: Math.min(100, Math.max(0, progress)),
    nextTier,
    tokensToNext: Math.max(0, tokensToNext),
  };
}

// ============================================================================
// Access Control Middleware
// ============================================================================

export interface AccessCheckResult {
  allowed: boolean;
  tier: AccessTier;
  reason?: string;
  upgradeRequired?: AccessTier;
}

/**
 * Check if user can access a specific feature
 */
export function checkFeatureAccess(
  tier: AccessTier,
  feature: keyof TierBenefits
): AccessCheckResult {
  const benefits = getTierBenefits(tier);
  const value = benefits[feature];

  // Boolean features
  if (typeof value === 'boolean') {
    if (value) {
      return { allowed: true, tier };
    }

    // Find minimum tier that has this feature
    for (const config of TIER_CONFIGS) {
      const configValue = config.benefits[feature];
      if (typeof configValue === 'boolean' && configValue) {
        return {
          allowed: false,
          tier,
          reason: `${feature} requires ${config.name} tier or higher`,
          upgradeRequired: config.tier,
        };
      }
    }
  }

  // Numeric features (-1 = unlimited)
  if (typeof value === 'number') {
    if (value === -1 || value > 0) {
      return { allowed: true, tier };
    }
  }

  return {
    allowed: false,
    tier,
    reason: `Feature ${feature} not available in ${tier} tier`,
  };
}

/**
 * Get all features available for a tier
 */
export function getAvailableFeatures(tier: AccessTier): string[] {
  const benefits = getTierBenefits(tier);
  const features: string[] = [];

  for (const [key, value] of Object.entries(benefits)) {
    if (typeof value === 'boolean' && value) {
      features.push(key);
    } else if (typeof value === 'number' && (value === -1 || value > 0)) {
      features.push(key);
    }
  }

  return features;
}

/**
 * Compare two tiers
 */
export function compareTiers(tierA: AccessTier, tierB: AccessTier): number {
  const indexA = TIER_CONFIGS.findIndex(t => t.tier === tierA);
  const indexB = TIER_CONFIGS.findIndex(t => t.tier === tierB);
  return indexA - indexB;
}

/**
 * Check if tierA is at least as high as tierB
 */
export function isAtLeastTier(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return compareTiers(userTier, requiredTier) >= 0;
}

// ============================================================================
// Tier Display Helpers
// ============================================================================

export function getTierBadge(tier: AccessTier): { name: string; color: string; icon: string } {
  const config = getTierConfig(tier);

  const icons: Record<AccessTier, string> = {
    free: '🆓',
    basic: '🔵',
    pro: '💜',
    enterprise: '🏢',
    whale: '🐋',
  };

  return {
    name: config.name,
    color: config.color,
    icon: icons[tier],
  };
}

export function formatTierComparison(): string {
  const rows: string[] = [];
  rows.push('| Feature | Free | Basic | Pro | Enterprise | Whale |');
  rows.push('|---------|------|-------|-----|------------|-------|');

  const features: (keyof TierBenefits)[] = [
    'requestsPerMinute',
    'requestsPerDay',
    'historicalDataDays',
    'advancedTools',
    'aiTools',
    'forensicsTools',
    'priorityQueue',
    'apiKeys',
    'teamMembers',
    'monthlyCredits',
  ];

  for (const feature of features) {
    const values = TIER_CONFIGS.map(config => {
      const value = config.benefits[feature];
      if (typeof value === 'boolean') return value ? '✓' : '✗';
      if (value === -1) return '∞';
      return String(value);
    });

    rows.push(`| ${feature} | ${values.join(' | ')} |`);
  }

  return rows.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export default {
  calculateEffectiveBalance,
  calculateTier,
  getTierConfig,
  getTierBenefits,
  hasToolAccess,
  checkRateLimit,
  getTokensForNextTier,
  getTierProgress,
  checkFeatureAccess,
  getAvailableFeatures,
  compareTiers,
  isAtLeastTier,
  getTierBadge,
  formatTierComparison,
};
