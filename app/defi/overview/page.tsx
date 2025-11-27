'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';

// Category navigation data
const DEFI_CATEGORIES = [
  { slug: 'amms', name: 'AMMs', description: 'Automated market makers and liquidity pools', icon: '~' },
  { slug: 'clobs', name: 'CLOBs', description: 'Central limit order books', icon: '#' },
  { slug: 'aggregators', name: 'Aggregators', description: 'DEX aggregators and swap optimization', icon: '*' },
  { slug: 'perpetuals', name: 'Perpetuals', description: 'Perpetual futures trading', icon: '%' },
  { slug: 'options', name: 'Options', description: 'Options trading platforms', icon: '@' },
  { slug: 'staking', name: 'Staking', description: 'Staking pools and validators', icon: '+' },
  { slug: 'yield-agg', name: 'Yield', description: 'Yield aggregators and farming', icon: '$' },
  { slug: 'stablecoins', name: 'Stablecoins', description: 'Stablecoin analytics', icon: '=' },
  { slug: 'launchpads', name: 'Launchpads', description: 'Token launch platforms', icon: '^' },
  { slug: 'oracles', name: 'Oracles', description: 'Data providers and oracles', icon: '?' },
  { slug: 'defai', name: 'DeFAI', description: 'AI-powered DeFi tools', icon: '!' },
  { slug: 'tools', name: 'Tools', description: 'DeFi utilities and infrastructure', icon: '>' },
  { slug: 'memecoins', name: 'Memecoins', description: 'Memecoin tracking', icon: '&' },
  { slug: 'coins-screener', name: 'Screener', description: 'Token screening tools', icon: '/' },
];

interface OverviewMetrics {
  totalTvl: number;
  totalVolume24h: number;
  activeDexes: number;
  totalTransactions: number;
  topProtocols: Array<{
    name: string;
    tvl: number;
    volume24h: number;
    category: string;
  }>;
  marketshareData: Array<{
    name: string;
    share: number;
    volume: number;
  }>;
  healthStatus: {
    isHealthy: boolean;
    lastUpdate: number;
    connectedDEXes: number;
    dataPoints: number;
  };
  sectorBreakdown: {
    dex: { tvl: number; volume24h: number; protocols: number };
    lending: { tvl: number; volume24h: number; protocols: number };
    derivatives: { tvl: number; volume24h: number; protocols: number };
    staking: { tvl: number; volume24h: number; protocols: number };
    aggregators: { tvl: number; volume24h: number; protocols: number };
    launchpads: { tvl: number; volume24h: number; protocols: number };
  };
}

interface ApiResponse {
  success: boolean;
  data: OverviewMetrics;
  timestamp: number;
  source: string;
  cached?: boolean;
}

export default function DeFiOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const response = await fetch('/api/analytics/overview');
      const data: ApiResponse = await response.json();

      if (data.success && data.data) {
        setMetrics(data.data);
        setLastUpdate(new Date(data.timestamp));
      } else {
        throw new Error('Failed to fetch DeFi overview data');
      }
    } catch (err) {
      console.error('Error fetching DeFi overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => fetchData()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-foreground">Solana DeFi Overview</h1>
            {metrics?.healthStatus?.isHealthy && (
              <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm rounded-full border border-green-500/20">
                Live
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-lg">
            Comprehensive analytics across all Solana DeFi protocols
          </p>
          {lastUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total TVL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatNumber(metrics?.totalTvl || 0)}</div>
              <p className="text-xs text-muted-foreground">Across all protocols</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">24h Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatNumber(metrics?.totalVolume24h || 0)}</div>
              <p className="text-xs text-muted-foreground">Trading volume</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Protocols</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.activeDexes || 0}</div>
              <p className="text-xs text-muted-foreground">Connected DEXes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">24h Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metrics?.totalTransactions || 0)}</div>
              <p className="text-xs text-muted-foreground">On-chain txns</p>
            </CardContent>
          </Card>
        </div>

        {/* Sector Breakdown */}
        {metrics?.sectorBreakdown && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Sector Breakdown</CardTitle>
              <CardDescription>TVL and volume distribution by DeFi category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(metrics.sectorBreakdown).map(([sector, data]) => (
                  <div key={sector} className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium capitalize mb-2">{sector}</div>
                    <div className="text-lg font-bold">${formatNumber(data.tvl)}</div>
                    <div className="text-xs text-muted-foreground">
                      Vol: ${formatNumber(data.volume24h)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.protocols} protocols
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Protocols */}
        {metrics?.topProtocols && metrics.topProtocols.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Top DeFi Protocols</CardTitle>
              <CardDescription>Leading protocols by trading volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Rank</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Protocol</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Category</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">TVL</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">24h Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topProtocols.map((protocol, index) => (
                      <tr key={protocol.name} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-2">
                          <span className="text-muted-foreground">#{index + 1}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium capitalize">{protocol.name}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-1 bg-muted rounded text-xs">{protocol.category}</span>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          ${formatNumber(protocol.tvl)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          ${formatNumber(protocol.volume24h)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Market Share */}
        {metrics?.marketshareData && metrics.marketshareData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>DEX Market Share</CardTitle>
              <CardDescription>Volume distribution across exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.marketshareData.map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium capitalize truncate">{item.name}</div>
                    <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(item.share, 2)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        {item.share.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-28 text-right text-sm text-muted-foreground font-mono">
                      ${formatNumber(item.volume)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>Explore DeFi Categories</CardTitle>
            <CardDescription>Deep dive into specific DeFi sectors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {DEFI_CATEGORIES.map((category) => (
                <Link
                  key={category.slug}
                  href={`/defi/${category.slug}`}
                  className="group p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border"
                >
                  <div className="text-2xl mb-2 font-mono text-primary">{category.icon}</div>
                  <div className="font-medium text-sm group-hover:text-primary transition-colors">
                    {category.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {category.description}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Data aggregated from DeFiLlama, Jupiter, and on-chain sources.</p>
          <p className="mt-1">Auto-refreshes every 60 seconds.</p>
        </div>
      </div>
    </div>
  );
}
