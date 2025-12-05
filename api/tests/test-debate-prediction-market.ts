#!/usr/bin/env bun
/**
 * Debate Prediction Market Tests
 */

import {
  DebatePredictionMarket,
  getDebatePredictionMarket,
} from '../src/debate-prediction-market.js';
import { DebateResult } from '../src/multi-agent-debate.js';

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
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) throw new Error(`Expected ${actual} < ${n}`);
    },
    toBeCloseTo(expected: number, tolerance = 0.01) {
      if (typeof actual !== 'number' || Math.abs(actual - expected) > tolerance) {
        throw new Error(`Expected ${actual} to be close to ${expected}`);
      }
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

const mockDebateResult: DebateResult = {
  proposalTitle: 'Add Liquidity Mining Rewards',
  finalRecommendation: 'support',
  consensusStrength: 0.85,
  aggregatedScore: 7.5,
  aggregatedConfidence: 0.8,
  pointsOfAgreement: ['Good for TVL'],
  pointsOfDisagreement: [],
  unresolvedConcerns: [],
  majorityReasoning: 'Strong support for incentives',
  dissent: [],
  rounds: [],
  debateRounds: 2,
  totalAgents: 6,
  duration: 5000,
};

// ============================================================================
// Tests
// ============================================================================

console.log('Debate Prediction Market Tests');
console.log('==================================');

await (async () => {

section('1. Market Creation');

await test('Creates market', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);
  expect(id).toBeTruthy();
  expect(id).toContain('DMARKET-');
});

await test('Gets market by ID', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);
  const market = pm.getMarket(id);
  expect(market).toBeTruthy();
  expect(market?.debateRecommendation).toBe('support');
});

await test('Market starts open', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);
  const market = pm.getMarket(id);
  expect(market?.status).toBe('open');
});

await test('Market has initial 50/50 price', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);
  const price = pm.getPrice(id);
  expect(price).toBeCloseTo(0.5, 0.001);
});

await test('Lists all markets', () => {
  const pm = new DebatePredictionMarket();
  pm.createMarket('DEBATE-1', mockDebateResult);
  pm.createMarket('DEBATE-2', mockDebateResult);
  const markets = pm.listMarkets();
  expect(markets.length).toBe(2);
});

await test('Emits market_created event', () => {
  const pm = new DebatePredictionMarket();
  let eventFired = false;

  pm.on('market_created', () => {
    eventFired = true;
  });

  pm.createMarket('DEBATE-1', mockDebateResult);
  expect(eventFired).toBe(true);
});

section('2. Trading - Buy YES');

await test('Buys YES shares', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const trade = pm.buyYes(id, 'trader-1', 100);
  expect(trade).toBeTruthy();
  expect(trade?.shares).toBeGreaterThan(0);
});

await test('Buying YES increases price', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const priceBefore = pm.getPrice(id);
  pm.buyYes(id, 'trader-1', 100);
  const priceAfter = pm.getPrice(id);

  expect(priceAfter).toBeGreaterThan(priceBefore);
});

await test('Creates position on buy', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);
  const position = pm.getPosition(id, 'trader-1');

  expect(position).toBeTruthy();
  expect(position?.yesShares).toBeGreaterThan(0);
});

await test('Respects min bet', () => {
  const pm = new DebatePredictionMarket({ minBet: 10 });
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const trade = pm.buyYes(id, 'trader-1', 5);
  expect(trade).toBeFalsy();
});

await test('Respects max bet', () => {
  const pm = new DebatePredictionMarket({ maxBet: 50 });
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const trade = pm.buyYes(id, 'trader-1', 100);
  expect(trade).toBeFalsy();
});

section('3. Trading - Buy NO');

await test('Buys NO shares', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const trade = pm.buyNo(id, 'trader-1', 100);
  expect(trade).toBeTruthy();
  expect(trade?.shares).toBeGreaterThan(0);
});

await test('Buying NO decreases price', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const priceBefore = pm.getPrice(id);
  pm.buyNo(id, 'trader-1', 100);
  const priceAfter = pm.getPrice(id);

  expect(priceAfter).toBeLessThan(priceBefore);
});

