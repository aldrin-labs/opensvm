/**
 * Type definitions for the Off-Chain SOL ICO Launchpad
 */

// ============= Core Data Models =============

export interface Referrer {
  id: string; // UUID
  display_name: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  payout_wallet: string; // Solana public key
  kyc_verified: boolean;
  email?: string;
  socials?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string; // Admin ID
}

export interface ReferralLink {
  id: string; // UUID
  kol_id: string;
  sale_id: string;
  code: string; // Short code like "KOL123"
  url: string; // Full URL
  campaign_name?: string;
  utm_params?: Record<string, string>;
  expires_at?: string;
  max_uses?: number;
  current_uses: number;
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  created_at: string;
  created_by?: string;
}

export interface Contribution {
  contrib_id: string; // UUID
  sale_id: string;
  contributor_pubkey: string; // Solana public key
  amount_lamports: number;
  referral_id?: string; // ReferralLink ID
  kol_id?: string;
  referrer_code?: string;
  deposit_address: string; // Platform deposit address
  deposit_memo?: string;
  status: 'pending' | 'confirmed' | 'settled' | 'failed';
  platform_signature?: string; // Cryptographic signature
  platform_pubkey?: string;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
  fraud_flags?: string[];
  created_at: string;
  confirmed_at?: string;
  settled_at?: string;
}

export interface DailyVolumeReport {
  id: string; // UUID
  sale_id: string;
  date: string; // ISO date
  reporter: string; // System or admin ID
  totals: VolumeTotal[];
  total_referred_volume: number;
  signed_by: string; // Platform key
  signature: string;
  published: boolean;
  created_at: string;
}

export interface VolumeTotal {
  kol_id: string;
  referred_volume_lamports: number;
  transaction_count: number;
}

export interface KOLAllocation {
  id: string; // UUID
  sale_id: string;
  kol_id: string;
  allocation_type: 'contribution' | 'volume' | 'bonus';
  allocated_tokens: number;
  distributed_tokens: number;
  vested_tokens: number;
  claimable_tokens: number;
  vesting_start?: string;
  vesting_end?: string;
  vesting_cliff?: number; // days
  last_claim_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string; // UUID
  name: string;
  token_symbol: string;
  token_mint?: string; // Solana mint address
  total_supply: number;
  target_raise_lamports: number;
  current_raise_lamports: number;
  status: 'upcoming' | 'active' | 'finalized' | 'cancelled';
  start_date: string;
  end_date: string;
  
  // Allocation percentages
  liquidity_percent: number; // Default 50
  dao_lock_percent: number; // Default 25
  vesting_percent: number; // Default 25
  kol_pool_percent: number; // %N for KOLs
  volume_rewards_percent: number; // %M for trading volume
  airdrop_percent: number; // Default 1 for SVMAI holders
  
  // Vesting config
  vesting_duration_months: number; // Default 3
  vesting_cliff_days?: number;
  
  // Volume rewards config
  volume_rewards_days: number; // X days for distribution
  
  // Caps and limits
  min_contribution_lamports: number;
  max_contribution_lamports?: number;
  max_referrer_volume_percent: number; // Default 20
  
  // Platform fee
  platform_fee_percent: number; // Default 0.01
  
  created_at: string;
  updated_at: string;
  finalized_at?: string;
  finalized_by?: string;
}

