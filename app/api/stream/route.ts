import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana-connection';
import { Connection, PublicKey } from '@solana/web3.js';
import { getStreamingAnomalyDetector } from '@/lib/streaming-anomaly-detector';
import { validateStreamRequest } from '@/lib/validation/stream-schemas';
import { getRateLimiter, type RateLimitResult } from '@/lib/rate-limiter';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  CommonErrors, 
  ErrorCodes 
} from '@/lib/api-response';

// Input validation schemas
interface StreamRequestBody {
  action: string;
  clientId?: string;
  eventTypes?: string[];
  authToken?: string;
}

// Safe JSON parsing with validation
function parseAndValidateRequest(body: any): StreamRequestBody | null {
  try {
    if (!body || typeof body !== 'object') {
      return null;
    }
    
    const { action, clientId, eventTypes, authToken } = body;
    
    // Validate action
    if (!action || typeof action !== 'string') {
      return null;
    }
    
    // Validate clientId if provided
    if (clientId && typeof clientId !== 'string') {
      return null;
    }
    
    // Validate eventTypes if provided
    if (eventTypes && (!Array.isArray(eventTypes) || !eventTypes.every(type => typeof type === 'string'))) {
      return null;
    }
    
    // Validate authToken if provided
    if (authToken && typeof authToken !== 'string') {
      return null;
    }
    
    return { action, clientId, eventTypes, authToken };
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return null;
  }
}

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

function generateAuthToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function validateAuthToken(clientId: string, token: string): boolean {
  const authData = CLIENT_AUTH_TOKENS.get(clientId);
  if (!authData) {
    logAuthFailure(clientId, 'Token not found');
    return false;
  }
  
  // Token expires after 1 hour
  if (Date.now() - authData.createdAt > 3600000) {
    CLIENT_AUTH_TOKENS.delete(clientId);
    logAuthFailure(clientId, 'Token expired');
    return false;
  }
  
  if (authData.token !== token) {
    logAuthFailure(clientId, 'Invalid token');
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
    console.warn(`[AUTH FAILURE] Client ${clientId} BLOCKED until ${new Date(failures.blockUntil).toISOString()}: ${reason}`);
  } else {
    console.warn(`[AUTH FAILURE] Client ${clientId}: ${reason} (attempts: ${failures.attempts})`);
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
    console.log(`[AUTH] Client ${clientId} automatically unblocked after timeout`);
    return false;
  }
  
  return true;
}

function checkRateLimit(clientId: string, type: string, tokens: number = 1): RateLimitResult {
  return rateLimiter.checkRateLimit(clientId, type, tokens);
}

interface StreamClient {
  id: string;
  send: (data: any) => void;
  close: () => void;
  subscriptions: Set<string>;
  authenticated: boolean;
  connectionTime: number;
  lastActivity: number;
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
  private isMonitoring = false;

  public static getInstance(): EventStreamManager {
    if (!EventStreamManager.instance) {
      EventStreamManager.instance = new EventStreamManager();
    }
    return EventStreamManager.instance;
  }

