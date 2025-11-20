/**
 * API Route: POST /api/launchpad/admin/referrers/[id]/approve
 * Approve a referrer/KOL application
 */

import { NextResponse } from 'next/server';
import { updateReferrer, createAuditLog } from '@/lib/launchpad/database';
import { generateId } from '@/lib/launchpad/utils';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check here
    const adminId = 'admin'; // Get from auth context
    
    const referrer = await updateReferrer(params.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
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
      action: 'approve_referrer',
      entity_type: 'referrer',
      entity_id: params.id,
      user_id: adminId,
      user_role: 'admin',
      changes: { status: 'approved' },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: referrer,
    });
  } catch (error) {
    console.error('Error approving referrer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve referrer' },
      { status: 500 }
    );
  }
}
