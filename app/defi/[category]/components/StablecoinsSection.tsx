'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Search,
  ArrowUpDown,
  Target,
  Coins
} from 'lucide-react';

interface Stablecoin {
  id: string;
  name: string;
  symbol: string;
  type: 'Fiat-Collateralized' | 'Crypto-Collateralized' | 'Algorithmic' | 'Hybrid';
  currentPrice: number;
  pegDeviation: number;
  marketCap: string;
  volume24h: string;
  circulatingSupply: string;
  collateralRatio: number;
  transparencyScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  pegStability: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  backing: string[];
  issuer: string;
  audits: number;
  features: string[];
  description: string;
}

export default function StablecoinsSection() {
  const [loading, setLoading] = useState(true);
  const [stablecoins, setStablecoins] = useState<Stablecoin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'marketCap' | 'pegDeviation' | 'transparencyScore' | 'volume24h'>('marketCap');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterStability, setFilterStability] = useState<string>('All');

  const formatValue = (value: number): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const getPegStability = (deviation: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' => {
    const absDeviation = Math.abs(deviation);
    if (absDeviation < 0.001) return 'Excellent';
    if (absDeviation < 0.005) return 'Good';
    if (absDeviation < 0.02) return 'Fair';
    return 'Poor';
  };

  const fetchStablecoinData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/stablecoins');
      const data = await response.json();

      if (data.success && data.data) {
        const coins = (data.data.stablecoins || []).map((c: any, idx: number) => ({
          id: String(idx + 1),
          name: c.name,
          symbol: c.symbol,
          type: c.type === 'Fiat-backed' ? 'Fiat-Collateralized' : c.type === 'Crypto-backed' ? 'Crypto-Collateralized' : c.type,
          currentPrice: c.currentPrice,
          pegDeviation: c.pegDeviation * 100,
          marketCap: formatValue(c.marketCap),
          volume24h: formatValue(c.volume24h),
          circulatingSupply: formatValue(c.circulatingSupply),
          collateralRatio: 100,
          transparencyScore: c.auditStatus === 'Audited' ? 90 : c.auditStatus === 'Partial' ? 75 : 50,
          riskLevel: c.type === 'Algorithmic' ? 'High' : c.type === 'Fiat-backed' ? 'Low' : 'Medium',
          pegStability: getPegStability(c.pegDeviation),
          backing: [c.backing],
          issuer: c.issuer,
          audits: c.auditStatus === 'Audited' ? 6 : c.auditStatus === 'Partial' ? 2 : 0,
          features: ['Native SPL Token', 'DeFi Integration', ...c.chains.slice(0, 2)],
          description: c.description
        }));
        setStablecoins(coins);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching stablecoin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStablecoinData();
    const interval = setInterval(() => fetchStablecoinData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchStablecoinData]);

  const filteredAndSortedCoins = stablecoins
    .filter(coin => 
      coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coin.issuer.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(coin => filterType === 'All' || coin.type === filterType)
    .filter(coin => filterStability === 'All' || coin.pegStability === filterStability)
    .sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return parseFloat(b.marketCap.replace(/[^\d.]/g, '')) - parseFloat(a.marketCap.replace(/[^\d.]/g, ''));
        case 'pegDeviation':
          return Math.abs(a.pegDeviation) - Math.abs(b.pegDeviation);
        case 'transparencyScore':
          return b.transparencyScore - a.transparencyScore;
        case 'volume24h':
          return parseFloat(b.volume24h.replace(/[^\d.]/g, '')) - parseFloat(a.volume24h.replace(/[^\d.]/g, ''));
        default:
          return 0;
      }
    });

  const types = ['All', ...Array.from(new Set(stablecoins.map(coin => coin.type)))];
  const stabilities = ['All', ...Array.from(new Set(stablecoins.map(coin => coin.pegStability)))];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-success/10 text-success';
      case 'Medium': return 'bg-warning/10 text-warning';
      case 'High': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'Excellent': return 'bg-success/10 text-success';
      case 'Good': return 'bg-info/10 text-info';
      case 'Fair': return 'bg-warning/10 text-warning';
      case 'Poor': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPegDeviationColor = (deviation: number) => {
    const abs = Math.abs(deviation);
    if (abs <= 0.1) return 'text-success';
    if (abs <= 0.5) return 'text-warning';
    if (abs <= 2.0) return 'text-warning';
    return 'text-destructive';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading stablecoin data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Stablecoin Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive analysis of stablecoin peg stability, backing, and market metrics
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search stablecoins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="filter-type">Filter by type</label>
          <select
            id="filter-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            aria-label="Filter by stablecoin type"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="filter-stability">Filter by stability</label>
          <select
            id="filter-stability"
            value={filterStability}
            onChange={(e) => setFilterStability(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            aria-label="Filter by peg stability"
          >
            {stabilities.map(stability => (
              <option key={stability} value={stability}>{stability}</option>
            ))}
          </select>
          
          <Button variant="outline" size="sm" onClick={() => setSortBy(sortBy === 'marketCap' ? 'pegDeviation' : 'marketCap')}>
            <ArrowUpDown className="h-4 w-4 mr-1" />
            Sort by {sortBy === 'marketCap' ? 'Market Cap' : 'Peg Deviation'}
          </Button>
        </div>
      </div>

      {/* Stablecoins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedCoins.map((coin) => (
          <Card key={coin.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    {coin.name} ({coin.symbol})
                  </CardTitle>
                  <CardDescription>{coin.description}</CardDescription>
                </div>
                <Badge className={getStabilityColor(coin.pegStability)}>
                  {coin.pegStability}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline">{coin.type}</Badge>
                <Badge className={getRiskColor(coin.riskLevel)}>
                  {coin.riskLevel} Risk
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Price and Peg */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-info" />
                  <div>
                    <div className="text-sm text-muted-foreground">Current Price</div>
                    <div className="font-semibold">${coin.currentPrice.toFixed(4)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {coin.pegDeviation >= 0 ?
                    <TrendingUp className="h-4 w-4 text-success" /> :
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  }
                  <div>
                    <div className="text-sm text-muted-foreground">Peg Deviation</div>
                    <div className={`font-semibold ${getPegDeviationColor(coin.pegDeviation)}`}>
                      {coin.pegDeviation > 0 ? '+' : ''}{coin.pegDeviation.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Market Cap</div>
                  <div className="font-semibold">${coin.marketCap}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">24h Volume</div>
                  <div className="font-semibold">${coin.volume24h}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Collateral Ratio</div>
                  <div className="font-semibold">{coin.collateralRatio}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Transparency</div>
                  <div className="font-semibold">{coin.transparencyScore}/100</div>
                </div>
              </div>

              {/* Backing */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Backing Assets:</div>
                <div className="flex flex-wrap gap-1">
                  {coin.backing.map((asset, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {asset}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Features:</div>
                <div className="flex flex-wrap gap-1">
                  {coin.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {coin.features.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{coin.features.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Issuer and Audits */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issuer:</span>
                  <span className="font-medium">{coin.issuer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security Audits:</span>
                  <span className="font-medium">{coin.audits}</span>
                </div>
              </div>

              {/* Action Button */}
              <Button className="w-full" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAndSortedCoins.length === 0 && (
        <div className="text-center py-20">
          <div className="text-muted-foreground">No stablecoins found matching your criteria.</div>
        </div>
      )}
    </div>
  );
}