import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getStreamingAnomalyDetector } from '@/lib/analytics/streaming-anomaly-detector';
import { validateStreamRequest } from '@/lib/validation/stream-schemas';
import { generalRateLimiter, type RateLimitResult } from '@/lib/api/rate-limiter';
import { SSEManager } from '@/lib/api/sse-manager';
import {
  createSuccessResponse,
  createErrorResponse,
  CommonErrors,
  ErrorCodes
} from '@/lib/api/api-response';
import { generateSecureAuthToken, generateSecureClientId } from '@/lib/api-auth/crypto-utils';
import { createLogger } from '@/lib/logging/debug-logger';
import { getProtocolFromProgramId, getProtocolDisplayName } from '@/lib/constants/program-ids';

// Enhanced logger for stream API
const logger = createLogger('STREAM_API');

interface StreamClient {
  id: string;
  send: (data: any) => void;
  close: () => void;
  subscriptions: Set<string>;
  authenticated: boolean;
  connectionTime: number;
  lastActivity: number;
  isConnected: boolean;
  consecutiveFailures: number;
}

// Enhanced authentication and rate limiting with timestamp-based blocking
const CLIENT_AUTH_TOKENS = new Map<string, { token: string; clientId: string; createdAt: number }>();
const AUTH_FAILURES = new Map<string, {
  attempts: number;
  lastAttempt: number;
  blockUntil: number | null; // Use timestamp instead of boolean flag
}>();
const rateLimiter = generalRateLimiter;

// Token cleanup worker - runs every 5 minutes
// Removed unused function: stopTokenCleanupWorker

// Cleanup functions removed as they were not being called

// Start cleanup worker when module loads
// Removed unused function call: startTokenCleanupWorker();

function generateAuthToken(): string {
  return generateSecureAuthToken();
}

function validateAuthToken(clientId: string, token: string): boolean {
  const authData = CLIENT_AUTH_TOKENS.get(clientId);
  if (!authData || authData.token !== token) {
    logAuthFailure(clientId, 'Invalid auth token');
    return false;
  }
  return true;
}

function logAuthFailure(clientId: string, reason: string): void {
  const now = Date.now();
  const failures = AUTH_FAILURES.get(clientId) || {
    attempts: 0,
    lastAttempt: 0,
    blockUntil: null
  };

  failures.attempts++;
  failures.lastAttempt = now;

  // Block client after 5 failed attempts - use stricter timestamp-based blocking
  if (failures.attempts >= 5) {
    failures.blockUntil = now + (60 * 60 * 1000); // Block for 1 hour

    // Escalate repeated auth failures to console with higher severity
    logger.error(`[AUTH FAILURE - CRITICAL] Client ${clientId} BLOCKED until ${new Date(failures.blockUntil).toISOString()}: ${reason}`);
    logger.error(`[SECURITY ALERT] Client ${clientId} has made ${failures.attempts} failed authentication attempts`);

    // Could integrate with monitoring systems here:
    // - Send alert to security team
    // - Log to security monitoring dashboard
    // - Trigger automated response if needed

  } else if (failures.attempts >= 3) {
    // Warning level for 3+ attempts
    logger.warn(`[AUTH FAILURE - WARNING] Client ${clientId}: ${reason} (attempts: ${failures.attempts}/5)`);
  } else {
    // Info level for initial attempts
    logger.debug(`[AUTH FAILURE] Client ${clientId}: ${reason} (attempts: ${failures.attempts})`);
  }

  AUTH_FAILURES.set(clientId, failures);
}

function isClientBlocked(clientId: string): boolean {
  const failures = AUTH_FAILURES.get(clientId);
  if (!failures || !failures.blockUntil) return false;

  const now = Date.now();

  // Check if block period has expired
  if (now >= failures.blockUntil) {
    // Automatically unblock - reset failure count for fresh start
    failures.attempts = 0;
    failures.blockUntil = null;
    AUTH_FAILURES.set(clientId, failures);
    logger.debug(`[AUTH] Client ${clientId} automatically unblocked after timeout`);
    return false;
  }

  return true;
}

async function checkRateLimit(clientId: string, tokens: number = 1): Promise<RateLimitResult> {
  return rateLimiter.checkLimit(clientId, tokens);
}

