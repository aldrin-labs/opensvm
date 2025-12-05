/**
 * useMiningEvents Hook
 *
 * React hook for subscribing to real-time mining events via Server-Sent Events.
 *
 * @example
 * ```tsx
 * function MiningDashboard() {
 *   const {
 *     isConnected,
 *     events,
 *     stats,
 *     error,
 *   } = useMiningEvents({
 *     types: ['reward_minted', 'challenge_completed'],
 *     onEvent: (event) => console.log('New event:', event),
 *   });
 *
 *   return (
 *     <div>
 *       <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
 *       <p>Events received: {events.length}</p>
 *       {events.map(e => <EventCard key={e.id} event={e} />)}
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export type MiningEventType =
  | 'challenge_created'
  | 'challenge_completed'
  | 'challenge_expired'
  | 'reward_minted'
  | 'tokens_staked'
  | 'tokens_transferred'
  | 'leaderboard_update'
  | 'network_stats'
  | 'pouw_work_created'
  | 'pouw_work_submitted'
  | 'pouw_work_accepted'
  | 'pouw_work_rejected'
  | 'worker_joined'
  | 'worker_milestone'
  | 'epoch_change'
  | 'halving_approaching'
  | 'heartbeat';

export interface MiningEvent {
  id: string;
  type: MiningEventType;
  timestamp: number;
  data: any;
  metadata?: {
    serverId?: string;
    workerId?: string;
    challengeId?: string;
    reward?: string;
    quality?: number;
  };
}

export interface MiningStats {
  totalRewards: number;
  challengesCompleted: number;
  eventsReceived: number;
  connectionUptime: number;
  lastEventAt: number | null;
}

export interface UseMiningEventsOptions {
  /** Event types to subscribe to (empty = all) */
  types?: MiningEventType[];
  /** Filter events for specific server */
  serverId?: string;
  /** Minimum reward to receive events for */
  minReward?: number;
  /** Maximum events to keep in state */
  maxEvents?: number;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Callback when event received */
  onEvent?: (event: MiningEvent) => void;
  /** Callback when connected */
  onConnect?: () => void;
  /** Callback when disconnected */
  onDisconnect?: (error?: Error) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseMiningEventsReturn {
  /** Current connection state */
  isConnected: boolean;
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;
  /** Recent events (newest first) */
  events: MiningEvent[];
  /** Aggregated statistics */
  stats: MiningStats;
  /** Last error if any */
  error: Error | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Clear events history */
  clearEvents: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMiningEvents(
  options: UseMiningEventsOptions = {}
): UseMiningEventsReturn {
  const {
    types = [],
    serverId,
    minReward,
    maxEvents = 100,
    autoReconnect = true,
    reconnectDelay = 3000,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [events, setEvents] = useState<MiningEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<MiningStats>({
    totalRewards: 0,
    challengesCompleted: 0,
    eventsReceived: 0,
    connectionUptime: 0,
    lastEventAt: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Build URL with filters
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (types.length > 0) {
      params.set('types', types.join(','));
    }
    if (serverId) {
      params.set('serverId', serverId);
    }
    if (minReward !== undefined) {
      params.set('minReward', minReward.toString());
    }
    const queryString = params.toString();
    return `/api/mcp/mining/stream${queryString ? `?${queryString}` : ''}`;
  }, [types, serverId, minReward]);

  // Handle incoming event
  const handleEvent = useCallback((event: MiningEvent) => {
    if (!mountedRef.current) return;

    setEvents(prev => {
      const newEvents = [event, ...prev].slice(0, maxEvents);
      return newEvents;
    });

    setStats(prev => ({
      ...prev,
      eventsReceived: prev.eventsReceived + 1,
      lastEventAt: Date.now(),
      totalRewards: event.type === 'reward_minted' && event.data?.amountUi
        ? prev.totalRewards + event.data.amountUi
        : prev.totalRewards,
      challengesCompleted: ['challenge_completed', 'pouw_work_accepted'].includes(event.type)
        ? prev.challengesCompleted + 1
        : prev.challengesCompleted,
    }));

    onEvent?.(event);
  }, [maxEvents, onEvent]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = buildUrl();
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setIsReconnecting(false);
      setError(null);
      connectedAtRef.current = Date.now();
      onConnect?.();
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      const err = new Error('SSE connection error');
      setError(err);
      setIsConnected(false);
      onError?.(err);
      onDisconnect?.(err);

      if (autoReconnect) {
        setIsReconnecting(true);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, reconnectDelay);
      }
    };

    // Register event listeners for each event type
    const allTypes: MiningEventType[] = [
      'challenge_created',
      'challenge_completed',
      'challenge_expired',
      'reward_minted',
      'tokens_staked',
      'tokens_transferred',
      'leaderboard_update',
      'network_stats',
      'pouw_work_created',
      'pouw_work_submitted',
      'pouw_work_accepted',
      'pouw_work_rejected',
      'worker_joined',
      'worker_milestone',
      'epoch_change',
      'halving_approaching',
      'heartbeat',
    ];

    for (const eventType of allTypes) {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data) as MiningEvent;
          handleEvent(event);
        } catch (err) {
          console.error('[useMiningEvents] Failed to parse event:', err);
        }
      });
    }

    return eventSource;
  }, [buildUrl, handleEvent, autoReconnect, reconnectDelay, onConnect, onDisconnect, onError]);

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setIsReconnecting(false);
    onDisconnect?.();
  }, [onDisconnect]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
    setStats(prev => ({
      ...prev,
      eventsReceived: 0,
      totalRewards: 0,
      challengesCompleted: 0,
    }));
  }, []);

  // Update connection uptime
  useEffect(() => {
    if (!isConnected || !connectedAtRef.current) return;

    const interval = setInterval(() => {
      if (connectedAtRef.current) {
        setStats(prev => ({
          ...prev,
          connectionUptime: Math.floor((Date.now() - connectedAtRef.current!) / 1000),
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isReconnecting,
    events,
    stats,
    error,
    reconnect,
    disconnect,
    clearEvents,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for just watching the leaderboard
 */
export function useLeaderboard() {
  const { events } = useMiningEvents({
    types: ['leaderboard_update'],
    maxEvents: 1,
  });

  const latestLeaderboard = events[0]?.data?.topMiners || [];

  return {
    leaderboard: latestLeaderboard,
    lastUpdated: events[0]?.timestamp || null,
  };
}

/**
 * Hook for watching rewards for a specific address
 */
export function useMyRewards(serverId: string) {
  const [totalRewards, setTotalRewards] = useState(0);
  const [recentRewards, setRecentRewards] = useState<MiningEvent[]>([]);

  const { events, isConnected } = useMiningEvents({
    types: ['reward_minted', 'challenge_completed', 'pouw_work_accepted'],
    serverId,
    maxEvents: 50,
    onEvent: (event) => {
      if (event.metadata?.serverId === serverId && event.data?.rewardUi) {
        setTotalRewards(prev => prev + event.data.rewardUi);
        setRecentRewards(prev => [event, ...prev].slice(0, 10));
      }
    },
  });

  return {
    totalRewards,
    recentRewards,
    isConnected,
    allEvents: events,
  };
}

/**
 * Hook for network stats
 */
export function useNetworkStats() {
  const [networkStats, setNetworkStats] = useState<any>(null);

  useMiningEvents({
    types: ['network_stats'],
    maxEvents: 1,
    onEvent: (event) => {
      if (event.type === 'network_stats') {
        setNetworkStats(event.data);
      }
    },
  });

  return networkStats;
}

export default useMiningEvents;
