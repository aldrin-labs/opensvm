#!/usr/bin/env bun
/**
 * Debate Market Mechanics
 *
 * Advanced economic mechanisms for governance debates:
 * 1. Conviction Betting - Time-weighted position commitment
 * 2. Debate Futures Market - Trade on debate outcomes
 * 3. Agent Performance Tokens - Tokenized agent reputation
 * 4. Insurance Pool - Protection against governance failures
 * 5. Quadratic Prediction Markets - Sybil-resistant prediction
 */

import { EventEmitter } from 'events';

// ============================================================================
// Common Types
// ============================================================================

export interface Token {
  symbol: string;
  decimals: number;
  totalSupply: number;
}

export interface Position {
  holder: string;
  amount: number;
  entryTime: number;
  side: 'support' | 'oppose';
}

// ============================================================================
// 1. Conviction Betting
// ============================================================================

export interface ConvictionBet {
  id: string;
  proposalId: string;
  bettor: string;
  amount: number;
  side: 'support' | 'oppose';
  startTime: number;
  lockDuration: number; // in seconds
  unlockTime: number;
  convictionMultiplier: number; // Based on lock duration
  claimed: boolean;
}

export interface ConvictionConfig {
  minLockDuration: number; // Minimum lock period (seconds)
  maxLockDuration: number; // Maximum lock period (seconds)
  baseMultiplier: number; // 1x for minimum lock
  maxMultiplier: number; // Max multiplier for max lock
  decayRate: number; // How quickly conviction decays after unlock
}

export const DEFAULT_CONVICTION_CONFIG: ConvictionConfig = {
  minLockDuration: 86400, // 1 day
  maxLockDuration: 2592000, // 30 days
  baseMultiplier: 1.0,
  maxMultiplier: 3.0,
  decayRate: 0.1, // 10% per day after unlock
};

export class ConvictionBetting extends EventEmitter {
  private bets: Map<string, ConvictionBet> = new Map();
  private config: ConvictionConfig;
  private proposalPools: Map<string, { support: number; oppose: number }> = new Map();

