#!/usr/bin/env bun
/**
 * Oracle Network Tests
 */

import {
  OracleNetwork,
  OracleNode,
  ProofGenerator,
  SettlementEngine,
  getOracleNetwork,
  createOracleNode,
  MarketOutcome,
} from '../src/prediction-oracle-network.js';
import { PublicKey, Keypair } from '@solana/web3.js';

console.log('Oracle Network Tests');
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
// Proof Generator Tests
// ============================================================================

console.log('\n1. Proof Generator');

await test('Generate outcome hash', () => {
  const hash = ProofGenerator.generateHash(
    'KXBTC100K',
    'kalshi',
    'yes',
    1701792000000,
    '{"result":"yes"}'
  );

  assert(hash.length === 64, 'Hash should be 64 chars (SHA256 hex)');
  assert(/^[a-f0-9]+$/.test(hash), 'Hash should be hex');
});

await test('Hash is deterministic', () => {
  const hash1 = ProofGenerator.generateHash('MKT1', 'kalshi', 'yes', 1000, 'data');
  const hash2 = ProofGenerator.generateHash('MKT1', 'kalshi', 'yes', 1000, 'data');

  assert(hash1 === hash2, 'Same inputs should produce same hash');
});

await test('Different inputs produce different hashes', () => {
  const hash1 = ProofGenerator.generateHash('MKT1', 'kalshi', 'yes', 1000, 'data');
  const hash2 = ProofGenerator.generateHash('MKT1', 'kalshi', 'no', 1000, 'data');

  assert(hash1 !== hash2, 'Different outcomes should produce different hashes');
});

await test('Sign outcome', () => {
  const keypair = Keypair.generate();
  const hash = ProofGenerator.generateHash('TEST', 'kalshi', 'yes', Date.now(), '{}');

  const signature = ProofGenerator.signOutcome(hash, 'node-1', keypair);

  assert(signature.nodeId === 'node-1', 'Node ID should match');
  assert(signature.publicKey === keypair.publicKey.toBase58(), 'Public key should match');
  assert(signature.signature.length === 64, 'Signature should be 64 chars');
});

await test('Verify signature', () => {
  const keypair = Keypair.generate();
  const hash = ProofGenerator.generateHash('TEST', 'kalshi', 'yes', Date.now(), '{}');

  const signature = ProofGenerator.signOutcome(hash, 'node-1', keypair);
  const valid = ProofGenerator.verifySignature(hash, signature);

  assert(valid === true, 'Valid signature should verify');
});

await test('Create full proof', () => {
  const keypair1 = Keypair.generate();
  const keypair2 = Keypair.generate();
  const hash = ProofGenerator.generateHash('TEST', 'kalshi', 'yes', Date.now(), '{}');

  const signatures = [
    ProofGenerator.signOutcome(hash, 'node-1', keypair1),
    ProofGenerator.signOutcome(hash, 'node-2', keypair2),
  ];

  const proof = ProofGenerator.createProof(
    'TEST',
    'kalshi',
    'yes',
    '{}',
    signatures,
    2
  );

  assert(proof.hash.length === 64, 'Should have hash');
  assert(proof.nodeSignatures.length === 2, 'Should have 2 signatures');
  assert(proof.consensusReached === true, 'Consensus should be reached');
  assert(proof.requiredSignatures === 2, 'Required signatures should be 2');
});

// ============================================================================
// Oracle Node Tests
// ============================================================================

console.log('\n2. Oracle Node');

await test('Create oracle node', () => {
  const { node, keypair } = createOracleNode('oracle-1', 'Test Oracle', 10);

  assert(node.id === 'oracle-1', 'ID should match');
  assert(node.name === 'Test Oracle', 'Name should match');
  assert(node.stake === 10, 'Stake should be 10');
  assert(node.status === 'active', 'Status should be active');
  assert(node.reputation === 100, 'Reputation should be 100');
});

await test('Node can watch markets', () => {
  const { node: config } = createOracleNode('oracle-2', 'Watcher', 10);
  const node = new OracleNode(config);

  node.watchMarket('KXBTC100K', 'kalshi');
  node.watchMarket('test-id', 'manifold');

  // No error means success
  assert(true, 'Markets watched');
});

await test('Get node info (without private key)', () => {
  const { node: config } = createOracleNode('oracle-3', 'Info Test', 15);
  const node = new OracleNode(config);

  const info = node.getInfo();

  assert(info.id === 'oracle-3', 'ID should match');
  assert(info.privateKey === undefined, 'Private key should be hidden');
});

// ============================================================================
// Oracle Network Tests
// ============================================================================

