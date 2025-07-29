import { NextRequest, NextResponse } from 'next/server';
import { transactionFailureAnalyzer } from '@/lib/transaction-failure-analyzer';
import { getTransactionDetails } from '@/lib/solana';

export async function GET(
  request: NextRequest,
  { params }: { params: { signature: string } }
) {
  try {
    const { signature } = params;
    
    if (!signature) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_SIGNATURE',
            message: 'Transaction signature is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Validate signature format
    if (signature.length !== 88) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_SIGNATURE',
            message: 'Invalid transaction signature format' 
          } 
        },
        { status: 400 }
      );
    }

    // Get transaction details
    const transaction = await getTransactionDetails(signature);
    
    if (!transaction) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Analyze the transaction failure
    const analysis = await transactionFailureAnalyzer.analyzeFailure(transaction);

    return NextResponse.json({
      success: true,
      data: analysis,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error analyzing transaction failure:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'ANALYSIS_ERROR',
          message: 'Failed to analyze transaction failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { signature: string } }
) {
  try {
    const { signature } = params;
    const body = await request.json();
    
    if (!signature) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_SIGNATURE',
            message: 'Transaction signature is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Get configuration from request body
    const config = body.config || {};
    
    // Create analyzer with custom configuration
    const analyzer = transactionFailureAnalyzer;
    if (Object.keys(config).length > 0) {
      analyzer.updateConfig(config);
    }

    // Get transaction details
    const transaction = await getTransactionDetails(signature);
    
    if (!transaction) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Analyze the transaction failure with custom config
    const analysis = await analyzer.analyzeFailure(transaction);

    return NextResponse.json({
      success: true,
      data: analysis,
      config: analyzer.getConfig(),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error analyzing transaction failure:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'ANALYSIS_ERROR',
          message: 'Failed to analyze transaction failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}