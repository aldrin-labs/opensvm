#!/usr/bin/env bun
/**
 * Agent Evolution Systems
 *
 * Features:
 * 1. Prompt DNA - Encode agent strategies as genetic code that mutates
 * 2. Agent Dreams - Simulate debates overnight for learning
 * 3. Collective Unconscious - Shared memory layer for pattern recognition
 */

import { EventEmitter } from 'events';

// ============================================================================
// Common Types
// ============================================================================

export interface AgentGenome {
  id: string;
  agentId: string;
  generation: number;
  genes: Gene[];
  fitness: number;
  parentIds: string[];
  mutations: Mutation[];
  createdAt: number;
}

export interface Gene {
  id: string;
  trait: string;
  value: number | string | boolean;
  dominance: number; // 0-1, how strongly this gene expresses
  mutationRate: number; // Probability of mutation
}

export interface Mutation {
  geneId: string;
  originalValue: any;
  newValue: any;
  timestamp: number;
  cause: 'random' | 'crossover' | 'environmental' | 'learned';
}

// ============================================================================
// 1. Prompt DNA System
// ============================================================================

export interface PromptDNA {
  agentId: string;
  sequence: DNASequence[];
  expressedTraits: Map<string, any>;
  generation: number;
  lineage: string[]; // Parent agent IDs
}

export interface DNASequence {
  position: number;
  codon: string; // 3-letter code representing a trait
  trait: PromptTrait;
  active: boolean;
  mutationHistory: Array<{ from: string; to: string; gen: number }>;
}

export interface PromptTrait {
  name: string;
  category: 'personality' | 'strategy' | 'bias' | 'expertise' | 'style';
  expression: string; // How this manifests in prompts
  strength: number; // 0-1
}

// Standard codons for prompt traits
export const PROMPT_CODONS: Record<string, PromptTrait> = {
  'AGR': { name: 'aggressive', category: 'personality', expression: 'Use strong, decisive language', strength: 0.8 },
  'CAU': { name: 'cautious', category: 'personality', expression: 'Consider all risks before recommending', strength: 0.7 },
  'OPT': { name: 'optimistic', category: 'bias', expression: 'Focus on potential upside', strength: 0.6 },
  'PES': { name: 'pessimistic', category: 'bias', expression: 'Focus on potential downside', strength: 0.6 },
  'TEC': { name: 'technical', category: 'expertise', expression: 'Analyze smart contract implications', strength: 0.9 },
  'ECO': { name: 'economic', category: 'expertise', expression: 'Focus on tokenomics and incentives', strength: 0.9 },
  'SOC': { name: 'social', category: 'expertise', expression: 'Consider community impact', strength: 0.7 },
  'CON': { name: 'contrarian', category: 'strategy', expression: 'Challenge consensus positions', strength: 0.8 },
  'COL': { name: 'collaborative', category: 'strategy', expression: 'Seek common ground', strength: 0.6 },
  'DAT': { name: 'data_driven', category: 'style', expression: 'Support claims with numbers', strength: 0.9 },
  'NAR': { name: 'narrative', category: 'style', expression: 'Use storytelling to explain', strength: 0.5 },
  'HIS': { name: 'historical', category: 'expertise', expression: 'Reference past governance decisions', strength: 0.7 },
};

export class PromptDNASystem extends EventEmitter {
  private genomes: Map<string, AgentGenome> = new Map();
  private dna: Map<string, PromptDNA> = new Map();
  private mutationRate: number = 0.05;
  private crossoverRate: number = 0.7;

  constructor(config: { mutationRate?: number; crossoverRate?: number } = {}) {
    super();
    this.mutationRate = config.mutationRate ?? 0.05;
    this.crossoverRate = config.crossoverRate ?? 0.7;
  }

