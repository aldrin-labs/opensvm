#!/usr/bin/env bun
/**
 * Self-Improving Debate Agent
 *
 * An AI agent that monitors its own accuracy and dynamically adjusts:
 * - System prompts based on what reasoning patterns work
 * - Weight allocation based on performance
 * - Strategy selection based on proposal types
 * - Confidence calibration based on historical accuracy
 *
 * The agent evolves its reasoning approach based on outcomes.
 */

import { EventEmitter } from 'events';
import {
  MultiAgentDebateEngine,
  DebateAgent,
  DebateResult,
  DebateConfig,
} from './multi-agent-debate.js';
import {
  AgentMemoryManager,
  AgentPerformance,
} from './agent-memory.js';
import { ProposalContext } from './llm-proposal-analyzer.js';
import { MemoryPersistence, getMemoryPersistence } from './memory-persistence.js';

// ============================================================================
// Types
// ============================================================================

export interface PromptModification {
  id: string;
  timestamp: number;
  trigger: string; // What caused this modification
  originalPrompt: string;
  modifiedPrompt: string;
  hypothesis: string; // Why we think this will help
  testCount: number;
  successRate: number;
  active: boolean;
}

export interface StrategyProfile {
  proposalType: string;
  successfulPatterns: string[];
  failedPatterns: string[];
  recommendedApproach: string;
  confidenceAdjustment: number;
}

export interface SelfImprovementConfig {
  minSampleSize: number; // Min debates before making adjustments
  confidenceThreshold: number; // Min confidence to apply changes
  maxPromptModifications: number; // Max modifications to track
  learningRate: number; // How aggressively to adjust
  experimentRatio: number; // % of debates to run experiments
  autoCalibrate: boolean; // Auto-adjust confidence
  persistChanges: boolean; // Save improvements to disk
}

export interface AgentEvolution {
  generation: number;
  createdAt: number;
  changes: string[];
  performance: {
    accuracy: number;
    calibration: number;
    debates: number;
  };
  promptModifications: PromptModification[];
  strategyProfiles: StrategyProfile[];
}

// ============================================================================
// Self-Improving Agent
// ============================================================================

export class SelfImprovingDebateAgent extends EventEmitter {
  private engine: MultiAgentDebateEngine;
  private memory: AgentMemoryManager;
  private persistence: MemoryPersistence | null = null;
  private config: SelfImprovementConfig;

  // Evolution state
  private currentGeneration = 1;
  private promptModifications: Map<string, PromptModification[]> = new Map();
  private strategyProfiles: Map<string, StrategyProfile> = new Map();
  private basePrompts: Map<string, string> = new Map();
  private evolutionHistory: AgentEvolution[] = [];

  // Tracking
  private experimentQueue: Array<{
    debateId: string;
    agentId: string;
    modification: PromptModification;
  }> = [];

  constructor(
    engine: MultiAgentDebateEngine,
    config: Partial<SelfImprovementConfig> = {}
  ) {
    super();
    this.engine = engine;
    this.memory = engine.getMemory() || new AgentMemoryManager();
    this.config = {
      minSampleSize: config.minSampleSize ?? 10,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      maxPromptModifications: config.maxPromptModifications ?? 10,
      learningRate: config.learningRate ?? 0.1,
      experimentRatio: config.experimentRatio ?? 0.2,
      autoCalibrate: config.autoCalibrate ?? true,
      persistChanges: config.persistChanges ?? true,
    };

    // Store base prompts
    for (const agent of engine.getAgents()) {
      this.basePrompts.set(agent.id, agent.systemPrompt);
      this.promptModifications.set(agent.id, []);
    }

    // Initialize persistence
    if (this.config.persistChanges) {
      try {
        this.persistence = getMemoryPersistence({
          path: process.cwd() + '/data/self-improving-agent.json',
        });
        this.loadState();
      } catch {
        console.error('Failed to initialize persistence');
      }
    }

    // Subscribe to engine events
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.engine.on('debate_completed', (data) => {
      this.onDebateCompleted(data);
    });

    this.engine.on('memory_stored', (data) => {
      this.onMemoryStored(data);
    });
  }

  // ===========================================================================
  // Core Improvement Logic
  // ===========================================================================

