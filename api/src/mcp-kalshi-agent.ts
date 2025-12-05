#!/usr/bin/env bun
/**
 * Kalshi Autonomous Trading Agent
 *
 * An MCP-based autonomous trading agent that:
 * - Monitors markets for opportunities
 * - Executes trades within risk limits
 * - Manages positions and hedges
 * - Reports actions via MCP interface
 *
 * Safety Features:
 * - Position limits per market and total
 * - Max loss limits (daily, per-trade)
 * - Cooldown periods after losses
 * - Human approval for large trades
 * - Emergency stop functionality
 */

import { EventEmitter } from 'events';
import { KalshiAPIClient } from './mcp-kalshi-full.js';
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

export interface AgentConfig {
  // Trading limits
  maxPositionPerMarket: number;  // Max contracts per market
  maxTotalPosition: number;      // Max total contracts across all markets
  maxTradeSize: number;          // Max contracts per trade
  maxDailyLoss: number;          // Max loss before stopping (in cents)
  maxLossPerTrade: number;       // Max loss per trade (in cents)

  // Approval thresholds
  requireApprovalAbove: number;  // Require human approval for trades > this
  requireApprovalLoss: number;   // Require approval if unrealized loss > this

  // Timing
  minTimeBetweenTrades: number;  // Milliseconds between trades
  cooldownAfterLoss: number;     // Cooldown after losing trade (ms)

  // Strategy
  minSpread: number;             // Minimum spread to trade (cents)
  minVolume24h: number;          // Minimum 24h volume to consider
  maxSlippage: number;           // Maximum acceptable slippage (cents)

  // Risk
  stopLossPercent: number;       // Stop loss percentage
  takeProfitPercent: number;     // Take profit percentage
}

export interface Position {
  ticker: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  reason: string;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  realizedPnl?: number;
}

export interface Signal {
  type: 'buy' | 'sell' | 'hold';
  ticker: string;
  side: 'yes' | 'no';
  strength: number;     // 0-100
  confidence: number;   // 0-100
  reason: string;
  expectedValue: number;
  riskReward: number;
}

export interface AgentState {
  status: 'running' | 'paused' | 'stopped' | 'cooldown';
  positions: Map<string, Position>;
  trades: Trade[];
  dailyPnl: number;
  totalPnl: number;
  pendingApprovals: TradeApproval[];
  lastTradeTime: number;
  cooldownUntil: number;
  startTime: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
}

