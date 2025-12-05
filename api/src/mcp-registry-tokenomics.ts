/**
 * MCP Registry Tokenomics Integration
 *
 * Connects the MCP registry to the SVMAI tokenomics system for:
 * - Premium server listings
 * - Featured placement based on token staking
 * - Verified author badges
 * - Revenue sharing for tool creators
 * - Access tier gating for tools
 */

import { UnifiedMCPRegistry, type UnifiedServer, type RegisteredTool } from './mcp-registry-unified.js';

// ============================================================================
// Types
// ============================================================================

export type SponsorTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface PremiumListing {
  serverId: string;
  sponsorTier: SponsorTier;
  featured: boolean;
  verifiedAuthor: boolean;
  stakeAmount: bigint;
  stakeDuration: string;
  expiresAt: number;
  benefits: {
    prioritySupport: boolean;
    customBranding: boolean;
    analyticsAccess: boolean;
    apiRateBoost: number;  // Multiplier
    featuredPlacement: number;  // Days
  };
}

export interface ToolRevenue {
  toolId: string;
  serverId: string;
  creatorWallet: string;
  totalCalls: number;
  totalRevenue: bigint;
  lastPayout: number;
  pendingPayout: bigint;
}

export interface AccessGate {
  toolName: string;
  requiredTier: 'free' | 'basic' | 'pro' | 'enterprise' | 'whale';
  creditCost: number;
  stakingRequired?: bigint;
}

// ============================================================================
// Sponsor Tier Configuration
// ============================================================================

export const SPONSOR_TIER_CONFIG: Record<SponsorTier, {
  minStake: bigint;
  minDuration: string;
  benefits: PremiumListing['benefits'];
  monthlyFee: bigint;
}> = {
  bronze: {
    minStake: BigInt(1000) * BigInt(1e9),  // 1,000 tokens
    minDuration: '30d',
    benefits: {
      prioritySupport: false,
      customBranding: false,
      analyticsAccess: false,
      apiRateBoost: 1.25,
      featuredPlacement: 0,
    },
    monthlyFee: BigInt(100) * BigInt(1e9),
  },
  silver: {
    minStake: BigInt(5000) * BigInt(1e9),  // 5,000 tokens
    minDuration: '90d',
    benefits: {
      prioritySupport: true,
      customBranding: false,
      analyticsAccess: true,
      apiRateBoost: 1.5,
      featuredPlacement: 7,
    },
    monthlyFee: BigInt(500) * BigInt(1e9),
  },
  gold: {
    minStake: BigInt(25000) * BigInt(1e9),  // 25,000 tokens
    minDuration: '180d',
    benefits: {
      prioritySupport: true,
      customBranding: true,
      analyticsAccess: true,
      apiRateBoost: 2.0,
      featuredPlacement: 14,
    },
    monthlyFee: BigInt(2000) * BigInt(1e9),
  },
  platinum: {
    minStake: BigInt(100000) * BigInt(1e9),  // 100,000 tokens
    minDuration: '365d',
    benefits: {
      prioritySupport: true,
      customBranding: true,
      analyticsAccess: true,
      apiRateBoost: 3.0,
      featuredPlacement: 30,
    },
    monthlyFee: BigInt(5000) * BigInt(1e9),
  },
};

// ============================================================================
// Tool Category Credit Costs
// ============================================================================

export const TOOL_CREDIT_COSTS: Record<string, number> = {
  // Basic tools (1-5 credits)
  'get_network_status': 1,
  'search': 2,
  'get_token_metadata': 1,
  'get_blocks': 2,

  // Advanced tools (5-15 credits)
  'get_account_portfolio': 5,
  'get_account_transactions': 10,
  'get_token_ohlcv': 5,
  'get_token_markets': 5,

  // AI tools (15-50 credits)
  'ask_ai': 25,
  'investigate': 50,
  'analyze_transaction': 30,

  // Enterprise tools (50-100 credits)
  'forensic_analysis': 75,
  'batch_execute': 50,
  'create_pipeline': 100,

  // Default
  'default': 5,
};

// ============================================================================
// Access Tier Requirements
// ============================================================================

export const TOOL_ACCESS_TIERS: Record<string, AccessGate['requiredTier']> = {
  // Free tier tools
  'get_network_status': 'free',
  'search': 'free',
  'get_token_metadata': 'free',

  // Basic tier tools
  'get_account_portfolio': 'basic',
  'get_blocks': 'basic',
  'get_token_ohlcv': 'basic',

  // Pro tier tools
  'ask_ai': 'pro',
  'get_account_transactions': 'pro',
  'analyze_transaction': 'pro',

  // Enterprise tier tools
  'investigate': 'enterprise',
  'forensic_analysis': 'enterprise',
  'batch_execute': 'enterprise',
  'create_pipeline': 'enterprise',

  // Whale tier tools
  'api_key_unlimited': 'whale',
};

