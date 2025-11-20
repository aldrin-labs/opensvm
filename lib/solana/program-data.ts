/**
 * Service for fetching and managing program activity data using existing Solana APIs
 */

import { getBlockDetails } from '@/lib/solana/solana';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { ProgramActivity } from '@/components/ProgramActivityTable';

export interface ProgramListResponse {
  programs: ProgramActivity[];
  hasMore: boolean;
  cursor?: string;
}

/**
 * Get program activity from recent blocks
 * @param limit Number of programs to return
 * @param lookbackBlocks Number of recent blocks to analyze
 * @returns Promise containing program activity data
 */
export async function getProgramActivity(limit: number = 50, lookbackBlocks: number = 200): Promise<ProgramListResponse> {
  try {
    const connection = await getConnection();
    const currentSlot = await connection.getSlot();

    // Track program activity across recent blocks
    const programStats = new Map<string, {
      totalCalls: number;
      txCount: number;
      blockCount: number;
      lastActive: Date;
      blockSlots: Set<number>;
    }>();

    const processedBlocks = 0;

    // Use processedBlocks for progress tracking and metrics
    console.log(`Program data analysis starting with ${processedBlocks} blocks processed so far`);
    const blockProcessingStats = {
      initial: processedBlocks,
      target: 1000, // Example target
      progress: (processedBlocks / 1000) * 100
    };
    console.log(`Processing progress: ${blockProcessingStats.progress.toFixed(1)}%`);
    const maxConcurrent = 5; // Limit concurrent requests

    // Process blocks in batches to avoid overwhelming the RPC
    for (let batchStart = 0; batchStart < lookbackBlocks; batchStart += maxConcurrent) {
      const batchEnd = Math.min(batchStart + maxConcurrent, lookbackBlocks);
      const batchPromises: Promise<void>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const slot = currentSlot - i;

        if (slot < currentSlot - 1000) break; // Don't go too far back

        batchPromises.push(
          (async () => {
            try {
              const blockDetails = await getBlockDetails(slot);
              if (!blockDetails || !blockDetails.programs) return;

              const blockTime = blockDetails.blockTime ? new Date(blockDetails.blockTime * 1000) : new Date();

              // Process each program in this block
              blockDetails.programs.forEach(program => {
                const existing = programStats.get(program.address) || {
                  totalCalls: 0,
                  txCount: 0,
                  blockCount: 0,
                  lastActive: new Date(0),
                  blockSlots: new Set<number>()
                };

                existing.totalCalls += program.count;
                existing.txCount += program.count; // Each call is typically a transaction
                existing.blockSlots.add(slot);
                existing.blockCount = existing.blockSlots.size;

                if (blockTime > existing.lastActive) {
                  existing.lastActive = blockTime;
                }

                programStats.set(program.address, existing);
              });
            } catch (error) {
              console.warn(`Failed to process block ${slot}:`, error);
            }
          })()
        );
      }

      // Wait for this batch to complete before starting the next
      await Promise.all(batchPromises);

      // Add a small delay between batches to be respectful to the RPC
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Convert to ProgramActivity array and calculate additional metrics
    const programs: ProgramActivity[] = Array.from(programStats.entries())
      .map(([address, stats]) => ({
        address,
        name: getProgramName(address),
        txCount: stats.txCount,
        blockCount: stats.blockCount,
        avgCallsPerBlock: stats.blockCount > 0 ? stats.totalCalls / stats.blockCount : 0,
        totalCalls: stats.totalCalls,
        lastActive: stats.lastActive,
        type: getProgramType(address)
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, limit);

    return {
      programs,
      hasMore: programStats.size > limit,
      cursor: programs.length > 0 ? `${programs[programs.length - 1].totalCalls}` : undefined
    };
  } catch (error) {
    console.error('Error fetching program activity:', error);
    throw new Error('Failed to fetch program activity');
  }
}

/**
 * Get top programs by different metrics
 * @param metric Sorting metric
 * @param limit Number of programs to return
 * @returns Promise containing top programs
 */
export async function getTopPrograms(
  metric: 'calls' | 'transactions' | 'blocks' = 'calls',
  limit: number = 20
): Promise<ProgramActivity[]> {
  try {
    const response = await getProgramActivity(100); // Get more to have better selection

    let sortedPrograms: ProgramActivity[];

    switch (metric) {
      case 'transactions':
        sortedPrograms = response.programs.sort((a, b) => b.txCount - a.txCount);
        break;
      case 'blocks':
        sortedPrograms = response.programs.sort((a, b) => b.blockCount - a.blockCount);
        break;
      case 'calls':
      default:
        sortedPrograms = response.programs.sort((a, b) => b.totalCalls - a.totalCalls);
        break;
    }

    return sortedPrograms.slice(0, limit);
  } catch (error) {
    console.error('Error fetching top programs:', error);
    throw new Error('Failed to fetch top programs');
  }
}

/**
 * Get program statistics summary
 * @returns Promise containing program statistics
 */
export async function getProgramStats(): Promise<{
  totalActivePrograms: number;
  totalCalls: number;
  avgCallsPerProgram: number;
  topProgramTypes: { type: string; count: number }[];
}> {
  try {
    const response = await getProgramActivity(200); // Get more programs for better stats
    const programs = response.programs;

    const totalActivePrograms = programs.length;
    const totalCalls = programs.reduce((sum, p) => sum + p.totalCalls, 0);
    const avgCallsPerProgram = totalActivePrograms > 0 ? totalCalls / totalActivePrograms : 0;

    // Count program types
    const typeCounts = new Map<string, number>();
    programs.forEach(program => {
      const type = program.type || 'Custom';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const topProgramTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalActivePrograms,
      totalCalls,
      avgCallsPerProgram,
      topProgramTypes
    };
  } catch (error) {
    console.error('Error fetching program stats:', error);
    return {
      totalActivePrograms: 0,
      totalCalls: 0,
      avgCallsPerProgram: 0,
      topProgramTypes: []
    };
  }
}

/**
 * Get name for known programs
 * @param address Program address
 * @returns Program name or undefined
 */
function getProgramName(address: string): string | undefined {
  const knownPrograms: Record<string, string> = {
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account Program',
    '11111111111111111111111111111111': 'System Program',
    'ComputeBudget111111111111111111111111111111': 'Compute Budget Program',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter Aggregator',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Whirlpool',
    'srmqPiKJxfFFv8VWKhMBCQa8K5B4KS4qUhaDZAmXcF': 'Serum DEX',
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Serum DEX v3',
    'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca',
    'CAMMCzo5YL8w4VFF8KVHrK22GGUQzaMVMDC6sqWhq8iQ': 'Raydium CLAMM',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
    'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': 'Solend',
    'LendZqTs7gn5CTSJU1jWKhKuVpjJGom45nnwPb2AMTi': 'Port Finance',
    'METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr': 'Metaplex Token Metadata',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metaplex Auction House'
  };

  return knownPrograms[address];
}

/**
 * Get program type category
 * @param address Program address
 * @returns Program type
 */
function getProgramType(address: string): string {
  const programTypes: Record<string, string> = {
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'System',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'System',
    '11111111111111111111111111111111': 'System',
    'ComputeBudget111111111111111111111111111111': 'System',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'DEX',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'DEX',
    'srmqPiKJxfFFv8VWKhMBCQa8K5B4KS4qUhaDZAmXcF': 'DEX',
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'DEX',
    'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'DEX',
    'CAMMCzo5YL8w4VFF8KVHrK22GGUQzaMVMDC6sqWhq8iQ': 'DEX',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'DEX',
    'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': 'Lending',
    'LendZqTs7gn5CTSJU1jWKhKuVpjJGom45nnwPb2AMTi': 'Lending',
    'METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr': 'NFT',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'NFT'
  };

  return programTypes[address] || 'Custom';
}