import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
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
  MIN_WALLET_ADDRESS_LENGTH
} from '@/lib/transaction-constants';
import {
  getCachedTransfers,
  storeTransferEntry,
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
 */
async function fetchTransactionBatch(
  connection: Connection,
  signatures: string[]
): Promise<Transfer[]> {
  const transfers: Transfer[] = [];
  const startTime = Date.now();

  // Process in small batches to avoid connection overload
  const batches: string[][] = [];

  for (let i = 0; i < signatures.length; i += TRANSACTION_BATCH_SIZE) {
    batches.push(signatures.slice(i, i + TRANSACTION_BATCH_SIZE));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (signature: string) => {
        let retries = MAX_RETRIES;
        let backoff = INITIAL_BACKOFF_MS;

        while (retries > 0) {
          try {
            const tx = await connection.getParsedTransaction(signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            });

            if (!tx?.meta) {
              return [];
            }

            const { preBalances, postBalances } = tx.meta;
            const accountKeys = tx.transaction.message.accountKeys;
            const blockTime = tx.blockTime! * 1000;

            const txTransfers: Transfer[] = [];

            // Use proper braces for loop body
            for (let index = 0; index < preBalances.length; index++) {
              const preBalance = preBalances[index] || 0;
              const postBalance = postBalances[index] || 0;
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

              txTransfers.push({
                txId: signature,
                date: new Date(blockTime).toISOString(),
                from: delta < 0 ? account : (delta > 0 ? firstAccount : ''),
                to: delta > 0 ? account : (delta < 0 ? firstAccount : ''),
                tokenSymbol: 'SOL',
                tokenAmount: amount.toString(),
                transferType: delta < 0 ? 'OUT' : 'IN',
              });
            }

            return txTransfers;
          } catch (err) {
            console.error(`Transaction error (${retries} retries left):`, err);
            retries--;

            if (retries > 0) {
              // Use exponential backoff
              await new Promise(resolve => setTimeout(resolve, backoff));
              backoff *= 2; // Double the backoff time for next retry
            }
          }
        }

        return []; // Return empty array if all retries failed
      })
    );

    // Flatten batch results and add to transfers
    batchResults.forEach(result => {
      if (Array.isArray(result)) {
        transfers.push(...result);
      }
    });

    // Small delay between batches to avoid rate limiting
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

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

    // If we have sufficient cached data, return it (regardless of age)
    if (cachedTransfers.length >= limit && offset === 0) {
      console.log(`Returning ${cachedTransfers.length} cached transfers (from cache)`);

      // Convert cached transfers to the expected format
      const formattedTransfers = cachedTransfers
        .slice(offset, offset + limit)
        .map(transfer => ({
          txId: transfer.signature,
          date: new Date(transfer.timestamp).toISOString(),
          from: transfer.from,
          to: transfer.to,
          tokenSymbol: transfer.tokenSymbol || transfer.token,
          tokenAmount: transfer.amount.toString(),
          transferType: transfer.type === 'IN' ? 'IN' as const : 'OUT' as const,
        }));

      return NextResponse.json({
        data: formattedTransfers,
        hasMore: cachedTransfers.length > offset + limit,
        total: formattedTransfers.length,
        originalTotal: cachedTransfers.length,
        nextPageSignature: null,
        fromCache: true
      }, { headers: corsHeaders });
    }

    // Get connection from pool
    const connection = await getConnection();
    const pubkey = new PublicKey(address);

    // Fetch signatures with proper pagination
    console.log(`Fetching signatures for ${address} (offset: ${offset}, limit: ${limit})`);

    // For proper pagination, we need to track the last signature from the previous page
    // The offset-based pagination requires getting a beforeSignature from URL params
    // since Solana doesn't support direct offset pagination
    const beforeSignature = searchParams.get('beforeSignature');

    const signatures = await connection.getSignaturesForAddress(
      pubkey,
      {
        limit,
        before: beforeSignature || undefined
      }
    );

    if (signatures.length === 0) {
      console.log(`No signatures found for ${address}`);
      return NextResponse.json({
        data: [],
        hasMore: false,
        total: 0,
        nextPageSignature: null
      }, { headers: corsHeaders });
    }

    console.log(`Found ${signatures.length} signatures, processing transfers`);

    // Process transactions in smaller batches
    const transfers = await fetchTransactionBatch(
      connection,
      signatures.map(s => s.signature)
    );

    console.log(`Total transfers found: ${transfers.length}`);

    // Apply basic filtering to remove invalid/spam transfers
    const filteredTransfers = transfers
      .filter(transfer => {
        const amount = parseFloat(transfer.tokenAmount);
        // Basic validation - only filter out clearly invalid data
        return isAboveDustThreshold(amount, MIN_TRANSFER_SOL) &&
          transfer.from !== transfer.to && // Prevent self-transfers
          transfer.from.length >= MIN_WALLET_ADDRESS_LENGTH &&
          transfer.to.length >= MIN_WALLET_ADDRESS_LENGTH; // Ensure full wallet addresses
      })
      .sort((a, b) => parseFloat(b.tokenAmount) - parseFloat(a.tokenAmount)); // Sort by amount descending

    console.log(`Filtered ${filteredTransfers.length} valid transfers (removed spam/invalid only)`);

    // Get the last signature for pagination
    const nextPageSignature = signatures.length > 0 ? signatures[signatures.length - 1].signature : null;

    // Prepare response data
    const responseData = {
      data: filteredTransfers,
      hasMore: signatures.length === limit,
      total: filteredTransfers.length,
      originalTotal: transfers.length,
      nextPageSignature,
      fromCache: false
    };

    // Send response immediately
    const response = NextResponse.json(responseData, { headers: corsHeaders });

    // Cache the transfers immediately (don't wait for background)
    if (filteredTransfers.length > 0) {
      try {
        console.log(`Immediately caching ${filteredTransfers.length} transfers for ${address}`);
        
        // Convert transfers to TransferEntry format and cache immediately
        const transferEntries: TransferEntry[] = filteredTransfers.map((transfer, index) => ({
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

        // Store transfers immediately (parallel processing)
        const cachePromises = transferEntries.map(async (entry) => {
          try {
            if (!entry.id || !entry.walletAddress || !entry.signature) {
              console.warn('Skipping invalid transfer entry:', entry);
              return;
            }
            await storeTransferEntry(entry);
          } catch (error) {
            console.error(`Failed to store transfer entry ${entry.id}:`, error);
          }
        });

        // Wait for all caching to complete
        await Promise.allSettled(cachePromises);
        
        // Mark signatures as cached
        await markTransfersCached(signatures.map(s => s.signature), address);
        
        console.log(`Successfully cached ${transferEntries.length} transfers`);
      } catch (error) {
        console.error('Immediate caching failed:', error);
        // Don't block response on cache failure
      }
    }

    console.log(`API returning ${filteredTransfers.length} transfers`);

    return response;

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
    // Limit batch size to improve performance
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), MAX_SIGNATURES_LIMIT);
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
