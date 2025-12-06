'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  User,
  AlertTriangle,
  GitBranch,
  Users,
  FileText,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletProfile {
  address: string;
  age: number;
  totalVolume: number;
  transactionCount: number;
  uniqueCounterparties: number;
  riskScore: number;
  activityScore: number;
  patterns: string[];
  topCounterparties: Array<{ address: string; volume: number; count: number }>;
}

interface WashTradingIndicator {
  cycleAddresses: string[];
  cycleLength: number;
  volume: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ClusterInfo {
  id: string;
  size: number;
  density: number;
  riskScore: number;
  patterns: string[];
}

interface InvestigationPanelProps {
  selectedAddress: string | null;
  walletProfile: WalletProfile | null;
  washIndicators: WashTradingIndicator[];
  clusters: ClusterInfo[];
  isAnalyzing: boolean;
  onSelectAddress: (address: string) => void;
  onGenerateProfile: (address: string) => void;
  onDetectWashTrading: () => void;
  onDetectClusters: () => void;
  onHighlightCluster: (clusterId: string) => void;
  onTraceFirstFunder: (address: string) => void;
  onFindCommonAncestors: (addresses: string[]) => void;
  onGenerateReport: () => void;
  className?: string;
}

export const InvestigationPanel: React.FC<InvestigationPanelProps> = ({
  selectedAddress,
  walletProfile,
  washIndicators,
  clusters,
  isAnalyzing,
  onSelectAddress,
  onGenerateProfile,
  onDetectWashTrading,
  onDetectClusters,
  onHighlightCluster,
  onTraceFirstFunder,
  onGenerateReport,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'wash' | 'clusters' | 'tools'>('profile');
  const [addressInput, setAddressInput] = useState('');

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return 'text-destructive';
    if (score >= 50) return 'text-warning';
    if (score >= 25) return 'text-info';
    return 'text-success';
  };

  const getRiskLabel = (level: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-destructive text-destructive-foreground',
      high: 'bg-warning text-warning-foreground',
      medium: 'bg-info text-info-foreground',
      low: 'bg-success text-success-foreground'
    };
    return colors[level] || colors.low;
  };

  return (
    <div className={cn(
      'absolute top-4 right-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg transition-all duration-300',
      isExpanded ? 'w-96' : 'w-auto',
      className
    )}>
      {/* Collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <Search className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Investigation</span>
        </button>
      )}

      {/* Expanded */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              <span className="font-medium">Investigation Tools</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Address Search */}
          <div className="p-3 border-b border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="Enter wallet address..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background"
              />
              <button
                onClick={() => {
                  if (addressInput) {
                    onSelectAddress(addressInput);
                    onGenerateProfile(addressInput);
                  }
                }}
                disabled={!addressInput || isAnalyzing}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['profile', 'wash', 'clusters', 'tools'] as const).map(tab => (
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
          <div className="p-3 max-h-96 overflow-y-auto">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-3">
                {walletProfile ? (
                  <>
                    {/* Address Header */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{formatAddress(walletProfile.address)}</span>
                      </div>
                      <a
                        href={`/account/${walletProfile.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-muted"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Scores */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <p className={cn('text-xl font-bold', getRiskColor(walletProfile.riskScore))}>
                          {walletProfile.riskScore}
                        </p>
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <p className="text-xl font-bold text-primary">{walletProfile.activityScore}</p>
                        <p className="text-xs text-muted-foreground">Activity Score</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Age</span>
                        <span>{walletProfile.age} days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Volume</span>
                        <span>{formatNumber(walletProfile.totalVolume)} SOL</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Transactions</span>
                        <span>{walletProfile.transactionCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Counterparties</span>
                        <span>{walletProfile.uniqueCounterparties}</span>
                      </div>
                    </div>

                    {/* Patterns */}
                    {walletProfile.patterns.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Detected Patterns</p>
                        <div className="flex flex-wrap gap-1">
                          {walletProfile.patterns.map((pattern, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs rounded bg-warning/10 text-warning">
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Counterparties */}
                    {walletProfile.topCounterparties.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Top Counterparties</p>
                        {walletProfile.topCounterparties.slice(0, 3).map((cp, i) => (
                          <div
                            key={cp.address}
                            className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs"
                          >
                            <span className="font-mono">{formatAddress(cp.address)}</span>
                            <span className="text-muted-foreground">{formatNumber(cp.volume)} SOL</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => onTraceFirstFunder(walletProfile.address)}
                        className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center gap-1"
                      >
                        <GitBranch className="w-3 h-3" />
                        Trace Funder
                      </button>
                      <button
                        onClick={onGenerateReport}
                        className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Report
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Enter an address to analyze</p>
                    <p className="text-xs mt-1">Or click on a node in the graph</p>
                  </div>
                )}
              </div>
            )}

            {/* Wash Trading Tab */}
            {activeTab === 'wash' && (
              <div className="space-y-3">
                <button
                  onClick={onDetectWashTrading}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  Detect Wash Trading
                </button>

                {washIndicators.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Found {washIndicators.length} suspicious cycles
                    </p>
                    {washIndicators.map((indicator, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border hover:border-destructive/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            Cycle #{i + 1} ({indicator.cycleLength} wallets)
                          </span>
                          <span className={cn('px-2 py-0.5 text-xs rounded', getRiskLabel(indicator.riskLevel))}>
                            {indicator.riskLevel}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Volume: {formatNumber(indicator.volume)} SOL
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {indicator.cycleAddresses.slice(0, 4).map((addr, j) => (
                            <span key={j} className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">
                              {formatAddress(addr)}
                            </span>
                          ))}
                          {indicator.cycleAddresses.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{indicator.cycleAddresses.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No wash trading detected yet</p>
                    <p className="text-xs mt-1">Click detect to analyze</p>
                  </div>
                )}
              </div>
            )}

            {/* Clusters Tab */}
            {activeTab === 'clusters' && (
              <div className="space-y-3">
                <button
                  onClick={onDetectClusters}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  Detect Clusters
                </button>

                {clusters.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Found {clusters.length} clusters
                    </p>
                    {clusters.map((cluster) => (
                      <div
                        key={cluster.id}
                        onClick={() => onHighlightCluster(cluster.id)}
                        className="p-2 rounded-lg border border-border hover:border-primary/50 cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {cluster.size} wallets
                          </span>
                          <span className={cn('text-xs', getRiskColor(cluster.riskScore))}>
                            Risk: {cluster.riskScore}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Density: {(cluster.density * 100).toFixed(1)}%
                        </div>
                        {cluster.patterns.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cluster.patterns.map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-xs bg-muted rounded">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No clusters detected yet</p>
                    <p className="text-xs mt-1">Click detect to analyze</p>
                  </div>
                )}
              </div>
            )}

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div className="space-y-2">
                <button
                  onClick={onDetectWashTrading}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted text-sm"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span>Wash Trading Detection</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <button
                  onClick={onDetectClusters}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Cluster Detection</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <button
                  onClick={() => selectedAddress && onTraceFirstFunder(selectedAddress)}
                  disabled={!selectedAddress}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted text-sm disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-info" />
                    <span>Trace First Funder</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <button
                  onClick={onGenerateReport}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-success" />
                    <span>Generate Report</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
                  <div className="flex flex-wrap gap-1">
                    <button className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80">
                      Find Whales
                    </button>
                    <button className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80">
                      High Risk
                    </button>
                    <button className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80">
                      CEX Flows
                    </button>
                    <button className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80">
                      Bridges
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InvestigationPanel;
