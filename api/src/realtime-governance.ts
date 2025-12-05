#!/usr/bin/env bun
/**
 * Real-Time Governance Event Streaming
 *
 * SSE-based event streaming for live updates on:
 * - Debate events (arguments, rebuttals, consensus shifts)
 * - Vote events (cast, delegation changes, quorum updates)
 * - Market events (price changes, trades, resolutions)
 * - Agent events (DNA mutations, dream insights, archetype activations)
 */

import { EventEmitter } from 'events';

// ============================================================================
// Event Types
// ============================================================================

export type GovernanceEventType =
  // Debate Events
  | 'debate.started'
  | 'debate.argument_added'
  | 'debate.rebuttal'
  | 'debate.consensus_shift'
  | 'debate.concluded'
  // Vote Events
  | 'vote.cast'
  | 'vote.delegation_changed'
  | 'vote.quorum_update'
  | 'vote.proposal_boosted'
  | 'vote.proposal_contested'
  | 'vote.resolved'
  // Market Events
  | 'market.trade'
  | 'market.price_update'
  | 'market.liquidity_change'
  | 'market.resolved'
  | 'market.payout'
  // Agent Events
  | 'agent.prediction'
  | 'agent.mutation'
  | 'agent.crossover'
  | 'agent.dream_insight'
  | 'agent.archetype_activated'
  | 'agent.calibration_update'
  // System Events
  | 'system.heartbeat'
  | 'system.error'
  | 'system.connected'
  | 'system.disconnected';

export interface GovernanceEvent {
  id: string;
  type: GovernanceEventType;
  timestamp: number;
  payload: Record<string, unknown>;
  source: string;
  correlationId?: string; // For grouping related events
}

export interface EventSubscription {
  id: string;
  clientId: string;
  filters: EventFilter[];
  createdAt: number;
  lastEventAt?: number;
}

export interface EventFilter {
  types?: GovernanceEventType[];
  sources?: string[];
  proposalIds?: string[];
  agentIds?: string[];
  minPriority?: number;
}

// ============================================================================
// Event Bus
// ============================================================================

export class GovernanceEventBus extends EventEmitter {
  private events: GovernanceEvent[] = [];
  private subscriptions: Map<string, EventSubscription> = new Map();
  private maxEvents: number = 10000;
  private eventCounter: number = 0;

  constructor() {
    super();
    this.setMaxListeners(1000); // Support many subscribers

    // Heartbeat every 30 seconds
    setInterval(() => {
      this.emit('heartbeat');
      this.publish({
        type: 'system.heartbeat',
        payload: {
          timestamp: Date.now(),
          eventCount: this.events.length,
          subscriptionCount: this.subscriptions.size,
        },
        source: 'system',
      });
    }, 30000);
  }

  /**
   * Publish an event to the bus
   */
  publish(event: Omit<GovernanceEvent, 'id' | 'timestamp'>): GovernanceEvent {
    const fullEvent: GovernanceEvent = {
      id: `evt_${Date.now()}_${++this.eventCounter}`,
      timestamp: Date.now(),
      ...event,
    };

    this.events.push(fullEvent);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Emit to all listeners
    this.emit('event', fullEvent);
    this.emit(event.type, fullEvent);

    // Notify subscribers
    for (const [, sub] of this.subscriptions) {
      if (this.matchesFilters(fullEvent, sub.filters)) {
        this.emit(`subscription:${sub.id}`, fullEvent);
        sub.lastEventAt = Date.now();
      }
    }

    return fullEvent;
  }

  /**
   * Subscribe to events with filters
   */
  subscribe(clientId: string, filters: EventFilter[] = []): EventSubscription {
    const subscription: EventSubscription = {
      id: `sub_${clientId}_${Date.now()}`,
      clientId,
      filters,
      createdAt: Date.now(),
    };

    this.subscriptions.set(subscription.id, subscription);

    this.publish({
      type: 'system.connected',
      payload: { subscriptionId: subscription.id, clientId },
      source: 'system',
    });

    return subscription;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    this.subscriptions.delete(subscriptionId);
    this.removeAllListeners(`subscription:${subscriptionId}`);

    this.publish({
      type: 'system.disconnected',
      payload: { subscriptionId, clientId: sub.clientId },
      source: 'system',
    });

    return true;
  }

