/**
 * User History Sync API
 * Handles syncing client-side user history entries to server-side Qdrant storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeHistoryEntry, checkQdrantHealth } from '@/lib/qdrant';
import { validateWalletAddress } from '@/lib/user-history-utils';
import type { UserHistoryEntry } from '@/types/user-history';

export async function POST(request: NextRequest) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const { entry } = body;

    if (!entry) {
      return NextResponse.json({ error: 'History entry is required' }, { status: 400 });
    }

    // Validate the entry structure
    const historyEntry = entry as UserHistoryEntry;
    
    if (!historyEntry.id || !historyEntry.walletAddress || !historyEntry.timestamp) {
      return NextResponse.json({ error: 'Invalid history entry format' }, { status: 400 });
    }

    // Validate wallet address
    const validatedAddress = validateWalletAddress(historyEntry.walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Update the entry with validated address
    const validatedEntry: UserHistoryEntry = {
      ...historyEntry,
      walletAddress: validatedAddress
    };

    // Store to Qdrant
    await storeHistoryEntry(validatedEntry);

    // Broadcast real-time event to SSE feed connections
    try {
      const feedEvent = {
        type: 'feed-update',
        event: {
          id: validatedEntry.id,
          eventType: validatedEntry.pageType,
          timestamp: validatedEntry.timestamp,
          userAddress: validatedEntry.walletAddress,
          userName: validatedEntry.metadata?.userName || `User ${validatedEntry.walletAddress.slice(0, 6)}`,
          userAvatar: validatedEntry.metadata?.userAvatar || 
            `https://api.dicebear.com/7.x/adventurer/svg?seed=${validatedEntry.walletAddress}`,
          content: validatedEntry.pageTitle || validatedEntry.path || 'Performed an action',
          targetAddress: validatedEntry.metadata?.targetAddress,
          targetId: validatedEntry.metadata?.targetId,
          metadata: validatedEntry.metadata,
          likes: validatedEntry.metadata?.likes || 0,
          hasLiked: false
        }
      };

      // Broadcast to active SSE connections using global registry
      if (global.sseConnections) {
        const encoder = new TextEncoder();
        const eventData = encoder.encode(`data: ${JSON.stringify(feedEvent)}\n\n`);

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
    } catch (broadcastError) {
      console.warn('Failed to broadcast real-time event:', broadcastError);
      // Don't fail the sync if broadcast fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'History entry synced successfully',
      entryId: validatedEntry.id,
      broadcast: true
    });

  } catch (error) {
    console.error('Error syncing history entry:', error);
    
    return NextResponse.json({ 
      error: 'Failed to sync history entry',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
