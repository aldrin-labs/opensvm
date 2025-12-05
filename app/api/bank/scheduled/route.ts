import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { v4 as uuidv4 } from 'uuid';

const WALLETS_COLLECTION = 'svm_bank_wallets';
const SCHEDULED_COLLECTION = 'svm_bank_scheduled_transfers';

// Ensure collection exists
async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === SCHEDULED_COLLECTION);

    if (!exists) {
      await qdrantClient.createCollection(SCHEDULED_COLLECTION, {
        vectors: {
          size: 4,
          distance: 'Cosine'
        }
      });
      console.log('Created scheduled transfers collection');
    }
  } catch (error) {
    console.error('Error ensuring collection:', error);
  }
}

interface ScheduledTransfer {
  id: string;
  userWallet: string;
  fromWalletId: string;
  fromWalletAddress: string;
  fromWalletName: string;
  toAddress: string;
  toWalletId?: string;
  toWalletName?: string;
  amount: number;
  tokenMint?: string;
  tokenSymbol?: string;
  // Scheduling
  scheduleType: 'once' | 'recurring';
  executeAt: number; // Unix timestamp for 'once'
  // For recurring
  frequency?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  hour: number; // 0-23
  minute: number; // 0-59
  timezone: string;
  // State
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastExecuted?: number;
  nextExecution: number;
  executionCount: number;
  maxExecutions?: number; // For recurring with limit
  // Metadata
  createdAt: number;
  updatedAt: number;
  label?: string;
  memo?: string;
}

interface CreateScheduledRequest {
  fromWalletId: string;
  toAddress: string;
  isInternalTransfer?: boolean;
  amount: number;
  tokenMint?: string;
  tokenSymbol?: string;
  scheduleType: 'once' | 'recurring';
  executeAt?: number; // For 'once'
  frequency?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  timezone?: string;
  maxExecutions?: number;
  label?: string;
  memo?: string;
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  name: string;
  requiresHardwareSignature?: boolean;
}

/**
 * Calculate next execution time based on schedule
 */
function calculateNextExecution(
  scheduleType: 'once' | 'recurring',
  executeAt: number | undefined,
  frequency: string | undefined,
  dayOfWeek: number | undefined,
  dayOfMonth: number | undefined,
  hour: number,
  minute: number,
  timezone: string,
  fromDate?: Date
): number {
  const now = fromDate || new Date();

  if (scheduleType === 'once' && executeAt) {
    return executeAt;
  }

  // For recurring, calculate next occurrence
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  if (frequency === 'daily') {
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
  } else if (frequency === 'weekly' && dayOfWeek !== undefined) {
    const currentDay = target.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && target <= now)) {
      daysUntil += 7;
    }
    target.setDate(target.getDate() + daysUntil);
  } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
    target.setDate(dayOfMonth);
    if (target <= now) {
      target.setMonth(target.getMonth() + 1);
    }
    // Handle months with fewer days
    while (target.getDate() !== dayOfMonth) {
      target.setDate(target.getDate() - 1);
    }
  }

  return target.getTime();
}

/**
 * GET /api/bank/scheduled
 * List all scheduled transfers for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await ensureCollection();
    const userWallet = session.walletAddress;

    const results = await qdrantClient.scroll(SCHEDULED_COLLECTION, {
      filter: {
        must: [
          { key: 'userWallet', match: { value: userWallet } }
        ]
      },
      limit: 100,
      with_payload: true
    });

    const transfers = results.points.map((point: any) => ({
      ...point.payload,
      id: point.id
    }));

    // Sort by next execution
    transfers.sort((a: ScheduledTransfer, b: ScheduledTransfer) => a.nextExecution - b.nextExecution);

    // Separate active and completed
    const active = transfers.filter((t: ScheduledTransfer) => t.status === 'active' || t.status === 'paused');
    const completed = transfers.filter((t: ScheduledTransfer) => t.status === 'completed' || t.status === 'failed');

    return NextResponse.json({
      transfers: active,
      completedTransfers: completed,
      total: transfers.length,
      activeCount: active.length
    });

  } catch (error) {
    console.error('Error fetching scheduled transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled transfers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bank/scheduled
 * Create a new scheduled transfer
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await ensureCollection();
    const userWallet = session.walletAddress;
    const body: CreateScheduledRequest = await req.json();

    // Validate required fields
    const {
      fromWalletId,
      toAddress,
      isInternalTransfer,
      amount,
      tokenMint,
      tokenSymbol,
      scheduleType,
      executeAt,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      timezone = 'UTC',
      maxExecutions,
      label,
      memo
    } = body;

    if (!fromWalletId || !toAddress || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (scheduleType === 'once' && !executeAt) {
      return NextResponse.json(
        { error: 'executeAt required for one-time transfers' },
        { status: 400 }
      );
    }

    if (scheduleType === 'recurring' && !frequency) {
      return NextResponse.json(
        { error: 'frequency required for recurring transfers' },
        { status: 400 }
      );
    }

    // Verify source wallet
    const sourceResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
      ids: [fromWalletId],
      with_payload: true
    });

    if (sourceResult.length === 0) {
      return NextResponse.json(
        { error: 'Source wallet not found' },
        { status: 404 }
      );
    }

    const sourceWallet = sourceResult[0].payload as WalletPayload;

    if (sourceWallet.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized to schedule from this wallet' },
        { status: 403 }
      );
    }

    if (sourceWallet.requiresHardwareSignature) {
      return NextResponse.json(
        { error: 'Cannot schedule transfers from hardware-protected wallets' },
        { status: 400 }
      );
    }

    // Resolve destination
    let toWalletId: string | undefined;
    let toWalletName: string | undefined;
    let destAddress = toAddress;

    if (isInternalTransfer) {
      const destResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
        ids: [toAddress],
        with_payload: true
      });

      if (destResult.length === 0) {
        return NextResponse.json(
          { error: 'Destination wallet not found' },
          { status: 404 }
        );
      }

      const destWallet = destResult[0].payload as WalletPayload;

      if (destWallet.userWallet !== userWallet) {
        return NextResponse.json(
          { error: 'Not authorized to send to this wallet' },
          { status: 403 }
        );
      }

      toWalletId = destWallet.id;
      toWalletName = destWallet.name;
      destAddress = destWallet.address;
    }

    // Calculate next execution
    const nextExecution = calculateNextExecution(
      scheduleType,
      executeAt,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      timezone
    );

    // Create scheduled transfer
    const id = uuidv4();
    const now = Date.now();

    const scheduledTransfer: ScheduledTransfer = {
      id,
      userWallet,
      fromWalletId,
      fromWalletAddress: sourceWallet.address,
      fromWalletName: sourceWallet.name,
      toAddress: destAddress,
      toWalletId,
      toWalletName,
      amount,
      tokenMint,
      tokenSymbol,
      scheduleType,
      executeAt,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      timezone,
      status: 'active',
      nextExecution,
      executionCount: 0,
      maxExecutions,
      createdAt: now,
      updatedAt: now,
      label,
      memo
    };

    // Store in Qdrant
    await qdrantClient.upsert(SCHEDULED_COLLECTION, {
      points: [
        {
          id,
          vector: [0.1, 0.1, 0.1, 0.1], // Dummy vector
          payload: scheduledTransfer
        }
      ]
    });

    console.log(`Created scheduled transfer ${id} for user ${userWallet}`);

    return NextResponse.json({
      success: true,
      scheduledTransfer: {
        id,
        ...scheduledTransfer,
        nextExecutionDate: new Date(nextExecution).toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating scheduled transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled transfer', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
