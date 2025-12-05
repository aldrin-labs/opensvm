#!/usr/bin/env bun
/**
 * Autonomous Governance Agent
 *
 * An AI-powered agent that participates in governance by:
 * - Monitoring proposals across all governance systems
 * - Analyzing proposal impact on protocol health metrics
 * - Automatically voting/staking based on predefined strategies
 * - Learning from historical outcomes
 *
 * Designed to increase governance participation and
 * make data-driven decisions aligned with protocol health.
 */

import { EventEmitter } from 'events';
import { ConvictionVotingEngine } from './conviction-voting.js';
import { GaugeController } from './gauge-voting.js';
import { FutarchyGovernance } from './futarchy-governance.js';
import { TimelockController } from './governance-timelock.js';
import {
  LLMProposalAnalyzer,
  ProposalContext,
  LLMAnalysisResult,
  LLMConfig,
} from './llm-proposal-analyzer.js';

// ============================================================================
// Types
// ============================================================================

export type GovernanceSystem = 'conviction' | 'gauge' | 'futarchy' | 'timelock';
export type AgentStrategy = 'conservative' | 'balanced' | 'aggressive' | 'custom';
export type MetricType = 'tvl' | 'volume' | 'fees' | 'users' | 'token_price' | 'apy';

export interface ProtocolMetrics {
  tvl: number;
  volume24h: number;
  fees24h: number;
  activeUsers: number;
  tokenPrice: number;
  avgApy: number;
  timestamp: number;
}

export interface ProposalAnalysis {
  proposalId: string;
  system: GovernanceSystem;
  title: string;
  score: number;                    // -100 to 100 (negative = harmful)
  confidence: number;               // 0 to 1
  recommendation: 'support' | 'oppose' | 'abstain';
  reasoning: string[];
  impactPredictions: Record<MetricType, number>; // Predicted % change
  risks: string[];
  suggestedAction?: {
    type: 'vote' | 'stake' | 'trade';
    amount?: number;
    direction?: 'support' | 'oppose';
  };
}

export interface AgentDecision {
  id: string;
  timestamp: number;
  proposalId: string;
  system: GovernanceSystem;
  analysis: ProposalAnalysis;
  action: {
    type: string;
    params: Record<string, unknown>;
  };
  executed: boolean;
  executedAt?: number;
  outcome?: {
    success: boolean;
    actualImpact?: Record<MetricType, number>;
  };
}

export interface AgentConfig {
  /** Agent strategy preset */
  strategy: AgentStrategy;
  /** Maximum stake/trade per decision */
  maxAmountPerDecision: number;
  /** Minimum confidence to act */
  minConfidence: number;
  /** Minimum score to support */
  minScoreToSupport: number;
  /** Maximum score to oppose */
  maxScoreToOppose: number;
  /** Metric weights for scoring */
  metricWeights: Record<MetricType, number>;
  /** Risk tolerance (0-1) */
  riskTolerance: number;
  /** Enable learning from outcomes */
  enableLearning: boolean;
  /** Auto-execute decisions */
  autoExecute: boolean;
  /** Use LLM for proposal analysis (falls back to keywords if false/unavailable) */
  useLLM: boolean;
  /** LLM configuration */
  llmConfig?: Partial<LLMConfig>;
}

export interface HistoricalOutcome {
  proposalId: string;
  predictedImpact: Record<MetricType, number>;
  actualImpact: Record<MetricType, number>;
  predictionError: number;
  timestamp: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AgentConfig = {
  strategy: 'balanced',
  maxAmountPerDecision: 10000,
  minConfidence: 0.6,
  minScoreToSupport: 20,
  maxScoreToOppose: -20,
  metricWeights: {
    tvl: 0.25,
    volume: 0.15,
    fees: 0.2,
    users: 0.15,
    token_price: 0.15,
    apy: 0.1,
  },
  riskTolerance: 0.5,
  enableLearning: true,
  autoExecute: false,
  useLLM: true,  // Use LLM by default, falls back to keywords
};

// Strategy presets
const STRATEGY_PRESETS: Record<AgentStrategy, Partial<AgentConfig>> = {
  conservative: {
    minConfidence: 0.8,
    minScoreToSupport: 40,
    maxScoreToOppose: -40,
    riskTolerance: 0.2,
    maxAmountPerDecision: 5000,
  },
  balanced: {
    minConfidence: 0.6,
    minScoreToSupport: 20,
    maxScoreToOppose: -20,
    riskTolerance: 0.5,
    maxAmountPerDecision: 10000,
  },
  aggressive: {
    minConfidence: 0.4,
    minScoreToSupport: 10,
    maxScoreToOppose: -10,
    riskTolerance: 0.8,
    maxAmountPerDecision: 25000,
  },
  custom: {},
};

// ============================================================================
// Proposal Analyzer (LLM-Powered with Keyword Fallback)
// ============================================================================

class ProposalAnalyzer {
  private config: AgentConfig;
  private llmAnalyzer?: LLMProposalAnalyzer;
  private historicalOutcomes: HistoricalOutcome[] = [];
  private predictionAdjustment = 0;

