import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection';
import { isValidSolanaAddress } from '@/lib/utils';
import { 
  MIN_TRANSFER_SOL, 
  TRANSACTION_BATCH_SIZE, 
  MAX_SIGNATURES_LIMIT, 
  MAX_RETRIES, 
  INITIAL_BACKOFF_MS, 
  BATCH_DELAY_MS,
  MAX_TRANSFER_COUNT,
  isSpamAddress,
  isAboveDustThreshold,
  MIN_WALLET_ADDRESS_LENGTH
} from '@/lib/transaction-constants';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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
  const batches = [];
  
  for (let i = 0; i < signatures.length; i += TRANSACTION_BATCH_SIZE) {
    batches.push(signatures.slice(i, i + TRANSACTION_BATCH_SIZE));
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (signature) => {
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now();

  try {
    const params = await context.params;
    const { address: rawAddress } = params;
    const address = decodeURIComponent(String(rawAddress));
    console.log(`Starting transfer fetch for ${address}`);

    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0');
    // Limit batch size to improve performance
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), MAX_SIGNATURES_LIMIT);

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
      return NextResponse.json({
        data: [],
        hasMore: false,
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

    // Sort by volume (amount) and limit to top transfers only
    const filteredAndSortedTransfers = transfers
      .filter(transfer => {
        const amount = parseFloat(transfer.tokenAmount);
        // Only include significant transfers and filter out potential trading/DEX activity
        // Simple heuristic: transfers between user wallets typically have cleaner amounts
        return isAboveDustThreshold(amount, MIN_TRANSFER_SOL) && 
               transfer.from !== transfer.to && // Prevent self-transfers
               transfer.from.length >= MIN_WALLET_ADDRESS_LENGTH && 
               transfer.to.length >= MIN_WALLET_ADDRESS_LENGTH; // Ensure full wallet addresses
      })
      .sort((a, b) => parseFloat(b.tokenAmount) - parseFloat(a.tokenAmount))
      .slice(0, MAX_TRANSFER_COUNT); // Limit to top transfers by volume

    console.log(`Filtered to top ${filteredAndSortedTransfers.length} transfers by volume`);

    // Get the last signature for pagination
    const nextPageSignature = signatures.length > 0 ? signatures[signatures.length - 1].signature : null;

    return NextResponse.json({
      data: filteredAndSortedTransfers,
      hasMore: signatures.length === limit,
      total: filteredAndSortedTransfers.length,
      originalTotal: transfers.length,
      nextPageSignature
    }, { headers: corsHeaders });

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
