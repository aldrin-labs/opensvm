'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Zap, RefreshCw, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PerpetualMarket {
  symbol: string;
  baseAsset: string;
  indexPrice: number;
  markPrice: number;
  priceChange24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  maxLeverage: number;
  platform: string;
  isActive: boolean;
  nextFunding: string;
  longShortRatio: number;
  liquidations24h: {
    long: number;
    short: number;
    total: number;
  };
}

interface PerpetualPlatform {
  name: string;
  totalVolume24h: number;
  totalOpenInterest: number;
  totalUsers: number;
  maxLeverage: number;
  supportedAssets: number;
  description: string;
  features: string[];
  insuranceFund: number;
}

export default function PerpetualsSection() {
  const [markets, setMarkets] = useState<PerpetualMarket[]>([]);
  const [platforms, setPlatforms] = useState<PerpetualPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'volume' | 'openInterest' | 'fundingRate' | 'priceChange'>('volume');
  const [selectedMarket, setSelectedMarket] = useState<string>('');

  useEffect(() => {
    const fetchPerpetualsData = async () => {
      try {
        setLoading(true);
        
        // Mock perpetual platforms data - Solana-native perp DEXs
        const mockPlatforms: PerpetualPlatform[] = [
          {
            name: 'Drift Protocol',
            totalVolume24h: 234000000,
            totalOpenInterest: 89000000,
            totalUsers: 23456,
            maxLeverage: 10,
            supportedAssets: 15,
            description: 'Leading perpetuals DEX on Solana with cross-margin and isolated margin',
            features: ['Cross Margin', 'Isolated Margin', 'JIT Liquidity', 'Insurance Fund', 'Funding Rates'],
            insuranceFund: 2340000
          },
          {
            name: 'Mango Markets',
            totalVolume24h: 156000000,
            totalOpenInterest: 67000000,
            totalUsers: 18901,
            maxLeverage: 5,
            supportedAssets: 12,
            description: 'Decentralized trading platform with perpetuals and spot trading',
            features: ['Cross Margin', 'Portfolio Margin', 'Risk Engine', 'Governance', 'DAO'],
            insuranceFund: 1890000
          },
          {
            name: 'Zeta Markets',
            totalVolume24h: 89000000,
            totalOpenInterest: 34000000,
            totalUsers: 12345,
            maxLeverage: 20,
            supportedAssets: 8,
            description: 'Options and perpetuals trading with advanced risk management',
            features: ['Options Integration', 'Risk Management', 'Market Making', 'Cross Margin'],
            insuranceFund: 1230000
          },
          {
            name: 'Cypher Protocol',
            totalVolume24h: 45000000,
            totalOpenInterest: 23000000,
            totalUsers: 8901,
            maxLeverage: 15,
            supportedAssets: 10,
            description: 'Multi-asset derivatives platform with advanced order types',
            features: ['Stop Loss', 'Take Profit', 'Conditional Orders', 'Multi-Asset Margin'],
            insuranceFund: 890000
          },
          {
            name: 'Solana Perps',
            totalVolume24h: 23000000,
            totalOpenInterest: 12000000,
            totalUsers: 5678,
            maxLeverage: 25,
            supportedAssets: 6,
            description: 'High-leverage perpetuals trading with minimal fees',
            features: ['High Leverage', 'Low Fees', 'Fast Settlement', 'Mobile Trading'],
            insuranceFund: 567000
          }
        ];

        // Mock perpetual markets data
        const mockMarkets: PerpetualMarket[] = [
          {
            symbol: 'SOL-PERP',
            baseAsset: 'SOL',
            indexPrice: 98.45,
            markPrice: 98.43,
            priceChange24h: 5.67,
            volume24h: 89000000,
            openInterest: 23000000,
            fundingRate: 0.0125,
            maxLeverage: 10,
            platform: 'Drift Protocol',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.62,
            liquidations24h: {
              long: 1230000,
              short: 890000,
              total: 2120000
            }
          },
          {
            symbol: 'BTC-PERP',
            baseAsset: 'BTC',
            indexPrice: 43250.67,
            markPrice: 43248.23,
            priceChange24h: 2.34,
            volume24h: 67000000,
            openInterest: 18000000,
            fundingRate: 0.0089,
            maxLeverage: 10,
            platform: 'Drift Protocol',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.58,
            liquidations24h: {
              long: 890000,
              short: 1120000,
              total: 2010000
            }
          },
          {
            symbol: 'ETH-PERP',
            baseAsset: 'ETH',
            indexPrice: 2567.89,
            markPrice: 2566.45,
            priceChange24h: -1.23,
            volume24h: 45000000,
            openInterest: 15000000,
            fundingRate: -0.0045,
            maxLeverage: 5,
            platform: 'Mango Markets',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.45,
            liquidations24h: {
              long: 1560000,
              short: 670000,
              total: 2230000
            }
          },
          {
            symbol: 'RAY-PERP',
            baseAsset: 'RAY',
            indexPrice: 2.34,
            markPrice: 2.335,
            priceChange24h: -3.21,
            volume24h: 23000000,
            openInterest: 8900000,
            fundingRate: -0.0156,
            maxLeverage: 20,
            platform: 'Zeta Markets',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.38,
            liquidations24h: {
              long: 890000,
              short: 450000,
              total: 1340000
            }
          },
          {
            symbol: 'BONK-PERP',
            baseAsset: 'BONK',
            indexPrice: 0.000034,
            markPrice: 0.0000339,
            priceChange24h: 12.45,
            volume24h: 12000000,
            openInterest: 5600000,
            fundingRate: 0.0234,
            maxLeverage: 15,
            platform: 'Cypher Protocol',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.78,
            liquidations24h: {
              long: 340000,
              short: 670000,
              total: 1010000
            }
          },
          {
            symbol: 'JUP-PERP',
            baseAsset: 'JUP',
            indexPrice: 0.89,
            markPrice: 0.8895,
            priceChange24h: 8.67,
            volume24h: 8900000,
            openInterest: 3400000,
            fundingRate: 0.0178,
            maxLeverage: 25,
            platform: 'Solana Perps',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.69,
            liquidations24h: {
              long: 230000,
              short: 450000,
              total: 680000
            }
          },
          {
            symbol: 'ORCA-PERP',
            baseAsset: 'ORCA',
            indexPrice: 3.67,
            markPrice: 3.665,
            priceChange24h: 7.89,
            volume24h: 6700000,
            openInterest: 2800000,
            fundingRate: 0.0098,
            maxLeverage: 10,
            platform: 'Drift Protocol',
            isActive: true,
            nextFunding: '2024-12-22T16:00:00Z',
            longShortRatio: 0.55,
            liquidations24h: {
              long: 180000,
              short: 220000,
              total: 400000
            }
          }
        ];

        setPlatforms(mockPlatforms);
        setMarkets(mockMarkets);
        if (!selectedMarket && mockMarkets.length > 0) {
          setSelectedMarket(mockMarkets[0].symbol);
        }
      } catch (error) {
        console.error('Failed to fetch perpetuals data:', error);
        setPlatforms([]);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPerpetualsData();
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
        case 'openInterest':
          return b.openInterest - a.openInterest;
        case 'fundingRate':
          return Math.abs(b.fundingRate) - Math.abs(a.fundingRate);
        case 'priceChange':
          return b.priceChange24h - a.priceChange24h;
        default:
          return 0;
      }
    });

  const selectedMarketData = markets.find(m => m.symbol === selectedMarket);

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPrice = (price: number, symbol: string) => {
    if (symbol.includes('BTC')) return price.toFixed(2);
    if (symbol.includes('ETH')) return price.toFixed(2);
    if (symbol.includes('SOL')) return price.toFixed(4);
    if (symbol.includes('BONK')) return price.toFixed(8);
    return price.toFixed(6);
  };

  const getPlatformColor = (platform: string) => {
    const colors: { [key: string]: string } = {
      'Drift Protocol': 'bg-blue-100 text-blue-800',
      'Mango Markets': 'bg-orange-100 text-orange-800',
      'Zeta Markets': 'bg-purple-100 text-purple-800',
      'Cypher Protocol': 'bg-green-100 text-green-800',
      'Solana Perps': 'bg-red-100 text-red-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };

  const getFundingRateColor = (rate: number) => {
    if (rate > 0) return 'text-red-600'; // Longs pay shorts
    if (rate < 0) return 'text-green-600'; // Shorts pay longs
    return 'text-gray-600';
  };

  const formatTimeUntilFunding = (nextFunding: string) => {
    const now = new Date();
    const funding = new Date(nextFunding);
    const diff = funding.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
        <Zap className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana Perpetual Futures</h2>
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
                  <span>Open Interest:</span>
                  <span className="font-medium">{formatCurrency(platform.totalOpenInterest)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Max Leverage:</span>
                  <span className="font-medium">{platform.maxLeverage}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Insurance Fund:</span>
                  <span className="font-medium text-green-600">{formatCurrency(platform.insuranceFund)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {platform.features.slice(0, 3).map((feature, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-muted rounded">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Total Stats */}
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
              <p className="text-sm font-medium text-muted-foreground">Open Interest</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.totalOpenInterest, 0))}</p>
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
              <p className="text-sm font-medium text-muted-foreground">Insurance Fund</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.insuranceFund, 0))}</p>
            </div>
            <Target className="h-8 w-8 text-orange-500" />
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
            <option value="openInterest">Sort by Open Interest</option>
            <option value="fundingRate">Sort by Funding Rate</option>
            <option value="priceChange">Sort by Price Change</option>
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
        {/* Markets Table */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Perpetual Markets</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Market</th>
                    <th className="text-center p-4 font-medium">Platform</th>
                    <th className="text-right p-4 font-medium">Mark Price</th>
                    <th className="text-right p-4 font-medium">24h Change</th>
                    <th className="text-right p-4 font-medium">Volume</th>
                    <th className="text-right p-4 font-medium">Open Interest</th>
                    <th className="text-right p-4 font-medium">Funding Rate</th>
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
                          <p className="text-xs text-muted-foreground">Max {market.maxLeverage}x</p>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${getPlatformColor(market.platform)}`}>
                          {market.platform.split(' ')[0]}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono">
                        ${formatPrice(market.markPrice, market.symbol)}
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
                      <td className="p-4 text-right font-mono">
                        {formatCurrency(market.openInterest)}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`font-medium ${getFundingRateColor(market.fundingRate)}`}>
                          {market.fundingRate >= 0 ? '+' : ''}{(market.fundingRate * 100).toFixed(3)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Market Details */}
        <div className="space-y-4">
          {selectedMarketData && (
            <>
              {/* Market Info */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">{selectedMarketData.symbol} Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Index Price:</span>
                    <span className="font-mono">${formatPrice(selectedMarketData.indexPrice, selectedMarketData.symbol)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Mark Price:</span>
                    <span className="font-mono">${formatPrice(selectedMarketData.markPrice, selectedMarketData.symbol)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Next Funding:</span>
                    <span className="font-medium">{formatTimeUntilFunding(selectedMarketData.nextFunding)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Long/Short Ratio:</span>
                    <span className="font-medium">{(selectedMarketData.longShortRatio * 100).toFixed(0)}% / {((1 - selectedMarketData.longShortRatio) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </Card>

              {/* Liquidations */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">24h Liquidations</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Long Liquidations:</span>
                    <span className="font-medium">{formatCurrency(selectedMarketData.liquidations24h.long)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Short Liquidations:</span>
                    <span className="font-medium">{formatCurrency(selectedMarketData.liquidations24h.short)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedMarketData.liquidations24h.total)}</span>
                  </div>
                </div>
              </Card>

              {/* Trading Actions */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Trade {selectedMarketData.baseAsset}</h3>
                <div className="space-y-2">
                  <Button className="w-full" variant="default">
                    Long {selectedMarketData.baseAsset}
                  </Button>
                  <Button className="w-full" variant="destructive">
                    Short {selectedMarketData.baseAsset}
                  </Button>
                  <Button className="w-full" variant="outline">
                    View Chart
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {filteredAndSortedMarkets.length === 0 && (
        <Card className="p-8 text-center">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No markets found matching your criteria</p>
        </Card>
      )}
    </div>
  );
}