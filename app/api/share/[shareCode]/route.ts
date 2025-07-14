/**
 * Share Data API
 * Returns share information for a given share code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getShareByCode, incrementShareClicks } from '@/lib/qdrant';

export async function GET(
  _request: NextRequest,
  { params }: { params: { shareCode: string } }
) {
  try {
    const { shareCode } = params;
    
    if (!shareCode) {
      return NextResponse.json(
        { error: 'Share code is required' },
        { status: 400 }
      );
    }
    
    // Get share data from database
    const share = await getShareByCode(shareCode);
    
    if (!share) {
      return NextResponse.json(
        { error: 'Share not found or expired' },
        { status: 404 }
      );
    }
    
    // Increment click count
    await incrementShareClicks(shareCode);
    
    return NextResponse.json(share);
    
  } catch (error) {
    console.error('Error fetching share:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share data' },
      { status: 500 }
    );
  }
}
