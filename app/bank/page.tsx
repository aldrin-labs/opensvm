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
  ArrowRightLeft
} from 'lucide-react';
import { WalletFlowVisualization } from '@/components/bank/WalletFlowVisualization';
import { AssetFlowTimeline } from '@/components/bank/AssetFlowTimeline';
import { PortfolioHeatmap } from '@/components/bank/PortfolioHeatmap';

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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

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
              <div className="flex items-center gap-2">
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
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All private keys are encrypted using military-grade AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations). 
                  Each wallet is protected by a unique encryption key derived from your primary wallet signature.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                            <p className="text-sm text-muted-foreground">≈ ${(wallet.balance * 50).toFixed(2)}</p>
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
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => togglePrivateKey(wallet.id)}
                        >
                          {showPrivateKeys[wallet.id] ? (
                            <>
                              <EyeOff className="h-4 w-4" />
                              Hide Key
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              Show Key
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          Transfer
                        </Button>
                      </div>

                      {/* Private Key Display */}
                      {showPrivateKeys[wallet.id] && (
                        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                          <div className="flex items-start gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                Private Key - Keep Secure!
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Never share this key. Anyone with access can control your funds.
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 p-3 rounded bg-background border border-border">
                            <div className="flex items-center justify-between gap-2">
                              <code className="text-xs font-mono break-all flex-1">
                                [Encrypted - Contact API to decrypt]
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 flex-shrink-0"
                                onClick={() => copyToClipboard('[ENCRYPTED_KEY]', `key-${wallet.id}`)}
                              >
                                {copiedAddress === `key-${wallet.id}` ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
