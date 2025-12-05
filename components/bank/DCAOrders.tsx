'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  Plus,
  Loader2,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  ArrowRight,
  DollarSign
} from 'lucide-react';

interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  balance: number;
}

interface DCAOrder {
  id: string;
  walletName: string;
  inputSymbol: string;
  outputSymbol: string;
  amountPerSwap: number;
  frequency: string;
  status: 'active' | 'paused' | 'completed' | 'exhausted';
  totalSwapped: number;
  totalReceived: number;
  swapCount: number;
  averagePrice: number;
  nextSwapAt: number;
  totalBudget?: number;
  maxSwaps?: number;
  label?: string;
}

interface DCAOrdersProps {
  wallets: ManagedWallet[];
  isOpen: boolean;
  onClose: () => void;
}

// Popular token pairs
const POPULAR_TOKENS = [
  { mint: 'So11111111111111111111111111111111111112', symbol: 'SOL' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
  { mint: 'JUPyiWrYvFmk5uBTwu1kggV38pSakeUtp8rK', symbol: 'JUP' },
  { mint: 'DezXAZ8z7PnyWe8fgJHR2A2fTQHYPT7YdN3rG', symbol: 'BONK' },
  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF' },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3iRYKsLFqvu4', symbol: 'mSOL' },
  { mint: 'J1toso1uCk8GZcmGqWXsLtfD9LsJWiZA8L', symbol: 'JitoSOL' }
];

export function DCAOrders({ wallets, isOpen, onClose }: DCAOrdersProps) {
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [walletId, setWalletId] = useState('');
  const [inputMint, setInputMint] = useState(POPULAR_TOKENS[1].mint); // USDC default
  const [outputMint, setOutputMint] = useState(POPULAR_TOKENS[0].mint); // SOL default
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [hour, setHour] = useState(9);
  const [totalBudget, setTotalBudget] = useState('');
  const [maxSwaps, setMaxSwaps] = useState('');
  const [label, setLabel] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bank/dca', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch DCA orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchOrders();
  }, [isOpen]);

  const handleCreate = async () => {
    setError(null);
    setActionLoading('create');

    try {
      const response = await fetch('/api/bank/dca', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          inputMint,
          outputMint,
          amountPerSwap: parseFloat(amount),
          frequency,
          hour,
          minute: 0,
          totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
          maxSwaps: maxSwaps ? parseInt(maxSwaps) : undefined,
          label: label || undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create');
      }

      await fetchOrders();
      resetForm();
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const newStatus = status === 'active' ? 'paused' : 'active';
      await fetch(`/api/bank/dca/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      await fetchOrders();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this DCA order?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/bank/dca/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      await fetchOrders();
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setWalletId('');
    setAmount('');
    setTotalBudget('');
    setMaxSwaps('');
    setLabel('');
    setError(null);
  };

  const getInputSymbol = () => POPULAR_TOKENS.find(t => t.mint === inputMint)?.symbol || 'Token';
  const getOutputSymbol = () => POPULAR_TOKENS.find(t => t.mint === outputMint)?.symbol || 'Token';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">DCA Orders</h2>
              <p className="text-xs text-muted-foreground">
                Dollar Cost Average into any token
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              disabled={showCreate}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> New DCA
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Create Form */}
          {showCreate && (
            <Card className="mb-4 border-green-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create DCA Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Wallet */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Wallet</label>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-background"
                  >
                    <option value="">Select wallet</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Token Pair */}
                <div className="grid grid-cols-5 gap-2 items-center">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">From</label>
                    <select
                      value={inputMint}
                      onChange={(e) => setInputMint(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-background"
                    >
                      {POPULAR_TOKENS.map(t => (
                        <option key={t.mint} value={t.mint}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-center pt-6">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">To</label>
                    <select
                      value={outputMint}
                      onChange={(e) => setOutputMint(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-background"
                    >
                      {POPULAR_TOKENS.filter(t => t.mint !== inputMint).map(t => (
                        <option key={t.mint} value={t.mint}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Amount per swap</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {getInputSymbol()}
                    </span>
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Frequency</label>
                  <div className="flex gap-2">
                    {(['hourly', 'daily', 'weekly', 'monthly'] as const).map(f => (
                      <Button
                        key={f}
                        size="sm"
                        variant={frequency === f ? 'default' : 'outline'}
                        onClick={() => setFrequency(f)}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {frequency !== 'hourly' && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Time (hour)</label>
                    <Input
                      type="number"
                      value={hour}
                      onChange={(e) => setHour(parseInt(e.target.value))}
                      min={0}
                      max={23}
                    />
                  </div>
                )}

                {/* Limits */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Total Budget (optional)</label>
                    <Input
                      type="number"
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Max Swaps (optional)</label>
                    <Input
                      type="number"
                      value={maxSwaps}
                      onChange={(e) => setMaxSwaps(e.target.value)}
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                {/* Label */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Label (optional)</label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., BTC accumulation"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={actionLoading === 'create' || !walletId || !amount}
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {actionLoading === 'create' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create DCA
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orders List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 && !showCreate ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No DCA orders</p>
              <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Create Your First DCA
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div
                  key={order.id}
                  className={`p-4 rounded-lg border ${
                    order.status === 'paused' ? 'bg-muted/50 opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-medium">
                          {order.label || `${order.inputSymbol} → ${order.outputSymbol}`}
                        </span>
                        <Badge variant={order.status === 'active' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.amountPerSwap} {order.inputSymbol} → {order.outputSymbol} | {order.frequency}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Swaps: {order.swapCount}</span>
                        <span>Total: {order.totalSwapped.toFixed(2)} {order.inputSymbol}</span>
                        {order.averagePrice > 0 && (
                          <span>Avg: {order.averagePrice.toFixed(6)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Next: {new Date(order.nextSwapAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(order.id, order.status)}
                        disabled={actionLoading === order.id}
                      >
                        {order.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(order.id)}
                        disabled={actionLoading === order.id}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