  constructor(config: Partial<ConvictionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONVICTION_CONFIG, ...config };
  }

  /**
   * Place a conviction bet with time-locked commitment
   */
  placeBet(
    proposalId: string,
    bettor: string,
    amount: number,
    side: 'support' | 'oppose',
    lockDuration: number
  ): ConvictionBet {
    // Validate lock duration
    const duration = Math.max(
      this.config.minLockDuration,
      Math.min(this.config.maxLockDuration, lockDuration)
    );

    // Calculate conviction multiplier
    const durationRange = this.config.maxLockDuration - this.config.minLockDuration;
    const durationRatio = (duration - this.config.minLockDuration) / durationRange;
    const multiplierRange = this.config.maxMultiplier - this.config.baseMultiplier;
    const multiplier = this.config.baseMultiplier + (durationRatio * multiplierRange);

    const now = Date.now();
    const bet: ConvictionBet = {
      id: `bet_${proposalId}_${bettor}_${now}`,
      proposalId,
      bettor,
      amount,
      side,
      startTime: now,
      lockDuration: duration,
      unlockTime: now + (duration * 1000),
      convictionMultiplier: multiplier,
      claimed: false,
    };

    this.bets.set(bet.id, bet);

    // Update pool
    const pool = this.proposalPools.get(proposalId) || { support: 0, oppose: 0 };
    const weightedAmount = amount * multiplier;
    if (side === 'support') {
      pool.support += weightedAmount;
    } else {
      pool.oppose += weightedAmount;
    }
    this.proposalPools.set(proposalId, pool);

    this.emit('bet_placed', { bet, weightedAmount });
    return bet;
  }

  /**
   * Get current conviction-weighted totals for a proposal
   */
  getPoolState(proposalId: string): { support: number; oppose: number; ratio: number } {
    const pool = this.proposalPools.get(proposalId) || { support: 0, oppose: 0 };
    const total = pool.support + pool.oppose;
    return {
      ...pool,
      ratio: total > 0 ? pool.support / total : 0.5,
    };
  }

  /**
   * Settle bets after proposal resolution
   */
  settleBets(proposalId: string, outcome: 'support' | 'oppose'): number {
    const pool = this.proposalPools.get(proposalId);
    if (!pool) return 0;

    const winningPool = outcome === 'support' ? pool.support : pool.oppose;
    const losingPool = outcome === 'support' ? pool.oppose : pool.support;
    const totalPool = winningPool + losingPool;

    let totalPaid = 0;
    const now = Date.now();

    for (const bet of this.bets.values()) {
      if (bet.proposalId !== proposalId || bet.claimed) continue;

      if (bet.side === outcome) {
        // Winner: get proportional share of losing pool + original stake
        const weightedStake = bet.amount * bet.convictionMultiplier;
        const share = totalPool > 0 ? (weightedStake / winningPool) * losingPool : 0;

        // Apply decay if bet was unlocked early
        let decayMultiplier = 1.0;
        if (now > bet.unlockTime) {
          const daysUnlocked = (now - bet.unlockTime) / (86400 * 1000);
          decayMultiplier = Math.max(0.1, 1 - (this.config.decayRate * daysUnlocked));
        }

        const payout = (bet.amount + share) * decayMultiplier;
        bet.claimed = true;
        totalPaid += payout;

        this.emit('bet_settled', { bet, payout, won: true });
      } else {
        // Loser: loses stake
        bet.claimed = true;
        this.emit('bet_settled', { bet, payout: 0, won: false });
      }
    }

    return totalPaid;
  }

  /**
   * Get all bets for a bettor
   */
  getBetsByBettor(bettor: string): ConvictionBet[] {
    return Array.from(this.bets.values()).filter(b => b.bettor === bettor);
  }

  /**
   * Get all bets for a proposal
   */
  getBetsByProposal(proposalId: string): ConvictionBet[] {
    return Array.from(this.bets.values()).filter(b => b.proposalId === proposalId);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalBets: number;
    totalVolume: number;
    averageLockDuration: number;
    averageMultiplier: number;
  } {
    const bets = Array.from(this.bets.values());
    if (bets.length === 0) {
      return { totalBets: 0, totalVolume: 0, averageLockDuration: 0, averageMultiplier: 1 };
    }

    const totalVolume = bets.reduce((sum, b) => sum + b.amount, 0);
    const avgLock = bets.reduce((sum, b) => sum + b.lockDuration, 0) / bets.length;
    const avgMult = bets.reduce((sum, b) => sum + b.convictionMultiplier, 0) / bets.length;

    return {
      totalBets: bets.length,
      totalVolume,
      averageLockDuration: avgLock,
      averageMultiplier: avgMult,
    };
  }
}

// ============================================================================
// 2. Debate Futures Market
// ============================================================================

export interface DebateFuture {
  id: string;
  debateId: string;
  question: string;
  outcomes: string[];
  createdAt: number;
  expiresAt: number;
  resolved: boolean;
  winningOutcome?: number;
}

export interface FuturesPosition {
  futureId: string;
  trader: string;
  outcomeIndex: number;
  shares: number;
  costBasis: number;
  entryPrice: number;
}

export interface AMM {
  futureId: string;
  liquidity: number[];
  k: number; // Constant product
}

export class DebateFuturesMarket extends EventEmitter {
  private futures: Map<string, DebateFuture> = new Map();
  private positions: Map<string, FuturesPosition[]> = new Map();
  private amms: Map<string, AMM> = new Map();

  constructor() {
    super();
  }

  /**
   * Create a new debate futures market
   */
  createFuture(
    debateId: string,
    question: string,
    outcomes: string[],
    expiresAt: number,
    initialLiquidity: number = 1000
  ): DebateFuture {
    const id = `future_${debateId}_${Date.now()}`;

    const future: DebateFuture = {
      id,
      debateId,
      question,
      outcomes,
      createdAt: Date.now(),
      expiresAt,
      resolved: false,
    };

    this.futures.set(id, future);

    // Initialize AMM with equal liquidity for each outcome
    const liquidityPerOutcome = initialLiquidity / outcomes.length;
    const liquidity = outcomes.map(() => liquidityPerOutcome);
    const k = liquidity.reduce((prod, l) => prod * l, 1);

    this.amms.set(id, { futureId: id, liquidity, k });
    this.positions.set(id, []);

    this.emit('future_created', { future });
    return future;
  }

