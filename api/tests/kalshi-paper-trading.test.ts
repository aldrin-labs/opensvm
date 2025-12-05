/**
 * Unit Tests for Kalshi Paper Trading Engine
 *
 * Tests cover:
 * - Order submission and validation
 * - Position management
 * - P&L calculations
 * - Fill simulation
 * - Performance metrics
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import {
  PaperTradingEngine,
  type PaperTradingConfig,
  type VirtualOrder,
  type VirtualPosition,
  DEFAULT_PAPER_CONFIG,
} from '../src/mcp-kalshi-paper-trading.js';
import { EventEmitter } from 'events';

// ============================================================================
// Mock Market Data Aggregator
// ============================================================================

class MockAggregator extends EventEmitter {
  private marketData: Map<string, any> = new Map();

  setMarketData(ticker: string, data: any): void {
    this.marketData.set(ticker, data);
    // Emit marketUpdate to trigger PaperTradingEngine's cache update
    this.emit('marketUpdate', data);
  }

  getMarketData(ticker: string): any {
    return this.marketData.get(ticker);
  }

  subscribe(tickers: string[]): void {
    // No-op for tests
  }
}

class MockWebSocketClient extends EventEmitter {
  async connect(): Promise<void> {}
  disconnect(): void {}
  subscribe(): string { return 'sub-1'; }
  unsubscribe(): boolean { return true; }
  isConnected(): boolean { return true; }
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestConfig(overrides: Partial<PaperTradingConfig> = {}): PaperTradingConfig {
  return {
    ...DEFAULT_PAPER_CONFIG,
    startingBalance: 100000, // $1000
    enableSlippage: false,   // Disable for predictable tests
    enablePartialFills: false,
    executionDelay: 0,       // No delay for faster tests
    rejectProbability: 0,    // No random rejections
    ...overrides,
  };
}

function createMockMarketData(ticker: string, yesBid: number = 50, noBid: number = 50) {
  return {
    ticker,
    lastUpdate: Date.now(),
    orderbook: {
      yes: [{ price: yesBid, quantity: 100 }],
      no: [{ price: noBid, quantity: 100 }],
      spread: 100 - yesBid - noBid,
      midPrice: (yesBid + (100 - noBid)) / 2,
    },
    trades: [],
    volume1m: 50,
    vwap1m: yesBid,
    priceChange1m: 0,
  };
}

// ============================================================================
// Paper Trading Engine Tests
// ============================================================================

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine;
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
    engine = new PaperTradingEngine(
      createTestConfig(),
      mockWs as any,
      mockAggregator as any
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('should initialize with correct starting balance', () => {
      expect(engine.getBalance()).toBe(100000);
    });

    it('should initialize with zero positions', () => {
      expect(engine.getPositions()).toHaveLength(0);
    });

    it('should initialize with zero trades', () => {
      expect(engine.getTrades()).toHaveLength(0);
    });

    it('should have correct initial equity', () => {
      expect(engine.getEquity()).toBe(100000);
    });

    it('should have zero unrealized P&L initially', () => {
      expect(engine.getUnrealizedPnl()).toBe(0);
    });

    it('should accept custom starting balance', () => {
      const customEngine = new PaperTradingEngine(
        createTestConfig({ startingBalance: 500000 }),
        mockWs as any,
        mockAggregator as any
      );
      expect(customEngine.getBalance()).toBe(500000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Order Validation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('order validation', () => {
    beforeEach(() => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));
    });

    it('should reject order when no market data available', async () => {
      const order = await engine.submitOrder({
        ticker: 'UNKNOWN-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      expect(order.status).toBe('rejected');
      expect(order.reason).toContain('No market data');
    });

    it('should reject buy order with insufficient balance', async () => {
      // Try to buy more than balance allows
      // At 50c per contract, 100000 cents = 2000 contracts max (before fees)
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 3000, // Too many
      });

      expect(order.status).toBe('rejected');
      expect(order.reason).toContain('Insufficient balance');
    });

    it('should reject sell order with no position', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      expect(order.status).toBe('rejected');
      expect(order.reason).toContain('Insufficient position');
    });

    it('should reject order with zero quantity', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 0,
      });

      expect(order.status).toBe('rejected');
      expect(order.reason).toContain('Invalid quantity');
    });

    it('should reject order with negative quantity', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: -10,
      });

      expect(order.status).toBe('rejected');
      expect(order.reason).toContain('Invalid quantity');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Buy Order Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('buy orders', () => {
    beforeEach(() => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));
    });

    it('should execute market buy order', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      expect(order.status).toBe('filled');
      expect(order.filledQuantity).toBe(10);
    });

    it('should deduct correct amount from balance', async () => {
      const initialBalance = engine.getBalance();

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      // 10 contracts at 50c = 500c, plus 1% fee = 505c
      const expectedDeduction = 10 * 50 * 1.01;
      expect(engine.getBalance()).toBe(initialBalance - expectedDeduction);
    });

    it('should create position after buy', async () => {
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      const positions = engine.getPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].ticker).toBe('TEST-MARKET');
      expect(positions[0].side).toBe('yes');
      expect(positions[0].quantity).toBe(10);
    });

    it('should set correct average price', async () => {
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      const position = engine.getPositions()[0];
      expect(position.avgPrice).toBe(50);
    });

    it('should add to existing position', async () => {
      // First buy
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      // Update price
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));

      // Second buy
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      const position = engine.getPositions()[0];
      expect(position.quantity).toBe(20);
      // Average: (10 * 50 + 10 * 60) / 20 = 55
      expect(position.avgPrice).toBe(55);
    });

    it('should execute limit buy order when price is acceptable', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'limit',
        quantity: 10,
        price: 55, // Willing to pay up to 55c
      });

      expect(order.status).toBe('filled');
    });

    it('should leave limit buy order open when price too high', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));

      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'limit',
        quantity: 10,
        price: 55, // Only willing to pay 55c, but market is at 60c
      });

      expect(order.status).toBe('open');
    });

    it('should record trade after buy', async () => {
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      const trades = engine.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].action).toBe('buy');
      expect(trades[0].quantity).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sell Order Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('sell orders', () => {
    beforeEach(async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      // Create initial position
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 20,
      });
    });

    it('should execute sell order', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      expect(order.status).toBe('filled');
    });

    it('should reduce position on partial sell', async () => {
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      const position = engine.getPositions()[0];
      expect(position.quantity).toBe(10);
    });

    it('should close position on full sell', async () => {
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 20,
      });

      expect(engine.getPositions()).toHaveLength(0);
    });

    it('should add proceeds to balance', async () => {
      const balanceBeforeSell = engine.getBalance();

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      // 10 contracts at 50c = 500c, minus 1% fee = 495c
      const expectedProceeds = 10 * 50 * 0.99;
      expect(engine.getBalance()).toBe(balanceBeforeSell + expectedProceeds);
    });

    it('should reject sell larger than position', async () => {
      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 30, // Only have 20
      });

      expect(order.status).toBe('rejected');
    });

    it('should calculate profit on winning trade', async () => {
      // Price went up
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      // Bought at 50, sold at 60, profit = 10c per contract
      const metrics = engine.getMetrics();
      expect(metrics.winningTrades).toBe(1);
    });

    it('should calculate loss on losing trade', async () => {
      // Price went down
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 40, 60));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      // Bought at 50, sold at 40, loss = 10c per contract
      const metrics = engine.getMetrics();
      expect(metrics.losingTrades).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // P&L Calculation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('P&L calculations', () => {
    beforeEach(async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });
    });

    it('should calculate unrealized P&L correctly when price rises', () => {
      // Simulate price update
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));
      mockAggregator.emit('marketUpdate', createMockMarketData('TEST-MARKET', 60, 40));

      // Unrealized P&L = (60 - 50) * 10 = 100 cents
      expect(engine.getUnrealizedPnl()).toBe(100);
    });

    it('should calculate unrealized P&L correctly when price falls', () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 40, 60));
      mockAggregator.emit('marketUpdate', createMockMarketData('TEST-MARKET', 40, 60));

      // Unrealized P&L = (40 - 50) * 10 = -100 cents
      expect(engine.getUnrealizedPnl()).toBe(-100);
    });

    it('should update equity with unrealized P&L', () => {
      const initialEquity = engine.getEquity();

      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));
      mockAggregator.emit('marketUpdate', createMockMarketData('TEST-MARKET', 60, 40));

      expect(engine.getEquity()).toBe(initialEquity + 100);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Performance Metrics Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('performance metrics', () => {
    it('should track total trades', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      expect(engine.getTrades()).toHaveLength(2);
    });

    it('should calculate win rate correctly', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      // Winning trade
      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      // Losing trade
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 40, 60));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 10,
      });

      const metrics = engine.getMetrics();
      expect(metrics.winRate).toBe(50); // 1 win, 1 loss = 50%
    });

    it('should track max drawdown', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 100,
      });

      // Big loss
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 30, 70));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'sell',
        type: 'market',
        quantity: 100,
      });

      const metrics = engine.getMetrics();
      expect(metrics.maxDrawdown).toBeGreaterThan(0);
    });

    it('should track consecutive wins', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      // Two winning trades
      for (let i = 0; i < 2; i++) {
        await engine.submitOrder({
          ticker: 'TEST-MARKET',
          side: 'yes',
          action: 'buy',
          type: 'market',
          quantity: 10,
        });

        mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));

        await engine.submitOrder({
          ticker: 'TEST-MARKET',
          side: 'yes',
          action: 'sell',
          type: 'market',
          quantity: 10,
        });

        mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));
      }

      const metrics = engine.getMetrics();
      expect(metrics.consecutiveWins).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Order Cancellation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('order cancellation', () => {
    it('should cancel open limit order', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 60, 40));

      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'limit',
        quantity: 10,
        price: 50, // Won't fill at current price
      });

      expect(order.status).toBe('open');

      const cancelled = engine.cancelOrder(order.id);
      expect(cancelled).toBe(true);

      const orders = engine.getOrders();
      const cancelledOrder = orders.find(o => o.id === order.id);
      expect(cancelledOrder?.status).toBe('cancelled');
    });

    it('should not cancel already filled order', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      expect(order.status).toBe('filled');

      const cancelled = engine.cancelOrder(order.id);
      expect(cancelled).toBe(false);
    });

    it('should return false for non-existent order', () => {
      const cancelled = engine.cancelOrder('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Reset Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should reset balance to starting amount', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      engine.reset();

      expect(engine.getBalance()).toBe(100000);
    });

    it('should clear all positions', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      engine.reset();

      expect(engine.getPositions()).toHaveLength(0);
    });

    it('should clear all trades', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      engine.reset();

      expect(engine.getTrades()).toHaveLength(0);
    });

    it('should reset metrics', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      engine.reset();

      const metrics = engine.getMetrics();
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.totalReturn).toBe(0);
    });

    it('should emit reset event', async () => {
      let resetEmitted = false;
      engine.on('reset', () => {
        resetEmitted = true;
      });

      engine.reset();

      expect(resetEmitted).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Export/Import Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('export/import', () => {
    it('should export all data', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      const exported = engine.exportData();

      expect(exported.balance).toBeDefined();
      expect(exported.positions).toBeDefined();
      expect(exported.trades).toBeDefined();
      expect(exported.metrics).toBeDefined();
    });

    it('should import data correctly', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      const exported = engine.exportData();

      // Create new engine and import
      const newEngine = new PaperTradingEngine(
        createTestConfig(),
        mockWs as any,
        mockAggregator as any
      );

      newEngine.importData(exported);

      expect(newEngine.getBalance()).toBe(exported.balance);
      expect(newEngine.getPositions()).toHaveLength(exported.positions.length);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Slippage Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('slippage simulation', () => {
    it('should apply slippage when enabled', async () => {
      const slippageEngine = new PaperTradingEngine(
        createTestConfig({
          enableSlippage: true,
          maxSlippage: 5,
        }),
        mockWs as any,
        mockAggregator as any
      );

      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      const order = await slippageEngine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 10,
      });

      // Price should be between 50 and 55 (50 + maxSlippage)
      expect(order.avgFillPrice).toBeGreaterThanOrEqual(50);
      expect(order.avgFillPrice).toBeLessThanOrEqual(55);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Fee Calculation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('fee calculation', () => {
    it('should calculate fees correctly', async () => {
      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      const order = await engine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 100,
      });

      // 100 contracts at 50c = 5000c, 1% fee = 50c
      const expectedFee = 100 * 50 * 0.01;
      expect(order.fills[0].fee).toBe(expectedFee);
    });

    it('should apply custom fee rate', async () => {
      const customFeeEngine = new PaperTradingEngine(
        createTestConfig({ feeRate: 0.02 }), // 2% fee
        mockWs as any,
        mockAggregator as any
      );

      mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

      const order = await customFeeEngine.submitOrder({
        ticker: 'TEST-MARKET',
        side: 'yes',
        action: 'buy',
        type: 'market',
        quantity: 100,
      });

      // 100 contracts at 50c = 5000c, 2% fee = 100c
      const expectedFee = 100 * 50 * 0.02;
      expect(order.fills[0].fee).toBe(expectedFee);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let engine: PaperTradingEngine;
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
    engine = new PaperTradingEngine(
      createTestConfig(),
      mockWs as any,
      mockAggregator as any
    );
  });

  it('should handle NO side positions correctly', async () => {
    mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

    await engine.submitOrder({
      ticker: 'TEST-MARKET',
      side: 'no',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    const position = engine.getPositions()[0];
    expect(position.side).toBe('no');
  });

  it('should track YES and NO positions separately', async () => {
    mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

    await engine.submitOrder({
      ticker: 'TEST-MARKET',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    await engine.submitOrder({
      ticker: 'TEST-MARKET',
      side: 'no',
      action: 'buy',
      type: 'market',
      quantity: 5,
    });

    const positions = engine.getPositions();
    expect(positions).toHaveLength(2);
  });

  it('should handle multiple markets simultaneously', async () => {
    mockAggregator.setMarketData('MARKET-A', createMockMarketData('MARKET-A', 50, 50));
    mockAggregator.setMarketData('MARKET-B', createMockMarketData('MARKET-B', 70, 30));

    await engine.submitOrder({
      ticker: 'MARKET-A',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    await engine.submitOrder({
      ticker: 'MARKET-B',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    const positions = engine.getPositions();
    expect(positions).toHaveLength(2);
    expect(positions.find(p => p.ticker === 'MARKET-A')).toBeDefined();
    expect(positions.find(p => p.ticker === 'MARKET-B')).toBeDefined();
  });

  it('should handle rapid successive orders', async () => {
    mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 50, 50));

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        engine.submitOrder({
          ticker: 'TEST-MARKET',
          side: 'yes',
          action: 'buy',
          type: 'market',
          quantity: 5,
        })
      );
    }

    await Promise.all(promises);

    const position = engine.getPositions()[0];
    expect(position.quantity).toBe(50);
  });

  it('should handle zero-spread market', async () => {
    mockAggregator.setMarketData('TEST-MARKET', {
      ticker: 'TEST-MARKET',
      lastUpdate: Date.now(),
      orderbook: {
        yes: [{ price: 50, quantity: 100 }],
        no: [{ price: 50, quantity: 100 }],
        spread: 0,
        midPrice: 50,
      },
      trades: [],
      volume1m: 50,
      vwap1m: 50,
      priceChange1m: 0,
    });

    const order = await engine.submitOrder({
      ticker: 'TEST-MARKET',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    expect(order.status).toBe('filled');
  });

  it('should handle extreme prices (near 1 or 99)', async () => {
    mockAggregator.setMarketData('TEST-MARKET', createMockMarketData('TEST-MARKET', 99, 1));

    const order = await engine.submitOrder({
      ticker: 'TEST-MARKET',
      side: 'yes',
      action: 'buy',
      type: 'market',
      quantity: 10,
    });

    expect(order.status).toBe('filled');
    expect(order.avgFillPrice).toBeGreaterThanOrEqual(99);
  });
});
