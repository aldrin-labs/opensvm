#!/usr/bin/env bun
/**
 * veToken Model and Gauge Voting Tests
 */

import {
  VeTokenEngine,
  getVeTokenEngine,
  WEEK_MS,
  YEAR_MS,
  MAX_LOCK_MS,
} from '../src/vetoken-model.js';

import {
  GaugeController,
  getGaugeController,
} from '../src/gauge-voting.js';

console.log('veToken Model and Gauge Voting Tests');
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

async function runAllTests() {

// ============================================================================
// veToken Lock Tests
// ============================================================================

console.log('\n1. veToken Locks');

await test('Create lock with 4-year duration', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('voter1', 1000, MAX_LOCK_MS);

  assert(lock.id.startsWith('VELOCK-'), 'ID should have prefix');
  assert(lock.amount === 1000, 'Amount should be 1000');
  assert(lock.veBalance === 1000, '4-year lock = 1:1 veSVMAI');
});

await test('Create lock with 1-year duration', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('voter2', 1000, YEAR_MS);

  assert(lock.veBalance === 250, '1-year lock = 0.25 veSVMAI per SVMAI');
});

await test('Create lock with 1-week duration', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('voter3', 1000, WEEK_MS);

  const expectedVe = 1000 * (WEEK_MS / MAX_LOCK_MS);
  assert(Math.abs(lock.veBalance - expectedVe) < 1, 'Should have minimal veSVMAI');
  console.log(`      (1 week lock: ${lock.veBalance.toFixed(2)} veSVMAI for 1000 SVMAI)`);
});

await test('Enforce minimum lock duration', () => {
  const engine = new VeTokenEngine();

  try {
    engine.createLock('voter', 1000, WEEK_MS / 2); // Half week
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Minimum'), 'Should mention minimum');
  }
});

await test('Enforce maximum lock duration', () => {
  const engine = new VeTokenEngine();

  try {
    engine.createLock('voter', 1000, MAX_LOCK_MS * 2); // 8 years
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Maximum'), 'Should mention maximum');
  }
});

await test('Increase lock amount', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('increaser', 1000, 2 * YEAR_MS);
  const initialVe = lock.veBalance;

  engine.increaseAmount(lock.id, 500);

  assert(lock.amount === 1500, 'Amount should be 1500');
  assert(lock.veBalance > initialVe, 'veSVMAI should increase');
});

await test('Extend lock duration', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('extender', 1000, YEAR_MS);
  const initialVe = lock.veBalance;

  const newLockEnd = Date.now() + 2 * YEAR_MS;
  engine.extendLock(lock.id, newLockEnd);

  assert(lock.veBalance > initialVe, 'veSVMAI should increase with longer lock');
});

await test('Withdraw after lock expires', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('withdrawer', 1000, WEEK_MS);
  (lock as any).lockEnd = Date.now() - 1000; // Already expired

  const result = engine.withdraw(lock.id);

  assert(result.amount === 1000, 'Should return full amount');
  assert(result.penalty === 0, 'No penalty for expired lock');
});

await test('Early withdraw penalty', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('early', 1000, 4 * YEAR_MS);
  // Lock is still active

  const result = engine.withdraw(lock.id);

  assert(result.penalty === 500, '50% penalty');
  assert(result.amount === 500, 'Should return 500');
});

// ============================================================================
// veToken Balance Tests
// ============================================================================

console.log('\n2. veToken Balances');

await test('Get current veSVMAI balance', () => {
  const engine = new VeTokenEngine();

  engine.createLock('balancer', 1000, 2 * YEAR_MS);

  const balance = engine.getCurrentVeBalance('balancer');

  assert(balance > 0, 'Should have positive balance');
  assert(balance <= 500, 'Should be <= 500 (2yr = 0.5x)');
});

