/**
 * User History Storage Service
 * Handles storage and retrieval of user history data
 */

import { UserHistoryEntry, UserProfile, UserHistoryStats } from '@/types/user-history';
import { calculateStats, validateWalletAddress } from '@/lib/user-history-utils';

const STORAGE_KEY = 'opensvm_user_history';
const PROFILE_KEY = 'opensvm_user_profiles';

export class UserHistoryService {
  /**
   * Add a new history entry for a user
   */
  static addHistoryEntry(entry: UserHistoryEntry): void {
    try {
      // Validate wallet address
      const validatedAddress = validateWalletAddress(entry.walletAddress);
      if (!validatedAddress) {
        console.error('Invalid wallet address provided');
        return;
      }

      const existingHistory = this.getUserHistory(validatedAddress);
      const updatedHistory = [entry, ...existingHistory].slice(0, 10000); // Keep last 10k entries
      
      localStorage.setItem(
        `${STORAGE_KEY}_${validatedAddress}`,
        JSON.stringify(updatedHistory)
      );
      
      // Update user profile with recalculated stats
      this.updateUserProfile(validatedAddress, updatedHistory);
    } catch (error) {
      console.error('Error adding history entry:', error);
    }
  }

  /**
   * Get user history
   */
  static getUserHistory(walletAddress: string): UserHistoryEntry[] {
    try {
      // Validate wallet address
      const validatedAddress = validateWalletAddress(walletAddress);
      if (!validatedAddress) {
        console.error('Invalid wallet address provided');
        return [];
      }

      const stored = localStorage.getItem(`${STORAGE_KEY}_${validatedAddress}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting user history:', error);
      return [];
    }
  }

  /**
   * Get user profile with stats
   */
  static getUserProfile(walletAddress: string): UserProfile | null {
    try {
      // Validate wallet address
      const validatedAddress = validateWalletAddress(walletAddress);
      if (!validatedAddress) {
        console.error('Invalid wallet address provided');
        return null;
      }

      const stored = localStorage.getItem(`${PROFILE_KEY}_${validatedAddress}`);
      if (!stored) return null;
      
      const profile: UserProfile = JSON.parse(stored);
      const history = this.getUserHistory(validatedAddress);
      
      // Update stats using centralized function
      profile.stats = calculateStats(history);
      profile.history = history;
      
      return profile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile with recalculated stats
   */
  private static updateUserProfile(walletAddress: string, history: UserHistoryEntry[]): void {
    try {
      // Validate wallet address
      const validatedAddress = validateWalletAddress(walletAddress);
      if (!validatedAddress) {
        console.error('Invalid wallet address provided');
        return;
      }

      let profile = this.getUserProfile(validatedAddress);
      
      if (!profile) {
        profile = {
          walletAddress: validatedAddress,
          isPublic: true,
          createdAt: Date.now(),
          lastActive: Date.now(),
          stats: {} as UserHistoryStats,
          socialStats: {
            visitsByUsers: 0,
            followers: 0,
            following: 0,
            likes: 0,
            profileViews: 0
          },
          history: []
        };
      }
      
      profile.lastActive = Date.now();
      // Recalculate stats with updated history
      profile.stats = calculateStats(history);
      
      localStorage.setItem(`${PROFILE_KEY}_${validatedAddress}`, JSON.stringify(profile));
    } catch (error) {
      console.error('Error updating user profile:', error);
    }
  }

  /**
   * Get all user profiles (for public listing)
   */
  static getAllPublicProfiles(): UserProfile[] {
    try {
      const profiles: UserProfile[] = [];
      
      // Get all profile keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PROFILE_KEY)) {
          const walletAddress = key.replace(`${PROFILE_KEY}_`, '');
          const profile = this.getUserProfile(walletAddress);
          if (profile && profile.isPublic) {
            profiles.push(profile);
          }
        }
      }
      
      return profiles.sort((a, b) => b.lastActive - a.lastActive);
    } catch (error) {
      console.error('Error getting all profiles:', error);
      return [];
    }
  }

  /**
   * Export user history as CSV
   */
  static exportUserHistoryAsCSV(walletAddress: string): string {
    const history = this.getUserHistory(walletAddress);
    
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Page Type',
      'Page Title',
      'Path',
      'Transaction ID',
      'Account Address',
      'Block Number',
      'Program ID',
      'Token Mint',
      'Validator Address',
      'Search Query',
      'User Agent',
      'Referrer'
    ];

    const rows = history.map(entry => [
      entry.timestamp,
      new Date(entry.timestamp).toISOString().split('T')[0],
      new Date(entry.timestamp).toTimeString().split(' ')[0],
      entry.pageType,
      entry.pageTitle,
      entry.path,
      entry.metadata?.transactionId || '',
      entry.metadata?.accountAddress || '',
      entry.metadata?.blockNumber || '',
      entry.metadata?.programId || '',
      entry.metadata?.tokenMint || '',
      entry.metadata?.validatorAddress || '',
      entry.metadata?.searchQuery || '',
      entry.userAgent || '',
      entry.referrer || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }

  /**
   * Clear user history
   */
  static clearUserHistory(walletAddress: string): void {
    try {
      // Validate wallet address
      const validatedAddress = validateWalletAddress(walletAddress);
      if (!validatedAddress) {
        console.error('Invalid wallet address provided');
        return;
      }

      localStorage.removeItem(`${STORAGE_KEY}_${validatedAddress}`);
      localStorage.removeItem(`${PROFILE_KEY}_${validatedAddress}`);
    } catch (error) {
      console.error('Error clearing user history:', error);
    }
  }
}
