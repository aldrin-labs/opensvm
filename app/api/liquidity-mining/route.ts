import { NextRequest, NextResponse } from 'next/server';

/**
 * Liquidity Mining REST API
 *
 * Endpoints:
 * GET  /api/liquidity-mining - Get global stats
 * GET  /api/liquidity-mining?pools=true - List all pools
 * GET  /api/liquidity-mining?leaderboard=true - Get leaderboard
 * POST /api/liquidity-mining - Create pool (admin)
 */

// In-memory storage (in production, use database)
interface Pool {
  id: string;
  marketId: string;
  platform: string;
  title: string;
  totalLiquidity: number;
  totalShares: number;
  boostMultiplier: number;
  rewardRate: number;
  isActive: boolean;
  createdAt: number;
}

interface Position {
  id: string;
  poolId: string;
  provider: string;
  liquidity: number;
  shares: number;
  lockDuration: string;
  lockExpiry: number;
  lockBoost: number;
  pendingRewards: number;
  claimedRewards: number;
  createdAt: number;
}

// Singleton storage
const pools = new Map<string, Pool>();
const positions = new Map<string, Position>();
let poolCounter = 0;

// Lock boost multipliers
const LOCK_BOOSTS: Record<string, number> = {
  '7d': 1.0,
  '30d': 1.25,
  '90d': 1.5,
  '180d': 2.0,
  '365d': 3.0,
};

// GET handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // List pools
    if (searchParams.get('pools') === 'true') {
      const includeInactive = searchParams.get('inactive') === 'true';
      const poolList = Array.from(pools.values())
        .filter(p => includeInactive || p.isActive)
        .map(p => ({
          ...p,
          apr: calculatePoolAPR(p),
        }));

      return NextResponse.json({
        success: true,
        pools: poolList,
        count: poolList.length,
      });
    }

    // Get leaderboard
    if (searchParams.get('leaderboard') === 'true') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const poolId = searchParams.get('poolId');

      const leaderboard = getLeaderboard(limit, poolId || undefined);

      return NextResponse.json({
        success: true,
        leaderboard,
      });
    }

    // Get specific pool
    const poolId = searchParams.get('poolId');
    if (poolId) {
      const pool = pools.get(poolId);
      if (!pool) {
        return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        pool: {
          ...pool,
          apr: calculatePoolAPR(pool),
          positionCount: Array.from(positions.values()).filter(p => p.poolId === poolId).length,
        },
      });
    }

    // Global stats
    const stats = getGlobalStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_pool': {
        const { marketId, platform, title, boost } = body;

        if (!marketId || !platform || !title) {
          return NextResponse.json(
            { error: 'Missing required fields: marketId, platform, title' },
            { status: 400 }
          );
        }

        poolCounter++;
        const pool: Pool = {
          id: `POOL-${poolCounter}`,
          marketId,
          platform,
          title,
          totalLiquidity: 0,
          totalShares: 0,
          boostMultiplier: Math.min(3, Math.max(1, boost || 1)),
          rewardRate: 10, // Base emission rate
          isActive: true,
          createdAt: Date.now(),
        };

        pools.set(pool.id, pool);

        return NextResponse.json({
          success: true,
          pool,
        });
      }

      case 'set_boost': {
        const { poolId, boost } = body;

        const pool = pools.get(poolId);
        if (!pool) {
          return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
        }

        pool.boostMultiplier = Math.min(3, Math.max(1, boost));

        return NextResponse.json({
          success: true,
          poolId,
          newBoost: pool.boostMultiplier,
        });
      }

      case 'deactivate_pool': {
        const { poolId } = body;

        const pool = pools.get(poolId);
        if (!pool) {
          return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
        }

        pool.isActive = false;

        return NextResponse.json({
          success: true,
          poolId,
          isActive: false,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculatePoolAPR(pool: Pool): number {
  if (pool.totalLiquidity === 0) return 0;

  const yearlyEmission = pool.rewardRate * 365 * 24 * 60 * 60;
  const poolYearlyRewards = yearlyEmission * pool.boostMultiplier;

  return (poolYearlyRewards / pool.totalLiquidity) * 100;
}

function getGlobalStats() {
  const allPools = Array.from(pools.values());
  const activePools = allPools.filter(p => p.isActive);
  const totalLiquidity = allPools.reduce((sum, p) => sum + p.totalLiquidity, 0);

  const providers = new Set(Array.from(positions.values()).map(p => p.provider));
  const totalRewardsClaimed = Array.from(positions.values())
    .reduce((sum, p) => sum + p.claimedRewards, 0);

  return {
    totalPools: allPools.length,
    activePools: activePools.length,
    totalLiquidity,
    totalProviders: providers.size,
    totalPositions: positions.size,
    totalRewardsClaimed,
    currentEmissionRate: 10, // Base rate
  };
}

function getLeaderboard(limit: number, poolId?: string) {
  const providerStats = new Map<string, {
    totalLiquidity: number;
    totalRewards: number;
    positionCount: number;
  }>();

  for (const position of positions.values()) {
    if (poolId && position.poolId !== poolId) continue;

    const existing = providerStats.get(position.provider) || {
      totalLiquidity: 0,
      totalRewards: 0,
      positionCount: 0,
    };

    existing.totalLiquidity += position.liquidity;
    existing.totalRewards += position.pendingRewards + position.claimedRewards;
    existing.positionCount++;

    providerStats.set(position.provider, existing);
  }

  return Array.from(providerStats.entries())
    .sort((a, b) => b[1].totalLiquidity - a[1].totalLiquidity)
    .slice(0, limit)
    .map(([provider, stats], index) => ({
      rank: index + 1,
      provider,
      ...stats,
    }));
}

// Export for other routes
export { pools, positions, LOCK_BOOSTS };
