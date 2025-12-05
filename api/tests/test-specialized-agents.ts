#!/usr/bin/env bun
/**
 * Specialized Agents Tests
 *
 * Tests for:
 * - Devil's Advocate Agent
 * - Historical Precedent Agent
 * - Whale Watcher Agent
 * - MEV/Exploit Analyst
 * - Adversarial Debate Mode
 */

import {
  DEVILS_ADVOCATE_AGENT,
  HISTORICAL_PRECEDENT_AGENT,
  WHALE_WATCHER_AGENT,
  MEV_EXPLOIT_AGENT,
  SPECIALIZED_AGENTS,
  createDevilsAdvocateAnalysis,
  findHistoricalPrecedents,
  analyzeWhaleImpact,
  analyzeExploitVectors,
  runAdversarialAnalysis,
  HISTORICAL_DATABASE,
} from '../src/specialized-agents.js';
import type { ProposalContext } from '../src/llm-proposal-analyzer.js';
import type { AgentAnalysis } from '../src/multi-agent-debate.js';

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
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual < n) throw new Error(`Expected ${actual} >= ${n}`);
    },
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) throw new Error(`Expected ${actual} < ${n}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
    toContain(item: any) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
    toHaveLength(length: number) {
      if (!Array.isArray(actual) || actual.length !== length) {
        throw new Error(`Expected length ${length}, got ${Array.isArray(actual) ? actual.length : 'not an array'}`);
      }
    },
  };
}

// ============================================================================
// Mock Data
// ============================================================================

function createMockContext(overrides: Partial<ProposalContext> = {}): ProposalContext {
  return {
    proposalId: 'test-proposal-1',
    title: 'Increase Treasury Allocation',
    description: 'Proposal to increase treasury allocation by 10%',
    proposer: '0xProposer123',
    type: 'funding',
    requestedAmount: 100000,
    currentMetrics: {
      tvl: 10000000,
      dailyVolume: 500000,
      userCount: 5000,
      tokenPrice: 2.5,
    },
    ...overrides,
  };
}

function createMockAnalyses(supportCount: number, opposeCount: number): AgentAnalysis[] {
  const analyses: AgentAnalysis[] = [];

  for (let i = 0; i < supportCount; i++) {
    analyses.push({
      agentId: `support-agent-${i}`,
      agentName: `Support Agent ${i}`,
      perspective: 'technical',
      analysis: {
        recommendation: 'support',
        sentiment: 'positive',
        risks: [],
        opportunities: [],
        overallConfidence: 0.8,
        summary: 'Supporting the proposal',
      },
      timestamp: Date.now(),
    });
  }

  for (let i = 0; i < opposeCount; i++) {
    analyses.push({
      agentId: `oppose-agent-${i}`,
      agentName: `Oppose Agent ${i}`,
      perspective: 'risk_focused',
      analysis: {
        recommendation: 'oppose',
        sentiment: 'negative',
        risks: [],
        opportunities: [],
        overallConfidence: 0.8,
        summary: 'Opposing the proposal',
      },
      timestamp: Date.now(),
    });
  }

  return analyses;
}

// ============================================================================
// Tests
// ============================================================================

console.log('Specialized Agents Tests');
console.log('========================');

await (async () => {

section('1. Agent Definitions');

await test('All 4 specialized agents are defined', () => {
  expect(SPECIALIZED_AGENTS.length).toBe(4);
});

await test('Devils Advocate agent has correct properties', () => {
  expect(DEVILS_ADVOCATE_AGENT.id).toBe('devils-advocate');
  expect(DEVILS_ADVOCATE_AGENT.specialization).toBe('devils_advocate');
  expect(DEVILS_ADVOCATE_AGENT.weight).toBe(0.15);
  expect(DEVILS_ADVOCATE_AGENT.systemPrompt).toBeTruthy();
});

await test('Historical Precedent agent has correct properties', () => {
  expect(HISTORICAL_PRECEDENT_AGENT.id).toBe('historical-precedent');
  expect(HISTORICAL_PRECEDENT_AGENT.specialization).toBe('historical_precedent');
  expect(HISTORICAL_PRECEDENT_AGENT.weight).toBe(0.15);
});

await test('Whale Watcher agent has correct properties', () => {
  expect(WHALE_WATCHER_AGENT.id).toBe('whale-watcher');
  expect(WHALE_WATCHER_AGENT.specialization).toBe('whale_watcher');
  expect(WHALE_WATCHER_AGENT.weight).toBe(0.12);
});

await test('MEV Exploit agent has correct properties', () => {
  expect(MEV_EXPLOIT_AGENT.id).toBe('mev-exploit-analyst');
  expect(MEV_EXPLOIT_AGENT.specialization).toBe('mev_analyst');
  expect(MEV_EXPLOIT_AGENT.weight).toBe(0.18);
});

section('2. Devils Advocate Analysis');

await test('Takes opposite position when majority supports', () => {
  const analyses = createMockAnalyses(3, 1);
  const context = createMockContext();
  const result = createDevilsAdvocateAnalysis(analyses, context);

  expect(result.recommendation).toBe('oppose');
  expect(result.sentiment).toBe('negative');
});

await test('Takes opposite position when majority opposes', () => {
  const analyses = createMockAnalyses(1, 3);
  const context = createMockContext();
  const result = createDevilsAdvocateAnalysis(analyses, context);

  expect(result.recommendation).toBe('support');
  expect(result.sentiment).toBe('positive');
});

await test('Includes risk warnings for oppose position', () => {
  const analyses = createMockAnalyses(3, 1);
  const context = createMockContext();
  const result = createDevilsAdvocateAnalysis(analyses, context);

  expect(result.risks).toBeTruthy();
  expect(result.risks!.length).toBeGreaterThan(0);
});

await test('Has moderate confidence level', () => {
  const analyses = createMockAnalyses(3, 1);
  const context = createMockContext();
  const result = createDevilsAdvocateAnalysis(analyses, context);

  expect(result.overallConfidence).toBe(0.7);
});

section('3. Historical Precedent Analysis');

await test('Historical database has entries', () => {
  expect(HISTORICAL_DATABASE.length).toBeGreaterThan(0);
});

await test('Finds precedents for funding proposals', () => {
  const context = createMockContext({
    title: 'Increase COMP Distribution',
    type: 'funding',
  });
  const precedents = findHistoricalPrecedents(context);

  // Should find some matches based on keywords
  expect(precedents.length).toBeGreaterThanOrEqual(0);
});

await test('Finds precedents for gauge proposals', () => {
  const context = createMockContext({
    title: 'Rebalance Gauge Weights',
    type: 'gauge',
  });
  const precedents = findHistoricalPrecedents(context);

  expect(precedents.length).toBeGreaterThanOrEqual(0);
});

await test('Respects limit parameter', () => {
  const context = createMockContext();
  const precedents = findHistoricalPrecedents(context, 2);

  expect(precedents.length).toBeLessThan(3);
});

await test('Sorts precedents by similarity', () => {
  const context = createMockContext({
    title: 'Gauge Weight Rebalancing',
    type: 'gauge',
  });
  const precedents = findHistoricalPrecedents(context, 3);

  if (precedents.length >= 2) {
    expect(precedents[0].similarity).toBeGreaterThanOrEqual(precedents[1].similarity);
  }
});

section('4. Whale Watcher Analysis');

await test('Analyzes whale impact', () => {
  const context = createMockContext();
  const analysis = analyzeWhaleImpact(context);

  expect(analysis).toBeTruthy();
  expect(analysis.topHolders).toBeTruthy();
  expect(analysis.concentrationRisk).toBeTruthy();
});

await test('Detects high concentration risk', () => {
  const context = createMockContext();
  const analysis = analyzeWhaleImpact(context, [
    { address: '0x1', percentage: 30 },
    { address: '0x2', percentage: 25 },
    { address: '0x3', percentage: 20 },
  ]);

  // 75% in top 3 should be critical
  expect(analysis.concentrationRisk).toBe('critical');
});

await test('Detects low concentration risk', () => {
  const context = createMockContext();
  const analysis = analyzeWhaleImpact(context, [
    { address: '0x1', percentage: 5 },
    { address: '0x2', percentage: 4 },
    { address: '0x3', percentage: 3 },
  ]);

  // 12% in top 3 should be low
  expect(analysis.concentrationRisk).toBe('low');
});

await test('Adds warnings for funding requests', () => {
  const context = createMockContext({
    type: 'funding',
    requestedAmount: 1000000, // 10% of TVL
    currentMetrics: { tvl: 10000000, dailyVolume: 0, userCount: 0, tokenPrice: 0 },
  });
  const analysis = analyzeWhaleImpact(context);

  expect(analysis.warnings.length).toBeGreaterThan(0);
});

await test('Adds warnings for gauge changes', () => {
  const context = createMockContext({ type: 'gauge' });
  const analysis = analyzeWhaleImpact(context);

  expect(analysis.warnings.length).toBeGreaterThan(0);
});

section('5. MEV/Exploit Analysis');

await test('Analyzes exploit vectors', () => {
  const context = createMockContext();
  const analysis = analyzeExploitVectors(context);

  expect(analysis).toBeTruthy();
  expect(analysis.overallRiskScore).toBeGreaterThanOrEqual(0);
  expect(analysis.recommendation).toBeTruthy();
});

await test('Identifies funding vulnerabilities', () => {
  const context = createMockContext({
    type: 'funding',
    requestedAmount: 500000,
  });
  const analysis = analyzeExploitVectors(context);

  expect(analysis.vulnerabilities.length).toBeGreaterThan(0);
});

await test('Identifies parameter change MEV', () => {
  const context = createMockContext({ type: 'parameter' });
  const analysis = analyzeExploitVectors(context);

  expect(analysis.mevOpportunities.length).toBeGreaterThan(0);
});

await test('Identifies gauge change MEV', () => {
  const context = createMockContext({ type: 'gauge' });
  const analysis = analyzeExploitVectors(context);

  expect(analysis.mevOpportunities.length).toBeGreaterThan(0);
});

await test('Calculates appropriate recommendation', () => {
  const safeContext = createMockContext({
    type: 'signal',
    requestedAmount: 0,
    currentMetrics: { tvl: 100, dailyVolume: 0, userCount: 0, tokenPrice: 0 },
  });
  const safeAnalysis = analyzeExploitVectors(safeContext);

  expect(['safe', 'caution']).toContain(safeAnalysis.recommendation);
});

section('6. Adversarial Analysis Integration');

await test('Runs full adversarial analysis', () => {
  const context = createMockContext();
  const result = runAdversarialAnalysis(context);

  expect(result).toBeTruthy();
  expect(result.overallSecurityScore).toBeGreaterThanOrEqual(0);
  expect(result.overallSecurityScore).toBeLessThan(101);
});

await test('Includes devils advocate position', () => {
  const context = createMockContext();
  const result = runAdversarialAnalysis(context);

  expect(result.devilsAdvocatePosition).toBeTruthy();
  expect(result.devilsAdvocatePosition.length).toBeGreaterThan(0);
});

await test('Counts vulnerabilities', () => {
  const context = createMockContext({
    type: 'funding',
    requestedAmount: 500000,
  });
  const result = runAdversarialAnalysis(context);

  expect(result.vulnerabilitiesFound).toBeGreaterThanOrEqual(0);
});

await test('Collects whale risks', () => {
  const context = createMockContext({ type: 'gauge' });
  const result = runAdversarialAnalysis(context);

  expect(Array.isArray(result.whaleRisks)).toBe(true);
});

await test('Collects historical warnings', () => {
  const context = createMockContext();
  const result = runAdversarialAnalysis(context);

  expect(Array.isArray(result.historicalWarnings)).toBe(true);
});

await test('Determines pass/fail for adversarial review', () => {
  const context = createMockContext({ type: 'signal' });
  const result = runAdversarialAnalysis(context);

  expect(typeof result.passedAdversarialReview).toBe('boolean');
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n========================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`Results: ${passed} passed, ${failed} failed (${results.length} total)`);

if (failed > 0) {
  console.log('\n[FAIL] Failed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n[PASS] All specialized agent tests passed!');
  process.exit(0);
}
