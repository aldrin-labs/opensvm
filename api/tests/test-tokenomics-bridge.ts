#!/usr/bin/env bun
/**
 * MCP Tokenomics Bridge Tests
 */

import { UnifiedMCPRegistry } from '../src/mcp-registry-unified.js';
import {
  MCPTokenomicsBridge,
  STAKE_CONFIGS,
  StakeDuration,
} from '../src/mcp-tokenomics-bridge.js';

console.log('MCP Tokenomics Bridge Tests');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

const events: Array<{ event: string; data: any }> = [];
const mockEmitter = {
  emit: (event: string, data: any) => events.push({ event, data }),
};

async function test(name: string, fn: () => void | Promise<void>) {
  events.length = 0; // Clear events before each test
  try {
    await fn();
    console.log(`   [PASS] ${name}`);
    passed++;
  } catch (error) {
    console.log(`   [FAIL] ${name}`);
    console.log(`      Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runAllTests() {

// ============================================================================
// Staking Tests
// ============================================================================

console.log('\n1. Staking Integration');

await test('Create stake with 30d duration', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  const stake = bridge.createStake('wallet1', BigInt(10000) * BigInt(1e9), '30d');

  assert(stake.wallet === 'wallet1', 'Wallet should match');
  assert(stake.amount === BigInt(10000) * BigInt(1e9), 'Amount should match');
  assert(stake.duration === '30d', 'Duration should match');
  assert(stake.multiplier === 1.25, '30d multiplier should be 1.25');
  assert(stake.status === 'active', 'Status should be active');

  // Check event was emitted
  assert(events.length === 1, 'Should emit 1 event');
  assert(events[0].event === 'stake_created', 'Should emit stake_created event');
});

await test('Create stake with 365d duration has 3x multiplier', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  const stake = bridge.createStake('whale', BigInt(100000) * BigInt(1e9), '365d');

  assert(stake.multiplier === 3.0, '365d should have 3x multiplier');
  assert(stake.effectiveAmount === BigInt(300000) * BigInt(1e9), 'Effective should be 3x base');
});

await test('Get wallet total staked', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  bridge.createStake('multi-staker', BigInt(5000) * BigInt(1e9), '30d');
  bridge.createStake('multi-staker', BigInt(3000) * BigInt(1e9), '90d');

  const totals = bridge.getWalletTotalStaked('multi-staker');

  assert(totals.staked === BigInt(8000) * BigInt(1e9), 'Total staked should sum');
  // 5000 * 1.25 + 3000 * 1.5 = 6250 + 4500 = 10750
  assert(totals.effective === BigInt(10750) * BigInt(1e9), 'Effective should be weighted');
});

await test('Unstake returns amount minus penalty if early', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  const stake = bridge.createStake('early-unstaker', BigInt(10000) * BigInt(1e9), '90d');

  const result = bridge.unstake(stake.id);

  // 90d has 15% early unstake penalty
  const expectedReturn = BigInt(8500) * BigInt(1e9);
  const expectedPenalty = BigInt(1500) * BigInt(1e9);

  assert(result.returnAmount === expectedReturn, `Return should be 8500, got ${result.returnAmount}`);
  assert(result.penalty === expectedPenalty, `Penalty should be 1500, got ${result.penalty}`);
  assert(result.success === true, 'Should succeed');

  // Check event
  const withdrawEvent = events.find(e => e.event === 'stake_withdrawn');
  assert(withdrawEvent !== undefined, 'Should emit stake_withdrawn event');
  assert(withdrawEvent!.data.data.wasEarly === true, 'Should indicate early withdrawal');
});

await test('Get stake config for valid duration', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry);

  const config = bridge.getStakeConfig('180d');

  assert(config.durationDays === 180, 'Duration days should be 180');
  assert(config.multiplier === 2.0, 'Multiplier should be 2.0');
  assert(config.earlyUnstakePenalty === 20, 'Early penalty should be 20%');
});

// ============================================================================
// Governance Integration Tests
// ============================================================================

console.log('\n2. Governance Integration');

await test('Create proposal with staked tokens', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  // First stake enough to meet proposal threshold
  bridge.createStake('proposer', BigInt(5000) * BigInt(1e9), '90d');

  const proposal = bridge.createProposal('proposer', {
    title: 'Test Proposal',
    description: 'A test proposal',
    type: 'general',
    actions: [],
  });

  assert(proposal.id.startsWith('ADV-'), 'Should create proposal');
  assert(proposal.proposer === 'proposer', 'Proposer should match');

  const createEvent = events.find(e => e.event === 'proposal_created');
  assert(createEvent !== undefined, 'Should emit proposal_created');
});

await test('Vote on proposal emits event', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  bridge.createStake('proposer', BigInt(5000) * BigInt(1e9), '90d');
  bridge.createStake('voter', BigInt(2000) * BigInt(1e9), '30d');

  const proposal = bridge.createProposal('proposer', {
    title: 'Vote Test',
    description: 'Test',
    type: 'general',
    actions: [],
  });

  // Activate proposal for voting
  const p = bridge.getProposal(proposal.id)!;
  (p as any).status = 'active';

  bridge.vote(proposal.id, 'voter', 'for', 'I support this');

  const voteEvent = events.find(e => e.event === 'vote_cast');
  assert(voteEvent !== undefined, 'Should emit vote_cast');
  assert(voteEvent!.data.data.support === 'for', 'Support should be for');
});

await test('Boost proposal emits event', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  bridge.createStake('proposer', BigInt(5000) * BigInt(1e9), '90d');
  bridge.createStake('booster', BigInt(10000) * BigInt(1e9), '365d');

  const proposal = bridge.createProposal('proposer', {
    title: 'Boost Test',
    description: 'Test',
    type: 'general',
    actions: [],
  });

  const p = bridge.getProposal(proposal.id)!;
  (p as any).status = 'active';

  bridge.boostProposal(proposal.id, 'booster', 'pass');

  const boostEvent = events.find(e => e.event === 'boost_applied');
  assert(boostEvent !== undefined, 'Should emit boost_applied');
  assert(boostEvent!.data.data.prediction === 'pass', 'Prediction should be pass');
});

await test('Buy prediction shares updates market', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  bridge.createStake('proposer', BigInt(5000) * BigInt(1e9), '90d');

  const proposal = bridge.createProposal('proposer', {
    title: 'Prediction Test',
    description: 'Test',
    type: 'general',
    actions: [],
  });

  bridge.buyPredictionShares(proposal.id, 'trader', 'yes', BigInt(1000) * BigInt(1e9));

  const predEvent = events.find(e => e.event === 'prediction_update');
  assert(predEvent !== undefined, 'Should emit prediction_update');

  const market = bridge.getMarketPrediction(proposal.id);
  assert(market !== null, 'Market should exist');
  assert(market!.willPass > 0.5, 'Yes price should increase');
});

// ============================================================================
// Statistics Tests
// ============================================================================

console.log('\n3. Statistics');

await test('Get comprehensive stats', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry, undefined, mockEmitter);

  bridge.createStake('staker1', BigInt(5000) * BigInt(1e9), '30d');
  bridge.createStake('staker2', BigInt(3000) * BigInt(1e9), '90d');
  bridge.createStake('staker3', BigInt(2000) * BigInt(1e9), '30d');

  bridge.createProposal('staker1', {
    title: 'Stats Test',
    description: 'Test',
    type: 'general',
    actions: [],
  });

  const stats = bridge.getStats();

  assert(stats.staking.totalStakers === 3, 'Should have 3 stakers');
  assert(stats.governance.totalProposals === 1, 'Should have 1 proposal');
  assert(BigInt(stats.staking.totalStaked) === BigInt(10000) * BigInt(1e9), 'Total staked should sum');
});

await test('Stakes by duration breakdown', () => {
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry);

  bridge.createStake('a', BigInt(1000) * BigInt(1e9), '30d');
  bridge.createStake('b', BigInt(2000) * BigInt(1e9), '30d');
  bridge.createStake('c', BigInt(5000) * BigInt(1e9), '90d');

  const stats = bridge.getStats();
  const byDuration = stats.staking.stakesByDuration;

  assert(byDuration['30d']?.count === 2, 'Should have 2 30d stakes');
  assert(byDuration['90d']?.count === 1, 'Should have 1 90d stake');
});

// ============================================================================
// Config Tests
// ============================================================================

console.log('\n4. Configuration');

await test('Stake configs are valid', () => {
  for (const config of STAKE_CONFIGS) {
    assert(config.durationDays > 0, `${config.duration} should have positive days`);
    assert(config.multiplier >= 1, `${config.duration} multiplier should be >= 1`);
    assert(config.earlyUnstakePenalty >= 0 && config.earlyUnstakePenalty <= 100, 'Penalty should be 0-100');
  }
});

await test('Longer durations have higher multipliers', () => {
  const durations: StakeDuration[] = ['7d', '30d', '90d', '180d', '365d'];
  const registry = new UnifiedMCPRegistry();
  const bridge = new MCPTokenomicsBridge(registry);

  for (let i = 1; i < durations.length; i++) {
    const prev = bridge.getStakeConfig(durations[i - 1]);
    const curr = bridge.getStakeConfig(durations[i]);
    assert(curr.multiplier >= prev.multiplier, `${durations[i]} should have >= multiplier than ${durations[i - 1]}`);
  }
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All tokenomics bridge tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
