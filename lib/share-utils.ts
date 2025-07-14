/**
 * Share System Utilities
 * Functions for generating share codes, validating shares, and managing share data
 */

import { EntityType, ShareEntry } from '@/types/share';
import { validateWalletAddress } from './user-history-utils';

/**
 * Generate a unique share code
 * Format: [entityTypePrefix][randomHash]
 */
export function generateShareCode(entityType: EntityType, entityId: string): string {
  const prefixes: Record<EntityType, string> = {
    transaction: 'tx',
    account: 'ac',
    program: 'pg',
    user: 'us',
    block: 'bl',
    validator: 'vl',
    token: 'tk'
  };
  
  const prefix = prefixes[entityType];
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  
  return `${prefix}${timestamp}${random}`;
}

/**
 * Parse share code to extract entity type
 */
export function parseShareCode(shareCode: string): { type: EntityType | null; isValid: boolean } {
  if (!shareCode || shareCode.length < 3) {
    return { type: null, isValid: false };
  }
  
  const prefix = shareCode.substring(0, 2);
  const typeMap: Record<string, EntityType> = {
    tx: 'transaction',
    ac: 'account',
    pg: 'program',
    us: 'user',
    bl: 'block',
    vl: 'validator',
    tk: 'token'
  };
  
  const type = typeMap[prefix] || null;
  return { type, isValid: !!type };
}

/**
 * Generate share URL
 */
export function generateShareUrl(shareCode: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://opensvm.com';
  return `${base}/share/${shareCode}`;
}

/**
 * Generate OG image URL
 */
export function generateOgImageUrl(entityType: EntityType, entityId: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://opensvm.com';
  return `${base}/api/og/${entityType}/${entityId}`;
}

/**
 * Format entity ID for display
 */
export function formatEntityId(entityId: string, entityType: EntityType): string {
  if (entityType === 'transaction' || entityType === 'account' || entityType === 'program') {
    // Shorten hash/address
    return `${entityId.slice(0, 6)}...${entityId.slice(-4)}`;
  }
  return entityId;
}

/**
 * Validate share request
 */
export function validateShareRequest(
  entityType: EntityType,
  entityId: string,
  referrerAddress?: string
): { isValid: boolean; error?: string } {
  // Validate entity type
  const validTypes: EntityType[] = ['transaction', 'account', 'program', 'user', 'block', 'validator', 'token'];
  if (!validTypes.includes(entityType)) {
    return { isValid: false, error: 'Invalid entity type' };
  }
  
  // Validate entity ID
  if (!entityId || entityId.trim().length === 0) {
    return { isValid: false, error: 'Entity ID is required' };
  }
  
  // For Solana addresses/hashes, basic validation
  if (entityType !== 'user' && (entityId.length < 32 || entityId.length > 88)) {
    return { isValid: false, error: 'Invalid entity ID format' };
  }
  
  // Validate referrer address if provided
  if (referrerAddress && !validateWalletAddress(referrerAddress)) {
    return { isValid: false, error: 'Invalid referrer wallet address' };
  }
  
  return { isValid: true };
}

/**
 * Generate AI prompt for entity analysis
 */
