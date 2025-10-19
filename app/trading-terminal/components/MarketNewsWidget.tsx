'use client';

import React from 'react';
import { Bell, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface MarketNewsWidgetProps {
  market: string;
}

export default function MarketNewsWidget({ market }: MarketNewsWidgetProps) {
  const newsItems = [
    {
      id: 1,
      type: 'price_alert',
      title: 'SOL breaks $150 resistance',
      time: '2m ago',
      sentiment: 'bullish',
      icon: TrendingUp,
    },
    {
      id: 2,
      type: 'whale_alert',
      title: 'Large buy order: 50K SOL',
      time: '5m ago',
      sentiment: 'bullish',
      icon: Bell,
    },
    {
      id: 3,
      type: 'volume_spike',
      title: 'Volume surge detected +45%',
      time: '8m ago',
      sentiment: 'neutral',
      icon: Info,
    },
    {
      id: 4,
      type: 'liquidity',
      title: 'New liquidity pool added',
      time: '12m ago',
      sentiment: 'bullish',
      icon: TrendingUp,
    },
    {
      id: 5,
      type: 'price_alert',
      title: 'Support level tested at $144',
      time: '15m ago',
      sentiment: 'bearish',
      icon: TrendingDown,
    },
  ];

  return (
    <div 
      className="market-news-widget h-full flex flex-col bg-background text-foreground overflow-hidden"
      data-widget-type="market-news"
      data-widget-market={market}
      data-ai-context="market-alerts-and-news"
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-primary">MARKET ALERTS</h3>
        <Bell size={12} className="text-muted-foreground" />
      </div>
      <div className="flex-1 overflow-auto">
        {newsItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <div
              key={`news-${item.id}`}
              className="px-3 py-2 border-b border-border hover:bg-muted cursor-pointer transition-colors"
              data-news-id={item.id}
              data-news-type={item.type}
              data-news-sentiment={item.sentiment}
            >
              <div className="flex items-start gap-2">
                <IconComponent 
                  size={14} 
                  className={`mt-0.5 flex-shrink-0 ${
                    item.sentiment === 'bullish' ? 'text-primary' :
                    item.sentiment === 'bearish' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground font-medium leading-tight">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {item.time}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
