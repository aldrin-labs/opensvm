/**
 * API Route: POST /api/launchpad/sales/[saleId]/contribute
 * Submit a contribution to an ICO sale
 */

import { NextResponse } from 'next/server';
import { getSale, createContribution, getReferralLinkByCode, updateSale } from '@/lib/launchpad/database';
import { generateId, createContributionReceipt, detectFraud, listContributions } from '@/lib/launchpad/utils';
import type { ContributeRequest } from '@/types/launchpad';

export async function POST(
  request: Request,
  { params }: { params: { saleId: string } }
) {
  try {
    const { saleId } = params;
    const body: ContributeRequest = await request.json();
    
    // Validate sale exists and is active
    const sale = await getSale(saleId);
    if (!sale) {
      return NextResponse.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }
    
    if (sale.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Sale is not active' },
        { status: 400 }
      );
    }
    
    // Validate contribution amount
    if (body.amount_lamports < sale.min_contribution_lamports) {
      return NextResponse.json(
        {
          success: false,
          error: `Minimum contribution is ${sale.min_contribution_lamports / 1_000_000_000} SOL`,
        },
        { status: 400 }
      );
    }
    
    if (sale.max_contribution_lamports && body.amount_lamports > sale.max_contribution_lamports) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum contribution is ${sale.max_contribution_lamports / 1_000_000_000} SOL`,
        },
        { status: 400 }
      );
    }
    
    // Resolve referral link if provided
    let referralLink = null;
    if (body.referral_code) {
      referralLink = await getReferralLinkByCode(body.referral_code);
      if (!referralLink) {
        return NextResponse.json(
          { success: false, error: 'Invalid referral code' },
          { status: 400 }
        );
      }
      
      if (referralLink.status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'Referral link is not active' },
          { status: 400 }
        );
      }
      
      if (referralLink.expires_at && new Date(referralLink.expires_at) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Referral link has expired' },
          { status: 400 }
        );
      }
    }
    
    // Get client info for fraud detection
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Create contribution
    const contribution = await createContribution({
      contrib_id: generateId(),
      sale_id: saleId,
      contributor_pubkey: body.contributor_pubkey,
      amount_lamports: body.amount_lamports,
      referral_id: referralLink?.id,
      kol_id: referralLink?.kol_id,
      referrer_code: body.referral_code,
      deposit_address: generateDepositAddress(saleId),
      deposit_memo: generateDepositMemo(saleId, body.contributor_pubkey),
      status: 'pending',
      ip_address: clientIp,
      user_agent: userAgent,
      device_fingerprint: generateDeviceFingerprint(clientIp, userAgent),
      created_at: new Date().toISOString(),
    });
    
    // Fraud detection
    const recentContributions = await listContributions({ sale_id: saleId });
    const fraudCheck = detectFraud(contribution, recentContributions);
    
    if (fraudCheck.isFraudulent) {
      await updateContribution(contribution.contrib_id, {
        fraud_flags: fraudCheck.reasons,
      });
    }
    
    // Create signed receipt
    const receipt = createContributionReceipt(contribution);
    
    return NextResponse.json({
      success: true,
      data: {
        contribution,
        receipt,
        fraud_warning: fraudCheck.isFraudulent ? fraudCheck.reasons : undefined,
      },
    });
  } catch (error) {
    console.error('Error creating contribution:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create contribution' },
      { status: 500 }
    );
  }
}

function generateDepositAddress(saleId: string): string {
  // In production, generate a unique deposit address per sale
  // For MVP, return a placeholder
  return 'DeposAddress1111111111111111111111111111111111';
}

function generateDepositMemo(saleId: string, contributorPubkey: string): string {
  // Generate a unique memo for tracking
  return `${saleId.substring(0, 8)}-${contributorPubkey.substring(0, 8)}`;
}

function generateDeviceFingerprint(ip: string, userAgent: string): string {
  // Simple fingerprinting - in production, use a more sophisticated method
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${ip}${userAgent}`).digest('hex').substring(0, 16);
}

function updateContribution(arg0: any, arg1: { fraud_flags: string[]; }) {
  return require('@/lib/launchpad/database').updateContribution(arg0, arg1);
}
