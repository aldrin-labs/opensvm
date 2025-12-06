'use client';

import React from 'react';
import {
  Route,
  X,
  ArrowRight,
  ArrowLeftRight,
  Search,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PathNode {
  id: string;
  type: 'account' | 'transaction';
  label: string;
}

interface PathEdge {
  id: string;
  source: string;
  target: string;
  amount?: number;
  tokenSymbol?: string;
  txSignature?: string;
}

interface FoundPath {
  nodes: PathNode[];
  edges: PathEdge[];
  totalAmount: number;
  length: number;
  transactions: string[];
}

interface PathFindingPanelProps {
  isActive: boolean;
  sourceAccount: string | null;
  targetAccount: string | null;
  paths: FoundPath[];
  isSearching: boolean;
  error: string | null;
  onToggle: () => void;
  onExit: () => void;
  onSearch: (mode: 'shortest' | 'all') => void;
  onSwap: () => void;
  onClear: () => void;
  onHighlightPath: (index: number) => void;
  className?: string;
}

export const PathFindingPanel: React.FC<PathFindingPanelProps> = ({
  isActive,
  sourceAccount,
  targetAccount,
  paths,
  isSearching,
  error,
  onToggle,
  onExit,
  onSearch,
  onSwap,
  onClear,
  onHighlightPath,
  className
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [expandedPath, setExpandedPath] = React.useState<number | null>(null);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: number, symbol: string) => {
    if (amount === 0) return '';
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M ${symbol}`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K ${symbol}`;
    }
    return `${amount.toFixed(2)} ${symbol}`;
  };

  if (!isActive) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          'absolute bottom-20 left-4 z-20 p-3 rounded-xl bg-background/95 backdrop-blur-sm',
          'border border-border shadow-lg hover:bg-muted/50 transition-colors',
          'flex items-center gap-2',
          className
        )}
        title="Find path between accounts (P)"
      >
        <Route className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">Path Finder</span>
      </button>
    );
  }

  return (
    <div className={cn(
      'absolute bottom-20 left-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg w-80',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          <span className="font-medium">Path Finder</span>
        </div>
        <button
          onClick={onExit}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Instructions / Selection */}
      <div className="p-3 space-y-3">
        {!sourceAccount && !targetAccount && (
          <div className="text-center py-4 text-muted-foreground">
            <Route className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click on an account node to select source</p>
            <p className="text-xs mt-1 text-muted-foreground">Then click another for the target</p>
          </div>
        )}

        {(sourceAccount || targetAccount) && (
          <div className="space-y-2">
            {/* Source */}
            <div className={cn(
              'flex items-center gap-2 p-2 rounded-lg border',
              sourceAccount ? 'border-success/50 bg-success/5' : 'border-dashed border-border'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                sourceAccount ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
              )}>
                A
              </div>
              <div className="flex-1">
                {sourceAccount ? (
                  <span className="font-mono text-sm">{formatAddress(sourceAccount)}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Click to select source</span>
                )}
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <button
                onClick={onSwap}
                disabled={!sourceAccount || !targetAccount}
                className={cn(
                  'p-1.5 rounded-full border border-border hover:bg-muted transition-colors',
                  (!sourceAccount || !targetAccount) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            {/* Target */}
            <div className={cn(
              'flex items-center gap-2 p-2 rounded-lg border',
              targetAccount ? 'border-info/50 bg-info/5' : 'border-dashed border-border'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                targetAccount ? 'bg-info text-info-foreground' : 'bg-muted text-muted-foreground'
              )}>
                B
              </div>
              <div className="flex-1">
                {targetAccount ? (
                  <span className="font-mono text-sm">{formatAddress(targetAccount)}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Click to select target</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action buttons */}
        {sourceAccount && targetAccount && (
          <div className="flex gap-2">
            <button
              onClick={() => onSearch('shortest')}
              disabled={isSearching}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Shortest
            </button>
            <button
              onClick={() => onSearch('all')}
              disabled={isSearching}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-50 transition-colors text-sm"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Route className="w-4 h-4" />
              )}
              All Paths
            </button>
          </div>
        )}

        {/* Clear button */}
        {(sourceAccount || targetAccount) && (
          <button
            onClick={onClear}
            className="w-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Results */}
      {paths.length > 0 && (
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Found {paths.length} path{paths.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-muted"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className={cn('space-y-2 overflow-y-auto', isExpanded ? 'max-h-60' : 'max-h-32')}>
            {paths.map((path, index) => (
              <div
                key={index}
                className={cn(
                  'p-2 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors',
                  expandedPath === index && 'border-primary bg-primary/5'
                )}
                onClick={() => {
                  setExpandedPath(expandedPath === index ? null : index);
                  onHighlightPath(index);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">
                    Path {index + 1} ({path.length} hops)
                  </span>
                  {path.totalAmount > 0 && (
                    <span className="text-xs text-success">
                      {formatAmount(path.totalAmount, path.edges[0]?.tokenSymbol || 'SOL')}
                    </span>
                  )}
                </div>

                {/* Path preview */}
                <div className="flex items-center gap-1 text-xs overflow-hidden">
                  {path.nodes.slice(0, 5).map((node, i) => (
                    <React.Fragment key={node.id}>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded font-mono truncate max-w-[60px]',
                        node.type === 'account' ? 'bg-muted' : 'bg-primary/10'
                      )}>
                        {node.label}
                      </span>
                      {i < Math.min(path.nodes.length - 1, 4) && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                  {path.nodes.length > 5 && (
                    <span className="text-muted-foreground">+{path.nodes.length - 5} more</span>
                  )}
                </div>

                {/* Expanded view with transactions */}
                {expandedPath === index && path.transactions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Transactions:</p>
                    <div className="space-y-1">
                      {path.transactions.slice(0, 3).map(sig => (
                        <a
                          key={sig}
                          href={`/tx/${sig}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-mono text-primary hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {sig.slice(0, 16)}...
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                      {path.transactions.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{path.transactions.length - 3} more transactions
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="px-3 pb-2 text-xs text-muted-foreground text-center">
        Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">Esc</kbd> to exit
      </div>
    </div>
  );
};

export default PathFindingPanel;
