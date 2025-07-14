/**
 * API endpoint for following users
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
            { key: 'followingAddress', match: { value: targetAddress } }
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
      followingAddress: targetAddress,
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

    // Update follower count for target user
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
          followers: (currentSocialStats.followers || 0) + 1
        }
      };

      // Get the existing point ID from the search result
      const targetPointId = targetProfileResult[0].id;
      
      await qdrantClient.upsert('user_profiles', {
        points: [
          {
            id: targetPointId,
            vector: Array(384).fill(0),
            payload: updatedProfile
          }
        ]
      });
    }

    // Update following count for current user
    const currentProfileResult = await qdrantClient.search('user_profiles', {
      vector: Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: session.walletAddress } }]
      },
      limit: 1
    });

    if (currentProfileResult.length > 0) {
      const currentProfile = currentProfileResult[0].payload as any;
      const currentSocialStats = currentProfile.socialStats || {
        visitsByUsers: 0,
        followers: 0,
        following: 0,
        likes: 0,
        profileViews: 0
      };
      const updatedProfile = {
        ...currentProfile,
        socialStats: {
          ...currentSocialStats,
          following: (currentSocialStats.following || 0) + 1
        }
      };

      // Get the existing point ID from the search result
      const currentPointId = currentProfileResult[0].id;
      
      await qdrantClient.upsert('user_profiles', {
        points: [
          {
            id: currentPointId,
            vector: Array(384).fill(0),
            payload: updatedProfile
          }
        ]
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error following user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}