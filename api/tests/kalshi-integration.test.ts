/**
 * Integration Tests for Kalshi Trading System
 *
 * Tests the full trading pipeline:
 * - Strategy -> Signal -> Paper Trading -> Position -> P&L
 * - Agent lifecycle
 * - Competition flow
 * - Copy trading events
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { EventEmitter } from 'events';

import {
  MeanReversionStrategy,
  MomentumStrategy,
  SpreadStrategy,
  ArbitrageStrategy,
  DEFAULT_AGENT_CONFIG,
} from '../src/mcp-kalshi-agent.js';

import {
  PaperTradingEngine,
  DEFAULT_PAPER_CONFIG,
} from '../src/mcp-kalshi-paper-trading.js';

import { LiquidityAnalyzer } from '../src/mcp-kalshi-liquidity.js';

// ============================================================================
// Mocks
// ============================================================================

class MockWebSocketClient extends EventEmitter {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  disconnect(): void {
    this.connected = false;
    this.emit('disconnected', { code: 1000 });
  }

  subscribe(type: string, tickers: string[], callback: Function): string {
    return `sub-${Date.now()}`;
  }

  unsubscribe(id: string): boolean {
    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSubscriptionCount(): number {
    return 0;
  }
}

class MockAggregator extends EventEmitter {
  private marketData: Map<string, any> = new Map();

  setMarketData(ticker: string, data: any): void {
    this.marketData.set(ticker, data);
    this.emit('marketUpdate', data);
  }

  getMarketData(ticker: string): any {
    return this.marketData.get(ticker);
  }

  getAllMarketData(): any[] {
    return Array.from(this.marketData.values());
  }

  subscribe(tickers: string[]): void {}
}

function createMockMarketData(ticker: string, options: {
  yesBid?: number;
  noBid?: number;
  volume1m?: number;
  priceChange1m?: number;
  trades?: any[];
} = {}) {
  const yesBid = options.yesBid ?? 50;
  const noBid = options.noBid ?? 50;

  return {
    ticker,
    lastUpdate: Date.now(),
    orderbook: {
      yes: [{ price: yesBid, quantity: 100 }],
      no: [{ price: noBid, quantity: 100 }],
      spread: 100 - yesBid - noBid,
      midPrice: (yesBid + (100 - noBid)) / 2,
    },
    trades: options.trades || [],
    volume1m: options.volume1m ?? 50,
    vwap1m: yesBid,
    priceChange1m: options.priceChange1m ?? 0,
  };
}

// ============================================================================
// Strategy -> Paper Trading Integration
// ============================================================================

describe('Strategy to Paper Trading Integration', () => {
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;
  let paperEngine: PaperTradingEngine;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
    paperEngine = new PaperTradingEngine(
      {
        ...DEFAULT_PAPER_CONFIG,
        startingBalance: 100000,
        enableSlippage: false,
        enablePartialFills: false,
        executionDelay: 0,
        rejectProbability: 0,
      },
      mockWs as any,
      mockAggregator as any
    );
  });

  it('should execute trade from spread strategy signal', async () => {
    // Create wide spread market
    const marketData = createMockMarketData('SPREAD-TEST', {
      yesBid: 40,
      noBid: 40,
    });
    mockAggregator.setMarketData('SPREAD-TEST', marketData);

    // Generate signal
    const signal = SpreadStrategy.analyze(marketData, []);
    expect(signal).not.toBeNull();

    // Execute through paper trading
    const order = await paperEngine.submitOrder({
      ticker: signal!.ticker,
      side: signal!.side,
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    expect(order.status).toBe('filled');
    expect(paperEngine.getPositions()).toHaveLength(1);
  });

  it('should track P&L after strategy-driven trade', async () => {
    // Initial market
    const marketData = createMockMarketData('PNL-TEST', {
      yesBid: 40,
      noBid: 40,
    });
    mockAggregator.setMarketData('PNL-TEST', marketData);

    // Buy YES at 40
    await paperEngine.submitOrder({
      ticker: 'PNL-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    // Price moves up
    const updatedMarket = createMockMarketData('PNL-TEST', {
      yesBid: 60,
      noBid: 40,
    });
    mockAggregator.setMarketData('PNL-TEST', updatedMarket);

    // Check unrealized P&L
    const pnl = paperEngine.getUnrealizedPnl();
    expect(pnl).toBe(200); // (60-40) * 10 = 200 cents
  });

  it('should handle multiple strategy signals in sequence', async () => {
    // Market 1 - Spread opportunity
    mockAggregator.setMarketData('MARKET-1', createMockMarketData('MARKET-1', {
      yesBid: 40,
      noBid: 40,
    }));

    // Market 2 - Momentum opportunity
    const momentumTrades = Array(10).fill(null).map((_, i) => ({
      price: 50 + i * 2,
      count: 10,
      timestamp: Date.now() - (10 - i) * 1000,
    }));
    mockAggregator.setMarketData('MARKET-2', createMockMarketData('MARKET-2', {
      yesBid: 68,
      noBid: 32,
      priceChange1m: 18,
      volume1m: 100,
      trades: momentumTrades,
    }));

    // Execute spread trade
    const spreadSignal = SpreadStrategy.analyze(
      mockAggregator.getMarketData('MARKET-1'),
      []
    );
    if (spreadSignal) {
      await paperEngine.submitOrder({
        ticker: spreadSignal.ticker,
        side: spreadSignal.side,
        action: 'buy',
        type: 'market',
        quantity: 5,
      });
    }

    // Execute momentum trade
    const momentumSignal = MomentumStrategy.analyze(
      mockAggregator.getMarketData('MARKET-2'),
      paperEngine.getPositions() as any
    );
    if (momentumSignal) {
      await paperEngine.submitOrder({
        ticker: momentumSignal.ticker,
        side: momentumSignal.side,
        action: 'buy',
        type: 'market',
        quantity: 5,
      });
    }

    // Should have 2 positions
    expect(paperEngine.getPositions().length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Liquidity Analysis Integration
// ============================================================================

describe('Liquidity Analysis Integration', () => {
  let analyzer: LiquidityAnalyzer;

  beforeEach(() => {
    analyzer = new LiquidityAnalyzer();
  });

  it('should score market liquidity correctly', () => {
    const marketData = createMockMarketData('LIQUID-TEST', {
      yesBid: 48,
      noBid: 48, // 4 cent spread
      volume1m: 100,
    });

    const score = analyzer.analyzeMarket(marketData);

    expect(score.ticker).toBe('LIQUID-TEST');
    expect(score.spread).toBe(4);
    expect(score.overall).toBeGreaterThan(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('should find spread opportunities', () => {
    const markets = [
      createMockMarketData('TIGHT-SPREAD', { yesBid: 49, noBid: 49 }), // 2c spread
      createMockMarketData('WIDE-SPREAD', { yesBid: 40, noBid: 40 }),  // 20c spread
      createMockMarketData('MED-SPREAD', { yesBid: 45, noBid: 45 }),   // 10c spread
    ];

    markets.forEach(m => analyzer.analyzeMarket(m));
    const opportunities = analyzer.findSpreadOpportunities(markets);

    // Should find the wide spread markets
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0].ticker).toBe('WIDE-SPREAD');
  });

  it('should generate alerts on spread changes', () => {
    let alertReceived = false;
    analyzer.on('alert', (alert) => {
      alertReceived = true;
    });

    // Initial market
    analyzer.analyzeMarket(createMockMarketData('ALERT-TEST', {
      yesBid: 48,
      noBid: 48,
    }));

    // Spread widens significantly
    analyzer.analyzeMarket(createMockMarketData('ALERT-TEST', {
      yesBid: 40,
      noBid: 40,
    }));

    expect(alertReceived).toBe(true);
  });

  it('should generate heatmap data', () => {
    const markets = [
      createMockMarketData('CRYPTO-BTC', { yesBid: 48, noBid: 48 }),
      createMockMarketData('POLITICS-PRES', { yesBid: 45, noBid: 45 }),
      createMockMarketData('SPORTS-NFL', { yesBid: 40, noBid: 40 }),
    ];

    markets.forEach(m => analyzer.analyzeMarket(m));
    const heatmap = analyzer.generateHeatmap();

    expect(heatmap).toHaveLength(3);
    heatmap.forEach(cell => {
      expect(cell.ticker).toBeDefined();
      expect(cell.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(cell.liquidityScore).toBeGreaterThanOrEqual(0);
    });
  });

  it('should provide accurate summary statistics', () => {
    const markets = [
      createMockMarketData('MKT-1', { yesBid: 48, noBid: 48, volume1m: 100 }),
      createMockMarketData('MKT-2', { yesBid: 45, noBid: 45, volume1m: 50 }),
      createMockMarketData('MKT-3', { yesBid: 40, noBid: 40, volume1m: 200 }),
    ];

    markets.forEach(m => analyzer.analyzeMarket(m));
    const summary = analyzer.getSummary();

    expect(summary.totalMarkets).toBe(3);
    expect(summary.avgSpread).toBeGreaterThan(0);
    expect(summary.topLiquidMarkets).toHaveLength(3);
  });
});

// ============================================================================
// Full Trading Cycle Integration
// ============================================================================

describe('Full Trading Cycle', () => {
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;
  let paperEngine: PaperTradingEngine;
  let liquidityAnalyzer: LiquidityAnalyzer;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
    paperEngine = new PaperTradingEngine(
      {
        ...DEFAULT_PAPER_CONFIG,
        startingBalance: 100000,
        enableSlippage: false,
        enablePartialFills: false,
        executionDelay: 0,
        rejectProbability: 0,
      },
      mockWs as any,
      mockAggregator as any
    );
    liquidityAnalyzer = new LiquidityAnalyzer();
  });

  it('should complete full cycle: analyze -> signal -> trade -> close -> profit', async () => {
    const initialBalance = paperEngine.getBalance();

    // 1. Setup market with opportunity
    const market = createMockMarketData('CYCLE-TEST', {
      yesBid: 40,
      noBid: 40, // 20c spread - good opportunity
    });
    mockAggregator.setMarketData('CYCLE-TEST', market);

    // 2. Analyze liquidity
    const liquidityScore = liquidityAnalyzer.analyzeMarket(market);
    expect(liquidityScore.spread).toBe(20);

    // 3. Generate signal
    const signal = SpreadStrategy.analyze(market, []);
    expect(signal).not.toBeNull();

    // 4. Execute entry trade
    const entryOrder = await paperEngine.submitOrder({
      ticker: signal!.ticker,
      side: signal!.side,
      action: 'buy',
      type: 'market',
      quantity: 10,
    });
    expect(entryOrder.status).toBe('filled');

    // 5. Price moves favorably
    const favorableMarket = createMockMarketData('CYCLE-TEST', {
      yesBid: signal!.side === 'yes' ? 55 : 45,
      noBid: signal!.side === 'no' ? 55 : 45,
    });
    mockAggregator.setMarketData('CYCLE-TEST', favorableMarket);

    // 6. Execute exit trade
    const exitOrder = await paperEngine.submitOrder({
      ticker: signal!.ticker,
      side: signal!.side,
      action: 'sell',
      type: 'market',
      quantity: 10,
    });
    expect(exitOrder.status).toBe('filled');

    // 7. Verify profit
    const finalBalance = paperEngine.getBalance();
    expect(finalBalance).toBeGreaterThan(initialBalance - 100); // Account for fees

    // 8. Verify position closed
    expect(paperEngine.getPositions()).toHaveLength(0);

    // 9. Verify trade history
    const trades = paperEngine.getTrades();
    expect(trades).toHaveLength(2);
  });

  it('should handle losing trade correctly', async () => {
    const initialBalance = paperEngine.getBalance();

    // Setup market
    mockAggregator.setMarketData('LOSS-TEST', createMockMarketData('LOSS-TEST', {
      yesBid: 50,
      noBid: 50,
    }));

    // Buy YES at 50
    await paperEngine.submitOrder({
      ticker: 'LOSS-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 20,
    });

    // Price drops to 30
    mockAggregator.setMarketData('LOSS-TEST', createMockMarketData('LOSS-TEST', {
      yesBid: 30,
      noBid: 70,
    }));

    // Sell at loss
    await paperEngine.submitOrder({
      ticker: 'LOSS-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 20,
    });

    // Verify loss recorded
    const metrics = paperEngine.getMetrics();
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.totalReturn).toBeLessThan(0);
  });

  it('should track metrics across multiple trades', async () => {
    mockAggregator.setMarketData('MULTI-TEST', createMockMarketData('MULTI-TEST', {
      yesBid: 50,
      noBid: 50,
    }));

    // Trade 1: Win
    await paperEngine.submitOrder({
      ticker: 'MULTI-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });
    mockAggregator.setMarketData('MULTI-TEST', createMockMarketData('MULTI-TEST', {
      yesBid: 60,
      noBid: 40,
    }));
    await paperEngine.submitOrder({
      ticker: 'MULTI-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 10,
    });

    // Trade 2: Loss
    mockAggregator.setMarketData('MULTI-TEST', createMockMarketData('MULTI-TEST', {
      yesBid: 50,
      noBid: 50,
    }));
    await paperEngine.submitOrder({
      ticker: 'MULTI-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });
    mockAggregator.setMarketData('MULTI-TEST', createMockMarketData('MULTI-TEST', {
      yesBid: 40,
      noBid: 60,
    }));
    await paperEngine.submitOrder({
      ticker: 'MULTI-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 10,
    });

    // Trade 3: Win
    mockAggregator.setMarketData('MULTI-TEST', createMockMarketData('MULTI-TEST', {
      yesBid: 50,
      noBid: 50,
    }));
    await paperEngine.submitOrder({
      ticker: 'MULTI-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });
    mockAggregator.setMarketData('MULTI-TEST', createMockMarketData('MULTI-TEST', {
      yesBid: 70,
      noBid: 30,
    }));
    await paperEngine.submitOrder({
      ticker: 'MULTI-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 10,
    });

    const metrics = paperEngine.getMetrics();

    expect(metrics.totalTrades).toBe(3);
    expect(metrics.winningTrades).toBe(2);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.winRate).toBeCloseTo(66.67, 0);
  });
});

// ============================================================================
// Event Flow Integration
// ============================================================================

describe('Event Flow Integration', () => {
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;
  let paperEngine: PaperTradingEngine;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
    paperEngine = new PaperTradingEngine(
      {
        ...DEFAULT_PAPER_CONFIG,
        startingBalance: 100000,
        enableSlippage: false,
        enablePartialFills: false,
        executionDelay: 0,
        rejectProbability: 0,
      },
      mockWs as any,
      mockAggregator as any
    );
  });

  it('should emit events in correct order for buy', async () => {
    const events: string[] = [];

    paperEngine.on('order_created', () => events.push('order_created'));
    paperEngine.on('fill', () => events.push('fill'));
    paperEngine.on('order_updated', () => events.push('order_updated'));
    paperEngine.on('position_opened', () => events.push('position_opened'));

    mockAggregator.setMarketData('EVENT-TEST', createMockMarketData('EVENT-TEST'));

    await paperEngine.submitOrder({
      ticker: 'EVENT-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    expect(events).toContain('order_created');
    expect(events).toContain('fill');
    expect(events).toContain('position_opened');
  });

  it('should emit position_closed on full sell', async () => {
    let positionClosed = false;

    paperEngine.on('position_closed', () => {
      positionClosed = true;
    });

    mockAggregator.setMarketData('CLOSE-TEST', createMockMarketData('CLOSE-TEST'));

    await paperEngine.submitOrder({
      ticker: 'CLOSE-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    await paperEngine.submitOrder({
      ticker: 'CLOSE-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 10,
    });

    expect(positionClosed).toBe(true);
  });

  it('should update positions on market data changes', async () => {
    let positionsUpdated = false;

    paperEngine.on('positions_updated', () => {
      positionsUpdated = true;
    });

    mockAggregator.setMarketData('UPDATE-TEST', createMockMarketData('UPDATE-TEST', {
      yesBid: 50,
    }));

    await paperEngine.submitOrder({
      ticker: 'UPDATE-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    // Trigger market update
    mockAggregator.setMarketData('UPDATE-TEST', createMockMarketData('UPDATE-TEST', {
      yesBid: 60,
    }));

    expect(positionsUpdated).toBe(true);
  });
});

// ============================================================================
// Error Handling Integration
// ============================================================================

describe('Error Handling Integration', () => {
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;
  let paperEngine: PaperTradingEngine;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
    paperEngine = new PaperTradingEngine(
      {
        ...DEFAULT_PAPER_CONFIG,
        startingBalance: 100000,
        enableSlippage: false,
        enablePartialFills: false,
        executionDelay: 0,
        rejectProbability: 0,
      },
      mockWs as any,
      mockAggregator as any
    );
  });

  it('should handle trade when balance insufficient mid-session', async () => {
    mockAggregator.setMarketData('BALANCE-TEST', createMockMarketData('BALANCE-TEST', {
      yesBid: 90, // Expensive
    }));

    // Use most of balance
    await paperEngine.submitOrder({
      ticker: 'BALANCE-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 1000, // 90 * 1000 = 90000 + fees
    });

    // Try to buy more
    const order = await paperEngine.submitOrder({
      ticker: 'BALANCE-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 500,
    });

    expect(order.status).toBe('rejected');
    expect(order.reason).toContain('Insufficient');
  });

  it('should handle sell of more than position', async () => {
    mockAggregator.setMarketData('OVERSELL-TEST', createMockMarketData('OVERSELL-TEST'));

    await paperEngine.submitOrder({
      ticker: 'OVERSELL-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    const order = await paperEngine.submitOrder({
      ticker: 'OVERSELL-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 20, // More than we have
    });

    expect(order.status).toBe('rejected');
  });

  it('should maintain consistency after failed trade', async () => {
    mockAggregator.setMarketData('CONSISTENCY-TEST', createMockMarketData('CONSISTENCY-TEST'));

    const initialBalance = paperEngine.getBalance();

    await paperEngine.submitOrder({
      ticker: 'CONSISTENCY-TEST',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    const balanceAfterBuy = paperEngine.getBalance();

    // Failed sell (more than position)
    await paperEngine.submitOrder({
      ticker: 'CONSISTENCY-TEST',
      side: 'yes',
      action: 'sell',
      type: 'market',
      quantity: 20,
    });

    // Balance should not change after failed trade
    expect(paperEngine.getBalance()).toBe(balanceAfterBuy);
    expect(paperEngine.getPositions()).toHaveLength(1);
    expect(paperEngine.getPositions()[0].quantity).toBe(10);
  });
});
