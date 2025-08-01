import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionDetails } from '@/lib/solana';
import { parseInstructions } from '@/lib/instruction-parser-service';
import { analyzeAccountChanges } from '@/lib/account-changes-analyzer';
import { transactionCache } from '@/lib/transaction-cache';

// Request validation schema
const BatchRequestSchema = z.object({
  signatures: z.array(z.string().length(88)).min(1).max(50),
  includeInstructions: z.boolean().optional().default(false),
  includeAccountChanges: z.boolean().optional().default(false),
  includeMetrics: z.boolean().optional().default(false),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium')
});

// Response interface
interface BatchTransactionResponse {
  success: boolean;
  data?: {
    transactions: Array<{
      signature: string;
      transaction?: any;
      analysis?: any;
      error?: string;
      cached: boolean;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      cached: number;
      processingTime: number;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<BatchTransactionResponse>> {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const validatedParams = BatchRequestSchema.parse(body);

    const results: Array<{
      signature: string;
      transaction?: any;
      analysis?: any;
      error?: string;
      cached: boolean;
    }> = [];

    let successful = 0;
    let failed = 0;
    let cached = 0;

    // Process transactions in batches to avoid overwhelming the system
    const batchSize = validatedParams.priority === 'high' ? 10 :
      validatedParams.priority === 'medium' ? 5 : 3;

    for (let i = 0; i < validatedParams.signatures.length; i += batchSize) {
      const batch = validatedParams.signatures.slice(i, i + batchSize);

      const batchPromises = batch.map(async (signature) => {
        try {
          // Check cache first (commented out until cache methods are implemented)
          // const cachedTransaction = cacheHelpers.getTransaction(signature);
          // 
          // if (cachedTransaction) {
          //   cached++;
          //   successful++;
          //   return {
          //     signature,
          //     transaction: cachedTransaction,
          //     analysis: cachedTransaction.analysis,
          //     cached: true
          //   };
          // }

          // Fetch transaction details
          const transaction = await getTransactionDetails(signature);

          if (!transaction) {
            failed++;
            return {
              signature,
              error: 'Transaction not found',
              cached: false
            };
          }

          // Build analysis if requested
          let analysis: any = {};

          if (validatedParams.includeInstructions) {
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
                  programsInvolved: [...new Set(parsedInstructions.map(inst => inst.programId))]
                }
              };
            } catch (error) {
              analysis.instructions = { error: 'Failed to parse instructions' };
            }
          }

          if (validatedParams.includeAccountChanges) {
            try {
              const accountChangesAnalysis = await analyzeAccountChanges(transaction);
              analysis.accountChanges = {
                changes: accountChangesAnalysis.changedAccounts > 0 ?
                  accountChangesAnalysis.solChanges.largestIncrease || accountChangesAnalysis.solChanges.largestDecrease ?
                    [accountChangesAnalysis.solChanges.largestIncrease, accountChangesAnalysis.solChanges.largestDecrease].filter(Boolean).map(change => ({
                      account: change?.pubkey || '',
                      type: 'sol_transfer',
                      balanceChange: change?.balanceChange || 0,
                      significance: 'high'
                    })) : [] : [],
                summary: {
                  accountsAffected: accountChangesAnalysis.changedAccounts,
                  totalBalanceChange: accountChangesAnalysis.solChanges.totalSolChange
                }
              };
            } catch (error) {
              analysis.accountChanges = { error: 'Failed to analyze account changes' };
            }
          }

          // Cache the result (commented out until cache methods are implemented)
          // const enrichedTransaction = {
          //   ...transaction,
          //   analysis: Object.keys(analysis).length > 0 ? analysis : undefined
          // };
          // 
          // cacheHelpers.setTransaction(signature, enrichedTransaction, 30 * 60 * 1000); // 30 minutes

          successful++;
          return {
            signature,
            transaction: transaction,
            analysis: Object.keys(analysis).length > 0 ? analysis : undefined,
            cached: false
          };

        } catch (error) {
          failed++;
          return {
            signature,
            error: error instanceof Error ? error.message : 'Unknown error',
            cached: false
          };
        }
      });

      // Wait for current batch to complete before processing next batch
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failed++;
          results.push({
            signature: 'unknown',
            error: result.reason?.message || 'Batch processing failed',
            cached: false
          });
        }
      });

      // Add small delay between batches to prevent overwhelming the system
      if (i + batchSize < validatedParams.signatures.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        transactions: results,
        summary: {
          total: validatedParams.signatures.length,
          successful,
          failed,
          cached,
          processingTime
        }
      },
      timestamp: Date.now()
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'X-Batch-Size': validatedParams.signatures.length.toString(),
        'Cache-Control': 'public, max-age=1800' // 30 minutes
      }
    });

  } catch (error) {
    console.error('Batch transaction processing error:', error);

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
        code: 'BATCH_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// GET method for batch status/queue information
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const cacheStats = transactionCache.getStats();

    return NextResponse.json({
      success: true,
      data: {
        batchLimits: {
          maxSignatures: 50,
          maxBatchSize: 10,
          rateLimits: {
            low: '100 requests/hour',
            medium: '500 requests/hour',
            high: '1000 requests/hour'
          }
        },
        cacheStatus: {
          hitRate: cacheStats.size / cacheStats.maxSize,
          totalEntries: cacheStats.size,
          memoryUsage: cacheStats.memoryUsage
        },
        supportedAnalysis: {
          instructions: 'Parse and categorize transaction instructions',
          accountChanges: 'Analyze account state changes',
          metrics: 'Calculate transaction performance metrics',
          failureAnalysis: 'Analyze failed transactions'
        }
      },
      timestamp: Date.now()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Failed to get batch processing status'
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}