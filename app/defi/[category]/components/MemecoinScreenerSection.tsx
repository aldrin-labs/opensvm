'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Zap, Crown, Flame, Clock, Users, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MemecoinData {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  age: number; // days since launch
  liquidity: number;
  isNewListing: boolean;
  isTrending: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  socialScore: number;
  twitterFollowers?: number;
  telegramMembers?: number;
}

export default function MemecoinScreenerSection() {
  const [memecoins, setMemecoins] = useState<MemecoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'marketCap' | 'priceChange' | 'age' | 'socialScore'>('volume');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [showNewListings, setShowNewListings] = useState(false);

  useEffect(() => {
    const fetchMemecoins = async () => {
      try {
        setLoading(true);
        
        // Simulate API call with Solana memecoin fallback data
        const mockMemecoins: MemecoinData[] = [
          {
            mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
            symbol: 'WIF',
            name: 'dogwifhat',
            price: 2.34,
            priceChange24h: 12.45,
            priceChange7d: 23.67,
            volume24h: 78000000,
            marketCap: 2340000000,
            holders: 145000,
            age: 89,
            liquidity: 45000000,
            isNewListing: false,
            isTrending: true,
            riskLevel: 'medium',
            socialScore: 85,
            twitterFollowers: 890000,
            telegramMembers: 125000
          },
          {
            mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            symbol: 'BONK',
            name: 'Bonk',
            price: 0.000034,
            priceChange24h: -8.23,
            priceChange7d: 15.45,
            volume24h: 89000000,
            marketCap: 2100000000,
            holders: 890000,
            age: 456,
            liquidity: 34000000,
            isNewListing: false,
            isTrending: true,
            riskLevel: 'low',
            socialScore: 92,
            twitterFollowers: 1200000,
            telegramMembers: 89000
          },
          {
            mint: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
            symbol: 'MYRO',
            name: 'Myro',
            price: 0.156,
            priceChange24h: 18.67,
            priceChange7d: -12.34,
            volume24h: 23000000,
            marketCap: 156000000,
            holders: 67000,
            age: 234,
            liquidity: 12000000,
            isNewListing: false,
            isTrending: true,
            riskLevel: 'medium',
            socialScore: 78,
            twitterFollowers: 145000,
            telegramMembers: 23000
          },
          {
            mint: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump',
            symbol: 'POPCAT',
            name: 'Popcat',
            price: 0.89,
            priceChange24h: 34.56,
            priceChange7d: 67.89,
            volume24h: 45000000,
            marketCap: 890000000,
            holders: 234000,
            age: 123,
            liquidity: 23000000,
            isNewListing: false,
            isTrending: true,
            riskLevel: 'high',
            socialScore: 88,
            twitterFollowers: 567000,
            telegramMembers: 78000
          },
          {
            mint: '5z3EqYQo9HiCdY3g7JKmG2wT7uKGqZqV2y6eHp8pZL6N',
            symbol: 'SLOTH',
            name: 'Sloth',
            price: 0.0067,
            priceChange24h: -23.45,
            priceChange7d: 8.9,
            volume24h: 5600000,
            marketCap: 67000000,
            holders: 45000,
            age: 67,
            liquidity: 8900000,
            isNewListing: false,
            isTrending: false,
            riskLevel: 'high',
            socialScore: 65,
            twitterFollowers: 67000,
            telegramMembers: 12000
          },
          {
            mint: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
            symbol: 'PEPE',
            name: 'Pepe on Solana',
            price: 0.000012,
            priceChange24h: 145.67,
            priceChange7d: 234.56,
            volume24h: 12000000,
            marketCap: 45000000,
            holders: 23000,
            age: 12,
            liquidity: 3400000,
            isNewListing: true,
            isTrending: true,
            riskLevel: 'extreme',
            socialScore: 45,
            twitterFollowers: 12000,
            telegramMembers: 5600
          },
          {
            mint: 'BKipkearSqAUdNKa1WDstvcMjoPsSKBuNyvKDQDDu9WE',
            symbol: 'BOME',
            name: 'Book of Meme',
            price: 0.0234,
            priceChange24h: 5.67,
            priceChange7d: -34.56,
            volume24h: 34000000,
            marketCap: 234000000,
            holders: 89000,
            age: 145,
            liquidity: 15000000,
            isNewListing: false,
            isTrending: false,
            riskLevel: 'medium',
            socialScore: 72,
            twitterFollowers: 234000,
            telegramMembers: 34000
          },
          {
            mint: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump',
            symbol: 'MOODENG',
            name: 'Moo Deng',
            price: 0.456,
            priceChange24h: 67.89,
            priceChange7d: 123.45,
            volume24h: 8900000,
            marketCap: 456000000,
            holders: 67000,
            age: 34,
            liquidity: 12000000,
            isNewListing: true,
            isTrending: true,
            riskLevel: 'extreme',
            socialScore: 78,
            twitterFollowers: 89000,
            telegramMembers: 23000
          }
        ];

        setMemecoins(mockMemecoins);
      } catch (error) {
        console.error('Failed to fetch memecoins:', error);
        setMemecoins([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMemecoins();
  }, []);

  const filteredAndSortedMemecoins = memecoins
    .filter(coin => {
      const matchesSearch = coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           coin.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk = riskFilter === 'all' || coin.riskLevel === riskFilter;
      const matchesNewListing = !showNewListings || coin.isNewListing;
      return matchesSearch && matchesRisk && matchesNewListing;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'priceChange':
          return b.priceChange24h - a.priceChange24h;
        case 'age':
          return a.age - b.age; // Newer first
        case 'socialScore':
          return b.socialScore - a.socialScore;
        default:
          return 0;
      }
    });

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(value < 1 ? 6 : 2)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'extreme': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
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
        <Zap className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana Memecoin Screener</h2>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Memecoins</p>
              <p className="text-2xl font-bold">{memecoins.length}</p>
            </div>
            <Zap className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Trending</p>
              <p className="text-2xl font-bold">{memecoins.filter(c => c.isTrending).length}</p>
            </div>
            <Flame className="h-8 w-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">New Listings</p>
              <p className="text-2xl font-bold">{memecoins.filter(c => c.isNewListing).length}</p>
            </div>
            <Crown className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Volume 24h</p>
              <p className="text-2xl font-bold">{formatCurrency(memecoins.reduce((sum, coin) => sum + coin.volume24h, 0))}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search memecoins by symbol or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="volume">Sort by Volume</option>
            <option value="marketCap">Sort by Market Cap</option>
            <option value="priceChange">Sort by Price Change</option>
            <option value="age">Sort by Age (Newest)</option>
            <option value="socialScore">Sort by Social Score</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="extreme">Extreme Risk</option>
          </select>

          <Button
            variant={showNewListings ? "default" : "outline"}
            onClick={() => setShowNewListings(!showNewListings)}
            className="whitespace-nowrap"
          >
            New Only
          </Button>
        </div>
      </Card>

      {/* Memecoin Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Token</th>
                <th className="text-right p-4 font-medium">Price</th>
                <th className="text-right p-4 font-medium">24h / 7d</th>
                <th className="text-right p-4 font-medium">Volume 24h</th>
                <th className="text-right p-4 font-medium">Market Cap</th>
                <th className="text-right p-4 font-medium">Holders</th>
                <th className="text-center p-4 font-medium">Age</th>
                <th className="text-center p-4 font-medium">Social</th>
                <th className="text-center p-4 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMemecoins.map((coin) => (
                <tr key={coin.mint} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{coin.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{coin.symbol}</span>
                          {coin.isTrending && <Flame className="h-3 w-3 text-orange-500" />}
                          {coin.isNewListing && <Crown className="h-3 w-3 text-yellow-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{coin.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(coin.price)}
                  </td>
                  <td className="p-4 text-right">
                    <div className="space-y-1">
                      <span className={`flex items-center justify-end gap-1 text-sm ${
                        coin.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {coin.priceChange24h >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {coin.priceChange24h >= 0 ? '+' : ''}{coin.priceChange24h.toFixed(1)}%
                      </span>
                      <span className={`text-xs ${
                        coin.priceChange7d >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {coin.priceChange7d >= 0 ? '+' : ''}{coin.priceChange7d.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(coin.volume24h)}
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(coin.marketCap)}
                  </td>
                  <td className="p-4 text-right">
                    {formatNumber(coin.holders)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{coin.age}d</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{coin.socialScore}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-xs rounded uppercase font-medium ${getRiskColor(coin.riskLevel)}`}>
                      {coin.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filteredAndSortedMemecoins.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No memecoins found matching your criteria</p>
        </Card>
      )}

      {/* Risk Warning */}
      <Card className="p-4 border-yellow-200 bg-yellow-50">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <div>
            <h4 className="font-medium text-yellow-800 mb-1">High Risk Warning</h4>
            <p className="text-sm text-yellow-700">
              Memecoins are extremely volatile and speculative investments. Many are pump-and-dump schemes or rug pulls. 
              Only invest what you can afford to lose and always do your own research.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}