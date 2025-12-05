'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Wallet,
  Plus,
  RefreshCw,
  ArrowLeftRight,
  TrendingUp,
  Shield,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Loader2,
  DollarSign,
  Layers,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Network,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Key,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { WalletFlowVisualization } from '@/components/bank/WalletFlowVisualization';
import { AssetFlowTimeline } from '@/components/bank/AssetFlowTimeline';
import { PortfolioHeatmap } from '@/components/bank/PortfolioHeatmap';
import { SolIncinerator } from '@/components/bank/SolIncinerator';
import { TransferModal } from '@/components/bank/TransferModal';
import { HardwareWalletSettings } from '@/components/bank/HardwareWalletSettings';
import { TransactionHistory } from '@/components/bank/TransactionHistory';
import { SweepModal } from '@/components/bank/SweepModal';
import { ScheduledTransfers } from '@/components/bank/ScheduledTransfers';
import { DCAOrders } from '@/components/bank/DCAOrders';
import { ConditionalTriggers } from '@/components/bank/ConditionalTriggers';
import { KalshiTrading } from '@/components/bank/KalshiTrading';

interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  balance: number;
  tokens: Array<{
    mint: string;
    symbol: string;
    balance: number;
    usdValue: number;
  }>;
  createdAt: number;
}

interface WalletHealth {
  score: number;
  risk: 'low' | 'medium' | 'high';
  diversification: number;
  recommendations: string[];
}

