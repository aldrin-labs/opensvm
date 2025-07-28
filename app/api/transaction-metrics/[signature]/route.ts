import { NextRequest, NextResponse } from 'next/server';
import { TransactionMetricsCalculator } from '@/lib/transaction-metrics-calculator';
import { getConnection } from '@/lib/solana';
import { isValidSignature } from '@/lib/utils';

/**
 * GET /api/transaction-metrics/[signature]
 * 
 * Get detailed metrics for a specific transaction
 * 
 * Query parameters:
 * - include: comma-separated list of additional data to include
 *   - 'comparison': include comparison with similar transactions
 *   - 'recommendations': include optimization recommendations
 *   - 'breakdown': include detailed fee and compute breakdown
 *   - 'historical': include historical context
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { signature: string } }
) {
  try {
    const { signature } = params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];

    // Validate signature format using proper utility
    if (!signature || !isValidSignature(signature)) {
      return NextResponse.json({
        error: 'Invalid transaction signature format. Must be exactly 88 characters.',
        details: {
          provided: signature,
          expectedLength: 88,
          actualLength: signature?.length || 0
        }
      }, { status: 400 });
    }

    // Get connection and fetch transaction
    const connection = await getConnection();
    const transactionData = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!transactionData) {
      return NextResponse.json({
        error: 'Transaction not found',
        details: { signature }
      }, { status: 404 });
    }

    // Calculate metrics
    const calculator = new TransactionMetricsCalculator(connection);
    const metrics = await calculator.calculateMetrics(transactionData);

    // Build response data
    const responseData: any = {
      signature,
      metrics,
      timestamp: Date.now()
    };

    // Include additional data based on query parameters
    if (include.includes('comparison')) {
      responseData.comparison = generateComparisonData(metrics, connection);
    }

    if (include.includes('recommendations')) {
      responseData.recommendations = generateOptimizationRecommendations(metrics);
    }

    if (include.includes('breakdown')) {
      responseData.breakdown = generateDetailedBreakdown(metrics, transactionData);
    }

    if (include.includes('historical')) {
      responseData.historical = await generateHistoricalContext(metrics);
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Transaction metrics error:', error);

    let status = 500;
    let message = error instanceof Error ? error.message : 'Failed to calculate transaction metrics';

    if (message.toLowerCase().includes('not found')) {
      status = 404;
    } else if (message.toLowerCase().includes('invalid')) {
      status = 400;
    } else if (message.toLowerCase().includes('rate limit')) {
      status = 429;
    }

    return NextResponse.json({
      error: message,
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }, { status });
  }
}

/**
 * POST /api/transaction-metrics/[signature]
 * 
 * Perform operations on specific transaction metrics
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { signature: string } }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for analysis

  try {
    const { signature } = params;
    const data = await request.json();

    // Validate signature format using proper utility
    if (!signature || !isValidSignature(signature)) {
      return NextResponse.json({
        error: 'Invalid transaction signature format. Must be exactly 88 characters.',
        details: {
          provided: signature,
          expectedLength: 88,
          actualLength: signature?.length || 0
        }
      }, { status: 400 });
    }

    // Get connection once and reuse it
    const connection = await getConnection();

    // Fetch transaction data once
    const transactionData = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

    if (!transactionData) {
      return NextResponse.json({
        error: 'Transaction not found',
        details: { signature }
      }, { status: 404 });
    }

    switch (data.action) {
      case 'optimize':
        const calculator = new TransactionMetricsCalculator(connection);
        const metrics = await calculator.calculateMetrics(transactionData);

        // Generate optimization suggestions based on metrics
        const optimizations = {
          currentMetrics: metrics,
          suggestions: generateOptimizationRecommendations(metrics),
          potentialSavings: {
            // Note: Real savings would require analysis of specific optimizations
            // These are placeholder values until proper optimization analysis is implemented
            fee: 0, // Would calculate based on specific optimization suggestions
            compute: 0 // Would calculate based on instruction-level analysis
          }
        };

        return NextResponse.json({ success: true, data: optimizations });

      case 'simulate_changes':
        if (!data.changes) {
          return NextResponse.json({
            error: 'Changes parameter is required for simulation',
            details: { action: data.action }
          }, { status: 400 });
        }

        // Simulate the impact of proposed changes
        const originalTransaction = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!originalTransaction) {
          return NextResponse.json({
            error: 'Transaction not found',
            details: { signature }
          }, { status: 404 });
        }

        const originalData = {
          signature,
          slot: originalTransaction.slot,
          blockTime: originalTransaction.blockTime,
          meta: originalTransaction.meta,
          transaction: originalTransaction.transaction
        };

        const calculator2 = new TransactionMetricsCalculator();
        const originalMetrics = await calculator2.calculateMetrics(originalData);

        // Apply simulated changes with proper null checks
        const modifiedData = { ...originalData };

        // Ensure meta exists and has required properties
        if (!modifiedData.meta) {
          return NextResponse.json({
            error: 'Transaction metadata is missing',
            details: { signature }
          }, { status: 500 });
        }

        // Apply compute unit changes with null safety
        if (data.changes.computeUnitLimit && modifiedData.meta.computeUnitsConsumed != null) {
          modifiedData.meta.computeUnitsConsumed = Math.min(
            modifiedData.meta.computeUnitsConsumed,
            data.changes.computeUnitLimit
          );
        }

        // Apply fee changes with null safety
        if (data.changes.priorityFee && modifiedData.meta.fee != null) {
          modifiedData.meta.fee += data.changes.priorityFee;
        }

        const simulatedMetrics = await calculator2.calculateMetrics(modifiedData);

        const simulation = {
          original: originalMetrics,
          simulated: simulatedMetrics,
          changes: data.changes,
          impact: {
            feeChange: simulatedMetrics.feeAnalysis.totalFee - originalMetrics.feeAnalysis.totalFee,
            computeChange: simulatedMetrics.computeAnalysis.computeUnitsUsed - originalMetrics.computeAnalysis.computeUnitsUsed,
            efficiencyChange: simulatedMetrics.efficiency.overall - originalMetrics.efficiency.overall,
            gradeChange: {
              from: originalMetrics.grade,
              to: simulatedMetrics.grade,
              improved: getGradeValue(simulatedMetrics.grade) > getGradeValue(originalMetrics.grade)
            }
          }
        };

        return NextResponse.json({
          success: true,
          data: simulation,
          timestamp: Date.now()
        });

      case 'benchmark':
        // Compare against similar transactions
        const benchmarkTransaction = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!benchmarkTransaction) {
          return NextResponse.json({
            error: 'Transaction not found for benchmarking',
            details: { signature }
          }, { status: 404 });
        }

        const benchmarkData = {
          signature,
          slot: benchmarkTransaction.slot,
          blockTime: benchmarkTransaction.blockTime,
          meta: benchmarkTransaction.meta,
          transaction: benchmarkTransaction.transaction
        };

        const calculator3 = new TransactionMetricsCalculator(connection);
        const benchmarkMetrics = await calculator3.calculateMetrics(benchmarkData);

        // Generate benchmark comparison
        const benchmark = {
          transaction: benchmarkMetrics,
          comparison: generateComparisonData(benchmarkMetrics, connection),
          performance: {
            efficiency: benchmarkMetrics.efficiency.overall,
            feeEfficiency: benchmarkMetrics.feeAnalysis.totalFee <= 10000 ? 'excellent' : 'average',
            computeEfficiency: benchmarkMetrics.computeAnalysis.computeUnitsUsed <= 200000 ? 'excellent' : 'average'
          }
        };

        return NextResponse.json(benchmark);

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: optimize, simulate_changes, benchmark',
          details: {
            provided: data.action,
            supported: ['optimize', 'simulate_changes', 'benchmark']
          }
        }, { status: 400 });
    }

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Transaction metrics analysis error:', error);

    let status = 500;
    let message = error instanceof Error ? error.message : 'Failed to analyze transaction metrics';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        status = 504;
        message = 'Request timed out. Please try again.';
      } else if (message.toLowerCase().includes('not found')) {
        status = 404;
      } else if (message.toLowerCase().includes('invalid')) {
        status = 400;
      } else if (message.toLowerCase().includes('rate limit')) {
        status = 429;
      }
    }

    return NextResponse.json({
      error: message,
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }, { status });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Helper functions
 */

