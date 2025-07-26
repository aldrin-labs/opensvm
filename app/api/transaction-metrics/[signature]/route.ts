import { NextRequest, NextResponse } from 'next/server';
import { TransactionMetricsCalculator } from '@/lib/transaction-metrics-calculator';

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

    // Validate signature format
    if (!signature || signature.length < 64) {
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

    try {
      // In a real implementation, this would fetch the transaction from the blockchain
      const mockTransactionData = await generateMockTransactionData(signature);
      
      const calculator = new TransactionMetricsCalculator();
      const metrics = await calculator.calculateMetrics(mockTransactionData);

      // Build response data
      const responseData: any = {
        signature,
        metrics
      };

      // Include additional data based on query parameters
      if (include.includes('comparison')) {
        responseData.comparison = await generateComparisonData(metrics);
      }

      if (include.includes('recommendations')) {
        responseData.recommendations = generateOptimizationRecommendations(metrics);
      }

      if (include.includes('breakdown')) {
        responseData.breakdown = generateDetailedBreakdown(metrics);
      }

      if (include.includes('historical')) {
        responseData.historical = await generateHistoricalContext(signature);
      }

      return NextResponse.json({
        success: true,
        data: responseData,
        timestamp: Date.now(),
        cached: false
      });

    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'CALCULATION_FAILED', 
            message: 'Failed to calculate transaction metrics' 
          } 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Transaction metrics individual lookup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Internal server error' 
        } 
      },
      { status: 500 }
    );
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
  try {
    const { signature } = params;
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'optimize':
        // Analyze transaction and provide optimization suggestions
        const mockTransactionData = await generateMockTransactionData(signature);
        const calculator = new TransactionMetricsCalculator();
        const metrics = await calculator.calculateMetrics(mockTransactionData);

        const optimizations = {
          currentMetrics: metrics,
          optimizationOpportunities: [
            {
              category: 'compute',
              impact: 'medium',
              description: 'Reduce compute unit usage by optimizing instruction order',
              potentialSavings: {
                computeUnits: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.15),
                fee: Math.floor(metrics.feeAnalysis.totalFee * 0.1)
              }
            },
            {
              category: 'accounts',
              impact: 'low',
              description: 'Minimize writable accounts to reduce rent costs',
              potentialSavings: {
                computeUnits: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.05),
                fee: Math.floor(metrics.feeAnalysis.totalFee * 0.03)
              }
            }
          ],
          estimatedImprovement: {
            feeReduction: Math.floor(metrics.feeAnalysis.totalFee * 0.13),
            computeReduction: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.20),
            efficiencyGain: 8.5
          }
        };

        return NextResponse.json({
          success: true,
          data: optimizations,
          timestamp: Date.now()
        });

      case 'simulate_changes':
        if (!data?.changes) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Changes data is required' } },
            { status: 400 }
          );
        }

        // Simulate the impact of proposed changes
        const originalData = await generateMockTransactionData(signature);
        const calculator2 = new TransactionMetricsCalculator();
        const originalMetrics = await calculator2.calculateMetrics(originalData);

        // Apply simulated changes
        const modifiedData = { ...originalData };
        if (data.changes.computeUnitLimit) {
          modifiedData.meta.computeUnitsConsumed = Math.min(
            modifiedData.meta.computeUnitsConsumed,
            data.changes.computeUnitLimit
          );
        }
        if (data.changes.priorityFee) {
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
        const benchmarkData = await generateMockTransactionData(signature);
        const calculator3 = new TransactionMetricsCalculator();
        const transactionMetrics = await calculator3.calculateMetrics(benchmarkData);

        const benchmark = {
          transaction: transactionMetrics,
          benchmarks: {
            similar: {
              averageFee: transactionMetrics.feeAnalysis.totalFee * (0.8 + Math.random() * 0.4),
              averageCompute: transactionMetrics.computeAnalysis.computeUnitsUsed * (0.9 + Math.random() * 0.2),
              averageEfficiency: transactionMetrics.efficiency.overall * (0.95 + Math.random() * 0.1)
            },
            category: {
              averageFee: transactionMetrics.feeAnalysis.totalFee * (0.7 + Math.random() * 0.6),
              averageCompute: transactionMetrics.computeAnalysis.computeUnitsUsed * (0.8 + Math.random() * 0.4),
              averageEfficiency: transactionMetrics.efficiency.overall * (0.9 + Math.random() * 0.2)
            }
          },
          ranking: {
            feePercentile: Math.floor(Math.random() * 100),
            computePercentile: Math.floor(Math.random() * 100),
            efficiencyPercentile: Math.floor(Math.random() * 100)
          }
        };

        return NextResponse.json({
          success: true,
          data: benchmark,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Transaction metrics individual POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * Helper functions
 */

async function generateMockTransactionData(signature: string): Promise<any> {
  // Generate realistic mock transaction data
  const programTypes = ['system', 'token', 'defi', 'nft'];
  const programType = programTypes[Math.floor(Math.random() * programTypes.length)];
  
  let baseFee = 5000;
  let baseCompute = 200000;
  
  // Adjust based on program type
  switch (programType) {
    case 'defi':
      baseFee *= 3;
      baseCompute *= 2.5;
      break;
    case 'nft':
      baseFee *= 1.6;
      baseCompute *= 1.5;
      break;
    case 'token':
      baseFee *= 0.6;
      baseCompute *= 0.8;
      break;
  }

  return {
    signature,
    slot: Math.floor(Math.random() * 1000000) + 200000000,
    blockTime: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
    meta: {
      fee: Math.floor(baseFee * (0.8 + Math.random() * 0.4)),
      computeUnitsConsumed: Math.floor(baseCompute * (0.7 + Math.random() * 0.6)),
      err: null,
      preBalances: [1000000000, 500000000],
      postBalances: [999995000, 500000000],
      preTokenBalances: [],
      postTokenBalances: [],
      logMessages: [
        'Program 11111111111111111111111111111111 invoke [1]',
        'Program 11111111111111111111111111111111 success'
      ]
    },
    transaction: {
      message: {
        accountKeys: Array.from({ length: Math.floor(Math.random() * 8) + 2 }, (_, i) => ({
          pubkey: `mock_account_${i}`,
          signer: i === 0,
          writable: Math.random() < 0.5
        })),
        instructions: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
          programIdIndex: 0,
          accounts: [0, 1],
          data: `mock_instruction_data_${i}`
        }))
      }
    }
  };
}

