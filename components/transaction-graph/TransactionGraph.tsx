'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { debounce } from '@/lib/utils';
import { TrackingStatsPanel } from './TrackingStatsPanel';
import { TransactionGraphClouds } from './TransactionGraphClouds';
import { GPUAcceleratedForceGraph } from './GPUAcceleratedForceGraph';



import type { TransactionGraphProps } from './types';
import type { DetailedTransactionInfo } from '@/lib/solana';
import {
  resizeGraph,
  fetchTransactionData,
  fetchAccountTransactions,
  errorLog,
  debugLog
} from './utils';
import {
  useFullscreenMode,
  useAddressTracking,
  useGPUForceGraph,
  useCloudView,
  useLayoutManager,
  useGraphInitialization,
  useNavigationHistory
} from './hooks';

// Constants
const EXCLUDED_ACCOUNTS = new Set([
  '11111111111111111111111111111111',
  'ComputeBudget111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  'So11111111111111111111111111111111111111112',
  'SysvarC1ock11111111111111111111111111111111',
  'SysvarRent111111111111111111111111111111111',
  'SysvarRecentB1ockHashes11111111111111111111',
  'SysvarS1otHashes111111111111111111111111111',
  'SysvarStakeHistory1111111111111111111111111',
  'SysvarInstructions1111111111111111111111111',
  'SysvarEpochSchedule11111111111111111111111111',
  'SysvarSlotHistory11111111111111111111111111',
  'SysvarRewards111111111111111111111111111111',
  'SysvarFees111111111111111111111111111111111',
  'Vote111111111111111111111111111111111111111',
  'Stake11111111111111111111111111111111111111',
  'Config1111111111111111111111111111111111111',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'BPFLoaderUpgradeab1e11111111111111111111111',
  'BPFLoader1111111111111111111111111111111111',
  'BPFLoader2111111111111111111111111111111111',
  'NativeLoader1111111111111111111111111111111',
  'LoaderUpgradeab1e11111111111111111111111111'
]);

// Isolated Cytoscape container component that prevents React DOM conflicts
const CytoscapeContainer = React.memo(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    // Create the container div programmatically to isolate from React
    const cytoscapeDiv = document.createElement('div');
    cytoscapeDiv.id = 'cy-container';
    cytoscapeDiv.className = 'w-full h-full';
    cytoscapeDiv.style.cssText = `
      width: 100%;
      height: 100%;
      will-change: transform;
      transform: translateZ(0);
      isolation: isolate;
      position: relative;
    `;

    // Clear any existing content and append the isolated div
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(cytoscapeDiv);
    
    isInitializedRef.current = true;

    return () => {
      // Clean up by removing the programmatically created div
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      isInitializedRef.current = false;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      suppressHydrationWarning={true}
      style={{
        position: 'relative',
        containIntrinsicSize: '100% 100%',
        contain: 'layout style paint'
      }}
    />
  );
});

