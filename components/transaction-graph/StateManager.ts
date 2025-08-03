'use client';

import { MemoryManager } from './MemoryManager';

// Enhanced state management interfaces
export interface GraphState {
  // Core data
  currentAddress: string | null;
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    lastUpdated: number;
  };
  
  // UI state
  isLoading: boolean;
  selectedNodes: Set<string>;
  selectedEdges: Set<string>;
  viewport: {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
  };
  
  // Settings
  settings: {
    layoutType: 'force' | 'dagre' | 'grid' | 'circular';
    showEdgeLabels: boolean;
    nodeSize: 'small' | 'medium' | 'large';
    enableGPU: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
  
  // Navigation
  navigationHistory: NavigationEntry[];
  navigationIndex: number;
  
  // Performance
  performance: {
    renderTime: number;
    nodeCount: number;
    edgeCount: number;
    memoryUsage: number;
  };
  
  // Error state
  errors: ErrorState[];
  
  // Metadata
  version: string;
  lastAction: string | null;
  timestamp: number;
}

export interface GraphNode {
  id: string;
  type: 'account' | 'transaction' | 'contract';
  position: { x: number; y: number };
  data: Record<string, any>;
  style?: Record<string, any>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    source: string;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'transaction' | 'interaction' | 'ownership';
  data: Record<string, any>;
  style?: Record<string, any>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    source: string;
  };
}

export interface NavigationEntry {
  address: string;
  timestamp: number;
  title: string;
  data?: Record<string, any>;
}

export interface ErrorState {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context?: Record<string, any>;
}

// Action types with full type safety
export type GraphAction =
  // Navigation actions
  | { type: 'NAVIGATE_TO_ACCOUNT'; payload: { address: string; timestamp: number } }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'NAVIGATE_FORWARD' }
  | { type: 'CLEAR_NAVIGATION_HISTORY' }
  
  // Data actions
  | { type: 'UPDATE_GRAPH_DATA'; payload: { nodes?: GraphNode[]; edges?: GraphEdge[] } }
  | { type: 'ADD_NODES'; payload: { nodes: GraphNode[] } }
  | { type: 'REMOVE_NODES'; payload: { nodeIds: string[] } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; data: Partial<GraphNode> } }
  | { type: 'ADD_EDGES'; payload: { edges: GraphEdge[] } }
  | { type: 'REMOVE_EDGES'; payload: { edgeIds: string[] } }
  | { type: 'UPDATE_EDGE'; payload: { edgeId: string; data: Partial<GraphEdge> } }
  
  // Selection actions
  | { type: 'SELECT_NODES'; payload: { nodeIds: string[]; append?: boolean } }
  | { type: 'SELECT_EDGES'; payload: { edgeIds: string[]; append?: boolean } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_NODE_SELECTION'; payload: { nodeId: string } }
  | { type: 'TOGGLE_EDGE_SELECTION'; payload: { edgeId: string } }
  
  // Viewport actions
  | { type: 'UPDATE_VIEWPORT'; payload: Partial<GraphState['viewport']> }
  | { type: 'FIT_TO_CONTENT'; payload?: { padding?: number } }
  | { type: 'CENTER_ON_NODES'; payload: { nodeIds: string[] } }
  | { type: 'ZOOM_TO_FIT' }
  | { type: 'RESET_VIEWPORT' }
  
  // Settings actions
  | { type: 'UPDATE_SETTINGS'; payload: Partial<GraphState['settings']> }
  | { type: 'CHANGE_LAYOUT'; payload: { layoutType: GraphState['settings']['layoutType'] } }
  | { type: 'TOGGLE_EDGE_LABELS' }
  | { type: 'CHANGE_NODE_SIZE'; payload: { size: GraphState['settings']['nodeSize'] } }
  | { type: 'TOGGLE_GPU'; payload?: { enabled?: boolean } }
  | { type: 'CHANGE_THEME'; payload: { theme: GraphState['settings']['theme'] } }
  
  // Loading actions
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string } }
  
  // Error actions
  | { type: 'ADD_ERROR'; payload: Omit<ErrorState, 'id' | 'timestamp'> }
  | { type: 'REMOVE_ERROR'; payload: { errorId: string } }
  | { type: 'CLEAR_ERRORS' }
  
  // Performance actions
  | { type: 'UPDATE_PERFORMANCE'; payload: Partial<GraphState['performance']> }
  
  // State management actions
  | { type: 'RESET_STATE' }
  | { type: 'REHYDRATE_STATE'; payload: { state: Partial<GraphState> } }
  | { type: 'PERSIST_STATE' };

