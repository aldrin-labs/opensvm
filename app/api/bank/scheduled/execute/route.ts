import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} from '@solana/spl-token';

const WALLETS_COLLECTION = 'svm_bank_wallets';
const SCHEDULED_COLLECTION = 'svm_bank_scheduled_transfers';

// API key for cron authentication
const CRON_SECRET = process.env.CRON_SECRET || process.env.API_KEY_ENCRYPTION_SECRET;

interface ScheduledTransfer {
  id: string;
  userWallet: string;
  fromWalletId: string;
  fromWalletAddress: string;
  fromWalletName: string;
  toAddress: string;
  amount: number;
  tokenMint?: string;
  scheduleType: 'once' | 'recurring';
  frequency?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  timezone: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastExecuted?: number;
  nextExecution: number;
  executionCount: number;
  maxExecutions?: number;
  createdAt: number;
  updatedAt: number;
  memo?: string;
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
}

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Calculate next execution time
 */
function calculateNextExecution(transfer: ScheduledTransfer): number {
  if (transfer.scheduleType === 'once') {
    return transfer.nextExecution; // Will be marked completed
  }

  const now = new Date();
  const target = new Date(now);
  target.setHours(transfer.hour, transfer.minute, 0, 0);

  if (transfer.frequency === 'daily') {
    target.setDate(target.getDate() + 1);
  } else if (transfer.frequency === 'weekly' && transfer.dayOfWeek !== undefined) {
    target.setDate(target.getDate() + 7);
  } else if (transfer.frequency === 'monthly' && transfer.dayOfMonth !== undefined) {
    target.setMonth(target.getMonth() + 1);
    target.setDate(transfer.dayOfMonth);
    // Handle months with fewer days
    while (target.getDate() !== transfer.dayOfMonth) {
      target.setDate(target.getDate() - 1);
    }
  }

  return target.getTime();
}

/**
 * Execute a single scheduled transfer
 */
