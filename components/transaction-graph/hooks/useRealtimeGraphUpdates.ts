'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import cytoscape from 'cytoscape';

interface RealtimeTransaction {
  signature: string;
  blockTime: number;
  from: string;
  to: string;
  amount: number;
  tokenSymbol: string;
  type: string;
}

interface RealtimeState {
  isConnected: boolean;
  isSubscribed: boolean;
  subscribedAccounts: string[];
  pendingTransactions: RealtimeTransaction[];
  lastUpdate: number | null;
  error: string | null;
  stats: {
    transactionsReceived: number;
    animationsPlayed: number;
    connectionAttempts: number;
  };
}

// Solana RPC WebSocket endpoints
const MAINNET_WSS = 'wss://api.mainnet-beta.solana.com';

/**
 * Hook for real-time WebSocket graph updates
 * Subscribes to on-chain events and animates new transactions
 */
export function useRealtimeGraphUpdates() {
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isSubscribed: false,
    subscribedAccounts: [],
    pendingTransactions: [],
    lastUpdate: null,
    error: null,
    stats: {
      transactionsReceived: 0,
      animationsPlayed: 0,
      connectionAttempts: 0
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  /**
   * Connect to Solana WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({
      ...prev,
      stats: { ...prev.stats, connectionAttempts: prev.stats.connectionAttempts + 1 }
    }));

    try {
      const ws = new WebSocket(MAINNET_WSS);

      ws.onopen = () => {
        console.log('Realtime WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null
        }));

        // Re-subscribe to any accounts that were subscribed before
        state.subscribedAccounts.forEach(account => {
          subscribeToAccount(account);
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error'
        }));
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setState(prev => ({
          ...prev,
          isConnected: false,
          isSubscribed: false
        }));

        // Attempt reconnect after delay
        if (state.subscribedAccounts.length > 0) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      wsRef.current = ws;

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect to Solana network'
      }));
    }
  }, [state.subscribedAccounts]);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    subscriptionIdsRef.current.clear();

    setState(prev => ({
      ...prev,
      isConnected: false,
      isSubscribed: false,
      subscribedAccounts: [],
      error: null
    }));
  }, []);

  /**
   * Subscribe to account transactions
   */
  const subscribeToAccount = useCallback((account: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Store for later subscription when connected
      setState(prev => ({
        ...prev,
        subscribedAccounts: prev.subscribedAccounts.includes(account)
          ? prev.subscribedAccounts
          : [...prev.subscribedAccounts, account]
      }));
      return;
    }

    // Subscribe to account notifications using Solana RPC
    const subscribeMessage = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'logsSubscribe',
      params: [
        { mentions: [account] },
        { commitment: 'confirmed' }
      ]
    };

    wsRef.current.send(JSON.stringify(subscribeMessage));

    setState(prev => ({
      ...prev,
      subscribedAccounts: prev.subscribedAccounts.includes(account)
        ? prev.subscribedAccounts
        : [...prev.subscribedAccounts, account],
      isSubscribed: true
    }));

    console.log(`Subscribed to account: ${account.slice(0, 8)}...`);
  }, []);

  /**
   * Unsubscribe from account
   */
  const unsubscribeFromAccount = useCallback((account: string) => {
    const subscriptionId = subscriptionIdsRef.current.get(account);

    if (subscriptionId && wsRef.current?.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'logsUnsubscribe',
        params: [subscriptionId]
      };
      wsRef.current.send(JSON.stringify(unsubscribeMessage));
    }

    subscriptionIdsRef.current.delete(account);

    setState(prev => ({
      ...prev,
      subscribedAccounts: prev.subscribedAccounts.filter(a => a !== account),
      isSubscribed: prev.subscribedAccounts.length > 1
    }));
  }, []);

  /**
   * Handle incoming WebSocket message
   */
  const handleWebSocketMessage = useCallback((data: any) => {
    // Handle subscription confirmation
    if (data.result !== undefined && typeof data.result === 'number') {
      // Store subscription ID (we'd need to track which account this is for)
      console.log('Subscription confirmed:', data.result);
      return;
    }

    // Handle log notification
    if (data.method === 'logsNotification') {
      const notification = data.params?.result;
      if (!notification) return;

      const signature = notification.value?.signature;
      if (!signature) return;

      console.log('Received transaction notification:', signature.slice(0, 8) + '...');

      // Fetch full transaction details
      fetchAndAnimateTransaction(signature);

      setState(prev => ({
        ...prev,
        lastUpdate: Date.now(),
        stats: {
          ...prev.stats,
          transactionsReceived: prev.stats.transactionsReceived + 1
        }
      }));
    }
  }, []);

  /**
   * Fetch transaction details and animate in graph
   */
  const fetchAndAnimateTransaction = useCallback(async (signature: string) => {
    try {
      // Fetch transaction data from our API
      const response = await fetch(`/api/transaction/${signature}`);
      if (!response.ok) return;

      const txData = await response.json();

      // Add to pending transactions queue
      const realtimeTx: RealtimeTransaction = {
        signature,
        blockTime: txData.blockTime || Date.now() / 1000,
        from: txData.from || '',
        to: txData.to || '',
        amount: txData.amount || 0,
        tokenSymbol: txData.tokenSymbol || 'SOL',
        type: txData.type || 'transfer'
      };

      setState(prev => ({
        ...prev,
        pendingTransactions: [...prev.pendingTransactions, realtimeTx].slice(-50) // Keep last 50
      }));

      // Animate in graph if available
      if (cyRef.current) {
        animateNewTransaction(cyRef.current, realtimeTx);
      }

    } catch (error) {
      console.warn('Failed to fetch transaction:', signature, error);
    }
  }, []);

  /**
   * Animate a new transaction appearing in the graph
   */
  const animateNewTransaction = useCallback((cy: cytoscape.Core, tx: RealtimeTransaction) => {
    if (!tx.from || !tx.to) return;

    // Check if both accounts exist in the graph
    const fromNode = cy.getElementById(tx.from);
    const toNode = cy.getElementById(tx.to);

    if (fromNode.length === 0 && toNode.length === 0) {
      // Neither account is in the graph, skip
      return;
    }

    // Create edge for the new transaction
    const edgeId = `realtime-${tx.signature}-${tx.from}-${tx.to}`;

    // Check if edge already exists
    if (cy.getElementById(edgeId).length > 0) return;

    // Add nodes if they don't exist
    if (fromNode.length === 0) {
      cy.add({
        data: {
          id: tx.from,
          label: `${tx.from.slice(0, 5)}...${tx.from.slice(-5)}`,
          type: 'account',
          pubkey: tx.from,
          size: 15,
          color: 'hsl(var(--muted-foreground))',
          isNew: true
        },
        style: { opacity: 0 }
      });
    }

    if (toNode.length === 0) {
      cy.add({
        data: {
          id: tx.to,
          label: `${tx.to.slice(0, 5)}...${tx.to.slice(-5)}`,
          type: 'account',
          pubkey: tx.to,
          size: 15,
          color: 'hsl(var(--muted-foreground))',
          isNew: true
        },
        style: { opacity: 0 }
      });
    }

    // Add edge with animation style
    cy.add({
      data: {
        id: edgeId,
        source: tx.from,
        target: tx.to,
        type: 'account_transfer',
        fullSignature: tx.signature,
        txType: tx.type,
        amount: tx.amount,
        tokenSymbol: tx.tokenSymbol,
        isRealtime: true,
        label: `${tx.amount.toFixed(2)} ${tx.tokenSymbol}`
      },
      classes: 'realtime-edge',
      style: {
        opacity: 0,
        'line-color': 'hsl(var(--success))',
        width: 3
      }
    });

    // Animate appearance
    const newEdge = cy.getElementById(edgeId);
    const newFromNode = cy.getElementById(tx.from);
    const newToNode = cy.getElementById(tx.to);

    // Fade in nodes
    if (newFromNode.data('isNew')) {
      newFromNode.animate({
        style: { opacity: 1 },
        duration: 500,
        easing: 'ease-out'
      });
    }

    if (newToNode.data('isNew')) {
      newToNode.animate({
        style: { opacity: 1 },
        duration: 500,
        easing: 'ease-out'
      });
    }

    // Animate edge with pulse effect
    newEdge.animate({
      style: { opacity: 1 },
      duration: 300,
      easing: 'ease-out'
    }).promise().then(() => {
      // Pulse animation
      newEdge.animate({
        style: { width: 6, 'line-color': 'hsl(var(--chart-2))' },
        duration: 200
      }).promise().then(() => {
        newEdge.animate({
          style: { width: 3, 'line-color': 'hsl(var(--success))' },
          duration: 200
        });
      });
    });

    setState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        animationsPlayed: prev.stats.animationsPlayed + 1
      }
    }));

    console.log(`Animated new transaction: ${tx.signature.slice(0, 8)}...`);
  }, []);

  /**
   * Set cytoscape reference for animations
   */
  const setCytoscapeRef = useCallback((cy: cytoscape.Core | null) => {
    cyRef.current = cy;
  }, []);

  /**
   * Clear pending transactions
   */
  const clearPendingTransactions = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingTransactions: []
    }));
  }, []);

  /**
   * Toggle realtime mode for current account
   */
  const toggleRealtimeForAccount = useCallback((account: string) => {
    if (state.subscribedAccounts.includes(account)) {
      unsubscribeFromAccount(account);
    } else {
      if (!state.isConnected) {
        connect();
      }
      subscribeToAccount(account);
    }
  }, [state.subscribedAccounts, state.isConnected, connect, subscribeToAccount, unsubscribeFromAccount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    isConnected: state.isConnected,
    isSubscribed: state.isSubscribed,
    subscribedAccounts: state.subscribedAccounts,
    pendingTransactions: state.pendingTransactions,
    lastUpdate: state.lastUpdate,
    error: state.error,
    stats: state.stats,

    // Actions
    connect,
    disconnect,
    subscribeToAccount,
    unsubscribeFromAccount,
    toggleRealtimeForAccount,
    setCytoscapeRef,
    clearPendingTransactions
  };
}

export default useRealtimeGraphUpdates;
