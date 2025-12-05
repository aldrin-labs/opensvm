/**
 * Investigation Agent Orchestrator
 *
 * The main orchestration layer that:
 * 1. Plans investigations using strategies
 * 2. Executes tool calls against the MCP server
 * 3. Analyzes results and detects anomalies
 * 4. Generates investigation reports
 */

import type {
  InvestigationType,
  InvestigationTarget,
  InvestigationConfig,
  InvestigationState,
  InvestigationStep,
  InvestigationPlan,
  InvestigationReport,
  WalletProfile,
  TransactionSummary,
  AnomalyFinding,
  RiskIndicator,
  RiskLevel,
  ToolCallResult,
  Evidence,
  ConnectionPath,
  TokenTransfer,
  StreamCallback,
  StreamEvent,
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphNodeStatus,
  GraphLayoutConfig,
  NarrationEvent,
} from './types';

import { LAYOUT_RECOMMENDATIONS } from './types';

import { createInvestigationPlan, DEFAULT_CONFIG } from './strategies';
import { detectAnomalies, calculateRiskScore, categorizeRisk } from './anomaly-detector';
import { generateReport } from './report-generator';
import {
  lookupEntity,
  getEntityLabel,
  describeEntity,
  analyzeCounterparties,
  isExchange,
  isDEX,
  isDangerous,
  type KnownEntity,
} from './known-entities';

/**
 * Solana Network Benchmark Data
 * Used for comparative analysis - updated periodically
 */
const SOLANA_BENCHMARKS = {
  // Transaction metrics (based on typical Solana activity)
  avgDailyTxPerWallet: 5,       // Average active wallet
  highFrequencyThreshold: 50,   // Tx/day considered high frequency
  whaleThreshold: 100000,       // USD portfolio value
  megaWhaleThreshold: 1000000,  // USD portfolio value

  // Timing patterns
  avgBlockTime: 400,            // ms
  typicalTxGap: 60000,          // ms between transactions for normal users
  botTxGap: 1000,               // ms - faster indicates bot

  // Risk thresholds
  normalFailureRate: 0.05,      // 5% failure is normal
  suspiciousFailureRate: 0.2,   // 20% failure is suspicious

  // DEX activity
  avgSwapsPerTrader: 10,        // Per week for active traders
  heavyTraderSwaps: 50,         // Per week

  // Token metrics
  avgTokensHeld: 5,             // Normal diversified wallet
  manyTokensThreshold: 20,      // Could be airdrop farmer
  extremeTokensThreshold: 50,   // Likely bot or farmer

  // Fee benchmarks (in SOL)
  avgPriorityFee: 0.00001,
  highPriorityFee: 0.001,
  mevBotFee: 0.01,              // MEV bots pay high fees
};

/**
 * Price Impact Analysis Thresholds
 * For detecting front-running and sandwich attacks
 */
const PRICE_IMPACT_THRESHOLDS = {
  normalImpact: 0.01,           // 1% is normal
  highImpact: 0.03,             // 3% is high
  severeImpact: 0.05,           // 5% is severe - likely sandwich attack

  // Timing for sandwich detection
  sandwichWindowMs: 2000,       // Transactions within 2s could be sandwich
  frontrunWindowMs: 500,        // 500ms is typical frontrun timing
};

const DEFAULT_API_URL = 'https://osvm.ai';
const DEFAULT_TIMEOUT = 30000;

/**
 * MCP Tool Caller
 *
 * Makes API calls to the MCP server or directly to OpenSVM APIs
 */
class ToolCaller {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = DEFAULT_API_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  async call(tool: string, params: Record<string, any>): Promise<ToolCallResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeToolCall(tool, params);
      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeToolCall(tool: string, params: Record<string, any>): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = this.getApiUrl(tool, params);
      const method = this.getMethod(tool);
      const body = method === 'POST' ? JSON.stringify(params) : undefined;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private getApiUrl(tool: string, params: Record<string, any>): string {
    const base = this.baseUrl;

    // Map tools to API endpoints
    const toolEndpoints: Record<string, (p: Record<string, any>) => string> = {
      get_transaction: (p) => `${base}/api/transaction/${p.signature}`,
      explain_transaction: (p) => `${base}/api/transaction/${p.signature}/explain`,
      analyze_transaction: (p) => `${base}/api/transaction/${p.signature}/analysis`,
      get_account_portfolio: (p) => `${base}/api/account-portfolio/${p.address}`,
      get_account_transactions: (p) => {
        const url = new URL(`${base}/api/account-transactions/${p.address}`);
        if (p.limit) url.searchParams.set('limit', String(p.limit));
        return url.toString();
      },
      get_account_stats: (p) => `${base}/api/account-stats/${p.address}`,
      get_blocks: (p) => {
        const url = new URL(`${base}/api/blocks`);
        if (p.limit) url.searchParams.set('limit', String(p.limit));
        if (p.before) url.searchParams.set('before', String(p.before));
        return url.toString();
      },
      get_block: (p) => `${base}/api/blocks/${p.slot}`,
      get_token_ohlcv: (p) => {
        const url = new URL(`${base}/api/market-data`);
        url.searchParams.set('endpoint', 'ohlcv');
        url.searchParams.set('mint', p.mint);
        if (p.type) url.searchParams.set('type', p.type);
        return url.toString();
      },
      get_token_markets: (p) => {
        const url = new URL(`${base}/api/market-data`);
        url.searchParams.set('endpoint', 'markets');
        url.searchParams.set('mint', p.mint);
        return url.toString();
      },
      get_token_metadata: (p) => `${base}/api/token-metadata?mint=${p.mint}`,
      get_program: (p) => `${base}/api/program/${p.address}`,
      search: (p) => `${base}/api/search-suggestions?q=${encodeURIComponent(p.query)}`,
      find_wallet_path: (p) => `${base}/api/wallet-path-finding`,
      get_network_status: () => `${base}/api/status`,
      get_nft_collections: (p) =>
        p.type === 'new' ? `${base}/api/nft-collections/new` : `${base}/api/nft-collections/trending`,
      ask_ai: () => `${base}/api/getAnswer`,

      // Composite tools (implemented locally)
      analyze_transactions_batch: (p) => `${base}/api/account-transactions/${p.address}`,
      get_related_transactions: (p) => `${base}/api/transaction/${p.signature}/related`,
      find_connected_wallets: (p) => `${base}/api/wallet-path-finding`,
    };

    const endpoint = toolEndpoints[tool];
    if (!endpoint) {
      // Default to generic API call
      return `${base}/api/${tool}`;
    }

    return endpoint(params);
  }

  private getMethod(tool: string): 'GET' | 'POST' {
    const postTools = ['find_wallet_path', 'ask_ai'];
    return postTools.includes(tool) ? 'POST' : 'GET';
  }
}

/**
 * Investigation Agent Orchestrator
 */
export class InvestigationOrchestrator {
  private toolCaller: ToolCaller;
  private state: InvestigationState | null = null;
  private streamCallback: StreamCallback | null = null;
  private graphNodes: Map<string, GraphNode> = new Map();
  private graphEdges: Map<string, GraphEdge> = new Map();
  private edgeCounter: number = 0;

  constructor(apiUrl?: string, timeout?: number, streamCallback?: StreamCallback) {
    this.toolCaller = new ToolCaller(apiUrl, timeout);
    this.streamCallback = streamCallback || null;
  }

  /**
   * Set stream callback for real-time updates
   */
  setStreamCallback(callback: StreamCallback | null): void {
    this.streamCallback = callback;
  }

