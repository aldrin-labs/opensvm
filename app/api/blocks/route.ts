export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRecentBlocks } from '@/lib/blockchain/block-data-optimized';
import { validateBlockListRequest, createValidationError } from '@/lib/validation/block-schemas';
import { AdvancedRateLimiter, createRateLimitMiddleware } from '@/lib/api/rate-limiter';
import { BlockExplorerErrorType } from '@/lib/types/block.types';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Rate limiter for block list requests (200 requests per minute)
const blockListLimiter = new AdvancedRateLimiter({
  maxRequests: 200,
  windowMs: 60 * 1000,
  burstLimit: 250,
  keyPrefix: 'block_list'
});

const rateLimitMiddleware = createRateLimitMiddleware(blockListLimiter);

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
    const requestParams = {
      limit: searchParams.get('limit') || undefined,
      before: searchParams.get('before') || undefined,
      validator: searchParams.get('validator') || undefined,
      includeAnalytics: searchParams.get('includeAnalytics') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined
    };

    // Filter out undefined values to let the schema apply defaults
    const filteredParams = Object.fromEntries(
      Object.entries(requestParams).filter(([_, value]) => value !== undefined)
    );

    let validatedParams;
    try {
      validatedParams = validateBlockListRequest(filteredParams);
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: createValidationError(error.message),
        timestamp: Date.now()
      }, { status: 400 });
    }

    // Fetch blocks using existing function
    let blocksResponse;
    try {
      blocksResponse = await getRecentBlocks(
        validatedParams.limit,
        validatedParams.before
      );
    } catch (error: any) {
      console.error('Error fetching blocks list:', error);

      return NextResponse.json({
        success: false,
        error: {
          type: BlockExplorerErrorType.NETWORK_ERROR,
          message: error.message || 'Failed to fetch blocks list',
          retryable: true,
          retryAfter: 5
        },
        timestamp: Date.now()
      }, {
        status: 500,
        headers: { 'Retry-After': '5' }
      });
    }

    // Filter by validator if specified
    let filteredBlocks = blocksResponse.blocks;
    if (validatedParams.validator) {
      // Filter blocks by validator vote account
      // Check if the validator received rewards in the block (indicating they produced it)
      filteredBlocks = blocksResponse.blocks.filter(block => {
        return block.rewards.some(reward =>
          reward.pubkey === validatedParams.validator &&
          (reward.rewardType === 'Voting' || reward.rewardType === 'Fee')
        );
      });

      console.log(`Filtered ${blocksResponse.blocks.length} blocks to ${filteredBlocks.length} blocks for validator: ${validatedParams.validator}`);
    }

    // Sort blocks based on sortBy parameter
    if (validatedParams.sortBy !== 'slot') {
      filteredBlocks.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        switch (validatedParams.sortBy) {
          case 'timestamp':
            aValue = a.timestamp || 0;
            bValue = b.timestamp || 0;
            break;
          case 'transactionCount':
            aValue = a.transactionCount;
            bValue = b.transactionCount;
            break;
          case 'totalFees':
            aValue = a.totalFees;
            bValue = b.totalFees;
            break;
          default:
            aValue = a.slot;
            bValue = b.slot;
        }

        return validatedParams.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    // Transform blocks to enhanced format
    const enhancedBlocks = filteredBlocks.map(block => ({
      ...block,
      blockHeight: block.slot, // Temporary - will be enhanced
      validator: {
        address: 'unknown', // Will be enhanced with validator lookup
        name: undefined,
        commission: 0,
        activatedStake: 0,
        performance: {
          uptime: 0,
          skipRate: 0,
          averageBlockTime: 0.4,
          rank: 0,
          blocksProduced: 0,
          expectedBlocks: 0,
          voteAccuracy: 0,
          performanceScore: 0
        }
      },
      metrics: {
        transactionCount: block.transactionCount,
        successfulTransactions: block.successCount,
        failedTransactions: block.failureCount,
        totalFees: block.totalFees,
        computeUnitsConsumed: 0, // Will be enhanced
        averageTransactionSize: block.transactionCount > 0 ? block.totalFees / block.transactionCount : 0,
        blockProcessingTime: 0, // Will be enhanced
        networkEfficiency: block.transactionCount > 0 ? (block.successCount / block.transactionCount) * 100 : 100,
        successRate: block.transactionCount > 0 ? (block.successCount / block.transactionCount) * 100 : 100,
        averageFeePerTransaction: block.transactionCount > 0 ? block.totalFees / block.transactionCount : 0,
        computeUnitsPerTransaction: 0, // Will be enhanced
        blockTimeDelta: block.blockTimeDelta
      },
      // Add placeholder analytics if requested
      ...(validatedParams.includeAnalytics ? {
        programStats: [],
        accountActivity: {
          address: '',
          rank: 0,
          volume: 0,
          transactionCount: 0,
          tokens: [],
          riskScore: 0,
          labels: [],
          accountType: 'wallet' as const
        },
        transfers: [],
        visitStats: {
          blockSlot: block.slot,
          totalVisits: 0,
          uniqueVisitors: 0,
          lastUpdated: Date.now()
        }
      } : {})
    }));

    // Construct response
    const response = {
      success: true,
      data: enhancedBlocks,
      pagination: {
        hasMore: blocksResponse.hasMore,
        cursor: blocksResponse.cursor,
        totalCount: undefined, // Will be enhanced when we have total count
        limit: validatedParams.limit,
        filters: validatedParams.validator ? {
          validator: validatedParams.validator
        } : undefined
      },
      timestamp: Date.now(),
      processingTime: Date.now() - startTime
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120', // 60 sec cache for better performance
        'X-Processing-Time': (Date.now() - startTime).toString()
      }
    });

  } catch (error: any) {
    console.error('Unexpected error in blocks list API:', error);

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
