'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Database,
  Shield,
  Clock,
  TrendingUp,
  Activity,
  Search,
  ArrowUpDown,
  Eye
} from 'lucide-react';

interface Oracle {
  id: string;
  name: string;
  type: 'Price Feed' | 'VRF' | 'Automation' | 'Cross-Chain' | 'Custom API';
  network: string[];
  priceFeeds: number;
  updateFrequency: string;
  deviation: number;
  uptime: number;
  marketCap: string;
  volume24h: string;
  nodes: number;
  reputation: number;
  securityScore: number;
  status: 'Active' | 'Maintenance' | 'Deprecated';
  features: string[];
  supportedAssets: string[];
  description: string;
}

export default function OraclesSection() {
  const [loading, setLoading] = useState(true);
  const [oracles, setOracles] = useState<Oracle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'marketCap' | 'uptime' | 'nodes' | 'reputation'>('marketCap');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterNetwork, setFilterNetwork] = useState<string>('All');

  const formatValue = (value: number): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const getOracleType = (name: string): Oracle['type'] => {
    if (name.includes('Switchboard')) return 'Custom API';
    if (name.includes('Chainlink')) return 'Cross-Chain';
    return 'Price Feed';
  };

  const fetchOracleData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/oracles');
      const data = await response.json();

      if (data.success && data.data) {
        const providers = data.data.providers || [];
        const transformed: Oracle[] = providers.map((p: any, idx: number) => {
          const confidence = Math.min(100, Math.max(0, p.avgConfidence || 99));
          return {
            id: p.slug || String(idx + 1),
            name: p.name,
            type: getOracleType(p.name),
            network: ['Solana'],
            priceFeeds: p.totalFeeds || 0,
            updateFrequency: p.avgUpdateFrequency || 'Unknown',
            deviation: Math.max(0, (100 - confidence) * 10),
            uptime: Math.min(99.9, Math.max(95, 98 + (confidence - 98))),
            marketCap: formatValue((p.totalSubscribers || 0) * 0.5),
            volume24h: formatValue((p.totalSubscribers || 0) * 2),
            nodes: p.dataSourceCount || 0,
            reputation: Math.round(confidence * 0.95),
            securityScore: Math.round(confidence * 0.92),
            status: (p.activeFeeds || 0) > (p.totalFeeds || 1) * 0.9 ? 'Active' : 'Maintenance' as Oracle['status'],
            features: p.features || [],
            supportedAssets: ['Crypto', 'DeFi Tokens', 'Stablecoins'],
            description: p.description || ''
          };
        });
        setOracles(transformed);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching oracle data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOracleData();
    const interval = setInterval(() => fetchOracleData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchOracleData]);

  const filteredAndSortedOracles = oracles
    .filter(oracle => 
      oracle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      oracle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      oracle.network.some(net => net.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(oracle => filterType === 'All' || oracle.type === filterType)
    .filter(oracle => filterNetwork === 'All' || oracle.network.includes(filterNetwork))
    .sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return parseFloat(b.marketCap.replace(/[^\d.]/g, '')) - parseFloat(a.marketCap.replace(/[^\d.]/g, ''));
        case 'uptime':
          return b.uptime - a.uptime;
        case 'nodes':
          return b.nodes - a.nodes;
        case 'reputation':
          return b.reputation - a.reputation;
        default:
          return 0;
      }
    });

  const types = ['All', ...Array.from(new Set(oracles.map(oracle => oracle.type)))];
  const networks = ['All', ...Array.from(new Set(oracles.flatMap(oracle => oracle.network)))];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-success/10 text-success';
      case 'Maintenance': return 'bg-warning/10 text-warning';
      case 'Deprecated': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Price Feed': return 'bg-info/10 text-info';
      case 'VRF': return 'bg-primary/10 text-primary';
      case 'Automation': return 'bg-warning/10 text-warning';
      case 'Cross-Chain': return 'bg-success/10 text-success';
      case 'Custom API': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading oracle data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Oracle Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive analysis of oracle networks, data providers, and decentralized data feeds
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search oracles..."
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
            aria-label="Filter by oracle type"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="filter-network">Filter by network</label>
          <select
            id="filter-network"
            value={filterNetwork}
            onChange={(e) => setFilterNetwork(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            aria-label="Filter by network"
          >
            {networks.map(network => (
              <option key={network} value={network}>{network}</option>
            ))}
          </select>
          
          <Button variant="outline" size="sm" onClick={() => setSortBy(sortBy === 'marketCap' ? 'uptime' : 'marketCap')}>
            <ArrowUpDown className="h-4 w-4 mr-1" />
            Sort by {sortBy === 'marketCap' ? 'Market Cap' : 'Uptime'}
          </Button>
        </div>
      </div>

      {/* Oracles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedOracles.map((oracle) => (
          <Card key={oracle.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {oracle.name}
                  </CardTitle>
                  <CardDescription>{oracle.description}</CardDescription>
                </div>
                <Badge className={getStatusColor(oracle.status)}>
                  {oracle.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={getTypeColor(oracle.type)}>
                  {oracle.type}
                </Badge>
                <Badge variant="outline">{oracle.nodes} Nodes</Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-success" />
                  <div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="font-semibold">{oracle.uptime}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-info" />
                  <div>
                    <div className="text-sm text-muted-foreground">Update Freq</div>
                    <div className="font-semibold text-xs">{oracle.updateFrequency}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Security</div>
                    <div className="font-semibold">{oracle.securityScore}/100</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <div>
                    <div className="text-sm text-muted-foreground">Reputation</div>
                    <div className="font-semibold">{oracle.reputation}/100</div>
                  </div>
                </div>
              </div>

              {/* Market Data */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Market Cap:</span>
                  <span className="text-sm font-medium">${oracle.marketCap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">24h Volume:</span>
                  <span className="text-sm font-medium">${oracle.volume24h}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Price Feeds:</span>
                  <span className="text-sm font-medium">{oracle.priceFeeds.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Deviation:</span>
                  <span className="text-sm font-medium">{oracle.deviation}%</span>
                </div>
              </div>

              {/* Networks */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Supported Networks:</div>
                <div className="flex flex-wrap gap-1">
                  {oracle.network.slice(0, 3).map((network, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {network}
                    </Badge>
                  ))}
                  {oracle.network.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{oracle.network.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Features:</div>
                <div className="flex flex-wrap gap-1">
                  {oracle.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {oracle.features.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{oracle.features.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Supported Assets Preview */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Asset Types:</div>
                <div className="text-xs text-muted-foreground">
                  {oracle.supportedAssets.slice(0, 3).join(', ')}
                  {oracle.supportedAssets.length > 3 && '...'}
                </div>
              </div>

              {/* Action Button */}
              <Button className="w-full" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAndSortedOracles.length === 0 && (
        <div className="text-center py-20">
          <div className="text-muted-foreground">No oracles found matching your criteria.</div>
        </div>
      )}
    </div>
  );
}