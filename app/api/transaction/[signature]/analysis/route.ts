import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionDetails } from '@/lib/solana';
import { parseInstructions } from '@/lib/instruction-parser-service';
import { analyzeAccountChanges } from '@/lib/account-changes-analyzer';
import { calculateTransactionMetrics } from '@/lib/transaction-metrics-calculator';
import { analyzeTransactionFailure } from '@/lib/transaction-failure-analyzer';
import { cacheHelpers } from '@/lib/transaction-cache';

// Request validation schema
const AnalysisRequestSchema = z.object({
  includeInstructions: z.boolean().optional().default(true),
  includeAccountChanges: z.boolean().optional().default(true),
  includeMetrics: z.boolean().optional().default(true),
  includeFailureAnalysis: z.boolean().optional().default(true),
  detailed: z.boolean().optional().default(false)
});

// Response interface
interface TransactionAnalysisResponse {
  success: boolean;
  data?: {
    signature: string;
    analysis: {
      instructions?: {
        parsed: any[];
        summary: {
          totalInstructions: number;
          programsInvolved: string[];
          instructionTypes: Record<string, number>;
        };
      };
      accountChanges?: {
        changes: any[];
        summary: {
          accountsAffected: number;
          totalBalanceChange: number;
          tokenTransfers: number;
        };
      };
      metrics?: {
        fees: {
          total: number;
          breakdown: Record<string, number>;
        };
        computeUnits: {
          used: number;
          requested: number;
          efficiency: number;
        };
        performance: {
          score: number;
          recommendations: string[];
        };
      };
      failureAnalysis?: {
        failed: boolean;
        error?: string;
        analysis?: {
          reason: string;
          suggestions: string[];
          retryable: boolean;
        };
      };
    };
    cached: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { signature: string } }
): Promise<NextResponse<TransactionAnalysisResponse>> {
  const startTime = Date.now();
  
  try {
    const { signature } = params;
    const { searchParams } = new URL(request.url);
    
    // Validate signature format
    if (!signature || signature.length !== 88) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid transaction signature format'
        },
        timestamp: Date.now()
      }, { status: 400 });
    }

    // Parse query parameters
    const queryParams = {
      includeInstructions: searchParams.get('includeInstructions') !== 'false',
      includeAccountChanges: searchParams.get('includeAccountChanges') !== 'false',
      includeMetrics: searchParams.get('includeMetrics') !== 'false',
      includeFailureAnalysis: searchParams.get('includeFailureAnalysis') !== 'false',
      detailed: searchParams.get('detailed') === 'true'
    };

    const validatedParams = AnalysisRequestSchema.parse(queryParams);

    // Check cache first
    const cacheKey = JSON.stringify({ signature, ...validatedParams });
    const cached = cacheHelpers.getTransaction(signature);
    
    if (cached?.analysis) {
      return NextResponse.json({
        success: true,
        data: {
          signature,
          analysis: cached.analysis,
          cached: true
        },
        timestamp: Date.now()
      });
    }

    // Fetch transaction details
    const transaction = await getTransactionDetails(signature);
    
    if (!transaction) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        },
        timestamp: Date.now()
      }, { status: 404 });
    }

    // Build analysis object
    const analysis: any = {};

    // Parse instructions if requested
    if (validatedParams.includeInstructions) {
      try {
        const parsedInstructions = await parseInstructions(transaction);
        const programsInvolved = [...new Set(parsedInstructions.map(inst => inst.programId))];
        const instructionTypes: Record<string, number> = {};
        
        parsedInstructions.forEach(inst => {
          const type = inst.instructionType || 'unknown';
          instructionTypes[type] = (instructionTypes[type] || 0) + 1;
        });

        analysis.instructions = {
          parsed: validatedParams.detailed ? parsedInstructions : parsedInstructions.map(inst => ({
            programId: inst.programId,
            programName: inst.programName,
            instructionType: inst.instructionType,
            description: inst.description
          })),
          summary: {
            totalInstructions: parsedInstructions.length,
            programsInvolved,
            instructionTypes
          }
        };
      } catch (error) {
        console.error('Instruction parsing failed:', error);
        analysis.instructions = {
          error: 'Failed to parse instructions',
          summary: {
            totalInstructions: 0,
            programsInvolved: [],
            instructionTypes: {}
          }
        };
      }
    }

    // Analyze account changes if requested
    if (validatedParams.includeAccountChanges) {
      try {
        const accountChanges = await analyzeAccountChanges(transaction);
        
        analysis.accountChanges = {
          changes: validatedParams.detailed ? accountChanges.changes : accountChanges.changes.map(change => ({
            account: change.account,
            type: change.type,
            balanceChange: change.balanceChange,
            significance: change.significance
          })),
          summary: {
            accountsAffected: accountChanges.changes.length,
            totalBalanceChange: accountChanges.changes.reduce((sum, change) => 
              sum + (change.balanceChange || 0), 0),
            tokenTransfers: accountChanges.changes.filter(change => 
              change.type === 'token_transfer').length
          }
        };
      } catch (error) {
        console.error('Account changes analysis failed:', error);
        analysis.accountChanges = {
          error: 'Failed to analyze account changes',
          summary: {
            accountsAffected: 0,
            totalBalanceChange: 0,
            tokenTransfers: 0
          }
        };
      }
    }

    // Calculate metrics if requested
    if (validatedParams.includeMetrics) {
      try {
        const metrics = await calculateTransactionMetrics(transaction);
        
        analysis.metrics = {
          fees: {
            total: metrics.totalFee,
            breakdown: metrics.feeBreakdown
          },
          computeUnits: {
            used: metrics.computeUnitsUsed,
            requested: metrics.computeUnitsRequested,
            efficiency: metrics.computeEfficiency
          },
          performance: {
            score: metrics.performance.scalability.scalabilityScore,
            recommendations: metrics.recommendations
          }
        };
      } catch (error) {
        console.error('Metrics calculation failed:', error);
        analysis.metrics = {
          error: 'Failed to calculate metrics'
        };
      }
    }

    // Analyze failure if requested and transaction failed
    if (validatedParams.includeFailureAnalysis) {
      const failed = transaction.meta?.err !== null;
      
      analysis.failureAnalysis = {
        failed
      };

      if (failed) {
        try {
          const failureAnalysis = await analyzeTransactionFailure(transaction);
          
          analysis.failureAnalysis = {
            failed: true,
            error: transaction.meta?.err,
            analysis: {
              reason: failureAnalysis.reason,
              suggestions: failureAnalysis.suggestions,
              retryable: failureAnalysis.retryable
            }
          };
        } catch (error) {
          console.error('Failure analysis failed:', error);
          analysis.failureAnalysis = {
            failed: true,
            error: transaction.meta?.err,
            analysis: {
              reason: 'Unable to analyze failure',
              suggestions: [],
              retryable: false
            }
          };
        }
      }
    }

    // Cache the result
    const enrichedTransaction = {
      ...transaction,
      analysis
    };
    
    cacheHelpers.setTransaction(signature, enrichedTransaction, 30 * 60 * 1000); // 30 minutes

    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      data: {
        signature,
        analysis,
        cached: false
      },
      timestamp: Date.now()
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'Cache-Control': 'public, max-age=1800' // 30 minutes
      }
    });

  } catch (error) {
    console.error('Transaction analysis error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// POST method for more complex analysis requests
export async function POST(
  request: NextRequest,
  { params }: { params: { signature: string } }
): Promise<NextResponse<TransactionAnalysisResponse>> {
  try {
    const { signature } = params;
    const body = await request.json();
    
    // Validate request body
    const validatedParams = AnalysisRequestSchema.parse(body);
    
    // Create a new request with query parameters
    const url = new URL(request.url);
    Object.entries(validatedParams).forEach(([key, value]) => {
      url.searchParams.set(key, value.toString());
    });
    
    const newRequest = new NextRequest(url, {
      method: 'GET',
      headers: request.headers
    });
    
    return GET(newRequest, { params });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors
        },
        timestamp: Date.now()
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}