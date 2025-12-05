/**
 * MCP Webhook Subscriptions
 *
 * Event-driven notifications for blockchain activity monitoring.
 * "Notify me when wallet X receives > 100 SOL"
 *
 * Features:
 * - Subscribe to wallet activity, token transfers, program events
 * - Flexible condition filters (amount thresholds, token types, etc.)
 * - Multiple delivery methods (HTTP, WebSocket, email)
 * - Retry logic with exponential backoff
 * - Webhook signing for security
 * - Rate limiting per subscription
 * - Event batching for high-frequency events
 */

import { createHmac, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type EventType =
  | 'wallet.transaction'
  | 'wallet.sol_received'
  | 'wallet.sol_sent'
  | 'wallet.token_received'
  | 'wallet.token_sent'
  | 'wallet.nft_received'
  | 'wallet.nft_sent'
  | 'token.price_change'
  | 'token.large_transfer'
  | 'program.invocation'
  | 'investigation.anomaly'
  | 'investigation.complete';

export type DeliveryMethod = 'http' | 'websocket' | 'email' | 'slack' | 'discord' | 'telegram';

export type SubscriptionStatus = 'active' | 'paused' | 'disabled' | 'expired';

export interface WebhookCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex' | 'in' | 'not_in';
  value: any;
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  name: string;
  description?: string;

  // Event configuration
  eventTypes: EventType[];
  targets: string[];  // Wallet addresses, token mints, program IDs

  // Conditions (all must match for delivery)
  conditions: WebhookCondition[];

  // Delivery configuration
  delivery: {
    method: DeliveryMethod;
    url?: string;           // For HTTP webhooks
    channelId?: string;     // For Slack/Discord
    chatId?: string;        // For Telegram
    email?: string;         // For email
    headers?: Record<string, string>;
  };

  // Security
  secret: string;          // For signing payloads
  signatureHeader: string; // Header name for signature

  // Rate limiting
  maxEventsPerMinute: number;
  maxEventsPerHour: number;
  batchEvents: boolean;    // Batch multiple events into single delivery
  batchWindowMs: number;   // Batch window in ms

  // Status
  status: SubscriptionStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;

  // Stats
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastDeliveryAt?: number;
    lastErrorAt?: number;
    lastError?: string;
  };
}

export interface WebhookEvent {
  id: string;
  subscriptionId: string;
  type: EventType;
  timestamp: number;
  target: string;  // The address/entity that triggered the event
  data: any;       // Event-specific data
  metadata?: {
    signature?: string;      // Transaction signature
    slot?: number;          // Block slot
    blockTime?: number;     // Block timestamp
    source?: string;        // Event source
  };
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventIds: string[];
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  deliveredAt?: number;
  error?: string;
  responseCode?: number;
  responseBody?: string;
  payload: any;
}

// ============================================================================
// Event Templates
// ============================================================================

