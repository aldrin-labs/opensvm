#!/usr/bin/env bun
/**
 * Real-Time Prediction Markets WebSocket Streaming
 *
 * Provides live price feeds from:
 * - Kalshi (WebSocket API)
 * - Polymarket (CLOB WebSocket)
 * - Manifold (Polling with SSE simulation)
 *
 * Features:
 * - Unified price stream across all platforms
 * - Real-time arbitrage detection
 * - Alert triggering on price/volume conditions
 * - Reconnection with exponential backoff
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type Platform = 'kalshi' | 'polymarket' | 'manifold';

export interface PriceUpdate {
  platform: Platform;
  marketId: string;
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  volume24h: number;
  lastTradePrice?: number;
  lastTradeSize?: number;
  timestamp: number;
}

export interface TradeUpdate {
  platform: Platform;
  marketId: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
  takerSide: 'buy' | 'sell';
  timestamp: number;
}

export interface OrderBookUpdate {
  platform: Platform;
  marketId: string;
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  timestamp: number;
}

export interface ArbitrageSignal {
  marketQuery: string;
  platforms: {
    platform: Platform;
    marketId: string;
    yesPrice: number;
    noPrice: number;
  }[];
  spread: number;
  direction: 'buy_yes_sell_no' | 'buy_no_sell_yes';
  expectedProfit: number;
  timestamp: number;
}

export interface StreamConfig {
  /** Markets to subscribe to (tickers/IDs) */
  markets?: string[];
  /** Platforms to stream from */
  platforms?: Platform[];
  /** Enable arbitrage detection */
  detectArbitrage?: boolean;
  /** Arbitrage threshold (e.g., 0.03 = 3%) */
  arbitrageThreshold?: number;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
}

// ============================================================================
// Platform-Specific WebSocket Clients
// ============================================================================

/**
 * Kalshi WebSocket Client
 * Documentation: https://trading-api.readme.io/reference/websocket
 */
class KalshiWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private apiKey?: string) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Kalshi WebSocket endpoint
        this.ws = new WebSocket('wss://api.elections.kalshi.com/trade-api/ws/v2');

        this.ws.onopen = () => {
          console.log('[Kalshi WS] Connected');
          this.reconnectAttempts = 0;

          // Authenticate if API key provided
          if (this.apiKey) {
            this.ws?.send(JSON.stringify({
              type: 'auth',
              params: { api_key: this.apiKey },
            }));
          }

          // Resubscribe to markets
          for (const ticker of this.subscriptions) {
            this.subscribe(ticker);
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data.toString());
            this.handleMessage(data);
          } catch (e) {
            console.error('[Kalshi WS] Parse error:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Kalshi WS] Error:', error);
          this.emit('error', error);
        };

        this.ws.onclose = () => {
          console.log('[Kalshi WS] Disconnected');
          this.emit('disconnect');
          this.attemptReconnect();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'orderbook_snapshot':
      case 'orderbook_delta':
        this.emit('orderbook', this.parseOrderbook(data));
        break;

      case 'trade':
        this.emit('trade', this.parseTrade(data));
        break;

      case 'ticker':
        this.emit('price', this.parsePrice(data));
        break;

      case 'market_update':
        this.emit('price', this.parseMarketUpdate(data));
        break;
    }
  }

  private parsePrice(data: any): PriceUpdate {
    return {
      platform: 'kalshi',
      marketId: data.market_ticker || data.ticker,
      ticker: data.market_ticker || data.ticker,
      title: data.title || '',
      yesPrice: (data.yes_price || data.yes_bid || 50) / 100,
      noPrice: (data.no_price || data.no_bid || 50) / 100,
      yesBid: (data.yes_bid || 0) / 100,
      yesAsk: (data.yes_ask || 0) / 100,
      noBid: (data.no_bid || 0) / 100,
      noAsk: (data.no_ask || 0) / 100,
      volume24h: data.volume_24h || 0,
      lastTradePrice: data.last_price ? data.last_price / 100 : undefined,
      timestamp: Date.now(),
    };
  }

  private parseMarketUpdate(data: any): PriceUpdate {
    const market = data.market || data;
    return {
      platform: 'kalshi',
      marketId: market.ticker,
      ticker: market.ticker,
      title: market.title || '',
      yesPrice: (market.yes_bid || 50) / 100,
      noPrice: (market.no_bid || 50) / 100,
      yesBid: (market.yes_bid || 0) / 100,
      yesAsk: (market.yes_ask || 0) / 100,
      noBid: (market.no_bid || 0) / 100,
      noAsk: (market.no_ask || 0) / 100,
      volume24h: market.volume_24h || 0,
      timestamp: Date.now(),
    };
  }

  private parseOrderbook(data: any): OrderBookUpdate {
    return {
      platform: 'kalshi',
      marketId: data.market_ticker,
      bids: (data.yes || []).map((o: any) => ({ price: o.price / 100, size: o.quantity })),
      asks: (data.no || []).map((o: any) => ({ price: o.price / 100, size: o.quantity })),
      timestamp: Date.now(),
    };
  }

  private parseTrade(data: any): TradeUpdate {
    return {
      platform: 'kalshi',
      marketId: data.market_ticker,
      side: data.taker_side === 'yes' ? 'yes' : 'no',
      price: data.yes_price / 100,
      size: data.count,
      takerSide: data.taker_side === 'yes' ? 'buy' : 'sell',
      timestamp: new Date(data.created_time).getTime(),
    };
  }

  subscribe(ticker: string): void {
    this.subscriptions.add(ticker);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        params: {
          channels: ['orderbook_delta', 'trade', 'ticker'],
          market_tickers: [ticker],
        },
      }));
    }
  }

  unsubscribe(ticker: string): void {
    this.subscriptions.delete(ticker);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        params: {
          channels: ['orderbook_delta', 'trade', 'ticker'],
          market_tickers: [ticker],
        },
      }));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Kalshi WS] Max reconnect attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[Kalshi WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }
}

