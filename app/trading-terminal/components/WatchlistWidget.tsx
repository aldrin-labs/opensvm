'use client';

import React, { useState } from 'react';
import { Star, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface WatchlistWidgetProps {
  onMarketChange?: (market: string) => void;
  isLoading?: boolean;
}

export default function WatchlistWidget({ onMarketChange, isLoading = false }: WatchlistWidgetProps) {
  const [watchlist] = useState([
    { symbol: 'SOL/USDC', price: 145.32, change: 2.43, volume: 12.46, starred: true },
    { symbol: 'BTC/USDC', price: 67234.50, change: -0.82, volume: 145.2, starred: true },
    { symbol: 'ETH/USDC', price: 3521.18, change: 1.67, volume: 67.3, starred: true },
    { symbol: 'JTO/USDC', price: 2.87, change: 5.21, volume: 3.8, starred: true },
    { symbol: 'BONK/USDC', price: 0.000023, change: -3.45, volume: 8.9, starred: false },
  ]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div 
        className="watchlist-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
        data-widget-type="watchlist"
      >
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-primary">WATCHLIST</h3>
          <Plus size={12} className="text-muted-foreground" />
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="flex items-center gap-2 p-2">
              <Skeleton className="w-4 h-4 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="watchlist-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
      data-widget-type="watchlist"
      data-ai-context="user-watchlist"
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-primary">WATCHLIST</h3>
        <button className="p-1 hover:bg-muted rounded">
          <Plus size={12} className="text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-card sticky top-0 z-10">
            <tr className="border-b border-border">
              <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">PAIR</th>
              <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">PRICE</th>
              <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">24H%</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((item, idx) => (
              <tr
                key={`watchlist-${idx}-${item.symbol}`}
                className="border-b border-border hover:bg-muted cursor-pointer transition-colors duration-150"
                onClick={() => onMarketChange?.(item.symbol)}
                data-watchlist-symbol={item.symbol}
                data-watchlist-price={item.price}
                data-watchlist-change={item.change}
              >
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    {item.starred && <Star size={10} className="text-primary fill-primary flex-shrink-0" />}
                    <span className="font-medium text-foreground">{item.symbol}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">
                  ${item.price < 1 ? item.price.toFixed(6) : item.price.toFixed(2)}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono ${item.change > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
