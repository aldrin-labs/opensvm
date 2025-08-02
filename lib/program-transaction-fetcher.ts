/**
 * Program Transaction Fetcher Service
 * 
 * This service provides functionality to fetch transactions by program ID,
 * with support for filtering, pagination, and enhanced metadata.
 */

import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedTransactionWithMeta } from '@solana/web3.js';

// Use ParsedTransactionWithMeta for type validation and transaction processing
type ValidatedTransaction = ParsedTransactionWithMeta;

// Helper function to validate transaction structure using ValidatedTransaction
function isValidTransaction(tx: any): tx is ValidatedTransaction {
  return tx && typeof tx === 'object' && tx.transaction && tx.meta;
}
import { getConnection } from './solana-connection';
import { enhancedTransactionFetcher, type EnhancedTransactionData } from './enhanced-transaction-fetcher';
import { programTransactionCache } from './program-transaction-cache';

export interface ProgramTransactionFilter {
  programId: string;
  limit?: number;
  before?: string;
  until?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  includeFailed?: boolean;
  minSlot?: number;
  maxSlot?: number;
}

export interface ProgramTransactionResult {
  transactions: EnhancedTransactionData[];
  hasMore: boolean;
  oldestSignature?: string;
  newestSignature?: string;
  totalFetched: number;
  programId: string;
  fetchTime: number;
}

export interface ProgramTransactionStats {
  programId: string;
  totalTransactions: number;
  recentTransactions: number;
  uniqueAccounts: number;
  uniquePrograms: number;
  averageFee: number;
  totalFees: number;
  lastActivity: number | null;
  firstActivity: number | null;
}