export interface Dispute {
  id: string; // UUID
  type: 'contribution' | 'allocation' | 'volume' | 'fraud';
  related_id: string; // ID of related entity
  sale_id: string;
  reporter_id?: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'rejected';
  resolution?: string;
  evidence?: string[];
  assigned_to?: string; // Admin ID
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

// ============= API Request/Response Types =============

export interface CreateReferralLinkRequest {
  kol_id: string;
  sale_id: string;
  campaign_name?: string;
  expires_at?: string;
  max_uses?: number;
}

export interface CreateReferralLinkResponse {
  link: ReferralLink;
  short_url: string;
  qr_code: string; // Base64 data URL
}

export interface ContributeRequest {
  sale_id: string;
  contributor_pubkey: string;
  amount_lamports: number;
  referral_code?: string;
  deposit_mode: 'wallet_transfer' | 'in_app_send';
}

export interface ContributeResponse {
  contribution: Contribution;
  receipt: ContributionReceipt;
}

export interface ContributionReceipt {
  contrib_id: string;
  sale_id: string;
  contributor_pubkey: string;
  amount_lamports: number;
  deposit_address: string;
  deposit_memo?: string;
  referral_code?: string;
  kol_id?: string;
  timestamp: string;
  status: string;
  platform_signature: string;
  platform_pubkey: string;
  verify_url: string;
}

export interface DailyVolumeReportRequest {
  sale_id: string;
  date: string;
  totals: VolumeTotal[];
}

export interface KOLDashboardResponse {
  kol: Referrer;
  stats: {
    total_contributions: number;
    total_volume: number;
    pending_tokens: number;
    claimable_tokens: number;
    vested_tokens: number;
    claimed_tokens: number;
  };
  referral_links: ReferralLink[];
  recent_contributions: Contribution[];
  allocations: KOLAllocation[];
  daily_volumes: DailyVolumeReport[];
  fraud_alerts?: string[];
}

export interface KOLApplicationRequest {
  display_name: string;
  payout_wallet: string;
  email: string;
  socials?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  bio?: string;
  audience_size?: number;
}

export interface RewardCalculation {
  kol_id: string;
  sale_id: string;
  contribution_rewards: number;
  volume_rewards: number;
  total_rewards: number;
  vesting_schedule: VestingSchedule;
}

export interface VestingSchedule {
  total_amount: number;
  vested_amount: number;
  claimable_amount: number;
  cliff_date?: string;
  end_date: string;
  schedule: VestingPeriod[];
}

export interface VestingPeriod {
  date: string;
  amount: number;
  claimed: boolean;
}

export interface ClaimRequest {
  kol_id: string;
  allocation_ids: string[];
  wallet_address: string;
}

export interface ClaimResponse {
  claim_id: string;
  total_claimed: number;
  transaction_signature?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// ============= Admin Types =============

export interface AdminDisputeResponse {
  disputes: Dispute[];
  total: number;
  page: number;
  per_page: number;
}

export interface DisputeResolution {
  dispute_id: string;
  resolution: string;
  evidence?: string[];
  override_amount?: number;
  action_taken: 'approved' | 'rejected' | 'adjusted';
}

export interface FraudAlert {
  id: string;
  type: 'self_referral' | 'suspicious_ip' | 'rapid_contributions' | 'volume_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  related_ids: string[];
  description: string;
  created_at: string;
  reviewed: boolean;
}

export interface SettlementPreview {
  sale_id: string;
  total_raised: number;
  platform_fee: number;
  liquidity_allocation: number;
  dao_allocation: number;
  vesting_allocation: number;
  kol_pool_total: number;
  volume_pool_total: number;
  airdrop_total: number;
  treasury_remainder: number;
  kol_allocations: Array<{
    kol_id: string;
    display_name: string;
    contribution_rewards: number;
    volume_rewards: number;
    total: number;
  }>;
}

// ============= Utility Types =============

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_role: string;
  changes?: Record<string, any>;
  ip_address?: string;
  timestamp: string;
}

// ============= Validation Schemas =============

export const MIN_CONTRIBUTION_SOL = 0.1;
export const DEFAULT_PLATFORM_FEE = 0.0001; // 0.01%
export const DEFAULT_LIQUIDITY_PERCENT = 50;
export const DEFAULT_DAO_PERCENT = 25;
export const DEFAULT_VESTING_PERCENT = 25;
export const DEFAULT_AIRDROP_PERCENT = 1;
export const DEFAULT_VESTING_MONTHS = 3;
export const DEFAULT_MAX_REFERRER_PERCENT = 20;
