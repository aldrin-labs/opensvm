'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import { Card } from '@/components/ui/card';
import { useSSEAlerts } from '@/lib/hooks/useSSEAlerts';
import { RingBuffer } from '@/lib/utils/ring-buffer';
import { VirtualTableErrorBoundary } from './VirtualTableErrorBoundary';
import { AnomalyAlertsTable } from './AnomalyAlertsTable';
import { StackedAnomalyAlerts } from './StackedAnomalyAlerts';
import { DeduplicatedEventTable } from './DeduplicatedEventTable';
import { generateSecureClientId } from '@/lib/crypto-utils';
import { createLogger } from '@/lib/debug-logger';
import { getProtocolFromProgramId, getProtocolDisplayName } from '@/lib/constants/program-ids';
import { 
  deduplicateEvents, 
  deduplicateAnomalies, 
  stackAnomaliesByType, 
  cleanupOldData,
  DeduplicatedEvent,
  DeduplicatedAnomaly,
  AnomalyStack
} from '@/lib/utils/deduplication';

// Enhanced logger for live event monitoring
import { safeGetMemoryInfo, safeCallGarbageCollector } from './transaction-graph/type-safe-utils';

const logger = createLogger('LIVE_EVENT_MONITOR');

// Performance monitoring utilities
const performanceTracker = {
  memoryUsage: () => {
    if (typeof window !== 'undefined') {
      const memory = safeGetMemoryInfo(window);
      if (memory) {
        return {
          used: Math.round(memory.usedJSHeapSize / 1048576), // MB
          total: Math.round(memory.totalJSHeapSize / 1048576), // MB
          limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
        };
      }
    }
    return null;
  },
  
  markStart: (label: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`${label}-start`);
    }
  },
  
  markEnd: (label: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label, 'measure')[0];
        return measure?.duration || 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }
};

// Aggressive throttling utility for high-frequency operations
const useAggressiveThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastCall = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingArgs = useRef<Parameters<T> | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    pendingArgs.current = args;
    const now = Date.now();
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      pendingArgs.current = null;
      return callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (pendingArgs.current) {
          lastCall.current = Date.now();
          const latestArgs = pendingArgs.current;
          pendingArgs.current = null;
          callback(...latestArgs);
        }
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]) as T;
};

// Polyfill for requestIdleCallback
const requestIdleCallbackPolyfill = (callback: () => void) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback);
  } else {
    return setTimeout(callback, 1);
  }
};

export interface BlockchainEvent {
  type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

interface EventFilters {
  showTransactions: boolean;
  showBlocks: boolean;
  showAccountChanges: boolean;
  showSuccessOnly: boolean;
  showFailedOnly: boolean;
  showSPLTransfers: boolean;
  showCustomPrograms: boolean;
  showSystemPrograms: boolean;
  showKnownPrograms: {
    raydium: boolean;
    meteora: boolean;
    aldrin: boolean;
    pumpswap: boolean;
    bonkfun: boolean;
  };
  minFee: number;
  maxFee: number;
  timeRange: string;
}

interface LiveMonitorProps {
  maxEvents?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const LiveEventMonitor = React.memo(function LiveEventMonitor({
  maxEvents = 2000, // Reduced from 10000 for better performance
  autoRefresh = true
}: LiveMonitorProps) {
  // Ultra-performance optimized state management
  const [eventQueue] = useState(() => new RingBuffer<BlockchainEvent>(maxEvents));
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [_stats, _setStats] = useState<any>(null);
  const [_connectionError, setConnectionError] = useState<string | null>(null);
  const [_lastSlot, _setLastSlot] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pendingEventCount, setPendingEventCount] = useState(0);
  
  // Mounting flag to prevent race conditions
  const isMountedRef = useRef(true);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    memoryUsage: any;
    renderTime: number;
    eventProcessingTime: number;
    totalEvents: number;
  }>({
    memoryUsage: null,
    renderTime: 0,
    eventProcessingTime: 0,
    totalEvents: 0
  });
  
