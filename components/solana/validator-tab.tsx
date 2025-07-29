'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Server, TrendingUp, TrendingDown, MapPin, Users, Zap, Shield } from 'lucide-react';
import { TrendingCarousel } from './trending-carousel';

interface ValidatorData {
  validators: Array<{
    voteAccount: string;
    name: string;
    commission: number;
    activatedStake: number;
    lastVote: number;
    rootSlot: number;
    credits: number;
    epochCredits: number;
    version: string;
    status: 'active' | 'delinquent' | 'inactive';
    datacenter?: string;
    country?: string;
    apy: number;
    performanceScore: number;
    uptimePercent: number;
  }>;
  rpcNodes?: Array<{
    pubkey: string;
    gossip: string;
    rpc: string | null;
    tpu: string;
    version: string | null;
    datacenter?: string;
    country?: string;
  }>;
  networkStats: {
    totalValidators: number;
    activeValidators: number;
    delinquentValidators: number;
    totalStake: number;
    averageCommission: number;
    nakamotoCoefficient: number;
    averageUptime: number;
    networkHealth: 'excellent' | 'good' | 'fair' | 'poor';
    totalRpcNodes?: number;
  };
  decentralization: {
    geograficDistribution: Array<{
      country: string;
      validatorCount: number;
      stakePercent: number;
    }>;
    datacenterDistribution: Array<{
      datacenter: string;
      validatorCount: number;
      stakePercent: number;
    }>;
    clientDistribution: Array<{
      version: string;
      validatorCount: number;
      percent: number;
    }>;
  };
  health: {
    isHealthy: boolean;
    lastUpdate: number;
    monitoredValidators: number;
    issues: string[];
  };
}

