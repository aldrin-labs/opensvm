/**
 * useMarketData Hook
 * 
 * Manages real-time market data for the trading terminal.
 * Connects to WebSocket for live price updates, order book, and trade history.
 * 
 * @module hooks/trading/useMarketData
 */

import { useState, useEffect, useCallback, useRef } from 'react';

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

export interface MarketData {
  stats: MarketStats;
  orderBook: OrderBook;
  recentTrades: Trade[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseMarketDataReturn extends MarketData {
  reconnect: () => void;
  refresh: () => void;
}

/**
 * Mock market data generator for development.
 * TODO: Replace with actual WebSocket connection to DEX.
 */
const generateMockMarketData = (_market: string): MarketData => {
  const basePrice = 150 + Math.random() * 50; // $150-200 range for SOL
  
  // Generate order book
  const generateOrderBook = (): OrderBook => {
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];
    
    for (let i = 0; i < 10; i++) {
      const bidPrice = basePrice - (i * 0.1);
      const askPrice = basePrice + (i * 0.1);
      const amount = Math.random() * 100;
      
      bids.push({
        price: bidPrice,
        amount,
        total: bidPrice * amount,
      });
      
      asks.push({
        price: askPrice,
        amount,
        total: askPrice * amount,
      });
    }
    
    const spread = asks[0].price - bids[0].price;
    const spreadPercent = (spread / bids[0].price) * 100;
    
    return { bids, asks, spread, spreadPercent };
  };
  
  // Generate recent trades
  const generateTrades = (): Trade[] => {
    const trades: Trade[] = [];
    const now = Date.now();
    
    for (let i = 0; i < 20; i++) {
      trades.push({
        id: `trade-${i}`,
        price: basePrice + (Math.random() - 0.5) * 2,
        amount: Math.random() * 10,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: now - i * 5000,
      });
    }
    
    return trades;
  };
  
  return {
    stats: {
      price: basePrice,
      change24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 1000000,
      high24h: basePrice + Math.random() * 10,
      low24h: basePrice - Math.random() * 10,
      lastUpdate: Date.now(),
    },
    orderBook: generateOrderBook(),
    recentTrades: generateTrades(),
    isConnected: true,
    isLoading: false,
    error: null,
  };
};

/**
 * Hook for managing real-time market data.
 * 
 * @param market - Market pair (e.g., 'SOL/USDC')
 * @param updateInterval - Update interval in milliseconds (default: 3000)
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
  updateInterval: number = 3000
): UseMarketDataReturn => {
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
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * Fetch and update market data
   */
  const fetchMarketData = useCallback(() => {
    if (!mountedRef.current) return;
    
    try {
      // TODO: Replace with actual WebSocket connection
      const data = generateMockMarketData(market);
      
      if (mountedRef.current) {
        setMarketData(data);
      }
    } catch (error) {
      if (mountedRef.current) {
        setMarketData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to fetch market data',
          isConnected: false,
          isLoading: false,
        }));
      }
    }
  }, [market]);

  /**
   * Reconnect to market data stream
   */
  const reconnect = useCallback(() => {
    setMarketData(prev => ({ ...prev, isLoading: true, error: null }));
    fetchMarketData();
  }, [fetchMarketData]);

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

  return {
    ...marketData,
    reconnect,
    refresh,
  };
};

export default useMarketData;
