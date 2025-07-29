/**
 * Validation schemas for block explorer API endpoints
 */

import { z } from 'zod';

// ============================================================================
// Basic validation schemas
// ============================================================================

export const SlotSchema = z.coerce.number()
  .int()
  .min(0, 'Slot must be a non-negative integer')
  .max(Number.MAX_SAFE_INTEGER, 'Slot number too large');

export const LimitSchema = z.coerce.number()
  .int()
  .min(1, 'Limit must be at least 1')
  .max(100, 'Limit cannot exceed 100')
  .default(50);

export const ValidatorAddressSchema = z.string()
  .min(32, 'Invalid validator address')
  .max(44, 'Invalid validator address')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 characters');

// ============================================================================
// Block API request schemas
// ============================================================================

export const BlockDetailRequestSchema = z.object({
  slot: SlotSchema,
  includeAnalytics: z.coerce.boolean().default(true),
  includeTransactions: z.coerce.boolean().default(true),
  includePrograms: z.coerce.boolean().default(true),
  includeAccounts: z.coerce.boolean().default(true),
  includeTransfers: z.coerce.boolean().default(true)
});

export const BlockListRequestSchema = z.object({
  limit: LimitSchema,
  before: SlotSchema.optional(),
  validator: ValidatorAddressSchema.optional(),
  includeAnalytics: z.coerce.boolean().default(false),
  sortBy: z.enum(['slot', 'timestamp', 'transactionCount', 'totalFees']).default('slot'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const BlockStatsRequestSchema = z.object({
  lookbackSlots: z.coerce.number()
    .int()
    .min(1, 'Lookback must be at least 1')
    .max(1000, 'Lookback cannot exceed 1000')
    .default(100)
});

export const BlockSearchRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(100, 'Query too long'),
  type: z.enum(['slot', 'blockhash', 'validator']).default('slot'),
  limit: LimitSchema,
  exact: z.coerce.boolean().default(false)
});

export const BlockFiltersSchema = z.object({
  dateRange: z.object({
    start: z.coerce.number().int().min(0),
    end: z.coerce.number().int().min(0)
  }).optional(),
  validator: ValidatorAddressSchema.optional(),
  transactionCountRange: z.object({
    min: z.coerce.number().int().min(0).default(0),
    max: z.coerce.number().int().min(0).optional()
  }).optional(),
  feeRange: z.object({
    min: z.coerce.number().min(0).default(0),
    max: z.coerce.number().min(0).optional()
  }).optional(),
  status: z.enum(['confirmed', 'finalized']).optional(),
  hasAnomalies: z.coerce.boolean().optional()
});

// ============================================================================
// Response validation schemas
// ============================================================================

export const BlockMetricsSchema = z.object({
  transactionCount: z.number().int().min(0),
  successfulTransactions: z.number().int().min(0),
  failedTransactions: z.number().int().min(0),
  totalFees: z.number().min(0),
  computeUnitsConsumed: z.number().int().min(0),
  averageTransactionSize: z.number().min(0),
  blockProcessingTime: z.number().min(0),
  networkEfficiency: z.number().min(0).max(100),
  successRate: z.number().min(0).max(100),
  averageFeePerTransaction: z.number().min(0),
  computeUnitsPerTransaction: z.number().min(0),
  blockTimeDelta: z.number().optional()
});

export const ProgramStatsSchema = z.object({
  programId: z.string(),
  programName: z.string().optional(),
  transactionCount: z.number().int().min(0),
  solVolume: z.number().min(0),
  splTokenVolumes: z.array(z.object({
    mint: z.string(),
    symbol: z.string(),
    amount: z.number().min(0),
    usdValue: z.number().min(0).optional(),
    decimals: z.number().int().min(0),
    percentage: z.number().min(0).max(100)
  })),
  computeUnitsUsed: z.number().int().min(0),
  successRate: z.number().min(0).max(100),
  uniqueUsers: z.number().int().min(0),
  averageComputePerTx: z.number().min(0),
  category: z.string().optional(),
  verified: z.boolean()
});

export const AccountActivitySchema = z.object({
  address: z.string(),
  rank: z.number().int().min(1),
  volume: z.number().min(0),
  pnl: z.number().optional(),
  transactionCount: z.number().int().min(0),
  tokens: z.array(z.object({
    mint: z.string(),
    symbol: z.string(),
    netChange: z.number(),
    usdValue: z.number().min(0).optional(),
    transactionCount: z.number().int().min(0),
    volumeIn: z.number().min(0),
    volumeOut: z.number().min(0),
    firstSeen: z.number().int().min(0),
    lastSeen: z.number().int().min(0)
  })),
  riskScore: z.number().min(0).max(100),
  labels: z.array(z.string()),
  accountType: z.enum(['wallet', 'program', 'token_account', 'system'])
});

export const SimpleTransferSchema = z.object({
  rank: z.number().int().min(1),
  fromAddress: z.string(),
  toAddress: z.string(),
  tokenMint: z.string(),
  tokenSymbol: z.string(),
  amount: z.number().min(0),
  usdValue: z.number().min(0).optional(),
  signature: z.string(),
  timestamp: z.number().int().min(0),
  transferType: z.enum(['direct', 'program_mediated']),
  verified: z.boolean()
});

// ============================================================================
// Error response schema
// ============================================================================

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    type: z.enum([
      'INVALID_SLOT',
      'BLOCK_NOT_FOUND',
      'NETWORK_ERROR',
      'ANALYTICS_ERROR',
      'CACHE_ERROR',
      'RATE_LIMIT_ERROR',
      'VALIDATION_ERROR',
      'PERMISSION_ERROR'
    ]),
    message: z.string(),
    details: z.any().optional(),
    code: z.string().optional(),
    retryable: z.boolean(),
    retryAfter: z.number().optional()
  }),
  timestamp: z.number().int()
});

