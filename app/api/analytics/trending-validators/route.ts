import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { memoryCache } from '@/lib/cache';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface TrendingValidator {
  voteAccount: string;
  name: string;
  commission: number;
  activatedStake: number;
  depositVolume24h: number;
  boostEndTime?: number;
  boostAmount?: number;
  trendingScore: number;
  trendingReason: 'volume' | 'boost';
  rank: number;
}

interface BoostPurchase {
  voteAccount: string;
  amount: number; // SOL amount paid for boost
  purchaseTime: number;
  duration: number; // hours
}

// Cache keys
const TRENDING_CACHE_KEY = 'trending_validators';
const BOOSTS_CACHE_KEY = 'validator_boosts';
const DEPOSIT_VOLUME_CACHE_KEY = 'deposit_volumes_24h';

// Mock deposit volume data - in a real implementation, this would track actual on-chain deposits
const getMockDepositVolume = (voteAccount: string): number => {
  // Generate deterministic but varying deposit volumes based on vote account
  const hash = voteAccount.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const baseVolume = Math.abs(hash) % 10000;
  const timeVariation = Math.sin(Date.now() / 86400000) * 2000; // Daily variation
  return Math.max(0, baseVolume + timeVariation);
};

// Calculate trending score based on deposit volume and boosts
const calculateTrendingScore = (validator: any, depositVolume: number, boost?: BoostPurchase): number => {
  let score = 0;
  
  // Base score from deposit volume (0-1000 points)
  score += Math.min(depositVolume / 10, 1000);
  
  // Stake bonus (0-500 points)
  score += Math.min(validator.activatedStake / 1e12, 500);
  
  // Performance bonus (0-200 points)
  if (validator.uptimePercent) {
    score += (validator.uptimePercent / 100) * 200;
  }
  
  // Boost multiplier
  if (boost && boost.purchaseTime + (boost.duration * 3600000) > Date.now()) {
    score *= (1 + boost.amount / 100); // Boost amount acts as multiplier
  }
  
  return Math.round(score);
};

export async function GET() {
  try {
    // Check cache first
    const cached = memoryCache.get<TrendingValidator[]>(TRENDING_CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: Date.now()
      });
    }

    // Fetch validator data from main endpoint
    const validatorsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/analytics/validators`);
    const validatorsData = await validatorsResponse.json();
    
    if (!validatorsData.success) {
      throw new Error('Failed to fetch validator data');
    }

    const validators = validatorsData.data.validators;
    const activeBoosts = memoryCache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];
    
    // Calculate trending validators
    const trendingValidators: TrendingValidator[] = validators
      .slice(0, 100) // Only consider top 100 validators for trending
      .map((validator: any) => {
        const depositVolume = getMockDepositVolume(validator.voteAccount);
        const boost = activeBoosts.find(b => b.voteAccount === validator.voteAccount);
        const trendingScore = calculateTrendingScore(validator, depositVolume, boost);
        
        return {
          voteAccount: validator.voteAccount,
          name: validator.name,
          commission: validator.commission,
          activatedStake: validator.activatedStake,
          depositVolume24h: depositVolume,
          boostEndTime: boost ? boost.purchaseTime + (boost.duration * 3600000) : undefined,
          boostAmount: boost?.amount,
          trendingScore,
          trendingReason: boost && boost.purchaseTime + (boost.duration * 3600000) > Date.now() ? 'boost' : 'volume',
          rank: 0 // Will be set after sorting
        };
      })
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 10) // Top 10 trending validators
      .map((validator, index) => ({
        ...validator,
        rank: index + 1
      }));

    // Cache for 5 minutes
    memoryCache.set(TRENDING_CACHE_KEY, trendingValidators, 300);

    return NextResponse.json({
      success: true,
      data: trendingValidators,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching trending validators:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { voteAccount, amount, duration = 24 } = await request.json();
    
    if (!voteAccount || !amount || amount < 1) {
      return NextResponse.json({
        success: false,
        error: 'Invalid boost parameters'
      }, { status: 400 });
    }

    // Get current boosts
    const currentBoosts = memoryCache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];
    
    // Check if there's an existing boost for this validator
    const existingBoostIndex = currentBoosts.findIndex(b => b.voteAccount === voteAccount);
    
    const newBoost: BoostPurchase = {
      voteAccount,
      amount,
      purchaseTime: Date.now(),
      duration
    };

    // Replace existing boost or add new one
    if (existingBoostIndex >= 0) {
      // Only allow if new boost amount is higher
      if (amount <= currentBoosts[existingBoostIndex].amount) {
        return NextResponse.json({
          success: false,
          error: 'Boost amount must be higher than current boost'
        }, { status: 400 });
      }
      currentBoosts[existingBoostIndex] = newBoost;
    } else {
      currentBoosts.push(newBoost);
    }

    // Clean up expired boosts
    const activeBoosts = currentBoosts.filter(
      boost => boost.purchaseTime + (boost.duration * 3600000) > Date.now()
    );

    // Cache updated boosts for 25 hours
    memoryCache.set(BOOSTS_CACHE_KEY, activeBoosts, 25 * 3600);
    
    // Clear trending cache to force recalculation
    memoryCache.delete(TRENDING_CACHE_KEY);

    return NextResponse.json({
      success: true,
      data: {
        boost: newBoost,
        message: 'Boost purchased successfully'
      }
    });

  } catch (error) {
    console.error('Error purchasing boost:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}