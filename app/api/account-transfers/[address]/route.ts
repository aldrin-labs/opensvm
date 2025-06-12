import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection';
import { isValidSolanaAddress } from '@/lib/utils';

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
  
  // Known spam/analytics addresses to filter out
  const SPAM_ADDRESSES = new Set([
    'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa',
    'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt', 
    'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
    'ComputeBudget111111111111111111111111111111',
    // Add other known spam/bot addresses
    '11111111111111111111111111111112', // System program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token program
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' // Associated Token program
  ]);
  
  // Process in small batches of 10 transactions to avoid connection overload
  const BATCH_SIZE = 10;
  const batches = [];
  
  for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
    batches.push(signatures.slice(i, i + BATCH_SIZE));
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (signature) => {
        let retries = 3;
        let backoff = 1000; // Start with 1s backoff
        
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
              if (SPAM_ADDRESSES.has(account) || SPAM_ADDRESSES.has(firstAccount)) {
                continue;
              }
              
              // Skip dust transactions (less than 0.001 SOL)
              if (amount < 0.001) {
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
      await new Promise(resolve => setTimeout(resolve, 100));
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 50);

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
    
    // Create a unique identifier for the "before" signature if offset > 0
    let beforeSignature = undefined;
    if (offset > 0) {
      try {
        // Try to get the signature at the previous page boundary
        const prevPageSignature = await connection.getSignaturesForAddress(
          pubkey,
          { limit: 1, until: undefined, before: undefined }
        );
        
        // If we found a valid signature and offset is greater than 0, use it as the "before" parameter
        if (prevPageSignature.length > 0 && offset > 0) {
          beforeSignature = prevPageSignature[0].signature;
          console.log(`Using pagination signature: ${beforeSignature.substring(0, 10)}...`);
        }
      } catch (paginationError) {
        console.warn('Failed to get pagination signature:', paginationError);
        // Continue without pagination if this fails
      }
    }
    
    const signatures = await connection.getSignaturesForAddress(
      pubkey,
      {
        limit,
        before: beforeSignature
      }
    );

    if (signatures.length === 0) {
      return NextResponse.json({
        data: [],
        hasMore: false
      }, { headers: corsHeaders });
    }

    console.log(`Found ${signatures.length} signatures, processing transfers`);

    // Process transactions in smaller batches
    const transfers = await fetchTransactionBatch(
      connection,
      signatures.map(s => s.signature)
    );

    console.log(`Total transfers found: ${transfers.length}`);

    return NextResponse.json({
      data: transfers,
      hasMore: signatures.length === limit,
      total: transfers.length
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