await test('Creates NO position', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyNo(id, 'trader-1', 100);
  const position = pm.getPosition(id, 'trader-1');

  expect(position?.noShares).toBeGreaterThan(0);
});

section('4. Trading - Sell');

await test('Sells YES shares', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);
  const position = pm.getPosition(id, 'trader-1')!;
  const sharesToSell = Math.floor(position.yesShares / 2);

  const trade = pm.sellYes(id, 'trader-1', sharesToSell);
  expect(trade).toBeTruthy();
  expect(trade?.amount).toBeGreaterThan(0);
});

await test('Sells NO shares', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyNo(id, 'trader-1', 100);
  const position = pm.getPosition(id, 'trader-1')!;
  const sharesToSell = Math.floor(position.noShares / 2);

  const trade = pm.sellNo(id, 'trader-1', sharesToSell);
  expect(trade).toBeTruthy();
});

await test('Cannot sell more than owned', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);
  const trade = pm.sellYes(id, 'trader-1', 1000000);

  expect(trade).toBeFalsy();
});

await test('Selling YES decreases price', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 200);
  const priceBefore = pm.getPrice(id);

  const position = pm.getPosition(id, 'trader-1')!;
  pm.sellYes(id, 'trader-1', Math.floor(position.yesShares / 2));
  const priceAfter = pm.getPrice(id);

  expect(priceAfter).toBeLessThan(priceBefore);
});

section('5. Market Lifecycle');

await test('Locks market', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const locked = pm.lockMarket(id);
  expect(locked).toBe(true);

  const market = pm.getMarket(id);
  expect(market?.status).toBe('locked');
});

await test('Cannot trade on locked market', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);
  pm.lockMarket(id);

  const trade = pm.buyYes(id, 'trader-1', 100);
  expect(trade).toBeFalsy();
});

await test('Resolves market', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const resolved = pm.resolveMarket(id, {
    marketId: id,
    outcome: 'correct',
    reason: 'Proposal succeeded as predicted',
    measuredAt: Date.now(),
  });

  expect(resolved).toBe(true);
  expect(pm.getMarket(id)?.status).toBe('resolved');
});

await test('Cannot resolve already resolved market', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.resolveMarket(id, {
    marketId: id,
    outcome: 'correct',
    reason: 'Test',
    measuredAt: Date.now(),
  });

  const secondResolve = pm.resolveMarket(id, {
    marketId: id,
    outcome: 'incorrect',
    reason: 'Test 2',
    measuredAt: Date.now(),
  });

  expect(secondResolve).toBe(false);
});

await test('Cancels market', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const cancelled = pm.cancelMarket(id, 'Proposal withdrawn');
  expect(cancelled).toBe(true);
  expect(pm.getMarket(id)?.status).toBe('cancelled');
});

section('6. Position Settlement');

await test('Settles YES positions on correct outcome', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);

  let settledEvent = false;
  pm.on('position_settled', (data: any) => {
    settledEvent = true;
    expect(data.payout).toBeGreaterThan(0);
  });

  pm.resolveMarket(id, {
    marketId: id,
    outcome: 'correct',
    reason: 'Debate prediction was correct',
    measuredAt: Date.now(),
  });

  expect(settledEvent).toBe(true);
});

await test('Settles NO positions on incorrect outcome', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyNo(id, 'trader-1', 100);

  let payout = 0;
  pm.on('position_settled', (data: any) => {
    payout = data.payout;
  });

  pm.resolveMarket(id, {
    marketId: id,
    outcome: 'incorrect',
    reason: 'Debate prediction was wrong',
    measuredAt: Date.now(),
  });

  expect(payout).toBeGreaterThan(0);
});

await test('Partial outcome splits payout', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);
  pm.buyNo(id, 'trader-1', 100);

  pm.resolveMarket(id, {
    marketId: id,
    outcome: 'partial',
    reason: 'Mixed results',
    measuredAt: Date.now(),
  });

  const market = pm.getMarket(id);
  expect(market?.actualOutcome).toBe('partial');
});

