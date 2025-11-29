/**
 * Qdrant-based search suggestions service
 * Provides semantic search suggestions with user personalization
 */

import { qdrantClient } from './qdrant';

// Simple embedding function for search queries
function generateSimpleEmbedding(text: string): number[] {
  // Create a simple hash-based embedding for demonstration
  // In production, you'd use a proper embedding service
  const embedding = new Array(384).fill(0);
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  for (let i = 0; i < 384; i++) {
    embedding[i] = Math.sin(hash * (i + 1)) * 0.5;
  }
  
  return embedding;
}

// Async wrapper to match expected interface
async function generateEmbedding(text: string): Promise<number[]> {
  return generateSimpleEmbedding(text);
}

// Collection names
const COLLECTIONS = {
  USER_HISTORY: 'user_history',
  SEARCH_QUERIES: 'search_queries',
  USER_PROFILES: 'user_profiles'
};

// Import and re-export the canonical SearchSuggestion type from components
// This ensures type consistency across the codebase
import type { SearchSuggestion } from '@/components/search/types';
export type { SearchSuggestion };

/**
 * Qdrant suggestion source to canonical UI type mapping:
 *
 * Internal Source      -> Canonical UI Type  -> UI Styling
 * ---------------      -------------------   -----------
 * user's own browsing  -> 'recent_user'      -> user history styling
 * similar from others  -> 'recent_global'    -> community styling
 * most visited pages   -> 'recent_global'    -> community styling
 * recent activity      -> 'recent_global'    -> community styling
 *
 * Canonical types defined in components/search/types.ts:
 * address, transaction, token, program, recent_global, recent_user
 */

export interface SuggestionGroup {
  title: string;
  icon: string;
  description: string;
  suggestions: SearchSuggestion[];
  expandable: boolean;
  maxVisible: number;
}

/**
 * Initialize search queries collection in Qdrant
 */
async function ensureSearchQueriesCollection() {
  try {
    // Try to get collection info first
    try {
      await qdrantClient.getCollection(COLLECTIONS.SEARCH_QUERIES);
      console.log('Search queries collection already exists');
      return; // Collection exists, no need to create
    } catch (error) {
      console.log('Collection does not exist, creating...');
    }
    
    // Create the collection
    await qdrantClient.createCollection(COLLECTIONS.SEARCH_QUERIES, {
      vectors: {
        size: 384,
        distance: 'Cosine'
      }
    });

    console.log('Search queries collection created successfully');

    // Wait a bit for collection to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create payload indexes for efficient filtering
    const indexes = ['query', 'userId', 'timestamp', 'category', 'popularity'];
    for (const field of indexes) {
      try {
        await qdrantClient.createPayloadIndex(COLLECTIONS.SEARCH_QUERIES, {
          field_name: field,
          field_schema: 'keyword'
        });
        console.log(`Created index for field: ${field}`);
      } catch (error) {
        console.warn(`Failed to create index for ${field}:`, error);
      }
    }

    console.log('Search queries collection initialized successfully');
  } catch (error) {
    console.error('Error initializing search queries collection:', error);
    throw error; // Re-throw so we know collection setup failed
  }
}

/**
 * Store a search query for future suggestions
 */
export async function storeSearchQuery(
  query: string, 
  userId?: string, 
  category?: string
): Promise<void> {
  if (!query.trim()) return;

  try {
    await ensureSearchQueriesCollection();
    
    // Generate embedding for semantic search
    const embedding = await generateEmbedding(query);
    
    const now = Date.now();
    
    // Use timestamp as unsigned integer ID (Qdrant accepts this)
    // Add random component to avoid collisions if multiple queries happen in same millisecond
    const randomSuffix = Math.floor(Math.random() * 1000);
    const entryId = now * 1000 + randomSuffix;

    await qdrantClient.upsert(COLLECTIONS.SEARCH_QUERIES, {
      wait: true,
      points: [{
        id: entryId,
        vector: embedding,
        payload: {
          query: query.trim(),
          userId: userId || 'anonymous',
          timestamp: now,
          category: category || 'general',
          popularity: 1,
          lastAccessed: now
        }
      }]
    });

    console.log(`Successfully stored query: "${query}"`);
  } catch (error) {
    console.error('Error storing search query:', error);
    // Don't rethrow - this is non-critical for user experience
  }
}

/**
 * Get user history suggestions (priority 1-5)
 */
