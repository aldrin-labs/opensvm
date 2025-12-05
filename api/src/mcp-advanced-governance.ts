/**
 * MCP Advanced Governance System
 *
 * Unified advanced governance combining:
 * 1. Conviction Voting - Time-weighted vote strength
 * 2. Rage Quit Protection - Minority exit rights
 * 3. Holographic Consensus - Stake-boosted fast-tracking
 *
 * This module integrates with the existing DAO and conviction voting systems.
 */

import { UnifiedMCPRegistry } from './mcp-registry-unified.js';
import { ConvictionVotingManager, ConvictionConfig, DEFAULT_CONVICTION_CONFIG } from './mcp-conviction-voting.js';

// ============================================================================
// Types
// ============================================================================

export type VotingMode = 'simple' | 'quadratic' | 'conviction' | 'holographic';

export type ProposalStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'boosted'        // Holographic: Boosted past quorum
  | 'rage_quit_window' // Grace period for rage quit
  | 'passed'
  | 'rejected'
  | 'executed'
  | 'cancelled';

// ============================================================================
// Rage Quit Types
// ============================================================================

export interface RageQuitConfig {
  // Window after proposal passes before execution (allows rage quit)
  gracePeriodMs: number;

  // Minimum stake duration to be eligible for rage quit
  minStakeDurationMs: number;

  // Cooldown after rage quit before can participate again
  cooldownMs: number;

  // Percentage of treasury claimable (pro-rata)
  maxClaimPercentage: number;

  // Proposals that cannot trigger rage quit (e.g., parameter changes)
  exemptProposalTypes: string[];
}

export interface RageQuitRequest {
  id: string;
  wallet: string;
  proposalId: string;  // The proposal they disagree with
  stakedAmount: bigint;
  claimableAmount: bigint;  // Pro-rata treasury share
  requestedAt: number;
  processedAt?: number;
  status: 'pending' | 'processed' | 'cancelled' | 'expired';
}

// ============================================================================
// Holographic Consensus Types
// ============================================================================

export interface HolographicConfig {
  // Amount to stake when boosting a proposal
  boostStakeRequired: bigint;

  // Reduced quorum percentage when boosted (e.g., 2% vs 10%)
  boostedQuorumPercent: number;

  // Regular quorum percentage
  regularQuorumPercent: number;

  // Time limit for boosted proposals (faster voting)
  boostedVotingPeriodMs: number;

  // Penalty for boosting a rejected proposal (slashing %)
  boostSlashPercent: number;

  // Reward for boosting a passed proposal (% of stake)
  boostRewardPercent: number;

  // Minimum prediction market confidence to auto-boost
  autoBoostConfidenceThreshold: number;
}

export interface ProposalBoost {
  proposalId: string;
  booster: string;
  stakeAmount: bigint;
  boostedAt: number;
  prediction: 'pass' | 'fail';  // Booster's prediction
  resolved: boolean;
  slashed: boolean;
  rewarded: boolean;
}

export interface PredictionMarket {
  proposalId: string;
  yesShares: bigint;
  noShares: bigint;
  yesPrice: number;  // 0-1, represents probability
  noPrice: number;
  totalLiquidity: bigint;
  resolved: boolean;
  outcome?: boolean;
}

// ============================================================================
// Advanced Proposal Type
// ============================================================================

export interface AdvancedProposal {
  // Core
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: string;
  status: ProposalStatus;

  // Voting mode
  votingMode: VotingMode;

  // Vote tallies
  votesFor: bigint;
  votesAgainst: bigint;
  votesAbstain: bigint;
  voterCount: number;

  // Conviction (if applicable)
  convictionFor: number;
  convictionAgainst: number;

  // Holographic (if applicable)
  boosted: boolean;
  boosts: ProposalBoost[];
  totalBoostStake: bigint;
  predictionMarket?: PredictionMarket;

  // Rage quit
  rageQuitEligible: boolean;
  rageQuitRequests: RageQuitRequest[];
  gracePeriodEndsAt?: number;

  // Thresholds
  quorum: bigint;
  effectiveQuorum: bigint;  // Reduced if boosted
  requiredConviction: number;

