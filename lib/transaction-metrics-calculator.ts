/**
 * Transaction Metrics Calculator
 * 
 * Calculates detailed metrics for Solana transactions including fee breakdown,
 * compute unit usage, efficiency scoring, and performance analysis.
 */

import type { DetailedTransactionInfo } from './solana';

// Transaction metrics interfaces
export interface TransactionMetrics {
  signature: string;
  slot: number;
  blockTime: number | null;

  // Fee Analysis
  feeAnalysis: FeeAnalysis;

  // Compute Unit Analysis
  computeAnalysis: ComputeAnalysis;

  // Efficiency Metrics
  efficiency: EfficiencyMetrics;

  // Performance Metrics
  performance: PerformanceMetrics;

  // Complexity Analysis
  complexity: ComplexityMetrics;

  // Cost Analysis
  costAnalysis: CostAnalysis;

  // Comparison Metrics
  comparison: ComparisonMetrics;

  // Overall Score
  overallScore: number; // 0-100 scale
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Recommendations
  recommendations: TransactionRecommendation[];
}

export interface FeeAnalysis {
  totalFee: number; // in lamports
  totalFeeSOL: number; // in SOL
  totalFeeUSD: number; // in USD (if price available)

  breakdown: {
    baseFee: number; // 5000 lamports base fee
    priorityFee: number; // additional priority fee
    computeFee: number; // compute unit fee
    accountRentFee: number; // rent for new accounts
    programFee: number; // program execution fees
  };

  feePerInstruction: number;
  feePerAccount: number;
  feePerComputeUnit: number;

  // Fee efficiency
  isOptimal: boolean;
  potentialSavings: number;
  feeRank: 'very_low' | 'low' | 'average' | 'high' | 'very_high';
}

export interface ComputeAnalysis {
  totalComputeUnits: number;
  computeUnitsUsed: number;
  computeUnitsRemaining: number;
  computeUtilization: number; // percentage

  breakdown: {
    instructionCompute: ComputeByInstruction[];
    programCompute: ComputeByProgram[];
    accountCompute: ComputeByAccount[];
  };

  efficiency: {
    computePerInstruction: number;
    computePerAccount: number;
    wastedCompute: number;
    optimizationPotential: number; // percentage
  };

  limits: {
    maxComputeUnits: number;
    isNearLimit: boolean;
    limitUtilization: number; // percentage
  };
}

export interface ComputeByInstruction {
  instructionIndex: number;
  programId: string;
  computeUnits: number;
  percentage: number;
  isExpensive: boolean;
}

export interface ComputeByProgram {
  programId: string;
  programName: string;
  totalCompute: number;
  instructionCount: number;
  averageComputePerInstruction: number;
  percentage: number;
}

export interface ComputeByAccount {
  accountAddress: string;
  readCompute: number;
  writeCompute: number;
  totalCompute: number;
  accessCount: number;
}

export interface EfficiencyMetrics {
  overall: number; // 0-100 score

  categories: {
    feeEfficiency: number; // 0-100
    computeEfficiency: number; // 0-100
    instructionEfficiency: number; // 0-100
    accountEfficiency: number; // 0-100
    timeEfficiency: number; // 0-100
  };

  bottlenecks: EfficiencyBottleneck[];
  optimizations: EfficiencyOptimization[];
}

export interface EfficiencyBottleneck {
  type: 'fee' | 'compute' | 'instruction' | 'account' | 'time';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number; // 0-100 percentage impact
  suggestion: string;
}

export interface EfficiencyOptimization {
  type: 'fee_reduction' | 'compute_optimization' | 'instruction_batching' | 'account_optimization';
  title: string;
  description: string;
  potentialSaving: number; // in lamports or compute units
  difficulty: 'easy' | 'medium' | 'hard';
  priority: 'low' | 'medium' | 'high';
}

export interface PerformanceMetrics {
  executionTime: number | null; // estimated in milliseconds
  throughput: {
    instructionsPerSecond: number;
    accountAccessesPerSecond: number;
    computeUnitsPerSecond: number;
  };

  latency: {
    networkLatency: number | null;
    processingLatency: number | null;
    confirmationLatency: number | null;
  };

  scalability: {
    parallelizability: number; // 0-100 score
    bottleneckFactor: number; // multiplier
    scalabilityScore: number; // 0-100
  };
}

export interface ComplexityMetrics {
  overall: number; // 0-100 complexity score

  dimensions: {
    instructionComplexity: number; // number and type of instructions
    accountComplexity: number; // number and type of accounts
    programComplexity: number; // number and complexity of programs
    dataComplexity: number; // amount and structure of data
    flowComplexity: number; // control flow complexity
  };

  indicators: {
    instructionCount: number;
    uniqueProgramCount: number;
    accountCount: number;
    crossProgramCalls: number;
    nestedInstructions: number;
    conditionalLogic: number;
  };

  riskFactors: ComplexityRiskFactor[];
}

