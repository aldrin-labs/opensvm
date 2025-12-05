#!/usr/bin/env bun
/**
 * Novel Voting Mechanisms
 *
 * Features:
 * 1. Futarchy Integration - Use prediction market prices as binding votes
 * 2. Holographic Consensus - Small quorum for uncontested, full for disputed
 * 3. Conviction Voting AMM - Continuous funding based on sustained support
 * 4. Retroactive Voting - Vote on past decisions to calibrate future weights
 * 5. Liquid Democracy Agents - Agents can delegate to other agents dynamically
 */

import { EventEmitter } from 'events';

// ============================================================================
// Common Types
// ============================================================================

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'active' | 'passed' | 'failed' | 'executed';
}

// ============================================================================
// 1. Futarchy Integration
// ============================================================================

export interface FutarchyProposal extends Proposal {
  targetMetric: string; // e.g., "TVL", "daily_volume", "token_price"
  baselineValue: number;
  measurementPeriod: number; // seconds after execution to measure
  markets: {
    pass: FutarchyMarket;
    fail: FutarchyMarket;
  };
}

export interface FutarchyMarket {
  id: string;
  proposalId: string;
  outcome: 'pass' | 'fail';
  currentPrice: number; // 0-1, represents expected metric value
  liquidity: number;
  trades: FutarchyTrade[];
}

export interface FutarchyTrade {
  trader: string;
  amount: number;
  price: number;
  timestamp: number;
  market: 'pass' | 'fail';
}

export class FutarchyGovernance extends EventEmitter {
  private proposals: Map<string, FutarchyProposal> = new Map();
  private traderPositions: Map<string, Map<string, number>> = new Map(); // proposalId -> trader -> netPosition

  constructor() {
    super();
  }

  /**
   * Create a futarchy proposal with paired markets
   */
  createProposal(
    title: string,
    description: string,
    proposer: string,
    targetMetric: string,
    baselineValue: number,
    measurementPeriod: number = 604800, // 1 week default
    votingPeriod: number = 259200 // 3 days default
  ): FutarchyProposal {
    const id = `futarchy_${Date.now()}`;

    const proposal: FutarchyProposal = {
      id,
      title,
      description,
      proposer,
      createdAt: Date.now(),
      expiresAt: Date.now() + (votingPeriod * 1000),
      status: 'active',
      targetMetric,
      baselineValue,
      measurementPeriod,
      markets: {
        pass: {
          id: `${id}_pass`,
          proposalId: id,
          outcome: 'pass',
          currentPrice: 0.5,
          liquidity: 10000,
          trades: [],
        },
        fail: {
          id: `${id}_fail`,
          proposalId: id,
          outcome: 'fail',
          currentPrice: 0.5,
          liquidity: 10000,
          trades: [],
        },
      },
    };

    this.proposals.set(id, proposal);
    this.traderPositions.set(id, new Map());

    this.emit('proposal_created', { id, targetMetric, baselineValue });
    return proposal;
  }

  /**
   * Trade on a futarchy market
   */
  trade(
    proposalId: string,
    trader: string,
    market: 'pass' | 'fail',
    amount: number, // Positive = buy, negative = sell
    maxPrice?: number
  ): { executed: boolean; price: number; shares: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'active') {
      return { executed: false, price: 0, shares: 0 };
    }

    const targetMarket = proposal.markets[market];
    const otherMarket = proposal.markets[market === 'pass' ? 'fail' : 'pass'];

    // Simple linear market maker
    const priceImpact = amount / (targetMarket.liquidity * 2);
    const newPrice = Math.max(0.01, Math.min(0.99, targetMarket.currentPrice + priceImpact));

    if (maxPrice !== undefined && amount > 0 && newPrice > maxPrice) {
      return { executed: false, price: newPrice, shares: 0 };
    }

    const avgPrice = (targetMarket.currentPrice + newPrice) / 2;
    const shares = Math.abs(amount) / avgPrice;

    targetMarket.currentPrice = newPrice;
    // Maintain price sum = 1 (approximately)
    otherMarket.currentPrice = Math.max(0.01, Math.min(0.99, 1 - newPrice));

