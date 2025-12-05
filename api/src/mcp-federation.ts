/**
 * MCP Federation Network
 *
 * Decentralized network of MCP servers with:
 * - Discovery protocol for finding and registering servers
 * - Trust scoring based on reliability, response time, quality
 * - Automatic revenue share through metering integration
 * - Tool forwarding to remote servers
 * - Health monitoring and failover
 * - Gossip-based peer discovery
 *
 * @module api/src/mcp-federation
 */

// ============================================================================
// Types
// ============================================================================

export interface FederatedServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;                // Base URL for the server
  mcpVersion: string;              // MCP protocol version
  owner: string;                   // Wallet address of server owner
  tools: FederatedTool[];          // Available tools
  capabilities: ServerCapabilities;
  trustScore: number;              // 0-100
  registeredAt: number;
  lastSeenAt: number;
  metadata: ServerMetadata;
}

export interface FederatedTool {
  name: string;
  description: string;
  inputSchema: any;
  category: string;
  pricing?: {
    baseCostMicro: bigint;
    perCallCost?: bigint;
  };
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

export interface ServerCapabilities {
  streaming: boolean;
  batching: boolean;
  webhooks: boolean;
  customAuth: boolean;
  maxConcurrentRequests: number;
  supportedAuthMethods: string[];
}

export interface ServerMetadata {
  version: string;
  region?: string;
  tags: string[];
  website?: string;
  documentation?: string;
  supportContact?: string;
  revenueSharePercent: number;     // 0-100, default 70 for developer
  minTrustRequired: number;        // Minimum trust score to use this server
}

export interface TrustMetrics {
  uptime: number;                  // 0-100 percentage
  avgResponseTimeMs: number;
  successRate: number;             // 0-100 percentage
  totalRequests: number;
  totalErrors: number;
  qualityScore: number;            // 0-100 based on response quality
  reportCount: number;             // Number of abuse reports
  verifiedOwner: boolean;          // Owner wallet verified
  auditedCode: boolean;            // Code has been audited
}

export interface PeerInfo {
  serverId: string;
  endpoint: string;
  lastContact: number;
  trustScore: number;
}

export interface FederationConfig {
  // Network
  networkId: string;               // Unique network identifier
  bootstrapPeers: string[];        // Initial peer endpoints
  maxPeers: number;
  gossipIntervalMs: number;
  healthCheckIntervalMs: number;

  // Discovery
  discoveryEnabled: boolean;
  announceEnabled: boolean;
  announceEndpoint?: string;       // This server's endpoint for others

  // Trust
  minTrustScore: number;
  trustDecayRate: number;          // How fast trust decays without activity
  newServerTrust: number;          // Starting trust for new servers

  // Timeouts
  requestTimeoutMs: number;
  connectionTimeoutMs: number;