await test('veSVMAI decays over time', () => {
  const engine = new VeTokenEngine();

  const lock = engine.createLock('decayer', 1000, 4 * YEAR_MS);
  const initialVe = engine.getCurrentVeBalance('decayer');

  // Simulate time passing (half of lock duration)
  (lock as any).createdAt = Date.now() - 2 * YEAR_MS;

  const currentVe = engine.getCurrentVeBalance('decayer');

  // After half time, should have ~half veSVMAI
  assert(currentVe < initialVe, 'veSVMAI should decay');
  console.log(`      (Initial: ${initialVe.toFixed(2)}, After decay: ${currentVe.toFixed(2)})`);
});

await test('Get full balance info', () => {
  const engine = new VeTokenEngine();

  engine.createLock('fullinfo', 500, YEAR_MS);
  engine.createLock('fullinfo', 500, 2 * YEAR_MS);

  const balance = engine.getBalance('fullinfo');

  assert(balance.lockedAmount === 1000, 'Locked amount should be 1000');
  assert(balance.locks.length === 2, 'Should have 2 locks');
  assert(balance.votingPower > 0, 'Should have voting power');
});

await test('Get total veSVMAI supply', () => {
  const engine = new VeTokenEngine();

  engine.createLock('supply1', 1000, 4 * YEAR_MS);
  engine.createLock('supply2', 500, 2 * YEAR_MS);

  const totalSupply = engine.getTotalVeSupply();

  // supply1 = 1000, supply2 = 250
  assert(totalSupply > 1200, 'Total supply should be > 1200');
});

// ============================================================================
// veToken Boost Tests
// ============================================================================

console.log('\n3. LP Boost');

await test('Calculate boost without veSVMAI', () => {
  const engine = new VeTokenEngine();

  const boost = engine.calculateBoost('noVe');

  assert(boost === 1.0, 'Should have no boost');
});

await test('Calculate boost with veSVMAI', () => {
  const engine = new VeTokenEngine();

  engine.createLock('boosted', 10000, 4 * YEAR_MS);

  const boost = engine.calculateBoost('boosted');

  assert(boost > 1.0, 'Should have boost > 1');
  assert(boost <= 2.5, 'Should not exceed max boost');
  console.log(`      (Boost: ${boost.toFixed(2)}x)`);
});

await test('Get effective LP boost', () => {
  const engine = new VeTokenEngine();

  engine.createLock('lpboost', 5000, 2 * YEAR_MS);

  const result = engine.getEffectiveLPBoost('lpboost', 1000, 10000);

  assert(result.veBoost > 1, 'Should have veSVMAI boost');
  assert(result.effectiveBoost <= 2.5, 'Effective boost should be capped');
});

// ============================================================================
// veToken Fee Distribution Tests
// ============================================================================

console.log('\n4. Fee Distribution');

await test('Add protocol fees', () => {
  const engine = new VeTokenEngine();

  engine.addFees(10000);

  // No holders yet, fees accumulate
  assert(true, 'Fees added');
});

await test('Calculate claimable fees', () => {
  const engine = new VeTokenEngine();

  engine.createLock('feeHolder', 1000, 4 * YEAR_MS);
  engine.addFees(10000);

  const claimable = engine.getClaimableFees('feeHolder');

  // 50% fee share rate, 100% voting power = 5000
  assert(claimable === 5000, 'Should be able to claim 5000');
});

await test('Claim fees', () => {
  const engine = new VeTokenEngine();

  engine.createLock('claimer', 1000, 4 * YEAR_MS);
  engine.addFees(1000);

  const claimed = engine.claimFees('claimer');

  assert(claimed === 500, 'Should claim 500 (50% fee share)');
});

// ============================================================================
// Gauge Voting Tests
// ============================================================================

console.log('\n5. Gauge Voting');

await test('Create gauge', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  const gauge = controller.createGauge('POOL-1', 'Bitcoin Pool');

  assert(gauge.id.startsWith('GAUGE-'), 'ID should have prefix');
  assert(gauge.poolId === 'POOL-1', 'Pool ID should match');
  assert(gauge.currentWeight === 0, 'Initial weight should be 0');
});

