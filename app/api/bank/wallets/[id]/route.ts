import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { decryptPrivateKey, reencryptPrivateKey } from '@/lib/bank/encryption';
import bs58 from 'bs58';

const COLLECTION_NAME = 'svm_bank_wallets';

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

/**
 * GET /api/bank/wallets/[id]
 * Get a specific wallet by ID
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

    // Fetch the wallet from Qdrant
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
        { error: 'Not authorized to access this wallet' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        address: wallet.address,
        name: wallet.name,
        createdAt: wallet.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bank/wallets/[id]
 * Update a wallet (rename, migrate encryption, etc.)
 */
export async function PATCH(
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

    // Validate update fields
    const { name, migrateEncryption } = body;
    if (!name && !migrateEncryption) {
      return NextResponse.json(
        { error: 'No update fields provided. Supported: name, migrateEncryption' },
        { status: 400 }
      );
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Invalid wallet name' },
          { status: 400 }
        );
      }
      if (name.length > 50) {
        return NextResponse.json(
          { error: 'Wallet name too long (max 50 characters)' },
          { status: 400 }
        );
      }
    }

    // Fetch the existing wallet
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
        { error: 'Not authorized to update this wallet' },
        { status: 403 }
      );
    }

    // Build updated payload
    const updatedPayload: WalletPayload = { ...wallet };

    if (name) {
      updatedPayload.name = name.trim();
    }

    // Optionally migrate to v2 encryption format
    if (migrateEncryption) {
      try {
        updatedPayload.encryptedPrivateKey = reencryptPrivateKey(
          wallet.encryptedPrivateKey,
          userWallet
        );
      } catch (encryptError) {
        return NextResponse.json(
          { error: 'Failed to migrate encryption', details: encryptError instanceof Error ? encryptError.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    // Update in Qdrant
    await qdrantClient.setPayload(COLLECTION_NAME, {
      payload: updatedPayload,
      points: [id]
    });

    console.log(`Updated wallet ${id} for user ${userWallet}`);

    return NextResponse.json({
      success: true,
      wallet: {
        id: updatedPayload.id,
        address: updatedPayload.address,
        name: updatedPayload.name,
        createdAt: updatedPayload.createdAt
      },
      encryptionMigrated: !!migrateEncryption
    });

  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bank/wallets/[id]
 * Delete a wallet permanently
 */
export async function DELETE(
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

    // Fetch the wallet first to verify ownership
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
        { error: 'Not authorized to delete this wallet' },
        { status: 403 }
      );
    }

    // Delete from Qdrant
    await qdrantClient.delete(COLLECTION_NAME, {
      points: [id]
    });

    console.log(`Deleted wallet ${id} (${wallet.address}) for user ${userWallet}`);

    return NextResponse.json({
      success: true,
      message: 'Wallet deleted successfully',
      deletedWallet: {
        id: wallet.id,
        address: wallet.address,
        name: wallet.name
      }
    });

  } catch (error) {
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { error: 'Failed to delete wallet', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
