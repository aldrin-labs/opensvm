/**
 * User Profile Sync API
 * Handles syncing client-side user profiles and stats to server-side Qdrant storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeUserProfile, checkQdrantHealth } from '@/lib/qdrant';
import { validateWalletAddress } from '@/lib/user-history-utils';
import type { UserProfile } from '@/types/user-history';

export async function POST(request: NextRequest) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const { profile } = body;

    if (!profile) {
      return NextResponse.json({ error: 'Profile data is required' }, { status: 400 });
    }

    // Validate the profile structure
    const userProfile = profile as UserProfile;
    
    if (!userProfile.walletAddress) {
      return NextResponse.json({ error: 'Invalid profile format: missing walletAddress' }, { status: 400 });
    }

    // Validate wallet address
    const validatedAddress = validateWalletAddress(userProfile.walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Update the profile with validated address and ensure required fields
    const validatedProfile: UserProfile = {
      ...userProfile,
      walletAddress: validatedAddress,
      lastActive: Date.now(),
      // Ensure socialStats exists
      socialStats: userProfile.socialStats || {
        visitsByUsers: 0,
        followers: 0,
        following: 0,
        likes: 0,
        profileViews: 0
      },
      // Ensure stats exists with correct UserHistoryStats structure
      stats: userProfile.stats || {
        totalVisits: 0,
        uniquePages: 0,
        mostVisitedPageType: '',
        averageSessionDuration: 0,
        lastVisit: Date.now(),
        firstVisit: Date.now(),
        dailyActivity: [],
        pageTypeDistribution: []
      }
    };

    // Store to Qdrant
    await storeUserProfile(validatedProfile);

    return NextResponse.json({ 
      success: true, 
      message: 'User profile synced successfully',
      walletAddress: validatedAddress,
      stats: validatedProfile.stats
    });

  } catch (error) {
    console.error('Error syncing user profile:', error);
    
    return NextResponse.json({ 
      error: 'Failed to sync user profile',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
