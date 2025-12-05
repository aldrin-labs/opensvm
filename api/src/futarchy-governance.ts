#!/usr/bin/env bun
/**
 * Futarchy Governance System
 *
 * Decision-making through prediction markets. Instead of voting
 * on proposals directly, participants bet on outcomes.
 *
 * How it works:
 * 1. Proposal creates two conditional markets:
 *    - "Protocol value if proposal passes"
 *    - "Protocol value if proposal fails"
 * 2. Traders bet on which outcome leads to higher value
 * 3. Decision is made based on which market shows higher price
 * 4. After decision, relevant market settles, other is voided
 *
 * Based on: Robin Hanson's Futarchy concept
 * "Vote on values, bet on beliefs"
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type MarketStatus = 'trading' | 'resolved' | 'voided';
export type DecisionOutcome = 'pass' | 'fail' | 'pending';

export interface ConditionalMarket {
  id: string;
  proposalId: string;
  condition: 'pass' | 'fail';      // What this market bets on
  description: string;

  // Market state
  yesShares: number;               // Shares betting YES (value will be high)
  noShares: number;                // Shares betting NO (value will be low)
  liquidity: number;               // AMM liquidity pool
  price: number;                   // Current implied probability (0-1)

  // Position tracking
  positions: Map<string, Position>;
  volume: number;
  trades: number;

  status: MarketStatus;
  createdAt: number;
  resolvedAt?: number;
  settlementPrice?: number;        // Final price at resolution
}

export interface Position {
  trader: string;
  yesShares: number;
  noShares: number;
  costBasis: number;               // Total cost of position
  realizedPnL: number;             // Profit/loss from closed trades
}

export interface FutarchyProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;

  // Markets
  passMarket: ConditionalMarket;   // "Value if proposal passes"
  failMarket: ConditionalMarket;   // "Value if proposal fails"

  // Decision
  decision: DecisionOutcome;
  decisionAt?: number;
  decisionReason?: string;

  // Timing
  tradingPeriod: number;           // How long markets are open (ms)
  createdAt: number;
  tradingEndsAt: number;

  // Metadata
  metricToOptimize: string;        // What we're predicting (e.g., "TVL", "token price")
  executionData?: Record<string, unknown>;
}

export interface FutarchyConfig {
  /** Trading period duration (ms) */
  tradingPeriod: number;
  /** Minimum liquidity to create proposal */
  minLiquidity: number;
  /** Fee on trades (0-1) */
  tradingFee: number;
  /** Minimum price difference to make decision */
  minPriceDifference: number;
  /** Initial liquidity for AMM */
  initialLiquidity: number;
  /** Maximum position size per trader */
  maxPositionSize: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DAY = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: FutarchyConfig = {
  tradingPeriod: 7 * DAY,          // 7 days of trading
  minLiquidity: 10000,             // 10k minimum liquidity
  tradingFee: 0.01,                // 1% fee
  minPriceDifference: 0.05,        // 5% minimum difference
  initialLiquidity: 50000,         // 50k initial liquidity
  maxPositionSize: 100000,         // 100k max position
};

// ============================================================================
// CPMM (Constant Product Market Maker) Implementation
// ============================================================================

class CPMM {
  /**
   * Calculate shares received for a given amount of collateral
   * Using constant product formula: x * y = k
   */
  static calculateBuyShares(
    reserves: number,
    shares: number,
    amount: number,
    fee: number
  ): { sharesOut: number; newReserves: number; newShares: number } {
    const amountAfterFee = amount * (1 - fee);
    const k = reserves * shares;
    const newReserves = reserves + amountAfterFee;
    const newShares = k / newReserves;
    const sharesOut = shares - newShares;

    return {
      sharesOut,
      newReserves,
      newShares,
    };
  }

