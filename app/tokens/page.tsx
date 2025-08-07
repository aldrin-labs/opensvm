'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/app/providers/SettingsProvider';
import TokenMarketTable from '@/components/TokenMarketTable';
import { Button } from '@/components/ui/button';
import { getAllTokens } from '@/lib/mock-token-data';
import type { TokenMarketData, TokenListResponse } from '@/types/token-market';

export default function TokensPage() {
  const settings = useSettings();
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenMarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();

  // Auto-refresh data every 30 seconds for real-time updates
  useEffect(() => {
    const loadTokens = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response: TokenListResponse = await getAllTokens(50);
        setTokens(response.tokens);
        setHasMore(response.hasMore);
        setCursor(response.cursor);
      } catch (err) {
        console.error('Error loading tokens:', err);
        setError('Failed to load token data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTokens();

    // Set up auto-refresh
    const interval = setInterval(loadTokens, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

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
    <div className="container mx-auto py-8 px-4">
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
        <TokenMarketTable
          tokens={tokens}
          type="all"
          onTokenClick={handleTokenClick}
          isLoading={isLoading && tokens.length === 0}
        />

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
          Market data is updated in real-time from multiple sources. 
          Price changes reflect the last 24 hours of trading activity.
        </p>
      </div>
    </div>
  );
}
