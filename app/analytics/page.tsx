'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SolanaDEXTab } from '@/components/solana/solana-dex-tab';
import { CrossChainTab } from '@/components/solana/cross-chain-tab';
import { DeFiHealthTab } from '@/components/solana/defi-health-tab';
import { ValidatorTab } from '@/components/solana/validator-tab';
import { LaunchpadsTab } from '@/components/solana/launchpads-tab';
import { BotsTab } from '@/components/solana/bots-tab';
import { AggregatorsTab, MarketplacesTab, SocialFiTab, InfoFiTab, DeFAITab } from '@/components/solana/analytics-tabs';
import { OverviewMetrics, QuickActions } from '@/components/analytics/overview-components';

type TabType = 'overview' | 'dex' | 'cross-chain' | 'defi-health' | 'validators' | 'launchpads' | 'bots' | 'aggregators' | 'marketplaces' | 'socialfi' | 'infofi' | 'defai';

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Memoize tabs array to avoid needless re-computation
  const tabs = useMemo(() => [
    { 
      id: 'overview' as TabType, 
      label: 'Overview', 
      description: 'Network overview and key metrics',
      ariaLabel: 'Overview tab - Network overview and key metrics'
    },
    { 
      id: 'dex' as TabType, 
      label: 'Solana DEX', 
      description: 'DEX volume, liquidity, and arbitrage',
      ariaLabel: 'Solana DEX tab - DEX volume, liquidity, and arbitrage opportunities'
    },
    { 
      id: 'cross-chain' as TabType, 
      label: 'Cross-Chain', 
      description: 'Bridge flows and migrations',
      ariaLabel: 'Cross-Chain tab - Bridge flows and asset migrations'
    },
    { 
      id: 'defi-health' as TabType, 
      label: 'DeFi Health', 
      description: 'Protocol health and risk monitoring',
      ariaLabel: 'DeFi Health tab - Protocol health and risk monitoring'
    },
    { 
      id: 'validators' as TabType, 
      label: 'Validators', 
      description: 'Validator performance and decentralization',
      ariaLabel: 'Validators tab - Validator performance and decentralization analytics'
    },
    { 
      id: 'launchpads' as TabType, 
      label: 'Launchpads', 
      description: 'Token launch platforms and IDO analytics',
      ariaLabel: 'Launchpads tab - Token launch platforms and IDO analytics'
    },
    { 
      id: 'bots' as TabType, 
      label: 'Bots', 
      description: 'Trading and analytics bots',
      ariaLabel: 'Bots tab - Telegram, Discord, and Matrix trading bots'
    },
    { 
      id: 'aggregators' as TabType, 
      label: 'Aggregators', 
      description: 'DEX and liquidity aggregators',
      ariaLabel: 'Aggregators tab - DEX and liquidity aggregation platforms'
    },
    { 
      id: 'marketplaces' as TabType, 
      label: 'Marketplaces', 
      description: 'NFT and asset marketplaces',
      ariaLabel: 'Marketplaces tab - NFT and digital asset marketplaces'
    },
    { 
      id: 'socialfi' as TabType, 
      label: 'Social Fi', 
      description: 'Social finance platforms',
      ariaLabel: 'Social Fi tab - Social finance and community platforms'
    },
    { 
      id: 'infofi' as TabType, 
      label: 'Info Fi', 
      description: 'Information and analytics platforms',
      ariaLabel: 'Info Fi tab - Blockchain information and analytics platforms'
    },
    { 
      id: 'defai' as TabType, 
      label: 'DeFAI', 
      description: 'AI-powered DeFi tools',
      ariaLabel: 'DeFAI tab - AI-powered DeFi and trading tools'
    },
  ], []);

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['overview', 'dex', 'cross-chain', 'defi-health', 'validators', 'launchpads', 'bots', 'aggregators', 'marketplaces', 'socialfi', 'infofi', 'defai'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    const newUrl = `/analytics?tab=${tab}`;
    router.push(newUrl, { scroll: false });
  }, [router]);

  // Handle keyboard navigation for tabs
  const handleTabKeyDown = useCallback((event: React.KeyboardEvent, tab: TabType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabChange(tab);
    }
  }, [handleTabChange]);

  // Memoized overview data to avoid recalculation
  const overviewData = useMemo(() => ({
    networkMetrics: [
      { label: 'TPS', value: '~2,500' },
      { label: 'Validators', value: '1,500+' },
      { label: 'Total Supply', value: '580M SOL' },
    ],
    defiMetrics: [
      { label: 'Total TVL', value: '$2.1B' },
      { label: 'Active Protocols', value: '50+' },
      { label: '24h Volume', value: '$450M' },
    ],
    crossChainMetrics: [
      { label: 'Active Bridges', value: '5' },
      { label: '24h Volume', value: '$85M' },
      { label: 'Top Asset', value: 'USDC' },
    ],
  }), []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <OverviewMetrics
              networkMetrics={overviewData.networkMetrics}
              defiMetrics={overviewData.defiMetrics}
              crossChainMetrics={overviewData.crossChainMetrics}
            />
            <QuickActions onNavigate={(tab: string) => handleTabChange(tab as TabType)} />
          </div>
        );
      
      case 'dex':
        return <SolanaDEXTab />;
      
      case 'cross-chain':
        return <CrossChainTab />;
      
      case 'defi-health':
        return <DeFiHealthTab />;
      
      case 'validators':
        return <ValidatorTab />;
        
      case 'launchpads':
        return <LaunchpadsTab />;
        
      case 'bots':
        return <BotsTab />;
        
      case 'aggregators':
        return <AggregatorsTab />;
        
      case 'marketplaces':
        return <MarketplacesTab />;
        
      case 'socialfi':
        return <SocialFiTab />;
        
      case 'infofi':
        return <InfoFiTab />;
        
      case 'defai':
        return <DeFAITab />;
      
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Solana Ecosystem Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive analytics for DEXes, cross-chain flows, DeFi protocols, and validator performance.
        </p>
      </div>

      {/* Tab Navigation with proper ARIA roles and keyboard support */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav 
            className="-mb-px flex space-x-8" 
            role="tablist" 
            aria-label="Analytics navigation tabs"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                aria-label={tab.ariaLabel}
                tabIndex={activeTab === tab.id ? 0 : -1}
              >
                <div className="flex flex-col items-center">
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content with proper ARIA labeling */}
      <div 
        className="min-h-[600px]"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        {renderTabContent()}
      </div>
    </div>
  );
}
