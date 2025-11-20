/**
 * API endpoint to bind a wallet to an API key via auth link
 * POST /api/auth/bind-wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { bindWallet } from '@/lib/api-auth/service';
import type { WalletBindRequest } from '@/lib/api-auth/types';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: NextRequest) {
  try {
    const body: WalletBindRequest = await request.json();

    // Validate request
    if (!body.token) {
      return NextResponse.json(
        { error: 'Auth token is required' },
        { status: 400 }
      );
    }

    if (!body.walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!body.signature || !body.message) {
      return NextResponse.json(
        { error: 'Wallet signature and message are required' },
        { status: 400 }
      );
    }

    // Bind wallet to API key
    const result = await bindWallet({
      token: body.token,
      walletAddress: body.walletAddress,
      signature: body.signature,
      message: body.message,
    });

    return NextResponse.json({
      success: true,
      apiKeyId: result.apiKeyId,
      walletAddress: result.walletAddress,
      message: 'Wallet successfully bound to API key',
    });
  } catch (error) {
    console.error('Error binding wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bind wallet' },
      { status: 500 }
    );
  }
}
