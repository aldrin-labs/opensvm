/**
 * MCP Federation PoW API
 *
 * Proof-of-Work challenges for server registration with $OMCP rewards.
 *
 * GET /api/mcp/federation/pow - Get mining stats and leaderboard
 * POST /api/mcp/federation/pow - Create challenge or submit solution
 *
 * @module app/api/mcp/federation/pow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory PoW state (use Qdrant in production)
interface Challenge {
  id: string;
  serverId: string;
  owner: string;
  difficulty: number;
  prefix: string;
  target: string;
  timestamp: number;
  expiresAt: number;
  reward: bigint;
  completed: boolean;
  solution?: string;
}

interface Account {
  serverId: string;
  owner: string;
  balance: bigint;
  totalEarned: bigint;
  totalStaked: bigint;
  challengesCompleted: number;
  lastChallengeAt: number;
  trustBoost: number;
}

const challenges = new Map<string, Challenge>();
const accounts = new Map<string, Account>();
let totalChallengesIssued = 0;
let totalChallengesCompleted = 0;
let totalPointsMined = 0n;
let networkServerCount = 0;

// Configuration
const CONFIG = {
  baseDifficulty: 4,
  maxDifficulty: 8,
  baseReward: 1000n,
  pointsPerTrustPoint: 10000n,
  maxTrustBoost: 30,
  challengeCooldownMs: 60000,
  challengeExpiryMs: 3600000,
  maxPendingChallenges: 3,
};

/**
 * GET /api/mcp/federation/pow
 *
 * Get PoW statistics and leaderboard
 *
 * Query params:
 * - action: 'stats' | 'leaderboard' | 'account' | 'challenges'
 * - serverId: Server ID for account/challenges lookup
 * - limit: Leaderboard limit
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';
    const serverId = searchParams.get('serverId');
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'stats':
        return NextResponse.json({
          totalChallengesIssued,
          totalChallengesCompleted,
          totalPointsMined: totalPointsMined.toString(),
          currentDifficulty: calculateDifficulty(),
          activeMiners: countActiveMiners(),
          networkServerCount,
        });

      case 'leaderboard':
        const entries = Array.from(accounts.values())
          .filter(a => a.totalEarned > 0n)
          .sort((a, b) => {
            const diff = b.totalEarned - a.totalEarned;
            return diff > 0n ? 1 : diff < 0n ? -1 : 0;
          })
          .slice(0, limit)
          .map((a, i) => ({
            rank: i + 1,
            serverId: a.serverId,
            totalMined: a.totalEarned.toString(),
            challengesCompleted: a.challengesCompleted,
            trustBoost: a.trustBoost,
          }));
        return NextResponse.json({ leaderboard: entries });

      case 'account':
        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }
        const account = accounts.get(serverId);
        if (!account) {
          return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
        return NextResponse.json({
          serverId: account.serverId,
          balance: account.balance.toString(),
          totalEarned: account.totalEarned.toString(),
          totalStaked: account.totalStaked.toString(),
          challengesCompleted: account.challengesCompleted,
          trustBoost: account.trustBoost,
          lastChallengeAt: account.lastChallengeAt,
        });

      case 'challenges':
        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }
        const pending = getPendingChallenges(serverId);
        return NextResponse.json({
          serverId,
          pending: pending.map(c => ({
            id: c.id,
            difficulty: c.difficulty,
            prefix: c.prefix,
            target: c.target,
            expiresAt: c.expiresAt,
            reward: c.reward.toString(),
          })),
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/federation/pow
 *
 * Create challenge, submit solution, or stake points
 *
 * Body:
 * - action: 'create' | 'submit' | 'stake' | 'mine' (demo)
 * - serverId: Server ID
 * - owner: Owner wallet (for create)
 * - challengeId: Challenge ID (for submit)
 * - nonce: Solution nonce (for submit)
 * - hash: Solution hash (for submit)
 * - amount: Stake amount (for stake)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, serverId, owner, challengeId, nonce, hash, amount } = body;

    switch (action) {
      case 'create':
        return handleCreateChallenge(serverId, owner);

      case 'submit':
        return handleSubmitSolution(challengeId, nonce, hash);

      case 'stake':
        return handleStake(serverId, amount);

      case 'mine':
        // Demo/test: Mine a challenge automatically
        return handleMine(challengeId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handler functions

function handleCreateChallenge(serverId: string, owner: string): NextResponse {
  if (!serverId || !owner) {
    return NextResponse.json(
      { error: 'Missing serverId or owner' },
      { status: 400 }
    );
  }

  // Check rate limit
  const account = accounts.get(serverId);
  if (account) {
    const timeSince = Date.now() - account.lastChallengeAt;
    if (timeSince < CONFIG.challengeCooldownMs) {
      return NextResponse.json({
        error: `Rate limited. Wait ${Math.ceil((CONFIG.challengeCooldownMs - timeSince) / 1000)}s`,
        retryAfter: Math.ceil((CONFIG.challengeCooldownMs - timeSince) / 1000),
      }, { status: 429 });
    }
  }

  // Check pending
  const pending = getPendingChallenges(serverId);
  if (pending.length >= CONFIG.maxPendingChallenges) {
    return NextResponse.json({
      error: `Maximum pending challenges (${CONFIG.maxPendingChallenges}) reached`,
      pending: pending.length,
    }, { status: 429 });
  }

  // Create challenge
  const difficulty = calculateDifficulty();
  const prefix = randomBytes(16).toString('hex');
  const target = difficultyToTarget(difficulty);
  const reward = calculateReward(difficulty);

  const challenge: Challenge = {
    id: `pow_${Date.now()}_${randomBytes(4).toString('hex')}`,
    serverId,
    owner,
    difficulty,
    prefix,
    target,
    timestamp: Date.now(),
    expiresAt: Date.now() + CONFIG.challengeExpiryMs,
    reward,
    completed: false,
  };

  challenges.set(challenge.id, challenge);
  totalChallengesIssued++;

  // Ensure account exists
  if (!accounts.has(serverId)) {
    accounts.set(serverId, {
      serverId,
      owner,
      balance: 0n,
      totalEarned: 0n,
      totalStaked: 0n,
      challengesCompleted: 0,
      lastChallengeAt: Date.now(),
      trustBoost: 0,
    });
  } else {
    accounts.get(serverId)!.lastChallengeAt = Date.now();
  }

  return NextResponse.json({
    success: true,
    challenge: {
      id: challenge.id,
      prefix: challenge.prefix,
      difficulty: challenge.difficulty,
      target: challenge.target,
      expiresAt: challenge.expiresAt,
      reward: challenge.reward.toString(),
    },
    instructions: 'Find nonce where SHA256(prefix + nonce) < target',
    example: `SHA256("${prefix}" + "your_nonce") must be < ${target.slice(0, 16)}...`,
  });
}

function handleSubmitSolution(challengeId: string, nonce: string, submittedHash: string): NextResponse {
  if (!challengeId || !nonce || !submittedHash) {
    return NextResponse.json(
      { error: 'Missing challengeId, nonce, or hash' },
      { status: 400 }
    );
  }

  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  if (challenge.completed) {
    return NextResponse.json({ error: 'Challenge already completed' }, { status: 400 });
  }

  if (Date.now() > challenge.expiresAt) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  // Verify hash
  const data = challenge.prefix + nonce;
  const expectedHash = createHash('sha256').update(data).digest('hex');

  if (expectedHash !== submittedHash) {
    return NextResponse.json({
      error: 'Hash mismatch',
      expected: expectedHash,
      received: submittedHash,
    }, { status: 400 });
  }

  // Check difficulty
  if (submittedHash >= challenge.target) {
    return NextResponse.json({
      error: 'Hash does not meet difficulty',
      yourHash: submittedHash.slice(0, 16) + '...',
      mustBe: '< ' + challenge.target.slice(0, 16) + '...',
    }, { status: 400 });
  }

  // Solution valid!
  challenge.completed = true;
  challenge.solution = nonce;

  // Credit reward
  const account = accounts.get(challenge.serverId);
  if (account) {
    account.balance += challenge.reward;
    account.totalEarned += challenge.reward;
    account.challengesCompleted++;
  }

  totalChallengesCompleted++;
  totalPointsMined += challenge.reward;

  return NextResponse.json({
    success: true,
    reward: challenge.reward.toString(),
    newBalance: account?.balance.toString() || '0',
    message: `Congratulations! You earned ${challenge.reward} $OMCP points!`,
  });
}

function handleStake(serverId: string, amountStr: string): NextResponse {
  if (!serverId || !amountStr) {
    return NextResponse.json(
      { error: 'Missing serverId or amount' },
      { status: 400 }
    );
  }

  const account = accounts.get(serverId);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const amount = BigInt(amountStr);
  if (account.balance < amount) {
    return NextResponse.json({
      error: 'Insufficient balance',
      balance: account.balance.toString(),
      requested: amount.toString(),
    }, { status: 400 });
  }

  // Calculate trust boost
  const trustFromStake = Number(amount / CONFIG.pointsPerTrustPoint);
  const newTrustBoost = Math.min(CONFIG.maxTrustBoost, account.trustBoost + trustFromStake);
  const actualGain = newTrustBoost - account.trustBoost;

  if (actualGain <= 0) {
    return NextResponse.json({
      error: 'Already at maximum trust boost',
      currentBoost: account.trustBoost,
      maxBoost: CONFIG.maxTrustBoost,
    }, { status: 400 });
  }

  const actualCost = BigInt(actualGain) * CONFIG.pointsPerTrustPoint;

  account.balance -= actualCost;
  account.totalStaked += actualCost;
  account.trustBoost = newTrustBoost;

  return NextResponse.json({
    success: true,
    trustBoostGained: actualGain,
    totalTrustBoost: newTrustBoost,
    pointsSpent: actualCost.toString(),
    newBalance: account.balance.toString(),
  });
}

function handleMine(challengeId: string): NextResponse {
  if (!challengeId) {
    return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });
  }

  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  if (challenge.completed) {
    return NextResponse.json({ error: 'Challenge already completed' }, { status: 400 });
  }

  // Mine (for demo - limited attempts)
  const maxAttempts = 100000;
  const startTime = Date.now();

  for (let i = 0; i < maxAttempts; i++) {
    const nonce = randomBytes(16).toString('hex');
    const data = challenge.prefix + nonce;
    const hash = createHash('sha256').update(data).digest('hex');

    if (hash < challenge.target) {
      // Found!
      const duration = Date.now() - startTime;

      // Submit the solution
      challenge.completed = true;
      challenge.solution = nonce;

      const account = accounts.get(challenge.serverId);
      if (account) {
        account.balance += challenge.reward;
        account.totalEarned += challenge.reward;
        account.challengesCompleted++;
      }

      totalChallengesCompleted++;
      totalPointsMined += challenge.reward;

      return NextResponse.json({
        success: true,
        solution: {
          nonce,
          hash,
        },
        attempts: i + 1,
        durationMs: duration,
        reward: challenge.reward.toString(),
        newBalance: account?.balance.toString() || '0',
      });
    }
  }

  return NextResponse.json({
    success: false,
    error: `Could not solve in ${maxAttempts} attempts`,
    suggestion: 'Try running more attempts or wait for an easier challenge',
  });
}

// Helper functions

function calculateDifficulty(): number {
  let diff = CONFIG.baseDifficulty;
  diff += Math.floor(networkServerCount / 100) * 0.5;
  return Math.min(CONFIG.maxDifficulty, Math.round(diff * 2) / 2);
}

function calculateReward(difficulty: number): bigint {
  const halvings = Math.floor(totalChallengesCompleted / 10000);
  let reward = CONFIG.baseReward >> BigInt(halvings);
  const multiplier = 1 + (difficulty - CONFIG.baseDifficulty);
  reward = BigInt(Math.floor(Number(reward) * Math.min(10, multiplier)));
  return reward > 0n ? reward : 1n;
}

function difficultyToTarget(difficulty: number): string {
  const zeros = Math.floor(difficulty);
  const frac = difficulty - zeros;
  const firstChar = Math.floor(16 * (1 - frac)).toString(16);
  return '0'.repeat(zeros) + firstChar + 'f'.repeat(63 - zeros);
}

function getPendingChallenges(serverId: string): Challenge[] {
  const now = Date.now();
  return Array.from(challenges.values()).filter(
    c => c.serverId === serverId && !c.completed && c.expiresAt > now
  );
}

function countActiveMiners(): number {
  const oneHourAgo = Date.now() - 3600000;
  return Array.from(accounts.values()).filter(a => a.lastChallengeAt > oneHourAgo).length;
}

// Cleanup expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (!challenge.completed && challenge.expiresAt < now) {
      challenges.delete(id);
    }
  }
}, 300000); // Every 5 minutes
