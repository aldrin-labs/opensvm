#!/usr/bin/env bun
/**
 * Kalshi Paper Trading System
 *
 * Simulates trades without real money using live market data.
 * Features:
 * - Virtual portfolio with configurable starting balance
 * - Realistic order execution simulation with slippage
 * - Full P&L tracking and performance metrics
 * - Position management identical to live trading
 * - Historical trade replay for backtesting
 * - Market data recording for offline testing
 */

import { EventEmitter } from 'events';
import {
  KalshiWebSocketClient,
  MarketDataAggregator,
  type OrderbookUpdate,
  type TradeUpdate,
  type AggregatedMarketData,
} from './mcp-kalshi-streaming.js';

// ============================================================================
// Types
// ============================================================================

export interface PaperTradingConfig {
  startingBalance: number;      // Starting balance in cents
  maxSlippage: number;          // Max slippage in cents
  executionDelay: number;       // Simulated execution delay in ms
  partialFillProbability: number; // Probability of partial fills (0-1)
  rejectProbability: number;    // Probability of order rejection (0-1)
  feeRate: number;              // Fee rate (e.g., 0.01 = 1%)
  enableSlippage: boolean;      // Enable slippage simulation
  enablePartialFills: boolean;  // Enable partial fill simulation
}

export interface VirtualPosition {
  ticker: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  entryTime: number;
  trades: VirtualTrade[];
}

export interface VirtualOrder {
  id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  type: 'limit' | 'market';
  quantity: number;
  price?: number;           // Limit price
  filledQuantity: number;
  avgFillPrice: number;
  status: 'pending' | 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';
  createdAt: number;
  updatedAt: number;
  fills: VirtualFill[];
  reason?: string;
}

export interface VirtualTrade {
  id: string;
  orderId: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  timestamp: number;
  pnl?: number;
}

export interface VirtualFill {
  quantity: number;
  price: number;
  fee: number;
  timestamp: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  balance: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positionCount: number;
  marginUsed: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgHoldTime: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  currentStreak: number;
}

// ============================================================================
// Paper Trading Engine
// ============================================================================

export class PaperTradingEngine extends EventEmitter {
  private config: PaperTradingConfig;
  private wsClient: KalshiWebSocketClient;
  private aggregator: MarketDataAggregator;

  // Portfolio state
  private balance: number;
  private startingBalance: number;
  private positions: Map<string, VirtualPosition> = new Map();
  private orders: Map<string, VirtualOrder> = new Map();
  private trades: VirtualTrade[] = [];
  private snapshots: PortfolioSnapshot[] = [];

  // Metrics
  private orderCounter = 0;
  private tradeCounter = 0;
  private consecutiveWins = 0;
  private consecutiveLosses = 0;
  private maxConsecutiveWins = 0;
  private maxConsecutiveLosses = 0;
  private peakEquity = 0;
  private maxDrawdown = 0;

  // Market data cache
  private marketPrices: Map<string, { yes: number; no: number; timestamp: number }> = new Map();

