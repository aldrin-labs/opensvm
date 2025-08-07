/**
 * AI-Powered Portfolio Optimization Engine for OpenSVM
 * 
 * Features:
 * - Modern Portfolio Theory implementation with Solana DeFi focus
 * - Multi-objective optimization (return, risk, yield, liquidity)
 * - Dynamic rebalancing strategies
 * - Protocol health and sustainability analysis
 * - Risk-adjusted portfolio construction
 * - Yield farming optimization
 * - Liquidity provision strategies
 */

import { TensorUtils } from './core/tensor-utils';
import type { 
  PortfolioOptimizationRequest, 
  OptimizedPortfolio, 
  PortfolioAllocation,
  RiskMetrics,
  TensorData
} from './types';

export interface PortfolioAnalysisRequest {
  current_portfolio: CurrentHolding[];
  target_allocation?: TargetAllocation[];
  optimization_objective: 'maximize_return' | 'minimize_risk' | 'maximize_sharpe' | 'maximize_yield' | 'balanced';
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  time_horizon: '1week' | '1month' | '3month' | '6month' | '1year';
  constraints: PortfolioConstraints;
}

export interface CurrentHolding {
  token: string;
  symbol: string;
  amount: number;
  current_value_usd: number;
  cost_basis?: number;
  acquisition_date?: number;
  staking_info?: StakingPosition;
  liquidity_info?: LiquidityPosition;
}

export interface StakingPosition {
  protocol: string;
  staked_amount: number;
  current_apy: number;
  rewards_earned: number;
  lock_period?: number;
  unlock_date?: number;
}

export interface LiquidityPosition {
  protocol: string;
  pool: string;
  tokens: { token: string; amount: number }[];
  lp_tokens: number;
  current_value: number;
  fees_earned: number;
  impermanent_loss: number;
}

export interface TargetAllocation {
  token: string;
  target_percentage: number;
  min_percentage?: number;
  max_percentage?: number;
}

export interface PortfolioConstraints {
  max_position_size: number; // percentage
  min_position_size: number; // percentage
  max_tokens: number;
  excluded_tokens: string[];
  preferred_protocols: string[];
  max_risk_score: number;
  min_liquidity_score: number;
  rebalance_threshold: number; // percentage deviation to trigger rebalance
}

export interface PortfolioOptimizationResult {
  optimized_portfolio: OptimizedPortfolio;
  rebalancing_plan: RebalancingPlan;
  performance_projection: PerformanceProjection;
  risk_analysis: PortfolioRiskAnalysis;
  recommendations: PortfolioRecommendation[];
  alternative_strategies: AlternativeStrategy[];
}

export interface RebalancingPlan {
  transactions: RebalanceTransaction[];
  total_cost: {
    gas_fees: number;
    slippage: number;
    protocol_fees: number;
    total: number;
  };
  execution_priority: ExecutionStep[];
  optimal_timing: number;
  market_conditions_required: string[];
}

export interface RebalanceTransaction {
  action: 'buy' | 'sell' | 'stake' | 'unstake' | 'add_liquidity' | 'remove_liquidity';
  token: string;
  amount: number;
  protocol?: string;
  estimated_cost: number;
  priority: number;
  dependencies: string[];
}

export interface ExecutionStep {
  step: number;
  transactions: RebalanceTransaction[];
  estimated_time: number;
  risk_level: 'low' | 'medium' | 'high';
  conditions: string[];
}

export interface PerformanceProjection {
  timeframes: {
    '1week': ProjectionMetrics;
    '1month': ProjectionMetrics;
    '3month': ProjectionMetrics;
    '6month': ProjectionMetrics;
    '1year': ProjectionMetrics;
  };
  scenarios: {
    bull_market: ProjectionMetrics;
    bear_market: ProjectionMetrics;
    sideways_market: ProjectionMetrics;
  };
  monte_carlo_results: MonteCarloResults;
}

export interface ProjectionMetrics {
  expected_return: number;
  expected_yield: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  value_at_risk: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

export interface MonteCarloResults {
  simulations_count: number;
  return_distribution: {
    mean: number;
    std_dev: number;
    percentiles: {
      p5: number;
      p25: number;
      p50: number;
      p75: number;
      p95: number;
    };
  };
  probability_of_loss: number;
  probability_of_target_return: number;
}

export interface PortfolioRiskAnalysis {
  overall_risk_score: number;
  risk_breakdown: {
    market_risk: number;
    liquidity_risk: number;
    protocol_risk: number;
    concentration_risk: number;
    impermanent_loss_risk: number;
  };
  correlation_matrix: number[][];
  diversification_score: number;
  stress_test_results: StressTestResult[];
}

export interface StressTestResult {
  scenario: string;
  portfolio_impact: number;
  worst_performing_asset: string;
  recovery_time: number;
  risk_mitigation: string[];
}

export interface PortfolioRecommendation {
  type: 'allocation' | 'strategy' | 'risk_management' | 'yield_optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expected_impact: string;
  implementation_complexity: 'simple' | 'moderate' | 'complex';
  estimated_cost: number;
}

export interface AlternativeStrategy {
  name: string;
  description: string;
  expected_return: number;
  risk_level: number;
  implementation_cost: number;
  suitability_score: number;
  pros: string[];
  cons: string[];
}

/**
 * Modern Portfolio Theory Implementation for DeFi
 */
class ModernPortfolioTheory {
  /**
   * Calculate optimal portfolio weights using mean-variance optimization
   */
  calculateOptimalWeights(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    riskTolerance: number = 1.0
  ): number[] {
    const n = expectedReturns.length;
    
    if (n === 0) return [];
    if (n === 1) return [1.0];

    // Convert to tensors
    const returnsTensor = TensorUtils.createTensor(expectedReturns, [n]);
    const covTensor = TensorUtils.createTensor(
      covarianceMatrix.flat(), 
      [n, n]
    );

    // Solve the optimization problem using quadratic programming approximation
    // This is a simplified version - in production, would use proper QP solver
    const weights = this.approximateQPSolution(returnsTensor, covTensor, riskTolerance);
    
    // Normalize weights to sum to 1
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    return totalWeight > 0 ? weights.map(w => w / totalWeight) : weights;
  }

  private approximateQPSolution(
    returns: TensorData,
    covariance: TensorData,
    riskTolerance: number
  ): number[] {
    const n = returns.data.length;
    const weights = new Array(n).fill(1 / n); // Start with equal weights
    const learningRate = 0.01;
    const iterations = 1000;

    // Gradient descent approximation
    for (let iter = 0; iter < iterations; iter++) {
      const gradients = this.calculateGradient(returns, covariance, weights, riskTolerance);
      
      // Update weights
      for (let i = 0; i < n; i++) {
        weights[i] += learningRate * gradients[i];
        weights[i] = Math.max(0, weights[i]); // Non-negative constraint
      }
      
      // Normalize
      const sum = weights.reduce((s, w) => s + w, 0);
      if (sum > 0) {
        for (let i = 0; i < n; i++) {
          weights[i] /= sum;
        }
      }
    }

    return weights;
  }

