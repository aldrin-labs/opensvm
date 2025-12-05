#!/usr/bin/env bun
/**
 * Kalshi Copy Trading System
 *
 * Follow top-performing traders and mirror their trades automatically.
 * Features:
 * - Leader registration and performance tracking
 * - Follower subscription management
 * - Proportional trade mirroring
 * - Configurable filters (min confidence, max size)
 * - Delay options for execution
 * - Risk limits per follower
 * - Revenue sharing model support
 */

import { EventEmitter } from 'events';
import { PaperTradingEngine, type VirtualTrade, type VirtualPosition } from './mcp-kalshi-paper-trading.js';

// ============================================================================
// Types
// ============================================================================

export interface Leader {
  id: string;
  name: string;
  description: string;
  paperEngine: PaperTradingEngine;
  verified: boolean;
  public: boolean;
  createdAt: number;
  stats: LeaderStats;
  settings: LeaderSettings;
}

export interface LeaderStats {
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  avgTradeReturn: number;
  maxDrawdown: number;
  followers: number;
  totalCopiedVolume: number;
  lastTradeTime: number;
  streak: number;
  rank: number;
}

export interface LeaderSettings {
  minFollowAmount: number;      // Minimum equity to follow
  maxFollowers: number;         // Max allowed followers
  revenueSharePercent: number;  // % of follower profits shared
  allowPartialCopy: boolean;    // Allow followers to copy partial amounts
  tradeDelay: number;           // Delay before followers can copy (ms)
  showPositions: boolean;       // Show current positions to followers
}

export interface Follower {
  id: string;
  name: string;
  leaderId: string;
  paperEngine: PaperTradingEngine;
  settings: FollowerSettings;
  stats: FollowerStats;
  createdAt: number;
  active: boolean;
}

export interface FollowerSettings {
  copyRatio: number;            // Ratio of leader's trade size to copy (0.1 = 10%)
  maxCopySize: number;          // Max contracts per copied trade
  minLeaderConfidence: number;  // Min leader confidence to copy (0-100)
  copyDelay: number;            // Additional delay before copying (ms)
  maxDailyLoss: number;         // Stop copying if daily loss exceeds
  marketWhitelist?: string[];   // Only copy trades in these markets
  marketBlacklist?: string[];   // Never copy trades in these markets
  autoPause: boolean;           // Auto-pause on significant leader drawdown
  autoPauseDrawdown: number;    // Drawdown % to trigger auto-pause
}

export interface FollowerStats {
  totalCopiedTrades: number;
  successfulCopies: number;
  failedCopies: number;
  totalCopiedVolume: number;
  pnlFromCopying: number;
  revenueSharePaid: number;
  avgSlippage: number;
  lastCopyTime: number;
}

export interface CopyEvent {
  id: string;
  leaderId: string;
  followerId: string;
  originalTrade: VirtualTrade;
  copiedTrade?: VirtualTrade;
  status: 'pending' | 'copied' | 'skipped' | 'failed';
  reason?: string;
  slippage?: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  rank: number;
  leaderId: string;
  name: string;
  totalReturn: number;
  sharpeRatio: number;
  winRate: number;
  followers: number;
  copiedVolume: number;
  verified: boolean;
}

// ============================================================================
// Copy Trading Engine
// ============================================================================

export class CopyTradingEngine extends EventEmitter {
  private leaders: Map<string, Leader> = new Map();
  private followers: Map<string, Follower> = new Map();
  private copyEvents: CopyEvent[] = [];
  private leaderboard: LeaderboardEntry[] = [];

  private updateInterval?: ReturnType<typeof setInterval>;
  private copyEventCounter = 0;