  constructor(config: AgentConfig) {
    this.config = config;

    // Initialize LLM analyzer if enabled
    if (config.useLLM) {
      this.llmAnalyzer = new LLMProposalAnalyzer(config.llmConfig);
    }
  }

  /**
   * Analyze a proposal using LLM (async) or keywords (sync fallback)
   */
  async analyzeAsync(
    proposalId: string,
    system: GovernanceSystem,
    title: string,
    description: string,
    currentMetrics: ProtocolMetrics,
    proposalData?: Record<string, unknown>
  ): Promise<ProposalAnalysis> {
    // Try LLM analysis if available
    if (this.llmAnalyzer && this.config.useLLM) {
      try {
        const context: ProposalContext = {
          title,
          description,
          type: this.mapSystemToType(system, proposalData),
          requestedAmount: proposalData?.requestedAmount as number | undefined,
          currentMetrics: {
            tvl: currentMetrics.tvl,
            volume24h: currentMetrics.volume24h,
            fees24h: currentMetrics.fees24h,
            activeUsers: currentMetrics.activeUsers,
            tokenPrice: currentMetrics.tokenPrice,
            avgApy: currentMetrics.avgApy,
          },
        };

        const llmResult = await this.llmAnalyzer.analyze(context);
        return this.convertLLMResult(proposalId, system, title, llmResult);
      } catch (error) {
        // Fall through to keyword analysis
        console.error('[ProposalAnalyzer] LLM analysis failed, using keywords:', error);
      }
    }

    // Fallback to keyword analysis
    return this.analyzeKeywords(proposalId, system, title, description, currentMetrics, proposalData);
  }

  /**
   * Synchronous keyword-based analysis (for backwards compatibility)
   */
  analyze(
    proposalId: string,
    system: GovernanceSystem,
    title: string,
    description: string,
    currentMetrics: ProtocolMetrics,
    proposalData?: Record<string, unknown>
  ): ProposalAnalysis {
    return this.analyzeKeywords(proposalId, system, title, description, currentMetrics, proposalData);
  }

  private mapSystemToType(system: GovernanceSystem, data?: Record<string, unknown>): 'funding' | 'parameter' | 'signal' | 'gauge' | 'emergency' {
    if (data?.requestedAmount) return 'funding';
    if (system === 'gauge') return 'gauge';
    if (data?.parameterKey) return 'parameter';
    return 'signal';
  }

  private convertLLMResult(
    proposalId: string,
    system: GovernanceSystem,
    title: string,
    llmResult: LLMAnalysisResult
  ): ProposalAnalysis {
    // Convert LLM result to ProposalAnalysis format
    const impactPredictions: Record<MetricType, number> = {
      tvl: llmResult.impactPredictions.tvl.change,
      volume: llmResult.impactPredictions.volume.change,
      fees: llmResult.impactPredictions.fees.change,
      users: llmResult.impactPredictions.users.change,
      token_price: llmResult.impactPredictions.token_price.change,
      apy: llmResult.impactPredictions.apy.change,
    };

    // Calculate score from impact predictions
    let score = 0;
    for (const [metric, change] of Object.entries(impactPredictions)) {
      const weight = this.config.metricWeights[metric as MetricType] || 0;
      score += change * weight * 10;
    }
    score -= llmResult.risks.length * 5 * (1 - this.config.riskTolerance);
    score = Math.max(-100, Math.min(100, score + this.predictionAdjustment));

    const reasoning = [
      llmResult.summary,
      llmResult.recommendationReasoning,
      ...llmResult.risks.slice(0, 2).map(r => `Risk: ${r.description}`),
    ];

    const analysis: ProposalAnalysis = {
      proposalId,
      system,
      title,
      score,
      confidence: llmResult.overallConfidence,
      recommendation: llmResult.recommendation,
      reasoning,
      impactPredictions,
      risks: llmResult.risks.map(r => r.description),
    };

    if (llmResult.recommendation !== 'abstain') {
      analysis.suggestedAction = this.suggestAction(system, llmResult.recommendation, llmResult.overallConfidence);
    }

    return analysis;
  }

