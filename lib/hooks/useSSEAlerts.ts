/**
 * React Hook for Server-Sent Events (SSE) Anomaly Alerts
 * 
 * Replaces polling with push-based real-time updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface AnomalyAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
}

interface SystemStatus {
  isMonitoring: boolean;
  clientCount: number;
  eventCount: number;
  timestamp: number;
}

interface BlockchainEvent {
  type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

interface UseSSEAlertsOptions {
  clientId?: string;
  autoConnect?: boolean;
  maxAlerts?: number;
  onAlert?: (alert: AnomalyAlert) => void;
  onStatusUpdate?: (status: SystemStatus) => void;
  onBlockchainEvent?: (event: BlockchainEvent) => void;
  onError?: (error: Error) => void;
}

interface UseSSEAlertsReturn {
  alerts: AnomalyAlert[];
  systemStatus: SystemStatus | null;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearAlerts: () => void;
}

export function useSSEAlerts(options: UseSSEAlertsOptions = {}): UseSSEAlertsReturn {
  const {
    clientId = `sse_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    autoConnect = true,
    maxAlerts = 100,
    onAlert,
    onStatusUpdate,
    onBlockchainEvent,
    onError
  } = options;

  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isMountedRef = useRef(true);
  
  // Use refs for callbacks to prevent dependency changes causing reconnections
  const onAlertRef = useRef(onAlert);
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onBlockchainEventRef = useRef(onBlockchainEvent);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onAlertRef.current = onAlert;
    onStatusUpdateRef.current = onStatusUpdate;
    onBlockchainEventRef.current = onBlockchainEvent;
    onErrorRef.current = onError;
  }, [onAlert, onStatusUpdate, onBlockchainEvent, onError]);

  const connect = useCallback(() => {
    // Safely close any existing connection first
    if (eventSourceRef.current) {
      try {
        const existingEventSource = eventSourceRef.current;
        eventSourceRef.current = null; // Clear reference first
        existingEventSource.close();
      } catch (error) {
        console.warn('[SSE] Error closing existing EventSource:', error);
      }
    }

    try {
      console.log(`[SSE] Connecting client ${clientId}...`);
      const eventSource = new EventSource(`/api/sse-alerts?clientId=${encodeURIComponent(clientId)}&action=connect`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[SSE] Connected client ${clientId}`);
        if (isMountedRef.current) {
          setIsConnected(true);
          setError(null);
        }
        reconnectAttempts.current = 0;
      };

      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error:', event);
        if (isMountedRef.current) {
          setIsConnected(false);
          
          const errorMsg = 'SSE connection failed';
          setError(errorMsg);
          onErrorRef.current?.(new Error(errorMsg));
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

      // Listen for anomaly alerts
      eventSource.addEventListener('anomaly_alert', (event) => {
        try {
          const alert: AnomalyAlert = JSON.parse(event.data);
          console.log('[SSE] Received anomaly alert:', alert);
          
          if (isMountedRef.current) {
            setAlerts(prev => {
              const newAlerts = [alert, ...prev].slice(0, maxAlerts);
              return newAlerts;
            });
          }
          
          onAlertRef.current?.(alert);
        } catch (parseError) {
          console.error('[SSE] Failed to parse anomaly alert:', parseError);
        }
      });

      // Listen for system status updates
      eventSource.addEventListener('system_status', (event) => {
        try {
          const status: SystemStatus = JSON.parse(event.data);
          console.log('[SSE] Received system status:', status);
          
          if (isMountedRef.current) {
            setSystemStatus(status);
          }
          
          onStatusUpdateRef.current?.(status);
        } catch (parseError) {
          console.error('[SSE] Failed to parse system status:', parseError);
        }
      });

      // Listen for blockchain events
      eventSource.addEventListener('blockchain_event', (event) => {
        try {
          const blockchainEvent: BlockchainEvent = JSON.parse(event.data);
          console.log('[SSE] Received blockchain event:', blockchainEvent);
          onBlockchainEventRef.current?.(blockchainEvent);
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
          onBlockchainEventRef.current?.(blockchainEvent);
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
          onBlockchainEventRef.current?.(blockchainEvent);
        } catch (parseError) {
          console.error('[SSE] Failed to parse block event:', parseError);
        }
      });

      // Listen for connection confirmation
      eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Connection confirmed:', data);
        } catch (parseError) {
          console.error('[SSE] Failed to parse connection event:', parseError);
        }
      });

    } catch (connectError) {
      console.error('[SSE] Failed to create EventSource:', connectError);
      setError('Failed to create SSE connection');
      onErrorRef.current?.(connectError as Error);
    }
  }, [clientId, maxAlerts]); // Remove callback dependencies to prevent reconnection loop

  const disconnect = useCallback(() => {
    console.log(`[SSE] Disconnecting client ${clientId}...`);
    
    // Mark as unmounted to prevent race conditions
    isMountedRef.current = false;
    
    // Clear reconnection timeout first
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Safely close EventSource with proper error handling
    if (eventSourceRef.current) {
      try {
        const eventSource = eventSourceRef.current;
        eventSourceRef.current = null; // Clear reference first to prevent race conditions
        eventSource.close();
      } catch (error) {
        // Silently handle EventSource cleanup errors to prevent console spam
        if (error instanceof Error && !error.message.includes('removeChild')) {
          console.warn('[SSE] Error during EventSource cleanup:', error);
        }
      }
    }

    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setIsConnected(false);
    }
    reconnectAttempts.current = 0;
  }, [clientId]);

  const clearAlerts = useCallback(() => {
    if (isMountedRef.current) {
      setAlerts([]);
    }
  }, []);

  // Auto-connect on mount if enabled - use stable dependencies to prevent reconnection loops
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [autoConnect]); // Remove connect/disconnect from dependencies to prevent infinite loops

  return {
    alerts,
    systemStatus,
    isConnected,
    error,
    connect,
    disconnect,
    clearAlerts
  };
}