import { NextRequest, NextResponse } from 'next/server';
import { accountChangesAnalyzer } from '@/lib/blockchain/account-changes-analyzer';
import type { DetailedTransactionInfo } from '@/lib/solana/solana';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction } = body;

    if (!transaction || !transaction.signature) {
      return NextResponse.json(
        { error: 'Transaction data is required' },
        { status: 400 }
      );
    }

    // Analyze the account changes
    const analysis = await accountChangesAnalyzer.analyzeTransaction(
      transaction as DetailedTransactionInfo
    );

    // Get detailed account changes
    const accountChanges = accountChangesAnalyzer.calculateAccountChanges(
      transaction as DetailedTransactionInfo
    );

    return NextResponse.json({ analysis, accountChanges });
  } catch (error) {
    console.error('Account changes analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze account changes' },
      { status: 500 }
    );
  }
}
