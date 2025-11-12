'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowDown, ArrowUp, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  token: string;
  timestamp: Date;
  type: 'transfer' | 'stake' | 'swap' | 'receive';
}

interface AssetFlowTimelineProps {
  wallets: Array<{ id: string; name: string }>;
}

export function AssetFlowTimeline({ wallets }: AssetFlowTimelineProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  
  // Mock transaction data - in production, fetch from API
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      from: wallets[0]?.id || 'wallet1',
      to: wallets[1]?.id || 'wallet2',
      amount: 25,
      token: 'SOL',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      type: 'transfer',
    },
    {
      id: '2',
      from: wallets[1]?.id || 'wallet2',
      to: 'external',
      amount: 10,
      token: 'SOL',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      type: 'stake',
    },
    {
      id: '3',
      from: 'external',
      to: wallets[0]?.id || 'wallet1',
      amount: 50,
      token: 'USDC',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      type: 'receive',
    },
  ];
  
  const getWalletName = (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    return wallet ? wallet.name : 'External';
  };
  
  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'transfer':
        return <ArrowRight className="h-4 w-4" />;
      case 'stake':
        return <TrendingUp className="h-4 w-4" />;
      case 'receive':
        return <ArrowDown className="h-4 w-4 text-green-500" />;
      case 'swap':
        return <Activity className="h-4 w-4" />;
    }
  };
  
  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'transfer':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
      case 'stake':
        return 'bg-purple-500/20 border-purple-500/30 text-purple-400';
      case 'receive':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'swap':
        return 'bg-orange-500/20 border-orange-500/30 text-orange-400';
    }
  };
  
  const groupByDay = (transactions: Transaction[]) => {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(tx => {
      const day = tx.timestamp.toLocaleDateString();
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day)!.push(tx);
    });
    
    return Array.from(groups.entries()).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  };
  
  const groupedTransactions = groupByDay(mockTransactions);
  
  // Calculate flow direction for each wallet
  const walletFlows = wallets.map(wallet => {
    const outgoing = mockTransactions
      .filter(tx => tx.from === wallet.id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const incoming = mockTransactions
      .filter(tx => tx.to === wallet.id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const net = incoming - outgoing;
    
    return {
      wallet,
      outgoing,
      incoming,
      net,
      trend: net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral',
    };
  });
  
  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Asset Flow Timeline
            </CardTitle>
            <CardDescription>
              Track asset movement across your wallet ecosystem
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Flow Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {walletFlows.map(({ wallet, incoming, outgoing, net, trend }) => (
            <div
              key={wallet.id}
              className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{wallet.name}</span>
                {trend === 'positive' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : trend === 'negative' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Activity className="h-4 w-4 text-slate-500" />
                )}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Incoming</span>
                  <span className="text-green-400 font-mono">+${incoming.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Outgoing</span>
                  <span className="text-red-400 font-mono">-${outgoing.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-700 pt-1">
                  <span>Net Flow</span>
                  <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {net >= 0 ? '+' : ''}${net.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Timeline */}
        <div className="space-y-4">
          {groupedTransactions.map(([day, transactions]) => (
            <div key={day} className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {new Date(day).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Badge>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent" />
              </div>
              
              <div className="space-y-2 pl-4 border-l-2 border-slate-700">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`p-3 rounded-lg border ${getTypeColor(tx.type)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">
                          {getTypeIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm capitalize">
                              {tx.type}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {tx.token}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="font-medium">{getWalletName(tx.from)}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium">{getWalletName(tx.to)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm">
                          {tx.amount} {tx.token}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx.timestamp.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {mockTransactions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No transactions in this time range</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
