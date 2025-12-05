/**
 * Mining Event System
 *
 * Real-time event broadcasting for $OMCP mining, PoUW challenges, and network activity.
 * Uses Server-Sent Events (SSE) for browser-compatible streaming.
 *
 * @module mcp-mining-events
 */

// ============================================================================
// Types
// ============================================================================

export type MiningEventType =
  | 'challenge_created'
  | 'challenge_completed'
  | 'challenge_expired'
  | 'reward_minted'
  | 'tokens_staked'
  | 'tokens_transferred'
  | 'leaderboard_update'
  | 'network_stats'
  | 'pouw_work_created'
  | 'pouw_work_submitted'
  | 'pouw_work_accepted'
  | 'pouw_work_rejected'
  | 'worker_joined'
  | 'worker_milestone'
  | 'epoch_change'
  | 'halving_approaching'
  | 'heartbeat';

export interface MiningEvent {
  id: string;
  type: MiningEventType;
  timestamp: number;
  data: any;
  metadata?: {
    serverId?: string;
    workerId?: string;
    challengeId?: string;
    reward?: string;
    quality?: number;
  };
}

export interface Subscription {
  id: string;
  send: (event: MiningEvent) => void;
  filters?: {
    types?: MiningEventType[];
    serverId?: string;
    minReward?: number;
  };
  connectedAt: number;
  lastEventAt: number;
  eventCount: number;
}

export interface NetworkSnapshot {
  timestamp: number;
  activeMiners: number;
  pendingChallenges: number;
  completedLast5Min: number;
  rewardsLast5Min: string;
  averageQuality: number;
  topMiner?: {
    serverId: string;
    rewardsLast5Min: string;
  };
}

// ============================================================================
// Mining Event Bus
// ============================================================================

class MiningEventBus {
  private subscriptions = new Map<string, Subscription>();
  private recentEvents: MiningEvent[] = [];
  private maxRecentEvents = 100;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private eventCounter = 0;

  // Stats tracking
  private stats = {
    totalEvents: 0,
    eventsByType: new Map<MiningEventType, number>(),
    recentRewards: [] as { timestamp: number; amount: bigint }[],
    recentCompletions: [] as { timestamp: number; serverId: string; quality: number }[],
    activeServers: new Set<string>(),
  };

  constructor() {
    this.startHeartbeat();
    this.startStatsReporter();
  }

  /**
   * Subscribe to mining events
   */
  subscribe(options: {
    send: (event: MiningEvent) => void;
    filters?: Subscription['filters'];
  }): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const subscription: Subscription = {
      id,
      send: options.send,
      filters: options.filters,
      connectedAt: Date.now(),
      lastEventAt: Date.now(),
      eventCount: 0,
    };

    this.subscriptions.set(id, subscription);

    // Send recent events that match filters
    const matchingEvents = this.recentEvents.filter(e => this.matchesFilters(e, subscription.filters));
    for (const event of matchingEvents.slice(-10)) {
      options.send(event);
    }

    console.log(`[Mining Events] New subscriber: ${id} (total: ${this.subscriptions.size})`);

