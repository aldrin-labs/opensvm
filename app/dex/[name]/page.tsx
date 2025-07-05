'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Users, Zap, Shield, DollarSign, Activity, Calendar, AlertTriangle, InfoIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface DexProfile {
  name: string;
  description: string;
  logo: string;
  website: string;
  twitter: string;
  telegram: string;
  github: string;
  programId: string;
  totalVolume: number;
  volume24h: number;
  volumeChange: number;
  tvl: number;
  tvlChange: number;
  marketShare: number;
  activeUsers: number;
  transactions: number;
  avgTransactionSize: number;
  fees24h: number;
  totalFees: number;
  commission: number;
  status: 'active' | 'inactive' | 'deprecated';
  security: {
    audited: boolean;
    auditors: string[];
    lastAudit: string;
    bugBounty: boolean;
    multisig: boolean;
    timelock: boolean;
  };
  metrics: {
    uptime: number;
    avgSlippage: number;
    poolCount: number;
    tokenCount: number;
    liquidityDepth: number;
  };
  historicalData: {
    volumeHistory: Array<{
      date: string;
      volume: number;
      tvl: number;
      users: number;
    }>;
    feeHistory: Array<{
      date: string;
      fees: number;
      transactions: number;
    }>;
    performanceHistory: Array<{
      date: string;
      uptime: number;
      slippage: number;
      latency: number;
    }>;
  };
  topPools: Array<{
    address: string;
    tokenA: string;
    tokenB: string;
    tvl: number;
    volume24h: number;
    fees24h: number;
    apr: number;
    price: number;
  }>;
  recentTrades: Array<{
    signature: string;
    timestamp: number;
    type: 'buy' | 'sell';
    tokenA: string;
    tokenB: string;
    amountA: number;
    amountB: number;
    price: number;
    user: string;
  }>;
  recommendations: {
    shouldTrade: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    pros: string[];
    cons: string[];
  };
}

