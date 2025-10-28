'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PerformanceWidgetProps {
  market: string;
  isLoading?: boolean;
}

export default function PerformanceWidget({ market, isLoading = false }: PerformanceWidgetProps) {
  const timeframes = [
    { label: '1H', change: 0.82 },
    { label: '24H', change: 2.43 },
    { label: '7D', change: -3.21 },
  ];

  const metrics = [
    { label: 'Vol', value: '24.5%', trend: 'up' },
    { label: 'RSI', value: '68', trend: 'neutral' },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div 
        className="performance-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
        data-widget-type="performance"
        data-widget-market={market}
      >
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold text-primary">PERFORMANCE</h3>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-perf-${i}`} className="bg-card border border-border rounded p-2">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="performance-widget flex items-center gap-2 text-foreground w-full"
      data-widget-type="performance"
      data-widget-market={market}
      data-ai-context="market-performance-metrics"
    >
      {/* Compact Timeframe Performance */}
      <div className="flex items-center gap-1">
        {timeframes.map((tf, idx) => (
          <div
            key={`timeframe-${tf.label}-${idx}`}
            className="flex items-center gap-0.5 px-1 py-0"
            data-timeframe={tf.label}
            data-change={tf.change}
          >
            <span className="text-[9px] text-muted-foreground">{tf.label}</span>
            <span className={`text-[9px] font-mono font-semibold ${tf.change > 0 ? 'text-primary' : 'text-destructive'}`}>
              {tf.change > 0 ? '+' : ''}{tf.change}%
            </span>
          </div>
        ))}
      </div>

      {/* Compact divider */}
      <div className="h-3 w-px bg-border/50"></div>

      {/* Compact Technical Indicators */}
      <div className="flex items-center gap-1">
        {metrics.map((metric, idx) => (
          <div
            key={`metric-${metric.label}-${idx}`}
            className="flex items-center gap-0.5 px-1 py-0"
            data-metric-name={metric.label}
            data-metric-value={metric.value}
            data-metric-trend={metric.trend}
          >
            {metric.trend === 'up' && <TrendingUp size={8} className="text-primary flex-shrink-0" />}
            {metric.trend === 'down' && <TrendingDown size={8} className="text-destructive flex-shrink-0" />}
            <span className="text-[9px] text-muted-foreground">{metric.label}</span>
            <span className={`text-[9px] font-mono font-semibold ${
              metric.trend === 'up' ? 'text-primary' :
              metric.trend === 'down' ? 'text-destructive' :
              'text-foreground'
            }`}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
