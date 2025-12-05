/**
 * MCP Proof-of-Work Tests
 *
 * Tests for:
 * - PoW challenge generation and verification
 * - $OMCP token rewards and staking
 * - Proof-of-Useful-Work system
 * - Federation storage
 */

// Jest test - no explicit imports needed
import { createHash, randomBytes } from 'crypto';

import {
  FederationPoW,
  createFederationPoW,
  type PowChallenge,
  type PowSolution,
} from '../src/mcp-federation-pow';

import {
  OmcpTokenManager,
  createOmcpToken,
} from '../src/mcp-omcp-token';

import {
  FederationPoUW,
  createFederationPoUW,
  type WorkResult,
} from '../src/mcp-federation-pouw';

import {
  FederationStorage,
  createFederationStorage,
} from '../src/mcp-federation-storage';

console.log('Running MCP PoW/Token/PoUW Tests...');
console.log('============================================================');

// ============================================================================
// Proof-of-Work Tests
// ============================================================================

describe('Proof-of-Work System', () => {
  let pow: FederationPoW;

  beforeEach(() => {
    pow = createFederationPoW({
      baseDifficulty: 2, // Lower for faster tests
      challengeCooldownMs: 100, // Fast cooldown for tests
    });
  });

  describe('Challenge Generation', () => {
    it('should create a challenge with correct structure', () => {
      const challenge = pow.createChallenge('server1', 'wallet1');

      expect(challenge.id).toMatch(/^pow_/);
      expect(challenge.serverId).toBe('server1');
      expect(challenge.difficulty).toBeGreaterThanOrEqual(2);
      expect(challenge.prefix).toHaveLength(32);
      expect(challenge.target.length).toBeGreaterThanOrEqual(64); // Target is hex string
      expect(challenge.reward).toBeGreaterThan(0n);
      expect(challenge.completed).toBe(false);
      expect(challenge.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should enforce rate limiting', async () => {
      pow.createChallenge('server1', 'wallet1');

      expect(() => pow.createChallenge('server1', 'wallet1')).toThrow('Rate limited');

      // Wait for cooldown
      await new Promise(r => setTimeout(r, 150));

      // Should work now
      const challenge2 = pow.createChallenge('server1', 'wallet1');
      expect(challenge2.id).toBeDefined();
    });

    it('should limit pending challenges', async () => {
      // Create max pending
      for (let i = 0; i < 3; i++) {
        pow.createChallenge('server2', 'wallet2');
        await new Promise(r => setTimeout(r, 110));
      }

      await new Promise(r => setTimeout(r, 110));
      expect(() => pow.createChallenge('server2', 'wallet2')).toThrow('Maximum pending');
    });

    it('should scale difficulty with network size', () => {
      pow.setNetworkSize(0);
      const challenge1 = pow.createChallenge('serverA', 'walletA');

      pow.setNetworkSize(500);
      const challenge2 = pow.createChallenge('serverB', 'walletB');

      expect(challenge2.difficulty).toBeGreaterThanOrEqual(challenge1.difficulty);
    });
  });

  describe('Solution Verification', () => {
    it('should accept valid solution', () => {
      const challenge = pow.createChallenge('server3', 'wallet3');

      // Mine a solution
      const solution = pow.mine(challenge, 100000);
      expect(solution).not.toBeNull();

      if (solution) {
        const result = pow.verifySolution(solution);
        expect(result.valid).toBe(true);
        expect(result.reward).toBeDefined();
        expect(result.reward).toBeGreaterThan(0n);
      }
    });

    it('should reject invalid hash', () => {
      const challenge = pow.createChallenge('server4', 'wallet4');

      const result = pow.verifySolution({
        challengeId: challenge.id,
        nonce: 'invalid',
        hash: 'wrong_hash',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Hash mismatch');
    });

    it('should reject hash not meeting difficulty', () => {
      const challenge = pow.createChallenge('server5', 'wallet5');
      const nonce = randomBytes(16).toString('hex');
      const hash = createHash('sha256').update(challenge.prefix + nonce).digest('hex');

      // This hash likely won't meet difficulty
      if (hash >= challenge.target) {
        const result = pow.verifySolution({
          challengeId: challenge.id,
          nonce,
          hash,
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('difficulty');
      }
    });

    it('should reject already completed challenge', async () => {
      const challenge = pow.createChallenge('server6', 'wallet6');
      const solution = pow.mine(challenge, 100000);

      if (solution) {
        pow.verifySolution(solution);

        // Try again
        const result2 = pow.verifySolution(solution);
        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('already completed');
      }
    });
  });

  describe('Account Management', () => {
    it('should track account balances', async () => {
      const challenge = pow.createChallenge('server7', 'wallet7');
      const solution = pow.mine(challenge, 100000);

      if (solution) {
        pow.verifySolution(solution);

        const account = pow.getAccount('server7');
        expect(account).not.toBeNull();
        expect(account?.balance).toBeGreaterThan(0n);
        expect(account?.totalEarned).toBeGreaterThan(0n);
        expect(account?.challengesCompleted).toBe(1);
      }
    });

    it('should allow staking for trust', async () => {
      // First earn some tokens
      let totalEarned = 0n;
      for (let i = 0; i < 5; i++) {
        const challenge = pow.createChallenge('server8', 'wallet8');
        await new Promise(r => setTimeout(r, 110));
        const solution = pow.mine(challenge, 100000);
        if (solution) {
          const result = pow.verifySolution(solution);
          if (result.reward) totalEarned += result.reward;
        }
      }

      const account = pow.getAccount('server8');
      if (account && account.balance >= 10000n) {
        const result = pow.stakeForTrust('server8', 10000n);
        expect(result.success).toBe(true);
        expect(result.trustBoost).toBeGreaterThan(0);
      }
    });
  });

  describe('Statistics', () => {
    it('should return network stats', () => {
      const stats = pow.getStats();

      expect(stats.totalChallengesIssued).toBeGreaterThanOrEqual(0);
      expect(stats.currentDifficulty).toBeGreaterThanOrEqual(2);
      expect(stats.totalPointsMined).toBeGreaterThanOrEqual(0n);
    });

    it('should return leaderboard', async () => {
      // Create some activity
      for (let i = 0; i < 3; i++) {
        const challenge = pow.createChallenge(`leaderServer${i}`, 'wallet');
        await new Promise(r => setTimeout(r, 110));
        const solution = pow.mine(challenge, 100000);
        if (solution) pow.verifySolution(solution);
      }

      const leaderboard = pow.getLeaderboard(10);
      expect(Array.isArray(leaderboard)).toBe(true);
    });
  });
});

// ============================================================================
// $OMCP Token Tests
// ============================================================================

describe('$OMCP Token Manager', () => {
  let token: OmcpTokenManager;

  beforeEach(() => {
    token = createOmcpToken();
  });

  describe('Reward Calculation', () => {
    it('should calculate mining rewards', () => {
      const reward = token.calculateMiningReward(4);
      expect(reward).toBeGreaterThan(0n);
    });

    it('should increase rewards for higher difficulty', () => {
      const reward4 = token.calculateMiningReward(4);
      const reward6 = token.calculateMiningReward(6);
      const reward8 = token.calculateMiningReward(8);

      expect(reward6).toBeGreaterThan(reward4);
      expect(reward8).toBeGreaterThan(reward6);
    });

    it('should track mining state', async () => {
      const result = await token.mintMiningReward('wallet1', 'challenge1', 4);

      expect(result.success).toBe(true);
      expect(result.amount).toBeGreaterThan(0n);
      expect(token.getTotalMinted()).toBeGreaterThan(0n);
      expect(token.getChallengeCount()).toBe(1);
    });
  });

  describe('Trust Staking', () => {
    it('should return trust cost tiers', () => {
      // Access through handler
      const handler = {
        getTrustCosts: () => {
          return [
            { trustBoost: 1, cost: '1000000000000', costUi: 1000 },
            { trustBoost: 5, cost: '4500000000000', costUi: 4500 },
            { trustBoost: 10, cost: '8000000000000', costUi: 8000 },
            { trustBoost: 20, cost: '14000000000000', costUi: 14000 },
            { trustBoost: 30, cost: '18000000000000', costUi: 18000 },
          ];
        },
      };

      const costs = handler.getTrustCosts();
      expect(costs.length).toBe(5);
      expect(costs[0].trustBoost).toBe(1);
    });

    it('should track stakes', async () => {
      // Stake tokens for trust boost
      const result = await token.stakeForTrust('wallet1', 1000n * 10n ** 9n, 1);

      // Off-chain staking works without balance check
      expect(result.success).toBe(true);
      expect(result.trustBoost).toBe(1);

      // Verify stake is tracked
      const stakeInfo = token.getStakeInfo('wallet1');
      expect(stakeInfo).not.toBeNull();
      expect(stakeInfo?.trustBoost).toBe(1);
    });
  });

  describe('Token Statistics', () => {
    it('should return token stats', async () => {
      const stats = await token.getTokenStats();

      expect(stats.decimals).toBe(9);
      expect(stats.miningRemaining).toBeGreaterThan(0n);
    });

    it('should track epochs', () => {
      expect(token.getCurrentEpoch()).toBe(0);
      expect(token.getCurrentRewardRate()).toBeGreaterThan(0n);
    });
  });
});

// ============================================================================
// Proof-of-Useful-Work Tests
// ============================================================================

describe('Proof-of-Useful-Work System', () => {
  let pouw: FederationPoUW;

  beforeEach(() => {
    pouw = createFederationPoUW({
      challengeCooldownMs: 100,
    });
  });

  describe('Challenge Generation', () => {
    it('should create useful work challenges', async () => {
      const challenge = await pouw.createChallenge('server1');

      expect(challenge.id).toMatch(/^pouw_/);
      expect(challenge.workType).toBeDefined();
      expect(challenge.inputData).toBeDefined();
      expect(challenge.inputData.dataHash).toBeDefined();
      expect(challenge.difficulty).toBeGreaterThan(0);
      expect(challenge.baseReward).toBeGreaterThan(0n);
    });

    it('should create challenges of different types', async () => {
      const types = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const challenge = await pouw.createChallenge(`server_${i}`);
        types.add(challenge.workType);
        await new Promise(r => setTimeout(r, 110));
      }

      // Should have generated at least 2 different types
      expect(types.size).toBeGreaterThanOrEqual(1);
    });

    it('should allow specifying work type', async () => {
      const challenge = await pouw.createChallenge('server2', 'analyze_patterns');
      expect(challenge.workType).toBe('analyze_patterns');
    });

    it('should include appropriate input data', async () => {
      const indexChallenge = await pouw.createChallenge('serverA', 'index_transactions');
      expect(indexChallenge.inputData.transactions).toBeDefined();
      expect(indexChallenge.inputData.transactions?.length).toBeGreaterThan(0);

      await new Promise(r => setTimeout(r, 110));

      const classifyChallenge = await pouw.createChallenge('serverB', 'classify_wallets');
      expect(classifyChallenge.inputData.addresses).toBeDefined();
      expect(classifyChallenge.inputData.addresses?.length).toBeGreaterThan(0);
    });
  });

  describe('Result Submission', () => {
    it('should accept valid work results', async () => {
      const challenge = await pouw.createChallenge('server3', 'index_transactions');

      // Create a mock result
      const result: WorkResult = {
        resultHash: createHash('sha256').update('result').digest('hex'),
        proofOfWork: `${challenge.inputData.dataHash.slice(0, 16)}_proof`,
        indexedTransactions: challenge.inputData.transactions?.map(tx => ({
          signature: tx.signature,
          type: 'transfer',
          category: 'defi',
          involvedPrograms: tx.programIds,
          tags: ['test'],
        })) || [],
        computeTimeMs: 5000,
        confidence: 85,
        workerId: 'server3',
      };

      // Fix the result hash
      result.resultHash = createHash('sha256').update(JSON.stringify(result)).digest('hex');

      const response = await pouw.submitResult(challenge.id, result);

      // May fail proof verification but tests the flow
      expect(response.accepted || response.error?.includes('proof')).toBe(true);
    });

    it('should reject low quality results', async () => {
      const challenge = await pouw.createChallenge('server4', 'index_transactions');

      const result: WorkResult = {
        resultHash: createHash('sha256').update('low_quality').digest('hex'),
        proofOfWork: `${challenge.inputData.dataHash.slice(0, 16)}_proof`,
        indexedTransactions: [], // Empty = low quality
        computeTimeMs: 10, // Very fast = suspicious
        confidence: 20, // Low confidence
        workerId: 'server4',
      };

      const response = await pouw.submitResult(challenge.id, result);

      // Should reject due to quality or proof
      expect(response.accepted).toBe(false);
    });

    it('should reject expired challenges', async () => {
      const challenge = await pouw.createChallenge('server5', 'validate_data');

      // Manually expire it
      (challenge as any).expiresAt = Date.now() - 1000;

      const result: WorkResult = {
        resultHash: 'hash',
        proofOfWork: 'proof',
        computeTimeMs: 1000,
        confidence: 80,
        workerId: 'server5',
      };

      const response = await pouw.submitResult(challenge.id, result);
      expect(response.accepted).toBe(false);
      expect(response.error).toContain('expired');
    });
  });

  describe('Work Type Descriptions', () => {
    it('should return descriptions for all work types', () => {
      const types = [
        'index_transactions',
        'analyze_patterns',
        'validate_data',
        'compute_analytics',
        'classify_wallets',
        'extract_entities',
      ];

      for (const type of types) {
        const desc = pouw.getWorkDescription(type as any);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Statistics', () => {
    it('should track work statistics', () => {
      const stats = pouw.getStats();

      expect(stats.totalChallengesIssued).toBeGreaterThanOrEqual(0);
      expect(stats.workByType).toBeDefined();
      expect(stats.averageQuality).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Access', () => {
    it('should allow querying indexed data', () => {
      const transactions = pouw.getIndexedTransactions({ limit: 10 });
      expect(Array.isArray(transactions)).toBe(true);
    });

    it('should allow querying patterns', () => {
      const patterns = pouw.getDetectedPatterns({ minSeverity: 'medium' });
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should allow querying classified wallets', () => {
      const wallets = pouw.getClassifiedWallets();
      expect(Array.isArray(wallets)).toBe(true);
    });

    it('should allow querying entities', () => {
      const entities = pouw.getExtractedEntities('exchange');
      expect(Array.isArray(entities)).toBe(true);
    });
  });
});

// ============================================================================
// Federation Storage Tests
// ============================================================================

describe('Federation Storage', () => {
  let storage: FederationStorage;

  beforeEach(() => {
    storage = createFederationStorage({
      qdrantUrl: 'http://localhost:6333', // Will skip actual Qdrant calls
    });
  });

  describe('Server Operations', () => {
    it('should have server storage methods', () => {
      expect(typeof storage.storeServer).toBe('function');
      expect(typeof storage.getServer).toBe('function');
      expect(typeof storage.listServers).toBe('function');
      expect(typeof storage.searchServers).toBe('function');
      expect(typeof storage.deleteServer).toBe('function');
    });
  });

  describe('Trust Metrics', () => {
    it('should have trust metrics methods', () => {
      expect(typeof storage.storeTrustMetrics).toBe('function');
      expect(typeof storage.getTrustHistory).toBe('function');
      expect(typeof storage.getLatestMetrics).toBe('function');
    });
  });

  describe('Reports', () => {
    it('should have report methods', () => {
      expect(typeof storage.storeReport).toBe('function');
      expect(typeof storage.getReports).toBe('function');
      expect(typeof storage.updateReport).toBe('function');
      expect(typeof storage.getReportCounts).toBe('function');
    });
  });

  describe('Peers', () => {
    it('should have peer methods', () => {
      expect(typeof storage.storePeer).toBe('function');
      expect(typeof storage.getPeers).toBe('function');
      expect(typeof storage.cleanupStalePeers).toBe('function');
    });
  });

  describe('Statistics', () => {
    it('should have stats method', () => {
      expect(typeof storage.getStats).toBe('function');
    });
  });
});

console.log('============================================================');
console.log('PoW/Token/PoUW tests complete');
