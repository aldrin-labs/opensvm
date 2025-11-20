/**
 * User History Repair System
 * Handles comprehensive repair and synchronization of user history and activity data
 */

import { qdrantClient } from '@/lib/search/qdrant';
import { UserHistoryEntry, UserHistoryStats } from '@/types/user-history';
import { calculateStats } from '@/lib/user/user-history-utils';

/**
 * Repair user history and activity data for a specific user
 */
export async function repairUserHistory(walletAddress: string): Promise<{
  success: boolean;
  stats: UserHistoryStats | null;
  repaired: {
    duplicatesRemoved: number;
    entriesFixed: number;
    statsRecalculated: boolean;
  };
  errors?: string[];
}> {
  const errors: string[] = [];
  let duplicatesRemoved = 0;
  let entriesFixed = 0;
  let stats: UserHistoryStats | null = null;

  try {
    console.log(`Starting history repair for ${walletAddress}`);

    // Step 1: Get all history entries for the user
    const historyResult = await qdrantClient.search('user_history', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: walletAddress } }]
      },
      limit: 10000, // Get all entries
      with_payload: true
    });

    if (historyResult.length === 0) {
      console.log(`No history entries found for ${walletAddress}`);
      return {
        success: true,
        stats: calculateStats([]),
        repaired: {
          duplicatesRemoved: 0,
          entriesFixed: 0,
          statsRecalculated: true
        }
      };
    }

    console.log(`Found ${historyResult.length} history entries for ${walletAddress}`);

    // Step 2: Extract and validate history entries
    const entries: UserHistoryEntry[] = [];
    const seenEntries = new Set<string>();
    const entriesToDelete: string[] = [];

    for (const result of historyResult) {
      try {
        const entry = result.payload as any;
        const pointId = result.id as string;

        // Validate required fields
        if (!entry.id || !entry.walletAddress || !entry.timestamp || !entry.path) {
          console.warn(`Invalid entry found, will delete: ${pointId}`);
          entriesToDelete.push(pointId);
          entriesFixed++;
          continue;
        }

        // Check for duplicates (same path + timestamp within 1 second)
        const dedupeKey = `${entry.path}_${Math.floor(entry.timestamp / 1000)}`;
        if (seenEntries.has(dedupeKey)) {
          console.log(`Duplicate entry found, will delete: ${pointId}`);
          entriesToDelete.push(pointId);
          duplicatesRemoved++;
          continue;
        }
        seenEntries.add(dedupeKey);

        // Validate and fix entry data
        const fixedEntry: UserHistoryEntry = {
          id: entry.id || crypto.randomUUID(),
          walletAddress: walletAddress,
          timestamp: Number(entry.timestamp) || Date.now(),
          path: String(entry.path || '/'),
          pageTitle: String(entry.pageTitle || 'Unknown Page'),
          pageType: entry.pageType || 'other',
          userAgent: String(entry.userAgent || ''),
          referrer: String(entry.referrer || ''),
          metadata: entry.metadata || {}
        };

        // Check if entry needs fixing
        const needsFix = (
          entry.id !== fixedEntry.id ||
          entry.walletAddress !== fixedEntry.walletAddress ||
          entry.timestamp !== fixedEntry.timestamp ||
          entry.path !== fixedEntry.path ||
          entry.pageTitle !== fixedEntry.pageTitle ||
          entry.pageType !== fixedEntry.pageType
        );

        if (needsFix) {
          // Update the entry in Qdrant
          await qdrantClient.upsert('user_history', {
            wait: true,
            points: [{
              id: pointId,
              vector: generateHistoryEmbedding(fixedEntry),
              payload: fixedEntry as any
            }]
          });
          entriesFixed++;
          console.log(`Fixed entry: ${pointId}`);
        }

        entries.push(fixedEntry);

      } catch (entryError) {
        console.error(`Error processing entry ${result.id}:`, entryError);
        errors.push(`Failed to process entry ${result.id}: ${entryError}`);
      }
    }

    // Step 3: Delete invalid/duplicate entries
    if (entriesToDelete.length > 0) {
      console.log(`Deleting ${entriesToDelete.length} invalid/duplicate entries`);
      await qdrantClient.delete('user_history', {
        wait: true,
        points: entriesToDelete
      });
    }

    // Step 4: Recalculate stats
    stats = calculateStats(entries);
    console.log(`Recalculated stats for ${walletAddress}:`, stats);

    // Step 5: Update user profile with correct stats
    try {
      await updateUserProfileStats(walletAddress, stats, entries.length);
    } catch (profileError) {
      console.error('Error updating profile stats:', profileError);
      errors.push(`Failed to update profile stats: ${profileError}`);
    }

    return {
      success: true,
      stats,
      repaired: {
        duplicatesRemoved,
        entriesFixed,
        statsRecalculated: true
      },
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error(`Error repairing history for ${walletAddress}:`, error);
    return {
      success: false,
      stats: null,
      repaired: {
        duplicatesRemoved,
        entriesFixed,
        statsRecalculated: false
      },
      errors: [String(error)]
    };
  }
}

