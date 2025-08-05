import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionDetails } from '@/lib/solana';
import { parseInstructions } from '@/lib/instruction-parser-service';
import { analyzeAccountChanges } from '@/lib/account-changes-analyzer';
import { calculateTransactionMetrics } from '@/lib/transaction-metrics-calculator';
import { analyzeTransactionFailure } from '@/lib/transaction-failure-analyzer';
import { cacheHelpersServer } from '@/lib/transaction-cache-server';

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
  { params }: { params: Promise<{ signature: string }> }
): Promise<NextResponse<TransactionAnalysisResponse>> {
  try {
    const { signature } = await params;
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
        const accountChangesAnalysis = await analyzeAccountChanges(transaction);
        const accountChanges = accountChangesAnalysis.changedAccounts > 0 ?
          accountChangesAnalysis.solChanges.largestIncrease || accountChangesAnalysis.solChanges.largestDecrease ?
            [accountChangesAnalysis.solChanges.largestIncrease, accountChangesAnalysis.solChanges.largestDecrease].filter(Boolean) :
            [] : [];

        analysis.accountChanges = {
          changes: validatedParams.detailed ? accountChanges : accountChanges.map(change => ({
            account: change?.pubkey || '',
            type: 'sol_transfer',
            balanceChange: change?.balanceChange || 0,
            significance: change?.balanceChange ? (Math.abs(change.balanceChange) > 1e9 ? 'high' : 'medium') : 'low'
          })),
          summary: {
            accountsAffected: accountChangesAnalysis.changedAccounts,
            totalBalanceChange: accountChangesAnalysis.solChanges.totalSolChange,
            tokenTransfers: accountChangesAnalysis.tokenChanges.totalTokensAffected
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
            total: metrics.feeAnalysis.totalFee,
            breakdown: metrics.feeAnalysis.breakdown
          },
          computeUnits: {
            used: metrics.computeAnalysis.computeUnitsUsed,
            requested: metrics.computeAnalysis.totalComputeUnits,
            efficiency: metrics.computeAnalysis.computeUtilization
          },
          performance: {
            score: metrics.performance.scalability.scalabilityScore,
            recommendations: metrics.recommendations.map(rec => rec.title)
          }
        };
      } catch (error) {
        console.error('Metrics calculation failed:', error);
        analysis.metrics = {
          error: 'Failed to calculate metrics'
        };
      }
    }

    // Analyze failure if requested
    if (validatedParams.includeFailureAnalysis) {
      try {
        const failureAnalysis = await analyzeTransactionFailure(transaction);

        analysis.failureAnalysis = {
          failed: !transaction.success,
          error: failureAnalysis.errorClassification.errorMessage,
          analysis: {
            reason: failureAnalysis.rootCause.primaryCause,
            suggestions: failureAnalysis.retryRecommendations.map(rec => rec.shouldRetry ? 'Retry transaction' : 'Do not retry'),
            retryable: failureAnalysis.errorClassification.isTransient
          }
        };
      } catch (error) {
        console.error('Failure analysis failed:', error);
        analysis.failureAnalysis = {
          failed: !transaction.success,
          error: 'Failed to analyze transaction failure'
        };
      }
    }

    // Cache the analysis by storing it with the transaction
    const enrichedTransaction = {
      ...transaction,
      analysis
    };
    cacheHelpersServer.set(signature, enrichedTransaction);

    return NextResponse.json({
      success: true,
      data: {
        signature,
        analysis,
        cached: false
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Transaction analysis error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to analyze transaction',
        details: error instanceof Error ? {
          name: error.name,
          stack: error.stack
        } : error
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// POST method for more complex analysis requests
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
): Promise<NextResponse<TransactionAnalysisResponse>> {
  try {
    const data = await request.json();
    const { signature } = await params;

    // Validate signature
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

    // Build analysis object based on request type
    const analysis: any = {};

    switch (data.type) {
      case 'instructions':
        try {
          const parsedInstructions = await parseInstructions(transaction);
          analysis.instructions = {
            parsed: parsedInstructions.map(inst => ({
              programId: inst.programId,
              programName: inst.programName,
              instructionType: inst.instructionType,
              description: inst.description
            })),
            summary: {
              totalInstructions: parsedInstructions.length,
              programsInvolved: [...new Set(parsedInstructions.map(inst => inst.programId))],
              instructionTypes: parsedInstructions.reduce((acc, inst) => {
                const type = inst.instructionType || 'unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            }
          };
        } catch (error) {
          analysis.instructions = { error: 'Failed to parse instructions' };
        }
        break;

      case 'account_changes':
        try {
          const accountChangesAnalysis = await analyzeAccountChanges(transaction);
          analysis.accountChanges = {
            summary: {
              accountsAffected: accountChangesAnalysis.changedAccounts,
              totalBalanceChange: accountChangesAnalysis.solChanges.totalSolChange,
              tokenTransfers: accountChangesAnalysis.tokenChanges.totalTokensAffected
            }
          };
        } catch (error) {
          analysis.accountChanges = { error: 'Failed to analyze account changes' };
        }
        break;

      case 'metrics':
        try {
          const metrics = await calculateTransactionMetrics(transaction);
          analysis.metrics = {
            fees: {
              total: metrics.feeAnalysis.totalFee,
              breakdown: metrics.feeAnalysis.breakdown
            },
            computeUnits: {
              used: metrics.computeAnalysis.computeUnitsUsed,
              requested: metrics.computeAnalysis.totalComputeUnits,
              efficiency: metrics.computeAnalysis.computeUtilization
            },
            performance: {
              score: metrics.performance.scalability.scalabilityScore,
              recommendations: metrics.recommendations.map(rec => rec.title)
            }
          };
        } catch (error) {
          analysis.metrics = { error: 'Failed to calculate metrics' };
        }
        break;

      case 'failure_analysis':
        try {
          const failureAnalysis = await analyzeTransactionFailure(transaction);
          analysis.failureAnalysis = {
            failed: !transaction.success,
            error: failureAnalysis.errorClassification.errorMessage,
            analysis: {
              reason: failureAnalysis.rootCause.primaryCause,
              suggestions: failureAnalysis.retryRecommendations.map(rec => rec.shouldRetry ? 'Retry transaction' : 'Do not retry'),
              retryable: failureAnalysis.errorClassification.isTransient
            }
          };
        } catch (error) {
          analysis.failureAnalysis = { error: 'Failed to analyze failure' };
        }
        break;

      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ANALYSIS_TYPE',
            message: 'Invalid analysis type. Supported types: instructions, account_changes, metrics, failure_analysis'
          },
          timestamp: Date.now()
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        signature: signature,
        analysis,
        cached: false
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Transaction analysis POST error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to analyze transaction',
        details: error instanceof Error ? {
          name: error.name,
          stack: error.stack
        } : error
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}