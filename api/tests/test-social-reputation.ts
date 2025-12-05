#!/usr/bin/env bun
/**
 * Social & Reputation Systems Tests
 */

import {
  DebateReplayTheater,
  AgentFanClubs,
  GovernanceInfluencerScore,
  CrossDAOReputationPassport,
  DebateHighlightReels,
} from '../src/social-reputation.js';
import type { DebateRecord, DebateArgument } from '../src/social-reputation.js';

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
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
  };
}

// ============================================================================
// Mock Data
// ============================================================================

function createMockDebate(): DebateRecord {
  const positions = new Map<string, 'support' | 'oppose' | 'neutral'>();
  positions.set('agent-1', 'support');
  positions.set('agent-2', 'oppose');

  const args: DebateArgument[] = [
    {
      agentId: 'agent-1',
      position: 'support',
      content: 'This proposal will increase TVL significantly',
      confidence: 0.85,
      timestamp: Date.now(),
      rebuttals: ['What about the risks?'],
      upvotes: 15,
      cited: true,
    },
    {
      agentId: 'agent-2',
      position: 'oppose',
      content: 'The risks outweigh the benefits',
      confidence: 0.75,
      timestamp: Date.now(),
      rebuttals: ['Counter 1', 'Counter 2', 'Counter 3'],
      upvotes: 8,
      cited: false,
    },
  ];

  return {
    id: 'debate-1',
    proposalId: 'prop-1',
    timestamp: Date.now(),
    agents: ['agent-1', 'agent-2'],
    positions,
    arguments: args,
    outcome: 'support',
    actualResult: true,
  };
}

// ============================================================================
// Tests
// ============================================================================

console.log('Social & Reputation Systems Tests');
console.log('==================================');

