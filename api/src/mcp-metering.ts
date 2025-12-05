/**
 * MCP Tool Usage Metering & Revenue Share
 *
 * Tracks per-call usage for billing and revenue distribution to tool developers.
 *
 * Features:
 * - Per-tool call metering with cost calculation
 * - Revenue share distribution (platform vs developer)
 * - Usage quotas and rate limiting
 * - Billing period aggregation
 * - SVMAI token integration for payments
 * - Real-time usage dashboards
 * - Webhook notifications for quota alerts
 */

// ============================================================================
// Types
// ============================================================================

export type BillingPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type PaymentMethod = 'svmai' | 'stripe' | 'crypto' | 'free';
export type TierName = 'free' | 'starter' | 'pro' | 'enterprise';

export interface ToolPricing {
  toolName: string;
  serverId: string;

  // Cost per call in micro-SVMAI (1 SVMAI = 1,000,000 micro)
  baseCostMicro: bigint;

  // Dynamic pricing factors
  computeMultiplier: number;    // Multiply by compute time
  dataSizeMultiplier: number;   // Multiply by response size
  complexityMultiplier: number; // Multiply by estimated complexity

  // Revenue share (percentage to developer, rest to platform)
  developerSharePercent: number;

  // Free tier allowance
  freeCallsPerDay: number;

  // Rate limits
  maxCallsPerMinute: number;
  maxCallsPerHour: number;
}

export interface UsageRecord {
  id: string;
  timestamp: number;
  userId: string;
  walletAddress?: string;
  apiKeyId?: string;

  // Tool info
  toolName: string;
  serverId: string;
  qualifiedName: string;

  // Usage metrics
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  success: boolean;

  // Cost calculation
  baseCostMicro: bigint;
  computeCostMicro: bigint;
  dataCostMicro: bigint;
  totalCostMicro: bigint;

  // Revenue split
  developerShareMicro: bigint;
  platformShareMicro: bigint;

  // Context
  metadata?: Record<string, any>;
}

export interface UserQuota {
  userId: string;
  tier: TierName;

  // Limits
  callsPerMinute: number;
  callsPerHour: number;
  callsPerDay: number;
  callsPerMonth: number;
  monthlyBudgetMicro: bigint;

  // Current usage
  currentMinuteCalls: number;
  currentHourCalls: number;
  currentDayCalls: number;
  currentMonthCalls: number;
  currentMonthSpentMicro: bigint;

  // Reset timestamps
  minuteResetAt: number;
  hourResetAt: number;
  dayResetAt: number;
  monthResetAt: number;
}

export interface DeveloperRevenue {
  developerId: string;
  walletAddress: string;
  serverId: string;

  // Revenue tracking
  totalEarnedMicro: bigint;
  pendingPayoutMicro: bigint;
  paidOutMicro: bigint;

  // Stats
  totalCalls: number;
  uniqueUsers: number;
  avgRevenuePerCall: number;

  // Period breakdown
  revenueByTool: Record<string, bigint>;
  revenueByPeriod: {
    today: bigint;
    thisWeek: bigint;
    thisMonth: bigint;
    allTime: bigint;
  };

  // Payout history
  payoutHistory: {
    id: string;
    amount: bigint;
    txSignature?: string;
    paidAt: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }[];

  // Next payout
  nextPayoutDate: number;
  minimumPayoutMicro: bigint;
}

export interface BillingReport {
  userId: string;
  period: BillingPeriod;
  startDate: number;
  endDate: number;

  // Summary
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalCostMicro: bigint;

  // Breakdown by tool
  toolBreakdown: {
    toolName: string;
    serverId: string;
    calls: number;
    costMicro: bigint;
    avgDurationMs: number;
  }[];

  // Breakdown by day
  dailyBreakdown: {
    date: string;
    calls: number;
    costMicro: bigint;
  }[];
}

// ============================================================================
// Default Pricing
// ============================================================================

const DEFAULT_PRICING: Partial<ToolPricing> = {
  baseCostMicro: 100n,           // 0.0001 SVMAI per call
  computeMultiplier: 0.001,      // Per ms of compute
  dataSizeMultiplier: 0.00001,   // Per byte of response
  complexityMultiplier: 1.0,
  developerSharePercent: 70,     // 70% to developer, 30% to platform
  freeCallsPerDay: 100,
  maxCallsPerMinute: 60,
  maxCallsPerHour: 1000,
};