// ============================================================================
// Revenue Distribution
// ============================================================================

export const REVENUE_SPLIT = {
  creator: 70,      // 70% to tool creator
  platform: 20,     // 20% to platform
  stakers: 10,      // 10% to staking pool
} as const;

// ============================================================================
// Registry Tokenomics Manager
// ============================================================================

export class RegistryTokenomics {
  private premiumListings = new Map<string, PremiumListing>();
  private toolRevenue = new Map<string, ToolRevenue>();
  private accessGates = new Map<string, AccessGate>();
  private registry: UnifiedMCPRegistry;

  constructor(registry: UnifiedMCPRegistry) {
    this.registry = registry;
    this.initializeAccessGates();
  }

  private initializeAccessGates(): void {
    for (const [toolName, tier] of Object.entries(TOOL_ACCESS_TIERS)) {
      this.accessGates.set(toolName, {
        toolName,
        requiredTier: tier,
        creditCost: TOOL_CREDIT_COSTS[toolName] || TOOL_CREDIT_COSTS['default'],
      });
    }
  }

  // ==========================================================================
  // Premium Listings
  // ==========================================================================

  /**
   * Create or upgrade a premium listing
   */
  createPremiumListing(
    serverId: string,
    tier: SponsorTier,
    wallet: string,
    stakeAmount: bigint,
    stakeDuration: string
  ): PremiumListing {
    const config = SPONSOR_TIER_CONFIG[tier];

    // Validate stake amount
    if (stakeAmount < config.minStake) {
      throw new Error(
        `Insufficient stake for ${tier} tier. Required: ${config.minStake}, provided: ${stakeAmount}`
      );
    }

    // Calculate expiration (based on stake duration)
    const durationDays = parseInt(stakeDuration);
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

    const listing: PremiumListing = {
      serverId,
      sponsorTier: tier,
      featured: config.benefits.featuredPlacement > 0,
      verifiedAuthor: tier === 'gold' || tier === 'platinum',
      stakeAmount,
      stakeDuration,
      expiresAt,
      benefits: config.benefits,
    };

    this.premiumListings.set(serverId, listing);

    // Update server premium status
    this.registry.update(serverId, {
      premium: {
        featured: listing.featured,
        verifiedAuthor: listing.verifiedAuthor,
        sponsorTier: tier,
      },
    });

    console.log(`[Tokenomics] Premium listing created: ${serverId} (${tier})`);
    return listing;
  }

  /**
   * Get premium listing for a server
   */
  getPremiumListing(serverId: string): PremiumListing | null {
    const listing = this.premiumListings.get(serverId);
    if (!listing) return null;

    // Check expiration
    if (listing.expiresAt < Date.now()) {
      this.expireListing(serverId);
      return null;
    }

    return listing;
  }

  /**
   * Expire a premium listing
   */
  private expireListing(serverId: string): void {
    this.premiumListings.delete(serverId);
    this.registry.update(serverId, {
      premium: {
        featured: false,
        verifiedAuthor: false,
        sponsorTier: undefined,
      },
    });
    console.log(`[Tokenomics] Premium listing expired: ${serverId}`);
  }

  /**
   * Get all featured servers
   */
  getFeaturedServers(): UnifiedServer[] {
    const featured: UnifiedServer[] = [];
    const now = Date.now();

    for (const [serverId, listing] of this.premiumListings) {
      if (listing.expiresAt > now && listing.featured) {
        const server = this.registry.get(serverId);
        if (server) featured.push(server);
      }
    }

    // Sort by tier (platinum first)
    const tierOrder: Record<SponsorTier, number> = {
      platinum: 0,
      gold: 1,
      silver: 2,
      bronze: 3,
    };

    return featured.sort((a, b) => {
      const tierA = this.premiumListings.get(a.id)?.sponsorTier || 'bronze';
      const tierB = this.premiumListings.get(b.id)?.sponsorTier || 'bronze';
      return tierOrder[tierA] - tierOrder[tierB];
    });
  }

  // ==========================================================================
  // Access Control
  // ==========================================================================

  /**
   * Check if a user can access a tool
   */
  canAccessTool(
    toolName: string,
    userTier: 'free' | 'basic' | 'pro' | 'enterprise' | 'whale',
    userCredits: number
  ): {
    allowed: boolean;
    reason?: string;
    creditCost: number;
  } {
    const gate = this.accessGates.get(toolName) || {
      toolName,
      requiredTier: 'free' as const,
      creditCost: TOOL_CREDIT_COSTS['default'],
    };

    // Check tier access
    const tierOrder = ['free', 'basic', 'pro', 'enterprise', 'whale'];
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(gate.requiredTier);

    if (userTierIndex < requiredTierIndex) {
      return {
        allowed: false,
        reason: `Tool requires ${gate.requiredTier} tier or higher`,
        creditCost: gate.creditCost,
      };
    }

    // Check credits (enterprise and whale have unlimited)
    if (userTier !== 'enterprise' && userTier !== 'whale') {
      if (userCredits < gate.creditCost) {
        return {
          allowed: false,
          reason: `Insufficient credits. Need ${gate.creditCost}, have ${userCredits}`,
          creditCost: gate.creditCost,
        };
      }
    }

    return {
      allowed: true,
      creditCost: gate.creditCost,
    };
  }