export interface TradeApproval {
  id: string;
  trade: Omit<Trade, 'id' | 'status'>;
  signal: Signal;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

export type AgentEvent =
  | { type: 'signal'; data: Signal }
  | { type: 'trade_executed'; data: Trade }
  | { type: 'trade_failed'; data: { trade: Trade; error: string } }
  | { type: 'position_opened'; data: Position }
  | { type: 'position_closed'; data: Position & { realizedPnl: number } }
  | { type: 'stop_loss'; data: Position }
  | { type: 'take_profit'; data: Position }
  | { type: 'approval_required'; data: TradeApproval }
  | { type: 'daily_limit_reached'; data: { dailyPnl: number; limit: number } }
  | { type: 'cooldown_started'; data: { reason: string; until: number } }
  | { type: 'status_changed'; data: { from: string; to: string; reason: string } };

// ============================================================================
// Trading Strategies
// ============================================================================

export interface Strategy {
  name: string;
  description: string;
  analyze(market: AggregatedMarketData, positions: Position[]): Signal | null;
}

/**
 * Mean Reversion Strategy
 * Trades when prices deviate significantly from recent average
 */
export const MeanReversionStrategy: Strategy = {
  name: 'mean_reversion',
  description: 'Trade reversions to mean price',

  analyze(market: AggregatedMarketData, positions: Position[]): Signal | null {
    if (market.trades.length < 10) return null;

    const recentPrices = market.trades.slice(-20).map(t => t.price);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const stdDev = Math.sqrt(
      recentPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / recentPrices.length
    );

    const currentPrice = market.orderbook.midPrice;
    const zScore = (currentPrice - mean) / stdDev;

    // Trade if price is > 2 standard deviations from mean
    if (Math.abs(zScore) < 2) return null;

    const existingPosition = positions.find(p => p.ticker === market.ticker);
    if (existingPosition) return null; // Don't add to existing positions

    if (zScore > 2) {
      // Price too high, expect reversion down - buy NO
      return {
        type: 'buy',
        ticker: market.ticker,
        side: 'no',
        strength: Math.min(100, zScore * 25),
        confidence: Math.min(100, market.volume1m * 2),
        reason: `Price ${currentPrice}c is ${zScore.toFixed(1)} std devs above mean ${mean.toFixed(1)}c`,
        expectedValue: Math.abs(currentPrice - mean) / 100, // Expected reversion magnitude
        riskReward: Math.abs(zScore),
      };
    } else {
      // Price too low, expect reversion up - buy YES
      return {
        type: 'buy',
        ticker: market.ticker,
        side: 'yes',
        strength: Math.min(100, Math.abs(zScore) * 25),
        confidence: Math.min(100, market.volume1m * 2),
        reason: `Price ${currentPrice}c is ${Math.abs(zScore).toFixed(1)} std devs below mean ${mean.toFixed(1)}c`,
        expectedValue: Math.abs(mean - currentPrice) / 100, // Expected reversion magnitude
        riskReward: Math.abs(zScore),
      };
    }
  },
};

/**
 * Momentum Strategy
 * Trade in the direction of recent price movement
 */
export const MomentumStrategy: Strategy = {
  name: 'momentum',
  description: 'Trade with price momentum',

  analyze(market: AggregatedMarketData, positions: Position[]): Signal | null {
    if (market.trades.length < 5) return null;

    const priceChange = market.priceChange1m;
    const volume = market.volume1m;

    // Need meaningful price change and volume
    if (Math.abs(priceChange) < 3 || volume < 10) return null;

    const existingPosition = positions.find(p => p.ticker === market.ticker);
    if (existingPosition) return null;

    const strength = Math.min(100, Math.abs(priceChange) * 10);
    const confidence = Math.min(100, volume * 5);

    if (priceChange > 0) {
      return {
        type: 'buy',
        ticker: market.ticker,
        side: 'yes',
        strength,
        confidence,
        reason: `Positive momentum: +${priceChange}c on ${volume} contracts`,
        expectedValue: priceChange / 100 * 0.5, // Conservative estimate
        riskReward: priceChange / 5,
      };
    } else {
      return {
        type: 'buy',
        ticker: market.ticker,
        side: 'no',
        strength,
        confidence,
        reason: `Negative momentum: ${priceChange}c on ${volume} contracts`,
        expectedValue: Math.abs(priceChange) / 100 * 0.5,
        riskReward: Math.abs(priceChange) / 5,
      };
    }
  },
};

/**
 * Spread Trading Strategy
 * Profit from bid-ask spread by market making
 */
export const SpreadStrategy: Strategy = {
  name: 'spread',
  description: 'Market make on wide spreads',

  analyze(market: AggregatedMarketData, positions: Position[]): Signal | null {
    const spread = market.orderbook.spread;
    if (spread < 5) return null; // Need at least 5c spread

    const existingPosition = positions.find(p => p.ticker === market.ticker);
    if (existingPosition) return null;

    // Place orders inside the spread
    const midPrice = market.orderbook.midPrice;

    return {
      type: 'buy',
      ticker: market.ticker,
      side: midPrice < 50 ? 'yes' : 'no', // Buy the cheaper side
      strength: Math.min(100, spread * 10),
      confidence: Math.min(100, spread * 5),
      reason: `Wide spread of ${spread}c, mid=${midPrice}c`,
      expectedValue: spread / 200, // Capture half the spread
      riskReward: spread / 10,
    };
  },
};

/**
 * Arbitrage Detection Strategy
 * Find mispriced markets (YES + NO != 100)
 */
export const ArbitrageStrategy: Strategy = {
  name: 'arbitrage',
  description: 'Exploit YES+NO pricing inefficiencies',

  analyze(market: AggregatedMarketData, positions: Position[]): Signal | null {
    const bestYesBid = market.orderbook.yes[0]?.price || 0;
    const bestNoBid = market.orderbook.no[0]?.price || 0;

    // Theoretical: buying YES at ask + NO at ask should = 100c
    // If sum < 100, there's potential profit
    const impliedTotal = bestYesBid + bestNoBid;
    const mispricing = 100 - impliedTotal;

    if (mispricing < 2) return null; // Need at least 2c mispricing

    // Don't add to existing positions
    const existingPosition = positions.find(p => p.ticker === market.ticker);
    if (existingPosition) return null;

    // Buy the side with better odds
    const side = bestYesBid > bestNoBid ? 'no' : 'yes';

    return {
      type: 'buy',
      ticker: market.ticker,
      side,
      strength: Math.min(100, mispricing * 20),
      confidence: 80, // High confidence in arbitrage
      reason: `Arbitrage: YES(${bestYesBid}c) + NO(${bestNoBid}c) = ${impliedTotal}c (${mispricing}c mispricing)`,
      expectedValue: mispricing / 100,
      riskReward: mispricing / 2,
    };
  },
};

// ============================================================================
// Trading Agent
// ============================================================================

export class KalshiTradingAgent extends EventEmitter {
  private config: AgentConfig;
  private apiClient: KalshiAPIClient;
  private wsClient: KalshiWebSocketClient;
  private aggregator: MarketDataAggregator;
  private strategies: Strategy[];
  private state: AgentState;
  private analysisInterval?: ReturnType<typeof setInterval>;
  private watchedMarkets: Set<string> = new Set();

