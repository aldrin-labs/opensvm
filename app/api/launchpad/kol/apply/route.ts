/**
 * API Route: POST /api/launchpad/kol/apply
 * Apply to become a KOL
 */

import { NextResponse } from 'next/server';
import { createReferrer } from '@/lib/launchpad/database';
import { generateId } from '@/lib/launchpad/utils';
import type { KOLApplicationRequest } from '@/types/launchpad';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: Request) {
  try {
    const body: KOLApplicationRequest = await request.json();
    
    // Validate required fields
    if (!body.display_name || !body.payout_wallet || !body.email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create referrer application
    const referrer = await createReferrer({
      id: generateId(),
      display_name: body.display_name,
      status: 'pending',
      payout_wallet: body.payout_wallet,
      kyc_verified: false,
      email: body.email,
      socials: body.socials,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      data: referrer,
      message: 'Application submitted successfully. You will be notified once reviewed.',
    });
  } catch (error) {
    console.error('Error creating KOL application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}
