/**
 * API Route: GET /api/launchpad/admin/referrers
 * List all referrers (admin only)
 */

import { NextResponse } from 'next/server';
import { listReferrers } from '@/lib/launchpad/database';

export async function GET(request: Request) {
  try {
    // TODO: Add admin authentication check here
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    
    const referrers = await listReferrers(status ? { status } : undefined);
    
    return NextResponse.json({
      success: true,
      data: referrers,
      count: referrers.length,
    });
  } catch (error) {
    console.error('Error fetching referrers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch referrers',
      },
      { status: 500 }
    );
  }
}
