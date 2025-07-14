import { useEffect, useState, useCallback } from 'react';

interface BlockchainEvent {
  type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

interface AnomalyAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  event: BlockchainEvent;
  timestamp: number;
}

interface UseBlockchainStreamOptions {
  autoStart?: boolean;
  onEvent?: (event: BlockchainEvent) => void;
  onAnomaly?: (alert: AnomalyAlert) => void;
  maxEvents?: number;
}

interface StreamState {
  events: BlockchainEvent[];
  alerts: AnomalyAlert[];
  isConnected: boolean;
  error: string | null;
}

export function useBlockchainStream(options: UseBlockchainStreamOptions = {}) {
  const {
    autoStart = true,
    onEvent,
    onAnomaly,
    maxEvents = 100
  } = options;

  const [state, setState] = useState<StreamState>({
    events: [],
    alerts: [],
    isConnected: false,
    error: null
  });

  const processEvent = useCallback(async (event: BlockchainEvent) => {
    // Add event to state
    setState(prev => ({
      ...prev,
      events: [event, ...prev.events].slice(0, maxEvents)
    }));

    // Call user callback
    onEvent?.(event);

    // Send event for anomaly detection
    try {
      const response = await fetch('/api/anomaly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze',
          event
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.alerts?.length > 0) {
          const newAlerts = result.data.alerts;
          
          setState(prev => ({
            ...prev,
            alerts: [...newAlerts, ...prev.alerts].slice(0, 50) // Keep last 50 alerts
          }));

          // Call anomaly callback for each alert
          newAlerts.forEach((alert: AnomalyAlert) => {
            onAnomaly?.(alert);
          });
        }
      }
    } catch (error) {
      console.error('Failed to analyze event for anomalies:', error);
    }
  }, [maxEvents, onEvent, onAnomaly]);

  const connect = useCallback(() => {
    // For this implementation, we'll use a simple polling mechanism
    // In a real implementation, this would use WebSockets
    
    setState(prev => ({ ...prev, isConnected: true, error: null }));
    
    // This is a mock implementation - in reality you'd connect to WebSocket
    console.log('Mock blockchain stream connected');
  }, []);

  const disconnect = useCallback(() => {
    setState(prev => ({ ...prev, isConnected: false }));
    console.log('Mock blockchain stream disconnected');
  }, []);

  const clearEvents = useCallback(() => {
    setState(prev => ({ ...prev, events: [] }));
  }, []);

  const clearAlerts = useCallback(() => {
    setState(prev => ({ ...prev, alerts: [] }));
  }, []);

  // Auto-start connection
  useEffect(() => {
    if (autoStart) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoStart, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    clearEvents,
    clearAlerts,
    processEvent
  };
}

// Hook for fetching anomaly data
export function useAnomalyData(refreshInterval = 30000) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch alerts
      const alertsResponse = await fetch('/api/anomaly?action=alerts');
      if (!alertsResponse.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const alertsData = await alertsResponse.json();
      
      if (alertsData.success) {
        setAlerts(alertsData.data.alerts || []);
      }

      // Fetch stats
      const statsResponse = await fetch('/api/anomaly?action=stats');
      if (!statsResponse.ok) {
        throw new Error('Failed to fetch stats');
      }
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Periodic refresh
  useEffect(() => {
    fetchData();
    
    const interval = setInterval(fetchData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return {
    alerts,
    stats,
    loading,
    error,
    refresh: fetchData
  };
}