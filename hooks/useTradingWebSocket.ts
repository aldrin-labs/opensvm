/**
 * useTradingWebSocket Hook
 *
 * React hook for real-time trading data via WebSocket.
 * Connects to trading WebSocket server and provides live trades, candles, and orderbook updates.
 *
 * @module hooks/useTradingWebSocket
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Trade {
  id: string;
  signature?: string;
  timestamp: number;
  time?: number;
  price: number;
  amount: number;
  size?: number;
  side: 'buy' | 'sell';
  dex?: string;
  market?: string;
  isNew?: boolean;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total?: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
}

export interface WebSocketStatus {
  connected: boolean;
  error: string | null;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastPing: number | null;
  lastMessage: number | null;
}

export interface UseTradingWebSocketOptions {
  market: string;
  tokenMint?: string;
  autoConnect?: boolean;
  maxTrades?: number;
  onTrade?: (trade: Trade) => void;
  onCandle?: (candle: CandleData) => void;
  onOrderBook?: (orderBook: OrderBook) => void;
  onError?: (error: Error) => void;
}

export interface UseTradingWebSocketReturn {
  trades: Trade[];
  candles: CandleData[];
  orderBook: OrderBook | null;
  status: WebSocketStatus;
  connect: () => void;
  disconnect: () => void;
  clearTrades: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

/**
 * Hook for real-time trading data via WebSocket
 *
 * @example
 * ```tsx
 * const { trades, status, connect } = useTradingWebSocket({
 *   market: 'SOL/USDC',
 *   onTrade: (trade) => console.log('New trade:', trade),
 * });
 *
 * useEffect(() => {
 *   connect();
 * }, []);
 * ```
 */
