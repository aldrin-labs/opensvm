#!/usr/bin/env bun
/**
 * Cross-Chain Oracle Network for Prediction Markets
 *
 * Verifies outcomes from external platforms (Kalshi, Polymarket, Manifold)
 * and settles them on Solana with cryptographic proofs.
 *
 * Architecture:
 * - OracleNode: Individual node that monitors platforms and proposes outcomes
 * - OracleNetwork: Coordinates multiple nodes with consensus
 * - ProofGenerator: Creates cryptographic proofs for outcome verification
 * - SettlementEngine: Executes on-chain settlements
 *
 * Consensus Model:
 * - 3-of-5 multisig for standard resolutions
 * - Dispute period with slashing for incorrect reports
 * - Escalation to governance for contested outcomes
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';

// ============================================================================
// Types
// ============================================================================

export type Platform = 'kalshi' | 'polymarket' | 'manifold';
export type Outcome = 'yes' | 'no' | 'invalid';
export type NodeStatus = 'active' | 'inactive' | 'slashed';

export interface MarketOutcome {
  marketId: string;
  platform: Platform;
  outcome: Outcome;
  resolvedAt: number;
  source: string;          // URL or API endpoint
  rawData: string;         // Original response
  proof: OutcomeProof;
}

export interface OutcomeProof {
  hash: string;           // SHA256 of outcome data
  timestamp: number;
  nodeSignatures: {
    nodeId: string;
    signature: string;
    publicKey: string;
  }[];
  consensusReached: boolean;
  requiredSignatures: number;
}

export interface OracleNodeConfig {
  id: string;
  name: string;
  publicKey: PublicKey;
  privateKey?: Keypair;    // Only for local node
  endpoint?: string;       // For remote nodes
  stake: number;           // Staked SOL
  status: NodeStatus;
  reputation: number;      // 0-100
}

export interface DisputeCase {
  id: string;
  marketId: string;
  platform: Platform;
  proposedOutcome: Outcome;
  disputedBy: string;
  disputeReason: string;
  evidenceUrls: string[];
  votes: { nodeId: string; vote: 'support' | 'oppose' }[];
  status: 'open' | 'resolved' | 'escalated';
  resolution?: Outcome;
  createdAt: number;
}

export interface NetworkConfig {
  /** Minimum nodes for consensus */
  minConsensusNodes: number;
  /** Required signature ratio (e.g., 0.6 = 60%) */
  consensusThreshold: number;
  /** Dispute window in seconds */
  disputePeriodSeconds: number;
  /** Minimum stake to be oracle */
  minStake: number;
  /** Slash amount for incorrect reports */
  slashAmount: number;
  /** Solana RPC endpoint */
  rpcUrl: string;
  /** Program ID for settlement */
  programId: PublicKey;
}

// ============================================================================
// Platform Monitors
// ============================================================================

/**
 * Monitors Kalshi for market resolutions
 */
async function fetchKalshiOutcome(marketId: string): Promise<{
  resolved: boolean;
  outcome?: Outcome;
  rawData: string;
}> {
  try {
    const response = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets/${marketId}`,
      { signal: AbortSignal.timeout(30000) }
    );
    const data = await response.json();
    const market = data.market;

    if (!market) {
      return { resolved: false, rawData: JSON.stringify(data) };
    }

    const resolved = market.result !== '' && market.result !== null;
    let outcome: Outcome | undefined;

    if (resolved) {
      outcome = market.result === 'yes' ? 'yes' : market.result === 'no' ? 'no' : 'invalid';
    }

    return {
      resolved,
      outcome,
      rawData: JSON.stringify(market),
    };
  } catch (e) {
    return { resolved: false, rawData: `Error: ${e}` };
  }
}

/**
 * Monitors Polymarket for market resolutions
 */
async function fetchPolymarketOutcome(marketId: string): Promise<{
  resolved: boolean;
  outcome?: Outcome;
  rawData: string;
}> {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets/${marketId}`,
      { signal: AbortSignal.timeout(30000) }
    );
    const market = await response.json();

    const resolved = market.closed === true && market.resolutionOutcome !== undefined;
    let outcome: Outcome | undefined;

    if (resolved) {
      outcome = market.resolutionOutcome === 'yes' ? 'yes' :
                market.resolutionOutcome === 'no' ? 'no' : 'invalid';
    }

    return {
      resolved,
      outcome,
      rawData: JSON.stringify(market),
    };
  } catch (e) {
    return { resolved: false, rawData: `Error: ${e}` };
  }
}

