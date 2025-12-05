#!/usr/bin/env bun
/**
 * Debate Prediction Market
 *
 * Allows users to bet on debate outcomes:
 * - Prediction: Will the AI debate consensus match actual proposal outcomes?
 * - Markets resolve when proposal is implemented and results measured
 * - CPMM-based trading for YES/NO shares
 * - Rewards accurate predictors, penalizes overconfident bettors
 */

import { EventEmitter } from 'events';
import { DebateResult } from './multi-agent-debate.js';

// ============================================================================
// Types
// ============================================================================

export interface DebateMarket {
  id: string;
  debateId: string;
  proposalTitle: string;
  debateRecommendation: 'support' | 'oppose' | 'abstain';
  debateConsensus: number;
  debateConfidence: number;

  // Market state
  status: 'open' | 'locked' | 'resolving' | 'resolved' | 'cancelled';
  createdAt: number;
  lockedAt?: number;
  resolvedAt?: number;

  // CPMM pool
  yesShares: number;
  noShares: number;
  k: number; // Constant product

  // Resolution
  actualOutcome?: 'correct' | 'incorrect' | 'partial';
  resolutionReason?: string;

  // Stats
  totalVolume: number;
  totalBets: number;
  uniqueTraders: Set<string>;
}

export interface Position {
  marketId: string;
  trader: string;
  yesShares: number;
  noShares: number;
  totalInvested: number;
  averagePrice: number;
  createdAt: number;
  lastTradeAt: number;
}

export interface Trade {
  id: string;
  marketId: string;
  trader: string;
  type: 'buy_yes' | 'buy_no' | 'sell_yes' | 'sell_no';
  amount: number; // Amount of underlying asset
  shares: number; // Shares received/sold
  price: number; // Average price
  timestamp: number;
}

export interface MarketResolution {
  marketId: string;
  outcome: 'correct' | 'incorrect' | 'partial';
  reason: string;
  measuredAt: number;
  // Comparison data
  predictedImpact?: {
    tvl?: number;
    users?: number;
    volume?: number;
  };
  actualImpact?: {
    tvl?: number;
    users?: number;
    volume?: number;
  };
}

export interface TraderStats {
  traderId: string;
  totalTrades: number;
  totalVolume: number;
  winningBets: number;
  losingBets: number;
  winRate: number;
  totalProfit: number;
  bestTrade: number;
  worstTrade: number;
  marketsParticipated: number;
}

export interface MarketConfig {
  initialLiquidity: number;
  minBet: number;
  maxBet: number;
  tradingFee: number; // Percentage
  lockBeforeResolution: number; // Hours before resolution to lock trading
  minResolutionTime: number; // Minimum hours before resolution allowed
}

// ============================================================================
// Debate Prediction Market
// ============================================================================

export class DebatePredictionMarket extends EventEmitter {
  private markets: Map<string, DebateMarket> = new Map();
  private positions: Map<string, Map<string, Position>> = new Map(); // marketId -> traderId -> Position
  private trades: Trade[] = [];
  private traderStats: Map<string, TraderStats> = new Map();
  private config: MarketConfig;
  private marketCounter = 0;
  private tradeCounter = 0;

  constructor(config: Partial<MarketConfig> = {}) {
    super();
    this.config = {
      initialLiquidity: config.initialLiquidity ?? 10000,
      minBet: config.minBet ?? 1,
      maxBet: config.maxBet ?? 1000,
      tradingFee: config.tradingFee ?? 0.02, // 2%
      lockBeforeResolution: config.lockBeforeResolution ?? 24, // 24 hours
      minResolutionTime: config.minResolutionTime ?? 48, // 48 hours
    };
  }

  // ===========================================================================
  // Market Creation
  // ===========================================================================

  /**
   * Create a prediction market for a debate outcome
   */
  createMarket(debateId: string, debateResult: DebateResult): string {
    this.marketCounter++;
    const id = `DMARKET-${this.marketCounter}`;

    const market: DebateMarket = {
      id,
      debateId,
      proposalTitle: debateResult.proposalTitle,
      debateRecommendation: debateResult.finalRecommendation,
      debateConsensus: debateResult.consensusStrength,
      debateConfidence: debateResult.aggregatedConfidence,
      status: 'open',
      createdAt: Date.now(),
      // Initialize CPMM pool with 50/50 odds
      yesShares: this.config.initialLiquidity,
      noShares: this.config.initialLiquidity,
      k: this.config.initialLiquidity * this.config.initialLiquidity,
      totalVolume: 0,
      totalBets: 0,
      uniqueTraders: new Set(),
    };

    this.markets.set(id, market);
    this.positions.set(id, new Map());

    this.emit('market_created', {
      marketId: id,
      debateId,
      recommendation: debateResult.finalRecommendation,
      consensus: debateResult.consensusStrength,
    });

    return id;
  }

