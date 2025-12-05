/**
 * SVMAI Tokenomics Tests
 */

import {
  TIER_CONFIGS,
  STAKE_CONFIGS,
  CREDIT_PACKS,
  toTokenAmount,
  fromTokenAmount,
} from '../types';
import {
  calculateTier,
  calculateEffectiveBalance,
  getTierBenefits,
  hasToolAccess,
  checkRateLimit,
  getTierProgress,
} from '../access-tiers';
import {
  createStake,
  getWalletStakes,
  canUnstake,
  calculateAPY,
  getPoolStats,
} from '../staking';
import {
  getUserCredits,
  canAffordTool,
  consumeCredits,
  calculateToolCost,
  purchaseCredits,
} from '../credits';

console.log('SVMAI Tokenomics Tests');
console.log('======================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`   ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ ${name}`);
    console.log(`      Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ============================================================================
// Token Amount Tests
// ============================================================================

console.log('1. Token Amount Conversion');

test('Convert to token amount', () => {
  const amount = toTokenAmount(100);
  assert(amount === BigInt(100_000_000_000), 'Should convert correctly');
});

test('Convert from token amount', () => {
  const value = fromTokenAmount(BigInt(100_000_000_000));
  assert(value === 100, 'Should convert back correctly');
});

// ============================================================================
// Access Tier Tests
// ============================================================================

console.log('\n2. Access Tiers');

test('Calculate tier for 0 tokens', () => {
  const tier = calculateTier(BigInt(0));
  assert(tier === 'free', 'Should be free tier');
});

test('Calculate tier for 100 tokens', () => {
  const tier = calculateTier(toTokenAmount(100));
  assert(tier === 'basic', 'Should be basic tier');
});

test('Calculate tier for 1000 tokens', () => {
  const tier = calculateTier(toTokenAmount(1000));
  assert(tier === 'pro', 'Should be pro tier');
});

test('Calculate tier for 10000 tokens', () => {
  const tier = calculateTier(toTokenAmount(10000));
  assert(tier === 'enterprise', 'Should be enterprise tier');
});

test('Calculate tier for 100000 tokens', () => {
  const tier = calculateTier(toTokenAmount(100000));
  assert(tier === 'whale', 'Should be whale tier');
});

test('Get tier benefits', () => {
  const benefits = getTierBenefits('pro');
  assert(benefits.aiTools === true, 'Pro should have AI tools');
  assert(benefits.requestsPerMinute === 100, 'Pro should have 100 rpm');
});

test('Check tool access', () => {
  assert(hasToolAccess('free', 'basic') === true, 'Free has basic access');
  assert(hasToolAccess('free', 'ai') === false, 'Free has no AI access');
  assert(hasToolAccess('pro', 'ai') === true, 'Pro has AI access');
});

test('Check rate limits', () => {
  const result = checkRateLimit('free', 5, 50);
  assert(result.allowed === true, 'Should be allowed');

  const overLimit = checkRateLimit('free', 15, 50);
  assert(overLimit.allowed === false, 'Should be rate limited');
});

test('Get tier progress', () => {
  const progress = getTierProgress(toTokenAmount(500));
  assert(progress.currentTier === 'basic', 'Should be basic');
  assert(progress.nextTier === 'pro', 'Next should be pro');
  assert(progress.progress > 0 && progress.progress < 100, 'Progress should be partial');
});

// ============================================================================
// Staking Tests
// ============================================================================

console.log('\n3. Staking');

test('Create stake position', () => {
  const stake = createStake('wallet1', toTokenAmount(100), '30d');
  assert(stake.multiplier === 1.25, 'Should have 1.25x multiplier');
  assert(stake.status === 'active', 'Should be active');
});

test('Get wallet stakes', () => {
  const stakes = getWalletStakes('wallet1');
  assert(stakes.length >= 1, 'Should have at least 1 stake');
});

test('Calculate effective balance with stake', () => {
  const stakes = getWalletStakes('wallet1');
  const effective = calculateEffectiveBalance(toTokenAmount(100), stakes);
  assert(effective > toTokenAmount(100), 'Effective should be higher with stake');
});

test('Check unstake before maturity', () => {
  const stakes = getWalletStakes('wallet1');
  if (stakes.length > 0) {
    const unstakeInfo = canUnstake(stakes[0].id);
    assert(unstakeInfo.canUnstake === true, 'Should be able to unstake');
    assert(unstakeInfo.isEarly === true, 'Should be early unstake');
    assert(unstakeInfo.penalty > 0, 'Should have penalty');
  }
});

test('Calculate APY', () => {
  const apy7d = calculateAPY('7d');
  const apy365d = calculateAPY('365d');
  assert(apy365d > apy7d, '365d APY should be higher than 7d');
});

test('Get pool stats', () => {
  const stats = getPoolStats();
  assert(stats.totalStaked >= BigInt(0), 'Should have total staked');
  assert(stats.averageMultiplier >= 1, 'Avg multiplier should be >= 1');
});

// ============================================================================
// Credits Tests
// ============================================================================

console.log('\n4. Credits System');

test('Get user credits', () => {
  const credits = getUserCredits('wallet2');
  assert(credits.wallet === 'wallet2', 'Should have correct wallet');
  assert(credits.balance >= 0, 'Balance should be non-negative');
});

test('Calculate tool cost', () => {
  const basicCost = calculateToolCost('get_transaction');
  const aiCost = calculateToolCost('ask_ai');
  assert(aiCost > basicCost, 'AI tool should cost more');
});

test('Check affordability', () => {
  const check = canAffordTool('wallet2', 'get_transaction');
  assert(typeof check.canAfford === 'boolean', 'Should return canAfford');
  assert(check.cost >= 0, 'Cost should be non-negative');
});

test('Purchase credits', () => {
  const result = purchaseCredits('wallet3', 'basic', 'free');
  assert(result.success === true, 'Should succeed');
  assert(result.creditsAdded > 0, 'Should add credits');
});

test('Consume credits', () => {
  // First add some credits
  purchaseCredits('wallet4', 'basic', 'free');

  const result = consumeCredits('wallet4', 'get_transaction');
  assert(result.success === true, 'Should succeed');
  assert(result.creditsUsed > 0, 'Should consume credits');
});

// ============================================================================
// Configuration Tests
// ============================================================================

console.log('\n5. Configuration Validation');

test('Tier configs are ordered', () => {
  for (let i = 1; i < TIER_CONFIGS.length; i++) {
    assert(
      TIER_CONFIGS[i].minTokens > TIER_CONFIGS[i - 1].minTokens,
      'Tiers should be ordered by minTokens'
    );
  }
});

test('Stake configs have increasing multipliers', () => {
  for (let i = 1; i < STAKE_CONFIGS.length; i++) {
    assert(
      STAKE_CONFIGS[i].multiplier >= STAKE_CONFIGS[i - 1].multiplier,
      'Multipliers should increase with duration'
    );
  }
});

test('Credit packs have increasing value', () => {
  for (let i = 1; i < CREDIT_PACKS.length; i++) {
    const prevValue = CREDIT_PACKS[i - 1].credits / CREDIT_PACKS[i - 1].priceTokens;
    const currValue = (CREDIT_PACKS[i].credits + CREDIT_PACKS[i].bonusCredits) / CREDIT_PACKS[i].priceTokens;
    assert(currValue >= prevValue, 'Larger packs should have better value');
  }
});

// ============================================================================
// Results
// ============================================================================

console.log('\n======================');
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n✅ All tokenomics tests passed!');
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}
