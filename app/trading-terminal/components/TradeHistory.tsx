'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TradeHistoryProps {
  market: string;
  isLoading?: boolean;
}

interface Trade {
  id: string;
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export default function TradeHistory({ market, isLoading = false }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (isLoading) return; // Don't generate data while loading
    
    // Generate mock trade data
    const generateTrades = () => {
      const newTrades: Trade[] = [];
      const basePrice = 100 + Math.random() * 50;
      
      for (let i = 0; i < 30; i++) {
        newTrades.push({
          id: `trade-${Date.now()}-${i}`,
          time: Date.now() - (i * 5000),
          price: basePrice + (Math.random() - 0.5) * 2,
          size: 0.1 + Math.random() * 10,
          side: Math.random() > 0.5 ? 'buy' : 'sell',
        });
      }
      
      setTrades(newTrades);
    };

    generateTrades();
    const interval = setInterval(() => {
      // Add new trade at the top
      setTrades(prev => {
        const basePrice = prev.length > 0 ? prev[0].price : 100;
        const newTrade: Trade = {
          id: `trade-${Date.now()}`,
          time: Date.now(),
          price: basePrice + (Math.random() - 0.5) * 0.5,
          size: 0.1 + Math.random() * 10,
          side: Math.random() > 0.5 ? 'buy' : 'sell',
        };
        return [newTrade, ...prev.slice(0, 29)];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [market, isLoading]);

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
      {/* Header */}
      <div className="px-4 py-2 bg-card border-b border-border grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
        <div className="text-left">TIME</div>
        <div className="text-right">PRICE</div>
        <div className="text-right">SIZE</div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto">
        {trades.map((trade, index) => (
          <div
            key={trade.id}
            className={`px-4 py-1 grid grid-cols-3 gap-2 text-xs font-mono hover:bg-muted cursor-pointer transition-colors ${
              index === 0 ? 'animate-pulse' : ''
            }`}
          >
            <div className="text-left text-muted-foreground flex items-center gap-1">
              {trade.side === 'buy' ? (
                <TrendingUp size={12} className="text-primary" />
              ) : (
                <TrendingDown size={12} className="text-destructive" />
              )}
              {formatTime(trade.time)}
            </div>
            <div className={`text-right ${trade.side === 'buy' ? 'text-primary' : 'text-destructive'}`}>
              {trade.price.toFixed(2)}
            </div>
            <div className="text-right text-foreground">
              {trade.size.toFixed(4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
