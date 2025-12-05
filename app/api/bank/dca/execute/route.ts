import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  getSwapQuote,
  executeSwap,
  getTokenInfo
} from '@/lib/bank/jupiter-swap';

const WALLETS_COLLECTION = 'svm_bank_wallets';
const DCA_COLLECTION = 'svm_bank_dca_orders';

const CRON_SECRET = process.env.CRON_SECRET || process.env.API_KEY_ENCRYPTION_SECRET;

interface DCAOrder {
  id: string;
  userWallet: string;
  walletId: string;
  walletAddress: string;
  walletName: string;
  inputMint: string;
  inputSymbol: string;
  outputMint: string;
  outputSymbol: string;
  amountPerSwap: number;
  slippageBps: number;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  totalBudget?: number;
  maxSwaps?: number;
  minOutputAmount?: number;
  maxPriceImpact?: number;
  status: 'active' | 'paused' | 'completed' | 'exhausted';
  totalSwapped: number;
  totalReceived: number;
  swapCount: number;
  lastSwapAt?: number;
  lastSwapSignature?: string;
  nextSwapAt: number;
  averagePrice: number;
  createdAt: number;
  updatedAt: number;
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
}

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
                 process.env.SOLANA_RPC_URL ||
                 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function calculateNextSwap(order: DCAOrder): number {
  const now = new Date();
  const target = new Date(now);
  target.setMinutes(order.minute, 0, 0);

  if (order.frequency === 'hourly') {
    target.setHours(target.getHours() + 1);
  } else {
    target.setHours(order.hour);

    if (order.frequency === 'daily') {
      target.setDate(target.getDate() + 1);
    } else if (order.frequency === 'weekly' && order.dayOfWeek !== undefined) {
      target.setDate(target.getDate() + 7);
    } else if (order.frequency === 'monthly' && order.dayOfMonth !== undefined) {
      target.setMonth(target.getMonth() + 1);
      target.setDate(order.dayOfMonth);
    }
  }

  return target.getTime();
}

