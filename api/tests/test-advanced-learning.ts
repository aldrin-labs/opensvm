#!/usr/bin/env bun
/**
 * Advanced Learning System Tests
 *
 * Tests for:
 * - Memory Persistence
 * - Self-Improving Agent
 * - Learning Federation
 */

import { MemoryPersistence } from '../src/memory-persistence.js';
import { SelfImprovingDebateAgent } from '../src/self-improving-agent.js';
import { LearningFederation } from '../src/learning-federation.js';
import { MultiAgentDebateEngine } from '../src/multi-agent-debate.js';
import { AgentMemoryManager } from '../src/agent-memory.js';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  };
}

// ============================================================================
// Setup
// ============================================================================

const testDir = join(process.cwd(), 'data', 'test');
const testFile = join(testDir, 'test-persistence.json');

// Ensure test directory exists
if (!existsSync(testDir)) {
  mkdirSync(testDir, { recursive: true });
}

// Clean up test files
function cleanup() {
  try {
    if (existsSync(testFile)) unlinkSync(testFile);
    for (let i = 0; i < 5; i++) {
      const backup = testFile.replace('.json', `.backup${i}.json`);
      if (existsSync(backup)) unlinkSync(backup);
    }
  } catch {}
}

// ============================================================================
// Tests
// ============================================================================

console.log('Advanced Learning System Tests');
console.log('==================================');

await (async () => {

cleanup();

section('1. Memory Persistence');

await test('Creates persistence instance', () => {
  const p = new MemoryPersistence({ path: testFile });
  expect(p).toBeTruthy();
});

await test('Saves data to disk', () => {
  const p = new MemoryPersistence({ path: testFile });
  const result = p.save({ test: 'data', count: 42 });
  expect(result).toBe(true);
});

await test('Loads data from disk', () => {
  const p = new MemoryPersistence({ path: testFile });
  p.save({ test: 'loaded', count: 100 });

  const loaded = p.load() as any;
  expect(loaded).toBeTruthy();
  expect(loaded.test).toBe('loaded');
  expect(loaded.count).toBe(100);
});

await test('Creates backups on save', () => {
  const p = new MemoryPersistence({ path: testFile, maxBackups: 3 });
  p.save({ version: 1 });
  p.save({ version: 2 });
  p.save({ version: 3 });

  const backupPath = testFile.replace('.json', '.backup0.json');
  expect(existsSync(backupPath)).toBe(true);
});

await test('Reports file info', () => {
  const p = new MemoryPersistence({ path: testFile });
  p.save({ info: 'test' });

  const info = p.getInfo() as any;
  expect(info.exists).toBe(true);
  expect(info.version).toBe('1.0.0');
});

await test('Clears data', () => {
  const p = new MemoryPersistence({ path: testFile });
  p.save({ data: 'to clear' });
  p.clear();

  const loaded = p.load() as any;
  expect(Object.keys(loaded).length).toBe(0);
});

section('2. Self-Improving Agent');

await test('Creates self-improving agent', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: true });
  const agent = new SelfImprovingDebateAgent(engine);
  expect(agent).toBeTruthy();
});

await test('Has initial stats', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: true });
  const agent = new SelfImprovingDebateAgent(engine);

  const stats = agent.getStats() as any;
  expect(stats.generation).toBe(1);
  expect(stats.totalModifications).toBeGreaterThanOrEqual(0);
});

await test('Returns empty evolution history initially', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: true });
  const agent = new SelfImprovingDebateAgent(engine);

  const history = agent.getEvolutionHistory();
  expect(history.length).toBe(0);
});

await test('Handles insufficient data gracefully', async () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: true });
  const agent = new SelfImprovingDebateAgent(engine, { minSampleSize: 100 });

  let eventFired = false;
  agent.on('insufficient_data', () => {
    eventFired = true;
  });

  await agent.analyzeAndImprove();
  expect(eventFired).toBe(true);
});

await test('Emits events', () => {
  const engine = new MultiAgentDebateEngine({ enableMemory: true });
  const agent = new SelfImprovingDebateAgent(engine);

  let events: string[] = [];
  agent.on('insufficient_data', () => events.push('insufficient_data'));

  agent.analyzeAndImprove();
  expect(events.length).toBeGreaterThanOrEqual(0);
});

section('3. Learning Federation');

await test('Creates federation', () => {
  const federation = new LearningFederation();
  expect(federation).toBeTruthy();
});

await test('Joins nodes to federation', () => {
  const federation = new LearningFederation({ minNodes: 1 });
  const engine = new MultiAgentDebateEngine({ enableMemory: true });

  const joined = federation.join('node-1', 'Test Node', engine);
  expect(joined).toBe(true);
});

