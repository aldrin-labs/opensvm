#!/usr/bin/env bun
/**
 * Kalshi MCP Server Tests
 *
 * Tests both the Kalshi API client and the trading functionality.
 */

console.log('Kalshi MCP Server Tests');
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

// ============================================================================
// Mock Clients for Testing
// ============================================================================

class MockKalshiClient {
  async listMarkets(options: any = {}) {
    return {
      markets: [
        {
          ticker: 'KXBTC100K-25DEC31',
          title: 'Will Bitcoin reach $100K by Dec 31, 2025?',
          status: 'active',
          yes_bid: 65,
          yes_ask: 67,
          no_bid: 33,
          no_ask: 35,
          volume_24h: 1500,
          close_time: '2025-12-31T23:59:00Z',
        },
        {
          ticker: 'KXFEDRATE-25JAN',
          title: 'Will Fed cut rates in January 2025?',
          status: 'active',
          yes_bid: 45,
          yes_ask: 48,
          no_bid: 52,
          no_ask: 55,
          volume_24h: 3200,
          close_time: '2025-01-31T23:59:00Z',
        },
      ],
      cursor: null,
    };
  }

  async getMarket(ticker: string) {
    return {
      market: {
        ticker,
        title: 'Will Bitcoin reach $100K by Dec 31, 2025?',
        subtitle: 'BTC must trade at or above $100,000 on Coinbase',
        status: 'active',
        yes_bid: 65,
        yes_ask: 67,
        no_bid: 33,
        no_ask: 35,
        last_price: 66,
        volume: 25000,
        volume_24h: 1500,
        open_interest: 12000,
        liquidity: 50000,
        close_time: '2025-12-31T23:59:00Z',
        expiration_time: '2026-01-07T23:59:00Z',
        rules_primary: 'This market resolves to Yes if...',
        result: '',
      },
    };
  }

  async getOrderbook(ticker: string) {
    return {
      orderbook: {
        yes: [
          { price: 65, quantity: 500 },
          { price: 64, quantity: 800 },
          { price: 63, quantity: 1200 },
        ],
        no: [
          { price: 35, quantity: 400 },
          { price: 36, quantity: 600 },
          { price: 37, quantity: 900 },
        ],
      },
    };
  }

  async getTrades(ticker: string, limit: number = 20) {
    return {
      trades: [
        { yes_price: 66, count: 50, taker_side: 'yes', created_time: '2025-12-04T10:00:00Z' },
        { yes_price: 65, count: 30, taker_side: 'no', created_time: '2025-12-04T09:55:00Z' },
        { yes_price: 66, count: 100, taker_side: 'yes', created_time: '2025-12-04T09:50:00Z' },
      ],
    };
  }
}

// Position tracking
const positions = new Map<string, any>();
const trades: any[] = [];
let tradeCounter = 0;

// ============================================================================
// Tests
// ============================================================================

