'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { getAlertsManager, PriceAlert, AlertType } from '@/lib/prediction-markets/alerts';

interface PlatformMetrics {
  platform: string;
  totalMarkets: number;
  activeMarkets: number;
  totalVolume24h: number;
  totalLiquidity: number;
  avgSpread: number;
  lastUpdated: number;
}

interface Market {
  id: string;
  platform: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  priceHistory: { timestamp: number; yesPrice: number }[];
}

interface ArbitrageOpportunity {
  marketTitle: string;
  buyPlatform: string;
  buyPricePercent: string;
  sellPlatform: string;
  sellPricePercent: string;
  spreadPercent: string;
  expectedProfitDisplay: string;
}

interface TrendingTopic {
  topic: string;
  marketCount: number;
  totalVolume: number;
  avgProbability: number;
}

interface CorrelatedPair {
  market1: { platform: string; title: string; yesPrice: number };
  market2: { platform: string; title: string; yesPrice: number };
  priceDivergence: number;
  hasArbitrage: boolean;
  arbitrageDirection?: string;
}

interface CorrelationCluster {
  topic: string;
  markets: Array<{ platform: string; title: string; yesPrice: number }>;
  avgPrice: number;
  priceRange: number;
  arbitrageOpportunities: number;
}

interface VolumeDataPoint {
  timestamp: number;
  kalshi: number;
  polymarket: number;
  manifold: number;
  drift: number;
  total: number;
}

interface Metrics {
  timestamp: number;
  platforms: PlatformMetrics[];
  summary: {
    totalMarkets: number;
    totalVolume24h: number;
    totalLiquidity: number;
    crossPlatformMarkets: number;
    arbitrageOpportunities: number;
  };
  trendingTopics: TrendingTopic[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  volumeChart: VolumeDataPoint[];
}

const PLATFORM_COLORS = {
  kalshi: '#2563eb',
  polymarket: '#7c3aed',
  manifold: '#10b981',
  drift: '#f59e0b',
};

const PLATFORM_LABELS = {
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
    minute: '2-digit'
  });
}