  /**
   * Update subscription filters
   */
  updateFilters(subscriptionId: string, filters: EventFilter[]): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    sub.filters = filters;
    return true;
  }

  private matchesFilters(event: GovernanceEvent, filters: EventFilter[]): boolean {
    if (filters.length === 0) return true;

    return filters.some(filter => {
      if (filter.types && !filter.types.includes(event.type)) return false;
      if (filter.sources && !filter.sources.includes(event.source)) return false;
      if (filter.proposalIds) {
        const proposalId = event.payload.proposalId as string | undefined;
        if (!proposalId || !filter.proposalIds.includes(proposalId)) return false;
      }
      if (filter.agentIds) {
        const agentId = event.payload.agentId as string | undefined;
        if (!agentId || !filter.agentIds.includes(agentId)) return false;
      }
      return true;
    });
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 100, filters?: EventFilter[]): GovernanceEvent[] {
    let events = this.events.slice(-limit);
    if (filters && filters.length > 0) {
      events = events.filter(e => this.matchesFilters(e, filters));
    }
    return events;
  }

  /**
   * Get events since timestamp
   */
  getEventsSince(timestamp: number, filters?: EventFilter[]): GovernanceEvent[] {
    let events = this.events.filter(e => e.timestamp > timestamp);
    if (filters && filters.length > 0) {
      events = events.filter(e => this.matchesFilters(e, filters));
    }
    return events;
  }

  /**
   * Get subscription info
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get stats
   */
  getStats(): {
    totalEvents: number;
    activeSubscriptions: number;
    eventsByType: Record<string, number>;
    eventsPerMinute: number;
  } {
    const eventsByType: Record<string, number> = {};
    const oneMinuteAgo = Date.now() - 60000;
    let recentCount = 0;

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      if (event.timestamp > oneMinuteAgo) recentCount++;
    }

    return {
      totalEvents: this.events.length,
      activeSubscriptions: this.subscriptions.size,
      eventsByType,
      eventsPerMinute: recentCount,
    };
  }
}

// ============================================================================
// SSE Transport
// ============================================================================

export interface SSEClient {
  id: string;
  subscriptionId: string;
  response: {
    write: (data: string) => void;
    end: () => void;
  };
  connected: boolean;
  connectedAt: number;
  lastPingAt: number;
}

export class SSETransport extends EventEmitter {
  private eventBus: GovernanceEventBus;
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: ReturnType<typeof setInterval>;

  constructor(eventBus: GovernanceEventBus) {
    super();
    this.eventBus = eventBus;

    // Ping clients every 15 seconds
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 15000);
  }

  /**
   * Connect a new SSE client
   */
  connect(
    clientId: string,
    response: SSEClient['response'],
    filters?: EventFilter[]
  ): SSEClient {
    // Subscribe to event bus
    const subscription = this.eventBus.subscribe(clientId, filters);

    const client: SSEClient = {
      id: clientId,
      subscriptionId: subscription.id,
      response,
      connected: true,
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // Send initial connection event
    this.sendEvent(client, {
      id: 'init',
      type: 'system.connected',
      timestamp: Date.now(),
      payload: {
        clientId,
        subscriptionId: subscription.id,
        serverTime: Date.now(),
      },
      source: 'system',
    });

    // Listen for events on this subscription
    this.eventBus.on(`subscription:${subscription.id}`, (event: GovernanceEvent) => {
      if (client.connected) {
        this.sendEvent(client, event);
      }
    });

    this.emit('client_connected', { clientId, subscriptionId: subscription.id });
    return client;
  }

  /**
   * Disconnect a client
   */
  disconnect(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.connected = false;
    this.eventBus.unsubscribe(client.subscriptionId);
    this.clients.delete(clientId);

    try {
      client.response.end();
    } catch {
      // Client may already be disconnected
    }

    this.emit('client_disconnected', { clientId });
    return true;
  }

  /**
   * Send event to client
   */
  private sendEvent(client: SSEClient, event: GovernanceEvent): void {
    if (!client.connected) return;

    try {
      const data = [
        `id: ${event.id}`,
        `event: ${event.type}`,
        `data: ${JSON.stringify(event)}`,
        '',
        '',
      ].join('\n');

      client.response.write(data);
    } catch (error) {
      // Client disconnected
      this.disconnect(client.id);
    }
  }

  /**
   * Send ping to keep connections alive
   */
  private pingClients(): void {
    const now = Date.now();
    for (const [clientId, client] of this.clients) {
      if (!client.connected) {
        this.clients.delete(clientId);
        continue;
      }

      try {
        client.response.write(`: ping ${now}\n\n`);
        client.lastPingAt = now;
      } catch {
        this.disconnect(clientId);
      }
    }
  }

  /**
   * Broadcast to all clients
   */
  broadcast(event: Omit<GovernanceEvent, 'id' | 'timestamp'>): void {
    this.eventBus.publish(event);
  }

  /**
   * Get connected clients
   */
  getClients(): SSEClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Cleanup
   */
  stop(): void {
    clearInterval(this.pingInterval);
    for (const clientId of this.clients.keys()) {
      this.disconnect(clientId);
    }
  }
}

