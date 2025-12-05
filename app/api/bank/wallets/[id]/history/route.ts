import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

const COLLECTION_NAME = 'svm_bank_wallets';

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  name: string;
}

interface TransactionInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  timestamp: string | null;
  type: 'send' | 'receive' | 'swap' | 'unknown';
  status: 'success' | 'failed';
  fee: number;
  feeSOL: number;
  // For SOL transfers
  solChange: number | null;
  // For token transfers
  tokenTransfers: Array<{
    mint: string;
    amount: number;
    decimals: number;
    direction: 'in' | 'out';
  }>;
  // Counterparty
  counterparty: string | null;
  // Program interactions
  programs: string[];
  // Raw data
  memo: string | null;
}

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Parse a transaction to extract relevant information
 */
function parseTransaction(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  signature: string
): TransactionInfo {
  const walletPubkey = new PublicKey(walletAddress);
  const meta = tx.meta;
  const message = tx.transaction.message;

  // Basic info
  const info: TransactionInfo = {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
    timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
    type: 'unknown',
    status: meta?.err ? 'failed' : 'success',
    fee: meta?.fee || 0,
    feeSOL: (meta?.fee || 0) / LAMPORTS_PER_SOL,
    solChange: null,
    tokenTransfers: [],
    counterparty: null,
    programs: [],
    memo: null
  };

  if (!meta) return info;

  // Calculate SOL change for this wallet
  const accountKeys = message.accountKeys.map(k =>
    typeof k === 'string' ? k : k.pubkey.toString()
  );
  const walletIndex = accountKeys.findIndex(k => k === walletAddress);

  if (walletIndex !== -1 && meta.preBalances && meta.postBalances) {
    const preBalance = meta.preBalances[walletIndex];
    const postBalance = meta.postBalances[walletIndex];
    info.solChange = (postBalance - preBalance) / LAMPORTS_PER_SOL;

    // Determine type based on SOL change (excluding fees)
    const netChange = info.solChange + info.feeSOL; // Add back fee to get true transfer
    if (netChange > 0.00001) {
      info.type = 'receive';
    } else if (netChange < -0.00001) {
      info.type = 'send';
    }
  }

  // Parse token transfers
  if (meta.preTokenBalances && meta.postTokenBalances) {
    const preTokenMap = new Map<string, { amount: string; decimals: number; mint: string }>();
    const postTokenMap = new Map<string, { amount: string; decimals: number; mint: string }>();

    for (const balance of meta.preTokenBalances) {
      if (balance.owner === walletAddress) {
        preTokenMap.set(balance.mint, {
          amount: balance.uiTokenAmount.amount,
          decimals: balance.uiTokenAmount.decimals,
          mint: balance.mint
        });
      }
    }

    for (const balance of meta.postTokenBalances) {
      if (balance.owner === walletAddress) {
        postTokenMap.set(balance.mint, {
          amount: balance.uiTokenAmount.amount,
          decimals: balance.uiTokenAmount.decimals,
          mint: balance.mint
        });
      }
    }

    // Find changes
    const allMints = new Set([...preTokenMap.keys(), ...postTokenMap.keys()]);
    for (const mint of allMints) {
      const pre = preTokenMap.get(mint);
      const post = postTokenMap.get(mint);

      const preAmount = pre ? BigInt(pre.amount) : BigInt(0);
      const postAmount = post ? BigInt(post.amount) : BigInt(0);
      const decimals = post?.decimals || pre?.decimals || 0;

      if (preAmount !== postAmount) {
        const change = Number(postAmount - preAmount) / Math.pow(10, decimals);
        info.tokenTransfers.push({
          mint,
          amount: Math.abs(change),
          decimals,
          direction: change > 0 ? 'in' : 'out'
        });

        // Update type based on token transfers
        if (change > 0) {
          info.type = info.type === 'send' ? 'swap' : 'receive';
        } else {
          info.type = info.type === 'receive' ? 'swap' : 'send';
        }
      }
    }
  }

  // Extract programs
  const instructions = message.instructions;
  for (const ix of instructions) {
    const programId = typeof ix.programId === 'string' ? ix.programId : ix.programId.toString();
    if (!info.programs.includes(programId)) {
      info.programs.push(programId);
    }
  }

  // Try to find counterparty
  if (info.type === 'send' || info.type === 'receive') {
    // Look for the other party in the transaction
    for (const key of accountKeys) {
      if (key !== walletAddress &&
          key !== '11111111111111111111111111111111' && // System program
          key !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && // Token program
          !info.programs.includes(key)) {
        info.counterparty = key;
        break;
      }
    }
  }

  // Extract memo if present
  const memoIx = instructions.find(ix => {
    const pid = typeof ix.programId === 'string' ? ix.programId : ix.programId.toString();
    return pid === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' ||
           pid === 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';
  });

  if (memoIx && 'parsed' in memoIx) {
    info.memo = (memoIx as any).parsed;
  }

  return info;
}

/**
 * GET /api/bank/wallets/[id]/history
 * Get transaction history for a managed wallet
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

    // Fetch wallet
    const result = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [id],
      with_payload: true
    });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const wallet = result[0].payload as WalletPayload;

    // Verify ownership
    if (wallet.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Parse query params
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 100);
    const before = req.nextUrl.searchParams.get('before') || undefined;
    const until = req.nextUrl.searchParams.get('until') || undefined;

    const connection = getSolanaConnection();
    const publicKey = new PublicKey(wallet.address);

    // Fetch signatures
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit,
      before,
      until
    });

    if (signatures.length === 0) {
      return NextResponse.json({
        wallet: {
          id: wallet.id,
          address: wallet.address,
          name: wallet.name
        },
        transactions: [],
        total: 0,
        hasMore: false
      });
    }

    // Fetch full transaction details
    const sigStrings = signatures.map(s => s.signature);
    const transactions = await connection.getParsedTransactions(sigStrings, {
      maxSupportedTransactionVersion: 0
    });

    // Parse transactions
    const parsedTransactions: TransactionInfo[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (tx) {
        parsedTransactions.push(parseTransaction(tx, wallet.address, sigStrings[i]));
      }
    }

    // Calculate summary stats
    const stats = {
      totalTransactions: parsedTransactions.length,
      totalSent: parsedTransactions
        .filter(t => t.type === 'send' && t.solChange)
        .reduce((sum, t) => sum + Math.abs(t.solChange || 0), 0),
      totalReceived: parsedTransactions
        .filter(t => t.type === 'receive' && t.solChange)
        .reduce((sum, t) => sum + (t.solChange || 0), 0),
      totalFees: parsedTransactions.reduce((sum, t) => sum + t.feeSOL, 0),
      successCount: parsedTransactions.filter(t => t.status === 'success').length,
      failedCount: parsedTransactions.filter(t => t.status === 'failed').length
    };

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        address: wallet.address,
        name: wallet.name
      },
      transactions: parsedTransactions,
      total: parsedTransactions.length,
      hasMore: signatures.length === limit,
      nextCursor: signatures.length > 0 ? signatures[signatures.length - 1].signature : null,
      stats
    });

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