  // Timeline
  createdAt: number;
  votingStartsAt: number;
  votingEndsAt: number;
  executionETA?: number;
  executedAt?: number;

  // Actions
  actions: ProposalAction[];
}

export interface ProposalAction {
  target: string;
  function: string;
  params: Record<string, any>;
  value?: bigint;
}

// ============================================================================
// Configuration
// ============================================================================

export const DEFAULT_RAGE_QUIT_CONFIG: RageQuitConfig = {
  gracePeriodMs: 3 * 24 * 60 * 60 * 1000,  // 3 days
  minStakeDurationMs: 7 * 24 * 60 * 60 * 1000,  // 7 days minimum stake
  cooldownMs: 30 * 24 * 60 * 60 * 1000,  // 30 days cooldown
  maxClaimPercentage: 100,  // Can claim full pro-rata share
  exemptProposalTypes: ['parameter_change', 'emergency'],
};

export const DEFAULT_HOLOGRAPHIC_CONFIG: HolographicConfig = {
  boostStakeRequired: BigInt(5000) * BigInt(1e9),  // 5,000 tokens
  boostedQuorumPercent: 2,  // Only 2% quorum when boosted
  regularQuorumPercent: 10,  // Normal 10% quorum
  boostedVotingPeriodMs: 2 * 24 * 60 * 60 * 1000,  // 2 days (faster)
  boostSlashPercent: 10,  // Lose 10% if prediction wrong
  boostRewardPercent: 5,  // Gain 5% if prediction correct
  autoBoostConfidenceThreshold: 0.8,  // Auto-boost at 80% market confidence
};

export interface AdvancedGovernanceConfig {
  // Default voting mode for new proposals
  defaultVotingMode: VotingMode;

  // Enable features
  enableConviction: boolean;
  enableRageQuit: boolean;
  enableHolographic: boolean;
  enablePredictionMarkets: boolean;

  // Sub-configs
  conviction: Partial<ConvictionConfig>;
  rageQuit: Partial<RageQuitConfig>;
  holographic: Partial<HolographicConfig>;

  // Treasury
  treasuryBalance: bigint;

  // Minimum stake for proposals
  proposalThreshold: bigint;
}

const DEFAULT_ADVANCED_CONFIG: AdvancedGovernanceConfig = {
  defaultVotingMode: 'conviction',
  enableConviction: true,
  enableRageQuit: true,
  enableHolographic: true,
  enablePredictionMarkets: true,
  conviction: DEFAULT_CONVICTION_CONFIG,
  rageQuit: DEFAULT_RAGE_QUIT_CONFIG,
  holographic: DEFAULT_HOLOGRAPHIC_CONFIG,
  treasuryBalance: BigInt(10_000_000) * BigInt(1e9),  // 10M tokens
  proposalThreshold: BigInt(1000) * BigInt(1e9),  // 1,000 tokens
};

// ============================================================================
// Advanced Governance Manager
// ============================================================================

export class AdvancedGovernance {
  private config: AdvancedGovernanceConfig;
  private rageQuitConfig: RageQuitConfig;
  private holographicConfig: HolographicConfig;
  private convictionManager: ConvictionVotingManager;

  private proposals = new Map<string, AdvancedProposal>();
  private rageQuitRequests = new Map<string, RageQuitRequest>();
  private boosts = new Map<string, ProposalBoost[]>();
  private predictionMarkets = new Map<string, PredictionMarket>();
  private voterStakes = new Map<string, { amount: bigint; stakedAt: number }>();
  private rageQuitCooldowns = new Map<string, number>();

  private proposalCount = 0;
  private registry: UnifiedMCPRegistry;

  constructor(registry: UnifiedMCPRegistry, config: Partial<AdvancedGovernanceConfig> = {}) {
    this.config = { ...DEFAULT_ADVANCED_CONFIG, ...config };
    this.rageQuitConfig = { ...DEFAULT_RAGE_QUIT_CONFIG, ...config.rageQuit };
    this.holographicConfig = { ...DEFAULT_HOLOGRAPHIC_CONFIG, ...config.holographic };
    this.convictionManager = new ConvictionVotingManager(this.config.conviction);
    this.registry = registry;
  }