  /**
   * Get current prices for all outcomes
   */
  getPrices(futureId: string): number[] {
    const amm = this.amms.get(futureId);
    if (!amm) return [];

    const total = amm.liquidity.reduce((sum, l) => sum + l, 0);
    return amm.liquidity.map(l => 1 - (l / total));
  }

  /**
   * Buy shares of an outcome
   */
  buyOutcome(
    futureId: string,
    trader: string,
    outcomeIndex: number,
    amount: number
  ): { shares: number; avgPrice: number } {
    const amm = this.amms.get(futureId);
    const future = this.futures.get(futureId);

    if (!amm || !future || future.resolved) {
      throw new Error('Invalid or resolved market');
    }

    if (outcomeIndex < 0 || outcomeIndex >= amm.liquidity.length) {
      throw new Error('Invalid outcome index');
    }

    // Calculate shares using constant product formula
    const currentLiquidity = amm.liquidity[outcomeIndex];
    const otherLiquidity = amm.liquidity.filter((_, i) => i !== outcomeIndex);
    const otherProduct = otherLiquidity.reduce((prod, l) => prod * l, 1);

    // After adding 'amount' to all OTHER outcomes, how much can we remove from this one?
    const newOtherLiquidity = otherLiquidity.map(l => l + (amount / otherLiquidity.length));
    const newOtherProduct = newOtherLiquidity.reduce((prod, l) => prod * l, 1);
    const newCurrentLiquidity = amm.k / newOtherProduct;
    const shares = currentLiquidity - newCurrentLiquidity;

    // Update AMM
    amm.liquidity[outcomeIndex] = newCurrentLiquidity;
    for (let i = 0; i < amm.liquidity.length; i++) {
      if (i !== outcomeIndex) {
        amm.liquidity[i] += amount / (amm.liquidity.length - 1);
      }
    }

    // Record position
    const avgPrice = amount / shares;
    const position: FuturesPosition = {
      futureId,
      trader,
      outcomeIndex,
      shares,
      costBasis: amount,
      entryPrice: avgPrice,
    };

    const positions = this.positions.get(futureId) || [];
    positions.push(position);
    this.positions.set(futureId, positions);

    this.emit('position_opened', { position, prices: this.getPrices(futureId) });
    return { shares, avgPrice };
  }

  /**
   * Resolve a futures market
   */
  resolve(futureId: string, winningOutcome: number): number {
    const future = this.futures.get(futureId);
    if (!future || future.resolved) {
      throw new Error('Invalid or already resolved');
    }

    future.resolved = true;
    future.winningOutcome = winningOutcome;

    // Calculate payouts
    const positions = this.positions.get(futureId) || [];
    let totalPayout = 0;

    for (const pos of positions) {
      if (pos.outcomeIndex === winningOutcome) {
        // Winner gets $1 per share
        const payout = pos.shares;
        totalPayout += payout;
        this.emit('position_settled', { position: pos, payout, won: true });
      } else {
        this.emit('position_settled', { position: pos, payout: 0, won: false });
      }
    }

    this.emit('future_resolved', { future, totalPayout });
    return totalPayout;
  }

  /**
   * Get market statistics
   */
  getMarketStats(futureId: string): {
    totalVolume: number;
    totalPositions: number;
    prices: number[];
  } | null {
    const positions = this.positions.get(futureId);
    const amm = this.amms.get(futureId);

    if (!positions || !amm) return null;

    return {
      totalVolume: positions.reduce((sum, p) => sum + p.costBasis, 0),
      totalPositions: positions.length,
      prices: this.getPrices(futureId),
    };
  }

  /**
   * Get all futures for a debate
   */
  getFuturesByDebate(debateId: string): DebateFuture[] {
    return Array.from(this.futures.values()).filter(f => f.debateId === debateId);
  }

  /**
   * Get trader positions
   */
  getTraderPositions(trader: string): FuturesPosition[] {
    const allPositions: FuturesPosition[] = [];
    for (const positions of this.positions.values()) {
      allPositions.push(...positions.filter(p => p.trader === trader));
    }
    return allPositions;
  }
}