  private calculateGradient(
    returns: TensorData,
    covariance: TensorData,
    weights: number[],
    riskTolerance: number
  ): number[] {
    const n = weights.length;
    const gradients = new Array(n).fill(0);

    // Gradient of utility function: U = E[r] - λ * Var[r]
    // ∂U/∂w_i = r_i - 2λ * Σ(w_j * σ_ij)
    
    for (let i = 0; i < n; i++) {
      gradients[i] = returns.data[i];
      
      // Subtract risk term
      for (let j = 0; j < n; j++) {
        const covarianceValue = covariance.data[i * n + j];
        gradients[i] -= 2 * riskTolerance * weights[j] * covarianceValue;
      }
    }

    return gradients;
  }

  /**
   * Calculate portfolio risk metrics
   */
  calculatePortfolioRisk(
    weights: number[],
    covarianceMatrix: number[][]
  ): { variance: number; volatility: number } {
    const n = weights.length;
    let variance = 0;

    // Portfolio variance: w^T * Σ * w
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * covarianceMatrix[i][j];
      }
    }

    return {
      variance,
      volatility: Math.sqrt(variance)
    };
  }

  /**
   * Calculate efficient frontier points
   */
  calculateEfficientFrontier(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    numPoints: number = 50
  ): Array<{ risk: number; return: number; weights: number[] }> {
    const frontier: Array<{ risk: number; return: number; weights: number[] }> = [];
    
    // Calculate range of risk tolerance values
    const minRiskTolerance = 0.1;
    const maxRiskTolerance = 10.0;
    const step = (maxRiskTolerance - minRiskTolerance) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const riskTolerance = minRiskTolerance + i * step;
      const weights = this.calculateOptimalWeights(expectedReturns, covarianceMatrix, riskTolerance);
      
      const expectedReturn = this.calculatePortfolioReturn(weights, expectedReturns);
      const riskMetrics = this.calculatePortfolioRisk(weights, covarianceMatrix);
      
      frontier.push({
        risk: riskMetrics.volatility,
        return: expectedReturn,
        weights: [...weights]
      });
    }

    return frontier.sort((a, b) => a.risk - b.risk);
  }

  private calculatePortfolioReturn(weights: number[], expectedReturns: number[]): number {
    return weights.reduce((sum, weight, i) => sum + weight * expectedReturns[i], 0);
  }
}

/**
 * Yield Farming Strategy Optimizer
 */
class YieldFarmingOptimizer {
  /**
   * Find optimal yield farming opportunities
   */
  optimizeYieldFarming(
    availableCapital: number,
    riskTolerance: number,
    protocols: YieldFarmingProtocol[]
  ): YieldFarmingAllocation[] {
    const allocations: YieldFarmingAllocation[] = [];
    
    // Score each protocol
    const scoredProtocols = protocols.map(protocol => ({
      ...protocol,
      score: this.calculateYieldScore(protocol, riskTolerance)
    })).sort((a, b) => b.score - a.score);

    let remainingCapital = availableCapital;
    
    // Allocate capital to top-scoring protocols
    for (const protocol of scoredProtocols) {
      if (remainingCapital <= 0) break;
      
      const maxAllocation = Math.min(
        remainingCapital,
        availableCapital * 0.3, // Max 30% per protocol
        protocol.max_deposit || Infinity
      );
      
      if (maxAllocation >= protocol.min_deposit) {
        const allocation = this.calculateOptimalAllocation(
          protocol,
          maxAllocation,
          riskTolerance
        );
        
        if (allocation > 0) {
          allocations.push({
            protocol: protocol.name,
            pool: protocol.pool,
            allocation_amount: allocation,
            allocation_percentage: (allocation / availableCapital) * 100,
            expected_apy: protocol.current_apy,
            risk_score: protocol.risk_score,
            impermanent_loss_risk: protocol.impermanent_loss_risk
          });
          
          remainingCapital -= allocation;
        }
      }
    }

    return allocations;
  }

  private calculateYieldScore(protocol: YieldFarmingProtocol, riskTolerance: number): number {
    // Risk-adjusted yield score
    const baseYield = protocol.current_apy;
    const riskAdjustment = 1 - (protocol.risk_score * (1 - riskTolerance));
    const liquidityBonus = Math.min(1, protocol.total_liquidity / 10000000); // Normalize by $10M
    const stabilityBonus = protocol.apy_stability || 0.5;
    
    return baseYield * riskAdjustment * liquidityBonus * stabilityBonus;
  }

  private calculateOptimalAllocation(
    protocol: YieldFarmingProtocol,
    maxAllocation: number,
    riskTolerance: number
  ): number {
    // Kelly criterion-inspired allocation
    const winProbability = 1 - (protocol.risk_score * 0.5); // Assume higher risk = higher failure chance
    const averageWin = protocol.current_apy / 100; // Convert percentage to decimal
    const averageLoss = 0.5; // Assume 50% loss on failure
    
    const kellyFraction = (winProbability * averageWin - (1 - winProbability) * averageLoss) / averageWin;
    const adjustedFraction = Math.max(0, Math.min(1, kellyFraction * riskTolerance));
    
    return maxAllocation * adjustedFraction;
  }
}

export interface YieldFarmingProtocol {
  name: string;
  pool: string;
  current_apy: number;
  risk_score: number; // 0-1
  total_liquidity: number;
  min_deposit: number;
  max_deposit?: number;
  impermanent_loss_risk: number; // 0-1
  apy_stability?: number; // 0-1, how stable the APY has been
}

export interface YieldFarmingAllocation {
  protocol: string;
  pool: string;
  allocation_amount: number;
  allocation_percentage: number;
  expected_apy: number;
  risk_score: number;
  impermanent_loss_risk: number;
}

/**
 * Risk Management Engine
 */
class RiskManager {
  /**
   * Calculate portfolio risk metrics
   */
  calculateRiskMetrics(
    portfolio: CurrentHolding[],
    correlationMatrix: number[][],
    volatilities: number[]
  ): PortfolioRiskAnalysis {
    const riskBreakdown = this.calculateRiskBreakdown(portfolio);
    const diversificationScore = this.calculateDiversificationScore(portfolio, correlationMatrix);
    const stressTestResults = this.performStressTests(portfolio);
    
    const overallRiskScore = this.calculateOverallRisk(riskBreakdown, diversificationScore);

    return {
      overall_risk_score: overallRiskScore,
      risk_breakdown: riskBreakdown,
      correlation_matrix: correlationMatrix,
      diversification_score: diversificationScore,
      stress_test_results: stressTestResults
    };
  }