export default function BankPage() {
  const { walletAddress, isAuthenticated, loading: authLoading } = useCurrentUser();
  const router = useRouter();
  const [wallets, setWallets] = useState<ManagedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPrivateKeys, setShowPrivateKeys] = useState<Record<string, boolean>>({});
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [solPrice, setSolPrice] = useState<number>(180); // Optimistic default, updates on fetch

  // CRUD state
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingWallet, setDeletingWallet] = useState<string | null>(null);
  const [exportingWallet, setExportingWallet] = useState<string | null>(null);
  const [exportChallenge, setExportChallenge] = useState<string | null>(null);
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Transfer state
  const [transferWallet, setTransferWallet] = useState<ManagedWallet | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Settings state
  const [expandedWalletSettings, setExpandedWalletSettings] = useState<string | null>(null);

  // History, Sweep, Scheduled, DCA, Triggers state
  const [historyWallet, setHistoryWallet] = useState<ManagedWallet | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSweepModal, setShowSweepModal] = useState(false);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [showDCAModal, setShowDCAModal] = useState(false);
  const [showTriggersModal, setShowTriggersModal] = useState(false);
  const [showKalshiModal, setShowKalshiModal] = useState(false);

  // Migration state
  const [migrationStatus, setMigrationStatus] = useState<{
    needsMigration: boolean;
    v1Count: number;
    v2Count: number;
  } | null>(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch SOL price - optimistic UI, updates in background
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111112');
        if (response.ok) {
          const data = await response.json();
          const price = data?.data?.['So11111111111111111111111111111111111112']?.price;
          if (typeof price === 'number' && price > 0) {
            setSolPrice(price);
          }
        }
      } catch {
        // Silent failure - keep current price (optimistic default)
      }
    };
    fetchSolPrice();
    // Refresh every 60 seconds
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWallets = async () => {
      if (!walletAddress) return;
      
      try {
        const response = await fetch('/api/bank/wallets', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setWallets(data.wallets || []);
        }
      } catch (error) {
        console.error('Failed to fetch wallets:', error);
      } finally {
        setLoading(false);
      }
    };

    if (walletAddress) {
      fetchWallets();
    }
  }, [walletAddress]);

  // Calculate portfolio metrics
  const portfolioMetrics = {
    totalValue: wallets.reduce((sum, w) => sum + w.balance + w.tokens.reduce((s, t) => s + t.usdValue, 0), 0),
    totalSOL: wallets.reduce((sum, w) => sum + w.balance, 0),
    totalTokenTypes: new Set(wallets.flatMap(w => w.tokens.map(t => t.mint))).size,
    totalWallets: wallets.length,
  };

  // Analyze cross-wallet token distribution
  const tokenDistribution = wallets.reduce((acc, wallet) => {
    wallet.tokens.forEach(token => {
      if (!acc[token.mint]) {
        acc[token.mint] = {
          symbol: token.symbol,
          totalValue: 0,
          walletCount: 0,
          wallets: []
        };
      }
      acc[token.mint].totalValue += token.usdValue;
      acc[token.mint].walletCount += 1;
      acc[token.mint].wallets.push({
        name: wallet.name,
        value: token.usdValue
      });
    });
    return acc;
  }, {} as Record<string, any>);

  const duplicateTokens = Object.values(tokenDistribution).filter((t: any) => t.walletCount > 1);

  // Calculate wallet health scores
  const calculateWalletHealth = (wallet: ManagedWallet): WalletHealth => {
    const totalValue = wallet.balance + wallet.tokens.reduce((s, t) => s + t.usdValue, 0);
    const portfolioPercentage = portfolioMetrics.totalValue > 0 ? (totalValue / portfolioMetrics.totalValue) * 100 : 0;
    
    // Diversification score (0-100)
    const tokenCount = wallet.tokens.length + 1; // +1 for SOL
    const diversification = Math.min((tokenCount / 10) * 100, 100);
    
    // Risk assessment
    let risk: 'low' | 'medium' | 'high' = 'low';
    let score = 100;
    const recommendations: string[] = [];
    
    if (portfolioPercentage > 70) {
      risk = 'high';
      score -= 30;
      recommendations.push('Consider distributing assets across multiple wallets');
    } else if (portfolioPercentage > 40) {
      risk = 'medium';
      score -= 15;
    }
    
    if (tokenCount < 3) {
      score -= 20;
      recommendations.push('Improve diversification by adding more token types');
    }
    
    if (totalValue < 10) {
      recommendations.push('Low balance - consider consolidating with other wallets');
    }
    
    return { score, risk, diversification, recommendations };
  };

  // Generate rebalancing suggestions
  const rebalanceSuggestions = () => {
    if (wallets.length < 2) return null;
    
    const suggestions = [];
    const avgValue = portfolioMetrics.totalValue / wallets.length;
    
    // Find overloaded and underloaded wallets
    const overloaded = wallets.filter(w => {
      const value = w.balance + w.tokens.reduce((s, t) => s + t.usdValue, 0);
      return value > avgValue * 1.5;
    });
    
    const underloaded = wallets.filter(w => {
      const value = w.balance + w.tokens.reduce((s, t) => s + t.usdValue, 0);
      return value < avgValue * 0.5;
    });
    
    if (overloaded.length > 0 && underloaded.length > 0) {
      suggestions.push({
        type: 'balance',
        from: overloaded[0].name,
        to: underloaded[0].name,
        reason: 'Improve portfolio distribution'
      });
    }
    
    // Check for duplicate tokens
    if (duplicateTokens.length > 0) {
      suggestions.push({
        type: 'consolidate',
        tokens: duplicateTokens.slice(0, 2).map((t: any) => t.symbol),
        reason: 'Reduce complexity by consolidating duplicate tokens'
      });
    }
    
    return suggestions;
  };

  const handleCreateWallet = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/bank/wallets/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Wallet ${wallets.length + 1}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setWallets([...wallets, data.wallet]);
      }
    } catch (error) {
      console.error('Failed to create wallet:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleRefreshBalances = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/bank/wallets/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets);
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const togglePrivateKey = (walletId: string) => {
    setShowPrivateKeys(prev => ({
      ...prev,
      [walletId]: !prev[walletId]
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(id);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Rename wallet handler
  const handleRenameWallet = async (walletId: string) => {
    if (!editName.trim()) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bank/wallets/${walletId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setWallets(wallets.map(w =>
          w.id === walletId ? { ...w, name: data.wallet.name } : w
        ));
        setEditingWallet(null);
        setEditName('');
      }
    } catch (error) {
      console.error('Failed to rename wallet:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete wallet handler
  const handleDeleteWallet = async (walletId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bank/wallets/${walletId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setWallets(wallets.filter(w => w.id !== walletId));
        setDeletingWallet(null);
      }
    } catch (error) {
      console.error('Failed to delete wallet:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Export private key - Step 1: Get challenge
  const handleExportKeyStart = async (walletId: string) => {
    setExportingWallet(walletId);
    setExportChallenge(null);
    setExportedKey(null);
    setActionLoading(true);

    try {
      const response = await fetch(`/api/bank/wallets/${walletId}/export`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setExportChallenge(data.challenge);
      } else {
        const error = await response.json();
        console.error('Failed to get export challenge:', error);
        setExportingWallet(null);
      }
    } catch (error) {
      console.error('Failed to get export challenge:', error);
      setExportingWallet(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Export private key - Step 2: Sign and submit
  const handleExportKeySign = async () => {
    if (!exportingWallet || !exportChallenge) return;

    // This would need wallet adapter's signMessage function
    // For now, we show instructions
    alert('To export your private key:\n\n1. Copy the challenge message\n2. Sign it with your wallet\n3. Submit the signature\n\nThis feature requires wallet adapter integration.');
  };

  // Cancel export
  const handleExportCancel = () => {
    setExportingWallet(null);
    setExportChallenge(null);
    setExportedKey(null);
  };

  // Open transfer modal
  const handleOpenTransfer = (wallet: ManagedWallet) => {
    setTransferWallet(wallet);
    setShowTransferModal(true);
  };

  // Check migration status
  const checkMigrationStatus = async () => {
    try {
      const response = await fetch('/api/bank/wallets/migrate', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMigrationStatus({
          needsMigration: data.needsMigration,
          v1Count: data.v1Count,
          v2Count: data.v2Count
        });
      }
    } catch (error) {
      console.error('Failed to check migration status:', error);
    }
  };

  // Run migration
  const handleMigrateEncryption = async () => {
    setMigrating(true);
    try {
      const response = await fetch('/api/bank/wallets/migrate', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Migration result:', data);
        // Refresh migration status
        await checkMigrationStatus();
      }
    } catch (error) {
      console.error('Migration failed:', error);
    } finally {
      setMigrating(false);
    }
  };

  // Check migration status on load
  useEffect(() => {
    if (wallets.length > 0) {
      checkMigrationStatus();
    }
  }, [wallets.length]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading your wallets...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const suggestions = rebalanceSuggestions();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-primary/5 p-8">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black_50%)]" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-xl flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                      SVM Bank
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                      Intelligent multi-wallet portfolio management
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => setShowScheduledModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Scheduled
                </Button>
                <Button
                  onClick={() => setShowSweepModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={wallets.length < 2}
                >
                  <Zap className="h-4 w-4" />
                  Sweep
                </Button>
                <Button
                  onClick={() => setShowDCAModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  DCA
                </Button>
                <Button
                  onClick={() => setShowTriggersModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Target className="h-4 w-4" />
                  Triggers
                </Button>
                <Button
                  onClick={() => setShowKalshiModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20"
                >
                  <BarChart3 className="h-4 w-4" />
                  Kalshi
                </Button>
                <Button
                  onClick={() => setShowInsights(!showInsights)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {showInsights ? 'Hide' : 'Show'} Insights
                </Button>
                <Button
                  onClick={handleRefreshBalances}
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button
                  onClick={handleCreateWallet}
                  disabled={creating}
                  className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      New Wallet
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                  <h3 className="text-2xl font-bold mt-1">
                    ${portfolioMetrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total SOL</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {portfolioMetrics.totalSOL.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Token Types</p>
                  <h3 className="text-2xl font-bold mt-1">{portfolioMetrics.totalTokenTypes}</h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Managed Wallets</p>
                  <h3 className="text-2xl font-bold mt-1">{portfolioMetrics.totalWallets}</h3>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights & Recommendations */}
        {showInsights && wallets.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Portfolio Distribution Map */}
            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Portfolio Distribution
                </CardTitle>
                <CardDescription>Asset allocation across your wallets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {wallets.map((wallet) => {
                  const value = wallet.balance + wallet.tokens.reduce((s, t) => s + t.usdValue, 0);
                  const percentage = portfolioMetrics.totalValue > 0 ? (value / portfolioMetrics.totalValue) * 100 : 0;
                  
                  return (
                    <div key={wallet.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-secondary" />
                          <span className="font-medium">{wallet.name}</span>
                        </div>
                        <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Smart Rebalancing Suggestions */}
            <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Smart Recommendations
                </CardTitle>
                <CardDescription>AI-powered portfolio optimization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestions && suggestions.length > 0 ? (
                  suggestions.map((suggestion, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-start gap-2">
                        {suggestion.type === 'balance' ? (
                          <ArrowRightLeft className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Target className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          {suggestion.type === 'balance' ? (
                            <p className="text-sm">
                              <span className="font-medium">Rebalance:</span> Move assets from{' '}
                              <Badge variant="outline" className="mx-1">{suggestion.from}</Badge> to{' '}
                              <Badge variant="outline" className="mx-1">{suggestion.to}</Badge>
                            </p>
                          ) : (
                            <p className="text-sm">
                              <span className="font-medium">Consolidate:</span> Merge{' '}
                              {suggestion.tokens?.join(', ')} across wallets
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">Your portfolio is well balanced!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cross-Wallet Token Analysis */}
        {showInsights && duplicateTokens.length > 0 && (
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Cross-Wallet Token Distribution
              </CardTitle>
              <CardDescription>
                Tokens appearing in multiple wallets - consider consolidating for easier management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {duplicateTokens.slice(0, 4).map((token: any) => (
                  <div key={token.symbol} className="p-3 rounded-lg bg-background border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{token.symbol}</span>
                      <Badge variant="secondary">{token.walletCount} wallets</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total: ${token.totalValue.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Visual Portfolio Intelligence */}
        {showInsights && wallets.length > 0 && (
          <>
            {/* Wallet Flow Network Visualization */}
            <WalletFlowVisualization wallets={wallets} />
            
            {/* Asset Flow Timeline */}
            <AssetFlowTimeline wallets={wallets} />
            
            {/* Portfolio Concentration Heatmap */}
            <PortfolioHeatmap wallets={wallets} />
          </>
        )}

        {/* Security Notice */}
        <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-2">
                  Enterprise-Grade Security
                  <Badge variant="outline" className="text-xs border-blue-500/30">AES-256-GCM</Badge>
                  <span title="Learn more about our security measures">
                    <Info className="h-4 w-4 text-blue-400 cursor-help" />
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All private keys are encrypted using military-grade AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations). 
                  Each wallet is protected by a unique encryption key derived from your primary wallet signature.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sol Incinerator - Reclaim SOL from empty token accounts */}
        <SolIncinerator />

        {/* Wallets List or Empty State */}
        {wallets.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <Wallet className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Start Building Your Portfolio</h3>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                Create managed wallets to organize your Solana assets across multiple addresses
              </p>
              <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
                Perfect for separating trading funds, long-term holdings, or managing assets for different projects
              </p>
              <Button 
                onClick={handleCreateWallet} 
                disabled={creating}
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Wallet...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Wallet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Wallets</h2>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {wallets.length} Active
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {wallets.map((wallet) => {
                const walletValue = wallet.balance + wallet.tokens.reduce((s, t) => s + t.usdValue, 0);
                const valuePercentage = portfolioMetrics.totalValue > 0 
                  ? (walletValue / portfolioMetrics.totalValue) * 100 
                  : 0;
                const health = calculateWalletHealth(wallet);

                return (
                  <Card key={wallet.id} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-sm">
                              {wallet.name[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{wallet.name}</CardTitle>
                                {showInsights && (
                                  <Badge 
                                    variant={health.risk === 'low' ? 'default' : health.risk === 'medium' ? 'secondary' : 'destructive'}
                                    className="text-xs"
                                  >
                                    <Shield className="h-3 w-3 mr-1" />
                                    {health.score}/100
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1" title="Created">
                                  <Clock className="h-3 w-3" />
                                  {new Date(wallet.createdAt).toLocaleDateString()}
                                </span>
                                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(wallet.address, wallet.id)}
                                >
                                  {copiedAddress === wallet.id ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                                <a
                                  href={`https://solscan.io/account/${wallet.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ${walletValue.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {valuePercentage.toFixed(1)}%
                            </Badge>
                            of portfolio
                          </div>
                        </div>
                      </div>

                      {/* Wallet Health Indicators */}
                      {showInsights && health.recommendations.length > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                                Optimization Opportunities
                              </p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {health.recommendations.slice(0, 2).map((rec, idx) => (
                                  <li key={idx}>• {rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* SOL Balance */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                              <TrendingUp className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Solana</p>
                              <p className="text-xl font-bold">{wallet.balance.toFixed(4)} SOL</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">≈ ${(wallet.balance * solPrice).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* SPL Tokens */}
                      {wallet.tokens.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              SPL Tokens ({wallet.tokens.length})
                            </h4>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {wallet.tokens.map((token, idx) => (
                              <div 
                                key={idx}
                                className="p-3 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                                      {token.symbol.slice(0, 2)}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{token.symbol}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {token.balance.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-sm">${token.usdValue.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Wallet Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                          onClick={() => handleOpenTransfer(wallet)}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          Transfer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            setEditingWallet(wallet.id);
                            setEditName(wallet.name);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Rename
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleExportKeyStart(wallet.id)}
                          disabled={actionLoading && exportingWallet === wallet.id}
                        >
                          <Key className="h-4 w-4" />
                          Export Key
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            setHistoryWallet(wallet);
                            setShowHistoryModal(true);
                          }}
                        >
                          <Clock className="h-4 w-4" />
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setExpandedWalletSettings(
                            expandedWalletSettings === wallet.id ? null : wallet.id
                          )}
                        >
                          <Shield className="h-4 w-4" />
                          Security
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => setDeletingWallet(wallet.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>

                      {/* Hardware Wallet Settings (Expanded) */}
                      {expandedWalletSettings === wallet.id && (
                        <div className="pt-4">
                          <HardwareWalletSettings
                            walletId={wallet.id}
                            walletAddress={wallet.address}
                            walletName={wallet.name}
                            onUpdate={handleRefreshBalances}
                          />
                        </div>
                      )}

                      {/* Rename Dialog */}
                      {editingWallet === wallet.id && (
                        <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Pencil className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              Rename Wallet
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Enter new name"
                              className="flex-1 h-9"
                              maxLength={50}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleRenameWallet(wallet.id)}
                              disabled={actionLoading || !editName.trim()}
                            >
                              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingWallet(null);
                                setEditName('');
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Delete Confirmation */}
                      {deletingWallet === wallet.id && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                          <div className="flex items-start gap-2 mb-3">
                            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                Delete Wallet?
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This will permanently remove this wallet from your account.
                                Make sure to export your private key first if you need it.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteWallet(wallet.id)}
                              disabled={actionLoading}
                              className="gap-2"
                            >
                              {actionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Delete Forever
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingWallet(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Export Key Dialog */}
                      {exportingWallet === wallet.id && (
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <div className="flex items-start gap-2 mb-3">
                            <Key className="h-5 w-5 text-amber-500 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                Export Private Key
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Sign the challenge message below with your wallet to prove ownership.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={handleExportCancel}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          {exportChallenge && !exportedKey && (
                            <div className="space-y-3">
                              <div className="p-3 rounded bg-background border border-border">
                                <p className="text-xs text-muted-foreground mb-2">Challenge to sign:</p>
                                <code className="text-xs font-mono break-all whitespace-pre-wrap">
                                  {exportChallenge}
                                </code>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => copyToClipboard(exportChallenge, `challenge-${wallet.id}`)}
                                >
                                  {copiedAddress === `challenge-${wallet.id}` ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                  Copy Challenge
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                After signing, submit the signature via the API endpoint or use a wallet adapter integration.
                              </p>
                            </div>
                          )}

                          {exportedKey && (
                            <div className="space-y-3">
                              <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                  <span className="text-xs font-semibold text-red-500">
                                    Your Private Key
                                  </span>
                                </div>
                                <code className="text-xs font-mono break-all">
                                  {exportedKey}
                                </code>
                              </div>
                              <Button
                                size="sm"
                                className="gap-2"
                                onClick={() => copyToClipboard(exportedKey, `exported-${wallet.id}`)}
                              >
                                {copiedAddress === `exported-${wallet.id}` ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                Copy Private Key
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Migration Banner */}
        {migrationStatus?.needsMigration && (
          <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-600 dark:text-amber-400">
                  Security Upgrade Available
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {migrationStatus.v1Count} wallet(s) can be upgraded to improved encryption (v2).
                  This adds random salt to each encrypted key for better security.
                </p>
                <Button
                  size="sm"
                  onClick={handleMigrateEncryption}
                  disabled={migrating}
                  className="mt-3 gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  {migrating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Upgrading...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Upgrade Encryption
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {transferWallet && (
        <TransferModal
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            setTransferWallet(null);
          }}
          sourceWallet={transferWallet}
          availableWallets={wallets}
          solPrice={solPrice}
          onTransferComplete={() => {
            refreshBalances();
          }}
        />
      )}

      {/* Transaction History Modal */}
      {historyWallet && (
        <TransactionHistory
          walletId={historyWallet.id}
          walletAddress={historyWallet.address}
          walletName={historyWallet.name}
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryWallet(null);
          }}
        />
      )}

      {/* Sweep Modal */}
      <SweepModal
        isOpen={showSweepModal}
        onClose={() => setShowSweepModal(false)}
        wallets={wallets}
        onSweepComplete={() => handleRefreshBalances()}
      />

      {/* Scheduled Transfers Modal */}
      <ScheduledTransfers
        wallets={wallets}
        isOpen={showScheduledModal}
        onClose={() => setShowScheduledModal(false)}
      />

      {/* DCA Orders Modal */}
      <DCAOrders
        wallets={wallets}
        isOpen={showDCAModal}
        onClose={() => setShowDCAModal(false)}
      />

      {/* Conditional Triggers Modal */}
      <ConditionalTriggers
        wallets={wallets}
        isOpen={showTriggersModal}
        onClose={() => setShowTriggersModal(false)}
      />

      {/* Kalshi Trading Modal */}
      <KalshiTrading
        isOpen={showKalshiModal}
        onClose={() => setShowKalshiModal(false)}
      />
    </div>
  );
}