const TransactionGraph = React.memo(function TransactionGraph({
  initialSignature,
  initialAccount,
  initialTransactionData,
  onTransactionSelect,
  onAccountSelect,
  clientSideNavigation = false,
  width = '100%',
  height = '100%',
  maxDepth: _maxDepth = 2
}: TransactionGraphProps) {
  // Component refs
  const timeoutIds = useRef<NodeJS.Timeout[]>([]);

  // Use custom hooks
  const { isFullscreen, toggleFullscreen, containerRef } = useFullscreenMode();
  const {
    trackedAddress: _trackedAddress,
    isTrackingMode,
    trackingStats,
    startTrackingAddress: _startTrackingAddress,
    stopTrackingAddress,
    updateTrackingStats: _updateTrackingStats,
    trackedTransactionsRef: _trackedTransactionsRef,
    MAX_TRACKED_TRANSACTIONS: _MAX_TRACKED_TRANSACTIONS
  } = useAddressTracking();
  const {
    useGPUGraph,
    setUseGPUGraph,
    gpuGraphData,
    updateGPUGraphData,
    handleGPUNodeClick,
    handleGPULinkClick,
    handleGPUNodeHover
  } = useGPUForceGraph();
  const {
    isCloudView,
    toggleCloudView,
    switchToGraphView: _switchToGraphView,
    switchToCloudView: _switchToCloudView,
    cloudViewRef
  } = useCloudView();
  const {
    isLayoutRunning: _isLayoutRunning,
    runLayout,
    debouncedLayout: _debouncedLayout,
    cleanupLayout
  } = useLayoutManager();
  // Graph initialization hook
  const {
    cyRef,
    isInitialized,
    isInitializing: _isInitializing,
    initializeGraph,
    cleanupGraph,
    isGraphReady
  } = useGraphInitialization();

  // State management
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [_isEmpty, _setIsEmpty] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Note: Debounced state updates could be added here for high-frequency operations
  // but would require replacing all setProgress/setProgressMessage calls throughout the component

  // Memoized style computations
  const containerStyle = useMemo(() => ({
    width,
    height
  }), [width, height]);

  const containerClassName = useMemo(() =>
    `relative w-full h-full bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`,
    [isFullscreen]
  );

  // Memoized GPU graph dimensions
  const gpuGraphDimensions = useMemo(() => ({
    width: typeof width === 'string' ? parseInt(width, 10) : width,
    height: typeof height === 'string' ? parseInt(height, 10) : height
  }), [width, height]);
  const [currentSignature, setCurrentSignature] = useState<string | null>(initialSignature || null);

  // Detailed progress tracking
  const [expandedNodesCount, setExpandedNodesCount] = useState<number>(0);
  const [totalAccountsToLoad, setTotalAccountsToLoad] = useState<number>(0);

  // Navigation history
  const {
    navigationHistory,
    currentHistoryIndex,
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
    addToHistory,
    isNavigatingHistory
  } = useNavigationHistory({
    initialSignature,
    onNavigate: (signature) => {
      setCurrentSignature(signature);
      onTransactionSelect(signature);

      // Focus on the transaction in the graph
      if (cyRef.current) {
        const node = cyRef.current.getElementById(signature);
        if (node.length > 0) {
          cyRef.current.center(node);
          cyRef.current.zoom({
            level: 1.5,
            position: node.position()
          });
        }
      }
    }
  });

  // Wrapper for GPU node click that adds to history
  const handleGPUNodeClickWithHistory = (node: any) => {
    if (node && node.id && node.type === 'transaction') {
      addToHistory(node.id);
    }
    handleGPUNodeClick(node);
  };

  // Wrapper for GPU link click that adds to history
  const handleGPULinkClickWithHistory = (link: any) => {
    // Extract transaction ID from link and add to history
    let transactionId = null;
    
    if (link.source && link.target) {
      if (typeof link.source === 'object' && link.source.type === 'transaction') {
        transactionId = link.source.id;
      } else if (typeof link.target === 'object' && link.target.type === 'transaction') {
        transactionId = link.target.id;
      } else if (typeof link.source === 'string') {
        transactionId = link.source.length > 50 ? link.source : link.target;
      }
    }
    
    if (transactionId) {
      addToHistory(transactionId);
    }
    
    handleGPULinkClick(link);
  };

  // Enhanced layout function with timeout protection - memoized to prevent infinite loops
  const runLayoutWithProgress = useCallback(async (layoutType: string = 'dagre', forceRun: boolean = false) => {
    if (!isGraphReady() || !cyRef.current) return;

    setProgressMessage(`Running ${layoutType} layout...`);
    setProgress(20);

    try {
      // Add timeout protection for layout operations
      const layoutPromise = runLayout(cyRef.current, layoutType, forceRun);
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Layout timeout')), 10000); // 10 second timeout
      });

      await Promise.race([layoutPromise, timeoutPromise]);
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    } catch (error) {
      errorLog('Layout error:', error);
      setError(`Layout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProgress(0);
    }
  }, [isGraphReady, runLayout, setProgressMessage, setProgress]);

  // Enhanced fetch function
  const fetchData = useCallback(async (signature: string, account: string | null = null) => {
    if (!signature) return;

    setIsLoading(true);
    setError(null);
    setProgress(10);
    setProgressMessage('Fetching transaction data...');

    try {
      const data = await fetchTransactionData(signature);

      if (!data || !cyRef.current) {
        setError('Failed to fetch transaction data');
        return;
      }

      setProgress(50);
      setProgressMessage('Processing transaction data...');

      // Process and add to graph
      const elements = processTransactionData(data, account);

      setProgress(80);
      setProgressMessage('Updating graph...');

      // Add elements to cytoscape
      cyRef.current.batch(() => {
        let newNodesCount = 0;
        debugLog(`Adding ${elements.nodes.length} nodes and ${elements.edges.length} edges to cytoscape`);
        
        elements.nodes.forEach(node => {
          if (!cyRef.current!.getElementById(node.data.id).length) {
            debugLog('Adding node:', node.data.id, node.data.type);
            cyRef.current!.add(node);
            newNodesCount++;
          }
        });
        elements.edges.forEach(edge => {
          if (!cyRef.current!.getElementById(edge.data.id).length) {
            debugLog('Adding edge:', edge.data.id, edge.data.source, '->', edge.data.target);
            cyRef.current!.add(edge);
          }
        });

        // Update expanded nodes counter
        if (newNodesCount > 0) {
          setExpandedNodesCount(prev => prev + newNodesCount);
        }
      });

      // Force update GPU graph data after adding elements
      if (cyRef.current) {
        debugLog('Calling updateGPUGraphData after fetchData...');
        updateGPUGraphData(cyRef.current);
      }

      // Run layout with large transaction protection
      const nodeCount = elements.nodes.length;
      if (nodeCount > 15) {
        debugLog('Large transaction detected, skipping layout to prevent hanging');
        setProgressMessage('Large transaction - using simple positioning...');
        
        // Use simple grid layout for large transactions
        if (cyRef.current) {
          const nodes = cyRef.current.nodes();
          nodes.forEach((node, index) => {
            const row = Math.floor(index / 5);
            const col = index % 5;
            node.position({
              x: col * 100,
              y: row * 100
            });
          });
        }
      } else {
        await runLayoutWithProgress('dagre', true);
      }

      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 1000);

      // Check for empty graph after loading
      if (cyRef.current) {
        const nodes = cyRef.current.nodes();
        const transactions = nodes.filter(node => node.data('type') === 'transaction');

        if (nodes.length === 0) {
          setError('No graph data could be loaded. This might be due to network issues or the account having no transaction history.');
        } else if (transactions.length === 0) {
          setError('Graph loaded but no transactions found. This account might only have system operations.');
        } else if (transactions.length < 2) {
          setError(`Limited transaction data found (${transactions.length} transaction${transactions.length === 1 ? '' : 's'}). This account might have limited SPL transfer activity.`);
        }
      }

    } catch (error) {
      errorLog('Fetch error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyRef, setIsLoading, setError, setProgress, setProgressMessage, runLayout]);
  // Note: processTransactionData and runLayoutWithProgress are stable functions defined after this useCallback
  // updateGPUGraphData intentionally omitted to prevent infinite loops

  // Define a transaction data interface
  interface TransactionData {
    signature?: string;
    status?: 'success' | 'error' | 'pending';
    err?: any; // Error information
    accounts?: Array<{
      pubkey: string;
      owner?: string;
      isSigner?: boolean;
      isWritable?: boolean;
    }>;
    [key: string]: any; // Other properties that might be present
  }

  // Memoized transaction data processing to avoid expensive recalculations
  const processTransactionData = useCallback((data: TransactionData, focusAccount: string | null = null) => {
    const nodes: CytoscapeNode[] = [];
    const edges: CytoscapeEdge[] = [];

    debugLog('Processing transaction data:', {
      signature: data.signature,
      hasAccounts: !!data.accounts,
      accountsLength: data.accounts?.length || 0,
      hasDetails: !!data.details,
      detailsAccountsLength: data.details?.accounts?.length || 0
    });

    // Skip if signature is missing
    if (!data.signature) {
      console.warn('Transaction data missing signature, skipping processing');
      return { nodes, edges };
    }

    // Store signature as a known non-null value
    const txSignature: string = data.signature;

    // Add transaction node
    nodes.push({
      data: {
        id: txSignature,
        label: `${txSignature.substring(0, 8)}...`,
        type: 'transaction',
        signature: txSignature,
        success: !data.err,
        size: 20,
        color: data.err ? '#ef4444' : '#10b981'
      }
    });

    // Process accounts from either data.accounts or data.details.accounts
    const accountsToProcess = data.accounts || data.details?.accounts || [];
    debugLog('Accounts to process:', accountsToProcess.length);

    accountsToProcess.forEach((account: any, _index: number) => {
      const accountPubkey = account.pubkey || account.id || account;
      
      if (!accountPubkey || typeof accountPubkey !== 'string') {
        debugLog('Skipping invalid account:', account);
        return;
      }

      if (EXCLUDED_ACCOUNTS.has(accountPubkey)) {
        debugLog('Skipping excluded account:', accountPubkey);
        return;
      }

      debugLog('Adding account node:', accountPubkey);

      nodes.push({
        data: {
          id: accountPubkey,
          label: `${accountPubkey.substring(0, 8)}...`,
          type: 'account',
          pubkey: accountPubkey,
          isSigner: account.isSigner || account.signer || false,
          isWritable: account.isWritable || account.writable || false,
          size: focusAccount === accountPubkey ? 25 : 15,
          color: (account.isSigner || account.signer) ? '#8b5cf6' : '#6b7280'
        }
      });

      edges.push({
        data: {
          id: `${txSignature}-${accountPubkey}`,
          source: txSignature,
          target: accountPubkey,
          type: 'account_interaction',
          color: (account.isWritable || account.writable) ? '#f59e0b' : '#6b7280'
        }
      });
    });

    debugLog('Processed transaction data result:', {
      signature: txSignature,
      nodesCreated: nodes.length,
      edgesCreated: edges.length
    });

    return { nodes, edges };
  }, []); // No dependencies needed as this is a pure function

  // Memoized wrapper to avoid stale closures
  const wrappedOnTransactionSelect = useCallback((signature: string) => {
    addToHistory(signature);
    onTransactionSelect(signature);
  }, [addToHistory, onTransactionSelect]);

  // Memoized wrapper for account selection
  const wrappedOnAccountSelect = useCallback((accountAddress: string) => {
    if (onAccountSelect) {
      onAccountSelect(accountAddress);
    }
  }, [onAccountSelect]);

  // Memoized debug panel to avoid expensive cytoscape queries on every render
  const DebugPanel = React.memo(() => {
    if (!cyRef.current) {
      return (
        <div className="absolute bottom-4 left-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md shadow-lg z-20 max-w-sm text-xs">
          <div className="font-semibold mb-2 text-destructive">🚨 No Cytoscape Instance</div>
          <div className="space-y-1 text-destructive">
            <div>• Graph not initialized</div>
            <div>• Check console for errors</div>
          </div>
        </div>
      );
    }

    const nodes = cyRef.current.nodes();
    const edges = cyRef.current.edges();
    const transactionNodes = nodes.filter(node => node.data('type') === 'transaction');
    const accountNodes = nodes.filter(node => node.data('type') === 'account');
    const shouldShowDebug = nodes.length <= 3; // Show debug for sparse graphs

    if (!shouldShowDebug) return null;

    return (
      <div className="absolute bottom-4 left-4 p-3 bg-background/95 border border-border rounded-md shadow-lg z-20 max-w-sm text-xs">
        <div className="font-semibold mb-2 text-muted-foreground">🔍 Graph Debug Info</div>
        <div className="space-y-1 text-muted-foreground">
          <div>• Total Nodes: {nodes.length} ({transactionNodes.length} tx, {accountNodes.length} accounts)</div>
          <div>• Total Edges: {edges.length}</div>
          <div>• GPU Graph: {gpuGraphData.nodes.length} nodes, {gpuGraphData.links.length} links</div>
          <div>• Current signature: {currentSignature?.slice(0, 8) || 'None'}...</div>
          <div>• Loading: {isLoading ? 'Yes' : 'No'}</div>
          <div>• Initialized: {isInitialized ? 'Yes' : 'No'}</div>
          <div>• Has initial data: {initialTransactionData ? 'Yes' : 'No'}</div>
          <div>• Container ready: {containerRef.current ? 'Yes' : 'No'}</div>
        </div>
        {nodes.length === 0 && (
          <div className="mt-2 pt-2 border-t border-destructive/20 text-xs">
            <div className="text-destructive font-medium">⚠️ Empty Graph</div>
            <div className="text-destructive text-[10px]">
              Transaction data may not be processing correctly
            </div>
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-border text-xs">
          <div className="text-muted-foreground">
            Check browser console for detailed logs
          </div>
        </div>
      </div>
    );
  });

  // Fetch account data
  const fetchAccountData = useCallback(async (account: string) => {
    if (!account) return;

    setIsLoading(true);
    setError(null);
    setProgress(10);
    setProgressMessage('Fetching account transactions...');

    try {
      const transactions = await fetchAccountTransactions(account);

      if (!transactions || !cyRef.current) {
        setError('Failed to fetch account transactions');
        return;
      }

      setProgress(50);
      setProgressMessage('Processing account data...');

      // Set total accounts to load (estimate based on transactions)
      const estimatedAccounts = Math.min(transactions.length * 2, 100); // Rough estimate
      setTotalAccountsToLoad(estimatedAccounts);

      // Process transactions
      const elements = processAccountTransactions(transactions, account);

      setProgress(80);
      setProgressMessage('Updating graph...');

      // Add to graph
      cyRef.current.batch(() => {
        let newNodesCount = 0;
        elements.nodes.forEach(node => {
          if (!cyRef.current!.getElementById(node.data.id).length) {
            cyRef.current!.add(node);
            newNodesCount++;
          }
        });
        elements.edges.forEach(edge => {
          if (!cyRef.current!.getElementById(edge.data.id).length) {
            cyRef.current!.add(edge);
          }
        });

        // Update expanded nodes counter
        if (newNodesCount > 0) {
          setExpandedNodesCount(prev => prev + newNodesCount);
        }
      });

      // Update GPU graph
      if (cyRef.current) { updateGPUGraphData(cyRef.current); }

      // Run layout
      // Skip layout for very large transactions to prevent hanging
      const nodeCount = elements.nodes.length;
      if (nodeCount > 15) {
        debugLog('Large transaction detected, skipping layout to prevent hanging');
        setProgressMessage('Large transaction - using simple positioning...');
        
        // Use simple grid layout for large transactions
        if (cyRef.current) {
          const nodes = cyRef.current.nodes();
          nodes.forEach((node, index) => {
            const row = Math.floor(index / 5);
            const col = index % 5;
            node.position({
              x: col * 100,
              y: row * 100
            });
          });
        }
      } else {
        await runLayoutWithProgress('dagre', true);
      }

      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 1000);

    } catch (error) {
      errorLog('Account fetch error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [cyRef, runLayoutWithProgress]);
  // Note: processAccountTransactions is a stable function defined after this useCallback
  // updateGPUGraphData intentionally omitted to prevent infinite loops

  // Define a more specific type for transactions
  interface AccountTransaction {
    signature: string;
    status?: 'success' | 'error' | 'pending';
    err?: any; // Error information
    blockTime?: number;
    accounts?: Array<{
      pubkey: string;
      owner?: string;
      isSigner?: boolean;
      isWritable?: boolean;
    }>;
  }

  // Define types for Cytoscape elements
  interface CytoscapeNode {
    data: {
      id: string;
      label: string;
      type: string;
      [key: string]: any; // Additional properties
    };
    [key: string]: any; // For any other properties cytoscape might need
  }

  interface CytoscapeEdge {
    data: {
      id: string;
      source: string;
      target: string;
      [key: string]: any; // Additional properties
    };
    [key: string]: any; // For any other properties cytoscape might need
  }

  // Memoized account transactions processing to avoid expensive recalculations
  const processAccountTransactions = useCallback((transactions: AccountTransaction[], account: string) => {
    const nodes: CytoscapeNode[] = [];
    const edges: CytoscapeEdge[] = [];

    // Add account node
    nodes.push({
      data: {
        id: account,
        label: `${account.substring(0, 8)}...`,
        type: 'account',
        pubkey: account,
        size: 25,
        color: '#8b5cf6'
      }
    });

    // Add transaction nodes
    transactions.forEach((tx: AccountTransaction) => {
      if (!tx.signature) return;

      // Safe non-null signature
      const txSignature: string = tx.signature;

      nodes.push({
        data: {
          id: txSignature,
          label: `${txSignature.substring(0, 8)}...`,
          type: 'transaction',
          signature: txSignature,
          success: !tx.err,
          size: 15,
          color: tx.err ? '#ef4444' : '#10b981'
        }
      });

      edges.push({
        data: {
          id: `${account}-${txSignature}`,
          source: account,
          target: txSignature,
          type: 'account_transaction',
          color: '#6b7280'
        }
      });
    });

    return { nodes, edges };
  }, []); // No dependencies needed as this is a pure function

  /**
   * Improved graph initialization effect with React Strict Mode protection:
   * - Finds the programmatically created cy-container
   * - Prevents race conditions and double initialization
   * - Compatible with React Strict Mode double-invocation
   */
  useEffect(() => {
    if (isInitialized || useGPUGraph || isCloudView) return;
  
    let isMounted = true;
    let initPromise: Promise<any> | null = null;
  
    const initAsync = async () => {
      try {
        debugLog('Starting graph initialization...');
        setIsLoading(true);
        setError(null);

        // Wait for the programmatically created container
        let cytoscapeContainer: HTMLElement | null = null;
        let attempts = 0;
        while (!cytoscapeContainer && attempts < 10 && isMounted) {
          cytoscapeContainer = document.getElementById('cy-container');
          if (!cytoscapeContainer) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
        }

        if (!cytoscapeContainer || !isMounted) {
          debugLog('Cytoscape container not found or component unmounted');
          return;
        }

        debugLog('Found cytoscape container, initializing...');
  
        // Protect against multiple simultaneous initializations
        if (initPromise) {
          debugLog('Initialization already in progress, waiting...');
          await initPromise;
          return;
        }
  
        initPromise = initializeGraph(cytoscapeContainer, wrappedOnTransactionSelect, wrappedOnAccountSelect);
        await initPromise;
  
        if (!isMounted) {
          debugLog('Component unmounted during initialization, cleaning up...');
          return;
        }
  
        debugLog('Graph initialized, loading initial data...');
  
        // Load initial data if provided
        if (initialTransactionData && initialSignature) {
          setCurrentSignature(initialSignature);
  
          setProgress(50);
          setProgressMessage('Processing transaction data...');
  
          const elements = processTransactionData(initialTransactionData, initialAccount);
          debugLog('Elements processed:', elements);
  
          setProgress(80);
          setProgressMessage('Updating graph...');
  
          if (cyRef.current) {
            cyRef.current.batch(() => {
              let newNodesCount = 0;
              elements.nodes.forEach(node => {
                if (!cyRef.current!.getElementById(node.data.id).length) {
                  debugLog('Adding node to cytoscape:', node.data.id);
                  cyRef.current!.add(node);
                  newNodesCount++;
                }
              });
              elements.edges.forEach(edge => {
                if (!cyRef.current!.getElementById(edge.data.id).length) {
                  debugLog('Adding edge to cytoscape:', edge.data.id);
                  cyRef.current!.add(edge);
                }
              });
  
              if (newNodesCount > 0) {
                setExpandedNodesCount(prev => prev + newNodesCount);
              }
            });

            // Force update GPU graph data after adding elements
            debugLog('Updating GPU graph data after initial load...');
            updateGPUGraphData(cyRef.current);
          }
  
          // Run layout with large transaction protection
          const nodeCount = elements.nodes.length;
          if (nodeCount > 15) {
            debugLog('Large initial transaction detected, skipping layout to prevent hanging');
            setProgressMessage('Large transaction - using simple positioning...');
            
            // Use simple grid layout for large transactions
            if (cyRef.current) {
              const nodes = cyRef.current.nodes();
              nodes.forEach((node, index) => {
                const row = Math.floor(index / 5);
                const col = index % 5;
                node.position({
                  x: col * 100,
                  y: row * 100
                });
              });
            }
          } else {
            await runLayoutWithProgress('dagre', true);
          }
  
          setProgress(100);
          setTimeout(() => {
            setProgress(0);
            setProgressMessage('');
          }, 1000);
        } else if (initialSignature) {
          setCurrentSignature(initialSignature);
          await fetchData(initialSignature, initialAccount);
        } else if (initialAccount) {
          await fetchAccountData(initialAccount);
        }
  
        if (isMounted) {
          debugLog('Graph initialization completed successfully');
        }
      } catch (error) {
        if (isMounted) {
          errorLog('Graph initialization failed:', error);
          setError(`Failed to initialize graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
  
    initAsync();
  
    return () => {
      isMounted = false;
    };
  }, [initialSignature, initialAccount, isInitialized, useGPUGraph, isCloudView, initializeGraph, processTransactionData, wrappedOnTransactionSelect, updateGPUGraphData, runLayoutWithProgress]);

  // Enhanced timeout protection for loading with recovery
  useEffect(() => {
    if (!isLoading) return;

    // Force completion after reasonable timeout
    const completionTimeout = setTimeout(() => {
      if (isLoading) {
        errorLog('Graph loading timeout - forcing completion');
        setIsLoading(false);
        setProgress(0);
        
        // Try to show whatever graph data we have
        if (cyRef.current) {
          const nodes = cyRef.current.nodes();
          const edges = cyRef.current.edges();
          
          if (nodes.length > 0) {
            setError(`Loading completed with timeout. Showing ${nodes.length} nodes and ${edges.length} edges.`);
            // Force GPU graph update using existing hook function
            updateGPUGraphData(cyRef.current);
          } else {
            setError('Graph loading timed out. No data could be loaded. Please try refreshing the page.');
          }
        } else {
          setError('Graph loading timed out. Please try refreshing the page.');
        }
      }
    }, 12000); // Reduced to 12 seconds for faster recovery

    return () => {
      clearTimeout(completionTimeout);
    };
  }, [isLoading]); // Removed updateGPUGraphData to keep dependency array stable

  // Cleanup on unmount
  useEffect(() => {
    // Capture timeoutIds ref for cleanup
    const timeoutIdsCurrent = timeoutIds.current;

    return () => {
      timeoutIdsCurrent.forEach(id => clearTimeout(id));
      // Note: Our debounce implementation doesn't have cancel method
      // The functions will naturally clean up when component unmounts
      cleanupLayout();
      cleanupGraph();
      stopTrackingAddress();
    };
  }, [cleanupGraph, cleanupLayout, stopTrackingAddress]);

  // Handle window resize
  useEffect(() => {
    const handleResize = debounce(() => {
      if (cyRef.current) {
        resizeGraph(cyRef.current);
      }
    }, 250);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No dependencies needed - cyRef is stable ref

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={containerStyle}
      key="transaction-graph-container"
    >
      {/* Show initialization overlay when graph is not ready */}
      {!isInitialized && typeof window !== 'undefined' && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
            <p className="text-sm text-muted-foreground">Initializing graph container...</p>
          </div>
        </div>
      )}

      {/* Enhanced Loading overlay with better animations */}
      {isLoading ? (
        <div
          key="loading-overlay"
          className="absolute inset-0 bg-gradient-to-br from-background/90 to-background/80 backdrop-blur-sm z-20 flex items-center justify-center"
        >
          <div className="text-center bg-card/95 backdrop-blur-sm p-8 rounded-xl shadow-2xl border border-border/50 max-w-sm">
            <div className="relative mb-6">
              <div className="w-12 h-12 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Processing Graph</h3>
            <p className="text-sm text-muted-foreground mb-4">{progressMessage}</p>
            {progress > 0 && (
              <div className="w-64 h-3 bg-muted rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
                <p className="text-xs text-center mt-2 font-medium">{progress}%</p>
              </div>
            )}
            {expandedNodesCount > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Processed <span className="font-semibold text-foreground">{expandedNodesCount}</span> of{' '}
                  <span className="font-semibold text-foreground">{totalAccountsToLoad || '?'}</span> accounts
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Enhanced Error display with better styling */}
      {error ? (
        <div
          key="error-display"
          className="absolute top-4 left-4 right-4 z-30 p-4 bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 rounded-xl shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-destructive" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-destructive/80 hover:text-destructive hover:underline transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Enhanced Controls with modern styling */}
      <div key="controls" className="absolute top-4 right-4 z-30 flex gap-2">
        {/* Navigation controls */}
        <div className="flex gap-1 bg-background/95 backdrop-blur-md border border-border/50 rounded-xl p-1 shadow-lg">
          <button
            onClick={navigateBack}
            disabled={!canGoBack}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              canGoBack
                ? 'hover:bg-muted text-foreground hover:scale-105'
                : 'opacity-40 cursor-not-allowed text-muted-foreground'
            }`}
            title="Navigate Back (Alt+←)"
            aria-label="Navigate Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={navigateForward}
            disabled={!canGoForward}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              canGoForward
                ? 'hover:bg-muted text-foreground hover:scale-105'
                : 'opacity-40 cursor-not-allowed text-muted-foreground'
            }`}
            title="Navigate Forward (Alt+→)"
            aria-label="Navigate Forward"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 bg-background/95 backdrop-blur-md border border-border/50 rounded-xl p-1 shadow-lg">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-lg hover:bg-muted transition-all duration-200 hover:scale-105 text-foreground"
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </svg>
          </button>

          <button
            onClick={toggleCloudView}
            className="p-2.5 rounded-lg hover:bg-muted transition-all duration-200 hover:scale-105 text-foreground"
            title="Toggle Cloud View"
            aria-label="Show cloud view"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isCloudView ? (
                <path d="M3 3h18v18H3zM9 9h6v6H9z" />
              ) : (
                <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
              )}
            </svg>
          </button>

          <button
            onClick={() => setUseGPUGraph(!useGPUGraph)}
            className="p-2.5 rounded-lg hover:bg-muted transition-all duration-200 hover:scale-105 text-foreground"
            title="Toggle GPU Acceleration"
            aria-label="Toggle GPU Acceleration"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {useGPUGraph ? (
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              ) : (
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              )}
              <polyline points="6,12 10,16 18,8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Debug Panel - only show when graph has issues */}
      {!isLoading && cyRef.current ? <DebugPanel key="debug-panel" /> : null}

      {/* Main content with complete DOM isolation */}
      {isCloudView ? (
        <div key="cloud-view" ref={cloudViewRef} className="w-full h-full">
          <TransactionGraphClouds
            currentFocusedTransaction={currentSignature || ''}
            onLoadState={(state) => {
              console.log('Loading saved graph state', state);
            }}
            onSaveCurrentState={() => {
              console.log('Saving current graph state');
            }}
          />
        </div>
      ) : (
        <div key="graph-view" className="w-full h-full">
          {useGPUGraph ? (
            <GPUAcceleratedForceGraph
              key="gpu-graph"
              graphData={gpuGraphData}
              onNodeClick={handleGPUNodeClickWithHistory}
              onLinkClick={handleGPULinkClickWithHistory}
              onNodeHover={handleGPUNodeHover}
              width={gpuGraphDimensions.width}
              height={gpuGraphDimensions.height}
            />
          ) : (
            <CytoscapeContainer key="cytoscape-wrapper" />
          )}
        </div>
      )}

      {/* Address tracking panel */}
      {isTrackingMode && trackingStats ? (
        <TrackingStatsPanel
          key="tracking-panel"
          stats={trackingStats}
          onStopTracking={stopTrackingAddress}
        />
      ) : null}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo optimization
  return (
    prevProps.initialSignature === nextProps.initialSignature &&
    prevProps.initialAccount === nextProps.initialAccount &&
    prevProps.onTransactionSelect === nextProps.onTransactionSelect &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.maxDepth === nextProps.maxDepth
  );
});

export default TransactionGraph;  