#!/usr/bin/env bun
/**
 * Registry Tokenomics Integration Tests
 */

import { UnifiedMCPRegistry } from '../src/mcp-registry-unified.js';
import {
  RegistryTokenomics,
  SPONSOR_TIER_CONFIG,
  TOOL_CREDIT_COSTS,
  REVENUE_SPLIT,
} from '../src/mcp-registry-tokenomics.js';

console.log('Registry Tokenomics Tests');
console.log('='.repeat(50));

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
// Premium Listings Tests
// ============================================================================

console.log('\n1. Premium Listings');

test('Create bronze tier listing', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'bronze-test', name: 'bronze-test', displayName: 'Bronze Test', version: '1.0.0', description: 'Test' });

  const tokenomics = new RegistryTokenomics(registry);
  const listing = tokenomics.createPremiumListing(
    'bronze-test',
    'bronze',
    'wallet123',
    SPONSOR_TIER_CONFIG.bronze.minStake,
    '30d'
  );

  assert(listing.sponsorTier === 'bronze', 'Should be bronze tier');
  assert(listing.featured === false, 'Bronze should not be featured');
  assert(listing.verifiedAuthor === false, 'Bronze should not have verified badge');
});

test('Create platinum tier listing', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'plat-test', name: 'plat-test', displayName: 'Platinum Test', version: '1.0.0', description: 'Test' });

  const tokenomics = new RegistryTokenomics(registry);
  const listing = tokenomics.createPremiumListing(
    'plat-test',
    'platinum',
    'wallet123',
    SPONSOR_TIER_CONFIG.platinum.minStake,
    '365d'
  );

  assert(listing.sponsorTier === 'platinum', 'Should be platinum tier');
  assert(listing.featured === true, 'Platinum should be featured');
  assert(listing.verifiedAuthor === true, 'Platinum should have verified badge');
  assert(listing.benefits.apiRateBoost === 3.0, 'Platinum should have 3x rate boost');
});

test('Reject insufficient stake', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'low-stake', name: 'low-stake', displayName: 'Low Stake', version: '1.0.0', description: 'Test' });

  const tokenomics = new RegistryTokenomics(registry);

  try {
    tokenomics.createPremiumListing(
      'low-stake',
      'gold',
      'wallet123',
      BigInt(100) * BigInt(1e9), // Only 100 tokens, gold requires 25000
      '180d'
    );
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error && error.message.includes('Insufficient'), 'Should mention insufficient stake');
  }
});

test('Get featured servers sorted by tier', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 's1', name: 's1', displayName: 'Silver Server', version: '1.0.0', description: 'Test' });
  registry.register({ id: 's2', name: 's2', displayName: 'Gold Server', version: '1.0.0', description: 'Test' });

  const tokenomics = new RegistryTokenomics(registry);
  tokenomics.createPremiumListing('s1', 'silver', 'w1', SPONSOR_TIER_CONFIG.silver.minStake, '90d');
  tokenomics.createPremiumListing('s2', 'gold', 'w2', SPONSOR_TIER_CONFIG.gold.minStake, '180d');

  const featured = tokenomics.getFeaturedServers();
  assert(featured.length === 2, 'Should have 2 featured servers');
  assert(featured[0].id === 's2', 'Gold should come before silver');
});

// ============================================================================
// Access Control Tests
// ============================================================================

console.log('\n2. Access Control');

test('Free user can access free tools', () => {
  const registry = new UnifiedMCPRegistry();
  const tokenomics = new RegistryTokenomics(registry);

  const result = tokenomics.canAccessTool('get_network_status', 'free', 10);
  assert(result.allowed === true, 'Free user should access free tools');
  assert(result.creditCost === TOOL_CREDIT_COSTS['get_network_status'], 'Credit cost should match');
});

test('Free user cannot access pro tools', () => {
  const registry = new UnifiedMCPRegistry();
  const tokenomics = new RegistryTokenomics(registry);

  const result = tokenomics.canAccessTool('ask_ai', 'free', 100);
  assert(result.allowed === false, 'Free user should not access pro tools');
  assert(result.reason?.includes('pro'), 'Should mention required tier');
});

test('Pro user can access pro tools', () => {
  const registry = new UnifiedMCPRegistry();
  const tokenomics = new RegistryTokenomics(registry);

  const result = tokenomics.canAccessTool('ask_ai', 'pro', 100);
  assert(result.allowed === true, 'Pro user should access pro tools');
});

test('Insufficient credits rejected', () => {
  const registry = new UnifiedMCPRegistry();
  const tokenomics = new RegistryTokenomics(registry);

  const result = tokenomics.canAccessTool('ask_ai', 'pro', 5);  // AI costs 25 credits
  assert(result.allowed === false, 'Should reject insufficient credits');
  assert(result.reason?.includes('credits'), 'Should mention credits');
});