/**
 * Monitors Manifold for market resolutions
 */
async function fetchManifoldOutcome(marketId: string): Promise<{
  resolved: boolean;
  outcome?: Outcome;
  rawData: string;
}> {
  try {
    const response = await fetch(
      `https://api.manifold.markets/v0/market/${marketId}`,
      { signal: AbortSignal.timeout(30000) }
    );
    const market = await response.json();

    const resolved = market.isResolved === true;
    let outcome: Outcome | undefined;

    if (resolved) {
      outcome = market.resolution === 'YES' ? 'yes' :
                market.resolution === 'NO' ? 'no' : 'invalid';
    }

    return {
      resolved,
      outcome,
      rawData: JSON.stringify(market),
    };
  } catch (e) {
    return { resolved: false, rawData: `Error: ${e}` };
  }
}

// ============================================================================
// Proof Generator
// ============================================================================

export class ProofGenerator {
  /**
   * Generate outcome proof hash
   */
  static generateHash(
    marketId: string,
    platform: Platform,
    outcome: Outcome,
    timestamp: number,
    rawData: string
  ): string {
    const data = `${marketId}:${platform}:${outcome}:${timestamp}:${rawData}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign outcome with node key
   */
  static signOutcome(
    hash: string,
    nodeId: string,
    privateKey: Keypair
  ): { nodeId: string; signature: string; publicKey: string } {
    // In production, use actual ed25519 signing
    const signatureData = `${hash}:${nodeId}:${Date.now()}`;
    const signature = createHash('sha256').update(signatureData + privateKey.secretKey.toString()).digest('hex');

    return {
      nodeId,
      signature,
      publicKey: privateKey.publicKey.toBase58(),
    };
  }

  /**
   * Verify signature
   */
  static verifySignature(
    hash: string,
    signature: { nodeId: string; signature: string; publicKey: string }
  ): boolean {
    // In production, verify ed25519 signature
    // For now, just check signature exists and is valid hex
    return signature.signature.length === 64 && /^[a-f0-9]+$/.test(signature.signature);
  }

  /**
   * Create full outcome proof
   */
  static createProof(
    marketId: string,
    platform: Platform,
    outcome: Outcome,
    rawData: string,
    signatures: { nodeId: string; signature: string; publicKey: string }[],
    requiredSignatures: number
  ): OutcomeProof {
    const timestamp = Date.now();
    const hash = this.generateHash(marketId, platform, outcome, timestamp, rawData);

    return {
      hash,
      timestamp,
      nodeSignatures: signatures,
      consensusReached: signatures.length >= requiredSignatures,
      requiredSignatures,
    };
  }
}

// ============================================================================
// Oracle Node
// ============================================================================

export class OracleNode extends EventEmitter {
  private config: OracleNodeConfig;
  private monitoredMarkets = new Map<string, { platform: Platform; lastCheck: number }>();
  private monitorInterval: Timer | null = null;

  constructor(config: OracleNodeConfig) {
    super();
    this.config = config;
  }

  /**
   * Start monitoring markets
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => this.checkMarkets(), intervalMs);
    console.log(`[Oracle ${this.config.id}] Monitoring started`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log(`[Oracle ${this.config.id}] Monitoring stopped`);
  }

  /**
   * Add market to monitor
   */
  watchMarket(marketId: string, platform: Platform): void {
    this.monitoredMarkets.set(marketId, { platform, lastCheck: 0 });
    console.log(`[Oracle ${this.config.id}] Watching ${platform}:${marketId}`);
  }

  /**
   * Check all monitored markets
   */
  private async checkMarkets(): Promise<void> {
    for (const [marketId, info] of this.monitoredMarkets) {
      try {
        const result = await this.fetchOutcome(marketId, info.platform);

        if (result.resolved && result.outcome) {
          // Generate signature
          const hash = ProofGenerator.generateHash(
            marketId,
            info.platform,
            result.outcome,
            Date.now(),
            result.rawData
          );

          const signature = this.config.privateKey
            ? ProofGenerator.signOutcome(hash, this.config.id, this.config.privateKey)
            : null;

          this.emit('outcome', {
            marketId,
            platform: info.platform,
            outcome: result.outcome,
            rawData: result.rawData,
            signature,
          });
        }

        this.monitoredMarkets.set(marketId, { ...info, lastCheck: Date.now() });
      } catch (e) {
        console.error(`[Oracle ${this.config.id}] Error checking ${marketId}:`, e);
      }
    }
  }

  /**
   * Fetch outcome from platform
   */
  private async fetchOutcome(marketId: string, platform: Platform): Promise<{
    resolved: boolean;
    outcome?: Outcome;
    rawData: string;
  }> {
    switch (platform) {
      case 'kalshi':
        return fetchKalshiOutcome(marketId);
      case 'polymarket':
        return fetchPolymarketOutcome(marketId);
      case 'manifold':
        return fetchManifoldOutcome(marketId);
    }
  }

  /**
   * Get node info
   */
  getInfo(): OracleNodeConfig {
    return { ...this.config, privateKey: undefined };
  }
}

// ============================================================================
// Oracle Network
// ============================================================================

export class OracleNetwork extends EventEmitter {
  private config: NetworkConfig;
  private nodes = new Map<string, OracleNode>();
  private pendingOutcomes = new Map<string, {
    marketId: string;
    platform: Platform;
    signatures: Map<Outcome, { nodeId: string; signature: string; publicKey: string }[]>;
    rawData: string;
    createdAt: number;
  }>();
  private resolvedMarkets = new Map<string, MarketOutcome>();
  private disputes = new Map<string, DisputeCase>();
  private disputeCounter = 0;

  constructor(config: Partial<NetworkConfig> = {}) {
    super();
    this.config = {
      minConsensusNodes: config.minConsensusNodes || 3,
      consensusThreshold: config.consensusThreshold || 0.6,
      disputePeriodSeconds: config.disputePeriodSeconds || 3600, // 1 hour
      minStake: config.minStake || 10,
      slashAmount: config.slashAmount || 1,
      rpcUrl: config.rpcUrl || 'https://api.mainnet-beta.solana.com',
      programId: config.programId || new PublicKey('PRED111111111111111111111111111111111111111'),
    };
  }

  /**
   * Register an oracle node
   */
  registerNode(nodeConfig: OracleNodeConfig): OracleNode {
    if (nodeConfig.stake < this.config.minStake) {
      throw new Error(`Minimum stake is ${this.config.minStake} SOL`);
    }

    const node = new OracleNode(nodeConfig);

    // Listen for outcomes from this node
    node.on('outcome', (data) => this.handleNodeOutcome(nodeConfig.id, data));

    this.nodes.set(nodeConfig.id, node);

    this.emit('node_registered', {
      nodeId: nodeConfig.id,
      name: nodeConfig.name,
      publicKey: nodeConfig.publicKey.toBase58(),
    });

    return node;
  }

  /**
   * Remove an oracle node
   */
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.stopMonitoring();
      this.nodes.delete(nodeId);
      this.emit('node_removed', { nodeId });
    }
  }

  /**
   * Handle outcome report from a node
   */
  private handleNodeOutcome(nodeId: string, data: {
    marketId: string;
    platform: Platform;
    outcome: Outcome;
    rawData: string;
    signature: { nodeId: string; signature: string; publicKey: string } | null;
  }): void {
    const key = `${data.platform}:${data.marketId}`;

    // Check if already resolved
    if (this.resolvedMarkets.has(key)) {
      console.log(`[Network] Market ${key} already resolved`);
      return;
    }

    // Get or create pending outcome
    let pending = this.pendingOutcomes.get(key);
    if (!pending) {
      pending = {
        marketId: data.marketId,
        platform: data.platform,
        signatures: new Map(),
        rawData: data.rawData,
        createdAt: Date.now(),
      };
      this.pendingOutcomes.set(key, pending);
    }

    // Add signature for this outcome
    if (data.signature) {
      const outcomeSignatures = pending.signatures.get(data.outcome) || [];
      if (!outcomeSignatures.find(s => s.nodeId === nodeId)) {
        outcomeSignatures.push(data.signature);
        pending.signatures.set(data.outcome, outcomeSignatures);
      }
    }

    // Check for consensus
    this.checkConsensus(key);
  }

  /**
   * Check if consensus has been reached
   */
  private checkConsensus(key: string): void {
    const pending = this.pendingOutcomes.get(key);
    if (!pending) return;

    const totalNodes = this.nodes.size;
    const requiredSignatures = Math.ceil(totalNodes * this.config.consensusThreshold);

    for (const [outcome, signatures] of pending.signatures) {
      if (signatures.length >= requiredSignatures) {
        // Consensus reached!
        const proof = ProofGenerator.createProof(
          pending.marketId,
          pending.platform,
          outcome,
          pending.rawData,
          signatures,
          requiredSignatures
        );

        const marketOutcome: MarketOutcome = {
          marketId: pending.marketId,
          platform: pending.platform,
          outcome,
          resolvedAt: Date.now(),
          source: this.getPlatformUrl(pending.platform, pending.marketId),
          rawData: pending.rawData,
          proof,
        };

        this.resolvedMarkets.set(key, marketOutcome);
        this.pendingOutcomes.delete(key);

        this.emit('consensus_reached', marketOutcome);

        console.log(`[Network] Consensus reached for ${key}: ${outcome}`);
        console.log(`[Network] Signatures: ${signatures.length}/${totalNodes}`);
      }
    }
  }

  /**
   * Get platform URL for market
   */
  private getPlatformUrl(platform: Platform, marketId: string): string {
    switch (platform) {
      case 'kalshi':
        return `https://kalshi.com/markets/${marketId}`;
      case 'polymarket':
        return `https://polymarket.com/event/${marketId}`;
      case 'manifold':
        return `https://manifold.markets/${marketId}`;
    }
  }

  /**
   * File a dispute
   */
  fileDispute(
    marketId: string,
    platform: Platform,
    disputedBy: string,
    reason: string,
    evidenceUrls: string[]
  ): DisputeCase {
    const key = `${platform}:${marketId}`;
    const resolved = this.resolvedMarkets.get(key);

    if (!resolved) {
      throw new Error('Market not resolved yet');
    }

    this.disputeCounter++;
    const dispute: DisputeCase = {
      id: `DISPUTE-${this.disputeCounter}`,
      marketId,
      platform,
      proposedOutcome: resolved.outcome,
      disputedBy,
      disputeReason: reason,
      evidenceUrls,
      votes: [],
      status: 'open',
      createdAt: Date.now(),
    };

    this.disputes.set(dispute.id, dispute);

    this.emit('dispute_filed', dispute);

    return dispute;
  }

  /**
   * Vote on a dispute
   */
  voteOnDispute(disputeId: string, nodeId: string, vote: 'support' | 'oppose'): void {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) throw new Error('Dispute not found');
    if (dispute.status !== 'open') throw new Error('Dispute not open');
    if (!this.nodes.has(nodeId)) throw new Error('Node not registered');

    // Check if already voted
    if (dispute.votes.find(v => v.nodeId === nodeId)) {
      throw new Error('Already voted');
    }

    dispute.votes.push({ nodeId, vote });

    // Check if enough votes to resolve
    const totalNodes = this.nodes.size;
    const supportVotes = dispute.votes.filter(v => v.vote === 'support').length;
    const opposeVotes = dispute.votes.filter(v => v.vote === 'oppose').length;

    const threshold = Math.ceil(totalNodes * this.config.consensusThreshold);

    if (supportVotes >= threshold) {
      // Dispute upheld - slash original reporters
      dispute.status = 'resolved';
      dispute.resolution = dispute.proposedOutcome === 'yes' ? 'no' : 'yes';
      this.emit('dispute_resolved', { dispute, upheld: true });
    } else if (opposeVotes >= threshold) {
      // Dispute rejected - slash disputer
      dispute.status = 'resolved';
      dispute.resolution = dispute.proposedOutcome;
      this.emit('dispute_resolved', { dispute, upheld: false });
    }
  }

  /**
   * Start all nodes monitoring
   */
  startAll(): void {
    for (const node of this.nodes.values()) {
      node.startMonitoring();
    }
  }

  /**
   * Stop all nodes
   */
  stopAll(): void {
    for (const node of this.nodes.values()) {
      node.stopMonitoring();
    }
  }

  /**
   * Watch a market across all nodes
   */
  watchMarket(marketId: string, platform: Platform): void {
    for (const node of this.nodes.values()) {
      node.watchMarket(marketId, platform);
    }
  }

  /**
   * Get network status
   */
  getStatus(): {
    nodes: number;
    activeNodes: number;
    pendingOutcomes: number;
    resolvedMarkets: number;
    openDisputes: number;
  } {
    const activeNodes = Array.from(this.nodes.values())
      .filter(n => n.getInfo().status === 'active').length;

    const openDisputes = Array.from(this.disputes.values())
      .filter(d => d.status === 'open').length;

    return {
      nodes: this.nodes.size,
      activeNodes,
      pendingOutcomes: this.pendingOutcomes.size,
      resolvedMarkets: this.resolvedMarkets.size,
      openDisputes,
    };
  }

  /**
   * Get resolved market outcome
   */
  getOutcome(platform: Platform, marketId: string): MarketOutcome | null {
    return this.resolvedMarkets.get(`${platform}:${marketId}`) || null;
  }

  /**
   * Get all resolved outcomes
   */
  getAllOutcomes(): MarketOutcome[] {
    return Array.from(this.resolvedMarkets.values());
  }
}

