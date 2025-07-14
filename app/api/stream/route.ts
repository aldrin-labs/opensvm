import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana-connection';
import { Connection } from '@solana/web3.js';
import { getStreamingAnomalyDetector } from '@/lib/streaming-anomaly-detector';
import { validateStreamRequest } from '@/lib/validation/stream-schemas';
import { getRateLimiter, type RateLimitResult } from '@/lib/rate-limiter';
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
}

// Enhanced authentication and rate limiting with timestamp-based blocking
const CLIENT_AUTH_TOKENS = new Map<string, { token: string; clientId: string; createdAt: number }>();
const AUTH_FAILURES = new Map<string, { 
  attempts: number; 
  lastAttempt: number; 
  blockUntil: number | null; // Use timestamp instead of boolean flag
}>();
const rateLimiter = getRateLimiter();

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

function checkRateLimit(clientId: string, type: string, tokens: number = 1): RateLimitResult {
  return rateLimiter.checkRateLimit(clientId, type, tokens);
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
      this.clients.delete(clientId);
      CLIENT_AUTH_TOKENS.delete(clientId);
      AUTH_FAILURES.delete(clientId);
      logger.debug(`Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
      
      if (this.clients.size === 0) {
        this.stopMonitoring();
      }
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
      
      // Setup transaction monitoring with error protection
      await this.setupTransactionMonitoring();
      
      logger.debug('Started blockchain event monitoring with anomaly detection');
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      this.isMonitoring = false;
      this.recordSubscriptionError('monitoring', error);
    }
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
    
    try {
      // System programs to filter out
      const SYSTEM_PROGRAMS = new Set([
        'Vote111111111111111111111111111111111111111', // Vote program
        '11111111111111111111111111111111', // System program  
        'ComputeBudget111111111111111111111111111111', // Compute budget program
        'AddressLookupTab1e1111111111111111111111111', // Address lookup table program
        'Config1111111111111111111111111111111111111', // Config program
        'Stake11111111111111111111111111111111111111', // Stake program
      ]);

      // Monitor for new transactions by subscribing to logs with safe subscription
      await this.safeSubscribe('logs', () => {
        const logsCallback = async (logs: any, context: any) => {
          if (logs.signature) {
            try {
              // Skip obvious vote transactions early to reduce processing load
              const isVoteTransaction = logs.logs?.some((log: string) => log.includes('Vote111111111111111111111111111111111111111'));
              if (isVoteTransaction) {
                return;
              }
              
              let txDetails = null;
              try {
                // Try to fetch transaction details, but don't fail the whole event if this fails
                txDetails = await this.connection!.getTransaction(logs.signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0
                });
              } catch (fetchError) {
                // Log error but continue processing with just the logs data
                logger.warn(`Failed to fetch transaction details for ${logs.signature}:`, fetchError);
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
        return this.connection!.onLogs('all', logsCallback, 'confirmed');
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
    
    // Broadcast to WebSocket clients
    for (const [clientId, client] of this.clients) {
      try {
        // Check if client is subscribed to this event type
        if (client.subscriptions.has(event.type) || client.subscriptions.has('all')) {
          client.send(eventData);
          successCount++;
        }
      } catch (error) {
        logger.error(`Failed to send event to client ${clientId}:`, error);
        failureCount++;
        // Remove failed clients
        this.removeClient(clientId);
      }
    }
    
    // Also broadcast to SSE clients
    try {
      const sseManager = SSEManager.getInstance();
      sseManager.broadcastBlockchainEvent(event);
    } catch (error) {
      logger.error('Failed to broadcast to SSE clients:', error);
    }
    
    if (failureCount > 0) {
      logger.warn(`Event broadcast: ${successCount} successful, ${failureCount} failed`);
    }
  }

  public subscribeToEvents(clientId: string, eventTypes: string[], authToken?: string): boolean {
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
    const rateLimitResult = checkRateLimit(clientId, 'api_requests', 1);
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
    return {
      isMonitoring: this.isMonitoring,
      clientCount: this.clients.size,
      subscriptions: Array.from(this.subscriptionIds.keys()),
      subscriptionAttempts: Object.fromEntries(this.subscriptionAttempts),
      subscriptionErrors: Object.fromEntries(
        Array.from(this.subscriptionErrors.entries()).map(([key, value]) => [
          key,
          { count: value.count, lastError: value.lastError.toISOString() }
        ])
      ),
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
    
    // Validate request structure with Zod
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
      const rateLimitResult = checkRateLimit(clientId, 'api_requests', 1);
      if (!rateLimitResult.allowed) {
        const { response, status } = CommonErrors.rateLimit(rateLimitResult.retryAfter, rateLimitResult.remainingTokens);
        return Response.json(response, { 
          status,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remainingTokens.toString(),
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
        const authRateLimit = checkRateLimit(clientId, 'authentication', 1);
        if (!authRateLimit.allowed) {
          logAuthFailure(clientId, 'Authentication rate limit exceeded');
          const { response, status } = CommonErrors.rateLimit(authRateLimit.retryAfter, authRateLimit.remainingTokens);
          return Response.json(response, { 
            status,
            headers: {
              'X-RateLimit-Remaining': authRateLimit.remainingTokens.toString(),
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
            api_requests: rateLimiter.getBucketState(clientId, 'api_requests'),
            websocket_connections: rateLimiter.getBucketState(clientId, 'websocket_connections')
          }
        }));
        
      case 'subscribe':
        if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
          const { response, status } = CommonErrors.missingField('eventTypes');
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
        
        const success = manager.subscribeToEvents(clientId!, eventTypes, authToken);
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
          lastActivity: Date.now()
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