  constructor(
    config: AgentConfig,
    apiClient: KalshiAPIClient,
    wsClient: KalshiWebSocketClient,
    aggregator: MarketDataAggregator,
    strategies: Strategy[] = [MeanReversionStrategy, MomentumStrategy, SpreadStrategy, ArbitrageStrategy]
  ) {
    super();
    this.config = config;
    this.apiClient = apiClient;
    this.wsClient = wsClient;
    this.aggregator = aggregator;
    this.strategies = strategies;

    this.state = {
      status: 'stopped',
      positions: new Map(),
      trades: [],
      dailyPnl: 0,
      totalPnl: 0,
      pendingApprovals: [],
      lastTradeTime: 0,
      cooldownUntil: 0,
      startTime: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.state.status === 'running') return;

    const previousStatus = this.state.status;
    this.state.status = 'running';
    this.state.startTime = Date.now();

    this.emitEvent({
      type: 'status_changed',
      data: { from: previousStatus, to: 'running', reason: 'Agent started' },
    });

    // Connect WebSocket
    await this.wsClient.connect();

    // Start analysis loop
    this.analysisInterval = setInterval(() => {
      this.runAnalysis();
    }, 1000); // Analyze every second

    // Setup position monitoring
    this.setupPositionMonitoring();

    console.error('[Agent] Started');
  }

  stop(): void {
    if (this.state.status === 'stopped') return;

    const previousStatus = this.state.status;
    this.state.status = 'stopped';

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    this.emitEvent({
      type: 'status_changed',
      data: { from: previousStatus, to: 'stopped', reason: 'Agent stopped' },
    });

    console.error('[Agent] Stopped');
  }

  pause(reason: string = 'Manual pause'): void {
    if (this.state.status !== 'running') return;

    this.state.status = 'paused';
    this.emitEvent({
      type: 'status_changed',
      data: { from: 'running', to: 'paused', reason },
    });
  }