  private calculateRiskBreakdown(portfolio: CurrentHolding[]): PortfolioRiskAnalysis['risk_breakdown'] {
    const totalValue = portfolio.reduce((sum, holding) => sum + holding.current_value_usd, 0);
    
    let marketRisk = 0;
    let liquidityRisk = 0;
    let protocolRisk = 0;
    let concentrationRisk = 0;
    let impermanentLossRisk = 0;

    portfolio.forEach(holding => {
      const weight = holding.current_value_usd / totalValue;
      
      // Market risk based on token volatility (simplified)
      marketRisk += weight * this.getTokenVolatility(holding.token);
      
      // Liquidity risk based on token/protocol liquidity
      liquidityRisk += weight * this.getLiquidityRisk(holding);
      
      // Protocol risk from staking/LP positions
      if (holding.staking_info) {
        protocolRisk += weight * this.getProtocolRisk(holding.staking_info.protocol);
      }
      if (holding.liquidity_info) {
        protocolRisk += weight * this.getProtocolRisk(holding.liquidity_info.protocol);
        impermanentLossRisk += weight * Math.abs(holding.liquidity_info.impermanent_loss) / holding.current_value_usd;
      }
    });

    // Concentration risk (Herfindahl index)
    concentrationRisk = portfolio.reduce((sum, holding) => {
      const weight = holding.current_value_usd / totalValue;
      return sum + weight * weight;
    }, 0);

    return {
      market_risk: Math.min(1, marketRisk),
      liquidity_risk: Math.min(1, liquidityRisk),
      protocol_risk: Math.min(1, protocolRisk),
      concentration_risk: Math.min(1, concentrationRisk),
      impermanent_loss_risk: Math.min(1, impermanentLossRisk)
    };
  }

  private getTokenVolatility(token: string): number {
    // Mock volatility data - in production would use historical price data
    const volatilities: Record<string, number> = {
      'SOL': 0.6,
      'BTC': 0.4,
      'ETH': 0.5,
      'USDC': 0.02,
      'USDT': 0.02,
      'BONK': 1.2,
      'WIF': 1.0
    };
    
    return volatilities[token] || 0.8; // Default high volatility for unknown tokens
  }

  private getLiquidityRisk(holding: CurrentHolding): number {
    // Mock liquidity risk calculation
    const liquidityScores: Record<string, number> = {
      'SOL': 0.1,
      'BTC': 0.05,
      'ETH': 0.08,
      'USDC': 0.02,
      'USDT': 0.02,
      'BONK': 0.4,
      'WIF': 0.3
    };
    
    return liquidityScores[holding.token] || 0.5;
  }

  private getProtocolRisk(protocol: string): number {
    // Protocol risk scores based on TVL, audit status, time in market
    const protocolRisks: Record<string, number> = {
      'Jupiter': 0.2,
      'Raydium': 0.3,
      'Orca': 0.25,
      'Solend': 0.35,
      'Marinade': 0.2,
      'Lido': 0.15
    };
    
    return protocolRisks[protocol] || 0.5;
  }

  private calculateDiversificationScore(
    portfolio: CurrentHolding[],
    correlationMatrix: number[][]
  ): number {
    const n = portfolio.length;
    if (n <= 1) return 0;

    // Calculate average correlation
    let totalCorrelation = 0;
    let correlationCount = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (correlationMatrix[i] && correlationMatrix[i][j] !== undefined) {
          totalCorrelation += Math.abs(correlationMatrix[i][j]);
          correlationCount++;
        }
      }
    }

    const avgCorrelation = correlationCount > 0 ? totalCorrelation / correlationCount : 0;
    
    // Diversification score inversely related to correlation
    return Math.max(0, 1 - avgCorrelation);
  }

  private performStressTests(portfolio: CurrentHolding[]): StressTestResult[] {
    const scenarios = [
      { name: 'Market Crash (-50%)', impact: -0.5 },
      { name: 'Crypto Winter (-80%)', impact: -0.8 },
      { name: 'DeFi Protocol Hack', impact: -0.3 },
      { name: 'Regulatory Crackdown', impact: -0.4 },
      { name: 'Liquidity Crisis', impact: -0.6 }
    ];

    return scenarios.map(scenario => {
      let worstAsset = '';
      let worstImpact = 0;
      
      const portfolioImpact = portfolio.reduce((totalImpact, holding, index) => {
        const assetImpact = this.calculateAssetStressImpact(holding, scenario.name);
        const weightedImpact = (holding.current_value_usd / this.getTotalPortfolioValue(portfolio)) * assetImpact;
        
        if (assetImpact < worstImpact) {
          worstImpact = assetImpact;
          worstAsset = holding.symbol;
        }
        
        return totalImpact + weightedImpact;
      }, 0);

      return {
        scenario: scenario.name,
        portfolio_impact: portfolioImpact,
        worst_performing_asset: worstAsset,
        recovery_time: Math.abs(portfolioImpact) * 365, // Days
        risk_mitigation: this.generateMitigationStrategies(scenario.name)
      };
    });
  }

  private calculateAssetStressImpact(holding: CurrentHolding, scenario: string): number {
    // Different assets react differently to different stress scenarios
    const assetType = this.categorizeAsset(holding.token);
    
    const stressImpacts: Record<string, Record<string, number>> = {
      'Market Crash (-50%)': {
        'stablecoin': -0.05,
        'major_crypto': -0.45,
        'altcoin': -0.65,
        'defi_token': -0.70
      },
      'Crypto Winter (-80%)': {
        'stablecoin': -0.02,
        'major_crypto': -0.75,
        'altcoin': -0.90,
        'defi_token': -0.95
      },
      'DeFi Protocol Hack': {
        'stablecoin': -0.01,
        'major_crypto': -0.10,
        'altcoin': -0.20,
        'defi_token': -0.50
      },
      'Regulatory Crackdown': {
        'stablecoin': -0.10,
        'major_crypto': -0.30,
        'altcoin': -0.60,
        'defi_token': -0.70
      },
      'Liquidity Crisis': {
        'stablecoin': -0.02,
        'major_crypto': -0.40,
        'altcoin': -0.70,
        'defi_token': -0.80
      }
    };

    return stressImpacts[scenario]?.[assetType] || -0.50;
  }

  private categorizeAsset(token: string): string {
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX'];
    const majorCrypto = ['BTC', 'ETH', 'SOL'];
    const defiTokens = ['UNI', 'AAVE', 'COMP', 'SNX', 'JUP'];
    
    if (stablecoins.includes(token)) return 'stablecoin';
    if (majorCrypto.includes(token)) return 'major_crypto';
    if (defiTokens.includes(token)) return 'defi_token';
    return 'altcoin';
  }

  private getTotalPortfolioValue(portfolio: CurrentHolding[]): number {
    return portfolio.reduce((sum, holding) => sum + holding.current_value_usd, 0);
  }

  private generateMitigationStrategies(scenario: string): string[] {
    const strategies: Record<string, string[]> = {
      'Market Crash (-50%)': [
        'Increase stablecoin allocation',
        'Implement stop-loss orders',
        'Consider hedging with options'
      ],
      'Crypto Winter (-80%)': [
        'Focus on high-yield staking',
        'Dollar-cost average during downturn',
        'Reduce leverage and risky positions'
      ],
      'DeFi Protocol Hack': [
        'Diversify across multiple protocols',
        'Monitor protocol audits regularly',
        'Keep smaller positions in newer protocols'
      ],
      'Regulatory Crackdown': [
        'Monitor regulatory developments',
        'Consider geographic diversification',
        'Maintain compliance documentation'
      ],
      'Liquidity Crisis': [
        'Maintain higher cash reserves',
        'Avoid illiquid tokens',
        'Use multiple DEX platforms'
      ]
    };
    
    return strategies[scenario] || ['Monitor situation closely', 'Consider position reduction'];
  }

  private calculateOverallRisk(
    riskBreakdown: PortfolioRiskAnalysis['risk_breakdown'],
    diversificationScore: number
  ): number {
    const weights = {
      market_risk: 0.3,
      liquidity_risk: 0.2,
      protocol_risk: 0.2,
      concentration_risk: 0.2,
      impermanent_loss_risk: 0.1
    };

    let weightedRisk = 0;
    weightedRisk += riskBreakdown.market_risk * weights.market_risk;
    weightedRisk += riskBreakdown.liquidity_risk * weights.liquidity_risk;
    weightedRisk += riskBreakdown.protocol_risk * weights.protocol_risk;
    weightedRisk += riskBreakdown.concentration_risk * weights.concentration_risk;
    weightedRisk += riskBreakdown.impermanent_loss_risk * weights.impermanent_loss_risk;

    // Adjust for diversification
    const diversificationAdjustment = 1 - (diversificationScore * 0.3);
    
    return Math.min(1, weightedRisk * diversificationAdjustment);
  }
}

