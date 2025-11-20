/**
 * Server-Sent Events (SSE) endpoint for real-time feed updates
 */

import { NextRequest } from 'next/server';
import { validateWalletAddress } from '@/lib/user/user-history-utils';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { getUserFollowing } from '@/lib/search/qdrant';
import { getFeedEvents, SocialFeedEvent } from '@/lib/user/feed-events';

// Use SocialFeedEvent from feed-events module
type FeedEvent = SocialFeedEvent;

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
  // eslint-disable-next-line no-var
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

        // Get initial list of following if needed
        let followingList: any[] = [];
        if (feedType === 'following' && walletAddress) {
          try {
            followingList = await getUserFollowing(walletAddress);
          } catch (error) {
            console.error('Error fetching following list:', error);
          }
        }

        // Poll for new social feed events
        const realEventsInterval = setInterval(async () => {
          if (isControllerClosed) {
            clearInterval(realEventsInterval);
            clearInterval(keepAliveInterval);
            return;
          }

          try {
            // Get the latest social feed events
            const followingAddresses = followingList.map(f => f.targetAddress);

            const newEvents = await getFeedEvents({
              feedType: feedType as 'for-you' | 'following',
              userAddress: walletAddress,
              followingAddresses,
              limit: 10,
              offset: 0,
              dateRange: 'all',
              sortOrder: 'newest'
            });

            // Find events newer than our last check
            const recentEvents = newEvents.filter(event => event.timestamp > lastEventTimestamp);

            if (recentEvents.length > 0) {
              // Update lastEventTimestamp to the newest event's timestamp
              lastEventTimestamp = Math.max(...recentEvents.map(event => event.timestamp));

              // Update cached events
              cachedEvents = [...recentEvents, ...cachedEvents].slice(0, 100); // Keep last 100 events

              // Send each new event to the client
              for (const event of recentEvents) {
                const eventUpdate = {
                  type: 'feed-update',
                  event: {
                    ...event,
                    hasLiked: authenticatedWallet ? event.metadata?.likedBy?.includes(authenticatedWallet) || false : false
                  }
                };

                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify(eventUpdate)}\n\n`))) {
                  // If enqueueing fails, the connection is likely closed
                  clearInterval(realEventsInterval);
                  clearInterval(keepAliveInterval);
                  return;
                }
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
