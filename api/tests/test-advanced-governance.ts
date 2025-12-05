#!/usr/bin/env bun
/**
 * Advanced Governance Tests
 *
 * Tests for:
 * 1. Conviction Voting Integration
 * 2. Rage Quit Protection
 * 3. Holographic Consensus (Boosting)
 * 4. Prediction Markets
 */

import { UnifiedMCPRegistry } from '../src/mcp-registry-unified.js';
import {
  AdvancedGovernance,
  DEFAULT_RAGE_QUIT_CONFIG,
  DEFAULT_HOLOGRAPHIC_CONFIG,
  VotingMode,
} from '../src/mcp-advanced-governance.js';

console.log('Advanced Governance Tests');
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

async function runAllTests() {

// ============================================================================
// Setup & Staking Tests
// ============================================================================

console.log('\n1. Staking & Setup');

await test('Register stake for governance', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('wallet1', BigInt(10000) * BigInt(1e9));

  const stake = gov.getStake('wallet1');
  assert(stake !== null, 'Should have stake');
  assert(stake!.amount === BigInt(10000) * BigInt(1e9), 'Amount should match');
  assert(stake!.duration >= 0, 'Duration should be non-negative');
});

await test('Get stake returns null for unknown wallet', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  const stake = gov.getStake('unknown');
  assert(stake === null, 'Should return null for unknown wallet');
});

// ============================================================================
// Proposal Creation Tests
// ============================================================================

console.log('\n2. Proposal Creation');

await test('Create proposal with sufficient stake', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Test Proposal',
    description: 'A test proposal',
    type: 'listing_approval',
    actions: [{ target: 'registry', function: 'approve', params: { serverId: 'test' } }],
  });

  assert(proposal.id === 'ADV-1', 'Should have ID ADV-1');
  assert(proposal.status === 'pending', 'Should start pending');
  assert(proposal.votingMode === 'conviction', 'Default mode should be conviction');
  assert(proposal.rageQuitEligible === true, 'Should be rage quit eligible');
});

await test('Create proposal fails with insufficient stake', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('weak-proposer', BigInt(100) * BigInt(1e9)); // Only 100 tokens

  try {
    gov.createProposal('weak-proposer', {
      title: 'Should Fail',
      description: 'Not enough stake',
      type: 'test',
      actions: [],
    });
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Insufficient'), 'Should mention insufficient');
  }
});

await test('Create proposal with custom voting mode', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Quadratic Vote Proposal',
    description: 'Uses quadratic voting',
    type: 'test',
    votingMode: 'quadratic',
    actions: [],
  });

  assert(proposal.votingMode === 'quadratic', 'Should use quadratic voting');
});

await test('Exempt proposal types are not rage quit eligible', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Parameter Change',
    description: 'Changing a config param',
    type: 'parameter_change',  // Exempt type
    actions: [],
  });

  assert(proposal.rageQuitEligible === false, 'Parameter change should not be rage quit eligible');
});

// ============================================================================
// Holographic Consensus Tests
// ============================================================================

console.log('\n3. Holographic Consensus - Boosting');

await test('Boost a proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('booster', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Boostable Proposal',
    description: 'Can be boosted',
    type: 'test',
    actions: [],
  });

  // Activate proposal
  (proposal as any).status = 'active';

  const boost = gov.boostProposal(proposal.id, 'booster', 'pass');

  assert(boost.booster === 'booster', 'Booster should match');
  assert(boost.prediction === 'pass', 'Prediction should match');
  assert(boost.stakeAmount === DEFAULT_HOLOGRAPHIC_CONFIG.boostStakeRequired, 'Stake should match config');

  const updated = gov.getProposal(proposal.id)!;
  assert(updated.boosted === true, 'Proposal should be boosted');
  assert(updated.status === 'boosted', 'Status should be boosted');
});

await test('Cannot boost already boosted proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('booster1', BigInt(10000) * BigInt(1e9));
  gov.registerStake('booster2', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Already Boosted',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  gov.boostProposal(proposal.id, 'booster1', 'pass');

  try {
    gov.boostProposal(proposal.id, 'booster2', 'pass');
    assert(false, 'Should throw');
  } catch (error) {
    // After first boost, status changes to 'boosted' so error could be either message
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    assert(msg.includes('boosted') || msg.includes('cannot be boosted'), 'Should reject boosting already boosted proposal');
  }
});

await test('Cannot boost with insufficient stake', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('weak-booster', BigInt(1000) * BigInt(1e9)); // Not enough

  const proposal = gov.createProposal('proposer', {
    title: 'Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  try {
    gov.boostProposal(proposal.id, 'weak-booster', 'pass');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Insufficient'), 'Should mention insufficient');
  }
});

