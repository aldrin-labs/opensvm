'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

interface MarketData {
  symbol: string;
  baseToken: string;
  quoteToken: string;
  platform: string;
  lastPrice: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  spread: number;
  marketCap?: number;
  orderBook: {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
  };
  recentTrades: Array<{
    price: number;
    size: number;
    time: string;
    side: 'buy' | 'sell';
  }>;
}

interface CLOBPlatform {
  name: string;
  totalVolume24h: number;
  totalMarkets: number;
  totalUsers: number;
  averageSpread: number;
  description: string;
  website: string;
  features: string[];
}

export default function CLOBsSection() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [platforms, setPlatforms] = useState<CLOBPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'volume' | 'priceChange' | 'spread'>('volume');

  const fetchCLOBData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/clobs');
      const data = await response.json();

      if (data.success && data.data) {
        setPlatforms(data.data.platforms || []);
        setMarkets(data.data.markets || []);
        if (!selectedMarket && data.data.markets?.length > 0) {
          setSelectedMarket(data.data.markets[0].symbol);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Failed to fetch CLOB data:', error);
      setPlatforms([]);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMarket]);

  useEffect(() => {
    fetchCLOBData();
    const interval = setInterval(() => fetchCLOBData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchCLOBData]);

  const filteredAndSortedMarkets = markets
    .filter(market => {
      const matchesPlatform = platformFilter === 'all' || market.platform === platformFilter;
      return matchesPlatform;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'priceChange':
          return b.priceChange24h - a.priceChange24h;
        case 'spread':
          return a.spread - b.spread; // Lower spread is better
        default:
          return 0;
      }
    });

  const selectedMarketData = markets.find(m => m.symbol === selectedMarket);

  const formatCurrency = (value: number, decimals: number = 2) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(decimals)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(decimals)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(decimals)}K`;
    return `$${value.toFixed(decimals)}`;
  };

  const formatPrice = (price: number, symbol: string) => {
    const decimals = symbol.includes('SOL') || symbol.includes('USDC') ? 4 : 6;
    return price.toFixed(decimals);
  };

  const getPlatformColor = (platform: string) => {
    const colors: { [key: string]: string } = {
      'Phoenix': 'bg-warning/10 text-warning',
      'OpenBook': 'bg-success/10 text-success',
      'Drift (Spot)': 'bg-primary/10 text-primary',
      'Zeta Markets (Spot)': 'bg-destructive/10 text-destructive'
    };
    return colors[platform] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana CLOBs (Central Limit Order Books)</h2>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {platforms.map((platform) => (
          <Card key={platform.name} className="p-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">{platform.name}</h3>
              <p className="text-sm text-muted-foreground">{platform.description}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>24h Volume:</span>
                  <span className="font-medium">{formatCurrency(platform.totalVolume24h)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Markets:</span>
                  <span className="font-medium">{platform.totalMarkets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Users:</span>
                  <span className="font-medium">{platform.totalUsers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Avg Spread:</span>
                  <span className="font-medium">{platform.averageSpread}%</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {platform.features.map((feature, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-muted rounded">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Volume 24h</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.totalVolume24h, 0))}</p>
            </div>
            <DollarSign className="h-8 w-8 text-success" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Markets</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalMarkets, 0)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-info" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalUsers, 0).toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Spread</p>
              <p className="text-2xl font-bold">{(platforms.reduce((sum, p) => sum + p.averageSpread, 0) / platforms.length).toFixed(2)}%</p>
            </div>
            <Clock className="h-8 w-8 text-warning" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div>
            <label className="sr-only" htmlFor="platform-filter">Filter by platform</label>
            <select
              id="platform-filter"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-background"
              aria-label="Filter by platform"
            >
              <option value="all">All Platforms</option>
              {platforms.map((platform) => (
                <option key={platform.name} value={platform.name}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="sort-by">Sort markets by</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2 border rounded-lg bg-background"
              aria-label="Sort markets by"
            >
              <option value="volume">Sort by Volume</option>
              <option value="priceChange">Sort by Price Change</option>
              <option value="spread">Sort by Spread</option>
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="market-select">Select market</label>
            <select
              id="market-select"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-background"
              aria-label="Select market"
            >
              {markets.map((market) => (
                <option key={market.symbol} value={market.symbol}>
                  {market.symbol} ({market.platform})
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" className="ml-auto" onClick={() => fetchCLOBData(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Markets List */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Markets</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Market</th>
                    <th className="text-center p-4 font-medium">Platform</th>
                    <th className="text-right p-4 font-medium">Price</th>
                    <th className="text-right p-4 font-medium">24h Change</th>
                    <th className="text-right p-4 font-medium">Volume</th>
                    <th className="text-right p-4 font-medium">Spread</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedMarkets.map((market) => (
                    <tr 
                      key={market.symbol} 
                      className={`border-t hover:bg-muted/30 transition-colors cursor-pointer ${
                        selectedMarket === market.symbol ? 'bg-muted/50' : ''
                      }`}
                      onClick={() => setSelectedMarket(market.symbol)}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{market.symbol}</p>
                          <p className="text-xs text-muted-foreground">{market.baseToken}/{market.quoteToken}</p>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${getPlatformColor(market.platform)}`}>
                          {market.platform}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono">
                        ${formatPrice(market.lastPrice, market.symbol)}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`flex items-center justify-end gap-1 ${
                          market.priceChange24h >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {market.priceChange24h >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {market.priceChange24h >= 0 ? '+' : ''}{market.priceChange24h.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono">
                        {formatCurrency(market.volume24h)}
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm">{market.spread.toFixed(2)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Order Book */}
        <div>
          {selectedMarketData && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Order Book - {selectedMarketData.symbol}</h3>
                <p className="text-sm text-muted-foreground">Last: ${formatPrice(selectedMarketData.lastPrice, selectedMarketData.symbol)}</p>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Asks (Sell Orders) */}
                <div>
                  <h4 className="text-sm font-medium text-destructive mb-2">Asks (Sell)</h4>
                  <div className="space-y-1">
                    {selectedMarketData.orderBook.asks.slice().reverse().map((ask, index) => (
                      <div key={index} className="flex justify-between text-xs bg-destructive/10 p-1 rounded">
                        <span className="text-destructive">${formatPrice(ask.price, selectedMarketData.symbol)}</span>
                        <span>{ask.size.toLocaleString()}</span>
                        <span className="text-muted-foreground">{ask.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current Price */}
                <div className="text-center py-2 border-y">
                  <span className="font-mono font-bold">
                    ${formatPrice(selectedMarketData.lastPrice, selectedMarketData.symbol)}
                  </span>
                </div>

                {/* Bids (Buy Orders) */}
                <div>
                  <h4 className="text-sm font-medium text-success mb-2">Bids (Buy)</h4>
                  <div className="space-y-1">
                    {selectedMarketData.orderBook.bids.map((bid, index) => (
                      <div key={index} className="flex justify-between text-xs bg-success/10 p-1 rounded">
                        <span className="text-success">${formatPrice(bid.price, selectedMarketData.symbol)}</span>
                        <span>{bid.size.toLocaleString()}</span>
                        <span className="text-muted-foreground">{bid.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Trades */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Trades</h4>
                  <div className="space-y-1">
                    {selectedMarketData.recentTrades.map((trade, index) => (
                      <div key={index} className="flex justify-between text-xs p-1">
                        <span className={trade.side === 'buy' ? 'text-success' : 'text-destructive'}>
                          ${formatPrice(trade.price, selectedMarketData.symbol)}
                        </span>
                        <span>{trade.size.toLocaleString()}</span>
                        <span className="text-muted-foreground">{trade.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {filteredAndSortedMarkets.length === 0 && (
        <Card className="p-8 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No markets found matching your criteria</p>
        </Card>
      )}
    </div>
  );
}