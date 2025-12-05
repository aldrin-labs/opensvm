#!/usr/bin/env bun
/**
 * Social & Reputation Systems
 *
 * Features:
 * 1. Debate Replay Theater - Re-run historical debates with current agents
 * 2. Agent Fan Clubs - Stake on favorite agents for passive rewards
 * 3. Governance Influencer Score - Track prediction adoption rates
 * 4. Cross-DAO Reputation Passport - Portable credentials
 * 5. Debate Highlight Reels - Auto-generate argument summaries
 */

import { EventEmitter } from 'events';

// ============================================================================
// Common Types
// ============================================================================

export interface AgentIdentity {
  id: string;
  name: string;
  version: string;
  createdAt: number;
}

export interface DebateRecord {
  id: string;
  proposalId: string;
  timestamp: number;
  agents: string[];
  positions: Map<string, 'support' | 'oppose' | 'neutral'>;
  arguments: DebateArgument[];
  outcome: 'support' | 'oppose' | 'no_quorum';
  actualResult?: boolean;
}

export interface DebateArgument {
  agentId: string;
  position: 'support' | 'oppose';
  content: string;
  confidence: number;
  timestamp: number;
  rebuttals: string[];
  upvotes: number;
  cited: boolean; // Was this argument cited in final decision?
}

// ============================================================================
// 1. Debate Replay Theater
// ============================================================================

export interface ReplayConfig {
  useCurrentAgents: boolean;
  speedMultiplier: number;
  includeAudience: boolean;
  recordNewOutcome: boolean;
}

export interface ReplayResult {
  originalDebateId: string;
  replayId: string;
  originalOutcome: string;
  replayOutcome: string;
  outcomeChanged: boolean;
  agentEvolution: Array<{
    agentId: string;
    originalPosition: string;
    replayPosition: string;
    confidenceChange: number;
  }>;
  insights: string[];
}

export class DebateReplayTheater extends EventEmitter {
  private debateArchive: Map<string, DebateRecord> = new Map();
  private replays: Map<string, ReplayResult> = new Map();

  constructor() {
    super();
  }

  /**
   * Archive a debate for future replay
   */
  archiveDebate(debate: DebateRecord): void {
    this.debateArchive.set(debate.id, debate);
    this.emit('debate_archived', { debateId: debate.id });
  }