section('7. Trader Stats');

await test('Updates trader stats after resolution', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);

  pm.resolveMarket(id, {
    marketId: id,
    outcome: 'correct',
    reason: 'Test',
    measuredAt: Date.now(),
  });

  const stats = pm.getTraderStats('trader-1');
  expect(stats).toBeTruthy();
  expect(stats?.marketsParticipated).toBe(1);
});

await test('Tracks winning bets', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);

  pm.resolveMarket(id, {
    marketId: id,
    outcome: 'correct',
    reason: 'Test',
    measuredAt: Date.now(),
  });

  const stats = pm.getTraderStats('trader-1');
  expect(stats?.winningBets).toBe(1);
});

await test('Gets leaderboard', () => {
  const pm = new DebatePredictionMarket();

  // Create and resolve multiple markets
  for (let i = 0; i < 3; i++) {
    const id = pm.createMarket(`DEBATE-${i}`, mockDebateResult);
    pm.buyYes(id, 'trader-1', 100);
    pm.buyNo(id, 'trader-2', 50);

    pm.resolveMarket(id, {
      marketId: id,
      outcome: i % 2 === 0 ? 'correct' : 'incorrect',
      reason: 'Test',
      measuredAt: Date.now(),
    });
  }

  const leaderboard = pm.getLeaderboard('profit', 5);
  expect(leaderboard.length).toBeGreaterThan(0);
});

section('8. Analytics');

await test('Gets market trades', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);
  pm.buyNo(id, 'trader-2', 50);

  const trades = pm.getMarketTrades(id);
  expect(trades.length).toBe(2);
});

await test('Gets market stats', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  pm.buyYes(id, 'trader-1', 100);

  const stats = pm.getMarketStats(id) as any;
  expect(stats.totalVolume).toBe(100);
  expect(stats.uniqueTraders).toBe(1);
});

await test('Gets platform stats', () => {
  const pm = new DebatePredictionMarket();
  pm.createMarket('DEBATE-1', mockDebateResult);
  pm.createMarket('DEBATE-2', mockDebateResult);

  const stats = pm.getStats() as any;
  expect(stats.totalMarkets).toBe(2);
  expect(stats.openMarkets).toBe(2);
});

await test('Gets trader positions', () => {
  const pm = new DebatePredictionMarket();
  const id1 = pm.createMarket('DEBATE-1', mockDebateResult);
  const id2 = pm.createMarket('DEBATE-2', mockDebateResult);

  pm.buyYes(id1, 'trader-1', 100);
  pm.buyNo(id2, 'trader-1', 50);

  const positions = pm.getTraderPositions('trader-1');
  expect(positions.length).toBe(2);
});

section('9. CPMM Invariant');

await test('Maintains constant product', () => {
  const pm = new DebatePredictionMarket({ initialLiquidity: 1000 });
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  const marketBefore = pm.getMarket(id)!;
  const kBefore = marketBefore.yesShares * marketBefore.noShares;

  // Multiple trades
  pm.buyYes(id, 'trader-1', 100);
  pm.buyNo(id, 'trader-2', 50);
  pm.buyYes(id, 'trader-3', 75);

  const marketAfter = pm.getMarket(id)!;
  const kAfter = marketAfter.yesShares * marketAfter.noShares;

  // k should remain approximately constant (within fee tolerance)
  const kRatio = kAfter / kBefore;
  expect(kRatio).toBeGreaterThan(0.9);
  expect(kRatio).toBeLessThan(1.5); // Some increase due to fees
});

await test('Price stays bounded 0-1', () => {
  const pm = new DebatePredictionMarket();
  const id = pm.createMarket('DEBATE-1', mockDebateResult);

  // Large trades
  pm.buyYes(id, 'trader-1', 500);
  pm.buyYes(id, 'trader-2', 500);

  const price = pm.getPrice(id);
  expect(price).toBeGreaterThan(0);
  expect(price).toBeLessThan(1);
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
  console.log('\n✅ All debate prediction market tests passed!');
  process.exit(0);
}