  constructor(
    config: Partial<PaperTradingConfig>,
    wsClient: KalshiWebSocketClient,
    aggregator: MarketDataAggregator
  ) {
    super();
    this.config = {
      startingBalance: 100000, // $1000 default
      maxSlippage: 2,
      executionDelay: 100,
      partialFillProbability: 0.1,
      rejectProbability: 0.02,
      feeRate: 0.01,
      enableSlippage: true,
      enablePartialFills: true,
      ...config,
    };

    this.wsClient = wsClient;
    this.aggregator = aggregator;
    this.balance = this.config.startingBalance;
    this.startingBalance = this.config.startingBalance;
    this.peakEquity = this.config.startingBalance;

    this.setupMarketDataListeners();
    this.startSnapshotRecording();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Market Data
  // ─────────────────────────────────────────────────────────────────────────

  private setupMarketDataListeners(): void {
    this.aggregator.on('marketUpdate', (data: AggregatedMarketData) => {
      this.updateMarketPrice(data);
      this.updatePositionPrices(data.ticker);
      this.checkOpenOrders(data.ticker);
    });
  }

  private updateMarketPrice(data: AggregatedMarketData): void {
    const yesPrice = data.orderbook.yes[0]?.price || 50;
    const noPrice = data.orderbook.no[0]?.price || 50;

    this.marketPrices.set(data.ticker, {
      yes: yesPrice,
      no: noPrice,
      timestamp: Date.now(),
    });
  }

  private updatePositionPrices(ticker: string): void {
    const prices = this.marketPrices.get(ticker);
    if (!prices) return;

    for (const [key, position] of Array.from(this.positions.entries())) {
      if (position.ticker !== ticker) continue;

      const newPrice = position.side === 'yes' ? prices.yes : prices.no;
      position.currentPrice = newPrice;
      position.unrealizedPnl = (newPrice - position.avgPrice) * position.quantity;
    }

    this.emit('positions_updated', this.getPositions());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Order Management
  // ─────────────────────────────────────────────────────────────────────────

  async submitOrder(params: {
    ticker: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    type: 'limit' | 'market';
    quantity: number;
    price?: number;
  }): Promise<VirtualOrder> {
    const orderId = `PO-${++this.orderCounter}-${Date.now()}`;

    // Validate order
    const validation = this.validateOrder(params);
    if (!validation.valid) {
      const order: VirtualOrder = {
        id: orderId,
        ...params,
        filledQuantity: 0,
        avgFillPrice: 0,
        status: 'rejected',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fills: [],
        reason: validation.reason,
      };
      this.orders.set(orderId, order);
      this.emit('order_rejected', order);
      return order;
    }

    // Simulate random rejection
    if (Math.random() < this.config.rejectProbability) {
      const order: VirtualOrder = {
        id: orderId,
        ...params,
        filledQuantity: 0,
        avgFillPrice: 0,
        status: 'rejected',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fills: [],
        reason: 'Simulated rejection (market conditions)',
      };
      this.orders.set(orderId, order);
      this.emit('order_rejected', order);
      return order;
    }

    const order: VirtualOrder = {
      id: orderId,
      ...params,
      filledQuantity: 0,
      avgFillPrice: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fills: [],
    };

    this.orders.set(orderId, order);
    this.emit('order_created', order);

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, this.config.executionDelay));

    // Try to execute
    await this.tryExecuteOrder(order);

    return order;
  }

  private validateOrder(params: {
    ticker: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    quantity: number;
    price?: number;
  }): { valid: boolean; reason?: string } {
    // Check if we have market data
    const prices = this.marketPrices.get(params.ticker);
    if (!prices) {
      return { valid: false, reason: 'No market data available' };
    }

    // Check quantity
    if (params.quantity <= 0) {
      return { valid: false, reason: 'Invalid quantity' };
    }

    // Check balance for buys
    if (params.action === 'buy') {
      const price = params.price || (params.side === 'yes' ? prices.yes : prices.no);
      const cost = price * params.quantity;
      const fee = cost * this.config.feeRate;

      if (cost + fee > this.balance) {
        return { valid: false, reason: 'Insufficient balance' };
      }
    }

    // Check position for sells
    if (params.action === 'sell') {
      const key = `${params.ticker}-${params.side}`;
      const position = this.positions.get(key);

      if (!position || position.quantity < params.quantity) {
        return { valid: false, reason: 'Insufficient position' };
      }
    }

    return { valid: true };
  }

