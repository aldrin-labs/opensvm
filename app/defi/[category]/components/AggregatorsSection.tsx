'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, TrendingUp, TrendingDown, BarChart3, Search, Route, Timer, Shield, Target, RefreshCw } from 'lucide-react';

interface AggregatorData {
  name: string;
  description: string;
  website: string;
  volume24h: number;
  volumeChange: number;
  trades24h: number;
  uniqueUsers24h: number;
  avgSavings: number;
  supportedDexes: string[];
  supportedChains: string[];
  maxSplits: number;
  avgExecutionTime: number;
  successRate: number;
  fees: string;
  apiAvailable: boolean;
  sdkAvailable: boolean;
  category: string;
  logo?: string;
  features: string[];
  gasOptimization: boolean;
  mevProtection: boolean;
  limitOrders: boolean;
  crossChain: boolean;
}

export default function AggregatorsSection() {
  const [aggregators, setAggregators] = useState<AggregatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'volume24h' | 'trades24h' | 'avgSavings' | 'successRate'>('volume24h');

  const fetchAggregatorData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/aggregators');
      const data = await response.json();

      if (data.success && data.data) {
        setAggregators(data.data.aggregators || []);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching aggregator data:', err);
      setError('Failed to load aggregator data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAggregatorData();
    const interval = setInterval(() => fetchAggregatorData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchAggregatorData]);

  const categories = ['all', 'Universal Aggregator', 'Specialized Router', 'Native Aggregator', 'Pool-specific Router', 'Perp-focused Router', 'HFT Router', 'Bridge Aggregator'];

  const filteredAggregators = aggregators
    .filter(agg =>
      (categoryFilter === 'all' || agg.category === categoryFilter) &&
      (agg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agg.features.some(feature => feature.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    .sort((a, b) => b[sortBy] - a[sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            DEX Aggregators & Routers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search aggregators and features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <div>
                <label className="sr-only" htmlFor="category-filter">Filter by category</label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  aria-label="Filter by category"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant={sortBy === 'volume24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('volume24h')}
              >
                Volume
              </Button>
              <Button
                variant={sortBy === 'trades24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('trades24h')}
              >
                Trades
              </Button>
              <Button
                variant={sortBy === 'avgSavings' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('avgSavings')}
              >
                Savings
              </Button>
              <Button
                variant={sortBy === 'successRate' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('successRate')}
              >
                Success Rate
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchAggregatorData(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Total Aggregators</p>
                <p className="text-2xl font-bold">{aggregators.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Total Volume 24h</p>
                <p className="text-2xl font-bold">${formatNumber(aggregators.reduce((sum, agg) => sum + agg.volume24h, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Savings</p>
                <p className="text-2xl font-bold">{(aggregators.reduce((sum, agg) => sum + agg.avgSavings, 0) / aggregators.length).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold">{(aggregators.reduce((sum, agg) => sum + agg.successRate, 0) / aggregators.length).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregator Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAggregators.map((aggregator) => (
          <Card key={aggregator.name} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    <Route className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{aggregator.name}</CardTitle>
                      {aggregator.crossChain && <Badge variant="secondary">Cross-chain</Badge>}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {aggregator.category}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open(aggregator.website, '_blank');
                    }
                  }}
                  aria-label={`Visit ${aggregator.name} website`}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {aggregator.description}
              </p>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <BarChart3 className="h-3 w-3" />
                    Volume 24h
                  </div>
                  <p className="font-bold text-lg">${formatNumber(aggregator.volume24h)}</p>
                  <div className={`flex items-center gap-1 text-xs ${aggregator.volumeChange >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                    {aggregator.volumeChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(aggregator.volumeChange).toFixed(1)}%
                  </div>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Target className="h-3 w-3" />
                    Avg Savings
                  </div>
                  <p className="font-bold text-lg text-success">{aggregator.avgSavings.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    vs direct swaps
                  </p>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Timer className="h-3 w-3" />
                    Execution Time
                  </div>
                  <p className="font-bold text-lg">{aggregator.avgExecutionTime}s</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aggregator.trades24h)} trades
                  </p>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Shield className="h-3 w-3" />
                    Success Rate
                  </div>
                  <p className="font-bold text-lg text-success">{aggregator.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aggregator.uniqueUsers24h)} users
                  </p>
                </div>
              </div>

              {/* Features */}
              <div>
                <p className="text-sm font-medium mb-2">Key Features:</p>
                <div className="flex flex-wrap gap-1">
                  {aggregator.features.slice(0, 4).map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {aggregator.features.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{aggregator.features.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Technical Details */}
              <div className="border-t pt-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Splits:</span>
                    <span className="font-medium">{aggregator.maxSplits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fees:</span>
                    <span className="font-medium">{aggregator.fees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supported DEXes:</span>
                    <span className="font-medium">{aggregator.supportedDexes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chains:</span>
                    <span className="font-medium">{aggregator.supportedChains.length}</span>
                  </div>
                </div>

                <div className="flex gap-1 mt-2">
                  {aggregator.apiAvailable && <Badge variant="outline" className="text-xs">API</Badge>}
                  {aggregator.sdkAvailable && <Badge variant="outline" className="text-xs">SDK</Badge>}
                  {aggregator.gasOptimization && <Badge variant="outline" className="text-xs">Gas Opt</Badge>}
                  {aggregator.mevProtection && <Badge variant="outline" className="text-xs">MEV Protection</Badge>}
                  {aggregator.limitOrders && <Badge variant="outline" className="text-xs">Limit Orders</Badge>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1">
                  Use Router
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAggregators.length === 0 && (
        <div className="text-center py-20">
          <Route className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No aggregators found matching your search.</p>
        </div>
      )}
    </div>
  );
}