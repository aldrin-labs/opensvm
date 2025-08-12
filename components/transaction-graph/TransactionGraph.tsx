'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { debounce } from '@/lib/utils';
import { TrackingStatsPanel } from './TrackingStatsPanel';
import TransactionGraphClouds from './TransactionGraphClouds';
import { GPUAcceleratedForceGraph } from './GPUAcceleratedForceGraph';
import { GraphStateCache } from '@/lib/graph-state-cache';



import type { TransactionGraphProps, AccountData } from './types';
import {
  resizeGraph,
  fetchTransactionData,
  errorLog,
  debugLog
} from './utils';
import { fetchAccountTransactions } from './data-fetching';
import { classifyTransactionType, isFundingTransaction, type TransactionClassification } from '@/lib/transaction-classifier';
import { formatEdgeLabel } from './edge-label-utils';
import AccountHoverTooltip from './AccountHoverTooltip';
import { GraphControls } from './GraphControls';
import { NavigationHistory } from './NavigationHistory';
import { useEdgeHover } from './hooks/useEdgeHover';
import TransactionEdgeTooltip from './TransactionEdgeTooltip';
import {
  useFullscreenMode,
  useAddressTracking,
  useGPUForceGraph,
  useCloudView,
  useLayoutManager,
  useGraphInitialization,
  useNavigationHistory
} from './hooks';
import { useHoverCache } from './hooks/useHoverCache';

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

  // Always render the cytoscape container for test selectors
  useEffect(() => {
    if (containerRef.current) {
      let cyDiv = containerRef.current.querySelector('#cy-container');
      if (!cyDiv) {
        cyDiv = document.createElement('div');
        cyDiv.id = 'cy-container';
        cyDiv.setAttribute('data-testid', 'cytoscape-wrapper');
        cyDiv.setAttribute('data-graph-ready', 'false');
        (cyDiv as HTMLDivElement).style.cssText = `width: 100%; height: 100%; min-height: 400px; position: relative; background: transparent; border-radius: 8px;`;
        containerRef.current.appendChild(cyDiv);
      }
    }
  }, []);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    // Prevent multiple simultaneous initializations
    if (initializationPromiseRef.current) {
      return;
    }

    // Capture current container reference to avoid closure issues
    const currentContainer = containerRef.current;

    // Create the initialization promise
    initializationPromiseRef.current = new Promise<void>((resolve, reject) => {
      try {
        // Create cytoscape div programmatically to prevent React DOM conflicts
        const cytoscapeDiv = document.createElement('div');
        cytoscapeDiv.id = 'cy-container';
        cytoscapeDiv.setAttribute('data-initialization-state', 'initializing');

        // Store reference to cytoscape instance on the container for reliable access
        (cytoscapeDiv as any)._cytoscapeInitialized = false;
        (cytoscapeDiv as any)._cytoscapeError = null;

        cytoscapeDiv.style.cssText = `
          width: 100%;
          height: 100%;
          min-height: 400px;
          will-change: transform;
          transform: translateZ(0);
          isolation: isolate;
          position: relative;
          background: transparent;
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          visibility: visible;
          opacity: 1;
          display: block;
        `;

        // Clear any existing content and append the isolated div
        if (currentContainer) {
          currentContainer.innerHTML = '';
          currentContainer.appendChild(cytoscapeDiv);
        }

        isInitializedRef.current = true;
        cytoscapeDiv.setAttribute('data-initialization-state', 'ready');

        // Dispatch event to signal container is ready - use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          const containerReadyEvent = new CustomEvent('cytoscapeContainerReady', {
            detail: {
              containerId: 'cy-container',
              timestamp: Date.now(),
              initialized: true
            }
          });
          document.dispatchEvent(containerReadyEvent);
          console.log('Cytoscape container ready event dispatched');
          resolve();
        });

      } catch (error) {
        console.error('Failed to create cytoscape container:', error);
        reject(error);
      }
    });

    // Handle promise completion
    initializationPromiseRef.current.catch((error) => {
      console.error('Cytoscape container initialization failed:', error);
      isInitializedRef.current = false;
      initializationPromiseRef.current = null;
    });

    return () => {
      // Clean up by removing the programmatically created div
      // Use the captured container reference instead of current ref
      if (currentContainer) {
        // Mark as cleaning up
        const cytoscapeDiv = currentContainer.querySelector('#cy-container');
        if (cytoscapeDiv) {
          cytoscapeDiv.setAttribute('data-initialization-state', 'cleanup');
          // Clean up cytoscape instance if it exists
          const cy = (cytoscapeDiv as any)._cytoscape;
          if (cy && typeof cy.destroy === 'function') {
            try {
              cy.destroy();
            } catch (error) {
              console.warn('Error destroying cytoscape instance:', error);
            }
          }
        }
        currentContainer.innerHTML = '';
      }
      isInitializedRef.current = false;
      initializationPromiseRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full" data-testid="cytoscape-wrapper" />
  );
}); const TransactionGraph = React.memo(function TransactionGraph({
  initialSignature,
  initialAccount,
  initialTransactionData,
  onTransactionSelect,
  onAccountSelect,
  width = '100%',
  height = '100%',
  maxDepth: _maxDepth = 2
}: TransactionGraphProps) {
  // Component refs
  const timeoutIds = useRef<NodeJS.Timeout[]>([]);

  // Use custom hooks
  const { isFullscreen, toggleFullscreen, containerRef } = useFullscreenMode();
  const {
    isTrackingMode,
    trackingStats,
    stopTrackingAddress
  } = useAddressTracking();
  const {
    useGPUGraph,
    setUseGPUGraph,
    gpuGraphData,
    updateGPUGraphData,
    handleGPUNodeClick,
    handleGPULinkClick,
    handleGPUNodeHover,
    setGPUCallbacks
  } = useGPUForceGraph();
  const {
    isCloudView,
    toggleCloudView,
    cloudViewRef
  } = useCloudView();
  const {
    runLayout,
    cleanupLayout
  } = useLayoutManager();
  // Graph initialization hook
  const {
    cyRef,
    isInitialized,
    initializeGraph,
    cleanupGraph,
    isGraphReady
  } = useGraphInitialization();
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isHoverLoading, setIsHoverLoading] = useState<boolean>(false);
  const [hoverData, setHoverData] = useState<any>(null);
  const { hoveredSignature, position: edgeTooltipPos, data: edgeTooltipData, isLoading: edgeTooltipLoading, show: showEdgeTooltip, hide: hideEdgeTooltip } = useEdgeHover();

  // Hover data caching
  const hoverCache = useHoverCache<any>(30000); // 30 second TTL

  // Performance monitoring
  const trackHoverPerformance = useCallback((operation: string, startTime: number) => {
    const duration = Date.now() - startTime;
    if (duration > 200) {
      console.warn(`Hover operation '${operation}' took ${duration}ms (target: <200ms)`);
    }
    return duration;
  }, []);

  // State management
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Graph filter state
  const [filters, setFilters] = useState({
    solTransfers: true,
    splTransfers: true,
    defi: true,
    nft: true,
    programCalls: true,
    system: true,
    funding: true
  });

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
    navigateToIndex,
    goHome
  } = useNavigationHistory({
    initialSignature,
    initialAccount,
    onNavigate: (signature) => {
      setCurrentSignature(signature);
      onTransactionSelect(signature);

      // Restore viewport state if available, otherwise focus on the transaction
      if (cyRef.current) {
        const restored = restoreViewportState(signature);
        if (!restored) {
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
    },
    onAccountNavigate: (address) => {
      if (onAccountSelect) {
        onAccountSelect(address);
      }
    }
  });

  // Wrapper for GPU node click that adds to history
  const handleGPUNodeClickWithHistory = (node: any) => {
    if (node && node.id && node.type === 'transaction') {
      addToHistory({
        id: node.id,
        type: 'transaction',
        label: node.id,
        signature: node.id,
        timestamp: Date.now()
      });
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
      addToHistory({
        id: transactionId,
        type: 'transaction',
        label: transactionId,
        signature: transactionId,
        timestamp: Date.now()
      });
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
  }, [isGraphReady, runLayout, setProgressMessage, setProgress, cyRef]);

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
            node.position({ x: col * 100, y: row * 100 });
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
    const classification: TransactionClassification = classifyTransactionType(data);
    const funding = isFundingTransaction(data, focusAccount);

    // Compute net balance changes per account (prefer provided transfers; fallback to meta)
    const netChangeByAccount: Record<string, number> = {};
    const transfersArr: Array<{ account: string; change: number }> = (data as any).transfers || [];
    if (Array.isArray(transfersArr) && transfersArr.length > 0) {
      for (const t of transfersArr) {
        if (!t || typeof t.account !== 'string') continue;
        netChangeByAccount[t.account] = (netChangeByAccount[t.account] || 0) + (Number(t.change) || 0);
      }
    } else {
      const meta = (data as any).meta;
      const pre = meta?.preBalances;
      const post = meta?.postBalances;
      const keys = (data.accounts || data.details?.accounts || []).map((a: any) => a?.pubkey || a?.id || a);
      if (Array.isArray(pre) && Array.isArray(post) && Array.isArray(keys)) {
        for (let i = 0; i < Math.min(pre.length, post.length, keys.length); i++) {
          const change = Number(post[i] || 0) - Number(pre[i] || 0);
          const acc = keys[i];
          if (typeof acc === 'string' && change !== 0) {
            netChangeByAccount[acc] = (netChangeByAccount[acc] || 0) + change;
          }
        }
      }
    }

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

      debugLog('Ensuring account node exists:', accountPubkey);

      nodes.push({
        data: {
          id: accountPubkey,
          label: `${accountPubkey.substring(0, 8)}...`,
          type: 'account',
          pubkey: accountPubkey,
          isSigner: account.isSigner || account.signer || false,
          isWritable: account.isWritable || account.writable || false,
          size: focusAccount === accountPubkey ? 25 : 15,
          color: (account.isSigner || account.signer) ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
        }
      });
    });

    // Build account-to-account edges per transfer
    const instructions: any[] = (data as any)?.details?.instructions || (data as any)?.transaction?.message?.instructions || [];
    const parsedTransfers: Array<{ from: string; to: string; amount?: number; mint?: string }> = [];
    for (const ix of instructions) {
      const info = (ix?.parsed?.info || ix?.info) as any;
      if (info && typeof info === 'object') {
        const from = info.source || info.from || info.owner || info.authority;
        const to = info.destination || info.to || info.newAccount || info.recipient;
        if (typeof from === 'string' && typeof to === 'string') {
          const amt = Number(info.lamports ?? info.amount ?? info.tokenAmount?.amount);
          const mint = info.mint || info.tokenMint;
          parsedTransfers.push({ from, to, amount: isNaN(amt) ? undefined : amt, mint });
        }
      }
    }

    // Fallback: pair negatives to positives if no parsed transfers
    if (parsedTransfers.length === 0) {
      const negatives = Object.entries(netChangeByAccount)
        .filter(([, v]) => (v as number) < 0)
        .map(([k, v]) => ({ acc: k, amt: Math.abs(v as number) }))
        .sort((a, b) => b.amt - a.amt);
      const positives = Object.entries(netChangeByAccount)
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => ({ acc: k, amt: v as number }))
        .sort((a, b) => b.amt - a.amt);
      let i = 0, j = 0;
      while (i < negatives.length && j < positives.length) {
        const from = negatives[i];
        const to = positives[j];
        const amt = Math.min(from.amt, to.amt);
        parsedTransfers.push({ from: from.acc, to: to.acc, amount: amt });
        from.amt -= amt;
        to.amt -= amt;
        if (from.amt <= 0.000001) i++;
        if (to.amt <= 0.000001) j++;
      }
    }

    // Create edges between accounts
    for (const t of parsedTransfers) {
      if (!t.from || !t.to || t.from === t.to) continue;
      // Ensure nodes exist (added above), add edge
      const isSol = classification.type === 'sol_transfer' && (t.mint == null);
      const amountForEdge = isSol ? Math.abs(Number(t.amount || 0)) : classification.amount ?? t.amount;
      const direction = focusAccount
        ? (t.to === focusAccount ? 'in' : t.from === focusAccount ? 'out' : 'neutral')
        : 'neutral';
      edges.push({
        data: {
          id: `${txSignature}-${t.from}-${t.to}`,
          source: t.from,
          target: t.to,
          type: 'account_transfer',
          fullSignature: txSignature,
          txType: classification.type,
          isFunding: funding || classification.isFunding,
          color: 'hsl(var(--muted-foreground))',
          amount: amountForEdge,
          tokenSymbol: classification.tokenSymbol,
          direction,
          label: formatEdgeLabel({
            amount: amountForEdge,
            tokenSymbol: classification.tokenSymbol,
            txType: classification.type,
            isFunding: funding || classification.isFunding
          })
        }
      });
    }

    debugLog('Processed transaction data result:', {
      signature: txSignature,
      nodesCreated: nodes.length,
      edgesCreated: edges.length
    });

    return { nodes, edges };
  }, []); // No dependencies needed as this is a pure function

  // Save viewport state when navigating
  const saveViewportState = useCallback((key: string) => {
    if (cyRef.current) {
      const cy = cyRef.current;
      const center = cy.pan();
      const zoom = cy.zoom();
      const viewportState = { x: center.x, y: center.y, zoom };
      sessionStorage.setItem(`graph-viewport-${key}`, JSON.stringify(viewportState));
    }
  }, [cyRef]);

  // Restore viewport state when returning to a previous view
  const restoreViewportState = useCallback((key: string): boolean => {
    if (cyRef.current) {
      const stored = sessionStorage.getItem(`graph-viewport-${key}`);
      if (stored) {
        try {
          const viewportState = JSON.parse(stored);
          cyRef.current.pan({ x: viewportState.x, y: viewportState.y });
          cyRef.current.zoom(viewportState.zoom);
          return true;
        } catch (error) {
          console.warn('Failed to restore viewport state:', error);
        }
      }
    }
    return false;
  }, [cyRef]);

  // Memoized wrapper to avoid stale closures
  const wrappedOnTransactionSelect = useCallback((signature: string) => {
    // Save current viewport state before navigating
    if (currentSignature) {
      saveViewportState(currentSignature);
    }

    addToHistory({
      id: signature,
      type: 'transaction',
      label: signature,
      signature: signature,
      timestamp: Date.now()
    });
    onTransactionSelect(signature);
  }, [addToHistory, onTransactionSelect, currentSignature, saveViewportState]);

  // Memoized wrapper for account selection with client-side navigation priority
  const wrappedOnAccountSelect = useCallback((accountAddress: string) => {
    const clientSideNavigation = !!onAccountSelect;
    debugLog('Account selected:', accountAddress, 'clientSideNavigation:', clientSideNavigation);

    // Save current viewport state before navigating
    if (currentSignature) {
      saveViewportState(currentSignature);
    }

    if (onAccountSelect && typeof onAccountSelect === 'function') {
      // Always use the provided callback for client-side navigation
      onAccountSelect(accountAddress);
    } else {
      // Fallback to page navigation
      console.warn('No onAccountSelect callback provided, falling back to page navigation');
      if (typeof window !== 'undefined') {
        window.location.href = `/account/${accountAddress}`;
      }
    }
  }, [onAccountSelect, currentSignature, saveViewportState]);

  // Graph filter and zoom control handlers
  const handleFilterChange = useCallback((filter: string, value: boolean) => {
    setFilters(prev => ({ ...prev, [filter]: value }));

    // Apply filters to cytoscape graph
    if (cyRef.current) {
      const cy = cyRef.current;

      // Show/hide nodes based on transaction type
      const nextFilters = { ...filters, [filter]: value } as typeof filters;
      cy.nodes().forEach(node => {
        if (node.data('type') === 'transaction') {
          const txType = node.data('txType');
          let shouldShow = true;

          if (txType === 'sol_transfer' && !nextFilters.solTransfers) shouldShow = false;
          else if (txType === 'spl_transfer' && !nextFilters.splTransfers) shouldShow = false;
          else if (txType === 'defi' && !nextFilters.defi) shouldShow = false;
          else if (txType === 'nft' && !nextFilters.nft) shouldShow = false;
          else if (txType === 'program_call' && !nextFilters.programCalls) shouldShow = false;
          else if (txType === 'system' && !nextFilters.system) shouldShow = false;

          // Special handling for funding transactions
          if (node.data('isFunding') && !nextFilters.funding) shouldShow = false;

          node.style('display', shouldShow ? 'element' : 'none');
        }
      });

      // Show/hide edges based on transaction type
      cy.edges().forEach(edge => {
        const txType = edge.data('txType');
        let shouldShow = true;

        if (txType === 'sol_transfer' && !nextFilters.solTransfers) shouldShow = false;
        else if (txType === 'spl_transfer' && !nextFilters.splTransfers) shouldShow = false;
        else if (txType === 'defi' && !nextFilters.defi) shouldShow = false;
        else if (txType === 'nft' && !nextFilters.nft) shouldShow = false;
        else if (txType === 'program_call' && !nextFilters.programCalls) shouldShow = false;
        else if (txType === 'system' && !nextFilters.system) shouldShow = false;

        // Special handling for funding transactions
        if (edge.data('isFunding') && !nextFilters.funding) shouldShow = false;

        edge.style('display', shouldShow ? 'element' : 'none');
      });
      // Do not run layout to preserve static positions
    }
  }, [filters, cyRef]);

  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 1.2,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
      });
    }
  }, [cyRef]);

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 0.8,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
      });
    }
  }, [cyRef]);

  const handleReset = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.reset();
      cyRef.current.fit();
    }
  }, [cyRef]);

  const handleFit = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit();
    }
  }, [cyRef]);

  // Keyboard navigation support
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    const selectedNodes = cy.nodes(':selected');
    const selectedEdges = cy.edges(':selected');

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        if (selectedNodes.length > 0) {
          const node = selectedNodes[0];
          const pos = node.position();
          const step = event.shiftKey ? 50 : 20;

          switch (event.key) {
            case 'ArrowUp':
              node.position({ x: pos.x, y: pos.y - step });
              break;
            case 'ArrowDown':
              node.position({ x: pos.x, y: pos.y + step });
              break;
            case 'ArrowLeft':
              node.position({ x: pos.x - step, y: pos.y });
              break;
            case 'ArrowRight':
              node.position({ x: pos.x + step, y: pos.y });
              break;
          }
        }
        break;

      case 'Tab':
        event.preventDefault();
        if (selectedNodes.length > 0) {
          const nodes = cy.nodes();
          const arr = nodes.toArray();
          const currentIndex = arr.findIndex(n => n.id() === selectedNodes[0].id());
          const nextIndex = (currentIndex + 1) % nodes.length;
          nodes.removeClass('selected');
          nodes.eq(nextIndex).addClass('selected');
        } else if (cy.nodes().length > 0) {
          const nodes = cy.nodes();
          nodes.removeClass('selected');
          nodes.eq(0).addClass('selected');
        }
        break;

      case 'Enter':
        if (selectedNodes.length > 0) {
          const node = selectedNodes[0];
          if (node.data('type') === 'transaction') {
            wrappedOnTransactionSelect(node.id());
          } else if (node.data('type') === 'account') {
            wrappedOnAccountSelect(node.id());
          }
        } else if (selectedEdges.length > 0) {
          // If an edge is selected, open tx in background
          const edge = selectedEdges[0];
          const txSig = edge.data('fullSignature') || (edge.data('id') || '').split('-')[0];
          if (txSig) {
            window.open(`/tx/${txSig}`, '_blank', 'noopener');
          }
        }
        break;

      case 'Escape':
        cy.nodes().removeClass('selected');
        cy.edges().removeClass('selected');
        break;

      case 'f':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleFit();
        }
        break;

      case 'r':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleReset();
        }
        break;

      // Navigation history shortcuts
      case 'h':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          goHome();
        }
        break;
    }
  }, [cyRef, wrappedOnTransactionSelect, wrappedOnAccountSelect, handleFit, handleReset, goHome]);

  // Accessibility support
  const getAccessibilityLabel = useCallback((element: any) => {
    if (element.isNode()) {
      const data = element.data();
      if (data.type === 'transaction') {
        return `Transaction ${data.label}, Type: ${data.txType || 'unknown'}, ${data.isFunding ? 'Funding transaction' : 'Regular transaction'}`;
      } else if (data.type === 'account') {
        return `Account ${data.label}, ${data.isSigner ? 'Signer' : 'Non-signer'}, ${data.isWritable ? 'Writable' : 'Read-only'}`;
      }
    } else if (element.isEdge()) {
      const data = element.data();
      return `Transaction edge from ${data.source} to ${data.target}, Type: ${data.txType || 'unknown'}, ${data.isFunding ? 'Funding transaction' : 'Regular transaction'}`;
    }
    return 'Graph element';
  }, []);

  // Enhanced GPU callbacks and mode synchronization
  useEffect(() => {
    setGPUCallbacks(wrappedOnTransactionSelect, wrappedOnAccountSelect);

    // Ensure GPU graph data is synchronized when switching modes
    if (useGPUGraph && cyRef.current) {
      debugLog('GPU mode enabled, updating GPU graph data from cytoscape');
      updateGPUGraphData(cyRef.current);
    } else if (!useGPUGraph && !isCloudView) {
      debugLog('Cytoscape mode enabled, ensuring container is ready');
      // Ensure cytoscape container is in correct state
      const cytoscapeContainer = document.getElementById('cy-container');
      if (cytoscapeContainer && (cytoscapeContainer as any)._cytoscapeInitialized) {
        cytoscapeContainer.setAttribute('data-graph-ready', 'true');
      }
    }
  }, [setGPUCallbacks, wrappedOnTransactionSelect, wrappedOnAccountSelect, useGPUGraph, isCloudView, updateGPUGraphData, cyRef]);



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
          <div>• Initial account: {initialAccount?.slice(0, 8) || 'None'}...</div>
          <div>• Current URL: {typeof window !== 'undefined' ? window.location.pathname : 'SSR'}</div>
          <div>• Loading: {isLoading ? 'Yes' : 'No'}</div>
          <div>• Initialized: {isInitialized ? 'Yes' : 'No'}</div>
          <div>• Has initial data: {initialTransactionData ? 'Yes' : 'No'}</div>
          <div>• Container ready: {containerRef.current ? 'Yes' : 'No'}</div>
          {/* Describe the focused element for assistive tech if any selection exists */}
          {(() => {
            const sel = cyRef.current?.elements(':selected');
            if (sel && sel.length > 0) {
              const label = getAccessibilityLabel(sel[0]);
              return <div aria-live="polite" className="sr-only">{label}</div>;
            }
            return null;
          })()}
          {/* Accessibility overview for screen readers */}
          <div aria-live="polite" className="sr-only">
            Graph has {nodes.length} nodes and {edges.length} edges. {transactionNodes.length} transaction nodes and {accountNodes.length} account nodes.
          </div>
        </div>
        {nodes.length === 0 && (
          <div className="mt-2 pt-2 border-t border-destructive/20 text-xs">
            <div className="text-destructive font-medium">⚠️ Empty Graph</div>
            <div className="text-destructive text-[10px]">
              No transaction data loaded. Please navigate to a specific transaction or account page.
            </div>
            <div className="text-muted-foreground text-[10px] mt-1">
              Try: /tx/[signature]/graph or /account/[address]
            </div>
            {initialAccount && (
              <div className="text-primary text-[10px] mt-1">
                Trying to load account: {initialAccount}
              </div>
            )}
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
        color: 'hsl(var(--primary))'
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
          color: tx.err ? 'hsl(var(--destructive))' : 'hsl(var(--success))'
        }
      });

      edges.push({
        data: {
          id: `${account}-${txSignature}`,
          source: account,
          target: txSignature,
          type: 'account_transaction',
          color: 'hsl(var(--muted-foreground))'
        }
      });
    });

    return { nodes, edges };
  }, []); // No dependencies needed as this is a pure function

  // Fetch account data
  const fetchAccountData = useCallback(async (account: string) => {
    if (!account) return;

    setIsLoading(true);
    setError(null);
    setProgress(10);
    setProgressMessage('Fetching account transactions...');

    try {
      debugLog('Fetching account data for:', account);
      const accountData: AccountData | null = await fetchAccountTransactions(account);

      if (!accountData || !cyRef.current) {
        setError('Failed to fetch account transactions. The account API might be unavailable.');
        return;
      }

      // Extract transactions array from the account data
      const transactions = accountData.transactions || [];
      debugLog('Extracted transactions from account data:', transactions.length);

      if (transactions.length === 0) {
        setError('No transactions found for this account. This account might have limited activity or the account transactions API might be unavailable.');
        // Still create the account node even with no transactions
        const accountNode = {
          data: {
            id: account,
            label: `${account.substring(0, 8)}...`,
            type: 'account',
            pubkey: account,
            size: 25,
            color: 'hsl(var(--primary))'
          }
        };

        cyRef.current.add(accountNode);
        updateGPUGraphData(cyRef.current);
        setIsLoading(false);
        return;
      } setProgress(50);
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
  }, [cyRef, runLayoutWithProgress, processAccountTransactions, updateGPUGraphData]);
  // Note: processAccountTransactions and updateGPUGraphData are included as dependencies



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



  /**
   * Improved graph initialization effect with React Strict Mode protection:
   * - Finds the programmatically created cy-container
   * - Prevents race conditions and double initialization
   * - Compatible with React Strict Mode double-invocation
   * - Enhanced error recovery and state management
   */
  useEffect(() => {
    if (isInitialized || useGPUGraph || isCloudView) return;

    let isMounted = true;
    let initPromise: Promise<any> | null = null;
    const abortController = new AbortController();

    const waitForContainerWithRetry = async (): Promise<HTMLElement | null> => {
      const maxAttempts = 50; // Increased for CI/CD compatibility
      const baseDelay = 100; // Start with shorter delay

      for (let attempts = 0; attempts < maxAttempts && isMounted; attempts++) {
        const cytoscapeContainer = document.getElementById('cy-container');

        if (cytoscapeContainer) {
          // Verify container is properly initialized
          const initState = cytoscapeContainer.getAttribute('data-initialization-state');
          if (initState === 'ready') {
            debugLog(`Container found and ready after ${attempts + 1} attempts`);
            return cytoscapeContainer;
          } else if (initState === 'creating') {
            // Container is still being created, wait a bit more
            debugLog(`Container creating, waiting... (attempt ${attempts + 1})`);
          }
        }

        // Use exponential backoff for better performance
        const delay = Math.min(baseDelay * Math.pow(1.2, attempts), 500);
        await new Promise(resolve => setTimeout(resolve, delay));

        if (attempts % 10 === 9) {
          debugLog(`Still waiting for cytoscape container, attempt ${attempts + 1}/${maxAttempts}`);
        }
      }

      return null;
    };

    const initAsync = async () => {
      try {
        debugLog('Starting graph initialization...');
        setIsLoading(true);
        setError(null);

        // Wait for the container with improved retry logic
        const cytoscapeContainer = await waitForContainerWithRetry();

        if (!cytoscapeContainer || !isMounted) {
          debugLog('Cytoscape container not found or component unmounted');
          if (isMounted) {
            setError('Graph container could not be initialized. This may be expected in some test environments.');
          }
          return;
        }

        debugLog('Found cytoscape container, initializing...');

        // Mark container as initializing for tests
        cytoscapeContainer.setAttribute('data-graph-ready', 'initializing');
        (cytoscapeContainer as any)._cytoscapeInitialized = false;

        // Protect against multiple simultaneous initializations
        if (initPromise) {
          debugLog('Initialization already in progress, waiting...');
          try {
            await initPromise;
            if ((cytoscapeContainer as any)._cytoscapeInitialized) {
              debugLog('Previous initialization completed successfully');
              return;
            }
          } catch (error) {
            debugLog('Previous initialization failed, retrying...');
            initPromise = null; // Reset to allow retry
          }
        }

        try {
          // Enhanced initialization with proper error handling
          const showTooltip = async (address: string, pos: { x: number; y: number }) => {
            setHoveredAccount(address);
            setTooltipPosition(pos);
            setIsHoverLoading(true);
            try {
              // Use cache first for instant responses
              const cached = hoverCache.getCachedData(address);
              if (cached) {
                setHoverData(cached);
                setIsHoverLoading(false);
                return;
              }

              const start = Date.now();
              const res = await fetch(`/api/account-stats/${address}`, { headers: { 'Cache-Control': 'no-cache' } });
              trackHoverPerformance('account-stats-fetch', start);
              if (res.ok) {
                const data = await res.json();
                setHoverData(data);
                hoverCache.setCachedData(address, data);
              } else {
                setHoverData(null);
              }
            } catch (err) {
              console.error('Account hover fetch failed', err);
              setHoverData(null);
            } finally {
              setIsHoverLoading(false);
            }
          };
          const hideTooltip = () => {
            setHoveredAccount(null);
            setTooltipPosition(null);
            setHoverData(null);
            setIsHoverLoading(false);
          };
          initPromise = initializeGraph(
            cytoscapeContainer,
            wrappedOnTransactionSelect,
            wrappedOnAccountSelect,
            showTooltip,
            hideTooltip,
            showEdgeTooltip,
            hideEdgeTooltip
          );
          await initPromise;

          // Verify cytoscape instance was properly created
          const cy = (cytoscapeContainer as any)._cytoscape;
          if (!cy) {
            throw new Error('Cytoscape instance not found after initialization');
          }

          // Mark container as ready for tests with proper state
          if (cytoscapeContainer && isMounted) {
            cytoscapeContainer.setAttribute('data-graph-ready', 'true');
            (cytoscapeContainer as any)._cytoscapeInitialized = true;
            (cytoscapeContainer as any)._cytoscapeError = null;
            debugLog('Graph initialization completed successfully with cytoscape instance');
          }
        } catch (error) {
          debugLog('Graph initialization failed:', error);
          if (cytoscapeContainer && isMounted) {
            cytoscapeContainer.setAttribute('data-graph-ready', 'error');
            (cytoscapeContainer as any)._cytoscapeInitialized = false;
            (cytoscapeContainer as any)._cytoscapeError = error;
          }
          throw error;
        }

        if (!isMounted || abortController.signal.aborted) {
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

          if (cyRef.current && isMounted) {
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

            // Save initial viewport state after graph is loaded
            if (initialAccount) {
              setTimeout(() => {
                saveViewportState(initialAccount);
              }, 1000); // Wait for layout to settle
            }

            // Force update GPU graph data after adding elements
            debugLog('Updating GPU graph data after initial load...');
            updateGPUGraphData(cyRef.current!);
          }

          // Run layout with large transaction protection
          if (isMounted && cyRef.current) {
            const nodeCount = elements.nodes.length;
            if (nodeCount > 15) {
              debugLog('Large initial transaction detected, skipping layout to prevent hanging');
              setProgressMessage('Large transaction - using simple positioning...');

              // Use simple grid layout for large transactions
              const nodes = cyRef.current.nodes();
              nodes.forEach((node, index) => {
                const row = Math.floor(index / 5);
                const col = index % 5;
                node.position({
                  x: col * 100,
                  y: row * 100
                });
              });
            } else {
              await runLayoutWithProgress('dagre', true);
            }
          }

          if (isMounted) {
            setProgress(100);
            setTimeout(() => {
              if (isMounted) {
                setProgress(0);
                setProgressMessage('');
              }
            }, 1000);
          }
        } else if (initialSignature && isMounted) {
          debugLog('Loading initial signature:', initialSignature);
          setCurrentSignature(initialSignature);
          await fetchData(initialSignature, initialAccount);
        } else if (initialAccount && isMounted) {
          debugLog('Loading initial account:', initialAccount);
          await fetchAccountData(initialAccount);
        } else if (isMounted) {
          debugLog('No initial data provided - graph will be empty');
        }

        if (isMounted) {
          debugLog('Graph initialization completed successfully');
        }
      } catch (error) {
        if (isMounted && !abortController.signal.aborted) {
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
      abortController.abort();
    };
  }, [initialSignature, initialAccount, isInitialized, useGPUGraph, isCloudView, initializeGraph, processTransactionData, wrappedOnTransactionSelect, wrappedOnAccountSelect, updateGPUGraphData, runLayoutWithProgress, cyRef, fetchAccountData, fetchData, initialTransactionData, hideEdgeTooltip, hoverCache, saveViewportState, showEdgeTooltip, trackHoverPerformance]);

  // Enhanced timeout protection for loading with recovery
  useEffect(() => {
    if (!isLoading) return;

    // Capture the current ref value at the start of the effect
    const currentCy = cyRef.current;

    // Force completion after reasonable timeout
    const completionTimeout = setTimeout(() => {
      if (isLoading) {
        errorLog('Graph loading timeout - forcing completion');
        setIsLoading(false);
        setProgress(0);

        // Try to show whatever graph data we have
        if (currentCy) {
          const nodes = currentCy.nodes();
          const edges = currentCy.edges();

          if (nodes.length > 0) {
            setError(`Loading completed with timeout. Showing ${nodes.length} nodes and ${edges.length} edges.`);
            // Force GPU graph update using existing hook function
            updateGPUGraphData(currentCy);
          } else {
            setError('Graph loading timed out. No data could be loaded. This may be expected for accounts with limited activity.');
          }
        } else {
          setError('Graph container not initialized. This may be expected during page load.');
        }
      }
    }, 20000); // Increased to 20 seconds for test stability

    return () => {
      clearTimeout(completionTimeout);
    };
  }, [isLoading, cyRef, updateGPUGraphData]); // Include cyRef and updateGPUGraphData as they're used in the effect

  // Enhanced cleanup on unmount with cytoscape-specific logic
  useEffect(() => {
    // Capture ref values for cleanup
    const timeoutIdsCurrent = timeoutIds.current;
    const currentCy = cyRef.current;

    return () => {
      timeoutIdsCurrent.forEach(id => clearTimeout(id));

      // Enhanced cytoscape cleanup
      const cytoscapeContainer = document.getElementById('cy-container');
      if (cytoscapeContainer) {
        const cy = (cytoscapeContainer as any)._cytoscape;
        if (cy && typeof cy.destroy === 'function') {
          try {
            console.log('Cleaning up cytoscape instance...');
            cy.destroy();
            (cytoscapeContainer as any)._cytoscape = null;
            (cytoscapeContainer as any)._cytoscapeInitialized = false;
            cytoscapeContainer.setAttribute('data-graph-ready', 'false');
            cytoscapeContainer.setAttribute('data-initialization-state', 'cleanup');
          } catch (error) {
            console.warn('Error during cytoscape cleanup:', error);
          }
        }
      }

      // Clear GPU graph data
      if (currentCy) {
        updateGPUGraphData(currentCy);
      }

      // Standard cleanup
      cleanupLayout();
      cleanupGraph();
      stopTrackingAddress();
    };
  }, [cleanupGraph, cleanupLayout, stopTrackingAddress, updateGPUGraphData, cyRef]);

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
  }, [cyRef]); // Include cyRef as it's used in the resize handler

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDownEvent = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDownEvent);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDownEvent);
      }
    };
  }, [handleKeyDown]);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={containerStyle}
      key="transaction-graph-container"
    >
      {/* Hover tooltip for account nodes */}
      {hoveredAccount && tooltipPosition ? (
        <AccountHoverTooltip
          accountAddress={hoveredAccount}
          position={tooltipPosition}
          visible={true}
          data={hoverData}
          isLoading={isHoverLoading}
        />
      ) : null}
      {hoveredSignature && edgeTooltipPos ? (
        <TransactionEdgeTooltip
          signature={hoveredSignature}
          position={edgeTooltipPos}
          visible={true}
          data={edgeTooltipData}
          isLoading={edgeTooltipLoading}
        />
      ) : null}
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
              <p className="text-sm text-destructive font-medium" data-testid="error-message">{error}</p>
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
            className={`p-2.5 rounded-lg transition-all duration-200 ${canGoBack
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
            className={`p-2.5 rounded-lg transition-all duration-200 ${canGoForward
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
            graphs={GraphStateCache.getSavedGraphs()}
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

      {/* Graph Controls */}
      <GraphControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onFit={handleFit}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        filters={filters}
        onFilterChange={handleFilterChange}
        visibleElements={{
          nodes: cyRef.current?.nodes().length || 0,
          edges: cyRef.current?.edges().length || 0
        }}
      />

      {/* Navigation History */}
      <NavigationHistory
        history={navigationHistory}
        currentIndex={currentHistoryIndex}
        onNavigate={navigateToIndex}
        onGoBack={navigateBack}
        onGoForward={navigateForward}
        onGoHome={goHome}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        maxHistorySize={20}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo optimization
  return (
    prevProps.initialSignature === nextProps.initialSignature &&
    prevProps.initialAccount === nextProps.initialAccount &&
    prevProps.onTransactionSelect === nextProps.onTransactionSelect &&
    prevProps.onAccountSelect === nextProps.onAccountSelect &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.maxDepth === nextProps.maxDepth
  );
});

export default TransactionGraph;  