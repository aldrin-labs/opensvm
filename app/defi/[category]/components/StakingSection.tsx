'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchStakingData = async () => {
      setLoading(true);
      try {
        // Simulate API call with realistic staking data
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockData: StakingPool[] = [
          {
            id: '1',
            name: 'Marinade Finance',
            network: 'Solana',
            type: 'Liquid Staking',
            apy: 6.4,
            commission: 8.0,
            minStake: '0.01 SOL',
            lockPeriod: 'No lock',
            uptime: 99.5,
            totalStaked: '6.8M SOL',
            delegators: 125000,
            riskLevel: 'Low',
            status: 'Active',
            features: ['Liquid Staking', 'mSOL Token', 'Auto-delegation', 'Yield Optimization'],
            description: 'Native liquid staking protocol for Solana ecosystem with mSOL token.'
          },
          {
            id: '2',
            name: 'Lido for Solana',
            network: 'Solana',
            type: 'Liquid Staking',
            apy: 6.1,
            commission: 10.0,
            minStake: '0.001 SOL',
            lockPeriod: 'No lock',
            uptime: 99.7,
            totalStaked: '4.2M SOL',
            delegators: 85000,
            riskLevel: 'Low',
            status: 'Active',
            features: ['stSOL Token', 'Instant Liquidity', 'DeFi Integration', 'No Minimum'],
            description: 'Lido liquid staking protocol for Solana with stSOL token and DeFi integration.'
          },
          {
            id: '3',
            name: 'Jito Staking',
            network: 'Solana',
            type: 'Liquid Staking',
            apy: 7.2,
            commission: 7.0,
            minStake: '0.01 SOL',
            lockPeriod: 'No lock',
            uptime: 99.3,
            totalStaked: '2.8M SOL',
            delegators: 45000,
            riskLevel: 'Medium',
            status: 'Active',
            features: ['MEV Rewards', 'JitoSOL Token', 'High Performance', 'MEV Protection'],
            description: 'Solana liquid staking with MEV rewards and enhanced validator performance.'
          },
          {
            id: '4',
            name: 'Coinbase Validator',
            network: 'Solana',
            type: 'Validator',
            apy: 5.8,
            commission: 5.0,
            minStake: '1 SOL',
            lockPeriod: '1 epoch',
            uptime: 99.8,
            totalStaked: '1.2M SOL',
            delegators: 12500,
            riskLevel: 'Low',
            status: 'Active',
            features: ['Institutional Grade', 'High Security', 'Professional Operation', '24/7 Monitoring'],
            description: 'Professional Solana validator service by Coinbase with institutional security.'
          },
          {
            id: '5',
            name: 'Everstake',
            network: 'Solana',
            type: 'Validator',
            apy: 6.8,
            commission: 4.0,
            minStake: '0.5 SOL',
            lockPeriod: '1 epoch',
            uptime: 99.6,
            totalStaked: '890K SOL',
            delegators: 8900,
            riskLevel: 'Low',
            status: 'Active',
            features: ['Low Commission', 'High Performance', 'Community Focused', 'Governance Active'],
            description: 'Community-focused Solana validator with low commission and high performance.'
          },
          {
            id: '6',
            name: 'Figment Networks',
            network: 'Solana',
            type: 'Validator',
            apy: 6.2,
            commission: 8.0,
            minStake: '1 SOL',
            lockPeriod: '1 epoch',
            uptime: 99.9,
            totalStaked: '1.8M SOL',
            delegators: 15600,
            riskLevel: 'Low',
            status: 'Active',
            features: ['Professional Operation', 'Research Team', 'High Uptime', 'Institutional'],
            description: 'Professional Solana validator with institutional-grade infrastructure and research.'
          },
          {
            id: '7',
            name: 'Stakewiz',
            network: 'Solana',
            type: 'Validator',
            apy: 7.1,
            commission: 3.0,
            minStake: '0.1 SOL',
            lockPeriod: '1 epoch',
            uptime: 99.4,
            totalStaked: '650K SOL',
            delegators: 6700,
            riskLevel: 'Medium',
            status: 'Active',
            features: ['Low Commission', 'Community Driven', 'Educational Content', 'Transparent'],
            description: 'Community-driven Solana validator with educational focus and transparent operations.'
          },
          {
            id: '8',
            name: 'Chorus One',
            network: 'Solana',
            type: 'Validator',
            apy: 6.5,
            commission: 6.0,
            minStake: '1 SOL',
            lockPeriod: '1 epoch',
            uptime: 99.7,
            totalStaked: '1.1M SOL',
            delegators: 9800,
            riskLevel: 'Low',
            status: 'Active',
            features: ['Multi-chain Expertise', 'Professional Team', 'High Reliability', 'Governance'],
            description: 'Professional Solana validator with multi-chain expertise and governance participation.'
          },
          {
            id: '9',
            name: 'SolBlaze',
            network: 'Solana',
            type: 'Liquid Staking',
            apy: 6.9,
            commission: 9.0,
            minStake: '0.001 SOL',
            lockPeriod: 'No lock',
            uptime: 99.2,
            totalStaked: '1.5M SOL',
            delegators: 23000,
            riskLevel: 'Medium',
            status: 'Active',
            features: ['blazeSOL Token', 'Auto-compound', 'DeFi Ready', 'Performance Focus'],
            description: 'Performance-focused Solana liquid staking with blazeSOL token and auto-compounding.'
          }
        ];

        setStakingPools(mockData);
      } catch (error) {
        console.error('Error fetching staking data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStakingData();
  }, []);

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
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'Jailed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
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
          <select
            value={filterNetwork}
            onChange={(e) => setFilterNetwork(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            {networks.map(network => (
              <option key={network} value={network}>{network}</option>
            ))}
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
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
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">APY</div>
                    <div className="font-semibold">{pool.apy}%</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Commission</div>
                    <div className="font-semibold">{pool.commission}%</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="font-semibold">{pool.uptime}%</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
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