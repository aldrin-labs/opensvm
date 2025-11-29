'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, TrendingUp, TrendingDown, Bot, Brain, Zap, BarChart3, Search, Star, Users, DollarSign, RefreshCw } from 'lucide-react';

interface DeFAITool {
  name: string;
  category: string;
  description: string;
  website: string;
  tvl: number;
  users: number;
  aiFeatures: string[];
  pricing: string;
  accuracy: number;
  trades24h: number;
  revenue24h: number;
  change24h: number;
  rating: number;
  logo?: string;
  status: 'active' | 'beta' | 'coming-soon';
  supportedChains: string[];
  apiAvailable: boolean;
  freeTier: boolean;
}

export default function DeFAISection() {
  const [tools, setTools] = useState<DeFAITool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'tvl' | 'users' | 'accuracy' | 'rating'>('tvl');

  const fetchDeFAIData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/defai');
      const data = await response.json();

      if (data.success && data.data) {
        setTools(data.data.tools || []);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching DeFAI data:', err);
      setError('Failed to load DeFAI tools data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeFAIData();
    const interval = setInterval(() => fetchDeFAIData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchDeFAIData]);

  const categories = ['all', 'AI Computing', 'Price Prediction', 'Trading Bot', 'Lending Optimization', 'DEX Aggregation', 'Market Making', 'AMM Optimization', 'NFT Analytics', 'Portfolio Management', 'Decentralized AI'];

  const filteredTools = tools
    .filter(tool =>
      (categoryFilter === 'all' || tool.category === categoryFilter) &&
      (tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.aiFeatures.some(feature => feature.toLowerCase().includes(searchTerm.toLowerCase())))
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
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}>
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
            <Brain className="h-5 w-5" />
            AI-Powered DeFi Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search AI tools and features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <div>
                <label className="sr-only" htmlFor="category-filter">Filter by category</label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  aria-label="Filter by category"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant={sortBy === 'tvl' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('tvl')}
                aria-label="Sort by Total Value Locked"
                aria-pressed={sortBy === 'tvl'}
              >
                TVL
              </Button>
              <Button
                variant={sortBy === 'users' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('users')}
                aria-label="Sort by number of users"
                aria-pressed={sortBy === 'users'}
              >
                Users
              </Button>
              <Button
                variant={sortBy === 'accuracy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('accuracy')}
                aria-label="Sort by accuracy percentage"
                aria-pressed={sortBy === 'accuracy'}
              >
                Accuracy
              </Button>
              <Button
                variant={sortBy === 'rating' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('rating')}
                aria-label="Sort by user rating"
                aria-pressed={sortBy === 'rating'}
              >
                Rating
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchDeFAIData(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
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
              <Bot className="h-5 w-5 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tools</p>
                <p className="text-2xl font-bold">{tools.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Total TVL</p>
                <p className="text-2xl font-bold">${formatNumber(tools.reduce((sum, tool) => sum + tool.tvl, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{formatNumber(tools.reduce((sum, tool) => sum + tool.users, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                <p className="text-2xl font-bold">{(tools.reduce((sum, tool) => sum + tool.accuracy, 0) / tools.length).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DeFAI Tool Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTools.map((tool) => (
          <Card key={tool.name} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    <Brain className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <Badge variant={tool.status === 'active' ? 'default' : tool.status === 'beta' ? 'secondary' : 'outline'}>
                        {tool.status}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {tool.category}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{tool.rating}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open(tool.website, '_blank');
                      }
                    }}
                    aria-label={`Visit ${tool.name} website`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {tool.description}
              </p>

              {/* AI Features */}
              <div>
                <p className="text-sm font-medium mb-2">AI Features:</p>
                <div className="flex flex-wrap gap-1">
                  {tool.aiFeatures.slice(0, 4).map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {tool.aiFeatures.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{tool.aiFeatures.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    TVL
                  </div>
                  <p className="font-bold text-lg">${formatNumber(tool.tvl)}</p>
                  <div className={`flex items-center gap-1 text-xs ${tool.change24h >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                    {tool.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(tool.change24h).toFixed(1)}%
                  </div>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Zap className="h-3 w-3" />
                    Accuracy
                  </div>
                  <p className="font-bold text-lg text-success">{tool.accuracy.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(tool.trades24h)} trades
                  </p>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    Users
                  </div>
                  <p className="font-bold text-lg">{formatNumber(tool.users)}</p>
                  <p className="text-xs text-muted-foreground">
                    24h revenue: ${formatNumber(tool.revenue24h)}
                  </p>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <BarChart3 className="h-3 w-3" />
                    Pricing
                  </div>
                  <p className="font-bold text-sm">{tool.pricing}</p>
                  <div className="flex gap-1 mt-1">
                    {tool.freeTier && <Badge variant="outline" className="text-xs">Free Tier</Badge>}
                    {tool.apiAvailable && <Badge variant="outline" className="text-xs">API</Badge>}
                  </div>
                </div>
              </div>

              {/* Supported Chains */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-muted-foreground">Supported Chains:</span>
                  <div className="flex gap-1">
                    {tool.supportedChains.map(chain => (
                      <Badge key={chain} variant="outline" className="text-xs">
                        {chain}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1" disabled={tool.status === 'coming-soon'}>
                  {tool.status === 'coming-soon' ? 'Coming Soon' : 'Try Now'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-20">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No AI-powered DeFi tools found matching your search.</p>
        </div>
      )}
    </div>
  );
}
