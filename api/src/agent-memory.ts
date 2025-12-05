#!/usr/bin/env bun
/**
 * Agent Memory System
 *
 * Enables debate agents to learn from past debates:
 * - Stores debate outcomes and predictions
 * - Tracks agent accuracy over time
 * - Provides context from similar past proposals
 * - Enables strategy adaptation based on historical performance
 */

import { EventEmitter } from 'events';
import { DebateResult, AgentAnalysis, DebateAgent } from './multi-agent-debate.js';
import { ProposalContext } from './llm-proposal-analyzer.js';

// ============================================================================
// Types
// ============================================================================

export interface DebateMemory {
  id: string;
  timestamp: number;
  proposal: ProposalContext;
  result: DebateResult;
  actualOutcome?: ActualOutcome;
  similarity?: number; // Similarity score when retrieved
}

export interface ActualOutcome {
  implemented: boolean;
  success?: 'positive' | 'negative' | 'neutral';
  measuredImpact?: {
    tvlChange?: number;
    volumeChange?: number;
    userChange?: number;
    priceChange?: number;
  };
  notes?: string;
  recordedAt: number;
}

export interface AgentPerformance {
  agentId: string;
  totalDebates: number;
  correctPredictions: number;
  incorrectPredictions: number;
  accuracy: number;
  calibration: number; // How well confidence matches accuracy
  biases: {
    overallBias: 'optimistic' | 'pessimistic' | 'balanced';
    supportBias: number; // % of time recommends support
    averageConfidence: number;
  };
  strengthAreas: string[]; // Proposal types they're good at
  weaknessAreas: string[]; // Proposal types they struggle with
}

export interface MemoryContext {
  similarDebates: DebateMemory[];
  agentPerformance: Map<string, AgentPerformance>;
  relevantPatterns: Pattern[];
  historicalAccuracy: number;
}

export interface Pattern {
  description: string;
  frequency: number;
  reliability: number;
  examples: string[];
}

export interface MemoryConfig {
  maxMemories: number;
  similarityThreshold: number;
  learningRate: number;
  decayFactor: number; // How much to weight recent vs old debates
  patternMinFrequency: number;
}

// ============================================================================
// Agent Memory Manager
// ============================================================================

