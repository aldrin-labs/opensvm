/**
 * MCP Federation Proof-of-Work Trust Bootstrapping
 *
 * Sybil-resistant server registration through computational puzzles.
 * Servers earn $OMCP points for solving challenges, which can be used
 * to boost trust scores or unlock features.
 *
 * Features:
 * - Dynamic difficulty scaling based on network size
 * - $OMCP point rewards for puzzle completion
 * - Point staking for trust boost
 * - Leaderboard and mining statistics
 * - Anti-spam protection without capital requirements
 *
 * @module api/src/mcp-federation-pow
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface PowChallenge {
  id: string;
  serverId: string;
  difficulty: number;
  prefix: string;
  timestamp: number;
  expiresAt: number;
  target: string;             // Hash must be below this target
  reward: bigint;             // $OMCP points reward
  completed: boolean;
  solution?: string;
  completedAt?: number;
}

export interface PowSolution {
  challengeId: string;
  nonce: string;
  hash: string;
}

export interface OmcpAccount {
  serverId: string;
  owner: string;
  balance: bigint;
  totalEarned: bigint;
  totalStaked: bigint;
  challengesCompleted: number;
  lastChallengeAt: number;
  trustBoost: number;         // Additional trust from staked points
  createdAt: number;
}

export interface MiningStats {
  totalChallengesIssued: number;
  totalChallengesCompleted: number;
  totalPointsMined: bigint;
  currentDifficulty: number;
  networkHashrate: number;
  activeMiners: number;
  averageSolveTimeMs: number;
}

export interface LeaderboardEntry {
  serverId: string;
  serverName: string;
  totalMined: bigint;
  challengesCompleted: number;
  trustBoost: number;
  rank: number;
}

export interface PowConfig {
  // Difficulty
  baseDifficulty: number;             // Starting difficulty (leading zeros)
  maxDifficulty: number;              // Maximum difficulty
  difficultyScalingFactor: number;    // How much to scale per 100 servers
  targetSolveTimeMs: number;          // Target time to solve challenge

  // Rewards
  baseReward: bigint;                 // Base $OMCP reward
  rewardHalvingInterval: number;      // Halve rewards every N challenges
  maxRewardMultiplier: number;        // Max multiplier for difficulty

  // Trust
  pointsPerTrustPoint: bigint;        // Points needed for 1 trust boost
  maxTrustBoost: number;              // Maximum trust boost from staking

  // Rate limiting
  challengeCooldownMs: number;        // Min time between challenges
  maxPendingChallenges: number;       // Max pending challenges per server
  challengeExpiryMs: number;          // Time before challenge expires
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: PowConfig = {
  baseDifficulty: 4,                  // 4 leading zeros (easy start)
  maxDifficulty: 8,                   // 8 leading zeros max
  difficultyScalingFactor: 0.5,       // +0.5 difficulty per 100 servers
  targetSolveTimeMs: 30000,           // Target 30 seconds

  baseReward: 1000n,                  // 1000 $OMCP base reward
  rewardHalvingInterval: 10000,       // Halve every 10k challenges
  maxRewardMultiplier: 10,            // Up to 10x for high difficulty

  pointsPerTrustPoint: 10000n,        // 10k points = 1 trust boost
  maxTrustBoost: 30,                  // Max +30 trust from staking

  challengeCooldownMs: 60000,         // 1 minute between challenges
  maxPendingChallenges: 3,            // Max 3 pending per server
  challengeExpiryMs: 3600000,         // 1 hour to solve
};

// ============================================================================
// Proof-of-Work System
// ============================================================================

export class FederationPoW {
  private config: PowConfig;
  private challenges = new Map<string, PowChallenge>();
  private accounts = new Map<string, OmcpAccount>();
  private stats: MiningStats = {
    totalChallengesIssued: 0,
    totalChallengesCompleted: 0,
    totalPointsMined: 0n,
    currentDifficulty: 4,
    networkHashrate: 0,
    activeMiners: 0,
    averageSolveTimeMs: 30000,
  };
  private solveTimes: number[] = [];
  private networkServerCount = 0;

  constructor(config: Partial<PowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats.currentDifficulty = this.config.baseDifficulty;
  }

  // ==========================================================================
  // Challenge Management
  // ==========================================================================

  /**
   * Create a new PoW challenge for a server
   */
  createChallenge(serverId: string, owner: string): PowChallenge {
    // Check rate limit
    const account = this.accounts.get(serverId);
    if (account) {
      const timeSinceLastChallenge = Date.now() - account.lastChallengeAt;
      if (timeSinceLastChallenge < this.config.challengeCooldownMs) {
        throw new Error(
          `Rate limited. Wait ${Math.ceil((this.config.challengeCooldownMs - timeSinceLastChallenge) / 1000)}s`
        );
      }
    }

    // Check pending challenges
    const pending = this.getPendingChallenges(serverId);
    if (pending.length >= this.config.maxPendingChallenges) {
      throw new Error(`Maximum pending challenges (${this.config.maxPendingChallenges}) reached`);
    }

    // Calculate difficulty
    const difficulty = this.calculateDifficulty();

    // Generate challenge
    const prefix = randomBytes(16).toString('hex');
    const target = this.difficultyToTarget(difficulty);

    const challenge: PowChallenge = {
      id: `pow_${Date.now()}_${randomBytes(4).toString('hex')}`,
      serverId,
      difficulty,
      prefix,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.challengeExpiryMs,
      target,
      reward: this.calculateReward(difficulty),
      completed: false,
    };

    this.challenges.set(challenge.id, challenge);
    this.stats.totalChallengesIssued++;

    // Ensure account exists
    if (!this.accounts.has(serverId)) {
      this.accounts.set(serverId, {
        serverId,
        owner,
        balance: 0n,
        totalEarned: 0n,
        totalStaked: 0n,
        challengesCompleted: 0,
        lastChallengeAt: Date.now(),
        trustBoost: 0,
        createdAt: Date.now(),
      });
    }

    const acc = this.accounts.get(serverId)!;
    acc.lastChallengeAt = Date.now();

    console.log(`[PoW] Created challenge ${challenge.id} with difficulty ${difficulty}`);

    return challenge;
  }

  /**
   * Verify a challenge solution
   */
  verifySolution(solution: PowSolution): {
    valid: boolean;
    reward?: bigint;
    error?: string;
  } {
    const challenge = this.challenges.get(solution.challengeId);

    if (!challenge) {
      return { valid: false, error: 'Challenge not found' };
    }

    if (challenge.completed) {
      return { valid: false, error: 'Challenge already completed' };
    }

    if (Date.now() > challenge.expiresAt) {
      return { valid: false, error: 'Challenge expired' };
    }

    // Verify the hash
    const data = challenge.prefix + solution.nonce;
    const hash = createHash('sha256').update(data).digest('hex');

    if (hash !== solution.hash) {
      return { valid: false, error: 'Hash mismatch' };
    }

    // Check if hash meets difficulty target
    if (!this.hashMeetsTarget(hash, challenge.target)) {
      return {
        valid: false,
        error: `Hash does not meet difficulty. Got ${hash.slice(0, 8)}..., need < ${challenge.target.slice(0, 8)}...`,
      };
    }

    // Solution is valid!
    const solveTime = Date.now() - challenge.timestamp;
    this.recordSolveTime(solveTime);

    challenge.completed = true;
    challenge.solution = solution.nonce;
    challenge.completedAt = Date.now();

    // Credit reward
    const account = this.accounts.get(challenge.serverId);
    if (account) {
      account.balance += challenge.reward;
      account.totalEarned += challenge.reward;
      account.challengesCompleted++;
    }

    this.stats.totalChallengesCompleted++;
    this.stats.totalPointsMined += challenge.reward;

    console.log(`[PoW] Challenge ${challenge.id} solved! Reward: ${challenge.reward} $OMCP`);

    return {
      valid: true,
      reward: challenge.reward,
    };
  }

  /**
   * Get pending challenges for a server
   */
  getPendingChallenges(serverId: string): PowChallenge[] {
    const pending: PowChallenge[] = [];
    const now = Date.now();

    for (const challenge of this.challenges.values()) {
      if (
        challenge.serverId === serverId &&
        !challenge.completed &&
        challenge.expiresAt > now
      ) {
        pending.push(challenge);
      }
    }

    return pending;
  }

  /**
   * Get challenge by ID
   */
  getChallenge(challengeId: string): PowChallenge | null {
    return this.challenges.get(challengeId) || null;
  }

  // ==========================================================================
  // $OMCP Account Management
  // ==========================================================================

  /**
   * Get account balance and stats
   */
  getAccount(serverId: string): OmcpAccount | null {
    return this.accounts.get(serverId) || null;
  }

  /**
   * Stake points for trust boost
   */
  stakeForTrust(serverId: string, amount: bigint): {
    success: boolean;
    trustBoost: number;
    error?: string;
  } {
    const account = this.accounts.get(serverId);
    if (!account) {
      return { success: false, trustBoost: 0, error: 'Account not found' };
    }

    if (account.balance < amount) {
      return { success: false, trustBoost: 0, error: 'Insufficient balance' };
    }

    // Calculate trust boost
    const trustFromStake = Number(amount / this.config.pointsPerTrustPoint);
    const newTrustBoost = Math.min(
      this.config.maxTrustBoost,
      account.trustBoost + trustFromStake
    );

    const actualTrustGain = newTrustBoost - account.trustBoost;
    const actualCost = BigInt(actualTrustGain) * this.config.pointsPerTrustPoint;

    if (actualTrustGain <= 0) {
      return { success: false, trustBoost: account.trustBoost, error: 'Already at max trust boost' };
    }

    account.balance -= actualCost;
    account.totalStaked += actualCost;
    account.trustBoost = newTrustBoost;

    console.log(`[PoW] ${serverId} staked ${actualCost} $OMCP for +${actualTrustGain} trust`);

    return {
      success: true,
      trustBoost: newTrustBoost,
    };
  }

  /**
   * Get trust boost for a server
   */
  getTrustBoost(serverId: string): number {
    const account = this.accounts.get(serverId);
    return account?.trustBoost || 0;
  }

  // ==========================================================================
  // Mining Stats & Leaderboard
  // ==========================================================================

  /**
   * Get mining statistics
   */
  getStats(): MiningStats {
    // Calculate network hashrate from recent solve times
    if (this.solveTimes.length > 0) {
      const avgSolveTime = this.solveTimes.reduce((a, b) => a + b, 0) / this.solveTimes.length;
      this.stats.averageSolveTimeMs = avgSolveTime;

      // Estimate hashrate (very rough)
      const hashesPerSolve = Math.pow(16, this.stats.currentDifficulty);
      this.stats.networkHashrate = Math.round(hashesPerSolve / (avgSolveTime / 1000));
    }

    // Count active miners (activity in last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.stats.activeMiners = Array.from(this.accounts.values())
      .filter(a => a.lastChallengeAt > oneHourAgo)
      .length;

    return { ...this.stats };
  }

  /**
   * Get mining leaderboard
   */
  getLeaderboard(limit: number = 50): LeaderboardEntry[] {
    const entries = Array.from(this.accounts.values())
      .filter(a => a.totalEarned > 0n)
      .sort((a, b) => {
        const diff = b.totalEarned - a.totalEarned;
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      })
      .slice(0, limit)
      .map((a, i) => ({
        serverId: a.serverId,
        serverName: a.serverId, // Would be resolved from server registry
        totalMined: a.totalEarned,
        challengesCompleted: a.challengesCompleted,
        trustBoost: a.trustBoost,
        rank: i + 1,
      }));

    return entries;
  }

  /**
   * Set network server count for difficulty adjustment
   */
  setNetworkSize(serverCount: number): void {
    this.networkServerCount = serverCount;
    this.stats.currentDifficulty = this.calculateDifficulty();
  }

  // ==========================================================================
  // Challenge Helper Functions
  // ==========================================================================

  /**
   * Mine a challenge (helper for testing/demo)
   */
  mine(challenge: PowChallenge, maxAttempts: number = 1000000): PowSolution | null {
    const startTime = Date.now();

    for (let i = 0; i < maxAttempts; i++) {
      const nonce = randomBytes(16).toString('hex');
      const data = challenge.prefix + nonce;
      const hash = createHash('sha256').update(data).digest('hex');

      if (this.hashMeetsTarget(hash, challenge.target)) {
        console.log(`[PoW] Mined solution in ${Date.now() - startTime}ms, ${i + 1} attempts`);
        return {
          challengeId: challenge.id,
          nonce,
          hash,
        };
      }
    }

    return null;
  }

  /**
   * Calculate current difficulty
   */
  private calculateDifficulty(): number {
    // Base difficulty
    let difficulty = this.config.baseDifficulty;

    // Scale with network size
    const serverFactor = Math.floor(this.networkServerCount / 100) * this.config.difficultyScalingFactor;
    difficulty += serverFactor;

    // Adjust based on solve times
    if (this.solveTimes.length >= 10) {
      const avgSolveTime = this.solveTimes.slice(-10).reduce((a, b) => a + b, 0) / 10;

      if (avgSolveTime < this.config.targetSolveTimeMs * 0.5) {
        difficulty += 0.5; // Too fast, increase difficulty
      } else if (avgSolveTime > this.config.targetSolveTimeMs * 2) {
        difficulty -= 0.5; // Too slow, decrease difficulty
      }
    }

    // Clamp to bounds
    difficulty = Math.max(this.config.baseDifficulty, Math.min(this.config.maxDifficulty, difficulty));

    return Math.round(difficulty * 2) / 2; // Round to 0.5
  }

  /**
   * Calculate reward for difficulty
   */
  private calculateReward(difficulty: number): bigint {
    // Base reward with halving
    const halvings = Math.floor(this.stats.totalChallengesCompleted / this.config.rewardHalvingInterval);
    let reward = this.config.baseReward >> BigInt(halvings); // Divide by 2^halvings

    // Bonus for higher difficulty
    const difficultyMultiplier = Math.min(
      this.config.maxRewardMultiplier,
      1 + (difficulty - this.config.baseDifficulty)
    );
    reward = BigInt(Math.floor(Number(reward) * difficultyMultiplier));

    // Minimum reward of 1
    return reward > 0n ? reward : 1n;
  }

  /**
   * Convert difficulty to target hash
   */
  private difficultyToTarget(difficulty: number): string {
    // Target is a hex string that valid hashes must be below
    // difficulty = number of leading zeros in hex
    const leadingZeros = Math.floor(difficulty);
    const fractional = difficulty - leadingZeros;

    // First char after zeros depends on fractional difficulty
    const firstChar = Math.floor(16 * (1 - fractional)).toString(16);

    return '0'.repeat(leadingZeros) + firstChar + 'f'.repeat(63 - leadingZeros);
  }

  /**
   * Check if hash meets target
   */
  private hashMeetsTarget(hash: string, target: string): boolean {
    // Compare hex strings lexicographically
    return hash < target;
  }

  /**
   * Record solve time for difficulty adjustment
   */
  private recordSolveTime(timeMs: number): void {
    this.solveTimes.push(timeMs);
    if (this.solveTimes.length > 100) {
      this.solveTimes.shift(); // Keep last 100
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up expired challenges
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, challenge] of this.challenges) {
      if (!challenge.completed && challenge.expiresAt < now) {
        this.challenges.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[PoW] Cleaned up ${cleaned} expired challenges`);
    }

    return cleaned;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalPoW: FederationPoW | null = null;

export function getFederationPoW(): FederationPoW {
  if (!globalPoW) {
    globalPoW = new FederationPoW();
  }
  return globalPoW;
}

export function createFederationPoW(config?: Partial<PowConfig>): FederationPoW {
  globalPoW = new FederationPoW(config);
  return globalPoW;
}

// ============================================================================
// REST API Handler
// ============================================================================

export function createPowHandler(pow: FederationPoW) {
  return {
    /**
     * POST /pow/challenge - Create a new challenge
     */
    createChallenge: (serverId: string, owner: string) => {
      try {
        const challenge = pow.createChallenge(serverId, owner);
        return {
          success: true,
          challenge: {
            id: challenge.id,
            prefix: challenge.prefix,
            difficulty: challenge.difficulty,
            target: challenge.target,
            expiresAt: challenge.expiresAt,
            reward: challenge.reward.toString(),
          },
          instructions: `Find a nonce such that SHA256(prefix + nonce) < target`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * POST /pow/submit - Submit a solution
     */
    submitSolution: (solution: PowSolution) => {
      const result = pow.verifySolution(solution);
      return {
        ...result,
        reward: result.reward?.toString(),
      };
    },

    /**
     * GET /pow/account/:serverId - Get account info
     */
    getAccount: (serverId: string) => {
      const account = pow.getAccount(serverId);
      if (!account) {
        return { error: 'Account not found' };
      }
      return {
        serverId: account.serverId,
        balance: account.balance.toString(),
        totalEarned: account.totalEarned.toString(),
        totalStaked: account.totalStaked.toString(),
        challengesCompleted: account.challengesCompleted,
        trustBoost: account.trustBoost,
      };
    },

    /**
     * POST /pow/stake - Stake points for trust
     */
    stake: (serverId: string, amount: string) => {
      const result = pow.stakeForTrust(serverId, BigInt(amount));
      return result;
    },

    /**
     * GET /pow/stats - Get mining statistics
     */
    getStats: () => {
      const stats = pow.getStats();
      return {
        ...stats,
        totalPointsMined: stats.totalPointsMined.toString(),
      };
    },

    /**
     * GET /pow/leaderboard - Get leaderboard
     */
    getLeaderboard: (limit: number = 50) => {
      const entries = pow.getLeaderboard(limit);
      return entries.map(e => ({
        ...e,
        totalMined: e.totalMined.toString(),
      }));
    },

    /**
     * GET /pow/challenges/:serverId - Get pending challenges
     */
    getPendingChallenges: (serverId: string) => {
      const challenges = pow.getPendingChallenges(serverId);
      return challenges.map(c => ({
        id: c.id,
        difficulty: c.difficulty,
        expiresAt: c.expiresAt,
        reward: c.reward.toString(),
      }));
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  FederationPoW,
  getFederationPoW,
  createFederationPoW,
  createPowHandler,
};
