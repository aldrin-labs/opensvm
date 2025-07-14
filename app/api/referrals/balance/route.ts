/**
 * API endpoint for getting a user's token balance
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/qdrant';
import { getSessionFromCookie } from '@/lib/auth-server';
import { MINIMUM_BALANCE_REQUIRED } from '@/components/referrals/ReferralComponents';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    // If querying own balance, verify the user is authenticated
    const session = getSessionFromCookie();
    const isOwnBalance = session?.walletAddress === walletAddress;
    
    // For security, only allow users to view their own balance details
    // unless they are viewing just the public balance amount
    if (!isOwnBalance && session) {
      // Non-owners can see the basic balance, but not transaction history
      // This could be adjusted based on privacy requirements
    }
    
    // Query user's balance
    let userBalanceResult: any[] = [];
    try {
      userBalanceResult = await qdrantClient.search('user_balances', {
        vector: Array(384).fill(0),
        filter: {
          must: [{ key: 'walletAddress', match: { value: walletAddress } }]
        },
        limit: 1
      });
    } catch (error) {
      console.log('Error querying user_balances or collection does not exist:', error);
      // Try to create the collection if it doesn't exist
      try {
        await qdrantClient.createCollection('user_balances', {
          vectors: { size: 384, distance: 'Cosine' }
        });
        console.log('Created user_balances collection');
      } catch (createError) {
        console.error('Failed to create user_balances collection:', createError);
      }
      // Return zero balance instead of error for better UX
      return NextResponse.json({
        balance: 0,
        updatedAt: Date.now(),
        isOwner: isOwnBalance,
        minimumBalanceRequired: MINIMUM_BALANCE_REQUIRED,
        hasMinimumBalance: false,
        canClaim: false // Need both time and balance requirements
      });
    }
    
    // If no balance found, return zero with consistent response structure
    if (userBalanceResult.length === 0) {
      return NextResponse.json({
        balance: 0,
        updatedAt: Date.now(),
        isOwner: isOwnBalance,
        minimumBalanceRequired: MINIMUM_BALANCE_REQUIRED,
        hasMinimumBalance: false,
        canClaim: false // Need both time and balance requirements
      });
    }
    
    const userBalance = userBalanceResult[0].payload as any;
    const balance = userBalance.balance || 0;
    const updatedAt = userBalance.updatedAt || Date.now();
    
    // Return the balance information with proper typing
    // Check if user has enough tokens for the minimum requirement
    const hasMinimumBalance = balance >= MINIMUM_BALANCE_REQUIRED;
    
    const response: Record<string, any> = {
      balance,
      updatedAt,
      minimumBalanceRequired: MINIMUM_BALANCE_REQUIRED,
      hasMinimumBalance,
    };
    
    if (isOwnBalance) {
      // Add additional details for the account owner
      response.isOwner = true;
      
      // Add recent rewards if available
      try {
        const recentRewards = await qdrantClient.search('referral_rewards', {
          vector: Array(384).fill(0),
          filter: {
            must: [{ key: 'walletAddress', match: { value: walletAddress } }]
          },
          limit: 5,
          with_payload: true
        });
        
        if (recentRewards.length > 0) {
          // Sort by claimed date
          const sortedRewards = recentRewards
            .map(r => r.payload as any)
            .sort((a, b) => (b.claimedAt || 0) - (a.claimedAt || 0));
          
          response.recentRewards = sortedRewards;
          response.lastClaimAt = sortedRewards[0]?.claimedAt;
          
          // Calculate next claim time (24 hours after last claim)
          if (sortedRewards[0]?.claimedAt) {
            const lastClaimDate = new Date(sortedRewards[0].claimedAt);
            const nextClaimDate = new Date(lastClaimDate.getTime() + 24 * 60 * 60 * 1000);
            response.nextClaimAt = nextClaimDate.getTime();
            const timeAllowsClaim = Date.now() >= nextClaimDate.getTime();
            // User must have both: enough time since last claim AND minimum token balance
            response.canClaim = timeAllowsClaim && hasMinimumBalance;
            response.timeAllowsClaim = timeAllowsClaim;
          }
        } else {
          // For first-time users with no claim history, only check balance requirement
          response.canClaim = hasMinimumBalance;
          response.timeAllowsClaim = true;
        }
      } catch (error) {
        console.log('No rewards history found, trying to create collection');
        // Try to create the collection if it doesn't exist
        try {
          await qdrantClient.createCollection('referral_rewards', {
            vectors: { size: 384, distance: 'Cosine' }
          });
          console.log('Created referral_rewards collection');
        } catch (createError) {
          console.error('Failed to create referral_rewards collection:', createError);
        }
        // For first-time users with no claim history, only check balance requirement
        response.canClaim = hasMinimumBalance;
        response.timeAllowsClaim = true;
      }
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return NextResponse.json({ error: 'Failed to fetch token balance' }, { status: 500 });
  }
}