  public async addClient(client: StreamClient): Promise<void> {
    this.clients.set(client.id, client);
    console.log(`Client ${client.id} connected. Total clients: ${this.clients.size}`);
    
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
      console.log(`Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
      
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
      
      // Subscribe to slot changes (new blocks)
      const slotSubscriptionId = this.connection.onSlotChange((slotInfo) => {
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
      });
      
      this.subscriptionIds.set('slots', slotSubscriptionId);
      
      // Subscribe to signature notifications for transaction monitoring
      this.setupTransactionMonitoring();
      
      console.log('Started blockchain event monitoring with anomaly detection');
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      this.isMonitoring = false;
    }
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

      // Known programs to highlight
      const KNOWN_PROGRAMS = {
        raydium: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv'],
        meteora: ['Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'],
        aldrin: ['AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6'],
        pumpswap: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'],
      };

      // Monitor for new transactions by subscribing to logs
      const logsSubscriptionId = this.connection.onLogs(
        'all',
        async (logs, context) => {
          if (logs.signature) {
            try {
              // Fetch transaction details to get fee information and analyze programs
              const txDetails = await this.connection!.getTransaction(logs.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              });

              // Filter out vote transactions and system program transactions
              if (txDetails?.transaction?.message) {
                const accountKeys = txDetails.transaction.message.accountKeys?.map(key => key.toString()) || [];
                
                // Check if this is a vote transaction or system program transaction
                const isSystemTransaction = accountKeys.some(key => SYSTEM_PROGRAMS.has(key));
                const isVoteTransaction = logs.logs?.some(log => log.includes('Vote111111111111111111111111111111111111111'));
                
                // Skip system transactions and vote transactions
                if (isSystemTransaction || isVoteTransaction) {
                  return;
                }

                // Check for SPL token transfers (include these)
                const isSplTransfer = logs.logs?.some(log => 
                  log.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') ||
                  log.includes('Program log: Instruction: Transfer')
                );

                // Check for custom program calls (include these)
                const hasCustomProgram = accountKeys.some(key => 
                  !SYSTEM_PROGRAMS.has(key) && 
                  !key.startsWith('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                );

                // Only include transactions that are SPL transfers or custom program calls
                if (!isSplTransfer && !hasCustomProgram) {
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
                  accountKeys: txDetails?.transaction?.message?.accountKeys?.map(key => key.toString()) || [],
                  knownProgram: this.identifyKnownProgram(txDetails?.transaction?.message?.accountKeys?.map(key => key.toString()) || []),
                  transactionType: this.classifyTransaction(logs.logs || [], txDetails?.transaction?.message?.accountKeys?.map(key => key.toString()) || [])
                }
              };
              this.broadcastEvent(event);
            } catch (fetchError) {
              // If we can't fetch transaction details, skip this transaction
              console.warn(`Failed to fetch transaction details for ${logs.signature}:`, fetchError);
              return;
            }
          }
        },
        'confirmed'
      );
      
      this.subscriptionIds.set('logs', logsSubscriptionId);
    } catch (error) {
      console.error('Failed to setup transaction monitoring:', error);
    }
  }

  private identifyKnownProgram(accountKeys: string[]): string | null {
    const KNOWN_PROGRAMS = {
      raydium: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv'],
      meteora: ['Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'],
      aldrin: ['AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6'],
      pumpswap: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'],
    };

    for (const [programName, programIds] of Object.entries(KNOWN_PROGRAMS)) {
      if (programIds.some(id => accountKeys.includes(id))) {
        return programName;
      }
    }

    // Check for program names that contain known identifiers
    for (const key of accountKeys) {
      if (key.toLowerCase().includes('raydium')) return 'raydium';
      if (key.toLowerCase().includes('meteora')) return 'meteora';
      if (key.toLowerCase().includes('aldrin')) return 'aldrin';
      if (key.toLowerCase().includes('pump')) return 'pumpswap';
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
    
    // Remove all subscriptions
    for (const [type, subscriptionId] of this.subscriptionIds) {
      try {
        if (type === 'slots') {
          this.connection.removeSlotChangeListener(subscriptionId);
        } else if (type === 'logs') {
          this.connection.removeOnLogsListener(subscriptionId);
        }
      } catch (error) {
        console.error(`Failed to remove ${type} subscription:`, error);
      }
    }
    
    this.subscriptionIds.clear();
    this.isMonitoring = false;
    this.connection = null;
    
    console.log('Stopped blockchain event monitoring');
  }

  private broadcastEvent(event: BlockchainEvent): void {
    const eventData = JSON.stringify(event);
    let successCount = 0;
    let failureCount = 0;
    
    for (const [clientId, client] of this.clients) {
      try {
        // Check if client is subscribed to this event type
        if (client.subscriptions.has(event.type) || client.subscriptions.has('all')) {
          client.send(eventData);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to send event to client ${clientId}:`, error);
        failureCount++;
        // Remove failed clients
        this.removeClient(clientId);
      }
    }
    
    if (failureCount > 0) {
      console.warn(`Event broadcast: ${successCount} successful, ${failureCount} failed`);
    }
  }

  public subscribeToEvents(clientId: string, eventTypes: string[], authToken?: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    // Check authentication
    if (!client.authenticated || (authToken && !validateAuthToken(clientId, authToken))) {
      console.warn(`Unauthorized subscription attempt from client ${clientId}`);
      return false;
    }
    
    // Check rate limit
    const rateLimitResult = checkRateLimit(clientId, 'api_requests', 1);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for client ${clientId}`);
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
      anomalyDetector: anomalyDetector.getStats()
    };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const clientId = searchParams.get('clientId') || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle status request
  if (action === 'status') {
    const manager = EventStreamManager.getInstance();
    return Response.json(createSuccessResponse(manager.getStatus()));
  }
  
  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');
  const connection = request.headers.get('connection');
  
  if (upgrade?.toLowerCase() === 'websocket' && connection?.toLowerCase().includes('upgrade')) {
    // This is a proper WebSocket upgrade request
    
    // Check rate limits for WebSocket connections
    const rateLimitResult = checkRateLimit(clientId, 'websocket_connections', 1);
    if (!rateLimitResult.allowed) {
      const { response, status } = CommonErrors.rateLimit(rateLimitResult.retryAfter, rateLimitResult.remainingTokens);
      return new Response(JSON.stringify(response), { 
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimitResult.remainingTokens.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      });
    }

    // Check if client is blocked
    if (isClientBlocked(clientId)) {
      const { response, status } = CommonErrors.clientBlocked('Authentication failures');
      return new Response(JSON.stringify(response), { 
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // In a real implementation, this would need to be handled by a WebSocket server
    // For Next.js API routes, WebSocket upgrades require a custom server or serverless function
    // that supports WebSocket protocols. 
    // 
    // LIMITATION: True WebSocket support requires infrastructure changes.
    // Current implementation provides polling-based alternative.
    // Feature flag: ENABLE_WEBSOCKET_UPGRADE can be set to enable when infrastructure supports it.
    
    const webSocketSupported = process.env.ENABLE_WEBSOCKET_UPGRADE === 'true';
    
    if (!webSocketSupported) {
      const { response, status } = createErrorResponse(
        'WEBSOCKET_NOT_SUPPORTED',
        'WebSocket upgrade not supported in current deployment',
        {
          message: 'Server does not support WebSocket upgrades. Use HTTP polling mode instead.',
          clientId,
          supportedEvents: ['transaction', 'block', 'account_change'],
          alternatives: {
            polling: '/api/stream (POST)',
            documentation: '/docs/api/streaming'
          }
        },
        426 // Upgrade Required
      );
      
      return new Response(JSON.stringify(response), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        },
      });
    }
    
    // Future: Implement true WebSocket upgrade handling here
    // when infrastructure supports it
  }

  // If not a WebSocket request, return API information
  return new Response(JSON.stringify(createSuccessResponse({
    message: 'Streaming API endpoint',
    clientId,
    supportedMethods: ['POST for polling', 'GET with WebSocket upgrade headers'],
    supportedEvents: ['transaction', 'block', 'account_change'],
    documentation: '/docs/api/streaming'
  })), {
    headers: {
      'Content-Type': 'application/json',
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
      console.error('Invalid JSON in request:', jsonError);
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
        
        console.log(`[AUTH SUCCESS] Client ${clientId} authenticated successfully`);
        
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
          send: (data: any) => console.log('Mock send:', data),
          close: () => console.log('Mock close'),
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
    console.error('Stream API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}