  resume(): void {
    if (this.state.status !== 'paused') return;

    this.state.status = 'running';
    this.emitEvent({
      type: 'status_changed',
      data: { from: 'paused', to: 'running', reason: 'Resumed' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Market Management
  // ─────────────────────────────────────────────────────────────────────────

  watchMarket(ticker: string): void {
    if (this.watchedMarkets.has(ticker)) return;

    this.watchedMarkets.add(ticker);
    this.aggregator.subscribe([ticker]);
    console.error(`[Agent] Watching market: ${ticker}`);
  }

  unwatchMarket(ticker: string): void {
    this.watchedMarkets.delete(ticker);
  }

  getWatchedMarkets(): string[] {
    return Array.from(this.watchedMarkets);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analysis
  // ─────────────────────────────────────────────────────────────────────────

  private runAnalysis(): void {
    if (this.state.status !== 'running') return;
    if (Date.now() < this.state.cooldownUntil) return;

    // Check daily loss limit
    if (this.state.dailyPnl <= -this.config.maxDailyLoss) {
      this.emitEvent({
        type: 'daily_limit_reached',
        data: { dailyPnl: this.state.dailyPnl, limit: this.config.maxDailyLoss },
      });
      this.pause('Daily loss limit reached');
      return;
    }

    // Analyze each watched market
    for (const ticker of Array.from(this.watchedMarkets)) {
      const marketData = this.aggregator.getMarketData(ticker);
      if (!marketData) continue;

      this.analyzeMarket(marketData);
    }

    // Check positions for stop loss / take profit
    this.checkPositions();
  }

  private analyzeMarket(market: AggregatedMarketData): void {
    const positions = Array.from(this.state.positions.values());

    for (const strategy of this.strategies) {
      const signal = strategy.analyze(market, positions);
      if (!signal) continue;

      // Emit signal
      this.emitEvent({ type: 'signal', data: signal });

      // Only act on strong, confident signals
      if (signal.strength >= 50 && signal.confidence >= 50 && signal.riskReward >= 1.5) {
        this.processSignal(signal);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Signal Processing
  // ─────────────────────────────────────────────────────────────────────────

  private async processSignal(signal: Signal): Promise<void> {
    // Check time since last trade
    if (Date.now() - this.state.lastTradeTime < this.config.minTimeBetweenTrades) {
      return;
    }

    // Calculate trade size
    const tradeSize = this.calculateTradeSize(signal);
    if (tradeSize === 0) return;

    // Estimate cost
    const marketData = this.aggregator.getMarketData(signal.ticker);
    if (!marketData) return;

    const price = signal.side === 'yes'
      ? marketData.orderbook.yes[0]?.price || 50
      : marketData.orderbook.no[0]?.price || 50;

    const estimatedCost = price * tradeSize;

    // Check if approval required
    if (tradeSize > this.config.requireApprovalAbove || estimatedCost > this.config.requireApprovalLoss) {
      this.requestApproval(signal, tradeSize, price);
      return;
    }

    // Execute trade
    await this.executeTrade(signal, tradeSize, price);
  }

  private calculateTradeSize(signal: Signal): number {
    // Base size from signal strength
    let size = Math.ceil(signal.strength / 10);

    // Cap by max trade size
    size = Math.min(size, this.config.maxTradeSize);

    // Cap by position limits
    const currentPosition = this.state.positions.get(`${signal.ticker}-${signal.side}`);
    const positionSize = currentPosition?.quantity || 0;
    const maxAdditional = this.config.maxPositionPerMarket - positionSize;
    size = Math.min(size, maxAdditional);

    // Cap by total position limit
    const totalPosition = Array.from(this.state.positions.values())
      .reduce((sum, p) => sum + p.quantity, 0);
    const maxTotal = this.config.maxTotalPosition - totalPosition;
    size = Math.min(size, maxTotal);

    return Math.max(0, size);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trade Execution
  // ─────────────────────────────────────────────────────────────────────────

  private async executeTrade(signal: Signal, quantity: number, expectedPrice: number): Promise<void> {
    const tradeId = `T-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const trade: Trade = {
      id: tradeId,
      ticker: signal.ticker,
      side: signal.side,
      action: signal.type === 'buy' ? 'buy' : 'sell',
      quantity,
      price: expectedPrice,
      timestamp: Date.now(),
      reason: signal.reason,
      status: 'pending',
    };

    try {
      // Execute via API
      const result = await this.apiClient.post('/portfolio/orders', {
        ticker: signal.ticker,
        action: trade.action,
        side: signal.side,
        type: 'limit',
        count: quantity,
        yes_price: signal.side === 'yes' ? expectedPrice : undefined,
        no_price: signal.side === 'no' ? expectedPrice : undefined,
      });

      trade.status = 'filled';
      trade.price = result.order?.yes_price || result.order?.no_price || expectedPrice;

      this.state.trades.push(trade);
      this.state.lastTradeTime = Date.now();
      this.state.tradeCount++;

      // Update position
      this.updatePosition(trade);

      this.emitEvent({ type: 'trade_executed', data: trade });

    } catch (error) {
      trade.status = 'failed';
      this.state.trades.push(trade);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitEvent({
        type: 'trade_failed',
        data: { trade, error: errorMessage },
      });

      // Start cooldown after failed trade
      this.startCooldown('Trade execution failed');
    }
  }

  private updatePosition(trade: Trade): void {
    const key = `${trade.ticker}-${trade.side}`;
    const existing = this.state.positions.get(key);

    if (trade.action === 'buy') {
      if (existing) {
        // Add to position
        const newQty = existing.quantity + trade.quantity;
        const newAvg = (existing.avgPrice * existing.quantity + trade.price * trade.quantity) / newQty;
        existing.quantity = newQty;
        existing.avgPrice = newAvg;
        existing.currentPrice = trade.price;
      } else {
        // New position
        const position: Position = {
          ticker: trade.ticker,
          side: trade.side,
          quantity: trade.quantity,
          avgPrice: trade.price,
          currentPrice: trade.price,
          unrealizedPnl: 0,
          entryTime: Date.now(),
          stopLoss: trade.price * (1 - this.config.stopLossPercent / 100),
          takeProfit: trade.price * (1 + this.config.takeProfitPercent / 100),
        };
        this.state.positions.set(key, position);
        this.emitEvent({ type: 'position_opened', data: position });
      }
    } else {
      // Sell - reduce position
      if (existing) {
        const realizedPnl = (trade.price - existing.avgPrice) * trade.quantity;
        existing.quantity -= trade.quantity;
        this.state.dailyPnl += realizedPnl;
        this.state.totalPnl += realizedPnl;
        trade.realizedPnl = realizedPnl;

        if (realizedPnl > 0) this.state.winCount++;
        else this.state.lossCount++;

        if (existing.quantity <= 0) {
          this.state.positions.delete(key);
          this.emitEvent({
            type: 'position_closed',
            data: { ...existing, realizedPnl },
          });

          // Cooldown after loss
          if (realizedPnl < -this.config.maxLossPerTrade) {
            this.startCooldown('Large loss on trade');
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Position Monitoring
  // ─────────────────────────────────────────────────────────────────────────

  private setupPositionMonitoring(): void {
    this.aggregator.on('marketUpdate', (data: AggregatedMarketData) => {
      this.updatePositionPrices(data);
    });
  }

  private updatePositionPrices(market: AggregatedMarketData): void {
    for (const [key, position] of Array.from(this.state.positions)) {
      if (position.ticker !== market.ticker) continue;

      const price = position.side === 'yes'
        ? market.orderbook.yes[0]?.price || position.currentPrice
        : market.orderbook.no[0]?.price || position.currentPrice;

      position.currentPrice = price;
      position.unrealizedPnl = (price - position.avgPrice) * position.quantity;
    }
  }

  private checkPositions(): void {
    for (const [key, position] of Array.from(this.state.positions)) {
      // Check stop loss
      if (position.stopLoss && position.currentPrice <= position.stopLoss) {
        this.emitEvent({ type: 'stop_loss', data: position });
        this.closePosition(position, 'Stop loss triggered');
      }

      // Check take profit
      if (position.takeProfit && position.currentPrice >= position.takeProfit) {
        this.emitEvent({ type: 'take_profit', data: position });
        this.closePosition(position, 'Take profit triggered');
      }
    }
  }

  private async closePosition(position: Position, reason: string): Promise<void> {
    const signal: Signal = {
      type: 'sell',
      ticker: position.ticker,
      side: position.side,
      strength: 100,
      confidence: 100,
      reason,
      expectedValue: position.unrealizedPnl / 100,
      riskReward: 0,
    };

    await this.executeTrade(signal, position.quantity, position.currentPrice);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approval System
  // ─────────────────────────────────────────────────────────────────────────

  private requestApproval(signal: Signal, quantity: number, price: number): void {
    const approval: TradeApproval = {
      id: `A-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trade: {
        ticker: signal.ticker,
        side: signal.side,
        action: signal.type === 'buy' ? 'buy' : 'sell',
        quantity,
        price,
        timestamp: Date.now(),
        reason: signal.reason,
      },
      signal,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000, // 1 minute to approve
      status: 'pending',
    };

    this.state.pendingApprovals.push(approval);
    this.emitEvent({ type: 'approval_required', data: approval });
  }

  async approveTradeRequest(approvalId: string): Promise<boolean> {
    const approval = this.state.pendingApprovals.find(a => a.id === approvalId);
    if (!approval || approval.status !== 'pending') return false;

    if (Date.now() > approval.expiresAt) {
      approval.status = 'expired';
      return false;
    }

    approval.status = 'approved';
    await this.executeTrade(approval.signal, approval.trade.quantity, approval.trade.price);
    return true;
  }

  rejectTradeRequest(approvalId: string): boolean {
    const approval = this.state.pendingApprovals.find(a => a.id === approvalId);
    if (!approval || approval.status !== 'pending') return false;

    approval.status = 'rejected';
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cooldown
  // ─────────────────────────────────────────────────────────────────────────

  private startCooldown(reason: string): void {
    this.state.cooldownUntil = Date.now() + this.config.cooldownAfterLoss;
    this.emitEvent({
      type: 'cooldown_started',
      data: { reason, until: this.state.cooldownUntil },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────────────────

  getState(): AgentState {
    return this.state;
  }

  getPositions(): Position[] {
    return Array.from(this.state.positions.values());
  }

  getTrades(limit?: number): Trade[] {
    return limit ? this.state.trades.slice(-limit) : this.state.trades;
  }

  getPendingApprovals(): TradeApproval[] {
    return this.state.pendingApprovals.filter(a => a.status === 'pending');
  }

  getStatistics(): {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    dailyPnl: number;
    avgWin: number;
    avgLoss: number;
    sharpeRatio: number;
  } {
    const wins = this.state.trades.filter(t => (t.realizedPnl || 0) > 0);
    const losses = this.state.trades.filter(t => (t.realizedPnl || 0) < 0);

    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / wins.length
      : 0;
    const avgLoss = losses.length > 0
      ? losses.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / losses.length
      : 0;

    // Simple Sharpe approximation
    const returns = this.state.trades
      .filter(t => t.realizedPnl !== undefined)
      .map(t => t.realizedPnl!);
    const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length)
      : 1;
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

    return {
      totalTrades: this.state.tradeCount,
      winRate: this.state.tradeCount > 0 ? this.state.winCount / this.state.tradeCount * 100 : 0,
      totalPnl: this.state.totalPnl,
      dailyPnl: this.state.dailyPnl,
      avgWin,
      avgLoss,
      sharpeRatio,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Emission
  // ─────────────────────────────────────────────────────────────────────────

  private emitEvent(event: AgentEvent): void {
    this.emit(event.type, event.data);
    this.emit('event', event);
  }
}

// ============================================================================
// MCP Tools for Agent
// ============================================================================

export const AGENT_TOOLS = [
  {
    name: 'kalshi_agent_start',
    description: 'Start the autonomous trading agent',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_agent_stop',
    description: 'Stop the autonomous trading agent',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_agent_pause',
    description: 'Pause trading (keeps monitoring)',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for pausing' },
      },
    },
  },
  {
    name: 'kalshi_agent_resume',
    description: 'Resume trading after pause',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_agent_watch',
    description: 'Add market to agent watchlist',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker to watch' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi_agent_unwatch',
    description: 'Remove market from watchlist',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker to unwatch' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi_agent_status',
    description: 'Get agent status, positions, and statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_agent_positions',
    description: 'Get all open positions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_agent_trades',
    description: 'Get trade history',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max trades to return' },
      },
    },
  },
  {
    name: 'kalshi_agent_approvals',
    description: 'Get pending trade approvals',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kalshi_agent_approve',
    description: 'Approve a pending trade request',
    inputSchema: {
      type: 'object',
      properties: {
        approval_id: { type: 'string', description: 'Approval ID' },
      },
      required: ['approval_id'],
    },
  },
  {
    name: 'kalshi_agent_reject',
    description: 'Reject a pending trade request',
    inputSchema: {
      type: 'object',
      properties: {
        approval_id: { type: 'string', description: 'Approval ID' },
      },
      required: ['approval_id'],
    },
  },
  {
    name: 'kalshi_agent_config',
    description: 'Get or update agent configuration',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'object',
          description: 'Configuration updates (partial)',
        },
      },
    },
  },
];

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxPositionPerMarket: 100,
  maxTotalPosition: 500,
  maxTradeSize: 20,
  maxDailyLoss: 10000, // $100
  maxLossPerTrade: 2000, // $20

  requireApprovalAbove: 50,
  requireApprovalLoss: 5000, // $50

  minTimeBetweenTrades: 5000, // 5 seconds
  cooldownAfterLoss: 60000, // 1 minute

  minSpread: 3,
  minVolume24h: 50,
  maxSlippage: 2,

  stopLossPercent: 10,
  takeProfitPercent: 20,
};

// ============================================================================
// Factory
// ============================================================================

export function createTradingAgent(
  apiKeyId: string,
  privateKeyPem: string,
  config: Partial<AgentConfig> = {}
): KalshiTradingAgent {
  const fullConfig = { ...DEFAULT_AGENT_CONFIG, ...config };

  const apiClient = new KalshiAPIClient(
    'https://api.elections.kalshi.com/trade-api/v2',
    30000,
    apiKeyId,
    privateKeyPem
  );

  const wsClient = new KalshiWebSocketClient(
    'wss://api.elections.kalshi.com/trade-api/ws/v2',
    apiKeyId,
    privateKeyPem
  );

  const aggregator = new MarketDataAggregator(wsClient);

  return new KalshiTradingAgent(fullConfig, apiClient, wsClient, aggregator);
}

