import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
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

const COLLECTION_NAME = 'svm_bank_wallets';

interface TransferRequest {
  fromWalletId: string;
  toAddress: string; // Can be wallet ID or external address
  amount: number;
  tokenMint?: string; // If undefined, transfer SOL
  isInternalTransfer?: boolean; // If true, toAddress is a wallet ID
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
  hardwareWalletPubkey?: string; // For multisig
  requiresHardwareSignature?: boolean;
}

/**
 * Get Solana connection
 */
function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Validate a Solana address
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/bank/wallets/transfer
 * Transfer SOL or SPL tokens between wallets
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

    const userWallet = session.walletAddress;
    const body: TransferRequest = await req.json();
    const { fromWalletId, toAddress, amount, tokenMint, isInternalTransfer } = body;

    // Validate request
    if (!fromWalletId || !toAddress || amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: fromWalletId, toAddress, amount' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Fetch source wallet
    const sourceResult = await qdrantClient.retrieve(COLLECTION_NAME, {
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

    // Verify ownership
    if (sourceWallet.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized to transfer from this wallet' },
        { status: 403 }
      );
    }

    // Check if hardware signature is required
    if (sourceWallet.requiresHardwareSignature) {
      return NextResponse.json(
        { error: 'This wallet requires hardware wallet signature. Use the multisig transfer endpoint.' },
        { status: 400 }
      );
    }

    // Resolve destination address
    let destinationAddress: string;
    let destinationWalletName: string | null = null;

    if (isInternalTransfer) {
      // toAddress is a wallet ID, fetch it
      const destResult = await qdrantClient.retrieve(COLLECTION_NAME, {
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

      // Verify ownership of destination
      if (destWallet.userWallet !== userWallet) {
        return NextResponse.json(
          { error: 'Not authorized to transfer to this wallet' },
          { status: 403 }
        );
      }

      destinationAddress = destWallet.address;
      destinationWalletName = destWallet.name;
    } else {
      // toAddress is an external Solana address
      if (!isValidSolanaAddress(toAddress)) {
        return NextResponse.json(
          { error: 'Invalid destination address' },
          { status: 400 }
        );
      }
      destinationAddress = toAddress;
    }

    // Prevent self-transfer
    if (sourceWallet.address === destinationAddress) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same wallet' },
        { status: 400 }
      );
    }

    // Decrypt source wallet private key
    let sourceKeypair: Keypair;
    try {
      const privateKeyBytes = decryptPrivateKey(sourceWallet.encryptedPrivateKey, userWallet);
      sourceKeypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch (decryptError) {
      console.error('Failed to decrypt source wallet:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt wallet private key' },
        { status: 500 }
      );
    }

    const connection = getSolanaConnection();
    const sourcePubkey = new PublicKey(sourceWallet.address);
    const destPubkey = new PublicKey(destinationAddress);

    let signature: string;
    let transferType: 'SOL' | 'SPL';
    let actualAmount: number;

    if (!tokenMint) {
      // SOL transfer
      transferType = 'SOL';
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      actualAmount = amount;

      // Check balance
      const balance = await connection.getBalance(sourcePubkey);
      const estimatedFee = 5000; // ~0.000005 SOL

      if (balance < lamports + estimatedFee) {
        return NextResponse.json(
          {
            error: 'Insufficient balance',
            required: (lamports + estimatedFee) / LAMPORTS_PER_SOL,
            available: balance / LAMPORTS_PER_SOL
          },
          { status: 400 }
        );
      }

      // Create SOL transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourcePubkey,
          toPubkey: destPubkey,
          lamports
        })
      );

      // Send and confirm
      signature = await sendAndConfirmTransaction(connection, transaction, [sourceKeypair], {
        commitment: 'confirmed'
      });

    } else {
      // SPL Token transfer
      transferType = 'SPL';
      const mintPubkey = new PublicKey(tokenMint);

      // Determine which token program to use
      let programId = TOKEN_PROGRAM_ID;
      try {
        const mintInfo = await connection.getAccountInfo(mintPubkey);
        if (mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
          programId = TOKEN_2022_PROGRAM_ID;
        }
      } catch {
        // Default to TOKEN_PROGRAM_ID
      }

      // Get source token account
      const sourceAta = await getAssociatedTokenAddress(mintPubkey, sourcePubkey, false, programId);
      let sourceTokenAccount;
      try {
        sourceTokenAccount = await getAccount(connection, sourceAta, 'confirmed', programId);
      } catch {
        return NextResponse.json(
          { error: 'Source wallet does not have this token' },
          { status: 400 }
        );
      }

      // Get decimals and calculate raw amount
      const mintAccount = await connection.getParsedAccountInfo(mintPubkey);
      const decimals = (mintAccount.value?.data as any)?.parsed?.info?.decimals || 0;
      const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
      actualAmount = amount;

      // Check token balance
      if (sourceTokenAccount.amount < rawAmount) {
        return NextResponse.json(
          {
            error: 'Insufficient token balance',
            required: amount,
            available: Number(sourceTokenAccount.amount) / Math.pow(10, decimals)
          },
          { status: 400 }
        );
      }

      // Get or create destination token account
      const destAta = await getAssociatedTokenAddress(mintPubkey, destPubkey, false, programId);

      const transaction = new Transaction();

      // Check if destination ATA exists
      const destAtaInfo = await connection.getAccountInfo(destAta);
      if (!destAtaInfo) {
        // Create ATA for destination
        transaction.add(
          createAssociatedTokenAccountInstruction(
            sourcePubkey, // payer
            destAta,
            destPubkey,
            mintPubkey,
            programId
          )
        );
      }

      // Add transfer instruction
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

      // Send and confirm
      signature = await sendAndConfirmTransaction(connection, transaction, [sourceKeypair], {
        commitment: 'confirmed'
      });
    }

    console.log(`Transfer completed: ${transferType} ${actualAmount} from ${sourceWallet.address} to ${destinationAddress}. Signature: ${signature}`);

    return NextResponse.json({
      success: true,
      signature,
      transfer: {
        type: transferType,
        amount: actualAmount,
        tokenMint: tokenMint || null,
        from: {
          walletId: fromWalletId,
          address: sourceWallet.address,
          name: sourceWallet.name
        },
        to: {
          walletId: isInternalTransfer ? toAddress : null,
          address: destinationAddress,
          name: destinationWalletName
        }
      },
      explorerUrl: `https://solscan.io/tx/${signature}`
    });

  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json(
      { error: 'Transfer failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/wallets/transfer
 * Get transfer options (available wallets and their balances)
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

    const userWallet = session.walletAddress;

    // Fetch all user's wallets
    const results = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'userWallet',
            match: { value: userWallet }
          }
        ]
      },
      limit: 100,
      with_payload: true
    });

    const wallets = results.points.map((point: any) => ({
      id: point.payload.id,
      address: point.payload.address,
      name: point.payload.name,
      requiresHardwareSignature: point.payload.requiresHardwareSignature || false
    }));

    return NextResponse.json({
      wallets,
      total: wallets.length
    });

  } catch (error) {
    console.error('Error fetching transfer options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer options' },
      { status: 500 }
    );
  }
}
