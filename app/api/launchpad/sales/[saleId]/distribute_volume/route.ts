import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/launchpad/database';
import { calculateVolumeRewards } from '@/lib/launchpad/utils';

// POST /api/launchpad/sales/:saleId/distribute_volume - Distribute volume rewards
export async function POST(
  request: NextRequest,
  { params }: { params: { saleId: string } }
) {
  try {
    const { saleId } = params;
    const body = await request.json();
    const { date, volumes } = body;

    if (!date || !volumes || !Array.isArray(volumes)) {
      return NextResponse.json(
        { error: 'Missing required fields: date, volumes' },
        { status: 400 }
      );
    }

    // Find sale
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }

    // Calculate total volume
    const total_volume = volumes.reduce(
      (sum: number, v: { kol_id: string; volume: number }) => sum + v.volume,
      0
    );

    // Calculate rewards for each KOL
    const distributions = [];
    for (const volumeData of volumes) {
      const { kol_id, volume } = volumeData;

      // Calculate reward
      const reward = calculateVolumeRewards(
        sale.token_total_supply,
        sale.volume_rewards_percent,
        sale.volume_rewards_days || 30,
        volume,
        total_volume
      );

      // Update or create allocation
      let allocation = db.kolAllocations.find(
        (a) => a.sale_id === saleId && a.kol_id === kol_id
      );

      if (!allocation) {
        allocation = {
          id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sale_id: saleId,
          kol_id,
          allocated_tokens: 0,
          distributed_tokens: 0,
          vested_tokens: 0,
          claimable_tokens: 0,
          volume_rewards: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.kolAllocations.push(allocation);
      }

      // Add to volume rewards
      allocation.volume_rewards = (allocation.volume_rewards || 0) + reward;
      allocation.allocated_tokens = (allocation.allocated_tokens || 0) + reward;
      allocation.claimable_tokens = (allocation.claimable_tokens || 0) + reward;
      allocation.updated_at = new Date().toISOString();

      distributions.push({
        kol_id,
        volume,
        reward,
        new_total_allocated: allocation.allocated_tokens,
      });
    }

    db.persist();

    return NextResponse.json({
      success: true,
      sale_id: saleId,
      date,
      total_volume,
      distributions,
    });
  } catch (error) {
    console.error('Error distributing volume rewards:', error);
    return NextResponse.json(
      { error: 'Failed to distribute volume rewards' },
      { status: 500 }
    );
  }
}
