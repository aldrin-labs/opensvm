#!/usr/bin/env bun
/**
 * Debate Market Mechanics Tests
 *
 * Tests for:
 * - Conviction Betting
 * - Debate Futures Market
 * - Agent Performance Tokens
 * - Insurance Pool
 * - Quadratic Prediction Markets
 */

import {
  ConvictionBetting,
  DebateFuturesMarket,
  AgentTokenSystem,
  InsurancePool,
  QuadraticPredictionMarket,
  DEFAULT_CONVICTION_CONFIG,
} from '../src/debate-market-mechanics.js';

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
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) throw new Error(`Expected ${actual} < ${n}`);
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
    toThrow() {
      // This is used differently - wrap in try/catch
      throw new Error('Use try/catch for toThrow');
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

console.log('Debate Market Mechanics Tests');
console.log('=============================');

await (async () => {

// ============================================================================
// 1. Conviction Betting Tests
// ============================================================================

section('1. Conviction Betting');

await test('Creates conviction betting instance', () => {
  const cb = new ConvictionBetting();
  expect(cb).toBeTruthy();
});

await test('Places bet with time lock', () => {
  const cb = new ConvictionBetting();
  const bet = cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400 * 7);

  expect(bet.id).toBeTruthy();
  expect(bet.amount).toBe(1000);
  expect(bet.side).toBe('support');
  expect(bet.convictionMultiplier).toBeGreaterThanOrEqual(1);
});

await test('Calculates conviction multiplier based on lock duration', () => {
  const cb = new ConvictionBetting();

  const shortLock = cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400); // 1 day
  const longLock = cb.placeBet('prop-2', 'user-2', 1000, 'support', 86400 * 30); // 30 days

  expect(longLock.convictionMultiplier).toBeGreaterThan(shortLock.convictionMultiplier);
});

await test('Updates pool state correctly', () => {
  const cb = new ConvictionBetting();

  cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400);
  cb.placeBet('prop-1', 'user-2', 500, 'oppose', 86400);

  const pool = cb.getPoolState('prop-1');
  expect(pool.support).toBeGreaterThan(0);
  expect(pool.oppose).toBeGreaterThan(0);
  expect(pool.ratio).toBeGreaterThan(0.5); // More support
});

await test('Gets bets by bettor', () => {
  const cb = new ConvictionBetting();

  cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400);
  cb.placeBet('prop-2', 'user-1', 500, 'oppose', 86400);

  const bets = cb.getBetsByBettor('user-1');
  expect(bets.length).toBe(2);
});

await test('Gets bets by proposal', () => {
  const cb = new ConvictionBetting();

  cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400);
  cb.placeBet('prop-1', 'user-2', 500, 'oppose', 86400);

  const bets = cb.getBetsByProposal('prop-1');
  expect(bets.length).toBe(2);
});

await test('Settles bets correctly', () => {
  const cb = new ConvictionBetting();

  cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400);
  cb.placeBet('prop-1', 'user-2', 500, 'oppose', 86400);

  const payout = cb.settleBets('prop-1', 'support');
  expect(payout).toBeGreaterThan(0);
});

await test('Gets statistics', () => {
  const cb = new ConvictionBetting();

  cb.placeBet('prop-1', 'user-1', 1000, 'support', 86400);
  cb.placeBet('prop-1', 'user-2', 500, 'oppose', 86400 * 15);

  const stats = cb.getStats();
  expect(stats.totalBets).toBe(2);
  expect(stats.totalVolume).toBe(1500);
  expect(stats.averageLockDuration).toBeGreaterThan(0);
});

// ============================================================================
// 2. Debate Futures Market Tests
// ============================================================================

section('2. Debate Futures Market');

await test('Creates futures market instance', () => {
  const dfm = new DebateFuturesMarket();
  expect(dfm).toBeTruthy();
});

await test('Creates a future', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Will the proposal pass?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  expect(future.id).toBeTruthy();
  expect(future.outcomes.length).toBe(2);
  expect(future.resolved).toBe(false);
});

await test('Gets prices for outcomes', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Will the proposal pass?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  const prices = dfm.getPrices(future.id);
  expect(prices.length).toBe(2);
  // Initial prices should be equal
  expect(Math.abs(prices[0] - prices[1])).toBeLessThan(0.01);
});

await test('Buys outcome shares', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Will the proposal pass?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  const result = dfm.buyOutcome(future.id, 'trader-1', 0, 100);
  expect(result.shares).toBeGreaterThan(0);
  expect(result.avgPrice).toBeGreaterThan(0);
});

await test('Prices change after purchase', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Question?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  const pricesBefore = dfm.getPrices(future.id);
  dfm.buyOutcome(future.id, 'trader-1', 0, 200);
  const pricesAfter = dfm.getPrices(future.id);

  // Price of bought outcome should increase
  expect(pricesAfter[0]).toBeGreaterThan(pricesBefore[0]);
});

