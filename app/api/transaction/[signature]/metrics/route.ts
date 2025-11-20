import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)
async function loadDeps() {
  const [
    { getTransactionDetails },
    { calculateTransactionMetrics }
  ] = await Promise.all([
    import('@/lib/solana'),
    import('@/lib/blockchain/transaction-metrics-calculator')
  ]);
  return { getTransactionDetails, calculateTransactionMetrics };
}

// Request validation schema
const MetricsRequestSchema = z.object({
  includeComparison: z.boolean().optional().default(false),
  includeBenchmarks: z.boolean().optional().default(false),
  includeRecommendations: z.boolean().optional().default(true),
  timeframe: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h')
});

// Test-safe JSON response helper (mirrors batch/analysis/related/explain endpoints)
function jsonResponse(
  body: any,
  init?: { status?: number; headers?: Record<string, string> }
): any {
  if (process.env.NODE_ENV === 'test') {
    return new Response(JSON.stringify(body), {
      status: init?.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    }) as any;
  }
  return NextResponse.json(body, init as any);
}

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
  { params }: { params: Promise<{ signature: string }> }
): Promise<NextResponse<TransactionMetricsResponse>> {
  const startTime = Date.now();

  try {
    const { signature } = await params;
    const { searchParams } = new URL(request.url);

    // Validate signature format
    if (!signature || signature.length !== 88) {
      return jsonResponse({
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

    // Fetch transaction details (lazy-loaded deps for Jest mocking)
    const { getTransactionDetails, calculateTransactionMetrics } = await loadDeps();
    const transaction = await getTransactionDetails(signature);

    if (!transaction) {
      return jsonResponse({
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

    // Normalize differing possible shapes (flat mock vs nested implementation)
    const totalFee = metricsResult.totalFee ?? metricsResult.feeAnalysis?.totalFee ?? 0;
    const feeBreakdown = metricsResult.feeBreakdown ?? metricsResult.feeAnalysis?.breakdown ?? {};
    const computeUnitsUsed = metricsResult.computeUnitsUsed ?? metricsResult.computeAnalysis?.computeUnitsUsed ?? 0;
    const computeUnitsRequested = metricsResult.computeUnitsRequested ?? metricsResult.computeAnalysis?.totalComputeUnits ?? 0;
    const computeEfficiency = metricsResult.computeEfficiency ?? metricsResult.computeAnalysis?.computeUtilization ??
      (computeUnitsRequested ? computeUnitsUsed / computeUnitsRequested : 0);
    const performanceScore = metricsResult.performanceScore ?? metricsResult.performance?.scalability?.scalabilityScore ?? 0;
    const perfExecutionTime = metricsResult.performance?.executionTime;
    const rawRecommendations = Array.isArray(metricsResult.recommendations) ? metricsResult.recommendations : [];
    const recommendationTitles = rawRecommendations.map((r: any) => typeof r === 'string' ? r : (r?.title ?? '')).filter(Boolean);
    const complexityOverall = metricsResult.complexity?.overall ?? 0;
    const riskFactors = Array.isArray(metricsResult.complexity?.riskFactors)
      ? metricsResult.complexity.riskFactors.map((f: any) => f?.description ?? '').filter(Boolean)
      : [];
    const securityWarnings = rawRecommendations
      .filter((r: any) => typeof r === 'object' && r?.type === 'security')
      .map((r: any) => r.title ?? '')
      .filter(Boolean);

    // Build detailed metrics object (defensive against undefined nested props)
    const metrics = {
      fees: {
        total: totalFee,
        perComputeUnit: totalFee / (computeUnitsUsed || 1),
        breakdown: {
          baseFee: feeBreakdown.baseFee ?? 0,
          priorityFee: feeBreakdown.priorityFee ?? 0,
          ...(feeBreakdown.accountRentFee && { rentExemption: feeBreakdown.accountRentFee })
        },
        ...(validatedParams.includeComparison && {
          comparison: await getFeeComparison(transaction, validatedParams.timeframe)
        })
      },
      compute: {
        unitsUsed: computeUnitsUsed,
        unitsRequested: computeUnitsRequested,
        efficiency: computeEfficiency,
        costPerUnit: totalFee / (computeUnitsUsed || 1),
        ...(validatedParams.includeComparison && {
          comparison: await getComputeComparison(transaction, validatedParams.timeframe)
        })
      },
      performance: {
        score: performanceScore,
        factors: {
          feeEfficiency: calculateFeeEfficiency({ feeAnalysis: { totalFee }, computeAnalysis: { computeUnitsUsed } }),
          computeEfficiency,
          instructionOptimization: calculateInstructionOptimization(transaction),
            accountUsage: calculateAccountUsageScore(transaction)
        },
        grade: getPerformanceGrade(performanceScore)
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
        confirmationTime: perfExecutionTime,
        networkCongestion: await getNetworkCongestionLevel(transaction.slot)
      },
      security: {
        riskScore: complexityOverall,
        factors: riskFactors,
        warnings: securityWarnings
      },
      performanceRecommendations: recommendationTitles
    };

    // Add benchmarks if requested
    let benchmarks;
    if (validatedParams.includeBenchmarks) {
      benchmarks = await getBenchmarkData(transaction, validatedParams.timeframe);
    }

    // Generate recommendations if requested
    let recommendations;
    if (validatedParams.includeRecommendations) {
      // Pass the normalized metrics object instead of the raw metricsResult (raw may lack nested structures in tests)
      recommendations = generateRecommendations(metrics, transaction);
    }

    const result = {
      signature,
      metrics,
      ...(benchmarks && { benchmarks }),
      ...(recommendations && { recommendations }),
      cached: false
    } as TransactionMetricsResponse['data'];

    const processingTime = Date.now() - startTime;

    return jsonResponse({
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

    return jsonResponse({
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
  interface Recommendation {
    category: 'fee' | 'compute' | 'structure' | 'security';
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    potentialSavings?: number;
  }
  const recommendations: Recommendation[] = [];

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
