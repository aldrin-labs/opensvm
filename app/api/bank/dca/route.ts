import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { v4 as uuidv4 } from 'uuid';
import {
  getTokenInfo,
  getTokenPrice,
  estimateSwapOutput,
  COMMON_TOKENS
} from '@/lib/bank/jupiter-swap';

const WALLETS_COLLECTION = 'svm_bank_wallets';
const DCA_COLLECTION = 'svm_bank_dca_orders';

// Ensure collection exists
async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === DCA_COLLECTION);

    if (!exists) {
      await qdrantClient.createCollection(DCA_COLLECTION, {
        vectors: { size: 4, distance: 'Cosine' }
      });
      console.log('Created DCA orders collection');
    }
  } catch (error) {
    console.error('Error ensuring collection:', error);
  }
}

export interface DCAOrder {
  id: string;
  userWallet: string;
  walletId: string;
  walletAddress: string;
  walletName: string;
  // Swap params
  inputMint: string;
  inputSymbol: string;
  outputMint: string;
  outputSymbol: string;
  amountPerSwap: number; // In input token (e.g., 10 USDC)
  slippageBps: number;
  // Schedule
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  // Limits
  totalBudget?: number; // Total amount to spend
  maxSwaps?: number; // Max number of swaps
  minOutputAmount?: number; // Min output per swap (slippage protection)
  maxPriceImpact?: number; // Max price impact percentage
  // State
  status: 'active' | 'paused' | 'completed' | 'exhausted';
  totalSwapped: number;
  totalReceived: number;
  swapCount: number;
  lastSwapAt?: number;
  lastSwapSignature?: string;
  nextSwapAt: number;
  averagePrice: number;
  // Metadata
  createdAt: number;
  updatedAt: number;
  label?: string;
}

interface CreateDCARequest {
  walletId: string;
  inputMint: string;
  outputMint: string;
  amountPerSwap: number;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
  totalBudget?: number;
  maxSwaps?: number;
  slippageBps?: number;
  minOutputAmount?: number;
  maxPriceImpact?: number;
  label?: string;
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  name: string;
  requiresHardwareSignature?: boolean;
}

function calculateNextSwap(
  frequency: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  hour: number = 0,
  minute: number = 0
): number {
  const now = new Date();
  const target = new Date(now);
  target.setMinutes(minute, 0, 0);

  if (frequency === 'hourly') {
    if (target <= now) {
      target.setHours(target.getHours() + 1);
    }
  } else {
    target.setHours(hour);

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
    }
  }

  return target.getTime();
}

