/**
 * User History Types
 * Defines the data structures for tracking user browsing history
 */

export interface UserHistoryEntry {
  id: string;
  walletAddress: string;
  timestamp: number;
  path: string;
  pageType: 'transaction' | 'account' | 'block' | 'program' | 'token' | 'validator' | 'analytics' | 'search' | 'ai-chat' | 'other';
  pageTitle: string;
  metadata?: {
    transactionId?: string;
    accountAddress?: string;
    blockNumber?: number;
    programId?: string;
    tokenMint?: string;
    validatorAddress?: string;
    searchQuery?: string;
    // AI Chat specific metadata
    aiChatMessage?: {
      role: 'user' | 'assistant' | 'agent';
      content: string;
      tabType?: 'agent' | 'assistant' | 'notes';
    };
    [key: string]: any;
  };
  userAgent?: string;
  referrer?: string;
}

export interface UserHistoryStats {
  totalVisits: number;
  uniquePages: number;
  mostVisitedPageType: string;
  averageSessionDuration: number;
  lastVisit: number;
  firstVisit: number;
  dailyActivity: Array<{
    date: string;
    visits: number;
  }>;
  pageTypeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

export interface UserSocialStats {
  visitsByUsers: number; // Total page views by other users
  followers: number;
  following: number;
  likes: number;
  profileViews: number;
}

export interface UserProfile {
  walletAddress: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  isPublic: boolean;
  createdAt: number;
  lastActive: number;
  stats: UserHistoryStats;
  socialStats: UserSocialStats;
  history: UserHistoryEntry[];
}

export interface UserFollowEntry {
  id: string;
  followerAddress: string;
  targetAddress: string; // Added to match lib/qdrant.ts
  timestamp: number;
}

export interface UserLikeEntry {
  id: string;
  likerAddress: string;
  targetAddress: string;
  timestamp: number;
}

export interface UserPageView {
  id: string;
  viewerAddress: string;
  targetAddress: string;
  timestamp: number;
  userAgent?: string;
}

export interface HistoryExportData {
  userProfile: UserProfile;
  exportTimestamp: number;
  totalEntries: number;
  dateRange: {
    start: number;
    end: number;
  };
}
