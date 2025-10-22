/**
 * MobileTradingView
 * 
 * Mobile-optimized trading terminal (< 768px).
 * Features:
 * - Vertical stacked layout
 * - Swipeable tabs for Chart/OrderBook/Trades
 * - Bottom sheet for trading controls
 * - Touch-optimized buttons (44x44px minimum)
 * - Pull-to-refresh for market data
 */

'use client';

import React, { useState } from 'react';
import { useTradingTerminal } from '@/components/hooks/trading/useTradingTerminal';
import { useMarketData } from '@/components/hooks/trading/useMarketData';
import { useWalletConnection } from '@/components/hooks/trading/useWalletConnection';
import { useHorizontalSwipe } from '@/components/hooks/useSwipeGesture';
import dynamic from 'next/dynamic';
import { ChevronDown, Menu, Wallet, TrendingUp } from 'lucide-react';

// Dynamically import heavy components
const TradingChart = dynamic(() => import('./TradingChart'), { ssr: false });
const OrderBook = dynamic(() => import('./OrderBook'), { ssr: false });
const TradeHistory = dynamic(() => import('./TradeHistory'), { ssr: false });
const TradingControls = dynamic(() => import('./TradingControls'), { ssr: false });
const MarketSelector = dynamic(() => import('./MarketSelector'), { ssr: false });

type MobileTab = 'chart' | 'orderbook' | 'trades';

export default function MobileTradingView() {
  const terminal = useTradingTerminal('SOL/USDC');
  const marketData = useMarketData(terminal.selectedMarket);
  const wallet = useWalletConnection();

  const [activeTab, setActiveTab] = useState<MobileTab>('chart');
  const [showTradeSheet, setShowTradeSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMarketSelector, setShowMarketSelector] = useState(false);

  const { selectedMarket, setSelectedMarket } = terminal;

  // Swipe navigation between tabs
  const swipeRef = useHorizontalSwipe<HTMLDivElement>(
    () => {
      // Swipe left - next tab
      if (activeTab === 'chart') setActiveTab('orderbook');
      else if (activeTab === 'orderbook') setActiveTab('trades');
    },
    () => {
      // Swipe right - previous tab
      if (activeTab === 'trades') setActiveTab('orderbook');
      else if (activeTab === 'orderbook') setActiveTab('chart');
    },
    { threshold: 75 }
  );

  // Suppress unused variable warnings
  void marketData;

  const stats = marketData.stats;
  const priceChange = stats.change24h;
  const isPositive = priceChange >= 0;

  return (
    <div className="mobile-trading h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Fixed Header */}
      <header className="flex-shrink-0 bg-card border-b border-border shadow-sm">
        {/* Top Row: Menu, Market, Wallet */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-muted rounded-lg active:bg-muted/80"
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>

          <button
            onClick={() => setShowMarketSelector(true)}
            className="flex-1 mx-4 text-center"
          >
            <div className="font-bold text-lg">{selectedMarket}</div>
            <div className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </button>

          <button
            onClick={() => wallet.isConnected ? wallet.disconnect() : wallet.connect()}
            className={`p-2 rounded-lg ${
              wallet.isConnected 
                ? 'bg-green-500/10 text-green-500' 
                : 'bg-primary/10 text-primary'
            }`}
            aria-label={wallet.isConnected ? 'Disconnect wallet' : 'Connect wallet'}
          >
            <Wallet size={24} />
          </button>
        </div>

        {/* Price Stats Row */}
        <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Price</div>
            <div className="font-bold">${stats.price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">24h High</div>
            <div className="font-bold">${stats.high24h.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">24h Low</div>
            <div className="font-bold">${stats.low24h.toFixed(2)}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-border">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chart'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setActiveTab('orderbook')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'orderbook'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            Order Book
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'trades'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            Trades
          </button>
        </div>
      </header>

      {/* Swipeable Content Area */}
      <div ref={swipeRef} className="flex-1 overflow-hidden relative">
        {activeTab === 'chart' && (
          <div className="h-full">
            <TradingChart market={selectedMarket} />
          </div>
        )}
        {activeTab === 'orderbook' && (
          <div className="h-full">
            <OrderBook market={selectedMarket} />
          </div>
        )}
        {activeTab === 'trades' && (
          <div className="h-full">
            <TradeHistory market={selectedMarket} />
          </div>
        )}
      </div>

      {/* Floating Trade Button */}
      <button
        onClick={() => setShowTradeSheet(!showTradeSheet)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50 active:scale-95 transition-transform"
        aria-label="Open trading controls"
      >
        {showTradeSheet ? (
          <ChevronDown size={28} />
        ) : (
          <TrendingUp size={28} />
        )}
      </button>

      {/* Bottom Sheet - Trading Controls */}
      {showTradeSheet && (
        <div
          className="fixed inset-x-0 bottom-0 bg-card border-t border-border shadow-2xl z-40 animate-slide-up"
          style={{ height: '60vh' }}
        >
          <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Place Order</h2>
              <button
                onClick={() => setShowTradeSheet(false)}
                className="p-2 hover:bg-muted rounded"
              >
                <ChevronDown size={24} />
              </button>
            </div>
            <TradingControls market={selectedMarket} />
          </div>
        </div>
      )}

      {/* Market Selector Modal */}
      {showMarketSelector && (
        <div
          className="fixed inset-0 bg-background/95 z-50 animate-fade-in"
          onClick={() => setShowMarketSelector(false)}
        >
          <div className="h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Select Market</h2>
              <button
                onClick={() => setShowMarketSelector(false)}
                className="p-2 hover:bg-muted rounded"
              >
                ✕
              </button>
            </div>
            <MarketSelector
              selectedMarket={selectedMarket}
              onMarketChange={(market) => {
                setSelectedMarket(market);
                setShowMarketSelector(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Side Menu */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-background/80 z-50 animate-fade-in"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-3/4 max-w-xs h-full bg-card border-r border-border p-6 animate-slide-right"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-6">Menu</h2>
            <nav className="space-y-4">
              <button className="block w-full text-left p-3 hover:bg-muted rounded">
                Trading Terminal
              </button>
              <button className="block w-full text-left p-3 hover:bg-muted rounded">
                Portfolio
              </button>
              <button className="block w-full text-left p-3 hover:bg-muted rounded">
                Order History
              </button>
              <button className="block w-full text-left p-3 hover:bg-muted rounded">
                Settings
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