interface BlockchainEvent {
  type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

class EventStreamManager {
  private static instance: EventStreamManager;
  private clients: Map<string, StreamClient> = new Map();
  private connection: Connection | null = null;
  private subscriptionIds: Map<string, number> = new Map();
  private subscriptionCallbacks: Map<string, (...args: any[]) => void> = new Map();
  private isMonitoring = false;
  private subscriptionAttempts: Map<string, number> = new Map(); // Track subscription attempts
  private subscriptionErrors: Map<string, { count: number; lastError: Date }> = new Map();
  private connectionHealthTimer: NodeJS.Timeout | null = null;
  private readonly CONNECTION_HEALTH_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly CLIENT_TIMEOUT = 30000; // 0.5 minutes of inactivity

  public static getInstance(): EventStreamManager {
    if (!EventStreamManager.instance) {
      EventStreamManager.instance = new EventStreamManager();
    }
    return EventStreamManager.instance;
  }

  public async addClient(client: StreamClient): Promise<void> {
    this.clients.set(client.id, client);
    logger.debug(`Client ${client.id} connected. Total clients: ${this.clients.size}`);

    if (!this.isMonitoring) {
      await this.startMonitoring();
    }

    // Start connection health monitoring if this is the first client
    if (this.clients.size === 1 && !this.connectionHealthTimer) {
      this.startConnectionHealthMonitoring();
    }
  }

  public authenticateClient(clientId: string): string {
    const token = generateAuthToken();
    CLIENT_AUTH_TOKENS.set(clientId, {
      token,
      clientId,
      createdAt: Date.now()
    });

    const client = this.clients.get(clientId);
    if (client) {
      client.authenticated = true;
      client.lastActivity = Date.now();
    }

    return token;
  }

  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.clear();
      client.isConnected = false;
      this.clients.delete(clientId);
      CLIENT_AUTH_TOKENS.delete(clientId);
      AUTH_FAILURES.delete(clientId);
      logger.debug(`Client ${clientId} disconnected. Total clients: ${this.clients.size}`);

