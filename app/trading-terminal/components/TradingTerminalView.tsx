'use client';

import React, { useState, useEffect } from 'react';
import TradingChart from './TradingChart';
import MarketScreener from './MarketScreener';
import OrderBook from './OrderBook';
import TradeHistory from './TradeHistory';
import TradingControls from './TradingControls';
import PositionsPanel from './PositionsPanel';
import MarketStats from './MarketStats';
import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react';

interface TradingTerminalViewProps {
  settings?: any;
}

interface Section {
  id: string;
  name: string;
  isExpanded: boolean;
}

export default function TradingTerminalView({ settings }: TradingTerminalViewProps) {
  const [selectedMarket, setSelectedMarket] = useState('SOL/USDC');
  const [isLoading, setIsLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [screenerExpanded, setScreenerExpanded] = useState(false);
  const [sections, setSections] = useState<Section[]>([
    { id: 'chart', name: 'Chart', isExpanded: true },
    { id: 'orderbook', name: 'Order Book', isExpanded: true },
    { id: 'trades', name: 'Recent Trades', isExpanded: true },
    { id: 'positions', name: 'Positions', isExpanded: true },
  ]);

  // Simulate initial data loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts for professional traders
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Show keyboard shortcuts help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Toggle sections with number keys (1-4)
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const sectionIndex = parseInt(e.key) - 1;
        if (sectionIndex < sections.length) {
          toggleSection(sections[sectionIndex].id);
        }
      }

      // Toggle screener with 'S' key
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setScreenerExpanded(!screenerExpanded);
      }

      // Escape to close shortcuts modal
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sections, showShortcuts, screenerExpanded]);

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
    ));
  };

  const isSectionExpanded = (sectionId: string) => {
    return sections.find(s => s.id === sectionId)?.isExpanded ?? true;
  };

  if (isLoading) {
    return (
      <div className="trading-terminal h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading Trading Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-terminal h-screen flex flex-col bg-background text-foreground overflow-hidden" role="main" aria-label="Trading Terminal">
      {/* Compact Header */}
      <header className="trading-header flex items-center justify-between px-4 py-1.5 bg-card border-b border-border h-12">
        <h1 className="text-base font-bold text-primary">Trading Terminal</h1>
        <MarketStats market={selectedMarket} />
      </header>

      {/* Main Terminal Layout - Fixed Height */}
      <div className="trading-content flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 3rem)' }}>
        {/* Left Panel - Market Screener */}
        <MarketScreener
          selectedMarket={selectedMarket}
          onMarketChange={setSelectedMarket}
          isExpanded={screenerExpanded}
          onExpandChange={setScreenerExpanded}
        />

        {/* Center Panel - Chart and Trading Controls - Fixed to fit */}
        <div className="chart-panel flex-1 flex flex-col border-r border-border min-w-0 overflow-hidden">
          {/* Chart Section - Takes remaining space */}
          <section 
            className={`chart-section flex flex-col ${isSectionExpanded('chart') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden`}
            aria-label="Price Chart"
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
              <span className="text-xs font-semibold text-primary">CHART</span>
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('chart') ? 'Collapse chart' : 'Expand chart'}
              >
                {isSectionExpanded('chart') ? (
                  <ChevronUp size={14} className="text-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('chart') && (
              <div id="chart-content" className="flex-1 min-h-0 overflow-hidden">
                <TradingChart market={selectedMarket} />
              </div>
            )}
          </section>

          {/* Trading Controls - Fixed Height */}
          <div className="trading-controls-section bg-background border-t border-border" style={{ height: '200px' }}>
            <TradingControls market={selectedMarket} />
          </div>
        </div>

        {/* Right Panel - Order Book, Trades, and Positions - Fixed Width */}
        <aside className="right-panel w-80 flex flex-col bg-background overflow-hidden" aria-label="Market Data">
          {/* Order Book Section */}
          <section 
            className={`orderbook-section flex flex-col border-b border-border ${isSectionExpanded('orderbook') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden`}
            aria-label="Order Book"
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted"
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
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('orderbook') ? 'Collapse order book' : 'Expand order book'}
              >
                {isSectionExpanded('orderbook') ? (
                  <ChevronUp size={14} className="text-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('orderbook') && (
              <div id="orderbook-content" className="flex-1 min-h-0 overflow-hidden">
                <OrderBook market={selectedMarket} />
              </div>
            )}
          </section>

          {/* Recent Trades Section */}
          <section 
            className={`trades-section flex flex-col border-b border-border ${isSectionExpanded('trades') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden`}
            aria-label="Recent Trades"
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted"
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
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('trades') ? 'Collapse trades' : 'Expand trades'}
              >
                {isSectionExpanded('trades') ? (
                  <ChevronUp size={14} className="text-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('trades') && (
              <div id="trades-content" className="flex-1 min-h-0 overflow-hidden">
                <TradeHistory market={selectedMarket} />
              </div>
            )}
          </section>

          {/* Positions Section */}
          <section 
            className={`positions-section flex flex-col ${isSectionExpanded('positions') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden`}
            aria-label="Trading Positions"
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-1.5 bg-card cursor-pointer hover:bg-muted"
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
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('positions') ? 'Collapse positions' : 'Expand positions'}
              >
                {isSectionExpanded('positions') ? (
                  <ChevronUp size={14} className="text-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('positions') && (
              <div id="positions-content" className="flex-1 min-h-0 overflow-hidden">
                <PositionsPanel market={selectedMarket} />
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Keyboard Shortcuts Button */}
      <button
        className="fixed bottom-4 right-4 p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors z-50"
        onClick={() => setShowShortcuts(!showShortcuts)}
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={20} className="text-primary" />
      </button>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
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
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Chart</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">1</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Order Book</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">2</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Recent Trades</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">3</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Positions</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">4</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Screener</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">S</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Show this help</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">?</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Close dialog</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">Esc</kbd>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              Tip: Shortcuts work when not typing in an input field
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

  ]);

  // Simulate initial data loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts for professional traders
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Show keyboard shortcuts help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Toggle sections with number keys (1-4)
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const sectionIndex = parseInt(e.key) - 1;
        if (sectionIndex < sections.length) {
          toggleSection(sections[sectionIndex].id);
        }
      }

      // Escape to close shortcuts modal
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sections, showShortcuts]);

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
    ));
  };

  const isSectionExpanded = (sectionId: string) => {
    return sections.find(s => s.id === sectionId)?.isExpanded ?? true;
  };

  if (isLoading) {
    return (
      <div className="trading-terminal h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading Trading Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-terminal h-screen flex flex-col bg-background text-foreground overflow-hidden" role="main" aria-label="Trading Terminal">
      {/* Header with Market Selector */}
      <header className="trading-header flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-primary">Trading Terminal</h1>
          <MarketSelector 
            selectedMarket={selectedMarket} 
            onMarketChange={setSelectedMarket}
          />
        </div>
        <MarketStats market={selectedMarket} />
      </header>

      {/* Main Terminal Layout */}
      <div className="trading-content flex-1 flex overflow-hidden">
        {/* Left Panel - Chart and Trading Controls */}
        <div className="chart-panel flex-1 flex flex-col border-r border-border min-w-0">
          {/* Chart Section */}
          <section 
            className={`chart-section flex flex-col border-b border-border ${isSectionExpanded('chart') ? 'flex-1' : 'h-10'} transition-all duration-300`}
            aria-label="Price Chart"
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
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
              <span className="text-sm font-semibold text-primary">CHART</span>
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('chart') ? 'Collapse chart' : 'Expand chart'}
              >
                {isSectionExpanded('chart') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('chart') && (
              <div id="chart-content" className="flex-1 min-h-0">
                <TradingChart market={selectedMarket} />
              </div>
            )}
          </section>

          {/* Trading Controls */}
          <div className="trading-controls-section bg-background">
            <TradingControls market={selectedMarket} />
          </div>
        </div>

        {/* Right Panel - Order Book, Trades, and Positions */}
        <aside className="right-panel w-80 flex flex-col bg-background overflow-hidden" aria-label="Market Data">
          {/* Order Book Section */}
          <section 
            className={`orderbook-section flex flex-col border-b border-border ${isSectionExpanded('orderbook') ? 'flex-1' : 'h-10'} transition-all duration-300`}
            aria-label="Order Book"
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
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
              <span className="text-sm font-semibold text-primary">ORDER BOOK</span>
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('orderbook') ? 'Collapse order book' : 'Expand order book'}
              >
                {isSectionExpanded('orderbook') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('orderbook') && (
              <div id="orderbook-content" className="flex-1 min-h-0 overflow-hidden">
                <OrderBook market={selectedMarket} />
              </div>
            )}
          </section>
              onClick={() => toggleSection('orderbook')}
            >
              <span className="text-sm font-semibold text-primary">ORDER BOOK</span>
              <button className="p-1 hover:bg-border rounded">
                {isSectionExpanded('orderbook') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('orderbook') && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <OrderBook market={selectedMarket} />
              </div>
            )}
          </div>

          {/* Trade History Section */}
          <div className={`trades-section flex flex-col border-b border-border ${isSectionExpanded('trades') ? 'flex-1' : 'h-10'} transition-all duration-300`}>
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
              onClick={() => toggleSection('trades')}
            >
              <span className="text-sm font-semibold text-primary">RECENT TRADES</span>
              <button className="p-1 hover:bg-border rounded">
                {isSectionExpanded('trades') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('trades') && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <TradeHistory market={selectedMarket} />
              </div>
            )}
          </div>

          {/* Positions Section */}
          <section 
            className={`positions-section flex flex-col ${isSectionExpanded('positions') ? 'flex-1' : 'h-10'} transition-all duration-300`}
            aria-label="Trading Positions"
          >
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
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
              <span className="text-sm font-semibold text-primary">POSITIONS</span>
              <button 
                className="p-1 hover:bg-border rounded"
                aria-label={isSectionExpanded('positions') ? 'Collapse positions' : 'Expand positions'}
              >
                {isSectionExpanded('positions') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('positions') && (
              <div id="positions-content" className="flex-1 min-h-0 overflow-hidden">
                <PositionsPanel market={selectedMarket} />
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Keyboard Shortcuts Button */}
      <button
        className="fixed bottom-4 right-4 p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors z-50"
        onClick={() => setShowShortcuts(!showShortcuts)}
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={20} className="text-primary" />
      </button>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
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
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Chart</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">1</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Order Book</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">2</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Recent Trades</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">3</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Toggle Positions</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">4</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Show this help</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">?</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Close dialog</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-primary">Esc</kbd>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              Tip: Shortcuts work when not typing in an input field
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