/**
 * Update user profile with corrected history stats
 */
async function updateUserProfileStats(
  walletAddress: string, 
  historyStats: UserHistoryStats,
  totalEntries: number
): Promise<void> {
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
      console.log(`No profile found for ${walletAddress}, creating basic profile`);
      // Create basic profile with history stats
      const newProfile = {
        walletAddress,
        isPublic: true,
        createdAt: Date.now(),
        lastActive: historyStats.lastVisit || Date.now(),
        stats: historyStats,
        socialStats: {
          visitsByUsers: 0,
          followers: 0,
          following: 0,
          likes: 0,
          profileViews: 0
        },
        history: [],
        lastHistorySync: Date.now()
      };

      await qdrantClient.upsert('user_profiles', {
        wait: true,
        points: [{
          id: crypto.randomUUID(),
          vector: generateProfileEmbedding(newProfile),
          payload: newProfile as any
        }]
      });
    } else {
      // Update existing profile
      const profile = profileResult[0].payload as any;
      const pointId = profileResult[0].id;

      const updatedProfile = {
        ...profile,
        stats: historyStats,
        lastActive: Math.max(profile.lastActive || 0, historyStats.lastVisit || 0),
        lastHistorySync: Date.now()
      };

      await qdrantClient.upsert('user_profiles', {
        wait: true,
        points: [{
          id: pointId,
          vector: generateProfileEmbedding(updatedProfile),
          payload: updatedProfile as any
        }]
      });
    }

    console.log(`Updated profile stats for ${walletAddress}: ${totalEntries} total entries`);
  } catch (error) {
    console.error(`Error updating profile stats for ${walletAddress}:`, error);
    throw error;
  }
}

/**
 * Repair all user histories in the system
 */
export async function repairAllUserHistories(): Promise<{
  processed: number;
  repaired: number;
  errors: number;
  totalEntriesProcessed: number;
  totalDuplicatesRemoved: number;
  totalEntriesFixed: number;
}> {
  let processed = 0;
  let repaired = 0;
  let errors = 0;
  let totalEntriesProcessed = 0;
  let totalDuplicatesRemoved = 0;
  let totalEntriesFixed = 0;

  try {
    console.log('Starting comprehensive user history repair...');

    // Get all unique wallet addresses from user_history
    const allHistoryResult = await qdrantClient.search('user_history', {
      vector: new Array(384).fill(0),
      limit: 50000, // Adjust based on your data size
      with_payload: true
    });

    // Extract unique wallet addresses
    const walletAddresses = new Set<string>();
    for (const result of allHistoryResult) {
      const entry = result.payload as any;
      if (entry.walletAddress) {
        walletAddresses.add(entry.walletAddress);
      }
    }

    console.log(`Found ${walletAddresses.size} unique wallet addresses to repair`);

    // Repair each user's history
    for (const walletAddress of walletAddresses) {
      try {
        processed++;
        console.log(`Repairing history ${processed}/${walletAddresses.size}: ${walletAddress}`);

        const result = await repairUserHistory(walletAddress);
        
        if (result.success) {
          repaired++;
          totalDuplicatesRemoved += result.repaired.duplicatesRemoved;
          totalEntriesFixed += result.repaired.entriesFixed;
          
          if (result.stats) {
            totalEntriesProcessed += result.stats.totalVisits;
          }

          if (result.repaired.duplicatesRemoved > 0 || result.repaired.entriesFixed > 0) {
            console.log(`Repaired ${walletAddress}: duplicates=${result.repaired.duplicatesRemoved}, fixes=${result.repaired.entriesFixed}`);
          }
        } else {
          errors++;
          console.error(`Failed to repair ${walletAddress}:`, result.errors);
        }

        // Add delay to prevent overwhelming the database
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        errors++;
        console.error(`Error repairing history for ${walletAddress}:`, error);
      }
    }

    console.log(`User history repair completed: processed=${processed}, repaired=${repaired}, errors=${errors}`);
    console.log(`Total entries processed: ${totalEntriesProcessed}, duplicates removed: ${totalDuplicatesRemoved}, entries fixed: ${totalEntriesFixed}`);

    return {
      processed,
      repaired,
      errors,
      totalEntriesProcessed,
      totalDuplicatesRemoved,
      totalEntriesFixed
    };

  } catch (error) {
    console.error('Error in comprehensive history repair:', error);
    return {
      processed,
      repaired,
      errors: errors + 1,
      totalEntriesProcessed,
      totalDuplicatesRemoved,
      totalEntriesFixed
    };
  }
}

