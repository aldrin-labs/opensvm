/**
 * MCP Federation Persistent Storage
 *
 * Qdrant-backed storage for federation data:
 * - Servers registry with vector search for tool discovery
 * - Trust metrics with time-series history
 * - Abuse reports with evidence tracking
 * - Peer network state for gossip protocol
 *
 * @module api/src/mcp-federation-storage
 */

import type {
  FederatedServer,
  FederatedTool,
  TrustMetrics,
  PeerInfo,
} from './mcp-federation.js';

// ============================================================================
// Types
// ============================================================================

export interface FederationStorageConfig {
  qdrantUrl: string;
  qdrantApiKey?: string;
  vectorDimensions: number;
  collections: {
    servers: string;
    metrics: string;
    reports: string;
    peers: string;
  };
  timeoutMs: number;
}

export interface StoredReport {
  id: string;
  serverId: string;
  reporterWallet?: string;
  reason: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence?: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'confirmed' | 'dismissed';
  reviewedAt?: number;
  reviewedBy?: string;
  notes?: string;
}

export interface TrustHistory {
  serverId: string;
  timestamp: number;
  score: number;
  metrics: TrustMetrics;
  event?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: FederationStorageConfig = {
  qdrantUrl: process.env.QDRANT_SERVER || 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT || undefined,
  vectorDimensions: 384,
  collections: {
    servers: 'mcp_federation_servers',
    metrics: 'mcp_federation_metrics',
    reports: 'mcp_federation_reports',
    peers: 'mcp_federation_peers',
  },
  timeoutMs: 10000,
};

// ============================================================================
// Federation Storage Class
// ============================================================================

export class FederationStorage {
  private config: FederationStorageConfig;
  private initialized = false;

  constructor(config: Partial<FederationStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.qdrantApiKey) {
      h['api-key'] = this.config.qdrantApiKey;
    }
    return h;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Qdrant operation timed out')), this.config.timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[FederationStorage] Initializing Qdrant collections...');

