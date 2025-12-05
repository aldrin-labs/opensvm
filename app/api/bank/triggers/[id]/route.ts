import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';

const TRIGGERS_COLLECTION = 'svm_bank_triggers';

interface Trigger {
  id: string;
  userWallet: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  [key: string]: any;
}

/**
 * GET /api/bank/triggers/[id]
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

    const result = await qdrantClient.retrieve(TRIGGERS_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const trigger = result[0].payload as Trigger;

    if (trigger.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ trigger });

  } catch (error) {
    console.error('Error fetching trigger:', error);
    return NextResponse.json({ error: 'Failed to fetch trigger' }, { status: 500 });
  }
}

/**
 * PATCH /api/bank/triggers/[id]
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

    const result = await qdrantClient.retrieve(TRIGGERS_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const trigger = result[0].payload as Trigger;

    if (trigger.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Can't modify completed triggers
    if (trigger.status === 'completed' || trigger.status === 'failed') {
      return NextResponse.json(
        { error: 'Cannot modify completed or failed triggers' },
        { status: 400 }
      );
    }

    // Allowed updates
    const allowedFields = ['status', 'name', 'description', 'cooldownMinutes', 'maxExecutions'];
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

    const updatedTrigger = {
      ...trigger,
      ...updates,
      updatedAt: Date.now()
    };

    await qdrantClient.setPayload(TRIGGERS_COLLECTION, {
      payload: updatedTrigger,
      points: [id]
    });

    return NextResponse.json({ success: true, trigger: updatedTrigger });

  } catch (error) {
    console.error('Error updating trigger:', error);
    return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 });
  }
}

/**
 * DELETE /api/bank/triggers/[id]
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

    const result = await qdrantClient.retrieve(TRIGGERS_COLLECTION, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const trigger = result[0].payload as Trigger;

    if (trigger.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await qdrantClient.delete(TRIGGERS_COLLECTION, { points: [id] });

    return NextResponse.json({ success: true, message: 'Trigger deleted' });

  } catch (error) {
    console.error('Error deleting trigger:', error);
    return NextResponse.json({ error: 'Failed to delete trigger' }, { status: 500 });
  }
}
