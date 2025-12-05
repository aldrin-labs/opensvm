#!/usr/bin/env bun
/**
 * Liquidity Mining Tests
 */

import {
  LiquidityMiningEngine,
  ReferralTracker,
  getLiquidityMiningEngine,
  LiquidityPool,
  LiquidityPosition,
} from '../src/prediction-liquidity-mining.js';

console.log('Liquidity Mining Tests');
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
// Pool Management Tests
// ============================================================================

console.log('\n1. Pool Management');

await test('Create liquidity pool', () => {
  const engine = new LiquidityMiningEngine();

  const pool = engine.createPool('KXBTC100K', 'kalshi', 'Bitcoin $100K', 1.5);

  assert(pool.id.startsWith('POOL-'), 'ID should have prefix');
  assert(pool.marketId === 'KXBTC100K', 'Market ID should match');
  assert(pool.platform === 'kalshi', 'Platform should match');
  assert(pool.boostMultiplier === 1.5, 'Boost should be 1.5');
  assert(pool.isActive === true, 'Should be active');
  assert(pool.totalLiquidity === 0, 'Should start empty');
});

await test('Get pool by ID', () => {
  const engine = new LiquidityMiningEngine();

  const created = engine.createPool('TEST1', 'manifold', 'Test Pool');
  const retrieved = engine.getPool(created.id);

  assert(retrieved !== null, 'Should find pool');
  assert(retrieved!.id === created.id, 'ID should match');
});

await test('Get active pools', () => {
  const engine = new LiquidityMiningEngine();

  engine.createPool('ACTIVE1', 'kalshi', 'Active 1');
  engine.createPool('ACTIVE2', 'manifold', 'Active 2');

  const pools = engine.getActivePools();
  assert(pools.length === 2, 'Should have 2 active pools');
});

await test('Deactivate pool', () => {
  const engine = new LiquidityMiningEngine();

  const pool = engine.createPool('DEACTIVATE', 'polymarket', 'To Deactivate');
  engine.deactivatePool(pool.id);

  const updated = engine.getPool(pool.id);
  assert(updated!.isActive === false, 'Should be inactive');
});

await test('Set pool boost', () => {
  const engine = new LiquidityMiningEngine();

  const pool = engine.createPool('BOOST', 'kalshi', 'Boost Test', 1.0);
  engine.setPoolBoost(pool.id, 2.5);

  const updated = engine.getPool(pool.id);
  assert(updated!.boostMultiplier === 2.5, 'Boost should be 2.5');
});

await test('Clamp boost to valid range', () => {
  const engine = new LiquidityMiningEngine();

  const pool = engine.createPool('CLAMP', 'manifold', 'Clamp Test');

  engine.setPoolBoost(pool.id, 5.0); // Above max
  assert(engine.getPool(pool.id)!.boostMultiplier === 3.0, 'Should clamp to 3.0');

  engine.setPoolBoost(pool.id, 0.5); // Below min
  assert(engine.getPool(pool.id)!.boostMultiplier === 1.0, 'Should clamp to 1.0');
});

// ============================================================================
// Liquidity Position Tests
// ============================================================================

console.log('\n2. Liquidity Positions');

await test('Add liquidity', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('LP-TEST', 'kalshi', 'LP Test');

  const position = engine.addLiquidity(pool.id, 'wallet1', 1000, '30d');

  assert(position.id.startsWith('LP-'), 'ID should have prefix');
  assert(position.provider === 'wallet1', 'Provider should match');
  assert(position.liquidity === 1000, 'Liquidity should be 1000');
  assert(position.lockDuration === '30d', 'Lock should be 30d');
  assert(position.lockBoost === 1.25, 'Boost should be 1.25');
});

await test('Update pool totals on add', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('TOTAL-TEST', 'manifold', 'Total Test');

  engine.addLiquidity(pool.id, 'wallet1', 500, '7d');
  engine.addLiquidity(pool.id, 'wallet2', 500, '7d');

  const updated = engine.getPool(pool.id);
  assert(updated!.totalLiquidity === 1000, 'Total liquidity should be 1000');
});