// ============================================================================
// 3. Agent Performance Tokens
// ============================================================================

export interface AgentToken {
  agentId: string;
  symbol: string;
  name: string;
  totalSupply: number;
  circulatingSupply: number;
  price: number;
  priceHistory: { timestamp: number; price: number }[];
}

export interface TokenHolder {
  address: string;
  balance: number;
  stakedBalance: number;
  stakingSince?: number;
}

export interface AgentPerformance {
  agentId: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  profitLoss: number;
  sharpeRatio: number;
}

export class AgentTokenSystem extends EventEmitter {
  private tokens: Map<string, AgentToken> = new Map();
  private holders: Map<string, Map<string, TokenHolder>> = new Map(); // agentId -> address -> holder
  private performances: Map<string, AgentPerformance> = new Map();
  private bondingCurve = {
    basePrice: 0.01,
    slope: 0.001,
    reserveRatio: 0.5,
  };

  constructor() {
    super();
  }

  /**
   * Create a new agent token
   */
  createAgentToken(
    agentId: string,
    symbol: string,
    name: string,
    initialSupply: number = 1000000
  ): AgentToken {
    if (this.tokens.has(agentId)) {
      throw new Error('Token already exists for this agent');
    }

    const token: AgentToken = {
      agentId,
      symbol,
      name,
      totalSupply: initialSupply,
      circulatingSupply: 0,
      price: this.bondingCurve.basePrice,
      priceHistory: [{ timestamp: Date.now(), price: this.bondingCurve.basePrice }],
    };

    this.tokens.set(agentId, token);
    this.holders.set(agentId, new Map());
    this.performances.set(agentId, {
      agentId,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      profitLoss: 0,
      sharpeRatio: 0,
    });

    this.emit('token_created', { token });
    return token;
  }

  /**
   * Calculate token price based on bonding curve
   */
  private calculatePrice(supply: number): number {
    return this.bondingCurve.basePrice + (this.bondingCurve.slope * supply);
  }

  /**
   * Buy agent tokens
   */
  buyTokens(agentId: string, buyer: string, amount: number): { tokens: number; cost: number } {
    const token = this.tokens.get(agentId);
    if (!token) throw new Error('Token not found');

    // Calculate cost using integral of bonding curve
    const startPrice = this.calculatePrice(token.circulatingSupply);
    const endPrice = this.calculatePrice(token.circulatingSupply + amount);
    const avgPrice = (startPrice + endPrice) / 2;
    const cost = avgPrice * amount;

    // Update supply and price
    token.circulatingSupply += amount;
    token.price = endPrice;
    token.priceHistory.push({ timestamp: Date.now(), price: endPrice });

    // Update holder balance
    const holders = this.holders.get(agentId)!;
    const holder = holders.get(buyer) || { address: buyer, balance: 0, stakedBalance: 0 };
    holder.balance += amount;
    holders.set(buyer, holder);

    this.emit('tokens_bought', { agentId, buyer, amount, cost, newPrice: endPrice });
    return { tokens: amount, cost };
  }

