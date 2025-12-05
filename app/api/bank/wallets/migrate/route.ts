import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { reencryptPrivateKey, decryptPrivateKey, encryptPrivateKey } from '@/lib/bank/encryption';

const COLLECTION_NAME = 'svm_bank_wallets';

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
  encryptionVersion?: number;
}

/**
 * Detect encryption version from encrypted data
 * V2 format starts with version byte (0x02)
 * V1 format starts with IV (random bytes)
 */
function detectEncryptionVersion(encryptedData: string): number {
  try {
    const combined = Buffer.from(encryptedData, 'base64');
    // V2 format: VERSION(1) + SALT(64) + IV(16) + CIPHERTEXT + TAG(16)
    // Minimum v2 size: 1 + 64 + 16 + 1 + 16 = 98 bytes
    if (combined.length >= 98) {
      const versionByte = combined.readUInt8(0);
      if (versionByte === 2) {
        return 2;
      }
    }
    return 1;
  } catch {
    return 1;
  }
}

/**
 * POST /api/bank/wallets/migrate
 * Migrate all user's wallets from v1 to v2 encryption format
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

    if (results.points.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wallets found to migrate',
        migrated: 0,
        alreadyV2: 0,
        failed: 0
      });
    }

    let migrated = 0;
    let alreadyV2 = 0;
    let failed = 0;
    const errors: Array<{ walletId: string; error: string }> = [];

    for (const point of results.points) {
      const wallet = point.payload as WalletPayload;

      // Check current encryption version
      const currentVersion = detectEncryptionVersion(wallet.encryptedPrivateKey);

      if (currentVersion === 2) {
        alreadyV2++;
        continue;
      }

      try {
        // Re-encrypt with v2 format
        const newEncryptedKey = reencryptPrivateKey(
          wallet.encryptedPrivateKey,
          userWallet
        );

        // Verify the new encryption works
        const decrypted = decryptPrivateKey(newEncryptedKey, userWallet);
        if (decrypted.length !== 64) {
          throw new Error('Decryption verification failed: unexpected key length');
        }

        // Update in Qdrant
        const updatedPayload: WalletPayload = {
          ...wallet,
          encryptedPrivateKey: newEncryptedKey,
          encryptionVersion: 2
        };

        await qdrantClient.setPayload(COLLECTION_NAME, {
          payload: updatedPayload,
          points: [wallet.id]
        });

        migrated++;
        console.log(`Migrated wallet ${wallet.id} (${wallet.address}) to v2 encryption`);

      } catch (error) {
        failed++;
        errors.push({
          walletId: wallet.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Failed to migrate wallet ${wallet.id}:`, error);
      }
    }

    return NextResponse.json({
      success: failed === 0,
      message: `Migration complete: ${migrated} migrated, ${alreadyV2} already on v2, ${failed} failed`,
      migrated,
      alreadyV2,
      failed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/wallets/migrate
 * Check migration status for all user's wallets
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

    if (results.points.length === 0) {
      return NextResponse.json({
        total: 0,
        v1Count: 0,
        v2Count: 0,
        needsMigration: false,
        wallets: []
      });
    }

    const walletStatus = results.points.map((point: any) => {
      const wallet = point.payload as WalletPayload;
      const version = detectEncryptionVersion(wallet.encryptedPrivateKey);

      return {
        id: wallet.id,
        address: wallet.address,
        name: wallet.name,
        encryptionVersion: version
      };
    });

    const v1Count = walletStatus.filter(w => w.encryptionVersion === 1).length;
    const v2Count = walletStatus.filter(w => w.encryptionVersion === 2).length;

    return NextResponse.json({
      total: walletStatus.length,
      v1Count,
      v2Count,
      needsMigration: v1Count > 0,
      wallets: walletStatus
    });

  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
