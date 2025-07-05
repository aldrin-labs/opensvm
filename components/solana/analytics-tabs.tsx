'use client';

import React from 'react';
import { GenericAnalyticsTab } from './generic-analytics-tab';
import { TrendingUp, DollarSign, Users, Target, BarChart3 } from 'lucide-react';

export function AggregatorsTab() {
  return (
    <GenericAnalyticsTab
      apiEndpoint="/api/analytics/aggregators"
      title="Aggregators"
      description="Comprehensive analysis of DeFi aggregation platforms"
      itemName="aggregators"
      columns={[
        { key: 'type', label: 'Type', format: 'text' },
        { key: 'tvl', label: 'TVL', format: 'currency', icon: DollarSign },
        { key: 'volume24h', label: '24h Volume', format: 'currency', icon: TrendingUp },
        { key: 'integrations', label: 'Integrations', format: 'number', icon: Target },
        { key: 'marketShare', label: 'Market Share', format: 'percent', icon: BarChart3 }
      ]}
      sortOptions={[
        { key: 'likes', label: 'Likes' },
        { key: 'tvl', label: 'TVL' },
        { key: 'volume24h', label: 'Volume' },
        { key: 'marketShare', label: 'Market Share' }
      ]}
    />
  );
}

export function MarketplacesTab() {
  return (
    <GenericAnalyticsTab
      apiEndpoint="/api/analytics/marketplaces"
      title="Marketplaces"
      description="Comprehensive analysis of NFT and token marketplaces"
      itemName="marketplaces"
      columns={[
        { key: 'type', label: 'Type', format: 'text' },
        { key: 'volume24h', label: '24h Volume', format: 'currency', icon: DollarSign },
        { key: 'trades24h', label: '24h Trades', format: 'number', icon: TrendingUp },
        { key: 'uniqueTraders', label: 'Traders', format: 'number', icon: Users },
        { key: 'marketShare', label: 'Market Share', format: 'percent', icon: BarChart3 }
      ]}
      sortOptions={[
        { key: 'likes', label: 'Likes' },
        { key: 'volume24h', label: 'Volume' },
        { key: 'trades24h', label: 'Trades' },
        { key: 'marketShare', label: 'Market Share' }
      ]}
    />
  );
}

export function SocialFiTab() {
  return (
    <GenericAnalyticsTab
      apiEndpoint="/api/analytics/socialfi"
      title="Social Fi"
      description="Comprehensive analysis of social finance platforms"
      itemName="platforms"
      columns={[
        { key: 'category', label: 'Category', format: 'text' },
        { key: 'activeUsers', label: 'Active Users', format: 'number', icon: Users },
        { key: 'engagement', label: 'Engagement', format: 'percent', icon: TrendingUp },
        { key: 'marketCap', label: 'Market Cap', format: 'currency', icon: DollarSign },
        { key: 'growth', label: 'Growth', format: 'percent', icon: BarChart3 }
      ]}
      sortOptions={[
        { key: 'likes', label: 'Likes' },
        { key: 'activeUsers', label: 'Active Users' },
        { key: 'engagement', label: 'Engagement' },
        { key: 'marketCap', label: 'Market Cap' }
      ]}
    />
  );
}

export function InfoFiTab() {
  return (
    <GenericAnalyticsTab
      apiEndpoint="/api/analytics/infofi"
      title="Info Fi"
      description="Comprehensive analysis of blockchain information platforms"
      itemName="platforms"
      columns={[
        { key: 'category', label: 'Category', format: 'text' },
        { key: 'dailyUsers', label: 'Daily Users', format: 'number', icon: Users },
        { key: 'accuracy', label: 'Accuracy', format: 'percent', icon: Target },
        { key: 'uptime', label: 'Uptime', format: 'percent', icon: TrendingUp },
        { key: 'marketShare', label: 'Market Share', format: 'percent', icon: BarChart3 }
      ]}
      sortOptions={[
        { key: 'likes', label: 'Likes' },
        { key: 'dailyUsers', label: 'Daily Users' },
        { key: 'accuracy', label: 'Accuracy' },
        { key: 'uptime', label: 'Uptime' }
      ]}
    />
  );
}

export function DeFAITab() {
  return (
    <GenericAnalyticsTab
      apiEndpoint="/api/analytics/defai"
      title="DeFAI"
      description="Comprehensive analysis of AI-powered DeFi platforms"
      itemName="platforms"
      columns={[
        { key: 'category', label: 'Category', format: 'text' },
        { key: 'activeUsers', label: 'Active Users', format: 'number', icon: Users },
        { key: 'accuracy', label: 'Accuracy', format: 'percent', icon: Target },
        { key: 'volume24h', label: '24h Volume', format: 'currency', icon: DollarSign },
        { key: 'marketShare', label: 'Market Share', format: 'percent', icon: BarChart3 }
      ]}
      sortOptions={[
        { key: 'likes', label: 'Likes' },
        { key: 'activeUsers', label: 'Active Users' },
        { key: 'accuracy', label: 'Accuracy' },
        { key: 'volume24h', label: 'Volume' }
      ]}
    />
  );
}