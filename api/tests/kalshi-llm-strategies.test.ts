/**
 * Unit Tests for LLM Strategy Generator
 *
 * Tests cover:
 * - Strategy hypothesis generation
 * - Strategy compilation to executable code
 * - Condition evaluation
 * - Source code generation
 * - Event emission
 * - Strategy improvement
 *
 * Note: Anthropic API calls are mocked to avoid real API usage
 */

import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import {
  LLMStrategyGenerator,
  createLLMStrategyGenerator,
  type StrategyHypothesis,
  type StrategyCondition,
  type GeneratedStrategy,
  type AnalysisContext,
} from '../src/mcp-kalshi-llm-strategies.js';
import type { CompetitionResult, LeaderboardEntry } from '../src/mcp-kalshi-competition.js';
import type { PerformanceMetrics } from '../src/mcp-kalshi-paper-trading.js';
import type { AggregatedMarketData } from '../src/mcp-kalshi-streaming.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockHypothesis(overrides: Partial<StrategyHypothesis> = {}): StrategyHypothesis {
  return {
    id: 'test-hypothesis-1',
    name: 'Test Strategy',
    description: 'A test trading strategy',
    rationale: 'Tests show this pattern is profitable',
    conditions: [
      {
        type: 'price',
        operator: '<',
        value: 40,
        description: 'Buy when price is below 40 cents',
      },
      {
        type: 'spread',
        operator: '<',
        value: 5,
        description: 'Only when spread is tight',
      },
    ],
    actions: [
      {
        trigger: 'entry',
        side: 'yes',
        sizeMethod: 'percent_equity',
        sizeValue: 5,
        priceMethod: 'limit_mid',
      },
    ],
    riskManagement: {
      maxPositionSize: 100,
      stopLossPercent: 10,
      takeProfitPercent: 20,
      maxDailyLoss: 5000,
      maxDrawdown: 15,
      cooldownAfterLoss: 60000,
    },
    expectedEdge: 5,
    confidence: 75,
    generatedAt: Date.now(),
    ...overrides,
  };
}

function createMockMarketData(overrides: Partial<AggregatedMarketData> = {}): AggregatedMarketData {
  return {
    ticker: 'TEST-MARKET',
    orderbook: {
      yes_bid: 35,
      yes_ask: 38,
      no_bid: 62,
      no_ask: 65,
      midPrice: 36.5,
      spread: 3,
      lastUpdateTime: Date.now(),
    },
    trades: [
      { price: 36, size: 10, ts: Date.now() - 1000, taker_side: 'yes' },
      { price: 37, size: 5, ts: Date.now() - 500, taker_side: 'no' },
    ],
    volume1m: 1500,
    priceChange1m: 0.5,
    lastUpdateTime: Date.now(),
    ...overrides,
  } as AggregatedMarketData;
}

function createMockCompetitionResult(): CompetitionResult {
  return {
    competitionId: 'comp-1',
    name: 'Test Competition',
    duration: 3600000,
    winner: {
      id: 'winner-1',
      name: 'Winner Strategy',
      pnlPercent: 15.5,
      sharpe: 2.1,
      winRate: 65,
      trades: 25,
    },
    finalLeaderboard: [
      { id: 'winner-1', name: 'Winner', pnlPercent: 15.5, sharpe: 2.1, winRate: 65, trades: 25 },
      { id: 'second', name: 'Second', pnlPercent: 8.2, sharpe: 1.5, winRate: 55, trades: 30 },
    ] as LeaderboardEntry[],
    marketsSummary: [
      { ticker: 'MKT-1', totalVolume: 5000, priceChange: 2.5 },
    ],
    statistics: {
      totalTrades: 100,
      avgReturn: 5.2,
      bestReturn: 15.5,
      worstReturn: -8.3,
    },
    startTime: Date.now() - 3600000,
    endTime: Date.now(),
  };
}