  /**
   * Get archived debates
   */
  getArchivedDebates(limit = 100): DebateRecord[] {
    return Array.from(this.debateArchive.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Replay a historical debate with current agent configurations
   */
  async replayDebate(
    debateId: string,
    currentAgentPositions: Map<string, { position: 'support' | 'oppose'; confidence: number }>,
    config: Partial<ReplayConfig> = {}
  ): Promise<ReplayResult> {
    const original = this.debateArchive.get(debateId);
    if (!original) {
      throw new Error('Debate not found in archive');
    }

    const replayId = `replay_${debateId}_${Date.now()}`;
    const agentEvolution: ReplayResult['agentEvolution'] = [];

    // Compare original vs current positions
    for (const [agentId, currentPos] of currentAgentPositions) {
      const originalPos = original.positions.get(agentId);
      if (originalPos) {
        const originalArg = original.arguments.find(a => a.agentId === agentId);
        agentEvolution.push({
          agentId,
          originalPosition: originalPos,
          replayPosition: currentPos.position,
          confidenceChange: currentPos.confidence - (originalArg?.confidence || 0.5),
        });
      }
    }

    // Calculate replay outcome
    let supportVotes = 0;
    let opposeVotes = 0;
    for (const [, pos] of currentAgentPositions) {
      if (pos.position === 'support') supportVotes += pos.confidence;
      else if (pos.position === 'oppose') opposeVotes += pos.confidence;
    }
    const replayOutcome = supportVotes > opposeVotes ? 'support' : 'oppose';

    // Generate insights
    const insights: string[] = [];
    const positionChanges = agentEvolution.filter(e => e.originalPosition !== e.replayPosition);
    if (positionChanges.length > 0) {
      insights.push(`${positionChanges.length} agents changed their position since original debate`);
    }

    const avgConfidenceChange = agentEvolution.reduce((sum, e) => sum + e.confidenceChange, 0) / agentEvolution.length;
    if (Math.abs(avgConfidenceChange) > 0.1) {
      insights.push(`Average confidence ${avgConfidenceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(avgConfidenceChange * 100).toFixed(1)}%`);
    }

    if (replayOutcome !== original.outcome) {
      insights.push(`OUTCOME FLIP: Original was ${original.outcome}, replay shows ${replayOutcome}`);
    }

    const result: ReplayResult = {
      originalDebateId: debateId,
      replayId,
      originalOutcome: original.outcome,
      replayOutcome,
      outcomeChanged: replayOutcome !== original.outcome,
      agentEvolution,
      insights,
    };

    this.replays.set(replayId, result);
    this.emit('replay_completed', result);
    return result;
  }

  /**
   * Get replay history for a debate
   */
  getReplayHistory(debateId: string): ReplayResult[] {
    return Array.from(this.replays.values())
      .filter(r => r.originalDebateId === debateId);
  }

  /**
   * Find debates where outcome would change with current agents
   */
  findControversialReplays(): ReplayResult[] {
    return Array.from(this.replays.values())
      .filter(r => r.outcomeChanged);
  }
}

// ============================================================================
// 2. Agent Fan Clubs
// ============================================================================

export interface FanClub {
  agentId: string;
  totalStaked: number;
  memberCount: number;
  rewardsPool: number;
  rewardRate: number; // % of agent earnings distributed
  members: Map<string, FanMembership>;
  createdAt: number;
}

export interface FanMembership {
  address: string;
  stakedAmount: number;
  joinedAt: number;
  earnedRewards: number;
  claimedRewards: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export class AgentFanClubs extends EventEmitter {
  private clubs: Map<string, FanClub> = new Map();
  private tierThresholds = {
    bronze: 0,
    silver: 1000,
    gold: 10000,
    platinum: 100000,
  };

  constructor() {
    super();
  }

  /**
   * Create a fan club for an agent
   */
  createClub(agentId: string, rewardRate = 0.1): FanClub {
    if (this.clubs.has(agentId)) {
      throw new Error('Club already exists');
    }

    const club: FanClub = {
      agentId,
      totalStaked: 0,
      memberCount: 0,
      rewardsPool: 0,
      rewardRate,
      members: new Map(),
      createdAt: Date.now(),
    };

    this.clubs.set(agentId, club);
    this.emit('club_created', { agentId });
    return club;
  }

  /**
   * Join a fan club by staking
   */
  joinClub(agentId: string, address: string, stakeAmount: number): FanMembership {
    let club = this.clubs.get(agentId);
    if (!club) {
      club = this.createClub(agentId);
    }

    let member = club.members.get(address);
    if (member) {
      // Existing member - add to stake
      member.stakedAmount += stakeAmount;
    } else {
      // New member
      member = {
        address,
        stakedAmount: stakeAmount,
        joinedAt: Date.now(),
        earnedRewards: 0,
        claimedRewards: 0,
        tier: 'bronze',
      };
      club.memberCount++;
    }

    // Update tier
    member.tier = this.calculateTier(member.stakedAmount);
    club.totalStaked += stakeAmount;
    club.members.set(address, member);

    this.emit('member_joined', { agentId, address, stakeAmount, tier: member.tier });
    return member;
  }

  /**
   * Leave a fan club
   */
  leaveClub(agentId: string, address: string): { unstaked: number; rewards: number } {
    const club = this.clubs.get(agentId);
    if (!club) throw new Error('Club not found');

    const member = club.members.get(address);
    if (!member) throw new Error('Not a member');

    const unstaked = member.stakedAmount;
    const rewards = member.earnedRewards - member.claimedRewards;

    club.totalStaked -= unstaked;
    club.memberCount--;
    club.members.delete(address);

    this.emit('member_left', { agentId, address, unstaked, rewards });
    return { unstaked, rewards };
  }

  /**
   * Distribute rewards to fan club members
   */
  distributeRewards(agentId: string, amount: number): number {
    const club = this.clubs.get(agentId);
    if (!club || club.totalStaked === 0) return 0;

    const distributableAmount = amount * club.rewardRate;
    club.rewardsPool += distributableAmount;

    let totalDistributed = 0;
    for (const [, member] of club.members) {
      const share = (member.stakedAmount / club.totalStaked) * distributableAmount;
      // Tier bonus
      const tierBonus = { bronze: 1, silver: 1.1, gold: 1.25, platinum: 1.5 }[member.tier];
      const finalShare = share * tierBonus;
      member.earnedRewards += finalShare;
      totalDistributed += finalShare;
    }

    this.emit('rewards_distributed', { agentId, amount: totalDistributed });
    return totalDistributed;
  }

  /**
   * Claim rewards
   */
  claimRewards(agentId: string, address: string): number {
    const club = this.clubs.get(agentId);
    if (!club) return 0;

    const member = club.members.get(address);
    if (!member) return 0;

    const claimable = member.earnedRewards - member.claimedRewards;
    member.claimedRewards = member.earnedRewards;

    this.emit('rewards_claimed', { agentId, address, amount: claimable });
    return claimable;
  }

  private calculateTier(amount: number): FanMembership['tier'] {
    if (amount >= this.tierThresholds.platinum) return 'platinum';
    if (amount >= this.tierThresholds.gold) return 'gold';
    if (amount >= this.tierThresholds.silver) return 'silver';
    return 'bronze';
  }

  /**
   * Get club info
   */
  getClub(agentId: string): FanClub | undefined {
    return this.clubs.get(agentId);
  }

  /**
   * Get member info
   */
  getMember(agentId: string, address: string): FanMembership | undefined {
    return this.clubs.get(agentId)?.members.get(address);
  }

  /**
   * Get leaderboard of clubs by total staked
   */
  getClubLeaderboard(): Array<{ agentId: string; totalStaked: number; memberCount: number }> {
    return Array.from(this.clubs.values())
      .map(c => ({ agentId: c.agentId, totalStaked: c.totalStaked, memberCount: c.memberCount }))
      .sort((a, b) => b.totalStaked - a.totalStaked);
  }
}

// ============================================================================
// 3. Governance Influencer Score
// ============================================================================

export interface InfluencerMetrics {
  agentId: string;
  totalPredictions: number;
  adoptedPredictions: number;
  adoptionRate: number;
  citationCount: number;
  followCount: number;
  influenceScore: number;
  scoreHistory: Array<{ timestamp: number; score: number }>;
}

export interface PredictionRecord {
  id: string;
  agentId: string;
  proposalId: string;
  prediction: 'support' | 'oppose';
  confidence: number;
  timestamp: number;
  actualOutcome?: 'support' | 'oppose';
  wasAdopted: boolean; // Did governance follow this prediction?
  citedBy: string[]; // Other agents who referenced this
}

export class GovernanceInfluencerScore extends EventEmitter {
  private metrics: Map<string, InfluencerMetrics> = new Map();
  private predictions: Map<string, PredictionRecord> = new Map();
  private follows: Map<string, Set<string>> = new Map(); // follower -> Set<agentId>

  constructor() {
    super();
  }

  /**
   * Record a prediction
   */
  recordPrediction(
    agentId: string,
    proposalId: string,
    prediction: 'support' | 'oppose',
    confidence: number
  ): PredictionRecord {
    const record: PredictionRecord = {
      id: `pred_${agentId}_${proposalId}`,
      agentId,
      proposalId,
      prediction,
      confidence,
      timestamp: Date.now(),
      wasAdopted: false,
      citedBy: [],
    };

    this.predictions.set(record.id, record);
    this.ensureMetrics(agentId);

    const metrics = this.metrics.get(agentId)!;
    metrics.totalPredictions++;

    this.emit('prediction_recorded', record);
    return record;
  }

  /**
   * Record outcome and update adoption status
   */
  recordOutcome(proposalId: string, outcome: 'support' | 'oppose'): void {
    for (const [, pred] of this.predictions) {
      if (pred.proposalId === proposalId) {
        pred.actualOutcome = outcome;
        pred.wasAdopted = pred.prediction === outcome;

        const metrics = this.metrics.get(pred.agentId);
        if (metrics && pred.wasAdopted) {
          metrics.adoptedPredictions++;
          metrics.adoptionRate = metrics.adoptedPredictions / metrics.totalPredictions;
          this.updateInfluenceScore(pred.agentId);
        }
      }
    }

    this.emit('outcome_recorded', { proposalId, outcome });
  }

  /**
   * Record a citation (one agent referencing another's argument)
   */
  recordCitation(predictionId: string, citingAgentId: string): void {
    const pred = this.predictions.get(predictionId);
    if (!pred) return;

    if (!pred.citedBy.includes(citingAgentId)) {
      pred.citedBy.push(citingAgentId);

      const metrics = this.metrics.get(pred.agentId);
      if (metrics) {
        metrics.citationCount++;
        this.updateInfluenceScore(pred.agentId);
      }
    }

    this.emit('citation_recorded', { predictionId, citingAgentId });
  }

  /**
   * Follow an agent
   */
  follow(followerAddress: string, agentId: string): void {
    if (!this.follows.has(followerAddress)) {
      this.follows.set(followerAddress, new Set());
    }
    this.follows.get(followerAddress)!.add(agentId);

    const metrics = this.metrics.get(agentId);
    if (metrics) {
      metrics.followCount++;
      this.updateInfluenceScore(agentId);
    }

    this.emit('follow', { followerAddress, agentId });
  }

  /**
   * Unfollow an agent
   */
  unfollow(followerAddress: string, agentId: string): void {
    this.follows.get(followerAddress)?.delete(agentId);

    const metrics = this.metrics.get(agentId);
    if (metrics && metrics.followCount > 0) {
      metrics.followCount--;
      this.updateInfluenceScore(agentId);
    }
  }

  private ensureMetrics(agentId: string): void {
    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, {
        agentId,
        totalPredictions: 0,
        adoptedPredictions: 0,
        adoptionRate: 0,
        citationCount: 0,
        followCount: 0,
        influenceScore: 0,
        scoreHistory: [],
      });
    }
  }

  private updateInfluenceScore(agentId: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    // Influence = (adoptionRate * 40) + (citations * 0.5) + (follows * 0.1)
    // Capped at 100
    const score = Math.min(100,
      (metrics.adoptionRate * 40) +
      (metrics.citationCount * 0.5) +
      (metrics.followCount * 0.1)
    );

    metrics.influenceScore = Math.round(score * 100) / 100;
    metrics.scoreHistory.push({ timestamp: Date.now(), score: metrics.influenceScore });

    this.emit('score_updated', { agentId, score: metrics.influenceScore });
  }

  /**
   * Get agent metrics
   */
  getMetrics(agentId: string): InfluencerMetrics | undefined {
    return this.metrics.get(agentId);
  }

  /**
   * Get influencer leaderboard
   */
  getLeaderboard(limit = 50): InfluencerMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.influenceScore - a.influenceScore)
      .slice(0, limit);
  }

  /**
   * Get predictions by agent
   */
  getPredictionsByAgent(agentId: string): PredictionRecord[] {
    return Array.from(this.predictions.values())
      .filter(p => p.agentId === agentId);
  }
}