await test('Boosted proposal has reduced quorum', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('booster', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Quorum Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  const originalQuorum = proposal.quorum;
  gov.boostProposal(proposal.id, 'booster', 'pass');

  const updated = gov.getProposal(proposal.id)!;
  assert(updated.effectiveQuorum < originalQuorum, 'Effective quorum should be reduced');
});

await test('Resolve boosts rewards correct predictions', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('booster', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Reward Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  gov.boostProposal(proposal.id, 'booster', 'pass');
  (proposal as any).status = 'passed';

  const result = gov.resolveBoosts(proposal.id);

  assert(result.rewarded.includes('booster'), 'Booster should be rewarded');
  assert(result.slashed.length === 0, 'No one should be slashed');

  const updatedProposal = gov.getProposal(proposal.id)!;
  assert(updatedProposal.boosts[0].rewarded === true, 'Boost should be marked rewarded');
});

await test('Resolve boosts slashes incorrect predictions', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('booster', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Slash Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  gov.boostProposal(proposal.id, 'booster', 'pass');  // Predicted pass
  (proposal as any).status = 'rejected';  // But it was rejected

  const result = gov.resolveBoosts(proposal.id);

  assert(result.slashed.includes('booster'), 'Booster should be slashed');
  assert(result.rewarded.length === 0, 'No one should be rewarded');
});

// ============================================================================
// Prediction Markets Tests
// ============================================================================

console.log('\n4. Prediction Markets');

await test('Buy prediction shares', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Market Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });

  const result = gov.buyPredictionShares(proposal.id, 'trader', 'yes', BigInt(1000) * BigInt(1e9));

  assert(result.shares > BigInt(0), 'Should receive shares');
  assert(result.price > 0, 'Should have price');
});

await test('Buying yes shares increases yes price', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Price Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });

  const before = gov.getMarketPrediction(proposal.id)!;

  // Buy a lot of yes shares
  gov.buyPredictionShares(proposal.id, 'bull', 'yes', BigInt(10000) * BigInt(1e9));

  const after = gov.getMarketPrediction(proposal.id)!;

  assert(after.willPass > before.willPass, 'Yes price should increase');
  assert(after.willFail < before.willFail, 'No price should decrease');
});

await test('Get market prediction for proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Predict Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });

  const prediction = gov.getMarketPrediction(proposal.id);

  assert(prediction !== null, 'Should have prediction');
  assert(prediction!.willPass + prediction!.willFail > 0.99, 'Probabilities should sum to ~1');
});

// ============================================================================
// Rage Quit Tests
// ============================================================================

console.log('\n5. Rage Quit Protection');

await test('Request rage quit after proposal passes', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  // Register stake long enough ago
  gov.registerStake('dissenter', BigInt(3000) * BigInt(1e9));
  // Manually backdate stake
  (gov as any).voterStakes.get('dissenter').stakedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

  const proposal = gov.createProposal('proposer', {
    title: 'Controversial',
    description: 'Some voters may want to rage quit',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'rage_quit_window';
  (proposal as any).gracePeriodEndsAt = Date.now() + 3 * 24 * 60 * 60 * 1000;

  const request = gov.requestRageQuit('dissenter', proposal.id);

  assert(request.wallet === 'dissenter', 'Wallet should match');
  assert(request.status === 'pending', 'Status should be pending');
  assert(request.claimableAmount > BigInt(0), 'Should have claimable amount');
});

await test('Cannot rage quit non-eligible proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(3000) * BigInt(1e9));
  (gov as any).voterStakes.get('voter').stakedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

  // Emergency type is exempt
  const proposal = gov.createProposal('proposer', {
    title: 'Emergency Action',
    description: 'Cannot rage quit',
    type: 'emergency',
    actions: [],
  });
  (proposal as any).status = 'passed';

  try {
    gov.requestRageQuit('voter', proposal.id);
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('not eligible'), 'Should mention not eligible');
  }
});

await test('Cannot rage quit with recent stake', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('new-staker', BigInt(3000) * BigInt(1e9)); // Just staked

  const proposal = gov.createProposal('proposer', {
    title: 'Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'rage_quit_window';

  try {
    gov.requestRageQuit('new-staker', proposal.id);
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('too recent'), 'Should mention stake too recent');
  }
});

