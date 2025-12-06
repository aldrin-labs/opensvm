'use client';

import React, { useState } from 'react';
import {
  Filter,
  X,
  Clock,
  Coins,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterState {
  timeRange: { start: Date | null; end: Date | null };
  tokens: string[];
  minAmount: number | null;
  maxAmount: number | null;
  hideSmallTransactions: boolean;
  showOnlyConnected: boolean;
}

interface FilterPanelProps {
  filters: FilterState;
  availableTokens: string[];
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  playbackSpeed: number;
  onUpdateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onToggleToken: (token: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onStartPlayback: () => void;
  onStopPlayback: () => void;
  onSetFrame: (frame: number) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  availableTokens,
  isPlaying,
  currentFrame,
  totalFrames,
  playbackSpeed,
  onUpdateFilter,
  onToggleToken,
  onApplyFilters,
  onResetFilters,
  onStartPlayback,
  onStopPlayback,
  onSetFrame,
  onSetPlaybackSpeed,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTimeFilter, setShowTimeFilter] = useState(true);
  const [showTokenFilter, setShowTokenFilter] = useState(true);
  const [showAmountFilter, setShowAmountFilter] = useState(false);

  const hasActiveFilters =
    filters.timeRange.start ||
    filters.timeRange.end ||
    filters.tokens.length > 0 ||
    filters.minAmount !== null ||
    filters.maxAmount !== null ||
    filters.hideSmallTransactions;

  return (
    <div className={cn(
      'absolute top-16 left-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg transition-all duration-300',
      isExpanded ? 'w-80' : 'w-auto',
      className
    )}>
      {/* Collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors',
            hasActiveFilters && 'ring-2 ring-primary/50'
          )}
        >
          <Filter className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              Active
            </span>
          )}
        </button>
      )}

      {/* Expanded */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              <span className="font-medium">Graph Filters</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {/* Time Filter */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setShowTimeFilter(!showTimeFilter)}
                className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-t-lg"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Time Range</span>
                </div>
                {showTimeFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTimeFilter && (
                <div className="p-2 pt-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Start</label>
                      <input
                        type="date"
                        value={filters.timeRange.start?.toISOString().split('T')[0] || ''}
                        onChange={(e) => onUpdateFilter('timeRange', {
                          ...filters.timeRange,
                          start: e.target.value ? new Date(e.target.value) : null
                        })}
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End</label>
                      <input
                        type="date"
                        value={filters.timeRange.end?.toISOString().split('T')[0] || ''}
                        onChange={(e) => onUpdateFilter('timeRange', {
                          ...filters.timeRange,
                          end: e.target.value ? new Date(e.target.value) : null
                        })}
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                      />
                    </div>
                  </div>

                  {/* Timeline Playback */}
                  {totalFrames > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Timeline Playback</span>
                        <select
                          value={playbackSpeed}
                          onChange={(e) => onSetPlaybackSpeed(Number(e.target.value))}
                          className="text-xs px-2 py-1 rounded border border-border bg-background"
                        >
                          <option value={0.5}>0.5x</option>
                          <option value={1}>1x</option>
                          <option value={2}>2x</option>
                          <option value={4}>4x</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSetFrame(0)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                          onClick={isPlaying ? onStopPlayback : onStartPlayback}
                          className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => onSetFrame(totalFrames - 1)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={totalFrames - 1}
                          value={currentFrame}
                          onChange={(e) => onSetFrame(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {currentFrame + 1}/{totalFrames}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Token Filter */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setShowTokenFilter(!showTokenFilter)}
                className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-t-lg"
              >
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tokens</span>
                  {filters.tokens.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {filters.tokens.length}
                    </span>
                  )}
                </div>
                {showTokenFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTokenFilter && (
                <div className="p-2 pt-0">
                  {availableTokens.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {availableTokens.map(token => (
                        <button
                          key={token}
                          onClick={() => onToggleToken(token)}
                          className={cn(
                            'px-2 py-1 text-xs rounded transition-colors',
                            filters.tokens.includes(token)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No tokens found in graph</p>
                  )}
                </div>
              )}
            </div>

            {/* Amount Filter */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setShowAmountFilter(!showAmountFilter)}
                className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-t-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">Amount Range</span>
                </div>
                {showAmountFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAmountFilter && (
                <div className="p-2 pt-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Min (SOL)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={filters.minAmount ?? ''}
                        onChange={(e) => onUpdateFilter('minAmount', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max (SOL)</label>
                      <input
                        type="number"
                        placeholder="No limit"
                        value={filters.maxAmount ?? ''}
                        onChange={(e) => onUpdateFilter('maxAmount', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Filters */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hideSmallTransactions}
                  onChange={(e) => onUpdateFilter('hideSmallTransactions', e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Hide dust transactions (&lt;0.001 SOL)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showOnlyConnected}
                  onChange={(e) => onUpdateFilter('showOnlyConnected', e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Hide isolated nodes</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-border flex gap-2">
            <button
              onClick={onApplyFilters}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Filters
            </button>
            <button
              onClick={onResetFilters}
              className="px-3 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterPanel;
