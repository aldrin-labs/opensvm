/**
 * User Social Like API Endpoints
 * Handles like/unlike operations with Qdrant storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserLikeEntry } from '@/types/user-history';
import { validateWalletAddress, generateId } from '@/lib/user-history-utils';
import { getSessionFromCookie } from '@/lib/auth-server';
import { 
  storeUserLike,
  removeUserLike,
  getUserLikes,
  checkQdrantHealth
} from '@/lib/qdrant';

// Authentication check using session validation
function isValidRequest(_request: NextRequest): { isValid: boolean; walletAddress?: string } {
  try {
    const session = getSessionFromCookie();
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
    const auth = isValidRequest(_request);
    if (!auth.isValid || !auth.walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetAddress = params.targetAddress;
    
    // Validate both addresses
    const validatedTarget = validateWalletAddress(targetAddress);
    const validatedLiker = validateWalletAddress(auth.walletAddress);
    
    if (!validatedTarget || !validatedLiker) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Prevent self-liking
    if (validatedLiker === validatedTarget) {
      return NextResponse.json({ error: 'Cannot like yourself' }, { status: 400 });
    }

    // Create like entry
    const likeEntry: UserLikeEntry = {
      id: generateId(),
      likerAddress: validatedLiker,
      targetAddress: validatedTarget,
      timestamp: Date.now()
    };

    // Store in Qdrant
    await storeUserLike(likeEntry);

    return NextResponse.json({ success: true, like: likeEntry });
  } catch (error) {
    console.error('Error creating like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const auth = isValidRequest(_request);
    if (!auth.isValid || !auth.walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetAddress = params.targetAddress;
    
    // Validate both addresses
    const validatedTarget = validateWalletAddress(targetAddress);
    const validatedLiker = validateWalletAddress(auth.walletAddress);
    
    if (!validatedTarget || !validatedLiker) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // Remove like
    await removeUserLike(validatedLiker, validatedTarget);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing like:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { targetAddress: string } }
) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const targetAddress = params.targetAddress;
    
    // Validate address
    const validatedTarget = validateWalletAddress(targetAddress);
    if (!validatedTarget) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const likes = await getUserLikes(validatedTarget);

    return NextResponse.json({ likes });
  } catch (error) {
    console.error('Error fetching likes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