  /**
   * Sell agent tokens
   */
  sellTokens(agentId: string, seller: string, amount: number): { tokens: number; proceeds: number } {
    const token = this.tokens.get(agentId);
    if (!token) throw new Error('Token not found');

    const holders = this.holders.get(agentId)!;
    const holder = holders.get(seller);
    if (!holder || holder.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Calculate proceeds using integral of bonding curve
    const startPrice = this.calculatePrice(token.circulatingSupply);
    const endPrice = this.calculatePrice(token.circulatingSupply - amount);
    const avgPrice = (startPrice + endPrice) / 2;
    const proceeds = avgPrice * amount * this.bondingCurve.reserveRatio;

    // Update supply and price
    token.circulatingSupply -= amount;
    token.price = endPrice;
    token.priceHistory.push({ timestamp: Date.now(), price: endPrice });

    // Update holder balance
    holder.balance -= amount;

    this.emit('tokens_sold', { agentId, seller, amount, proceeds, newPrice: endPrice });
    return { tokens: amount, proceeds };
  }

  /**
   * Stake tokens for governance power
   */
  stakeTokens(agentId: string, staker: string, amount: number): boolean {
    const holders = this.holders.get(agentId);
    if (!holders) return false;

    const holder = holders.get(staker);
    if (!holder || holder.balance < amount) return false;

    holder.balance -= amount;
    holder.stakedBalance += amount;
    holder.stakingSince = Date.now();

    this.emit('tokens_staked', { agentId, staker, amount });
    return true;
  }

  /**
   * Record agent performance (affects token price)
   */
  recordPerformance(agentId: string, prediction: boolean, correct: boolean, pnl: number): void {
    const perf = this.performances.get(agentId);
    const token = this.tokens.get(agentId);
    if (!perf || !token) return;

    perf.totalPredictions++;
    if (correct) perf.correctPredictions++;
    perf.accuracy = perf.correctPredictions / perf.totalPredictions;
    perf.profitLoss += pnl;

    // Adjust bonding curve slope based on performance
    // Better performance = steeper curve = more valuable tokens
    const performanceMultiplier = 1 + (perf.accuracy - 0.5) * 0.5;
    const newSlope = this.bondingCurve.slope * performanceMultiplier;

    // Recalculate price with new slope
    const basePrice = this.bondingCurve.basePrice;
    token.price = basePrice + (newSlope * token.circulatingSupply);
    token.priceHistory.push({ timestamp: Date.now(), price: token.price });

    this.emit('performance_recorded', { agentId, perf, newPrice: token.price });
  }

  /**
   * Get token information
   */
  getToken(agentId: string): AgentToken | undefined {
    return this.tokens.get(agentId);
  }

  /**
   * Get agent performance
   */
  getPerformance(agentId: string): AgentPerformance | undefined {
    return this.performances.get(agentId);
  }

  /**
   * Get holder information
   */
  getHolder(agentId: string, address: string): TokenHolder | undefined {
    return this.holders.get(agentId)?.get(address);
  }

  /**
   * Get all token holders
   */
  getHolders(agentId: string): TokenHolder[] {
    const holders = this.holders.get(agentId);
    return holders ? Array.from(holders.values()) : [];
  }

  /**
   * Get token leaderboard
   */
  getLeaderboard(): Array<{
    agentId: string;
    symbol: string;
    price: number;
    marketCap: number;
    accuracy: number;
  }> {
    return Array.from(this.tokens.values())
      .map(t => {
        const perf = this.performances.get(t.agentId);
        return {
          agentId: t.agentId,
          symbol: t.symbol,
          price: t.price,
          marketCap: t.price * t.circulatingSupply,
          accuracy: perf?.accuracy || 0,
        };
      })
      .sort((a, b) => b.marketCap - a.marketCap);
  }
}

// ============================================================================
// 4. Insurance Pool
// ============================================================================

export interface InsurancePolicy {
  id: string;
  proposalId: string;
  policyholder: string;
  coverageAmount: number;
  premium: number;
  premiumPaid: number;
  coverageType: 'hack' | 'rugpull' | 'governance_attack' | 'smart_contract' | 'all';
  startDate: number;
  endDate: number;
  claimed: boolean;
  claimAmount?: number;
}

export interface InsurancePoolStats {
  totalPremiumsCollected: number;
  totalClaimsPaid: number;
  currentReserve: number;
  activePolices: number;
  utilizationRatio: number;
}

export class InsurancePool extends EventEmitter {
  private policies: Map<string, InsurancePolicy> = new Map();
  private reserve: number = 0;
  private totalPremiums: number = 0;
  private totalClaims: number = 0;
  private config = {
    basePremiumRate: 0.05, // 5% base premium
    minCoverage: 100,
    maxCoverage: 1000000,
    coverageDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    claimWaitPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  constructor(initialReserve: number = 100000) {
    super();
    this.reserve = initialReserve;
  }

  /**
   * Calculate premium based on risk assessment
   */
  calculatePremium(
    coverageAmount: number,
    coverageType: InsurancePolicy['coverageType'],
    riskScore: number // 0-100
  ): number {
    // Type-based risk multipliers
    const typeMultipliers: Record<InsurancePolicy['coverageType'], number> = {
      hack: 1.5,
      rugpull: 2.0,
      governance_attack: 1.2,
      smart_contract: 1.8,
      all: 2.5,
    };

    const typeMultiplier = typeMultipliers[coverageType];
    const riskMultiplier = 1 + (riskScore / 100);
    const premium = coverageAmount * this.config.basePremiumRate * typeMultiplier * riskMultiplier;

    return Math.round(premium * 100) / 100;
  }

  /**
   * Purchase insurance policy
   */
  purchasePolicy(
    proposalId: string,
    policyholder: string,
    coverageAmount: number,
    coverageType: InsurancePolicy['coverageType'],
    riskScore: number
  ): InsurancePolicy {
    if (coverageAmount < this.config.minCoverage || coverageAmount > this.config.maxCoverage) {
      throw new Error(`Coverage must be between ${this.config.minCoverage} and ${this.config.maxCoverage}`);
    }

    // Check pool can cover this policy
    if (coverageAmount > this.reserve * 0.1) {
      throw new Error('Coverage amount exceeds pool capacity');
    }

    const premium = this.calculatePremium(coverageAmount, coverageType, riskScore);
    const now = Date.now();

    const policy: InsurancePolicy = {
      id: `policy_${proposalId}_${policyholder}_${now}`,
      proposalId,
      policyholder,
      coverageAmount,
      premium,
      premiumPaid: premium,
      coverageType,
      startDate: now,
      endDate: now + this.config.coverageDuration,
      claimed: false,
    };

    this.policies.set(policy.id, policy);
    this.reserve += premium;
    this.totalPremiums += premium;

    this.emit('policy_purchased', { policy });
    return policy;
  }

  /**
   * File an insurance claim
   */
  fileClaim(
    policyId: string,
    claimAmount: number,
    evidence: string
  ): { approved: boolean; payout: number; reason: string } {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return { approved: false, payout: 0, reason: 'Policy not found' };
    }

    if (policy.claimed) {
      return { approved: false, payout: 0, reason: 'Already claimed' };
    }

    const now = Date.now();
    if (now > policy.endDate) {
      return { approved: false, payout: 0, reason: 'Policy expired' };
    }

    if (now < policy.startDate + this.config.claimWaitPeriod) {
      return { approved: false, payout: 0, reason: 'Claim wait period not met' };
    }

    // Cap claim at coverage amount
    const actualPayout = Math.min(claimAmount, policy.coverageAmount);

    // Check reserve can cover payout
    if (actualPayout > this.reserve) {
      // Partial payout
      const partialPayout = this.reserve * 0.9;
      policy.claimed = true;
      policy.claimAmount = partialPayout;
      this.reserve -= partialPayout;
      this.totalClaims += partialPayout;

      this.emit('claim_partial', { policy, payout: partialPayout, requested: actualPayout });
      return { approved: true, payout: partialPayout, reason: 'Partial payout - reserve insufficient' };
    }

    policy.claimed = true;
    policy.claimAmount = actualPayout;
    this.reserve -= actualPayout;
    this.totalClaims += actualPayout;

    this.emit('claim_approved', { policy, payout: actualPayout, evidence });
    return { approved: true, payout: actualPayout, reason: 'Claim approved' };
  }

