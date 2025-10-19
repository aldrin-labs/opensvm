/**
 * User Feed API
 * Provides feed data for users with real-time event information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth-server';
import { validateWalletAddress } from '@/lib/user-history-utils';
import {
  getUserFollowing,
  checkQdrantHealth
} from '@/lib/qdrant';
import { getFeedEvents, SocialFeedEvent } from '@/lib/feed-events';

// Use SocialFeedEvent from feed-events module
type FeedEvent = SocialFeedEvent;

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

// Get real social feed events (not browsing history)
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

  // Get following addresses for following feed
  let followingAddresses: string[] = [];
  if (type === 'following') {
    try {
      const following = await getUserFollowing(walletAddress);
      followingAddresses = following.map(f => f.targetAddress);

      if (followingAddresses.length === 0) {
        console.log(`User ${walletAddress} is not following anyone`);
        return [];
      }
    } catch (error) {
      console.error('Error getting following list:', error);
      return [];
    }
  }

  try {
    // Use the proper social feed events system
    const socialEvents = await getFeedEvents({
      feedType: type,
      userAddress: walletAddress,
      followingAddresses,
      limit,
      offset,
      eventTypes,
      dateRange: dateRange as 'today' | 'week' | 'month' | 'all',
      sortOrder: sortOrder as 'newest' | 'popular'
    });

    // Convert to the format expected by the UI
    return socialEvents.map(event => ({
      ...event,
      hasLiked: currentUserWallet ? event.metadata?.likedBy?.includes(currentUserWallet) || false : false
    }));

  } catch (error) {
    console.error('Error fetching social feed events:', error);
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
      return NextResponse.json({ 
        events: [],
        metadata: {
          systemHealthy: false,
          message: 'Feed service is temporarily unavailable. Please try again later.'
        }
      });
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

    return NextResponse.json({ 
      events,
      metadata: {
        systemHealthy: true,
        totalReturned: events.length,
        hasMore: events.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching user feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
