'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, TrendingUp, TrendingDown, BarChart3, Search, Sprout, Shield, Target, DollarSign, Users } from 'lucide-react';

interface YieldAggregatorData {
  name: string;
  description: string;
  website: string;
  tvl: number;
  tvlChange: number;
  apy: number;
  volume24h: number;
  users: number;
  strategies: number;
  autoCompounding: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  supportedProtocols: string[];
  supportedAssets: string[];
  fees: string;
  category: string;
  logo?: string;
  features: string[];
  minDeposit: number;
  maxCapacity: number;
  harvesting: 'auto' | 'manual' | 'both';
  insurance: boolean;
  auditStatus: 'audited' | 'unaudited' | 'pending';
  launched: string;
}

export default function YieldAggregatorsSection() {
  const [aggregators, setAggregators] = useState<YieldAggregatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'tvl' | 'apy' | 'volume24h' | 'users'>('tvl');

  useEffect(() => {
    async function fetchYieldAggregatorData() {
      try {
        // Simulate API call - in real implementation this would fetch from analytics API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const yieldAggregatorsList: YieldAggregatorData[] = [
          {
            name: 'Francium',
            description: 'Leveraged yield farming and auto-compounding strategies on Solana',
            website: 'https://francium.io',
            tvl: 89000000,
            tvlChange: 15.8,
            apy: 28.4,
            volume24h: 12000000,
            users: 8900,
            strategies: 12,
            autoCompounding: true,
            riskLevel: 'medium',
            supportedProtocols: ['Raydium', 'Orca', 'Saber', 'Tulip'],
            supportedAssets: ['SOL', 'USDC', 'RAY', 'ORCA', 'SBR'],
            fees: '20% performance',
            category: 'Leveraged Farming',
            features: ['Leveraged Yield', 'Auto-compound', 'Flash Loans', 'Risk Management'],
            minDeposit: 10,
            maxCapacity: 50000000,
            harvesting: 'auto',
            insurance: false,
            auditStatus: 'audited',
            launched: '2021-09'
          },
          {
            name: 'Tulip Protocol',
            description: 'Automated yield farming with optimized strategies across Solana DeFi',
            website: 'https://tulip.garden',
            tvl: 156000000,
            tvlChange: 8.9,
            apy: 22.7,
            volume24h: 8900000,
            users: 12400,
            strategies: 18,
            autoCompounding: true,
            riskLevel: 'low',
            supportedProtocols: ['Raydium', 'Orca', 'Saber', 'Mercurial', 'Sunny'],
            supportedAssets: ['SOL', 'USDC', 'USDT', 'RAY', 'ORCA', 'SBR', 'MER'],
            fees: '15% performance',
            category: 'Auto-compound Vaults',
            features: ['Multi-protocol', 'Auto-harvest', 'Compound Strategies', 'Portfolio Tracking'],
            minDeposit: 5,
            maxCapacity: 100000000,
            harvesting: 'auto',
            insurance: true,
            auditStatus: 'audited',
            launched: '2021-08'
          },
          {
            name: 'Solend Farms',
            description: 'Yield farming extension of Solend with automated position management',
            website: 'https://solend.fi',
            tvl: 67000000,
            tvlChange: 12.3,
            apy: 19.8,
            volume24h: 5600000,
            users: 6700,
            strategies: 8,
            autoCompounding: true,
            riskLevel: 'low',
            supportedProtocols: ['Solend', 'Raydium', 'Orca'],
            supportedAssets: ['SOL', 'USDC', 'USDT', 'ETH', 'BTC'],
            fees: '10% performance',
            category: 'Lending-based Farming',
            features: ['Lending Integration', 'Liquidation Protection', 'Cross-collateral', 'Stable Yields'],
            minDeposit: 1,
            maxCapacity: 200000000,
            harvesting: 'auto',
            insurance: true,
            auditStatus: 'audited',
            launched: '2021-12'
          },
          {
            name: 'Sunny Aggregator',
            description: 'Optimized yield farming across multiple protocols with smart rebalancing',
            website: 'https://sunny.ag',
            tvl: 45000000,
            tvlChange: -5.2,
            apy: 31.5,
            volume24h: 3400000,
            users: 3200,
            strategies: 15,
            autoCompounding: true,
            riskLevel: 'medium',
            supportedProtocols: ['Saber', 'Quarry', 'Sunny', 'Raydium'],
            supportedAssets: ['SOL', 'USDC', 'USDT', 'SBR', 'SUNNY'],
            fees: '25% performance',
            category: 'Multi-protocol Optimizer',
            features: ['Smart Rebalancing', 'Quarry Mining', 'Saber Pools', 'Governance Tokens'],
            minDeposit: 50,
            maxCapacity: 25000000,
            harvesting: 'auto',
            insurance: false,
            auditStatus: 'audited',
            launched: '2021-10'
          },
          {
            name: 'Katana Farms',
            description: 'High-yield farming strategies with automated risk management',
            website: 'https://katana.so',
            tvl: 28000000,
            tvlChange: 22.1,
            apy: 45.3,
            volume24h: 4500000,
            users: 1800,
            strategies: 6,
            autoCompounding: true,
            riskLevel: 'high',
            supportedProtocols: ['Raydium', 'Orca', 'Meteora'],
            supportedAssets: ['SOL', 'USDC', 'RAY', 'ORCA', 'MET'],
            fees: '30% performance',
            category: 'High-yield Strategies',
            features: ['High APY', 'Active Management', 'Risk Metrics', 'Dynamic Allocation'],
            minDeposit: 100,
            maxCapacity: 10000000,
            harvesting: 'auto',
            insurance: false,
            auditStatus: 'pending',
            launched: '2023-03'
          },
          {
            name: 'Marinade Liquid Staking',
            description: 'Liquid staking with yield optimization and DeFi integration',
            website: 'https://marinade.finance',
            tvl: 234000000,
            tvlChange: 18.7,
            apy: 7.2,
            volume24h: 15000000,
            users: 18900,
            strategies: 4,
            autoCompounding: true,
            riskLevel: 'low',
            supportedProtocols: ['Marinade', 'Raydium', 'Orca', 'Solend'],
            supportedAssets: ['SOL', 'mSOL'],
            fees: '6% staking rewards',
            category: 'Liquid Staking',
            features: ['Liquid Staking', 'mSOL Token', 'DeFi Integration', 'Validator Network'],
            minDeposit: 0.01,
            maxCapacity: 1000000000,
            harvesting: 'auto',
            insurance: true,
            auditStatus: 'audited',
            launched: '2021-08'
          },
          {
            name: 'Quarry Protocol',
            description: 'Gauge-based yield farming with governance token rewards',
            website: 'https://quarry.so',
            tvl: 78000000,
            tvlChange: 9.4,
            apy: 25.1,
            volume24h: 6700000,
            users: 5400,
            strategies: 22,
            autoCompounding: false,
            riskLevel: 'medium',
            supportedProtocols: ['Saber', 'Crate', 'Quarry', 'Cashio'],
            supportedAssets: ['SOL', 'USDC', 'USDT', 'SBR', 'CASH'],
            fees: 'Protocol dependent',
            category: 'Gauge-based Farming',
            features: ['Gauge Voting', 'Governance Rewards', 'Protocol Incentives', 'Multi-asset'],
            minDeposit: 25,
            maxCapacity: 500000000,
            harvesting: 'manual',
            insurance: false,
            auditStatus: 'audited',
            launched: '2022-01'
          },
          {
            name: 'Lifinity Yield',
            description: 'Delta-neutral yield strategies with market making integration',
            website: 'https://lifinity.io',
            tvl: 34000000,
            tvlChange: 6.8,
            apy: 18.9,
            volume24h: 2300000,
            users: 1200,
            strategies: 5,
            autoCompounding: true,
            riskLevel: 'low',
            supportedProtocols: ['Lifinity', 'Raydium', 'Orca'],
            supportedAssets: ['SOL', 'USDC', 'USDT', 'LFNTY'],
            fees: '20% performance',
            category: 'Delta-neutral Strategies',
            features: ['Delta-neutral', 'Market Making', 'Impermanent Loss Protection', 'Professional MM'],
            minDeposit: 500,
            maxCapacity: 20000000,
            harvesting: 'auto',
            insurance: true,
            auditStatus: 'audited',
            launched: '2022-06'
          },
          {
            name: 'Hedge Farms',
            description: 'Advanced yield strategies with hedging and derivatives integration',
            website: 'https://hedge.so',
            tvl: 19000000,
            tvlChange: 31.2,
            apy: 52.7,
            volume24h: 1800000,
            users: 450,
            strategies: 3,
            autoCompounding: true,
            riskLevel: 'high',
            supportedProtocols: ['Drift', 'Mango', 'Zeta'],
            supportedAssets: ['SOL', 'USDC', 'BTC', 'ETH'],
            fees: '35% performance',
            category: 'Derivatives-based',
            features: ['Derivatives Integration', 'Hedging Strategies', 'Options Trading', 'Risk Parity'],
            minDeposit: 1000,
            maxCapacity: 5000000,
            harvesting: 'auto',
            insurance: false,
            auditStatus: 'unaudited',
            launched: '2023-08'
          }
        ];

        setAggregators(yieldAggregatorsList.sort((a, b) => b.tvl - a.tvl));
      } catch (err) {
        console.error('Error fetching yield aggregator data:', err);
        setError('Failed to load yield aggregator data');
      } finally {
        setLoading(false);
      }
    }

    fetchYieldAggregatorData();
  }, []);

  const categories = ['all', 'Leveraged Farming', 'Auto-compound Vaults', 'Lending-based Farming', 'Multi-protocol Optimizer', 'High-yield Strategies', 'Liquid Staking', 'Gauge-based Farming', 'Delta-neutral Strategies', 'Derivatives-based'];
  const riskLevels = ['all', 'low', 'medium', 'high'];

  const filteredAggregators = aggregators
    .filter(agg => 
      (categoryFilter === 'all' || agg.category === categoryFilter) &&
      (riskFilter === 'all' || agg.riskLevel === riskFilter) &&
      (agg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       agg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       agg.features.some(feature => feature.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAuditColor = (status: string) => {
    switch (status) {
      case 'audited': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'unaudited': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

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
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
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
            <Sprout className="h-5 w-5" />
            Yield Farming Aggregators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search yield aggregators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                {riskLevels.map(risk => (
                  <option key={risk} value={risk}>
                    {risk === 'all' ? 'All Risk Levels' : `${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk`}
                  </option>
                ))}
              </select>
              <Button
                variant={sortBy === 'tvl' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('tvl')}
              >
                TVL
              </Button>
              <Button
                variant={sortBy === 'apy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('apy')}
              >
                APY
              </Button>
              <Button
                variant={sortBy === 'volume24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('volume24h')}
              >
                Volume
              </Button>
              <Button
                variant={sortBy === 'users' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('users')}
              >
                Users
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
              <Sprout className="h-5 w-5 text-green-500" />
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
              <DollarSign className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total TVL</p>
                <p className="text-2xl font-bold">${formatNumber(aggregators.reduce((sum, agg) => sum + agg.tvl, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Average APY</p>
                <p className="text-2xl font-bold">{(aggregators.reduce((sum, agg) => sum + agg.apy, 0) / aggregators.length).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{formatNumber(aggregators.reduce((sum, agg) => sum + agg.users, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Yield Aggregator Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAggregators.map((aggregator) => (
          <Card key={aggregator.name} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    <Sprout className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{aggregator.name}</CardTitle>
                      <Badge className={`${getRiskColor(aggregator.riskLevel)} text-white text-xs`}>
                        {aggregator.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {aggregator.category}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(aggregator.website, '_blank')}
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
                    <DollarSign className="h-3 w-3" />
                    TVL
                  </div>
                  <p className="font-bold text-lg">${formatNumber(aggregator.tvl)}</p>
                  <div className={`flex items-center gap-1 text-xs ${
                    aggregator.tvlChange >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {aggregator.tvlChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(aggregator.tvlChange).toFixed(1)}%
                  </div>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Target className="h-3 w-3" />
                    APY
                  </div>
                  <p className="font-bold text-lg text-green-500">{aggregator.apy.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {aggregator.strategies} strategies
                  </p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <BarChart3 className="h-3 w-3" />
                    Volume 24h
                  </div>
                  <p className="font-bold text-lg">${formatNumber(aggregator.volume24h)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aggregator.users)} users
                  </p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Shield className="h-3 w-3" />
                    Security
                  </div>
                  <Badge className={`${getAuditColor(aggregator.auditStatus)} text-xs`}>
                    {aggregator.auditStatus}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {aggregator.insurance ? 'Insured' : 'No insurance'}
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
                    <span className="text-muted-foreground">Min Deposit:</span>
                    <span className="font-medium">${formatNumber(aggregator.minDeposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fees:</span>
                    <span className="font-medium">{aggregator.fees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protocols:</span>
                    <span className="font-medium">{aggregator.supportedProtocols.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Harvesting:</span>
                    <span className="font-medium">{aggregator.harvesting}</span>
                  </div>
                </div>
                
                <div className="flex gap-1 mt-2">
                  {aggregator.autoCompounding && <Badge variant="outline" className="text-xs">Auto-compound</Badge>}
                  {aggregator.insurance && <Badge variant="outline" className="text-xs">Insured</Badge>}
                  <Badge variant="outline" className="text-xs">Since {aggregator.launched}</Badge>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1">
                  Start Farming
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredAggregators.length === 0 && (
        <div className="text-center py-20">
          <Sprout className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No yield aggregators found matching your search.</p>
        </div>
      )}
    </div>
  );
}