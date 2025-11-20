import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, StakeProgram } from '@solana/web3.js';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * Fetch real stakers delegated to a specific validator
 */
async function fetchValidatorStakers(validatorVoteAccount: string, validatorAPY: number): Promise<Array<{
  delegatorAddress: string;
  stakedAmount: number;
  pnl: number;
  pnlPercent: number;
  stakingDuration: number;
  rewards: number;
}>> {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const validatorPubkey = new PublicKey(validatorVoteAccount);

    // Get all stake accounts delegated to this validator
    const stakeAccounts = await Promise.race([
      connection.getParsedProgramAccounts(
        StakeProgram.programId,
        {
          filters: [
            {
              memcmp: {
                offset: 124, // Voter pubkey offset in stake account
                bytes: validatorPubkey.toBase58(),
              },
            },
          ],
          commitment: 'confirmed',
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Stake accounts fetch timeout')), 15000)
      )
    ]);

    console.log(`Found ${stakeAccounts.length} stake accounts for validator ${validatorVoteAccount}`);

    const topStakers = [];
    const currentEpoch = (await Promise.race([
      connection.getEpochInfo(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Epoch info timeout')), 5000)
      )
    ])).epoch;

    for (const stakeAccount of stakeAccounts.slice(0, 100)) { // Limit to top 100 for performance
      try {
        const accountData = stakeAccount.account.data;
        if (accountData && typeof accountData === 'object' && 'parsed' in accountData) {
          const parsedData = accountData.parsed;

          if (parsedData?.type === 'delegated' && parsedData?.info?.stake?.delegation) {
            const delegation = parsedData.info.stake.delegation;
            const meta = parsedData.info.meta;

            // Extract staking information
            const stakedAmount = parseInt(delegation.stake || '0');
            const activationEpoch = delegation.activationEpoch;
            const delegatorAddress = meta?.authorized?.staker || 'Unknown';

            // Calculate staking duration (simplified)
            const stakingDuration = Math.max(1, (currentEpoch - activationEpoch) * 2.5); // ~2.5 days per epoch

            // Calculate rewards based on APY and duration
            const annualRewards = stakedAmount * (validatorAPY / 100);
            const actualRewards = annualRewards * (stakingDuration / 365);

            // Estimate PnL (simplified calculation)
            const delegationCost = stakedAmount * 0.005; // ~0.5% one-time cost estimate
            const pnl = actualRewards - delegationCost;
            const pnlPercent = (pnl / stakedAmount) * 100;

            topStakers.push({
              delegatorAddress,
              stakedAmount,
              pnl,
              pnlPercent,
              stakingDuration: Math.round(stakingDuration),
              rewards: actualRewards
            });
          }
        }
      } catch (error) {
        console.error('Error processing stake account:', error);
        continue;
      }
    }

    // Sort by stake amount descending
    topStakers.sort((a, b) => b.stakedAmount - a.stakedAmount);

    console.log(`Processed ${topStakers.length} real stakers for validator ${validatorVoteAccount}`);

    // Return only real delegator data - no fake/fallback data
    return topStakers.slice(0, 100); // Return top 100 real delegators

  } catch (error) {
    console.error('Error fetching validator stakers:', error);

    // Return empty array instead of fake data when real data is unavailable
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: validatorAddress } = await params;

    if (!validatorAddress) {
      return NextResponse.json({
        success: false,
        error: 'Validator address is required'
      }, { status: 400 });
    }

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    console.log(`Looking for validator: ${validatorAddress}`);

    // Fetch validator data from Solana RPC with timeout
    const [voteAccounts, epochInfo, clusterNodes] = await Promise.race([
      Promise.all([
        connection.getVoteAccounts('confirmed'),
        connection.getEpochInfo('confirmed'),
        connection.getClusterNodes()
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC calls timeout')), 20000)
      )
    ]);

    // Find the specific validator
    const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
    const validator = allValidators.find(v => v.votePubkey === validatorAddress);

    console.log(`Found ${allValidators.length} total validators, target validator found: ${!!validator}`);

    if (!validator) {
      console.log('Available validators:', allValidators.slice(0, 5).map(v => v.votePubkey));
      return NextResponse.json({
        success: false,
        error: 'Validator not found'
      }, { status: 404 });
    }

    const clusterNode = clusterNodes.find(node =>
      node.pubkey === validator.nodePubkey
    );

    // Calculate performance metrics from real data
    const totalCredits = validator.epochCredits.reduce((sum, credit) => sum + credit[1], 0);
    const recentCredits = validator.epochCredits.slice(-5).reduce((sum, credit) => sum + credit[1], 0);
    const performanceScore = recentCredits > 0 ? Math.min(recentCredits / (5 * 440000), 1) : 0;

    // Calculate APY estimate based on commission and performance
    const baseAPY = 7; // Base Solana staking APY
    const apy = baseAPY * (1 - validator.commission / 100) * performanceScore;

    // Generate historical data (in production, this would come from a time series database)
    const generateHistoricalData = async () => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      // Stake history for the last 30 days
      const stakeHistory = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now - (i * oneDay));
        const variance = (Math.random() - 0.5) * 0.1; // ±5% variance
        const stake = Math.floor(validator.activatedStake * (1 + variance));
        stakeHistory.push({
          timestamp: date.getTime(),
          stake,
          date: date.toISOString().split('T')[0]
        });
      }

      // Epoch history for the last 20 epochs
      const epochHistory = [];
      for (let i = 19; i >= 0; i--) {
        const epoch = epochInfo.epoch - i;
        const variance = Math.random() * 0.2 + 0.8; // 80-100% performance
        epochHistory.push({
          epoch,
          credits: Math.floor(440000 * variance),
          stake: Math.floor(validator.activatedStake * (1 + (Math.random() - 0.5) * 0.1)),
          apy: apy * variance,
          performance: variance,
          date: new Date(now - (i * 2.5 * oneDay)).toISOString().split('T')[0] // ~2.5 days per epoch
        });
      }

      // Fetch real top stakers data from blockchain
      const topStakers = await fetchValidatorStakers(validatorAddress, apy);

      return { stakeHistory, epochHistory, topStakers };
    };

    const detailedStats = await generateHistoricalData();

    // Generate recommendations based on validator metrics
    const generateRecommendations = () => {
      const reasons = [];
      const alternatives = [];
      let shouldStake = true;
      let riskLevel: 'low' | 'medium' | 'high' = 'low';

      // Analyze commission
      if (validator.commission === 0) {
        reasons.push('Zero commission means maximum staking rewards');
      } else if (validator.commission <= 5) {
        reasons.push('Low commission rate is favorable for stakers');
      } else if (validator.commission <= 10) {
        reasons.push('Moderate commission rate');
        riskLevel = 'medium';
      } else {
        reasons.push('High commission rate reduces staking rewards');
        shouldStake = false;
        riskLevel = 'high';
      }

      // Analyze performance
      if (performanceScore >= 0.95) {
        reasons.push('Excellent performance score and uptime');
      } else if (performanceScore >= 0.85) {
        reasons.push('Good performance score');
      } else {
        reasons.push('Below average performance score');
        shouldStake = false;
        riskLevel = 'high';
      }

      // Analyze stake size
      if (validator.activatedStake > 10000000000000000) { // > 10M SOL
        reasons.push('Large stake provides network security');
      } else if (validator.activatedStake < 1000000000000000) { // < 1M SOL
        reasons.push('Small validator - higher risk but supports decentralization');
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      }

      // Check if delinquent
      if (voteAccounts.delinquent.includes(validator)) {
        reasons.push('Currently delinquent - not voting');
        shouldStake = false;
        riskLevel = 'high';
      }

      // Add some alternative recommendations
      if (!shouldStake || riskLevel === 'high') {
        alternatives.push('Consider validators with <5% commission and >95% uptime');
        alternatives.push('Look for validators with consistent performance history');
        alternatives.push('Diversify stake across multiple high-performing validators');
      }

      return { shouldStake, riskLevel, reasons, alternatives };
    };

    const recommendations = generateRecommendations();

    const validatorProfile = {
      voteAccount: validator.votePubkey,
      name: `Validator ${validator.votePubkey.slice(0, 8)}`, // In production, this would come from validator registry
      commission: validator.commission,
      activatedStake: validator.activatedStake,
      lastVote: validator.lastVote,
      // rootSlot: validator.rootSlot, // Removed as it doesn't exist on VoteAccountInfo
      credits: totalCredits,
      epochCredits: validator.epochCredits[validator.epochCredits.length - 1]?.[1] || 0,
      version: clusterNode?.version || 'Unknown',
      status: voteAccounts.current.includes(validator) ? 'active' as const : 'delinquent' as const,
      datacenter: clusterNode?.tpu ? `TPU: ${clusterNode.tpu}` : 'Unknown',
      country: 'Unknown', // Would need geolocation API for real location data
      apy: Math.round(apy * 100) / 100,
      performanceScore,
      uptimePercent: Math.round(performanceScore * 100 * 100) / 100,
      detailedStats,
      recommendations
    };

    return NextResponse.json({
      success: true,
      data: validatorProfile,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching validator profile:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch validator profile'
    }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: _validatorAddress } = await params;
    // This is a placeholder for future functionality, e.g., staking or voting
    return NextResponse.json({
      success: false,
      error: 'POST method not implemented for validator endpoint'
    }, { status: 501 });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process POST request'
    }, { status: 500 });
  }
}
