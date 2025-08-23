import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';
import { PublicKey } from '@solana/web3.js';
import { classifyTransactionType, isFundingTransaction } from '@/lib/transaction-classifier';
import { getConnection as getClientConnection } from '@/lib/solana-connection-server';
import { getTokenInfoServer } from '@/lib/server/token-metadata-cache';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS(request: NextRequest) {
  const { getCorsHeaders } = await import('@/lib/cors-utils');
  const corsHeaders = getCorsHeaders(request);
  
  return new Response(null, {
    status: 200,
    headers: new Headers({
      ...defaultHeaders,
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    })
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  // Get secure CORS headers
  const { getCorsHeaders } = await import('@/lib/cors-utils');
  const corsHeaders = getCorsHeaders(request);
  const secureHeaders = { ...secureHeaders, ...corsHeaders };

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

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Account address is required' }),
        {
          status: 400,
          headers: new Headers(secureHeaders)
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
          headers: new Headers(secureHeaders)
        }
      );
    }

    // Get connection from pool
    const connection = await getConnection();

    // Fetch signatures for the account
    let signatures = await connection.getSignaturesForAddress(new PublicKey(address), {
      limit,
      before,
      until
    }, 'confirmed');

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
    const fetchTransactionDetails = async (signature: string, index: number) => {
      // Get a separate connection for each transaction to maximize parallelism
      const txConnection = await getConnection();

      try {
        const tx = await txConnection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        // Get accounts involved in this transaction
        const accounts = tx?.transaction.message.accountKeys.map(key => ({
          pubkey: key.pubkey.toString(),
          isSigner: key.signer,
          isWritable: key.writable
        })) || [];

        // Calculate transaction flow
        const transfers = [];
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

    return new Response(
      JSON.stringify({
        address,
        includeInflow,
        classified: classify,
        transactions: transactionDetails,
        rpcCount: 1 // Using single connection for now
      }),
      {
        status: 200,
        headers: new Headers(secureHeaders)
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
        headers: new Headers(secureHeaders)
      }
    );
  }
}
