export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getBlockStats } from '@/lib/blockchain/block-data';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { z } from 'zod';
import { AdvancedRateLimiter, createRateLimitMiddleware } from '@/lib/api/rate-limiter';
import { BlockExplorerErrorType } from '@/lib/types/block.types';

// Rate limiter for block stats requests (500 requests per minute)
const blockStatsLimiter = new AdvancedRateLimiter({
  maxRequests: 500,
  windowMs: 60 * 1000,
  burstLimit: 600,
  keyPrefix: 'block_stats'
});

const rateLimitMiddleware = createRateLimitMiddleware(blockStatsLimiter);

// Validation schema for request parameters
const BlockStatsRequestSchema = z.object({
  lookbackSlots: z.coerce.number()
    .int()
    .min(1, 'Lookback must be at least 1')
    .max(1000, 'Lookback cannot exceed 1000')
    .default(100)
    .optional()
    .transform(val => val ?? 100) // Ensure we always have a number
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Get and validate parameters
    const searchParams = request.nextUrl.searchParams;
    const lookbackParam = searchParams.get('lookbackSlots');
    const requestParams = {
      lookbackSlots: lookbackParam ? Number(lookbackParam) : 100
    };

    let validatedParams;
    try {
      validatedParams = BlockStatsRequestSchema.parse(requestParams);
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: {
          type: BlockExplorerErrorType.VALIDATION_ERROR,
          message: error.errors?.[0]?.message || 'Invalid request parameters',
          retryable: false
        },
        timestamp: Date.now()
      }, { status: 400 });
    }

    // Fetch basic stats and additional network info
    let stats, connection, epochInfo;
    try {
      [stats, connection] = await Promise.all([
        getBlockStats(),
        getConnection()
      ]);

      epochInfo = await connection.getEpochInfo();
    } catch (error: any) {
      console.error('Error fetching block stats:', error);

      return NextResponse.json({
        success: false,
        error: {
          type: BlockExplorerErrorType.NETWORK_ERROR,
          message: error.message || 'Failed to fetch block statistics',
          retryable: true,
          retryAfter: 5
        },
        timestamp: Date.now()
      }, {
        status: 500,
        headers: { 'Retry-After': '5' }
      });
    }

    // Calculate additional metrics
    let recentBlockMetrics;
    try {
      // Get recent performance samples for more detailed metrics
      const performanceSamples = await connection.getRecentPerformanceSamples(
        Math.min(validatedParams.lookbackSlots / 10, 20) // Sample every ~10 blocks, max 20 samples
      );

      if (performanceSamples.length > 0) {
        const totalTransactions = performanceSamples.reduce((sum, sample) => sum + sample.numTransactions, 0);
        const totalSlots = performanceSamples.reduce((sum, sample) => sum + sample.numSlots, 0);
        const averageFees = totalSlots > 0 ? (totalTransactions * 0.000005) / totalSlots : 0; // Rough estimate
        const averageTransactionCount = totalSlots > 0 ? totalTransactions / totalSlots : 0;

        // Determine network health based on TPS and block time
        let networkHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
        if (stats.recentTPS > 2000 && stats.avgBlockTime < 0.5) {
          networkHealth = 'excellent';
        } else if (stats.recentTPS > 1000 && stats.avgBlockTime < 0.6) {
          networkHealth = 'good';
        } else if (stats.recentTPS > 500 && stats.avgBlockTime < 0.8) {
          networkHealth = 'fair';
        } else {
          networkHealth = 'poor';
        }

        recentBlockMetrics = {
          averageFees,
          averageTransactionCount,
          averageSuccessRate: 95, // Rough estimate - will be enhanced with actual data
          networkHealth
        };
      } else {
        recentBlockMetrics = {
          averageFees: 0,
          averageTransactionCount: 0,
          averageSuccessRate: 95,
          networkHealth: 'good' as const
        };
      }
    } catch (error) {
      console.warn('Error calculating recent block metrics:', error);
      recentBlockMetrics = {
        averageFees: 0,
        averageTransactionCount: 0,
        averageSuccessRate: 95,
        networkHealth: 'good' as const
      };
    }

    // Get validator count
    let validatorCount = 0;
    try {
      const voteAccounts = await connection.getVoteAccounts();
      validatorCount = voteAccounts.current.length + voteAccounts.delinquent.length;
    } catch (error) {
      console.warn('Error fetching validator count:', error);
      validatorCount = 1000; // Rough estimate
    }

    // Construct enhanced response
    const response = {
      success: true,
      data: {
        currentSlot: stats.currentSlot,
        averageBlockTime: stats.avgBlockTime,
        recentTPS: stats.recentTPS,
        totalTransactions: stats.totalTransactions,
        validatorCount,
        epochInfo: {
          epoch: epochInfo.epoch,
          slotIndex: epochInfo.slotIndex,
          slotsInEpoch: epochInfo.slotsInEpoch,
          absoluteSlot: epochInfo.absoluteSlot
        },
        recentBlockMetrics
      },
      timestamp: Date.now(),
      cached: false,
      processingTime: Date.now() - startTime
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30', // 10 sec cache, 30 sec stale
        'X-Processing-Time': (Date.now() - startTime).toString()
      }
    });

  } catch (error: any) {
    console.error('Unexpected error in block stats API:', error);

    return NextResponse.json({
      success: false,
      error: {
        type: BlockExplorerErrorType.NETWORK_ERROR,
        message: 'Internal server error',
        retryable: true,
        retryAfter: 5
      },
      timestamp: Date.now()
    }, {
      status: 500,
      headers: { 'Retry-After': '5' }
    });
  }
}