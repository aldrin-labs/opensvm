#!/usr/bin/env bun
/**
 * Governance Timelock System Tests
 */

import {
  TimelockController,
  getTimelockController,
  ActionType,
  ActionStatus,
} from '../src/governance-timelock.js';

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
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toContain(item: unknown) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
    toThrow(expectedMessage?: string) {
      if (typeof actual !== 'function') {
        throw new Error('Expected a function');
      }
      try {
        (actual as () => void)();
        throw new Error('Expected function to throw');
      } catch (error) {
        if (expectedMessage && error instanceof Error) {
          if (!error.message.includes(expectedMessage)) {
            throw new Error(`Expected error containing "${expectedMessage}", got "${error.message}"`);
          }
        }
      }
    },
  };
}

// ============================================================================
// Test Configuration
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const testConfig = {
  delays: {
    parameter_change: 100,    // Short for testing
    gauge_creation: 50,
    gauge_removal: 150,
    emission_change: 150,
    fee_change: 100,
    treasury_spend: 150,
    upgrade: 200,
    emergency: 25,
  },
  gracePeriod: 100,
  multiSig: {
    signers: ['signer1', 'signer2', 'signer3'],
    threshold: 2,
  },
  minDelay: 10,
  maxDelay: 1000,
};

// ============================================================================
// Tests
// ============================================================================

console.log('Governance Timelock System Tests');
console.log('============================================================');

// ----------------------------------------------------------------------------
section('1. Action Queueing');
// ----------------------------------------------------------------------------

test('Queue a basic action', () => {
  const controller = new TimelockController(testConfig);

  const action = controller.queueAction(
    'parameter_change',
    'protocol',
    { param: 'fee', value: 0.05 },
    'proposer1',
    'Change protocol fee to 5%'
  );

  expect(action.id).toBeTruthy();
  expect(action.status).toBe('queued');
  expect(action.actionType).toBe('parameter_change');
  expect(action.proposer).toBe('proposer1');
  expect(action.eta).toBeGreaterThan(action.queuedAt);
});

test('Action has correct delay based on type', () => {
  const controller = new TimelockController(testConfig);

  const action1 = controller.queueAction(
    'gauge_creation',
    'gauges',
    { poolId: 'POOL-1' },
    'proposer1',
    'Create gauge'
  );

  const action2 = controller.queueAction(
    'upgrade',
    'protocol',
    { version: '2.0' },
    'proposer1',
    'Upgrade protocol'
  );

  // Upgrade should have longer delay than gauge creation
  const delay1 = action1.eta - action1.queuedAt;
  const delay2 = action2.eta - action2.queuedAt;

  expect(delay2).toBeGreaterThan(delay1);
});

test('Queue batch actions', () => {
  const controller = new TimelockController(testConfig);

  const batch = controller.queueBatch([
    {
      actionType: 'parameter_change',
      target: 'protocol',
      data: { param: 'a', value: 1 },
      description: 'Change A',
    },
    {
      actionType: 'fee_change',
      target: 'protocol',
      data: { param: 'b', value: 2 },
      description: 'Change B',
    },
  ], 'proposer1');

  expect(batch.length).toBe(2);

  // All batch actions should have same ETA (longest delay)
  expect(batch[0].eta).toBe(batch[1].eta);
  expect(batch[0].batch).toBe(batch[1].batch);
});

// ----------------------------------------------------------------------------
section('2. Action Execution');
// ----------------------------------------------------------------------------

test('Cannot execute before timelock expires', () => {
  const controller = new TimelockController(testConfig);

  const action = controller.queueAction(
    'parameter_change',
    'protocol',
    { param: 'fee', value: 0.05 },
    'proposer1',
    'Change fee'
  );

  expect(() => controller.execute(action.id, 'executor1')).toThrow('Timelock not expired');
});

test('Execute action after timelock expires', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      parameter_change: 10, // 10ms delay
    },
  });

  const action = controller.queueAction(
    'parameter_change',
    'protocol',
    { param: 'fee', value: 0.05 },
    'proposer1',
    'Change fee'
  );

  // Wait for timelock
  await new Promise(resolve => setTimeout(resolve, 20));

  const executed = controller.execute(action.id, 'executor1');
  expect(executed.status).toBe('executed');
  expect(executed.executedBy).toBe('executor1');
});

