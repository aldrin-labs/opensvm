#!/usr/bin/env bun
/**
 * Learning Federation
 *
 * Enables multiple debate engines to share memories and collectively learn.
 * Features:
 * - Distributed memory sharing
 * - Consensus on learning updates
 * - Federated weight averaging
 * - Privacy-preserving learning (share insights, not raw data)
 */

import { EventEmitter } from 'events';
import {
  MultiAgentDebateEngine,
  DebateResult,
} from './multi-agent-debate.js';
import {
  AgentMemoryManager,
  AgentPerformance,
  Pattern,
} from './agent-memory.js';
import { ProposalContext } from './llm-proposal-analyzer.js';

// ============================================================================
// Types
// ============================================================================

export interface FederationNode {
  id: string;
  name: string;
  engine: MultiAgentDebateEngine;
  memory: AgentMemoryManager;
  joinedAt: number;
  lastSync: number;
  contribution: number; // How much this node has contributed
  reliability: number; // Historical reliability 0-1
}

export interface SharedInsight {
  id: string;
  sourceNode: string;
  type: 'pattern' | 'performance' | 'weight' | 'strategy';
  content: object;
  confidence: number;
  votes: Map<string, boolean>; // nodeId -> approve
  approved: boolean;
  createdAt: number;
}

export interface WeightUpdate {
  agentId: string;
  suggestedWeight: number;
  sourceNodes: string[];
  confidence: number;
}

export interface FederationConfig {
  minNodes: number; // Minimum nodes to form consensus
  consensusThreshold: number; // % of nodes needed to approve
  syncIntervalMs: number; // How often to sync
  maxInsightsPerSync: number; // Limit insights per sync
  privacyLevel: 'full' | 'partial' | 'minimal'; // How much to share
  reputationDecay: number; // How fast reliability decays
}

export interface SyncResult {
  insightsShared: number;
  insightsReceived: number;
  weightsUpdated: number;
  patternsLearned: number;
  nodesParticipated: number;
}

// ============================================================================
// Learning Federation
// ============================================================================

export class LearningFederation extends EventEmitter {
  private nodes: Map<string, FederationNode> = new Map();
  private sharedInsights: Map<string, SharedInsight> = new Map();
  private pendingUpdates: WeightUpdate[] = [];
  private config: FederationConfig;
  private syncTimer?: ReturnType<typeof setInterval>;
  private insightCounter = 0;

  constructor(config: Partial<FederationConfig> = {}) {
    super();
    this.config = {
      minNodes: config.minNodes ?? 2,
      consensusThreshold: config.consensusThreshold ?? 0.66,
      syncIntervalMs: config.syncIntervalMs ?? 60000, // 1 minute
      maxInsightsPerSync: config.maxInsightsPerSync ?? 10,
      privacyLevel: config.privacyLevel ?? 'partial',
      reputationDecay: config.reputationDecay ?? 0.99,
    };
  }

  // ===========================================================================
  // Node Management
  // ===========================================================================

  /**
   * Join a debate engine to the federation
   */
  join(
    id: string,
    name: string,
    engine: MultiAgentDebateEngine
  ): boolean {
    if (this.nodes.has(id)) {
      return false;
    }

    const memory = engine.getMemory();
    if (!memory) {
      console.error(`Node ${id} has no memory manager`);
      return false;
    }

    const node: FederationNode = {
      id,
      name,
      engine,
      memory,
      joinedAt: Date.now(),
      lastSync: Date.now(),
      contribution: 0,
      reliability: 1.0,
    };

    this.nodes.set(id, node);

    this.emit('node_joined', { id, name, totalNodes: this.nodes.size });

    // Start sync timer if we have enough nodes
    if (this.nodes.size >= this.config.minNodes && !this.syncTimer) {
      this.startSync();
    }

    return true;
  }

  /**
   * Remove a node from the federation
   */
  leave(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    this.nodes.delete(nodeId);

    // Remove pending votes from this node
    for (const insight of this.sharedInsights.values()) {
      insight.votes.delete(nodeId);
    }

    this.emit('node_left', { id: nodeId, totalNodes: this.nodes.size });

    // Stop sync if below threshold
    if (this.nodes.size < this.config.minNodes && this.syncTimer) {
      this.stopSync();
    }

    return true;
  }

