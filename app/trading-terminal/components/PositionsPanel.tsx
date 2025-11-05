'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Inbox, FileText } from 'lucide-react';

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
    <div className="positions-panel h-full flex flex-col bg-background text-foreground">
      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-card">
        <button
          onClick={() => setActiveTab('positions')}
          className={`flex-1 py-2 px-4 text-xs font-semibold transition-colors ${
            activeTab === 'positions'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          POSITIONS ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-2 px-4 text-xs font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
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
                  className="bg-card border border-border rounded p-3 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {position.market}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        position.side === 'long' 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-destructive/20 text-destructive'
                      }`}>
                        {position.side.toUpperCase()} {position.leverage}x
                      </span>
                    </div>
                    <button
                      onClick={() => handleClosePosition(position.id)}
                      className="p-1 hover:bg-border rounded transition-colors"
                      title="Close position"
                    >
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground mb-1">Size</div>
                      <div className="font-mono text-foreground">{position.size.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Entry Price</div>
                      <div className="font-mono text-foreground">${position.entryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Current Price</div>
                      <div className="font-mono text-foreground">${position.currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">PnL</div>
                      <div className={`font-mono font-semibold flex items-center gap-1 ${
                        position.pnl >= 0 ? 'text-primary' : 'text-destructive'
                      }`}>
                        {position.pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        ${Math.abs(position.pnl).toFixed(2)} ({position.pnl >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClosePosition(position.id)}
                    className="w-full mt-3 py-1.5 bg-destructive hover:bg-destructive/90 text-primary-foreground rounded text-xs font-semibold transition-colors"
                  >
                    Close Position
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="mb-4 p-4 rounded-full bg-muted/50">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-foreground font-semibold text-sm mb-2">No Open Positions</div>
              <div className="text-muted-foreground text-xs mb-4 max-w-xs">
                You don't have any active trading positions. Use the trading controls below to open a position.
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Enter amount and price in trading controls</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Click Buy or Sell to open a position</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Monitor your positions here</span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="mb-4 p-4 rounded-full bg-muted/50">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-foreground font-semibold text-sm mb-2">No Open Orders</div>
            <div className="text-muted-foreground text-xs mb-4 max-w-xs">
              You don't have any pending orders. Limit orders and stop orders will appear here when placed.
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                <span>Set your desired price in trading controls</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                <span>Select "Limit" order type</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                <span>Track your orders here until filled</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {positions.length > 0 && activeTab === 'positions' && (
        <div className="border-t border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total PnL:</span>
            <span className={`font-mono font-semibold ${
              positions.reduce((sum, p) => sum + p.pnl, 0) >= 0 
                ? 'text-primary' 
                : 'text-destructive'
            }`}>
              ${positions.reduce((sum, p) => sum + p.pnl, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
