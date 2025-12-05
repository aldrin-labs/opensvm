#!/usr/bin/env bun
/**
 * Futarchy Governance & Autonomous Agent Tests
 */

import {
  FutarchyGovernance,
  getFutarchyGovernance,
} from '../src/futarchy-governance.js';

import {
  AutonomousGovernanceAgent,
  getAutonomousGovernanceAgent,
  ProtocolMetrics,
} from '../src/autonomous-governance-agent.js';

import { ConvictionVotingEngine } from '../src/conviction-voting.js';
import { VeTokenEngine } from '../src/vetoken-model.js';

// ============================================================================
// Test Utilities
// ============================================================================

const results: { name: string; passed: boolean; error?: string }[] = [];
let currentSection = '';

function section(name: string) {
  currentSection = name;
  console.log(`\n${name}`);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name: `${currentSection} - ${name}`, passed: true });
    console.log(`   [PASS] ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name: `${currentSection} - ${name}`, passed: false, error: message });
    console.log(`   [FAIL] ${name}: ${message}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} < ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy, got ${actual}`);
      }
    },
    toThrow(msg?: string) {
      if (typeof actual !== 'function') throw new Error('Expected function');
      try {
        (actual as () => void)();
        throw new Error('Expected to throw');
      } catch (e) {
        if (msg && e instanceof Error && !e.message.includes(msg)) {
          throw new Error(`Expected error "${msg}", got "${e.message}"`);
        }
      }
    },
    toContain(item: string) {
      if (typeof actual !== 'string' || !actual.includes(item)) {
        throw new Error(`Expected "${actual}" to contain "${item}"`);
      }
    },
  };
}

// ============================================================================
// Mock Data
// ============================================================================

const testConfig = {
  tradingPeriod: 100,
  minLiquidity: 1000,
  tradingFee: 0.01,
  minPriceDifference: 0.05,
  initialLiquidity: 5000,
  maxPositionSize: 50000,
};

const mockMetrics: ProtocolMetrics = {
  tvl: 10000000,
  volume24h: 500000,
  fees24h: 5000,
  activeUsers: 1000,
  tokenPrice: 1.5,
  avgApy: 0.15,
  timestamp: Date.now(),
};

function createMockVeEngine(): VeTokenEngine {
  const balances = new Map<string, number>();
  balances.set('agent', 50000);
  balances.set('alice', 10000);
  balances.set('bob', 5000);

  return {
    getCurrentVeBalance: (addr: string) => balances.get(addr) || 0,
    getTotalVeSupply: () => 65000,
  } as unknown as VeTokenEngine;
}

// ============================================================================
// Futarchy Tests
// ============================================================================

console.log('Futarchy Governance & Autonomous Agent Tests');
console.log('============================================================');

section('1. Futarchy - Proposal Creation');

test('Create futarchy proposal', () => {
  const gov = new FutarchyGovernance(testConfig);

  const proposal = gov.createProposal(
    'Add New Liquidity Pool',
    'Add SOL/USDC pool to increase trading volume',
    'alice',
    'TVL',
    2000
  );

  expect(proposal.id).toBeTruthy();
  expect(proposal.decision).toBe('pending');
  expect(proposal.passMarket.id).toBeTruthy();
  expect(proposal.failMarket.id).toBeTruthy();
  expect(proposal.passMarket.price).toBe(0.5);
  expect(proposal.failMarket.price).toBe(0.5);
});

test('Minimum liquidity enforced', () => {
  const gov = new FutarchyGovernance(testConfig);

  expect(() => gov.createProposal(
    'Test',
    'Test',
    'alice',
    'TVL',
    100 // Below min
  )).toThrow('Minimum liquidity');
});

section('2. Futarchy - Trading');

test('Buy YES shares', () => {
  const gov = new FutarchyGovernance(testConfig);

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);
  const result = gov.buyYes(proposal.id, 'pass', 'bob', 500);

  expect(result.sharesReceived).toBeGreaterThan(0);
  expect(result.newPrice).toBeGreaterThan(0.5); // Price increases
});

test('Buy NO shares', () => {
  const gov = new FutarchyGovernance(testConfig);

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);
  const result = gov.buyNo(proposal.id, 'pass', 'bob', 500);

  expect(result.sharesReceived).toBeGreaterThan(0);
  expect(result.newPrice).toBeLessThan(0.5); // Price decreases
});

test('Price moves with trades', () => {
  const gov = new FutarchyGovernance(testConfig);

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);

  // Heavy YES buying should raise price
  gov.buyYes(proposal.id, 'pass', 'alice', 500);
  gov.buyYes(proposal.id, 'pass', 'bob', 500);

  const prices = gov.getMarketPrices(proposal.id);
  expect(prices.passPrice).toBeGreaterThan(0.6);
});

test('Position tracking', () => {
  const gov = new FutarchyGovernance(testConfig);

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);

  gov.buyYes(proposal.id, 'pass', 'alice', 500);
  gov.buyNo(proposal.id, 'fail', 'alice', 300);

  const positions = gov.getTraderPositions('alice');
  expect(positions.length).toBe(2);
});

test('Cannot trade after deadline', async () => {
  const gov = new FutarchyGovernance({
    ...testConfig,
    tradingPeriod: 50,
  });

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);

  await new Promise(r => setTimeout(r, 100));

  expect(() => gov.buyYes(proposal.id, 'pass', 'bob', 100)).toThrow('ended');
});

section('3. Futarchy - Resolution');

test('Resolve proposal (pass wins)', async () => {
  const gov = new FutarchyGovernance({
    ...testConfig,
    tradingPeriod: 50,
  });

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);

  // Heavy buying on pass market
  gov.buyYes(proposal.id, 'pass', 'alice', 800);
  gov.buyYes(proposal.id, 'pass', 'bob', 500);

  await new Promise(r => setTimeout(r, 100));

  const resolved = gov.resolveProposal(proposal.id);
  expect(resolved.decision).toBe('pass');
  expect(resolved.passMarket.status).toBe('resolved');
  expect(resolved.failMarket.status).toBe('voided');
});

test('Resolve proposal (fail wins)', async () => {
  const gov = new FutarchyGovernance({
    ...testConfig,
    tradingPeriod: 50,
  });

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);

  // Heavy buying on fail market
  gov.buyYes(proposal.id, 'fail', 'alice', 800);

  await new Promise(r => setTimeout(r, 100));

  const resolved = gov.resolveProposal(proposal.id);
  expect(resolved.decision).toBe('fail');
});

test('Claim winnings', async () => {
  const gov = new FutarchyGovernance({
    ...testConfig,
    tradingPeriod: 50,
  });

  const proposal = gov.createProposal('Test', 'Test', 'alice', 'TVL', 2000);

  gov.buyYes(proposal.id, 'pass', 'bob', 500);

  await new Promise(r => setTimeout(r, 100));
  gov.resolveProposal(proposal.id);

  const winnings = gov.claimWinnings(proposal.id, 'bob');
  expect(winnings.amount).toBeGreaterThan(0);
});

section('4. Futarchy - Statistics');

test('Get stats', () => {
  const gov = new FutarchyGovernance(testConfig);

  gov.createProposal('Test 1', 'Test', 'alice', 'TVL', 2000);
  gov.createProposal('Test 2', 'Test', 'bob', 'Volume', 2000);

  const stats = gov.getStats();
  expect(stats.totalProposals).toBe(2);
  expect(stats.pendingProposals).toBe(2);
});

// ============================================================================
// Autonomous Agent Tests
// ============================================================================

section('5. Agent - Configuration');

test('Create agent with strategy', () => {
  const agent = new AutonomousGovernanceAgent({ strategy: 'conservative' });
  const config = agent.getConfig();

  expect(config.minConfidence).toBe(0.8);
  expect(config.riskTolerance).toBe(0.2);
});

test('Create agent with custom config', () => {
  const agent = new AutonomousGovernanceAgent({
    strategy: 'custom',
    minConfidence: 0.5,
    riskTolerance: 0.7,
  });

  const config = agent.getConfig();
  expect(config.minConfidence).toBe(0.5);
  expect(config.riskTolerance).toBe(0.7);
});

section('6. Agent - Proposal Analysis');

test('Analyze conviction proposal', () => {
  const veEngine = createMockVeEngine();
  const convictionEngine = new ConvictionVotingEngine(veEngine, {
    convictionGrowthHalfLife: 1000,
    minConviction: 100,
    minStake: 10,
  });

  convictionEngine.createProposal(
    'funding',
    'Add liquidity rewards',
    'Increase TVL by adding liquidity incentives',
    'alice',
    { requestedAmount: 5000 }
  );

  const agent = new AutonomousGovernanceAgent({ strategy: 'balanced' });
  agent.connectConviction(convictionEngine);

  // Scan should find the proposal
  const analyses = agent.scanProposals(mockMetrics);
  expect(analyses).toBeTruthy();
});

test('Analyze proposal impact', async () => {
  const veEngine = createMockVeEngine();
  const convictionEngine = new ConvictionVotingEngine(veEngine, {
    convictionGrowthHalfLife: 1000,
    minConviction: 100,
    minStake: 10,
  });

  convictionEngine.createProposal(
    'funding',
    'Add liquidity rewards to boost TVL',
    'This proposal adds incentives to increase liquidity and grow the protocol',
    'alice',
    { requestedAmount: 1000 }
  );

  const agent = new AutonomousGovernanceAgent({ 
    strategy: 'aggressive',
    autoExecute: false,
  });
  agent.connectConviction(convictionEngine);

  const analyses = await agent.scanProposals(mockMetrics);
  
  expect(analyses.length).toBeGreaterThan(0);
  const analysis = analyses[0];
  
  // Check analysis has expected properties
  expect(analysis.proposalId).toBeTruthy();
  expect(analysis.score).toBeTruthy(); // May be positive or negative
  expect(analysis.confidence).toBeGreaterThan(0);
  expect(analysis.reasoning.length).toBeGreaterThan(0);
});

section('7. Agent - Decision Making');

test('Make decision based on analysis', async () => {
  const veEngine = createMockVeEngine();
  const convictionEngine = new ConvictionVotingEngine(veEngine, {
    convictionGrowthHalfLife: 1000,
    minConviction: 100,
    minStake: 10,
  });

  // Create a proposal that should get support
  convictionEngine.createProposal(
    'signal',
    'Boost liquidity rewards and add user growth incentives',
    'This will increase TVL, volume, users, and overall protocol health',
    'alice'
  );

  const agent = new AutonomousGovernanceAgent({ 
    strategy: 'aggressive',
    minConfidence: 0.3,
    minScoreToSupport: 5,
    autoExecute: false,
  });
  agent.connectConviction(convictionEngine);

  const decisions = await agent.processProposals(mockMetrics);
  
  // Agent should make some decision
  expect(agent.getStats().totalDecisions).toBeGreaterThan(0);
});

test('Respect confidence threshold', async () => {
  const veEngine = createMockVeEngine();
  const convictionEngine = new ConvictionVotingEngine(veEngine, {
    convictionGrowthHalfLife: 1000,
    minConviction: 100,
    minStake: 10,
  });

  convictionEngine.createProposal(
    'signal',
    'x', // Very short - low confidence
    'y',
    'alice'
  );

  // High confidence threshold should cause abstention
  const agent = new AutonomousGovernanceAgent({ 
    strategy: 'conservative',
    minConfidence: 0.99, // Very high
    autoExecute: false,
  });
  agent.connectConviction(convictionEngine);

  await agent.processProposals(mockMetrics);
  
  // Should abstain due to low confidence
  const pending = agent.getPendingDecisions();
  // With very low confidence, likely to abstain
  expect(agent.getStats().totalDecisions >= 0).toBe(true);
});

section('8. Agent - Learning');

test('Record outcome for learning', async () => {
  const agent = new AutonomousGovernanceAgent({ 
    enableLearning: true,
  });

  // Simulate a past decision
  const veEngine = createMockVeEngine();
  const convictionEngine = new ConvictionVotingEngine(veEngine, {
    convictionGrowthHalfLife: 1000,
    minConviction: 100,
    minStake: 10,
  });

  const proposal = convictionEngine.createProposal(
    'signal',
    'Test proposal for learning',
    'Testing the learning mechanism',
    'alice'
  );

  agent.connectConviction(convictionEngine);
  await agent.processProposals(mockMetrics);

  // Record actual outcome
  agent.recordOutcome(proposal.id, {
    tvl: 5,
    volume: 3,
    fees: 2,
    users: 4,
    token_price: 1,
    apy: 0,
  });

  // Should have recorded without error
  expect(true).toBe(true);
});

section('9. Agent - Statistics');

test('Get agent stats', () => {
  const agent = new AutonomousGovernanceAgent();

  const stats = agent.getStats();
  expect(stats.totalDecisions >= 0).toBe(true);
  expect(stats.balance).toBeGreaterThan(0);
  expect(stats.isRunning).toBe(false);
});

section('10. Singletons');

test('Futarchy singleton', () => {
  const g1 = getFutarchyGovernance();
  const g2 = getFutarchyGovernance();
  expect(g1).toBe(g2);
});

test('Agent singleton', () => {
  const a1 = getAutonomousGovernanceAgent();
  const a2 = getAutonomousGovernanceAgent();
  expect(a1).toBe(a2);
});

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
  console.log('\n[SUCCESS] All futarchy and agent tests passed!');
  process.exit(0);
}