// Alert Creation Modal Component
function AlertModal({
  market,
  onClose,
  onCreateAlert,
}: {
  market: Market;
  onClose: () => void;
  onCreateAlert: (type: AlertType, threshold: number) => void;
}) {
  const [alertType, setAlertType] = useState<AlertType>('price_above');
  const [threshold, setThreshold] = useState(market.yesPrice * 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Create Price Alert</CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">{market.title}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Alert Type</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={alertType === 'price_above' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAlertType('price_above')}
              >
                Price Above
              </Button>
              <Button
                variant={alertType === 'price_below' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAlertType('price_below')}
              >
                Price Below
              </Button>
              <Button
                variant={alertType === 'volume_spike' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAlertType('volume_spike')}
              >
                Volume Spike
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              {alertType === 'volume_spike' ? 'Volume Threshold ($)' : 'Price Threshold (%)'}
            </label>
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              min={alertType === 'volume_spike' ? 0 : 0}
              max={alertType === 'volume_spike' ? undefined : 100}
              step={alertType === 'volume_spike' ? 1000 : 1}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Current: {alertType === 'volume_spike'
                ? formatVolume(market.volume24h)
                : `${(market.yesPrice * 100).toFixed(1)}%`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => {
                onCreateAlert(
                  alertType,
                  alertType === 'volume_spike' ? threshold : threshold / 100
                );
                onClose();
              }}
              className="flex-1"
            >
              Create Alert
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Correlation Analysis Component
function CorrelationAnalysis() {
  const [correlationData, setCorrelationData] = useState<{
    correlatedPairs: CorrelatedPair[];
    clusters: CorrelationCluster[];
    summary: { totalCorrelatedPairs: number; arbitrageOpportunities: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCorrelation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/prediction-markets/correlation');
      if (response.ok) {
        const data = await response.json();
        setCorrelationData(data);
      }
    } catch (e) {
      console.error('Failed to fetch correlation data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorrelation();
  }, [fetchCorrelation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Correlated Pairs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{correlationData?.summary?.totalCorrelatedPairs || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Arbitrage Opps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {correlationData?.summary?.arbitrageOpportunities || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clusters */}
      <Card>
        <CardHeader>
          <CardTitle>Market Clusters</CardTitle>
          <p className="text-sm text-muted-foreground">
            Groups of related markets across platforms
          </p>
        </CardHeader>
        <CardContent>
          {correlationData?.clusters && correlationData.clusters.length > 0 ? (
            <div className="space-y-4">
              {correlationData.clusters.slice(0, 10).map((cluster, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{cluster.topic}</h4>
                    {cluster.arbitrageOpportunities > 0 && (
                      <Badge variant="destructive">
                        {cluster.arbitrageOpportunities} arbitrage opp{cluster.arbitrageOpportunities > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {cluster.markets.slice(0, 4).map((market, j) => (
                      <div key={j} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: PLATFORM_COLORS[market.platform as keyof typeof PLATFORM_COLORS],
                              color: PLATFORM_COLORS[market.platform as keyof typeof PLATFORM_COLORS],
                            }}
                          >
                            {PLATFORM_LABELS[market.platform as keyof typeof PLATFORM_LABELS]}
                          </Badge>
                          <span className="line-clamp-1 max-w-xs">{market.title}</span>
                        </div>
                        <span className="font-medium text-success">
                          {(market.yesPrice * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Price range: {(cluster.priceRange * 100).toFixed(1)}% | Avg: {(cluster.avgPrice * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No correlated market clusters detected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Correlated Pairs with Arbitrage */}
      <Card>
        <CardHeader>
          <CardTitle>Cross-Platform Price Divergence</CardTitle>
          <p className="text-sm text-muted-foreground">
            Same markets with different prices across platforms
          </p>
        </CardHeader>
        <CardContent>
          {correlationData?.correlatedPairs && correlationData.correlatedPairs.filter(p => p.hasArbitrage).length > 0 ? (
            <div className="space-y-3">
              {correlationData.correlatedPairs
                .filter(p => p.hasArbitrage)
                .slice(0, 10)
                .map((pair, i) => (
                  <div key={i} className="p-3 border rounded-lg bg-warning/5 border-warning">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: PLATFORM_COLORS[pair.market1.platform as keyof typeof PLATFORM_COLORS],
                            }}
                          >
                            {PLATFORM_LABELS[pair.market1.platform as keyof typeof PLATFORM_LABELS]}
                          </Badge>
                          <span className="font-medium text-success">
                            {(pair.market1.yesPrice * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm line-clamp-1">{pair.market1.title}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: PLATFORM_COLORS[pair.market2.platform as keyof typeof PLATFORM_COLORS],
                            }}
                          >
                            {PLATFORM_LABELS[pair.market2.platform as keyof typeof PLATFORM_LABELS]}
                          </Badge>
                          <span className="font-medium text-success">
                            {(pair.market2.yesPrice * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm line-clamp-1">{pair.market2.title}</p>
                      </div>
                    </div>
                    <p className="text-sm text-warning mt-2">
                      Divergence: {(pair.priceDivergence * 100).toFixed(1)}%
                      {pair.arbitrageDirection && ` - ${pair.arbitrageDirection}`}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No significant price divergence detected between platforms
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// AI Analysis Component
function AIAnalysis() {
  const [analysisType, setAnalysisType] = useState<'overview' | 'arbitrage' | 'trending'>('overview');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalysis = async (type: 'overview' | 'arbitrage' | 'trending') => {
    setLoading(true);
    try {
      const response = await fetch('/api/prediction-markets/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (e) {
      console.error('Failed to fetch analysis:', e);
      setAnalysis('Failed to generate analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Market Analysis</CardTitle>
        <p className="text-sm text-muted-foreground">
          Powered by LLM analysis of current market data
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {(['overview', 'arbitrage', 'trending'] as const).map((type) => (
            <Button
              key={type}
              variant={analysisType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAnalysisType(type);
                fetchAnalysis(type);
              }}
              disabled={loading}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : analysis ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap p-4 bg-muted rounded-lg">
              {analysis}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Select an analysis type to generate AI insights
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PredictionMarketsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertModalMarket, setAlertModalMarket] = useState<Market | null>(null);
  const alertsManagerRef = useRef<ReturnType<typeof getAlertsManager> | null>(null);

  // Initialize alerts manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      alertsManagerRef.current = getAlertsManager();
      setAlerts(alertsManagerRef.current.getAlerts());

      const unsubscribe = alertsManagerRef.current.subscribe((newAlerts) => {
        setAlerts(newAlerts);
      });

      // Request notification permission
      alertsManagerRef.current.requestNotificationPermission();

      return () => {
        unsubscribe();
      };
    }
  }, []);

  // Check alerts when markets update
  useEffect(() => {
    if (alertsManagerRef.current && markets.length > 0) {
      alertsManagerRef.current.checkAlerts(
        markets.map(m => ({
          id: m.id,
          platform: m.platform,
          yesPrice: m.yesPrice,
          volume24h: m.volume24h,
        }))
      );
    }
  }, [markets]);

  const createAlert = (market: Market, type: AlertType, threshold: number) => {
    if (alertsManagerRef.current) {
      alertsManagerRef.current.createAlert({
        marketId: market.id,
        platform: market.platform,
        marketTitle: market.title,
        type,
        threshold,
      });
    }
  };

  const deleteAlert = (alertId: string) => {
    if (alertsManagerRef.current) {
      alertsManagerRef.current.deleteAlert(alertId);
    }
  };

  const dismissAlert = (alertId: string) => {
    if (alertsManagerRef.current) {
      alertsManagerRef.current.dismissAlert(alertId);
    }
  };

  // Fetch initial metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/prediction-markets/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (e) {
      setError('Failed to load prediction market data');
      console.error(e);
    }
  }, []);

  // Fetch markets
  const fetchMarkets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedPlatform !== 'all') params.set('platform', selectedPlatform);
      params.set('limit', '50');

      const response = await fetch(`/api/prediction-markets/markets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch markets');
      const data = await response.json();
      setMarkets(data.markets);
    } catch (e) {
      console.error('Failed to fetch markets:', e);
    }
  }, [searchQuery, selectedPlatform]);

  // Start SSE streaming
  const startStreaming = useCallback(() => {
    if (eventSourceRef.current) return;

    const eventSource = new EventSource('/api/prediction-markets/stream');
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update' || data.type === 'metrics') {
          setMetrics(prev => ({
            ...prev,
            ...data.data,
            timestamp: data.data.timestamp,
          } as Metrics));
        }
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
      setTimeout(startStreaming, 5000);
    };

    setIsStreaming(true);
  }, []);

  // Stop SSE streaming
  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMetrics(), fetchMarkets()])
      .finally(() => setLoading(false));
  }, [fetchMetrics, fetchMarkets]);

  // Search/filter effect
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchMarkets();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedPlatform, fetchMarkets]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchMetrics}>Retry</Button>
      </div>
    );
  }

  // Prepare pie chart data
  const pieData = metrics?.platforms.map(p => ({
    name: PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] || p.platform,
    value: p.totalVolume24h,
    color: PLATFORM_COLORS[p.platform as keyof typeof PLATFORM_COLORS] || '#888',
  })) || [];

  // Prepare volume chart data
  const volumeChartData = metrics?.volumeChart?.slice(-24).map(v => ({
    time: formatTime(v.timestamp),
    Kalshi: v.kalshi,
    Polymarket: v.polymarket,
    Manifold: v.manifold,
    Drift: v.drift,
    Total: v.total,
  })) || [];

  // Count triggered alerts
  const triggeredAlerts = alerts.filter(a => a.status === 'triggered');
  const activeAlerts = alerts.filter(a => a.status === 'active');

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Alert Modal */}
      {alertModalMarket && (
        <AlertModal
          market={alertModalMarket}
          onClose={() => setAlertModalMarket(null)}
          onCreateAlert={(type, threshold) => createAlert(alertModalMarket, type, threshold)}
        />
      )}

      {/* Triggered Alerts Banner */}
      {triggeredAlerts.length > 0 && (
        <div className="mb-4 p-4 bg-warning/10 border border-warning rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-warning">
              {triggeredAlerts.length} Alert{triggeredAlerts.length > 1 ? 's' : ''} Triggered
            </h3>
          </div>
          <div className="space-y-2">
            {triggeredAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="flex items-center justify-between text-sm">
                <span className="line-clamp-1">{alert.marketTitle}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {alert.type === 'volume_spike'
                      ? formatVolume(alert.currentValue || 0)
                      : `${((alert.currentValue || 0) * 100).toFixed(1)}%`
                    }
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => dismissAlert(alert.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Prediction Markets Aggregator</h1>
          <p className="text-muted-foreground mt-1">
            Real-time metrics from Kalshi, Polymarket, Manifold, and Drift
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <Badge variant="secondary">{activeAlerts.length} Alerts</Badge>
          )}
          <Badge variant={isStreaming ? 'default' : 'secondary'}>
            {isStreaming ? 'Live' : 'Paused'}
          </Badge>
          <Button
            variant={isStreaming ? 'destructive' : 'default'}
            size="sm"
            onClick={() => isStreaming ? stopStreaming() : startStreaming()}
          >
            {isStreaming ? 'Stop' : 'Start'} Live
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Markets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.summary.totalMarkets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">24h Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatVolume(metrics?.summary.totalVolume24h || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cross-Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.summary.crossPlatformMarkets || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Arbitrage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {metrics?.summary.arbitrageOpportunities || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-info">
              {activeAlerts.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="correlation">Correlation</TabsTrigger>
          <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Volume Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatVolume(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Volume Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Trend (Last 4 Hours)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-xs" />
                      <YAxis tickFormatter={(v) => formatVolume(v)} className="text-xs" />
                      <Tooltip formatter={(value: number) => formatVolume(value)} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="Kalshi"
                        stackId="1"
                        stroke={PLATFORM_COLORS.kalshi}
                        fill={PLATFORM_COLORS.kalshi}
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="Polymarket"
                        stackId="1"
                        stroke={PLATFORM_COLORS.polymarket}
                        fill={PLATFORM_COLORS.polymarket}
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="Manifold"
                        stackId="1"
                        stroke={PLATFORM_COLORS.manifold}
                        fill={PLATFORM_COLORS.manifold}
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="Drift"
                        stackId="1"
                        stroke={PLATFORM_COLORS.drift}
                        fill={PLATFORM_COLORS.drift}
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics?.platforms.map((platform) => (
              <Card key={platform.platform}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: PLATFORM_COLORS[platform.platform as keyof typeof PLATFORM_COLORS]
                      }}
                    />
                    {PLATFORM_LABELS[platform.platform as keyof typeof PLATFORM_LABELS]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Markets</span>
                    <span className="font-medium">{platform.activeMarkets}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">24h Volume</span>
                    <span className="font-medium">{formatVolume(platform.totalVolume24h)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Liquidity</span>
                    <span className="font-medium">{formatVolume(platform.totalLiquidity)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Spread</span>
                    <span className="font-medium">{(platform.avgSpread * 100).toFixed(2)}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Markets Tab */}
        <TabsContent value="markets" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-96"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedPlatform === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform('all')}
              >
                All
              </Button>
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  variant={selectedPlatform === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPlatform(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {markets.map((market) => (
              <Card key={`${market.platform}-${market.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: PLATFORM_COLORS[market.platform as keyof typeof PLATFORM_COLORS],
                            color: PLATFORM_COLORS[market.platform as keyof typeof PLATFORM_COLORS],
                          }}
                        >
                          {PLATFORM_LABELS[market.platform as keyof typeof PLATFORM_LABELS]}
                        </Badge>
                        {alerts.some(a => a.marketId === market.id && a.status === 'active') && (
                          <Badge variant="secondary">Alert Set</Badge>
                        )}
                      </div>
                      <Link
                        href={`/prediction-markets/${market.platform}/${market.id}`}
                        className="font-medium line-clamp-2 hover:text-primary hover:underline"
                      >
                        {market.title}
                      </Link>
                    </div>
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                      <Link
                        href={`/prediction-markets/${market.platform}/${market.id}`}
                        className="text-right hover:opacity-80"
                      >
                        <p className="text-2xl font-bold text-success">
                          {(market.yesPrice * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">YES Price</p>
                      </Link>
                      <div className="text-right">
                        <p className="font-medium">{formatVolume(market.volume24h)}</p>
                        <p className="text-xs text-muted-foreground">24h Volume</p>
                      </div>
                      {market.priceHistory.length > 1 && (
                        <div className="w-24 h-12">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={market.priceHistory.map(p => ({
                              ...p,
                              yesPrice: p.yesPrice * 100,
                            }))}>
                              <Line
                                type="monotone"
                                dataKey="yesPrice"
                                stroke={PLATFORM_COLORS[market.platform as keyof typeof PLATFORM_COLORS]}
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Link href={`/prediction-markets/${market.platform}/${market.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAlertModalMarket(market)}
                        >
                          Alert
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Arbitrage Tab */}
        <TabsContent value="arbitrage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Platform Arbitrage Opportunities</CardTitle>
              <p className="text-sm text-muted-foreground">
                Markets with price discrepancies across platforms
              </p>
            </CardHeader>
            <CardContent>
              {metrics?.arbitrageOpportunities && metrics.arbitrageOpportunities.length > 0 ? (
                <div className="space-y-4">
                  {metrics.arbitrageOpportunities.map((opp, i) => (
                    <div
                      key={i}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <h4 className="font-medium mb-2 line-clamp-1">{opp.marketTitle}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Buy on</p>
                          <p className="font-medium">
                            {PLATFORM_LABELS[opp.buyPlatform as keyof typeof PLATFORM_LABELS]} @ {opp.buyPricePercent}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Sell on</p>
                          <p className="font-medium">
                            {PLATFORM_LABELS[opp.sellPlatform as keyof typeof PLATFORM_LABELS]} @ {opp.sellPricePercent}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Spread</p>
                          <p className="font-medium text-warning">{opp.spreadPercent}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expected Profit</p>
                          <p className="font-medium text-success">{opp.expectedProfitDisplay}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No significant arbitrage opportunities detected
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trending Topics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Most active topics across all platforms
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics?.trendingTopics.slice(0, 10).map(t => ({
                      topic: t.topic,
                      volume: t.totalVolume,
                      markets: t.marketCount,
                      probability: t.avgProbability * 100,
                    }))}
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => formatVolume(v)} />
                    <YAxis type="category" dataKey="topic" className="text-xs" />
                    <Tooltip formatter={(value: number, name: string) =>
                      name === 'volume' ? formatVolume(value) : value
                    } />
                    <Bar dataKey="volume" fill="#2563eb" name="Volume" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-4 mt-6">
                {metrics?.trendingTopics.slice(0, 10).map((topic, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-muted-foreground">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{topic.topic}</p>
                        <p className="text-sm text-muted-foreground">
                          {topic.marketCount} markets
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatVolume(topic.totalVolume)}</p>
                      <p className="text-sm text-muted-foreground">
                        Avg: {(topic.avgProbability * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price Alerts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Get notified when markets hit your price targets
              </p>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-lg ${
                        alert.status === 'triggered'
                          ? 'border-warning bg-warning/5'
                          : alert.status === 'dismissed'
                            ? 'opacity-50'
                            : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              alert.status === 'triggered' ? 'default' :
                              alert.status === 'active' ? 'secondary' : 'outline'
                            }>
                              {alert.status}
                            </Badge>
                            <Badge variant="outline">
                              {PLATFORM_LABELS[alert.platform as keyof typeof PLATFORM_LABELS]}
                            </Badge>
                          </div>
                          <p className="font-medium line-clamp-1">{alert.marketTitle}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.type === 'price_above' && `Price above ${(alert.threshold * 100).toFixed(1)}%`}
                            {alert.type === 'price_below' && `Price below ${(alert.threshold * 100).toFixed(1)}%`}
                            {alert.type === 'volume_spike' && `Volume above ${formatVolume(alert.threshold)}`}
                          </p>
                          {alert.status === 'triggered' && alert.currentValue && (
                            <p className="text-sm text-warning mt-1">
                              Triggered at: {alert.type === 'volume_spike'
                                ? formatVolume(alert.currentValue)
                                : `${(alert.currentValue * 100).toFixed(1)}%`
                              }
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAlert(alert.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No alerts set</p>
                  <p className="text-sm mt-2">
                    Go to the Markets tab and click &quot;Set Alert&quot; on any market
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Correlation Tab */}
        <TabsContent value="correlation" className="space-y-4">
          <CorrelationAnalysis />
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="ai" className="space-y-4">
          <AIAnalysis />
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      {metrics && (
        <p className="text-center text-sm text-muted-foreground mt-8">
          Last updated: {new Date(metrics.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