// Command interface for undoable actions
export interface Command {
  id: string;
  type: string;
  timestamp: number;
  execute: () => void;
  undo: () => void;
  redo?: () => void;
  description: string;
  metadata?: Record<string, any>;
}

export interface CommandHistory {
  commands: Command[];
  currentIndex: number;
  maxSize: number;
}

// State middleware interface
export interface StateMiddleware {
  name: string;
  beforeAction?: (action: GraphAction, state: GraphState) => GraphAction | null;
  afterAction?: (action: GraphAction, prevState: GraphState, nextState: GraphState) => void;
  onError?: (error: Error, action: GraphAction, state: GraphState) => void;
}

// State selector interface
export type StateSelector<T> = (state: GraphState) => T;

// Main state manager class
export class StateManager {
  private static instance: StateManager | null = null;
  private memoryManager = MemoryManager.getInstance();
  
  // State
  private state: GraphState;
  private commandHistory: CommandHistory;
  private middlewares: StateMiddleware[] = [];
  private selectors = new Map<string, { selector: StateSelector<any>; lastResult: any }>();
  
  // Event handling
  private listeners = new Set<(state: GraphState, action: GraphAction) => void>();
  private selectorListeners = new Map<string, Set<(result: any) => void>>();
  
  // Performance optimization
  private batchedActions: GraphAction[] = [];
  private batchTimeout: string | null = null;
  private isDispatching = false;

  private constructor() {
    this.state = this.getInitialState();
    this.commandHistory = {
      commands: [],
      currentIndex: -1,
      maxSize: 50
    };
    
    this.setupMiddlewares();
    this.setupSelectors();
    this.loadPersistedState();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<GraphState> {
    return this.state;
  }

  /**
   * Dispatch action with middleware support
   */
  dispatch(action: GraphAction): void {
    if (this.isDispatching) {
      // Queue action for batched execution
      this.batchedActions.push(action);
      this.scheduleBatchExecution();
      return;
    }

    this.isDispatching = true;

    try {
      // Run before middlewares
      let processedAction = action;
      for (const middleware of this.middlewares) {
        if (middleware.beforeAction) {
          const result = middleware.beforeAction(processedAction, this.state);
          if (result === null) {
            // Middleware cancelled the action
            return;
          }
          processedAction = result;
        }
      }

      const prevState = this.state;
      this.state = this.reducer(this.state, processedAction);

      // Update selectors
      this.updateSelectors(prevState, this.state);

      // Run after middlewares
      for (const middleware of this.middlewares) {
        if (middleware.afterAction) {
          middleware.afterAction(processedAction, prevState, this.state);
        }
      }

      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(this.state, processedAction);
        } catch (error) {
          console.error('Listener error:', error);
        }
      });