export function useTradingWebSocket(
  options: UseTradingWebSocketOptions
): UseTradingWebSocketReturn {
  const {
    market,
    tokenMint,
    autoConnect = false,
    maxTrades = 100,
    onTrade,
    onCandle,
    onOrderBook,
    onError,
  } = options;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    error: null,
    reconnecting: false,
    reconnectAttempts: 0,
    lastPing: null,
    lastMessage: null,
  });

  const wsRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isInitialMountRef = useRef(true);
  const subscriptionsRef = useRef<Set<string>>(new Set(['trades', 'candles']));

  // Get SSE URL (Server-Sent Events)
  const getStreamUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';

    const baseUrl = window.location.origin;
    const channels = Array.from(subscriptionsRef.current).join(',');

    return `${baseUrl}/api/trading/stream?market=${encodeURIComponent(market)}&channels=${channels}`;
  }, [market]);

  /**
   * Send message via WebSocket (not supported in SSE mode)
   */
  const sendMessage = useCallback((message: any) => {
    // SSE is unidirectional, subscription changes require reconnection
    console.log('[TradingWS] SSE mode: message sending not supported', message);
    return false;
  }, []);

  /**
   * Subscribe to a channel
   */
  const subscribe = useCallback(
    (channel: string) => {
      subscriptionsRef.current.add(channel);
      sendMessage({
        type: 'subscribe',
        channel,
        market,
        tokenMint,
      });
    },
    [market, tokenMint, sendMessage]
  );

  /**
   * Unsubscribe from a channel
   */
  const unsubscribe = useCallback(
    (channel: string) => {
      subscriptionsRef.current.delete(channel);
      sendMessage({
        type: 'unsubscribe',
        channel,
        market,
      });
    },
    [market, sendMessage]
  );

  /**
   * Handle WebSocket message
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        setStatus((prev) => ({
          ...prev,
          lastMessage: Date.now(),
        }));

        switch (message.type) {
          case 'trade':
            const trade: Trade = {
              ...message.data,
              isNew: true,
            };

            if (isMountedRef.current) {
              setTrades((prev) => {
                const newTrades = [trade, ...prev].slice(0, maxTrades);
                // Clear isNew flag after 2 seconds
                setTimeout(() => {
                  setTrades((current) =>
                    current.map((t) =>
                      t.id === trade.id ? { ...t, isNew: false } : t
                    )
                  );
                }, 2000);
                return newTrades;
              });

              onTrade?.(trade);
            }
            break;

          case 'candle':
            const candle: CandleData = message.data;
            if (isMountedRef.current) {
              setCandles((prev) => {
                // Update existing candle or add new one
                const existingIndex = prev.findIndex((c) => c.time === candle.time);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = candle;
                  return updated;
                } else {
                  return [...prev, candle].sort((a, b) => a.time - b.time);
                }
              });

              onCandle?.(candle);
            }
            break;

          case 'orderbook':
            const ob: OrderBook = message.data;
            if (isMountedRef.current) {
              setOrderBook(ob);
              onOrderBook?.(ob);
            }
            break;

          case 'pong':
            setStatus((prev) => ({
              ...prev,
              lastPing: Date.now(),
            }));
            break;

          case 'error':
            console.error('[TradingWS] Server error:', message.message);
            setStatus((prev) => ({
              ...prev,
              error: message.message,
            }));
            onError?.(new Error(message.message));
            break;

          default:
            console.log('[TradingWS] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[TradingWS] Failed to parse message:', error);
      }
    },
    [maxTrades, onTrade, onCandle, onOrderBook, onError]
  );

  /**
   * Start connection health monitor
   * Detects stale connections (no messages for 45 seconds) and reconnects
   */
  const startHealthCheck = useCallback(() => {
    if (healthCheckTimerRef.current) {
      clearInterval(healthCheckTimerRef.current);
    }

    healthCheckTimerRef.current = setInterval(() => {
      if (!isMountedRef.current) return;

      // Get current status from state
      setStatus((currentStatus) => {
        if (!currentStatus.connected) return currentStatus;

        const now = Date.now();
        const lastMessage = currentStatus.lastMessage || currentStatus.lastPing;

        // If no message received in 45 seconds, connection might be stale
        if (lastMessage && now - lastMessage > 45000) {
          console.warn('[TradingWS] Stale connection detected, will reconnect...');

          // Trigger reconnection on next tick to avoid circular dependency
          setTimeout(() => {
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            // The error handler will trigger reconnection
          }, 0);
        }

        return currentStatus;
      });
    }, 15000); // Check every 15 seconds
  }, []);

  /**
   * Stop health check
   */
  const stopHealthCheck = useCallback(() => {
    if (healthCheckTimerRef.current) {
      clearInterval(healthCheckTimerRef.current);
      healthCheckTimerRef.current = null;
    }
  }, []);

  /**
   * Start ping interval (legacy, SSE doesn't support pings)
   */
  const startPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
    }

    // SSE doesn't support client-to-server pings
    // We rely on heartbeat events from server instead
  }, []);

  /**
   * Stop ping interval
   */
  const stopPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (wsRef.current) {
      console.warn('[TradingWS] Already connected');
      return;
    }

    const url = getStreamUrl();
    if (!url) {
      console.error('[TradingWS] Cannot get stream URL');
      return;
    }

    console.log('[TradingWS] Connecting to SSE:', url);

    try {
      const eventSource = new EventSource(url);
      wsRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[TradingWS] SSE Connected');

        if (isMountedRef.current) {
          setStatus({
            connected: true,
            error: null,
            reconnecting: false,
            reconnectAttempts: 0,
            lastPing: null,
            lastMessage: Date.now(),
          });

          // Start health monitoring
          startHealthCheck();
        }
      };

      // Listen for connection confirmation
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        console.log('[TradingWS] Connection confirmed:', data);
      });

      // Listen for trade events
      eventSource.addEventListener('trade', (event) => {
        const message = JSON.parse(event.data);
        handleMessage({ data: JSON.stringify(message) } as MessageEvent);
      });

      // Listen for candle events
      eventSource.addEventListener('candle', (event) => {
        const message = JSON.parse(event.data);
        handleMessage({ data: JSON.stringify(message) } as MessageEvent);
      });

      // Listen for heartbeat
      eventSource.addEventListener('heartbeat', (event) => {
        if (isMountedRef.current) {
          setStatus((prev) => ({
            ...prev,
            lastPing: Date.now(),
          }));
        }
      });

      // Listen for info messages
      eventSource.addEventListener('info', (event) => {
        const data = JSON.parse(event.data);
        console.log('[TradingWS] Info:', data.message);
      });

      eventSource.onerror = (error) => {
        console.error('[TradingWS] SSE error:', error);

        if (isMountedRef.current) {
          setStatus((prev) => {
            const newStatus = {
              ...prev,
              connected: false,
              error: 'Stream connection error',
            };

            // Attempt reconnection with exponential backoff + jitter
            if (prev.reconnectAttempts < 5) {
              // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
              const baseDelay = Math.min(1000 * Math.pow(2, prev.reconnectAttempts), 30000);
              // Add jitter (0-1000ms) to prevent thundering herd
              const jitter = Math.random() * 1000;
              const delay = baseDelay + jitter;

              console.log(
                `[TradingWS] Reconnecting in ${Math.round(delay)}ms (attempt ${prev.reconnectAttempts + 1}/5)`
              );

              newStatus.reconnecting = true;
              newStatus.reconnectAttempts = prev.reconnectAttempts + 1;

              reconnectTimerRef.current = setTimeout(() => {
                disconnect();
                connect();
              }, delay);
            } else {
              console.error('[TradingWS] Max reconnection attempts reached');
              newStatus.error = 'Connection failed after 5 attempts. Please refresh the page.';
              onError?.(new Error('Max reconnection attempts reached'));
            }

            return newStatus;
          });
        }

        // Close the failed connection
        eventSource.close();
        wsRef.current = null;
      };
    } catch (error) {
      console.error('[TradingWS] Failed to create SSE connection:', error);
      if (isMountedRef.current) {
        setStatus((prev) => ({
          ...prev,
          error: 'Failed to create stream connection',
        }));
        onError?.(error as Error);
      }
    }
  }, [getStreamUrl, handleMessage, startHealthCheck, onError]);

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    console.log('[TradingWS] Disconnecting...');

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    stopPing();
    stopHealthCheck();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (isMountedRef.current) {
      setStatus({
        connected: false,
        error: null,
        reconnecting: false,
        reconnectAttempts: 0,
        lastPing: null,
        lastMessage: null,
      });
    }
  }, [stopPing, stopHealthCheck]);

  /**
   * Clear trades history
   */
  const clearTrades = useCallback(() => {
    if (isMountedRef.current) {
      setTrades([]);
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]); // Only depend on autoConnect to avoid infinite loops

  // Handle market changes - disconnect and reconnect to new market
  useEffect(() => {
    // Skip initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Only reconnect if currently connected
    if (!status.connected) return;

    console.log(`[TradingWS] Market changed to ${market}, reconnecting...`);

    // Disconnect from old market
    disconnect();

    // Small delay before reconnecting to new market
    const reconnectTimer = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 500);

    return () => {
      clearTimeout(reconnectTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, tokenMint]); // Only market change should trigger reconnection

  return {
    trades,
    candles,
    orderBook,
    status,
    connect,
    disconnect,
    clearTrades,
    subscribe,
    unsubscribe,
  };
}

export default useTradingWebSocket;
