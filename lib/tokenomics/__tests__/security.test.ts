/**
 * SVMAI Security Module Tests
 */

import { toTokenAmount, fromTokenAmount } from '../types';
import { createStake } from '../staking';
import {
  // Anti-flash loan
  createVotingSnapshot,
  getSnapshotVotingPower,
  VotingSnapshot,

  // Stake locks
  MIN_STAKE_FOR_GOVERNANCE,
  RESTAKE_COOLDOWN,
  isStakeEligibleForGovernance,
  recordUnstake,
  canRestake,

  // Rate limiting
  checkRateLimit,
  RateLimitConfig,

  // Validation
  validateWalletAddress,
  validateTokenAmount,
  validateStakeDuration,
  validateProposalInput,
  validateStakeAmount,
  validateTreasurySpend,

  // Economic safeguards
  MAX_SINGLE_STAKE,
  MAX_VOTING_POWER_PERCENT,
  TREASURY_LIMITS,
  recordTreasurySpend,

  // Audit
  logAudit,
  getAuditLog,

  // Detection
  detectRapidStaking,
  getUnresolvedAlerts,
} from '../security';

console.log('SVMAI Security Tests');
console.log('====================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
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

// ============================================================================
// Anti-Flash Loan Protection Tests
// ============================================================================

console.log('1. Anti-Flash Loan Protection');

test('Create voting snapshot', () => {
  const walletBalances = new Map<string, bigint>();
  walletBalances.set('wallet1', toTokenAmount(1000));
  walletBalances.set('wallet2', toTokenAmount(2000));

  const snapshot = createVotingSnapshot(
    'PROP-001',
    12345,
    walletBalances,
    toTokenAmount(3000)
  );

  assert(snapshot.proposalId === 'PROP-001', 'Should have correct proposal ID');
  assert(snapshot.blockNumber === 12345, 'Should have correct block number');
  assert(snapshot.timestamp > 0, 'Should have timestamp');
});

test('Get voting power from snapshot', () => {
  const power = getSnapshotVotingPower('PROP-001', 'wallet1');
  assert(power === toTokenAmount(1000), 'Should return snapshot balance');
});

test('Get zero voting power for non-participant', () => {
  const power = getSnapshotVotingPower('PROP-001', 'wallet-not-in-snapshot');
  assert(power === BigInt(0), 'Should return 0 for non-participant');
});

test('Throw error for missing snapshot', () => {
  try {
    getSnapshotVotingPower('NON-EXISTENT', 'wallet1');
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('not found'), 'Should mention not found');
  }
});

// ============================================================================
// Stake Lock Validation Tests
// ============================================================================

console.log('\n2. Stake Lock Validation');

test('MIN_STAKE_FOR_GOVERNANCE is 7 days', () => {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  assert(MIN_STAKE_FOR_GOVERNANCE === sevenDays, 'Should be 7 days in ms');
});

test('Stake is eligible when created before proposal', () => {
  const now = Date.now();
  const stakeTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago
  const proposalTime = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

  assert(
    isStakeEligibleForGovernance(stakeTime, proposalTime) === true,
    'Stake created 10 days ago should be eligible'
  );
});

test('Stake is not eligible when created too recently', () => {
  const now = Date.now();
  const stakeTime = now - 5 * 24 * 60 * 60 * 1000; // 5 days ago
  const proposalTime = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

  assert(
    isStakeEligibleForGovernance(stakeTime, proposalTime) === false,
    'Stake created 5 days ago should NOT be eligible'
  );
});

test('RESTAKE_COOLDOWN is 24 hours', () => {
  const oneDay = 24 * 60 * 60 * 1000;
  assert(RESTAKE_COOLDOWN === oneDay, 'Should be 24 hours in ms');
});

test('Can restake after cooldown', () => {
  const testWallet = 'cooldown-test-wallet-1';
  // No prior unstake
  const result = canRestake(testWallet);
  assert(result.allowed === true, 'Should allow restake with no prior unstake');
});

