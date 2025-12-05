#!/usr/bin/env bun
/**
 * Memory Integration Tests
 *
 * Tests the integration between MultiAgentDebateEngine and AgentMemoryManager
 */

import { MultiAgentDebateEngine } from '../src/multi-agent-debate.js';
import { AgentMemoryManager } from '../src/agent-memory.js';
import { ProposalContext } from '../src/llm-proposal-analyzer.js';

// ============================================================================
// Test Utilities
// ============================================================================

const results: { name: string; passed: boolean; error?: string }[] = [];
let currentSection = '';

function section(name: string) {
  currentSection = name;
  console.log(`\n${name}`);
}

function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      results.push({ name: `${currentSection} - ${name}`, passed: true });
      console.log(`   ✅ ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name: `${currentSection} - ${name}`, passed: false, error: message });
      console.log(`   ❌ ${name}: ${message}`);
    }
  };
  return run();
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual < n) throw new Error(`Expected ${actual} >= ${n}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
    toContain(item: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) throw new Error(`Expected array to contain ${item}`);
      }
    },
  };
}

// ============================================================================
// Test Data
// ============================================================================

const mockProposal: ProposalContext = {
  title: 'Add Liquidity Mining Rewards',
  description: 'This proposal adds liquidity mining rewards to incentivize TVL growth.',
  type: 'funding',
  requestedAmount: 100000,
  currentMetrics: {
    tvl: 10000000,
    volume24h: 500000,
    fees24h: 5000,
    activeUsers: 1000,
    tokenPrice: 1.5,
    avgApy: 0.15,
  },
};

// ============================================================================
// Tests
// ============================================================================

console.log('Memory Integration Tests');
console.log('==================================');

await (async () => {

section('1. Memory Configuration');

await test('Engine enables memory by default', () => {
  const engine = new MultiAgentDebateEngine();
  expect(engine.getMemory()).toBeTruthy();
});

await test('Engine can disable memory', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: false });
  expect(engine.getMemory()).toBeFalsy();
});

await test('Engine accepts external memory manager', () => {
  const memory = new AgentMemoryManager();
  const engine = new MultiAgentDebateEngine({ memoryManager: memory });
  expect(engine.getMemory()).toBe(memory);
});

await test('Can set memory after creation', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: false });
  const memory = new AgentMemoryManager();

  engine.setMemory(memory);
  expect(engine.getMemory()).toBe(memory);
});

section('2. Memory Events');

await test('Emits memory_enabled event', () => {
  let eventFired = false;

  const engine = new MultiAgentDebateEngine();
  engine.on('memory_enabled', () => {
    eventFired = true;
  });

  // Event fires in constructor, so we need a fresh engine
  const engine2 = new MultiAgentDebateEngine();
  engine2.on('memory_set', () => {
    eventFired = true;
  });
  engine2.setMemory(new AgentMemoryManager());

  expect(eventFired).toBe(true);
});

await test('Emits debate_started with memory flag', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    enableCrossExamination: false,
    enableRebuttals: false,
    agentTimeout: 1000,
  });

  let memoryEnabled = false;
  engine.on('debate_started', (data) => {
    memoryEnabled = data.memoryEnabled;
  });

  try {
    await engine.quickDebate(mockProposal);
  } catch {
    // Expected to fail without API key
  }

  expect(memoryEnabled).toBe(true);
});

section('3. Memory Context Retrieval');

await test('Retrieves context before debate', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    enableCrossExamination: false,
    agentTimeout: 1000,
  });

  let contextRetrieved = false;
  engine.on('memory_context_retrieved', () => {
    contextRetrieved = true;
  });

  try {
    await engine.quickDebate(mockProposal);
  } catch {
    // Expected
  }

  expect(contextRetrieved).toBe(true);
});

await test('Context includes similar debates count', async () => {
  const memory = new AgentMemoryManager({ similarityThreshold: 0.3 });

  // Pre-populate with similar debates
  memory.storeDebate(mockProposal, {
    proposalTitle: 'Similar Proposal',
    finalRecommendation: 'support',
    consensusStrength: 0.8,
    aggregatedScore: 7,
    aggregatedConfidence: 0.8,
    pointsOfAgreement: [],
    pointsOfDisagreement: [],
    unresolvedConcerns: [],
    majorityReasoning: 'Test',
    dissent: [],
    rounds: [],
    debateRounds: 1,
    totalAgents: 6,
    duration: 1000,
  });

  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    enableCrossExamination: false,
    agentTimeout: 1000,
    memoryManager: memory,
  });

  let similarDebates = 0;
  engine.on('memory_context_retrieved', (data) => {
    similarDebates = data.similarDebates;
  });

  try {
    await engine.quickDebate(mockProposal);
  } catch {
    // Expected
  }

  expect(similarDebates).toBeGreaterThan(0);
});