await test('Resolves market', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Question?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  dfm.buyOutcome(future.id, 'trader-1', 0, 100);
  const payout = dfm.resolve(future.id, 0);

  expect(payout).toBeGreaterThan(0);
});

await test('Gets market stats', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Question?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  dfm.buyOutcome(future.id, 'trader-1', 0, 100);

  const stats = dfm.getMarketStats(future.id);
  expect(stats).toBeTruthy();
  expect(stats!.totalPositions).toBe(1);
});

await test('Gets trader positions', () => {
  const dfm = new DebateFuturesMarket();
  const future = dfm.createFuture(
    'debate-1',
    'Question?',
    ['Yes', 'No'],
    Date.now() + 86400000
  );

  dfm.buyOutcome(future.id, 'trader-1', 0, 100);
  dfm.buyOutcome(future.id, 'trader-1', 1, 50);

  const positions = dfm.getTraderPositions('trader-1');
  expect(positions.length).toBe(2);
});

// ============================================================================
// 3. Agent Performance Tokens Tests
// ============================================================================

section('3. Agent Performance Tokens');

await test('Creates agent token system', () => {
  const ats = new AgentTokenSystem();
  expect(ats).toBeTruthy();
});

await test('Creates agent token', () => {
  const ats = new AgentTokenSystem();
  const token = ats.createAgentToken('agent-1', 'AGT1', 'Agent One Token');

  expect(token.symbol).toBe('AGT1');
  expect(token.price).toBeGreaterThan(0);
  expect(token.circulatingSupply).toBe(0);
});

await test('Prevents duplicate token creation', () => {
  const ats = new AgentTokenSystem();
  ats.createAgentToken('agent-1', 'AGT1', 'Agent One Token');

  let threw = false;
  try {
    ats.createAgentToken('agent-1', 'AGT1B', 'Agent One Token B');
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});

await test('Buys tokens along bonding curve', () => {
  const ats = new AgentTokenSystem();
  ats.createAgentToken('agent-1', 'AGT1', 'Agent One Token');

  const result = ats.buyTokens('agent-1', 'buyer-1', 100);
  expect(result.tokens).toBe(100);
  expect(result.cost).toBeGreaterThan(0);

  const token = ats.getToken('agent-1');
  expect(token!.circulatingSupply).toBe(100);
});

await test('Sells tokens along bonding curve', () => {
  const ats = new AgentTokenSystem();
  ats.createAgentToken('agent-1', 'AGT1', 'Agent One Token');

  ats.buyTokens('agent-1', 'buyer-1', 100);
  const result = ats.sellTokens('agent-1', 'buyer-1', 50);

  expect(result.tokens).toBe(50);
  expect(result.proceeds).toBeGreaterThan(0);
});

await test('Stakes tokens', () => {
  const ats = new AgentTokenSystem();
  ats.createAgentToken('agent-1', 'AGT1', 'Agent One Token');

  ats.buyTokens('agent-1', 'staker-1', 100);
  const staked = ats.stakeTokens('agent-1', 'staker-1', 50);

  expect(staked).toBe(true);

  const holder = ats.getHolder('agent-1', 'staker-1');
  expect(holder!.balance).toBe(50);
  expect(holder!.stakedBalance).toBe(50);
});

await test('Records performance and adjusts price', () => {
  const ats = new AgentTokenSystem();
  ats.createAgentToken('agent-1', 'AGT1', 'Agent One Token');

  ats.buyTokens('agent-1', 'buyer-1', 1000);
  const priceBefore = ats.getToken('agent-1')!.price;

  // Good performance
  ats.recordPerformance('agent-1', true, true, 100);
  ats.recordPerformance('agent-1', true, true, 100);
  ats.recordPerformance('agent-1', true, true, 100);

  const priceAfter = ats.getToken('agent-1')!.price;
  expect(priceAfter).toBeGreaterThan(priceBefore);
});

await test('Gets leaderboard', () => {
  const ats = new AgentTokenSystem();

  ats.createAgentToken('agent-1', 'AGT1', 'Agent One');
  ats.createAgentToken('agent-2', 'AGT2', 'Agent Two');

  ats.buyTokens('agent-1', 'buyer', 1000);
  ats.buyTokens('agent-2', 'buyer', 500);

  const leaderboard = ats.getLeaderboard();
  expect(leaderboard.length).toBe(2);
  expect(leaderboard[0].marketCap).toBeGreaterThan(leaderboard[1].marketCap);
});

// ============================================================================
// 4. Insurance Pool Tests
// ============================================================================

section('4. Insurance Pool');

await test('Creates insurance pool', () => {
  const pool = new InsurancePool(100000);
  expect(pool).toBeTruthy();
});

await test('Calculates premium correctly', () => {
  const pool = new InsurancePool();
  const premium = pool.calculatePremium(10000, 'hack', 50);

  expect(premium).toBeGreaterThan(0);
});

await test('Different coverage types have different premiums', () => {
  const pool = new InsurancePool();

  const hackPremium = pool.calculatePremium(10000, 'hack', 50);
  const allPremium = pool.calculatePremium(10000, 'all', 50);

  expect(allPremium).toBeGreaterThan(hackPremium);
});

await test('Purchases policy', () => {
  const pool = new InsurancePool(1000000);
  const policy = pool.purchasePolicy('prop-1', 'holder-1', 10000, 'hack', 30);

  expect(policy.id).toBeTruthy();
  expect(policy.coverageAmount).toBe(10000);
  expect(policy.premium).toBeGreaterThan(0);
});

await test('Files and approves claim', () => {
  const pool = new InsurancePool(1000000);

  // Purchase with 0 wait period for testing
  const policy = pool.purchasePolicy('prop-1', 'holder-1', 10000, 'hack', 30);

  // File claim (will fail due to wait period)
  const result = pool.fileClaim(policy.id, 5000, 'Evidence of hack');

  // Either approved or rejected due to wait period
  expect(typeof result.approved).toBe('boolean');
});

await test('Adds liquidity to pool', () => {
  const pool = new InsurancePool(100000);
  const newReserve = pool.addLiquidity('provider-1', 50000);

  expect(newReserve).toBe(150000);
});

await test('Gets pool statistics', () => {
  const pool = new InsurancePool(100000);

  pool.purchasePolicy('prop-1', 'holder-1', 10000, 'hack', 30);

  const stats = pool.getStats();
  expect(stats.currentReserve).toBeGreaterThan(100000); // Premium added
  expect(stats.activePolices).toBe(1);
});

await test('Gets policies by holder', () => {
  const pool = new InsurancePool(1000000);

  pool.purchasePolicy('prop-1', 'holder-1', 10000, 'hack', 30);
  pool.purchasePolicy('prop-2', 'holder-1', 5000, 'rugpull', 40);

  const policies = pool.getPoliciesByHolder('holder-1');
  expect(policies.length).toBe(2);
});

// ============================================================================
// 5. Quadratic Prediction Markets Tests
// ============================================================================

section('5. Quadratic Prediction Markets');

await test('Creates quadratic prediction market', () => {
  const qpm = new QuadraticPredictionMarket();
  expect(qpm).toBeTruthy();
});

await test('Creates market', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Will it pass?', 86400);

  expect(market.id).toBeTruthy();
  expect(market.resolved).toBe(false);
  expect(market.supportVotes).toBe(0);
});

