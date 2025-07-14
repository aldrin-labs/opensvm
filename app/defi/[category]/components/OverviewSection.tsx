'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatNumber } from '@/lib/utils';

interface DeFiMetrics {
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
}

export default function OverviewSection() {
  const [metrics, setMetrics] = useState<DeFiMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOverviewData() {
      try {
        // Fetch data from multiple sources for comprehensive overview
        const [dexData, launchpadsData, aggregatorsData] = await Promise.all([
          fetch('/api/analytics/dex').then(res => res.json()),
          fetch('/api/analytics/launchpads').then(res => res.json()),
          fetch('/api/analytics/aggregators').then(res => res.json())
        ]);

        if (dexData.success && launchpadsData.success && aggregatorsData.success) {
          // Combine data from different DeFi sectors
          const dexVolume = dexData.data?.volume?.reduce((sum: number, v: any) => sum + v.volume24h, 0) || 0;
          const dexTvl = dexData.data?.liquidity?.reduce((sum: number, l: any) => sum + l.liquidityUSD, 0) || 0;
          const aggregatorVolume = aggregatorsData.data?.volume?.reduce((sum: number, v: any) => sum + v.volume24h, 0) || 0;

          // Create top protocols list from all sources
          const topProtocols = [
            ...(dexData.data?.rankings?.slice(0, 5).map((d: any) => ({
              name: d.dex,
              tvl: d.tvl,
              volume24h: d.volume24h,
              category: 'AMM'
            })) || []),
            ...(launchpadsData.data?.slice(0, 3).map((l: any) => ({
              name: l.name,
              tvl: l.marketCap || 0,
              volume24h: l.totalRaised || 0,
              category: 'Launchpad'
            })) || []),
            ...(aggregatorsData.data?.rankings?.slice(0, 2).map((a: any) => ({
              name: a.aggregator,
              tvl: a.tvl || 0,
              volume24h: a.volume24h,
              category: 'Aggregator'
            })) || [])
          ].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);

          // Market share data
          const marketshareData = dexData.data?.rankings?.slice(0, 8).map((d: any) => ({
            name: d.dex,
            share: d.marketShare * 100,
            volume: d.volume24h
          })) || [];

          setMetrics({
            totalTvl: dexTvl,
            totalVolume24h: dexVolume + aggregatorVolume,
            activeDexes: dexData.data?.rankings?.length || 0,
            totalTransactions: dexData.data?.volume?.reduce((sum: number, v: any) => sum + (v.transactions || 0), 0) || 0,
            topProtocols,
            marketshareData
          });
        } else {
          throw new Error('Failed to fetch data from one or more sources');
        }
      } catch (err) {
        console.error('Error fetching DeFi overview data:', err);
        setError('Failed to load DeFi overview data');
      } finally {
        setLoading(false);
      }
    }

    fetchOverviewData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return <div className="text-center py-20">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total TVL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(metrics.totalTvl)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">24h Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(metrics.totalVolume24h)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Protocols</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeDexes}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">24h Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.totalTransactions)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Protocols Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top DeFi Protocols</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Protocol</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">TVL</th>
                  <th className="text-right py-2">24h Volume</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topProtocols.map((protocol, index) => (
                  <tr key={protocol.name} className="border-b">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">#{index + 1}</span>
                        <span className="font-medium capitalize">{protocol.name}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-muted rounded text-xs">{protocol.category}</span>
                    </td>
                    <td className="py-3 text-right">${formatNumber(protocol.tvl)}</td>
                    <td className="py-3 text-right">${formatNumber(protocol.volume24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Market Share Chart */}
      <Card>
        <CardHeader>
          <CardTitle>DEX Market Share</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.marketshareData.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div className="w-20 text-sm capitalize">{item.name}</div>
                <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(item.share, 2)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    {item.share.toFixed(1)}%
                  </span>
                </div>
                <div className="w-24 text-right text-sm text-muted-foreground">
                  ${formatNumber(item.volume)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}