  // Caching
  cacheServerListMs: number;
  cacheToolResultsMs: number;
}

export interface ToolCallRequest {
  serverId: string;
  tool: string;
  params: Record<string, any>;
  userId?: string;
  apiKey?: string;
}

export interface ToolCallResponse {
  success: boolean;
  result?: any;
  error?: string;
  serverId: string;
  tool: string;
  durationMs: number;
  fromCache: boolean;
  cost?: bigint;
}

export interface DiscoveryMessage {
  type: 'announce' | 'query' | 'response' | 'ping' | 'pong';
  senderId: string;
  timestamp: number;
  payload: any;
  signature?: string;              // Optional cryptographic signature
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: FederationConfig = {
  networkId: 'opensvm-mcp-mainnet',
  bootstrapPeers: [],
  maxPeers: 100,
  gossipIntervalMs: 60000,         // 1 minute
  healthCheckIntervalMs: 30000,    // 30 seconds
  discoveryEnabled: true,
  announceEnabled: false,
  minTrustScore: 20,
  trustDecayRate: 0.99,            // 1% decay per day
  newServerTrust: 30,
  requestTimeoutMs: 30000,
  connectionTimeoutMs: 10000,
  cacheServerListMs: 300000,       // 5 minutes
  cacheToolResultsMs: 60000,       // 1 minute for non-immutable
};

// ============================================================================
// Trust Calculator
// ============================================================================

export class TrustCalculator {
  /**
   * Calculate trust score from metrics
   */
  static calculate(metrics: TrustMetrics): number {
    // Weights for different factors
    const weights = {
      uptime: 0.20,
      responseTime: 0.15,
      successRate: 0.25,
      quality: 0.15,
      volume: 0.10,
      verification: 0.15,
    };

    // Uptime score (0-100)
    const uptimeScore = metrics.uptime;

    // Response time score (faster = better, 0-100)
    const responseTimeScore = Math.max(0, 100 - (metrics.avgResponseTimeMs / 100));

    // Success rate score (0-100)
    const successScore = metrics.successRate;

    // Quality score (0-100)
    const qualityScore = metrics.qualityScore;

    // Volume score (more requests = more reliable data)
    const volumeScore = Math.min(100, Math.log10(metrics.totalRequests + 1) * 20);

    // Verification bonus
    let verificationScore = 50;
    if (metrics.verifiedOwner) verificationScore += 25;
    if (metrics.auditedCode) verificationScore += 25;

    // Penalty for abuse reports
    const reportPenalty = Math.min(50, metrics.reportCount * 10);

    // Calculate weighted score
    const rawScore =
      uptimeScore * weights.uptime +
      responseTimeScore * weights.responseTime +
      successScore * weights.successRate +
      qualityScore * weights.quality +
      volumeScore * weights.volume +
      verificationScore * weights.verification -
      reportPenalty;

    return Math.max(0, Math.min(100, Math.round(rawScore)));
  }

  /**
   * Apply decay to trust score
   */
  static applyDecay(currentScore: number, daysSinceActivity: number, decayRate: number): number {
    const decayFactor = Math.pow(decayRate, daysSinceActivity);
    return Math.round(currentScore * decayFactor);
  }
}

// ============================================================================
// Federation Network
// ============================================================================

export class FederationNetwork {
  private config: FederationConfig;
  private servers = new Map<string, FederatedServer>();
  private peers = new Map<string, PeerInfo>();
  private trustMetrics = new Map<string, TrustMetrics>();
  private serverCache: { data: FederatedServer[]; timestamp: number } | null = null;
  private resultCache = new Map<string, { result: any; timestamp: number }>();

  private gossipTimer?: ReturnType<typeof setInterval>;
  private healthTimer?: ReturnType<typeof setInterval>;
  private thisServer?: FederatedServer;

