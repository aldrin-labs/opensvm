export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getBlockDetails } from '@/lib/solana';
import { validateBlockDetailRequest, createValidationError } from '@/lib/validation/block-schemas';
import { AdvancedRateLimiter, createRateLimitMiddleware } from '@/lib/rate-limiter';
import { BlockExplorerErrorType } from '@/lib/types/block.types';

// Rate limiter for block detail requests (100 requests per minute)
const blockDetailLimiter = new AdvancedRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
  burstLimit: 120,
  keyPrefix: 'block_detail'
});

const rateLimitMiddleware = createRateLimitMiddleware(blockDetailLimiter);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slot: string }> }
) {
  const startTime = Date.now();
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Get and validate parameters
    const params = await context.params;
    const { slot } = params;
    const searchParams = request.nextUrl.searchParams;
    
    const requestParams = {
      slot,
      includeAnalytics: searchParams.get('includeAnalytics'),
      includeTransactions: searchParams.get('includeTransactions'),
      includePrograms: searchParams.get('includePrograms'),
      includeAccounts: searchParams.get('includeAccounts'),
      includeTransfers: searchParams.get('includeTransfers')
    };

    let validatedParams;
    try {
      validatedParams = validateBlockDetailRequest(requestParams);
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: createValidationError(error.message),
        timestamp: Date.now()
      }, { status: 400 });
    }

    // Fetch block details using existing function
    let blockDetails;
    try {
      blockDetails = await getBlockDetails(validatedParams.slot);
    } catch (error: any) {
      console.error('Error fetching block details:', error);
      
      // Determine error type and appropriate response
      let errorType = BlockExplorerErrorType.NETWORK_ERROR;
      let statusCode = 500;
      let retryable = true;
      
      if (error.message?.includes('Block not found') || error.message?.includes('not available')) {
        errorType = BlockExplorerErrorType.BLOCK_NOT_FOUND;
        statusCode = 404;
        retryable = false;
      } else if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        errorType = BlockExplorerErrorType.RATE_LIMIT_ERROR;
        statusCode = 429;
        retryable = true;
      }

      return NextResponse.json({
        success: false,
        error: {
          type: errorType,
          message: error.message || 'Failed to fetch block data',
          retryable,
          retryAfter: retryable ? 5 : undefined
        },
        timestamp: Date.now()
      }, { 
        status: statusCode,
        headers: retryable ? { 'Retry-After': '5' } : {}
      });
    }

    // TODO: Add analytics processing based on request parameters
    // This will be implemented in subsequent tasks
    const analytics = {
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
        blockSlot: validatedParams.slot,
        totalVisits: 0,
        uniqueVisitors: 0,
        lastUpdated: Date.now()
      }
    };

    // Construct enhanced response
    const response = {
      success: true,
      data: {
        ...blockDetails,
        blockHeight: blockDetails.slot, // Temporary - will be enhanced
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
          transactionCount: blockDetails.transactionCount,
          successfulTransactions: blockDetails.successCount,
          failedTransactions: blockDetails.failureCount,
          totalFees: blockDetails.totalFees,
          computeUnitsConsumed: 0, // Will be enhanced
          averageTransactionSize: blockDetails.transactionCount > 0 ? blockDetails.totalFees / blockDetails.transactionCount : 0,
          blockProcessingTime: 0, // Will be enhanced
          networkEfficiency: blockDetails.transactionCount > 0 ? (blockDetails.successCount / blockDetails.transactionCount) * 100 : 100,
          successRate: blockDetails.transactionCount > 0 ? (blockDetails.successCount / blockDetails.transactionCount) * 100 : 100,
          averageFeePerTransaction: blockDetails.transactionCount > 0 ? blockDetails.totalFees / blockDetails.transactionCount : 0,
          computeUnitsPerTransaction: 0, // Will be enhanced
          blockTimeDelta: blockDetails.blockTimeDelta
        },
        ...analytics
      },
      timestamp: Date.now(),
      processingTime: Date.now() - startTime
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
        'X-Processing-Time': (Date.now() - startTime).toString()
      }
    });

  } catch (error: any) {
    console.error('Unexpected error in block detail API:', error);
    
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