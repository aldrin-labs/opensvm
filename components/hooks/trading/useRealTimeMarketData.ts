"use client";

import { useState, useEffect, useCallback } from 'react';

interface RealTimeMarketDataOptions {
  interval?: number; // Polling interval in milliseconds
  enabled?: boolean; // Whether to enable polling
}

interface RealTimeMarketDataResult<T> {
  data: T | null;
  lastUpdate: number;
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Hook for real-time market data updates with automatic polling
 * @param market - Market pair (e.g., "SOL/USDC")
 * @param options - Configuration options
 * @returns Market data with real-time updates
 */
export function useRealTimeMarketData<T = any>(
  market: string,
  options: RealTimeMarketDataOptions = {}
): RealTimeMarketDataResult<T> {
  const { interval = 2000, enabled = true } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/trading/market-data?market=${encodeURIComponent(market)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      setData(result);
      setLastUpdate(Date.now());
      setError(null);
      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsLoading(false);
      console.error('[useRealTimeMarketData] Error fetching data:', errorMessage);
    }
  }, [market]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let pollInterval: NodeJS.Timeout;

    const startPolling = async () => {
      // Initial fetch
      if (isMounted) {
        await fetchData();
      }

      // Set up polling
      pollInterval = setInterval(async () => {
        if (isMounted) {
          await fetchData();
        }
      }, interval);
    };

    startPolling();

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [market, interval, enabled, fetchData]);

  return {
    data,
    lastUpdate,
    error,
    isLoading,
    refetch: fetchData,
  };
}
