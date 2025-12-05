#!/usr/bin/env bun
/**
 * Multi-Agent Debate System for Governance Analysis
 *
 * Multiple LLM agents with different perspectives analyze proposals,
 * debate each other's conclusions, and synthesize a consensus.
 *
 * This approach surfaces blind spots that single-agent analysis misses
 * by having agents challenge each other's reasoning.
 *
 * Debate Structure:
 * 1. Initial Analysis - Each agent independently analyzes proposal
 * 2. Cross-Examination - Agents critique other agents' conclusions
 * 3. Rebuttal - Agents respond to critiques
 * 4. Synthesis - Mediator combines perspectives into consensus
 */

import { EventEmitter } from 'events';
import {
  LLMProposalAnalyzer,
  ProposalContext,
  LLMAnalysisResult,
  LLMConfig,
} from './llm-proposal-analyzer.js';
import {
  AgentMemoryManager,
  MemoryContext,
  DebateMemory,
} from './agent-memory.js';

// ============================================================================
// Types
// ============================================================================

export type AgentPerspective =
  | 'risk_focused'      // Emphasizes risks and downsides
  | 'growth_focused'    // Emphasizes growth opportunities
  | 'conservative'      // Favors status quo, skeptical of change
  | 'progressive'       // Favors innovation, embraces change
  | 'technical'         // Focuses on implementation details
  | 'community'         // Focuses on user/community impact
  | 'economic'          // Focuses on tokenomics and incentives
  | 'mediator';         // Synthesizes other perspectives

export interface DebateAgent {
  id: string;
  name: string;
  perspective: AgentPerspective;
  systemPrompt: string;
  weight: number;  // 0-1, how much this agent's opinion counts
}

export interface AgentAnalysis {
  agentId: string;
  perspective: AgentPerspective;
  analysis: LLMAnalysisResult;
  keyArguments: string[];
  concerns: string[];
  supportingEvidence: string[];
  confidence: number;
}

export interface Critique {
  fromAgentId: string;
  toAgentId: string;
  targetClaim: string;
  counterArgument: string;
  severity: 'minor' | 'moderate' | 'major';
  resolved: boolean;
}

export interface Rebuttal {
  agentId: string;
  critiqueId: string;
  response: string;
  concedes: boolean;
  modifiedPosition?: string;
}

export interface DebateRound {
  roundNumber: number;
  analyses: AgentAnalysis[];
  critiques: Critique[];
  rebuttals: Rebuttal[];
  consensusProgress: number;  // 0-1
}

export interface DebateResult {
  proposalId: string;
  proposalTitle: string;
  rounds: DebateRound[];

  // Consensus
  finalRecommendation: 'support' | 'oppose' | 'abstain';
  consensusStrength: number;  // 0-1, how much agents agreed

  // Aggregated analysis
  aggregatedScore: number;
  aggregatedConfidence: number;

  // Key findings
  pointsOfAgreement: string[];
  pointsOfDisagreement: string[];
  unresolvedConcerns: string[];

  // Reasoning
  majorityReasoning: string;
  dissent: Array<{
    agentId: string;
    perspective: AgentPerspective;
    dissent: string;
  }>;

  // Metadata
  totalAgents: number;
  debateRounds: number;
  duration: number;
}