    try {
      // Create servers collection with vector search
      await this.ensureCollection(this.config.collections.servers, true);

      // Create metrics collection (no vectors, just payload)
      await this.ensureCollection(this.config.collections.metrics, false);

      // Create reports collection
      await this.ensureCollection(this.config.collections.reports, false);

      // Create peers collection
      await this.ensureCollection(this.config.collections.peers, false);

      // Create indexes
      await this.createIndexes();

      this.initialized = true;
      console.log('[FederationStorage] Initialization complete');
    } catch (error) {
      console.error('[FederationStorage] Initialization failed:', error);
      throw error;
    }
  }

  private async ensureCollection(name: string, withVectors: boolean): Promise<void> {
    try {
      const checkResponse = await this.withTimeout(
        fetch(`${this.config.qdrantUrl}/collections/${name}`, {
          headers: this.headers(),
        })
      );

      if (checkResponse.ok) {
        console.log(`[FederationStorage] Collection ${name} exists`);
        return;
      }

      const config: any = {};
      if (withVectors) {
        config.vectors = {
          size: this.config.vectorDimensions,
          distance: 'Cosine',
        };
      } else {
        // Create collection without vectors (payload-only)
        config.vectors = {
          size: 1,
          distance: 'Cosine',
        };
      }

      const createResponse = await this.withTimeout(
        fetch(`${this.config.qdrantUrl}/collections/${name}`, {
          method: 'PUT',
          headers: this.headers(),
          body: JSON.stringify(config),
        })
      );

      if (!createResponse.ok) {
        const error = await createResponse.text();
        if (!error.includes('already exists')) {
          throw new Error(`Failed to create collection ${name}: ${error}`);
        }
      }

      console.log(`[FederationStorage] Created collection ${name}`);
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        throw error;
      }
    }
  }

  private async createIndexes(): Promise<void> {
    const serverIndexes = [
      { field: 'owner', type: 'keyword' },
      { field: 'trustScore', type: 'integer' },
      { field: 'registeredAt', type: 'integer' },
      { field: 'lastSeenAt', type: 'integer' },
    ];

    const metricsIndexes = [
      { field: 'serverId', type: 'keyword' },
      { field: 'timestamp', type: 'integer' },
    ];

    const reportIndexes = [
      { field: 'serverId', type: 'keyword' },
      { field: 'status', type: 'keyword' },
      { field: 'category', type: 'keyword' },
      { field: 'severity', type: 'keyword' },
      { field: 'timestamp', type: 'integer' },
    ];

    const peerIndexes = [
      { field: 'lastContact', type: 'integer' },
      { field: 'trustScore', type: 'integer' },
    ];

    for (const idx of serverIndexes) {
      await this.ensureIndex(this.config.collections.servers, idx.field, idx.type as any);
    }
    for (const idx of metricsIndexes) {
      await this.ensureIndex(this.config.collections.metrics, idx.field, idx.type as any);
    }
    for (const idx of reportIndexes) {
      await this.ensureIndex(this.config.collections.reports, idx.field, idx.type as any);
    }
    for (const idx of peerIndexes) {
      await this.ensureIndex(this.config.collections.peers, idx.field, idx.type as any);
    }
  }

  private async ensureIndex(
    collection: string,
    field: string,
    type: 'keyword' | 'integer' | 'float' | 'bool'
  ): Promise<void> {
    try {
      await this.withTimeout(
        fetch(`${this.config.qdrantUrl}/collections/${collection}/index`, {
          method: 'PUT',
          headers: this.headers(),
          body: JSON.stringify({
            field_name: field,
            field_schema: type,
          }),
        })
      );
    } catch {
      // Index might already exist
    }
  }

  // ==========================================================================
  // Server Operations
  // ==========================================================================

  /**
   * Store a federated server
   */
  async storeServer(server: FederatedServer): Promise<void> {
    await this.initialize();

    // Generate embedding from server description and tools
    const text = this.serverToText(server);
    const vector = this.simpleEmbed(text);

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.servers}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id: server.id,
            vector,
            payload: {
              ...server,
              _searchText: text,
            },
          }],
        }),
      })
    );
  }

  /**
   * Get a server by ID
   */
  async getServer(serverId: string): Promise<FederatedServer | null> {
    await this.initialize();

    const response = await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.servers}/points/${serverId}`, {
        headers: this.headers(),
      })
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.result) return null;

    const payload = data.result.payload;
    delete payload._searchText;
    return payload as FederatedServer;
  }

  /**
   * List servers with filters
   */
  async listServers(options: {
    minTrust?: number;
    owner?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<FederatedServer[]> {
    await this.initialize();

    const must: any[] = [];

    if (options.minTrust !== undefined) {
      must.push({
        key: 'trustScore',
        range: { gte: options.minTrust },
      });
    }

    if (options.owner) {
      must.push({
        key: 'owner',
        match: { value: options.owner },
      });
    }

    const response = await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.servers}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit: options.limit || 100,
          offset: options.offset || 0,
          filter: must.length > 0 ? { must } : undefined,
          with_payload: true,
        }),
      })
    );

    const data = await response.json();
    return (data.result?.points || []).map((p: any) => {
      const payload = p.payload;
      delete payload._searchText;
      return payload as FederatedServer;
    });
  }

  /**
   * Search servers by tool/description similarity
   */
  async searchServers(query: string, options: {
    minTrust?: number;
    limit?: number;
  } = {}): Promise<Array<{ server: FederatedServer; score: number }>> {
    await this.initialize();

    const vector = this.simpleEmbed(query);
    const must: any[] = [];

    if (options.minTrust !== undefined) {
      must.push({
        key: 'trustScore',
        range: { gte: options.minTrust },
      });
    }

    const response = await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.servers}/points/search`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          vector,
          limit: options.limit || 50,
          filter: must.length > 0 ? { must } : undefined,
          with_payload: true,
          score_threshold: 0.3,
        }),
      })
    );

    const data = await response.json();
    return (data.result || []).map((p: any) => {
      const payload = p.payload;
      delete payload._searchText;
      return {
        server: payload as FederatedServer,
        score: p.score,
      };
    });
  }

  /**
   * Update server fields
   */
  async updateServer(serverId: string, updates: Partial<FederatedServer>): Promise<void> {
    await this.initialize();

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.servers}/points/payload`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          points: [serverId],
          payload: updates,
        }),
      })
    );
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string): Promise<void> {
    await this.initialize();

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.servers}/points/delete`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          points: [serverId],
        }),
      })
    );
  }

  // ==========================================================================
  // Trust Metrics Operations
  // ==========================================================================

  /**
   * Store trust metrics snapshot
   */
  async storeTrustMetrics(serverId: string, metrics: TrustMetrics, score: number, event?: string): Promise<void> {
    await this.initialize();

    const id = `${serverId}_${Date.now()}`;
    const history: TrustHistory = {
      serverId,
      timestamp: Date.now(),
      score,
      metrics,
      event,
    };

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.metrics}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id,
            vector: [0], // Dummy vector for payload-only collection
            payload: history,
          }],
        }),
      })
    );
  }

  /**
   * Get trust history for a server
   */
  async getTrustHistory(serverId: string, limit: number = 100): Promise<TrustHistory[]> {
    await this.initialize();

    const response = await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.metrics}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit,
          filter: {
            must: [{ key: 'serverId', match: { value: serverId } }],
          },
          with_payload: true,
        }),
      })
    );

    const data = await response.json();
    const history = (data.result?.points || []).map((p: any) => p.payload as TrustHistory);

    // Sort by timestamp descending
    history.sort((a: TrustHistory, b: TrustHistory) => b.timestamp - a.timestamp);

    return history;
  }

  /**
   * Get latest metrics for a server
   */
  async getLatestMetrics(serverId: string): Promise<TrustMetrics | null> {
    const history = await this.getTrustHistory(serverId, 1);
    return history.length > 0 ? history[0].metrics : null;
  }

  // ==========================================================================
  // Report Operations
  // ==========================================================================

  /**
   * Store an abuse report
   */
  async storeReport(report: StoredReport): Promise<void> {
    await this.initialize();

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.reports}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id: report.id,
            vector: [0],
            payload: report,
          }],
        }),
      })
    );
  }

  /**
   * Get reports for a server
   */
  async getReports(serverId: string, options: {
    status?: string;
    limit?: number;
  } = {}): Promise<StoredReport[]> {
    await this.initialize();

    const must: any[] = [{ key: 'serverId', match: { value: serverId } }];

    if (options.status) {
      must.push({ key: 'status', match: { value: options.status } });
    }

    const response = await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.reports}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit: options.limit || 100,
          filter: { must },
          with_payload: true,
        }),
      })
    );

    const data = await response.json();
    return (data.result?.points || []).map((p: any) => p.payload as StoredReport);
  }

  /**
   * Update report status
   */
  async updateReport(reportId: string, updates: Partial<StoredReport>): Promise<void> {
    await this.initialize();

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.reports}/points/payload`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          points: [reportId],
          payload: updates,
        }),
      })
    );
  }

  /**
   * Get report counts by server
   */
  async getReportCounts(serverId: string): Promise<{ total: number; pending: number; confirmed: number }> {
    const reports = await this.getReports(serverId);
    return {
      total: reports.length,
      pending: reports.filter(r => r.status === 'pending').length,
      confirmed: reports.filter(r => r.status === 'confirmed').length,
    };
  }

  // ==========================================================================
  // Peer Operations
  // ==========================================================================

  /**
   * Store or update peer info
   */
  async storePeer(peer: PeerInfo): Promise<void> {
    await this.initialize();

    await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.peers}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id: peer.serverId,
            vector: [0],
            payload: peer,
          }],
        }),
      })
    );
  }

  /**
   * Get all peers
   */
  async getPeers(options: {
    minTrust?: number;
    maxAgeMs?: number;
    limit?: number;
  } = {}): Promise<PeerInfo[]> {
    await this.initialize();

    const must: any[] = [];

    if (options.minTrust !== undefined) {
      must.push({
        key: 'trustScore',
        range: { gte: options.minTrust },
      });
    }

    if (options.maxAgeMs !== undefined) {
      const minTime = Date.now() - options.maxAgeMs;
      must.push({
        key: 'lastContact',
        range: { gte: minTime },
      });
    }

    const response = await this.withTimeout(
      fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.peers}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit: options.limit || 100,
          filter: must.length > 0 ? { must } : undefined,
          with_payload: true,
        }),
      })
    );

    const data = await response.json();
    return (data.result?.points || []).map((p: any) => p.payload as PeerInfo);
  }

  /**
   * Delete stale peers
   */
  async cleanupStalePeers(maxAgeMs: number): Promise<number> {
    await this.initialize();

    const peers = await this.getPeers();
    const stale = peers.filter(p => Date.now() - p.lastContact > maxAgeMs);

    if (stale.length > 0) {
      await this.withTimeout(
        fetch(`${this.config.qdrantUrl}/collections/${this.config.collections.peers}/points/delete`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            points: stale.map(p => p.serverId),
          }),
        })
      );
    }

    return stale.length;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getStats(): Promise<{
    serverCount: number;
    reportCount: number;
    peerCount: number;
    metricsCount: number;
  }> {
    await this.initialize();

    const counts = await Promise.all([
      this.getCollectionCount(this.config.collections.servers),
      this.getCollectionCount(this.config.collections.reports),
      this.getCollectionCount(this.config.collections.peers),
      this.getCollectionCount(this.config.collections.metrics),
    ]);

    return {
      serverCount: counts[0],
      reportCount: counts[1],
      peerCount: counts[2],
      metricsCount: counts[3],
    };
  }

  private async getCollectionCount(collection: string): Promise<number> {
    try {
      const response = await this.withTimeout(
        fetch(`${this.config.qdrantUrl}/collections/${collection}`, {
          headers: this.headers(),
        })
      );

      if (!response.ok) return 0;

      const data = await response.json();
      return data.result?.points_count || 0;
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private serverToText(server: FederatedServer): string {
    const parts = [
      server.name,
      server.description,
      ...server.tools.map(t => `${t.name}: ${t.description} (${t.category})`),
      ...(server.metadata.tags || []),
    ];
    return parts.join(' ');
  }

  /**
   * Simple local embedding using character n-grams
   */
  private simpleEmbed(text: string): number[] {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    const vector = new Array(this.config.vectorDimensions).fill(0);

    // Character trigrams
    for (let i = 0; i < normalized.length - 2; i++) {
      const trigram = normalized.slice(i, i + 3);
      let hash = 0;
      for (let j = 0; j < trigram.length; j++) {
        hash = ((hash << 5) - hash) + trigram.charCodeAt(j);
        hash = hash & hash;
      }
      const idx = Math.abs(hash) % this.config.vectorDimensions;
      vector[idx] += 1;
    }

    // Word unigrams
    for (const word of words) {
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(j);
        hash = hash & hash;
      }
      const idx = Math.abs(hash) % this.config.vectorDimensions;
      vector[idx] += 2;
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? vector.map(v => v / norm) : vector;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalStorage: FederationStorage | null = null;

export function getFederationStorage(): FederationStorage {
  if (!globalStorage) {
    globalStorage = new FederationStorage();
  }
  return globalStorage;
}

export function createFederationStorage(config?: Partial<FederationStorageConfig>): FederationStorage {
  globalStorage = new FederationStorage(config);
  return globalStorage;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  FederationStorage,
  getFederationStorage,
  createFederationStorage,
};