await (async () => {

section('1. Debate Replay Theater');

await test('Creates theater instance', () => {
  const theater = new DebateReplayTheater();
  expect(theater).toBeTruthy();
});

await test('Archives a debate', () => {
  const theater = new DebateReplayTheater();
  const debate = createMockDebate();
  theater.archiveDebate(debate);

  const archived = theater.getArchivedDebates();
  expect(archived.length).toBe(1);
});

await test('Replays a debate with new positions', async () => {
  const theater = new DebateReplayTheater();
  const debate = createMockDebate();
  theater.archiveDebate(debate);

  const newPositions = new Map();
  newPositions.set('agent-1', { position: 'oppose', confidence: 0.9 });
  newPositions.set('agent-2', { position: 'support', confidence: 0.7 });

  const result = await theater.replayDebate(debate.id, newPositions);
  expect(result.outcomeChanged).toBe(true);
  expect(result.insights.length).toBeGreaterThan(0);
});

section('2. Agent Fan Clubs');

await test('Creates fan club', () => {
  const clubs = new AgentFanClubs();
  const club = clubs.createClub('agent-1', 0.1);
  expect(club.agentId).toBe('agent-1');
});

await test('Joins fan club', () => {
  const clubs = new AgentFanClubs();
  const member = clubs.joinClub('agent-1', 'user-1', 5000);
  expect(member.stakedAmount).toBe(5000);
  expect(member.tier).toBe('silver');
});

await test('Calculates tiers correctly', () => {
  const clubs = new AgentFanClubs();
  const bronze = clubs.joinClub('agent-1', 'user-1', 500);
  const gold = clubs.joinClub('agent-1', 'user-2', 50000);
  const platinum = clubs.joinClub('agent-1', 'user-3', 150000);

  expect(bronze.tier).toBe('bronze');
  expect(gold.tier).toBe('gold');
  expect(platinum.tier).toBe('platinum');
});

await test('Distributes rewards', () => {
  const clubs = new AgentFanClubs();
  clubs.joinClub('agent-1', 'user-1', 1000);
  clubs.joinClub('agent-1', 'user-2', 1000);

  const distributed = clubs.distributeRewards('agent-1', 1000);
  expect(distributed).toBeGreaterThan(0);
});

await test('Claims rewards', () => {
  const clubs = new AgentFanClubs();
  clubs.joinClub('agent-1', 'user-1', 1000);
  clubs.distributeRewards('agent-1', 1000);

  const claimed = clubs.claimRewards('agent-1', 'user-1');
  expect(claimed).toBeGreaterThan(0);
});

section('3. Governance Influencer Score');

await test('Creates influencer score system', () => {
  const gis = new GovernanceInfluencerScore();
  expect(gis).toBeTruthy();
});

await test('Records predictions', () => {
  const gis = new GovernanceInfluencerScore();
  const pred = gis.recordPrediction('agent-1', 'prop-1', 'support', 0.8);

  expect(pred.agentId).toBe('agent-1');
  expect(pred.prediction).toBe('support');
});

await test('Records outcomes and updates adoption', () => {
  const gis = new GovernanceInfluencerScore();
  gis.recordPrediction('agent-1', 'prop-1', 'support', 0.8);
  gis.recordOutcome('prop-1', 'support');

  const metrics = gis.getMetrics('agent-1');
  expect(metrics!.adoptedPredictions).toBe(1);
});

await test('Tracks follows', () => {
  const gis = new GovernanceInfluencerScore();
  gis.recordPrediction('agent-1', 'prop-1', 'support', 0.8);
  gis.follow('user-1', 'agent-1');
  gis.follow('user-2', 'agent-1');

  const metrics = gis.getMetrics('agent-1');
  expect(metrics!.followCount).toBe(2);
});

await test('Calculates influence score', () => {
  const gis = new GovernanceInfluencerScore();
  gis.recordPrediction('agent-1', 'prop-1', 'support', 0.8);
  gis.recordOutcome('prop-1', 'support');
  gis.follow('user-1', 'agent-1');

  const metrics = gis.getMetrics('agent-1');
  expect(metrics!.influenceScore).toBeGreaterThan(0);
});

section('4. Cross-DAO Reputation Passport');

await test('Creates passport', () => {
  const passport = new CrossDAOReputationPassport();
  const p = passport.createPassport('agent-1');
  expect(p.agentId).toBe('agent-1');
});

await test('Adds credentials', () => {
  const passport = new CrossDAOReputationPassport();
  passport.createPassport('agent-1');

  const cred = passport.addCredential('agent-1', {
    daoId: 'uniswap',
    daoName: 'Uniswap',
    joinedAt: Date.now(),
    role: 'delegate',
    participationRate: 0.8,
    predictionAccuracy: 0.75,
    proposalsCreated: 5,
    proposalsPassed: 3,
    votingPower: 10000,
    reputationScore: 85,
  });

  expect(cred.daoId).toBe('uniswap');
});

await test('Verifies credentials', () => {
  const passport = new CrossDAOReputationPassport();
  passport.createPassport('agent-1');
  passport.addCredential('agent-1', {
    daoId: 'aave',
    daoName: 'Aave',
    joinedAt: Date.now(),
    role: 'voter',
    participationRate: 0.6,
    predictionAccuracy: 0.7,
    proposalsCreated: 0,
    proposalsPassed: 0,
    votingPower: 1000,
    reputationScore: 60,
  });

  const verified = passport.verifyCredential('agent-1', 'aave', 'proof123');
  expect(verified).toBe(true);
});

await test('Calculates aggregate score', () => {
  const passport = new CrossDAOReputationPassport();
  passport.createPassport('agent-1');
  passport.addCredential('agent-1', {
    daoId: 'uniswap',
    daoName: 'Uniswap',
    joinedAt: Date.now(),
    role: 'delegate',
    participationRate: 0.9,
    predictionAccuracy: 0.85,
    proposalsCreated: 10,
    proposalsPassed: 8,
    votingPower: 50000,
    reputationScore: 90,
  });

  const p = passport.getPassport('agent-1');
  expect(p!.aggregateScore).toBeGreaterThan(0);
});

section('5. Debate Highlight Reels');

await test('Creates highlight system', () => {
  const highlights = new DebateHighlightReels();
  expect(highlights).toBeTruthy();
});

await test('Extracts highlights from debate', () => {
  const reels = new DebateHighlightReels();
  const debate = createMockDebate();

  const extracted = reels.extractHighlights(debate);
  expect(extracted.length).toBeGreaterThan(0);
});

await test('Creates highlight reel', () => {
  const reels = new DebateHighlightReels();
  const debate = createMockDebate();
  const extracted = reels.extractHighlights(debate);

  const reel = reels.createReel(
    'Best of Week 1',
    'Top debate moments',
    extracted.map(h => h.id),
    'curator-1'
  );

  expect(reel.highlights.length).toBeGreaterThan(0);
});

await test('Generates best-of reel automatically', () => {
  const reels = new DebateHighlightReels();
  const debate = createMockDebate();
  reels.extractHighlights(debate);

  const reel = reels.generateBestOfReel({
    start: Date.now() - 86400000,
    end: Date.now() + 86400000,
  });

  expect(reel.title).toBeTruthy();
});

await test('Gets trending highlights', () => {
  const reels = new DebateHighlightReels();
  const debate = createMockDebate();
  const extracted = reels.extractHighlights(debate);

  // Add some views
  for (const h of extracted) {
    reels.recordView(h.id);
    reels.recordView(h.id);
    reels.saveHighlight(h.id);
  }

  const trending = reels.getTrending(5);
  expect(trending.length).toBeGreaterThan(0);
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n==================================');
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
  console.log('\n[PASS] All social reputation tests passed!');
  process.exit(0);
}
