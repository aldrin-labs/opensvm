/**
 * API Route: GET /api/launchpad/referral-links/[code]
 * Get referral link information by code
 */

import { NextResponse } from 'next/server';
import { getReferralLinkByCode, getReferrer } from '@/lib/launchpad/database';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    
    const link = await getReferralLinkByCode(code);
    
    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Referral link not found' },
        { status: 404 }
      );
    }
    
    // Check if link is still valid
    if (link.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Referral link is not active' },
        { status: 400 }
      );
    }
    
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Referral link has expired' },
        { status: 400 }
      );
    }
    
    // Get referrer name
    const referrer = await getReferrer(link.kol_id);
    
    return NextResponse.json({
      success: true,
      data: {
        ...link,
        referrer_name: referrer?.display_name,
      },
    });
  } catch (error) {
    console.error('Error fetching referral link:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referral link' },
      { status: 500 }
    );
  }
}
