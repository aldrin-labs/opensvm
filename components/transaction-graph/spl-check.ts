'use client';

import { debugLog } from './utils';

/**
 * Check if an account has SPL transfers
 * @param address The account address to check
 * @returns Promise<boolean> indicating if the account has SPL transfers
 */
export async function checkForSplTransfers(address: string): Promise<boolean> {
    debugLog(`🔍 [SPL_CHECK] Starting SPL transfer check for ${address}`);

    try {
        // Add a timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            debugLog(`⏰ [SPL_CHECK] Timeout reached for ${address}, aborting...`);
            controller.abort();
        }, 3000); // 3 second timeout

        debugLog(`🌐 [SPL_CHECK] Making API request for ${address}`);
        const response = await fetch(`/api/account-transfers/${address}?limit=1`, {
            headers: { 'Cache-Control': 'no-cache' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        debugLog(`📡 [SPL_CHECK] API response for ${address}: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            const hasSplTransfers = (data.data && data.data.length > 0);
            debugLog(`✅ [SPL_CHECK] Result for ${address}: ${hasSplTransfers ? 'HAS' : 'NO'} SPL transfers`);
            return hasSplTransfers;
        }

        debugLog(`⚠️ [SPL_CHECK] Non-OK response for ${address}, returning false`);
        return false;
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            debugLog(`⏰ [SPL_CHECK] SPL transfer check timed out for ${address}`);
        } else {
            debugLog(`❌ [SPL_CHECK] Could not check SPL transfers for ${address}:`, error);
        }
        debugLog(`🔄 [SPL_CHECK] Defaulting to false for ${address}`);
        return false; // Default to no SPL transfers on error/timeout
    }
} 