/**
 * Mining Events System Tests
 */

// Jest test - no explicit imports needed (Jest supports 'test' as alias for 'it')
import {
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
  MiningEvent,
} from '../src/mcp-mining-events';

console.log('Running Mining Events Tests...');
console.log('============================================================');

describe('Mining Event Bus', () => {
  test('should subscribe and receive events', async () => {
    const receivedEvents: MiningEvent[] = [];

    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
    });

    // Emit a test event
    miningEvents.emit('challenge_created', {
      challengeId: 'test_123',
      serverId: 'server_1',
    });

    // Wait a tick for event propagation
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(receivedEvents.length).toBeGreaterThan(0);
    const challengeEvent = receivedEvents.find(e => e.type === 'challenge_created');
    expect(challengeEvent).toBeDefined();
    expect(challengeEvent?.data.challengeId).toBe('test_123');

    miningEvents.unsubscribe(subId);
  });

  test('should filter events by type', async () => {
    const receivedEvents: MiningEvent[] = [];

    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: {
        types: ['reward_minted'],
      },
    });

    // Emit events of different types
    miningEvents.emit('challenge_created', { id: 'c1' });
    miningEvents.emit('reward_minted', { amount: '1000' });
    miningEvents.emit('tokens_staked', { amount: '500' });

    await new Promise(resolve => setTimeout(resolve, 10));

    // Should only receive reward_minted
    const rewardEvents = receivedEvents.filter(e => e.type === 'reward_minted');
    const otherEvents = receivedEvents.filter(e => e.type !== 'reward_minted');

    expect(rewardEvents.length).toBeGreaterThanOrEqual(1);
    expect(otherEvents.length).toBe(0);

    miningEvents.unsubscribe(subId);
  });

  test('should filter events by serverId', async () => {
    const receivedEvents: MiningEvent[] = [];

    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: {
        serverId: 'my_server',
      },
    });

    miningEvents.emit('challenge_completed', { reward: '100' }, { serverId: 'my_server' });
    miningEvents.emit('challenge_completed', { reward: '200' }, { serverId: 'other_server' });

    await new Promise(resolve => setTimeout(resolve, 10));

    // Should only receive events for my_server
    const myServerEvents = receivedEvents.filter(e => e.metadata?.serverId === 'my_server');
    expect(myServerEvents.length).toBeGreaterThanOrEqual(1);

    miningEvents.unsubscribe(subId);
  });

  test('should unsubscribe correctly', async () => {
    const receivedEvents: MiningEvent[] = [];

    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
    });

    const countBefore = receivedEvents.length;
    miningEvents.unsubscribe(subId);

    miningEvents.emit('challenge_created', { id: 'after_unsub' });

    await new Promise(resolve => setTimeout(resolve, 10));

    // Should not receive events after unsubscribe (excluding background events)
    expect(receivedEvents.filter(e => e.data?.id === 'after_unsub').length).toBe(0);
  });

  test('should return stats', () => {
    const stats = miningEvents.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats.subscribers).toBe('number');
    expect(typeof stats.totalEvents).toBe('number');
    expect(typeof stats.recentEventsCount).toBe('number');
  });

  test('should return network snapshot', () => {
    const snapshot = miningEvents.getNetworkSnapshot();

    expect(snapshot).toBeDefined();
    expect(typeof snapshot.timestamp).toBe('number');
    expect(typeof snapshot.activeMiners).toBe('number');
    expect(typeof snapshot.completedLast5Min).toBe('number');
  });

  test('should return recent events', () => {
    const events = miningEvents.getRecentEvents(5);

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeLessThanOrEqual(5);
  });
});