console.log('\n3. Oracle Network');

await test('Create network with config', () => {
  const network = new OracleNetwork({
    minConsensusNodes: 3,
    consensusThreshold: 0.6,
    disputePeriodSeconds: 3600,
    minStake: 5,
  });

  const status = network.getStatus();
  assert(status.nodes === 0, 'Should have no nodes initially');
});

await test('Register oracle nodes', () => {
  const network = new OracleNetwork({ minStake: 5 });

  const { node: node1 } = createOracleNode('n1', 'Node 1', 10);
  const { node: node2 } = createOracleNode('n2', 'Node 2', 10);

  network.registerNode(node1);
  network.registerNode(node2);

  const status = network.getStatus();
  assert(status.nodes === 2, 'Should have 2 nodes');
});

await test('Enforce minimum stake', () => {
  const network = new OracleNetwork({ minStake: 10 });

  const { node } = createOracleNode('low-stake', 'Low Stake', 5);

  try {
    network.registerNode(node);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Minimum stake'), 'Should mention stake');
  }
});

await test('Remove oracle node', () => {
  const network = new OracleNetwork({ minStake: 5 });

  const { node } = createOracleNode('removable', 'Removable', 10);
  network.registerNode(node);

  assert(network.getStatus().nodes === 1, 'Should have 1 node');

  network.removeNode('removable');

  assert(network.getStatus().nodes === 0, 'Should have 0 nodes after removal');
});

await test('Watch market across all nodes', () => {
  const network = new OracleNetwork({ minStake: 5 });

  const { node: n1 } = createOracleNode('w1', 'Watcher 1', 10);
  const { node: n2 } = createOracleNode('w2', 'Watcher 2', 10);

  network.registerNode(n1);
  network.registerNode(n2);

  network.watchMarket('KXTEST', 'kalshi');

  // No error means success
  assert(true, 'Market watched on all nodes');
});

await test('Singleton network instance', () => {
  const network1 = getOracleNetwork({ minStake: 5 });
  const network2 = getOracleNetwork();

  assert(network1 === network2, 'Should return same instance');
});

// ============================================================================
// Consensus Tests
// ============================================================================

console.log('\n4. Consensus Mechanism');

await test('Consensus with sufficient signatures', () => {
  // This test simulates the internal consensus mechanism
  const proof = ProofGenerator.createProof(
    'TEST-CONSENSUS',
    'kalshi',
    'yes',
    '{}',
    [
      { nodeId: 'n1', signature: 'a'.repeat(64), publicKey: 'pk1' },
      { nodeId: 'n2', signature: 'b'.repeat(64), publicKey: 'pk2' },
      { nodeId: 'n3', signature: 'c'.repeat(64), publicKey: 'pk3' },
    ],
    3
  );

  assert(proof.consensusReached === true, 'Consensus should be reached with 3/3 signatures');
});

await test('No consensus with insufficient signatures', () => {
  const proof = ProofGenerator.createProof(
    'TEST-NO-CONSENSUS',
    'kalshi',
    'yes',
    '{}',
    [
      { nodeId: 'n1', signature: 'a'.repeat(64), publicKey: 'pk1' },
    ],
    3
  );

  assert(proof.consensusReached === false, 'Consensus should NOT be reached with 1/3 signatures');
});

// ============================================================================
// Dispute Tests
// ============================================================================

console.log('\n5. Dispute Mechanism');

await test('File dispute', () => {
  const network = new OracleNetwork({ minStake: 5 });

  // Manually add a resolved market
  const outcome: MarketOutcome = {
    marketId: 'DISPUTE-TEST',
    platform: 'kalshi',
    outcome: 'yes',
    resolvedAt: Date.now(),
    source: 'https://kalshi.com',
    rawData: '{}',
    proof: {
      hash: 'a'.repeat(64),
      timestamp: Date.now(),
      nodeSignatures: [],
      consensusReached: true,
      requiredSignatures: 1,
    },
  };

  // Simulate resolution (normally done via consensus)
  (network as any).resolvedMarkets.set('kalshi:DISPUTE-TEST', outcome);

  const dispute = network.fileDispute(
    'DISPUTE-TEST',
    'kalshi',
    'user123',
    'Evidence shows NO outcome',
    ['https://evidence.com/proof1']
  );

  assert(dispute.id.startsWith('DISPUTE-'), 'ID should have prefix');
  assert(dispute.status === 'open', 'Status should be open');
  assert(dispute.proposedOutcome === 'yes', 'Proposed outcome should match');
});

