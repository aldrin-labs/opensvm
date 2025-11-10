/**
 * Social Feed Events System
 * Handles creation, storage, and retrieval of actual social feed events
 */

import { qdrantClient } from '@/lib/qdrant';

export interface SocialFeedEvent {
  id: string;
  eventType: 'transaction' | 'follow' | 'like' | 'profile_update' | 'token_transfer';
  timestamp: number;
  userAddress: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  targetAddress?: string;
  targetId?: string;
  metadata?: {
    amount?: number;
    token?: string;
    transactionId?: string;
    previousFollowerCount?: number;
    newFollowerCount?: number;
    [key: string]: any;
  };
  likes: number;
  hasLiked?: boolean;
}

const FEED_EVENTS_COLLECTION = 'social_feed_events';

/**
 * Initialize the social feed events collection
 */
export async function initializeFeedEventsCollection(): Promise<void> {
  try {
    const exists = await qdrantClient.getCollection(FEED_EVENTS_COLLECTION).catch(() => null);

    if (!exists) {
      await qdrantClient.createCollection(FEED_EVENTS_COLLECTION, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      console.log('Created social_feed_events collection');
    }

    // Ensure necessary indexes exist
    const indexes = ['userAddress', 'targetAddress', 'eventType'];
    for (const fieldName of indexes) {
      try {
        await qdrantClient.createPayloadIndex(FEED_EVENTS_COLLECTION, {
          field_name: fieldName,
          field_schema: 'keyword'
        });
        console.log(`Created index for ${fieldName} in social_feed_events`);
      } catch (error: any) {
        if (error?.data?.status?.error?.includes('already exists') ||
          error?.message?.includes('already exists')) {
          // Index already exists, this is fine
        } else {
          console.warn(`Failed to create index for ${fieldName}:`, error?.data?.status?.error || error?.message);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing feed events collection:', error);
    throw error;
  }
}

/**
 * Create a feed event for when someone follows a user
 */
export async function createFollowEvent(
  followerAddress: string,
  targetAddress: string,
  followerName?: string
): Promise<void> {
  try {
    await initializeFeedEventsCollection();

    const event: SocialFeedEvent = {
      id: crypto.randomUUID(),
      eventType: 'follow',
      timestamp: Date.now(),
      userAddress: followerAddress,
      userName: followerName || `${followerAddress.slice(0, 6)}...`,
      userAvatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${followerAddress}`,
      content: `started following ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`,
      targetAddress,
      metadata: {},
      likes: 0
    };

    const vector = generateEventEmbedding(event);

    await qdrantClient.upsert(FEED_EVENTS_COLLECTION, {
      wait: true,
      points: [{
        id: event.id,
        vector,
        payload: event as any
      }]
    });

    console.log(`Created follow event: ${followerAddress} -> ${targetAddress}`);
  } catch (error) {
    console.error('Error creating follow event:', error);
  }
}

/**
 * Create a feed event for when someone likes a user profile
 */
export async function createLikeEvent(
  likerAddress: string,
  targetAddress: string,
  likerName?: string
): Promise<void> {
  try {
    await initializeFeedEventsCollection();

    const event: SocialFeedEvent = {
      id: crypto.randomUUID(),
      eventType: 'like',
      timestamp: Date.now(),
      userAddress: likerAddress,
      userName: likerName || `${likerAddress.slice(0, 6)}...`,
      userAvatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${likerAddress}`,
      content: `liked ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}'s profile`,
      targetAddress,
      metadata: {},
      likes: 0
    };

    const vector = generateEventEmbedding(event);

    await qdrantClient.upsert(FEED_EVENTS_COLLECTION, {
      wait: true,
      points: [{
        id: event.id,
        vector,
        payload: event as any
      }]
    });

    console.log(`Created like event: ${likerAddress} -> ${targetAddress}`);
  } catch (error) {
    console.error('Error creating like event:', error);
  }
}

/**
 * Create a feed event for transactions
 */
export async function createTransactionEvent(
  userAddress: string,
  transactionId: string,
  amount: number,
  token: string = 'SOL',
  userName?: string
): Promise<void> {
  try {
    await initializeFeedEventsCollection();

    const event: SocialFeedEvent = {
      id: crypto.randomUUID(),
      eventType: 'transaction',
      timestamp: Date.now(),
      userAddress,
      userName: userName || `${userAddress.slice(0, 6)}...`,
      userAvatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userAddress}`,
      content: `made a transaction of ${amount} ${token}`,
      targetId: transactionId,
      metadata: {
        amount,
        token,
        transactionId
      },
      likes: 0
    };

    const vector = generateEventEmbedding(event);

    await qdrantClient.upsert(FEED_EVENTS_COLLECTION, {
      wait: true,
      points: [{
        id: event.id,
        vector,
        payload: event as any
      }]
    });

    console.log(`Created transaction event: ${userAddress} - ${amount} ${token}`);
  } catch (error) {
    console.error('Error creating transaction event:', error);
  }
}

/**
 * Create a feed event for profile updates
 */
export async function createProfileUpdateEvent(
  userAddress: string,
  updateType: string,
  userName?: string
): Promise<void> {
  try {
    await initializeFeedEventsCollection();

    const event: SocialFeedEvent = {
      id: crypto.randomUUID(),
      eventType: 'profile_update',
      timestamp: Date.now(),
      userAddress,
      userName: userName || `${userAddress.slice(0, 6)}...`,
      userAvatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userAddress}`,
      content: `updated their ${updateType}`,
      metadata: {
        updateType
      },
      likes: 0
    };

    const vector = generateEventEmbedding(event);

    await qdrantClient.upsert(FEED_EVENTS_COLLECTION, {
      wait: true,
      points: [{
        id: event.id,
        vector,
        payload: event as any
      }]
    });

    console.log(`Created profile update event: ${userAddress} - ${updateType}`);
  } catch (error) {
    console.error('Error creating profile update event:', error);
  }
}

/**
 * Get feed events for a user
 */
export async function getFeedEvents(
  options: {
    feedType: 'for-you' | 'following';
    userAddress: string;
    followingAddresses?: string[];
    limit?: number;
    offset?: number;
    eventTypes?: string[];
    dateRange?: 'today' | 'week' | 'month' | 'all';
    sortOrder?: 'newest' | 'popular';
  }
): Promise<SocialFeedEvent[]> {
  try {
    await initializeFeedEventsCollection();

    const {
      feedType,
      userAddress,
      followingAddresses = [],
      limit = 20,
      offset = 0,
      eventTypes = [],
      dateRange = 'all',
      sortOrder = 'newest'
    } = options;

    // Build filter
    const filter: any = {
      must: []
    };

    // Filter by feed type
    if (feedType === 'following' && followingAddresses.length > 0) {
      // For following feed, only show events from users we follow
      filter.must.push({
        key: 'userAddress',
        match: { any: followingAddresses }
      });
    } else if (feedType === 'for-you') {
      // For "for-you" feed, exclude events from the current user (unless they're interactions with others)
      filter.must_not = [
        {
          key: 'userAddress',
          match: { value: userAddress }
        }
      ];
    }

    // Filter by event types (only if not all types are selected)
    // If all 6 types are selected (including 'visit'), treat it the same as no filter
    const allEventTypes = ['transaction', 'follow', 'like', 'profile_update', 'token_transfer', 'visit'];
    const isAllTypesSelected = eventTypes.length === allEventTypes.length && 
      allEventTypes.every(type => eventTypes.includes(type));
    
    if (eventTypes.length > 0 && !isAllTypesSelected) {
      filter.must.push({
        key: 'eventType',
        match: { any: eventTypes }
      });
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

      filter.must.push({
        key: 'timestamp',
        range: { gte: timeThreshold }
      });
    }

    // Get events using scroll (not vector search) since we're filtering by metadata
    const result = await qdrantClient.scroll(FEED_EVENTS_COLLECTION, {
      filter,
      limit: limit + offset, // Get more to handle offset
      with_payload: true,
      with_vector: false
    });

    let events = result.points.map(point => point.payload as unknown as SocialFeedEvent);

    // Sort events
    if (sortOrder === 'popular') {
      events.sort((a, b) => {
        if (a.likes !== b.likes) return b.likes - a.likes;
        return b.timestamp - a.timestamp; // Break ties with timestamp
      });
    } else {
      events.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Apply offset and limit
    events = events.slice(offset, offset + limit);

    return events;
  } catch (error) {
    console.error('Error getting feed events:', error);
    return [];
  }
}

/**
 * Like/unlike a feed event
 */
export async function toggleEventLike(
  eventId: string,
  userAddress: string
): Promise<{ likes: number; hasLiked: boolean }> {
  try {
    await initializeFeedEventsCollection();

    // Get the event using scroll (not vector search)
    const result = await qdrantClient.scroll(FEED_EVENTS_COLLECTION, {
      filter: {
        must: [{ key: 'id', match: { value: eventId } }]
      },
      limit: 1,
      with_payload: true,
      with_vector: false
    });

    if (result.points.length === 0) {
      throw new Error('Event not found');
    }

    const event = result.points[0].payload as any;
    const pointId = result.points[0].id;

    // Get current likedBy array or create one
    const likedBy = event.metadata?.likedBy || [];
    const hasLiked = likedBy.includes(userAddress);

    // Toggle like status
    const newLikedBy = hasLiked
      ? likedBy.filter((addr: string) => addr !== userAddress)
      : [...likedBy, userAddress];

    const newLikes = newLikedBy.length;

    // Update event
    const updatedEvent = {
      ...event,
      likes: newLikes,
      metadata: {
        ...event.metadata,
        likedBy: newLikedBy
      }
    };

    const vector = generateEventEmbedding(updatedEvent);

    await qdrantClient.upsert(FEED_EVENTS_COLLECTION, {
      wait: true,
      points: [{
        id: pointId,
        vector,
        payload: updatedEvent
      }]
    });

    return {
      likes: newLikes,
      hasLiked: !hasLiked
    };
  } catch (error) {
    console.error('Error toggling event like:', error);
    throw error;
  }
}

/**
 * Generate embedding for feed event
 */
function generateEventEmbedding(event: SocialFeedEvent): number[] {
  const textContent = `${event.eventType} ${event.content} ${event.userAddress} ${JSON.stringify(event.metadata)}`;
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
 * Clean up old feed events (older than specified days)
 */
export async function cleanupOldFeedEvents(maxAgeDays: number = 30): Promise<number> {
  try {
    await initializeFeedEventsCollection();

    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

    const result = await qdrantClient.scroll(FEED_EVENTS_COLLECTION, {
      filter: {
        must: [
          { key: 'timestamp', range: { lt: cutoffTime } }
        ]
      },
      limit: 10000,
      with_payload: false,
      with_vector: false
    });

    if (result.points.length > 0) {
      const pointIds = result.points.map(r => r.id as string);
      
      await qdrantClient.delete(FEED_EVENTS_COLLECTION, {
        wait: true,
        points: pointIds
      });

      console.log(`Cleaned up ${pointIds.length} old feed events`);
      return pointIds.length;
    }

    return 0;
  } catch (error) {
    console.error('Error cleaning up old feed events:', error);
    return 0;
  }
}
