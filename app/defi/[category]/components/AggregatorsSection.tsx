'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, TrendingUp, TrendingDown, BarChart3, Search, Route, Timer, Shield, Target } from 'lucide-react';

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

  useEffect(() => {
    async function fetchAggregatorData() {
      try {
        // Simulate API call - in real implementation this would fetch from analytics API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const aggregatorsList: AggregatorData[] = [
          {
            name: 'Jupiter',
            description: 'Leading DEX aggregator on Solana with smart routing across all major DEXes',
            website: 'https://jup.ag',
            volume24h: 234000000,
            volumeChange: 18.9,
            trades24h: 67000,
            uniqueUsers24h: 15600,
            avgSavings: 2.8,
            supportedDexes: ['Raydium', 'Orca', 'Aldrin', 'Serum', 'Meteora', 'Lifinity', 'Phoenix', 'Saber'],
            supportedChains: ['Solana'],
            maxSplits: 7,
            avgExecutionTime: 1.2,
            successRate: 98.7,
            fees: 'Free',
            apiAvailable: true,
            sdkAvailable: true,
            category: 'Universal Aggregator',
            features: ['Smart Routing', 'Price Impact Minimization', 'MEV Protection', 'Limit Orders'],
            gasOptimization: true,
            mevProtection: true,
            limitOrders: true,
            crossChain: false
          },
          {
            name: 'Solana Swap Router',
            description: 'Native Solana aggregator with advanced routing algorithms optimized for speed',
            website: 'https://solana-swap.com',
            volume24h: 89000000,
            volumeChange: 12.4,
            trades24h: 28000,
            uniqueUsers24h: 8900,
            avgSavings: 3.2,
            supportedDexes: ['Raydium', 'Orca', 'Serum', 'Aldrin', 'Meteora'],
            supportedChains: ['Solana'],
            maxSplits: 5,
            avgExecutionTime: 1.8,
            successRate: 96.2,
            fees: '0.1%',
            apiAvailable: true,
            sdkAvailable: true,
            category: 'Universal Aggregator',
            features: ['Smart Routing', 'MEV Protection', 'Low Latency', 'Multi-source'],
            gasOptimization: true,
            mevProtection: true,
            limitOrders: true,
            crossChain: false
          },
          {
            name: 'Mango Router',
            description: 'Intelligent routing for Mango Markets with focus on minimal slippage',
            website: 'https://mango.markets',
            volume24h: 45000000,
            volumeChange: -5.8,
            trades24h: 12000,
            uniqueUsers24h: 3400,
            avgSavings: 1.9,
            supportedDexes: ['Mango', 'Serum', 'Raydium', 'Orca'],
            supportedChains: ['Solana'],
            maxSplits: 3,
            avgExecutionTime: 0.9,
            successRate: 97.8,
            fees: 'Platform Fee',
            apiAvailable: true,
            sdkAvailable: false,
            category: 'Specialized Router',
            features: ['Margin Trading', 'Leverage Routes', 'Perp Integration', 'Cross Margin'],
            gasOptimization: false,
            mevProtection: false,
            limitOrders: true,
            crossChain: false
          },
          {
            name: 'Solana Swap Aggregator',
            description: 'Native Solana aggregator focusing on speed and low fees',
            website: 'https://swap.solana.com',
            volume24h: 67000000,
            volumeChange: 8.3,
            trades24h: 23000,
            uniqueUsers24h: 6700,
            avgSavings: 2.1,
            supportedDexes: ['Raydium', 'Orca', 'Meteora', 'Lifinity', 'Aldrin'],
            supportedChains: ['Solana'],
            maxSplits: 4,
            avgExecutionTime: 0.8,
            successRate: 99.1,
            fees: 'Free',
            apiAvailable: true,
            sdkAvailable: true,
            category: 'Native Aggregator',
            features: ['Lightning Fast', 'Zero Fees', 'Smart Splitting', 'Real-time Pricing'],
            gasOptimization: true,
            mevProtection: false,
            limitOrders: false,
            crossChain: false
          },
          {
            name: 'Orca Whirlpool Router',
            description: 'Advanced routing for Orca concentrated liquidity pools',
            website: 'https://orca.so',
            volume24h: 34000000,
            volumeChange: 4.7,
            trades24h: 8900,
            uniqueUsers24h: 2800,
            avgSavings: 1.6,
            supportedDexes: ['Orca', 'Raydium', 'Meteora'],
            supportedChains: ['Solana'],
            maxSplits: 2,
            avgExecutionTime: 1.1,
            successRate: 98.9,
            fees: '0.05%',
            apiAvailable: true,
            sdkAvailable: true,
            category: 'Pool-specific Router',
            features: ['Concentrated Liquidity', 'Capital Efficiency', 'Dynamic Fees', 'Range Orders'],
            gasOptimization: true,
            mevProtection: false,
            limitOrders: true,
            crossChain: false
          },
          {
            name: 'Drift Router',
            description: 'Perpetuals-focused routing with spot market integration',
            website: 'https://drift.trade',
            volume24h: 28000000,
            volumeChange: 15.2,
            trades24h: 5600,
            uniqueUsers24h: 1900,
            avgSavings: 2.4,
            supportedDexes: ['Drift', 'Mango', 'Phoenix', 'Serum'],
            supportedChains: ['Solana'],
            maxSplits: 2,
            avgExecutionTime: 1.0,
            successRate: 97.2,
            fees: 'Trading Fee',
            apiAvailable: true,
            sdkAvailable: true,
            category: 'Perp-focused Router',
            features: ['Perp Integration', 'Spot-Perp Arbitrage', 'Insurance Fund', 'Dynamic Funding'],
            gasOptimization: false,
            mevProtection: true,
            limitOrders: true,
            crossChain: false
          },
          {
            name: 'Phoenix Router',
            description: 'High-frequency trading optimized routing with advanced order types',
            website: 'https://phoenix.trade',
            volume24h: 19000000,
            volumeChange: -2.1,
            trades24h: 3400,
            uniqueUsers24h: 890,
            avgSavings: 1.8,
            supportedDexes: ['Phoenix', 'Serum', 'Mango'],
            supportedChains: ['Solana'],
            maxSplits: 2,
            avgExecutionTime: 0.6,
            successRate: 98.4,
            fees: '0.02%',
            apiAvailable: true,
            sdkAvailable: false,
            category: 'HFT Router',
            features: ['Ultra Low Latency', 'Advanced Orders', 'Maker Rebates', 'Pro Trading'],
            gasOptimization: true,
            mevProtection: true,
            limitOrders: true,
            crossChain: false
          },
          {
            name: 'Solana Bridge Router',
            description: 'Specialized in Solana bridge optimization and cross-ecosystem swaps',
            website: 'https://solana-bridge.com',
            volume24h: 56000000,
            volumeChange: 22.8,
            trades24h: 8900,
            uniqueUsers24h: 4200,
            avgSavings: 4.1,
            supportedDexes: ['Raydium', 'Orca', 'Wormhole', 'AllBridge', 'Portal'],
            supportedChains: ['Solana'],
            maxSplits: 3,
            avgExecutionTime: 2.5,
            successRate: 94.8,
            fees: '0.3%',
            apiAvailable: true,
            sdkAvailable: true,
            category: 'Bridge Aggregator',
            features: ['Wormhole Integration', 'Portal Bridge', 'Multi-hop Routes', 'Fast Finality'],
            gasOptimization: true,
            mevProtection: false,
            limitOrders: false,
            crossChain: false
          }
        ];

        setAggregators(aggregatorsList.sort((a, b) => b.volume24h - a.volume24h));
      } catch (err) {
        console.error('Error fetching aggregator data:', err);
        setError('Failed to load aggregator data');
      } finally {
        setLoading(false);
      }
    }

    fetchAggregatorData();
  }, []);

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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-blue-500" />
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
              <BarChart3 className="h-5 w-5 text-green-500" />
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
              <Target className="h-5 w-5 text-purple-500" />
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
              <Shield className="h-5 w-5 text-orange-500" />
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
                    <BarChart3 className="h-3 w-3" />
                    Volume 24h
                  </div>
                  <p className="font-bold text-lg">${formatNumber(aggregator.volume24h)}</p>
                  <div className={`flex items-center gap-1 text-xs ${
                    aggregator.volumeChange >= 0 ? 'text-green-500' : 'text-red-500'
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
                  <p className="font-bold text-lg text-green-500">{aggregator.avgSavings.toFixed(1)}%</p>
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
                  <p className="font-bold text-lg text-green-500">{aggregator.successRate.toFixed(1)}%</p>
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