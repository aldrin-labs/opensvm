/**
 * Share Click Tracking API
 * Tracks clicks on shared links
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeShareClick, incrementShareClicks } from '@/lib/qdrant';
import { generateId } from '@/lib/user-history-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { shareCode: string } }
) {
  try {
    const { shareCode } = params;
    const body = await request.json();
    
    if (!shareCode) {
      return NextResponse.json(
        { error: 'Share code is required' },
        { status: 400 }
      );
    }
    
    // Create click entry
    const clickEntry = {
      id: generateId(),
      shareCode,
      clickerAddress: body.clickerAddress || null,
      userAgent: body.userAgent || '',
      referrer: body.referrer || '',
      timestamp: Date.now(),
      converted: false
    };
    
    // Store click
    await storeShareClick(clickEntry);
    
    // Increment share click count
    await incrementShareClicks(shareCode);
    
    return NextResponse.json({
      success: true,
      clickId: clickEntry.id
    });
    
  } catch (error) {
    console.error('Error tracking share click:', error);
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    );
  }
}