/**
 * Tool-specific pricing overrides
 */
export const TOOL_PRICING: Record<string, Partial<ToolPricing>> = {
  // Free tier tools
  'get_network_status': { baseCostMicro: 0n, freeCallsPerDay: 1000 },
  'search': { baseCostMicro: 50n, freeCallsPerDay: 200 },

  // Standard blockchain queries
  'get_transaction': { baseCostMicro: 100n, freeCallsPerDay: 100 },
  'get_account_portfolio': { baseCostMicro: 200n, freeCallsPerDay: 50 },
  'get_account_transactions': { baseCostMicro: 300n, freeCallsPerDay: 50 },
  'get_blocks': { baseCostMicro: 100n, freeCallsPerDay: 100 },

  // AI-powered tools (higher cost)
  'explain_transaction': { baseCostMicro: 1000n, freeCallsPerDay: 20, complexityMultiplier: 2.0 },
  'analyze_transaction': { baseCostMicro: 2000n, freeCallsPerDay: 10, complexityMultiplier: 3.0 },
  'ask_ai': { baseCostMicro: 5000n, freeCallsPerDay: 10, complexityMultiplier: 5.0 },

  // Investigation tools (premium)
  'investigate': { baseCostMicro: 10000n, freeCallsPerDay: 3, complexityMultiplier: 10.0 },
  'investigate_with_template': { baseCostMicro: 15000n, freeCallsPerDay: 2, complexityMultiplier: 15.0 },
  'find_wallet_path': { baseCostMicro: 5000n, freeCallsPerDay: 5, complexityMultiplier: 5.0 },

  // Third-party marketplace tools
  'solana-token-analyzer:analyze_token': { baseCostMicro: 3000n, developerSharePercent: 80 },
  'wallet-security-scanner:scan_wallet': { baseCostMicro: 2000n, developerSharePercent: 80 },
  'defi-yield-optimizer:find_yields': { baseCostMicro: 2500n, developerSharePercent: 80 },
};

// ============================================================================
// Tier Definitions
// ============================================================================

export const TIER_LIMITS: Record<TierName, Omit<UserQuota, 'userId' | 'currentMinuteCalls' | 'currentHourCalls' | 'currentDayCalls' | 'currentMonthCalls' | 'currentMonthSpentMicro' | 'minuteResetAt' | 'hourResetAt' | 'dayResetAt' | 'monthResetAt'>> = {
  free: {
    tier: 'free',
    callsPerMinute: 10,
    callsPerHour: 100,
    callsPerDay: 500,
    callsPerMonth: 5000,
    monthlyBudgetMicro: 0n,  // Free tier uses per-tool free allowances
  },
  starter: {
    tier: 'starter',
    callsPerMinute: 30,
    callsPerHour: 500,
    callsPerDay: 5000,
    callsPerMonth: 50000,
    monthlyBudgetMicro: 1000000n,  // 1 SVMAI
  },
  pro: {
    tier: 'pro',
    callsPerMinute: 100,
    callsPerHour: 2000,
    callsPerDay: 20000,
    callsPerMonth: 200000,
    monthlyBudgetMicro: 10000000n,  // 10 SVMAI
  },
  enterprise: {
    tier: 'enterprise',
    callsPerMinute: 1000,
    callsPerHour: 20000,
    callsPerDay: 200000,
    callsPerMonth: 2000000,
    monthlyBudgetMicro: 100000000n,  // 100 SVMAI
  },
};

// ============================================================================
// Metering Service
// ============================================================================

export class MeteringService {
  private usageRecords: UsageRecord[] = [];
  private userQuotas = new Map<string, UserQuota>();
  private developerRevenue = new Map<string, DeveloperRevenue>();
  private toolFreeUsage = new Map<string, Map<string, { count: number; resetAt: number }>>();

  // Callbacks for external integrations
  private onQuotaExceeded?: (userId: string, quotaType: string) => void;
  private onRevenueThreshold?: (developerId: string, amount: bigint) => void;

  constructor(options?: {
    onQuotaExceeded?: (userId: string, quotaType: string) => void;
    onRevenueThreshold?: (developerId: string, amount: bigint) => void;
  }) {
    this.onQuotaExceeded = options?.onQuotaExceeded;
    this.onRevenueThreshold = options?.onRevenueThreshold;
  }

