/**
 * Service for fetching and managing block data using existing Solana APIs
 */

import { getBlockDetails, BlockDetails } from '@/lib/solana';
import { getConnection } from '@/lib/solana-connection-server';

export interface BlockListResponse {
  blocks: BlockDetails[];
  hasMore: boolean;
  cursor?: number;
}

/**
 * Get recent blocks from the Solana blockchain
 * @param limit Number of blocks to fetch
 * @param fromSlot Starting slot number (optional)
 * @returns Promise containing blocks data
 */
export async function getRecentBlocks(limit: number = 50, fromSlot?: number): Promise<BlockListResponse> {
  try {
    const connection = await getConnection();
    const currentSlot = await connection.getSlot();

    // If no starting slot provided, use current slot
    const startSlot = fromSlot || currentSlot;

    // Fetch blocks sequentially to avoid overwhelming the RPC
    const blocks: BlockDetails[] = [];
    const maxRetries = 3;

    for (let i = 0; i < limit; i++) {
      const slot = startSlot - i;

      // Don't go too far back to avoid old/unavailable blocks
      if (slot < currentSlot - 1000) {
        break;
      }

      let retryCount = 0;
      let blockDetails: BlockDetails | null = null;

      while (retryCount < maxRetries && !blockDetails) {
        try {
          blockDetails = await getBlockDetails(slot);
          if (blockDetails) {
            blocks.push(blockDetails);
          }
          break;
        } catch (error: any) {
          retryCount++;
          console.warn(`Failed to fetch block ${slot}, attempt ${retryCount}:`, error.message);

          // Skip this block if we've exceeded retries
          if (retryCount >= maxRetries) {
            console.warn(`Skipping block ${slot} after ${maxRetries} failed attempts`);
            break;
          }

          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
        }
      }
    }

    // Sort blocks by slot in descending order
    blocks.sort((a, b) => b.slot - a.slot);

    return {
      blocks,
      hasMore: blocks.length === limit && startSlot - limit > currentSlot - 1000,
      cursor: blocks.length > 0 ? blocks[blocks.length - 1].slot : undefined
    };
  } catch (error) {
    console.error('Error fetching recent blocks:', error);
    throw new Error('Failed to fetch recent blocks');
  }
}

/**
 * Get block statistics for summary display
 * @returns Promise containing block stats
 */
export async function getBlockStats(): Promise<{
  currentSlot: number;
  avgBlockTime: number;
  recentTPS: number;
  totalTransactions: number;
}> {
  try {
    const connection = await getConnection();
    const currentSlot = await connection.getSlot();

    // Get recent performance samples
    const performance = await connection.getRecentPerformanceSamples(5);

    if (performance.length === 0) {
      return {
        currentSlot,
        avgBlockTime: 0.4, // Default Solana block time
        recentTPS: 0,
        totalTransactions: 0
      };
    }

    // Calculate averages from performance samples
    const avgBlockTime = performance.reduce((sum, sample) => sum + sample.samplePeriodSecs, 0) / performance.length;
    const recentTPS = performance.reduce((sum, sample) => sum + (sample.numTransactions / sample.samplePeriodSecs), 0) / performance.length;
    const totalTransactions = performance.reduce((sum, sample) => sum + sample.numTransactions, 0);

    return {
      currentSlot,
      avgBlockTime: avgBlockTime / performance.length, // Average block time per sample
      recentTPS,
      totalTransactions
    };
  } catch (error) {
    console.error('Error fetching block stats:', error);
    return {
      currentSlot: 0,
      avgBlockTime: 0.4,
      recentTPS: 0,
      totalTransactions: 0
    };
  }
}

/**
 * Search for blocks by slot range
 * @param startSlot Starting slot
 * @param endSlot Ending slot
 * @returns Promise containing matching blocks
 */
export async function searchBlocksBySlotRange(startSlot: number, endSlot: number): Promise<BlockDetails[]> {
  try {
    const blocks: BlockDetails[] = [];
    const range = Math.abs(endSlot - startSlot);

    // Limit search range to prevent overwhelming the API
    if (range > 100) {
      throw new Error('Slot range too large. Please limit to 100 blocks or fewer.');
    }

    const minSlot = Math.min(startSlot, endSlot);
    const maxSlot = Math.max(startSlot, endSlot);

    for (let slot = minSlot; slot <= maxSlot; slot++) {
      try {
        const blockDetails = await getBlockDetails(slot);
        if (blockDetails) {
          blocks.push(blockDetails);
        }
      } catch (error) {
        console.warn(`Failed to fetch block ${slot}:`, error);
        // Continue with other blocks
      }
    }

    return blocks.sort((a, b) => b.slot - a.slot);
  } catch (error) {
    console.error('Error searching blocks:', error);
    throw new Error('Failed to search blocks by slot range');
  }
}

/**
 * Get blocks with highest transaction counts
 * @param limit Number of blocks to return
 * @param lookbackSlots Number of slots to look back from current
 * @returns Promise containing blocks with highest transaction counts
 */
export async function getHighActivityBlocks(limit: number = 20, lookbackSlots: number = 500): Promise<BlockDetails[]> {
  try {
    const recentBlocksResponse = await getRecentBlocks(lookbackSlots);
    const blocks = recentBlocksResponse.blocks;

    // Sort by transaction count and return top blocks
    return blocks
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching high activity blocks:', error);
    throw new Error('Failed to fetch high activity blocks');
  }
}