  // ==========================================================================
  // Staking (Required for governance participation)
  // ==========================================================================

  /**
   * Register stake for governance participation
   */
  registerStake(wallet: string, amount: bigint): void {
    this.voterStakes.set(wallet, { amount, stakedAt: Date.now() });
    console.log(`[Governance] Stake registered: ${wallet} (${amount})`);
  }

  /**
   * Get voter's stake info
   */
  getStake(wallet: string): { amount: bigint; stakedAt: number; duration: number } | null {
    const stake = this.voterStakes.get(wallet);
    if (!stake) return null;
    return {
      ...stake,
      duration: Date.now() - stake.stakedAt,
    };
  }

  // ==========================================================================
  // Proposal Creation
  // ==========================================================================

  /**
   * Create a new proposal with advanced features
   */
  createProposal(
    proposer: string,
    params: {
      title: string;
      description: string;
      type: string;
      votingMode?: VotingMode;
      actions: ProposalAction[];
      rageQuitEligible?: boolean;
    }
  ): AdvancedProposal {
    // Check proposer has enough stake
    const stake = this.voterStakes.get(proposer);
    if (!stake || stake.amount < this.config.proposalThreshold) {
      throw new Error(
        `Insufficient stake. Need ${this.config.proposalThreshold}, have ${stake?.amount || 0}`
      );
    }

    this.proposalCount++;
    const id = `ADV-${this.proposalCount}`;
    const now = Date.now();

    const votingMode = params.votingMode || this.config.defaultVotingMode;
    const votingPeriod = 5 * 24 * 60 * 60 * 1000;  // 5 days default

    // Calculate quorum
    const totalStaked = this.getTotalStaked();
    const quorum = (totalStaked * BigInt(this.holographicConfig.regularQuorumPercent)) / BigInt(100);

    // Determine rage quit eligibility
    const rageQuitEligible = params.rageQuitEligible !== false &&
      !this.rageQuitConfig.exemptProposalTypes.includes(params.type);

    const proposal: AdvancedProposal = {
      id,
      title: params.title,
      description: params.description,
      proposer,
      type: params.type,
      status: 'pending',
      votingMode,
      votesFor: BigInt(0),
      votesAgainst: BigInt(0),
      votesAbstain: BigInt(0),
      voterCount: 0,
      convictionFor: 0,
      convictionAgainst: 0,
      boosted: false,
      boosts: [],
      totalBoostStake: BigInt(0),
      rageQuitEligible,
      rageQuitRequests: [],
      quorum,
      effectiveQuorum: quorum,
      requiredConviction: 100,  // Default conviction threshold
      createdAt: now,
      votingStartsAt: now + 12 * 60 * 60 * 1000,  // 12 hour delay
      votingEndsAt: now + 12 * 60 * 60 * 1000 + votingPeriod,
      actions: params.actions,
    };

    this.proposals.set(id, proposal);

    // Initialize prediction market if enabled
    if (this.config.enablePredictionMarkets) {
      this.initializePredictionMarket(id);
    }

    // Create conviction proposal if using conviction voting
    if (votingMode === 'conviction' && this.config.enableConviction) {
      this.convictionManager.createProposal(id, params.title, proposal.requiredConviction);
    }

    console.log(`[Governance] Proposal created: ${id} (${votingMode} voting, rage quit: ${rageQuitEligible})`);
    return proposal;
  }

  private getTotalStaked(): bigint {
    let total = BigInt(0);
    for (const stake of this.voterStakes.values()) {
      total += stake.amount;
    }
    return total || BigInt(1);  // Prevent division by zero
  }

  // ==========================================================================
  // Holographic Consensus - Boosting
  // ==========================================================================

  /**
   * Boost a proposal to bypass regular quorum
   */
  boostProposal(
    proposalId: string,
    booster: string,
    prediction: 'pass' | 'fail'
  ): ProposalBoost {
    if (!this.config.enableHolographic) {
      throw new Error('Holographic consensus not enabled');
    }

    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'active' && proposal.status !== 'pending') {
      throw new Error('Proposal cannot be boosted');
    }
    if (proposal.boosted) {
      throw new Error('Proposal already boosted');
    }

