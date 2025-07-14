import { NextRequest, NextResponse } from 'next/server';
import { checkSVMAIAccess } from '@/lib/token-gating';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required. Usage: /api/test-token-balance?wallet=YOUR_WALLET_ADDRESS' },
      { status: 400 }
    );
  }

  try {
    console.log(`[Test] Testing token balance detection for: ${walletAddress}`);
    
    const result = await checkSVMAIAccess(walletAddress);
    
    return NextResponse.json({
      success: true,
      walletAddress,
      mintAddress: 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Test] Error testing token balance:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check token balance',
        details: error instanceof Error ? error.message : 'Unknown error',
        walletAddress,
        mintAddress: 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump'
      },
      { status: 500 }
    );
  }
}