/**
 * Polymarket WebSocket Client (CLOB)
 * Uses the gamma-api for market data
 */
class PolymarketWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions = new Set<string>();
  private pollInterval: Timer | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    // Polymarket doesn't have a public WebSocket for market data
    // We'll poll the gamma API and emit events
    console.log('[Polymarket] Starting polling-based stream');

    this.pollInterval = setInterval(() => this.poll(), 5000);
    this.poll(); // Initial poll
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(
        'https://gamma-api.polymarket.com/markets?closed=false&limit=50',
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) return;

      const markets = await response.json();

      for (const m of markets || []) {
        const conditionId = m.conditionId || m.id;

        // Only emit for subscribed markets or all if no subscriptions
        if (this.subscriptions.size === 0 || this.subscriptions.has(conditionId)) {
          const price: PriceUpdate = {
            platform: 'polymarket',
            marketId: conditionId,
            ticker: conditionId,
            title: m.question || m.title || '',
            yesPrice: parseFloat(m.outcomePrices?.[0] || '0.5'),
            noPrice: parseFloat(m.outcomePrices?.[1] || '0.5'),
            yesBid: parseFloat(m.bestBid || m.outcomePrices?.[0] || '0.5'),
            yesAsk: parseFloat(m.bestAsk || m.outcomePrices?.[0] || '0.5'),
            noBid: parseFloat(m.outcomePrices?.[1] || '0.5'),
            noAsk: parseFloat(m.outcomePrices?.[1] || '0.5'),
            volume24h: parseFloat(m.volume24hr || '0'),
            timestamp: Date.now(),
          };

          this.emit('price', price);
        }
      }
    } catch (e) {
      console.error('[Polymarket] Poll error:', e);
    }
  }

  subscribe(conditionId: string): void {
    this.subscriptions.add(conditionId);
  }

  unsubscribe(conditionId: string): void {
    this.subscriptions.delete(conditionId);
  }

  disconnect(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[Polymarket] Disconnected');
  }
}

/**
 * Manifold Markets WebSocket Client
 * Uses polling since Manifold doesn't have WebSocket
 */
class ManifoldWebSocket extends EventEmitter {
  private pollInterval: Timer | null = null;
  private subscriptions = new Set<string>();

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    console.log('[Manifold] Starting polling-based stream');

