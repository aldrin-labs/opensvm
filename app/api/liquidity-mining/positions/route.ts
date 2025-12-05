import { NextRequest, NextResponse } from 'next/server';
import { pools, positions, LOCK_BOOSTS } from '../route';

/**
 * Liquidity Mining Positions API
 *
 * Endpoints:
 * GET  /api/liquidity-mining/positions?provider=... - Get positions for wallet
 * GET  /api/liquidity-mining/positions?id=... - Get specific position
 * POST /api/liquidity-mining/positions - Add/remove liquidity, claim rewards
 */

let positionCounter = 0;
let claimCounter = 0;

interface Claim {
  id: string;
  positionId: string;
  provider: string;
  amount: number;
  timestamp: number;
}

const claims: Claim[] = [];

// GET handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // Get specific position
    const positionId = searchParams.get('id');
    if (positionId) {
      const position = positions.get(positionId);
      if (!position) {
        return NextResponse.json({ error: 'Position not found' }, { status: 404 });
      }

      const pool = pools.get(position.poolId);
      const pendingRewards = calculatePendingRewards(position, pool);

      return NextResponse.json({
        success: true,
        position: {
          ...position,
          pendingRewards,
          isLocked: Date.now() < position.lockExpiry,
          pool: pool ? {
            id: pool.id,
            title: pool.title,
            platform: pool.platform,
          } : null,
        },
      });
    }

    // Get positions for provider
    const provider = searchParams.get('provider');
    if (provider) {
      const providerPositions = Array.from(positions.values())
        .filter(p => p.provider === provider)
        .map(p => {
          const pool = pools.get(p.poolId);
          return {
            ...p,
            pendingRewards: calculatePendingRewards(p, pool),
            isLocked: Date.now() < p.lockExpiry,
            poolTitle: pool?.title,
          };
        });

      const stats = {
        totalLiquidity: providerPositions.reduce((sum, p) => sum + p.liquidity, 0),
        totalPendingRewards: providerPositions.reduce((sum, p) => sum + p.pendingRewards, 0),
        totalClaimedRewards: providerPositions.reduce((sum, p) => sum + p.claimedRewards, 0),
        positionCount: providerPositions.length,
      };

      return NextResponse.json({
        success: true,
        positions: providerPositions,
        stats,
      });
    }

    return NextResponse.json(
      { error: 'Must provide provider or id parameter' },
      { status: 400 }
    );
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
      case 'add_liquidity': {
        const { poolId, provider, amount, lockDuration, referrer } = body;

        if (!poolId || !provider || !amount || !lockDuration) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        const pool = pools.get(poolId);
        if (!pool) {
          return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
        }

        if (!pool.isActive) {
          return NextResponse.json({ error: 'Pool is not active' }, { status: 400 });
        }

        if (amount < 10) {
          return NextResponse.json({ error: 'Minimum liquidity is $10' }, { status: 400 });
        }

        const lockBoost = LOCK_BOOSTS[lockDuration] || 1.0;
        const lockMs = getLockDurationMs(lockDuration);

        // Calculate shares
        const shares = pool.totalLiquidity === 0
          ? amount
          : (amount * pool.totalShares) / pool.totalLiquidity;

        positionCounter++;
        const position = {
          id: `LP-${positionCounter}`,
          poolId,
          provider,
          liquidity: amount,
          shares,
          lockDuration,
          lockExpiry: Date.now() + lockMs,
          lockBoost,
          pendingRewards: 0,
          claimedRewards: 0,
          referrer: referrer && referrer !== provider ? referrer : undefined,
          createdAt: Date.now(),
        };

        positions.set(position.id, position);

        // Update pool totals
        pool.totalLiquidity += amount;
        pool.totalShares += shares;

        return NextResponse.json({
          success: true,
          position: {
            ...position,
            isLocked: true,
          },
        });
      }

      case 'remove_liquidity': {
        const { positionId } = body;

        const position = positions.get(positionId);
        if (!position) {
          return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        const pool = pools.get(position.poolId);
        const pendingRewards = calculatePendingRewards(position, pool);

        // Check for early withdrawal penalty
        const isEarly = Date.now() < position.lockExpiry;
        const penalty = isEarly ? position.liquidity * 0.1 : 0;
        const liquidityReturned = position.liquidity - penalty;

        // Update pool totals
        if (pool) {
          pool.totalLiquidity -= position.liquidity;
          pool.totalShares -= position.shares;
        }

        // Remove position
        positions.delete(positionId);

        return NextResponse.json({
          success: true,
          liquidityReturned,
          rewardsClaimed: pendingRewards,
          penalty,
          penaltyApplied: isEarly,
        });
      }

      case 'claim_rewards': {
        const { positionId } = body;

        const position = positions.get(positionId);
        if (!position) {
          return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        const pool = pools.get(position.poolId);
        const pendingRewards = calculatePendingRewards(position, pool);

        if (pendingRewards <= 0) {
          return NextResponse.json({ error: 'No rewards to claim' }, { status: 400 });
        }

        claimCounter++;
        const claim: Claim = {
          id: `CLAIM-${claimCounter}`,
          positionId,
          provider: position.provider,
          amount: pendingRewards,
          timestamp: Date.now(),
        };

        claims.push(claim);

        // Update position
        position.claimedRewards += pendingRewards;
        position.pendingRewards = 0;

        return NextResponse.json({
          success: true,
          claim,
        });
      }

      case 'get_apr': {
        const { poolId, positionId, tokenPrice = 1 } = body;

        if (positionId) {
          const position = positions.get(positionId);
          if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 });
          }

          const pool = pools.get(position.poolId);
          const baseAPR = pool ? calculatePoolAPR(pool, tokenPrice) : 0;
          const positionAPR = baseAPR * position.lockBoost;

          return NextResponse.json({
            success: true,
            positionId,
            baseAPR,
            lockBoost: position.lockBoost,
            effectiveAPR: positionAPR,
          });
        }

        if (poolId) {
          const pool = pools.get(poolId);
          if (!pool) {
            return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            poolId,
            apr: calculatePoolAPR(pool, tokenPrice),
          });
        }

        return NextResponse.json({ error: 'Must provide poolId or positionId' }, { status: 400 });
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
function calculatePendingRewards(position: any, pool: any): number {
  if (!pool || pool.totalShares === 0) return position.pendingRewards || 0;

  const elapsedSeconds = (Date.now() - position.createdAt) / 1000;
  const baseRewards = (position.shares / pool.totalShares) * pool.rewardRate * elapsedSeconds * pool.boostMultiplier;

  return baseRewards * position.lockBoost;
}

function calculatePoolAPR(pool: any, tokenPrice: number): number {
  if (pool.totalLiquidity === 0) return 0;

  const yearlyEmission = pool.rewardRate * 365 * 24 * 60 * 60;
  const poolYearlyRewards = yearlyEmission * pool.boostMultiplier;
  const rewardsValueUSD = poolYearlyRewards * tokenPrice;

  return (rewardsValueUSD / pool.totalLiquidity) * 100;
}

function getLockDurationMs(duration: string): number {
  const day = 24 * 60 * 60 * 1000;
  switch (duration) {
    case '7d': return 7 * day;
    case '30d': return 30 * day;
    case '90d': return 90 * day;
    case '180d': return 180 * day;
    case '365d': return 365 * day;
    default: return 7 * day;
  }
}
