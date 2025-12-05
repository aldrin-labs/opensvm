'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Loader2,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface TokenTransfer {
  mint: string;
  amount: number;
  decimals: number;
  direction: 'in' | 'out';
}

interface Transaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  timestamp: string | null;
  type: 'send' | 'receive' | 'swap' | 'unknown';
  status: 'success' | 'failed';
  fee: number;
  feeSOL: number;
  solChange: number | null;
  tokenTransfers: TokenTransfer[];
  counterparty: string | null;
  programs: string[];
  memo: string | null;
}

interface TransactionStats {
  totalTransactions: number;
  totalSent: number;
  totalReceived: number;
  totalFees: number;
  successCount: number;
  failedCount: number;
}

interface TransactionHistoryProps {
  walletId: string;
  walletAddress: string;
  walletName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionHistory({
  walletId,
  walletAddress,
  walletName,
  isOpen,
  onClose
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (cursor?: string) => {
    const isInitial = !cursor;
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('before', cursor);

      const response = await fetch(`/api/bank/wallets/${walletId}/history?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();

      if (isInitial) {
        setTransactions(data.transactions);
        setStats(data.stats);
      } else {
        setTransactions(prev => [...prev, ...data.transactions]);
      }

      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, walletId]);

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'send':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'receive':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'swap':
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'send':
        return <Badge variant="outline" className="text-red-500 border-red-500/50">Send</Badge>;
      case 'receive':
        return <Badge variant="outline" className="text-green-500 border-green-500/50">Receive</Badge>;
      case 'swap':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/50">Swap</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h2 className="font-semibold text-lg">Transaction History</h2>
            <p className="text-xs text-muted-foreground">
              {walletName} ({formatAddress(walletAddress)})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchHistory()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 p-4 border-b flex-shrink-0">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="font-semibold">{stats.totalTransactions}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" /> Received
              </p>
              <p className="font-semibold text-green-500">+{stats.totalReceived.toFixed(4)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-500" /> Sent
              </p>
              <p className="font-semibold text-red-500">-{stats.totalSent.toFixed(4)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Fees</p>
              <p className="font-semibold text-muted-foreground">{stats.totalFees.toFixed(6)}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchHistory()} className="mt-4">
                Retry
              </Button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.signature}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'send' ? 'bg-red-500/10' :
                      tx.type === 'receive' ? 'bg-green-500/10' :
                      tx.type === 'swap' ? 'bg-blue-500/10' : 'bg-muted'
                    }`}>
                      {getTypeIcon(tx.type)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeBadge(tx.type)}
                        {tx.status === 'failed' && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(tx.timestamp)}
                        </span>
                      </div>

                      {/* Amount */}
                      <div className="mt-1">
                        {tx.solChange !== null && Math.abs(tx.solChange) > 0.000001 && (
                          <p className={`font-mono text-sm ${
                            tx.solChange > 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {tx.solChange > 0 ? '+' : ''}{tx.solChange.toFixed(6)} SOL
                          </p>
                        )}
                        {tx.tokenTransfers.map((transfer, idx) => (
                          <p key={idx} className={`font-mono text-sm ${
                            transfer.direction === 'in' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {transfer.direction === 'in' ? '+' : '-'}{transfer.amount.toLocaleString()} {formatAddress(transfer.mint)}
                          </p>
                        ))}
                      </div>

                      {/* Counterparty */}
                      {tx.counterparty && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tx.type === 'send' ? 'To: ' : 'From: '}
                          <code className="font-mono">{formatAddress(tx.counterparty)}</code>
                        </p>
                      )}

                      {/* Fee */}
                      <p className="text-xs text-muted-foreground">
                        Fee: {tx.feeSOL.toFixed(6)} SOL
                      </p>
                    </div>

                    {/* Actions */}
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={() => nextCursor && fetchHistory(nextCursor)}
                  disabled={loadingMore}
                  className="w-full mt-4 gap-2"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Load More
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
