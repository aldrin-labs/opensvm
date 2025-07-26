/**
 * Transaction Optimization Service
 * 
 * This service provides optimization for handling large transactions including:
 * - Pagination for transactions with many instructions
 * - Lazy loading for related transactions
 * - Performance monitoring and optimization
 * - Memory management for large datasets
 */

import type { DetailedTransactionInfo } from './solana';
import type { ParsedInstructionInfo } from './instruction-parser-service';
import type { RelatedTransaction } from './related-transaction-finder';

// Configuration constants
const OPTIMIZATION_CONFIG = {
  MAX_INSTRUCTIONS_PER_PAGE: 50, // Maximum instructions to load at once
  MAX_RELATED_TRANSACTIONS_INITIAL: 10, // Initial related transactions to load
  MAX_RELATED_TRANSACTIONS_BATCH: 20, // Batch size for lazy loading
  LARGE_TRANSACTION_THRESHOLD: 100, // Consider transaction "large" if > 100 instructions
  PERFORMANCE_MONITORING_ENABLED: true,
  MEMORY_CLEANUP_INTERVAL: 30000, // 30 seconds
} as const;

// Interfaces for paginated data
export interface PaginatedInstructions {
  instructions: ParsedInstructionInfo[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
}

export interface PaginatedRelatedTransactions {
  transactions: RelatedTransaction[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  loadedCount: number; // How many have been loaded so far
}

export interface TransactionOptimizationMetrics {
  instructionCount: number;
  accountCount: number;
  relatedTransactionCount: number;
  isLargeTransaction: boolean;
  processingTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  optimizationsApplied: string[];
}

export interface LazyLoadingState {
  isLoading: boolean;
  hasMore: boolean;
  nextCursor?: string;
  error?: Error;
}

class TransactionOptimizationService {
  private performanceMetrics = new Map<string, TransactionOptimizationMetrics>();
  private memoryCleanupInterval?: NodeJS.Timeout;

  constructor() {
    if (OPTIMIZATION_CONFIG.PERFORMANCE_MONITORING_ENABLED) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Check if a transaction is considered "large" and needs optimization
   */
  isLargeTransaction(transaction: DetailedTransactionInfo): boolean {
    const instructionCount = transaction.details?.instructions?.length || 0;
    const accountCount = transaction.details?.accounts?.length || 0;
    
    return (
      instructionCount > OPTIMIZATION_CONFIG.LARGE_TRANSACTION_THRESHOLD ||
      accountCount > 200 || // Large number of accounts
      this.estimateTransactionSize(transaction) > 1024 * 1024 // > 1MB estimated size
    );
  }

  /**
   * Paginate transaction instructions for large transactions
   */
  paginateInstructions(
    instructions: ParsedInstructionInfo[],
    page: number = 1,
    pageSize: number = OPTIMIZATION_CONFIG.MAX_INSTRUCTIONS_PER_PAGE
  ): PaginatedInstructions {
    const totalCount = instructions.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);
    
    const paginatedInstructions = instructions.slice(startIndex, endIndex);

    return {
      instructions: paginatedInstructions,
      totalCount,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      pageSize
    };
  }

  /**
   * Create lazy loading state for related transactions
   */
  createLazyLoadingState(
    allRelatedTransactions: RelatedTransaction[],
    initialLoadSize: number = OPTIMIZATION_CONFIG.MAX_RELATED_TRANSACTIONS_INITIAL
  ): {
    initialData: PaginatedRelatedTransactions;
    lazyState: LazyLoadingState;
  } {
    const totalCount = allRelatedTransactions.length;
    const initialTransactions = allRelatedTransactions.slice(0, initialLoadSize);
    
    const initialData: PaginatedRelatedTransactions = {
      transactions: initialTransactions,
      totalCount,
      currentPage: 1,
      totalPages: Math.ceil(totalCount / initialLoadSize),
      hasNextPage: totalCount > initialLoadSize,
      hasPreviousPage: false,
      pageSize: initialLoadSize,
      loadedCount: initialTransactions.length
    };

    const lazyState: LazyLoadingState = {
      isLoading: false,
      hasMore: totalCount > initialLoadSize,
      nextCursor: initialLoadSize < totalCount ? initialLoadSize.toString() : undefined,
      error: undefined
    };

    return { initialData, lazyState };
  }

  /**
   * Load next batch of related transactions
   */
  async loadNextRelatedTransactionsBatch(
    allRelatedTransactions: RelatedTransaction[],
    currentData: PaginatedRelatedTransactions,
    batchSize: number = OPTIMIZATION_CONFIG.MAX_RELATED_TRANSACTIONS_BATCH
  ): Promise<{
    updatedData: PaginatedRelatedTransactions;
    lazyState: LazyLoadingState;
  }> {
    const startIndex = currentData.loadedCount;
    const endIndex = Math.min(startIndex + batchSize, allRelatedTransactions.length);
    
    // Simulate async loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newTransactions = allRelatedTransactions.slice(startIndex, endIndex);
    const updatedTransactions = [...currentData.transactions, ...newTransactions];
    
    const updatedData: PaginatedRelatedTransactions = {
      ...currentData,
      transactions: updatedTransactions,
      loadedCount: updatedTransactions.length,
      hasNextPage: endIndex < allRelatedTransactions.length
    };

    const lazyState: LazyLoadingState = {
      isLoading: false,
      hasMore: endIndex < allRelatedTransactions.length,
      nextCursor: endIndex < allRelatedTransactions.length ? endIndex.toString() : undefined,
      error: undefined
    };

    return { updatedData, lazyState };
  }

