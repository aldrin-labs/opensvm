/**
 * MCP Registry Conviction Voting
 *
 * Conviction voting is an advanced governance mechanism where:
 * - Vote strength grows over time the vote is held
 * - Prevents last-minute vote swings
 * - Rewards long-term commitment
 * - Combined with quadratic voting for better incentive alignment
 *
 * Formula:
 * conviction = votingPower * (1 - e^(-t/halfLife))
 *
 * Where:
 * - t = time since vote was cast (in days)
 * - halfLife = time to reach 50% of max conviction (configurable)
 *
 * Features:
 * - Continuous conviction accumulation
 * - Conviction decay on vote change
 * - Conviction-weighted proposal thresholds
 * - Delegation preserves conviction
 * - Snapshot-based conviction at proposal end
 */

// ============================================================================
// Types
// ============================================================================

export interface ConvictionConfig {
  // Half-life: time to reach 50% max conviction (in milliseconds)
  halfLifeMs: number;

  // Max conviction multiplier (e.g., 2.0 means votes can be 2x stronger at max)
  maxMultiplier: number;

  // Minimum conviction to count (prevents micro-votes)
  minConvictionThreshold: number;

  // Decay rate when changing vote (0-1, where 0 = full reset, 1 = no decay)
  voteChangeDecayRate: number;

  // Whether to combine with quadratic voting
  combineWithQuadratic: boolean;

  // Block-based or time-based conviction
  useBlockTime: boolean;
  msPerBlock: number;
}

export interface ConvictionVote {
  voter: string;
  proposalId: string;
  support: 'for' | 'against' | 'abstain';
  baseVotingPower: bigint;
  currentConviction: number;
  maxConviction: number;
  votedAt: number;           // Timestamp when vote was cast
  votedAtBlock: number;      // Block when vote was cast
  lastUpdated: number;       // Last conviction calculation
  voteHistory: VoteHistoryEntry[];
}

export interface VoteHistoryEntry {
  support: 'for' | 'against' | 'abstain';
  timestamp: number;
  block: number;
  convictionAtChange: number;
}

export interface ConvictionProposal {
  id: string;
  title: string;

  // Conviction thresholds
  requiredConviction: number;      // Total conviction needed to pass
  currentForConviction: number;    // Accumulated conviction FOR
  currentAgainstConviction: number; // Accumulated conviction AGAINST

  // Tracking
  votes: Map<string, ConvictionVote>;
  voterCount: number;

  // Timeline
  startTime: number;
  startBlock: number;
  endTime?: number;
  endBlock?: number;

  // Status
  status: 'active' | 'passed' | 'rejected' | 'executed';
  passedAt?: number;
  executedAt?: number;
}

export interface ConvictionDelegation {
  delegator: string;
  delegatee: string;
  amount: bigint;
  delegatedAt: number;
  convictionAtDelegation: number;  // Preserves conviction when delegating
}

export interface ConvictionSnapshot {
  proposalId: string;
  snapshotTime: number;
  snapshotBlock: number;
  totalForConviction: number;
  totalAgainstConviction: number;
  voterConvictions: Map<string, number>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONVICTION_CONFIG: ConvictionConfig = {
  halfLifeMs: 3 * 24 * 60 * 60 * 1000,  // 3 days to reach 50% conviction
  maxMultiplier: 3.0,                     // Max 3x voting power at full conviction
  minConvictionThreshold: 0.01,           // 1% minimum conviction to count
  voteChangeDecayRate: 0.5,               // Lose 50% conviction when changing vote
  combineWithQuadratic: true,             // Use both quadratic and conviction
  useBlockTime: false,                    // Use real time by default
  msPerBlock: 400,                        // Solana block time
};

// ============================================================================
// Conviction Calculator
// ============================================================================

export class ConvictionCalculator {
  private config: ConvictionConfig;