export default function DexProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<DexProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dexName = params.name as string;

  useEffect(() => {
    const fetchDexProfile = async () => {
      try {
        const response = await fetch(`/api/dex/${encodeURIComponent(dexName)}`);
        const result = await response.json();
        
        if (result.success) {
          setProfile(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch DEX profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    };

    if (dexName) {
      fetchDexProfile();
    }
  }, [dexName]);

  const formatCurrency = (value: number | undefined | null) => {
    if (value == null || isNaN(value)) return '$0.00';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value == null || isNaN(value)) return '0.00%';
    const formatted = (value * 100).toFixed(2);
    return value >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value == null || isNaN(value)) return '0';
    return value.toLocaleString();
  };

  const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-background border border-border rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
        {content}
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-accent';
      case 'inactive': return 'text-destructive';
      case 'deprecated': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-accent';
      case 'medium': return 'text-secondary';
      case 'high': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading DEX profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertTriangle className="h-8 w-8 mr-2" />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <span>DEX profile not found</span>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'Market Share', value: profile.marketShare * 100, color: '#8884d8' },
    { name: 'Others', value: 100 - (profile.marketShare * 100), color: '#82ca9d' }
  ];

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Analytics
        </button>
      </div>

      {/* DEX Header */}
      <div className="bg-background border rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-primary-foreground font-bold text-2xl">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <p className="text-muted-foreground">{profile.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(profile.status)}`}>
                  {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">Program ID: {profile.programId}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Website
              </a>
            )}
            {profile.twitter && (
              <a
                href={profile.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
              >
                Twitter
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <Tooltip content="Total trading volume in the last 24 hours">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  24h Volume <InfoIcon className="h-3 w-3" />
                </p>
              </Tooltip>
              <p className="text-2xl font-bold">{formatCurrency(profile.volume24h)}</p>
              <p className={`text-sm ${profile.volumeChange >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {formatPercent(profile.volumeChange)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <Tooltip content="Total Value Locked across all liquidity pools">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  TVL <InfoIcon className="h-3 w-3" />
                </p>
              </Tooltip>
              <p className="text-2xl font-bold">{formatCurrency(profile.tvl)}</p>
              <p className={`text-sm ${profile.tvlChange >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {formatPercent(profile.tvlChange)}
              </p>
            </div>
            <Shield className="h-8 w-8 text-accent" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <Tooltip content="Market share of total Solana DEX ecosystem volume">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Market Share <InfoIcon className="h-3 w-3" />
                </p>
              </Tooltip>
              <p className="text-2xl font-bold">{((profile.marketShare || 0) * 100).toFixed(1)}%</p>
            </div>
            <Activity className="h-8 w-8 text-secondary" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <Tooltip content="Number of unique active users in the last 24 hours">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  Active Users <InfoIcon className="h-3 w-3" />
                </p>
              </Tooltip>
              <p className="text-2xl font-bold">{formatNumber(profile.activeUsers)}</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Volume Chart */}
        <div className="bg-background border rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Volume History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={profile.historicalData.volumeHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="volume" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Market Share Chart */}
        <div className="bg-background border rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Market Share</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Security & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-background border rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Security Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Audited</span>
              <span className={profile.security.audited ? 'text-accent' : 'text-destructive'}>
                {profile.security.audited ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bug Bounty</span>
              <span className={profile.security.bugBounty ? 'text-accent' : 'text-destructive'}>
                {profile.security.bugBounty ? 'Active' : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Multisig</span>
              <span className={profile.security.multisig ? 'text-accent' : 'text-destructive'}>
                {profile.security.multisig ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Timelock</span>
              <span className={profile.security.timelock ? 'text-accent' : 'text-destructive'}>
                {profile.security.timelock ? 'Active' : 'None'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-background border rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Uptime</span>
              <span className="text-accent">{profile.metrics.uptime.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Avg Slippage</span>
              <span>{profile.metrics.avgSlippage.toFixed(3)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pool Count</span>
              <span>{formatNumber(profile.metrics.poolCount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Token Count</span>
              <span>{formatNumber(profile.metrics.tokenCount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Pools */}
      <div className="bg-background border rounded-lg shadow mb-8">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Top Liquidity Pools</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="pb-3 font-medium">Pool</th>
                  <th className="pb-3 font-medium">TVL</th>
                  <th className="pb-3 font-medium">24h Volume</th>
                  <th className="pb-3 font-medium">24h Fees</th>
                  <th className="pb-3 font-medium">APR</th>
                  <th className="pb-3 font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {profile.topPools.map((pool, index) => (
                  <tr key={pool.address} className="border-b border-border">
                    <td className="py-3 font-medium">{pool.tokenA}/{pool.tokenB}</td>
                    <td className="py-3">{formatCurrency(pool.tvl)}</td>
                    <td className="py-3">{formatCurrency(pool.volume24h)}</td>
                    <td className="py-3">{formatCurrency(pool.fees24h)}</td>
                    <td className="py-3">
                      <span className={`font-medium ${
                        pool.apr > 50 ? 'text-accent' : pool.apr > 20 ? 'text-secondary' : 'text-muted-foreground'
                      }`}>
                        {pool.apr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3">{formatCurrency(pool.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-background border rounded-lg shadow">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Trading Recommendations</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">Recommendation:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  profile.recommendations.shouldTrade ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'
                }`}>
                  {profile.recommendations.shouldTrade ? 'Recommended' : 'Not Recommended'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">Risk Level:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(profile.recommendations.riskLevel)}`}>
                  {profile.recommendations.riskLevel.charAt(0).toUpperCase() + profile.recommendations.riskLevel.slice(1)}
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Reasons:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {profile.recommendations.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <h4 className="font-medium text-accent mb-2">Pros:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {profile.recommendations.pros.map((pro, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-accent mt-1">+</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-destructive mb-2">Cons:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {profile.recommendations.cons.map((con, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-destructive mt-1">-</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}