export interface ComplexityRiskFactor {
  type: 'high_instruction_count' | 'multiple_programs' | 'complex_data_flow' | 'nested_calls';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface CostAnalysis {
  totalCostLamports: number;
  totalCostSOL: number;
  totalCostUSD: number | null;

  costBreakdown: {
    transactionFee: number;
    rentCost: number;
    computeCost: number;
    priorityCost: number;
  };

  costEfficiency: {
    costPerInstruction: number;
    costPerAccount: number;
    costPerComputeUnit: number;
    costPerByte: number;
  };

  comparison: {
    vsAverageTransaction: number; // percentage difference
    vsOptimalTransaction: number; // percentage difference
    costRanking: 'very_cheap' | 'cheap' | 'average' | 'expensive' | 'very_expensive';
  };

  projections: {
    dailyCost: number; // if run daily
    monthlyCost: number; // if run monthly
    yearlyCost: number; // if run yearly
  };
}

export interface ComparisonMetrics {
  similarTransactions: {
    count: number;
    averageFee: number;
    averageCompute: number;
    averageComplexity: number;
  };

  percentiles: {
    feePercentile: number; // 0-100
    computePercentile: number; // 0-100
    complexityPercentile: number; // 0-100
    efficiencyPercentile: number; // 0-100
  };

  rankings: {
    feeRank: number; // 1 = cheapest
    computeRank: number; // 1 = most efficient
    complexityRank: number; // 1 = simplest
    overallRank: number; // 1 = best
  };

  benchmarks: {
    isAboveAverage: boolean;
    isBestPractice: boolean;
    isOptimized: boolean;
  };
}

export interface TransactionRecommendation {
  type: 'optimization' | 'cost_reduction' | 'performance' | 'security' | 'best_practice';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedSaving?: number; // in lamports or percentage
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'fee' | 'compute' | 'instruction' | 'account' | 'general';
}

// Configuration for metrics calculation
export interface MetricsCalculatorConfig {
  solPriceUSD?: number; // Current SOL price for USD calculations
  includeComparisons: boolean;
  includeRecommendations: boolean;
  computeUnitPrice: number; // Current compute unit price
  baseFee: number; // Base transaction fee (5000 lamports)
  maxComputeUnits: number; // Max compute units per transaction

  // Thresholds for scoring
  thresholds: {
    highFee: number; // lamports
    highCompute: number; // compute units
    highComplexity: number; // complexity score
    lowEfficiency: number; // efficiency score
  };

