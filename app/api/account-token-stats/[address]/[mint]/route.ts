import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection-server';

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ address: string; mint: string }> }
) {
  try {
    const connection = await getConnection();
    const params = await context.params;
    const { address, mint } = await params;

    // Get SOL balance
    const balance = await connection.getBalance(new PublicKey(address));

    // Count transfers for this token - use a smaller limit and batch processing
    // to avoid timeout. Limit to 100 most recent transactions for quick response
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(address), 
      { limit: 100 }
    );
    
    let transferCount = 0;
    
    // Process transactions in batches of 10 to avoid overwhelming the RPC
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      batches.push(batch);
    }

    // Process batches in parallel with timeout protection
    const batchPromises = batches.map(async (batch) => {
      const txPromises = batch.map(async ({ signature }) => {
        try {
          const tx = await Promise.race([
            connection.getParsedTransaction(signature, {
              maxSupportedTransactionVersion: 0
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transaction fetch timeout')), 5000)
            )
          ]) as any;
          
          if (!tx?.meta) return 0;

          const transfers = tx.meta.postTokenBalances?.filter(
            (balance: any) => balance.mint === mint
          );

          return transfers?.length ? 1 : 0;
        } catch (err) {
          // Silent fail for individual transactions
          return 0;
        }
      });

      const results = await Promise.allSettled(txPromises);
      return results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
    });

    const batchResults = await Promise.allSettled(batchPromises);
    transferCount = batchResults
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);

    return NextResponse.json({
      solBalance: balance / 1e9, // Convert lamports to SOL
      transferCount,
      note: transferCount >= 100 ? 'Showing count from last 100 transactions' : undefined
    });
  } catch (error) {
    console.error('Error fetching account token stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account token stats' },
      { status: 500 }
    );
  }
}