await test('Process rage quit burns stake and distributes treasury', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('quitter', BigInt(2000) * BigInt(1e9));
  (gov as any).voterStakes.get('quitter').stakedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

  const proposal = gov.createProposal('proposer', {
    title: 'Quit Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'rage_quit_window';
  (proposal as any).gracePeriodEndsAt = Date.now() + 3 * 24 * 60 * 60 * 1000;

  const request = gov.requestRageQuit('quitter', proposal.id);
  const treasuryBefore = gov.getStats().treasuryBalance;

  const result = gov.processRageQuit(request.id);

  assert(result.burned > BigInt(0), 'Should burn stake');
  assert(result.claimed > BigInt(0), 'Should claim treasury share');

  const treasuryAfter = gov.getStats().treasuryBalance;
  assert(treasuryAfter < treasuryBefore, 'Treasury should decrease');

  const stake = gov.getStake('quitter');
  assert(stake === null, 'Stake should be removed');
});

await test('Cancel rage quit request', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('undecided', BigInt(2000) * BigInt(1e9));
  (gov as any).voterStakes.get('undecided').stakedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

  const proposal = gov.createProposal('proposer', {
    title: 'Cancel Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'rage_quit_window';

  const request = gov.requestRageQuit('undecided', proposal.id);
  const cancelled = gov.cancelRageQuit(request.id, 'undecided');

  assert(cancelled === true, 'Should cancel successfully');

  const requests = gov.getRageQuitRequests('undecided');
  assert(requests[0].status === 'cancelled', 'Status should be cancelled');
});

await test('Rage quit cooldown prevents immediate re-staking', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('quitter', BigInt(2000) * BigInt(1e9));
  (gov as any).voterStakes.get('quitter').stakedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

  const proposal = gov.createProposal('proposer', {
    title: 'Cooldown Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'rage_quit_window';
  (proposal as any).gracePeriodEndsAt = Date.now() + 3 * 24 * 60 * 60 * 1000;

  const request = gov.requestRageQuit('quitter', proposal.id);
  gov.processRageQuit(request.id);

  // Try to rage quit again on a new proposal
  gov.registerStake('quitter', BigInt(2000) * BigInt(1e9));
  (gov as any).voterStakes.get('quitter').stakedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

  const proposal2 = gov.createProposal('proposer', {
    title: 'Second Proposal',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal2 as any).status = 'rage_quit_window';

  try {
    gov.requestRageQuit('quitter', proposal2.id);
    assert(false, 'Should throw due to cooldown');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('cooldown'), 'Should mention cooldown');
  }
});

// ============================================================================
// Voting Tests
// ============================================================================

console.log('\n6. Unified Voting');

await test('Cast simple vote', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(1000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Simple Vote',
    description: 'Test',
    type: 'test',
    votingMode: 'simple',
    actions: [],
  });
  (proposal as any).status = 'active';

  const result = gov.vote(proposal.id, 'voter', 'for', 'I support this');

  assert(result.success === true, 'Vote should succeed');
  assert(result.votingPower === BigInt(1000) * BigInt(1e9), 'Voting power should match stake');

  const updated = gov.getProposal(proposal.id)!;
  assert(updated.votesFor === BigInt(1000) * BigInt(1e9), 'Votes for should be tallied');
  assert(updated.voterCount === 1, 'Voter count should be 1');
});

await test('Cast conviction vote', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(1000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Conviction Vote',
    description: 'Test',
    type: 'test',
    votingMode: 'conviction',
    actions: [],
  });
  (proposal as any).status = 'active';

  const result = gov.vote(proposal.id, 'voter', 'for');

  assert(result.success === true, 'Vote should succeed');
  assert(result.conviction !== undefined, 'Should have conviction value');
});

await test('Cannot vote without stake', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'No Stake Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  try {
    gov.vote(proposal.id, 'no-stake', 'for');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('No stake'), 'Should mention no stake');
  }
});

await test('Cannot vote on inactive proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(1000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Not Active',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  // Leave as pending, don't activate

  // Move voting period to the past
  (proposal as any).votingStartsAt = Date.now() - 100000;
  (proposal as any).votingEndsAt = Date.now() - 50000;

  try {
    gov.vote(proposal.id, 'voter', 'for');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Cannot vote'), 'Should mention cannot vote');
  }
});

// ============================================================================
// Proposal Lifecycle Tests
// ============================================================================

console.log('\n7. Proposal Lifecycle');

await test('Finalize passed proposal enters rage quit window', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Finalize Test',
    description: 'Test',
    type: 'test',
    votingMode: 'simple',
    actions: [],
  });
  (proposal as any).status = 'active';
  (proposal as any).votingEndsAt = Date.now() - 1000; // Ended

  gov.vote(proposal.id, 'voter', 'for');

  const finalized = gov.finalizeProposal(proposal.id);

  assert(finalized.status === 'rage_quit_window', 'Should enter rage quit window');
  assert(finalized.gracePeriodEndsAt !== undefined, 'Should have grace period end');
});

await test('Finalize rejected proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Reject Test',
    description: 'Test',
    type: 'test',
    votingMode: 'simple',
    actions: [],
  });
  (proposal as any).status = 'active';
  (proposal as any).votingEndsAt = Date.now() - 1000;

  gov.vote(proposal.id, 'voter', 'against');

  const finalized = gov.finalizeProposal(proposal.id);

  assert(finalized.status === 'rejected', 'Should be rejected');
});

