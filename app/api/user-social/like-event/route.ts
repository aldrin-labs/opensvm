/**
 * API endpoint for liking/unliking feed events
 */

import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { checkSVMAIAccess, MIN_SVMAI_BALANCE } from '@/lib/api-auth/token-gating';
import { toggleEventLike } from '@/lib/user/feed-events';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getSessionFromCookie();
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has enough SVMAI tokens to like events
    const tokenGatingResult = await checkSVMAIAccess(session.walletAddress);
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

    const { eventId } = await request.json();

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    // Toggle like status for the event
    const result = await toggleEventLike(eventId, session.walletAddress);

    return NextResponse.json({
      success: true,
      eventId,
      likes: result.likes,
      hasLiked: result.hasLiked
    });

  } catch (error) {
    console.error('Error liking/unliking event:', error);
    
    if (error instanceof Error && error.message === 'Event not found') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