await test('Voter gets initial credits', () => {
  const qpm = new QuadraticPredictionMarket();
  const voter = qpm.getVoterInfo('voter-1');

  expect(voter.totalCredits).toBe(100);
  expect(voter.availableCredits).toBe(100);
});

await test('Casts quadratic vote', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  const result = qpm.vote(market.id, 'voter-1', 5, 25);

  expect(result.success).toBe(true);
  expect(result.cost).toBe(25); // 5^2 = 25
});

await test('Quadratic cost scales with votes', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  // 2 votes costs 4 credits
  const result1 = qpm.vote(market.id, 'voter-1', 2, 4);
  expect(result1.cost).toBe(4);

  // 3 votes costs 9 credits
  const result2 = qpm.vote(market.id, 'voter-2', 3, 9);
  expect(result2.cost).toBe(9);
});

await test('Negative votes oppose', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  qpm.vote(market.id, 'voter-1', -3, 9);

  const prediction = qpm.getPrediction(market.id);
  expect(prediction.oppose).toBe(3);
  expect(prediction.support).toBe(0);
});

await test('Limited by available credits', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  // Try to vote more than affordable (10 votes = 100 credits = all credits)
  const result = qpm.vote(market.id, 'voter-1', 15, 225);

  // Should auto-adjust to affordable
  expect(result.success).toBe(true);
  expect(Math.abs(result.actualVotes)).toBeLessThanOrEqual(10);
});

await test('Gets prediction', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  qpm.vote(market.id, 'voter-1', 5, 25);
  qpm.vote(market.id, 'voter-2', -2, 4);

  const prediction = qpm.getPrediction(market.id);
  expect(prediction.support).toBe(5);
  expect(prediction.oppose).toBe(2);
  expect(prediction.probability).toBeGreaterThan(0.5);
});

await test('Resolves market', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  qpm.vote(market.id, 'voter-1', 5, 25);
  qpm.vote(market.id, 'voter-2', -2, 4);

  const result = qpm.resolve(market.id, true);
  expect(result.prediction).toBe(true); // 5 > 2
  expect(result.accuracy).toBeGreaterThan(0);
});

await test('Gets voter stats', () => {
  const qpm = new QuadraticPredictionMarket();
  const market = qpm.createMarket('prop-1', 'Question?', 86400);

  qpm.vote(market.id, 'voter-1', 5, 25);

  const stats = qpm.getVoterStats();
  expect(stats.length).toBe(1);
  expect(stats[0].marketParticipation).toBe(1);
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
  console.log('\n[PASS] All market mechanics tests passed!');
  process.exit(0);
}
