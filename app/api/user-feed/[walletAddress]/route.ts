/**
 * User Feed API
 * Provides feed data for users with real-time event information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth-server';
import { validateWalletAddress } from '@/lib/user-history-utils';
import {
  getUserFollowing,
  getUserHistory,
  checkQdrantHealth
} from '@/lib/qdrant';
import { getFeedEvents, SocialFeedEvent } from '@/lib/feed-events';
import { UserHistoryEntry } from '@/types/user-history';

// Use SocialFeedEvent from feed-events module
type FeedEvent = SocialFeedEvent;

// Unified feed item that can be either a social event or browsing history
type UnifiedFeedItem = FeedEvent & {
  itemType?: 'social' | 'browsing';
  browsingData?: UserHistoryEntry;
};

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

// Convert browsing history to feed event format with rich context
function convertBrowsingHistoryToFeedEvent(entry: UserHistoryEntry): UnifiedFeedItem {
  const pageTypeLabels: Record<string, string> = {
    transaction: 'viewed a transaction',
    account: 'viewed an account',
    block: 'viewed a block',
    program: 'viewed a program',
    token: 'viewed a token',
    validator: 'viewed a validator',
    analytics: 'viewed analytics',
    search: 'performed a search',
    'ai-chat': 'used AI chat',
    other: 'viewed a page'
  };

  // Extract rich context based on page type
  let richContent = '';
  let richMetadata: any = {
    ...entry.metadata,
    path: entry.path,
    pageType: entry.pageType,
    clickableUrl: entry.path // Make event clickable
  };

  // Generate engaging, context-rich content based on page type
  switch (entry.pageType) {
    case 'transaction':
      const txId = entry.metadata?.transactionId;
      richContent = txId 
        ? `viewed transaction ${txId.substring(0, 8)}... • ${entry.pageTitle}`
        : `viewed a transaction • ${entry.pageTitle}`;
      break;

    case 'token':
      const tokenMint = entry.metadata?.tokenMint;
      const tokenSymbol = entry.metadata?.tokenSymbol;
      if (tokenSymbol) {
        richContent = `checked out $${tokenSymbol} token • ${entry.pageTitle}`;
      } else if (tokenMint) {
        richContent = `viewed token ${tokenMint.substring(0, 8)}... • ${entry.pageTitle}`;
      } else {
        richContent = `explored a token • ${entry.pageTitle}`;
      }
      break;

    case 'account':
      const accountAddr = entry.metadata?.accountAddress;
      const accountLabel = entry.metadata?.accountLabel;
      if (accountLabel) {
        richContent = `viewed ${accountLabel} account • ${entry.pageTitle}`;
      } else if (accountAddr) {
        richContent = `checked account ${accountAddr.substring(0, 8)}... • ${entry.pageTitle}`;
      } else {
        richContent = `viewed an account • ${entry.pageTitle}`;
      }
      break;

    case 'program':
      const programId = entry.metadata?.programId;
      const programName = entry.metadata?.programName;
      if (programName) {
        richContent = `explored ${programName} program • ${entry.pageTitle}`;
      } else if (programId) {
        richContent = `viewed program ${programId.substring(0, 8)}... • ${entry.pageTitle}`;
      } else {
        richContent = `checked out a program • ${entry.pageTitle}`;
      }
      break;

    case 'block':
      const blockNumber = entry.metadata?.blockNumber;
      richContent = blockNumber 
        ? `viewed block #${blockNumber.toLocaleString()} • ${entry.pageTitle}`
        : `viewed a block • ${entry.pageTitle}`;
      break;

    case 'analytics':
      richContent = `explored analytics • ${entry.pageTitle}`;
      break;

    case 'search':
      const searchQuery = entry.metadata?.searchQuery;
      richContent = searchQuery 
        ? `searched for "${searchQuery}" • ${entry.pageTitle}`
        : `performed a search • ${entry.pageTitle}`;
      break;

    case 'ai-chat':
      richContent = `used AI Assistant • ${entry.pageTitle}`;
      break;

    default:
      // For generic pages, try to extract meaningful info from title
      if (entry.pageTitle && entry.pageTitle !== 'OpenSVM - AI Explorer and RPC nodes provider for all SVM networks (Solana Virtual Machine)') {
        richContent = `explored ${entry.pageTitle}`;
      } else {
        richContent = `browsed ${pageTypeLabels[entry.pageType] || 'a page'}`;
      }
  }

  return {
    id: entry.id,
    eventType: 'visit', // Special type for browsing history
    timestamp: entry.timestamp,
    userAddress: entry.walletAddress,
    content: richContent,
    targetAddress: entry.metadata?.accountAddress || entry.metadata?.tokenMint,
    targetId: entry.metadata?.transactionId || entry.metadata?.programId,
    metadata: richMetadata,
    likes: 0,
    hasLiked: false,
    itemType: 'browsing',
    browsingData: entry
  };
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

// Get unified feed with both social events and browsing history
async function getUnifiedFeed(
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
): Promise<UnifiedFeedItem[]> {
  const { limit = 10, offset = 0, dateRange = 'all', eventTypes = [], sortOrder = 'newest' } = options;

  try {
    // Fetch social events
    const socialEvents = await getRealFeedEvents(walletAddress, type, currentUserWallet, {
      limit: Math.ceil(limit * 1.5), // Fetch more to mix with browsing history
      offset,
      dateRange,
      eventTypes: eventTypes.filter(t => t !== 'visit'), // Exclude 'visit' from social events
      sortOrder
    });

    // Fetch browsing history
    // For "for-you", get history from ALL users (excluding current user)
    // For "following", get history from users being followed
    let browsingHistory: UserHistoryEntry[] = [];
    
    if (type === 'for-you') {
      // Get browsing history from all users
      const historyResult = await getUserHistory('', { // Empty wallet = all users
        limit: Math.ceil(limit * 1.5),
        offset: 0
      });
      // Filter out current user's own browsing history
      browsingHistory = historyResult.history.filter(h => h.walletAddress !== walletAddress);
    } else if (type === 'following') {
      // Get following addresses
      try {
        const following = await getUserFollowing(walletAddress);
        const followingAddresses = following.map(f => f.targetAddress);
        
        if (followingAddresses.length > 0) {
          // Fetch history for each followed user and merge
          const historyPromises = followingAddresses.slice(0, 10).map(addr => 
            getUserHistory(addr, { limit: 5, offset: 0 })
          );
          const historyResults = await Promise.all(historyPromises);
          browsingHistory = historyResults.flatMap(r => r.history);
        }
      } catch (error) {
        console.error('Error fetching following history:', error);
      }
    }

    // Convert browsing history to feed events
    const browsingEvents = browsingHistory.map(convertBrowsingHistoryToFeedEvent);

    // Merge and mark social events
    const socialEventsMarked: UnifiedFeedItem[] = socialEvents.map(event => ({
      ...event,
      itemType: 'social' as const
    }));

    // Combine both
    const allEvents = [...socialEventsMarked, ...browsingEvents];

    // Sort by timestamp
    allEvents.sort((a, b) => {
      if (sortOrder === 'popular') {
        // For popular, prioritize likes then timestamp
        if (a.likes !== b.likes) return b.likes - a.likes;
      }
      return b.timestamp - a.timestamp;
    });

    // Apply limit and offset
    return allEvents.slice(0, limit);

  } catch (error) {
    console.error('Error fetching unified feed:', error);
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

    // Get unified feed with both social events and browsing history
    const events = await getUnifiedFeed(
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
