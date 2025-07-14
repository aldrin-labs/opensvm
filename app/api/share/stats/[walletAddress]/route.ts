/**
 * Share Statistics API
 * Returns share statistics for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSharesByReferrer } from '@/lib/qdrant';
import { validateWalletAddress } from '@/lib/user-history-utils';
import { EntityType } from '@/types/share';

export async function GET(
  _request: NextRequest,
  { params }: { params: { walletAddress: string } }
) {
  try {
    const { walletAddress } = params;
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }
    
    // Get shares for this user
    const { shares, total } = await getSharesByReferrer(validatedAddress);
    
    // Calculate statistics
    const totalClicks = shares.reduce((sum, share) => sum + share.clicks, 0);
    const totalConversions = shares.reduce((sum, share) => sum + share.conversions, 0);
    
    const sharesByType = shares.reduce((acc, share) => {
      acc[share.entityType] = (acc[share.entityType] || 0) + 1;
      return acc;
    }, {} as Record<EntityType, number>);
    
    const stats = {
      totalShares: total,
      totalClicks,
      totalConversions,
      conversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
      sharesByType,
      topShares: shares
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10),
      recentShares: shares
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
    };
    
    return NextResponse.json(stats);
    
  } catch (error) {
    console.error('Error fetching share stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share statistics' },
      { status: 500 }
    );
  }
}
