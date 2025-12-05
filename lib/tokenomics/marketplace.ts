/**
 * SVMAI Tokenomics - Marketplace Economics
 *
 * Handles tool listings, creator royalties, and marketplace revenue.
 */

import {
  MarketplaceToolListing,
  ToolPurchase,
  ToolCategory,
  TokenAmount,
  toTokenAmount,
  fromTokenAmount,
  RevenueConfig,
  DEFAULT_REVENUE_CONFIG,
} from './types';

// ============================================================================
// In-Memory Store (Replace with database in production)
// ============================================================================

const toolListings: Map<string, MarketplaceToolListing> = new Map();
const toolPurchases: Map<string, ToolPurchase[]> = new Map(); // toolId -> purchases
const creatorEarnings: Map<string, TokenAmount> = new Map(); // wallet -> earnings
const platformRevenue: TokenAmount[] = []; // Revenue log

// ============================================================================
// Tool Listing Management
// ============================================================================

/**
 * List a new tool on the marketplace
 */
export function createToolListing(
  authorWallet: string,
  params: {
    toolName: string;
    displayName: string;
    description: string;
    category: ToolCategory;
    pricePerCall: number;
    monthlyPrice?: number;
  }
): MarketplaceToolListing {
  const now = Date.now();

  const listing: MarketplaceToolListing = {
    id: `tool-${params.toolName}-${now}`,
    authorWallet,
    toolName: params.toolName,
    displayName: params.displayName,
    description: params.description,
    category: params.category,
    pricePerCall: params.pricePerCall,
    monthlyPrice: params.monthlyPrice,
    revenueShare: 70, // Default 70% to creator
    totalRevenue: BigInt(0),
    totalCalls: 0,
    rating: 0,
    verified: false,
    featured: false,
    createdAt: now,
  };

  toolListings.set(listing.id, listing);
  return listing;
}

/**
 * Get a tool listing
 */
export function getToolListing(toolId: string): MarketplaceToolListing | undefined {
  return toolListings.get(toolId);
}

/**
 * Get all tool listings
 */
