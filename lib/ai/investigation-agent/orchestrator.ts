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
} from './types';

import { createInvestigationPlan, DEFAULT_CONFIG } from './strategies';
import { detectAnomalies, calculateRiskScore, categorizeRisk } from './anomaly-detector';
import { generateReport } from './report-generator';

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

  constructor(apiUrl?: string, timeout?: number) {
    this.toolCaller = new ToolCaller(apiUrl, timeout);
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

    // Execute each step in the plan
    for (let i = 0; i < this.state.plan.steps.length; i++) {
      this.state.currentStep = i;
      const step = this.state.plan.steps[i];

      // Update step status
      step.status = 'running';

      console.log(`[Investigation] Step ${i + 1}/${this.state.plan.steps.length}: ${step.purpose}`);

      // Execute the tool
      const result = await this.toolCaller.call(step.tool, step.params);
      this.state.toolCallCount++;

      // Record result
      step.duration = result.duration;

      if (result.success) {
        step.status = 'completed';
        step.result = result.data;

        // Process the result based on tool type
        await this.processToolResult(step.tool, step.params, result.data);
      } else {
        step.status = 'failed';
        step.error = result.error;
        this.state.errors.push(`Step ${step.id} failed: ${result.error}`);
      }
    }

    // Analyze gathered data
    this.state.status = 'analyzing';
    await this.analyzeData();

    // Detect anomalies
    this.state.status = 'detecting_anomalies';
    await this.runAnomalyDetection();

    // Calculate final risk score
    this.state.riskScore = calculateRiskScore(this.state);
    this.state.riskLevel = categorizeRisk(this.state.riskScore);

    // Complete the investigation
    this.state.status = 'completed';
    this.state.completedAt = Date.now();
    this.state.duration = this.state.completedAt - this.state.startedAt;

    return this.state;
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
  }

  private processTransactionData(data: any): void {
    if (!this.state) return;

    const transactions = data?.transactions || data?.data || [];
    if (!Array.isArray(transactions)) return;

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
    }
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
  }

  /**
   * Generate investigation report
   */
  generateReport(): InvestigationReport | null {
    if (!this.state) return null;
    return generateReport(this.state);
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
  timeout?: number
): InvestigationOrchestrator {
  return new InvestigationOrchestrator(apiUrl, timeout);
}

/**
 * Quick investigation function for simple use cases
 */
export async function investigate(
  target: string,
  type: InvestigationType = 'wallet_forensics',
  config?: Partial<InvestigationConfig>
): Promise<InvestigationReport | null> {
  const targetType = detectTargetType(target);

  const agent = createInvestigationAgent();

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
