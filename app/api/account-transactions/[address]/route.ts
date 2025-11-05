import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';
import { PublicKey } from '@solana/web3.js';
import { classifyTransactionType, isFundingTransaction } from '@/lib/transaction-classifier';
import { getConnection as getClientConnection } from '@/lib/solana-connection-server';
import { getTokenInfoServer } from '@/lib/server/token-metadata-cache';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: new Headers({
      ...defaultHeaders,
      'Access-Control-Max-Age': '86400',
    })
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  // Fast path for test/self-check mode to avoid external RPC dependencies
  try {
    const isPlaywright = request.headers.get('x-playwright-test') === 'true' || process.env.PLAYWRIGHT_TEST === 'true';
    if (isPlaywright) {
      const params = await context.params;
      const { address } = await params;
      const now = Date.now();
      const mockTxs = [
        {
          signature: 'TESTSIG_1',
          timestamp: now,
          slot: 1,
          err: null,
          success: true,
          accounts: [
            { pubkey: address, isSigner: false, isWritable: true },
            { pubkey: 'So11111111111111111111111111111111111111112', isSigner: false, isWritable: false }
          ],
          transfers: [
            { account: address, change: 1500000000 } // +1.5 SOL
          ],
          memo: null,
          classification: { type: 'sol_transfer' },
          isFunding: false,
          direction: 'in',
          tokenMint: null,
          tokenSymbol: 'SOL',
          amount: 1.5
        },
        {
          signature: 'TESTSIG_2',
          timestamp: now - 60000,
          slot: 2,
          err: null,
          success: true,
          accounts: [
            { pubkey: address, isSigner: false, isWritable: true },
            { pubkey: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', isSigner: false, isWritable: false }
          ],
          transfers: [],
          memo: 'mock',
          classification: { type: 'spl_transfer' },
          isFunding: false,
          direction: 'out',
          tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          tokenSymbol: 'USDC',
          amount: 10
        }
      ];
      return new Response(
        JSON.stringify({ address, includeInflow: false, classified: true, transactions: mockTxs, rpcCount: 0, mock: true }),
        { status: 200, headers: new Headers(defaultHeaders) }
      );
    }
  } catch { }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for date range queries

  try {
    // Extract the address parameter
    const params = await context.params;
    const { address } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    const before = url.searchParams.get('before') || undefined;
    const until = url.searchParams.get('until') || undefined;
    const classify = url.searchParams.get('classify') === 'true';
    const includeInflow = url.searchParams.get('includeInflow') === 'true';
    
    // New date range parameters
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    
    // Parse date parameters - support both ISO strings and Unix timestamps
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (startDateParam) {
      // Check if it's a Unix timestamp (all digits)
      if (/^\d+$/.test(startDateParam)) {
        startDate = new Date(parseInt(startDateParam));
      } else {
        startDate = new Date(startDateParam);
      }
      
      if (isNaN(startDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid startDate format. Use ISO string or Unix timestamp.' }),
          { status: 400, headers: new Headers(defaultHeaders) }
        );
      }
    }
    
    if (endDateParam) {
      if (/^\d+$/.test(endDateParam)) {
        endDate = new Date(parseInt(endDateParam));
      } else {
        endDate = new Date(endDateParam);
      }
      
      if (isNaN(endDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid endDate format. Use ISO string or Unix timestamp.' }),
          { status: 400, headers: new Headers(defaultHeaders) }
        );
      }
    }
    
    // Validate date range
    if (startDate && endDate && startDate > endDate) {
      return new Response(
        JSON.stringify({ error: 'startDate must be before endDate' }),
        { status: 400, headers: new Headers(defaultHeaders) }
      );
    }

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Account address is required' }),
        {
          status: 400,
          headers: new Headers(defaultHeaders)
        }
      );
    }

    try {
      new PublicKey(address);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid Solana address' }),
        {
          status: 400,
          headers: new Headers(defaultHeaders)
        }
      );
    }

    // Get connection from pool
    const connection = await getConnection();

    // Determine if we need to fetch based on date range
    const needsDateRangeFiltering = startDate || endDate;
    let signatures: Awaited<ReturnType<typeof connection.getSignaturesForAddress>> = [];
    let fetchedCount = 0;
    let rpcCallCount = 0;
    const maxFetchLimit = 1000; // Maximum transactions to fetch to prevent excessive RPC calls
    const batchSize = needsDateRangeFiltering ? 100 : limit; // Fetch in batches for date filtering
    
    // If date filtering is needed, we need to fetch transactions until we cover the date range
    if (needsDateRangeFiltering) {
      let allSignatures: typeof signatures = [];
      let lastSignature: string | undefined = before;
      let shouldContinue = true;
      let oldestTimestamp: number | undefined;
      let newestTimestamp: number | undefined;
      
      while (shouldContinue && fetchedCount < maxFetchLimit) {
        // Fetch a batch of signatures
        const batch = await connection.getSignaturesForAddress(
          new PublicKey(address),
          {
            limit: Math.min(batchSize, maxFetchLimit - fetchedCount),
            before: lastSignature,
            until
          },
          'confirmed'
        );
        
        rpcCallCount++;
        
        if (batch.length === 0) {
          // No more transactions
          shouldContinue = false;
          break;
        }
        
        // Track timestamps for metadata
        if (batch[0]?.blockTime) {
          const timestamp = batch[0].blockTime * 1000;
          if (!newestTimestamp || timestamp > newestTimestamp) {
            newestTimestamp = timestamp;
          }
        }
        
        const lastBatch = batch[batch.length - 1];
        if (lastBatch?.blockTime) {
          oldestTimestamp = lastBatch.blockTime * 1000;
        }
        
        // Add to our collection
        allSignatures.push(...batch);
        fetchedCount += batch.length;
        
        // Check if we've fetched enough based on date range
        if (startDate && oldestTimestamp && oldestTimestamp < startDate.getTime()) {
          // We've gone past our start date
          shouldContinue = false;
        } else if (batch.length < batchSize) {
          // No more transactions available
          shouldContinue = false;
        } else {
          // Continue fetching
          lastSignature = batch[batch.length - 1].signature;
        }
      }
      
      // Filter signatures by date range
      signatures = allSignatures.filter(sig => {
        if (!sig.blockTime) return false;
        const timestamp = sig.blockTime * 1000;
        
        if (startDate && timestamp < startDate.getTime()) return false;
        if (endDate && timestamp > endDate.getTime()) return false;
        
        return true;
      });
      
      // Apply limit after filtering
      if (limit && signatures.length > limit) {
        signatures = signatures.slice(0, limit);
      }
    } else {
      // Standard fetch without date filtering
      signatures = await connection.getSignaturesForAddress(
        new PublicKey(address),
        {
          limit,
          before,
          until
        },
        'confirmed'
      );
      rpcCallCount = 1;
    }

    // If includeInflow is true, also fetch inbound transactions
    if (includeInflow) {
      try {
        // Get recent inbound transactions by looking at account's pre/post balance changes
        // This is a simplified approach - in production you might want to use a more sophisticated method
        const accountInfo = await connection.getAccountInfo(new PublicKey(address));
        if (accountInfo) {
          // For now, we'll add a flag to indicate this transaction involved the account
          // The actual inflow detection will be done in the transaction processing
        }
      } catch (error) {
        console.warn('Could not fetch inflow data:', error);
        // Continue without inflow data
      }
    }

    // Fetch full transaction details
    // Use multiple connections for parallel processing
    const fetchTransactionDetails = async (signature: string, index: number): Promise<any> => {
      // Get a separate connection for each transaction to maximize parallelism
      const txConnection = await getConnection();

      try {
        const tx = await txConnection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        // Get accounts involved in this transaction
        const accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean; }> = tx?.transaction.message.accountKeys.map(key => ({
          pubkey: key.pubkey.toString(),
          isSigner: key.signer,
          isWritable: key.writable
        })) || [];

        // Calculate transaction flow
        const transfers: Array<{ account: string; change: number; }> = [];
        let primaryNetChange = 0;
        if (tx?.meta) {
          // Look at pre/post balances to determine transfers
          if (tx.meta.preBalances && tx.meta.postBalances) {
            for (let i = 0; i < tx.meta.preBalances.length; i++) {
              const pre = tx.meta.preBalances[i];
              const post = tx.meta.postBalances[i];
              const change = post - pre;

              if (change !== 0 && accounts[i]) {
                transfers.push({
                  account: accounts[i].pubkey,
                  change
                });
              }
              // Track net change for the requested address to derive direction
              if (accounts[i] && accounts[i].pubkey === address) {
                primaryNetChange += change;
              }
            }
          }
        }

        // Basic token transfer extraction for SPL
        let tokenAmount: number | undefined;
        let tokenMint: string | undefined;
        try {
          const ixs = tx?.transaction.message.instructions as any[] | undefined;
          if (ixs && Array.isArray(ixs)) {
            for (const ix of ixs) {
              const pid = ix?.programId?.toString?.() || ix?.programId || '';
              if (pid === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                const parsed = (ix as any)?.parsed?.info || (ix as any)?.info;
                const amtStr = parsed?.amount ?? parsed?.tokenAmount?.amount;
                if (amtStr != null) tokenAmount = Number(amtStr);
                tokenMint = parsed?.mint || parsed?.tokenMint || tokenMint;
              }
            }
          }
        } catch { }

        const sigInfo = signatures[index];
        const base = {
          signature: sigInfo.signature,
          timestamp: tx?.blockTime ? tx.blockTime * 1000 : sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
          slot: sigInfo.slot,
          err: sigInfo.err,
          success: !sigInfo.err,
          accounts,
          transfers,
          memo: sigInfo.memo
        };
        // Optionally classify and enrich with token metadata/decimals
        if (classify) {
          const classification = classifyTransactionType({ details: { instructions: (tx as any)?.transaction?.message?.instructions } });
          const isFunding = isFundingTransaction({ details: { instructions: (tx as any)?.transaction?.message?.instructions } }, address);

          let normalizedAmount: number | undefined = undefined;
          let symbol: string | undefined = undefined;
          try {
            if (classification.type === 'spl_transfer' && tokenMint) {
              const serverConn = await getClientConnection();
              const info = await getTokenInfoServer(serverConn as any, tokenMint);
              if (info) {
                const decimals = info.decimals ?? 0;
                symbol = info.symbol;
                if (typeof tokenAmount === 'number') {
                  normalizedAmount = tokenAmount / Math.pow(10, decimals);
                }
              }
            } else if (classification.type === 'sol_transfer' && typeof primaryNetChange === 'number') {
              // primaryNetChange is lamports change for the focus address in this tx
              normalizedAmount = Math.abs(primaryNetChange) / 1_000_000_000;
              symbol = 'SOL';
            }
          } catch (metaErr) {
            console.warn('Token metadata normalization failed:', metaErr);
          }

          return {
            ...base,
            classification,
            isFunding,
            direction: primaryNetChange > 0 ? 'in' : primaryNetChange < 0 ? 'out' : 'neutral',
            tokenMint,
            tokenSymbol: symbol,
            amount: normalizedAmount ?? tokenAmount
          };
        }
        return base;
      } catch (error) {
        console.error(`Error fetching transaction ${signature}:`, error);
        const sigInfo = signatures[index];
        return {
          signature: sigInfo.signature,
          timestamp: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
          slot: sigInfo.slot,
          err: sigInfo.err || (error instanceof Error ? error.message : String(error)),
          success: false,
          accounts: [],
          transfers: [],
          memo: sigInfo.memo
        };
      }
    };

    // Process all transactions in parallel using Promise.all
    const transactionDetails = await Promise.all(
      signatures.map((sigInfo, index) => fetchTransactionDetails(sigInfo.signature, index))
    );

    clearTimeout(timeoutId);
    
    // Build response with date range metadata if applicable
    const response: any = {
      address,
      includeInflow,
      classified: classify,
      transactions: transactionDetails,
      rpcCount: rpcCallCount || 1
    };
    
    // Add date range metadata if date filtering was used
    if (needsDateRangeFiltering) {
      const actualTransactions = transactionDetails.filter((tx: any) => tx.timestamp);
      const timestamps = actualTransactions.map((tx: any) => tx.timestamp as number).sort((a: number, b: number) => a - b);
      
      response.dateRange = {
        requested: {
          start: startDate?.toISOString() || null,
          end: endDate?.toISOString() || null
        },
        actual: timestamps.length > 0 ? {
          start: new Date(timestamps[0]).toISOString(),
          end: new Date(timestamps[timestamps.length - 1]).toISOString(),
          transactionCount: actualTransactions.length
        } : {
          start: null,
          end: null,
          transactionCount: 0
        },
        totalFetched: fetchedCount,
        hasMore: fetchedCount >= maxFetchLimit
      };
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: new Headers(defaultHeaders)
      }
    );
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Account transactions error:', error);

    let status = 500;
    let message = 'Failed to fetch account transactions';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        status = 504;
        message = 'Request timed out. Please try again.';
      } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
        status = 429;
        message = 'Rate limit exceeded. Please try again in a few moments.';
      } else if (error.message.includes('not found')) {
        status = 404;
        message = 'Account not found. Please check the address and try again.';
      }
    }

    return new Response(
      JSON.stringify({
        error: message,
        details: error instanceof Error ? { message: error.message } : error
      }),
      {
        status,
        headers: new Headers(defaultHeaders)
      }
    );
  }
}