test('Action expires after grace period', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      parameter_change: 5,
    },
    gracePeriod: 10,
  });

  const action = controller.queueAction(
    'parameter_change',
    'protocol',
    { param: 'fee', value: 0.05 },
    'proposer1',
    'Change fee'
  );

  // Wait past grace period
  await new Promise(resolve => setTimeout(resolve, 30));

  expect(() => controller.execute(action.id, 'executor1')).toThrow('expired');
});

test('Execute batch atomically', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      parameter_change: 5,
      fee_change: 5,
    },
  });

  const batch = controller.queueBatch([
    {
      actionType: 'parameter_change',
      target: 'protocol',
      data: { param: 'a' },
      description: 'A',
    },
    {
      actionType: 'fee_change',
      target: 'protocol',
      data: { param: 'b' },
      description: 'B',
    },
  ], 'proposer1');

  const batchId = batch[0].batch!;

  await new Promise(resolve => setTimeout(resolve, 15));

  const executed = controller.executeBatch(batchId, 'executor1');
  expect(executed.length).toBe(2);
  expect(executed[0].status).toBe('executed');
  expect(executed[1].status).toBe('executed');
});

// ----------------------------------------------------------------------------
section('3. Multi-Sig Operations');
// ----------------------------------------------------------------------------

test('Sign action for cancel', () => {
  const controller = new TimelockController(testConfig);

  const action = controller.queueAction(
    'treasury_spend',
    'treasury',
    { amount: 100000 },
    'proposer1',
    'Spend treasury'
  );

  const sig = controller.sign(action.id, 'signer1', 'cancel');
  expect(sig.action).toBe('cancel');
  expect(sig.signer).toBe('signer1');

  const sigs = controller.getSignatures(action.id, 'cancel');
  expect(sigs.length).toBe(1);
});

test('Cannot sign if not authorized', () => {
  const controller = new TimelockController(testConfig);

  const action = controller.queueAction(
    'treasury_spend',
    'treasury',
    { amount: 100000 },
    'proposer1',
    'Spend treasury'
  );

  expect(() => controller.sign(action.id, 'unauthorized', 'cancel'))
    .toThrow('Not authorized');
});

test('Cancel action when threshold reached', () => {
  const controller = new TimelockController(testConfig);

  const action = controller.queueAction(
    'treasury_spend',
    'treasury',
    { amount: 100000 },
    'proposer1',
    'Spend treasury'
  );

  controller.sign(action.id, 'signer1', 'cancel');
  controller.sign(action.id, 'signer2', 'cancel');

  const updated = controller.getAction(action.id);
  expect(updated?.status).toBe('cancelled');
});

test('Expedite action when threshold reached', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      treasury_spend: 500, // Long delay
    },
    minDelay: 5,
  });

  const action = controller.queueAction(
    'treasury_spend',
    'treasury',
    { amount: 100000 },
    'proposer1',
    'Spend treasury'
  );

  const originalEta = action.eta;

  controller.sign(action.id, 'signer1', 'expedite');
  controller.sign(action.id, 'signer2', 'expedite');

  const updated = controller.getAction(action.id);
  expect(updated?.eta).toBeLessThan(originalEta);
});

test('Cancel batch cancels all actions', () => {
  const controller = new TimelockController(testConfig);

  const batch = controller.queueBatch([
    {
      actionType: 'parameter_change',
      target: 'protocol',
      data: { param: 'a' },
      description: 'A',
    },
    {
      actionType: 'fee_change',
      target: 'protocol',
      data: { param: 'b' },
      description: 'B',
    },
  ], 'proposer1');

  // Cancel first action in batch
  controller.sign(batch[0].id, 'signer1', 'cancel');
  controller.sign(batch[0].id, 'signer2', 'cancel');

  // Both should be cancelled
  const action1 = controller.getAction(batch[0].id);
  const action2 = controller.getAction(batch[1].id);

  expect(action1?.status).toBe('cancelled');
  expect(action2?.status).toBe('cancelled');
});

// ----------------------------------------------------------------------------
section('4. Queries');
// ----------------------------------------------------------------------------

test('Get actions by status', () => {
  const controller = new TimelockController(testConfig);

  controller.queueAction('parameter_change', 'p1', {}, 'prop1', 'A');
  controller.queueAction('fee_change', 'p2', {}, 'prop1', 'B');

  const queued = controller.getActionsByStatus('queued');
  expect(queued.length).toBe(2);
});

