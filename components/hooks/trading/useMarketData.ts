/**
 * useMarketData Hook
 * 
 * Manages real-time market data for the trading terminal.
 * Connects to WebSocket for live price updates, order book, and trade history.
 * 
 * @module hooks/trading/useMarketData
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotificationsSafe } from '@/components/providers/NotificationProvider';

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercent: number;
}

export interface Trade {
  id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface MarketStats {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
}

export interface LoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  loadingStage?: 'connecting' | 'fetching' | 'processing';
  progress?: number; // 0-100 for progress indicators
}

export interface ErrorState {
  hasError: boolean;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    retryAction?: () => void;
  } | null;
}

export interface MarketData {
  stats: MarketStats;
  orderBook: OrderBook;
  recentTrades: Trade[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  // Enhanced state management
  loadingState: LoadingState;
  errorState: ErrorState;
  // Real data indicators
  isRealData?: boolean;
  dataSource?: string;
}

export interface UseMarketDataReturn extends MarketData {
  reconnect: () => void;
  refresh: () => void;
  retry: () => void;
}
/**
 * Hook for managing real-time market data.
 * Now uses real API data from Jupiter/CoinGecko with fallback to mock data.
 * 
 * @param market - Market pair (e.g., 'SOL/USDC')
 * @param updateInterval - Update interval in milliseconds (default: 10000)
 * @returns Market data and control functions
 * 
 * @example
 * ```tsx
 * const { stats, orderBook, recentTrades, isConnected } = useMarketData('SOL/USDC');
 * 
 * return (
 *   <div>
 *     <p>Price: ${stats.price}</p>
 *     <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
 *   </div>
 * );
 * ```
 */
export const useMarketData = (
  market: string,
  updateInterval: number = 10000 // 10 seconds for real API calls
): UseMarketDataReturn => {
  // Use safe notification hook that doesn't throw if provider is missing
  const { addNotification } = useNotificationsSafe();
  const [marketData, setMarketData] = useState<MarketData>({
    stats: {
      price: 0,
      change24h: 0,
      volume24h: 0,
      high24h: 0,
      low24h: 0,
      lastUpdate: 0,
    },
    orderBook: {
      bids: [],
      asks: [],
      spread: 0,
      spreadPercent: 0,
    },
    recentTrades: [],
    isConnected: false,
    isLoading: true,
    error: null,
    loadingState: {
      isLoading: true,
      isRefreshing: false,
      loadingStage: 'connecting',
    },
    errorState: {
      hasError: false,
      error: null,
    },
    isRealData: false,
    dataSource: 'Loading...', // Initial value so badge shows
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * Fetch and update market data from real API
   */
  const fetchMarketData = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      // Fetch from real market data API
      const response = await fetch(`/api/trading/market-data?market=${encodeURIComponent(market)}`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const apiData = await response.json();
      
      if (mountedRef.current) {
        setMarketData({
          stats: {
            price: apiData.price,
            change24h: apiData.change24h,
            volume24h: apiData.volume24h,
            high24h: apiData.high24h,
            low24h: apiData.low24h,
            lastUpdate: apiData.lastUpdate,
          },
          orderBook: apiData.orderBook || {
            bids: [],
            asks: [],
            spread: 0,
            spreadPercent: 0,
          },
          recentTrades: apiData.recentTrades || [],
          isConnected: true,
          isLoading: false,
          error: null,
          loadingState: {
            isLoading: false,
            isRefreshing: false,
          },
          errorState: {
            hasError: false,
            error: null,
          },
          isRealData: apiData.isRealData,
          dataSource: apiData.dataSource,
        });
        
        // DISABLED: Development mode notification removed per bug fix
        // Mock data usage is logged to console instead for debugging
        if (!apiData.isRealData && process.env.NODE_ENV === 'development') {
          console.info('[Market Data] Using mock data - Real API unavailable');
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market data';
        
        setMarketData(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false,
          errorState: {
            hasError: true,
            error: {
              code: 'FETCH_ERROR',
              message: errorMessage,
              recoverable: true,
              retryAction: fetchMarketData,
            },
          },
        }));
        
        // Show error notification
        addNotification({
          type: 'error',
          title: 'Market Data Error',
          message: errorMessage,
          action: {
            label: 'Retry',
            onClick: () => fetchMarketData(),
          },
          duration: 5000,
        });
      }
    }
  }, [market, addNotification]);

  /**
   * Reconnect to market data stream
   */
  const reconnect = useCallback(() => {
    setMarketData(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      loadingState: {
        isLoading: true,
        isRefreshing: false,
        loadingStage: 'connecting',
      },
      errorState: {
        hasError: false,
        error: null,
      },
    }));
    
    fetchMarketData();
    
    // Show reconnecting notification
    addNotification({
      type: 'info',
      title: 'Reconnecting to Market',
      message: `Reconnecting to ${market}...`,
      duration: 2000,
    });
  }, [fetchMarketData, market, addNotification]);

  /**
   * Force refresh market data
   */
  const refresh = useCallback(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Initialize and setup polling
  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch
    fetchMarketData();
    
    // Setup polling interval
    intervalRef.current = setInterval(fetchMarketData, updateInterval);
    
    // Cleanup
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [market, updateInterval, fetchMarketData]);

  /**
   * Retry after error with exponential backoff
   */
  const retry = useCallback(() => {
    setMarketData(prev => ({
      ...prev,
      loadingState: {
        isLoading: true,
        isRefreshing: false,
        loadingStage: 'connecting',
      },
      errorState: {
        hasError: false,
        error: null,
      },
    }));
    fetchMarketData();
  }, [fetchMarketData]);

  return {
    ...marketData,
    reconnect,
    refresh,
    retry,
  };
};

export default useMarketData;