// ============================================================================
// Success response schemas
// ============================================================================

export const BlockDataResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    slot: z.number().int().min(0),
    blockhash: z.string(),
    parentSlot: z.number().int().min(0),
    blockTime: z.number().int().nullable(),
    blockHeight: z.number().int().min(0),
    previousBlockhash: z.string(),
    timestamp: z.number().int().min(0),
    transactions: z.array(z.object({
      signature: z.string(),
      type: z.enum(['Success', 'Failed']),
      timestamp: z.number().int().nullable()
    })),
    rewards: z.array(z.object({
      pubkey: z.string(),
      lamports: z.number().int(),
      postBalance: z.number().int(),
      rewardType: z.string(),
      commission: z.number().optional()
    })),
    validator: z.object({
      address: z.string(),
      name: z.string().optional(),
      commission: z.number().min(0).max(100),
      activatedStake: z.number().min(0),
      performance: z.object({
        uptime: z.number().min(0).max(100),
        skipRate: z.number().min(0).max(100),
        averageBlockTime: z.number().min(0),
        rank: z.number().int().min(1),
        blocksProduced: z.number().int().min(0),
        expectedBlocks: z.number().int().min(0),
        voteAccuracy: z.number().min(0).max(100),
        performanceScore: z.number().min(0).max(100)
      }),
      identity: z.object({
        name: z.string().optional(),
        website: z.string().optional(),
        keybaseUsername: z.string().optional(),
        details: z.string().optional()
      }).optional()
    }),
    metrics: BlockMetricsSchema,
    programStats: z.array(ProgramStatsSchema),
    accountActivity: AccountActivitySchema,
    transfers: z.array(SimpleTransferSchema),
    visitStats: z.object({
      blockSlot: z.number().int().min(0),
      totalVisits: z.number().int().min(0),
      uniqueVisitors: z.number().int().min(0),
      lastUpdated: z.number().int().min(0)
    })
  }),
  timestamp: z.number().int(),
  cached: z.boolean().optional(),
  processingTime: z.number().min(0).optional()
});

export const BlockListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(BlockDataResponseSchema.shape.data),
  pagination: z.object({
    hasMore: z.boolean(),
    cursor: z.number().int().optional(),
    totalCount: z.number().int().optional(),
    limit: z.number().int().min(1),
    filters: BlockFiltersSchema.optional()
  }),
  timestamp: z.number().int(),
  cached: z.boolean().optional()
});

export const BlockStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    currentSlot: z.number().int().min(0),
    averageBlockTime: z.number().min(0),
    recentTPS: z.number().min(0),
    totalTransactions: z.number().int().min(0),
    validatorCount: z.number().int().min(0),
    epochInfo: z.object({
      epoch: z.number().int().min(0),
      slotIndex: z.number().int().min(0),
      slotsInEpoch: z.number().int().min(0),
      absoluteSlot: z.number().int().min(0)
    }),
    recentBlockMetrics: z.object({
      averageFees: z.number().min(0),
      averageTransactionCount: z.number().min(0),
      averageSuccessRate: z.number().min(0).max(100),
      networkHealth: z.enum(['excellent', 'good', 'fair', 'poor'])
    })
  }),
  timestamp: z.number().int(),
  cached: z.boolean().optional()
});

// ============================================================================
// Utility functions for validation
// ============================================================================

export function validateSlot(slot: unknown): number {
  const result = SlotSchema.safeParse(slot);
  if (!result.success) {
    throw new Error(`Invalid slot: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function validateBlockListRequest(params: unknown) {
  const result = BlockListRequestSchema.safeParse(params);
  if (!result.success) {
    throw new Error(`Invalid request parameters: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function validateBlockDetailRequest(params: unknown) {
  const result = BlockDetailRequestSchema.safeParse(params);
  if (!result.success) {
    throw new Error(`Invalid request parameters: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function createValidationError(message: string, details?: any) {
  return {
    type: 'VALIDATION_ERROR' as const,
    message,
    details,
    retryable: false,
    timestamp: Date.now()
  };
}