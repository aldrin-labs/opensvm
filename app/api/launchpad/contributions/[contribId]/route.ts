import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/launchpad/database';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// GET /api/launchpad/contributions/:contribId - Get single contribution receipt
export async function GET(
  request: NextRequest,
  { params }: { params: { contribId: string } }
) {
  try {
    const { contribId } = params;

    // Find contribution
    const contribution = db.contributions.find((c) => c.id === contribId);

    if (!contribution) {
      return NextResponse.json(
        { error: 'Contribution not found' },
        { status: 404 }
      );
    }

    // Get sale info
    const sale = db.sales.find((s) => s.id === contribution.sale_id);

    // Get referrer info if exists
    let referrer = null;
    if (contribution.kol_id) {
      referrer = db.referrers.find((r) => r.id === contribution.kol_id);
    }

    // Get referral link info if exists
    let referralLink = null;
    if (contribution.referral_link_id) {
      referralLink = db.referralLinks.find(
        (rl) => rl.id === contribution.referral_link_id
      );
    }

    return NextResponse.json({
      contribution,
      sale: sale
        ? {
            id: sale.id,
            token_name: sale.token_name,
            token_symbol: sale.token_symbol,
            status: sale.status,
          }
        : null,
      referrer: referrer
        ? {
            id: referrer.id,
            display_name: referrer.display_name,
            status: referrer.status,
          }
        : null,
      referralLink: referralLink
        ? {
            code: referralLink.code,
            campaign_name: referralLink.campaign_name,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching contribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contribution' },
      { status: 500 }
    );
  }
}
