#!/usr/bin/env bun
/**
 * Agent Memory System Tests
 */

import { AgentMemoryManager, getAgentMemoryManager } from '../src/agent-memory.js';
import { DebateResult } from '../src/multi-agent-debate.js';
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
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) throw new Error(`Expected ${actual} < ${n}`);
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
      } else if (typeof actual === 'string') {
        if (!actual.includes(item as string)) throw new Error(`Expected "${actual}" to contain "${item}"`);
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

const mockResult: DebateResult = {
  proposalTitle: 'Add Liquidity Mining Rewards',
  finalRecommendation: 'support',
  consensusStrength: 0.85,
  aggregatedScore: 7.5,
  aggregatedConfidence: 0.8,
  pointsOfAgreement: ['Good for TVL'],
  pointsOfDisagreement: [],
  unresolvedConcerns: [],
  majorityReasoning: 'Majority supports liquidity incentives',
  dissent: [],
  rounds: [{
    roundNumber: 1,
    analyses: [
      {
        agentId: 'risk-analyst',
        perspective: 'risk_focused',
        analysis: {
          summary: 'Low risk proposal',
          sentiment: 'positive',
          impactPredictions: {},
          risks: [],
          opportunities: ['TVL growth'],
          recommendation: 'support',
          recommendationReasoning: 'Benefits outweigh risks',
          overallConfidence: 0.8,
          suggestedQuestions: [],
        },
        keyArguments: ['Low risk'],
        concerns: [],
        supportingEvidence: [],
        confidence: 0.8,
      },
      {
        agentId: 'growth-strategist',
        perspective: 'growth_focused',
        analysis: {
          summary: 'Great for growth',
          sentiment: 'positive',
          impactPredictions: {},
          risks: [],
          opportunities: ['User growth'],
          recommendation: 'support',
          recommendationReasoning: 'Will drive adoption',
          overallConfidence: 0.9,
          suggestedQuestions: [],
        },
        keyArguments: ['Growth potential'],
        concerns: [],
        supportingEvidence: [],
        confidence: 0.9,
      },
    ],
    consensusReached: true,
    consensusLevel: 0.85,
  }],
  debateRounds: 1,
  totalAgents: 2,
  duration: 5000,
};

// ============================================================================
// Tests
// ============================================================================

console.log('Agent Memory System Tests');
console.log('==================================');

await (async () => {

section('1. Memory Manager Creation');

await test('Creates memory manager', () => {
  const memory = new AgentMemoryManager();
  expect(memory).toBeTruthy();
});

await test('Creates with custom config', () => {
  const memory = new AgentMemoryManager({
    maxMemories: 500,
    similarityThreshold: 0.7,
  });
  expect(memory).toBeTruthy();
});

await test('Singleton returns same instance', () => {
  const m1 = getAgentMemoryManager();
  const m2 = getAgentMemoryManager();
  expect(m1).toBe(m2);
});

section('2. Memory Storage');

await test('Stores debate result', () => {
  const memory = new AgentMemoryManager();
  const id = memory.storeDebate(mockProposal, mockResult);
  expect(id).toBeTruthy();
  expect(id).toContain('MEM-');
});

await test('Stores multiple debates', () => {
  const memory = new AgentMemoryManager();
  const id1 = memory.storeDebate(mockProposal, mockResult);
  const id2 = memory.storeDebate(mockProposal, mockResult);
  expect(id1).toBeTruthy();
  expect(id2).toBeTruthy();
  expect(id1 === id2).toBe(false);
});

await test('Enforces memory limit', () => {
  const memory = new AgentMemoryManager({ maxMemories: 5 });

  for (let i = 0; i < 10; i++) {
    memory.storeDebate(mockProposal, mockResult);
  }

  const stats = memory.getStats() as any;
  expect(stats.totalMemories).toBe(5);
});

await test('Emits memory_stored event', () => {
  const memory = new AgentMemoryManager();
  let eventFired = false;

  memory.on('memory_stored', () => {
    eventFired = true;
  });

  memory.storeDebate(mockProposal, mockResult);
  expect(eventFired).toBe(true);
});

section('3. Outcome Recording');

await test('Records actual outcome', () => {
  const memory = new AgentMemoryManager();
  const id = memory.storeDebate(mockProposal, mockResult);

  const recorded = memory.recordOutcome(id, {
    implemented: true,
    success: 'positive',
    recordedAt: Date.now(),
  });

  expect(recorded).toBe(true);
});

await test('Returns false for non-existent memory', () => {
  const memory = new AgentMemoryManager();

  const recorded = memory.recordOutcome('NON-EXISTENT', {
    implemented: true,
    success: 'positive',
    recordedAt: Date.now(),
  });

  expect(recorded).toBe(false);
});

await test('Emits outcome_recorded event', () => {
  const memory = new AgentMemoryManager();
  const id = memory.storeDebate(mockProposal, mockResult);
  let eventFired = false;

  memory.on('outcome_recorded', () => {
    eventFired = true;
  });

  memory.recordOutcome(id, {
    implemented: true,
    success: 'positive',
    recordedAt: Date.now(),
  });

  expect(eventFired).toBe(true);
});

section('4. Similarity Search');

await test('Finds similar debates', () => {
  const memory = new AgentMemoryManager({ similarityThreshold: 0.5 });
  memory.storeDebate(mockProposal, mockResult);

  const similar = memory.findSimilar(mockProposal);
  expect(similar.length).toBeGreaterThan(0);
});

await test('Same proposal has high similarity', () => {
  const memory = new AgentMemoryManager({ similarityThreshold: 0.5 });
  memory.storeDebate(mockProposal, mockResult);

  const similar = memory.findSimilar(mockProposal);
  expect(similar[0]?.similarity).toBeGreaterThan(0.9);
});

await test('Different type has lower similarity', () => {
  const memory = new AgentMemoryManager({ similarityThreshold: 0.3 });
  memory.storeDebate(mockProposal, mockResult);

  const differentProposal = { ...mockProposal, type: 'emergency' as const };
  const similar = memory.findSimilar(differentProposal);

  // Should still find it but with lower similarity
  if (similar.length > 0) {
    expect(similar[0].similarity).toBeLessThan(1.0);
  }
});

await test('Respects maxResults limit', () => {
  const memory = new AgentMemoryManager({ similarityThreshold: 0.3 });

  for (let i = 0; i < 10; i++) {
    memory.storeDebate(mockProposal, mockResult);
  }

  const similar = memory.findSimilar(mockProposal, 3);
  expect(similar.length).toBe(3);
});

section('5. Context Generation');

await test('Gets context for proposal', () => {
  const memory = new AgentMemoryManager({ similarityThreshold: 0.5 });
  memory.storeDebate(mockProposal, mockResult);

  const context = memory.getContext(mockProposal);
  expect(context).toBeTruthy();
  expect(context.similarDebates.length).toBeGreaterThan(0);
});

await test('Context includes agent performance', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  const context = memory.getContext(mockProposal);
  expect(context.agentPerformance).toBeTruthy();
  expect(context.agentPerformance.size).toBeGreaterThan(0);
});

section('6. Agent Performance Tracking');

await test('Tracks agent stats after debate', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  const perf = memory.getAgentPerformance('risk-analyst');
  expect(perf).toBeTruthy();
  expect(perf?.totalDebates).toBe(1);
});

await test('Tracks support bias', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  const perf = memory.getAgentPerformance('growth-strategist');
  expect(perf?.biases.supportBias).toBeGreaterThan(0);
});

