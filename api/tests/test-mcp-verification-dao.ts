#!/usr/bin/env bun
/**
 * MCP Server Verification & DAO Governance Tests
 */

import { UnifiedMCPRegistry } from '../src/mcp-registry-unified.js';
import {
  ServerVerificationManager,
  getVerificationManager,
  VERIFICATION_CONFIG,
} from '../src/mcp-server-verification.js';
import {
  MCPRegistryDAO,
  DAO_CONFIG,
} from '../src/mcp-registry-dao.js';

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
console.log('MCP Verification & DAO Tests');
console.log('='.repeat(60));

// ============================================================================
// Server Verification Tests
// ============================================================================

console.log('\n1. Server Verification - Challenge Generation');

await test('Generate domain challenge', () => {
  const manager = new ServerVerificationManager();
  const challenge = manager.generateDomainChallenge('test-server', 'example.com');

  assert(challenge.type === 'domain', 'Should be domain type');
  assert(challenge.serverId === 'test-server', 'Should have correct server ID');
  assert(challenge.challenge.length > 0, 'Should have challenge string');
  assert(challenge.expiresAt > Date.now(), 'Should not be expired');
});

await test('Generate wallet challenge', () => {
  const manager = new ServerVerificationManager();
  const challenge = manager.generateWalletChallenge('test-server', 'wallet123');

  assert(challenge.type === 'wallet', 'Should be wallet type');
  assert(challenge.challenge.includes('test-server'), 'Message should include server ID');
  assert(challenge.challenge.includes('wallet123'), 'Message should include wallet');
});

await test('Generate code challenge', () => {
  const manager = new ServerVerificationManager();
  const challenge = manager.generateCodeChallenge('test-server', '@test/package', '1.0.0');

  assert(challenge.type === 'code', 'Should be code type');
  const data = JSON.parse(challenge.challenge);
  assert(data.packageId === '@test/package', 'Should have package ID');
  assert(data.version === '1.0.0', 'Should have version');
});

console.log('\n2. Server Verification - Domain Verification');

test('Verify domain (simulated)', async () => {
  const manager = new ServerVerificationManager();
  const challenge = manager.generateDomainChallenge('domain-test', 'test.com');

  const result = await manager.verifyDomain(challenge.id, 'test.com');
  assert(result.success === true, 'Should verify successfully');
  assert(result.verification?.status === 'verified', 'Should be verified status');
});

await test('Reject expired domain challenge', async () => {
  const manager = new ServerVerificationManager();
  const challenge = manager.generateDomainChallenge('expired-test', 'test.com');

  // Manually expire it (hack for testing)
  (challenge as any).expiresAt = Date.now() - 1000;

  const result = await manager.verifyDomain(challenge.id, 'test.com');
  assert(result.success === false, 'Should fail for expired challenge');
});

console.log('\n3. Server Verification - Badges & Levels');

test('Add verification badge', () => {
  const manager = new ServerVerificationManager();
  manager.generateDomainChallenge('badge-test', 'test.com');  // Initialize server

  // Manually add a badge
  (manager as any).addBadge('badge-test', {
    type: 'verified_author',
    grantedAt: Date.now(),
    grantedBy: 'system',
  });

  const verification = manager.getVerification('badge-test');
  assert(verification !== null, 'Should have verification');
  assert(verification!.badges.length === 1, 'Should have 1 badge');
  assert(verification!.badges[0].type === 'verified_author', 'Should be verified_author badge');
});

await test('Revoke verification', async () => {
  const manager = new ServerVerificationManager();
  const challenge = manager.generateDomainChallenge('revoke-test', 'test.com');

  // First verify the domain
  await manager.verifyDomain(challenge.id, 'test.com');

  // Then revoke
  const revoked = manager.revokeVerification('revoke-test', 'Testing revocation');
  assert(revoked === true, 'Should revoke successfully');

  const verification = manager.getVerification('revoke-test');
  assert(verification?.level === 'unverified', 'Level should be unverified after revoke');
});

