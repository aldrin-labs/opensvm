/**
 * Qdrant Database utilities for user history storage
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { UserHistoryEntry, UserProfile, UserFollowEntry } from '@/types/user-history';

// Initialize Qdrant client with timeout
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333',
  apiKey: process.env.QDRANT || undefined,
});

// Helper function to add timeout to Qdrant operations
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error('Qdrant operation timed out')), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Collection names
export const COLLECTIONS = {
  USER_HISTORY: 'user_history',
  USER_PROFILES: 'user_profiles',
  USER_FOLLOWS: 'user_follows',
  USER_LIKES: 'user_likes',
  SHARES: 'shares',
  SHARE_CLICKS: 'share_clicks',
  TRANSFERS: 'transfers',
  TOKEN_METADATA: 'token_metadata',
  PROGRAM_METADATA: 'program_metadata',
  GLOBAL_CHAT: 'global_chat'
} as const;

// Export qdrant client for direct access
export { qdrantClient };

/**
 * Initialize Qdrant collections for user data
 */
export async function initializeCollections() {
  try {
    // Helper function to ensure index exists
    const ensureIndex = async (collectionName: string, fieldName: string) => {
      try {
        await qdrantClient.createPayloadIndex(collectionName, {
          field_name: fieldName,
          field_schema: 'keyword'
        });
        console.log(`Created index for ${fieldName} in ${collectionName}`);
      } catch (error: any) {
        // Index might already exist, check if it's already exists error
        if (error?.data?.status?.error?.includes('already exists') ||
          error?.message?.includes('already exists')) {
          console.log(`Index for ${fieldName} in ${collectionName} already exists`);
        } else {
          console.warn(`Failed to create index for ${fieldName} in ${collectionName}:`, error?.data?.status?.error || error?.message);
        }
      }
    };

    // Check if user_history collection exists
    const historyExists = await qdrantClient.getCollection(COLLECTIONS.USER_HISTORY).catch(() => null);

    if (!historyExists) {
      await qdrantClient.createCollection(COLLECTIONS.USER_HISTORY, {
        vectors: {
          size: 384, // Dimension for text embeddings
          distance: 'Cosine'
        }
      });
      console.log('Created user_history collection');
      // Ensure walletAddress index exists for user_history
      await ensureIndex(COLLECTIONS.USER_HISTORY, 'walletAddress');
    }


    // Check if user_profiles collection exists
    const profilesExists = await qdrantClient.getCollection(COLLECTIONS.USER_PROFILES).catch(() => null);

    if (!profilesExists) {
      await qdrantClient.createCollection(COLLECTIONS.USER_PROFILES, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created user_profiles collection');
      // Ensure walletAddress index exists for user_profiles
      await ensureIndex(COLLECTIONS.USER_PROFILES, 'walletAddress');
    }


    // Check if user_follows collection exists
    const followsExists = await qdrantClient.getCollection(COLLECTIONS.USER_FOLLOWS).catch(() => null);

    if (!followsExists) {
      await qdrantClient.createCollection(COLLECTIONS.USER_FOLLOWS, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created user_follows collection');
      // Ensure indexes exist for user_follows
      await ensureIndex(COLLECTIONS.USER_FOLLOWS, 'followerAddress');
      await ensureIndex(COLLECTIONS.USER_FOLLOWS, 'targetAddress');
    }


    // Check if user_likes collection exists
    const likesExists = await qdrantClient.getCollection(COLLECTIONS.USER_LIKES).catch(() => null);

    if (!likesExists) {
      await qdrantClient.createCollection(COLLECTIONS.USER_LIKES, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created user_likes collection');
      // Ensure indexes exist for user_likes
      await ensureIndex(COLLECTIONS.USER_LIKES, 'likerAddress');
      await ensureIndex(COLLECTIONS.USER_LIKES, 'targetAddress');
    }


    // Check if shares collection exists
    const sharesExists = await qdrantClient.getCollection(COLLECTIONS.SHARES).catch(() => null);

    if (!sharesExists) {
      await qdrantClient.createCollection(COLLECTIONS.SHARES, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created shares collection');
      // Ensure indexes exist for shares
      await ensureIndex(COLLECTIONS.SHARES, 'shareCode');
      await ensureIndex(COLLECTIONS.SHARES, 'referrerAddress');
      await ensureIndex(COLLECTIONS.SHARES, 'entityType');
      await ensureIndex(COLLECTIONS.SHARES, 'entityId');

    }

    // Check if share_clicks collection exists
    const shareClicksExists = await qdrantClient.getCollection(COLLECTIONS.SHARE_CLICKS).catch(() => null);

    if (!shareClicksExists) {
      await qdrantClient.createCollection(COLLECTIONS.SHARE_CLICKS, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created share_clicks collection');
      // Ensure indexes exist for share_clicks
      await ensureIndex(COLLECTIONS.SHARE_CLICKS, 'shareCode');
      await ensureIndex(COLLECTIONS.SHARE_CLICKS, 'clickerAddress');
    }


    console.log('Qdrant collections initialized successfully');
  } catch (error) {
    console.error('Error initializing Qdrant collections:', error);
    throw error;
  }
}

/**
 * Generate a simple embedding for text content
 * In a real implementation, you'd use a proper embedding model
 */
function generateSimpleEmbedding(text: string): number[] {
  // Simple hash-based embedding for demonstration
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Generate 384-dimensional vector
  const vector = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.sin(hash + i) * 0.1;
  }

  return vector;
}

/**
 * Store user history entry in Qdrant
 */
export async function storeHistoryEntry(entry: UserHistoryEntry): Promise<void> {
  try {


    // Generate embedding from page content
    const textContent = `${entry.pageTitle} ${entry.path} ${entry.pageType} ${JSON.stringify(entry.metadata)}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(COLLECTIONS.USER_HISTORY, {
      wait: true,
      points: [{
        id: entry.id,
        vector,
        payload: {
          ...entry,
          // Ensure timestamp is stored as integer for indexing
          timestamp: entry.timestamp
        }
      }]
    });
  } catch (error) {
    console.error('Error storing history entry:', error);
    throw error;
  }
}

/**
 * Get user history from Qdrant
 */
export async function getUserHistory(
  walletAddress: string,
  options: {
    limit?: number;
    offset?: number;
    pageType?: string;
  } = {}
): Promise<{ history: UserHistoryEntry[]; total: number }> {
  // Skip in browser - return empty result
  if (typeof window !== 'undefined') {
    return { history: [], total: 0 };
  }

  try {
    const { limit = 100, offset = 0, pageType } = options;

    // Debug logging
    const displayWallet = walletAddress || '(all users)';
    if (process.env.NODE_ENV === 'development') {
      console.log(`getUserHistory called for: ${displayWallet}, limit: ${limit}, offset: ${offset}`);
    }

    // Build filter
    const filter: any = {
      must: []
    };

    // Only filter by wallet address if one is provided
    if (walletAddress && walletAddress.trim() !== '') {
      filter.must.push({
        key: 'walletAddress',
        match: { value: walletAddress }
      });
      if (process.env.NODE_ENV === 'development') {
        console.log(`Added wallet filter for: ${displayWallet}`);
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('No wallet filter - fetching from all users');
      }
    }

    if (pageType) {
      filter.must.push({
        key: 'pageType',
        match: { value: pageType }
      });
    }

    // Use scroll for filter-based retrieval (not vector search)
    const scrollParams: any = {
      limit: limit + offset, // Fetch limit + offset to handle offset manually
      with_payload: true,
      with_vector: false // We don't need vectors, just metadata
    };

    if (filter.must.length > 0) {
      scrollParams.filter = filter;
    }

    // Use scroll API for filter-based retrieval
    const result = await qdrantClient.scroll(COLLECTIONS.USER_HISTORY, scrollParams);

    // Get total count
    const countParams: any = {};
    if (filter.must.length > 0) {
      countParams.filter = filter;
    }
    const countResult = await qdrantClient.count(COLLECTIONS.USER_HISTORY, countParams);

    // Scroll API returns {points: [...], next_page_offset: ...}
    const allHistory = result.points.map(point => point.payload as unknown as UserHistoryEntry);
    
    // Sort by timestamp (newest first) before applying offset/limit
    allHistory.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply offset and limit manually
    const history = allHistory.slice(offset, offset + limit);

    // Debug logging for results
    if (process.env.NODE_ENV === 'development') {
      console.log(`getUserHistory results: ${history.length} entries retrieved (${allHistory.length} total fetched, ${countResult.count} in DB)`);
      if (history.length > 0) {
        const uniqueWallets = [...new Set(history.map(h => h.walletAddress))];
        console.log(`Unique wallets in results: ${uniqueWallets.length}`);
        uniqueWallets.slice(0, 5).forEach(w => {
          const count = history.filter(h => h.walletAddress === w).length;
          console.log(`  ${w}: ${count} entries`);
        });

        // Show timestamp information for debugging
        console.log('Sample entries with timestamps:');
        history.slice(0, 5).forEach((entry, i) => {
          const date = new Date(entry.timestamp);
          const hoursAgo = Math.round((Date.now() - entry.timestamp) / (1000 * 60 * 60));
          console.log(`  ${i + 1}. ${entry.walletAddress} - ${entry.pageType} - ${date.toISOString()} (${hoursAgo}h ago)`);
        });
      }
    }

    return {
      history,
      total: countResult.count
    };
  } catch (error) {
    console.error('Error getting user history:', error);
    throw error;
  }
}

/**
 * Delete user history from Qdrant
 */
export async function deleteUserHistory(walletAddress: string): Promise<void> {
  try {


    await qdrantClient.delete(COLLECTIONS.USER_HISTORY, {
      wait: true,
      filter: {
        must: [{
          key: 'walletAddress',
          match: { value: walletAddress }
        }]
      }
    });
  } catch (error) {
    console.error('Error deleting user history:', error);
    throw error;
  }
}

/**
 * Store user profile in Qdrant
 */
export async function storeUserProfile(profile: UserProfile): Promise<void> {
  try {


    // First check if profile exists by searching for walletAddress
    const existingResult = await qdrantClient.search(COLLECTIONS.USER_PROFILES, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: profile.walletAddress } }]
      },
      limit: 1,
      with_payload: true
    });

    let pointId: string;

    if (existingResult.length > 0) {
      // Use existing point ID
      pointId = existingResult[0].id as string;
    } else {
      // Generate new UUID for new profile
      pointId = crypto.randomUUID();
    }

    // Generate embedding from profile data
    const textContent = `${profile.walletAddress} ${profile.displayName || ''} ${profile.bio || ''}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(COLLECTIONS.USER_PROFILES, {
      wait: true,
      points: [{
        id: pointId,
        vector,
        payload: profile as any
      }]
    });
  } catch (error) {
    console.error('Error storing user profile:', error);
    throw error;
  }
}

/**
 * Get user profile from Qdrant
 */
export async function getUserProfile(walletAddress: string): Promise<UserProfile | null> {
  try {


    // Search for profile by walletAddress instead of using it as ID
    const result = await qdrantClient.search(COLLECTIONS.USER_PROFILES, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: walletAddress } }]
      },
      limit: 1,
      with_payload: true
    });

    if (result.length === 0) {
      return null;
    }

    return result[0].payload as unknown as UserProfile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Check Qdrant connection health
 */
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    await qdrantClient.getCollections();
    return true;
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return false;
  }
}