  // ==========================================================================
  // Quota Management
  // ==========================================================================

  /**
   * Initialize or get user quota
   */
  getQuota(userId: string, tier: TierName = 'free'): UserQuota {
    let quota = this.userQuotas.get(userId);

    if (!quota) {
      const limits = TIER_LIMITS[tier];
      const now = Date.now();

      quota = {
        userId,
        ...limits,
        currentMinuteCalls: 0,
        currentHourCalls: 0,
        currentDayCalls: 0,
        currentMonthCalls: 0,
        currentMonthSpentMicro: 0n,
        minuteResetAt: now + 60000,
        hourResetAt: now + 3600000,
        dayResetAt: this.getEndOfDay(now),
        monthResetAt: this.getEndOfMonth(now),
      };

      this.userQuotas.set(userId, quota);
    }

    // Check and reset expired periods
    this.resetExpiredPeriods(quota);

    return quota;
  }

  /**
   * Check if user can make a call
   */
  canMakeCall(userId: string, toolName: string): { allowed: boolean; reason?: string } {
    const quota = this.getQuota(userId);

    // Check rate limits
    if (quota.currentMinuteCalls >= quota.callsPerMinute) {
      return { allowed: false, reason: 'Rate limit exceeded (per minute)' };
    }
    if (quota.currentHourCalls >= quota.callsPerHour) {
      return { allowed: false, reason: 'Rate limit exceeded (per hour)' };
    }
    if (quota.currentDayCalls >= quota.callsPerDay) {
      return { allowed: false, reason: 'Daily limit exceeded' };
    }
    if (quota.currentMonthCalls >= quota.callsPerMonth) {
      return { allowed: false, reason: 'Monthly limit exceeded' };
    }

    // Check free tier allowance for specific tool
    if (quota.tier === 'free') {
      const freeUsage = this.getToolFreeUsage(userId, toolName);
      const pricing = this.getToolPricing(toolName);

      if (freeUsage.count >= pricing.freeCallsPerDay) {
        return { allowed: false, reason: `Free daily limit for ${toolName} exceeded` };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a tool call and calculate cost
   */
  recordCall(params: {
    userId: string;
    walletAddress?: string;
    apiKeyId?: string;
    toolName: string;
    serverId: string;
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
    success: boolean;
    metadata?: Record<string, any>;
  }): UsageRecord {
    const quota = this.getQuota(params.userId);
    const pricing = this.getToolPricing(params.toolName, params.serverId);

    // Calculate cost
    const baseCostMicro = pricing.baseCostMicro;
    const computeCostMicro = BigInt(Math.round(params.durationMs * pricing.computeMultiplier * Number(baseCostMicro)));
    const dataCostMicro = BigInt(Math.round(params.outputBytes * pricing.dataSizeMultiplier * Number(baseCostMicro)));
    const totalCostMicro = baseCostMicro + computeCostMicro + dataCostMicro;

    // Calculate revenue split
    const developerShareMicro = (totalCostMicro * BigInt(pricing.developerSharePercent)) / 100n;
    const platformShareMicro = totalCostMicro - developerShareMicro;

    // Check if this is a free call
    const freeUsage = this.getToolFreeUsage(params.userId, params.toolName);
    const isFreeCall = quota.tier === 'free' && freeUsage.count < pricing.freeCallsPerDay;

    const record: UsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      userId: params.userId,
      walletAddress: params.walletAddress,
      apiKeyId: params.apiKeyId,
      toolName: params.toolName,
      serverId: params.serverId,
      qualifiedName: `${params.serverId}:${params.toolName}`,
      durationMs: params.durationMs,
      inputBytes: params.inputBytes,
      outputBytes: params.outputBytes,
      success: params.success,
      baseCostMicro: isFreeCall ? 0n : baseCostMicro,
      computeCostMicro: isFreeCall ? 0n : computeCostMicro,
      dataCostMicro: isFreeCall ? 0n : dataCostMicro,
      totalCostMicro: isFreeCall ? 0n : totalCostMicro,
      developerShareMicro: isFreeCall ? 0n : developerShareMicro,
      platformShareMicro: isFreeCall ? 0n : platformShareMicro,
      metadata: params.metadata,
    };

    // Update quota counters
    quota.currentMinuteCalls++;
    quota.currentHourCalls++;
    quota.currentDayCalls++;
    quota.currentMonthCalls++;
    quota.currentMonthSpentMicro += record.totalCostMicro;

    // Update free usage counter
    if (quota.tier === 'free') {
      freeUsage.count++;
    }

    // Update developer revenue
    if (!isFreeCall) {
      this.creditDeveloper(params.serverId, params.toolName, developerShareMicro, params.userId);
    }

    // Store record
    this.usageRecords.push(record);

    // Cleanup old records (keep last 100K)
    if (this.usageRecords.length > 100000) {
      this.usageRecords = this.usageRecords.slice(-100000);
    }

    return record;
  }

  // ==========================================================================
  // Developer Revenue
  // ==========================================================================

  /**
   * Get or create developer revenue tracker
   */
  getDeveloperRevenue(developerId: string, walletAddress: string, serverId: string): DeveloperRevenue {
    const key = `${developerId}:${serverId}`;
    let revenue = this.developerRevenue.get(key);

    if (!revenue) {
      revenue = {
        developerId,
        walletAddress,
        serverId,
        totalEarnedMicro: 0n,
        pendingPayoutMicro: 0n,
        paidOutMicro: 0n,
        totalCalls: 0,
        uniqueUsers: 0,
        avgRevenuePerCall: 0,
        revenueByTool: {},
        revenueByPeriod: {
          today: 0n,
          thisWeek: 0n,
          thisMonth: 0n,
          allTime: 0n,
        },
        payoutHistory: [],
        nextPayoutDate: this.getEndOfMonth(Date.now()),
        minimumPayoutMicro: 1000000n,  // 1 SVMAI minimum payout
      };
      this.developerRevenue.set(key, revenue);
    }

    return revenue;
  }

  /**
   * Credit developer for a tool call
   */
  private creditDeveloper(serverId: string, toolName: string, amountMicro: bigint, userId: string): void {
    // In production, look up developer from server registry
    const developerId = serverId;
    const walletAddress = ''; // Would come from registry

    const revenue = this.getDeveloperRevenue(developerId, walletAddress, serverId);

    revenue.totalEarnedMicro += amountMicro;
    revenue.pendingPayoutMicro += amountMicro;
    revenue.totalCalls++;
    revenue.revenueByPeriod.today += amountMicro;
    revenue.revenueByPeriod.thisWeek += amountMicro;
    revenue.revenueByPeriod.thisMonth += amountMicro;
    revenue.revenueByPeriod.allTime += amountMicro;

    // Track per-tool revenue
    revenue.revenueByTool[toolName] = (revenue.revenueByTool[toolName] || 0n) + amountMicro;

    // Calculate average
    revenue.avgRevenuePerCall = Number(revenue.totalEarnedMicro) / revenue.totalCalls;

    // Check if payout threshold reached
    if (revenue.pendingPayoutMicro >= revenue.minimumPayoutMicro) {
      this.onRevenueThreshold?.(developerId, revenue.pendingPayoutMicro);
    }
  }

  /**
   * Process developer payout
   */
  async processPayout(developerId: string, serverId: string): Promise<{
    success: boolean;
    payoutId?: string;
    amount?: bigint;
    txSignature?: string;
    error?: string;
  }> {
    const key = `${developerId}:${serverId}`;
    const revenue = this.developerRevenue.get(key);

    if (!revenue) {
      return { success: false, error: 'Developer not found' };
    }

    if (revenue.pendingPayoutMicro < revenue.minimumPayoutMicro) {
      return { success: false, error: 'Below minimum payout threshold' };
    }

    const amount = revenue.pendingPayoutMicro;
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Add to payout history
    revenue.payoutHistory.push({
      id: payoutId,
      amount,
      paidAt: Date.now(),
      status: 'pending',
    });

    // In production: Execute SVMAI token transfer here
    // const txSignature = await transferSVMAI(revenue.walletAddress, amount);

    // Update balances
    revenue.pendingPayoutMicro = 0n;
    revenue.paidOutMicro += amount;

    // Update payout status
    const payout = revenue.payoutHistory.find(p => p.id === payoutId);
    if (payout) {
      payout.status = 'completed';
      // payout.txSignature = txSignature;
    }

    return {
      success: true,
      payoutId,
      amount,
      // txSignature,
    };
  }

  // ==========================================================================
  // Reporting
  // ==========================================================================

  /**
   * Generate billing report for a user
   */
  generateBillingReport(userId: string, period: BillingPeriod, startDate?: number): BillingReport {
    const now = Date.now();
    const endDate = now;
    let start: number;

    switch (period) {
      case 'hourly':
        start = startDate || now - 3600000;
        break;
      case 'daily':
        start = startDate || now - 86400000;
        break;
      case 'weekly':
        start = startDate || now - 7 * 86400000;
        break;
      case 'monthly':
      default:
        start = startDate || now - 30 * 86400000;
    }

    const records = this.usageRecords.filter(
      r => r.userId === userId && r.timestamp >= start && r.timestamp <= endDate
    );

    // Aggregate by tool
    const toolMap = new Map<string, { calls: number; costMicro: bigint; totalDuration: number }>();
    for (const record of records) {
      const key = `${record.serverId}:${record.toolName}`;
      const existing = toolMap.get(key) || { calls: 0, costMicro: 0n, totalDuration: 0 };
      existing.calls++;
      existing.costMicro += record.totalCostMicro;
      existing.totalDuration += record.durationMs;
      toolMap.set(key, existing);
    }

    // Aggregate by day
    const dayMap = new Map<string, { calls: number; costMicro: bigint }>();
    for (const record of records) {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      const existing = dayMap.get(date) || { calls: 0, costMicro: 0n };
      existing.calls++;
      existing.costMicro += record.totalCostMicro;
      dayMap.set(date, existing);
    }

    return {
      userId,
      period,
      startDate: start,
      endDate,
      totalCalls: records.length,
      successfulCalls: records.filter(r => r.success).length,
      failedCalls: records.filter(r => !r.success).length,
      totalCostMicro: records.reduce((sum, r) => sum + r.totalCostMicro, 0n),
      toolBreakdown: Array.from(toolMap.entries()).map(([key, data]) => {
        const [serverId, toolName] = key.split(':');
        return {
          toolName,
          serverId,
          calls: data.calls,
          costMicro: data.costMicro,
          avgDurationMs: data.totalDuration / data.calls,
        };
      }).sort((a, b) => Number(b.costMicro - a.costMicro)),
      dailyBreakdown: Array.from(dayMap.entries()).map(([date, data]) => ({
        date,
        calls: data.calls,
        costMicro: data.costMicro,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Get platform revenue summary
   */
  getPlatformRevenue(period: BillingPeriod = 'monthly'): {
    totalRevenueMicro: bigint;
    platformShareMicro: bigint;
    developerShareMicro: bigint;
    totalCalls: number;
    uniqueUsers: number;
    topTools: { tool: string; calls: number; revenueMicro: bigint }[];
    topDevelopers: { developerId: string; revenueMicro: bigint }[];
  } {
    const now = Date.now();
    let start: number;

    switch (period) {
      case 'hourly': start = now - 3600000; break;
      case 'daily': start = now - 86400000; break;
      case 'weekly': start = now - 7 * 86400000; break;
      case 'monthly':
      default: start = now - 30 * 86400000;
    }

    const records = this.usageRecords.filter(r => r.timestamp >= start);

    const toolRevenue = new Map<string, { calls: number; revenueMicro: bigint }>();
    const developerRevenue = new Map<string, bigint>();
    const users = new Set<string>();

    let totalRevenueMicro = 0n;
    let platformShareMicro = 0n;
    let developerShareMicro = 0n;

    for (const record of records) {
      totalRevenueMicro += record.totalCostMicro;
      platformShareMicro += record.platformShareMicro;
      developerShareMicro += record.developerShareMicro;
      users.add(record.userId);

      const toolKey = record.qualifiedName;
      const existing = toolRevenue.get(toolKey) || { calls: 0, revenueMicro: 0n };
      existing.calls++;
      existing.revenueMicro += record.totalCostMicro;
      toolRevenue.set(toolKey, existing);

      developerRevenue.set(
        record.serverId,
        (developerRevenue.get(record.serverId) || 0n) + record.developerShareMicro
      );
    }

    return {
      totalRevenueMicro,
      platformShareMicro,
      developerShareMicro,
      totalCalls: records.length,
      uniqueUsers: users.size,
      topTools: Array.from(toolRevenue.entries())
        .map(([tool, data]) => ({ tool, ...data }))
        .sort((a, b) => Number(b.revenueMicro - a.revenueMicro))
        .slice(0, 10),
      topDevelopers: Array.from(developerRevenue.entries())
        .map(([developerId, revenueMicro]) => ({ developerId, revenueMicro }))
        .sort((a, b) => Number(b.revenueMicro - a.revenueMicro))
        .slice(0, 10),
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private getToolPricing(toolName: string, serverId?: string): ToolPricing {
    const key = serverId ? `${serverId}:${toolName}` : toolName;
    const specific = TOOL_PRICING[key] || TOOL_PRICING[toolName] || {};

    return {
      toolName,
      serverId: serverId || 'opensvm',
      ...DEFAULT_PRICING,
      ...specific,
    } as ToolPricing;
  }

  private getToolFreeUsage(userId: string, toolName: string): { count: number; resetAt: number } {
    let userUsage = this.toolFreeUsage.get(userId);
    if (!userUsage) {
      userUsage = new Map();
      this.toolFreeUsage.set(userId, userUsage);
    }

    let toolUsage = userUsage.get(toolName);
    const now = Date.now();

    if (!toolUsage || now >= toolUsage.resetAt) {
      toolUsage = { count: 0, resetAt: this.getEndOfDay(now) };
      userUsage.set(toolName, toolUsage);
    }

    return toolUsage;
  }

  private resetExpiredPeriods(quota: UserQuota): void {
    const now = Date.now();

    if (now >= quota.minuteResetAt) {
      quota.currentMinuteCalls = 0;
      quota.minuteResetAt = now + 60000;
    }

    if (now >= quota.hourResetAt) {
      quota.currentHourCalls = 0;
      quota.hourResetAt = now + 3600000;
    }

    if (now >= quota.dayResetAt) {
      quota.currentDayCalls = 0;
      quota.dayResetAt = this.getEndOfDay(now);
    }

    if (now >= quota.monthResetAt) {
      quota.currentMonthCalls = 0;
      quota.currentMonthSpentMicro = 0n;
      quota.monthResetAt = this.getEndOfMonth(now);
    }
  }

  private getEndOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setUTCHours(23, 59, 59, 999);
    return date.getTime();
  }

  private getEndOfMonth(timestamp: number): number {
    const date = new Date(timestamp);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    date.setUTCHours(23, 59, 59, 999);
    return date.getTime();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalMetering: MeteringService | null = null;

export function getMetering(): MeteringService {
  if (!globalMetering) {
    globalMetering = new MeteringService();
  }
  return globalMetering;
}

export function createMetering(options?: ConstructorParameters<typeof MeteringService>[0]): MeteringService {
  globalMetering = new MeteringService(options);
  return globalMetering;
}

// ============================================================================
// Middleware for Tool Execution
// ============================================================================

/**
 * Higher-order function to add metering to tool execution
 */
export function withMetering<T>(
  metering: MeteringService,
  userId: string,
  toolName: string,
  serverId: string,
  executor: () => Promise<T>,
  options?: { walletAddress?: string; apiKeyId?: string; metadata?: Record<string, any> }
): Promise<T> {
  // Check quota first
  const check = metering.canMakeCall(userId, toolName);
  if (!check.allowed) {
    return Promise.reject(new Error(check.reason));
  }

  const startTime = Date.now();
  let inputBytes = 0;

  return executor()
    .then(result => {
      const outputBytes = JSON.stringify(result).length;

      metering.recordCall({
        userId,
        walletAddress: options?.walletAddress,
        apiKeyId: options?.apiKeyId,
        toolName,
        serverId,
        durationMs: Date.now() - startTime,
        inputBytes,
        outputBytes,
        success: true,
        metadata: options?.metadata,
      });

      return result;
    })
    .catch(error => {
      metering.recordCall({
        userId,
        walletAddress: options?.walletAddress,
        apiKeyId: options?.apiKeyId,
        toolName,
        serverId,
        durationMs: Date.now() - startTime,
        inputBytes,
        outputBytes: 0,
        success: false,
        metadata: { ...options?.metadata, error: error.message },
      });

      throw error;
    });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MeteringService,
  getMetering,
  createMetering,
  withMetering,
  TOOL_PRICING,
  TIER_LIMITS,
};
