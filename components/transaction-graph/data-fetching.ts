'use client';

import cytoscape from 'cytoscape';
import { AccountData, FetchQueueItem, GraphElementAddResult, Transaction } from './types';
import { formatSolChange, formatTimestamp, shortenString } from './utils';
import { runIncrementalLayout } from './layout';
import { GraphStateCache } from '@/lib/graph-state-cache';

/**
 * Fetch transaction data with caching
 * @param signature Transaction signature
 * @param transactionCache Cache for transaction data
 * @returns Transaction data
 */
export async function fetchTransactionData(
  signature: string,
  transactionCache: Map<string, any>
): Promise<any> {
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
 * Fetch account transactions with SPL transfer filtering and guaranteed fallback
 * @param address Account address
 * @param signal Optional abort signal
 * @returns Account data with guaranteed non-null result
 */
export async function fetchAccountTransactions(
  address: string,
  signal?: AbortSignal
): Promise<AccountData | null> {
  console.log(`Starting fetch for account: ${address}`);
  
  try {
    // Circuit breaker for problematic accounts - still return empty data
    if (address === 'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa' || 
        address === 'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt' ||
        address === 'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs') {
      console.log(`Circuit breaker: Skipping problematic account ${address}`);
      return { address, transactions: [] };
    }

    // First try to get SPL transfers (top 10 by volume)
    console.log(`🔍 [FETCH] Trying SPL transfers for ${address}`);
    try {
      const transfersResponse = await fetch(`/api/account-transfers/${address}?limit=10`, {
        signal,
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (transfersResponse.ok) {
        const transfersData = await transfersResponse.json();
        const transfers = transfersData.data || [];
        
        if (transfers.length > 0) {
          // Convert transfers to transaction format
          const transactions = transfers.map((transfer: any) => ({
            signature: transfer.txId,
            timestamp: new Date(transfer.date).getTime(),
            slot: 0,
            err: null,
            success: true,
            type: 'spl-transfer',
            accounts: [
              { pubkey: transfer.from, isSigner: false, isWritable: true },
              { pubkey: transfer.to, isSigner: false, isWritable: true }
            ],
            transfers: [{
              account: transfer.to,
              change: parseFloat(transfer.tokenAmount) * 1e9 // Convert to lamports
            }],
            memo: null
          }));
          
          console.log(`✅ [FETCH] Found ${transactions.length} SPL transfers for ${address}`);
          return { address, transactions };
        } else {
          console.log(`⚠️ [FETCH] No SPL transfers found for ${address}, will try regular transactions`);
        }
      } else {
        console.warn(`⚠️ [FETCH] SPL transfers API failed for ${address}: ${transfersResponse.status}`);
      }
    } catch (transferError) {
      console.warn(`❌ [FETCH] SPL transfers fetch failed for ${address}:`, transferError);
    }

    // Fallback: Get regular transactions with more inclusive filtering
    console.log(`🔄 [FETCH] Falling back to regular transactions for ${address} (more inclusive)`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased timeout for better data fetching
      
      // Use existing signal if provided, otherwise use our controller
      const fetchSignal = signal || controller.signal;
      
      // Still limit but be more inclusive - allow up to 5 transactions
      const response = await fetch(`/api/account-transactions/${address}?limit=5`, {
        signal: fetchSignal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 400) {
          console.warn(`⚠️ [FETCH] Bad request for account ${address}, returning empty transactions`);
          return { address, transactions: [] };
        }
        throw new Error(`Error fetching transactions: ${response.statusText} (${response.status})`);
      }
      
      const data = await response.json();
      const transactions = data.transactions || [];
      const transactionCount = transactions.length;
      console.log(`📊 [FETCH] Fallback: Found ${transactionCount} regular transactions for ${address}`);
      
      // Process and enrich transaction data to be more inclusive
      const enrichedTransactions = transactions.map((tx: any) => {
        // Determine transaction type from available data
        let txType = 'system';
        if (tx.details?.instructions) {
          const firstInstruction = tx.details.instructions[0];
          if (firstInstruction?.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
            txType = 'spl-token';
          } else if (firstInstruction?.programId === '11111111111111111111111111111111') {
            txType = 'system';
          } else {
            txType = 'other';
          }
        }
        
        return {
          ...tx,
          type: txType,
          success: tx.success !== false && !tx.err, // Default to success if not explicitly failed
          accounts: tx.accounts || [],
          transfers: tx.transfers || []
        };
      });
      
      // More inclusive filtering - only exclude transactions that are clearly problematic
      const filteredTransactions = enrichedTransactions.filter((tx: any) => {
        // Include all transactions that have accounts, even if they're system transactions
        const hasAccounts = tx.accounts && tx.accounts.length > 0;
        const hasReasonableAccountCount = tx.accounts && tx.accounts.length <= 20; // Increased from 5 to 20
        
        if (!hasAccounts) {
          console.log(`🚫 [FETCH] Filtering out transaction ${tx.signature}: no accounts`);
          return false;
        }
        
        if (!hasReasonableAccountCount) {
          console.log(`🚫 [FETCH] Filtering out transaction ${tx.signature}: too many accounts (${tx.accounts.length})`);
          return false;
        }
        
        console.log(`✅ [FETCH] Including transaction ${tx.signature}: type=${tx.type}, accounts=${tx.accounts.length}, success=${tx.success}`);
        return true;
      });
      
      console.log(`✅ [FETCH] After filtering: ${filteredTransactions.length} transactions (reduced from ${transactionCount})`);
      
      // Always return valid data structure, even if empty
      return {
        address,
        transactions: filteredTransactions
      };
      
    } catch (fallbackError) {
      console.warn(`❌ [FETCH] Regular transactions fallback failed for ${address}:`, fallbackError);
    }
    
    // Final fallback: Return empty transactions but still mark account as processed
    console.log(`❌ [FETCH] All fetches failed for ${address}, returning empty transactions`);
    return { address, transactions: [] };
    
  } catch (err) {
    console.error(`💥 [FETCH] Critical error fetching transactions for ${address}:`, err);
    // Always return a valid structure, never null
    return { address, transactions: [] };
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
  console.log(`📝 [QUEUE_UTIL] Queuing account: ${address}, depth: ${depth}, key: ${accountKey}`);
  
  // Validate address to prevent null/empty values
  if (!address || typeof address !== 'string') {
    console.warn('⚠️ [QUEUE_UTIL] Attempted to queue invalid address:', address);
    return;
  }
  
  // Skip if we've already loaded this account
  // Check if we've already loaded or queued this account at this depth or lower
  if (loadedAccountsRef.current?.has(address)) {
    console.log(`⏭️ [QUEUE_UTIL] Skipping ${address}: already loaded`);
    return;
  }

  if (pendingFetchesRef.current?.has(accountKey)) {
    console.log(`⏭️ [QUEUE_UTIL] Skipping ${address}: already pending`);
    return;
  }
  
  // Enforce maximum queue size to prevent unbounded growth
  const MAX_QUEUE_SIZE = 50; // Heavily reduced from 250 to prevent graph explosion
  if (fetchQueueRef.current.length >= MAX_QUEUE_SIZE) {
    console.warn(`⚠️ [QUEUE_UTIL] Queue size limit reached (${MAX_QUEUE_SIZE}), skipping ${address}`);
    return;
  }
  
  // Mark as pending before adding to queue
  pendingFetchesRef.current.add(accountKey);
  console.log(`📌 [QUEUE_UTIL] Marked ${accountKey} as pending`);
  
  // Add to queue
  fetchQueueRef.current.push({ address, depth, parentSignature });
  console.log(`📝 [QUEUE_UTIL] Added to queue: ${address}. Queue length: ${fetchQueueRef.current.length}`);
  
  // Update total accounts count for progress tracking
  setTotalAccounts(prev => {
    const newTotal = prev + 1;
    console.log(`📊 [QUEUE_UTIL] Updated total accounts: ${prev} -> ${newTotal}`);
    return newTotal;
  });
  
  // Process queue if not already processing
  if (!isProcessingQueueRef || !isProcessingQueueRef.current) {
    console.log(`🚀 [QUEUE_UTIL] Starting queue processing for ${address}`);
    processAccountFetchQueue();
  } else {
    console.log(`⏳ [QUEUE_UTIL] Queue already processing, ${address} will be processed next`);
  }
};

/**
 * Process the fetch queue in parallel
 * @param fetchQueueRef Reference to fetch queue
 * @param fetchAndProcessAccount Function to fetch and process an account
 * @param isProcessingQueueRef Reference to track if queue is being processed (optional)
 * @returns Promise that resolves when processing is complete
 */
export async function processAccountFetchQueue(
  fetchQueueRef: React.MutableRefObject<FetchQueueItem[]>,
  fetchAndProcessAccount: (address: string, depth: number, parentSignature: string | null) => Promise<void>,
  isProcessingQueueRef?: React.MutableRefObject<boolean>
): Promise<void> { 
  // Early return if queue is empty or already processing
  if (fetchQueueRef.current.length === 0) {
    console.log(`📭 [PROCESS_QUEUE] Queue is empty, nothing to process`);
    return;
  }
  
  if (isProcessingQueueRef && isProcessingQueueRef.current) {
    console.log(`⏳ [PROCESS_QUEUE] Already processing queue, skipping`);
    return;
  }
  
  console.log(`🚀 [PROCESS_QUEUE] Starting to process queue with ${fetchQueueRef.current.length} items`);
  
  try {
    // Set processing flag to true if it exists
    if (isProcessingQueueRef) {
      isProcessingQueueRef.current = true;
      console.log(`🔒 [PROCESS_QUEUE] Set processing flag to true`);
    }
    
    // Use iterative approach instead of recursion to avoid stack overflow
    while (fetchQueueRef.current.length > 0) {
      // Process batches of 10 accounts in parallel
      const batch = fetchQueueRef.current.splice(0, 10);
      console.log(`📦 [PROCESS_QUEUE] Processing batch of ${batch.length} accounts`);
      
      // Fetch all accounts in parallel with timeout protection
      const results = await Promise.allSettled(
        batch.map(item => {
          console.log(`🔄 [PROCESS_QUEUE] Processing account: ${item.address}`);
          // Add timeout protection for each fetch operation
          const fetchPromise = fetchAndProcessAccount(item.address, item.depth, item.parentSignature);
          const timeoutPromise = new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error(`Fetch timeout for ${item.address}`)), 30000)
          );
          
          return Promise.race([fetchPromise, timeoutPromise])
            .then(() => {
              console.log(`✅ [PROCESS_QUEUE] Successfully processed account: ${item.address}`);
            })
            .catch(err => {
              console.error(`❌ [PROCESS_QUEUE] Error processing account ${item.address}:`, err);
            });
        })
      );
      
      console.log(`📊 [PROCESS_QUEUE] Batch completed. Results: ${results.map(r => r.status).join(', ')}`);
      
      // Add small delay between batches to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`🎉 [PROCESS_QUEUE] Queue processing completed`);
  } catch (error) {
    console.error('❌ [PROCESS_QUEUE] Error processing fetch queue:', error);
  } finally {
    // Always reset processing flag when done
    if (isProcessingQueueRef) {
      isProcessingQueueRef.current = false;
      console.log(`🔓 [PROCESS_QUEUE] Reset processing flag to false`);
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
export async function addAccountToGraph(
  address: string,
  totalAccounts: number,
  depth = 0,
  parentSignature: string | null = null,
  newElements?: Set<string>,
  maxDepth = 3,
  shouldExcludeAddress?: (address: string) => boolean,
  shouldIncludeTransaction?: (accounts: {pubkey: string}[]) => boolean,
  fetchAccountTransactions?: (address: string, signal?: AbortSignal) => Promise<AccountData | null>,
  cyRef?: React.MutableRefObject<cytoscape.Core | null>,
  loadedAccountsRef?: React.MutableRefObject<Set<string>>,
  pendingFetchesRef?: React.MutableRefObject<Set<string>>,
  loadedTransactionsRef?: React.MutableRefObject<Set<string>>,
  processedNodesRef?: React.MutableRefObject<Set<string>>,
  processedEdgesRef?: React.MutableRefObject<Set<string>>,
  setLoadingProgress?: (cb: (prev: number) => number) => void,
  queueAccountFetch?: (address: string, depth: number, parentSignature: string | null) => void
): Promise<GraphElementAddResult | undefined> {
  console.log(`🏗️ [GRAPH_BUILD] Starting addAccountToGraph for ${address}, depth: ${depth}, maxDepth: ${maxDepth}`);
  
  // Stop if we've reached the maximum depth
  if (depth >= maxDepth) {
    console.log(`🛑 [GRAPH_BUILD] Reached max depth ${maxDepth} for ${address}, stopping`);
    return;
  }
  
  // Skip if already loaded
  // Add safety check to ensure loadedAccountsRef.current is defined
  if (loadedAccountsRef?.current?.has(address)) {
    console.log(`⏭️ [GRAPH_BUILD] Account ${address} already loaded, skipping`);
    return;
  }
    
  // Skip excluded addresses
  if (shouldExcludeAddress && shouldExcludeAddress(address)) {
    console.log(`🚫 [GRAPH_BUILD] Address ${address} is excluded, skipping`);
    return;
  }
  
  // Fetch transactions for this account
  console.log(`📡 [GRAPH_BUILD] Fetching transactions for ${address}...`);
  const data = await fetchAccountTransactions?.(address);
  
  // Always mark account as processed and update progress, even if no data
  loadedAccountsRef?.current?.add(address);
  pendingFetchesRef?.current?.delete(`${address}:${depth}`);
  
  // Update loading progress - ensure progress moves forward even with empty results
  setLoadingProgress?.((prev) => {
    const loadedCount = loadedAccountsRef?.current?.size || 0;
    const total = Math.max(totalAccounts, 1);
    const progress = Math.min(loadedCount / total, 1);
    const newProgress = Math.floor(progress * 100);
    console.log(`📈 [PROGRESS_UTIL] Progress update: ${loadedCount}/${total} accounts (${newProgress}%)`);
    return newProgress;
  });
  
  if (!data || !data.transactions || data.transactions.length === 0) {
    console.log(`⚠️ [GRAPH_BUILD] No transactions found for account ${address}, adding minimal node`);
    
    // Get cy instance and add minimal account node even with no transactions
    const cyInstance = cyRef?.current;
    if (cyInstance) {
      const nodeId = address;
      if (!cy.getElementById(nodeId).length && !processedNodesRef?.current?.has(nodeId)) {
        console.log(`➕ [GRAPH_BUILD] Adding minimal account node for ${address} (no transactions)`);
        cyInstance.add({
          data: {
            id: nodeId,
            label: shortenString(address),
            type: 'account',
            fullAddress: address,
            status: 'empty',
            transactionCount: 0,
            isEmpty: true
          },
          classes: 'account empty'
        });
        processedNodesRef?.current?.add(nodeId);
        
        // Track new elements if set is provided
        if (newElements) {
          newElements.add(nodeId);
        }
      }
    }
    
    return { cy: cyRef?.current, address, newElements: new Set() };
  }

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
    
    // Always add account node if it doesn't exist, even if no transactions
    if (!cy.getElementById(nodeId).length && !processedNodesRef?.current?.has(nodeId)) {
      cy.add({
        data: {
          id: nodeId,
          label: shortenString(address),
          type: 'account',
          fullAddress: address,
          status: 'loaded',
          transactionCount: data?.transactions?.length || 0
        },
        classes: 'account'
      });
      processedNodesRef?.current?.add(nodeId);
      console.log(`Added account node: ${address} with ${data?.transactions?.length || 0} transactions`);
    }

    // If no transactions, return early but still show the account node
    if (!data?.transactions || data.transactions.length === 0) {
      console.log(`Account ${address} has no transactions but node was added to graph`);
      return { cy, address, newElements };
    }

    console.log(`📊 [GRAPH_BUILD] Processing ${data.transactions.length} transactions for ${address}`);

    // Add transaction nodes and edges
    const connectedAccounts = new Set<string>();
    let processedTransactionCount = 0;
    let skippedTransactionCount = 0;
    
    for (const tx of data.transactions) {
      console.log(`🔍 [TX_PROCESS] Processing transaction ${tx.signature} for ${address}`);
      console.log(`🔍 [TX_PROCESS] Transaction data:`, {
        signature: tx.signature,
        success: tx.success,
        err: tx.err,
        type: tx.type,
        accountsCount: tx.accounts?.length || 0,
        transfersCount: tx.transfers?.length || 0,
        timestamp: tx.timestamp
      });
      
      // Skip if we've already loaded this transaction
      if (loadedTransactionsRef?.current?.has(tx.signature)) {
        console.log(`⏭️ [TX_PROCESS] Transaction ${tx.signature} already loaded, skipping`);
        skippedTransactionCount++;
        continue;
      }
      
      // More inclusive transaction filtering - log what's being filtered and why
      let shouldIncludeTx = true;
      let filterReason = '';
      
      // Check transaction filter only if we have accounts to check
      if (shouldIncludeTransaction && tx.accounts && Array.isArray(tx.accounts)) {
        if (!shouldIncludeTransaction(tx.accounts)) {
          shouldIncludeTx = false;
          filterReason = 'Failed shouldIncludeTransaction filter';
          console.log(`🚫 [TX_FILTER] Transaction ${tx.signature} accounts:`, tx.accounts.map(acc => acc.pubkey));
        }
      } else if (!tx.accounts || !Array.isArray(tx.accounts)) {
        // If no accounts array, still include the transaction (system transactions might not have accounts)
        console.log(`⚠️ [TX_PROCESS] Transaction ${tx.signature} has no accounts array, but including anyway`);
      }
      
      if (!shouldIncludeTx) {
        console.log(`🚫 [TX_PROCESS] Excluding transaction ${tx.signature}: ${filterReason}`);
        console.log(`🚫 [TX_PROCESS] Transaction details: accounts=${tx.accounts?.length || 0}, type=${tx.type || 'unknown'}`);
        skippedTransactionCount++;
        continue;
      }

      console.log(`✅ [TX_PROCESS] Including transaction ${tx.signature} in graph`);
      processedTransactionCount++;

      // Mark transaction as loaded
      loadedTransactionsRef?.current?.add(tx.signature);
      
      const txNodeId = tx.signature;

      // Only add if node doesn't exist
      if (!cy.getElementById(txNodeId).length && !processedNodesRef?.current?.has(txNodeId)) {
        // Track new elements if set is provided
        if (newElements) {
          newElements.add(txNodeId);
        }
        
        // Determine transaction type and status for better visualization
        const txType = tx.type || 'unknown';
        const txSuccess = tx.success !== false && !tx.err; // More inclusive success check
        const txClasses = txSuccess ? 'transaction success' : 'transaction error';
        
        console.log(`➕ [TX_PROCESS] Adding transaction node: ${tx.signature}, type: ${txType}, success: ${txSuccess}`);
        
        cy.add({
          data: {
            id: txNodeId,
            label: shortenString(tx.signature),
            type: 'transaction',
            subType: txType,
            status: 'loaded',
            timestamp: tx.timestamp,
            formattedTime: formatTimestamp(tx.timestamp),
            success: txSuccess,
            fullSignature: tx.signature,
            accountCount: tx.accounts?.length || 0,
            hasTransfers: (tx.transfers && tx.transfers.length > 0) || false
          },
          classes: txClasses
        });
        processedNodesRef?.current?.add(txNodeId);
        console.log(`✅ [TX_PROCESS] Added transaction node: ${tx.signature}`);
      } else {
        console.log(`⏭️ [TX_PROCESS] Transaction node ${tx.signature} already exists, skipping`);
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
      console.log(`👥 [TX_PROCESS] Processing ${tx.accounts?.length || 0} accounts for transaction ${tx.signature}`);
      
      for (const acc of tx.accounts || []) {
        console.log(`🔍 [ACCOUNT_PROCESS] Processing account ${acc.pubkey} in transaction ${tx.signature}`);
        
        // Skip self-references
        if (acc.pubkey === address) {
          console.log(`⏭️ [ACCOUNT_PROCESS] Skipping self-reference: ${acc.pubkey}`);
          continue;
        }
        
        // Skip excluded addresses
        if (shouldExcludeAddress && shouldExcludeAddress(acc.pubkey)) {
          console.log(`🚫 [ACCOUNT_PROCESS] Skipping excluded address: ${acc.pubkey}`);
          continue;
        }

        console.log(`✅ [ACCOUNT_PROCESS] Including account ${acc.pubkey} in graph`);
        
        // Add to connected accounts for later processing
        connectedAccounts.add(acc.pubkey);

        const accNodeId = acc.pubkey;

        // Add account node if it doesn't exist
        if (!cy.getElementById(accNodeId).length && !processedNodesRef?.current?.has(accNodeId)) {
          console.log(`➕ [ACCOUNT_PROCESS] Adding account node: ${acc.pubkey}`);
          cy.add({
            data: {
              id: accNodeId,
              label: shortenString(acc.pubkey),
              type: 'account',
              fullAddress: acc.pubkey,
              status: 'pending',
              isSigner: acc.isSigner || false,
              isWritable: acc.isWritable || false
            },
            classes: 'account'
          });
          processedNodesRef?.current?.add(accNodeId);
          
          // Track new account node elements if set is provided
          if (newElements) {
            newElements.add(accNodeId);
          }
          console.log(`✅ [ACCOUNT_PROCESS] Added account node: ${acc.pubkey}`);
        } else {
          console.log(`⏭️ [ACCOUNT_PROCESS] Account node ${acc.pubkey} already exists`);
        }

        // Add edge from transaction to account
        const txToAccEdgeId = `${tx.signature}-${acc.pubkey}`;
        if (!cy.getElementById(txToAccEdgeId).length && !processedEdgesRef?.current?.has(txToAccEdgeId)) {
          console.log(`➕ [EDGE_PROCESS] Adding tx-to-account edge: ${tx.signature} -> ${acc.pubkey}`);
          cy.add({
            data: {
              id: txToAccEdgeId,
              source: tx.signature,              
              target: acc.pubkey,              
              type: 'tx-account',
              status: 'loaded',
              role: acc.isSigner ? 'signer' : (acc.isWritable ? 'writable' : 'readonly')
            }
          });
          processedEdgesRef?.current?.add(txToAccEdgeId);
          
          // Track new edge elements if set is provided
          if (newElements) {
            newElements.add(txToAccEdgeId);
          }
          console.log(`✅ [EDGE_PROCESS] Added tx-to-account edge: ${tx.signature} -> ${acc.pubkey}`);
        } else {
          console.log(`⏭️ [EDGE_PROCESS] Edge ${txToAccEdgeId} already exists`);
        }
      }

      // Process transfers - enhanced to handle plain SOL transfers better
      console.log(`💰 [TRANSFER_PROCESS] Processing ${tx.transfers?.length || 0} transfers for transaction ${tx.signature}`);
      
      for (const transfer of tx.transfers || []) {
        const targetAccount = transfer.account;
        console.log(`🔍 [TRANSFER_PROCESS] Processing transfer to ${targetAccount}, amount: ${transfer.change}`);
        
        // Enhanced transfer processing: handle both regular transfers and self-transfers
        const isSelfTransfer = address === targetAccount;
        const isNegativeChange = transfer.change < 0;
        
        // For self-transfers, check if they should be excluded (likely program/system accounts)
        if (isSelfTransfer) {
          // Only exclude self-transfers if they're to program accounts
          if (shouldExcludeAddress(targetAccount)) {
            console.log(`⏭️ [TRANSFER_PROCESS] Skipping self-transfer to excluded program account: ${targetAccount}`);
            continue;
          }
          
          // Include self-transfers as they represent valid operations (fees, etc.)
          console.log(`✅ [TRANSFER_PROCESS] Including self-transfer for ${targetAccount} (likely fee/operation)`);
          
          // Create a self-transfer edge to visualize the operation
          const selfTransferEdgeId = `${tx.signature}-${targetAccount}-self-transfer`;
          if (!cy.getElementById(selfTransferEdgeId).length && !processedEdgesRef?.current?.has(selfTransferEdgeId)) {
            console.log(`➕ [TRANSFER_PROCESS] Adding self-transfer edge: ${tx.signature} <-> ${targetAccount}, amount: ${transfer.change}`);
            cy.add({
              data: {
                id: selfTransferEdgeId,
                source: tx.signature,
                target: targetAccount,
                type: 'self-transfer',
                amount: transfer.change,
                label: `${isNegativeChange ? 'Fee' : 'Credit'}: ${formatSolChange(transfer.change)}`,
                status: 'loaded'
              },
              classes: 'transfer self-transfer'
            });
            processedEdgesRef?.current?.add(selfTransferEdgeId);
            
            // Track new transfer edge elements if set is provided
            if (newElements) {
              newElements.add(selfTransferEdgeId);
            }
            console.log(`✅ [TRANSFER_PROCESS] Added self-transfer edge: ${tx.signature} <-> ${targetAccount}`);
          } else {
            console.log(`⏭️ [TRANSFER_PROCESS] Self-transfer edge ${selfTransferEdgeId} already exists`);
          }
        } else {
          // Regular transfer to different account
          // Apply filtering for SOL transfers: exclude transfers to program accounts
          if (shouldExcludeAddress(targetAccount)) {
            console.log(`⏭️ [TRANSFER_PROCESS] Skipping transfer to excluded program account: ${targetAccount}`);
            continue;
          }
          
          console.log(`✅ [TRANSFER_PROCESS] Including SOL transfer to user account: ${targetAccount}`);
          
          // Ensure target account node exists (especially important for plain SOL transfers)
          const targetNodeId = targetAccount;
          if (!cy.getElementById(targetNodeId).length && !processedNodesRef?.current?.has(targetNodeId)) {
            console.log(`➕ [TRANSFER_PROCESS] Adding missing target account node: ${targetAccount}`);
            cy.add({
              data: {
                id: targetNodeId,
                label: shortenString(targetAccount),
                type: 'account',
                fullAddress: targetAccount,
                status: 'pending',
                fromTransfer: true // Mark as coming from transfer processing
              },
              classes: 'account transfer-target'
            });
            processedNodesRef?.current?.add(targetNodeId);
            
            // Track new account node elements if set is provided
            if (newElements) {
              newElements.add(targetNodeId);
            }
            console.log(`✅ [TRANSFER_PROCESS] Added transfer target account node: ${targetAccount}`);
          }
          
          const transferEdgeId = `${tx.signature}-${targetAccount}-transfer`;
          if (!cy.getElementById(transferEdgeId).length && !processedEdgesRef?.current?.has(transferEdgeId)) {
            console.log(`➕ [TRANSFER_PROCESS] Adding transfer edge: ${tx.signature} -> ${targetAccount}, amount: ${transfer.change}`);
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
            console.log(`✅ [TRANSFER_PROCESS] Added transfer edge: ${tx.signature} -> ${targetAccount}`);
          } else {
            console.log(`⏭️ [TRANSFER_PROCESS] Transfer edge ${transferEdgeId} already exists`);
          }
        }
      }
    }
    
    // Enhanced processing summary with comprehensive filtering analysis
    console.log(`📊 [GRAPH_BUILD] Transaction processing summary for ${address}:`);
    console.log(`  - Total transactions: ${data.transactions.length}`);
    console.log(`  - Processed: ${processedTransactionCount}`);
    console.log(`  - Skipped: ${skippedTransactionCount}`);
    console.log(`  - Connected accounts: ${connectedAccounts.size}`);
    console.log(`  - Graph nodes added: ${newElements ? newElements.size : 'unknown'}`);

    // Analyze skipped transactions to provide detailed filtering explanation
    const skippedReasons: Record<string, number> = {};
    for (const tx of data.transactions) {
      if (!shouldIncludeTransaction || shouldIncludeTransaction(tx)) {
        continue; // This transaction was processed
      }
      
      // Analyze why this transaction was skipped
      if (!tx.success && tx.err) {
        skippedReasons['Failed transactions'] = (skippedReasons['Failed transactions'] || 0) + 1;
      } else if (!tx.transfers || tx.transfers.length === 0) {
        skippedReasons['No transfers'] = (skippedReasons['No transfers'] || 0) + 1;
      } else {
        skippedReasons['Other filters'] = (skippedReasons['Other filters'] || 0) + 1;
      }
    }
    
    if (Object.keys(skippedReasons).length > 0) {
      console.log(`🚫 [GRAPH_BUILD] Transactions skipped by category:`, skippedReasons);
    }

    // Enhanced console summary for easy debugging
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                      🔍 GRAPH DEBUG SUMMARY                      ║
╠══════════════════════════════════════════════════════════════════╣
║ Account: ${address.slice(0, 16)}...                              ║
║ Total Transactions: ${data.transactions.length.toString().padStart(3)}                                  ║
║ Processed: ${processedTransactionCount.toString().padStart(3)}  |  Skipped: ${skippedTransactionCount.toString().padStart(3)}                      ║
║ Connected Accounts: ${connectedAccounts.size.toString().padStart(3)}                                  ║
║ Graph Elements Added: ${newElements ? newElements.size.toString().padStart(3) : 'unk'}                            ║
╚══════════════════════════════════════════════════════════════════╝`);
    
    // Count and log nodes/edges generated for debugging empty graphs
    if (cy) {
      const allNodes = cy.nodes();
      const allEdges = cy.edges();
      const transactionNodes = allNodes.filter(node => node.data('type') === 'transaction');
      const accountNodes = allNodes.filter(node => node.data('type') === 'account');
      const transferEdges = allEdges.filter(edge => edge.data('type') === 'transfer');
      const selfTransferEdges = allEdges.filter(edge => edge.data('type') === 'self-transfer');
      const txAccountEdges = allEdges.filter(edge => edge.data('type') === 'tx-account');
      const accountTxEdges = allEdges.filter(edge => edge.data('type') === 'account-tx');
      
      console.log(`📊 [GRAPH_BUILD] Current graph statistics after processing ${address}:`);
      console.log(`  📈 Nodes: ${allNodes.length} total (${accountNodes.length} accounts, ${transactionNodes.length} transactions)`);
      console.log(`  🔗 Edges: ${allEdges.length} total (${transferEdges.length} transfers, ${selfTransferEdges.length} self-transfers, ${txAccountEdges.length} tx→account, ${accountTxEdges.length} account→tx)`);
      
      // Enhanced console visualization summary
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    📊 VISUALIZATION SUMMARY                     ║
╠══════════════════════════════════════════════════════════════════╣
║ Nodes Total: ${allNodes.length.toString().padStart(3)} | Accounts: ${accountNodes.length.toString().padStart(3)} | Transactions: ${transactionNodes.length.toString().padStart(3)}    ║
║ Edges Total: ${allEdges.length.toString().padStart(3)} | Transfers: ${transferEdges.length.toString().padStart(2)} | Self: ${selfTransferEdges.length.toString().padStart(2)} | Relations: ${(txAccountEdges.length + accountTxEdges.length).toString().padStart(2)} ║
║                                                                  ║
║ ${allNodes.length === 0 ? '🚨 EMPTY GRAPH - NO VISUALIZATION POSSIBLE' : 
   allNodes.length === 1 && allEdges.length === 0 ? '⚠️  ISOLATED NODE - LIMITED VISUALIZATION' :
   allEdges.length === 0 ? '⚠️  DISCONNECTED GRAPH - NO RELATIONSHIPS' :
   '✅ GRAPH READY FOR VISUALIZATION'}${' '.repeat(Math.max(0, 43 - (allNodes.length === 0 ? 'EMPTY GRAPH - NO VISUALIZATION POSSIBLE'.length : 
   allNodes.length === 1 && allEdges.length === 0 ? 'ISOLATED NODE - LIMITED VISUALIZATION'.length :
   allEdges.length === 0 ? 'DISCONNECTED GRAPH - NO RELATIONSHIPS'.length :
   'GRAPH READY FOR VISUALIZATION'.length)))} ║
╚══════════════════════════════════════════════════════════════════╝`);
      
      // Special fallback check for transactions with transfers but no transfer edges
      const totalTransferEdges = transferEdges.length + selfTransferEdges.length;
      if (processedTransactionCount > 0 && totalTransferEdges === 0) {
        console.log(`⚠️ [GRAPH_BUILD] FALLBACK WARNING: Processed ${processedTransactionCount} transactions but no transfer edges created`);
        console.log(`⚠️ [GRAPH_BUILD] This may indicate SOL transfers are being filtered out`);
        
        // Log transfer data for debugging
        for (const tx of data.transactions.slice(0, 3)) { // Only log first 3 for brevity
          if (tx.transfers && tx.transfers.length > 0) {
            console.log(`🔍 [GRAPH_BUILD] Transaction ${tx.signature} has ${tx.transfers.length} transfers:`, 
              tx.transfers.map(t => ({ account: t.account, change: t.change })));
          }
        }
      } else if (totalTransferEdges > 0) {
        console.log(`✅ [GRAPH_BUILD] Successfully created ${totalTransferEdges} transfer-related edges (${transferEdges.length} regular + ${selfTransferEdges.length} self-transfers)`);
      }
      
      // GUARANTEED VISUALIZATION: Always create at least one meaningful visualization element
      if (allNodes.length === 0 || (allNodes.length === 1 && allEdges.length === 0)) {
        console.log(`🚨 [GRAPH_BUILD] CRITICAL: Graph is empty or has isolated nodes - implementing guaranteed fallback visualization`);
        
        // Strategy 1: Find ANY transaction with transfers (even if previously filtered)
        let txWithTransfers = data.transactions.find(tx => tx.transfers && tx.transfers.length > 0);
        
        // Strategy 2: If no transfers, find the most recent successful transaction
        if (!txWithTransfers) {
          txWithTransfers = data.transactions.find(tx => tx.success !== false);
        }
        
        // Strategy 3: Take the first transaction regardless of status
        if (!txWithTransfers && data.transactions.length > 0) {
          txWithTransfers = data.transactions[0];
        }
        
        if (txWithTransfers) {
          console.log(`🔧 [GRAPH_BUILD] Creating guaranteed visualization for transaction ${txWithTransfers.signature}`);
          
          // Always create the transaction node
          const txNodeId = txWithTransfers.signature;
          if (!cy.getElementById(txNodeId).length) {
            cy.add({
              data: {
                id: txNodeId,
                label: `TX: ${shortenString(txWithTransfers.signature)}`,
                type: 'transaction',
                subType: txWithTransfers.transfers?.length > 0 ? 'transfer' : 'other',
                status: txWithTransfers.success === false ? 'failed' : 'loaded',
                timestamp: txWithTransfers.timestamp,
                success: txWithTransfers.success,
                fallbackCreated: true,
                reason: 'guaranteed_visualization'
              },
              classes: 'transaction fallback guaranteed'
            });
            processedNodesRef?.current?.add(txNodeId);
            console.log(`🔧 [GRAPH_BUILD] Created guaranteed transaction node: ${txNodeId}`);
          }
          
          // Create account node for the primary address
          const primaryAccNodeId = address;
          if (!cy.getElementById(primaryAccNodeId).length) {
            cy.add({
              data: {
                id: primaryAccNodeId,
                label: `Account: ${shortenString(address)}`,
                type: 'account',
                fullAddress: address,
                status: 'primary',
                fallbackCreated: true,
                reason: 'guaranteed_visualization'
              },
              classes: 'account primary fallback guaranteed'
            });
            processedNodesRef?.current?.add(primaryAccNodeId);
            console.log(`🔧 [GRAPH_BUILD] Created guaranteed primary account node: ${primaryAccNodeId}`);
          }
          
          // Create edge between transaction and primary account
          const primaryEdgeId = `${txNodeId}-${primaryAccNodeId}-guaranteed`;
          if (!cy.getElementById(primaryEdgeId).length) {
            cy.add({
              data: {
                id: primaryEdgeId,
                source: txNodeId,
                target: primaryAccNodeId,
                type: 'tx-account',
                label: 'Transaction participant',
                fallbackCreated: true,
                reason: 'guaranteed_visualization'
              },
              classes: 'interaction fallback guaranteed'
            });
            processedEdgesRef?.current?.add(primaryEdgeId);
            console.log(`🔧 [GRAPH_BUILD] Created guaranteed edge: ${txNodeId} -> ${primaryAccNodeId}`);
          }
          
          // If transaction has transfers, create transfer visualization
          if (txWithTransfers.transfers && txWithTransfers.transfers.length > 0) {
            for (const transfer of txWithTransfers.transfers.slice(0, 3)) { // Limit to first 3 transfers
              const targetAccount = transfer.account;
              
              // Create target account node if different from primary
              if (targetAccount !== address) {
                const accNodeId = targetAccount;
                if (!cy.getElementById(accNodeId).length) {
                  cy.add({
                    data: {
                      id: accNodeId,
                      label: `${transfer.change > 0 ? '📈' : '📉'} ${shortenString(targetAccount)}`,
                      type: 'account',
                      fullAddress: targetAccount,
                      status: 'transfer_target',
                      transferAmount: transfer.change,
                      fallbackCreated: true,
                      reason: 'guaranteed_visualization'
                    },
                    classes: 'account transfer-target fallback guaranteed'
                  });
                  processedNodesRef?.current?.add(accNodeId);
                  console.log(`🔧 [GRAPH_BUILD] Created guaranteed transfer target: ${accNodeId} (${formatSolChange(transfer.change)})`);
                }
                
                // Create transfer edge
                const transferEdgeId = `${txNodeId}-${targetAccount}-guaranteed-transfer`;
                if (!cy.getElementById(transferEdgeId).length) {
                  cy.add({
                    data: {
                      id: transferEdgeId,
                      source: txNodeId,
                      target: targetAccount,
                      type: 'transfer',
                      amount: transfer.change,
                      label: formatSolChange(transfer.change),
                      status: 'guaranteed',
                      fallbackCreated: true,
                      reason: 'guaranteed_visualization'
                    },
                    classes: 'transfer guaranteed fallback'
                  });
                  processedEdgesRef?.current?.add(transferEdgeId);
                  console.log(`🔧 [GRAPH_BUILD] Created guaranteed transfer: ${txNodeId} -> ${targetAccount} (${formatSolChange(transfer.change)})`);
                }
              }
            }
          }
          
          console.log(`✅ [GRAPH_BUILD] Guaranteed visualization complete - graph now has ${cy.nodes().length} nodes and ${cy.edges().length} edges`);
        } else {
          console.log(`🚨 [GRAPH_BUILD] CRITICAL: No transactions available for guaranteed visualization`);
          
          // Last resort: Create a placeholder node
          const placeholderNodeId = `placeholder-${address}`;
          if (!cy.getElementById(placeholderNodeId).length) {
            cy.add({
              data: {
                id: placeholderNodeId,
                label: `No data: ${shortenString(address)}`,
                type: 'account',
                fullAddress: address,
                status: 'no_data',
                fallbackCreated: true,
                reason: 'no_transactions_found'
              },
              classes: 'account placeholder fallback'
            });
            processedNodesRef?.current?.add(placeholderNodeId);
            console.log(`🔧 [GRAPH_BUILD] Created placeholder node for empty dataset: ${placeholderNodeId}`);
          }
        }
      }
    }
    
    // Queue connected accounts for processing if within depth limit
    if (depth < maxDepth - 1) {
      console.log(`🔄 [GRAPH_BUILD] Queueing ${connectedAccounts.size} connected accounts for next depth level`);
      for (const connectedAddress of connectedAccounts) {
        const nextDepth = depth + 1;
        const connectedAccountKey = `${connectedAddress}:${nextDepth}`;
        // Add safety checks to ensure Set objects are defined before calling .has()
        if (!loadedAccountsRef?.current?.has(connectedAddress) && 
            !pendingFetchesRef?.current?.has(connectedAccountKey) && 
            connectedAddress !== address) {
          console.log(`📝 [GRAPH_BUILD] Queueing connected account: ${connectedAddress} at depth ${nextDepth}`);
          // Pass the current transaction signature as the parent signature instead of null
          queueAccountFetch?.(connectedAddress, nextDepth, parentSignature);
        } else {
          console.log(`⏭️ [GRAPH_BUILD] Skipping connected account: ${connectedAddress} (already processed or pending)`);
        }
      }
    } else {
      console.log(`🛑 [GRAPH_BUILD] Max depth reached, not queueing connected accounts`);
    }
    
    console.log(`✅ [GRAPH_BUILD] Completed processing for ${address}`);
    console.log(`📊 [GRAPH_BUILD] Summary for ${address}:`, {
      totalTransactions: data.transactions.length,
      processedTransactions: processedTransactionCount,
      skippedTransactions: skippedTransactionCount,
      connectedAccounts: connectedAccounts.size,
      currentDepth: depth,
      maxDepth: maxDepth
    });
    
    // Log current graph state
    if (cy) {
      const nodes = cy.nodes();
      const edges = cy.edges();
      const transactions = nodes.filter(node => node.data('type') === 'transaction');
      const accounts = nodes.filter(node => node.data('type') === 'account');
      
      console.log(`📊 [GRAPH_STATE] Current graph state: ${nodes.length} total nodes (${accounts.length} accounts, ${transactions.length} transactions), ${edges.length} edges`);
    }
    
    return { cy, address, newElements };
  } catch (error) {
    console.error(`❌ [GRAPH_BUILD] Error adding account ${address} to graph:`, error);
    console.error(`❌ [GRAPH_BUILD] Error details: depth=${depth}, maxDepth=${maxDepth}, totalAccounts=${totalAccounts}`);
    
    // Clean up any partial state
    pendingFetchesRef?.current?.delete(`${address}:${depth}`);
    
    // Still try to add a minimal error node so the account is represented
    if (cy) {
      const nodeId = address;
      if (!cy.getElementById(nodeId).length && !processedNodesRef?.current?.has(nodeId)) {
        console.log(`🚨 [GRAPH_BUILD] Adding error node for ${address} due to processing failure`);
        cy.add({
          data: {
            id: nodeId,
            label: shortenString(address),
            type: 'account',
            fullAddress: address,
            status: 'error',
            transactionCount: 0,
            hasError: true,
            errorMessage: error.message || 'Processing failed'
          },
          classes: 'account error'
        });
        processedNodesRef?.current?.add(nodeId);
        
        // Track new elements if set is provided
        if (newElements) {
          newElements.add(nodeId);
        }
      }
    }
    
    return { cy: cyRef?.current, address, newElements: new Set() };
  }
};

/**
 * Expand the transaction graph
 * @param signature Transaction signature
 * @param cyRef Reference to cytoscape instance
 * @param fetchTransactionData Function to fetch transaction data
 * @param queueAccountFetch Function to queue an account for fetching
 * @param addAccountToGraph Function to add account to graph
 * @param setExpandedNodesCount Function to update expanded nodes count
 * @param loadedTransactionsRef Reference to loaded transactions
 * @param signal Optional AbortSignal for cancelling operations
 * @returns Promise that resolves to true if new elements were added
 */
export async function expandTransactionGraph(
  signature: string,
  cyRef: React.MutableRefObject<cytoscape.Core | null>,
  fetchTransactionData: (signature: string) => Promise<any>,
  queueAccountFetch: (address: string, depth: number, parentSignature: string | null) => void,
  addAccountToGraph: (address: string, totalAccounts: number, depth: number, parentSignature: string | null, newElements?: Set<string>) => Promise<GraphElementAddResult | undefined>,
  setExpandedNodesCount: (cb: (prev: number) => number) => void,
  loadedTransactionsRef: React.MutableRefObject<Set<string>>,
  signal?: AbortSignal
): Promise<boolean> {
  const cy = cyRef.current;
  if (!cy) return false;

  // Check if the operation has been aborted
  if (signal?.aborted) {
    return false;
  }

  // Save viewport state before expansion
  const initialViewport = { zoom: cy.zoom(), pan: cy.pan() };
  
  // Track new elements added during this expansion
  const newElements = new Set<string>();

  // Always create or update the transaction node first
  const existingNode = cy.getElementById(signature);
  if (existingNode.length === 0) {
    cy.add({ 
      data: { 
        id: signature, 
        label: signature.slice(0, 8) + '...', 
        type: 'transaction' 
      }, 
      classes: 'transaction' 
    });
  }

  try {
    // Check for abort before expensive operations
    if (signal?.aborted) {
      return false;
    }
    
    // Fetch transaction data even if node exists to ensure we have latest data
    const transactionData = await fetchTransactionData(signature);
    
    // Check for abort after network request
    if (signal?.aborted) {
      return false;
    }
    
    // Add the transaction signature to loadedTransactionsRef to prevent re-processing
    loadedTransactionsRef.current.add(signature);
    
    if (transactionData?.details?.accounts?.length > 0) {
      // Process all accounts in parallel instead of just the first one
      const accountPromises = transactionData.details.accounts.map(account => {
        if (account.pubkey) {
          return new Promise<void>((resolve) => {
            queueAccountFetch(account.pubkey, 1, signature);
            resolve();
          });
        }
        return Promise.resolve();
      });
      
      // Wait for all account queuing to complete
      if (!signal?.aborted) {
        await Promise.all(accountPromises);
        
        // Wait a short time for processing to start
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 300);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              resolve(undefined);
            }, { once: true });
          }
        });
      }
    }
  } catch (error) {
    // Only log errors if they're not from an aborted request
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error(`Error fetching transaction data for expansion: ${signature}`, error);
    }
    return false;
  }
  
  // Check if aborted after transaction fetch
  if (signal?.aborted) {
    return false;
  }
  
  // Get connected accounts to this transaction
  const connectedAccounts = cy.getElementById(signature).connectedEdges().connectedNodes()
    .filter(node => node.data('type') === 'account')
    .map(node => node.id() as string);

  try {
    // Process accounts in parallel with proper error handling
    if (connectedAccounts.length > 0) {
      const accountProcessPromises = connectedAccounts.map(accountId => 
        addAccountToGraph(accountId, connectedAccounts.length, 1, signature, newElements)
          .catch(err => {
            console.error(`Error processing account ${accountId}:`, err);
            return undefined;
          })
      );
      
      await Promise.all(accountProcessPromises);
    }
    
    // Check for abort after processing accounts
    if (signal?.aborted) {
      return false;
    }
    
    // Apply incremental layout only if we have new elements
    if (newElements.size > 0) {
      const elementsToAnimate = Array.from(newElements);

      // Start with zero opacity for smooth fade-in
      cy.$(elementsToAnimate.map(id => `#${id}`).join(',')).style({
        'opacity': 0
      });
      
      // Run incremental layout that preserves existing node positions
      runIncrementalLayout(cy, elementsToAnimate);
      
      // Update analytics count
      setExpandedNodesCount(prev => prev + newElements.size);
      
      // Animate new elements with a fade-in effect
      cy.$(elementsToAnimate.map(id => `#${id}`).join(',')).animate({
        style: { opacity: 1 }
      }, { 
        duration: 300,
        easing: 'ease-in-out'
      });
      
      // Restore original viewport position to maintain user's perspective
      cy.viewport(initialViewport);
      
      return true;
    }
  } catch (error) {
    // Only log errors if they're not from an aborted request
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error(`Error processing connected accounts for ${signature}:`, error);
    }
  }
  
  return newElements.size > 0;
};