    targetMarket.trades.push({
      trader,
      amount,
      price: avgPrice,
      timestamp: Date.now(),
      market,
    });

    // Update trader position
    const positions = this.traderPositions.get(proposalId)!;
    const currentPosition = positions.get(trader) || 0;
    const positionDelta = market === 'pass' ? shares : -shares;
    positions.set(trader, currentPosition + positionDelta);

    this.emit('trade', { proposalId, trader, market, amount, price: avgPrice });
    return { executed: true, price: avgPrice, shares };
  }

  /**
   * Resolve proposal based on market prices
   */
  resolveByMarket(proposalId: string): { decision: 'pass' | 'fail'; confidence: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const passPrice = proposal.markets.pass.currentPrice;
    const failPrice = proposal.markets.fail.currentPrice;

    const decision = passPrice > failPrice ? 'pass' : 'fail';
    const confidence = Math.abs(passPrice - failPrice);

    proposal.status = decision === 'pass' ? 'passed' : 'failed';

    this.emit('resolved', { proposalId, decision, passPrice, failPrice, confidence });
    return { decision, confidence };
  }

  /**
   * Settle markets after actual metric measurement
   */
  settleWithMetric(proposalId: string, actualMetricValue: number): {
    winningMarket: 'pass' | 'fail';
    metricChange: number;
    totalPayouts: number;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const metricChange = (actualMetricValue - proposal.baselineValue) / proposal.baselineValue;

    // If proposal passed and metric improved, "pass" market wins
    // If proposal failed (baseline), "fail" market wins
    const winningMarket = proposal.status === 'passed'
      ? (metricChange > 0 ? 'pass' : 'fail')
      : 'fail';

    // Calculate payouts
    const positions = this.traderPositions.get(proposalId)!;
    let totalPayouts = 0;

    for (const [trader, position] of positions) {
      const payout = winningMarket === 'pass'
        ? Math.max(0, position)
        : Math.max(0, -position);
      totalPayouts += payout;
      this.emit('payout', { proposalId, trader, payout });
    }

    this.emit('settled', { proposalId, winningMarket, metricChange, totalPayouts });
    return { winningMarket, metricChange, totalPayouts };
  }

  /**
   * Get current market state
   */
  getMarketState(proposalId: string): {
    passPrice: number;
    failPrice: number;
    spread: number;
    totalVolume: number;
  } | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;

    const passVolume = proposal.markets.pass.trades.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const failVolume = proposal.markets.fail.trades.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      passPrice: proposal.markets.pass.currentPrice,
      failPrice: proposal.markets.fail.currentPrice,
      spread: Math.abs(proposal.markets.pass.currentPrice - proposal.markets.fail.currentPrice),
      totalVolume: passVolume + failVolume,
    };
  }

  /**
   * Get proposal
   */
  getProposal(id: string): FutarchyProposal | undefined {
    return this.proposals.get(id);
  }
}

// ============================================================================
// 2. Holographic Consensus
// ============================================================================

export interface HolographicProposal extends Proposal {
  boost: number; // Amount staked to boost proposal
  boosters: Map<string, number>;
  isContested: boolean;
  contestThreshold: number;
  regularQuorum: number;
  boostedQuorum: number;
  votes: Map<string, { vote: 'yes' | 'no'; weight: number }>;
}

export interface HolographicConfig {
  regularQuorum: number; // Full quorum percentage (e.g., 0.5 = 50%)
  boostedQuorum: number; // Reduced quorum for boosted (e.g., 0.1 = 10%)
  minBoostAmount: number;
  boostThreshold: number; // Amount needed to achieve boosted status
  contestWindow: number; // Time window for contesting (ms)
}

export const DEFAULT_HOLOGRAPHIC_CONFIG: HolographicConfig = {
  regularQuorum: 0.5,
  boostedQuorum: 0.1,
  minBoostAmount: 100,
  boostThreshold: 10000,
  contestWindow: 86400000, // 24 hours
};

