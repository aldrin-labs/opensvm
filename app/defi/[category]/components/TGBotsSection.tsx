'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';
import { ExternalLink, TrendingUp, TrendingDown, Bot, Zap, Users, MessageCircle, Search, Star, Shield, DollarSign } from 'lucide-react';

interface BotData {
  name: string;
  type: 'Trading Bot' | 'MEV Bot' | 'Copy Trading' | 'Portfolio Bot' | 'Alert Bot' | 'Analytics Bot' | 'DCA Bot' | 'Arbitrage Bot';
  platform: 'Telegram' | 'Discord' | 'Web App' | 'API' | 'Multi-Platform';
  users: number;
  volume24h: number;
  successRate: number;
  avgReturn: number;
  chains: string[];
  category: string;
  description: string;
  website: string;
  telegramLink: string;
  change24h: number;
  trades24h: number;
  feeStructure: {
    subscription: number; // Monthly fee in USD
    performance: number; // Performance fee percentage
    transaction: number; // Per transaction fee
  };
  features: string[];
  isVerified: boolean;
  rating: number;
  minInvestment: number;
  maxSlippage: number;
  supportedDEXs: string[];
  autoExecution: boolean;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Extreme';
  responseTime: number; // milliseconds
}

export default function TGBotsSection() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'users' | 'volume24h' | 'successRate' | 'avgReturn'>('users');

  useEffect(() => {
    async function fetchBotsData() {
      try {
        // In a real implementation, this would fetch from bots APIs and Telegram bot directories
        // For now, we'll create realistic bot data for Solana ecosystem
        const botsList: BotData[] = [
          {
            name: 'BonkBot',
            type: 'Trading Bot',
            platform: 'Telegram',
            users: 45000,
            volume24h: 12000000,
            successRate: 68.5,
            avgReturn: 24.3,
            chains: ['Solana'],
            category: 'Meme Trading',
            description: 'Fast meme token trading bot with instant buy/sell on Telegram',
            website: 'https://bonkbot.io',
            telegramLink: 'https://t.me/bonkbot_bot',
            change24h: 15.2,
            trades24h: 8900,
            feeStructure: {
              subscription: 0,
              performance: 0,
              transaction: 1.0
            },
            features: ['Instant Trading', 'Meme Scanning', 'Sniper Mode', 'Portfolio Tracking'],
            isVerified: true,
            rating: 4.2,
            minInvestment: 0.1,
            maxSlippage: 50,
            supportedDEXs: ['Raydium', 'Jupiter', 'Orca'],
            autoExecution: true,
            riskLevel: 'High',
            responseTime: 250
          },
          {
            name: 'Maestro',
            type: 'Trading Bot',
            platform: 'Telegram',
            users: 67000,
            volume24h: 18500000,
            successRate: 72.1,
            avgReturn: 31.7,
            chains: ['Solana', 'Ethereum'],
            category: 'Multi-Chain Trading',
            description: 'Advanced trading bot with MEV protection and limit orders',
            website: 'https://maestrobots.com',
            telegramLink: 'https://t.me/maestro',
            change24h: 8.7,
            trades24h: 12400,
            feeStructure: {
              subscription: 0,
              performance: 0,
              transaction: 1.0
            },
            features: ['MEV Protection', 'Limit Orders', 'Copy Trading', 'Anti-Rug'],
            isVerified: true,
            rating: 4.5,
            minInvestment: 0.05,
            maxSlippage: 30,
            supportedDEXs: ['Jupiter', 'Raydium', 'Uniswap'],
            autoExecution: true,
            riskLevel: 'Medium',
            responseTime: 180
          },
          {
            name: 'Banana Gun',
            type: 'Trading Bot',
            platform: 'Telegram',
            users: 23000,
            volume24h: 8900000,
            successRate: 65.3,
            avgReturn: 19.8,
            chains: ['Solana'],
            category: 'Sniper Bot',
            description: 'High-speed trading bot specializing in new token launches',
            website: 'https://banana.gun',
            telegramLink: 'https://t.me/BananaGunSolana_bot',
            change24h: 22.4,
            trades24h: 5600,
            feeStructure: {
              subscription: 0,
              performance: 0,
              transaction: 1.5
            },
            features: ['Launch Sniping', 'Fast Execution', 'Wallet Management', 'Auto-Sell'],
            isVerified: true,
            rating: 4.0,
            minInvestment: 0.1,
            maxSlippage: 60,
            supportedDEXs: ['Raydium', 'Pump.fun'],
            autoExecution: true,
            riskLevel: 'Extreme',
            responseTime: 120
          },
          {
            name: 'Photon',
            type: 'Trading Bot',
            platform: 'Web App',
            users: 34000,
            volume24h: 15600000,
            successRate: 70.8,
            avgReturn: 28.1,
            chains: ['Solana'],
            category: 'Advanced Trading',
            description: 'Professional trading terminal with advanced charting and automation',
            website: 'https://photon-sol.tinyastro.io',
            telegramLink: 'https://t.me/photon_sol',
            change24h: 12.1,
            trades24h: 9800,
            feeStructure: {
              subscription: 29,
              performance: 0,
              transaction: 0.5
            },
            features: ['Advanced Charts', 'Portfolio Analytics', 'Risk Management', 'API Integration'],
            isVerified: true,
            rating: 4.3,
            minInvestment: 1.0,
            maxSlippage: 20,
            supportedDEXs: ['Jupiter', 'Raydium', 'Orca', 'Meteora'],
            autoExecution: true,
            riskLevel: 'Medium',
            responseTime: 200
          },
          {
            name: 'GMGN Alerts',
            type: 'Alert Bot',
            platform: 'Telegram',
            users: 89000,
            volume24h: 0,
            successRate: 85.2,
            avgReturn: 0,
            chains: ['Solana'],
            category: 'Analytics & Alerts',
            description: 'Real-time alerts for whale movements and smart money trades',
            website: 'https://gmgn.ai',
            telegramLink: 'https://t.me/gmgnai',
            change24h: 5.3,
            trades24h: 0,
            feeStructure: {
              subscription: 19,
              performance: 0,
              transaction: 0
            },
            features: ['Whale Tracking', 'Smart Money Alerts', 'Token Analysis', 'Market Insights'],
            isVerified: true,
            rating: 4.6,
            minInvestment: 0,
            maxSlippage: 0,
            supportedDEXs: [],
            autoExecution: false,
            riskLevel: 'Low',
            responseTime: 500
          },
          {
            name: 'TrojanBot',
            type: 'Copy Trading',
            platform: 'Telegram',
            users: 12000,
            volume24h: 4500000,
            successRate: 61.7,
            avgReturn: 16.4,
            chains: ['Solana'],
            category: 'Copy Trading',
            description: 'Copy successful traders automatically with customizable parameters',
            website: 'https://trojanbot.xyz',
            telegramLink: 'https://t.me/trojanbot',
            change24h: 9.8,
            trades24h: 3400,
            feeStructure: {
              subscription: 0,
              performance: 10,
              transaction: 0.8
            },
            features: ['Trader Following', 'Position Mirroring', 'Risk Controls', 'Performance Analytics'],
            isVerified: false,
            rating: 3.8,
            minInvestment: 0.5,
            maxSlippage: 25,
            supportedDEXs: ['Raydium', 'Jupiter'],
            autoExecution: true,
            riskLevel: 'High',
            responseTime: 300
          },
          {
            name: 'Sol Trading Bot',
            type: 'DCA Bot',
            platform: 'Telegram',
            users: 8900,
            volume24h: 2100000,
            successRate: 78.9,
            avgReturn: 12.3,
            chains: ['Solana'],
            category: 'DCA Strategy',
            description: 'Dollar-cost averaging bot with customizable schedules and targets',
            website: 'https://soltradingbot.com',
            telegramLink: 'https://t.me/soltradingbot',
            change24h: 3.2,
            trades24h: 1200,
            feeStructure: {
              subscription: 15,
              performance: 0,
              transaction: 0.3
            },
            features: ['DCA Scheduling', 'Take Profit', 'Stop Loss', 'Portfolio Rebalancing'],
            isVerified: true,
            rating: 4.1,
            minInvestment: 0.2,
            maxSlippage: 10,
            supportedDEXs: ['Jupiter', 'Raydium'],
            autoExecution: true,
            riskLevel: 'Low',
            responseTime: 400
          },
          {
            name: 'Jupiter Bot',
            type: 'Arbitrage Bot',
            platform: 'API',
            users: 5600,
            volume24h: 6700000,
            successRate: 82.4,
            avgReturn: 8.7,
            chains: ['Solana'],
            category: 'Arbitrage',
            description: 'Cross-DEX arbitrage bot using Jupiter aggregator',
            website: 'https://jup.ag/bots',
            telegramLink: 'https://t.me/jupiterbot',
            change24h: 1.8,
            trades24h: 2800,
            feeStructure: {
              subscription: 49,
              performance: 20,
              transaction: 0.1
            },
            features: ['Cross-DEX Arbitrage', 'Route Optimization', 'MEV Protection', 'Gas Optimization'],
            isVerified: true,
            rating: 4.4,
            minInvestment: 5.0,
            maxSlippage: 5,
            supportedDEXs: ['All Jupiter DEXs'],
            autoExecution: true,
            riskLevel: 'Medium',
            responseTime: 100
          },
          {
            name: 'SolTracker',
            type: 'Portfolio Bot',
            platform: 'Multi-Platform',
            users: 15600,
            volume24h: 0,
            successRate: 92.1,
            avgReturn: 0,
            chains: ['Solana'],
            category: 'Portfolio Management',
            description: 'Comprehensive portfolio tracking and management with automated reports',
            website: 'https://soltracker.io',
            telegramLink: 'https://t.me/soltracker',
            change24h: 7.4,
            trades24h: 0,
            feeStructure: {
              subscription: 9,
              performance: 0,
              transaction: 0
            },
            features: ['Portfolio Tracking', 'P&L Reports', 'Tax Reporting', 'Performance Analytics'],
            isVerified: true,
            rating: 4.7,
            minInvestment: 0,
            maxSlippage: 0,
            supportedDEXs: [],
            autoExecution: false,
            riskLevel: 'Low',
            responseTime: 1000
          },
          {
            name: 'MEV Blocker Bot',
            type: 'MEV Bot',
            platform: 'Web App',
            users: 3400,
            volume24h: 3200000,
            successRate: 89.3,
            avgReturn: 15.6,
            chains: ['Solana'],
            category: 'MEV Protection',
            description: 'Advanced MEV protection and sandwich attack prevention',
            website: 'https://mevblocker.sol',
            telegramLink: 'https://t.me/mevblocker',
            change24h: 4.7,
            trades24h: 1800,
            feeStructure: {
              subscription: 39,
              performance: 0,
              transaction: 0.2
            },
            features: ['MEV Protection', 'Private Mempool', 'Sandwich Prevention', 'Priority Fees'],
            isVerified: true,
            rating: 4.2,
            minInvestment: 1.0,
            maxSlippage: 15,
            supportedDEXs: ['Jupiter', 'Raydium'],
            autoExecution: true,
            riskLevel: 'Low',
            responseTime: 150
          }
        ];

        // Sort by users by default
        botsList.sort((a, b) => b.users - a.users);
        setBots(botsList);
      } catch (err) {
        console.error('Error fetching bots data:', err);
        setError('Failed to load bots data');
      } finally {
        setLoading(false);
      }
    }

    fetchBotsData();
  }, []);

  const filteredBots = bots
    .filter(bot => {
      const matchesSearch = bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           bot.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || bot.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-500';
      case 'Medium': return 'text-yellow-500';
      case 'High': return 'text-orange-500';
      case 'Extreme': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
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

  const botTypes = ['all', ...Array.from(new Set(bots.map(b => b.type)))];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Bots & Other Bots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bots..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {botTypes.map(type => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
              <Button
                variant={sortBy === 'users' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('users')}
              >
                Users
              </Button>
              <Button
                variant={sortBy === 'volume24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('volume24h')}
              >
                Volume
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

      {/* Bots Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredBots.map((bot) => (
          <Card key={bot.name} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center text-white">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      {bot.isVerified && <Shield className="h-4 w-4 text-green-500" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{bot.type}</Badge>
                      <Badge variant="secondary">{bot.platform}</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {renderStars(bot.rating)}
                      <span className="text-sm text-muted-foreground ml-1">{bot.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {bot.description}
              </p>
              
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    Users
                  </div>
                  <p className="font-bold text-lg">{formatNumber(bot.users)}</p>
                  <div className={`flex items-center gap-1 text-xs ${
                    bot.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {bot.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(bot.change24h).toFixed(1)}%
                  </div>
                </div>
                
                {bot.volume24h > 0 && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <DollarSign className="h-3 w-3" />
                      24h Volume
                    </div>
                    <p className="font-bold text-lg">${formatNumber(bot.volume24h)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(bot.trades24h)} trades
                    </p>
                  </div>
                )}
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Zap className="h-3 w-3" />
                    Success Rate
                  </div>
                  <p className="font-bold text-lg text-green-500">{bot.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    Response: {bot.responseTime}ms
                  </p>
                </div>
                
                {bot.avgReturn > 0 && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-3 w-3" />
                      Avg Return
                    </div>
                    <p className="font-bold text-lg text-blue-500">{bot.avgReturn.toFixed(1)}%</p>
                    <p className={`text-xs font-medium ${getRiskColor(bot.riskLevel)}`}>
                      {bot.riskLevel} Risk
                    </p>
                  </div>
                )}
              </div>
              
              {/* Pricing */}
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm mb-2">Pricing</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-muted-foreground">Monthly</p>
                    <p className="font-medium">${bot.feeStructure.subscription}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Performance</p>
                    <p className="font-medium">{bot.feeStructure.performance}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Per Trade</p>
                    <p className="font-medium">{bot.feeStructure.transaction}%</p>
                  </div>
                </div>
              </div>
              
              {/* Features */}
              <div>
                <h4 className="font-medium text-sm mb-2">Features</h4>
                <div className="flex flex-wrap gap-1">
                  {bot.features.map(feature => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Supported DEXs */}
              {bot.supportedDEXs.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Supported DEXs</h4>
                  <div className="flex flex-wrap gap-1">
                    {bot.supportedDEXs.slice(0, 3).map(dex => (
                      <Badge key={dex} variant="outline" className="text-xs">
                        {dex}
                      </Badge>
                    ))}
                    {bot.supportedDEXs.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{bot.supportedDEXs.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {/* Technical Details */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Min Investment:</span>
                  <span className="font-medium">{bot.minInvestment} SOL</span>
                </div>
                {bot.maxSlippage > 0 && (
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-muted-foreground">Max Slippage:</span>
                    <span className="font-medium">{bot.maxSlippage}%</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-foreground">Auto Execution:</span>
                  <span className={`font-medium ${bot.autoExecution ? 'text-green-500' : 'text-gray-500'}`}>
                    {bot.autoExecution ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1">
                  Start Bot
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredBots.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No bots found matching your search criteria.</p>
        </div>
      )}
    </div>
  );
}