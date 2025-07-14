'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TokenMarketTable from '@/components/TokenMarketTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getNewListings } from '@/lib/mock-token-data';
import type { NewTokenData } from '@/types/token-market';

export default function NewTokensPage() {
  const router = useRouter();
  const [newTokens, setNewTokens] = useState<NewTokenData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [daysBack, setDaysBack] = useState(7);

  // Auto-refresh data every 60 seconds
  useEffect(() => {
    const loadNewTokens = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getNewListings(50, daysBack);
        setNewTokens(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Error loading new tokens:', err);
        setError('Failed to load new listings data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadNewTokens();

    // Set up auto-refresh
    const interval = setInterval(loadNewTokens, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, [daysBack]);

  const handleTokenClick = (address: string) => {
    router.push(`/token/${address}`);
  };

  const handleDaysBackChange = (days: number) => {
    setDaysBack(days);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold">New Listings</h1>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            🆕 Fresh
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Recently listed tokens on the Solana network.
          {lastUpdated && (
            <span className="block mt-1 text-sm">
              Last updated: {formatTime(lastUpdated)}
            </span>
          )}
        </p>
      </div>

      {/* Time period filter */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">Show tokens from the last:</span>
        </div>
        <div className="flex gap-2">
          {[1, 3, 7, 14, 30].map((days) => (
            <Button
              key={days}
              variant={daysBack === days ? "default" : "outline"}
              size="sm"
              onClick={() => handleDaysBackChange(days)}
            >
              {days} day{days > 1 ? 's' : ''}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <TokenMarketTable
          tokens={newTokens}
          type="new"
          onTokenClick={handleTokenClick}
          isLoading={isLoading}
        />

        {!isLoading && newTokens.length === 0 && (
          <div className="rounded-md border p-8 text-center">
            <p className="text-muted-foreground">
              No new token listings found in the last {daysBack} day{daysBack > 1 ? 's' : ''}.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Try extending the time period to find more newly listed tokens.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-2">About New Listings</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Tokens are sorted by listing date (newest first)</p>
          <p>• Data refreshes every minute to capture new listings</p>
          <p>• Exercise caution with very new tokens - verify legitimacy before trading</p>
          <p>• Check market cap, volume, and holder distribution for risk assessment</p>
        </div>
      </div>
    </div>
  );
}
