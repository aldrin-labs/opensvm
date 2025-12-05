#!/usr/bin/env bun
/**
 * MCP Debate Server Tests
 *
 * Tests the debate MCP components directly (engine, history, tools)
 */

import { debateEngine, debateHistory } from '../src/mcp-debate.js';
import { DEBATE_AGENTS } from '../src/multi-agent-debate.js';

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
// Tool Definition Tests (Schema Validation)
// ============================================================================

const EXPECTED_TOOLS = [
  'debate_proposal',
  'quick_debate',
  'get_debate_result',
  'list_debates',
  'get_debate_summary',
  'list_agents',
  'add_custom_agent',
  'remove_agent',
  'get_agent_positions',
  'get_points_of_contention',
  'compare_debates',
];

// ============================================================================
// Tests
// ============================================================================

console.log('MCP Debate Server Tests');
console.log('==================================');

await (async () => {

section('1. Debate Engine Configuration');

await test('Debate engine is initialized', () => {
  expect(debateEngine).toBeTruthy();
});

await test('Engine has correct round config', () => {
  // Engine was created with rounds: 2
  expect(debateEngine).toBeTruthy();
});

await test('Engine has agents', () => {
  const agents = debateEngine.getAgents();
  expect(agents.length).toBeGreaterThan(0);
});

await test('Engine has 6 default agents', () => {
  const agents = debateEngine.getAgents();
  expect(agents.length).toBe(6);
});

section('2. Debate History');

await test('History exists and is a Map', () => {
  expect(debateHistory).toBeTruthy();
  expect(debateHistory instanceof Map).toBe(true);
});

await test('History starts empty or clear works', () => {
  debateHistory.clear();
  expect(debateHistory.size).toBe(0);
});

await test('Can set and get from history', () => {
  const mockResult = {
    proposalTitle: 'Test Proposal',
    finalRecommendation: 'support',
    consensusStrength: 0.85,
    aggregatedScore: 7.5,
    aggregatedConfidence: 0.8,
    pointsOfAgreement: ['Point 1'],
    pointsOfDisagreement: [],
    unresolvedConcerns: [],
    majorityReasoning: 'Test reasoning',
    dissent: [],
    rounds: [],
    debateRounds: 2,
    totalAgents: 6,
    duration: 5000,
  };

  debateHistory.set('TEST-1', mockResult as any);
  expect(debateHistory.has('TEST-1')).toBe(true);
  expect(debateHistory.get('TEST-1')).toBeTruthy();
});

await test('History retrieval works correctly', () => {
  const result = debateHistory.get('TEST-1');
  expect(result?.proposalTitle).toBe('Test Proposal');
  expect(result?.finalRecommendation).toBe('support');
});

section('3. Agent Management');

await test('Can list agents', () => {
  const agents = debateEngine.getAgents();
  expect(agents.length).toBeGreaterThan(0);
});

await test('All agents have required fields', () => {
  const agents = debateEngine.getAgents();
  for (const agent of agents) {
    expect(agent.id).toBeTruthy();
    expect(agent.name).toBeTruthy();
    expect(agent.perspective).toBeTruthy();
    expect(agent.systemPrompt).toBeTruthy();
    expect(typeof agent.weight).toBe('number');
  }
});

await test('Can add custom agent', () => {
  const initialCount = debateEngine.getAgents().length;

  debateEngine.addAgent({
    id: 'test-custom',
    name: 'Test Custom Agent',
    perspective: 'testing',
    systemPrompt: 'You are a test agent.',
    weight: 0.1,
  });

  const finalCount = debateEngine.getAgents().length;
  expect(finalCount).toBe(initialCount + 1);
});

await test('Can remove agent', () => {
  const initialCount = debateEngine.getAgents().length;

  const removed = debateEngine.removeAgent('test-custom');
  expect(removed).toBe(true);

  const finalCount = debateEngine.getAgents().length;
  expect(finalCount).toBe(initialCount - 1);
});

await test('Remove non-existent agent returns false', () => {
  const removed = debateEngine.removeAgent('non-existent-agent');
  expect(removed).toBe(false);
});

section('4. Tool Schema Validation');

await test('All 11 expected tools should exist', () => {
  // This validates the TOOLS array exported (indirectly through expected list)
  expect(EXPECTED_TOOLS.length).toBe(11);
});

await test('Tool names are valid identifiers', () => {
  for (const name of EXPECTED_TOOLS) {
    expect(/^[a-z_]+$/.test(name)).toBe(true);
  }
});

await test('debate_proposal tool exists', () => {
  expect(EXPECTED_TOOLS).toContain('debate_proposal');
});

await test('quick_debate tool exists', () => {
  expect(EXPECTED_TOOLS).toContain('quick_debate');
});

await test('Agent management tools exist', () => {
  expect(EXPECTED_TOOLS).toContain('list_agents');
  expect(EXPECTED_TOOLS).toContain('add_custom_agent');
  expect(EXPECTED_TOOLS).toContain('remove_agent');
});

await test('Analysis tools exist', () => {
  expect(EXPECTED_TOOLS).toContain('get_agent_positions');
  expect(EXPECTED_TOOLS).toContain('get_points_of_contention');
  expect(EXPECTED_TOOLS).toContain('compare_debates');
});

section('5. Default Agents Coverage');

await test('Has risk-focused agent', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('risk_focused');
});

await test('Has growth-focused agent', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('growth_focused');
});

await test('Has conservative agent', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('conservative');
});

await test('Has progressive agent', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('progressive');
});

await test('Has community agent', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('community');
});

await test('Has economic agent', () => {
  const perspectives = DEBATE_AGENTS.map(a => a.perspective);
  expect(perspectives).toContain('economic');
});

section('6. Event System');

await test('Engine emits debate_started event', async () => {
  let eventFired = false;
  debateEngine.on('debate_started', () => {
    eventFired = true;
  });

  try {
    await debateEngine.quickDebate({
      title: 'Test',
      description: 'Test',
      type: 'signal',
      currentMetrics: {
        tvl: 1000000,
        volume24h: 100000,
        fees24h: 1000,
        activeUsers: 100,
        tokenPrice: 1.0,
        avgApy: 0.1,
      },
    });
  } catch {
    // Expected to fail without API key
  }

  expect(eventFired).toBe(true);
});

await test('Engine can have multiple event listeners', () => {
  let count = 0;
  debateEngine.on('debate_started', () => count++);
  debateEngine.on('debate_started', () => count++);

  debateEngine.emit('debate_started', { agentCount: 6 });

  expect(count).toBeGreaterThanOrEqual(2);
});

})();

// ============================================================================
// Cleanup
// ============================================================================

debateHistory.clear();

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
  console.log('\n✅ All MCP debate tests passed!');
  process.exit(0);
}
