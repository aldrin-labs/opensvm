/**
 * StrategyCard
 *
 * Visual card displaying a single autonomous trading strategy
 */

'use client';

import React from 'react';
import { Pause, Play, X, TrendingUp, TrendingDown, Clock, DollarSign, Target, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Strategy, DCAStrategy, StrategyPerformance, StrategyExecution } from '@/lib/trading/strategy-types';

interface StrategyCardProps {
  strategy: Strategy;
  performance?: StrategyPerformance;
  executions?: StrategyExecution[];
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onViewDetails?: () => void;
}

export default function StrategyCard({
  strategy,
  performance,
  executions = [],
  onPause,
  onResume,
  onCancel,
  onViewDetails,
}: StrategyCardProps) {
  const isActive = strategy.status === 'ACTIVE';
  const isPaused = strategy.status === 'PAUSED';
  const isCompleted = strategy.status === 'COMPLETED';

  const statusColors = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    PAUSED: 'bg-warning/10 text-warning border-warning/20',
    COMPLETED: 'bg-info/10 text-info border-info/20',
    CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
    ERROR: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const statusIcons = {
    ACTIVE: <div className="w-2 h-2 rounded-full bg-success animate-pulse" />,
    PAUSED: <Pause size={12} className="text-warning" />,
    COMPLETED: <Target size={12} className="text-info" />,
    CANCELLED: <X size={12} className="text-destructive" />,
    ERROR: <AlertCircle size={12} className="text-destructive" />,
  };

  // Calculate progress for DCA strategies with total investment limit
  const calculateProgress = () => {
    if (strategy.type === 'DCA' && (strategy as DCAStrategy).parameters.totalInvestment && performance) {
      const total = (strategy as DCAStrategy).parameters.totalInvestment!;
      const invested = performance.totalInvested;
      return (invested / total) * 100;
    }
    return null;
  };

  const progress = calculateProgress();

  // Format next execution time
  const formatNextExecution = () => {
    if (!strategy.nextExecutionAt) return 'Not scheduled';
    const now = new Date();
    const next = new Date(strategy.nextExecutionAt);
    const diff = next.getTime() - now.getTime();

    if (diff < 0) return 'Due now';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'in < 1 hour';
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{strategy.name}</h3>
              <Badge variant="outline" className={`text-xs ${statusColors[strategy.status]}`}>
                <div className="flex items-center gap-1">
                  {statusIcons[strategy.status]}
                  <span>{strategy.status}</span>
                </div>
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{strategy.type}</span>
              <span>•</span>
              {strategy.type === 'DCA' && (
                <>
                  <span>${(strategy as DCAStrategy).parameters.amountPerTrade} {(strategy as DCAStrategy).parameters.asset}</span>
                  <span>•</span>
                  <span className="capitalize">{(strategy as DCAStrategy).parameters.frequency.toLowerCase()}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-1">
            {isActive && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onPause}
                className="h-8 w-8 p-0"
                title="Pause"
              >
                <Pause size={14} />
              </Button>
            )}
            {isPaused && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onResume}
                className="h-8 w-8 p-0"
                title="Resume"
              >
                <Play size={14} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              title="Cancel"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Next Execution */}
        {isActive && strategy.nextExecutionAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Next execution: {formatNextExecution()}</span>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      {performance && (
        <div className="p-4 space-y-3">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Total Trades</div>
              <div className="text-lg font-semibold">
                {performance.totalTrades}
                <span className="text-xs text-muted-foreground ml-1">
                  ({performance.successfulTrades}/{performance.totalTrades})
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Invested</div>
              <div className="text-lg font-semibold">
                ${performance.totalInvested.toFixed(2)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Avg Price</div>
              <div className="text-lg font-semibold">
                ${performance.averagePrice.toFixed(2)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">PnL</div>
              <div className={`text-lg font-semibold flex items-center gap-1 ${performance.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {performance.unrealizedPnL >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>${Math.abs(performance.unrealizedPnL).toFixed(2)}</span>
                <span className="text-xs">
                  ({performance.unrealizedPnLPercent >= 0 ? '+' : ''}{performance.unrealizedPnLPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar (if has total investment limit) */}
          {progress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.min(progress, 100).toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(progress, 100)} className="h-2" />
            </div>
          )}

          {/* Recent Executions */}
          {executions.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Last 3 Executions</div>
              <div className="space-y-1">
                {executions.slice(-3).reverse().map((exec) => (
                  <div key={exec.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {exec.success ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      )}
                      <span className="text-muted-foreground">
                        {new Date(exec.executedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">
                        {exec.details.amount.toFixed(4)} {exec.details.asset}
                      </span>
                      <span className="text-muted-foreground">
                        @${exec.details.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-3 border-t border-border bg-card/50">
        <Button
          size="sm"
          variant="ghost"
          onClick={onViewDetails}
          className="w-full text-xs"
        >
          View Full History →
        </Button>
      </div>
    </div>
  );
}
