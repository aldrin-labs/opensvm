/**
 * Unit Tests for Kalshi Trading Strategies
 *
 * Tests cover:
 * - Mean Reversion Strategy
 * - Momentum Strategy
 * - Spread Strategy
 * - Arbitrage Strategy
 * - Signal generation logic
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  MeanReversionStrategy,
  MomentumStrategy,
  SpreadStrategy,
  ArbitrageStrategy,
  type Strategy,
  type Signal,
} from '../src/mcp-kalshi-agent.js';
import type { AggregatedMarketData } from '../src/mcp-kalshi-streaming.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMarketData(overrides: Partial<AggregatedMarketData> = {}): AggregatedMarketData {
  return {
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
    ...overrides,
  };
}

function createTrades(prices: number[]): { price: number; count: number; side: 'yes' | 'no'; takerSide: 'buy' | 'sell'; timestamp: number }[] {
  return prices.map((price, i) => ({
    type: 'trade' as const,
    ticker: 'TEST-MARKET',
    timestamp: Date.now() - (prices.length - i) * 1000,
    price,
    count: 10,
    side: 'yes' as const,
    takerSide: 'buy' as const,
  }));
}

function createPosition(ticker: string, side: 'yes' | 'no', quantity: number, avgPrice: number) {
  return {
    ticker,
    side,
    quantity,
    avgPrice,
    currentPrice: avgPrice,
    unrealizedPnl: 0,
    entryTime: Date.now(),
  };
}

// ============================================================================
// Mean Reversion Strategy Tests
// ============================================================================

describe('MeanReversionStrategy', () => {
  it('should have correct name and description', () => {
    expect(MeanReversionStrategy.name).toBe('mean_reversion');
    expect(MeanReversionStrategy.description).toBeDefined();
  });

  it('should return null with insufficient trade history', () => {
    const market = createMarketData({
      trades: createTrades([50, 51, 52]), // Only 3 trades
    });

    const signal = MeanReversionStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should return null when price is near mean', () => {
    // All prices around 50, stddev will be low
    const prices = Array(20).fill(50).map((p, i) => p + (i % 2 === 0 ? 0.5 : -0.5));
    const market = createMarketData({
      trades: createTrades(prices),
      orderbook: {
        yes: [{ price: 50, quantity: 100 }],
        no: [{ price: 50, quantity: 100 }],
        spread: 0,
        midPrice: 50,
      },
    });

    const signal = MeanReversionStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should generate BUY NO signal when price is significantly above mean', () => {
    // Create trades with mean around 50, then current price at 70
    const prices = Array(15).fill(50).concat([65, 68, 70, 72, 75]);
    const market = createMarketData({
      trades: createTrades(prices),
      orderbook: {
        yes: [{ price: 75, quantity: 100 }],
        no: [{ price: 25, quantity: 100 }],
        spread: 0,
        midPrice: 75,
      },
    });

    const signal = MeanReversionStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('buy');
    expect(signal!.side).toBe('no'); // Buy NO when price too high (expecting reversion down)
  });

  it('should generate BUY YES signal when price is significantly below mean', () => {
    // Create trades with mean around 50, then current price at 30
    const prices = Array(15).fill(50).concat([40, 35, 32, 30, 28]);
    const market = createMarketData({
      trades: createTrades(prices),
      orderbook: {
        yes: [{ price: 28, quantity: 100 }],
        no: [{ price: 72, quantity: 100 }],
        spread: 0,
        midPrice: 28,
      },
    });

    const signal = MeanReversionStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('buy');
    expect(signal!.side).toBe('yes'); // Buy YES when price too low (expecting reversion up)
  });

  it('should not signal when already holding a position', () => {
    const prices = Array(15).fill(50).concat([65, 68, 70, 72, 75]);
    const market = createMarketData({
      trades: createTrades(prices),
      orderbook: {
        yes: [{ price: 75, quantity: 100 }],
        no: [{ price: 25, quantity: 100 }],
        spread: 0,
        midPrice: 75,
      },
    });

    const existingPosition = createPosition('TEST-MARKET', 'no', 10, 70);
    const signal = MeanReversionStrategy.analyze(market, [existingPosition]);

    expect(signal).toBeNull();
  });

  it('should have positive expected value in signal', () => {
    const prices = Array(15).fill(50).concat([65, 68, 70, 72, 75]);
    const market = createMarketData({
      trades: createTrades(prices),
      orderbook: {
        yes: [{ price: 75, quantity: 100 }],
        no: [{ price: 25, quantity: 100 }],
        spread: 0,
        midPrice: 75,
      },
    });

    const signal = MeanReversionStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.expectedValue).toBeGreaterThan(0);
    expect(signal!.riskReward).toBeGreaterThan(0);
  });

  it('should have reasonable strength and confidence', () => {
    const prices = Array(15).fill(50).concat([65, 68, 70, 72, 75]);
    const market = createMarketData({
      trades: createTrades(prices),
      orderbook: {
        yes: [{ price: 75, quantity: 100 }],
        no: [{ price: 25, quantity: 100 }],
        spread: 0,
        midPrice: 75,
      },
    });

    const signal = MeanReversionStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.strength).toBeGreaterThanOrEqual(0);
    expect(signal!.strength).toBeLessThanOrEqual(100);
    expect(signal!.confidence).toBeGreaterThanOrEqual(0);
    expect(signal!.confidence).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Momentum Strategy Tests
// ============================================================================

describe('MomentumStrategy', () => {
  it('should have correct name and description', () => {
    expect(MomentumStrategy.name).toBe('momentum');
    expect(MomentumStrategy.description).toBeDefined();
  });

  it('should return null with insufficient trade history', () => {
    const market = createMarketData({
      trades: createTrades([50, 51]), // Only 2 trades
    });

    const signal = MomentumStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should return null when price change is minimal', () => {
    const market = createMarketData({
      trades: createTrades([50, 50, 51, 50, 51]),
      priceChange1m: 1, // Only 1 cent change
      volume1m: 5, // Low volume too
    });

    const signal = MomentumStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should generate BUY YES signal on strong upward momentum', () => {
    const market = createMarketData({
      trades: createTrades([50, 52, 54, 56, 58]),
      priceChange1m: 8, // Strong positive momentum
      volume1m: 50, // Good volume
      orderbook: {
        yes: [{ price: 58, quantity: 100 }],
        no: [{ price: 42, quantity: 100 }],
        spread: 0,
        midPrice: 58,
      },
    });

    const signal = MomentumStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('buy');
    expect(signal!.side).toBe('yes'); // Buy YES on positive momentum
  });

  it('should generate BUY NO signal on strong downward momentum', () => {
    const market = createMarketData({
      trades: createTrades([50, 48, 46, 44, 42]),
      priceChange1m: -8, // Strong negative momentum
      volume1m: 50, // Good volume
      orderbook: {
        yes: [{ price: 42, quantity: 100 }],
        no: [{ price: 58, quantity: 100 }],
        spread: 0,
        midPrice: 42,
      },
    });

    const signal = MomentumStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('buy');
    expect(signal!.side).toBe('no'); // Buy NO on negative momentum
  });

  it('should not signal when already holding a position', () => {
    const market = createMarketData({
      trades: createTrades([50, 52, 54, 56, 58]),
      priceChange1m: 8,
      volume1m: 50,
    });

    const existingPosition = createPosition('TEST-MARKET', 'yes', 10, 54);
    const signal = MomentumStrategy.analyze(market, [existingPosition]);

    expect(signal).toBeNull();
  });

  it('should require minimum volume', () => {
    const market = createMarketData({
      trades: createTrades([50, 52, 54, 56, 58]),
      priceChange1m: 8,
      volume1m: 5, // Very low volume
    });

    const signal = MomentumStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should scale strength with price change magnitude', () => {
    const weakMomentum = createMarketData({
      trades: createTrades([50, 51, 52, 53, 54]),
      priceChange1m: 4,
      volume1m: 50,
    });

    const strongMomentum = createMarketData({
      trades: createTrades([50, 53, 56, 59, 62]),
      priceChange1m: 12,
      volume1m: 50,
    });

    const weakSignal = MomentumStrategy.analyze(weakMomentum, []);
    const strongSignal = MomentumStrategy.analyze(strongMomentum, []);

    // Strong momentum should have higher strength
    if (weakSignal && strongSignal) {
      expect(strongSignal.strength).toBeGreaterThan(weakSignal.strength);
    }
  });
});

// ============================================================================
// Spread Strategy Tests
// ============================================================================

describe('SpreadStrategy', () => {
  it('should have correct name and description', () => {
    expect(SpreadStrategy.name).toBe('spread');
    expect(SpreadStrategy.description).toBeDefined();
  });

  it('should return null when spread is too narrow', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 49, quantity: 100 }],
        no: [{ price: 49, quantity: 100 }],
        spread: 2, // Only 2 cent spread
        midPrice: 50,
      },
    });

    const signal = SpreadStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should generate signal when spread is wide', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10, // Wide spread
        midPrice: 50,
      },
    });

    const signal = SpreadStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('buy');
  });

  it('should buy cheaper side when mid price is below 50', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 35, quantity: 100 }],
        no: [{ price: 55, quantity: 100 }],
        spread: 10,
        midPrice: 40, // Below 50, YES is cheaper
      },
    });

    const signal = SpreadStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.side).toBe('yes'); // Buy the cheaper YES side
  });

  it('should buy cheaper side when mid price is above 50', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 55, quantity: 100 }],
        no: [{ price: 35, quantity: 100 }],
        spread: 10,
        midPrice: 60, // Above 50, NO is cheaper
      },
    });

    const signal = SpreadStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.side).toBe('no'); // Buy the cheaper NO side
  });

  it('should not signal when already holding a position', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10,
        midPrice: 50,
      },
    });

    const existingPosition = createPosition('TEST-MARKET', 'yes', 10, 45);
    const signal = SpreadStrategy.analyze(market, [existingPosition]);

    expect(signal).toBeNull();
  });

  it('should scale strength with spread width', () => {
    const narrowSpread = createMarketData({
      orderbook: {
        yes: [{ price: 47, quantity: 100 }],
        no: [{ price: 47, quantity: 100 }],
        spread: 6,
        midPrice: 50,
      },
    });

    const wideSpread = createMarketData({
      orderbook: {
        yes: [{ price: 40, quantity: 100 }],
        no: [{ price: 40, quantity: 100 }],
        spread: 20,
        midPrice: 50,
      },
    });

    const narrowSignal = SpreadStrategy.analyze(narrowSpread, []);
    const wideSignal = SpreadStrategy.analyze(wideSpread, []);

    if (narrowSignal && wideSignal) {
      expect(wideSignal.strength).toBeGreaterThan(narrowSignal.strength);
    }
  });

  it('should have expected value based on spread capture', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10,
        midPrice: 50,
      },
    });

    const signal = SpreadStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.expectedValue).toBeGreaterThan(0);
    // Expected value should be roughly half the spread
    expect(signal!.expectedValue).toBeLessThanOrEqual(0.05); // 5 cents / $1
  });
});

// ============================================================================
// Arbitrage Strategy Tests
// ============================================================================

describe('ArbitrageStrategy', () => {
  it('should have correct name and description', () => {
    expect(ArbitrageStrategy.name).toBe('arbitrage');
    expect(ArbitrageStrategy.description).toBeDefined();
  });

  it('should return null when YES + NO = 100', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 50, quantity: 100 }],
        no: [{ price: 50, quantity: 100 }],
        spread: 0,
        midPrice: 50,
      },
    });

    const signal = ArbitrageStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should return null when mispricing is minimal', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 49, quantity: 100 }],
        no: [{ price: 50, quantity: 100 }],
        spread: 1, // Only 1 cent mispricing
        midPrice: 50,
      },
    });

    const signal = ArbitrageStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should generate signal when YES + NO significantly less than 100', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }], // YES bid at 45
        no: [{ price: 45, quantity: 100 }],  // NO bid at 45
        spread: 10, // Sum = 90, mispricing = 10
        midPrice: 50,
      },
    });

    const signal = ArbitrageStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('buy');
  });

  it('should buy the side with better odds', () => {
    // YES bid is lower (45) vs NO bid (50) - YES is cheaper
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 50, quantity: 100 }],
        spread: 5,
        midPrice: 50,
      },
    });

    const signal = ArbitrageStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.side).toBe('yes'); // Buy cheaper YES
  });

  it('should have high confidence for arbitrage', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10,
        midPrice: 50,
      },
    });

    const signal = ArbitrageStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.confidence).toBeGreaterThanOrEqual(70); // Arbitrage should be high confidence
  });

  it('should calculate expected value from mispricing', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10, // 10 cent mispricing
        midPrice: 50,
      },
    });

    const signal = ArbitrageStrategy.analyze(market, []);

    expect(signal).not.toBeNull();
    expect(signal!.expectedValue).toBe(0.1); // 10 cents as decimal
  });

  it('should not signal when already holding a position', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10,
        midPrice: 50,
      },
    });

    const existingPosition = createPosition('TEST-MARKET', 'yes', 10, 45);
    const signal = ArbitrageStrategy.analyze(market, [existingPosition]);

    expect(signal).toBeNull();
  });
});

// ============================================================================
// Signal Validation Tests
// ============================================================================

describe('Signal Validation', () => {
  const strategies: Strategy[] = [
    MeanReversionStrategy,
    MomentumStrategy,
    SpreadStrategy,
    ArbitrageStrategy,
  ];

  strategies.forEach(strategy => {
    describe(`${strategy.name} signal format`, () => {
      it('should return Signal or null', () => {
        const market = createMarketData();
        const result = strategy.analyze(market, []);

        expect(result === null || typeof result === 'object').toBe(true);
      });

      it('should have all required fields when signal returned', () => {
        // Create market conditions that might generate a signal
        const market = createMarketData({
          trades: createTrades(Array(20).fill(50).concat([70, 72, 74, 76, 78])),
          priceChange1m: 10,
          volume1m: 100,
          orderbook: {
            yes: [{ price: 40, quantity: 100 }],
            no: [{ price: 40, quantity: 100 }],
            spread: 20,
            midPrice: 50,
          },
        });

        const signal = strategy.analyze(market, []);

        if (signal !== null) {
          expect(signal.type).toBeDefined();
          expect(['buy', 'sell', 'hold']).toContain(signal.type);

          expect(signal.ticker).toBeDefined();
          expect(typeof signal.ticker).toBe('string');

          expect(signal.side).toBeDefined();
          expect(['yes', 'no']).toContain(signal.side);

          expect(signal.strength).toBeDefined();
          expect(typeof signal.strength).toBe('number');
          expect(signal.strength).toBeGreaterThanOrEqual(0);
          expect(signal.strength).toBeLessThanOrEqual(100);

          expect(signal.confidence).toBeDefined();
          expect(typeof signal.confidence).toBe('number');
          expect(signal.confidence).toBeGreaterThanOrEqual(0);
          expect(signal.confidence).toBeLessThanOrEqual(100);

          expect(signal.reason).toBeDefined();
          expect(typeof signal.reason).toBe('string');
          expect(signal.reason.length).toBeGreaterThan(0);

          expect(signal.expectedValue).toBeDefined();
          expect(typeof signal.expectedValue).toBe('number');

          expect(signal.riskReward).toBeDefined();
          expect(typeof signal.riskReward).toBe('number');
        }
      });
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Strategy Edge Cases', () => {
  it('should handle empty orderbook gracefully', () => {
    const market = createMarketData({
      orderbook: {
        yes: [],
        no: [],
        spread: 0,
        midPrice: 0,
      },
    });

    // None of these should throw
    expect(() => MeanReversionStrategy.analyze(market, [])).not.toThrow();
    expect(() => MomentumStrategy.analyze(market, [])).not.toThrow();
    expect(() => SpreadStrategy.analyze(market, [])).not.toThrow();
    expect(() => ArbitrageStrategy.analyze(market, [])).not.toThrow();
  });

  it('should handle extreme prices (near 0)', () => {
    const market = createMarketData({
      trades: createTrades([5, 4, 3, 2, 1]),
      priceChange1m: -4,
      volume1m: 50,
      orderbook: {
        yes: [{ price: 1, quantity: 100 }],
        no: [{ price: 99, quantity: 100 }],
        spread: 0,
        midPrice: 1,
      },
    });

    expect(() => MeanReversionStrategy.analyze(market, [])).not.toThrow();
    expect(() => MomentumStrategy.analyze(market, [])).not.toThrow();
  });

  it('should handle extreme prices (near 100)', () => {
    const market = createMarketData({
      trades: createTrades([95, 96, 97, 98, 99]),
      priceChange1m: 4,
      volume1m: 50,
      orderbook: {
        yes: [{ price: 99, quantity: 100 }],
        no: [{ price: 1, quantity: 100 }],
        spread: 0,
        midPrice: 99,
      },
    });

    expect(() => MeanReversionStrategy.analyze(market, [])).not.toThrow();
    expect(() => MomentumStrategy.analyze(market, [])).not.toThrow();
  });

  it('should handle zero volume', () => {
    const market = createMarketData({
      volume1m: 0,
      trades: [],
    });

    // Should not generate momentum signal with zero volume
    const signal = MomentumStrategy.analyze(market, []);
    expect(signal).toBeNull();
  });

  it('should handle negative price change (correctly)', () => {
    const market = createMarketData({
      trades: createTrades([50, 48, 46, 44, 42]),
      priceChange1m: -8,
      volume1m: 50,
    });

    const signal = MomentumStrategy.analyze(market, []);

    if (signal) {
      expect(signal.side).toBe('no'); // Negative momentum = buy NO
    }
  });

  it('should handle positions in different markets', () => {
    const market = createMarketData({
      ticker: 'MARKET-A',
      orderbook: {
        yes: [{ price: 40, quantity: 100 }],
        no: [{ price: 40, quantity: 100 }],
        spread: 20,
        midPrice: 50,
      },
    });

    // Position in different market should not block signal
    const positionInOtherMarket = createPosition('MARKET-B', 'yes', 10, 50);
    const signal = SpreadStrategy.analyze(market, [positionInOtherMarket]);

    // Should still generate signal since position is in different market
    expect(signal).not.toBeNull();
  });

  it('should handle very large trade history', () => {
    const prices = Array(1000).fill(0).map(() => 40 + Math.random() * 20);
    const market = createMarketData({
      trades: createTrades(prices),
    });

    // Should not timeout or crash
    expect(() => MeanReversionStrategy.analyze(market, [])).not.toThrow();
  });

  it('should handle NaN values gracefully', () => {
    const market = createMarketData({
      orderbook: {
        yes: [{ price: NaN, quantity: 100 }],
        no: [{ price: 50, quantity: 100 }],
        spread: NaN,
        midPrice: NaN,
      },
    });

    // Should not throw, should return null
    expect(() => ArbitrageStrategy.analyze(market, [])).not.toThrow();
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Strategy Performance', () => {
  it('should analyze quickly (< 10ms per strategy)', () => {
    const market = createMarketData({
      trades: createTrades(Array(100).fill(50)),
      orderbook: {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 45, quantity: 100 }],
        spread: 10,
        midPrice: 50,
      },
    });

    const strategies = [
      MeanReversionStrategy,
      MomentumStrategy,
      SpreadStrategy,
      ArbitrageStrategy,
    ];

    strategies.forEach(strategy => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        strategy.analyze(market, []);
      }
      const elapsed = performance.now() - start;

      // 100 iterations should take less than 100ms (1ms each)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