  constructor(config: Partial<FederationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the federation network
   */
  async start(thisServer?: FederatedServer): Promise<void> {
    this.thisServer = thisServer;

    console.log(`[Federation] Starting network: ${this.config.networkId}`);

    // Bootstrap from initial peers
    if (this.config.bootstrapPeers.length > 0) {
      await this.bootstrap();
    }

    // Start gossip protocol
    if (this.config.discoveryEnabled) {
      this.startGossip();
    }

    // Start health monitoring
    this.startHealthMonitoring();

    // Announce self if configured
    if (this.config.announceEnabled && this.thisServer) {
      await this.announceServer(this.thisServer);
    }

    console.log(`[Federation] Network started with ${this.servers.size} known servers`);
  }

  /**
   * Stop the federation network
   */
  stop(): void {
    if (this.gossipTimer) {
      clearInterval(this.gossipTimer);
      this.gossipTimer = undefined;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
    console.log('[Federation] Network stopped');
  }

  // ==========================================================================
  // Server Registry
  // ==========================================================================

  /**
   * Register a new server in the network
   */
  async registerServer(server: FederatedServer): Promise<{ success: boolean; serverId: string }> {
    // Validate server
    if (!server.endpoint || !server.owner || server.tools.length === 0) {
      throw new Error('Invalid server: missing required fields');
    }

    // Generate ID if not provided
    if (!server.id) {
      server.id = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    // Set defaults
    server.registeredAt = Date.now();
    server.lastSeenAt = Date.now();
    server.trustScore = this.config.newServerTrust;

    // Verify server is reachable
    const isReachable = await this.pingServer(server.endpoint);
    if (!isReachable) {
      throw new Error('Server is not reachable');
    }

    // Store server
    this.servers.set(server.id, server);

    // Initialize trust metrics
    this.trustMetrics.set(server.id, {
      uptime: 100,
      avgResponseTimeMs: 0,
      successRate: 100,
      totalRequests: 0,
      totalErrors: 0,
      qualityScore: 50,
      reportCount: 0,
      verifiedOwner: false,
      auditedCode: false,
    });

    // Broadcast to peers
    if (this.config.announceEnabled) {
      await this.broadcastServerAnnouncement(server);
    }

    console.log(`[Federation] Registered server: ${server.name} (${server.id})`);

    return { success: true, serverId: server.id };
  }

  /**
   * Get a server by ID
   */
  getServer(serverId: string): FederatedServer | null {
    return this.servers.get(serverId) || null;
  }

  /**
   * List all servers meeting trust threshold
   */
  listServers(options: {
    minTrust?: number;
    category?: string;
    hasTools?: string[];
    limit?: number;
  } = {}): FederatedServer[] {
    // Check cache
    if (this.serverCache && Date.now() - this.serverCache.timestamp < this.config.cacheServerListMs) {
      let servers = this.serverCache.data;
      return this.filterServers(servers, options);
    }

    const minTrust = options.minTrust ?? this.config.minTrustScore;
    let servers = Array.from(this.servers.values())
      .filter(s => s.trustScore >= minTrust);

    // Update cache
    this.serverCache = { data: servers, timestamp: Date.now() };

    return this.filterServers(servers, options);
  }

  private filterServers(servers: FederatedServer[], options: {
    minTrust?: number;
    category?: string;
    hasTools?: string[];
    limit?: number;
  }): FederatedServer[] {
    let result = servers;

    if (options.category) {
      result = result.filter(s =>
        s.tools.some(t => t.category === options.category)
      );
    }

    if (options.hasTools && options.hasTools.length > 0) {
      result = result.filter(s =>
        options.hasTools!.every(tool =>
          s.tools.some(t => t.name === tool)
        )
      );
    }

    // Sort by trust score descending
    result.sort((a, b) => b.trustScore - a.trustScore);

    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Search for tools across the network
   */
  searchTools(query: string, options: {
    category?: string;
    minTrust?: number;
    limit?: number;
  } = {}): Array<{ server: FederatedServer; tool: FederatedTool; score: number }> {
    const results: Array<{ server: FederatedServer; tool: FederatedTool; score: number }> = [];
    const queryLower = query.toLowerCase();

    const servers = this.listServers({ minTrust: options.minTrust });

    for (const server of servers) {
      for (const tool of server.tools) {
        if (options.category && tool.category !== options.category) continue;

        // Calculate match score
        let score = 0;
        if (tool.name.toLowerCase().includes(queryLower)) score += 50;
        if (tool.description.toLowerCase().includes(queryLower)) score += 30;
        if (tool.category.toLowerCase().includes(queryLower)) score += 20;

        // Boost by trust score
        score += server.trustScore * 0.3;

        if (score > 0) {
          results.push({ server, tool, score });
        }
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    if (options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  // ==========================================================================
  // Tool Execution
  // ==========================================================================

  /**
   * Call a tool on a remote server
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResponse> {
    const startTime = Date.now();

    // Get server
    const server = this.servers.get(request.serverId);
    if (!server) {
      return {
        success: false,
        error: `Server not found: ${request.serverId}`,
        serverId: request.serverId,
        tool: request.tool,
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    }

    // Check trust
    if (server.trustScore < this.config.minTrustScore) {
      return {
        success: false,
        error: `Server trust score too low: ${server.trustScore}`,
        serverId: request.serverId,
        tool: request.tool,
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    }

    // Check cache
    const cacheKey = `${request.serverId}:${request.tool}:${JSON.stringify(request.params)}`;
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheToolResultsMs) {
      return {
        success: true,
        result: cached.result,
        serverId: request.serverId,
        tool: request.tool,
        durationMs: Date.now() - startTime,
        fromCache: true,
      };
    }

    // Execute remote call
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

      const response = await fetch(`${server.endpoint}/tools/${request.tool}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.apiKey ? { 'Authorization': `Bearer ${request.apiKey}` } : {}),
          'X-Federation-Network': this.config.networkId,
          'X-Federation-Caller': this.thisServer?.id || 'unknown',
        },
        body: JSON.stringify(request.params),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Remote call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const durationMs = Date.now() - startTime;

      // Update metrics
      this.recordSuccess(request.serverId, durationMs);

      // Cache result
      this.resultCache.set(cacheKey, { result, timestamp: Date.now() });

      // Get cost from tool definition
      const tool = server.tools.find(t => t.name === request.tool);
      const cost = tool?.pricing?.baseCostMicro;

      return {
        success: true,
        result,
        serverId: request.serverId,
        tool: request.tool,
        durationMs,
        fromCache: false,
        cost,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.recordError(request.serverId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        serverId: request.serverId,
        tool: request.tool,
        durationMs,
        fromCache: false,
      };
    }
  }

  /**
   * Call a tool with automatic server selection
   */
  async callToolAuto(
    toolName: string,
    params: Record<string, any>,
    options: { userId?: string; apiKey?: string; minTrust?: number } = {}
  ): Promise<ToolCallResponse> {
    // Find servers with this tool
    const servers = this.listServers({
      minTrust: options.minTrust,
      hasTools: [toolName],
    });

    if (servers.length === 0) {
      return {
        success: false,
        error: `No servers found with tool: ${toolName}`,
        serverId: '',
        tool: toolName,
        durationMs: 0,
        fromCache: false,
      };
    }

    // Try servers in order of trust
    for (const server of servers) {
      const result = await this.callTool({
        serverId: server.id,
        tool: toolName,
        params,
        userId: options.userId,
        apiKey: options.apiKey,
      });

      if (result.success) {
        return result;
      }
    }

    // All servers failed
    return {
      success: false,
      error: `All ${servers.length} servers failed for tool: ${toolName}`,
      serverId: '',
      tool: toolName,
      durationMs: 0,
      fromCache: false,
    };
  }

  // ==========================================================================
  // Trust Management
  // ==========================================================================

  /**
   * Get trust metrics for a server
   */
  getTrustMetrics(serverId: string): TrustMetrics | null {
    return this.trustMetrics.get(serverId) || null;
  }

  /**
   * Report a server for abuse
   */
  async reportServer(serverId: string, reason: string, reporterWallet?: string): Promise<void> {
    const metrics = this.trustMetrics.get(serverId);
    if (metrics) {
      metrics.reportCount++;
      this.updateTrustScore(serverId);
    }
    console.log(`[Federation] Server reported: ${serverId} - ${reason}`);
  }

  /**
   * Verify server owner
   */
  async verifyOwner(serverId: string, signature: string): Promise<boolean> {
    // In production, verify wallet signature
    const metrics = this.trustMetrics.get(serverId);
    if (metrics) {
      metrics.verifiedOwner = true;
      this.updateTrustScore(serverId);
    }
    return true;
  }

  private recordSuccess(serverId: string, responseTimeMs: number): void {
    const metrics = this.trustMetrics.get(serverId);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.avgResponseTimeMs =
      (metrics.avgResponseTimeMs * (metrics.totalRequests - 1) + responseTimeMs) /
      metrics.totalRequests;
    metrics.successRate =
      ((metrics.totalRequests - metrics.totalErrors) / metrics.totalRequests) * 100;

    this.updateTrustScore(serverId);

    // Update last seen
    const server = this.servers.get(serverId);
    if (server) {
      server.lastSeenAt = Date.now();
    }
  }

  private recordError(serverId: string): void {
    const metrics = this.trustMetrics.get(serverId);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.totalErrors++;
    metrics.successRate =
      ((metrics.totalRequests - metrics.totalErrors) / metrics.totalRequests) * 100;

    this.updateTrustScore(serverId);
  }

  private updateTrustScore(serverId: string): void {
    const metrics = this.trustMetrics.get(serverId);
    const server = this.servers.get(serverId);
    if (!metrics || !server) return;

    server.trustScore = TrustCalculator.calculate(metrics);
  }

  // ==========================================================================
  // Peer Discovery (Gossip Protocol)
  // ==========================================================================

  private startGossip(): void {
    this.gossipTimer = setInterval(() => {
      this.gossipRound();
    }, this.config.gossipIntervalMs);
  }

  private async gossipRound(): Promise<void> {
    if (this.peers.size === 0) return;

    // Select random peers to gossip with
    const peerList = Array.from(this.peers.values());
    const selectedPeers = this.selectRandomPeers(peerList, 3);

    for (const peer of selectedPeers) {
      try {
        // Exchange server lists
        await this.exchangeServerList(peer);
      } catch (error) {
        console.warn(`[Federation] Gossip failed with peer ${peer.serverId}:`, error);
      }
    }
  }

  private selectRandomPeers(peers: PeerInfo[], count: number): PeerInfo[] {
    const shuffled = Array.from(peers).sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private async exchangeServerList(peer: PeerInfo): Promise<void> {
    const myServers = Array.from(this.servers.values())
      .map(s => ({
        id: s.id,
        name: s.name,
        endpoint: s.endpoint,
        trustScore: s.trustScore,
        lastSeenAt: s.lastSeenAt,
      }));

    try {
      const response = await fetch(`${peer.endpoint}/federation/gossip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'exchange',
          senderId: this.thisServer?.id,
          servers: myServers,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Merge received servers
        for (const server of data.servers || []) {
          if (!this.servers.has(server.id)) {
            await this.discoverServer(server.endpoint);
          }
        }
        peer.lastContact = Date.now();
      }
    } catch {
      // Peer unreachable
    }
  }

  private async discoverServer(endpoint: string): Promise<void> {
    try {
      const response = await fetch(`${endpoint}/federation/info`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const server = await response.json() as FederatedServer;
        if (!this.servers.has(server.id)) {
          await this.registerServer(server);
        }
      }
    } catch {
      // Server not reachable
    }
  }

  private async bootstrap(): Promise<void> {
    console.log(`[Federation] Bootstrapping from ${this.config.bootstrapPeers.length} peers`);

    for (const peerEndpoint of this.config.bootstrapPeers) {
      try {
        await this.discoverServer(peerEndpoint);

        // Add as peer
        const info = await this.getServerInfo(peerEndpoint);
        if (info) {
          this.peers.set(info.id, {
            serverId: info.id,
            endpoint: peerEndpoint,
            lastContact: Date.now(),
            trustScore: info.trustScore,
          });
        }
      } catch (error) {
        console.warn(`[Federation] Failed to bootstrap from ${peerEndpoint}:`, error);
      }
    }
  }

  private async getServerInfo(endpoint: string): Promise<FederatedServer | null> {
    try {
      const response = await fetch(`${endpoint}/federation/info`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private async announceServer(server: FederatedServer): Promise<void> {
    const message: DiscoveryMessage = {
      type: 'announce',
      senderId: server.id,
      timestamp: Date.now(),
      payload: server,
    };

    await this.broadcastMessage(message);
  }

  private async broadcastServerAnnouncement(server: FederatedServer): Promise<void> {
    await this.announceServer(server);
  }

  private async broadcastMessage(message: DiscoveryMessage): Promise<void> {
    for (const peer of this.peers.values()) {
      try {
        await fetch(`${peer.endpoint}/federation/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
      } catch {
        // Peer unreachable
      }
    }
  }

  // ==========================================================================
  // Health Monitoring
  // ==========================================================================

  private startHealthMonitoring(): void {
    this.healthTimer = setInterval(() => {
      this.healthCheckRound();
    }, this.config.healthCheckIntervalMs);
  }

  private async healthCheckRound(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [serverId, server] of this.servers) {
      // Check if server is stale
      if (now - server.lastSeenAt > staleThreshold) {
        const isAlive = await this.pingServer(server.endpoint);

        if (isAlive) {
          server.lastSeenAt = now;

          // Update uptime
          const metrics = this.trustMetrics.get(serverId);
          if (metrics) {
            metrics.uptime = Math.min(100, metrics.uptime + 1);
            this.updateTrustScore(serverId);
          }
        } else {
          // Decrease uptime
          const metrics = this.trustMetrics.get(serverId);
          if (metrics) {
            metrics.uptime = Math.max(0, metrics.uptime - 5);
            this.updateTrustScore(serverId);
          }

          // Remove if trust is too low
          if (server.trustScore < 5) {
            console.log(`[Federation] Removing dead server: ${server.name}`);
            this.servers.delete(serverId);
            this.trustMetrics.delete(serverId);
          }
        }
      }
    }
  }

  private async pingServer(endpoint: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.connectionTimeoutMs);

      const response = await fetch(`${endpoint}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  getNetworkStats(): {
    totalServers: number;
    totalTools: number;
    totalPeers: number;
    averageTrust: number;
    networkId: string;
  } {
    const servers = Array.from(this.servers.values());
    const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);
    const averageTrust = servers.length > 0
      ? servers.reduce((sum, s) => sum + s.trustScore, 0) / servers.length
      : 0;

    return {
      totalServers: servers.length,
      totalTools,
      totalPeers: this.peers.size,
      averageTrust: Math.round(averageTrust),
      networkId: this.config.networkId,
    };
  }
}

// ============================================================================
// Federation API Handler
// ============================================================================

/**
 * Create API routes for federation endpoints
 */
export function createFederationHandler(network: FederationNetwork, thisServer?: FederatedServer) {
  return {
    /**
     * GET /federation/info - Return this server's info
     */
    info: () => thisServer || { error: 'Not configured' },

    /**
     * GET /federation/servers - List known servers
     */
    servers: (query: { minTrust?: number; category?: string; limit?: number }) =>
      network.listServers(query),

    /**
     * GET /federation/tools/search - Search tools
     */
    searchTools: (query: { q: string; category?: string; limit?: number }) =>
      network.searchTools(query.q, { category: query.category, limit: query.limit }),

    /**
     * POST /federation/register - Register a new server
     */
    register: async (server: FederatedServer) =>
      network.registerServer(server),

    /**
     * POST /federation/gossip - Exchange server lists
     */
    gossip: (data: { servers: any[] }) => {
      const myServers = network.listServers().map(s => ({
        id: s.id,
        name: s.name,
        endpoint: s.endpoint,
        trustScore: s.trustScore,
      }));
      return { servers: myServers };
    },

    /**
     * POST /federation/message - Receive discovery message
     */
    message: async (msg: DiscoveryMessage) => {
      if (msg.type === 'announce' && msg.payload) {
        await network.registerServer(msg.payload);
      }
      return { received: true };
    },

    /**
     * GET /federation/stats - Network statistics
     */
    stats: () => network.getNetworkStats(),

    /**
     * POST /federation/report - Report server abuse
     */
    report: async (data: { serverId: string; reason: string; reporter?: string }) => {
      await network.reportServer(data.serverId, data.reason, data.reporter);
      return { reported: true };
    },
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalNetwork: FederationNetwork | null = null;

export function getFederationNetwork(): FederationNetwork {
  if (!globalNetwork) {
    globalNetwork = new FederationNetwork();
  }
  return globalNetwork;
}

export function createFederationNetwork(config?: Partial<FederationConfig>): FederationNetwork {
  globalNetwork = new FederationNetwork(config);
  return globalNetwork;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  FederationNetwork,
  TrustCalculator,
  getFederationNetwork,
  createFederationNetwork,
  createFederationHandler,
};