await test('Enforce minimum liquidity', () => {
  const engine = new LiquidityMiningEngine({ minLiquidity: 100 });
  const pool = engine.createPool('MIN-TEST', 'kalshi', 'Min Test');

  try {
    engine.addLiquidity(pool.id, 'wallet1', 50, '7d');
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Minimum'), 'Should mention minimum');
  }
});

await test('Enforce max positions per provider', () => {
  const engine = new LiquidityMiningEngine({ maxPositionsPerProvider: 2, minLiquidity: 10 });
  const pool = engine.createPool('MAX-POS', 'manifold', 'Max Pos Test');

  engine.addLiquidity(pool.id, 'wallet1', 100, '7d');
  engine.addLiquidity(pool.id, 'wallet1', 100, '30d');

  try {
    engine.addLiquidity(pool.id, 'wallet1', 100, '90d');
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Maximum'), 'Should mention maximum');
  }
});

await test('Lock duration affects boost', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('LOCK-TEST', 'kalshi', 'Lock Test');

  const pos7d = engine.addLiquidity(pool.id, 'w1', 100, '7d');
  const pos30d = engine.addLiquidity(pool.id, 'w2', 100, '30d');
  const pos365d = engine.addLiquidity(pool.id, 'w3', 100, '365d');

  assert(pos7d.lockBoost === 1.0, '7d boost should be 1.0');
  assert(pos30d.lockBoost === 1.25, '30d boost should be 1.25');
  assert(pos365d.lockBoost === 3.0, '365d boost should be 3.0');
});

await test('Remove liquidity', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('REMOVE', 'manifold', 'Remove Test');

  // Set lock expiry in past for testing
  const position = engine.addLiquidity(pool.id, 'wallet1', 1000, '7d');
  (position as any).lockExpiry = Date.now() - 1000; // Already expired

  const result = engine.removeLiquidity(position.id);

  assert(result.liquidity === 1000, 'Should return full liquidity');
  assert(result.penalty === 0, 'No penalty for expired lock');
  assert(engine.getPosition(position.id) === null, 'Position should be removed');
});

await test('Early withdrawal penalty', () => {
  const engine = new LiquidityMiningEngine({ earlyWithdrawalPenalty: 0.1 });
  const pool = engine.createPool('PENALTY', 'kalshi', 'Penalty Test');

  const position = engine.addLiquidity(pool.id, 'wallet1', 1000, '365d');
  // Lock is in future, so early withdrawal applies

  const result = engine.removeLiquidity(position.id);

  assert(result.penalty === 100, 'Penalty should be 10% = 100');
  assert(result.liquidity === 900, 'Should return 900 after penalty');
});

// ============================================================================
// Reward Tests
// ============================================================================

console.log('\n3. Rewards');

await test('Get current emission rate', () => {
  const engine = new LiquidityMiningEngine({
    emission: {
      startTime: Date.now(),
      initialRate: 10,
      halvingInterval: 30 * 24 * 60 * 60 * 1000,
      minRate: 0.1,
    },
  });

  const rate = engine.getCurrentEmissionRate();
  assert(rate === 10, 'Initial rate should be 10');
});

await test('Emission rate halves over time', () => {
  const halfInterval = 1000; // 1 second for testing
  const engine = new LiquidityMiningEngine({
    emission: {
      startTime: Date.now() - halfInterval * 2, // 2 halvings ago
      initialRate: 10,
      halvingInterval: halfInterval,
      minRate: 0.1,
    },
  });

  const rate = engine.getCurrentEmissionRate();
  assert(rate === 2.5, 'Rate should be 2.5 after 2 halvings');
});

await test('Get pending rewards', async () => {
  const engine = new LiquidityMiningEngine({
    emission: {
      startTime: Date.now(),
      initialRate: 100, // High rate for testing
      halvingInterval: 999999999999,
      minRate: 0.1,
    },
  });

  const pool = engine.createPool('REWARD', 'manifold', 'Reward Test', 1.0);
  const position = engine.addLiquidity(pool.id, 'wallet1', 1000, '7d');

  // Wait a bit for rewards to accumulate
  await new Promise(r => setTimeout(r, 100));

  const pending = engine.getPendingRewards(position.id);
  assert(pending > 0, 'Should have pending rewards');
  console.log(`      (Pending rewards: ${pending.toFixed(4)} SVMAI)`);
});