export function getAllToolListings(options?: {
  category?: ToolCategory;
  verified?: boolean;
  featured?: boolean;
  sortBy?: 'revenue' | 'calls' | 'rating' | 'recent';
  limit?: number;
}): MarketplaceToolListing[] {
  let listings = Array.from(toolListings.values());

  // Filter
  if (options?.category) {
    listings = listings.filter(l => l.category === options.category);
  }
  if (options?.verified !== undefined) {
    listings = listings.filter(l => l.verified === options.verified);
  }
  if (options?.featured !== undefined) {
    listings = listings.filter(l => l.featured === options.featured);
  }

  // Sort
  switch (options?.sortBy) {
    case 'revenue':
      listings.sort((a, b) => Number(b.totalRevenue - a.totalRevenue));
      break;
    case 'calls':
      listings.sort((a, b) => b.totalCalls - a.totalCalls);
      break;
    case 'rating':
      listings.sort((a, b) => b.rating - a.rating);
      break;
    case 'recent':
    default:
      listings.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Limit
  if (options?.limit) {
    listings = listings.slice(0, options.limit);
  }

  return listings;
}

/**
 * Get listings by author
 */
export function getAuthorListings(authorWallet: string): MarketplaceToolListing[] {
  return Array.from(toolListings.values())
    .filter(l => l.authorWallet === authorWallet);
}

/**
 * Update tool listing
 */
export function updateToolListing(
  toolId: string,
  updates: Partial<Pick<MarketplaceToolListing, 'displayName' | 'description' | 'pricePerCall' | 'monthlyPrice'>>
): MarketplaceToolListing {
  const listing = toolListings.get(toolId);
  if (!listing) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  Object.assign(listing, updates);
  toolListings.set(toolId, listing);
  return listing;
}

/**
 * Feature a tool (paid promotion)
 */
export function featureTool(
  toolId: string,
  durationDays: number,
  feeCost: TokenAmount
): MarketplaceToolListing {
  const listing = toolListings.get(toolId);
  if (!listing) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  listing.featured = true;
  listing.featuredUntil = Date.now() + durationDays * 24 * 60 * 60 * 1000;
  toolListings.set(toolId, listing);

  // Add to platform revenue
  platformRevenue.push(feeCost);

  return listing;
}

/**
 * Verify a tool (admin only)
 */
export function verifyTool(toolId: string, verified: boolean): void {
  const listing = toolListings.get(toolId);
  if (!listing) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  listing.verified = verified;
  toolListings.set(toolId, listing);
}

// ============================================================================
// Tool Purchases & Revenue
// ============================================================================

/**
 * Record a tool purchase/usage
 */
export function recordToolUsage(
  buyerWallet: string,
  toolId: string,
  creditsSpent: number,
  revenueConfig: RevenueConfig = DEFAULT_REVENUE_CONFIG
): {
  purchase: ToolPurchase;
  creatorRevenue: TokenAmount;
  platformRevenue: TokenAmount;
} {
  const listing = toolListings.get(toolId);
  if (!listing) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  // Convert credits to token value (simplified: 1 credit = 0.1 token)
  const tokenValue = toTokenAmount(creditsSpent * 0.1);

  // Calculate revenue split
  const creatorSharePercent = listing.revenueShare / 100;
  const platformSharePercent = 1 - creatorSharePercent;

  const creatorRevenue = BigInt(Math.floor(Number(tokenValue) * creatorSharePercent));
  const platformRev = BigInt(Math.floor(Number(tokenValue) * platformSharePercent));

  // Record purchase
  const purchase: ToolPurchase = {
    id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    buyerWallet,
    toolId,
    type: 'per_call',
    amount: tokenValue,
    credits: creditsSpent,
    timestamp: Date.now(),
  };

  const purchases = toolPurchases.get(toolId) || [];
  purchases.push(purchase);
  toolPurchases.set(toolId, purchases);

  // Update listing stats
  listing.totalRevenue += tokenValue;
  listing.totalCalls++;
  toolListings.set(toolId, listing);

  // Update creator earnings
  const currentEarnings = creatorEarnings.get(listing.authorWallet) || BigInt(0);
  creatorEarnings.set(listing.authorWallet, currentEarnings + creatorRevenue);

  // Record platform revenue
  platformRevenue.push(platformRev);

  return {
    purchase,
    creatorRevenue,
    platformRevenue: platformRev,
  };
}

/**
 * Purchase monthly subscription for a tool
 */
export function purchaseMonthlySubscription(
  buyerWallet: string,
  toolId: string,
  revenueConfig: RevenueConfig = DEFAULT_REVENUE_CONFIG
): {
  purchase: ToolPurchase;
  expiresAt: number;
} {
  const listing = toolListings.get(toolId);
  if (!listing || !listing.monthlyPrice) {
    throw new Error(`Tool not available for monthly subscription: ${toolId}`);
  }

  const tokenValue = toTokenAmount(listing.monthlyPrice);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

  // Calculate revenue split
  const creatorRevenue = BigInt(Math.floor(Number(tokenValue) * (listing.revenueShare / 100)));
  const platformRev = tokenValue - creatorRevenue;

  const purchase: ToolPurchase = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    buyerWallet,
    toolId,
    type: 'monthly',
    amount: tokenValue,
    credits: 0,
    timestamp: Date.now(),
  };

  const purchases = toolPurchases.get(toolId) || [];
  purchases.push(purchase);
  toolPurchases.set(toolId, purchases);

  // Update earnings
  const currentEarnings = creatorEarnings.get(listing.authorWallet) || BigInt(0);
  creatorEarnings.set(listing.authorWallet, currentEarnings + creatorRevenue);
  platformRevenue.push(platformRev);

  return { purchase, expiresAt };
}

// ============================================================================
// Creator Earnings
// ============================================================================

/**
 * Get creator's total earnings
 */
export function getCreatorEarnings(wallet: string): {
  total: TokenAmount;
  available: TokenAmount;
  withdrawn: TokenAmount;
  listings: number;
  totalCalls: number;
} {
  const total = creatorEarnings.get(wallet) || BigInt(0);
  const listings = getAuthorListings(wallet);
  const totalCalls = listings.reduce((sum, l) => sum + l.totalCalls, 0);

  return {
    total,
    available: total, // In production, track withdrawals separately
    withdrawn: BigInt(0),
    listings: listings.length,
    totalCalls,
  };
}

/**
 * Withdraw creator earnings
 */