  const [filters, _setFilters] = useState<EventFilters>({
    showTransactions: true,
    showBlocks: true,
    showAccountChanges: true,
    showSuccessOnly: false,
    showFailedOnly: false,
    showSPLTransfers: true,
    showCustomPrograms: true,
    showSystemPrograms: false,
    showKnownPrograms: {
      raydium: true,
      meteora: true,
      aldrin: true,
      pumpswap: true,
      bonkfun: true
    },
    minFee: 0,
    maxFee: 1000000000,
    timeRange: 'all'
  });
  
  const connectionRef = useRef<any>(null);
  const eventCountRef = useRef(0);
  const clientId = useRef(generateSecureClientId());
  const processingQueueRef = useRef<BlockchainEvent[]>([]);
  // @ts-ignore - May be used for memory monitoring in future
  const _lastMemoryCheck = useRef(0);
  const eventBatchRef = useRef<BlockchainEvent[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Memory monitoring with aggressive cleanup
  useEffect(() => {
    const updateMemoryMetrics = () => {
      const memory = performanceTracker.memoryUsage();
      if (memory) {
        setPerformanceMetrics(prev => ({
          ...prev,
          memoryUsage: memory,
          totalEvents: eventCountRef.current
        }));
        
        // More aggressive memory management
        if (memory.used > memory.limit * 0.7) {
          logger.warn('High memory usage detected, forcing cleanup');
          
          // Force garbage collection if available
          if (typeof window !== 'undefined') {
            safeCallGarbageCollector(window);
          }
          
          // Reduce event queue size more aggressively
          const reducedQueue = new RingBuffer<BlockchainEvent>(Math.floor(maxEvents / 3));
          const recentEvents = eventQueue.getAll().slice(-Math.floor(maxEvents / 3));
          
          recentEvents.forEach(event => reducedQueue.enqueue(event));
          setEvents(reducedQueue.getAll());
          eventCountRef.current = reducedQueue.size();
        }
      }
    };

    const interval = setInterval(updateMemoryMetrics, 3000); // More frequent monitoring
    updateMemoryMetrics();

    return () => clearInterval(interval);
  }, [maxEvents, eventQueue]);

  // Improved event processing with better responsiveness
  const processEventBatch = useAggressiveThrottle(() => {
    if (eventBatchRef.current.length === 0) return;
    
    performanceTracker.markStart('event-processing');
    
    requestIdleCallbackPolyfill(() => {
      const batch = eventBatchRef.current.splice(0, 30); // Increased from 20 for better throughput
      
      if (isPaused) {
        // If paused, just count pending events
        setPendingEventCount(prev => prev + batch.length);
        return;
      }
      
      batch.forEach(event => {
        eventQueue.enqueue(event);
      });
      
      // Use startTransition for non-urgent updates
      startTransition(() => {
        setEvents(eventQueue.getAll());
        eventCountRef.current = eventQueue.size();
      });
      
      const processingTime = performanceTracker.markEnd('event-processing');
      startTransition(() => {
        setPerformanceMetrics(prev => ({
          ...prev,
          eventProcessingTime: processingTime
        }));
      });
    });
  }, 500); // Reduced from 1000ms to 500ms for better responsiveness

  // Improved event addition with faster processing for both transactions and blocks
  const addEvent = useCallback((event: BlockchainEvent) => {
    // Check if component is still mounted to prevent race conditions
    if (!isMountedRef.current) return;
    
    // Log to debug what events we're receiving
    logger.debug(`Received ${event.type} event:`, event.type === 'transaction' ? event.data?.signature : event.data?.slot);
    
    eventBatchRef.current.push(event);
    
    // Process smaller batches more frequently for better responsiveness
    if (eventBatchRef.current.length >= 5) { // Reduced from 10
      processEventBatch();
    } else {
      // Clear existing timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      // Faster timeout for batch processing
      batchTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          processEventBatch();
        }
      }, 100); // Reduced from 300ms for faster processing
    }
  }, [processEventBatch]);

  // Ultra-aggressive memory cleanup
  useEffect(() => {
    const checkMemoryPressure = () => {
      const memory = performanceTracker.memoryUsage();
      if (memory && memory.used > memory.limit * 0.6) {
        logger.warn('Memory pressure detected, aggressive cleanup');
        
        // Much more aggressive cleanup
        const reducedQueue = new RingBuffer<BlockchainEvent>(Math.floor(maxEvents / 4));
        const recentEvents = eventQueue.getAll().slice(-Math.floor(maxEvents / 4));
        
        // Clear processing queue
        eventBatchRef.current = [];
        
        recentEvents.forEach(event => reducedQueue.enqueue(event));
        
        startTransition(() => {
          setEvents(reducedQueue.getAll());
          eventCountRef.current = reducedQueue.size();
        });
        
        // Force browser cleanup
        if (typeof window !== 'undefined') {
          safeCallGarbageCollector(window);
        }
      }
    };

    const interval = setInterval(checkMemoryPressure, 5000); // More frequent checks
    return () => clearInterval(interval);
  }, [maxEvents, eventQueue]);

  // System programs to filter out (memoized to prevent dependency changes)
  const SYSTEM_PROGRAMS = useMemo(() => new Set([
    'Vote111111111111111111111111111111111111111',
    '11111111111111111111111111111111',
    'ComputeBudget111111111111111111111111111111',
    'AddressLookupTab1e1111111111111111111111111',
    'Config1111111111111111111111111111111111111',
    'Stake11111111111111111111111111111111111111',
  ]), []);

  // Stable callbacks for SSE hook to prevent reconnection loops
  const handleAlert = useCallback((alert: any) => {
    logger.debug('Received real-time anomaly alert:', alert);
  }, []);

  const handleStatusUpdate = useCallback((status: any) => {
    logger.debug('System status update:', status);
  }, []);

  const handleBlockchainEvent = useCallback((event: BlockchainEvent) => {
    // Process blockchain events through our existing pipeline
    addEvent(event);
  }, [addEvent]);

  const handleError = useCallback((error: Error) => {
    logger.error('SSE error:', error);
    setConnectionError(error.message);
  }, []);

  // Consolidated SSE connection for both events and alerts
  const sseHookResult = useSSEAlerts({
    clientId: clientId.current,
    autoConnect: true,
    maxAlerts: 50,
    onAlert: handleAlert,
    onStatusUpdate: handleStatusUpdate,
    onBlockchainEvent: handleBlockchainEvent,
    onError: handleError
  });

  // Safely destructure with fallbacks to prevent undefined references
  const {
    alerts = [],
    systemStatus: _systemStatus = null,
    isConnected: sseConnected = false,
    error: sseError = null,
    connect: connectSSE = () => {},
    disconnect: disconnectSSE = () => {},
    clearAlerts = () => {}
  } = sseHookResult || {};

  // Enhanced state management with deduplication
  const [deduplicatedEvents, setDeduplicatedEvents] = useState<DeduplicatedEvent[]>([]);
  const [deduplicatedAnomalies, setDeduplicatedAnomalies] = useState<DeduplicatedAnomaly[]>([]);
  const [anomalyStacks, setAnomalyStacks] = useState<AnomalyStack[]>([]);
  const [_selectedAnomalyStack, _setSelectedAnomalyStack] = useState<AnomalyStack | null>(null);
  const [showStackedView, setShowStackedView] = useState(true);

  // Process deduplication when events or alerts change
  useEffect(() => {
    const processDeduplication = () => {
      // Deduplicate events
      const dedupedEvents = deduplicateEvents(events);
      setDeduplicatedEvents(dedupedEvents);

      // Deduplicate anomalies
      const dedupedAnomalies = deduplicateAnomalies(alerts);
      setDeduplicatedAnomalies(dedupedAnomalies);

      // Create anomaly stacks
      const stacks = stackAnomaliesByType(dedupedAnomalies);
      setAnomalyStacks(stacks);

      // Cleanup old data
      const cleanedEvents = cleanupOldData(dedupedEvents, 24 * 60 * 60 * 1000, 500);
      const cleanedAnomalies = cleanupOldData(dedupedAnomalies, 24 * 60 * 60 * 1000, 100);
      
      if (cleanedEvents.length !== dedupedEvents.length || cleanedAnomalies.length !== dedupedAnomalies.length) {
        setDeduplicatedEvents(cleanedEvents);
        setDeduplicatedAnomalies(cleanedAnomalies);
        setAnomalyStacks(stackAnomaliesByType(cleanedAnomalies));
      }
    };

    // Use requestIdleCallback for better performance
    requestIdleCallbackPolyfill(() => {
      processDeduplication();
    });
  }, [events, alerts]);

  // Set connection state based on SSE connection (remove redundant WebSocket)
  useEffect(() => {
    setIsConnected(sseConnected);
    if (sseConnected) {
      setConnectionError(null);
      logger.debug('Connected to Solana RPC for real-time monitoring');
    } else {
      logger.debug('Disconnected from Solana monitoring');
    }
  }, [sseConnected]);

  // Utility functions for event classification (currently unused)
  // @ts-ignore - May be used for event classification in future
  const __identifyKnownProgram = useCallback((accountKeys: string[]): string | null => {
    for (const accountKey of accountKeys) {
      const protocol = getProtocolFromProgramId(accountKey);
      if (protocol) {
        return getProtocolDisplayName(protocol);
      }
    }
    return null;
  }, []);

  // @ts-ignore - May be used for transaction classification in future
  const __classifyTransaction = useCallback((logs: string[], accountKeys: string[]): string => {
    if (logs.some(log =>
      log.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') ||
      log.includes('Program log: Instruction: Transfer')
    )) {
      return 'spl-transfer';
    }

    if (accountKeys.some(key => !SYSTEM_PROGRAMS.has(key))) {
      return 'custom-program';
    }

    return 'other';
  }, [SYSTEM_PROGRAMS]);

  // Ultra-throttled anomaly processing (currently unused)
  // @ts-ignore - May be used for anomaly processing in future
  const __processEventForAnomaliesThrottled = useAggressiveThrottle(useCallback(async (event: BlockchainEvent) => {
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
        logger.debug('Event analyzed for anomalies:', result);
      }
    } catch (error) {
      // Silently handle errors to avoid console spam
    }
  }, []), 10000); // Increased from 2000ms to 10000ms

  const disconnect = useCallback(() => {
    // Check if component is still mounted to prevent race conditions
    if (!isMountedRef.current) return;
    
    // Clear timeouts first to prevent any new operations
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = undefined;
    }

    // Clear connection safely
    if (connectionRef.current) {
      connectionRef.current = null;
    }

    // Clear processing queues
    eventBatchRef.current = [];
    processingQueueRef.current = [];

    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setIsConnected(false);
      setConnectionError(null);
    }
    
    try {
      disconnectSSE();
    } catch (error) {
      // Silently handle SSE disconnection errors
    }
    
    logger.debug('Disconnected from Solana monitoring');
  }, [disconnectSSE]);

  // Connection cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Define fetchAnomalyStatsThrottled before using it in useEffect
  const fetchAnomalyStatsThrottled = useAggressiveThrottle(useCallback(async () => {
    try {
      const statsResponse = await fetch('/api/anomaly?action=stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          startTransition(() => {
            _setStats(statsData.data);
          });
        }
      }
    } catch (error) {
      // Silently handle errors for better performance
    }
  }, []), 300000); // Increased from 60000ms to 300000ms (5 minutes)

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      // Much less frequent anomaly stats
      interval = setInterval(() => {
        fetchAnomalyStatsThrottled();
      }, 600000); // Every 10 minutes instead of 5
    }
    
    fetchAnomalyStatsThrottled();
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchAnomalyStatsThrottled]);

  // Cleanup on unmount with proper race condition prevention
  useEffect(() => {
    return () => {
      // Mark component as unmounted first
      isMountedRef.current = false;
      
      // Clear all timeouts first
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = undefined;
      }
      
      // Clear processing queues
      eventBatchRef.current = [];
      processingQueueRef.current = [];
      
      // Disconnect properly
      disconnect();
    };
  }, [disconnect]);

  // Ultra-optimized filtering with aggressive memoization and performance limits
  const filteredEvents = useMemo(() => {
    performanceTracker.markStart('filter-events');
    
    const now = Date.now();
    let timeThreshold = 0;
    
    switch (filters.timeRange) {
      case '1h': timeThreshold = now - (60 * 60 * 1000); break;
      case '6h': timeThreshold = now - (6 * 60 * 60 * 1000); break;
      case '24h': timeThreshold = now - (24 * 60 * 60 * 1000); break;
      default: timeThreshold = 0;
    }
    
    // Use deduplicated events for better performance
    const maxEventsToFilter = 500;
    const eventsToFilter = deduplicatedEvents.length > maxEventsToFilter 
      ? deduplicatedEvents.slice(0, maxEventsToFilter) 
      : deduplicatedEvents;
    
    const filtered = eventsToFilter.filter(event => {
      // Basic time filtering
      if (timeThreshold > 0 && event.timestamp < timeThreshold) return false;
      
      // Type filtering
      if (!filters.showTransactions && event.type === 'transaction') return false;
      if (!filters.showBlocks && event.type === 'block') return false;
      if (!filters.showAccountChanges && event.type === 'account_change') return false;
      
      // Transaction-specific filtering
      if (event.type === 'transaction' && event.data) {
        // Status filtering
        if (filters.showSuccessOnly && event.data.err) return false;
        if (filters.showFailedOnly && !event.data.err) return false;
        
        // Fee filtering
        if (event.data.fee) {
          if (event.data.fee < filters.minFee || event.data.fee > filters.maxFee) return false;
        }
        
        // Program type filtering
        const isSystemProgram = event.data.accountKeys?.some((key: string) => 
          SYSTEM_PROGRAMS.has(key)
        );
        const isSPLTransfer = event.data.transactionType === 'spl-transfer';
        const isCustomProgram = event.data.transactionType === 'custom-program';
        
        if (!filters.showSystemPrograms && isSystemProgram) return false;
        if (!filters.showSPLTransfers && isSPLTransfer) return false;
        if (!filters.showCustomPrograms && isCustomProgram) return false;
        
        // Known program filtering
        if (event.data.knownProgram) {
          const program = event.data.knownProgram as keyof EventFilters['showKnownPrograms'];
          if (!filters.showKnownPrograms[program]) return false;
        }
      }
      
      return true;
    });

    const filterTime = performanceTracker.markEnd('filter-events');
    
    // Update performance metrics in next render cycle
    requestIdleCallbackPolyfill(() => {
      startTransition(() => {
        setPerformanceMetrics(prev => ({
          ...prev,
          renderTime: filterTime
        }));
      });
    });
    
    return filtered;
  }, [deduplicatedEvents, filters, SYSTEM_PROGRAMS]);

  // Ultra-optimized event counts with sampling for large datasets
  const eventCounts = useMemo(() => {
    const counts = {
      transactions: 0,
      blocks: 0,
      accountChanges: 0,
      total: filteredEvents.length
    };
    
    // Use sampling for any dataset over 100 events
    if (filteredEvents.length <= 100) {
      filteredEvents.forEach(event => {
        switch (event.type) {
          case 'transaction': counts.transactions++; break;
          case 'block': counts.blocks++; break;
          case 'account_change': counts.accountChanges++; break;
        }
      });
    } else {
      // Use more aggressive sampling for better performance
      const sampleSize = Math.min(50, filteredEvents.length); // Reduced from 100
      const ratio = filteredEvents.length / sampleSize;
      
      for (let i = 0; i < sampleSize; i++) {
        const event = filteredEvents[Math.floor(i * ratio)];
        switch (event.type) {
          case 'transaction': counts.transactions += ratio; break;
          case 'block': counts.blocks += ratio; break;
          case 'account_change': counts.accountChanges += ratio; break;
        }
      }
      
      counts.transactions = Math.round(counts.transactions);
      counts.blocks = Math.round(counts.blocks);
      counts.accountChanges = Math.round(counts.accountChanges);
    }
    
    return counts;
  }, [filteredEvents]);

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }, []);

  // @ts-ignore - May be used for event click handling in future
  const __handleEventClick = useCallback((event: BlockchainEvent) => {
    if (event.type === 'transaction' && event.data?.signature) {
      const url = `/tx/${event.data.signature}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (event.type === 'block' && event.data?.slot) {
      const url = `/block/${event.data.slot}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleAddressClick = useCallback((address: string) => {
    const url = `/account/${address}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // New handlers for deduplicated components
  const handleDeduplicatedEventClick = useCallback((event: DeduplicatedEvent) => {
    if (event.type === 'transaction' && event.signature) {
      const url = `/tx/${event.signature}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (event.type === 'block' && event.data?.slot) {
      const url = `/block/${event.data.slot}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleAnomalyClick = useCallback((anomaly: DeduplicatedAnomaly) => {
    _setSelectedAnomalyStack(null);
    // Open anomaly profile in new tab
    const url = `/anomaly/${anomaly.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleStackToggle = useCallback((type: string, expanded: boolean) => {
    setAnomalyStacks(prev => prev.map(stack => 
      stack.type === type ? { ...stack, expanded } : stack
    ));
  }, []);

  const toggleStackedView = useCallback(() => {
    setShowStackedView(prev => !prev);
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;
      if (!newPaused && pendingEventCount > 0) {
        // Resume and process pending events
        setPendingEventCount(0);
        processEventBatch();
      }
      return newPaused;
    });
  }, [pendingEventCount, processEventBatch]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const clearEvents = useCallback(() => {
    eventQueue.clear();
    setEvents([]);
    eventCountRef.current = 0;
  }, [eventQueue]);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <h1 className="text-2xl font-bold text-foreground">Real-Time Blockchain Monitoring</h1>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Exit Fullscreen
          </button>
        </div>
        
        {/* Fullscreen Content */}
        <div className="flex-1 p-4 overflow-hidden">
          <VirtualTableErrorBoundary>
            <DeduplicatedEventTable 
              events={filteredEvents}
              onEventClick={handleDeduplicatedEventClick}
              onAddressClick={handleAddressClick}
              height={window.innerHeight - 150}
            />
          </VirtualTableErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Real-Time Blockchain Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Live Solana events with AI-driven anomaly detection
          </p>
        </div>
        <button
          onClick={toggleFullscreen}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Fullscreen
        </button>
      </div>

      {/* Compact Status Bar with Performance Metrics */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {isPaused && (
                <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">
                  PAUSED
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-blue-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-muted-foreground">
                SSE {sseConnected ? 'On' : 'Off'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Events: {eventCountRef.current}/{maxEvents}
            </div>
            <div className="text-sm text-muted-foreground">
              Deduped: {deduplicatedEvents.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Filtered: {eventCounts.total}
            </div>
            {pendingEventCount > 0 && (
              <div className="text-sm text-orange-600 font-medium">
                Pending: {pendingEventCount}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Alerts: {alerts.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Stacks: {anomalyStacks.length}
            </div>
            {_lastSlot && (
              <div className="text-sm text-muted-foreground">
                Slot: {_lastSlot.toLocaleString()}
              </div>
            )}
            {performanceMetrics.memoryUsage && (
              <div className="text-xs text-muted-foreground">
                RAM: {performanceMetrics.memoryUsage.used}MB
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={togglePause}
              className={`px-3 py-1 text-sm rounded hover:opacity-80 ${
                isPaused 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={sseConnected ? disconnectSSE : connectSSE}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={!sseConnected && !!sseError}
            >
              {sseError ? 'Error' : sseConnected ? 'Disconnect' : 'Connect'}
            </button>
            <button
              onClick={clearAlerts}
              className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Clear Alerts
            </button>
            <button
              onClick={clearEvents}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Events
            </button>
          </div>
        </div>
        
        {/* Performance Metrics Bar */}
        {performanceMetrics.memoryUsage && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>Performance Metrics:</div>
              <div className="flex space-x-4">
                <span>Memory: {performanceMetrics.memoryUsage.used}/{performanceMetrics.memoryUsage.limit}MB</span>
                <span>Filter: {performanceMetrics.renderTime.toFixed(1)}ms</span>
                <span>Processing: {performanceMetrics.eventProcessingTime.toFixed(1)}ms</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 h-[calc(100vh-300px)]">
        {/* Left Sidebar - Compact */}
        <div className="xl:col-span-1 space-y-4 overflow-y-auto">
          {/* <PumpStatistics events={filteredEvents} /> */}
          {/* <EventFilterControls
            filters={filters}
            onFiltersChange={setFilters}
            eventCounts={eventCounts}
          /> */}
          
          {/* Recent Anomaly Alerts - Compact */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">
                Recent Alerts
                {sseConnected && <span className="text-xs text-green-600 ml-1">(Live)</span>}
              </h4>
              <div className="text-xs text-muted-foreground">
                {Math.min(alerts.length, 3)}
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="p-2 border rounded-sm">
                  <div className="flex items-center justify-between">
                    <span className={`px-1 py-0.5 text-xs rounded ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs font-medium mt-1">
                    {alert.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center text-muted-foreground py-2 text-xs">
                  No recent alerts
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Main Content - Events and Anomalies */}
        <div className="xl:col-span-3 flex flex-col h-full">
          {/* Live Events Table - Fixed Height */}
          <Card className="p-4 mb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Live Events (Deduplicated)</h3>
              <div className="text-sm text-muted-foreground">
                {filteredEvents.length} events • Duplicates removed
              </div>
            </div>
            <VirtualTableErrorBoundary>
              <DeduplicatedEventTable 
                events={filteredEvents}
                onEventClick={handleDeduplicatedEventClick}
                onAddressClick={handleAddressClick}
                height={400}
              />
            </VirtualTableErrorBoundary>
          </Card>

          {/* All Anomaly Alerts - Takes Remaining Height */}
          <Card className="p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">
                {showStackedView ? 'Anomaly Stacks' : 'All Anomaly Alerts'}
                {sseConnected && <span className="text-xs text-green-600 ml-2">(Live)</span>}
              </h3>
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleStackedView}
                  className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                >
                  {showStackedView ? 'Show All' : 'Stack by Type'}
                </button>
                <div className="text-sm text-muted-foreground">
                  {showStackedView ? 
                    `${anomalyStacks.length} stacks • ${deduplicatedAnomalies.length} total` : 
                    `${alerts.length} alerts`
                  }
                </div>
              </div>
            </div>
            
            {showStackedView ? (
              <StackedAnomalyAlerts
                stacks={anomalyStacks}
                onAnomalyClick={handleAnomalyClick}
                onStackToggle={handleStackToggle}
              />
            ) : (
              <AnomalyAlertsTable alerts={alerts} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
});