    this.pollInterval = setInterval(() => this.poll(), 5000);
    this.poll();
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(
        'https://api.manifold.markets/v0/markets?limit=50',
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) return;

      const markets = await response.json();

      for (const m of markets || []) {
        if (m.outcomeType !== 'BINARY') continue;

        if (this.subscriptions.size === 0 || this.subscriptions.has(m.id)) {
          const price: PriceUpdate = {
            platform: 'manifold',
            marketId: m.id,
            ticker: m.id,
            title: m.question || '',
            yesPrice: m.probability || 0.5,
            noPrice: 1 - (m.probability || 0.5),
            yesBid: m.probability || 0.5,
            yesAsk: m.probability || 0.5,
            noBid: 1 - (m.probability || 0.5),
            noAsk: 1 - (m.probability || 0.5),
            volume24h: m.volume24Hours || 0,
            timestamp: Date.now(),
          };

          this.emit('price', price);
        }
      }
    } catch (e) {
      console.error('[Manifold] Poll error:', e);
    }
  }

  subscribe(marketId: string): void {
    this.subscriptions.add(marketId);
  }

  unsubscribe(marketId: string): void {
    this.subscriptions.delete(marketId);
  }

  disconnect(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[Manifold] Disconnected');
  }
}

// ============================================================================
// Unified Stream Manager
// ============================================================================

export class PredictionMarketsStream extends EventEmitter {
  private config: StreamConfig;
  private kalshi: KalshiWebSocket;
  private polymarket: PolymarketWebSocket;
  private manifold: ManifoldWebSocket;
  private priceCache = new Map<string, PriceUpdate>();
  private arbitrageCheckInterval: Timer | null = null;
  private isConnected = false;

  constructor(config: StreamConfig = {}) {
    super();
    this.config = {
      platforms: ['kalshi', 'polymarket', 'manifold'],
      detectArbitrage: true,
      arbitrageThreshold: 0.03,
      autoReconnect: true,
      maxReconnectAttempts: 5,
      ...config,
    };

    this.kalshi = new KalshiWebSocket();
    this.polymarket = new PolymarketWebSocket();
    this.manifold = new ManifoldWebSocket();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Kalshi events
    this.kalshi.on('price', (update: PriceUpdate) => {
      this.handlePriceUpdate(update);
    });
    this.kalshi.on('trade', (trade: TradeUpdate) => {
      this.emit('trade', trade);
    });
    this.kalshi.on('orderbook', (book: OrderBookUpdate) => {
      this.emit('orderbook', book);
    });

    // Polymarket events
    this.polymarket.on('price', (update: PriceUpdate) => {
      this.handlePriceUpdate(update);
    });

    // Manifold events
    this.manifold.on('price', (update: PriceUpdate) => {
      this.handlePriceUpdate(update);
    });
  }

  private handlePriceUpdate(update: PriceUpdate): void {
    // Cache the price
    const key = `${update.platform}:${update.marketId}`;
    this.priceCache.set(key, update);

    // Emit the update
    this.emit('price', update);

    // Check for arbitrage if enabled
    if (this.config.detectArbitrage) {
      this.checkArbitrage(update);
    }
  }

