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

    // Count transfers for this token
    const signatures = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 1000 });
    let transferCount = 0;

    for (const { signature } of signatures) {
      try {
        const tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0
        });
        if (!tx?.meta) continue;

        const transfers = tx.meta.postTokenBalances?.filter(
          balance => balance.mint === mint
        );

        if (transfers?.length) {
          transferCount++;
        }
      } catch (err) {
        console.error('Error parsing transaction:', err);
      }
    }

    return NextResponse.json({
      solBalance: balance / 1e9, // Convert lamports to SOL
      transferCount
    });
  } catch (error) {
    console.error('Error fetching account token stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account token stats' },
      { status: 500 }
    );
  }
}