  private analyzeKeywords(
    proposalId: string,
    system: GovernanceSystem,
    title: string,
    description: string,
    currentMetrics: ProtocolMetrics,
    proposalData?: Record<string, unknown>
  ): ProposalAnalysis {
    const impactPredictions = this.predictImpactKeywords(title, description, proposalData);
    const risks = this.identifyRisksKeywords(title, description, proposalData);
    const score = this.calculateScore(impactPredictions, risks);
    const confidence = this.calculateConfidence(title, description, impactPredictions);
    const reasoning = this.generateReasoning(impactPredictions, risks, score);
    const recommendation = this.getRecommendation(score, confidence);

    const analysis: ProposalAnalysis = {
      proposalId,
      system,
      title,
      score: score + this.predictionAdjustment,
      confidence,
      recommendation,
      reasoning,
      impactPredictions,
      risks,
    };

    if (recommendation !== 'abstain') {
      analysis.suggestedAction = this.suggestAction(system, recommendation, confidence);
    }

    return analysis;
  }

  private predictImpactKeywords(
    title: string,
    description: string,
    data?: Record<string, unknown>
  ): Record<MetricType, number> {
    const predictions: Record<MetricType, number> = {
      tvl: 0, volume: 0, fees: 0, users: 0, token_price: 0, apy: 0,
    };

    const text = `${title} ${description}`.toLowerCase();

    // TVL
    if (text.includes('liquidity') || text.includes('pool')) {
      predictions.tvl += text.includes('add') || text.includes('increase') ? 5 : -3;
    }
    if (text.includes('reward') || text.includes('incentive')) predictions.tvl += 3;
    if (text.includes('withdraw') || text.includes('remove')) predictions.tvl -= 5;

    // Volume
    if (text.includes('trading') || text.includes('swap')) predictions.volume += 5;

    // Fees
    if (text.includes('fee')) {
      if (text.includes('increase')) predictions.fees += 5;
      if (text.includes('reduce') || text.includes('decrease')) predictions.fees -= 5;
    }

    // Users
    if (text.includes('user') || text.includes('community')) predictions.users += 3;
    if (text.includes('onboard') || text.includes('growth')) predictions.users += 5;

    // Token price
    if (text.includes('burn') || text.includes('buyback')) predictions.token_price += 5;
    if (text.includes('emission') || text.includes('mint')) predictions.token_price -= 3;

    // APY
    if (text.includes('yield') || text.includes('apy')) {
      predictions.apy += text.includes('boost') || text.includes('increase') ? 5 : -3;
    }

    // Funding impact
    if (data?.requestedAmount && (data.requestedAmount as number) > 100000) {
      predictions.tvl -= 2;
      predictions.token_price -= 1;
    }

    return predictions;
  }

  private identifyRisksKeywords(
    title: string,
    description: string,
    data?: Record<string, unknown>
  ): string[] {
    const risks: string[] = [];
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('emergency') || text.includes('urgent')) risks.push('Rush decision');
    if (text.includes('upgrade') || text.includes('migration')) risks.push('Smart contract risk');
    if (text.includes('treasury') && data?.requestedAmount && (data.requestedAmount as number) > 50000) {
      risks.push(`Large treasury spend: ${data.requestedAmount}`);
    }
    if (text.includes('parameter') || text.includes('change')) risks.push('Unintended consequences');
    if (text.includes('new') && text.includes('pool')) risks.push('Liquidity fragmentation');
    if (text.includes('emission') || text.includes('inflation')) risks.push('Token dilution');

    return risks;
  }

  private calculateScore(impact: Record<MetricType, number>, risks: string[]): number {
    let score = 0;
    for (const [metric, change] of Object.entries(impact)) {
      const weight = this.config.metricWeights[metric as MetricType] || 0;
      score += change * weight * 10;
    }
    score -= risks.length * 5 * (1 - this.config.riskTolerance);
    return Math.max(-100, Math.min(100, score));
  }

  private calculateConfidence(title: string, description: string, impact: Record<MetricType, number>): number {
    let confidence = 0.5;
    if (description.length > 200) confidence += 0.1;
    if (description.length > 500) confidence += 0.1;
    if (Object.values(impact).some(v => Math.abs(v) > 3)) confidence += 0.15;
    if (this.historicalOutcomes.length > 10) {
      const avgError = this.historicalOutcomes.slice(-10).reduce((sum, o) => sum + o.predictionError, 0) / 10;
      confidence -= avgError * 0.1;
    }
    return Math.max(0, Math.min(1, confidence));
  }

