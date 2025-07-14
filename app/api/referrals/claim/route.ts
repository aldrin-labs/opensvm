/**
 * API endpoint for claiming referral rewards
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSessionFromCookie } from '@/lib/auth-server';
import { qdrantClient } from '@/lib/qdrant';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = getSessionFromCookie();
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json({
        error: 'Authentication required to claim rewards',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const { walletAddress } = await request.json();

    // Verify user is claiming their own rewards
    if (!walletAddress) {
      return NextResponse.json({
        error: 'Wallet address is required',
        code: 'MISSING_WALLET'
      }, { status: 400 });
    }
    
    if (session.walletAddress !== walletAddress) {
      return NextResponse.json({
        error: 'You can only claim rewards for your own wallet',
        code: 'UNAUTHORIZED_WALLET'
      }, { status: 403 });
    }

    // Get user's profile to check follower count
    let userProfileResult;
    try {
      userProfileResult = await qdrantClient.search('user_profiles', {
        vector: Array(384).fill(0),
        filter: {
          must: [{ key: 'walletAddress', match: { value: walletAddress } }]
        },
        limit: 1
      });
    } catch (error) {
      console.error('Error searching user_profiles:', error);
      return NextResponse.json({ error: 'Failed to retrieve user profile' }, { status: 500 });
    }

    if (!userProfileResult || userProfileResult.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userProfile = userProfileResult[0].payload as any;
    const socialStats = userProfile.socialStats || {
      visitsByUsers: 0,
      followers: 0,
      following: 0,
      likes: 0,
      profileViews: 0
    };

    // Calculate potential rewards (5 SVMAI per follower)
    const followerCount = socialStats.followers || 0;
    const potentialRewards = followerCount * 5;

    // Get current user balance to check minimum token requirement
    let userBalanceResult: any[] = [];
    let currentBalance = 0;
    try {
      userBalanceResult = await qdrantClient.search('user_balances', {
        vector: Array(384).fill(0),
        filter: {
          must: [{ key: 'walletAddress', match: { value: walletAddress } }]
        },
        limit: 1
      });

      if (userBalanceResult.length > 0) {
        const userBalance = userBalanceResult[0].payload as any;
        currentBalance = userBalance.balance || 0;
      }
    } catch (error) {
      console.log('Error fetching user balance, assuming 0');
    }
    
    // Check if user has enough tokens to claim (minimum 1,000,000 SVMAI)
    const MINIMUM_BALANCE_REQUIRED = 1000000;
    if (currentBalance < MINIMUM_BALANCE_REQUIRED) {
      return NextResponse.json({
        error: `Insufficient token balance. You need at least ${MINIMUM_BALANCE_REQUIRED.toLocaleString()} SVMAI to claim rewards.`,
        code: 'INSUFFICIENT_BALANCE',
        currentBalance,
        requiredBalance: MINIMUM_BALANCE_REQUIRED
      }, { status: 403 });
    }

    if (potentialRewards <= 0) {
      return NextResponse.json({
        error: 'No rewards available to claim',
        code: 'NO_REWARDS',
        amount: 0,
        followerCount
      }, { status: 400 });
    }

    // Check for last claim
    let lastClaimResult: any[] = [];
    try {
      lastClaimResult = await qdrantClient.search('referral_rewards', {
        vector: Array(384).fill(0),
        filter: {
          must: [{ key: 'walletAddress', match: { value: walletAddress } }]
        },
        limit: 10,
        with_payload: true
      });
      
      // Sort the results manually after fetching
      lastClaimResult.sort((a, b) => {
        const aTime = (a.payload as any).claimedAt || 0;
        const bTime = (b.payload as any).claimedAt || 0;
        return bTime - aTime; // Descending order
      });
    } catch (error) {
      console.log('referral_rewards collection may not exist yet, will create it');
    }

    // Check if user can claim (once per day)
    if (lastClaimResult.length > 0) {
      const lastClaim = lastClaimResult[0].payload as any;
      const lastClaimDate = new Date(lastClaim.claimedAt);
      const now = new Date();
      const hoursSinceLastClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastClaim < 24) {
        const nextClaimTime = new Date(lastClaimDate.getTime() + 24 * 60 * 60 * 1000);
        return NextResponse.json({
          error: 'You can only claim rewards once per day',
          code: 'CLAIM_COOLDOWN',
          nextClaimTime: nextClaimTime.getTime(),
          nextClaimTimeFormatted: nextClaimTime.toLocaleString(),
          hoursTillNextClaim: 24 - hoursSinceLastClaim,
          amount: 0
        }, { status: 400 });
      }
    }

    // Create reward entry
    const rewardId = uuidv4();
    const rewardEntry = {
      id: rewardId,
      walletAddress,
      amount: potentialRewards,
      claimedAt: Date.now(),
      status: 'claimed'
    };

    // Store the reward claim
    let rewardStored = false;
    try {
      await qdrantClient.upsert('referral_rewards', {
        points: [
          {
            id: rewardId,
            vector: Array(384).fill(0),
            payload: rewardEntry
          }
        ]
      });
      rewardStored = true;
    } catch (error) {
      // Create collection if it doesn't exist
      try {
        await qdrantClient.createCollection('referral_rewards', {
          vectors: { size: 384, distance: 'Cosine' }
        });
        
        // Retry upserting the reward
        await qdrantClient.upsert('referral_rewards', {
          points: [
            {
              id: rewardId,
              vector: Array(384).fill(0),
              payload: rewardEntry
            }
          ]
        });
        rewardStored = true;
      } catch (createError) {
        console.error('Error creating referral_rewards collection:', createError);
      }
    }

    if (!rewardStored) {
      return NextResponse.json({ error: 'Failed to store reward claim' }, { status: 500 });
    }

    // Update user's token balance
    // First check if user_balances collection exists
    let balanceId = uuidv4();
    // currentBalance already defined and fetched above
    let balanceUpdated = false;

    try {
      // We already have userBalanceResult from the balance check above
      if (userBalanceResult.length > 0) {
        balanceId = String(userBalanceResult[0].id); // Convert to string for consistency
        // currentBalance is already set above
      }

      // Update or create user balance
      await qdrantClient.upsert('user_balances', {
        points: [
          {
            id: balanceId,
            vector: Array(384).fill(0),
            payload: {
              walletAddress,
              balance: currentBalance + potentialRewards,
              updatedAt: Date.now()
            }
          }
        ]
      });
      balanceUpdated = true;
    } catch (error) {
      // Create collection if it doesn't exist
      try {
        await qdrantClient.createCollection('user_balances', {
          vectors: { size: 384, distance: 'Cosine' }
        });
        
        // Retry upserting the balance
        await qdrantClient.upsert('user_balances', {
          points: [
            {
              id: balanceId,
              vector: Array(384).fill(0),
              payload: {
                walletAddress,
                balance: potentialRewards,
                updatedAt: Date.now()
              }
            }
          ]
        });
        balanceUpdated = true;
      } catch (createError) {
        console.error('Error creating user_balances collection:', createError);
      }
    }

    if (!balanceUpdated) {
      return NextResponse.json({
        warning: 'Reward claimed but balance update failed',
        amount: potentialRewards,
        claimedAt: rewardEntry.claimedAt,
        code: 'BALANCE_UPDATE_FAILED'
      }, { status: 207 });
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully claimed ${potentialRewards} SVMAI tokens based on ${followerCount} followers`,
      amount: potentialRewards,
      claimedAt: rewardEntry.claimedAt,
      claimedAtFormatted: new Date(rewardEntry.claimedAt).toLocaleString(),
      followerCount,
      newBalance: currentBalance + potentialRewards,
      nextClaimAt: new Date(rewardEntry.claimedAt + 24 * 60 * 60 * 1000).getTime()
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    return NextResponse.json({
      error: 'Internal server error processing your reward claim',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}