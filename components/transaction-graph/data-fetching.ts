'use client';

import * as echarts from 'echarts';
import { AccountData, FetchQueueItem, GraphElementAddResult, Transaction } from './types';
import { formatSolChange, formatTimestamp, shortenString } from './utils';
import { runIncrementalLayout, SMALL_GRAPH_THRESHOLD, MEDIUM_GRAPH_THRESHOLD, LARGE_GRAPH_THRESHOLD } from './layout';
import { GraphStateCache } from '@/lib/graph-state-cache';

/**
 * Fetch transaction data with caching
 * @param signature Transaction signature
 * @param transactionCache Cache for transaction data
 * @returns Transaction data
 */
export const fetchTransactionData = async (
  signature: string,
  transactionCache: Map<string, any>
): Promise<any> => {
  // Check if we have this in memory cache first
  const cachedData = transactionCache.get(signature);
  if (cachedData) {
    return cachedData;
  }
  
  try {
    // Fetch from API if not in cache
    const response = await fetch(`/api/transaction/${signature}`, {
      headers: { 'Cache-Control': 'no-cache' } // Ensure fresh data
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching transaction: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the result for future use
    transactionCache.set(signature, data);
    
    return data;
  } catch (error) {
    console.error(`Failed to fetch transaction data ${signature}:`, error);
    throw error;
  }
};

/**
 * Fetch account transactions
 * @param address Account address
 * @param limit Maximum number of transactions to fetch
 * @param setError Error state setter function
 * @returns Account data or null if error
 */
export const fetchAccountTransactions = async (
  address: string,
  limit = 10,
  setError: (error: {message: string; severity: 'error' | 'warning'} | null) => void
): Promise<AccountData | null> => {
  try {
    // Circuit breaker for problematic accounts
    // Extended circuit breaker to handle additional problematic accounts
    if (address === 'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa' || 
        address === 'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt' ||
        address === 'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs') {
      return { address, transactions: [] }; // Return empty transactions for this specific account
    }
    // Add cache-busting parameter to prevent browser caching
    const cacheBuster = Date.now();
    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(`/api/account-transactions/${address}?limit=${limit}&_=${cacheBuster}`, 
      { 
        signal: controller.signal,
        // Add better error handling by capturing HTTP errors
        headers: { 'Cache-Control': 'no-cache' }
      });
    clearTimeout(timeoutId); // Clear the timeout to prevent memory leaks
    
    if (!response.ok) {
      // Handle specific HTTP error codes more gracefully
      if (response.status === 400) {
        console.warn(`Bad request for account ${address}, returning empty transactions`);
        return { address, transactions: [] };
      }
      throw new Error(`Error fetching transactions: ${response.statusText} (${response.status})`);
    }
    return await response.json();
  } catch (err) {
    // Only set the error if it's not a circuit-broken account
    console.error(`Error fetching transactions for ${address}:`, err);
    // Don't set global error for individual account fetch issues
    // Instead, show a warning that doesn't block the UI
    setError({
      message: `Note: Could not fetch transactions for account ${address.substring(0, 8)}... 
      This won't affect the rest of the graph.`,
      severity: 'warning'
    });
    return null;
  }
};

/**
 * Queue an account for fetching
 * @param address Account address
 * @param depth Current depth in the graph
 * @param parentSignature Parent transaction signature
 * @param fetchQueueRef Reference to fetch queue
 * @param pendingFetchesRef Reference to pending fetches
 * @param loadedAccountsRef Reference to loaded accounts
 * @param setTotalAccounts Function to update total accounts count
 * @param processAccountFetchQueue Function to process the fetch queue
 * @param isProcessingQueueRef Reference to track if queue is being processed (optional)
 */
export const queueAccountFetch = (
  address: string,
  depth = 0,
  parentSignature: string | null = null,
  fetchQueueRef: React.MutableRefObject<FetchQueueItem[]>, 
  pendingFetchesRef: React.MutableRefObject<Set<string>>,
  loadedAccountsRef: React.MutableRefObject<Set<string>>,
  setTotalAccounts: (cb: (prev: number) => number) => void,
  processAccountFetchQueue: () => void,
  isProcessingQueueRef?: React.MutableRefObject<boolean>
): void => {
  const accountKey = `${address}:${depth}`;
  // Validate address to prevent null/empty values
  if (!address || typeof address !== 'string') {
    console.warn('Attempted to queue invalid address:', address);
    return;
  }
  
  // Skip if we've already loaded this account
  // Check if we've already loaded or queued this account at this depth or lower
  if (loadedAccountsRef.current?.has(address)) {
    return;
  }

  if (pendingFetchesRef.current?.has(accountKey)) {
    return;
  }
  
  // Enforce maximum queue size to prevent unbounded growth
  const MAX_QUEUE_SIZE = 500;
  if (fetchQueueRef.current.length >= MAX_QUEUE_SIZE) {
    console.warn(`Fetch queue size limit reached (${MAX_QUEUE_SIZE}). Skipping address: ${address}`);
    return;
  }
  
  // Mark as pending before adding to queue
  pendingFetchesRef.current.add(accountKey);
  
  // Add to queue
  fetchQueueRef.current.push({ address, depth, parentSignature });
  
  // Update total accounts count for progress tracking
  setTotalAccounts(prev => prev + 1);
  
  // Process queue if not already processing
  if (!isProcessingQueueRef || !isProcessingQueueRef.current) {
    processAccountFetchQueue();
  }
};

/**
 * Process the fetch queue in parallel - optimized for performance
 * @param fetchQueueRef Reference to fetch queue
 * @param fetchAndProcessAccount Function to fetch and process an account
 * @param isProcessingQueueRef Reference to track if queue is being processed (optional)
 * @param currentNodeCount Current number of nodes in the graph (optional)
 * @returns Promise that resolves when processing is complete
 */
export const processAccountFetchQueue = async (
  fetchQueueRef: React.MutableRefObject<FetchQueueItem[]>,
  fetchAndProcessAccount: (address: string, depth: number, parentSignature: string | null) => Promise<void>,
  isProcessingQueueRef?: React.MutableRefObject<boolean>,
  currentNodeCount = 0
): Promise<void> => { 
  // Early return if queue is empty or already processing
  if (fetchQueueRef.current.length === 0) return;
  if (isProcessingQueueRef && isProcessingQueueRef.current) return;
  
  try {
    // Set processing flag to true if it exists
    if (isProcessingQueueRef) {
      isProcessingQueueRef.current = true;
    }
    
    // Determine batch size based on graph size
    let batchSize = 10;
    if (currentNodeCount > LARGE_GRAPH_THRESHOLD) {
      batchSize = 3; // Very small batches for large graphs
    } else if (currentNodeCount > MEDIUM_GRAPH_THRESHOLD) {
      batchSize = 5; // Small batches for medium graphs
    }
    
    // Use iterative approach instead of recursion to avoid stack overflow
    while (fetchQueueRef.current.length > 0) {
      // Process batches of accounts in parallel
      const batch = fetchQueueRef.current.splice(0, batchSize);
      
      // Fetch all accounts in parallel with timeout protection
      await Promise.allSettled(
        batch.map(item => {
          // Add timeout protection for each fetch operation
          const fetchPromise = fetchAndProcessAccount(item.address, item.depth, item.parentSignature);
          const timeoutPromise = new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error(`Fetch timeout for ${item.address}`)), 30000)
          );
          
          return Promise.race([fetchPromise, timeoutPromise])
            .catch(err => {
              console.error(`Error processing account ${item.address}:`, err);
            });
        })
      );
      
      // Add small delay between batches to prevent overwhelming the API
      // Adjust delay based on graph size
      let delayBetweenBatches = 50;
      if (currentNodeCount > LARGE_GRAPH_THRESHOLD) {
        delayBetweenBatches = 200; // Longer delay for large graphs
      } else if (currentNodeCount > MEDIUM_GRAPH_THRESHOLD) {
        delayBetweenBatches = 100; // Medium delay for medium graphs
      }
      
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  } catch (error) {
    console.error('Error processing fetch queue:', error);
  } finally {
    // Always reset processing flag when done
    if (isProcessingQueueRef) {
      isProcessingQueueRef.current = false;
    }
  }
};

