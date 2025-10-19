'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

interface PositionsPanelProps {
  market: string;
}

interface Position {
  id: string;
  market: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
}

export default function PositionsPanel({ market }: PositionsPanelProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');

  useEffect(() => {
    // Generate mock positions
    const mockPositions: Position[] = [
      {
        id: 'pos-1',
        market: 'SOL/USDC',
        side: 'long',
        size: 10.5,
        entryPrice: 142.50,
        currentPrice: 145.30,
        leverage: 5,
        pnl: 29.40,
        pnlPercent: 1.96,
      },
      {
        id: 'pos-2',
        market: 'SOL-PERP',
        side: 'short',
        size: 5.0,
        entryPrice: 148.20,
        currentPrice: 145.30,
        leverage: 10,
        pnl: 145.00,
        pnlPercent: 19.56,
      },
    ];
    setPositions(mockPositions);
  }, []);

  const handleClosePosition = (positionId: string) => {
    console.log('Close position:', positionId);
    setPositions(positions.filter(p => p.id !== positionId));
  };

  return (
    <div className="positions-panel h-full flex flex-col bg-[#1e1e1e] text-[#cccccc]">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#3e3e42] bg-[#252526]">
        <button
          onClick={() => setActiveTab('positions')}
          className={`flex-1 py-2 px-4 text-xs font-semibold transition-colors ${
            activeTab === 'positions'
              ? 'text-[#4ec9b0] border-b-2 border-[#4ec9b0]'
              : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          POSITIONS ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-2 px-4 text-xs font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'text-[#4ec9b0] border-b-2 border-[#4ec9b0]'
              : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          ORDERS (0)
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'positions' ? (
          positions.length > 0 ? (
            <div className="space-y-2 p-3">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="bg-[#252526] border border-[#3e3e42] rounded p-3 hover:border-[#4ec9b0] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#cccccc]">
                        {position.market}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        position.side === 'long' 
                          ? 'bg-[#4ec9b0]/20 text-[#4ec9b0]' 
                          : 'bg-[#f48771]/20 text-[#f48771]'
                      }`}>
                        {position.side.toUpperCase()} {position.leverage}x
                      </span>
                    </div>
                    <button
                      onClick={() => handleClosePosition(position.id)}
                      className="p-1 hover:bg-[#3e3e42] rounded transition-colors"
                      title="Close position"
                    >
                      <X size={14} className="text-[#858585]" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[#858585] mb-1">Size</div>
                      <div className="font-mono text-[#cccccc]">{position.size.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-[#858585] mb-1">Entry Price</div>
                      <div className="font-mono text-[#cccccc]">${position.entryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[#858585] mb-1">Current Price</div>
                      <div className="font-mono text-[#cccccc]">${position.currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[#858585] mb-1">PnL</div>
                      <div className={`font-mono font-semibold flex items-center gap-1 ${
                        position.pnl >= 0 ? 'text-[#4ec9b0]' : 'text-[#f48771]'
                      }`}>
                        {position.pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        ${Math.abs(position.pnl).toFixed(2)} ({position.pnl >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClosePosition(position.id)}
                    className="w-full mt-3 py-1.5 bg-[#f48771] hover:bg-[#f48771]/90 text-[#1e1e1e] rounded text-xs font-semibold transition-colors"
                  >
                    Close Position
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="text-[#858585] text-sm mb-2">No open positions</div>
              <div className="text-[#858585] text-xs">
                Your positions will appear here
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-[#858585] text-sm mb-2">No open orders</div>
            <div className="text-[#858585] text-xs">
              Your orders will appear here
            </div>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {positions.length > 0 && activeTab === 'positions' && (
        <div className="border-t border-[#3e3e42] bg-[#252526] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#858585]">Total PnL:</span>
            <span className={`font-mono font-semibold ${
              positions.reduce((sum, p) => sum + p.pnl, 0) >= 0 
                ? 'text-[#4ec9b0]' 
                : 'text-[#f48771]'
            }`}>
              ${positions.reduce((sum, p) => sum + p.pnl, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
