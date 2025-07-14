import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function GET(
  _request: NextRequest,
  { params: _params }: { params: { address: string } }
) {
  try {
    const validatorAddress = _params.address;
    
    if (!validatorAddress) {
      return NextResponse.json({
        success: false,
        error: 'Validator address is required'
      }, { status: 400 });
    }

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Fetch validator data from Solana RPC
    const voteAccounts = await connection.getVoteAccounts('confirmed');
    const epochInfo = await connection.getEpochInfo('confirmed');
    const clusterNodes = await connection.getClusterNodes();
    
    // Find the specific validator
    const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
    const validator = allValidators.find(v => v.votePubkey === validatorAddress);
    
    if (!validator) {
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
    const generateHistoricalData = () => {
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

      // Top 100 stakers (simulated data - in production would come from on-chain analysis)
      const topStakers = [];
      for (let i = 0; i < 100; i++) {
        const delegatorAddress = generateRandomAddress();
        const stakedAmount = Math.floor(Math.random() * 5000000000000000) + 1000000000000; // 1K-5M SOL
        const stakingDuration = Math.floor(Math.random() * 365) + 30; // 30-395 days
        const baseRewards = stakedAmount * (apy / 100) * (stakingDuration / 365);
        const variance = (Math.random() - 0.5) * 0.3; // ±15%
        const actualRewards = baseRewards * (1 + variance);
        const pnl = actualRewards - (stakedAmount * 0.01); // Minus small delegation cost
        const pnlPercent = (pnl / stakedAmount) * 100;

        topStakers.push({
          delegatorAddress,
          stakedAmount,
          pnl,
          pnlPercent,
          stakingDuration,
          rewards: actualRewards
        });
      }

      // Sort by PnL descending
      topStakers.sort((a, b) => b.pnl - a.pnl);

      return { stakeHistory, epochHistory, topStakers };
    };

    const generateRandomAddress = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
      let result = '';
      for (let i = 0; i < 44; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const detailedStats = generateHistoricalData();

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
  { params: _params }: { params: { address: string } }
) {
  // This is a placeholder for future functionality, e.g., staking or voting
  return NextResponse.json({
    success: false,
    error: 'POST method not implemented for validator endpoint'
  }, { status: 501 });
}