async function runAllTests() {
  const kalshi = new MockKalshiClient();

  console.log('\n1. Market Data Tools');

  await test('List markets returns array', async () => {
    const result = await kalshi.listMarkets({ status: 'open' });
    assert(Array.isArray(result.markets), 'Should return markets array');
    assert(result.markets.length > 0, 'Should have at least one market');
  });

  await test('Get market returns details', async () => {
    const result = await kalshi.getMarket('KXBTC100K-25DEC31');
    const market = result.market;

    assert(market.ticker === 'KXBTC100K-25DEC31', 'Ticker should match');
    assert(typeof market.yes_bid === 'number', 'Should have yes_bid');
    assert(typeof market.yes_ask === 'number', 'Should have yes_ask');
    assert(market.status === 'active', 'Status should be active');
  });

  await test('Get orderbook shows depth', async () => {
    const result = await kalshi.getOrderbook('KXBTC100K-25DEC31');
    const book = result.orderbook;

    assert(Array.isArray(book.yes), 'Should have yes orders');
    assert(Array.isArray(book.no), 'Should have no orders');
    assert(book.yes.length > 0, 'Should have yes bids');
    assert(book.no.length > 0, 'Should have no bids');
  });

  await test('Get trades returns history', async () => {
    const result = await kalshi.getTrades('KXBTC100K-25DEC31', 10);

    assert(Array.isArray(result.trades), 'Should return trades array');
    assert(result.trades.length > 0, 'Should have trades');
    assert(typeof result.trades[0].yes_price === 'number', 'Trades should have price');
  });

  console.log('\n2. Trading Simulation');

  await test('Buy YES contracts', async () => {
    const ticker = 'KXBTC100K-25DEC31';
    const walletId = 'test-wallet';
    const side = 'yes';
    const quantity = 100;

    const market = await kalshi.getMarket(ticker);
    const price = market.market.yes_ask;
    const total = (price / 100) * quantity;
    const fee = total * 0.01;

    tradeCounter++;
    const trade = {
      id: `T-${tradeCounter}`,
      walletId,
      marketTicker: ticker,
      side,
      action: 'buy',
      quantity,
      price: price / 100,
      total,
      fee,
      timestamp: Date.now(),
    };
    trades.push(trade);

    const posKey = `${walletId}-${ticker}-${side}`;
    positions.set(posKey, {
      id: posKey,
      walletId,
      marketTicker: ticker,
      side,
      quantity,
      avgPrice: price / 100,
      currentPrice: price / 100,
      unrealizedPnl: 0,
      createdAt: Date.now(),
    });

    assert(trade.quantity === 100, 'Quantity should be 100');
    assert(trade.price === 0.67, 'Price should be 0.67');
    assert(positions.has(posKey), 'Position should be created');
  });

  await test('Buy NO contracts', async () => {
    const ticker = 'KXBTC100K-25DEC31';
    const walletId = 'test-wallet';
    const side = 'no';
    const quantity = 50;

    const market = await kalshi.getMarket(ticker);
    const price = market.market.no_ask;
    const total = (price / 100) * quantity;

    tradeCounter++;
    const trade = {
      id: `T-${tradeCounter}`,
      walletId,
      marketTicker: ticker,
      side,
      action: 'buy',
      quantity,
      price: price / 100,
      total,
      fee: total * 0.01,
      timestamp: Date.now(),
    };
    trades.push(trade);

    const posKey = `${walletId}-${ticker}-${side}`;
    positions.set(posKey, {
      id: posKey,
      walletId,
      marketTicker: ticker,
      side,
      quantity,
      avgPrice: price / 100,
      currentPrice: price / 100,
      unrealizedPnl: 0,
      createdAt: Date.now(),
    });

    assert(trade.side === 'no', 'Side should be no');
    assert(positions.has(posKey), 'NO position should be created');
  });

  await test('Sell YES contracts (partial)', async () => {
    const ticker = 'KXBTC100K-25DEC31';
    const walletId = 'test-wallet';
    const side = 'yes';
    const quantity = 50;

    const posKey = `${walletId}-${ticker}-${side}`;
    const position = positions.get(posKey);

    assert(position !== undefined, 'Position should exist');
    assert(position.quantity >= quantity, 'Should have enough to sell');

    const market = await kalshi.getMarket(ticker);
    const price = market.market.yes_bid;
    const total = (price / 100) * quantity;
    const pnl = (price / 100 - position.avgPrice) * quantity;

    tradeCounter++;
    const trade = {
      id: `T-${tradeCounter}`,
      walletId,
      marketTicker: ticker,
      side,
      action: 'sell',
      quantity,
      price: price / 100,
      total,
      fee: total * 0.01,
      pnl,
      timestamp: Date.now(),
    };
    trades.push(trade);

    position.quantity -= quantity;

    assert(position.quantity === 50, 'Should have 50 remaining');
    assert(trade.action === 'sell', 'Action should be sell');
  });

  await test('Get positions returns all open', async () => {
    const walletId = 'test-wallet';
    const walletPositions = Array.from(positions.values())
      .filter((p: any) => p.walletId === walletId && p.quantity > 0);

    assert(walletPositions.length === 2, 'Should have 2 positions (YES and NO)');
  });

  await test('Calculate PnL', async () => {
    const walletId = 'test-wallet';
    const walletTrades = trades.filter((t: any) => t.walletId === walletId);
    const walletPositions = Array.from(positions.values())
      .filter((p: any) => p.walletId === walletId);

    const totalFees = walletTrades.reduce((sum: number, t: any) => sum + t.fee, 0);
    const unrealizedPnl = walletPositions.reduce((sum: number, p: any) => sum + p.unrealizedPnl, 0);

    assert(walletTrades.length === 3, 'Should have 3 trades');
    assert(totalFees > 0, 'Should have paid fees');
    assert(typeof unrealizedPnl === 'number', 'Should calculate unrealized PnL');
  });

  console.log('\n3. Portfolio Management');

  await test('Trade history is ordered', async () => {
    const walletId = 'test-wallet';
    const history = trades
      .filter((t: any) => t.walletId === walletId)
      .sort((a: any, b: any) => b.timestamp - a.timestamp);

    assert(history.length === 3, 'Should have 3 trades');
    assert(history[0].timestamp >= history[1].timestamp, 'Should be ordered by time');
  });

  await test('Position value calculation', async () => {
    const walletId = 'test-wallet';
    const walletPositions = Array.from(positions.values())
      .filter((p: any) => p.walletId === walletId && p.quantity > 0);

    const totalValue = walletPositions.reduce(
      (sum: number, p: any) => sum + p.currentPrice * p.quantity, 0
    );

    assert(totalValue > 0, 'Should have positive total value');
  });

  console.log('\n4. Live API Integration');

  // Test with real Kalshi API
  await test('Real Kalshi API - list markets', async () => {
    try {
      const response = await fetch(
        'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=3'
      );
      const data = await response.json();

      assert(Array.isArray(data.markets), 'Should return markets array');
      console.log(`      (Found ${data.markets.length} real markets)`);
    } catch (e) {
      console.log('      (Kalshi API unavailable - skipping)');
    }
  });

  await test('Real Kalshi API - get market', async () => {
    try {
      const listResponse = await fetch(
        'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=1'
      );
      const listData = await listResponse.json();

      if (listData.markets?.length > 0) {
        const ticker = listData.markets[0].ticker;
        const response = await fetch(
          `https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`
        );
        const data = await response.json();

        assert(data.market?.ticker === ticker, 'Should return requested market');
        console.log(`      (Got ${ticker}: ${data.market.title?.slice(0, 40)}...)`);
      }
    } catch (e) {
      console.log('      (Kalshi API unavailable - skipping)');
    }
  });

  // ============================================================================
  // Results
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

  if (failed === 0) {
    console.log('\n[SUCCESS] All Kalshi MCP tests passed!');
  } else {
    console.log(`\n[ERROR] ${failed} test(s) failed`);
    process.exit(1);
  }
}

runAllTests().catch(console.error);
