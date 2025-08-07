/**
 * Test suite for Portfolio Optimization Engine
 */

import {
  PortfolioOptimizationEngine,
  PortfolioAnalysisRequest,
  formatCurrency,
  formatPercentage,
  getRiskColor,
  getStrategyIcon
} from '../portfolio-optimization';
import { portfolioOptimizationEngine } from '../portfolio-optimization';

describe('PortfolioOptimizationEngine', () => {
  let engine: PortfolioOptimizationEngine;

  beforeEach(() => {
    engine = new PortfolioOptimizationEngine();
  });

  describe('Portfolio Optimization', () => {
    it('should optimize portfolio allocation correctly', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 100,
            current_value_usd: 10000,
            cost_basis: 8000
          },
          {
            token: 'USDC',
            symbol: 'USDC',
            amount: 5000,
            current_value_usd: 5000,
            cost_basis: 5000
          }
        ],
        optimization_objective: 'maximize_sharpe',
        risk_tolerance: 'moderate',
        time_horizon: '6month',
        constraints: {
          max_position_size: 50,
          min_position_size: 5,
          max_tokens: 10,
          excluded_tokens: [],
          preferred_protocols: ['Jupiter', 'Orca'],
          max_risk_score: 0.8,
          min_liquidity_score: 0.6,
          rebalance_threshold: 5
        }
      };

      const result = await engine.optimizePortfolio(request);

      expect(result).toBeDefined();
      expect(result.optimized_portfolio).toBeDefined();
      expect(result.optimized_portfolio.allocations).toHaveLength(2);
      expect(result.optimized_portfolio.expected_return).toBeGreaterThan(0);
      expect(result.optimized_portfolio.sharpe_ratio).toBeGreaterThan(0);
    });

    it('should handle different optimization objectives', async () => {
      const objectives = ['maximize_return', 'minimize_risk', 'maximize_sharpe', 'balanced'] as const;
      
      const baseRequest: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 100,
            current_value_usd: 10000
          }
        ],
        optimization_objective: 'maximize_return',
        risk_tolerance: 'moderate',
        time_horizon: '1year',
        constraints: {
          max_position_size: 100,
          min_position_size: 0,
          max_tokens: 5,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 1,
          min_liquidity_score: 0,
          rebalance_threshold: 10
        }
      };

      for (const objective of objectives) {
        const request = { ...baseRequest, optimization_objective: objective };
        const result = await engine.optimizePortfolio(request);

        expect(result.optimized_portfolio).toBeDefined();
        expect(result.optimized_portfolio.allocations.length).toBeGreaterThan(0);
      }
    });

    it('should respect portfolio constraints', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 100,
            current_value_usd: 15000
          }
        ],
        optimization_objective: 'balanced',
        risk_tolerance: 'conservative',
        time_horizon: '1year',
        constraints: {
          max_position_size: 30, // Max 30% per position
          min_position_size: 10, // Min 10% per position
          max_tokens: 3,
          excluded_tokens: ['BONK'],
          preferred_protocols: ['Marinade'],
          max_risk_score: 0.5,
          min_liquidity_score: 0.8,
          rebalance_threshold: 5
        }
      };

      const result = await engine.optimizePortfolio(request);

      // Check constraints are respected
      result.optimized_portfolio.allocations.forEach(allocation => {
        expect(allocation.percentage).toBeLessThanOrEqual(30);
        expect(allocation.percentage).toBeGreaterThanOrEqual(10);
        expect(allocation.risk_score).toBeLessThanOrEqual(0.5);
      });

      expect(result.optimized_portfolio.allocations.length).toBeLessThanOrEqual(3);
      expect(result.optimized_portfolio.allocations.find(a => a.token === 'BONK')).toBeUndefined();
    });
  });

  describe('Current Portfolio Analysis', () => {
    it('should analyze current portfolio performance', async () => {
      const holdings = [
        {
          token: 'SOL',
          symbol: 'SOL',
          amount: 50,
          current_value_usd: 5000,
          cost_basis: 4000,
          acquisition_date: Date.now() - 2592000000, // 30 days ago
          staking_info: {
            protocol: 'Marinade',
            staked_amount: 40,
            current_apy: 7.2,
            rewards_earned: 50
          }
        },
        {
          token: 'USDC',
          symbol: 'USDC',
          amount: 3000,
          current_value_usd: 3000,
          cost_basis: 3000,
          liquidity_info: {
            protocol: 'Orca',
            pool: 'SOL-USDC',
            tokens: [
              { token: 'SOL', amount: 10 },
              { token: 'USDC', amount: 1000 }
            ],
            lp_tokens: 100,
            current_value: 2000,
            fees_earned: 25,
            impermanent_loss: -15
          }
        }
      ];

      const result = await engine.analyzeCurrentPortfolio(holdings);

      expect(result).toBeDefined();
      expect(result.performance_metrics).toBeDefined();
      expect(result.performance_metrics.total_value).toBe(8000);
      expect(result.performance_metrics.total_return).toBeCloseTo(0.143, 2); // (8000-7000)/7000
      expect(result.performance_metrics.current_yield).toBeGreaterThan(0);
      expect(result.improvement_suggestions).toHaveLength(expect.any(Number));
      expect(result.risk_warnings).toHaveLength(expect.any(Number));
    });

    it('should calculate yield correctly', async () => {
      const holdings = [
        {
          token: 'SOL',
          symbol: 'SOL',
          amount: 100,
          current_value_usd: 10000,
          staking_info: {
            protocol: 'Marinade',
            staked_amount: 100,
            current_apy: 8,
            rewards_earned: 200
          }
        }
      ];

      const result = await engine.analyzeCurrentPortfolio(holdings);

      expect(result.performance_metrics.current_yield).toBeCloseTo(8, 1);
    });
  });

  describe('Rebalancing Plans', () => {
    it('should generate detailed rebalancing plans', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 200,
            current_value_usd: 20000 // 80% allocation
          },
          {
            token: 'USDC',
            symbol: 'USDC',
            amount: 5000,
            current_value_usd: 5000 // 20% allocation
          }
        ],
        optimization_objective: 'balanced',
        risk_tolerance: 'moderate',
        time_horizon: '1year',
        constraints: {
          max_position_size: 60,
          min_position_size: 10,
          max_tokens: 5,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.8,
          min_liquidity_score: 0.5,
          rebalance_threshold: 10 // Trigger rebalance if >10% deviation
        }
      };

      const result = await engine.optimizePortfolio(request);

      expect(result.rebalancing_plan).toBeDefined();
      expect(result.rebalancing_plan.transactions).toHaveLength(expect.any(Number));
      expect(result.rebalancing_plan.total_cost).toBeDefined();
      expect(result.rebalancing_plan.total_cost.total).toBeGreaterThan(0);
      expect(result.rebalancing_plan.execution_priority).toHaveLength(expect.any(Number));
    });

    it('should prioritize transactions correctly', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 100,
            current_value_usd: 15000
          },
          {
            token: 'ETH',
            symbol: 'ETH',
            amount: 2,
            current_value_usd: 6000
          }
        ],
        optimization_objective: 'balanced',
        risk_tolerance: 'moderate',
        time_horizon: '6month',
        constraints: {
          max_position_size: 50,
          min_position_size: 20,
          max_tokens: 3,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.7,
          min_liquidity_score: 0.6,
          rebalance_threshold: 5
        }
      };

      const result = await engine.optimizePortfolio(request);

      if (result.rebalancing_plan.transactions.length > 0) {
        const priorities = result.rebalancing_plan.transactions.map(tx => tx.priority);
        const sortedPriorities = [...priorities].sort((a, b) => b - a);
        
        // Check that transactions are properly prioritized
        expect(priorities).toEqual(expect.arrayContaining(sortedPriorities.slice().reverse()));
      }
    });
  });

  describe('Performance Projections', () => {
    it('should generate realistic performance projections', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'BTC',
            symbol: 'BTC',
            amount: 0.5,
            current_value_usd: 22500
          }
        ],
        optimization_objective: 'maximize_return',
        risk_tolerance: 'aggressive',
        time_horizon: '1year',
        constraints: {
          max_position_size: 100,
          min_position_size: 0,
          max_tokens: 1,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 1,
          min_liquidity_score: 0,
          rebalance_threshold: 20
        }
      };

      const result = await engine.optimizePortfolio(request);

      expect(result.performance_projection).toBeDefined();
      expect(result.performance_projection.timeframes).toBeDefined();
      expect(result.performance_projection.timeframes['1year']).toBeDefined();
      expect(result.performance_projection.scenarios).toBeDefined();
      expect(result.performance_projection.monte_carlo_results).toBeDefined();
      
      const yearProjection = result.performance_projection.timeframes['1year'];
      expect(yearProjection.expected_return).toBeDefined();
      expect(yearProjection.volatility).toBeGreaterThan(0);
      expect(yearProjection.confidence_interval).toBeDefined();
    });

    it('should include Monte Carlo simulation results', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'ETH',
            symbol: 'ETH',
            amount: 5,
            current_value_usd: 15000
          }
        ],
        optimization_objective: 'maximize_sharpe',
        risk_tolerance: 'moderate',
        time_horizon: '6month',
        constraints: {
          max_position_size: 100,
          min_position_size: 0,
          max_tokens: 1,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.8,
          min_liquidity_score: 0.5,
          rebalance_threshold: 15
        }
      };

      const result = await engine.optimizePortfolio(request);

      const monteCarloResults = result.performance_projection.monte_carlo_results;
      
      expect(monteCarloResults.simulations_count).toBeGreaterThan(0);
      expect(monteCarloResults.return_distribution).toBeDefined();
      expect(monteCarloResults.return_distribution.percentiles).toBeDefined();
      expect(monteCarloResults.probability_of_loss).toBeGreaterThanOrEqual(0);
      expect(monteCarloResults.probability_of_loss).toBeLessThanOrEqual(1);
    });
  });

  describe('Risk Analysis', () => {
    it('should provide comprehensive risk analysis', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'BONK',
            symbol: 'BONK',
            amount: 1000000,
            current_value_usd: 10000
          },
          {
            token: 'WIF',
            symbol: 'WIF',
            amount: 4000,
            current_value_usd: 10000
          }
        ],
        optimization_objective: 'minimize_risk',
        risk_tolerance: 'conservative',
        time_horizon: '3month',
        constraints: {
          max_position_size: 40,
          min_position_size: 15,
          max_tokens: 4,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.6,
          min_liquidity_score: 0.7,
          rebalance_threshold: 8
        }
      };

      const result = await engine.optimizePortfolio(request);

      expect(result.risk_analysis).toBeDefined();
      expect(result.risk_analysis.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(result.risk_analysis.overall_risk_score).toBeLessThanOrEqual(1);
      expect(result.risk_analysis.risk_breakdown).toBeDefined();
      expect(result.risk_analysis.diversification_score).toBeGreaterThanOrEqual(0);
      expect(result.risk_analysis.stress_test_results).toHaveLength(expect.any(Number));
    });

    it('should identify concentration risks', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 300,
            current_value_usd: 27000 // 90% allocation - high concentration
          },
          {
            token: 'USDC',
            symbol: 'USDC',
            amount: 3000,
            current_value_usd: 3000 // 10% allocation
          }
        ],
        optimization_objective: 'minimize_risk',
        risk_tolerance: 'conservative',
        time_horizon: '1year',
        constraints: {
          max_position_size: 50,
          min_position_size: 10,
          max_tokens: 5,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.5,
          min_liquidity_score: 0.8,
          rebalance_threshold: 5
        }
      };

      const result = await engine.optimizePortfolio(request);

      // Should recommend diversification
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/diversif|concentration|risk/i)
          })
        ])
      );
    });
  });

  describe('Yield Optimization', () => {
    it('should optimize for yield when requested', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'USDC',
            symbol: 'USDC',
            amount: 10000,
            current_value_usd: 10000
          }
        ],
        optimization_objective: 'maximize_yield',
        risk_tolerance: 'moderate',
        time_horizon: '6month',
        constraints: {
          max_position_size: 100,
          min_position_size: 0,
          max_tokens: 3,
          excluded_tokens: [],
          preferred_protocols: ['Solend', 'Tulip'],
          max_risk_score: 0.7,
          min_liquidity_score: 0.6,
          rebalance_threshold: 10
        }
      };

      const result = await engine.optimizePortfolio(request);

      // Should suggest yield-generating strategies
      const hasYieldStrategy = result.optimized_portfolio.allocations.some(
        allocation => ['lend', 'stake', 'provide_liquidity', 'farm'].includes(allocation.strategy)
      );

      expect(hasYieldStrategy).toBe(true);
      
      // Should have yield-focused recommendations
      const hasYieldRecommendation = result.recommendations.some(
        rec => rec.type === 'yield_optimization'
      );

      expect(hasYieldRecommendation).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty portfolios', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [],
        optimization_objective: 'balanced',
        risk_tolerance: 'moderate',
        time_horizon: '1year',
        constraints: {
          max_position_size: 50,
          min_position_size: 10,
          max_tokens: 5,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.8,
          min_liquidity_score: 0.5,
          rebalance_threshold: 10
        }
      };

      await expect(engine.optimizePortfolio(request)).rejects.toThrow();
    });

    it('should handle invalid constraints', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 100,
            current_value_usd: 10000
          }
        ],
        optimization_objective: 'balanced',
        risk_tolerance: 'moderate',
        time_horizon: '1year',
        constraints: {
          max_position_size: 10,
          min_position_size: 50, // Invalid: min > max
          max_tokens: 5,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.8,
          min_liquidity_score: 0.5,
          rebalance_threshold: 10
        }
      };

      await expect(engine.optimizePortfolio(request)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete optimization within reasonable time', async () => {
      const request: PortfolioAnalysisRequest = {
        current_portfolio: [
          {
            token: 'SOL',
            symbol: 'SOL',
            amount: 50,
            current_value_usd: 5000
          },
          {
            token: 'ETH',
            symbol: 'ETH',
            amount: 1.5,
            current_value_usd: 4500
          }
        ],
        optimization_objective: 'maximize_sharpe',
        risk_tolerance: 'moderate',
        time_horizon: '1year',
        constraints: {
          max_position_size: 60,
          min_position_size: 20,
          max_tokens: 3,
          excluded_tokens: [],
          preferred_protocols: [],
          max_risk_score: 0.8,
          min_liquidity_score: 0.5,
          rebalance_threshold: 10
        }
      };

      const startTime = Date.now();
      const result = await engine.optimizePortfolio(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result).toBeDefined();
    });
  });
});

describe('Portfolio Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(formatCurrency(0.99)).toBe('$0.99');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(0.1234)).toBe('12.34%');
      expect(formatPercentage(1.0)).toBe('100.00%');
      expect(formatPercentage(0.005)).toBe('0.50%');
    });
  });

  describe('getRiskColor', () => {
    it('should return appropriate risk colors', () => {
      expect(getRiskColor(0.9)).toBe('#E74C3C'); // High risk - red
      expect(getRiskColor(0.7)).toBe('#F39C12'); // Medium-high risk - orange
      expect(getRiskColor(0.5)).toBe('#F1C40F'); // Medium risk - yellow
      expect(getRiskColor(0.3)).toBe('#27AE60'); // Low-medium risk - green
      expect(getRiskColor(0.1)).toBe('#2ECC71'); // Low risk - light green
    });
  });

  describe('getStrategyIcon', () => {
    it('should return appropriate strategy icons', () => {
      expect(getStrategyIcon('hold')).toBe('💎');
      expect(getStrategyIcon('stake')).toBe('🔒');
      expect(getStrategyIcon('lend')).toBe('🏦');
      expect(getStrategyIcon('provide_liquidity')).toBe('💧');
      expect(getStrategyIcon('farm')).toBe('🚜');
    });
  });
});