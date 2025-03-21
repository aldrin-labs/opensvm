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
  
  // Add state for node count, performance mode, and node visibility limit
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [performanceMode, setPerformanceMode] = useState<boolean>(false);
  const [nodeVisibilityLimit, setNodeVisibilityLimit] = useState<number>(500);
  
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
  }, []);

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
    const currentNodeCount = cyRef.current?.nodes().length || 0;
    const maxNodes = performanceMode ? 150 : 300; // Limit nodes in performance mode
    
    if (currentNodeCount > maxNodes && depth > 1) {
      console.log(`Node limit reached (${currentNodeCount}/${maxNodes}), skipping expansion at depth ${depth}`);
      return false;
    }

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
      // Use a simpler layout for large graphs
      const elementsCount = cyRef.current.elements().length;
      if (elementsCount > 200 || performanceMode) {
        // For large graphs or in performance mode, use a simpler layout
        cyRef.current.layout({
          name: 'dagre',
          // @ts-ignore - dagre layout options are not fully typed
          rankDir: 'LR',
          fit: true,
          padding: 30,
          animate: false, // Disable animation for large graphs
          rankSep: 50, // Reduced spacing
          nodeSep: 40,
          edgeSep: 25
        }).run();
      } else {
        // For smaller graphs, use the standard layout with animation
        cyRef.current.layout({
          name: 'dagre',
          // @ts-ignore - dagre layout options are not fully typed
          rankDir: 'LR',
          fit: true,
          padding: 50,
          animate: true,
          animationDuration: 300,
          animationEasing: 'ease-in-out-cubic'
        }).run();
      }
    }

    // Update node count after adding new elements
    updateNodeCount();

    return result;
  }, [
    maxDepth,
    shouldExcludeAddress,
    shouldIncludeTransaction,
    fetchAccountTransactionsWithError,
    queueAccountFetch,
    performanceMode, // Add performance mode as dependency
    updateNodeCount // Add updateNodeCount as dependency
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
  }, [fetchTransactionDataWithCache, queueAccountFetch, addAccountToGraph, loadedTransactionsRef]);

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
  padding: 30, // Reduced from 50
  animate: false, // Disable animation for initial load
  animationDuration: 300, // Reduced from 500
  animationEasing: 'ease-in-out-cubic'
}).run();
// Adjust zoom level based on graph size
const elementsCount = cyRef.current.elements().length;
if (elementsCount > 100) {
  cyRef.current.zoom(0.3); // Zoom out more for larger graphs
} else {
  cyRef.current.zoom(0.5);
}
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
      processedNodesRef.current.clear();
      processedEdgesRef.current.clear();
      loadedTransactionsRef.current.clear();
      loadedAccountsRef.current.clear();
      transactionCache.current.clear();
      pendingFetchesRef.current.clear();
    };
  }, [initialAccount, initialSignature]);
  
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

  // Add this effect to apply node visibility limits
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    const allNodes = cy.nodes();
    
    if (allNodes.length > nodeVisibilityLimit) {
      // Hide nodes beyond the limit
      allNodes.forEach((node, i) => {
        if (i >= nodeVisibilityLimit) {
          node.style('display', 'none');
          // Also hide connected edges
          node.connectedEdges().style('display', 'none');
        } else {
          node.style('display', 'element');
        }
      });
      
      console.log(`Limited visible nodes to ${nodeVisibilityLimit} (hiding ${allNodes.length - nodeVisibilityLimit} nodes)`);
    } else {
      // Show all nodes
      allNodes.style('display', 'element');
      cy.edges().style('display', 'element');
    }
  }, [nodeVisibilityLimit, nodeCount]);

  // Add this effect to update node count when the graph changes
  useEffect(() => {
    if (!cyRef.current) return;
    
    // Update initially
    updateNodeCount();
    
    // Set up a timer to periodically update node count
    const intervalId = setInterval(updateNodeCount, 2000);
    
    // Also listen for add/remove events on the graph
    cyRef.current.on('add remove', debounce(() => {
      updateNodeCount();
    }, 500));
    
    return () => {
      clearInterval(intervalId);
      if (cyRef.current) {
        cyRef.current.off('add remove');
      }
    };
  }, [updateNodeCount]);

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
                const elements = cyRef.current.elements();
                const elementsCount = elements.length;
                
                if (elements.length > 0) {
                  // Skip animation for large graphs
                  if (elementsCount > 100) {
                    cyRef.current.fit(elements);
                    cyRef.current.center();
                  } else {
                    cyRef.current.animate({
                      fit: {
                        eles: elements,
                        padding: 20
                      }
                    }, {
                      duration: 200 // Reduced duration
                    });
                  }
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
              const elementsCount = cyRef.current.elements().length;
              
              try {
                // Skip animation for large graphs
                if (elementsCount > 100) {
                  cyRef.current.zoom(zoom / 1.2);
                } else {
                  cyRef.current.animate({
                    zoom: zoom / 1.2,
                    easing: 'ease-out-cubic'
                  }, {
                    duration: 100 // Reduced from default
                  });
                }
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

      {/* Filter controls overlay */}
      <div className="absolute top-4 right-4 flex gap-2 bg-background/90 p-2 rounded-md shadow-md backdrop-blur-sm border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Filter by Type</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            onChange={(e) => {
              const filterType = e.target.value;
              if (cyRef.current) {
                if (filterType === 'all') {
                  cyRef.current.elements().removeClass('filtered').style('opacity', 1);
                } else {
                  cyRef.current.elements().addClass('filtered').style('opacity', 0.2);
                  cyRef.current.elements(`node[type="${filterType}"]`).removeClass('filtered').style('opacity', 1);
                  // Also show connected edges for visible nodes
                  cyRef.current.elements(`node[type="${filterType}"]`).connectedEdges().removeClass('filtered').style('opacity', 1);
                }
              }
            }}
          >
            <option value="all">All Elements</option>
            <option value="transaction">Transactions Only</option>
            <option value="account">Accounts Only</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Transaction Status</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            onChange={(e) => {
              const filterStatus = e.target.value;
              if (cyRef.current) {
                // Disable animations during filtering for better performance
                const elementsCount = cyRef.current.elements().length;
                const isLargeGraph = elementsCount > 100;
                
                // For large graphs, use batch updates
                if (isLargeGraph) {
                  cyRef.current.batch(() => {
                    if (filterStatus === 'all') {
                      cyRef.current.elements('node[type="transaction"]').removeClass('filtered');
                      cyRef.current.elements('node[type="transaction"]').style('opacity', 1);
                      cyRef.current.elements('node[type="transaction"]').connectedEdges().removeClass('filtered');
                      cyRef.current.elements('node[type="transaction"]').connectedEdges().style('opacity', 1);
                    } else {
                      const successValue = filterStatus === 'success';
                      cyRef.current.elements('node[type="transaction"]').addClass('filtered');
                      cyRef.current.elements('node[type="transaction"]').style('opacity', 0.2);
                      cyRef.current.elements(`node[type="transaction"][success=${successValue}]`).removeClass('filtered');
                      cyRef.current.elements(`node[type="transaction"][success=${successValue}]`).style('opacity', 1);
                      // Also show connected edges for visible nodes
                      cyRef.current.elements(`node[type="transaction"][success=${successValue}]`).connectedEdges().removeClass('filtered');
                      cyRef.current.elements(`node[type="transaction"][success=${successValue}]`).connectedEdges().style('opacity', 1);
                    }
                  });
                } else {
                  // For smaller graphs, use regular updates
                  if (filterStatus === 'all') {
                    cyRef.current.elements('node[type="transaction"]').removeClass('filtered').style('opacity', 1);
                    cyRef.current.elements('node[type="transaction"]').connectedEdges().removeClass('filtered').style('opacity', 1);
                  } else {
                    const successValue = filterStatus === 'success';
                    cyRef.current.elements('node[type="transaction"]').addClass('filtered').style('opacity', 0.2);
                    cyRef.current.elements(`node[type="transaction"][success=${successValue}]`).removeClass('filtered').style('opacity', 1);
                    // Also show connected edges for visible nodes
                    cyRef.current.elements(`node[type="transaction"][success=${successValue}]`).connectedEdges().removeClass('filtered').style('opacity', 1);
                  }
                }
              }
            }}
          >
            <option value="all">All Transactions</option>
            <option value="success">Successful Only</option>
            <option value="error">Failed Only</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Layout</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            onChange={(e) => {
              const layoutType = e.target.value;
              if (cyRef.current) {
                // Disable animations for large graphs
                const elementsCount = cyRef.current.elements().length;
                const shouldAnimate = elementsCount <= 100;
                
                let layoutOptions: any = {
                  animate: shouldAnimate,
                  animationDuration: 300, // Reduced from 500
                  animationEasing: 'ease-in-out-cubic',
                  fit: true,
                  padding: 30 // Reduced from 50
                };
                
                if (layoutType === 'dagre') {
                  layoutOptions = {
                    ...layoutOptions,
                    name: 'dagre',
                    rankDir: 'LR',
                    ranker: 'tight-tree',
                    rankSep: 50, // Reduced from 100
                    nodeSep: 40, // Reduced from 80
                    edgeSep: 25, // Reduced from 50
                  };
                } else if (layoutType === 'circle') {
                  layoutOptions = {
                    ...layoutOptions,
                    name: 'circle',
                    radius: 150, // Reduced from 200
                    startAngle: 3 / 2 * Math.PI,
                    sweep: 2 * Math.PI,
                  };
                } else if (layoutType === 'grid') {
                  layoutOptions = {
                    ...layoutOptions,
                    name: 'grid',
                    rows: undefined,
                    cols: undefined,
                  };
                } else if (layoutType === 'concentric') {
                  layoutOptions = {
                    ...layoutOptions,
                    name: 'concentric',
                    minNodeSpacing: 30, // Reduced from 50
                    concentric: (node: any) => {
                      // Transactions in the center, accounts in outer rings
                      return node.data('type') === 'transaction' ? 2 : 1;
                    },
                  };
                }
                
                // For large graphs, show loading indicator
                if (elementsCount > 200) {
                  // Optional: Show a loading indicator for large graphs
                  const loadingIndicator = document.createElement('div');
                  loadingIndicator.id = 'layout-loading';
                  loadingIndicator.style.position = 'absolute';
                  loadingIndicator.style.top = '50%';
                  loadingIndicator.style.left = '50%';
                  loadingIndicator.style.transform = 'translate(-50%, -50%)';
                  loadingIndicator.style.background = 'rgba(0,0,0,0.7)';
                  loadingIndicator.style.color = 'white';
                  loadingIndicator.style.padding = '10px 20px';
                  loadingIndicator.style.borderRadius = '4px';
                  loadingIndicator.style.zIndex = '1000';
                  loadingIndicator.textContent = 'Applying layout...';
                  containerRef.current?.appendChild(loadingIndicator);
                  
                  // Use requestAnimationFrame to avoid blocking the UI
                  requestAnimationFrame(() => {
                    cyRef.current?.layout(layoutOptions).run();
                    
                    // Remove loading indicator after layout is complete
                    setTimeout(() => {
                      document.getElementById('layout-loading')?.remove();
                    }, 500);
                  });
                } else {
                  // For smaller graphs, apply layout immediately
                  cyRef.current.layout(layoutOptions).run();
                }
              }
            }}
          >
            <option value="dagre">Hierarchical (Default)</option>
            <option value="circle">Circular</option>
            <option value="grid">Grid</option>
            <option value="concentric">Concentric</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Node Limit</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            value={nodeVisibilityLimit}
            onChange={(e) => {
              const limit = Number(e.target.value);
              setNodeVisibilityLimit(limit);
            }}
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
            onChange={(e) => {
              const mode = e.target.value === 'high';
              setPerformanceMode(mode);
              
              if (cyRef.current) {
                // Apply performance optimizations
                if (mode) {
                  // Disable animations and transitions
                  cyRef.current.style()
                    .selector('node, edge')
                    .style({
                      'transition-property': 'none',
                      'transition-duration': 0
                    })
                    .update();
                  
                  // Reduce rendering quality
                  cyRef.current.userZoomingEnabled(true);
                  cyRef.current.userPanningEnabled(true);
                  cyRef.current.hideEdgesOnViewport(true);
                  cyRef.current.hideLabelsOnViewport(true);
                  cyRef.current.textureOnViewport(true);
                  cyRef.current.motionBlur(false);
                  cyRef.current.pixelRatio(1);
                  
                  // Limit visible nodes for very large graphs
                  if (nodeCount.current > 500 && nodeVisibilityLimit > 200) {
                    setNodeVisibilityLimit(200);
                  }
                } else {
                  // Restore normal settings
                  cyRef.current.style()
                    .selector('node')
                    .style({
                      'transition-property': 'background-color, border-color, border-width, opacity, scale',
                      'transition-duration': '200ms'
                    })
                    .selector('edge')
                    .style({
                      'transition-property': 'opacity, width',
                      'transition-duration': '200ms'
                    })
                    .update();
                  
                  // Restore rendering quality
                  cyRef.current.userZoomingEnabled(true);
                  cyRef.current.userPanningEnabled(true);
                  cyRef.current.hideEdgesOnViewport(false);
                  cyRef.current.hideLabelsOnViewport(false);
                  cyRef.current.textureOnViewport(false);
                  cyRef.current.motionBlur(false);
                  cyRef.current.pixelRatio('auto');
                }
              }
            }}
          >
            <option value="normal">Normal Mode</option>
            <option value="high">High Performance</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Node Limit</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            value={nodeVisibilityLimit}
            onChange={(e) => {
              const limit = Number(e.target.value);
              setNodeVisibilityLimit(limit);
            }}
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
            onChange={(e) => {
              const mode = e.target.value === 'high';
              setPerformanceMode(mode);
              
              if (cyRef.current) {
                // Apply performance optimizations
                if (mode) {
                  // Disable animations and transitions
                  cyRef.current.style()
                    .selector('node, edge')
                    .style({
                      'transition-property': 'none',
                      'transition-duration': 0
                    })
                    .update();
                  
                  // Reduce rendering quality
                  cyRef.current.userZoomingEnabled(true);
                  cyRef.current.userPanningEnabled(true);
                  cyRef.current.hideEdgesOnViewport(true);
                  cyRef.current.hideLabelsOnViewport(true);
                  cyRef.current.textureOnViewport(true);
                  cyRef.current.motionBlur(false);
                  cyRef.current.pixelRatio(1);
                  
                  // Limit visible nodes for very large graphs
                  if (nodeCount > 500 && nodeVisibilityLimit > 200) {
                    setNodeVisibilityLimit(200);
                  }
                } else {
                  // Restore normal settings
                  cyRef.current.style()
                    .selector('node')
                    .style({
                      'transition-property': 'background-color, border-color, border-width, opacity, scale',
                      'transition-duration': '200ms'
                    })
                    .selector('edge')
                    .style({
                      'transition-property': 'opacity, width',
                      'transition-duration': '200ms'
                    })
                    .update();
                  
                  // Restore rendering quality
                  cyRef.current.userZoomingEnabled(true);
                  cyRef.current.userPanningEnabled(true);
                  cyRef.current.hideEdgesOnViewport(false);
                  cyRef.current.hideLabelsOnViewport(false);
                  cyRef.current.textureOnViewport(false);
                  cyRef.current.motionBlur(false);
                  cyRef.current.pixelRatio('auto');
                }
              }
            }}
          >
            <option value="normal">Normal Mode</option>
            <option value="high">High Performance</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TransactionGraph);