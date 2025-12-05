#!/usr/bin/env bun
/**
 * Human-Agent Debate System
 *
 * Enables humans to participate in governance debates alongside AI agents:
 * - Human participants join as debate panelists
 * - Real-time turn-based debate flow
 * - Human arguments are weighted and considered
 * - Hybrid consensus between humans and AI
 */

import { EventEmitter } from 'events';
import {
  MultiAgentDebateEngine,
  DebateAgent,
  AgentAnalysis,
  DebateRound,
  DebateResult,
} from './multi-agent-debate.js';
import { ProposalContext, LLMAnalysisResult } from './llm-proposal-analyzer.js';

// ============================================================================
// Types
// ============================================================================

export interface HumanParticipant {
  id: string;
  name: string;
  walletAddress?: string;
  role: 'voter' | 'delegate' | 'expert' | 'public';
  weight: number;
  credentials?: string[];
  joinedAt: number;
}

export interface HumanArgument {
  participantId: string;
  timestamp: number;
  content: string;
  recommendation: 'support' | 'oppose' | 'abstain';
  confidence: number;
  evidence?: string[];
  rebuttalTo?: string; // ID of argument being rebutted
}

export interface DebateSession {
  id: string;
  proposal: ProposalContext;
  status: 'pending' | 'open' | 'debating' | 'voting' | 'closed';
  humanParticipants: Map<string, HumanParticipant>;
  aiAgents: DebateAgent[];
  humanArguments: HumanArgument[];
  aiAnalyses: AgentAnalysis[];
  currentRound: number;
  maxRounds: number;
  turnOrder: string[]; // IDs of who speaks next
  currentTurn: number;
  createdAt: number;
  openedAt?: number;
  closedAt?: number;
  result?: HybridDebateResult;
}

export interface HybridDebateResult extends DebateResult {
  humanVotes: {
    support: number;
    oppose: number;
    abstain: number;
  };
  aiVotes: {
    support: number;
    oppose: number;
    abstain: number;
  };
  humanWeight: number;
  aiWeight: number;
  humanParticipation: number; // % of humans who voted
  keyHumanArguments: string[];
}

export interface SessionConfig {
  maxRounds: number;
  minHumanParticipants: number;
  maxHumanParticipants: number;
  humanWeight: number; // Total weight for human votes (0-1)
  turnTimeLimit: number; // Seconds per turn
  allowLateJoin: boolean;
  requireCredentials: boolean;
}

// ============================================================================
// Human-Agent Debate Manager
// ============================================================================

export class HumanAgentDebateManager extends EventEmitter {
  private sessions: Map<string, DebateSession> = new Map();
  private aiEngine: MultiAgentDebateEngine;
  private config: SessionConfig;
  private sessionCounter = 0;