await test('Vote on dispute', () => {
  const network = new OracleNetwork({ minStake: 5, consensusThreshold: 0.5 });

  // Register nodes
  const { node: n1 } = createOracleNode('voter1', 'Voter 1', 10);
  const { node: n2 } = createOracleNode('voter2', 'Voter 2', 10);
  network.registerNode(n1);
  network.registerNode(n2);

  // Add resolved market
  (network as any).resolvedMarkets.set('kalshi:VOTE-TEST', {
    marketId: 'VOTE-TEST',
    platform: 'kalshi',
    outcome: 'yes',
    resolvedAt: Date.now(),
    source: '',
    rawData: '{}',
    proof: { hash: '', timestamp: 0, nodeSignatures: [], consensusReached: true, requiredSignatures: 1 },
  });

  // File dispute
  const dispute = network.fileDispute('VOTE-TEST', 'kalshi', 'user', 'Wrong', []);

  // Vote
  network.voteOnDispute(dispute.id, 'voter1', 'oppose');

  const disputes = (network as any).disputes;
  const updatedDispute = disputes.get(dispute.id);

  assert(updatedDispute.votes.length === 1, 'Should have 1 vote');
});

await test('Cannot vote twice', () => {
  const network = new OracleNetwork({ minStake: 5, consensusThreshold: 0.8 });

  // Need multiple nodes so first vote doesn't resolve
  const { node: n1 } = createOracleNode('double-voter', 'Double Voter', 10);
  const { node: n2 } = createOracleNode('other-voter', 'Other Voter', 10);
  const { node: n3 } = createOracleNode('third-voter', 'Third Voter', 10);
  network.registerNode(n1);
  network.registerNode(n2);
  network.registerNode(n3);

  (network as any).resolvedMarkets.set('kalshi:DOUBLE-VOTE', {
    marketId: 'DOUBLE-VOTE', platform: 'kalshi', outcome: 'yes', resolvedAt: Date.now(),
    source: '', rawData: '{}', proof: { hash: '', timestamp: 0, nodeSignatures: [], consensusReached: true, requiredSignatures: 1 },
  });

  const dispute = network.fileDispute('DOUBLE-VOTE', 'kalshi', 'user', 'Test', []);

  // First vote (won't resolve because we need 0.8 * 3 = 3 votes)
  network.voteOnDispute(dispute.id, 'double-voter', 'support');

  try {
    // Try to vote again with same node
    network.voteOnDispute(dispute.id, 'double-voter', 'oppose');
    assert(false, 'Should throw');
  } catch (e) {
    assert(e instanceof Error && e.message.includes('Already voted'), 'Should mention already voted');
  }
});

// ============================================================================
// Settlement Engine Tests
// ============================================================================

console.log('\n6. Settlement Engine');

await test('Queue settlement', () => {
  const network = new OracleNetwork({ minStake: 5 });
  const engine = new SettlementEngine(
    'https://api.mainnet-beta.solana.com',
    new PublicKey('PRED111111111111111111111111111111111111111'),
    network
  );

  const outcome: MarketOutcome = {
    marketId: 'SETTLE-TEST',
    platform: 'kalshi',
    outcome: 'yes',
    resolvedAt: Date.now(),
    source: '',
    rawData: '{}',
    proof: { hash: 'test', timestamp: Date.now(), nodeSignatures: [], consensusReached: true, requiredSignatures: 1 },
  };

  engine.queueSettlement(outcome);

  const pending = engine.getPendingSettlements();
  assert(pending.length === 1, 'Should have 1 pending settlement');
  assert(pending[0].marketId === 'SETTLE-TEST', 'Market ID should match');
});

await test('Execute settlement (simulated)', async () => {
  const network = new OracleNetwork({ minStake: 5 });
  const engine = new SettlementEngine(
    'https://api.mainnet-beta.solana.com',
    new PublicKey('PRED111111111111111111111111111111111111111'),
    network
  );

  const outcome: MarketOutcome = {
    marketId: 'EXEC-TEST',
    platform: 'manifold',
    outcome: 'no',
    resolvedAt: Date.now(),
    source: '',
    rawData: '{}',
    proof: { hash: 'exec', timestamp: Date.now(), nodeSignatures: [], consensusReached: true, requiredSignatures: 1 },
  };

  engine.queueSettlement(outcome);

  const keypair = Keypair.generate();
  const signature = await engine.executeSettlement('manifold', 'EXEC-TEST', keypair);

  assert(signature.startsWith('SIM-SETTLE-'), 'Should return simulated signature');
  assert(engine.getPendingSettlements().length === 0, 'Should have no pending after execution');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All oracle network tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
}

runAllTests().catch(console.error);