    // Check booster has enough stake
    const stake = this.voterStakes.get(booster);
    if (!stake || stake.amount < this.holographicConfig.boostStakeRequired) {
      throw new Error(
        `Insufficient stake to boost. Need ${this.holographicConfig.boostStakeRequired}`
      );
    }

    const boost: ProposalBoost = {
      proposalId,
      booster,
      stakeAmount: this.holographicConfig.boostStakeRequired,
      boostedAt: Date.now(),
      prediction,
      resolved: false,
      slashed: false,
      rewarded: false,
    };

    proposal.boosts.push(boost);
    proposal.totalBoostStake += boost.stakeAmount;
    proposal.boosted = true;
    proposal.status = 'boosted';

    // Reduce quorum and shorten voting period
    proposal.effectiveQuorum =
      (this.getTotalStaked() * BigInt(this.holographicConfig.boostedQuorumPercent)) / BigInt(100);
    proposal.votingEndsAt = Date.now() + this.holographicConfig.boostedVotingPeriodMs;

    console.log(`[Governance] Proposal ${proposalId} BOOSTED by ${booster} (predicted: ${prediction})`);
    return boost;
  }

  /**
   * Resolve boost rewards/slashing after proposal concludes
   */
  resolveBoosts(proposalId: string): { rewarded: string[]; slashed: string[] } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'passed' && proposal.status !== 'rejected') {
      throw new Error('Proposal not concluded');
    }

    const rewarded: string[] = [];
    const slashed: string[] = [];
    const passed = proposal.status === 'passed';

    for (const boost of proposal.boosts) {
      if (boost.resolved) continue;

      const predictedCorrectly =
        (boost.prediction === 'pass' && passed) ||
        (boost.prediction === 'fail' && !passed);

      if (predictedCorrectly) {
        // Reward the booster
        const reward = (boost.stakeAmount * BigInt(this.holographicConfig.boostRewardPercent)) / BigInt(100);
        boost.rewarded = true;
        rewarded.push(boost.booster);
        console.log(`[Governance] Booster ${boost.booster} rewarded ${reward} for correct prediction`);
      } else {
        // Slash the booster
        const slash = (boost.stakeAmount * BigInt(this.holographicConfig.boostSlashPercent)) / BigInt(100);
        boost.slashed = true;
        slashed.push(boost.booster);
        console.log(`[Governance] Booster ${boost.booster} slashed ${slash} for incorrect prediction`);
      }

      boost.resolved = true;
    }

    return { rewarded, slashed };
  }

  // ==========================================================================
  // Prediction Markets
  // ==========================================================================

  private initializePredictionMarket(proposalId: string): void {
    const market: PredictionMarket = {
      proposalId,
      yesShares: BigInt(0),
      noShares: BigInt(0),
      yesPrice: 0.5,  // Start at 50/50
      noPrice: 0.5,
      totalLiquidity: BigInt(0),
      resolved: false,
    };
    this.predictionMarkets.set(proposalId, market);
  }

  /**
   * Buy prediction market shares
   */
  buyPredictionShares(
    proposalId: string,
    buyer: string,
    outcome: 'yes' | 'no',
    amount: bigint
  ): { shares: bigint; price: number } {
    const market = this.predictionMarkets.get(proposalId);
    if (!market) throw new Error('Market not found');
    if (market.resolved) throw new Error('Market already resolved');

    // Simple constant product AMM
    const k = (market.yesShares + BigInt(1e18)) * (market.noShares + BigInt(1e18));

    let shares: bigint;
    if (outcome === 'yes') {
      const newNoShares = k / (market.yesShares + BigInt(1e18) + amount);
      shares = market.noShares + BigInt(1e18) - newNoShares;
      market.yesShares += amount;
    } else {
      const newYesShares = k / (market.noShares + BigInt(1e18) + amount);
      shares = market.yesShares + BigInt(1e18) - newYesShares;
      market.noShares += amount;
    }

    market.totalLiquidity += amount;
    this.updatePrices(market);

    // Check for auto-boost
    if (this.config.enableHolographic) {
      const proposal = this.proposals.get(proposalId);
      if (proposal && !proposal.boosted && market.yesPrice >= this.holographicConfig.autoBoostConfidenceThreshold) {
        console.log(`[Governance] Market confidence ${(market.yesPrice * 100).toFixed(1)}% triggers auto-boost consideration`);
      }
    }

    return { shares, price: outcome === 'yes' ? market.yesPrice : market.noPrice };
  }

  private updatePrices(market: PredictionMarket): void {
    const total = market.yesShares + market.noShares + BigInt(2e18);
    market.yesPrice = Number(market.yesShares + BigInt(1e18)) / Number(total);
    market.noPrice = 1 - market.yesPrice;
  }

  /**
   * Get market prediction
   */
  getMarketPrediction(proposalId: string): { willPass: number; willFail: number } | null {
    const market = this.predictionMarkets.get(proposalId);
    if (!market) return null;
    return { willPass: market.yesPrice, willFail: market.noPrice };
  }

  // ==========================================================================
  // Rage Quit
  // ==========================================================================

  /**
   * Request rage quit after a proposal passes
   */
  requestRageQuit(
    wallet: string,
    proposalId: string
  ): RageQuitRequest {
    if (!this.config.enableRageQuit) {
      throw new Error('Rage quit not enabled');
    }

    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (!proposal.rageQuitEligible) {
      throw new Error('This proposal type is not eligible for rage quit');
    }
    if (proposal.status !== 'rage_quit_window' && proposal.status !== 'passed') {
      throw new Error('Proposal not in rage quit window');
    }

    // Check cooldown
    const cooldownEnd = this.rageQuitCooldowns.get(wallet);
    if (cooldownEnd && Date.now() < cooldownEnd) {
      const remaining = cooldownEnd - Date.now();
      throw new Error(`Rage quit cooldown active. ${Math.ceil(remaining / (24 * 60 * 60 * 1000))} days remaining`);
    }

    // Check stake duration
    const stake = this.voterStakes.get(wallet);
    if (!stake) throw new Error('No stake found');
    const stakeDuration = Date.now() - stake.stakedAt;
    if (stakeDuration < this.rageQuitConfig.minStakeDurationMs) {
      throw new Error(
        `Stake too recent. Need ${this.rageQuitConfig.minStakeDurationMs / (24 * 60 * 60 * 1000)} days minimum`
      );
    }

    // Calculate pro-rata share
    const totalStaked = this.getTotalStaked();
    const sharePercent = Number((stake.amount * BigInt(10000)) / totalStaked) / 100;
    const claimablePercent = Math.min(sharePercent, this.rageQuitConfig.maxClaimPercentage);
    const claimableAmount = (this.config.treasuryBalance * BigInt(Math.floor(claimablePercent * 100))) / BigInt(10000);

    const request: RageQuitRequest = {
      id: `RQ-${Date.now()}-${wallet.slice(0, 8)}`,
      wallet,
      proposalId,
      stakedAmount: stake.amount,
      claimableAmount,
      requestedAt: Date.now(),
      status: 'pending',
    };

    this.rageQuitRequests.set(request.id, request);
    proposal.rageQuitRequests.push(request);

    console.log(`[Governance] Rage quit requested: ${wallet} can claim ${claimableAmount} tokens`);
    return request;
  }

  /**
   * Process rage quit (burn stake, distribute treasury share)
   */
  processRageQuit(requestId: string): {
    burned: bigint;
    claimed: bigint;
  } {
    const request = this.rageQuitRequests.get(requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Request already processed');

    const proposal = this.proposals.get(request.proposalId);
    if (!proposal) throw new Error('Proposal not found');

    // Check grace period hasn't ended
    if (proposal.gracePeriodEndsAt && Date.now() > proposal.gracePeriodEndsAt) {
      request.status = 'expired';
      throw new Error('Grace period has ended');
    }

    // Burn stake
    const stake = this.voterStakes.get(request.wallet);
    if (stake) {
      this.voterStakes.delete(request.wallet);
    }

    // Distribute treasury share
    this.config.treasuryBalance -= request.claimableAmount;

    // Set cooldown
    this.rageQuitCooldowns.set(request.wallet, Date.now() + this.rageQuitConfig.cooldownMs);

    request.status = 'processed';
    request.processedAt = Date.now();

    console.log(`[Governance] Rage quit processed: ${request.wallet} burned ${request.stakedAmount}, claimed ${request.claimableAmount}`);

    return {
      burned: request.stakedAmount,
      claimed: request.claimableAmount,
    };
  }

  /**
   * Cancel rage quit request
   */
  cancelRageQuit(requestId: string, wallet: string): boolean {
    const request = this.rageQuitRequests.get(requestId);
    if (!request) return false;
    if (request.wallet !== wallet) throw new Error('Not your request');
    if (request.status !== 'pending') return false;

    request.status = 'cancelled';
    return true;
  }

  // ==========================================================================
  // Voting (Unified)
  // ==========================================================================

  /**
   * Cast vote with mode-specific handling
   */
  vote(
    proposalId: string,
    voter: string,
    support: 'for' | 'against' | 'abstain',
    reason?: string
  ): { success: boolean; votingPower: bigint; conviction?: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'active' && proposal.status !== 'boosted') {
      // Auto-activate if in voting period
      if (Date.now() >= proposal.votingStartsAt && Date.now() <= proposal.votingEndsAt) {
        proposal.status = proposal.boosted ? 'boosted' : 'active';
      } else {
        throw new Error(`Cannot vote on proposal with status: ${proposal.status}`);
      }
    }

    const stake = this.voterStakes.get(voter);
    if (!stake) throw new Error('No stake found');

    // Handle conviction voting
    if (proposal.votingMode === 'conviction' && this.config.enableConviction) {
      const convVote = this.convictionManager.vote(proposalId, voter, support, stake.amount);
      this.convictionManager.updateConvictions(proposalId);

      const convStatus = this.convictionManager.getProposalStatus(proposalId);
      if (convStatus) {
        proposal.convictionFor = convStatus.forConviction;
        proposal.convictionAgainst = convStatus.againstConviction;
      }

      return {
        success: true,
        votingPower: stake.amount,
        conviction: convVote.currentConviction,
      };
    }

    // Standard voting
    proposal.voterCount++;
    switch (support) {
      case 'for':
        proposal.votesFor += stake.amount;
        break;
      case 'against':
        proposal.votesAgainst += stake.amount;
        break;
      case 'abstain':
        proposal.votesAbstain += stake.amount;
        break;
    }

    console.log(`[Governance] Vote: ${voter} voted ${support} on ${proposalId}`);
    return { success: true, votingPower: stake.amount };
  }

  // ==========================================================================
  // Proposal Lifecycle
  // ==========================================================================

  /**
   * Finalize voting and determine outcome
   */
  finalizeProposal(proposalId: string): AdvancedProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status === 'passed' || proposal.status === 'rejected' || proposal.status === 'executed') {
      return proposal;
    }

    // Check voting period ended
    if (Date.now() < proposal.votingEndsAt) {
      throw new Error('Voting period not ended');
    }

    // Determine outcome based on voting mode
    let passed = false;

    if (proposal.votingMode === 'conviction') {
      // Update conviction one final time
      this.convictionManager.updateConvictions(proposalId);
      const convStatus = this.convictionManager.getProposalStatus(proposalId);
      if (convStatus) {
        proposal.convictionFor = convStatus.forConviction;
        proposal.convictionAgainst = convStatus.againstConviction;
        passed = convStatus.netConviction >= proposal.requiredConviction;
      }
    } else {
      // Simple majority with quorum check
      const totalVotes = proposal.votesFor + proposal.votesAgainst;
      const meetsQuorum = totalVotes >= proposal.effectiveQuorum;
      passed = meetsQuorum && proposal.votesFor > proposal.votesAgainst;
    }

    if (passed) {
      proposal.status = 'passed';

      // If rage quit eligible, enter grace period
      if (proposal.rageQuitEligible && this.config.enableRageQuit) {
        proposal.status = 'rage_quit_window';
        proposal.gracePeriodEndsAt = Date.now() + this.rageQuitConfig.gracePeriodMs;
        proposal.executionETA = proposal.gracePeriodEndsAt;
        console.log(`[Governance] Proposal ${proposalId} PASSED - entering rage quit window`);
      } else {
        proposal.executionETA = Date.now();
        console.log(`[Governance] Proposal ${proposalId} PASSED`);
      }
    } else {
      proposal.status = 'rejected';
      console.log(`[Governance] Proposal ${proposalId} REJECTED`);
    }

    // Resolve boosts
    if (proposal.boosted) {
      this.resolveBoosts(proposalId);
    }

    // Resolve prediction market
    const market = this.predictionMarkets.get(proposalId);
    if (market) {
      market.resolved = true;
      market.outcome = passed;
    }

    return proposal;
  }

  /**
   * Execute a passed proposal
   */
  execute(proposalId: string): { success: boolean; results: any[] } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status === 'rage_quit_window') {
      if (proposal.gracePeriodEndsAt && Date.now() < proposal.gracePeriodEndsAt) {
        throw new Error('Grace period not ended');
      }
      proposal.status = 'passed';
    }

    if (proposal.status !== 'passed') {
      throw new Error('Proposal not passed');
    }

    const results: any[] = [];

    for (const action of proposal.actions) {
      try {
        // Execute action (in real implementation, this would call actual contracts)
        console.log(`[Governance] Executing: ${action.target}.${action.function}(${JSON.stringify(action.params)})`);
        results.push({ action, success: true });
      } catch (error) {
        results.push({ action, success: false, error: String(error) });
      }
    }

    proposal.status = 'executed';
    proposal.executedAt = Date.now();

    console.log(`[Governance] Proposal ${proposalId} EXECUTED`);
    return { success: true, results };
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  getProposal(id: string): AdvancedProposal | null {
    return this.proposals.get(id) || null;
  }

  getActiveProposals(): AdvancedProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => ['pending', 'active', 'boosted', 'rage_quit_window'].includes(p.status));
  }

  getRageQuitRequests(wallet?: string): RageQuitRequest[] {
    const requests = Array.from(this.rageQuitRequests.values());
    if (wallet) {
      return requests.filter(r => r.wallet === wallet);
    }
    return requests;
  }

  /**
   * Get comprehensive governance statistics
   */
  getStats(): {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    boostedProposals: number;
    totalRageQuits: number;
    treasuryBalance: bigint;
    totalStaked: bigint;
    config: AdvancedGovernanceConfig;
  } {
    const proposals = Array.from(this.proposals.values());
    const boosted = proposals.filter(p => p.boosted).length;
    const passed = proposals.filter(p => p.status === 'passed' || p.status === 'executed').length;
    const active = proposals.filter(p =>
      ['pending', 'active', 'boosted', 'rage_quit_window'].includes(p.status)
    ).length;

    const processedRageQuits = Array.from(this.rageQuitRequests.values())
      .filter(r => r.status === 'processed').length;

    return {
      totalProposals: proposals.length,
      activeProposals: active,
      passedProposals: passed,
      boostedProposals: boosted,
      totalRageQuits: processedRageQuits,
      treasuryBalance: this.config.treasuryBalance,
      totalStaked: this.getTotalStaked(),
      config: this.config,
    };
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let globalAdvancedGov: AdvancedGovernance | null = null;

export function getAdvancedGovernance(
  registry: UnifiedMCPRegistry,
  config?: Partial<AdvancedGovernanceConfig>
): AdvancedGovernance {
  if (!globalAdvancedGov) {
    globalAdvancedGov = new AdvancedGovernance(registry, config);
  }
  return globalAdvancedGov;
}

// ============================================================================
// Exports
// ============================================================================

export const advancedGovernance = {
  AdvancedGovernance,
  getAdvancedGovernance,
  DEFAULT_RAGE_QUIT_CONFIG,
  DEFAULT_HOLOGRAPHIC_CONFIG,
};
