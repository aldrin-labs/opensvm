/**
 * API endpoint for following users
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { v4 as uuidv4 } from 'uuid';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { checkSVMAIAccess, MIN_SVMAI_BALANCE } from '@/lib/api-auth/token-gating';
import { syncUserProfileStats } from '@/lib/maintenance/user-stats-sync';
import { createFollowEvent } from '@/lib/user/feed-events';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getSessionFromCookie();
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has enough SVMAI tokens to follow
    const tokenGatingResult = await checkSVMAIAccess(session.walletAddress);
    if (!tokenGatingResult.hasAccess) {
      return NextResponse.json({
        error: `You need at least ${MIN_SVMAI_BALANCE} SVMAI tokens to follow users. Your current balance: ${tokenGatingResult.balance}`,
        tokenGating: {
          required: MIN_SVMAI_BALANCE,
          current: tokenGatingResult.balance,
          sufficient: false
        }
      }, { status: 403 });
    }

    const { targetAddress } = await request.json();

    if (!targetAddress || typeof targetAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid target address' }, { status: 400 });
    }

    if (session.walletAddress === targetAddress) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    let existingFollowResult = [];
    try {
      existingFollowResult = await qdrantClient.search('user_follows', {
        vector: Array(384).fill(0),
        filter: {
          must: [
            { key: 'followerAddress', match: { value: session.walletAddress } },
            { key: 'targetAddress', match: { value: targetAddress } }
          ]
        },
        limit: 1
      });
    } catch (error) {
      // Collection doesn't exist yet, will be created below
      console.log('user_follows collection does not exist, will create it');
    }

    if (existingFollowResult.length > 0) {
      return NextResponse.json({ error: 'Already following this user' }, { status: 400 });
    }

    // Create follow relationship
    const followEntry = {
      id: uuidv4(),
      followerAddress: session.walletAddress,
      targetAddress: targetAddress,
      timestamp: Date.now()
    };

    try {
      await qdrantClient.upsert('user_follows', {
        points: [
          {
            id: followEntry.id,
            vector: Array(384).fill(0),
            payload: followEntry
          }
        ]
      });
    } catch (error) {
      // Create collection if it doesn't exist
      try {
        await qdrantClient.createCollection('user_follows', {
          vectors: { size: 384, distance: 'Cosine' }
        });

        // Retry upserting the follow
        await qdrantClient.upsert('user_follows', {
          points: [
            {
              id: followEntry.id,
              vector: Array(384).fill(0),
              payload: followEntry
            }
          ]
        });
      } catch (createError) {
        console.error('Error creating user_follows collection:', createError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    // Create feed event for this follow action
    try {
      await createFollowEvent(session.walletAddress, targetAddress);
    } catch (feedError) {
      console.error('Error creating follow feed event:', feedError);
      // Don't fail the follow operation if feed event creation fails
    }

    // Use unified stats synchronization instead of manual updates
    try {
      // Sync stats for both users to ensure accurate counts
      await Promise.all([
        syncUserProfileStats(targetAddress),
        syncUserProfileStats(session.walletAddress)
      ]);
      
      console.log(`Synchronized stats after follow: ${session.walletAddress} -> ${targetAddress}`);
    } catch (syncError) {
      console.error('Error synchronizing stats after follow:', syncError);
      // Don't fail the follow operation if sync fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error following user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
