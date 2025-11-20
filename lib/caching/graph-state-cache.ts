/**
 * GraphStateCache - A utility for preserving graph state during navigation
 * 
 * This module provides functionality to cache and restore graph state,
 * including viewport position, focused transaction, and graph elements.
 */

// Interface for viewport state
export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

// Interface for graph state
export interface GraphState { 
  focusedTransaction: string;
  title?: string;
  timestamp?: number;
  nodes: string[];  // Node IDs
  edges: string[];  // Edge IDs
  viewportState: ViewportState;
}

// Extended state tracking for expansion depth
export interface EnhancedGraphState extends GraphState {
  expandedNodes: Set<string>;  // Tracks which nodes have been expanded
  expansionDepth: Record<string, number>;  // Tracks expansion depth per node
  expandedTimestamp?: number; // When the graph was last expanded
}

// For backward compatibility with existing code
export interface SavedGraphState {
  nodes: string[];  // Node IDs
  edges: string[];  // Edge IDs
  viewportState: ViewportState;
}

// Cache TTL in milliseconds (30 minutes)
// Maximum number of transaction states to store in memory
const MAX_MEMORY_CACHE_SIZE = 200000000;

// Storage key
const GRAPH_STATE_STORAGE_KEY = 'opensvm-graph-state';

/**
 * GraphStateCache - Provides methods for persisting and retrieving graph state
 */
export class GraphStateCache {
  // In-memory cache for faster access during user session
  private static memoryCache: Map<string, EnhancedGraphState> = new Map();
  