  /**
   * Optimize transaction processing based on size and complexity
   */
  async optimizeTransactionProcessing<T>(
    transaction: DetailedTransactionInfo,
    processor: (transaction: DetailedTransactionInfo) => Promise<T>,
    options?: {
      enableCaching?: boolean;
      enablePagination?: boolean;
      enableLazyLoading?: boolean;
    }
  ): Promise<{
    result: T;
    metrics: TransactionOptimizationMetrics;
    optimizationsApplied: string[];
  }> {
    const startTime = Date.now();
    const optimizationsApplied: string[] = [];
    
    // Check if transaction needs optimization
    const isLarge = this.isLargeTransaction(transaction);
    
    if (isLarge) {
      optimizationsApplied.push('large_transaction_handling');
    }

    // Apply memory optimization for large transactions
    if (isLarge && options?.enableCaching !== false) {
      optimizationsApplied.push('memory_optimization');
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    // Process the transaction
    const result = await processor(transaction);
    
    const processingTime = Date.now() - startTime;
    const memoryUsage = this.estimateMemoryUsage(result);
    
    // Create metrics
    const metrics: TransactionOptimizationMetrics = {
      instructionCount: transaction.details?.instructions?.length || 0,
      accountCount: transaction.details?.accounts?.length || 0,
      relatedTransactionCount: 0, // Would be set by caller
      isLargeTransaction: isLarge,
      processingTime,
      memoryUsage,
      cacheHitRate: 0, // Would be calculated from cache statistics
      optimizationsApplied
    };

    // Store metrics for monitoring
    this.performanceMetrics.set(transaction.signature, metrics);

    return {
      result,
      metrics,
      optimizationsApplied
    };
  }

  /**
   * Create optimized instruction loader for large transactions
   */
  createInstructionLoader(
    transaction: DetailedTransactionInfo,
    instructionParser: (instruction: any, accounts: any[]) => Promise<ParsedInstructionInfo>
  ) {
    const instructions = transaction.details?.instructions || [];
    const accounts = transaction.details?.accounts || [];
    const isLarge = this.isLargeTransaction(transaction);

    return {
      /**
       * Load instructions with pagination
       */
      loadInstructionsPage: async (
        page: number = 1,
        pageSize: number = OPTIMIZATION_CONFIG.MAX_INSTRUCTIONS_PER_PAGE
      ): Promise<PaginatedInstructions> => {
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, instructions.length);
        const pageInstructions = instructions.slice(startIndex, endIndex);

        // Parse instructions in batch
        const parsedInstructions = await Promise.all(
          pageInstructions.map(instruction => instructionParser(instruction, accounts))
        );

        return this.paginateInstructions(parsedInstructions, page, pageSize);
      },

      /**
       * Load all instructions (with optimization for large transactions)
       */
      loadAllInstructions: async (): Promise<ParsedInstructionInfo[]> => {
        if (isLarge) {
          // Process in batches to avoid memory issues
          const batchSize = OPTIMIZATION_CONFIG.MAX_INSTRUCTIONS_PER_PAGE;
          const batches = Math.ceil(instructions.length / batchSize);
          const allParsed: ParsedInstructionInfo[] = [];

          for (let i = 0; i < batches; i++) {
            const startIndex = i * batchSize;
            const endIndex = Math.min(startIndex + batchSize, instructions.length);
            const batchInstructions = instructions.slice(startIndex, endIndex);

            const parsedBatch = await Promise.all(
              batchInstructions.map(instruction => instructionParser(instruction, accounts))
            );

            allParsed.push(...parsedBatch);

            // Allow event loop to process other tasks
            if (i < batches - 1) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }

          return allParsed;
        } else {
          // Process all at once for smaller transactions
          return Promise.all(
            instructions.map(instruction => instructionParser(instruction, accounts))
          );
        }
      },

      /**
       * Get loading metadata
       */
      getMetadata: () => ({
        totalInstructions: instructions.length,
        isLargeTransaction: isLarge,
        recommendedPageSize: isLarge ? OPTIMIZATION_CONFIG.MAX_INSTRUCTIONS_PER_PAGE : instructions.length,
        estimatedLoadTime: this.estimateLoadTime(instructions.length)
      })
    };
  }

