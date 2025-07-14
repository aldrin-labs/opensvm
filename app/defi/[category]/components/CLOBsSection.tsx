'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchCLOBData = async () => {
      try {
        setLoading(true);
        
        // Mock CLOB platforms data - Solana-native order book DEXs
        const mockPlatforms: CLOBPlatform[] = [
          {
            name: 'Phoenix',
            totalVolume24h: 450000000,
            totalMarkets: 89,
            totalUsers: 34567,
            averageSpread: 0.08,
            description: 'High-performance orderbook DEX on Solana',
            website: 'https://phoenix.trade',
            features: ['Limit Orders', 'Market Orders', 'Stop Loss', 'Advanced Charts']
          },
          {
            name: 'Serum (Legacy)',
            totalVolume24h: 234000000,
            totalMarkets: 156,
            totalUsers: 78901,
            averageSpread: 0.12,
            description: 'Original central limit order book on Solana',
            website: 'https://serum.academy',
            features: ['Limit Orders', 'Market Orders', 'Cross-Chain', 'DeFi Integration']
          },
          {
            name: 'OpenBook',
            totalVolume24h: 189000000,
            totalMarkets: 234,
            totalUsers: 23456,
            averageSpread: 0.15,
            description: 'Community fork of Serum with enhanced features',
            website: 'https://openbook.dev',
            features: ['Limit Orders', 'Market Orders', 'Governance', 'Open Source']
          },
          {
            name: 'Drift (Spot)',
            totalVolume24h: 123000000,
            totalMarkets: 67,
            totalUsers: 12345,
            averageSpread: 0.09,
            description: 'Spot trading component of Drift Protocol',
            website: 'https://drift.trade',
            features: ['Limit Orders', 'Market Orders', 'Cross Margin', 'JIT Liquidity']
          },
          {
            name: 'Zeta Markets (Spot)',
            totalVolume24h: 89000000,
            totalMarkets: 45,
            totalUsers: 8901,
            averageSpread: 0.11,
            description: 'Spot trading on Zeta Markets DeFi platform',
            website: 'https://zeta.markets',
            features: ['Limit Orders', 'Market Orders', 'Options Integration', 'Risk Management']
          }
        ];

        // Mock market data for major Solana trading pairs
        const mockMarkets: MarketData[] = [
          {
            symbol: 'SOL/USDC',
            baseToken: 'SOL',
            quoteToken: 'USDC',
            platform: 'Phoenix',
            lastPrice: 98.45,
            priceChange24h: 5.67,
            volume24h: 89000000,
            high24h: 102.34,
            low24h: 94.12,
            spread: 0.05,
            orderBook: {
              bids: [
                { price: 98.43, size: 1250, total: 1250 },
                { price: 98.42, size: 890, total: 2140 },
                { price: 98.41, size: 2340, total: 4480 },
                { price: 98.40, size: 1560, total: 6040 },
                { price: 98.39, size: 3450, total: 9490 }
              ],
              asks: [
                { price: 98.48, size: 980, total: 980 },
                { price: 98.49, size: 1670, total: 2650 },
                { price: 98.50, size: 2890, total: 5540 },
                { price: 98.51, size: 1230, total: 6770 },
                { price: 98.52, size: 4560, total: 11330 }
              ]
            },
            recentTrades: [
              { price: 98.45, size: 234, time: '15:42:18', side: 'buy' },
              { price: 98.44, size: 567, time: '15:42:15', side: 'sell' },
              { price: 98.46, size: 123, time: '15:42:12', side: 'buy' }
            ]
          },
          {
            symbol: 'RAY/USDC',
            baseToken: 'RAY',
            quoteToken: 'USDC',
            platform: 'Phoenix',
            lastPrice: 2.34,
            priceChange24h: -3.21,
            volume24h: 23000000,
            high24h: 2.67,
            low24h: 2.23,
            spread: 0.08,
            orderBook: {
              bids: [
                { price: 2.339, size: 5670, total: 5670 },
                { price: 2.338, size: 3450, total: 9120 },
                { price: 2.337, size: 7890, total: 17010 },
                { price: 2.336, size: 2340, total: 19350 },
                { price: 2.335, size: 6780, total: 26130 }
              ],
              asks: [
                { price: 2.342, size: 4560, total: 4560 },
                { price: 2.343, size: 2890, total: 7450 },
                { price: 2.344, size: 6780, total: 14230 },
                { price: 2.345, size: 3450, total: 17680 },
                { price: 2.346, size: 8900, total: 26580 }
              ]
            },
            recentTrades: [
              { price: 2.341, size: 1234, time: '15:41:58', side: 'sell' },
              { price: 2.342, size: 567, time: '15:41:55', side: 'buy' },
              { price: 2.340, size: 890, time: '15:41:52', side: 'sell' }
            ]
          },
          {
            symbol: 'ORCA/USDC',
            baseToken: 'ORCA',
            quoteToken: 'USDC',
            platform: 'OpenBook',
            lastPrice: 3.67,
            priceChange24h: 7.89,
            volume24h: 12000000,
            high24h: 3.89,
            low24h: 3.34,
            spread: 0.12,
            orderBook: {
              bids: [
                { price: 3.665, size: 2340, total: 2340 },
                { price: 3.664, size: 1890, total: 4230 },
                { price: 3.663, size: 4560, total: 8790 },
                { price: 3.662, size: 1230, total: 10020 },
                { price: 3.661, size: 3450, total: 13470 }
              ],
              asks: [
                { price: 3.675, size: 1670, total: 1670 },
                { price: 3.676, size: 2890, total: 4560 },
                { price: 3.677, size: 1230, total: 5790 },
                { price: 3.678, size: 4560, total: 10350 },
                { price: 3.679, size: 2340, total: 12690 }
              ]
            },
            recentTrades: [
              { price: 3.671, size: 456, time: '15:41:45', side: 'buy' },
              { price: 3.670, size: 789, time: '15:41:42', side: 'sell' },
              { price: 3.672, size: 234, time: '15:41:39', side: 'buy' }
            ]
          },
          {
            symbol: 'JUP/SOL',
            baseToken: 'JUP',
            quoteToken: 'SOL',
            platform: 'Drift (Spot)',
            lastPrice: 0.89,
            priceChange24h: 12.45,
            volume24h: 8900000,
            high24h: 0.95,
            low24h: 0.78,
            spread: 0.15,
            orderBook: {
              bids: [
                { price: 0.8895, size: 8900, total: 8900 },
                { price: 0.8890, size: 5670, total: 14570 },
                { price: 0.8885, size: 12340, total: 26910 },
                { price: 0.8880, size: 3450, total: 30360 },
                { price: 0.8875, size: 7890, total: 38250 }
              ],
              asks: [
                { price: 0.8910, size: 6780, total: 6780 },
                { price: 0.8915, size: 4560, total: 11340 },
                { price: 0.8920, size: 8900, total: 20240 },
                { price: 0.8925, size: 2340, total: 22580 },
                { price: 0.8930, size: 5670, total: 28250 }
              ]
            },
            recentTrades: [
              { price: 0.8901, size: 2340, time: '15:41:32', side: 'buy' },
              { price: 0.8900, size: 1567, time: '15:41:29', side: 'sell' },
              { price: 0.8905, size: 890, time: '15:41:26', side: 'buy' }
            ]
          }
        ];

        setPlatforms(mockPlatforms);
        setMarkets(mockMarkets);
        if (!selectedMarket && mockMarkets.length > 0) {
          setSelectedMarket(mockMarkets[0].symbol);
        }
      } catch (error) {
        console.error('Failed to fetch CLOB data:', error);
        setPlatforms([]);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCLOBData();
  }, [selectedMarket]);

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
      'Phoenix': 'bg-orange-100 text-orange-800',
      'Serum (Legacy)': 'bg-blue-100 text-blue-800',
      'OpenBook': 'bg-green-100 text-green-800',
      'Drift (Spot)': 'bg-purple-100 text-purple-800',
      'Zeta Markets (Spot)': 'bg-red-100 text-red-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
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
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Markets</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalMarkets, 0)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalUsers, 0).toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Spread</p>
              <p className="text-2xl font-bold">{(platforms.reduce((sum, p) => sum + p.averageSpread, 0) / platforms.length).toFixed(2)}%</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform.name} value={platform.name}>
                {platform.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="volume">Sort by Volume</option>
            <option value="priceChange">Sort by Price Change</option>
            <option value="spread">Sort by Spread</option>
          </select>

          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            {markets.map((market) => (
              <option key={market.symbol} value={market.symbol}>
                {market.symbol} ({market.platform})
              </option>
            ))}
          </select>

          <Button variant="outline" className="ml-auto">
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
                          market.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
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
                  <h4 className="text-sm font-medium text-red-600 mb-2">Asks (Sell)</h4>
                  <div className="space-y-1">
                    {selectedMarketData.orderBook.asks.slice().reverse().map((ask, index) => (
                      <div key={index} className="flex justify-between text-xs bg-red-50 p-1 rounded">
                        <span className="text-red-600">${formatPrice(ask.price, selectedMarketData.symbol)}</span>
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
                  <h4 className="text-sm font-medium text-green-600 mb-2">Bids (Buy)</h4>
                  <div className="space-y-1">
                    {selectedMarketData.orderBook.bids.map((bid, index) => (
                      <div key={index} className="flex justify-between text-xs bg-green-50 p-1 rounded">
                        <span className="text-green-600">${formatPrice(bid.price, selectedMarketData.symbol)}</span>
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
                        <span className={trade.side === 'buy' ? 'text-green-600' : 'text-red-600'}>
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