/**
 * Generate embedding for history entry
 */
function generateHistoryEmbedding(entry: UserHistoryEntry): number[] {
  const textContent = `${entry.pageTitle} ${entry.path} ${entry.pageType} ${JSON.stringify(entry.metadata)}`;
  return generateSimpleEmbedding(textContent);
}

/**
 * Generate embedding for user profile
 */
function generateProfileEmbedding(profile: any): number[] {
  const textContent = `${profile.walletAddress} ${profile.displayName || ''} ${profile.bio || ''}`;
  return generateSimpleEmbedding(textContent);
}

/**
 * Generate a simple embedding for text content
 */
function generateSimpleEmbedding(text: string): number[] {
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const vector = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.sin(hash + i) * 0.1;
  }

  return vector;
}

/**
 * Get history repair status for a user
 */
export async function getUserHistoryStatus(walletAddress: string): Promise<{
  totalEntries: number;
  validEntries: number;
  duplicateEntries: number;
  invalidEntries: number;
  lastRepair: number | null;
  needsRepair: boolean;
}> {
  try {
    // Get all entries for the user
    const historyResult = await qdrantClient.search('user_history', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: walletAddress } }]
      },
      limit: 10000,
      with_payload: true
    });

    const entries = historyResult.map(r => r.payload as any);
    const totalEntries = entries.length;
    let validEntries = 0;
    let duplicateEntries = 0;
    let invalidEntries = 0;

    const seenEntries = new Set<string>();

    for (const entry of entries) {
      // Check if entry is valid
      if (!entry.id || !entry.walletAddress || !entry.timestamp || !entry.path) {
        invalidEntries++;
        continue;
      }

      // Check for duplicates
      const dedupeKey = `${entry.path}_${Math.floor(entry.timestamp / 1000)}`;
      if (seenEntries.has(dedupeKey)) {
        duplicateEntries++;
        continue;
      }
      seenEntries.add(dedupeKey);

      validEntries++;
    }

    // Get last repair timestamp from profile
    let lastRepair: number | null = null;
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
        lastRepair = profile.lastHistorySync || null;
      }
    } catch (error) {
      console.warn('Could not get profile for repair status:', error);
    }

    const needsRepair = (invalidEntries > 0 || duplicateEntries > 0 || lastRepair === null);

    return {
      totalEntries,
      validEntries,
      duplicateEntries,
      invalidEntries,
      lastRepair,
      needsRepair
    };

  } catch (error) {
    console.error('Error getting history status:', error);
    return {
      totalEntries: 0,
      validEntries: 0,
      duplicateEntries: 0,
      invalidEntries: 0,
      lastRepair: null,
      needsRepair: true
    };
  }
}

/**
 * Clean up old or stale history entries
 */
export async function cleanupOldHistoryEntries(
  walletAddress: string,
  maxAge: number = 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
): Promise<{
  deleted: number;
  kept: number;
}> {
  try {
    const cutoffTime = Date.now() - maxAge;
    
    // Get all entries for the user
    const historyResult = await qdrantClient.search('user_history', {
      vector: new Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: walletAddress } }]
      },
      limit: 10000,
      with_payload: true
    });

    const entriesToDelete: string[] = [];
    let kept = 0;

    for (const result of historyResult) {
      const entry = result.payload as any;
      const pointId = result.id as string;

      if (entry.timestamp < cutoffTime) {
        entriesToDelete.push(pointId);
      } else {
        kept++;
      }
    }

    // Delete old entries
    if (entriesToDelete.length > 0) {
      await qdrantClient.delete('user_history', {
        wait: true,
        points: entriesToDelete
      });
    }

    console.log(`Cleanup for ${walletAddress}: deleted ${entriesToDelete.length}, kept ${kept}`);

    return {
      deleted: entriesToDelete.length,
      kept
    };

  } catch (error) {
    console.error('Error cleaning up old history:', error);
    return {
      deleted: 0,
      kept: 0
    };
  }
}
