import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';

const SCHEDULED_COLLECTION = 'svm_bank_scheduled_transfers';

interface ScheduledTransfer {
  id: string;
  userWallet: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  [key: string]: any;
}

/**
 * GET /api/bank/scheduled/[id]
 * Get a specific scheduled transfer
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userWallet = session.walletAddress;

    const result = await qdrantClient.retrieve(SCHEDULED_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Scheduled transfer not found' },
        { status: 404 }
      );
    }

    const transfer = result[0].payload as ScheduledTransfer;

    if (transfer.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      scheduledTransfer: {
        ...transfer,
        nextExecutionDate: new Date(transfer.nextExecution).toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching scheduled transfer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled transfer' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bank/scheduled/[id]
 * Update a scheduled transfer (pause, resume, modify)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userWallet = session.walletAddress;
    const body = await req.json();

    const result = await qdrantClient.retrieve(SCHEDULED_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Scheduled transfer not found' },
        { status: 404 }
      );
    }

    const transfer = result[0].payload as ScheduledTransfer;

    if (transfer.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Can't modify completed/failed transfers
    if (transfer.status === 'completed' || transfer.status === 'failed') {
      return NextResponse.json(
        { error: 'Cannot modify completed or failed transfers' },
        { status: 400 }
      );
    }

    // Allowed updates
    const allowedFields = ['status', 'amount', 'label', 'memo', 'maxExecutions'];
    const updates: Partial<ScheduledTransfer> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate status transition
    if (updates.status) {
      const validStatuses = ['active', 'paused'];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json(
          { error: 'Invalid status. Use: active, paused' },
          { status: 400 }
        );
      }
    }

    // Validate amount
    if (updates.amount !== undefined && updates.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    // Apply updates
    const updatedTransfer = {
      ...transfer,
      ...updates,
      updatedAt: Date.now()
    };

    await qdrantClient.setPayload(SCHEDULED_COLLECTION, {
      payload: updatedTransfer,
      points: [id]
    });

    console.log(`Updated scheduled transfer ${id}`);

    return NextResponse.json({
      success: true,
      scheduledTransfer: {
        ...updatedTransfer,
        nextExecutionDate: new Date(updatedTransfer.nextExecution).toISOString()
      }
    });

  } catch (error) {
    console.error('Error updating scheduled transfer:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled transfer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bank/scheduled/[id]
 * Delete a scheduled transfer
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userWallet = session.walletAddress;

    const result = await qdrantClient.retrieve(SCHEDULED_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Scheduled transfer not found' },
        { status: 404 }
      );
    }

    const transfer = result[0].payload as ScheduledTransfer;

    if (transfer.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    await qdrantClient.delete(SCHEDULED_COLLECTION, {
      points: [id]
    });

    console.log(`Deleted scheduled transfer ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Scheduled transfer deleted'
    });

  } catch (error) {
    console.error('Error deleting scheduled transfer:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled transfer' },
      { status: 500 }
    );
  }
}
