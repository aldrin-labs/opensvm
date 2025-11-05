import { NextRequest, NextResponse } from 'next/server';
import { getSale, listKOLAllocations, createKOLAllocation, updateKOLAllocation } from '@/lib/launchpad/database';

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
    const sale = await getSale(saleId);
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

    // Helper function to calculate volume rewards
    const calculateVolumeRewards = (
      totalSupply: number,
      rewardsPercent: number,
      rewardsDays: number,
      kolVolume: number,
      totalVolume: number
    ): number => {
      const dailyRewardPool = (totalSupply * rewardsPercent / 100) / rewardsDays;
      const kolShare = totalVolume > 0 ? kolVolume / totalVolume : 0;
      return Math.floor(dailyRewardPool * kolShare);
    };

    // Calculate rewards for each KOL
    const distributions = [];
    const existingAllocations = await listKOLAllocations({ sale_id: saleId });
    
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

      // Find or create allocation
      let allocation = existingAllocations.find(
        (a) => a.kol_id === kol_id
      );

      if (!allocation) {
        allocation = await createKOLAllocation({
          id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sale_id: saleId,
          kol_id,
          allocated_tokens: 0,
          distributed_tokens: 0,
          vested_tokens: 0,
          claimable_tokens: 0,
          volume_rewards: 0,
          allocation_type: 'volume',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Add to volume rewards
      const updatedAllocation = await updateKOLAllocation(allocation.id, {
        volume_rewards: (allocation.volume_rewards || 0) + reward,
        allocated_tokens: (allocation.allocated_tokens || 0) + reward,
        claimable_tokens: (allocation.claimable_tokens || 0) + reward,
        updated_at: new Date().toISOString(),
      });

      distributions.push({
        kol_id,
        volume,
        reward,
        new_total_allocated: updatedAllocation?.allocated_tokens || 0,
      });
    }

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