  /**
   * Calculate collateral received for selling shares
   */
  static calculateSellShares(
    reserves: number,
    shares: number,
    sharesToSell: number,
    fee: number
  ): { collateralOut: number; newReserves: number; newShares: number } {
    const k = reserves * shares;
    const newShares = shares + sharesToSell;
    const newReserves = k / newShares;
    const collateralBeforeFee = reserves - newReserves;
    const collateralOut = collateralBeforeFee * (1 - fee);

    return {
      collateralOut,
      newReserves,
      newShares,
    };
  }

  /**
   * Calculate current price (probability) from reserves
   */
  static calculatePrice(yesShares: number, noShares: number): number {
    const total = yesShares + noShares;
    if (total === 0) return 0.5;
    return noShares / total; // Price of YES = proportion of NO shares
  }
}

// ============================================================================
// Futarchy Governance Engine
// ============================================================================

export class FutarchyGovernance extends EventEmitter {
  private config: FutarchyConfig;
  private proposals = new Map<string, FutarchyProposal>();
  private proposalCounter = 0;
  private marketCounter = 0;

  constructor(config: Partial<FutarchyConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Proposal Management
  // --------------------------------------------------------------------------

  /**
   * Create a new futarchy proposal with two conditional markets
   */
  createProposal(
    title: string,
    description: string,
    proposer: string,
    metricToOptimize: string,
    initialLiquidity: number,
    executionData?: Record<string, unknown>
  ): FutarchyProposal {
    if (initialLiquidity < this.config.minLiquidity) {
      throw new Error(`Minimum liquidity is ${this.config.minLiquidity}`);
    }

    this.proposalCounter++;
    const proposalId = `FUTARCHY-${this.proposalCounter}`;
    const now = Date.now();

    // Create "pass" market
    const passMarket = this.createMarket(
      proposalId,
      'pass',
      `${metricToOptimize} if "${title}" passes`,
      initialLiquidity / 2
    );

    // Create "fail" market
    const failMarket = this.createMarket(
      proposalId,
      'fail',
      `${metricToOptimize} if "${title}" fails`,
      initialLiquidity / 2
    );

    const proposal: FutarchyProposal = {
      id: proposalId,
      title,
      description,
      proposer,
      passMarket,
      failMarket,
      decision: 'pending',
      tradingPeriod: this.config.tradingPeriod,
      createdAt: now,
      tradingEndsAt: now + this.config.tradingPeriod,
      metricToOptimize,
      executionData,
    };

    this.proposals.set(proposalId, proposal);

    this.emit('proposal_created', {
      proposalId,
      title,
      passMarketId: passMarket.id,
      failMarketId: failMarket.id,
      tradingEndsAt: proposal.tradingEndsAt,
    });

    return proposal;
  }

  private createMarket(
    proposalId: string,
    condition: 'pass' | 'fail',
    description: string,
    liquidity: number
  ): ConditionalMarket {
    this.marketCounter++;

    // Initialize with equal YES/NO shares (50/50 starting price)
    const initialShares = liquidity;

    return {
      id: `MARKET-${this.marketCounter}`,
      proposalId,
      condition,
      description,
      yesShares: initialShares,
      noShares: initialShares,
      liquidity,
      price: 0.5, // Starting at 50%
      positions: new Map(),
      volume: 0,
      trades: 0,
      status: 'trading',
      createdAt: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Trading
  // --------------------------------------------------------------------------

  /**
   * Buy YES shares (betting the metric will be HIGH)
   */
  buyYes(
    proposalId: string,
    marketCondition: 'pass' | 'fail',
    trader: string,
    amount: number
  ): { sharesReceived: number; newPrice: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const market = marketCondition === 'pass' ? proposal.passMarket : proposal.failMarket;

    if (market.status !== 'trading') {
      throw new Error('Market is not trading');
    }

    if (Date.now() >= proposal.tradingEndsAt) {
      throw new Error('Trading period has ended');
    }

    // Check position limits
    const position = this.getOrCreatePosition(market, trader);
    if (position.costBasis + amount > this.config.maxPositionSize) {
      throw new Error(`Position would exceed max size of ${this.config.maxPositionSize}`);
    }

    // Execute trade using CPMM
    // Buying YES depletes YES reserves from the pool
    const result = CPMM.calculateBuyShares(
      market.liquidity,
      market.yesShares, // YES reserves in pool
      amount,
      this.config.tradingFee
    );

    // Update market state
    market.liquidity = result.newReserves;
    market.yesShares = result.newShares; // Pool's YES decreases
    market.price = CPMM.calculatePrice(market.yesShares, market.noShares);
    market.volume += amount;
    market.trades++;

    // Update position
    position.yesShares += result.sharesOut;
    position.costBasis += amount;

    this.emit('trade_executed', {
      proposalId,
      marketId: market.id,
      trader,
      side: 'buy_yes',
      amount,
      sharesReceived: result.sharesOut,
      newPrice: market.price,
    });

    return {
      sharesReceived: result.sharesOut,
      newPrice: market.price,
    };
  }

  /**
   * Buy NO shares (betting the metric will be LOW)
   */
  buyNo(
    proposalId: string,
    marketCondition: 'pass' | 'fail',
    trader: string,
    amount: number
  ): { sharesReceived: number; newPrice: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const market = marketCondition === 'pass' ? proposal.passMarket : proposal.failMarket;

    if (market.status !== 'trading') {
      throw new Error('Market is not trading');
    }

    if (Date.now() >= proposal.tradingEndsAt) {
      throw new Error('Trading period has ended');
    }

    const position = this.getOrCreatePosition(market, trader);
    if (position.costBasis + amount > this.config.maxPositionSize) {
      throw new Error(`Position would exceed max size of ${this.config.maxPositionSize}`);
    }

    // Execute trade - buying NO depletes NO reserves from pool
    const result = CPMM.calculateBuyShares(
      market.liquidity,
      market.noShares, // NO reserves in pool
      amount,
      this.config.tradingFee
    );

    // Update market state
    market.liquidity = result.newReserves;
    market.noShares = result.newShares; // Pool's NO decreases
    market.price = CPMM.calculatePrice(market.yesShares, market.noShares);
    market.volume += amount;
    market.trades++;

    // Update position
    position.noShares += result.sharesOut;
    position.costBasis += amount;

    this.emit('trade_executed', {
      proposalId,
      marketId: market.id,
      trader,
      side: 'buy_no',
      amount,
      sharesReceived: result.sharesOut,
      newPrice: market.price,
    });

    return {
      sharesReceived: result.sharesOut,
      newPrice: market.price,
    };
  }

  /**
   * Sell YES shares
   */
  sellYes(
    proposalId: string,
    marketCondition: 'pass' | 'fail',
    trader: string,
    shares: number
  ): { collateralReceived: number; newPrice: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const market = marketCondition === 'pass' ? proposal.passMarket : proposal.failMarket;

    if (market.status !== 'trading') {
      throw new Error('Market is not trading');
    }

    const position = market.positions.get(trader);
    if (!position || position.yesShares < shares) {
      throw new Error('Insufficient YES shares');
    }

    // Execute trade
    const result = CPMM.calculateSellShares(
      market.liquidity,
      market.noShares,
      shares,
      this.config.tradingFee
    );

    // Update market state
    market.liquidity = result.newReserves;
    market.noShares = result.newShares;
    market.yesShares -= shares;
    market.price = CPMM.calculatePrice(market.yesShares, market.noShares);
    market.volume += result.collateralOut;
    market.trades++;

    // Update position
    position.yesShares -= shares;
    position.realizedPnL += result.collateralOut - (position.costBasis * (shares / (position.yesShares + shares)));

    this.emit('trade_executed', {
      proposalId,
      marketId: market.id,
      trader,
      side: 'sell_yes',
      shares,
      collateralReceived: result.collateralOut,
      newPrice: market.price,
    });

    return {
      collateralReceived: result.collateralOut,
      newPrice: market.price,
    };
  }

  private getOrCreatePosition(market: ConditionalMarket, trader: string): Position {
    let position = market.positions.get(trader);
    if (!position) {
      position = {
        trader,
        yesShares: 0,
        noShares: 0,
        costBasis: 0,
        realizedPnL: 0,
      };
      market.positions.set(trader, position);
    }
    return position;
  }

  // --------------------------------------------------------------------------
  // Decision Making
  // --------------------------------------------------------------------------

  /**
   * Resolve the proposal based on market prices
   * Called after trading period ends
   */
  resolveProposal(proposalId: string): FutarchyProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.decision !== 'pending') {
      throw new Error('Proposal already resolved');
    }

    if (Date.now() < proposal.tradingEndsAt) {
      throw new Error('Trading period not ended');
    }

    const passPrice = proposal.passMarket.price;
    const failPrice = proposal.failMarket.price;
    const priceDiff = Math.abs(passPrice - failPrice);

    // Determine decision
    if (priceDiff < this.config.minPriceDifference) {
      // Prices too close - no clear market signal
      proposal.decision = 'fail'; // Default to status quo
      proposal.decisionReason = `Price difference (${(priceDiff * 100).toFixed(2)}%) below threshold`;
    } else if (passPrice > failPrice) {
      // Market predicts higher value if proposal passes
      proposal.decision = 'pass';
      proposal.decisionReason = `Pass market price (${(passPrice * 100).toFixed(2)}%) > Fail market price (${(failPrice * 100).toFixed(2)}%)`;
    } else {
      // Market predicts higher value if proposal fails
      proposal.decision = 'fail';
      proposal.decisionReason = `Fail market price (${(failPrice * 100).toFixed(2)}%) > Pass market price (${(passPrice * 100).toFixed(2)}%)`;
    }

    proposal.decisionAt = Date.now();

    // Resolve relevant market, void the other
    if (proposal.decision === 'pass') {
      proposal.passMarket.status = 'resolved';
      proposal.passMarket.resolvedAt = Date.now();
      proposal.passMarket.settlementPrice = passPrice;
      proposal.failMarket.status = 'voided';
    } else {
      proposal.failMarket.status = 'resolved';
      proposal.failMarket.resolvedAt = Date.now();
      proposal.failMarket.settlementPrice = failPrice;
      proposal.passMarket.status = 'voided';
    }

    this.emit('proposal_resolved', {
      proposalId,
      decision: proposal.decision,
      passPrice,
      failPrice,
      reason: proposal.decisionReason,
    });

    return proposal;
  }

  /**
   * Claim winnings from a resolved market
   */
  claimWinnings(
    proposalId: string,
    trader: string
  ): { amount: number; fromMarket: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.decision === 'pending') {
      throw new Error('Proposal not yet resolved');
    }

    // Get the resolved market
    const resolvedMarket = proposal.decision === 'pass'
      ? proposal.passMarket
      : proposal.failMarket;

    const position = resolvedMarket.positions.get(trader);
    if (!position) {
      throw new Error('No position in resolved market');
    }

    // Calculate winnings (YES shares pay out at settlement price, NO at 1-price)
    const yesValue = position.yesShares * (resolvedMarket.settlementPrice || 0);
    const noValue = position.noShares * (1 - (resolvedMarket.settlementPrice || 0));
    const totalWinnings = yesValue + noValue;

    // Clear position after claiming
    position.yesShares = 0;
    position.noShares = 0;

    this.emit('winnings_claimed', {
      proposalId,
      trader,
      amount: totalWinnings,
      marketId: resolvedMarket.id,
    });

    return {
      amount: totalWinnings,
      fromMarket: resolvedMarket.id,
    };
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): FutarchyProposal | null {
    return this.proposals.get(proposalId) || null;
  }