export function generateAIPrompt(entityType: EntityType, data: any): string {
  const prompts: Record<EntityType, (data: any) => string> = {
    transaction: (data) => `
      Analyze this Solana transaction and create an engaging description:
      - Transaction Hash: ${data.hash}
      - Status: ${data.status}
      - Amount: ${data.amount || 'N/A'} SOL
      - Fee: ${data.fee} SOL
      - Programs involved: ${data.programCount}
      
      Create a concise, informative description highlighting what makes this transaction interesting.
      Include relevant emojis and suggest 2-3 hashtags.
    `,
    
    account: (data) => `
      Analyze this Solana account and create an engaging description:
      - Address: ${data.address}
      - Balance: ${data.balance} SOL
      - Token holdings: ${data.tokenCount} tokens
      - Total transactions: ${data.transactionCount}
      - Account age: ${data.firstActivity ? 'Active since ' + new Date(data.firstActivity).toLocaleDateString() : 'New account'}
      
      Create a concise description highlighting the account's activity and significance.
      Include relevant emojis and suggest 2-3 hashtags.
    `,
    
    program: (data) => `
      Analyze this Solana program and create an engaging description:
      - Program ID: ${data.programId}
      - Name: ${data.name || 'Unknown'}
      - Total transactions: ${data.transactionCount}
      - Unique users: ${data.userCount}
      - Success rate: ${data.successRate}%
      
      Create a concise description explaining what this program does and its importance.
      Include relevant emojis and suggest 2-3 hashtags.
    `,
    
    user: (data) => `
      Analyze this OpenSVM user profile and create an engaging description:
      - Wallet: ${data.walletAddress}
      - Display name: ${data.displayName || 'Anonymous'}
      - Followers: ${data.followers}
      - Total page views: ${data.pageViews}
      - Member since: ${new Date(data.joinDate).toLocaleDateString()}
      
      Create a concise description highlighting the user's activity and influence.
      Include relevant emojis and suggest 2-3 hashtags.
    `,
    
    block: (data) => `
      Analyze this Solana block and create an engaging description:
      - Slot: ${data.slot}
      - Transaction count: ${data.transactionCount}
      - Success rate: ${data.successRate}%
      - Total SOL volume: ${data.totalSolVolume}
      - Block time: ${new Date(data.blockTime * 1000).toLocaleString()}
      
      Create a concise description highlighting the block's activity and performance.
      Include relevant emojis and suggest 2-3 hashtags.
    `,
    
    validator: (data) => `
      Analyze this Solana validator and create an engaging description:
      - Vote account: ${data.voteAccount}
      - Name: ${data.name || 'Unknown Validator'}
      - Commission: ${data.commission}%
      - Activated stake: ${data.activatedStake.toLocaleString()} SOL
      - APY: ${data.apy}%
      - Status: ${data.status}
      - Performance score: ${data.performanceScore}%
      
      Create a concise description highlighting the validator's performance and reliability.
      Include relevant emojis and suggest 2-3 hashtags.
    `,
    
    token: (data) => `
      Analyze this Solana token and create an engaging description:
      - Token: ${data.name || 'Unknown Token'} (${data.symbol || 'N/A'})
      - Mint: ${data.mint}
      - Price: ${data.price ? '$' + data.price.toFixed(4) : 'N/A'}
      - Market cap: ${data.marketCap ? '$' + data.marketCap.toLocaleString() : 'N/A'}
      - Total supply: ${data.supply ? data.supply.toLocaleString() : 'N/A'}
      - Holders: ${data.holders ? data.holders.toLocaleString() : 'N/A'}
      
      Create a concise description highlighting the token's significance and market performance.
      Include relevant emojis and suggest 2-3 hashtags.
    `
  };
  
  return prompts[entityType](data);
}

/**
 * Extract hashtags from AI response
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#\w+/g;
  const matches = text.match(hashtagRegex) || [];
  return matches.map(tag => tag.toLowerCase()).slice(0, 5); // Max 5 hashtags
}

/**
 * Generate title based on entity type and data
 */
export function generateTitle(entityType: EntityType, data: any): string {
  const titles: Record<EntityType, (data: any) => string> = {
    transaction: (data) => `${data.status === 'success' ? '✅' : '❌'} Transaction ${formatEntityId(data.hash, 'transaction')}`,
    account: (data) => `🔍 Account ${formatEntityId(data.address, 'account')}`,
    program: (data) => `📦 ${data.name || 'Program'} ${formatEntityId(data.programId, 'program')}`,
    user: (data) => `👤 ${data.displayName || formatEntityId(data.walletAddress, 'account')}`,
    block: (data) => `🧱 Block #${data.slot}`,
    validator: (data) => `⚡ ${data.name || 'Validator'} ${formatEntityId(data.voteAccount, 'account')}`,
    token: (data) => `🪙 ${data.name || 'Token'} (${data.symbol || formatEntityId(data.mint, 'account')})`
  };
  
  return titles[entityType](data);
}

/**
 * Generate description fallback (when AI is not available)
 */
export function generateDescriptionFallback(entityType: EntityType, data: any): string {
  const descriptions: Record<EntityType, (data: any) => string> = {
    transaction: (data) => `${data.status === 'success' ? 'Successful' : 'Failed'} transaction with ${data.programCount} program(s). Fee: ${data.fee} SOL`,
    account: (data) => `Active Solana account with ${data.balance} SOL balance and ${data.tokenCount} token(s)`,
    program: (data) => `Solana program with ${data.transactionCount.toLocaleString()} transactions and ${data.userCount.toLocaleString()} users`,
    user: (data) => `OpenSVM explorer with ${data.followers} followers and ${data.pageViews} profile views`,
    block: (data) => `Solana block #${data.slot} with ${data.transactionCount} transactions and ${data.successRate}% success rate`,
    validator: (data) => `${data.status} Solana validator with ${data.commission}% commission and ${data.performanceScore}% performance score`,
    token: (data) => `${data.name || 'Token'} with ${data.supply ? data.supply.toLocaleString() : 'unknown'} supply and ${data.holders || 0} holders`
  };
  
  return descriptions[entityType](data);
}

/**
 * Calculate share expiration time (30 days)
 */
export function calculateShareExpiration(): number {
  return Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
}

/**
 * Check if share has expired
 */
export function isShareExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  return Date.now() > expiresAt;
}

/**
 * Format share stats for display
 */
export function formatShareStats(stats: {
  clicks: number;
  conversions: number;
  conversionRate: number;
}): string {
  return `${stats.clicks} clicks • ${stats.conversions} conversions • ${(stats.conversionRate * 100).toFixed(1)}% CTR`;
}