      if (this.clients.size === 0) {
        this.stopMonitoring();
        this.stopConnectionHealthMonitoring();
      }
    }
  }

  private startConnectionHealthMonitoring(): void {
    if (this.connectionHealthTimer) return;

    this.connectionHealthTimer = setInterval(() => {
      this.checkClientConnections();
    }, this.CONNECTION_HEALTH_INTERVAL);

    logger.debug('Started connection health monitoring');
  }

  private stopConnectionHealthMonitoring(): void {
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer);
      this.connectionHealthTimer = null;
      logger.debug('Stopped connection health monitoring');
    }
  }

  private checkClientConnections(): void {
    const now = Date.now();
    const clientsToRemove: string[] = [];

    for (const [clientId, client] of this.clients) {
      // Check for inactive clients
      if (now - client.lastActivity > this.CLIENT_TIMEOUT) {
        logger.warn(`Client ${clientId} timed out due to inactivity`);
        clientsToRemove.push(clientId);
        continue;
      }

      // Check for clients with too many consecutive failures
      if (client.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        logger.warn(`Client ${clientId} removed due to consecutive failures: ${client.consecutiveFailures}`);
        clientsToRemove.push(clientId);
        continue;
      }

      // Send a ping to test connection health
      try {
        if (client.isConnected) {
          client.send(JSON.stringify({
            type: 'ping',
            timestamp: now,
            clientId: client.id
          }));
          client.lastActivity = now;
        }
      } catch (error) {
        logger.warn(`Health check failed for client ${clientId}:`, error);
        client.consecutiveFailures++;
        client.isConnected = false;
      }
    }

    // Remove unhealthy clients
    clientsToRemove.forEach(clientId => {
      this.removeClient(clientId);
    });

    if (clientsToRemove.length > 0) {
      logger.info(`Removed ${clientsToRemove.length} unhealthy clients. Active clients: ${this.clients.size}`);
    }

    // Check if we should continue monitoring based on connected clients
    if (this.isMonitoring && !this.shouldContinueMonitoring()) {
      this.stopMonitoring();
    }
  }

  private async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    // Don't start monitoring unless there are active clients that need it
    const hasActiveClients = Array.from(this.clients.values()).some(
      client => client.isConnected && client.subscriptions.size > 0
    );

    if (!hasActiveClients) {
      logger.debug('No active clients requesting monitoring, skipping startup');
      return;
    }

    try {
      this.connection = await getConnection();
      this.isMonitoring = true;

      // Only start anomaly detector if we have transaction listeners
      const hasTransactionListeners = Array.from(this.clients.values()).some(
        client => client.isConnected && (client.subscriptions.has('transaction') || client.subscriptions.has('all'))
      );

      if (hasTransactionListeners) {
        const anomalyDetector = getStreamingAnomalyDetector();
        if (!anomalyDetector.isRunning()) {
          await anomalyDetector.start();
        }
      }

      // Only subscribe to slots if we have block listeners
      const hasBlockListeners = Array.from(this.clients.values()).some(
        client => client.isConnected && (client.subscriptions.has('block') || client.subscriptions.has('all'))
      );

      if (hasBlockListeners) {
        await this.safeSubscribe('slots', () => {
          const slotCallback = (slotInfo: any) => {
            const event = {
              type: 'block' as const,
              timestamp: Date.now(),
              data: {
                slot: slotInfo.slot,
                parent: slotInfo.parent,
                root: slotInfo.root
              }
            };
            this.broadcastEvent(event);
          };

          this.subscriptionCallbacks.set('slots', slotCallback);
          return this.connection!.onSlotChange(slotCallback);
        });
      }

      // Only setup transaction monitoring if we have transaction listeners
      if (hasTransactionListeners) {
        await this.setupTransactionMonitoring();
      }

      logger.debug('Started blockchain event monitoring with selective subscriptions');
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      this.isMonitoring = false;
      this.recordSubscriptionError('monitoring', error);
    }
  }

  private shouldContinueMonitoring(): boolean {
    // Check if we have any connected clients
    const connectedClients = Array.from(this.clients.values()).filter(c => c.isConnected);

    if (connectedClients.length === 0) {
      logger.debug('No connected clients, stopping monitoring to save resources');
      return false;
    }

    // Check if any connected clients have active subscriptions
    const hasActiveSubscriptions = connectedClients.some(client =>
      client.subscriptions.size > 0
    );

    if (!hasActiveSubscriptions) {
      logger.debug('No active subscriptions from connected clients, stopping monitoring');
      return false;
    }

    return true;
  }

  // Safe subscription wrapper with idempotency and error handling
  private async safeSubscribe(
    subscriptionKey: string,
    subscribeFunction: () => number
  ): Promise<void> {
    try {
      // Check if already subscribed
      if (this.subscriptionIds.has(subscriptionKey)) {
        logger.debug(`Already subscribed to ${subscriptionKey}, skipping duplicate subscription`);
        return;
      }

      // Track subscription attempts
      const attempts = this.subscriptionAttempts.get(subscriptionKey) || 0;
      this.subscriptionAttempts.set(subscriptionKey, attempts + 1);

      // Perform subscription
      const subscriptionId = subscribeFunction();
      this.subscriptionIds.set(subscriptionKey, subscriptionId);

      logger.debug(`Successfully subscribed to ${subscriptionKey} (ID: ${subscriptionId})`);

    } catch (error) {
      logger.error(`Failed to subscribe to ${subscriptionKey}:`, error);
      this.recordSubscriptionError(subscriptionKey, error);
      throw error;
    }
  }

  // Track subscription errors for monitoring and debugging
  private recordSubscriptionError(subscriptionKey: string, error: any): void {
    const errorInfo = this.subscriptionErrors.get(subscriptionKey) || { count: 0, lastError: new Date() };
    errorInfo.count++;
    errorInfo.lastError = new Date();
    this.subscriptionErrors.set(subscriptionKey, errorInfo);

    logger.error(`Subscription error for ${subscriptionKey} (${errorInfo.count} total errors):`, error);
  }

  private async setupTransactionMonitoring(): Promise<void> {
    if (!this.connection) return;

    // Check if any connected clients actually want transaction monitoring
    const needsTransactionMonitoring = Array.from(this.clients.values()).some(
      client => client.isConnected && (client.subscriptions.has('transaction') || client.subscriptions.has('all'))
    );

    if (!needsTransactionMonitoring) {
      logger.debug('[STREAM_API] No connected clients need transaction monitoring, skipping setup');
      return;
    }

    logger.debug('[STREAM_API] Setting up minimal transaction monitoring for essential programs only');

    try {
      // Greatly reduced rate limiting - only essential transactions
      let transactionCount = 0;
      let lastResetTime = Date.now();
      const TRANSACTION_RATE_LIMIT = 10; // Only 10 transactions per second

      // Only monitor the absolute most essential programs to minimize RPC load
      const ESSENTIAL_PROGRAMS = [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token program
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter (most popular DEX)
        // Commenting out other programs to reduce load - enable selectively if needed
        // 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpools
        // '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
      ];

      logger.debug(`[STREAM_API] Monitoring only ${ESSENTIAL_PROGRAMS.length} essential programs to reduce RPC load`);

      // Create a single lightweight callback for essential program monitoring
      const logsCallback = async (logs: any, context: any) => {
        // Double-check we still have listeners to avoid wasted processing
        const hasActiveListeners = Array.from(this.clients.values()).some(
          client => client.isConnected && (client.subscriptions.has('transaction') || client.subscriptions.has('all'))
        );

        if (!hasActiveListeners) {
          return;
        }

        if (logs.signature) {
          try {
            // Strict rate limiting
            const now = Date.now();
            if (now - lastResetTime >= 1000) {
              transactionCount = 0;
              lastResetTime = now;
            }

            if (transactionCount >= TRANSACTION_RATE_LIMIT) {
              return; // Hard limit to prevent RPC spam
            }
            transactionCount++;

            // Create minimal event data without expensive RPC calls
            const event = {
              type: 'transaction' as const,
              timestamp: Date.now(),
              data: {
                signature: logs.signature,
                slot: context.slot,
                logs: logs.logs?.slice(0, 3) || [], // Limit log data
                err: logs.err,
                // Skip expensive getTransaction calls to reduce RPC load
                fee: null,
                preBalances: [],
                postBalances: [],
                accountKeys: [],
                knownProgram: 'essential-program',
                transactionType: 'monitored'
              }
            };
            this.broadcastEvent(event);
          } catch (eventError) {
            logger.error('Error processing transaction event:', eventError);
          }
        }
      };

      // Subscribe to only essential programs one by one with error handling
      let successfulSubscriptions = 0;

      for (const programId of ESSENTIAL_PROGRAMS) {
        try {
          await this.safeSubscribe(`logs-${programId}`, () => {
            return this.connection!.onLogs(
              new PublicKey(programId),
              logsCallback,
              'confirmed'
            );
          });
          successfulSubscriptions++;
          logger.debug(`[STREAM_API] Successfully subscribed to program: ${programId}`);
        } catch (error) {
          logger.warn(`[STREAM_API] Failed to subscribe to program ${programId}:`, error);
        }
      }

      if (successfulSubscriptions === 0) {
        throw new Error('No program subscriptions succeeded');
      }

      logger.debug(`[STREAM_API] Transaction monitoring setup complete: ${successfulSubscriptions}/${ESSENTIAL_PROGRAMS.length} programs subscribed`);

    } catch (error) {
      logger.error('[STREAM_API] Failed to setup transaction monitoring:', error);
      this.recordSubscriptionError('transaction_monitoring', error);
    }
  }

  private identifyKnownProgram(accountKeys: string[]): string | null {
    // Use centralized program ID mappings
    for (const accountKey of accountKeys) {
      const protocol = getProtocolFromProgramId(accountKey);
      if (protocol) {
        return getProtocolDisplayName(protocol);
      }
    }

    // Check for program names that contain known identifiers
    for (const key of accountKeys) {
      if (key.toLowerCase().includes('raydium')) return 'raydium';
      if (key.toLowerCase().includes('meteora')) return 'meteora';
      if (key.toLowerCase().includes('aldrin')) return 'aldrin';
      if (key.toLowerCase().includes('pump')) return 'pumpswap';
      if (key.toLowerCase().includes('bonk') && key.toLowerCase().includes('fun')) return 'bonkfun';
    }

    return null;
  }

  private classifyTransaction(logs: string[], accountKeys: string[]): string {
    // Check for SPL token transfer
    if (logs.some(log =>
      log.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') ||
      log.includes('Program log: Instruction: Transfer')
    )) {
      return 'spl-transfer';
    }

    // Check for custom program calls
    const SYSTEM_PROGRAMS = new Set([
      'Vote111111111111111111111111111111111111111',
      '11111111111111111111111111111111',
      'ComputeBudget111111111111111111111111111111',
      'AddressLookupTab1e1111111111111111111111111',
      'Config1111111111111111111111111111111111111',
      'Stake11111111111111111111111111111111111111',
    ]);

    if (accountKeys.some(key => !SYSTEM_PROGRAMS.has(key))) {
      return 'custom-program';
    }

    return 'other';
  }

  private stopMonitoring(): void {
    if (!this.isMonitoring || !this.connection) return;

    // Remove all subscriptions with improved error handling
    for (const [type, subscriptionId] of this.subscriptionIds) {
      try {
        if (type === 'slots') {
          this.connection.removeSlotChangeListener(subscriptionId);
        } else if (type === 'logs') {
          this.connection.removeOnLogsListener(subscriptionId);
        }
        logger.debug(`Successfully removed ${type} subscription (ID: ${subscriptionId})`);
      } catch (error) {
        logger.error(`Failed to remove ${type} subscription (ID: ${subscriptionId}):`, error);
        // Track failed removals for debugging
        this.recordSubscriptionError(`${type}_removal`, error);
      }
    }

    // Clear subscription tracking
    this.subscriptionIds.clear();
    this.subscriptionCallbacks.clear();
    this.isMonitoring = false;
    this.connection = null;

    logger.debug('Stopped blockchain event monitoring');
  }

  private broadcastEvent(event: BlockchainEvent): void {
    const eventData = JSON.stringify(event);
    let successCount = 0;
    let failureCount = 0;

    // Early exit if no clients
    if (this.clients.size === 0) {
      logger.debug('No clients connected, skipping event broadcast');
      return;
    }

    // Broadcast to WebSocket clients with improved error handling
    for (const [clientId, client] of this.clients) {
      try {
        // Skip disconnected clients
        if (!client.isConnected) {
          continue;
        }

        // Check if client is subscribed to this event type
        if (client.subscriptions.has(event.type) || client.subscriptions.has('all')) {
          client.send(eventData);
          client.lastActivity = Date.now();
          client.consecutiveFailures = 0; // Reset failure count on success
          successCount++;
        }
      } catch (error) {
        logger.error(`Failed to send event to client ${clientId}:`, error);
        failureCount++;

        // Mark client as problematic
        client.consecutiveFailures++;
        client.isConnected = false;

        // Don't immediately remove - let health check handle it
        // This prevents removing clients during temporary network issues
      }
    }

    // Also broadcast to SSE clients
    try {
      const sseManager = SSEManager.getInstance();
      sseManager.broadcastBlockchainEvent(event);
    } catch (error) {
      logger.error('Failed to broadcast to SSE clients:', error);
    }

    // Only log if there were actual clients to send to
    const totalEligibleClients = Array.from(this.clients.values())
      .filter(client => client.isConnected && (client.subscriptions.has(event.type) || client.subscriptions.has('all')))
      .length;

    if (totalEligibleClients > 0) {
      logger.debug(`Event broadcast: ${successCount}/${totalEligibleClients} successful, ${failureCount} failed`);
    }
  }

  public async subscribeToEvents(clientId: string, eventTypes: string[], authToken?: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    // Check authentication
    if (!client.authenticated || (authToken && !validateAuthToken(clientId, authToken))) {
      logger.warn(`Unauthorized subscription attempt from client ${clientId}`);
      return false;
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(clientId, 1);
    if (!rateLimitResult.allowed) {
      logger.warn(`Rate limit exceeded for client ${clientId}`);
      return false;
    }

    client.lastActivity = Date.now();
    eventTypes.forEach(type => client.subscriptions.add(type));
    return true;
  }

  public getStatus(): any {
    const anomalyDetector = getStreamingAnomalyDetector();
    const now = Date.now();

    return {
      isMonitoring: this.isMonitoring,
      clientCount: this.clients.size,
      connectedClients: Array.from(this.clients.values()).filter(c => c.isConnected).length,
      subscriptions: Array.from(this.subscriptionIds.keys()),
      subscriptionAttempts: Object.fromEntries(this.subscriptionAttempts),
      subscriptionErrors: Object.fromEntries(
        Array.from(this.subscriptionErrors.entries()).map(([key, value]) => [
          key,
          { count: value.count, lastError: value.lastError.toISOString() }
        ])
      ),
      clientHealth: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        isConnected: client.isConnected,
        authenticated: client.authenticated,
        lastActivity: new Date(client.lastActivity).toISOString(),
        consecutiveFailures: client.consecutiveFailures,
        subscriptions: Array.from(client.subscriptions),
        idleTime: now - client.lastActivity
      })),
      healthMonitoring: {
        enabled: this.connectionHealthTimer !== null,
        interval: this.CONNECTION_HEALTH_INTERVAL,
        maxFailures: this.MAX_CONSECUTIVE_FAILURES,
        clientTimeout: this.CLIENT_TIMEOUT
      },
      anomalyDetector: anomalyDetector.getStats()
    };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const clientId = searchParams.get('clientId') || generateSecureClientId();

  // Handle status request
  if (action === 'status') {
    const manager = EventStreamManager.getInstance();
    return Response.json(createSuccessResponse(manager.getStatus()));
  }

  // Check for WebSocket upgrade request - provide clear error message
  const upgrade = request.headers.get('upgrade');
  const connection = request.headers.get('connection');

  if (upgrade?.toLowerCase() === 'websocket' && connection?.toLowerCase().includes('upgrade')) {
    // WebSocket is not supported - be honest about it
    const { response, status } = createErrorResponse(
      'WEBSOCKET_NOT_SUPPORTED',
      'WebSocket connections are not supported by this endpoint',
      {
        message: 'This API uses Server-Sent Events (SSE), not WebSocket. WebSocket upgrade requests are not implemented.',
        clientId,
        alternatives: {
          sseEndpoint: '/api/sse-alerts',
          pollingEndpoint: '/api/stream (POST)',
          documentation: '/docs/api/streaming'
        },
        supportedFeatures: [
          'Server-Sent Events (SSE) for real-time streaming',
          'HTTP polling for request-response patterns',
          'Authentication and rate limiting'
        ],
        deploymentInfo: {
          environment: process.env.NODE_ENV || 'development',
          platform: process.env.VERCEL ? 'vercel' : 'custom',
          webSocketSupport: false,
          reason: 'Next.js API routes do not support WebSocket natively. Use SSE instead.'
        }
      },
      426 // Upgrade Required
    );

    return new Response(JSON.stringify(response), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Streaming-Method': 'SSE',
        'X-WebSocket-Support': 'false'
      },
    });
  }

  // Return API information for regular GET requests
  return new Response(JSON.stringify(createSuccessResponse({
    message: 'Blockchain Event Streaming API',
    clientId,
    streamingMethod: 'SSE',
    supportedMethods: ['POST for polling', 'SSE for real-time streaming'],
    supportedEvents: ['transaction', 'block', 'account_change'],
    endpoints: {
      polling: '/api/stream (POST)',
      realtime: '/api/sse-alerts',
      documentation: '/docs/api/streaming'
    },
    note: 'This API uses Server-Sent Events (SSE), not WebSocket'
  })), {
    headers: {
      'Content-Type': 'application/json',
      'X-Streaming-Method': 'SSE',
      'X-WebSocket-Support': 'false'
    },
  });
}

