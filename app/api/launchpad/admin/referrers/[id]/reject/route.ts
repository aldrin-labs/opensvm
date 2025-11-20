/**
 * API Route: POST /api/launchpad/admin/referrers/[id]/reject
 * Reject a referrer/KOL application
 */

import { NextResponse } from 'next/server';
import { updateReferrer, createAuditLog } from '@/lib/launchpad/database';
import { generateId } from '@/lib/launchpad/utils';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check here
    const adminId = 'admin'; // Get from auth context
    
    const referrer = await updateReferrer(params.id, {
      status: 'rejected',
    });

    if (!referrer) {
      return NextResponse.json(
        { success: false, error: 'Referrer not found' },
        { status: 404 }
      );
    }

    // Create audit log
    await createAuditLog({
      id: generateId(),
      action: 'reject_referrer',
      entity_type: 'referrer',
      entity_id: params.id,
      user_id: adminId,
      user_role: 'admin',
      changes: { status: 'rejected' },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: referrer,
    });
  } catch (error) {
    console.error('Error rejecting referrer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject referrer' },
      { status: 500 }
    );
  }
}
