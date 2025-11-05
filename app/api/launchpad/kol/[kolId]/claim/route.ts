import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/launchpad/database';

// POST /api/launchpad/kol/:kolId/claim - Claim tokens
export async function POST(
  request: NextRequest,
  { params }: { params: { kolId: string } }
) {
  try {
    const { kolId } = params;
    const body = await request.json();
    const { wallet_address, amount } = body;

    if (!wallet_address || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet_address, amount' },
        { status: 400 }
      );
    }

    // Find referrer
    const referrer = db.referrers.find((r) => r.id === kolId);
    if (!referrer) {
      return NextResponse.json(
        { error: 'KOL not found' },
        { status: 404 }
      );
    }

    if (referrer.status !== 'approved') {
      return NextResponse.json(
        { error: 'KOL not approved' },
        { status: 403 }
      );
    }

    // Get all allocations for this KOL
    const allocations = db.kolAllocations.filter((a) => a.kol_id === kolId);

    // Calculate total claimable
    const totalClaimable = allocations.reduce(
      (sum, a) => sum + (a.claimable_tokens || 0),
      0
    );

    if (amount > totalClaimable) {
      return NextResponse.json(
        { error: `Insufficient claimable tokens. Available: ${totalClaimable}` },
        { status: 400 }
      );
    }

    // Distribute claim across allocations (FIFO)
    let remaining = amount;
    const claims = [];

    for (const allocation of allocations) {
      if (remaining <= 0) break;
      if ((allocation.claimable_tokens || 0) <= 0) continue;

      const claimFromThis = Math.min(remaining, allocation.claimable_tokens || 0);

      allocation.claimable_tokens = (allocation.claimable_tokens || 0) - claimFromThis;
      allocation.distributed_tokens = (allocation.distributed_tokens || 0) + claimFromThis;
      allocation.updated_at = new Date().toISOString();

      claims.push({
        sale_id: allocation.sale_id,
        amount: claimFromThis,
      });

      remaining -= claimFromThis;
    }

    // Create audit log
    db.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: 'claim_tokens',
      entity_type: 'kol_allocation',
      entity_id: kolId,
      performed_by: kolId,
      changes: {
        claimed_amount: amount,
        wallet_address,
        claims,
      },
      timestamp: new Date().toISOString(),
    });

    db.persist();

    return NextResponse.json({
      success: true,
      claimed_amount: amount,
      wallet_address,
      remaining_claimable: totalClaimable - amount,
      claims,
    });
  } catch (error) {
    console.error('Error claiming tokens:', error);
    return NextResponse.json(
      { error: 'Failed to claim tokens' },
      { status: 500 }
    );
  }
}