export interface DebateConfig {
  /** Number of debate rounds */
  rounds: number;
  /** Minimum consensus to end debate early */
  minConsensus: number;
  /** LLM configuration */
  llmConfig?: Partial<LLMConfig>;
  /** Enable cross-examination */
  enableCrossExamination: boolean;
  /** Enable rebuttals */
  enableRebuttals: boolean;
  /** Timeout per agent (ms) */
  agentTimeout: number;
  /** Enable memory-based learning */
  enableMemory: boolean;
  /** External memory manager (optional, creates internal if not provided) */
  memoryManager?: AgentMemoryManager;
  /** Number of similar past debates to retrieve for context */
  memoryContextSize: number;
  /** Apply learned weight adjustments to agents */
  applyLearnedWeights: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: DebateConfig = {
  rounds: 2,
  minConsensus: 0.8,
  enableCrossExamination: true,
  enableRebuttals: true,
  agentTimeout: 30000,
  enableMemory: true,
  memoryContextSize: 5,
  applyLearnedWeights: true,
};

// ============================================================================
// Agent Definitions
// ============================================================================

const DEBATE_AGENTS: DebateAgent[] = [
  {
    id: 'risk-analyst',
    name: 'Risk Analyst',
    perspective: 'risk_focused',
    weight: 0.2,
    systemPrompt: `You are a Risk Analyst evaluating governance proposals. Your job is to identify and emphasize potential risks, downsides, and failure modes. You are naturally skeptical and look for what could go wrong.

Focus on:
- Smart contract risks
- Economic attack vectors
- Unintended consequences
- Historical precedents of similar failures
- Worst-case scenarios

Be thorough in identifying risks but don't be alarmist. Quantify risks where possible.`,
  },
  {
    id: 'growth-strategist',
    name: 'Growth Strategist',
    perspective: 'growth_focused',
    weight: 0.2,
    systemPrompt: `You are a Growth Strategist evaluating governance proposals. Your job is to identify opportunities for protocol growth, user acquisition, and competitive advantage.

Focus on:
- TVL growth potential
- User acquisition opportunities
- Competitive positioning
- Market timing
- Network effects

Be optimistic but realistic. Identify growth opportunities with supporting evidence.`,
  },
  {
    id: 'conservative-guardian',
    name: 'Conservative Guardian',
    perspective: 'conservative',
    weight: 0.15,
    systemPrompt: `You are a Conservative Guardian evaluating governance proposals. You favor the status quo and are skeptical of changes that haven't been proven elsewhere. You prioritize stability over growth.

Focus on:
- Why the current state might be optimal
- Risks of unnecessary change
- Proven alternatives to proposed changes
- Long-term stability implications

Challenge assumptions that change is always good.`,
  },
  {
    id: 'innovation-advocate',
    name: 'Innovation Advocate',
    perspective: 'progressive',
    weight: 0.15,
    systemPrompt: `You are an Innovation Advocate evaluating governance proposals. You believe in continuous improvement and are excited by novel approaches. You see stagnation as a risk.

Focus on:
- Innovative aspects of the proposal
- First-mover advantages
- Technical improvements
- Future optionality created

Challenge assumptions that the status quo is safe.`,
  },
  {
    id: 'community-voice',
    name: 'Community Voice',
    perspective: 'community',
    weight: 0.15,
    systemPrompt: `You are the Community Voice evaluating governance proposals. You represent the interests of regular users, not whales or insiders. You focus on accessibility, fairness, and user experience.

Focus on:
- Impact on small holders
- Accessibility of benefits
- Fairness of distribution
- Community sentiment
- User experience changes

Advocate for the average user's perspective.`,
  },
  {
    id: 'tokenomics-expert',
    name: 'Tokenomics Expert',
    perspective: 'economic',
    weight: 0.15,
    systemPrompt: `You are a Tokenomics Expert evaluating governance proposals. You analyze economic incentives, game theory, and token value implications.

Focus on:
- Token supply/demand dynamics
- Incentive alignment
- Value accrual mechanisms
- Game-theoretic implications
- Sustainability of economic model

Analyze the proposal through an economic lens with quantitative reasoning where possible.`,
  },
];

const MEDIATOR_AGENT: DebateAgent = {
  id: 'mediator',
  name: 'Debate Mediator',
  perspective: 'mediator',
  weight: 0,  // Mediator doesn't vote
  systemPrompt: `You are a Debate Mediator synthesizing multiple perspectives on a governance proposal. Your job is to:

1. Identify points of consensus across all analysts
2. Highlight unresolved disagreements
3. Weigh the strength of arguments on each side
4. Produce a balanced final recommendation

Be fair to all perspectives. Don't let any single voice dominate. Focus on finding truth through the diversity of opinions.`,
};

// ============================================================================
// Prompts
// ============================================================================

const ANALYSIS_PROMPT = (context: ProposalContext, agent: DebateAgent, memoryContext?: string) => `
Analyze this governance proposal from your perspective as ${agent.name}:

**Proposal:** ${context.title}
**Description:** ${context.description}
**Type:** ${context.type}
${context.requestedAmount ? `**Requested Amount:** ${context.requestedAmount.toLocaleString()}` : ''}

**Current Metrics:**
- TVL: $${context.currentMetrics.tvl.toLocaleString()}
- 24h Volume: $${context.currentMetrics.volume24h.toLocaleString()}
- Active Users: ${context.currentMetrics.activeUsers}
${memoryContext || ''}
Provide your analysis as JSON:
{
  "recommendation": "support" | "oppose" | "abstain",
  "confidence": 0.0-1.0,
  "keyArguments": ["argument1", "argument2", ...],
  "concerns": ["concern1", "concern2", ...],
  "supportingEvidence": ["evidence1", "evidence2", ...],
  "summary": "2-3 sentence summary from your perspective"
}`;

const CRITIQUE_PROMPT = (
  yourAnalysis: AgentAnalysis,
  targetAnalysis: AgentAnalysis,
  yourAgent: DebateAgent,
  targetAgent: DebateAgent
) => `
You are ${yourAgent.name}. Another analyst (${targetAgent.name}) has made the following key arguments:

${targetAnalysis.keyArguments.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Their recommendation: ${targetAnalysis.analysis.recommendation} (confidence: ${targetAnalysis.confidence})

Your recommendation was: ${yourAnalysis.analysis.recommendation} (confidence: ${yourAnalysis.confidence})

Identify the weakest point in their argument and provide a critique. Be specific and constructive.

Respond as JSON:
{
  "targetClaim": "the specific claim you're challenging",
  "counterArgument": "your counter-argument",
  "severity": "minor" | "moderate" | "major"
}`;

const REBUTTAL_PROMPT = (
  analysis: AgentAnalysis,
  critique: Critique,
  agent: DebateAgent
) => `
You are ${agent.name}. Another analyst has critiqued your argument:

**Your claim:** ${critique.targetClaim}
**Their counter-argument:** ${critique.counterArgument}
**Severity:** ${critique.severity}

Respond to this critique. You may defend your position, concede the point, or modify your stance.

Respond as JSON:
{
  "response": "your response to the critique",
  "concedes": true | false,
  "modifiedPosition": "your updated position if you're modifying it (optional)"
}`;

const SYNTHESIS_PROMPT = (
  analyses: AgentAnalysis[],
  critiques: Critique[],
  rebuttals: Rebuttal[]
) => `
You are the Debate Mediator. Multiple analysts have debated this proposal.

**Analyst Positions:**
${analyses.map(a => `- ${a.agentId} (${a.perspective}): ${a.analysis.recommendation} (confidence: ${a.confidence.toFixed(2)})
  Key arguments: ${a.keyArguments.slice(0, 2).join('; ')}`).join('\n')}

**Key Critiques:**
${critiques.slice(0, 5).map(c => `- ${c.fromAgentId} challenged ${c.toAgentId}: "${c.counterArgument}" (${c.severity})`).join('\n')}

**Resolutions:**
${rebuttals.filter(r => r.concedes).length} points conceded, ${rebuttals.filter(r => !r.concedes).length} defended

Synthesize these perspectives into a consensus. Respond as JSON:
{
  "finalRecommendation": "support" | "oppose" | "abstain",
  "consensusStrength": 0.0-1.0,
  "aggregatedScore": -100 to 100,
  "aggregatedConfidence": 0.0-1.0,
  "pointsOfAgreement": ["point1", "point2", ...],
  "pointsOfDisagreement": ["point1", "point2", ...],
  "unresolvedConcerns": ["concern1", ...],
  "majorityReasoning": "explanation of the final recommendation",
  "dissent": [{"agentId": "...", "dissent": "their dissenting view"}]
}`;

// ============================================================================
// Multi-Agent Debate Engine
// ============================================================================

export class MultiAgentDebateEngine extends EventEmitter {
  private config: DebateConfig;
  private analyzer: LLMProposalAnalyzer;
  private agents: DebateAgent[];
  private mediator: DebateAgent;
  private debateCounter = 0;
  private memory: AgentMemoryManager | null = null;
  private baseWeights: Map<string, number> = new Map();
  private currentMemoryContext: MemoryContext | null = null;