export class HolographicConsensus extends EventEmitter {
  private proposals: Map<string, HolographicProposal> = new Map();
  private config: HolographicConfig;
  private totalVotingPower: number = 1000000; // Would be dynamic in production

  constructor(config: Partial<HolographicConfig> = {}) {
    super();
    this.config = { ...DEFAULT_HOLOGRAPHIC_CONFIG, ...config };
  }

  /**
   * Create a holographic proposal
   */
  createProposal(
    title: string,
    description: string,
    proposer: string,
    duration: number = 604800000 // 7 days default
  ): HolographicProposal {
    const id = `holo_${Date.now()}`;

    const proposal: HolographicProposal = {
      id,
      title,
      description,
      proposer,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
      status: 'pending',
      boost: 0,
      boosters: new Map(),
      isContested: false,
      contestThreshold: this.config.boostThreshold * 0.5,
      regularQuorum: this.config.regularQuorum,
      boostedQuorum: this.config.boostedQuorum,
      votes: new Map(),
    };

    this.proposals.set(id, proposal);
    this.emit('proposal_created', { id, title });
    return proposal;
  }

  /**
   * Boost a proposal (stake to reduce quorum requirement)
   */
  boost(proposalId: string, booster: string, amount: number): {
    success: boolean;
    totalBoost: number;
    isBoosted: boolean;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') {
      return { success: false, totalBoost: 0, isBoosted: false };
    }

    if (amount < this.config.minBoostAmount) {
      return { success: false, totalBoost: proposal.boost, isBoosted: false };
    }

    const currentBoost = proposal.boosters.get(booster) || 0;
    proposal.boosters.set(booster, currentBoost + amount);
    proposal.boost += amount;

    const isBoosted = proposal.boost >= this.config.boostThreshold;

    if (isBoosted && proposal.status === 'pending') {
      proposal.status = 'active';
      this.emit('proposal_boosted', { proposalId, totalBoost: proposal.boost });
    }

    return { success: true, totalBoost: proposal.boost, isBoosted };
  }

  /**
   * Contest a boosted proposal (raises quorum back to regular)
   */
  contest(proposalId: string, contester: string, amount: number): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'active') return false;

    // Already contested
    if (proposal.isContested) return false;

    // Check if within contest window
    const timeSinceActive = Date.now() - proposal.createdAt;
    if (timeSinceActive > this.config.contestWindow) return false;

    if (amount >= proposal.contestThreshold) {
      proposal.isContested = true;
      this.emit('proposal_contested', { proposalId, contester, amount });
      return true;
    }

    return false;
  }

  /**
   * Vote on a proposal
   */
  vote(proposalId: string, voter: string, vote: 'yes' | 'no', weight: number): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'active') return false;

    proposal.votes.set(voter, { vote, weight });
    this.emit('vote_cast', { proposalId, voter, vote, weight });
    return true;
  }

  /**
   * Check if proposal has reached quorum and resolve
   */
  checkAndResolve(proposalId: string): {
    resolved: boolean;
    passed: boolean;
    quorumReached: boolean;
    turnout: number;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'active') {
      return { resolved: false, passed: false, quorumReached: false, turnout: 0 };
    }

    let yesVotes = 0;
    let totalVotes = 0;

    for (const [, v] of proposal.votes) {
      totalVotes += v.weight;
      if (v.vote === 'yes') yesVotes += v.weight;
    }

    const turnout = totalVotes / this.totalVotingPower;
    const requiredQuorum = proposal.isContested
      ? proposal.regularQuorum
      : proposal.boostedQuorum;

    const quorumReached = turnout >= requiredQuorum;
    const majorityYes = yesVotes > (totalVotes / 2);

    if (quorumReached) {
      proposal.status = majorityYes ? 'passed' : 'failed';
      this.emit('proposal_resolved', {
        proposalId,
        passed: majorityYes,
        turnout,
        yesVotes,
        totalVotes,
      });
      return { resolved: true, passed: majorityYes, quorumReached, turnout };
    }

    return { resolved: false, passed: false, quorumReached, turnout };
  }

  /**
   * Get proposal status
   */
  getProposalStatus(proposalId: string): {
    boost: number;
    isBoosted: boolean;
    isContested: boolean;
    currentQuorum: number;
    voteCount: number;
  } | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;

    return {
      boost: proposal.boost,
      isBoosted: proposal.boost >= this.config.boostThreshold,
      isContested: proposal.isContested,
      currentQuorum: proposal.isContested ? proposal.regularQuorum : proposal.boostedQuorum,
      voteCount: proposal.votes.size,
    };
  }

  /**
   * Get proposal
   */
  getProposal(id: string): HolographicProposal | undefined {
    return this.proposals.get(id);
  }
}