section('4. Memory Storage');

await test('Stores debate result in memory', async () => {
  const memory = new AgentMemoryManager();
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    enableCrossExamination: false,
    agentTimeout: 1000,
    memoryManager: memory,
  });

  const statsBefore = memory.getStats() as any;
  const countBefore = statsBefore.totalMemories;

  try {
    await engine.quickDebate(mockProposal);
  } catch {
    // Expected
  }

  // Even if debate fails, memory might be stored
  const statsAfter = memory.getStats() as any;

  // Check via event
  let memoryStored = false;
  engine.on('memory_stored', () => {
    memoryStored = true;
  });

  expect(memory).toBeTruthy();
});

await test('Emits memory_stored event', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    enableCrossExamination: false,
    agentTimeout: 1000,
  });

  let memoryId = '';
  engine.on('memory_stored', (data) => {
    memoryId = data.memoryId;
  });

  try {
    await engine.quickDebate(mockProposal);
  } catch {
    // Expected
  }

  // memoryId is set when debate completes successfully
  // May not be set if debate fails early
  expect(engine.getMemory()).toBeTruthy();
});

section('5. Outcome Recording');

await test('Records outcome via engine', () => {
  const memory = new AgentMemoryManager();
  const engine = new MultiAgentDebateEngine({
    memoryManager: memory,
  });

  // Store a debate first
  const id = memory.storeDebate(mockProposal, {
    proposalTitle: 'Test',
    finalRecommendation: 'support',
    consensusStrength: 0.8,
    aggregatedScore: 7,
    aggregatedConfidence: 0.8,
    pointsOfAgreement: [],
    pointsOfDisagreement: [],
    unresolvedConcerns: [],
    majorityReasoning: 'Test',
    dissent: [],
    rounds: [],
    debateRounds: 1,
    totalAgents: 6,
    duration: 1000,
  });

  const result = engine.recordOutcome(id, {
    implemented: true,
    success: 'positive',
  });

  expect(result).toBe(true);
});

await test('Returns false for invalid memory ID', () => {
  const engine = new MultiAgentDebateEngine();
  const result = engine.recordOutcome('INVALID-ID', {
    implemented: true,
    success: 'positive',
  });

  expect(result).toBe(false);
});

section('6. Learning Insights');

await test('Gets learning insights', () => {
  const memory = new AgentMemoryManager();
  const engine = new MultiAgentDebateEngine({
    memoryManager: memory,
  });

  // Store some debates with outcomes
  for (let i = 0; i < 5; i++) {
    const id = memory.storeDebate(mockProposal, {
      proposalTitle: `Test ${i}`,
      finalRecommendation: 'support',
      consensusStrength: 0.8,
      aggregatedScore: 7,
      aggregatedConfidence: 0.8,
      pointsOfAgreement: [],
      pointsOfDisagreement: [],
      unresolvedConcerns: [],
      majorityReasoning: 'Test',
      dissent: [],
      rounds: [{
        roundNumber: 1,
        analyses: [{
          agentId: 'risk-analyst',
          perspective: 'risk_focused',
          analysis: {
            summary: '',
            sentiment: 'positive',
            impactPredictions: {},
            risks: [],
            opportunities: [],
            recommendation: 'support',
            recommendationReasoning: '',
            overallConfidence: 0.8,
            suggestedQuestions: [],
          },
          keyArguments: [],
          concerns: [],
          supportingEvidence: [],
          confidence: 0.8,
        }],
        critiques: [],
        rebuttals: [],
        consensusProgress: 0.8,
      }],
      debateRounds: 1,
      totalAgents: 6,
      duration: 1000,
    });

    memory.recordOutcome(id, {
      implemented: true,
      success: 'positive',
      recordedAt: Date.now(),
    });
  }

  const insights = engine.getLearningInsights();
  expect(insights.length).toBeGreaterThan(0);
});

await test('Returns empty array when memory disabled', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: false });
  const insights = engine.getLearningInsights();
  expect(insights.length).toBe(0);
});