// ============================================================================
// 4. Cross-DAO Reputation Passport
// ============================================================================

export interface ReputationPassport {
  id: string;
  agentId: string;
  createdAt: number;
  lastUpdated: number;
  credentials: DAOCredential[];
  aggregateScore: number;
  verificationProof?: string; // ZK proof of credentials
}

export interface DAOCredential {
  daoId: string;
  daoName: string;
  joinedAt: number;
  role: 'voter' | 'delegate' | 'council' | 'contributor';
  participationRate: number;
  predictionAccuracy: number;
  proposalsCreated: number;
  proposalsPassed: number;
  votingPower: number;
  reputationScore: number;
  verified: boolean;
}

export class CrossDAOReputationPassport extends EventEmitter {
  private passports: Map<string, ReputationPassport> = new Map();
  private knownDAOs: Map<string, { name: string; weight: number }> = new Map();

  constructor() {
    super();
    // Initialize known DAOs with reputation weights
    this.knownDAOs.set('uniswap', { name: 'Uniswap', weight: 1.5 });
    this.knownDAOs.set('aave', { name: 'Aave', weight: 1.4 });
    this.knownDAOs.set('compound', { name: 'Compound', weight: 1.3 });
    this.knownDAOs.set('makerdao', { name: 'MakerDAO', weight: 1.5 });
    this.knownDAOs.set('curve', { name: 'Curve', weight: 1.2 });
    this.knownDAOs.set('opensvm', { name: 'OpenSVM', weight: 1.0 });
  }