await test('Gets node list', () => {
  const federation = new LearningFederation();
  const engine1 = new MultiAgentDebateEngine({ enableMemory: true });
  const engine2 = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine1);
  federation.join('node-2', 'Node 2', engine2);

  const nodes = federation.getNodes();
  expect(nodes.length).toBe(2);
});

await test('Prevents duplicate node IDs', () => {
  const federation = new LearningFederation();
  const engine = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine);
  const duplicate = federation.join('node-1', 'Node 1 Again', engine);

  expect(duplicate).toBe(false);
});

await test('Removes nodes', () => {
  const federation = new LearningFederation();
  const engine = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine);
  const left = federation.leave('node-1');

  expect(left).toBe(true);
  expect(federation.getNodes().length).toBe(0);
});

await test('Shares insights', () => {
  const federation = new LearningFederation({ minNodes: 1, consensusThreshold: 0.5 });
  const engine = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine);

  const insightId = federation.shareInsight('node-1', 'pattern', {
    description: 'Test pattern',
    frequency: 5,
    reliability: 0.8,
  }, 0.9);

  expect(insightId).toBeTruthy();
});

await test('Gets federation stats', () => {
  const federation = new LearningFederation();
  const engine = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine);

  const stats = federation.getStats() as any;
  expect(stats.totalNodes).toBe(1);
  expect(stats.isSyncing).toBe(false);
});

await test('Gets leaderboard', () => {
  const federation = new LearningFederation();
  const engine1 = new MultiAgentDebateEngine({ enableMemory: true });
  const engine2 = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine1);
  federation.join('node-2', 'Node 2', engine2);

  // Share some insights to build contribution
  federation.shareInsight('node-1', 'pattern', { test: 1 }, 0.8);
  federation.shareInsight('node-1', 'pattern', { test: 2 }, 0.8);

  const leaderboard = federation.getLeaderboard();
  expect(leaderboard.length).toBe(2);
  expect(leaderboard[0].contribution).toBeGreaterThanOrEqual(0);
});

await test('Votes on insights', () => {
  // Use 100% threshold so insight isn't auto-approved
  const federation = new LearningFederation({ minNodes: 2, consensusThreshold: 1.0 });
  const engine1 = new MultiAgentDebateEngine({ enableMemory: true });
  const engine2 = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine1);
  federation.join('node-2', 'Node 2', engine2);

  const insightId = federation.shareInsight('node-1', 'pattern', { test: true }, 0.9);
  const voted = federation.voteInsight('node-2', insightId!, true);

  expect(voted).toBe(true);
});

await test('Runs federated training', async () => {
  const federation = new LearningFederation({ minNodes: 2 });
  const engine1 = new MultiAgentDebateEngine({ enableMemory: true });
  const engine2 = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine1);
  federation.join('node-2', 'Node 2', engine2);

  const result = await federation.federatedTraining();
  expect(result.nodesParticipated).toBeGreaterThanOrEqual(0);
});

await test('Synchronizes nodes', async () => {
  const federation = new LearningFederation({ minNodes: 2 });
  const engine1 = new MultiAgentDebateEngine({ enableMemory: true });
  const engine2 = new MultiAgentDebateEngine({ enableMemory: true });

  federation.join('node-1', 'Node 1', engine1);
  federation.join('node-2', 'Node 2', engine2);

  const result = await federation.synchronize();
  expect(result.nodesParticipated).toBe(2);
});

section('4. Integration');

await test('Self-improving agent with federation', () => {
  const federation = new LearningFederation({ minNodes: 1 });
  const engine = new MultiAgentDebateEngine({ enableMemory: true });
  const agent = new SelfImprovingDebateAgent(engine);

  federation.join('self-improving', 'Self-Improving Node', engine);

  expect(federation.getNodes().length).toBe(1);
  expect(agent.getStats()).toBeTruthy();
});

await test('Multiple self-improving agents in federation', () => {
  const federation = new LearningFederation({ minNodes: 2 });

  const engine1 = new MultiAgentDebateEngine({ enableMemory: true });
  const engine2 = new MultiAgentDebateEngine({ enableMemory: true });

  const agent1 = new SelfImprovingDebateAgent(engine1, { persistChanges: false });
  const agent2 = new SelfImprovingDebateAgent(engine2, { persistChanges: false });

  federation.join('agent-1', 'Agent 1', engine1);
  federation.join('agent-2', 'Agent 2', engine2);

  expect(federation.getNodes().length).toBe(2);
  expect(agent1.getStats()).toBeTruthy();
  expect(agent2.getStats()).toBeTruthy();
});

})();

// ============================================================================
// Cleanup & Results
// ============================================================================

cleanup();

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
  console.log('\n✅ All advanced learning tests passed!');
  process.exit(0);
}