  /**
   * Add liquidity to the pool
   */
  addLiquidity(provider: string, amount: number): number {
    this.reserve += amount;
    this.emit('liquidity_added', { provider, amount, newReserve: this.reserve });
    return this.reserve;
  }

  /**
   * Get pool statistics
   */
  getStats(): InsurancePoolStats {
    const activePolicies = Array.from(this.policies.values()).filter(
      p => !p.claimed && Date.now() < p.endDate
    );

    const totalActiveCoverage = activePolicies.reduce((sum, p) => sum + p.coverageAmount, 0);

    return {
      totalPremiumsCollected: this.totalPremiums,
      totalClaimsPaid: this.totalClaims,
      currentReserve: this.reserve,
      activePolices: activePolicies.length,
      utilizationRatio: this.reserve > 0 ? totalActiveCoverage / this.reserve : 0,
    };
  }

  /**
   * Get policies by holder
   */
  getPoliciesByHolder(policyholder: string): InsurancePolicy[] {
    return Array.from(this.policies.values()).filter(p => p.policyholder === policyholder);
  }

  /**
   * Get policies by proposal
   */
  getPoliciesByProposal(proposalId: string): InsurancePolicy[] {
    return Array.from(this.policies.values()).filter(p => p.proposalId === proposalId);
  }
}

// ============================================================================
// 5. Quadratic Prediction Markets
// ============================================================================

export interface QuadraticVote {
  voter: string;
  votes: number; // Can be negative for opposing
  cost: number; // Quadratic cost
  timestamp: number;
}

export interface QuadraticMarket {
  id: string;
  proposalId: string;
  question: string;
  createdAt: number;
  endsAt: number;
  resolved: boolean;
  outcome?: boolean;
  supportVotes: number;
  opposeVotes: number;
  totalCreditsSpent: number;
  votes: QuadraticVote[];
}

export interface VoterCredits {
  address: string;
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  lastRefill: number;
}

export class QuadraticPredictionMarket extends EventEmitter {
  private markets: Map<string, QuadraticMarket> = new Map();
  private voterCredits: Map<string, VoterCredits> = new Map();
  private config = {
    initialCredits: 100,
    creditRefillAmount: 25,
    creditRefillInterval: 7 * 24 * 60 * 60 * 1000, // Weekly
    maxVotesPerMarket: 10, // Max sqrt of credits per market
  };

