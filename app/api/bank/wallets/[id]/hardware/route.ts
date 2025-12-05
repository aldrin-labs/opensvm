import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

const COLLECTION_NAME = 'svm_bank_wallets';

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
  hardwareWalletPubkey?: string;
  requiresHardwareSignature?: boolean;
  hardwareLinkedAt?: number;
}

// In-memory store for linking challenges
const linkingChallenges = new Map<string, { challenge: string; timestamp: number; hardwarePubkey: string }>();
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/bank/wallets/[id]/hardware
 * Get hardware wallet status for a managed wallet
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

    return NextResponse.json({
      walletId: wallet.id,
      walletAddress: wallet.address,
      walletName: wallet.name,
      hardwareLinked: !!wallet.hardwareWalletPubkey,
      hardwareWalletPubkey: wallet.hardwareWalletPubkey || null,
      requiresHardwareSignature: wallet.requiresHardwareSignature || false,
      hardwareLinkedAt: wallet.hardwareLinkedAt || null
    });

  } catch (error) {
    console.error('Error getting hardware status:', error);
    return NextResponse.json(
      { error: 'Failed to get hardware wallet status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bank/wallets/[id]/hardware
 * Link or update hardware wallet for 2-of-2 multisig
 *
 * Step 1: { action: 'initiate', hardwarePubkey: string } - Get challenge
 * Step 2: { action: 'confirm', signature: string } - Confirm with HW signature
 * Step 3: { action: 'unlink' } - Remove hardware wallet (requires HW signature)
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
    const { action, hardwarePubkey, signature } = body;

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

    if (action === 'initiate') {
      // Step 1: Initiate hardware wallet linking
      if (!hardwarePubkey) {
        return NextResponse.json(
          { error: 'Hardware wallet public key required' },
          { status: 400 }
        );
      }

      // Validate pubkey
      try {
        new PublicKey(hardwarePubkey);
      } catch {
        return NextResponse.json(
          { error: 'Invalid hardware wallet public key' },
          { status: 400 }
        );
      }

      // Check if already linked to a different hardware wallet
      if (wallet.hardwareWalletPubkey && wallet.hardwareWalletPubkey !== hardwarePubkey) {
        return NextResponse.json(
          { error: 'Wallet is already linked to a different hardware wallet. Unlink first.' },
          { status: 400 }
        );
      }

      // Generate challenge
      const timestamp = Date.now();
      const nonce = bs58.encode(nacl.randomBytes(32));
      const challenge = `SVM Bank Hardware Wallet Link\n\nManaged Wallet: ${wallet.address}\nHardware Wallet: ${hardwarePubkey}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to enable 2-of-2 multisig protection for your managed wallet.`;

      // Store challenge
      const challengeKey = `${userWallet}:${id}:hw`;
      linkingChallenges.set(challengeKey, {
        challenge,
        timestamp,
        hardwarePubkey
      });

      // Clean up old challenges
      const now = Date.now();
      const keysToDelete: string[] = [];
      linkingChallenges.forEach((value, key) => {
        if (now - value.timestamp > CHALLENGE_EXPIRY_MS) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => linkingChallenges.delete(key));

      return NextResponse.json({
        challenge,
        expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
        hardwarePubkey,
        message: 'Sign this challenge with your hardware wallet to complete linking'
      });

    } else if (action === 'confirm') {
      // Step 2: Confirm with hardware wallet signature
      if (!signature) {
        return NextResponse.json(
          { error: 'Signature required' },
          { status: 400 }
        );
      }

      const challengeKey = `${userWallet}:${id}:hw`;
      const storedChallenge = linkingChallenges.get(challengeKey);

      if (!storedChallenge) {
        return NextResponse.json(
          { error: 'No active challenge. Please initiate linking first.' },
          { status: 400 }
        );
      }

      // Check expiry
      if (Date.now() - storedChallenge.timestamp > CHALLENGE_EXPIRY_MS) {
        linkingChallenges.delete(challengeKey);
        return NextResponse.json(
          { error: 'Challenge expired. Please initiate again.' },
          { status: 400 }
        );
      }

      // Verify signature
      try {
        const publicKeyBytes = new PublicKey(storedChallenge.hardwarePubkey).toBytes();
        const signatureBytes = bs58.decode(signature);
        const messageBytes = new TextEncoder().encode(storedChallenge.challenge);

        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }
      } catch (sigError) {
        return NextResponse.json(
          { error: 'Failed to verify signature', details: sigError instanceof Error ? sigError.message : 'Unknown' },
          { status: 400 }
        );
      }

      // Remove challenge
      linkingChallenges.delete(challengeKey);

      // Update wallet with hardware wallet info
      const updatedPayload: WalletPayload = {
        ...wallet,
        hardwareWalletPubkey: storedChallenge.hardwarePubkey,
        requiresHardwareSignature: true,
        hardwareLinkedAt: Date.now()
      };

      await qdrantClient.setPayload(COLLECTION_NAME, {
        payload: updatedPayload,
        points: [id]
      });

      console.log(`Hardware wallet ${storedChallenge.hardwarePubkey} linked to managed wallet ${wallet.address}`);

      return NextResponse.json({
        success: true,
        message: 'Hardware wallet linked successfully',
        hardwareWalletPubkey: storedChallenge.hardwarePubkey,
        requiresHardwareSignature: true
      });

    } else if (action === 'unlink') {
      // Step 3: Unlink hardware wallet (requires current HW signature)
      if (!wallet.hardwareWalletPubkey) {
        return NextResponse.json(
          { error: 'No hardware wallet linked' },
          { status: 400 }
        );
      }

      if (!signature) {
        // Generate unlink challenge
        const timestamp = Date.now();
        const nonce = bs58.encode(nacl.randomBytes(32));
        const challenge = `SVM Bank Hardware Wallet Unlink\n\nManaged Wallet: ${wallet.address}\nHardware Wallet: ${wallet.hardwareWalletPubkey}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to remove 2-of-2 multisig protection. WARNING: This reduces your wallet security.`;

        const challengeKey = `${userWallet}:${id}:hw:unlink`;
        linkingChallenges.set(challengeKey, {
          challenge,
          timestamp,
          hardwarePubkey: wallet.hardwareWalletPubkey
        });

        return NextResponse.json({
          challenge,
          expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
          message: 'Sign this challenge with your hardware wallet to unlink'
        });
      }

      // Verify unlink signature
      const challengeKey = `${userWallet}:${id}:hw:unlink`;
      const storedChallenge = linkingChallenges.get(challengeKey);

      if (!storedChallenge) {
        return NextResponse.json(
          { error: 'No active unlink challenge' },
          { status: 400 }
        );
      }

      // Verify signature
      try {
        const publicKeyBytes = new PublicKey(wallet.hardwareWalletPubkey).toBytes();
        const signatureBytes = bs58.decode(signature);
        const messageBytes = new TextEncoder().encode(storedChallenge.challenge);

        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Failed to verify signature' },
          { status: 400 }
        );
      }

      linkingChallenges.delete(challengeKey);

      // Remove hardware wallet info
      const updatedPayload: WalletPayload = {
        ...wallet,
        hardwareWalletPubkey: undefined,
        requiresHardwareSignature: false,
        hardwareLinkedAt: undefined
      };

      await qdrantClient.setPayload(COLLECTION_NAME, {
        payload: updatedPayload,
        points: [id]
      });

      console.log(`Hardware wallet unlinked from managed wallet ${wallet.address}`);

      return NextResponse.json({
        success: true,
        message: 'Hardware wallet unlinked successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: initiate, confirm, or unlink' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Hardware wallet operation error:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
