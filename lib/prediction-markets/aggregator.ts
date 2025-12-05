/**
 * Prediction Markets Real-Time Aggregator
 *
 * Collects live metrics from multiple prediction market platforms:
 * - Kalshi (CFTC-regulated, US)
 * - Polymarket (Crypto-native, global)
 * - Manifold Markets (Play money, global)
 * - dFlow/Drift Markets (On-chain)
 *
 * Features:
 * - Real-time price updates
 * - Historical data collection
 * - Platform comparison
 * - Arbitrage detection
 * - Volume/liquidity tracking
 */

export type Platform = 'kalshi' | 'polymarket' | 'manifold' | 'drift';

export interface MarketPrice {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
}

export interface Market {
  id: string;
  platform: Platform;
  ticker: string;
  title: string;
  description?: string;
  category?: string;
  currentPrice: MarketPrice;
  priceHistory: MarketPrice[];
  closeTime?: Date;
  resolved: boolean;
  outcome?: 'yes' | 'no';
  lastUpdated: number;
}

export interface PlatformMetrics {
  platform: Platform;
  totalMarkets: number;
  activeMarkets: number;
  totalVolume24h: number;
  totalLiquidity: number;
  avgSpread: number;
  topMarkets: Market[];
  lastUpdated: number;
}

export interface AggregatedMetrics {
  timestamp: number;
  platforms: PlatformMetrics[];
  crossPlatformMarkets: CrossPlatformMarket[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  volumeChart: VolumeDataPoint[];
  trendingTopics: TrendingTopic[];
}

export interface CrossPlatformMarket {
  title: string;
  normalizedTitle: string;
  markets: {
    platform: Platform;
    marketId: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
  }[];
  priceDivergence: number;
  hasArbitrage: boolean;
}

export interface ArbitrageOpportunity {
  marketTitle: string;
  buyPlatform: Platform;
  buyPrice: number;
  sellPlatform: Platform;
  sellPrice: number;
  spread: number;
  expectedProfit: number;
}

export interface VolumeDataPoint {
  timestamp: number;
  kalshi: number;
  polymarket: number;
  manifold: number;
  drift: number;
  total: number;
}

export interface TrendingTopic {
  topic: string;
  marketCount: number;
  totalVolume: number;
  avgProbability: number;
  priceChange24h: number;
}

// Platform API Clients
class KalshiClient {
  private baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';
  private timeout = 15000;

  async fetchMarkets(limit = 100): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets?status=open&limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );

      if (!response.ok) {
        console.error('[Kalshi] API error:', response.status);
        return [];
      }

      const data = await response.json();
      const now = Date.now();

      return (data.markets || []).map((m: Record<string, unknown>) => ({
        id: m.ticker as string,
        platform: 'kalshi' as Platform,
        ticker: m.ticker as string,
        title: m.title as string,
        description: m.subtitle as string,
        category: m.category as string,
        currentPrice: {
          timestamp: now,
          yesPrice: ((m.yes_bid as number) || 50) / 100,
          noPrice: ((m.no_bid as number) || 50) / 100,
          volume24h: (m.volume_24h as number) || 0,
          liquidity: (m.liquidity as number) || 0,
        },
        priceHistory: [],
        closeTime: m.close_time ? new Date(m.close_time as string) : undefined,
        resolved: (m.result as string) !== '',
        outcome: m.result === 'yes' ? 'yes' : m.result === 'no' ? 'no' : undefined,
        lastUpdated: now,
      }));
    } catch (e) {
      console.error('[Kalshi] Fetch error:', e);
      return [];
    }
  }
}

class PolymarketClient {
  private gammaUrl = 'https://gamma-api.polymarket.com';
  private timeout = 15000;

  async fetchMarkets(limit = 100): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.gammaUrl}/markets?closed=false&limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );

      if (!response.ok) {
        console.error('[Polymarket] API error:', response.status);
        return [];
      }

      const data = await response.json();
      const now = Date.now();

      return (data || []).slice(0, limit).map((m: Record<string, unknown>) => ({
        id: (m.conditionId || m.id) as string,
        platform: 'polymarket' as Platform,
        ticker: (m.conditionId || m.id) as string,
        title: (m.question || m.title) as string,
        description: m.description as string,
        category: m.category as string,
        currentPrice: {
          timestamp: now,
          yesPrice: parseFloat(((m.outcomePrices as string[])?.[0]) || '0.5'),
          noPrice: parseFloat(((m.outcomePrices as string[])?.[1]) || '0.5'),
          volume24h: parseFloat((m.volume24hr as string) || '0'),
          liquidity: parseFloat((m.liquidity as string) || '0'),
        },
        priceHistory: [],
        closeTime: m.endDate ? new Date(m.endDate as string) : undefined,
        resolved: (m.closed as boolean) || false,
        outcome: undefined,
        lastUpdated: now,
      }));
    } catch (e) {
      console.error('[Polymarket] Fetch error:', e);
      return [];
    }
  }
}