  private checkArbitrage(update: PriceUpdate): void {
    // Group prices by similar titles
    const titleKey = update.title.toLowerCase().slice(0, 30);
    const similarMarkets: PriceUpdate[] = [];

    for (const cached of this.priceCache.values()) {
      if (cached.title.toLowerCase().slice(0, 30) === titleKey) {
        similarMarkets.push(cached);
      }
    }

    if (similarMarkets.length < 2) return;

    // Check for price discrepancies
    const sortedByYes = [...similarMarkets].sort((a, b) => a.yesPrice - b.yesPrice);
    const lowestYes = sortedByYes[0];
    const highestYes = sortedByYes[sortedByYes.length - 1];

    const spread = highestYes.yesPrice - lowestYes.yesPrice;

    if (spread >= (this.config.arbitrageThreshold || 0.03)) {
      const signal: ArbitrageSignal = {
        marketQuery: titleKey,
        platforms: similarMarkets.map(m => ({
          platform: m.platform,
          marketId: m.marketId,
          yesPrice: m.yesPrice,
          noPrice: m.noPrice,
        })),
        spread,
        direction: 'buy_yes_sell_no',
        expectedProfit: (spread / lowestYes.yesPrice) * 100,
        timestamp: Date.now(),
      };

      this.emit('arbitrage', signal);
    }

    // Check for guaranteed profit (YES + NO < 1 across platforms)
    const sortedByNo = [...similarMarkets].sort((a, b) => a.noPrice - b.noPrice);
    const lowestNo = sortedByNo[0];

    const totalCost = lowestYes.yesPrice + lowestNo.noPrice;
    if (totalCost < 0.97 && lowestYes.platform !== lowestNo.platform) {
      const signal: ArbitrageSignal = {
        marketQuery: titleKey,
        platforms: [
          {
            platform: lowestYes.platform,
            marketId: lowestYes.marketId,
            yesPrice: lowestYes.yesPrice,
            noPrice: lowestYes.noPrice,
          },
          {
            platform: lowestNo.platform,
            marketId: lowestNo.marketId,
            yesPrice: lowestNo.yesPrice,
            noPrice: lowestNo.noPrice,
          },
        ],
        spread: 1 - totalCost,
        direction: 'buy_yes_sell_no',
        expectedProfit: ((1 - totalCost) / totalCost) * 100,
        timestamp: Date.now(),
      };

      this.emit('arbitrage', signal);
    }
  }

  async connect(): Promise<void> {
    const platforms = this.config.platforms || [];
    const connections: Promise<void>[] = [];

    if (platforms.includes('kalshi')) {
      connections.push(this.kalshi.connect().catch(e => {
        console.error('[Stream] Kalshi connection failed:', e);
      }));
    }

    if (platforms.includes('polymarket')) {
      connections.push(this.polymarket.connect().catch(e => {
        console.error('[Stream] Polymarket connection failed:', e);
      }));
    }

    if (platforms.includes('manifold')) {
      connections.push(this.manifold.connect().catch(e => {
        console.error('[Stream] Manifold connection failed:', e);
      }));
    }

    await Promise.all(connections);
    this.isConnected = true;
    this.emit('connected');

    console.log('[Stream] Connected to all platforms');
  }

  subscribe(platform: Platform, marketId: string): void {
    switch (platform) {
      case 'kalshi':
        this.kalshi.subscribe(marketId);
        break;
      case 'polymarket':
        this.polymarket.subscribe(marketId);
        break;
      case 'manifold':
        this.manifold.subscribe(marketId);
        break;
    }
  }

  unsubscribe(platform: Platform, marketId: string): void {
    switch (platform) {
      case 'kalshi':
        this.kalshi.unsubscribe(marketId);
        break;
      case 'polymarket':
        this.polymarket.unsubscribe(marketId);
        break;
      case 'manifold':
        this.manifold.unsubscribe(marketId);
        break;
    }
  }

  disconnect(): void {
    this.kalshi.disconnect();
    this.polymarket.disconnect();
    this.manifold.disconnect();

    if (this.arbitrageCheckInterval) {
      clearInterval(this.arbitrageCheckInterval);
    }

    this.isConnected = false;
    this.emit('disconnected');
    console.log('[Stream] Disconnected from all platforms');
  }

  getLatestPrice(platform: Platform, marketId: string): PriceUpdate | null {
    return this.priceCache.get(`${platform}:${marketId}`) || null;
  }

  getAllPrices(): PriceUpdate[] {
    return Array.from(this.priceCache.values());
  }

  getArbitrageOpportunities(): ArbitrageSignal[] {
    const opportunities: ArbitrageSignal[] = [];
    const grouped = new Map<string, PriceUpdate[]>();

    // Group by title
    for (const price of this.priceCache.values()) {
      const key = price.title.toLowerCase().slice(0, 30);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(price);
    }

    // Find opportunities
    for (const [titleKey, markets] of grouped) {
      if (markets.length < 2) continue;

      const sortedByYes = [...markets].sort((a, b) => a.yesPrice - b.yesPrice);
      const lowestYes = sortedByYes[0];
      const highestYes = sortedByYes[sortedByYes.length - 1];

      const spread = highestYes.yesPrice - lowestYes.yesPrice;

      if (spread >= 0.02) {
        opportunities.push({
          marketQuery: titleKey,
          platforms: markets.map(m => ({
            platform: m.platform,
            marketId: m.marketId,
            yesPrice: m.yesPrice,
            noPrice: m.noPrice,
          })),
          spread,
          direction: 'buy_yes_sell_no',
          expectedProfit: (spread / lowestYes.yesPrice) * 100,
          timestamp: Date.now(),
        });
      }
    }

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }
}