  /**
   * Save graph state to local storage and in-memory cache
   * @param state - The graph state to save
   * @param signature - Optional transaction signature as a key
   */
  static saveState(state: GraphState, signature?: string): void {
    try {
      // Validate state object before saving
      if (!state || typeof state !== 'object') {
        console.warn('Invalid state object provided to saveState');
        return;
      }

      // Validate required properties
      if (!state.focusedTransaction || typeof state.focusedTransaction !== 'string') {
        console.warn('Invalid focusedTransaction in state');
        return;
      }

      if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
        console.warn('Invalid nodes or edges in state');
        return;
      }

      let enhancedState: EnhancedGraphState;
      if (signature) {
        try {
          const existing = GraphStateCache.memoryCache.get(signature);
          if (existing) {
            // Merge the new state with the existing enhanced state without discarding expansion info
            enhancedState = {
              ...state,
              expandedNodes: existing.expandedNodes || new Set<string>(),
              expansionDepth: existing.expansionDepth || {},
              expandedTimestamp: Date.now()
            };
          } else {
            // Check if state already has enhanced properties (rarely provided), otherwise create new ones
            if ((state as EnhancedGraphState).expandedNodes && (state as EnhancedGraphState).expansionDepth) {
              enhancedState = { ...state } as EnhancedGraphState;
              enhancedState.expandedTimestamp = Date.now();
            } else {
              enhancedState = {
                ...state,
                expandedNodes: new Set<string>(),
                expansionDepth: {},
                expandedTimestamp: Date.now()
              };
            }
          }
          
          // Check memory usage before storing
          const memorySize = this.estimateMemoryUsage(enhancedState);
          if (memorySize > MAX_MEMORY_CACHE_SIZE / 100) { // Don't let single item exceed 1% of max
            console.warn(`State object too large (${memorySize} bytes), skipping memory cache`);
          } else {
            GraphStateCache.memoryCache.set(signature, enhancedState);
          }
        } catch (memoryError) {
          console.error('Error handling memory cache:', memoryError);
        }
      }

      try {
        const key = signature ? `${GRAPH_STATE_STORAGE_KEY}-${signature}` : GRAPH_STATE_STORAGE_KEY;
        // When saving to local storage, include enhanced fields if available, converting Set to an array for serialization
        let stateToStore: any = state;
        if (signature && GraphStateCache.memoryCache.has(signature)) {
          const data = GraphStateCache.memoryCache.get(signature)!;
          stateToStore = {
            ...data,
            expandedNodes: Array.from(data.expandedNodes)
          };
        }
        
        const serialized = JSON.stringify(stateToStore);
        // Check localStorage quota before saving
        if (serialized.length > 5000000) { // 5MB limit check
          console.warn('State too large for localStorage, truncating data');
          // Save minimal state instead
          const minimalState = {
            focusedTransaction: state.focusedTransaction,
            viewportState: state.viewportState,
            timestamp: Date.now()
          };
          localStorage.setItem(key, JSON.stringify(minimalState));
        } else {
          localStorage.setItem(key, serialized);
        }
      } catch (storageError) {
        console.error('Failed to save to localStorage:', storageError);
        // Attempt cleanup if quota exceeded
        if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
          this.cleanupOldStates();
          try {
            // Retry with minimal state
            const minimalState = {
              focusedTransaction: state.focusedTransaction,
              viewportState: state.viewportState,
              timestamp: Date.now()
            };
            const key = signature ? `${GRAPH_STATE_STORAGE_KEY}-${signature}` : GRAPH_STATE_STORAGE_KEY;
            localStorage.setItem(key, JSON.stringify(minimalState));
          } catch (retryError) {
            console.error('Failed to save even minimal state:', retryError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to save graph state:', error);
      // Ensure we don't break the application flow
    }
  }

  /**
   * Estimate memory usage of a state object
   */
  private static estimateMemoryUsage(state: EnhancedGraphState): number {
    try {
      return JSON.stringify({
        ...state,
        expandedNodes: Array.from(state.expandedNodes)
      }).length * 2; // Rough estimate: 2 bytes per character
    } catch (error) {
      console.error('Error estimating memory usage:', error);
      return 0;
    }
  }

  /**
   * Clean up old states to free up localStorage space
   */
  private static cleanupOldStates(): void {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GRAPH_STATE_STORAGE_KEY)) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              const state = JSON.parse(value);
              // Remove states older than 7 days
              if (state.timestamp && Date.now() - state.timestamp > 7 * 24 * 60 * 60 * 1000) {
                keysToRemove.push(key);
              }
            }
          } catch (parseError) {
            // Remove corrupted states
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error(`Failed to remove key ${key}:`, error);
        }
      });

      console.log(`Cleaned up ${keysToRemove.length} old graph states`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Automatically save graph state based on focused transaction
   * @param state - The graph state to save
   */
  static autoSave(state: GraphState): void {
    try {
      // Validate input state
      if (!state || typeof state !== 'object') {
        console.warn('Invalid state provided to autoSave');
        return;
      }

      if (!state.focusedTransaction || typeof state.focusedTransaction !== 'string') {
        console.warn('No focusedTransaction in state, skipping autoSave');
        return;
      }

      // Validate nodes and edges arrays
      if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
        console.warn('Invalid nodes or edges in state, skipping autoSave');
        return;
      }

      // Skip if no nodes or edges are provided
      if (state.nodes.length === 0 && state.edges.length === 0) {
        return;
      }

      const signature = state.focusedTransaction;
      let existing: EnhancedGraphState | undefined;
      
      try {
        existing = GraphStateCache.memoryCache.get(signature);
      } catch (cacheError) {
        console.warn('Error accessing memory cache:', cacheError);
      }

      const now = Date.now();
      
      // Only save if: No existing state OR significant changes detected
      const shouldSave = !existing || 
        (now - (existing.expandedTimestamp || 0) > 2000) || 
        (Math.abs(existing.nodes.length - state.nodes.length) > 3) ||
        (existing.focusedTransaction !== state.focusedTransaction);

      if (shouldSave) {
        try {
          GraphStateCache.saveState(state, signature);
          
          // Also save as the latest state
          GraphStateCache.saveState(state);
        } catch (saveError) {
          console.error('Error saving state in autoSave:', saveError);
        }
      }
      
      // Keep the cache size in check
      try {
        GraphStateCache.trimMemoryCache();
      } catch (trimError) {
        console.error('Error trimming memory cache:', trimError);
      }
    } catch (error) {
      console.error('Error in autoSave:', error);
      // Don't let autoSave errors break the application
    }
  }

  /**
   * Get list of all saved graphs with metadata
   * @returns Array of saved graph metadata
   */
  static getSavedGraphs(): Array<{
    signature: string;
    title?: string;
    timestamp?: number;
  }> {
    try {
      const savedGraphs: Array<{
        signature: string;
        title?: string;
        timestamp?: number;
      }> = [];

      // Find all keys related to graph state
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GRAPH_STATE_STORAGE_KEY) && key !== GRAPH_STATE_STORAGE_KEY) {
          // Extract signature from key
          const signature = key.replace(`${GRAPH_STATE_STORAGE_KEY}-`, '');
          try {
            const storedState = localStorage.getItem(key);
            if (storedState) {
              const state = JSON.parse(storedState) as GraphState;
              savedGraphs.push({
                signature,
                title: state.title || signature.substring(0, 8) + '...',
                timestamp: state.timestamp || Date.now()
              });
            }
          } catch (e) {
            // Skip invalid entries
            console.error('Invalid graph state entry:', e);
          }
        }
      }
      
      // Sort by timestamp descending (newest first)
      return savedGraphs.sort((a, b) => 
        (b.timestamp || 0) - (a.timestamp || 0)
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Load graph state from local storage
   * @param signature - Optional transaction signature to load specific state
   * @returns The loaded graph state or null if none exists
   */
  static loadState(signature?: string): GraphState | null {
    try {
      // First check in-memory cache for faster access
      if (signature && GraphStateCache.memoryCache.has(signature)) {
        try {
          const cached = GraphStateCache.memoryCache.get(signature);
          if (cached) {
            // Update timestamp to mark as recently accessed
            cached.expandedTimestamp = Date.now();
            return cached;
          }
        } catch (cacheError) {
          console.warn('Error accessing memory cache:', cacheError);
        }
      }
      
      // If not in memory, load from local storage
      const key = signature ? `${GRAPH_STATE_STORAGE_KEY}-${signature}` : GRAPH_STATE_STORAGE_KEY;
      
      try {
        const storedState = localStorage.getItem(key);
        
        if (storedState) {
          let parsedState: GraphState;
          
          try {
            parsedState = JSON.parse(storedState) as GraphState;
          } catch (parseError) {
            console.error('Failed to parse stored state:', parseError);
            // Remove corrupted state
            localStorage.removeItem(key);
            return null;
          }

          // Validate parsed state
          if (!parsedState || typeof parsedState !== 'object') {
            console.warn('Invalid stored state structure');
            localStorage.removeItem(key);
            return null;
          }

          // Validate required fields
          if (!parsedState.focusedTransaction || !Array.isArray(parsedState.nodes) || !Array.isArray(parsedState.edges)) {
            console.warn('Stored state missing required fields');
            localStorage.removeItem(key);
            return null;
          }

          // Convert the parsed state to an EnhancedGraphState if loading by signature
          if (signature && !((parsedState as EnhancedGraphState).expandedNodes instanceof Set)) {
            try {
              // Handle conversion from array to Set for expandedNodes
              const enhancedState: EnhancedGraphState = {
                ...parsedState,
                expandedNodes: new Set(Array.isArray((parsedState as any).expandedNodes) ? 
                  (parsedState as any).expandedNodes : []),
                expansionDepth: (parsedState as any).expansionDepth || {},
                expandedTimestamp: Date.now()
              };
              
              // Cache the enhanced state in memory for faster future access
              GraphStateCache.memoryCache.set(signature, enhancedState);
              
              return enhancedState;
            } catch (conversionError) {
              console.error('Error converting to enhanced state:', conversionError);
              return parsedState; // Return basic state as fallback
            }
          }
          
          return parsedState;
        }
      } catch (storageError) {
        console.error('Error accessing localStorage:', storageError);
        
        // Check if storage is available
        if (typeof Storage === 'undefined') {
          console.warn('localStorage is not available');
        }
      }
    } catch (error) {
      console.error('Failed to load graph state:', error);
    }
    
    return null;
  }

  /**
   * Clear all graph states from local storage
   */
  static clearAllStates(): void {
    try {
      // Find all keys related to graph state
      const statesToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GRAPH_STATE_STORAGE_KEY)) {
          statesToRemove.push(key);
        }
      }
      
      // Remove all found states
      statesToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear graph states:', error);
    }
  }

  /**
   * Check if a state exists for a specific transaction
   * @param signature - The transaction signature to check
   * @returns Whether a state exists for the given transaction
   */
  static hasState(signature: string): boolean {
    try {
      // First check in-memory cache for faster access and to catch states not yet persisted
      if (GraphStateCache.memoryCache.has(signature)) {
        return true;
      }
      
      // Then check localStorage as a fallback
      const key = `${GRAPH_STATE_STORAGE_KEY}-${signature}`;
      return typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null;
    } catch (e) {
      console.error('Error checking for graph state:', e);
      return false;
    }
  }
  
  /**
   * Delete a saved graph state
   * @param signature - The transaction signature to delete
   * @returns Whether the deletion was successful
   */
  static deleteGraph(signature: string): boolean {
    try {
      const key = `${GRAPH_STATE_STORAGE_KEY}-${signature}`;
      localStorage.removeItem(key);
      // Also remove from memory cache
      GraphStateCache.memoryCache.delete(signature);
      return true;
    } catch (e) {
      console.error('Error deleting graph state:', e);
      return false;
    }
  }
  
  /**
   * Trim the in-memory cache to prevent excessive memory usage
   * Uses LRU strategy based on access timestamp
   */
  private static trimMemoryCache(): void {
    if (GraphStateCache.memoryCache.size <= MAX_MEMORY_CACHE_SIZE) return;
    
    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(GraphStateCache.memoryCache.entries())
      .sort((a, b) => (a[1].expandedTimestamp || 0) - (b[1].expandedTimestamp || 0));
      
    // Remove oldest entries until we're under the limit
    while (entries.length > MAX_MEMORY_CACHE_SIZE) {
      const oldest = entries.shift();
      if (oldest) {
        GraphStateCache.memoryCache.delete(oldest[0]);
      }
    }
  }
}