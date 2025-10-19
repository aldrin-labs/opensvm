'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface PerformanceWidgetProps {
  market: string;
}

export default function PerformanceWidget({ market }: PerformanceWidgetProps) {
  const timeframes = [
    { label: '1H', change: 0.82, volume: 2.3 },
    { label: '4H', change: 1.45, volume: 8.7 },
    { label: '24H', change: 2.43, volume: 12.5 },
    { label: '7D', change: -3.21, volume: 45.2 },
    { label: '30D', change: 12.67, volume: 234.5 },
  ];

  const metrics = [
    { label: 'Volatility', value: '24.5%', trend: 'up' },
    { label: 'RSI (14)', value: '68.2', trend: 'neutral' },
    { label: 'MACD', value: 'Bullish', trend: 'up' },
    { label: 'Avg Volume', value: '$12.5M', trend: 'up' },
  ];

  return (
    <div 
      className="performance-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
      data-widget-type="performance"
      data-widget-market={market}
      data-ai-context="market-performance-metrics"
    >
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Activity size={12} className="text-primary" />
        <h3 className="text-xs font-semibold text-primary">PERFORMANCE</h3>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {/* Timeframe Performance */}
        <div className="mb-3">
          <div className="text-[10px] text-muted-foreground uppercase mb-1.5 px-1">Price Change</div>
          <div className="grid grid-cols-5 gap-1">
            {timeframes.map((tf, idx) => (
              <div
                key={`timeframe-${tf.label}-${idx}`}
                className="bg-card border border-border rounded p-1.5"
                data-timeframe={tf.label}
                data-change={tf.change}
              >
                <div className="text-[9px] text-muted-foreground text-center">{tf.label}</div>
                <div className={`text-xs font-mono text-center font-semibold ${tf.change > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {tf.change > 0 ? '+' : ''}{tf.change}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div>
          <div className="text-[10px] text-muted-foreground uppercase mb-1.5 px-1">Technical Indicators</div>
          <div className="space-y-1">
            {metrics.map((metric, idx) => (
              <div
                key={`metric-${metric.label}-${idx}`}
                className="bg-card border border-border rounded p-2 flex items-center justify-between"
                data-metric-name={metric.label}
                data-metric-value={metric.value}
                data-metric-trend={metric.trend}
              >
                <div className="flex items-center gap-1.5">
                  {metric.trend === 'up' && <TrendingUp size={10} className="text-primary flex-shrink-0" />}
                  {metric.trend === 'down' && <TrendingDown size={10} className="text-destructive flex-shrink-0" />}
                  <span className="text-[10px] text-foreground">{metric.label}</span>
                </div>
                <span className={`text-xs font-mono font-semibold ${
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
      </div>
    </div>
  );
}