class ManifoldClient {
  private baseUrl = 'https://api.manifold.markets/v0';
  private timeout = 15000;

  async fetchMarkets(limit = 100): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets?limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );

      if (!response.ok) {
        console.error('[Manifold] API error:', response.status);
        return [];
      }

      const data = await response.json();
      const now = Date.now();

      return (data || [])
        .filter((m: Record<string, unknown>) => m.outcomeType === 'BINARY')
        .slice(0, limit)
        .map((m: Record<string, unknown>) => ({
          id: m.id as string,
          platform: 'manifold' as Platform,
          ticker: m.id as string,
          title: m.question as string,
          description: m.description as string,
          category: (m.groupSlugs as string[])?.[0],
          currentPrice: {
            timestamp: now,
            yesPrice: (m.probability as number) || 0.5,
            noPrice: 1 - ((m.probability as number) || 0.5),
            volume24h: (m.volume24Hours as number) || 0,
            liquidity: (m.totalLiquidity as number) || 0,
          },
          priceHistory: [],
          closeTime: m.closeTime ? new Date(m.closeTime as number) : undefined,
          resolved: (m.isResolved as boolean) || false,
          outcome: m.resolution === 'YES' ? 'yes' : m.resolution === 'NO' ? 'no' : undefined,
          lastUpdated: now,
        }));
    } catch (e) {
      console.error('[Manifold] Fetch error:', e);
      return [];
    }
  }
}

class DriftClient {
  private baseUrl = 'https://prediction-markets-api.dflow.net/api/v1';
  private timeout = 15000;

  async fetchMarkets(limit = 100): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/events?limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );

      if (!response.ok) {
        console.error('[Drift] API error:', response.status);
        return [];
      }

      const data = await response.json();
      const now = Date.now();

      return (data.events || []).slice(0, limit).map((m: Record<string, unknown>) => ({
        id: m.ticker as string,
        platform: 'drift' as Platform,
        ticker: m.ticker as string,
        title: m.title as string,
        description: m.description as string,
        category: m.category as string,
        currentPrice: {
          timestamp: now,
          yesPrice: (m.yesPrice as number) || 0.5,
          noPrice: (m.noPrice as number) || 0.5,
          volume24h: (m.volume24h as number) || 0,
          liquidity: (m.liquidity as number) || 0,
        },
        priceHistory: [],
        resolved: (m.resolved as boolean) || false,
        outcome: undefined,
        lastUpdated: now,
      }));
    } catch (e) {
      console.error('[Drift] Fetch error:', e);
      return [];
    }
  }
}

// Singleton Aggregator
export class PredictionMarketsAggregator {
  private clients: {
    kalshi: KalshiClient;
    polymarket: PolymarketClient;
    manifold: ManifoldClient;
    drift: DriftClient;
  };

  private cache: {
    markets: Map<string, Market>;
    metrics: AggregatedMetrics | null;
    volumeHistory: VolumeDataPoint[];
    lastFetch: number;
  };

  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(metrics: AggregatedMetrics) => void> = new Set();

  constructor() {
    this.clients = {
      kalshi: new KalshiClient(),
      polymarket: new PolymarketClient(),
      manifold: new ManifoldClient(),
      drift: new DriftClient(),
    };

    this.cache = {
      markets: new Map(),
      metrics: null,
      volumeHistory: [],
      lastFetch: 0,
    };
  }

