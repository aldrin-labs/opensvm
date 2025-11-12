'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/utils';
import { formatSupply } from '@/lib/format-supply';
import { Stack } from 'rinlab';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { ShareButton } from '@/components/ShareButton';
import { TokenPriceChart } from '@/components/token/TokenPriceChart';
import { TokenHolderAnalytics } from '@/components/token/TokenHolderAnalytics';
import { TokenDEXAnalytics } from '@/components/token/TokenDEXAnalytics';
import { TokenAIInsights } from '@/components/token/TokenAIInsights';
import { TokenTransactionFeed } from '@/components/token/TokenTransactionFeed';
import { TokenTechnicalIndicators } from '@/components/token/TokenTechnicalIndicators';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Activity, Users, DollarSign, BarChart3, Brain, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokenData {
  metadata?: {
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
    updateAuthority?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  supply?: number;
  holders?: number;
  decimals: number;
  volume24h?: number;
  liquidity?: number;
  top10Balance?: number;
  top50Balance?: number;
  top100Balance?: number;
  totalHolders?: number;
}

interface MarketData {
  ohlcv?: any[];
  indicators?: {
    ma7: (number | null)[];
    ma25: (number | null)[];
    macd: {
      line: (number | null)[];
      signal: (number | null)[];
      histogram: (number | null)[];
    };
  };
  pools?: any[];
  mainPair?: {
    pair: string;
    dex: string;
    poolAddress: string;
  };
}

interface Props {
  mint: string;
}

export default function TokenDetails({ mint }: Props) {
  const [data, setData] = useState<TokenData | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch token data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch basic token info
        const tokenResponse = await fetch(`/api/token/${mint}`);
        if (!tokenResponse.ok) throw new Error('Failed to fetch token data');
        const tokenInfo = await tokenResponse.json();
        setData(tokenInfo);

        // Fetch market data
        const marketResponse = await fetch(`/api/market-data?mint=${mint}&type=${selectedTimeframe}`);
        if (marketResponse.ok) {
          const marketInfo = await marketResponse.json();
          setMarketData(marketInfo);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [mint, selectedTimeframe, refreshKey]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-12 w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">Error: {error || 'Failed to load token data'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priceChangeColor = (data.priceChange24h || 0) >= 0 ? 'text-green-500' : 'text-red-500';
  const PriceIcon = (data.priceChange24h || 0) >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Token Header with Key Metrics */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {data.metadata?.image && (
                <div className="relative">
                  <Image
                    src={data.metadata.image}
                    alt={data.metadata.name || 'Token'}
                    width={64}
                    height={64}
                    className="rounded-full ring-4 ring-white/20"
                  />
                  <Badge className="absolute -bottom-2 -right-2 bg-green-500">
                    Live
                  </Badge>
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  {data.metadata?.name || 'Unknown Token'}
                  <Badge variant="outline">{data.metadata?.symbol || 'N/A'}</Badge>
                </h1>
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {mint.slice(0, 8)}...{mint.slice(-8)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <ShareButton
                entityType="token"
                entityId={mint}
                variant="outline"
                size="sm"
              />
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                {data.holders || 0} holders
              </Badge>
            </div>
          </div>
        </div>

        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Price */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Price
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  ${data.price?.toFixed(6) || '0.00'}
                </span>
                {data.priceChange24h && (
                  <div className={cn("flex items-center gap-1", priceChangeColor)}>
                    <PriceIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {Math.abs(data.priceChange24h).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Market Cap */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                Market Cap
              </div>
              <div className="text-xl font-semibold">
                ${formatNumber(data.marketCap || 0)}
              </div>
            </div>

            {/* Volume 24h */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Activity className="h-3 w-3" />
                Volume 24h
              </div>
              <div className="text-xl font-semibold">
                ${formatNumber(data.volume24h || 0)}
              </div>
            </div>

            {/* Liquidity */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Zap className="h-3 w-3" />
                Liquidity
              </div>
              <div className="text-xl font-semibold">
                ${formatNumber(data.liquidity || 0)}
              </div>
            </div>

            {/* Supply */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                Supply
              </div>
              <Tooltip content={formatSupply(data.supply || 0, data.decimals).tooltip}>
                <div className="text-xl font-semibold break-words cursor-help">
                  {formatSupply(data.supply || 0, data.decimals).display}
                </div>
              </Tooltip>
            </div>

            {/* Holders */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                Holders
              </div>
              <div className="text-xl font-semibold">
                {formatNumber(data.totalHolders || data.holders || 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="chart" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Chart
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1">
            <Activity className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="holders" className="gap-1">
            <Users className="h-4 w-4" />
            Holders
          </TabsTrigger>
          <TabsTrigger value="dex" className="gap-1">
            <Zap className="h-4 w-4" />
            DEX
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1">
            <Brain className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Chart Tab */}
        <TabsContent value="chart" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <TokenPriceChart 
                mint={mint} 
                data={marketData}
                timeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
              />
            </div>
            <div>
              <TokenTechnicalIndicators 
                data={marketData}
                price={data.price}
                priceChange={data.priceChange24h}
              />
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Market Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">24h High</span>
                    <span className="font-medium">$-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">24h Low</span>
                    <span className="font-medium">$-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">All Time High</span>
                    <span className="font-medium">$-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Market Cap Rank</span>
                    <span className="font-medium">#-</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supply Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Supply</span>
                    <span className="font-medium">{formatNumber(data.supply || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Circulating Supply</span>
                    <span className="font-medium">{formatNumber(data.supply || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Decimals</span>
                    <span className="font-medium">{data.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mint Authority</span>
                    <span className="font-medium text-xs">
                      {data.metadata?.updateAuthority ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Holders Tab */}
        <TabsContent value="holders">
          <TokenHolderAnalytics 
            mint={mint}
            totalHolders={data.totalHolders || data.holders || 0}
            top10Balance={data.top10Balance}
            top50Balance={data.top50Balance}
            top100Balance={data.top100Balance}
          />
        </TabsContent>

        {/* DEX Tab */}
        <TabsContent value="dex">
          <TokenDEXAnalytics 
            mint={mint}
            pools={marketData?.pools || []}
            mainPair={marketData?.mainPair}
          />
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai">
          <TokenAIInsights 
            mint={mint}
            tokenData={data}
            marketData={marketData}
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <TokenTransactionFeed mint={mint} />
        </TabsContent>
      </Tabs>

      {/* Token Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Token Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Mint Address</div>
                <div className="font-mono text-xs break-all">
                  {mint}
                </div>
              </div>
              {data.metadata?.updateAuthority && (
                <div>
                  <div className="text-sm text-muted-foreground">Update Authority</div>
                  <div className="font-mono text-xs break-all">
                    {data.metadata.updateAuthority}
                  </div>
                </div>
              )}
            </div>
            {data.metadata?.description && (
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="mt-1">
                  {data.metadata.description}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
