/**
 * User Profile Statistics Synchronization API
 * Provides endpoints for repairing and synchronizing user profile statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { validateWalletAddress } from '@/lib/user/user-history-utils';
import { checkQdrantHealth } from '@/lib/search/qdrant';
import {

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;

  syncUserProfileStats,
  batchSyncUserProfileStats,
  repairAllUserProfiles,
  autoSyncPopularProfiles,
  needsStatsSync
} from '@/lib/maintenance/user-stats-sync';

/**
 * POST /api/user-profile/sync
 * Synchronize specific user profiles or run system-wide repairs
 */
export async function POST(request: NextRequest) {
  try {
    // Check Qdrant health first
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const { action, walletAddress, walletAddresses } = body;

    switch (action) {
      case 'sync-profile':
        if (!walletAddress) {
          return NextResponse.json({ error: 'walletAddress required for sync-profile' }, { status: 400 });
        }

        const validatedAddress = validateWalletAddress(walletAddress);
        if (!validatedAddress) {
          return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }

        const syncedProfile = await syncUserProfileStats(validatedAddress);
        if (!syncedProfile) {
          return NextResponse.json({ error: 'Profile not found or sync failed' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: 'Profile stats synchronized',
          profile: syncedProfile
        });

      case 'batch-sync':
        if (!walletAddresses || !Array.isArray(walletAddresses)) {
          return NextResponse.json({ error: 'walletAddresses array required for batch-sync' }, { status: 400 });
        }

        const validatedAddresses = walletAddresses
          .map(addr => validateWalletAddress(addr))
          .filter(addr => addr) as string[];

        if (validatedAddresses.length === 0) {
          return NextResponse.json({ error: 'No valid wallet addresses provided' }, { status: 400 });
        }

        await batchSyncUserProfileStats(validatedAddresses);

        return NextResponse.json({
          success: true,
          message: `Batch synchronized ${validatedAddresses.length} profiles`,
          processedCount: validatedAddresses.length
        });

      case 'repair-all':
        // This is a potentially expensive operation, so we might want to restrict it
        try {
          const session = await getSessionFromCookie();
          if (!session) {
            return NextResponse.json({ error: 'Authentication required for repair-all operation' }, { status: 401 });
          }
        } catch {
          return NextResponse.json({ error: 'Authentication required for repair-all operation' }, { status: 401 });
        }

        const repairResults = await repairAllUserProfiles();

        return NextResponse.json({
          success: true,
          message: 'Repair completed',
          results: repairResults
        });

      case 'auto-sync-popular':
        await autoSyncPopularProfiles();

        return NextResponse.json({
          success: true,
          message: 'Auto-sync of popular profiles completed'
        });

      case 'check-sync-needed':
        if (!walletAddress) {
          return NextResponse.json({ error: 'walletAddress required for check-sync-needed' }, { status: 400 });
        }

        const validatedCheckAddress = validateWalletAddress(walletAddress);
        if (!validatedCheckAddress) {
          return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
        }

        const maxAge = body.maxAge || 5 * 60 * 1000; // 5 minutes default
        const syncNeeded = await needsStatsSync(validatedCheckAddress, maxAge);

        return NextResponse.json({
          success: true,
          walletAddress: validatedCheckAddress,
          syncNeeded: syncNeeded
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: sync-profile, batch-sync, repair-all, auto-sync-popular, check-sync-needed' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in user profile sync API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/user-profile/sync
 * Get sync status and statistics
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
      // Get sync status for specific wallet
      const validatedAddress = validateWalletAddress(walletAddress);
      if (!validatedAddress) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
      }

      const syncNeeded = await needsStatsSync(validatedAddress);

      return NextResponse.json({
        walletAddress: validatedAddress,
        syncNeeded: syncNeeded,
        timestamp: Date.now()
      });
    }

    // Return general sync system status
    return NextResponse.json({
      status: 'operational',
      timestamp: Date.now(),
      supportedActions: [
        'sync-profile',
        'batch-sync', 
        'repair-all',
        'auto-sync-popular',
        'check-sync-needed'
      ]
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
