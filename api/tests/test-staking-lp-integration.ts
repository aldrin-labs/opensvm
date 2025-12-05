#!/usr/bin/env bun
/**
 * Staking + LP Integration Tests
 */

import {
  StakingIntegration,
  getStakingIntegration,
  StakingTier,
} from '../src/staking-lp-integration.js';

console.log('Staking + LP Integration Tests');
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
// Staking Operations Tests
// ============================================================================

console.log('\n1. Staking Operations');

await test('Stake SVMAI tokens', () => {
  const integration = new StakingIntegration();

  const position = integration.stake('wallet1', 5000, 90);

  assert(position.id.startsWith('STAKE-'), 'ID should have prefix');
  assert(position.wallet === 'wallet1', 'Wallet should match');
  assert(position.amount === 5000, 'Amount should be 5000');
  assert(position.lockDuration === 90, 'Lock should be 90 days');
  assert(position.tier === 'silver', 'Tier should be silver (1000-10000)');
});

await test('Add to existing stake', () => {
  const integration = new StakingIntegration();

  const position = integration.stake('wallet2', 500, 30);
  assert(position.tier === 'bronze', 'Should start as bronze');

  integration.addToStake(position.id, 1500);

  const updated = integration.getPosition('wallet2');
  assert(updated!.amount === 2000, 'Should have 2000 total');
  assert(updated!.tier === 'silver', 'Should upgrade to silver');
});

await test('Unstake tokens', () => {
  const integration = new StakingIntegration();

  const position = integration.stake('wallet3', 1000, 7);
  (position as any).lockExpiry = Date.now() - 1000; // Already expired

  const result = integration.unstake(position.id);

  assert(result.returned === 1000, 'Should return full amount');
  assert(result.penalty === 0, 'No penalty for expired lock');
  assert(integration.getPosition('wallet3') === null, 'Position should be removed');
});

await test('Early unstake penalty', () => {
  const integration = new StakingIntegration();

  const position = integration.stake('wallet4', 1000, 365);
  // Lock is still active

  const result = integration.unstake(position.id);

  assert(result.penalty === 100, '10% penalty = 100');
  assert(result.returned === 900, 'Should return 900 after penalty');
});

await test('Partial unstake', () => {
  const integration = new StakingIntegration();

  const position = integration.stake('wallet5', 5000, 30);
  (position as any).lockExpiry = Date.now() - 1000;

  const result = integration.unstake(position.id, 2000);

  assert(result.returned === 2000, 'Should return 2000');
  assert(result.remaining === 3000, 'Should have 3000 remaining');

  const updated = integration.getPosition('wallet5');
  assert(updated!.amount === 3000, 'Position should have 3000');
});

// ============================================================================
// Tier System Tests
// ============================================================================

console.log('\n2. Tier System');

await test('Calculate tier from amount', () => {
  const integration = new StakingIntegration();

  assert(integration.calculateTier(50) === 'none', '50 = none');
  assert(integration.calculateTier(100) === 'bronze', '100 = bronze');
  assert(integration.calculateTier(1000) === 'silver', '1000 = silver');
  assert(integration.calculateTier(10000) === 'gold', '10000 = gold');
  assert(integration.calculateTier(100000) === 'platinum', '100000 = platinum');
  assert(integration.calculateTier(1000000) === 'diamond', '1000000 = diamond');
});

await test('Get tier config', () => {
  const integration = new StakingIntegration();

  const goldConfig = integration.getTierConfig('gold');

  assert(goldConfig.minStake === 10000, 'Gold min stake should be 10000');
  assert(goldConfig.lpBoostMultiplier === 1.5, 'Gold boost should be 1.5');
  assert(goldConfig.feeDiscount === 0.15, 'Gold fee discount should be 15%');
});

await test('Get all tiers', () => {
  const integration = new StakingIntegration();

  const tiers = integration.getAllTiers();

  assert(tiers.length === 6, 'Should have 6 tiers');
  assert(tiers[0].tier === 'none', 'First tier should be none');
  assert(tiers[5].tier === 'diamond', 'Last tier should be diamond');
});

await test('Tier upgrades on stake increase', () => {
  const integration = new StakingIntegration();

  const position = integration.stake('upgrader', 500, 30);
  assert(position.tier === 'bronze', 'Should start bronze');

  integration.addToStake(position.id, 9500);
  assert(integration.getPosition('upgrader')!.tier === 'gold', 'Should upgrade to gold');
});

// ============================================================================
// LP Integration Tests
// ============================================================================

console.log('\n3. LP Integration');

await test('Get compound boost without staking', () => {
  const integration = new StakingIntegration();

  const boost = integration.getCompoundBoost('noStake', 1.5);

  assert(boost.tier === 'none', 'Tier should be none');
  assert(boost.stakingMultiplier === 1, 'No staking multiplier');
  assert(boost.totalBoost === 1.5, 'Total should equal LP boost only');
});