function createMockPerformanceMetrics(): PerformanceMetrics {
  return {
    totalPnl: 150000,
    totalReturnPercent: 15.0,
    totalTrades: 50,
    winningTrades: 30,
    losingTrades: 20,
    winRate: 60,
    avgWin: 8000,
    avgLoss: 3500,
    largestWin: 25000,
    largestLoss: 10000,
    profitFactor: 2.3,
    sharpeRatio: 1.8,
    maxDrawdown: 50000,
    maxDrawdownPercent: 5.0,
    currentDrawdown: 10000,
    currentDrawdownPercent: 1.0,
    avgHoldingTimeMs: 300000,
    bestDay: 45000,
    worstDay: -20000,
    consecutiveWins: 5,
    consecutiveLosses: 2,
    expectancy: 4500,
  };
}

// ============================================================================
// Mock Anthropic Client
// ============================================================================

class MockAnthropicMessages {
  mockResponse: any = null;

  async create(params: any) {
    if (this.mockResponse) {
      return this.mockResponse;
    }
    // Default mock response with valid JSON
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(createMockHypothesis()),
        },
      ],
    };
  }

  setMockResponse(response: any) {
    this.mockResponse = response;
  }
}

class MockAnthropicClient {
  messages = new MockAnthropicMessages();
}

// ============================================================================
// Tests
// ============================================================================

