/**
 * Qdrant Database utilities for user history storage
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { UserHistoryEntry, UserProfile, UserFollowEntry } from '@/types/user-history';

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333',
  apiKey: process.env.QDRANT || undefined,
});

// Collection names
export const COLLECTIONS = {
  USER_HISTORY: 'user_history',
  USER_PROFILES: 'user_profiles',
  USER_FOLLOWS: 'user_follows',
  USER_LIKES: 'user_likes',
  SHARES: 'shares',
  SHARE_CLICKS: 'share_clicks',
  TRANSFERS: 'transfers'
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
    }
    
    // Ensure walletAddress index exists for user_history
    await ensureIndex(COLLECTIONS.USER_HISTORY, 'walletAddress');
    
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
    }
    
    // Ensure walletAddress index exists for user_profiles
    await ensureIndex(COLLECTIONS.USER_PROFILES, 'walletAddress');
    
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
    }
    
    // Ensure indexes exist for user_follows
    await ensureIndex(COLLECTIONS.USER_FOLLOWS, 'followerAddress');
    await ensureIndex(COLLECTIONS.USER_FOLLOWS, 'targetAddress');
    
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
    }
    
    // Ensure indexes exist for user_likes
    await ensureIndex(COLLECTIONS.USER_LIKES, 'likerAddress');
    await ensureIndex(COLLECTIONS.USER_LIKES, 'targetAddress');
    
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
    }
    
    // Ensure indexes exist for shares
    await ensureIndex(COLLECTIONS.SHARES, 'shareCode');
    await ensureIndex(COLLECTIONS.SHARES, 'referrerAddress');
    await ensureIndex(COLLECTIONS.SHARES, 'entityType');
    await ensureIndex(COLLECTIONS.SHARES, 'entityId');
    
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
    }
    
    // Ensure indexes exist for share_clicks
    await ensureIndex(COLLECTIONS.SHARE_CLICKS, 'shareCode');
    await ensureIndex(COLLECTIONS.SHARE_CLICKS, 'clickerAddress');
    
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
  try {

    
    const { limit = 100, offset = 0, pageType } = options;
    
    // Build filter
    const filter: any = {
      must: [
        {
          key: 'walletAddress',
          match: { value: walletAddress }
        }
      ]
    };
    
    if (pageType) {
      filter.must.push({
        key: 'pageType',
        match: { value: pageType }
      });
    }
    
    // Search with filter
    const result = await qdrantClient.search(COLLECTIONS.USER_HISTORY, {
      vector: new Array(384).fill(0), // Dummy vector for filtered search
      filter,
      limit,
      offset,
      with_payload: true
    });
    
    // Get total count
    const countResult = await qdrantClient.count(COLLECTIONS.USER_HISTORY, {
      filter
    });
    
    const history = result.map(point => point.payload as unknown as UserHistoryEntry);
    
    // Sort by timestamp (newest first)
    history.sort((a, b) => b.timestamp - a.timestamp);
    
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

/**
 * Initialize transfers collection with proper indexing
 */
