/**
 * Utility functions for the Off-Chain SOL ICO Launchpad
 */

import { randomBytes } from 'crypto';
import { sign as naclSign, SignKeyPair } from 'tweetnacl';
import bs58 from 'bs58';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  Sale,
  Contribution,
  KOLAllocation,
  VestingSchedule,
  VestingPeriod,
  RewardCalculation,
  SettlementPreview,
  ContributionReceipt,
} from '@/types/launchpad';
import {
  listContributions,
  listKOLAllocations,
  getReferrer,
} from './database';

// Platform keypair for signing (persisted to disk)
let platformKeyPair: SignKeyPair | null = null;
const KEYPAIR_PATH = join(process.cwd(), '.data', 'launchpad', 'platform-keypair.json');

/**
 * Initialize or get platform keypair (with persistence)
 */
function getPlatformKeyPair(): SignKeyPair {
  if (!platformKeyPair) {
    try {
      // Try to load existing keypair from disk
      if (existsSync(KEYPAIR_PATH)) {
        const data = readFileSync(KEYPAIR_PATH, 'utf-8');
        const stored = JSON.parse(data);
        platformKeyPair = {
          publicKey: new Uint8Array(stored.publicKey),
          secretKey: new Uint8Array(stored.secretKey),
        };
      } else {
        // Generate new keypair and save it
        platformKeyPair = naclSign.keyPair();
        const toStore = {
          publicKey: Array.from(platformKeyPair.publicKey),
          secretKey: Array.from(platformKeyPair.secretKey),
        };
        writeFileSync(KEYPAIR_PATH, JSON.stringify(toStore), 'utf-8');
      }
    } catch (error) {
      console.error('Error loading/saving platform keypair:', error);
      // Fallback to in-memory keypair
      platformKeyPair = naclSign.keyPair();
    }
  }
  return platformKeyPair;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a short referral code
 */
export function generateReferralCode(prefix = 'REF'): string {
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${random}`;
}

/**
 * Sign data with platform key
 */
export function signData(data: string): { signature: string; pubkey: string } {
  const keyPair = getPlatformKeyPair();
  const message = Buffer.from(data, 'utf-8');
  const signature = naclSign.detached(message, keyPair.secretKey);
  
  return {
    signature: bs58.encode(signature),
    pubkey: bs58.encode(keyPair.publicKey),
  };
}

/**
 * Alias for signData for backward compatibility
 * @deprecated Use signData instead
 */
export function signPayload(data: string): { signature: string; publicKey: string } {
  const result = signData(data);
  return {
    signature: result.signature,
    publicKey: result.pubkey,
  };
}

/**
 * Verify signature (client-side or server-side)
 */
export function verifySignature(
  data: string,
  signature: string,
  pubkey: string
): boolean {
  try {
    const message = Buffer.from(data, 'utf-8');
    const sig = bs58.decode(signature);
    const pub = bs58.decode(pubkey);
    return naclSign.detached.verify(message, sig, pub);
  } catch (error) {
    return false;
  }
}

/**
 * Create a signed contribution receipt
 */
export function createContributionReceipt(contribution: Contribution): ContributionReceipt {
  const receiptData = {
    contrib_id: contribution.contrib_id,
    sale_id: contribution.sale_id,
    contributor_pubkey: contribution.contributor_pubkey,
    amount_lamports: contribution.amount_lamports,
    deposit_address: contribution.deposit_address,
    deposit_memo: contribution.deposit_memo,
    referral_code: contribution.referrer_code,
    kol_id: contribution.kol_id,
    timestamp: contribution.created_at,
    status: contribution.status,
  };
  
  const dataString = JSON.stringify(receiptData);
  const { signature, pubkey } = signData(dataString);
  
  return {
    ...receiptData,
    platform_signature: signature,
    platform_pubkey: pubkey,
    verify_url: `/api/contributions/${contribution.contrib_id}/verify`,
  };
}

/**
 * Calculate reward allocations for a sale
 */
export async function calculateRewards(
  sale: Sale
): Promise<RewardCalculation[]> {
  const contributions = await listContributions({ sale_id: sale.id, status: 'settled' });
  
  // Group contributions by KOL
  const kolContributions = new Map<string, number>();
  let totalKOLContributions = 0;
  
  contributions.forEach((contrib) => {
    if (contrib.kol_id) {
      const current = kolContributions.get(contrib.kol_id) || 0;
      kolContributions.set(contrib.kol_id, current + contrib.amount_lamports);
      totalKOLContributions += contrib.amount_lamports;
    }
  });
  
  // Calculate KOL pool tokens
  const kolPoolTokens = Math.floor((sale.kol_pool_percent / 100) * sale.total_supply);
  
  // Calculate contribution-based rewards
  const calculations: RewardCalculation[] = [];
  
  for (const [kolId, contributionAmount] of kolContributions.entries()) {
    const contributionRewards = Math.floor(
      kolPoolTokens * (contributionAmount / totalKOLContributions)
    );
    
    // Calculate vesting schedule
    const vestingSchedule = calculateVestingSchedule(
      contributionRewards,
      sale.vesting_duration_months,
      sale.vesting_cliff_days
    );
    
    calculations.push({
      kol_id: kolId,
      sale_id: sale.id,
      contribution_rewards: contributionRewards,
      volume_rewards: 0, // Will be added from daily volume reports
      total_rewards: contributionRewards,
      vesting_schedule: vestingSchedule,
    });
  }
  
  return calculations;
}

/**
 * Calculate vesting schedule
 */
export function calculateVestingSchedule(
  totalAmount: number,
  durationMonths: number,
  cliffDays?: number
): VestingSchedule {
  const now = new Date();
  const cliffDate = cliffDays
    ? new Date(now.getTime() + cliffDays * 24 * 60 * 60 * 1000)
    : undefined;
  const endDate = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
  
  // Linear vesting over duration
  const periodsCount = durationMonths * 4; // Weekly periods
  const amountPerPeriod = Math.floor(totalAmount / periodsCount);
  
  const schedule: VestingPeriod[] = [];
  let vestedSoFar = 0;
  
  for (let i = 0; i < periodsCount; i++) {
    const periodDate = new Date(now.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const amount = i === periodsCount - 1
      ? totalAmount - vestedSoFar // Last period gets remainder
      : amountPerPeriod;
    
    schedule.push({
      date: periodDate.toISOString(),
      amount,
      claimed: false,
    });
    
    vestedSoFar += amount;
  }
  
  // Calculate current claimable amount
  let claimableAmount = 0;
  if (!cliffDate || now >= cliffDate) {
    for (const period of schedule) {
      if (new Date(period.date) <= now && !period.claimed) {
        claimableAmount += period.amount;
      }
    }
  }
  
  return {
    total_amount: totalAmount,
    vested_amount: claimableAmount,
    claimable_amount: claimableAmount,
    cliff_date: cliffDate?.toISOString(),
    end_date: endDate.toISOString(),
    schedule,
  };
}

/**
 * Generate settlement preview
 */
export async function generateSettlementPreview(
  sale: Sale
): Promise<SettlementPreview> {
  const contributions = await listContributions({ sale_id: sale.id, status: 'settled' });
  const totalRaised = contributions.reduce((sum, c) => sum + c.amount_lamports, 0);
  
  const platformFee = Math.floor(totalRaised * sale.platform_fee_percent);
  const netRaise = totalRaised - platformFee;
  
  const liquidityAllocation = Math.floor(netRaise * (sale.liquidity_percent / 100));
  const daoAllocation = Math.floor(netRaise * (sale.dao_lock_percent / 100));
  const vestingAllocation = Math.floor(netRaise * (sale.vesting_percent / 100));
  
  const kolPoolTotal = Math.floor(sale.total_supply * (sale.kol_pool_percent / 100));
  const volumePoolTotal = Math.floor(sale.total_supply * (sale.volume_rewards_percent / 100));
  const airdropTotal = Math.floor(sale.total_supply * (sale.airdrop_percent / 100));
  
  // Calculate KOL allocations
  const rewardCalculations = await calculateRewards(sale);
  const kolAllocations = await Promise.all(
    rewardCalculations.map(async (calc) => {
      const referrer = await getReferrer(calc.kol_id);
      return {
        kol_id: calc.kol_id,
        display_name: referrer?.display_name || 'Unknown',
        contribution_rewards: calc.contribution_rewards,
        volume_rewards: calc.volume_rewards,
        total: calc.total_rewards,
      };
    })
  );
  
  const totalAllocated = kolAllocations.reduce((sum, a) => sum + a.total, 0);
  const treasuryRemainder = kolPoolTotal - totalAllocated;
  
  return {
    sale_id: sale.id,
    total_raised: totalRaised,
    platform_fee: platformFee,
    liquidity_allocation: liquidityAllocation,
    dao_allocation: daoAllocation,
    vesting_allocation: vestingAllocation,
    kol_pool_total: kolPoolTotal,
    volume_pool_total: volumePoolTotal,
    airdrop_total: airdropTotal,
    treasury_remainder: treasuryRemainder,
    kol_allocations: kolAllocations,
  };
}

/**
 * Detect fraud patterns in contributions
 */
export function detectFraud(
  contribution: Contribution,
  recentContributions: Contribution[]
): { isFraudulent: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // Check for self-referral (same wallet as contributor and referrer)
  // This would need actual referrer wallet comparison in production
  
  // Check for rapid small contributions
  const recentFromIP = recentContributions.filter(
    (c) =>
      c.ip_address === contribution.ip_address &&
      Date.now() - new Date(c.created_at).getTime() < 60 * 60 * 1000 // Last hour
  );
  
  if (recentFromIP.length > 10) {
    reasons.push('Rapid contributions from same IP');
  }
  
  // Check for minimum contribution
  const LAMPORTS_PER_SOL = 1_000_000_000;
  const minContribution = 0.1 * LAMPORTS_PER_SOL;
  if (contribution.amount_lamports < minContribution) {
    reasons.push('Below minimum contribution threshold');
  }
  
  // Check for multiple wallets from same device
  const recentFromDevice = recentContributions.filter(
    (c) =>
      c.device_fingerprint === contribution.device_fingerprint &&
      c.contributor_pubkey !== contribution.contributor_pubkey &&
      Date.now() - new Date(c.created_at).getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
  );
  
  if (recentFromDevice.length > 5) {
    reasons.push('Multiple wallets from same device');
  }
  
  return {
    isFraudulent: reasons.length > 0,
    reasons,
  };
}

/**
 * Generate QR code data URL
 */
export async function generateQRCode(data: string): Promise<string> {
  // In a real implementation, use a QR code library
  // For MVP, return a placeholder
  return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="100">${data}</text></svg>`).toString('base64')}`;
}

/**
 * Generate short URL
 */
export function generateShortUrl(longUrl: string): string {
  // In production, use a URL shortening service
  const hash = randomBytes(4).toString('hex');
  return `https://short.opensvm.com/${hash}`;
}

/**
 * Format lamports to SOL
 */
export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9);
}

/**
 * Format SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

// Re-export database functions for backward compatibility
export { listContributions, listKOLAllocations, getReferrer } from './database';

