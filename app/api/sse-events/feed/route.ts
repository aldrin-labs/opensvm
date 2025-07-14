/**
 * Server-Sent Events (SSE) endpoint for real-time feed updates
 */

import { NextRequest } from 'next/server';
import { validateWalletAddress } from '@/lib/user-history-utils';
import { getSessionFromCookie } from '@/lib/auth-server';
import { getUserHistory, getUserFollowing } from '@/lib/qdrant';

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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query params
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('walletAddress');
    const feedType = url.searchParams.get('type') || 'for-you';
    
    // Validate wallet address
    if (!walletAddress || !validateWalletAddress(walletAddress)) {
      return new Response('Invalid wallet address', { status: 400 });
    }
    
    // Get authenticated user (optional)
    const session = getSessionFromCookie();
    const authenticatedWallet = session?.walletAddress;
    
    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: async (controller) => {
        // Send initial connection confirmation
        const message = {
          type: 'connection',
          message: 'Connected to feed events',
          timestamp: Date.now()
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        
        // Keep connection alive with periodic messages
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`));
          } catch (e) {
            // If this fails, the connection is likely closed
            clearInterval(keepAliveInterval);
            clearInterval(realEventsInterval);
            controller.close();
          }
        }, 30000); // Send keep-alive every 30 seconds
        
        // Set up polling for real-time events
        let lastEventTimestamp = Date.now();
        let cachedEvents: FeedEvent[] = [];
        
        // Function to convert history entry to feed event
        const historyToFeedEvent = (entry: any): FeedEvent | null => {
          try {
            // Extract event data from history entry
            const eventType = entry.pageType as 'transaction' | 'visit' | 'like' | 'follow' | 'other';
            
            // For 'following' feed, filter to only include events from followed users
            if (feedType === 'following' && followingList &&
                !followingList.some(f => f.targetAddress === entry.walletAddress)) {
              return null;
            }
            
            // Prepare user data for the event
            const userName = entry.metadata?.userName || `User ${entry.walletAddress.slice(0, 6)}`;
            const userAvatar = entry.metadata?.userAvatar ||
              `https://api.dicebear.com/7.x/adventurer/svg?seed=${entry.walletAddress}`;
            
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
              hasLiked: authenticatedWallet ? entry.metadata?.likedBy?.includes(authenticatedWallet) : false
            };
          } catch (error) {
            console.error('Error converting history entry to feed event:', error);
            return null;
          }
        };
        
        // Get initial list of following if needed
        let followingList: any[] = [];
        if (feedType === 'following' && walletAddress) {
          try {
            followingList = await getUserFollowing(walletAddress);
          } catch (error) {
            console.error('Error fetching following list:', error);
          }
        }
        
        // Poll for new events
        const realEventsInterval = setInterval(async () => {
          try {
            // Fetch the latest events from the database
            const { history } = await getUserHistory(
              '', // Empty string to get all events
              {
                limit: 20,
                // Only get events newer than the last one we've seen
                // Filter in-memory after fetching
              }
            );
            
            // Find new events (events with timestamp > lastEventTimestamp)
            const newEntries = history.filter(entry => entry.timestamp > lastEventTimestamp);
            
            if (newEntries.length > 0) {
              // Update lastEventTimestamp to the newest event's timestamp
              lastEventTimestamp = Math.max(...newEntries.map(entry => entry.timestamp));
              
              // Convert new entries to feed events
              const newEvents = newEntries
                .map(historyToFeedEvent)
                .filter((event): event is FeedEvent => event !== null);
              
              // Update cached events
              cachedEvents = [...newEvents, ...cachedEvents].slice(0, 100); // Keep last 100 events
              
              // Send each new event to the client
              for (const event of newEvents) {
                const eventUpdate = {
                  type: 'feed-update',
                  event
                };
                
                try {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventUpdate)}\n\n`));
                } catch (e) {
                  // If enqueueing fails, the connection is likely closed
                  throw e;
                }
              }
            }
            
            // Randomly send like updates based on real events
            if (cachedEvents.length > 0 && Math.random() > 0.8) {
              const randomEvent = cachedEvents[Math.floor(Math.random() * cachedEvents.length)];
              const newLikes = randomEvent.likes + 1;
              
              const likeUpdate = {
                type: 'like-update',
                eventId: randomEvent.id,
                likes: newLikes,
                userHasLiked: authenticatedWallet
              };
              
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(likeUpdate)}\n\n`));
                
                // Update cached event
                cachedEvents = cachedEvents.map(e =>
                  e.id === randomEvent.id ? {...e, likes: newLikes} : e
                );
              } catch (e) {
                // If enqueueing fails, the connection is likely closed
                throw e;
              }
            }
            
          } catch (e) {
            // If this fails, the connection is likely closed
            clearInterval(realEventsInterval);
            clearInterval(keepAliveInterval);
            controller.close();
          }
        }, 5000); // Poll for new events every 5 seconds
        
        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          clearInterval(realEventsInterval);
          controller.close();
        });
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Prevents buffering for Nginx proxy
      }
    });
    
  } catch (error) {
    console.error('Error setting up SSE connection:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
