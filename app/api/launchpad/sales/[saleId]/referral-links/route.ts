/**
 * API Route: POST /api/launchpad/sales/[saleId]/referral-links
 * Create a referral link for a KOL
 */

import { NextResponse } from 'next/server';
import { getSale, getReferrer, createReferralLink } from '@/lib/launchpad/database';
import { generateId, generateReferralCode, generateQRCode, generateShortUrl } from '@/lib/launchpad/utils';
import type { CreateReferralLinkRequest } from '@/types/launchpad';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(
  request: Request,
  { params }: { params: { saleId: string } }
) {
  try {
    const { saleId } = params;
    const body: CreateReferralLinkRequest = await request.json();
    
    // Validate sale exists
    const sale = await getSale(saleId);
    if (!sale) {
      return NextResponse.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }
    
    // Validate KOL exists and is approved
    const kol = await getReferrer(body.kol_id);
    if (!kol) {
      return NextResponse.json(
        { success: false, error: 'KOL not found' },
        { status: 404 }
      );
    }
    
    if (kol.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'KOL is not approved' },
        { status: 400 }
      );
    }
    
    // Generate referral code
    const code = generateReferralCode(kol.display_name.substring(0, 3).toUpperCase());
    
    // Generate URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://opensvm.com';
    const url = `${baseUrl}/launchpad/sale/${saleId}?ref=${code}${body.campaign_name ? `&utm_campaign=${encodeURIComponent(body.campaign_name)}` : ''}`;
    
    // Create referral link
    const link = await createReferralLink({
      id: generateId(),
      kol_id: body.kol_id,
      sale_id: saleId,
      code,
      url,
      campaign_name: body.campaign_name,
      utm_params: body.campaign_name
        ? { utm_campaign: body.campaign_name, utm_source: 'kol', utm_medium: 'referral' }
        : undefined,
      expires_at: body.expires_at,
      max_uses: body.max_uses,
      current_uses: 0,
      status: 'active',
      created_at: new Date().toISOString(),
    });
    
    // Generate QR code and short URL
    const qrCode = await generateQRCode(url);
    const shortUrl = generateShortUrl(url);
    
    return NextResponse.json({
      success: true,
      data: {
        link,
        short_url: shortUrl,
        qr_code: qrCode,
      },
    });
  } catch (error) {
    console.error('Error creating referral link:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create referral link' },
      { status: 500 }
    );
  }
}