  /**
   * Analyze performance and generate improvements
   */
  async analyzeAndImprove(): Promise<{
    promptChanges: number;
    strategyUpdates: number;
    weightAdjustments: number;
  }> {
    const stats = {
      promptChanges: 0,
      strategyUpdates: 0,
      weightAdjustments: 0,
    };

    // Need minimum sample size
    const memoryStats = this.memory.getStats() as any;
    if (memoryStats.totalMemories < this.config.minSampleSize) {
      this.emit('insufficient_data', { required: this.config.minSampleSize, current: memoryStats.totalMemories });
      return stats;
    }

    // Analyze each agent
    const performances = this.memory.getAllPerformance();

    for (const perf of performances) {
      // Analyze accuracy patterns
      const patterns = this.analyzeAgentPatterns(perf);

      // Generate prompt modifications
      if (patterns.weaknesses.length > 0) {
        const mods = this.generatePromptModifications(perf.agentId, patterns);
        stats.promptChanges += mods.length;
      }

      // Update strategy profiles
      if (patterns.typePerformance) {
        stats.strategyUpdates += this.updateStrategyProfiles(patterns.typePerformance);
      }

      // Calibrate confidence
      if (this.config.autoCalibrate) {
        this.calibrateConfidence(perf);
      }
    }

    // Adjust weights based on performance
    const weightChanges = this.adjustWeights();
    stats.weightAdjustments = weightChanges;

    // Save state
    if (this.config.persistChanges && this.persistence) {
      this.saveState();
    }

    // Record evolution
    this.recordEvolution(stats);

    this.emit('improvement_complete', stats);
    return stats;
  }

  private analyzeAgentPatterns(perf: AgentPerformance): {
    weaknesses: string[];
    strengths: string[];
    typePerformance: Map<string, { correct: number; total: number }>;
  } {
    const weaknesses: string[] = [];
    const strengths: string[] = [];
    const typePerformance = new Map<string, { correct: number; total: number }>();

    // Analyze by proposal type
    for (const type of perf.strengthAreas) {
      strengths.push(`Strong on ${type} proposals`);
      if (!typePerformance.has(type)) {
        typePerformance.set(type, { correct: 1, total: 1 });
      }
    }

    for (const type of perf.weaknessAreas) {
      weaknesses.push(`Weak on ${type} proposals`);
      const existing = typePerformance.get(type) || { correct: 0, total: 0 };
      existing.total++;
      typePerformance.set(type, existing);
    }

    // Analyze bias
    if (perf.biases.overallBias === 'optimistic' && perf.accuracy < 0.6) {
      weaknesses.push('Over-optimistic - recommend more conservative stance');
    } else if (perf.biases.overallBias === 'pessimistic' && perf.accuracy < 0.6) {
      weaknesses.push('Over-pessimistic - missing opportunities');
    }

    // Analyze calibration
    if (perf.calibration < 0.5) {
      weaknesses.push('Poor calibration - confidence does not match accuracy');
    }

    return { weaknesses, strengths, typePerformance };
  }

  private generatePromptModifications(
    agentId: string,
    patterns: { weaknesses: string[]; strengths: string[] }
  ): PromptModification[] {
    const modifications: PromptModification[] = [];
    const existingMods = this.promptModifications.get(agentId) || [];
    const basePrompt = this.basePrompts.get(agentId) || '';

    for (const weakness of patterns.weaknesses) {
      // Check if we already have a modification for this
      if (existingMods.some(m => m.trigger === weakness && m.active)) {
        continue;
      }

      // Generate modification based on weakness type
      let addition = '';
      let hypothesis = '';

      if (weakness.includes('Over-optimistic')) {
        addition = '\n\nIMPORTANT: Based on historical data, you tend to be over-optimistic. Apply extra scrutiny to potential risks and downsides. Reduce confidence on proposals with limited track record.';
        hypothesis = 'Adding caution will improve accuracy on risky proposals';
      } else if (weakness.includes('Over-pessimistic')) {
        addition = '\n\nNOTE: Historical analysis shows you may be missing opportunities. While maintaining skepticism, also consider upside scenarios and innovative benefits.';
        hypothesis = 'Balancing pessimism will capture more opportunities';
      } else if (weakness.includes('Poor calibration')) {
        addition = '\n\nCALIBRATION NOTE: Your confidence levels do not match actual accuracy. Reduce confidence by 20% on uncertain proposals. Only use high confidence (>0.8) when you have strong evidence.';
        hypothesis = 'Explicit calibration guidance will improve confidence accuracy';
      } else if (weakness.includes('Weak on')) {
        const type = weakness.match(/Weak on (\w+)/)?.[1] || 'unknown';
        addition = `\n\nWARNING: You have lower accuracy on ${type} proposals. For these types, gather more evidence before forming conclusions and consider consulting historical patterns.`;
        hypothesis = `Type-specific guidance will improve ${type} accuracy`;
      }

      if (addition) {
        const mod: PromptModification = {
          id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          trigger: weakness,
          originalPrompt: basePrompt,
          modifiedPrompt: basePrompt + addition,
          hypothesis,
          testCount: 0,
          successRate: 0,
          active: false, // Start inactive until tested
        };

        modifications.push(mod);
        existingMods.push(mod);

        // Limit total modifications
        while (existingMods.length > this.config.maxPromptModifications) {
          existingMods.shift();
        }

        this.promptModifications.set(agentId, existingMods);
      }
    }

    return modifications;
  }