  /**
   * Create a new reputation passport
   */
  createPassport(agentId: string): ReputationPassport {
    if (this.passports.has(agentId)) {
      throw new Error('Passport already exists');
    }

    const passport: ReputationPassport = {
      id: `passport_${agentId}`,
      agentId,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      credentials: [],
      aggregateScore: 0,
    };

    this.passports.set(agentId, passport);
    this.emit('passport_created', { agentId });
    return passport;
  }

  /**
   * Add a DAO credential to passport
   */
  addCredential(agentId: string, credential: Omit<DAOCredential, 'verified'>): DAOCredential {
    let passport = this.passports.get(agentId);
    if (!passport) {
      passport = this.createPassport(agentId);
    }

    // Check if credential for this DAO already exists
    const existing = passport.credentials.find(c => c.daoId === credential.daoId);
    if (existing) {
      // Update existing
      Object.assign(existing, credential);
      existing.verified = false; // Needs re-verification
      this.emit('credential_updated', { agentId, daoId: credential.daoId });
      this.updateAggregateScore(agentId);
      return existing;
    }

    const fullCredential: DAOCredential = {
      ...credential,
      verified: false,
    };

    passport.credentials.push(fullCredential);
    passport.lastUpdated = Date.now();
    this.updateAggregateScore(agentId);

    this.emit('credential_added', { agentId, daoId: credential.daoId });
    return fullCredential;
  }

