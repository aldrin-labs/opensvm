/**
 * SVMAI Tokenomics API
 *
 * Main API endpoint for the $SVMAI tokenomics system.
 *
 * GET /api/tokenomics - Get system overview
 * GET /api/tokenomics?wallet=xxx - Get user account
 * GET /api/tokenomics?action=tiers - Get tier info
 * GET /api/tokenomics?action=credits - Get credit packs
 * GET /api/tokenomics?action=staking - Get staking info
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock data for demonstration (in production, use the actual tokenomics module)

const TIER_CONFIGS = [
  {
    tier: 'free',
    minTokens: 0,
    name: 'Free',
    description: 'Basic access for exploration',
    color: '#9CA3AF',
    benefits: {
      requestsPerMinute: 10,
      requestsPerDay: 100,
      historicalDataDays: 7,
      basicTools: true,
      advancedTools: false,
      aiTools: false,
      monthlyCredits: 100,
    },
  },
  {
    tier: 'basic',
    minTokens: 100,
    name: 'Basic',
    description: 'For casual users and researchers',
    color: '#60A5FA',
    benefits: {
      requestsPerMinute: 30,
      requestsPerDay: 1000,
      historicalDataDays: 30,
      basicTools: true,
      advancedTools: true,
      aiTools: false,
      monthlyCredits: 500,
    },
  },
  {
    tier: 'pro',
    minTokens: 1000,
    name: 'Pro',
    description: 'For power users and developers',
    color: '#A78BFA',
    benefits: {
      requestsPerMinute: 100,
      requestsPerDay: 10000,
      historicalDataDays: 90,
      basicTools: true,
      advancedTools: true,
      aiTools: true,
      monthlyCredits: 2500,
    },
  },
  {
    tier: 'enterprise',
    minTokens: 10000,
    name: 'Enterprise',
    description: 'For teams and businesses',
    color: '#F59E0B',
    benefits: {
      requestsPerMinute: 500,
      requestsPerDay: 100000,
      historicalDataDays: 365,
      basicTools: true,
      advancedTools: true,
      aiTools: true,
      monthlyCredits: 15000,
    },
  },
  {
    tier: 'whale',
    minTokens: 100000,
    name: 'Whale',
    description: 'Unlimited access for major holders',
    color: '#EF4444',
    benefits: {
      requestsPerMinute: -1,
      requestsPerDay: -1,
      historicalDataDays: -1,
      basicTools: true,
      advancedTools: true,
      aiTools: true,
      monthlyCredits: -1,
    },
  },
];

const CREDIT_PACKS = [
  { id: 'starter', name: 'Starter', credits: 500, priceTokens: 50, bonusCredits: 0, discount: 0 },
  { id: 'basic', name: 'Basic', credits: 2500, priceTokens: 225, bonusCredits: 250, discount: 10, popular: true },
  { id: 'pro', name: 'Pro', credits: 10000, priceTokens: 800, bonusCredits: 2000, discount: 20 },
  { id: 'enterprise', name: 'Enterprise', credits: 50000, priceTokens: 3500, bonusCredits: 15000, discount: 30 },
];

const STAKE_CONFIGS = [
  { duration: '7d', durationDays: 7, multiplier: 1.0, earlyUnstakePenalty: 0, rewardBoost: 0, apy: 0 },
  { duration: '30d', durationDays: 30, multiplier: 1.25, earlyUnstakePenalty: 5, rewardBoost: 10, apy: 25 },
  { duration: '90d', durationDays: 90, multiplier: 1.5, earlyUnstakePenalty: 10, rewardBoost: 25, apy: 50 },
  { duration: '180d', durationDays: 180, multiplier: 1.75, earlyUnstakePenalty: 15, rewardBoost: 50, apy: 75 },
  { duration: '365d', durationDays: 365, multiplier: 2.0, earlyUnstakePenalty: 20, rewardBoost: 100, apy: 100 },
];

const SYSTEM_STATS = {
  totalUsers: 12847,
  totalStaked: '8,450,000',
  totalBurned: '1,234,567',
  treasuryBalance: '2,500,000',
  averageAPY: 45,
  tierDistribution: {
    free: 8500,
    basic: 2800,
    pro: 1200,
    enterprise: 300,
    whale: 47,
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const wallet = searchParams.get('wallet');

  try {
    // Get tier information
    if (action === 'tiers') {
      return NextResponse.json({
        tiers: TIER_CONFIGS,
        comparison: generateTierComparison(),
      });
    }

    // Get credit packs
    if (action === 'credits') {
      return NextResponse.json({
        packs: CREDIT_PACKS,
        toolCosts: getToolCosts(),
      });
    }

    // Get staking info
    if (action === 'staking') {
      return NextResponse.json({
        configs: STAKE_CONFIGS,
        poolStats: {
          totalStaked: SYSTEM_STATS.totalStaked,
          totalStakers: 4230,
          rewardPool: '125,000',
          averageMultiplier: 1.45,
          nextDistribution: Date.now() + 24 * 60 * 60 * 1000,
        },
      });
    }

    // Get user account
    if (wallet) {
      // In production, fetch from blockchain and database
      const mockAccount = {
        wallet,
        tier: calculateMockTier(wallet),
        tokenBalance: '1,234',
        stakedBalance: '500',
        effectiveBalance: '1,750',
        credits: {
          balance: 1250,
          monthlyAllocation: 2500,
          monthlyUsed: 450,
          resetDate: getNextMonthStart(),
        },
        stakes: [
          {
            id: 'stake-1',
            amount: '500',
            duration: '90d',
            startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
            endTime: Date.now() + 60 * 24 * 60 * 60 * 1000,
            multiplier: 1.5,
            rewards: '12.5',
            status: 'active',
          },
        ],
        referralCode: `REF-${wallet.slice(0, 6).toUpperCase()}`,
        referralEarnings: '45',
        achievements: [
          { id: 'early-adopter', name: 'Early Adopter', unlockedAt: Date.now() - 60 * 24 * 60 * 60 * 1000 },
          { id: 'first-stake', name: 'First Stake', unlockedAt: Date.now() - 30 * 24 * 60 * 60 * 1000 },
        ],
      };

      return NextResponse.json(mockAccount);
    }

    // Default: System overview
    return NextResponse.json({
      stats: SYSTEM_STATS,
      tiers: TIER_CONFIGS.map(t => ({ tier: t.tier, name: t.name, minTokens: t.minTokens })),
      creditPacks: CREDIT_PACKS.length,
      stakingOptions: STAKE_CONFIGS.length,
      features: {
        accessTiers: true,
        staking: true,
        liquidStaking: true,
        credits: true,
        marketplace: true,
        governance: true,
        referrals: true,
        achievements: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, wallet } = body;

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    switch (action) {
      case 'stake': {
        const { amount, duration } = body;
        // In production, create actual stake
        return NextResponse.json({
          success: true,
          stake: {
            id: `stake-${Date.now()}`,
            amount,
            duration,
            multiplier: STAKE_CONFIGS.find(c => c.duration === duration)?.multiplier || 1,
            startTime: Date.now(),
            endTime: Date.now() + (parseInt(duration) * 24 * 60 * 60 * 1000),
          },
        });
      }

      case 'unstake': {
        const { stakeId } = body;
        // In production, process unstake
        return NextResponse.json({
          success: true,
          returnAmount: '500',
          penalty: '0',
          rewards: '12.5',
        });
      }

      case 'claim_rewards': {
        // In production, process claim
        return NextResponse.json({
          success: true,
          claimed: '25.5',
          newBalance: '25.5',
        });
      }

      case 'purchase_credits': {
        const { packId } = body;
        const pack = CREDIT_PACKS.find(p => p.id === packId);
        if (!pack) {
          return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          creditsAdded: pack.credits + pack.bonusCredits,
          tokensCost: pack.priceTokens,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateMockTier(wallet: string): string {
  // Mock tier based on wallet address hash
  const hash = wallet.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const tiers = ['free', 'basic', 'pro', 'enterprise', 'whale'];
  return tiers[hash % 5];
}

function getNextMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

function generateTierComparison(): string[][] {
  return [
    ['Feature', 'Free', 'Basic', 'Pro', 'Enterprise', 'Whale'],
    ['Requests/min', '10', '30', '100', '500', 'Unlimited'],
    ['Requests/day', '100', '1,000', '10,000', '100,000', 'Unlimited'],
    ['Historical Data', '7 days', '30 days', '90 days', '1 year', 'All time'],
    ['Advanced Tools', 'No', 'Yes', 'Yes', 'Yes', 'Yes'],
    ['AI Tools', 'No', 'No', 'Yes', 'Yes', 'Yes'],
    ['Monthly Credits', '100', '500', '2,500', '15,000', 'Unlimited'],
    ['API Keys', '1', '3', '10', '50', 'Unlimited'],
    ['Team Members', '1', '1', '5', '25', 'Unlimited'],
  ];
}

function getToolCosts(): Array<{ name: string; category: string; cost: number }> {
  return [
    { name: 'get_transaction', category: 'basic', cost: 1 },
    { name: 'get_account_portfolio', category: 'basic', cost: 2 },
    { name: 'explain_transaction', category: 'advanced', cost: 5 },
    { name: 'analyze_transaction', category: 'advanced', cost: 10 },
    { name: 'ask_ai', category: 'ai', cost: 25 },
    { name: 'investigate', category: 'forensics', cost: 50 },
    { name: 'batch_execute', category: 'enterprise', cost: 10 },
  ];
}

export const runtime = 'edge';
