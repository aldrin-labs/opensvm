'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef } from 'react';
import { 
  Activity, ArrowUpRight, ArrowDownRight, RefreshCw, 
  Zap, DollarSign, Clock, ExternalLink, Filter,
  TrendingUp, TrendingDown
} from 'lucide-react';
import { formatNumber, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Transaction {
  signature: string;
  timestamp: number;
  type: 'buy' | 'sell' | 'transfer' | 'unknown';
  amount: number;
  price?: number;
  value?: number;
  from: string;
  to: string;
  dex?: string;
  status: 'success' | 'failed';
}

interface Props {
  mint: string;
}

export function TokenTransactionFeed({ mint }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'large'>('all');
  const intervalRef = useRef<NodeJS.Timeout>();

  // Fetch recent transactions
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/token/${mint}/traders?limit=50`);
      if (response.ok) {
        const data = await response.json();
        
        // Transform and enrich transaction data
        const enrichedTxs = (data.transactions || []).map((tx: any) => {
          // Determine transaction type based on various factors
          let type: Transaction['type'] = 'unknown';
          if (tx.type === 'swap') {
            // Analyze swap direction
            if (tx.tokenIn?.mint === mint) {
              type = 'sell';
            } else if (tx.tokenOut?.mint === mint) {
              type = 'buy';
            }
          } else if (tx.type === 'transfer') {
            type = 'transfer';
          }
          
          return {
            signature: tx.signature,
            timestamp: tx.timestamp || Date.now(),
            type,
            amount: tx.amount || 0,
            price: tx.price,
            value: tx.value || (tx.amount * (tx.price || 0)),
            from: tx.from || '',
            to: tx.to || '',
            dex: tx.source || tx.dex,
            status: tx.status || 'success'
          };
        });
        
        setTransactions(enrichedTxs);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Setup auto-refresh
  useEffect(() => {
    fetchTransactions();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchTransactions, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [mint, autoRefresh]);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'buy') return tx.type === 'buy';
    if (filter === 'sell') return tx.type === 'sell';
    if (filter === 'large') return (tx.value || 0) > 1000; // Large transactions > $1000
    return true;
  });

  // Calculate statistics
  const stats = {
    totalTxs: filteredTransactions.length,
    buys: filteredTransactions.filter(tx => tx.type === 'buy').length,
    sells: filteredTransactions.filter(tx => tx.type === 'sell').length,
    totalVolume: filteredTransactions.reduce((sum, tx) => sum + (tx.value || 0), 0),
    avgTxSize: filteredTransactions.length > 0 
      ? filteredTransactions.reduce((sum, tx) => sum + (tx.value || 0), 0) / filteredTransactions.length 
      : 0
  };

  const buyPressure = stats.totalTxs > 0 ? (stats.buys / stats.totalTxs) * 100 : 50;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case 'sell':
        return <ArrowDownRight className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'text-green-500';
      case 'sell':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const openInExplorer = (signature: string) => {
    window.open(`https://solscan.io/tx/${signature}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Txns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTxs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Buys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.buys}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sells</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.sells}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(stats.totalVolume)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(stats.avgTxSize)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Buy/Sell Pressure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Buy/Sell Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-500">Sell</span>
            <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden relative">
              <div 
                className="h-full bg-green-500 transition-all"
                style={{ width: `${buyPressure}%` }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-xs font-medium"
              >
                {buyPressure.toFixed(0)}%
              </div>
            </div>
            <span className="text-sm text-green-500">Buy</span>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Transaction Feed
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Filter Buttons */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'buy' ? 'default' : 'outline'}
                  onClick={() => setFilter('buy')}
                >
                  Buys
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'sell' ? 'default' : 'outline'}
                  onClick={() => setFilter('sell')}
                >
                  Sells
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'large' ? 'default' : 'outline'}
                  onClick={() => setFilter('large')}
                >
                  Large
                </Button>
              </div>
              
              {/* Auto-refresh Toggle */}
              <Button
                size="sm"
                variant={autoRefresh ? 'default' : 'outline'}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin-slow")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading transactions...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found
                </div>
              ) : (
                filteredTransactions.slice(0, 50).map((tx, index) => (
                  <div 
                    key={`${tx.signature}-${index}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(tx.type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium capitalize", getTransactionColor(tx.type))}>
                            {tx.type}
                          </span>
                          {tx.dex && (
                            <Badge variant="outline" className="text-xs">
                              {tx.dex}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(tx.amount)} tokens
                          </span>
                          {tx.price && (
                            <span className="text-xs text-muted-foreground">
                              @ ${tx.price.toFixed(6)}
                            </span>
                          )}
                          {tx.value && tx.value > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              ${formatNumber(tx.value)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(tx.timestamp), 'HH:mm:ss')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(tx.timestamp), 'MMM dd')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openInExplorer(tx.signature)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Large Transactions Alert */}
      {filteredTransactions.filter(tx => (tx.value || 0) > 10000).length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <Zap className="h-5 w-5" />
              Whale Activity Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTransactions
                .filter(tx => (tx.value || 0) > 10000)
                .slice(0, 5)
                .map((tx, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded">
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(tx.type)}
                      <span className="font-medium">
                        ${formatNumber(tx.value || 0)}
                      </span>
                      <Badge variant="outline" className={getTransactionColor(tx.type)}>
                        {tx.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(tx.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
