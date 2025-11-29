/**
 * Strategy Engine
 *
 * Core engine for autonomous trading strategy execution.
 * Handles DCA, Grid, Mean Reversion, and other automated strategies.
 */

import { toast } from 'sonner';
import type {
  Strategy,
  DCAStrategy,
  GridStrategy,
  StrategyExecution,
  StrategyPerformance,
  StrategyAlert,
  FrequencyType,
} from './strategy-types';

export class StrategyEngine {
  private strategies: Map<string, Strategy> = new Map();
  private executions: Map<string, StrategyExecution[]> = new Map();
  private performance: Map<string, StrategyPerformance> = new Map();
  private alerts: StrategyAlert[] = [];

  constructor() {
    this.loadStrategies();
  }

  /**
   * Load strategies from localStorage
   */
  private loadStrategies(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('trading_strategies');
      if (saved) {
        const data = JSON.parse(saved);
        data.forEach((strategy: Strategy) => {
          this.strategies.set(strategy.id, {
            ...strategy,
            createdAt: new Date(strategy.createdAt),
            updatedAt: new Date(strategy.updatedAt),
            startDate: new Date(strategy.startDate),
            endDate: strategy.endDate ? new Date(strategy.endDate) : undefined,
            lastExecutedAt: strategy.lastExecutedAt ? new Date(strategy.lastExecutedAt) : undefined,
            nextExecutionAt: strategy.nextExecutionAt ? new Date(strategy.nextExecutionAt) : undefined,
          });
        });
      }

      const savedExec = localStorage.getItem('strategy_executions');
      if (savedExec) {
        const data = JSON.parse(savedExec);
        Object.entries(data).forEach(([strategyId, execs]) => {
          this.executions.set(
            strategyId,
            (execs as any[]).map(e => ({
              ...e,
              executedAt: new Date(e.executedAt),
            }))
          );
        });
      }

      const savedPerf = localStorage.getItem('strategy_performance');
      if (savedPerf) {
        const data = JSON.parse(savedPerf);
        Object.entries(data).forEach(([strategyId, perf]) => {
          this.performance.set(strategyId, {
            ...(perf as StrategyPerformance),
            lastUpdatedAt: new Date((perf as any).lastUpdatedAt),
          });
        });
      }
    } catch (error) {
      console.error('Failed to load strategies:', error);
    }
  }

  /**
   * Save strategies to localStorage
   */
  private saveStrategies(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('trading_strategies', JSON.stringify(Array.from(this.strategies.values())));

      const execData: Record<string, StrategyExecution[]> = {};
      this.executions.forEach((execs, strategyId) => {
        execData[strategyId] = execs;
      });
      localStorage.setItem('strategy_executions', JSON.stringify(execData));

      const perfData: Record<string, StrategyPerformance> = {};
      this.performance.forEach((perf, strategyId) => {
        perfData[strategyId] = perf;
      });
      localStorage.setItem('strategy_performance', JSON.stringify(perfData));
    } catch (error) {
      console.error('Failed to save strategies:', error);
    }
  }

  /**
   * Create a new DCA strategy
   */
  createDCAStrategy(
    userId: string,
    name: string,
    params: DCAStrategy['parameters']
  ): DCAStrategy {
    const strategy: DCAStrategy = {
      id: `dca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      type: 'DCA',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      startDate: new Date(),
      parameters: params,
      nextExecutionAt: this.calculateNextExecution(params.frequency, params),
    };

    this.strategies.set(strategy.id, strategy);
    this.executions.set(strategy.id, []);
    this.performance.set(strategy.id, this.initializePerformance(strategy.id));
    this.saveStrategies();

    this.addAlert({
      strategyId: strategy.id,
      type: 'INFO',
      message: `DCA strategy "${name}" created successfully`,
    });

    return strategy;
  }

  /**
   * Calculate next execution time based on frequency
   */
  private calculateNextExecution(
    frequency: FrequencyType,
    params: any
  ): Date {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case 'HOURLY':
        next.setHours(now.getHours() + 1, 0, 0, 0);
        break;

      case 'DAILY':
        next.setDate(now.getDate() + 1);
        next.setHours(params.hourOfDay || 9, 0, 0, 0);
        break;

      case 'WEEKLY':
        const dayOfWeek = params.dayOfWeek || 1; // Default Monday
        const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7 || 7;
        next.setDate(now.getDate() + daysUntilNext);
        next.setHours(params.hourOfDay || 9, 0, 0, 0);
        break;

      case 'BIWEEKLY':
        next.setDate(now.getDate() + 14);
        next.setHours(params.hourOfDay || 9, 0, 0, 0);
        break;

      case 'MONTHLY':
        next.setMonth(now.getMonth() + 1);
        next.setDate(params.dayOfMonth || 1);
        next.setHours(params.hourOfDay || 9, 0, 0, 0);
        break;
    }

    return next;
  }

  /**
   * Execute a DCA strategy
   */
  async executeDCAStrategy(strategy: DCAStrategy): Promise<StrategyExecution> {
    const execution: StrategyExecution = {
      id: `exec_${Date.now()}`,
      strategyId: strategy.id,
      executedAt: new Date(),
      success: false,
      details: {
        asset: strategy.parameters.asset,
        amount: 0,
        price: 0,
        usdValue: strategy.parameters.amountPerTrade,
        fee: 0,
      },
    };

    try {
      // Fetch current price
      const price = await this.fetchPrice(strategy.parameters.asset);

      // Check price condition if specified
      if (strategy.parameters.priceCondition) {
        const { type, price: conditionPrice } = strategy.parameters.priceCondition;
        if (type === 'BELOW' && price > conditionPrice) {
          execution.error = `Price $${price} is above condition $${conditionPrice}`;
          this.addAlert({
            strategyId: strategy.id,
            type: 'WARNING',
            message: `DCA skipped: ${execution.error}`,
          });
          return execution;
        }
        if (type === 'ABOVE' && price < conditionPrice) {
          execution.error = `Price $${price} is below condition $${conditionPrice}`;
          this.addAlert({
            strategyId: strategy.id,
            type: 'WARNING',
            message: `DCA skipped: ${execution.error}`,
          });
          return execution;
        }
      }

      // Calculate amount to buy
      const amount = strategy.parameters.amountPerTrade / price;
      const fee = strategy.parameters.amountPerTrade * 0.001; // 0.1% fee

      // Execute trade (mock for now)
      const txHash = await this.executeTrade({
        action: 'buy',
        asset: strategy.parameters.asset,
        quoteAsset: strategy.parameters.quoteAsset,
        amount,
        price,
      });

      execution.success = true;
      execution.txHash = txHash;
      execution.details = {
        asset: strategy.parameters.asset,
        amount,
        price,
        usdValue: strategy.parameters.amountPerTrade,
        fee,
      };

      // Update strategy
      strategy.lastExecutedAt = new Date();
      strategy.nextExecutionAt = this.calculateNextExecution(
        strategy.parameters.frequency,
        strategy.parameters
      );
      strategy.updatedAt = new Date();

      // Check if reached total investment limit
      const perf = this.performance.get(strategy.id)!;
      if (strategy.parameters.totalInvestment) {
        const totalInvested = perf.totalInvested + strategy.parameters.amountPerTrade;
        if (totalInvested >= strategy.parameters.totalInvestment) {
          strategy.status = 'COMPLETED';
          this.addAlert({
            strategyId: strategy.id,
            type: 'SUCCESS',
            message: `DCA completed! Total invested: $${totalInvested.toFixed(2)}`,
          });
        }
      }

      this.addAlert({
        strategyId: strategy.id,
        type: 'SUCCESS',
        message: `Bought ${amount.toFixed(4)} ${strategy.parameters.asset} at $${price.toFixed(2)}`,
      });

      toast.success(`DCA Executed`, {
        description: `${strategy.name}: Bought ${amount.toFixed(4)} ${strategy.parameters.asset}`,
      });
    } catch (error) {
      execution.success = false;
      execution.error = String(error);

      this.addAlert({
        strategyId: strategy.id,
        type: 'ERROR',
        message: `Execution failed: ${error}`,
      });

      toast.error(`DCA Failed`, {
        description: `${strategy.name}: ${error}`,
      });
    }

    // Save execution
    const executions = this.executions.get(strategy.id) || [];
    executions.push(execution);
    this.executions.set(strategy.id, executions);

    // Update performance
    this.updatePerformance(strategy.id, execution);

    // Update strategy in map
    this.strategies.set(strategy.id, strategy);
    this.saveStrategies();

    return execution;
  }

  /**
   * Mock trade execution (replace with real DEX integration)
   */
  private async executeTrade(params: any): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock transaction hash
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  /**
   * Fetch current price (mock implementation)
   */
  private async fetchPrice(asset: string): Promise<number> {
    // Mock prices
    const prices: Record<string, number> = {
      SOL: 200 + Math.random() * 20 - 10,
      BTC: 45000 + Math.random() * 2000 - 1000,
      ETH: 2500 + Math.random() * 200 - 100,
      BONK: 0.00001 + Math.random() * 0.000002,
    };

    return prices[asset] || 1;
  }

  /**
   * Initialize performance tracking
   */
  private initializePerformance(strategyId: string): StrategyPerformance {
    return {
      strategyId,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalInvested: 0,
      totalReceived: 0,
      averagePrice: 0,
      currentValue: 0,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      totalFees: 0,
      lastUpdatedAt: new Date(),
    };
  }

  /**
   * Update performance metrics after execution
   */
  private updatePerformance(strategyId: string, execution: StrategyExecution): void {
    const perf = this.performance.get(strategyId)!;

    perf.totalTrades++;
    if (execution.success) {
      perf.successfulTrades++;
      perf.totalInvested += execution.details.usdValue;
      perf.totalReceived += execution.details.amount;
      perf.totalFees += execution.details.fee;

      // Recalculate average price
      perf.averagePrice = perf.totalInvested / perf.totalReceived;

      // Update current value (would fetch real price in production)
      perf.currentValue = perf.totalReceived * execution.details.price;

      // Calculate PnL
      perf.unrealizedPnL = perf.currentValue - perf.totalInvested;
      perf.unrealizedPnLPercent = (perf.unrealizedPnL / perf.totalInvested) * 100;
    } else {
      perf.failedTrades++;
    }

    perf.lastUpdatedAt = new Date();
    this.performance.set(strategyId, perf);
  }

  /**
   * Add alert
   */
  private addAlert(alert: Omit<StrategyAlert, 'id' | 'createdAt' | 'read'>): void {
    this.alerts.push({
      id: `alert_${Date.now()}`,
      ...alert,
      createdAt: new Date(),
      read: false,
    });

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Get all strategies for a user
   */
  getStrategies(userId: string): Strategy[] {
    return Array.from(this.strategies.values()).filter(s => s.userId === userId);
  }

  /**
   * Get strategy by ID
   */
  getStrategy(strategyId: string): Strategy | undefined {
    return this.strategies.get(strategyId);
  }

  /**
   * Get executions for a strategy
   */
  getExecutions(strategyId: string): StrategyExecution[] {
    return this.executions.get(strategyId) || [];
  }

  /**
   * Get performance for a strategy
   */
  getPerformance(strategyId: string): StrategyPerformance | undefined {
    return this.performance.get(strategyId);
  }

  /**
   * Get alerts for a strategy
   */
  getAlerts(strategyId: string): StrategyAlert[] {
    return this.alerts.filter(a => a.strategyId === strategyId);
  }

  /**
   * Pause a strategy
   */
  pauseStrategy(strategyId: string): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.status = 'PAUSED';
      strategy.updatedAt = new Date();
      this.saveStrategies();

      this.addAlert({
        strategyId,
        type: 'INFO',
        message: 'Strategy paused',
      });
    }
  }

  /**
   * Resume a strategy
   */
  resumeStrategy(strategyId: string): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.status = 'ACTIVE';
      strategy.updatedAt = new Date();
      this.saveStrategies();

      this.addAlert({
        strategyId,
        type: 'INFO',
        message: 'Strategy resumed',
      });
    }
  }

  /**
   * Cancel a strategy
   */
  cancelStrategy(strategyId: string): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.status = 'CANCELLED';
      strategy.updatedAt = new Date();
      this.saveStrategies();

      this.addAlert({
        strategyId,
        type: 'INFO',
        message: 'Strategy cancelled',
      });
    }
  }

  /**
   * Check and execute due strategies (called by cron)
   */
  async checkAndExecuteStrategies(): Promise<void> {
    const now = new Date();

    for (const strategy of this.strategies.values()) {
      if (strategy.status !== 'ACTIVE') continue;
      if (!strategy.nextExecutionAt) continue;
      if (strategy.nextExecutionAt > now) continue;

      console.log(`Executing strategy: ${strategy.name}`);

      if (strategy.type === 'DCA') {
        await this.executeDCAStrategy(strategy as DCAStrategy);
      }
      // Add other strategy types here
    }
  }
}

// Singleton instance
export const strategyEngine = new StrategyEngine();
