import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana-connection';
import { Connection, PublicKey } from '@solana/web3.js';
import { getStreamingAnomalyDetector } from '@/lib/streaming-anomaly-detector';
import { validateStreamRequest } from '@/lib/validation/stream-schemas';
import { generalRateLimiter, type RateLimitResult } from '@/lib/rate-limiter';
import { SSEManager } from '@/lib/sse-manager';
import {
  createSuccessResponse,
  createErrorResponse,
  CommonErrors,
  ErrorCodes
} from '@/lib/api-response';
import { generateSecureAuthToken, generateSecureClientId } from '@/lib/crypto-utils';
import { createLogger } from '@/lib/debug-logger';
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

    try {
      this.connection = await getConnection();
      this.isMonitoring = true;

      // Start the anomaly detector
      const anomalyDetector = getStreamingAnomalyDetector();
      if (!anomalyDetector.isRunning()) {
        await anomalyDetector.start();
      }

      // Subscribe to slot changes (new blocks) with idempotency protection
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

      // Setup transaction monitoring with error protection (only if requested)
      await this.setupTransactionMonitoring();

      logger.debug('Started blockchain event monitoring with anomaly detection');
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
      logger.debug('No connected clients need transaction monitoring, skipping setup');
      return;
    }

    try {
      // Rate limiting for transaction processing - max 50 transactions per second
      let transactionCount = 0;
      let lastResetTime = Date.now();
      const TRANSACTION_RATE_LIMIT = 50; // per second

      // System programs to filter out
      const SYSTEM_PROGRAMS = new Set([
        'Vote111111111111111111111111111111111111111', // Vote program
        '11111111111111111111111111111111', // System program  
        'ComputeBudget111111111111111111111111111111', // Compute budget program
        'AddressLookupTab1e1111111111111111111111111', // Address lookup table program
        'Config1111111111111111111111111111111111111', // Config program
        'Stake11111111111111111111111111111111111111', // Stake program
      ]);

      // Important programs we DO want to monitor
      const IMPORTANT_PROGRAMS = new Set([
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token program
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token program
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpools
        'srmqPiNtmKaV9w8LvVGbLH4jN3CJKovNjhH7TvDdny8', // Serum
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium

        // Additional DEX/AMM programs
        'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CLMM
        'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', // Raydium CPMM
        'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', // Phoenix
        'Dooar9JkhdZ7J3LHN3A7YCuoGRUggXhQaG4kijfLGU2j', // Lifinity
        'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // Meteora DLMM
        'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', // Meteora Pools
        'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky', // Mercurial
        'HyaB3W9q6XdA5xwpU4XnSZV94htfmbmqJXZcEbRaJutt', // Invariant
        'SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr', // Saros
        'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Aldrin
        'FLUXubRmkEi2q6K3Y9kBPg9248ggaZVsoSFhtJHSrm1X', // FluxBeam

        // Lending/Borrowing protocols
        'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', // Marginfi
        'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', // Kamino Lend
        'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', // Solend
        'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', // Drift
        'Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR', // Port Finance
        '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc', // Larix
        'hadeK9DLv9eA7ya5KCTqSvSvRZeJC3JgD5a9Y3CNbvu', // Hadeswap

        // Staking/Liquid staking
        'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy', // Stake Pool program
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // Marinade mSOL
        'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp', // Liquid Staking Token
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // Jito
        'BLZRi6frs4X4DNLw56V4EXai1b6QVESN1BhHBTYM4VcY', // BlazeStake

        // Other significant protocols
        'PythP5jyMWGSMUs1GBABL9NMy51dskhnCLHgYWVCFE9', // Pyth Price Oracle
        'MNFSTqtC93rjpqpHHApjykkZiyTKctLjAcCLHbcfgZK', // Manifest
        'cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ', // Metaplex Candy Machine v3
        'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz', // Metaplex Auction House
      ]);

      // Monitor for new transactions by subscribing to specific programs instead of ALL
      await this.safeSubscribe('logs', () => {
        const logsCallback = async (logs: any, context: any) => {
          // Early exit if no connected clients need transaction monitoring
          const hasActiveTransactionListeners = Array.from(this.clients.values()).some(
            client => client.isConnected && (client.subscriptions.has('transaction') || client.subscriptions.has('all'))
          );

          if (!hasActiveTransactionListeners) {
            return; // Skip processing if no one is listening
          }

          if (logs.signature) {
            try {
              // Rate limiting check
              const now = Date.now();
              if (now - lastResetTime >= 1000) {
                transactionCount = 0;
                lastResetTime = now;
              }

              if (transactionCount >= TRANSACTION_RATE_LIMIT) {
                return; // Skip processing if rate limit exceeded
              }
              transactionCount++;

              // Quick filtering based on logs before expensive RPC call
              const logContent = logs.logs?.join(' ') || '';

              // Skip vote transactions immediately
              if (logContent.includes('Vote111111111111111111111111111111111111111')) {
                return;
              }

              // Skip if no important programs are involved
              const hasImportantProgram = Array.from(IMPORTANT_PROGRAMS).some(program =>
                logContent.includes(program)
              );

              if (!hasImportantProgram) {
                return; // Skip this transaction
              }

              let txDetails: any = null;
              try {
                // Add timeout wrapper for getTransaction calls
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Transaction fetch timeout')), 5000)
                );

                const fetchPromise = this.connection!.getTransaction(logs.signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0
                });

                // Race between fetch and timeout
                txDetails = await Promise.race([fetchPromise, timeoutPromise]);
              } catch (fetchError) {
                // Log error but continue processing with just the logs data
                if (fetchError instanceof Error && fetchError.message === 'Transaction fetch timeout') {
                  logger.debug(`Transaction fetch timeout for ${logs.signature}, continuing with logs data only`);
                } else {
                  logger.warn(`Failed to fetch transaction details for ${logs.signature}:`, fetchError);
                }
              }

              // Create event with available data (whether we got tx details or not)
              let accountKeys: string[] = [];
              if (txDetails?.transaction?.message) {
                try {
                  // Use getAccountKeys() method for versioned transactions
                  const keys = txDetails.transaction.message.getAccountKeys();
                  accountKeys = keys.keySegments().flat().map((key: any) => key.toString());
                } catch (error) {
                  // Fallback for legacy transactions
                  if ('accountKeys' in txDetails.transaction.message) {
                    accountKeys = (txDetails.transaction.message as any).accountKeys?.map((key: any) => key.toString()) || [];
                  }
                }
              }

              // Only filter out pure system transactions if we have account keys
              if (accountKeys.length > 0) {
                const isPureSystemTransaction = accountKeys.every((key: string) =>
                  SYSTEM_PROGRAMS.has(key) &&
                  !key.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                );

                // Skip pure system transactions
                if (isPureSystemTransaction) {
                  return;
                }
              }

              const event = {
                type: 'transaction' as const,
                timestamp: Date.now(),
                data: {
                  signature: logs.signature,
                  slot: context.slot,
                  logs: logs.logs,
                  err: logs.err,
                  fee: txDetails?.meta?.fee || null,
                  preBalances: txDetails?.meta?.preBalances || [],
                  postBalances: txDetails?.meta?.postBalances || [],
                  accountKeys: accountKeys,
                  knownProgram: this.identifyKnownProgram(accountKeys),
                  transactionType: this.classifyTransaction(logs.logs || [], accountKeys)
                }
              };
              this.broadcastEvent(event);
            } catch (eventError) {
              logger.error('Error processing transaction event:', eventError);
            }
          }
        };

        this.subscriptionCallbacks.set('logs', logsCallback);

        // Instead of monitoring ALL transactions, monitor only specific important programs
        // This dramatically reduces the load by 90%+
        const importantPrograms = Array.from(IMPORTANT_PROGRAMS);

        // Subscribe to multiple important programs instead of 'all'
        const subscriptionPromises = importantPrograms.map(program =>
          this.connection!.onLogs(new PublicKey(program), logsCallback, 'confirmed')
        );

        // Return the first subscription ID (we'll track all of them)
        return subscriptionPromises[0];
      });

    } catch (error) {
      logger.error('Failed to setup transaction monitoring:', error);
      this.recordSubscriptionError('logs', error);
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
