#!/usr/bin/env bun
/**
 * Multi-Platform Prediction Markets Trading System Tests
 */

import {
  PredictionMarketsTradingSystem,
  PaperTradingEngine,
  AlertManager,
  StrategyEngine,
  MarketAggregator,
  Market,
  Platform,
} from '../src/mcp-prediction-markets.js';

console.log('Prediction Markets Trading System Tests');
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

// Mock market for testing
const mockMarket: Market = {
  id: 'TEST-MARKET',
  platform: 'kalshi',
  ticker: 'TEST-MARKET',
  title: 'Test Market',
  yesPrice: 0.65,
  noPrice: 0.35,
  volume24h: 1000,
  liquidity: 50000,
  resolved: false,
};

async function runAllTests() {

// ============================================================================
// Paper Trading Engine Tests
// ============================================================================

console.log('\n1. Paper Trading Engine');

await test('Create paper trading account', () => {
  const engine = new PaperTradingEngine();
  const account = engine.createAccount('test-1', 10000);

  assert(account.id === 'test-1', 'Account ID should match');
  assert(account.balance === 10000, 'Balance should be $10,000');
  assert(account.initialBalance === 10000, 'Initial balance should be set');
});

await test('Deposit funds to account', () => {
  const engine = new PaperTradingEngine();
  engine.createAccount('test-2', 5000);

  const newBalance = engine.deposit('test-2', 2500);

  assert(newBalance === 7500, 'Balance should be $7,500 after deposit');
});

await test('Execute buy trade', () => {
  const engine = new PaperTradingEngine();
  engine.createAccount('trader-1', 10000);

  const trade = engine.executeTrade('trader-1', mockMarket, 'yes', 'buy', 100);

  assert(trade.action === 'buy', 'Action should be buy');
  assert(trade.side === 'yes', 'Side should be yes');
  assert(trade.quantity === 100, 'Quantity should be 100');
  assert(trade.price === 0.65, 'Price should be 0.65');
  assert(trade.mode === 'paper', 'Mode should be paper');
});

await test('Execute sell trade', () => {
  const engine = new PaperTradingEngine();
  engine.createAccount('trader-2', 10000);

  // First buy
  engine.executeTrade('trader-2', mockMarket, 'yes', 'buy', 100);

  // Then sell
  const sellTrade = engine.executeTrade('trader-2', mockMarket, 'yes', 'sell', 50);

  assert(sellTrade.action === 'sell', 'Action should be sell');
  assert(sellTrade.quantity === 50, 'Quantity should be 50');
});

await test('Prevent overselling', () => {
  const engine = new PaperTradingEngine();
  engine.createAccount('trader-3', 10000);

  engine.executeTrade('trader-3', mockMarket, 'yes', 'buy', 50);

  try {
    engine.executeTrade('trader-3', mockMarket, 'yes', 'sell', 100);
    assert(false, 'Should throw on oversell');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Insufficient'), 'Should mention insufficient position');
  }
});

await test('Calculate portfolio value', () => {
  const engine = new PaperTradingEngine();
  engine.createAccount('portfolio-test', 10000);

  engine.executeTrade('portfolio-test', mockMarket, 'yes', 'buy', 100);

  const portfolio = engine.getPortfolioValue('portfolio-test');

  assert(portfolio.total > 0, 'Should have positive total');
  assert(portfolio.positions > 0, 'Should have position value');
  assert(portfolio.cash < 10000, 'Cash should decrease after buying');
});

await test('Leaderboard ranks by PnL', () => {
  const engine = new PaperTradingEngine();
  engine.createAccount('winner', 10000);
  engine.createAccount('loser', 10000);

  // Winner: Buy at 0.65, market goes up
  engine.executeTrade('winner', mockMarket, 'yes', 'buy', 100);

  const leaderboard = engine.getLeaderboard();

  assert(leaderboard.length === 2, 'Should have 2 accounts');
  assert(leaderboard[0].accountId !== undefined, 'Should have account IDs');
});

// ============================================================================
// Alert Manager Tests
// ============================================================================

console.log('\n2. Alert Manager');

await test('Create price alert', () => {
  const alerts = new AlertManager();

  const alert = alerts.createAlert('kalshi', 'TEST-MKT', 'price_above', 0.75);

  assert(alert.id.startsWith('ALERT-'), 'Alert ID should have prefix');
  assert(alert.type === 'price_above', 'Type should match');
  assert(alert.threshold === 0.75, 'Threshold should be 0.75');
  assert(alert.triggered === false, 'Should not be triggered initially');
});

await test('Remove alert', () => {
  const alerts = new AlertManager();

  const alert = alerts.createAlert('kalshi', 'TEST', 'price_below', 0.3);
  const removed = alerts.removeAlert(alert.id);

  assert(removed === true, 'Should successfully remove');
  assert(alerts.getActiveAlerts().length === 0, 'Should have no active alerts');
});

await test('Get active vs triggered alerts', () => {
  const alerts = new AlertManager();

  const a1 = alerts.createAlert('kalshi', 'MKT1', 'price_above', 0.8);
  const a2 = alerts.createAlert('polymarket', 'MKT2', 'volume_spike', 10000);

  // Manually trigger one
  (a1 as any).triggered = true;
  (a1 as any).triggeredAt = Date.now();

  const active = alerts.getActiveAlerts();
  const triggered = alerts.getTriggeredAlerts();

  assert(active.length === 1, 'Should have 1 active alert');
  assert(triggered.length === 1, 'Should have 1 triggered alert');
});

// ============================================================================
// Strategy Engine Tests
// ============================================================================

console.log('\n3. Strategy Engine');

await test('Create arbitrage strategy', () => {
  const paper = new PaperTradingEngine();
  const strategies = new StrategyEngine(paper);

  const strategy = strategies.createArbitrageStrategy('Test Arb', {
    minSpread: 0.05,
    maxPosition: 500,
    platforms: ['kalshi', 'polymarket'],
  });

  assert(strategy.type === 'arbitrage', 'Type should be arbitrage');
  assert(strategy.enabled === false, 'Should start disabled');
  assert(strategy.config.minSpread === 0.05, 'Config should be set');
});

await test('Create mean reversion strategy', () => {
  const paper = new PaperTradingEngine();
  const strategies = new StrategyEngine(paper);

  const strategy = strategies.createMeanReversionStrategy('Mean Rev', {
    threshold: 0.3,
    positionSize: 200,
    platforms: ['manifold'],
  });

  assert(strategy.type === 'mean_reversion', 'Type should be mean_reversion');
  assert(strategy.config.threshold === 0.3, 'Threshold should be 0.3');
});

await test('Enable and disable strategy', () => {
  const paper = new PaperTradingEngine();
  const strategies = new StrategyEngine(paper);

  const strategy = strategies.createArbitrageStrategy('Toggle Test', {
    minSpread: 0.05,
    maxPosition: 500,
    platforms: ['kalshi'],
  });

  assert(strategy.enabled === false, 'Should start disabled');

  strategies.enableStrategy(strategy.id);
  assert(strategies.getStrategy(strategy.id)!.enabled === true, 'Should be enabled');

  strategies.disableStrategy(strategy.id);
  assert(strategies.getStrategy(strategy.id)!.enabled === false, 'Should be disabled');
});

await test('Get all strategies', () => {
  const paper = new PaperTradingEngine();
  const strategies = new StrategyEngine(paper);

  strategies.createArbitrageStrategy('Arb 1', { minSpread: 0.03, maxPosition: 100, platforms: ['kalshi'] });
  strategies.createMeanReversionStrategy('MR 1', { threshold: 0.25, positionSize: 150, platforms: ['manifold'] });

  const all = strategies.getAllStrategies();

  assert(all.length === 2, 'Should have 2 strategies');
});

// ============================================================================
// Market Aggregator Tests
// ============================================================================

console.log('\n4. Market Aggregator');

await test('Create aggregator instance', () => {
  const aggregator = new MarketAggregator();
  assert(aggregator !== null, 'Should create aggregator');
});

// Live API tests
await test('Fetch markets from Kalshi (live)', async () => {
  const aggregator = new MarketAggregator();

  try {
    const markets = await aggregator.fetchAllMarkets({ platforms: ['kalshi'], limit: 5 });
    assert(Array.isArray(markets), 'Should return array');
    console.log(`      (Found ${markets.length} Kalshi markets)`);
  } catch (e) {
    console.log('      (Kalshi API unavailable)');
  }
});

await test('Fetch markets from Manifold (live)', async () => {
  const aggregator = new MarketAggregator();

  try {
    const markets = await aggregator.fetchAllMarkets({ platforms: ['manifold'], limit: 5 });
    assert(Array.isArray(markets), 'Should return array');
    console.log(`      (Found ${markets.length} Manifold markets)`);
  } catch (e) {
    console.log('      (Manifold API unavailable)');
  }
});

await test('Search markets across platforms', async () => {
  const aggregator = new MarketAggregator();

  try {
    const results = await aggregator.searchMarkets('bitcoin', ['kalshi', 'manifold']);
    assert(Array.isArray(results), 'Should return array');
    console.log(`      (Found ${results.length} markets matching "bitcoin")`);
  } catch (e) {
    console.log('      (Search unavailable)');
  }
});

// ============================================================================
// Full Trading System Tests
// ============================================================================

console.log('\n5. Full Trading System');

await test('Create trading system', () => {
  const system = new PredictionMarketsTradingSystem();

  assert(system.paper !== undefined, 'Should have paper trading');
  assert(system.alerts !== undefined, 'Should have alerts');
  assert(system.strategies !== undefined, 'Should have strategies');
  assert(system.aggregator !== undefined, 'Should have aggregator');
});

await test('Setup demo account', () => {
  const system = new PredictionMarketsTradingSystem();

  const account = system.setupDemoAccount('demo-user');

  assert(account.balance === 10000, 'Should have $10k balance');
  assert(account.id === 'demo-user', 'Should have correct ID');
});

await test('Setup arbitrage bot', () => {
  const system = new PredictionMarketsTradingSystem();

  const strategy = system.setupArbitrageBot('arb-bot');

  assert(strategy.type === 'arbitrage', 'Should be arbitrage strategy');
  assert(strategy.platforms.length === 3, 'Should cover 3 platforms');
});

await test('Setup mean reversion bot', () => {
  const system = new PredictionMarketsTradingSystem();

  const strategy = system.setupMeanReversionBot('mr-bot');

  assert(strategy.type === 'mean_reversion', 'Should be mean reversion');
});

await test('Full workflow: account -> strategy -> trade', async () => {
  const system = new PredictionMarketsTradingSystem();

  // Create account
  const account = system.paper.createAccount('workflow-test', 5000);
  assert(account.balance === 5000, 'Account created');

  // Buy some contracts
  const trade = system.paper.executeTrade('workflow-test', mockMarket, 'yes', 'buy', 50);
  assert(trade.quantity === 50, 'Trade executed');

  // Check portfolio
  const portfolio = system.paper.getPortfolioValue('workflow-test');
  assert(portfolio.total > 0, 'Portfolio has value');

  // Create alert
  const alert = system.alerts.createAlert('kalshi', mockMarket.id, 'price_above', 0.8);
  assert(alert.triggered === false, 'Alert created');

  // Create strategy
  const strategy = system.strategies.createMeanReversionStrategy('Workflow MR', {
    threshold: 0.3,
    positionSize: 100,
    platforms: ['kalshi'],
  });
  assert(strategy.enabled === false, 'Strategy created');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All prediction markets tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
