import { NextRequest, NextResponse } from 'next/server';
import { TransactionMetricsCalculator } from '@/lib/transaction-metrics-calculator';

/**
 * GET /api/transaction-metrics
 * 
 * Query parameters:
 * - signature: Transaction signature to calculate metrics for
 * - action: 'calculate' | 'compare' | 'benchmark'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'calculate';
    const signature = searchParams.get('signature');

    switch (action) {
      case 'calculate':
        if (!signature) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_SIGNATURE', message: 'Transaction signature is required' } },
            { status: 400 }
          );
        }

        try {
          // In a real implementation, this would fetch the transaction from the blockchain
          // For now, we'll return a mock response structure
          const mockTransactionData = await generateMockTransactionData(signature);
          
          const calculator = new TransactionMetricsCalculator();
          const metrics = await calculator.calculateMetrics(mockTransactionData);

          return NextResponse.json({
            success: true,
            data: metrics,
            timestamp: Date.now()
          });
        } catch (error) {
          return NextResponse.json(
            { success: false, error: { code: 'CALCULATION_FAILED', message: 'Failed to calculate metrics' } },
            { status: 500 }
          );
        }

      case 'benchmark':
        // Return benchmark data for comparison
        const benchmarkData = {
          averageMetrics: {
            totalFee: 5000, // lamports
            computeUnitsUsed: 200000,
            efficiency: 75,
            complexity: 'medium',
            grade: 'B'
          },
          percentiles: {
            fee: {
              p25: 2500,
              p50: 5000,
              p75: 10000,
              p90: 25000,
              p95: 50000
            },
            computeUnits: {
              p25: 100000,
              p50: 200000,
              p75: 400000,
              p90: 800000,
              p95: 1200000
            },
            efficiency: {
              p25: 60,
              p50: 75,
              p75: 85,
              p90: 92,
              p95: 96
            }
          },
          categories: {
            system: { avgFee: 2500, avgCompute: 50000, avgEfficiency: 90 },
            token: { avgFee: 3000, avgCompute: 75000, avgEfficiency: 85 },
            defi: { avgFee: 15000, avgCompute: 500000, avgEfficiency: 70 },
            nft: { avgFee: 8000, avgCompute: 200000, avgEfficiency: 75 },
            governance: { avgFee: 5000, avgCompute: 150000, avgEfficiency: 80 }
          }
        };

        return NextResponse.json({
          success: true,
          data: benchmarkData,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Transaction metrics API error:', error);
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
 * POST /api/transaction-metrics
 * 
 * For bulk metrics calculations and comparisons
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'bulk_calculate':
        if (!data?.signatures || !Array.isArray(data.signatures)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Signatures array is required' } },
            { status: 400 }
          );
        }

        const calculator = new TransactionMetricsCalculator();
        const bulkResults = await Promise.all(
          data.signatures.map(async (signature: string) => {
            try {
              const mockTransactionData = await generateMockTransactionData(signature);
              const metrics = await calculator.calculateMetrics(mockTransactionData);
              
              return {
                signature,
                success: true,
                metrics
              };
            } catch (error) {
              return {
                signature,
                success: false,
                error: error instanceof Error ? error.message : 'Calculation failed'
              };
            }
          })
        );

        // Calculate aggregate statistics
        const successfulResults = bulkResults.filter(r => r.success);
        const aggregateStats = {
          totalTransactions: bulkResults.length,
          successfulCalculations: successfulResults.length,
          failedCalculations: bulkResults.length - successfulResults.length,
          averageFee: successfulResults.reduce((sum, r) => sum + (r.metrics?.feeAnalysis.totalFee || 0), 0) / successfulResults.length,
          averageComputeUnits: successfulResults.reduce((sum, r) => sum + (r.metrics?.computeAnalysis.computeUnitsUsed || 0), 0) / successfulResults.length,
          averageEfficiency: successfulResults.reduce((sum, r) => sum + (r.metrics?.efficiency.overallEfficiency || 0), 0) / successfulResults.length,
          gradeDistribution: {
            A: successfulResults.filter(r => r.metrics?.grade === 'A').length,
            B: successfulResults.filter(r => r.metrics?.grade === 'B').length,
            C: successfulResults.filter(r => r.metrics?.grade === 'C').length,
            D: successfulResults.filter(r => r.metrics?.grade === 'D').length,
            F: successfulResults.filter(r => r.metrics?.grade === 'F').length
          }
        };

        return NextResponse.json({
          success: true,
          data: {
            results: bulkResults,
            aggregateStats
          },
          timestamp: Date.now()
        });

      case 'compare':
        if (!data?.signatures || !Array.isArray(data.signatures) || data.signatures.length < 2) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'At least 2 signatures are required for comparison' } },
            { status: 400 }
          );
        }

        const calculator2 = new TransactionMetricsCalculator();
        const comparisonResults = await Promise.all(
          data.signatures.map(async (signature: string) => {
            const mockTransactionData = await generateMockTransactionData(signature);
            return {
              signature,
              metrics: await calculator2.calculateMetrics(mockTransactionData)
            };
          })
        );

        // Generate comparison analysis
        const comparison = {
          transactions: comparisonResults,
          analysis: {
            mostEfficient: comparisonResults.reduce((best, current) => 
              (current.metrics.efficiency.overallEfficiency > best.metrics.efficiency.overallEfficiency) ? current : best
            ),
            leastEfficient: comparisonResults.reduce((worst, current) => 
              (current.metrics.efficiency.overallEfficiency < worst.metrics.efficiency.overallEfficiency) ? current : worst
            ),
            cheapest: comparisonResults.reduce((cheapest, current) => 
              (current.metrics.feeAnalysis.totalFee < cheapest.metrics.feeAnalysis.totalFee) ? current : cheapest
            ),
            mostExpensive: comparisonResults.reduce((expensive, current) => 
              (current.metrics.feeAnalysis.totalFee > expensive.metrics.feeAnalysis.totalFee) ? current : expensive
            ),
            averages: {
              fee: comparisonResults.reduce((sum, r) => sum + r.metrics.feeAnalysis.totalFee, 0) / comparisonResults.length,
              computeUnits: comparisonResults.reduce((sum, r) => sum + r.metrics.computeAnalysis.computeUnitsUsed, 0) / comparisonResults.length,
              efficiency: comparisonResults.reduce((sum, r) => sum + r.metrics.efficiency.overallEfficiency, 0) / comparisonResults.length
            },
            differences: {
              maxFeeSpread: Math.max(...comparisonResults.map(r => r.metrics.feeAnalysis.totalFee)) - 
                           Math.min(...comparisonResults.map(r => r.metrics.feeAnalysis.totalFee)),
              maxComputeSpread: Math.max(...comparisonResults.map(r => r.metrics.computeAnalysis.computeUnitsUsed)) - 
                               Math.min(...comparisonResults.map(r => r.metrics.computeAnalysis.computeUnitsUsed)),
              maxEfficiencySpread: Math.max(...comparisonResults.map(r => r.metrics.efficiency.overallEfficiency)) - 
                                  Math.min(...comparisonResults.map(r => r.metrics.efficiency.overallEfficiency))
            }
          }
        };

        return NextResponse.json({
          success: true,
          data: comparison,
          timestamp: Date.now()
        });

      case 'analyze_trends':
        if (!data?.transactions || !Array.isArray(data.transactions)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Transactions array is required' } },
            { status: 400 }
          );
        }

        // Analyze trends over time
        const trendAnalysis = {
          timeRange: {
            start: Math.min(...data.transactions.map((tx: any) => tx.blockTime || 0)),
            end: Math.max(...data.transactions.map((tx: any) => tx.blockTime || 0))
          },
          trends: {
            feesTrend: calculateTrend(data.transactions.map((tx: any) => tx.fee || 0)),
            computeTrend: calculateTrend(data.transactions.map((tx: any) => tx.computeUnits || 0)),
            complexityTrend: calculateComplexityTrend(data.transactions),
            volumeTrend: calculateVolumeTrend(data.transactions)
          },
          insights: generateTrendInsights(data.transactions)
        };

        return NextResponse.json({
          success: true,
          data: trendAnalysis,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Transaction metrics POST API error:', error);
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
  // Generate realistic mock transaction data for demonstration
  // In a real implementation, this would fetch from the blockchain
  return {
    signature,
    slot: Math.floor(Math.random() * 1000000) + 200000000,
    blockTime: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
    meta: {
      fee: Math.floor(Math.random() * 20000) + 5000,
      computeUnitsConsumed: Math.floor(Math.random() * 800000) + 100000,
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
        accountKeys: [
          { pubkey: 'mock_account_1', signer: true, writable: true },
          { pubkey: 'mock_account_2', signer: false, writable: true }
        ],
        instructions: [
          {
            programIdIndex: 0,
            accounts: [0, 1],
            data: 'mock_instruction_data'
          }
        ]
      }
    }
  };
}

function calculateTrend(values: number[]): { direction: 'up' | 'down' | 'stable'; change: number; confidence: number } {
  if (values.length < 2) return { direction: 'stable', change: 0, confidence: 0 };
  
  const first = values[0];
  const last = values[values.length - 1];
  const change = ((last - first) / first) * 100;
  
  return {
    direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
    change,
    confidence: Math.min(values.length / 10, 1) // Higher confidence with more data points
  };
}

function calculateComplexityTrend(transactions: any[]): { averageComplexity: number; trend: string } {
  const complexityScores = transactions.map(tx => {
    const instructionCount = tx.instructions?.length || 1;
    const accountCount = tx.accounts?.length || 2;
    return instructionCount * 2 + accountCount;
  });
  
  const average = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length;
  const trend = calculateTrend(complexityScores);
  
  return {
    averageComplexity: average,
    trend: trend.direction
  };
}

function calculateVolumeTrend(transactions: any[]): { transactionsPerHour: number; trend: string } {
  // Group transactions by hour
  const hourlyGroups: Record<string, number> = {};
  
  transactions.forEach(tx => {
    const hour = new Date((tx.blockTime || 0) * 1000).toISOString().slice(0, 13);
    hourlyGroups[hour] = (hourlyGroups[hour] || 0) + 1;
  });
  
  const hourlyCounts = Object.values(hourlyGroups);
  const averagePerHour = hourlyCounts.reduce((sum, count) => sum + count, 0) / hourlyCounts.length;
  const trend = calculateTrend(hourlyCounts);
  
  return {
    transactionsPerHour: averagePerHour,
    trend: trend.direction
  };
}

function generateTrendInsights(transactions: any[]): string[] {
  const insights: string[] = [];
  
  if (transactions.length > 100) {
    insights.push('High transaction volume detected');
  }
  
  const avgFee = transactions.reduce((sum, tx) => sum + (tx.fee || 0), 0) / transactions.length;
  if (avgFee > 10000) {
    insights.push('Above average transaction fees observed');
  }
  
  const recentTransactions = transactions.filter(tx => 
    (tx.blockTime || 0) > (Date.now() / 1000) - 3600
  );
  
  if (recentTransactions.length > transactions.length * 0.5) {
    insights.push('Increased activity in the last hour');
  }
  
  return insights;
}