  constructor() {
    super();
    this.startUpdateLoop();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leader Management
  // ─────────────────────────────────────────────────────────────────────────

  registerLeader(
    id: string,
    name: string,
    description: string,
    paperEngine: PaperTradingEngine,
    settings: Partial<LeaderSettings> = {}
  ): Leader {
    const leader: Leader = {
      id,
      name,
      description,
      paperEngine,
      verified: false,
      public: true,
      createdAt: Date.now(),
      stats: {
        totalReturn: 0,
        totalReturnPercent: 0,
        sharpeRatio: 0,
        winRate: 0,
        totalTrades: 0,
        avgTradeReturn: 0,
        maxDrawdown: 0,
        followers: 0,
        totalCopiedVolume: 0,
        lastTradeTime: 0,
        streak: 0,
        rank: 0,
      },
      settings: {
        minFollowAmount: 10000, // $100 min
        maxFollowers: 100,
        revenueSharePercent: 10,
        allowPartialCopy: true,
        tradeDelay: 0,
        showPositions: true,
        ...settings,
      },
    };

    // Listen for leader trades
    paperEngine.on('fill', (data) => {
      this.handleLeaderTrade(leader, data.trade);
    });

    this.leaders.set(id, leader);
    this.emit('leader_registered', { id, name });
    this.updateLeaderboard();

    return leader;
  }

  unregisterLeader(id: string): boolean {
    const leader = this.leaders.get(id);
    if (!leader) return false;

    // Notify followers
    for (const follower of Array.from(this.followers.values())) {
      if (follower.leaderId === id) {
        follower.active = false;
        this.emit('follower_orphaned', { followerId: follower.id, leaderId: id });
      }
    }

    this.leaders.delete(id);
    this.emit('leader_unregistered', { id });
    this.updateLeaderboard();

    return true;
  }

  getLeader(id: string): Leader | undefined {
    return this.leaders.get(id);
  }

  getLeaders(): Leader[] {
    return Array.from(this.leaders.values());
  }

  getPublicLeaders(): Leader[] {
    return Array.from(this.leaders.values()).filter(l => l.public);
  }

  verifyLeader(id: string): boolean {
    const leader = this.leaders.get(id);
    if (!leader) return false;

    leader.verified = true;
    this.emit('leader_verified', { id });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Follower Management
  // ─────────────────────────────────────────────────────────────────────────

  followLeader(
    followerId: string,
    followerName: string,
    leaderId: string,
    paperEngine: PaperTradingEngine,
    settings: Partial<FollowerSettings> = {}
  ): Follower {
    const leader = this.leaders.get(leaderId);
    if (!leader) {
      throw new Error(`Leader ${leaderId} not found`);
    }

    if (leader.stats.followers >= leader.settings.maxFollowers) {
      throw new Error(`Leader ${leaderId} has reached max followers`);
    }

    const equity = paperEngine.getEquity();
    if (equity < leader.settings.minFollowAmount) {
      throw new Error(`Minimum equity of $${leader.settings.minFollowAmount / 100} required`);
    }

    const follower: Follower = {
      id: followerId,
      name: followerName,
      leaderId,
      paperEngine,
      settings: {
        copyRatio: 0.5,          // Copy 50% of leader size by default
        maxCopySize: 50,
        minLeaderConfidence: 50,
        copyDelay: 0,
        maxDailyLoss: 5000,     // $50 max daily loss
        autoPause: true,
        autoPauseDrawdown: 15,  // Pause if leader draws down 15%
        ...settings,
      },
      stats: {
        totalCopiedTrades: 0,
        successfulCopies: 0,
        failedCopies: 0,
        totalCopiedVolume: 0,
        pnlFromCopying: 0,
        revenueSharePaid: 0,
        avgSlippage: 0,
        lastCopyTime: 0,
      },
      createdAt: Date.now(),
      active: true,
    };

    this.followers.set(followerId, follower);
    leader.stats.followers++;

    this.emit('follower_added', { followerId, leaderId, followerName });
    return follower;
  }

  unfollowLeader(followerId: string): boolean {
    const follower = this.followers.get(followerId);
    if (!follower) return false;

    const leader = this.leaders.get(follower.leaderId);
    if (leader) {
      leader.stats.followers--;
    }

    this.followers.delete(followerId);
    this.emit('follower_removed', { followerId, leaderId: follower.leaderId });

    return true;
  }

  pauseFollowing(followerId: string): boolean {
    const follower = this.followers.get(followerId);
    if (!follower) return false;

    follower.active = false;
    this.emit('follower_paused', { followerId });
    return true;
  }

  resumeFollowing(followerId: string): boolean {
    const follower = this.followers.get(followerId);
    if (!follower) return false;

    follower.active = true;
    this.emit('follower_resumed', { followerId });
    return true;
  }

  getFollower(id: string): Follower | undefined {
    return this.followers.get(id);
  }

  getFollowersForLeader(leaderId: string): Follower[] {
    return Array.from(this.followers.values()).filter(f => f.leaderId === leaderId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trade Copying
  // ─────────────────────────────────────────────────────────────────────────

  private async handleLeaderTrade(leader: Leader, trade: VirtualTrade): Promise<void> {
    // Update leader stats
    leader.stats.totalTrades++;
    leader.stats.lastTradeTime = trade.timestamp;

    // Get all active followers
    const followers = this.getFollowersForLeader(leader.id).filter(f => f.active);

    // Apply leader's trade delay
    if (leader.settings.tradeDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, leader.settings.tradeDelay));
    }

    // Copy to each follower
    for (const follower of followers) {
      this.copyTradeToFollower(leader, follower, trade);
    }
  }

  private async copyTradeToFollower(
    leader: Leader,
    follower: Follower,
    originalTrade: VirtualTrade
  ): Promise<void> {
    const copyEventId = `CE-${++this.copyEventCounter}`;

    const copyEvent: CopyEvent = {
      id: copyEventId,
      leaderId: leader.id,
      followerId: follower.id,
      originalTrade,
      status: 'pending',
      timestamp: Date.now(),
    };

    // Check filters
    const skipReason = this.checkCopyFilters(follower, originalTrade);
    if (skipReason) {
      copyEvent.status = 'skipped';
      copyEvent.reason = skipReason;
      this.copyEvents.push(copyEvent);
      this.emit('copy_skipped', copyEvent);
      return;
    }

    // Apply follower's additional delay
    if (follower.settings.copyDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, follower.settings.copyDelay));
    }

    // Calculate copy size
    const copyQuantity = Math.min(
      Math.ceil(originalTrade.quantity * follower.settings.copyRatio),
      follower.settings.maxCopySize
    );

    if (copyQuantity <= 0) {
      copyEvent.status = 'skipped';
      copyEvent.reason = 'Copy quantity too small';
      this.copyEvents.push(copyEvent);
      return;
    }

    try {
      // Execute copy trade
      const order = await follower.paperEngine.submitOrder({
        ticker: originalTrade.ticker,
        side: originalTrade.side,
        action: originalTrade.action,
        type: 'market', // Use market order to ensure fill
        quantity: copyQuantity,
      });

      if (order.status === 'filled' || order.status === 'partially_filled') {
        copyEvent.status = 'copied';
        copyEvent.slippage = Math.abs(order.avgFillPrice - originalTrade.price);

        // Update follower stats
        follower.stats.totalCopiedTrades++;
        follower.stats.successfulCopies++;
        follower.stats.totalCopiedVolume += order.filledQuantity;
        follower.stats.lastCopyTime = Date.now();

        // Update average slippage
        const n = follower.stats.successfulCopies;
        follower.stats.avgSlippage = ((n - 1) * follower.stats.avgSlippage + copyEvent.slippage) / n;

        // Update leader's copied volume
        leader.stats.totalCopiedVolume += order.filledQuantity;

        this.emit('copy_success', copyEvent);
      } else {
        copyEvent.status = 'failed';
        copyEvent.reason = order.reason || 'Order not filled';
        follower.stats.failedCopies++;
        this.emit('copy_failed', copyEvent);
      }
    } catch (error) {
      copyEvent.status = 'failed';
      copyEvent.reason = error instanceof Error ? error.message : 'Unknown error';
      follower.stats.failedCopies++;
      this.emit('copy_failed', copyEvent);
    }

    this.copyEvents.push(copyEvent);
  }