  // Benchmarks for comparison
  benchmarks: {
    averageFee: number;
    averageCompute: number;
    averageComplexity: number;
    optimalFee: number;
    optimalCompute: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: MetricsCalculatorConfig = {
  solPriceUSD: 100, // Default SOL price
  includeComparisons: true,
  includeRecommendations: true,
  computeUnitPrice: 1, // 1 lamport per compute unit
  baseFee: 5000,
  maxComputeUnits: 1400000,

  thresholds: {
    highFee: 50000, // 0.05 SOL
    highCompute: 200000,
    highComplexity: 70,
    lowEfficiency: 60
  },

  benchmarks: {
    averageFee: 10000,
    averageCompute: 50000,
    averageComplexity: 30,
    optimalFee: 5000,
    optimalCompute: 20000
  }
};

export class TransactionMetricsCalculator {
  private config: MetricsCalculatorConfig;
  private transactionCache: Map<string, TransactionMetrics> = new Map();

  constructor(config: Partial<MetricsCalculatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate comprehensive metrics for a transaction
   */
  async calculateMetrics(transaction: DetailedTransactionInfo): Promise<TransactionMetrics> {
    // Check cache first
    const cached = this.transactionCache.get(transaction.signature);
    if (cached) {
      return cached;
    }

    const metrics: TransactionMetrics = {
      signature: transaction.signature,
      slot: transaction.slot,
      blockTime: transaction.blockTime ?? null,

      feeAnalysis: await this.calculateFeeAnalysis(transaction),
      computeAnalysis: await this.calculateComputeAnalysis(transaction),
      efficiency: await this.calculateEfficiencyMetrics(transaction),
      performance: await this.calculatePerformanceMetrics(transaction),
      complexity: await this.calculateComplexityMetrics(transaction),
      costAnalysis: await this.calculateCostAnalysis(transaction),
      comparison: await this.calculateComparisonMetrics(transaction),

      overallScore: 0, // Will be calculated
      grade: 'C', // Will be calculated
      recommendations: []
    };

    // Calculate overall score and grade
    metrics.overallScore = this.calculateOverallScore(metrics);
    metrics.grade = this.calculateGrade(metrics.overallScore);

    // Generate recommendations
    if (this.config.includeRecommendations) {
      metrics.recommendations = await this.generateRecommendations(transaction, metrics);
    }

    // Cache the result
    this.transactionCache.set(transaction.signature, metrics);

    return metrics;
  }

  /**
   * Calculate detailed fee analysis
   */
  private async calculateFeeAnalysis(transaction: DetailedTransactionInfo): Promise<FeeAnalysis> {
    const totalFee = transaction.meta?.fee || 0;
    const totalFeeSOL = totalFee / 1e9;
    const totalFeeUSD = this.config.solPriceUSD ? totalFeeSOL * this.config.solPriceUSD : 0;

    const instructionCount = transaction.transaction?.message.instructions?.length || 0;
    const accountCount = transaction.transaction?.message.accountKeys?.length || 0;

    // Estimate fee breakdown (simplified)
    const baseFee = this.config.baseFee;
    const computeFee = Math.max(0, totalFee - baseFee);
    const priorityFee = 0; // Would need to be calculated from priority fee instructions
    const accountRentFee = 0; // Would need to analyze account creation
    const programFee = 0; // Would need to analyze program-specific fees

    const breakdown = {
      baseFee,
      priorityFee,
      computeFee,
      accountRentFee,
      programFee
    };

    const feePerInstruction = instructionCount > 0 ? totalFee / instructionCount : 0;
    const feePerAccount = accountCount > 0 ? totalFee / accountCount : 0;

    // Determine fee efficiency
    const isOptimal = totalFee <= this.config.benchmarks.optimalFee;
    const potentialSavings = Math.max(0, totalFee - this.config.benchmarks.optimalFee);

    let feeRank: FeeAnalysis['feeRank'];
    if (totalFee <= this.config.benchmarks.optimalFee) feeRank = 'very_low';
    else if (totalFee <= this.config.benchmarks.averageFee * 0.8) feeRank = 'low';
    else if (totalFee <= this.config.benchmarks.averageFee * 1.2) feeRank = 'average';
    else if (totalFee <= this.config.thresholds.highFee) feeRank = 'high';
    else feeRank = 'very_high';

    return {
      totalFee,
      totalFeeSOL,
      totalFeeUSD,
      breakdown,
      feePerInstruction,
      feePerAccount,
      feePerComputeUnit: 0, // Will be calculated in compute analysis
      isOptimal,
      potentialSavings,
      feeRank
    };
  }

  /**
   * Calculate compute unit analysis
   */
  private async calculateComputeAnalysis(transaction: DetailedTransactionInfo): Promise<ComputeAnalysis> {
    // In a real implementation, this would parse compute budget instructions
    // For now, we'll estimate based on instruction complexity

    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];

    // Estimate compute units (simplified)
    let totalComputeUnits = 0;
    const instructionCompute: ComputeByInstruction[] = [];
    const programCompute = new Map<string, { total: number; count: number; name: string }>();
    const accountCompute = new Map<string, { read: number; write: number; access: number }>();

    instructions.forEach((instruction, index) => {
      const programId = accounts[instruction.programIdIndex] || 'unknown';

      // Estimate compute units based on instruction complexity
      let computeUnits = this.estimateInstructionCompute(instruction, programId);
      totalComputeUnits += computeUnits;

      instructionCompute.push({
        instructionIndex: index,
        programId,
        computeUnits,
        percentage: 0, // Will be calculated after total is known
        isExpensive: computeUnits > 10000
      });

      // Track by program
      const existing = programCompute.get(programId) || { total: 0, count: 0, name: this.getProgramName(programId) };
      existing.total += computeUnits;
      existing.count += 1;
      programCompute.set(programId, existing);

      // Track by account
      instruction.accounts?.forEach((accountIndex: number) => {
        const accountAddress = accounts[accountIndex];
        if (accountAddress) {
          const existing = accountCompute.get(accountAddress) || { read: 0, write: 0, access: 0 };
          existing.read += computeUnits * 0.3; // Estimate
          existing.write += computeUnits * 0.7; // Estimate
          existing.access += 1;
          accountCompute.set(accountAddress, existing);
        }
      });
    });

    // Calculate percentages
    instructionCompute.forEach(item => {
      item.percentage = totalComputeUnits > 0 ? (item.computeUnits / totalComputeUnits) * 100 : 0;
    });

    const computeUnitsUsed = totalComputeUnits;
    const computeUnitsRemaining = Math.max(0, this.config.maxComputeUnits - computeUnitsUsed);
    const computeUtilization = (computeUnitsUsed / this.config.maxComputeUnits) * 100;

    const programComputeArray: ComputeByProgram[] = Array.from(programCompute.entries()).map(([programId, data]) => ({
      programId,
      programName: data.name,
      totalCompute: data.total,
      instructionCount: data.count,
      averageComputePerInstruction: data.count > 0 ? data.total / data.count : 0,
      percentage: totalComputeUnits > 0 ? (data.total / totalComputeUnits) * 100 : 0
    }));

    const accountComputeArray: ComputeByAccount[] = Array.from(accountCompute.entries()).map(([address, data]) => ({
      accountAddress: address,
      readCompute: data.read,
      writeCompute: data.write,
      totalCompute: data.read + data.write,
      accessCount: data.access
    }));

    const efficiency = {
      computePerInstruction: instructions.length > 0 ? totalComputeUnits / instructions.length : 0,
      computePerAccount: accounts.length > 0 ? totalComputeUnits / accounts.length : 0,
      wastedCompute: Math.max(0, totalComputeUnits - this.config.benchmarks.optimalCompute),
      optimizationPotential: totalComputeUnits > 0 ? Math.min(50, (totalComputeUnits - this.config.benchmarks.optimalCompute) / totalComputeUnits * 100) : 0
    };

    const limits = {
      maxComputeUnits: this.config.maxComputeUnits,
      isNearLimit: computeUtilization > 80,
      limitUtilization: computeUtilization
    };

    return {
      totalComputeUnits: this.config.maxComputeUnits,
      computeUnitsUsed,
      computeUnitsRemaining,
      computeUtilization,
      breakdown: {
        instructionCompute,
        programCompute: programComputeArray,
        accountCompute: accountComputeArray
      },
      efficiency,
      limits
    };
  }

  /**
   * Calculate efficiency metrics
   */
  private async calculateEfficiencyMetrics(transaction: DetailedTransactionInfo): Promise<EfficiencyMetrics> {
    const feeAnalysis = await this.calculateFeeAnalysis(transaction);
    const computeAnalysis = await this.calculateComputeAnalysis(transaction);
    const complexity = await this.calculateComplexityMetrics(transaction);

    // Calculate category scores (0-100)
    const feeEfficiency = this.calculateFeeEfficiencyScore(feeAnalysis);
    const computeEfficiency = this.calculateComputeEfficiencyScore(computeAnalysis);
    const instructionEfficiency = this.calculateInstructionEfficiencyScore(transaction);
    const accountEfficiency = this.calculateAccountEfficiencyScore(transaction);
    const timeEfficiency = this.calculateTimeEfficiencyScore(transaction);
    const complexityEfficiency = this.calculateComplexityEfficiencyScore(complexity);

    const categories = {
      feeEfficiency,
      computeEfficiency,
      instructionEfficiency,
      accountEfficiency,
      timeEfficiency,
      complexityEfficiency
    };

    // Overall efficiency is weighted average
    const overall = (
      feeEfficiency * 0.2 +
      computeEfficiency * 0.2 +
      instructionEfficiency * 0.2 +
      accountEfficiency * 0.15 +
      timeEfficiency * 0.15 +
      complexityEfficiency * 0.1
    );

    // Identify bottlenecks
    const bottlenecks: EfficiencyBottleneck[] = [];

    if (feeEfficiency < 60) {
      bottlenecks.push({
        type: 'fee',
        severity: feeEfficiency < 30 ? 'critical' : feeEfficiency < 50 ? 'high' : 'medium',
        description: 'Transaction fee is higher than optimal',
        impact: 100 - feeEfficiency,
        suggestion: 'Consider optimizing compute usage or using priority fees more efficiently'
      });
    }

    if (computeEfficiency < 60) {
      bottlenecks.push({
        type: 'compute',
        severity: computeEfficiency < 30 ? 'critical' : computeEfficiency < 50 ? 'high' : 'medium',
        description: 'Compute unit usage is inefficient',
        impact: 100 - computeEfficiency,
        suggestion: 'Optimize instruction complexity or batch operations'
      });
    }

    // Generate optimizations
    const optimizations: EfficiencyOptimization[] = [];

    if (feeAnalysis.potentialSavings > 1000) {
      optimizations.push({
        type: 'fee_reduction',
        title: 'Reduce Transaction Fees',
        description: 'Optimize compute usage to reduce fees',
        potentialSaving: feeAnalysis.potentialSavings,
        difficulty: 'medium',
        priority: 'high'
      });
    }

    if (computeAnalysis.efficiency.optimizationPotential > 20) {
      optimizations.push({
        type: 'compute_optimization',
        title: 'Optimize Compute Usage',
        description: 'Reduce unnecessary compute unit consumption',
        potentialSaving: computeAnalysis.efficiency.wastedCompute,
        difficulty: 'medium',
        priority: 'medium'
      });
    }

    return {
      overall,
      categories,
      bottlenecks,
      optimizations
    };
  }  /*
*
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(transaction: DetailedTransactionInfo): Promise<PerformanceMetrics> {
    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];
    const computeAnalysis = await this.calculateComputeAnalysis(transaction);

    // Estimate execution time (simplified)
    const baseExecutionTime = 10; // 10ms base
    const instructionTime = instructions.length * 2; // 2ms per instruction
    const computeTime = computeAnalysis.computeUnitsUsed / 10000; // 1ms per 10k compute units
    const executionTime = baseExecutionTime + instructionTime + computeTime;

    const throughput = {
      instructionsPerSecond: executionTime > 0 ? (instructions.length / executionTime) * 1000 : 0,
      accountAccessesPerSecond: executionTime > 0 ? (accounts.length / executionTime) * 1000 : 0,
      computeUnitsPerSecond: executionTime > 0 ? (computeAnalysis.computeUnitsUsed / executionTime) * 1000 : 0
    };

    // Estimate latency components
    const latency = {
      networkLatency: null, // Would need network monitoring
      processingLatency: executionTime,
      confirmationLatency: null // Would need confirmation tracking
    };

    // Calculate scalability metrics
    const parallelizability = this.calculateParallelizability(transaction);
    const bottleneckFactor = this.calculateBottleneckFactor(transaction);
    const scalabilityScore = Math.max(0, 100 - (bottleneckFactor - 1) * 20);

    const scalability = {
      parallelizability,
      bottleneckFactor,
      scalabilityScore
    };

    return {
      executionTime,
      throughput,
      latency,
      scalability
    };
  }

  /**
   * Calculate complexity metrics
   */
  private async calculateComplexityMetrics(transaction: DetailedTransactionInfo): Promise<ComplexityMetrics> {
    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];

    // Count unique programs
    const uniquePrograms = new Set(
      instructions.map(inst => accounts[inst.programIdIndex]).filter(Boolean)
    );

    // Calculate complexity dimensions
    const instructionComplexity = Math.min(100, (instructions.length / 10) * 100);
    const accountComplexity = Math.min(100, (accounts.length / 20) * 100);
    const programComplexity = Math.min(100, (uniquePrograms.size / 5) * 100);

    // Estimate data complexity based on instruction data
    const totalDataSize = instructions.reduce((sum, inst) => sum + (inst.data?.length || 0), 0);
    const dataComplexity = Math.min(100, (totalDataSize / 1000) * 100);

    // Estimate flow complexity
    const crossProgramCalls = this.countCrossProgramCalls(transaction);
    const nestedInstructions = this.countNestedInstructions(transaction);
    const flowComplexity = Math.min(100, ((crossProgramCalls + nestedInstructions) / 5) * 100);

    const dimensions = {
      instructionComplexity,
      accountComplexity,
      programComplexity,
      dataComplexity,
      flowComplexity
    };

    // Overall complexity is weighted average
    const overall = (
      instructionComplexity * 0.25 +
      accountComplexity * 0.2 +
      programComplexity * 0.2 +
      dataComplexity * 0.15 +
      flowComplexity * 0.2
    );

    const indicators = {
      instructionCount: instructions.length,
      uniqueProgramCount: uniquePrograms.size,
      accountCount: accounts.length,
      crossProgramCalls,
      nestedInstructions,
      conditionalLogic: this.countConditionalLogic(transaction)
    };

    // Identify risk factors
    const riskFactors: ComplexityRiskFactor[] = [];

    if (instructions.length > 20) {
      riskFactors.push({
        type: 'high_instruction_count',
        severity: instructions.length > 50 ? 'high' : 'medium',
        description: `Transaction has ${instructions.length} instructions, which may increase failure risk`,
        mitigation: 'Consider breaking into smaller transactions or optimizing instruction usage'
      });
    }

    if (uniquePrograms.size > 5) {
      riskFactors.push({
        type: 'multiple_programs',
        severity: uniquePrograms.size > 10 ? 'high' : 'medium',
        description: `Transaction interacts with ${uniquePrograms.size} different programs`,
        mitigation: 'Reduce program interactions or ensure all programs are well-tested'
      });
    }

    return {
      overall,
      dimensions,
      indicators,
      riskFactors
    };
  }

  /**
   * Calculate cost analysis
   */
  private async calculateCostAnalysis(transaction: DetailedTransactionInfo): Promise<CostAnalysis> {
    const feeAnalysis = await this.calculateFeeAnalysis(transaction);

    const totalCostLamports = feeAnalysis.totalFee;
    const totalCostSOL = feeAnalysis.totalFeeSOL;
    const totalCostUSD = feeAnalysis.totalFeeUSD;

    const costBreakdown = {
      transactionFee: feeAnalysis.breakdown.baseFee,
      rentCost: feeAnalysis.breakdown.accountRentFee,
      computeCost: feeAnalysis.breakdown.computeFee,
      priorityCost: feeAnalysis.breakdown.priorityFee
    };

    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];
    const computeAnalysis = await this.calculateComputeAnalysis(transaction);

    const costEfficiency = {
      costPerInstruction: instructions.length > 0 ? totalCostLamports / instructions.length : 0,
      costPerAccount: accounts.length > 0 ? totalCostLamports / accounts.length : 0,
      costPerComputeUnit: computeAnalysis.computeUnitsUsed > 0 ? totalCostLamports / computeAnalysis.computeUnitsUsed : 0,
      costPerByte: 0 // Would need transaction size calculation
    };

    // Compare with benchmarks
    const vsAverageTransaction = ((totalCostLamports - this.config.benchmarks.averageFee) / this.config.benchmarks.averageFee) * 100;
    const vsOptimalTransaction = ((totalCostLamports - this.config.benchmarks.optimalFee) / this.config.benchmarks.optimalFee) * 100;

    let costRanking: CostAnalysis['comparison']['costRanking'];
    if (totalCostLamports <= this.config.benchmarks.optimalFee) costRanking = 'very_cheap';
    else if (totalCostLamports <= this.config.benchmarks.averageFee * 0.8) costRanking = 'cheap';
    else if (totalCostLamports <= this.config.benchmarks.averageFee * 1.2) costRanking = 'average';
    else if (totalCostLamports <= this.config.thresholds.highFee) costRanking = 'expensive';
    else costRanking = 'very_expensive';

    const comparison = {
      vsAverageTransaction,
      vsOptimalTransaction,
      costRanking
    };

    // Project costs for different frequencies
    const projections = {
      dailyCost: totalCostLamports * 24, // If run hourly
      monthlyCost: totalCostLamports * 30, // If run daily
      yearlyCost: totalCostLamports * 365 // If run daily
    };

    return {
      totalCostLamports,
      totalCostSOL,
      totalCostUSD,
      costBreakdown,
      costEfficiency,
      comparison,
      projections
    };
  }