  /**
   * Emit a stream event
   */
  private emit(type: StreamEvent['type'], data: any): void {
    if (this.streamCallback && this.state) {
      this.streamCallback({
        type,
        timestamp: Date.now(),
        investigationId: this.state.id,
        data,
      });
    }
  }

  /**
   * Add a node to the graph and emit event
   */
  private addGraphNode(node: GraphNode): void {
    if (this.graphNodes.has(node.id)) {
      // Update existing node
      const existing = this.graphNodes.get(node.id)!;
      const updated = { ...existing, ...node, metadata: { ...existing.metadata, ...node.metadata } };
      this.graphNodes.set(node.id, updated);
      this.emit('graph_update', { action: 'update_node', node: updated });
    } else {
      this.graphNodes.set(node.id, node);
      this.emit('graph_node', node);
    }
  }

  /**
   * Add an edge to the graph and emit event
   */
  private addGraphEdge(edge: Omit<GraphEdge, 'id'>): void {
    const id = `edge_${++this.edgeCounter}`;
    const fullEdge: GraphEdge = { ...edge, id };

    // Check for duplicate edges
    for (const existing of this.graphEdges.values()) {
      if (existing.source === edge.source && existing.target === edge.target && existing.type === edge.type) {
        return; // Skip duplicate
      }
    }

    this.graphEdges.set(id, fullEdge);
    this.emit('graph_edge', fullEdge);
  }

  /**
   * Highlight a node in the graph
   */
  private highlightNode(nodeId: string, status: GraphNodeStatus = 'highlighted'): void {
    const node = this.graphNodes.get(nodeId);
    if (node) {
      node.status = status;
      this.emit('graph_highlight', { nodeId, status });
    }
  }

  /**
   * Create wallet node
   */
  private createWalletNode(address: string, status: GraphNodeStatus = 'normal', metadata?: any): GraphNode {
    return {
      id: `wallet_${address.slice(0, 8)}`,
      type: 'wallet',
      label: `${address.slice(0, 4)}...${address.slice(-4)}`,
      status,
      metadata: {
        address,
        ...metadata,
      },
    };
  }

  /**
   * Create transaction node
   */
  private createTransactionNode(signature: string, status: GraphNodeStatus = 'normal', metadata?: any): GraphNode {
    return {
      id: `tx_${signature.slice(0, 8)}`,
      type: 'transaction',
      label: `TX ${signature.slice(0, 6)}...`,
      status,
      metadata: {
        signature,
        ...metadata,
      },
    };
  }

  /**
   * Create token node
   */
  private createTokenNode(mint: string, symbol: string, status: GraphNodeStatus = 'normal', metadata?: any): GraphNode {
    return {
      id: `token_${mint.slice(0, 8)}`,
      type: 'token',
      label: symbol || mint.slice(0, 6),
      status,
      metadata: {
        address: mint,
        symbol,
        ...metadata,
      },
    };
  }

  /**
   * Emit graph layout recommendation
   */
  private emitLayoutHint(investigationType: string, centerNodeId?: string): void {
    const layoutConfig = LAYOUT_RECOMMENDATIONS[investigationType] || LAYOUT_RECOMMENDATIONS.full_investigation;

    this.emit('graph_layout', {
      ...layoutConfig,
      centerNodeId: centerNodeId || (this.state ? `wallet_${this.state.target.address.slice(0, 8)}` : undefined),
    });
  }

  /**
   * Emit narration event for storytelling
   */
  private narrate(
    text: string,
    emphasis: NarrationEvent['emphasis'] = 'normal',
    relatedNodeIds?: string[],
    relatedEdgeIds?: string[]
  ): void {
    this.emit('narration', {
      text,
      emphasis,
      relatedNodeIds,
      relatedEdgeIds,
      timestamp: Date.now(),
    } as NarrationEvent);
  }

