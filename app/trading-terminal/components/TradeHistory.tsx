'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TradeHistoryProps {
  market: string;
}

interface Trade {
  id: string;
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export default function TradeHistory({ market }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
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
      const basePrice = trades.length > 0 ? trades[0].price : 100;
      const newTrade: Trade = {
        id: `trade-${Date.now()}`,
        time: Date.now(),
        price: basePrice + (Math.random() - 0.5) * 0.5,
        size: 0.1 + Math.random() * 10,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
      };
      
      setTrades(prev => [newTrade, ...prev.slice(0, 29)]);
    }, 3000);

    return () => clearInterval(interval);
  }, [market]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="trade-history h-full flex flex-col bg-[#1e1e1e] text-[#cccccc]">
      {/* Header */}
      <div className="px-4 py-2 bg-[#252526] border-b border-[#3e3e42] grid grid-cols-3 gap-2 text-xs font-semibold text-[#858585]">
        <div className="text-left">TIME</div>
        <div className="text-right">PRICE</div>
        <div className="text-right">SIZE</div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto">
        {trades.map((trade, index) => (
          <div
            key={trade.id}
            className={`px-4 py-1 grid grid-cols-3 gap-2 text-xs font-mono hover:bg-[#2a2d2e] cursor-pointer transition-colors ${
              index === 0 ? 'animate-pulse' : ''
            }`}
          >
            <div className="text-left text-[#858585] flex items-center gap-1">
              {trade.side === 'buy' ? (
                <TrendingUp size={12} className="text-[#4ec9b0]" />
              ) : (
                <TrendingDown size={12} className="text-[#f48771]" />
              )}
              {formatTime(trade.time)}
            </div>
            <div className={`text-right ${trade.side === 'buy' ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>
              {trade.price.toFixed(2)}
            </div>
            <div className="text-right text-[#cccccc]">
              {trade.size.toFixed(4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
