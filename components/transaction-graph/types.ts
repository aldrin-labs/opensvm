'use client';

import cytoscape from 'cytoscape';

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
  initialSignature?: string;
  initialAccount?: string;
  initialTransactionData?: any; // DetailedTransactionInfo from @/lib/solana
  onTransactionSelect: (signature: string) => void;
  onAccountSelect?: (accountAddress: string) => void;
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

export interface GraphElementAddResult {
  cy: cytoscape.Core;
  address: string;
  newElements?: Set<string>;
}

export interface NavigationHistoryState {
  history: string[];
  currentIndex: number;
  isNavigating: boolean;
}