  constructor(config: Partial<SessionConfig> = {}) {
    super();
    this.config = {
      maxRounds: config.maxRounds ?? 3,
      minHumanParticipants: config.minHumanParticipants ?? 1,
      maxHumanParticipants: config.maxHumanParticipants ?? 10,
      humanWeight: config.humanWeight ?? 0.4, // 40% human, 60% AI
      turnTimeLimit: config.turnTimeLimit ?? 300, // 5 minutes
      allowLateJoin: config.allowLateJoin ?? true,
      requireCredentials: config.requireCredentials ?? false,
    };

    this.aiEngine = new MultiAgentDebateEngine({
      rounds: this.config.maxRounds,
      enableCrossExamination: true,
      enableRebuttals: true,
    });
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create a new debate session
   */
  createSession(proposal: ProposalContext): string {
    this.sessionCounter++;
    const id = `HSESSION-${this.sessionCounter}`;

    const session: DebateSession = {
      id,
      proposal,
      status: 'pending',
      humanParticipants: new Map(),
      aiAgents: [...this.aiEngine.getAgents()],
      humanArguments: [],
      aiAnalyses: [],
      currentRound: 0,
      maxRounds: this.config.maxRounds,
      turnOrder: [],
      currentTurn: 0,
      createdAt: Date.now(),
    };

    this.sessions.set(id, session);
    this.emit('session_created', { sessionId: id, proposal: proposal.title });

    return id;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): DebateSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(status?: DebateSession['status']): DebateSession[] {
    const sessions = Array.from(this.sessions.values());
    if (status) {
      return sessions.filter(s => s.status === status);
    }
    return sessions;
  }

  // ===========================================================================
  // Human Participation
  // ===========================================================================

  /**
   * Add human participant to session
   */
  joinSession(
    sessionId: string,
    participant: Omit<HumanParticipant, 'joinedAt'>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if session allows joining
    if (!this.config.allowLateJoin && session.status !== 'pending' && session.status !== 'open') {
      return false;
    }

    if (session.humanParticipants.size >= this.config.maxHumanParticipants) {
      return false;
    }

    // Validate credentials if required
    if (this.config.requireCredentials && (!participant.credentials || participant.credentials.length === 0)) {
      return false;
    }

    const fullParticipant: HumanParticipant = {
      ...participant,
      joinedAt: Date.now(),
    };

    session.humanParticipants.set(participant.id, fullParticipant);

    this.emit('participant_joined', {
      sessionId,
      participantId: participant.id,
      name: participant.name,
    });

    return true;
  }

  /**
   * Remove human participant from session
   */
  leaveSession(sessionId: string, participantId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const removed = session.humanParticipants.delete(participantId);

    if (removed) {
      this.emit('participant_left', { sessionId, participantId });
    }

    return removed;
  }

  // ===========================================================================
  // Debate Flow
  // ===========================================================================

  /**
   * Open session for debate (allow joining)
   */
  openSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'pending') return false;

    session.status = 'open';
    session.openedAt = Date.now();