/**
 * Social Features - Follow functionality
 */

/**
 * Store user follow relationship
 */
export async function storeUserFollow(entry: UserFollowEntry): Promise<void> {
  try {
    //await initializeCollections();

    const textContent = `${entry.followerAddress} follows ${entry.targetAddress}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(COLLECTIONS.USER_FOLLOWS, {
      wait: true,
      points: [{
        id: entry.id,
        vector,
        payload: entry as any
      }]
    });
  } catch (error) {
    console.error('Error storing user follow:', error);
    throw error;
  }
}

/**
 * Remove user follow relationship
 */
export async function removeUserFollow(followerAddress: string, targetAddress: string): Promise<void> {
  try {

    await qdrantClient.delete(COLLECTIONS.USER_FOLLOWS, {
      wait: true,
      filter: {
        must: [
          { key: 'followerAddress', match: { value: followerAddress } },
          { key: 'targetAddress', match: { value: targetAddress } }
        ]
      }
    });
  } catch (error) {
    console.error('Error removing user follow:', error);
    throw error;
  }
}

/**
 * Get user followers
 */
export async function getUserFollowers(targetAddress: string): Promise<UserFollowEntry[]> {
  try {

    const result = await qdrantClient.search(COLLECTIONS.USER_FOLLOWS, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'targetAddress', match: { value: targetAddress } }]
      },
      limit: 1000,
      with_payload: true
    });

    return result.map(point => point.payload as unknown as UserFollowEntry);
  } catch (error) {
    console.error('Error getting user followers:', error);
    return [];
  }
}

/**
 * Get users that a user is following
 */
export async function getUserFollowing(followerAddress: string): Promise<UserFollowEntry[]> {
  try {

    const result = await qdrantClient.search(COLLECTIONS.USER_FOLLOWS, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'followerAddress', match: { value: followerAddress } }]
      },
      limit: 1000,
      with_payload: true
    });

    return result.map(point => point.payload as unknown as UserFollowEntry);
  } catch (error) {
    console.error('Error getting user following:', error);
    return [];
  }
}

/**
 * Social Features - Like functionality
 */

// User like entry interface
interface UserLikeEntry {
  id: string;
  likerAddress: string;
  targetAddress: string;
  timestamp: number;
}

/**
 * Store user like relationship
 */
export async function storeUserLike(entry: UserLikeEntry): Promise<void> {
  try {

    const textContent = `${entry.likerAddress} likes ${entry.targetAddress}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(COLLECTIONS.USER_LIKES, {
      wait: true,
      points: [{
        id: entry.id,
        vector,
        payload: entry as any
      }]
    });
  } catch (error) {
    console.error('Error storing user like:', error);
    throw error;
  }
}

/**
 * Remove user like relationship
 */
export async function removeUserLike(likerAddress: string, targetAddress: string): Promise<void> {
  try {

    await qdrantClient.delete(COLLECTIONS.USER_LIKES, {
      wait: true,
      filter: {
        must: [
          { key: 'likerAddress', match: { value: likerAddress } },
          { key: 'targetAddress', match: { value: targetAddress } }
        ]
      }
    });
  } catch (error) {
    console.error('Error removing user like:', error);
    throw error;
  }
}