test('Cannot restake immediately after unstake', () => {
  const testWallet = 'cooldown-test-wallet-2';
  recordUnstake(testWallet);

  const result = canRestake(testWallet);
  assert(result.allowed === false, 'Should not allow immediate restake');
  assert(result.waitTime !== undefined && result.waitTime > 0, 'Should have wait time');
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

console.log('\n3. Rate Limiting');

test('Allow requests within limit', () => {
  const result = checkRateLimit('rate-test-wallet-1', 'api:default');
  assert(result.allowed === true, 'Should allow request');
  assert(result.remaining > 0, 'Should have remaining requests');
});

test('Track request count', () => {
  const testWallet = 'rate-test-wallet-2';
  const first = checkRateLimit(testWallet, 'api:default');
  const second = checkRateLimit(testWallet, 'api:default');

  assert(second.remaining === first.remaining - 1, 'Should decrement remaining');
});

test('Block when limit exceeded', () => {
  const testWallet = 'rate-test-wallet-3';
  const config: RateLimitConfig = { windowMs: 60000, maxRequests: 2 };

  checkRateLimit(testWallet, 'test:custom', config);
  checkRateLimit(testWallet, 'test:custom', config);
  const third = checkRateLimit(testWallet, 'test:custom', config);

  assert(third.allowed === false, 'Should block after limit');
  assert(third.remaining === 0, 'Should have 0 remaining');
});

// ============================================================================
// Input Validation Tests
// ============================================================================

console.log('\n4. Input Validation');

test('Valid wallet address passes', () => {
  const result = validateWalletAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  assert(result.valid === true, 'Should be valid');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('Invalid wallet address fails', () => {
  const result = validateWalletAddress('too-short');
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have errors');
});

test('Empty wallet address fails', () => {
  const result = validateWalletAddress('');
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors[0].includes('required'), 'Should mention required');
});

test('Valid token amount passes', () => {
  const result = validateTokenAmount(toTokenAmount(100));
  assert(result.valid === true, 'Should be valid');
});

test('Negative token amount fails', () => {
  const result = validateTokenAmount(-100);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors[0].includes('negative'), 'Should mention negative');
});

test('Token amount with min/max options', () => {
  const result = validateTokenAmount(50, { min: 100, max: 1000 });
  assert(result.valid === false, 'Should fail min check');
  assert(result.errors[0].includes('at least'), 'Should mention minimum');
});

test('Valid stake duration passes', () => {
  const result = validateStakeDuration('90d');
  assert(result.valid === true, 'Should be valid');
});

test('Invalid stake duration fails', () => {
  const result = validateStakeDuration('45d');
  assert(result.valid === false, 'Should be invalid');
});

test('Valid proposal input passes', () => {
  const result = validateProposalInput({
    title: 'A valid proposal title that is long enough',
    description: 'This is a valid proposal description that meets the minimum length requirement of 50 characters.',
    type: 'parameter',
    actions: [{ target: 'test', function: 'test', params: {} }],
  });
  assert(result.valid === true, 'Should be valid');
});

test('Proposal with short title fails', () => {
  const result = validateProposalInput({
    title: 'Short',
    description: 'This is a valid description that meets the minimum length requirement of 50 characters for validation.',
    type: 'text',
    actions: [],
  });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors[0].includes('10 characters'), 'Should mention minimum title length');
});

// ============================================================================
// Economic Safeguard Tests
// ============================================================================

console.log('\n5. Economic Safeguards');

test('MAX_SINGLE_STAKE is 10M tokens', () => {
  assert(MAX_SINGLE_STAKE === toTokenAmount(10_000_000), 'Should be 10M');
});

test('MAX_VOTING_POWER_PERCENT is 10%', () => {
  assert(MAX_VOTING_POWER_PERCENT === 10, 'Should be 10%');
});

test('Validate stake amount within limits', () => {
  const result = validateStakeAmount(
    'new-staker-wallet',
    toTokenAmount(1000), // New stake
    toTokenAmount(1_000_000) // Total staked
  );
  assert(result.valid === true, 'Small stake should be valid');
});

test('Reject stake exceeding single stake limit', () => {
  const result = validateStakeAmount(
    'whale-wallet',
    toTokenAmount(15_000_000), // Exceeds 10M limit
    toTokenAmount(100_000_000)
  );
  assert(result.valid === false, 'Should reject large stake');
  assert(result.errors[0].includes('exceed'), 'Should mention exceeding limit');
});

test('Treasury spend limits are configured', () => {
  assert(TREASURY_LIMITS.singleSpendMax === toTokenAmount(1_000_000), 'Single spend max should be 1M');
  assert(TREASURY_LIMITS.monthlySpendMax === toTokenAmount(5_000_000), 'Monthly max should be 5M');
  assert(TREASURY_LIMITS.emergencyReserve === toTokenAmount(2_000_000), 'Emergency reserve should be 2M');
});

test('Valid treasury spend passes', () => {
  const result = validateTreasurySpend(
    toTokenAmount(500_000),
    toTokenAmount(10_000_000) // Large treasury balance
  );
  assert(result.valid === true, 'Should allow valid spend');
});

test('Treasury spend exceeding single limit fails', () => {
  const result = validateTreasurySpend(
    toTokenAmount(2_000_000), // Exceeds 1M single limit
    toTokenAmount(10_000_000)
  );
  assert(result.valid === false, 'Should reject excessive spend');
});

// ============================================================================
// Audit Logging Tests
// ============================================================================

console.log('\n6. Audit Logging');

test('Log audit entry', () => {
  const entry = logAudit({
    action: 'stake',
    wallet: 'audit-test-wallet',
    details: { amount: 1000, duration: '30d' },
    success: true,
  });

  assert(entry.id.startsWith('audit-'), 'Should have ID');
  assert(entry.timestamp > 0, 'Should have timestamp');
  assert(entry.action === 'stake', 'Should have correct action');
});

test('Get audit log with filters', () => {
  // Log a few entries
  logAudit({ action: 'stake', wallet: 'audit-wallet-1', details: {}, success: true });
  logAudit({ action: 'unstake', wallet: 'audit-wallet-1', details: {}, success: true });
  logAudit({ action: 'stake', wallet: 'audit-wallet-2', details: {}, success: false });

  const walletLogs = getAuditLog({ wallet: 'audit-wallet-1' });
  assert(walletLogs.length >= 2, 'Should filter by wallet');

  const actionLogs = getAuditLog({ action: 'stake' });
  assert(actionLogs.length >= 2, 'Should filter by action');

  const limitedLogs = getAuditLog({ limit: 1 });
  assert(limitedLogs.length === 1, 'Should respect limit');
});

// ============================================================================
// Suspicious Activity Detection Tests
// ============================================================================

console.log('\n7. Suspicious Activity Detection');

test('Detect rapid staking (normal activity)', () => {
  const alert = detectRapidStaking('normal-user-wallet');
  // First few stakes won't trigger alert
  assert(alert === null, 'Normal activity should not trigger alert');
});

test('Get unresolved alerts', () => {
  const alerts = getUnresolvedAlerts();
  assert(Array.isArray(alerts), 'Should return array');
});

test('Trigger rapid staking detection after many operations', () => {
  const testWallet = 'suspicious-wallet-test';

  // Log many stake operations to trigger detection
  for (let i = 0; i < 6; i++) {
    logAudit({
      action: 'stake',
      wallet: testWallet,
      details: { amount: 100 },
      success: true
    });
  }

  const alert = detectRapidStaking(testWallet);
  assert(alert !== null, 'Should detect rapid staking');
  assert(alert!.type === 'rapid_staking', 'Should be rapid_staking type');
  assert(alert!.severity === 'medium', 'Should be medium severity');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n====================');
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All security tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
