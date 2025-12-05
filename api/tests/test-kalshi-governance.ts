#!/usr/bin/env bun
/**
 * Kalshi Governance Integration Tests
 */

import {
  KalshiAPIClient,
  KalshiGovernance,
} from '../src/mcp-kalshi-governance.js';

console.log('Kalshi Governance Tests');
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
// Kalshi API Client Tests (Live API)
// ============================================================================

console.log('\n1. Kalshi API Client (Live)');

const client = new KalshiAPIClient();

await test('List open markets', async () => {
  const result = await client.listMarkets({ status: 'open', limit: 3 });
  assert(result.markets !== undefined, 'Should return markets array');
  assert(result.markets.length > 0, 'Should have at least 1 market');
});

await test('Get market details', async () => {
  const markets = await client.listMarkets({ status: 'open', limit: 1 });
  if (markets.markets.length === 0) {
    console.log('      (Skipped - no markets available)');
    passed++;
    return;
  }

  const ticker = markets.markets[0].ticker;
  const market = await client.getMarket(ticker);

  assert(market.ticker === ticker, 'Ticker should match');
  // Kalshi uses 'active' for open markets
  assert(['active', 'open', 'closed', 'settled'].includes(market.status), 'Should have valid status');
  assert(typeof market.yes_bid === 'number', 'Should have yes_bid');
});

await test('Get market price convenience method', async () => {
  const markets = await client.listMarkets({ status: 'open', limit: 1 });
  if (markets.markets.length === 0) return;

  const ticker = markets.markets[0].ticker;
  const price = await client.getMarketPrice(ticker);

  assert(price.yesPrice >= 0 && price.yesPrice <= 1, 'yesPrice should be 0-1');
  assert(price.noPrice >= 0 && price.noPrice <= 1, 'noPrice should be 0-1');
  assert(Math.abs(price.yesPrice + price.noPrice - 1) < 0.1, 'Prices should sum to ~1');
});

await test('Get orderbook', async () => {
  const markets = await client.listMarkets({ status: 'open', limit: 1 });
  if (markets.markets.length === 0) return;

  const ticker = markets.markets[0].ticker;
  const orderbook = await client.getOrderbook(ticker);

  assert(orderbook.yes !== undefined, 'Should have yes orders');
  assert(orderbook.no !== undefined, 'Should have no orders');
});

// ============================================================================
// Kalshi Governance Tests (Unit)
// ============================================================================

console.log('\n2. Kalshi Governance (Unit)');

await test('Create governance instance', () => {
  const gov = new KalshiGovernance();
  assert(gov !== null, 'Should create instance');
});

await test('Create proposal without market link', async () => {
  const gov = new KalshiGovernance();

  const proposal = await gov.createProposal('proposer-wallet', {
    title: 'Test Proposal',
    description: 'A test proposal without market link',
  });

  assert(proposal.id.startsWith('KALSHI-GOV-'), 'Should have valid ID');
  assert(proposal.status === 'active', 'Should be active');
  assert(proposal.marketPrice === undefined, 'Should have no market price');
  assert(proposal.combinedScore === 0, 'Initial score should be 0');
});

await test('Vote on proposal without market', async () => {
  const gov = new KalshiGovernance();

  const proposal = await gov.createProposal('proposer', {
    title: 'Vote Test',
    description: 'Test',
  });

  const result = await gov.vote(
    proposal.id,
    'voter',
    true,
    BigInt(1000) * BigInt(1e9)
  );

  assert(result.multiplier === 1.0, 'Should have neutral multiplier without market');
  assert(result.marketInfluence === 'neutral', 'Should be neutral');

  const updated = gov.getProposal(proposal.id)!;
  assert(updated.votesFor > BigInt(0), 'Should have votes for');
});