/**
 * Get user likes
 */
export async function getUserLikes(targetAddress: string): Promise<UserLikeEntry[]> {
  try {

    const result = await qdrantClient.search(COLLECTIONS.USER_LIKES, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'targetAddress', match: { value: targetAddress } }]
      },
      limit: 1000,
      with_payload: true
    });

    return result.map(point => point.payload as unknown as UserLikeEntry);
  } catch (error) {
    console.error('Error getting user likes:', error);
    return [];
  }
}

/**
 * Share System Functions
 */

// Import share types
import { ShareEntry, ShareClickEntry } from '@/types/share';

/**
 * Store share entry
 */
export async function storeShareEntry(share: ShareEntry): Promise<void> {
  try {

    const textContent = `${share.entityType} ${share.entityId} shared by ${share.referrerAddress}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(COLLECTIONS.SHARES, {
      wait: true,
      points: [{
        id: share.id,
        vector,
        payload: share as any
      }]
    });
  } catch (error) {
    console.error('Error storing share entry:', error);
    throw error;
  }
}

/**
 * Get share by code
 */
export async function getShareByCode(shareCode: string): Promise<ShareEntry | null> {
  try {

    const result = await qdrantClient.search(COLLECTIONS.SHARES, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'shareCode', match: { value: shareCode } }]
      },
      limit: 1,
      with_payload: true
    });

    if (result.length === 0) {
      return null;
    }

    return result[0].payload as unknown as ShareEntry;
  } catch (error) {
    console.error('Error getting share by code:', error);
    return null;
  }
}

/**
 * Get shares by referrer
 */
export async function getSharesByReferrer(
  referrerAddress: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ shares: ShareEntry[]; total: number }> {
  try {

    const { limit = 50, offset = 0 } = options;

    const filter = {
      must: [{ key: 'referrerAddress', match: { value: referrerAddress } }]
    };

    const result = await qdrantClient.search(COLLECTIONS.SHARES, {
      vector: new Array(384).fill(0),
      filter,
      limit,
      offset,
      with_payload: true
    });

    const countResult = await qdrantClient.count(COLLECTIONS.SHARES, { filter });

    const shares = result.map(point => point.payload as unknown as ShareEntry);
    shares.sort((a, b) => b.timestamp - a.timestamp);

    return { shares, total: countResult.count };
  } catch (error) {
    console.error('Error getting shares by referrer:', error);
    return { shares: [], total: 0 };
  }
}

/**
 * Store share click
 */
export async function storeShareClick(click: ShareClickEntry): Promise<void> {
  try {


    const textContent = `Click on share ${click.shareCode} by ${click.clickerAddress || 'anonymous'}`;
    const vector = generateSimpleEmbedding(textContent);

    await qdrantClient.upsert(COLLECTIONS.SHARE_CLICKS, {
      wait: true,
      points: [{
        id: click.id,
        vector,
        payload: click as any
      }]
    });
  } catch (error) {
    console.error('Error storing share click:', error);
    throw error;
  }
}

/**
 * Get share clicks
 */
export async function getShareClicks(shareCode: string): Promise<ShareClickEntry[]> {
  try {


    const result = await qdrantClient.search(COLLECTIONS.SHARE_CLICKS, {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'shareCode', match: { value: shareCode } }]
      },
      limit: 1000,
      with_payload: true
    });

    return result.map(point => point.payload as unknown as ShareClickEntry);
  } catch (error) {
    console.error('Error getting share clicks:', error);
    return [];
  }
}

/**
 * Update share click count
 */
export async function incrementShareClicks(shareCode: string): Promise<void> {
  try {
    const share = await getShareByCode(shareCode);
    if (!share) return;

    share.clicks = (share.clicks || 0) + 1;
    await storeShareEntry(share);
  } catch (error) {
    console.error('Error incrementing share clicks:', error);
  }
}

/**
 * Mark share click as converted
 */
export async function markShareConversion(shareCode: string, clickerAddress: string): Promise<void> {
  try {
    const share = await getShareByCode(shareCode);
    if (!share) return;

    share.conversions = (share.conversions || 0) + 1;
    await storeShareEntry(share);

    // Also update the click entry
    const clicks = await getShareClicks(shareCode);
    const userClick = clicks.find(c => c.clickerAddress === clickerAddress);
    if (userClick) {
      userClick.converted = true;
      await storeShareClick(userClick);
    }
  } catch (error) {
    console.error('Error marking share conversion:', error);
  }
}

/**
 * Transfer Storage Functions
 */

// Transfer entry interface for Qdrant storage
export interface TransferEntry {
  id: string;
  walletAddress: string;
  signature: string;
  timestamp: number;
  type: string;
  amount: number;
  token: string;
  tokenSymbol?: string;
  tokenName?: string;
  from: string;
  to: string;
  mint?: string;
  usdValue?: number;
  programId?: string;
  isSolanaOnly: boolean;
  cached: boolean;
  lastUpdated: number;
}

export interface TokenMetadataEntry {
  id: string; // mintAddress
  mintAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;
  metadataUri?: string;
  description?: string;
  cached: boolean;
  lastUpdated: number;
  cacheExpiry: number;
}

export interface ProgramMetadataEntry {
  id: string; // programId
  programId: string;
  name: string;
  description?: string;
  githubUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  logoUrl?: string;
  idl?: any; // IDL JSON object
  verified: boolean;
  category?: string; // 'defi', 'nft', 'gaming', 'infrastructure', etc.
  tags?: string[];
  deployedSlot?: number;
  authority?: string;
  upgradeAuthority?: string;
  cached: boolean;
  lastUpdated: number;
  cacheExpiry: number;
}

// Cache for tracking collection and index creation status
const collectionInitialized = new Map<string, boolean>();

/**
 * Initialize transfers collection with proper indexing
 * Caches initialization status to avoid repeated operations
 */
async function ensureTransfersCollection() {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  // Check if already initialized
  const cacheKey = `${COLLECTIONS.TRANSFERS}_initialized`;
  if (collectionInitialized.get(cacheKey)) {
    return; // Already initialized, skip
  }

  try {
    // Helper function to ensure index exists
    const ensureIndex = async (fieldName: string, fieldType: 'keyword' | 'integer' | 'bool' = 'keyword') => {
      try {
        await qdrantClient.createPayloadIndex(COLLECTIONS.TRANSFERS, {
          field_name: fieldName,
          field_schema: fieldType
        });
        console.log(`Created index for ${fieldName} in transfers`);
      } catch (error: any) {
        if (error?.data?.status?.error?.includes('already exists') ||
          error?.message?.includes('already exists')) {
          // Index already exists, this is expected and not an error
          // Don't log this to reduce noise
        } else {
          console.warn(`Failed to create index for ${fieldName}:`, error?.data?.status?.error || error?.message);
        }
      }
    };
    const exists = await qdrantClient.getCollection(COLLECTIONS.TRANSFERS).catch(() => null);

    if (!exists) {
      await qdrantClient.createCollection(COLLECTIONS.TRANSFERS, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created transfers collection');
    }

    // Always ensure indexes exist, even for existing collections
    await ensureIndex('walletAddress');
    await ensureIndex('signature');
    await ensureIndex('token');
    await ensureIndex('isSolanaOnly', 'bool');
    await ensureIndex('cached', 'bool');

    // Mark as initialized regardless of whether collection existed or not
    collectionInitialized.set(cacheKey, true);
    console.log('Transfers collection and indexes initialized successfully');

  } catch (error) {
    console.error('Error ensuring transfers collection:', error);
    throw error;
  }
}

/**
 * Ensure token metadata collection exists with proper indexes
 */
async function ensureTokenMetadataCollection(): Promise<void> {
  const cacheKey = 'token_metadata_initialized';

  // Check if already initialized in this session
  if (collectionInitialized.get(cacheKey)) {
    return;
  }

  try {
    const exists = await qdrantClient.getCollection(COLLECTIONS.TOKEN_METADATA).catch(() => null);

    // Helper function to ensure index exists
    const ensureIndex = async (fieldName: string) => {
      try {
        await qdrantClient.createPayloadIndex(COLLECTIONS.TOKEN_METADATA, {
          field_name: fieldName,
          field_schema: 'keyword'
        });
        console.log(`Created index for ${fieldName} in token metadata`);
      } catch (error: any) {
        if (error?.data?.status?.error?.includes('already exists') ||
          error?.message?.includes('already exists')) {
          // Index already exists, this is expected and not an error
        } else {
          console.warn(`Failed to create index for ${fieldName}:`, error?.data?.status?.error || error?.message);
        }
      }
    };
    if (!exists) {
      await qdrantClient.createCollection(COLLECTIONS.TOKEN_METADATA, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      // Ensure necessary indexes exist
      await ensureIndex('mintAddress');
      await ensureIndex('symbol');
      await ensureIndex('cached');
      await ensureIndex('verified');

      // Mark as initialized
      collectionInitialized.set(cacheKey, true);
      console.log('Created token metadata collection');
    }


    console.log('Token metadata collection and indexes initialized successfully');

  } catch (error) {
    console.error('Error ensuring token metadata collection:', error);
    throw error;
  }
}

/**
 * Store transfer entry in Qdrant (single entry - use batchStoreTransferEntries for better performance)
 */
export async function storeTransferEntry(entry: TransferEntry): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  // For single entries, use the batch function
  await batchStoreTransferEntries([entry]);
}

/**
 * Store multiple transfer entries in Qdrant efficiently using chunked batch operations
 * Automatically chunks large batches to stay within Qdrant's 33MB payload limit
 */
export async function batchStoreTransferEntries(entries: TransferEntry[]): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  if (entries.length === 0) return;

  try {
    await ensureTransfersCollection();

    // Calculate optimal chunk size to stay under Qdrant's 33MB limit
    // Estimate ~8KB per transfer entry (conservative estimate including vector + payload)
    const ESTIMATED_ENTRY_SIZE = 8 * 1024; // 8KB per entry
    const MAX_PAYLOAD_SIZE = 30 * 1024 * 1024; // 30MB (safe margin under 33MB limit)
    const CHUNK_SIZE = Math.floor(MAX_PAYLOAD_SIZE / ESTIMATED_ENTRY_SIZE); // ~3750 entries per chunk

    console.log(`Batch storing ${entries.length} transfer entries in chunks of ${CHUNK_SIZE}`);

    // Process entries in chunks
    const chunks = [];
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      chunks.push(entries.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Split into ${chunks.length} chunks for safe processing`);

    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} entries`);

      // Prepare points for this chunk
      const points = chunk.map(entry => {
        // Validate entry data
        if (!entry.id || !entry.walletAddress || !entry.signature) {
          throw new Error(`Invalid transfer entry data: missing required fields for ${entry.id}`);
        }

        // Generate embedding from transfer content
        const textContent = `${entry.walletAddress} ${entry.type} ${entry.token} ${entry.amount} ${entry.from} ${entry.to}`;
        const vector = generateSimpleEmbedding(textContent);

        return {
          id: entry.id,
          vector,
          payload: {
            ...entry,
            // Ensure all fields are properly serializable
            timestamp: Number(entry.timestamp),
            amount: Number(entry.amount),
            lastUpdated: Number(entry.lastUpdated)
          }
        };
      });

      const upsertData = {
        wait: true,
        points
      };

      // Store this chunk
      qdrantClient.upsert(COLLECTIONS.TRANSFERS, upsertData);
      console.log(`Successfully stored chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} entries)`);
    }

    console.log(`Successfully batch stored all ${entries.length} transfer entries in ${chunks.length} chunks`);

  } catch (error: any) {
    console.error(`Error batch storing ${entries.length} transfer entries:`, error);

    // Log the full error details for debugging
    if (error?.data) {
      console.error('Qdrant error data:', JSON.stringify(error.data, null, 2));
    }
    if (error?.response) {
      console.error('Qdrant response:', JSON.stringify(error.response, null, 2));
    }

    throw error;
  }
}

/**
 * Get cached transfers from Qdrant
 */
export async function getCachedTransfers(
  walletAddress: string,
  options: {
    limit?: number;
    offset?: number;
    solanaOnly?: boolean;
    transferType?: 'SOL' | 'TOKEN' | 'ALL';
  } = {}
): Promise<{ transfers: TransferEntry[]; total: number }> {
  // Skip in browser - return empty result
  if (typeof window !== 'undefined') {
    return { transfers: [], total: 0 };
  }

  try {
    await ensureTransfersCollection();

    const { limit = 100, offset = 0, solanaOnly = false, transferType = 'ALL' } = options;

    // Build filter
    const filter: any = {
      must: [
        {
          key: 'walletAddress',
          match: { value: walletAddress }
        },
        {
          key: 'cached',
          match: { value: true }
        }
      ]
    };

    if (solanaOnly) {
      filter.must.push({
        key: 'isSolanaOnly',
        match: { value: true }
      });
    }

    if (transferType === 'SOL') {
      filter.must.push({
        key: 'token',
        match: { value: 'SOL' }
      });
    } else if (transferType === 'TOKEN') {
      // Use must_not to exclude SOL tokens
      filter.must_not = [
        {
          key: 'token',
          match: { value: 'SOL' }
        }
      ];
    }

    // Search with filter
    const result = await qdrantClient.search(COLLECTIONS.TRANSFERS, {
      vector: new Array(384).fill(0), // Dummy vector for filtered search
      filter,
      limit,
      offset,
      with_payload: true
    });

    // Get total count
    const countResult = await qdrantClient.count(COLLECTIONS.TRANSFERS, {
      filter
    });

    const transfers = result.map(point => point.payload as unknown as TransferEntry);

    // Sort by timestamp (newest first)
    transfers.sort((a, b) => b.timestamp - a.timestamp);

    return {
      transfers,
      total: countResult.count
    };
  } catch (error: any) {
    console.error('Error getting cached transfers:', error);

    // Log the full error details for debugging
    if (error?.data) {
      console.error('Qdrant search error data:', JSON.stringify(error.data, null, 2));
    }
    if (error?.response) {
      console.error('Qdrant search response:', JSON.stringify(error.response, null, 2));
    }

    return { transfers: [], total: 0 };
  }
}

/**
 * Get last sync timestamp for incremental loading
 */
export async function getLastSyncTimestamp(walletAddress: string): Promise<number> {
  try {

    await ensureTransfersCollection();

    const result = await qdrantClient.search(COLLECTIONS.TRANSFERS, {
      vector: new Array(384).fill(0),
      filter: {
        must: [
          { key: 'walletAddress', match: { value: walletAddress } },
          { key: 'cached', match: { value: true } }
        ]
      },
      limit: 1,
      with_payload: true
    });

    if (result.length === 0) {
      return 0; // No cached data, start from beginning
    }

    // Find the most recent timestamp
    const transfers = result.map(point => point.payload as unknown as TransferEntry);
    const maxTimestamp = Math.max(...transfers.map(t => t.lastUpdated));

    return maxTimestamp;
  } catch (error) {
    console.error('Error getting last sync timestamp:', error);
    return 0;
  }
}

/**
 * Mark transfers as cached with timestamp
 */
export async function markTransfersCached(signatures: string[], walletAddress: string): Promise<void> {
  try {

    await ensureTransfersCollection();

    const timestamp = Date.now();

    // Update each transfer to mark as cached
    for (const signature of signatures) {
      const filter = {
        must: [
          { key: 'signature', match: { value: signature } },
          { key: 'walletAddress', match: { value: walletAddress } }
        ]
      };

      const result = await qdrantClient.search(COLLECTIONS.TRANSFERS, {
        vector: new Array(384).fill(0),
        filter,
        limit: 1,
        with_payload: true
      });

      if (result.length > 0) {
        const transfer = result[0].payload as unknown as TransferEntry;
        transfer.cached = true;
        transfer.lastUpdated = timestamp;

        const textContent = `${transfer.walletAddress} ${transfer.type} ${transfer.token} ${transfer.amount} ${transfer.from} ${transfer.to}`;
        const vector = generateSimpleEmbedding(textContent);

        await qdrantClient.upsert(COLLECTIONS.TRANSFERS, {
          wait: true,
          points: [{
            id: result[0].id as string,
            vector,
            payload: transfer as any
          }]
        });
      }
    }
  } catch (error) {
    console.error('Error marking transfers as cached:', error);
    throw error;
  }
}

/**
 * Detect if a transaction is Solana-only (not cross-chain)
 */
export function isSolanaOnlyTransaction(transfer: any): boolean {
  try {
    // Known Solana program IDs
    // List of known Solana program IDs (expanded, not exhaustive, but covers many major protocols)
    const solanaPrograms = new Set([
      // Core Solana Programs
      '11111111111111111111111111111111', // System Program
      'Stake11111111111111111111111111111111111111', // Stake Program
      'Vote111111111111111111111111111111111111111', // Vote Program
      'BPFLoader1111111111111111111111111111111111', // BPF Loader
      'BPFLoader2111111111111111111111111111111111', // BPF Loader 2
      'BPFLoaderUpgradeab1e11111111111111111111111', // BPF Loader Upgradeable
      'Config1111111111111111111111111111111111111', // Config Program
      'AddressLookupTab1e1111111111111111111111111', // Address Lookup Table

      // Token Programs
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
      'SPLMemo111111111111111111111111111111111111111', // Memo Program
      'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo v2
      'SysvarRent111111111111111111111111111111111', // Rent Sysvar
      'SysvarC1ock11111111111111111111111111111111', // Clock Sysvar
      'SysvarRecentB1ockHashes11111111111111111111', // Recent Blockhashes Sysvar
      'SysvarEpochSchedu1e111111111111111111111111', // Epoch Schedule Sysvar
      'SysvarFees111111111111111111111111111111111', // Fees Sysvar
      'SysvarInstructions1111111111111111111111111', // Instructions Sysvar
      'SysvarRewards111111111111111111111111111111', // Rewards Sysvar
      'SysvarSlotHashes111111111111111111111111111', // Slot Hashes Sysvar
      'SysvarSlotHistory11111111111111111111111111', // Slot History Sysvar
      'SysvarStakeHistory1111111111111111111111111', // Stake History Sysvar

      // Wrapped SOL
      'So11111111111111111111111111111111111111112', // Wrapped SOL

      // DEXes & DeFi
      '9xQeWvG816bUx9EPa2uD3D6vE6z5pQKk5jGzj1h3bT9', // Serum DEX v3
      '4ckmDgGzLYLyE3M9h1w9yQpZ9g2ZbYv5Q3QAtFj5hA9y', // Serum DEX v2
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter Aggregator
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
      'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', // Phoenix DEX
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpool
      'orca111111111111111111111111111111111111111', // Orca
      'MERLuDFBMmsHnszBSb5Q6pR9bxaENa8zD6zF8g5nKX', // Mercurial
    ]);

    // Cross-chain bridge program IDs (if any of these are present, it's NOT Solana-only)
    const crossChainPrograms = new Set([
      'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb', // Wormhole
      'wormRHhg8A2fRkVfqJBx1xQ732GTFX9RWhooFqH9K', // Wormhole v2
      'A11111111111111111111111111111111111111111', // Allbridge (example)
      'portalDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb', // Portal Bridge (example)
    ]);

    // Analyze the transfer object to determine if it's Solana-only
    if (!transfer) {
      console.warn('Transfer object is null or undefined');
      return false;
    }

    // Check if transfer has program IDs (instructions)
    const programIds: string[] = [];

    if (transfer.instructions) {
      programIds.push(...transfer.instructions.map((ix: any) => ix.programId).filter(Boolean));
    }

    if (transfer.programId) {
      programIds.push(transfer.programId);
    }

    if (transfer.programIds) {
      programIds.push(...transfer.programIds);
    }

    // If no program IDs found, check other indicators
    if (programIds.length === 0) {
      // Check for cross-chain indicators in metadata
      if (transfer.metadata) {
        const metadataStr = JSON.stringify(transfer.metadata).toLowerCase();
        const crossChainKeywords = ['bridge', 'wormhole', 'portal', 'ethereum', 'polygon', 'bsc', 'avalanche'];

        if (crossChainKeywords.some(keyword => metadataStr.includes(keyword))) {
          console.log(`Cross-chain keywords detected in transfer metadata`);
          return false;
        }
      }

      // Default to Solana-only if no clear indicators
      return true;
    }

    // Check if any program IDs are cross-chain bridges
    const hasCrossChainPrograms = programIds.some(programId => crossChainPrograms.has(programId));
    if (hasCrossChainPrograms) {
      console.log(`Cross-chain bridge programs detected: ${programIds.filter(id => crossChainPrograms.has(id))}`);
      return false;
    }

    // Check if all program IDs are known Solana programs
    const allSolanaPrograms = programIds.every(programId => solanaPrograms.has(programId));

    if (allSolanaPrograms) {
      console.log(`All ${programIds.length} program IDs are known Solana programs`);
      return true;
    }

    // If we have unknown program IDs, they could be custom Solana programs
    const unknownPrograms = programIds.filter(id => !solanaPrograms.has(id) && !crossChainPrograms.has(id));

    if (unknownPrograms.length > 0) {
      console.log(`Found ${unknownPrograms.length} unknown program IDs, assuming Solana-only: ${unknownPrograms.slice(0, 3)}`);
      return true; // Assume unknown programs are Solana programs unless proven otherwise
    }

    return true; // Default to Solana-only

  } catch (error) {
    console.error('Error analyzing transfer for Solana-only detection:', error);
    return false; // Default to cross-chain on error for safety
  }
}

/**
 * Store token metadata entry in Qdrant
 */
export async function storeTokenMetadata(metadata: TokenMetadataEntry): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  try {
    await ensureTokenMetadataCollection();

    // Validate metadata
    if (!metadata.id || !metadata.mintAddress || !metadata.symbol) {
      console.warn('Skipping token metadata storage: missing required fields');
      return; // Don't throw, just skip silently
    }

    // Validate and sanitize all fields to prevent Qdrant Bad Request errors
    if (!metadata.id || typeof metadata.id !== 'string' || metadata.id.trim() === '') {
      console.warn('Skipping token metadata storage: invalid ID');
      return;
    }
    
    if (!metadata.mintAddress || typeof metadata.mintAddress !== 'string' || metadata.mintAddress.trim() === '') {
      console.warn('Skipping token metadata storage: invalid mintAddress');
      return;
    }
    
    if (!metadata.symbol || typeof metadata.symbol !== 'string' || metadata.symbol.trim() === '') {
      console.warn('Skipping token metadata storage: invalid symbol');
      return;
    }
    
    if (!metadata.name || typeof metadata.name !== 'string' || metadata.name.trim() === '') {
      console.warn('Skipping token metadata storage: invalid name');
      return;
    }
    
    if (!Number.isInteger(metadata.decimals) || metadata.decimals < 0) {
      console.warn('Skipping token metadata storage: invalid decimals');
      return;
    }
    
    if (!Number.isInteger(metadata.lastUpdated) || metadata.lastUpdated <= 0) {
      console.warn('Skipping token metadata storage: invalid lastUpdated');
      return;
    }
    
    if (!Number.isInteger(metadata.cacheExpiry) || metadata.cacheExpiry <= 0) {
      console.warn('Skipping token metadata storage: invalid cacheExpiry');
      return;
    }
    
    if (typeof metadata.verified !== 'boolean') {
      console.warn('Skipping token metadata storage: invalid verified field');
      return;
    }
    
    if (typeof metadata.cached !== 'boolean') {
      console.warn('Skipping token metadata storage: invalid cached field');
      return;
    }

    // Generate embedding from token content
    const textContent = `${metadata.symbol.trim()} ${metadata.name.trim()} ${metadata.mintAddress.trim()} ${metadata.description?.trim() || ''}`;
    const vector = generateSimpleEmbedding(textContent);

    // Build clean payload with proper validation
    const cleanPayload: any = {
      id: metadata.id.trim(),
      mintAddress: metadata.mintAddress.trim(),
      symbol: metadata.symbol.trim(),
      name: metadata.name.trim(),
      decimals: Number(metadata.decimals),
      verified: Boolean(metadata.verified),
      cached: Boolean(metadata.cached),
      lastUpdated: Number(metadata.lastUpdated),
      cacheExpiry: Number(metadata.cacheExpiry)
    };
    
    // Only add optional fields if they're properly defined and valid
    if (metadata.logoURI && 
        typeof metadata.logoURI === 'string' && 
        metadata.logoURI.trim() !== '' &&
        metadata.logoURI.trim() !== 'undefined' &&
        metadata.logoURI.trim() !== 'null') {
      cleanPayload.logoURI = metadata.logoURI.trim();
    }
    
    if (metadata.metadataUri && 
        typeof metadata.metadataUri === 'string' && 
        metadata.metadataUri.trim() !== '' &&
        metadata.metadataUri.trim() !== 'undefined' &&
        metadata.metadataUri.trim() !== 'null') {
      cleanPayload.metadataUri = metadata.metadataUri.trim();
    }
    
    if (metadata.description && 
        typeof metadata.description === 'string' && 
        metadata.description.trim() !== '' &&
        metadata.description.trim() !== 'undefined' &&
        metadata.description.trim() !== 'null') {
      cleanPayload.description = metadata.description.trim();
    }

    // Generate a valid UUID for Qdrant point ID (Qdrant requires UUID or unsigned integer)
    const pointId = crypto.randomUUID();
    
    const upsertData = {
      wait: true,
      points: [{
        id: pointId, // Use UUID instead of mint address
        vector,
        payload: cleanPayload
      }]
    };

    try {
      await qdrantClient.upsert(COLLECTIONS.TOKEN_METADATA, upsertData);
    } catch (upsertError: any) {
      // Log detailed error information from Qdrant but don't throw
      // This is a cache operation and shouldn't break the main flow
      console.error('Failed to cache token metadata in Qdrant:', {
        mintAddress: metadata.mintAddress,
        symbol: metadata.symbol,
        errorMessage: upsertError?.message,
        errorStatus: upsertError?.status,
        errorUrl: upsertError?.url,
        payloadKeys: Object.keys(cleanPayload)
      });
      // Don't re-throw - caching failures shouldn't break the application
    }
  } catch (error) {
    // Log but don't throw - this is a non-critical caching operation
    console.warn('Error storing token metadata (non-critical):', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Get cached token metadata from Qdrant
 */
export async function getCachedTokenMetadata(
  mintAddress: string
): Promise<TokenMetadataEntry | null> {
  // Skip in browser
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    await ensureTokenMetadataCollection();

    const result = await qdrantClient.search(COLLECTIONS.TOKEN_METADATA, {
      vector: generateSimpleEmbedding(mintAddress),
      filter: {
        must: [
          { key: 'mintAddress', match: { value: mintAddress } }
        ]
      },
      limit: 1,
      with_payload: true
    });

    if (result.length > 0) {
      const metadata = result[0].payload as unknown as TokenMetadataEntry;
      const qdrantPointId = result[0].id; // Get the actual Qdrant point ID

      // Check if cache is still valid
      const now = Date.now();
      if (metadata.cacheExpiry > now) {
        return metadata;
      } else {
        console.log(`Token metadata cache expired for ${mintAddress}`);
        // Delete expired entry using the correct Qdrant point ID
        try {
          await qdrantClient.delete(COLLECTIONS.TOKEN_METADATA, {
            points: [qdrantPointId]
          });
        } catch (deleteError) {
          console.warn(`Failed to delete expired token metadata for ${mintAddress}:`, deleteError);
          // Don't throw - deletion failure shouldn't break the flow
        }
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting cached token metadata:', error);
    return null;
  }
}

/**
 * Batch get cached token metadata from Qdrant
 */
export async function batchGetCachedTokenMetadata(
  mintAddresses: string[]
): Promise<Map<string, TokenMetadataEntry>> {
  // Skip in browser
  if (typeof window !== 'undefined') {
    return new Map();
  }

  const results = new Map<string, TokenMetadataEntry>();

  try {
    await ensureTokenMetadataCollection();

    // Process in small batches to avoid overwhelming Qdrant
    const batchSize = 10;
    for (let i = 0; i < mintAddresses.length; i += batchSize) {
      const batch = mintAddresses.slice(i, i + batchSize);

      const promises = batch.map(async (mintAddress) => {
        const metadata = await getCachedTokenMetadata(mintAddress);
        if (metadata) {
          results.set(mintAddress, metadata);
        }
      });

      await Promise.all(promises);
    }

    return results;
  } catch (error) {
    console.error('Error batch getting cached token metadata:', error);
    return new Map();
  }
}

/**
 * Ensure program metadata collection exists with proper indexes
 */
async function ensureProgramMetadataCollection(): Promise<void> {
  const cacheKey = 'program_metadata_initialized';

  // Check if already initialized in this session
  if (collectionInitialized.get(cacheKey)) {
    return;
  }

  try {
    const exists = await qdrantClient.getCollection(COLLECTIONS.PROGRAM_METADATA).catch(() => null);

    if (!exists) {
      await qdrantClient.createCollection(COLLECTIONS.PROGRAM_METADATA, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      // Helper function to ensure index exists
      const ensureIndex = async (fieldName: string) => {
        try {
          await qdrantClient.createPayloadIndex(COLLECTIONS.PROGRAM_METADATA, {
            field_name: fieldName,
            field_schema: 'keyword'
          });
          console.log(`Created index for ${fieldName} in program metadata`);
        } catch (error: any) {
          if (error?.data?.status?.error?.includes('already exists') ||
            error?.message?.includes('already exists')) {
            // Index already exists, this is expected and not an error
          } else {
            console.warn(`Failed to create index for ${fieldName}:`, error?.data?.status?.error || error?.message);
          }
        }
      };

      // Ensure necessary indexes exist
      await ensureIndex('programId');
      await ensureIndex('name');
      await ensureIndex('category');
      await ensureIndex('verified');
      await ensureIndex('cached');
      // Mark as initialized
      collectionInitialized.set(cacheKey, true);

      console.log('Created program metadata collection');
    }

    console.log('Program metadata collection and indexes initialized successfully');

  } catch (error) {
    console.error('Error ensuring program metadata collection:', error);
    throw error;
  }
}

/**
 * Store program metadata entry in Qdrant
 */
export async function storeProgramMetadata(metadata: ProgramMetadataEntry): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  try {
    await ensureProgramMetadataCollection();

    // Validate metadata
    if (!metadata.id || !metadata.programId || !metadata.name) {
      throw new Error(`Invalid program metadata: missing required fields`);
    }

    // Generate embedding from program content
    const textContent = `${metadata.name} ${metadata.description || ''} ${metadata.category || ''} ${metadata.tags?.join(' ') || ''} ${metadata.programId}`;
    const vector = generateSimpleEmbedding(textContent);

    console.log(`Storing program metadata for: ${metadata.name} (${metadata.programId})`);

    const upsertData = {
      wait: true,
      points: [{
        id: metadata.id,
        vector,
        payload: {
          ...metadata,
          // Ensure all fields are properly serializable
          lastUpdated: Number(metadata.lastUpdated),
          cacheExpiry: Number(metadata.cacheExpiry),
          deployedSlot: metadata.deployedSlot ? Number(metadata.deployedSlot) : undefined
        }
      }]
    };

    await qdrantClient.upsert(COLLECTIONS.PROGRAM_METADATA, upsertData);
  } catch (error) {
    console.error('Error storing program metadata:', error);
    throw error;
  }
}

/**
 * Get cached program metadata from Qdrant
 */
export async function getCachedProgramMetadata(
  programId: string
): Promise<ProgramMetadataEntry | null> {
  // Skip in browser
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    await ensureProgramMetadataCollection();

    const result = await qdrantClient.search(COLLECTIONS.PROGRAM_METADATA, {
      vector: generateSimpleEmbedding(programId),
      filter: {
        must: [
          { key: 'programId', match: { value: programId } }
        ]
      },
      limit: 1,
      with_payload: true
    });

    if (result.length > 0) {
      const metadata = result[0].payload as unknown as ProgramMetadataEntry;
      const qdrantPointId = result[0].id; // Get the actual Qdrant point ID

      // Check if cache is still valid
      const now = Date.now();
      if (metadata.cacheExpiry > now) {
        return metadata;
      } else {
        console.log(`Program metadata cache expired for ${programId}`);
        // Delete expired entry using the correct Qdrant point ID
        try {
          await qdrantClient.delete(COLLECTIONS.PROGRAM_METADATA, {
            points: [qdrantPointId]
          });
        } catch (deleteError) {
          console.warn(`Failed to delete expired program metadata for ${programId}:`, deleteError);
          // Don't throw - deletion failure shouldn't break the flow
        }
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting cached program metadata:', error);
    return null;
  }
}

/**
 * Batch get cached program metadata from Qdrant
 */
export async function batchGetCachedProgramMetadata(
  programIds: string[]
): Promise<Map<string, ProgramMetadataEntry>> {
  // Skip in browser
  if (typeof window !== 'undefined') {
    return new Map();
  }

  const results = new Map<string, ProgramMetadataEntry>();

  try {
    await ensureProgramMetadataCollection();

    // Process in small batches to avoid overwhelming Qdrant
    const batchSize = 10;
    for (let i = 0; i < programIds.length; i += batchSize) {
      const batch = programIds.slice(i, i + batchSize);

      const promises = batch.map(async (programId) => {
        const metadata = await getCachedProgramMetadata(programId);
        if (metadata) {
          results.set(programId, metadata);
        }
      });

      await Promise.all(promises);
    }

    return results;
  } catch (error) {
    console.error('Error batch getting cached program metadata:', error);
    return new Map();
  }
}

/**
 * Global Chat Message Storage Functions
 */

// Global chat message interface for Qdrant storage
export interface GlobalChatMessage {
  id: string;
  username: string;
  walletAddress?: string;
  message: string;
  timestamp: number;
  isGuest: boolean;
  userColor: string;
}

/**
 * Ensure global chat collection exists with proper indexes
 */
async function ensureGlobalChatCollection(): Promise<void> {
  const cacheKey = 'global_chat_initialized';

  // Check if already initialized in this session
  if (collectionInitialized.get(cacheKey)) {
    return;
  }

  try {
    const exists = await withTimeout(qdrantClient.getCollection(COLLECTIONS.GLOBAL_CHAT)).catch(() => null);

    // Helper function to ensure index exists
    const ensureIndex = async (fieldName: string, fieldType: 'keyword' | 'integer' | 'bool' = 'keyword') => {
      try {
        await withTimeout(qdrantClient.createPayloadIndex(COLLECTIONS.GLOBAL_CHAT, {
          field_name: fieldName,
          field_schema: fieldType
        }));
        console.log(`Created index for ${fieldName} in global_chat`);
      } catch (error: any) {
        if (error?.data?.status?.error?.includes('already exists') ||
          error?.message?.includes('already exists')) {
          // Index already exists, this is expected and not an error
        } else {
          console.warn(`Failed to create index for ${fieldName}:`, error?.data?.status?.error || error?.message);
        }
      }
    };

    if (!exists) {
      await withTimeout(qdrantClient.createCollection(COLLECTIONS.GLOBAL_CHAT, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      }));
      console.log('Created global_chat collection');
    }

    // Always ensure indexes exist, even for existing collections
    await ensureIndex('username');
    await ensureIndex('walletAddress');
    await ensureIndex('timestamp', 'integer');
    await ensureIndex('isGuest', 'bool');

    // Mark as initialized
    collectionInitialized.set(cacheKey, true);
    console.log('Global chat collection and indexes initialized successfully');

  } catch (error) {
    console.error('Error ensuring global chat collection:', error);
    throw error;
  }
}

/**
 * Store global chat message in Qdrant with vector embedding for semantic search
 */
export async function storeGlobalChatMessage(message: GlobalChatMessage): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  try {
    await withTimeout(ensureGlobalChatCollection());

    // Validate message data
    if (!message.id || !message.username || !message.message) {
      throw new Error(`Invalid chat message: missing required fields`);
    }

    // Validate and sanitize all fields to prevent Qdrant Bad Request errors
    if (!message.id || typeof message.id !== 'string' || message.id.trim() === '') {
      throw new Error('Invalid message ID');
    }
    
    if (!message.username || typeof message.username !== 'string' || message.username.trim() === '') {
      throw new Error('Invalid username');
    }
    
    if (!message.message || typeof message.message !== 'string' || message.message.trim() === '') {
      throw new Error('Invalid message content');
    }
    
    if (!Number.isInteger(message.timestamp) || message.timestamp <= 0) {
      throw new Error('Invalid timestamp');
    }
    
    if (typeof message.isGuest !== 'boolean') {
      throw new Error('Invalid isGuest field');
    }
    
    if (!message.userColor || typeof message.userColor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(message.userColor)) {
      throw new Error('Invalid userColor field');
    }

    // Generate embedding from message content for semantic search capabilities
    const textContent = `${message.username.trim()} ${message.message.trim()}`;
    const vector = generateSimpleEmbedding(textContent);

    console.log(`Storing global chat message from: ${message.username} (${message.isGuest ? 'guest' : 'user'})`);

    // Build clean payload with proper validation
    const cleanPayload: any = {
      id: message.id.trim(),
      username: message.username.trim(),
      message: message.message.trim(),
      timestamp: Number(message.timestamp),
      isGuest: Boolean(message.isGuest),
      userColor: message.userColor.trim()
    };
    
    // Only add walletAddress if it's properly defined and valid
    if (message.walletAddress && 
        typeof message.walletAddress === 'string' && 
        message.walletAddress.trim() !== '' &&
        message.walletAddress.trim() !== 'undefined' &&
        message.walletAddress.trim() !== 'null') {
      cleanPayload.walletAddress = message.walletAddress.trim();
    }

    const upsertData = {
      wait: true,
      points: [{
        id: message.id.trim(),
        vector,
        payload: cleanPayload
      }]
    };

    await withTimeout(qdrantClient.upsert(COLLECTIONS.GLOBAL_CHAT, upsertData));
  } catch (error) {
    console.error('Error storing global chat message:', error);
    throw error;
  }
}

/**
 * Get global chat messages from Qdrant with pagination and filtering
 */
export async function getGlobalChatMessages(
  options: {
    limit?: number;
    offset?: number;
    username?: string;
    walletAddress?: string;
    guestsOnly?: boolean;
    usersOnly?: boolean;
    since?: number; // timestamp
  } = {}
): Promise<{ messages: GlobalChatMessage[]; total: number }> {
  // Skip in browser - return empty result
  if (typeof window !== 'undefined') {
    return { messages: [], total: 0 };
  }

  try {
    await withTimeout(ensureGlobalChatCollection());

    const { limit = 100, offset = 0, username, walletAddress, guestsOnly, usersOnly, since } = options;

    // Build filter
    const filter: any = {
      must: []
    };

    // Filter by username if provided
    if (username) {
      filter.must.push({
        key: 'username',
        match: { value: username }
      });
    }

    // Filter by wallet address if provided
    if (walletAddress) {
      filter.must.push({
        key: 'walletAddress',
        match: { value: walletAddress }
      });
    }

    // Filter by user type
    if (guestsOnly) {
      filter.must.push({
        key: 'isGuest',
        match: { value: true }
      });
    } else if (usersOnly) {
      filter.must.push({
        key: 'isGuest',
        match: { value: false }
      });
    }

    // Filter by timestamp if provided (messages since a certain time)
    if (since) {
      filter.must.push({
        key: 'timestamp',
        range: { gte: since }
      });
    }

    // Use search with dummy vector for filtered retrieval
    const searchParams: any = {
      vector: new Array(384).fill(0), // Dummy vector for filtered search
      limit,
      offset,
      with_payload: true
    };

    if (filter.must.length > 0) {
      searchParams.filter = filter;
    }

    // Search for messages
    const result = await withTimeout(qdrantClient.search(COLLECTIONS.GLOBAL_CHAT, searchParams));

    // Get total count
    const countParams: any = {};
    if (filter.must.length > 0) {
      countParams.filter = filter;
    }
    const countResult = await withTimeout(qdrantClient.count(COLLECTIONS.GLOBAL_CHAT, countParams));

    // Extract messages from search results
    const messages = result.map(point => point.payload as unknown as GlobalChatMessage);

    // Sort by timestamp (newest first) since we can't rely on Qdrant ordering
    messages.sort((a, b) => b.timestamp - a.timestamp);

    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Retrieved ${messages.length} global chat messages out of ${countResult.count} total`);
      if (messages.length > 0) {
        const recentMessage = messages[0];
        const hoursAgo = Math.round((Date.now() - recentMessage.timestamp) / (1000 * 60 * 60));
        console.log(`Most recent message: ${recentMessage.username} - ${hoursAgo}h ago`);
      }
    }

    return {
      messages,
      total: countResult.count
    };
  } catch (error) {
    console.error('Error getting global chat messages:', error);
    // Re-throw the error so API routes can catch it and use fallback
    throw error;
  }
}

