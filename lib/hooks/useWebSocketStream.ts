/**
 * React Hook for SSE-based blockchain event streaming
 * 
 * Provides real-time blockchain events via Server-Sent Events (SSE)
 * Uses EventSource for push-based event streaming from the server
 * 
 * Note: Despite the legacy name, this uses SSE, NOT WebSocket
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface BlockchainEvent {
  type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

interface UseSSEStreamOptions {
  clientId?: string;
  autoConnect?: boolean;
  maxEvents?: number;
  eventTypes?: string[];
  onEvent?: (event: BlockchainEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface UseSSEStreamReturn {
  events: BlockchainEvent[];
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
  connectionStatus: string;
}

export function useSSEStream(options: UseSSEStreamOptions = {}): UseSSEStreamReturn {
  const {
    clientId = `sse_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    autoConnect = true,
    maxEvents = 10000,
    eventTypes = ['transaction', 'block'],
    onEvent,
    onError,
    onConnect,
    onDisconnect
  } = options;

  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const wsRef = useRef<EventSource | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isMountedRef = useRef(true);

  // First authenticate with the streaming API
  const authenticate = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'authenticate',
          clientId
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data.authToken) {
        authTokenRef.current = data.data.authToken;
        return data.data.authToken;
      }

      throw new Error('Authentication failed: No token received');
    } catch (error) {
      console.error('[SSE] Authentication error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      return null;
    }
  }, [clientId]);

  // Subscribe to events via REST API
  const subscribeToEvents = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'subscribe',
          clientId,
          eventTypes,
          authToken: token
        })
      });

      if (!response.ok) {
        throw new Error(`Subscription failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('[SSE] Subscription error:', error);
      return false;
    }
  }, [clientId, eventTypes]);

  // Start monitoring (creates mock client for the streaming manager)
  const startMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start_monitoring',
          clientId
        })
      });

      if (!response.ok) {
        throw new Error(`Start monitoring failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data.authToken) {
        authTokenRef.current = data.data.authToken;
        return true;
      }

      return false;
    } catch (error) {
      console.error('[SSE] Start monitoring error:', error);
      return false;
    }
  }, [clientId]);

  // Create SSE connection for real-time blockchain events
  const createSSEConnection = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      setConnectionStatus('connecting');
      console.log(`[SSE] Creating Server-Sent Events connection for ${clientId}`);

      // Use EventSource for receiving events from server
      const eventSource = new EventSource(`/api/sse-alerts?clientId=${encodeURIComponent(clientId)}&action=connect`);
      
      eventSource.onopen = () => {
        console.log(`[SSE] Connection established for ${clientId}`);
        if (isMountedRef.current) {
          setIsConnected(true);
          setError(null);
          setConnectionStatus('connected');
          onConnect?.();
        }
        reconnectAttempts.current = 0;
      };

      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error:', event);
        if (isMountedRef.current) {
          setIsConnected(false);
          setConnectionStatus('error');
          
          const errorMsg = 'SSE connection failed';
          setError(errorMsg);
          onError?.(new Error(errorMsg));
        }

        // Attempt to reconnect with exponential backoff, jitter, and cap
        if (reconnectAttempts.current < maxReconnectAttempts && isMountedRef.current) {
          // Exponential backoff with 30-second cap and jitter
          const baseDelay = Math.min(Math.pow(2, reconnectAttempts.current) * 1000, 30000);
          const jitter = Math.random() * 1000; // 0-1s jitter
          const delay = baseDelay + jitter;
          
          console.log(`[SSE] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              reconnectAttempts.current++;
              connect();
            }
          }, delay);
        } else if (isMountedRef.current) {
          // After max attempts, wait longer before giving up completely
          console.error('[SSE] Max reconnection attempts reached. Waiting 5 minutes before final retry...');
          setError('Connection lost. Retrying in 5 minutes...');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              reconnectAttempts.current = 0; // Reset for final attempt
              connect();
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      };

      // Listen for blockchain events
      eventSource.addEventListener('blockchain_event', (event) => {
        try {
          const blockchainEvent: BlockchainEvent = JSON.parse(event.data);
          console.log('[SSE] Received blockchain event:', blockchainEvent);
          
          if (isMountedRef.current) {
            setEvents(prev => {
              const newEvents = [blockchainEvent, ...prev].slice(0, maxEvents);
              return newEvents;
            });
          }
          
          onEvent?.(blockchainEvent);
        } catch (parseError) {
          console.error('[SSE] Failed to parse blockchain event:', parseError);
        }
      });

      // Listen for transaction events specifically
      eventSource.addEventListener('transaction', (event) => {
        try {
          const transactionData = JSON.parse(event.data);
          const blockchainEvent: BlockchainEvent = {
            type: 'transaction',
            timestamp: Date.now(),
            data: transactionData
          };
          
          console.log('[SSE] Received transaction event:', blockchainEvent);
          
          if (isMountedRef.current) {
            setEvents(prev => {
              const newEvents = [blockchainEvent, ...prev].slice(0, maxEvents);
              return newEvents;
            });
          }
          
          onEvent?.(blockchainEvent);
        } catch (parseError) {
          console.error('[SSE] Failed to parse transaction event:', parseError);
        }
      });

      // Listen for block events
      eventSource.addEventListener('block', (event) => {
        try {
          const blockData = JSON.parse(event.data);
          const blockchainEvent: BlockchainEvent = {
            type: 'block',
            timestamp: Date.now(),
            data: blockData
          };
          
          console.log('[SSE] Received block event:', blockchainEvent);
          
          if (isMountedRef.current) {
            setEvents(prev => {
              const newEvents = [blockchainEvent, ...prev].slice(0, maxEvents);
              return newEvents;
            });
          }
          
          onEvent?.(blockchainEvent);
        } catch (parseError) {
          console.error('[SSE] Failed to parse block event:', parseError);
        }
      });

      // Store the EventSource connection
      wsRef.current = eventSource;

    } catch (connectError) {
      console.error('[SSE] Failed to create connection:', connectError);
      setError('Failed to create SSE connection');
      setConnectionStatus('error');
      onError?.(connectError as Error);
    }
  }, [clientId, maxEvents, onEvent, onError, onConnect]);

  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;

    // Close existing connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (error) {
        console.warn('[SSE] Error closing existing connection:', error);
      }
    }

    setConnectionStatus('authenticating');
    
    // First start monitoring to create the server-side client
    console.log('[SSE] Starting monitoring...');
    const monitoringStarted = await startMonitoring();
    
    if (monitoringStarted) {
      // Create the SSE connection
      createSSEConnection();
    } else {
      setError('Failed to start monitoring');
      setConnectionStatus('error');
    }
  }, [startMonitoring, createSSEConnection]);

  const disconnect = useCallback(() => {
    console.log(`[SSE] Disconnecting client ${clientId}...`);
    
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close SSE connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (error) {
        console.warn('[SSE] Error closing SSE connection:', error);
      }
      wsRef.current = null;
    }

    // Clear auth token
    authTokenRef.current = null;

    if (isMountedRef.current) {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
    
    reconnectAttempts.current = 0;
    onDisconnect?.();
  }, [clientId, onDisconnect]);

  const clearEvents = useCallback(() => {
    if (isMountedRef.current) {
      setEvents([]);
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
  }, [autoConnect, connect, disconnect]);

  return {
    events,
    isConnected,
    error,
    connect,
    disconnect,
    clearEvents,
    connectionStatus
  };
}

// Legacy export for backward compatibility - DEPRECATED: Use useSSEStream instead
export const useWebSocketStream = useSSEStream;