  constructor(config: Partial<ConvictionConfig> = {}) {
    this.config = { ...DEFAULT_CONVICTION_CONFIG, ...config };
  }

  /**
   * Calculate conviction multiplier based on time held
   * Uses exponential growth: 1 - e^(-t/halfLife)
   * Base multiplier is 1 (no bonus), max is maxMultiplier
   */
  calculateConvictionMultiplier(timeHeldMs: number): number {
    if (timeHeldMs <= 0) return 1;  // Base multiplier, no bonus

    const halfLife = this.config.halfLifeMs;
    const rawConviction = 1 - Math.exp(-timeHeldMs / halfLife);

    // Scale to max multiplier (1 to maxMultiplier range)
    return 1 + rawConviction * (this.config.maxMultiplier - 1);
  }

  /**
   * Calculate effective conviction power
   */
  calculateConviction(
    baseVotingPower: bigint,
    timeHeldMs: number,
    useQuadratic: boolean = this.config.combineWithQuadratic
  ): number {
    const multiplier = this.calculateConvictionMultiplier(timeHeldMs);

    // Convert to number for calculation
    let effectivePower = Number(baseVotingPower) / 1e9;  // Normalize to tokens

    // Apply quadratic if enabled
    if (useQuadratic) {
      effectivePower = Math.sqrt(effectivePower);
    }

    // Apply conviction multiplier
    return effectivePower * multiplier;
  }

  /**
   * Calculate decayed conviction after vote change
   */
  calculateDecayedConviction(previousConviction: number): number {
    return previousConviction * this.config.voteChangeDecayRate;
  }

  /**
   * Get time to reach specific conviction percentage
   */
  getTimeToConviction(targetPercentage: number): number {
    // Solve: target = 1 - e^(-t/halfLife)
    // t = -halfLife * ln(1 - target)
    const clampedTarget = Math.min(Math.max(targetPercentage, 0.01), 0.99);
    return -this.config.halfLifeMs * Math.log(1 - clampedTarget);
  }

  /**
   * Check if conviction meets threshold
   */
  meetsThreshold(conviction: number): boolean {
    return conviction >= this.config.minConvictionThreshold;
  }

  /**
   * Get conviction growth curve data points (for visualization)
   */
  getConvictionCurve(daysToPlot: number = 14, pointsPerDay: number = 4): {
    time: number;
    conviction: number;
    multiplier: number;
  }[] {
    const points: { time: number; conviction: number; multiplier: number }[] = [];
    const totalPoints = daysToPlot * pointsPerDay;
    const msPerPoint = (24 * 60 * 60 * 1000) / pointsPerDay;

    for (let i = 0; i <= totalPoints; i++) {
      const timeMs = i * msPerPoint;
      const multiplier = this.calculateConvictionMultiplier(timeMs);
      const normalizedConviction = (multiplier - 1) / (this.config.maxMultiplier - 1);

      points.push({
        time: timeMs / (24 * 60 * 60 * 1000),  // Convert to days
        conviction: normalizedConviction,
        multiplier,
      });
    }

    return points;
  }
}

// ============================================================================
// Conviction Voting Manager
// ============================================================================

export class ConvictionVotingManager {
  private config: ConvictionConfig;
  private calculator: ConvictionCalculator;
  private proposals = new Map<string, ConvictionProposal>();
  private delegations = new Map<string, ConvictionDelegation>();
  private snapshots = new Map<string, ConvictionSnapshot>();
  private currentBlock = 0;

  constructor(config: Partial<ConvictionConfig> = {}) {
    this.config = { ...DEFAULT_CONVICTION_CONFIG, ...config };
    this.calculator = new ConvictionCalculator(this.config);
  }

  // ==========================================================================
  // Proposal Management
  // ==========================================================================

