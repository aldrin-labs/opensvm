/**
 * SVMAI Governance Tests
 */

import { toTokenAmount, fromTokenAmount } from '../types';
import { createStake, getWalletStakes } from '../staking';
import {
  getVotingPower,
  delegate,
  undelegate,
  getDelegation,
  createProposal,
  getProposal,
  getAllProposals,
  castVote,
  hasVoted,
  getVoteReceipt,
  getGovernanceStats,
  PROPOSAL_TEMPLATES,
  DEFAULT_GOVERNANCE_CONFIG,
} from '../governance';

console.log('SVMAI Governance Tests');
console.log('======================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`   ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ ${name}`);
    console.log(`      Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Setup: Create stakes for voting power
const testWallet1 = 'wallet-gov-1';
const testWallet2 = 'wallet-gov-2';
const testWallet3 = 'wallet-gov-3';

// Create stakes for voting power
createStake(testWallet1, toTokenAmount(2000), '90d'); // Enough to create proposals
createStake(testWallet2, toTokenAmount(500), '30d');
createStake(testWallet3, toTokenAmount(100), '7d');

// ============================================================================
// Voting Power Tests
// ============================================================================

console.log('1. Voting Power');

test('Get voting power from staked tokens', () => {
  const power = getVotingPower(testWallet1);
  assert(power > BigInt(0), 'Should have voting power');
});

test('Voting power includes staking multiplier', () => {
  const power1 = getVotingPower(testWallet1); // 90d = 1.5x
  const power2 = getVotingPower(testWallet3); // 7d = 1.0x
  // Wallet1 has 2000 * 1.5 = 3000 effective
  // Wallet3 has 100 * 1.0 = 100 effective
  assert(power1 > power2, 'Higher stake and multiplier should have more power');
});

// ============================================================================
// Delegation Tests
// ============================================================================

console.log('\n2. Delegation');

test('Delegate voting power', () => {
  delegate(testWallet3, testWallet1);
  const delegation = getDelegation(testWallet3);
  assert(delegation.delegatedTo === testWallet1, 'Should delegate to wallet1');
});

test('Get delegated power', () => {
  const delegation = getDelegation(testWallet1);
  assert(delegation.delegatedFrom.includes(testWallet3), 'Should receive delegation');
  assert(delegation.totalDelegatedPower > BigInt(0), 'Should have delegated power');
});

test('Cannot delegate to self', () => {
  try {
    delegate(testWallet1, testWallet1);
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error, 'Should throw error');
  }
});

test('Undelegate removes delegation', () => {
  undelegate(testWallet3);
  const delegation = getDelegation(testWallet3);
  assert(delegation.delegatedTo === undefined, 'Should have no delegation');
});

// ============================================================================
// Proposal Creation Tests
// ============================================================================

console.log('\n3. Proposal Creation');

let proposalId: string;

test('Create proposal with sufficient voting power', () => {
  const proposal = createProposal(testWallet1, {
    title: 'Test Proposal',
    description: 'A test proposal for governance',
    type: 'parameter',
    actions: [{
      target: 'tokenomics',
      function: 'setParameter',
      params: { key: 'test', value: 123 },
    }],
  });

  proposalId = proposal.id;
  assert(proposal.id.startsWith('SVMAI-'), 'Should have valid ID');
  assert(proposal.status === 'pending', 'Should start as pending');
  assert(proposal.proposer === testWallet1, 'Should have correct proposer');
});

test('Cannot create proposal with insufficient voting power', () => {
  try {
    createProposal(testWallet3, {
      title: 'Should Fail',
      description: 'Not enough voting power',
      type: 'text',
      actions: [],
    });
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error, 'Should throw error');
    assert(error.message.includes('Insufficient'), 'Should mention insufficient power');
  }
});

test('Get proposal by ID', () => {
  const proposal = getProposal(proposalId);
  assert(proposal !== undefined, 'Should find proposal');
  assert(proposal!.title === 'Test Proposal', 'Should have correct title');
});

test('Get all proposals', () => {
  const proposals = getAllProposals();
  assert(proposals.length >= 1, 'Should have at least 1 proposal');
});

// ============================================================================
// Voting Tests
// ============================================================================

console.log('\n4. Voting');

// Create a new proposal for voting tests
let votingProposalId: string;

test('Create proposal for voting', () => {
  // Need to simulate proposal becoming active
  // For testing, we'll manually create and test
  const proposal = createProposal(testWallet1, {
    title: 'Voting Test Proposal',
    description: 'Test voting mechanics',
    type: 'text',
    actions: [],
  });
  votingProposalId = proposal.id;

  // Manually set to active for testing
  const p = getProposal(votingProposalId);
  if (p) {
    (p as any).status = 'active';
    (p as any).votingStartBlock = 0;
    (p as any).votingEndBlock = 999999999;
  }
});

test('Cast vote for proposal', () => {
  const vote = castVote(votingProposalId, testWallet2, true, 'I support this');
  assert(vote.support === true, 'Should be a for vote');
  assert(vote.votingPower > BigInt(0), 'Should have voting power');
});

test('Cannot vote twice', () => {
  try {
    castVote(votingProposalId, testWallet2, false);
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error, 'Should throw error');
    assert(error.message.includes('Already voted'), 'Should mention already voted');
  }
});

test('Check if wallet has voted', () => {
  assert(hasVoted(votingProposalId, testWallet2) === true, 'Should have voted');
  assert(hasVoted(votingProposalId, testWallet3) === false, 'Should not have voted');
});

test('Get vote receipt', () => {
  const receipt = getVoteReceipt(votingProposalId, testWallet2);
  assert(receipt !== undefined, 'Should have receipt');
  assert(receipt!.support === true, 'Should show support');
});

test('Vote tallies update correctly', () => {
  const proposal = getProposal(votingProposalId);
  assert(proposal!.votesFor > BigInt(0), 'Should have votes for');
});

// ============================================================================
// Proposal Templates Tests
// ============================================================================

console.log('\n5. Proposal Templates');

test('Parameter change template', () => {
  const template = PROPOSAL_TEMPLATES.parameterChange('tokenomics', 'maxRate', 100);
  assert(template.type === 'parameter', 'Should be parameter type');
  assert(template.actions.length === 1, 'Should have 1 action');
  assert(template.actions[0].function === 'setParameter', 'Should call setParameter');
});

test('Treasury spend template', () => {
  const template = PROPOSAL_TEMPLATES.treasurySpend('recipient', toTokenAmount(1000), 'Grant');
  assert(template.type === 'treasury', 'Should be treasury type');
  assert(template.actions[0].value !== undefined, 'Should have value');
});

test('Feature toggle template', () => {
  const template = PROPOSAL_TEMPLATES.featureToggle('quadraticVoting', true);
  assert(template.type === 'feature', 'Should be feature type');
  assert(template.actions[0].params.enabled === true, 'Should enable feature');
});

test('Emergency pause template', () => {
  const template = PROPOSAL_TEMPLATES.emergencyPause('staking');
  assert(template.type === 'emergency', 'Should be emergency type');
  assert(template.actions[0].function === 'pause', 'Should pause');
});

// ============================================================================
// Statistics Tests
// ============================================================================

console.log('\n6. Governance Statistics');

test('Get governance stats', () => {
  const stats = getGovernanceStats();
  assert(stats.totalProposals >= 2, 'Should count proposals');
  assert(stats.totalVotesCast >= 1, 'Should count votes');
  assert(stats.uniqueVoters >= 1, 'Should count unique voters');
});

// ============================================================================
// Configuration Tests
// ============================================================================

console.log('\n7. Configuration');

test('Default config has valid thresholds', () => {
  assert(DEFAULT_GOVERNANCE_CONFIG.proposalThreshold > 0, 'Should have proposal threshold');
  assert(DEFAULT_GOVERNANCE_CONFIG.quorumPercentage > 0, 'Should have quorum percentage');
  assert(DEFAULT_GOVERNANCE_CONFIG.quorumPercentage <= 100, 'Quorum should be <= 100%');
});

test('Voting periods are reasonable', () => {
  assert(DEFAULT_GOVERNANCE_CONFIG.votingDelayBlocks > 0, 'Should have voting delay');
  assert(DEFAULT_GOVERNANCE_CONFIG.votingPeriodBlocks > 0, 'Should have voting period');
  assert(DEFAULT_GOVERNANCE_CONFIG.timelockDelayBlocks > 0, 'Should have timelock delay');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n======================');
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n✅ All governance tests passed!');
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}
