/**
 * User Profile API Endpoints
 * Handles user profile operations with Qdrant storage and authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateStats, validateWalletAddress, sanitizeInput } from '@/lib/user-history-utils';
import { getSessionFromCookie } from '@/lib/auth-server';
import { 
  getUserProfile,
  storeUserProfile,
  getUserHistory,
  checkQdrantHealth
} from '@/lib/qdrant';

// Authentication check using session validation
function isValidRequest(_request: NextRequest): boolean {
  try {
    const session = getSessionFromCookie();
    if (!session) return false;
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) return false;
    
    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const { walletAddress } = await context.params;
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Check Qdrant health 
    const isHealthy = await checkQdrantHealth();
    
    let profile;
    
    if (isHealthy) {
      try {
        // Get profile from Qdrant
        profile = await getUserProfile(validatedAddress);
      } catch (error) {
        console.warn('Qdrant query failed, using default profile:', error);
        profile = null;
      }
    }
    
    // If profile doesn't exist or Qdrant is unavailable, create a basic one
    if (!profile) {
      profile = {
        walletAddress: validatedAddress,
        isPublic: true,
        createdAt: Date.now(),
        lastActive: Date.now(),
        stats: calculateStats([]),
        socialStats: {
          visitsByUsers: 0,
          followers: 0,
          following: 0,
          likes: 0,
          profileViews: 0
        },
        history: []
      };
    }

    // Ensure socialStats exists
    if (!profile.socialStats) {
      profile.socialStats = {
        visitsByUsers: 0,
        followers: 0,
        following: 0,
        likes: 0,
        profileViews: 0
      };
    }

    // Try to get user history if Qdrant is available
    if (isHealthy) {
      try {
        const historyResult = await getUserHistory(validatedAddress, { limit: 10000 });
        profile.stats = calculateStats(historyResult.history);
        profile.history = historyResult.history;
      } catch (error) {
        console.warn('Failed to get user history, using empty history:', error);
        profile.history = [];
      }
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    
    // Return a basic profile even if everything fails
    try {
      const { walletAddress } = await context.params;
      const validatedAddress = validateWalletAddress(walletAddress);
      
      if (validatedAddress) {
        const fallbackProfile = {
          walletAddress: validatedAddress,
          isPublic: true,
          createdAt: Date.now(),
          lastActive: Date.now(),
          stats: calculateStats([]),
          socialStats: {
            visitsByUsers: 0,
            followers: 0,
            following: 0,
            likes: 0,
            profileViews: 0
          },
          history: []
        };
        
        return NextResponse.json({ profile: fallbackProfile });
      }
    } catch (paramError) {
      console.error('Error accessing params in fallback:', paramError);
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  _request: NextRequest,
  context: { params: Promise<{ walletAddress: string }> }
) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { walletAddress } = await context.params;
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // Authentication check
    if (!isValidRequest(_request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const body = await _request.json();
    
    // Get existing profile or create new one
    let profile = await getUserProfile(validatedAddress);
    
    if (!profile) {
      profile = {
        walletAddress: validatedAddress,
        isPublic: true,
        createdAt: Date.now(),
        lastActive: Date.now(),
        stats: calculateStats([]),
        socialStats: {
          visitsByUsers: 0,
          followers: 0,
          following: 0,
          likes: 0,
          profileViews: 0
        },
        history: []
      };
    }

    // Ensure socialStats exists
    if (!profile.socialStats) {
      profile.socialStats = {
        visitsByUsers: 0,
        followers: 0,
        following: 0,
        likes: 0,
        profileViews: 0
      };
    }

    // Update profile fields with proper sanitization
    if (body.displayName !== undefined) {
      profile.displayName = sanitizeInput(String(body.displayName)).slice(0, 100); // Limit length
    }
    if (body.avatar !== undefined) {
      profile.avatar = sanitizeInput(String(body.avatar)).slice(0, 500); // Limit length
    }
    if (body.bio !== undefined) {
      profile.bio = sanitizeInput(String(body.bio)).slice(0, 500); // Limit length
    }
    if (body.isPublic !== undefined) {
      profile.isPublic = Boolean(body.isPublic);
    }
    
    profile.lastActive = Date.now();

    // Store updated profile in Qdrant
    await storeUserProfile(profile);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
