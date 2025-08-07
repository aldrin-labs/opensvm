'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import cytoscape from 'cytoscape';

// Enhanced TypeScript interfaces for better type safety
export interface GraphNode {
  id: string;
  label: string;
  type: 'transaction' | 'account' | 'program' | 'token';
  data: Record<string, any>;
  position?: { x: number; y: number };
  size?: number;
  color?: string;
  status?: 'success' | 'error' | 'pending' | 'loading';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: Record<string, any>;
  color?: string;
  width?: number;
}

export interface GraphState {
  // Core graph data
  nodes: GraphNode[];
  edges: GraphEdge[];

  // Navigation state
  currentAccount: string | null;
  currentTransaction: string | null;
  navigationHistory: string[];
  currentHistoryIndex: number;

  // UI state
  loading: boolean;
  error: string | null;
  progress: number;
  progressMessage: string;

  // View state
  isFullscreen: boolean;
  useGPUAcceleration: boolean;
  viewportState: { zoom: number; pan: { x: number; y: number } } | null;

  // Tracking state
  trackedAddress: string | null;
  isTrackingMode: boolean;

  // Performance state
  expandedNodesCount: number;
  totalNodesToLoad: number;

  // Security state
  lastValidatedUrls: Set<string>;
  rateLimitState: Map<string, { count: number; lastReset: number }>;
}

export type GraphAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROGRESS'; payload: { progress: number; message: string } }
  | { type: 'SET_NODES'; payload: GraphNode[] }
  | { type: 'SET_EDGES'; payload: GraphEdge[] }
  | { type: 'ADD_NODES'; payload: GraphNode[] }
  | { type: 'ADD_EDGES'; payload: GraphEdge[] }
  | { type: 'NAVIGATE_TO_ACCOUNT'; payload: { address: string; addToHistory?: boolean } }
  | { type: 'NAVIGATE_TO_TRANSACTION'; payload: { signature: string; addToHistory?: boolean } }
  | { type: 'NAVIGATION_SUCCESS'; payload: { target: string; type: 'account' | 'transaction' } }
  | { type: 'NAVIGATION_ERROR'; payload: string }
  | { type: 'SET_VIEWPORT'; payload: { zoom: number; pan: { x: number; y: number } } }
  | { type: 'TOGGLE_FULLSCREEN' }
  | { type: 'TOGGLE_GPU_ACCELERATION' }
  | { type: 'START_TRACKING'; payload: string }
  | { type: 'STOP_TRACKING' }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: { expandedNodes: number; totalNodes: number } }
  | { type: 'VALIDATE_URL'; payload: string }
  | { type: 'RATE_LIMIT_CHECK'; payload: { key: string; limit: number; window: number } }
  | { type: 'RESET_STATE' };

const initialState: GraphState = {
  nodes: [],
  edges: [],
  currentAccount: null,
  currentTransaction: null,
  navigationHistory: [],
  currentHistoryIndex: -1,
  loading: false,
  error: null,
  progress: 0,
  progressMessage: '',
  isFullscreen: false,
  useGPUAcceleration: false,
  viewportState: null,
  trackedAddress: null,
  isTrackingMode: false,
  expandedNodesCount: 0,
  totalNodesToLoad: 0,
  lastValidatedUrls: new Set(),
  rateLimitState: new Map(),
};

// Security helper functions
const sanitizeUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    if (parsedUrl.origin !== window.location.origin) {
      throw new Error('Cross-origin URL not allowed');
    }
    return parsedUrl.href;
  } catch {
    throw new Error('Invalid URL format');
  }
};

const isRateLimited = (state: GraphState, key: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  const entry = state.rateLimitState.get(key);

  if (!entry) return false;

  // Reset window if expired
  if (now - entry.lastReset > windowMs) {
    return false;
  }

  return entry.count >= limit;
};