await test('Tracks average confidence', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  const perf = memory.getAgentPerformance('risk-analyst');
  expect(perf?.biases.averageConfidence).toBe(0.8);
});

await test('Gets all performance stats', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  const all = memory.getAllPerformance();
  expect(all.length).toBeGreaterThan(0);
});

await test('Updates accuracy after outcome', () => {
  const memory = new AgentMemoryManager();
  const id = memory.storeDebate(mockProposal, mockResult);

  memory.recordOutcome(id, {
    implemented: true,
    success: 'positive',
    recordedAt: Date.now(),
  });

  const perf = memory.getAgentPerformance('risk-analyst');
  // Should have 1 correct prediction (supported & positive outcome)
  expect(perf?.correctPredictions).toBe(1);
});

section('7. Learning & Insights');

await test('Generates insights', () => {
  const memory = new AgentMemoryManager();
  const id = memory.storeDebate(mockProposal, mockResult);
  memory.recordOutcome(id, {
    implemented: true,
    success: 'positive',
    recordedAt: Date.now(),
  });

  const insights = memory.generateInsights();
  expect(insights.length).toBeGreaterThan(0);
});

await test('Suggests weight adjustments', () => {
  const memory = new AgentMemoryManager();

  // Store 10+ debates to reach threshold
  for (let i = 0; i < 12; i++) {
    const id = memory.storeDebate(mockProposal, mockResult);
    memory.recordOutcome(id, {
      implemented: true,
      success: 'positive',
      recordedAt: Date.now(),
    });
  }

  const adjustments = memory.suggestWeightAdjustments();
  // May have adjustments if agents have enough data
  expect(adjustments).toBeTruthy();
});

section('8. Persistence');

await test('Exports memory state', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  const exported = memory.export();
  expect(exported).toBeTruthy();
  expect((exported as any).memories.length).toBeGreaterThan(0);
});

await test('Imports memory state', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);
  const exported = memory.export();

  const newMemory = new AgentMemoryManager();
  newMemory.import(exported);

  const stats = newMemory.getStats() as any;
  expect(stats.totalMemories).toBeGreaterThan(0);
});

await test('Clears memory', () => {
  const memory = new AgentMemoryManager();
  memory.storeDebate(mockProposal, mockResult);

  memory.clear();

  const stats = memory.getStats() as any;
  expect(stats.totalMemories).toBe(0);
});

section('9. Stats');

await test('Gets memory stats', () => {
  const memory = new AgentMemoryManager();
  const id = memory.storeDebate(mockProposal, mockResult);
  memory.recordOutcome(id, {
    implemented: true,
    success: 'positive',
    recordedAt: Date.now(),
  });

  const stats = memory.getStats() as any;
  expect(stats.totalMemories).toBe(1);
  expect(stats.memoriesWithOutcomes).toBe(1);
  expect(stats.trackedAgents).toBeGreaterThan(0);
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
  console.log('\n✅ All agent memory tests passed!');
  process.exit(0);
}