  /**
   * Get market by ID
   */
  getMarket(marketId: string): DebateMarket | undefined {
    return this.markets.get(marketId);
  }

  /**
   * List all markets
   */
  listMarkets(status?: DebateMarket['status']): DebateMarket[] {
    const markets = Array.from(this.markets.values());
    if (status) {
      return markets.filter(m => m.status === status);
    }
    return markets;
  }

  // ===========================================================================
  // Trading
  // ===========================================================================

  /**
   * Get current market price (probability of YES)
   */
  getPrice(marketId: string): number {
    const market = this.markets.get(marketId);
    if (!market) return 0.5;

    // Price = noShares / (yesShares + noShares)
    return market.noShares / (market.yesShares + market.noShares);
  }

  /**
   * Buy YES shares (betting debate prediction is correct)
   */
  buyYes(marketId: string, trader: string, amount: number): Trade | null {
    const market = this.markets.get(marketId);
    if (!market || market.status !== 'open') return null;

    if (amount < this.config.minBet || amount > this.config.maxBet) return null;

    // Apply trading fee
    const amountAfterFee = amount * (1 - this.config.tradingFee);

    // CPMM: x * y = k
    // Buy YES means we're adding to NO pool and removing from YES pool
    // newYesShares * (noShares + amount) = k
    const newNoShares = market.noShares + amountAfterFee;
    const newYesShares = market.k / newNoShares;
    const sharesOut = market.yesShares - newYesShares;

    if (sharesOut <= 0) return null;

    // Update pool
    market.yesShares = newYesShares;
    market.noShares = newNoShares;
    market.totalVolume += amount;
    market.totalBets++;
    market.uniqueTraders.add(trader);

    // Record trade
    const trade = this.recordTrade(marketId, trader, 'buy_yes', amount, sharesOut);

    // Update position
    this.updatePosition(marketId, trader, sharesOut, 0, amount);

    this.emit('trade_executed', {
      marketId,
      trader,
      type: 'buy_yes',
      amount,
      shares: sharesOut,
      newPrice: this.getPrice(marketId),
    });

    return trade;
  }

  /**
   * Buy NO shares (betting debate prediction is wrong)
   */
  buyNo(marketId: string, trader: string, amount: number): Trade | null {
    const market = this.markets.get(marketId);
    if (!market || market.status !== 'open') return null;

    if (amount < this.config.minBet || amount > this.config.maxBet) return null;

    const amountAfterFee = amount * (1 - this.config.tradingFee);

    // Buy NO means adding to YES pool and removing from NO pool
    const newYesShares = market.yesShares + amountAfterFee;
    const newNoShares = market.k / newYesShares;
    const sharesOut = market.noShares - newNoShares;

    if (sharesOut <= 0) return null;

    market.yesShares = newYesShares;
    market.noShares = newNoShares;
    market.totalVolume += amount;
    market.totalBets++;
    market.uniqueTraders.add(trader);

    const trade = this.recordTrade(marketId, trader, 'buy_no', amount, sharesOut);
    this.updatePosition(marketId, trader, 0, sharesOut, amount);

    this.emit('trade_executed', {
      marketId,
      trader,
      type: 'buy_no',
      amount,
      shares: sharesOut,
      newPrice: this.getPrice(marketId),
    });

    return trade;
  }

  /**
   * Sell YES shares back to the pool
   */
  sellYes(marketId: string, trader: string, shares: number): Trade | null {
    const market = this.markets.get(marketId);
    if (!market || market.status !== 'open') return null;

    const position = this.getPosition(marketId, trader);
    if (!position || position.yesShares < shares) return null;

    // Sell YES means adding to YES pool and removing from NO pool
    const newYesShares = market.yesShares + shares;
    const newNoShares = market.k / newYesShares;
    const amountOut = market.noShares - newNoShares;

    if (amountOut <= 0) return null;

    const amountAfterFee = amountOut * (1 - this.config.tradingFee);

    market.yesShares = newYesShares;
    market.noShares = newNoShares;
    market.totalVolume += amountAfterFee;
    market.totalBets++;

    const trade = this.recordTrade(marketId, trader, 'sell_yes', amountAfterFee, shares);

    position.yesShares -= shares;
    position.lastTradeAt = Date.now();

    this.emit('trade_executed', {
      marketId,
      trader,
      type: 'sell_yes',
      amount: amountAfterFee,
      shares,
      newPrice: this.getPrice(marketId),
    });

    return trade;
  }