// ============================================================================
// 3. Conviction Voting AMM
// ============================================================================

export interface ConvictionProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  requestedAmount: number;
  beneficiary: string;
  createdAt: number;
  supporters: Map<string, ConvictionSupport>;
  currentConviction: number;
  threshold: number;
  funded: boolean;
  fundedAmount: number;
}

export interface ConvictionSupport {
  supporter: string;
  amount: number;
  startTime: number;
  conviction: number; // Accumulated conviction
}

export interface ConvictionConfig {
  convictionGrowth: number; // Rate of conviction growth (half-life in blocks)
  minThreshold: number; // Minimum threshold for any proposal
  maxRatio: number; // Max ratio of pool that can be requested
  weight: number; // Exponent for conviction calculation
}

export const DEFAULT_CONVICTION_CONFIG: ConvictionConfig = {
  convictionGrowth: 0.9999, // Decay factor per block
  minThreshold: 0.1,
  maxRatio: 0.25,
  weight: 2,
};

export class ConvictionVotingAMM extends EventEmitter {
  private proposals: Map<string, ConvictionProposal> = new Map();
  private fundingPool: number;
  private config: ConvictionConfig;
  private currentBlock: number = 0;

  constructor(initialPool: number, config: Partial<ConvictionConfig> = {}) {
    super();
    this.fundingPool = initialPool;
    this.config = { ...DEFAULT_CONVICTION_CONFIG, ...config };
  }

  /**
   * Create a conviction voting proposal
   */
  createProposal(
    title: string,
    description: string,
    proposer: string,
    requestedAmount: number,
    beneficiary: string
  ): ConvictionProposal {
    // Validate requested amount
    const maxRequest = this.fundingPool * this.config.maxRatio;
    if (requestedAmount > maxRequest) {
      throw new Error(`Requested amount exceeds max ratio. Max: ${maxRequest}`);
    }

    const id = `conv_${Date.now()}`;

    // Calculate threshold based on requested amount
    const amountRatio = requestedAmount / this.fundingPool;
    const threshold = Math.max(
      this.config.minThreshold,
      amountRatio * Math.pow(amountRatio, this.config.weight)
    );

    const proposal: ConvictionProposal = {
      id,
      title,
      description,
      proposer,
      requestedAmount,
      beneficiary,
      createdAt: Date.now(),
      supporters: new Map(),
      currentConviction: 0,
      threshold,
      funded: false,
      fundedAmount: 0,
    };

    this.proposals.set(id, proposal);
    this.emit('proposal_created', { id, requestedAmount, threshold });
    return proposal;
  }

  /**
   * Add support to a proposal
   */
  addSupport(proposalId: string, supporter: string, amount: number): ConvictionSupport {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.funded) {
      throw new Error('Invalid proposal or already funded');
    }

    const existing = proposal.supporters.get(supporter);
    if (existing) {
      existing.amount += amount;
      return existing;
    }

    const support: ConvictionSupport = {
      supporter,
      amount,
      startTime: this.currentBlock,
      conviction: 0,
    };