  /**
   * Create a new conviction-based proposal
   */
  createProposal(
    id: string,
    title: string,
    requiredConviction: number
  ): ConvictionProposal {
    const proposal: ConvictionProposal = {
      id,
      title,
      requiredConviction,
      currentForConviction: 0,
      currentAgainstConviction: 0,
      votes: new Map(),
      voterCount: 0,
      startTime: Date.now(),
      startBlock: this.currentBlock,
      status: 'active',
    };

    this.proposals.set(id, proposal);
    console.log(`[Conviction] Proposal created: ${id} (threshold: ${requiredConviction})`);
    return proposal;
  }

  /**
   * Cast a conviction vote
   */
  vote(
    proposalId: string,
    voter: string,
    support: 'for' | 'against' | 'abstain',
    votingPower: bigint
  ): ConvictionVote {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'active') {
      throw new Error('Proposal is not active');
    }

    const now = Date.now();
    let existingVote = proposal.votes.get(voter);
    let initialConviction = 0;

    if (existingVote) {
      // Changing vote - apply decay
      if (existingVote.support !== support) {
        const timeHeld = now - existingVote.votedAt;
        const currentConv = this.calculator.calculateConviction(existingVote.baseVotingPower, timeHeld);
        initialConviction = this.calculator.calculateDecayedConviction(currentConv);

        // Record in history
        existingVote.voteHistory.push({
          support: existingVote.support,
          timestamp: now,
          block: this.currentBlock,
          convictionAtChange: currentConv,
        });

        // Remove from previous tally
        this.removeFromTally(proposal, existingVote);

        console.log(`[Conviction] Vote changed: ${voter} (${existingVote.support} -> ${support}), conviction decayed to ${initialConviction.toFixed(2)}`);
      } else {
        // Same vote - no change needed
        return existingVote;
      }
    }

    // Calculate max possible conviction
    const maxConviction = this.calculator.calculateConviction(
      votingPower,
      365 * 24 * 60 * 60 * 1000  // 1 year max
    );

    const vote: ConvictionVote = {
      voter,
      proposalId,
      support,
      baseVotingPower: votingPower,
      currentConviction: initialConviction,
      maxConviction,
      votedAt: now,
      votedAtBlock: this.currentBlock,
      lastUpdated: now,
      voteHistory: existingVote?.voteHistory || [],
    };

    proposal.votes.set(voter, vote);

    if (!existingVote) {
      proposal.voterCount++;
    }

    // Add to tally (initial conviction)
    this.addToTally(proposal, vote);

    console.log(`[Conviction] Vote cast: ${voter} voted ${support} on ${proposalId} (conviction: ${initialConviction.toFixed(2)})`);
    return vote;
  }

  /**
   * Update all conviction values for a proposal (should be called periodically)
   */
  updateConvictions(proposalId: string): {
    forConviction: number;
    againstConviction: number;
    updatedVoters: number;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const now = Date.now();
    let forTotal = 0;
    let againstTotal = 0;
    let updated = 0;

    for (const vote of proposal.votes.values()) {
      const timeHeld = now - vote.votedAt;
      const newConviction = this.calculator.calculateConviction(vote.baseVotingPower, timeHeld);

      vote.currentConviction = newConviction;
      vote.lastUpdated = now;
      updated++;

      if (vote.support === 'for') {
        forTotal += newConviction;
      } else if (vote.support === 'against') {
        againstTotal += newConviction;
      }
    }

    proposal.currentForConviction = forTotal;
    proposal.currentAgainstConviction = againstTotal;

    // Check if proposal has passed
    if (proposal.status === 'active') {
      const netConviction = forTotal - againstTotal;
      if (netConviction >= proposal.requiredConviction) {
        proposal.status = 'passed';
        proposal.passedAt = now;
        proposal.endTime = now;
        proposal.endBlock = this.currentBlock;
        console.log(`[Conviction] Proposal ${proposalId} PASSED with conviction ${netConviction.toFixed(2)}`);
      }
    }

    return {
      forConviction: forTotal,
      againstConviction: againstTotal,
      updatedVoters: updated,
    };
  }

