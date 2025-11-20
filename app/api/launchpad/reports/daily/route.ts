import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/launchpad/database';
import { DailyVolumeReport } from '@/types/launchpad';
import { signPayload } from '@/lib/launchpad/utils';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// POST /api/launchpad/reports/daily - Submit daily volume report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sale_id, date, volumes } = body;

    if (!sale_id || !date || !volumes || !Array.isArray(volumes)) {
      return NextResponse.json(
        { error: 'Missing required fields: sale_id, date, volumes' },
        { status: 400 }
      );
    }

    // Calculate total referred volume
    const total_referred_volume = volumes.reduce(
      (sum: number, v: { kol_id: string; referred_volume: number }) => 
        sum + (v.referred_volume || 0),
      0
    );

    // Create report
    const report: DailyVolumeReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sale_id,
      date,
      volumes,
      total_referred_volume,
      signed_by: 'platform',
      signature: '',
      created_at: new Date().toISOString(),
    };

    // Sign the report
    const dataToSign = JSON.stringify({
      sale_id: report.sale_id,
      date: report.date,
      volumes: report.volumes,
      total_referred_volume: report.total_referred_volume,
    });
    
    const { signature, publicKey } = signPayload(dataToSign);
    report.signature = signature;
    report.platform_pubkey = publicKey;

    // Store report
    db.dailyVolumeReports.push(report);
    db.persist();

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error submitting daily report:', error);
    return NextResponse.json(
      { error: 'Failed to submit daily report' },
      { status: 500 }
    );
  }
}

// GET /api/launchpad/reports/daily - Get daily reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sale_id = searchParams.get('sale_id');
    const kol_id = searchParams.get('kol_id');
    const date = searchParams.get('date');

    let reports = [...db.dailyVolumeReports];

    // Filter by sale_id
    if (sale_id) {
      reports = reports.filter((r) => r.sale_id === sale_id);
    }

    // Filter by kol_id
    if (kol_id) {
      reports = reports.filter((r) =>
        r.volumes.some((v) => v.kol_id === kol_id)
      );
    }

    // Filter by date
    if (date) {
      reports = reports.filter((r) => r.date === date);
    }

    // Sort by date descending
    reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      reports,
      total: reports.length,
    });
  } catch (error) {
    console.error('Error fetching daily reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily reports' },
      { status: 500 }
    );
  }
}
