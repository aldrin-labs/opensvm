/**
 * API endpoint for unliking user profiles
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/qdrant';
import { getAuthenticatedSession } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getAuthenticatedSession(request);
    if (!session) {
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

    // Update likes count for target user
    const targetProfileResult = await qdrantClient.search('user_profiles', {
      vector: Array(384).fill(0),
      filter: {
        must: [{ key: 'walletAddress', match: { value: targetAddress } }]
      },
      limit: 1
    });

    if (targetProfileResult.length > 0) {
      const targetProfile = targetProfileResult[0].payload;
      const updatedProfile = {
        ...targetProfile,
        socialStats: {
          ...targetProfile.socialStats,
          likes: Math.max(0, (targetProfile.socialStats?.likes || 0) - 1)
        }
      };

      await qdrantClient.upsert('user_profiles', {
        points: [
          {
            id: targetProfile.walletAddress,
            vector: Array(384).fill(0),
            payload: updatedProfile
          }
        ]
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unliking user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}