function generateComparisonData(metrics: any, connection: any) {
  // Note: For true comparison, we would need to query similar transactions
  // This is a simplified version that uses the metrics themselves as baseline
  return {
    similarTransactions: {
      count: 0, // Would need to query for actual similar transactions
      averageFee: metrics.feeAnalysis.totalFee, // Use actual fee as baseline
      averageCompute: metrics.computeAnalysis.computeUnitsUsed, // Use actual compute as baseline
      averageEfficiency: metrics.efficiency.overall // Use actual efficiency as baseline
    },
    percentiles: {
      // Note: Real percentiles would require historical transaction data
      // Currently returning null until proper data source is implemented
      fee: null, // Would calculate from historical fee data
      compute: null // Would calculate from historical compute data
    },
    ranking: {
      fee: metrics.feeAnalysis.totalFee <= 5000 ? 'efficient' : metrics.feeAnalysis.totalFee <= 20000 ? 'average' : 'expensive',
      compute: metrics.computeAnalysis.computeUnitsUsed <= 100000 ? 'efficient' : metrics.computeAnalysis.computeUnitsUsed <= 500000 ? 'average' : 'heavy',
      overall: metrics.efficiency.overall >= 80 ? 'excellent' : metrics.efficiency.overall >= 60 ? 'good' : metrics.efficiency.overall >= 40 ? 'average' : 'poor'
    }
  };
}