export const EVENT_TEMPLATES: Record<EventType, {
  description: string;
  defaultConditions: WebhookCondition[];
  exampleData: any;
}> = {
  'wallet.transaction': {
    description: 'Any transaction involving the wallet',
    defaultConditions: [],
    exampleData: {
      signature: '5J7H...',
      type: 'transfer',
      success: true,
      fee: 5000,
    },
  },
  'wallet.sol_received': {
    description: 'SOL received by the wallet',
    defaultConditions: [{ field: 'amount', operator: 'gt', value: 0 }],
    exampleData: {
      signature: '5J7H...',
      amount: 1.5,
      from: 'EPjFW...',
    },
  },
  'wallet.sol_sent': {
    description: 'SOL sent from the wallet',
    defaultConditions: [{ field: 'amount', operator: 'gt', value: 0 }],
    exampleData: {
      signature: '5J7H...',
      amount: 1.5,
      to: 'EPjFW...',
    },
  },
  'wallet.token_received': {
    description: 'Token received by the wallet',
    defaultConditions: [],
    exampleData: {
      signature: '5J7H...',
      token: { symbol: 'BONK', mint: 'DezXA...' },
      amount: 1000000,
      from: 'EPjFW...',
    },
  },
  'wallet.token_sent': {
    description: 'Token sent from the wallet',
    defaultConditions: [],
    exampleData: {
      signature: '5J7H...',
      token: { symbol: 'BONK', mint: 'DezXA...' },
      amount: 1000000,
      to: 'EPjFW...',
    },
  },
  'wallet.nft_received': {
    description: 'NFT received by the wallet',
    defaultConditions: [],
    exampleData: {
      signature: '5J7H...',
      nft: { name: 'DeGod #1234', collection: 'DeGods' },
      from: 'EPjFW...',
    },
  },
  'wallet.nft_sent': {
    description: 'NFT sent from the wallet',
    defaultConditions: [],
    exampleData: {
      signature: '5J7H...',
      nft: { name: 'DeGod #1234', collection: 'DeGods' },
      to: 'EPjFW...',
    },
  },
  'token.price_change': {
    description: 'Token price changed by threshold',
    defaultConditions: [{ field: 'changePercent', operator: 'gt', value: 5 }],
    exampleData: {
      token: { symbol: 'BONK', mint: 'DezXA...' },
      oldPrice: 0.00001,
      newPrice: 0.000012,
      changePercent: 20,
    },
  },
  'token.large_transfer': {
    description: 'Large token transfer detected',
    defaultConditions: [{ field: 'valueUsd', operator: 'gt', value: 100000 }],
    exampleData: {
      signature: '5J7H...',
      token: { symbol: 'BONK', mint: 'DezXA...' },
      amount: 1000000000,
      valueUsd: 150000,
      from: 'EPjFW...',
      to: 'DezXA...',
    },
  },
  'program.invocation': {
    description: 'Program invoked',
    defaultConditions: [],
    exampleData: {
      signature: '5J7H...',
      program: 'JUP6L...',
      instruction: 'swap',
      accounts: [],
    },
  },
  'investigation.anomaly': {
    description: 'Investigation found anomaly',
    defaultConditions: [],
    exampleData: {
      investigationId: 'inv_123',
      anomaly: {
        type: 'unusual_activity',
        severity: 'high',
        description: 'Large outflow detected',
      },
    },
  },
  'investigation.complete': {
    description: 'Investigation completed',
    defaultConditions: [],
    exampleData: {
      investigationId: 'inv_123',
      target: 'EPjFW...',
      riskLevel: 'medium',
      findings: 5,
      anomalies: 2,
    },
  },
};

// ============================================================================
// Webhook Manager
// ============================================================================

export class WebhookManager {
  private subscriptions = new Map<string, WebhookSubscription>();
  private subscriptionsByTarget = new Map<string, Set<string>>();
  private pendingDeliveries = new Map<string, WebhookDelivery>();
  private eventBatches = new Map<string, WebhookEvent[]>();
  private rateLimiters = new Map<string, { minute: number; hour: number; minuteReset: number; hourReset: number }>();

  private deliveryWorkerInterval?: ReturnType<typeof setInterval>;
  private batchWorkerInterval?: ReturnType<typeof setInterval>;