  private checkCopyFilters(follower: Follower, trade: VirtualTrade): string | null {
    // Check whitelist
    if (follower.settings.marketWhitelist?.length) {
      if (!follower.settings.marketWhitelist.includes(trade.ticker)) {
        return 'Market not in whitelist';
      }
    }

    // Check blacklist
    if (follower.settings.marketBlacklist?.includes(trade.ticker)) {
      return 'Market in blacklist';
    }

    // Check daily loss limit
    const metrics = follower.paperEngine.getMetrics();
    if (metrics.totalReturn < -follower.settings.maxDailyLoss) {
      return 'Daily loss limit reached';
    }

    // Check auto-pause for leader drawdown
    if (follower.settings.autoPause) {
      const leader = this.leaders.get(follower.leaderId);
      if (leader && leader.stats.maxDrawdown >= follower.settings.autoPauseDrawdown) {
        follower.active = false;
        return 'Leader drawdown triggered auto-pause';
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats & Leaderboard
  // ─────────────────────────────────────────────────────────────────────────

  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateAllStats();
      this.updateLeaderboard();
    }, 5000);
  }

  private updateAllStats(): void {
    for (const leader of Array.from(this.leaders.values())) {
      const metrics = leader.paperEngine.getMetrics();
      leader.stats.totalReturn = metrics.totalReturn;
      leader.stats.totalReturnPercent = metrics.totalReturnPercent;
      leader.stats.sharpeRatio = metrics.sharpeRatio;
      leader.stats.winRate = metrics.winRate;
      leader.stats.maxDrawdown = metrics.maxDrawdownPercent;
      leader.stats.streak = metrics.currentStreak;

      if (metrics.totalTrades > 0) {
        leader.stats.avgTradeReturn = metrics.totalReturn / metrics.totalTrades;
      }
    }
  }