async function getUserHistorySuggestions(
  query: string, 
  userId?: string, 
  limit: number = 5
): Promise<SearchSuggestion[]> {
  if (!userId) return [];

  try {
    const queryEmbedding = await generateEmbedding(query);
    
    // Check if collection exists first
    try {
      await qdrantClient.getCollection(COLLECTIONS.USER_HISTORY);
    } catch (error) {
      console.log('User history collection does not exist yet');
      return [];
    }
    
    // Search user's history with semantic similarity
    const results = await qdrantClient.search(COLLECTIONS.USER_HISTORY, {
      vector: queryEmbedding,
      filter: {
        must: [
          { 
            key: 'walletAddress', 
            match: { 
              value: userId 
            } 
          }
        ]
      },
      limit: limit * 2,
      score_threshold: 0.1
    });

    const suggestions: SearchSuggestion[] = results
      .map(result => ({
        type: 'recent_user' as const,
        value: String(result.payload?.path || ''),
        label: String(result.payload?.path || 'Recent Page Visit'),
        name: String(result.payload?.pageTitle || 'Page Visit'),
        score: result.score,
        timestamp: Number(result.payload?.timestamp) || Date.now(),
        metadata: {
          section: 'user_history',
          sectionTitle: 'Your Recent Activity',
          sectionIcon: '🕐',
          sectionDescription: 'Your recent page visits and searches',
          userId: userId,
          isRecent: true,
          scope: 'user' as const,
          expandable: true,
          category: String(result.payload?.pageType || 'general')
        }
      }))
      .filter(s => s.value.trim().length > 0)
      .slice(0, limit);

    return suggestions;
  } catch (error) {
    console.error('Error getting user history suggestions:', error);
    return [];
  }
}

/**
 * Get global matched suggestions (priority 5-10) - from other users' history
 */
async function getGlobalMatchedSuggestions(
  query: string, 
  userId?: string, 
  limit: number = 5
): Promise<SearchSuggestion[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    // Check if collection exists first
    try {
      await qdrantClient.getCollection(COLLECTIONS.USER_HISTORY);
    } catch (error) {
      console.log('User history collection does not exist yet');
      return [];
    }

    // Search all user history semantically, excluding current user
    const searchOptions: any = {
      vector: queryEmbedding,
      limit: limit * 3,
      score_threshold: 0.1
    };

    // Add filter to exclude current user if provided
    if (userId) {
      searchOptions.filter = {
        must_not: [
          { 
            key: 'walletAddress', 
            match: { 
              value: userId 
            } 
          }
        ]
      };
    }

    const results = await qdrantClient.search(COLLECTIONS.USER_HISTORY, searchOptions);

    const suggestions: SearchSuggestion[] = results
      .map(result => ({
        type: 'recent_global' as const,
        value: String(result.payload?.path || ''),
        label: String(result.payload?.path || 'Page Visit'),
        name: String(result.payload?.pageTitle || 'Community Activity'),
        score: result.score,
        timestamp: Number(result.payload?.timestamp) || Date.now(),
        metadata: {
          section: 'global_match',
          sectionTitle: 'Related Activity',
          sectionIcon: '🔍',
          sectionDescription: 'Similar activity from the community',
          scope: 'global' as const,
          expandable: true,
          category: String(result.payload?.pageType || 'general')
        }
      }))
      .filter(s => s.value.trim().length > 0)
      .slice(0, limit);

    return suggestions;
  } catch (error) {
    console.error('Error getting global matched suggestions:', error);
    return [];
  }
}

/**
 * Get popular suggestions (priority 10-15) - most visited pages
 */
async function getPopularSuggestions(limit: number = 5): Promise<SearchSuggestion[]> {
  try {
    // Check if collection exists first
    try {
      await qdrantClient.getCollection(COLLECTIONS.USER_HISTORY);
    } catch (error) {
      console.log('User history collection does not exist yet');
      return [];
    }

    // Get all user history and group by path to find popular pages
    const results = await qdrantClient.search(COLLECTIONS.USER_HISTORY, {
      vector: await generateEmbedding("popular pages"), 
      limit: 100, // Get more to analyze popularity
      score_threshold: 0.0 // Accept all results
    });

    // Group by path and count visits
    const pathCounts = new Map<string, { count: number; latestEntry: any }>();
    
    for (const result of results) {
      const path = String(result.payload?.path || '');
      if (path.trim().length > 0) {
        const existing = pathCounts.get(path);
        if (existing) {
          existing.count++;
          // Keep the most recent entry
          if (Number(result.payload?.timestamp) > Number(existing.latestEntry.payload?.timestamp)) {
            existing.latestEntry = result;
          }
        } else {
          pathCounts.set(path, { count: 1, latestEntry: result });
        }
      }
    }

    // Sort by popularity and convert to suggestions
    const sortedPaths = Array.from(pathCounts.entries())
      .filter(([_, data]) => data.count >= 2) // At least 2 visits
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit);

    const suggestions: SearchSuggestion[] = sortedPaths.map(([path, data]) => ({
      type: 'recent_global' as const,
      value: path,
      label: path,
      name: String(data.latestEntry.payload?.pageTitle || 'Popular Page'),
      usageCount: data.count,
      timestamp: Number(data.latestEntry.payload?.timestamp) || Date.now(),
      metadata: {
        section: 'popular',
        sectionTitle: 'Popular Pages',
        sectionIcon: '🔥',
        sectionDescription: 'Most visited pages on OpenSVM',
        scope: 'global' as const,
        expandable: true,
        category: String(data.latestEntry.payload?.pageType || 'general')
      }
    }));

    return suggestions;
  } catch (error) {
    console.error('Error getting popular suggestions:', error);
    return [];
  }
}

