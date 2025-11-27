/**
 * Annotations by Address API
 *
 * GET /api/annotations/address/[address] - Get all annotations for an address
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnnotationsByAddress } from '@/lib/annotations/database';

interface RouteParams {
  params: Promise<{ address: string }>;
}

// Validate Solana address format
function isValidSolanaAddress(address: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * GET /api/annotations/address/[address]
 * Get all annotations for a specific Solana address
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { address } = await params;

    // Validate address format to prevent XSS and invalid queries
    if (!isValidSolanaAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        { status: 400 }
      );
    }

    const annotations = await getAnnotationsByAddress(address);

    return NextResponse.json({
      address, // Safe to return after validation
      count: annotations.length,
      annotations,
    });
  } catch (error) {
    console.error('Error getting annotations by address:', error);
    return NextResponse.json(
      { error: 'Failed to get annotations' },
      { status: 500 }
    );
  }
}
