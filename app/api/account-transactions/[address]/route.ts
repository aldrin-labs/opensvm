import { NextRequest } from 'next/server';
import { connectionPool, getConnection } from '@/lib/solana-connection';
import { PublicKey } from '@solana/web3.js';

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    // Extract the address parameter
    const params = await context.params;
    const { address } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    const before = url.searchParams.get('before') || undefined;
    const until = url.searchParams.get('until') || undefined;

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

    // Fetch signatures for the account
    const signatures = await connection.getSignaturesForAddress(new PublicKey(address), {
      limit,
      before,
      until
    }, 'confirmed');

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
            }
          }
        }

        const sigInfo = signatures[index];
        return {
          signature: sigInfo.signature,
          timestamp: tx?.blockTime ? tx.blockTime * 1000 : sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
          slot: sigInfo.slot,
          err: sigInfo.err, 
          success: !sigInfo.err,
          accounts,
          transfers,
          memo: sigInfo.memo
        };
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
        transactions: transactionDetails,
        rpcCount: connectionPool.getConnectionCount()
      }),
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