export function withdrawCreatorEarnings(
  wallet: string,
  amount: TokenAmount
): { success: boolean; error?: string } {
  const earnings = creatorEarnings.get(wallet) || BigInt(0);

  if (amount > earnings) {
    return { success: false, error: 'Insufficient earnings' };
  }

  creatorEarnings.set(wallet, earnings - amount);
  return { success: true };
}

// ============================================================================
// Marketplace Statistics
// ============================================================================

export function getMarketplaceStats(): {
  totalListings: number;
  verifiedListings: number;
  totalRevenue: TokenAmount;
  totalCalls: number;
  topCategories: Array<{ category: ToolCategory; count: number; revenue: TokenAmount }>;
  topCreators: Array<{ wallet: string; listings: number; revenue: TokenAmount }>;
} {
  const listings = Array.from(toolListings.values());

  // Category stats
  const categoryMap = new Map<ToolCategory, { count: number; revenue: TokenAmount }>();
  for (const listing of listings) {
    const current = categoryMap.get(listing.category) || { count: 0, revenue: BigInt(0) };
    current.count++;
    current.revenue += listing.totalRevenue;
    categoryMap.set(listing.category, current);
  }

  // Creator stats
  const creatorMap = new Map<string, { listings: number; revenue: TokenAmount }>();
  for (const listing of listings) {
    const current = creatorMap.get(listing.authorWallet) || { listings: 0, revenue: BigInt(0) };
    current.listings++;
    current.revenue += listing.totalRevenue;
    creatorMap.set(listing.authorWallet, current);
  }

  return {
    totalListings: listings.length,
    verifiedListings: listings.filter(l => l.verified).length,
    totalRevenue: listings.reduce((sum, l) => sum + l.totalRevenue, BigInt(0)),
    totalCalls: listings.reduce((sum, l) => sum + l.totalCalls, 0),
    topCategories: Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => Number(b.revenue - a.revenue))
      .slice(0, 5),
    topCreators: Array.from(creatorMap.entries())
      .map(([wallet, data]) => ({ wallet, ...data }))
      .sort((a, b) => Number(b.revenue - a.revenue))
      .slice(0, 10),
  };
}

// ============================================================================
// Tool Ratings
// ============================================================================

const toolRatings: Map<string, Array<{ wallet: string; rating: number; timestamp: number }>> = new Map();

export function rateToolListing(
  toolId: string,
  wallet: string,
  rating: number
): void {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const listing = toolListings.get(toolId);
  if (!listing) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  const ratings = toolRatings.get(toolId) || [];

  // Check if user already rated
  const existingIndex = ratings.findIndex(r => r.wallet === wallet);
  if (existingIndex >= 0) {
    ratings[existingIndex] = { wallet, rating, timestamp: Date.now() };
  } else {
    ratings.push({ wallet, rating, timestamp: Date.now() });
  }

  toolRatings.set(toolId, ratings);

  // Update average rating
  const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  listing.rating = Math.round(avgRating * 10) / 10;
  toolListings.set(toolId, listing);
}

// ============================================================================
// Curation Staking
// ============================================================================

interface CurationStake {
  wallet: string;
  toolId: string;
  amount: TokenAmount;
  timestamp: number;
}

const curationStakes: Map<string, CurationStake[]> = new Map();

/**
 * Stake tokens on a tool (curation)
 */
export function stakeOnTool(
  wallet: string,
  toolId: string,
  amount: TokenAmount
): CurationStake {
  const listing = toolListings.get(toolId);
  if (!listing) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  const stake: CurationStake = {
    wallet,
    toolId,
    amount,
    timestamp: Date.now(),
  };

  const stakes = curationStakes.get(toolId) || [];
  stakes.push(stake);
  curationStakes.set(toolId, stakes);

  return stake;
}

/**
 * Get total curation stake on a tool
 */
export function getToolCurationStake(toolId: string): TokenAmount {
  const stakes = curationStakes.get(toolId) || [];
  return stakes.reduce((sum, s) => sum + s.amount, BigInt(0));
}

// ============================================================================
// Exports
// ============================================================================

export default {
  createToolListing,
  getToolListing,
  getAllToolListings,
  getAuthorListings,
  updateToolListing,
  featureTool,
  verifyTool,
  recordToolUsage,
  purchaseMonthlySubscription,
  getCreatorEarnings,
  withdrawCreatorEarnings,
  getMarketplaceStats,
  rateToolListing,
  stakeOnTool,
  getToolCurationStake,
};
