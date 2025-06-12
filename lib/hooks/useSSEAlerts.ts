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

interface UseSSEAlertsOptions {
  clientId?: string;
  autoConnect?: boolean;
  maxAlerts?: number;
  onAlert?: (alert: AnomalyAlert) => void;
  onStatusUpdate?: (status: SystemStatus) => void;
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

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      console.log(`[SSE] Connecting client ${clientId}...`);
      const eventSource = new EventSource(`/api/sse-alerts?clientId=${encodeURIComponent(clientId)}&action=connect`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[SSE] Connected client ${clientId}`);
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error:', event);
        setIsConnected(false);
        
        const errorMsg = 'SSE connection failed';
        setError(errorMsg);
        onError?.(new Error(errorMsg));

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
          setError('Failed to establish SSE connection after multiple attempts');
        }
      };

      // Listen for anomaly alerts
      eventSource.addEventListener('anomaly_alert', (event) => {
        try {
          const alert: AnomalyAlert = JSON.parse(event.data);
          console.log('[SSE] Received anomaly alert:', alert);
          
          setAlerts(prev => {
            const newAlerts = [alert, ...prev].slice(0, maxAlerts);
            return newAlerts;
          });
          
          onAlert?.(alert);
        } catch (parseError) {
          console.error('[SSE] Failed to parse anomaly alert:', parseError);
        }
      });

      // Listen for system status updates
      eventSource.addEventListener('system_status', (event) => {
        try {
          const status: SystemStatus = JSON.parse(event.data);
          console.log('[SSE] Received system status:', status);
          setSystemStatus(status);
          onStatusUpdate?.(status);
        } catch (parseError) {
          console.error('[SSE] Failed to parse system status:', parseError);
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
      onError?.(connectError as Error);
    }
  }, [clientId, maxAlerts, onAlert, onStatusUpdate, onError]);

  const disconnect = useCallback(() => {
    console.log(`[SSE] Disconnecting client ${clientId}...`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, [clientId]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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