// ============================================================================
// Event Aggregator (for dashboards)
// ============================================================================

export interface AggregatedMetrics {
  timeWindow: number;
  debates: {
    active: number;
    concluded: number;
    avgDuration: number;
  };
  votes: {
    total: number;
    yes: number;
    no: number;
    turnout: number;
  };
  markets: {
    volume: number;
    trades: number;
    avgPriceChange: number;
  };
  agents: {
    activePredictions: number;
    mutations: number;
    insights: number;
  };
}

export class EventAggregator {
  private eventBus: GovernanceEventBus;
  private metrics: Map<string, AggregatedMetrics> = new Map();
  private aggregationWindows = [60000, 300000, 3600000]; // 1min, 5min, 1hour

  constructor(eventBus: GovernanceEventBus) {
    this.eventBus = eventBus;

    // Initialize metrics for each window
    for (const window of this.aggregationWindows) {
      this.metrics.set(String(window), this.createEmptyMetrics(window));
    }

    // Update metrics on events
    this.eventBus.on('event', (event: GovernanceEvent) => {
      this.updateMetrics(event);
    });

    // Refresh metrics periodically
    setInterval(() => this.refreshMetrics(), 10000);
  }

  private createEmptyMetrics(timeWindow: number): AggregatedMetrics {
    return {
      timeWindow,
      debates: { active: 0, concluded: 0, avgDuration: 0 },
      votes: { total: 0, yes: 0, no: 0, turnout: 0 },
      markets: { volume: 0, trades: 0, avgPriceChange: 0 },
      agents: { activePredictions: 0, mutations: 0, insights: 0 },
    };
  }

  private updateMetrics(event: GovernanceEvent): void {
    for (const [key, metrics] of this.metrics) {
      this.updateMetricsForEvent(metrics, event);
    }
  }

  private updateMetricsForEvent(metrics: AggregatedMetrics, event: GovernanceEvent): void {
    switch (event.type) {
      case 'debate.started':
        metrics.debates.active++;
        break;
      case 'debate.concluded':
        metrics.debates.active = Math.max(0, metrics.debates.active - 1);
        metrics.debates.concluded++;
        break;
      case 'vote.cast':
        metrics.votes.total++;
        if (event.payload.vote === 'yes') metrics.votes.yes++;
        else metrics.votes.no++;
        break;
      case 'market.trade':
        metrics.markets.trades++;
        metrics.markets.volume += (event.payload.amount as number) || 0;
        break;
      case 'agent.prediction':
        metrics.agents.activePredictions++;
        break;
      case 'agent.mutation':
        metrics.agents.mutations++;
        break;
      case 'agent.dream_insight':
        metrics.agents.insights++;
        break;
    }
  }

  private refreshMetrics(): void {
    const now = Date.now();

    for (const [key, metrics] of this.metrics) {
      const window = metrics.timeWindow;
      const cutoff = now - window;

      // Get events in window
      const events = this.eventBus.getEventsSince(cutoff);

      // Reset and recalculate
      const fresh = this.createEmptyMetrics(window);
      for (const event of events) {
        this.updateMetricsForEvent(fresh, event);
      }

      this.metrics.set(key, fresh);
    }
  }

