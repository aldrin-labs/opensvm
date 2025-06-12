'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { getConnection } from '@/lib/solana';
import { useSSEAlerts } from '@/lib/hooks/useSSEAlerts';

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

interface LiveMonitorProps {
  maxEvents?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function LiveEventMonitor({ 
  maxEvents = 100, 
  autoRefresh = true, 
  refreshInterval = 5000 // Reduced to 5s for more real-time feel
}: LiveMonitorProps) {
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const connectionRef = useRef<any>(null);
  const eventCountRef = useRef(0);
  const clientId = useRef(`client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Use SSE for anomaly alerts instead of polling
  const {
    alerts,
    systemStatus,
    isConnected: sseConnected,
    error: sseError,
    connect: connectSSE,
    disconnect: disconnectSSE,
    clearAlerts
  } = useSSEAlerts({
    clientId: clientId.current,
    autoConnect: true,
    maxAlerts: 50,
    onAlert: (alert) => {
      console.log('Received real-time anomaly alert:', alert);
    },
    onStatusUpdate: (status) => {
      console.log('System status update:', status);
    },
    onError: (error) => {
      console.error('SSE error:', error);
    }
  });

  // System programs to filter out
  const SYSTEM_PROGRAMS = new Set([
    'Vote111111111111111111111111111111111111111', // Vote program
    '11111111111111111111111111111111', // System program  
    'ComputeBudget111111111111111111111111111111', // Compute budget program
    'AddressLookupTab1e1111111111111111111111111', // Address lookup table program
    'Config1111111111111111111111111111111111111', // Config program
    'Stake11111111111111111111111111111111111111', // Stake program
  ]);

  // Known programs to highlight
  const KNOWN_PROGRAMS = {
    raydium: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv'],
    meteora: ['Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'],
    aldrin: ['AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6'],
    pumpswap: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'],
  };

  // Connect to real Solana blockchain data
  const connectToSolana = useCallback(async () => {
    try {
      setConnectionError(null);
      connectionRef.current = await getConnection();
      setIsConnected(true);
      console.log('Connected to Solana RPC for real-time monitoring');
      
      // Get initial slot
      const currentSlot = await connectionRef.current.getSlot();
      setLastSlot(currentSlot);
      
    } catch (error) {
      console.error('Failed to connect to Solana:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnected(false);
    }
  }, []);

  // Fetch real blockchain events
  const fetchRealtimeEvents = useCallback(async () => {
    if (!connectionRef.current || !isConnected) return;

    try {
      const currentSlot = await connectionRef.current.getSlot();
      
      // Check for new blocks
      if (lastSlot && currentSlot > lastSlot) {
        const newSlots = [];
        for (let slot = lastSlot + 1; slot <= Math.min(lastSlot + 5, currentSlot); slot++) {
          newSlots.push(slot);
        }
        
        // Fetch blocks in parallel
        const blockPromises = newSlots.map(async (slot) => {
          try {
            const block = await connectionRef.current.getBlock(slot, {
              maxSupportedTransactionVersion: 0,
              transactionDetails: 'full',
              rewards: false
            });
            return { slot, block };
          } catch (error) {
            return null;
          }
        });
        
        const blockResults = await Promise.all(blockPromises);
        
        for (const result of blockResults) {
          if (!result?.block) continue;
          
          const { slot, block } = result;
          
          // Add block event
          const blockEvent: BlockchainEvent = {
            type: 'block',
            timestamp: Date.now(),
            data: {
              slot,
              blockhash: block.blockhash,
              previousBlockhash: block.previousBlockhash,
              parentSlot: block.parentSlot,
              transactions: block.transactions?.length || 0
            }
          };
          
          addEvent(blockEvent);
          
          // Process transactions in this block
          if (block.transactions) {
            for (const tx of block.transactions.slice(0, 10)) { // Limit to first 10 transactions per block
              if (!tx.transaction || !tx.meta) continue;
              
              const signature = tx.transaction.signatures[0];
              if (!signature) continue;
              
              // Get account keys for filtering
              const accountKeys = tx.transaction.message.accountKeys?.map(key => key.toString()) || [];
              
              // Filter out vote transactions and system-only transactions
              const isVoteTransaction = accountKeys.some(key => key === 'Vote111111111111111111111111111111111111111');
              const isSystemOnly = accountKeys.every(key => SYSTEM_PROGRAMS.has(key) || key.startsWith('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'));
              
              if (isVoteTransaction || isSystemOnly) continue;
              
              // Check for SPL transfers or custom programs
              const logs = tx.meta.logMessages || [];
              const isSplTransfer = logs.some(log => 
                log.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') ||
                log.includes('Program log: Instruction: Transfer')
              );
              
              const hasCustomProgram = accountKeys.some(key => 
                !SYSTEM_PROGRAMS.has(key) && 
                !key.startsWith('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
              );
              
              // Only include transactions that are SPL transfers or custom program calls
              if (!isSplTransfer && !hasCustomProgram) continue;
              
              const transactionEvent: BlockchainEvent = {
                type: 'transaction',
                timestamp: Date.now(),
                data: {
                  signature,
                  slot,
                  fee: tx.meta.fee,
                  err: tx.meta.err,
                  logs: logs,
                  knownProgram: identifyKnownProgram(accountKeys),
                  transactionType: classifyTransaction(logs, accountKeys),
                  accountKeys: accountKeys.slice(0, 5) // Limit for display
                }
              };
              
              addEvent(transactionEvent);
              processEventForAnomalies(transactionEvent);
            }
          }
        }
        
        setLastSlot(currentSlot);
      }
    } catch (error) {
      console.error('Failed to fetch realtime events:', error);
    }
  }, [lastSlot, isConnected]);

  const identifyKnownProgram = (accountKeys: string[]): string | null => {
    for (const [programName, programIds] of Object.entries(KNOWN_PROGRAMS)) {
      if (programIds.some(id => accountKeys.includes(id))) {
        return programName;
      }
    }
    return null;
  };

  const classifyTransaction = (logs: string[], accountKeys: string[]): string => {
    // Check for SPL token transfer
    if (logs.some(log => 
      log.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') ||
      log.includes('Program log: Instruction: Transfer')
    )) {
      return 'spl-transfer';
    }

    // Check for custom program calls
    if (accountKeys.some(key => !SYSTEM_PROGRAMS.has(key))) {
      return 'custom-program';
    }

    return 'other';
  };

  const addEvent = (event: BlockchainEvent) => {
    setEvents(prev => {
      const newEvents = [event, ...prev].slice(0, maxEvents);
      eventCountRef.current = newEvents.length;
      return newEvents;
    });
  };

  const processEventForAnomalies = async (event: BlockchainEvent) => {
    try {
      // Only analyze 10% of events to reduce API load (SSE will push alerts)
      if (Math.random() > 0.1) return;
      
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
        // No need to set alerts here - SSE will push them automatically
        console.log('Event analyzed for anomalies:', result);
      }
    } catch (error) {
      console.error('Failed to analyze event for anomalies:', error);
    }
  };

  // Disconnect function
  const disconnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current = null;
    }
    setIsConnected(false);
    setConnectionError(null);
    disconnectSSE(); // Disconnect SSE as well
    console.log('Disconnected from Solana monitoring');
  }, [disconnectSSE]);

  // Initial connection and polling setup
  useEffect(() => {
    connectToSolana();
    
    return () => {
      disconnect();
    };
  }, [connectToSolana, disconnect]);

  // Real-time polling for new events
  useEffect(() => {
    if (!isConnected || !autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchRealtimeEvents();
    }, refreshInterval);
    
    // Initial fetch
    fetchRealtimeEvents();
    
    return () => {
      clearInterval(interval);
    };
  }, [isConnected, autoRefresh, refreshInterval, fetchRealtimeEvents]);

  // Fetch anomaly stats periodically (but not alerts - SSE handles those)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchAnomalyStats();
      }, 60000); // Every minute for stats only
    }
    
    // Initial fetch
    fetchAnomalyStats();
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchAnomalyStats = async () => {
    try {
      // Only fetch stats - alerts come via SSE
      const statsResponse = await fetch('/api/anomaly?action=stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch anomaly stats:', error);
    }
  };

  const generateMockSignature = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getEventTypeColor = (type: string, data?: any) => {
    switch (type) {
      case 'transaction': 
        // Highlight known programs with special colors
        if (data?.knownProgram) {
          switch (data.knownProgram) {
            case 'raydium': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'meteora': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'aldrin': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'pumpswap': return 'bg-pink-100 text-pink-800 border-pink-300';
            default: return 'bg-green-100 text-green-800';
          }
        }
        // Different colors for transaction types
        if (data?.transactionType === 'spl-transfer') {
          return 'bg-emerald-100 text-emerald-800';
        }
        if (data?.transactionType === 'custom-program') {
          return 'bg-green-100 text-green-800';
        }
        return 'bg-green-100 text-green-800';
      case 'block': return 'bg-blue-100 text-blue-800';
      case 'account_change': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected to Solana' : 'Disconnected'}
              </span>
              {connectionError && (
                <span className="text-xs text-yellow-600">({connectionError})</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-blue-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-muted-foreground">
                SSE {sseConnected ? 'Connected' : 'Disconnected'}
              </span>
              {sseError && (
                <span className="text-xs text-red-600">({sseError})</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Events: {eventCountRef.current}
            </div>
            <div className="text-sm text-muted-foreground">
              Alerts: {alerts.length}
            </div>
            {lastSlot && (
              <div className="text-sm text-muted-foreground">
                Slot: {lastSlot.toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchRealtimeEvents}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={!isConnected}
            >
              Refresh
            </button>
            <button
              onClick={clearAlerts}
              className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Clear Alerts
            </button>
            <button
              onClick={isConnected ? disconnect : connectToSolana}
              className={`px-3 py-1 text-sm rounded ${
                isConnected 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live Events */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Live Events</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event, index) => (
              <div key={`${event.timestamp}-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs rounded border ${getEventTypeColor(event.type, event.data)}`}>
                    {event.type}
                    {event.data?.knownProgram && (
                      <span className="ml-1 font-semibold">({event.data.knownProgram.toUpperCase()})</span>
                    )}
                    {event.data?.transactionType && (
                      <span className="ml-1 text-xs opacity-75">
                        {event.data.transactionType === 'spl-transfer' ? 'SPL' : 'CUSTOM'}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  {event.data.err && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                      ERROR
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {event.type === 'transaction' && (
                    <div className="text-right">
                      {event.data.signature && (
                        <div>{event.data.signature.substring(0, 8)}...</div>
                      )}
                      {event.data.fee && (
                        <div>Fee: {(event.data.fee / 1000000).toFixed(6)} SOL</div>
                      )}
                    </div>
                  )}
                  {event.type === 'block' && event.data.slot && (
                    <div>Slot: {event.data.slot}</div>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {isConnected ? 'Waiting for blockchain events...' : 'Not connected to Solana'}
              </div>
            )}
          </div>
        </Card>

        {/* Anomaly Alerts - Now powered by SSE */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">
            Real-Time Anomaly Alerts 
            {sseConnected && <span className="text-xs text-green-600 ml-2">(Live SSE)</span>}
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(alert.severity)}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {alert.type.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {alert.description}
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No anomalies detected
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Statistics */}
      {stats && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Anomaly Detection Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.stats?.map((period: any) => (
              <div key={period.period} className="bg-gray-50 p-3 rounded">
                <div className="text-sm font-medium">{period.period}</div>
                <div className="text-2xl font-bold">{period.total}</div>
                <div className="text-xs text-muted-foreground">
                  Critical: {period.critical} | High: {period.high} | Medium: {period.medium}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}