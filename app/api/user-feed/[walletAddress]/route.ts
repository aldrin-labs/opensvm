/**
 * User Feed API
 * Provides feed data for users with real-time event information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth-server';
import { validateWalletAddress } from '@/lib/user-history-utils';
import {
  getUserFollowing,
  checkQdrantHealth,
  getUserHistory
} from '@/lib/qdrant';

// Feed event interface
interface FeedEvent {
  id: string;
  eventType: 'transaction' | 'visit' | 'like' | 'follow' | 'other';
  timestamp: number;
  userAddress: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  targetAddress?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  likes: number;
  hasLiked: boolean;
}

// Get authenticated user from session
function getAuthenticatedUser(_request: NextRequest): string | null {
  try {
    const session = getSessionFromCookie();
    if (!session) return null;
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) return null;
    
    return session.walletAddress;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// Get real feed data from Qdrant
async function getRealFeedEvents(
  walletAddress: string,
  type: 'for-you' | 'following',
  currentUserWallet: string | null,
  options: {
    limit?: number;
    offset?: number;
    dateRange?: string;
    eventTypes?: string[];
    sortOrder?: string;
  } = {}
): Promise<FeedEvent[]> {
  const { limit = 10, offset = 0, dateRange = 'all', eventTypes = [], sortOrder = 'newest' } = options;
  
  // If type is 'following', get the users that this wallet follows
  let followingAddresses: string[] = [];
  
  if (type === 'following') {
    try {
      const following = await getUserFollowing(walletAddress);
      followingAddresses = following.map(f => f.targetAddress);
      
      // If not following anyone, return empty array
      if (followingAddresses.length === 0) {
        return [];
      }
    } catch (error) {
      console.error('Error getting following list:', error);
      return [];
    }
  }
  
  try {
    // Get user history entries from Qdrant
    // For 'for-you' feed, get a broader sample; for 'following' feed, get more targeted data
    const historyLimit = type === 'for-you' ? limit * 5 : limit * 3; // Fetch more for for-you to get diverse content
    
    const { history } = await getUserHistory(
      '', // Get all history entries for both feed types, then filter appropriately
      {
        limit: historyLimit,
        offset,
        // We'll filter by event types and feed logic after fetching
      }
    );
    
    // Convert history entries to feed events
    const events: (FeedEvent | null)[] = history.map((entry) => {
      // Extract event data from history entry
      const eventType = entry.pageType as 'transaction' | 'visit' | 'like' | 'follow' | 'other';
      
      // Apply feed type filtering
      if (type === 'following') {
        // For 'following' feed, only include events from followed users
        if (!followingAddresses.includes(entry.walletAddress)) {
          return null;
        }
      } else if (type === 'for-you') {
        // For 'for-you' feed, show recent activity from recommended users (most active today)
        // Include events from today or events with some engagement, but prioritize recent activity
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const isFromToday = entry.timestamp >= todayStart;
        const hasEngagement = entry.metadata?.likes && entry.metadata.likes > 0;
        
        // Include if: recent activity from today OR has some engagement OR is from profile owner
        if (!isFromToday && !hasEngagement && entry.walletAddress !== walletAddress) {
          return null;
        }
      }
      
      // Get profile data for the user
      const userName = entry.metadata?.userName || `User ${entry.walletAddress.slice(0, 6)}`;
      const userAvatar = entry.metadata?.userAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${entry.walletAddress}`;
      
      return {
        id: entry.id,
        eventType,
        timestamp: entry.timestamp,
        userAddress: entry.walletAddress,
        userName,
        userAvatar,
        content: entry.pageTitle || entry.path || 'Performed an action',
        targetAddress: entry.metadata?.targetAddress,
        targetId: entry.metadata?.targetId,
        metadata: entry.metadata,
        likes: entry.metadata?.likes || 0,
        hasLiked: currentUserWallet ? entry.metadata?.likedBy?.includes(currentUserWallet) : false
      };
    }).filter(Boolean); // Remove null entries
    
    // Filter out null values
    const nonNullEvents: FeedEvent[] = events.filter((event): event is FeedEvent => event !== null);
    
    // Apply filters
    let filteredEvents = nonNullEvents;
    
    // Filter by event types if specified
    if (eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        eventTypes.includes(event.eventType)
      );
    }
    
    // Filter by date range
    if (dateRange !== 'all') {
      const now = Date.now();
      let timeThreshold = now;
      
      if (dateRange === 'today') {
        timeThreshold = new Date().setHours(0, 0, 0, 0);
      } else if (dateRange === 'week') {
        timeThreshold = now - 7 * 24 * 60 * 60 * 1000;
      } else if (dateRange === 'month') {
        timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
      }
      
      filteredEvents = filteredEvents.filter(event => event.timestamp >= timeThreshold);
    }
    
    // Sort based on sortOrder with special handling for for-you feed
    if (sortOrder === 'popular') {
      filteredEvents.sort((a, b) => b.likes - a.likes);
    } else {
      // Default to newest, but for 'for-you' feed, prioritize recent activity from today
      if (type === 'for-you') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        filteredEvents.sort((a, b) => {
          // Prioritize events from today
          const aIsFromToday = a.timestamp >= todayStart;
          const bIsFromToday = b.timestamp >= todayStart;
          
          if (aIsFromToday && !bIsFromToday) return -1;
          if (!aIsFromToday && bIsFromToday) return 1;
          
          // Within same day category, sort by timestamp
          return b.timestamp - a.timestamp;
        });
      } else {
        filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
      }
    }
    
    // Limit to requested number
    const finalEvents = filteredEvents.slice(0, limit);
    
    // Add some debug logging
    console.log(`Feed API: ${type} feed for ${walletAddress}, found ${finalEvents.length} events out of ${history.length} total history entries`);
    if (type === 'following') {
      console.log(`Following ${followingAddresses.length} users`);
    }
    
    return finalEvents;
  } catch (error) {
    console.error('Error fetching real feed events:', error);
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const { walletAddress } = await params;
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Get feed type from query params
    const url = new URL(_request.url);
    const feedType = (url.searchParams.get('type') || 'for-you') as 'for-you' | 'following';
    
    // Check Qdrant health
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      // Return mock data for testing when Qdrant is not available
      console.log('Qdrant not available, returning mock feed data for testing');
      
      const mockEvents: FeedEvent[] = [
        {
          id: 'mock-1',
          eventType: 'transaction',
          timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
          userAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          userName: 'Active User 1',
          userAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=user1',
          content: 'Completed a DeFi transaction on Jupiter',
          targetAddress: validatedAddress,
          metadata: { amount: '1.5', token: 'SOL' },
          likes: 3,
          hasLiked: false
        },
        {
          id: 'mock-2',
          eventType: 'visit',
          timestamp: Date.now() - 1000 * 60 * 45, // 45 minutes ago
          userAddress: '8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          userName: 'Active User 2',
          userAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=user2',
          content: 'Explored token analytics page',
          targetAddress: validatedAddress,
          metadata: {},
          likes: 1,
          hasLiked: false
        },
        {
          id: 'mock-3',
          eventType: 'like',
          timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
          userAddress: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          userName: 'Active User 3',
          userAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=user3',
          content: 'Liked a user profile',
          targetAddress: validatedAddress,
          metadata: {},
          likes: 5,
          hasLiked: false
        }
      ];
      
      // Filter by feed type for mock data
      let filteredMockEvents = mockEvents;
      if (feedType === 'following') {
        // For following feed, show empty for demo since user likely follows no one
        filteredMockEvents = [];
      }
      
      return NextResponse.json({ events: filteredMockEvents });
    }

    
    // Get current authenticated user (if any)
    const currentUserWallet = getAuthenticatedUser(_request);
    
    // Parse query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const dateRange = url.searchParams.get('dateRange') || 'all';
    const eventTypesParam = url.searchParams.get('eventTypes') || '';
    const eventTypes = eventTypesParam ? eventTypesParam.split(',') : [];
    const sortOrder = url.searchParams.get('sort') || 'newest';
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Get feed events from real data source
    const events = await getRealFeedEvents(
      validatedAddress,
      feedType,
      currentUserWallet,
      {
        limit,
        offset,
        dateRange,
        eventTypes,
        sortOrder
      }
    );
    
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching user feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