/**
 * Get recent global queries (priority 15-20) - recent activity from other users
 */
async function getRecentGlobalSuggestions(
  userId?: string, 
  limit: number = 5
): Promise<SearchSuggestion[]> {
  try {
    // Check if collection exists first
    try {
      await qdrantClient.getCollection(COLLECTIONS.USER_HISTORY);
    } catch (error) {
      console.log('User history collection does not exist yet');
      return [];
    }

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Get recent activity from all users
    const searchOptions: any = {
      vector: await generateEmbedding("recent activity"),
      limit: limit * 3,
      score_threshold: 0.0 // Accept all results for timestamp filtering
    };

    // Add filter to exclude current user if provided
    if (userId) {
      searchOptions.filter = {
        must_not: [
          { 
            key: 'walletAddress', 
            match: { 
              value: userId 
            } 
          }
        ]
      };
    }

    const results = await qdrantClient.search(COLLECTIONS.USER_HISTORY, searchOptions);

    // Filter by recent timestamp and sort in memory
    const sorted = results
      .filter(result => (Number(result.payload?.timestamp) || 0) >= oneDayAgo)
      .sort((a, b) => 
        (Number(b.payload?.timestamp) || 0) - (Number(a.payload?.timestamp) || 0)
      );

    const suggestions: SearchSuggestion[] = sorted
      .map(result => ({
        type: 'recent_global' as const,
        value: String(result.payload?.path || ''),
        label: String(result.payload?.path || 'Recent Activity'),
        name: String(result.payload?.pageTitle || 'Recent Page'),
        timestamp: Number(result.payload?.timestamp) || Date.now(),
        metadata: {
          section: 'recent_global',
          sectionTitle: 'Recent Community Activity',
          sectionIcon: '⚡',
          sectionDescription: 'What others are exploring',
          scope: 'global' as const,
          expandable: true,
          category: String(result.payload?.pageType || 'general'),
          timeAgo: formatTimeAgo(Number(result.payload?.timestamp) || Date.now())
        }
      }))
      .filter(s => s.value.trim().length > 0)
      .slice(0, limit);

    return suggestions;
  } catch (error) {
    console.error('Error getting recent global suggestions:', error);
    return [];
  }
}

/**
 * Get comprehensive search suggestions with prioritization
 */
export async function getSearchSuggestions(
  query: string,
  userId?: string,
  options: {
    maxPerSection?: number;
    includeEmpty?: boolean;
  } = {}
): Promise<SuggestionGroup[]> {
  const { maxPerSection = 5, includeEmpty = false } = options;
  
  try {
    // Store this query for future suggestions
    if (query.trim().length >= 2) {
      storeSearchQuery(query, userId).catch(console.error);
    }

    // Get all suggestion types in parallel
    const [userHistory, globalMatches, popular, recentGlobal] = await Promise.all([
      getUserHistorySuggestions(query, userId, maxPerSection),
      getGlobalMatchedSuggestions(query, userId, maxPerSection),
      getPopularSuggestions(maxPerSection),
      getRecentGlobalSuggestions(userId, maxPerSection)
    ]);

    const groups: SuggestionGroup[] = [
      {
        title: 'Your Recent Activity',
        icon: '🕐',
        description: 'Your recent page visits and searches',
        suggestions: userHistory,
        expandable: userHistory.length >= maxPerSection,
        maxVisible: Math.min(3, maxPerSection)
      },
      {
        title: 'Related Activity', 
        icon: '🔍',
        description: 'Similar activity from the community',
        suggestions: globalMatches,
        expandable: globalMatches.length >= maxPerSection,
        maxVisible: Math.min(3, maxPerSection)
      },
      {
        title: 'Popular Pages',
        icon: '🔥', 
        description: 'Most visited pages on OpenSVM',
        suggestions: popular,
        expandable: popular.length >= maxPerSection,
        maxVisible: Math.min(3, maxPerSection)
      },
      {
        title: 'Recent Community Activity',
        icon: '⚡',
        description: 'What others are exploring',
        suggestions: recentGlobal,
        expandable: recentGlobal.length >= maxPerSection,
        maxVisible: Math.min(3, maxPerSection)
      }
    ];

    // Filter out empty groups if requested
    return includeEmpty ? groups : groups.filter(group => group.suggestions.length > 0);
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

/**
 * Helper function to format addresses
 */
function formatAddress(address?: string): string {
  if (!address) return '';
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Helper function to format time ago
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
