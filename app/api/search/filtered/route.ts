export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection as getServerConnection } from '@/lib/solana/solana-connection-server';
import { sanitizeSearchQuery } from '@/lib/utils';

const connection = getServerConnection();

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

    let results: TransactionResult[] = [];

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
            } as TransactionResult;
          } catch (error) {
            console.error('Error fetching transaction:', error);
            return null;
          }
        })
      );

      results = transactions.filter((tx): tx is TransactionResult => tx !== null);

      // Apply filters
      if (start) {
        results = results.filter(tx => tx.timestamp && tx.timestamp >= start);
      }
      if (end) {
        results = results.filter(tx => tx.timestamp && tx.timestamp <= end);
      }
      if (type) {
        results = results.filter(tx => tx.type === type.toLowerCase());
      }
      if (status) {
        results = results.filter(tx => tx.status === status.toLowerCase());
      }
      if (min) {
        results = results.filter(tx => tx.amount >= parseFloat(min));
      }
      if (max) {
        results = results.filter(tx => tx.amount <= parseFloat(max));
      }

    } catch (error) {
      console.error('Error fetching transactions:', error);
      // If not a valid address or other error, return empty results
      results = [];
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in filtered search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
