/**
 * Transaction Loading States Hook
 * 
 * This hook provides optimized loading states for transaction components,
 * including pagination, lazy loading, and performance monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DetailedTransactionInfo } from '@/lib/solana/solana';
import type { ParsedInstructionInfo } from '@/lib/instruction-parser-service';
import type { RelatedTransaction } from '@/lib/blockchain/related-transaction-finder';
import {
  transactionOptimizationService,
  type PaginatedInstructions,
  type PaginatedRelatedTransactions,
  type LazyLoadingState,
  type TransactionOptimizationMetrics
} from '@/lib/transaction-optimization';

// Hook for paginated instruction loading
export function usePaginatedInstructions(
  transaction: DetailedTransactionInfo | null,
  instructionParser: (instruction: any, accounts: any[]) => Promise<ParsedInstructionInfo>
) {
  const [paginatedData, setPaginatedData] = useState<PaginatedInstructions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const loaderRef = useRef<ReturnType<typeof transactionOptimizationService.createInstructionLoader> | null>(null);

  // Initialize loader when transaction changes
  useEffect(() => {
    if (transaction) {
      loaderRef.current = transactionOptimizationService.createInstructionLoader(
        transaction,
        instructionParser
      );
      setCurrentPage(1);
      loadPage(1);
    } else {
      loaderRef.current = null;
      setPaginatedData(null);
    }
  }, [transaction, instructionParser]);

  const loadPage = useCallback(async (page: number) => {
    if (!loaderRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current.loadInstructionsPage(page);
      setPaginatedData(result);
      setCurrentPage(page);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllInstructions = useCallback(async () => {
    if (!loaderRef.current) return [];

    setLoading(true);
    setError(null);

    try {
      const instructions = await loaderRef.current.loadAllInstructions();
      return instructions;
    } catch (err) {
      setError(err as Error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const nextPage = useCallback(() => {
    if (paginatedData?.hasNextPage) {
      loadPage(currentPage + 1);
    }
  }, [currentPage, paginatedData?.hasNextPage, loadPage]);

  const previousPage = useCallback(() => {
    if (paginatedData?.hasPreviousPage) {
      loadPage(currentPage - 1);
    }
  }, [currentPage, paginatedData?.hasPreviousPage, loadPage]);

  const goToPage = useCallback((page: number) => {
    if (paginatedData && page >= 1 && page <= paginatedData.totalPages) {
      loadPage(page);
    }
  }, [paginatedData, loadPage]);

  const metadata = loaderRef.current?.getMetadata();

  return {
    paginatedData,
    loading,
    error,
    currentPage,
    metadata,
    actions: {
      loadPage,
      loadAllInstructions,
      nextPage,
      previousPage,
      goToPage,
      refresh: () => loadPage(currentPage)
    }
  };
}

// Hook for lazy-loaded related transactions
export function useLazyRelatedTransactions(
  allRelatedTransactions: RelatedTransaction[]
) {
  const [paginatedData, setPaginatedData] = useState<PaginatedRelatedTransactions | null>(null);
  const [lazyState, setLazyState] = useState<LazyLoadingState>({
    isLoading: false,
    hasMore: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<RelatedTransaction[]>([]);

  const loaderRef = useRef<ReturnType<typeof transactionOptimizationService.createRelatedTransactionsLoader> | null>(null);

  // Initialize loader when related transactions change
  useEffect(() => {
    if (allRelatedTransactions.length > 0) {
      loaderRef.current = transactionOptimizationService.createRelatedTransactionsLoader(
        allRelatedTransactions
      );
      
      const { data, lazyState: initialLazyState } = loaderRef.current.getInitialBatch();
      setPaginatedData(data);
      setLazyState(initialLazyState);
    } else {
      loaderRef.current = null;
      setPaginatedData(null);
      setLazyState({ isLoading: false, hasMore: false });
    }
  }, [allRelatedTransactions]);

  // Handle search filtering
  useEffect(() => {
    if (searchQuery && paginatedData && loaderRef.current) {
      const filtered = loaderRef.current.searchRelatedTransactions(searchQuery, paginatedData);
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions([]);
    }
  }, [searchQuery, paginatedData]);

  const loadMore = useCallback(async () => {
    if (!loaderRef.current || !paginatedData || !lazyState.hasMore || lazyState.isLoading) {
      return;
    }

    setLazyState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const { updatedData, lazyState: newLazyState } = await loaderRef.current.loadNextBatch(paginatedData);
      setPaginatedData(updatedData);
      setLazyState(newLazyState);
    } catch (error) {
      setLazyState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error as Error 
      }));
    }
  }, [paginatedData, lazyState]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFilteredTransactions([]);
  }, []);

  const metadata = loaderRef.current?.getMetadata();
  const displayTransactions = searchQuery ? filteredTransactions : paginatedData?.transactions || [];

  return {
    transactions: displayTransactions,
    paginatedData,
    lazyState,
    searchQuery,
    metadata,
    actions: {
      loadMore,
      search,
      clearSearch,
      refresh: () => {
        if (loaderRef.current) {
          const { data, lazyState: initialLazyState } = loaderRef.current.getInitialBatch();
          setPaginatedData(data);
          setLazyState(initialLazyState);
        }
      }
    }
  };
}

// Hook for transaction performance monitoring
export function useTransactionPerformance(signature: string | null) {
  const [metrics, setMetrics] = useState<TransactionOptimizationMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    if (signature) {
      const insights = transactionOptimizationService.getPerformanceInsights(signature);
      setMetrics(insights.metrics || null);
      setRecommendations(insights.recommendations);
    } else {
      setMetrics(null);
      setRecommendations([]);
    }
  }, [signature]);

  return {
    metrics,
    recommendations,
    hasMetrics: metrics !== null,
    isLargeTransaction: metrics?.isLargeTransaction || false,
    processingTime: metrics?.processingTime || 0,
    optimizationsApplied: metrics?.optimizationsApplied || []
  };
}

// Hook for optimized transaction processing
export function useOptimizedTransactionProcessor<T>(
  processor: (transaction: DetailedTransactionInfo) => Promise<T>
) {
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metrics, setMetrics] = useState<TransactionOptimizationMetrics | null>(null);
  const [optimizationsApplied, setOptimizationsApplied] = useState<string[]>([]);

  const processTransaction = useCallback(async (transaction: DetailedTransactionInfo) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { result: processedResult, metrics: processingMetrics, optimizationsApplied: appliedOptimizations } = 
        await transactionOptimizationService.optimizeTransactionProcessing(
          transaction,
          processor,
          {
            enableCaching: true,
            enablePagination: true,
            enableLazyLoading: true
          }
        );

      setResult(processedResult);
      setMetrics(processingMetrics);
      setOptimizationsApplied(appliedOptimizations);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [processor]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setMetrics(null);
    setOptimizationsApplied([]);
  }, []);

  return {
    result,
    loading,
    error,
    metrics,
    optimizationsApplied,
    actions: {
      processTransaction,
      reset
    }
  };
}

// Hook for managing loading states across multiple components
export function useTransactionLoadingManager() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, Error>>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
    if (loading) {
      // Clear error when starting to load
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  }, []);

  const setError = useCallback((key: string, error: Error) => {
    setErrors(prev => ({ ...prev, [key]: error }));
    setLoadingStates(prev => ({ ...prev, [key]: false }));
  }, []);

  const clearError = useCallback((key: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const getError = useCallback((key: string) => {
    return errors[key] || null;
  }, [errors]);

  const isAnyLoading = Object.values(loadingStates).some(loading => loading);
  const hasAnyError = Object.keys(errors).length > 0;

  return {
    loadingStates,
    errors,
    isAnyLoading,
    hasAnyError,
    actions: {
      setLoading,
      setError,
      clearError,
      isLoading,
      getError,
      reset: () => {
        setLoadingStates({});
        setErrors({});
      }
    }
  };
}