/**
 * RightPanelTabs
 *
 * Tabbed interface for the right panel, replacing the 5-accordion stack.
 * Groups widgets into logical categories:
 * - Market Data: Depth, Trades, News
 * - Portfolio: Positions, Performance
 * - AI Assistant: AI Chat
 */

'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Wallet, Bot, ChevronUp, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import widgets
const MarketDepthWidget = dynamic(() => import('./MarketDepthWidget'), { ssr: false });
const TradeHistory = dynamic(() => import('./TradeHistory'), { ssr: false });
const MarketNewsWidget = dynamic(() => import('./MarketNewsWidget'), { ssr: false });
const PositionsPanel = dynamic(() => import('./PositionsPanel'), { ssr: false });
const PerformanceWidget = dynamic(() => import('./PerformanceWidget'), { ssr: false });
const EnhancedAIChatWidget = dynamic(() => import('./EnhancedAIChatWidget'), { ssr: false });
const VibeMeterWidget = dynamic(() => import('./VibeMeterWidget'), { ssr: false });

interface RightPanelTabsProps {
  selectedMarket: string;
  isLoadingMarketData: boolean;
  walletConnected: boolean;
  marketData: any;
  onTradeExecute: (command: any) => void;
  focusedTile: string | null;
  toggleMaximize: (tileId: string) => void;
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  widgets: string[];
  badgeCount?: number;
}

export default function RightPanelTabs({
  selectedMarket,
  isLoadingMarketData,
  walletConnected,
  marketData,
  onTradeExecute,
  focusedTile,
  toggleMaximize,
}: RightPanelTabsProps) {
  const [activeTab, setActiveTab] = React.useState('market');

  const tabs: TabConfig[] = [
    {
      id: 'market',
      label: 'Market Data',
      icon: TrendingUp,
      widgets: ['depth', 'trades', 'news'],
    },
    {
      id: 'vibe',
      label: 'Vibe Meter',
      icon: Zap,
      widgets: ['vibe'],
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: Wallet,
      widgets: ['positions', 'performance'],
    },
    {
      id: 'ai',
      label: 'AI Assistant',
      icon: Bot,
      widgets: ['aichat'],
    },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col h-full bg-background"
      data-ai-section="right-panel-tabs"
    >
      {/* Tab List - Horizontal Navigation */}
      <TabsList className="flex-shrink-0 w-full h-auto bg-card border-b border-border rounded-none p-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold transition-colors duration-150 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-tab-id={tab.id}
            >
              <Icon size={16} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badgeCount && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {tab.badgeCount}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Market Data Tab */}
      <TabsContent
        value="market"
        className="flex-1 flex flex-col gap-2 p-2 mt-0 overflow-hidden"
        data-ai-tab="market-data"
      >
        {/* Market Depth Widget - 40% height */}
        <section
          data-tile-id="depth"
          className={`flex flex-col bg-card border border-border rounded-lg overflow-hidden ${
            focusedTile === 'depth' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          style={{ height: '40%' }}
          aria-label="Market Depth"
          data-ai-widget="market-depth"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">MARKET DEPTH</span>
            <button
              onClick={() => toggleMaximize('depth')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MarketDepthWidget market={selectedMarket} />
          </div>
        </section>

        {/* Recent Trades Widget - 40% height */}
        <section
          data-tile-id="trades"
          className={`flex flex-col bg-card border border-border rounded-lg overflow-hidden ${
            focusedTile === 'trades' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          style={{ height: '40%' }}
          aria-label="Recent Trades"
          data-ai-widget="recent-trades"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">RECENT TRADES</span>
            <button
              onClick={() => toggleMaximize('trades')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize (Shift+3)"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TradeHistory market={selectedMarket} isLoading={isLoadingMarketData} />
          </div>
        </section>

        {/* Market News Widget - 20% height */}
        <section
          data-tile-id="news"
          className={`flex flex-col bg-card border border-border rounded-lg overflow-hidden ${
            focusedTile === 'news' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          style={{ height: '20%' }}
          aria-label="Market News"
          data-ai-widget="market-news"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">MARKET NEWS</span>
            <button
              onClick={() => toggleMaximize('news')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MarketNewsWidget market={selectedMarket} />
          </div>
        </section>
      </TabsContent>

      {/* Vibe Meter Tab */}
      <TabsContent
        value="vibe"
        className="flex-1 flex flex-col mt-0 overflow-hidden"
        data-ai-tab="vibe-meter"
      >
        <section
          data-tile-id="vibe"
          className={`flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden m-2 ${
            focusedTile === 'vibe' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          aria-label="Vibe Meter"
          data-ai-widget="vibe-meter"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">VIBE METER</span>
            <button
              onClick={() => toggleMaximize('vibe')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <VibeMeterWidget market={selectedMarket} />
          </div>
        </section>
      </TabsContent>

      {/* Portfolio Tab */}
      <TabsContent
        value="portfolio"
        className="flex-1 flex flex-col gap-2 p-2 mt-0 overflow-hidden"
        data-ai-tab="portfolio"
      >
        {/* Positions Panel - 60% height */}
        <section
          data-tile-id="positions"
          className={`flex flex-col bg-card border border-border rounded-lg overflow-hidden ${
            focusedTile === 'positions' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          style={{ height: '60%' }}
          aria-label="Trading Positions"
          data-ai-widget="positions"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">POSITIONS</span>
            <button
              onClick={() => toggleMaximize('positions')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize (Shift+4)"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PositionsPanel market={selectedMarket} />
          </div>
        </section>

        {/* Performance Widget - 40% height */}
        <section
          data-tile-id="performance"
          className={`flex flex-col bg-card border border-border rounded-lg overflow-hidden ${
            focusedTile === 'performance' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          style={{ height: '40%' }}
          aria-label="Performance Metrics"
          data-ai-widget="performance"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">PERFORMANCE</span>
            <button
              onClick={() => toggleMaximize('performance')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PerformanceWidget market={selectedMarket} />
          </div>
        </section>
      </TabsContent>

      {/* AI Assistant Tab */}
      <TabsContent
        value="ai"
        className="flex-1 flex flex-col mt-0 overflow-hidden"
        data-ai-tab="ai-assistant"
      >
        <section
          data-tile-id="aichat"
          className={`flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden m-2 ${
            focusedTile === 'aichat' ? 'ring-2 ring-primary ring-inset' : ''
          }`}
          aria-label="AI Trading Assistant"
          data-ai-widget="ai-chat"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">AI TRADING ASSISTANT</span>
            <button
              onClick={() => toggleMaximize('aichat')}
              className="p-1 hover:bg-border rounded transition-colors"
              title="Maximize (C)"
            >
              <ChevronUp size={14} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EnhancedAIChatWidget
              market={selectedMarket}
              walletConnected={walletConnected}
              onTradeExecute={onTradeExecute}
              marketData={marketData}
            />
          </div>
        </section>
      </TabsContent>
    </Tabs>
  );
}