    return id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    if (removed) {
      console.log(`[Mining Events] Unsubscribed: ${subscriptionId} (total: ${this.subscriptions.size})`);
    }
    return removed;
  }

  /**
   * Emit an event to all matching subscribers
   */
  emit(type: MiningEventType, data: any, metadata?: MiningEvent['metadata']): void {
    const event: MiningEvent = {
      id: `evt_${Date.now()}_${this.eventCounter++}`,
      type,
      timestamp: Date.now(),
      data,
      metadata,
    };

    // Track stats
    this.stats.totalEvents++;
    this.stats.eventsByType.set(type, (this.stats.eventsByType.get(type) || 0) + 1);

    if (metadata?.serverId) {
      this.stats.activeServers.add(metadata.serverId);
    }

    if (type === 'reward_minted' && metadata?.reward) {
      this.stats.recentRewards.push({
        timestamp: Date.now(),
        amount: BigInt(metadata.reward),
      });
      // Keep only last 5 minutes
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      this.stats.recentRewards = this.stats.recentRewards.filter(r => r.timestamp > fiveMinAgo);
    }

    if ((type === 'challenge_completed' || type === 'pouw_work_accepted') && metadata?.serverId) {
      this.stats.recentCompletions.push({
        timestamp: Date.now(),
        serverId: metadata.serverId,
        quality: metadata.quality || 0,
      });
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      this.stats.recentCompletions = this.stats.recentCompletions.filter(c => c.timestamp > fiveMinAgo);
    }

    // Store in recent events
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    // Broadcast to subscribers
    let sentCount = 0;
    for (const [id, subscription] of this.subscriptions) {
      if (this.matchesFilters(event, subscription.filters)) {
        try {
          subscription.send(event);
          subscription.lastEventAt = Date.now();
          subscription.eventCount++;
          sentCount++;
        } catch (error) {
          console.error(`[Mining Events] Error sending to ${id}:`, error);
          this.subscriptions.delete(id);
        }
      }
    }

    if (type !== 'heartbeat' && type !== 'network_stats') {
      console.log(`[Mining Events] ${type} -> ${sentCount}/${this.subscriptions.size} subscribers`);
    }
  }

  /**
   * Get current network snapshot
   */
  getNetworkSnapshot(): NetworkSnapshot {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    // Calculate rewards in last 5 min
    const rewardsLast5Min = this.stats.recentRewards
      .filter(r => r.timestamp > fiveMinAgo)
      .reduce((sum, r) => sum + r.amount, 0n);

    // Calculate completions in last 5 min
    const completionsLast5Min = this.stats.recentCompletions.filter(c => c.timestamp > fiveMinAgo);

    // Find top miner in last 5 min
    const minerRewards = new Map<string, bigint>();
    for (const completion of completionsLast5Min) {
      // Estimate reward from quality
      const estimated = BigInt(Math.floor(completion.quality * 10 * 1e9));
      minerRewards.set(completion.serverId, (minerRewards.get(completion.serverId) || 0n) + estimated);
    }

    let topMiner: NetworkSnapshot['topMiner'] | undefined;
    let maxReward = 0n;
    for (const [serverId, reward] of minerRewards) {
      if (reward > maxReward) {
        maxReward = reward;
        topMiner = { serverId, rewardsLast5Min: reward.toString() };
      }
    }

    return {
      timestamp: Date.now(),
      activeMiners: this.stats.activeServers.size,
      pendingChallenges: 0, // Would need to be passed in
      completedLast5Min: completionsLast5Min.length,
      rewardsLast5Min: rewardsLast5Min.toString(),
      averageQuality: completionsLast5Min.length > 0
        ? Math.round(completionsLast5Min.reduce((sum, c) => sum + c.quality, 0) / completionsLast5Min.length)
        : 0,
      topMiner,
    };
  }

  /**
   * Get subscription stats
   */
  getStats(): {
    subscribers: number;
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEventsCount: number;
  } {
    return {
      subscribers: this.subscriptions.size,
      totalEvents: this.stats.totalEvents,
      eventsByType: Object.fromEntries(this.stats.eventsByType),
      recentEventsCount: this.recentEvents.length,
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 20, types?: MiningEventType[]): MiningEvent[] {
    let events = this.recentEvents;
    if (types && types.length > 0) {
      events = events.filter(e => types.includes(e.type));
    }
    return events.slice(-limit);
  }

  private matchesFilters(event: MiningEvent, filters?: Subscription['filters']): boolean {
    if (!filters) return true;

    if (filters.types && filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    if (filters.serverId && event.metadata?.serverId !== filters.serverId) {
      return false;
    }

    if (filters.minReward && event.metadata?.reward) {
      const reward = BigInt(event.metadata.reward);
      if (reward < BigInt(filters.minReward * 1e9)) {
        return false;
      }
    }

    return true;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.emit('heartbeat', {
        subscribers: this.subscriptions.size,
        uptime: process.uptime(),
      });
    }, 30000); // Every 30 seconds
  }

  private startStatsReporter(): void {
    this.statsInterval = setInterval(() => {
      const snapshot = this.getNetworkSnapshot();
      this.emit('network_stats', snapshot);
    }, 60000); // Every minute
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    this.subscriptions.clear();
    console.log('[Mining Events] Shutdown complete');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const miningEvents = new MiningEventBus();

// ============================================================================
// Helper Functions for Common Events
// ============================================================================

/**
 * Emit challenge created event
 */
export function emitChallengeCreated(
  challengeId: string,
  serverId: string,
  workType: string,
  difficulty: number,
  baseReward: string
): void {
  miningEvents.emit('challenge_created', {
    challengeId,
    serverId,
    workType,
    difficulty,
    baseReward,
    baseRewardUi: Number(BigInt(baseReward)) / 1e9,
  }, { challengeId, serverId });
}

/**
 * Emit challenge completed event
 */
export function emitChallengeCompleted(
  challengeId: string,
  serverId: string,
  reward: string,
  quality?: number
): void {
  miningEvents.emit('challenge_completed', {
    challengeId,
    serverId,
    reward,
    rewardUi: Number(BigInt(reward)) / 1e9,
    quality,
  }, { challengeId, serverId, reward, quality });

  // Also emit reward minted
  miningEvents.emit('reward_minted', {
    serverId,
    amount: reward,
    amountUi: Number(BigInt(reward)) / 1e9,
    challengeId,
  }, { serverId, reward, challengeId });
}

/**
 * Emit tokens staked event
 */
export function emitTokensStaked(
  address: string,
  amount: string,
  trustBoost: number
): void {
  miningEvents.emit('tokens_staked', {
    address,
    amount,
    amountUi: Number(BigInt(amount)) / 1e9,
    trustBoost,
  }, { serverId: address });
}

/**
 * Emit PoUW work events
 */
export function emitPoUWCreated(
  challengeId: string,
  serverId: string,
  workType: string,
  baseReward: string
): void {
  miningEvents.emit('pouw_work_created', {
    challengeId,
    serverId,
    workType,
    baseReward,
    baseRewardUi: Number(BigInt(baseReward)) / 1e9,
  }, { challengeId, serverId });
}

export function emitPoUWAccepted(
  challengeId: string,
  serverId: string,
  reward: string,
  quality: number
): void {
  miningEvents.emit('pouw_work_accepted', {
    challengeId,
    serverId,
    reward,
    rewardUi: Number(BigInt(reward)) / 1e9,
    quality,
  }, { challengeId, serverId, reward, quality });
}

export function emitPoUWRejected(
  challengeId: string,
  serverId: string,
  reason: string,
  quality: number
): void {
  miningEvents.emit('pouw_work_rejected', {
    challengeId,
    serverId,
    reason,
    quality,
  }, { challengeId, serverId, quality });
}

/**
 * Emit epoch change event
 */
export function emitEpochChange(
  oldEpoch: number,
  newEpoch: number,
  oldReward: string,
  newReward: string
): void {
  miningEvents.emit('epoch_change', {
    oldEpoch,
    newEpoch,
    oldReward,
    oldRewardUi: Number(BigInt(oldReward)) / 1e9,
    newReward,
    newRewardUi: Number(BigInt(newReward)) / 1e9,
    message: `Mining epoch ${newEpoch} started! Rewards halved to ${Number(BigInt(newReward)) / 1e9} OMCP`,
  });
}

/**
 * Emit halving warning
 */
export function emitHalvingApproaching(
  currentEpoch: number,
  challengesUntil: number,
  currentReward: string
): void {
  miningEvents.emit('halving_approaching', {
    currentEpoch,
    challengesUntil,
    currentReward,
    currentRewardUi: Number(BigInt(currentReward)) / 1e9,
    message: `Only ${challengesUntil} challenges until next halving!`,
  });
}

/**
 * Emit leaderboard update
 */
export function emitLeaderboardUpdate(
  topMiners: Array<{
    rank: number;
    serverId: string;
    totalRewards: string;
    challengesCompleted: number;
  }>
): void {
  miningEvents.emit('leaderboard_update', {
    topMiners: topMiners.map(m => ({
      ...m,
      totalRewardsUi: Number(BigInt(m.totalRewards)) / 1e9,
    })),
    timestamp: Date.now(),
  });
}

// ============================================================================
// SSE Response Helpers
// ============================================================================

/**
 * Format event for SSE
 */
export function formatSSE(event: MiningEvent): string {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    '',
    '',
  ].join('\n');
}

/**
 * Create SSE headers
 */
export function createSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  miningEvents,
  emitChallengeCreated,
  emitChallengeCompleted,
  emitTokensStaked,
  emitPoUWCreated,
  emitPoUWAccepted,
  emitPoUWRejected,
  emitEpochChange,
  emitHalvingApproaching,
  emitLeaderboardUpdate,
  formatSSE,
  createSSEHeaders,
};