await test('Execute passed proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Execute Test',
    description: 'Test',
    type: 'test',
    votingMode: 'simple',
    rageQuitEligible: false,
    actions: [
      { target: 'registry', function: 'approve', params: { serverId: 'test-server' } },
    ],
  });
  (proposal as any).status = 'active';
  (proposal as any).votingEndsAt = Date.now() - 1000;

  gov.vote(proposal.id, 'voter', 'for');
  gov.finalizeProposal(proposal.id);

  const result = gov.execute(proposal.id);

  assert(result.success === true, 'Execution should succeed');
  assert(result.results.length === 1, 'Should have 1 action result');

  const executed = gov.getProposal(proposal.id)!;
  assert(executed.status === 'executed', 'Status should be executed');
  assert(executed.executedAt !== undefined, 'Should have execution timestamp');
});

await test('Cannot execute during grace period', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Grace Period Test',
    description: 'Test',
    type: 'test',
    votingMode: 'simple',
    actions: [],
  });
  (proposal as any).status = 'active';
  (proposal as any).votingEndsAt = Date.now() - 1000;

  gov.vote(proposal.id, 'voter', 'for');
  gov.finalizeProposal(proposal.id);

  try {
    gov.execute(proposal.id);
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Grace period'), 'Should mention grace period');
  }
});

// ============================================================================
// Query Tests
// ============================================================================

console.log('\n8. Query Functions');

await test('Get active proposals', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));

  gov.createProposal('proposer', { title: 'Active 1', description: 'Test', type: 'test', actions: [] });
  gov.createProposal('proposer', { title: 'Active 2', description: 'Test', type: 'test', actions: [] });

  const active = gov.getActiveProposals();

  assert(active.length === 2, 'Should have 2 active proposals');
});

await test('Get governance statistics', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry);

  gov.registerStake('proposer', BigInt(5000) * BigInt(1e9));
  gov.registerStake('voter', BigInt(3000) * BigInt(1e9));

  gov.createProposal('proposer', { title: 'Stats Test', description: 'Test', type: 'test', actions: [] });

  const stats = gov.getStats();

  assert(stats.totalProposals === 1, 'Should have 1 proposal');
  assert(stats.activeProposals === 1, 'Should have 1 active proposal');
  assert(stats.totalStaked === BigInt(8000) * BigInt(1e9), 'Should have total staked');
  assert(stats.treasuryBalance > BigInt(0), 'Should have treasury balance');
});

// ============================================================================
// Configuration Tests
// ============================================================================

console.log('\n9. Configuration');

await test('Default rage quit config is valid', () => {
  assert(DEFAULT_RAGE_QUIT_CONFIG.gracePeriodMs > 0, 'Grace period should be positive');
  assert(DEFAULT_RAGE_QUIT_CONFIG.minStakeDurationMs > 0, 'Min stake duration should be positive');
  assert(DEFAULT_RAGE_QUIT_CONFIG.maxClaimPercentage <= 100, 'Max claim should be <= 100%');
});

await test('Default holographic config is valid', () => {
  assert(DEFAULT_HOLOGRAPHIC_CONFIG.boostStakeRequired > BigInt(0), 'Boost stake should be positive');
  assert(DEFAULT_HOLOGRAPHIC_CONFIG.boostedQuorumPercent < DEFAULT_HOLOGRAPHIC_CONFIG.regularQuorumPercent,
    'Boosted quorum should be less than regular');
  assert(DEFAULT_HOLOGRAPHIC_CONFIG.autoBoostConfidenceThreshold > 0.5, 'Auto-boost threshold should be > 50%');
});

await test('Custom config is applied', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry, {
    defaultVotingMode: 'quadratic',
    proposalThreshold: BigInt(500) * BigInt(1e9),
  });

  gov.registerStake('proposer', BigInt(600) * BigInt(1e9)); // Just above threshold

  const proposal = gov.createProposal('proposer', {
    title: 'Custom Config',
    description: 'Test',
    type: 'test',
    actions: [],
  });

  assert(proposal.votingMode === 'quadratic', 'Should use custom default voting mode');
});

await test('Disabled features throw errors', () => {
  const registry = new UnifiedMCPRegistry();
  const gov = new AdvancedGovernance(registry, {
    enableHolographic: false,
    enableRageQuit: false,
  });

  gov.registerStake('proposer', BigInt(10000) * BigInt(1e9));

  const proposal = gov.createProposal('proposer', {
    title: 'Disabled Test',
    description: 'Test',
    type: 'test',
    actions: [],
  });
  (proposal as any).status = 'active';

  try {
    gov.boostProposal(proposal.id, 'proposer', 'pass');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('not enabled'), 'Should mention not enabled');
  }
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All advanced governance tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
