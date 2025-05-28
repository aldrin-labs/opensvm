'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { useRouter } from 'next/navigation';
import { GraphStateCache, ViewportState } from '@/lib/graph-state-cache';
import { debounce } from '@/lib/utils';
import {
  TransactionGraphProps,
  createAddressFilter,
  createTransactionFilter,
  initializeCytoscape,
  setupGraphInteractions,
  resizeGraph,
  fetchTransactionData,
  fetchAccountTransactions,
  queueAccountFetch as queueAccountFetchUtil,
  processAccountFetchQueue as processAccountFetchQueueUtil,
  addAccountToGraph as addAccountToGraphUtil,
  expandTransactionGraph as expandTransactionGraphUtil,
  focusOnTransaction as focusOnTransactionUtil
} from './';

// Register the dagre layout extension
if (typeof window !== 'undefined') {
  cytoscape.use(dagre);
}

// Add type definitions at the top of the file after imports
interface CachedNode {
  data: {
    id: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface CachedEdge {
  data: {
    id: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface CachedState {
  nodes: CachedNode[];
  edges?: CachedEdge[];
}

function TransactionGraph({
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
  const cyRef = useRef<cytoscape.Core | null>(null);
  
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
  
  // Track when props change without causing remounts
  const initialSignatureRef = useRef<string>(initialSignature);
  const initialAccountRef = useRef<string>(initialAccount);
  
  // Fetch queue and tracking refs
  const fetchQueueRef = useRef<Array<{address: string, depth: number, parentSignature: string | null}>>([]);
  const processedNodesRef = useRef<Set<string>>(new Set());
  const processedEdgesRef = useRef<Set<string>>(new Set());
  const loadedTransactionsRef = useRef<Set<string>>(new Set());
  const loadedAccountsRef = useRef<Set<string>>(new Set());
  const transactionCache = useRef<Map<string, any>>(new Map());
  const pendingFetchesRef = useRef<Set<string>>(new Set());
  // Add a reference to track if the queue is being processed
  const isProcessingQueueRef = useRef<boolean>(false);
  
  // Track the current focus transaction
  const focusSignatureRef = useRef<string>(initialSignature);
  
  // Router for navigation
  const router = useRouter();

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

  // Process the fetch queue in parallel
  const processAccountFetchQueue = useCallback(() => {
    processAccountFetchQueueUtil(
      fetchQueueRef,
      fetchAndProcessAccount,
      isProcessingQueueRef
    );
  }, []);

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
      processAccountFetchQueue,
      isProcessingQueueRef
    );
  }, [processAccountFetchQueue]);

  // Fetch and process a single account
  const fetchAndProcessAccount = useCallback(async (
    address: string,
    depth = 0,
    parentSignature: string | null = null
  ) => {
    try {
      await addAccountToGraph(address, totalAccounts, depth, parentSignature);
    } catch (e) {
      const accountKey = `${address}:${depth}`;
      console.error(`Error processing account ${address}:`, e);
      pendingFetchesRef.current?.delete(accountKey);
    }
  }, [addAccountToGraph, totalAccounts]);

  // Add account and its transactions to the graph
  const addAccountToGraph = useCallback(async (
    address: string,
    totalAccounts: number,
    depth: number,
    parentSignature: string | null = null, 
    newElements?: Set<string>
  ) => {
    const result = await addAccountToGraphUtil(
      address,
      totalAccounts,
      depth,
      parentSignature,
      newElements,
      maxDepth,
      shouldExcludeAddress,
      shouldIncludeTransaction,
      fetchAccountTransactionsWithError,
      cyRef,
      loadedAccountsRef,
      pendingFetchesRef,
      loadedTransactionsRef,
      processedNodesRef,
      processedEdgesRef,
      setLoadingProgress,
      queueAccountFetch
    );

if (cyRef.current) {
  cyRef.current.layout({
    name: 'dagre',
    // @ts-ignore - dagre layout options are not fully typed
    rankDir: 'LR',
    fit: true,
    padding: 50
  }).run();
}

return result;
  }, [
    maxDepth,
    shouldExcludeAddress,
    shouldIncludeTransaction,
    fetchAccountTransactionsWithError,
    queueAccountFetch
  ]);

  // Expand the transaction graph incrementally
  const expandTransactionGraph = useCallback(async (signature: string, signal?: AbortSignal) => {
    if (loadedTransactionsRef.current.has(signature)) return false;
    return expandTransactionGraphUtil(
      signature,
      cyRef,
      fetchTransactionDataWithCache,
      queueAccountFetch,
      addAccountToGraph,
      setExpandedNodesCount,
      loadedTransactionsRef,
      signal
    );
  }, [fetchTransactionDataWithCache, queueAccountFetch, addAccountToGraph]);

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

      // Ensure we have a valid cytoscape instance
      if (!cyRef.current) {
        console.error('No cytoscape instance available');
        return;
      }

      // Always ensure the transaction node exists, regardless of incrementalLoad
      if (!cyRef.current.getElementById(signature).length) {
        cyRef.current.add({ 
          data: { 
            id: signature, 
            label: signature.slice(0, 8) + '...', 
            type: 'transaction' 
          }, 
          classes: 'transaction highlight-transaction' 
        });
      }

      // Update focus signature before proceeding with focus
      focusSignatureRef.current = signature;
      
      // If not using incremental load or client-side navigation, force a full graph expansion
      if (!incrementalLoad || !clientSideNavigation) {
        // Fetch and expand the transaction data first
        const txResponse = await fetch(`/api/transaction/${signature}`);
        if (txResponse.ok) {
          const txData = await txResponse.json();
          if (txData.details?.accounts?.length > 0) {
            // Queue the first account for immediate processing
            await queueAccountFetch(txData.details.accounts[0].pubkey, 0, signature);
            // Wait for initial graph expansion
            await new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                if (cyRef.current && cyRef.current.elements().length > 1) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
              // Timeout after 10 seconds
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
              }, 10000);
            });
          }
        }
      }
      
      // Only update state without navigation when within the graph component
      if (onTransactionSelect) {
        // Call the onTransactionSelect callback to update other components
        onTransactionSelect(signature);
        
        // Update local state
        setCurrentSignature(signature);
        
        // Expand the transaction in the graph without navigation
        await expandTransactionGraph(signature);
        
        // Highlight the selected node
        if (cyRef.current) {
          // Remove highlight from all nodes
          cyRef.current.elements().removeClass('highlight-transaction highlight-account');
          
          // Add highlight to the selected node
          cyRef.current.getElementById(signature).addClass('highlight-transaction');
          
          // Center on the selected node if not preserving viewport
          if (!preserveViewport) {
            const node = cyRef.current.getElementById(signature);
            cyRef.current.center(node);
            cyRef.current.zoom(0.8);
          }
        }
      } else {
        // If no onTransactionSelect handler provided, use the utility function
        // but prevent navigation to avoid page reload
        const useNavigation = false; // Override to prevent navigation
        const result = await focusOnTransactionUtil(
          signature,
          cyRef,
          focusSignatureRef,
          setCurrentSignature,
          viewportState,
          setViewportState,
          expandTransactionGraph,
          onTransactionSelect,
          router,
          useNavigation, // Force client-side navigation to false
          incrementalLoad,
          preserveViewport
        );
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

      // Ensure proper viewport handling after focus
      if (!preserveViewport && cyRef.current) {
        const elements = cyRef.current.elements();
        if (elements.length > 0) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            if (cyRef.current) {
              cyRef.current.fit(elements, 50);
              cyRef.current.center();
            }
          });
        }
      }
    } finally {
      pendingFetchesRef.current.delete(loadingKey);
    }
  }, [
    viewportState,
    expandTransactionGraph,
    onTransactionSelect,
    router,
    clientSideNavigation,
    isNavigatingHistory,
    currentHistoryIndex,
    queueAccountFetch
  ]);
  
  // Set up graph interaction handlers
  const setupGraphInteractionsCallback = useCallback((cy: cytoscape.Core) => {
    setupGraphInteractions(
      cy,
      containerRef,
      focusSignatureRef,
      focusOnTransaction,
      setViewportState
    );
  }, [focusOnTransaction]);

  // Initialize graph with improved error handling and state management
  useEffect(() => {
  if (!containerRef.current || (initialSignature === initialSignatureRef.current && cyRef.current) || (initialAccount === initialAccountRef.current && cyRef.current)) {
    return;
  }

  isInitialized.current = false;
  timeoutIds.current = [];

  processedNodesRef.current.clear();
  processedEdgesRef.current.clear();
  loadedTransactionsRef.current.clear();
  loadedAccountsRef.current.clear();
  transactionCache.current.clear();
  pendingFetchesRef.current.clear();
  isProcessingQueueRef.current = false;

  const cy = initializeCytoscape(containerRef.current);
  cyRef.current = cy;

  setupGraphInteractionsCallback(cy);

  const loadInitialData = async () => {
if (isInitialized.current) return;
isInitialized.current = true;

      setLoading(true);
      setError(null);
      setTotalAccounts(0);
      setLoadingProgress(0);

      try {
        if (initialAccount) {
          // Update ref to prevent reinitialization
          initialAccountRef.current = initialAccount;
          
          await new Promise<void>((resolve) => {
            queueAccountFetch(initialAccount, 0, null);
            
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds with 100ms interval
            const checkInterval = setInterval(() => {
              attempts++;
              const elements = cyRef.current?.elements().length || 0;
              
              if (elements > 0 || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            
            timeoutIds.current.push(setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 10000));
          });
          
          // Center and zoom after elements are loaded
          if (cyRef.current) {
            requestAnimationFrame(() => {
              if (cyRef.current) {
                cyRef.current.fit();
                cyRef.current.center();
                cyRef.current.zoom(0.8);
              }
            });
          }
        } else if (initialSignature) {
          // Update ref to prevent reinitialization
          initialSignatureRef.current = initialSignature;
          
          // Focus on the initial transaction
          await focusOnTransaction(initialSignature, true, true, false);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError({
          message: 'Failed to load initial data. Please try again.',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    // Clean up function
    return () => {
      timeoutIds.current.forEach(clearTimeout);
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [initialSignature, initialAccount, focusOnTransaction, setupGraphInteractionsCallback, queueAccountFetch]);

  // Handle window resize
  useEffect(() => {
    const handleResize = debounce(() => {
      if (cyRef.current && containerRef.current) {
        resizeGraph(cyRef.current, containerRef.current);
      }
    }, 250);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Render the graph container
  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ width, height }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="mb-2">Loading transaction graph...</div>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-in-out"
                style={{ width: `${Math.min(loadingProgress, 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {totalAccounts > 0 ? `Processed ${expandedNodesCount} of ${totalAccounts} accounts` : 'Initializing...'}
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className={`absolute bottom-4 right-4 p-4 rounded-md shadow-lg z-20 ${
          error.severity === 'error' ? 'bg-destructive/90 text-destructive-foreground' : 'bg-warning/90 text-warning-foreground'
        }`}>
          <div className="flex items-start">
            <div className="flex-1">{error.message}</div>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-current hover:text-current/80"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionGraph;