    proposal.supporters.set(supporter, support);
    this.emit('support_added', { proposalId, supporter, amount });
    return support;
  }

  /**
   * Remove support from a proposal
   */
  removeSupport(proposalId: string, supporter: string, amount?: number): number {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return 0;

    const support = proposal.supporters.get(supporter);
    if (!support) return 0;

    const removeAmount = amount ?? support.amount;
    support.amount -= removeAmount;

    if (support.amount <= 0) {
      proposal.supporters.delete(supporter);
    }

    this.emit('support_removed', { proposalId, supporter, amount: removeAmount });
    return removeAmount;
  }

  /**
   * Update conviction scores (call periodically)
   */
  updateConvictions(blockDelta: number = 1): void {
    this.currentBlock += blockDelta;

    for (const proposal of this.proposals.values()) {
      if (proposal.funded) continue;

      let totalConviction = 0;

      for (const support of proposal.supporters.values()) {
        const blocksStaked = this.currentBlock - support.startTime;
        // Conviction grows asymptotically
        const maxConviction = support.amount;
        const growthFactor = 1 - Math.pow(this.config.convictionGrowth, blocksStaked);
        support.conviction = maxConviction * growthFactor;
        totalConviction += support.conviction;
      }

      proposal.currentConviction = totalConviction / this.fundingPool;

      // Check if threshold reached
      if (proposal.currentConviction >= proposal.threshold) {
        this.fundProposal(proposal);
      }
    }

    this.emit('convictions_updated', { block: this.currentBlock });
  }

  private fundProposal(proposal: ConvictionProposal): void {
    if (this.fundingPool < proposal.requestedAmount) {
      this.emit('insufficient_funds', { proposalId: proposal.id });
      return;
    }

    proposal.funded = true;
    proposal.fundedAmount = proposal.requestedAmount;
    this.fundingPool -= proposal.requestedAmount;

    this.emit('proposal_funded', {
      proposalId: proposal.id,
      amount: proposal.requestedAmount,
      beneficiary: proposal.beneficiary,
    });
  }

  /**
   * Add funds to the pool
   */
  addToPool(amount: number): number {
    this.fundingPool += amount;
    this.emit('pool_funded', { amount, newTotal: this.fundingPool });
    return this.fundingPool;
  }

  /**
   * Get proposal status
   */
  getProposalStatus(proposalId: string): {
    conviction: number;
    threshold: number;
    progress: number;
    supporterCount: number;
    totalSupport: number;
  } | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;

    const totalSupport = Array.from(proposal.supporters.values())
      .reduce((sum, s) => sum + s.amount, 0);

    return {
      conviction: proposal.currentConviction,
      threshold: proposal.threshold,
      progress: Math.min(1, proposal.currentConviction / proposal.threshold),
      supporterCount: proposal.supporters.size,
      totalSupport,
    };
  }

  /**
   * Get pool info
   */
  getPoolInfo(): { available: number; allocated: number } {
    const allocated = Array.from(this.proposals.values())
      .filter(p => p.funded)
      .reduce((sum, p) => sum + p.fundedAmount, 0);

    return { available: this.fundingPool, allocated };
  }

  /**
   * Get proposal
   */
  getProposal(id: string): ConvictionProposal | undefined {
    return this.proposals.get(id);
  }
}

// ============================================================================
// 4. Retroactive Voting
// ============================================================================

export interface RetroactiveVote {
  id: string;
  originalProposalId: string;
  originalOutcome: 'passed' | 'failed';
  actualImpact: 'positive' | 'negative' | 'neutral';
  impactScore: number; // -100 to 100
  votingPeriod: { start: number; end: number };
  votes: Map<string, { vote: 'good' | 'bad'; confidence: number }>;
  resolved: boolean;
  consensusOutcome?: 'good_decision' | 'bad_decision' | 'inconclusive';
}

export interface AgentCalibration {
  agentId: string;
  predictions: Array<{
    proposalId: string;
    predictedOutcome: 'support' | 'oppose';
    actualGood: boolean;
    confidence: number;
  }>;
  calibrationScore: number; // 0-1, higher = better calibrated
  weightAdjustment: number; // Multiplier for future votes
}

export class RetroactiveVoting extends EventEmitter {
  private retroVotes: Map<string, RetroactiveVote> = new Map();
  private agentCalibrations: Map<string, AgentCalibration> = new Map();

  constructor() {
    super();
  }