  private async tryExecuteOrder(order: VirtualOrder): Promise<void> {
    const prices = this.marketPrices.get(order.ticker);
    if (!prices) {
      order.status = 'rejected';
      order.reason = 'No market data';
      order.updatedAt = Date.now();
      return;
    }

    const marketPrice = order.side === 'yes' ? prices.yes : prices.no;

    // For limit orders, check if price is acceptable
    if (order.type === 'limit' && order.price !== undefined) {
      if (order.action === 'buy' && marketPrice > order.price) {
        order.status = 'open';
        order.updatedAt = Date.now();
        this.emit('order_open', order);
        return;
      }
      if (order.action === 'sell' && marketPrice < order.price) {
        order.status = 'open';
        order.updatedAt = Date.now();
        this.emit('order_open', order);
        return;
      }
    }

    // Calculate execution price with slippage
    let executionPrice = marketPrice;
    if (this.config.enableSlippage) {
      const slippage = Math.random() * this.config.maxSlippage;
      if (order.action === 'buy') {
        executionPrice = Math.min(99, marketPrice + slippage);
      } else {
        executionPrice = Math.max(1, marketPrice - slippage);
      }
    }

    // Determine fill quantity (partial fills)
    let fillQuantity = order.quantity;
    if (this.config.enablePartialFills && Math.random() < this.config.partialFillProbability) {
      fillQuantity = Math.ceil(order.quantity * (0.3 + Math.random() * 0.7));
    }

    // Execute fill
    this.executeFill(order, fillQuantity, executionPrice);
  }

  private executeFill(order: VirtualOrder, quantity: number, price: number): void {
    const fee = price * quantity * this.config.feeRate;

    const fill: VirtualFill = {
      quantity,
      price,
      fee,
      timestamp: Date.now(),
    };

    order.fills.push(fill);
    order.filledQuantity += quantity;
    order.avgFillPrice = order.fills.reduce((sum, f) => sum + f.price * f.quantity, 0) / order.filledQuantity;
    order.updatedAt = Date.now();

    if (order.filledQuantity >= order.quantity) {
      order.status = 'filled';
    } else {
      order.status = 'partially_filled';
    }

    // Record trade
    const trade: VirtualTrade = {
      id: `PT-${++this.tradeCounter}`,
      orderId: order.id,
      ticker: order.ticker,
      side: order.side,
      action: order.action,
      quantity,
      price,
      fee,
      timestamp: Date.now(),
    };

    // Update balance and positions
    if (order.action === 'buy') {
      this.balance -= price * quantity + fee;
      this.addToPosition(order.ticker, order.side, quantity, price);
    } else {
      const pnl = this.reducePosition(order.ticker, order.side, quantity, price);
      this.balance += price * quantity - fee;
      trade.pnl = pnl; // Record realized P&L on sell trades
    }

    this.trades.push(trade);

    this.emit('fill', { order, fill, trade });
    this.emit('order_updated', order);

    // Update equity tracking
    this.updateEquityTracking();
  }

  private addToPosition(ticker: string, side: 'yes' | 'no', quantity: number, price: number): void {
    const key = `${ticker}-${side}`;
    const existing = this.positions.get(key);

    if (existing) {
      const newQty = existing.quantity + quantity;
      const newAvg = (existing.avgPrice * existing.quantity + price * quantity) / newQty;
      existing.quantity = newQty;
      existing.avgPrice = newAvg;
      existing.currentPrice = price;
    } else {
      const position: VirtualPosition = {
        ticker,
        side,
        quantity,
        avgPrice: price,
        currentPrice: price,
        unrealizedPnl: 0,
        realizedPnl: 0,
        entryTime: Date.now(),
        trades: [],
      };
      this.positions.set(key, position);
      this.emit('position_opened', position);
    }
  }

  private reducePosition(ticker: string, side: 'yes' | 'no', quantity: number, price: number): number {
    const key = `${ticker}-${side}`;
    const position = this.positions.get(key);

    if (!position) return 0;

    const pnl = (price - position.avgPrice) * quantity;
    position.realizedPnl += pnl;
    position.quantity -= quantity;

    // Update win/loss streaks
    if (pnl > 0) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.maxConsecutiveWins = Math.max(this.maxConsecutiveWins, this.consecutiveWins);
    } else if (pnl < 0) {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.maxConsecutiveLosses = Math.max(this.maxConsecutiveLosses, this.consecutiveLosses);
    }

    if (position.quantity <= 0) {
      this.positions.delete(key);
      this.emit('position_closed', { ...position, closePnl: pnl });
    }