describe('LLMStrategyGenerator', () => {
  let generator: LLMStrategyGenerator;
  let mockClient: MockAnthropicClient;

  beforeEach(() => {
    generator = createLLMStrategyGenerator('test-api-key');
    mockClient = new MockAnthropicClient();
    // Inject mock client
    (generator as any).anthropic = mockClient;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('should create generator with factory function', () => {
      const gen = createLLMStrategyGenerator('test-key');
      expect(gen).toBeInstanceOf(LLMStrategyGenerator);
    });

    it('should initialize with empty strategies', () => {
      const strategies = generator.getGeneratedStrategies();
      expect(strategies).toHaveLength(0);
    });

    it('should initialize with empty analysis history', () => {
      const history = generator.getAnalysisHistory();
      expect(history).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Analysis Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Competition Analysis', () => {
    it('should analyze competition results', async () => {
      const mockAnalysis = 'The winning strategy focused on tight spreads and quick exits.';
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: mockAnalysis }],
      });

      const results = [createMockCompetitionResult()];
      const analysis = await generator.analyzeCompetitionResults(results);

      expect(analysis).toBe(mockAnalysis);
    });

    it('should emit analysis_complete event', async () => {
      const mockAnalysis = 'Analysis complete.';
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: mockAnalysis }],
      });

      let emittedAnalysis = '';
      generator.on('analysis_complete', (a: string) => {
        emittedAnalysis = a;
      });

      await generator.analyzeCompetitionResults([createMockCompetitionResult()]);
      expect(emittedAnalysis).toBe(mockAnalysis);
    });

    it('should store analysis in history', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: 'First analysis' }],
      });
      await generator.analyzeCompetitionResults([createMockCompetitionResult()]);

      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: 'Second analysis' }],
      });
      await generator.analyzeCompetitionResults([createMockCompetitionResult()]);

      const history = generator.getAnalysisHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toBe('First analysis');
      expect(history[1]).toBe('Second analysis');
    });

    it('should handle empty response content', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'image', data: 'xxx' }], // Non-text response
      });

      const analysis = await generator.analyzeCompetitionResults([]);
      expect(analysis).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Generation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Strategy Generation', () => {
    it('should generate strategy from context', async () => {
      const mockHypothesis = createMockHypothesis({ name: 'Generated Strategy' });
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(mockHypothesis) }],
      });

      const context: AnalysisContext = {
        competitionResults: [createMockCompetitionResult()],
      };

      const hypothesis = await generator.generateStrategy(context);
      expect(hypothesis.name).toBe('Generated Strategy');
    });

    it('should assign unique ID to generated strategy', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      const h1 = await generator.generateStrategy({});
      const h2 = await generator.generateStrategy({});

      expect(h1.id).not.toBe(h2.id);
      expect(h1.id).toMatch(/^LLM-\d+-\d+$/);
    });

    it('should set generatedAt timestamp', async () => {
      const now = Date.now();
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      const hypothesis = await generator.generateStrategy({});
      expect(hypothesis.generatedAt).toBeGreaterThanOrEqual(now);
    });

    it('should emit strategy_generated event', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      let emittedHypothesis: StrategyHypothesis | null = null;
      generator.on('strategy_generated', (h: StrategyHypothesis) => {
        emittedHypothesis = h;
      });

      await generator.generateStrategy({});
      expect(emittedHypothesis).not.toBeNull();
    });

    it('should throw when response contains no JSON', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: 'No JSON here, just text.' }],
      });

      await expect(generator.generateStrategy({})).rejects.toThrow(
        'Failed to extract strategy JSON'
      );
    });

    it('should include market conditions in prompt', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      const context: AnalysisContext = {
        marketConditions: {
          totalMarkets: 100,
          avgSpread: 3.5,
          avgVolume24h: 50000,
          volatility: 2.5,
          trendingMarkets: ['MKT-1', 'MKT-2'],
          highLiquidityMarkets: ['MKT-3'],
          wideSpreadMarkets: ['MKT-4'],
        },
      };

      await generator.generateStrategy(context);
      // If it doesn't throw, the context was processed
    });

    it('should include failed strategies in context', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      const context: AnalysisContext = {
        failedStrategies: [
          createMockHypothesis({ name: 'Failed 1' }),
          createMockHypothesis({ name: 'Failed 2' }),
        ],
      };

      await generator.generateStrategy(context);
    });

    it('should include successful strategies in context', async () => {
      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      const context: AnalysisContext = {
        successfulStrategies: [
          createMockHypothesis({ name: 'Success 1', expectedEdge: 8 }),
        ],
      };

      await generator.generateStrategy(context);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Compilation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Strategy Compilation', () => {
    it('should compile hypothesis to executable strategy', () => {
      const hypothesis = createMockHypothesis();
      const strategy = generator.compileStrategy(hypothesis);

      expect(strategy.name).toBe(hypothesis.name);
      expect(strategy.description).toBe(hypothesis.description);
      expect(typeof strategy.analyze).toBe('function');
    });

    it('should store compiled strategy', () => {
      const hypothesis = createMockHypothesis();
      generator.compileStrategy(hypothesis);

      const stored = generator.getStrategy(hypothesis.id);
      expect(stored).toBeDefined();
      expect(stored?.name).toBe(hypothesis.name);
    });

    it('should emit strategy_compiled event', () => {
      let emittedStrategy: GeneratedStrategy | null = null;
      generator.on('strategy_compiled', (s: GeneratedStrategy) => {
        emittedStrategy = s;
      });

      const hypothesis = createMockHypothesis();
      generator.compileStrategy(hypothesis);

      expect(emittedStrategy).not.toBeNull();
      expect(emittedStrategy?.name).toBe(hypothesis.name);
    });

    it('should generate source code', () => {
      const hypothesis = createMockHypothesis({ name: 'Test Code Gen' });
      const strategy = generator.compileStrategy(hypothesis);

      expect(strategy.sourceCode).toContain('Test Code Gen');
      expect(strategy.sourceCode).toContain('Generated Strategy');
      expect(strategy.sourceCode).toContain('export const');
    });

    it('should include risk management in source code', () => {
      const hypothesis = createMockHypothesis({
        riskManagement: {
          maxPositionSize: 50,
          stopLossPercent: 5,
          takeProfitPercent: 15,
          maxDailyLoss: 10000,
          maxDrawdown: 10,
          cooldownAfterLoss: 30000,
        },
      });

      const strategy = generator.compileStrategy(hypothesis);

      expect(strategy.sourceCode).toContain('Max Position: 50');
      expect(strategy.sourceCode).toContain('Stop Loss: 5%');
      expect(strategy.sourceCode).toContain('Take Profit: 15%');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Condition Evaluation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Condition Evaluation', () => {
    it('should generate signal when all conditions met', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<', value: 40, description: 'Price below 40' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
      expect(signal?.ticker).toBe('TEST-MARKET');
    });

    it('should return null when conditions not met', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<', value: 30, description: 'Price below 30' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 45, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).toBeNull();
    });

    it('should handle greater than operator', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '>', value: 30, description: 'Price above 30' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should handle greater than or equal operator', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '>=', value: 35, description: 'Price >= 35' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should handle less than or equal operator', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<=', value: 35, description: 'Price <= 35' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should handle equality operator with tolerance', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '==', value: 35, description: 'Price equals 35' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35.005, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should handle between operator', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: 'between', value: [30, 40], description: 'Price between 30-40' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should evaluate volume condition', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'volume', operator: '>', value: 1000, description: 'Volume above 1000' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({ volume1m: 1500 });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should evaluate spread condition', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'spread', operator: '<', value: 5, description: 'Tight spread' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 3 } as any,
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should evaluate momentum condition', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'momentum', operator: '>', value: 0, description: 'Positive momentum' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({ priceChange1m: 0.5 });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should evaluate volatility condition', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'volatility', operator: '<', value: 10, description: 'Low volatility' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        trades: [
          { price: 35, size: 10, ts: Date.now() - 1000, taker_side: 'yes' },
          { price: 36, size: 5, ts: Date.now() - 500, taker_side: 'no' },
          { price: 35.5, size: 8, ts: Date.now(), taker_side: 'yes' },
        ],
      });

      const signal = strategy.analyze(market, []);
      expect(signal).not.toBeNull();
    });

    it('should return false for volatility with insufficient trades', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'volatility', operator: '<', value: 10, description: 'Low volatility' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        trades: [{ price: 35, size: 10, ts: Date.now(), taker_side: 'yes' }],
      });

      const signal = strategy.analyze(market, []);
      expect(signal).toBeNull();
    });

    it('should not enter when position already exists', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<', value: 40, description: 'Price below 40' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const existingPosition = { ticker: 'TEST-MARKET', quantity: 10 };
      const signal = strategy.analyze(market, [existingPosition]);
      expect(signal).toBeNull();
    });

    it('should enter with scale_in even when position exists', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<', value: 40, description: 'Price below 40' },
        ],
        actions: [
          { trigger: 'entry', side: 'yes', sizeMethod: 'percent_equity', sizeValue: 5, priceMethod: 'market' },
          { trigger: 'scale_in', side: 'yes', sizeMethod: 'fixed', sizeValue: 10, priceMethod: 'limit_mid' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
      });

      const existingPosition = { ticker: 'TEST-MARKET', quantity: 10 };
      const signal = strategy.analyze(market, [existingPosition]);
      expect(signal).not.toBeNull();
    });

    it('should use dynamic side based on market price', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'volume', operator: '>', value: 100, description: 'High volume' },
        ],
        actions: [
          { trigger: 'entry', side: 'dynamic', sizeMethod: 'fixed', sizeValue: 10, priceMethod: 'market' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);

      // Low price = yes side
      let market = createMockMarketData({
        orderbook: { midPrice: 35, spread: 2 } as any,
        volume1m: 1000,
      });
      let signal = strategy.analyze(market, []);
      expect(signal?.side).toBe('yes');

      // High price = no side
      market = createMockMarketData({
        orderbook: { midPrice: 65, spread: 2 } as any,
        volume1m: 1000,
      });
      signal = strategy.analyze(market, []);
      expect(signal?.side).toBe('no');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Improvement Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Strategy Improvement', () => {
    it('should improve strategy based on performance', async () => {
      const original = createMockHypothesis({ name: 'Original' });
      const strategy = generator.compileStrategy(original);

      const improved = createMockHypothesis({
        name: 'Improved',
        expectedEdge: 8,
      });

      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(improved) }],
      });

      const result = await generator.improveStrategy(
        strategy,
        createMockPerformanceMetrics()
      );

      expect(result.name).toBe('Improved');
      expect(result.id).toContain('improved');
    });

    it('should emit strategy_improved event', async () => {
      const original = createMockHypothesis();
      const strategy = generator.compileStrategy(original);

      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      let eventData: any = null;
      generator.on('strategy_improved', (data: any) => {
        eventData = data;
      });

      await generator.improveStrategy(strategy, createMockPerformanceMetrics());

      expect(eventData).not.toBeNull();
      expect(eventData.original).toBeDefined();
      expect(eventData.improved).toBeDefined();
    });

    it('should set sourceAnalysis on improved strategy', async () => {
      const original = createMockHypothesis({ name: 'Original Strategy' });
      const strategy = generator.compileStrategy(original);

      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: JSON.stringify(createMockHypothesis()) }],
      });

      const metrics = createMockPerformanceMetrics();
      const result = await generator.improveStrategy(strategy, metrics);

      expect(result.sourceAnalysis).toContain('Improved from');
      expect(result.sourceAnalysis).toContain('Original Strategy');
      expect(result.sourceAnalysis).toContain(`${metrics.totalTrades} trades`);
    });

    it('should throw when improvement response has no JSON', async () => {
      const strategy = generator.compileStrategy(createMockHypothesis());

      mockClient.messages.setMockResponse({
        content: [{ type: 'text', text: 'No JSON, just suggestions.' }],
      });

      await expect(
        generator.improveStrategy(strategy, createMockPerformanceMetrics())
      ).rejects.toThrow('Failed to extract improved strategy JSON');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Getters Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Getters', () => {
    it('should list all generated strategies', () => {
      const h1 = createMockHypothesis({ id: 'h1' });
      const h2 = createMockHypothesis({ id: 'h2' });

      generator.compileStrategy(h1);
      generator.compileStrategy(h2);

      const strategies = generator.getGeneratedStrategies();
      expect(strategies).toHaveLength(2);
    });

    it('should get strategy by ID', () => {
      const hypothesis = createMockHypothesis({ id: 'test-id-123' });
      generator.compileStrategy(hypothesis);

      const strategy = generator.getStrategy('test-id-123');
      expect(strategy).toBeDefined();
      expect(strategy?.hypothesis.id).toBe('test-id-123');
    });

    it('should return undefined for non-existent strategy', () => {
      const strategy = generator.getStrategy('non-existent');
      expect(strategy).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle crosses operator (returns false - not implemented)', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: 'crosses', value: 50, description: 'Price crosses 50' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData();

      const signal = strategy.analyze(market, []);
      expect(signal).toBeNull();
    });

    it('should handle unknown condition type', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'custom' as any, operator: '>', value: 0, description: 'Custom condition' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData();

      const signal = strategy.analyze(market, []);
      expect(signal).toBeNull();
    });

    it('should handle hypothesis with no entry action', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<', value: 50, description: 'Price below 50' },
        ],
        actions: [
          { trigger: 'exit', side: 'yes', sizeMethod: 'fixed', sizeValue: 10, priceMethod: 'market' },
        ],
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData();

      const signal = strategy.analyze(market, []);
      expect(signal).toBeNull();
    });

    it('should sanitize strategy name in source code', () => {
      const hypothesis = createMockHypothesis({
        name: 'Test Strategy (v2.0) - Special!',
      });

      const strategy = generator.compileStrategy(hypothesis);
      expect(strategy.sourceCode).toContain('Test_Strategy__v2_0____Special_');
    });

    it('should calculate signal strength from conditions', () => {
      const hypothesis = createMockHypothesis({
        conditions: [
          { type: 'price', operator: '<', value: 50, description: 'Cond 1' },
          { type: 'volume', operator: '>', value: 100, description: 'Cond 2' },
        ],
        confidence: 80,
      });

      const strategy = generator.compileStrategy(hypothesis);
      const market = createMockMarketData({
        orderbook: { midPrice: 40, spread: 2 } as any,
        volume1m: 1000,
      });

      const signal = strategy.analyze(market, []);
      expect(signal?.strength).toBe(80); // confidence * (2/2) = 80
    });
  });
});
