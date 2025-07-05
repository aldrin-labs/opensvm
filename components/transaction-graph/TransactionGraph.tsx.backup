'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { useRouter } from 'next/navigation';
import { GraphStateCache, ViewportState } from '@/lib/graph-state-cache';
import { debounce } from '@/lib/utils';
import { TrackingStatsPanel } from './TrackingStatsPanel';
import { TransactionGraphClouds } from '../TransactionGraphClouds';
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

interface TrackingStats {
  totalTransactions: number;
  splTransfers: number;
  filteredSplTransfers: number;
  topVolumeByAddress: Array<{
    address: string;
    volume: number;
    tokenSymbol: string;
  }>;
  topVolumeByToken: Array<{
    token: string;
    volume: number;
    transactionCount: number;
  }>;
  lastUpdate: number;
  isTracking: boolean;
  trackedAddress: string | null;
}

function TransactionGraph({
  initialSignature,
  initialAccount,
  onTransactionSelect,
  clientSideNavigation = true,
  width = '100%',
  height = '100%',
  maxDepth = 2 // Reduced from 3 to 2 for better performance
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
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackedTransactionsRef = useRef<Set<string>>(new Set());
  const MAX_TRACKED_TRANSACTIONS = 50; // Reduced from 100 to 50 for better performance
  
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
  
  // Cloud view state
  const [showCloudViewPanel, setShowCloudViewPanel] = useState<boolean>(false);
  
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
  // Add a reference to the queueAccountFetch function to avoid circular dependencies
  const queueAccountFetchRef = useRef<((address: string, depth: number, parentSignature: string | null) => void) | null>(null);
  
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
      queueAccountFetchRef.current // Use ref to avoid circular dependency
    );

if (cyRef.current) {
  // Batch layout updates and only run when significant changes occur
  const elementCount = cyRef.current.elements().length;
  const shouldRunLayout = elementCount % 5 === 0; // Only run layout every 5 nodes
  
  if (shouldRunLayout) {
    cyRef.current.layout({
      name: 'dagre',
      // @ts-ignore - dagre layout options are not fully typed
      rankDir: 'TB', // Top to bottom layout
      fit: false, // Don't reset camera position
      padding: 50,
      animate: false // Disable animation to prevent blinking
    }).run();
  }
}

return result;
  }, [
    maxDepth,
    shouldExcludeAddress,
    shouldIncludeTransaction,
    fetchAccountTransactionsWithError
  ]);

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

  // Process the fetch queue in parallel
  const processAccountFetchQueue = useCallback(() => {
    processAccountFetchQueueUtil(
      fetchQueueRef,
      fetchAndProcessAccount,
      isProcessingQueueRef
    );
  }, [fetchAndProcessAccount]);

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

  // Set the ref to the queueAccountFetch function
  useEffect(() => {
    queueAccountFetchRef.current = queueAccountFetch;
  }, [queueAccountFetch]);

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
          // Only fit/center if viewport is not being preserved and it's the initial load
          if (!currentSignature || currentSignature !== signature) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
              if (cyRef.current) {
                cyRef.current.fit(elements, 50);
                cyRef.current.center();
              }
            });
          }
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

  // Address tracking functionality with rate limiting and AI filtering
  const startAddressTracking = useCallback(async (address: string) => {
    if (trackedAddress === address && isTrackingMode) return;
    
    // Stop previous tracking
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    // Clear previous tracked transactions
    trackedTransactionsRef.current.clear();
    
    setTrackedAddress(address);
    setIsTrackingMode(true);
    
    // Highlight the tracked address
    if (cyRef.current) {
      const addressNode = cyRef.current.getElementById(address);
      if (addressNode.length > 0) {
        addressNode.addClass('tracked-address');
      }
    }
    
    // Initialize tracking statistics
    setTrackingStats({
      totalTransactions: 0,
      splTransfers: 0,
      filteredSplTransfers: 0,
      topVolumeByAddress: [],
      topVolumeByToken: [],
      lastUpdate: Date.now(),
      isTracking: true,
      trackedAddress: address
    });
    
    // Initial fetch of SPL transfers (reduced limit for performance)
    try {
      const response = await fetch(`/api/account-transfers/${address}?limit=20`); // Reduced from 50 to 20
      if (response.ok) {
        const data = await response.json();
        const transfers = data.data || [];
        
        // Filter and analyze with AI
        if (transfers.length > 0) {
          const filterResponse = await fetch('/api/filter-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: transfers })
          });
          
          if (filterResponse.ok) {
            const filterData = await filterResponse.json();
            const filteredTransfers = filterData.filteredTransactions || transfers;
            
            // Update statistics
            updateTrackingStats(transfers, filteredTransfers);
            
            // Add filtered transfers to graph
            addTransfersToGraph(filteredTransfers, address);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch initial SPL transfers:', error);
    }
    
    // Start real-time polling (every 5 seconds)
    trackingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/account-transfers/${address}?limit=5`); // Reduced from 10 to 5
        if (response.ok) {
          const data = await response.json();
          const newTransfers = data.data || [];
          
          // Filter out transfers we've already processed
          const unseenTransfers = newTransfers.filter(transfer => 
            !trackedTransactionsRef.current.has(transfer.txId)
          );
          
          if (unseenTransfers.length > 0) {
            // Apply AI filtering
            const filterResponse = await fetch('/api/filter-transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactions: unseenTransfers })
            });
            
            if (filterResponse.ok) {
              const filterData = await filterResponse.json();
              const filteredTransfers = filterData.filteredTransactions || unseenTransfers;
              
              // Check rate limit
              if (trackedTransactionsRef.current.size >= MAX_TRACKED_TRANSACTIONS) {
                // Remove oldest transactions from graph and tracking
                const sortedTxIds = Array.from(trackedTransactionsRef.current).slice(0, 10);
                sortedTxIds.forEach(txId => {
                  cyRef.current?.remove(`#${txId}`);
                  trackedTransactionsRef.current.delete(txId);
                });
              }
              
              // Update statistics
              updateTrackingStats(unseenTransfers, filteredTransfers);
              
              // Add new filtered transfers to graph
              addTransfersToGraph(filteredTransfers, address);
              
              // Mark as processed
              unseenTransfers.forEach(transfer => {
                trackedTransactionsRef.current.add(transfer.txId);
              });
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch real-time SPL transfers:', error);
      }
    }, 5000); // Poll every 5 seconds
    
  }, [trackedAddress, isTrackingMode]);

  // Helper function to update tracking statistics
  const updateTrackingStats = useCallback((allTransfers: any[], filteredTransfers: any[]) => {
    setTrackingStats(prev => {
      if (!prev) return null;

      // Calculate volume by address and token
      const volumeByAddress = new Map<string, { volume: number; tokenSymbol: string }>();
      const volumeByToken = new Map<string, { volume: number; transactionCount: number }>();

      filteredTransfers.forEach(transfer => {
        const amount = parseFloat(transfer.tokenAmount || '0');
        
        // Volume by address
        const key = transfer.from || transfer.to;
        if (key) {
          const existing = volumeByAddress.get(key) || { volume: 0, tokenSymbol: transfer.tokenSymbol };
          volumeByAddress.set(key, {
            volume: existing.volume + amount,
            tokenSymbol: transfer.tokenSymbol
          });
        }
        
        // Volume by token
        const tokenKey = transfer.tokenSymbol;
        if (tokenKey) {
          const existing = volumeByToken.get(tokenKey) || { volume: 0, transactionCount: 0 };
          volumeByToken.set(tokenKey, {
            volume: existing.volume + amount,
            transactionCount: existing.transactionCount + 1
          });
        }
      });

      // Convert to sorted arrays
      const topVolumeByAddress = Array.from(volumeByAddress.entries())
        .map(([address, data]) => ({ address, ...data }))
        .sort((a, b) => b.volume - a.volume);

      const topVolumeByToken = Array.from(volumeByToken.entries())
        .map(([token, data]) => ({ token, ...data }))
        .sort((a, b) => b.volume - a.volume);

      return {
        ...prev,
        totalTransactions: prev.totalTransactions + allTransfers.length,
        splTransfers: prev.splTransfers + allTransfers.length,
        filteredSplTransfers: prev.filteredSplTransfers + filteredTransfers.length,
        topVolumeByAddress,
        topVolumeByToken,
        lastUpdate: Date.now()
      };
    });
  }, []);

  // Helper function to add transfers to graph
  const addTransfersToGraph = useCallback((transfers: any[], trackedAddress: string) => {
    if (!cyRef.current) return;

    transfers.forEach(transfer => {
      const txId = transfer.txId;
      
      // Add transaction node if it doesn't exist
      if (!cyRef.current!.getElementById(txId).length) {
        cyRef.current!.add({
          data: {
            id: txId,
            label: `${transfer.tokenSymbol}: ${parseFloat(transfer.tokenAmount).toFixed(2)}`,
            type: 'spl-transfer',
            amount: transfer.tokenAmount,
            token: transfer.tokenSymbol
          },
          classes: 'transaction spl-transfer new-transaction'
        });
        
        // Add edge connecting to tracked address
        cyRef.current!.add({
          data: {
            id: `${trackedAddress}-${txId}`,
            source: trackedAddress,
            target: txId,
            type: 'realtime'
          },
          classes: 'realtime-edge'
        });
      }
    });
    
    // Re-run layout for new elements
    if (cyRef.current && transfers.length > 0) {
      cyRef.current.layout({
        name: 'dagre',
        rankDir: 'TB',
        fit: false,
        padding: 50
      }).run();
    }
  }, []);

  // Stop tracking function
  const stopAddressTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    
    setTrackedAddress(null);
    setIsTrackingMode(false);
    setTrackingStats(null);
    trackedTransactionsRef.current.clear();
    
    // Remove tracked address highlighting
    if (cyRef.current) {
      cyRef.current.$('.tracked-address').removeClass('tracked-address');
    }
  }, []);
  
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
    // Only initialize once when container is available and no graph exists
    if (!containerRef.current || cyRef.current) {
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
          
          // Center and zoom after elements are loaded (only on initial load)
          if (cyRef.current) {
            requestAnimationFrame(() => {
              if (cyRef.current && cyRef.current.elements().length > 0) {
                cyRef.current.layout({
                  name: 'dagre',
                  // @ts-ignore - dagre layout options are not fully typed
                  rankDir: 'TB', // Top to bottom layout
                  fit: true, // Only fit on initial load
                  padding: 50,
                  animate: false // Disable animation to prevent blinking
                }).run();
                
                // Set initial zoom without animation
                setTimeout(() => {
                  if (cyRef.current) {
                    cyRef.current.zoom(0.8);
                  }
                }, 100);
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
              
              // Run layout once for cached state without camera reset
              if (cyRef.current) {
                cyRef.current.layout({
                  name: 'dagre',
                  // @ts-ignore - dagre layout options are not fully typed
                  rankDir: 'TB', // Top to bottom layout
                  fit: false, // Don't reset camera position for cached state
                  padding: 50,
                  animate: false // Disable animation to prevent blinking
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
          
          // Only set viewport on fresh data load (not cached)
          if (cyRef.current && (!cachedState || !cachedState.nodes.length)) {
            requestAnimationFrame(() => {
              if (cyRef.current) {
                cyRef.current.fit();
                cyRef.current.center();
                cyRef.current.zoom(0.8); // Improved zoom level
              }
            });
          }
              }
            });
          }

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
  }, []); // Remove dependencies to prevent re-initialization

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

  // Resize graph callback for fullscreen changes
  const resizeGraphCallback = useCallback(() => {
    if (cyRef.current && containerRef.current) {
      resizeGraph(cyRef.current, containerRef.current);
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

  // Navigation functions for back/forward history
  const navigateBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      const signature = navigationHistory[newIndex];
      setCurrentHistoryIndex(newIndex);
      setIsNavigatingHistory(true);
      focusOnTransaction(signature, false, false, false);
      setTimeout(() => setIsNavigatingHistory(false), 100);
    }
  }, [currentHistoryIndex, navigationHistory, focusOnTransaction]);

  const navigateForward = useCallback(() => {
    if (currentHistoryIndex < navigationHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      const signature = navigationHistory[newIndex];
      setCurrentHistoryIndex(newIndex);
      setIsNavigatingHistory(true);
      focusOnTransaction(signature, false, false, false);
      setTimeout(() => setIsNavigatingHistory(false), 100);
    }
  }, [currentHistoryIndex, navigationHistory, focusOnTransaction]);

  // Cloud view functions
  const showCloudView = useCallback(() => {
    setShowCloudViewPanel(true);
  }, []);

  const handleLoadGraphState = useCallback((state: any) => {
    try {
      if (cyRef.current && state.nodes) {
        // Clear current graph
        cyRef.current.elements().remove();
        
        // Load nodes and edges from saved state
        if (state.nodes.length > 0) {
          cyRef.current.add(state.nodes);
        }
        if (state.edges && state.edges.length > 0) {
          cyRef.current.add(state.edges);
        }
        
        // Apply layout
        cyRef.current.layout({
          name: 'dagre',
          // @ts-ignore - dagre layout options are not fully typed
          rankDir: 'TB', // Top to bottom layout
          fit: true,
          padding: 50
        }).run();
        
        // Update tracking state
        if (state.focusedTransaction) {
          setCurrentSignature(state.focusedTransaction);
          focusSignatureRef.current = state.focusedTransaction;
        }
        
        setShowCloudViewPanel(false);
      }
    } catch (error) {
      console.error('Error loading graph state:', error);
      setError({
        message: 'Failed to load saved graph state',
        severity: 'error'
      });
    }
  }, []);

  const handleSaveCurrentState = useCallback(() => {
    try {
      if (cyRef.current) {
        const currentState = {
          nodes: cyRef.current.nodes().map(node => ({
            data: node.data(),
            position: node.position(),
            classes: node.classes()
          })),
          edges: cyRef.current.edges().map(edge => ({
            data: edge.data(),
            classes: edge.classes()
          })),
          focusedTransaction: currentSignature,
          timestamp: Date.now()
        };
        
        GraphStateCache.saveState(currentSignature, currentState);
        setError({
          message: 'Graph state saved successfully',
          severity: 'warning'
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      console.error('Error saving graph state:', error);
      setError({
        message: 'Failed to save graph state',
        severity: 'error'
      });
    }
  }, [currentSignature]);

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
      {/* Address tracking statistics panel */}
      <TrackingStatsPanel 
        stats={trackingStats}
        onStopTracking={stopAddressTracking}
      />

      {/* Cloud view panel for saved graph states */}
      {showCloudViewPanel && (
        <div className="absolute top-4 left-4 z-30">
          <TransactionGraphClouds
            currentFocusedTransaction={currentSignature}
            onLoadState={handleLoadGraphState}
            onSaveCurrentState={handleSaveCurrentState}
          />
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
          // GPU acceleration hints
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
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

export default TransactionGraph;