    return pnl;
  }

  private checkOpenOrders(ticker: string): void {
    for (const order of Array.from(this.orders.values())) {
      if (order.ticker !== ticker) continue;
      if (order.status !== 'open' && order.status !== 'partially_filled') continue;

      this.tryExecuteOrder(order);
    }
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status === 'filled' || order.status === 'cancelled' || order.status === 'rejected') {
      return false;
    }

    order.status = 'cancelled';
    order.updatedAt = Date.now();
    this.emit('order_cancelled', order);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portfolio & Metrics
  // ─────────────────────────────────────────────────────────────────────────

  private updateEquityTracking(): void {
    const equity = this.getEquity();

    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    const drawdown = this.peakEquity - equity;
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }
  }

  private startSnapshotRecording(): void {
    // Record snapshot every minute
    setInterval(() => {
      this.recordSnapshot();
    }, 60000);

    // Initial snapshot
    this.recordSnapshot();
  }

  private recordSnapshot(): void {
    const snapshot: PortfolioSnapshot = {
      timestamp: Date.now(),
      balance: this.balance,
      equity: this.getEquity(),
      unrealizedPnl: this.getUnrealizedPnl(),
      realizedPnl: this.getRealizedPnl(),
      positionCount: this.positions.size,
      marginUsed: this.getMarginUsed(),
    };

    this.snapshots.push(snapshot);
    this.emit('snapshot', snapshot);

    // Keep last 24 hours of snapshots
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.snapshots = this.snapshots.filter(s => s.timestamp >= cutoff);
  }

  getBalance(): number {
    return this.balance;
  }

  getEquity(): number {
    return this.balance + this.getUnrealizedPnl();
  }

  getUnrealizedPnl(): number {
    let total = 0;
    for (const position of Array.from(this.positions.values())) {
      total += position.unrealizedPnl;
    }
    return total;
  }

  getRealizedPnl(): number {
    return this.trades
      .filter(t => t.action === 'sell')
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }

  getMarginUsed(): number {
    let total = 0;
    for (const position of Array.from(this.positions.values())) {
      total += position.avgPrice * position.quantity;
    }
    return total;
  }

  getPositions(): VirtualPosition[] {
    return Array.from(this.positions.values());
  }

  getOrders(status?: VirtualOrder['status']): VirtualOrder[] {
    const orders = Array.from(this.orders.values());
    return status ? orders.filter(o => o.status === status) : orders;
  }

  getTrades(limit?: number): VirtualTrade[] {
    return limit ? this.trades.slice(-limit) : this.trades;
  }

  getSnapshots(): PortfolioSnapshot[] {
    return this.snapshots;
  }

  getMetrics(): PerformanceMetrics {
    const equity = this.getEquity();
    const totalReturn = equity - this.startingBalance;
    const totalReturnPercent = (totalReturn / this.startingBalance) * 100;

    // Calculate returns for Sharpe/Sortino
    const returns: number[] = [];
    for (let i = 1; i < this.snapshots.length; i++) {
      const prevEquity = this.snapshots[i - 1].equity;
      const currEquity = this.snapshots[i].equity;
      returns.push((currEquity - prevEquity) / prevEquity);
    }

    const avgReturn = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;

    const stdDev = returns.length > 1
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
      : 1;

    const negativeReturns = returns.filter(r => r < 0);
    const downDev = negativeReturns.length > 0
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length)
      : 1;

    // Trade statistics
    const closedTrades = this.trades.filter(t => t.action === 'sell' && t.pnl !== undefined);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    // Calculate average hold time
    const holdTimes: number[] = [];
    for (const position of Array.from(this.positions.values())) {
      if (position.trades.length > 0) {
        const lastTrade = position.trades[position.trades.length - 1];
        holdTimes.push(Date.now() - position.entryTime);
      }
    }
    const avgHoldTime = holdTimes.length > 0
      ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
      : 0;

    return {
      totalReturn,
      totalReturnPercent,
      sharpeRatio: stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0, // Annualized
      sortinoRatio: downDev > 0 ? (avgReturn * Math.sqrt(252)) / downDev : 0,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: this.peakEquity > 0 ? (this.maxDrawdown / this.peakEquity) * 100 : 0,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      avgWin,
      avgLoss,
      avgHoldTime,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl || 0)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl || 0)) : 0,
      consecutiveWins: this.maxConsecutiveWins,
      consecutiveLosses: this.maxConsecutiveLosses,
      currentStreak: this.consecutiveWins > 0 ? this.consecutiveWins : -this.consecutiveLosses,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reset & Export
  // ─────────────────────────────────────────────────────────────────────────

  reset(): void {
    this.balance = this.config.startingBalance;
    this.positions.clear();
    this.orders.clear();
    this.trades = [];
    this.snapshots = [];
    this.orderCounter = 0;
    this.tradeCounter = 0;
    this.consecutiveWins = 0;
    this.consecutiveLosses = 0;
    this.maxConsecutiveWins = 0;
    this.maxConsecutiveLosses = 0;
    this.peakEquity = this.config.startingBalance;
    this.maxDrawdown = 0;

    this.emit('reset');
  }

  exportData(): {
    config: PaperTradingConfig;
    balance: number;
    positions: VirtualPosition[];
    orders: VirtualOrder[];
    trades: VirtualTrade[];
    snapshots: PortfolioSnapshot[];
    metrics: PerformanceMetrics;
  } {
    return {
      config: this.config,
      balance: this.balance,
      positions: this.getPositions(),
      orders: Array.from(this.orders.values()),
      trades: this.trades,
      snapshots: this.snapshots,
      metrics: this.getMetrics(),
    };
  }

  importData(data: ReturnType<typeof this.exportData>): void {
    this.balance = data.balance;
    this.positions = new Map(data.positions.map(p => [`${p.ticker}-${p.side}`, p]));
    this.orders = new Map(data.orders.map(o => [o.id, o]));
    this.trades = data.trades;
    this.snapshots = data.snapshots;

    this.emit('imported');
  }
}