  private generateReasoning(impact: Record<MetricType, number>, risks: string[], score: number): string[] {
    const reasons: string[] = [];
    for (const [metric, change] of Object.entries(impact)) {
      if (Math.abs(change) > 2) {
        reasons.push(`Predicted ${Math.abs(change).toFixed(1)}% ${change > 0 ? 'increase' : 'decrease'} in ${metric}`);
      }
    }
    if (risks.length > 0) reasons.push(`${risks.length} risk(s) identified`);
    if (score > 30) reasons.push('Strong positive impact expected');
    else if (score > 0) reasons.push('Mildly positive impact');
    else if (score > -30) reasons.push('Mildly negative impact');
    else reasons.push('Strong negative impact expected');
    return reasons;
  }

  private getRecommendation(score: number, confidence: number): 'support' | 'oppose' | 'abstain' {
    if (confidence < this.config.minConfidence) return 'abstain';
    if (score >= this.config.minScoreToSupport) return 'support';
    if (score <= this.config.maxScoreToOppose) return 'oppose';
    return 'abstain';
  }

  private suggestAction(
    system: GovernanceSystem,
    recommendation: 'support' | 'oppose',
    confidence: number
  ): { type: 'vote' | 'stake' | 'trade'; amount?: number; direction?: 'support' | 'oppose' } {
    const amount = Math.round(this.config.maxAmountPerDecision * confidence);
    switch (system) {
      case 'conviction': return { type: 'stake', amount, direction: recommendation };
      case 'gauge': return { type: 'vote', amount, direction: recommendation };
      case 'futarchy': return { type: 'trade', amount, direction: recommendation };
      default: return { type: 'vote', direction: recommendation };
    }
  }

  recordOutcome(outcome: HistoricalOutcome): void {
    this.historicalOutcomes.push(outcome);
    if (this.config.enableLearning && this.historicalOutcomes.length >= 5) {
      const recentErrors = this.historicalOutcomes.slice(-5).map(o => {
        const predicted = Object.values(o.predictedImpact).reduce((a, b) => a + b, 0);
        const actual = Object.values(o.actualImpact).reduce((a, b) => a + b, 0);
        return actual - predicted;
      });
      this.predictionAdjustment = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length;
    }
  }

  /** Get LLM analyzer stats if available */
  getLLMStats() {
    return this.llmAnalyzer?.getStats();
  }
}

// ============================================================================
// Autonomous Governance Agent
// ============================================================================

export class AutonomousGovernanceAgent extends EventEmitter {
  private config: AgentConfig;
  private analyzer: ProposalAnalyzer;
  private decisions: AgentDecision[] = [];
  private decisionCounter = 0;
  private isRunning = false;
  private balance = 100000; // Agent's voting/staking budget

  // Connected governance systems
  private convictionEngine?: ConvictionVotingEngine;
  private gaugeController?: GaugeController;
  private futarchyGovernance?: FutarchyGovernance;
  private timelockController?: TimelockController;

  constructor(config: Partial<AgentConfig> = {}) {
    super();

    // Apply strategy preset
    const strategy = config.strategy || 'balanced';
    const strategyConfig = STRATEGY_PRESETS[strategy];

    this.config = {
      ...DEFAULT_CONFIG,
      ...strategyConfig,
      ...config,
    };

    this.analyzer = new ProposalAnalyzer(this.config);
  }

  // --------------------------------------------------------------------------
  // System Connections
  // --------------------------------------------------------------------------

  connectConviction(engine: ConvictionVotingEngine): void {
    this.convictionEngine = engine;
    this.emit('system_connected', { system: 'conviction' });
  }

  connectGauge(controller: GaugeController): void {
    this.gaugeController = controller;
    this.emit('system_connected', { system: 'gauge' });
  }

  connectFutarchy(governance: FutarchyGovernance): void {
    this.futarchyGovernance = governance;
    this.emit('system_connected', { system: 'futarchy' });
  }

  connectTimelock(controller: TimelockController): void {
    this.timelockController = controller;
    this.emit('system_connected', { system: 'timelock' });
  }

  // --------------------------------------------------------------------------
  // Monitoring & Analysis
  // --------------------------------------------------------------------------