// For now, we'll also provide a simple polling endpoint
export async function POST(request: NextRequest) {
  try {
    // Safe JSON parsing
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      logger.error('Invalid JSON in request:', jsonError);
      const { response, status } = CommonErrors.invalidJson(jsonError);
      return Response.json(response, { status });
    }

    // Validate request structure
    const validationResult = validateStreamRequest(requestBody);
    if (!validationResult.success) {
      const { response, status } = createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        'Invalid request format',
        validationResult.errors,
        400
      );
      return Response.json(response, { status });
    }

    const { action, clientId, eventTypes, authToken } = validationResult.data;
    const manager = EventStreamManager.getInstance();

    // Validate action first
    if (!action) {
      const { response, status } = createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        'Invalid request format',
        { message: 'Action is required' },
        400
      );
      return Response.json(response, { status });
    }

    const validActions = ['authenticate', 'subscribe', 'unsubscribe', 'start_monitoring', 'status'];
    if (!validActions.includes(action)) {
      const { response, status } = createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        `Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`,
        { validActions },
        400
      );
      return Response.json(response, { status });
    }

    // Validate input
    if (!clientId && action !== 'status') {
      const { response, status } = CommonErrors.missingField('clientId');
      return Response.json(response, { status });
    }

    // Check if client is blocked (skip for authentication requests)
    if (clientId && action !== 'authenticate' && isClientBlocked(clientId)) {
      const { response, status } = CommonErrors.clientBlocked('Contact support to unblock your client');
      return Response.json(response, { status });
    }

    // Check rate limit first (skip for authentication requests)
    if (clientId && action !== 'authenticate') {
      const rateLimitResult = await checkRateLimit(clientId, 1);
      if (!rateLimitResult.allowed) {
        const { response, status } = CommonErrors.rateLimit(rateLimitResult.retryAfter, rateLimitResult.remaining);
        return Response.json(response, {
          status,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        });
      }
    }

    switch (action) {
      case 'authenticate':
        if (!clientId) {
          const { response, status } = CommonErrors.missingField('clientId');
          return Response.json(response, { status });
        }

        // Check authentication rate limit
        const authRateLimit = await checkRateLimit(clientId, 1);
        if (!authRateLimit.allowed) {
          logAuthFailure(clientId, 'Authentication rate limit exceeded');
          const { response, status } = CommonErrors.rateLimit(authRateLimit.retryAfter, authRateLimit.remaining);
          return Response.json(response, {
            status,
            headers: {
              'X-RateLimit-Remaining': authRateLimit.remaining.toString(),
              'X-RateLimit-Reset': new Date(authRateLimit.resetTime).toISOString(),
              'Retry-After': authRateLimit.retryAfter?.toString() || '60'
            }
          });
        }

        const token = manager.authenticateClient(clientId);

        // Clear auth failures on successful authentication
        if (AUTH_FAILURES.has(clientId)) {
          const failures = AUTH_FAILURES.get(clientId)!;
          failures.attempts = 0;
          failures.blockUntil = null;
          AUTH_FAILURES.set(clientId, failures);
        }

        logger.debug(`[AUTH SUCCESS] Client ${clientId} authenticated successfully`);

        return Response.json(createSuccessResponse({
          authToken: token,
          message: 'Client authenticated',
          expiresIn: 3600, // 1 hour
          rateLimits: {
            api_requests: await rateLimiter.getStats(clientId),
            websocket_connections: await rateLimiter.getStats(clientId)
          }
        }));

      case 'subscribe':
        if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
          const { response, status } = createErrorResponse(
            ErrorCodes.INVALID_REQUEST,
            'Valid event types array is required',
            {},
            400
          );
          return Response.json(response, { status });
        }

        // Validate event types
        const validEventTypes = ['transaction', 'block', 'account_change', 'all'];
        const invalidTypes = eventTypes.filter(type => !validEventTypes.includes(type));
        if (invalidTypes.length > 0) {
          const { response, status } = createErrorResponse(
            ErrorCodes.INVALID_REQUEST,
            `Invalid event types: ${invalidTypes.join(', ')}. Valid types: ${validEventTypes.join(', ')}`,
            { invalidTypes, validEventTypes },
            400
          );
          return Response.json(response, { status });
        }

        const success = await manager.subscribeToEvents(clientId!, eventTypes, authToken);
        if (success) {
          return Response.json(createSuccessResponse({ message: 'Subscribed to events' }));
        } else {
          const { response, status } = CommonErrors.unauthorized('Authentication required or failed');
          return Response.json(response, { status });
        }

      case 'unsubscribe':
        manager.removeClient(clientId!);
        return Response.json(createSuccessResponse({ message: 'Unsubscribed from events' }));

      case 'start_monitoring':
        // Create authenticated mock client for testing
        const mockClient = {
          id: clientId!,
          send: (data: any) => logger.debug('Mock send:', data),
          close: () => logger.debug('Mock close'),
          subscriptions: new Set(['transaction', 'block']),
          authenticated: false,
          connectionTime: Date.now(),
          lastActivity: Date.now(),
          isConnected: true,
          consecutiveFailures: 0
        };

        await manager.addClient(mockClient);

        // Auto-authenticate for start_monitoring to maintain compatibility
        const autoToken = manager.authenticateClient(clientId!);

        return Response.json(createSuccessResponse({
          message: 'Started monitoring',
          authToken: autoToken
        }));

      default:
        const { response, status } = createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          `Invalid action: ${action}. Valid actions: authenticate, subscribe, unsubscribe, start_monitoring`,
          { validActions: ['authenticate', 'subscribe', 'unsubscribe', 'start_monitoring'] },
          400
        );
        return Response.json(response, { status });
    }
  } catch (error) {
    logger.error('Stream API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}

// Export the EventStreamManager for use by other modules
export { EventStreamManager };
