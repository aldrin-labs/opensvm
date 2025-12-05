#!/usr/bin/env bun
/**
 * Liquidity Mining MCP Server
 *
 * Exposes 15 tools for AI agents to:
 * - Manage liquidity pools
 * - Add/remove liquidity positions
 * - Claim rewards
 * - Track statistics and leaderboards
 * - Integrate with SVMAI staking for compound boosts
 *
 * Usage:
 *   bun run src/mcp-liquidity-mining.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  LiquidityMiningEngine,
  getLiquidityMiningEngine,
  LockDuration,
  Platform,
} from './prediction-liquidity-mining.js';

import {
  StakingIntegration,
  getStakingIntegration,
} from './staking-lp-integration.js';

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'liquidity-mining-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// Get singleton instances
const miningEngine = getLiquidityMiningEngine();
const stakingIntegration = getStakingIntegration();

// ============================================================================
// Tool Definitions (15 tools)
// ============================================================================

const TOOLS = [
  // --------------------------------------------------------------------------
  // Pool Management
  // --------------------------------------------------------------------------
  {
    name: 'lp_create_pool',
    description: 'Create a new liquidity pool for a prediction market',
    inputSchema: {
      type: 'object',
      properties: {
        market_id: { type: 'string', description: 'Market ticker/ID' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'], description: 'Platform' },
        title: { type: 'string', description: 'Pool title' },
        boost: { type: 'number', description: 'Market boost multiplier (1-3x, default: 1)' },
      },
      required: ['market_id', 'platform', 'title'],
    },
  },
  {
    name: 'lp_get_pool',
    description: 'Get pool details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string', description: 'Pool ID' },
      },
      required: ['pool_id'],
    },
  },
  {
    name: 'lp_list_pools',
    description: 'List all active liquidity pools',
    inputSchema: {
      type: 'object',
      properties: {
        include_inactive: { type: 'boolean', description: 'Include inactive pools' },
      },
    },
  },
  {
    name: 'lp_set_boost',
    description: 'Set market boost multiplier for a pool (admin)',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string', description: 'Pool ID' },
        boost: { type: 'number', description: 'New boost multiplier (1-3)' },
      },
      required: ['pool_id', 'boost'],
    },
  },

  // --------------------------------------------------------------------------
  // Liquidity Positions
  // --------------------------------------------------------------------------
  {
    name: 'lp_add_liquidity',
    description: 'Add liquidity to a pool and receive LP tokens. Lock duration affects reward boost.',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string', description: 'Pool ID' },
        provider: { type: 'string', description: 'Wallet address' },
        amount: { type: 'number', description: 'Amount in USD' },
        lock_duration: {
          type: 'string',
          enum: ['7d', '30d', '90d', '180d', '365d'],
          description: 'Lock duration (longer = higher boost)',
        },
        referrer: { type: 'string', description: 'Referrer wallet address (optional)' },
      },
      required: ['pool_id', 'provider', 'amount', 'lock_duration'],
    },
  },
  {
    name: 'lp_remove_liquidity',
    description: 'Remove liquidity from a pool. Early withdrawal incurs 10% penalty.',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string', description: 'Position ID' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp_get_position',
    description: 'Get position details including pending rewards',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string', description: 'Position ID' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp_get_positions',
    description: 'Get all positions for a wallet address',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Wallet address' },
      },
      required: ['provider'],
    },
  },

  // --------------------------------------------------------------------------
  // Rewards
  // --------------------------------------------------------------------------
  {
    name: 'lp_claim_rewards',
    description: 'Claim pending SVMAI rewards from a position',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string', description: 'Position ID' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp_get_pending_rewards',
    description: 'Get pending rewards for a position without claiming',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string', description: 'Position ID' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp_get_apr',
    description: 'Get estimated APR for a pool or position',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string', description: 'Pool ID (for pool APR)' },
        position_id: { type: 'string', description: 'Position ID (for position APR with boost)' },
        token_price: { type: 'number', description: 'SVMAI price in USD (default: 1)' },
      },
    },
  },

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------
  {
    name: 'lp_get_provider_stats',
    description: 'Get comprehensive stats for a liquidity provider',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Wallet address' },
      },
      required: ['provider'],
    },
  },
  {
    name: 'lp_get_global_stats',
    description: 'Get global liquidity mining statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'lp_get_leaderboard',
    description: 'Get top liquidity providers',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of entries (default: 10)' },
        pool_id: { type: 'string', description: 'Pool ID for pool-specific leaderboard (optional)' },
      },
    },
  },

  // --------------------------------------------------------------------------
  // Staking Integration
  // --------------------------------------------------------------------------
  {
    name: 'lp_get_staking_boost',
    description: 'Get compound boost from SVMAI staking + LP position',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Wallet address' },
        position_id: { type: 'string', description: 'LP Position ID' },
      },
      required: ['provider'],
    },
  },
];

// ============================================================================
// Prompts
// ============================================================================

const PROMPTS = [
  {
    name: 'optimize_liquidity',
    description: 'Analyze positions and suggest optimal liquidity allocation',
    arguments: [
      { name: 'provider', description: 'Wallet address', required: true },
      { name: 'budget', description: 'Available USD to allocate', required: false },
    ],
  },
  {
    name: 'yield_analysis',
    description: 'Compare yields across pools and recommend best options',
    arguments: [],
  },
];

// ============================================================================
// Tool Handler
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Pool Management
      case 'lp_create_pool': {
        const pool = miningEngine.createPool(
          args.market_id as string,
          args.platform as Platform,
          args.title as string,
          (args.boost as number) || 1.0
        );
        result = {
          success: true,
          pool: {
            id: pool.id,
            marketId: pool.marketId,
            platform: pool.platform,
            title: pool.title,
            boostMultiplier: pool.boostMultiplier,
            isActive: pool.isActive,
            totalLiquidity: pool.totalLiquidity,
          },
        };
        break;
      }

      case 'lp_get_pool': {
        const pool = miningEngine.getPool(args.pool_id as string);
        if (!pool) throw new Error('Pool not found');

        const apr = miningEngine.getPoolAPR(pool.id, 1);
        result = {
          id: pool.id,
          marketId: pool.marketId,
          platform: pool.platform,
          title: pool.title,
          totalLiquidity: pool.totalLiquidity,
          totalShares: pool.totalShares,
          boostMultiplier: pool.boostMultiplier,
          rewardRate: pool.rewardRate,
          isActive: pool.isActive,
          estimatedAPR: apr,
          createdAt: new Date(pool.createdAt).toISOString(),
        };
        break;
      }

      case 'lp_list_pools': {
        const includeInactive = args.include_inactive as boolean;
        const pools = includeInactive
          ? Array.from((miningEngine as any).pools.values())
          : miningEngine.getActivePools();

        result = pools.map((p: any) => ({
          id: p.id,
          marketId: p.marketId,
          platform: p.platform,
          title: p.title,
          totalLiquidity: p.totalLiquidity,
          boostMultiplier: p.boostMultiplier,
          isActive: p.isActive,
          apr: miningEngine.getPoolAPR(p.id, 1),
        }));
        break;
      }

      case 'lp_set_boost': {
        miningEngine.setPoolBoost(args.pool_id as string, args.boost as number);
        const pool = miningEngine.getPool(args.pool_id as string);
        result = {
          success: true,
          poolId: args.pool_id,
          newBoost: pool?.boostMultiplier,
        };
        break;
      }

      // Liquidity Positions
      case 'lp_add_liquidity': {
        const position = miningEngine.addLiquidity(
          args.pool_id as string,
          args.provider as string,
          args.amount as number,
          args.lock_duration as LockDuration,
          args.referrer as string | undefined
        );

        // Get staking boost if applicable
        const stakingBoost = stakingIntegration.getCompoundBoost(
          args.provider as string,
          position.lockBoost
        );

        result = {
          success: true,
          position: {
            id: position.id,
            poolId: position.poolId,
            provider: position.provider,
            liquidity: position.liquidity,
            shares: position.shares,
            lockDuration: position.lockDuration,
            lockExpiry: new Date(position.lockExpiry).toISOString(),
            lockBoost: position.lockBoost,
            referrer: position.referrer,
          },
          stakingBoost: stakingBoost.totalBoost,
          effectiveBoost: position.lockBoost * stakingBoost.stakingMultiplier,
        };
        break;
      }

      case 'lp_remove_liquidity': {
        const removal = miningEngine.removeLiquidity(args.position_id as string);
        result = {
          success: true,
          liquidityReturned: removal.liquidity,
          rewardsClaimed: removal.rewards,
          penalty: removal.penalty,
          penaltyApplied: removal.penalty > 0,
        };
        break;
      }

      case 'lp_get_position': {
        const position = miningEngine.getPosition(args.position_id as string);
        if (!position) throw new Error('Position not found');

        const pendingRewards = miningEngine.getPendingRewards(position.id);
        const apr = miningEngine.getPositionAPR(position.id, 1);
        const stakingBoost = stakingIntegration.getCompoundBoost(
          position.provider,
          position.lockBoost
        );

        result = {
          id: position.id,
          poolId: position.poolId,
          provider: position.provider,
          liquidity: position.liquidity,
          shares: position.shares,
          lockDuration: position.lockDuration,
          lockExpiry: new Date(position.lockExpiry).toISOString(),
          isLocked: Date.now() < position.lockExpiry,
          lockBoost: position.lockBoost,
          pendingRewards,
          claimedRewards: position.claimedRewards,
          totalRewards: pendingRewards + position.claimedRewards,
          estimatedAPR: apr,
          stakingBoost: stakingBoost.totalBoost,
          referrer: position.referrer,
          createdAt: new Date(position.createdAt).toISOString(),
        };
        break;
      }

      case 'lp_get_positions': {
        const positions = miningEngine.getProviderPositions(args.provider as string);
        result = positions.map(pos => ({
          id: pos.id,
          poolId: pos.poolId,
          liquidity: pos.liquidity,
          lockDuration: pos.lockDuration,
          lockBoost: pos.lockBoost,
          isLocked: Date.now() < pos.lockExpiry,
          pendingRewards: miningEngine.getPendingRewards(pos.id),
          claimedRewards: pos.claimedRewards,
        }));
        break;
      }

      // Rewards
      case 'lp_claim_rewards': {
        const claim = miningEngine.claimRewards(args.position_id as string);
        result = {
          success: true,
          claim: {
            id: claim.id,
            positionId: claim.positionId,
            provider: claim.provider,
            amount: claim.amount,
            timestamp: new Date(claim.timestamp).toISOString(),
          },
        };
        break;
      }

      case 'lp_get_pending_rewards': {
        const pending = miningEngine.getPendingRewards(args.position_id as string);
        result = {
          positionId: args.position_id,
          pendingRewards: pending,
        };
        break;
      }

      case 'lp_get_apr': {
        const tokenPrice = (args.token_price as number) || 1;

        if (args.position_id) {
          result = {
            positionId: args.position_id,
            apr: miningEngine.getPositionAPR(args.position_id as string, tokenPrice),
            tokenPrice,
          };
        } else if (args.pool_id) {
          result = {
            poolId: args.pool_id,
            apr: miningEngine.getPoolAPR(args.pool_id as string, tokenPrice),
            tokenPrice,
          };
        } else {
          throw new Error('Must provide pool_id or position_id');
        }
        break;
      }

      // Statistics
      case 'lp_get_provider_stats': {
        const stats = miningEngine.getProviderStats(args.provider as string);
        const stakingBoost = stakingIntegration.getCompoundBoost(args.provider as string, 1);

        result = {
          provider: args.provider,
          ...stats,
          stakingInfo: stakingBoost,
        };
        break;
      }

      case 'lp_get_global_stats': {
        result = miningEngine.getGlobalStats();
        break;
      }

      case 'lp_get_leaderboard': {
        const limit = (args.limit as number) || 10;

        if (args.pool_id) {
          result = miningEngine.getPoolLeaderboard(args.pool_id as string, limit);
        } else {
          result = miningEngine.getLeaderboard(limit);
        }
        break;
      }

      // Staking Integration
      case 'lp_get_staking_boost': {
        const position = args.position_id
          ? miningEngine.getPosition(args.position_id as string)
          : null;

        const lpBoost = position?.lockBoost || 1;
        const boost = stakingIntegration.getCompoundBoost(args.provider as string, lpBoost);

        result = {
          provider: args.provider,
          positionId: args.position_id,
          lpLockBoost: lpBoost,
          stakingMultiplier: boost.stakingMultiplier,
          tierBonus: boost.tierBonus,
          totalBoost: boost.totalBoost,
          tier: boost.tier,
          stakedAmount: boost.stakedAmount,
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Prompts Handler
// ============================================================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'optimize_liquidity':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze liquidity positions for ${args?.provider || 'the user'} and suggest optimizations.

Steps:
1. Use lp_get_positions to see current positions
2. Use lp_get_provider_stats for overall stats
3. Use lp_list_pools to see available pools and their APRs
4. Use lp_get_staking_boost to check staking synergy

${args?.budget ? `Available budget: $${args.budget}` : ''}

Provide recommendations for:
- Which pools to allocate liquidity
- Optimal lock durations considering boost vs flexibility
- Whether to consolidate or diversify positions
- Staking + LP synergy opportunities`,
            },
          },
        ],
      };

    case 'yield_analysis':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze yields across all liquidity mining pools.

Steps:
1. Use lp_list_pools to get all active pools
2. Use lp_get_global_stats for overview
3. For each pool, calculate effective APR at different lock durations
4. Use lp_get_leaderboard to see top performers

Provide:
- Ranking of pools by risk-adjusted yield
- Impact of lock duration on returns
- Comparison of pool boosts
- Recommended allocation strategy`,
            },
          },
        ],
      };

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ============================================================================
// Server Start
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Liquidity Mining server started');
  console.error('[MCP] 15 tools available for yield farming');
}

main().catch(console.error);