test('Get ready actions', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      parameter_change: 5,
      fee_change: 100,
    },
  });

  controller.queueAction('parameter_change', 'p1', {}, 'prop1', 'Fast');
  controller.queueAction('fee_change', 'p2', {}, 'prop1', 'Slow');

  await new Promise(resolve => setTimeout(resolve, 15));

  const ready = controller.getReadyActions();
  expect(ready.length).toBe(1);
  expect(ready[0].actionType).toBe('parameter_change');
});

test('Get pending actions', () => {
  const controller = new TimelockController(testConfig);

  controller.queueAction('parameter_change', 'p1', {}, 'prop1', 'A');
  controller.queueAction('upgrade', 'p2', {}, 'prop1', 'B');

  const pending = controller.getPendingActions();
  expect(pending.length).toBe(2);
});

test('Check if action is ready', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      emergency: 5,
    },
  });

  const action = controller.queueAction('emergency', 'protocol', {}, 'prop1', 'Emergency');

  expect(controller.isReady(action.id)).toBe(false);

  await new Promise(resolve => setTimeout(resolve, 15));

  expect(controller.isReady(action.id)).toBe(true);
});

test('Get time until ready', () => {
  const controller = new TimelockController(testConfig);

  const action = controller.queueAction('parameter_change', 'protocol', {}, 'prop1', 'Test');

  const timeUntil = controller.getTimeUntilReady(action.id);
  expect(timeUntil).toBeGreaterThan(0);
});

// ----------------------------------------------------------------------------
section('5. Admin Functions');
// ----------------------------------------------------------------------------

test('Update multi-sig configuration', () => {
  const controller = new TimelockController(testConfig);

  controller.updateMultiSig(['newSigner1', 'newSigner2'], 1);

  const config = controller.getConfig();
  expect(config.multiSig.signers.length).toBe(2);
  expect(config.multiSig.threshold).toBe(1);
});

test('Cannot set threshold higher than signer count', () => {
  const controller = new TimelockController(testConfig);

  expect(() => controller.updateMultiSig(['signer1'], 5)).toThrow('exceed');
});

test('Update delay for action type', () => {
  const controller = new TimelockController(testConfig);

  controller.updateDelay('parameter_change', 500);

  const config = controller.getConfig();
  expect(config.delays.parameter_change).toBe(500);
});

test('Enforce min/max delay', () => {
  const controller = new TimelockController(testConfig);

  expect(() => controller.updateDelay('parameter_change', 1)).toThrow('at least');
  expect(() => controller.updateDelay('parameter_change', 10000)).toThrow('cannot exceed');
});

test('Expire stale actions', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      parameter_change: 5,
    },
    gracePeriod: 5,
  });

  controller.queueAction('parameter_change', 'p1', {}, 'prop1', 'Test');

  await new Promise(resolve => setTimeout(resolve, 20));

  const expired = controller.expireStale();
  expect(expired).toBe(1);

  const action = controller.getActionsByStatus('expired');
  expect(action.length).toBe(1);
});

// ----------------------------------------------------------------------------
section('6. Statistics');
// ----------------------------------------------------------------------------

test('Get timelock stats', async () => {
  const controller = new TimelockController({
    ...testConfig,
    delays: {
      ...testConfig.delays,
      parameter_change: 5,
    },
  });

  controller.queueAction('parameter_change', 'p1', {}, 'prop1', 'A');
  controller.queueAction('fee_change', 'p2', {}, 'prop1', 'B');

  await new Promise(resolve => setTimeout(resolve, 15));

  // Execute one
  controller.execute(controller.getReadyActions()[0].id, 'executor1');

  const stats = controller.getStats();
  expect(stats.totalActions).toBe(2);
  expect(stats.executedActions).toBe(1);
  expect(stats.queuedActions).toBe(1);
});

// ----------------------------------------------------------------------------
section('7. Singleton');
// ----------------------------------------------------------------------------

test('Singleton returns same instance', () => {
  const controller1 = getTimelockController();
  const controller2 = getTimelockController();
  expect(controller1).toBe(controller2);
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
  console.log('\n[SUCCESS] All governance timelock tests passed!');
  process.exit(0);
}
