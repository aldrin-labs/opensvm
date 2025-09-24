'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter
} from 'recharts';
import {
  TrendingUp, TrendingDown, Eye, Clock, Database, 
  Activity, Users, AlertCircle, CheckCircle, Info,
  Zap, Target, Link, History, ExternalLink, DollarSign,
  Calendar, Hash, Coins
} from 'lucide-react';
import { UserHistoryService } from '@/lib/user-history';
import { formatDistanceToNow } from 'date-fns';
import type { Transfer } from '@/app/account/[address]/components/shared/types';

interface HistoryConnection {
  address: string;
  lastVisit: number;
  balanceChange: number;
  balanceChangePercent: number;
  newTransactions: number;
  relatedAccounts: string[];
  activityScore: number;
}

interface DashboardProps {
  visibleTransfers: Transfer[];
  currentWallet?: string;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export function TransfersDashboard({ visibleTransfers, currentWallet, isCollapsed = false, onToggleCollapsed }: DashboardProps) {
  const [historyConnections, setHistoryConnections] = useState<HistoryConnection[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'history' | 'insights'>('analytics');

  // Calculate analytics from visible transfers
  const analytics = useMemo(() => {
    if (!visibleTransfers || visibleTransfers.length === 0) {
      return null;
    }

    // Token distribution
    const tokenStats = new Map<string, { count: number; volume: number }>();
    let totalVolume = 0;
    let totalUSDValue = 0;
    
    visibleTransfers.forEach(transfer => {
      const token = transfer.tokenSymbol || transfer.token || 'SOL';
      const amount = transfer.amount || 0;
      const usdValue = transfer.usdValue || 0;
      
      totalVolume += amount;
      totalUSDValue += usdValue;
      
      if (!tokenStats.has(token)) {
        tokenStats.set(token, { count: 0, volume: 0 });
      }
      const stats = tokenStats.get(token)!;
      stats.count++;
      stats.volume += amount;
    });

    // Transfer direction analysis
    const directions = {
      incoming: visibleTransfers.filter(t => t.type === 'in' || t.to === currentWallet).length,
      outgoing: visibleTransfers.filter(t => t.type === 'out' || t.from === currentWallet).length,
      internal: visibleTransfers.filter(t => t.from === currentWallet && t.to === currentWallet).length
    };

    // Time-based patterns
    const timeStats = visibleTransfers.reduce((acc, transfer) => {
      const date = new Date(transfer.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      
      acc.hourly[hour] = (acc.hourly[hour] || 0) + 1;
      acc.daily[dayOfWeek] = (acc.daily[dayOfWeek] || 0) + 1;
      
      return acc;
    }, {
      hourly: {} as Record<number, number>,
      daily: {} as Record<number, number>
    });

    // Unique addresses
    const uniqueAddresses = new Set<string>();
    visibleTransfers.forEach(transfer => {
      if (transfer.from && transfer.from !== currentWallet) uniqueAddresses.add(transfer.from);
      if (transfer.to && transfer.to !== currentWallet) uniqueAddresses.add(transfer.to);
    });

    return {
      tokenStats: Array.from(tokenStats.entries()).map(([token, stats]) => ({
        token,
        count: stats.count,
        volume: stats.volume,
        percentage: (stats.count / visibleTransfers.length) * 100
      })).sort((a, b) => b.count - a.count),
      directions,
      totalVolume,
      totalUSDValue,
      timeStats,
      uniqueAddresses: uniqueAddresses.size,
      avgTransactionSize: totalVolume / visibleTransfers.length,
      peakHour: Object.entries(timeStats.hourly).reduce((a, b) => a[1] > b[1] ? a : b)?.[0] || '0',
      mostActiveDay: Object.entries(timeStats.daily).reduce((a, b) => a[1] > b[1] ? a : b)?.[0] || '0',
    };
  }, [visibleTransfers, currentWallet]);

  // Check for history connections
  useEffect(() => {
    if (!visibleTransfers || !currentWallet) return;

    const checkConnections = async () => {
      const connections: HistoryConnection[] = [];
      const userHistory = UserHistoryService.getUserHistory(currentWallet);
      
      // Get unique addresses from visible transfers
      const addresses = new Set<string>();
      visibleTransfers.forEach(transfer => {
        if (transfer.from && transfer.from !== currentWallet) addresses.add(transfer.from);
        if (transfer.to && transfer.to !== currentWallet) addresses.add(transfer.to);
      });

      addresses.forEach(address => {
        // Find historical visits to this address
        const historyEntry = userHistory.find(entry => 
          entry.metadata?.accountAddress === address ||
          entry.path.includes(address)
        );

        if (historyEntry) {
          // Calculate mock changes for demo (in real implementation, would fetch actual data)
          const daysSinceVisit = Math.floor((Date.now() - historyEntry.timestamp) / (1000 * 60 * 60 * 24));
          const mockBalanceChange = Math.random() * 1000 - 500; // Random change for demo
          const mockNewTxs = Math.floor(Math.random() * 20);
          
          connections.push({
            address,
            lastVisit: historyEntry.timestamp,
            balanceChange: mockBalanceChange,
            balanceChangePercent: Math.random() * 40 - 20, // -20% to +20%
            newTransactions: mockNewTxs,
            relatedAccounts: [], // Would be fetched from API
            activityScore: Math.floor(Math.random() * 100)
          });
        }
      });

      setHistoryConnections(connections);
    };

    checkConnections();
  }, [visibleTransfers, currentWallet]);

  const formatSOL = (amount: number) => {
    if (amount < 0.001) return `${(amount * 1000000).toFixed(0)} µSOL`;
    if (amount < 1) return `${amount.toFixed(3)} SOL`;
    if (amount < 1000) return `${amount.toFixed(2)} SOL`;
    return `${(amount / 1000).toFixed(1)}K SOL`;
  };

  const formatUSD = (amount: number) => {
    if (amount < 1000) return `$${amount.toFixed(2)}`;
    if (amount < 1000000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const getDayName = (day: string) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[parseInt(day)] || 'Unknown';
  };

  if (!visibleTransfers || visibleTransfers.length === 0) {
    return (
      <div className="bg-black border border-white/20 rounded-sm p-6 h-fit min-w-[320px]">
        <div className="text-center py-12">
          <Eye className="w-12 h-12 text-white/60 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Data Visible</h3>
          <p className="text-white/60">Scroll through the table to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black border border-white/20 rounded-sm transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-full min-w-[320px]'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold text-white ${isCollapsed ? 'hidden' : 'block'}`}>
            Transfer Insights
          </h3>
          <button
            onClick={onToggleCollapsed}
            className="p-2 hover:bg-white/10 rounded-sm transition-colors text-white"
          >
            {isCollapsed ? <Target className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {isCollapsed ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{visibleTransfers.length}</div>
              <div className="text-xs text-white/60">Visible</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">
                {analytics ? formatSOL(analytics.totalVolume) : '0'}
              </div>
              <div className="text-xs text-white/60">Volume</div>
            </div>
            {historyConnections.length > 0 && (
              <div className="text-center">
                <div className="text-sm font-bold text-purple-400">{historyConnections.length}</div>
                <div className="text-xs text-white/60">Seen Before</div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex space-x-2 mb-6 bg-white/10 rounded-sm p-1">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  activeTab === 'analytics' 
                    ? 'bg-white text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                ANALYTICS
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  activeTab === 'history' 
                    ? 'bg-white text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <History className="w-4 h-4 inline mr-2" />
                HISTORY
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex-1 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  activeTab === 'insights' 
                    ? 'bg-white text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4 inline mr-2" />
                INSIGHTS
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 border border-white/20 rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {visibleTransfers.length}
                    </div>
                    <div className="text-sm text-white/60">Visible Transfers</div>
                  </div>
                  <Hash className="w-8 h-8 text-white/60" />
                </div>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {analytics ? formatSOL(analytics.totalVolume) : '0'}
                    </div>
                    <div className="text-sm text-white/60">Total Volume</div>
                  </div>
                  <Coins className="w-8 h-8 text-white/60" />
                </div>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'analytics' && analytics && (
              <div className="space-y-6">
                {/* Token Distribution */}
                <div>
                  <h4 className="text-md font-semibold mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-blue-400" />
                    Token Distribution
                  </h4>
                  {analytics.tokenStats.length > 1 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.tokenStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="count"
                            nameKey="token"
                          >
                            {analytics.tokenStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              `${value} transfers`, 
                              name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/60">
                      Single token: {analytics.tokenStats[0]?.token || 'Unknown'}
                    </div>
                  )}
                </div>

                {/* Transfer Direction */}
                <div>
                  <h4 className="text-md font-semibold mb-3 flex items-center">
                    <ExternalLink className="w-4 h-4 mr-2 text-green-400" />
                    Transfer Flow
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-sm p-3 text-center">
                      <div className="text-lg font-bold text-green-400">{analytics.directions.incoming}</div>
                      <div className="text-white/60">Incoming</div>
                    </div>
                    <div className="bg-red-900/20 border border-red-500/30 rounded-sm p-3 text-center">
                      <div className="text-lg font-bold text-red-400">{analytics.directions.outgoing}</div>
                      <div className="text-white/60">Outgoing</div>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-sm p-3 text-center">
                      <div className="text-lg font-bold text-blue-400">{analytics.uniqueAddresses}</div>
                      <div className="text-white/60">Unique</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <h4 className="text-md font-semibold flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-purple-400" />
                  Historical Connections
                </h4>
                
                {historyConnections.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {historyConnections.map((connection, index) => (
                      <div key={index} className="bg-purple-900/20 border border-purple-500/30 rounded-sm p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-sm text-white">
                            {connection.address.slice(0, 8)}...{connection.address.slice(-4)}
                          </div>
                          <div className="text-xs text-purple-400">
                            {formatDistanceToNow(connection.lastVisit)} ago
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          <div className={`flex items-center ${
                            connection.balanceChange > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {connection.balanceChange > 0 ? 
                              <TrendingUp className="w-3 h-3 mr-1" /> : 
                              <TrendingDown className="w-3 h-3 mr-1" />
                            }
                            {connection.balanceChangePercent.toFixed(1)}%
                          </div>
                          <div className="text-white/60">
                            +{connection.newTransactions} new txs
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-white/60">Activity Score</div>
                          <div className="text-xs font-medium text-purple-400">
                            {connection.activityScore}/100
                          </div>
                        </div>
                        
                        <div className="mt-2 w-full bg-white/10 rounded-full h-1">
                          <div 
                            className="h-1 rounded-full bg-purple-400 transition-all duration-300"
                            style={{ width: `${connection.activityScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No historical connections found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'insights' && analytics && (
              <div className="space-y-4">
                <h4 className="text-md font-semibold flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                  Smart Insights
                </h4>
                
                <div className="space-y-3">
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-sm p-3">
                    <div className="flex items-center mb-2">
                      <Info className="w-4 h-4 text-blue-400 mr-2" />
                      <span className="text-sm font-medium text-blue-400">Pattern Analysis</span>
                    </div>
                    <p className="text-xs text-white/80">
                      Peak activity at {analytics.peakHour}:00, most active on {getDayName(analytics.mostActiveDay)}
                    </p>
                  </div>

                  <div className="bg-green-900/20 border border-green-500/30 rounded-sm p-3">
                    <div className="flex items-center mb-2">
                      <DollarSign className="w-4 h-4 text-green-400 mr-2" />
                      <span className="text-sm font-medium text-green-400">Volume Analysis</span>
                    </div>
                    <p className="text-xs text-white/80">
                      Average: {formatSOL(analytics.avgTransactionSize)} per transfer
                      {analytics.totalUSDValue > 0 && ` (~${formatUSD(analytics.totalUSDValue)})`}
                    </p>
                  </div>

                  {historyConnections.length > 0 && (
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-sm p-3">
                      <div className="flex items-center mb-2">
                        <History className="w-4 h-4 text-purple-400 mr-2" />
                        <span className="text-sm font-medium text-purple-400">You've Been Here</span>
                      </div>
                      <p className="text-xs text-white/80">
                        {historyConnections.length} wallet{historyConnections.length > 1 ? 's' : ''} from your browsing history
                      </p>
                    </div>
                  )}

                  {analytics.tokenStats.length > 1 && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-sm p-3">
                      <div className="flex items-center mb-2">
                        <Target className="w-4 h-4 text-yellow-400 mr-2" />
                        <span className="text-sm font-medium text-yellow-400">Diversification</span>
                      </div>
                      <p className="text-xs text-white/80">
                        Active with {analytics.tokenStats.length} different tokens, 
                        top: {analytics.tokenStats[0]?.token} ({analytics.tokenStats[0]?.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