/**
 * Main Portfolio Optimization Engine
 */
export class PortfolioOptimizationEngine {
  private modernPortfolioTheory: ModernPortfolioTheory;
  private yieldOptimizer: YieldFarmingOptimizer;
  private riskManager: RiskManager;

  constructor() {
    this.modernPortfolioTheory = new ModernPortfolioTheory();
    this.yieldOptimizer = new YieldFarmingOptimizer();
    this.riskManager = new RiskManager();
  }

  /**
   * Optimize portfolio allocation based on user preferences
   */
  async optimizePortfolio(request: PortfolioAnalysisRequest): Promise<PortfolioOptimizationResult> {
    try {
      // Get market data for analysis
      const marketData = await this.getMarketData(request.current_portfolio);
      
      // Calculate expected returns and covariance matrix
      const expectedReturns = await this.calculateExpectedReturns(request.current_portfolio);
      const covarianceMatrix = await this.calculateCovarianceMatrix(request.current_portfolio);
      
      // Determine risk tolerance parameter
      const riskTolerance = this.mapRiskToleranceToParameter(request.risk_tolerance);
      
      // Calculate optimal weights
      const optimalWeights = this.modernPortfolioTheory.calculateOptimalWeights(
        expectedReturns,
        covarianceMatrix,
        riskTolerance
      );

      // Build optimized portfolio
      const optimized_portfolio = await this.buildOptimizedPortfolio(
        request,
        optimalWeights,
        marketData
      );

      // Create rebalancing plan
      const rebalancing_plan = await this.createRebalancingPlan(
        request.current_portfolio,
        optimized_portfolio,
        request.constraints
      );

      // Generate performance projections
      const performance_projection = await this.generatePerformanceProjections(
        optimized_portfolio,
        marketData,
        request.time_horizon
      );

      // Analyze risks
      const risk_analysis = this.riskManager.calculateRiskMetrics(
        request.current_portfolio,
        covarianceMatrix,
        expectedReturns.map(r => Math.sqrt(r)) // Simplified volatility
      );

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        request,
        optimized_portfolio,
        risk_analysis,
        performance_projection
      );

      // Suggest alternative strategies
      const alternative_strategies = await this.generateAlternativeStrategies(
        request,
        marketData
      );

      return {
        optimized_portfolio,
        rebalancing_plan,
        performance_projection,
        risk_analysis,
        recommendations,
        alternative_strategies
      };

    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      throw error;
    }
  }

  /**
   * Analyze current portfolio performance and suggest improvements
   */
  async analyzeCurrentPortfolio(holdings: CurrentHolding[]): Promise<{
    performance_metrics: PortfolioPerformanceMetrics;
    improvement_suggestions: string[];
    risk_warnings: string[];
  }> {
    const totalValue = holdings.reduce((sum, h) => sum + h.current_value_usd, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + (h.cost_basis || h.current_value_usd), 0);
    const totalReturn = (totalValue - totalCostBasis) / totalCostBasis;

    // Calculate portfolio metrics
    const performance_metrics: PortfolioPerformanceMetrics = {
      total_value: totalValue,
      total_return: totalReturn,
      total_return_percentage: totalReturn * 100,
      current_yield: this.calculateCurrentYield(holdings),
      sharpe_ratio: await this.calculateSharpeRatio(holdings),
      max_drawdown: await this.calculateMaxDrawdown(holdings),
      diversification_score: this.calculateDiversification(holdings)
    };

    // Generate improvement suggestions
    const improvement_suggestions = this.generateImprovementSuggestions(holdings, performance_metrics);
    
    // Identify risk warnings
    const risk_warnings = this.identifyRiskWarnings(holdings);

    return {
      performance_metrics,
      improvement_suggestions,
      risk_warnings
    };
  }

  // Helper methods

  private async getMarketData(holdings: CurrentHolding[]): Promise<MarketData> {
    // Mock market data - in production would fetch real data
    const tokens = holdings.map(h => h.token);
    
    return {
      prices: this.getMockPrices(tokens),
      volumes: this.getMockVolumes(tokens),
      market_caps: this.getMockMarketCaps(tokens),
      volatilities: this.getMockVolatilities(tokens),
      correlations: this.getMockCorrelations(tokens),
      yield_rates: this.getMockYieldRates(tokens)
    };
  }

  private async calculateExpectedReturns(holdings: CurrentHolding[]): Promise<number[]> {
    // Calculate expected returns based on historical data and trends
    return holdings.map(holding => {
      // Mock calculation - in production would use sophisticated models
      const baseReturn = this.getHistoricalReturn(holding.token);
      const trendAdjustment = this.getTrendAdjustment(holding.token);
      const fundamentalScore = this.getFundamentalScore(holding.token);
      
      return baseReturn * (1 + trendAdjustment) * (1 + fundamentalScore);
    });
  }

  private async calculateCovarianceMatrix(holdings: CurrentHolding[]): Promise<number[][]> {
    const n = holdings.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Calculate covariance between each pair of assets
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          // Variance on diagonal
          matrix[i][j] = this.getAssetVariance(holdings[i].token);
        } else {
          // Covariance off diagonal
          matrix[i][j] = this.getAssetCovariance(holdings[i].token, holdings[j].token);
        }
      }
    }
    
    return matrix;
  }

  private mapRiskToleranceToParameter(riskTolerance: string): number {
    const mapping = {
      'conservative': 0.5,
      'moderate': 1.0,
      'aggressive': 2.0
    };
    
    return mapping[riskTolerance] || 1.0;
  }

  private async buildOptimizedPortfolio(
    request: PortfolioAnalysisRequest,
    weights: number[],
    marketData: MarketData
  ): Promise<OptimizedPortfolio> {
    const totalValue = request.current_portfolio.reduce((sum, h) => sum + h.current_value_usd, 0);
    
    const allocations: PortfolioAllocation[] = request.current_portfolio.map((holding, index) => {
      const targetValue = totalValue * weights[index];
      const targetPercentage = weights[index] * 100;
      
      // Determine optimal strategy for this allocation
      const strategy = this.determineOptimalStrategy(holding, targetPercentage);
      const expectedApy = this.getExpectedAPY(holding.token, strategy);
      const riskScore = this.getAssetRiskScore(holding.token);

      return {
        token: holding.token,
        symbol: holding.symbol,
        percentage: targetPercentage,
        amount: targetValue / marketData.prices[holding.token],
        usd_value: targetValue,
        strategy,
        protocol: this.getOptimalProtocol(holding.token, strategy),
        expected_apy: expectedApy,
        risk_score: riskScore
      };
    });

    // Calculate portfolio-level metrics
    const expectedReturn = this.calculatePortfolioReturn(allocations);
    const expectedRisk = this.calculatePortfolioRisk(allocations);
    const sharpeRatio = expectedRisk > 0 ? expectedReturn / expectedRisk : 0;
    const diversificationScore = this.calculatePortfolioDiversification(allocations);

    // Estimate costs
    const estimatedCosts = this.estimateRebalancingCosts(request.current_portfolio, allocations);

    return {
      allocations,
      expected_return: expectedReturn,
      expected_risk: expectedRisk,
      sharpe_ratio: sharpeRatio,
      diversification_score: diversificationScore,
      rebalancing_frequency: this.determineRebalancingFrequency(request.time_horizon),
      estimated_costs: estimatedCosts
    };
  }

  private async createRebalancingPlan(
    currentHoldings: CurrentHolding[],
    optimizedPortfolio: OptimizedPortfolio,
    constraints: PortfolioConstraints
  ): Promise<RebalancingPlan> {
    const transactions: RebalanceTransaction[] = [];
    let totalCost = { gas_fees: 0, slippage: 0, protocol_fees: 0, total: 0 };

    // Compare current vs target allocations
    for (const allocation of optimizedPortfolio.allocations) {
      const currentHolding = currentHoldings.find(h => h.token === allocation.token);
      const currentValue = currentHolding?.current_value_usd || 0;
      const targetValue = allocation.usd_value;
      const difference = targetValue - currentValue;
      
      if (Math.abs(difference) > targetValue * constraints.rebalance_threshold / 100) {
        const action: RebalanceTransaction['action'] = difference > 0 ? 'buy' : 'sell';
        const amount = Math.abs(difference);
        
        transactions.push({
          action,
          token: allocation.token,
          amount,
          protocol: allocation.protocol,
          estimated_cost: this.estimateTransactionCost(action, allocation.token, amount),
          priority: this.calculateTransactionPriority(difference, allocation.percentage),
          dependencies: this.getTransactionDependencies(action, allocation.token, transactions)
        });
      }
    }

    // Calculate total costs
    transactions.forEach(tx => {
      totalCost.gas_fees += tx.estimated_cost * 0.1; // Assume 10% gas
      totalCost.slippage += tx.estimated_cost * 0.05; // Assume 0.5% slippage
      totalCost.protocol_fees += tx.estimated_cost * 0.03; // Assume 0.3% protocol fee
      totalCost.total += tx.estimated_cost * 0.18;
    });

    // Create execution steps
    const execution_priority = this.createExecutionSteps(transactions);

    return {
      transactions,
      total_cost: totalCost,
      execution_priority,
      optimal_timing: Date.now() + 3600000, // 1 hour from now
      market_conditions_required: [
        'Low network congestion',
        'Stable market conditions',
        'Adequate liquidity in target assets'
      ]
    };
  }

  private async generatePerformanceProjections(
    portfolio: OptimizedPortfolio,
    marketData: MarketData,
    timeHorizon: string
  ): Promise<PerformanceProjection> {
    // Mock performance projections - in production would use Monte Carlo simulation
    const baseReturn = portfolio.expected_return;
    const baseVolatility = portfolio.expected_risk;
    
    const timeframes = {
      '1week': this.generateProjectionMetrics(baseReturn, baseVolatility, 1/52),
      '1month': this.generateProjectionMetrics(baseReturn, baseVolatility, 1/12),
      '3month': this.generateProjectionMetrics(baseReturn, baseVolatility, 0.25),
      '6month': this.generateProjectionMetrics(baseReturn, baseVolatility, 0.5),
      '1year': this.generateProjectionMetrics(baseReturn, baseVolatility, 1)
    };

    const scenarios = {
      bull_market: this.generateProjectionMetrics(baseReturn * 1.5, baseVolatility * 0.8, 1),
      bear_market: this.generateProjectionMetrics(baseReturn * 0.3, baseVolatility * 1.5, 1),
      sideways_market: this.generateProjectionMetrics(baseReturn * 0.8, baseVolatility * 0.6, 1)
    };

    const monte_carlo_results = this.runMonteCarloSimulation(baseReturn, baseVolatility, 10000);

    return {
      timeframes,
      scenarios,
      monte_carlo_results
    };
  }

  private async generateRecommendations(
    request: PortfolioAnalysisRequest,
    portfolio: OptimizedPortfolio,
    riskAnalysis: PortfolioRiskAnalysis,
    performance: PerformanceProjection
  ): Promise<PortfolioRecommendation[]> {
    const recommendations: PortfolioRecommendation[] = [];

    // Risk-based recommendations
    if (riskAnalysis.overall_risk_score > 0.7) {
      recommendations.push({
        type: 'risk_management',
        priority: 'high',
        title: 'Reduce Portfolio Risk',
        description: `Your portfolio has a high risk score (${(riskAnalysis.overall_risk_score * 100).toFixed(0)}%). Consider reducing exposure to volatile assets and increasing stablecoin allocation.`,
        expected_impact: 'Lower volatility and downside protection',
        implementation_complexity: 'simple',
        estimated_cost: 500
      });
    }

    // Diversification recommendations
    if (riskAnalysis.diversification_score < 0.6) {
      recommendations.push({
        type: 'allocation',
        priority: 'medium',
        title: 'Improve Diversification',
        description: 'Your portfolio could benefit from better diversification across different asset types and protocols.',
        expected_impact: 'Reduced concentration risk and smoother returns',
        implementation_complexity: 'moderate',
        estimated_cost: 300
      });
    }

    // Yield optimization recommendations
    const currentYield = this.calculateCurrentYield(request.current_portfolio);
    if (currentYield < 5) {
      recommendations.push({
        type: 'yield_optimization',
        priority: 'medium',
        title: 'Optimize Yield Generation',
        description: `Current portfolio yield is ${currentYield.toFixed(1)}%. Consider staking high-quality assets or providing liquidity to established pools.`,
        expected_impact: 'Increase passive income generation',
        implementation_complexity: 'moderate',
        estimated_cost: 200
      });
    }

    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  private async generateAlternativeStrategies(
    request: PortfolioAnalysisRequest,
    marketData: MarketData
  ): Promise<AlternativeStrategy[]> {
    const strategies: AlternativeStrategy[] = [];

    // DeFi yield farming strategy
    strategies.push({
      name: 'DeFi Yield Farming',
      description: 'Focus on high-yield liquidity provision and yield farming opportunities',
      expected_return: 0.15,
      risk_level: 0.7,
      implementation_cost: 1000,
      suitability_score: this.calculateSuitabilityScore(request, 'yield_farming'),
      pros: ['High potential returns', 'Passive income generation', 'Multiple revenue streams'],
      cons: ['Impermanent loss risk', 'Smart contract risk', 'High complexity']
    });

    // Conservative staking strategy
    strategies.push({
      name: 'Conservative Staking',
      description: 'Focus on staking established assets with reputable validators',
      expected_return: 0.08,
      risk_level: 0.3,
      implementation_cost: 100,
      suitability_score: this.calculateSuitabilityScore(request, 'staking'),
      pros: ['Low risk', 'Predictable returns', 'Simple implementation'],
      cons: ['Lower returns', 'Lock-up periods', 'Validator risk']
    });

    // Arbitrage bot strategy
    strategies.push({
      name: 'Automated Arbitrage',
      description: 'Use automated strategies to capture price differences across DEXs',
      expected_return: 0.25,
      risk_level: 0.8,
      implementation_cost: 5000,
      suitability_score: this.calculateSuitabilityScore(request, 'arbitrage'),
      pros: ['High potential returns', 'Market neutral', 'Automated execution'],
      cons: ['High technical complexity', 'Competition from MEV bots', 'Requires significant capital']
    });

    return strategies.sort((a, b) => b.suitability_score - a.suitability_score);
  }

  // Mock data and utility methods

  private getMockPrices(tokens: string[]): Record<string, number> {
    const mockPrices: Record<string, number> = {
      'SOL': 100,
      'BTC': 45000,
      'ETH': 3000,
      'USDC': 1,
      'USDT': 1,
      'BONK': 0.00001,
      'WIF': 2.5
    };
    
    const result: Record<string, number> = {};
    tokens.forEach(token => {
      result[token] = mockPrices[token] || 10;
    });
    
    return result;
  }

  private getMockVolumes(tokens: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    tokens.forEach(token => {
      result[token] = Math.random() * 100000000 + 10000000; // $10M - $110M
    });
    return result;
  }

  private getMockMarketCaps(tokens: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    tokens.forEach(token => {
      result[token] = Math.random() * 50000000000 + 1000000000; // $1B - $51B
    });
    return result;
  }

  private getMockVolatilities(tokens: string[]): Record<string, number> {
    const volatilities: Record<string, number> = {
      'SOL': 0.6,
      'BTC': 0.4,
      'ETH': 0.5,
      'USDC': 0.02,
      'USDT': 0.02,
      'BONK': 1.2,
      'WIF': 1.0
    };
    
    const result: Record<string, number> = {};
    tokens.forEach(token => {
      result[token] = volatilities[token] || 0.8;
    });
    
    return result;
  }

  private getMockCorrelations(tokens: string[]): number[][] {
    const n = tokens.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = Math.random() * 0.8 - 0.4; // -0.4 to 0.4
        }
      }
    }
    
    return matrix;
  }

  private getMockYieldRates(tokens: string[]): Record<string, number> {
    const yieldRates: Record<string, number> = {
      'SOL': 0.07,
      'ETH': 0.05,
      'USDC': 0.03,
      'USDT': 0.025
    };
    
    const result: Record<string, number> = {};
    tokens.forEach(token => {
      result[token] = yieldRates[token] || 0.02;
    });
    
    return result;
  }

  private getHistoricalReturn(token: string): number {
    const returns: Record<string, number> = {
      'SOL': 0.5,
      'BTC': 0.3,
      'ETH': 0.4,
      'USDC': 0.02,
      'USDT': 0.02,
      'BONK': 1.5,
      'WIF': 0.8
    };
    
    return returns[token] || 0.2;
  }

  private getTrendAdjustment(token: string): number {
    return (Math.random() - 0.5) * 0.2; // -10% to +10% adjustment
  }

  private getFundamentalScore(token: string): number {
    return (Math.random() - 0.5) * 0.1; // -5% to +5% adjustment
  }

  private getAssetVariance(token: string): number {
    const volatility = this.getMockVolatilities([token])[token];
    return volatility * volatility;
  }

  private getAssetCovariance(token1: string, token2: string): number {
    const vol1 = this.getMockVolatilities([token1])[token1];
    const vol2 = this.getMockVolatilities([token2])[token2];
    const correlation = Math.random() * 0.8 - 0.4; // Random correlation
    
    return vol1 * vol2 * correlation;
  }

  private determineOptimalStrategy(holding: CurrentHolding, targetPercentage: number): PortfolioAllocation['strategy'] {
    // Simple heuristic for strategy selection
    if (holding.symbol === 'USDC' || holding.symbol === 'USDT') {
      return targetPercentage > 20 ? 'lend' : 'hold';
    }
    if (holding.symbol === 'SOL' || holding.symbol === 'ETH') {
      return targetPercentage > 15 ? 'stake' : 'hold';
    }
    if (targetPercentage > 10) {
      return 'provide_liquidity';
    }
    return 'hold';
  }

  private getExpectedAPY(token: string, strategy: PortfolioAllocation['strategy']): number {
    const baseYields: Record<string, Record<string, number>> = {
      'SOL': { 'hold': 0, 'stake': 7, 'lend': 3, 'provide_liquidity': 12, 'farm': 15 },
      'USDC': { 'hold': 0, 'stake': 0, 'lend': 8, 'provide_liquidity': 5, 'farm': 10 },
      'ETH': { 'hold': 0, 'stake': 5, 'lend': 2, 'provide_liquidity': 8, 'farm': 12 }
    };
    
    return baseYields[token]?.[strategy] || 0;
  }

  private getAssetRiskScore(token: string): number {
    const riskScores: Record<string, number> = {
      'SOL': 0.6,
      'BTC': 0.4,
      'ETH': 0.5,
      'USDC': 0.1,
      'USDT': 0.1,
      'BONK': 0.9,
      'WIF': 0.8
    };
    
    return riskScores[token] || 0.7;
  }

  private getOptimalProtocol(token: string, strategy: PortfolioAllocation['strategy']): string | undefined {
    const protocolMapping: Record<string, Record<string, string>> = {
      'SOL': {
        'stake': 'Marinade',
        'lend': 'Solend',
        'provide_liquidity': 'Orca',
        'farm': 'Raydium'
      },
      'USDC': {
        'lend': 'Solend',
        'provide_liquidity': 'Orca',
        'farm': 'Tulip'
      }
    };
    
    return protocolMapping[token]?.[strategy];
  }

  private calculatePortfolioReturn(allocations: PortfolioAllocation[]): number {
    return allocations.reduce((sum, allocation) => {
      const baseReturn = this.getHistoricalReturn(allocation.token);
      const yieldBonus = allocation.expected_apy / 100;
      const weight = allocation.percentage / 100;
      
      return sum + weight * (baseReturn + yieldBonus);
    }, 0);
  }

  private calculatePortfolioRisk(allocations: PortfolioAllocation[]): number {
    // Simplified risk calculation
    return allocations.reduce((sum, allocation) => {
      const weight = allocation.percentage / 100;
      return sum + weight * allocation.risk_score;
    }, 0);
  }

  private calculatePortfolioDiversification(allocations: PortfolioAllocation[]): number {
    // Herfindahl index for concentration
    const concentrationIndex = allocations.reduce((sum, allocation) => {
      const weight = allocation.percentage / 100;
      return sum + weight * weight;
    }, 0);
    
    return 1 - concentrationIndex;
  }

  private determineRebalancingFrequency(timeHorizon: string): number {
    const frequencies: Record<string, number> = {
      '1week': 7,
      '1month': 30,
      '3month': 90,
      '6month': 180,
      '1year': 365
    };
    
    return frequencies[timeHorizon] || 90;
  }

  private estimateRebalancingCosts(
    current: CurrentHolding[],
    target: PortfolioAllocation[]
  ): OptimizedPortfolio['estimated_costs'] {
    // Mock cost estimation
    return {
      gas: 50,
      slippage: 25,
      fees: 30,
      total: 105
    };
  }

  private estimateTransactionCost(
    action: RebalanceTransaction['action'],
    token: string,
    amount: number
  ): number {
    const baseCosts: Record<string, number> = {
      'buy': 0.005,
      'sell': 0.005,
      'stake': 0.01,
      'unstake': 0.015,
      'add_liquidity': 0.01,
      'remove_liquidity': 0.01
    };
    
    return amount * (baseCosts[action] || 0.005);
  }

  private calculateTransactionPriority(difference: number, percentage: number): number {
    const magnitudeScore = Math.abs(difference) / 10000; // Normalize by $10k
    const percentageScore = percentage / 100;
    
    return Math.min(10, magnitudeScore + percentageScore * 5);
  }

  private getTransactionDependencies(
    action: RebalanceTransaction['action'],
    token: string,
    existingTransactions: RebalanceTransaction[]
  ): string[] {
    // Simple dependency logic
    if (action === 'buy') {
      // Need to sell other assets first to free up capital
      const sellTx = existingTransactions.find(tx => tx.action === 'sell');
      return sellTx ? [sellTx.token] : [];
    }
    
    return [];
  }

  private createExecutionSteps(transactions: RebalanceTransaction[]): ExecutionStep[] {
    // Sort transactions by priority and dependencies
    const sortedTransactions = [...transactions].sort((a, b) => b.priority - a.priority);
    
    const steps: ExecutionStep[] = [];
    const processed = new Set<string>();
    
    let stepNumber = 1;
    while (processed.size < transactions.length) {
      const stepTransactions = sortedTransactions.filter(tx => 
        !processed.has(tx.token) && 
        tx.dependencies.every(dep => processed.has(dep))
      );
      
      if (stepTransactions.length === 0) break; // Avoid infinite loop
      
      steps.push({
        step: stepNumber++,
        transactions: stepTransactions,
        estimated_time: stepTransactions.length * 2, // 2 minutes per transaction
        risk_level: stepTransactions.some(tx => tx.priority > 7) ? 'high' : 'medium',
        conditions: ['Market stability', 'Adequate liquidity']
      });
      
      stepTransactions.forEach(tx => processed.add(tx.token));
    }
    
    return steps;
  }

  private generateProjectionMetrics(
    baseReturn: number,
    baseVolatility: number,
    timeMultiplier: number
  ): ProjectionMetrics {
    const expectedReturn = baseReturn * timeMultiplier;
    const volatility = baseVolatility * Math.sqrt(timeMultiplier);
    const sharpeRatio = volatility > 0 ? expectedReturn / volatility : 0;
    
    return {
      expected_return: expectedReturn,
      expected_yield: expectedReturn * 0.5, // Assume half comes from yield
      volatility,
      sharpe_ratio: sharpeRatio,
      max_drawdown: volatility * 1.5,
      value_at_risk: -1.65 * volatility, // 95% VaR
      confidence_interval: {
        lower: expectedReturn - 1.96 * volatility,
        upper: expectedReturn + 1.96 * volatility
      }
    };
  }

  private runMonteCarloSimulation(
    expectedReturn: number,
    volatility: number,
    simulations: number
  ): MonteCarloResults {
    const results: number[] = [];
    
    for (let i = 0; i < simulations; i++) {
      // Generate random return using normal distribution approximation
      const randomReturn = expectedReturn + volatility * this.generateNormalRandom();
      results.push(randomReturn);
    }
    
    results.sort((a, b) => a - b);
    
    const mean = results.reduce((sum, r) => sum + r, 0) / results.length;
    const variance = results.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    
    const getPercentile = (p: number) => results[Math.floor(results.length * p / 100)];
    
    return {
      simulations_count: simulations,
      return_distribution: {
        mean,
        std_dev: stdDev,
        percentiles: {
          p5: getPercentile(5),
          p25: getPercentile(25),
          p50: getPercentile(50),
          p75: getPercentile(75),
          p95: getPercentile(95)
        }
      },
      probability_of_loss: results.filter(r => r < 0).length / results.length,
      probability_of_target_return: results.filter(r => r > expectedReturn).length / results.length
    };
  }

  private generateNormalRandom(): number {
    // Box-Muller transform for normal distribution
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private calculateCurrentYield(holdings: CurrentHolding[]): number {
    let totalYield = 0;
    let totalValue = 0;
    
    holdings.forEach(holding => {
      let yieldAmount = 0;
      
      if (holding.staking_info) {
        yieldAmount += holding.staking_info.staked_amount * holding.staking_info.current_apy / 100;
      }
      
      if (holding.liquidity_info) {
        yieldAmount += holding.liquidity_info.fees_earned; // Annualized
      }
      
      totalYield += yieldAmount;
      totalValue += holding.current_value_usd;
    });
    
    return totalValue > 0 ? (totalYield / totalValue) * 100 : 0;
  }

  private async calculateSharpeRatio(holdings: CurrentHolding[]): Promise<number> {
    // Mock Sharpe ratio calculation
    const totalReturn = this.calculateCurrentYield(holdings) / 100;
    const riskFreeRate = 0.02; // 2% risk-free rate
    const volatility = holdings.reduce((sum, h) => sum + this.getAssetVariance(h.token), 0) / holdings.length;
    
    return volatility > 0 ? (totalReturn - riskFreeRate) / Math.sqrt(volatility) : 0;
  }

  private async calculateMaxDrawdown(holdings: CurrentHolding[]): Promise<number> {
    // Mock max drawdown calculation
    return 0.25; // Assume 25% max drawdown
  }

  private calculateDiversification(holdings: CurrentHolding[]): number {
    const totalValue = holdings.reduce((sum, h) => sum + h.current_value_usd, 0);
    const concentrationIndex = holdings.reduce((sum, holding) => {
      const weight = holding.current_value_usd / totalValue;
      return sum + weight * weight;
    }, 0);
    
    return 1 - concentrationIndex;
  }

  private generateImprovementSuggestions(
    holdings: CurrentHolding[],
    metrics: PortfolioPerformanceMetrics
  ): string[] {
    const suggestions: string[] = [];
    
    if (metrics.diversification_score < 0.6) {
      suggestions.push('Improve diversification by reducing concentration in top holdings');
    }
    
    if (metrics.current_yield < 5) {
      suggestions.push('Consider staking or liquidity provision to increase yield generation');
    }
    
    if (metrics.sharpe_ratio < 1) {
      suggestions.push('Optimize risk-adjusted returns by rebalancing towards lower-risk assets');
    }
    
    return suggestions;
  }

  private identifyRiskWarnings(holdings: CurrentHolding[]): string[] {
    const warnings: string[] = [];
    const totalValue = holdings.reduce((sum, h) => sum + h.current_value_usd, 0);
    
    // Check concentration risk
    holdings.forEach(holding => {
      const percentage = (holding.current_value_usd / totalValue) * 100;
      if (percentage > 50) {
        warnings.push(`High concentration risk: ${holding.symbol} represents ${percentage.toFixed(0)}% of portfolio`);
      }
    });
    
    // Check protocol risk
    const protocolExposure = new Map<string, number>();
    holdings.forEach(holding => {
      if (holding.staking_info) {
        const current = protocolExposure.get(holding.staking_info.protocol) || 0;
        protocolExposure.set(holding.staking_info.protocol, current + holding.current_value_usd);
      }
    });
    
    protocolExposure.forEach((value, protocol) => {
      const percentage = (value / totalValue) * 100;
      if (percentage > 30) {
        warnings.push(`High protocol exposure: ${percentage.toFixed(0)}% allocated to ${protocol}`);
      }
    });
    
    return warnings;
  }

  private calculateSuitabilityScore(request: PortfolioAnalysisRequest, strategy: string): number {
    const riskToleranceScore = {
      'conservative': { 'yield_farming': 0.3, 'staking': 0.9, 'arbitrage': 0.1 },
      'moderate': { 'yield_farming': 0.7, 'staking': 0.6, 'arbitrage': 0.5 },
      'aggressive': { 'yield_farming': 0.9, 'staking': 0.4, 'arbitrage': 0.8 }
    };
    
    const timeHorizonScore = {
      '1week': { 'yield_farming': 0.3, 'staking': 0.2, 'arbitrage': 0.9 },
      '1month': { 'yield_farming': 0.5, 'staking': 0.4, 'arbitrage': 0.8 },
      '3month': { 'yield_farming': 0.7, 'staking': 0.6, 'arbitrage': 0.6 },
      '6month': { 'yield_farming': 0.8, 'staking': 0.8, 'arbitrage': 0.4 },
      '1year': { 'yield_farming': 0.9, 'staking': 0.9, 'arbitrage': 0.3 }
    };
    
    const riskScore = riskToleranceScore[request.risk_tolerance]?.[strategy] || 0.5;
    const timeScore = timeHorizonScore[request.time_horizon]?.[strategy] || 0.5;
    
    return (riskScore + timeScore) / 2;
  }
}

