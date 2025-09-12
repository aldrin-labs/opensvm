/**
 * API endpoint for unliking feed events
 */

import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth-server';
import { toggleEventLike } from '@/lib/feed-events';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getSessionFromCookie();
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await request.json();

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    // Toggle like status for the event (will unlike if currently liked)
    const result = await toggleEventLike(eventId, session.walletAddress);

    return NextResponse.json({
      success: true,
      eventId,
      likes: result.likes,
      hasLiked: result.hasLiked
    });

  } catch (error) {
    console.error('Error unliking event:', error);
    
    if (error instanceof Error && error.message === 'Event not found') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