  /**
   * Generate human-readable description for a wallet
   */
  private describeWallet(address: string, profile?: WalletProfile): string {
    const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`;
    if (!profile) return `wallet ${shortAddr}`;

    const parts = [shortAddr];
    if (profile.totalValueUsd) {
      parts.push(`worth $${profile.totalValueUsd.toLocaleString()}`);
    }
    if (profile.tokenCount > 0) {
      parts.push(`holding ${profile.tokenCount} tokens`);
    }
    return parts.join(', ');
  }

  /**
   * Generate human-readable description for a transaction
   */
  private describeTransaction(tx: TransactionSummary): string {
    const parts = [];
    if (tx.type && tx.type !== 'unknown') {
      parts.push(tx.type);
    }
    if (tx.solTransferred > 0) {
      parts.push(`transferring ${tx.solTransferred.toFixed(2)} SOL`);
    }
    if (!tx.success) {
      parts.push('(failed)');
    }
    return parts.length > 0 ? parts.join(' ') : 'transaction';
  }

  /**
   * Generate narration for anomaly findings - WITH SPECIFIC EVIDENCE
   */
  private narrateAnomaly(anomaly: AnomalyFinding): string {
    const parts: string[] = [];

    // Severity prefix
    const severityPrefix: Record<string, string> = {
      low: '',
      medium: 'Noteworthy: ',
      high: 'RED FLAG: ',
      critical: 'CRITICAL ALERT: ',
    };
    parts.push(severityPrefix[anomaly.severity] || '');

    // Type-specific detailed narration
    switch (anomaly.type) {
      case 'rapid_transactions':
        parts.push(`${anomaly.affectedEntities.length} transactions occurred within seconds of each other - typical bot or MEV activity`);
        break;

      case 'high_failure_rate':
        const failCount = anomaly.evidence.find(e => e.type === 'pattern')?.data?.failedCount || 'multiple';
        parts.push(`${failCount} failed transactions detected - could indicate frontrunning attempts or slippage issues`);
        break;

      case 'wash_trading':
        parts.push(`Circular token movements detected between ${anomaly.affectedEntities.length} addresses - possible volume manipulation`);
        break;

      case 'new_wallet_large_transfer':
        const amount = anomaly.evidence.find(e => e.type === 'volume')?.data?.amount || 'large';
        parts.push(`New wallet (< 7 days old) moved ${amount} - high risk of scam or rugpull`);
        break;

      case 'concentration_risk':
        parts.push(`Single token represents >80% of portfolio - high exposure to price movements`);
        break;

      case 'unusual_program_interaction':
        const programs = anomaly.evidence.find(e => e.type === 'pattern')?.data?.programs || [];
        parts.push(`Interacted with ${programs.length} unverified programs - potential smart contract risk`);
        break;

      case 'dormant_wallet_activation':
        const dormantDays = anomaly.evidence.find(e => e.type === 'timing')?.data?.dormantDays || 'many';
        parts.push(`Wallet inactive for ${dormantDays} days suddenly became active - possible compromised wallet`);
        break;

      case 'token_drain':
        parts.push(`Rapid outflow of tokens detected - ${anomaly.affectedEntities.length} assets moved in short period`);
        break;

      case 'mixer_interaction':
        parts.push(`Funds passed through known mixing service - attempts to obscure transaction trail`);
        break;

      case 'sybil_pattern':
        parts.push(`Multiple wallets showing coordinated activity - potential sybil attack or airdrop farming`);
        break;

      default:
        // Fall back to description if type not recognized
        parts.push(anomaly.description);
    }

    // Add evidence summary if available
    if (anomaly.evidence.length > 0 && anomaly.confidence < 0.9) {
      parts.push(` (confidence: ${(anomaly.confidence * 100).toFixed(0)}%)`);
    }

    return parts.join('');
  }

  /**
   * Start a new investigation
   */
  async startInvestigation(
    type: InvestigationType,
    target: InvestigationTarget,
    config: Partial<InvestigationConfig> = {}
  ): Promise<InvestigationState> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    // Create the investigation plan
    const plan = createInvestigationPlan(type, target, fullConfig);

    // Initialize state
    this.state = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'planning',
      type,
      target,
      config: fullConfig,
      plan,
      currentStep: 0,
      walletProfiles: new Map(),
      transactions: [],
      tokenFlows: [],
      connections: [],
      anomalies: [],
      riskScore: 0,
      riskLevel: 'low',
      startedAt: Date.now(),
      completedAt: null,
      duration: 0,
      toolCallCount: 0,
      errors: [],
    };

    // Emit start event
    this.emit('start', {
      id: this.state.id,
      type,
      target: target.address,
      targetType: target.type,
      config: fullConfig,
    });

    // Emit layout hint based on investigation type
    this.emitLayoutHint(type);

    // Simple start - no fluff, the insights will come from data
    const targetShort = `${target.address.slice(0, 4)}...${target.address.slice(-4)}`;
    this.narrate(
      `Investigating ${targetShort}`,
      'normal',
      [`wallet_${target.address.slice(0, 8)}`]
    );

    // Emit planning event
    this.emit('planning', {
      totalSteps: plan.steps.length,
      estimatedDuration: plan.estimatedDuration,
      tools: plan.steps.map(s => s.tool),
    });

    return this.state;
  }

  /**
   * Execute the investigation plan
   */
  async execute(): Promise<InvestigationState> {
    if (!this.state || !this.state.plan) {
      throw new Error('No investigation started');
    }

    this.state.status = 'gathering_data';
    this.emit('progress', {
      status: 'gathering_data',
      message: 'Starting data collection...',
    });
    // No fluff narration here - insights come from actual data

    // Execute each step in the plan
    for (let i = 0; i < this.state.plan.steps.length; i++) {
      this.state.currentStep = i;
      const step = this.state.plan.steps[i];

      // Update step status
      step.status = 'running';

      console.log(`[Investigation] Step ${i + 1}/${this.state.plan.steps.length}: ${step.purpose}`);

      // Emit tool_call event before execution
      this.emit('tool_call', {
        step: i + 1,
        totalSteps: this.state.plan.steps.length,
        tool: step.tool,
        params: step.params,
        purpose: step.purpose,
      });

      // No fluff narration for tool calls - just emit the event
      // Real insights come from the results

      // Execute the tool
      const result = await this.toolCaller.call(step.tool, step.params);
      this.state.toolCallCount++;

      // Record result
      step.duration = result.duration;

      if (result.success) {
        step.status = 'completed';
        step.result = result.data;

        // Emit tool_result event
        const summary = this.summarizeToolResult(step.tool, result.data);
        this.emit('tool_result', {
          step: i + 1,
          tool: step.tool,
          success: true,
          duration: result.duration,
          summary,
        });

        // Narrate the result
        this.narrate(summary);

        // Process the result based on tool type
        await this.processToolResult(step.tool, step.params, result.data);
      } else {
        step.status = 'failed';
        step.error = result.error;
        this.state.errors.push(`Step ${step.id} failed: ${result.error}`);

        // Emit error event for failed tool
        this.emit('error', {
          step: i + 1,
          tool: step.tool,
          error: result.error,
          recoverable: true,
        });
      }
    }

    // Analyze gathered data
    this.state.status = 'analyzing';
    this.emit('analysis', {
      status: 'analyzing',
      message: 'Analyzing collected data...',
      transactionsCount: this.state.transactions.length,
      walletsCount: this.state.walletProfiles.size,
    });

    await this.analyzeData();

    // Detect anomalies
    this.state.status = 'detecting_anomalies';
    this.emit('progress', {
      status: 'detecting_anomalies',
      message: 'Running anomaly detection...',
    });

    await this.runAnomalyDetection();

    // Only narrate if anomalies found - no "nothing found" fluff
    if (this.state.anomalies.length > 0) {
      this.narrate(
        `Detected ${this.state.anomalies.length} suspicious ${this.state.anomalies.length === 1 ? 'pattern' : 'patterns'}:`,
        'important'
      );
    }

    for (const anomaly of this.state.anomalies) {
      this.emit('anomaly', {
        id: anomaly.id,
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
        confidence: anomaly.confidence,
        affectedEntities: anomaly.affectedEntities,
      });

      // Narrate each anomaly
      this.narrate(
        this.narrateAnomaly(anomaly),
        anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'critical' : 'important',
        anomaly.affectedEntities.map(e => `wallet_${e.slice(0, 8)}`)
      );
    }

    // Calculate final risk score
    this.state.riskScore = calculateRiskScore(this.state);
    this.state.riskLevel = categorizeRisk(this.state.riskScore);

    // Emit finding event with risk assessment
    this.emit('finding', {
      riskScore: this.state.riskScore,
      riskLevel: this.state.riskLevel,
      anomalyCount: this.state.anomalies.length,
      transactionsAnalyzed: this.state.transactions.length,
    });

    // Complete the investigation
    this.state.status = 'completed';
    this.state.completedAt = Date.now();
    this.state.duration = this.state.completedAt - this.state.startedAt;

    // Final summary - only narrate if there's something meaningful to say
    const summaryParts: string[] = [];

    // Risk level with context
    if (this.state.riskLevel === 'critical') {
      summaryParts.push(`CRITICAL RISK (${this.state.riskScore}/100)`);
    } else if (this.state.riskLevel === 'high') {
      summaryParts.push(`HIGH RISK (${this.state.riskScore}/100)`);
    } else if (this.state.riskLevel === 'medium' && this.state.anomalies.length > 0) {
      summaryParts.push(`Moderate risk - ${this.state.anomalies.length} concerns identified`);
    }
    // Don't narrate "low risk" - that's the default, not an insight

    // Add key findings summary
    if (this.state.walletProfiles.size > 0) {
      const targetProfile = this.state.walletProfiles.get(this.state.target.address);
      if (targetProfile?.totalValueUsd && targetProfile.totalValueUsd > 10000) {
        summaryParts.push(`$${(targetProfile.totalValueUsd/1000).toFixed(0)}K portfolio`);
      }
    }

    if (summaryParts.length > 0) {
      this.narrate(
        summaryParts.join('. '),
        this.state.riskLevel === 'critical' ? 'critical' : this.state.riskLevel === 'high' ? 'important' : 'normal'
      );
    }

    // Emit complete event
    this.emit('complete', {
      id: this.state.id,
      status: 'completed',
      duration: this.state.duration,
      riskScore: this.state.riskScore,
      riskLevel: this.state.riskLevel,
      anomalyCount: this.state.anomalies.length,
      toolCallCount: this.state.toolCallCount,
      errorCount: this.state.errors.length,
    });

    return this.state;
  }

  /**
   * Summarize tool result for streaming - INSIGHT DRIVEN
   */
  private summarizeToolResult(tool: string, data: any): string {
    if (!data) return 'No data returned';

    switch (tool) {
      case 'get_account_portfolio':
        return this.generatePortfolioInsight(data);
      case 'get_account_transactions':
        return this.generateTransactionInsight(data);
      case 'get_transaction':
        return this.generateSingleTxInsight(data);
      case 'find_wallet_path':
        return this.generateConnectionInsight(data);
      case 'get_account_stats':
        return this.generateStatsInsight(data);
      default:
        return 'Data collected';
    }
  }

  /**
   * Generate actual insights from portfolio data
   * Enhanced with entity labels and benchmark comparisons
   */
  private generatePortfolioInsight(data: any): string {
    if (!data?.data) return 'Could not retrieve portfolio';

    const insights: string[] = [];
    const solBalance = data.data.native?.balance || 0;
    const totalValue = data.data.totalValue || 0;
    const tokens = data.data.tokens || [];
    const tokenCount = data.data.totalTokens || tokens.length;

    // Check if this wallet is a known entity
    if (this.state) {
      const entityContext = this.getEntityContext(this.state.target.address);
      if (entityContext) {
        insights.push(`IDENTIFIED: ${entityContext}`);
      }
    }

    // Whale detection with benchmark comparison
    const benchmarkInsights = this.compareToSolanaBenchmarks({
      portfolioValue: totalValue,
      tokenCount: tokenCount,
    });
    insights.push(...benchmarkInsights);

    // Original whale detection as fallback
    if (!benchmarkInsights.some(i => i.includes('WHALE'))) {
      if (totalValue > 1000000) {
        insights.push(`Portfolio worth $${(totalValue / 1000000).toFixed(1)}M`);
      } else if (totalValue > 100000) {
        insights.push(`Large holder: $${(totalValue / 1000).toFixed(0)}K portfolio`);
      } else if (totalValue > 10000) {
        insights.push(`Active trader: $${totalValue.toFixed(0)} portfolio`);
      } else if (totalValue < 100 && solBalance < 0.1) {
        insights.push(`Nearly empty wallet - possible intermediary or burner`);
      }
    }

    // SOL concentration
    const solValue = solBalance * 200; // Approximate SOL price
    if (totalValue > 0 && solValue / totalValue > 0.9) {
      insights.push(`90%+ in SOL - not diversified, possibly new or inactive`);
    }

    // Token analysis with entity checking
    if (tokenCount === 0) {
      insights.push(`No tokens held - pure SOL wallet`);
    }

    // Top holdings with entity identification
    if (tokens.length > 0) {
      const topTokens = tokens
        .filter((t: any) => t.valueUsd > 100)
        .sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0))
        .slice(0, 3);

      if (topTokens.length > 0) {
        const topNames = topTokens.map((t: any) => {
          // Check if token mint is a known entity
          const tokenEntity = t.mint ? lookupEntity(t.mint) : null;
          const name = tokenEntity?.name || t.symbol || 'Unknown';
          return `${name}${t.valueUsd > 10000 ? ` ($${(t.valueUsd/1000).toFixed(0)}K)` : ''}`;
        }).join(', ');
        insights.push(`Top holdings: ${topNames}`);
      }

      // Meme coin detection
      const memeTokens = tokens.filter((t: any) =>
        ['BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'SLERF', 'DOGE', 'SHIB'].includes(t.symbol?.toUpperCase())
      );
      if (memeTokens.length > 2) {
        const memeValue = memeTokens.reduce((sum: number, t: any) => sum + (t.valueUsd || 0), 0);
        insights.push(`Meme coin trader - ${memeTokens.length} meme tokens ($${memeValue.toFixed(0)} total)`);
      }

      // Stablecoin analysis
      const stables = tokens.filter((t: any) =>
        ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD'].includes(t.symbol?.toUpperCase())
      );
      const stableValue = stables.reduce((sum: number, t: any) => sum + (t.valueUsd || 0), 0);
      if (stableValue > totalValue * 0.5) {
        insights.push(`${((stableValue/totalValue)*100).toFixed(0)}% in stablecoins - risk-off position`);
      } else if (stableValue === 0 && totalValue > 1000) {
        insights.push(`Zero stablecoins - full risk-on exposure`);
      }

      // LST (Liquid Staking Token) detection
      const lstTokens = tokens.filter((t: any) =>
        ['MSOL', 'JITOSOL', 'BSOL', 'STSOL'].includes(t.symbol?.toUpperCase())
      );
      if (lstTokens.length > 0) {
        const lstValue = lstTokens.reduce((sum: number, t: any) => sum + (t.valueUsd || 0), 0);
        insights.push(`Staking ${lstTokens.length} LSTs ($${(lstValue/1000).toFixed(1)}K) - earning yield`);
      }
    }

    return insights.length > 0 ? insights.join('. ') + '.' : `${tokenCount} tokens, ${solBalance.toFixed(2)} SOL`;
  }

  /**
   * Generate insights from transaction history
   * Enhanced with entity labels, benchmarks, and MEV detection
   */
  private generateTransactionInsight(data: any): string {
    const transactions = data?.transactions || data?.data || [];
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 'No recent transaction activity - dormant wallet';
    }

    const insights: string[] = [];
    const txCount = transactions.length;
    let txPerDay = 0;
    let failedCount = 0;

    // Activity frequency with benchmark comparison
    if (transactions.length >= 2) {
      const timestamps = transactions.map((tx: any) => tx.timestamp || tx.blockTime).filter(Boolean).sort();
      if (timestamps.length >= 2) {
        const firstTx = timestamps[0];
        const lastTx = timestamps[timestamps.length - 1];
        const daySpan = (lastTx - firstTx) / (1000 * 60 * 60 * 24);
        txPerDay = daySpan > 0 ? txCount / daySpan : txCount;
      }
    }

    // Transaction types breakdown
    const typeCount: Record<string, number> = {};
    const programCount: Record<string, number> = {};
    const counterparties = new Set<string>();
    const counterpartyAddresses: string[] = [];
    let totalSolMoved = 0;
    const knownEntityInteractions: string[] = [];
    const dangerousInteractions: string[] = [];

    for (const tx of transactions) {
      const txType = tx.type || 'unknown';
      typeCount[txType] = (typeCount[txType] || 0) + 1;

      if (tx.programIds) {
        for (const prog of tx.programIds) {
          const label = this.getProgramLabel(prog);
          programCount[label] = (programCount[label] || 0) + 1;

          // Check for dangerous program interactions
          const dangerWarning = this.getDangerWarning(prog);
          if (dangerWarning && !dangerousInteractions.includes(dangerWarning)) {
            dangerousInteractions.push(dangerWarning);
          }
        }
      }

      if (tx.success === false) failedCount++;
      if (tx.solTransferred) totalSolMoved += Math.abs(tx.solTransferred);

      if (tx.counterparties) {
        for (const cp of tx.counterparties) {
          counterparties.add(cp);
          counterpartyAddresses.push(cp);

          // Check if counterparty is a known entity
          const entityLabel = getEntityLabel(cp);
          if (entityLabel && !knownEntityInteractions.includes(entityLabel)) {
            knownEntityInteractions.push(entityLabel);
          }

          // Check for dangerous counterparty
          const dangerWarning = this.getDangerWarning(cp);
          if (dangerWarning && !dangerousInteractions.includes(dangerWarning)) {
            dangerousInteractions.push(dangerWarning);
          }
        }
      }
    }

    // DANGEROUS INTERACTIONS FIRST (most important)
    for (const danger of dangerousInteractions) {
      insights.push(danger);
    }

    // Benchmark comparisons for activity and failure rate
    const failRate = failedCount / txCount;
    const benchmarkInsights = this.compareToSolanaBenchmarks({
      txPerDay,
      failureRate: failRate,
    });
    insights.push(...benchmarkInsights);

    // Known entity interactions summary
    if (knownEntityInteractions.length > 0) {
      const exchanges = knownEntityInteractions.filter(e => !e.includes('DANGEROUS') && !e.includes('CAUTION'));
      if (exchanges.length > 0) {
        insights.push(`Interacted with: ${exchanges.slice(0, 5).join(', ')}${exchanges.length > 5 ? ` +${exchanges.length - 5} more` : ''}`);
      }
    }

    // Analyze counterparty entities
    if (counterpartyAddresses.length > 0) {
      const entityAnalysis = this.analyzeCounterpartyEntities(counterpartyAddresses);
      if (entityAnalysis && entityAnalysis !== 'No known entities identified') {
        insights.push(entityAnalysis);
      }
    }

    // Dominant activity type
    const sortedTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
    if (sortedTypes.length > 0 && sortedTypes[0][1] > txCount * 0.5) {
      insights.push(`Primarily ${sortedTypes[0][0]} activity (${sortedTypes[0][1]}/${txCount})`);
    }

    // DEX activity with entity-aware labels
    const dexPrograms = ['Jupiter Aggregator', 'Orca Whirlpool', 'Raydium AMM', 'Raydium CLMM', 'Meteora DLMM', 'Serum/OpenBook'];
    const dexTxCount = dexPrograms.reduce((sum, dex) => sum + (programCount[dex] || 0), 0);
    if (dexTxCount > txCount * 0.3) {
      insights.push(`Heavy DEX user - ${dexTxCount} swap transactions via known DEXes`);
    }

    // Failure rate analysis (if not already covered by benchmarks)
    if (failedCount > 0 && !benchmarkInsights.some(i => i.includes('Failure'))) {
      const failRatePercent = failRate * 100;
      if (failRatePercent > 20) {
        insights.push(`WARNING: ${failRatePercent.toFixed(0)}% failure rate - possible bot issues or frontrunning`);
      }
    }

    // Price impact / MEV detection
    const mevInsights = this.detectPriceImpactAnomalies(
      transactions.map((tx: any) => ({
        signature: tx.signature,
        timestamp: tx.timestamp || tx.blockTime,
        type: tx.type,
        success: tx.success !== false,
        involvedPrograms: tx.programIds || [],
        solTransferred: tx.solTransferred || 0,
        tokenTransfers: [],
        riskScore: 0,
        flags: [],
      }))
    );
    insights.push(...mevInsights);

    // Volume
    if (totalSolMoved > 1000) {
      insights.push(`Moved ${totalSolMoved.toFixed(0)} SOL total`);
    }

    // Counterparty pattern analysis
    if (counterparties.size > 0) {
      if (counterparties.size < 3 && txCount > 10) {
        insights.push(`SUSPICIOUS: Only ${counterparties.size} counterparties for ${txCount} tx - possible wash trading`);
      } else if (counterparties.size > txCount * 0.8) {
        insights.push(`Diverse counterparties - legitimate trading pattern`);
      }
    }

    return insights.length > 0
      ? insights.join('. ') + '.'
      : `${txCount} transactions analyzed`;
  }

  /**
   * Generate insight from single transaction
   */
  private generateSingleTxInsight(data: any): string {
    if (!data) return 'Transaction data unavailable';

    const insights: string[] = [];

    if (data.success === false) {
      insights.push(`FAILED TRANSACTION: ${data.error || 'unknown error'}`);
    }

    if (data.details?.tokenChanges?.length > 0) {
      const changes = data.details.tokenChanges;
      for (const change of changes.slice(0, 3)) {
        const direction = change.change > 0 ? 'received' : 'sent';
        insights.push(`${direction} ${Math.abs(change.change)} ${change.symbol || 'tokens'}`);
      }
    }

    if (data.details?.solChange) {
      const solChange = data.details.solChange;
      if (Math.abs(solChange) > 1) {
        insights.push(`${solChange > 0 ? 'Received' : 'Sent'} ${Math.abs(solChange).toFixed(2)} SOL`);
      }
    }

    return insights.length > 0 ? insights.join('. ') : 'Transaction examined';
  }

  /**
   * Generate insight from connection path
   */
  private generateConnectionInsight(data: any): string {
    if (!data?.found) {
      return 'No direct connection found between wallets - they may be unrelated';
    }

    const hops = data.depth || data.path?.length - 1 || 0;
    const insights: string[] = [];

    if (hops === 1) {
      insights.push(`DIRECT CONNECTION: These wallets transacted directly`);
    } else if (hops === 2) {
      insights.push(`Close connection: Only 1 intermediary wallet`);
    } else if (hops > 5) {
      insights.push(`Distant connection: ${hops} hops apart - weak relationship`);
    } else {
      insights.push(`Connected via ${hops} intermediate wallets`);
    }

    if (data.path?.length > 0) {
      const intermediaries = data.path.slice(1, -1);
      if (intermediaries.length > 0) {
        insights.push(`Passes through: ${intermediaries.map((a: string) => a.slice(0, 4) + '...').join(' → ')}`);
      }
    }

    return insights.join('. ');
  }

  /**
   * Generate insight from account stats
   */
  private generateStatsInsight(data: any): string {
    if (!data) return 'Stats unavailable';

    const insights: string[] = [];

    if (data.firstTransaction) {
      const age = Date.now() - data.firstTransaction;
      const days = Math.floor(age / (1000 * 60 * 60 * 24));
      if (days < 7) {
        insights.push(`NEW WALLET: Only ${days} days old - exercise caution`);
      } else if (days < 30) {
        insights.push(`Recent wallet: ${days} days old`);
      } else if (days > 365) {
        insights.push(`Established wallet: ${Math.floor(days/365)} years old`);
      }
    }

    if (data.totalTransactions) {
      if (data.totalTransactions > 10000) {
        insights.push(`Very active: ${data.totalTransactions.toLocaleString()} lifetime transactions`);
      }
    }

    return insights.length > 0 ? insights.join('. ') : 'Account statistics analyzed';
  }

  /**
   * Process tool result and extract relevant data
   */
  private async processToolResult(
    tool: string,
    params: Record<string, any>,
    data: any
  ): Promise<void> {
    if (!this.state) return;

    switch (tool) {
      case 'get_account_portfolio':
        this.processPortfolioData(params.address, data);
        break;

      case 'get_account_transactions':
        this.processTransactionData(data);
        break;

      case 'get_transaction':
        this.processTransactionDetail(data);
        break;

      case 'find_wallet_path':
      case 'find_connected_wallets':
        this.processConnectionData(data);
        break;

      default:
        // Store raw data for analysis
        break;
    }
  }

  private processPortfolioData(address: string, data: any): void {
    if (!this.state || !data?.data) return;

    const profile: WalletProfile = {
      address,
      solBalance: data.data.native?.balance || 0,
      tokenCount: data.data.totalTokens || 0,
      totalValueUsd: data.data.totalValue || null,
      transactionCount: 0, // Will be updated by transactions call
      firstSeen: null,
      lastActive: null,
      labels: [],
      riskIndicators: [],
    };

    this.state.walletProfiles.set(address, profile);

    // Emit graph node for the wallet
    const isTarget = address === this.state.target.address;
    this.addGraphNode(this.createWalletNode(address, isTarget ? 'source' : 'normal', {
      balance: profile.solBalance,
      tokenCount: profile.tokenCount,
      valueUsd: profile.totalValueUsd,
    }));

    // Add token nodes for significant holdings
    if (data.data.tokens && Array.isArray(data.data.tokens)) {
      const walletNodeId = `wallet_${address.slice(0, 8)}`;

      for (const token of data.data.tokens.slice(0, 10)) { // Top 10 tokens
        if (token.mint && token.balance > 0) {
          const tokenNode = this.createTokenNode(token.mint, token.symbol || 'UNKNOWN', 'normal', {
            balance: token.balance,
            valueUsd: token.valueUsd,
          });
          this.addGraphNode(tokenNode);

          // Add edge from wallet to token
          this.addGraphEdge({
            source: walletNodeId,
            target: tokenNode.id,
            type: 'token_flow',
            label: `${token.balance} ${token.symbol || ''}`.trim(),
            metadata: {
              amount: token.balance,
              symbol: token.symbol,
              valueUsd: token.valueUsd,
            },
          });
        }
      }
    }
  }

  private processTransactionData(data: any): void {
    if (!this.state) return;

    const transactions = data?.transactions || data?.data || [];
    if (!Array.isArray(transactions)) return;

    const targetWalletId = `wallet_${this.state.target.address.slice(0, 8)}`;

    for (const tx of transactions) {
      const summary: TransactionSummary = {
        signature: tx.signature,
        timestamp: tx.timestamp || tx.blockTime,
        type: tx.type || 'unknown',
        success: tx.success !== false,
        involvedPrograms: tx.programIds || [],
        solTransferred: tx.solTransferred || 0,
        tokenTransfers: [],
        riskScore: 0,
        flags: [],
      };

      this.state.transactions.push(summary);

      // Emit graph node for transaction
      if (tx.signature) {
        const txNode = this.createTransactionNode(tx.signature, summary.success ? 'normal' : 'suspicious', {
          type: tx.type,
          timestamp: summary.timestamp,
          solTransferred: summary.solTransferred,
        });
        this.addGraphNode(txNode);

        // Connect transaction to target wallet
        this.addGraphEdge({
          source: targetWalletId,
          target: txNode.id,
          type: 'interaction',
          label: tx.type || 'TX',
          animated: true,
          metadata: {
            timestamp: summary.timestamp,
            signature: tx.signature,
          },
        });

        // Add edges for involved programs
        if (tx.programIds && Array.isArray(tx.programIds)) {
          for (const programId of tx.programIds.slice(0, 3)) { // Top 3 programs
            const programNode: GraphNode = {
              id: `program_${programId.slice(0, 8)}`,
              type: 'program',
              label: this.getProgramLabel(programId),
              status: 'normal',
              metadata: { address: programId },
            };
            this.addGraphNode(programNode);

            this.addGraphEdge({
              source: txNode.id,
              target: programNode.id,
              type: 'program_call',
              label: 'calls',
            });
          }
        }

        // Add edges for counterparties
        if (tx.counterparties && Array.isArray(tx.counterparties)) {
          for (const counterparty of tx.counterparties.slice(0, 5)) { // Top 5
            const counterpartyNode = this.createWalletNode(counterparty, 'normal');
            this.addGraphNode(counterpartyNode);

            this.addGraphEdge({
              source: txNode.id,
              target: counterpartyNode.id,
              type: 'transfer',
              animated: true,
            });
          }
        }
      }
    }
  }

  /**
   * Get human-readable label for known programs/addresses
   * Now uses the known entities database for comprehensive coverage
   */
  private getProgramLabel(address: string): string {
    // First check the known entities database
    const entity = lookupEntity(address);
    if (entity) {
      return entity.name;
    }

    // Fallback to basic program mapping
    const knownPrograms: Record<string, string> = {
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'ATA',
      '11111111111111111111111111111111': 'System',
      'ComputeBudget111111111111111111111111111111': 'Compute Budget',
    };
    return knownPrograms[address] || `${address.slice(0, 4)}...`;
  }

  /**
   * Get detailed entity description with risk context
   */
  private getEntityContext(address: string): string | null {
    const description = describeEntity(address);
    if (description) {
      return description;
    }
    return null;
  }

  /**
   * Check if address interaction is dangerous and return warning
   */
  private getDangerWarning(address: string): string | null {
    if (isDangerous(address)) {
      const entity = lookupEntity(address);
      return `DANGER: Interacted with ${entity?.name || 'known dangerous address'} - ${entity?.description || 'high risk'}`;
    }
    return null;
  }

  /**
   * Analyze counterparty list for known entities
   */
  private analyzeCounterpartyEntities(addresses: string[]): string {
    const analysis = analyzeCounterparties(addresses);
    return analysis.summary;
  }

  /**
   * Compare metrics against Solana benchmarks
   */
  private compareToSolanaBenchmarks(metrics: {
    txPerDay?: number;
    failureRate?: number;
    tokenCount?: number;
    portfolioValue?: number;
    swapCount?: number;
  }): string[] {
    const insights: string[] = [];

    if (metrics.txPerDay !== undefined) {
      const ratio = metrics.txPerDay / SOLANA_BENCHMARKS.avgDailyTxPerWallet;
      if (ratio > 10) {
        insights.push(`${ratio.toFixed(0)}x more active than average Solana wallet`);
      } else if (ratio < 0.1) {
        insights.push(`${(1/ratio).toFixed(0)}x less active than average - dormant`);
      }
    }

    if (metrics.failureRate !== undefined) {
      if (metrics.failureRate > SOLANA_BENCHMARKS.suspiciousFailureRate) {
        const multiple = metrics.failureRate / SOLANA_BENCHMARKS.normalFailureRate;
        insights.push(`Failure rate ${multiple.toFixed(0)}x higher than network average`);
      }
    }

    if (metrics.tokenCount !== undefined) {
      if (metrics.tokenCount > SOLANA_BENCHMARKS.extremeTokensThreshold) {
        insights.push(`Holds ${metrics.tokenCount} tokens vs avg ${SOLANA_BENCHMARKS.avgTokensHeld} - likely farmer/bot`);
      } else if (metrics.tokenCount > SOLANA_BENCHMARKS.manyTokensThreshold) {
        insights.push(`${(metrics.tokenCount / SOLANA_BENCHMARKS.avgTokensHeld).toFixed(0)}x more tokens than typical`);
      }
    }

    if (metrics.portfolioValue !== undefined) {
      if (metrics.portfolioValue > SOLANA_BENCHMARKS.megaWhaleThreshold) {
        insights.push(`MEGA WHALE: Top 0.01% by portfolio value`);
      } else if (metrics.portfolioValue > SOLANA_BENCHMARKS.whaleThreshold) {
        insights.push(`WHALE: Top 1% by portfolio value on Solana`);
      }
    }

    return insights;
  }

  /**
   * Detect potential front-running or sandwich attacks
   */
  private detectPriceImpactAnomalies(transactions: TransactionSummary[]): string[] {
    const insights: string[] = [];

    // Sort by timestamp
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    // Look for rapid transaction patterns (potential sandwich)
    for (let i = 1; i < sorted.length - 1; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const next = sorted[i + 1];

      // Check for sandwich pattern: tx within 2s before and after
      const timeToPrev = curr.timestamp - prev.timestamp;
      const timeToNext = next.timestamp - curr.timestamp;

      if (timeToPrev < PRICE_IMPACT_THRESHOLDS.sandwichWindowMs &&
          timeToNext < PRICE_IMPACT_THRESHOLDS.sandwichWindowMs) {

        // Check if it's a swap that could be sandwiched
        const isSwap = curr.type?.toLowerCase().includes('swap') ||
                       curr.involvedPrograms.some(p => isDEX(p));

        if (isSwap) {
          insights.push(
            `POTENTIAL SANDWICH: Swap at ${new Date(curr.timestamp).toISOString()} ` +
            `surrounded by transactions ${timeToPrev}ms before and ${timeToNext}ms after`
          );
        }
      }

      // Check for frontrun pattern: very quick tx before user's
      if (timeToPrev < PRICE_IMPACT_THRESHOLDS.frontrunWindowMs && prev.success && !curr.success) {
        insights.push(
          `POTENTIAL FRONTRUN: Your transaction failed ${timeToPrev}ms after another succeeded`
        );
      }
    }

    // Check for unusually high priority fees (MEV competition)
    const highFeeTxs = transactions.filter(tx => {
      const fee = tx.solTransferred; // Simplified - would need actual fee data
      return fee > SOLANA_BENCHMARKS.mevBotFee;
    });

    if (highFeeTxs.length > transactions.length * 0.1) {
      insights.push(`${highFeeTxs.length} transactions with MEV-level priority fees - possible bot activity`);
    }

    return insights;
  }

  private processTransactionDetail(data: any): void {
    if (!this.state || !data) return;

    // Extract token transfers
    if (data.details?.tokenChanges) {
      for (const change of data.details.tokenChanges) {
        const transfer: TokenTransfer = {
          mint: change.mint,
          symbol: change.symbol || 'UNKNOWN',
          amount: Math.abs(change.change || 0),
          from: change.change < 0 ? this.state.target.address : '',
          to: change.change > 0 ? this.state.target.address : '',
          valueUsd: null,
        };

        this.state.tokenFlows.push(transfer);
      }
    }
  }

  private processConnectionData(data: any): void {
    if (!this.state || !data) return;

    if (data.path && data.found) {
      const connection: ConnectionPath = {
        source: data.sourceWallet,
        target: data.targetWallet,
        path: data.path,
        transfers: data.transferIds || [],
        totalHops: data.depth || data.path?.length || 0,
        totalValue: 0,
      };

      this.state.connections.push(connection);

      // Emit graph nodes and edges for the connection path
      const pathAddresses: string[] = data.path || [];
      let previousNodeId: string | null = null;

      for (let i = 0; i < pathAddresses.length; i++) {
        const address = pathAddresses[i];
        const isSource = i === 0;
        const isTarget = i === pathAddresses.length - 1;

        const node = this.createWalletNode(
          address,
          isSource ? 'source' : isTarget ? 'target' : 'normal'
        );
        this.addGraphNode(node);

        // Add edge from previous node
        if (previousNodeId) {
          this.addGraphEdge({
            source: previousNodeId,
            target: node.id,
            type: 'transfer',
            label: `Hop ${i}`,
            animated: true,
            weight: 1,
            metadata: {
              hopNumber: i,
              totalHops: pathAddresses.length - 1,
            },
          });
        }

        previousNodeId = node.id;
      }

      // Emit path found event
      this.emit('finding', {
        type: 'connection_path',
        source: data.sourceWallet,
        target: data.targetWallet,
        hops: pathAddresses.length - 1,
        path: pathAddresses.map((a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`),
      });
    }
  }

  /**
   * Analyze gathered data for patterns
   */
  private async analyzeData(): Promise<void> {
    if (!this.state) return;

    // Analyze transaction patterns
    this.analyzeTransactionPatterns();

    // Analyze token flow patterns
    this.analyzeTokenFlows();

    // Update wallet profile with transaction data
    this.updateWalletProfiles();

    // Run AI synthesis for cross-pattern reasoning
    const synthesisInsights = this.synthesizeFindings();
    if (synthesisInsights.length > 0) {
      this.emit('analysis', {
        status: 'synthesis',
        message: 'Cross-pattern analysis complete',
        insights: synthesisInsights,
      });

      // Narrate the most important synthesis insights
      for (const insight of synthesisInsights.slice(0, 3)) {
        this.narrate(insight.text, insight.emphasis, insight.relatedNodes);
      }
    }
  }

  /**
   * AI Synthesis: Cross-pattern reasoning across all findings
   * This is the "smart" layer that connects dots between different data sources
   */
  private synthesizeFindings(): Array<{
    text: string;
    emphasis: NarrationEvent['emphasis'];
    relatedNodes?: string[];
    confidence: number;
  }> {
    if (!this.state) return [];

    const insights: Array<{
      text: string;
      emphasis: NarrationEvent['emphasis'];
      relatedNodes?: string[];
      confidence: number;
    }> = [];

    const targetProfile = this.state.walletProfiles.get(this.state.target.address);
    const transactions = this.state.transactions;
    const anomalies = this.state.anomalies;

    // Cross-reference: New wallet + Large value = High risk
    if (targetProfile?.firstSeen) {
      const walletAge = Date.now() - targetProfile.firstSeen;
      const dayAge = walletAge / (1000 * 60 * 60 * 24);

      if (dayAge < 7 && (targetProfile.totalValueUsd || 0) > 10000) {
        insights.push({
          text: `HIGH RISK PATTERN: New wallet (<${Math.ceil(dayAge)} days) with $${(targetProfile.totalValueUsd! / 1000).toFixed(0)}K - common in scam/rugpull setups`,
          emphasis: 'critical',
          relatedNodes: [`wallet_${this.state.target.address.slice(0, 8)}`],
          confidence: 0.85,
        });
      }

      if (dayAge < 30 && transactions.length > 100) {
        insights.push({
          text: `BOT SIGNATURE: New wallet with ${transactions.length} tx in ${Math.ceil(dayAge)} days - automated activity`,
          emphasis: 'important',
          relatedNodes: [`wallet_${this.state.target.address.slice(0, 8)}`],
          confidence: 0.9,
        });
      }
    }

    // Cross-reference: High failure rate + DEX interactions = MEV victim
    const failedTx = transactions.filter(tx => !tx.success).length;
    const failRate = transactions.length > 0 ? failedTx / transactions.length : 0;
    const dexTx = transactions.filter(tx =>
      tx.involvedPrograms.some(p =>
        ['Jupiter', 'Orca', 'Raydium', 'Serum'].some(dex =>
          this.getProgramLabel(p).includes(dex)
        )
      )
    ).length;

    if (failRate > 0.15 && dexTx > transactions.length * 0.3) {
      insights.push({
        text: `MEV VICTIM PATTERN: ${(failRate * 100).toFixed(0)}% failure rate on DEX trades - likely being frontrun or sandwiched`,
        emphasis: 'important',
        confidence: 0.75,
      });
    }

    // Cross-reference: Exchange interactions + Token draining pattern
    const exchangeInteractions = new Set<string>();
    for (const tx of transactions) {
      for (const program of tx.involvedPrograms) {
        if (isExchange(program)) {
          exchangeInteractions.add(this.getProgramLabel(program));
        }
      }
    }

    if (exchangeInteractions.size > 0 && targetProfile) {
      // Check if balance is low but recent activity shows exchanges
      if ((targetProfile.totalValueUsd || 0) < 100 && exchangeInteractions.size > 0) {
        insights.push({
          text: `FUND EXTRACTION: Wallet nearly empty but shows ${exchangeInteractions.size} exchange interactions (${Array.from(exchangeInteractions).join(', ')}) - funds likely moved to CEX`,
          emphasis: 'important',
          relatedNodes: Array.from(exchangeInteractions).map(e => `program_${e.slice(0, 8)}`),
          confidence: 0.7,
        });
      }
    }

    // Cross-reference: Multiple anomalies of same type = Pattern confirmation
    const anomalyTypes = new Map<string, number>();
    for (const anomaly of anomalies) {
      anomalyTypes.set(anomaly.type, (anomalyTypes.get(anomaly.type) || 0) + 1);
    }

    for (const [type, count] of anomalyTypes) {
      if (count >= 3) {
        insights.push({
          text: `PATTERN CONFIRMED: ${count} instances of ${type.replace(/_/g, ' ')} - this is systematic behavior, not random`,
          emphasis: 'critical',
          confidence: 0.9,
        });
      }
    }

    // Cross-reference: Token concentration + Recent activity = Whale movement
    if (targetProfile?.totalValueUsd && targetProfile.totalValueUsd > SOLANA_BENCHMARKS.whaleThreshold) {
      const recentTxs = transactions.filter(tx =>
        Date.now() - tx.timestamp < 24 * 60 * 60 * 1000
      );

      if (recentTxs.length > 10) {
        const recentVolume = recentTxs.reduce((sum, tx) => sum + Math.abs(tx.solTransferred), 0);
        insights.push({
          text: `WHALE MOVEMENT: ${recentTxs.length} transactions in 24h, ${recentVolume.toFixed(0)} SOL volume - monitor for market impact`,
          emphasis: 'important',
          relatedNodes: [`wallet_${this.state.target.address.slice(0, 8)}`],
          confidence: 0.85,
        });
      }
    }

    // Cross-reference: Mixer interaction + Any other risk = Escalate
    const mixerInteraction = anomalies.some(a => a.type === 'mixer_interaction');
    if (mixerInteraction && anomalies.length > 1) {
      insights.push({
        text: `CRITICAL: Mixer usage combined with ${anomalies.length - 1} other risk factors - highly suspicious wallet`,
        emphasis: 'critical',
        confidence: 0.95,
      });
    }

    // Cross-reference: Program diversity analysis
    const uniquePrograms = new Set<string>();
    for (const tx of transactions) {
      for (const program of tx.involvedPrograms) {
        uniquePrograms.add(this.getProgramLabel(program));
      }
    }

    if (uniquePrograms.size > 20 && transactions.length < uniquePrograms.size * 2) {
      insights.push({
        text: `EXPLORER PATTERN: ${uniquePrograms.size} different programs with only ${transactions.length} tx - likely testing/farming multiple protocols`,
        emphasis: 'normal',
        confidence: 0.7,
      });
    }

    // Cross-reference: Counterparty convergence (same addresses across multiple tx types)
    const counterpartyAppearances = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          counterpartyAppearances.set(transfer.to, (counterpartyAppearances.get(transfer.to) || 0) + 1);
          counterpartyAppearances.set(transfer.from, (counterpartyAppearances.get(transfer.from) || 0) + 1);
        }
      }
    }

    // Find addresses that appear in >30% of transactions
    const frequentCounterparties = Array.from(counterpartyAppearances.entries())
      .filter(([_, count]) => count > transactions.length * 0.3)
      .map(([addr]) => addr);

    if (frequentCounterparties.length > 0 && frequentCounterparties.length < 3) {
      const labels = frequentCounterparties.map(addr => getEntityLabel(addr) || `${addr.slice(0, 4)}...${addr.slice(-4)}`);
      insights.push({
        text: `TIGHT RELATIONSHIP: ${frequentCounterparties.length} address${frequentCounterparties.length > 1 ? 'es' : ''} (${labels.join(', ')}) appear in 30%+ of transactions - likely affiliated wallets`,
        emphasis: 'important',
        relatedNodes: frequentCounterparties.map(a => `wallet_${a.slice(0, 8)}`),
        confidence: 0.8,
      });
    }

    // Sort by confidence
    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  private analyzeTransactionPatterns(): void {
    if (!this.state) return;

    const transactions = this.state.transactions;
    if (transactions.length === 0) return;

    // Check for rapid transactions (bot activity)
    const timestamps = transactions.map((t) => t.timestamp).sort();
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap < 1000) {
        // Less than 1 second between transactions
        transactions[i].flags.push('rapid_transaction');
      }
    }

    // Check for high failure rate
    const failedCount = transactions.filter((t) => !t.success).length;
    const failureRate = failedCount / transactions.length;
    if (failureRate > 0.3) {
      // More than 30% failed
      for (const tx of transactions.filter((t) => !t.success)) {
        tx.flags.push('high_failure_context');
      }
    }
  }

  private analyzeTokenFlows(): void {
    if (!this.state) return;

    // Group by mint to find concentrated flows
    const flowsByMint = new Map<string, TokenTransfer[]>();
    for (const flow of this.state.tokenFlows) {
      const existing = flowsByMint.get(flow.mint) || [];
      existing.push(flow);
      flowsByMint.set(flow.mint, existing);
    }

    // Check for unusual concentration
    for (const [mint, flows] of flowsByMint) {
      if (flows.length > 10) {
        // Many transfers of same token
        // Could indicate wash trading or airdrop farming
      }
    }
  }

  private updateWalletProfiles(): void {
    if (!this.state) return;

    for (const [address, profile] of this.state.walletProfiles) {
      // Count transactions involving this wallet
      profile.transactionCount = this.state.transactions.length;

      // Find first and last activity
      if (this.state.transactions.length > 0) {
        const timestamps = this.state.transactions.map((t) => t.timestamp).sort();
        profile.firstSeen = timestamps[0];
        profile.lastActive = timestamps[timestamps.length - 1];
      }
    }
  }

  /**
   * Run anomaly detection
   */
  private async runAnomalyDetection(): Promise<void> {
    if (!this.state) return;

    const anomalies = detectAnomalies(this.state);
    this.state.anomalies = anomalies;

    // Highlight affected nodes in graph based on anomalies
    for (const anomaly of anomalies) {
      const status: GraphNodeStatus = anomaly.severity === 'critical' || anomaly.severity === 'high'
        ? 'flagged'
        : 'suspicious';

      // Highlight affected entities
      for (const entity of anomaly.affectedEntities) {
        // Try to find matching node
        const walletNodeId = `wallet_${entity.slice(0, 8)}`;
        const txNodeId = `tx_${entity.slice(0, 8)}`;

        if (this.graphNodes.has(walletNodeId)) {
          this.highlightNode(walletNodeId, status);
        }
        if (this.graphNodes.has(txNodeId)) {
          this.highlightNode(txNodeId, status);
        }
      }
    }
  }

  /**
   * Generate investigation report
   */
  generateReport(): InvestigationReport | null {
    if (!this.state) return null;

    this.emit('progress', {
      status: 'generating_report',
      message: 'Generating investigation report...',
    });

    const report = generateReport(this.state);

    // Emit report event
    this.emit('report', {
      id: report.id,
      title: report.title,
      riskLevel: report.riskAssessment.level,
      riskScore: report.riskAssessment.overallScore,
      anomalyCount: report.findings.anomalies.length,
      recommendationCount: report.recommendations.length,
    });

    return report;
  }

  /**
   * Get current investigation state
   */
  getState(): InvestigationState | null {
    return this.state;
  }

  /**
   * Serialize state for persistence
   */
  serializeState(): string | null {
    if (!this.state) return null;

    // Convert Map to array for JSON serialization
    const serializable = {
      ...this.state,
      walletProfiles: Array.from(this.state.walletProfiles.entries()),
    };

    return JSON.stringify(serializable);
  }

  /**
   * Restore state from serialized data
   */
  restoreState(serialized: string): void {
    const parsed = JSON.parse(serialized);

    // Convert array back to Map
    parsed.walletProfiles = new Map(parsed.walletProfiles);

    this.state = parsed;
  }
}

/**
 * Factory function to create an investigation agent
 */
export function createInvestigationAgent(
  apiUrl?: string,
  timeout?: number,
  streamCallback?: StreamCallback
): InvestigationOrchestrator {
  return new InvestigationOrchestrator(apiUrl, timeout, streamCallback);
}

/**
 * Quick investigation function for simple use cases
 */
export async function investigate(
  target: string,
  type: InvestigationType = 'wallet_forensics',
  config?: Partial<InvestigationConfig>,
  streamCallback?: StreamCallback
): Promise<InvestigationReport | null> {
  const targetType = detectTargetType(target);

  const agent = createInvestigationAgent(undefined, undefined, streamCallback);

  await agent.startInvestigation(type, {
    type: targetType,
    address: target,
  }, config);

  await agent.execute();

  return agent.generateReport();
}

/**
 * Detect the type of target based on format
 */
function detectTargetType(target: string): 'wallet' | 'transaction' | 'token' | 'program' {
  // Transaction signatures are typically 87-88 characters
  if (target.length >= 80 && target.length <= 90) {
    return 'transaction';
  }

  // Wallet/program addresses are 32-44 characters
  // Programs often end in specific patterns but we default to wallet
  return 'wallet';
}
