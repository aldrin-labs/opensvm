'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchStablecoinData = async () => {
      setLoading(true);
      try {
        // Simulate API call with realistic stablecoin data
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockData: Stablecoin[] = [
          {
            id: '1',
            name: 'USD Coin (Solana)',
            symbol: 'USDC',
            type: 'Fiat-Collateralized',
            currentPrice: 1.0001,
            pegDeviation: 0.01,
            marketCap: '3.2B',
            volume24h: '450M',
            circulatingSupply: '3.2B',
            collateralRatio: 100,
            transparencyScore: 95,
            riskLevel: 'Low',
            pegStability: 'Excellent',
            backing: ['USD Cash', 'Treasury Bills', 'Commercial Paper'],
            issuer: 'Centre (Coinbase & Circle)',
            audits: 12,
            features: ['Native SPL Token', 'Regulated', 'High Liquidity', 'DeFi Integration'],
            description: 'Native Solana version of USDC with full USD backing and regulatory compliance.'
          },
          {
            id: '2',
            name: 'Tether (Solana)',
            symbol: 'USDT',
            type: 'Fiat-Collateralized',
            currentPrice: 0.9998,
            pegDeviation: -0.02,
            marketCap: '1.8B',
            volume24h: '320M',
            circulatingSupply: '1.8B',
            collateralRatio: 100,
            transparencyScore: 78,
            riskLevel: 'Medium',
            pegStability: 'Good',
            backing: ['USD', 'Commercial Paper', 'Corporate Bonds', 'Treasury Bills'],
            issuer: 'Tether Limited',
            audits: 4,
            features: ['SPL Token', 'High Liquidity', 'Wide Adoption', 'Cross-chain Bridge'],
            description: 'Solana version of the most widely used stablecoin with diversified backing.'
          },
          {
            id: '3',
            name: 'USDH',
            symbol: 'USDH',
            type: 'Crypto-Collateralized',
            currentPrice: 1.0012,
            pegDeviation: 0.12,
            marketCap: '180M',
            volume24h: '25M',
            circulatingSupply: '180M',
            collateralRatio: 110,
            transparencyScore: 88,
            riskLevel: 'Medium',
            pegStability: 'Good',
            backing: ['SOL', 'ETH', 'BTC', 'USDC', 'SRM'],
            issuer: 'Hubble Protocol',
            audits: 6,
            features: ['Native Solana', 'Over-collateralized', 'Multi-asset Backing', 'Kamino Integration'],
            description: 'Native Solana stablecoin by Hubble Protocol backed by diverse crypto assets.'
          },
          {
            id: '4',
            name: 'UXD',
            symbol: 'UXD',
            type: 'Hybrid',
            currentPrice: 0.9989,
            pegDeviation: -0.11,
            marketCap: '95M',
            volume24h: '8.5M',
            circulatingSupply: '95M',
            collateralRatio: 100,
            transparencyScore: 82,
            riskLevel: 'Medium',
            pegStability: 'Good',
            backing: ['SOL Perpetuals', 'Delta-neutral Positions', 'Insurance Fund'],
            issuer: 'UXD Protocol',
            audits: 5,
            features: ['Delta-neutral', 'Perp-backed', 'Native Solana', 'Algorithmic Rebalancing'],
            description: 'Innovative Solana stablecoin backed by delta-neutral perpetual positions.'
          },
          {
            id: '5',
            name: 'Cashio Dollar (Deprecated)',
            symbol: 'CASH',
            type: 'Fiat-Collateralized',
            currentPrice: 0.0001,
            pegDeviation: -99.99,
            marketCap: '1M',
            volume24h: '0.1M',
            circulatingSupply: '1B',
            collateralRatio: 0,
            transparencyScore: 15,
            riskLevel: 'High',
            pegStability: 'Poor',
            backing: ['Exploited/Deprecated'],
            issuer: 'Cashio Protocol',
            audits: 1,
            features: ['Failed Project', 'Exploit History', 'Deprecated', 'Historical Interest'],
            description: 'Deprecated Solana stablecoin that suffered from infinite mint exploit in 2022.'
          },
          {
            id: '6',
            name: 'PAI',
            symbol: 'PAI',
            type: 'Crypto-Collateralized',
            currentPrice: 1.0045,
            pegDeviation: 0.45,
            marketCap: '42M',
            volume24h: '3.2M',
            circulatingSupply: '42M',
            collateralRatio: 150,
            transparencyScore: 75,
            riskLevel: 'Medium',
            pegStability: 'Fair',
            backing: ['SOL', 'SRM', 'RAY', 'USDC'],
            issuer: 'Parrot Protocol',
            audits: 3,
            features: ['Native Solana', 'Multi-collateral', 'Governance Token', 'Yield Farming'],
            description: 'Solana-native stablecoin by Parrot Protocol with multiple crypto collateral types.'
          },
          {
            id: '7',
            name: 'NIRV',
            symbol: 'NIRV',
            type: 'Algorithmic',
            currentPrice: 0.9876,
            pegDeviation: -1.24,
            marketCap: '28M',
            volume24h: '1.8M',
            circulatingSupply: '28M',
            collateralRatio: 0,
            transparencyScore: 70,
            riskLevel: 'High',
            pegStability: 'Fair',
            backing: ['Algorithmic Mechanism', 'ANA Token', 'Protocol Revenue'],
            issuer: 'Nirvana Protocol',
            audits: 2,
            features: ['Algorithmic', 'Meta-stable', 'Native Solana', 'Deflationary Mechanics'],
            description: 'Algorithmic meta-stable token on Solana with unique deflationary mechanisms.'
          },
          {
            id: '8',
            name: 'USH',
            symbol: 'USH',
            type: 'Crypto-Collateralized',
            currentPrice: 1.0008,
            pegDeviation: 0.08,
            marketCap: '15M',
            volume24h: '1.2M',
            circulatingSupply: '15M',
            collateralRatio: 120,
            transparencyScore: 85,
            riskLevel: 'Medium',
            pegStability: 'Good',
            backing: ['SOL', 'mSOL', 'stSOL', 'USDC'],
            issuer: 'Hedge Protocol',
            audits: 4,
            features: ['Native Solana', 'Liquid Staking Backed', 'Yield-bearing', 'Auto-rebalancing'],
            description: 'Solana stablecoin backed by liquid staking tokens and yield-bearing assets.'
          },
          {
            id: '9',
            name: 'RATIO',
            symbol: 'RATIO',
            type: 'Hybrid',
            currentPrice: 0.9995,
            pegDeviation: -0.05,
            marketCap: '12M',
            volume24h: '0.8M',
            circulatingSupply: '12M',
            collateralRatio: 110,
            transparencyScore: 78,
            riskLevel: 'Medium',
            pegStability: 'Good',
            backing: ['USDC', 'SOL', 'Yield Strategies', 'Protocol Fees'],
            issuer: 'Ratio Finance',
            audits: 3,
            features: ['Yield-optimized', 'Auto-compounding', 'Native Solana', 'Strategy Vaults'],
            description: 'Yield-optimized stablecoin on Solana with automated strategy execution.'
          }
        ];

        setStablecoins(mockData);
      } catch (error) {
        console.error('Error fetching stablecoin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStablecoinData();
  }, []);

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
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'Excellent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Fair': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Poor': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPegDeviationColor = (deviation: number) => {
    const abs = Math.abs(deviation);
    if (abs <= 0.1) return 'text-green-600';
    if (abs <= 0.5) return 'text-yellow-600';
    if (abs <= 2.0) return 'text-orange-600';
    return 'text-red-600';
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
            value={filterStability}
            onChange={(e) => setFilterStability(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
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
                  <Target className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Current Price</div>
                    <div className="font-semibold">${coin.currentPrice.toFixed(4)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {coin.pegDeviation >= 0 ? 
                    <TrendingUp className="h-4 w-4 text-green-600" /> : 
                    <TrendingDown className="h-4 w-4 text-red-600" />
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