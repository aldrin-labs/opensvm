'use client';

import React, { useState, useEffect } from 'react';
import { Target, DollarSign, Calendar, Users, RefreshCw, Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface OptionContract {
  id: string;
  underlying: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  premium: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  openInterest: number;
  volume24h: number;
  platform: string;
  isActive: boolean;
  moneyness: 'ITM' | 'ATM' | 'OTM'; // In/At/Out of the money
  timeToExpiry: number; // days
}

interface OptionsPlatform {
  name: string;
  totalVolume24h: number;
  totalOpenInterest: number;
  totalContracts: number;
  supportedAssets: string[];
  description: string;
  features: string[];
  maxExpiry: string;
  minStrike: number;
}

interface UnderlyingAsset {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  impliedVolatility: number;
  totalCallOI: number;
  totalPutOI: number;
  putCallRatio: number;
}

export default function OptionsSection() {
  const [options, setOptions] = useState<OptionContract[]>([]);
  const [platforms, setPlatforms] = useState<OptionsPlatform[]>([]);
  const [underlyingAssets, setUnderlyingAssets] = useState<UnderlyingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [underlyingFilter, setUnderlyingFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [moneynessFilter, setMoneynessFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'volume' | 'openInterest' | 'premium' | 'expiry'>('volume');

  useEffect(() => {
    const fetchOptionsData = async () => {
      try {
        setLoading(true);
        
        // Mock options platforms data - Solana-native options platforms
        const mockPlatforms: OptionsPlatform[] = [
          {
            name: 'Zeta Markets',
            totalVolume24h: 45000000,
            totalOpenInterest: 23000000,
            totalContracts: 1250,
            supportedAssets: ['SOL', 'BTC', 'ETH', 'RAY', 'ORCA'],
            description: 'Leading options and perpetuals platform on Solana',
            features: ['American Options', 'European Options', 'Portfolio Margin', 'Risk Management'],
            maxExpiry: '3 months',
            minStrike: 0.1
          },
          {
            name: 'Cypher Protocol',
            totalVolume24h: 23000000,
            totalOpenInterest: 12000000,
            totalContracts: 890,
            supportedAssets: ['SOL', 'BTC', 'ETH', 'JUP'],
            description: 'Multi-asset derivatives platform with options and futures',
            features: ['Binary Options', 'Vanilla Options', 'Cross Margin', 'Auto Exercise'],
            maxExpiry: '6 months',
            minStrike: 0.01
          },
          {
            name: 'Drift Options',
            totalVolume24h: 12000000,
            totalOpenInterest: 8900000,
            totalContracts: 567,
            supportedAssets: ['SOL', 'RAY', 'BONK'],
            description: 'Options trading integrated with Drift Protocol',
            features: ['JIT Options', 'Dynamic Pricing', 'Liquidity Mining', 'Governance'],
            maxExpiry: '2 months',
            minStrike: 1.0
          },
          {
            name: 'Solana Options',
            totalVolume24h: 8900000,
            totalOpenInterest: 5600000,
            totalContracts: 345,
            supportedAssets: ['SOL', 'USDC'],
            description: 'Specialized Solana native options trading platform',
            features: ['Weekly Options', 'Monthly Options', 'Low Fees', 'Fast Settlement'],
            maxExpiry: '1 month',
            minStrike: 5.0
          }
        ];

        // Mock underlying assets data
        const mockUnderlyingAssets: UnderlyingAsset[] = [
          {
            symbol: 'SOL',
            currentPrice: 98.45,
            priceChange24h: 5.67,
            impliedVolatility: 0.85,
            totalCallOI: 15000000,
            totalPutOI: 8900000,
            putCallRatio: 0.59
          },
          {
            symbol: 'BTC',
            currentPrice: 43250.67,
            priceChange24h: 2.34,
            impliedVolatility: 0.72,
            totalCallOI: 12000000,
            totalPutOI: 9800000,
            putCallRatio: 0.82
          },
          {
            symbol: 'ETH',
            currentPrice: 2567.89,
            priceChange24h: -1.23,
            impliedVolatility: 0.78,
            totalCallOI: 8900000,
            totalPutOI: 11200000,
            putCallRatio: 1.26
          },
          {
            symbol: 'RAY',
            currentPrice: 2.34,
            priceChange24h: -3.21,
            impliedVolatility: 1.23,
            totalCallOI: 3400000,
            totalPutOI: 2800000,
            putCallRatio: 0.82
          }
        ];

        // Mock options contracts data
        const mockOptions: OptionContract[] = [
          {
            id: '1',
            underlying: 'SOL',
            type: 'call',
            strike: 100,
            expiry: '2024-12-29T08:00:00Z',
            premium: 3.45,
            impliedVolatility: 0.85,
            delta: 0.62,
            gamma: 0.045,
            theta: -0.12,
            vega: 0.23,
            openInterest: 2340000,
            volume24h: 890000,
            platform: 'Zeta Markets',
            isActive: true,
            moneyness: 'ITM',
            timeToExpiry: 7
          },
          {
            id: '2',
            underlying: 'SOL',
            type: 'put',
            strike: 95,
            expiry: '2024-12-29T08:00:00Z',
            premium: 1.89,
            impliedVolatility: 0.78,
            delta: -0.38,
            gamma: 0.035,
            theta: -0.08,
            vega: 0.19,
            openInterest: 1890000,
            volume24h: 567000,
            platform: 'Zeta Markets',
            isActive: true,
            moneyness: 'OTM',
            timeToExpiry: 7
          },
          {
            id: '3',
            underlying: 'BTC',
            type: 'call',
            strike: 45000,
            expiry: '2025-01-31T08:00:00Z',
            premium: 1250.67,
            impliedVolatility: 0.72,
            delta: 0.45,
            gamma: 0.002,
            theta: -2.34,
            vega: 12.45,
            openInterest: 1200000,
            volume24h: 234000,
            platform: 'Cypher Protocol',
            isActive: true,
            moneyness: 'OTM',
            timeToExpiry: 40
          },
          {
            id: '4',
            underlying: 'ETH',
            type: 'put',
            strike: 2500,
            expiry: '2025-01-15T08:00:00Z',
            premium: 89.34,
            impliedVolatility: 0.82,
            delta: -0.52,
            gamma: 0.008,
            theta: -1.23,
            vega: 4.56,
            openInterest: 890000,
            volume24h: 156000,
            platform: 'Cypher Protocol',
            isActive: true,
            moneyness: 'ATM',
            timeToExpiry: 24
          },
          {
            id: '5',
            underlying: 'SOL',
            type: 'call',
            strike: 110,
            expiry: '2024-12-25T08:00:00Z',
            premium: 0.78,
            impliedVolatility: 1.05,
            delta: 0.23,
            gamma: 0.028,
            theta: -0.15,
            vega: 0.12,
            openInterest: 567000,
            volume24h: 123000,
            platform: 'Drift Options',
            isActive: true,
            moneyness: 'OTM',
            timeToExpiry: 3
          },
          {
            id: '6',
            underlying: 'RAY',
            type: 'call',
            strike: 2.5,
            expiry: '2024-12-27T08:00:00Z',
            premium: 0.12,
            impliedVolatility: 1.23,
            delta: 0.34,
            gamma: 0.15,
            theta: -0.05,
            vega: 0.08,
            openInterest: 345000,
            volume24h: 89000,
            platform: 'Solana Options',
            isActive: true,
            moneyness: 'OTM',
            timeToExpiry: 5
          }
        ];

        setPlatforms(mockPlatforms);
        setUnderlyingAssets(mockUnderlyingAssets);
        setOptions(mockOptions);
      } catch (error) {
        console.error('Failed to fetch options data:', error);
        setPlatforms([]);
        setUnderlyingAssets([]);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOptionsData();
  }, []);

  const filteredAndSortedOptions = options
    .filter(option => {
      const matchesPlatform = platformFilter === 'all' || option.platform === platformFilter;
      const matchesUnderlying = underlyingFilter === 'all' || option.underlying === underlyingFilter;
      const matchesType = typeFilter === 'all' || option.type === typeFilter;
      const matchesMoneyness = moneynessFilter === 'all' || option.moneyness === moneynessFilter;
      return matchesPlatform && matchesUnderlying && matchesType && matchesMoneyness;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'openInterest':
          return b.openInterest - a.openInterest;
        case 'premium':
          return b.premium - a.premium;
        case 'expiry':
          return a.timeToExpiry - b.timeToExpiry;
        default:
          return 0;
      }
    });

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPlatformColor = (platform: string) => {
    const colors: { [key: string]: string } = {
      'Zeta Markets': 'bg-purple-100 text-purple-800',
      'Cypher Protocol': 'bg-green-100 text-green-800',
      'Drift Options': 'bg-blue-100 text-blue-800',
      'Solana Options': 'bg-orange-100 text-orange-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };

  const getMoneynessColor = (moneyness: string) => {
    switch (moneyness) {
      case 'ITM': return 'text-green-600 bg-green-100';
      case 'ATM': return 'text-blue-600 bg-blue-100';
      case 'OTM': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'call' ? 'text-green-600' : 'text-red-600';
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
        <Target className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana Options Trading</h2>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {platforms.map((platform) => (
          <Card key={platform.name} className="p-4">
            <div className="space-y-3">
              <h3 className="font-semibold">{platform.name}</h3>
              <p className="text-xs text-muted-foreground">{platform.description}</p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Volume 24h:</span>
                  <span className="font-medium">{formatCurrency(platform.totalVolume24h)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Open Interest:</span>
                  <span className="font-medium">{formatCurrency(platform.totalOpenInterest)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Contracts:</span>
                  <span className="font-medium">{platform.totalContracts}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {platform.supportedAssets.slice(0, 3).map((asset) => (
                  <span key={asset} className="px-1.5 py-0.5 text-xs bg-muted rounded">
                    {asset}
                  </span>
                ))}
                {platform.supportedAssets.length > 3 && (
                  <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
                    +{platform.supportedAssets.length - 3}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Underlying Assets Stats */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Underlying Assets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {underlyingAssets.map((asset) => (
            <div key={asset.symbol} className="p-3 border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{asset.symbol}</span>
                <span className={`text-sm ${asset.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%
                </span>
              </div>
              <p className="text-lg font-bold mb-2">${asset.currentPrice.toFixed(2)}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>IV:</span>
                  <span>{(asset.impliedVolatility * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>P/C Ratio:</span>
                  <span>{asset.putCallRatio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Call OI:</span>
                  <span>{formatCurrency(asset.totalCallOI)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Put OI:</span>
                  <span>{formatCurrency(asset.totalPutOI)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

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
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalContracts, 0)}</p>
            </div>
            <Calendar className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Platforms</p>
              <p className="text-2xl font-bold">{platforms.length}</p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="all">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform.name} value={platform.name}>
                {platform.name}
              </option>
            ))}
          </select>

          <select
            value={underlyingFilter}
            onChange={(e) => setUnderlyingFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="all">All Assets</option>
            {underlyingAssets.map((asset) => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="all">All Types</option>
            <option value="call">Calls</option>
            <option value="put">Puts</option>
          </select>

          <select
            value={moneynessFilter}
            onChange={(e) => setMoneynessFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="all">All Moneyness</option>
            <option value="ITM">In the Money</option>
            <option value="ATM">At the Money</option>
            <option value="OTM">Out of the Money</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="volume">Sort by Volume</option>
            <option value="openInterest">Sort by OI</option>
            <option value="premium">Sort by Premium</option>
            <option value="expiry">Sort by Expiry</option>
          </select>

          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Options Chain */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Options Chain</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Contract</th>
                <th className="text-center p-3 font-medium">Platform</th>
                <th className="text-right p-3 font-medium">Strike</th>
                <th className="text-right p-3 font-medium">Premium</th>
                <th className="text-right p-3 font-medium">IV</th>
                <th className="text-right p-3 font-medium">Delta</th>
                <th className="text-right p-3 font-medium">Gamma</th>
                <th className="text-right p-3 font-medium">Volume</th>
                <th className="text-right p-3 font-medium">Open Interest</th>
                <th className="text-center p-3 font-medium">Expiry</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedOptions.map((option) => (
                <tr key={option.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded uppercase font-medium ${getMoneynessColor(option.moneyness)}`}>
                        {option.moneyness}
                      </span>
                      <div>
                        <p className="font-medium">
                          {option.underlying} 
                          <span className={`ml-1 ${getTypeColor(option.type)}`}>
                            {option.type.toUpperCase()}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{option.timeToExpiry}d to expiry</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${getPlatformColor(option.platform)}`}>
                      {option.platform.split(' ')[0]}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">
                    ${option.strike.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono font-medium">
                    ${option.premium.toFixed(2)}
                  </td>
                  <td className="p-3 text-right">
                    {(option.impliedVolatility * 100).toFixed(0)}%
                  </td>
                  <td className="p-3 text-right">
                    <span className={option.delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {option.delta.toFixed(3)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {option.gamma.toFixed(3)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {formatCurrency(option.volume24h)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {formatCurrency(option.openInterest)}
                  </td>
                  <td className="p-3 text-center text-sm">
                    {formatDate(option.expiry)}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="outline">
                        Buy
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Calculator className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filteredAndSortedOptions.length === 0 && (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No options found matching your criteria</p>
        </Card>
      )}

      {/* Options Info */}
      <Card className="p-4 border-blue-200 bg-blue-50">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">i</span>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Options Trading Information</h4>
            <p className="text-sm text-blue-700">
              Options are complex financial instruments that can result in significant losses. ITM = In the Money, 
              ATM = At the Money, OTM = Out of the Money. Greeks measure option sensitivities to various factors.
              Always understand the risks before trading options.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}