async function executeOrderSwap(order: DCAOrder): Promise<{
  success: boolean;
  signature?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: string;
}> {
  const connection = getConnection();

  try {
    // Fetch wallet
    const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
      ids: [order.walletId],
      with_payload: true
    });

    if (walletResult.length === 0) {
      throw new Error('Wallet not found');
    }

    const wallet = walletResult[0].payload as WalletPayload;

    // Check balance
    const publicKey = new PublicKey(wallet.address);

    // Get input token info
    const inputToken = await getTokenInfo(order.inputMint);
    if (!inputToken) {
      throw new Error('Input token not found');
    }

    // Check if SOL or SPL token
    let availableBalance: number;

    if (order.inputMint === 'So11111111111111111111111111111111111112') {
      // SOL balance
      const lamports = await connection.getBalance(publicKey);
      availableBalance = lamports / LAMPORTS_PER_SOL;
      // Leave some for fees
      availableBalance = Math.max(0, availableBalance - 0.01);
    } else {
      // SPL token balance
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(order.inputMint)
      });

      if (tokenAccounts.value.length === 0) {
        throw new Error('No token account found');
      }

      availableBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    }

    if (availableBalance < order.amountPerSwap) {
      throw new Error(`Insufficient balance: ${availableBalance} < ${order.amountPerSwap}`);
    }

    // Check if we've exceeded budget
    if (order.totalBudget && order.totalSwapped + order.amountPerSwap > order.totalBudget) {
      return {
        success: false,
        error: 'Budget exhausted'
      };
    }

    // Get quote
    const quote = await getSwapQuote(
      order.inputMint,
      order.outputMint,
      order.amountPerSwap,
      inputToken.decimals,
      order.slippageBps
    );

    if (!quote) {
      throw new Error('Failed to get swap quote');
    }

    // Check price impact
    const priceImpact = parseFloat(quote.priceImpactPct);
    if (order.maxPriceImpact && priceImpact > order.maxPriceImpact) {
      throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}%`);
    }

    // Check minimum output
    const outputToken = await getTokenInfo(order.outputMint);
    const outputDecimals = outputToken?.decimals || 9;
    const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);

    if (order.minOutputAmount && outputAmount < order.minOutputAmount) {
      throw new Error(`Output below minimum: ${outputAmount} < ${order.minOutputAmount}`);
    }

    // Decrypt private key and execute swap
    const privateKeyBytes = decryptPrivateKey(wallet.encryptedPrivateKey, order.userWallet);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

    const result = await executeSwap(quote, publicKey, keypair);

    if (!result.success) {
      throw new Error(result.error || 'Swap failed');
    }

    return {
      success: true,
      signature: result.signature,
      inputAmount: result.inputAmount,
      outputAmount: result.outputAmount
    };

  } catch (error) {
    console.error('DCA swap execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * POST /api/bank/dca/execute
 * Execute due DCA orders (called by cron job)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = req.headers.get('authorization');
    const cronKey = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || cronKey !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const results: Array<{
      orderId: string;
      success: boolean;
      signature?: string;
      inputAmount?: number;
      outputAmount?: number;
      error?: string;
    }> = [];

    // Find due DCA orders
    const dueOrders = await qdrantClient.scroll(DCA_COLLECTION, {
      filter: {
        must: [
          { key: 'status', match: { value: 'active' } },
          { key: 'nextSwapAt', range: { lte: now } }
        ]
      },
      limit: 20,
      with_payload: true
    });

    console.log(`Found ${dueOrders.points.length} DCA orders to execute`);

    for (const point of dueOrders.points) {
      const order = point.payload as DCAOrder;
      const orderId = point.id as string;

      console.log(`Executing DCA order ${orderId}: ${order.inputSymbol} → ${order.outputSymbol}`);

      const result = await executeOrderSwap(order);
      results.push({
        orderId,
        ...result
      });

      // Update order
      const newSwapCount = order.swapCount + (result.success ? 1 : 0);
      const newTotalSwapped = order.totalSwapped + (result.inputAmount || 0);
      const newTotalReceived = order.totalReceived + (result.outputAmount || 0);

      // Check if order should be marked as complete
      let newStatus: DCAOrder['status'] = order.status;

      if (result.error === 'Budget exhausted') {
        newStatus = 'exhausted';
      } else if (order.maxSwaps && newSwapCount >= order.maxSwaps) {
        newStatus = 'completed';
      } else if (order.totalBudget && newTotalSwapped >= order.totalBudget) {
        newStatus = 'exhausted';
      }

      // Calculate average price
      const newAveragePrice = newTotalReceived > 0
        ? newTotalSwapped / newTotalReceived
        : 0;

      const updatedOrder: Partial<DCAOrder> = {
        ...order,
        swapCount: newSwapCount,
        totalSwapped: newTotalSwapped,
        totalReceived: newTotalReceived,
        averagePrice: newAveragePrice,
        status: newStatus,
        lastSwapAt: result.success ? now : order.lastSwapAt,
        lastSwapSignature: result.signature || order.lastSwapSignature,
        nextSwapAt: newStatus === 'active' ? calculateNextSwap(order) : order.nextSwapAt,
        updatedAt: now
      };

      await qdrantClient.setPayload(DCA_COLLECTION, {
        payload: updatedOrder,
        points: [orderId]
      });

      // Delay between swaps to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      executed: results.length,
      successful: successCount,
      failed: failedCount,
      results
    });

  } catch (error) {
    console.error('DCA execution error:', error);
    return NextResponse.json(
      { error: 'Execution failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/dca/execute
 * Get pending DCA orders (for monitoring)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronKey = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || cronKey !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();

    const pending = await qdrantClient.scroll(DCA_COLLECTION, {
      filter: {
        must: [{ key: 'status', match: { value: 'active' } }]
      },
      limit: 100,
      with_payload: true
    });

    const due = pending.points.filter((p: any) => p.payload.nextSwapAt <= now);
    const upcoming = pending.points
      .filter((p: any) => p.payload.nextSwapAt > now)
      .sort((a: any, b: any) => a.payload.nextSwapAt - b.payload.nextSwapAt)
      .slice(0, 10);

    return NextResponse.json({
      dueCount: due.length,
      dueOrders: due.map((p: any) => ({
        id: p.id,
        wallet: p.payload.walletName,
        pair: `${p.payload.inputSymbol} → ${p.payload.outputSymbol}`,
        amount: p.payload.amountPerSwap,
        nextSwap: new Date(p.payload.nextSwapAt).toISOString()
      })),
      upcomingOrders: upcoming.map((p: any) => ({
        id: p.id,
        wallet: p.payload.walletName,
        pair: `${p.payload.inputSymbol} → ${p.payload.outputSymbol}`,
        amount: p.payload.amountPerSwap,
        nextSwap: new Date(p.payload.nextSwapAt).toISOString()
      }))
    });

  } catch (error) {
    console.error('Error getting DCA status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
