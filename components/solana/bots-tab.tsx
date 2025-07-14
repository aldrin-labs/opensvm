'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Bot, Users, Star, ExternalLink, Heart, MessageCircle, Shield, Crown } from 'lucide-react';

interface BotData {
  bots: Array<{
    name: string;
    platform: 'telegram' | 'discord' | 'matrix' | 'multi-platform';
    category: string;
    description: string;
    users: number;
    servers: number;
    features: string[];
    website: string;
    inviteLink?: string;
    likes: number;
    rating: number;
    isVerified: boolean;
    isPremium: boolean;
    pricing: 'free' | 'freemium' | 'paid';
    monthlyActiveUsers: number;
    uptime: number;
    responseTime: number;
    lastUpdate: number;
  }>;
  summary: {
    totalBots: number;
    totalUsers: number;
    totalServers: number;
    avgRating: number;
    verifiedBots: number;
    freeBots: number;
    premiumBots: number;
    avgUptime: number;
    platforms: {
      telegram: number;
      discord: number;
      matrix: number;
      multiPlatform: number;
    };
    categories: {
      trading: number;
      analytics: number;
      nft: number;
      defi: number;
    };
    lastUpdate: number;
  };
}

export function BotsTab() {
  const [data, setData] = useState<BotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'likes' | 'users' | 'rating' | 'uptime'>('likes');
  const [filterBy, setFilterBy] = useState<'all' | 'telegram' | 'discord' | 'matrix' | 'multi-platform'>('all');
  const [likedBots, setLikedBots] = useState<Set<string>>(new Set());

  // Safe formatting functions
  const formatNumber = (value: number | undefined | null): string => {
    if (value == null || isNaN(value)) return '0';
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
  };

  const formatPercent = (value: number | undefined | null): string => {
    if (value == null || isNaN(value)) return '0%';
    return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
  };

  const formatTime = (value: number | undefined | null): string => {
    if (value == null || isNaN(value)) return '0s';
    return `${value.toFixed(1)}s`;
  };

  const handleLike = (botName: string) => {
    const newLiked = new Set(likedBots);
    if (newLiked.has(botName)) {
      newLiked.delete(botName);
    } else {
      newLiked.add(botName);
    }
    setLikedBots(newLiked);

    // Update the data with new like count
    if (data) {
      const updatedBots = data.bots.map(bot => {
        if (bot.name === botName) {
          return {
            ...bot,
            likes: newLiked.has(botName) ? bot.likes + 1 : bot.likes - 1
          };
        }
        return bot;
      });
      setData({ ...data, bots: updatedBots });
    }
  };

  const getSortedAndFilteredBots = () => {
    if (!data) return [];
    
    let filteredBots = data.bots;
    
    if (filterBy !== 'all') {
      filteredBots = filteredBots.filter(bot => bot.platform === filterBy);
    }
    
    return filteredBots.sort((a, b) => {
      switch (sortBy) {
        case 'likes':
          return b.likes - a.likes;
        case 'users':
          return b.monthlyActiveUsers - a.monthlyActiveUsers;
        case 'rating':
          return b.rating - a.rating;
        case 'uptime':
          return b.uptime - a.uptime;
        default:
          return 0;
      }
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'telegram':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'discord':
        return <Bot className="h-4 w-4 text-indigo-500" />;
      case 'matrix':
        return <Shield className="h-4 w-4 text-green-500" />;
      case 'multi-platform':
        return <Users className="h-4 w-4 text-purple-500" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'telegram':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'discord':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'matrix':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'multi-platform':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/analytics/bots');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching bot data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading bot data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-center py-8">
        Error loading bot data: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No bot data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Bots</p>
              <p className="text-xl font-bold">{data.summary.totalBots}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-xl font-bold">{formatNumber(data.summary.totalUsers)}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
              <p className="text-xl font-bold">{data.summary.avgRating.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-xl font-bold">{data.summary.verifiedBots}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Telegram</p>
              <p className="text-xl font-bold">{data.summary.platforms.telegram}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-sm text-muted-foreground">Discord</p>
              <p className="text-xl font-bold">{data.summary.platforms.discord}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Matrix</p>
              <p className="text-xl font-bold">{data.summary.platforms.matrix}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Multi-Platform</p>
              <p className="text-xl font-bold">{data.summary.platforms.multiPlatform}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground">Filter:</span>
          {[
            { key: 'all', label: 'All' },
            { key: 'telegram', label: 'Telegram' },
            { key: 'discord', label: 'Discord' },
            { key: 'matrix', label: 'Matrix' },
            { key: 'multi-platform', label: 'Multi-Platform' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterBy(key as any)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filterBy === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
          {[
            { key: 'likes', label: 'Likes' },
            { key: 'users', label: 'Users' },
            { key: 'rating', label: 'Rating' },
            { key: 'uptime', label: 'Uptime' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key as any)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortBy === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bot Rankings */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Trading & Analytics Bots</h3>
          <p className="text-sm text-muted-foreground">Comprehensive directory of Solana ecosystem bots</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Bot</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Users</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rating</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Uptime</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Likes</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {getSortedAndFilteredBots().map((bot, index) => (
                <tr key={bot.name} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{index + 1}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{bot.name}</span>
                          {bot.isVerified && (
                            <Shield className="h-4 w-4 text-green-500" title="Verified" />
                          )}
                          {bot.isPremium && (
                            <Crown className="h-4 w-4 text-yellow-500" title="Premium" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground max-w-xs truncate">{bot.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bot.features.slice(0, 3).map((feature, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      {getPlatformIcon(bot.platform)}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(bot.platform)}`}>
                        {bot.platform}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                      {bot.category}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <span className="font-medium">{formatNumber(bot.monthlyActiveUsers)}</span>
                      <p className="text-xs text-muted-foreground">Monthly Active</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{bot.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <span className="font-medium">{formatPercent(bot.uptime)}</span>
                      <p className="text-xs text-muted-foreground">{formatTime(bot.responseTime)} avg</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Heart 
                        className={`h-4 w-4 cursor-pointer transition-colors ${
                          likedBots.has(bot.name) 
                            ? 'text-red-500 fill-current' 
                            : 'text-muted-foreground hover:text-red-500'
                        }`}
                        onClick={() => handleLike(bot.name)}
                      />
                      <span className="text-sm font-medium">{bot.likes}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      {bot.inviteLink && (
                        <a
                          href={bot.inviteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>Use</span>
                        </a>
                      )}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        bot.pricing === 'free' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : bot.pricing === 'freemium'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {bot.pricing}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}