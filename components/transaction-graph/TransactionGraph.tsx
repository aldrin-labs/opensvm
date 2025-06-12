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
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Address tracking state
  const [trackedAddress, setTrackedAddress] = useState<string | null>(null);
  const [isTrackingMode, setIsTrackingMode] = useState<boolean>(false);
  const [addressStats, setAddressStats] = useState<{
    totalTransactions: number;
    recentTransactions: any[];
    lastUpdate: number;
    averageInterval: number;
  } | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
    rankDir: 'TB', // Top to bottom layout
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
      setViewportState,
      startAddressTracking // Pass address tracking callback
    );
  }, [focusOnTransaction, startAddressTracking]);

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
  rankDir: 'TB', // Top to bottom layout
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
                  rankDir: 'TB', // Top to bottom layout
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

  // Fullscreen functionality
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).mozRequestFullScreen) {
          await (containerRef.current as any).mozRequestFullScreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, [isFullscreen]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Resize graph when entering/exiting fullscreen
      if (cyRef.current) {
        setTimeout(() => {
          resizeGraphCallback();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [resizeGraphCallback]);

  // Address tracking functionality
  const startAddressTracking = useCallback(async (address: string) => {
    if (trackedAddress === address && isTrackingMode) return;
    
    // Stop previous tracking
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    setTrackedAddress(address);
    setIsTrackingMode(true);
    
    // Highlight the tracked address
    if (cyRef.current) {
      const addressNode = cyRef.current.getElementById(address);
      if (addressNode.length > 0) {
        addressNode.addClass('tracked-address');
      }
    }
    
    // Initial fetch of address statistics
    try {
      const response = await fetch(`/api/account-transactions/${address}?limit=20`);
      if (response.ok) {
        const data = await response.json();
        const transactions = data.transactions || [];
        
        setAddressStats({
          totalTransactions: transactions.length,
          recentTransactions: transactions.slice(0, 5),
          lastUpdate: Date.now(),
          averageInterval: transactions.length > 1 ? 
            (Date.now() - new Date(transactions[transactions.length - 1].timestamp).getTime()) / transactions.length 
            : 0
        });
      }
    } catch (error) {
      console.warn('Failed to fetch initial address stats:', error);
    }
    
    // Start real-time polling (every 5 seconds)
    trackingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/account-transactions/${address}?limit=5`);
        if (response.ok) {
          const data = await response.json();
          const newTransactions = data.transactions || [];
          
          setAddressStats(prev => {
            if (!prev) return null;
            
            // Check for new transactions by comparing timestamps
            const lastKnownTimestamp = prev.recentTransactions[0]?.timestamp;
            const newTxs = newTransactions.filter(tx => 
              !lastKnownTimestamp || new Date(tx.timestamp) > new Date(lastKnownTimestamp)
            );
            
            if (newTxs.length > 0) {
              // Add new transactions to the graph
              newTxs.forEach(tx => {
                if (cyRef.current && !cyRef.current.getElementById(tx.signature).length) {
                  cyRef.current.add({
                    data: {
                      id: tx.signature,
                      label: `${tx.signature.slice(0, 8)}...`,
                      type: 'transaction'
                    },
                    classes: 'transaction new-transaction'
                  });
                  
                  // Add edge connecting to tracked address
                  cyRef.current.add({
                    data: {
                      id: `${address}-${tx.signature}`,
                      source: address,
                      target: tx.signature,
                      type: 'realtime'
                    },
                    classes: 'realtime-edge'
                  });
                }
              });
              
              // Re-run layout for new elements
              if (cyRef.current) {
                cyRef.current.layout({
                  name: 'dagre',
                  rankDir: 'TB',
                  fit: false,
                  padding: 50
                }).run();
              }
            }
            
            return {
              ...prev,
              totalTransactions: prev.totalTransactions + newTxs.length,
              recentTransactions: [...newTxs, ...prev.recentTransactions].slice(0, 5),
              lastUpdate: Date.now()
            };
          });
        }
      } catch (error) {
        console.warn('Failed to fetch real-time transactions:', error);
      }
    }, 5000); // Poll every 5 seconds
    
  }, [trackedAddress, isTrackingMode]);

  const stopAddressTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    
    setTrackedAddress(null);
    setIsTrackingMode(false);
    setAddressStats(null);
    
    // Remove real-time styling from graph
    if (cyRef.current) {
      cyRef.current.elements('.new-transaction, .realtime-edge').remove();
      cyRef.current.elements().removeClass('tracked-address');
    }
  }, []);

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
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
    <div className={`transaction-graph-wrapper relative w-full h-full transition-all flex flex-col ${isFullscreen ? 'bg-background' : ''}`}>
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

      {/* Address tracking panel */}
      {isTrackingMode && trackedAddress && (
        <div className="absolute top-4 left-4 bg-background/95 p-4 rounded-lg shadow-lg border border-primary/20 backdrop-blur-sm max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-primary">Real-time Monitoring</h3>
            <button 
              onClick={stopAddressTracking}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Stop tracking"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Address:</span>
              <div className="font-mono text-xs break-all mt-1">
                {trackedAddress.slice(0, 20)}...{trackedAddress.slice(-8)}
              </div>
            </div>
            
            {addressStats && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Total TXs:</span>
                    <div className="font-semibold">{addressStats.totalTransactions}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last update:</span>
                    <div className="font-semibold">
                      {new Date(addressStats.lastUpdate).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                {addressStats.recentTransactions.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Recent:</span>
                    <div className="mt-1 space-y-1">
                      {addressStats.recentTransactions.slice(0, 3).map((tx, i) => (
                        <div key={tx.signature} className="text-xs font-mono truncate bg-muted/30 px-2 py-1 rounded">
                          {tx.signature.slice(0, 12)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2 text-success">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-xs">Live monitoring active</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className={`cytoscape-container w-full bg-muted/50 rounded-lg border border-border overflow-hidden ${isFullscreen ? 'rounded-none border-none bg-background' : ''}`}
        style={{ 
          width: '100%', 
          height: isFullscreen ? '100vh' : '100%', // Full viewport height in fullscreen
          position: 'relative',
          overflow: 'hidden',
          margin: isFullscreen ? '0' : '0 auto', // Remove margin in fullscreen
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
        
        {/* Fullscreen button */}
        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
              <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
              <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
              <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
            </svg>
          )}
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