  /**
   * Sell NO shares back to the pool
   */
  sellNo(marketId: string, trader: string, shares: number): Trade | null {
    const market = this.markets.get(marketId);
    if (!market || market.status !== 'open') return null;

    const position = this.getPosition(marketId, trader);
    if (!position || position.noShares < shares) return null;

    const newNoShares = market.noShares + shares;
    const newYesShares = market.k / newNoShares;
    const amountOut = market.yesShares - newYesShares;

    if (amountOut <= 0) return null;

    const amountAfterFee = amountOut * (1 - this.config.tradingFee);

    market.yesShares = newYesShares;
    market.noShares = newNoShares;
    market.totalVolume += amountAfterFee;
    market.totalBets++;

    const trade = this.recordTrade(marketId, trader, 'sell_no', amountAfterFee, shares);

    position.noShares -= shares;
    position.lastTradeAt = Date.now();

    this.emit('trade_executed', {
      marketId,
      trader,
      type: 'sell_no',
      amount: amountAfterFee,
      shares,
      newPrice: this.getPrice(marketId),
    });

    return trade;
  }

  private recordTrade(
    marketId: string,
    trader: string,
    type: Trade['type'],
    amount: number,
    shares: number
  ): Trade {
    this.tradeCounter++;
    const trade: Trade = {
      id: `TRADE-${this.tradeCounter}`,
      marketId,
      trader,
      type,
      amount,
      shares,
      price: amount / shares,
      timestamp: Date.now(),
    };

    this.trades.push(trade);
    return trade;
  }

  private updatePosition(
    marketId: string,
    trader: string,
    yesSharesDelta: number,
    noSharesDelta: number,
    invested: number
  ): void {
    const positions = this.positions.get(marketId)!;
    let position = positions.get(trader);

    if (!position) {
      position = {
        marketId,
        trader,
        yesShares: 0,
        noShares: 0,
        totalInvested: 0,
        averagePrice: 0,
        createdAt: Date.now(),
        lastTradeAt: Date.now(),
      };
      positions.set(trader, position);
    }

    position.yesShares += yesSharesDelta;
    position.noShares += noSharesDelta;
    position.totalInvested += invested;
    position.lastTradeAt = Date.now();

    const totalShares = position.yesShares + position.noShares;
    if (totalShares > 0) {
      position.averagePrice = position.totalInvested / totalShares;
    }
  }

  /**
   * Get trader's position in a market
   */
  getPosition(marketId: string, trader: string): Position | undefined {
    return this.positions.get(marketId)?.get(trader);
  }

  /**
   * Get all positions for a trader
   */
  getTraderPositions(trader: string): Position[] {
    const positions: Position[] = [];
    for (const [, marketPositions] of this.positions) {
      const pos = marketPositions.get(trader);
      if (pos) positions.push(pos);
    }
    return positions;
  }

  // ===========================================================================
  // Market Lifecycle
  // ===========================================================================

  /**
   * Lock market for trading (before resolution)
   */
  lockMarket(marketId: string): boolean {
    const market = this.markets.get(marketId);
    if (!market || market.status !== 'open') return false;

    market.status = 'locked';
    market.lockedAt = Date.now();

    this.emit('market_locked', { marketId });
    return true;
  }

  /**
   * Resolve market with actual outcome
   */
  resolveMarket(marketId: string, resolution: MarketResolution): boolean {
    const market = this.markets.get(marketId);
    if (!market) return false;

    if (market.status !== 'open' && market.status !== 'locked') return false;

    market.status = 'resolved';
    market.resolvedAt = Date.now();
    market.actualOutcome = resolution.outcome;
    market.resolutionReason = resolution.reason;

    // Settle positions
    this.settlePositions(market, resolution.outcome);

    this.emit('market_resolved', {
      marketId,
      outcome: resolution.outcome,
      reason: resolution.reason,
    });

    return true;
  }

  private settlePositions(market: DebateMarket, outcome: 'correct' | 'incorrect' | 'partial'): void {
    const marketPositions = this.positions.get(market.id);
    if (!marketPositions) return;

    for (const [trader, position] of marketPositions) {
      let payout = 0;
      let profit = 0;

      switch (outcome) {
        case 'correct':
          // YES wins - pay out YES holders
          payout = position.yesShares;
          profit = payout - position.totalInvested;
          break;
        case 'incorrect':
          // NO wins - pay out NO holders
          payout = position.noShares;
          profit = payout - position.totalInvested;
          break;
        case 'partial':
          // Partial - 50% payout to both sides
          payout = (position.yesShares + position.noShares) * 0.5;
          profit = payout - position.totalInvested;
          break;
      }

      // Update trader stats
      this.updateTraderStats(trader, profit, payout > 0);

      this.emit('position_settled', {
        marketId: market.id,
        trader,
        payout,
        profit,
      });
    }
  }