  constructor(config: Partial<DebateConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.analyzer = new LLMProposalAnalyzer(this.config.llmConfig);
    this.agents = [...DEBATE_AGENTS];
    this.mediator = MEDIATOR_AGENT;

    // Store base weights for later adjustment
    for (const agent of this.agents) {
      this.baseWeights.set(agent.id, agent.weight);
    }

    // Initialize memory if enabled
    if (this.config.enableMemory) {
      this.memory = this.config.memoryManager || new AgentMemoryManager();
      this.emit('memory_enabled', { memoryStats: this.memory.getStats() });
    }
  }

  /**
   * Get memory manager
   */
  getMemory(): AgentMemoryManager | null {
    return this.memory;
  }

  /**
   * Set memory manager
   */
  setMemory(memory: AgentMemoryManager): void {
    this.memory = memory;
    this.config.enableMemory = true;
    this.emit('memory_set', { memoryStats: memory.getStats() });
  }

  /**
   * Run a full debate on a proposal
   */
  async debate(context: ProposalContext): Promise<DebateResult> {
    this.debateCounter++;
    const debateId = `DEBATE-${this.debateCounter}`;
    const startTime = Date.now();

    // Memory: Retrieve context from past debates
    if (this.memory && this.config.enableMemory) {
      this.currentMemoryContext = this.memory.getContext(
        context,
        this.config.memoryContextSize
      );

      this.emit('memory_context_retrieved', {
        debateId,
        similarDebates: this.currentMemoryContext.similarDebates.length,
        historicalAccuracy: this.currentMemoryContext.historicalAccuracy,
      });

      // Apply learned weight adjustments
      if (this.config.applyLearnedWeights) {
        this.applyLearnedWeights();
      }
    }

    this.emit('debate_started', {
      debateId,
      proposalTitle: context.title,
      agentCount: this.agents.length,
      memoryEnabled: this.config.enableMemory,
    });

    const rounds: DebateRound[] = [];
    let consensusReached = false;

    // Run debate rounds
    for (let round = 1; round <= this.config.rounds && !consensusReached; round++) {
      const roundResult = await this.runRound(round, context, rounds);
      rounds.push(roundResult);

      if (roundResult.consensusProgress >= this.config.minConsensus) {
        consensusReached = true;
        this.emit('early_consensus', {
          debateId,
          round,
          consensus: roundResult.consensusProgress,
        });
      }
    }

    // Synthesize final result
    const allAnalyses = rounds.flatMap(r => r.analyses);
    const allCritiques = rounds.flatMap(r => r.critiques);
    const allRebuttals = rounds.flatMap(r => r.rebuttals);

    const synthesis = await this.synthesize(allAnalyses, allCritiques, allRebuttals);

    const result: DebateResult = {
      proposalId: context.title,
      proposalTitle: context.title,
      rounds,
      ...synthesis,
      totalAgents: this.agents.length,
      debateRounds: rounds.length,
      duration: Date.now() - startTime,
    };

    // Memory: Store debate result
    if (this.memory && this.config.enableMemory) {
      const memoryId = this.memory.storeDebate(context, result);
      this.emit('memory_stored', {
        debateId,
        memoryId,
        recommendation: result.finalRecommendation,
      });
    }

    this.emit('debate_completed', {
      debateId,
      recommendation: result.finalRecommendation,
      consensusStrength: result.consensusStrength,
      duration: result.duration,
    });

    // Reset memory context
    this.currentMemoryContext = null;

    return result;
  }