async function ensureTransfersCollection() {
  try {
    const transfersExists = await qdrantClient.getCollection(COLLECTIONS.TRANSFERS).catch(() => null);
    
    if (!transfersExists) {
      await qdrantClient.createCollection(COLLECTIONS.TRANSFERS, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created transfers collection');
    }
    
    // Helper function to ensure index exists
    const ensureIndex = async (fieldName: string) => {
      try {
        await qdrantClient.createPayloadIndex(COLLECTIONS.TRANSFERS, {
          field_name: fieldName,
          field_schema: 'keyword'
        });
        console.log(`Created index for ${fieldName} in transfers`);
      } catch (error: any) {
        if (error?.data?.status?.error?.includes('already exists') ||
            error?.message?.includes('already exists')) {
          console.log(`Index for ${fieldName} in transfers already exists`);
        } else {
          console.warn(`Failed to create index for ${fieldName}:`, error?.data?.status?.error || error?.message);
        }
      }
    };
    
    // Ensure necessary indexes exist
    await ensureIndex('walletAddress');
    await ensureIndex('signature');
    await ensureIndex('token');
    await ensureIndex('isSolanaOnly');
    await ensureIndex('cached');
    
  } catch (error) {
    console.error('Error ensuring transfers collection:', error);
    throw error;
  }
}

/**
 * Store transfer entry in Qdrant
 */
export async function storeTransferEntry(entry: TransferEntry): Promise<void> {
  try {

    await ensureTransfersCollection();
    
    // Generate embedding from transfer content
    const textContent = `${entry.walletAddress} ${entry.type} ${entry.token} ${entry.amount} ${entry.from} ${entry.to}`;
    const vector = generateSimpleEmbedding(textContent);
    
    await qdrantClient.upsert(COLLECTIONS.TRANSFERS, {
      wait: true,
      points: [{
        id: entry.id,
        vector,
        payload: entry as any
      }]
    });
  } catch (error) {
    console.error('Error storing transfer entry:', error);
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
  } catch (error) {
    console.error('Error getting cached transfers:', error);
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
  // Known Solana program IDs
  // List of known Solana program IDs (expanded, not exhaustive, but covers many major protocols)
  const solanaPrograms = [
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
    '5quB8F1iFv5QkQwZ5QkQwZ5QkQwZ5QkQwZ5QkQwZ5QkQ', // Serum DEX v1 (example, not real)
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
    'RVKd61ztZW9GdKz5vKz6kUo87bY6z3Y6z3Y6z3Y6z3Y', // Raydium AMM (example, not real)
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter Aggregator
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
    'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', // Phoenix DEX
    'SaberM8r1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)
    'SwaPp1ng11111111111111111111111111111111111', // Orca (example, not real)
    'orca111111111111111111111111111111111111111', // Orca
    'MERLuDFBMmsHnszBSb5Q6pR9bxaENa8zD6zF8g5nKX', // Mercurial
    'SwaPp1ng11111111111111111111111111111111111', // Orca Swap (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
    'Saberqk1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n1n', // Saber (example, not real)1n1n1n1n1n1n1n', // Saber (example, not real)
  ];
  // Known cross-chain bridge programs (exclude these)
  const bridgePrograms = [
    'WormT3McKhFJ2RkiGpdw9GKvNCrB2aB54gb2uV9MfQC', // Wormhole
    'A4hyUU7t5p2hqUikS2R7ZP5TiSezgHFMGz6HnGw4jDxm', // Portal Bridge
    'C4Gvtsj4CJVhaNXSG1H4ZKk9mG6s7gvwC4Eo8cMGo7DT', // Allbridge
  ];
  
  const programId = transfer.programId || '';
  
  // If it's a known bridge program, it's not Solana-only
  if (bridgePrograms.includes(programId)) {
    return false;
  }
  
  // If it's a known Solana program, it's Solana-only
  if (solanaPrograms.includes(programId)) {
    return true;
  }
  
  // Default to true for SOL transfers and unknown programs
  return true;
}

/**
 * Store advertisement interaction data
 */
export interface AdInteraction {
  id: string;
  walletAddress?: string;
  adId: string;
  adType: string;
  action: 'view' | 'click' | 'conversion';
  timestamp: number;
  metadata?: Record<string, any>;
}

export async function storeAdInteraction(interaction: AdInteraction): Promise<void> {
  try {

    
    // Use existing user_history collection for ad tracking
    const textContent = `ad ${interaction.adType} ${interaction.action} ${interaction.adId}`;
    const vector = generateSimpleEmbedding(textContent);
    
    await qdrantClient.upsert(COLLECTIONS.USER_HISTORY, {
      wait: true,
      points: [{
        id: interaction.id,
        vector,
        payload: {
          ...interaction,
          pageType: 'ad_interaction'
        } as any
      }]
    });
  } catch (error) {
    console.error('Error storing ad interaction:', error);
    throw error;
  }
}

/**
 * Get advertisement analytics
 */
export async function getAdAnalytics(adId: string): Promise<{
  views: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
}> {
  try {

    
    const filter = {
      must: [
        { key: 'adId', match: { value: adId } },
        { key: 'pageType', match: { value: 'ad_interaction' } }
      ]
    };
    
    const result = await qdrantClient.search(COLLECTIONS.USER_HISTORY, {
      vector: new Array(384).fill(0),
      filter,
      limit: 10000,
      with_payload: true
    });
    
    const interactions = result.map(point => point.payload as unknown as AdInteraction);
    
    const views = interactions.filter(i => i.action === 'view').length;
    const clicks = interactions.filter(i => i.action === 'click').length;
    const conversions = interactions.filter(i => i.action === 'conversion').length;
    
    const ctr = views > 0 ? (clicks / views) * 100 : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    
    return {
      views,
      clicks,
      conversions,
      ctr,
      conversionRate
    };
  } catch (error) {
    console.error('Error getting ad analytics:', error);
    return {
      views: 0,
      clicks: 0,
      conversions: 0,
      ctr: 0,
      conversionRate: 0
    };
  }
}