await test('Claim rewards', async () => {
  const engine = new LiquidityMiningEngine({
    emission: {
      startTime: Date.now(),
      initialRate: 1000, // Very high for quick test
      halvingInterval: 999999999999,
      minRate: 0.1,
    },
  });

  const pool = engine.createPool('CLAIM', 'kalshi', 'Claim Test');
  const position = engine.addLiquidity(pool.id, 'wallet1', 1000, '30d');

  await new Promise(r => setTimeout(r, 50));

  const claim = engine.claimRewards(position.id);

  assert(claim.id.startsWith('CLAIM-'), 'Claim ID should have prefix');
  assert(claim.amount > 0, 'Should claim some rewards');
  assert(claim.provider === 'wallet1', 'Provider should match');

  const updatedPos = engine.getPosition(position.id);
  assert(updatedPos!.pendingRewards === 0, 'Pending should be 0 after claim');
  assert(updatedPos!.claimedRewards > 0, 'Claimed should increase');
});

await test('Lock boost increases rewards', async () => {
  const engine = new LiquidityMiningEngine({
    emission: {
      startTime: Date.now(),
      initialRate: 1000,
      halvingInterval: 999999999999,
      minRate: 0.1,
    },
  });

  const pool = engine.createPool('BOOST-REWARD', 'manifold', 'Boost Reward Test');

  // Same liquidity, different locks
  const pos7d = engine.addLiquidity(pool.id, 'w1', 1000, '7d');
  const pos365d = engine.addLiquidity(pool.id, 'w2', 1000, '365d');

  await new Promise(r => setTimeout(r, 100));

  const rewards7d = engine.getPendingRewards(pos7d.id);
  const rewards365d = engine.getPendingRewards(pos365d.id);

  // 365d has 3x boost vs 1x for 7d
  const ratio = rewards365d / rewards7d;
  assert(ratio > 2.5 && ratio < 3.5, `365d should have ~3x rewards (got ${ratio.toFixed(2)}x)`);
  console.log(`      (7d: ${rewards7d.toFixed(2)}, 365d: ${rewards365d.toFixed(2)}, ratio: ${ratio.toFixed(2)}x)`);
});

// ============================================================================
// Referral Tests
// ============================================================================

console.log('\n4. Referrals');

await test('Add liquidity with referrer', () => {
  const engine = new LiquidityMiningEngine({
    referral: { referrerBonus: 0.1, refereeBonus: 0.05, minLiquidity: 100 },
  });

  const pool = engine.createPool('REF-TEST', 'kalshi', 'Referral Test');
  const position = engine.addLiquidity(pool.id, 'newUser', 500, '30d', 'referrer123');

  assert(position.referrer === 'referrer123', 'Referrer should be set');
});

await test('Cannot refer yourself', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('SELF-REF', 'manifold', 'Self Ref Test');

  try {
    engine.addLiquidity(pool.id, 'wallet1', 500, '7d', 'wallet1');
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('yourself'), 'Should mention self-referral');
  }
});

await test('Referral tracker records referrals', () => {
  const tracker = new ReferralTracker();

  tracker.recordReferral('referrer1', 'user1');
  tracker.recordReferral('referrer1', 'user2');
  tracker.recordReferral('referrer2', 'user3');

  const stats = tracker.getReferralStats('referrer1');
  assert(stats.referralCount === 2, 'Should have 2 referrals');
});

await test('Cannot have multiple referrers', () => {
  const tracker = new ReferralTracker();

  tracker.recordReferral('ref1', 'user1');

  try {
    tracker.recordReferral('ref2', 'user1');
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('already'), 'Should mention already has referrer');
  }
});

await test('Get top referrers', () => {
  const tracker = new ReferralTracker();

  tracker.recordReferral('top1', 'u1');
  tracker.recordReferral('top1', 'u2');
  tracker.recordReferral('top1', 'u3');
  tracker.recordReferral('top2', 'u4');
  tracker.recordReferral('top2', 'u5');
  tracker.recordReferral('top3', 'u6');

  const leaderboard = tracker.getTopReferrers(3);

  assert(leaderboard.length === 3, 'Should have 3 top referrers');
  assert(leaderboard[0].referrer === 'top1', 'Top referrer should be top1');
  assert(leaderboard[0].count === 3, 'Top referrer should have 3 referrals');
});

