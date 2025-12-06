'use client';

import React, { useState, useCallback } from 'react';
import {
  BarChart3,
  X,
  TrendingUp,
  Activity,
  Network,
  Zap,
  RefreshCw,
  Palette,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeMetrics {
  id: string;
  pageRank: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  totalVolume: number;
  degree: number;
}

interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  clusteringCoefficient: number;
  components: number;
  totalVolume: number;
  topNodesByPageRank: NodeMetrics[];
  topNodesByBetweenness: NodeMetrics[];
  topNodesByVolume: NodeMetrics[];
}

interface AnalyticsPanelProps {
  metrics: GraphMetrics | null;
  isCalculating: boolean;
  onCalculate: () => void;
  onColorByMetric: (metric: 'pageRank' | 'betweennessCentrality' | 'closenessCentrality' | 'totalVolume') => void;
  onSizeByMetric: (metric: 'pageRank' | 'totalVolume' | 'degree') => void;
  onHighlightNode: (nodeId: string) => void;
  className?: string;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  metrics,
  isCalculating,
  onCalculate,
  onColorByMetric,
  onSizeByMetric,
  onHighlightNode,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pagerank' | 'centrality' | 'volume'>('overview');

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <div className={cn(
      'absolute top-4 left-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg transition-all duration-300',
      isExpanded ? 'w-80' : 'w-auto',
      className
    )}>
      {/* Collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Analytics</span>
        </button>
      )}

      {/* Expanded */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-medium">Graph Analytics</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Calculate Button */}
          {!metrics && (
            <div className="p-4">
              <button
                onClick={onCalculate}
                disabled={isCalculating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isCalculating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Calculate Metrics
                  </>
                )}
              </button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Compute PageRank, centrality, and other metrics
              </p>
            </div>
          )}

          {/* Metrics Display */}
          {metrics && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-border">
                {(['overview', 'pagerank', 'centrality', 'volume'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors',
                      activeTab === tab
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                {activeTab === 'overview' && (
                  <>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <Network className="w-4 h-4 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-semibold">{metrics.nodeCount}</p>
                        <p className="text-xs text-muted-foreground">Accounts</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <Activity className="w-4 h-4 mx-auto mb-1 text-success" />
                        <p className="text-lg font-semibold">{metrics.edgeCount}</p>
                        <p className="text-xs text-muted-foreground">Transfers</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <TrendingUp className="w-4 h-4 mx-auto mb-1 text-info" />
                        <p className="text-lg font-semibold">{formatNumber(metrics.totalVolume)}</p>
                        <p className="text-xs text-muted-foreground">Total Volume</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <BarChart3 className="w-4 h-4 mx-auto mb-1 text-warning" />
                        <p className="text-lg font-semibold">{metrics.averageDegree}</p>
                        <p className="text-xs text-muted-foreground">Avg Degree</p>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Density</span>
                        <span className="font-mono">{(metrics.density * 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Clustering Coef.</span>
                        <span className="font-mono">{metrics.clusteringCoefficient.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Components</span>
                        <span className="font-mono">{metrics.components}</span>
                      </div>
                    </div>

                    {/* Visualization Controls */}
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Visualize By</p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => onColorByMetric('pageRank')}
                          className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 flex items-center gap-1"
                        >
                          <Palette className="w-3 h-3" /> PageRank
                        </button>
                        <button
                          onClick={() => onColorByMetric('betweennessCentrality')}
                          className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 flex items-center gap-1"
                        >
                          <Palette className="w-3 h-3" /> Centrality
                        </button>
                        <button
                          onClick={() => onSizeByMetric('totalVolume')}
                          className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 flex items-center gap-1"
                        >
                          <Maximize2 className="w-3 h-3" /> Volume
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'pagerank' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      PageRank identifies influential accounts based on incoming connections.
                    </p>
                    {metrics.topNodesByPageRank.map((node, i) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => onHighlightNode(node.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm">{formatAddress(node.id)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(node.pageRank * 100).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'centrality' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Betweenness centrality finds bridge accounts connecting different groups.
                    </p>
                    {metrics.topNodesByBetweenness.map((node, i) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => onHighlightNode(node.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-warning/20 text-warning text-xs flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm">{formatAddress(node.id)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(node.betweennessCentrality * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'volume' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Top accounts by total transaction volume.
                    </p>
                    {metrics.topNodesByVolume.map((node, i) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => onHighlightNode(node.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-success/20 text-success text-xs flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm">{formatAddress(node.id)}</span>
                        </div>
                        <span className="text-xs font-medium text-success">
                          {formatNumber(node.totalVolume)} SOL
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recalculate */}
              <div className="p-3 border-t border-border">
                <button
                  onClick={onCalculate}
                  disabled={isCalculating}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3 h-3', isCalculating && 'animate-spin')} />
                  Recalculate
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPanel;
