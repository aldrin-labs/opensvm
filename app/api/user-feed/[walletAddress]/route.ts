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
    const { history } = await getUserHistory(
      '', // Get all history entries for both feed types, then filter appropriately
      {
        limit: limit * 3, // Fetch more since we'll filter by feed type
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
        // For 'for-you' feed, include user's own activity and some discovery
        // For now, include events from the requested wallet address or popular events
        // This logic can be expanded to include more sophisticated recommendation logic
        if (entry.walletAddress !== walletAddress && (!entry.metadata?.likes || entry.metadata.likes < 2)) {
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
    
    // Sort based on sortOrder
    if (sortOrder === 'popular') {
      filteredEvents.sort((a, b) => b.likes - a.likes);
    } else {
      // Default to newest
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Limit to requested number
    return filteredEvents.slice(0, limit);
  } catch (error) {
    console.error('Error fetching real feed events:', error);
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { walletAddress: string } }
) {
  try {
    const walletAddress = params.walletAddress;
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }
    
    // Check Qdrant health
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }
    
    // Get feed type from query params
    const url = new URL(_request.url);
    const feedType = (url.searchParams.get('type') || 'for-you') as 'for-you' | 'following';
    
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
