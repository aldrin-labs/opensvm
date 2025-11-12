'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ExternalLink, Zap, TrendingUp, DollarSign, Activity, RefreshCw } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface Pool {
  dex: string;
  pair: string;
  poolAddress: string;
  price?: number;
  liquidity?: number;
  volume24h?: number;
  txCount24h?: number;
  lastSeen?: string;
  pairToken?: string;
  pairAddress?: string;
}

interface Props {
  mint: string;
  pools: Pool[];
  mainPair?: {
    pair: string;
    dex: string;
    poolAddress: string;
  };
}

const DEX_COLORS: Record<string, string> = {
  'Raydium': 'hsl(var(--chart-1))',
  'Orca': 'hsl(var(--chart-2))',
  'Meteora': 'hsl(var(--chart-3))',
  'Phoenix': 'hsl(var(--chart-4))',
  'Lifinity': 'hsl(var(--chart-5))',
  'Default': 'hsl(var(--muted-foreground))'
};

export function TokenDEXAnalytics({ mint, pools, mainPair }: Props) {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate DEX distribution
  const dexDistribution = pools.reduce((acc, pool) => {
    const dex = pool.dex || 'Unknown';
    if (!acc[dex]) {
      acc[dex] = {
        volume: 0,
        liquidity: 0,
        count: 0,
        pools: []
      };
    }
    acc[dex].volume += pool.volume24h || 0;
    acc[dex].liquidity += pool.liquidity || 0;
    acc[dex].count += 1;
    acc[dex].pools.push(pool);
    return acc;
  }, {} as Record<string, any>);

  // Prepare chart data
  const volumeChartData = Object.entries(dexDistribution).map(([dex, data]) => ({
    name: dex,
    volume: data.volume,
    liquidity: data.liquidity,
    pools: data.count
  })).sort((a, b) => b.volume - a.volume);

  const pieData = volumeChartData.map(item => ({
    name: item.name,
    value: item.volume,
    color: DEX_COLORS[item.name] || DEX_COLORS.Default
  }));

  // Calculate totals
  const totalVolume = pools.reduce((sum, pool) => sum + (pool.volume24h || 0), 0);
  const totalLiquidity = pools.reduce((sum, pool) => sum + (pool.liquidity || 0), 0);
  const totalTxCount = pools.reduce((sum, pool) => sum + (pool.txCount24h || 0), 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{payload[0].payload.name}</p>
          <div className="space-y-1 mt-2">
            <p className="text-xs">
              Volume: ${formatNumber(payload[0].value)}
            </p>
            {payload[1] && (
              <p className="text-xs">
                Liquidity: ${formatNumber(payload[1].value)}
              </p>
            )}
            {payload[0].payload.pools && (
              <p className="text-xs">
                Pools: {payload[0].payload.pools}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const openPoolInExplorer = (poolAddress: string) => {
    window.open(`https://solscan.io/account/${poolAddress}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Volume 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totalVolume)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all DEXs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Total Liquidity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totalLiquidity)}</div>
            <p className="text-xs text-muted-foreground mt-1">Combined TVL</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Transactions 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalTxCount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total swaps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Active Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pools.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Trading pairs</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Volume by DEX */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Volume by DEX</CardTitle>
              <Button size="sm" variant="ghost" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={volumeChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="stroke-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="stroke-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="volume" fill="hsl(var(--chart-1))" />
                <Bar dataKey="liquidity" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Market Share */}
        <Card>
          <CardHeader>
            <CardTitle>Market Share</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${formatNumber(value)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Main Trading Pair */}
      {mainPair && (
        <Card className="border-blue-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">Main Pair</Badge>
              {mainPair.pair}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{mainPair.dex}</Badge>
                  <span className="text-sm text-muted-foreground">Primary DEX</span>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {mainPair.poolAddress}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPoolInExplorer(mainPair.poolAddress)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Pool
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pools Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Liquidity Pools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">DEX</th>
                  <th className="text-left p-2">Pair</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-right p-2">Liquidity</th>
                  <th className="text-right p-2">Volume 24h</th>
                  <th className="text-right p-2">Txns 24h</th>
                  <th className="text-center p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool, index) => (
                  <tr key={`${pool.poolAddress}-${index}`} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: DEX_COLORS[pool.dex] || DEX_COLORS.Default,
                          color: DEX_COLORS[pool.dex] || DEX_COLORS.Default
                        }}
                      >
                        {pool.dex}
                      </Badge>
                    </td>
                    <td className="p-2 font-medium">{pool.pair}</td>
                    <td className="p-2 text-right">
                      ${pool.price?.toFixed(6) || '-'}
                    </td>
                    <td className="p-2 text-right">
                      ${formatNumber(pool.liquidity || 0)}
                    </td>
                    <td className="p-2 text-right">
                      ${formatNumber(pool.volume24h || 0)}
                    </td>
                    <td className="p-2 text-right">
                      {formatNumber(pool.txCount24h || 0)}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openPoolInExplorer(pool.poolAddress)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`https://dexscreener.com/solana/${pool.poolAddress}`, '_blank')}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pool Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Liquidity Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Liquidity Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-2">Liquidity Distribution</h4>
              <div className="space-y-2">
                {Object.entries(dexDistribution).map(([dex, data]) => {
                  const percentage = (data.liquidity / totalLiquidity) * 100;
                  return (
                    <div key={dex} className="flex items-center gap-2">
                      <span className="text-sm w-20">{dex}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: DEX_COLORS[dex] || DEX_COLORS.Default
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Health Indicators */}
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Market Health</h4>
              <div className="space-y-2 text-sm">
                {totalLiquidity > 1000000 ? (
                  <p className="text-green-500">✓ Strong liquidity: ${formatNumber(totalLiquidity)} TVL</p>
                ) : totalLiquidity > 100000 ? (
                  <p className="text-yellow-500">⚠️ Moderate liquidity: ${formatNumber(totalLiquidity)} TVL</p>
                ) : (
                  <p className="text-red-500">⚠️ Low liquidity: ${formatNumber(totalLiquidity)} TVL</p>
                )}
                
                {pools.length > 5 ? (
                  <p className="text-green-500">✓ Good DEX coverage: {pools.length} active pools</p>
                ) : (
                  <p className="text-yellow-500">⚠️ Limited DEX coverage: {pools.length} pools</p>
                )}
                
                {totalVolume > 100000 ? (
                  <p className="text-green-500">✓ High trading activity: ${formatNumber(totalVolume)} daily volume</p>
                ) : (
                  <p className="text-yellow-500">⚠️ Low trading activity: ${formatNumber(totalVolume)} daily volume</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
