'use client';

import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface OrderBookProps {
  market: string;
  isLoading?: boolean;
}

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

interface AMMState {
  type: string;
  dex: string;
  poolAddress: string;
  liquidity: number;
  baseReserve: number;
  quoteReserve: number;
  constantProduct: number;
  fee: number;
  volume24h: number;
  trades24h: number;
  priceImpact: {
    buy100: number;
    buy1000: number;
    sell100: number;
    sell1000: number;
  };
  virtualOrderbook?: {
    bids: Array<{ price: number; amount: number }>;
    asks: Array<{ price: number; amount: number }>;
    spread: number;
    spreadPercent: number;
    isVirtual?: boolean;
  };
}

export default function OrderBook({ market, isLoading = false }: OrderBookProps) {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [spread, setSpread] = useState(0);
  const [spreadPercent, setSpreadPercent] = useState(0);
  const [ammState, setAmmState] = useState<AMMState | null>(null);
  const [isVirtualOrderbook, setIsVirtualOrderbook] = useState(false);
  const [isRealData, setIsRealData] = useState(false);
  const [dataSource, setDataSource] = useState('Loading...');

  useEffect(() => {
    if (isLoading) return;

    const fetchMarketData = async () => {
      try {
        const response = await fetch(`/api/trading/market-data?market=${encodeURIComponent(market)}`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (data.ammState && (!data.orderBook || data.orderBook.isVirtual)) {
          // We have AMM state, use virtual orderbook if available
          setAmmState(data.ammState);
          setIsVirtualOrderbook(true);

          if (data.ammState.virtualOrderbook) {
            const { bids: virtualBids, asks: virtualAsks, spread: virtualSpread, spreadPercent: virtualSpreadPercent } = data.ammState.virtualOrderbook;

            // Convert to OrderBookEntry format with running totals
            let totalBid = 0;
            const bidData = virtualBids.map((bid: any) => {
              totalBid += bid.amount;
              return { price: bid.price, size: bid.amount, total: totalBid };
            });

            let totalAsk = 0;
            const askData = virtualAsks.map((ask: any) => {
              totalAsk += ask.amount;
              return { price: ask.price, size: ask.amount, total: totalAsk };
            });

            setBids(bidData);
            setAsks(askData);
            setSpread(virtualSpread);
            setSpreadPercent(virtualSpreadPercent);
          }
        } else if (data.orderBook) {
          // Traditional orderbook
          setAmmState(null);
          setIsVirtualOrderbook(false);

          let totalBid = 0;
          const bidData = (data.orderBook.bids || []).map((bid: any) => {
            totalBid += bid.amount;
            return { price: bid.price, size: bid.amount, total: totalBid };
          });

          let totalAsk = 0;
          const askData = (data.orderBook.asks || []).map((ask: any) => {
            totalAsk += ask.amount;
            return { price: ask.price, size: ask.amount, total: totalAsk };
          });

          setBids(bidData);
          setAsks(askData);
          setSpread(data.orderBook.spread || 0);
          setSpreadPercent(data.orderBook.spreadPercent || 0);
        } else {
          // Fallback to mock data generation
          generateMockOrderBook();
        }

        setIsRealData(data.isRealData || false);
        setDataSource(data.dataSource || 'Unknown');

      } catch (error) {
        console.error('Failed to fetch market data:', error);
        // Fallback to mock data
        generateMockOrderBook();
        setIsRealData(false);
        setDataSource('Mock Data (API error)');
      }
    };

    const generateMockOrderBook = () => {
      const basePrice = 100 + Math.random() * 50;
      const bidData: OrderBookEntry[] = [];
      const askData: OrderBookEntry[] = [];

      let totalBid = 0;
      let totalAsk = 0;

      for (let i = 0; i < 15; i++) {
        const price = basePrice - (i * 0.1);
        const size = 10 + Math.random() * 100;
        totalBid += size;
        bidData.push({ price, size, total: totalBid });
      }

      for (let i = 0; i < 15; i++) {
        const price = basePrice + 0.05 + (i * 0.1);
        const size = 10 + Math.random() * 100;
        totalAsk += size;
        askData.push({ price, size, total: totalAsk });
      }

      setBids(bidData);
      setAsks(askData);

      if (bidData.length > 0 && askData.length > 0) {
        const spreadValue = askData[0].price - bidData[0].price;
        const spreadPct = (spreadValue / bidData[0].price) * 100;
        setSpread(spreadValue);
        setSpreadPercent(spreadPct);
      }

      setAmmState(null);
      setIsVirtualOrderbook(false);
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 10000); // Update every 10 seconds
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

  // Helper function to format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  return (
    <div className="order-book h-full flex flex-col bg-background text-foreground">
      {/* Header with data source indicator */}
      <div className="px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">
              {ammState ? 'AMM Pool State' : 'Order Book'}
            </span>
            {isVirtualOrderbook && (
              <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                Virtual
              </span>
            )}
            {dataSource && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border"
                   style={{
                     backgroundColor: isRealData ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                     borderColor: isRealData ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                     color: isRealData ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                   }}>
                <span className="w-1 h-1 rounded-full"
                      style={{
                        backgroundColor: isRealData ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                      }}></span>
                <span>{isRealData ? 'Live' : 'Demo'}</span>
              </div>
            )}
          </div>
          {ammState && (
            <span className="text-[10px] text-muted-foreground">
              {ammState.dex}
            </span>
          )}
        </div>

        {/* AMM State Info Panel */}
        {ammState && (
          <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-muted/20 rounded text-xs">
            <div className="flex items-center gap-1">
              <Droplets size={12} className="text-primary" />
              <span className="text-muted-foreground">Liquidity:</span>
              <span className="text-foreground font-mono">${formatNumber(ammState.liquidity)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity size={12} className="text-primary" />
              <span className="text-muted-foreground">24h Vol:</span>
              <span className="text-foreground font-mono">${formatNumber(ammState.volume24h)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Base Reserve:</span>
              <span className="text-foreground font-mono">{formatNumber(ammState.baseReserve)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Quote Reserve:</span>
              <span className="text-foreground font-mono">{formatNumber(ammState.quoteReserve)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Fee:</span>
              <span className="text-foreground font-mono">{(ammState.fee * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">24h Trades:</span>
              <span className="text-foreground font-mono">{ammState.trades24h}</span>
            </div>

            {/* Price Impact Section */}
            <div className="col-span-2 mt-1 pt-1 border-t border-border/50">
              <div className="text-muted-foreground mb-1">Price Impact:</div>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-green-500" />
                  <span className="text-[10px]">Buy $100: {ammState.priceImpact.buy100.toFixed(3)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-green-500" />
                  <span className="text-[10px]">Buy $1k: {ammState.priceImpact.buy1000.toFixed(3)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown size={10} className="text-red-500" />
                  <span className="text-[10px]">Sell $100: {ammState.priceImpact.sell100.toFixed(3)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown size={10} className="text-red-500" />
                  <span className="text-[10px]">Sell $1k: {ammState.priceImpact.sell1000.toFixed(3)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
          <div className="text-right">PRICE</div>
          <div className="text-right">SIZE</div>
          <div className="text-right">TOTAL</div>
        </div>
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
                className="relative px-4 py-0.5 grid grid-cols-3 gap-2 text-xs font-mono hover:bg-muted cursor-pointer transition-colors duration-150"
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
                className="relative px-4 py-0.5 grid grid-cols-3 gap-2 text-xs font-mono hover:bg-muted cursor-pointer transition-colors duration-150"
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
