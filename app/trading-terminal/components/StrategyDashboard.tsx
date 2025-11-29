/**
 * StrategyDashboard
 *
 * Main dashboard for viewing and managing autonomous trading strategies
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, DollarSign, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StrategyCard from './StrategyCard';
import CreateDCAStrategyDialog from './CreateDCAStrategyDialog';
import { strategyEngine } from '@/lib/trading/strategy-engine';
import type { Strategy } from '@/lib/trading/strategy-types';

interface StrategyDashboardProps {
  userId: string;
}

export default function StrategyDashboard({ userId }: StrategyDashboardProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load strategies
  const loadStrategies = () => {
    const allStrategies = strategyEngine.getStrategies(userId);
    setStrategies(allStrategies);
  };

  useEffect(() => {
    loadStrategies();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadStrategies();
    }, 30000);

    return () => clearInterval(interval);
  }, [userId]);

  // Manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStrategies();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filter strategies by tab
  const filteredStrategies = strategies.filter(s => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'active') return s.status === 'ACTIVE';
    if (selectedTab === 'paused') return s.status === 'PAUSED';
    if (selectedTab === 'completed') return s.status === 'COMPLETED';
    return true;
  });

  // Calculate summary stats
  const stats = {
    totalStrategies: strategies.length,
    activeStrategies: strategies.filter(s => s.status === 'ACTIVE').length,
    totalInvested: strategies.reduce((sum, s) => {
      const perf = strategyEngine.getPerformance(s.id);
      return sum + (perf?.totalInvested || 0);
    }, 0),
    totalPnL: strategies.reduce((sum, s) => {
      const perf = strategyEngine.getPerformance(s.id);
      return sum + (perf?.unrealizedPnL || 0);
    }, 0),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <Activity size={20} />
              Autonomous Trading Agents
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Set and forget. Your strategies trade automatically 24/7.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="flex items-center gap-2 bg-success hover:bg-success/90 text-white"
            >
              <Plus size={14} />
              New Strategy
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Strategies</div>
            <div className="text-2xl font-bold">{stats.totalStrategies}</div>
          </div>
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Active Agents</div>
            <div className="text-2xl font-bold text-success">{stats.activeStrategies}</div>
          </div>
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Invested</div>
            <div className="text-2xl font-bold">${stats.totalInvested.toFixed(2)}</div>
          </div>
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total PnL</div>
            <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-shrink-0 mx-4 mt-4 bg-card border-b border-border rounded-none">
          <TabsTrigger value="all">
            All ({strategies.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({strategies.filter(s => s.status === 'ACTIVE').length})
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused ({strategies.filter(s => s.status === 'PAUSED').length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({strategies.filter(s => s.status === 'COMPLETED').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="flex-1 overflow-auto p-4 mt-0">
          {filteredStrategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <TrendingUp size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Strategies Yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                {selectedTab === 'all'
                  ? "Create your first autonomous trading strategy. It'll execute automatically based on your schedule."
                  : `No ${selectedTab} strategies found.`}
              </p>
              {selectedTab === 'all' && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="flex items-center gap-2 bg-success hover:bg-success/90 text-white"
                >
                  <Plus size={16} />
                  Create First Strategy
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStrategies.map(strategy => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  performance={strategyEngine.getPerformance(strategy.id)}
                  executions={strategyEngine.getExecutions(strategy.id)}
                  onPause={() => {
                    strategyEngine.pauseStrategy(strategy.id);
                    loadStrategies();
                  }}
                  onResume={() => {
                    strategyEngine.resumeStrategy(strategy.id);
                    loadStrategies();
                  }}
                  onCancel={() => {
                    if (confirm('Are you sure you want to cancel this strategy? This cannot be undone.')) {
                      strategyEngine.cancelStrategy(strategy.id);
                      loadStrategies();
                    }
                  }}
                  onViewDetails={() => {
                    // TODO: Open details modal
                    alert(`View details for: ${strategy.name}`);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <CreateDCAStrategyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        userId={userId}
        onStrategyCreated={() => {
          loadStrategies();
        }}
      />
    </div>
  );
}