  /**
   * Create a retroactive vote for a past decision
   */
  createRetroVote(
    originalProposalId: string,
    originalOutcome: 'passed' | 'failed',
    actualImpact: 'positive' | 'negative' | 'neutral',
    impactScore: number,
    votingDuration: number = 604800000 // 7 days
  ): RetroactiveVote {
    const id = `retro_${originalProposalId}_${Date.now()}`;

    const retroVote: RetroactiveVote = {
      id,
      originalProposalId,
      originalOutcome,
      actualImpact,
      impactScore: Math.max(-100, Math.min(100, impactScore)),
      votingPeriod: {
        start: Date.now(),
        end: Date.now() + votingDuration,
      },
      votes: new Map(),
      resolved: false,
    };

    this.retroVotes.set(id, retroVote);
    this.emit('retro_vote_created', { id, originalProposalId, actualImpact });
    return retroVote;
  }

  /**
   * Cast a retroactive vote
   */
  castVote(
    retroVoteId: string,
    voter: string,
    vote: 'good' | 'bad',
    confidence: number
  ): boolean {
    const retroVote = this.retroVotes.get(retroVoteId);
    if (!retroVote || retroVote.resolved) return false;

    if (Date.now() > retroVote.votingPeriod.end) return false;

    retroVote.votes.set(voter, {
      vote,
      confidence: Math.max(0, Math.min(1, confidence)),
    });

    this.emit('retro_vote_cast', { retroVoteId, voter, vote });
    return true;
  }

  /**
   * Resolve a retroactive vote
   */
  resolve(retroVoteId: string): RetroactiveVote['consensusOutcome'] {
    const retroVote = this.retroVotes.get(retroVoteId);
    if (!retroVote || retroVote.resolved) return undefined;

    let goodVotes = 0;
    let badVotes = 0;
    let totalConfidence = 0;

    for (const [, v] of retroVote.votes) {
      if (v.vote === 'good') {
        goodVotes += v.confidence;
      } else {
        badVotes += v.confidence;
      }
      totalConfidence += v.confidence;
    }

    if (totalConfidence === 0) {
      retroVote.consensusOutcome = 'inconclusive';
    } else {
      const goodRatio = goodVotes / totalConfidence;
      if (goodRatio > 0.6) {
        retroVote.consensusOutcome = 'good_decision';
      } else if (goodRatio < 0.4) {
        retroVote.consensusOutcome = 'bad_decision';
      } else {
        retroVote.consensusOutcome = 'inconclusive';
      }
    }

    retroVote.resolved = true;
    this.emit('retro_vote_resolved', { retroVoteId, outcome: retroVote.consensusOutcome });
    return retroVote.consensusOutcome;
  }

  /**
   * Calibrate an agent based on retroactive outcomes
   */
  calibrateAgent(
    agentId: string,
    originalPrediction: { proposalId: string; outcome: 'support' | 'oppose'; confidence: number },
    retroOutcome: 'good_decision' | 'bad_decision'
  ): AgentCalibration {
    let calibration = this.agentCalibrations.get(agentId);

    if (!calibration) {
      calibration = {
        agentId,
        predictions: [],
        calibrationScore: 0.5,
        weightAdjustment: 1.0,
      };
      this.agentCalibrations.set(agentId, calibration);
    }

    // Determine if prediction was good
    const proposalPassed = originalPrediction.outcome === 'support';
    const wasGoodDecision = retroOutcome === 'good_decision';
    const predictionCorrect = proposalPassed === wasGoodDecision;

    calibration.predictions.push({
      proposalId: originalPrediction.proposalId,
      predictedOutcome: originalPrediction.outcome,
      actualGood: predictionCorrect,
      confidence: originalPrediction.confidence,
    });

    // Update calibration score
    const recentPredictions = calibration.predictions.slice(-20);
    const correctCount = recentPredictions.filter(p => p.actualGood).length;
    calibration.calibrationScore = correctCount / recentPredictions.length;

    // Adjust weight based on calibration
    calibration.weightAdjustment = 0.5 + calibration.calibrationScore;

    this.emit('agent_calibrated', {
      agentId,
      calibrationScore: calibration.calibrationScore,
      weightAdjustment: calibration.weightAdjustment,
    });

    return calibration;
  }