  private updateTraderStats(trader: string, profit: number, won: boolean): void {
    let stats = this.traderStats.get(trader);

    if (!stats) {
      stats = {
        traderId: trader,
        totalTrades: 0,
        totalVolume: 0,
        winningBets: 0,
        losingBets: 0,
        winRate: 0,
        totalProfit: 0,
        bestTrade: 0,
        worstTrade: 0,
        marketsParticipated: 0,
      };
      this.traderStats.set(trader, stats);
    }

    stats.marketsParticipated++;
    stats.totalProfit += profit;

    if (won) {
      stats.winningBets++;
      stats.bestTrade = Math.max(stats.bestTrade, profit);
    } else {
      stats.losingBets++;
      stats.worstTrade = Math.min(stats.worstTrade, profit);
    }

    const total = stats.winningBets + stats.losingBets;
    stats.winRate = total > 0 ? stats.winningBets / total : 0;
  }

  /**
   * Cancel market (refund all positions)
   */
  cancelMarket(marketId: string, reason: string): boolean {
    const market = this.markets.get(marketId);
    if (!market) return false;

    if (market.status === 'resolved' || market.status === 'cancelled') return false;

    market.status = 'cancelled';
    market.resolutionReason = reason;

    // Refund all positions
    const marketPositions = this.positions.get(marketId);
    if (marketPositions) {
      for (const [trader, position] of marketPositions) {
        this.emit('position_refunded', {
          marketId,
          trader,
          amount: position.totalInvested,
        });
      }
    }

    this.emit('market_cancelled', { marketId, reason });
    return true;
  }

  // ===========================================================================
  // Analytics
  // ===========================================================================

  /**
   * Get trade history for a market
   */
  getMarketTrades(marketId: string): Trade[] {
    return this.trades.filter(t => t.marketId === marketId);
  }

  /**
   * Get trader stats
   */
  getTraderStats(trader: string): TraderStats | undefined {
    return this.traderStats.get(trader);
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(metric: 'profit' | 'winRate' | 'volume' = 'profit', limit = 10): TraderStats[] {
    const stats = Array.from(this.traderStats.values());

    switch (metric) {
      case 'profit':
        stats.sort((a, b) => b.totalProfit - a.totalProfit);
        break;
      case 'winRate':
        stats.sort((a, b) => b.winRate - a.winRate);
        break;
      case 'volume':
        stats.sort((a, b) => b.totalVolume - a.totalVolume);
        break;
    }

    return stats.slice(0, limit);
  }

  /**
   * Get market stats
   */
  getMarketStats(marketId: string): object | null {
    const market = this.markets.get(marketId);
    if (!market) return null;

    return {
      id: market.id,
      status: market.status,
      currentPrice: this.getPrice(marketId),
      totalVolume: market.totalVolume,
      totalBets: market.totalBets,
      uniqueTraders: market.uniqueTraders.size,
      debateConsensus: market.debateConsensus,
      debateConfidence: market.debateConfidence,
      priceVsConsensus: Math.abs(this.getPrice(marketId) - market.debateConsensus),
    };
  }

  /**
   * Get overall platform stats
   */
  getStats(): object {
    const markets = Array.from(this.markets.values());

    return {
      totalMarkets: markets.length,
      openMarkets: markets.filter(m => m.status === 'open').length,
      resolvedMarkets: markets.filter(m => m.status === 'resolved').length,
      totalVolume: markets.reduce((sum, m) => sum + m.totalVolume, 0),
      totalTrades: this.trades.length,
      uniqueTraders: this.traderStats.size,
      avgCorrectRate: this.calculateCorrectRate(),
    };
  }

  private calculateCorrectRate(): number {
    const resolved = Array.from(this.markets.values())
      .filter(m => m.status === 'resolved');

    if (resolved.length === 0) return 0;

    const correct = resolved.filter(m => m.actualOutcome === 'correct').length;
    return correct / resolved.length;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let marketInstance: DebatePredictionMarket | null = null;

export function getDebatePredictionMarket(config?: Partial<MarketConfig>): DebatePredictionMarket {
  if (!marketInstance) {
    marketInstance = new DebatePredictionMarket(config);
  }
  return marketInstance;
}

export { DebatePredictionMarket as default };
