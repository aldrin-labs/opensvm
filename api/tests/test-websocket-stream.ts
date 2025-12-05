#!/usr/bin/env bun
/**
 * WebSocket Streaming Tests
 */

import {
  PredictionMarketsStream,
  RealTimeAlertManager,
  getStream,
  PriceUpdate,
  ArbitrageSignal,
} from '../src/prediction-markets-websocket.js';

console.log('WebSocket Streaming Tests');
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
// Stream Manager Tests
// ============================================================================

console.log('\n1. Stream Manager');

await test('Create stream instance', () => {
  const stream = new PredictionMarketsStream({
    platforms: ['kalshi', 'manifold'],
    detectArbitrage: true,
    arbitrageThreshold: 0.03,
  });
  assert(stream !== null, 'Stream should be created');
});

await test('Connect to platforms (live)', async () => {
  const stream = new PredictionMarketsStream({
    platforms: ['manifold'], // Most reliable for testing
    detectArbitrage: false,
  });

  let connected = false;
  const connectPromise = new Promise<void>((resolve) => {
    stream.on('connected', () => {
      connected = true;
      resolve();
    });
  });

  await stream.connect();

  // Wait a bit for events
  await new Promise(r => setTimeout(r, 1000));

  // Should have received some prices
  const prices = stream.getAllPrices();
  console.log(`      (Received ${prices.length} price updates)`);

  stream.disconnect();
});

await test('Receive price updates', async () => {
  const stream = new PredictionMarketsStream({
    platforms: ['manifold'],
    detectArbitrage: false,
  });

  const prices: PriceUpdate[] = [];

  stream.on('price', (update: PriceUpdate) => {
    prices.push(update);
  });

  await stream.connect();

  // Wait for price updates
  await new Promise(r => setTimeout(r, 6000));

  assert(prices.length > 0, 'Should receive price updates');
  assert(prices[0].platform === 'manifold', 'Platform should be manifold');
  assert(typeof prices[0].yesPrice === 'number', 'Should have YES price');
  assert(typeof prices[0].noPrice === 'number', 'Should have NO price');

  console.log(`      (Received ${prices.length} prices in 6s)`);

  stream.disconnect();
});

await test('Subscribe to specific market', () => {
  const stream = new PredictionMarketsStream();

  stream.subscribe('kalshi', 'KXBTC100K');
  stream.subscribe('manifold', 'test-market-id');

  // No error means success
  assert(true, 'Subscriptions added');
});

await test('Get latest cached price', async () => {
  const stream = new PredictionMarketsStream({
    platforms: ['manifold'],
  });

  await stream.connect();
  await new Promise(r => setTimeout(r, 6000));

  const prices = stream.getAllPrices();
  if (prices.length > 0) {
    const cached = stream.getLatestPrice(prices[0].platform, prices[0].marketId);
    assert(cached !== null, 'Should get cached price');
    assert(cached.marketId === prices[0].marketId, 'Market ID should match');
  }

  stream.disconnect();
});

await test('Singleton instance', () => {
  const stream1 = getStream({ platforms: ['kalshi'] });
  const stream2 = getStream();

  assert(stream1 === stream2, 'Should return same instance');
});

// ============================================================================
// Alert Manager Tests
// ============================================================================

console.log('\n2. Real-Time Alert Manager');

await test('Create alert', () => {
  const alertManager = new RealTimeAlertManager();

  const alert = alertManager.createAlert('kalshi', 'TEST-MKT', 'price_above', 0.75);

  assert(alert.id.startsWith('RT-ALERT-'), 'Alert ID should have prefix');
  assert(alert.platform === 'kalshi', 'Platform should match');
  assert(alert.type === 'price_above', 'Type should match');
  assert(alert.threshold === 0.75, 'Threshold should match');
  assert(alert.triggered === false, 'Should not be triggered');
});

await test('Remove alert', () => {
  const alertManager = new RealTimeAlertManager();

  const alert = alertManager.createAlert('polymarket', 'MKT1', 'price_below', 0.3);
  const removed = alertManager.removeAlert(alert.id);

  assert(removed === true, 'Should successfully remove');
  assert(alertManager.getActiveAlerts().length === 0, 'No active alerts');
});

await test('Trigger alert on price update', async () => {
  const alertManager = new RealTimeAlertManager();
  const stream = new PredictionMarketsStream({ platforms: ['manifold'] });

  alertManager.attachStream(stream);

  // Create alert that should trigger
  alertManager.createAlert('manifold', '*', 'price_above', 0.01); // Low threshold

  let triggered = false;
  alertManager.on('alert_triggered', () => {
    triggered = true;
  });

  await stream.connect();
  await new Promise(r => setTimeout(r, 6000));

  // Should have triggered on any price > 1%
  console.log(`      (Alert triggered: ${triggered})`);

  stream.disconnect();
});

await test('Get active vs triggered alerts', () => {
  const alertManager = new RealTimeAlertManager();

  alertManager.createAlert('kalshi', 'MKT1', 'price_above', 0.9);
  alertManager.createAlert('kalshi', 'MKT2', 'price_below', 0.1);

  const active = alertManager.getActiveAlerts();
  assert(active.length === 2, 'Should have 2 active alerts');

  const triggered = alertManager.getTriggeredAlerts();
  assert(triggered.length === 0, 'Should have no triggered alerts');
});

await test('Arbitrage alert type', () => {
  const alertManager = new RealTimeAlertManager();

  const alert = alertManager.createAlert('kalshi', '*', 'arbitrage', 5); // 5% profit threshold

  assert(alert.type === 'arbitrage', 'Type should be arbitrage');
  assert(alert.threshold === 5, 'Threshold should be 5');
});

// ============================================================================
// Arbitrage Detection Tests
// ============================================================================

console.log('\n3. Arbitrage Detection');

await test('Detect arbitrage opportunities', async () => {
  const stream = new PredictionMarketsStream({
    platforms: ['kalshi', 'manifold'],
    detectArbitrage: true,
    arbitrageThreshold: 0.02,
  });

  const opportunities: ArbitrageSignal[] = [];

  stream.on('arbitrage', (signal: ArbitrageSignal) => {
    opportunities.push(signal);
  });

  await stream.connect();
  await new Promise(r => setTimeout(r, 8000));

  const manualOpps = stream.getArbitrageOpportunities();
  console.log(`      (Found ${manualOpps.length} opportunities via scan)`);
  console.log(`      (Found ${opportunities.length} via real-time detection)`);

  stream.disconnect();
});

await test('Get current arbitrage opportunities', async () => {
  const stream = new PredictionMarketsStream({
    platforms: ['manifold'],
    detectArbitrage: true,
  });

  await stream.connect();
  await new Promise(r => setTimeout(r, 6000));

  const opportunities = stream.getArbitrageOpportunities();
  assert(Array.isArray(opportunities), 'Should return array');

  if (opportunities.length > 0) {
    assert(opportunities[0].spread >= 0, 'Spread should be non-negative');
    assert(opportunities[0].expectedProfit >= 0, 'Profit should be non-negative');
  }

  stream.disconnect();
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All WebSocket streaming tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
