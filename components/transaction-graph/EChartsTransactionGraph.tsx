'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { useRouter } from 'next/navigation';
import { debounce } from '@/lib/utils';
import { GraphStateCache, ViewportState } from '@/lib/graph-state-cache';
import {
  TransactionGraphProps,
  createAddressFilter,
  createTransactionFilter,
  initializeECharts,
  formatGraphData,
  updateGraphData,
  focusOnNode,
  applyLayout,
  filterNodes,
  setPerformanceMode,
  limitVisibleNodes,
  cleanupECharts,
  fetchTransactionData,
  fetchAccountTransactions,
  queueAccountFetch as queueAccountFetchUtil,
  processAccountFetchQueue as processAccountFetchQueueUtil,
  addAccountToGraph as addAccountToGraphUtil,
  expandTransactionGraph as expandTransactionGraphUtil,
  focusOnTransaction as focusOnTransactionUtil
} from './';

// Define interfaces for internal state tracking
interface CachedNode {
  data: {
    id: string;
    [key: string]: any;
  };
}

interface CachedEdge {
  data: {
    id: string;
    source: string;
    target: string;
    [key: string]: any;
  };
}

interface CachedState {
  nodes: CachedNode[];
  edges: CachedEdge[];
}

function EChartsTransactionGraph({
  initialSignature,
  initialAccount,
  onTransactionSelect,
  clientSideNavigation = true,
  width = '100%',
  height = '100%',
  maxDepth = 3
}: TransactionGraphProps) {
  // Component refs
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef<boolean>(false);
  const timeoutIds = useRef<NodeJS.Timeout[]>([]);
  const chartRef = useRef<echarts.ECharts | null>(null);
  
  // Excluded accounts and program identifiers
  const EXCLUDED_ACCOUNTS = useMemo(() => new Set([
    'ComputeBudget111111111111111111111111111111'
  ]), []);
  
  // Program identifiers for Raydium and Jupiter
  const EXCLUDED_PROGRAM_SUBSTRINGS = useMemo(() => [
    // Raydium Pool identifiers
    'LIQUIDITY_POOL',
    'AMM',
    'RaydiumPoolState',
    'Raydium',
    // Jupiter identifiers
    'JUP',
    'Jupiter',
    'JITOSOL'
  ], []);
  
  // State management
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [expandedNodesCount, setExpandedNodesCount] = useState<number>(0);
  const [currentSignature, setCurrentSignature] = useState<string>(initialSignature);
  const [error, setError] = useState<{message: string; severity: 'error' | 'warning'} | null>(null);
  const [viewportState, setViewportState] = useState<ViewportState | null>(null);
  
  // Navigation history state
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [isNavigatingHistory, setIsNavigatingHistory] = useState<boolean>(false);
  
  // Performance settings
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [performanceMode, setPerformanceMode] = useState<boolean>(false);
  const [nodeVisibilityLimit, setNodeVisibilityLimit] = useState<number>(500);
  
  // Track when props change without causing remounts
  const initialSignatureRef = useRef<string>(initialSignature);
  const initialAccountRef = useRef<string>(initialAccount);
  
  // Data tracking refs
  const fetchQueueRef = useRef<Array<{address: string, depth: number, parentSignature: string | null}>>([]);
  const processedNodesRef = useRef<Set<string>>(new Set());
  const processedEdgesRef = useRef<Set<string>>(new Set());
  const loadedTransactionsRef = useRef<Set<string>>(new Set());
  const loadedAccountsRef = useRef<Set<string>>(new Set());
  const transactionCache = useRef<Map<string, any>>(new Map());
  const pendingFetchesRef = useRef<Set<string>>(new Set());
  const isProcessingQueueRef = useRef<boolean>(false);
  
  // Graph data storage
  const nodesRef = useRef<CachedNode[]>([]);
  const edgesRef = useRef<CachedEdge[]>([]);
  
  // Track the current focus transaction
  const focusSignatureRef = useRef<string>(initialSignature);
  
  // Router for navigation
  const router = useRouter();

  // Update node count
  const updateNodeCount = useCallback(() => {
    setNodeCount(nodesRef.current.length);
  }, []);

  // Create address and transaction filters
  const shouldExcludeAddress = useMemo(
    () => createAddressFilter(EXCLUDED_ACCOUNTS, EXCLUDED_PROGRAM_SUBSTRINGS),
    [EXCLUDED_ACCOUNTS, EXCLUDED_PROGRAM_SUBSTRINGS]
  );
  
  const shouldIncludeTransaction = useMemo(
    () => createTransactionFilter(shouldExcludeAddress),
    [shouldExcludeAddress]
  );

  // Transaction data fetching with caching
  const fetchTransactionDataWithCache = useCallback(
    (signature: string) => fetchTransactionData(signature, transactionCache.current),
    []
  );

  // Account transactions fetching
  const fetchAccountTransactionsWithError = useCallback(
    (address: string) => fetchAccountTransactions(address, 10, setError),
    [setError]
  );

  // Queue an account for fetching
  const queueAccountFetch = useCallback((address: string, depth = 0, parentSignature: string | null = null) => {
    if (!address || loadedAccountsRef.current.has(address) || pendingFetchesRef.current.has(`${address}:${depth}`)) {
      return;
    }
    queueAccountFetchUtil(
      address,
      depth,
      parentSignature,
      fetchQueueRef,
      pendingFetchesRef,
      loadedAccountsRef,
      setTotalAccounts,
      () => {
        processAccountFetchQueueUtil(
          fetchQueueRef,
          fetchAndProcessAccount,
          isProcessingQueueRef,
          nodeCount
        );
      },
      isProcessingQueueRef
    );
  }, [nodeCount]);

  // Process the fetch queue in parallel
  const processAccountFetchQueue = useCallback(() => {
    processAccountFetchQueueUtil(
      fetchQueueRef,
      fetchAndProcessAccount,
      isProcessingQueueRef,
      nodeCount
    );
  }, [nodeCount]);

  // Fetch and process a single account
  const fetchAndProcessAccount = useCallback(async (
    address: string,
    depth = 0,
    parentSignature: string | null = null
  ) => {
    try {
      if (!address) {
        console.warn('Attempted to process account with empty address');
        return;
      }
      
      // Use the custom implementation directly
      // Create a custom version of addAccountToGraphUtil that works with ECharts
      const transactions = await fetchAccountTransactionsWithError(address);
      
      if (!transactions || transactions.length === 0) {
        return;
      }
      
      // Add the account node
      addNode({
        data: {
          id: address,
          label: address.slice(0, 8) + '...',
          type: 'account',
          fullAddress: address
        }
      });
      
      // Process each transaction
      for (const tx of transactions) {
        if (!shouldIncludeTransaction(tx)) continue;
        
        // Add transaction node
        addNode({
          data: {
            id: tx.signature,
            label: tx.signature.slice(0, 8) + '...',
            type: 'transaction',
            success: tx.err === null,
            fullSignature: tx.signature,
            timestamp: tx.blockTime,
            formattedTime: tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'Unknown'
          }
        });
        
        // Add edge from account to transaction
        addEdge({
          data: {
            id: `${address}->${tx.signature}`,
            source: address,
            target: tx.signature,
            type: 'connection'
          }
        });
        
        // Queue related accounts for processing if depth allows
        if (depth < maxDepth) {
          const txDetails = await fetchTransactionDataWithCache(tx.signature);
          // Add proper checks to ensure txDetails.accounts is an array before iterating
          if (txDetails && txDetails.accounts && Array.isArray(txDetails.accounts)) {
            for (const account of txDetails.accounts) {
              if (account && account.pubkey && !shouldExcludeAddress(account.pubkey)) {
                queueAccountFetch(account.pubkey, depth + 1, tx.signature);
              }
            }
          }
        }
      }
      
      // Apply layout after adding elements
      if (chartRef.current) {
        applyLayout(chartRef.current, 'force');
      }
    } catch (e) {
      const accountKey = `${address}:${depth}`;
      console.error(`Error processing account ${address}:`, e);
      pendingFetchesRef.current?.delete(accountKey);
      
      // Don't set global error for individual account fetch issues
      // Instead, show a warning that doesn't block the UI
      setError({
        message: `Note: Could not process account ${address.slice(0, 8)}... This won't affect the rest of the graph.`,
        severity: 'warning'
      });
    }
  }, [
    fetchAccountTransactionsWithError, 
    shouldIncludeTransaction, 
    addNode, 
    addEdge, 
    maxDepth, 
    fetchTransactionDataWithCache, 
    shouldExcludeAddress, 
    queueAccountFetch, 
    setError
  ]);

  // Add a node to the graph
  const addNode = useCallback((node: CachedNode) => {
    if (!processedNodesRef.current.has(node.data.id)) {
      nodesRef.current.push(node);
      processedNodesRef.current.add(node.data.id);
      updateNodeCount();
      
      // Update the chart if it exists
      if (chartRef.current) {
        try {
          updateGraphData(chartRef.current, nodesRef.current, edgesRef.current);
        } catch (error) {
          console.error('Error updating graph data after adding node:', error);
        }
      }
    }
  }, [updateNodeCount]);

  // Add an edge to the graph
  const addEdge = useCallback((edge: CachedEdge) => {
    if (!processedEdgesRef.current.has(edge.data.id)) {
      edgesRef.current.push(edge);
      processedEdgesRef.current.add(edge.data.id);
      
      // Update the chart if it exists
      if (chartRef.current) {
        try {
          updateGraphData(chartRef.current, nodesRef.current, edgesRef.current);
        } catch (error) {
          console.error('Error updating graph data after adding edge:', error);
        }
      }
    }
  }, []);

  // Add account and its transactions to the graph
  const addAccountToGraph = useCallback(async (
    address: string,
    totalAccounts: number,
    depth: number,
    parentSignature: string | null = null, 
    newElements?: Set<string>
  ) => {
    // Add node limiting for performance
    const currentNodeCount = nodesRef.current.length;
    const maxNodes = performanceMode ? 150 : 300; // Limit nodes in performance mode
    
    if (currentNodeCount > maxNodes && depth > 1) {
      console.log(`Node limit reached (${currentNodeCount}/${maxNodes}), skipping expansion at depth ${depth}`);
      return false;
    }

    // Create a custom version of addAccountToGraphUtil that works with ECharts
    // This is a simplified version for now
    const transactions = await fetchAccountTransactionsWithError(address);
    
    if (!transactions || transactions.length === 0) {
      return false;
    }
    
    // Add the account node
    addNode({
      data: {
        id: address,
        label: address.slice(0, 8) + '...',
        type: 'account',
        fullAddress: address
      }
    });
    
    // Process each transaction
    for (const tx of transactions) {
      if (!shouldIncludeTransaction(tx)) continue;
      
      // Add transaction node
      addNode({
        data: {
          id: tx.signature,
          label: tx.signature.slice(0, 8) + '...',
          type: 'transaction',
          success: tx.err === null,
          fullSignature: tx.signature,
          timestamp: tx.blockTime,
          formattedTime: tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'Unknown'
        }
      });
      
      // Add edge from account to transaction
      addEdge({
        data: {
          id: `${address}->${tx.signature}`,
          source: address,
          target: tx.signature,
          type: 'connection'
        }
      });
      
      // Queue related accounts for processing if depth allows
      if (depth < maxDepth) {
        const txDetails = await fetchTransactionDataWithCache(tx.signature);
        // Add proper checks to ensure txDetails.accounts is an array before iterating
        if (txDetails && txDetails.accounts && Array.isArray(txDetails.accounts)) {
          for (const account of txDetails.accounts) {
            if (account && account.pubkey && !shouldExcludeAddress(account.pubkey)) {
              queueAccountFetch(account.pubkey, depth + 1, tx.signature);
            }
          }
        }
      }
    }
    
    // Apply layout after adding elements
    if (chartRef.current) {
      applyLayout(chartRef.current, 'force');
    }
    
    return true;
  }, [
    maxDepth,
    performanceMode,
    shouldExcludeAddress,
    shouldIncludeTransaction,
    fetchAccountTransactionsWithError,
    fetchTransactionDataWithCache,
    queueAccountFetch,
    addNode,
    addEdge
  ]);

  // Expand the transaction graph incrementally
  const expandTransactionGraph = useCallback(async (signature: string, signal?: AbortSignal) => {
    if (loadedTransactionsRef.current.has(signature)) return false;
    
    // Mark as loaded to prevent duplicate processing
    loadedTransactionsRef.current.add(signature);
    
    try {
      const txData = await fetchTransactionDataWithCache(signature);
      if (!txData || !txData.accounts) return false;
      
      // Add transaction node if it doesn't exist
      if (!processedNodesRef.current.has(signature)) {
        addNode({
          data: {
            id: signature,
            label: signature.slice(0, 8) + '...',
            type: 'transaction',
            success: txData.success,
            fullSignature: signature
          }
        });
      }
      
      // Process accounts
      if (txData.accounts && Array.isArray(txData.accounts)) {
        for (const account of txData.accounts) {
          if (!account || !account.pubkey || shouldExcludeAddress(account.pubkey)) continue;
          
          // Add account node
          addNode({
            data: {
              id: account.pubkey,
              label: account.pubkey.slice(0, 8) + '...',
              type: 'account',
              fullAddress: account.pubkey
            }
          });
          
          // Add edge from transaction to account
          addEdge({
            data: {
              id: `${signature}->${account.pubkey}`,
              source: signature,
              target: account.pubkey,
              type: 'connection'
            }
          });
          
          // Queue account for further processing
          queueAccountFetch(account.pubkey, 1, signature);
        }
      }
      
      // Apply layout
      if (chartRef.current) {
        applyLayout(chartRef.current, 'force');
      }
      
      return true;
    } catch (error) {
      console.error('Error expanding transaction graph:', error);
      return false;
    }
  }, [
    fetchTransactionDataWithCache,
    shouldExcludeAddress,
    queueAccountFetch,
    addNode,
    addEdge
  ]);

  // Focus on a specific transaction
  const focusOnTransaction = useCallback(async (
    signature: string,
    addToHistory = true,
    incrementalLoad = true,
    preserveViewport = true
  ) => {
    // Prevent focusing on empty signatures
    if (!signature) return;

    // Create a loading lock to prevent race conditions
    const loadingKey = `loading_${signature}`;
    if (pendingFetchesRef.current.has(loadingKey)) {
      return;
    }
    pendingFetchesRef.current.add(loadingKey);

    try {
      // Skip focused transaction processing but still update history if needed
      if (signature === focusSignatureRef.current && incrementalLoad) {
        // Even if skipping transaction processing, we still need to update history
        if (addToHistory && !isNavigatingHistory && signature) {
          setNavigationHistory(prev => {
            const newHistory = prev.slice(0, currentHistoryIndex + 1);
            
            if (newHistory.length === 0 || newHistory[newHistory.length - 1] !== signature) {
              newHistory.push(signature);
              setCurrentHistoryIndex(newHistory.length - 1);
            }
            return newHistory;
          });
        }
        return;
      }

      // Ensure we have a valid chart instance
      if (!chartRef.current) {
        console.error('No chart instance available');
        return;
      }

      // Add transaction node if it doesn't exist
      if (!processedNodesRef.current.has(signature)) {
        addNode({
          data: {
            id: signature,
            label: signature.slice(0, 8) + '...',
            type: 'transaction'
          }
        });
      }

      // Update focus signature before proceeding with focus
      focusSignatureRef.current = signature;
      
      // Expand the transaction in the graph
      await expandTransactionGraph(signature);
      
      // Highlight the selected node
      focusOnNode(chartRef.current, signature);
      
      // Update local state
      setCurrentSignature(signature);
      
      // Call the onTransactionSelect callback to update other components
      if (onTransactionSelect) {
        onTransactionSelect(signature);
      }
      
      // Add to navigation history if requested and not already navigating through history
      if (addToHistory && !isNavigatingHistory && signature) {
        setNavigationHistory(prev => {
          const newHistory = prev.slice(0, currentHistoryIndex + 1);
          
          if (newHistory.length === 0 || newHistory[newHistory.length - 1] !== signature) {
            newHistory.push(signature);
            setCurrentHistoryIndex(newHistory.length - 1);
          }
          return newHistory;
        });
      }
    } finally {
      pendingFetchesRef.current.delete(loadingKey);
    }
  }, [
    expandTransactionGraph,
    onTransactionSelect,
    isNavigatingHistory,
    currentHistoryIndex,
    addNode
  ]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current || isInitialized.current) return;
    
    isInitialized.current = true;
    
    // Clear previous data
    nodesRef.current = [];
    edgesRef.current = [];
    processedNodesRef.current.clear();
    processedEdgesRef.current.clear();
    loadedTransactionsRef.current.clear();
    loadedAccountsRef.current.clear();
    
    // Initialize ECharts
    const chart = initializeECharts(containerRef.current);
    chartRef.current = chart;
    
    // Apply performance mode if needed
    setPerformanceMode(chart, performanceMode);
    
    // Load initial data
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      setTotalAccounts(0);
      setLoadingProgress(0);
      
      try {
        if (initialAccount) {
          // Update ref to prevent reinitialization
          initialAccountRef.current = initialAccount;
          
          // Queue the account for processing
          queueAccountFetch(initialAccount, 0, null);
          
          // Wait for initial processing
          await new Promise<void>(resolve => {
            const checkInterval = setInterval(() => {
              if (nodesRef.current.length > 0) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            
            // Timeout after 10 seconds
            timeoutIds.current.push(setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 10000));
          });
        } else if (initialSignature) {
          // Update ref to prevent reinitialization
          initialSignatureRef.current = initialSignature;
          
          // Add initial transaction node
          addNode({
            data: {
              id: initialSignature,
              label: initialSignature.slice(0, 8) + '...',
              type: 'transaction'
            }
          });
          
          // Expand the transaction
          await expandTransactionGraph(initialSignature);
          
          // Focus on the transaction
          if (chartRef.current) {
            focusOnNode(chartRef.current, initialSignature);
          }
        }
      } catch (err) {
        console.error('Error in loadInitialData:', err);
        setError({
          message: 'Failed to load transaction graph data. ' + 
            (err instanceof Error ? err.message : 'Unknown error occurred.'),
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
    
    // Handle window resize
    const handleResize = debounce(() => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    }, 250);
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      timeoutIds.current.forEach(id => clearTimeout(id));
      window.removeEventListener('resize', handleResize);
      
      if (chartRef.current) {
        cleanupECharts(chartRef.current);
        chartRef.current = null;
      }
    };
  }, [
    initialAccount, 
    initialSignature, 
    performanceMode, 
    queueAccountFetch, 
    expandTransactionGraph,
    addNode
  ]);

  // Apply node visibility limits
  useEffect(() => {
    if (!chartRef.current) return;
    
    limitVisibleNodes(chartRef.current, nodeVisibilityLimit);
  }, [nodeVisibilityLimit]);

  // Apply performance mode changes
  useEffect(() => {
    if (!chartRef.current) return;
    
    setPerformanceMode(chartRef.current, performanceMode);
  }, [performanceMode]);

  // Navigation history handlers
  const navigateBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      setIsNavigatingHistory(true);
      const prevIndex = currentHistoryIndex - 1;
      const prevSignature = navigationHistory[prevIndex];
      setCurrentHistoryIndex(prevIndex);
      
      // Focus on the previous transaction without adding to history
      focusOnTransaction(prevSignature, false);
      
      // Reset navigation flag after a short delay 
      setTimeout(() => setIsNavigatingHistory(false), 100);
    }
  }, [currentHistoryIndex, navigationHistory, focusOnTransaction]);

  const navigateForward = useCallback(() => {
    if (currentHistoryIndex < navigationHistory.length - 1) {
      setIsNavigatingHistory(true);
      const nextIndex = currentHistoryIndex + 1;
      const nextSignature = navigationHistory[nextIndex];
      setCurrentHistoryIndex(nextIndex);
      
      // Focus on the next transaction without adding to history
      focusOnTransaction(nextSignature, false);
      
      // Reset navigation flag after a short delay 
      setTimeout(() => setIsNavigatingHistory(false), 100);
    }
  }, [currentHistoryIndex, navigationHistory, focusOnTransaction]);

  // Layout handlers
  const changeLayout = useCallback((layoutType: string) => {
    if (chartRef.current) {
      applyLayout(chartRef.current, layoutType);
    }
  }, []);

  // Filter handlers
  const applyFilter = useCallback((filterType: string) => {
    if (chartRef.current) {
      filterNodes(chartRef.current, filterType);
    }
  }, []);

  return (
    <div className="transaction-graph-wrapper relative w-full h-full transition-all flex flex-col">
      {error && (
        <div className={`fixed bottom-4 left-4 z-20 ${error.severity === 'error' ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-warning/10 border-warning text-warning'} border p-4 rounded-md max-w-md shadow-lg`}>
          <p className="text-sm">{error.message}</p>
          <button 
            className="absolute top-1 right-1 text-sm"
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
          {error.severity === 'error' && (
            <button 
              className="mt-2 px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-md"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          )}
        </div>
      )}
      
      {/* Progress indicator */}
      {loadingProgress > 0 && loadingProgress < 100 && (
        <div className="graph-loading-indicator">
          Loading transaction graph: {loadingProgress}%
        </div>
      )}

      <div 
        ref={containerRef}
        className="echarts-container w-full bg-muted/50 rounded-lg border border-border overflow-hidden"
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      />

      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-background/90 p-2 rounded-md shadow-md backdrop-blur-sm border border-border">
        {/* Back button */}
        <button 
          className={`p-1.5 hover:bg-primary/10 rounded-md transition-colors ${currentHistoryIndex <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={navigateBack}
          disabled={currentHistoryIndex <= 0}
          title="Navigate back"
          aria-label="Navigate back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"></path>
            <path d="M12 19l-7-7 7-7"></path>
          </svg>
        </button>
        
        {/* Forward button */}
        <button 
          className={`p-1.5 hover:bg-primary/10 rounded-md transition-colors ${currentHistoryIndex >= navigationHistory.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={navigateForward}
          disabled={currentHistoryIndex >= navigationHistory.length - 1}
          title="Navigate forward"
          aria-label="Navigate forward"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path>
            <path d="M12 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>

      {/* Filter controls overlay */}
      <div className="absolute top-4 right-4 flex gap-2 bg-background/90 p-2 rounded-md shadow-md backdrop-blur-sm border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Filter by Type</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            onChange={(e) => applyFilter(e.target.value)}
          >
            <option value="all">All Elements</option>
            <option value="transaction">Transactions Only</option>
            <option value="account">Accounts Only</option>
            <option value="success">Successful Transactions</option>
            <option value="error">Failed Transactions</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Layout</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            onChange={(e) => changeLayout(e.target.value)}
          >
            <option value="force">Force-Directed (Default)</option>
            <option value="circular">Circular</option>
            <option value="tree">Tree</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Node Limit</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            value={nodeVisibilityLimit}
            onChange={(e) => setNodeVisibilityLimit(Number(e.target.value))}
          >
            <option value="100">100 nodes (fastest)</option>
            <option value="200">200 nodes (fast)</option>
            <option value="500">500 nodes (balanced)</option>
            <option value="1000">1000 nodes (detailed)</option>
            <option value="10000">All nodes (slowest)</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Performance Mode</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            value={performanceMode ? 'high' : 'normal'}
            onChange={(e) => setPerformanceMode(e.target.value === 'high')}
          >
            <option value="normal">Normal Mode</option>
            <option value="high">High Performance</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default React.memo(EChartsTransactionGraph);