#!/usr/bin/env bun
/**
 * Novel Voting Mechanisms Tests
 */

import {
  FutarchyGovernance,
  HolographicConsensus,
  ConvictionVotingAMM,
  RetroactiveVoting,
  LiquidDemocracyAgents,
} from '../src/novel-voting.js';

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
  };
}

// ============================================================================
// Tests
// ============================================================================

console.log('Novel Voting Mechanisms Tests');
console.log('=============================');

await (async () => {

section('1. Futarchy Governance');

await test('Creates futarchy instance', () => {
  const fg = new FutarchyGovernance();
  expect(fg).toBeTruthy();
});

await test('Creates futarchy proposal', () => {
  const fg = new FutarchyGovernance();
  const proposal = fg.createProposal(
    'Increase Fee',
    'Increase protocol fee to 0.5%',
    'proposer-1',
    'TVL',
    1000000
  );

  expect(proposal.id).toBeTruthy();
  expect(proposal.markets.pass.currentPrice).toBe(0.5);
  expect(proposal.markets.fail.currentPrice).toBe(0.5);
});

await test('Trades on pass market', () => {
  const fg = new FutarchyGovernance();
  const proposal = fg.createProposal('Test', 'Test', 'p', 'TVL', 1000000);

  const result = fg.trade(proposal.id, 'trader-1', 'pass', 100);
  expect(result.executed).toBe(true);
  expect(result.shares).toBeGreaterThan(0);
});

await test('Prices move with trades', () => {
  const fg = new FutarchyGovernance();
  const proposal = fg.createProposal('Test', 'Test', 'p', 'TVL', 1000000);

  const stateBefore = fg.getMarketState(proposal.id);
  fg.trade(proposal.id, 'trader-1', 'pass', 500);
  const stateAfter = fg.getMarketState(proposal.id);

  expect(stateAfter!.passPrice).toBeGreaterThan(stateBefore!.passPrice);
});

await test('Resolves by market prices', () => {
  const fg = new FutarchyGovernance();
  const proposal = fg.createProposal('Test', 'Test', 'p', 'TVL', 1000000);

  // Buy pass heavily
  fg.trade(proposal.id, 'trader-1', 'pass', 1000);
  fg.trade(proposal.id, 'trader-2', 'pass', 500);

  const result = fg.resolveByMarket(proposal.id);
  expect(result.decision).toBe('pass');
});

await test('Settles with actual metric', () => {
  const fg = new FutarchyGovernance();
  const proposal = fg.createProposal('Test', 'Test', 'p', 'TVL', 1000000);

  fg.trade(proposal.id, 'trader-1', 'pass', 500);
  fg.resolveByMarket(proposal.id);

  const settlement = fg.settleWithMetric(proposal.id, 1100000); // 10% increase
  expect(settlement.metricChange).toBeGreaterThan(0);
});

section('2. Holographic Consensus');

await test('Creates holographic consensus', () => {
  const hc = new HolographicConsensus();
  expect(hc).toBeTruthy();
});

await test('Creates proposal', () => {
  const hc = new HolographicConsensus();
  const proposal = hc.createProposal('Test', 'Test description', 'proposer-1');

  expect(proposal.id).toBeTruthy();
  expect(proposal.status).toBe('pending');
});

await test('Boosts proposal', () => {
  const hc = new HolographicConsensus({ boostThreshold: 1000 });
  const proposal = hc.createProposal('Test', 'Test', 'p');

  const result = hc.boost(proposal.id, 'booster-1', 500);
  expect(result.success).toBe(true);
  expect(result.totalBoost).toBe(500);
});

await test('Achieves boosted status', () => {
  const hc = new HolographicConsensus({ boostThreshold: 1000 });
  const proposal = hc.createProposal('Test', 'Test', 'p');

  hc.boost(proposal.id, 'booster-1', 600);
  const result = hc.boost(proposal.id, 'booster-2', 500);

  expect(result.isBoosted).toBe(true);
});

await test('Contests boosted proposal', () => {
  const hc = new HolographicConsensus({ boostThreshold: 1000 });
  const proposal = hc.createProposal('Test', 'Test', 'p');

  hc.boost(proposal.id, 'booster-1', 1100);
  const contested = hc.contest(proposal.id, 'contester-1', 600);

  expect(contested).toBe(true);
});

await test('Votes on proposal', () => {
  const hc = new HolographicConsensus({ boostThreshold: 1000 });
  const proposal = hc.createProposal('Test', 'Test', 'p');
  hc.boost(proposal.id, 'b', 1100);

  const voted = hc.vote(proposal.id, 'voter-1', 'yes', 1000);
  expect(voted).toBe(true);
});

await test('Resolves with boosted quorum', () => {
  const hc = new HolographicConsensus({ boostThreshold: 100, boostedQuorum: 0.05 });
  const proposal = hc.createProposal('Test', 'Test', 'p');
  hc.boost(proposal.id, 'b', 150);

  // Vote with enough for boosted quorum
  hc.vote(proposal.id, 'v1', 'yes', 50000);
  hc.vote(proposal.id, 'v2', 'yes', 10000);

  const result = hc.checkAndResolve(proposal.id);
  expect(result.quorumReached).toBe(true);
});

section('3. Conviction Voting AMM');

await test('Creates conviction voting AMM', () => {
  const cv = new ConvictionVotingAMM(100000);
  expect(cv).toBeTruthy();
});

await test('Creates proposal', () => {
  const cv = new ConvictionVotingAMM(100000);
  const proposal = cv.createProposal(
    'Fund Development',
    'Development grant',
    'proposer-1',
    10000,
    'beneficiary-1'
  );

  expect(proposal.id).toBeTruthy();
  expect(proposal.threshold).toBeGreaterThan(0);
});

await test('Adds support', () => {
  const cv = new ConvictionVotingAMM(100000);
  const proposal = cv.createProposal('Test', 'Test', 'p', 5000, 'b');

  const support = cv.addSupport(proposal.id, 'supporter-1', 1000);
  expect(support.amount).toBe(1000);
});

await test('Removes support', () => {
  const cv = new ConvictionVotingAMM(100000);
  const proposal = cv.createProposal('Test', 'Test', 'p', 5000, 'b');

  cv.addSupport(proposal.id, 'supporter-1', 1000);
  const removed = cv.removeSupport(proposal.id, 'supporter-1', 500);

  expect(removed).toBe(500);
});

await test('Updates convictions', () => {
  const cv = new ConvictionVotingAMM(100000);
  const proposal = cv.createProposal('Test', 'Test', 'p', 5000, 'b');

  cv.addSupport(proposal.id, 'supporter-1', 50000);

  // Simulate many blocks
  for (let i = 0; i < 100; i++) {
    cv.updateConvictions(1);
  }

  const status = cv.getProposalStatus(proposal.id);
  expect(status!.conviction).toBeGreaterThan(0);
});

await test('Gets proposal status', () => {
  const cv = new ConvictionVotingAMM(100000);
  const proposal = cv.createProposal('Test', 'Test', 'p', 5000, 'b');

  cv.addSupport(proposal.id, 's1', 1000);
  cv.addSupport(proposal.id, 's2', 2000);

  const status = cv.getProposalStatus(proposal.id);
  expect(status!.supporterCount).toBe(2);
  expect(status!.totalSupport).toBe(3000);
});

await test('Gets pool info', () => {
  const cv = new ConvictionVotingAMM(100000);
  const info = cv.getPoolInfo();

  expect(info.available).toBe(100000);
});

section('4. Retroactive Voting');

await test('Creates retroactive voting', () => {
  const rv = new RetroactiveVoting();
  expect(rv).toBeTruthy();
});

await test('Creates retro vote', () => {
  const rv = new RetroactiveVoting();
  const retroVote = rv.createRetroVote(
    'prop-1',
    'passed',
    'positive',
    50
  );

  expect(retroVote.id).toBeTruthy();
  expect(retroVote.originalOutcome).toBe('passed');
});

await test('Casts retro vote', () => {
  const rv = new RetroactiveVoting();
  const retroVote = rv.createRetroVote('prop-1', 'passed', 'positive', 50);

  const cast = rv.castVote(retroVote.id, 'voter-1', 'good', 0.8);
  expect(cast).toBe(true);
});

await test('Resolves retro vote', () => {
  const rv = new RetroactiveVoting();
  const retroVote = rv.createRetroVote('prop-1', 'passed', 'positive', 50);

  rv.castVote(retroVote.id, 'v1', 'good', 0.9);
  rv.castVote(retroVote.id, 'v2', 'good', 0.8);
  rv.castVote(retroVote.id, 'v3', 'bad', 0.5);

  const outcome = rv.resolve(retroVote.id);
  expect(outcome).toBe('good_decision');
});

await test('Calibrates agent', () => {
  const rv = new RetroactiveVoting();

  const calibration = rv.calibrateAgent(
    'agent-1',
    { proposalId: 'prop-1', outcome: 'support', confidence: 0.8 },
    'good_decision'
  );

  expect(calibration.agentId).toBe('agent-1');
  expect(calibration.predictions.length).toBe(1);
});

await test('Updates calibration score over time', () => {
  const rv = new RetroactiveVoting();

  // Multiple correct predictions
  rv.calibrateAgent('agent-1', { proposalId: 'p1', outcome: 'support', confidence: 0.8 }, 'good_decision');
  rv.calibrateAgent('agent-1', { proposalId: 'p2', outcome: 'support', confidence: 0.8 }, 'good_decision');
  rv.calibrateAgent('agent-1', { proposalId: 'p3', outcome: 'oppose', confidence: 0.7 }, 'bad_decision');

  const cal = rv.getAgentCalibration('agent-1');
  expect(cal!.calibrationScore).toBeGreaterThan(0.5);
});

await test('Gets calibration leaderboard', () => {
  const rv = new RetroactiveVoting();

  rv.calibrateAgent('agent-1', { proposalId: 'p1', outcome: 'support', confidence: 0.8 }, 'good_decision');
  rv.calibrateAgent('agent-2', { proposalId: 'p1', outcome: 'oppose', confidence: 0.6 }, 'good_decision');

  const leaderboard = rv.getCalibrationLeaderboard();
  expect(leaderboard.length).toBe(2);
});

section('5. Liquid Democracy Agents');

await test('Creates liquid democracy', () => {
  const ld = new LiquidDemocracyAgents();
  expect(ld).toBeTruthy();
});

await test('Registers agent', () => {
  const ld = new LiquidDemocracyAgents();
  const agent = ld.registerAgent('agent-1', 'Agent One', 1000);

  expect(agent.id).toBe('agent-1');
  expect(agent.ownVotingPower).toBe(1000);
});

await test('Delegates voting power', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('agent-1', 'Agent One', 1000);
  ld.registerAgent('agent-2', 'Agent Two', 500);

  const delegation = ld.delegate('agent-1', 'agent-2', 0.5);
  expect(delegation.weight).toBe(0.5);
});

await test('Calculates effective power', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('agent-1', 'Agent One', 1000);
  ld.registerAgent('agent-2', 'Agent Two', 500);

  ld.delegate('agent-1', 'agent-2', 0.5);

  const power = ld.getEffectivePower('agent-2');
  expect(power).toBe(1000); // 500 own + 500 delegated (50% of 1000)
});

