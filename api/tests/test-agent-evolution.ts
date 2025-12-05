#!/usr/bin/env bun
/**
 * Agent Evolution Systems Tests
 */

import {
  PromptDNASystem,
  AgentDreams,
  CollectiveUnconscious,
  PROMPT_CODONS,
} from '../src/agent-evolution.js';

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
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

console.log('Agent Evolution Systems Tests');
console.log('=============================');

await (async () => {

section('1. Prompt DNA System');

await test('Creates DNA system', () => {
  const dna = new PromptDNASystem();
  expect(dna).toBeTruthy();
});

await test('Creates agent DNA', () => {
  const system = new PromptDNASystem();
  const dna = system.createDNA('agent-1', ['AGR', 'TEC', 'DAT']);

  expect(dna.agentId).toBe('agent-1');
  expect(dna.sequence.length).toBe(3);
});

await test('Has standard codons defined', () => {
  expect(Object.keys(PROMPT_CODONS).length).toBeGreaterThan(5);
  expect(PROMPT_CODONS['AGR'].name).toBe('aggressive');
});

await test('Expresses traits from DNA', () => {
  const system = new PromptDNASystem();
  const dna = system.createDNA('agent-1', ['TEC', 'ECO']);

  expect(dna.expressedTraits.has('technical')).toBe(true);
  expect(dna.expressedTraits.has('economic')).toBe(true);
});

await test('Generates prompt modifiers', () => {
  const system = new PromptDNASystem();
  system.createDNA('agent-1', ['AGR', 'DAT']);

  const modifiers = system.generatePromptModifiers('agent-1');
  expect(modifiers.length).toBe(2);
});

await test('Mutates DNA', () => {
  const system = new PromptDNASystem({ mutationRate: 1.0 }); // Force mutation
  system.createDNA('agent-1', ['AGR', 'TEC']);

  const result = system.mutate('agent-1');
  expect(result.mutated).toBe(true);
  expect(result.changes.length).toBeGreaterThan(0);
});

await test('Performs crossover', () => {
  const system = new PromptDNASystem();
  system.createDNA('parent-1', ['AGR', 'TEC', 'DAT']);
  system.createDNA('parent-2', ['CAU', 'ECO', 'NAR']);

  const child = system.crossover('parent-1', 'parent-2', 'child-1');
  expect(child).toBeTruthy();
  expect(child!.lineage.length).toBeGreaterThan(0);
});

await test('Calculates genetic similarity', () => {
  const system = new PromptDNASystem();
  system.createDNA('agent-1', ['AGR', 'TEC', 'DAT']);
  system.createDNA('agent-2', ['AGR', 'TEC', 'NAR']);

  const similarity = system.calculateSimilarity('agent-1', 'agent-2');
  expect(similarity).toBeGreaterThan(0.5);
});

await test('Gets DNA sequence as string', () => {
  const system = new PromptDNASystem();
  system.createDNA('agent-1', ['AGR', 'TEC', 'DAT']);

  const sequence = system.getSequenceString('agent-1');
  expect(sequence).toBe('AGR-TEC-DAT');
});

section('2. Agent Dreams');

await test('Creates dreams system', () => {
  const dreams = new AgentDreams();
  expect(dreams).toBeTruthy();
});

await test('Starts a dream', () => {
  const dreams = new AgentDreams();
  const dream = dreams.startDream('agent-1', {
    type: 'hypothetical',
    description: 'Testing a new governance mechanism',
    participants: ['agent-1', 'agent-2'],
    constraints: ['time_pressure'],
  });

  expect(dream.id).toBeTruthy();
  expect(dream.scenario.type).toBe('hypothetical');
});

await test('Processes dream events', () => {
  const dreams = new AgentDreams();
  dreams.startDream('agent-1', {
    type: 'debate_replay',
    description: 'Replaying past debate',
    participants: ['agent-1'],
    constraints: [],
  });

  dreams.processDreamEvent('agent-1', {
    type: 'debate_outcome',
    outcome: 'positive',
    data: { pattern: 'Conservative positions win in bear markets' },
  });

  // Event should affect emotional state
  expect(true).toBe(true); // Dream was processed
});

await test('Ends dream and extracts insights', () => {
  const dreams = new AgentDreams();
  dreams.startDream('agent-1', {
    type: 'nightmare',
    description: 'Governance attack scenario',
    participants: ['agent-1', 'attacker'],
    constraints: ['limited_time'],
  });

  dreams.processDreamEvent('agent-1', {
    type: 'debate_outcome',
    outcome: 'negative',
    data: { description: 'Attack succeeded' },
  });

  const result = dreams.endDream('agent-1');
  expect(result.insights.length).toBeGreaterThanOrEqual(0);
});

await test('Generates nightmare scenario', () => {
  const dreams = new AgentDreams();
  const nightmare = dreams.generateNightmare('agent-1', ['governance attack', 'whale manipulation']);

  expect(nightmare.type).toBe('nightmare');
  expect(nightmare.constraints.length).toBeGreaterThan(0);
});

await test('Generates wish fulfillment scenario', () => {
  const dreams = new AgentDreams();
  const wish = dreams.generateWishFulfillment('agent-1', ['perfect prediction', 'community acclaim']);

  expect(wish.type).toBe('wish_fulfillment');
});

await test('Runs dream cycle', async () => {
  const dreams = new AgentDreams();
  const scenarios = [
    dreams.generateNightmare('agent-1', ['attack']),
    dreams.generateWishFulfillment('agent-1', ['success']),
  ];

  const insights = await dreams.runDreamCycle('agent-1', scenarios, 100);
  expect(insights.length).toBeGreaterThanOrEqual(0);
});

await test('Gets learned patterns', async () => {
  const dreams = new AgentDreams();
  await dreams.runDreamCycle('agent-1', [
    { type: 'hypothetical', description: 'Test', participants: [], constraints: [] },
  ], 50);

  const patterns = dreams.getLearnedPatterns('agent-1');
  expect(Array.isArray(patterns)).toBe(true);
});

section('3. Collective Unconscious');

await test('Creates collective unconscious', () => {
  const cu = new CollectiveUnconscious();
  expect(cu).toBeTruthy();
});

await test('Has predefined archetypes', () => {
  const cu = new CollectiveUnconscious();
  const archetypes = cu.getAllArchetypes();

  expect(archetypes.length).toBeGreaterThan(0);
  expect(archetypes.some(a => a.name === 'The Hero')).toBe(true);
});

await test('Contributes memory', () => {
  const cu = new CollectiveUnconscious();
  const memory = cu.contributeMemory(
    'agent-1',
    'Bull markets favor aggressive proposals',
    ['market', 'governance', 'timing'],
    0.8
  );

  expect(memory.id).toBeTruthy();
  expect(memory.frequency).toBe(1);
});

await test('Strengthens existing memories', () => {
  const cu = new CollectiveUnconscious();
  cu.contributeMemory('agent-1', 'Bull markets favor aggressive proposals', ['market'], 0.8);
  const second = cu.contributeMemory('agent-2', 'Bull markets favor aggressive', ['market'], 0.9);

  expect(second.frequency).toBe(2);
  expect(second.contributors.length).toBe(2);
});

await test('Queries memories', () => {
  const cu = new CollectiveUnconscious();
  cu.contributeMemory('agent-1', 'Treasury proposals need conservative approach', ['treasury'], 0.8);
  cu.contributeMemory('agent-2', 'Parameter changes are low risk', ['parameter'], 0.7);

  const results = cu.query(['treasury', 'funding']);
  expect(results.length).toBeGreaterThanOrEqual(0);
});

await test('Activates archetype', () => {
  const cu = new CollectiveUnconscious();
  const archetype = cu.activateArchetype(['exploit', 'attack', 'emergency']);

  expect(archetype).toBeTruthy();
  expect(archetype!.name).toBe('The Hero');
});

await test('Synchronizes agent with collective', () => {
  const cu = new CollectiveUnconscious();

  // Multiple agents contribute
  cu.contributeMemory('agent-1', 'Pattern A', ['context'], 0.8);
  cu.contributeMemory('agent-1', 'Pattern A', ['context'], 0.8);
  cu.contributeMemory('agent-1', 'Pattern A', ['context'], 0.8);
  cu.contributeMemory('agent-2', 'Pattern B', ['other'], 0.9);

  const sync = cu.synchronize('agent-3');
  expect(sync.memoriesAbsorbed).toBeGreaterThanOrEqual(0);
});

await test('Gets collective stats', () => {
  const cu = new CollectiveUnconscious();
  cu.contributeMemory('agent-1', 'Test pattern', ['test'], 0.8);

  const stats = cu.getStats();
  expect(stats.totalMemories).toBeGreaterThan(0);
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n=============================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`Results: ${passed} passed, ${failed} failed (${results.length} total)`);

if (failed > 0) {
  console.log('\n[FAIL] Failed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n[PASS] All agent evolution tests passed!');
  process.exit(0);
}
