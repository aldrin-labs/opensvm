'use client';

import React, { useState, useMemo } from 'react';
import { useProgramActivity } from '@/hooks/useProgramActivity';
import { useProgramRegistry } from '@/contexts/ProgramRegistryContext';
import { useTheme } from '@/lib/design-system/theme-provider';
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Users, 
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Cpu,
  DollarSign,
  ExternalLink,
  Copy
} from 'lucide-react';

interface LiveActivityProps {
  programId: string;
}

export function LiveActivity({ programId }: LiveActivityProps) {
  const { activity, loading, error, refreshActivity, isLive, toggleLiveUpdates, getTransactionDetails } = useProgramActivity(programId);
  const { getProgramDisplayName } = useProgramRegistry();

  // Use it in the header to show a friendly program name
  const programDisplayName = useMemo(() => {
    return getProgramDisplayName(programId);
  }, [getProgramDisplayName, programId]);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [loadingTransaction, setLoadingTransaction] = useState(false);

  const handleTransactionClick = async (signature: string) => {
    if (selectedTransaction === signature) {
      setSelectedTransaction(null);
      setTransactionDetails(null);
      return;
    }

    setSelectedTransaction(signature);
    setLoadingTransaction(true);
    
    try {
      const details = await getTransactionDetails(signature);
      setTransactionDetails(details);
    } catch (err) {
      console.error('Error fetching transaction details:', err);
    } finally {
      setLoadingTransaction(false);
    }
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatSOL = (lamports: number) => {
    return (lamports / 1e9).toFixed(6);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const truncateSignature = (sig: string) => {
    return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading program activity...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={refreshActivity}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-400">No activity data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Live Activity - {programDisplayName}
          </h3>
          {isLive && (
            <div className="flex items-center space-x-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm">Live</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={refreshActivity}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={toggleLiveUpdates}
            className={`p-2 transition-colors ${
              isLive 
                ? 'text-green-400 hover:text-green-300' 
                : 'text-gray-400 hover:text-white'
            }`}
            title={isLive ? 'Disable live updates' : 'Enable live updates'}
          >
            {isLive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card text-card-foreground p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Accounts</p>
              <p className="text-2xl font-bold">{activity.activeAccounts.toLocaleString()}</p>
            </div>
            <Users className="w-8 h-8 text-primary" />
          </div>
          {activity.accountsGrowth !== 0 && (
            <div className="flex items-center mt-2">
              {activity.accountsGrowth > 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm ml-1 ${
                activity.accountsGrowth > 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {activity.accountsGrowth > 0 ? '+' : ''}{activity.accountsGrowth}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card text-card-foreground p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">TX Frequency</p>
              <p className="text-2xl font-bold">{activity.txFrequency.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">per hour</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold">{(activity.performanceMetrics.successRate * 100).toFixed(1)}%</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Last Activity</p>
              <p className="text-sm font-medium">
                {activity.lastActivity ? formatTimestamp(activity.lastActivity) : 'No recent activity'}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="rounded-lg border bg-card text-card-foreground p-6">
        <h4 className="text-lg font-semibold mb-4">Performance Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-yellow-500 mr-2" />
              <span className="text-sm text-muted-foreground">Avg Fee</span>
            </div>
            <p className="text-lg font-bold">{formatSOL(activity.performanceMetrics.avgTransactionFee)} SOL</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Cpu className="w-5 h-5 text-purple-500 mr-2" />
              <span className="text-sm text-muted-foreground">Avg Compute Units</span>
            </div>
            <p className="text-lg font-bold">{activity.performanceMetrics.avgComputeUnits.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Peak TPS</span>
            </div>
            <p className="text-lg font-bold">{activity.performanceMetrics.peakTps.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Popular Instructions */}
      {activity.popularInstructions.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground p-6">
          <h4 className="text-lg font-semibold mb-4">Popular Instructions</h4>
          <div className="space-y-3">
            {activity.popularInstructions.map((instruction, index) => (
              <div key={instruction.instruction} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{instruction.instruction}</p>
                    <p className="text-sm text-muted-foreground">{instruction.count} calls</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className={instruction.successRate > 0.95 ? 'text-green-500' : instruction.successRate > 0.9 ? 'text-yellow-500' : 'text-red-500'}>
                      {(instruction.successRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Avg Compute</p>
                    <p className="text-foreground">{instruction.avgComputeUnits.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="rounded-lg border bg-card text-card-foreground p-6">
        <h4 className="text-lg font-semibold mb-4">Recent Transactions</h4>
        {activity.recentTransactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No recent transactions</p>
        ) : (
          <div className="space-y-2">
            {activity.recentTransactions.slice(0, 10).map((tx) => (
              <div key={tx.signature}>
                <div 
                  className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleTransactionClick(tx.signature)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${tx.err ? 'bg-red-500' : 'bg-green-500'}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-mono text-sm">{truncateSignature(tx.signature)}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(tx.signature);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <a
                          href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Slot {tx.slot} • {formatTimestamp(tx.blockTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.confirmationStatus === 'finalized' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      tx.confirmationStatus === 'confirmed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {tx.confirmationStatus || 'Unknown'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                
                {/* Transaction Details */}
                {selectedTransaction === tx.signature && (
                  <div className="mt-2 p-4 bg-muted rounded-lg border-l-4 border-primary">
                    {loadingTransaction ? (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Loading transaction details...</span>
                      </div>
                    ) : transactionDetails ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Fee</p>
                            <p className="font-mono">{formatSOL(transactionDetails.fee)} SOL</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Compute Units</p>
                            <p className="font-mono">{transactionDetails.computeUnitsConsumed.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <div className="flex items-center space-x-2">
                              {transactionDetails.success ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className={transactionDetails.success ? 'text-green-500' : 'text-red-500'}>
                                {transactionDetails.success ? 'Success' : 'Failed'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {transactionDetails.instructions.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Instructions ({transactionDetails.instructions.length})</p>
                            <div className="space-y-2">
                              {transactionDetails.instructions.map((ix: any, idx: number) => (
                                <div key={idx} className="p-2 bg-background border rounded text-sm">
                                  <p className="font-medium">{ix.instructionName || 'Unknown Instruction'}</p>
                                  <p className="text-muted-foreground font-mono text-xs">{ix.programId}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-red-500">Failed to load transaction details</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