    this.emit('session_opened', { sessionId });
    return true;
  }

  /**
   * Start the debate
   */
  async startDebate(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.status !== 'open') return false;

    if (session.humanParticipants.size < this.config.minHumanParticipants) {
      return false;
    }

    session.status = 'debating';
    session.currentRound = 1;

    // Create turn order (alternating humans and AI)
    session.turnOrder = this.createTurnOrder(session);

    this.emit('debate_started', {
      sessionId,
      humanCount: session.humanParticipants.size,
      aiCount: session.aiAgents.length,
    });

    // Start AI analyses in background
    this.runAIAnalyses(session);

    return true;
  }

  private createTurnOrder(session: DebateSession): string[] {
    const order: string[] = [];
    const humans = Array.from(session.humanParticipants.keys());
    const ais = session.aiAgents.map(a => a.id);

    // Interleave humans and AI
    const maxLen = Math.max(humans.length, ais.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < humans.length) order.push(humans[i]);
      if (i < ais.length) order.push(ais[i]);
    }

    return order;
  }

  /**
   * Submit human argument
   */
  submitArgument(
    sessionId: string,
    participantId: string,
    argument: Omit<HumanArgument, 'participantId' | 'timestamp'>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.status !== 'debating') return false;

    if (!session.humanParticipants.has(participantId)) return false;

    const fullArgument: HumanArgument = {
      ...argument,
      participantId,
      timestamp: Date.now(),
    };

    session.humanArguments.push(fullArgument);

    // Advance turn if it's this participant's turn
    if (session.turnOrder[session.currentTurn] === participantId) {
      session.currentTurn = (session.currentTurn + 1) % session.turnOrder.length;
    }

    this.emit('argument_submitted', {
      sessionId,
      participantId,
      recommendation: argument.recommendation,
    });

    // Check if round complete
    this.checkRoundComplete(session);

    return true;
  }

  private async runAIAnalyses(session: DebateSession): Promise<void> {
    try {
      // Get AI analyses from the debate engine
      const context = session.proposal;

      // Run quick debate to get AI opinions
      const result = await this.aiEngine.quickDebate(context);

      // Extract analyses from first round
      if (result.rounds.length > 0) {
        session.aiAnalyses = result.rounds[0].analyses;
      }

      this.emit('ai_analyses_ready', {
        sessionId: session.id,
        analysisCount: session.aiAnalyses.length,
      });
    } catch (error) {
      this.emit('ai_error', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private checkRoundComplete(session: DebateSession): void {
    const humanCount = session.humanParticipants.size;
    const humanArgumentsThisRound = session.humanArguments.length;

    // Check if all humans have submitted
    if (humanArgumentsThisRound >= humanCount) {
      session.currentRound++;

      if (session.currentRound > session.maxRounds) {
        this.closeVoting(session.id);
      } else {
        session.currentTurn = 0;
        this.emit('round_complete', {
          sessionId: session.id,
          round: session.currentRound - 1,
        });
      }
    }
  }

  // ===========================================================================
  // Voting & Results
  // ===========================================================================

  /**
   * Move to voting phase
   */
  startVoting(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.status !== 'debating') return false;

    session.status = 'voting';
    this.emit('voting_started', { sessionId });

    return true;
  }

  /**
   * Close voting and calculate result
   */
  closeVoting(sessionId: string): HybridDebateResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.status !== 'debating' && session.status !== 'voting') return null;

    session.status = 'closed';
    session.closedAt = Date.now();

    const result = this.calculateHybridResult(session);
    session.result = result;

    this.emit('debate_closed', {
      sessionId,
      recommendation: result.finalRecommendation,
      consensus: result.consensusStrength,
    });

    return result;
  }

  private calculateHybridResult(session: DebateSession): HybridDebateResult {
    // Tally human votes
    const humanVotes = { support: 0, oppose: 0, abstain: 0 };
    const humanWeights = { support: 0, oppose: 0, abstain: 0 };

    for (const arg of session.humanArguments) {
      const participant = session.humanParticipants.get(arg.participantId);
      const weight = participant?.weight ?? 1;

      humanVotes[arg.recommendation]++;
      humanWeights[arg.recommendation] += weight;
    }

    // Tally AI votes
    const aiVotes = { support: 0, oppose: 0, abstain: 0 };
    const aiWeights = { support: 0, oppose: 0, abstain: 0 };

    for (const analysis of session.aiAnalyses) {
      const agent = session.aiAgents.find(a => a.id === analysis.agentId);
      const weight = agent?.weight ?? 0.15;
      const rec = analysis.analysis.recommendation;

      aiVotes[rec]++;
      aiWeights[rec] += weight;
    }

    // Normalize weights
    const totalHumanWeight = humanWeights.support + humanWeights.oppose + humanWeights.abstain;
    const totalAiWeight = aiWeights.support + aiWeights.oppose + aiWeights.abstain;

    // Calculate weighted scores
    const humanScore = {
      support: totalHumanWeight > 0 ? humanWeights.support / totalHumanWeight : 0,
      oppose: totalHumanWeight > 0 ? humanWeights.oppose / totalHumanWeight : 0,
      abstain: totalHumanWeight > 0 ? humanWeights.abstain / totalHumanWeight : 0,
    };

    const aiScore = {
      support: totalAiWeight > 0 ? aiWeights.support / totalAiWeight : 0,
      oppose: totalAiWeight > 0 ? aiWeights.oppose / totalAiWeight : 0,
      abstain: totalAiWeight > 0 ? aiWeights.abstain / totalAiWeight : 0,
    };

    // Combine with configured weights
    const combined = {
      support: humanScore.support * this.config.humanWeight + aiScore.support * (1 - this.config.humanWeight),
      oppose: humanScore.oppose * this.config.humanWeight + aiScore.oppose * (1 - this.config.humanWeight),
      abstain: humanScore.abstain * this.config.humanWeight + aiScore.abstain * (1 - this.config.humanWeight),
    };

    // Determine recommendation
    let recommendation: 'support' | 'oppose' | 'abstain' = 'abstain';
    if (combined.support > combined.oppose && combined.support > combined.abstain) {
      recommendation = 'support';
    } else if (combined.oppose > combined.support && combined.oppose > combined.abstain) {
      recommendation = 'oppose';
    }

    // Calculate consensus
    const maxVote = Math.max(combined.support, combined.oppose, combined.abstain);
    const consensusStrength = maxVote;

    // Extract key human arguments
    const keyHumanArguments = session.humanArguments
      .filter(a => a.recommendation === recommendation)
      .slice(0, 3)
      .map(a => a.content);

    // Build points of agreement/disagreement
    const pointsOfAgreement: string[] = [];
    const pointsOfDisagreement: string[] = [];

    if (humanScore.support > 0.6 && aiScore.support > 0.6) {
      pointsOfAgreement.push('Both humans and AI favor supporting this proposal');
    }
    if (humanScore.oppose > 0.6 && aiScore.oppose > 0.6) {
      pointsOfAgreement.push('Both humans and AI oppose this proposal');
    }

    if (Math.abs(humanScore.support - aiScore.support) > 0.3) {
      pointsOfDisagreement.push('Significant difference between human and AI support levels');
    }

    return {
      proposalTitle: session.proposal.title,
      finalRecommendation: recommendation,
      consensusStrength,
      aggregatedScore: combined.support * 10 - combined.oppose * 10,
      aggregatedConfidence: consensusStrength,
      pointsOfAgreement,
      pointsOfDisagreement,
      unresolvedConcerns: [],
      majorityReasoning: `Hybrid decision: ${(combined.support * 100).toFixed(0)}% support, ${(combined.oppose * 100).toFixed(0)}% oppose`,
      dissent: [],
      rounds: [],
      debateRounds: session.currentRound,
      totalAgents: session.aiAgents.length,
      duration: session.closedAt! - session.createdAt,
      humanVotes,
      aiVotes,
      humanWeight: this.config.humanWeight,
      aiWeight: 1 - this.config.humanWeight,
      humanParticipation: session.humanArguments.length / session.humanParticipants.size,
      keyHumanArguments,
    };
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get current turn info
   */
  getCurrentTurn(sessionId: string): { id: string; isHuman: boolean; name: string } | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'debating') return null;

    const currentId = session.turnOrder[session.currentTurn];
    const isHuman = session.humanParticipants.has(currentId);

    if (isHuman) {
      const participant = session.humanParticipants.get(currentId)!;
      return { id: currentId, isHuman: true, name: participant.name };
    } else {
      const agent = session.aiAgents.find(a => a.id === currentId);
      return { id: currentId, isHuman: false, name: agent?.name ?? currentId };
    }
  }

  /**
   * Get all arguments in session
   */
  getArguments(sessionId: string): { human: HumanArgument[]; ai: AgentAnalysis[] } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      human: session.humanArguments,
      ai: session.aiAnalyses,
    };
  }

  /**
   * Get participant list
   */
  getParticipants(sessionId: string): HumanParticipant[] | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return Array.from(session.humanParticipants.values());
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): object {
    const sessions = Array.from(this.sessions.values());

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'debating' || s.status === 'voting').length,
      completedSessions: sessions.filter(s => s.status === 'closed').length,
      totalHumanParticipants: sessions.reduce((sum, s) => sum + s.humanParticipants.size, 0),
      totalHumanArguments: sessions.reduce((sum, s) => sum + s.humanArguments.length, 0),
      averageParticipation: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.humanParticipants.size, 0) / sessions.length
        : 0,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: HumanAgentDebateManager | null = null;

export function getHumanAgentDebateManager(config?: Partial<SessionConfig>): HumanAgentDebateManager {
  if (!managerInstance) {
    managerInstance = new HumanAgentDebateManager(config);
  }
  return managerInstance;
}

export { HumanAgentDebateManager as default };