await test('Get compound boost with staking', () => {
  const integration = new StakingIntegration();

  integration.stake('staker', 10000, 90); // Gold tier

  const boost = integration.getCompoundBoost('staker', 1.5);

  assert(boost.tier === 'gold', 'Tier should be gold');
  assert(boost.stakingMultiplier === 1.5, 'Gold multiplier should be 1.5');
  assert(boost.loyaltyBonus === 0.1, 'Should get loyalty bonus');

  // Total = 1.5 (LP) * 1.5 (gold) * 1.1 (loyalty) = 2.475
  const expectedTotal = 1.5 * 1.5 * 1.1;
  assert(Math.abs(boost.totalBoost - expectedTotal) < 0.01, `Total should be ~${expectedTotal}`);
  console.log(`      (Compound boost: ${boost.totalBoost.toFixed(2)}x)`);
});

await test('No loyalty bonus without LP lock', () => {
  const integration = new StakingIntegration();

  integration.stake('noLpLock', 10000, 30);

  const boost = integration.getCompoundBoost('noLpLock', 1.0); // No LP lock boost

  assert(boost.loyaltyBonus === 0, 'No loyalty bonus without LP lock');
});

await test('Calculate effective APR', () => {
  const integration = new StakingIntegration();

  integration.stake('aprTest', 100000, 365); // Platinum

  const result = integration.getEffectiveAPR(50, 'aprTest', 2.0);

  // Base APR 50% * LP boost 2.0 * Platinum 2.0 * loyalty 1.1 = 220%
  assert(result.baseAPR === 50, 'Base APR should be 50');
  assert(result.effectiveAPR > 200, 'Effective APR should be > 200%');
  console.log(`      (Base: ${result.baseAPR}%, Effective: ${result.effectiveAPR.toFixed(1)}%)`);
});

// ============================================================================
// Auto-Compound Tests
// ============================================================================

console.log('\n4. Auto-Compound');

await test('Auto-compound creates new stake', () => {
  const integration = new StakingIntegration();

  const result = integration.autoCompound('newCompounder', 1000);

  assert(result.fee === 10, '1% fee = 10');
  assert(result.compounded === 990, '990 compounded');

  const position = integration.getPosition('newCompounder');
  assert(position !== null, 'Should create position');
  assert(position!.amount === 990, 'Position should have 990');
});

await test('Auto-compound adds to existing stake', () => {
  const integration = new StakingIntegration();

  integration.stake('existingCompounder', 5000, 90);
  const result = integration.autoCompound('existingCompounder', 500);

  assert(result.newStakedAmount === 5495, '5000 + 495 = 5495');
});

await test('Auto-compound can change tier', () => {
  const integration = new StakingIntegration();

  integration.stake('tierUp', 9500, 30);
  assert(integration.getPosition('tierUp')!.tier === 'silver', 'Should start silver');

  const result = integration.autoCompound('tierUp', 600);

  assert(result.newTier === 'gold', 'Should upgrade to gold');
});

// ============================================================================
// Statistics Tests
// ============================================================================

console.log('\n5. Statistics');

await test('Get global stats', () => {
  const integration = new StakingIntegration();

  integration.stake('s1', 1000, 30);
  integration.stake('s2', 10000, 90);
  integration.stake('s3', 100000, 180);

  const stats = integration.getGlobalStats();

  assert(stats.totalStaked === 111000, 'Total should be 111000');
  assert(stats.totalStakers === 3, 'Should have 3 stakers');
  assert(stats.tierDistribution.silver === 1, 'Should have 1 silver');
  assert(stats.tierDistribution.gold === 1, 'Should have 1 gold');
  assert(stats.tierDistribution.platinum === 1, 'Should have 1 platinum');
});

await test('Get wallet profile', () => {
  const integration = new StakingIntegration();

  integration.stake('profiler', 5000, 90);

  const profile = integration.getWalletProfile('profiler');

  assert(profile.tier === 'silver', 'Tier should be silver');
  assert(profile.nextTier === 'gold', 'Next tier should be gold');
  assert(profile.amountToNextTier === 5000, 'Need 5000 more for gold');
  assert(profile.lpBoostMultiplier === 1.25, 'Silver LP boost is 1.25');
});

await test('Diamond tier has no next tier', () => {
  const integration = new StakingIntegration();

  integration.stake('diamond', 1000000, 365);

  const profile = integration.getWalletProfile('diamond');

  assert(profile.tier === 'diamond', 'Should be diamond');
  assert(profile.nextTier === null, 'No next tier');
  assert(profile.amountToNextTier === 0, 'No amount needed');
});

// ============================================================================
// Singleton Tests
// ============================================================================

console.log('\n6. Singleton');

await test('Singleton instance', () => {
  const i1 = getStakingIntegration();
  const i2 = getStakingIntegration();

  assert(i1 === i2, 'Should return same instance');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All staking integration tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
