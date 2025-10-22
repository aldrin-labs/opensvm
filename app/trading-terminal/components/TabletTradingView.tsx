/**
 * TabletTradingView
 * 
 * Tablet-optimized trading terminal (768px - 1023px).
 * Features:
 * - Two-column hybrid layout
 * - Chart + OrderBook side-by-side
 * - Bottom tabs for Trading/Positions
 * - Touch-optimized but more space-efficient than mobile
 */

'use client';

import React, { useState } from 'react';
import { useTradingTerminal } from '@/components/hooks/trading/useTradingTerminal';
import { useMarketData } from '@/components/hooks/trading/useMarketData';
import { useWalletConnection } from '@/components/hooks/trading/useWalletConnection';
import dynamic from 'next/dynamic';
import { Wallet, Settings } from 'lucide-react';

// Dynamically import components
const TradingChart = dynamic(() => import('./TradingChart'), { ssr: false });
const OrderBook = dynamic(() => import('./OrderBook'), { ssr: false });
const TradeHistory = dynamic(() => import('./TradeHistory'), { ssr: false });
const TradingControls = dynamic(() => import('./TradingControls'), { ssr: false });
const PositionsPanel = dynamic(() => import('./PositionsPanel'), { ssr: false });
const MarketStats = dynamic(() => import('./MarketStats'), { ssr: false });
const MarketSelector = dynamic(() => import('./MarketSelector'), { ssr: false });

type BottomTab = 'trading' | 'positions' | 'trades';

export default function TabletTradingView() {
  const terminal = useTradingTerminal('SOL/USDC');
  const marketData = useMarketData(terminal.selectedMarket);
  const wallet = useWalletConnection();

  const [bottomTab, setBottomTab] = useState<BottomTab>('trading');
  const [showMarketSelector, setShowMarketSelector] = useState(false);

  const { selectedMarket, setSelectedMarket } = terminal;

  // Suppress unused variable warnings
  void marketData;

  return (
    <div className="tablet-trading h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-card border-b border-border px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowMarketSelector(true)}
              className="text-xl font-bold hover:text-primary transition-colors"
            >
              {selectedMarket}
            </button>
            <MarketStats market={selectedMarket} />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => wallet.isConnected ? wallet.disconnect() : wallet.connect()}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                wallet.isConnected
                  ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              <Wallet size={20} />
              <span className="text-sm font-medium">
                {wallet.isConnected
                  ? `${wallet.balance?.toFixed(2) || '0.00'} SOL`
                  : 'Connect Wallet'}
              </span>
            </button>
            <button
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content: Two Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chart (60%) */}
        <div className="flex-1 flex flex-col border-r border-border" style={{ width: '60%' }}>
          <TradingChart market={selectedMarket} />
        </div>

        {/* Right Column: Order Book + Stats (40%) */}
        <div className="flex flex-col" style={{ width: '40%' }}>
          {/* Market Stats - Compact */}
          <div className="flex-shrink-0 p-3 border-b border-border bg-card/50">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">24h Volume</div>
                <div className="font-bold">${(marketData.stats.volume24h / 1000000).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-muted-foreground">24h Change</div>
                <div className={`font-bold ${marketData.stats.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {marketData.stats.change24h >= 0 ? '+' : ''}{marketData.stats.change24h.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Order Book */}
          <div className="flex-1 overflow-hidden">
            <OrderBook market={selectedMarket} />
          </div>
        </div>
      </div>

      {/* Bottom Panel: Tabs */}
      <div className="flex-shrink-0 border-t border-border bg-card" style={{ height: '320px' }}>
        {/* Tab Headers */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setBottomTab('trading')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              bottomTab === 'trading'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Trading
          </button>
          <button
            onClick={() => setBottomTab('positions')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              bottomTab === 'positions'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setBottomTab('trades')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              bottomTab === 'trades'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Recent Trades
          </button>
        </div>

        {/* Tab Content */}
        <div className="h-full overflow-y-auto p-4">
          {bottomTab === 'trading' && (
            <TradingControls market={selectedMarket} />
          )}
          {bottomTab === 'positions' && (
            <PositionsPanel market={selectedMarket} />
          )}
          {bottomTab === 'trades' && (
            <TradeHistory market={selectedMarket} />
          )}
        </div>
      </div>

      {/* Market Selector Modal */}
      {showMarketSelector && (
        <div
          className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setShowMarketSelector(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
    </div>
  );
}