  /**
   * Get all nodes
   */
  getNodes(): FederationNode[] {
    return Array.from(this.nodes.values());
  }

  // ===========================================================================
  // Insight Sharing
  // ===========================================================================

  /**
   * Share an insight from a node
   */
  shareInsight(
    sourceNodeId: string,
    type: SharedInsight['type'],
    content: object,
    confidence: number
  ): string | null {
    const node = this.nodes.get(sourceNodeId);
    if (!node) return null;

    this.insightCounter++;
    const id = `insight_${this.insightCounter}`;

    const insight: SharedInsight = {
      id,
      sourceNode: sourceNodeId,
      type,
      content,
      confidence: confidence * node.reliability, // Weighted by reputation
      votes: new Map([[sourceNodeId, true]]), // Auto-approve by source
      approved: false,
      createdAt: Date.now(),
    };

    this.sharedInsights.set(id, insight);
    node.contribution++;

    this.emit('insight_shared', {
      insightId: id,
      sourceNode: sourceNodeId,
      type,
    });

    // Check if already has consensus
    this.checkConsensus(id);

    return id;
  }

  /**
   * Vote on an insight
   */
  voteInsight(nodeId: string, insightId: string, approve: boolean): boolean {
    const node = this.nodes.get(nodeId);
    const insight = this.sharedInsights.get(insightId);

    if (!node || !insight) return false;
    if (insight.approved) return false; // Already approved

    insight.votes.set(nodeId, approve);

    this.emit('insight_voted', { insightId, nodeId, approve });

    this.checkConsensus(insightId);

    return true;
  }

  private checkConsensus(insightId: string): void {
    const insight = this.sharedInsights.get(insightId);
    if (!insight || insight.approved) return;

    const totalNodes = this.nodes.size;
    const approvals = Array.from(insight.votes.values()).filter(v => v).length;
    const threshold = Math.ceil(totalNodes * this.config.consensusThreshold);

    if (approvals >= threshold) {
      insight.approved = true;
      this.applyInsight(insight);

      this.emit('insight_approved', {
        insightId,
        approvals,
        threshold,
      });
    }
  }

  private applyInsight(insight: SharedInsight): void {
    // Apply to all nodes based on type
    for (const node of this.nodes.values()) {
      if (node.id === insight.sourceNode) continue; // Skip source

      switch (insight.type) {
        case 'pattern':
          this.applyPatternInsight(node, insight.content as Pattern);
          break;
        case 'performance':
          this.applyPerformanceInsight(node, insight.content as AgentPerformance);
          break;
        case 'weight':
          this.applyWeightInsight(node, insight.content as WeightUpdate);
          break;
        case 'strategy':
          this.applyStrategyInsight(node, insight.content);
          break;
      }
    }
  }

  private applyPatternInsight(node: FederationNode, pattern: Pattern): void {
    // Add pattern to node's memory context
    // This is done at query time, so we just store it
    this.emit('pattern_applied', { nodeId: node.id, pattern: pattern.description });
  }

  private applyPerformanceInsight(node: FederationNode, perf: AgentPerformance): void {
    // Use as reference for calibration
    const agent = node.engine.getAgents().find(a => a.id === perf.agentId);
    if (agent && perf.accuracy > 0.7) {
      // Learn from high-performing agents
      this.emit('performance_applied', {
        nodeId: node.id,
        agentId: perf.agentId,
        referenceAccuracy: perf.accuracy,
      });
    }
  }

  private applyWeightInsight(node: FederationNode, update: WeightUpdate): void {
    const agent = node.engine.getAgents().find(a => a.id === update.agentId);
    if (agent) {
      // Blend with current weight
      const blendFactor = 0.3; // 30% federation influence
      agent.weight = agent.weight * (1 - blendFactor) + update.suggestedWeight * blendFactor;

      this.emit('weight_applied', {
        nodeId: node.id,
        agentId: update.agentId,
        newWeight: agent.weight,
      });
    }
  }

