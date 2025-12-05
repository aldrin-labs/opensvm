/**
 * Unit Tests for Kalshi Copy Trading System
 *
 * Tests cover:
 * - Leader registration and management
 * - Follower subscription
 * - Trade copying logic
 * - Revenue sharing calculations
 * - Leaderboard ranking
 * - Event emission
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { EventEmitter } from 'events';
import {
  CopyTradingEngine,
  type Leader,
  type Follower,
  type CopyEvent,
} from '../src/mcp-kalshi-copy-trading.js';
import {
  PaperTradingEngine,
  DEFAULT_PAPER_CONFIG,
} from '../src/mcp-kalshi-paper-trading.js';

// ============================================================================
// Mocks
// ============================================================================

class MockWebSocketClient extends EventEmitter {
  async connect(): Promise<void> {}
  disconnect(): void {}
  subscribe(): string { return 'sub-1'; }
  unsubscribe(): boolean { return true; }
  isConnected(): boolean { return true; }
}

class MockAggregator extends EventEmitter {
  private marketData: Map<string, any> = new Map();

  setMarketData(ticker: string, data: any): void {
    this.marketData.set(ticker, data);
    this.emit('marketUpdate', data);
  }

  getMarketData(ticker: string): any {
    return this.marketData.get(ticker);
  }

  subscribe(tickers: string[]): void {}
}

function createMockMarketData(ticker: string, yesBid: number = 50) {
  return {
    ticker,
    lastUpdate: Date.now(),
    orderbook: {
      yes: [{ price: yesBid, quantity: 100 }],
      no: [{ price: 100 - yesBid, quantity: 100 }],
      spread: 0,
      midPrice: yesBid,
    },
    trades: [],
    volume1m: 50,
    vwap1m: yesBid,
    priceChange1m: 0,
  };
}

function createPaperEngine(mockWs: MockWebSocketClient, mockAggregator: MockAggregator): PaperTradingEngine {
  return new PaperTradingEngine(
    {
      ...DEFAULT_PAPER_CONFIG,
      startingBalance: 100000,
      enableSlippage: false,
      enablePartialFills: false,
      executionDelay: 0,
      rejectProbability: 0,
    },
    mockWs as any,
    mockAggregator as any
  );
}

// ============================================================================
// Copy Trading Engine Tests
// ============================================================================

describe('CopyTradingEngine', () => {
  let engine: CopyTradingEngine;
  let mockWs: MockWebSocketClient;
  let mockAggregator: MockAggregator;

  beforeEach(() => {
    engine = new CopyTradingEngine();
    mockWs = new MockWebSocketClient();
    mockAggregator = new MockAggregator();
  });

  afterEach(() => {
    engine.destroy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Leader Management Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Leader Management', () => {
    it('should register a new leader', () => {
      const paperEngine = createPaperEngine(mockWs, mockAggregator);

      const leader = engine.registerLeader(
        'leader-1',
        'Test Leader',
        'A test trading strategy',
        paperEngine
      );

      expect(leader.id).toBe('leader-1');
      expect(leader.name).toBe('Test Leader');
      expect(leader.verified).toBe(false);
      expect(leader.public).toBe(true);
    });

    it('should emit event on leader registration', () => {
      let eventReceived = false;
      engine.on('leader_registered', (data) => {
        eventReceived = true;
        expect(data.id).toBe('leader-2');
      });

      const paperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('leader-2', 'Leader 2', 'Description', paperEngine);

      expect(eventReceived).toBe(true);
    });

    it('should get leader by ID', () => {
      const paperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('leader-3', 'Leader 3', 'Desc', paperEngine);

      const leader = engine.getLeader('leader-3');
      expect(leader).toBeDefined();
      expect(leader?.name).toBe('Leader 3');
    });

    it('should return undefined for non-existent leader', () => {
      const leader = engine.getLeader('non-existent');
      expect(leader).toBeUndefined();
    });

    it('should list all leaders', () => {
      const pe1 = createPaperEngine(mockWs, mockAggregator);
      const pe2 = createPaperEngine(mockWs, mockAggregator);

      engine.registerLeader('l1', 'Leader 1', 'Desc', pe1);
      engine.registerLeader('l2', 'Leader 2', 'Desc', pe2);

      const leaders = engine.getLeaders();
      expect(leaders).toHaveLength(2);
    });

    it('should list only public leaders', () => {
      const pe1 = createPaperEngine(mockWs, mockAggregator);
      const pe2 = createPaperEngine(mockWs, mockAggregator);

      const leader1 = engine.registerLeader('l1', 'Public Leader', 'Desc', pe1);
      const leader2 = engine.registerLeader('l2', 'Private Leader', 'Desc', pe2);
      leader2.public = false;

      const publicLeaders = engine.getPublicLeaders();
      expect(publicLeaders).toHaveLength(1);
      expect(publicLeaders[0].name).toBe('Public Leader');
    });

    it('should verify a leader', () => {
      const paperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('verify-test', 'Leader', 'Desc', paperEngine);

      expect(engine.getLeader('verify-test')?.verified).toBe(false);

      const result = engine.verifyLeader('verify-test');
      expect(result).toBe(true);
      expect(engine.getLeader('verify-test')?.verified).toBe(true);
    });

    it('should return false when verifying non-existent leader', () => {
      const result = engine.verifyLeader('non-existent');
      expect(result).toBe(false);
    });

    it('should unregister a leader', () => {
      const paperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('to-remove', 'Leader', 'Desc', paperEngine);

      expect(engine.getLeaders()).toHaveLength(1);

      const result = engine.unregisterLeader('to-remove');
      expect(result).toBe(true);
      expect(engine.getLeaders()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent leader', () => {
      const result = engine.unregisterLeader('non-existent');
      expect(result).toBe(false);
    });

    it('should apply custom leader settings', () => {
      const paperEngine = createPaperEngine(mockWs, mockAggregator);

      const leader = engine.registerLeader(
        'custom-settings',
        'Custom Leader',
        'Desc',
        paperEngine,
        {
          minFollowAmount: 50000,
          maxFollowers: 50,
          revenueSharePercent: 20,
        }
      );

      expect(leader.settings.minFollowAmount).toBe(50000);
      expect(leader.settings.maxFollowers).toBe(50);
      expect(leader.settings.revenueSharePercent).toBe(20);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Follower Management Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Follower Management', () => {
    let leaderPaperEngine: PaperTradingEngine;

    beforeEach(() => {
      leaderPaperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('leader', 'Test Leader', 'Desc', leaderPaperEngine);
    });

    it('should allow follower to follow a leader', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);

      const follower = engine.followLeader(
        'follower-1',
        'Test Follower',
        'leader',
        followerPaperEngine
      );

      expect(follower.id).toBe('follower-1');
      expect(follower.leaderId).toBe('leader');
      expect(follower.active).toBe(true);
    });

    it('should emit event on follow', () => {
      let eventReceived = false;
      engine.on('follower_added', (data) => {
        eventReceived = true;
        expect(data.followerId).toBe('follower-2');
        expect(data.leaderId).toBe('leader');
      });

      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.followLeader('follower-2', 'Follower', 'leader', followerPaperEngine);

      expect(eventReceived).toBe(true);
    });

    it('should throw when following non-existent leader', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);

      expect(() => {
        engine.followLeader('f1', 'Follower', 'non-existent', followerPaperEngine);
      }).toThrow('Leader non-existent not found');
    });

    it('should throw when equity is below minimum', () => {
      // Create leader with high minimum
      const leader = engine.getLeader('leader');
      leader!.settings.minFollowAmount = 500000; // $5000 min

      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);
      // Paper engine starts with $1000 = 100000 cents

      expect(() => {
        engine.followLeader('f1', 'Follower', 'leader', followerPaperEngine);
      }).toThrow('Minimum equity');
    });

    it('should throw when max followers reached', () => {
      const leader = engine.getLeader('leader');
      leader!.settings.maxFollowers = 1;

      const fe1 = createPaperEngine(mockWs, mockAggregator);
      const fe2 = createPaperEngine(mockWs, mockAggregator);

      engine.followLeader('f1', 'Follower 1', 'leader', fe1);

      expect(() => {
        engine.followLeader('f2', 'Follower 2', 'leader', fe2);
      }).toThrow('max followers');
    });

    it('should increment leader follower count', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);

      expect(engine.getLeader('leader')?.stats.followers).toBe(0);

      engine.followLeader('f1', 'Follower', 'leader', followerPaperEngine);

      expect(engine.getLeader('leader')?.stats.followers).toBe(1);
    });

    it('should unfollow a leader', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.followLeader('f1', 'Follower', 'leader', followerPaperEngine);

      expect(engine.getLeader('leader')?.stats.followers).toBe(1);

      const result = engine.unfollowLeader('f1');
      expect(result).toBe(true);
      expect(engine.getLeader('leader')?.stats.followers).toBe(0);
    });

    it('should pause following', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.followLeader('f1', 'Follower', 'leader', followerPaperEngine);

      const follower = engine.getFollower('f1');
      expect(follower?.active).toBe(true);

      engine.pauseFollowing('f1');
      expect(engine.getFollower('f1')?.active).toBe(false);
    });

    it('should resume following', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);
      engine.followLeader('f1', 'Follower', 'leader', followerPaperEngine);
      engine.pauseFollowing('f1');

      expect(engine.getFollower('f1')?.active).toBe(false);

      engine.resumeFollowing('f1');
      expect(engine.getFollower('f1')?.active).toBe(true);
    });

    it('should get followers for a leader', () => {
      const fe1 = createPaperEngine(mockWs, mockAggregator);
      const fe2 = createPaperEngine(mockWs, mockAggregator);

      engine.followLeader('f1', 'Follower 1', 'leader', fe1);
      engine.followLeader('f2', 'Follower 2', 'leader', fe2);

      const followers = engine.getFollowersForLeader('leader');
      expect(followers).toHaveLength(2);
    });

    it('should apply custom follower settings', () => {
      const followerPaperEngine = createPaperEngine(mockWs, mockAggregator);

      const follower = engine.followLeader(
        'custom-follower',
        'Custom Follower',
        'leader',
        followerPaperEngine,
        {
          copyRatio: 0.25,
          maxCopySize: 20,
          maxDailyLoss: 2000,
        }
      );

      expect(follower.settings.copyRatio).toBe(0.25);
      expect(follower.settings.maxCopySize).toBe(20);
      expect(follower.settings.maxDailyLoss).toBe(2000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Leaderboard Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Leaderboard', () => {
    it('should return empty leaderboard initially', () => {
      const leaderboard = engine.getLeaderboard();
      expect(leaderboard).toHaveLength(0);
    });

    it('should rank leaders by performance', async () => {
      const pe1 = createPaperEngine(mockWs, mockAggregator);
      const pe2 = createPaperEngine(mockWs, mockAggregator);
      const pe3 = createPaperEngine(mockWs, mockAggregator);

      engine.registerLeader('l1', 'Leader 1', 'Desc', pe1);
      engine.registerLeader('l2', 'Leader 2', 'Desc', pe2);
      engine.registerLeader('l3', 'Leader 3', 'Desc', pe3);

      // Wait for update loop
      await new Promise(resolve => setTimeout(resolve, 100));

      const leaderboard = engine.getLeaderboard();
      expect(leaderboard).toHaveLength(3);

      // All should have ranks
      leaderboard.forEach((entry, index) => {
        expect(entry.rank).toBe(index + 1);
      });
    });

    it('should only include public leaders in leaderboard', async () => {
      const pe1 = createPaperEngine(mockWs, mockAggregator);
      const pe2 = createPaperEngine(mockWs, mockAggregator);

      engine.registerLeader('public', 'Public', 'Desc', pe1);
      const private_ = engine.registerLeader('private', 'Private', 'Desc', pe2);
      private_.public = false;

      // updateLeaderboard is called during registration, so we need to trigger it again
      // by unregistering and re-registering the public leader
      engine.unregisterLeader('public');
      engine.registerLeader('public', 'Public', 'Desc', pe1);

      const leaderboard = engine.getLeaderboard();
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].name).toBe('Public');
    });

    it('should emit leaderboard updated event', () => {
      let eventCount = 0;
      engine.on('leaderboard_updated', () => {
        eventCount++;
      });

      const pe = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('l1', 'Leader', 'Desc', pe);

      // Event is emitted synchronously during registerLeader
      expect(eventCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Revenue Sharing Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Revenue Sharing', () => {
    it('should calculate zero revenue share with no profit', () => {
      const leaderPe = createPaperEngine(mockWs, mockAggregator);
      const followerPe = createPaperEngine(mockWs, mockAggregator);

      engine.registerLeader('leader', 'Leader', 'Desc', leaderPe, {
        revenueSharePercent: 10,
      });
      engine.followLeader('follower', 'Follower', 'leader', followerPe);

      const result = engine.calculateRevenueShare('follower');

      expect(result.profit).toBe(0);
      expect(result.share).toBe(0);
      expect(result.net).toBe(0);
    });

    it('should return zeros for non-existent follower', () => {
      const result = engine.calculateRevenueShare('non-existent');

      expect(result.profit).toBe(0);
      expect(result.share).toBe(0);
      expect(result.net).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Copy Events Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Copy Events', () => {
    it('should return empty events initially', () => {
      const events = engine.getCopyEvents();
      expect(events).toHaveLength(0);
    });

    it('should filter events by status', () => {
      // This would require triggering actual copy events
      // For now, just test the filter function exists
      const events = engine.getCopyEvents({ status: 'copied' });
      expect(events).toHaveLength(0);
    });

    it('should filter events by leader ID', () => {
      const events = engine.getCopyEvents({ leaderId: 'leader-1' });
      expect(events).toHaveLength(0);
    });

    it('should filter events by follower ID', () => {
      const events = engine.getCopyEvents({ followerId: 'follower-1' });
      expect(events).toHaveLength(0);
    });

    it('should limit number of events returned', () => {
      const events = engine.getCopyEvents({ limit: 10 });
      expect(events.length).toBeLessThanOrEqual(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle orphaned followers when leader unregisters', () => {
      const leaderPe = createPaperEngine(mockWs, mockAggregator);
      const followerPe = createPaperEngine(mockWs, mockAggregator);

      engine.registerLeader('orphan-leader', 'Leader', 'Desc', leaderPe);
      engine.followLeader('orphan-follower', 'Follower', 'orphan-leader', followerPe);

      let orphanedEvent = false;
      engine.on('follower_orphaned', (data) => {
        orphanedEvent = true;
        expect(data.followerId).toBe('orphan-follower');
      });

      engine.unregisterLeader('orphan-leader');

      expect(orphanedEvent).toBe(true);
      expect(engine.getFollower('orphan-follower')?.active).toBe(false);
    });

    it('should handle multiple followers for same leader', () => {
      const leaderPe = createPaperEngine(mockWs, mockAggregator);
      engine.registerLeader('multi-leader', 'Leader', 'Desc', leaderPe, {
        maxFollowers: 10,
      });

      for (let i = 0; i < 5; i++) {
        const followerPe = createPaperEngine(mockWs, mockAggregator);
        engine.followLeader(`follower-${i}`, `Follower ${i}`, 'multi-leader', followerPe);
      }

      const followers = engine.getFollowersForLeader('multi-leader');
      expect(followers).toHaveLength(5);
      expect(engine.getLeader('multi-leader')?.stats.followers).toBe(5);
    });

    it('should handle pause/resume idempotently', () => {
      const leaderPe = createPaperEngine(mockWs, mockAggregator);
      const followerPe = createPaperEngine(mockWs, mockAggregator);

      engine.registerLeader('leader', 'Leader', 'Desc', leaderPe);
      engine.followLeader('follower', 'Follower', 'leader', followerPe);

      // Pause multiple times
      engine.pauseFollowing('follower');
      engine.pauseFollowing('follower');
      expect(engine.getFollower('follower')?.active).toBe(false);

      // Resume multiple times
      engine.resumeFollowing('follower');
      engine.resumeFollowing('follower');
      expect(engine.getFollower('follower')?.active).toBe(true);
    });
  });
});