  /**
   * Calculate comparison metrics
   */
  private async calculateComparisonMetrics(transaction: DetailedTransactionInfo): Promise<ComparisonMetrics> {
    if (!this.config.includeComparisons) {
      return {
        similarTransactions: { count: 0, averageFee: 0, averageCompute: 0, averageComplexity: 0 },
        percentiles: { feePercentile: 50, computePercentile: 50, complexityPercentile: 50, efficiencyPercentile: 50 },
        rankings: { feeRank: 1, computeRank: 1, complexityRank: 1, overallRank: 1 },
        benchmarks: { isAboveAverage: false, isBestPractice: false, isOptimized: false }
      };
    }

    // In a real implementation, this would query a database of similar transactions
    // For now, we'll use mock data
    const feeAnalysis = await this.calculateFeeAnalysis(transaction);
    const computeAnalysis = await this.calculateComputeAnalysis(transaction);
    const complexity = await this.calculateComplexityMetrics(transaction);
    const efficiency = await this.calculateEfficiencyMetrics(transaction);

    const similarTransactions = {
      count: 1000, // Mock data
      averageFee: this.config.benchmarks.averageFee,
      averageCompute: this.config.benchmarks.averageCompute,
      averageComplexity: this.config.benchmarks.averageComplexity
    };

    // Calculate percentiles (simplified)
    const feePercentile = this.calculatePercentile(feeAnalysis.totalFee, this.config.benchmarks.averageFee);
    const computePercentile = this.calculatePercentile(computeAnalysis.computeUnitsUsed, this.config.benchmarks.averageCompute);
    const complexityPercentile = this.calculatePercentile(complexity.overall, this.config.benchmarks.averageComplexity);
    const efficiencyPercentile = efficiency.overall;

    const percentiles = {
      feePercentile,
      computePercentile,
      complexityPercentile,
      efficiencyPercentile
    };

    // Mock rankings
    const rankings = {
      feeRank: Math.floor(feePercentile * 10) + 1,
      computeRank: Math.floor(computePercentile * 10) + 1,
      complexityRank: Math.floor(complexityPercentile * 10) + 1,
      overallRank: Math.floor(((feePercentile + computePercentile + efficiencyPercentile) / 3) * 10) + 1
    };

    const benchmarks = {
      isAboveAverage: efficiency.overall > 60,
      isBestPractice: efficiency.overall > 80 && feeAnalysis.isOptimal,
      isOptimized: efficiency.overall > 90 && feeAnalysis.isOptimal && computeAnalysis.efficiency.optimizationPotential < 10
    };

    return {
      similarTransactions,
      percentiles,
      rankings,
      benchmarks
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private async generateRecommendations(
    _transaction: DetailedTransactionInfo,
    metrics: TransactionMetrics
  ): Promise<TransactionRecommendation[]> {
    const recommendations: TransactionRecommendation[] = [];

    // Fee optimization recommendations
    if (metrics.feeAnalysis.potentialSavings > 1000) {
      recommendations.push({
        type: 'cost_reduction',
        priority: 'high',
        title: 'Reduce Transaction Fees',
        description: `This transaction could save ${metrics.feeAnalysis.potentialSavings} lamports (${(metrics.feeAnalysis.potentialSavings / 1e9).toFixed(6)} SOL) in fees.`,
        impact: `Save ${((metrics.feeAnalysis.potentialSavings / metrics.feeAnalysis.totalFee) * 100).toFixed(1)}% on transaction costs`,
        implementation: 'Optimize compute unit usage, remove unnecessary instructions, or use compute budget instructions',
        estimatedSaving: metrics.feeAnalysis.potentialSavings,
        difficulty: 'medium',
        category: 'fee'
      });
    }

    // Compute optimization recommendations
    if (metrics.computeAnalysis.efficiency.optimizationPotential > 20) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Optimize Compute Usage',
        description: `This transaction has ${metrics.computeAnalysis.efficiency.optimizationPotential.toFixed(1)}% compute optimization potential.`,
        impact: `Reduce compute units by up to ${metrics.computeAnalysis.efficiency.wastedCompute.toFixed(0)} units`,
        implementation: 'Review instruction complexity, batch operations, or optimize program logic',
        difficulty: 'medium',
        category: 'compute'
      });
    }

