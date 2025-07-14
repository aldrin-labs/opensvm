/**
 * User Social Follow API Endpoints
 * Handles follow/unfollow operations with Qdrant storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserFollowEntry } from '@/types/user-history';
import { validateWalletAddress, generateId } from '@/lib/user-history-utils';
import { getSessionFromCookie } from '@/lib/auth-server';
import { 
  storeUserFollow,
  removeUserFollow,
  getUserFollowers,
  getUserFollowing,
  checkQdrantHealth
} from '@/lib/qdrant';

// Authentication check using session validation
async function isValidRequest(_request: NextRequest): Promise<{ isValid: boolean; walletAddress?: string }> {
  try {
    const session = await getSessionFromCookie();
    if (!session) return { isValid: false };
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) return { isValid: false };
    
    return { isValid: true, walletAddress: session.walletAddress };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isValid: false };
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { targetAddress: string } }
) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // Authentication check
    const auth = await isValidRequest(_request);
    if (!auth.isValid || !auth.walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetAddress = params.targetAddress;
    
    // Validate both addresses
    const validatedTarget = validateWalletAddress(targetAddress);
    const validatedFollower = validateWalletAddress(auth.walletAddress);
    
    if (!validatedTarget || !validatedFollower) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Prevent self-following
    if (validatedFollower === validatedTarget) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Create follow entry
    const followEntry: UserFollowEntry = {
      id: generateId(),
      followerAddress: validatedFollower,
      targetAddress: validatedTarget, // Changed from followingAddress to targetAddress
      timestamp: Date.now()
    };

    // Store in Qdrant
    await storeUserFollow(followEntry);

    return NextResponse.json({ success: true, follow: followEntry });
  } catch (error) {
    console.error('Error creating follow relationship:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { targetAddress: string } }
) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // Authentication check
    const auth = await isValidRequest(request);
    if (!auth.isValid || !auth.walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetAddress = params.targetAddress;
    
    // Validate both addresses
    const validatedTarget = validateWalletAddress(targetAddress);
    const validatedFollower = validateWalletAddress(auth.walletAddress);
    
    if (!validatedTarget || !validatedFollower) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Remove follow relationship
    await removeUserFollow(validatedFollower, validatedTarget);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing follow relationship:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ targetAddress: string }> }
) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { targetAddress } = await context.params;
    
    // Validate address
    const validatedTarget = validateWalletAddress(targetAddress);
    if (!validatedTarget) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'followers';

    let result;
    if (type === 'followers') {
      result = await getUserFollowers(validatedTarget);
    } else if (type === 'following') {
      result = await getUserFollowing(validatedTarget);
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    return NextResponse.json({ [type]: result });
  } catch (error) {
    console.error('Error fetching follow data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
