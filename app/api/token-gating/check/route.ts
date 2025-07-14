import { NextRequest, NextResponse } from 'next/server';
import { checkSVMAIAccess } from '@/lib/token-gating';
import { getSessionFromCookie } from '@/lib/auth-server';

export async function GET(_request: NextRequest) {
  console.log(`[Token Gating] Checking access...`);

  // Get the authenticated session
  const session = getSessionFromCookie();
  
  if (!session || Date.now() > session.expiresAt) {
    console.log(`[Token Gating] No authenticated session found`);
    return NextResponse.json(
      { 
        error: 'Not authenticated',
        data: {
          hasAccess: false,
          balance: 0,
          error: 'Authentication required to check token balance'
        }
      },
      { status: 401 }
    );
  }

  const walletAddress = session.walletAddress;
  console.log(`[Token Gating] Checking access for authenticated wallet: ${walletAddress}`);

  try {
    const result = await checkSVMAIAccess(walletAddress);
    
    console.log(`[Token Gating] Result for ${walletAddress}:`, result);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking token gating access:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check token gating access',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