    // Complexity reduction recommendations
    if (metrics.complexity.overall > 70) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Reduce Transaction Complexity',
        description: `This transaction has high complexity (${metrics.complexity.overall.toFixed(0)}/100) which increases failure risk.`,
        impact: 'Improve transaction reliability and reduce gas costs',
        implementation: 'Break into smaller transactions, reduce program interactions, or simplify instruction flow',
        difficulty: 'hard',
        category: 'instruction'
      });
    }

    // Performance recommendations
    if (metrics.performance.scalability.scalabilityScore < 60) {
      recommendations.push({
        type: 'performance',
        priority: 'low',
        title: 'Improve Scalability',
        description: `This transaction has limited scalability (${metrics.performance.scalability.scalabilityScore.toFixed(0)}/100).`,
        impact: 'Better performance under high load conditions',
        implementation: 'Reduce bottlenecks, improve parallelizability, or optimize critical paths',
        difficulty: 'hard',
        category: 'general'
      });
    }

    // Security recommendations
    if (metrics.complexity.riskFactors.some(rf => rf.severity === 'high')) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: 'Address Security Risks',
        description: 'This transaction has high-risk complexity factors that could lead to failures.',
        impact: 'Reduce transaction failure risk and improve reliability',
        implementation: 'Review and test all program interactions, add error handling, validate all inputs',
        difficulty: 'medium',
        category: 'general'
      });
    }

    // Best practice recommendations
    if (!metrics.comparison.benchmarks.isBestPractice) {
      recommendations.push({
        type: 'best_practice',
        priority: 'low',
        title: 'Follow Best Practices',
        description: 'This transaction could benefit from following Solana development best practices.',
        impact: 'Improve overall transaction quality and maintainability',
        implementation: 'Review Solana documentation, use recommended patterns, add proper error handling',
        difficulty: 'easy',
        category: 'general'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate overall score from all metrics
   */
  private calculateOverallScore(metrics: TransactionMetrics): number {
    const weights = {
      efficiency: 0.3,
      cost: 0.25,
      complexity: 0.2,
      performance: 0.15,
      comparison: 0.1
    };

    const efficiencyScore = metrics.efficiency.overall;
    const costScore = 100 - Math.min(100, (metrics.costAnalysis.comparison.vsOptimalTransaction / 2));
    const complexityScore = Math.max(0, 100 - metrics.complexity.overall);
    const performanceScore = metrics.performance.scalability.scalabilityScore;
    const comparisonScore = metrics.comparison.percentiles.efficiencyPercentile;

    const overallScore = (
      efficiencyScore * weights.efficiency +
      costScore * weights.cost +
      complexityScore * weights.complexity +
      performanceScore * weights.performance +
      comparisonScore * weights.comparison
    );

    return Math.max(0, Math.min(100, overallScore));
  }

  /**
   * Calculate grade from overall score
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Helper methods
  private estimateInstructionCompute(_instruction: any, programId: string): number {
    // Simplified compute estimation based on program type
    const baseCompute = 1000;

    if (programId === '11111111111111111111111111111111') return baseCompute; // System
    if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') return baseCompute * 2; // SPL Token
    if (programId.includes('JUP')) return baseCompute * 5; // Jupiter (complex)

    return baseCompute * 3; // Default for unknown programs
  }

  private getProgramName(programId: string): string {
    const knownPrograms: Record<string, string> = {
      '11111111111111111111111111111111': 'System Program',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter Aggregator'
    };

    return knownPrograms[programId] || `Program ${programId.substring(0, 8)}...`;
  }

  private calculateFeeEfficiencyScore(feeAnalysis: FeeAnalysis): number {
    if (feeAnalysis.isOptimal) return 100;

    const excessFee = feeAnalysis.totalFee - this.config.benchmarks.optimalFee;
    const maxExcess = this.config.thresholds.highFee - this.config.benchmarks.optimalFee;
    const efficiency = Math.max(0, 100 - (excessFee / maxExcess) * 100);

    return Math.min(100, efficiency);
  }

  private calculateComputeEfficiencyScore(computeAnalysis: ComputeAnalysis): number {
    const utilization = computeAnalysis.computeUtilization;
    const wastedPercentage = computeAnalysis.efficiency.optimizationPotential;

    // Optimal utilization is around 60-80%
    let utilizationScore = 100;
    if (utilization < 20) utilizationScore = 50; // Under-utilized
    else if (utilization > 90) utilizationScore = 70; // Over-utilized

    const wasteScore = Math.max(0, 100 - wastedPercentage * 2);

    return (utilizationScore + wasteScore) / 2;
  }

  private calculateInstructionEfficiencyScore(transaction: DetailedTransactionInfo): number {
    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];

    // Score based on instruction-to-account ratio
    const ratio = accounts.length > 0 ? instructions.length / accounts.length : 0;

    // Optimal ratio is around 0.5-2.0
    if (ratio >= 0.5 && ratio <= 2.0) return 100;
    if (ratio < 0.5) return 70; // Too few instructions
    if (ratio > 5.0) return 30; // Too many instructions

    return Math.max(30, 100 - (ratio - 2.0) * 20);
  }

  private calculateAccountEfficiencyScore(transaction: DetailedTransactionInfo): number {
    const accounts = transaction.transaction?.message.accountKeys || [];
    const instructions = transaction.transaction?.message.instructions || [];

    // Calculate account usage efficiency
    const accountUsage = new Map<string, number>();
    instructions.forEach(inst => {
      inst.accounts?.forEach((accountIndex: number) => {
        const account = accounts[accountIndex];
        if (account) {
          accountUsage.set(account, (accountUsage.get(account) || 0) + 1);
        }
      });
    });

    const totalUsage = Array.from(accountUsage.values()).reduce((sum, usage) => sum + usage, 0);
    const averageUsage = accounts.length > 0 ? totalUsage / accounts.length : 0;

    // Higher average usage indicates better efficiency
    return Math.min(100, averageUsage * 25);
  }

  private calculateTimeEfficiencyScore(transaction: DetailedTransactionInfo): number {
    // Simplified time efficiency based on instruction count and complexity
    const instructions = transaction.transaction?.message.instructions || [];

    if (instructions.length <= 5) return 100;
    if (instructions.length <= 10) return 80;
    if (instructions.length <= 20) return 60;
    if (instructions.length <= 50) return 40;

    return 20;
  }

  private calculateComplexityEfficiencyScore(complexity: ComplexityMetrics): number {
    // Lower complexity is more efficient
    const complexityScore = complexity.overall;

    // Invert the complexity score (higher complexity = lower efficiency)
    if (complexityScore <= 20) return 100;
    if (complexityScore <= 40) return 80;
    if (complexityScore <= 60) return 60;
    if (complexityScore <= 80) return 40;

    return 20;
  }

  private calculateParallelizability(transaction: DetailedTransactionInfo): number {
    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];

    // Calculate account conflicts
    const accountAccess = new Map<string, { read: boolean; write: boolean }>();

    instructions.forEach(inst => {
      inst.accounts?.forEach((accountIndex: number) => {
        const account = accounts[accountIndex];
        if (account) {
          const existing = accountAccess.get(account) || { read: false, write: false };
          existing.read = true;
          existing.write = true; // Simplified - would need to check actual access type
          accountAccess.set(account, existing);
        }
      });
    });

    const writeConflicts = Array.from(accountAccess.values()).filter(access => access.write).length;
    const parallelizability = Math.max(0, 100 - (writeConflicts / accounts.length) * 100);

    return parallelizability;
  }

  private calculateBottleneckFactor(transaction: DetailedTransactionInfo): number {
    const instructions = transaction.transaction?.message.instructions || [];

    // Simplified bottleneck calculation
    const uniquePrograms = new Set(
      instructions.map((inst, _index) =>
        transaction.transaction?.message.accountKeys?.[inst.programIdIndex]
      ).filter(Boolean)
    );

    // More programs = more potential bottlenecks
    return 1 + (uniquePrograms.size * 0.2);
  }

  private countCrossProgramCalls(transaction: DetailedTransactionInfo): number {
    const instructions = transaction.transaction?.message.instructions || [];
    const accounts = transaction.transaction?.message.accountKeys || [];

    const programs = instructions.map(inst => accounts[inst.programIdIndex]).filter(Boolean);
    const uniquePrograms = new Set(programs);

    return Math.max(0, uniquePrograms.size - 1);
  }

  private countNestedInstructions(_transaction: DetailedTransactionInfo): number {
    // Simplified - would need to analyze instruction data for CPI calls
    return 0;
  }

  private countConditionalLogic(_transaction: DetailedTransactionInfo): number {
    // Simplified - would need to analyze instruction data for conditional logic
    return 0;
  }

  private calculatePercentile(value: number, average: number): number {
    // Simplified percentile calculation
    const ratio = value / average;

    if (ratio <= 0.5) return 10;
    if (ratio <= 0.8) return 25;
    if (ratio <= 1.2) return 50;
    if (ratio <= 1.5) return 75;

    return 90;
  }

  /**
   * Clear the metrics cache
   */
  clearCache(): void {
    this.transactionCache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MetricsCalculatorConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache(); // Clear cache when config changes
  }

  /**
   * Get current configuration
   */
  getConfig(): MetricsCalculatorConfig {
    return { ...this.config };
  }
}

// Export utility functions
export const transactionMetricsCalculator = new TransactionMetricsCalculator();

export function createMetricsCalculator(config?: Partial<MetricsCalculatorConfig>): TransactionMetricsCalculator {
  return new TransactionMetricsCalculator(config);
}

export function getDefaultMetricsConfig(): MetricsCalculatorConfig {
  return { ...DEFAULT_CONFIG };
}

// Export main calculation function
export function calculateTransactionMetrics(transaction: any) {
  return transactionMetricsCalculator.calculateMetrics(transaction);
}

// Utility functions for formatting metrics
export function formatMetricsScore(score: number): string {
  return `${score.toFixed(1)}/100`;
}

export function formatLamports(lamports: number): string {
  if (lamports >= 1e9) {
    return `${(lamports / 1e9).toFixed(6)} SOL`;
  }
  return `${lamports.toLocaleString()} lamports`;
}

export function formatComputeUnits(units: number): string {
  if (units >= 1e6) {
    return `${(units / 1e6).toFixed(2)}M CU`;
  }
  if (units >= 1e3) {
    return `${(units / 1e3).toFixed(1)}K CU`;
  }
  return `${units} CU`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getGradeColor(grade: string): string {
  const colors = {
    A: '#10B981', // Green
    B: '#84CC16', // Lime
    C: '#F59E0B', // Amber
    D: '#F97316', // Orange
    F: '#EF4444'  // Red
  };
  return colors[grade as keyof typeof colors] || '#6B7280';
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#10B981'; // Green
  if (score >= 80) return '#84CC16'; // Lime
  if (score >= 70) return '#F59E0B'; // Amber
  if (score >= 60) return '#F97316'; // Orange
  return '#EF4444'; // Red
}