  /**
   * Get agent calibration
   */
  getAgentCalibration(agentId: string): AgentCalibration | undefined {
    return this.agentCalibrations.get(agentId);
  }

  /**
   * Get retro vote
   */
  getRetroVote(id: string): RetroactiveVote | undefined {
    return this.retroVotes.get(id);
  }

  /**
   * Get pending retro votes
   */
  getPendingRetroVotes(): RetroactiveVote[] {
    return Array.from(this.retroVotes.values())
      .filter(v => !v.resolved && Date.now() < v.votingPeriod.end);
  }

  /**
   * Get calibration leaderboard
   */
  getCalibrationLeaderboard(): AgentCalibration[] {
    return Array.from(this.agentCalibrations.values())
      .sort((a, b) => b.calibrationScore - a.calibrationScore);
  }
}

// ============================================================================
// 5. Liquid Democracy Agents
// ============================================================================

export interface AgentDelegation {
  from: string; // Delegating agent
  to: string; // Receiving agent
  weight: number; // Percentage of voting power (0-1)
  topics: string[]; // Specific topics, or empty for all
  expiresAt?: number;
  transitive: boolean; // Can the delegate re-delegate?
}

export interface LiquidAgent {
  id: string;
  name: string;
  ownVotingPower: number;
  delegatedPower: number;
  delegationsReceived: AgentDelegation[];
  delegationsGiven: AgentDelegation[];
  votingHistory: Array<{ proposalId: string; vote: string; timestamp: number }>;
}

export class LiquidDemocracyAgents extends EventEmitter {
  private agents: Map<string, LiquidAgent> = new Map();
  private delegations: Map<string, AgentDelegation> = new Map(); // delegationId -> delegation

  constructor() {
    super();
  }

  /**
   * Register an agent
   */
  registerAgent(id: string, name: string, votingPower: number): LiquidAgent {
    if (this.agents.has(id)) {
      throw new Error('Agent already registered');
    }

    const agent: LiquidAgent = {
      id,
      name,
      ownVotingPower: votingPower,
      delegatedPower: 0,
      delegationsReceived: [],
      delegationsGiven: [],
      votingHistory: [],
    };

    this.agents.set(id, agent);
    this.emit('agent_registered', { id, name });
    return agent;
  }

  /**
   * Delegate voting power to another agent
   */
  delegate(
    fromAgentId: string,
    toAgentId: string,
    weight: number,
    options: { topics?: string[]; expiresAt?: number; transitive?: boolean } = {}
  ): AgentDelegation {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error('Agent not found');
    }

    if (fromAgentId === toAgentId) {
      throw new Error('Cannot delegate to self');
    }

    // Check for circular delegation
    if (this.wouldCreateCycle(fromAgentId, toAgentId)) {
      throw new Error('Delegation would create a cycle');
    }

    // Check if already delegating to this agent
    const existingDelegation = fromAgent.delegationsGiven.find(d => d.to === toAgentId);
    if (existingDelegation) {
      // Update existing
      existingDelegation.weight = Math.min(1, weight);
      existingDelegation.topics = options.topics || [];
      existingDelegation.expiresAt = options.expiresAt;
      existingDelegation.transitive = options.transitive ?? true;
      this.recalculatePower(toAgentId);
      return existingDelegation;
    }

    const delegation: AgentDelegation = {
      from: fromAgentId,
      to: toAgentId,
      weight: Math.min(1, weight),
      topics: options.topics || [],
      expiresAt: options.expiresAt,
      transitive: options.transitive ?? true,
    };

    const delegationId = `del_${fromAgentId}_${toAgentId}_${Date.now()}`;
    this.delegations.set(delegationId, delegation);

    fromAgent.delegationsGiven.push(delegation);
    toAgent.delegationsReceived.push(delegation);

    this.recalculatePower(toAgentId);

