#!/usr/bin/env bun
/**
 * Conviction Voting System Tests
 */

import {
  ConvictionVotingEngine,
  getConvictionVotingEngine,
} from '../src/conviction-voting.js';
import { VeTokenEngine } from '../src/vetoken-model.js';

// ============================================================================
// Test Utilities
// ============================================================================

const results: { name: string; passed: boolean; error?: string }[] = [];
let currentSection = '';

function section(name: string) {
  currentSection = name;
  console.log(`\n${name}`);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name: `${currentSection} - ${name}`, passed: true });
    console.log(`   [PASS] ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name: `${currentSection} - ${name}`, passed: false, error: message });
    console.log(`   [FAIL] ${name}: ${message}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toThrow(expectedMessage?: string) {
      if (typeof actual !== 'function') {
        throw new Error('Expected a function');
      }
      try {
        (actual as () => void)();
        throw new Error('Expected function to throw');
      } catch (error) {
        if (expectedMessage && error instanceof Error) {
          if (!error.message.includes(expectedMessage)) {
            throw new Error(`Expected error containing "${expectedMessage}", got "${error.message}"`);
          }
        }
      }
    },
  };
}

// ============================================================================
// Mock VeToken Engine
// ============================================================================

function createMockVeEngine(): VeTokenEngine {
  const balances = new Map<string, number>();
  balances.set('alice', 10000);
  balances.set('bob', 5000);
  balances.set('charlie', 2000);

  return {
    getCurrentVeBalance: (address: string) => balances.get(address) || 0,
    getTotalVeSupply: () => {
      let total = 0;
      for (const balance of balances.values()) {
        total += balance;
      }
      return total;
    },
  } as unknown as VeTokenEngine;
}

// ============================================================================
// Test Configuration
// ============================================================================

const testConfig = {
  convictionGrowthHalfLife: 100,
  decayRate: 0.5,
  minStake: 100,
  minConviction: 1000,
  maxFundingPercentage: 0.1,
  spendingLimit: 1000000,
  alpha: 0.9,
  updateInterval: 10,
};

// ============================================================================
// Tests
// ============================================================================

console.log('Conviction Voting System Tests');
console.log('============================================================');

// ----------------------------------------------------------------------------
section('1. Proposal Creation');
// ----------------------------------------------------------------------------

test('Create signal proposal', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal(
    'signal',
    'Community Sentiment Check',
    'Gauge community interest in X',
    'alice'
  );

  expect(proposal.id).toBeTruthy();
  expect(proposal.type).toBe('signal');
  expect(proposal.status).toBe('active');
  expect(proposal.threshold).toBe(testConfig.minConviction);
});

test('Create funding proposal', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal(
    'funding',
    'Development Grant',
    'Fund development work',
    'bob',
    { requestedAmount: 50000, beneficiary: 'bob' }
  );

  expect(proposal.type).toBe('funding');
  expect(proposal.requestedAmount).toBe(50000);
  expect(proposal.threshold).toBeGreaterThan(testConfig.minConviction);
});

test('Funding exceeds maximum', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);
  engine.setTreasuryBalance(100000);

  expect(() => engine.createProposal(
    'funding',
    'Too Much',
    'Requesting too much',
    'alice',
    { requestedAmount: 50000 }
  )).toThrow('exceeds maximum');
});

test('Create parameter proposal', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal(
    'parameter',
    'Change Fee',
    'Change protocol fee to 1%',
    'alice',
    { parameterKey: 'protocol_fee', parameterValue: 0.01 }
  );

  expect(proposal.type).toBe('parameter');
  expect(proposal.parameterKey).toBe('protocol_fee');
});

// ----------------------------------------------------------------------------
section('2. Voting / Staking');
// ----------------------------------------------------------------------------

test('Stake vote on proposal', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  const vote = engine.stakeVote(proposal.id, 'alice', 1000);

  expect(vote.amount).toBe(1000);
  expect(vote.conviction).toBe(0);
  expect(vote.voter).toBe('alice');
});

