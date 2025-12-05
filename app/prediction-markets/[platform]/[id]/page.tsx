'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { getAlertsManager, AlertType } from '@/lib/prediction-markets/alerts';

interface MarketDetail {
  id: string;
  platform: string;
  ticker: string;
  title: string;
  description?: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  closeTime?: string;
  resolved: boolean;
  outcome?: 'yes' | 'no';
  lastUpdated: number;
  priceHistory: Array<{
    timestamp: number;
    yesPrice: number;
  }>;
}

interface RelatedMarket {
  id: string;
  platform: string;
  title: string;
  yesPrice: number;
  volume24h: number;
  similarity: number;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: number;
}

interface CandleData {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  kalshi: '#2563eb',
  polymarket: '#7c3aed',
  manifold: '#10b981',
  drift: '#f59e0b',
};

const PLATFORM_LABELS: Record<string, string> = {
  kalshi: 'Kalshi',
  polymarket: 'Polymarket',
  manifold: 'Manifold',
  drift: 'Drift',
};

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Custom Candlestick component
function CandlestickChart({ data }: { data: CandleData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No historical data available
      </div>
    );
  }

  // Generate candlestick visualization using bars
  const candleData = data.map((d, i) => ({
    ...d,
    isUp: d.close >= d.open,
    body: Math.abs(d.close - d.open),
    bodyStart: Math.min(d.open, d.close),
    wick: d.high - d.low,
    wickStart: d.low,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={candleData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        <YAxis
          domain={['dataMin - 5', 'dataMax + 5']}
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload as CandleData;
            return (
              <div className="bg-background border rounded-lg p-3 shadow-lg">
                <p className="font-medium">{d.time}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                  <span className="text-muted-foreground">Open:</span>
                  <span>{d.open.toFixed(1)}%</span>
                  <span className="text-muted-foreground">High:</span>
                  <span className="text-success">{d.high.toFixed(1)}%</span>
                  <span className="text-muted-foreground">Low:</span>
                  <span className="text-destructive">{d.low.toFixed(1)}%</span>
                  <span className="text-muted-foreground">Close:</span>
                  <span className={d.close >= d.open ? 'text-success' : 'text-destructive'}>
                    {d.close.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          }}
        />
        {/* High-Low line (wick) */}
        <Line
          type="monotone"
          dataKey="high"
          stroke="#888"
          strokeWidth={1}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="low"
          stroke="#888"
          strokeWidth={1}
          dot={false}
          connectNulls
        />
        {/* Close price line */}
        <Area
          type="monotone"
          dataKey="close"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.1}
          strokeWidth={2}
          dot={false}
        />
        {/* Reference lines */}
        <ReferenceLine y={50} stroke="#888" strokeDasharray="3 3" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Order Book Depth Chart
function DepthChart({ orderBook }: { orderBook: OrderBook }) {
  // Build cumulative depth data
  const depthData: Array<{ price: number; bidDepth: number; askDepth: number }> = [];

  // Cumulative bids (descending price)
  let cumBid = 0;
  [...orderBook.bids].reverse().forEach(level => {
    cumBid += level.quantity;
    depthData.push({
      price: level.price,
      bidDepth: cumBid,
      askDepth: 0,
    });
  });

  // Add midpoint
  depthData.push({
    price: orderBook.midPrice,
    bidDepth: cumBid,
    askDepth: 0,
  });

  // Cumulative asks (ascending price)
  let cumAsk = 0;
  orderBook.asks.forEach(level => {
    cumAsk += level.quantity;
    depthData.push({
      price: level.price,
      bidDepth: 0,
      askDepth: cumAsk,
    });
  });

  // Sort by price
  depthData.sort((a, b) => a.price - b.price);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={depthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="price"
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          tickFormatter={(v) => formatVolume(v)}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-background border rounded-lg p-2 shadow-lg text-sm">
                <p>Price: {d.price}%</p>
                {d.bidDepth > 0 && <p className="text-success">Bid Depth: {formatVolume(d.bidDepth)}</p>}
                {d.askDepth > 0 && <p className="text-destructive">Ask Depth: {formatVolume(d.askDepth)}</p>}
              </div>
            );
          }}
        />
        <Area
          type="stepAfter"
          dataKey="bidDepth"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.3}
        />
        <Area
          type="stepAfter"
          dataKey="askDepth"
          stroke="#ef4444"
          fill="#ef4444"
          fillOpacity={0.3}
        />
        <ReferenceLine x={orderBook.midPrice} stroke="#888" strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const platform = params.platform as string;
  const marketId = params.id as string;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [relatedMarkets, setRelatedMarkets] = useState<RelatedMarket[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d' | '7d'>('1d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data
  const fetchMarket = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch market details
      const response = await fetch(
        `/api/prediction-markets/markets?platform=${platform}&search=${encodeURIComponent(marketId)}&limit=1`
      );

      if (!response.ok) throw new Error('Failed to fetch market');

      const data = await response.json();
      const foundMarket = data.markets?.find(
        (m: MarketDetail) => m.id === marketId || m.ticker === marketId
      );

      if (!foundMarket) {
        setError('Market not found');
        return;
      }

      setMarket(foundMarket);

      // Generate simulated candle data from price history
      if (foundMarket.priceHistory?.length > 0) {
        const candles = generateCandleData(foundMarket.priceHistory, timeframe);
        setCandleData(candles);
      }

      // Generate simulated order book
      const book = generateOrderBook(foundMarket.yesPrice, foundMarket.liquidity);
      setOrderBook(book);

      // Fetch related markets
      await fetchRelatedMarkets(foundMarket.title, platform);

      setError(null);
    } catch (e) {
      console.error('Failed to fetch market:', e);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [platform, marketId, timeframe]);

  // Fetch related/correlated markets
  const fetchRelatedMarkets = async (title: string, currentPlatform: string) => {
    try {
      // Extract key terms from title for search
      const keywords = title
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 3)
        .join(' ');

      if (!keywords) return;

      const response = await fetch(
        `/api/prediction-markets/markets?search=${encodeURIComponent(keywords)}&limit=20`
      );

      if (!response.ok) return;

      const data = await response.json();

      // Filter out current market and calculate similarity
      const related = (data.markets || [])
        .filter((m: MarketDetail) => !(m.platform === currentPlatform && m.id === marketId))
        .map((m: MarketDetail) => ({
          id: m.id,
          platform: m.platform,
          title: m.title,
          yesPrice: m.yesPrice,
          volume24h: m.volume24h,
          similarity: calculateSimilarity(title, m.title),
        }))
        .filter((m: RelatedMarket) => m.similarity > 0.3)
        .sort((a: RelatedMarket, b: RelatedMarket) => b.similarity - a.similarity)
        .slice(0, 10);

      setRelatedMarkets(related);
    } catch (e) {
      console.error('Failed to fetch related markets:', e);
    }
  };

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  // Create alert
  const createAlert = (type: AlertType, threshold: number) => {
    if (!market) return;

    const alertsManager = getAlertsManager();
    alertsManager.createAlert({
      marketId: market.id,
      platform: market.platform,
      marketTitle: market.title,
      type,
      threshold,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-destructive">{error || 'Market not found'}</p>
          <Button onClick={() => router.push('/prediction-markets')}>
            Back to Markets
          </Button>
        </div>
      </div>
    );
  }

  const priceChange = candleData.length > 1
    ? candleData[candleData.length - 1].close - candleData[0].open
    : 0;
  const priceChangePercent = candleData.length > 1 && candleData[0].open > 0
    ? (priceChange / candleData[0].open) * 100
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/prediction-markets" className="text-muted-foreground hover:text-foreground">
            Markets
          </Link>
          <span className="text-muted-foreground">/</span>
          <Badge
            variant="outline"
            style={{
              borderColor: PLATFORM_COLORS[platform],
              color: PLATFORM_COLORS[platform],
            }}
          >
            {PLATFORM_LABELS[platform] || platform}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold">{market.title}</h1>
        {market.description && (
          <p className="text-muted-foreground mt-2">{market.description}</p>
        )}
      </div>

      {/* Price Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">YES Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">
              {(market.yesPrice * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">NO Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {(market.noPrice * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">24h Change</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${priceChange >= 0 ? 'text-success' : 'text-destructive'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">24h Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatVolume(market.volume24h)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Liquidity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatVolume(market.liquidity)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Alert Buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => createAlert('price_above', market.yesPrice + 0.1)}
        >
          Alert if above {((market.yesPrice + 0.1) * 100).toFixed(0)}%
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => createAlert('price_below', market.yesPrice - 0.1)}
        >
          Alert if below {((market.yesPrice - 0.1) * 100).toFixed(0)}%
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => createAlert('volume_spike', market.volume24h * 2)}
        >
          Alert on volume spike
        </Button>
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Price Chart</TabsTrigger>
          <TabsTrigger value="depth">Order Book</TabsTrigger>
          <TabsTrigger value="related">Related Markets</TabsTrigger>
          <TabsTrigger value="correlation">Correlation</TabsTrigger>
        </TabsList>

        {/* Price Chart Tab */}
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Price History</CardTitle>
                <div className="flex gap-2">
                  {(['1h', '4h', '1d', '7d'] as const).map((tf) => (
                    <Button
                      key={tf}
                      variant={timeframe === tf ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <CandlestickChart data={candleData} />
              </div>
            </CardContent>
          </Card>

          {/* Volume Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candleData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis tickFormatter={(v) => formatVolume(v)} className="text-xs" />
                    <Tooltip formatter={(value: number) => formatVolume(value)} />
                    <Bar dataKey="volume" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Book Tab */}
        <TabsContent value="depth" className="space-y-4">
          {orderBook && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Market Depth</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Spread: {orderBook.spread.toFixed(2)}% | Mid: {orderBook.midPrice.toFixed(1)}%
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <DepthChart orderBook={orderBook} />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                {/* Bids */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-success">Bids (Buy YES)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium">
                        <span>Price</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Total</span>
                      </div>
                      {orderBook.bids.slice(0, 10).map((level, i) => (
                        <div key={i} className="grid grid-cols-3 text-sm">
                          <span className="text-success">{level.price.toFixed(1)}%</span>
                          <span className="text-right">{formatVolume(level.quantity)}</span>
                          <span className="text-right text-muted-foreground">
                            {formatVolume(level.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Asks */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-destructive">Asks (Sell YES)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium">
                        <span>Price</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Total</span>
                      </div>
                      {orderBook.asks.slice(0, 10).map((level, i) => (
                        <div key={i} className="grid grid-cols-3 text-sm">
                          <span className="text-destructive">{level.price.toFixed(1)}%</span>
                          <span className="text-right">{formatVolume(level.quantity)}</span>
                          <span className="text-right text-muted-foreground">
                            {formatVolume(level.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Related Markets Tab */}
        <TabsContent value="related" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Related Markets</CardTitle>
              <p className="text-sm text-muted-foreground">
                Similar markets across all platforms
              </p>
            </CardHeader>
            <CardContent>
              {relatedMarkets.length > 0 ? (
                <div className="space-y-3">
                  {relatedMarkets.map((related) => (
                    <Link
                      key={`${related.platform}-${related.id}`}
                      href={`/prediction-markets/${related.platform}/${related.id}`}
                      className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: PLATFORM_COLORS[related.platform],
                                color: PLATFORM_COLORS[related.platform],
                              }}
                            >
                              {PLATFORM_LABELS[related.platform]}
                            </Badge>
                            <Badge variant="secondary">
                              {(related.similarity * 100).toFixed(0)}% similar
                            </Badge>
                          </div>
                          <p className="font-medium line-clamp-1">{related.title}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-success">
                            {(related.yesPrice * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatVolume(related.volume24h)} vol
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No related markets found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Correlation Tab */}
        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Platform Correlation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Price comparison with the same market on other platforms
              </p>
            </CardHeader>
            <CardContent>
              {relatedMarkets.filter(r => r.similarity > 0.7).length > 0 ? (
                <div className="space-y-4">
                  {/* Current market */}
                  <div className="p-4 border-2 rounded-lg border-primary">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge style={{ backgroundColor: PLATFORM_COLORS[market.platform] }}>
                          {PLATFORM_LABELS[market.platform]}
                        </Badge>
                        <span className="text-sm">Current Market</span>
                      </div>
                      <p className="text-2xl font-bold text-success">
                        {(market.yesPrice * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Correlated markets */}
                  {relatedMarkets
                    .filter(r => r.similarity > 0.7)
                    .map((related) => {
                      const priceDiff = related.yesPrice - market.yesPrice;
                      const arbOpportunity = Math.abs(priceDiff) > 0.05;

                      return (
                        <div
                          key={`${related.platform}-${related.id}`}
                          className={`p-4 border rounded-lg ${
                            arbOpportunity ? 'border-warning bg-warning/5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: PLATFORM_COLORS[related.platform],
                                  color: PLATFORM_COLORS[related.platform],
                                }}
                              >
                                {PLATFORM_LABELS[related.platform]}
                              </Badge>
                              {arbOpportunity && (
                                <Badge variant="destructive">
                                  {priceDiff > 0 ? 'Sell' : 'Buy'} opportunity
                                </Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-success">
                                {(related.yesPrice * 100).toFixed(1)}%
                              </p>
                              <p className={`text-sm ${priceDiff >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {priceDiff >= 0 ? '+' : ''}{(priceDiff * 100).toFixed(1)}% vs {PLATFORM_LABELS[market.platform]}
                              </p>
                            </div>
                          </div>
                          {arbOpportunity && (
                            <p className="text-sm text-warning mt-2">
                              Potential arbitrage: Buy on {priceDiff > 0 ? PLATFORM_LABELS[market.platform] : PLATFORM_LABELS[related.platform]},
                              Sell on {priceDiff > 0 ? PLATFORM_LABELS[related.platform] : PLATFORM_LABELS[market.platform]}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No highly correlated markets found on other platforms</p>
                  <p className="text-sm mt-2">
                    Try searching for this market on other platforms manually
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Market Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Market Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Platform</p>
              <p className="font-medium">{PLATFORM_LABELS[market.platform]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ticker</p>
              <p className="font-medium font-mono">{market.ticker}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="font-medium">{market.category || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Close Time</p>
              <p className="font-medium">
                {market.closeTime
                  ? new Date(market.closeTime).toLocaleDateString()
                  : 'No expiry'
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={market.resolved ? 'secondary' : 'default'}>
                {market.resolved ? `Resolved: ${market.outcome?.toUpperCase()}` : 'Active'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">{formatDate(market.lastUpdated)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions

function generateCandleData(
  priceHistory: Array<{ timestamp: number; yesPrice: number }>,
  timeframe: '1h' | '4h' | '1d' | '7d'
): CandleData[] {
  if (priceHistory.length === 0) return [];

  const intervals: Record<string, number> = {
    '1h': 5 * 60 * 1000,     // 5 min candles
    '4h': 15 * 60 * 1000,    // 15 min candles
    '1d': 60 * 60 * 1000,    // 1 hour candles
    '7d': 4 * 60 * 60 * 1000, // 4 hour candles
  };

  const interval = intervals[timeframe];
  const candles: Map<number, { prices: number[]; volume: number }> = new Map();

  // Group prices into candle buckets
  priceHistory.forEach((point) => {
    const bucket = Math.floor(point.timestamp / interval) * interval;
    if (!candles.has(bucket)) {
      candles.set(bucket, { prices: [], volume: 0 });
    }
    candles.get(bucket)!.prices.push(point.yesPrice * 100);
    candles.get(bucket)!.volume += Math.random() * 10000; // Simulated volume
  });

  // Convert to OHLC
  const result: CandleData[] = [];
  const sortedBuckets = Array.from(candles.keys()).sort();

  sortedBuckets.forEach((bucket) => {
    const data = candles.get(bucket)!;
    if (data.prices.length === 0) return;

    result.push({
      time: formatDate(bucket),
      timestamp: bucket,
      open: data.prices[0],
      high: Math.max(...data.prices),
      low: Math.min(...data.prices),
      close: data.prices[data.prices.length - 1],
      volume: data.volume,
    });
  });

  // If not enough real data, generate simulated candles
  if (result.length < 10) {
    const now = Date.now();
    const basePrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].yesPrice * 100 : 50;

    for (let i = 0; i < 24; i++) {
      const timestamp = now - (24 - i) * interval;
      const volatility = 2;
      const open = basePrice + (Math.random() - 0.5) * volatility * 2;
      const close = open + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;

      result.push({
        time: formatDate(timestamp),
        timestamp,
        open: Math.max(0, Math.min(100, open)),
        high: Math.max(0, Math.min(100, high)),
        low: Math.max(0, Math.min(100, low)),
        close: Math.max(0, Math.min(100, close)),
        volume: Math.random() * 50000,
      });
    }
  }

  return result.slice(-48); // Keep last 48 candles
}

function generateOrderBook(yesPrice: number, liquidity: number): OrderBook {
  const midPrice = yesPrice * 100;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let bidTotal = 0;
  let askTotal = 0;

  // Generate bid levels (below mid price)
  for (let i = 0; i < 15; i++) {
    const price = midPrice - 0.5 - i * 0.5;
    if (price <= 0) break;

    const quantity = (liquidity / 30) * (1 + Math.random());
    bidTotal += quantity;

    bids.push({
      price,
      quantity,
      total: bidTotal,
    });
  }

  // Generate ask levels (above mid price)
  for (let i = 0; i < 15; i++) {
    const price = midPrice + 0.5 + i * 0.5;
    if (price >= 100) break;

    const quantity = (liquidity / 30) * (1 + Math.random());
    askTotal += quantity;

    asks.push({
      price,
      quantity,
      total: askTotal,
    });
  }

  const spread = asks.length > 0 && bids.length > 0
    ? asks[0].price - bids[0].price
    : 1;

  return { bids, asks, spread, midPrice };
}

function calculateSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
