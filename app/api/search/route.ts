export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { sanitizeSearchQuery } from '@/lib/utils';

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');

interface SearchResult {
  address: string;
  signature?: string;
  timestamp?: string | null;
  type: 'account' | 'transaction' | 'token' | 'program';
  status?: 'success' | 'failed';
  amount?: number;
  balance?: number | null;
  symbol?: string;
  name?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const min = searchParams.get('min');
    const max = searchParams.get('max');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const sanitizedQuery = sanitizeSearchQuery(query);
    if (!sanitizedQuery) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    let results: SearchResult[] = [];

    // Check if query looks like a transaction signature (64 characters, base58)
    if (sanitizedQuery.length === 64 || sanitizedQuery.length === 88) {
      try {
        const tx = await connection.getTransaction(sanitizedQuery, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (tx && tx.meta) {
          const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null;
          results.push({
            address: sanitizedQuery,
            signature: sanitizedQuery,
            timestamp,
            type: 'transaction',
            status: tx.meta.err ? 'failed' : 'success',
          });
        }
      } catch (error) {
        // Not a valid transaction, continue with other checks
        console.log('Not a valid transaction signature');
      }
    }

    // Check if query is a valid Solana address
    try {
      const pubkey = new PublicKey(sanitizedQuery);
      
      // Check account info
      const accountInfo = await connection.getAccountInfo(pubkey);
      if (accountInfo) {
        const balance = accountInfo.lamports / 1e9;
        
        // Determine account type
        let accountType: 'account' | 'program' | 'token' = 'account';
        if (accountInfo.executable) {
          accountType = 'program';
        } else if (accountInfo.data.length > 0) {
          // Could be a token account, check if it's a token mint
          try {
            const tokenResponse = await fetch(`${request.url.split('/api')[0]}/api/check-token?address=${encodeURIComponent(sanitizedQuery)}`);
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.isToken) {
                accountType = 'token';
              }
            }
          } catch (error) {
            // Ignore token check errors
          }
        }

        results.push({
          address: sanitizedQuery,
          type: accountType,
          balance: balance,
        });

        // If it's a regular account, also fetch recent transactions
        if (accountType === 'account') {
          try {
            const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 10 });
            
            // Add recent transactions to results
            for (const sig of signatures.slice(0, 5)) {
              try {
                const tx = await connection.getTransaction(sig.signature, {
                  maxSupportedTransactionVersion: 0,
                });

                if (tx && tx.meta) {
                  const timestamp = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null;
                  const postBalance = tx.meta.postBalances[0] ?? 0;
                  const preBalance = tx.meta.preBalances[0] ?? 0;
                  const amount = Math.abs((postBalance - preBalance) / 1e9);
                  
                  const txResult: SearchResult = {
                    address: sanitizedQuery,
                    signature: sig.signature,
                    timestamp,
                    type: 'transaction',
                    status: tx.meta.err ? 'failed' : 'success',
                    amount: amount,
                    balance: postBalance / 1e9,
                  };

                  // Apply filters
                  let includeResult = true;
                  if (start && timestamp && timestamp < start) includeResult = false;
                  if (end && timestamp && timestamp > end) includeResult = false;
                  if (type && txResult.type !== type.toLowerCase()) includeResult = false;
                  if (status && txResult.status !== status.toLowerCase()) includeResult = false;
                  if (min && amount < parseFloat(min)) includeResult = false;
                  if (max && amount > parseFloat(max)) includeResult = false;

                  if (includeResult) {
                    results.push(txResult);
                  }
                }
              } catch (txError) {
                // Skip failed transaction fetches
                console.log('Failed to fetch transaction details:', txError);
              }
            }
          } catch (sigError) {
            // No signatures or error fetching signatures
            console.log('No signatures found for address:', sigError);
          }
        }
      }
    } catch (error) {
      // Not a valid Solana address
      console.log('Not a valid Solana address');
    }

    // If no results found, return empty array with helpful message
    if (results.length === 0) {
      return NextResponse.json([]);
    }

    // Sort results by timestamp (newest first) when available
    results.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}