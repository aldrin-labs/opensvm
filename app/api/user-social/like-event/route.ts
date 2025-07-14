/**
 * User Social Like Event API Endpoint
 * Handles liking events in the feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth-server';
import {
  checkQdrantHealth,
  getUserHistory,
  storeHistoryEntry
} from '@/lib/qdrant';
import { generateId } from '@/lib/user-history-utils';
import { checkSVMAIAccess, MIN_SVMAI_BALANCE } from '@/lib/token-gating';

// Event Like entry interface
interface EventLikeEntry {
  id: string;
  eventId: string;
  walletAddress: string;
  timestamp: number;
}

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

    // Check if user has enough SVMAI tokens to like events
    const tokenGatingResult = await checkSVMAIAccess(auth.walletAddress);
    if (!tokenGatingResult.hasAccess) {
      return NextResponse.json({
        error: `You need at least ${MIN_SVMAI_BALANCE} SVMAI tokens to like events. Your current balance: ${tokenGatingResult.balance}`,
        tokenGating: {
          required: MIN_SVMAI_BALANCE,
          current: tokenGatingResult.balance,
          sufficient: false
        }
      }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { eventId } = body;
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Create like entry
    const likeEntry: EventLikeEntry = {
      id: generateId(),
      walletAddress: auth.walletAddress,
      eventId,
      timestamp: Date.now()
    };
    
    // Find the event in history to update like count
    // Get all history entries to find the specific event by ID
    const { history } = await getUserHistory('', { limit: 1000 });
    
    // Find the event by id
    const eventEntry = history.find(entry => entry.id === eventId);
    if (!eventEntry) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    // Check if user already liked this event
    const likedBy = eventEntry.metadata?.likedBy || [];
    if (likedBy.includes(auth.walletAddress)) {
      return NextResponse.json({
        success: false,
        message: 'User already liked this event',
        like: null
      });
    }
    
    // Update event metadata with new like
    eventEntry.metadata = {
      ...eventEntry.metadata,
      likes: (eventEntry.metadata?.likes || 0) + 1,
      likedBy: [...likedBy, auth.walletAddress]
    };
    
    // Save updated event back to database
    await storeHistoryEntry(eventEntry);
    
    // Return success response
    return NextResponse.json({
      success: true,
      like: likeEntry,
      newLikeCount: eventEntry.metadata.likes
    });
  } catch (error) {
    console.error('Error processing like event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