/**
 * Delete global chat messages (for moderation or cleanup)
 */
export async function deleteGlobalChatMessage(messageId: string): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  try {
    await ensureGlobalChatCollection();

    await qdrantClient.delete(COLLECTIONS.GLOBAL_CHAT, {
      wait: true,
      points: [messageId]
    });

    console.log(`Deleted global chat message: ${messageId}`);
  } catch (error) {
    console.error('Error deleting global chat message:', error);
    throw error;
  }
}

/**
 * Batch store multiple global chat messages efficiently
 */
export async function batchStoreGlobalChatMessages(messages: GlobalChatMessage[]): Promise<void> {
  // Skip in browser
  if (typeof window !== 'undefined') return;

  if (messages.length === 0) return;

  try {
    await ensureGlobalChatCollection();

    console.log(`Batch storing ${messages.length} global chat messages`);

    // Prepare points for batch operation
    const points = messages.map(message => {
      // Validate message data
      if (!message.id || !message.username || !message.message) {
        throw new Error(`Invalid chat message data: missing required fields for ${message.id}`);
      }

      // Generate embedding from message content
      const textContent = `${message.username} ${message.message}`;
      const vector = generateSimpleEmbedding(textContent);

      return {
        id: message.id,
        vector,
        payload: {
          ...message,
          timestamp: Number(message.timestamp)
        }
      };
    });

    const upsertData = {
      wait: true,
      points
    };

    await qdrantClient.upsert(COLLECTIONS.GLOBAL_CHAT, upsertData);
    console.log(`Successfully batch stored ${messages.length} global chat messages`);

  } catch (error) {
    console.error(`Error batch storing ${messages.length} global chat messages:`, error);
    throw error;
  }
}