  /**
   * Verify a credential (would connect to DAO's governance contract in production)
   */
  verifyCredential(agentId: string, daoId: string, proof?: string): boolean {
    const passport = this.passports.get(agentId);
    if (!passport) return false;

    const credential = passport.credentials.find(c => c.daoId === daoId);
    if (!credential) return false;

    // In production, would verify against on-chain data
    credential.verified = true;
    passport.verificationProof = proof;
    passport.lastUpdated = Date.now();

    this.emit('credential_verified', { agentId, daoId });
    return true;
  }

  private updateAggregateScore(agentId: string): void {
    const passport = this.passports.get(agentId);
    if (!passport) return;

    let totalScore = 0;
    let totalWeight = 0;

    for (const cred of passport.credentials) {
      const daoInfo = this.knownDAOs.get(cred.daoId);
      const weight = daoInfo?.weight || 1.0;
      const verificationBonus = cred.verified ? 1.2 : 1.0;

      const credScore = (
        cred.participationRate * 20 +
        cred.predictionAccuracy * 40 +
        cred.proposalsPassed * 5 +
        Math.log10(cred.votingPower + 1) * 10
      ) * verificationBonus;

      totalScore += credScore * weight;
      totalWeight += weight;
    }

    passport.aggregateScore = totalWeight > 0
      ? Math.round((totalScore / totalWeight) * 100) / 100
      : 0;

    this.emit('score_updated', { agentId, score: passport.aggregateScore });
  }

