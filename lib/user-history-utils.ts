/**
 * User History Utilities
 * Centralized functions for user history statistics and validation
 */

import {
  UserHistoryEntry,
  UserHistoryStats,
  UserSocialStats,
  UserFollowEntry,
  UserLikeEntry,
  UserPageView
} from '@/types/user-history';

/**
 * Calculate user statistics from history entries
 * Centralized to avoid duplication between client and server
 */
export function calculateStats(history: UserHistoryEntry[]): UserHistoryStats {
  if (history.length === 0) {
    return {
      totalVisits: 0,
      uniquePages: 0,
      mostVisitedPageType: 'other',
      averageSessionDuration: 0,
      lastVisit: 0,
      firstVisit: 0,
      dailyActivity: [],
      pageTypeDistribution: []
    };
  }

  const uniquePaths = new Set(history.map(h => h.path));
  const pageTypes = history.reduce((acc, h) => {
    acc[h.pageType] = (acc[h.pageType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Safe calculation of most visited type with fallback
  const pageTypeEntries = Object.entries(pageTypes);
  const mostVisitedType = pageTypeEntries.length > 0 
    ? pageTypeEntries.reduce((a, b) => pageTypes[a[0]] > pageTypes[b[0]] ? a : b)[0]
    : 'other';

  // Calculate daily activity
  const dailyActivity = history.reduce((acc, h) => {
    const date = new Date(h.timestamp).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dailyActivityArray = Object.entries(dailyActivity).map(([date, visits]) => ({
    date,
    visits
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate page type distribution
  const totalVisits = history.length;
  const pageTypeDistribution = Object.entries(pageTypes).map(([type, count]) => ({
    type,
    count,
    percentage: (count / totalVisits) * 100
  })).sort((a, b) => b.count - a.count);

  return {
    totalVisits: history.length,
    uniquePages: uniquePaths.size,
    mostVisitedPageType: mostVisitedType,
    averageSessionDuration: calculateAverageSessionDuration(history),
    lastVisit: Math.max(...history.map(h => h.timestamp)),
    firstVisit: Math.min(...history.map(h => h.timestamp)),
    dailyActivity: dailyActivityArray,
    pageTypeDistribution
  };
}

/**
 * Calculate average session duration from history entries
 */
function calculateAverageSessionDuration(history: UserHistoryEntry[]): number {
  if (history.length < 2) {
    return 0;
  }

  // Group entries by session (entries within 30 minutes of each other)
  const sessionThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

  let sessions: number[][] = [];
  let currentSession: number[] = [sortedHistory[0].timestamp];

  for (let i = 1; i < sortedHistory.length; i++) {
    const timeDiff = sortedHistory[i].timestamp - sortedHistory[i - 1].timestamp;

    if (timeDiff <= sessionThreshold) {
      currentSession.push(sortedHistory[i].timestamp);
    } else {
      sessions.push(currentSession);
      currentSession = [sortedHistory[i].timestamp];
    }
  }
  sessions.push(currentSession);

  // Calculate average session duration
  const sessionDurations = sessions.map(session => {
    if (session.length < 2) return 0;
    return session[session.length - 1] - session[0];
  }).filter(duration => duration > 0);

  if (sessionDurations.length === 0) {
    return 0;
  }

  return sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length;
}

/**
 * Validate and sanitize wallet address
 * Prevents XSS and ensures proper format
 */
export function validateWalletAddress(address: string): string | null {
  if (!address || typeof address !== 'string') {
    return null;
  }

  // Trim whitespace and convert to string
  const sanitized = String(address).trim();

  // Basic Solana address validation (base58, 32-44 characters)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  if (!base58Regex.test(sanitized)) {
    return null;
  }

  // Additional XSS prevention - ensure no HTML/script tags
  const xssPattern = /<[^>]*>/g;
  if (xssPattern.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Calculate social statistics for a user
 */
export function calculateSocialStats(
  followers: UserFollowEntry[],
  following: UserFollowEntry[],
  likes: UserLikeEntry[],
  pageViews: UserPageView[]
): UserSocialStats {
  return {
    visitsByUsers: pageViews.length,
    followers: followers.length,
    following: following.length,
    likes: likes.length,
    profileViews: pageViews.length
  };
}

/**
 * Generate unique ID for database entries
 * Uses UUID v4 format for Qdrant compatibility
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Remove < and > characters
  sanitized = sanitized.replace(/[<>]/g, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove event handlers (apply repeatedly until no matches are found)
  let previous;
  do {
    previous = sanitized;
    sanitized = sanitized.replace(/on\w+=/gi, '');
  } while (sanitized !== previous);

  return sanitized;
}
