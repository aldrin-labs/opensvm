export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { sanitizeSearchQuery } from '@/lib/utils';

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');

interface TransactionResult {
  address: string;
  signature: string;
  timestamp: string | null;
  type: 'success' | 'failed';
  status: 'success' | 'failed';
  amount: number;
  balance: number | null;
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

    // Create connections for each network
    const networkConnections = networks.map(network => ({
      networkId: network.id,
      networkName: network.name,
      connection: new Connection(network.endpoints.mainnet || 'https://api.mainnet-beta.solana.com')
    }));

    // Search across all networks in parallel
    const allResults = await Promise.all(
      networkConnections.map(async ({ networkId, networkName, connection }) => {
        try {
          // Get recent transactions for the address
          const pubkey = new PublicKey(sanitizedQuery);
          const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 100 });

          // Fetch full transaction details
          const transactions = await Promise.all(
            signatures.map(async (sig) => {
              try {
                const tx = await connection.getTransaction(sig.signature, {
                  maxSupportedTransactionVersion: 0,
                });

                if (!tx || !tx.meta) return null;

                const timestamp = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null;
                const postBalance = tx.meta.postBalances[0] ?? 0;
                const preBalance = tx.meta.preBalances[0] ?? 0;
                const amount = (postBalance - preBalance) / 1e9;
                
                return {
                  address: sanitizedQuery,
                  signature: sig.signature,
                  timestamp,
                  type: tx.meta.err ? 'failed' : 'success',
                  status: tx.meta.err ? 'failed' : 'success',
                  amount: Math.abs(amount),
                  balance: postBalance / 1e9,
                  network: networkName // Add network name to the result
                } as TransactionResult;
              } catch (error) {
                console.error(`Error fetching transaction from ${networkName}:`, error);
                return null;
              }
            })
          );

          const networkResults = transactions.filter((tx): tx is TransactionResult => tx !== null);
          return networkResults;
        } catch (error) {
          console.error(`Error fetching transactions from ${networkName}:`, error);
          return [];
        }
      })
    );

    // Combine results from all networks
    let combinedResults: TransactionResult[] = allResults.flat();

    // Apply filters
    if (start) {
      combinedResults = combinedResults.filter(tx => tx.timestamp && tx.timestamp >= start);
    }
    if (end) {
      combinedResults = combinedResults.filter(tx => tx.timestamp && tx.timestamp <= end);
    }
    if (type) {
      combinedResults = combinedResults.filter(tx => tx.type === type.toLowerCase());
    }
    if (status) {
      combinedResults = combinedResults.filter(tx => tx.status === status.toLowerCase());
    }
    if (min) {
      combinedResults = combinedResults.filter(tx => tx.amount >= parseFloat(min));
    }
    if (max) {
      combinedResults = combinedResults.filter(tx => tx.amount <= parseFloat(max));
    }

    return NextResponse.json(combinedResults);
  } catch (error) {
    console.error('Error in filtered search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}