await test('Prevents circular delegation', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('agent-1', 'A1', 1000);
  ld.registerAgent('agent-2', 'A2', 500);
  ld.registerAgent('agent-3', 'A3', 300);

  ld.delegate('agent-1', 'agent-2', 0.5);
  ld.delegate('agent-2', 'agent-3', 0.5);

  let threw = false;
  try {
    ld.delegate('agent-3', 'agent-1', 0.5);
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});

await test('Undelegates', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('agent-1', 'A1', 1000);
  ld.registerAgent('agent-2', 'A2', 500);

  ld.delegate('agent-1', 'agent-2', 0.5);
  const removed = ld.undelegate('agent-1', 'agent-2');

  expect(removed).toBe(true);

  const power = ld.getEffectivePower('agent-2');
  expect(power).toBe(500);
});

await test('Gets delegation chain', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('a1', 'A1', 1000);
  ld.registerAgent('a2', 'A2', 500);
  ld.registerAgent('a3', 'A3', 300);

  ld.delegate('a1', 'a2', 0.5, { transitive: true });
  ld.delegate('a2', 'a3', 0.5, { transitive: true });

  const chain = ld.getDelegationChain('a1');
  // Chain includes: a1 (self) + a2 (delegated) + a3 (transitive)
  expect(chain.length).toBeGreaterThanOrEqual(1);
  expect(chain[0]).toBe('a1');
});

await test('Gets power leaderboard', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('a1', 'A1', 1000);
  ld.registerAgent('a2', 'A2', 500);
  ld.registerAgent('a3', 'A3', 2000);

  ld.delegate('a1', 'a2', 1.0);

  const leaderboard = ld.getPowerLeaderboard();
  expect(leaderboard[0].agentId).toBe('a3');
});

await test('Filters delegation by topic', () => {
  const ld = new LiquidDemocracyAgents();
  ld.registerAgent('a1', 'A1', 1000);
  ld.registerAgent('a2', 'A2', 500);

  ld.delegate('a1', 'a2', 1.0, { topics: ['treasury'] });

  const treasuryPower = ld.getEffectivePower('a2', 'treasury');
  const otherPower = ld.getEffectivePower('a2', 'parameter');

  expect(treasuryPower).toBe(1500);
  expect(otherPower).toBe(500);
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n=============================');
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
  console.log('\n[PASS] All novel voting tests passed!');
  process.exit(0);
}
