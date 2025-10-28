'use client';

import React from 'react';
import { useRealTimeMarketData } from '@/components/hooks/trading/useRealTimeMarketData';
import { formatTimeAgo } from '@/lib/format-time';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketDepthWidgetProps {
  market: string;
  isLoading?: boolean;
}

export default function MarketDepthWidget({ market, isLoading = false }: MarketDepthWidgetProps) {
  // Use real-time market data hook
  const { data, lastUpdate, error } = useRealTimeMarketData(market, { interval: 2000 });
  
  // Mock market depth data (will be replaced with real data from API)
  const depthData = [
    { price: 145.50, bidSize: 12500, askSize: 8200, cumBid: 12500, cumAsk: 8200 },
    { price: 145.45, bidSize: 18300, askSize: 0, cumBid: 30800, cumAsk: 8200 },
    { price: 145.40, bidSize: 22100, askSize: 0, cumBid: 52900, cumAsk: 8200 },
    { price: 145.35, bidSize: 15600, askSize: 0, cumBid: 68500, cumAsk: 8200 },
    { price: 145.30, bidSize: 28900, askSize: 0, cumBid: 97400, cumAsk: 8200 },
    { price: 145.55, bidSize: 0, askSize: 15400, cumBid: 97400, cumAsk: 23600 },
    { price: 145.60, bidSize: 0, askSize: 19200, cumBid: 97400, cumAsk: 42800 },
    { price: 145.65, bidSize: 0, askSize: 24600, cumBid: 97400, cumAsk: 67400 },
    { price: 145.70, bidSize: 0, askSize: 31200, cumBid: 97400, cumAsk: 98600 },
  ];

  const maxCumSize = Math.max(...depthData.map(d => Math.max(d.cumBid, d.cumAsk)));

  // Loading state
  if (isLoading) {
    return (
      <div 
        className="market-depth-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
        data-widget-type="market-depth"
        data-widget-market={market}
      >
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-primary">MARKET DEPTH</h3>
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex-1 overflow-auto p-2">
          <div className="relative bg-card rounded border border-border p-2 space-y-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={`skeleton-depth-${i}`} className="h-5" />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded p-2">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="bg-card border border-border rounded p-2">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="market-depth-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
      data-widget-type="market-depth"
      data-widget-market={market}
      data-ai-context="market-depth-visualization"
      key={`depth-${market}-${lastUpdate}`}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-primary">MARKET DEPTH</h3>
        <span className="text-[10px] text-muted-foreground">
          {formatTimeAgo(lastUpdate)}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {error && (
          <div className="text-xs text-destructive p-2 bg-destructive/10 rounded mb-2">
            Error loading depth data
          </div>
        )}
        <div className="relative bg-card rounded border border-border p-2 space-y-0.5">
          {/* Depth visualization */}
          {depthData.map((item, idx) => {
            const bidWidth = (item.cumBid / maxCumSize) * 50;
            const askWidth = (item.cumAsk / maxCumSize) * 50;
            
            return (
              <div key={`depth-${idx}`} className="flex items-center h-5 relative">
                {/* Bid side (left, green) */}
                {item.bidSize > 0 && (
                  <div 
                    className="absolute left-0 h-full bg-primary/20 rounded-l"
                    style={{ width: `${bidWidth}%` }}
                  />
                )}
                {/* Ask side (right, red) */}
                {item.askSize > 0 && (
                  <div 
                    className="absolute right-0 h-full bg-destructive/20 rounded-r"
                    style={{ width: `${askWidth}%` }}
                  />
                )}
                {/* Price label */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="text-[10px] font-mono text-foreground/90 bg-background/90 px-1.5 rounded">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Stats */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded p-2">
            <div className="text-[10px] text-muted-foreground">Bid Depth</div>
            <div className="text-sm font-mono text-primary" data-metric="bid-depth">$97.4K</div>
          </div>
          <div className="bg-card border border-border rounded p-2">
            <div className="text-[10px] text-muted-foreground">Ask Depth</div>
            <div className="text-sm font-mono text-destructive" data-metric="ask-depth">$98.6K</div>
          </div>
        </div>
      </div>
    </div>
  );
}
