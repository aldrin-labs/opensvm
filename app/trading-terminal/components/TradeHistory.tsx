'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RotateCw, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTradingWebSocket } from '@/hooks/useTradingWebSocket';
import { getTokenMint } from '@/lib/trading/token-utils';

interface TradeHistoryProps {
  market: string;
  isLoading?: boolean;
}

interface Trade {
  id: string;
  time?: number;
  timestamp?: number;
  price: number;
  size?: number;
  amount?: number;
  side: 'buy' | 'sell';
  dex?: string;
  isNew?: boolean;
}

export default function TradeHistory({ market, isLoading = false }: TradeHistoryProps) {
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [historicalTrades, setHistoricalTrades] = useState<Trade[]>([]);

  // Get token mint dynamically from market pair
  const tokenMint = getTokenMint(market) || undefined;

  // Use WebSocket for real-time trades
  const { trades: realtimeTrades, status, connect: connectWS, disconnect: disconnectWS } = useTradingWebSocket({
    market,
    tokenMint,
    autoConnect: true,
    maxTrades: 250,
    onTrade: (trade) => {
      console.log('[TradeHistory] New trade:', trade);
    },
    onError: (error) => {
      console.error('[TradeHistory] WebSocket error:', error);
    },
  });

  // Fetch initial trades from API on mount (fallback for historical data)
  useEffect(() => {
    if (isLoading || !tokenMint) return;

    const fetchInitialTrades = async () => {
      try {
        setIsLoadingTrades(true);
        const response = await fetch(`/api/trading/trades?mint=${tokenMint}&limit=50`);

        if (response.ok) {
          const data = await response.json();
          const fetchedTrades = data.trades || [];
          console.log('[TradeHistory] Fetched initial trades:', fetchedTrades.length);
          
          // Store historical trades
          setHistoricalTrades(fetchedTrades.map((trade: any) => ({
            id: trade.signature || trade.id || `${trade.timestamp}-${Math.random()}`,
            timestamp: trade.timestamp || trade.time || Date.now(),
            time: trade.time || trade.timestamp || Date.now(),
            price: trade.price || 0,
            amount: trade.amount || trade.size || 0,
            size: trade.size || trade.amount || 0,
            side: trade.side || 'buy',
            dex: trade.dex,
            isNew: false,
          })));
        }
      } catch (error) {
        console.warn('[TradeHistory] Failed to fetch initial trades:', error);
      } finally {
        setIsLoadingTrades(false);
      }
    };

    // Fetch on mount or market change
    fetchInitialTrades();
  }, [market, isLoading, tokenMint]);

  // Merge real-time and historical trades
  const trades = React.useMemo(() => {
    // Combine real-time trades with historical trades
    const combined = [...realtimeTrades, ...historicalTrades];
    
    // Remove duplicates by ID
    const uniqueTrades = combined.reduce((acc, trade) => {
      if (!acc.find(t => t.id === trade.id)) {
        acc.push(trade);
      }
      return acc;
    }, [] as Trade[]);
    
    // Sort by timestamp (newest first) and limit to 50
    return uniqueTrades
      .sort((a, b) => (b.timestamp || b.time || 0) - (a.timestamp || a.time || 0))
      .slice(0, 50);
  }, [realtimeTrades, historicalTrades]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="trade-history h-full flex flex-col bg-background text-foreground">
        {/* Header */}
        <div className="px-4 py-2 bg-card border-b border-border grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
          <div className="text-left">TIME</div>
          <div className="text-right">PRICE</div>
          <div className="text-right">SIZE</div>
        </div>

        {/* Loading skeleton rows */}
        <div className="flex-1 overflow-hidden p-4 space-y-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="grid grid-cols-3 gap-2">
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="trade-history h-full flex flex-col bg-background text-foreground">
      {/* Header with WebSocket status */}
      <div className="px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-primary">Trade History</span>
          <div className="flex items-center gap-2">
            {isLoadingTrades && (
              <RotateCw size={12} className="animate-spin text-primary" />
            )}
            {/* WebSocket Connection Status */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border"
                 style={{
                   backgroundColor: status.connected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                   borderColor: status.connected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                   color: status.connected ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                 }}
                 title={status.connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}>
              {status.connected ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span>{status.connected ? 'Live' : (status.reconnecting ? 'Reconnecting...' : 'Offline')}</span>
            </div>
            {/* Trade Count */}
            {trades.length > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-primary/30 text-primary">
                <span className="w-1 h-1 rounded-full bg-primary"></span>
                <span>{trades.length} trades</span>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-muted-foreground">
          <div className="text-left">TIME</div>
          <div className="text-right">PRICE</div>
          <div className="text-right">SIZE</div>
          <div className="text-right">DEX</div>
        </div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto">
        {trades.map((trade, index) => (
          <div
            key={trade.id}
            className={`px-4 py-1 grid grid-cols-4 gap-2 text-xs font-mono hover:bg-muted cursor-pointer transition-all duration-150 ${
              trade.isNew ? 'animate-pulse bg-primary/10 border-l-2 border-primary' : ''
            }`}
          >
            <div className="text-left text-muted-foreground flex items-center gap-1">
              {trade.side === 'buy' ? (
                <TrendingUp size={12} className="text-primary flex-shrink-0" />
              ) : (
                <TrendingDown size={12} className="text-destructive flex-shrink-0" />
              )}
              <span>{formatTime(trade.time || trade.timestamp || Date.now())}</span>
            </div>
            <div className={`text-right font-semibold ${trade.side === 'buy' ? 'text-primary' : 'text-destructive'}`}>
              {trade.price.toFixed(2)}
            </div>
            <div className="text-right text-foreground">
              {(trade.size || trade.amount || 0).toFixed(4)}
            </div>
            <div className="text-right text-muted-foreground text-[10px]">
              {trade.dex ? trade.dex.substring(0, 6) : '—'}
            </div>
          </div>
        ))}
        {trades.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No trades available</p>
          </div>
        )}
      </div>
    </div>
  );
}