// Enhanced reducer with security and performance features
const graphReducer = (state: GraphState, action: GraphAction): GraphState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_PROGRESS':
      return {
        ...state,
        progress: action.payload.progress,
        progressMessage: action.payload.message
      };

    case 'SET_NODES':
      return { ...state, nodes: action.payload };

    case 'SET_EDGES':
      return { ...state, edges: action.payload };

    case 'ADD_NODES':
      const existingNodeIds = new Set(state.nodes.map(n => n.id));
      const newNodes = action.payload.filter(n => !existingNodeIds.has(n.id));
      return { ...state, nodes: [...state.nodes, ...newNodes] };

    case 'ADD_EDGES':
      const existingEdgeIds = new Set(state.edges.map(e => e.id));
      const newEdges = action.payload.filter(e => !existingEdgeIds.has(e.id));
      return { ...state, edges: [...state.edges, ...newEdges] };

    case 'NAVIGATE_TO_ACCOUNT':
      let newHistory = state.navigationHistory;
      let newIndex = state.currentHistoryIndex;

      if (action.payload.addToHistory !== false) {
        // Add to history if not explicitly disabled
        newHistory = [...state.navigationHistory.slice(0, state.currentHistoryIndex + 1), action.payload.address];
        newIndex = newHistory.length - 1;
      }

      return {
        ...state,
        currentAccount: action.payload.address,
        navigationHistory: newHistory,
        currentHistoryIndex: newIndex,
        loading: true,
        error: null
      };

    case 'NAVIGATE_TO_TRANSACTION':
      let newTxHistory = state.navigationHistory;
      let newTxIndex = state.currentHistoryIndex;

      if (action.payload.addToHistory !== false) {
        newTxHistory = [...state.navigationHistory.slice(0, state.currentHistoryIndex + 1), action.payload.signature];
        newTxIndex = newTxHistory.length - 1;
      }

      return {
        ...state,
        currentTransaction: action.payload.signature,
        navigationHistory: newTxHistory,
        currentHistoryIndex: newTxIndex,
        loading: true,
        error: null
      };

    case 'NAVIGATION_SUCCESS':
      return {
        ...state,
        loading: false,
        error: null,
        ...(action.payload.type === 'account' && { currentAccount: action.payload.target }),
        ...(action.payload.type === 'transaction' && { currentTransaction: action.payload.target })
      };

    case 'NAVIGATION_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'SET_VIEWPORT':
      return { ...state, viewportState: action.payload };

    case 'TOGGLE_FULLSCREEN':
      return { ...state, isFullscreen: !state.isFullscreen };

    case 'TOGGLE_GPU_ACCELERATION':
      return { ...state, useGPUAcceleration: !state.useGPUAcceleration };

    case 'START_TRACKING':
      return {
        ...state,
        trackedAddress: action.payload,
        isTrackingMode: true
      };

    case 'STOP_TRACKING':
      return {
        ...state,
        trackedAddress: null,
        isTrackingMode: false
      };

    case 'UPDATE_PERFORMANCE_METRICS':
      return {
        ...state,
        expandedNodesCount: action.payload.expandedNodes,
        totalNodesToLoad: action.payload.totalNodes
      };

    case 'VALIDATE_URL':
      try {
        const validUrl = sanitizeUrl(action.payload);
        return {
          ...state,
          lastValidatedUrls: new Set([...state.lastValidatedUrls, validUrl])
        };
      } catch {
        return { ...state, error: 'Invalid URL provided' };
      }

    case 'RATE_LIMIT_CHECK':
      const { key, limit, window: windowMs } = action.payload;
      const now = Date.now();
      const existing = state.rateLimitState.get(key);

      let newCount = 1;
      let lastReset = now;

      if (existing) {
        if (now - existing.lastReset > windowMs) {
          // Reset window
          newCount = 1;
          lastReset = now;
        } else {
          newCount = existing.count + 1;
          lastReset = existing.lastReset;
        }
      }

      const newRateLimitState = new Map(state.rateLimitState);
      newRateLimitState.set(key, { count: newCount, lastReset });

      return {
        ...state,
        rateLimitState: newRateLimitState,
        ...(newCount > limit && { error: `Rate limit exceeded for ${key}` })
      };

    case 'RESET_STATE':
      return { ...initialState };

    default:
      return state;
  }
};

// Context interface
export interface GraphContextValue {
  state: GraphState;
  dispatch: React.Dispatch<GraphAction>;

  // Cytoscape instance management
  cyRef: React.MutableRefObject<cytoscape.Core | null>;
  isInitialized: boolean;

  // Navigation actions
  navigateToAccount: (address: string, options?: { addToHistory?: boolean; validateUrl?: boolean }) => Promise<void>;
  navigateToTransaction: (signature: string, options?: { addToHistory?: boolean; validateUrl?: boolean }) => Promise<void>;
  canGoBack: boolean;
  canGoForward: boolean;
  navigateBack: () => void;
  navigateForward: () => void;

