'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSettings } from '@/lib/settings';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import DeFAISection from './components/DeFAISection';
import AggregatorsSection from './components/AggregatorsSection';
import YieldAggregatorsSection from './components/YieldAggregatorsSection';
import StakingSection from './components/StakingSection';
import StablecoinsSection from './components/StablecoinsSection';
import OraclesSection from './components/OraclesSection';
import ToolsSection from './components/ToolsSection';
import CoinsScreenerSection from './components/CoinsScreenerSection';
import MemecoinScreenerSection from './components/MemecoinScreenerSection';
import LaunchpadsSection from './components/LaunchpadsSection';
import AMMsSection from './components/AMMsSection';
import CLOBsSection from './components/CLOBsSection';
import PerpetualsSection from './components/PerpetualsSection';
import OptionsSection from './components/OptionsSection';

const categoryConfig = {
  'defai': {
    title: 'DeFAI',
    description: 'AI-powered DeFi tools and analytics platforms',
    component: DeFAISection
  },
  'aggregators': {
    title: 'Aggregators',
    description: 'DEX aggregators and swap optimization platforms',
    component: AggregatorsSection
  },
  'yield-agg': {
    title: 'Yield Aggregators',
    description: 'Yield farming and optimization platform analytics',
    component: YieldAggregatorsSection
  },
  'staking': {
    title: 'Staking',
    description: 'Staking pools, validators, and reward analytics',
    component: StakingSection
  },
  'stablecoins': {
    title: 'Stablecoins',
    description: 'Stablecoin analytics, peg stability, and market data',
    component: StablecoinsSection
  },
  'oracles': {
    title: 'Data Providers & Oracles',
    description: 'Oracle networks and data feed analytics',
    component: OraclesSection
  },
  'tools': {
    title: 'Tools',
    description: 'DeFi tools, utilities, and infrastructure platforms',
    component: ToolsSection
  },
  'coins-screener': {
    title: 'Coins Screener',
    description: 'Solana token screening and analytics platform',
    component: CoinsScreenerSection
  },
  'memecoins': {
    title: 'Memecoin Screener',
    description: 'Solana memecoin tracking and analysis tools',
    component: MemecoinScreenerSection
  },
  'launchpads': {
    title: 'Launchpads',
    description: 'Solana token launch platforms and IDO analytics',
    component: LaunchpadsSection
  },
  'amms': {
    title: 'AMMs',
    description: 'Solana automated market makers and liquidity pools',
    component: AMMsSection
  },
  'clobs': {
    title: 'CLOBs',
    description: 'Solana central limit order books and spot trading',
    component: CLOBsSection
  },
  'perpetuals': {
    title: 'Perpetuals',
    description: 'Solana perpetual futures and derivatives trading',
    component: PerpetualsSection
  },
  'options': {
    title: 'Options',
    description: 'Solana options trading and derivatives analytics',
    component: OptionsSection
  }
};

interface PageProps {
  params: { category: string }; // Corrected type for params, assuming it's not a Promise here based on typical Next.js usage for page props
}

export default function DeFiCategoryPage({ params }: PageProps) {
  const settings = useSettings();
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(params.category || null); // Initialize category from params

  // Effect to handle potential category changes or initial loading if params are not immediately available
  useEffect(() => {
    if (!category && params.category) {
      setCategory(params.category);
    }
  }, [params.category, category]);

  const config = category ? categoryConfig[category as keyof typeof categoryConfig] : null;

  // Handle 404 navigation for invalid category
  useEffect(() => {
    if (category && !config) {
      router.push('/404');
    }
  }, [category, config, router]);

  // Show loading while resolving params or if config is not found yet
  if (!category || !config) {
    // Added ai-loading-spinner for AI navigation consideration
    return (
      <div className="ai-loading-spinner min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const ComponentToRender = config.component;

  return (
    // Added ai-defi-category-page-wrapper for AI navigation
    <div className="ai-defi-category-page-wrapper min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {config.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {config.description}
          </p>
        </div>

        <ErrorBoundary componentName={config.title}>
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner />
            </div>
          }>
            <ComponentToRender {...({ settings } as any)} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