  constructor() {
    super();
  }

  /**
   * Calculate quadratic cost for votes
   */
  private calculateCost(votes: number): number {
    return votes * votes;
  }

  /**
   * Calculate votes from credits
   */
  private calculateVotes(credits: number): number {
    return Math.floor(Math.sqrt(credits));
  }

  /**
   * Initialize or get voter credits
   */
  private getOrCreateVoter(address: string): VoterCredits {
    let voter = this.voterCredits.get(address);

    if (!voter) {
      voter = {
        address,
        totalCredits: this.config.initialCredits,
        usedCredits: 0,
        availableCredits: this.config.initialCredits,
        lastRefill: Date.now(),
      };
      this.voterCredits.set(address, voter);
    }

    // Check for credit refill
    const now = Date.now();
    if (now - voter.lastRefill > this.config.creditRefillInterval) {
      const refills = Math.floor((now - voter.lastRefill) / this.config.creditRefillInterval);
      const refillAmount = refills * this.config.creditRefillAmount;
      voter.totalCredits += refillAmount;
      voter.availableCredits += refillAmount;
      voter.lastRefill = now;

      this.emit('credits_refilled', { address, amount: refillAmount });
    }

    return voter;
  }

  /**
   * Create a new quadratic prediction market
   */
  createMarket(
    proposalId: string,
    question: string,
    durationSeconds: number
  ): QuadraticMarket {
    const id = `qpm_${proposalId}_${Date.now()}`;

    const market: QuadraticMarket = {
      id,
      proposalId,
      question,
      createdAt: Date.now(),
      endsAt: Date.now() + (durationSeconds * 1000),
      resolved: false,
      supportVotes: 0,
      opposeVotes: 0,
      totalCreditsSpent: 0,
      votes: [],
    };

    this.markets.set(id, market);
    this.emit('market_created', { market });
    return market;
  }