  /**
   * Create initial DNA for an agent
   */
  createDNA(agentId: string, traitCodes: string[]): PromptDNA {
    const sequence: DNASequence[] = traitCodes.map((codon, index) => ({
      position: index,
      codon,
      trait: PROMPT_CODONS[codon] || {
        name: 'unknown',
        category: 'personality',
        expression: '',
        strength: 0.5,
      },
      active: true,
      mutationHistory: [],
    }));

    const expressedTraits = new Map<string, any>();
    for (const seq of sequence) {
      if (seq.active && seq.trait.name !== 'unknown') {
        expressedTraits.set(seq.trait.name, seq.trait.strength);
      }
    }

    const dna: PromptDNA = {
      agentId,
      sequence,
      expressedTraits,
      generation: 1,
      lineage: [],
    };

    this.dna.set(agentId, dna);
    this.emit('dna_created', { agentId, traits: Array.from(expressedTraits.keys()) });
    return dna;
  }

  /**
   * Mutate an agent's DNA
   */
  mutate(agentId: string): { mutated: boolean; changes: string[] } {
    const dna = this.dna.get(agentId);
    if (!dna) return { mutated: false, changes: [] };

    const changes: string[] = [];
    const availableCodons = Object.keys(PROMPT_CODONS);

    for (const seq of dna.sequence) {
      if (Math.random() < this.mutationRate) {
        const oldCodon = seq.codon;
        const newCodon = availableCodons[Math.floor(Math.random() * availableCodons.length)];

        seq.mutationHistory.push({
          from: oldCodon,
          to: newCodon,
          gen: dna.generation,
        });

        seq.codon = newCodon;
        seq.trait = PROMPT_CODONS[newCodon];
        changes.push(`${oldCodon} -> ${newCodon} (${seq.trait.name})`);
      }
    }

    if (changes.length > 0) {
      dna.generation++;
      this.updateExpressedTraits(agentId);
      this.emit('mutation', { agentId, changes, generation: dna.generation });
    }

    return { mutated: changes.length > 0, changes };
  }

  /**
   * Crossover two agents to create offspring
   */
  crossover(parent1Id: string, parent2Id: string, childId: string): PromptDNA | null {
    const dna1 = this.dna.get(parent1Id);
    const dna2 = this.dna.get(parent2Id);
    if (!dna1 || !dna2) return null;

    // Use shorter sequence length
    const length = Math.min(dna1.sequence.length, dna2.sequence.length);
    const crossoverPoint = Math.floor(Math.random() * length);

    const childSequence: DNASequence[] = [];

    for (let i = 0; i < length; i++) {
      const sourceSeq = i < crossoverPoint ? dna1.sequence[i] : dna2.sequence[i];
      childSequence.push({
        position: i,
        codon: sourceSeq.codon,
        trait: { ...sourceSeq.trait },
        active: sourceSeq.active,
        mutationHistory: [{
          from: 'inherited',
          to: sourceSeq.codon,
          gen: 0,
        }],
      });
    }

    const childDNA: PromptDNA = {
      agentId: childId,
      sequence: childSequence,
      expressedTraits: new Map(),
      generation: Math.max(dna1.generation, dna2.generation) + 1,
      lineage: [parent1Id, parent2Id, ...dna1.lineage.slice(0, 2), ...dna2.lineage.slice(0, 2)],
    };

    this.dna.set(childId, childDNA);
    this.updateExpressedTraits(childId);

    this.emit('crossover', {
      parent1Id,
      parent2Id,
      childId,
      crossoverPoint,
      generation: childDNA.generation,
    });

    return childDNA;
  }

  private updateExpressedTraits(agentId: string): void {
    const dna = this.dna.get(agentId);
    if (!dna) return;

    dna.expressedTraits.clear();
    for (const seq of dna.sequence) {
      if (seq.active && PROMPT_CODONS[seq.codon]) {
        dna.expressedTraits.set(seq.trait.name, seq.trait.strength);
      }
    }
  }

  /**
   * Generate prompt modifications based on DNA
   */
  generatePromptModifiers(agentId: string): string[] {
    const dna = this.dna.get(agentId);
    if (!dna) return [];

    const modifiers: string[] = [];
    for (const seq of dna.sequence) {
      if (seq.active && seq.trait.expression) {
        modifiers.push(seq.trait.expression);
      }
    }

    return modifiers;
  }

  /**
   * Get DNA for an agent
   */
  getDNA(agentId: string): PromptDNA | undefined {
    return this.dna.get(agentId);
  }

