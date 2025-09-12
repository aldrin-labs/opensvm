/**
 * User Statistics Synchronization System
 * Handles unified stats calculation and updates across all user profile data
 */

import { qdrantClient } from '@/lib/qdrant';
import { UserProfile } from '@/types/user-history';

/**
 * Calculate accurate social stats for a user by querying the actual data
 */
export async function calculateUserSocialStats(walletAddress: string): Promise<{
  followers: number;
  following: number;
  likes: number;
  profileViews: number;
}> {
  try {
    // Count followers (users who follow this wallet)
    const followersResult = await qdrantClient.search('user_follows', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'targetAddress', match: { value: walletAddress } }]
      },
      limit: 10000,
      with_payload: false // We only need count
    });

    // Count following (users this wallet follows)  
    const followingResult = await qdrantClient.search('user_follows', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'followerAddress', match: { value: walletAddress } }]
      },
      limit: 10000,
      with_payload: false
    });

    // Count likes received
    const likesResult = await qdrantClient.search('user_likes', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'targetAddress', match: { value: walletAddress } }]
      },
      limit: 10000,
      with_payload: false
    });

    // Get current profile to preserve profile views (as it's tracked separately)
    let profileViews = 0;
    try {
      const profileResult = await qdrantClient.search('user_profiles', {
        vector: new Array(384).fill(0),
        filter: {
          must: [{ key: 'walletAddress', match: { value: walletAddress } }]
        },
        limit: 1,
        with_payload: true
      });

      if (profileResult.length > 0) {
        const profile = profileResult[0].payload as any;
        profileViews = profile.socialStats?.profileViews || 0;
      }
    } catch (error) {
      console.warn('Could not get current profile views:', error);
    }

    return {
      followers: followersResult.length,
      following: followingResult.length,
      likes: likesResult.length,
      profileViews: profileViews
    };
  } catch (error) {
    console.error('Error calculating social stats for', walletAddress, ':', error);
    return {
      followers: 0,
      following: 0,
      likes: 0,
      profileViews: 0
    };
  }
}

/**
 * Synchronize user profile stats with actual data
 */
export async function syncUserProfileStats(walletAddress: string): Promise<UserProfile | null> {
  try {
    // Get current profile
    const profileResult = await qdrantClient.search('user_profiles', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: walletAddress } }]
      },
      limit: 1,
      with_payload: true
    });

    if (profileResult.length === 0) {
      console.warn('No profile found for wallet:', walletAddress);
      return null;
    }

    const profile = profileResult[0].payload as any;
    const pointId = profileResult[0].id;

    // Calculate accurate social stats
    const socialStats = await calculateUserSocialStats(walletAddress);

    // Preserve existing socialStats but override with accurate counts
    const updatedSocialStats = {
      ...profile.socialStats,
      followers: socialStats.followers,
      following: socialStats.following,
      likes: socialStats.likes,
      profileViews: socialStats.profileViews,
      visitsByUsers: profile.socialStats?.visitsByUsers || 0 // Keep existing or 0
    };

    // Update profile with synchronized stats
    const updatedProfile = {
      ...profile,
      socialStats: updatedSocialStats,
      lastStatsSync: Date.now()
    };

    // Generate embedding for the profile
    const textContent = `${profile.walletAddress} ${profile.displayName || ''} ${profile.bio || ''}`;
    const vector = generateSimpleEmbedding(textContent);

    // Update the profile in Qdrant
    await qdrantClient.upsert('user_profiles', {
      wait: true,
      points: [{
        id: pointId,
        vector: vector,
        payload: updatedProfile
      }]
    });

    console.log(`Synchronized stats for ${walletAddress}:`, updatedSocialStats);
    return updatedProfile as UserProfile;

  } catch (error) {
    console.error('Error syncing user profile stats:', error);
    return null;
  }
}

/**
 * Batch synchronize multiple user profiles
 */
