/**
 * User History Repair API
 * Provides endpoints for repairing and maintaining user history and activity data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { validateWalletAddress } from '@/lib/user/user-history-utils';
import { checkQdrantHealth } from '@/lib/search/qdrant';
import {
  repairUserHistory,
  repairAllUserHistories,
  getUserHistoryStatus,
  cleanupOldHistoryEntries
} from '@/lib/maintenance/user-history-repair';

/**
 * POST /api/user-history/repair
 * Repair user history and activity data
 */
export async function POST(request: NextRequest) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const { action, walletAddress, maxAge } = body;

    switch (action) {
      case 'repair-user':
        if (!walletAddress) {
          return NextResponse.json({ error: 'walletAddress required for repair-user' }, { status: 400 });
        }

        const validatedAddress = validateWalletAddress(walletAddress);
        if (!validatedAddress) {
          return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }

        const repairResult = await repairUserHistory(validatedAddress);

        return NextResponse.json({
          success: repairResult.success,
          walletAddress: validatedAddress,
          stats: repairResult.stats,
          repaired: repairResult.repaired,
          errors: repairResult.errors
        });

      case 'repair-all':
        // This is a potentially expensive operation, so we require authentication
        try {
          const session = await getSessionFromCookie();
          if (!session) {
            return NextResponse.json({ error: 'Authentication required for repair-all operation' }, { status: 401 });
          }
        } catch {
          return NextResponse.json({ error: 'Authentication required for repair-all operation' }, { status: 401 });
        }

        const allRepairResults = await repairAllUserHistories();

        return NextResponse.json({
          success: true,
          message: 'Comprehensive history repair completed',
          results: allRepairResults
        });

      case 'cleanup-old':
        if (!walletAddress) {
          return NextResponse.json({ error: 'walletAddress required for cleanup-old' }, { status: 400 });
        }

        const validatedCleanupAddress = validateWalletAddress(walletAddress);
        if (!validatedCleanupAddress) {
          return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }

        const ageLimit = maxAge || 365 * 24 * 60 * 60 * 1000; // Default 1 year
        const cleanupResult = await cleanupOldHistoryEntries(validatedCleanupAddress, ageLimit);

        return NextResponse.json({
          success: true,
          walletAddress: validatedCleanupAddress,
          cleanup: cleanupResult,
          maxAge: ageLimit
        });

      case 'check-status':
        if (!walletAddress) {
          return NextResponse.json({ error: 'walletAddress required for check-status' }, { status: 400 });
        }

        const validatedStatusAddress = validateWalletAddress(walletAddress);
        if (!validatedStatusAddress) {
          return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }

        const status = await getUserHistoryStatus(validatedStatusAddress);

        return NextResponse.json({
          success: true,
          walletAddress: validatedStatusAddress,
          status: status
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: repair-user, repair-all, cleanup-old, check-status' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in user history repair API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/user-history/repair
 * Get repair system status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('walletAddress');

    if (walletAddress) {
      // Get repair status for specific wallet
      const validatedAddress = validateWalletAddress(walletAddress);
      if (!validatedAddress) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
      }

      const status = await getUserHistoryStatus(validatedAddress);

      return NextResponse.json({
        walletAddress: validatedAddress,
        status: status,
        timestamp: Date.now()
      });
    }

    // Return general repair system status
    return NextResponse.json({
      status: 'operational',
      timestamp: Date.now(),
      supportedActions: [
        'repair-user',
        'repair-all',
        'cleanup-old',
        'check-status'
      ],
      description: 'User history repair and maintenance system'
    });

  } catch (error) {
    console.error('Error getting repair status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