  /**
   * Get DNA sequence as string
   */
  getSequenceString(agentId: string): string {
    const dna = this.dna.get(agentId);
    if (!dna) return '';
    return dna.sequence.map(s => s.codon).join('-');
  }

  /**
   * Calculate genetic similarity between two agents
   */
  calculateSimilarity(agent1Id: string, agent2Id: string): number {
    const dna1 = this.dna.get(agent1Id);
    const dna2 = this.dna.get(agent2Id);
    if (!dna1 || !dna2) return 0;

    const length = Math.min(dna1.sequence.length, dna2.sequence.length);
    let matches = 0;

    for (let i = 0; i < length; i++) {
      if (dna1.sequence[i].codon === dna2.sequence[i].codon) {
        matches++;
      }
    }

    return length > 0 ? matches / length : 0;
  }
}

// ============================================================================
// 2. Agent Dreams System
// ============================================================================

export interface Dream {
  id: string;
  agentId: string;
  scenario: DreamScenario;
  startTime: number;
  endTime?: number;
  insights: DreamInsight[];
  emotionalState: EmotionalState;
}

export interface DreamScenario {
  type: 'debate_replay' | 'hypothetical' | 'nightmare' | 'wish_fulfillment';
  proposalId?: string;
  description: string;
  participants: string[];
  constraints: string[];
}

export interface DreamInsight {
  type: 'pattern' | 'weakness' | 'opportunity' | 'warning';
  content: string;
  confidence: number;
  applicableTo: string[]; // Proposal types or scenarios
}

export interface EmotionalState {
  confidence: number;
  anxiety: number;
  excitement: number;
  confusion: number;
}