// ============================================================================
// Alert Manager with Real-Time Support
// ============================================================================

export interface RealTimeAlert {
  id: string;
  platform: Platform;
  marketId: string;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'spread_narrow' | 'arbitrage';
  threshold: number;
  triggered: boolean;
  triggeredAt?: number;
  triggerValue?: number;
  createdAt: number;
}

export class RealTimeAlertManager extends EventEmitter {
  private alerts = new Map<string, RealTimeAlert>();
  private alertCounter = 0;
  private stream: PredictionMarketsStream | null = null;

  constructor() {
    super();
  }

  attachStream(stream: PredictionMarketsStream): void {
    this.stream = stream;

    stream.on('price', (update: PriceUpdate) => {
      this.checkPriceAlerts(update);
    });

    stream.on('arbitrage', (signal: ArbitrageSignal) => {
      this.checkArbitrageAlerts(signal);
    });
  }

  createAlert(
    platform: Platform,
    marketId: string,
    type: RealTimeAlert['type'],
    threshold: number
  ): RealTimeAlert {
    this.alertCounter++;
    const alert: RealTimeAlert = {
      id: `RT-ALERT-${this.alertCounter}`,
      platform,
      marketId,
      type,
      threshold,
      triggered: false,
      createdAt: Date.now(),
    };

    this.alerts.set(alert.id, alert);
    return alert;
  }

  private checkPriceAlerts(update: PriceUpdate): void {
    for (const alert of this.alerts.values()) {
      if (alert.triggered) continue;
      if (alert.platform !== update.platform) continue;
      if (alert.marketId !== update.marketId && alert.marketId !== '*') continue;

      let shouldTrigger = false;
      let triggerValue: number | undefined;

      switch (alert.type) {
        case 'price_above':
          shouldTrigger = update.yesPrice >= alert.threshold;
          triggerValue = update.yesPrice;
          break;
        case 'price_below':
          shouldTrigger = update.yesPrice <= alert.threshold;
          triggerValue = update.yesPrice;
          break;
        case 'volume_spike':
          shouldTrigger = update.volume24h >= alert.threshold;
          triggerValue = update.volume24h;
          break;
        case 'spread_narrow':
          const spread = Math.abs(update.yesAsk - update.yesBid);
          shouldTrigger = spread <= alert.threshold;
          triggerValue = spread;
          break;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        alert.triggerValue = triggerValue;

        this.emit('alert_triggered', {
          alert,
          update,
        });
      }
    }
  }

  private checkArbitrageAlerts(signal: ArbitrageSignal): void {
    for (const alert of this.alerts.values()) {
      if (alert.triggered) continue;
      if (alert.type !== 'arbitrage') continue;

      if (signal.expectedProfit >= alert.threshold) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        alert.triggerValue = signal.expectedProfit;

        this.emit('alert_triggered', {
          alert,
          signal,
        });
      }
    }
  }

  removeAlert(id: string): boolean {
    return this.alerts.delete(id);
  }

  getActiveAlerts(): RealTimeAlert[] {
    return Array.from(this.alerts.values()).filter(a => !a.triggered);
  }

  getTriggeredAlerts(): RealTimeAlert[] {
    return Array.from(this.alerts.values()).filter(a => a.triggered);
  }
}

// ============================================================================
// Exports
// ============================================================================

let streamInstance: PredictionMarketsStream | null = null;

export function getStream(config?: StreamConfig): PredictionMarketsStream {
  if (!streamInstance) {
    streamInstance = new PredictionMarketsStream(config);
  }
  return streamInstance;
}

export default {
  PredictionMarketsStream,
  RealTimeAlertManager,
  getStream,
};