// Supporting types and interfaces
interface MarketData {
  prices: Record<string, number>;
  volumes: Record<string, number>;
  market_caps: Record<string, number>;
  volatilities: Record<string, number>;
  correlations: number[][];
  yield_rates: Record<string, number>;
}

interface PortfolioPerformanceMetrics {
  total_value: number;
  total_return: number;
  total_return_percentage: number;
  current_yield: number;
  sharpe_ratio: number;
  max_drawdown: number;
  diversification_score: number;
}

// Export singleton instance
export const portfolioOptimizationEngine = new PortfolioOptimizationEngine();

// Utility functions for UI integration
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function getRiskColor(riskScore: number): string {
  if (riskScore >= 0.8) return '#E74C3C'; // High risk - red
  if (riskScore >= 0.6) return '#F39C12'; // Medium-high risk - orange
  if (riskScore >= 0.4) return '#F1C40F'; // Medium risk - yellow
  if (riskScore >= 0.2) return '#27AE60'; // Low-medium risk - green
  return '#2ECC71'; // Low risk - light green
}

export function getStrategyIcon(strategy: PortfolioAllocation['strategy']): string {
  const icons = {
    'hold': '💎',
    'stake': '🔒',
    'lend': '🏦',
    'provide_liquidity': '💧',
    'farm': '🚜'
  };
  
  return icons[strategy] || '📊';
}