export class AgentDreams extends EventEmitter {
  private dreams: Map<string, Dream[]> = new Map();
  private activeDreams: Map<string, Dream> = new Map();
  private learnedPatterns: Map<string, DreamInsight[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Start a dream sequence for an agent
   */
  startDream(agentId: string, scenario: DreamScenario): Dream {
    const dream: Dream = {
      id: `dream_${agentId}_${Date.now()}`,
      agentId,
      scenario,
      startTime: Date.now(),
      insights: [],
      emotionalState: {
        confidence: 0.5,
        anxiety: 0.3,
        excitement: 0.4,
        confusion: 0.2,
      },
    };

    this.activeDreams.set(agentId, dream);

    if (!this.dreams.has(agentId)) {
      this.dreams.set(agentId, []);
    }
    this.dreams.get(agentId)!.push(dream);

    this.emit('dream_started', { agentId, dreamId: dream.id, type: scenario.type });
    return dream;
  }

  /**
   * Process dream events (called during dream simulation)
   */
  processDreamEvent(
    agentId: string,
    event: { type: string; outcome: 'positive' | 'negative' | 'neutral'; data: any }
  ): void {
    const dream = this.activeDreams.get(agentId);
    if (!dream) return;

    // Update emotional state based on event
    switch (event.outcome) {
      case 'positive':
        dream.emotionalState.confidence = Math.min(1, dream.emotionalState.confidence + 0.1);
        dream.emotionalState.excitement = Math.min(1, dream.emotionalState.excitement + 0.15);
        dream.emotionalState.anxiety = Math.max(0, dream.emotionalState.anxiety - 0.05);
        break;
      case 'negative':
        dream.emotionalState.confidence = Math.max(0, dream.emotionalState.confidence - 0.1);
        dream.emotionalState.anxiety = Math.min(1, dream.emotionalState.anxiety + 0.15);
        dream.emotionalState.confusion = Math.min(1, dream.emotionalState.confusion + 0.1);
        break;
    }

    // Extract insights based on event type
    if (event.type === 'debate_outcome' && event.data.pattern) {
      dream.insights.push({
        type: 'pattern',
        content: event.data.pattern,
        confidence: dream.emotionalState.confidence,
        applicableTo: [event.data.proposalType || 'all'],
      });
    }

    if (dream.emotionalState.anxiety > 0.7) {
      dream.insights.push({
        type: 'warning',
        content: `High anxiety scenario: ${event.data.description || 'unknown'}`,
        confidence: dream.emotionalState.anxiety,
        applicableTo: ['high_risk'],
      });
    }

    this.emit('dream_event', { agentId, event, emotionalState: dream.emotionalState });
  }

  /**
   * End a dream and consolidate learnings
   */
  endDream(agentId: string): { insights: DreamInsight[]; emotionalResolution: EmotionalState } {
    const dream = this.activeDreams.get(agentId);
    if (!dream) {
      return { insights: [], emotionalResolution: { confidence: 0.5, anxiety: 0.3, excitement: 0.4, confusion: 0.2 } };
    }

    dream.endTime = Date.now();
    this.activeDreams.delete(agentId);

    // Consolidate insights
    const uniqueInsights = this.consolidateInsights(dream.insights);

    // Store learned patterns
    if (!this.learnedPatterns.has(agentId)) {
      this.learnedPatterns.set(agentId, []);
    }
    this.learnedPatterns.get(agentId)!.push(...uniqueInsights);

    // Emotional resolution (normalize toward baseline)
    const resolution: EmotionalState = {
      confidence: (dream.emotionalState.confidence + 0.5) / 2,
      anxiety: dream.emotionalState.anxiety * 0.3,
      excitement: dream.emotionalState.excitement * 0.5,
      confusion: dream.emotionalState.confusion * 0.2,
    };

    this.emit('dream_ended', {
      agentId,
      dreamId: dream.id,
      duration: dream.endTime - dream.startTime,
      insightsGained: uniqueInsights.length,
    });

    return { insights: uniqueInsights, emotionalResolution: resolution };
  }

  private consolidateInsights(insights: DreamInsight[]): DreamInsight[] {
    // Deduplicate and merge similar insights
    const consolidated: DreamInsight[] = [];
    const seen = new Set<string>();

    for (const insight of insights) {
      const key = `${insight.type}_${insight.content.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        consolidated.push(insight);
      }
    }

    // Sort by confidence
    return consolidated.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate a nightmare scenario (worst case simulation)
   */
  generateNightmare(agentId: string, fears: string[]): DreamScenario {
    return {
      type: 'nightmare',
      description: `Worst-case scenario simulation involving: ${fears.join(', ')}`,
      participants: [agentId, 'adversary', 'whale', 'exploit'],
      constraints: ['limited_time', 'incomplete_information', 'hostile_environment'],
    };
  }

  /**
   * Generate a wish fulfillment scenario (best case)
   */
  generateWishFulfillment(agentId: string, goals: string[]): DreamScenario {
    return {
      type: 'wish_fulfillment',
      description: `Best-case scenario achieving: ${goals.join(', ')}`,
      participants: [agentId, 'supporter', 'community'],
      constraints: [],
    };
  }

  /**
   * Run an overnight dream cycle
   */
  async runDreamCycle(
    agentId: string,
    scenarios: DreamScenario[],
    durationMs: number = 1000
  ): Promise<DreamInsight[]> {
    const allInsights: DreamInsight[] = [];

    for (const scenario of scenarios) {
      this.startDream(agentId, scenario);

      // Simulate dream events
      const eventCount = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < eventCount; i++) {
        await new Promise(resolve => setTimeout(resolve, durationMs / eventCount));

        const outcomes: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
        this.processDreamEvent(agentId, {
          type: 'debate_outcome',
          outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
          data: {
            pattern: `Pattern discovered in ${scenario.type}`,
            proposalType: 'general',
            description: scenario.description,
          },
        });
      }

      const result = this.endDream(agentId);
      allInsights.push(...result.insights);
    }

    return allInsights;
  }

  /**
   * Get learned patterns for an agent
   */
  getLearnedPatterns(agentId: string): DreamInsight[] {
    return this.learnedPatterns.get(agentId) || [];
  }

  /**
   * Get dream history for an agent
   */
  getDreamHistory(agentId: string): Dream[] {
    return this.dreams.get(agentId) || [];
  }
}

// ============================================================================
// 3. Collective Unconscious
// ============================================================================

export interface CollectiveMemory {
  id: string;
  pattern: string;
  frequency: number;
  confidence: number;
  contributors: string[];
  context: string[];
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

export interface Archetype {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  responses: string[];
  emotionalTone: EmotionalState;
}

export class CollectiveUnconscious extends EventEmitter {
  private memories: Map<string, CollectiveMemory> = new Map();
  private archetypes: Map<string, Archetype> = new Map();
  private agentContributions: Map<string, string[]> = new Map(); // agentId -> memoryIds

  constructor() {
    super();
    this.initializeArchetypes();
  }

  private initializeArchetypes(): void {
    const archetypes: Archetype[] = [
      {
        id: 'hero',
        name: 'The Hero',
        description: 'Takes bold action to protect the community',
        triggers: ['exploit', 'attack', 'emergency', 'crisis'],
        responses: ['Recommend immediate protective action', 'Prioritize community safety'],
        emotionalTone: { confidence: 0.9, anxiety: 0.2, excitement: 0.7, confusion: 0.1 },
      },
      {
        id: 'sage',
        name: 'The Sage',
        description: 'Seeks truth through analysis and wisdom',
        triggers: ['complex', 'novel', 'precedent', 'historical'],
        responses: ['Analyze deeply before recommending', 'Reference historical patterns'],
        emotionalTone: { confidence: 0.8, anxiety: 0.1, excitement: 0.3, confusion: 0.1 },
      },
      {
        id: 'trickster',
        name: 'The Trickster',
        description: 'Challenges assumptions and status quo',
        triggers: ['consensus', 'obvious', 'certain', 'unanimous'],
        responses: ['Question the consensus', 'Find the hidden flaw'],
        emotionalTone: { confidence: 0.6, anxiety: 0.3, excitement: 0.8, confusion: 0.2 },
      },
      {
        id: 'caregiver',
        name: 'The Caregiver',
        description: 'Protects the vulnerable and ensures fairness',
        triggers: ['small_holders', 'newcomers', 'fairness', 'distribution'],
        responses: ['Advocate for equitable outcomes', 'Protect minority interests'],
        emotionalTone: { confidence: 0.7, anxiety: 0.4, excitement: 0.3, confusion: 0.1 },
      },
      {
        id: 'shadow',
        name: 'The Shadow',
        description: 'Represents hidden dangers and suppressed risks',
        triggers: ['hidden', 'downplayed', 'ignored', 'risk'],
        responses: ['Surface the hidden dangers', 'Confront uncomfortable truths'],
        emotionalTone: { confidence: 0.5, anxiety: 0.7, excitement: 0.2, confusion: 0.4 },
      },
    ];

    for (const archetype of archetypes) {
      this.archetypes.set(archetype.id, archetype);
    }
  }

  /**
   * Contribute a memory to the collective
   */
  contributeMemory(
    agentId: string,
    pattern: string,
    context: string[],
    confidence: number
  ): CollectiveMemory {
    // Check if similar memory exists
    const existing = this.findSimilarMemory(pattern);

    if (existing) {
      // Strengthen existing memory
      existing.frequency++;
      existing.confidence = (existing.confidence * 0.8) + (confidence * 0.2);
      if (!existing.contributors.includes(agentId)) {
        existing.contributors.push(agentId);
      }
      existing.context = [...new Set([...existing.context, ...context])];
      existing.lastAccessed = Date.now();

      this.emit('memory_strengthened', { memoryId: existing.id, agentId });
      return existing;
    }

    // Create new memory
    const memory: CollectiveMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern,
      frequency: 1,
      confidence,
      contributors: [agentId],
      context,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
    };

    this.memories.set(memory.id, memory);

    // Track agent contribution
    if (!this.agentContributions.has(agentId)) {
      this.agentContributions.set(agentId, []);
    }
    this.agentContributions.get(agentId)!.push(memory.id);

    this.emit('memory_created', { memoryId: memory.id, agentId, pattern });
    return memory;
  }

  private findSimilarMemory(pattern: string): CollectiveMemory | null {
    const patternWords = pattern.toLowerCase().split(/\s+/);

    for (const memory of this.memories.values()) {
      const memoryWords = memory.pattern.toLowerCase().split(/\s+/);
      const overlap = patternWords.filter(w => memoryWords.includes(w)).length;
      const similarity = overlap / Math.max(patternWords.length, memoryWords.length);

      if (similarity > 0.7) {
        return memory;
      }
    }

    return null;
  }

  /**
   * Query the collective unconscious for relevant memories
   */
  query(context: string[], limit = 10): CollectiveMemory[] {
    const contextWords = context.join(' ').toLowerCase().split(/\s+/);
    const scored: Array<{ memory: CollectiveMemory; score: number }> = [];

    for (const memory of this.memories.values()) {
      let score = 0;

      // Context match
      const memoryContextWords = memory.context.join(' ').toLowerCase().split(/\s+/);
      for (const word of contextWords) {
        if (memoryContextWords.includes(word)) score += 1;
      }

      // Pattern match
      const patternWords = memory.pattern.toLowerCase().split(/\s+/);
      for (const word of contextWords) {
        if (patternWords.includes(word)) score += 2;
      }

      // Frequency and confidence boost
      score *= (1 + Math.log10(memory.frequency + 1));
      score *= memory.confidence;

      if (score > 0) {
        scored.push({ memory, score });
        memory.accessCount++;
        memory.lastAccessed = Date.now();
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.memory);
  }

  /**
   * Activate an archetype based on context
   */
  activateArchetype(context: string[]): Archetype | null {
    const contextStr = context.join(' ').toLowerCase();

    let bestMatch: Archetype | null = null;
    let bestScore = 0;

    for (const archetype of this.archetypes.values()) {
      let score = 0;
      for (const trigger of archetype.triggers) {
        if (contextStr.includes(trigger.toLowerCase())) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = archetype;
      }
    }

    if (bestMatch && bestScore > 0) {
      this.emit('archetype_activated', { archetypeId: bestMatch.id, triggers: bestScore });
    }

    return bestMatch;
  }

  /**
   * Synchronize an agent with the collective
   */
  synchronize(agentId: string): {
    memoriesAbsorbed: number;
    patternsLearned: string[];
    archetypeActive: Archetype | null;
  } {
    // Get top memories this agent hasn't contributed to
    const agentMemories = this.agentContributions.get(agentId) || [];
    const newMemories = Array.from(this.memories.values())
      .filter(m => !agentMemories.includes(m.id))
      .filter(m => m.confidence > 0.6 && m.frequency > 2)
      .sort((a, b) => b.frequency * b.confidence - a.frequency * a.confidence)
      .slice(0, 10);

    const patternsLearned = newMemories.map(m => m.pattern);

    // Determine dominant archetype
    const contexts = newMemories.flatMap(m => m.context);
    const archetype = this.activateArchetype(contexts);

    this.emit('synchronization', {
      agentId,
      memoriesAbsorbed: newMemories.length,
      archetype: archetype?.name,
    });

    return {
      memoriesAbsorbed: newMemories.length,
      patternsLearned,
      archetypeActive: archetype,
    };
  }

  /**
   * Get collective statistics
   */
  getStats(): {
    totalMemories: number;
    totalContributors: number;
    strongestPatterns: Array<{ pattern: string; strength: number }>;
    mostActiveArchetype: string;
  } {
    const memories = Array.from(this.memories.values());
    const contributors = new Set<string>();
    memories.forEach(m => m.contributors.forEach(c => contributors.add(c)));

    const strongestPatterns = memories
      .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
      .slice(0, 5)
      .map(m => ({ pattern: m.pattern, strength: m.frequency * m.confidence }));

    // Find most commonly activated archetype (based on recent accesses)
    const recentMemories = memories.filter(m => Date.now() - m.lastAccessed < 3600000);
    const contexts = recentMemories.flatMap(m => m.context);
    const activeArchetype = this.activateArchetype(contexts);

    return {
      totalMemories: memories.length,
      totalContributors: contributors.size,
      strongestPatterns,
      mostActiveArchetype: activeArchetype?.name || 'none',
    };
  }

  /**
   * Get archetype by ID
   */
  getArchetype(id: string): Archetype | undefined {
    return this.archetypes.get(id);
  }

  /**
   * Get all archetypes
   */
  getAllArchetypes(): Archetype[] {
    return Array.from(this.archetypes.values());
  }

  /**
   * Get memory by ID
   */
  getMemory(id: string): CollectiveMemory | undefined {
    return this.memories.get(id);
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  PromptDNASystem,
  AgentDreams,
  CollectiveUnconscious,
  PROMPT_CODONS,
};
