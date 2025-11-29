/**
 * Trading Strategy Types
 *
 * Type definitions for autonomous trading strategies (DCA, Grid, etc.)
 */

export type StrategyType = 'DCA' | 'GRID' | 'MEAN_REVERSION' | 'BREAKOUT' | 'ARBITRAGE';
export type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
export type FrequencyType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface BaseStrategy {
  id: string;
  userId: string; // Wallet address or user ID
  name: string;
  type: StrategyType;
  status: StrategyStatus;
  createdAt: Date;
  updatedAt: Date;
  startDate: Date;
  endDate?: Date; // Optional end date
  lastExecutedAt?: Date;
  nextExecutionAt?: Date;
}

export interface DCAStrategy extends BaseStrategy {
  type: 'DCA';
  parameters: {
    asset: string; // e.g., 'SOL', 'BTC'
    quoteAsset: string; // e.g., 'USDC', 'USD'
    amountPerTrade: number; // USD amount to invest each time
    frequency: FrequencyType;
    dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
    dayOfMonth?: number; // 1-31 for monthly
    hourOfDay?: number; // 0-23 for daily/hourly
    totalInvestment?: number; // Optional max total to invest
    priceCondition?: {
      type: 'BELOW' | 'ABOVE';
      price: number; // Only buy if price is below/above this
    };
  };
}

export interface GridStrategy extends BaseStrategy {
  type: 'GRID';
  parameters: {
    asset: string;
    quoteAsset: string;
    lowerPrice: number; // Bottom of grid
    upperPrice: number; // Top of grid
    gridLevels: number; // Number of buy/sell levels
    amountPerGrid: number; // Amount to trade at each level
    rebalanceOnFill: boolean; // Auto-rebalance when order fills
  };
}

export interface MeanReversionStrategy extends BaseStrategy {
  type: 'MEAN_REVERSION';
  parameters: {
    asset: string;
    quoteAsset: string;
    lookbackPeriod: number; // Days to calculate mean
    deviationPercent: number; // % deviation to trigger trade
    positionSize: number; // USD amount per trade
    maxPositions: number; // Max concurrent positions
  };
}

export type Strategy = DCAStrategy | GridStrategy | MeanReversionStrategy;

export interface StrategyExecution {
  id: string;
  strategyId: string;
  executedAt: Date;
  success: boolean;
  txHash?: string;
  error?: string;
  details: {
    asset: string;
    amount: number; // Token amount bought/sold
    price: number; // Execution price
    usdValue: number; // USD value of trade
    fee: number; // Transaction fee
  };
}

export interface StrategyPerformance {
  strategyId: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalInvested: number; // Total USD invested
  totalReceived: number; // Total token amount received
  averagePrice: number; // Average buy price
  currentValue: number; // Current value of holdings
  unrealizedPnL: number; // Profit/loss (current value - invested)
  unrealizedPnLPercent: number; // % return
  totalFees: number;
  lastUpdatedAt: Date;
}

export interface StrategyAlert {
  id: string;
  strategyId: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  createdAt: Date;
  read: boolean;
}