  /**
   * Get all active (pending) proposals
   */
  getActiveProposals(): FutarchyProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.decision === 'pending');
  }

  /**
   * Get proposals ready for resolution
   */
  getResolvableProposals(): FutarchyProposal[] {
    const now = Date.now();
    return Array.from(this.proposals.values())
      .filter(p => p.decision === 'pending' && now >= p.tradingEndsAt);
  }

  /**
   * Get market prices comparison
   */
  getMarketPrices(proposalId: string): {
    passPrice: number;
    failPrice: number;
    impliedDecision: 'pass' | 'fail';
    confidence: number;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const passPrice = proposal.passMarket.price;
    const failPrice = proposal.failMarket.price;
    const diff = Math.abs(passPrice - failPrice);

    return {
      passPrice,
      failPrice,
      impliedDecision: passPrice > failPrice ? 'pass' : 'fail',
      confidence: diff, // Higher = more confident market signal
    };
  }

  /**
   * Get trader's positions across all markets
   */
  getTraderPositions(trader: string): Array<{
    proposalId: string;
    proposalTitle: string;
    marketCondition: 'pass' | 'fail';
    position: Position;
    currentValue: number;
  }> {
    const positions: Array<{
      proposalId: string;
      proposalTitle: string;
      marketCondition: 'pass' | 'fail';
      position: Position;
      currentValue: number;
    }> = [];

    for (const proposal of this.proposals.values()) {
      const passPosition = proposal.passMarket.positions.get(trader);
      if (passPosition && (passPosition.yesShares > 0 || passPosition.noShares > 0)) {
        const currentValue =
          passPosition.yesShares * proposal.passMarket.price +
          passPosition.noShares * (1 - proposal.passMarket.price);
        positions.push({
          proposalId: proposal.id,
          proposalTitle: proposal.title,
          marketCondition: 'pass',
          position: passPosition,
          currentValue,
        });
      }

      const failPosition = proposal.failMarket.positions.get(trader);
      if (failPosition && (failPosition.yesShares > 0 || failPosition.noShares > 0)) {
        const currentValue =
          failPosition.yesShares * proposal.failMarket.price +
          failPosition.noShares * (1 - proposal.failMarket.price);
        positions.push({
          proposalId: proposal.id,
          proposalTitle: proposal.title,
          marketCondition: 'fail',
          position: failPosition,
          currentValue,
        });
      }
    }

    return positions;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get overall statistics
   */
  getStats(): {
    totalProposals: number;
    pendingProposals: number;
    passedProposals: number;
    failedProposals: number;
    totalVolume: number;
    totalTrades: number;
    avgPriceDifference: number;
  } {
    const all = Array.from(this.proposals.values());
    const resolved = all.filter(p => p.decision !== 'pending');

    let totalVolume = 0;
    let totalTrades = 0;
    let totalPriceDiff = 0;

    for (const proposal of all) {
      totalVolume += proposal.passMarket.volume + proposal.failMarket.volume;
      totalTrades += proposal.passMarket.trades + proposal.failMarket.trades;

      if (proposal.decision !== 'pending') {
        totalPriceDiff += Math.abs(proposal.passMarket.price - proposal.failMarket.price);
      }
    }

    return {
      totalProposals: all.length,
      pendingProposals: all.filter(p => p.decision === 'pending').length,
      passedProposals: resolved.filter(p => p.decision === 'pass').length,
      failedProposals: resolved.filter(p => p.decision === 'fail').length,
      totalVolume,
      totalTrades,
      avgPriceDifference: resolved.length > 0 ? totalPriceDiff / resolved.length : 0,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

let governanceInstance: FutarchyGovernance | null = null;

export function getFutarchyGovernance(
  config?: Partial<FutarchyConfig>
): FutarchyGovernance {
  if (!governanceInstance) {
    governanceInstance = new FutarchyGovernance(config);
  }
  return governanceInstance;
}

export default {
  FutarchyGovernance,
  getFutarchyGovernance,
  DEFAULT_CONFIG,
  CPMM,
};