export class ProgramTransactionFetcher {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || null as any;
  }

  private async init() {
    if (!this.connection) {
      this.connection = await getConnection();
    }
  }

  /**
   * Fetch transactions for a specific program ID
   */
  async fetchProgramTransactions(filter: ProgramTransactionFilter): Promise<ProgramTransactionResult> {
    const startTime = Date.now();
    await this.init();

    const { programId, limit = 100, before, until, commitment = 'confirmed', includeFailed = false } = filter;

    // Use commitment for connection configuration and logging
    console.log(`Fetching program transactions with commitment level: ${commitment}`);
    if (commitment !== 'confirmed' && commitment !== 'finalized') {
      console.warn(`Using non-standard commitment level: ${commitment}. Consider using 'confirmed' or 'finalized'.`);
    }

    try {
      // Validate program ID
      const programPublicKey = new PublicKey(programId);

      // Check cache first
      const cacheKey = this.getCacheKey(filter);
      const cached = programTransactionCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          fetchTime: Date.now() - startTime
        };
      }

      // Fetch signatures for the program
      const signatures = await this.connection.getConfirmedSignaturesForAddress2(
        programPublicKey,
        {
          limit: Math.min(limit, 1000), // RPC limit
          before: before || undefined,
          until: until || undefined,
        }
      );

      if (signatures.length === 0) {
        return {
          transactions: [],
          hasMore: false,
          totalFetched: 0,
          programId,
          fetchTime: Date.now() - startTime
        };
      }

      // Filter signatures based on criteria
      const filteredSignatures = signatures.filter(sig => {
        if (!includeFailed && sig.err) return false;
        if (filter.minSlot && sig.slot < filter.minSlot) return false;
        if (filter.maxSlot && sig.slot > filter.maxSlot) return false;
        return true;
      });

      // Fetch detailed transaction data
      const transactions: EnhancedTransactionData[] = [];
      const batchSize = 10; // Process in batches to avoid rate limits

      for (let i = 0; i < filteredSignatures.length; i += batchSize) {
        const batch = filteredSignatures.slice(i, i + batchSize);
        const batchPromises = batch.map(sig =>
          this.fetchTransactionWithRetry(sig.signature, commitment)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            transactions.push(result.value);
          }
        }

        // Add small delay between batches to be respectful
        if (i + batchSize < filteredSignatures.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Sort by slot (newest first)
      transactions.sort((a, b) => b.slot - a.slot);

      // Cache the results
      const result: ProgramTransactionResult = {
        transactions,
        hasMore: signatures.length >= limit,
        oldestSignature: signatures[signatures.length - 1]?.signature,
        newestSignature: signatures[0]?.signature,
        totalFetched: transactions.length,
        programId,
        fetchTime: Date.now() - startTime
      };

      programTransactionCache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching program transactions:', error);
      throw new Error(`Failed to fetch transactions for program ${programId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch transaction with retry logic
   */
  private async fetchTransactionWithRetry(signature: string, commitment: string): Promise<EnhancedTransactionData | null> {
    // Use commitment for transaction fetching configuration
    console.log(`Fetching transaction ${signature.substring(0, 8)}... with commitment: ${commitment}`);
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const enhancedTx = await enhancedTransactionFetcher.fetchEnhancedTransaction(signature);

        // Use isValidTransaction for transaction validation
        if (enhancedTx && isValidTransaction(enhancedTx)) {
          console.log(`Transaction ${signature} validated successfully using isValidTransaction`);
          return enhancedTx;
        } else if (enhancedTx) {
          console.warn(`Transaction ${signature} failed validation`);
        }

        return enhancedTx;

      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    console.warn(`Failed to fetch transaction ${signature} after ${maxRetries} attempts:`, lastError);
    return null;
  }

  /**
   * Get program transaction statistics
   */
  async getProgramStats(programId: string): Promise<ProgramTransactionStats> {
    await this.init();

    try {
      const programPublicKey = new PublicKey(programId);

      // Get recent signatures for statistics
      const signatures = await this.connection.getConfirmedSignaturesForAddress2(
        programPublicKey,
        { limit: 1000 }
      );

      if (signatures.length === 0) {
        return {
          programId,
          totalTransactions: 0,
          recentTransactions: 0,
          uniqueAccounts: 0,
          uniquePrograms: 0,
          averageFee: 0,
          totalFees: 0,
          lastActivity: null,
          firstActivity: null
        };
      }

      // Get detailed data for the first few transactions to gather stats
      const sampleSize = Math.min(100, signatures.length);
      const sampleTransactions = await Promise.allSettled(
        signatures.slice(0, sampleSize).map(sig =>
          enhancedTransactionFetcher.fetchEnhancedTransaction(sig.signature)
        )
      );

      const validTransactions = sampleTransactions
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<EnhancedTransactionData>).value);

      if (validTransactions.length === 0) {
        return {
          programId,
          totalTransactions: signatures.length,
          recentTransactions: signatures.length,
          uniqueAccounts: 0,
          uniquePrograms: 0,
          averageFee: 0,
          totalFees: 0,
          lastActivity: signatures[0]?.blockTime || null,
          firstActivity: signatures[signatures.length - 1]?.blockTime || null
        };
      }

      // Calculate statistics
      const allAccounts = new Set<string>();
      const allPrograms = new Set<string>();
      let totalFees = 0;

      validTransactions.forEach(tx => {
        // Collect unique accounts
        tx.transaction.message.accountKeys.forEach(key => allAccounts.add(key.pubkey));
        tx.accountStates.forEach(state => allAccounts.add(state.address));

        // Collect unique programs
        tx.instructionData.forEach(ix => allPrograms.add(ix.programId));

        // Sum fees
        totalFees += tx.meta.fee;
      });

      const averageFee = validTransactions.length > 0 ? totalFees / validTransactions.length : 0;

      return {
        programId,
        totalTransactions: signatures.length,
        recentTransactions: validTransactions.length,
        uniqueAccounts: allAccounts.size,
        uniquePrograms: allPrograms.size,
        averageFee,
        totalFees,
        lastActivity: signatures[0]?.blockTime || null,
        firstActivity: signatures[signatures.length - 1]?.blockTime || null
      };

    } catch (error) {
      console.error('Error fetching program stats:', error);
      throw new Error(`Failed to fetch stats for program ${programId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get program transaction signatures only (lightweight)
   */
  async getProgramSignatures(
    programId: string,
    limit: number = 100,
    before?: string,
    until?: string
  ): Promise<ConfirmedSignatureInfo[]> {
    await this.init();

    try {
      const programPublicKey = new PublicKey(programId);

      const signatures = await this.connection.getConfirmedSignaturesForAddress2(
        programPublicKey,
        {
          limit: Math.min(limit, 1000),
          before: before || undefined,
          until: until || undefined,
        }
      );

      return signatures;
    } catch (error) {
      console.error('Error fetching program signatures:', error);
      throw new Error(`Failed to fetch signatures for program ${programId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for transactions by program ID with additional filters
   */
  async searchProgramTransactions(params: {
    programId: string;
    account?: string;
    instructionType?: string;
    minAmount?: number;
    maxAmount?: number;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<EnhancedTransactionData[]> {
    const { programId, limit = 50, ...filters } = params;

    // Fetch transactions for the program
    const result = await this.fetchProgramTransactions({ programId, limit: Math.min(limit * 2, 200) });

    // Apply additional filters
    let filtered = result.transactions;

    if (filters.account) {
      filtered = filtered.filter(tx =>
        tx.transaction.message.accountKeys.some(key => key.pubkey === filters.account) ||
        tx.accountStates.some(state => state.address === filters.account)
      );
    }

    if (filters.instructionType) {
      filtered = filtered.filter(tx =>
        tx.instructionData.some(ix => ix.instructionType === filters.instructionType)
      );
    }

    if (filters.minAmount || filters.maxAmount) {
      filtered = filtered.filter(tx => {
        const tokenTransfers = tx.accountStates.flatMap(state => state.tokenChanges);
        const amounts = tokenTransfers.map(change => Math.abs(parseFloat(change.difference)));
        const maxTransfer = Math.max(...amounts);

        if (filters.minAmount && maxTransfer < filters.minAmount) return false;
        if (filters.maxAmount && maxTransfer > filters.maxAmount) return false;

        return true;
      });
    }

    if (filters.startTime || filters.endTime) {
      filtered = filtered.filter(tx => {
        if (!tx.blockTime) return false;
        if (filters.startTime && tx.blockTime < filters.startTime) return false;
        if (filters.endTime && tx.blockTime > filters.endTime) return false;
        return true;
      });
    }

    return filtered.slice(0, limit);
  }

  /**
   * Generate cache key for filtering
   */
  private getCacheKey(filter: ProgramTransactionFilter): string {
    const parts = [
      'program',
      filter.programId,
      filter.limit || 100,
      filter.before || 'start',
      filter.until || 'end',
      filter.commitment || 'confirmed',
      filter.includeFailed || false,
      filter.minSlot || 0,
      filter.maxSlot || Number.MAX_SAFE_INTEGER
    ];
    return parts.join(':');
  }

  /**
   * Clear cache for a specific program
   */
  clearProgramCache(programId: string): void {
    const keysToDelete: string[] = [];

    // Find all cache keys for this program
    const stats = programTransactionCache.getStats();
    if (stats.memoryUsage && Array.isArray(stats.memoryUsage)) {
      for (const key of stats.memoryUsage) {
        if (key.startsWith(`program:${programId}`)) {
          keysToDelete.push(key);
        }
      }
    }

    // Remove cached entries
    keysToDelete.forEach(key => programTransactionCache.delete(key));
  }
}

// Export singleton instance
export const programTransactionFetcher = new ProgramTransactionFetcher();
