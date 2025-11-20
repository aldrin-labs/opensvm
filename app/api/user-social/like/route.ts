/**
 * API endpoint for liking user profiles
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { v4 as uuidv4 } from 'uuid';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { checkSVMAIAccess, MIN_SVMAI_BALANCE } from '@/lib/api-auth/token-gating';
import { syncUserProfileStats } from '@/lib/maintenance/user-stats-sync';
import { createLikeEvent } from '@/lib/user/feed-events';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getSessionFromCookie();
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has enough SVMAI tokens to like
    const tokenGatingResult = await checkSVMAIAccess(session.walletAddress);
    if (!tokenGatingResult.hasAccess) {
      return NextResponse.json({
        error: `You need at least ${MIN_SVMAI_BALANCE} SVMAI tokens to like users. Your current balance: ${tokenGatingResult.balance}`,
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
      return NextResponse.json({ error: 'Cannot like yourself' }, { status: 400 });
    }

    // Check if already liked
    let existingLikeResult = [];
    try {
      existingLikeResult = await qdrantClient.search('user_likes', {
        vector: Array(384).fill(0),
        filter: {
          must: [
            { key: 'likerAddress', match: { value: session.walletAddress } },
            { key: 'targetAddress', match: { value: targetAddress } }
          ]
        },
        limit: 1
      });
    } catch (error) {
      // Collection doesn't exist yet, will be created below
      console.log('user_likes collection does not exist, will create it');
    }

    if (existingLikeResult.length > 0) {
      return NextResponse.json({ error: 'Already liked this user' }, { status: 400 });
    }

    // Create like entry
    const likeEntry = {
      id: uuidv4(),
      likerAddress: session.walletAddress,
      targetAddress: targetAddress,
      timestamp: Date.now()
    };

    try {
      await qdrantClient.upsert('user_likes', {
        points: [
          {
            id: likeEntry.id,
            vector: Array(384).fill(0),
            payload: likeEntry
          }
        ]
      });
    } catch (error) {
      // Create collection if it doesn't exist
      try {
        await qdrantClient.createCollection('user_likes', {
          vectors: { size: 384, distance: 'Cosine' }
        });

        // Retry upserting the like
        await qdrantClient.upsert('user_likes', {
          points: [
            {
              id: likeEntry.id,
              vector: Array(384).fill(0),
              payload: likeEntry
            }
          ]
        });
      } catch (createError) {
        console.error('Error creating user_likes collection:', createError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    // Create feed event for this like action
    try {
      await createLikeEvent(session.walletAddress, targetAddress);
    } catch (feedError) {
      console.error('Error creating like feed event:', feedError);
      // Don't fail the like operation if feed event creation fails
    }

    // Use unified stats synchronization instead of manual updates
    try {
      // Sync stats for target user to ensure accurate like count
      await syncUserProfileStats(targetAddress);
      
      console.log(`Synchronized stats after like: ${session.walletAddress} liked ${targetAddress}`);
    } catch (syncError) {
      console.error('Error synchronizing stats after like:', syncError);
      // Don't fail the like operation if sync fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error liking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