  // Graph manipulation
  addNodes: (nodes: GraphNode[]) => void;
  addEdges: (edges: GraphEdge[]) => void;
  updateViewport: (viewport: { zoom: number; pan: { x: number; y: number } }) => void;

  // Security functions
  safeNavigate: (url: string) => Promise<void>;
  checkRateLimit: (key: string, limit?: number, windowMs?: number) => boolean;

  // Performance monitoring
  updatePerformanceMetrics: (metrics: { expandedNodes: number; totalNodes: number }) => void;

  // Error recovery
  retryLastAction: () => void;
  clearError: () => void;
}

const GraphContext = createContext<GraphContextValue | null>(null);

export const useGraphContext = (): GraphContextValue => {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraphContext must be used within a GraphProvider');
  }
  return context;
};

// Command pattern for navigation actions
abstract class NavigationCommand {
  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
  abstract getDescription(): string;
}

class AccountNavigationCommand extends NavigationCommand {
  constructor(
    private dispatch: React.Dispatch<GraphAction>,
    private router: any,
    private targetAddress: string,
    private previousAddress: string | null
  ) {
    super();
  }

  async execute(): Promise<void> {
    this.dispatch({ type: 'NAVIGATE_TO_ACCOUNT', payload: { address: this.targetAddress } });
    await this.router.push(`/account/${this.targetAddress}`, { scroll: false });
    this.dispatch({ type: 'NAVIGATION_SUCCESS', payload: { target: this.targetAddress, type: 'account' } });
  }

  async undo(): Promise<void> {
    if (this.previousAddress) {
      this.dispatch({ type: 'NAVIGATE_TO_ACCOUNT', payload: { address: this.previousAddress, addToHistory: false } });
      await this.router.push(`/account/${this.previousAddress}`, { scroll: false });
      this.dispatch({ type: 'NAVIGATION_SUCCESS', payload: { target: this.previousAddress, type: 'account' } });
    }
  }