  /**
   * Cast quadratic votes
   */
  vote(
    marketId: string,
    voter: string,
    votes: number, // Positive = support, negative = oppose
    spendCredits: number
  ): { success: boolean; actualVotes: number; cost: number; message: string } {
    const market = this.markets.get(marketId);
    if (!market) {
      return { success: false, actualVotes: 0, cost: 0, message: 'Market not found' };
    }

    if (market.resolved || Date.now() > market.endsAt) {
      return { success: false, actualVotes: 0, cost: 0, message: 'Market closed' };
    }

    const voterInfo = this.getOrCreateVoter(voter);
    const absVotes = Math.abs(votes);

    // Cap votes at max per market
    const cappedVotes = Math.min(absVotes, this.config.maxVotesPerMarket);
    const cost = this.calculateCost(cappedVotes);

    if (cost > voterInfo.availableCredits) {
      const affordableVotes = this.calculateVotes(voterInfo.availableCredits);
      if (affordableVotes === 0) {
        return { success: false, actualVotes: 0, cost: 0, message: 'Insufficient credits' };
      }

      // Auto-adjust to affordable amount
      const adjustedVotes = votes > 0 ? affordableVotes : -affordableVotes;
      const adjustedCost = this.calculateCost(affordableVotes);

      voterInfo.usedCredits += adjustedCost;
      voterInfo.availableCredits -= adjustedCost;

      const voteRecord: QuadraticVote = {
        voter,
        votes: adjustedVotes,
        cost: adjustedCost,
        timestamp: Date.now(),
      };

      market.votes.push(voteRecord);
      market.totalCreditsSpent += adjustedCost;

      if (adjustedVotes > 0) {
        market.supportVotes += adjustedVotes;
      } else {
        market.opposeVotes += Math.abs(adjustedVotes);
      }

      this.emit('vote_cast', { market, voteRecord, voterInfo });
      return {
        success: true,
        actualVotes: adjustedVotes,
        cost: adjustedCost,
        message: `Adjusted to ${affordableVotes} votes due to credit limit`,
      };
    }

    voterInfo.usedCredits += cost;
    voterInfo.availableCredits -= cost;

    const finalVotes = votes > 0 ? cappedVotes : -cappedVotes;
    const voteRecord: QuadraticVote = {
      voter,
      votes: finalVotes,
      cost,
      timestamp: Date.now(),
    };

    market.votes.push(voteRecord);
    market.totalCreditsSpent += cost;

    if (finalVotes > 0) {
      market.supportVotes += cappedVotes;
    } else {
      market.opposeVotes += cappedVotes;
    }

    this.emit('vote_cast', { market, voteRecord, voterInfo });
    return { success: true, actualVotes: finalVotes, cost, message: 'Vote cast successfully' };
  }

  /**
   * Resolve market with outcome
   */
  resolve(marketId: string, outcome: boolean): {
    market: QuadraticMarket;
    prediction: boolean;
    accuracy: number;
  } {
    const market = this.markets.get(marketId);
    if (!market) throw new Error('Market not found');
    if (market.resolved) throw new Error('Already resolved');

    market.resolved = true;
    market.outcome = outcome;

    const prediction = market.supportVotes > market.opposeVotes;
    const totalVotes = market.supportVotes + market.opposeVotes;
    const winningVotes = outcome ? market.supportVotes : market.opposeVotes;
    const accuracy = totalVotes > 0 ? winningVotes / totalVotes : 0.5;

    this.emit('market_resolved', { market, prediction, accuracy, correctPrediction: prediction === outcome });

    return { market, prediction, accuracy };
  }

  /**
   * Get current market prediction
   */
  getPrediction(marketId: string): { support: number; oppose: number; probability: number } {
    const market = this.markets.get(marketId);
    if (!market) throw new Error('Market not found');

    const total = market.supportVotes + market.opposeVotes;
    return {
      support: market.supportVotes,
      oppose: market.opposeVotes,
      probability: total > 0 ? market.supportVotes / total : 0.5,
    };
  }

  /**
   * Get voter information
   */
  getVoterInfo(address: string): VoterCredits {
    return this.getOrCreateVoter(address);
  }

  /**
   * Get market by ID
   */
  getMarket(marketId: string): QuadraticMarket | undefined {
    return this.markets.get(marketId);
  }

  /**
   * Get markets by proposal
   */
  getMarketsByProposal(proposalId: string): QuadraticMarket[] {
    return Array.from(this.markets.values()).filter(m => m.proposalId === proposalId);
  }

  /**
   * Get all voter stats
   */
  getVoterStats(): Array<VoterCredits & { marketParticipation: number }> {
    return Array.from(this.voterCredits.values()).map(v => {
      const marketsVotedIn = new Set(
        Array.from(this.markets.values())
          .filter(m => m.votes.some(vote => vote.voter === v.address))
          .map(m => m.id)
      );
      return {
        ...v,
        marketParticipation: marketsVotedIn.size,
      };
    });
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  ConvictionBetting,
  DebateFuturesMarket,
  AgentTokenSystem,
  InsurancePool,
  QuadraticPredictionMarket,
};