      // Auto-persist certain actions
      if (this.shouldPersistAction(processedAction)) {
        this.persistState();
      }

    } catch (error) {
      // Run error middlewares
      for (const middleware of this.middlewares) {
        if (middleware.onError) {
          middleware.onError(error as Error, action, this.state);
        }
      }
      throw error;
    } finally {
      this.isDispatching = false;
      this.processBatchedActions();
    }
  }

  /**
   * Execute command with undo/redo support
   */
  executeCommand(command: Command): void {
    try {
      command.execute();
      
      // Add to command history
      this.addCommandToHistory(command);
      
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    }
  }

  /**
   * Undo last command
   */
  undo(): boolean {
    if (this.commandHistory.currentIndex < 0) {
      return false;
    }

    const command = this.commandHistory.commands[this.commandHistory.currentIndex];
    try {
      command.undo();
      this.commandHistory.currentIndex--;
      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      return false;
    }
  }

  /**
   * Redo next command
   */
  redo(): boolean {
    if (this.commandHistory.currentIndex >= this.commandHistory.commands.length - 1) {
      return false;
    }

    this.commandHistory.currentIndex++;
    const command = this.commandHistory.commands[this.commandHistory.currentIndex];
    
    try {
      const redoAction = command.redo || command.execute;
      redoAction();
      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      this.commandHistory.currentIndex--;
      return false;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: GraphState, action: GraphAction) => void): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to selector results
   */
  subscribeToSelector<T>(
    selectorKey: string,
    selector: StateSelector<T>,
    listener: (result: T) => void
  ): () => void {
    // Register selector if not exists
    if (!this.selectors.has(selectorKey)) {
      this.selectors.set(selectorKey, {
        selector,
        lastResult: selector(this.state)
      });
    }

    // Add listener
    if (!this.selectorListeners.has(selectorKey)) {
      this.selectorListeners.set(selectorKey, new Set());
    }
    this.selectorListeners.get(selectorKey)!.add(listener);

    // Immediately call with current result
    const currentResult = this.selectors.get(selectorKey)!.lastResult;
    listener(currentResult);

    // Return unsubscribe function
    return () => {
      const listeners = this.selectorListeners.get(selectorKey);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.selectorListeners.delete(selectorKey);
          this.selectors.delete(selectorKey);
        }
      }
    };
  }

  /**
   * Create command for common actions
   */
  createCommand(action: GraphAction, description?: string): Command {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const prevState = { ...this.state };
    
    return {
      id: commandId,
      type: action.type,
      timestamp: Date.now(),
      description: description || `Execute ${action.type}`,
      execute: () => {
        this.dispatch(action);
      },
      undo: () => {
        // Create inverse action based on action type
        const undoAction = this.createUndoAction(action, prevState);
        if (undoAction) {
          this.dispatch(undoAction);
        }
      },
      metadata: {
        originalAction: action,
        prevState: JSON.stringify(prevState)
      }
    };
  }

  /**
   * Main reducer function
   */
  private reducer(state: GraphState, action: GraphAction): GraphState {
    const newState = { ...state };
    newState.lastAction = action.type;
    newState.timestamp = Date.now();

    switch (action.type) {
      case 'NAVIGATE_TO_ACCOUNT':
        return {
          ...newState,
          currentAddress: action.payload.address,
          navigationHistory: [
            ...state.navigationHistory.slice(0, state.navigationIndex + 1),
            {
              address: action.payload.address,
              timestamp: action.payload.timestamp,
              title: `Account ${action.payload.address.slice(0, 8)}...`
            }
          ],
          navigationIndex: state.navigationIndex + 1
        };

      case 'NAVIGATE_BACK':
        if (state.navigationIndex > 0) {
          const newIndex = state.navigationIndex - 1;
          return {
            ...newState,
            currentAddress: state.navigationHistory[newIndex].address,
            navigationIndex: newIndex
          };
        }
        return state;

      case 'NAVIGATE_FORWARD':
        if (state.navigationIndex < state.navigationHistory.length - 1) {
          const newIndex = state.navigationIndex + 1;
          return {
            ...newState,
            currentAddress: state.navigationHistory[newIndex].address,
            navigationIndex: newIndex
          };
        }
        return state;

      case 'UPDATE_GRAPH_DATA':
        return {
          ...newState,
          graphData: {
            nodes: action.payload.nodes || state.graphData.nodes,
            edges: action.payload.edges || state.graphData.edges,
            lastUpdated: Date.now()
          },
          performance: {
            ...state.performance,
            nodeCount: (action.payload.nodes || state.graphData.nodes).length,
            edgeCount: (action.payload.edges || state.graphData.edges).length
          }
        };

      case 'ADD_NODES':
        return {
          ...newState,
          graphData: {
            ...state.graphData,
            nodes: [...state.graphData.nodes, ...action.payload.nodes],
            lastUpdated: Date.now()
          },
          performance: {
            ...state.performance,
            nodeCount: state.graphData.nodes.length + action.payload.nodes.length
          }
        };

      case 'REMOVE_NODES':
        return {
          ...newState,
          graphData: {
            ...state.graphData,
            nodes: state.graphData.nodes.filter(node => !action.payload.nodeIds.includes(node.id)),
            edges: state.graphData.edges.filter(edge => 
              !action.payload.nodeIds.includes(edge.source) && 
              !action.payload.nodeIds.includes(edge.target)
            ),
            lastUpdated: Date.now()
          },
          selectedNodes: new Set(
            Array.from(state.selectedNodes).filter(id => !action.payload.nodeIds.includes(id))
          )
        };

      case 'SELECT_NODES':
        return {
          ...newState,
          selectedNodes: action.payload.append 
            ? new Set([...state.selectedNodes, ...action.payload.nodeIds])
            : new Set(action.payload.nodeIds)
        };

      case 'CLEAR_SELECTION':
        return {
          ...newState,
          selectedNodes: new Set(),
          selectedEdges: new Set()
        };

      case 'UPDATE_VIEWPORT':
        return {
          ...newState,
          viewport: {
            ...state.viewport,
            ...action.payload
          }
        };

      case 'UPDATE_SETTINGS':
        return {
          ...newState,
          settings: {
            ...state.settings,
            ...action.payload
          }
        };

      case 'SET_LOADING':
        return {
          ...newState,
          isLoading: action.payload.isLoading
        };

      case 'ADD_ERROR':
        return {
          ...newState,
          errors: [
            ...state.errors,
            {
              ...action.payload,
              id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now()
            }
          ]
        };

      case 'REMOVE_ERROR':
        return {
          ...newState,
          errors: state.errors.filter(error => error.id !== action.payload.errorId)
        };

      case 'CLEAR_ERRORS':
        return {
          ...newState,
          errors: []
        };

      case 'UPDATE_PERFORMANCE':
        return {
          ...newState,
          performance: {
            ...state.performance,
            ...action.payload
          }
        };

      case 'RESET_STATE':
        return this.getInitialState();

      case 'REHYDRATE_STATE':
        return {
          ...newState,
          ...action.payload.state
        };

      default:
        return state;
    }
  }

  /**
   * Get initial state
   */
  private getInitialState(): GraphState {
    return {
      currentAddress: null,
      graphData: {
        nodes: [],
        edges: [],
        lastUpdated: Date.now()
      },
      isLoading: false,
      selectedNodes: new Set(),
      selectedEdges: new Set(),
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
        width: 800,
        height: 600
      },
      settings: {
        layoutType: 'force',
        showEdgeLabels: true,
        nodeSize: 'medium',
        enableGPU: true,
        theme: 'auto'
      },
      navigationHistory: [],
      navigationIndex: -1,
      performance: {
        renderTime: 0,
        nodeCount: 0,
        edgeCount: 0,
        memoryUsage: 0
      },
      errors: [],
      version: '1.0.0',
      lastAction: null,
      timestamp: Date.now()
    };
  }

  /**
   * Setup default middlewares
   */
  private setupMiddlewares(): void {
    // Logging middleware
    this.addMiddleware({
      name: 'logger',
      beforeAction: (action, state) => {
        if (process.env.NODE_ENV === 'development') {
          console.group(`Action: ${action.type}`);
          console.log('Payload:', (action as any).payload);
          console.log('Previous State:', state);
        }
        return action;
      },
      afterAction: (action, prevState, nextState) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Next State:', nextState);
          console.groupEnd();
        }
      }
    });

    // Validation middleware
    this.addMiddleware({
      name: 'validator',
      beforeAction: (action, state) => {
        return this.validateAction(action, state) ? action : null;
      }
    });

    // Performance tracking middleware
    this.addMiddleware({
      name: 'performance',
      afterAction: (action, prevState, nextState) => {
        const memoryInfo = this.memoryManager.getMemoryMetrics();
        if (memoryInfo) {
          // Update performance metrics
          this.dispatch({
            type: 'UPDATE_PERFORMANCE',
            payload: {
              memoryUsage: memoryInfo.usedJSHeapSize
            }
          });
        }
      }
    });
  }

  /**
   * Setup common selectors
   */
  private setupSelectors(): void {
    // Current account selector
    this.selectors.set('currentAccount', {
      selector: (state: GraphState) => state.currentAddress,
      lastResult: this.state.currentAddress
    });

    // Visible nodes selector
    this.selectors.set('visibleNodes', {
      selector: (state: GraphState) => state.graphData.nodes.filter(node => {
        // Filter based on viewport and zoom level
        return true; // Simplified for now
      }),
      lastResult: []
    });

    // Selected items selector
    this.selectors.set('selectedItems', {
      selector: (state: GraphState) => ({
        nodes: Array.from(state.selectedNodes),
        edges: Array.from(state.selectedEdges)
      }),
      lastResult: { nodes: [], edges: [] }
    });

    // Navigation state selector
    this.selectors.set('navigationState', {
      selector: (state: GraphState) => ({
        canGoBack: state.navigationIndex > 0,
        canGoForward: state.navigationIndex < state.navigationHistory.length - 1,
        currentEntry: state.navigationHistory[state.navigationIndex] || null
      }),
      lastResult: { canGoBack: false, canGoForward: false, currentEntry: null }
    });
  }

  /**
   * Helper methods
   */
  private addMiddleware(middleware: StateMiddleware): void {
    this.middlewares.push(middleware);
  }

  private validateAction(action: GraphAction, state: GraphState): boolean {
    // Add validation logic based on action type
    switch (action.type) {
      case 'NAVIGATE_TO_ACCOUNT':
        return Boolean((action.payload as any).address);
      
      case 'ADD_NODES':
        return Array.isArray((action.payload as any).nodes);
      
      default:
        return true;
    }
  }

  private updateSelectors(prevState: GraphState, nextState: GraphState): void {
    for (const [key, { selector, lastResult }] of this.selectors.entries()) {
      const newResult = selector(nextState);
      
      // Check if result changed (shallow comparison)
      if (newResult !== lastResult) {
        this.selectors.set(key, { selector, lastResult: newResult });
        
        // Notify selector listeners
        const listeners = this.selectorListeners.get(key);
        if (listeners) {
          listeners.forEach(listener => {
            try {
              listener(newResult);
            } catch (error) {
              console.error('Selector listener error:', error);
            }
          });
        }
      }
    }
  }

  private addCommandToHistory(command: Command): void {
    // Remove commands after current index (for redo branches)
    this.commandHistory.commands = this.commandHistory.commands.slice(0, this.commandHistory.currentIndex + 1);
    
    // Add new command
    this.commandHistory.commands.push(command);
    this.commandHistory.currentIndex = this.commandHistory.commands.length - 1;
    
    // Limit history size
    if (this.commandHistory.commands.length > this.commandHistory.maxSize) {
      this.commandHistory.commands.shift();
      this.commandHistory.currentIndex--;
    }
  }

  private createUndoAction(action: GraphAction, prevState: GraphState): GraphAction | null {
    // Create inverse actions for common action types
    switch (action.type) {
      case 'NAVIGATE_TO_ACCOUNT':
        return {
          type: 'REHYDRATE_STATE',
          payload: {
            state: {
              currentAddress: prevState.currentAddress,
              navigationHistory: prevState.navigationHistory,
              navigationIndex: prevState.navigationIndex
            }
          }
        };
      
      case 'ADD_NODES':
        return {
          type: 'REMOVE_NODES',
          payload: {
            nodeIds: (action.payload as any).nodes.map((node: GraphNode) => node.id)
          }
        };
      
      case 'REMOVE_NODES':
        const removedNodes = prevState.graphData.nodes.filter(node => 
          (action.payload as any).nodeIds.includes(node.id)
        );
        return {
          type: 'ADD_NODES',
          payload: { nodes: removedNodes }
        };
      
      default:
        return {
          type: 'REHYDRATE_STATE',
          payload: { state: prevState }
        };
    }
  }

  private shouldPersistAction(action: GraphAction): boolean {
    const persistableActions = [
      'UPDATE_SETTINGS',
      'CHANGE_THEME',
      'CHANGE_LAYOUT',
      'TOGGLE_GPU'
    ];
    return persistableActions.includes(action.type);
  }

  private scheduleBatchExecution(): void {
    if (this.batchTimeout) return;
    
    this.batchTimeout = this.memoryManager.safeSetTimeout(() => {
      this.processBatchedActions();
    }, 0);
  }

  private processBatchedActions(): void {
    if (this.batchTimeout) {
      this.memoryManager.unregisterResource(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    if (this.batchedActions.length > 0) {
      const actions = [...this.batchedActions];
      this.batchedActions = [];
      
      actions.forEach(action => this.dispatch(action));
    }
  }

  private persistState(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const persistableState = {
        settings: this.state.settings,
        viewport: this.state.viewport,
        navigationHistory: this.state.navigationHistory.slice(-10), // Keep last 10
        navigationIndex: Math.min(this.state.navigationIndex, 9)
      };
      
      localStorage.setItem('graph-state', JSON.stringify(persistableState));
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }

  private loadPersistedState(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const persistedState = localStorage.getItem('graph-state');
      if (persistedState) {
        const state = JSON.parse(persistedState);
        this.dispatch({
          type: 'REHYDRATE_STATE',
          payload: { state }
        });
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
  }

  /**
   * Public API methods
   */
  getCommandHistory(): CommandHistory {
    return { ...this.commandHistory };
  }

  canUndo(): boolean {
    return this.commandHistory.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.commandHistory.currentIndex < this.commandHistory.commands.length - 1;
  }

  clearHistory(): void {
    this.commandHistory = {
      commands: [],
      currentIndex: -1,
      maxSize: this.commandHistory.maxSize
    };
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.listeners.clear();
    this.selectorListeners.clear();
    this.selectors.clear();
    this.middlewares = [];
    this.clearHistory();
    
    if (this.batchTimeout) {
      this.memoryManager.unregisterResource(this.batchTimeout);
    }
    
    StateManager.instance = null;
  }
}

export default StateManager;