/**
 * API endpoint for liking user profiles
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/qdrant';
import { v4 as uuidv4 } from 'uuid';
import { getSessionFromCookie } from '@/lib/auth-server';
import { checkSVMAIAccess, MIN_SVMAI_BALANCE } from '@/lib/token-gating';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = getSessionFromCookie();
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

    // Update likes count for target user
    const targetProfileResult = await qdrantClient.search('user_profiles', {
      vector: Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: targetAddress } }]
      },
      limit: 1
    });

    if (targetProfileResult.length > 0) {
      const targetProfile = targetProfileResult[0].payload as any;
      const currentSocialStats = targetProfile.socialStats || {
        visitsByUsers: 0,
        followers: 0,
        following: 0,
        likes: 0,
        profileViews: 0
      };
      const updatedProfile = {
        ...targetProfile,
        socialStats: {
          ...currentSocialStats,
          likes: (currentSocialStats.likes || 0) + 1
        }
      };

      // Get the existing point ID from the search result
      const pointId = targetProfileResult[0].id;
      
      await qdrantClient.upsert('user_profiles', {
        points: [
          {
            id: pointId,
            vector: Array(384).fill(0),
            payload: updatedProfile
          }
        ]
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error liking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}