export async function batchSyncUserProfileStats(walletAddresses: string[]): Promise<void> {
  try {
    console.log(`Starting batch sync for ${walletAddresses.length} profiles`);
    
    const promises = walletAddresses.map(async (walletAddress) => {
      try {
        await syncUserProfileStats(walletAddress);
      } catch (error) {
        console.error(`Failed to sync stats for ${walletAddress}:`, error);
      }
    });

    await Promise.all(promises);
    console.log(`Completed batch sync for ${walletAddresses.length} profiles`);
  } catch (error) {
    console.error('Error in batch sync:', error);
  }
}

/**
 * Check if profile stats need synchronization (stale data)
 */
export async function needsStatsSync(walletAddress: string, maxAge: number = 5 * 60 * 1000): Promise<boolean> {
  try {
    const profileResult = await qdrantClient.search('user_profiles', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: walletAddress } }]
      },
      limit: 1,
      with_payload: true
    });

    if (profileResult.length === 0) {
      return true; // No profile, needs sync
    }

    const profile = profileResult[0].payload as any;
    const lastSync = profile.lastStatsSync || 0;
    const now = Date.now();

    return (now - lastSync) > maxAge;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return true; // Default to needing sync on error
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
 * Auto-sync stats for profiles that are frequently accessed
 */
export async function autoSyncPopularProfiles(): Promise<void> {
  try {
    // Get profiles that have been viewed recently (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const recentProfilesResult = await qdrantClient.search('user_profiles', {
      vector: new Array(384).fill(0),
      filter: {
        must: [
          { key: 'lastViewTime', range: { gte: oneDayAgo } }
        ]
      },
      limit: 100, // Limit to most active 100 profiles
      with_payload: true
    });

    const walletAddresses = recentProfilesResult.map(result => {
      const profile = result.payload as any;
      return profile.walletAddress;
    }).filter(addr => addr);

    if (walletAddresses.length > 0) {
      console.log(`Auto-syncing ${walletAddresses.length} popular profiles`);
      await batchSyncUserProfileStats(walletAddresses);
    }
  } catch (error) {
    console.error('Error in auto-sync popular profiles:', error);
  }
}

/**
 * Repair all user profiles with inconsistent data
 */
export async function repairAllUserProfiles(): Promise<{
  processed: number;
  repaired: number;
  errors: number;
}> {
  let processed = 0;
  let repaired = 0;
  let errors = 0;

  try {
    console.log('Starting user profiles repair...');

    // Get all user profiles
    const allProfilesResult = await qdrantClient.search('user_profiles', {
      vector: new Array(384).fill(0),
      limit: 10000, // Adjust based on your user count
      with_payload: true
    });

    console.log(`Found ${allProfilesResult.length} profiles to check`);

    for (const profilePoint of allProfilesResult) {
      try {
        processed++;
        const profile = profilePoint.payload as any;
        const walletAddress = profile.walletAddress;

        if (!walletAddress) {
          console.warn('Profile missing wallet address, skipping');
          continue;
        }

        // Check if profile needs repair by comparing current vs calculated stats
        const calculatedStats = await calculateUserSocialStats(walletAddress);
        const currentStats = profile.socialStats || {};

        const needsRepair = (
          currentStats.followers !== calculatedStats.followers ||
          currentStats.following !== calculatedStats.following ||
          currentStats.likes !== calculatedStats.likes
        );

        if (needsRepair) {
          await syncUserProfileStats(walletAddress);
          repaired++;
          console.log(`Repaired profile for ${walletAddress}: followers ${currentStats.followers}->${calculatedStats.followers}, following ${currentStats.following}->${calculatedStats.following}, likes ${currentStats.likes}->${calculatedStats.likes}`);
        }

        // Add small delay to avoid overwhelming the database
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log(`Processed ${processed}/${allProfilesResult.length} profiles...`);
        }

      } catch (error) {
        errors++;
        console.error(`Error processing profile ${processed}:`, error);
      }
    }

    console.log(`User profiles repair completed: processed=${processed}, repaired=${repaired}, errors=${errors}`);
    
    return { processed, repaired, errors };
  } catch (error) {
    console.error('Error in repairAllUserProfiles:', error);
    return { processed, repaired, errors };
  }
}
