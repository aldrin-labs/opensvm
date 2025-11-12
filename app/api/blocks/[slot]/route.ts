export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getBlockDetails } from '@/lib/solana';
import { validateBlockDetailRequest, createValidationError } from '@/lib/validation/block-schemas';
import { AdvancedRateLimiter, createRateLimitMiddleware } from '@/lib/rate-limiter';
import { BlockExplorerErrorType } from '@/lib/types/block.types';
import { createCache } from '@/lib/api-cache';

// Create cache instance for block details (5 min cache, 1 min refresh threshold)
const blockDetailsCache = createCache<any>({
  duration: 5 * 60 * 1000,
  refreshThreshold: 60 * 1000
});

/**
 * Process block analytics based on request parameters
 */
async function processBlockAnalytics(params: any, blockDetails: any) {
  const analytics: any = {
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
      blockSlot: params.slot,
      totalVisits: 0,
      uniqueVisitors: 0,
      lastUpdated: Date.now()
    }
  };

  try {
    // Process program statistics if requested
    if (params.includePrograms === 'true') {
      analytics.programStats = await processProgramStats(blockDetails);
    }

    // Process account activity if requested
    if (params.includeAccounts === 'true') {
      analytics.accountActivity = await processAccountActivity(blockDetails);
    }

    // Process transfers if requested
    if (params.includeTransfers === 'true') {
      analytics.transfers = await processTransfers(blockDetails);
    }

    // Process analytics if requested
    if (params.includeAnalytics === 'true') {
      analytics.visitStats = await processVisitStats(params.slot);
    }

    console.log(`Processed analytics for block ${params.slot} with ${Object.keys(analytics).length} categories`);
  } catch (error) {
    console.error('Error processing block analytics:', error);
  }

  return analytics;
}

/**
 * Process program statistics from block data
 */
async function processProgramStats(blockDetails: any) {
  const programStats: any[] = [];

  if (blockDetails.transactions) {
    const programCounts = new Map<string, number>();

    blockDetails.transactions.forEach((tx: any) => {
      if (tx.meta?.logMessages) {
        tx.meta.logMessages.forEach((log: string) => {
          if (log.includes('Program')) {
            const programMatch = log.match(/Program ([A-Za-z0-9]+) invoke/);
            if (programMatch) {
              const programId = programMatch[1];
              programCounts.set(programId, (programCounts.get(programId) || 0) + 1);
            }
          }
        });
      }
    });

    // Convert to array format
    programCounts.forEach((count, programId) => {
      programStats.push({
        programId,
        invocationCount: count,
        percentage: (count / blockDetails.transactionCount) * 100
      });
    });
  }

  return programStats;
}

/**
 * Process account activity from block data
 */
async function processAccountActivity(blockDetails: any) {
  const accountActivity = {
    address: '',
    rank: 0,
    volume: 0,
    transactionCount: 0,
    tokens: [],
    riskScore: 0,
    labels: [],
    accountType: 'wallet' as const
  };

  if (blockDetails.transactions) {
    const accountCounts = new Map<string, number>();

    blockDetails.transactions.forEach((tx: any) => {
      if (tx.transaction?.message?.accountKeys) {
        tx.transaction.message.accountKeys.forEach((account: string) => {
          accountCounts.set(account, (accountCounts.get(account) || 0) + 1);
        });
      }
    });

    // Find most active account
    let maxCount = 0;
    let mostActiveAccount = '';

    accountCounts.forEach((count, account) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveAccount = account;
      }
    });

    if (mostActiveAccount) {
      accountActivity.address = mostActiveAccount;
      accountActivity.transactionCount = maxCount;
      accountActivity.volume = maxCount * 0.000005; // Estimate SOL volume
    }
  }

  return accountActivity;
}

/**
 * Process transfers from block data
 */
async function processTransfers(blockDetails: any) {
  const transfers: any[] = [];

  if (blockDetails.transactions) {
    blockDetails.transactions.forEach((tx: any) => {
      if (tx.meta?.postTokenBalances && tx.meta?.preTokenBalances) {
        // Process token balance changes
        const balanceChanges = new Map<string, number>();

        tx.meta.preTokenBalances.forEach((balance: any) => {
          const key = `${balance.accountIndex}_${balance.mint}`;
          balanceChanges.set(key, -(balance.uiTokenAmount?.uiAmount || 0));
        });

        tx.meta.postTokenBalances.forEach((balance: any) => {
          const key = `${balance.accountIndex}_${balance.mint}`;
          const current = balanceChanges.get(key) || 0;
          balanceChanges.set(key, current + (balance.uiTokenAmount?.uiAmount || 0));
        });

        // Add significant transfers
        balanceChanges.forEach((change, key) => {
          if (Math.abs(change) > 0.001) { // Filter significant transfers
            const [accountIndex, mint] = key.split('_');
            transfers.push({
              from: accountIndex,
              to: accountIndex, // Simplified - would need more complex logic
              amount: Math.abs(change),
              mint,
              signature: tx.transaction.signatures[0]
            });
          }
        });
      }
    });
  }

  return transfers;
}

/**
 * Process visit statistics for the block
 */
async function processVisitStats(slot: string) {
  return {
    blockSlot: slot,
    totalVisits: Math.floor(Math.random() * 100) + 1, // Mock data
    uniqueVisitors: Math.floor(Math.random() * 50) + 1, // Mock data
    lastUpdated: Date.now()
  };
}

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

    // Use cache with background refresh
    const cacheKey = `${validatedParams.slot}-${validatedParams.includeAnalytics}-${validatedParams.includePrograms}-${validatedParams.includeAccounts}-${validatedParams.includeTransfers}`;
    
    const result = await blockDetailsCache.get(cacheKey, async () => {
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

        throw new Error(JSON.stringify({
          success: false,
          error: {
            type: errorType,
            message: error.message || 'Failed to fetch block data',
            retryable,
            retryAfter: retryable ? 5 : undefined
          },
          timestamp: Date.now(),
          statusCode,
          headers: retryable ? { 'Retry-After': '5' } : {}
        }));
      }

      // Process analytics based on request parameters
      const analytics = await processBlockAnalytics(validatedParams, blockDetails);

      // Construct enhanced response
      return {
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
    });

    return NextResponse.json({
      ...result.data,
      cached: result.cached,
      cacheAge: result.cacheAge
    }, {
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
