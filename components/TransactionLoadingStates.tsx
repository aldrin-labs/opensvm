/**
 * Transaction Loading States Components
 * 
 * These components provide optimized loading states and performance monitoring
 * for transaction analysis, including pagination and lazy loading.
 */

import React from 'react';
import { Loader2, ChevronLeft, ChevronRight, Search, AlertCircle, CheckCircle, Clock, BarChart3 } from 'lucide-react';
import type { PaginatedInstructions, PaginatedRelatedTransactions, TransactionOptimizationMetrics } from '@/lib/transaction-optimization';

// Paginated Instructions Component
interface PaginatedInstructionsProps {
  paginatedData: PaginatedInstructions | null;
  loading: boolean;
  error: Error | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  children: (instructions: any[]) => React.ReactNode;
}

export function PaginatedInstructionsView({
  paginatedData,
  loading,
  error,
  currentPage,
  onPageChange,
  onNextPage,
  onPreviousPage,
  children
}: PaginatedInstructionsProps) {
  if (loading && !paginatedData) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading instructions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>Error loading instructions: {error.message}</span>
      </div>
    );
  }

  if (!paginatedData) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <span>No instructions available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Instructions Content */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {children(paginatedData.instructions)}
      </div>

      {/* Pagination Controls */}
      {paginatedData.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * paginatedData.pageSize) + 1} to{' '}
            {Math.min(currentPage * paginatedData.pageSize, paginatedData.totalCount)} of{' '}
            {paginatedData.totalCount} instructions
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onPreviousPage}
              disabled={!paginatedData.hasPreviousPage || loading}
              className="p-2 rounded-md border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, paginatedData.totalPages) }, (_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === currentPage;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    disabled={loading}
                    className={`px-3 py-1 rounded-md text-sm ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent disabled:opacity-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {paginatedData.totalPages > 5 && (
                <>
                  <span className="px-2">...</span>
                  <button
                    onClick={() => onPageChange(paginatedData.totalPages)}
                    disabled={loading}
                    className="px-3 py-1 rounded-md text-sm hover:bg-accent disabled:opacity-50"
                  >
                    {paginatedData.totalPages}
                  </button>
                </>
              )}
            </div>
            
            <button
              onClick={onNextPage}
              disabled={!paginatedData.hasNextPage || loading}
              className="p-2 rounded-md border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Lazy Loading Related Transactions Component
interface LazyRelatedTransactionsProps {
  transactions: any[];
  paginatedData: PaginatedRelatedTransactions | null;
  lazyState: {
    isLoading: boolean;
    hasMore: boolean;
    error?: Error;
  };
  searchQuery: string;
  onLoadMore: () => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  children: (transactions: any[]) => React.ReactNode;
}

export function LazyRelatedTransactionsView({
  transactions,
  paginatedData,
  lazyState,
  searchQuery,
  onLoadMore,
  onSearch,
  onClearSearch,
  children
}: LazyRelatedTransactionsProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search related transactions..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      {/* Status Info */}
      {paginatedData && (
        <div className="text-sm text-muted-foreground">
          {searchQuery ? (
            <span>Found {transactions.length} matching transactions</span>
          ) : (
            <span>
              Showing {paginatedData.loadedCount} of {paginatedData.totalCount} related transactions
            </span>
          )}
        </div>
      )}

      {/* Transactions Content */}
      <div>
        {children(transactions)}
      </div>

      {/* Load More Button */}
      {!searchQuery && lazyState.hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={lazyState.isLoading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {lazyState.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading more...</span>
              </>
            ) : (
              <span>Load more transactions</span>
            )}
          </button>
        </div>
      )}

      {/* Error State */}
      {lazyState.error && (
        <div className="flex items-center justify-center p-4 text-red-600 bg-red-50 rounded-md">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>Error loading more transactions: {lazyState.error.message}</span>
        </div>
      )}

      {/* No More Results */}
      {!searchQuery && !lazyState.hasMore && paginatedData && paginatedData.loadedCount > 0 && (
        <div className="flex items-center justify-center p-4 text-muted-foreground">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>All related transactions loaded</span>
        </div>
      )}
    </div>
  );
}

// Performance Metrics Component
interface PerformanceMetricsProps {
  metrics: TransactionOptimizationMetrics | null;
  recommendations: string[];
  className?: string;
}

export function PerformanceMetrics({ metrics, recommendations, className = '' }: PerformanceMetricsProps) {
  if (!metrics) {
    return null;
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className={`bg-muted/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <BarChart3 className="h-5 w-5" />
        <h3 className="font-semibold">Performance Metrics</h3>
        {metrics.isLargeTransaction && (
          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
            Large Transaction
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{metrics.instructionCount}</div>
          <div className="text-xs text-muted-foreground">Instructions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{metrics.accountCount}</div>
          <div className="text-xs text-muted-foreground">Accounts</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{formatTime(metrics.processingTime)}</div>
          <div className="text-xs text-muted-foreground">Processing Time</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{formatBytes(metrics.memoryUsage)}</div>
          <div className="text-xs text-muted-foreground">Memory Usage</div>
        </div>
      </div>

      {/* Optimizations Applied */}
      {metrics.optimizationsApplied.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Optimizations Applied:</h4>
          <div className="flex flex-wrap gap-2">
            {metrics.optimizationsApplied.map((optimization, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
              >
                {optimization.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            Recommendations:
          </h4>
          <ul className="space-y-1">
            {recommendations.map((recommendation, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start">
                <span className="w-1 h-1 bg-muted-foreground rounded-full mt-2 mr-2 flex-shrink-0" />
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Loading State Indicator
interface LoadingStateIndicatorProps {
  isLoading: boolean;
  hasError: boolean;
  loadingText?: string;
  errorText?: string;
  className?: string;
}

export function LoadingStateIndicator({
  isLoading,
  hasError,
  loadingText = 'Loading...',
  errorText = 'An error occurred',
  className = ''
}: LoadingStateIndicatorProps) {
  if (!isLoading && !hasError) {
    return null;
  }

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      {isLoading ? (
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{loadingText}</span>
        </div>
      ) : hasError ? (
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{errorText}</span>
        </div>
      ) : null}
    </div>
  );
}

// Transaction Size Badge
interface TransactionSizeBadgeProps {
  instructionCount: number;
  accountCount: number;
  isLarge?: boolean;
}

export function TransactionSizeBadge({ instructionCount, accountCount, isLarge }: TransactionSizeBadgeProps) {
  const getBadgeColor = () => {
    if (isLarge) return 'bg-red-100 text-red-800';
    if (instructionCount > 50 || accountCount > 100) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getBadgeText = () => {
    if (isLarge) return 'Large';
    if (instructionCount > 50 || accountCount > 100) return 'Medium';
    return 'Small';
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${getBadgeColor()}`}>
      {getBadgeText()} Transaction
    </span>
  );
}