async function generateComparisonData(metrics: any) {
  return {
    similarTransactions: {
      count: Math.floor(Math.random() * 1000) + 100,
      averageFee: metrics.feeAnalysis.totalFee * (0.9 + Math.random() * 0.2),
      averageCompute: metrics.computeAnalysis.computeUnitsUsed * (0.95 + Math.random() * 0.1),
      averageEfficiency: metrics.efficiency.overallEfficiency * (0.98 + Math.random() * 0.04)
    },
    percentileRanking: {
      fee: Math.floor(Math.random() * 100),
      compute: Math.floor(Math.random() * 100),
      efficiency: Math.floor(Math.random() * 100)
    }
  };
}

function generateOptimizationRecommendations(metrics: any) {
  const recommendations = [];

  if (metrics.efficiency.overallEfficiency < 70) {
    recommendations.push({
      type: 'efficiency',
      priority: 'high',
      title: 'Improve Transaction Efficiency',
      description: 'Consider optimizing instruction order and reducing unnecessary operations',
      impact: 'Could improve efficiency by 15-25%'
    });
  }

  if (metrics.feeAnalysis.totalFee > 10000) {
    recommendations.push({
      type: 'cost',
      priority: 'medium',
      title: 'Reduce Transaction Costs',
      description: 'Use compute budget instructions to optimize fee usage',
      impact: 'Could reduce fees by 10-20%'
    });
  }

  if (metrics.computeAnalysis.computeUnitsUsed > 800000) {
    recommendations.push({
      type: 'compute',
      priority: 'medium',
      title: 'Optimize Compute Usage',
      description: 'Break down complex operations into smaller transactions',
      impact: 'Could reduce compute units by 20-30%'
    });
  }

  return recommendations;
}

function generateDetailedBreakdown(metrics: any) {
  return {
    feeBreakdown: {
      baseFee: Math.floor(metrics.feeAnalysis.totalFee * 0.1),
      computeFee: Math.floor(metrics.feeAnalysis.totalFee * 0.7),
      priorityFee: Math.floor(metrics.feeAnalysis.totalFee * 0.2),
      rentExemption: 0
    },
    computeBreakdown: {
      instructionExecution: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.6),
      accountLoading: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.2),
      dataProcessing: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.15),
      overhead: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.05)
    },
    accountAnalysis: {
      totalAccounts: Math.floor(Math.random() * 10) + 2,
      writableAccounts: Math.floor(Math.random() * 5) + 1,
      signerAccounts: Math.floor(Math.random() * 3) + 1,
      programAccounts: Math.floor(Math.random() * 2) + 1
    }
  };
}

async function generateHistoricalContext(signature: string) {
  return {
    timeContext: {
      blockTime: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
      networkConditions: 'normal',
      averageBlockTime: 400,
      networkCongestion: Math.random() < 0.3 ? 'high' : 'normal'
    },
    trends: {
      feesTrend: Math.random() < 0.5 ? 'increasing' : 'stable',
      computeTrend: Math.random() < 0.3 ? 'increasing' : 'stable',
      volumeTrend: Math.random() < 0.4 ? 'increasing' : 'stable'
    }
  };
}

function getGradeValue(grade: string): number {
  const gradeValues: Record<string, number> = { F: 1, D: 2, C: 3, B: 4, A: 5 };
  return gradeValues[grade] || 0;
}