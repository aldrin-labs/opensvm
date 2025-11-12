'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Shield, AlertTriangle } from 'lucide-react';

interface Wallet {
  id: string;
  name: string;
  balance: number;
  tokens: Array<{
    symbol: string;
    usdValue: number;
    mint: string;
  }>;
}

interface PortfolioHeatmapProps {
  wallets: Wallet[];
}

export function PortfolioHeatmap({ wallets }: PortfolioHeatmapProps) {
  // Calculate total portfolio value
  const totalValue = wallets.reduce(
    (sum, w) => sum + w.balance + w.tokens.reduce((s, t) => s + t.usdValue, 0),
    0
  );
  
  // Create cells for the heatmap
  const cells = wallets.flatMap(wallet => {
    const walletValue = wallet.balance + wallet.tokens.reduce((s, t) => s + t.usdValue, 0);
    const walletPercent = (walletValue / totalValue) * 100;
    
    // SOL cell
    const solPercent = (wallet.balance / totalValue) * 100;
    const cells = [];
    
    if (solPercent > 0) {
      cells.push({
        wallet: wallet.name,
        asset: 'SOL',
        value: wallet.balance,
        percent: solPercent,
        risk: 'low' as const,
      });
    }
    
    // Token cells
    wallet.tokens.forEach(token => {
      const tokenPercent = (token.usdValue / totalValue) * 100;
      if (tokenPercent > 0) {
        cells.push({
          wallet: wallet.name,
          asset: token.symbol,
          value: token.usdValue,
          percent: tokenPercent,
          risk: tokenPercent > 30 ? 'high' : tokenPercent > 15 ? 'medium' : 'low' as const,
        });
      }
    });
    
    return cells;
  });
  
  // Sort by percent descending
  cells.sort((a, b) => b.percent - a.percent);
  
  const getHeatColor = (percent: number, risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high':
        if (percent > 40) return 'bg-red-600/90';
        if (percent > 30) return 'bg-red-500/80';
        return 'bg-red-400/70';
      case 'medium':
        if (percent > 20) return 'bg-yellow-600/90';
        if (percent > 15) return 'bg-yellow-500/80';
        return 'bg-yellow-400/70';
      case 'low':
      default:
        if (percent > 25) return 'bg-green-600/90';
        if (percent > 15) return 'bg-green-500/80';
        if (percent > 5) return 'bg-green-400/70';
        return 'bg-green-300/60';
    }
  };
  
  const getRiskIcon = (risk: string) => {
    if (risk === 'high') {
      return <Flame className="h-3 w-3 text-red-400" />;
    }
    if (risk === 'medium') {
      return <AlertTriangle className="h-3 w-3 text-yellow-400" />;
    }
    return <Shield className="h-3 w-3 text-green-400" />;
  };
  
  const riskSummary = {
    high: cells.filter(c => c.risk === 'high').length,
    medium: cells.filter(c => c.risk === 'medium').length,
    low: cells.filter(c => c.risk === 'low').length,
  };
  
  // Calculate cell sizes
  const getFlexBasis = (percent: number) => {
    // Minimum size is 10%, maximum is 100%
    return `${Math.max(10, Math.min(100, percent * 3))}%`;
  };
  
  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Portfolio Concentration Heatmap
            </CardTitle>
            <CardDescription>
              Visual representation of asset distribution and concentration risk
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <Shield className="h-3 w-3 text-green-400" />
              {riskSummary.low} Low
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3 text-yellow-400" />
              {riskSummary.medium} Med
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              <Flame className="h-3 w-3 text-red-400" />
              {riskSummary.high} High
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Heatmap Grid */}
        <div className="flex flex-wrap gap-2 p-4 rounded-lg bg-slate-800/30">
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className={`
                group relative rounded-lg p-3 transition-all duration-200
                hover:scale-105 hover:z-10 cursor-pointer
                ${getHeatColor(cell.percent, cell.risk)}
              `}
              style={{
                flexBasis: getFlexBasis(cell.percent),
                minWidth: '120px',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-bold text-white text-sm truncate">
                  {cell.asset}
                </span>
                {getRiskIcon(cell.risk)}
              </div>
              <div className="text-xs text-white/90 font-medium mb-1">
                {cell.wallet}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold text-white">
                  {cell.percent.toFixed(1)}%
                </span>
                <span className="text-xs text-white/70">
                  ${cell.value.toFixed(0)}
                </span>
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                  <div className="font-semibold mb-1">{cell.asset} in {cell.wallet}</div>
                  <div className="text-muted-foreground space-y-0.5">
                    <div>Value: ${cell.value.toFixed(2)}</div>
                    <div>Portfolio: {cell.percent.toFixed(2)}%</div>
                    <div className="flex items-center gap-1">
                      Risk: {getRiskIcon(cell.risk)} 
                      <span className="capitalize">{cell.risk}</span>
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2">
                    <div className="border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Concentration Analysis
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/80" />
                <span className="font-medium">Low Risk (0-15%)</span>
              </div>
              <p className="text-muted-foreground pl-6">
                Well-diversified position
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500/80" />
                <span className="font-medium">Medium Risk (15-30%)</span>
              </div>
              <p className="text-muted-foreground pl-6">
                Moderate concentration
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500/80" />
                <span className="font-medium">High Risk (&gt;30%)</span>
              </div>
              <p className="text-muted-foreground pl-6">
                Over-concentrated, consider rebalancing
              </p>
            </div>
          </div>
        </div>
        
        {/* Insights */}
        {riskSummary.high > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <Flame className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">
                  High Concentration Detected
                </p>
                <p className="text-xs text-muted-foreground">
                  You have {riskSummary.high} asset{riskSummary.high !== 1 ? 's' : ''} with over 30% concentration. 
                  Consider distributing holdings to reduce risk.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {riskSummary.high === 0 && riskSummary.medium === 0 && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-400 mb-1">
                  Well Diversified Portfolio
                </p>
                <p className="text-xs text-muted-foreground">
                  Your assets are well distributed with no high-concentration risks.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