  constructor(private config: {
    maxRetries?: number;
    retryDelayMs?: number;
    deliveryTimeoutMs?: number;
    workerIntervalMs?: number;
  } = {}) {
    this.config = {
      maxRetries: 5,
      retryDelayMs: 1000,
      deliveryTimeoutMs: 30000,
      workerIntervalMs: 1000,
      ...config,
    };
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Create a new webhook subscription
   */
  createSubscription(params: {
    userId: string;
    name: string;
    description?: string;
    eventTypes: EventType[];
    targets: string[];
    conditions?: WebhookCondition[];
    delivery: WebhookSubscription['delivery'];
    maxEventsPerMinute?: number;
    maxEventsPerHour?: number;
    batchEvents?: boolean;
    batchWindowMs?: number;
    expiresAt?: number;
  }): WebhookSubscription {
    const id = `webhook_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(32).toString('hex');

    const subscription: WebhookSubscription = {
      id,
      userId: params.userId,
      name: params.name,
      description: params.description,
      eventTypes: params.eventTypes,
      targets: params.targets,
      conditions: params.conditions || [],
      delivery: params.delivery,
      secret,
      signatureHeader: 'X-Webhook-Signature',
      maxEventsPerMinute: params.maxEventsPerMinute || 60,
      maxEventsPerHour: params.maxEventsPerHour || 1000,
      batchEvents: params.batchEvents || false,
      batchWindowMs: params.batchWindowMs || 5000,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: params.expiresAt,
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
      },
    };

    this.subscriptions.set(id, subscription);

    // Index by target for fast lookup
    for (const target of params.targets) {
      if (!this.subscriptionsByTarget.has(target)) {
        this.subscriptionsByTarget.set(target, new Set());
      }
      this.subscriptionsByTarget.get(target)!.add(id);
    }

    return subscription;
  }

  /**
   * Update subscription
   */
  updateSubscription(
    id: string,
    updates: Partial<Pick<WebhookSubscription, 'name' | 'description' | 'eventTypes' | 'targets' | 'conditions' | 'delivery' | 'maxEventsPerMinute' | 'maxEventsPerHour' | 'batchEvents' | 'batchWindowMs' | 'status'>>
  ): WebhookSubscription | null {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return null;

    // If targets changed, update index
    if (updates.targets) {
      for (const target of subscription.targets) {
        this.subscriptionsByTarget.get(target)?.delete(id);
      }
      for (const target of updates.targets) {
        if (!this.subscriptionsByTarget.has(target)) {
          this.subscriptionsByTarget.set(target, new Set());
        }
        this.subscriptionsByTarget.get(target)!.add(id);
      }
    }

    Object.assign(subscription, updates, { updatedAt: Date.now() });
    return subscription;
  }

  /**
   * Delete subscription
   */
  deleteSubscription(id: string): boolean {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return false;

    // Remove from target index
    for (const target of subscription.targets) {
      this.subscriptionsByTarget.get(target)?.delete(id);
    }

    this.subscriptions.delete(id);
    return true;
  }

  /**
   * Get subscription by ID
   */
  getSubscription(id: string): WebhookSubscription | null {
    return this.subscriptions.get(id) || null;
  }

  /**
   * List subscriptions for a user
   */
  listSubscriptions(userId: string): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId);
  }

  /**
   * Regenerate webhook secret
   */
  regenerateSecret(id: string): string | null {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return null;

    subscription.secret = randomBytes(32).toString('hex');
    subscription.updatedAt = Date.now();
    return subscription.secret;
  }

  // ==========================================================================
  // Event Processing
  // ==========================================================================

  /**
   * Process an event and trigger matching webhooks
   */
  async processEvent(event: Omit<WebhookEvent, 'id' | 'subscriptionId'>): Promise<number> {
    const eventId = `event_${Date.now()}_${randomBytes(4).toString('hex')}`;
    let deliveriesTriggered = 0;

    // Find matching subscriptions
    const targetSubs = this.subscriptionsByTarget.get(event.target) || new Set();
    const wildcardSubs = this.subscriptionsByTarget.get('*') || new Set();
    const allMatchingSubs = new Set([...targetSubs, ...wildcardSubs]);

    for (const subId of allMatchingSubs) {
      const subscription = this.subscriptions.get(subId);
      if (!subscription) continue;

      // Check status
      if (subscription.status !== 'active') continue;

      // Check expiration
      if (subscription.expiresAt && Date.now() > subscription.expiresAt) {
        subscription.status = 'expired';
        continue;
      }

      // Check event type match
      if (!subscription.eventTypes.includes(event.type)) continue;

      // Check conditions
      if (!this.matchesConditions(event.data, subscription.conditions)) continue;

      // Check rate limits
      if (!this.checkRateLimit(subId, subscription)) continue;

      // Create full event
      const fullEvent: WebhookEvent = {
        id: eventId,
        subscriptionId: subId,
        ...event,
      };

      // Either batch or deliver immediately
      if (subscription.batchEvents) {
        this.addToBatch(subId, fullEvent);
      } else {
        await this.createDelivery(subscription, [fullEvent]);
      }

      deliveriesTriggered++;
    }

    return deliveriesTriggered;
  }

  /**
   * Check if event data matches conditions
   */
  private matchesConditions(data: any, conditions: WebhookCondition[]): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(data, condition.field);

      switch (condition.operator) {
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'neq':
          if (value === condition.value) return false;
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= condition.value) return false;
          break;
        case 'gte':
          if (typeof value !== 'number' || value < condition.value) return false;
          break;
        case 'lt':
          if (typeof value !== 'number' || value >= condition.value) return false;
          break;
        case 'lte':
          if (typeof value !== 'number' || value > condition.value) return false;
          break;
        case 'contains':
          if (typeof value !== 'string' || !value.includes(condition.value)) return false;
          break;
        case 'regex':
          if (typeof value !== 'string' || !new RegExp(condition.value).test(value)) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
        case 'not_in':
          if (!Array.isArray(condition.value) || condition.value.includes(value)) return false;
          break;
      }
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  private checkRateLimit(subId: string, subscription: WebhookSubscription): boolean {
    const now = Date.now();
    let limiter = this.rateLimiters.get(subId);

    if (!limiter || now >= limiter.minuteReset) {
      limiter = {
        minute: 0,
        hour: limiter?.hour || 0,
        minuteReset: now + 60000,
        hourReset: limiter?.hourReset || now + 3600000,
      };
    }

    if (now >= limiter.hourReset) {
      limiter.hour = 0;
      limiter.hourReset = now + 3600000;
    }

    if (limiter.minute >= subscription.maxEventsPerMinute) return false;
    if (limiter.hour >= subscription.maxEventsPerHour) return false;

    limiter.minute++;
    limiter.hour++;
    this.rateLimiters.set(subId, limiter);

    return true;
  }

  // ==========================================================================
  // Batching
  // ==========================================================================

  private addToBatch(subId: string, event: WebhookEvent): void {
    if (!this.eventBatches.has(subId)) {
      this.eventBatches.set(subId, []);

      // Schedule batch flush
      const subscription = this.subscriptions.get(subId);
      if (subscription) {
        setTimeout(() => this.flushBatch(subId), subscription.batchWindowMs);
      }
    }

    this.eventBatches.get(subId)!.push(event);
  }

  private async flushBatch(subId: string): Promise<void> {
    const events = this.eventBatches.get(subId);
    if (!events || events.length === 0) return;

    this.eventBatches.delete(subId);

    const subscription = this.subscriptions.get(subId);
    if (!subscription) return;

    await this.createDelivery(subscription, events);
  }

  // ==========================================================================
  // Delivery
  // ==========================================================================

  /**
   * Create a delivery for events
   */
  private async createDelivery(subscription: WebhookSubscription, events: WebhookEvent[]): Promise<void> {
    const delivery: WebhookDelivery = {
      id: `delivery_${Date.now()}_${randomBytes(4).toString('hex')}`,
      subscriptionId: subscription.id,
      eventIds: events.map(e => e.id),
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.maxRetries!,
      payload: {
        events,
        subscription: {
          id: subscription.id,
          name: subscription.name,
        },
        deliveredAt: Date.now(),
      },
    };

    this.pendingDeliveries.set(delivery.id, delivery);
    await this.executeDelivery(delivery, subscription);
  }

  /**
   * Execute webhook delivery
   */
  private async executeDelivery(delivery: WebhookDelivery, subscription: WebhookSubscription): Promise<void> {
    delivery.attempts++;
    delivery.lastAttemptAt = Date.now();
    delivery.status = 'retrying';

    try {
      switch (subscription.delivery.method) {
        case 'http':
          await this.deliverHttp(delivery, subscription);
          break;
        case 'slack':
          await this.deliverSlack(delivery, subscription);
          break;
        case 'discord':
          await this.deliverDiscord(delivery, subscription);
          break;
        case 'telegram':
          await this.deliverTelegram(delivery, subscription);
          break;
        default:
          throw new Error(`Unsupported delivery method: ${subscription.delivery.method}`);
      }

      delivery.status = 'delivered';
      delivery.deliveredAt = Date.now();
      subscription.stats.totalDeliveries++;
      subscription.stats.successfulDeliveries++;
      subscription.stats.lastDeliveryAt = Date.now();

      // Remove from pending
      this.pendingDeliveries.delete(delivery.id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      delivery.error = errorMessage;
      subscription.stats.lastError = errorMessage;
      subscription.stats.lastErrorAt = Date.now();

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed';
        subscription.stats.failedDeliveries++;
        this.pendingDeliveries.delete(delivery.id);

        // Disable subscription after too many failures
        const recentFailures = subscription.stats.failedDeliveries;
        if (recentFailures > 10) {
          subscription.status = 'disabled';
        }
      } else {
        // Schedule retry with exponential backoff
        const delay = this.config.retryDelayMs! * Math.pow(2, delivery.attempts - 1);
        delivery.nextRetryAt = Date.now() + delay;
      }
    }
  }

  /**
   * HTTP webhook delivery
   */
  private async deliverHttp(delivery: WebhookDelivery, subscription: WebhookSubscription): Promise<void> {
    const url = subscription.delivery.url;
    if (!url) throw new Error('No URL configured');

    const payload = JSON.stringify(delivery.payload);
    const signature = this.signPayload(payload, subscription.secret);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.deliveryTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [subscription.signatureHeader]: signature,
          ...subscription.delivery.headers,
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      delivery.responseCode = response.status;
      delivery.responseBody = await response.text().catch(() => '');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Slack delivery
   */
  private async deliverSlack(delivery: WebhookDelivery, subscription: WebhookSubscription): Promise<void> {
    const webhookUrl = subscription.delivery.url;
    if (!webhookUrl) throw new Error('No Slack webhook URL configured');

    const events = delivery.payload.events;
    const blocks = events.map((event: WebhookEvent) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${event.type}*\nTarget: \`${event.target}\`\n\`\`\`${JSON.stringify(event.data, null, 2)}\`\`\``,
      },
    }));

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Webhook: ${subscription.name}`,
        blocks,
      }),
    });
  }

  /**
   * Discord delivery
   */
  private async deliverDiscord(delivery: WebhookDelivery, subscription: WebhookSubscription): Promise<void> {
    const webhookUrl = subscription.delivery.url;
    if (!webhookUrl) throw new Error('No Discord webhook URL configured');

    const events = delivery.payload.events;
    const embeds = events.slice(0, 10).map((event: WebhookEvent) => ({
      title: event.type,
      description: `Target: ${event.target}`,
      fields: Object.entries(event.data).slice(0, 5).map(([key, value]) => ({
        name: key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        inline: true,
      })),
      timestamp: new Date(event.timestamp).toISOString(),
    }));

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `Webhook: ${subscription.name}`,
        embeds,
      }),
    });
  }

  /**
   * Telegram delivery
   */
  private async deliverTelegram(delivery: WebhookDelivery, subscription: WebhookSubscription): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = subscription.delivery.chatId;
    if (!botToken || !chatId) throw new Error('Telegram not configured');

    const events = delivery.payload.events;
    const message = events.map((event: WebhookEvent) =>
      `*${event.type}*\nTarget: \`${event.target}\`\n\`\`\`json\n${JSON.stringify(event.data, null, 2)}\n\`\`\``
    ).join('\n\n');

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Webhook: ${subscription.name}\n\n${message}`,
        parse_mode: 'Markdown',
      }),
    });
  }

  /**
   * Sign payload with HMAC-SHA256
   */
  private signPayload(payload: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature (for clients)
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expected = `sha256=${hmac.digest('hex')}`;
    return signature === expected;
  }

  // ==========================================================================
  // Background Workers
  // ==========================================================================

  /**
   * Start background workers
   */
  start(): void {
    // Retry worker
    this.deliveryWorkerInterval = setInterval(() => {
      this.processRetries();
    }, this.config.workerIntervalMs);

    // Batch flush worker
    this.batchWorkerInterval = setInterval(() => {
      this.flushAllBatches();
    }, 1000);
  }

  /**
   * Stop background workers
   */
  stop(): void {
    if (this.deliveryWorkerInterval) {
      clearInterval(this.deliveryWorkerInterval);
    }
    if (this.batchWorkerInterval) {
      clearInterval(this.batchWorkerInterval);
    }
  }

  private async processRetries(): Promise<void> {
    const now = Date.now();

    for (const [id, delivery] of this.pendingDeliveries) {
      if (delivery.status === 'retrying' && delivery.nextRetryAt && now >= delivery.nextRetryAt) {
        const subscription = this.subscriptions.get(delivery.subscriptionId);
        if (subscription) {
          await this.executeDelivery(delivery, subscription);
        } else {
          this.pendingDeliveries.delete(id);
        }
      }
    }
  }

  private async flushAllBatches(): Promise<void> {
    for (const [subId, events] of this.eventBatches) {
      const subscription = this.subscriptions.get(subId);
      if (subscription && events.length > 0) {
        const oldestEvent = events[0];
        const age = Date.now() - oldestEvent.timestamp;
        if (age >= subscription.batchWindowMs) {
          await this.flushBatch(subId);
        }
      }
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get webhook statistics
   */
  getStats(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    pendingDeliveries: number;
    eventTypes: Record<EventType, number>;
  } {
    const eventTypes: Record<string, number> = {};

    for (const sub of this.subscriptions.values()) {
      for (const type of sub.eventTypes) {
        eventTypes[type] = (eventTypes[type] || 0) + 1;
      }
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(s => s.status === 'active').length,
      pendingDeliveries: this.pendingDeliveries.size,
      eventTypes: eventTypes as Record<EventType, number>,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalWebhooks: WebhookManager | null = null;

export function getWebhooks(): WebhookManager {
  if (!globalWebhooks) {
    globalWebhooks = new WebhookManager();
    globalWebhooks.start();
  }
  return globalWebhooks;
}

export function createWebhooks(config?: ConstructorParameters<typeof WebhookManager>[0]): WebhookManager {
  globalWebhooks = new WebhookManager(config);
  globalWebhooks.start();
  return globalWebhooks;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  WebhookManager,
  getWebhooks,
  createWebhooks,
  EVENT_TEMPLATES,
};
