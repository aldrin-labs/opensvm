'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Wrench, 
  Users,
  TrendingUp,
  Activity,
  Search,
  ArrowUpDown,
  Eye,
  Target
} from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  category: 'Portfolio Tracker' | 'Analytics' | 'Tax Tools' | 'Wallet' | 'Infrastructure' | 'Security' | 'Developer' | 'Governance';
  type: 'Free' | 'Freemium' | 'Paid' | 'Enterprise';
  users: string;
  rating: number;
  features: string[];
  supportedChains: string[];
  pricing: string;
  integrations: number;
  status: 'Active' | 'Beta' | 'Coming Soon';
  description: string;
}

export default function ToolsSection() {
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'users' | 'rating' | 'integrations'>('users');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All');

  useEffect(() => {
    const fetchToolData = async () => {
      setLoading(true);
      try {
        // Simulate API call with realistic DeFi tool data
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockData: Tool[] = [
          {
            id: '1',
            name: 'Step Finance',
            category: 'Portfolio Tracker',
            type: 'Free',
            users: '180K',
            rating: 4.6,
            features: ['Solana Portfolio', 'DeFi Tracking', 'NFT Portfolio', 'Transaction History', 'Yield Farming'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 150,
            status: 'Active',
            description: 'Comprehensive Solana DeFi portfolio tracker and analytics platform.'
          },
          {
            id: '2',
            name: 'Solscan',
            category: 'Analytics',
            type: 'Free',
            users: '450K',
            rating: 4.8,
            features: ['Block Explorer', 'Transaction Analysis', 'Token Tracking', 'DeFi Analytics', 'API Access'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 300,
            status: 'Active',
            description: 'Leading Solana blockchain explorer with comprehensive analytics and data insights.'
          },
          {
            id: '3',
            name: 'Phantom Wallet',
            category: 'Wallet',
            type: 'Free',
            users: '3M',
            rating: 4.7,
            features: ['Solana Wallet', 'DApp Browser', 'Token Swaps', 'NFT Support', 'Staking'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 2000,
            status: 'Active',
            description: 'Most popular Solana wallet for DeFi, NFTs, and dApp interactions.'
          },
          {
            id: '4',
            name: 'Solflare',
            category: 'Wallet',
            type: 'Free',
            users: '850K',
            rating: 4.5,
            features: ['Web & Mobile Wallet', 'Hardware Support', 'Staking', 'DeFi Integration', 'NFT Gallery'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 800,
            status: 'Active',
            description: 'Secure Solana wallet with hardware support and comprehensive DeFi features.'
          },
          {
            id: '5',
            name: 'CoinTracker (Solana)',
            category: 'Tax Tools',
            type: 'Freemium',
            users: '120K',
            rating: 4.3,
            features: ['Solana Tax Reports', 'DeFi Tracking', 'Cost Basis', 'Portfolio Analysis', 'CSV Export'],
            supportedChains: ['Solana'],
            pricing: 'Free + $199/year',
            integrations: 50,
            status: 'Active',
            description: 'Crypto tax software with specialized Solana DeFi transaction tracking.'
          },
          {
            id: '6',
            name: 'Anchor Framework',
            category: 'Developer',
            type: 'Free',
            users: '25K',
            rating: 4.9,
            features: ['Smart Contract Framework', 'Testing Suite', 'IDL Generation', 'Client Libraries', 'CLI Tools'],
            supportedChains: ['Solana'],
            pricing: 'Open Source',
            integrations: 1200,
            status: 'Active',
            description: 'The standard framework for developing Solana programs with Rust.'
          },
          {
            id: '7',
            name: 'Solana Beach',
            category: 'Analytics',
            type: 'Free',
            users: '95K',
            rating: 4.4,
            features: ['Validator Tracking', 'Network Analytics', 'Epoch Data', 'Performance Metrics', 'API'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 80,
            status: 'Active',
            description: 'Comprehensive Solana network analytics and validator performance tracking.'
          },
          {
            id: '8',
            name: 'Orca Whirlpool SDK',
            category: 'Developer',
            type: 'Free',
            users: '8K',
            rating: 4.6,
            features: ['Concentrated Liquidity', 'Position Management', 'TypeScript SDK', 'Price Calculations', 'Examples'],
            supportedChains: ['Solana'],
            pricing: 'Open Source',
            integrations: 400,
            status: 'Active',
            description: 'Developer SDK for building on Orca concentrated liquidity protocol.'
          },
          {
            id: '9',
            name: 'Squads',
            category: 'Wallet',
            type: 'Free',
            users: '15K',
            rating: 4.8,
            features: ['Multi-sig Wallet', 'Treasury Management', 'Program Upgrades', 'Team Permissions', 'Transaction Batching'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 200,
            status: 'Active',
            description: 'Multi-signature wallet and treasury management for Solana protocols and DAOs.'
          },
          {
            id: '10',
            name: 'Realms',
            category: 'Governance',
            type: 'Free',
            users: '35K',
            rating: 4.5,
            features: ['DAO Governance', 'Proposal Management', 'Voting', 'Treasury Control', 'Plugin System'],
            supportedChains: ['Solana'],
            pricing: 'Free',
            integrations: 150,
            status: 'Active',
            description: 'Solana-native DAO governance platform for decentralized organizations.'
          },
          {
            id: '11',
            name: 'Helius',
            category: 'Infrastructure',
            type: 'Freemium',
            users: '12K',
            rating: 4.7,
            features: ['RPC Infrastructure', 'Enhanced APIs', 'Webhook Support', 'Analytics', 'Priority Access'],
            supportedChains: ['Solana'],
            pricing: 'Free tier + $99/month',
            integrations: 800,
            status: 'Active',
            description: 'Enhanced Solana RPC infrastructure with developer-friendly APIs and analytics.'
          },
          {
            id: '12',
            name: 'Ottersec',
            category: 'Security',
            type: 'Enterprise',
            users: '500',
            rating: 4.9,
            features: ['Solana Audits', 'Security Reviews', 'Rust Expertise', 'Program Analysis', 'Monitoring'],
            supportedChains: ['Solana'],
            pricing: 'Custom pricing',
            integrations: 100,
            status: 'Active',
            description: 'Leading security firm specializing in Solana program audits and reviews.'
          }
        ];

        setTools(mockData);
      } catch (error) {
        console.error('Error fetching tool data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchToolData();
  }, []);

  const filteredAndSortedTools = tools
    .filter(tool => 
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(tool => filterCategory === 'All' || tool.category === filterCategory)
    .filter(tool => filterType === 'All' || tool.type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'users':
          return parseFloat(b.users.replace(/[^\d.]/g, '')) - parseFloat(a.users.replace(/[^\d.]/g, ''));
        case 'rating':
          return b.rating - a.rating;
        case 'integrations':
          return b.integrations - a.integrations;
        default:
          return 0;
      }
    });

  const categories = ['All', ...Array.from(new Set(tools.map(tool => tool.category)))];
  const types = ['All', ...Array.from(new Set(tools.map(tool => tool.type)))];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Portfolio Tracker': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Analytics': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Tax Tools': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Wallet': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'Infrastructure': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'Security': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Developer': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      case 'Governance': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Free': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Freemium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Paid': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'Enterprise': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Beta': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Coming Soon': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading DeFi tools...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Solana DeFi Tools & Utilities</h1>
        <p className="text-muted-foreground">
          Essential Solana-native tools and infrastructure for DeFi users, developers, and institutions
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            aria-label="Filter tools by category"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            aria-label="Filter tools by pricing type"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSortBy(sortBy === 'users' ? 'rating' : 'users')}
            aria-label={`Currently sorting by ${sortBy}. Click to sort by ${sortBy === 'users' ? 'rating' : 'users'}`}
          >
            <ArrowUpDown className="h-4 w-4 mr-1" />
            Sort by {sortBy === 'users' ? 'Users' : 'Rating'}
          </Button>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedTools.map((tool) => (
          <Card key={tool.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {tool.name}
                  </CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </div>
                <Badge className={getStatusColor(tool.status)}>
                  {tool.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={getCategoryColor(tool.category)}>
                  {tool.category}
                </Badge>
                <Badge className={getTypeColor(tool.type)}>
                  {tool.type}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Users</div>
                    <div className="font-semibold">{tool.users}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Rating</div>
                    <div className="font-semibold">{tool.rating}/5.0</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Integrations</div>
                    <div className="font-semibold">{tool.integrations.toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Pricing</div>
                    <div className="font-semibold text-xs">{tool.pricing}</div>
                  </div>
                </div>
              </div>

              {/* Supported Chains */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Supported Chains:</div>
                <div className="flex flex-wrap gap-1">
                  {tool.supportedChains.slice(0, 3).map((chain, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {chain}
                    </Badge>
                  ))}
                  {tool.supportedChains.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{tool.supportedChains.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="text-sm text-muted-foreground mb-2">Key Features:</div>
                <div className="flex flex-wrap gap-1">
                  {tool.features.slice(0, 4).map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {tool.features.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{tool.features.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <Button className="w-full" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View Tool
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAndSortedTools.length === 0 && (
        <div className="text-center py-20">
          <div className="text-muted-foreground">No tools found matching your criteria.</div>
        </div>
      )}
    </div>
  );
}
