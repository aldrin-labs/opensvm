import { NextRequest, NextResponse } from 'next/server';
import { aiTransactionAnalyzer } from '@/lib/ai/ai-transaction-analyzer';
import type { DetailedTransactionInfo } from '@/lib/solana/solana';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction, options } = body;

    if (!transaction || !transaction.signature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      );
    }

    // Analyze the transaction
    const explanation = await aiTransactionAnalyzer.analyzeTransaction(
      transaction as DetailedTransactionInfo,
      options || {}
    );

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transaction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const signature = searchParams.get('signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      );
    }

    // Get cached explanation
    const explanation = await aiTransactionAnalyzer.getCachedExplanation(signature);

    if (!explanation) {
      return NextResponse.json(
        { error: 'No cached explanation found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error('Cache lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve cached explanation' },
      { status: 500 }
    );
  }
}
