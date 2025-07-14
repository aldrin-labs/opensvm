'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchOracleData = async () => {
      setLoading(true);
      try {
        // Simulate API call with realistic oracle data
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockData: Oracle[] = [
          {
            id: '1',
            name: 'Pyth Network',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 380,
            updateFrequency: '400ms',
            deviation: 0.1,
            uptime: 99.8,
            marketCap: '1.2B',
            volume24h: '8.5B',
            nodes: 95,
            reputation: 92,
            securityScore: 90,
            status: 'Active',
            features: ['High Frequency', 'Financial Data', 'Pull Model', 'Low Latency'],
            supportedAssets: ['Stocks', 'Forex', 'Crypto', 'Commodities'],
            description: 'High-frequency oracle network designed for financial market data with sub-second updates on Solana.'
          },
          {
            id: '2',
            name: 'Switchboard',
            type: 'Custom API',
            network: ['Solana'],
            priceFeeds: 180,
            updateFrequency: '1-30 seconds',
            deviation: 0.7,
            uptime: 99.0,
            marketCap: '42M',
            volume24h: '680M',
            nodes: 28,
            reputation: 78,
            securityScore: 83,
            status: 'Active',
            features: ['Permissionless', 'Custom Functions', 'TEE Support', 'Multi-source'],
            supportedAssets: ['Solana Native', 'Custom Data Sources'],
            description: 'Permissionless oracle protocol enabling developers to build custom oracle functions on Solana.'
          },
          {
            id: '3',
            name: 'Chainlink on Solana',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 45,
            updateFrequency: '30-60 seconds',
            deviation: 0.5,
            uptime: 99.5,
            marketCap: '150M',
            volume24h: '2.1B',
            nodes: 15,
            reputation: 85,
            securityScore: 88,
            status: 'Active',
            features: ['Established Network', 'Reliable Feeds', 'Cross-chain Bridge', 'Proven Security'],
            supportedAssets: ['Major Crypto', 'Traditional Assets', 'Commodities'],
            description: 'Chainlink price feeds bridged to Solana ecosystem with proven reliability and security.'
          },
          {
            id: '4',
            name: 'Flux Protocol',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 25,
            updateFrequency: '1-5 minutes',
            deviation: 0.8,
            uptime: 98.5,
            marketCap: '8M',
            volume24h: '125M',
            nodes: 12,
            reputation: 70,
            securityScore: 75,
            status: 'Active',
            features: ['Community Driven', 'Low Cost', 'Solana Native', 'Open Source'],
            supportedAssets: ['Solana Tokens', 'Basic Price Feeds'],
            description: 'Community-driven oracle protocol native to Solana with focus on accessibility and low costs.'
          },
          {
            id: '5',
            name: 'DIA on Solana',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 150,
            updateFrequency: '2 minutes',
            deviation: 0.8,
            uptime: 99.1,
            marketCap: '12M',
            volume24h: '180M',
            nodes: 8,
            reputation: 72,
            securityScore: 80,
            status: 'Active',
            features: ['Open Source', 'NFT Floor Prices', 'DeFi Metrics', 'Transparent'],
            supportedAssets: ['Solana Tokens', 'NFTs', 'DeFi Metrics'],
            description: 'Open-source oracle providing transparent and verified data for Solana ecosystem.'
          },
          {
            id: '6',
            name: 'Solana Price Oracle',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 80,
            updateFrequency: '10-30 seconds',
            deviation: 0.6,
            uptime: 98.8,
            marketCap: '5M',
            volume24h: '95M',
            nodes: 6,
            reputation: 68,
            securityScore: 72,
            status: 'Active',
            features: ['Native Integration', 'Fast Updates', 'Low Fees', 'SPL Token Support'],
            supportedAssets: ['SPL Tokens', 'Major Crypto', 'Stablecoins'],
            description: 'Native Solana oracle focused on SPL token price feeds with fast updates and low fees.'
          },
          {
            id: '7',
            name: 'Solend Oracle',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 35,
            updateFrequency: '1-2 minutes',
            deviation: 0.4,
            uptime: 99.2,
            marketCap: '3M',
            volume24h: '450M',
            nodes: 5,
            reputation: 75,
            securityScore: 78,
            status: 'Active',
            features: ['Lending Focused', 'Liquidation Safe', 'High Accuracy', 'DeFi Integration'],
            supportedAssets: ['Lending Assets', 'Collateral Tokens'],
            description: 'Oracle infrastructure powering Solend lending protocol with focus on accurate liquidation prices.'
          },
          {
            id: '8',
            name: 'Serum Price Oracle',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 60,
            updateFrequency: '5-15 seconds',
            deviation: 0.3,
            uptime: 98.9,
            marketCap: '4M',
            volume24h: '320M',
            nodes: 8,
            reputation: 73,
            securityScore: 76,
            status: 'Active',
            features: ['DEX Integration', 'Market Data', 'Real-time', 'Order Book Based'],
            supportedAssets: ['Serum Markets', 'DEX Pairs', 'Trading Data'],
            description: 'Oracle system integrated with Serum DEX providing real-time market data and price feeds.'
          },
          {
            id: '9',
            name: 'Orca Price Feeds',
            type: 'Price Feed',
            network: ['Solana'],
            priceFeeds: 40,
            updateFrequency: '10-30 seconds',
            deviation: 0.5,
            uptime: 99.0,
            marketCap: '2M',
            volume24h: '280M',
            nodes: 4,
            reputation: 71,
            securityScore: 74,
            status: 'Active',
            features: ['AMM Integration', 'LP Token Prices', 'Concentrated Liquidity', 'Whirlpool Data'],
            supportedAssets: ['Orca Pools', 'LP Tokens', 'Whirlpool Positions'],
            description: 'Oracle service providing accurate pricing for Orca AMM pools and concentrated liquidity positions.'
          }
        ];

        setOracles(mockData);
      } catch (error) {
        console.error('Error fetching oracle data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOracleData();
  }, []);

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
      case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Deprecated': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Price Feed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'VRF': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Automation': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'Cross-Chain': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Custom API': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
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
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <select
            value={filterNetwork}
            onChange={(e) => setFilterNetwork(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
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
                  <Activity className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="font-semibold">{oracle.uptime}%</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Update Freq</div>
                    <div className="font-semibold text-xs">{oracle.updateFrequency}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Security</div>
                    <div className="font-semibold">{oracle.securityScore}/100</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
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