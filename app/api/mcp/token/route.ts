/**
 * $OMCP Token API
 *
 * GET /api/mcp/token - Get token statistics and info
 * POST /api/mcp/token - Stake tokens, claim rewards
 *
 * @module app/api/mcp/token
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  emitChallengeCompleted,
  emitTokensStaked,
  emitEpochChange,
  emitHalvingApproaching,
  emitLeaderboardUpdate,
  miningEvents,
} from '../../../../api/src/mcp-mining-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Token configuration
const TOKEN_CONFIG = {
  name: 'OpenMCP Points',
  symbol: 'OMCP',
  decimals: 9,
  maxSupply: '1000000000000000000', // 1B with 9 decimals
  miningAllocation: '700000000000000000', // 700M
  treasuryAllocation: '200000000000000000', // 200M
  liquidityAllocation: '100000000000000000', // 100M
};

// Reward schedule
const REWARD_SCHEDULE = [
  { epoch: 0, challengeStart: 0, challengeEnd: 99999, reward: '1000000000000', rewardUi: 1000 },
  { epoch: 1, challengeStart: 100000, challengeEnd: 199999, reward: '500000000000', rewardUi: 500 },
  { epoch: 2, challengeStart: 200000, challengeEnd: 299999, reward: '250000000000', rewardUi: 250 },
  { epoch: 3, challengeStart: 300000, challengeEnd: 399999, reward: '125000000000', rewardUi: 125 },
  { epoch: 4, challengeStart: 400000, challengeEnd: 499999, reward: '62500000000', rewardUi: 62.5 },
  { epoch: 5, challengeStart: 500000, challengeEnd: 599999, reward: '31250000000', rewardUi: 31.25 },
];

// Trust costs
const TRUST_COSTS = [
  { trustBoost: 1, cost: '1000000000000', costUi: 1000 },
  { trustBoost: 5, cost: '4500000000000', costUi: 4500 },
  { trustBoost: 10, cost: '8000000000000', costUi: 8000 },
  { trustBoost: 20, cost: '14000000000000', costUi: 14000 },
  { trustBoost: 30, cost: '18000000000000', costUi: 18000 },
];

// In-memory state (use Qdrant in production)
interface Account {
  address: string;
  balance: bigint;
  totalEarned: bigint;
  totalStaked: bigint;
  trustBoost: number;
  challengesCompleted: number;
  lastActivity: number;
}

const accounts = new Map<string, Account>();
let totalMinted = 0n;
let totalBurned = 0n;
let challengeCount = 0;

/**
 * GET /api/mcp/token
 *
 * Query params:
 * - action: 'stats' | 'balance' | 'leaderboard' | 'rewards' | 'trust-costs'
 * - address: Wallet address (for balance)
 * - limit: Leaderboard limit
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';
    const address = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'stats':
        return NextResponse.json({
          token: TOKEN_CONFIG,
          supply: {
            total: TOKEN_CONFIG.maxSupply,
            minted: totalMinted.toString(),
            burned: totalBurned.toString(),
            circulating: (totalMinted - totalBurned).toString(),
            miningRemaining: (BigInt(TOKEN_CONFIG.miningAllocation) - totalMinted).toString(),
          },
          mining: {
            challengeCount,
            currentEpoch: Math.floor(challengeCount / 100000),
            currentReward: getCurrentReward(),
            nextHalving: getNextHalving(),
          },
          holders: accounts.size,
          timestamp: Date.now(),
        });

      case 'balance':
        if (!address) {
          return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
        }
        const account = accounts.get(address);
        if (!account) {
          return NextResponse.json({
            address,
            balance: '0',
            balanceUi: 0,
            totalEarned: '0',
            totalStaked: '0',
            trustBoost: 0,
            challengesCompleted: 0,
          });
        }
        return NextResponse.json({
          address: account.address,
          balance: account.balance.toString(),
          balanceUi: Number(account.balance) / 1e9,
          totalEarned: account.totalEarned.toString(),
          totalEarnedUi: Number(account.totalEarned) / 1e9,
          totalStaked: account.totalStaked.toString(),
          totalStakedUi: Number(account.totalStaked) / 1e9,
          trustBoost: account.trustBoost,
          challengesCompleted: account.challengesCompleted,
          lastActivity: account.lastActivity,
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
            address: a.address,
            totalEarned: a.totalEarned.toString(),
            totalEarnedUi: Number(a.totalEarned) / 1e9,
            challengesCompleted: a.challengesCompleted,
            trustBoost: a.trustBoost,
          }));

        return NextResponse.json({
          leaderboard: entries,
          totalMiners: accounts.size,
          timestamp: Date.now(),
        });

      case 'rewards':
        return NextResponse.json({
          schedule: REWARD_SCHEDULE,
          currentEpoch: Math.floor(challengeCount / 100000),
          challengeCount,
          currentReward: getCurrentReward(),
        });

      case 'trust-costs':
        return NextResponse.json({
          costs: TRUST_COSTS,
          maxTrustBoost: 30,
          description: 'Burn OMCP tokens to permanently boost your federation trust score',
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
 * POST /api/mcp/token
 *
 * Body:
 * - action: 'mint' | 'stake' | 'transfer'
 * - address: Recipient/staker address
 * - amount: Token amount (as string)
 * - trustBoost: Target trust level (for stake)
 * - challengeId: For mining rewards
 * - difficulty: Mining difficulty (for reward calculation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, address, amount, trustBoost, challengeId, difficulty } = body;

    switch (action) {
      case 'mint':
        return handleMint(address, challengeId, difficulty);

      case 'stake':
        return handleStake(address, amount, trustBoost);

      case 'transfer':
        return handleTransfer(body.from, body.to, amount);

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

function handleMint(address: string, challengeId: string, difficulty: number): NextResponse {
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  // Calculate reward
  const baseReward = BigInt(getCurrentReward());
  const difficultyMultiplier = 1 + (difficulty - 4) * 0.5;
  const reward = BigInt(Math.floor(Number(baseReward) * Math.min(3, Math.max(1, difficultyMultiplier))));

  // Check mining allocation
  const miningAllocation = BigInt(TOKEN_CONFIG.miningAllocation);
  if (totalMinted + reward > miningAllocation) {
    return NextResponse.json({
      success: false,
      error: 'Mining allocation exhausted',
      remaining: (miningAllocation - totalMinted).toString(),
    });
  }

  // Update account
  let account = accounts.get(address);
  if (!account) {
    account = {
      address,
      balance: 0n,
      totalEarned: 0n,
      totalStaked: 0n,
      trustBoost: 0,
      challengesCompleted: 0,
      lastActivity: Date.now(),
    };
    accounts.set(address, account);
  }

  account.balance += reward;
  account.totalEarned += reward;
  account.challengesCompleted++;
  account.lastActivity = Date.now();

  const previousEpoch = Math.floor((challengeCount - 1) / 100000);
  totalMinted += reward;
  challengeCount++;
  const currentEpoch = Math.floor(challengeCount / 100000);

  // Emit challenge completed event
  emitChallengeCompleted(challengeId, address, reward.toString());

  // Check for epoch change (halving)
  if (currentEpoch > previousEpoch && previousEpoch >= 0) {
    const prevReward = REWARD_SCHEDULE[Math.min(previousEpoch, REWARD_SCHEDULE.length - 1)].reward;
    const newReward = REWARD_SCHEDULE[Math.min(currentEpoch, REWARD_SCHEDULE.length - 1)].reward;
    emitEpochChange(previousEpoch, currentEpoch, prevReward, newReward);
  }

  // Check if halving is approaching (within 1000 challenges)
  const nextHalving = getNextHalving();
  if (nextHalving.challengesUntil <= 1000 && nextHalving.challengesUntil % 100 === 0) {
    emitHalvingApproaching(currentEpoch, nextHalving.challengesUntil, getCurrentReward());
  }

  // Emit leaderboard update every 10 challenges
  if (challengeCount % 10 === 0) {
    const topMiners = Array.from(accounts.values())
      .filter(a => a.totalEarned > 0n)
      .sort((a, b) => (b.totalEarned > a.totalEarned ? 1 : -1))
      .slice(0, 10)
      .map((a, i) => ({
        rank: i + 1,
        serverId: a.address,
        totalRewards: a.totalEarned.toString(),
        challengesCompleted: a.challengesCompleted,
      }));
    emitLeaderboardUpdate(topMiners);
  }

  return NextResponse.json({
    success: true,
    reward: reward.toString(),
    rewardUi: Number(reward) / 1e9,
    newBalance: account.balance.toString(),
    newBalanceUi: Number(account.balance) / 1e9,
    challengeId,
    message: `Mined ${Number(reward) / 1e9} OMCP!`,
  });
}

function handleStake(address: string, amountStr: string, targetTrust: number): NextResponse {
  if (!address || !targetTrust) {
    return NextResponse.json({ error: 'Missing address or trustBoost' }, { status: 400 });
  }

  const account = accounts.get(address);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Find trust cost
  const trustCost = TRUST_COSTS.find(c => c.trustBoost === targetTrust);
  if (!trustCost) {
    return NextResponse.json({
      error: 'Invalid trust level',
      validLevels: TRUST_COSTS.map(c => c.trustBoost),
    }, { status: 400 });
  }

  const cost = BigInt(trustCost.cost);

  // Check balance
  if (account.balance < cost) {
    return NextResponse.json({
      error: 'Insufficient balance',
      required: trustCost.cost,
      requiredUi: trustCost.costUi,
      balance: account.balance.toString(),
      balanceUi: Number(account.balance) / 1e9,
    }, { status: 400 });
  }

  // Check if already at this level
  if (account.trustBoost >= targetTrust) {
    return NextResponse.json({
      error: 'Already at or above this trust level',
      currentTrust: account.trustBoost,
    }, { status: 400 });
  }

  // Burn tokens and add trust
  account.balance -= cost;
  account.totalStaked += cost;
  account.trustBoost = targetTrust;
  account.lastActivity = Date.now();

  totalBurned += cost;

  // Emit staking event
  emitTokensStaked(address, trustCost.cost, targetTrust);

  return NextResponse.json({
    success: true,
    trustBoost: targetTrust,
    tokensBurned: trustCost.cost,
    tokensBurnedUi: trustCost.costUi,
    newBalance: account.balance.toString(),
    newBalanceUi: Number(account.balance) / 1e9,
    message: `Staked ${trustCost.costUi} OMCP for +${targetTrust} trust boost!`,
  });
}

function handleTransfer(from: string, to: string, amountStr: string): NextResponse {
  if (!from || !to || !amountStr) {
    return NextResponse.json({ error: 'Missing from, to, or amount' }, { status: 400 });
  }

  const fromAccount = accounts.get(from);
  if (!fromAccount) {
    return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });
  }

  const amount = BigInt(amountStr);
  if (fromAccount.balance < amount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  // Get or create recipient account
  let toAccount = accounts.get(to);
  if (!toAccount) {
    toAccount = {
      address: to,
      balance: 0n,
      totalEarned: 0n,
      totalStaked: 0n,
      trustBoost: 0,
      challengesCompleted: 0,
      lastActivity: Date.now(),
    };
    accounts.set(to, toAccount);
  }

  fromAccount.balance -= amount;
  toAccount.balance += amount;
  fromAccount.lastActivity = Date.now();
  toAccount.lastActivity = Date.now();

  // Emit transfer event
  miningEvents.emit('tokens_transferred', {
    from,
    to,
    amount: amountStr,
    amountUi: Number(amount) / 1e9,
  }, { serverId: from });

  return NextResponse.json({
    success: true,
    from,
    to,
    amount: amountStr,
    amountUi: Number(amount) / 1e9,
  });
}

// Helper functions

function getCurrentReward(): string {
  const epoch = Math.floor(challengeCount / 100000);
  const entry = REWARD_SCHEDULE[Math.min(epoch, REWARD_SCHEDULE.length - 1)];
  return entry.reward;
}

function getNextHalving(): { challengesUntil: number; newReward: string } {
  const currentEpoch = Math.floor(challengeCount / 100000);
  const nextEpochStart = (currentEpoch + 1) * 100000;
  const challengesUntil = nextEpochStart - challengeCount;

  const nextEntry = REWARD_SCHEDULE[Math.min(currentEpoch + 1, REWARD_SCHEDULE.length - 1)];

  return {
    challengesUntil,
    newReward: nextEntry.reward,
  };
}