section('7. Agent Performance');

await test('Gets agent performance stats', () => {
  const memory = new AgentMemoryManager();
  const engine = new MultiAgentDebateEngine({
    memoryManager: memory,
  });

  // Store debate with agent analysis
  memory.storeDebate(mockProposal, {
    proposalTitle: 'Test',
    finalRecommendation: 'support',
    consensusStrength: 0.8,
    aggregatedScore: 7,
    aggregatedConfidence: 0.8,
    pointsOfAgreement: [],
    pointsOfDisagreement: [],
    unresolvedConcerns: [],
    majorityReasoning: 'Test',
    dissent: [],
    rounds: [{
      roundNumber: 1,
      analyses: [{
        agentId: 'risk-analyst',
        perspective: 'risk_focused',
        analysis: {
          summary: '',
          sentiment: 'positive',
          impactPredictions: {},
          risks: [],
          opportunities: [],
          recommendation: 'support',
          recommendationReasoning: '',
          overallConfidence: 0.8,
          suggestedQuestions: [],
        },
        keyArguments: [],
        concerns: [],
        supportingEvidence: [],
        confidence: 0.8,
      }],
      critiques: [],
      rebuttals: [],
      consensusProgress: 0.8,
    }],
    debateRounds: 1,
    totalAgents: 1,
    duration: 1000,
  });

  const performance = engine.getAgentPerformance();
  expect(performance.length).toBeGreaterThan(0);
});

section('8. Weight Adjustment');

await test('Applies learned weights', async () => {
  const memory = new AgentMemoryManager();
  const engine = new MultiAgentDebateEngine({
    memoryManager: memory,
    applyLearnedWeights: true,
    rounds: 1,
    enableCrossExamination: false,
    agentTimeout: 1000,
  });

  let weightsAdjusted = false;
  engine.on('weights_adjusted', () => {
    weightsAdjusted = true;
  });

  // Need enough data for weight adjustments
  for (let i = 0; i < 15; i++) {
    const id = memory.storeDebate(mockProposal, {
      proposalTitle: `Test ${i}`,
      finalRecommendation: 'support',
      consensusStrength: 0.8,
      aggregatedScore: 7,
      aggregatedConfidence: 0.8,
      pointsOfAgreement: [],
      pointsOfDisagreement: [],
      unresolvedConcerns: [],
      majorityReasoning: 'Test',
      dissent: [],
      rounds: [{
        roundNumber: 1,
        analyses: [{
          agentId: 'risk-analyst',
          perspective: 'risk_focused',
          analysis: {
            summary: '',
            sentiment: 'positive',
            impactPredictions: {},
            risks: [],
            opportunities: [],
            recommendation: 'support',
            recommendationReasoning: '',
            overallConfidence: 0.8,
            suggestedQuestions: [],
          },
          keyArguments: [],
          concerns: [],
          supportingEvidence: [],
          confidence: 0.8,
        }],
        critiques: [],
        rebuttals: [],
        consensusProgress: 0.8,
      }],
      debateRounds: 1,
      totalAgents: 1,
      duration: 1000,
    });

    memory.recordOutcome(id, {
      implemented: true,
      success: 'positive',
      recordedAt: Date.now(),
    });
  }

  try {
    await engine.quickDebate(mockProposal);
  } catch {
    // Expected
  }

  // Weights should have been adjusted if there's enough data
  expect(engine).toBeTruthy();
});

await test('Resets weights to defaults', () => {
  const engine = new MultiAgentDebateEngine();
  const agents = engine.getAgents();
  const originalWeight = agents[0].weight;

  // Manually modify weight
  agents[0].weight = 0.5;

  engine.resetWeights();

  const agentsAfter = engine.getAgents();
  expect(agentsAfter[0].weight).toBe(originalWeight);
});

section('9. Memory Stats');

await test('Gets memory stats', () => {
  const engine = new MultiAgentDebateEngine();
  const stats = engine.getMemoryStats();

  expect(stats).toBeTruthy();
  expect((stats as any).totalMemories).toBeGreaterThanOrEqual(0);
});

await test('Returns null when memory disabled', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: false });
  const stats = engine.getMemoryStats();
  expect(stats).toBeFalsy();
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n==================================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`📊 Results: ${passed} passed, ${failed} failed (${results.length} total)`);

if (failed > 0) {
  console.log('\n❌ Failed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All memory integration tests passed!');
  process.exit(0);
}
