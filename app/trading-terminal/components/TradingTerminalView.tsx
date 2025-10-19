'use client';

import React, { useState, useEffect } from 'react';
import TradingChart from './TradingChart';
import MarketSelector from './MarketSelector';
import OrderBook from './OrderBook';
import TradeHistory from './TradeHistory';
import TradingControls from './TradingControls';
import PositionsPanel from './PositionsPanel';
import MarketStats from './MarketStats';
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

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
  const [sections, setSections] = useState<Section[]>([
    { id: 'chart', name: 'Chart', isExpanded: true },
    { id: 'orderbook', name: 'Order Book', isExpanded: true },
    { id: 'trades', name: 'Recent Trades', isExpanded: true },
    { id: 'positions', name: 'Positions', isExpanded: true },
  ]);

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
    ));
  };

  const isSectionExpanded = (sectionId: string) => {
    return sections.find(s => s.id === sectionId)?.isExpanded ?? true;
  };

  return (
    <div className="trading-terminal h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header with Market Selector */}
      <div className="trading-header flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-primary">Trading Terminal</h1>
          <MarketSelector 
            selectedMarket={selectedMarket} 
            onMarketChange={setSelectedMarket}
          />
        </div>
        <MarketStats market={selectedMarket} />
      </div>

      {/* Main Terminal Layout */}
      <div className="trading-content flex-1 flex overflow-hidden">
        {/* Left Panel - Chart and Trading Controls */}
        <div className="chart-panel flex-1 flex flex-col border-r border-border min-w-0">
          {/* Chart Section */}
          <div className={`chart-section flex flex-col border-b border-border ${isSectionExpanded('chart') ? 'flex-1' : 'h-10'} transition-all duration-300`}>
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
              onClick={() => toggleSection('chart')}
            >
              <span className="text-sm font-semibold text-primary">CHART</span>
              <button className="p-1 hover:bg-border rounded">
                {isSectionExpanded('chart') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('chart') && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <TradingChart market={selectedMarket} />
              </div>
            )}
          </div>

          {/* Trading Controls */}
          <div className="trading-controls-section bg-background">
            <TradingControls market={selectedMarket} />
          </div>
        </div>

        {/* Right Panel - Order Book, Trades, and Positions */}
        <div className="right-panel w-80 flex flex-col bg-background overflow-hidden">
          {/* Order Book Section */}
          <div className={`orderbook-section flex flex-col border-b border-border ${isSectionExpanded('orderbook') ? 'flex-1' : 'h-10'} transition-all duration-300`}>
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
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
          <div className={`positions-section flex flex-col ${isSectionExpanded('positions') ? 'flex-1' : 'h-10'} transition-all duration-300`}>
            <div 
              className="section-header flex items-center justify-between px-4 py-2 bg-card cursor-pointer hover:bg-muted"
              onClick={() => toggleSection('positions')}
            >
              <span className="text-sm font-semibold text-primary">POSITIONS</span>
              <button className="p-1 hover:bg-border rounded">
                {isSectionExpanded('positions') ? (
                  <ChevronUp size={16} className="text-foreground" />
                ) : (
                  <ChevronDown size={16} className="text-foreground" />
                )}
              </button>
            </div>
            {isSectionExpanded('positions') && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <PositionsPanel market={selectedMarket} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