test('Enterprise has unlimited credits', () => {
  const registry = new UnifiedMCPRegistry();
  const tokenomics = new RegistryTokenomics(registry);

  const result = tokenomics.canAccessTool('ask_ai', 'enterprise', 0);  // 0 credits but enterprise
  assert(result.allowed === true, 'Enterprise should have unlimited credits');
});

// ============================================================================
// Revenue Tracking Tests
// ============================================================================

console.log('\n3. Revenue Tracking');

test('Record tool usage', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'rev-test', name: 'rev-test', displayName: 'Revenue Test', version: '1.0.0', description: 'Test' });
  registry.registerTools('rev-test', [
    { name: 'paid_tool', description: 'Paid tool', inputSchema: { type: 'object', properties: {} } },
  ]);

  const tokenomics = new RegistryTokenomics(registry);
  const tool = registry.findTool('paid_tool')!;

  tokenomics.recordToolUsage(tool, 'creator-wallet', 10);
  tokenomics.recordToolUsage(tool, 'creator-wallet', 10);

  const revenue = tokenomics.getToolRevenue('rev-test', 'paid_tool');
  assert(revenue !== null, 'Should have revenue record');
  assert(revenue!.totalCalls === 2, 'Should count 2 calls');
  assert(revenue!.pendingPayout > BigInt(0), 'Should have pending payout');
});

test('Get server revenue', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'srv-rev', name: 'srv-rev', displayName: 'Server Revenue', version: '1.0.0', description: 'Test' });
  registry.registerTools('srv-rev', [
    { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object', properties: {} } },
    { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object', properties: {} } },
  ]);

  const tokenomics = new RegistryTokenomics(registry);

  tokenomics.recordToolUsage(registry.findTool('srv-rev:tool1')!, 'wallet', 5);
  tokenomics.recordToolUsage(registry.findTool('srv-rev:tool2')!, 'wallet', 10);

  const serverRevenue = tokenomics.getServerRevenue('srv-rev');
  assert(serverRevenue.totalCalls === 2, 'Should have 2 total calls');
  assert(serverRevenue.tools.length === 2, 'Should have 2 tool records');
});

test('Process payout', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'payout-test', name: 'payout-test', displayName: 'Payout Test', version: '1.0.0', description: 'Test' });
  registry.registerTools('payout-test', [
    { name: 'payout_tool', description: 'Payout tool', inputSchema: { type: 'object', properties: {} } },
  ]);

  const tokenomics = new RegistryTokenomics(registry);
  const tool = registry.findTool('payout_tool')!;

  tokenomics.recordToolUsage(tool, 'wallet', 100);

  const beforeRevenue = tokenomics.getToolRevenue('payout-test', 'payout_tool');
  assert(beforeRevenue!.pendingPayout > BigInt(0), 'Should have pending before payout');

  const payout = tokenomics.processPayout('payout-test');
  assert(payout.amount > BigInt(0), 'Should have payout amount');
  assert(payout.toolsProcessed === 1, 'Should process 1 tool');

  const afterRevenue = tokenomics.getToolRevenue('payout-test', 'payout_tool');
  assert(afterRevenue!.pendingPayout === BigInt(0), 'Should have 0 pending after payout');
});

// ============================================================================
// Revenue Split Verification
// ============================================================================

console.log('\n4. Revenue Split');

test('Revenue split totals 100%', () => {
  const total = REVENUE_SPLIT.creator + REVENUE_SPLIT.platform + REVENUE_SPLIT.stakers;
  assert(total === 100, 'Revenue split should total 100%');
});

test('Creator gets 70%', () => {
  assert(REVENUE_SPLIT.creator === 70, 'Creator should get 70%');
});

// ============================================================================
// Statistics Tests
// ============================================================================

console.log('\n5. Statistics');

test('Get tokenomics stats', () => {
  const registry = new UnifiedMCPRegistry();
  registry.register({ id: 'stat-test', name: 'stat-test', displayName: 'Stat Test', version: '1.0.0', description: 'Test' });

  const tokenomics = new RegistryTokenomics(registry);
  tokenomics.createPremiumListing('stat-test', 'gold', 'wallet', SPONSOR_TIER_CONFIG.gold.minStake, '180d');

  const stats = tokenomics.getStats();
  assert(stats.premiumListings === 1, 'Should have 1 premium listing');
  assert(stats.featuredServers === 1, 'Should have 1 featured server');
  assert(stats.tierDistribution.gold === 1, 'Should have 1 gold tier');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n[SUCCESS] All registry tokenomics tests passed!');
} else {
  console.log(`\n[ERROR] ${failed} test(s) failed`);
  process.exit(1);
}
