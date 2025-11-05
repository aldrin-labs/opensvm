/**
 * Trading WebSocket Client
 * 
 * EventEmitter-based WebSocket client for real-time trading data.
 * Features auto-reconnect with exponential backoff, message parsing,
 * and comprehensive error handling.
 * 
 * @module lib/websocket/trading
 */

import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: 'orderbook' | 'trade' | 'ticker' | 'error' | 'ping' | 'pong';
  data: unknown;
  timestamp: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  pingInterval?: number;
}

export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  reconnectCount: number;
  lastPing: number | null;
  lastPong: number | null;
}

/**
 * Trading WebSocket client with auto-reconnect.
 * 
 * Events emitted:
 * - 'connected': WebSocket connection established
 * - 'disconnected': WebSocket connection closed
 * - 'error': Error occurred
 * - 'message': Message received (type, data, timestamp)
 * - 'orderbook': Order book update
 * - 'trade': New trade
 * - 'ticker': Ticker update
 * 
 * @example
 * ```ts
 * const ws = new TradingWebSocket({
 *   url: 'wss://api.example.com/v1/ws',
 *   reconnectAttempts: 5,
 *   reconnectDelay: 1000,
 * });
 * 
 * ws.on('connected', () => {
 *   console.log('Connected to trading WebSocket');
 *   ws.send({ type: 'subscribe', channel: 'orderbook', market: 'SOL/USDC' });
 * });
 * 
 * ws.on('orderbook', (data) => {
 *   console.log('Order book update:', data);
 * });
 * 
 * ws.connect();
 * ```
 */
export class TradingWebSocket extends EventEmitter {
  private config: Required<WebSocketConfig>;
  private ws: WebSocket | null = null;
  private state: WebSocketState = {
    connected: false,
    reconnecting: false,
    error: null,
    reconnectCount: 0,
    lastPing: null,
    lastPong: null,
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      url: config.url,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      pingInterval: config.pingInterval ?? 30000,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    this.intentionalClose = false;

    try {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = (event) => this.handleError(event);
      this.ws.onmessage = (event) => this.handleMessage(event);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create WebSocket';
      this.updateState({ error: errorMessage });
      this.emit('error', errorMessage);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopReconnecting();
    this.stopPing();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.updateState({
      connected: false,
      reconnecting: false,
      reconnectCount: 0,
    });
  }

  /**
   * Send message to WebSocket server
   */
  send(data: unknown): boolean {
    if (!this.isConnected()) {
      console.error('WebSocket not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws!.send(message);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      this.emit('error', errorMessage);
      return false;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.state.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current WebSocket state
   */
  getState(): Readonly<WebSocketState> {
    return { ...this.state };
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('WebSocket connected');
    
    this.updateState({
      connected: true,
      reconnecting: false,
      reconnectCount: 0,
      error: null,
    });
    
    this.emit('connected');
    this.startPing();
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket closed: ${event.code} ${event.reason}`);
    
    this.stopPing();
    this.updateState({
      connected: false,
      error: event.reason || 'Connection closed',
    });
    
    this.emit('disconnected', event);
    
    // Attempt reconnection if not intentional close
    if (!this.intentionalClose) {
      this.attemptReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    const errorMessage = 'WebSocket error occurred';
    console.error(errorMessage, event);
    
    this.updateState({ error: errorMessage });
    this.emit('error', errorMessage);
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle pong response
      if (message.type === 'pong') {
        this.updateState({ lastPong: Date.now() });
        return;
      }
      
      // Emit general message event
      this.emit('message', message);
      
      // Emit specific message type event
      if (message.type) {
        this.emit(message.type, message.data);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.emit('error', 'Failed to parse message');
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.state.reconnectCount >= this.config.reconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('error', 'Max reconnection attempts reached');
      return;
    }

    this.updateState({ reconnecting: true });
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.state.reconnectCount),
      this.config.maxReconnectDelay
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.state.reconnectCount + 1}/${this.config.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.updateState({ reconnectCount: this.state.reconnectCount + 1 });
      this.connect();
    }, delay);
  }

  /**
   * Stop reconnection attempts
   */
  private stopReconnecting(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start ping interval
   */
  private startPing(): void {
    this.stopPing();
    
    this.pingTimer = setInterval(() => {
      if (this.isConnected()) {
        this.updateState({ lastPing: Date.now() });
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.config.pingInterval);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Update internal state
   */
  private updateState(updates: Partial<WebSocketState>): void {
    this.state = { ...this.state, ...updates };
  }
}

/**
 * Create a trading WebSocket client for a specific market.
 * 
 * @param market - Market pair (e.g., 'SOL/USDC')
 * @param config - WebSocket configuration
 * @returns TradingWebSocket instance
 * 
 * @example
 * ```ts
 * const ws = createTradingWebSocket('SOL/USDC', {
 *   url: 'wss://api.example.com/v1/ws',
 * });
 * 
 * ws.on('connected', () => {
 *   console.log('Connected!');
 * });
 * 
 * ws.connect();
 * ```
 */
export function createTradingWebSocket(
  _market: string,
  config: Omit<WebSocketConfig, 'url'> & { url?: string }
): TradingWebSocket {
  // TODO: Replace with actual WebSocket URL for the market
  const url = config.url || 'wss://api.opensvm.com/v1/ws';
  
  return new TradingWebSocket({ ...config, url });
}

export default TradingWebSocket;
