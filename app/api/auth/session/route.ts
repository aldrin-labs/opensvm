/**
 * Session creation endpoint
 * POST /api/auth/session
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSessionKey, createSignMessage } from '@/lib/auth';
import { validateWalletAddress } from '@/lib/user-history-utils';
import { getSessionFromCookie } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    
    // Generate session key
    const sessionKey = generateSessionKey();
    
    // Create message to be signed
    const message = createSignMessage(sessionKey, validatedAddress);
    
    return NextResponse.json({
      sessionKey,
      message,
      walletAddress: validatedAddress
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = getSessionFromCookie();
    
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({ authenticated: false });
    }
    
    return NextResponse.json({ 
      authenticated: true,
      walletAddress: session.walletAddress,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}