  getDescription(): string {
    return `Navigate to account ${this.targetAddress}`;
  }
}

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(graphReducer, initialState);
  const router = useRouter();
  const cyRef = useRef<cytoscape.Core | null>(null);
  const isInitialized = useRef(false);
  const commandHistory = useRef<NavigationCommand[]>([]);
  const lastActionRef = useRef<() => Promise<void> | void>();

  // Navigation functions with enhanced security
  const navigateToAccount = useCallback(async (
    address: string,
    options: { addToHistory?: boolean; validateUrl?: boolean } = {}
  ) => {
    const { addToHistory = true, validateUrl = true } = options;

    try {
      // Rate limiting check
      if (isRateLimited(state, `navigate-${address}`, 10, 60000)) { // 10 requests per minute
        throw new Error('Navigation rate limit exceeded');
      }

      dispatch({ type: 'RATE_LIMIT_CHECK', payload: { key: `navigate-${address}`, limit: 10, window: 60000 } });

      // URL validation if requested
      if (validateUrl) {
        const url = `/account/${address}`;
        dispatch({ type: 'VALIDATE_URL', payload: url });
      }

      // Create and execute navigation command
      const command = new AccountNavigationCommand(dispatch, router, address, state.currentAccount);
      await command.execute();

      if (addToHistory) {
        commandHistory.current.push(command);
      }

      // Store for retry functionality
      lastActionRef.current = () => navigateToAccount(address, options);

    } catch (error) {
      dispatch({ type: 'NAVIGATION_ERROR', payload: error instanceof Error ? error.message : 'Navigation failed' });
    }
  }, [router, state]);

  const navigateToTransaction = useCallback(async (
    signature: string,
    options: { addToHistory?: boolean; validateUrl?: boolean } = {}
  ) => {
    const { addToHistory = true, validateUrl = true } = options;

    try {
      // Rate limiting check
      if (isRateLimited(state, `navigate-tx-${signature}`, 10, 60000)) {
        throw new Error('Transaction navigation rate limit exceeded');
      }

      dispatch({ type: 'RATE_LIMIT_CHECK', payload: { key: `navigate-tx-${signature}`, limit: 10, window: 60000 } });

      // URL validation if requested
      if (validateUrl) {
        const url = `/tx/${signature}`;
        dispatch({ type: 'VALIDATE_URL', payload: url });
      }

      dispatch({ type: 'NAVIGATE_TO_TRANSACTION', payload: { signature, addToHistory } });

      // Open in new tab for transactions (safer than same-tab navigation)
      const sanitizedUrl = sanitizeUrl(`/tx/${signature}`);
      window.open(sanitizedUrl, '_blank', 'noopener,noreferrer');

      dispatch({ type: 'NAVIGATION_SUCCESS', payload: { target: signature, type: 'transaction' } });

      // Store for retry functionality
      lastActionRef.current = () => navigateToTransaction(signature, options);

    } catch (error) {
      dispatch({ type: 'NAVIGATION_ERROR', payload: error instanceof Error ? error.message : 'Transaction navigation failed' });
    }
  }, [state]);

  // Safe navigation with full security checks
  const safeNavigate = useCallback(async (url: string) => {
    try {
      const sanitizedUrl = sanitizeUrl(url);
      dispatch({ type: 'VALIDATE_URL', payload: sanitizedUrl });

      // Check rate limit for this specific URL
      const urlKey = `safe-navigate-${new URL(sanitizedUrl).pathname}`;
      if (isRateLimited(state, urlKey, 5, 30000)) { // 5 requests per 30 seconds per URL
        throw new Error('URL navigation rate limit exceeded');
      }

      dispatch({ type: 'RATE_LIMIT_CHECK', payload: { key: urlKey, limit: 5, window: 30000 } });

      window.open(sanitizedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Navigation failed' });
    }
  }, [state]);

  // History navigation
  const canGoBack = state.currentHistoryIndex > 0;
  const canGoForward = state.currentHistoryIndex < state.navigationHistory.length - 1;

  const navigateBack = useCallback(() => {
    if (canGoBack) {
      const newIndex = state.currentHistoryIndex - 1;
      const target = state.navigationHistory[newIndex];
      navigateToAccount(target, { addToHistory: false });
    }
  }, [canGoBack, state.currentHistoryIndex, state.navigationHistory, navigateToAccount]);

  const navigateForward = useCallback(() => {
    if (canGoForward) {
      const newIndex = state.currentHistoryIndex + 1;
      const target = state.navigationHistory[newIndex];
      navigateToAccount(target, { addToHistory: false });
    }
  }, [canGoForward, state.currentHistoryIndex, state.navigationHistory, navigateToAccount]);

  // Graph manipulation functions
  const addNodes = useCallback((nodes: GraphNode[]) => {
    dispatch({ type: 'ADD_NODES', payload: nodes });
  }, []);

  const addEdges = useCallback((edges: GraphEdge[]) => {
    dispatch({ type: 'ADD_EDGES', payload: edges });
  }, []);

  const updateViewport = useCallback((viewport: { zoom: number; pan: { x: number; y: number } }) => {
    dispatch({ type: 'SET_VIEWPORT', payload: viewport });
  }, []);

  // Rate limiting check
  const checkRateLimit = useCallback((key: string, limit = 10, windowMs = 60000): boolean => {
    return isRateLimited(state, key, limit, windowMs);
  }, [state]);

  // Performance monitoring
  const updatePerformanceMetrics = useCallback((metrics: { expandedNodes: number; totalNodes: number }) => {
    dispatch({ type: 'UPDATE_PERFORMANCE_METRICS', payload: metrics });
  }, []);

  // Error recovery
  const retryLastAction = useCallback(async () => {
    if (lastActionRef.current) {
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        await lastActionRef.current();
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Retry failed' });
      }
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Cleanup effect
  useEffect(() => {
    // Copy ref to variable to avoid stale closure in cleanup
    const currentCy = cyRef.current;
    return () => {
      // Clean up any ongoing operations
      if (currentCy) {
        currentCy.destroy();
      }
    };
  }, []);

  const contextValue: GraphContextValue = {
    state,
    dispatch,
    cyRef,
    isInitialized: isInitialized.current,
    navigateToAccount,
    navigateToTransaction,
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
    addNodes,
    addEdges,
    updateViewport,
    safeNavigate,
    checkRateLimit,
    updatePerformanceMetrics,
    retryLastAction,
    clearError,
  };

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
};

export default GraphProvider;