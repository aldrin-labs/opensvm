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
  VersionedTransaction,
  TransactionMessage
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} from '@solana/spl-token';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

const COLLECTION_NAME = 'svm_bank_wallets';

interface MultisigTransferRequest {
  fromWalletId: string;
  toAddress: string;
  amount: number;
  tokenMint?: string;
  isInternalTransfer?: boolean;
  hardwareSignature?: string; // Base58 encoded signature from hardware wallet
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
  hardwareWalletPubkey?: string;
  requiresHardwareSignature?: boolean;
}

// Store pending transactions awaiting hardware signature
const pendingTransactions = new Map<string, {
  transaction: string; // Base64 serialized
  challenge: string;
  timestamp: number;
  fromWalletId: string;
  toAddress: string;
  amount: number;
  tokenMint?: string;
}>();

const PENDING_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/bank/wallets/transfer/multisig
 *
 * Two-step process for multisig transfers:
 * Step 1: No hardwareSignature - Returns transaction to sign with hardware wallet
 * Step 2: With hardwareSignature - Executes the transfer with both signatures
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
    const body: MultisigTransferRequest = await req.json();
    const { fromWalletId, toAddress, amount, tokenMint, isInternalTransfer, hardwareSignature } = body;

    // Validate request
    if (!fromWalletId || !toAddress || amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Verify this wallet requires hardware signature
    if (!sourceWallet.requiresHardwareSignature || !sourceWallet.hardwareWalletPubkey) {
      return NextResponse.json(
        { error: 'This wallet does not have hardware wallet linked. Use regular transfer endpoint.' },
        { status: 400 }
      );
    }

    // Resolve destination address
    let destinationAddress: string;
    let destinationWalletName: string | null = null;

    if (isInternalTransfer) {
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

      if (destWallet.userWallet !== userWallet) {
        return NextResponse.json(
          { error: 'Not authorized to transfer to this wallet' },
          { status: 403 }
        );
      }

      destinationAddress = destWallet.address;
      destinationWalletName = destWallet.name;
    } else {
      if (!isValidSolanaAddress(toAddress)) {
        return NextResponse.json(
          { error: 'Invalid destination address' },
          { status: 400 }
        );
      }
      destinationAddress = toAddress;
    }

    if (sourceWallet.address === destinationAddress) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same wallet' },
        { status: 400 }
      );
    }

    const connection = getSolanaConnection();
    const sourcePubkey = new PublicKey(sourceWallet.address);
    const destPubkey = new PublicKey(destinationAddress);
    const hardwarePubkey = new PublicKey(sourceWallet.hardwareWalletPubkey);

    // STEP 1: If no hardware signature, build and return transaction for signing
    if (!hardwareSignature) {
      const timestamp = Date.now();
      const nonce = bs58.encode(nacl.randomBytes(16));

      // Build the transaction
      const transaction = new Transaction();
      let transferDescription: string;

      if (!tokenMint) {
        // SOL transfer
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
        transferDescription = `${amount} SOL`;

        // Check balance
        const balance = await connection.getBalance(sourcePubkey);
        const estimatedFee = 10000;

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

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: sourcePubkey,
            toPubkey: destPubkey,
            lamports
          })
        );
      } else {
        // SPL Token transfer
        const mintPubkey = new PublicKey(tokenMint);

        let programId = TOKEN_PROGRAM_ID;
        try {
          const mintInfo = await connection.getAccountInfo(mintPubkey);
          if (mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
            programId = TOKEN_2022_PROGRAM_ID;
          }
        } catch {
          // Default to TOKEN_PROGRAM_ID
        }

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

        const mintAccount = await connection.getParsedAccountInfo(mintPubkey);
        const decimals = (mintAccount.value?.data as any)?.parsed?.info?.decimals || 0;
        const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

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

        const destAta = await getAssociatedTokenAddress(mintPubkey, destPubkey, false, programId);
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

        transferDescription = `${amount} tokens (${tokenMint.slice(0, 8)}...)`;
      }

      // Set transaction properties
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = sourcePubkey;

      // Serialize for storage
      const serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');

      // Create challenge message for hardware wallet
      const challenge = `SVM Bank Multisig Transfer\n\nFrom: ${sourceWallet.address}\nTo: ${destinationAddress}\nAmount: ${transferDescription}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign to authorize this transfer.`;

      // Store pending transaction
      const pendingKey = `${userWallet}:${fromWalletId}:${timestamp}`;
      pendingTransactions.set(pendingKey, {
        transaction: serializedTx,
        challenge,
        timestamp,
        fromWalletId,
        toAddress: destinationAddress,
        amount,
        tokenMint
      });

      // Clean up old pending transactions
      const now = Date.now();
      const keysToDelete: string[] = [];
      pendingTransactions.forEach((value, key) => {
        if (now - value.timestamp > PENDING_EXPIRY_MS) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => pendingTransactions.delete(key));

      return NextResponse.json({
        step: 1,
        message: 'Sign the challenge with your hardware wallet',
        challenge,
        pendingKey,
        expiresAt: timestamp + PENDING_EXPIRY_MS,
        transfer: {
          from: sourceWallet.address,
          to: destinationAddress,
          amount,
          tokenMint: tokenMint || null
        }
      });
    }

    // STEP 2: Verify hardware signature and execute transfer
    // Find the pending transaction
    let pendingKey: string | null = null;
    let pendingTx: typeof pendingTransactions extends Map<string, infer V> ? V : never | null = null;

    pendingTransactions.forEach((value, key) => {
      if (key.startsWith(`${userWallet}:${fromWalletId}:`) &&
          value.toAddress === destinationAddress &&
          value.amount === amount) {
        pendingKey = key;
        pendingTx = value;
      }
    });

    if (!pendingKey || !pendingTx) {
      return NextResponse.json(
        { error: 'No pending transaction found. Please initiate transfer first.' },
        { status: 400 }
      );
    }

    // Check expiry
    if (Date.now() - pendingTx.timestamp > PENDING_EXPIRY_MS) {
      pendingTransactions.delete(pendingKey);
      return NextResponse.json(
        { error: 'Pending transaction expired. Please initiate again.' },
        { status: 400 }
      );
    }

    // Verify hardware wallet signature
    try {
      const publicKeyBytes = hardwarePubkey.toBytes();
      const signatureBytes = bs58.decode(hardwareSignature);
      const messageBytes = new TextEncoder().encode(pendingTx.challenge);

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid hardware wallet signature' },
          { status: 401 }
        );
      }
    } catch (sigError) {
      return NextResponse.json(
        { error: 'Failed to verify hardware signature' },
        { status: 400 }
      );
    }

    // Remove pending transaction
    pendingTransactions.delete(pendingKey);

    // Decrypt server-side key and sign transaction
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

    // Deserialize and sign transaction with server key
    const transactionBuffer = Buffer.from(pendingTx.transaction, 'base64');
    const transaction = Transaction.from(transactionBuffer);

    // Update blockhash (it may have changed)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    // Sign with server key
    transaction.sign(sourceKeypair);

    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    console.log(`Multisig transfer completed: ${amount} from ${sourceWallet.address} to ${destinationAddress}. Signature: ${signature}`);

    return NextResponse.json({
      success: true,
      step: 2,
      signature,
      transfer: {
        type: tokenMint ? 'SPL' : 'SOL',
        amount,
        tokenMint: tokenMint || null,
        from: {
          walletId: fromWalletId,
          address: sourceWallet.address,
          name: sourceWallet.name
        },
        to: {
          address: destinationAddress,
          name: destinationWalletName
        }
      },
      explorerUrl: `https://solscan.io/tx/${signature}`,
      multisigVerified: true
    });

  } catch (error) {
    console.error('Multisig transfer error:', error);
    return NextResponse.json(
      { error: 'Transfer failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
