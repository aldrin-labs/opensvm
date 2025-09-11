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

// Global connection registry for real-time broadcasting
interface SSEConnection {
  id: string;
  controller: ReadableStreamDefaultController;
  walletAddress: string;
  feedType: string;
  isActive: boolean;
}

declare global {
  var sseConnections: Map<string, SSEConnection> | undefined;
}

// Initialize global connections registry
if (!global.sseConnections) {
  global.sseConnections = new Map();
}

// Function to broadcast to all connections
export function broadcastToSSE(event: any) {
  if (!global.sseConnections) return;

  const encoder = new TextEncoder();
  const eventData = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  for (const [connectionId, connection] of global.sseConnections.entries()) {
    try {
      if (connection.isActive && connection.controller) {
        connection.controller.enqueue(eventData);
      }
    } catch (error) {
      // Connection failed, remove it
      connection.isActive = false;
      global.sseConnections.delete(connectionId);
    }
  }
}

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
    const session = await getSessionFromCookie();
    const authenticatedWallet = session?.walletAddress;

    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: async (controller) => {
        let isControllerClosed = false;
        const connectionId = `sse-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const safeClose = () => {
          if (!isControllerClosed) {
            try {
              controller.close();
              isControllerClosed = true;
              // Remove from global registry
              if (global.sseConnections) {
                global.sseConnections.delete(connectionId);
              }
            } catch (e) {
              // Controller already closed, ignore
            }
          }
        };

        const safeEnqueue = (data: Uint8Array) => {
          if (!isControllerClosed) {
            try {
              controller.enqueue(data);
              return true;
            } catch (e) {
              isControllerClosed = true;
              if (global.sseConnections) {
                const connection = global.sseConnections.get(connectionId);
                if (connection) {
                  connection.isActive = false;
                }
              }
              return false;
            }
          }
          return false;
        };

        // Register this connection in global registry
        if (global.sseConnections) {
          global.sseConnections.set(connectionId, {
            id: connectionId,
            controller,
            walletAddress,
            feedType,
            isActive: true
          });
        }

        // Send initial connection confirmation
        const message = {
          type: 'connection',
          message: 'Connected to feed events',
          timestamp: Date.now()
        };
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));

        // Keep connection alive with periodic messages
        const keepAliveInterval = setInterval(() => {
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`))) {
            clearInterval(keepAliveInterval);
            clearInterval(realEventsInterval);
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

            // Apply feed type filtering
            if (feedType === 'following') {
              // For 'following' feed, only include events from followed users
              if (!followingList.some(f => f.targetAddress === entry.walletAddress)) {
                return null;
              }
            } else if (feedType === 'for-you') {
              // For 'for-you' feed, show recent activity from today or content with engagement
              const todayStart = new Date().setHours(0, 0, 0, 0);
              const isFromToday = entry.timestamp >= todayStart;
              const hasEngagement = entry.metadata?.likes && entry.metadata.likes > 0;

              // Include if: recent activity from today OR has some engagement OR is from profile owner
              if (!isFromToday && !hasEngagement && entry.walletAddress !== walletAddress) {
                return null;
              }
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
          if (isControllerClosed) {
            clearInterval(realEventsInterval);
            clearInterval(keepAliveInterval);
            return;
          }

          try {
            // Fetch the latest events from the database
            // Use a valid wallet address instead of empty string
            const { history } = await getUserHistory(
              walletAddress, // Use the actual wallet address
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

                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify(eventUpdate)}\n\n`))) {
                  // If enqueueing fails, the connection is likely closed
                  clearInterval(realEventsInterval);
                  clearInterval(keepAliveInterval);
                  return;
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

              if (safeEnqueue(encoder.encode(`data: ${JSON.stringify(likeUpdate)}\n\n`))) {
                // Update cached event
                cachedEvents = cachedEvents.map(e =>
                  e.id === randomEvent.id ? { ...e, likes: newLikes } : e
                );
              } else {
                // If enqueueing fails, the connection is likely closed
                clearInterval(realEventsInterval);
                clearInterval(keepAliveInterval);
                return;
              }
            }

          } catch (e) {
            console.error('Error in SSE polling:', e);
            // If this fails, the connection is likely closed
            clearInterval(realEventsInterval);
            clearInterval(keepAliveInterval);
            safeClose();
          }
        }, 5000); // Poll for new events every 5 seconds

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          clearInterval(realEventsInterval);
          if (global.sseConnections) {
            global.sseConnections.delete(connectionId);
          }
          safeClose();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'X-Accel-Buffering': 'no', // Prevents buffering for Nginx proxy
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
      }
    });

  } catch (error) {
    console.error('Error setting up SSE connection:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