export function ValidatorTab() {
  const router = useRouter();
  const [data, setData] = useState<ValidatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'stake' | 'commission' | 'performance' | 'uptime'>('stake');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [activeTab, setActiveTab] = useState<'validators' | 'rpc-nodes'>('validators');

  const fetchValidatorData = async () => {
    try {
      const response = await fetch('/api/analytics/validators');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch validator data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchValidatorData();
    const interval = setInterval(fetchValidatorData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const formatSOL = (lamports: number | undefined | null) => {
    if (lamports == null || isNaN(lamports)) return '0.00 SOL';
    const sol = lamports / 1e9; // Convert lamports to SOL
    if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
    if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
    return `${sol.toFixed(2)} SOL`;
  };

  const formatPercent = (value: number | undefined | null, isAlreadyPercent: boolean = false) => {
    if (value == null || isNaN(value)) return '0.00%';
    
    // If value is already a percentage (0-100), don't multiply by 100
    const percent = isAlreadyPercent ? value : value * 100;
    
    // Ensure percentage doesn't exceed 100%
    const clampedPercent = Math.min(Math.max(percent, 0), 100);
    
    return `${clampedPercent.toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-accent bg-accent/10';
      case 'delinquent': return 'text-secondary bg-secondary/20';
      case 'inactive': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 0.95) return 'text-accent';
    if (score >= 0.85) return 'text-secondary';
    if (score >= 0.7) return 'text-muted-foreground';
    return 'text-destructive';
  };

  const sortValidators = (validators: any[]) => {
    return [...validators].sort((a, b) => {
      switch (sortBy) {
        case 'stake':
          return b.activatedStake - a.activatedStake;
        case 'commission':
          return a.commission - b.commission;
        case 'performance':
          return b.performanceScore - a.performanceScore;
        case 'uptime':
          return b.uptimePercent - a.uptimePercent;
        default:
          return 0;
      }
    });
  };

  const getPaginatedValidators = (validators: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return validators.slice(startIndex, endIndex);
  };

  const getTotalPages = (validators: any[]) => {
    return Math.ceil(validators.length / itemsPerPage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading validator data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-8 w-8 mr-2" />
        <span>Error: {error}</span>
        <button
          onClick={fetchValidatorData}
          className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span>No data available</span>
      </div>
    );
  }

  const sortedValidators = sortValidators(data.validators);
  const paginatedValidators = activeTab === 'validators' ? getPaginatedValidators(sortedValidators) : [];
  const totalPages = activeTab === 'validators' ? getTotalPages(sortedValidators) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Validators & RPC Nodes</h2>
          <p className="text-muted-foreground">Complete list of consensus validators and RPC endpoints with real-time metrics and performance tracking</p>
        </div>
      </div>

      {/* Network Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="bg-background border rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Validators</p>
              <p className="text-2xl font-bold">{data.networkStats.activeValidators}</p>
              <p className="text-xs text-muted-foreground">of {data.networkStats.totalValidators} total</p>
            </div>
            <Server className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="bg-background border rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">RPC Nodes</p>
              <p className="text-2xl font-bold">{data.networkStats.totalRpcNodes || 0}</p>
              <p className="text-xs text-muted-foreground">public endpoints</p>
            </div>
            <Users className="h-8 w-8 text-secondary" />
          </div>
        </div>

        <div className="bg-background border rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Stake</p>
              <p className="text-2xl font-bold">{formatSOL(data.networkStats.totalStake)}</p>
              <p className="text-xs text-muted-foreground">across all validators</p>
            </div>
            <Zap className="h-8 w-8 text-accent" />
          </div>
        </div>

        <div className="bg-background border rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nakamoto Coefficient</p>
              <p className="text-2xl font-bold">{data.networkStats.nakamotoCoefficient}</p>
              <p className="text-xs text-muted-foreground">validators to halt network</p>
            </div>
            <Shield className="h-8 w-8 text-secondary" />
          </div>
        </div>

        <div className="bg-background border rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Uptime</p>
              <p className={`text-2xl font-bold ${getPerformanceColor(data.networkStats.averageUptime)}`}>
                {formatPercent(data.networkStats.averageUptime)}
              </p>
              <p className="text-xs text-muted-foreground">network wide</p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Trending Validators Carousel */}
      <TrendingCarousel 
        onValidatorClick={(voteAccount) => {
          // TODO: Implement scroll to validator in table or highlight
          console.log('Clicked trending validator:', voteAccount);
        }}
      />

      {/* Tab Navigation */}
      <div className="bg-background border rounded-lg shadow">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => {
                setActiveTab('validators');
                setCurrentPage(1);
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'validators'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Consensus Validators ({data.validators.length})
            </button>
            {data.rpcNodes && data.rpcNodes.length > 0 && (
              <button
                onClick={() => {
                  setActiveTab('rpc-nodes');
                  setCurrentPage(1);
                }}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'rpc-nodes'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                RPC Nodes ({data.rpcNodes.length})
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'validators' && (
          <div className="bg-background border rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Consensus Validators</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, sortedValidators.length)} of {sortedValidators.length} validators
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1); // Reset to first page when changing page size
                      }}
                      className="border rounded px-3 py-1 text-sm bg-background"
                    >
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value={sortedValidators.length}>All ({sortedValidators.length})</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="border rounded px-3 py-1 text-sm bg-background"
                    >
                      <option value="stake">Activated Stake</option>
                      <option value="commission">Commission</option>
                      <option value="performance">Performance</option>
                      <option value="uptime">Uptime</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-3 font-medium">Rank</th>
                      <th className="pb-3 font-medium">Validator</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Activated Stake</th>
                      <th className="pb-3 font-medium">Commission</th>
                      <th className="pb-3 font-medium">APY</th>
                      <th className="pb-3 font-medium">Performance</th>
                      <th className="pb-3 font-medium">Uptime</th>
                      <th className="pb-3 font-medium">Location</th>
                      <th className="pb-3 font-medium">Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedValidators.map((validator, index) => {
                      const globalIndex = (currentPage - 1) * itemsPerPage + index;
                      return (
                        <tr key={validator.voteAccount} className="border-b hover:bg-muted/50">
                          <td className="py-3 font-medium">#{globalIndex + 1}</td>
                          <td className="py-3">
                            <div>
                              <div className="font-medium">{validator.name || 'Unknown'}</div>
                              <button
                                onClick={() => router.push(`/validator/${validator.voteAccount}`)}
                                className="text-xs text-primary hover:text-primary/80 underline cursor-pointer"
                              >
                                {validator.voteAccount.slice(0, 8)}...{validator.voteAccount.slice(-8)}
                              </button>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(validator.status)}`}>
                              {validator.status}
                            </span>
                          </td>
                          <td className="py-3">{formatSOL(validator.activatedStake)}</td>
                          <td className="py-3">{formatPercent(validator.commission, true)}</td>
                          <td className="py-3">
                            <div className={`font-medium ${
                              validator.apy >= 7 ? 'text-accent' : 
                              validator.apy >= 5 ? 'text-secondary' : 'text-destructive'
                            }`}>
                              {validator.apy ? validator.apy.toFixed(2) : '0.00'}%
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${validator.performanceScore * 100}%` }}
                                />
                              </div>
                              <span className={`text-sm font-medium ${getPerformanceColor(validator.performanceScore)}`}>
                                {formatPercent(validator.performanceScore)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`font-medium ${getPerformanceColor(validator.uptimePercent / 100)}`}>
                              {formatPercent(validator.uptimePercent, true)}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {validator.country || 'Unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {validator.datacenter || 'Unknown DC'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="text-sm">{validator.version}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-6 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                      >
                        Next
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 text-sm border rounded ${
                              currentPage === pageNum 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rpc-nodes' && data.rpcNodes && (
          <div className="bg-background border rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">RPC Nodes</h3>
                  <p className="text-sm text-muted-foreground">
                    Public RPC endpoints available for API access
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-3 font-medium">Node ID</th>
                      <th className="pb-3 font-medium">RPC Endpoint</th>
                      <th className="pb-3 font-medium">Gossip</th>
                      <th className="pb-3 font-medium">TPU</th>
                      <th className="pb-3 font-medium">Version</th>
                      <th className="pb-3 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rpcNodes.map((node, index) => (
                      <tr key={node.pubkey} className="border-b hover:bg-muted/50">
                        <td className="py-3">
                          <span className="text-sm">
                            {node.pubkey.slice(0, 8)}...{node.pubkey.slice(-8)}
                          </span>
                        </td>
                        <td className="py-3">
                          {node.rpc ? (
                            <span className="text-sm text-accent">{node.rpc}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not available</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="text-sm">{node.gossip}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm">{node.tpu}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm">{node.version || 'Unknown'}</span>
                        </td>
                        <td className="py-3">
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {node.country || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {node.datacenter || 'Unknown DC'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decentralization Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-background border rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Geographic Distribution</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {data.decentralization.geograficDistribution.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.country}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{item.validatorCount}</span>
                    <div className="text-xs text-muted-foreground">{formatPercent(item.stakePercent, true)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-background border rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Datacenter Distribution</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {data.decentralization.datacenterDistribution.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.datacenter}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{item.validatorCount}</span>
                    <div className="text-xs text-muted-foreground">{formatPercent(item.stakePercent, true)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-background border rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Client Distribution</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {data.decentralization.clientDistribution.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.version}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{item.validatorCount}</span>
                    <div className="text-xs text-muted-foreground">{formatPercent(item.percent, true)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}