await test('Get verification statistics', () => {
  const manager = new ServerVerificationManager();
  manager.generateDomainChallenge('stats-test-1', 'test1.com');
  manager.generateDomainChallenge('stats-test-2', 'test2.com');

  const stats = manager.getStats();
  assert(stats.pendingChallenges >= 2, 'Should have pending challenges');
  assert(typeof stats.byLevel === 'object', 'Should have level breakdown');
});

// ============================================================================
// DAO Governance Tests
// ============================================================================

console.log('\n4. DAO Governance - Voting Power');

test('Register voter with staking', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  const voter = dao.registerVoter('wallet1', BigInt(5000) * BigInt(1e9), '90d');

  assert(voter.wallet === 'wallet1', 'Should have correct wallet');
  assert(voter.multiplier === 1.5, '90d stake should have 1.5x multiplier');
  assert(voter.votingPower > BigInt(5000) * BigInt(1e9), 'Should have boosted voting power');
});

await test('Delegate voting power', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('delegator', BigInt(1000) * BigInt(1e9), '30d');
  dao.registerVoter('delegatee', BigInt(2000) * BigInt(1e9), '30d');

  dao.delegate('delegator', 'delegatee');

  const delegatee = dao.getVoter('delegatee');
  assert(delegatee!.delegatedPower > BigInt(0), 'Should have delegated power');
  assert(delegatee!.totalPower > delegatee!.votingPower, 'Total should exceed base power');
});

await test('Cannot delegate to self', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('self-delegate', BigInt(1000) * BigInt(1e9), '30d');

  try {
    dao.delegate('self-delegate', 'self-delegate');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('self'), 'Should mention self');
  }
});

console.log('\n5. DAO Governance - Proposals');

test('Create listing approval proposal', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'new-server', name: 'new-server', displayName: 'New Server', version: '1.0.0', description: 'Test' });

  const dao = new MCPRegistryDAO(registry);
  dao.registerVoter('proposer', BigInt(2000) * BigInt(1e9), '90d');

  const proposal = dao.createProposal('proposer', 'listing_approval', {
    title: 'Approve New Server',
    description: 'Approve new-server for listing',
    targetServerId: 'new-server',
  });

  assert(proposal.id.startsWith('MCP-DAO-'), 'Should have DAO proposal ID');
  assert(proposal.type === 'listing_approval', 'Should be listing_approval type');
  assert(proposal.status === 'pending', 'Should start as pending');
});

await test('Reject proposal with insufficient voting power', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('weak-proposer', BigInt(100) * BigInt(1e9), '7d');  // Only 100 tokens

  try {
    dao.createProposal('weak-proposer', 'listing_approval', {
      title: 'Should Fail',
      description: 'Not enough power',
    });
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Insufficient'), 'Should mention insufficient');
  }
});

console.log('\n6. DAO Governance - Voting');

test('Cast vote on proposal', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('proposer', BigInt(2000) * BigInt(1e9), '90d');
  dao.registerVoter('voter', BigInt(1000) * BigInt(1e9), '30d');

  const proposal = dao.createProposal('proposer', 'listing_approval', {
    title: 'Test Proposal',
    description: 'For voting test',
  });

  // Manually activate for testing
  (proposal as any).status = 'active';

  const vote = dao.vote(proposal.id, 'voter', 'for', 'I support this');

  assert(vote.support === 'for', 'Should be for vote');
  assert(vote.votingPower > BigInt(0), 'Should have voting power');

  const updatedProposal = dao.getProposal(proposal.id);
  assert(updatedProposal!.votesFor > BigInt(0), 'Should tally votes for');
  assert(updatedProposal!.voterCount === 1, 'Should count voter');
});

await test('Cannot vote twice', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('proposer', BigInt(2000) * BigInt(1e9), '90d');
  dao.registerVoter('double-voter', BigInt(1000) * BigInt(1e9), '30d');

  const proposal = dao.createProposal('proposer', 'listing_approval', {
    title: 'Double Vote Test',
    description: 'Test',
  });

  (proposal as any).status = 'active';

  dao.vote(proposal.id, 'double-voter', 'for');

  try {
    dao.vote(proposal.id, 'double-voter', 'against');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Already'), 'Should mention already voted');
  }
});