  /**
   * Set custom access gate for a tool
   */
  setAccessGate(gate: AccessGate): void {
    this.accessGates.set(gate.toolName, gate);
  }

  /**
   * Get access gate for a tool
   */
  getAccessGate(toolName: string): AccessGate {
    return this.accessGates.get(toolName) || {
      toolName,
      requiredTier: 'free',
      creditCost: TOOL_CREDIT_COSTS['default'],
    };
  }

  // ==========================================================================
  // Revenue Tracking
  // ==========================================================================

  /**
   * Record tool usage for revenue tracking
   */
  recordToolUsage(
    tool: RegisteredTool,
    creatorWallet: string,
    creditsPaid: number
  ): void {
    const key = `${tool.serverId}:${tool.name}`;
    let revenue = this.toolRevenue.get(key);

    if (!revenue) {
      revenue = {
        toolId: tool.qualifiedName,
        serverId: tool.serverId,
        creatorWallet,
        totalCalls: 0,
        totalRevenue: BigInt(0),
        lastPayout: 0,
        pendingPayout: BigInt(0),
      };
      this.toolRevenue.set(key, revenue);
    }

    // Convert credits to tokens (1 credit = 0.01 tokens)
    const tokenValue = BigInt(creditsPaid) * BigInt(1e7);  // 0.01 * 1e9

    revenue.totalCalls++;
    revenue.totalRevenue += tokenValue;

    // Calculate creator share
    const creatorShare = (tokenValue * BigInt(REVENUE_SPLIT.creator)) / BigInt(100);
    revenue.pendingPayout += creatorShare;
  }

  /**
   * Get revenue stats for a tool
   */
  getToolRevenue(serverId: string, toolName: string): ToolRevenue | null {
    return this.toolRevenue.get(`${serverId}:${toolName}`) || null;
  }

  /**
   * Get all revenue for a server
   */
  getServerRevenue(serverId: string): {
    totalCalls: number;
    totalRevenue: bigint;
    pendingPayout: bigint;
    tools: ToolRevenue[];
  } {
    const tools: ToolRevenue[] = [];
    let totalCalls = 0;
    let totalRevenue = BigInt(0);
    let pendingPayout = BigInt(0);

    for (const [key, revenue] of this.toolRevenue) {
      if (revenue.serverId === serverId) {
        tools.push(revenue);
        totalCalls += revenue.totalCalls;
        totalRevenue += revenue.totalRevenue;
        pendingPayout += revenue.pendingPayout;
      }
    }

    return { totalCalls, totalRevenue, pendingPayout, tools };
  }

  /**
   * Process payout for a creator
   */
  processPayout(serverId: string): {
    amount: bigint;
    toolsProcessed: number;
  } {
    let amount = BigInt(0);
    let toolsProcessed = 0;

    for (const [key, revenue] of this.toolRevenue) {
      if (revenue.serverId === serverId && revenue.pendingPayout > BigInt(0)) {
        amount += revenue.pendingPayout;
        revenue.pendingPayout = BigInt(0);
        revenue.lastPayout = Date.now();
        toolsProcessed++;
      }
    }

    console.log(`[Tokenomics] Processed payout for ${serverId}: ${amount} tokens`);
    return { amount, toolsProcessed };
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get tokenomics statistics
   */
  getStats(): {
    premiumListings: number;
    featuredServers: number;
    totalToolRevenue: bigint;
    totalPendingPayouts: bigint;
    tierDistribution: Record<SponsorTier, number>;
  } {
    const tierDistribution: Record<SponsorTier, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };

    let featuredCount = 0;
    const now = Date.now();

    for (const listing of this.premiumListings.values()) {
      if (listing.expiresAt > now) {
        tierDistribution[listing.sponsorTier]++;
        if (listing.featured) featuredCount++;
      }
    }

    let totalRevenue = BigInt(0);
    let totalPending = BigInt(0);

    for (const revenue of this.toolRevenue.values()) {
      totalRevenue += revenue.totalRevenue;
      totalPending += revenue.pendingPayout;
    }

    return {
      premiumListings: this.premiumListings.size,
      featuredServers: featuredCount,
      totalToolRevenue: totalRevenue,
      totalPendingPayouts: totalPending,
      tierDistribution,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const registryTokenomics = {
  RegistryTokenomics,
  SPONSOR_TIER_CONFIG,
  TOOL_CREDIT_COSTS,
  TOOL_ACCESS_TIERS,
  REVENUE_SPLIT,
};
