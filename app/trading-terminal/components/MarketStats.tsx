'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarketStatsProps {
  market: string;
}

interface Stats {
  lastPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export default function MarketStats({ market }: MarketStatsProps) {
  const [stats, setStats] = useState<Stats>({
    lastPrice: 145.32,
    change24h: 3.45,
    changePercent24h: 2.43,
    high24h: 148.75,
    low24h: 140.12,
    volume24h: 12458923,
  });

  useEffect(() => {
    // Simulate real-time price updates
    const interval = setInterval(() => {
      setStats(prev => {
        const priceChange = (Math.random() - 0.5) * 0.5;
        const newPrice = prev.lastPrice + priceChange;
        return {
          ...prev,
          lastPrice: newPrice,
          change24h: prev.change24h + priceChange,
          changePercent24h: ((newPrice - (prev.lastPrice - prev.change24h)) / (prev.lastPrice - prev.change24h)) * 100,
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [market]);

  const isPositive = stats.changePercent24h >= 0;

  return (
    <div className="market-stats flex items-center gap-4 text-xs">
      {/* Last Price */}
      <div 
        className="flex items-center gap-1.5 cursor-help" 
        title="Most recent trade price for this market"
      >
        <span className="text-muted-foreground">Last Price:</span>
        <span className={`font-mono font-bold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
          ${stats.lastPrice.toFixed(2)}
        </span>
      </div>

      {/* 24h Change */}
      <div 
        className="flex items-center gap-1.5 cursor-help" 
        title="Price change over the last 24 hours (absolute and percentage)"
      >
        <span className="text-muted-foreground">24h Change:</span>
        <div className={`flex items-center gap-1 font-mono font-semibold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{isPositive ? '+' : ''}{stats.change24h.toFixed(2)} ({isPositive ? '+' : ''}{stats.changePercent24h.toFixed(2)}%)</span>
        </div>
      </div>

      {/* 24h High */}
      <div 
        className="flex items-center gap-1.5 cursor-help" 
        title="Highest price reached in the last 24 hours"
      >
        <span className="text-muted-foreground">24h High:</span>
        <span className="font-mono text-foreground">${stats.high24h.toFixed(2)}</span>
      </div>

      {/* 24h Low */}
      <div 
        className="flex items-center gap-1.5 cursor-help" 
        title="Lowest price reached in the last 24 hours"
      >
        <span className="text-muted-foreground">24h Low:</span>
        <span className="font-mono text-foreground">${stats.low24h.toFixed(2)}</span>
      </div>

      {/* 24h Volume */}
      <div 
        className="flex items-center gap-1.5 cursor-help" 
        title="Total trading volume in USD over the last 24 hours"
      >
        <span className="text-muted-foreground">24h Volume:</span>
        <div className="flex items-center gap-1">
          <Activity size={12} className="text-primary" />
          <span className="font-mono text-foreground">
            ${(stats.volume24h / 1000000).toFixed(2)}M
          </span>
        </div>
      </div>
    </div>
  );
}
