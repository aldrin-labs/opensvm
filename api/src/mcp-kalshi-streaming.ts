#!/usr/bin/env bun
/**
 * Kalshi WebSocket Streaming MCP Module
 *
 * Provides real-time market data streaming via WebSocket:
 * - Orderbook updates (bids/asks changes)
 * - Trade executions
 * - Market status changes
 * - Fill notifications (authenticated)
 *
 * WebSocket endpoint: wss://api.elections.kalshi.com/trade-api/ws/v2
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface OrderbookUpdate {
  type: 'orderbook';
  ticker: string;
  timestamp: number;
  yes: { price: number; quantity: number }[];
  no: { price: number; quantity: number }[];
  spread: number;
  midPrice: number;
}

export interface TradeUpdate {
  type: 'trade';
  ticker: string;
  timestamp: number;
  price: number;
  count: number;
  side: 'yes' | 'no';
  takerSide: 'buy' | 'sell';
}

export interface MarketStatusUpdate {
  type: 'market_status';
  ticker: string;
  timestamp: number;
  status: 'open' | 'closed' | 'settled';
  result?: 'yes' | 'no';
}

export interface FillUpdate {
  type: 'fill';
  orderId: string;
  ticker: string;
  timestamp: number;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  price: number;
  isTaker: boolean;
}

export type StreamUpdate = OrderbookUpdate | TradeUpdate | MarketStatusUpdate | FillUpdate;

export interface StreamSubscription {
  id: string;
  type: 'orderbook' | 'trades' | 'market_status' | 'fills';
  tickers: string[];
  callback: (update: StreamUpdate) => void;
}

// ============================================================================
// WebSocket Client
// ============================================================================

export class KalshiWebSocketClient extends EventEmitter {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private apiKeyId?: string;
  private privateKey?: crypto.KeyObject;
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private isConnecting = false;
  private messageQueue: any[] = [];

  constructor(
    wsUrl: string = 'wss://api.elections.kalshi.com/trade-api/ws/v2',
    apiKeyId?: string,
    privateKeyPem?: string
  ) {
    super();
    this.wsUrl = wsUrl;
    this.apiKeyId = apiKeyId;
    if (privateKeyPem) {
      this.privateKey = crypto.createPrivateKey(privateKeyPem);
    }
  }

  private signMessage(timestamp: string, message: string): string | null {
    if (!this.privateKey || !this.apiKeyId) return null;

    const toSign = `${timestamp}${message}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(toSign);
    sign.end();

    return sign.sign({
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }, 'base64');
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connected');
          console.error('[Kalshi WS] Connected');

          // Authenticate if credentials provided
          if (this.apiKeyId && this.privateKey) {
            this.authenticate();
          }

          // Resubscribe to all subscriptions
          this.resubscribeAll();

          // Send queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.send(msg);
          }

          // Start heartbeat
          this.startHeartbeat();

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[Kalshi WS] Error:', error);
          this.emit('error', error);
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.stopHeartbeat();
          console.error(`[Kalshi WS] Disconnected: ${event.code} ${event.reason}`);
          this.emit('disconnected', event);
          this.scheduleReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private authenticate(): void {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = 'websocket_auth';
    const signature = this.signMessage(timestamp, message);

    if (signature) {
      this.send({
        type: 'auth',
        api_key: this.apiKeyId,
        timestamp,
        signature,
      });
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'auth_response':
          if (message.success) {
            console.error('[Kalshi WS] Authenticated');
            this.emit('authenticated');
          } else {
            console.error('[Kalshi WS] Auth failed:', message.error);
            this.emit('auth_error', message.error);
          }
          break;

        case 'orderbook_snapshot':
        case 'orderbook_delta':
          this.processOrderbookUpdate(message);
          break;

        case 'trade':
          this.processTradeUpdate(message);
          break;

        case 'market_status':
          this.processMarketStatusUpdate(message);
          break;

        case 'fill':
          this.processFillUpdate(message);
          break;

        case 'subscribed':
          console.error(`[Kalshi WS] Subscribed to ${message.channel}`);
          this.emit('subscribed', message);
          break;

        case 'unsubscribed':
          console.error(`[Kalshi WS] Unsubscribed from ${message.channel}`);
          this.emit('unsubscribed', message);
          break;

        case 'pong':
          // Heartbeat response
          break;

        case 'error':
          console.error('[Kalshi WS] Error:', message.message);
          this.emit('error', new Error(message.message));
          break;

        default:
          this.emit('message', message);
      }
    } catch (error) {
      console.error('[Kalshi WS] Parse error:', error);
    }
  }

  private processOrderbookUpdate(message: any): void {
    const update: OrderbookUpdate = {
      type: 'orderbook',
      ticker: message.market_ticker,
      timestamp: Date.now(),
      yes: message.yes || [],
      no: message.no || [],
      spread: 0,
      midPrice: 0,
    };

    // Calculate spread and mid price
    if (update.yes.length > 0 && update.no.length > 0) {
      const bestYesBid = update.yes[0]?.price || 0;
      const bestNoBid = update.no[0]?.price || 0;
      update.spread = 100 - bestYesBid - bestNoBid;
      update.midPrice = (bestYesBid + (100 - bestNoBid)) / 2;
    }

    // Notify subscribers
    this.notifySubscribers('orderbook', message.market_ticker, update);
  }

  private processTradeUpdate(message: any): void {
    const update: TradeUpdate = {
      type: 'trade',
      ticker: message.market_ticker,
      timestamp: new Date(message.ts).getTime(),
      price: message.yes_price,
      count: message.count,
      side: message.yes_price > 50 ? 'yes' : 'no',
      takerSide: message.taker_side,
    };

    this.notifySubscribers('trades', message.market_ticker, update);
  }

  private processMarketStatusUpdate(message: any): void {
    const update: MarketStatusUpdate = {
      type: 'market_status',
      ticker: message.market_ticker,
      timestamp: Date.now(),
      status: message.status,
      result: message.result,
    };

    this.notifySubscribers('market_status', message.market_ticker, update);
  }

  private processFillUpdate(message: any): void {
    const update: FillUpdate = {
      type: 'fill',
      orderId: message.order_id,
      ticker: message.market_ticker,
      timestamp: new Date(message.ts).getTime(),
      side: message.side,
      action: message.action,
      count: message.count,
      price: message.price,
      isTaker: message.is_taker,
    };

    this.notifySubscribers('fills', message.market_ticker, update);
  }

  private notifySubscribers(type: string, ticker: string, update: StreamUpdate): void {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.type === type && (sub.tickers.includes(ticker) || sub.tickers.includes('*'))) {
        try {
          sub.callback(update);
        } catch (error) {
          console.error(`[Kalshi WS] Callback error for ${sub.id}:`, error);
        }
      }
    }

    // Also emit as event
    this.emit(type, update);
    this.emit('update', update);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Kalshi WS] Max reconnect attempts reached');
      this.emit('max_reconnects');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.error(`[Kalshi WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  private resubscribeAll(): void {
    for (const sub of Array.from(this.subscriptions.values())) {
      this.sendSubscription(sub.type, sub.tickers, true);
    }
  }

  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private sendSubscription(type: string, tickers: string[], subscribe: boolean): void {
    const channelMap: Record<string, string> = {
      orderbook: 'orderbook_delta',
      trades: 'trade',
      market_status: 'market_status',
      fills: 'fill',
    };

    const channel = channelMap[type] || type;

    for (const ticker of tickers) {
      this.send({
        type: subscribe ? 'subscribe' : 'unsubscribe',
        channel,
        market_ticker: ticker === '*' ? undefined : ticker,
      });
    }
  }

  // Public API

  subscribe(
    type: 'orderbook' | 'trades' | 'market_status' | 'fills',
    tickers: string[],
    callback: (update: StreamUpdate) => void
  ): string {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.subscriptions.set(id, {
      id,
      type,
      tickers,
      callback,
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(type, tickers, true);
    }

    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    this.subscriptions.delete(subscriptionId);

    // Check if any other subscription needs these tickers
    const stillNeeded = new Set<string>();
    for (const other of Array.from(this.subscriptions.values())) {
      if (other.type === sub.type) {
        other.tickers.forEach(t => stillNeeded.add(t));
      }
    }

    const toUnsubscribe = sub.tickers.filter(t => !stillNeeded.has(t));
    if (toUnsubscribe.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(sub.type, toUnsubscribe, false);
    }

    return true;
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.subscriptions.clear();
    this.messageQueue = [];
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

// ============================================================================
// Streaming Data Aggregator
// ============================================================================

export interface AggregatedMarketData {
  ticker: string;
  lastUpdate: number;
  orderbook: {
    yes: { price: number; quantity: number }[];
    no: { price: number; quantity: number }[];
    spread: number;
    midPrice: number;
  };
  trades: TradeUpdate[];
  volume1m: number;
  vwap1m: number;
  priceChange1m: number;
}

export class MarketDataAggregator extends EventEmitter {
  private wsClient: KalshiWebSocketClient;
  private marketData: Map<string, AggregatedMarketData> = new Map();
  private tradeWindow = 60000; // 1 minute
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(wsClient: KalshiWebSocketClient) {
    super();
    this.wsClient = wsClient;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.wsClient.on('orderbook', (update: OrderbookUpdate) => {
      this.updateOrderbook(update);
    });

    this.wsClient.on('trade', (update: TradeUpdate) => {
      this.addTrade(update);
    });

    // Cleanup old trades every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTrades();
    }, 10000);
  }

  private getOrCreateMarketData(ticker: string): AggregatedMarketData {
    let data = this.marketData.get(ticker);
    if (!data) {
      data = {
        ticker,
        lastUpdate: Date.now(),
        orderbook: {
          yes: [],
          no: [],
          spread: 0,
          midPrice: 0,
        },
        trades: [],
        volume1m: 0,
        vwap1m: 0,
        priceChange1m: 0,
      };
      this.marketData.set(ticker, data);
    }
    return data;
  }

  private updateOrderbook(update: OrderbookUpdate): void {
    const data = this.getOrCreateMarketData(update.ticker);
    data.orderbook = {
      yes: update.yes,
      no: update.no,
      spread: update.spread,
      midPrice: update.midPrice,
    };
    data.lastUpdate = update.timestamp;
    this.emit('marketUpdate', data);
  }

  private addTrade(update: TradeUpdate): void {
    const data = this.getOrCreateMarketData(update.ticker);
    data.trades.push(update);
    data.lastUpdate = update.timestamp;
    this.recalculateMetrics(data);
    this.emit('marketUpdate', data);
    this.emit('trade', update);
  }

  private recalculateMetrics(data: AggregatedMarketData): void {
    const cutoff = Date.now() - this.tradeWindow;
    const recentTrades = data.trades.filter(t => t.timestamp >= cutoff);

    // Volume
    data.volume1m = recentTrades.reduce((sum, t) => sum + t.count, 0);

    // VWAP
    if (data.volume1m > 0) {
      const totalValue = recentTrades.reduce((sum, t) => sum + t.price * t.count, 0);
      data.vwap1m = totalValue / data.volume1m;
    }

    // Price change
    if (recentTrades.length >= 2) {
      const firstPrice = recentTrades[0].price;
      const lastPrice = recentTrades[recentTrades.length - 1].price;
      data.priceChange1m = lastPrice - firstPrice;
    }
  }

  private cleanupOldTrades(): void {
    const cutoff = Date.now() - this.tradeWindow * 2; // Keep 2 minutes of history
    for (const data of Array.from(this.marketData.values())) {
      data.trades = data.trades.filter(t => t.timestamp >= cutoff);
    }
  }

  getMarketData(ticker: string): AggregatedMarketData | undefined {
    return this.marketData.get(ticker);
  }

  getAllMarketData(): AggregatedMarketData[] {
    return Array.from(this.marketData.values());
  }

  subscribe(tickers: string[]): void {
    this.wsClient.subscribe('orderbook', tickers, () => {});
    this.wsClient.subscribe('trades', tickers, () => {});
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.marketData.clear();
  }
}

// ============================================================================
// MCP Tools for Streaming
// ============================================================================

export const STREAMING_TOOLS = [
  {
    name: 'kalshi_stream_connect',
    description: 'Connect to Kalshi WebSocket for real-time market data',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_stream_subscribe',
    description: 'Subscribe to real-time updates for specific markets',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['orderbook', 'trades', 'market_status', 'fills'],
          description: 'Type of updates to subscribe to',
        },
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Market tickers to subscribe to (use "*" for all)',
        },
      },
      required: ['type', 'tickers'],
    },
  },
  {
    name: 'kalshi_stream_unsubscribe',
    description: 'Unsubscribe from real-time updates',
    inputSchema: {
      type: 'object',
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID to cancel' },
      },
      required: ['subscription_id'],
    },
  },
  {
    name: 'kalshi_stream_status',
    description: 'Get current streaming connection status and subscriptions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_stream_market_snapshot',
    description: 'Get aggregated real-time market data snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker (optional, returns all if omitted)' },
      },
    },
  },
];

// ============================================================================
// Export
// ============================================================================

export function createStreamingClient(
  apiKeyId?: string,
  privateKeyPem?: string
): { wsClient: KalshiWebSocketClient; aggregator: MarketDataAggregator } {
  const wsClient = new KalshiWebSocketClient(
    'wss://api.elections.kalshi.com/trade-api/ws/v2',
    apiKeyId,
    privateKeyPem
  );
  const aggregator = new MarketDataAggregator(wsClient);
  return { wsClient, aggregator };
}
