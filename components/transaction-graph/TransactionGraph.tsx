'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { useRouter } from 'next/navigation';
import { GraphStateCache, ViewportState } from '@/lib/graph-state-cache';
import { debounce } from '@/lib/utils';
import { TrackingStatsPanel } from './TrackingStatsPanel';
import { TransactionGraphClouds } from '../TransactionGraphClouds';
import { GPUAcceleratedForceGraph } from './GPUAcceleratedForceGraph';
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
  focusOnTransaction as focusOnTransactionUtil,
  debugLog,
  errorLog
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
  
  // Layout control refs - prevent excessive layout runs with proper debouncing
  const lastLayoutTime = useRef<number>(0);
  const layoutCooldown = useRef<boolean>(false);
  const pendingLayoutRef = useRef<NodeJS.Timeout | null>(null);
  const layoutAbortControllerRef = useRef<AbortController | null>(null);
  
  // Enhanced initialization control to prevent race conditions
  const initializationAbortControllerRef = useRef<AbortController | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  
  // Viewport state preservation
  const preservedViewport = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // GPU Force Graph State
  const [useGPUGraph, setUseGPUGraph] = useState<boolean>(true); // Always use GPU by default
  const [gpuGraphData, setGpuGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  
  // Debug GPU graph data changes
  useEffect(() => {
    debugLog(`🔄 [GPU_STATE] GPU graph data changed: ${gpuGraphData.nodes.length} nodes, ${gpuGraphData.links.length} links`);
    gpuGraphData.nodes.forEach(node => {
      debugLog(`🔄 [GPU_STATE] Node: ${node.id} (${node.type})`);
    });
    gpuGraphData.links.forEach(link => {
      debugLog(`🔄 [GPU_STATE] Link: ${link.source} -> ${link.target}`);
    });
  }, [gpuGraphData]);
  
  // Address tracking state
  const [trackedAddress, setTrackedAddress] = useState<string | null>(null);
  const [isTrackingMode, setIsTrackingMode] = useState<boolean>(false);
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackedTransactionsRef = useRef<Set<string>>(new Set());
  const MAX_TRACKED_TRANSACTIONS = 50; // Reduced from 100 to 50 for better performance
  
  // Excluded accounts and program identifiers
  const EXCLUDED_ACCOUNTS = useMemo(() => new Set([
    'ComputeBudget111111111111111111111111111111',
    '11111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    'SysvarRent111111111111111111111111111111111',
    'SysvarC1ock11111111111111111111111111111111',
    'SysvarRecentB1ockHashes11111111111111111111',
    'MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
  ]), []);

  const EXCLUDED_PROGRAM_SUBSTRINGS = useMemo(() => [
    'jupiter',
    'raydium',
    'orca',
    'serum',
    'whirlpool',
    'liquidity',
    'swap',
    'dex',
    'amm',
    'farm',
    'vault',
    'pool',
    'token-2022',
    'memo',
    'log',
    'instruction'
  ], []);

  // State management
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [expandedNodesCount, setExpandedNodesCount] = useState<number>(0);
  const [currentSignature, setCurrentSignature] = useState<string>(initialSignature);
  const [error, setError] = useState<{message: string; severity: 'error' | 'warning'} | null>(null);
  const [viewportState, setViewportState] = useState<ViewportState | null>(null);

  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [isNavigatingHistory, setIsNavigatingHistory] = useState<boolean>(false);

  // Cloud view state
  const [showCloudViewPanel, setShowCloudViewPanel] = useState<boolean>(false);

  // Refs for tracking state
  const processedNodesRef = useRef<Set<string>>(new Set());
  const processedEdgesRef = useRef<Set<string>>(new Set());
  const loadedTransactionsRef = useRef<Set<string>>(new Set());
  const loadedAccountsRef = useRef<Set<string>>(new Set());
  const transactionCache = useRef<Map<string, any>>(new Map());
  const pendingFetchesRef = useRef<Set<string>>(new Set());
  const isProcessingQueueRef = useRef<boolean>(false);
  const fetchQueueRef = useRef<Array<{address: string; depth: number; parentSignature: string | null}>>([]);
  const queueAccountFetchRef = useRef<any>(null);
  const focusSignatureRef = useRef<string>(initialSignature);
  const initialSignatureRef = useRef<string>(initialSignature);
  const initialAccountRef = useRef<string>(initialAccount);

  const router = useRouter();

  // Filtering functions
  const shouldExcludeAddress = useMemo(
    () => createAddressFilter(EXCLUDED_ACCOUNTS, EXCLUDED_PROGRAM_SUBSTRINGS),
    [EXCLUDED_ACCOUNTS, EXCLUDED_PROGRAM_SUBSTRINGS]
  );

  const shouldIncludeTransaction = useMemo(
    () => createTransactionFilter(shouldExcludeAddress),
    [shouldExcludeAddress]
  );

  // Check for empty graph after loading completes
  useEffect(() => {
    if (!loading && !error && cyRef.current) {
      const nodes = cyRef.current.nodes();
      const transactions = nodes.filter(node => node.data('type') === 'transaction');
      
      console.log(`📊 [EMPTY_CHECK] Graph status: ${nodes.length} total nodes, ${transactions.length} transactions`);
      
      if (nodes.length === 0) {
        console.log(`⚠️ [EMPTY_CHECK] Completely empty graph detected`);
        setError({
          message: 'No graph data could be loaded. This might be due to network issues or the account having no transaction history.',
          severity: 'warning'
        });
      } else if (transactions.length === 0) {
        console.log(`⚠️ [EMPTY_CHECK] Graph has nodes but no transactions`);
        setError({
          message: 'Graph loaded but no transactions found. This account might only have system operations that are not currently visualized.',
          severity: 'warning'
        });
      } else if (transactions.length < 2) {
        console.log(`ℹ️ [EMPTY_CHECK] Graph has very few transactions (${transactions.length})`);
        setError({
          message: `Limited transaction data found (${transactions.length} transaction${transactions.length === 1 ? '' : 's'}). This account might have limited SPL transfer activity.`,
          severity: 'warning'
        });
      } else {
        console.log(`✅ [EMPTY_CHECK] Graph has adequate data: ${transactions.length} transactions`);
      }
    }
  }, [loading, error]);

  // Enhanced layout function with proper debouncing and cancellation
  const runLayoutOptimized = useCallback((fit = false, animate = false) => {
    if (!cyRef.current || layoutCooldown.current) return;
    
    // Cancel any pending layout
    if (pendingLayoutRef.current) {
      clearTimeout(pendingLayoutRef.current);
      pendingLayoutRef.current = null;
    }
    
    // Cancel any existing layout operation
    if (layoutAbortControllerRef.current && !layoutAbortControllerRef.current.signal.aborted) {
      layoutAbortControllerRef.current.abort();
    }
    
    const now = Date.now();
    const timeSinceLastLayout = now - lastLayoutTime.current;
    
    // Enhanced debouncing: longer cooldown for rapid calls, shorter for normal operations
    const minCooldown = fit ? 500 : 1500; // Longer cooldown for non-fit layouts to reduce thrashing
    
    if (timeSinceLastLayout < minCooldown) {
      // Debounce with exponential backoff for rapid calls
      const delay = Math.min(minCooldown - timeSinceLastLayout, 2000);
      pendingLayoutRef.current = setTimeout(() => {
        pendingLayoutRef.current = null;
        runLayoutOptimized(fit, animate);
      }, delay);
      return;
    }
    
    lastLayoutTime.current = now;
    layoutCooldown.current = true;
    
    // Create new abort controller for this layout operation
    layoutAbortControllerRef.current = new AbortController();
    const currentAbortController = layoutAbortControllerRef.current;
    
    // Preserve viewport if not fitting
    if (!fit && cyRef.current) {
      preservedViewport.current = {
        zoom: cyRef.current.zoom(),
        pan: cyRef.current.pan()
      };
    }
    
    const layout = cyRef.current.layout({
      name: 'dagre',
      // @ts-ignore - dagre layout options
      rankDir: 'TB',
      fit: fit,
      padding: 50,
      animate: animate,
      animationDuration: animate ? 300 : 0,
      stop: () => {
        // Check if this layout operation was cancelled
        if (currentAbortController.signal.aborted) {
          return;
        }
        
        layoutCooldown.current = false;
        
        // Restore viewport if it was preserved
        if (!fit && preservedViewport.current && cyRef.current) {
          cyRef.current.zoom(preservedViewport.current.zoom);
          cyRef.current.pan(preservedViewport.current.pan);
          preservedViewport.current = null;
        }
        
        // Clear the abort controller if this is the current one
        if (layoutAbortControllerRef.current === currentAbortController) {
          layoutAbortControllerRef.current = null;
        }
      }
    });
    
    // Check if operation was cancelled before running
    if (!currentAbortController.signal.aborted) {
      layout.run();
    }
  }, []);

  // Enhanced fetch function with better error handling
  const fetchTransactionDataWithCache = useCallback(async (signature: string, signal?: AbortSignal) => {
    return fetchTransactionData(signature, transactionCache.current);
  }, []);

  const fetchAccountTransactionsWithError = useCallback(async (pubkey: string, signal?: AbortSignal) => {
    try {
      return await fetchAccountTransactions(pubkey, signal);
    } catch (error) {
      console.error(`Error fetching transactions for ${pubkey}:`, error);
      return { address: pubkey, transactions: [] };
    }
  }, []);

  // Helper function to check if an account has SPL transfers with timeout
  const checkForSplTransfers = useCallback(async (address: string): Promise<boolean> => {
    console.log(`🔍 [SPL_CHECK] Starting SPL transfer check for ${address}`);
    try {
      // Add a timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ [SPL_CHECK] Timeout reached for ${address}, aborting...`);
        controller.abort();
      }, 3000); // 3 second timeout
      
      console.log(`🌐 [SPL_CHECK] Making API request for ${address}`);
      const response = await fetch(`/api/account-transfers/${address}?limit=1`, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`📡 [SPL_CHECK] API response for ${address}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        const hasSplTransfers = (data.data && data.data.length > 0);
        console.log(`✅ [SPL_CHECK] Result for ${address}: ${hasSplTransfers ? 'HAS' : 'NO'} SPL transfers`);
        return hasSplTransfers;
      }
      console.log(`⚠️ [SPL_CHECK] Non-OK response for ${address}, returning false`);
      return false;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`⏰ [SPL_CHECK] SPL transfer check timed out for ${address}`);
      } else {
        console.warn(`❌ [SPL_CHECK] Could not check SPL transfers for ${address}:`, error);
      }
      console.log(`🔄 [SPL_CHECK] Defaulting to false for ${address}`);
      return false; // Default to no SPL transfers on error/timeout
    }
  }, []);

  // Convert Cytoscape data to GPU graph format
  const convertToGPUGraphData = useCallback(() => {
    if (!cyRef.current) {
      console.log('🔄 [GPU_CONVERT] No Cytoscape instance, returning empty data');
      return { nodes: [], links: [] };
    }

    const cytoscapeNodes = cyRef.current.nodes();
    const cytoscapeEdges = cyRef.current.edges();
    
    console.log(`🔄 [GPU_CONVERT] Converting Cytoscape data: ${cytoscapeNodes.length} nodes, ${cytoscapeEdges.length} edges`);

    const nodes = cytoscapeNodes.map((node) => {
      const data = node.data();
      
      // Determine node color based on type and status
      let color = '#64748b'; // Default gray
      if (data.type === 'transaction') {
        if (data.success === false || data.status === 'error') {
          color = '#ef4444'; // Red for failed transactions
        } else {
          color = '#3b82f6'; // Blue for successful transactions
        }
      } else if (data.type === 'account') {
        if (data.tracked) {
          color = '#8b5cf6'; // Purple for tracked accounts
        } else if (data.status === 'error' || data.hasError) {
          color = '#f59e0b'; // Orange for accounts with errors
        } else if (data.isEmpty || data.status === 'empty') {
          color = '#6b7280'; // Gray for empty accounts
        } else {
          color = '#10b981'; // Green for normal accounts
        }
      }
      
      const convertedNode = {
        id: data.id,
        type: data.type || 'account',
        subType: data.subType || data.type || 'unknown',
        label: data.label || data.id,
        status: data.status,
        tracked: data.tracked || false,
        isEmpty: data.isEmpty || false,
        hasError: data.hasError || false,
        transactionCount: data.transactionCount || 0,
        accountCount: data.accountCount || 0,
        color: color
      };
      console.log(`🔄 [GPU_CONVERT] Converted node: ${data.id} (${data.type}/${data.subType || 'none'})`);
      return convertedNode;
    });

    const links = cytoscapeEdges.map((edge) => {
      const data = edge.data();
      
      // Determine edge color based on type
      let color = '#64748b'; // Default gray
      if (data.type === 'transfer') {
        color = '#10b981'; // Green for transfers
      } else if (data.type === 'self-transfer') {
        color = '#f59e0b'; // Orange for self-transfers (fees/operations)
      } else if (data.type === 'tx-account') {
        color = '#6b7280'; // Gray for tx-account relationships
      } else if (data.type === 'account-tx') {
        color = '#94a3b8'; // Light gray for account-tx relationships
      }
      
      const convertedLink = {
        source: data.source,
        target: data.target,
        type: data.type || 'interaction',
        value: data.value || 1,
        amount: data.amount,
        label: data.label,
        color: color
      };
      console.log(`🔄 [GPU_CONVERT] Converted edge: ${data.source} -> ${data.target} (${data.type})`);
      return convertedLink;
    });

    console.log(`✅ [GPU_CONVERT] Conversion complete: ${nodes.length} nodes, ${links.length} links`);
    
    // Log summary statistics
    const nodeStats = nodes.reduce((stats: Record<string, number>, node) => {
      const key = `${node.type}${node.subType ? `/${node.subType}` : ''}`;
      stats[key] = (stats[key] || 0) + 1;
      return stats;
    }, {});
    console.log(`✅ [GPU_CONVERT] Node statistics:`, nodeStats);
    
    const linkStats = links.reduce((stats: Record<string, number>, link) => {
      stats[link.type] = (stats[link.type] || 0) + 1;
      return stats;
    }, {});
    console.log(`✅ [GPU_CONVERT] Link statistics:`, linkStats);
    
    return { nodes, links };
  }, []);

  // Update GPU graph data when Cytoscape changes
  const updateGPUGraphData = useCallback(() => {
    if (useGPUGraph) {
      console.log('🔄 [GPU_UPDATE] Updating GPU graph data...');
      const newData = convertToGPUGraphData();
      console.log(`🔄 [GPU_UPDATE] Setting GPU graph data: ${newData.nodes.length} nodes, ${newData.links.length} links`);
      
      // Log what types of nodes we have
      const nodeTypes = newData.nodes.reduce((types: Record<string, number>, node) => {
        types[node.type] = (types[node.type] || 0) + 1;
        return types;
      }, {});
      console.log(`🔄 [GPU_UPDATE] Node types:`, nodeTypes);
      
      // Log what types of links we have
      const linkTypes = newData.links.reduce((types: Record<string, number>, link) => {
        types[link.type] = (types[link.type] || 0) + 1;
        return types;
      }, {});
      console.log(`🔄 [GPU_UPDATE] Link types:`, linkTypes);
      
      // Log sample data for debugging
      if (newData.nodes.length > 0) {
        console.log(`🔄 [GPU_UPDATE] Sample node:`, newData.nodes[0]);
      }
      if (newData.links.length > 0) {
        console.log(`🔄 [GPU_UPDATE] Sample link:`, newData.links[0]);
      }
      
      setGpuGraphData(newData);
      console.log('✅ [GPU_UPDATE] GPU graph data updated successfully');
      
      // Enhanced feedback for empty graphs
      if (newData.nodes.length === 0) {
        console.log('🚨 [GPU_UPDATE] CRITICAL: GPU graph is empty after update');
        console.log('🚨 [GPU_UPDATE] Cytoscape elements count:', cyRef.current?.elements().length || 0);
        
        // Force an error message to show user why graph is empty
        setError({
          message: 'No transaction data could be visualized. The account may have no recent activity or only system transactions.',
          severity: 'warning'
        });
        
        // Clear the warning after some time
        setTimeout(() => {
          setError(null);
        }, 8000);
      } else if (newData.nodes.length === 1 && newData.links.length === 0) {
        console.log('⚠️ [GPU_UPDATE] WARNING: GPU graph has only isolated node');
        
        // Show informative message about limited data
        setError({
          message: `Showing limited data: Found ${newData.nodes.length} node(s) but no connections. This account may have minimal transaction activity.`,
          severity: 'info'
        });
        
        // Clear the info message after some time
        setTimeout(() => {
          setError(null);
        }, 6000);
      } else {
        console.log(`✅ [GPU_UPDATE] Good data: ${newData.nodes.length} nodes and ${newData.links.length} links`);
        
        // Clear any previous error messages
        setError(null);
      }
      
      // Force a UI re-render to ensure the graph component updates
      setTimeout(() => {
        if (containerRef.current) {
          console.log('🔄 [GPU_UPDATE] Forcing container resize to trigger re-render');
          const resizeEvent = new Event('resize');
          window.dispatchEvent(resizeEvent);
        }
      }, 100);
    } else {
      console.log('🔄 [GPU_UPDATE] GPU graph disabled, skipping update');
    }
  }, [useGPUGraph, convertToGPUGraphData]);

  // Optimized addAccountToGraph with reduced layout calls and fallback depth
  const addAccountToGraph = useCallback(async (
    address: string,
    totalAccounts: number,
    depth = 0,
    parentSignature: string | null = null
  ) => {
    try {
      console.log(`🏗️ [ADD_ACCOUNT] Adding account to graph: ${address}, depth: ${depth}, totalAccounts: ${totalAccounts}`);
      
      // Always mark account as processed first to guarantee progress
      if (!loadedAccountsRef.current) {
        loadedAccountsRef.current = new Set();
      }
      loadedAccountsRef.current.add(address);
      pendingFetchesRef.current?.delete(`${address}:${depth}`);
      
      // Update progress immediately
      const loadedCount = loadedAccountsRef.current.size;
      const currentTotalAccounts = Math.max(totalAccounts, 1);
      const progressPercent = Math.min((loadedCount / currentTotalAccounts) * 80 + 20, 100);
      
      setLoadingProgress(Math.floor(progressPercent));
      console.log(`📈 [PROGRESS] Progress updated: ${loadedCount}/${currentTotalAccounts} accounts (${Math.floor(progressPercent)}%)`);
      
      // Check if this account has SPL transfers first to determine max depth
      let hasSplTransfers = false;
      try {
        console.log(`🔍 [SPL_CHECK] Checking SPL transfers for ${address}...`);
        hasSplTransfers = await checkForSplTransfers(address);
        console.log(`✅ [SPL_CHECK] SPL check result for ${address}: ${hasSplTransfers}`);
      } catch (error) {
        console.warn(`⚠️ [SPL_CHECK] SPL transfer check failed for ${address}, proceeding with fallback:`, error);
        hasSplTransfers = false;
      }
      
      // More lenient depth settings: allow depth 1 for non-SPL accounts instead of 0
      const effectiveMaxDepth = hasSplTransfers ? maxDepth : Math.min(1, maxDepth); // Depth 1 for non-SPL (minimal expansion)
      
      console.log(`🎯 [CONFIG] Account ${address}: hasSplTransfers=${hasSplTransfers}, effectiveMaxDepth=${effectiveMaxDepth}`);
      
      // If no SPL transfers, show warning but still proceed
      if (!hasSplTransfers) {
        console.log(`⚠️ [CONFIG] Account ${address} has no SPL transfers, using reduced depth but still processing`);
        
        // Update the error state to show a helpful message
        setError({
          message: `Account ${address.slice(0, 8)}... has limited SPL transfer activity. Showing system transactions instead.`,
          severity: 'warning'
        });
        
        // Clear the warning after a few seconds
        setTimeout(() => {
          setError(null);
        }, 5000);
      }
      
      console.log(`🚀 [CALLING] Calling addAccountToGraphUtil for ${address}`);
      
      // Ensure all refs are initialized before calling the function
      if (!processedNodesRef.current) {
        processedNodesRef.current = new Set();
      }
      if (!processedEdgesRef.current) {
        processedEdgesRef.current = new Set();
      }
      if (!loadedAccountsRef.current) {
        loadedAccountsRef.current = new Set();
      }
      if (!loadedTransactionsRef.current) {
        loadedTransactionsRef.current = new Set();
      }
      if (!pendingFetchesRef.current) {
        pendingFetchesRef.current = new Set();
      }
      
      const result = await addAccountToGraphUtil(
        address,
        totalAccounts,
        depth,
        parentSignature,
        undefined, // newElements
        effectiveMaxDepth, // maxDepth - now 0 for non-SPL accounts
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
        queueAccountFetchRef.current
      );
      
      console.log(`✅ [RESULT] addAccountToGraphUtil completed for ${address}:`, result ? 'success' : 'failed');

      // Only run layout every 8 nodes to reduce blinking and improve performance
      if (cyRef.current) {
        const elementCount = cyRef.current.elements().length;
        console.log(`📊 [LAYOUT] Current element count: ${elementCount}`);
        if (elementCount % 8 === 0) { // Increased from 5 to 8 for better performance
          console.log(`🎨 [LAYOUT] Running layout optimization (every 8 nodes)`);
          runLayoutOptimized(false, false);
        }
        
        // Update GPU graph after adding data
        console.log(`🔄 [GPU_TRIGGER] Triggering GPU graph update after adding account ${address}`);
        updateGPUGraphData();
      }

      return result;
    } catch (error) {
      console.error(`❌ [ERROR] Error in addAccountToGraph for ${address}:`, error);
      // Ensure account is marked as processed even if there's an error
      if (!loadedAccountsRef.current) {
        loadedAccountsRef.current = new Set();
      }
      loadedAccountsRef.current.add(address);
      pendingFetchesRef.current?.delete(`${address}:${depth}`);
      
      // Update progress even on error to prevent getting stuck
      const loadedCount = loadedAccountsRef.current.size;
      const currentTotalAccounts = Math.max(totalAccounts, 1);
      const progressPercent = Math.min((loadedCount / currentTotalAccounts) * 80 + 20, 100);
      
      setLoadingProgress(Math.floor(progressPercent));
      console.log(`📈 [ERROR_RECOVERY] Progress update (error recovery): ${loadedCount}/${currentTotalAccounts} accounts (${Math.floor(progressPercent)}%)`);
      
      return undefined;
    }
  }, [
    shouldExcludeAddress,
    shouldIncludeTransaction,
    fetchAccountTransactionsWithError,
    runLayoutOptimized,
    maxDepth,
    checkForSplTransfers,
    updateGPUGraphData
  ]);

  // Fetch and process a single account
  const fetchAndProcessAccount = useCallback(async (
    address: string,
    depth = 0,
    parentSignature: string | null = null
  ) => {
    console.log(`🔄 [FETCH_PROCESS] Starting fetch and process for account: ${address}, depth: ${depth}, parent: ${parentSignature}`);
    try {
      // Use current totalAccounts state value instead of closure value
      const currentTotalAccounts = totalAccounts || 1; // Ensure minimum of 1
      console.log(`📊 [FETCH_PROCESS] Current total accounts: ${currentTotalAccounts}`);
      
      console.log(`🚀 [FETCH_PROCESS] Calling addAccountToGraph for ${address}...`);
      await addAccountToGraph(address, currentTotalAccounts, depth, parentSignature);
      console.log(`✅ [FETCH_PROCESS] Successfully processed account: ${address}`);
    } catch (e) {
      const accountKey = `${address}:${depth}`;
      console.error(`❌ [FETCH_PROCESS] Error processing account ${address}:`, e);
      pendingFetchesRef.current?.delete(accountKey);
      loadedAccountsRef.current?.add(address); // Still mark as processed to avoid getting stuck
      
      // Force progress update even on error
      const loadedCount = loadedAccountsRef.current?.size || 0;
      const currentTotalAccounts = Math.max(totalAccounts, 1);
      const progressPercent = Math.min((loadedCount / currentTotalAccounts) * 80 + 20, 100);
      setLoadingProgress(Math.floor(progressPercent));
      console.log(`📈 [FETCH_PROCESS] Force progress update on error: ${Math.floor(progressPercent)}%`);
    }
  }, [addAccountToGraph, totalAccounts]);



  // GPU Graph event handlers
  const handleGPUNodeClick = useCallback((node: any) => {
    if (node.type === 'transaction') {
      // Use the focus function when it's available
      if (cyRef.current) {
        focusOnTransactionUtil(node.id, false, cyRef, onTransactionSelect, clientSideNavigation);
      }
    } else if (node.type === 'account') {
      // Handle account selection
      console.log('Account clicked:', node.id);
    }
  }, [onTransactionSelect, clientSideNavigation]);

  const handleGPUNodeHover = useCallback((node: any) => {
    // Handle node hover for GPU graph
    if (node) {
      console.log('Hovered node:', node.id);
    }
  }, []);

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
    debugLog(`📝 [QUEUE] Attempting to queue account: ${address}, depth: ${depth}, parent: ${parentSignature}`);
    
    if (!address || loadedAccountsRef.current.has(address) || pendingFetchesRef.current.has(`${address}:${depth}`)) {
      debugLog(`⏭️ [QUEUE] Skipping ${address}: already loaded or pending`);
      return;
    }
    
    debugLog(`✅ [QUEUE] Queuing account ${address} for processing`);
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
    
    debugLog(`📊 [QUEUE] Queue status - Length: ${fetchQueueRef.current.length}, Total accounts: ${totalAccounts}`);
  }, [processAccountFetchQueue, totalAccounts]);

  // Set the ref to the queueAccountFetch function
  useEffect(() => {
    queueAccountFetchRef.current = queueAccountFetch;
  }, [queueAccountFetch]);

  // Expand the transaction graph incrementally
  const expandTransactionGraph = useCallback(async (signature: string, signal?: AbortSignal) => {
    if (loadedTransactionsRef.current.has(signature)) return false;
    
    // Preserve viewport before expansion
    if (cyRef.current) {
      preservedViewport.current = {
        zoom: cyRef.current.zoom(),
        pan: cyRef.current.pan()
      };
    }
    
    const result = await expandTransactionGraphUtil(
      signature,
      cyRef,
      fetchTransactionDataWithCache,
      queueAccountFetch,
      addAccountToGraph,
      setExpandedNodesCount,
      loadedTransactionsRef,
      signal
    );
    
    // Run layout after expansion but preserve viewport
    if (result && cyRef.current) {
      runLayoutOptimized(false, false);
    }
    
    return result;
  }, [fetchTransactionDataWithCache, queueAccountFetch, addAccountToGraph, runLayoutOptimized]);

  // Focus on a specific transaction with optimized viewport handling
  const focusOnTransaction = useCallback(async (
    signature: string,
    addToHistory = true,
    incrementalLoad = true,
    preserveViewport = true
  ) => {
    if (!signature) return;

    const loadingKey = `loading_${signature}`;
    if (pendingFetchesRef.current.has(loadingKey)) {
      return;
    }

    try {
      pendingFetchesRef.current.add(loadingKey);
      setCurrentSignature(signature);
      focusSignatureRef.current = signature;

      const useNavigation = clientSideNavigation && !isNavigatingHistory;

      if (incrementalLoad) {
        await focusOnTransactionUtil(
          signature,
          cyRef,
          focusSignatureRef,
          setCurrentSignature,
          viewportState,
          setViewportState,
          expandTransactionGraph,
          onTransactionSelect,
          router,
          false, // Force client-side navigation to false
          incrementalLoad,
          preserveViewport
        );
      }
      
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

      // Only fit/center if viewport is not being preserved and it's the initial load
      if (!preserveViewport && cyRef.current) {
        const elements = cyRef.current.elements();
        if (elements.length > 0 && (!currentSignature || currentSignature !== signature)) {
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
    currentSignature
  ]);

  // Address tracking functionality
  const startAddressTracking = useCallback(async (address: string) => {
    if (trackedAddress === address && isTrackingMode) return;
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    trackedTransactionsRef.current.clear();
    setTrackedAddress(address);
    setIsTrackingMode(true);
    
    if (cyRef.current) {
      const addressNode = cyRef.current.getElementById(address);
      if (addressNode.length > 0) {
        addressNode.addClass('tracked-address');
      }
    }
    
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

    // Simplified tracking with reduced API calls
    try {
      const response = await fetch(`/api/account-transfers/${address}?limit=10`); // Reduced from 20 to 10
      if (response.ok) {
        const data = await response.json();
        const transfers = data.data || [];
        
        if (transfers.length > 0) {
          const filterResponse = await fetch('/api/filter-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: transfers.slice(0, 10) }) // Only process 10 transactions
          });
          
          if (filterResponse.ok) {
            const filteredData = await filterResponse.json();
            // Process filtered transactions without excessive graph updates
          }
        }
      }
    } catch (error) {
      console.error('Error starting address tracking:', error);
    }
  }, [trackedAddress, isTrackingMode]);

  const stopAddressTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    setTrackedAddress(null);
    setIsTrackingMode(false);
    setTrackingStats(null);
    trackedTransactionsRef.current.clear();
    
    if (cyRef.current) {
      cyRef.current.elements('.tracked-address').removeClass('tracked-address');
    }
  }, []);

  // Setup graph interactions
  const setupGraphInteractionsCallback = useCallback((cy: cytoscape.Core) => {
    setupGraphInteractions(
      cy,
      containerRef,
      focusSignatureRef,
      focusOnTransaction,
      (state: ViewportState) => {
        // Update viewport state - placeholder implementation
        console.log('Viewport state updated:', state);
      },
      startAddressTracking
    );
  }, [focusOnTransaction, startAddressTracking]);

  // Initialize graph once with enhanced race condition protection
  useEffect(() => {
    if (!containerRef.current || cyRef.current || isInitializingRef.current) {
      return;
    }

    // Find the Cytoscape data container
    const cytoscapeContainer = containerRef.current.querySelector('#cytoscape-data-container') as HTMLDivElement;
    if (!cytoscapeContainer) {
      console.error('Cytoscape data container not found');
      return;
    }

    // Set initializing flag to prevent race conditions
    isInitializingRef.current = true;
    isInitialized.current = false;
    timeoutIds.current = [];

    // Cancel any existing initialization
    if (initializationAbortControllerRef.current) {
      initializationAbortControllerRef.current.abort();
    }
    initializationAbortControllerRef.current = new AbortController();
    
    // Clear all state
    processedNodesRef.current.clear();
    processedEdgesRef.current.clear();
    loadedTransactionsRef.current.clear();
    loadedAccountsRef.current.clear();
    transactionCache.current.clear();
    pendingFetchesRef.current.clear();
    isProcessingQueueRef.current = false;

    const cy = initializeCytoscape(cytoscapeContainer);
    cyRef.current = cy;
    setupGraphInteractionsCallback(cy);
    
    // Mark initialization as complete
    isInitializingRef.current = false;

    return () => {
      // Cancel initialization if in progress
      if (initializationAbortControllerRef.current) {
        initializationAbortControllerRef.current.abort();
      }
      
      timeoutIds.current.forEach(clearTimeout);
      if (pendingLayoutRef.current) {
        clearTimeout(pendingLayoutRef.current);
        pendingLayoutRef.current = null;
      }
      if (layoutAbortControllerRef.current) {
        layoutAbortControllerRef.current.abort();
        layoutAbortControllerRef.current = null;
      }
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [setupGraphInteractionsCallback]); // Add setupGraphInteractionsCallback to dependencies

  // Update GPU graph data when Cytoscape graph changes
  useEffect(() => {
    if (cyRef.current && useGPUGraph) {
      console.log('🔄 [GPU_LISTENER] Setting up GPU graph update listeners');
      
      // Set up listener for graph changes
      const updateHandler = () => {
        console.log('🔄 [GPU_LISTENER] Cytoscape graph changed, updating GPU graph');
        updateGPUGraphData();
      };
      
      // Listen to more events to ensure updates
      cyRef.current.on('add remove data position', updateHandler);
      
      // Initial update
      console.log('🔄 [GPU_LISTENER] Performing initial GPU graph update');
      updateGPUGraphData();
      
      return () => {
        if (cyRef.current) {
          console.log('🔄 [GPU_LISTENER] Removing GPU graph update listeners');
          cyRef.current.off('add remove data position', updateHandler);
        }
      };
    }
  }, [useGPUGraph, updateGPUGraphData]);

  // Progress monitoring with force updates to prevent 0% stuck state
  useEffect(() => {
    if (!loading) return;
    
    console.log(`📊 [PROGRESS_MONITOR] Progress: ${loadingProgress}%, Loading: ${loading}`);
    
    // If progress is stuck at 0% for more than 3 seconds, force it forward
    const progressTimeout = setTimeout(() => {
      if (loadingProgress === 0 && loading) {
        console.log('🚨 [PROGRESS_MONITOR] Progress stuck at 0%, forcing update to 30%');
        setLoadingProgress(30);
      }
    }, 3000);
    
    // If progress is stuck at any value for more than 10 seconds, complete it
    const completionTimeout = setTimeout(() => {
      if (loading) {
        console.log('🚨 [PROGRESS_MONITOR] Loading taking too long, forcing completion');
        setLoadingProgress(100);
        setLoading(false);
      }
    }, 10000);
    
    return () => {
      clearTimeout(progressTimeout);
      clearTimeout(completionTimeout);
    };
  }, [loadingProgress, loading]);

  // Handle initial signature loading with enhanced race condition protection
  useEffect(() => {
    if (!cyRef.current || !initialSignature || initialSignature === initialSignatureRef.current || isInitializingRef.current) {
      return;
    }

    // Prevent overlapping initialization
    if (isInitialized.current) {
      console.log('🔄 [INIT] Initialization already in progress, skipping');
      return;
    }

    initialSignatureRef.current = initialSignature;
    
    const loadInitialSignature = async () => {
      // Create abort controller for this specific initialization
      const abortController = new AbortController();
      const signal = abortController.signal;
      
      try {
        if (isInitialized.current) return;
        isInitialized.current = true;

        if (signal.aborted) return;

        setLoading(true);
        setError(null);
        setTotalAccounts(1);
        setLoadingProgress(0);
        
        // Force immediate progress update to ensure UI responsiveness
        setTimeout(() => {
          if (!signal.aborted) {
            console.log('🔄 [FORCE_PROGRESS] Forcing initial progress update');
            setLoadingProgress(10);
          }
        }, 100);

        if (signal.aborted) return;

        const cachedState = GraphStateCache.loadState(initialSignature);
        
        // Create initial transaction node and immediate progress update
        if (cyRef.current && !cyRef.current.getElementById(initialSignature).length && !signal.aborted) {
          cyRef.current.add({ 
            data: { 
              id: initialSignature, 
              label: initialSignature.slice(0, 8) + '...', 
              type: 'transaction',
              status: 'loading'
            }, 
            classes: 'transaction highlight-transaction' 
          });
          
          if (!signal.aborted) {
            // Immediate progress update to show something is happening
            setLoadingProgress(20);
            console.log('🚀 [PROGRESS] Added initial transaction node, progress: 20%');
            
            // Update GPU graph immediately after adding initial node
            console.log('🔄 [GPU_INITIAL] Updating GPU graph after adding initial transaction node');
            updateGPUGraphData();
          }
        }

        if (signal.aborted) return;

        // Restore cached state if available
        if (cachedState && Array.isArray(cachedState.nodes) && cachedState.nodes.length > 0 && !signal.aborted) {
          try {
            const typedState = cachedState as unknown as CachedState;
            typedState.nodes.forEach(node => {
              if (node.data && !cyRef.current?.getElementById(node.data.id).length && !signal.aborted) {
                cyRef.current?.add(node);
              }
            });
            
            if (typedState.edges && !signal.aborted) {
              typedState.edges.forEach(edge => {
                if (edge.data && !cyRef.current?.getElementById(edge.data.id).length && !signal.aborted) {
                  cyRef.current?.add(edge);
                }
              });
            }
            
            if (!signal.aborted) {
              runLayoutOptimized(false, false);
              setLoadingProgress(100);
              console.log('Restored cached state, progress: 100%');
            }
          } catch (err) {
            console.warn('Error restoring cached state:', err);
          }
        } else if (!signal.aborted) {
          // Fetch transaction data with simplified processing
          console.log('🔄 [FETCH] Fetching transaction data...');
          setLoadingProgress(40);
          
          const response = await fetch(`/api/transaction/${initialSignature}`, { signal });
          
          if (response.ok && !signal.aborted) {
            const txData = await response.json();
            console.log('✅ [FETCH] Transaction data fetched, progress: 60%');
            setLoadingProgress(60);
            
            // Update transaction node with fetched data
            if (cyRef.current && !signal.aborted) {
              const txNode = cyRef.current.getElementById(initialSignature);
              if (txNode.length) {
                txNode.data('status', 'loaded');
                txNode.data('timestamp', txData.timestamp || Date.now());
                txNode.data('success', txData.success);
                
                console.log(`✅ [TX_UPDATE] Updated transaction node: ${initialSignature}`);
                console.log(`✅ [TX_UPDATE] Success: ${txData.success}, Type: ${txData.type}, Timestamp: ${txData.timestamp}`);
              }
            }
            
            if (txData.details?.accounts?.length > 0 && !signal.aborted) {
              const firstAccount = txData.details.accounts[0].pubkey;
              if (firstAccount) {
                console.log(`🎯 [ACCOUNT] Starting graph build from account: ${firstAccount}`);
                setLoadingProgress(80);
                
                // Initialize refs to ensure they exist
                if (!loadedAccountsRef.current) {
                  loadedAccountsRef.current = new Set();
                }
                
                if (!signal.aborted) {
                  try {
                    // Queue the first account and provide immediate feedback
                    console.log(`📝 [QUEUE] Queuing account: ${firstAccount}`);
                    queueAccountFetch(firstAccount, 0, initialSignature);
                    
                    // Force queue processing immediately to ensure it starts
                    console.log(`🔄 [QUEUE] Force processing queue immediately`);
                    setTimeout(() => {
                      if (!signal.aborted) {
                        processAccountFetchQueue();
                      }
                    }, 100);
                  
                  // Set a more aggressive progress update with guaranteed completion
                  setLoadingProgress(85);
                  console.log('📈 [PROGRESS] Queued first account, progress: 85%');
                  
                  // Add multiple fallback mechanisms to ensure progress moves
                  let progressCheckCount = 0;
                  const maxChecks = 10;
                  
                  // Create a promise that resolves when progress is complete or times out
                  const progressPromise = new Promise<void>((resolve) => {
                    const checkProgress = () => {
                      progressCheckCount++;
                      const currentProgress = 85 + (progressCheckCount * 1.5);
                      setLoadingProgress(Math.min(currentProgress, 99));
                      console.log(`🔄 [PROGRESS CHECK ${progressCheckCount}] Progress: ${Math.min(currentProgress, 99)}%`);
                      
                      const elements = cyRef.current?.elements().length || 0;
                      const accounts = loadedAccountsRef.current?.size || 0;
                      console.log(`📊 [STATS] Elements: ${elements}, Loaded accounts: ${accounts}`);
                      
                      if (progressCheckCount >= maxChecks || elements > 2 || accounts > 0) {
                        console.log('✅ [COMPLETE] Progress checks complete');
                        resolve();
                      } else {
                        setTimeout(checkProgress, 500);
                      }
                    };
                    checkProgress();
                  });
                  
                  // Add a backup timeout to ensure loading always completes
                  const backupTimeout = setTimeout(() => {
                    console.log('⏰ [BACKUP] Backup timeout triggered - completing loading');
                    setLoadingProgress(100);
                    setLoading(false);
                  }, 8000); // 8 seconds backup
                  
                  // Wait for processing with progress monitoring
                  await Promise.race([progressPromise, new Promise(resolve => setTimeout(resolve, 7000))]);
                  
                  clearTimeout(backupTimeout);
                  
                  const elements = cyRef.current?.elements().length || 0;
                  console.log(`🎭 [FINAL] Graph elements after processing: ${elements}`);
                  
                  if (elements > 1) {
                    setLoadingProgress(100);
                    console.log('🎉 [SUCCESS] Graph build successful, progress: 100%');
                  } else {
                    // Complete loading even with minimal data
                    console.log('⚠️ [WARNING] Graph build completed with limited data, progress: 100%');
                    setLoadingProgress(100);
                  }
                  } catch (error) {
                    console.error('❌ [ERROR] Error during graph building:', error);
                    setLoadingProgress(100);
                  }
                }
              } else {
                console.log('⚠️ [WARNING] No valid account found in transaction data');
                setLoadingProgress(100);
              }
            } else {
              console.log('⚠️ [WARNING] No accounts found in transaction data');
              setLoadingProgress(100);
            }
          } else {
            console.error(`Failed to fetch transaction data: ${response.status}`);
            setError({
              message: `Failed to load transaction data: ${response.statusText}`,
              severity: 'error'
            });
            setLoadingProgress(100);
          }
          
          // Set initial viewport for fresh data
          if (cyRef.current) {
            requestAnimationFrame(() => {
              if (cyRef.current) {
                runLayoutOptimized(true, false);
                setTimeout(() => {
                  if (cyRef.current) {
                    cyRef.current.zoom(0.8);
                  }
                }, 100);
              }
            });
          }
        }
      } catch (err) {
        console.error('❌ [CRITICAL] Error loading initial transaction:', err);
        setError({
          message: `Failed to load transaction: ${err}`,
          severity: 'error'
        });
        setLoadingProgress(100);
      } finally {
        console.log('🎯 [FINAL] Loading completed, ensuring progress is 100%');
        setLoadingProgress(100);
        setLoading(false);
        
        if (cyRef.current) {
          updateGPUGraphData();
        }
        
        // Add final progress guarantee
        setTimeout(() => {
          console.log('🛡️ [GUARANTEE] Final progress guarantee check');
          setLoadingProgress(100);
          setLoading(false);
        }, 1000);
      }
    };

    loadInitialSignature();
  }, [initialSignature, focusOnTransaction, queueAccountFetch, runLayoutOptimized, updateGPUGraphData, processAccountFetchQueue]);

  // Handle initial account loading with enhanced race condition protection  
  useEffect(() => {
    if (!cyRef.current || !initialAccount || initialAccount === initialAccountRef.current || isInitializingRef.current) {
      return;
    }

    // Prevent overlapping initialization
    if (isInitialized.current) {
      console.log('🔄 [INIT] Initialization already in progress for account, skipping');
      return;
    }

    initialAccountRef.current = initialAccount;
    
    const loadInitialAccount = async () => {
      // Create abort controller for this specific initialization
      const abortController = new AbortController();
      const signal = abortController.signal;
      
      try {
        if (isInitialized.current || signal.aborted) return;
        isInitialized.current = true;

        setLoading(true);
        setError(null);
        setTotalAccounts(1);
        setLoadingProgress(0);

        if (signal.aborted) return;

        console.log(`Loading initial account: ${initialAccount}`);
        setLoadingProgress(20);
        
        // Initialize refs to ensure they exist
        if (!loadedAccountsRef.current) {
          loadedAccountsRef.current = new Set();
        }
        
        if (!signal.aborted) {
          queueAccountFetch(initialAccount, 0, null);
          setLoadingProgress(50);
          
          // Give more time for limited processing to complete and provide feedback
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (signal.aborted) return;
          
          const elements = cyRef.current?.elements().length || 0;
          console.log(`Account loading complete. Elements: ${elements}`);
          
          if (elements === 0 && !signal.aborted) {
            setError({
              message: `No transaction data found for account ${initialAccount.substring(0, 8)}... Account may have no recent activity or only contains non-transferable transactions.`,
              severity: 'warning'
            });
          } else if (elements === 1 && !signal.aborted) {
            setError({
              message: `Limited data available for account ${initialAccount.substring(0, 8)}... Only the account node is shown. This account may have minimal transaction activity.`,
              severity: 'info'
            });
          }
          
          if (!signal.aborted) {
            setLoadingProgress(100);
            
            // Set initial viewport
            if (cyRef.current && cyRef.current.elements().length > 0) {
              requestAnimationFrame(() => {
                if (cyRef.current && !signal.aborted) {
                  runLayoutOptimized(true, false);
                  setTimeout(() => {
                    if (cyRef.current && !signal.aborted) {
                      cyRef.current.zoom(0.8);
                    }
                  }, 100);
                }
              });
            }
          }
        }
      } catch (err) {
        console.error('Error loading initial account:', err);
        if (!signal.aborted) {
          setError({
            message: `Failed to load account: ${err}`,
            severity: 'error'
          });
          setLoadingProgress(100);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          console.log('Account loading completed');
        }
      }
      
      // Cleanup function to cancel operation
      return () => {
        abortController.abort();
      };
    };

    const cleanup = loadInitialAccount();
    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then(cleanupFn => cleanupFn && cleanupFn());
      }
    };
  }, [initialAccount, queueAccountFetch, runLayoutOptimized]);

  // Cleanup tracking on unmount
  useEffect(() => {
    const intervalRef = trackingIntervalRef;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update internal state when props change
  useEffect(() => {
    const isProgrammaticNavigation = sessionStorage.getItem('programmatic_nav') === 'true';

    if (initialSignature && initialSignature !== initialSignatureRef.current) {
      initialSignatureRef.current = initialSignature;

      if (!isProgrammaticNavigation && initialSignature !== currentSignature) {
        if (GraphStateCache.hasState(initialSignature)) {
          focusOnTransaction(initialSignature, false, false, false);
        } else {
          focusOnTransaction(initialSignature, false, true, false);
        }
      }
    }

    sessionStorage.removeItem('programmatic_nav');
  }, [initialSignature, currentSignature, focusOnTransaction]);

  // Handle window resize with debouncing
  useEffect(() => {
    const handleResize = debounce(() => {
      if (cyRef.current && containerRef.current) {
        resizeGraph(cyRef, true);
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
      resizeGraph(cyRef, true);
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

  // Navigation functions
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
        cyRef.current.elements().remove();
        
        if (state.nodes.length > 0) {
          cyRef.current.add(state.nodes);
        }
        if (state.edges && state.edges.length > 0) {
          cyRef.current.add(state.edges);
        }
        
        runLayoutOptimized(true, false);
        
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
  }, [runLayoutOptimized]);

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

  return (
    <div className={`transaction-graph-wrapper relative w-full h-full transition-all flex flex-col ${isFullscreen ? 'bg-background' : ''}`}>
      {error && (
        <div className={`absolute bottom-4 right-4 p-4 rounded-md shadow-lg z-20 max-w-md ${
          error.severity === 'error' ? 'bg-destructive/90 text-destructive-foreground' : 
          error.severity === 'info' ? 'bg-blue-500/90 text-white' : 
          'bg-warning/90 text-warning-foreground'
        }`}>
          <div className="flex items-start">
            <div className="flex-1 text-sm">{error.message}</div>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-current hover:text-current/80"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Debug Information Panel - only show when graph is empty */}
      {(gpuGraphData.nodes.length === 0 || (gpuGraphData.nodes.length === 1 && gpuGraphData.links.length === 0)) && (
        <div className="absolute top-4 right-4 p-3 bg-background/95 border border-border rounded-md shadow-lg z-20 max-w-sm text-xs">
          <div className="font-semibold mb-2 text-muted-foreground">🔍 Debug Information</div>
          <div className="space-y-1 text-muted-foreground">
            <div>• Nodes: {gpuGraphData.nodes.length}</div>
            <div>• Links: {gpuGraphData.links.length}</div>
            <div>• Cytoscape elements: {cyRef.current?.elements().length || 0}</div>
            <div>• Loading: {loading ? 'Yes' : 'No'}</div>
            <div>• Progress: {loadingProgress}%</div>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-xs">
            <div className="text-muted-foreground">
              Check browser console for detailed logs
            </div>
          </div>
        </div>
      )}

      <TrackingStatsPanel 
        stats={trackingStats}
        onStopTracking={stopAddressTracking}
      />

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
        className={`graph-container w-full bg-muted/50 rounded-lg border border-border overflow-hidden ${isFullscreen ? 'rounded-none border-none bg-background' : ''}`}
        style={{ 
          width: '100%', 
          height: isFullscreen ? '100vh' : '100%',
          position: 'relative',
          overflow: 'hidden',
          margin: isFullscreen ? '0' : '0 auto',
          // GPU acceleration hints
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
        }}
      >
        {useGPUGraph ? (
          <GPUAcceleratedForceGraph
            graphData={gpuGraphData}
            onNodeClick={handleGPUNodeClick}
            onNodeHover={handleGPUNodeHover}
            width={containerRef.current?.clientWidth || 800}
            height={containerRef.current?.clientHeight || 600}
            use3D={false}
            enableGPUParticles={true}
          />
        ) : null}
        
        {/* Hidden Cytoscape container for data processing - always present */}
        <div 
          id="cytoscape-data-container"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            visibility: useGPUGraph ? 'hidden' : 'visible',
            pointerEvents: useGPUGraph ? 'none' : 'auto'
          }}
        />
        
        {/* Empty state message */}
        {!loading && gpuGraphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-lg font-semibold text-muted-foreground mb-2">No Data to Visualize</div>
              <div className="text-sm text-muted-foreground max-w-md">
                This account appears to have no recent transaction activity that can be visualized. 
                This could be due to:
              </div>
              <div className="text-xs text-muted-foreground mt-3 text-left max-w-md space-y-1">
                <div>• No recent transactions</div>
                <div>• Only system/program transactions</div>
                <div>• Transactions with no transfers</div>
                <div>• All transactions filtered out</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Minimal data message */}
        {!loading && gpuGraphData.nodes.length === 1 && gpuGraphData.links.length === 0 && (
          <div className="absolute top-4 left-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-600">
            <div className="font-semibold">ℹ️ Minimal Data</div>
            <div>Only one node found - limited connectivity available</div>
          </div>
        )}
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-background/90 p-2 rounded-md shadow-md backdrop-blur-sm border border-border">
        <button 
          className={`p-1.5 hover:bg-primary/10 rounded-md transition-colors ${currentHistoryIndex <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={navigateBack}
          disabled={currentHistoryIndex <= 0}
          title="Navigate back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"></path>
            <path d="M12 19l-7-7 7-7"></path>
          </svg>
        </button>
        
        <button 
          className={`p-1.5 hover:bg-primary/10 rounded-md transition-colors ${currentHistoryIndex >= navigationHistory.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={navigateForward}
          disabled={currentHistoryIndex >= navigationHistory.length - 1}
          title="Navigate forward"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path>
            <path d="M12 5l7 7-7 7"></path>
          </svg>
        </button>

        <button 
          className={`p-1.5 rounded-md transition-colors ${useGPUGraph ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
          onClick={() => setUseGPUGraph(!useGPUGraph)}
          title={useGPUGraph ? "Switch to Cytoscape" : "Switch to GPU rendering"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </button>

        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={showCloudView}
          title="Cloud view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
          </svg>
        </button>

        <button 
          className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isFullscreen ? (
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
              </>
            ) : (
              <>
                <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path>
              </>
            )}
          </svg>
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">
              Loading graph... {loadingProgress.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Accounts processed: {expandedNodesCount}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TransactionGraph);