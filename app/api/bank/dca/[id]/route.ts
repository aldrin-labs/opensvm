import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';

const DCA_COLLECTION = 'svm_bank_dca_orders';

interface DCAOrder {
  id: string;
  userWallet: string;
  status: 'active' | 'paused' | 'completed' | 'exhausted';
  [key: string]: any;
}

/**
 * GET /api/bank/dca/[id]
 * Get a specific DCA order
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const userWallet = session.walletAddress;

    const result = await qdrantClient.retrieve(DCA_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json({ error: 'DCA order not found' }, { status: 404 });
    }

    const order = result[0].payload as DCAOrder;

    if (order.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({
      order: {
        ...order,
        nextSwapDate: new Date(order.nextSwapAt).toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching DCA order:', error);
    return NextResponse.json({ error: 'Failed to fetch DCA order' }, { status: 500 });
  }
}

/**
 * PATCH /api/bank/dca/[id]
 * Update a DCA order (pause, resume, modify limits)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const userWallet = session.walletAddress;
    const body = await req.json();

    const result = await qdrantClient.retrieve(DCA_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json({ error: 'DCA order not found' }, { status: 404 });
    }

    const order = result[0].payload as DCAOrder;

    if (order.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Can't modify completed orders
    if (order.status === 'completed' || order.status === 'exhausted') {
      return NextResponse.json(
        { error: 'Cannot modify completed orders' },
        { status: 400 }
      );
    }

    // Allowed updates
    const allowedFields = [
      'status',
      'amountPerSwap',
      'slippageBps',
      'totalBudget',
      'maxSwaps',
      'minOutputAmount',
      'maxPriceImpact',
      'label'
    ];

    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate status
    if (updates.status && !['active', 'paused'].includes(updates.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Use: active, paused' },
        { status: 400 }
      );
    }

    // Validate amounts
    if (updates.amountPerSwap !== undefined && updates.amountPerSwap <= 0) {
      return NextResponse.json(
        { error: 'Amount per swap must be positive' },
        { status: 400 }
      );
    }

    // Apply updates
    const updatedOrder = {
      ...order,
      ...updates,
      updatedAt: Date.now()
    };

    await qdrantClient.setPayload(DCA_COLLECTION, {
      payload: updatedOrder,
      points: [id]
    });

    console.log(`Updated DCA order ${id}`);

    return NextResponse.json({
      success: true,
      order: {
        ...updatedOrder,
        nextSwapDate: new Date(updatedOrder.nextSwapAt).toISOString()
      }
    });

  } catch (error) {
    console.error('Error updating DCA order:', error);
    return NextResponse.json({ error: 'Failed to update DCA order' }, { status: 500 });
  }
}

/**
 * DELETE /api/bank/dca/[id]
 * Delete a DCA order
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const userWallet = session.walletAddress;

    const result = await qdrantClient.retrieve(DCA_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json({ error: 'DCA order not found' }, { status: 404 });
    }

    const order = result[0].payload as DCAOrder;

    if (order.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await qdrantClient.delete(DCA_COLLECTION, { points: [id] });

    console.log(`Deleted DCA order ${id}`);

    return NextResponse.json({
      success: true,
      message: 'DCA order deleted'
    });

  } catch (error) {
    console.error('Error deleting DCA order:', error);
    return NextResponse.json({ error: 'Failed to delete DCA order' }, { status: 500 });
  }
}