  /**
   * Get passport
   */
  getPassport(agentId: string): ReputationPassport | undefined {
    return this.passports.get(agentId);
  }

  /**
   * Get all credentials for an agent
   */
  getCredentials(agentId: string): DAOCredential[] {
    return this.passports.get(agentId)?.credentials || [];
  }

  /**
   * Get agents with credentials in a specific DAO
   */
  getAgentsByDAO(daoId: string): Array<{ agentId: string; credential: DAOCredential }> {
    const results: Array<{ agentId: string; credential: DAOCredential }> = [];

    for (const [agentId, passport] of this.passports) {
      const cred = passport.credentials.find(c => c.daoId === daoId);
      if (cred) {
        results.push({ agentId, credential: cred });
      }
    }

    return results.sort((a, b) => b.credential.reputationScore - a.credential.reputationScore);
  }

  /**
   * Get passport leaderboard
   */
  getLeaderboard(): Array<{ agentId: string; score: number; daoCount: number }> {
    return Array.from(this.passports.values())
      .map(p => ({
        agentId: p.agentId,
        score: p.aggregateScore,
        daoCount: p.credentials.length,
      }))
      .sort((a, b) => b.score - a.score);
  }
}

// ============================================================================
// 5. Debate Highlight Reels
// ============================================================================

export interface Highlight {
  id: string;
  debateId: string;
  type: 'best_argument' | 'key_insight' | 'turning_point' | 'prediction_hit' | 'controversy';
  agentId: string;
  content: string;
  context: string;
  impact: number; // 0-100
  timestamp: number;
  views: number;
  saves: number;
}

export interface HighlightReel {
  id: string;
  title: string;
  description: string;
  highlights: Highlight[];
  createdAt: number;
  curator: string;
  views: number;
  likes: number;
}

export class DebateHighlightReels extends EventEmitter {
  private highlights: Map<string, Highlight> = new Map();
  private reels: Map<string, HighlightReel> = new Map();

  constructor() {
    super();
  }

  /**
   * Extract highlights from a debate
   */
  extractHighlights(debate: DebateRecord): Highlight[] {
    const extracted: Highlight[] = [];

    // Find best argument (highest upvotes)
    const bestArg = [...debate.arguments].sort((a, b) => b.upvotes - a.upvotes)[0];
    if (bestArg) {
      const highlight: Highlight = {
        id: `hl_best_${debate.id}_${bestArg.agentId}`,
        debateId: debate.id,
        type: 'best_argument',
        agentId: bestArg.agentId,
        content: bestArg.content,
        context: `Top-rated argument with ${bestArg.upvotes} upvotes`,
        impact: Math.min(100, bestArg.upvotes * 2),
        timestamp: bestArg.timestamp,
        views: 0,
        saves: 0,
      };
      extracted.push(highlight);
      this.highlights.set(highlight.id, highlight);
    }

    // Find turning point (argument that shifted consensus)
    const highConfidenceArgs = debate.arguments.filter(a => a.confidence > 0.8);
    for (const arg of highConfidenceArgs) {
      if (arg.rebuttals.length > 2) {
        const highlight: Highlight = {
          id: `hl_turning_${debate.id}_${arg.agentId}`,
          debateId: debate.id,
          type: 'turning_point',
          agentId: arg.agentId,
          content: arg.content,
          context: `High-confidence argument that sparked ${arg.rebuttals.length} rebuttals`,
          impact: Math.min(100, arg.rebuttals.length * 15),
          timestamp: arg.timestamp,
          views: 0,
          saves: 0,
        };
        extracted.push(highlight);
        this.highlights.set(highlight.id, highlight);
      }
    }

    // Find cited arguments (key insights)
    const citedArgs = debate.arguments.filter(a => a.cited);
    for (const arg of citedArgs) {
      const highlight: Highlight = {
        id: `hl_insight_${debate.id}_${arg.agentId}`,
        debateId: debate.id,
        type: 'key_insight',
        agentId: arg.agentId,
        content: arg.content,
        context: 'This argument was cited in the final decision',
        impact: 80,
        timestamp: arg.timestamp,
        views: 0,
        saves: 0,
      };
      extracted.push(highlight);
      this.highlights.set(highlight.id, highlight);
    }

    // Find prediction hits (if outcome is known)
    if (debate.actualResult !== undefined) {
      const correctPredictions = debate.arguments.filter(a =>
        (a.position === 'support' && debate.actualResult) ||
        (a.position === 'oppose' && !debate.actualResult)
      );
      const topCorrect = correctPredictions.sort((a, b) => b.confidence - a.confidence)[0];
      if (topCorrect) {
        const highlight: Highlight = {
          id: `hl_prediction_${debate.id}_${topCorrect.agentId}`,
          debateId: debate.id,
          type: 'prediction_hit',
          agentId: topCorrect.agentId,
          content: topCorrect.content,
          context: `Correctly predicted outcome with ${(topCorrect.confidence * 100).toFixed(0)}% confidence`,
          impact: Math.round(topCorrect.confidence * 100),
          timestamp: topCorrect.timestamp,
          views: 0,
          saves: 0,
        };
        extracted.push(highlight);
        this.highlights.set(highlight.id, highlight);
      }
    }

    this.emit('highlights_extracted', { debateId: debate.id, count: extracted.length });
    return extracted;
  }