await test('Vote for gauge', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('gaugeVoter', 1000, 4 * YEAR_MS);
  const gauge = controller.createGauge('POOL-2', 'ETH Pool');

  const vote = controller.vote('gaugeVoter', gauge.id, 50); // 50% of veSVMAI

  assert(vote.weight === 50, 'Weight should be 50');
  assert(vote.veAmount === 500, 'Should allocate 500 veSVMAI');
  assert(gauge.totalVotes === 500, 'Gauge should have 500 votes');
});

await test('Vote for multiple gauges', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('multiVoter', 1000, 4 * YEAR_MS);
  const g1 = controller.createGauge('P1', 'Pool 1');
  const g2 = controller.createGauge('P2', 'Pool 2');

  controller.vote('multiVoter', g1.id, 60);
  controller.vote('multiVoter', g2.id, 40);

  assert(g1.totalVotes === 600, 'Pool 1 should have 600');
  assert(g2.totalVotes === 400, 'Pool 2 should have 400');
});

await test('Cannot exceed 100% vote weight', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('overVoter', 1000, 4 * YEAR_MS);
  const g1 = controller.createGauge('P1', 'Pool 1');
  const g2 = controller.createGauge('P2', 'Pool 2');

  controller.vote('overVoter', g1.id, 70);

  try {
    controller.vote('overVoter', g2.id, 40); // 70 + 40 > 100
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('100%'), 'Should mention limit');
  }
});

await test('Update existing vote', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('updateVoter', 1000, 4 * YEAR_MS);
  const gauge = controller.createGauge('UPDATE', 'Update Pool');

  controller.vote('updateVoter', gauge.id, 30);
  assert(gauge.totalVotes === 300, 'Should have 300');

  controller.vote('updateVoter', gauge.id, 80);
  assert(gauge.totalVotes === 800, 'Should update to 800');
});

await test('Remove vote', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('remover', 1000, 4 * YEAR_MS);
  const gauge = controller.createGauge('REMOVE', 'Remove Pool');

  controller.vote('remover', gauge.id, 50);
  controller.removeVote('remover', gauge.id);

  assert(gauge.totalVotes === 0, 'Should have 0 votes after removal');
});

await test('Get gauge weights', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('weigher1', 1000, 4 * YEAR_MS);
  veEngine.createLock('weigher2', 500, 4 * YEAR_MS);

  const g1 = controller.createGauge('W1', 'Weight 1');
  const g2 = controller.createGauge('W2', 'Weight 2');

  controller.vote('weigher1', g1.id, 100);
  controller.vote('weigher2', g2.id, 100);

  const weights = controller.getGaugeWeights();

  assert(weights.length === 2, 'Should have 2 gauges');
  // w1 has 1000, w2 has 500, total 1500
  // w1 weight = 1000/1500 = 0.666
  assert(weights[0].weight > 0.6, 'First gauge should have ~66% weight');
  console.log(`      (Weights: ${weights.map(w => (w.weight * 100).toFixed(1) + '%').join(', ')})`);
});

// ============================================================================
// Bribe Tests
// ============================================================================

console.log('\n6. Bribes');

await test('Add bribe to gauge', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine, { bribeClaimDelay: 0 });

  const gauge = controller.createGauge('BRIBE', 'Bribe Pool');
  const bribe = controller.addBribe(gauge.id, 'briber', 'SVMAI', 1000);

  assert(bribe.id.startsWith('BRIBE-'), 'ID should have prefix');
  assert(bribe.amount === 1000, 'Amount should be 1000');
  assert(gauge.bribes.length === 1, 'Gauge should have 1 bribe');
});