test('Cannot stake more than balance', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');

  expect(() => engine.stakeVote(proposal.id, 'alice', 15000)).toThrow('Insufficient');
});

test('Stake below minimum', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');

  expect(() => engine.stakeVote(proposal.id, 'alice', 50)).toThrow('Minimum stake');
});

test('Multiple stakers on same proposal', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');

  engine.stakeVote(proposal.id, 'alice', 1000);
  engine.stakeVote(proposal.id, 'bob', 500);
  engine.stakeVote(proposal.id, 'charlie', 200);

  const updated = engine.getProposal(proposal.id);
  expect(updated?.stakedVotes.size).toBe(3);
});

test('Unstake vote', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  engine.stakeVote(proposal.id, 'alice', 1000);

  engine.unstakeVote(proposal.id, 'alice', 500);

  const updated = engine.getProposal(proposal.id);
  expect(updated?.stakedVotes.get('alice')?.amount).toBe(500);
});

test('Full unstake removes voter', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  engine.stakeVote(proposal.id, 'alice', 1000);

  engine.unstakeVote(proposal.id, 'alice', 1000);

  const updated = engine.getProposal(proposal.id);
  expect(updated?.stakedVotes.has('alice')).toBe(false);
});

// ----------------------------------------------------------------------------
section('3. Conviction Growth');
// ----------------------------------------------------------------------------

test('Conviction grows over time', async () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, {
    ...testConfig,
    convictionGrowthHalfLife: 50,
  });

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  engine.stakeVote(proposal.id, 'alice', 1000);

  const initial = engine.getConvictionProgress(proposal.id);
  expect(initial.current).toBe(0);

  await new Promise(resolve => setTimeout(resolve, 100));

  const updated = engine.getConvictionProgress(proposal.id);
  expect(updated.current).toBeGreaterThan(0);
});

test('Update all conviction', async () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, {
    ...testConfig,
    convictionGrowthHalfLife: 50,
  });

  const p1 = engine.createProposal('signal', 'Test 1', 'Test', 'alice');
  const p2 = engine.createProposal('signal', 'Test 2', 'Test', 'bob');

  engine.stakeVote(p1.id, 'alice', 1000);
  engine.stakeVote(p2.id, 'bob', 500);

  await new Promise(resolve => setTimeout(resolve, 100));

  const updates = engine.updateAllConviction();
  expect(updates.length).toBe(2);
  expect(updates[0].newConviction).toBeGreaterThan(updates[0].oldConviction);
});

test('Conviction decays on unstake', async () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, {
    ...testConfig,
    convictionGrowthHalfLife: 20,
    decayRate: 0.8,
  });

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  engine.stakeVote(proposal.id, 'alice', 1000);

  await new Promise(resolve => setTimeout(resolve, 50));

  const before = engine.getConvictionProgress(proposal.id);

  engine.unstakeVote(proposal.id, 'alice', 500);

  const after = engine.getConvictionProgress(proposal.id);
  expect(after.current).toBeLessThan(before.current);
});

// ----------------------------------------------------------------------------
section('4. Proposal Passing');
// ----------------------------------------------------------------------------

test('Proposal passes when threshold reached', async () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, {
    ...testConfig,
    convictionGrowthHalfLife: 10,
    minConviction: 100,
  });

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  engine.stakeVote(proposal.id, 'alice', 5000);

  await new Promise(resolve => setTimeout(resolve, 100));

  const updates = engine.updateAllConviction();
  const passedUpdate = updates.find(u => u.proposalId === proposal.id);

  expect(passedUpdate?.passed).toBe(true);

  const updated = engine.getProposal(proposal.id);
  expect(updated?.status).toBe('passed');
});

