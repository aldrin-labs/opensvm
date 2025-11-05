/**
 * API Route: GET /api/launchpad/sales
 * List all ICO sales
 */

import { NextResponse } from 'next/server';
import { listSales } from '@/lib/launchpad/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    
    const sales = await listSales(status ? { status } : undefined);
    
    return NextResponse.json({
      success: true,
      data: sales,
      count: sales.length,
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sales',
      },
      { status: 500 }
    );
  }
}

/**
 * API Route: POST /api/launchpad/sales
 * Create a new ICO sale (admin only)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { createSale } = await import('@/lib/launchpad/database');
    const { generateId } = await import('@/lib/launchpad/utils');
    const {
      DEFAULT_PLATFORM_FEE,
      DEFAULT_LIQUIDITY_PERCENT,
      DEFAULT_DAO_PERCENT,
      DEFAULT_VESTING_PERCENT,
      DEFAULT_AIRDROP_PERCENT,
      DEFAULT_VESTING_MONTHS,
      DEFAULT_MAX_REFERRER_PERCENT,
    } = await import('@/types/launchpad');
    
    const sale = await createSale({
      id: generateId(),
      name: body.name,
      token_symbol: body.token_symbol,
      token_mint: body.token_mint,
      total_supply: body.total_supply,
      target_raise_lamports: body.target_raise_lamports,
      current_raise_lamports: 0,
      status: 'upcoming',
      start_date: body.start_date,
      end_date: body.end_date,
      liquidity_percent: body.liquidity_percent || DEFAULT_LIQUIDITY_PERCENT,
      dao_lock_percent: body.dao_lock_percent || DEFAULT_DAO_PERCENT,
      vesting_percent: body.vesting_percent || DEFAULT_VESTING_PERCENT,
      kol_pool_percent: body.kol_pool_percent || 5,
      volume_rewards_percent: body.volume_rewards_percent || 2,
      airdrop_percent: body.airdrop_percent || DEFAULT_AIRDROP_PERCENT,
      vesting_duration_months: body.vesting_duration_months || DEFAULT_VESTING_MONTHS,
      vesting_cliff_days: body.vesting_cliff_days,
      volume_rewards_days: body.volume_rewards_days || 30,
      min_contribution_lamports: body.min_contribution_lamports || 100_000_000, // 0.1 SOL
      max_contribution_lamports: body.max_contribution_lamports,
      max_referrer_volume_percent: body.max_referrer_volume_percent || DEFAULT_MAX_REFERRER_PERCENT,
      platform_fee_percent: body.platform_fee_percent || DEFAULT_PLATFORM_FEE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create sale',
      },
      { status: 500 }
    );
  }
}
