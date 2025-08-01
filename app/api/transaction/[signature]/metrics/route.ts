import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionDetails } from '@/lib/solana';
import { calculateTransactionMetrics } from '@/lib/transaction-metrics-calculator';

// Request validation schema
const MetricsRequestSchema = z.object({
  includeComparison: z.boolean().optional().default(false),
  includeBenchmarks: z.boolean().optional().default(false),
  includeRecommendations: z.boolean().optional().default(true),
  timeframe: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h')
});

// Response interface
interface TransactionMetricsResponse {
  success: boolean;
  data?: {
    signature: string;
    metrics: {
      fees: {
        total: number;
        perComputeUnit: number;
        breakdown: {
          baseFee: number;
          priorityFee: number;
          rentExemption?: number;
        };
        comparison?: {
          percentile: number;
          averageForSimilar: number;
          medianForSimilar: number;
        };
      };
      compute: {
        unitsUsed: number;
        unitsRequested: number;
        efficiency: number;
        costPerUnit: number;
        comparison?: {
          percentile: number;
          averageForSimilar: number;
          medianForSimilar: number;
        };
      };
      performance: {
        score: number; // 0-100
        factors: {
          feeEfficiency: number;
          computeEfficiency: number;
          instructionOptimization: number;
          accountUsage: number;
        };
        grade: 'A' | 'B' | 'C' | 'D' | 'F';
      };
      complexity: {
        instructionCount: number;
        accountCount: number;
        programCount: number;
        dataSize: number;
        complexityScore: number; // 0-100
      };
      timing: {
        slot: number;
        blockTime: number;
        confirmationTime?: number;
        networkCongestion?: 'low' | 'medium' | 'high';
      };
      security: {
        riskScore: number; // 0-100
        factors: string[];
        warnings: string[];
      };
    };
    benchmarks?: {
      similarTransactions: {
        count: number;
        averageFee: number;
        averageComputeUnits: number;
        averagePerformanceScore: number;
      };
      networkAverages: {
        averageFee: number;
        averageComputeUnits: number;
        averageInstructions: number;
      };
    };
    recommendations?: Array<{
      category: 'fee' | 'compute' | 'structure' | 'security';
      priority: 'low' | 'medium' | 'high';
      title: string;
      description: string;
      potentialSavings?: number;
    }>;
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
): Promise<NextResponse<TransactionMetricsResponse>> {
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
      includeComparison: searchParams.get('includeComparison') === 'true',
      includeBenchmarks: searchParams.get('includeBenchmarks') === 'true',
      includeRecommendations: searchParams.get('includeRecommendations') !== 'false',
      timeframe: (searchParams.get('timeframe') || '24h') as '1h' | '24h' | '7d' | '30d'
    };

    const validatedParams = MetricsRequestSchema.parse(queryParams);

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

    // Calculate comprehensive metrics
    const metricsResult = await calculateTransactionMetrics(transaction);

    // Build detailed metrics object
    const metrics: TransactionMetricsResponse['data']['metrics'] = {
      fees: {
        total: metricsResult.feeAnalysis.totalFee,
        perComputeUnit: metricsResult.feeAnalysis.totalFee / (metricsResult.computeAnalysis.computeUnitsUsed || 1),
        breakdown: {
          baseFee: metricsResult.feeAnalysis.breakdown.baseFee,
          priorityFee: metricsResult.feeAnalysis.breakdown.priorityFee,
          ...(metricsResult.feeAnalysis.breakdown.accountRentFee && {
            rentExemption: metricsResult.feeAnalysis.breakdown.accountRentFee
          })
        },
        ...(validatedParams.includeComparison && {
          comparison: await getFeeComparison(transaction, validatedParams.timeframe)
        })
      },
      compute: {
        unitsUsed: metricsResult.computeAnalysis.computeUnitsUsed,
        unitsRequested: metricsResult.computeAnalysis.totalComputeUnits,
        efficiency: metricsResult.computeAnalysis.computeUtilization,
        costPerUnit: metricsResult.feeAnalysis.totalFee / (metricsResult.computeAnalysis.computeUnitsUsed || 1),
        ...(validatedParams.includeComparison && {
          comparison: await getComputeComparison(transaction, validatedParams.timeframe)
        })
      },
      performance: {
        score: metricsResult.performance.scalability.scalabilityScore,
        factors: {
          feeEfficiency: calculateFeeEfficiency(metricsResult),
          computeEfficiency: metricsResult.computeAnalysis.computeUtilization,
          instructionOptimization: calculateInstructionOptimization(transaction),
          accountUsage: calculateAccountUsageScore(transaction)
        },
        grade: getPerformanceGrade(metricsResult.overallScore)
      },
      complexity: {
        instructionCount: transaction.transaction?.message?.instructions?.length || 0,
        accountCount: transaction.transaction?.message?.accountKeys?.length || 0,
        programCount: getUniqueProgramCount(transaction),
        dataSize: calculateTransactionDataSize(transaction),
        complexityScore: calculateComplexityScore(transaction)
      },
      timing: {
        slot: transaction.slot,
        blockTime: transaction.blockTime || 0,
        confirmationTime: metricsResult.performance.executionTime,
        networkCongestion: await getNetworkCongestionLevel(transaction.slot)
      },
      security: {
        riskScore: metricsResult.complexity.overall,
        factors: metricsResult.complexity.riskFactors.map(factor => factor.description),
        warnings: metricsResult.recommendations.filter(rec => rec.type === 'security').map(rec => rec.title)
      }
    };