await test('Market weight influences combined score', async () => {
  const gov = new KalshiGovernance({ marketWeight: 0.5, voterWeight: 0.5 });

  const proposal = await gov.createProposal('proposer', {
    title: 'Weight Test',
    description: 'Test',
    marketWeight: 0.5,
    voterWeight: 0.5,
  });

  // Simulate 100% FOR votes
  await gov.vote(proposal.id, 'voter', true, BigInt(1000) * BigInt(1e9));

  const updated = gov.getProposal(proposal.id)!;
  // Without market: score = 1.0 * 0.5 + 0.5 * 0.5 = 0.75
  assert(updated.combinedScore > 0.5, 'Score should reflect vote weight');
});

await test('Get governance stats', async () => {
  const gov = new KalshiGovernance();

  await gov.createProposal('p1', { title: 'Test 1', description: 'T1' });
  await gov.createProposal('p2', { title: 'Test 2', description: 'T2' });

  const stats = gov.getStats();

  assert(stats.totalProposals === 2, 'Should have 2 proposals');
  assert(stats.activeProposals === 2, 'Should have 2 active');
  assert(stats.config.marketWeight === 0.3, 'Should have default market weight');
  assert(stats.config.voterWeight === 0.7, 'Should have default voter weight');
});

await test('Custom vote multipliers', async () => {
  const gov = new KalshiGovernance({
    voteMultipliers: {
      withMarketMultiplier: 2.0,
      againstMarketMultiplier: 0.5,
      neutralMultiplier: 1.0,
    },
  });

  const stats = gov.getStats();
  assert(stats.config.voteMultipliers.withMarketMultiplier === 2.0, 'Should apply custom multiplier');
});

// ============================================================================
// Integration Tests (Live + Governance)
// ============================================================================

console.log('\n3. Integration (Live Market + Governance)');

await test('Create proposal linked to real Kalshi market', async () => {
  const gov = new KalshiGovernance();

  // Get a real market ticker
  const markets = await gov.getClient().listMarkets({ status: 'open', limit: 1 });
  if (markets.markets.length === 0) {
    console.log('      (Skipped - no markets available)');
    passed++;
    return;
  }

  const ticker = markets.markets[0].ticker;

  const proposal = await gov.createProposal('proposer', {
    title: `Governance linked to ${ticker}`,
    description: 'Testing market integration',
    kalshiTicker: ticker,
  });

  assert(proposal.kalshiTicker === ticker, 'Should link to market');
  assert(proposal.marketPrice !== undefined, 'Should have fetched market price');
  assert(proposal.lastUpdated !== undefined, 'Should have update timestamp');
  assert(['bullish', 'bearish', 'neutral'].includes(proposal.marketSignal), 'Should have market signal');
});

await test('Vote with market-informed weighting', async () => {
  const gov = new KalshiGovernance();

  const markets = await gov.getClient().listMarkets({ status: 'open', limit: 1 });
  if (markets.markets.length === 0) return;

  const ticker = markets.markets[0].ticker;

  const proposal = await gov.createProposal('proposer', {
    title: 'Market Vote Test',
    description: 'Test',
    kalshiTicker: ticker,
  });

  const result = await gov.vote(
    proposal.id,
    'voter',
    true,
    BigInt(1000) * BigInt(1e9)
  );

  // Multiplier should be applied based on market alignment
  assert(result.multiplier > 0, 'Should have positive multiplier');
  assert(['neutral', 'aligned (bullish)', 'aligned (bearish)', 'contrarian'].some(
    s => result.marketInfluence.includes(s) || result.marketInfluence === s.split(' ')[0]
  ), 'Should describe market influence');
});

await test('Refresh market data updates proposal', async () => {
  const gov = new KalshiGovernance();

  const markets = await gov.getClient().listMarkets({ status: 'open', limit: 1 });
  if (markets.markets.length === 0) return;

  const ticker = markets.markets[0].ticker;

  const proposal = await gov.createProposal('proposer', {
    title: 'Refresh Test',
    description: 'Test',
    kalshiTicker: ticker,
  });

  const initialUpdate = proposal.lastUpdated;

  // Wait a moment and refresh
  await new Promise(r => setTimeout(r, 100));
  await gov.refreshMarketData(proposal.id);

  const updated = gov.getProposal(proposal.id)!;
  assert(updated.lastUpdated! >= initialUpdate!, 'Should have newer timestamp');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All Kalshi governance tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