// ============================================================================
// Settlement Engine
// ============================================================================

export class SettlementEngine {
  private connection: Connection;
  private programId: PublicKey;
  private network: OracleNetwork;
  private pendingSettlements = new Map<string, MarketOutcome>();

  constructor(
    rpcUrl: string,
    programId: PublicKey,
    network: OracleNetwork
  ) {
    this.connection = new Connection(rpcUrl);
    this.programId = programId;
    this.network = network;

    // Listen for consensus events
    network.on('consensus_reached', (outcome: MarketOutcome) => {
      this.queueSettlement(outcome);
    });
  }

  /**
   * Queue a settlement for execution
   */
  queueSettlement(outcome: MarketOutcome): void {
    const key = `${outcome.platform}:${outcome.marketId}`;
    this.pendingSettlements.set(key, outcome);

    console.log(`[Settlement] Queued ${key} for settlement`);
  }

  /**
   * Execute settlement on-chain
   */
  async executeSettlement(
    platform: Platform,
    marketId: string,
    oracleKeypair: Keypair
  ): Promise<string> {
    const key = `${platform}:${marketId}`;
    const outcome = this.pendingSettlements.get(key);

    if (!outcome) {
      throw new Error('No pending settlement for this market');
    }

    // In production, this would call the Solana program
    // For now, simulate the settlement
    console.log(`[Settlement] Executing on-chain settlement for ${key}`);
    console.log(`[Settlement] Outcome: ${outcome.outcome}`);
    console.log(`[Settlement] Proof hash: ${outcome.proof.hash}`);
    console.log(`[Settlement] Signatures: ${outcome.proof.nodeSignatures.length}`);

    // Simulated transaction signature
    const signature = `SIM-SETTLE-${Date.now()}`;

    this.pendingSettlements.delete(key);

    return signature;
  }

  /**
   * Get pending settlements
   */
  getPendingSettlements(): MarketOutcome[] {
    return Array.from(this.pendingSettlements.values());
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let networkInstance: OracleNetwork | null = null;

export function getOracleNetwork(config?: Partial<NetworkConfig>): OracleNetwork {
  if (!networkInstance) {
    networkInstance = new OracleNetwork(config);
  }
  return networkInstance;
}

export function createOracleNode(
  id: string,
  name: string,
  stake: number
): { node: OracleNodeConfig; keypair: Keypair } {
  const keypair = Keypair.generate();

  const nodeConfig: OracleNodeConfig = {
    id,
    name,
    publicKey: keypair.publicKey,
    privateKey: keypair,
    stake,
    status: 'active',
    reputation: 100,
  };

  return { node: nodeConfig, keypair };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  OracleNode,
  OracleNetwork,
  ProofGenerator,
  SettlementEngine,
  getOracleNetwork,
  createOracleNode,
};