  /**
   * Create a highlight reel
   */
  createReel(
    title: string,
    description: string,
    highlightIds: string[],
    curator: string
  ): HighlightReel {
    const highlights = highlightIds
      .map(id => this.highlights.get(id))
      .filter((h): h is Highlight => h !== undefined);

    const reel: HighlightReel = {
      id: `reel_${Date.now()}`,
      title,
      description,
      highlights,
      createdAt: Date.now(),
      curator,
      views: 0,
      likes: 0,
    };

    this.reels.set(reel.id, reel);
    this.emit('reel_created', { reelId: reel.id, highlightCount: highlights.length });
    return reel;
  }

  /**
   * Auto-generate a "Best of" reel
   */
  generateBestOfReel(timeRange: { start: number; end: number }): HighlightReel {
    const relevantHighlights = Array.from(this.highlights.values())
      .filter(h => h.timestamp >= timeRange.start && h.timestamp <= timeRange.end)
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10);

    return this.createReel(
      `Best Debates: ${new Date(timeRange.start).toLocaleDateString()} - ${new Date(timeRange.end).toLocaleDateString()}`,
      'Auto-generated collection of top debate moments',
      relevantHighlights.map(h => h.id),
      'system'
    );
  }

  /**
   * Record a view
   */
  recordView(highlightId: string): void {
    const highlight = this.highlights.get(highlightId);
    if (highlight) {
      highlight.views++;
    }
  }

  /**
   * Save a highlight
   */
  saveHighlight(highlightId: string): void {
    const highlight = this.highlights.get(highlightId);
    if (highlight) {
      highlight.saves++;
    }
  }

  /**
   * Get trending highlights
   */
  getTrending(limit = 20): Highlight[] {
    return Array.from(this.highlights.values())
      .sort((a, b) => (b.views + b.saves * 2) - (a.views + a.saves * 2))
      .slice(0, limit);
  }

  /**
   * Get highlight by ID
   */
  getHighlight(id: string): Highlight | undefined {
    return this.highlights.get(id);
  }

  /**
   * Get reel by ID
   */
  getReel(id: string): HighlightReel | undefined {
    return this.reels.get(id);
  }

  /**
   * Get all reels
   */
  getAllReels(): HighlightReel[] {
    return Array.from(this.reels.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get highlights by agent
   */
  getHighlightsByAgent(agentId: string): Highlight[] {
    return Array.from(this.highlights.values())
      .filter(h => h.agentId === agentId);
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  DebateReplayTheater,
  AgentFanClubs,
  GovernanceInfluencerScore,
  CrossDAOReputationPassport,
  DebateHighlightReels,
};
