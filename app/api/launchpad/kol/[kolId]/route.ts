/**
 * API Route: GET /api/launchpad/kol/[kolId]
 * Get KOL dashboard data
 */

import { NextResponse } from 'next/server';
import {

  getReferrer,
  listReferralLinks,
  listContributions,
  listKOLAllocations,
  listDailyVolumeReports,
  listFraudAlerts,
} from '@/lib/launchpad/database';
import type { KOLDashboardResponse } from '@/types/launchpad';

export async function GET(
  request: Request,
  { params }: { params: { kolId: string } }
) {
  try {
    const { kolId } = params;
    
    // Get KOL info
    const kol = await getReferrer(kolId);
    if (!kol) {
      return NextResponse.json(
        { success: false, error: 'KOL not found' },
        { status: 404 }
      );
    }
    
    // Get referral links
    const referralLinks = await listReferralLinks({ kol_id: kolId });
    
    // Get contributions attributed to this KOL
    const contributions = await listContributions({ kol_id: kolId });
    const recentContributions = contributions.slice(0, 50);
    
    // Get allocations
    const allocations = await listKOLAllocations({ kol_id: kolId });
    
    // Get daily volume reports
    const allReports = await listDailyVolumeReports();
    const dailyVolumes = allReports.filter(report => 
      report.totals.some(t => t.kol_id === kolId)
    );
    
    // Calculate stats
    const totalContributions = contributions.reduce(
      (sum, c) => sum + (c.status === 'settled' ? c.amount_lamports : 0),
      0
    );
    
    const totalVolume = dailyVolumes.reduce((sum, report) => {
      const kolTotal = report.totals.find(t => t.kol_id === kolId);
      return sum + (kolTotal?.referred_volume_lamports || 0);
    }, 0);
    
    const pendingTokens = allocations.reduce((sum, a) => sum + a.allocated_tokens - a.distributed_tokens, 0);
    const claimableTokens = allocations.reduce((sum, a) => sum + a.claimable_tokens, 0);
    const vestedTokens = allocations.reduce((sum, a) => sum + a.vested_tokens, 0);
    const claimedTokens = allocations.reduce((sum, a) => sum + a.distributed_tokens, 0);
    
    // Get fraud alerts for this KOL
    const fraudAlerts = await listFraudAlerts({ reviewed: false });
    const relevantAlerts = fraudAlerts.filter(alert =>
      alert.related_ids.includes(kolId) ||
      contributions.some(c => alert.related_ids.includes(c.contrib_id))
    );
    
    const response: KOLDashboardResponse = {
      kol,
      stats: {
        total_contributions: totalContributions,
        total_volume: totalVolume,
        pending_tokens: pendingTokens,
        claimable_tokens: claimableTokens,
        vested_tokens: vestedTokens,
        claimed_tokens: claimedTokens,
      },
      referral_links: referralLinks,
      recent_contributions: recentContributions,
      allocations,
      daily_volumes: dailyVolumes,
      fraud_alerts: relevantAlerts.length > 0 ? relevantAlerts.map(a => a.description) : undefined,
    };
    
    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching KOL dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