    this.emit('delegation_created', { from: fromAgentId, to: toAgentId, weight });
    return delegation;
  }

  /**
   * Remove a delegation
   */
  undelegate(fromAgentId: string, toAgentId: string): boolean {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);

    if (!fromAgent || !toAgent) return false;

    const delegationIndex = fromAgent.delegationsGiven.findIndex(d => d.to === toAgentId);
    if (delegationIndex === -1) return false;

    fromAgent.delegationsGiven.splice(delegationIndex, 1);

    const receivedIndex = toAgent.delegationsReceived.findIndex(d => d.from === fromAgentId);
    if (receivedIndex !== -1) {
      toAgent.delegationsReceived.splice(receivedIndex, 1);
    }

    this.recalculatePower(toAgentId);

    this.emit('delegation_removed', { from: fromAgentId, to: toAgentId });
    return true;
  }

  private wouldCreateCycle(from: string, to: string): boolean {
    const visited = new Set<string>();
    const queue = [to];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === from) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const agent = this.agents.get(current);
      if (agent) {
        for (const delegation of agent.delegationsGiven) {
          if (delegation.transitive) {
            queue.push(delegation.to);
          }
        }
      }
    }

    return false;
  }

  private recalculatePower(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    let delegatedPower = 0;

    for (const delegation of agent.delegationsReceived) {
      // Skip expired delegations
      if (delegation.expiresAt && Date.now() > delegation.expiresAt) continue;

      const fromAgent = this.agents.get(delegation.from);
      if (fromAgent) {
        delegatedPower += fromAgent.ownVotingPower * delegation.weight;

        // If transitive, include power delegated to the delegator
        if (delegation.transitive) {
          delegatedPower += fromAgent.delegatedPower * delegation.weight;
        }
      }
    }

    agent.delegatedPower = delegatedPower;

    // Propagate changes downstream
    for (const delegation of agent.delegationsGiven) {
      if (delegation.transitive) {
        this.recalculatePower(delegation.to);
      }
    }
  }

  /**
   * Get effective voting power for an agent
   */
  getEffectivePower(agentId: string, topic?: string): number {
    const agent = this.agents.get(agentId);
    if (!agent) return 0;

    let power = agent.ownVotingPower;

    for (const delegation of agent.delegationsReceived) {
      // Skip expired
      if (delegation.expiresAt && Date.now() > delegation.expiresAt) continue;

      // Check topic filter
      if (topic && delegation.topics.length > 0 && !delegation.topics.includes(topic)) {
        continue;
      }

      const fromAgent = this.agents.get(delegation.from);
      if (fromAgent) {
        power += fromAgent.ownVotingPower * delegation.weight;
        if (delegation.transitive) {
          power += fromAgent.delegatedPower * delegation.weight;
        }
      }
    }

    return power;
  }

  /**
   * Record a vote
   */
  recordVote(agentId: string, proposalId: string, vote: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.votingHistory.push({
      proposalId,
      vote,
      timestamp: Date.now(),
    });

    this.emit('vote_recorded', { agentId, proposalId, vote });
  }

  /**
   * Get delegation chain for an agent
   */
  getDelegationChain(agentId: string): string[] {
    const chain: string[] = [agentId];
    const agent = this.agents.get(agentId);
    if (!agent) return chain;

    for (const delegation of agent.delegationsGiven) {
      if (delegation.transitive) {
        const subChain = this.getDelegationChain(delegation.to);
        chain.push(...subChain.slice(1));
      } else {
        chain.push(delegation.to);
      }
    }

    return chain;
  }

  /**
   * Get agent info
   */
  getAgent(id: string): LiquidAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): LiquidAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get power leaderboard
   */
  getPowerLeaderboard(): Array<{ agentId: string; name: string; totalPower: number }> {
    return Array.from(this.agents.values())
      .map(a => ({
        agentId: a.id,
        name: a.name,
        totalPower: a.ownVotingPower + a.delegatedPower,
      }))
      .sort((a, b) => b.totalPower - a.totalPower);
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  FutarchyGovernance,
  HolographicConsensus,
  ConvictionVotingAMM,
  RetroactiveVoting,
  LiquidDemocracyAgents,
};
