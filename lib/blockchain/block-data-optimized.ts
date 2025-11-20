/**
 * Optimized service for fetching and managing block data
 * Implements parallel fetching, caching, and connection pooling
 */

import { getBlockDetails, BlockDetails } from '@/lib/solana/solana';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { getRpcPool } from '@/lib/solana/rpc/rpc-pool';
import { cache } from '@/lib/caching/cache';

// Cache TTL for blocks (blocks are immutable, so we can cache them for a long time)
const BLOCK_CACHE_TTL = 3600; // 1 hour TTL

// Batch size for parallel fetching
const BATCH_SIZE = 10;

export interface BlockListResponse {
  blocks: BlockDetails[];
  hasMore: boolean;
  cursor?: number;
}

/**
 * Get block details with caching
 */
async function getCachedBlockDetails(slot: number): Promise<BlockDetails | null> {
  const cacheKey = `block:${slot}`;
  
  // Try to get from cache first
  const cached = await cache.get<BlockDetails>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from chain
  try {
    const blockDetails = await getBlockDetails(slot);
    
    // Cache the result if successful
    if (blockDetails) {
      await cache.set(cacheKey, blockDetails, BLOCK_CACHE_TTL);
    }
    
    return blockDetails;
  } catch (error) {
    console.warn(`Failed to fetch block ${slot}:`, error);
    return null;
  }
}

/**
 * Fetch blocks in parallel batches
 */
async function fetchBlocksBatch(slots: number[]): Promise<(BlockDetails | null)[]> {
  const pool = getRpcPool();
  
  // Use the pool's batch execution for parallel fetching
  const promises = slots.map(slot => getCachedBlockDetails(slot));
  
  // Execute in parallel with Promise.allSettled to handle failures gracefully
  const results = await Promise.allSettled(promises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.warn(`Failed to fetch block ${slots[index]}:`, result.reason);
      return null;
    }
  });
}

/**
 * Optimized version of getRecentBlocks using parallel fetching and caching
 */
export async function getRecentBlocksOptimized(
  limit: number = 50, 
  fromSlot?: number
): Promise<BlockListResponse> {
  try {
    const connection = getConnection();
    const currentSlot = await connection.getSlot();

    // If no starting slot provided, use current slot
    const startSlot = fromSlot || currentSlot;

    // Calculate slots to fetch
    const slotsToFetch: number[] = [];
    for (let i = 0; i < limit; i++) {
      const slot = startSlot - i;
      
      // Don't go too far back to avoid old/unavailable blocks
      if (slot < currentSlot - 1000) {
        break;
      }
      
      slotsToFetch.push(slot);
    }

    // Fetch blocks in parallel batches
    const blocks: BlockDetails[] = [];
    
    for (let i = 0; i < slotsToFetch.length; i += BATCH_SIZE) {
      const batchSlots = slotsToFetch.slice(i, i + BATCH_SIZE);
      const batchResults = await fetchBlocksBatch(batchSlots);
      
      // Filter out null results and add to blocks array
      const validBlocks = batchResults.filter((block): block is BlockDetails => block !== null);
      blocks.push(...validBlocks);
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
 * Get recent blocks from the Solana blockchain (fallback to original implementation)
 */
export async function getRecentBlocks(limit: number = 50, fromSlot?: number): Promise<BlockListResponse> {
  // Try the optimized version first
  try {
    return await getRecentBlocksOptimized(limit, fromSlot);
  } catch (error) {
    console.error('Optimized fetch failed, falling back to sequential:', error);
    // Fall back to the original sequential implementation if needed
    return getRecentBlocksSequential(limit, fromSlot);
  }
}

/**
 * Original sequential implementation as fallback
 */
async function getRecentBlocksSequential(limit: number = 50, fromSlot?: number): Promise<BlockListResponse> {
  try {
    const connection = getConnection();
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
          blockDetails = await getCachedBlockDetails(slot);
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
 */
export async function getBlockStats(): Promise<{
  currentSlot: number;
  avgBlockTime: number;
  recentTPS: number;
  totalTransactions: number;
}> {
  try {
    const connection = getConnection();
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
 * Search for blocks by slot range (optimized with parallel fetching)
 */
export async function searchBlocksBySlotRange(startSlot: number, endSlot: number): Promise<BlockDetails[]> {
  try {
    const range = Math.abs(endSlot - startSlot);

    // Limit search range to prevent overwhelming the API
    if (range > 100) {
      throw new Error('Slot range too large. Please limit to 100 blocks or fewer.');
    }

    const minSlot = Math.min(startSlot, endSlot);
    const maxSlot = Math.max(startSlot, endSlot);

    // Create array of slots to fetch
    const slots: number[] = [];
    for (let slot = minSlot; slot <= maxSlot; slot++) {
      slots.push(slot);
    }

    // Fetch in parallel batches
    const blocks: BlockDetails[] = [];
    
    for (let i = 0; i < slots.length; i += BATCH_SIZE) {
      const batchSlots = slots.slice(i, i + BATCH_SIZE);
      const batchResults = await fetchBlocksBatch(batchSlots);
      
      // Filter out null results and add to blocks array
      const validBlocks = batchResults.filter((block): block is BlockDetails => block !== null);
      blocks.push(...validBlocks);
    }

    return blocks.sort((a, b) => b.slot - a.slot);
  } catch (error) {
    console.error('Error searching blocks:', error);
    throw new Error('Failed to search blocks by slot range');
  }
}

/**
 * Get blocks with highest transaction counts (using cache)
 */
export async function getHighActivityBlocks(limit: number = 20, lookbackSlots: number = 500): Promise<BlockDetails[]> {
  try {
    // Use optimized version with smaller batches for efficiency
    const recentBlocksResponse = await getRecentBlocksOptimized(Math.min(lookbackSlots, 100));
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
