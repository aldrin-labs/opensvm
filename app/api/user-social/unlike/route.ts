/**
 * API endpoint for unliking user profiles
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { syncUserProfileStats } from '@/lib/maintenance/user-stats-sync';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getSessionFromCookie();
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetAddress } = await request.json();

    if (!targetAddress || typeof targetAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid target address' }, { status: 400 });
    }

    // Find and delete the like
    const existingLikeResult = await qdrantClient.search('user_likes', {
      vector: Array(384).fill(0),
      filter: {
        must: [
          { key: 'likerAddress', match: { value: session.walletAddress } },
          { key: 'targetAddress', match: { value: targetAddress } }
        ]
      },
      limit: 1
    });

    if (existingLikeResult.length === 0) {
      return NextResponse.json({ error: 'Not liked this user' }, { status: 400 });
    }

    // Delete the like
    await qdrantClient.delete('user_likes', {
      points: [existingLikeResult[0].id]
    });

    // Use unified stats synchronization instead of manual updates
    try {
      // Sync stats for target user to ensure accurate like count
      await syncUserProfileStats(targetAddress);
      
      console.log(`Synchronized stats after unlike: ${session.walletAddress} unliked ${targetAddress}`);
    } catch (syncError) {
      console.error('Error synchronizing stats after unlike:', syncError);
      // Don't fail the unlike operation if sync fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unliking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