  // Fetch all markets from all platforms
  async fetchAllMarkets(): Promise<Market[]> {
    const results = await Promise.allSettled([
      this.clients.kalshi.fetchMarkets(100),
      this.clients.polymarket.fetchMarkets(100),
      this.clients.manifold.fetchMarkets(100),
      this.clients.drift.fetchMarkets(50),
    ]);

    const allMarkets: Market[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allMarkets.push(...result.value);
      } else {
        const platforms = ['kalshi', 'polymarket', 'manifold', 'drift'];
        console.error(`[Aggregator] Failed to fetch ${platforms[index]}:`, result.reason);
      }
    });

    // Update cache
    allMarkets.forEach(market => {
      const key = `${market.platform}:${market.id}`;
      const existing = this.cache.markets.get(key);

      if (existing) {
        // Preserve price history
        market.priceHistory = [
          ...existing.priceHistory.slice(-288), // Keep last 24h (5min intervals)
          market.currentPrice,
        ];
      }

      this.cache.markets.set(key, market);
    });

    this.cache.lastFetch = Date.now();
    return allMarkets;
  }

  // Calculate platform metrics
  private calculatePlatformMetrics(markets: Market[], platform: Platform): PlatformMetrics {
    const platformMarkets = markets.filter(m => m.platform === platform);
    const activeMarkets = platformMarkets.filter(m => !m.resolved);

    const totalVolume24h = platformMarkets.reduce(
      (sum, m) => sum + m.currentPrice.volume24h,
      0
    );

    const totalLiquidity = platformMarkets.reduce(
      (sum, m) => sum + m.currentPrice.liquidity,
      0
    );

    const spreads = platformMarkets.map(m =>
      Math.abs(m.currentPrice.yesPrice - (1 - m.currentPrice.noPrice))
    );
    const avgSpread = spreads.length > 0
      ? spreads.reduce((a, b) => a + b, 0) / spreads.length
      : 0;

    // Top markets by volume
    const topMarkets = [...activeMarkets]
      .sort((a, b) => b.currentPrice.volume24h - a.currentPrice.volume24h)
      .slice(0, 10);

    return {
      platform,
      totalMarkets: platformMarkets.length,
      activeMarkets: activeMarkets.length,
      totalVolume24h,
      totalLiquidity,
      avgSpread,
      topMarkets,
      lastUpdated: Date.now(),
    };
  }

  // Find cross-platform markets
  private findCrossPlatformMarkets(markets: Market[]): CrossPlatformMarket[] {
    const normalized = new Map<string, Market[]>();

    // Normalize titles for matching
    markets.forEach(market => {
      const normalizedTitle = this.normalizeTitle(market.title);
      if (!normalized.has(normalizedTitle)) {
        normalized.set(normalizedTitle, []);
      }
      normalized.get(normalizedTitle)!.push(market);
    });

    // Find markets that exist on multiple platforms
    const crossPlatform: CrossPlatformMarket[] = [];

    normalized.forEach((platformMarkets, normalizedTitle) => {
      if (platformMarkets.length < 2) return;

      // Check if markets are on different platforms
      const platforms = new Set(platformMarkets.map(m => m.platform));
      if (platforms.size < 2) return;

      const prices = platformMarkets.map(m => m.currentPrice.yesPrice);
      const priceDivergence = Math.max(...prices) - Math.min(...prices);

      crossPlatform.push({
        title: platformMarkets[0].title,
        normalizedTitle,
        markets: platformMarkets.map(m => ({
          platform: m.platform,
          marketId: m.id,
          yesPrice: m.currentPrice.yesPrice,
          noPrice: m.currentPrice.noPrice,
          volume24h: m.currentPrice.volume24h,
        })),
        priceDivergence,
        hasArbitrage: priceDivergence > 0.05, // 5% spread
      });
    });

    return crossPlatform.sort((a, b) => b.priceDivergence - a.priceDivergence);
  }

  // Find arbitrage opportunities
  private findArbitrageOpportunities(crossPlatform: CrossPlatformMarket[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    crossPlatform.forEach(cp => {
      if (!cp.hasArbitrage) return;

      // Sort by YES price
      const sorted = [...cp.markets].sort((a, b) => a.yesPrice - b.yesPrice);
      const cheapest = sorted[0];
      const mostExpensive = sorted[sorted.length - 1];

      const spread = mostExpensive.yesPrice - cheapest.yesPrice;
      // Expected profit assuming ~2% fees on each platform
      const expectedProfit = (spread - 0.04) * 100; // As percentage

      if (expectedProfit > 0) {
        opportunities.push({
          marketTitle: cp.title,
          buyPlatform: cheapest.platform,
          buyPrice: cheapest.yesPrice,
          sellPlatform: mostExpensive.platform,
          sellPrice: mostExpensive.yesPrice,
          spread,
          expectedProfit,
        });
      }
    });

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }

  // Normalize title for matching
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  }

  // Extract trending topics
  private extractTrendingTopics(markets: Market[]): TrendingTopic[] {
    const topics = new Map<string, { markets: Market[] }>();

    // Extract keywords from titles
    const keywords = [
      'trump', 'biden', 'election', 'crypto', 'bitcoin', 'eth',
      'fed', 'interest rate', 'inflation', 'recession',
      'ai', 'openai', 'chatgpt', 'google', 'apple', 'microsoft',
      'ukraine', 'russia', 'china', 'taiwan',
      'climate', 'weather', 'hurricane',
      'super bowl', 'nfl', 'nba', 'world cup',
    ];

    markets.forEach(market => {
      const titleLower = market.title.toLowerCase();
      keywords.forEach(keyword => {
        if (titleLower.includes(keyword)) {
          if (!topics.has(keyword)) {
            topics.set(keyword, { markets: [] });
          }
          topics.get(keyword)!.markets.push(market);
        }
      });
    });

    const trending: TrendingTopic[] = [];

    topics.forEach((data, topic) => {
      if (data.markets.length < 2) return;

      const totalVolume = data.markets.reduce(
        (sum, m) => sum + m.currentPrice.volume24h,
        0
      );

      const avgProbability = data.markets.reduce(
        (sum, m) => sum + m.currentPrice.yesPrice,
        0
      ) / data.markets.length;

      // Calculate price change (would need historical data)
      const priceChange24h = 0; // Placeholder

      trending.push({
        topic: topic.charAt(0).toUpperCase() + topic.slice(1),
        marketCount: data.markets.length,
        totalVolume,
        avgProbability,
        priceChange24h,
      });
    });

    return trending
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 20);
  }

  // Aggregate all metrics
  async aggregateMetrics(): Promise<AggregatedMetrics> {
    const markets = await this.fetchAllMarkets();
    const now = Date.now();

    const platforms: PlatformMetrics[] = [
      this.calculatePlatformMetrics(markets, 'kalshi'),
      this.calculatePlatformMetrics(markets, 'polymarket'),
      this.calculatePlatformMetrics(markets, 'manifold'),
      this.calculatePlatformMetrics(markets, 'drift'),
    ];

    const crossPlatformMarkets = this.findCrossPlatformMarkets(markets);
    const arbitrageOpportunities = this.findArbitrageOpportunities(crossPlatformMarkets);

    // Record volume data point
    const volumePoint: VolumeDataPoint = {
      timestamp: now,
      kalshi: platforms.find(p => p.platform === 'kalshi')?.totalVolume24h || 0,
      polymarket: platforms.find(p => p.platform === 'polymarket')?.totalVolume24h || 0,
      manifold: platforms.find(p => p.platform === 'manifold')?.totalVolume24h || 0,
      drift: platforms.find(p => p.platform === 'drift')?.totalVolume24h || 0,
      total: platforms.reduce((sum, p) => sum + p.totalVolume24h, 0),
    };

    this.cache.volumeHistory.push(volumePoint);
    // Keep last 7 days (5 min intervals = 2016 points)
    if (this.cache.volumeHistory.length > 2016) {
      this.cache.volumeHistory = this.cache.volumeHistory.slice(-2016);
    }

    const trendingTopics = this.extractTrendingTopics(markets);

    const metrics: AggregatedMetrics = {
      timestamp: now,
      platforms,
      crossPlatformMarkets: crossPlatformMarkets.slice(0, 50),
      arbitrageOpportunities: arbitrageOpportunities.slice(0, 20),
      volumeChart: this.cache.volumeHistory,
      trendingTopics,
    };

    this.cache.metrics = metrics;

    // Notify listeners
    this.listeners.forEach(listener => listener(metrics));

    return metrics;
  }

  // Get cached metrics
  getMetrics(): AggregatedMetrics | null {
    return this.cache.metrics;
  }

  // Get markets by platform
  getMarketsByPlatform(platform: Platform): Market[] {
    return Array.from(this.cache.markets.values())
      .filter(m => m.platform === platform);
  }

  // Search markets
  searchMarkets(query: string): Market[] {
    const q = query.toLowerCase();
    return Array.from(this.cache.markets.values())
      .filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }

  // Get market by ID
  getMarket(platform: Platform, marketId: string): Market | null {
    return this.cache.markets.get(`${platform}:${marketId}`) || null;
  }

  // Subscribe to updates
  subscribe(callback: (metrics: AggregatedMetrics) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Start auto-refresh
  startAutoRefresh(intervalMs = 60000): void {
    if (this.updateInterval) return;

    console.log('[Aggregator] Starting auto-refresh every', intervalMs / 1000, 'seconds');

    // Initial fetch
    this.aggregateMetrics().catch(console.error);

    this.updateInterval = setInterval(() => {
      this.aggregateMetrics().catch(console.error);
    }, intervalMs);
  }

  // Stop auto-refresh
  stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('[Aggregator] Auto-refresh stopped');
    }
  }
}

// Singleton instance
let aggregatorInstance: PredictionMarketsAggregator | null = null;

export function getAggregator(): PredictionMarketsAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new PredictionMarketsAggregator();
  }
  return aggregatorInstance;
}

export default {
  PredictionMarketsAggregator,
  getAggregator,
};
