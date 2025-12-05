import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

const COLLECTION_NAME = 'svm_bank_wallets';
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// In-memory store for challenges (in production, use Redis or similar)
const challenges = new Map<string, { challenge: string; timestamp: number; walletId: string }>();

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

/**
 * GET /api/bank/wallets/[id]/export
 * Generate a challenge for private key export
 * The user must sign this challenge to prove wallet ownership
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

    // Verify wallet exists and belongs to user
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

    if (wallet.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized to export this wallet' },
        { status: 403 }
      );
    }

    // Generate a unique challenge
    const timestamp = Date.now();
    const nonce = bs58.encode(nacl.randomBytes(32));
    const challenge = `SVM Bank Private Key Export\n\nWallet: ${wallet.address}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to confirm you want to export your private key. This action exposes your wallet's secret key.`;

    // Store challenge for verification
    const challengeKey = `${userWallet}:${id}`;
    challenges.set(challengeKey, {
      challenge,
      timestamp,
      walletId: id
    });

    // Clean up old challenges
    const now = Date.now();
    const keysToDelete: string[] = [];
    challenges.forEach((value, key) => {
      if (now - value.timestamp > CHALLENGE_EXPIRY_MS) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => challenges.delete(key));

    return NextResponse.json({
      challenge,
      expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
      walletAddress: wallet.address,
      walletName: wallet.name,
      warning: 'Exporting your private key exposes full control of this wallet. Never share it with anyone.'
    });

  } catch (error) {
    console.error('Error generating export challenge:', error);
    return NextResponse.json(
      { error: 'Failed to generate challenge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bank/wallets/[id]/export
 * Export private key after signature verification
 * Requires: { signature: string } - base58 encoded signature of the challenge
 */
export async function POST(
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

    const { signature } = body;
    if (!signature) {
      return NextResponse.json(
        { error: 'Signature is required' },
        { status: 400 }
      );
    }

    // Get the stored challenge
    const challengeKey = `${userWallet}:${id}`;
    const storedChallenge = challenges.get(challengeKey);

    if (!storedChallenge) {
      return NextResponse.json(
        { error: 'No active challenge found. Please request a new challenge first.' },
        { status: 400 }
      );
    }

    // Check if challenge has expired
    if (Date.now() - storedChallenge.timestamp > CHALLENGE_EXPIRY_MS) {
      challenges.delete(challengeKey);
      return NextResponse.json(
        { error: 'Challenge has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify the signature
    try {
      const publicKeyBytes = new PublicKey(userWallet).toBytes();
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(storedChallenge.challenge);

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature. Please sign the exact challenge message.' },
          { status: 401 }
        );
      }
    } catch (sigError) {
      console.error('Signature verification error:', sigError);
      return NextResponse.json(
        { error: 'Failed to verify signature', details: sigError instanceof Error ? sigError.message : 'Unknown error' },
        { status: 400 }
      );
    }

    // Remove the used challenge (single use)
    challenges.delete(challengeKey);

    // Fetch the wallet
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

    // Verify ownership one more time
    if (wallet.userWallet !== userWallet) {
      return NextResponse.json(
        { error: 'Not authorized to export this wallet' },
        { status: 403 }
      );
    }

    // Decrypt the private key
    let privateKeyBytes: Uint8Array;
    try {
      privateKeyBytes = decryptPrivateKey(wallet.encryptedPrivateKey, userWallet);
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt private key', details: decryptError instanceof Error ? decryptError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Convert to base58 (standard Solana private key format)
    const privateKeyBase58 = bs58.encode(privateKeyBytes);

    // Log the export event (without the key)
    console.log(`Private key exported for wallet ${id} (${wallet.address}) by user ${userWallet}`);

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        name: wallet.name
      },
      privateKey: privateKeyBase58,
      format: 'base58',
      warning: 'This is your wallet\'s private key. Anyone with this key has FULL CONTROL of your wallet. Store it securely and NEVER share it.'
    });

  } catch (error) {
    console.error('Error exporting private key:', error);
    return NextResponse.json(
      { error: 'Failed to export private key', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