  private updateLeaderboard(): void {
    const entries: LeaderboardEntry[] = Array.from(this.leaders.values())
      .filter(l => l.public)
      .map(l => ({
        rank: 0,
        leaderId: l.id,
        name: l.name,
        totalReturn: l.stats.totalReturnPercent,
        sharpeRatio: l.stats.sharpeRatio,
        winRate: l.stats.winRate,
        followers: l.stats.followers,
        copiedVolume: l.stats.totalCopiedVolume,
        verified: l.verified,
      }))
      .sort((a, b) => {
        // Sort by Sharpe first, then return
        const sharpeScore = (b.sharpeRatio - a.sharpeRatio) * 2;
        const returnScore = b.totalReturn - a.totalReturn;
        return sharpeScore + returnScore;
      });

    entries.forEach((e, i) => {
      e.rank = i + 1;
      const leader = this.leaders.get(e.leaderId);
      if (leader) leader.stats.rank = i + 1;
    });

    this.leaderboard = entries;
    this.emit('leaderboard_updated', this.leaderboard);
  }

  getLeaderboard(): LeaderboardEntry[] {
    return this.leaderboard;
  }

  getCopyEvents(options: {
    leaderId?: string;
    followerId?: string;
    status?: CopyEvent['status'];
    limit?: number;
  } = {}): CopyEvent[] {
    let events = this.copyEvents;

    if (options.leaderId) {
      events = events.filter(e => e.leaderId === options.leaderId);
    }
    if (options.followerId) {
      events = events.filter(e => e.followerId === options.followerId);
    }
    if (options.status) {
      events = events.filter(e => e.status === options.status);
    }

    events = events.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Revenue Sharing
  // ─────────────────────────────────────────────────────────────────────────

  calculateRevenueShare(followerId: string): { profit: number; share: number; net: number } {
    const follower = this.followers.get(followerId);
    if (!follower) return { profit: 0, share: 0, net: 0 };

    const leader = this.leaders.get(follower.leaderId);
    if (!leader) return { profit: 0, share: 0, net: 0 };

    const profit = Math.max(0, follower.stats.pnlFromCopying);
    const sharePercent = leader.settings.revenueSharePercent / 100;
    const share = profit * sharePercent;

    return {
      profit,
      share,
      net: profit - share,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

// ============================================================================
// MCP Tools
// ============================================================================

export const COPY_TRADING_TOOLS = [
  {
    name: 'copy_register_leader',
    description: 'Register as a copy trading leader',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique leader ID' },
        name: { type: 'string', description: 'Display name' },
        description: { type: 'string', description: 'Strategy description' },
        min_follow_amount: { type: 'number', description: 'Minimum equity to follow (cents)' },
        revenue_share_percent: { type: 'number', description: 'Profit share percentage (0-50)' },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: 'copy_follow_leader',
    description: 'Start following a leader and copying their trades',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Your unique follower ID' },
        follower_name: { type: 'string', description: 'Your display name' },
        leader_id: { type: 'string', description: 'Leader ID to follow' },
        copy_ratio: { type: 'number', description: 'Ratio of leader trades to copy (0-1)' },
        max_copy_size: { type: 'number', description: 'Max contracts per copied trade' },
      },
      required: ['follower_id', 'follower_name', 'leader_id'],
    },
  },
  {
    name: 'copy_unfollow',
    description: 'Stop following a leader',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Your follower ID' },
      },
      required: ['follower_id'],
    },
  },
  {
    name: 'copy_pause',
    description: 'Pause copy trading temporarily',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Your follower ID' },
      },
      required: ['follower_id'],
    },
  },
  {
    name: 'copy_resume',
    description: 'Resume copy trading',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Your follower ID' },
      },
      required: ['follower_id'],
    },
  },
  {
    name: 'copy_leaderboard',
    description: 'Get the copy trading leaderboard',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max leaders to return' },
        verified_only: { type: 'boolean', description: 'Only show verified leaders' },
      },
    },
  },
  {
    name: 'copy_leader_details',
    description: 'Get detailed stats for a specific leader',
    inputSchema: {
      type: 'object',
      properties: {
        leader_id: { type: 'string', description: 'Leader ID' },
      },
      required: ['leader_id'],
    },
  },
  {
    name: 'copy_follower_stats',
    description: 'Get your copy trading statistics',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Your follower ID' },
      },
      required: ['follower_id'],
    },
  },
  {
    name: 'copy_events',
    description: 'Get recent copy trading events',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Filter by follower ID' },
        leader_id: { type: 'string', description: 'Filter by leader ID' },
        status: { type: 'string', enum: ['pending', 'copied', 'skipped', 'failed'] },
        limit: { type: 'number', description: 'Max events to return' },
      },
    },
  },
  {
    name: 'copy_revenue_share',
    description: 'Calculate revenue share owed to leader',
    inputSchema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', description: 'Your follower ID' },
      },
      required: ['follower_id'],
    },
  },
];

// ============================================================================
// Factory
// ============================================================================

export function createCopyTradingEngine(): CopyTradingEngine {
  return new CopyTradingEngine();
}
