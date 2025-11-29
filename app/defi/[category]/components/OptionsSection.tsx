'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

  const fetchOptionsData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const response = await fetch('/api/analytics/options');
      const data = await response.json();

      if (data.success && data.data) {
        setPlatforms(data.data.platforms || []);
        setUnderlyingAssets(data.data.underlyingAssets || []);
        setOptions(data.data.options || []);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Failed to fetch options data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptionsData();
    const interval = setInterval(() => fetchOptionsData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchOptionsData]);

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
    if (!Number.isFinite(value) || value < 0) return '$0.00';
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
      'Zeta Markets': 'bg-primary/10 text-primary',
      'Dual Finance': 'bg-success/10 text-success',
      'PsyOptions': 'bg-info/10 text-info',
      'Cypher Protocol': 'bg-info/10 text-info',
      'Drift Options': 'bg-warning/10 text-warning'
    };
    return colors[platform] || 'bg-muted text-muted-foreground';
  };

  const getMoneynessColor = (moneyness: string) => {
    switch (moneyness) {
      case 'ITM': return 'text-success bg-success/10';
      case 'ATM': return 'text-info bg-info/10';
      case 'OTM': return 'text-warning bg-warning/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'call' ? 'text-success' : 'text-destructive';
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
                <span className={`text-sm ${asset.priceChange24h >= 0 ? 'text-success' : 'text-destructive'}`}>
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
            <DollarSign className="h-8 w-8 text-success" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Open Interest</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.totalOpenInterest, 0))}</p>
            </div>
            <Target className="h-8 w-8 text-info" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalContracts, 0)}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Platforms</p>
              <p className="text-2xl font-bold">{platforms.length}</p>
            </div>
            <Users className="h-8 w-8 text-warning" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
          <div>
            <label className="sr-only" htmlFor="platform-filter">Filter by platform</label>
            <select
              id="platform-filter"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
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
            <label className="sr-only" htmlFor="asset-filter">Filter by asset</label>
            <select
              id="asset-filter"
              value={underlyingFilter}
              onChange={(e) => setUnderlyingFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              aria-label="Filter by underlying asset"
            >
              <option value="all">All Assets</option>
              {underlyingAssets.map((asset) => (
                <option key={asset.symbol} value={asset.symbol}>
                  {asset.symbol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="type-filter">Filter by option type</label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              aria-label="Filter by option type"
            >
              <option value="all">All Types</option>
              <option value="call">Calls</option>
              <option value="put">Puts</option>
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="moneyness-filter">Filter by moneyness</label>
            <select
              id="moneyness-filter"
              value={moneynessFilter}
              onChange={(e) => setMoneynessFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              aria-label="Filter by moneyness"
            >
              <option value="all">All Moneyness</option>
              <option value="ITM">In the Money</option>
              <option value="ATM">At the Money</option>
              <option value="OTM">Out of the Money</option>
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="sort-by">Sort options by</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              aria-label="Sort options by"
            >
              <option value="volume">Sort by Volume</option>
              <option value="openInterest">Sort by OI</option>
              <option value="premium">Sort by Premium</option>
              <option value="expiry">Sort by Expiry</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchOptionsData(true)}>
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
                    <span className={option.delta >= 0 ? 'text-success' : 'text-destructive'}>
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
      <Card className="p-4 border-info/20 bg-info/5">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-info flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-info-foreground text-xs font-bold">i</span>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Options Trading Information</h4>
            <p className="text-sm text-muted-foreground">
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