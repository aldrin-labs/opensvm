/**
 * Share Conversion Tracking API
 * Tracks when users convert via referral links
 */

import { NextRequest, NextResponse } from 'next/server';
import { markShareConversion } from '@/lib/qdrant';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareCode, converterAddress } = body;
    
    if (!shareCode) {
      return NextResponse.json(
        { error: 'Share code is required' },
        { status: 400 }
      );
    }
    
    if (!converterAddress) {
      return NextResponse.json(
        { error: 'Converter address is required' },
        { status: 400 }
      );
    }
    
    // Mark conversion in database
    await markShareConversion(shareCode, converterAddress);
    
    return NextResponse.json({
      success: true,
      message: 'Conversion tracked successfully'
    });
    
  } catch (error) {
    console.error('Error tracking conversion:', error);
    return NextResponse.json(
      { error: 'Failed to track conversion' },
      { status: 500 }
    );
  }
}
