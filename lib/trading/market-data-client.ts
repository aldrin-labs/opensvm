/**
 * Market Data Client
 * Handles real-time market data fetching and WebSocket connections
 */

import { EventEmitter } from 'events';

export interface MarketData {
  market: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
  orderBook?: {
    bids: Array<{ price: number; amount: number }>;
    asks: Array<{ price: number; amount: number }>;
    spread: number;
    spreadPercent: number;
  };
  recentTrades?: Array<{
    id: string;
    price: number;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: number;
  }>;
  isRealData: boolean;
  dataSource?: string;
}

export interface WebSocketMessage {
  type: 'price_update' | 'orderbook_update' | 'trade_update' | 'error';
  data: any;
  timestamp: number;
}

export class MarketDataClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentMarket: string = 'SOL/USDC';
  private isConnected: boolean = false;
  private lastData: MarketData | null = null;
  
  constructor() {
    super();
  }
  
  /**
   * Connect to market data sources
   */
  public async connect(market: string = 'SOL/USDC'): Promise<void> {
    this.currentMarket = market;
    
    // Start with REST API polling (WebSocket can be added when backend supports it)
    this.startPolling();
    
    // Try to establish WebSocket connection
    this.connectWebSocket();
  }
  
  /**
   * Disconnect from market data sources
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.isConnected = false;
    this.emit('disconnected');
  }
  
  /**
   * Start polling REST API for market data
   */
  private startPolling(): void {
    // Initial fetch
    this.fetchMarketData();
    
    // Poll every 2 seconds
    this.pollInterval = setInterval(() => {
      this.fetchMarketData();
    }, 2000);
  }
  
  /**
   * Fetch market data from REST API
   */
  private async fetchMarketData(): Promise<void> {
    try {
      const response = await fetch(`/api/trading/market-data?market=${encodeURIComponent(this.currentMarket)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: MarketData = await response.json();
      
      // Check if data changed
      if (this.hasDataChanged(data)) {
        this.lastData = data;
        
        // Emit various update events
        this.emit('data', data);
        this.emit('price_update', {
          market: data.market,
          price: data.price,
          change24h: data.change24h,
          timestamp: data.lastUpdate
        });
        
        if (data.orderBook) {
          this.emit('orderbook_update', data.orderBook);
        }
        
        if (data.recentTrades) {
          this.emit('trades_update', data.recentTrades);
        }
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Check if market data has changed
   */
  private hasDataChanged(newData: MarketData): boolean {
    if (!this.lastData) return true;
    
    return (
      newData.price !== this.lastData.price ||
      newData.volume24h !== this.lastData.volume24h ||
      newData.orderBook?.spread !== this.lastData.orderBook?.spread
    );
  }
  
  /**
   * Connect to WebSocket for real-time updates
   */
  private connectWebSocket(): void {
    // Check if WebSocket is available in the environment
    if (typeof window === 'undefined' || !window.WebSocket) {
      console.log('WebSocket not available, using polling only');
      return;
    }
    
    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/trading/ws`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.emit('connected');
        
        // Subscribe to market updates
        this.sendMessage({
          type: 'subscribe',
          market: this.currentMarket
        });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        
        // Attempt to reconnect after 5 seconds
        this.reconnectTimer = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          this.connectWebSocket();
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      // Continue with polling only
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'price_update':
        this.emit('price_update', message.data);
        break;
      
      case 'orderbook_update':
        this.emit('orderbook_update', message.data);
        break;
      
      case 'trade_update':
        this.emit('trade_update', message.data);
        break;
      
      case 'error':
        this.emit('error', new Error(message.data.message || 'WebSocket error'));
        break;
      
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }
  
  /**
   * Send message through WebSocket
   */
  private sendMessage(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  /**
   * Change market subscription
   */
  public changeMarket(market: string): void {
    const oldMarket = this.currentMarket;
    this.currentMarket = market;
    
    // Update WebSocket subscription
    if (this.isConnected) {
      this.sendMessage({
        type: 'unsubscribe',
        market: oldMarket
      });
      
      this.sendMessage({
        type: 'subscribe',
        market: market
      });
    }
    
    // Fetch new market data immediately
    this.fetchMarketData();
  }
  
  /**
   * Get current market data
   */
  public getCurrentData(): MarketData | null {
    return this.lastData;
  }
  
  /**
   * Get market snapshot
   */
  public async getSnapshot(): Promise<MarketData> {
    const response = await fetch(`/api/trading/market-data?market=${encodeURIComponent(this.currentMarket)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch market snapshot: ${response.status}`);
    }
    
    return await response.json();
  }
  
  /**
   * Fetch historical data
   */
  public async getHistoricalData(
    market: string,
    interval: '1m' | '5m' | '15m' | '1h' | '1d',
    limit: number = 100
  ): Promise<Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    // This would fetch from a historical data endpoint
    // For now, generate mock data
    const data = [];
    const now = Date.now();
    const intervalMs = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '1d': 86400000
    }[interval];
    
    let price = 150;
    
    for (let i = limit - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      const change = (Math.random() - 0.5) * 2;
      price += change;
      
      data.push({
        timestamp,
        open: price - Math.random(),
        high: price + Math.random() * 2,
        low: price - Math.random() * 2,
        close: price,
        volume: Math.random() * 100000
      });
    }
    
    return data;
  }
}

// Export singleton instance
export const marketDataClient = new MarketDataClient();