  /**
   * Apply learned weight adjustments from memory
   */
  private applyLearnedWeights(): void {
    if (!this.memory) return;

    const adjustments = this.memory.suggestWeightAdjustments();

    for (const agent of this.agents) {
      const baseWeight = this.baseWeights.get(agent.id) || agent.weight;
      const adjustment = adjustments.get(agent.id) || 0;

      // Apply adjustment, keeping weight bounded 0.05 - 0.4
      agent.weight = Math.max(0.05, Math.min(0.4, baseWeight + adjustment));
    }

    // Re-normalize weights to sum to 1
    const totalWeight = this.agents.reduce((sum, a) => sum + a.weight, 0);
    if (totalWeight > 0) {
      for (const agent of this.agents) {
        agent.weight = agent.weight / totalWeight;
      }
    }

    this.emit('weights_adjusted', {
      adjustments: Object.fromEntries(adjustments),
      newWeights: Object.fromEntries(this.agents.map(a => [a.id, a.weight])),
    });
  }

  /**
   * Get memory-enhanced context for agents
   */
  private getMemoryContext(): string {
    if (!this.currentMemoryContext || this.currentMemoryContext.similarDebates.length === 0) {
      return '';
    }

    const similar = this.currentMemoryContext.similarDebates.slice(0, 3);
    const patterns = this.currentMemoryContext.relevantPatterns.slice(0, 2);

    let context = '\n\n**Historical Context from Similar Debates:**\n';

    for (const debate of similar) {
      context += `- "${debate.proposal.title}" (${(debate.similarity! * 100).toFixed(0)}% similar): `;
      context += `Recommended ${debate.result.finalRecommendation} `;
      context += `(${(debate.result.consensusStrength * 100).toFixed(0)}% consensus)`;
      if (debate.actualOutcome) {
        context += ` → Outcome: ${debate.actualOutcome.success || 'pending'}`;
      }
      context += '\n';
    }

    if (patterns.length > 0) {
      context += '\n**Observed Patterns:**\n';
      for (const pattern of patterns) {
        context += `- ${pattern.description}\n`;
      }
    }

    context += `\nHistorical accuracy: ${(this.currentMemoryContext.historicalAccuracy * 100).toFixed(0)}%\n`;

    return context;
  }