test('Execute passed proposal', async () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, {
    ...testConfig,
    convictionGrowthHalfLife: 10,
    minConviction: 100,
  });

  const proposal = engine.createProposal(
    'funding',
    'Grant',
    'Development grant',
    'alice',
    { requestedAmount: 1000, beneficiary: 'bob' }
  );

  engine.stakeVote(proposal.id, 'alice', 5000);

  await new Promise(resolve => setTimeout(resolve, 100));
  engine.updateAllConviction();

  const initialTreasury = engine.getTreasuryBalance();
  const result = engine.executeProposal(proposal.id, 'executor') as { amount: number };

  expect(result.amount).toBe(1000);
  expect(engine.getTreasuryBalance()).toBe(initialTreasury - 1000);
});

test('Cannot execute non-passed proposal', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');

  expect(() => engine.executeProposal(proposal.id, 'executor')).toThrow('passed');
});

// ----------------------------------------------------------------------------
section('5. Proposal Withdrawal');
// ----------------------------------------------------------------------------

test('Proposer can withdraw', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');
  engine.stakeVote(proposal.id, 'alice', 1000);

  engine.withdrawProposal(proposal.id, 'alice');

  const updated = engine.getProposal(proposal.id);
  expect(updated?.status).toBe('withdrawn');
  expect(updated?.stakedVotes.size).toBe(0);
});

test('Non-proposer cannot withdraw', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const proposal = engine.createProposal('signal', 'Test', 'Test', 'alice');

  expect(() => engine.withdrawProposal(proposal.id, 'bob')).toThrow('Only proposer');
});

// ----------------------------------------------------------------------------
section('6. Queries');
// ----------------------------------------------------------------------------

test('Get active proposals', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  engine.createProposal('signal', 'Test 1', 'Test', 'alice');
  engine.createProposal('funding', 'Test 2', 'Test', 'bob', { requestedAmount: 1000 });

  const active = engine.getActiveProposals();
  expect(active.length).toBe(2);
});

test('Get voter stakes', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  const p1 = engine.createProposal('signal', 'Test 1', 'Test', 'alice');
  const p2 = engine.createProposal('signal', 'Test 2', 'Test', 'bob');

  engine.stakeVote(p1.id, 'alice', 500);
  engine.stakeVote(p2.id, 'alice', 300);

  const stakes = engine.getVoterStakes('alice');
  expect(stakes.length).toBe(2);
  expect(engine.getVoterTotalStaked('alice')).toBe(800);
});

test('Get proposal ranking', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, {
    ...testConfig,
    minConviction: 10000,
  });

  const p1 = engine.createProposal('signal', 'Test 1', 'Test', 'alice');
  const p2 = engine.createProposal('signal', 'Test 2', 'Test', 'bob');

  engine.stakeVote(p1.id, 'alice', 5000);
  engine.stakeVote(p2.id, 'bob', 1000);

  const ranking = engine.getProposalRanking();
  expect(ranking.length).toBe(2);
  expect(ranking[0].proposal.id).toBe(p1.id);
});

// ----------------------------------------------------------------------------
section('7. Statistics');
// ----------------------------------------------------------------------------

test('Get stats', () => {
  const veEngine = createMockVeEngine();
  const engine = new ConvictionVotingEngine(veEngine, testConfig);

  engine.createProposal('signal', 'Test 1', 'Test', 'alice');
  const p2 = engine.createProposal('signal', 'Test 2', 'Test', 'bob');

  engine.stakeVote(p2.id, 'bob', 500);

  const stats = engine.getStats();
  expect(stats.totalProposals).toBe(2);
  expect(stats.activeProposals).toBe(2);
  expect(stats.totalStaked).toBe(500);
});

// ----------------------------------------------------------------------------
section('8. Singleton');
// ----------------------------------------------------------------------------

test('Singleton returns same instance', () => {
  const engine1 = getConvictionVotingEngine();
  const engine2 = getConvictionVotingEngine();
  expect(engine1).toBe(engine2);
});

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
  console.log('\n[SUCCESS] All conviction voting tests passed!');
  process.exit(0);
}
