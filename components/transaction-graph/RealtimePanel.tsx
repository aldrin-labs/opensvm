'use client';

import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  X,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Zap,
  Clock,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealtimeTransaction {
  signature: string;
  blockTime: number;
  from: string;
  to: string;
  amount: number;
  tokenSymbol: string;
  type: string;
}

interface RealtimePanelProps {
  isConnected: boolean;
  isSubscribed: boolean;
  subscribedAccounts: string[];
  pendingTransactions: RealtimeTransaction[];
  lastUpdate: number | null;
  error: string | null;
  stats: {
    transactionsReceived: number;
    animationsPlayed: number;
    connectionAttempts: number;
  };
  currentAccount: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleAccount: (account: string) => void;
  onClearTransactions: () => void;
  className?: string;
}

export const RealtimePanel: React.FC<RealtimePanelProps> = ({
  isConnected,
  isSubscribed,
  subscribedAccounts,
  pendingTransactions,
  lastUpdate,
  error,
  stats,
  currentAccount,
  onConnect,
  onDisconnect,
  onToggleAccount,
  onClearTransactions,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const isCurrentAccountSubscribed = subscribedAccounts.includes(currentAccount);

  return (
    <div className={cn(
      'absolute bottom-4 left-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg transition-all duration-300',
      isExpanded ? 'w-80' : 'w-auto',
      className
    )}>
      {/* Collapsed view */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors',
            isSubscribed && 'ring-2 ring-success/50'
          )}
        >
          <div className="relative">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-success" />
            ) : (
              <WifiOff className="w-5 h-5 text-muted-foreground" />
            )}
            {isSubscribed && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-sm font-medium">
            {isSubscribed ? 'Live' : 'Realtime'}
          </span>
          {stats.transactionsReceived > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {stats.transactionsReceived}
            </span>
          )}
        </button>
      )}

      {/* Expanded view */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="relative">
                {isConnected ? (
                  <Wifi className="w-5 h-5 text-success" />
                ) : (
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                )}
                {isSubscribed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <p className="font-medium">Realtime Updates</p>
                <p className="text-xs text-muted-foreground">
                  {isConnected ? 'Connected to Solana' : 'Disconnected'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3">
            {/* Error */}
            {error && (
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Connection control */}
            <div className="flex gap-2">
              {!isConnected ? (
                <button
                  onClick={onConnect}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-success/10 hover:bg-success/20 text-success transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Connect
                </button>
              ) : (
                <button
                  onClick={onDisconnect}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Disconnect
                </button>
              )}
            </div>

            {/* Current account subscription */}
            {currentAccount && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Track Account
                </p>
                <button
                  onClick={() => onToggleAccount(currentAccount)}
                  disabled={!isConnected}
                  className={cn(
                    'w-full flex items-center justify-between p-2 rounded-lg border transition-colors',
                    isCurrentAccountSubscribed
                      ? 'border-success/50 bg-success/5'
                      : 'border-border hover:border-primary/50',
                    !isConnected && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Radio className={cn(
                      'w-4 h-4',
                      isCurrentAccountSubscribed ? 'text-success' : 'text-muted-foreground'
                    )} />
                    <span className="font-mono text-sm">{formatAddress(currentAccount)}</span>
                  </div>
                  {isCurrentAccountSubscribed && (
                    <span className="px-1.5 py-0.5 text-xs bg-success/10 text-success rounded">
                      LIVE
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Stats */}
            {isConnected && (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-muted/50 text-center">
                  <Zap className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{stats.transactionsReceived}</p>
                  <p className="text-xs text-muted-foreground">Received</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 text-center">
                  <Activity className="w-4 h-4 mx-auto mb-1 text-success" />
                  <p className="text-lg font-semibold">{stats.animationsPlayed}</p>
                  <p className="text-xs text-muted-foreground">Animated</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-info" />
                  <p className="text-sm font-semibold">
                    {lastUpdate ? formatTimeAgo(lastUpdate) : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Last update</p>
                </div>
              </div>
            )}

            {/* Recent transactions */}
            {pendingTransactions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Recent Transactions
                  </p>
                  <button
                    onClick={onClearTransactions}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    title="Clear"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {pendingTransactions.slice(-5).reverse().map((tx, i) => (
                    <a
                      key={tx.signature}
                      href={`/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg border border-border',
                        'hover:border-primary/50 hover:bg-primary/5 transition-colors',
                        i === 0 && 'animate-pulse bg-success/5 border-success/30'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                        <span className="font-mono text-xs">
                          {tx.signature.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-success">
                          {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} {tx.tokenSymbol}
                        </span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {isSubscribed && pendingTransactions.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
                <p className="text-sm">Waiting for transactions...</p>
                <p className="text-xs mt-1">New transactions will appear here</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RealtimePanel;
