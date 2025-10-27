'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import TokenMarketTable from '@/components/TokenMarketTable';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton';
import { getAllTokens } from '@/lib/mock-token-data';
import type { TokenMarketData, TokenListResponse } from '@/types/token-market';

type ViewMode = 'all' | 'calls' | 'transactions' | 'blocks';

export default function TokensPage() {
  const settings = useSettings();
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenMarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);

  // Optimized: Load tokens with better error handling (Bug #8 fix)
  const loadTokens = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      setError(null);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const response: TokenListResponse = await Promise.race([
        getAllTokens(50),
        timeoutPromise as Promise<TokenListResponse>
      ]);
      
      setTokens(response.tokens);
      setHasMore(response.hasMore);
      setCursor(response.cursor);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error('Error loading tokens:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load token data';
      setError(`${errorMsg}. Please try again.`);
      
      // Auto-retry with exponential backoff
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadTokens(isRefresh);
        }, Math.min(1000 * Math.pow(2, retryCount), 10000));
      }
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    loadTokens();

    // Optimized: Refresh every 60 seconds instead of 30 (reduces load)
    const interval = setInterval(() => loadTokens(true), 60000);

    return () => clearInterval(interval);
  }, [loadTokens]);

  const handleTokenClick = (address: string) => {
    router.push(`/token/${address}`);
  };

  const loadMore = async () => {
    if (!hasMore || isLoading) return;

    try {
      setIsLoading(true);
      const response: TokenListResponse = await getAllTokens(50, cursor);
      setTokens(prev => [...prev, ...response.tokens]);
      setHasMore(response.hasMore);
      setCursor(response.cursor);
    } catch (err) {
      console.error('Error loading more tokens:', err);
      setError('Failed to load more tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-tokens-page-wrapper container mx-auto py-8 px-4"> {/* Added ai-tokens-page-wrapper */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">All Tokens</h1>
        <p className="text-muted-foreground">
          Browse all tokens and their metrics on the Solana network. Data updates every 30 seconds.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {isLoading && tokens.length === 0 ? (
          <div className="space-y-4">
            <TableSkeleton rows={10} columns={7} />
          </div>
        ) : (
          <TokenMarketTable
            tokens={tokens}
            type="all"
            onTokenClick={handleTokenClick}
            isLoading={false}
          />
        )}

        {hasMore && !isLoading && (
          <div className="flex justify-center">
            <Button onClick={loadMore} variant="outline">
              Load More Tokens
            </Button>
          </div>
        )}

        {isLoading && tokens.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading more tokens...</span>
          </div>
        )}
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          Market data is updated automatically every minute. 
          Price changes reflect the last 24 hours of trading activity.
        </p>
      </div>
    </div>
  );
}