  /**
   * Create optimized related transactions loader
   */
  createRelatedTransactionsLoader(
    allRelatedTransactions: RelatedTransaction[]
  ) {
    const totalCount = allRelatedTransactions.length;
    const isLargeSet = totalCount > OPTIMIZATION_CONFIG.MAX_RELATED_TRANSACTIONS_INITIAL;

    return {
      /**
       * Get initial batch of related transactions
       */
      getInitialBatch: (): {
        data: PaginatedRelatedTransactions;
        lazyState: LazyLoadingState;
      } => {
        return this.createLazyLoadingState(allRelatedTransactions);
      },

      /**
       * Load next batch of related transactions
       */
      loadNextBatch: async (
        currentData: PaginatedRelatedTransactions
      ): Promise<{
        updatedData: PaginatedRelatedTransactions;
        lazyState: LazyLoadingState;
      }> => {
        return this.loadNextRelatedTransactionsBatch(allRelatedTransactions, currentData);
      },

      /**
       * Search within related transactions
       */
      searchRelatedTransactions: (
        query: string,
        currentData: PaginatedRelatedTransactions
      ): RelatedTransaction[] => {
        const searchTerm = query.toLowerCase();
        return currentData.transactions.filter(tx =>
          tx.signature.toLowerCase().includes(searchTerm) ||
          tx.summary.toLowerCase().includes(searchTerm) ||
          tx.relationship.description.toLowerCase().includes(searchTerm)
        );
      },

      /**
       * Get metadata about the related transactions set
       */
      getMetadata: () => ({
        totalCount,
        isLargeSet,
        initialLoadSize: OPTIMIZATION_CONFIG.MAX_RELATED_TRANSACTIONS_INITIAL,
        batchSize: OPTIMIZATION_CONFIG.MAX_RELATED_TRANSACTIONS_BATCH,
        estimatedLoadTime: this.estimateLoadTime(totalCount)
      })
    };
  }

  /**
   * Monitor performance and provide optimization recommendations
   */
  getPerformanceInsights(signature: string): {
    metrics?: TransactionOptimizationMetrics;
    recommendations: string[];
  } {
    const metrics = this.performanceMetrics.get(signature);
    const recommendations: string[] = [];

    if (!metrics) {
      return { recommendations: ['No performance data available'] };
    }

    // Analyze metrics and provide recommendations
    if (metrics.processingTime > 5000) { // > 5 seconds
      recommendations.push('Consider enabling caching to reduce processing time');
    }

    if (metrics.memoryUsage > 50 * 1024 * 1024) { // > 50MB
      recommendations.push('Enable pagination for instructions to reduce memory usage');
    }

    if (metrics.instructionCount > OPTIMIZATION_CONFIG.LARGE_TRANSACTION_THRESHOLD) {
      recommendations.push('Use lazy loading for related transactions');
      recommendations.push('Enable instruction pagination');
    }

    if (metrics.cacheHitRate < 0.5) { // < 50% cache hit rate
      recommendations.push('Improve caching strategy for better performance');
    }

    if (recommendations.length === 0) {
      recommendations.push('Transaction processing is well optimized');
    }

    return { metrics, recommendations };
  }

  /**
   * Clean up old performance metrics to prevent memory leaks
   */
  private startPerformanceMonitoring(): void {
    this.memoryCleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour ago
      
      for (const [signature, metrics] of this.performanceMetrics.entries()) {
        if (metrics.processingTime < cutoffTime) {
          this.performanceMetrics.delete(signature);
        }
      }
    }, OPTIMIZATION_CONFIG.MEMORY_CLEANUP_INTERVAL);
  }

  /**
   * Estimate transaction size in bytes
   */
  private estimateTransactionSize(transaction: DetailedTransactionInfo): number {
    try {
      return JSON.stringify(transaction).length * 2; // Rough estimate
    } catch (error) {
      return 0;
    }
  }

  /**
   * Estimate memory usage of a result object
   */
  private estimateMemoryUsage(result: any): number {
    try {
      return JSON.stringify(result).length * 2; // Rough estimate
    } catch (error) {
      return 0;
    }
  }

  /**
   * Estimate load time based on item count
   */
  private estimateLoadTime(itemCount: number): number {
    // Rough estimate: 1ms per item + base overhead
    return Math.max(100, itemCount * 1);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
    this.performanceMetrics.clear();
  }
}

// Export singleton instance
export const transactionOptimizationService = new TransactionOptimizationService();

// Export utility functions
export function createOptimizedTransactionProcessor<T>(
  processor: (transaction: DetailedTransactionInfo) => Promise<T>
) {
  return async (transaction: DetailedTransactionInfo): Promise<T> => {
    const { result } = await transactionOptimizationService.optimizeTransactionProcessing(
      transaction,
      processor,
      {
        enableCaching: true,
        enablePagination: true,
        enableLazyLoading: true
      }
    );
    return result;
  };
}

export function shouldUsePagination(transaction: DetailedTransactionInfo): boolean {
  return transactionOptimizationService.isLargeTransaction(transaction);
}

export function getOptimalPageSize(instructionCount: number): number {
  if (instructionCount <= 20) return instructionCount;
  if (instructionCount <= 100) return 25;
  return OPTIMIZATION_CONFIG.MAX_INSTRUCTIONS_PER_PAGE;
}

export function getOptimalBatchSize(totalCount: number): number {
  if (totalCount <= 10) return totalCount;
  if (totalCount <= 50) return 10;
  return OPTIMIZATION_CONFIG.MAX_RELATED_TRANSACTIONS_BATCH;
}