export class AgentMemoryManager extends EventEmitter {
  private memories: Map<string, DebateMemory> = new Map();
  private agentStats: Map<string, AgentPerformance> = new Map();
  private patterns: Pattern[] = [];
  private config: MemoryConfig;
  private memoryCounter = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    super();
    this.config = {
      maxMemories: config.maxMemories ?? 1000,
      similarityThreshold: config.similarityThreshold ?? 0.6,
      learningRate: config.learningRate ?? 0.1,
      decayFactor: config.decayFactor ?? 0.95,
      patternMinFrequency: config.patternMinFrequency ?? 3,
    };
  }

  // ===========================================================================
  // Memory Storage
  // ===========================================================================

  /**
   * Store a new debate result in memory
   */
  storeDebate(proposal: ProposalContext, result: DebateResult): string {
    this.memoryCounter++;
    const id = `MEM-${this.memoryCounter}`;

    const memory: DebateMemory = {
      id,
      timestamp: Date.now(),
      proposal,
      result,
    };

    this.memories.set(id, memory);

    // Update agent statistics
    this.updateAgentStats(result);

    // Enforce memory limit (LRU eviction)
    if (this.memories.size > this.config.maxMemories) {
      const oldestKey = this.memories.keys().next().value;
      if (oldestKey) {
        this.memories.delete(oldestKey);
      }
    }

    // Detect patterns
    this.detectPatterns();

    this.emit('memory_stored', { id, proposal: proposal.title });

    return id;
  }

  /**
   * Record actual outcome after proposal execution
   */
  recordOutcome(memoryId: string, outcome: ActualOutcome): boolean {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    memory.actualOutcome = outcome;

    // Update agent accuracy based on outcome
    this.updateAgentAccuracy(memory);

    this.emit('outcome_recorded', { memoryId, implemented: outcome.implemented });

    return true;
  }

  // ===========================================================================
  // Memory Retrieval
  // ===========================================================================

  /**
   * Get relevant context from past debates for a new proposal
   */
  getContext(proposal: ProposalContext, maxResults = 5): MemoryContext {
    const similarDebates = this.findSimilar(proposal, maxResults);

    return {
      similarDebates,
      agentPerformance: new Map(this.agentStats),
      relevantPatterns: this.getRelevantPatterns(proposal),
      historicalAccuracy: this.calculateHistoricalAccuracy(),
    };
  }

  /**
   * Find similar past debates
   */
  findSimilar(proposal: ProposalContext, maxResults = 5): DebateMemory[] {
    const scored: Array<{ memory: DebateMemory; score: number }> = [];

    for (const memory of this.memories.values()) {
      const score = this.calculateSimilarity(proposal, memory.proposal);
      if (score >= this.config.similarityThreshold) {
        scored.push({ memory: { ...memory, similarity: score }, score });
      }
    }

    // Sort by similarity (descending) and recency
    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      return b.memory.timestamp - a.memory.timestamp;
    });

    return scored.slice(0, maxResults).map(s => s.memory);
  }

  /**
   * Calculate similarity between two proposals
   */
  private calculateSimilarity(a: ProposalContext, b: ProposalContext): number {
    let score = 0;
    let weights = 0;

    // Type match (high weight)
    if (a.type === b.type) {
      score += 0.3;
    }
    weights += 0.3;

    // Title/description text similarity (Jaccard)
    const aWords = new Set(this.tokenize(a.title + ' ' + a.description));
    const bWords = new Set(this.tokenize(b.title + ' ' + b.description));
    const intersection = [...aWords].filter(w => bWords.has(w)).length;
    const union = new Set([...aWords, ...bWords]).size;
    const textSimilarity = union > 0 ? intersection / union : 0;
    score += textSimilarity * 0.4;
    weights += 0.4;

    // Amount similarity (for funding proposals)
    if (a.requestedAmount && b.requestedAmount) {
      const ratio = Math.min(a.requestedAmount, b.requestedAmount) /
                    Math.max(a.requestedAmount, b.requestedAmount);
      score += ratio * 0.15;
      weights += 0.15;
    }

    // Metrics similarity
    if (a.currentMetrics && b.currentMetrics) {
      const metricSim = this.compareMetrics(a.currentMetrics, b.currentMetrics);
      score += metricSim * 0.15;
      weights += 0.15;
    }

    return weights > 0 ? score / weights : 0;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private compareMetrics(a: ProposalContext['currentMetrics'], b: ProposalContext['currentMetrics']): number {
    const ratios: number[] = [];

    if (a.tvl && b.tvl) {
      ratios.push(Math.min(a.tvl, b.tvl) / Math.max(a.tvl, b.tvl));
    }
    if (a.volume24h && b.volume24h) {
      ratios.push(Math.min(a.volume24h, b.volume24h) / Math.max(a.volume24h, b.volume24h));
    }
    if (a.activeUsers && b.activeUsers) {
      ratios.push(Math.min(a.activeUsers, b.activeUsers) / Math.max(a.activeUsers, b.activeUsers));
    }

    return ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  }

  // ===========================================================================
  // Agent Performance Tracking
  // ===========================================================================

  private updateAgentStats(result: DebateResult): void {
    for (const round of result.rounds) {
      for (const analysis of round.analyses) {
        let stats = this.agentStats.get(analysis.agentId);

        if (!stats) {
          stats = {
            agentId: analysis.agentId,
            totalDebates: 0,
            correctPredictions: 0,
            incorrectPredictions: 0,
            accuracy: 0,
            calibration: 0,
            biases: {
              overallBias: 'balanced',
              supportBias: 0,
              averageConfidence: 0,
            },
            strengthAreas: [],
            weaknessAreas: [],
          };
          this.agentStats.set(analysis.agentId, stats);
        }

        stats.totalDebates++;

        // Update support bias
        const supportCount = stats.biases.supportBias * (stats.totalDebates - 1);
        const newSupport = analysis.analysis.recommendation === 'support' ? 1 : 0;
        stats.biases.supportBias = (supportCount + newSupport) / stats.totalDebates;

        // Update average confidence
        const confSum = stats.biases.averageConfidence * (stats.totalDebates - 1);
        stats.biases.averageConfidence = (confSum + analysis.confidence) / stats.totalDebates;

        // Update overall bias
        if (stats.biases.supportBias > 0.6) {
          stats.biases.overallBias = 'optimistic';
        } else if (stats.biases.supportBias < 0.4) {
          stats.biases.overallBias = 'pessimistic';
        } else {
          stats.biases.overallBias = 'balanced';
        }
      }
    }
  }

  private updateAgentAccuracy(memory: DebateMemory): void {
    if (!memory.actualOutcome) return;

    const { implemented, success } = memory.actualOutcome;

    for (const round of memory.result.rounds) {
      for (const analysis of round.analyses) {
        const stats = this.agentStats.get(analysis.agentId);
        if (!stats) continue;

        // Determine if prediction was correct
        const predicted = analysis.analysis.recommendation;
        let correct = false;

        if (predicted === 'support' && implemented && success === 'positive') {
          correct = true;
        } else if (predicted === 'oppose' && (!implemented || success === 'negative')) {
          correct = true;
        } else if (predicted === 'abstain' && success === 'neutral') {
          correct = true;
        }

        if (correct) {
          stats.correctPredictions++;
        } else {
          stats.incorrectPredictions++;
        }

        // Recalculate accuracy
        const total = stats.correctPredictions + stats.incorrectPredictions;
        stats.accuracy = total > 0 ? stats.correctPredictions / total : 0;

        // Update calibration (how well confidence matches accuracy)
        const confidenceDiff = Math.abs(analysis.confidence - stats.accuracy);
        stats.calibration = 1 - confidenceDiff;

        // Track strength/weakness areas
        const proposalType = memory.proposal.type;
        if (correct) {
          if (!stats.strengthAreas.includes(proposalType)) {
            stats.strengthAreas.push(proposalType);
          }
          // Remove from weakness if was there
          stats.weaknessAreas = stats.weaknessAreas.filter(t => t !== proposalType);
        } else {
          if (!stats.weaknessAreas.includes(proposalType)) {
            stats.weaknessAreas.push(proposalType);
          }
        }
      }
    }
  }

  /**
   * Get performance stats for a specific agent
   */
  getAgentPerformance(agentId: string): AgentPerformance | undefined {
    return this.agentStats.get(agentId);
  }

  /**
   * Get all agent performance stats
   */
  getAllPerformance(): AgentPerformance[] {
    return Array.from(this.agentStats.values());
  }

  /**
   * Get top performing agents
   */
  getTopAgents(count = 3): AgentPerformance[] {
    return this.getAllPerformance()
      .filter(a => a.totalDebates >= 5) // Minimum sample size
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, count);
  }

  // ===========================================================================
  // Pattern Detection
  // ===========================================================================

  private detectPatterns(): void {
    const typeOutcomes = new Map<string, { support: number; oppose: number; total: number }>();

    for (const memory of this.memories.values()) {
      if (!memory.actualOutcome) continue;

      const key = memory.proposal.type;
      let stats = typeOutcomes.get(key);
      if (!stats) {
        stats = { support: 0, oppose: 0, total: 0 };
        typeOutcomes.set(key, stats);
      }

      stats.total++;
      if (memory.result.finalRecommendation === 'support') {
        stats.support++;
      } else if (memory.result.finalRecommendation === 'oppose') {
        stats.oppose++;
      }
    }

    this.patterns = [];

    for (const [type, stats] of typeOutcomes.entries()) {
      if (stats.total >= this.config.patternMinFrequency) {
        const supportRate = stats.support / stats.total;

        if (supportRate > 0.7) {
          this.patterns.push({
            description: `${type} proposals tend to receive support (${(supportRate * 100).toFixed(0)}%)`,
            frequency: stats.total,
            reliability: supportRate,
            examples: this.getExamplesForType(type, 'support'),
          });
        } else if (supportRate < 0.3) {
          this.patterns.push({
            description: `${type} proposals tend to receive opposition (${((1 - supportRate) * 100).toFixed(0)}%)`,
            frequency: stats.total,
            reliability: 1 - supportRate,
            examples: this.getExamplesForType(type, 'oppose'),
          });
        }
      }
    }
  }

  private getExamplesForType(type: string, recommendation: string): string[] {
    const examples: string[] = [];

    for (const memory of this.memories.values()) {
      if (
        memory.proposal.type === type &&
        memory.result.finalRecommendation === recommendation
      ) {
        examples.push(memory.proposal.title);
        if (examples.length >= 3) break;
      }
    }

    return examples;
  }

  private getRelevantPatterns(proposal: ProposalContext): Pattern[] {
    return this.patterns.filter(p =>
      p.description.toLowerCase().includes(proposal.type.toLowerCase())
    );
  }

  private calculateHistoricalAccuracy(): number {
    let correct = 0;
    let total = 0;

    for (const memory of this.memories.values()) {
      if (!memory.actualOutcome) continue;

      total++;
      const { implemented, success } = memory.actualOutcome;
      const recommendation = memory.result.finalRecommendation;

      if (recommendation === 'support' && implemented && success === 'positive') {
        correct++;
      } else if (recommendation === 'oppose' && (!implemented || success === 'negative')) {
        correct++;
      }
    }

    return total > 0 ? correct / total : 0;
  }

  // ===========================================================================
  // Learning & Adaptation
  // ===========================================================================

  /**
   * Generate learning insights from memory
   */
  generateInsights(): string[] {
    const insights: string[] = [];

    // Accuracy insights
    const accuracy = this.calculateHistoricalAccuracy();
    if (accuracy > 0) {
      insights.push(`Overall debate accuracy: ${(accuracy * 100).toFixed(1)}%`);
    }

    // Top agent insights
    const topAgents = this.getTopAgents(3);
    for (const agent of topAgents) {
      insights.push(
        `${agent.agentId}: ${(agent.accuracy * 100).toFixed(0)}% accuracy ` +
        `(${agent.biases.overallBias} bias, calibration: ${(agent.calibration * 100).toFixed(0)}%)`
      );
    }

    // Pattern insights
    for (const pattern of this.patterns) {
      insights.push(pattern.description);
    }

    // Bias warnings
    for (const agent of this.getAllPerformance()) {
      if (agent.biases.averageConfidence > 0.8 && agent.accuracy < 0.6) {
        insights.push(`Warning: ${agent.agentId} is overconfident (${(agent.biases.averageConfidence * 100).toFixed(0)}% confidence, ${(agent.accuracy * 100).toFixed(0)}% accuracy)`);
      }
    }

    return insights;
  }

  /**
   * Suggest agent weight adjustments based on performance
   */
  suggestWeightAdjustments(): Map<string, number> {
    const adjustments = new Map<string, number>();
    const agents = this.getAllPerformance().filter(a => a.totalDebates >= 10);

    if (agents.length === 0) return adjustments;

    const avgAccuracy = agents.reduce((sum, a) => sum + a.accuracy, 0) / agents.length;

    for (const agent of agents) {
      // Adjust weight based on relative accuracy
      const relativePerformance = agent.accuracy / avgAccuracy;
      const adjustment = (relativePerformance - 1) * this.config.learningRate;

      // Clamp adjustment to reasonable bounds
      adjustments.set(agent.agentId, Math.max(-0.1, Math.min(0.1, adjustment)));
    }

    return adjustments;
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Export memory state for persistence
   */
  export(): object {
    return {
      memories: Array.from(this.memories.entries()),
      agentStats: Array.from(this.agentStats.entries()),
      patterns: this.patterns,
      memoryCounter: this.memoryCounter,
      config: this.config,
    };
  }

  /**
   * Import memory state from persistence
   */
  import(data: any): void {
    if (data.memories) {
      this.memories = new Map(data.memories);
    }
    if (data.agentStats) {
      this.agentStats = new Map(data.agentStats);
    }
    if (data.patterns) {
      this.patterns = data.patterns;
    }
    if (data.memoryCounter) {
      this.memoryCounter = data.memoryCounter;
    }

    this.emit('memory_imported', { count: this.memories.size });
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
    this.agentStats.clear();
    this.patterns = [];
    this.memoryCounter = 0;

    this.emit('memory_cleared');
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): object {
    const memoriesWithOutcomes = Array.from(this.memories.values())
      .filter(m => m.actualOutcome).length;

    return {
      totalMemories: this.memories.size,
      memoriesWithOutcomes,
      trackedAgents: this.agentStats.size,
      detectedPatterns: this.patterns.length,
      historicalAccuracy: this.calculateHistoricalAccuracy(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let memoryInstance: AgentMemoryManager | null = null;

export function getAgentMemoryManager(config?: Partial<MemoryConfig>): AgentMemoryManager {
  if (!memoryInstance) {
    memoryInstance = new AgentMemoryManager(config);
  }
  return memoryInstance;
}

export { AgentMemoryManager as default };