  private addToTally(proposal: ConvictionProposal, vote: ConvictionVote): void {
    if (vote.support === 'for') {
      proposal.currentForConviction += vote.currentConviction;
    } else if (vote.support === 'against') {
      proposal.currentAgainstConviction += vote.currentConviction;
    }
  }

  private removeFromTally(proposal: ConvictionProposal, vote: ConvictionVote): void {
    if (vote.support === 'for') {
      proposal.currentForConviction = Math.max(0, proposal.currentForConviction - vote.currentConviction);
    } else if (vote.support === 'against') {
      proposal.currentAgainstConviction = Math.max(0, proposal.currentAgainstConviction - vote.currentConviction);
    }
  }

  // ==========================================================================
  // Delegation with Conviction Preservation
  // ==========================================================================

  /**
   * Delegate voting power while preserving conviction
   */
  delegate(
    delegator: string,
    delegatee: string,
    amount: bigint,
    currentConviction: number
  ): ConvictionDelegation {
    if (delegator === delegatee) {
      throw new Error('Cannot delegate to self');
    }

    const delegation: ConvictionDelegation = {
      delegator,
      delegatee,
      amount,
      delegatedAt: Date.now(),
      convictionAtDelegation: currentConviction,
    };

    this.delegations.set(delegator, delegation);
    console.log(`[Conviction] Delegated with preserved conviction: ${delegator} -> ${delegatee}`);
    return delegation;
  }

  /**
   * Remove delegation
   */
  undelegate(delegator: string): boolean {
    const delegation = this.delegations.get(delegator);
    if (!delegation) return false;

    this.delegations.delete(delegator);
    console.log(`[Conviction] Undelegated: ${delegator}`);
    return true;
  }

  /**
   * Get total delegated power with conviction for a delegatee
   */
  getDelegatedConviction(delegatee: string): {
    totalAmount: bigint;
    totalConviction: number;
    delegators: string[];
  } {
    let totalAmount = BigInt(0);
    let totalConviction = 0;
    const delegators: string[] = [];

    for (const [delegator, delegation] of this.delegations) {
      if (delegation.delegatee === delegatee) {
        totalAmount += delegation.amount;

        // Calculate conviction growth since delegation
        const timeHeld = Date.now() - delegation.delegatedAt;
        const grownConviction = this.calculator.calculateConviction(delegation.amount, timeHeld);

        // Start from preserved conviction and grow
        totalConviction += delegation.convictionAtDelegation + grownConviction;
        delegators.push(delegator);
      }
    }

    return { totalAmount, totalConviction, delegators };
  }

  // ==========================================================================
  // Snapshots
  // ==========================================================================

