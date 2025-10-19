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
  isMaximized: boolean;
}

type TileId = 'screener' | 'chart' | 'controls' | 'orderbook' | 'trades' | 'positions';

export default function TradingTerminalView({ settings }: TradingTerminalViewProps) {
  const [selectedMarket, setSelectedMarket] = useState('SOL/USDC');
  const [isLoading, setIsLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [screenerExpanded, setScreenerExpanded] = useState(false);
  const [maximizedTile, setMaximizedTile] = useState<TileId | null>(null);
  const [focusedTile, setFocusedTile] = useState<TileId | null>(null);
  const [sections, setSections] = useState<Section[]>([
    { id: 'chart', name: 'Chart', isExpanded: true, isMaximized: false },
    { id: 'orderbook', name: 'Order Book', isExpanded: true, isMaximized: false },
    { id: 'trades', name: 'Recent Trades', isExpanded: true, isMaximized: false },
    { id: 'positions', name: 'Positions', isExpanded: true, isMaximized: false },
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

      // Maximize/restore tiles with Shift+number
      if (e.shiftKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const sectionIndex = parseInt(e.key) - 1;
        if (sectionIndex < sections.length) {
          toggleMaximize(sections[sectionIndex].id as TileId);
        }
      }

      // Maximize chart with 'M' key
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMaximize('chart');
      }

      // Toggle screener with 'S' key
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setScreenerExpanded(!screenerExpanded);
      }

      // Focus navigation with arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        navigateTiles(e.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown');
      }

      // Restore all with Escape
      if (e.key === 'Escape') {
        if (maximizedTile) {
          setMaximizedTile(null);
        } else if (showShortcuts) {
          setShowShortcuts(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sections, showShortcuts, screenerExpanded, maximizedTile]);

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
    ));
  };

  const toggleMaximize = (tileId: TileId) => {
    if (maximizedTile === tileId) {
      setMaximizedTile(null);
    } else {
      setMaximizedTile(tileId);
      setFocusedTile(tileId);
    }
  };

  const navigateTiles = (direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') => {
    const tiles: TileId[] = ['screener', 'chart', 'orderbook', 'trades', 'positions', 'controls'];
    const currentIndex = focusedTile ? tiles.indexOf(focusedTile) : 0;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % tiles.length;
        break;
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + tiles.length) % tiles.length;
        break;
      case 'ArrowDown':
        newIndex = Math.min(currentIndex + 2, tiles.length - 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(currentIndex - 2, 0);
        break;
    }
    
    setFocusedTile(tiles[newIndex]);
    // Highlight the focused tile
    const element = document.querySelector(`[data-tile-id="${tiles[newIndex]}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
      <header className="trading-header flex items-center justify-between px-4 py-1.5 bg-card border-b border-border h-12 z-10">
        <h1 className="text-base font-bold text-primary">Trading Terminal</h1>
        <MarketStats market={selectedMarket} />
      </header>

      {/* Main Terminal Layout - Fixed Height with Maximized Tile Support */}
      <div className="trading-content flex-1 flex overflow-hidden relative" style={{ height: 'calc(100vh - 3rem)' }}>
        {/* Maximized Tile Overlay */}
        {maximizedTile && (
          <div className="absolute inset-0 z-50 bg-background flex flex-col">
            {maximizedTile === 'screener' && (
              <div className="flex-1 flex" data-tile-id="screener">
                <MarketScreener
                  selectedMarket={selectedMarket}
                  onMarketChange={setSelectedMarket}
                  isExpanded={true}
                  onExpandChange={setScreenerExpanded}
                />
                <button
                  onClick={() => setMaximizedTile(null)}
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
                    onClick={() => setMaximizedTile(null)}
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
                    onClick={() => setMaximizedTile(null)}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or Shift+2)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <OrderBook market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'trades' && (
              <div className="flex-1 flex flex-col" data-tile-id="trades">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">RECENT TRADES</span>
                  <button
                    onClick={() => setMaximizedTile(null)}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc or Shift+3)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <TradeHistory market={selectedMarket} />
                </div>
              </div>
            )}
            {maximizedTile === 'positions' && (
              <div className="flex-1 flex flex-col" data-tile-id="positions">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-semibold text-primary">POSITIONS</span>
                  <button
                    onClick={() => setMaximizedTile(null)}
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
                    onClick={() => setMaximizedTile(null)}
                    className="p-1 hover:bg-border rounded"
                    title="Restore (Esc)"
                  >
                    <ChevronDown size={16} className="text-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <TradingControls market={selectedMarket} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Normal Layout (hidden when tile is maximized) */}
        {!maximizedTile && (
          <>
            {/* Left Panel - Market Screener */}
            <div 
              data-tile-id="screener"
              className={`transition-all duration-200 ${focusedTile === 'screener' ? 'ring-2 ring-primary ring-inset' : ''}`}
            >
              <MarketScreener
                selectedMarket={selectedMarket}
                onMarketChange={setSelectedMarket}
                isExpanded={screenerExpanded}
                onExpandChange={setScreenerExpanded}
              />
            </div>

            {/* Center Panel - Chart and Trading Controls - Fixed to fit */}
            <div className="chart-panel flex-1 flex flex-col border-r border-border min-w-0 overflow-hidden">
              {/* Chart Section - Takes remaining space */}
              <section 
                data-tile-id="chart"
                className={`chart-section flex flex-col ${isSectionExpanded('chart') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'chart' ? 'ring-2 ring-primary ring-inset' : ''}`}
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
                  <div className="flex items-center gap-1">
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
                        <ChevronUp size={14} className="text-foreground" />
                      ) : (
                        <ChevronDown size={14} className="text-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                {isSectionExpanded('chart') && (
                  <div id="chart-content" className="flex-1 min-h-0 overflow-hidden">
                    <TradingChart market={selectedMarket} />
                  </div>
                )}
              </section>

              {/* Trading Controls - Fixed Height */}
              <div 
                data-tile-id="controls"
                className={`trading-controls-section bg-background border-t border-border overflow-auto ${focusedTile === 'controls' ? 'ring-2 ring-primary ring-inset' : ''}`}
                style={{ height: '200px' }}
              >
                <div className="flex items-center justify-between px-4 py-1.5 bg-card border-b border-border">
                  <span className="text-xs font-semibold text-primary">TRADING CONTROLS</span>
                  <button
                    onClick={() => toggleMaximize('controls')}
                    className="p-1 hover:bg-border rounded"
                    title="Maximize"
                  >
                    <ChevronUp size={14} className="text-foreground" />
                  </button>
                </div>
                <TradingControls market={selectedMarket} />
              </div>
            </div>

            {/* Right Panel - Order Book, Trades, and Positions - Fixed Width */}
            <aside className="right-panel w-80 flex flex-col bg-background overflow-hidden" aria-label="Market Data">
              {/* Order Book Section */}
              <section 
                data-tile-id="orderbook"
                className={`orderbook-section flex flex-col border-b border-border ${isSectionExpanded('orderbook') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'orderbook' ? 'ring-2 ring-primary ring-inset' : ''}`}
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
                        <ChevronUp size={14} className="text-foreground" />
                      ) : (
                        <ChevronDown size={14} className="text-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                {isSectionExpanded('orderbook') && (
                  <div id="orderbook-content" className="flex-1 min-h-0 overflow-hidden">
                    <OrderBook market={selectedMarket} />
                  </div>
                )}
              </section>

              {/* Recent Trades Section */}
              <section 
                data-tile-id="trades"
                className={`trades-section flex flex-col border-b border-border ${isSectionExpanded('trades') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'trades' ? 'ring-2 ring-primary ring-inset' : ''}`}
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
                        <ChevronUp size={14} className="text-foreground" />
                      ) : (
                        <ChevronDown size={14} className="text-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                {isSectionExpanded('trades') && (
                  <div id="trades-content" className="flex-1 min-h-0 overflow-hidden">
                    <TradeHistory market={selectedMarket} />
              </div>
            )}
          </section>

          {/* Positions Section */}
          <section 
            data-tile-id="positions"
            className={`positions-section flex flex-col ${isSectionExpanded('positions') ? 'flex-1' : 'h-10'} transition-all duration-300 overflow-hidden ${focusedTile === 'positions' ? 'ring-2 ring-primary ring-inset' : ''}`}
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
                    <ChevronUp size={14} className="text-foreground" />
                  ) : (
                    <ChevronDown size={14} className="text-foreground" />
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
        </aside>
      </>
    )}
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
            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              <strong>Tip:</strong> Shortcuts work when not typing in an input field. Use arrow keys to navigate between tiles with visual focus indicators.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