await test('Quadratic voting calculation', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('proposer', BigInt(2000) * BigInt(1e9), '90d');
  dao.registerVoter('big-holder', BigInt(10000) * BigInt(1e9), '90d');

  const proposal = dao.createProposal('proposer', 'listing_approval', {
    title: 'Quadratic Test',
    description: 'Test quadratic voting',
  });

  (proposal as any).status = 'active';

  const vote = dao.vote(proposal.id, 'big-holder', 'for');

  // Quadratic should be sqrt of voting power
  assert(vote.quadraticPower < vote.votingPower, 'Quadratic power should be less than raw power');
});

console.log('\n7. DAO Governance - Curation Rounds');

test('Start curation round', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  const round = dao.startCurationRound();

  assert(round.status === 'active', 'Should be active');
  assert(round.endTime > round.startTime, 'End should be after start');
});

await test('Vote in curation round', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'curate-server', name: 'curate-server', displayName: 'Curate Server', version: '1.0.0', description: 'Test' });

  const dao = new MCPRegistryDAO(registry);
  dao.registerVoter('curator', BigInt(5000) * BigInt(1e9), '90d');

  const round = dao.startCurationRound();

  dao.curateVote(round.id, 'curator', 'curate-server', BigInt(1000) * BigInt(1e9));

  const votes = round.servers.get('curate-server');
  assert(votes === BigInt(1000) * BigInt(1e9), 'Should have votes');
});

console.log('\n8. DAO Governance - Grant Programs');

test('Create grant program', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  const program = dao.createGrantProgram({
    name: 'Developer Grants Q1',
    description: 'Grants for MCP server developers',
    totalBudget: BigInt(100000) * BigInt(1e9),
    applicationDeadline: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });

  assert(program.status === 'open', 'Should be open');
  assert(program.remainingBudget === program.totalBudget, 'Should have full budget');
});

await test('Submit grant application', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  const program = dao.createGrantProgram({
    name: 'Test Grants',
    description: 'Test',
    totalBudget: BigInt(50000) * BigInt(1e9),
    applicationDeadline: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });

  const application = dao.submitGrantApplication(program.id, 'applicant-wallet', {
    title: 'Build NFT Analytics MCP Server',
    description: 'Create tools for NFT portfolio analysis',
    requestedAmount: BigInt(5000) * BigInt(1e9),
    milestones: [
      { description: 'Phase 1', amount: BigInt(2000) * BigInt(1e9), deadline: Date.now() + 60 * 24 * 60 * 60 * 1000 },
      { description: 'Phase 2', amount: BigInt(3000) * BigInt(1e9), deadline: Date.now() + 120 * 24 * 60 * 60 * 1000 },
    ],
  });

  assert(application.status === 'submitted', 'Should be submitted');
  assert(application.milestones.length === 2, 'Should have 2 milestones');
});

console.log('\n9. DAO Governance - Statistics');

test('Get DAO statistics', () => {
  const registry = new UnifiedMCPRegistry();
  const dao = new MCPRegistryDAO(registry);

  dao.registerVoter('stats-voter-1', BigInt(1000) * BigInt(1e9), '30d');
  dao.registerVoter('stats-voter-2', BigInt(2000) * BigInt(1e9), '90d');

  const stats = dao.getStats();

  assert(stats.totalVoters === 2, 'Should have 2 voters');
  assert(stats.totalVotingPower > BigInt(0), 'Should have voting power');
});

console.log('\n10. DAO Configuration');

test('DAO config has valid thresholds', () => {
  assert(DAO_CONFIG.proposalThreshold > BigInt(0), 'Should have proposal threshold');
  assert(DAO_CONFIG.quorumPercentage > 0, 'Should have quorum percentage');
  assert(DAO_CONFIG.quorumPercentage <= 100, 'Quorum should be <= 100%');
});

await test('Verification config has valid TTLs', () => {
  assert(VERIFICATION_CONFIG.challengeTtlMs > 0, 'Should have challenge TTL');
  assert(VERIFICATION_CONFIG.verificationTtlMs > VERIFICATION_CONFIG.challengeTtlMs, 'Verification TTL should be longer');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All verification & DAO tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

// Run all tests
runAllTests().catch(console.error);
