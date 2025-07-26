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
  burnAmount: number; // $SVMAI amount burned
  totalBurned: number; // Total $SVMAI burned for this validator
  purchaseTime: number;
  burnSignature: string;
  burnerWallet: string;
  duration: number; // hours (always 24)
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
  
  // Boost multiplier based on total burned $SVMAI
  if (boost && boost.purchaseTime + (boost.duration * 3600000) > Date.now()) {
    // More aggressive multiplier for burned tokens
    // 1000 $SVMAI = 1.5x, 5000 $SVMAI = 2.5x, 10000 $SVMAI = 4x, etc.
    const multiplier = 1 + (boost.totalBurned / 2000); // Every 2000 $SVMAI adds 1x
    score *= multiplier;
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
          boostAmount: boost?.totalBurned,
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
    const { voteAccount, burnAmount, burnSignature, burnerWallet } = await request.json();
    
    if (!voteAccount || !burnAmount || !burnSignature || !burnerWallet) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    if (burnAmount < 1000) {
      return NextResponse.json({
        success: false,
        error: 'Minimum burn amount is 1000 $SVMAI'
      }, { status: 400 });
    }

    // TODO: Verify burn transaction on-chain using burnSignature
    // For now, we trust the frontend verification
    
    // Get current boosts
    const currentBoosts = memoryCache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];
    
    // Check if there's an existing boost for this validator
    const existingBoostIndex = currentBoosts.findIndex(b => b.voteAccount === voteAccount);
    
    let totalBurned = burnAmount;
    
    if (existingBoostIndex >= 0) {
      // Add to existing boost - amounts stack up and timer resets
      const existingBoost = currentBoosts[existingBoostIndex];
      totalBurned = existingBoost.totalBurned + burnAmount;
      
      // Update existing boost with new totals and reset timer
      currentBoosts[existingBoostIndex] = {
        voteAccount,
        burnAmount,
        totalBurned,
        purchaseTime: Date.now(), // Reset timer to 24h
        burnSignature,
        burnerWallet,
        duration: 24
      };
    } else {
      // Create new boost
      const newBoost: BoostPurchase = {
        voteAccount,
        burnAmount,
        totalBurned,
        purchaseTime: Date.now(),
        burnSignature,
        burnerWallet,
        duration: 24
      };
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
        burnAmount,
        totalBurned,
        message: `Successfully burned ${burnAmount} $SVMAI. Total burned for this validator: ${totalBurned} $SVMAI. Timer reset to 24 hours.`
      }
    });

  } catch (error) {
    console.error('Error processing burn:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}