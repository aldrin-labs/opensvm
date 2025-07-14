/**
 * Signature verification endpoint
 * POST /api/auth/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, SessionData } from '@/lib/auth';
import { validateWalletAddress, sanitizeInput } from '@/lib/user-history-utils';
import { setSessionCookie } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionKey, signature, walletAddress, message } = body;
    
    console.log('Auth verify request:', {
      hasSessionKey: !!sessionKey,
      hasSignature: !!signature,
      hasWalletAddress: !!walletAddress,
      hasMessage: !!message,
      nodeEnv: process.env.NODE_ENV,
      bypassTokenGating: process.env.NEXT_PUBLIC_BYPASS_TOKEN_GATING
    });
    
    // Validate inputs
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    
    const sanitizedSessionKey = sanitizeInput(sessionKey);
    const sanitizedSignature = sanitizeInput(signature);
    const sanitizedMessage = sanitizeInput(message);
    
    if (!sanitizedSessionKey || !sanitizedSignature || !sanitizedMessage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Verify signature
    const isValid = verifySignature(sanitizedMessage, sanitizedSignature, validatedAddress);
    
    if (!isValid) {
      console.error('Signature verification failed for wallet:', validatedAddress);
      
      // In development mode, allow authentication to proceed with a warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('Development mode: allowing authentication despite signature verification failure');
      } else {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
    
    // Create session data
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    const sessionData: SessionData = {
      sessionKey: sanitizedSessionKey,
      walletAddress: validatedAddress,
      signature: sanitizedSignature,
      timestamp: Date.now(),
      expiresAt
    };
    
    // Set session cookie
    setSessionCookie(sessionData);
    
    return NextResponse.json({
      success: true,
      walletAddress: validatedAddress,
      expiresAt
    });
  } catch (error) {
    console.error('Error verifying signature:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}