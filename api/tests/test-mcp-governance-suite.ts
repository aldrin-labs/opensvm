#!/usr/bin/env bun
/**
 * MCP Governance Suite Tests
 *
 * Tests all 53 MCP tools across 4 categories
 */

import { handleToolCall, TOOLS } from '../src/mcp-governance-suite.js';

// ============================================================================
// Test Utilities
// ============================================================================

const results: { name: string; passed: boolean; error?: string }[] = [];
let currentSection = '';

function section(name: string) {
  currentSection = name;
  console.log(`\n${name}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
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
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toHaveProperty(prop: string) {
      if (typeof actual !== 'object' || actual === null || !(prop in actual)) {
        throw new Error(`Expected object to have property ${prop}`);
      }
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

console.log('MCP Governance Suite Tests');
console.log('==========================');

await (async () => {

section('0. Tool Count');

await test('Has 54 tools defined', async () => {
  expect(TOOLS.length).toBe(54);
});

section('1. Social & Reputation Tools');

await test('archive_debate', async () => {
  const result = await handleToolCall('archive_debate', {
    debateId: 'test-debate-1',
    proposalId: 'prop-1',
    agents: ['agent-1', 'agent-2'],
    outcome: 'support',
  });
  expect(result).toHaveProperty('success');
});

await test('create_fan_club', async () => {
  const result = await handleToolCall('create_fan_club', {
    agentId: 'test-agent-1',
    rewardRate: 0.1,
  }) as { agentId: string };
  expect(result.agentId).toBe('test-agent-1');
});

await test('join_fan_club', async () => {
  const result = await handleToolCall('join_fan_club', {
    agentId: 'test-agent-1',
    address: 'user-1',
    stakeAmount: 1000,
  }) as { stakedAmount: number };
  expect(result.stakedAmount).toBe(1000);
});

await test('get_fan_club_leaderboard', async () => {
  const result = await handleToolCall('get_fan_club_leaderboard', {}) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

await test('record_prediction', async () => {
  const result = await handleToolCall('record_prediction', {
    agentId: 'agent-1',
    proposalId: 'prop-1',
    prediction: 'support',
    confidence: 0.8,
  }) as { agentId: string };
  expect(result.agentId).toBe('agent-1');
});

await test('follow_agent', async () => {
  const result = await handleToolCall('follow_agent', {
    followerAddress: 'user-1',
    agentId: 'agent-1',
  });
  expect(result).toHaveProperty('success');
});

await test('get_influencer_leaderboard', async () => {
  const result = await handleToolCall('get_influencer_leaderboard', { limit: 10 }) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

await test('create_passport', async () => {
  const result = await handleToolCall('create_passport', {
    agentId: 'passport-agent-1',
  }) as { agentId: string };
  expect(result.agentId).toBe('passport-agent-1');
});

await test('add_dao_credential', async () => {
  const result = await handleToolCall('add_dao_credential', {
    agentId: 'passport-agent-1',
    daoId: 'uniswap',
    daoName: 'Uniswap',
    role: 'delegate',
    participationRate: 0.8,
  }) as { daoId: string };
  expect(result.daoId).toBe('uniswap');
});

await test('get_passport', async () => {
  const result = await handleToolCall('get_passport', {
    agentId: 'passport-agent-1',
  }) as { agentId: string };
  expect(result.agentId).toBe('passport-agent-1');
});

section('2. Agent Evolution Tools');

await test('create_agent_dna', async () => {
  const result = await handleToolCall('create_agent_dna', {
    agentId: 'dna-agent-1',
    traitCodes: ['AGR', 'TEC', 'DAT'],
  }) as { agentId: string };
  expect(result.agentId).toBe('dna-agent-1');
});

await test('get_agent_dna', async () => {
  const result = await handleToolCall('get_agent_dna', {
    agentId: 'dna-agent-1',
  }) as { sequence: string };
  expect(result.sequence).toBe('AGR-TEC-DAT');
});

await test('mutate_agent_dna', async () => {
  const result = await handleToolCall('mutate_agent_dna', {
    agentId: 'dna-agent-1',
  });
  expect(result).toHaveProperty('mutated');
});

await test('create second agent for crossover', async () => {
  await handleToolCall('create_agent_dna', {
    agentId: 'dna-agent-2',
    traitCodes: ['CAU', 'ECO', 'NAR'],
  });
  expect(true).toBe(true);
});

await test('crossover_agents', async () => {
  const result = await handleToolCall('crossover_agents', {
    parent1Id: 'dna-agent-1',
    parent2Id: 'dna-agent-2',
    childId: 'dna-child-1',
  }) as { agentId: string };
  expect(result.agentId).toBe('dna-child-1');
});

await test('calculate_genetic_similarity', async () => {
  const result = await handleToolCall('calculate_genetic_similarity', {
    agent1Id: 'dna-agent-1',
    agent2Id: 'dna-agent-2',
  }) as { similarity: number };
  expect(typeof result.similarity).toBe('number');
});

await test('start_agent_dream', async () => {
  const result = await handleToolCall('start_agent_dream', {
    agentId: 'dream-agent-1',
    scenarioType: 'hypothetical',
    description: 'Test scenario',
    participants: ['dream-agent-1'],
  }) as { id: string };
  expect(result.id).toBeTruthy();
});

await test('run_dream_cycle', async () => {
  const result = await handleToolCall('run_dream_cycle', {
    agentId: 'dream-agent-2',
    includeNightmare: true,
    includeWishFulfillment: true,
  }) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

await test('contribute_memory', async () => {
  const result = await handleToolCall('contribute_memory', {
    agentId: 'collective-agent-1',
    pattern: 'Conservative positions win in bear markets',
    context: ['market', 'governance'],
    confidence: 0.8,
  }) as { pattern: string };
  expect(result.pattern).toBeTruthy();
});

await test('query_collective', async () => {
  const result = await handleToolCall('query_collective', {
    context: ['market', 'governance'],
    limit: 5,
  }) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

await test('activate_archetype', async () => {
  const result = await handleToolCall('activate_archetype', {
    context: ['exploit', 'attack', 'emergency'],
  }) as { name: string } | null;
  expect(result).toBeTruthy();
});

await test('sync_with_collective', async () => {
  const result = await handleToolCall('sync_with_collective', {
    agentId: 'sync-agent-1',
  });
  expect(result).toHaveProperty('memoriesAbsorbed');
});

section('3. Novel Voting Tools');

await test('create_futarchy_proposal', async () => {
  const result = await handleToolCall('create_futarchy_proposal', {
    title: 'Test Proposal',
    description: 'A test futarchy proposal',
    proposer: 'proposer-1',
    targetMetric: 'TVL',
    baselineValue: 1000000,
  }) as { id: string };
  expect(result.id).toBeTruthy();
});

await test('trade_futarchy_market', async () => {
  // Create proposal first
  const proposal = await handleToolCall('create_futarchy_proposal', {
    title: 'Trade Test',
    description: 'Test',
    proposer: 'p',
    targetMetric: 'TVL',
    baselineValue: 1000000,
  }) as { id: string };

  const result = await handleToolCall('trade_futarchy_market', {
    proposalId: proposal.id,
    trader: 'trader-1',
    market: 'pass',
    amount: 100,
  }) as { executed: boolean };
  expect(result.executed).toBe(true);
});

await test('create_holographic_proposal', async () => {
  const result = await handleToolCall('create_holographic_proposal', {
    title: 'Holo Test',
    description: 'Test proposal',
    proposer: 'proposer-1',
  }) as { id: string };
  expect(result.id).toBeTruthy();
});

await test('boost_proposal', async () => {
  const proposal = await handleToolCall('create_holographic_proposal', {
    title: 'Boost Test',
    description: 'Test',
    proposer: 'p',
  }) as { id: string };

  const result = await handleToolCall('boost_proposal', {
    proposalId: proposal.id,
    booster: 'booster-1',
    amount: 500,
  }) as { success: boolean };
  expect(result.success).toBe(true);
});

await test('create_conviction_proposal', async () => {
  const result = await handleToolCall('create_conviction_proposal', {
    title: 'Conviction Test',
    description: 'Test proposal',
    proposer: 'proposer-1',
    requestedAmount: 10000,
    beneficiary: 'beneficiary-1',
  }) as { id: string };
  expect(result.id).toBeTruthy();
});

await test('add_conviction_support', async () => {
  const proposal = await handleToolCall('create_conviction_proposal', {
    title: 'Support Test',
    description: 'Test',
    proposer: 'p',
    requestedAmount: 5000,
    beneficiary: 'b',
  }) as { id: string };

  const result = await handleToolCall('add_conviction_support', {
    proposalId: proposal.id,
    supporter: 'supporter-1',
    amount: 1000,
  }) as { amount: number };
  expect(result.amount).toBe(1000);
});

await test('update_convictions', async () => {
  const result = await handleToolCall('update_convictions', {
    blockDelta: 10,
  });
  expect(result).toHaveProperty('success');
});

await test('create_retro_vote', async () => {
  const result = await handleToolCall('create_retro_vote', {
    originalProposalId: 'past-prop-1',
    originalOutcome: 'passed',
    actualImpact: 'positive',
    impactScore: 50,
  }) as { id: string };
  expect(result.id).toBeTruthy();
});

await test('cast_retro_vote', async () => {
  const retroVote = await handleToolCall('create_retro_vote', {
    originalProposalId: 'past-prop-2',
    originalOutcome: 'passed',
    actualImpact: 'positive',
    impactScore: 50,
  }) as { id: string };

  const result = await handleToolCall('cast_retro_vote', {
    retroVoteId: retroVote.id,
    voter: 'voter-1',
    vote: 'good',
    confidence: 0.8,
  });
  expect(result).toHaveProperty('success');
});

await test('calibrate_agent', async () => {
  const result = await handleToolCall('calibrate_agent', {
    agentId: 'calibrate-agent-1',
    proposalId: 'prop-1',
    predictedOutcome: 'support',
    confidence: 0.8,
    retroOutcome: 'good_decision',
  }) as { agentId: string };
  expect(result.agentId).toBe('calibrate-agent-1');
});

await test('get_calibration_leaderboard', async () => {
  const result = await handleToolCall('get_calibration_leaderboard', {}) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

await test('register_liquid_agent', async () => {
  const result = await handleToolCall('register_liquid_agent', {
    agentId: 'liquid-agent-1',
    name: 'Liquid Agent 1',
    votingPower: 1000,
  }) as { id: string };
  expect(result.id).toBe('liquid-agent-1');
});

await test('delegate_voting_power', async () => {
  await handleToolCall('register_liquid_agent', {
    agentId: 'liquid-agent-2',
    name: 'Liquid Agent 2',
    votingPower: 500,
  });

  const result = await handleToolCall('delegate_voting_power', {
    fromAgentId: 'liquid-agent-1',
    toAgentId: 'liquid-agent-2',
    weight: 0.5,
    transitive: true,
  }) as { weight: number };
  expect(result.weight).toBe(0.5);
});

await test('get_effective_power', async () => {
  const result = await handleToolCall('get_effective_power', {
    agentId: 'liquid-agent-2',
  }) as { effectivePower: number };
  expect(result.effectivePower).toBeGreaterThan(500);
});

section('4. Specialized Agent Tools');

await test('run_adversarial_analysis', async () => {
  const result = await handleToolCall('run_adversarial_analysis', {
    proposalId: 'adv-prop-1',
    title: 'Treasury Grant',
    description: 'Large treasury grant proposal',
    type: 'funding',
    requestedAmount: 100000,
    tvl: 10000000,
  }) as { overallSecurityScore: number };
  expect(typeof result.overallSecurityScore).toBe('number');
});

await test('find_precedents', async () => {
  const result = await handleToolCall('find_precedents', {
    title: 'Fee Switch Activation',
    description: 'Enable protocol fees',
    type: 'parameter',
    limit: 3,
  }) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

await test('analyze_whale_impact', async () => {
  const result = await handleToolCall('analyze_whale_impact', {
    proposalId: 'whale-prop-1',
    title: 'Gauge Rebalancing',
    type: 'gauge',
    tvl: 10000000,
    topHolders: [
      { address: '0x1', percentage: 15 },
      { address: '0x2', percentage: 10 },
    ],
  }) as { concentrationRisk: string };
  expect(result.concentrationRisk).toBeTruthy();
});

await test('analyze_exploit_vectors', async () => {
  const result = await handleToolCall('analyze_exploit_vectors', {
    proposalId: 'exploit-prop-1',
    title: 'Parameter Change',
    type: 'parameter',
    tvl: 5000000,
  }) as { overallRiskScore: number };
  expect(typeof result.overallRiskScore).toBe('number');
});

await test('list_specialized_agents', async () => {
  const result = await handleToolCall('list_specialized_agents', {}) as unknown[];
  expect(result.length).toBe(4);
});

await test('get_collective_stats', async () => {
  const result = await handleToolCall('get_collective_stats', {}) as { totalMemories: number };
  expect(typeof result.totalMemories).toBe('number');
});

await test('get_all_archetypes', async () => {
  const result = await handleToolCall('get_all_archetypes', {}) as unknown[];
  expect(result.length).toBeGreaterThan(0);
});

await test('get_liquid_power_leaderboard', async () => {
  const result = await handleToolCall('get_liquid_power_leaderboard', {}) as unknown[];
  expect(Array.isArray(result)).toBe(true);
});

})();

// ============================================================================
// Results
// ============================================================================

console.log('\n==========================');
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
  console.log('\n[PASS] All MCP governance suite tests passed!');
  process.exit(0);
}
