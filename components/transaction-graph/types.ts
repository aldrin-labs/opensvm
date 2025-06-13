'use client';

// Remove cytoscape import
import * as echarts from 'echarts';

// Define interfaces locally instead of importing them
export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface GraphState { 
  focusedTransaction: string;
  title?: string;
  timestamp?: number;
  nodes: string[];  // Node IDs
  edges: string[];  // Edge IDs
  viewportState: ViewportState;
}

export interface SavedGraphState {
  nodes: string[];  // Node IDs
  edges: string[];  // Edge IDs
  viewportState: ViewportState;
  id?: string;
  name?: string;
  createdAt?: string;
  focusedTransaction?: string;
}

export interface Transaction {
  signature: string;
  timestamp: number;
  success: boolean;
  accounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  transfers: {
    account: string;
    change: number;
  }[];
}

export interface AccountData {
  address: string;
  transactions: Transaction[];
}

export interface TransactionGraphProps {
  initialSignature: string;
  initialAccount?: string;
  onTransactionSelect: (signature: string) => void;
  clientSideNavigation?: boolean;
  width?: string | number;
  height?: string | number;
  maxDepth?: number;
}

export interface FetchQueueItem {
  address: string;
  depth: number;
  parentSignature: string | null;
}

// Update to use ECharts types
export interface GraphElementAddResult {
  chart: echarts.ECharts;
  address: string;
  newElements?: Set<string>;
}

export interface NavigationHistoryState {
  history: string[];
  currentIndex: number;
  isNavigating: boolean;
}

// Performance optimization related types for ECharts
export interface ElementCache {
  nodes: Map<string, any>; // ECharts node definition
  edges: Map<string, any>; // ECharts edge definition
}

export interface RenderBatch {
  nodes: any[]; // ECharts node definitions
  edges: any[]; // ECharts edge definitions
}

export interface PerformanceConfig {
  batchSize: number;
  renderDelay: number;
  useElementCache: boolean;
  useVirtualization: boolean;
  maxVisibleElements?: number;
}

export interface VirtualizationState {
  visibleArea: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  renderedElements: Set<string>;
  hiddenElements: Set<string>;
}

// Add ECharts-specific types
export interface GraphNode {
  id: string;
  name: string;
  value: number;
  symbolSize: number;
  category: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  };
  label?: {
    show?: boolean;
    formatter?: string;
  };
  tooltip?: {
    formatter?: string;
  };
  x?: number;
  y?: number;
  z?: number;
  data?: any;
}

export interface GraphLink {
  source: string;
  target: string;
  value?: number;
  lineStyle?: {
    color?: string;
    width?: number;
    opacity?: number;
    curveness?: number;
  };
  tooltip?: {
    formatter?: string;
  };
  data?: any;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  categories: { name: string }[];
}