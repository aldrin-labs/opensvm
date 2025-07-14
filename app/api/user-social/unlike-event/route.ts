/**
 * User Social Unlike Event API Endpoint
 * Handles removing likes from events in the feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth-server';
import {
  checkQdrantHealth,
  getUserHistory,
  storeHistoryEntry
} from '@/lib/qdrant';

// Authentication check using session validation
function isValidRequest(_request: NextRequest): { isValid: boolean; walletAddress?: string } {
  try {
    const session = getSessionFromCookie();
    if (!session) return { isValid: false };
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) return { isValid: false };
    
    return { isValid: true, walletAddress: session.walletAddress };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isValid: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // Authentication check
    const auth = isValidRequest(request);
    if (!auth.isValid || !auth.walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { eventId } = body;
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Find the event in history to update like count
    // Get all history entries to find the specific event by ID
    const { history } = await getUserHistory('', { limit: 1000 });
    
    // Find the event by id
    const eventEntry = history.find(entry => entry.id === eventId);
    if (!eventEntry) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    // Check if user has liked this event
    const likedBy = eventEntry.metadata?.likedBy || [];
    if (!likedBy.includes(auth.walletAddress)) {
      return NextResponse.json({
        success: false,
        message: 'User has not liked this event',
      });
    }
    
    // Update event metadata to remove like
    eventEntry.metadata = {
      ...eventEntry.metadata,
      likes: Math.max((eventEntry.metadata?.likes || 0) - 1, 0), // Ensure likes don't go negative
      likedBy: likedBy.filter((addr: string) => addr !== auth.walletAddress)
    };
    
    // Save updated event back to database
    await storeHistoryEntry(eventEntry);
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: `Like removed from event ${eventId} by ${auth.walletAddress}`,
      newLikeCount: eventEntry.metadata.likes
    });
  } catch (error) {
    console.error('Error processing unlike event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