  private applyStrategyInsight(node: FederationNode, strategy: any): void {
    // Store for reference during debates
    this.emit('strategy_applied', { nodeId: node.id, strategy });
  }

  // ===========================================================================
  // Synchronization
  // ===========================================================================

  /**
   * Start periodic synchronization
   */
  startSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.synchronize();
    }, this.config.syncIntervalMs);

    this.emit('sync_started');
  }

  /**
   * Stop synchronization
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      this.emit('sync_stopped');
    }
  }

  /**
   * Perform synchronization
   */
  async synchronize(): Promise<SyncResult> {
    const result: SyncResult = {
      insightsShared: 0,
      insightsReceived: 0,
      weightsUpdated: 0,
      patternsLearned: 0,
      nodesParticipated: 0,
    };

    if (this.nodes.size < this.config.minNodes) {
      return result;
    }

    // Collect insights from each node
    for (const node of this.nodes.values()) {
      const nodeInsights = this.collectNodeInsights(node);
      result.insightsShared += nodeInsights;
      result.nodesParticipated++;
      node.lastSync = Date.now();
    }

    // Aggregate weight suggestions
    const weightUpdates = this.aggregateWeights();
    result.weightsUpdated = weightUpdates.length;

    // Apply pending updates
    for (const update of weightUpdates) {
      this.shareInsight(
        update.sourceNodes[0],
        'weight',
        update,
        update.confidence
      );
    }

    // Decay node reliability
    for (const node of this.nodes.values()) {
      node.reliability *= this.config.reputationDecay;
    }

    // Clean old insights
    this.cleanOldInsights();

    this.emit('sync_complete', result);
    return result;
  }

  private collectNodeInsights(node: FederationNode): number {
    let shared = 0;
    const memory = node.memory;

    // Share patterns based on privacy level
    if (this.config.privacyLevel !== 'minimal') {
      const data = memory.export() as any;
      const patterns = data.patterns || [];

      for (const pattern of patterns.slice(0, 3)) {
        this.shareInsight(node.id, 'pattern', {
          description: pattern.description,
          frequency: pattern.frequency,
          reliability: pattern.reliability,
        }, 0.7);
        shared++;
      }
    }

    // Share agent performance
    if (this.config.privacyLevel === 'full') {
      const performances = memory.getAllPerformance();
      for (const perf of performances) {
        if (perf.accuracy > 0.6 && perf.totalDebates >= 10) {
          this.shareInsight(node.id, 'performance', {
            agentId: perf.agentId,
            accuracy: perf.accuracy,
            calibration: perf.calibration,
            biases: perf.biases,
          }, perf.accuracy);
          shared++;
        }
      }
    }

    return Math.min(shared, this.config.maxInsightsPerSync);
  }

  private aggregateWeights(): WeightUpdate[] {
    const updates: WeightUpdate[] = [];
    const weightSuggestions: Map<string, Array<{
      weight: number;
      confidence: number;
      source: string;
    }>> = new Map();

    // Collect suggestions from all nodes
    for (const node of this.nodes.values()) {
      const adjustments = node.memory.suggestWeightAdjustments();

      for (const [agentId, adjustment] of adjustments) {
        const agent = node.engine.getAgents().find(a => a.id === agentId);
        if (!agent) continue;

        if (!weightSuggestions.has(agentId)) {
          weightSuggestions.set(agentId, []);
        }

        weightSuggestions.get(agentId)!.push({
          weight: agent.weight + adjustment,
          confidence: node.reliability,
          source: node.id,
        });
      }
    }

    // Aggregate by weighted average
    for (const [agentId, suggestions] of weightSuggestions) {
      if (suggestions.length < 2) continue; // Need multiple sources

      const totalConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0);
      const avgWeight = suggestions.reduce(
        (sum, s) => sum + s.weight * s.confidence,
        0
      ) / totalConfidence;

      updates.push({
        agentId,
        suggestedWeight: avgWeight,
        sourceNodes: suggestions.map(s => s.source),
        confidence: totalConfidence / suggestions.length,
      });
    }

    return updates;
  }

  private cleanOldInsights(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    for (const [id, insight] of this.sharedInsights) {
      if (now - insight.createdAt > maxAge) {
        this.sharedInsights.delete(id);
      }
    }
  }

  // ===========================================================================
  // Federated Learning
  // ===========================================================================

  /**
   * Run federated training round
   */
  async federatedTraining(): Promise<{
    nodesParticipated: number;
    updatesApplied: number;
    consensusReached: number;
  }> {
    const result = {
      nodesParticipated: 0,
      updatesApplied: 0,
      consensusReached: 0,
    };

    if (this.nodes.size < this.config.minNodes) {
      return result;
    }

    // Phase 1: Collect local updates
    const localUpdates: Map<string, Map<string, number>> = new Map();

    for (const node of this.nodes.values()) {
      const adjustments = node.memory.suggestWeightAdjustments();
      if (adjustments.size > 0) {
        localUpdates.set(node.id, adjustments);
        result.nodesParticipated++;
      }
    }

    // Phase 2: Aggregate updates (federated averaging)
    const aggregated = this.federatedAverage(localUpdates);

    // Phase 3: Apply to all nodes
    for (const [agentId, newWeight] of aggregated) {
      for (const node of this.nodes.values()) {
        const agent = node.engine.getAgents().find(a => a.id === agentId);
        if (agent) {
          agent.weight = newWeight;
          result.updatesApplied++;
        }
      }
      result.consensusReached++;
    }

    // Boost reliability for participating nodes
    for (const nodeId of localUpdates.keys()) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.reliability = Math.min(1.0, node.reliability + 0.01);
      }
    }

    this.emit('federated_training_complete', result);
    return result;
  }

  private federatedAverage(
    updates: Map<string, Map<string, number>>
  ): Map<string, number> {
    const result = new Map<string, number>();
    const agentSums: Map<string, { sum: number; count: number; weight: number }> = new Map();

    // Aggregate weighted by node reliability
    for (const [nodeId, adjustments] of updates) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      for (const [agentId, adjustment] of adjustments) {
        if (!agentSums.has(agentId)) {
          agentSums.set(agentId, { sum: 0, count: 0, weight: 0 });
        }

        const entry = agentSums.get(agentId)!;
        entry.sum += adjustment * node.reliability;
        entry.weight += node.reliability;
        entry.count++;
      }
    }

    // Calculate weighted average
    for (const [agentId, { sum, weight }] of agentSums) {
      if (weight > 0) {
        result.set(agentId, sum / weight);
      }
    }

    return result;
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): object {
    const approvedInsights = Array.from(this.sharedInsights.values())
      .filter(i => i.approved).length;

    return {
      totalNodes: this.nodes.size,
      activeNodes: Array.from(this.nodes.values())
        .filter(n => Date.now() - n.lastSync < this.config.syncIntervalMs * 2).length,
      totalInsights: this.sharedInsights.size,
      approvedInsights,
      pendingInsights: this.sharedInsights.size - approvedInsights,
      isSyncing: !!this.syncTimer,
      averageReliability: this.nodes.size > 0
        ? Array.from(this.nodes.values())
            .reduce((sum, n) => sum + n.reliability, 0) / this.nodes.size
        : 0,
    };
  }

  /**
   * Get node leaderboard
   */
  getLeaderboard(): Array<{
    id: string;
    name: string;
    contribution: number;
    reliability: number;
  }> {
    return Array.from(this.nodes.values())
      .map(n => ({
        id: n.id,
        name: n.name,
        contribution: n.contribution,
        reliability: n.reliability,
      }))
      .sort((a, b) => b.contribution - a.contribution);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let federationInstance: LearningFederation | null = null;

export function getLearningFederation(config?: Partial<FederationConfig>): LearningFederation {
  if (!federationInstance) {
    federationInstance = new LearningFederation(config);
  }
  return federationInstance;
}

export default LearningFederation;
