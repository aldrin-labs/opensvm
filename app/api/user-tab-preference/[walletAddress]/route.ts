/**
 * User Tab Preference API Endpoints
 * Handles storing and retrieving user's preferred transaction tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateStats, validateWalletAddress } from '@/lib/user/user-history-utils';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import {
  getUserProfile,
  storeUserProfile,
  checkQdrantHealth
} from '@/lib/search/qdrant';

type TabType = 'overview' | 'instructions' | 'accounts' | 'graph' | 'ai' | 'metrics' | 'related' | 'failure';

// Authentication check using session validation
async function isValidRequest(_request: NextRequest): Promise<boolean> {
  try {
    const session = await getSessionFromCookie();
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
    if (!isHealthy) {
      return NextResponse.json({ 
        preferredTab: 'overview', // Default fallback
        source: 'fallback' 
      });
    }

    try {
      // Get profile from Qdrant
      const profile = await getUserProfile(validatedAddress);
      
      const preferredTab = (profile as any)?.preferredTransactionTab as TabType || 'overview';
      
      return NextResponse.json({ 
        preferredTab,
        source: profile ? 'qdrant' : 'default'
      });
    } catch (error) {
      console.warn('Failed to get user profile from Qdrant:', error);
      return NextResponse.json({ 
        preferredTab: 'overview',
        source: 'fallback' 
      });
    }
  } catch (error) {
    console.error('Error fetching user tab preference:', error);
    return NextResponse.json({ 
      preferredTab: 'overview',
      source: 'error_fallback' 
    }, { status: 200 }); // Return 200 with fallback instead of error
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ walletAddress: string }> }
) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { walletAddress } = await context.params;

    // Authentication check
    if (!(await isValidRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const body = await request.json();
    const { preferredTab } = body;

    // Validate tab preference
    const validTabs: TabType[] = ['overview', 'instructions', 'accounts', 'graph', 'ai', 'metrics', 'related', 'failure'];
    if (!preferredTab || !validTabs.includes(preferredTab)) {
      return NextResponse.json({ error: 'Invalid tab preference' }, { status: 400 });
    }

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

    // Update the preferred tab
    (profile as any).preferredTransactionTab = preferredTab;
    profile.lastActive = Date.now();

    // Store updated profile in Qdrant
    await storeUserProfile(profile);

    return NextResponse.json({ 
      success: true, 
      preferredTab: preferredTab 
    });
  } catch (error) {
    console.error('Error updating user tab preference:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}