  private async runRound(
    roundNumber: number,
    context: ProposalContext,
    previousRounds: DebateRound[]
  ): Promise<DebateRound> {
    this.emit('round_started', { roundNumber });

    // Phase 1: Initial analyses (or refined analyses in later rounds)
    const analyses = await this.collectAnalyses(context, previousRounds);

    // Phase 2: Cross-examination
    let critiques: Critique[] = [];
    if (this.config.enableCrossExamination && roundNumber > 1) {
      critiques = await this.crossExamine(analyses);
    }

    // Phase 3: Rebuttals
    let rebuttals: Rebuttal[] = [];
    if (this.config.enableRebuttals && critiques.length > 0) {
      rebuttals = await this.collectRebuttals(analyses, critiques);
    }

    // Calculate consensus progress
    const consensusProgress = this.calculateConsensus(analyses);

    this.emit('round_completed', {
      roundNumber,
      analysesCount: analyses.length,
      critiquesCount: critiques.length,
      rebuttalsCount: rebuttals.length,
      consensusProgress,
    });

    return {
      roundNumber,
      analyses,
      critiques,
      rebuttals,
      consensusProgress,
    };
  }

  private async collectAnalyses(
    context: ProposalContext,
    previousRounds: DebateRound[]
  ): Promise<AgentAnalysis[]> {
    const analyses: AgentAnalysis[] = [];

    // Get memory context for agents
    const memoryContext = this.getMemoryContext();

    // Run agents in parallel
    const promises = this.agents.map(async (agent) => {
      try {
        const prompt = ANALYSIS_PROMPT(context, agent, memoryContext);
        const response = await this.callLLM(agent.systemPrompt, prompt);
        const parsed = this.parseJSON(response);

        const analysis: AgentAnalysis = {
          agentId: agent.id,
          perspective: agent.perspective,
          analysis: {
            summary: parsed.summary || '',
            sentiment: parsed.recommendation === 'support' ? 'positive' :
                      parsed.recommendation === 'oppose' ? 'negative' : 'neutral',
            impactPredictions: this.defaultImpactPredictions(),
            risks: (parsed.concerns || []).map((c: string) => ({
              description: c,
              severity: 'medium' as const,
            })),
            opportunities: parsed.supportingEvidence || [],
            recommendation: parsed.recommendation || 'abstain',
            recommendationReasoning: parsed.summary || '',
            overallConfidence: parsed.confidence || 0.5,
            suggestedQuestions: [],
          },
          keyArguments: parsed.keyArguments || [],
          concerns: parsed.concerns || [],
          supportingEvidence: parsed.supportingEvidence || [],
          confidence: parsed.confidence || 0.5,
        };

        return analysis;
      } catch (error) {
        this.emit('agent_error', {
          agentId: agent.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is AgentAnalysis => r !== null);
  }

  private async crossExamine(analyses: AgentAnalysis[]): Promise<Critique[]> {
    const critiques: Critique[] = [];

    // Each agent critiques agents with opposing views
    for (const analyst of analyses) {
      const opposingAnalysts = analyses.filter(
        a => a.agentId !== analyst.agentId &&
             a.analysis.recommendation !== analyst.analysis.recommendation
      );

      if (opposingAnalysts.length === 0) continue;

      // Critique the first opposing analyst
      const target = opposingAnalysts[0];
      const agent = this.agents.find(a => a.id === analyst.agentId);
      const targetAgent = this.agents.find(a => a.id === target.agentId);

      if (!agent || !targetAgent) continue;

      try {
        const prompt = CRITIQUE_PROMPT(analyst, target, agent, targetAgent);
        const response = await this.callLLM(agent.systemPrompt, prompt);
        const parsed = this.parseJSON(response);

        critiques.push({
          fromAgentId: analyst.agentId,
          toAgentId: target.agentId,
          targetClaim: parsed.targetClaim || '',
          counterArgument: parsed.counterArgument || '',
          severity: parsed.severity || 'moderate',
          resolved: false,
        });
      } catch (error) {
        // Skip failed critiques
      }
    }

    return critiques;
  }

  private async collectRebuttals(
    analyses: AgentAnalysis[],
    critiques: Critique[]
  ): Promise<Rebuttal[]> {
    const rebuttals: Rebuttal[] = [];

    for (const critique of critiques) {
      const targetAnalysis = analyses.find(a => a.agentId === critique.toAgentId);
      const agent = this.agents.find(a => a.id === critique.toAgentId);

      if (!targetAnalysis || !agent) continue;

      try {
        const prompt = REBUTTAL_PROMPT(targetAnalysis, critique, agent);
        const response = await this.callLLM(agent.systemPrompt, prompt);
        const parsed = this.parseJSON(response);

        rebuttals.push({
          agentId: critique.toAgentId,
          critiqueId: `${critique.fromAgentId}->${critique.toAgentId}`,
          response: parsed.response || '',
          concedes: parsed.concedes || false,
          modifiedPosition: parsed.modifiedPosition,
        });

        critique.resolved = true;
      } catch (error) {
        // Skip failed rebuttals
      }
    }

    return rebuttals;
  }

  private async synthesize(
    analyses: AgentAnalysis[],
    critiques: Critique[],
    rebuttals: Rebuttal[]
  ): Promise<Omit<DebateResult, 'proposalId' | 'proposalTitle' | 'rounds' | 'totalAgents' | 'debateRounds' | 'duration'>> {
    try {
      const prompt = SYNTHESIS_PROMPT(analyses, critiques, rebuttals);
      const response = await this.callLLM(this.mediator.systemPrompt, prompt);
      const parsed = this.parseJSON(response);

      return {
        finalRecommendation: parsed.finalRecommendation || this.calculateMajority(analyses),
        consensusStrength: parsed.consensusStrength || this.calculateConsensus(analyses),
        aggregatedScore: parsed.aggregatedScore || this.calculateAggregatedScore(analyses),
        aggregatedConfidence: parsed.aggregatedConfidence || this.calculateAggregatedConfidence(analyses),
        pointsOfAgreement: parsed.pointsOfAgreement || [],
        pointsOfDisagreement: parsed.pointsOfDisagreement || [],
        unresolvedConcerns: parsed.unresolvedConcerns || [],
        majorityReasoning: parsed.majorityReasoning || '',
        dissent: parsed.dissent || [],
      };
    } catch (error) {
      // Fallback to simple aggregation
      return {
        finalRecommendation: this.calculateMajority(analyses),
        consensusStrength: this.calculateConsensus(analyses),
        aggregatedScore: this.calculateAggregatedScore(analyses),
        aggregatedConfidence: this.calculateAggregatedConfidence(analyses),
        pointsOfAgreement: [],
        pointsOfDisagreement: [],
        unresolvedConcerns: analyses.flatMap(a => a.concerns).slice(0, 5),
        majorityReasoning: 'Aggregated from individual agent analyses',
        dissent: [],
      };
    }
  }

  private calculateConsensus(analyses: AgentAnalysis[]): number {
    if (analyses.length === 0) return 0;

    const recommendations = analyses.map(a => a.analysis.recommendation);
    const counts = {
      support: recommendations.filter(r => r === 'support').length,
      oppose: recommendations.filter(r => r === 'oppose').length,
      abstain: recommendations.filter(r => r === 'abstain').length,
    };

    const maxCount = Math.max(counts.support, counts.oppose, counts.abstain);
    return maxCount / analyses.length;
  }

  private calculateMajority(analyses: AgentAnalysis[]): 'support' | 'oppose' | 'abstain' {
    let supportWeight = 0;
    let opposeWeight = 0;
    let abstainWeight = 0;

    for (const analysis of analyses) {
      const agent = this.agents.find(a => a.id === analysis.agentId);
      const weight = agent?.weight || 0.1;

      switch (analysis.analysis.recommendation) {
        case 'support': supportWeight += weight * analysis.confidence; break;
        case 'oppose': opposeWeight += weight * analysis.confidence; break;
        case 'abstain': abstainWeight += weight * analysis.confidence; break;
      }
    }

    if (supportWeight > opposeWeight && supportWeight > abstainWeight) return 'support';
    if (opposeWeight > supportWeight && opposeWeight > abstainWeight) return 'oppose';
    return 'abstain';
  }

  private calculateAggregatedScore(analyses: AgentAnalysis[]): number {
    if (analyses.length === 0) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    for (const analysis of analyses) {
      const agent = this.agents.find(a => a.id === analysis.agentId);
      const weight = agent?.weight || 0.1;

      const score = analysis.analysis.recommendation === 'support' ? 50 :
                   analysis.analysis.recommendation === 'oppose' ? -50 : 0;

      totalScore += score * weight * analysis.confidence;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private calculateAggregatedConfidence(analyses: AgentAnalysis[]): number {
    if (analyses.length === 0) return 0;

    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
    const consensus = this.calculateConsensus(analyses);

    // Higher consensus = higher confidence in the aggregated result
    return avgConfidence * consensus;
  }

  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('No API key configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.llmConfig?.model || 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(this.config.agentTimeout),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private parseJSON(text: string): Record<string, unknown> {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback
      }
    }
    return {};
  }

  private defaultImpactPredictions() {
    return {
      tvl: { change: 0, confidence: 0.5, reasoning: '' },
      volume: { change: 0, confidence: 0.5, reasoning: '' },
      fees: { change: 0, confidence: 0.5, reasoning: '' },
      users: { change: 0, confidence: 0.5, reasoning: '' },
      token_price: { change: 0, confidence: 0.5, reasoning: '' },
      apy: { change: 0, confidence: 0.5, reasoning: '' },
    };
  }

  /**
   * Quick debate (single round, no cross-examination)
   */
  async quickDebate(context: ProposalContext): Promise<DebateResult> {
    const originalConfig = { ...this.config };
    this.config.rounds = 1;
    this.config.enableCrossExamination = false;
    this.config.enableRebuttals = false;

    const result = await this.debate(context);

    this.config = originalConfig;
    return result;
  }

  /**
   * Get debate agents
   */
  getAgents(): DebateAgent[] {
    return [...this.agents];
  }

  /**
   * Add custom agent
   */
  addAgent(agent: DebateAgent): void {
    this.agents.push(agent);
    this.emit('agent_added', { agentId: agent.id });
  }

  /**
   * Remove agent
   */
  removeAgent(agentId: string): boolean {
    const index = this.agents.findIndex(a => a.id === agentId);
    if (index >= 0) {
      this.agents.splice(index, 1);
      this.emit('agent_removed', { agentId });
      return true;
    }
    return false;
  }

  /**
   * Record actual outcome for a past debate (for learning)
   */
  recordOutcome(
    memoryId: string,
    outcome: {
      implemented: boolean;
      success?: 'positive' | 'negative' | 'neutral';
      measuredImpact?: Record<string, number>;
      notes?: string;
    }
  ): boolean {
    if (!this.memory) return false;

    const result = this.memory.recordOutcome(memoryId, {
      ...outcome,
      recordedAt: Date.now(),
    });

    if (result) {
      this.emit('outcome_recorded', { memoryId, outcome });
    }

    return result;
  }

  /**
   * Get learning insights from memory
   */
  getLearningInsights(): string[] {
    if (!this.memory) return [];
    return this.memory.generateInsights();
  }

  /**
   * Get agent performance stats from memory
   */
  getAgentPerformance(): object[] {
    if (!this.memory) return [];
    return this.memory.getAllPerformance();
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): object | null {
    if (!this.memory) return null;
    return this.memory.getStats();
  }

  /**
   * Reset agent weights to defaults
   */
  resetWeights(): void {
    for (const agent of this.agents) {
      const baseWeight = this.baseWeights.get(agent.id);
      if (baseWeight !== undefined) {
        agent.weight = baseWeight;
      }
    }
    this.emit('weights_reset');
  }
}

// ============================================================================
// Exports
// ============================================================================

let engineInstance: MultiAgentDebateEngine | null = null;

export function getMultiAgentDebateEngine(
  config?: Partial<DebateConfig>
): MultiAgentDebateEngine {
  if (!engineInstance) {
    engineInstance = new MultiAgentDebateEngine(config);
  }
  return engineInstance;
}

export { DEBATE_AGENTS, MEDIATOR_AGENT };

export default {
  MultiAgentDebateEngine,
  getMultiAgentDebateEngine,
  DEFAULT_CONFIG,
  DEBATE_AGENTS,
  MEDIATOR_AGENT,
};