  /**
   * Get metrics for a time window
   */
  getMetrics(windowMs: number = 60000): AggregatedMetrics {
    return this.metrics.get(String(windowMs)) || this.createEmptyMetrics(windowMs);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, AggregatedMetrics> {
    const result: Record<string, AggregatedMetrics> = {};
    for (const [key, metrics] of this.metrics) {
      result[key] = metrics;
    }
    return result;
  }
}

// ============================================================================
// Event Publishers (Helpers)
// ============================================================================

export function createDebatePublisher(eventBus: GovernanceEventBus) {
  return {
    started(proposalId: string, agents: string[]) {
      eventBus.publish({
        type: 'debate.started',
        payload: { proposalId, agents, participantCount: agents.length },
        source: 'debate',
        correlationId: proposalId,
      });
    },

    argumentAdded(proposalId: string, agentId: string, position: string, confidence: number) {
      eventBus.publish({
        type: 'debate.argument_added',
        payload: { proposalId, agentId, position, confidence },
        source: 'debate',
        correlationId: proposalId,
      });
    },

    rebuttal(proposalId: string, rebuttingAgentId: string, targetAgentId: string) {
      eventBus.publish({
        type: 'debate.rebuttal',
        payload: { proposalId, rebuttingAgentId, targetAgentId },
        source: 'debate',
        correlationId: proposalId,
      });
    },

    consensusShift(proposalId: string, oldConsensus: string, newConsensus: string, margin: number) {
      eventBus.publish({
        type: 'debate.consensus_shift',
        payload: { proposalId, oldConsensus, newConsensus, margin },
        source: 'debate',
        correlationId: proposalId,
      });
    },

    concluded(proposalId: string, outcome: string, duration: number) {
      eventBus.publish({
        type: 'debate.concluded',
        payload: { proposalId, outcome, duration },
        source: 'debate',
        correlationId: proposalId,
      });
    },
  };
}

export function createVotePublisher(eventBus: GovernanceEventBus) {
  return {
    cast(proposalId: string, voter: string, vote: string, weight: number) {
      eventBus.publish({
        type: 'vote.cast',
        payload: { proposalId, voter, vote, weight },
        source: 'voting',
        correlationId: proposalId,
      });
    },

    delegationChanged(fromAgent: string, toAgent: string, weight: number) {
      eventBus.publish({
        type: 'vote.delegation_changed',
        payload: { fromAgent, toAgent, weight },
        source: 'voting',
      });
    },

    quorumUpdate(proposalId: string, current: number, required: number) {
      eventBus.publish({
        type: 'vote.quorum_update',
        payload: { proposalId, current, required, progress: current / required },
        source: 'voting',
        correlationId: proposalId,
      });
    },

    resolved(proposalId: string, passed: boolean, yesVotes: number, noVotes: number) {
      eventBus.publish({
        type: 'vote.resolved',
        payload: { proposalId, passed, yesVotes, noVotes },
        source: 'voting',
        correlationId: proposalId,
      });
    },
  };
}

export function createMarketPublisher(eventBus: GovernanceEventBus) {
  return {
    trade(marketId: string, trader: string, side: string, amount: number, price: number) {
      eventBus.publish({
        type: 'market.trade',
        payload: { marketId, trader, side, amount, price },
        source: 'market',
        correlationId: marketId,
      });
    },

    priceUpdate(marketId: string, oldPrice: number, newPrice: number, side: string) {
      eventBus.publish({
        type: 'market.price_update',
        payload: { marketId, oldPrice, newPrice, side, change: newPrice - oldPrice },
        source: 'market',
        correlationId: marketId,
      });
    },

    resolved(marketId: string, outcome: string, totalPayout: number) {
      eventBus.publish({
        type: 'market.resolved',
        payload: { marketId, outcome, totalPayout },
        source: 'market',
        correlationId: marketId,
      });
    },
  };
}

export function createAgentPublisher(eventBus: GovernanceEventBus) {
  return {
    prediction(agentId: string, proposalId: string, prediction: string, confidence: number) {
      eventBus.publish({
        type: 'agent.prediction',
        payload: { agentId, proposalId, prediction, confidence },
        source: 'agent',
      });
    },

    mutation(agentId: string, gene: string, from: string, to: string) {
      eventBus.publish({
        type: 'agent.mutation',
        payload: { agentId, gene, from, to },
        source: 'agent',
      });
    },

    crossover(parent1: string, parent2: string, child: string) {
      eventBus.publish({
        type: 'agent.crossover',
        payload: { parent1, parent2, child },
        source: 'agent',
      });
    },

    dreamInsight(agentId: string, insight: string, confidence: number) {
      eventBus.publish({
        type: 'agent.dream_insight',
        payload: { agentId, insight, confidence },
        source: 'agent',
      });
    },

    archetypeActivated(context: string[], archetype: string) {
      eventBus.publish({
        type: 'agent.archetype_activated',
        payload: { context, archetype },
        source: 'agent',
      });
    },

    calibrationUpdate(agentId: string, oldScore: number, newScore: number) {
      eventBus.publish({
        type: 'agent.calibration_update',
        payload: { agentId, oldScore, newScore, change: newScore - oldScore },
        source: 'agent',
      });
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  GovernanceEventBus,
  SSETransport,
  EventAggregator,
  createDebatePublisher,
  createVotePublisher,
  createMarketPublisher,
  createAgentPublisher,
};