describe('Event Helper Functions', () => {
  test('emitChallengeCreated should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['challenge_created'] },
    });

    emitChallengeCreated('ch_1', 'srv_1', 'index_transactions', 5, '500000000000');

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.data?.challengeId === 'ch_1');
    expect(event).toBeDefined();
    expect(event?.data.workType).toBe('index_transactions');
    expect(event?.data.difficulty).toBe(5);

    miningEvents.unsubscribe(subId);
  });

  test('emitChallengeCompleted should emit both completion and reward events', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['challenge_completed', 'reward_minted'] },
    });

    emitChallengeCompleted('ch_2', 'srv_1', '1000000000000', 85);

    await new Promise(resolve => setTimeout(resolve, 10));

    const completedEvent = receivedEvents.find(e => e.type === 'challenge_completed' && e.data?.challengeId === 'ch_2');
    const rewardEvent = receivedEvents.find(e => e.type === 'reward_minted' && e.data?.challengeId === 'ch_2');

    expect(completedEvent).toBeDefined();
    expect(rewardEvent).toBeDefined();
    expect(completedEvent?.metadata?.quality).toBe(85);

    miningEvents.unsubscribe(subId);
  });

  test('emitTokensStaked should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['tokens_staked'] },
    });

    emitTokensStaked('addr_1', '1000000000000', 5);

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.data?.address === 'addr_1');
    expect(event).toBeDefined();
    expect(event?.data.trustBoost).toBe(5);

    miningEvents.unsubscribe(subId);
  });

  test('emitPoUWCreated should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['pouw_work_created'] },
    });

    emitPoUWCreated('pouw_1', 'srv_1', 'analyze_patterns', '2000000000000');

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.data?.challengeId === 'pouw_1');
    expect(event).toBeDefined();
    expect(event?.data.workType).toBe('analyze_patterns');

    miningEvents.unsubscribe(subId);
  });

  test('emitPoUWAccepted should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['pouw_work_accepted'] },
    });

    emitPoUWAccepted('pouw_2', 'srv_1', '1500000000000', 90);

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.data?.challengeId === 'pouw_2');
    expect(event).toBeDefined();
    expect(event?.metadata?.quality).toBe(90);

    miningEvents.unsubscribe(subId);
  });

  test('emitPoUWRejected should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['pouw_work_rejected'] },
    });

    emitPoUWRejected('pouw_3', 'srv_1', 'Quality too low', 35);

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.data?.challengeId === 'pouw_3');
    expect(event).toBeDefined();
    expect(event?.data.reason).toBe('Quality too low');

    miningEvents.unsubscribe(subId);
  });

  test('emitEpochChange should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['epoch_change'] },
    });

    emitEpochChange(0, 1, '1000000000000', '500000000000');

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.type === 'epoch_change' && e.data?.newEpoch === 1);
    expect(event).toBeDefined();
    expect(event?.data.oldEpoch).toBe(0);

    miningEvents.unsubscribe(subId);
  });

  test('emitHalvingApproaching should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['halving_approaching'] },
    });

    emitHalvingApproaching(0, 500, '1000000000000');

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.type === 'halving_approaching');
    expect(event).toBeDefined();
    expect(event?.data.challengesUntil).toBe(500);

    miningEvents.unsubscribe(subId);
  });

  test('emitLeaderboardUpdate should emit correct event', async () => {
    const receivedEvents: MiningEvent[] = [];
    const subId = miningEvents.subscribe({
      send: (event) => receivedEvents.push(event),
      filters: { types: ['leaderboard_update'] },
    });

    emitLeaderboardUpdate([
      { rank: 1, serverId: 'top_miner', totalRewards: '10000000000000', challengesCompleted: 100 },
      { rank: 2, serverId: 'second', totalRewards: '8000000000000', challengesCompleted: 80 },
    ]);

    await new Promise(resolve => setTimeout(resolve, 10));

    const event = receivedEvents.find(e => e.type === 'leaderboard_update');
    expect(event).toBeDefined();
    expect(event?.data.topMiners).toHaveLength(2);
    expect(event?.data.topMiners[0].serverId).toBe('top_miner');

    miningEvents.unsubscribe(subId);
  });
});

describe('SSE Formatting', () => {
  test('formatSSE should produce valid SSE format', () => {
    const event: MiningEvent = {
      id: 'evt_123',
      type: 'reward_minted',
      timestamp: Date.now(),
      data: { amount: '1000' },
    };

    const formatted = formatSSE(event);

    expect(formatted).toContain('id: evt_123');
    expect(formatted).toContain('event: reward_minted');
    expect(formatted).toContain('data: ');
    expect(formatted).toContain('"amount":"1000"');
  });

  test('createSSEHeaders should return correct headers', () => {
    const headers = createSSEHeaders();

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toContain('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
  });
});

console.log('============================================================');
console.log('Mining Events tests complete');
