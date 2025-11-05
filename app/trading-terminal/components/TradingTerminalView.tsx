'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Hooks
import { useTradingTerminal } from '@/components/hooks/trading/useTradingTerminal';
import { useKeyboardShortcuts } from '@/components/hooks/trading/useKeyboardShortcuts';
import { useMarketData } from '@/components/hooks/trading/useMarketData';
import { useWalletConnection } from '@/components/hooks/trading/useWalletConnection';

// Dynamically import components with no SSR to avoid hydration issues
const TradingChart = dynamic(() => import('./TradingChart'), { ssr: false });
const MarketScreener = dynamic(() => import('./MarketScreener'), { ssr: false });
const OrderBook = dynamic(() => import('./OrderBook'), { ssr: false });
const TradeHistory = dynamic(() => import('./TradeHistory'), { ssr: false });
const TradingControls = dynamic(() => import('./TradingControls'), { ssr: false });
const PositionsPanel = dynamic(() => import('./PositionsPanel'), { ssr: false });
const MarketStats = dynamic(() => import('./MarketStats'), { ssr: false });
const MarketDepthWidget = dynamic(() => import('./MarketDepthWidget'), { ssr: false });
const MarketNewsWidget = dynamic(() => import('./MarketNewsWidget'), { ssr: false });
const WatchlistWidget = dynamic(() => import('./WatchlistWidget'), { ssr: false });
const PerformanceWidget = dynamic(() => import('./PerformanceWidget'), { ssr: false });
const EnhancedAIChatWidget = dynamic(() => import('./EnhancedAIChatWidget'), { ssr: false });
import { ChevronDown, ChevronUp, Keyboard, Settings, HelpCircle } from 'lucide-react';
import { DemoModeBanner } from '@/components/ui/demo-mode-banner';
import { KeyboardShortcutsSettings } from '@/components/KeyboardShortcutsSettings';
import { TutorialTour, useTutorial } from '@/components/TutorialTour';
import { TRADING_TERMINAL_TUTORIAL_STEPS, TUTORIAL_STORAGE_KEY } from '@/lib/trading-terminal-tutorial';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function TradingTerminalView() {
  // Use modular hooks for state management
  const terminal = useTradingTerminal('SOL/USDC');
  const marketData = useMarketData(terminal.selectedMarket);
  const wallet = useWalletConnection();
  
  // Settings modal state
  const [showSettings, setShowSettings] = React.useState(false);
  
  // Tutorial state
  const { showTutorial, startTutorial, closeTutorial } = useTutorial(TUTORIAL_STORAGE_KEY);

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    maximizedTile: terminal.maximizedTile,
    showShortcuts: terminal.showShortcuts,
    screenerExpanded: terminal.screenerExpanded,
    sections: terminal.sections,
    setShowShortcuts: terminal.setShowShortcuts,
    toggleSection: terminal.toggleSection,
    toggleMaximize: terminal.toggleMaximize,
    setScreenerExpanded: terminal.setScreenerExpanded,
    navigateTiles: terminal.navigateTiles,
  });

  // Destructure for easier access in JSX
  const {
    selectedMarket,
    setSelectedMarket,
    maximizedTile,
    focusedTile,
    screenerExpanded,
    setScreenerExpanded,
    showShortcuts,
    setShowShortcuts,
    isLoading,
    aiChatMinimized,
    setAIChatMinimized,
    toggleSection,
    toggleMaximize,
    isSectionExpanded,
    handleTradeExecute,
  } = terminal;

  // Helper to restore all tiles (close maximized view)
  const restoreAllTiles = () => {
    if (maximizedTile) {
      toggleMaximize(maximizedTile);
    }
  };

  // Wallet state
  const walletConnected = wallet.isConnected;

  // Extract loading state from marketData
  const isLoadingMarketData = marketData.isLoading;

  // Suppress unused variable warnings (will be used when integrating real data)
  void focusedTile;

  if (isLoading) {
    return (
      <div className="trading-terminal h-full w-full flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading Trading Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="trading-terminal h-full w-full flex flex-col bg-background text-foreground overflow-hidden" 
      role="main" 
      aria-label="Trading Terminal"
      data-ai-app="trading-terminal"
      data-ai-version="1.0"
      data-ai-features="charts,orderbook,trading,screener,widgets,keyboard-navigation,ai-chat-assistant"
    >
      {/* Demo Mode Banner */}
      <DemoModeBanner 
        isDemo={!marketData.isRealData}
        dataSource={marketData.dataSource || 'Mock Data'}
        onRetry={() => window.location.reload()}
      />

      {/* Compact Header */}
      <header 
        className="trading-header flex items-center justify-between px-4 py-1.5 bg-card border-b border-border flex-shrink-0 h-12 z-10"
        data-ai-section="header"
        data-ai-current-market={selectedMarket}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-primary">Trading Terminal</h1>
          {/* Data Source Indicator */}
          {marketData.dataSource && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border"
                 style={{
                   backgroundColor: marketData.isRealData ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                   borderColor: marketData.isRealData ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                   color: marketData.isRealData ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                 }}
                 title={marketData.dataSource}>
              <span className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: marketData.isRealData ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                    }}></span>
              <span className="font-medium">
                {marketData.isRealData ? 'Live Data' : 'Demo Mode'}
              </span>
            </div>
          )}
        </div>
        <MarketStats market={selectedMarket} />
      </header>

      {/* Main Terminal Layout - Flexible Height with Maximized Tile Support */}
      <div className="trading-content flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0">
        {/* Maximized Tile Overlay */}
        {maximizedTile && (
          <div className="absolute inset-0 z-50 bg-background flex flex-col overflow-hidden">
            {maximizedTile === 'screener' && (
              <div className="flex-1 flex" data-tile-id="screener">
                <MarketScreener
                  selectedMarket={selectedMarket}
                  onMarketChange={setSelectedMarket}
                  isExpanded={true}
                  onExpandChange={setScreenerExpanded}
                />
                <button
                  onClick={restoreAllTiles}
                  className="absolute top-2 right-2 p-2 bg-card border border-border rounded hover:bg-muted"
                  title="Restore (Esc)"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
            {maximizedTile === 'chart' && (
              <div className="flex-1 flex flex-col" data-tile-id="chart">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">CHART</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or Shift+1)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <TradingChart market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'orderbook' && (
              <div className="flex-1 flex flex-col" data-tile-id="orderbook">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">ORDER BOOK</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or Shift+2)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <OrderBook market={selectedMarket} isLoading={isLoadingMarketData} />
                </div>
              </div>
            )}
            {maximizedTile === 'trades' && (
              <div className="flex-1 flex flex-col" data-tile-id="trades">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">RECENT TRADES</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or Shift+3)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <TradeHistory market={selectedMarket} isLoading={isLoadingMarketData} />
                </div>
              </div>
            )}
            {maximizedTile === 'positions' && (
              <div className="flex-1 flex flex-col" data-tile-id="positions">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">POSITIONS</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or Shift+4)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PositionsPanel market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'controls' && (
              <div className="flex-1 flex flex-col" data-tile-id="controls">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">TRADING CONTROLS</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <TradingControls market={selectedMarket} walletConnected={walletConnected} />
                </div>
              </div>
            )}
            {maximizedTile === 'watchlist' && (
              <div className="flex-1 flex flex-col" data-tile-id="watchlist">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">WATCHLIST</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <WatchlistWidget onMarketChange={setSelectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'performance' && (
              <div className="flex-1 flex flex-col" data-tile-id="performance">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">PERFORMANCE</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PerformanceWidget market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'depth' && (
              <div className="flex-1 flex flex-col" data-tile-id="depth">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">MARKET DEPTH</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <MarketDepthWidget market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'news' && (
              <div className="flex-1 flex flex-col" data-tile-id="news">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">MARKET NEWS</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <MarketNewsWidget market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'aichat' && (
              <div className="flex-1 flex flex-col" data-tile-id="aichat">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">AI TRADING ASSISTANT</span>
                  <button
                    onClick={restoreAllTiles}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or C)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <EnhancedAIChatWidget 
                    market={selectedMarket} 
                    walletConnected={walletConnected}
                    onTradeExecute={handleTradeExecute}
                    marketData={marketData}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Normal Layout (hidden when tile is maximized) */}
        {!maximizedTile && (
          <>
            {/* Left Panel - Market Screener (70%) + Watchlist (30%) */}
            <div className="flex flex-col border-r border-border flex-shrink-0 overflow-hidden w-full lg:w-80 hidden md:flex">
              {/* Market Screener - 70% */}
              <div 
                data-tile-id="screener"
                className={`overflow-hidden ${focusedTile === 'screener' ? 'ring-2 ring-primary ring-inset' : ''}`}
                style={{ height: '70%' }}
                data-ai-widget="market-screener"
                data-ai-expanded={screenerExpanded}
                data-ai-current-market={selectedMarket}
              >
                <MarketScreener
                  selectedMarket={selectedMarket}
                  onMarketChange={setSelectedMarket}
                  isExpanded={screenerExpanded}
                  onExpandChange={setScreenerExpanded}
                />
              </div>

              {/* Watchlist Widget - 30% */}
              <section 
                data-tile-id="watchlist"
                className={`watchlist-section flex flex-col overflow-hidden border-t border-border ${focusedTile === 'watchlist' ? 'ring-2 ring-primary ring-inset' : ''}`}
                style={{ height: isSectionExpanded('watchlist') ? '30%' : 'auto' }}
                aria-label="Watchlist"
                data-ai-widget="watchlist"
              >
                <div 
                  className="section-header flex items-center justify-between px-3 py-1.5 bg-card cursor-pointer hover:bg-muted"
                  onClick={() => toggleSection('watchlist')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="text-xs font-semibold text-primary">WATCHLIST</span>
                  <button className="p-1 hover:bg-border rounded">
                    {isSectionExpanded('watchlist') ? (
                      <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                    ) : (
                      <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                    )}
                  </button>
                </div>
                {isSectionExpanded('watchlist') && (
                  <div id="watchlist-content" className="flex-1 min-h-0 overflow-auto p-2">
                    <WatchlistWidget onMarketChange={setSelectedMarket} isLoading={isLoadingMarketData} />
                  </div>
                )}
              </section>
            </div>

            {/* Center Panel - Chart and Widgets Grid */}
            <div className="chart-panel flex-1 flex flex-col border-r border-border min-w-0 overflow-hidden w-full md:w-auto">
              {/* Top Row: Chart (35% height) - Balanced for quick analysis */}
              <div className="flex border-b border-border flex-1 min-h-0" style={{ flexBasis: '35%' }}>
                {/* Chart Section */}
                <section 
                  data-tile-id="chart"
                  className={`chart-section flex flex-col flex-1 ${isSectionExpanded('chart') ? '' : 'h-10'} transition-all duration-300 overflow-hidden border-r border-border ${focusedTile === 'chart' ? 'ring-2 ring-primary ring-inset' : ''}`}
                  aria-label="Price Chart"
                  data-ai-widget="trading-chart"
                  data-ai-market={selectedMarket}
                >
                  <div 
                    className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted border-b border-border"
                    onClick={() => toggleSection('chart')}
                    role="button"
                    aria-expanded={isSectionExpanded('chart')}
                    aria-controls="chart-content"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSection('chart');
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-primary flex-shrink-0">CHART</span>
                      {isSectionExpanded('chart') && (
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <PerformanceWidget market={selectedMarket} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMaximize('chart');
                        }}
                        className="p-1 hover:bg-border rounded"
                        title="Maximize (M or Shift+1)"
                      >
                        <ChevronUp size={14} className="text-foreground" />
                      </button>
                      <button 
                        className="p-1 hover:bg-border rounded"
                        aria-label={isSectionExpanded('chart') ? 'Collapse chart' : 'Expand chart'}
                      >
                        {isSectionExpanded('chart') ? (
                          <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                        ) : (
                          <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {isSectionExpanded('chart') && (
                    <div id="chart-content" className="flex-1 min-h-0 overflow-hidden">
                      <TradingChart market={selectedMarket} isLoading={isLoadingMarketData} />
                    </div>
                  )}
                </section>

                {/* Right side widgets column - Order Book */}
                <div className="w-full md:w-64 flex flex-col overflow-hidden">
                  {/* Order Book Section */}
                  <section 
                    data-tile-id="orderbook"
                    className={`orderbook-section flex flex-col ${isSectionExpanded('orderbook') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'orderbook' ? 'ring-2 ring-primary ring-inset' : ''}`}
                    aria-label="Order Book"
                    data-ai-widget="order-book"
                    data-ai-market={selectedMarket}
                  >
                    <div 
                      className="section-header flex items-center justify-between px-3 py-1.5 bg-card cursor-pointer hover:bg-muted border-b border-border"
                      onClick={() => toggleSection('orderbook')}
                      role="button"
                      aria-expanded={isSectionExpanded('orderbook')}
                      aria-controls="orderbook-content"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleSection('orderbook');
                        }
                      }}
                    >
                      <span className="text-xs font-semibold text-primary">ORDER BOOK</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMaximize('orderbook');
                          }}
                          className="p-1 hover:bg-border rounded"
                          title="Maximize (Shift+2)"
                        >
                          <ChevronUp size={14} className="text-foreground" />
                        </button>
                        <button 
                          className="p-1 hover:bg-border rounded"
                          aria-label={isSectionExpanded('orderbook') ? 'Collapse order book' : 'Expand order book'}
                        >
                          {isSectionExpanded('orderbook') ? (
                            <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                          ) : (
                            <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                          )}
                        </button>
                      </div>
                    </div>
                    {isSectionExpanded('orderbook') && (
                      <div id="orderbook-content" className="flex-1 min-h-0 overflow-hidden">
                        <OrderBook market={selectedMarket} isLoading={isLoadingMarketData} />
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>

            {/* Right Panel - Market Depth, Trades, News, Positions, and AI Chat */}
            <aside className="right-panel flex-shrink-0 flex flex-col bg-background overflow-hidden min-h-0 w-full lg:w-96 xl:w-[480px] h-full" aria-label="Market Data" data-ai-section="market-data-panel">
              {/* Market Depth Section */}
              <section 
                data-tile-id="depth"
                className={`depth-section flex flex-col border-b border-border ${isSectionExpanded('depth') ? 'flex-1 min-h-0' : 'flex-shrink-0 h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'depth' ? 'ring-2 ring-primary ring-inset' : ''}`}
                aria-label="Market Depth"
                data-ai-widget="market-depth"
                data-ai-market={selectedMarket}
              >
                <div 
                  className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted transition-colors duration-150"
                  onClick={() => toggleSection('depth')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="text-xs font-semibold text-primary">MARKET DEPTH</span>
                  <button className="p-1 hover:bg-border rounded">
                    {isSectionExpanded('depth') ? (
                      <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                    ) : (
                      <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                    )}
                  </button>
                </div>
                {isSectionExpanded('depth') && (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <MarketDepthWidget market={selectedMarket} />
                  </div>
                )}
              </section>

              {/* Recent Trades Section */}
              <section 
                data-tile-id="trades"
                className={`trades-section flex flex-col border-b border-border ${isSectionExpanded('trades') ? 'flex-1 min-h-0' : 'flex-shrink-0 h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'trades' ? 'ring-2 ring-primary ring-inset' : ''}`}
                aria-label="Recent Trades"
                data-ai-widget="recent-trades"
                data-ai-market={selectedMarket}
              >
                <div 
                  className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted transition-colors duration-150"
                  onClick={() => toggleSection('trades')}
                  role="button"
                  aria-expanded={isSectionExpanded('trades')}
                  aria-controls="trades-content"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSection('trades');
                    }
                  }}
                >
                  <span className="text-xs font-semibold text-primary">RECENT TRADES</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMaximize('trades');
                      }}
                      className="p-1 hover:bg-border rounded"
                      title="Maximize (Shift+3)"
                    >
                      <ChevronUp size={14} className="text-foreground" />
                    </button>
                    <button 
                      className="p-1 hover:bg-border rounded"
                      aria-label={isSectionExpanded('trades') ? 'Collapse trades' : 'Expand trades'}
                    >
                      {isSectionExpanded('trades') ? (
                        <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                      ) : (
                        <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                      )}
                    </button>
                  </div>
                </div>
                {isSectionExpanded('trades') && (
                  <div id="trades-content" className="flex-1 min-h-0 overflow-hidden">
                    <TradeHistory market={selectedMarket} isLoading={isLoadingMarketData} />
                  </div>
                )}
              </section>

          {/* Market News Section */}
          <section 
            data-tile-id="news"
            className={`news-section flex flex-col border-b border-border ${isSectionExpanded('news') ? 'flex-1 min-h-0' : 'flex-shrink-0 h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'news' ? 'ring-2 ring-primary ring-inset' : ''}`}
            aria-label="Market News"
            data-ai-widget="market-news"
            data-ai-market={selectedMarket}
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted transition-colors duration-150"
              onClick={() => toggleSection('news')}
              role="button"
              tabIndex={0}
            >
              <span className="text-xs font-semibold text-primary">MARKET NEWS</span>
              <button className="p-1 hover:bg-border rounded">
                {isSectionExpanded('news') ? (
                  <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                ) : (
                  <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                )}
              </button>
            </div>
            {isSectionExpanded('news') && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <MarketNewsWidget market={selectedMarket} />
              </div>
            )}
          </section>

          {/* Positions Section */}
          <section 
            data-tile-id="positions"
            className={`positions-section flex flex-col ${isSectionExpanded('positions') ? 'flex-1 min-h-0' : 'flex-shrink-0 h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'positions' ? 'ring-2 ring-primary ring-inset' : ''}`}
            aria-label="Trading Positions"
            data-ai-widget="trading-positions"
            data-ai-market={selectedMarket}
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted transition-colors duration-150"
              onClick={() => toggleSection('positions')}
              role="button"
              aria-expanded={isSectionExpanded('positions')}
              aria-controls="positions-content"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection('positions');
                }
              }}
            >
              <span className="text-xs font-semibold text-primary">POSITIONS</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMaximize('positions');
                  }}
                  className="p-1 hover:bg-border rounded"
                  title="Maximize (Shift+4)"
                >
                  <ChevronUp size={14} className="text-foreground" />
                </button>
                <button 
                  className="p-1 hover:bg-border rounded"
                  aria-label={isSectionExpanded('positions') ? 'Collapse positions' : 'Expand positions'}
                >
                  {isSectionExpanded('positions') ? (
                    <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                  ) : (
                    <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                  )}
                </button>
              </div>
            </div>
            {isSectionExpanded('positions') && (
              <div id="positions-content" className="flex-1 min-h-0 overflow-hidden">
                <PositionsPanel market={selectedMarket} />
              </div>
            )}
          </section>

          {/* AI Chat Trading Assistant - Expandable to fill available space */}
          <div 
            data-tile-id="aichat"
            className={`ai-chat-section border-t border-border flex flex-col ${focusedTile === 'aichat' ? 'ring-2 ring-primary ring-inset' : ''} ${aiChatMinimized ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}
            style={!aiChatMinimized ? { minHeight: '300px', maxHeight: '50vh' } : { height: '42px' }}
            data-ai-widget="ai-chat-trading"
            data-ai-market={selectedMarket}
          >
            <div 
              className="flex items-center justify-between px-3 py-2 bg-card border-b border-border cursor-pointer hover:bg-muted transition-colors duration-150 h-[42px] flex-shrink-0"
              onClick={() => setAIChatMinimized(!aiChatMinimized)}
              role="button"
              aria-expanded={!aiChatMinimized}
              title={aiChatMinimized ? 'Expand AI Assistant' : 'Minimize AI Assistant'}
            >
              <span className="text-xs font-semibold text-primary">AI ASSISTANT</span>
              <button 
                className="p-1 hover:bg-border rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  setAIChatMinimized(!aiChatMinimized);
                }}
              >
                {aiChatMinimized ? (
                  <ChevronUp size={14} className="text-foreground transition-transform duration-200" />
                ) : (
                  <ChevronDown size={14} className="text-foreground transition-transform duration-200" />
                )}
              </button>
            </div>
            {!aiChatMinimized && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <EnhancedAIChatWidget 
                  market={selectedMarket} 
                  walletConnected={walletConnected}
                  onTradeExecute={handleTradeExecute}
                  marketData={marketData}
                />
              </div>
            )}
          </div>
        </aside>
      </>
    )}
  </div>

      {/* Trading Controls - Bottom Panel */}
      <div 
        data-tile-id="controls"
        className={`bg-card border-t-2 border-border flex-shrink-0 ${focusedTile === 'controls' ? 'ring-2 ring-primary ring-inset' : ''}`}
        data-ai-widget="trading-controls"
        data-ai-market={selectedMarket}
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <TradingControls market={selectedMarket} walletConnected={walletConnected} />
        </div>
      </div>

      {/* Help Menu */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {/* Tutorial Button */}
        <button
          className="p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors duration-150"
          onClick={startTutorial}
          aria-label="Start tutorial"
          title="Start tutorial"
        >
          <HelpCircle size={20} className="text-primary" />
        </button>
        
        {/* Keyboard Shortcuts Button */}
        <button
          className="p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors duration-150"
          onClick={() => setShowShortcuts(!showShortcuts)}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={20} className="text-primary" />
        </button>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Keyboard Shortcuts</h2>
              <button 
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="col-span-2 text-xs font-semibold text-primary uppercase mb-2">Panel Controls</div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Chart</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">1</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Maximize Chart</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">M / Shift+1</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Order Book</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">2</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Maximize Order Book</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">Shift+2</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Trades</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">3</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Maximize Trades</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">Shift+3</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Positions</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">4</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Maximize Positions</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">Shift+4</kbd>
              </div>
              
              <div className="col-span-2 text-xs font-semibold text-primary uppercase mt-3 mb-2">Navigation</div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Navigate Tiles</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">Arrow Keys</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Screener</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">S</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle AI Chat</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">C</kbd>
              </div>
              
              <div className="col-span-2 text-xs font-semibold text-primary uppercase mt-3 mb-2">General</div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Show Help</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">?</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Restore / Close</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary text-xs">Esc</kbd>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Shortcuts work when not typing in an input field.
              </div>
              <button
                onClick={() => {
                  setShowShortcuts(false);
                  setShowSettings(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors duration-150"
              >
                <Settings size={14} />
                Customize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Settings Modal */}
      <ErrorBoundary componentName="Keyboard Shortcuts Settings">
        <KeyboardShortcutsSettings 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </ErrorBoundary>

      {/* Tutorial Tour */}
      <ErrorBoundary componentName="Tutorial Tour">
        <TutorialTour
          steps={TRADING_TERMINAL_TUTORIAL_STEPS}
          isOpen={showTutorial}
          onClose={closeTutorial}
          storageKey={TUTORIAL_STORAGE_KEY}
        />
      </ErrorBoundary>
    </div>
  );
}