  /**
   * Scan all connected systems for new proposals
   */
  async scanProposals(currentMetrics: ProtocolMetrics): Promise<ProposalAnalysis[]> {
    const analyses: ProposalAnalysis[] = [];

    // Scan conviction voting
    if (this.convictionEngine) {
      const proposals = this.convictionEngine.getActiveProposals();
      for (const proposal of proposals) {
        const analysis = this.analyzer.analyze(
          proposal.id,
          'conviction',
          proposal.title,
          proposal.description,
          currentMetrics,
          { requestedAmount: proposal.requestedAmount }
        );
        analyses.push(analysis);
      }
    }

    // Scan gauge voting
    if (this.gaugeController) {
      const gauges = this.gaugeController.getActiveGauges();
      for (const gauge of gauges) {
        const analysis = this.analyzer.analyze(
          gauge.id,
          'gauge',
          gauge.name,
          `Gauge for pool ${gauge.poolId}`,
          currentMetrics
        );
        analyses.push(analysis);
      }
    }

    // Scan futarchy proposals
    if (this.futarchyGovernance) {
      const proposals = this.futarchyGovernance.getActiveProposals();
      for (const proposal of proposals) {
        const analysis = this.analyzer.analyze(
          proposal.id,
          'futarchy',
          proposal.title,
          proposal.description,
          currentMetrics,
          proposal.executionData
        );
        analyses.push(analysis);
      }
    }

    // Scan timelock actions
    if (this.timelockController) {
      const pending = this.timelockController.getPendingActions();
      for (const action of pending) {
        const analysis = this.analyzer.analyze(
          action.id,
          'timelock',
          action.description,
          `${action.actionType} action on ${action.target}`,
          currentMetrics,
          action.data
        );
        analyses.push(analysis);
      }
    }

    this.emit('scan_complete', {
      proposalsFound: analyses.length,
      recommendations: {
        support: analyses.filter(a => a.recommendation === 'support').length,
        oppose: analyses.filter(a => a.recommendation === 'oppose').length,
        abstain: analyses.filter(a => a.recommendation === 'abstain').length,
      },
    });

    return analyses;
  }

  /**
   * Generate and optionally execute decisions
   */
  async processProposals(currentMetrics: ProtocolMetrics): Promise<AgentDecision[]> {
    const analyses = await this.scanProposals(currentMetrics);
    const newDecisions: AgentDecision[] = [];

    for (const analysis of analyses) {
      // Skip if already decided on this proposal
      if (this.decisions.some(d => d.proposalId === analysis.proposalId)) {
        continue;
      }

      // Skip abstentions
      if (analysis.recommendation === 'abstain') {
        continue;
      }

      // Check budget
      const amount = analysis.suggestedAction?.amount || 0;
      if (amount > this.balance) {
        continue;
      }

      this.decisionCounter++;
      const decision: AgentDecision = {
        id: `DECISION-${this.decisionCounter}`,
        timestamp: Date.now(),
        proposalId: analysis.proposalId,
        system: analysis.system,
        analysis,
        action: {
          type: analysis.suggestedAction?.type || 'vote',
          params: {
            amount: analysis.suggestedAction?.amount,
            direction: analysis.suggestedAction?.direction,
          },
        },
        executed: false,
      };

      this.decisions.push(decision);
      newDecisions.push(decision);

      this.emit('decision_made', {
        decisionId: decision.id,
        proposalId: analysis.proposalId,
        recommendation: analysis.recommendation,
        score: analysis.score,
        confidence: analysis.confidence,
      });

      // Auto-execute if enabled
      if (this.config.autoExecute) {
        await this.executeDecision(decision.id);
      }
    }

    return newDecisions;
  }

  /**
   * Execute a pending decision
   */
  async executeDecision(decisionId: string): Promise<boolean> {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) throw new Error('Decision not found');

    if (decision.executed) {
      throw new Error('Decision already executed');
    }

    const { analysis, action } = decision;
    const amount = (action.params.amount as number) || 0;
    const direction = action.params.direction as 'support' | 'oppose';

