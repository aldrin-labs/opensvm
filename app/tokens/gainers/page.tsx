'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import TokenMarketTable from '@/components/TokenMarketTable';
import { Badge } from '@/components/ui/badge';
import { getTopGainers } from '@/lib/mock-token-data';
import type { TokenGainerData } from '@/types/token-market';

export default function TokenGainersPage() {
  const settings = useSettings();
  const router = useRouter();
  const [gainers, setGainers] = useState<TokenGainerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-refresh data every 15 seconds for real-time updates
  useEffect(() => {
    const loadGainers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTopGainers(50);
        setGainers(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Error loading gainers:', err);
        setError('Failed to load gainers data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadGainers();

    // Set up auto-refresh for gainers (more frequent updates)
    const interval = setInterval(loadGainers, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const handleTokenClick = (address: string) => {
    router.push(`/token/${address}`);
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
          <h1 className="text-4xl font-bold">Top Gainers</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            📈 Live
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Tokens with the highest price increases in the last 24 hours. 
          {lastUpdated && (
            <span className="block mt-1 text-sm">
              Last updated: {formatTime(lastUpdated)}
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <TokenMarketTable
          tokens={gainers}
          type="gainers"
          onTokenClick={handleTokenClick}
          isLoading={isLoading}
        />

        {!isLoading && gainers.length === 0 && (
          <div className="rounded-md border p-8 text-center">
            <p className="text-muted-foreground">No gaining tokens found at the moment.</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-2">About Top Gainers</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Rankings based on 24-hour price change percentage</p>
          <p>• Data refreshes every 15 seconds for real-time tracking</p>
          <p>• Only tokens with positive price movement are displayed</p>
          <p>• Market cap and volume data helps assess token liquidity</p>
        </div>
      </div>
    </div>
  );
}
