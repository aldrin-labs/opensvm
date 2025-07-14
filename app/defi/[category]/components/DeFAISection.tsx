'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, TrendingUp, TrendingDown, Bot, Brain, Zap, BarChart3, Search, Star, Users, DollarSign } from 'lucide-react';

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

  useEffect(() => {
    async function fetchDeFAIData() {
      try {
        // Simulate API call - in real implementation this would fetch from analytics API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const defaiTools: DeFAITool[] = [
          {
            name: 'Nosana AI',
            category: 'AI Computing',
            description: 'Decentralized AI inference network powered by Solana for DeFi applications',
            website: 'https://nosana.io',
            tvl: 45000000,
            users: 2800,
            aiFeatures: ['Model Inference', 'GPU Sharing', 'AI Training', 'Prediction Markets'],
            pricing: 'Pay-per-compute',
            accuracy: 94.5,
            trades24h: 1200,
            revenue24h: 28000,
            change24h: 8.4,
            rating: 4.6,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: true
          },
          {
            name: 'Pyth AI Oracle',
            category: 'Price Prediction',
            description: 'AI-enhanced price feeds with machine learning predictions for Solana DeFi protocols',
            website: 'https://pyth.network',
            tvl: 128000000,
            users: 8900,
            aiFeatures: ['Price Prediction', 'Volatility Analysis', 'Market Sentiment', 'Risk Assessment'],
            pricing: 'Subscription',
            accuracy: 91.2,
            trades24h: 45000,
            revenue24h: 89000,
            change24h: 5.2,
            rating: 4.8,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: false
          },
          {
            name: 'Drift AI',
            category: 'Trading Bot',
            description: 'AI-powered perpetual futures trading with automated strategies',
            website: 'https://drift.trade',
            tvl: 67000000,
            users: 3400,
            aiFeatures: ['Auto Trading', 'Strategy Optimization', 'Risk Management', 'Market Analysis'],
            pricing: 'Performance Fee',
            accuracy: 87.3,
            trades24h: 8900,
            revenue24h: 156000,
            change24h: 12.8,
            rating: 4.4,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: true
          },
          {
            name: 'Solend AI',
            category: 'Lending Optimization',
            description: 'AI-driven lending and borrowing optimization with dynamic interest rates',
            website: 'https://solend.fi',
            tvl: 89000000,
            users: 5600,
            aiFeatures: ['Interest Rate Optimization', 'Risk Scoring', 'Liquidation Prevention', 'Yield Farming'],
            pricing: 'Protocol Fees',
            accuracy: 92.8,
            trades24h: 2300,
            revenue24h: 67000,
            change24h: -3.2,
            rating: 4.5,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: false
          },
          {
            name: 'Jupiter AI Router',
            category: 'DEX Aggregation',
            description: 'AI-powered trade routing for optimal swap execution across Solana DEXes',
            website: 'https://jup.ag',
            tvl: 234000000,
            users: 15600,
            aiFeatures: ['Route Optimization', 'Slippage Prediction', 'MEV Protection', 'Price Impact Analysis'],
            pricing: 'Free',
            accuracy: 96.7,
            trades24h: 67000,
            revenue24h: 234000,
            change24h: 18.9,
            rating: 4.9,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: true
          },
          {
            name: 'Mango AI Markets',
            category: 'Market Making',
            description: 'AI-powered market making and liquidity optimization for trading pairs',
            website: 'https://mango.markets',
            tvl: 56000000,
            users: 2100,
            aiFeatures: ['Liquidity Optimization', 'Spread Management', 'Volume Prediction', 'Arbitrage Detection'],
            pricing: 'Trading Fees',
            accuracy: 89.1,
            trades24h: 12000,
            revenue24h: 123000,
            change24h: 7.6,
            rating: 4.3,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: false
          },
          {
            name: 'Meteora Dynamic',
            category: 'AMM Optimization',
            description: 'AI-driven automated market maker with dynamic parameter adjustment',
            website: 'https://meteora.ag',
            tvl: 78000000,
            users: 4200,
            aiFeatures: ['Parameter Optimization', 'Fee Adjustment', 'Liquidity Prediction', 'Impermanent Loss Minimization'],
            pricing: 'Performance Fee',
            accuracy: 93.4,
            trades24h: 5600,
            revenue24h: 89000,
            change24h: 15.2,
            rating: 4.7,
            status: 'active',
            supportedChains: ['Solana'],
            apiAvailable: false,
            freeTier: false
          },
          {
            name: 'Tensor AI NFT',
            category: 'NFT Analytics',
            description: 'AI-powered NFT market analysis and trading recommendations',
            website: 'https://tensor.trade',
            tvl: 23000000,
            users: 1800,
            aiFeatures: ['Price Prediction', 'Rarity Analysis', 'Market Trends', 'Collection Scoring'],
            pricing: 'Subscription',
            accuracy: 85.6,
            trades24h: 890,
            revenue24h: 34000,
            change24h: -5.8,
            rating: 4.2,
            status: 'beta',
            supportedChains: ['Solana'],
            apiAvailable: true,
            freeTier: true
          },
          {
            name: 'Solana AI Agents',
            category: 'Portfolio Management',
            description: 'Autonomous AI agents for DeFi portfolio management and rebalancing',
            website: 'https://solana-agents.com',
            tvl: 34000000,
            users: 1200,
            aiFeatures: ['Portfolio Rebalancing', 'Risk Management', 'Yield Optimization', 'Tax Optimization'],
            pricing: 'Management Fee',
            accuracy: 88.9,
            trades24h: 1500,
            revenue24h: 45000,
            change24h: 9.3,
            rating: 4.1,
            status: 'beta',
            supportedChains: ['Solana'],
            apiAvailable: false,
            freeTier: false
          },
          {
            name: 'DeAI Protocol',
            category: 'Decentralized AI',
            description: 'Decentralized AI marketplace for Solana DeFi applications and smart contracts',
            website: 'https://deai.io',
            tvl: 12000000,
            users: 450,
            aiFeatures: ['Model Marketplace', 'Smart Contract AI', 'Governance AI', 'Security Analysis'],
            pricing: 'Token-based',
            accuracy: 81.2,
            trades24h: 120,
            revenue24h: 8900,
            change24h: 22.4,
            rating: 3.9,
            status: 'coming-soon',
            supportedChains: ['Solana'],
            apiAvailable: false,
            freeTier: true
          }
        ];

        setTools(defaiTools.sort((a, b) => b.tvl - a.tvl));
      } catch (err) {
        console.error('Error fetching DeFAI data:', err);
        setError('Failed to load DeFAI tools data');
      } finally {
        setLoading(false);
      }
    }

    fetchDeFAIData();
  }, []);

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
              <select
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
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
              <DollarSign className="h-5 w-5 text-green-500" />
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
              <Users className="h-5 w-5 text-purple-500" />
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
              <BarChart3 className="h-5 w-5 text-orange-500" />
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
                    onClick={() => window.open(tool.website, '_blank')}
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
                  <div className={`flex items-center gap-1 text-xs ${
                    tool.change24h >= 0 ? 'text-green-500' : 'text-red-500'
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
                  <p className="font-bold text-lg text-green-500">{tool.accuracy.toFixed(1)}%</p>
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