async function executeTransfer(transfer: ScheduledTransfer): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  const connection = getSolanaConnection();

  try {
    // Fetch source wallet
    const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
      ids: [transfer.fromWalletId],
      with_payload: true
    });

    if (walletResult.length === 0) {
      throw new Error('Source wallet not found');
    }

    const sourceWallet = walletResult[0].payload as WalletPayload;

    // Decrypt private key
    const privateKeyBytes = decryptPrivateKey(
      sourceWallet.encryptedPrivateKey,
      transfer.userWallet
    );
    const sourceKeypair = Keypair.fromSecretKey(privateKeyBytes);
    const sourcePubkey = new PublicKey(sourceWallet.address);
    const destPubkey = new PublicKey(transfer.toAddress);

    let signature: string;

    if (!transfer.tokenMint) {
      // SOL transfer
      const lamports = Math.floor(transfer.amount * LAMPORTS_PER_SOL);

      // Check balance
      const balance = await connection.getBalance(sourcePubkey);
      if (balance < lamports + 5000) {
        throw new Error(`Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`);
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourcePubkey,
          toPubkey: destPubkey,
          lamports
        })
      );

      // Add memo if present
      if (transfer.memo) {
        // Would add memo instruction here
      }

      signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [sourceKeypair],
        { commitment: 'confirmed' }
      );

    } else {
      // SPL Token transfer
      const mintPubkey = new PublicKey(transfer.tokenMint);

      let programId = TOKEN_PROGRAM_ID;
      const mintInfo = await connection.getAccountInfo(mintPubkey);
      if (mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        programId = TOKEN_2022_PROGRAM_ID;
      }

      const sourceAta = await getAssociatedTokenAddress(mintPubkey, sourcePubkey, false, programId);
      const sourceTokenAccount = await getAccount(connection, sourceAta, 'confirmed', programId);

      const mintAccount = await connection.getParsedAccountInfo(mintPubkey);
      const decimals = (mintAccount.value?.data as any)?.parsed?.info?.decimals || 0;
      const rawAmount = BigInt(Math.floor(transfer.amount * Math.pow(10, decimals)));

      if (sourceTokenAccount.amount < rawAmount) {
        throw new Error('Insufficient token balance');
      }

      const destAta = await getAssociatedTokenAddress(mintPubkey, destPubkey, false, programId);
      const transaction = new Transaction();

      const destAtaInfo = await connection.getAccountInfo(destAta);
      if (!destAtaInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            sourcePubkey,
            destAta,
            destPubkey,
            mintPubkey,
            programId
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          sourceAta,
          destAta,
          sourcePubkey,
          rawAmount,
          [],
          programId
        )
      );

      signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [sourceKeypair],
        { commitment: 'confirmed' }
      );
    }

    return { success: true, signature };

  } catch (error) {
    console.error(`Transfer execution failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * POST /api/bank/scheduled/execute
 * Execute due scheduled transfers (called by cron job)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = req.headers.get('authorization');
    const cronKey = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || cronKey !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = Date.now();
    const results: Array<{
      id: string;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    // Find all due transfers
    const dueTransfers = await qdrantClient.scroll(SCHEDULED_COLLECTION, {
      filter: {
        must: [
          { key: 'status', match: { value: 'active' } },
          { key: 'nextExecution', range: { lte: now } }
        ]
      },
      limit: 50,
      with_payload: true
    });

    console.log(`Found ${dueTransfers.points.length} scheduled transfers to execute`);

    for (const point of dueTransfers.points) {
      const transfer = point.payload as ScheduledTransfer;
      const transferId = point.id as string;

      console.log(`Executing scheduled transfer ${transferId}`);

      // Execute the transfer
      const result = await executeTransfer(transfer);
      results.push({ id: transferId, ...result });

      // Update transfer record
      const newExecutionCount = transfer.executionCount + 1;
      const isComplete = transfer.scheduleType === 'once' ||
        (transfer.maxExecutions && newExecutionCount >= transfer.maxExecutions);

      const updatedTransfer: Partial<ScheduledTransfer> = {
        ...transfer,
        lastExecuted: now,
        executionCount: newExecutionCount,
        status: isComplete ? 'completed' : (result.success ? 'active' : 'failed'),
        nextExecution: isComplete ? transfer.nextExecution : calculateNextExecution(transfer),
        updatedAt: now
      };

      // If failed but recurring, keep active but log failure
      if (!result.success && transfer.scheduleType === 'recurring') {
        updatedTransfer.status = 'active'; // Keep trying
      }

      await qdrantClient.setPayload(SCHEDULED_COLLECTION, {
        payload: updatedTransfer,
        points: [transferId]
      });

      // Small delay between transfers to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
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
    console.error('Scheduled execution error:', error);
    return NextResponse.json(
      { error: 'Execution failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/scheduled/execute
 * Get pending executions (for debugging/monitoring)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = req.headers.get('authorization');
    const cronKey = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || cronKey !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = Date.now();

    // Find pending transfers
    const pending = await qdrantClient.scroll(SCHEDULED_COLLECTION, {
      filter: {
        must: [
          { key: 'status', match: { value: 'active' } }
        ]
      },
      limit: 100,
      with_payload: true
    });

    const due = pending.points.filter(
      (p: any) => p.payload.nextExecution <= now
    );

    const upcoming = pending.points
      .filter((p: any) => p.payload.nextExecution > now)
      .sort((a: any, b: any) => a.payload.nextExecution - b.payload.nextExecution)
      .slice(0, 10);

    return NextResponse.json({
      dueCount: due.length,
      dueTransfers: due.map((p: any) => ({
        id: p.id,
        fromWallet: p.payload.fromWalletName,
        amount: p.payload.amount,
        tokenMint: p.payload.tokenMint,
        nextExecution: new Date(p.payload.nextExecution).toISOString()
      })),
      upcomingTransfers: upcoming.map((p: any) => ({
        id: p.id,
        fromWallet: p.payload.fromWalletName,
        amount: p.payload.amount,
        tokenMint: p.payload.tokenMint,
        nextExecution: new Date(p.payload.nextExecution).toISOString()
      }))
    });

  } catch (error) {
    console.error('Error getting pending transfers:', error);
    return NextResponse.json(
      { error: 'Failed to get pending transfers' },
      { status: 500 }
    );
  }
}
