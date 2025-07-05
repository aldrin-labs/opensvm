'use client';

import { useCallback, useRef } from 'react';
import { 
  queueAccountFetch as queueAccountFetchUtil,
  processAccountFetchQueue as processAccountFetchQueueUtil,
  debugLog
} from '../';

interface UseAccountFetchingProps {
  fetchAndProcessAccount: (address: string, depth: number, parentSignature: string | null, signal: AbortSignal) => Promise<void>;
  setTotalAccounts: (count: number | ((prev: number) => number)) => void;
  totalAccounts: number;
}

interface UseAccountFetchingReturn {
  queueAccountFetch: (address: string, depth?: number, parentSignature?: string | null) => void;
  processAccountFetchQueue: () => void;
  fetchQueueRef: React.MutableRefObject<Array<{ address: string; depth: number; parentSignature: string | null }>>;
  pendingFetchesRef: React.MutableRefObject<Set<string>>;
  loadedAccountsRef: React.MutableRefObject<Set<string>>;
  isProcessingQueueRef: React.MutableRefObject<boolean>;
  queueAccountFetchRef: React.MutableRefObject<((address: string, depth?: number, parentSignature?: string | null) => void) | null>;
}

/**
 * Custom hook for managing account fetching queue and processing
 * Handles the complex state management around fetching accounts and their transactions
 */
export function useAccountFetching({
  fetchAndProcessAccount,
  setTotalAccounts,
  totalAccounts
}: UseAccountFetchingProps): UseAccountFetchingReturn {
  // Refs for queue management
  const fetchQueueRef = useRef<Array<{ address: string; depth: number; parentSignature: string | null }>>([]);
  const pendingFetchesRef = useRef<Set<string>>(new Set());
  const loadedAccountsRef = useRef<Set<string>>(new Set());
  const isProcessingQueueRef = useRef<boolean>(false);
  const queueAccountFetchRef = useRef<((address: string, depth?: number, parentSignature?: string | null) => void) | null>(null);

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

  return {
    queueAccountFetch,
    processAccountFetchQueue,
    fetchQueueRef,
    pendingFetchesRef,
    loadedAccountsRef,
    isProcessingQueueRef,
    queueAccountFetchRef
  };
}