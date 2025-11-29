'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Droplets, Activity, DollarSign, BarChart3 } from 'lucide-react';

interface AMMState {
  type: string;
  dex: string;
  poolAddress: string;
  liquidity: number;
  baseReserve: number;
  quoteReserve: number;
  constantProduct: number;
  fee: number;
  volume24h: number;
  trades24h: number;
  priceImpact: {
    buy100: number;
    buy1000: number;
    sell100: number;
    sell1000: number;
  };
}

interface AMMStateDisplayProps {
  ammState: AMMState;
  market: string;
}

export default function AMMStateDisplay({ ammState, market }: AMMStateDisplayProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatReserve = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatPercent = (num: number) => {
    return `${Math.abs(num).toFixed(2)}%`;
  };

  return (
    <div className="amm-state-display h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">AMM Pool State</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {ammState.dex}
        </div>
      </div>

      {/* Pool Overview */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Liquidity Info */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Pool Liquidity</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded p-2">
              <div className="text-xs text-muted-foreground">Total Value</div>
              <div className="text-sm font-bold text-foreground">{formatNumber(ammState.liquidity)}</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-xs text-muted-foreground">24h Volume</div>
              <div className="text-sm font-bold text-foreground">{formatNumber(ammState.volume24h)}</div>
            </div>
          </div>
        </div>

        {/* Reserves */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Reserves</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded p-2">
              <div className="text-xs text-muted-foreground">{market.split('/')[0]}</div>
              <div className="text-sm font-bold text-foreground">{formatReserve(ammState.baseReserve)}</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-xs text-muted-foreground">{market.split('/')[1]}</div>
              <div className="text-sm font-bold text-foreground">{formatReserve(ammState.quoteReserve)}</div>
            </div>
          </div>
        </div>

        {/* AMM Parameters */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">AMM Parameters</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Constant Product (k)</span>
              <span className="font-mono text-foreground">{ammState.constantProduct.toExponential(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Trading Fee</span>
              <span className="font-mono text-foreground">{(ammState.fee * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">24h Trades</span>
              <span className="font-mono text-foreground">{ammState.trades24h}</span>
            </div>
          </div>
        </div>

        {/* Price Impact */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Price Impact</div>
          <div className="grid grid-cols-2 gap-2">
            {/* Buy Impact */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Buy Impact</div>
              <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                <span className="text-xs">$100</span>
                <span className="text-xs font-mono text-success">
                  <TrendingUp className="inline w-3 h-3 mr-1" />
                  {formatPercent(ammState.priceImpact.buy100)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                <span className="text-xs">$1000</span>
                <span className="text-xs font-mono text-success">
                  <TrendingUp className="inline w-3 h-3 mr-1" />
                  {formatPercent(ammState.priceImpact.buy1000)}
                </span>
              </div>
            </div>

            {/* Sell Impact */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Sell Impact</div>
              <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                <span className="text-xs">$100</span>
                <span className="text-xs font-mono text-destructive">
                  <TrendingDown className="inline w-3 h-3 mr-1" />
                  {formatPercent(ammState.priceImpact.sell100)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                <span className="text-xs">$1000</span>
                <span className="text-xs font-mono text-destructive">
                  <TrendingDown className="inline w-3 h-3 mr-1" />
                  {formatPercent(ammState.priceImpact.sell1000)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pool Address */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Pool Address</div>
          <div className="bg-muted/30 rounded p-2">
            <span className="text-xs font-mono text-foreground break-all">
              {ammState.poolAddress}
            </span>
          </div>
        </div>

        {/* AMM Curve Visualization (placeholder for future enhancement) */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Bonding Curve</div>
          <div className="bg-muted/30 rounded p-4 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground/50" />
            <span className="ml-2 text-xs text-muted-foreground">Curve visualization coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}