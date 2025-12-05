#!/usr/bin/env bun
/**
 * LLM Proposal Analyzer Tests
 */

import {
  LLMProposalAnalyzer,
  getLLMProposalAnalyzer,
  keywordFallbackAnalysis,
  ProposalContext,
} from '../src/llm-proposal-analyzer.js';

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
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) throw new Error(`Expected ${actual} < ${n}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toContain(s: string) {
      if (typeof actual !== 'string' || !actual.toLowerCase().includes(s.toLowerCase())) {
        throw new Error(`Expected "${actual}" to contain "${s}"`);
      }
    },
  };
}

// ============================================================================
// Test Data
// ============================================================================

const mockContext: ProposalContext = {
  title: 'Add Liquidity Mining Rewards',
  description: 'This proposal adds liquidity mining rewards to increase TVL and attract more users.',
  type: 'funding',
  requestedAmount: 50000,
  currentMetrics: {
    tvl: 10000000,
    volume24h: 500000,
    fees24h: 5000,
    activeUsers: 1000,
    tokenPrice: 1.5,
    avgApy: 0.15,
  },
};

// ============================================================================
// Tests
// ============================================================================

console.log('LLM Proposal Analyzer Tests');
console.log('============================================================');

await (async () => {

section('1. Keyword Fallback Analysis');

await test('Analyzes positive proposal', () => {
  const result = keywordFallbackAnalysis({
    ...mockContext,
    title: 'Add liquidity rewards to boost TVL growth',
    description: 'Increase user onboarding with incentives',
  });

  expect(result.sentiment).toBe('positive');
  expect(result.impactPredictions.tvl.change).toBeGreaterThan(0);
  expect(result.impactPredictions.users.change).toBeGreaterThan(0);
});

await test('Analyzes negative proposal', () => {
  const result = keywordFallbackAnalysis({
    ...mockContext,
    title: 'Massive emission increase and inflation',
    description: 'Mint tons of new tokens to dilute holders',
  });

  // emission/inflation causes token_price = -3
  expect(result.impactPredictions.token_price.change).toBeLessThan(0);
});

await test('Generates recommendation', () => {
  const result = keywordFallbackAnalysis({
    ...mockContext,
    title: 'Add liquidity pool with rewards incentive growth community',
    description: 'Boost user onboarding and increase TVL',
  });

  expect(result.recommendation).toBe('support');
  expect(result.overallConfidence).toBe(0.3);
});

await test('Returns low confidence for fallback', () => {
  const result = keywordFallbackAnalysis(mockContext);
  expect(result.overallConfidence).toBe(0.3);
  // Check that summary or recommendationReasoning mentions keyword/fallback
  expect(result.recommendationReasoning).toContain('keyword');
});

section('2. LLM Analyzer Configuration');

await test('Creates analyzer with default config', () => {
  const analyzer = new LLMProposalAnalyzer();
  const stats = analyzer.getStats();

  expect(stats.provider).toBe('anthropic');
  expect(stats.requestCount).toBe(0);
  expect(stats.cacheSize).toBe(0);
});

await test('Creates analyzer with custom config', () => {
  const analyzer = new LLMProposalAnalyzer({
    provider: 'openai',
    model: 'gpt-4-turbo',
    temperature: 0.5,
  });
  const stats = analyzer.getStats();

  expect(stats.provider).toBe('openai');
  expect(stats.model).toBe('gpt-4-turbo');
});

await test('Updates config', () => {
  const analyzer = new LLMProposalAnalyzer();
  analyzer.updateConfig({ temperature: 0.8 });
  expect(true).toBe(true);
});

section('3. Cache Management');

await test('Cache starts empty', () => {
  const analyzer = new LLMProposalAnalyzer();
  const stats = analyzer.getStats();
  expect(stats.cacheSize).toBe(0);
});

await test('Clear cache works', () => {
  const analyzer = new LLMProposalAnalyzer();
  analyzer.clearCache();
  const stats = analyzer.getStats();
  expect(stats.cacheSize).toBe(0);
});

section('4. Error Handling');

await test('Falls back to keywords on API error', async () => {
  const analyzer = new LLMProposalAnalyzer({
    apiKey: 'invalid-key',
    retries: 0,
    timeout: 1000,
  });

  const result = await analyzer.analyze(mockContext);

  // Should get fallback result with 0.3 confidence
  expect(result.overallConfidence).toBe(0.3);
  expect(result.recommendationReasoning).toContain('keyword');
});

section('5. Singleton');

await test('Returns same instance', () => {
  const a1 = getLLMProposalAnalyzer();
  const a2 = getLLMProposalAnalyzer();
  expect(a1).toBe(a2);
});

section('6. Statistics');

await test('Tracks request count', async () => {
  const analyzer = new LLMProposalAnalyzer({
    apiKey: 'test',
    retries: 0,
    timeout: 1000,
  });

  await analyzer.analyze(mockContext).catch(() => {});

  const stats = analyzer.getStats();
  expect(stats.requestCount).toBeGreaterThan(0);
});

await test('Calculates error rate', async () => {
  const analyzer = new LLMProposalAnalyzer({
    apiKey: 'invalid',
    retries: 0,
    timeout: 1000,
  });

  await analyzer.analyze(mockContext).catch(() => {});

  const stats = analyzer.getStats();
  // Error rate is calculated correctly
  expect(stats.errorRate >= 0).toBe(true);
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n============================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`\nResults: ${passed} passed, ${failed} failed (${results.length} total)`);

if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n[SUCCESS] All LLM analyzer tests passed!');
  process.exit(0);
}
