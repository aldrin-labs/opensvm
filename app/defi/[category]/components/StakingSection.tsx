'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  TrendingUp, 
  Users, 
  DollarSign,
  Activity,
  Search,
  ArrowUpDown
} from 'lucide-react';

interface StakingPool {
  id: string;
  name: string;
  network: string;
  type: 'Validator' | 'Pool' | 'Liquid Staking';
  apy: number;
  commission: number;
  minStake: string;
  lockPeriod: string;
  uptime: number;
  totalStaked: string;
  delegators: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  status: 'Active' | 'Inactive' | 'Jailed';
  features: string[];
  description: string;
}

export default function StakingSection() {
  const [loading, setLoading] = useState(true);
  const [stakingPools, setStakingPools] = useState<StakingPool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'apy' | 'commission' | 'uptime' | 'totalStaked'>('apy');
  const [filterNetwork, setFilterNetwork] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All');

  const formatStaked = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M SOL`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K SOL`;
    return `${value.toFixed(0)} SOL`;
  };

  const fetchStakingData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/staking');
      const data = await response.json();

      if (data.success && data.data) {
        // Transform API data to match component interface
        const pools = (data.data.pools || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          network: 'Solana',
          type: p.type,
          apy: p.apy,
          commission: p.commission,
          minStake: `${p.minStake} SOL`,
          lockPeriod: p.lockPeriod,
          uptime: p.uptime,
          totalStaked: formatStaked(p.totalStaked),
          delegators: p.delegators,
          riskLevel: p.riskLevel,
          status: p.status,
          features: p.features,
          description: p.description
        }));
        setStakingPools(pools);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching staking data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStakingData();
    const interval = setInterval(() => fetchStakingData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchStakingData]);

  const filteredAndSortedPools = stakingPools
    .filter(pool => 
      pool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pool.network.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pool.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(pool => filterNetwork === 'All' || pool.network === filterNetwork)
    .filter(pool => filterType === 'All' || pool.type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'apy':
          return b.apy - a.apy;
        case 'commission':
          return a.commission - b.commission;
        case 'uptime':
          return b.uptime - a.uptime;
        case 'totalStaked':
          return parseFloat(b.totalStaked.replace(/[^\d.]/g, '')) - parseFloat(a.totalStaked.replace(/[^\d.]/g, ''));
        default:
          return 0;
      }
    });

  const networks = ['All', ...Array.from(new Set(stakingPools.map(pool => pool.network)))];
  const types = ['All', ...Array.from(new Set(stakingPools.map(pool => pool.type)))];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-success/10 text-success';
      case 'Medium': return 'bg-warning/10 text-warning';
      case 'High': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-success/10 text-success';
      case 'Inactive': return 'bg-muted text-muted-foreground';
      case 'Jailed': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading staking pools...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Staking Analytics</h1>
        <p className="text-muted-foreground">
          Validator performance, staking pools, and yield opportunities across networks
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search staking pools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
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

          <label className="sr-only" htmlFor="filter-type">Filter by type</label>
          <select
            id="filter-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            aria-label="Filter by pool type"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <Button variant="outline" size="sm" onClick={() => setSortBy(sortBy === 'apy' ? 'commission' : 'apy')}>
            <ArrowUpDown className="h-4 w-4 mr-1" />
            Sort by {sortBy === 'apy' ? 'APY' : 'Commission'}
          </Button>
        </div>
      </div>

      {/* Staking Pools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedPools.map((pool) => (
          <Card key={pool.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{pool.name}</CardTitle>
                  <CardDescription>{pool.description}</CardDescription>
                </div>
                <Badge className={getStatusColor(pool.status)}>
                  {pool.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline">{pool.network}</Badge>
                <Badge variant="outline">{pool.type}</Badge>
                <Badge className={getRiskColor(pool.riskLevel)}>
                  {pool.riskLevel} Risk
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <div>
                    <div className="text-sm text-muted-foreground">APY</div>
                    <div className="font-semibold">{pool.apy}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-info" />
                  <div>
                    <div className="text-sm text-muted-foreground">Commission</div>
                    <div className="font-semibold">{pool.commission}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="font-semibold">{pool.uptime}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-warning" />
                  <div>
                    <div className="text-sm text-muted-foreground">Delegators</div>
                    <div className="font-semibold">{pool.delegators.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Staking Details */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Min Stake:</span>
                  <span className="text-sm font-medium">{pool.minStake}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Lock Period:</span>
                  <span className="text-sm font-medium">{pool.lockPeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Staked:</span>
                  <span className="text-sm font-medium">{pool.totalStaked}</span>
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Features:</div>
                <div className="flex flex-wrap gap-1">
                  {pool.features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <Button className="w-full" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Stake Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAndSortedPools.length === 0 && (
        <div className="text-center py-20">
          <div className="text-muted-foreground">No staking pools found matching your criteria.</div>
        </div>
      )}
    </div>
  );
}