  private updateStrategyProfiles(
    typePerformance: Map<string, { correct: number; total: number }>
  ): number {
    let updates = 0;

    for (const [type, stats] of typePerformance) {
      let profile = this.strategyProfiles.get(type);

      if (!profile) {
        profile = {
          proposalType: type,
          successfulPatterns: [],
          failedPatterns: [],
          recommendedApproach: 'default',
          confidenceAdjustment: 0,
        };
        this.strategyProfiles.set(type, profile);
      }

      // Calculate success rate
      const successRate = stats.total > 0 ? stats.correct / stats.total : 0.5;

      // Adjust confidence based on performance
      if (successRate > 0.7) {
        profile.confidenceAdjustment = 0.1;
        profile.recommendedApproach = 'confident';
      } else if (successRate < 0.4) {
        profile.confidenceAdjustment = -0.2;
        profile.recommendedApproach = 'cautious';
      } else {
        profile.confidenceAdjustment = 0;
        profile.recommendedApproach = 'balanced';
      }

      updates++;
    }

    return updates;
  }

  private calibrateConfidence(perf: AgentPerformance): void {
    // Find the agent and adjust its confidence reporting
    const agent = this.engine.getAgents().find(a => a.id === perf.agentId);
    if (!agent) return;

    const calibrationGap = perf.biases.averageConfidence - perf.accuracy;

    if (Math.abs(calibrationGap) > 0.15) {
      // Significant miscalibration
      const adjustment = -calibrationGap * this.config.learningRate;

      // Add calibration note to prompt
      const mods = this.promptModifications.get(agent.id) || [];
      const calibrationMod = mods.find(m => m.trigger === 'calibration');

      if (!calibrationMod) {
        const basePrompt = this.basePrompts.get(agent.id) || agent.systemPrompt;
        const note = `\n\nCALIBRATION: Adjust your confidence by ${(adjustment * 100).toFixed(0)}% based on historical performance.`;

        mods.push({
          id: `cal_${Date.now()}`,
          timestamp: Date.now(),
          trigger: 'calibration',
          originalPrompt: basePrompt,
          modifiedPrompt: basePrompt + note,
          hypothesis: 'Explicit calibration will improve confidence accuracy',
          testCount: 0,
          successRate: 0,
          active: true,
        });

        this.promptModifications.set(agent.id, mods);
      }
    }
  }

  private adjustWeights(): number {
    const adjustments = this.memory.suggestWeightAdjustments();
    let changes = 0;

    for (const [agentId, adjustment] of adjustments) {
      const agent = this.engine.getAgents().find(a => a.id === agentId);
      if (agent) {
        const oldWeight = agent.weight;
        agent.weight = Math.max(0.05, Math.min(0.4, agent.weight + adjustment));

        if (agent.weight !== oldWeight) {
          changes++;
          this.emit('weight_adjusted', {
            agentId,
            oldWeight,
            newWeight: agent.weight,
            adjustment,
          });
        }
      }
    }

    return changes;
  }

  // ===========================================================================
  // Experimentation
  // ===========================================================================

  /**
   * Run an experiment with a prompt modification
   */
  async runExperiment(agentId: string, modificationId: string): Promise<boolean> {
    const mods = this.promptModifications.get(agentId);
    const mod = mods?.find(m => m.id === modificationId);

    if (!mod) return false;

    // Temporarily apply modification
    const agent = this.engine.getAgents().find(a => a.id === agentId);
    if (!agent) return false;

    const originalPrompt = agent.systemPrompt;
    agent.systemPrompt = mod.modifiedPrompt;
    mod.active = true;

    this.emit('experiment_started', { agentId, modificationId });

    // Queue for evaluation
    this.experimentQueue.push({
      debateId: '', // Will be set when debate starts
      agentId,
      modification: mod,
    });

    return true;
  }