/**
 * Add account and its transactions to the graph
 * @param address Account address
 * @param totalAccounts Total number of accounts
 * @param depth Current depth in the graph
 * @param parentSignature Parent transaction signature
 * @param newElements Set of new element IDs
 * @param maxDepth Maximum depth to traverse
 * @param shouldExcludeAddress Function to check if address should be excluded
 * @param shouldIncludeTransaction Function to check if transaction should be included
 * @param fetchAccountTransactions Function to fetch account transactions
 * @param cyRef Reference to cytoscape instance
 * @param loadedAccountsRef Reference to loaded accounts
 * @param pendingFetchesRef Reference to pending fetches
 * @param loadedTransactionsRef Reference to loaded transactions
 * @param processedNodesRef Reference to processed nodes
 * @param processedEdgesRef Reference to processed edges
 * @param setLoadingProgress Function to update loading progress
 * @param queueAccountFetch Function to queue an account for fetching
 * @returns Result object with cytoscape instance, address, and new elements
 */
export const addAccountToGraph = async (
  address: string,
  totalAccounts: number,
  depth = 0,
  parentSignature: string | null = null,
  newElements?: Set<string>,
  maxDepth = 3,
  shouldExcludeAddress?: (address: string) => boolean,
  shouldIncludeTransaction?: (accounts: {pubkey: string}[]) => boolean,
  fetchAccountTransactions?: (address: string) => Promise<AccountData | null>,
  cyRef?: React.MutableRefObject<cytoscape.Core | null>,
  loadedAccountsRef?: React.MutableRefObject<Set<string>>,
  pendingFetchesRef?: React.MutableRefObject<Set<string>>,
  loadedTransactionsRef?: React.MutableRefObject<Set<string>>,
  processedNodesRef?: React.MutableRefObject<Set<string>>,
  processedEdgesRef?: React.MutableRefObject<Set<string>>,
  setLoadingProgress?: (cb: (prev: number) => number) => void,
  queueAccountFetch?: (address: string, depth: number, parentSignature: string | null) => void
): Promise<GraphElementAddResult | undefined> => {
  // Stop if we've reached the maximum depth
  if (depth >= maxDepth) return;
  
  // Skip if already loaded
  // Add safety check to ensure loadedAccountsRef.current is defined
  if (loadedAccountsRef?.current?.has(address)) return;
    
  // Skip excluded addresses
  if (shouldExcludeAddress && shouldExcludeAddress(address)) {
    return;
  }
  
  // Fetch transactions for this account
  const data = await fetchAccountTransactions?.(address);
  if (!data) {
    // Use the accountKey format for consistency
    const accountKey = `${address}:${depth}`;
    pendingFetchesRef?.current?.delete(accountKey);
    return;
  }
  
  // Mark account as loaded
  loadedAccountsRef?.current?.add(address);
  pendingFetchesRef?.current?.delete(`${address}:${depth}`);
  
  // Update loading progress
  setLoadingProgress?.((prev) => {
    const progress = Math.min(loadedAccountsRef.current?.size / Math.max(totalAccounts, 1), 1);
    return Math.floor(progress * 100);
  });

  // Get cy instance and verify it exists
  const cy = cyRef?.current;
  if (!cy) {
    console.warn(`Cytoscape instance not available for account ${address}. Skipping graph updates.`);
    // Still mark the account as processed but return early
    loadedAccountsRef?.current?.add(address);
    pendingFetchesRef?.current?.delete(`${address}:${depth}`);
    return;
  }
  
  try {
    // Create a unique ID for the account node
    const nodeId = address;
    
    // Track new elements if set is provided
    if (newElements && !cy.getElementById(nodeId).length) {
      newElements.add(nodeId);
    }
    
    // Add account node if it doesn't exist
    if (!cy.getElementById(nodeId).length && !processedNodesRef?.current?.has(nodeId)) {
      cy.add({
        data: {
          id: nodeId,
          label: shortenString(address),
          type: 'account',
          fullAddress: address,
          status: 'loaded'
        },
        classes: 'account'
      });
      processedNodesRef?.current?.add(nodeId);
    }

    // Add transaction nodes and edges
    const connectedAccounts = new Set<string>();
    for (const tx of data.transactions) {
      // Skip if we've already loaded this transaction
      if (loadedTransactionsRef?.current?.has(tx.signature)) continue;
      
      // Skip transactions involving excluded accounts
      if (shouldIncludeTransaction && !shouldIncludeTransaction(tx.accounts)) {
        continue;
      }

      // Mark transaction as loaded
      loadedTransactionsRef?.current?.add(tx.signature);
      
      const txNodeId = tx.signature;

      // Only add if node doesn't exist
      if (!cy.getElementById(txNodeId).length && !processedNodesRef?.current?.has(txNodeId)) {
        // Track new elements if set is provided
        if (newElements) {
          newElements.add(txNodeId);
        }
        
        cy.add({
          data: {
            id: txNodeId,
            label: shortenString(tx.signature),
            type: 'transaction',
            status: 'loaded',
            timestamp: tx.timestamp,
            formattedTime: formatTimestamp(tx.timestamp),
            success: tx.success,
            fullSignature: tx.signature
          },
          classes: tx.success ? 'transaction success' : 'transaction error'
        });
        processedNodesRef?.current?.add(txNodeId);
      }

      // Create a unique edge ID and check before adding
      const accountToTxEdgeId = `${address}-${tx.signature}`;
      if (!cy.getElementById(accountToTxEdgeId).length && !processedEdgesRef?.current?.has(accountToTxEdgeId)) {
        cy.add({
          data: {
            id: accountToTxEdgeId,
            source: address,
            target: tx.signature,
            type: 'account-tx',
            status: 'loaded'
          }
        });
        processedEdgesRef?.current?.add(accountToTxEdgeId);
        
        // Track new edge elements if set is provided
        if (newElements) {
          newElements.add(accountToTxEdgeId);
        }
      }

      // Process accounts involved in this transaction
      for (const acc of tx.accounts) {
        // Skip self-references
        if (acc.pubkey === address) continue;
        
        // Skip excluded addresses
        if (shouldExcludeAddress && shouldExcludeAddress(acc.pubkey)) 
          continue;

        // Add to connected accounts for later processing
        connectedAccounts.add(acc.pubkey);

        const accNodeId = acc.pubkey;

        // Add account node if it doesn't exist
        if (!cy.getElementById(accNodeId).length && !processedNodesRef?.current?.has(accNodeId)) {
          cy.add({
            data: {
              id: accNodeId,
              label: shortenString(acc.pubkey),
              type: 'account',
              fullAddress: acc.pubkey,
              status: 'pending'
            },
            classes: 'account'
          });
          processedNodesRef?.current?.add(accNodeId);
          
          // Track new account node elements if set is provided
          if (newElements) {
            newElements.add(accNodeId);
          }
        }

        // Add edge from transaction to account
        const txToAccEdgeId = `${tx.signature}-${acc.pubkey}`;
        if (!cy.getElementById(txToAccEdgeId).length && !processedEdgesRef?.current?.has(txToAccEdgeId)) {
          cy.add({
            data: {
              id: txToAccEdgeId,
              source: tx.signature,              
              target: acc.pubkey,              
              type: 'tx-account',
              status: 'loaded'
            }
          });
          processedEdgesRef?.current?.add(txToAccEdgeId);
          
          // Track new edge elements if set is provided
          if (newElements) {
            newElements.add(txToAccEdgeId);
          }
        }
      }

      // Process transfers
      for (const transfer of tx.transfers) {
        const targetAccount = transfer.account;
        
        if (address !== targetAccount) {
          const transferEdgeId = `${tx.signature}-${targetAccount}-transfer`;
          if (!cy.getElementById(transferEdgeId).length && !processedEdgesRef?.current?.has(transferEdgeId)) {
            cy.add({
              data: {
                id: transferEdgeId,
                source: tx.signature,
                target: targetAccount,
                type: 'transfer',
                amount: transfer.change,
                label: formatSolChange(transfer.change),
                status: 'loaded'
              },
              classes: 'transfer'
            });
            processedEdgesRef?.current?.add(transferEdgeId);
            
            // Track new transfer edge elements if set is provided
            if (newElements) {
              newElements.add(transferEdgeId);
            }
          }
        }
      }
    }
    
    // Queue connected accounts for processing if within depth limit
    if (depth < maxDepth - 1) {
      for (const connectedAddress of connectedAccounts) {
        const nextDepth = depth + 1;
        const connectedAccountKey = `${connectedAddress}:${nextDepth}`;
        // Add safety checks to ensure Set objects are defined before calling .has()
        if (!loadedAccountsRef?.current?.has(connectedAddress) && 
            !pendingFetchesRef?.current?.has(connectedAccountKey) && 
            connectedAddress !== address) {
          // Pass the current transaction signature as the parent signature instead of null
          queueAccountFetch?.(connectedAddress, nextDepth, parentSignature);
        }
      }
    }
    
    return { cy, address, newElements };
  } catch (error) {
    console.error(`Error adding account ${address} to graph:`, error);
    // Clean up any partial state
    pendingFetchesRef?.current?.delete(`${address}:${depth}`);
    return;
  }
};

/**
 * Expand the transaction graph
 * This function is now a placeholder - the actual implementation is in EChartsTransactionGraph.tsx
 */
export const expandTransactionGraph = async (
  signature: string,
  chartRef: React.MutableRefObject<echarts.ECharts | null>,
  fetchTransactionData: (signature: string) => Promise<any>,
  queueAccountFetch: (address: string, depth: number, parentSignature: string | null) => void,
  addAccountToGraph: (address: string, totalAccounts: number, depth: number, parentSignature: string | null, newElements?: Set<string>) => Promise<GraphElementAddResult | undefined>,
  setExpandedNodesCount: (cb: (prev: number) => number) => void,
  loadedTransactionsRef: React.MutableRefObject<Set<string>>,
  signal?: AbortSignal
): Promise<boolean> => {
  console.warn('expandTransactionGraph is now implemented in EChartsTransactionGraph.tsx');
  return false;
};