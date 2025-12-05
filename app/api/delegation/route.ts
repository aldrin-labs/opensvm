import { NextRequest, NextResponse } from 'next/server';

/**
 * Vote Delegation REST API
 *
 * Endpoints:
 * - GET /api/delegation - Get delegation stats and top delegates
 * - POST /api/delegation - Create a new delegation
 * - DELETE /api/delegation - Revoke a delegation
 */

// Mock storage (replace with actual database in production)
const delegations = new Map<string, {
  id: string;
  delegator: string;
  delegate: string;
  percentage: number;
  veAmount: number;
  lockUntil?: number;
  createdAt: number;
  isActive: boolean;
}>();

const veBalances = new Map<string, number>();
let delegationCounter = 0;

// Initialize some test data
veBalances.set('alice', 10000);
veBalances.set('bob', 5000);
veBalances.set('charlie', 2000);

function getVeBalance(address: string): number {
  return veBalances.get(address) || 0;
}

function getDelegationsFrom(delegator: string) {
  return Array.from(delegations.values())
    .filter(d => d.delegator === delegator && d.isActive);
}

function getDelegationsTo(delegate: string) {
  return Array.from(delegations.values())
    .filter(d => d.delegate === delegate && d.isActive);
}

function getEffectiveVotingPower(address: string): number {
  const ownVe = getVeBalance(address);

  const incoming = getDelegationsTo(address);
  let delegatedToThem = 0;
  for (const del of incoming) {
    const delegatorVe = getVeBalance(del.delegator);
    delegatedToThem += (delegatorVe * del.percentage) / 100;
  }

  const outgoing = getDelegationsFrom(address);
  let theyDelegated = 0;
  for (const del of outgoing) {
    theyDelegated += (ownVe * del.percentage) / 100;
  }

  return ownVe + delegatedToThem - theyDelegated;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const action = searchParams.get('action');

    // Get delegations for specific address
    if (address) {
      const from = getDelegationsFrom(address);
      const to = getDelegationsTo(address);
      const effectivePower = getEffectiveVotingPower(address);
      const ownVe = getVeBalance(address);

      return NextResponse.json({
        success: true,
        data: {
          address,
          ownVePower: ownVe,
          effectivePower,
          delegationsFrom: from,
          delegationsTo: to,
          totalDelegatedOut: from.reduce((sum, d) => sum + d.percentage, 0),
          delegatorCount: to.length,
        }
      });
    }

    // Get top delegates
    if (action === 'top-delegates') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const allAddresses = new Set<string>();

      for (const del of delegations.values()) {
        if (del.isActive) {
          allAddresses.add(del.delegate);
          allAddresses.add(del.delegator);
        }
      }

      const profiles = Array.from(allAddresses).map(addr => ({
        address: addr,
        ownVePower: getVeBalance(addr),
        effectivePower: getEffectiveVotingPower(addr),
        delegatorCount: getDelegationsTo(addr).length,
      }));

      const topDelegates = profiles
        .filter(p => getDelegationsTo(p.address).length > 0)
        .sort((a, b) => b.effectivePower - a.effectivePower)
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: { topDelegates }
      });
    }

    // Get global stats
    const activeDelegations = Array.from(delegations.values()).filter(d => d.isActive);
    const uniqueDelegators = new Set(activeDelegations.map(d => d.delegator));
    const uniqueDelegates = new Set(activeDelegations.map(d => d.delegate));

    let totalDelegatedVe = 0;
    for (const del of activeDelegations) {
      const delegatorVe = getVeBalance(del.delegator);
      totalDelegatedVe += (delegatorVe * del.percentage) / 100;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalDelegations: activeDelegations.length,
        totalDelegatedVe,
        uniqueDelegators: uniqueDelegators.size,
        uniqueDelegates: uniqueDelegates.size,
        avgDelegationPercentage: activeDelegations.length > 0
          ? activeDelegations.reduce((sum, d) => sum + d.percentage, 0) / activeDelegations.length
          : 0,
      }
    });

  } catch (error) {
    console.error('[Delegation API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch delegation data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { delegator, delegate, percentage, lockUntil } = body;

    // Validations
    if (!delegator || !delegate) {
      return NextResponse.json(
        { success: false, error: 'Missing delegator or delegate address' },
        { status: 400 }
      );
    }

    if (delegator === delegate) {
      return NextResponse.json(
        { success: false, error: 'Cannot delegate to yourself' },
        { status: 400 }
      );
    }

    if (!percentage || percentage <= 0 || percentage > 100) {
      return NextResponse.json(
        { success: false, error: 'Percentage must be between 1 and 100' },
        { status: 400 }
      );
    }

    const delegatorVe = getVeBalance(delegator);
    if (delegatorVe <= 0) {
      return NextResponse.json(
        { success: false, error: 'Must have veSVMAI to delegate' },
        { status: 400 }
      );
    }

    // Check total delegation doesn't exceed 100%
    const existing = getDelegationsFrom(delegator);
    const totalDelegated = existing
      .filter(d => d.delegate !== delegate)
      .reduce((sum, d) => sum + d.percentage, 0);

    if (totalDelegated + percentage > 100) {
      return NextResponse.json(
        { success: false, error: `Cannot delegate more than 100%. Already delegated: ${totalDelegated}%` },
        { status: 400 }
      );
    }

    // Remove existing delegation to same delegate
    const existingToDelegate = existing.find(d => d.delegate === delegate);
    if (existingToDelegate) {
      existingToDelegate.isActive = false;
    }

    // Create new delegation
    delegationCounter++;
    const veAmount = (delegatorVe * percentage) / 100;
    const delegation = {
      id: `DEL-${delegationCounter}`,
      delegator,
      delegate,
      percentage,
      veAmount,
      lockUntil: lockUntil ? new Date(lockUntil).getTime() : undefined,
      createdAt: Date.now(),
      isActive: true,
    };

    delegations.set(delegation.id, delegation);

    return NextResponse.json({
      success: true,
      data: {
        delegation,
        newEffectivePower: {
          delegator: getEffectiveVotingPower(delegator),
          delegate: getEffectiveVotingPower(delegate),
        }
      }
    });

  } catch (error) {
    console.error('[Delegation API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create delegation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const delegationId = searchParams.get('id');
    const delegator = searchParams.get('delegator');

    if (delegationId) {
      // Revoke specific delegation
      const delegation = delegations.get(delegationId);
      if (!delegation) {
        return NextResponse.json(
          { success: false, error: 'Delegation not found' },
          { status: 404 }
        );
      }

      if (delegation.lockUntil && Date.now() < delegation.lockUntil) {
        return NextResponse.json(
          { success: false, error: `Delegation locked until ${new Date(delegation.lockUntil).toISOString()}` },
          { status: 400 }
        );
      }

      delegation.isActive = false;

      return NextResponse.json({
        success: true,
        data: { revoked: delegation }
      });
    }

    if (delegator) {
      // Revoke all delegations from delegator
      const userDelegations = getDelegationsFrom(delegator);
      let revokedCount = 0;

      for (const del of userDelegations) {
        if (!del.lockUntil || Date.now() >= del.lockUntil) {
          del.isActive = false;
          revokedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        data: { revokedCount }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Must provide delegation id or delegator address' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Delegation API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke delegation' },
      { status: 500 }
    );
  }
}