// ============================================================================
// Statistics Tests
// ============================================================================

console.log('\n5. Statistics');

await test('Get provider stats', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('STATS', 'kalshi', 'Stats Test');

  engine.addLiquidity(pool.id, 'statsUser', 500, '30d');
  engine.addLiquidity(pool.id, 'statsUser', 500, '90d');

  const stats = engine.getProviderStats('statsUser');

  assert(stats.totalLiquidity === 1000, 'Total liquidity should be 1000');
  assert(stats.positionCount === 2, 'Should have 2 positions');
});

await test('Get global stats', () => {
  const engine = new LiquidityMiningEngine();

  engine.createPool('G1', 'kalshi', 'Global 1');
  const pool2 = engine.createPool('G2', 'manifold', 'Global 2');

  engine.addLiquidity(pool2.id, 'user1', 1000, '7d');
  engine.addLiquidity(pool2.id, 'user2', 2000, '30d');

  const stats = engine.getGlobalStats();

  assert(stats.totalPools === 2, 'Should have 2 pools');
  assert(stats.activePools === 2, 'Both should be active');
  assert(stats.totalLiquidity === 3000, 'Total liquidity should be 3000');
  assert(stats.totalProviders === 2, 'Should have 2 providers');
});

await test('Get leaderboard', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('LEADER', 'manifold', 'Leader Test');

  engine.addLiquidity(pool.id, 'whale', 10000, '365d');
  engine.addLiquidity(pool.id, 'medium', 1000, '30d');
  engine.addLiquidity(pool.id, 'small', 100, '7d');

  const leaderboard = engine.getLeaderboard(3);

  assert(leaderboard.length === 3, 'Should have 3 entries');
  assert(leaderboard[0].provider === 'whale', 'Whale should be first');
  assert(leaderboard[0].rank === 1, 'Whale should be rank 1');
  assert(leaderboard[2].provider === 'small', 'Small should be last');
});

await test('Get pool leaderboard', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('POOL-LEADER', 'kalshi', 'Pool Leader');

  engine.addLiquidity(pool.id, 'u1', 5000, '90d');
  engine.addLiquidity(pool.id, 'u2', 3000, '30d');
  engine.addLiquidity(pool.id, 'u3', 1000, '7d');

  const leaderboard = engine.getPoolLeaderboard(pool.id, 2);

  assert(leaderboard.length === 2, 'Should have 2 entries');
  assert(leaderboard[0].provider === 'u1', 'u1 should be first');
});

// ============================================================================
// APR Tests
// ============================================================================

console.log('\n6. APR Calculation');

await test('Calculate pool APR', () => {
  const engine = new LiquidityMiningEngine({
    emission: {
      startTime: Date.now(),
      initialRate: 1, // 1 token per second
      halvingInterval: 999999999999,
      minRate: 0.1,
    },
  });

  const pool = engine.createPool('APR', 'manifold', 'APR Test', 1.0);
  engine.addLiquidity(pool.id, 'user', 31536000, '7d'); // $31.5M = 1 year of rewards at $1

  const apr = engine.getPoolAPR(pool.id, 1); // $1 per token

  // 1 token/sec * 365 days / $31.5M = 100% APR
  assert(apr > 90 && apr < 110, `APR should be ~100% (got ${apr.toFixed(1)}%)`);
  console.log(`      (Pool APR: ${apr.toFixed(2)}%)`);
});

await test('Position APR includes lock boost', () => {
  const engine = new LiquidityMiningEngine();
  const pool = engine.createPool('POS-APR', 'kalshi', 'Pos APR Test');

  const pos = engine.addLiquidity(pool.id, 'user', 1000, '365d'); // 3x boost

  const poolAPR = engine.getPoolAPR(pool.id, 1);
  const posAPR = engine.getPositionAPR(pos.id, 1);

  assert(posAPR === poolAPR * 3, 'Position APR should be 3x pool APR');
});

// ============================================================================
// Singleton Tests
// ============================================================================

console.log('\n7. Singleton');

await test('Singleton instance', () => {
  const engine1 = getLiquidityMiningEngine();
  const engine2 = getLiquidityMiningEngine();

  assert(engine1 === engine2, 'Should return same instance');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All liquidity mining tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
