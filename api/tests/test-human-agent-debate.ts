#!/usr/bin/env bun
/**
 * Human-Agent Debate System Tests
 */

import {
  HumanAgentDebateManager,
  getHumanAgentDebateManager,
  HumanParticipant,
} from '../src/human-agent-debate.js';
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
    toBeLessThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual > n) throw new Error(`Expected ${actual} <= ${n}`);
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

const mockParticipant: Omit<HumanParticipant, 'joinedAt'> = {
  id: 'user-1',
  name: 'Alice',
  role: 'voter',
  weight: 1.0,
};

// ============================================================================
// Tests
// ============================================================================

console.log('Human-Agent Debate System Tests');
console.log('==================================');

await (async () => {

section('1. Manager Creation');

await test('Creates manager', () => {
  const manager = new HumanAgentDebateManager();
  expect(manager).toBeTruthy();
});

await test('Creates with custom config', () => {
  const manager = new HumanAgentDebateManager({
    maxRounds: 5,
    humanWeight: 0.5,
  });
  expect(manager).toBeTruthy();
});

await test('Singleton returns same instance', () => {
  const m1 = getHumanAgentDebateManager();
  const m2 = getHumanAgentDebateManager();
  expect(m1).toBe(m2);
});

section('2. Session Management');

await test('Creates session', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  expect(id).toBeTruthy();
  expect(id).toContain('HSESSION-');
});

await test('Gets session by ID', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  const session = manager.getSession(id);
  expect(session).toBeTruthy();
  expect(session?.id).toBe(id);
});

await test('Session starts in pending status', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  const session = manager.getSession(id);
  expect(session?.status).toBe('pending');
});

await test('Lists all sessions', () => {
  const manager = new HumanAgentDebateManager();
  manager.createSession(mockProposal);
  manager.createSession(mockProposal);

  const sessions = manager.listSessions();
  expect(sessions.length).toBeGreaterThanOrEqual(2);
});

await test('Lists sessions by status', () => {
  const manager = new HumanAgentDebateManager();
  manager.createSession(mockProposal);

  const pending = manager.listSessions('pending');
  expect(pending.length).toBeGreaterThan(0);
});

await test('Emits session_created event', () => {
  const manager = new HumanAgentDebateManager();
  let eventFired = false;

  manager.on('session_created', () => {
    eventFired = true;
  });

  manager.createSession(mockProposal);
  expect(eventFired).toBe(true);
});

section('3. Human Participation');

await test('Joins session', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);

  const joined = manager.joinSession(id, mockParticipant);
  expect(joined).toBe(true);
});

await test('Gets participants', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  manager.joinSession(id, mockParticipant);

  const participants = manager.getParticipants(id);
  expect(participants?.length).toBe(1);
  expect(participants?.[0].name).toBe('Alice');
});

await test('Leaves session', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  manager.joinSession(id, mockParticipant);

  const left = manager.leaveSession(id, 'user-1');
  expect(left).toBe(true);

  const participants = manager.getParticipants(id);
  expect(participants?.length).toBe(0);
});

await test('Enforces max participants', () => {
  const manager = new HumanAgentDebateManager({ maxHumanParticipants: 2 });
  const id = manager.createSession(mockProposal);

  manager.joinSession(id, { ...mockParticipant, id: 'user-1' });
  manager.joinSession(id, { ...mockParticipant, id: 'user-2' });
  const thirdJoin = manager.joinSession(id, { ...mockParticipant, id: 'user-3' });

  expect(thirdJoin).toBe(false);
});

await test('Emits participant_joined event', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  let eventFired = false;

  manager.on('participant_joined', () => {
    eventFired = true;
  });

  manager.joinSession(id, mockParticipant);
  expect(eventFired).toBe(true);
});

section('4. Debate Flow');

await test('Opens session', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);

  const opened = manager.openSession(id);
  expect(opened).toBe(true);

  const session = manager.getSession(id);
  expect(session?.status).toBe('open');
});

await test('Cannot open already open session', () => {
  const manager = new HumanAgentDebateManager();
  const id = manager.createSession(mockProposal);
  manager.openSession(id);

  const reopened = manager.openSession(id);
  expect(reopened).toBe(false);
});

await test('Starts debate with minimum participants', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);

  const started = await manager.startDebate(id);
  expect(started).toBe(true);

  const session = manager.getSession(id);
  expect(session?.status).toBe('debating');
});