/**
 * GET /api/bank/dca
 * List all DCA orders for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await ensureCollection();
    const userWallet = session.walletAddress;

    const results = await qdrantClient.scroll(DCA_COLLECTION, {
      filter: {
        must: [{ key: 'userWallet', match: { value: userWallet } }]
      },
      limit: 100,
      with_payload: true
    });

    const orders = results.points.map((point: any) => ({
      ...point.payload,
      id: point.id
    })) as DCAOrder[];

    // Separate active and completed
    const active = orders.filter(o => o.status === 'active' || o.status === 'paused');
    const completed = orders.filter(o => o.status === 'completed' || o.status === 'exhausted');

    // Sort by next swap
    active.sort((a, b) => a.nextSwapAt - b.nextSwapAt);

    // Calculate aggregate stats
    const stats = {
      totalOrders: orders.length,
      activeOrders: active.length,
      totalSwapped: orders.reduce((sum, o) => sum + o.totalSwapped, 0),
      totalReceived: orders.reduce((sum, o) => sum + o.totalReceived, 0),
      totalSwaps: orders.reduce((sum, o) => sum + o.swapCount, 0)
    };

    return NextResponse.json({
      orders: active,
      completedOrders: completed,
      stats
    });

  } catch (error) {
    console.error('Error fetching DCA orders:', error);
    return NextResponse.json({ error: 'Failed to fetch DCA orders' }, { status: 500 });
  }
}

/**
 * POST /api/bank/dca
 * Create a new DCA order
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await ensureCollection();
    const userWallet = session.walletAddress;
    const body: CreateDCARequest = await req.json();

    const {
      walletId,
      inputMint,
      outputMint,
      amountPerSwap,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour = 9,
      minute = 0,
      totalBudget,
      maxSwaps,
      slippageBps = 100, // 1% default
      minOutputAmount,
      maxPriceImpact = 3, // 3% default
      label
    } = body;

    // Validate required fields
    if (!walletId || !inputMint || !outputMint || !amountPerSwap || !frequency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amountPerSwap <= 0) {
      return NextResponse.json(
        { error: 'Amount per swap must be positive' },
        { status: 400 }
      );
    }

    if (inputMint === outputMint) {
      return NextResponse.json(
        { error: 'Input and output tokens must be different' },
        { status: 400 }
      );
    }

    // Verify wallet ownership
    const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
      ids: [walletId],
      with_payload: true
    });

    if (walletResult.length === 0) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const wallet = walletResult[0].payload as WalletPayload;

    if (wallet.userWallet !== userWallet) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (wallet.requiresHardwareSignature) {
      return NextResponse.json(
        { error: 'Cannot create DCA for hardware-protected wallets' },
        { status: 400 }
      );
    }

    // Get token info
    const [inputToken, outputToken] = await Promise.all([
      getTokenInfo(inputMint),
      getTokenInfo(outputMint)
    ]);

    if (!inputToken || !outputToken) {
      return NextResponse.json(
        { error: 'Invalid token mint address' },
        { status: 400 }
      );
    }

    // Validate swap is possible (get quote)
    const estimate = await estimateSwapOutput(
      inputMint,
      outputMint,
      amountPerSwap,
      inputToken.decimals
    );

    if (!estimate) {
      return NextResponse.json(
        { error: 'Unable to find swap route for this pair' },
        { status: 400 }
      );
    }

    if (estimate.priceImpact > maxPriceImpact) {
      return NextResponse.json(
        {
          error: `Price impact too high: ${estimate.priceImpact.toFixed(2)}% (max: ${maxPriceImpact}%)`,
          priceImpact: estimate.priceImpact
        },
        { status: 400 }
      );
    }

    // Calculate next swap time
    const nextSwapAt = calculateNextSwap(frequency, dayOfWeek, dayOfMonth, hour, minute);

    // Create DCA order
    const id = uuidv4();
    const now = Date.now();

    const dcaOrder: DCAOrder = {
      id,
      userWallet,
      walletId,
      walletAddress: wallet.address,
      walletName: wallet.name,
      inputMint,
      inputSymbol: inputToken.symbol,
      outputMint,
      outputSymbol: outputToken.symbol,
      amountPerSwap,
      slippageBps,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      totalBudget,
      maxSwaps,
      minOutputAmount,
      maxPriceImpact,
      status: 'active',
      totalSwapped: 0,
      totalReceived: 0,
      swapCount: 0,
      nextSwapAt,
      averagePrice: 0,
      createdAt: now,
      updatedAt: now,
      label
    };

    // Store in Qdrant
    await qdrantClient.upsert(DCA_COLLECTION, {
      points: [
        {
          id,
          vector: [0.1, 0.1, 0.1, 0.1],
          payload: dcaOrder
        }
      ]
    });

    console.log(`Created DCA order ${id} for user ${userWallet}: ${inputToken.symbol} → ${outputToken.symbol}`);

    return NextResponse.json({
      success: true,
      order: {
        ...dcaOrder,
        nextSwapDate: new Date(nextSwapAt).toISOString(),
        estimatedOutput: estimate.outputAmount,
        estimatedPriceImpact: estimate.priceImpact
      }
    });

  } catch (error) {
    console.error('Error creating DCA order:', error);
    return NextResponse.json(
      { error: 'Failed to create DCA order', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
