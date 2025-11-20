'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter
} from 'recharts';
import {
  TrendingUp, TrendingDown, Eye, Clock, Database, 
  Activity, Users, AlertCircle, CheckCircle, Info,
  Zap, Target, Link, History
} from 'lucide-react';
import { ViewportStats } from '@/lib/ui/viewport-tracker';
import { UserHistoryService } from '@/lib/user/user-history';
import { formatDistanceToNow } from 'date-fns';

interface ProgramAccount {
  address: string;
  data: string;
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  dataSize: number;
  decoded?: any;
}

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
  viewportStats: ViewportStats | null;
  programId: string;
  currentWallet?: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export function IntelligentDashboard({ viewportStats, programId, currentWallet }: DashboardProps) {
  const [historyConnections, setHistoryConnections] = useState<HistoryConnection[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'history' | 'connections'>('analytics');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate analytics from visible accounts
  const analytics = useMemo(() => {
    if (!viewportStats || viewportStats.visibleItems.length === 0) {
      return null;
    }

    const accounts = viewportStats.visibleItems.map(item => item.data) as ProgramAccount[];
    
    // Balance distribution
    const balanceRanges = [
      { name: '0-0.1 SOL', value: 0, count: 0 },
      { name: '0.1-1 SOL', value: 0, count: 0 },
      { name: '1-10 SOL', value: 0, count: 0 },
      { name: '10+ SOL', value: 0, count: 0 }
    ];

    accounts.forEach(account => {
      const sol = account.lamports / 1e9;
      if (sol <= 0.1) {
        balanceRanges[0].value += account.lamports;
        balanceRanges[0].count++;
      } else if (sol <= 1) {
        balanceRanges[1].value += account.lamports;
        balanceRanges[1].count++;
      } else if (sol <= 10) {
        balanceRanges[2].value += account.lamports;
        balanceRanges[2].count++;
      } else {
        balanceRanges[3].value += account.lamports;
        balanceRanges[3].count++;
      }
    });

    // Data size distribution
    const sizeDistribution = accounts.map(account => ({
      address: account.address.slice(0, 8) + '...',
      size: account.dataSize,
      balance: account.lamports / 1e9
    }));

    // Account health scores
    const healthScores = accounts.map(account => {
      let score = 0;
      
      // Balance score (0-40 points)
      const sol = account.lamports / 1e9;
      score += Math.min(sol * 10, 40);
      
      // Data size score (0-30 points)
      if (account.dataSize > 0) score += 20;
      if (account.dataSize > 1000) score += 10;
      
      // Executable bonus (0-30 points)
      if (account.executable) score += 30;
      
      return {
        address: account.address.slice(0, 8) + '...',
        score: Math.min(score, 100),
        balance: sol
      };
    });

    return {
      balanceRanges: balanceRanges.filter(range => range.count > 0),
      sizeDistribution,
      healthScores,
      totalBalance: accounts.reduce((sum, acc) => sum + acc.lamports, 0) / 1e9,
      avgDataSize: accounts.reduce((sum, acc) => sum + acc.dataSize, 0) / accounts.length,
      executablePercent: (accounts.filter(acc => acc.executable).length / accounts.length) * 100
    };
  }, [viewportStats]);

  // Check for history connections
  useEffect(() => {
    if (!viewportStats || !currentWallet) return;

    const checkConnections = async () => {
      const connections: HistoryConnection[] = [];
      const userHistory = UserHistoryService.getUserHistory(currentWallet);
      
      viewportStats.visibleItems.forEach(item => {
        const account = item.data as ProgramAccount;
        
        // Find historical visits to this account
        const historyEntry = userHistory.find(entry => 
          entry.metadata?.accountAddress === account.address ||
          entry.path.includes(account.address)
        );

        if (historyEntry) {
          // Only add connection if we have real historical data
          connections.push({
            address: account.address,
            lastVisit: historyEntry.timestamp,
            balanceChange: 0, // TODO: Implement real balance change tracking
            balanceChangePercent: 0,
            newTransactions: 0, // TODO: Fetch real transaction count
            relatedAccounts: [], // TODO: Fetch real related accounts
            activityScore: 0 // TODO: Calculate real activity score
          });
        }
      });

      setHistoryConnections(connections);
    };

    checkConnections();
  }, [viewportStats, currentWallet]);

  const formatSOL = (lamports: number) => {
    return (lamports / 1e9).toFixed(6);
  };

  const formatDataSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!viewportStats || viewportStats.totalVisible === 0) {
    return (
      <div className="bg-black border border-white/20 rounded-sm p-6 h-fit">
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
      isCollapsed ? 'w-16' : 'w-full'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold text-white ${isCollapsed ? 'hidden' : 'block'}`}>
            Live Dashboard
          </h3>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-white/10 rounded-sm transition-colors text-white"
          >
            {isCollapsed ? <Target className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {isCollapsed ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{viewportStats.totalVisible}</div>
              <div className="text-xs text-white/60">Visible</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">
                {formatSOL(viewportStats.totalBalance)}
              </div>
              <div className="text-xs text-white/60">SOL</div>
            </div>
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
                onClick={() => setActiveTab('connections')}
                className={`flex-1 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  activeTab === 'connections' 
                    ? 'bg-white text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Link className="w-4 h-4 inline mr-2" />
                INSIGHTS
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 border border-white/20 rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {viewportStats.totalVisible}
                    </div>
                    <div className="text-sm text-white/60">Visible Accounts</div>
                  </div>
                  <Users className="w-8 h-8 text-white/60" />
                </div>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {analytics ? analytics.totalBalance.toFixed(2) : '0'} SOL
                    </div>
                    <div className="text-sm text-white/60">Total Balance</div>
                  </div>
                  <Database className="w-8 h-8 text-white/60" />
                </div>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'analytics' && analytics && (
              <div className="space-y-6">
                {/* Balance Distribution */}
                <div>
                  <h4 className="text-md font-semibold mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-blue-400" />
                    Balance Distribution
                  </h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.balanceRanges}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="count"
                          nameKey="name"
                        >
                          {analytics.balanceRanges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `${value} accounts`, 
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Account Health Scores */}
                <div>
                  <h4 className="text-md font-semibold mb-3 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                    Health Scores
                  </h4>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.healthScores.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="address" stroke="#9CA3AF" fontSize={10} />
                        <YAxis stroke="#9CA3AF" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151' 
                          }}
                        />
                        <Bar dataKey="score" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
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
                  <div className="space-y-3">
                    {historyConnections.map((connection, index) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-sm">
                            {connection.address.slice(0, 8)}...
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDistanceToNow(connection.lastVisit)} ago
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`flex items-center ${
                            connection.balanceChange > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {connection.balanceChange > 0 ? 
                              <TrendingUp className="w-3 h-3 mr-1" /> : 
                              <TrendingDown className="w-3 h-3 mr-1" />
                            }
                            {connection.balanceChangePercent.toFixed(1)}%
                          </div>
                          <div className="text-gray-400">
                            {connection.newTransactions} new txs
                          </div>
                        </div>
                        
                        <div className="mt-2 w-full bg-gray-600 rounded-full h-1">
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
                    <p className="text-gray-400 text-sm">No historical data found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'connections' && (
              <div className="space-y-4">
                <h4 className="text-md font-semibold flex items-center">
                  <Link className="w-4 h-4 mr-2 text-cyan-400" />
                  Smart Insights
                </h4>
                
                <div className="space-y-3">
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                    <div className="flex items-center mb-2">
                      <Info className="w-4 h-4 text-blue-400 mr-2" />
                      <span className="text-sm font-medium text-blue-400">Pattern Detected</span>
                    </div>
                    <p className="text-xs text-gray-300">
                      {analytics?.executablePercent.toFixed(0)}% of visible accounts are executable programs
                    </p>
                  </div>

                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                      <span className="text-sm font-medium text-green-400">Opportunity</span>
                    </div>
                    <p className="text-xs text-gray-300">
                      Average data size: {analytics ? formatDataSize(analytics.avgDataSize) : 'N/A'}
                    </p>
                  </div>

                  {historyConnections.length > 0 && (
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                      <div className="flex items-center mb-2">
                        <History className="w-4 h-4 text-purple-400 mr-2" />
                        <span className="text-sm font-medium text-purple-400">You've Been Here</span>
                      </div>
                      <p className="text-xs text-gray-300">
                        {historyConnections.length} account{historyConnections.length > 1 ? 's' : ''} match your browsing history
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
