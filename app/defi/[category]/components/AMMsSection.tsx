'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, TrendingUp, DollarSign, Users, Droplets, ExternalLink, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PoolData {
  id: string;
  tokenA: {
    symbol: string;
    mint: string;
    logoUrl?: string;
  };
  tokenB: {
    symbol: string;
    mint: string;
    logoUrl?: string;
  };
  platform: string;
  liquidity: number;
  volume24h: number;
  fees24h: number;
  apr: number;
  fee: number; // in percentage
  lpTokenSupply: number;
  priceImpact: number;
  reserves: {
    tokenA: number;
    tokenB: number;
  };
}

interface AMMPlatform {
  name: string;
  totalLiquidity: number;
  totalVolume24h: number;
  totalPools: number;
  totalFees24h: number;
  description: string;
  website: string;
  logo?: string;
}

export default function AMMsSection() {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [platforms, setPlatforms] = useState<AMMPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'liquidity' | 'volume' | 'apr' | 'fees'>('liquidity');
  const [minLiquidity, setMinLiquidity] = useState<number>(0);

  useEffect(() => {
    const fetchAMMData = async () => {
      try {
        setLoading(true);
        
        // Mock AMM platforms data - Solana-native AMMs
        const mockPlatforms: AMMPlatform[] = [
          {
            name: 'Raydium',
            totalLiquidity: 1200000000,
            totalVolume24h: 450000000,
            totalPools: 1850,
            totalFees24h: 1350000,
            description: 'Leading AMM and liquidity provider on Solana',
            website: 'https://raydium.io'
          },
          {
            name: 'Orca',
            totalLiquidity: 890000000,
            totalVolume24h: 320000000,
            totalPools: 1240,
            totalFees24h: 960000,
            description: 'User-friendly AMM with concentrated liquidity',
            website: 'https://orca.so'
          },
          {
            name: 'Meteora',
            totalLiquidity: 456000000,
            totalVolume24h: 180000000,
            totalPools: 680,
            totalFees24h: 540000,
            description: 'Multi-pool AMM with dynamic fee structures',
            website: 'https://meteora.ag'
          },
          {
            name: 'Lifinity',
            totalLiquidity: 234000000,
            totalVolume24h: 89000000,
            totalPools: 340,
            totalFees24h: 267000,
            description: 'Proactive market maker with delta-neutral liquidity',
            website: 'https://lifinity.io'
          },
          {
            name: 'Aldrin',
            totalLiquidity: 167000000,
            totalVolume24h: 67000000,
            totalPools: 280,
            totalFees24h: 201000,
            description: 'Advanced AMM with limit orders and analytics',
            website: 'https://aldrin.com'
          }
        ];

        // Mock pool data - Solana token pairs
        const mockPools: PoolData[] = [
          {
            id: '1',
            tokenA: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
            tokenB: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            platform: 'Raydium',
            liquidity: 245000000,
            volume24h: 89000000,
            fees24h: 267000,
            apr: 24.5,
            fee: 0.25,
            lpTokenSupply: 125000000,
            priceImpact: 0.02,
            reserves: { tokenA: 2500000, tokenB: 245000000 }
          },
          {
            id: '2',
            tokenA: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
            tokenB: { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
            platform: 'Raydium',
            liquidity: 134000000,
            volume24h: 45000000,
            fees24h: 135000,
            apr: 18.7,
            fee: 0.30,
            lpTokenSupply: 67000000,
            priceImpact: 0.05,
            reserves: { tokenA: 1400000, tokenB: 890000000 }
          },
          {
            id: '3',
            tokenA: { symbol: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
            tokenB: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            platform: 'Orca',
            liquidity: 89000000,
            volume24h: 23000000,
            fees24h: 69000,
            apr: 15.2,
            fee: 0.30,
            lpTokenSupply: 45000000,
            priceImpact: 0.08,
            reserves: { tokenA: 25000000, tokenB: 89000000 }
          },
          {
            id: '4',
            tokenA: { symbol: 'WIF', mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs' },
            tokenB: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
            platform: 'Orca',
            liquidity: 67000000,
            volume24h: 34000000,
            fees24h: 102000,
            apr: 45.6,
            fee: 0.30,
            lpTokenSupply: 34000000,
            priceImpact: 0.12,
            reserves: { tokenA: 28000000, tokenB: 680000 }
          },
          {
            id: '5',
            tokenA: { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
            tokenB: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
            platform: 'Meteora',
            liquidity: 45000000,
            volume24h: 28000000,
            fees24h: 84000,
            apr: 67.8,
            fee: 0.30,
            lpTokenSupply: 23000000,
            priceImpact: 0.18,
            reserves: { tokenA: 1200000000000, tokenB: 450000 }
          },
          {
            id: '6',
            tokenA: { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
            tokenB: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            platform: 'Lifinity',
            liquidity: 123000000,
            volume24h: 67000000,
            fees24h: 67000,
            apr: 5.4,
            fee: 0.10,
            lpTokenSupply: 123000000,
            priceImpact: 0.01,
            reserves: { tokenA: 61500000, tokenB: 61500000 }
          },
          {
            id: '7',
            tokenA: { symbol: 'MNGO', mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac' },
            tokenB: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            platform: 'Aldrin',
            liquidity: 23000000,
            volume24h: 8900000,
            fees24h: 26700,
            apr: 42.3,
            fee: 0.30,
            lpTokenSupply: 12000000,
            priceImpact: 0.25,
            reserves: { tokenA: 510000000, tokenB: 23000000 }
          },
          {
            id: '8',
            tokenA: { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
            tokenB: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
            platform: 'Raydium',
            liquidity: 78000000,
            volume24h: 34000000,
            fees24h: 102000,
            apr: 38.9,
            fee: 0.30,
            lpTokenSupply: 39000000,
            priceImpact: 0.09,
            reserves: { tokenA: 89000000, tokenB: 790000 }
          }
        ];

        setPlatforms(mockPlatforms);
        setPools(mockPools);
      } catch (error) {
        console.error('Failed to fetch AMM data:', error);
        setPlatforms([]);
        setPools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAMMData();
  }, []);

  const filteredAndSortedPools = pools
    .filter(pool => {
      const matchesPlatform = platformFilter === 'all' || pool.platform === platformFilter;
      const matchesLiquidity = pool.liquidity >= minLiquidity;
      return matchesPlatform && matchesLiquidity;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'liquidity':
          return b.liquidity - a.liquidity;
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'apr':
          return b.apr - a.apr;
        case 'fees':
          return b.fees24h - a.fees24h;
        default:
          return 0;
      }
    });

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const getPlatformColor = (platform: string) => {
    const colors: { [key: string]: string } = {
      'Raydium': 'bg-blue-100 text-blue-800',
      'Orca': 'bg-purple-100 text-purple-800',
      'Meteora': 'bg-orange-100 text-orange-800',
      'Lifinity': 'bg-green-100 text-green-800',
      'Aldrin': 'bg-red-100 text-red-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
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
        <ArrowUpDown className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana AMMs (Automated Market Makers)</h2>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {platforms.map((platform) => (
          <Card key={platform.name} className="p-4 hover:shadow-lg transition-shadow">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{platform.name}</h3>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">{platform.description}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>TVL:</span>
                  <span className="font-medium">{formatCurrency(platform.totalLiquidity)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>24h Volume:</span>
                  <span className="font-medium">{formatCurrency(platform.totalVolume24h)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>24h Fees:</span>
                  <span className="font-medium text-green-600">{formatCurrency(platform.totalFees24h)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Pools:</span>
                  <span className="font-medium">{platform.totalPools}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Liquidity</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.totalLiquidity, 0))}</p>
            </div>
            <Droplets className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">24h Volume</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.totalVolume24h, 0))}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">24h Fees</p>
              <p className="text-2xl font-bold">{formatCurrency(platforms.reduce((sum, p) => sum + p.totalFees24h, 0))}</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Pools</p>
              <p className="text-2xl font-bold">{platforms.reduce((sum, p) => sum + p.totalPools, 0)}</p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform.name} value={platform.name}>
                {platform.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="liquidity">Sort by Liquidity</option>
            <option value="volume">Sort by Volume</option>
            <option value="apr">Sort by APR</option>
            <option value="fees">Sort by Fees</option>
          </select>

          <div className="flex items-center gap-2">
            <label className="text-sm">Min Liquidity:</label>
            <select
              value={minLiquidity}
              onChange={(e) => setMinLiquidity(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value={0}>All</option>
              <option value={1000000}>$1M+</option>
              <option value={10000000}>$10M+</option>
              <option value={50000000}>$50M+</option>
              <option value={100000000}>$100M+</option>
            </select>
          </div>

          <Button variant="outline" className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Pools Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Pool</th>
                <th className="text-center p-4 font-medium">Platform</th>
                <th className="text-right p-4 font-medium">Liquidity</th>
                <th className="text-right p-4 font-medium">24h Volume</th>
                <th className="text-right p-4 font-medium">24h Fees</th>
                <th className="text-right p-4 font-medium">APR</th>
                <th className="text-right p-4 font-medium">Fee %</th>
                <th className="text-center p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPools.map((pool) => (
                <tr key={pool.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center border-2 border-white">
                          <span className="text-xs font-bold text-white">{pool.tokenA.symbol.slice(0, 2)}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center border-2 border-white">
                          <span className="text-xs font-bold text-white">{pool.tokenB.symbol.slice(0, 2)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium">{pool.tokenA.symbol}/{pool.tokenB.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(pool.reserves.tokenA)} {pool.tokenA.symbol} / {formatNumber(pool.reserves.tokenB)} {pool.tokenB.symbol}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${getPlatformColor(pool.platform)}`}>
                      {pool.platform}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(pool.liquidity)}
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(pool.volume24h)}
                  </td>
                  <td className="p-4 text-right font-mono text-green-600">
                    {formatCurrency(pool.fees24h)}
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium text-blue-600">{pool.apr.toFixed(1)}%</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm">{pool.fee}%</span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="outline">
                        Add Liquidity
                      </Button>
                      <Button size="sm">
                        Swap
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filteredAndSortedPools.length === 0 && (
        <Card className="p-8 text-center">
          <ArrowUpDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No pools found matching your criteria</p>
        </Card>
      )}
    </div>
  );
}