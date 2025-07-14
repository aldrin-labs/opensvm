'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, BarChart3, DollarSign, Volume2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TokenData {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  program: string;
  verified: boolean;
  trending: boolean;
}

export default function CoinsScreenerSection() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'marketCap' | 'priceChange' | 'liquidity'>('volume');
  const [filterVerified, setFilterVerified] = useState(false);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        
        // Simulate API call with fallback data
        const mockTokens: TokenData[] = [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            price: 98.45,
            priceChange24h: 5.67,
            volume24h: 892000000,
            marketCap: 45200000000,
            liquidity: 125000000,
            holders: 1250000,
            program: 'Native SOL',
            verified: true,
            trending: true
          },
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            price: 1.0002,
            priceChange24h: 0.02,
            volume24h: 456000000,
            marketCap: 24800000000,
            liquidity: 89000000,
            holders: 890000,
            program: 'SPL Token',
            verified: true,
            trending: false
          },
          {
            mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            symbol: 'USDT',
            name: 'Tether USD',
            price: 0.9998,
            priceChange24h: -0.01,
            volume24h: 234000000,
            marketCap: 18900000000,
            liquidity: 67000000,
            holders: 560000,
            program: 'SPL Token',
            verified: true,
            trending: false
          },
          {
            mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
            symbol: 'WIF',
            name: 'dogwifhat',
            price: 2.34,
            priceChange24h: 12.45,
            volume24h: 78000000,
            marketCap: 2340000000,
            liquidity: 45000000,
            holders: 145000,
            program: 'SPL Token',
            verified: true,
            trending: true
          },
          {
            mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            symbol: 'BONK',
            name: 'Bonk',
            price: 0.000034,
            priceChange24h: -8.23,
            volume24h: 89000000,
            marketCap: 2100000000,
            liquidity: 34000000,
            holders: 890000,
            program: 'SPL Token',
            verified: true,
            trending: true
          },
          {
            mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
            symbol: 'ORCA',
            name: 'Orca',
            price: 3.67,
            priceChange24h: 7.89,
            volume24h: 23000000,
            marketCap: 890000000,
            liquidity: 28000000,
            holders: 67000,
            program: 'SPL Token',
            verified: true,
            trending: false
          },
          {
            mint: '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
            symbol: 'UXD',
            name: 'UXD Stablecoin',
            price: 0.9987,
            priceChange24h: -0.13,
            volume24h: 5600000,
            marketCap: 123000000,
            liquidity: 12000000,
            holders: 34000,
            program: 'SPL Token',
            verified: true,
            trending: false
          },
          {
            mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
            symbol: 'MNGO',
            name: 'Mango',
            price: 0.045,
            priceChange24h: -2.34,
            volume24h: 8900000,
            marketCap: 67000000,
            liquidity: 9800000,
            holders: 23000,
            program: 'SPL Token',
            verified: true,
            trending: false
          }
        ];

        setTokens(mockTokens);
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, []);

  const filteredAndSortedTokens = tokens
    .filter(token => {
      const matchesSearch = token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           token.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVerified = !filterVerified || token.verified;
      return matchesSearch && matchesVerified;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'priceChange':
          return b.priceChange24h - a.priceChange24h;
        case 'liquidity':
          return b.liquidity - a.liquidity;
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
        <BarChart3 className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana Token Screener</h2>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
              <p className="text-2xl font-bold">{tokens.length}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Volume 24h</p>
              <p className="text-2xl font-bold">{formatCurrency(tokens.reduce((sum, token) => sum + token.volume24h, 0))}</p>
            </div>
            <Volume2 className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Market Cap</p>
              <p className="text-2xl font-bold">{formatCurrency(tokens.reduce((sum, token) => sum + token.marketCap, 0))}</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Trending</p>
              <p className="text-2xl font-bold">{tokens.filter(t => t.trending).length}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
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
              placeholder="Search tokens by symbol or name..."
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
            <option value="liquidity">Sort by Liquidity</option>
          </select>

          <Button
            variant={filterVerified ? "default" : "outline"}
            onClick={() => setFilterVerified(!filterVerified)}
            className="whitespace-nowrap"
          >
            Verified Only
          </Button>
        </div>
      </Card>

      {/* Token Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Token</th>
                <th className="text-right p-4 font-medium">Price</th>
                <th className="text-right p-4 font-medium">24h Change</th>
                <th className="text-right p-4 font-medium">Volume 24h</th>
                <th className="text-right p-4 font-medium">Market Cap</th>
                <th className="text-right p-4 font-medium">Liquidity</th>
                <th className="text-right p-4 font-medium">Holders</th>
                <th className="text-center p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTokens.map((token) => (
                <tr key={token.mint} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <span className="text-xs font-bold">{token.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{token.symbol}</span>
                          {token.verified && (
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded">✓</span>
                          )}
                          {token.trending && (
                            <TrendingUp className="h-3 w-3 text-orange-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{token.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(token.price)}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`flex items-center justify-end gap-1 ${
                      token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {token.priceChange24h >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(token.volume24h)}
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(token.marketCap)}
                  </td>
                  <td className="p-4 text-right font-mono">
                    {formatCurrency(token.liquidity)}
                  </td>
                  <td className="p-4 text-right">
                    {formatNumber(token.holders)}
                  </td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {token.program}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filteredAndSortedTokens.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No tokens found matching your criteria</p>
        </Card>
      )}
    </div>
  );
}