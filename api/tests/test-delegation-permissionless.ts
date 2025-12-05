#!/usr/bin/env bun
/**
 * Vote Delegation and Permissionless Gauge Tests
 */

import { VeTokenEngine } from '../src/vetoken-model.js';
import {
  DelegationManager,
  getDelegationManager,
} from '../src/vote-delegation.js';
import {
  PermissionlessGaugeManager,
  getPermissionlessGaugeManager,
} from '../src/permissionless-gauges.js';
import { GaugeController } from '../src/gauge-voting.js';

console.log('Vote Delegation and Permissionless Gauge Tests');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
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

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function runAllTests() {

// ============================================================================
// Vote Delegation Tests
// ============================================================================

console.log('\n1. Vote Delegation - Basic');

await test('Delegate voting power', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('delegator1', 1000, 4 * YEAR_MS);

  const delegation = delegationMgr.delegate('delegator1', 'delegate1', 50);

  assert(delegation.id.startsWith('DEL-'), 'ID should have prefix');
  assert(delegation.percentage === 50, 'Percentage should be 50');
  assert(delegation.veAmount === 500, 'Should delegate 500 veSVMAI');
});

await test('Cannot delegate to self', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('self', 1000, 4 * YEAR_MS);

  try {
    delegationMgr.delegate('self', 'self', 100);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('yourself'), 'Should mention self');
  }
});

await test('Cannot delegate without veSVMAI', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  try {
    delegationMgr.delegate('noVe', 'someDelegate', 50);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('veSVMAI'), 'Should mention veSVMAI');
  }
});

await test('Cannot exceed 100% delegation', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('overDelegator', 1000, 4 * YEAR_MS);

  delegationMgr.delegate('overDelegator', 'del1', 60);

  try {
    delegationMgr.delegate('overDelegator', 'del2', 50);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('100%'), 'Should mention limit');
  }
});

await test('Delegate to multiple addresses', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('multiDel', 1000, 4 * YEAR_MS);

  delegationMgr.delegate('multiDel', 'del1', 30);
  delegationMgr.delegate('multiDel', 'del2', 40);
  delegationMgr.delegate('multiDel', 'del3', 30);

  const delegations = delegationMgr.getDelegationsFrom('multiDel');
  assert(delegations.length === 3, 'Should have 3 delegations');

  const total = delegations.reduce((sum, d) => sum + d.percentage, 0);
  assert(total === 100, 'Total should be 100%');
});

// ============================================================================
// Vote Delegation - Voting Power
// ============================================================================

console.log('\n2. Vote Delegation - Voting Power');

await test('Get effective voting power', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('delegator', 1000, 4 * YEAR_MS);
  veEngine.createLock('delegate', 500, 4 * YEAR_MS);

  delegationMgr.delegate('delegator', 'delegate', 50);

  const delegatorPower = delegationMgr.getEffectiveVotingPower('delegator');
  const delegatePower = delegationMgr.getEffectiveVotingPower('delegate');

  // delegator: 1000 own - 500 delegated = 500
  // delegate: 500 own + 500 received = 1000
  assert(delegatorPower === 500, 'Delegator should have 500 effective');
  assert(delegatePower === 1000, 'Delegate should have 1000 effective');
});

await test('Get delegate profile', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('d1', 1000, 4 * YEAR_MS);
  veEngine.createLock('d2', 500, 4 * YEAR_MS);
  veEngine.createLock('receiver', 200, 4 * YEAR_MS);

  delegationMgr.delegate('d1', 'receiver', 100);
  delegationMgr.delegate('d2', 'receiver', 100);

  const profile = delegationMgr.getDelegateProfile('receiver');

  assert(profile.ownVePower === 200, 'Own power should be 200');
  assert(profile.delegatedToThem === 1500, 'Should receive 1500');
  assert(profile.delegatorCount === 2, 'Should have 2 delegators');
  assert(profile.effectivePower === 1700, 'Effective should be 1700');
});

await test('Revoke delegation', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('revoker', 1000, 4 * YEAR_MS);

  const delegation = delegationMgr.delegate('revoker', 'revokee', 100);
  delegationMgr.revoke(delegation.id);

  const power = delegationMgr.getEffectiveVotingPower('revoker');
  assert(power === 1000, 'Should have full power after revoke');
});

await test('Cannot revoke locked delegation', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('locked', 1000, 4 * YEAR_MS);

  const lockUntil = Date.now() + DAY_MS;
  const delegation = delegationMgr.delegate('locked', 'lockee', 50, lockUntil);

  try {
    delegationMgr.revoke(delegation.id);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('locked'), 'Should mention lock');
  }
});

// ============================================================================
// Vote Delegation - Statistics
// ============================================================================

console.log('\n3. Vote Delegation - Statistics');

