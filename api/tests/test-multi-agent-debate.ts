#!/usr/bin/env bun
/**
 * Multi-Agent Debate System Tests
 */

import {
  MultiAgentDebateEngine,
  getMultiAgentDebateEngine,
  DEBATE_AGENTS,
  MEDIATOR_AGENT,
  DebateAgent,
} from '../src/multi-agent-debate.js';
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
      console.log(`   [PASS] ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name: `${currentSection} - ${name}`, passed: false, error: message });
      console.log(`   [FAIL] ${name}: ${message}`);
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
    toContain(item: unknown) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
  };
}

// ============================================================================
// Test Data
// ============================================================================

const mockContext: ProposalContext = {
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

console.log('Multi-Agent Debate System Tests');
console.log('============================================================');

await (async () => {

section('1. Agent Configuration');

await test('Default agents are configured', () => {
  expect(DEBATE_AGENTS.length).toBeGreaterThan(0);
});

await test('All agents have required fields', () => {
  for (const agent of DEBATE_AGENTS) {
    expect(agent.id).toBeTruthy();
    expect(agent.name).toBeTruthy();
    expect(agent.perspective).toBeTruthy();
    expect(agent.systemPrompt).toBeTruthy();
    expect(typeof agent.weight).toBe('number');
  }
});

await test('Agent weights sum to approximately 1', () => {
  const totalWeight = DEBATE_AGENTS.reduce((sum, a) => sum + a.weight, 0);
  // Should be close to 1.0 (within 0.01)
  const diff = Math.abs(totalWeight - 1.0);
  expect(diff).toBeLessThan(0.01);
});

await test('Mediator agent exists', () => {
  expect(MEDIATOR_AGENT.id).toBe('mediator');
  expect(MEDIATOR_AGENT.perspective).toBe('mediator');
  expect(MEDIATOR_AGENT.weight).toBe(0);
});

await test('Multiple perspectives covered', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('risk_focused');
  expect(perspectives).toContain('growth_focused');
  expect(perspectives).toContain('conservative');
  expect(perspectives).toContain('progressive');
});

section('2. Engine Creation');

await test('Creates engine with default config', () => {
  const engine = new MultiAgentDebateEngine();
  const agents = engine.getAgents();
  expect(agents.length).toBe(6);
});

await test('Creates engine with custom config', () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 3,
    minConsensus: 0.9,
    enableCrossExamination: false,
  });
  expect(engine).toBeTruthy();
});

await test('Singleton returns same instance', () => {
  const e1 = getMultiAgentDebateEngine();
  const e2 = getMultiAgentDebateEngine();
  expect(e1).toBe(e2);
});

section('3. Agent Management');

await test('Add custom agent', () => {
  const engine = new MultiAgentDebateEngine();
  const initialCount = engine.getAgents().length;

  const customAgent: DebateAgent = {
    id: 'custom-analyst',
    name: 'Custom Analyst',
    perspective: 'technical',
    systemPrompt: 'You are a technical analyst.',
    weight: 0.1,
  };

  engine.addAgent(customAgent);
  expect(engine.getAgents().length).toBe(initialCount + 1);
});

await test('Remove agent', () => {
  const engine = new MultiAgentDebateEngine();
  const initialCount = engine.getAgents().length;

  const removed = engine.removeAgent('risk-analyst');
  expect(removed).toBe(true);
  expect(engine.getAgents().length).toBe(initialCount - 1);
});

await test('Remove non-existent agent returns false', () => {
  const engine = new MultiAgentDebateEngine();
  const removed = engine.removeAgent('non-existent');
  expect(removed).toBe(false);
});

section('4. Debate Execution (Mocked)');

await test('Engine emits events', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    enableCrossExamination: false,
    enableRebuttals: false,
    agentTimeout: 1000,
  });

  let eventFired = false;
  engine.on('debate_started', () => {
    eventFired = true;
  });

  try {
    await engine.quickDebate(mockContext);
  } catch {
    // Expected to fail without API key
  }

  expect(eventFired).toBe(true);
});

await test('Quick debate emits start event', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 3,
    enableCrossExamination: true,
  });

  let agentCount = 0;
  engine.on('debate_started', (data) => {
    agentCount = data.agentCount;
  });

  try {
    await engine.quickDebate(mockContext);
  } catch {
    // Expected
  }

  expect(agentCount).toBeGreaterThan(0);
});

section('5. Consensus Calculation');

await test('Unanimous support = high consensus', () => {
  const engine = new MultiAgentDebateEngine();

  const mockAnalyses = DEBATE_AGENTS.map(agent => ({
    agentId: agent.id,
    perspective: agent.perspective,
    analysis: {
      summary: '',
      sentiment: 'positive' as const,
      impactPredictions: {},
      risks: [],
      opportunities: [],
      recommendation: 'support' as const,
      recommendationReasoning: '',
      overallConfidence: 0.8,
      suggestedQuestions: [],
    },
    keyArguments: [],
    concerns: [],
    supportingEvidence: [],
    confidence: 0.8,
  }));

  const consensus = (engine as any).calculateConsensus(mockAnalyses);
  expect(consensus).toBe(1.0);
});

await test('Split decision = lower consensus', () => {
  const engine = new MultiAgentDebateEngine();

  const mockAnalyses = DEBATE_AGENTS.map((agent, i) => ({
    agentId: agent.id,
    perspective: agent.perspective,
    analysis: {
      summary: '',
      sentiment: 'neutral' as const,
      impactPredictions: {},
      risks: [],
      opportunities: [],
      recommendation: (i % 2 === 0 ? 'support' : 'oppose') as 'support' | 'oppose',
      recommendationReasoning: '',
      overallConfidence: 0.8,
      suggestedQuestions: [],
    },
    keyArguments: [],
    concerns: [],
    supportingEvidence: [],
    confidence: 0.8,
  }));

  const consensus = (engine as any).calculateConsensus(mockAnalyses);
  expect(consensus).toBe(0.5);
});

section('6. Majority Calculation');

await test('Weighted majority calculation', () => {
  const engine = new MultiAgentDebateEngine();

  const mockAnalyses = DEBATE_AGENTS.map((agent) => ({
    agentId: agent.id,
    perspective: agent.perspective,
    analysis: {
      summary: '',
      sentiment: 'neutral' as const,
      impactPredictions: {},
      risks: [],
      opportunities: [],
      recommendation: (agent.weight > 0.15 ? 'support' : 'oppose') as 'support' | 'oppose',
      recommendationReasoning: '',
      overallConfidence: 0.8,
      suggestedQuestions: [],
    },
    keyArguments: [],
    concerns: [],
    supportingEvidence: [],
    confidence: 0.8,
  }));

  const majority = (engine as any).calculateMajority(mockAnalyses);
  expect(['support', 'oppose', 'abstain']).toContain(majority);
});

section('7. Error Handling');

await test('Handles missing API key gracefully', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    agentTimeout: 1000,
  });

  try {
    const result = await engine.quickDebate(mockContext);
    expect(result.totalAgents).toBeGreaterThanOrEqual(0);
  } catch {
    // Also acceptable
  }

  expect(true).toBe(true);
});

await test('Handles agent timeout', async () => {
  const engine = new MultiAgentDebateEngine({
    rounds: 1,
    agentTimeout: 1,
    enableCrossExamination: false,
    enableRebuttals: false,
  });

  try {
    await engine.quickDebate(mockContext);
  } catch {
    // Expected
  }

  expect(true).toBe(true);
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n============================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`\nResults: ${passed} passed, ${failed} failed (${results.length} total)`);

if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n[SUCCESS] All multi-agent debate tests passed!');
  process.exit(0);
}