// ============================================================================
// MCP Tools for Paper Trading
// ============================================================================

export const PAPER_TRADING_TOOLS = [
  {
    name: 'paper_submit_order',
    description: 'Submit a paper trading order (simulated)',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Contract side' },
        action: { type: 'string', enum: ['buy', 'sell'], description: 'Buy or sell' },
        type: { type: 'string', enum: ['limit', 'market'], description: 'Order type' },
        quantity: { type: 'number', description: 'Number of contracts' },
        price: { type: 'number', description: 'Limit price (optional for market orders)' },
      },
      required: ['ticker', 'side', 'action', 'type', 'quantity'],
    },
  },
  {
    name: 'paper_cancel_order',
    description: 'Cancel a paper trading order',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID to cancel' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'paper_get_balance',
    description: 'Get paper trading account balance and equity',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'paper_get_positions',
    description: 'Get all paper trading positions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'paper_get_orders',
    description: 'Get paper trading orders',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'open', 'filled', 'cancelled'], description: 'Filter by status' },
      },
    },
  },
  {
    name: 'paper_get_trades',
    description: 'Get paper trading history',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max trades to return' },
      },
    },
  },
  {
    name: 'paper_get_metrics',
    description: 'Get paper trading performance metrics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'paper_get_snapshots',
    description: 'Get portfolio equity snapshots over time',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'paper_reset',
    description: 'Reset paper trading account to starting balance',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'paper_export',
    description: 'Export paper trading data for analysis',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Factory
// ============================================================================

export function createPaperTradingEngine(
  config: Partial<PaperTradingConfig>,
  wsClient: KalshiWebSocketClient,
  aggregator: MarketDataAggregator
): PaperTradingEngine {
  return new PaperTradingEngine(config, wsClient, aggregator);
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PAPER_CONFIG: PaperTradingConfig = {
  startingBalance: 100000, // $1000
  maxSlippage: 2,
  executionDelay: 100,
  partialFillProbability: 0.1,
  rejectProbability: 0.02,
  feeRate: 0.01,
  enableSlippage: true,
  enablePartialFills: true,
};