await test('Get top delegates', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('d1', 1000, 4 * YEAR_MS);
  veEngine.createLock('d2', 500, 4 * YEAR_MS);
  veEngine.createLock('top1', 100, 4 * YEAR_MS);
  veEngine.createLock('top2', 50, 4 * YEAR_MS);

  delegationMgr.delegate('d1', 'top1', 100);
  delegationMgr.delegate('d2', 'top1', 100);

  const topDelegates = delegationMgr.getTopDelegates(2);

  assert(topDelegates.length >= 1, 'Should have top delegates');
  assert(topDelegates[0].address === 'top1', 'top1 should be first');
});

await test('Get delegation stats', () => {
  const veEngine = new VeTokenEngine();
  const delegationMgr = new DelegationManager(veEngine);

  veEngine.createLock('s1', 1000, 4 * YEAR_MS);
  veEngine.createLock('s2', 500, 4 * YEAR_MS);

  delegationMgr.delegate('s1', 'r1', 50);
  delegationMgr.delegate('s2', 'r1', 100);

  const stats = delegationMgr.getStats();

  assert(stats.totalDelegations === 2, 'Should have 2 delegations');
  assert(stats.uniqueDelegators === 2, 'Should have 2 delegators');
  assert(stats.totalDelegatedVe === 1000, 'Should have 1000 delegated');
});

// ============================================================================
// Permissionless Gauges - Proposals
// ============================================================================

console.log('\n4. Permissionless Gauges - Proposals');

await test('Create gauge proposal', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 1000, // 1 second for testing
    activationDelay: 0,
  });

  const proposal = permissionless.propose(
    'proposer1',
    'NEW-POOL',
    'New Pool',
    'A new exciting pool',
    1000
  );

  assert(proposal.id.startsWith('PROP-'), 'ID should have prefix');
  assert(proposal.status === 'pending', 'Status should be pending');
  assert(proposal.deposit === 1000, 'Deposit should be 1000');
});

await test('Enforce minimum deposit', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    minDeposit: 500,
  });

  try {
    permissionless.propose('proposer', 'POOL', 'Pool', 'Desc', 100);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Minimum'), 'Should mention minimum');
  }
});

await test('Prevent duplicate pool proposals', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController);

  permissionless.propose('p1', 'SAME-POOL', 'Same', 'Desc', 1000);

  try {
    permissionless.propose('p2', 'SAME-POOL', 'Same', 'Desc', 1000);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('already exists'), 'Should mention exists');
  }
});

// ============================================================================
// Permissionless Gauges - Voting
// ============================================================================

console.log('\n5. Permissionless Gauges - Voting');

await test('Vote on proposal', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 60000, // 1 minute
  });

  veEngine.createLock('voter1', 1000, 4 * YEAR_MS);

  const proposal = permissionless.propose('proposer', 'VOTE-POOL', 'Vote Pool', 'Desc', 1000);

  permissionless.vote(proposal.id, 'voter1', true);

  const updated = permissionless.getProposal(proposal.id);
  assert(updated!.supportVotes === 1000, 'Should have 1000 support votes');
});

await test('Veto proposal', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 60000,
  });

  veEngine.createLock('vetoer', 500, 4 * YEAR_MS);

  const proposal = permissionless.propose('proposer', 'VETO-POOL', 'Veto Pool', 'Desc', 1000);

  permissionless.vote(proposal.id, 'vetoer', false);

  const updated = permissionless.getProposal(proposal.id);
  assert(updated!.vetoVotes === 500, 'Should have 500 veto votes');
});

await test('Cannot vote without veSVMAI', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController);

  const proposal = permissionless.propose('proposer', 'NO-VE-POOL', 'Pool', 'Desc', 1000);

  try {
    permissionless.vote(proposal.id, 'noVeVoter', true);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('veSVMAI'), 'Should mention veSVMAI');
  }
});

// ============================================================================
// Permissionless Gauges - Finalization
// ============================================================================

console.log('\n6. Permissionless Gauges - Finalization');

await test('Finalize passed proposal', async () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 100, // 100ms
    minParticipation: 0.01,
    supportThreshold: 0.5,
    activationDelay: 0,
  });

  veEngine.createLock('passVoter', 10000, 4 * YEAR_MS);

  const proposal = permissionless.propose('proposer', 'PASS-POOL', 'Pass Pool', 'Desc', 1000);
  permissionless.vote(proposal.id, 'passVoter', true);

  await new Promise(r => setTimeout(r, 150)); // Wait for voting period

  const finalized = permissionless.finalize(proposal.id);

  assert(finalized.status === 'passed', 'Status should be passed');
});

await test('Finalize vetoed proposal (slash)', async () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 100,
    vetoThreshold: 0.1, // 10% can veto
    slashPercentage: 0.5,
    activationDelay: 0,
  });

  veEngine.createLock('vetoVoter', 10000, 4 * YEAR_MS);

  const proposal = permissionless.propose('proposer', 'SLASH-POOL', 'Slash Pool', 'Desc', 1000);
  permissionless.vote(proposal.id, 'vetoVoter', false);

  await new Promise(r => setTimeout(r, 150));

  const finalized = permissionless.finalize(proposal.id);

  assert(finalized.status === 'vetoed', 'Status should be vetoed');

  const stats = permissionless.getStats();
  assert(stats.treasuryBalance === 500, 'Treasury should have 500 (50% slash)');
});