  /**
   * Apply the best-performing modifications permanently
   */
  applyBestModifications(): number {
    let applied = 0;

    for (const [agentId, mods] of this.promptModifications) {
      const agent = this.engine.getAgents().find(a => a.id === agentId);
      if (!agent) continue;

      // Find best performing modification
      const successfulMods = mods.filter(
        m => m.testCount >= 5 && m.successRate >= this.config.confidenceThreshold
      );

      if (successfulMods.length > 0) {
        // Apply the best one
        successfulMods.sort((a, b) => b.successRate - a.successRate);
        const best = successfulMods[0];

        agent.systemPrompt = best.modifiedPrompt;
        this.basePrompts.set(agentId, best.modifiedPrompt);
        best.active = true;

        // Deactivate others
        for (const mod of mods) {
          if (mod.id !== best.id) mod.active = false;
        }

        applied++;
        this.emit('modification_applied', {
          agentId,
          modificationId: best.id,
          successRate: best.successRate,
        });
      }
    }

    return applied;
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private onDebateCompleted(data: { debateId: string; recommendation: string }): void {
    // Check if this was an experiment
    const experimentIdx = this.experimentQueue.findIndex(e => e.debateId === data.debateId);

    if (experimentIdx >= 0) {
      const experiment = this.experimentQueue[experimentIdx];
      experiment.modification.testCount++;
      this.experimentQueue.splice(experimentIdx, 1);
    }
  }

  private onMemoryStored(data: { memoryId: string }): void {
    // Trigger analysis periodically
    const memoryStats = this.memory.getStats() as any;
    if (memoryStats.memoriesWithOutcomes > 0 &&
        memoryStats.memoriesWithOutcomes % 10 === 0) {
      this.analyzeAndImprove();
    }
  }

  // ===========================================================================
  // Evolution Tracking
  // ===========================================================================

  private recordEvolution(changes: {
    promptChanges: number;
    strategyUpdates: number;
    weightAdjustments: number;
  }): void {
    const allPerf = this.memory.getAllPerformance();
    const avgAccuracy = allPerf.length > 0
      ? allPerf.reduce((sum, p) => sum + p.accuracy, 0) / allPerf.length
      : 0;
    const avgCalibration = allPerf.length > 0
      ? allPerf.reduce((sum, p) => sum + p.calibration, 0) / allPerf.length
      : 0;
    const totalDebates = allPerf.reduce((sum, p) => sum + p.totalDebates, 0);

    const evolution: AgentEvolution = {
      generation: this.currentGeneration++,
      createdAt: Date.now(),
      changes: [
        `${changes.promptChanges} prompt modifications`,
        `${changes.strategyUpdates} strategy updates`,
        `${changes.weightAdjustments} weight adjustments`,
      ],
      performance: {
        accuracy: avgAccuracy,
        calibration: avgCalibration,
        debates: totalDebates,
      },
      promptModifications: Array.from(this.promptModifications.values()).flat(),
      strategyProfiles: Array.from(this.strategyProfiles.values()),
    };

    this.evolutionHistory.push(evolution);

    // Keep last 50 evolutions
    if (this.evolutionHistory.length > 50) {
      this.evolutionHistory.shift();
    }

    this.emit('evolution_recorded', evolution);
  }

  /**
   * Get evolution history
   */
  getEvolutionHistory(): AgentEvolution[] {
    return [...this.evolutionHistory];
  }

  /**
   * Get current generation stats
   */
  getCurrentGeneration(): AgentEvolution | null {
    return this.evolutionHistory[this.evolutionHistory.length - 1] || null;
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  private saveState(): void {
    if (!this.persistence) return;

    const state = {
      generation: this.currentGeneration,
      promptModifications: Object.fromEntries(this.promptModifications),
      strategyProfiles: Object.fromEntries(this.strategyProfiles),
      basePrompts: Object.fromEntries(this.basePrompts),
      evolutionHistory: this.evolutionHistory,
    };

    this.persistence.save(state);
  }

  private loadState(): void {
    if (!this.persistence) return;

    const state = this.persistence.load() as any;
    if (!state) return;

    if (state.generation) this.currentGeneration = state.generation;
    if (state.promptModifications) {
      this.promptModifications = new Map(Object.entries(state.promptModifications));
    }
    if (state.strategyProfiles) {
      this.strategyProfiles = new Map(Object.entries(state.strategyProfiles));
    }
    if (state.basePrompts) {
      this.basePrompts = new Map(Object.entries(state.basePrompts));
    }
    if (state.evolutionHistory) {
      this.evolutionHistory = state.evolutionHistory;
    }

    this.emit('state_loaded', { generation: this.currentGeneration });
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): object {
    return {
      generation: this.currentGeneration,
      totalModifications: Array.from(this.promptModifications.values())
        .reduce((sum, mods) => sum + mods.length, 0),
      activeModifications: Array.from(this.promptModifications.values())
        .reduce((sum, mods) => sum + mods.filter(m => m.active).length, 0),
      strategyProfiles: this.strategyProfiles.size,
      evolutionCount: this.evolutionHistory.length,
      pendingExperiments: this.experimentQueue.length,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentInstance: SelfImprovingDebateAgent | null = null;

export function getSelfImprovingAgent(
  engine?: MultiAgentDebateEngine,
  config?: Partial<SelfImprovementConfig>
): SelfImprovingDebateAgent {
  if (!agentInstance && engine) {
    agentInstance = new SelfImprovingDebateAgent(engine, config);
  }
  if (!agentInstance) {
    throw new Error('Must provide engine on first call');
  }
  return agentInstance;
}

export default SelfImprovingDebateAgent;
