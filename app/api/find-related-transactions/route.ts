import { NextRequest, NextResponse } from 'next/server';
import { relatedTransactionFinder } from '@/lib/related-transaction-finder';
import type { RelatedTransactionQuery } from '@/lib/related-transaction-finder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || !query.signature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      );
    }

    // Find related transactions
    const result = await relatedTransactionFinder.findRelatedTransactions(
      query as RelatedTransactionQuery
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Related transactions search error:', error);
    return NextResponse.json(
      { error: 'Failed to find related transactions' },
      { status: 500 }
    );
  }
}