    try {
      switch (analysis.system) {
        case 'conviction':
          if (this.convictionEngine && direction === 'support' && amount > 0) {
            this.convictionEngine.stakeVote(analysis.proposalId, 'agent', amount);
            this.balance -= amount;
          }
          break;

        case 'gauge':
          if (this.gaugeController) {
            const weight = direction === 'support' ? 50 : 0;
            this.gaugeController.vote('agent', analysis.proposalId, weight);
          }
          break;

        case 'futarchy':
          if (this.futarchyGovernance && amount > 0) {
            if (direction === 'support') {
              this.futarchyGovernance.buyYes(analysis.proposalId, 'pass', 'agent', amount);
            } else {
              this.futarchyGovernance.buyNo(analysis.proposalId, 'pass', 'agent', amount);
            }
            this.balance -= amount;
          }
          break;

        case 'timelock':
          // Timelock requires multi-sig, agent can only signal support
          break;
      }

      decision.executed = true;
      decision.executedAt = Date.now();

      this.emit('decision_executed', {
        decisionId,
        proposalId: analysis.proposalId,
        action: action.type,
        amount,
        direction,
      });

      return true;
    } catch (error) {
      this.emit('decision_failed', {
        decisionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Continuous Operation
  // --------------------------------------------------------------------------

  /**
   * Start continuous monitoring
   */
  start(metricsProvider: () => ProtocolMetrics, intervalMs: number = 60000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('agent_started');

    const run = async () => {
      if (!this.isRunning) return;

      try {
        const metrics = metricsProvider();
        await this.processProposals(metrics);
      } catch (error) {
        this.emit('agent_error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (this.isRunning) {
        setTimeout(run, intervalMs);
      }
    };

    run();
  }

  /**
   * Stop continuous monitoring
   */
  stop(): void {
    this.isRunning = false;
    this.emit('agent_stopped');
  }

  // --------------------------------------------------------------------------
  // Learning
  // --------------------------------------------------------------------------

  /**
   * Record actual outcome for learning
   */
  recordOutcome(
    proposalId: string,
    actualImpact: Record<MetricType, number>
  ): void {
    const decision = this.decisions.find(d => d.proposalId === proposalId);
    if (!decision) return;

    decision.outcome = {
      success: true,
      actualImpact,
    };

    // Calculate prediction error
    const predicted = decision.analysis.impactPredictions;
    let totalError = 0;
    let count = 0;

    for (const [metric, predictedValue] of Object.entries(predicted)) {
      const actualValue = actualImpact[metric as MetricType] || 0;
      totalError += Math.abs(actualValue - predictedValue);
      count++;
    }

    const avgError = count > 0 ? totalError / count : 0;

    // Feed back to analyzer for learning
    this.analyzer.recordOutcome({
      proposalId,
      predictedImpact: predicted,
      actualImpact,
      predictionError: avgError,
      timestamp: Date.now(),
    });

    this.emit('outcome_recorded', {
      proposalId,
      predictionError: avgError,
      recommendation: decision.analysis.recommendation,
    });
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get all decisions
   */
  getDecisions(): AgentDecision[] {
    return [...this.decisions];
  }

  /**
   * Get pending (unexecuted) decisions
   */
  getPendingDecisions(): AgentDecision[] {
    return this.decisions.filter(d => !d.executed);
  }

  /**
   * Get agent statistics
   */
  getStats(): {
    totalDecisions: number;
    executedDecisions: number;
    pendingDecisions: number;
    supportDecisions: number;
    opposeDecisions: number;
    balance: number;
    avgConfidence: number;
    isRunning: boolean;
  } {
    const executed = this.decisions.filter(d => d.executed);
    const support = this.decisions.filter(d => d.analysis.recommendation === 'support');
    const oppose = this.decisions.filter(d => d.analysis.recommendation === 'oppose');

    const avgConfidence = this.decisions.length > 0
      ? this.decisions.reduce((sum, d) => sum + d.analysis.confidence, 0) / this.decisions.length
      : 0;

    return {
      totalDecisions: this.decisions.length,
      executedDecisions: executed.length,
      pendingDecisions: this.decisions.filter(d => !d.executed).length,
      supportDecisions: support.length,
      opposeDecisions: oppose.length,
      balance: this.balance,
      avgConfidence,
      isRunning: this.isRunning,
    };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update agent balance
   */
  setBalance(balance: number): void {
    this.balance = balance;
  }
}

// ============================================================================
// Exports
// ============================================================================

let agentInstance: AutonomousGovernanceAgent | null = null;

export function getAutonomousGovernanceAgent(
  config?: Partial<AgentConfig>
): AutonomousGovernanceAgent {
  if (!agentInstance) {
    agentInstance = new AutonomousGovernanceAgent(config);
  }
  return agentInstance;
}

export default {
  AutonomousGovernanceAgent,
  getAutonomousGovernanceAgent,
  DEFAULT_CONFIG,
  STRATEGY_PRESETS,
};
