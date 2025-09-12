/**
 * API endpoint for unfollowing users
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/qdrant';
import { getSessionFromCookie } from '@/lib/auth-server';
import { syncUserProfileStats } from '@/lib/user-stats-sync';

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

    // Find and delete the follow relationship
    const existingFollowResult = await qdrantClient.search('user_follows', {
      vector: Array(384).fill(0),
      filter: {
        must: [
          { key: 'followerAddress', match: { value: session.walletAddress } },
          { key: 'targetAddress', match: { value: targetAddress } }
        ]
      },
      limit: 1
    });

    if (existingFollowResult.length === 0) {
      return NextResponse.json({ error: 'Not following this user' }, { status: 400 });
    }

    // Delete the follow relationship
    await qdrantClient.delete('user_follows', {
      points: [existingFollowResult[0].id]
    });

    // Use unified stats synchronization instead of manual updates
    try {
      // Sync stats for both users to ensure accurate counts
      await Promise.all([
        syncUserProfileStats(targetAddress),
        syncUserProfileStats(session.walletAddress)
      ]);
      
      console.log(`Synchronized stats after unfollow: ${session.walletAddress} unfollowed ${targetAddress}`);
    } catch (syncError) {
      console.error('Error synchronizing stats after unfollow:', syncError);
      // Don't fail the unfollow operation if sync fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
