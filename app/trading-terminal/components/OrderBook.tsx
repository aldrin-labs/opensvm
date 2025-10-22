'use client';

import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface OrderBookProps {
  market: string;
  isLoading?: boolean;
}

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export default function OrderBook({ market, isLoading = false }: OrderBookProps) {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [spread, setSpread] = useState(0);
  const [spreadPercent, setSpreadPercent] = useState(0);

  useEffect(() => {
    if (isLoading) return; // Don't generate data while loading

    // Generate mock order book data
    const generateOrderBook = () => {
      const basePrice = 100 + Math.random() * 50;
      const bidData: OrderBookEntry[] = [];
      const askData: OrderBookEntry[] = [];

      let totalBid = 0;
      let totalAsk = 0;

      // Generate bids (buy orders)
      for (let i = 0; i < 15; i++) {
        const price = basePrice - (i * 0.1);
        const size = 10 + Math.random() * 100;
        totalBid += size;
        bidData.push({ price, size, total: totalBid });
      }

      // Generate asks (sell orders)
      for (let i = 0; i < 15; i++) {
        const price = basePrice + 0.05 + (i * 0.1);
        const size = 10 + Math.random() * 100;
        totalAsk += size;
        askData.push({ price, size, total: totalAsk });
      }

      setBids(bidData);
      setAsks(askData);

      // Calculate spread
      if (bidData.length > 0 && askData.length > 0) {
        const spreadValue = askData[0].price - bidData[0].price;
        const spreadPct = (spreadValue / bidData[0].price) * 100;
        setSpread(spreadValue);
        setSpreadPercent(spreadPct);
      }
    };

    generateOrderBook();
    const interval = setInterval(generateOrderBook, 2000);
    return () => clearInterval(interval);
  }, [market, isLoading]);

  const maxBidTotal = bids[bids.length - 1]?.total || 1;
  const maxAskTotal = asks[asks.length - 1]?.total || 1;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="order-book h-full flex flex-col bg-background text-foreground">
        {/* Header */}
        <div className="px-4 py-2 bg-card border-b border-border grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
          <div className="text-right">PRICE</div>
          <div className="text-right">SIZE</div>
          <div className="text-right">TOTAL</div>
        </div>

        {/* Loading skeleton rows */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-2">
          {Array.from({ length: 15 }).map((_, i) => (
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
    <div className="order-book h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="px-4 py-2 bg-card border-b border-border grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
        <div className="text-right">PRICE</div>
        <div className="text-right">SIZE</div>
        <div className="text-right">TOTAL</div>
      </div>

      {/* Order Book Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Asks (Sell Orders) - Red */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse">
          {asks.slice(0, 15).reverse().map((ask, index) => {
            const fillPercent = (ask.total / maxAskTotal) * 100;
            return (
              <div
                key={`ask-${index}`}
                className="relative px-4 py-0.5 grid grid-cols-3 gap-2 text-xs font-mono hover:bg-muted cursor-pointer"
              >
                <div
                  className="absolute right-0 top-0 h-full bg-destructive opacity-10"
                  style={{ width: `${fillPercent}%` }}
                />
                <div className="relative text-right text-destructive">
                  {ask.price.toFixed(2)}
                </div>
                <div className="relative text-right text-foreground">
                  {ask.size.toFixed(4)}
                </div>
                <div className="relative text-right text-muted-foreground">
                  {ask.total.toFixed(4)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spread */}
        <div className="px-4 py-2 bg-card border-y border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">
              {bids[0]?.price.toFixed(2) || '0.00'}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2L6 10M6 10L3 7M6 10L9 7" stroke="#4ec9b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-xs text-muted-foreground">
            Spread: {spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
          </div>
        </div>

        {/* Bids (Buy Orders) - Green */}
        <div className="flex-1 overflow-y-auto">
          {bids.slice(0, 15).map((bid, index) => {
            const fillPercent = (bid.total / maxBidTotal) * 100;
            return (
              <div
                key={`bid-${index}`}
                className="relative px-4 py-0.5 grid grid-cols-3 gap-2 text-xs font-mono hover:bg-muted cursor-pointer"
              >
                <div
                  className="absolute right-0 top-0 h-full bg-primary opacity-10"
                  style={{ width: `${fillPercent}%` }}
                />
                <div className="relative text-right text-primary">
                  {bid.price.toFixed(2)}
                </div>
                <div className="relative text-right text-foreground">
                  {bid.size.toFixed(4)}
                </div>
                <div className="relative text-right text-muted-foreground">
                  {bid.total.toFixed(4)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
