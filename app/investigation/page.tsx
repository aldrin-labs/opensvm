'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Network,
  BarChart3,
  AlertTriangle,
  Users,
  Route,
  Zap,
  Shield,
  FileText,
  Download,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  ArrowLeft,
  History,
  Eye,
  Target,
  TrendingUp,
  Clock,
  Wallet,
  Activity,
  Trash2,
  Tag,
  BookMarked
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useInvestigationHistory } from '@/hooks/useInvestigationHistory';

// Lazy load the TransactionGraph for better performance
const TransactionGraphLazy = dynamic(
  () => import('@/components/transaction-graph/TransactionGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-muted/20 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }
);

// Investigation types
interface WalletProfile {
  address: string;
  age: number;
  firstSeenSlot: number;
  lastSeenSlot: number;
  totalVolume: number;
  solBalance: number;
  transactionCount: number;
  uniqueCounterparties: number;
  riskScore: number;
  activityScore: number;
  patterns: string[];
  topCounterparties: { address: string; volume: number; count: number; direction: 'in' | 'out' | 'both' }[];
  tokenHoldings: { mint: string; symbol: string; balance: number; usdValue: number }[];
}

interface Transaction {
  signature: string;
  timestamp: number;
  slot: number;
  success: boolean;
  type: string;
  direction: 'in' | 'out' | 'internal';
  amount: number;
  tokenSymbol: string;
  counterparty?: string;
}

interface Cluster {
  id: string;
  nodes: string[];
  size: number;
  totalVolume: number;
  riskScore: number;
  label: string;
  patterns: string[];
}

interface Finding {
  id: string;
  type: 'wash_trading' | 'mev' | 'cluster' | 'whale' | 'suspicious' | 'pattern' | 'funding';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  addresses: string[];
  evidence: string[];
  timestamp: Date;
}

// Analysis functions
function calculateRiskScore(transactions: Transaction[], counterparties: Map<string, { in: number; out: number; volume: number }>): number {
  let score = 0;

  // Check for circular transactions (potential wash trading)
  const addresses = new Set(transactions.map(t => t.counterparty).filter(Boolean));
  if (addresses.size < transactions.length * 0.2) {
    score += 30; // Low diversity of counterparties
  }

  // Check for rapid transactions (potential bot activity)
  const rapidTxs = transactions.filter((t, i) => {
    if (i === 0) return false;
    return (transactions[i-1].timestamp - t.timestamp) < 5000; // Within 5 seconds
  });
  if (rapidTxs.length > transactions.length * 0.3) {
    score += 20;
  }

  // Check for round number amounts (potential automated trading)
  const roundAmounts = transactions.filter(t => t.amount % 1 === 0 && t.amount > 0);
  if (roundAmounts.length > transactions.length * 0.5) {
    score += 10;
  }

  return Math.min(100, score);
}

function calculateActivityScore(transactions: Transaction[], daysSinceFirst: number): number {
  if (transactions.length === 0 || daysSinceFirst === 0) return 0;

  const txPerDay = transactions.length / Math.max(1, daysSinceFirst);

  // Score based on activity level
  if (txPerDay > 50) return 100;
  if (txPerDay > 20) return 80;
  if (txPerDay > 10) return 60;
  if (txPerDay > 5) return 40;
  if (txPerDay > 1) return 20;
  return 10;
}

function detectPatterns(transactions: Transaction[], counterparties: Map<string, { in: number; out: number; volume: number }>): string[] {
  const patterns: string[] = [];

  // Check for DEX activity
  const dexTxs = transactions.filter(t =>
    t.type?.includes('swap') || t.type?.includes('dex') || t.type?.includes('amm')
  );
  if (dexTxs.length > 0) {
    patterns.push(`DEX trading (${dexTxs.length} swaps)`);
  }

  // Check for NFT activity
  const nftTxs = transactions.filter(t =>
    t.type?.includes('nft') || t.type?.includes('mint')
  );
  if (nftTxs.length > 0) {
    patterns.push(`NFT activity (${nftTxs.length} transactions)`);
  }

  // Check for staking
  const stakeTxs = transactions.filter(t =>
    t.type?.includes('stake') || t.type?.includes('delegate')
  );
  if (stakeTxs.length > 0) {
    patterns.push('Staking activity');
  }

  // Check for high-value transfers
  const highValueTxs = transactions.filter(t => t.amount > 100);
  if (highValueTxs.length > 0) {
    patterns.push(`High-value transfers (${highValueTxs.length} > 100 SOL)`);
  }

  // Check transaction direction balance
  const inTxs = transactions.filter(t => t.direction === 'in').length;
  const outTxs = transactions.filter(t => t.direction === 'out').length;
  if (inTxs > outTxs * 2) {
    patterns.push('Primarily receiving funds');
  } else if (outTxs > inTxs * 2) {
    patterns.push('Primarily sending funds');
  } else {
    patterns.push('Balanced in/out flow');
  }

  return patterns;
}

function generateFindings(
  profile: WalletProfile,
  transactions: Transaction[],
  counterparties: Map<string, { in: number; out: number; volume: number }>
): Finding[] {
  const findings: Finding[] = [];

  // High risk score
  if (profile.riskScore >= 60) {
    findings.push({
      id: 'risk-high',
      type: 'suspicious',
      title: 'Elevated Risk Score',
      description: `Wallet has a risk score of ${profile.riskScore}/100 based on transaction patterns`,
      severity: profile.riskScore >= 80 ? 'high' : 'medium',
      addresses: [profile.address],
      evidence: ['Low counterparty diversity', 'Potential automated trading patterns'],
      timestamp: new Date()
    });
  }

  // Check for potential wash trading
  const selfTxs = transactions.filter(t => t.counterparty === profile.address);
  if (selfTxs.length > 0) {
    findings.push({
      id: 'wash-self',
      type: 'wash_trading',
      title: 'Self-transfers Detected',
      description: `Found ${selfTxs.length} transactions to/from the same address`,
      severity: selfTxs.length > 10 ? 'high' : 'low',
      addresses: [profile.address],
      evidence: selfTxs.slice(0, 3).map(t => `Signature: ${t.signature.slice(0, 12)}...`),
      timestamp: new Date()
    });
  }

  // Whale detection
  if (profile.totalVolume > 1000) {
    findings.push({
      id: 'whale',
      type: 'whale',
      title: 'High-Volume Wallet',
      description: `Total volume of ${profile.totalVolume.toFixed(2)} SOL indicates whale activity`,
      severity: profile.totalVolume > 10000 ? 'high' : 'medium',
      addresses: [profile.address],
      evidence: [`Total volume: ${profile.totalVolume.toFixed(2)} SOL`],
      timestamp: new Date()
    });
  }

  // Recent activity spike
  const recentTxs = transactions.filter(t =>
    Date.now() - t.timestamp < 24 * 60 * 60 * 1000
  );
  const avgDaily = transactions.length / Math.max(1, profile.age);
  if (recentTxs.length > avgDaily * 3 && recentTxs.length > 10) {
    findings.push({
      id: 'activity-spike',
      type: 'pattern',
      title: 'Unusual Activity Spike',
      description: `${recentTxs.length} transactions in last 24 hours (${(recentTxs.length / avgDaily * 100).toFixed(0)}% above average)`,
      severity: 'medium',
      addresses: [profile.address],
      evidence: [`Daily average: ${avgDaily.toFixed(1)} transactions`],
      timestamp: new Date()
    });
  }

  // New wallet with high activity
  if (profile.age < 7 && profile.transactionCount > 100) {
    findings.push({
      id: 'new-active',
      type: 'suspicious',
      title: 'New Wallet with High Activity',
      description: `Wallet is only ${profile.age} days old but has ${profile.transactionCount} transactions`,
      severity: 'medium',
      addresses: [profile.address],
      evidence: [`Created approximately ${profile.age} days ago`],
      timestamp: new Date()
    });
  }

  return findings;
}

export default function InvestigationPage() {
  const searchParams = useSearchParams();
  const initialAddress = searchParams.get('address') || '';

  const [targetAddress, setTargetAddress] = useState(initialAddress);
  const [searchInput, setSearchInput] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'transactions' | 'patterns' | 'timeline' | 'report' | 'graph'>('overview');
  const [showHistory, setShowHistory] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  // Investigation history
  const {
    history: investigationHistory,
    addToHistory,
    removeFromHistory,
    updateLabel,
    clearHistory
  } = useInvestigationHistory();

  // Investigation results
  const [walletProfile, setWalletProfile] = useState<WalletProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  const fetchWalletData = useCallback(async (address: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch account stats
      const statsRes = await fetch(`/api/account-stats/${address}`);
      const statsData = await statsRes.json();

      // Fetch transactions
      const txRes = await fetch(`/api/account-transactions/${address}?limit=100`);
      const txData = await txRes.json();

      // Fetch portfolio
      const portfolioRes = await fetch(`/api/account-portfolio/${address}`);
      const portfolioData = await portfolioRes.json();

      if (!txData.transactions || txData.error) {
        throw new Error(txData.error || 'Failed to fetch transactions');
      }

      // Process transactions
      const processedTxs: Transaction[] = (txData.transactions || []).map((tx: any) => ({
        signature: tx.signature,
        timestamp: tx.timestamp || Date.now(),
        slot: tx.slot || 0,
        success: tx.success !== false,
        type: tx.classification?.type || tx.type || 'unknown',
        direction: tx.direction || 'internal',
        amount: tx.amount || 0,
        tokenSymbol: tx.tokenSymbol || 'SOL',
        counterparty: tx.accounts?.find((a: any) => a.pubkey !== address)?.pubkey
      }));

      setTransactions(processedTxs);

      // Build counterparty map
      const counterpartyMap = new Map<string, { in: number; out: number; volume: number }>();
      processedTxs.forEach(tx => {
        if (tx.counterparty) {
          const existing = counterpartyMap.get(tx.counterparty) || { in: 0, out: 0, volume: 0 };
          if (tx.direction === 'in') {
            existing.in++;
          } else if (tx.direction === 'out') {
            existing.out++;
          }
          existing.volume += tx.amount;
          counterpartyMap.set(tx.counterparty, existing);
        }
      });

      // Calculate metrics
      const timestamps = processedTxs.map(t => t.timestamp).filter(t => t > 0);
      const firstSeen = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
      const lastSeen = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
      const age = Math.max(1, Math.floor((Date.now() - firstSeen) / (1000 * 60 * 60 * 24)));

      const totalVolume = processedTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

      // Build top counterparties
      const topCounterparties = Array.from(counterpartyMap.entries())
        .sort((a, b) => b[1].volume - a[1].volume)
        .slice(0, 10)
        .map(([addr, data]) => ({
          address: addr,
          volume: data.volume,
          count: data.in + data.out,
          direction: data.in > data.out ? 'in' as const : data.out > data.in ? 'out' as const : 'both' as const
        }));

      // Build profile
      const profile: WalletProfile = {
        address,
        age,
        firstSeenSlot: processedTxs.length > 0 ? processedTxs[processedTxs.length - 1].slot : 0,
        lastSeenSlot: processedTxs.length > 0 ? processedTxs[0].slot : 0,
        totalVolume,
        solBalance: portfolioData?.solBalance || 0,
        transactionCount: typeof statsData.totalTransactions === 'string'
          ? parseInt(statsData.totalTransactions.replace('+', ''), 10)
          : statsData.totalTransactions || processedTxs.length,
        uniqueCounterparties: counterpartyMap.size,
        riskScore: calculateRiskScore(processedTxs, counterpartyMap),
        activityScore: calculateActivityScore(processedTxs, age),
        patterns: detectPatterns(processedTxs, counterpartyMap),
        topCounterparties,
        tokenHoldings: portfolioData?.tokens?.slice(0, 10) || []
      };

      setWalletProfile(profile);

      // Generate findings
      const detectedFindings = generateFindings(profile, processedTxs, counterpartyMap);
      setFindings(detectedFindings);

      // Simple cluster detection based on common counterparties
      if (topCounterparties.length >= 3) {
        const clusterNodes = [address, ...topCounterparties.slice(0, 4).map(c => c.address)];
        setClusters([{
          id: 'primary-cluster',
          nodes: clusterNodes,
          size: clusterNodes.length,
          totalVolume: topCounterparties.slice(0, 4).reduce((sum, c) => sum + c.volume, 0),
          riskScore: profile.riskScore,
          label: 'Primary Trading Network',
          patterns: ['Frequent interactions']
        }]);
      }

      // Save to investigation history
      addToHistory({
        address,
        riskScore: profile.riskScore,
        transactionCount: profile.transactionCount,
        findings: detectedFindings.length
      });

    } catch (err: any) {
      console.error('Investigation error:', err);
      setError(err.message || 'Failed to analyze wallet');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchInput) return;
    setTargetAddress(searchInput);
    fetchWalletData(searchInput);
  }, [searchInput, fetchWalletData]);

  // Run investigation on initial load if address provided
  useEffect(() => {
    if (initialAddress) {
      fetchWalletData(initialAddress);
    }
  }, [initialAddress, fetchWalletData]);

  const formatAddress = (addr: string) => addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive bg-destructive/10';
      case 'high': return 'text-warning bg-warning/10';
      case 'medium': return 'text-info bg-info/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-destructive';
    if (score >= 60) return 'text-warning';
    if (score >= 40) return 'text-info';
    return 'text-success';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-lg hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">Investigation Mode</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter wallet address to investigate..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isLoading || !searchInput}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Investigate
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-3">
            {/* Target Info */}
            {targetAddress && (
              <div className="bg-background border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Target Address</h3>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{formatAddress(targetAddress)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(targetAddress)}
                      className="p-1.5 rounded hover:bg-muted"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/account/${targetAddress}`}
                      className="p-1.5 rounded hover:bg-muted"
                      title="View Account"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
                {walletProfile && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-medium">{walletProfile.solBalance.toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Age</span>
                      <span className="font-medium">{walletProfile.age} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Risk</span>
                      <span className={cn('font-medium', getRiskColor(walletProfile.riskScore))}>
                        {walletProfile.riskScore}/100
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-background border border-border rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium mb-3">Quick Analysis</h3>
              <div className="space-y-2">
                <button
                  onClick={() => walletProfile && setActiveTab('transactions')}
                  disabled={!walletProfile || isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm disabled:opacity-50"
                >
                  <Activity className="w-4 h-4 text-primary" />
                  View Transactions
                </button>
                <button
                  onClick={() => walletProfile && setActiveTab('patterns')}
                  disabled={!walletProfile || isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  View Patterns
                </button>
                <button
                  onClick={() => {
                    setShowGraph(!showGraph);
                    if (!showGraph) setActiveTab('graph');
                  }}
                  disabled={!targetAddress || isLoading}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm disabled:opacity-50",
                    showGraph && "bg-info/10 text-info"
                  )}
                >
                  <Network className="w-4 h-4 text-info" />
                  {showGraph ? 'Hide Graph' : 'Show Graph'}
                </button>
                <button
                  onClick={() => walletProfile && setActiveTab('report')}
                  disabled={!walletProfile || isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-success" />
                  Generate Report
                </button>
              </div>
            </div>

            {/* Top Counterparties */}
            {walletProfile && walletProfile.topCounterparties.length > 0 && (
              <div className="bg-background border border-border rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3">Top Counterparties</h3>
                <div className="space-y-2">
                  {walletProfile.topCounterparties.slice(0, 5).map((cp, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchInput(cp.address);
                        setTargetAddress(cp.address);
                        fetchWalletData(cp.address);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-sm"
                    >
                      <span className="font-mono">{formatAddress(cp.address)}</span>
                      <span className="text-muted-foreground">{cp.count} tx</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 bg-muted/30 p-1 rounded-lg w-fit">
              {[
                { id: 'overview', label: 'Overview', icon: Eye },
                { id: 'profile', label: 'Profile', icon: BarChart3 },
                { id: 'transactions', label: 'Transactions', icon: Activity },
                { id: 'patterns', label: 'Patterns', icon: Target },
                { id: 'timeline', label: 'Timeline', icon: History },
                { id: 'report', label: 'Report', icon: FileText }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            {!targetAddress ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Shield className="w-16 h-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold mb-2">Start an Investigation</h2>
                <p className="text-muted-foreground max-w-md">
                  Enter a wallet address above to begin analyzing transaction patterns,
                  detect clusters, and uncover suspicious activity.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Analyzing wallet...</p>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && walletProfile && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-background border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          <span className="text-sm text-muted-foreground">Volume</span>
                        </div>
                        <p className="text-2xl font-bold">{walletProfile.totalVolume.toFixed(2)} SOL</p>
                      </div>
                      <div className="bg-background border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-info" />
                          <span className="text-sm text-muted-foreground">Transactions</span>
                        </div>
                        <p className="text-2xl font-bold">{walletProfile.transactionCount.toLocaleString()}</p>
                      </div>
                      <div className="bg-background border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-success" />
                          <span className="text-sm text-muted-foreground">Counterparties</span>
                        </div>
                        <p className="text-2xl font-bold">{walletProfile.uniqueCounterparties}</p>
                      </div>
                      <div className="bg-background border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          <span className="text-sm text-muted-foreground">Risk Score</span>
                        </div>
                        <p className={cn('text-2xl font-bold', getRiskColor(walletProfile.riskScore))}>
                          {walletProfile.riskScore}/100
                        </p>
                      </div>
                    </div>

                    {/* Findings */}
                    <div className="bg-background border border-border rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-warning" />
                        Key Findings ({findings.length})
                      </h3>
                      {findings.length > 0 ? (
                        <div className="space-y-3">
                          {findings.map((finding) => (
                            <div
                              key={finding.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                            >
                              <div className={cn(
                                'px-2 py-1 rounded text-xs font-medium',
                                getSeverityColor(finding.severity)
                              )}>
                                {finding.severity.toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">{finding.title}</h4>
                                <p className="text-sm text-muted-foreground">{finding.description}</p>
                                {finding.evidence.length > 0 && (
                                  <ul className="mt-2 text-xs text-muted-foreground">
                                    {finding.evidence.map((e, i) => (
                                      <li key={i} className="flex items-center gap-1">
                                        <ChevronRight className="w-3 h-3" /> {e}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No significant findings detected. This wallet appears to have normal activity patterns.
                        </p>
                      )}
                    </div>

                    {/* Detected Patterns */}
                    <div className="bg-background border border-border rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Detected Patterns
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {walletProfile.patterns.map((pattern, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-muted text-sm"
                          >
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && walletProfile && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-background border border-border rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-4">Wallet Statistics</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Wallet Age</span>
                            <span className="font-medium">{walletProfile.age} days</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">SOL Balance</span>
                            <span className="font-medium">{walletProfile.solBalance.toFixed(4)} SOL</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Total Volume</span>
                            <span className="font-medium">{walletProfile.totalVolume.toFixed(2)} SOL</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Transactions</span>
                            <span className="font-medium">{walletProfile.transactionCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Unique Counterparties</span>
                            <span className="font-medium">{walletProfile.uniqueCounterparties}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-muted-foreground">Activity Score</span>
                            <span className="font-medium">{walletProfile.activityScore}/100</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-background border border-border rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-4">Token Holdings</h3>
                        {walletProfile.tokenHoldings.length > 0 ? (
                          <div className="space-y-2">
                            {walletProfile.tokenHoldings.map((token, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30"
                              >
                                <span className="font-medium">{token.symbol || formatAddress(token.mint)}</span>
                                <span className="text-muted-foreground">{token.balance?.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-4">No token holdings found</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                  <div className="bg-background border border-border rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <h3 className="font-semibold">Recent Transactions ({transactions.length})</h3>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                      {transactions.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Signature</th>
                              <th className="px-4 py-2 text-left font-medium">Time</th>
                              <th className="px-4 py-2 text-left font-medium">Type</th>
                              <th className="px-4 py-2 text-left font-medium">Direction</th>
                              <th className="px-4 py-2 text-right font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((tx, i) => (
                              <tr key={i} className="border-b border-border hover:bg-muted/30">
                                <td className="px-4 py-2 font-mono">
                                  <Link href={`/tx/${tx.signature}`} className="text-primary hover:underline">
                                    {formatAddress(tx.signature)}
                                  </Link>
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">
                                  {formatTime(tx.timestamp)}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-0.5 rounded bg-muted text-xs">
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded text-xs',
                                    tx.direction === 'in' ? 'bg-success/10 text-success' :
                                    tx.direction === 'out' ? 'bg-destructive/10 text-destructive' :
                                    'bg-muted text-muted-foreground'
                                  )}>
                                    {tx.direction}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono">
                                  {tx.amount.toFixed(4)} {tx.tokenSymbol}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-8 text-center text-muted-foreground">No transactions found</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Patterns Tab */}
                {activeTab === 'patterns' && walletProfile && (
                  <div className="space-y-6">
                    <div className="bg-background border border-border rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4">Behavior Analysis</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/30">
                          <div className="text-sm text-muted-foreground mb-1">Risk Score</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  walletProfile.riskScore >= 60 ? 'bg-warning' : 'bg-success'
                                )}
                                style={{ width: `${walletProfile.riskScore}%` }}
                              />
                            </div>
                            <span className={cn('font-bold', getRiskColor(walletProfile.riskScore))}>
                              {walletProfile.riskScore}%
                            </span>
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30">
                          <div className="text-sm text-muted-foreground mb-1">Activity Score</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${walletProfile.activityScore}%` }}
                              />
                            </div>
                            <span className="font-bold text-primary">{walletProfile.activityScore}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {clusters.length > 0 && (
                      <div className="bg-background border border-border rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-4">Detected Clusters</h3>
                        {clusters.map((cluster) => (
                          <div key={cluster.id} className="p-4 rounded-lg bg-muted/30">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium">{cluster.label}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {cluster.size} addresses | {cluster.totalVolume.toFixed(2)} SOL volume
                                </p>
                              </div>
                              <span className={cn(
                                'px-2 py-1 rounded text-xs',
                                cluster.riskScore >= 60 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                              )}>
                                Risk: {cluster.riskScore}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {cluster.nodes.slice(0, 5).map((node, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                                  {formatAddress(node)}
                                </span>
                              ))}
                              {cluster.nodes.length > 5 && (
                                <span className="px-2 py-0.5 text-xs text-muted-foreground">
                                  +{cluster.nodes.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="bg-background border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Transaction Timeline</h3>
                    <div className="space-y-4">
                      {transactions.slice(0, 20).map((tx, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-24 text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleDateString()}
                          </div>
                          <div className={cn(
                            'w-3 h-3 rounded-full mt-1',
                            tx.direction === 'in' ? 'bg-success' :
                            tx.direction === 'out' ? 'bg-destructive' :
                            'bg-muted'
                          )} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tx.type}</span>
                              <span className={cn(
                                'text-xs',
                                tx.direction === 'in' ? 'text-success' : 'text-destructive'
                              )}>
                                {tx.direction === 'in' ? '+' : '-'}{tx.amount.toFixed(4)} {tx.tokenSymbol}
                              </span>
                            </div>
                            <Link href={`/tx/${tx.signature}`} className="text-xs text-muted-foreground hover:text-primary font-mono">
                              {formatAddress(tx.signature)}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Report Tab */}
                {activeTab === 'report' && walletProfile && (
                  <div className="space-y-6">
                    <div className="bg-background border border-border rounded-xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold">Investigation Report</h3>
                        <button
                          onClick={() => {
                            const report = document.getElementById('report-content')?.innerText || '';
                            navigator.clipboard.writeText(report);
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Copy className="w-4 h-4" />
                          Copy Report
                        </button>
                      </div>

                      <div id="report-content" className="prose prose-sm max-w-none dark:prose-invert">
                        <h4>Summary</h4>
                        <p>
                          Investigation of wallet <code>{formatAddress(targetAddress)}</code> reveals
                          {walletProfile.riskScore >= 60 ? ' concerning activity patterns' : ' normal trading behavior'}.
                          The wallet has been active for {walletProfile.age} days with a total volume of {' '}
                          {walletProfile.totalVolume.toFixed(2)} SOL across {walletProfile.transactionCount.toLocaleString()} transactions.
                        </p>

                        <h4>Key Metrics</h4>
                        <ul>
                          <li>Risk Score: {walletProfile.riskScore}/100</li>
                          <li>Activity Score: {walletProfile.activityScore}/100</li>
                          <li>Unique Counterparties: {walletProfile.uniqueCounterparties}</li>
                          <li>Current Balance: {walletProfile.solBalance.toFixed(4)} SOL</li>
                        </ul>

                        <h4>Detected Patterns</h4>
                        <ul>
                          {walletProfile.patterns.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>

                        <h4>Findings ({findings.length})</h4>
                        {findings.length > 0 ? (
                          <ul>
                            {findings.map(f => (
                              <li key={f.id}>
                                <strong>{f.title}</strong> ({f.severity}): {f.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>No significant findings detected during this investigation.</p>
                        )}

                        <h4>Top Counterparties</h4>
                        <ul>
                          {walletProfile.topCounterparties.slice(0, 5).map((cp, i) => (
                            <li key={i}>
                              {formatAddress(cp.address)}: {cp.count} transactions, {cp.volume.toFixed(2)} SOL volume
                            </li>
                          ))}
                        </ul>

                        <p className="text-muted-foreground text-xs mt-8">
                          Report generated on {new Date().toLocaleString()} by OpenSVM Investigation Mode
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