await test('Claim bribe share', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine, { bribeClaimDelay: 0 });

  veEngine.createLock('bribeVoter', 1000, 4 * YEAR_MS);
  const gauge = controller.createGauge('BRIBECLAIM', 'Bribe Claim');

  controller.vote('bribeVoter', gauge.id, 100);
  const bribe = controller.addBribe(gauge.id, 'briber', 'SOL', 100);

  const claimed = controller.claimBribe('bribeVoter', bribe.id);

  assert(claimed === 100, 'Should claim full bribe (only voter)');
});

await test('Bribe split between voters', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine, { bribeClaimDelay: 0 });

  veEngine.createLock('bv1', 1000, 4 * YEAR_MS);
  veEngine.createLock('bv2', 1000, 4 * YEAR_MS);

  const gauge = controller.createGauge('SPLIT', 'Split Pool');
  controller.vote('bv1', gauge.id, 100);
  controller.vote('bv2', gauge.id, 100);

  const bribe = controller.addBribe(gauge.id, 'briber', 'SOL', 100);

  const claimed1 = controller.claimBribe('bv1', bribe.id);

  assert(claimed1 === 50, 'Should claim 50% (equal votes)');
});

// ============================================================================
// Epoch Tests
// ============================================================================

console.log('\n7. Epochs');

await test('Get current epoch', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  const epoch = controller.getCurrentEpoch();

  assert(epoch.number === 0, 'Should start at epoch 0');
  assert(epoch.finalized === false, 'Should not be finalized');
});

await test('Advance epoch', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('epochVoter', 1000, 4 * YEAR_MS);
  const gauge = controller.createGauge('EPOCH', 'Epoch Pool');
  controller.vote('epochVoter', gauge.id, 100);

  controller.advanceEpoch();

  const newEpoch = controller.getCurrentEpoch();
  assert(newEpoch.number === 1, 'Should be epoch 1');
});

await test('Get voting stats', () => {
  const veEngine = new VeTokenEngine();
  const controller = new GaugeController(veEngine);

  veEngine.createLock('statsVoter', 500, 2 * YEAR_MS);
  const gauge = controller.createGauge('STATS', 'Stats Pool');
  controller.vote('statsVoter', gauge.id, 100);

  const stats = controller.getStats();

  assert(stats.currentEpoch === 0, 'Should be epoch 0');
  assert(stats.totalGauges === 1, 'Should have 1 gauge');
  assert(stats.totalVoters === 1, 'Should have 1 voter');
});

// ============================================================================
// Statistics Tests
// ============================================================================

console.log('\n8. Statistics');

await test('Get veToken stats', () => {
  const engine = new VeTokenEngine();

  engine.createLock('stat1', 1000, 4 * YEAR_MS);
  engine.createLock('stat2', 500, 2 * YEAR_MS);

  const stats = engine.getStats();

  assert(stats.totalLocked === 1500, 'Total locked should be 1500');
  assert(stats.holders === 2, 'Should have 2 holders');
  assert(stats.totalVeSupply > 0, 'Should have veSVMAI supply');
});

await test('Get veToken leaderboard', () => {
  const engine = new VeTokenEngine();

  engine.createLock('leader1', 10000, 4 * YEAR_MS);
  engine.createLock('leader2', 5000, 4 * YEAR_MS);
  engine.createLock('leader3', 1000, 4 * YEAR_MS);

  const leaderboard = engine.getLeaderboard(2);

  assert(leaderboard.length === 2, 'Should have 2 entries');
  assert(leaderboard[0].owner === 'leader1', 'leader1 should be first');
  assert(leaderboard[0].rank === 1, 'First should be rank 1');
});

// ============================================================================
// Singleton Tests
// ============================================================================

console.log('\n9. Singletons');

await test('veToken singleton', () => {
  const e1 = getVeTokenEngine();
  const e2 = getVeTokenEngine();

  assert(e1 === e2, 'Should return same instance');
});

await test('Gauge controller singleton', () => {
  const c1 = getGaugeController();
  const c2 = getGaugeController();

  assert(c1 === c2, 'Should return same instance');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All veToken and gauge voting tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