  /**
   * Take a snapshot of current convictions
   */
  takeSnapshot(proposalId: string): ConvictionSnapshot {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Update all convictions first
    this.updateConvictions(proposalId);

    const voterConvictions = new Map<string, number>();
    for (const [voter, vote] of proposal.votes) {
      voterConvictions.set(voter, vote.currentConviction);
    }

    const snapshot: ConvictionSnapshot = {
      proposalId,
      snapshotTime: Date.now(),
      snapshotBlock: this.currentBlock,
      totalForConviction: proposal.currentForConviction,
      totalAgainstConviction: proposal.currentAgainstConviction,
      voterConvictions,
    };

    this.snapshots.set(`${proposalId}-${this.currentBlock}`, snapshot);
    return snapshot;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  getProposal(id: string): ConvictionProposal | null {
    return this.proposals.get(id) || null;
  }

  getVote(proposalId: string, voter: string): ConvictionVote | null {
    const proposal = this.proposals.get(proposalId);
    return proposal?.votes.get(voter) || null;
  }

  getVoterConviction(proposalId: string, voter: string): {
    currentConviction: number;
    maxConviction: number;
    percentOfMax: number;
    timeToMax: number;
  } | null {
    const vote = this.getVote(proposalId, voter);
    if (!vote) return null;

    const timeHeld = Date.now() - vote.votedAt;
    const current = this.calculator.calculateConviction(vote.baseVotingPower, timeHeld);
    const max = vote.maxConviction;

    return {
      currentConviction: current,
      maxConviction: max,
      percentOfMax: max > 0 ? (current / max) * 100 : 0,
      timeToMax: this.calculator.getTimeToConviction(0.99),  // Time to 99% conviction
    };
  }

  getProposalStatus(proposalId: string): {
    forConviction: number;
    againstConviction: number;
    netConviction: number;
    requiredConviction: number;
    progressPercent: number;
    status: string;
    voterCount: number;
  } | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;

    // Update convictions
    this.updateConvictions(proposalId);

    const net = proposal.currentForConviction - proposal.currentAgainstConviction;
    const progress = proposal.requiredConviction > 0
      ? (net / proposal.requiredConviction) * 100
      : 0;

    return {
      forConviction: proposal.currentForConviction,
      againstConviction: proposal.currentAgainstConviction,
      netConviction: net,
      requiredConviction: proposal.requiredConviction,
      progressPercent: Math.max(0, Math.min(100, progress)),
      status: proposal.status,
      voterCount: proposal.voterCount,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeProposals: number;
    passedProposals: number;
    totalVotes: number;
    avgConvictionMultiplier: number;
    highestConviction: number;
    config: ConvictionConfig;
  } {
    let active = 0;
    let passed = 0;
    let totalVotes = 0;
    let convictionSum = 0;
    let highestConviction = 0;

    for (const proposal of this.proposals.values()) {
      if (proposal.status === 'active') active++;
      if (proposal.status === 'passed' || proposal.status === 'executed') passed++;
      totalVotes += proposal.voterCount;

      for (const vote of proposal.votes.values()) {
        convictionSum += vote.currentConviction;
        highestConviction = Math.max(highestConviction, vote.currentConviction);
      }
    }

    return {
      activeProposals: active,
      passedProposals: passed,
      totalVotes,
      avgConvictionMultiplier: totalVotes > 0 ? convictionSum / totalVotes : 0,
      highestConviction,
      config: this.config,
    };
  }

  /**
   * Get conviction curve for visualization
   */
  getConvictionCurve(): { time: number; conviction: number; multiplier: number }[] {
    return this.calculator.getConvictionCurve();
  }

  /**
   * Advance block (for testing)
   */
  advanceBlock(blocks: number = 1): void {
    this.currentBlock += blocks;
  }

  /**
   * Simulate time passage (for testing)
   */
  simulateTimePassing(proposalId: string, daysToPass: number): {
    beforeFor: number;
    beforeAgainst: number;
    afterFor: number;
    afterAgainst: number;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const beforeFor = proposal.currentForConviction;
    const beforeAgainst = proposal.currentAgainstConviction;

    // Artificially age all votes
    const msToAdd = daysToPass * 24 * 60 * 60 * 1000;
    for (const vote of proposal.votes.values()) {
      vote.votedAt -= msToAdd;
    }

    // Recalculate
    this.updateConvictions(proposalId);

    return {
      beforeFor,
      beforeAgainst,
      afterFor: proposal.currentForConviction,
      afterAgainst: proposal.currentAgainstConviction,
    };
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let globalConvictionManager: ConvictionVotingManager | null = null;

export function getConvictionManager(config?: Partial<ConvictionConfig>): ConvictionVotingManager {
  if (!globalConvictionManager) {
    globalConvictionManager = new ConvictionVotingManager(config);
  }
  return globalConvictionManager;
}

// ============================================================================
// Exports
// ============================================================================

export const convictionVoting = {
  ConvictionCalculator,
  ConvictionVotingManager,
  getConvictionManager,
  DEFAULT_CONVICTION_CONFIG,
};