await test('Activate passed proposal', async () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 100,
    minParticipation: 0.01,
    supportThreshold: 0.5,
    activationDelay: 100,
  });

  veEngine.createLock('activateVoter', 10000, 4 * YEAR_MS);

  const proposal = permissionless.propose('proposer', 'ACTIVATE-POOL', 'Activate', 'Desc', 1000);
  permissionless.vote(proposal.id, 'activateVoter', true);

  await new Promise(r => setTimeout(r, 150));
  permissionless.finalize(proposal.id);

  await new Promise(r => setTimeout(r, 150)); // Wait for activation delay

  const gauge = permissionless.activate(proposal.id);

  assert(gauge.id.startsWith('GAUGE-'), 'Should create gauge');
  assert(gauge.poolId === 'ACTIVATE-POOL', 'Pool ID should match');
});

// ============================================================================
// Permissionless Gauges - Metrics
// ============================================================================

console.log('\n7. Permissionless Gauges - Metrics');

await test('Track gauge metrics', async () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 100,
    minParticipation: 0.01,
    activationDelay: 0,
  });

  veEngine.createLock('metricsVoter', 10000, 4 * YEAR_MS);

  const proposal = permissionless.propose('proposer', 'METRICS-POOL', 'Metrics', 'Desc', 1000);
  permissionless.vote(proposal.id, 'metricsVoter', true);

  await new Promise(r => setTimeout(r, 150));
  permissionless.finalize(proposal.id);

  const gauge = permissionless.activate(proposal.id);

  // Update metrics
  permissionless.updateMetrics(gauge.id, 100000, 1000, 50, 500000);

  const metrics = permissionless.getMetrics(gauge.id);

  assert(metrics !== null, 'Should have metrics');
  assert(metrics!.totalVolumeRouted === 100000, 'Volume should be 100000');
  assert(metrics!.performanceScore > 0, 'Should have positive score');
});

await test('Get performance ranking', async () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController, {
    proposalPeriod: 50,
    minParticipation: 0.01,
    activationDelay: 0,
  });

  veEngine.createLock('rankVoter', 10000, 4 * YEAR_MS);

  // Create two gauges
  const p1 = permissionless.propose('p1', 'RANK-1', 'Rank 1', 'Desc', 1000);
  permissionless.vote(p1.id, 'rankVoter', true);
  await new Promise(r => setTimeout(r, 100));
  permissionless.finalize(p1.id);
  const g1 = permissionless.activate(p1.id);

  // Reset cooldown for testing
  (permissionless as any).proposerCooldowns.clear();

  const p2 = permissionless.propose('p2', 'RANK-2', 'Rank 2', 'Desc', 1000);
  permissionless.vote(p2.id, 'rankVoter', true);
  await new Promise(r => setTimeout(r, 100));
  permissionless.finalize(p2.id);
  const g2 = permissionless.activate(p2.id);

  // Give g1 better metrics
  permissionless.updateMetrics(g1.id, 500000, 5000, 100, 1000000);
  permissionless.updateMetrics(g2.id, 100000, 1000, 20, 200000);

  const ranking = permissionless.getPerformanceRanking();

  assert(ranking.length === 2, 'Should have 2 gauges');
  assert(ranking[0].gaugeId === g1.id, 'g1 should be ranked first');
});

// ============================================================================
// Statistics
// ============================================================================

console.log('\n8. Statistics');

await test('Get permissionless stats', () => {
  const veEngine = new VeTokenEngine();
  const gaugeController = new GaugeController(veEngine);
  const permissionless = new PermissionlessGaugeManager(veEngine, gaugeController);

  permissionless.propose('p1', 'STAT-1', 'Stat 1', 'Desc', 1000);
  permissionless.propose('p2', 'STAT-2', 'Stat 2', 'Desc', 2000);

  const stats = permissionless.getStats();

  assert(stats.totalProposals === 2, 'Should have 2 proposals');
  assert(stats.pendingProposals === 2, 'Both should be pending');
  assert(stats.totalDeposited === 3000, 'Total deposited should be 3000');
});

// ============================================================================
// Singletons
// ============================================================================

console.log('\n9. Singletons');

await test('Delegation manager singleton', () => {
  const d1 = getDelegationManager();
  const d2 = getDelegationManager();

  assert(d1 === d2, 'Should return same instance');
});

await test('Permissionless gauge manager singleton', () => {
  const p1 = getPermissionlessGaugeManager();
  const p2 = getPermissionlessGaugeManager();

  assert(p1 === p2, 'Should return same instance');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All delegation and permissionless gauge tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
