import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection-server';
import { isValidSolanaAddress } from '@/lib/utils';
import {
  MIN_TRANSFER_SOL,
  TRANSACTION_BATCH_SIZE,
  MAX_SIGNATURES_LIMIT,
  MAX_RETRIES,
  INITIAL_BACKOFF_MS,
  BATCH_DELAY_MS,
  isSpamAddress,
  isAboveDustThreshold,
  MIN_WALLET_ADDRESS_LENGTH,
  MAX_CONCURRENT_BATCHES,
  EFFECTIVE_MAX_RPS
} from '@/lib/transaction-constants';
import {
  getCachedTransfers,
  storeTransferEntry,
  batchStoreTransferEntries,
  markTransfersCached,
  isSolanaOnlyTransaction,
  type TransferEntry
} from '@/lib/qdrant';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// In-memory coordination to prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<any>>();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface Transfer {
  txId: string;
  date: string;
  from: string;
  to: string;
  tokenSymbol: string;
  tokenAmount: string;
  transferType: 'IN' | 'OUT';
}

/**
 * Process a batch of transactions and extract transfer data
 * Using smaller batches to improve performance and reliability
 * Gets fresh RPC connection for each call to maximize OpenSVM rotation
 */
async function fetchTransactionBatch(
  signatures: string[],
  address: string
): Promise<Transfer[]> {
  const transfers: Transfer[] = [];
  const startTime = Date.now();

  // Process in small batches to avoid connection overload
  const batches: string[][] = [];

  for (let i = 0; i < signatures.length; i += TRANSACTION_BATCH_SIZE) {
    batches.push(signatures.slice(i, i + TRANSACTION_BATCH_SIZE));
  }

  // Process batches with rate limiting to respect 300 RPS OpenSVM Business Plan limit
  // Limit concurrent batches to stay under EFFECTIVE_MAX_RPS (240 RPS)
  console.log(`Rate limiting: Processing ${batches.length} batches with max ${MAX_CONCURRENT_BATCHES} concurrent`);

  const results: Transfer[][] = [];

  // Process batches in chunks to respect rate limits
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const batchChunk = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    console.log(`Processing batch chunk ${Math.floor(i / MAX_CONCURRENT_BATCHES) + 1}/${Math.ceil(batches.length / MAX_CONCURRENT_BATCHES)} with ${batchChunk.length} batches`);

    const chunkPromises = batchChunk.map((batch, batchIndex) => {
      const globalBatchIndex = i + batchIndex;
      return (async (): Promise<Transfer[]> => {
        let retries = MAX_RETRIES;
        let backoff = INITIAL_BACKOFF_MS;

        while (retries > 0) {
          try {
            // Get fresh connection for batch RPC call to maximize OpenSVM rotation
            const freshConnection = await getConnection();

            // Use getParsedTransactions for much better performance than individual calls
            const batchTransactionsResult = await freshConnection.getParsedTransactions(batch, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            });

            // Ensure we have a valid array before processing
            const batchTransactions = Array.isArray(batchTransactionsResult) 
              ? batchTransactionsResult 
              : [];

            if (!Array.isArray(batchTransactions)) {
              console.error(`getParsedTransactions returned non-array:`, typeof batchTransactionsResult);
              return []; // Return empty array if result is not an array
            }

            const batchTransfers: Transfer[] = [];

            // Process all transactions in this batch
            for (let txIndex = 0; txIndex < batchTransactions.length; txIndex++) {
              const tx = batchTransactions[txIndex];
              const signature = batch[txIndex];

              if (!tx?.meta) {
                continue; // Skip failed/missing transactions
              }

              const { preBalances, postBalances } = tx.meta;
              const accountKeys = tx.transaction.message.accountKeys;
              const blockTime = tx.blockTime! * 1000;

              // Safety check: ensure all arrays have the same length
              const maxLength = Math.min(
                accountKeys.length,
                preBalances?.length || 0,
                postBalances?.length || 0
              );

              if (maxLength === 0) {
                continue; // No account data to process
              }

              // Process balance changes for this transaction
              for (let index = 0; index < maxLength; index++) {
                const preBalance = preBalances?.[index] || 0;
                const postBalance = postBalances?.[index] || 0;
                const delta = postBalance - preBalance;
                const account = accountKeys[index]?.pubkey.toString() || '';
                const firstAccount = accountKeys[0]?.pubkey.toString() || '';

                if (delta === 0 || !account) {
                  continue;
                }

                const amount = Math.abs(delta / 1e9);

                // Skip if this is a spam address
                if (isSpamAddress(account) || isSpamAddress(firstAccount)) {
                  continue;
                }

                // Skip dust transactions
                if (!isAboveDustThreshold(amount, MIN_TRANSFER_SOL)) {
                  continue;
                }

                batchTransfers.push({
                  txId: signature,
                  date: new Date(blockTime).toISOString(),
                  from: delta < 0 ? account : (delta > 0 ? firstAccount : ''),
                  to: delta > 0 ? account : (delta < 0 ? firstAccount : ''),
                  tokenSymbol: 'SOL',
                  tokenAmount: amount.toString(),
                  transferType: delta < 0 ? 'OUT' : 'IN',
                });
              }
            }

            // STREAMING CACHE UPDATE: Immediately cache this batch's results
            if (batchTransfers.length > 0) {
              // Cache this batch asynchronously (don't wait for it)
              (async () => {
                try {
                  console.log(`Streaming cache update: Batch ${globalBatchIndex + 1} - caching ${batchTransfers.length} transfers`);

                  const transferEntries: TransferEntry[] = batchTransfers.map((transfer) => ({
                    id: crypto.randomUUID(),
                    walletAddress: address,
                    signature: transfer.txId || '',
                    timestamp: new Date(transfer.date).getTime(),
                    type: (transfer.transferType || 'transfer').toLowerCase() as 'in' | 'out' | 'transfer',
                    amount: parseFloat(transfer.tokenAmount) || 0,
                    token: transfer.tokenSymbol || 'SOL',
                    tokenSymbol: transfer.tokenSymbol || 'SOL',
                    tokenName: transfer.tokenSymbol || 'SOL',
                    from: transfer.from || '',
                    to: transfer.to || '',
                    mint: undefined,
                    usdValue: undefined,
                    isSolanaOnly: isSolanaOnlyTransaction({
                      tokenSymbol: transfer.tokenSymbol,
                      token: transfer.tokenSymbol,
                      from: transfer.from,
                      to: transfer.to
                    } as any),
                    cached: true,
                    lastUpdated: Date.now()
                  }));

                  // Store this batch immediately
                  await batchStoreTransferEntries(transferEntries);
                  await markTransfersCached(batch, address);

                  console.log(`Streaming cache complete: Batch ${globalBatchIndex + 1} cached successfully`);
                } catch (error) {
                  console.error(`Streaming cache failed for batch ${globalBatchIndex + 1}:`, error);
                  // Don't throw - this is async caching, shouldn't block main flow
                }
              })();
            }

            // If we got here, the batch was successful
            return batchTransfers;

          } catch (err) {
            console.error(`Batch ${globalBatchIndex + 1} transaction error (${retries} retries left):`, err);
            retries--;

            if (retries > 0) {
              // Use exponential backoff
              await new Promise(resolve => setTimeout(resolve, backoff));
              backoff *= 2;
            }
          }
        }

        return []; // Return empty array if all retries failed
      })();
    });

    // Execute chunk promises in parallel and collect results
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    // Add delay between chunks to respect rate limits (except for last chunk)
    if (i + MAX_CONCURRENT_BATCHES < batches.length) {
      const delayMs = Math.ceil(1000 / (EFFECTIVE_MAX_RPS / MAX_CONCURRENT_BATCHES)); // Ensure we don't exceed RPS
      console.log(`Rate limiting: Waiting ${delayMs}ms before next chunk`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Flatten all results into transfers array
  results.forEach((batchTransfers: Transfer[]) => {
    transfers.push(...batchTransfers);
  });

  console.log(`Processed ${transfers.length} transfers in ${Date.now() - startTime}ms`);
  return transfers;
}

async function processTransferRequest(
  address: string,
  offset: number,
  limit: number,
  transferType: string,
  solanaOnly: boolean,
  startTime: number,
  searchParams: URLSearchParams
) {
  try {
    // Check cache for existing transfers (use any cached data, not just recent)
    console.log(`Checking cache for ${address} with limit: ${limit}, offset: ${offset}`);

    let cachedTransfers: TransferEntry[] = [];
    try {
      const cacheResult = await getCachedTransfers(address, {
        limit: limit * 2, // Get more from cache to account for filtering
        offset,
        solanaOnly,
        transferType: transferType === 'SOL' ? 'SOL' : transferType === 'TOKEN' ? 'TOKEN' : 'ALL'
      });
      cachedTransfers = cacheResult.transfers;
      console.log(`Found ${cachedTransfers.length} cached transfers for ${address}`);
    } catch (error) {
      console.warn('Cache lookup failed, proceeding with live fetch:', error);
      cachedTransfers = [];
    }

    // Combine cached transfers with fresh RPC data to meet user's request
    let allTransfers: Transfer[] = [];
    let fromCache = false;

    // Convert cached transfers to expected format first
    const formattedCachedTransfers = cachedTransfers.map(transfer => ({
      txId: transfer.signature,
      date: new Date(transfer.timestamp).toISOString(),
      from: transfer.from,
      to: transfer.to,
      tokenSymbol: transfer.tokenSymbol || transfer.token,
      tokenAmount: transfer.amount.toString(),
      transferType: transfer.type === 'IN' ? 'IN' as const : 'OUT' as const,
    }));

    // Always combine cache + RPC to fulfill user's complete request
    console.log(`User requested ${limit} transfers, have ${cachedTransfers.length} cached. Will fetch additional if needed...`);

    allTransfers = [...formattedCachedTransfers];
    let remainingNeeded = limit - cachedTransfers.length;

    // Smart cursor initialization: use oldest cached signature if no beforeSignature provided
    let beforeSignature = searchParams.get('beforeSignature');
    if (!beforeSignature && cachedTransfers.length > 0) {
      // Find oldest cached transaction by timestamp and use its signature
      const oldestCached = cachedTransfers.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest
      );
      beforeSignature = oldestCached.signature;
      console.log(`Using oldest cached signature as cursor: ${beforeSignature.substring(0, 8)}...`);
    }

    // Early exit if we already have enough transfers
    if (remainingNeeded <= 0) {
      console.log(`Cache already satisfies request: ${allTransfers.length}/${limit} transfers`);
    } else {
      // Get connection from pool for signature fetching
      const connection = await getConnection();
      const pubkey = new PublicKey(address);

      // STRATEGY: Fetch ALL signatures first, then process transactions in parallel
      console.log(`Need ${remainingNeeded} more transfers. Fetching signatures...`);

      let allSignatures: string[] = [];
      let currentCursor = beforeSignature;
      let signatureFetchIterations = 0;
      const maxSignatureFetches = 200; // Prevent infinite loops

      // Phase 1: Collect all signatures we need
      while (allSignatures.length < remainingNeeded * 3 && signatureFetchIterations < maxSignatureFetches) {
        signatureFetchIterations++;

        const batchSize = Math.min(MAX_SIGNATURES_LIMIT, (remainingNeeded * 3) - allSignatures.length);

        console.log(`Signature fetch ${signatureFetchIterations}: Getting ${batchSize} signatures (before: ${currentCursor?.substring(0, 8) || 'none'})`);

        const signatures = await connection.getSignaturesForAddress(
          pubkey,
          {
            limit: batchSize,
            before: currentCursor || undefined
          }
        );

        if (signatures.length === 0) {
          console.log(`No more signatures available - reached end of transaction history`);
          break;
        }

        // Add signatures to our collection
        allSignatures.push(...signatures.map(s => s.signature));

        // Update cursor to oldest signature from this batch for next iteration
        // Note: Solana returns signatures in reverse chronological order (newest first)
        currentCursor = signatures[signatures.length - 1].signature;

        console.log(`Collected ${allSignatures.length} signatures so far, cursor: ${currentCursor.substring(0, 8)}...`);
      }

      console.log(`Phase 1 complete: Collected ${allSignatures.length} signatures in ${signatureFetchIterations} fetches`);

      // Phase 2: Process all transactions in parallel for maximum performance
      if (allSignatures.length > 0) {
        console.log(`Phase 2: Processing ${allSignatures.length} transactions in parallel...`);

        const allNewTransfers = await fetchTransactionBatch(allSignatures, address);

        // Apply filtering to new transfers
        // const filteredNewTransfers = allNewTransfers
        //   .filter(transfer => {
        //     const amount = parseFloat(transfer.tokenAmount);
        //     return isAboveDustThreshold(amount, MIN_TRANSFER_SOL) &&
        //       transfer.from !== transfer.to &&
        //       transfer.from.length >= MIN_WALLET_ADDRESS_LENGTH &&
        //       transfer.to.length >= MIN_WALLET_ADDRESS_LENGTH;
        //   });

        // console.log(`Processed ${allNewTransfers.length} raw transfers, ${filteredNewTransfers.length} after filtering`);

        // Add to our collection
        allTransfers.push(...allNewTransfers);
      }
    }

    // Sort all transfers by amount descending and trim to requested limit
    const finalTransfers = allTransfers
      .sort((a, b) => parseFloat(b.tokenAmount) - parseFloat(a.tokenAmount))
      .slice(offset, offset + limit);

    const hasMore = allTransfers.length > offset + limit;

    console.log(`API returning ${finalTransfers.length} transfers (${cachedTransfers.length} from cache + ${allTransfers.length - cachedTransfers.length} from RPC)`);

    return NextResponse.json({
      data: finalTransfers,
      hasMore,
      total: finalTransfers.length,
      originalTotal: allTransfers.length,
      nextPageSignature: beforeSignature,
      fromCache: cachedTransfers.length === allTransfers.length
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('processTransferRequest Error:', error);
    const errorTime = Date.now() - startTime;
    console.error(`processTransferRequest failed after ${errorTime}ms`);

    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now();

  try {
    console.log(`[API] Starting transfer fetch`);
    const params = await context.params;
    const { address: rawAddress } = params;
    const address = decodeURIComponent(String(rawAddress));
    console.log(`Starting transfer fetch for ${address}`);

    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0');
    // Allow large requests - we'll handle pagination internally
    const limit = parseInt(searchParams.get('limit') || '50');
    const transferType = searchParams.get('transferType') || 'ALL';
    const solanaOnly = searchParams.get('solanaOnly') === 'true';

    // Validate address
    if (!isValidSolanaAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Create request key for coordination
    const requestKey = `${address}-${offset}-${limit}-${transferType}-${solanaOnly}`;

    // Check if there's already a pending request for this exact query
    if (pendingRequests.has(requestKey)) {
      console.log(`Waiting for existing request: ${requestKey}`);
      try {
        const result = await pendingRequests.get(requestKey);
        console.log(`Reusing result from concurrent request`);
        return result;
      } catch (error) {
        console.error('Concurrent request failed, proceeding with new request:', error);
        pendingRequests.delete(requestKey);
      }
    }

    // Create promise for this request
    const requestPromise = (async () => {
      try {
        return await processTransferRequest(address, offset, limit, transferType, solanaOnly, startTime, searchParams);
      } finally {
        // Always clean up the pending request
        pendingRequests.delete(requestKey);
      }
    })();

    // Store the promise
    pendingRequests.set(requestKey, requestPromise);

    // Execute and return the result
    return await requestPromise;

  } catch (error) {
    console.error('API Error:', error);
    const errorTime = Date.now() - startTime;
    console.error(`Request failed after ${errorTime}ms`);

    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