await test('Cannot start without minimum participants', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 2 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);

  const started = await manager.startDebate(id);
  expect(started).toBe(false);
});

await test('Emits debate_started event', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);

  let eventFired = false;
  manager.on('debate_started', () => {
    eventFired = true;
  });

  await manager.startDebate(id);
  expect(eventFired).toBe(true);
});

section('5. Argument Submission');

await test('Submits argument', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  const submitted = manager.submitArgument(id, 'user-1', {
    content: 'I support this proposal because it will increase TVL.',
    recommendation: 'support',
    confidence: 0.8,
  });

  expect(submitted).toBe(true);
});

await test('Cannot submit for non-participant', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  const submitted = manager.submitArgument(id, 'non-existent', {
    content: 'Test',
    recommendation: 'support',
    confidence: 0.8,
  });

  expect(submitted).toBe(false);
});

await test('Gets arguments', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  manager.submitArgument(id, 'user-1', {
    content: 'I support this!',
    recommendation: 'support',
    confidence: 0.9,
  });

  const args = manager.getArguments(id);
  expect(args?.human.length).toBe(1);
});

await test('Emits argument_submitted event', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  let eventFired = false;
  manager.on('argument_submitted', () => {
    eventFired = true;
  });

  manager.submitArgument(id, 'user-1', {
    content: 'Test argument',
    recommendation: 'support',
    confidence: 0.8,
  });

  expect(eventFired).toBe(true);
});

section('6. Voting & Results');

await test('Starts voting', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  const started = manager.startVoting(id);
  expect(started).toBe(true);

  const session = manager.getSession(id);
  expect(session?.status).toBe('voting');
});

await test('Closes voting and gets result', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  manager.submitArgument(id, 'user-1', {
    content: 'I support this!',
    recommendation: 'support',
    confidence: 0.9,
  });

  const result = manager.closeVoting(id);
  expect(result).toBeTruthy();
  expect(result?.finalRecommendation).toBeTruthy();
});

await test('Result includes human and AI votes', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  manager.submitArgument(id, 'user-1', {
    content: 'Support!',
    recommendation: 'support',
    confidence: 0.8,
  });

  const result = manager.closeVoting(id);
  expect(result?.humanVotes).toBeTruthy();
  expect(result?.aiVotes).toBeTruthy();
  expect(result?.humanVotes.support).toBe(1);
});

await test('Session closes after voting', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  manager.closeVoting(id);

  const session = manager.getSession(id);
  expect(session?.status).toBe('closed');
});

section('7. Turn Management');

await test('Gets current turn', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  const turn = manager.getCurrentTurn(id);
  expect(turn).toBeTruthy();
  expect(turn?.id).toBeTruthy();
});

await test('Turn identifies if human or AI', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  const turn = manager.getCurrentTurn(id);
  expect(typeof turn?.isHuman).toBe('boolean');
});

section('8. Weight Calculation');

await test('Result uses configured weights', async () => {
  const manager = new HumanAgentDebateManager({
    minHumanParticipants: 1,
    humanWeight: 0.6, // 60% human, 40% AI
  });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  manager.submitArgument(id, 'user-1', {
    content: 'Support!',
    recommendation: 'support',
    confidence: 0.9,
  });

  const result = manager.closeVoting(id);
  expect(result?.humanWeight).toBe(0.6);
  expect(result?.aiWeight).toBe(0.4);
});

await test('Consensus strength is bounded', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  manager.submitArgument(id, 'user-1', {
    content: 'Support!',
    recommendation: 'support',
    confidence: 0.9,
  });

  const result = manager.closeVoting(id);
  expect(result?.consensusStrength).toBeGreaterThanOrEqual(0);
  expect(result?.consensusStrength).toBeLessThanOrEqual(1);
});

section('9. Stats');

await test('Gets manager stats', async () => {
  const manager = new HumanAgentDebateManager({ minHumanParticipants: 1 });
  const id = manager.createSession(mockProposal);
  manager.openSession(id);
  manager.joinSession(id, mockParticipant);
  await manager.startDebate(id);

  const stats = manager.getStats() as any;
  expect(stats.totalSessions).toBeGreaterThan(0);
  expect(stats.activeSessions).toBeGreaterThan(0);
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
  console.log('\n✅ All human-agent debate tests passed!');
  process.exit(0);
}
