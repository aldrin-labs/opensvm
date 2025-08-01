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
import { SSEManager } from '@/lib/sse-manager';

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
async function getAuthenticatedUser(_request: NextRequest): Promise<string | null> {
  try {
    const session = await getSessionFromCookie();
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

    // Convert history entries to feed events with improved filtering pipeline
    // Step 1: Filter nulls during conversion
    const events = history
      .map((entry) => {
        // Extract event data from history entry
        const eventType = entry.pageType as 'transaction' | 'visit' | 'like' | 'follow' | 'other';

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
        } as FeedEvent;
      });

    // Step 2: Filter by event types if specified
    let filteredEvents = events;
    if (eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        eventTypes.includes(event.eventType)
      );
    }

    // Step 3: Filter by date range
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

    // Step 4: Apply feed type filtering (TEMPORARILY REMOVE ALL FILTERING FOR DEBUG)
    if (type === 'following') {
      // For 'following' feed, only include events from followed users
      filteredEvents = filteredEvents.filter(event =>
        followingAddresses.includes(event.userAddress)
      );
    } else if (type === 'for-you') {
      // TEMPORARILY: Show ALL events without any filtering to debug
      // filteredEvents = filteredEvents; // Keep everything

      // Actually, let's just make sure we're not filtering out everything
      // Only filter out if the event is invalid
      filteredEvents = filteredEvents.filter(event => {
        return event && event.userAddress && event.timestamp;
      });
    }

    // Debug logging after filtering
    if (process.env.NODE_ENV === 'development') {
      console.log(`After ${type} feed filtering: ${filteredEvents.length} events`);
      if (type === 'for-you' && filteredEvents.length > 0) {
        const fromOthers = filteredEvents.filter(e => e.userAddress !== walletAddress).length;
        const fromOwner = filteredEvents.filter(e => e.userAddress === walletAddress).length;
        console.log(`For-you feed breakdown: ${fromOthers} from other users, ${fromOwner} from profile owner`);

        // Show sample filtered events
        console.log('Sample filtered events:');
        filteredEvents.slice(0, 3).forEach((event, i) => {
          console.log(`  ${i + 1}. ${event.userAddress} - ${event.eventType} - ${new Date(event.timestamp).toISOString()}`);
        });
      }
    }

    // Sort based on sortOrder - prioritize timestamp for both feed types
    if (sortOrder === 'popular') {
      filteredEvents.sort((a, b) => {
        // For popular sorting, prioritize likes but break ties with timestamp
        if (a.likes !== b.likes) return b.likes - a.likes;
        return b.timestamp - a.timestamp;
      });
    } else {
      // Default to newest first - sort primarily by timestamp (newest first)
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Limit to requested number
    const finalEvents = filteredEvents.slice(0, limit);

    // Add some debug logging 
    if (process.env.NODE_ENV === 'development') {
      console.log(`Feed API: ${type} feed for ${walletAddress}`);
      console.log(`Raw history entries: ${history.length}`);
      console.log(`After event type filter: ${filteredEvents.length}`);

      // Log first few entries for debugging
      if (history.length > 0) {
        console.log('Sample raw entries:');
        history.slice(0, 3).forEach((entry, i) => {
          console.log(`  ${i + 1}. ${entry.walletAddress} - ${entry.pageType} - ${new Date(entry.timestamp).toISOString()}`);
        });
      }
    }

    // Broadcast feed updates via SSE for real-time functionality
    if (finalEvents.length > 0) {
      try {
        const sseManager = SSEManager.getInstance();
        sseManager.broadcastFeedEvent({
          feedType: type,
          walletAddress: walletAddress,
          events: finalEvents.slice(0, 5), // Only broadcast first 5 events to avoid overwhelming clients
          totalCount: finalEvents.length,
          timestamp: Date.now()
        });
      } catch (error) {
        // Silently continue if SSE broadcast fails
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to broadcast feed update via SSE:', error);
        }
      }
    }

    return finalEvents;
  } catch (error) {
    console.error('Error fetching real feed events:', error);
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const { walletAddress } = await context.params;

    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Get feed type from query params
    const url = new URL(_request.url);
    const feedType = (url.searchParams.get('type') || 'for-you') as 'for-you' | 'following';
    const realtime = url.searchParams.get('realtime') === 'true';

    // If real-time mode is requested, return SSE endpoint information
    if (realtime) {
      return NextResponse.json({
        message: 'Real-time feed updates available via SSE',
        sseEndpoint: `/api/sse-feed?clientId=${Date.now()}&walletAddress=${encodeURIComponent(validatedAddress)}&feedType=${feedType}`,
        pollingEndpoint: _request.url.replace('realtime=true', ''),
        instructions: 'Connect to the SSE endpoint for real-time updates, or use the polling endpoint for traditional API calls'
      });
    }

    // Check Qdrant health
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      console.log('Qdrant not available, returning empty feed');
      return NextResponse.json({ events: [] });
    }


    // Get current authenticated user (if any)
    const currentUserWallet = await getAuthenticatedUser(_request);

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