    // Add benchmarks if requested
    let benchmarks;
    if (validatedParams.includeBenchmarks) {
      benchmarks = await getBenchmarkData(transaction, validatedParams.timeframe);
    }

    // Generate recommendations if requested
    let recommendations;
    if (validatedParams.includeRecommendations) {
      recommendations = generateRecommendations(metricsResult, transaction);
    }

    const result = {
      signature,
      metrics,
      ...(benchmarks && { benchmarks }),
      ...(recommendations && { recommendations }),
      cached: false
    } as TransactionMetricsResponse['data'];

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: Date.now()
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'Cache-Control': 'public, max-age=3600' // 1 hour
      }
    });

  } catch (error) {
    console.error('Transaction metrics error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// Helper functions

async function getFeeComparison(transaction: any, _timeframe: string) {
  // This would typically query a database of recent transactions
  // For now, return mock data
  return {
    percentile: 65,
    averageForSimilar: transaction.meta?.fee * 1.2,
    medianForSimilar: transaction.meta?.fee * 0.9
  };
}

async function getComputeComparison(transaction: any, _timeframe: string) {
  const computeUnits = transaction.meta?.computeUnitsConsumed || 0;
  return {
    percentile: 45,
    averageForSimilar: computeUnits * 1.1,
    medianForSimilar: computeUnits * 0.95
  };
}

function calculateFeeEfficiency(metrics: any): number {
  // Calculate fee efficiency based on compute units used vs fee paid
  const feePerComputeUnit = metrics.feeAnalysis.totalFee / (metrics.computeAnalysis.computeUnitsUsed || 1);
  const baselineEfficiency = 0.000005; // 5 lamports per compute unit baseline

  return Math.max(0, Math.min(100, (baselineEfficiency / feePerComputeUnit) * 100));
}

function calculateInstructionOptimization(transaction: any): number {
  const instructions = transaction.transaction.message.instructions;
  const accounts = transaction.transaction.message.accountKeys;

  // Simple heuristic: fewer instructions per account is better
  const ratio = instructions.length / accounts.length;
  return Math.max(0, Math.min(100, (1 / ratio) * 50));
}

function calculateAccountUsageScore(transaction: any): number {
  const accounts = transaction.transaction.message.accountKeys;
  const instructions = transaction.transaction.message.instructions;

  // Calculate how efficiently accounts are used across instructions
  const accountUsage = new Map();
  instructions.forEach((inst: any) => {
    inst.accounts?.forEach((accountIndex: number) => {
      accountUsage.set(accountIndex, (accountUsage.get(accountIndex) || 0) + 1);
    });
  });

  const averageUsage = Array.from(accountUsage.values()).reduce((a, b) => a + b, 0) / accounts.length;
  return Math.min(100, averageUsage * 25);
}

function getPerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getUniqueProgramCount(transaction: any): number {
  const programs = new Set();
  transaction.transaction.message.instructions.forEach((inst: any) => {
    programs.add(transaction.transaction.message.accountKeys[inst.programIdIndex]);
  });
  return programs.size;
}

function calculateTransactionDataSize(transaction: any): number {
  return JSON.stringify(transaction).length;
}

function calculateComplexityScore(transaction: any): number {
  const instructions = transaction.transaction.message.instructions.length;
  const accounts = transaction.transaction.message.accountKeys.length;
  const programs = getUniqueProgramCount(transaction);

  // Weighted complexity score
  return Math.min(100, (instructions * 2 + accounts + programs * 3) / 2);
}

async function getNetworkCongestionLevel(_slot: number): Promise<'low' | 'medium' | 'high'> {
  // This would typically query network metrics
  // For now, return a mock value
  return 'low';
}

async function getBenchmarkData(transaction: any, _timeframe: string) {
  // This would typically query a database of similar transactions
  // For now, return mock data
  return {
    similarTransactions: {
      count: 150,
      averageFee: transaction.meta?.fee * 0.9,
      averageComputeUnits: transaction.meta?.computeUnitsConsumed * 1.1,
      averagePerformanceScore: 75
    },
    networkAverages: {
      averageFee: 5000,
      averageComputeUnits: 200000,
      averageInstructions: 3
    }
  };
}

function generateRecommendations(metrics: any, _transaction: any) {
  const recommendations = [];

  // Fee optimization recommendations
  if (metrics.performance.factors.feeEfficiency < 50) {
    recommendations.push({
      category: 'fee' as const,
      priority: 'medium' as const,
      title: 'Optimize transaction fees',
      description: 'Consider batching instructions or using priority fees strategically',
      potentialSavings: 1000
    });
  }

  // Compute optimization recommendations
  if (metrics.compute.efficiency < 70) {
    recommendations.push({
      category: 'compute' as const,
      priority: 'high' as const,
      title: 'Reduce compute unit usage',
      description: 'Optimize instruction sequence to reduce compute consumption',
      potentialSavings: 2000
    });
  }

  // Structure optimization recommendations
  if (metrics.complexity.complexityScore > 80) {
    recommendations.push({
      category: 'structure' as const,
      priority: 'medium' as const,
      title: 'Simplify transaction structure',
      description: 'Consider breaking complex transactions into smaller ones',
      potentialSavings: 500
    });
  }

  // Security recommendations
  if (metrics.security.riskScore > 50) {
    recommendations.push({
      category: 'security' as const,
      priority: 'high' as const,
      title: 'Review security implications',
      description: 'Verify all account permissions and program interactions',
      potentialSavings: 0
    });
  }

  return recommendations;
}