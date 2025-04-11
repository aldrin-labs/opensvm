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
  }, []);

  // Process the fetch queue in parallel
  const processAccountFetchQueue = useCallback(() => {
    processAccountFetchQueueUtil(
      fetchQueueRef,
      fetchAndProcessAccount,
      isProcessingQueueRef
    );
  }, [fetchAndProcessAccount]);

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
    queueAccountFetch,
    cyRef,
    processAccountFetchQueue
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
  }, [fetchTransactionDataWithCache, queueAccountFetch, addAccountToGraph, setExpandedNodesCount, loadedTransactionsRef]);

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
                cyRef.current.layout({
  name: 'dagre',
  // @ts-ignore - dagre layout options are not fully typed
  rankDir: 'LR',
  fit: true,
  padding: 50
}).run();
cyRef.current.zoom(0.5);
              }
            });
          }
          
        } else if (initialSignature) {
          // Update ref to prevent reinitialization
          initialSignatureRef.current = initialSignature;
          
          // Check for cached state first
          const cachedState = GraphStateCache.loadState(initialSignature);
          const hasExistingElements = cyRef.current?.elements().length > 0;
          
          // Skip initialization if we already have elements and signature matches
          if (hasExistingElements && initialSignature === currentSignature) {
            setLoading(false);
            return;
          }
          
          // Create initial transaction node regardless of cache state
          if (cyRef.current && !cyRef.current.getElementById(initialSignature).length) {
            cyRef.current.add({ 
              data: { 
                id: initialSignature, 
                label: initialSignature.slice(0, 8) + '...', 
                type: 'transaction' 
              }, 
              classes: 'transaction highlight-transaction' 
            });
          }

          // If we have cached state, restore it first
          if (cachedState && Array.isArray(cachedState.nodes) && cachedState.nodes.length > 0) {
            try {
              // Restore cached nodes and edges
              const typedState = cachedState as unknown as CachedState;
              typedState.nodes.forEach(node => {
                if (node.data && !cyRef.current?.getElementById(node.data.id).length) {
                  cyRef.current?.add(node);
                }
              });
              
              if (typedState.edges) {
                typedState.edges.forEach(edge => {
                  if (edge.data && !cyRef.current?.getElementById(edge.data.id).length) {
                    cyRef.current?.add(edge);
                  }
                });
              }
              
              // Run layout with proper typing
              if (cyRef.current) {
                cyRef.current.layout({
                  name: 'dagre',
                  // @ts-ignore - dagre layout options are not fully typed
                  rankDir: 'LR',
                  fit: true,
                  padding: 50
                }).run();
              }
            } catch (err) {
              console.warn('Error restoring cached state:', err);
            }
          }

          // Only fetch fresh data if we don't have cached state
          if (!cachedState || !cachedState.nodes.length) {
            const response = await fetch(`/api/transaction/${initialSignature}`);
            
            if (response.ok) {
              const txData = await response.json();
              
              // Queue the first account for processing regardless of cache state
              if (txData.details?.accounts?.length > 0) {
                const firstAccount = txData.details.accounts[0].pubkey;
                if (firstAccount) {
                  queueAccountFetch(firstAccount, 0, initialSignature);
                  
                  // Wait for initial processing to complete
                  await new Promise<void>((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 100;
                    const checkInterval = setInterval(() => {
                      attempts++;
                      const elements = cyRef.current?.elements().length || 0;
                      
                      if (elements > 1 || attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        resolve();
                      }
                    }, 100);
                    
                    timeoutIds.current.push(setTimeout(() => {
                      clearInterval(checkInterval);
                      resolve();
                    }, 10000));
                  });
                }
              }

              // Focus on transaction after data is loaded
              await focusOnTransaction(initialSignature, true, true, false);
            }
          }
          
          // Ensure proper viewport after loading
          if (cyRef.current) {
            requestAnimationFrame(() => {
              if (cyRef.current) {
                cyRef.current.fit();
                cyRef.current.center();
                cyRef.current.zoom(0.5);
              }
            });
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

    // Cleanup function
    return () => {
      timeoutIds.current.forEach(id => clearTimeout(id));
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      // Copy ref values to local variables to avoid warnings
      const processedNodes = processedNodesRef.current;
      const processedEdges = processedEdgesRef.current;
      const loadedTransactions = loadedTransactionsRef.current;
      const loadedAccounts = loadedAccountsRef.current;
      const transactionCacheRef = transactionCache.current;
      const pendingFetches = pendingFetchesRef.current;
      
      processedNodes.clear();
      processedEdges.clear();
      loadedTransactions.clear();
      loadedAccounts.clear();
      transactionCacheRef.clear();
      pendingFetches.clear();
    };
  }, [initialAccount, initialSignature, currentSignature, focusOnTransaction, queueAccountFetch, setupGraphInteractionsCallback]);
  
  // Improved viewport state restoration
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !viewportState || isNavigatingHistory) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        if (cy && viewportState) {
          cy.viewport({
            zoom: viewportState.zoom,
            pan: viewportState.pan
          });
        }
      } catch (err) {
        console.error('Error during viewport restoration:', err);
      }
    });
  }, [viewportState, isNavigatingHistory]);

  // Handle window resize
  const resizeGraphCallback = useCallback(() => {
    resizeGraph(cyRef, true); // Preserve viewport when resizing
  }, []);
  
  // Use ResizeObserver for container resizing
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      setTimeout(resizeGraphCallback, 100);
    }); 
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeGraphCallback]);

  // Handle window resize
  useEffect(() => {
    const handleResize = debounce(() => {
      resizeGraphCallback();
    }, 250);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeGraphCallback]);

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

  const showCloudView = useCallback(() => {
    if (cyRef.current) {
      try {
        // Use a more specific selector to avoid empty selection errors
        const elements = cyRef.current.elements();
        if (elements.length > 0) {
          // Use dynamic padding based on graph size
          const padding = Math.min(50, elements.length * 2);
          cyRef.current.fit(elements, padding);
        } else {
          cyRef.current.fit(undefined, 20);
        }
        // Adjust zoom level based on number of elements
        if (elements.length > 50) {
          cyRef.current.zoom(cyRef.current.zoom() * 0.8); // Zoom out more for larger graphs
        }
      } catch (err) {
        console.error('Error during cloud view fit:', err);
      }
    }
  }, []);

  // Update internal state when props change - FIXED to prevent circular updates
  useEffect(() => {
    const isProgrammaticNavigation = sessionStorage.getItem('programmatic_nav') === 'true';

    if (initialSignature && initialSignature !== initialSignatureRef.current) {
      initialSignatureRef.current = initialSignature;

      // Don't navigate if this is a programmatic navigation
      if (!isProgrammaticNavigation && initialSignature !== currentSignature) {
        // First check if we have the transaction in cache
        if (GraphStateCache.hasState(initialSignature)) {
          focusOnTransaction(initialSignature, false, false, false);
        } else {
          focusOnTransaction(initialSignature, false, true, false);
        }
      }
    }

    sessionStorage.removeItem('programmatic_nav');
  }, [initialSignature, currentSignature, focusOnTransaction]);

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
        className="cytoscape-container w-full bg-muted/50 rounded-lg border border-border overflow-hidden"
        style={{ 
          width: '100%', 
          height: '100%', // Further increased height for better visibility
          position: 'relative',
          overflow: 'hidden',
          margin: '0 auto', // Center the container
        }}
      />

      {/* Controls overlay with better styling and positioning */}
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
        
        {/* Cloud view button */}
        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={showCloudView}
          title="Show cloud view"
          aria-label="Show cloud view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
        </button>
        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={() => {
            if (cyRef.current) {
              try {
                // Use a more specific selector to avoid empty selection errors
                const elements = cyRef.current.elements();
                if (elements.length > 0) {
                  cyRef.current.fit(elements);
                  cyRef.current.center();
                }
              } catch (err) {
                console.error('Error during fit view:', err);
              }
            } 
          }}
          title="Fit all elements in view"
          aria-label="Fit view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="15 3 21 3 21 9"></polygon><polygon points="9 21 3 21 3 15"></polygon><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={() => {
            if (cyRef.current) {
              const zoom = cyRef.current.zoom();
              try {
                cyRef.current.zoom(zoom * 1.2);
              } catch (err) {
                console.error('Error during zoom in:', err);
              }
            }
          }}
          title="Zoom in on graph"
          aria-label="Zoom in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={() => {
            if (cyRef.current) {
              const zoom = cyRef.current.zoom();
              try {
                cyRef.current.zoom(zoom / 1.2);
              } catch (err) {
                console.error('Error during zoom out:', err);
              }
            }
          }}
          title="Zoom out on graph"
          aria-label="Zoom out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
      </div>
    </div>
  );
}

export default React.memo(TransactionGraph);