function generateOptimizationRecommendations(metrics: any) {
  const recommendations = [];

  // Analyze efficiency and generate real recommendations
  if (metrics.efficiency.overall < 70) {
    recommendations.push({
      category: 'efficiency',
      priority: 'high',
      title: 'Improve overall transaction efficiency',
      description: `Current efficiency is ${metrics.efficiency.overall.toFixed(1)}%. Consider optimizing instruction order and reducing compute usage.`,
      impact: 'Could improve efficiency by up to 15-25% with proper optimization'
    });
  }

  // Analyze fee structure
  if (metrics.feeAnalysis.totalFee > 20000) {
    recommendations.push({
      category: 'fee',
      priority: 'medium',
      title: 'Reduce transaction fees',
      description: `Current fee of ${metrics.feeAnalysis.totalFee} lamports is above average. Consider optimizing account usage and instruction count.`,
      impact: `Potential savings of ${Math.floor(metrics.feeAnalysis.totalFee * 0.1)} lamports per transaction`
    });
  }

  // Analyze compute usage
  if (metrics.computeAnalysis.computeUnitsUsed > 500000) {
    recommendations.push({
      category: 'compute',
      priority: 'high',
      title: 'Optimize compute unit usage',
      description: `Using ${metrics.computeAnalysis.computeUnitsUsed} compute units. Consider reducing instruction complexity.`,
      impact: `Could save ${Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.15)} compute units`
    });
  }

  // Analyze instruction efficiency
  if (metrics.instructionAnalysis && metrics.instructionAnalysis.instructionCount > 10) {
    recommendations.push({
      category: 'instructions',
      priority: 'medium',
      title: 'Reduce instruction count',
      description: `Transaction contains ${metrics.instructionAnalysis.instructionCount} instructions. Consider batching or combining operations.`,
      impact: 'Could reduce complexity and improve execution time'
    });
  }

  return recommendations;
}

function generateDetailedBreakdown(metrics: any, transactionData?: any) {
  let writableAccounts = 0;
  let signerAccounts = 0;

  if (transactionData && transactionData.transaction && transactionData.transaction.message && transactionData.transaction.message.accountKeys) {
    const accountKeys = transactionData.transaction.message.accountKeys;
    writableAccounts = accountKeys.filter((acc: any) => acc.isWritable || acc.writable).length;
    signerAccounts = accountKeys.filter((acc: any) => acc.isSigner || acc.signer).length;
  }

  // Get the actual fee from transaction metadata
  const actualFee = transactionData?.meta?.fee || metrics.feeAnalysis.totalFee;

  return {
    feeBreakdown: {
      // Note: Real fee breakdown would require analysis of Solana fee structure
      // Currently showing total fee until proper breakdown analysis is implemented
      totalFee: actualFee,
      baseFee: null, // Would calculate based on signature validation cost
      computeFee: null, // Would calculate based on compute units consumed
      priorityFee: null, // Would extract from transaction compute budget instructions
      rentExemption: 0 // Available from transaction data
    },
    computeBreakdown: {
      // Note: Real compute breakdown would require instruction-level analysis
      // Currently showing total until proper analysis is implemented
      totalCompute: metrics.computeAnalysis.computeUnitsUsed,
      instructionExecution: null, // Would analyze each instruction's compute cost
      accountLoading: null, // Would calculate based on account access patterns
      dataProcessing: null, // Would analyze data serialization/deserialization
      overhead: null // Would calculate system overhead
    },
    accountAnalysis: {
      totalAccounts: metrics.complexity?.indicators?.accountCount || 0,
      writableAccounts,
      signerAccounts,
      programAccounts: metrics.complexity?.indicators?.uniqueProgramCount || 0
    }
  };
}

async function generateHistoricalContext(metrics: any) {
  // Note: Real historical context would require integration with:
  // - Time/date APIs for actual timestamp
  // - Market data APIs for SOL price and volatility
  // - Network monitoring for real-time TPS and congestion
  // Currently returning null until proper data sources are implemented

  return {
    timeContext: null, // Would fetch actual day/hour from timestamp
    marketContext: null, // Would fetch real SOL price and volatility data
    networkContext: null // Would fetch real network metrics (TPS, block time, congestion)
  };
}

function getGradeValue(grade: string): number {
  const gradeValues: Record<string, number> = { F: 1, D: 2, C: 3, B: 4, A: 5 };
  return gradeValues[grade] || 0;
}