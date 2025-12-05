/**
 * Multi-Agent Investigation Orchestration
 *
 * Spawn multiple investigation agents in parallel and merge their findings.
 * 10x faster forensic investigations on complex cases.
 *
 * Features:
 * - Parallel agent spawning with resource limits
 * - Intelligent work distribution based on investigation type
 * - Finding deduplication and conflict resolution
 * - Cross-agent anomaly correlation
 * - Hierarchical agent coordination (lead + specialists)
 * - Progress aggregation and real-time updates
 * - Automatic follow-up agent spawning
 */

// ============================================================================
// Types
// ============================================================================

export type AgentRole =
  | 'lead'              // Coordinates other agents, synthesizes findings
  | 'wallet_forensics'  // Analyzes wallet history and patterns
  | 'transaction_tracer'// Traces transaction flows
  | 'token_analyzer'    // Analyzes token movements and holdings
  | 'connection_mapper' // Maps relationships between addresses
  | 'anomaly_detector'  // Detects suspicious patterns
  | 'entity_identifier' // Identifies known entities (exchanges, protocols)
  | 'risk_assessor';    // Calculates risk scores

export type AgentStatus =
  | 'pending'
  | 'initializing'
  | 'running'
  | 'waiting'    // Waiting for other agents
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentTask {
  id: string;
  role: AgentRole;
  target: string;
  params: Record<string, any>;
  priority: number;
  dependencies?: string[];  // IDs of tasks that must complete first
}

export interface AgentResult {
  agentId: string;
  role: AgentRole;
  target: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: number;
  completedAt: number;
  durationMs: number;

  // Findings
  findings: AgentFinding[];
  anomalies: AgentAnomaly[];
  entities: IdentifiedEntity[];
  connections: Connection[];

  // Metrics
  metrics: {
    transactionsAnalyzed: number;
    addressesScanned: number;
    tokensTracked: number;
    depth: number;
  };

  // Raw data for cross-referencing
  rawData?: any;
  error?: string;
}

export interface AgentFinding {
  id: string;
  agentId: string;
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: any[];
  confidence: number;  // 0-100
  relatedAddresses: string[];
  relatedTransactions: string[];
}

export interface AgentAnomaly {
  id: string;
  agentId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  indicators: string[];
  score: number;
  addresses: string[];
  transactions: string[];
}

export interface IdentifiedEntity {
  address: string;
  name: string;
  type: 'exchange' | 'protocol' | 'bridge' | 'mixer' | 'whale' | 'contract' | 'unknown';
  confidence: number;
  labels: string[];
  source: string;
}

export interface Connection {
  from: string;
  to: string;
  type: 'direct_transfer' | 'token_transfer' | 'program_interaction' | 'shared_program' | 'timing_correlation';
  strength: number;  // 0-100
  transactions: string[];
  totalValue?: number;
}

export interface Agent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  task: AgentTask;
  progress: number;
  startedAt?: number;
  completedAt?: number;
  result?: AgentResult;
  error?: string;
}

export interface Investigation {
  id: string;
  target: string;
  type: string;
  status: 'initializing' | 'running' | 'synthesizing' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;

  // Agents
  agents: Agent[];
  leadAgentId?: string;

  // Aggregated results
  findings: AgentFinding[];
  anomalies: AgentAnomaly[];
  entities: IdentifiedEntity[];
  connections: Connection[];
  riskScore: number;

  // Progress
  progress: number;
  currentPhase: string;

  // Configuration
  config: InvestigationConfig;
}

export interface InvestigationConfig {
  maxAgents: number;
  maxDepth: number;
  maxTransactions: number;
  timeoutMs: number;
  autoSpawnFollowUp: boolean;
  parallelism: number;
  prioritizeAnomalies: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: InvestigationConfig = {
  maxAgents: 10,
  maxDepth: 3,
  maxTransactions: 100,
  timeoutMs: 300000,  // 5 minutes
  autoSpawnFollowUp: true,
  parallelism: 5,
  prioritizeAnomalies: true,
};

// ============================================================================
// Agent Role Definitions
// ============================================================================

export const AGENT_ROLES: Record<AgentRole, {
  description: string;
  tools: string[];
  priority: number;
  canSpawnFollowUp: boolean;
}> = {
  lead: {
    description: 'Coordinates investigation and synthesizes findings',
    tools: ['investigate', 'ask_ai'],
    priority: 100,
    canSpawnFollowUp: true,
  },
  wallet_forensics: {
    description: 'Analyzes wallet transaction history and patterns',
    tools: ['get_account_transactions', 'get_account_stats', 'get_account_portfolio'],
    priority: 90,
    canSpawnFollowUp: true,
  },
  transaction_tracer: {
    description: 'Traces transaction flows and fund movements',
    tools: ['get_transaction', 'explain_transaction', 'analyze_transaction'],
    priority: 85,
    canSpawnFollowUp: true,
  },
  token_analyzer: {
    description: 'Analyzes token holdings and transfers',
    tools: ['get_token_metadata', 'get_token_markets', 'get_token_ohlcv'],
    priority: 80,
    canSpawnFollowUp: false,
  },
  connection_mapper: {
    description: 'Maps relationships between addresses',
    tools: ['find_wallet_path', 'get_account_transactions'],
    priority: 75,
    canSpawnFollowUp: true,
  },
  anomaly_detector: {
    description: 'Detects suspicious patterns and unusual activity',
    tools: ['get_account_transactions', 'get_account_stats'],
    priority: 95,
    canSpawnFollowUp: true,
  },
  entity_identifier: {
    description: 'Identifies known entities like exchanges and protocols',
    tools: ['search', 'get_program'],
    priority: 70,
    canSpawnFollowUp: false,
  },
  risk_assessor: {
    description: 'Calculates risk scores based on all findings',
    tools: ['ask_ai'],
    priority: 60,
    canSpawnFollowUp: false,
  },
};

// ============================================================================
// Investigation Templates
// ============================================================================

export const INVESTIGATION_TEMPLATES: Record<string, {
  name: string;
  description: string;
  agents: AgentRole[];
  config: Partial<InvestigationConfig>;
}> = {
  quick_scan: {
    name: 'Quick Scan',
    description: 'Fast overview with 2-3 agents',
    agents: ['wallet_forensics', 'anomaly_detector'],
    config: { maxAgents: 3, maxDepth: 1, maxTransactions: 50, parallelism: 2 },
  },
  standard: {
    name: 'Standard Investigation',
    description: 'Balanced investigation with 5 agents',
    agents: ['lead', 'wallet_forensics', 'transaction_tracer', 'anomaly_detector', 'entity_identifier'],
    config: { maxAgents: 5, maxDepth: 2, maxTransactions: 100, parallelism: 3 },
  },
  deep_dive: {
    name: 'Deep Dive',
    description: 'Comprehensive analysis with 8 agents',
    agents: ['lead', 'wallet_forensics', 'transaction_tracer', 'token_analyzer', 'connection_mapper', 'anomaly_detector', 'entity_identifier', 'risk_assessor'],
    config: { maxAgents: 8, maxDepth: 3, maxTransactions: 200, parallelism: 4 },
  },
  forensic: {
    name: 'Forensic Analysis',
    description: 'Maximum depth forensic investigation',
    agents: ['lead', 'wallet_forensics', 'transaction_tracer', 'token_analyzer', 'connection_mapper', 'anomaly_detector', 'entity_identifier', 'risk_assessor'],
    config: { maxAgents: 10, maxDepth: 5, maxTransactions: 500, parallelism: 5, autoSpawnFollowUp: true },
  },
};

// ============================================================================
// Multi-Agent Orchestrator
// ============================================================================

export class MultiAgentOrchestrator {
  private investigations = new Map<string, Investigation>();
  private toolExecutor: (tool: string, params: Record<string, any>) => Promise<any>;

  constructor(toolExecutor: (tool: string, params: Record<string, any>) => Promise<any>) {
    this.toolExecutor = toolExecutor;
  }

  /**
   * Start a multi-agent investigation
   */
  async startInvestigation(params: {
    target: string;
    type?: string;
    template?: string;
    config?: Partial<InvestigationConfig>;
    onProgress?: (investigation: Investigation) => void;
  }): Promise<Investigation> {
    const template = params.template ? INVESTIGATION_TEMPLATES[params.template] : INVESTIGATION_TEMPLATES.standard;
    const config: InvestigationConfig = {
      ...DEFAULT_CONFIG,
      ...template?.config,
      ...params.config,
    };

    const investigation: Investigation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      target: params.target,
      type: params.type || 'full_investigation',
      status: 'initializing',
      startedAt: Date.now(),
      agents: [],
      findings: [],
      anomalies: [],
      entities: [],
      connections: [],
      riskScore: 0,
      progress: 0,
      currentPhase: 'initializing',
      config,
    };

    this.investigations.set(investigation.id, investigation);

    // Create initial agents based on template
    const roles = template?.agents || ['wallet_forensics', 'anomaly_detector'];
    for (const role of roles) {
      this.spawnAgent(investigation, role, params.target, { depth: 0 });
    }

    // Start orchestration
    this.orchestrate(investigation, params.onProgress).catch(error => {
      investigation.status = 'failed';
      console.error('[MultiAgent] Investigation failed:', error);
    });

    return investigation;
  }

  /**
   * Spawn a new agent
   */
  private spawnAgent(
    investigation: Investigation,
    role: AgentRole,
    target: string,
    params: Record<string, any> = {},
    dependencies: string[] = []
  ): Agent {
    const roleConfig = AGENT_ROLES[role];
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role,
      target,
      params: {
        ...params,
        maxDepth: investigation.config.maxDepth,
        maxTransactions: investigation.config.maxTransactions,
      },
      priority: roleConfig.priority,
      dependencies,
    };

    const agent: Agent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role,
      status: 'pending',
      task,
      progress: 0,
    };

    investigation.agents.push(agent);

    // Set lead agent
    if (role === 'lead' && !investigation.leadAgentId) {
      investigation.leadAgentId = agent.id;
    }

    return agent;
  }

  /**
   * Main orchestration loop
   */
  private async orchestrate(
    investigation: Investigation,
    onProgress?: (investigation: Investigation) => void
  ): Promise<void> {
    investigation.status = 'running';
    investigation.currentPhase = 'agent_execution';

    const startTime = Date.now();
    const timeout = investigation.config.timeoutMs;

    // Process agents until all complete or timeout
    while (true) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        this.cancelPendingAgents(investigation);
        break;
      }

      // Get runnable agents
      const runnableAgents = this.getRunnableAgents(investigation);
      if (runnableAgents.length === 0 && !this.hasRunningAgents(investigation)) {
        break;
      }

      // Run agents in parallel up to limit
      const toRun = runnableAgents.slice(0, investigation.config.parallelism);
      await Promise.all(toRun.map(agent => this.runAgent(investigation, agent)));

      // Update progress
      investigation.progress = this.calculateProgress(investigation);
      onProgress?.(investigation);

      // Check for follow-up opportunities
      if (investigation.config.autoSpawnFollowUp) {
        this.checkFollowUpOpportunities(investigation);
      }

      // Small delay to prevent tight loop
      await new Promise(r => setTimeout(r, 100));
    }

    // Synthesis phase
    investigation.currentPhase = 'synthesizing';
    investigation.status = 'synthesizing';
    onProgress?.(investigation);

    await this.synthesizeResults(investigation);

    investigation.status = 'completed';
    investigation.completedAt = Date.now();
    investigation.progress = 100;
    onProgress?.(investigation);
  }

  /**
   * Get agents that are ready to run
   */
  private getRunnableAgents(investigation: Investigation): Agent[] {
    return investigation.agents.filter(agent => {
      if (agent.status !== 'pending') return false;

      // Check dependencies
      if (agent.task.dependencies && agent.task.dependencies.length > 0) {
        for (const depId of agent.task.dependencies) {
          const depAgent = investigation.agents.find(a => a.id === depId);
          if (!depAgent || depAgent.status !== 'completed') {
            return false;
          }
        }
      }

      return true;
    }).sort((a, b) => b.task.priority - a.task.priority);
  }

  /**
   * Check if any agents are still running
   */
  private hasRunningAgents(investigation: Investigation): boolean {
    return investigation.agents.some(a =>
      a.status === 'running' || a.status === 'initializing'
    );
  }

  /**
   * Run a single agent
   */
  private async runAgent(investigation: Investigation, agent: Agent): Promise<void> {
    agent.status = 'running';
    agent.startedAt = Date.now();

    try {
      const result = await this.executeAgentTask(agent, investigation);
      agent.result = result;
      agent.status = 'completed';
      agent.completedAt = Date.now();
      agent.progress = 100;

      // Merge findings into investigation
      investigation.findings.push(...result.findings);
      investigation.anomalies.push(...result.anomalies);
      investigation.entities.push(...result.entities);
      investigation.connections.push(...result.connections);

    } catch (error) {
      agent.status = 'failed';
      agent.error = error instanceof Error ? error.message : String(error);
      agent.completedAt = Date.now();
    }
  }

  /**
   * Execute agent's task
   */
  private async executeAgentTask(agent: Agent, investigation: Investigation): Promise<AgentResult> {
    const roleConfig = AGENT_ROLES[agent.role];
    const result: AgentResult = {
      agentId: agent.id,
      role: agent.role,
      target: agent.task.target,
      status: 'success',
      startedAt: agent.startedAt!,
      completedAt: 0,
      durationMs: 0,
      findings: [],
      anomalies: [],
      entities: [],
      connections: [],
      metrics: {
        transactionsAnalyzed: 0,
        addressesScanned: 0,
        tokensTracked: 0,
        depth: agent.task.params.depth || 0,
      },
    };

    // Execute tools based on role
    for (const toolName of roleConfig.tools) {
      try {
        const toolResult = await this.toolExecutor(toolName, {
          ...agent.task.params,
          target: agent.task.target,
          address: agent.task.target,
          signature: agent.task.target,
        });

        // Process results based on tool
        this.processToolResult(result, toolName, toolResult, agent);

      } catch (error) {
        // Continue with other tools
        console.warn(`[Agent ${agent.id}] Tool ${toolName} failed:`, error);
      }
    }

    result.completedAt = Date.now();
    result.durationMs = result.completedAt - result.startedAt;

    return result;
  }

  /**
   * Process results from a tool execution
   */
  private processToolResult(result: AgentResult, toolName: string, toolResult: any, agent: Agent): void {
    // Extract findings based on tool type
    switch (toolName) {
      case 'get_account_transactions':
        if (Array.isArray(toolResult)) {
          result.metrics.transactionsAnalyzed += toolResult.length;
          this.extractTransactionFindings(result, toolResult, agent);
        }
        break;

      case 'get_account_portfolio':
        if (toolResult?.data?.tokens) {
          result.metrics.tokensTracked += toolResult.data.tokens.length;
          this.extractPortfolioFindings(result, toolResult, agent);
        }
        break;

      case 'analyze_transaction':
      case 'explain_transaction':
        if (toolResult) {
          this.extractAnalysisFindings(result, toolResult, agent);
        }
        break;

      case 'find_wallet_path':
        if (toolResult?.path) {
          this.extractConnectionFindings(result, toolResult, agent);
        }
        break;

      case 'search':
        if (Array.isArray(toolResult)) {
          this.extractEntityFindings(result, toolResult, agent);
        }
        break;
    }

    result.rawData = { ...result.rawData, [toolName]: toolResult };
  }

  /**
   * Extract findings from transactions
   */
  private extractTransactionFindings(result: AgentResult, transactions: any[], agent: Agent): void {
    // Detect large transfers
    const largeTransfers = transactions.filter(tx =>
      tx.solTransferred && Math.abs(tx.solTransferred) > 100
    );

    for (const tx of largeTransfers) {
      result.findings.push({
        id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: agent.id,
        type: 'large_transfer',
        severity: Math.abs(tx.solTransferred) > 1000 ? 'high' : 'medium',
        title: `Large ${tx.solTransferred > 0 ? 'inflow' : 'outflow'} detected`,
        description: `${Math.abs(tx.solTransferred).toFixed(2)} SOL ${tx.solTransferred > 0 ? 'received' : 'sent'}`,
        evidence: [tx],
        confidence: 100,
        relatedAddresses: [tx.from, tx.to].filter(Boolean),
        relatedTransactions: [tx.signature],
      });
    }

    // Detect rapid transactions
    const sortedTxs = [...transactions].sort((a, b) => a.blockTime - b.blockTime);
    for (let i = 1; i < sortedTxs.length; i++) {
      const timeDiff = sortedTxs[i].blockTime - sortedTxs[i - 1].blockTime;
      if (timeDiff < 10) {  // Less than 10 seconds apart
        result.anomalies.push({
          id: `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          type: 'rapid_transactions',
          severity: 'medium',
          description: 'Multiple transactions within 10 seconds',
          indicators: ['high_frequency', 'potential_bot'],
          score: 60,
          addresses: [agent.task.target],
          transactions: [sortedTxs[i - 1].signature, sortedTxs[i].signature],
        });
      }
    }
  }

  /**
   * Extract findings from portfolio
   */
  private extractPortfolioFindings(result: AgentResult, portfolio: any, agent: Agent): void {
    const tokens = portfolio.data?.tokens || [];

    // Detect concentrated holdings
    const totalValue = tokens.reduce((sum: number, t: any) => sum + (t.valueUsd || 0), 0);
    for (const token of tokens) {
      const concentration = totalValue > 0 ? (token.valueUsd || 0) / totalValue : 0;
      if (concentration > 0.5 && token.symbol !== 'SOL') {
        result.findings.push({
          id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          type: 'concentrated_holding',
          severity: 'info',
          title: `High concentration in ${token.symbol}`,
          description: `${(concentration * 100).toFixed(1)}% of portfolio in single token`,
          evidence: [token],
          confidence: 100,
          relatedAddresses: [agent.task.target],
          relatedTransactions: [],
        });
      }
    }
  }

  /**
   * Extract findings from analysis
   */
  private extractAnalysisFindings(result: AgentResult, analysis: any, agent: Agent): void {
    if (analysis.riskLevel && analysis.riskLevel !== 'low') {
      result.findings.push({
        id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: agent.id,
        type: 'risk_assessment',
        severity: analysis.riskLevel === 'high' ? 'high' : 'medium',
        title: `Transaction risk: ${analysis.riskLevel}`,
        description: analysis.summary || analysis.explanation || '',
        evidence: [analysis],
        confidence: analysis.confidence || 80,
        relatedAddresses: analysis.addresses || [],
        relatedTransactions: analysis.signature ? [analysis.signature] : [],
      });
    }
  }

  /**
   * Extract connection findings
   */
  private extractConnectionFindings(result: AgentResult, pathResult: any, agent: Agent): void {
    const path = pathResult.path || [];
    for (let i = 0; i < path.length - 1; i++) {
      result.connections.push({
        from: path[i],
        to: path[i + 1],
        type: 'direct_transfer',
        strength: 100 - (i * 10),  // Closer connections are stronger
        transactions: pathResult.transactions?.slice(i, i + 1) || [],
      });
    }
  }

  /**
   * Extract entity findings from search
   */
  private extractEntityFindings(result: AgentResult, searchResults: any[], agent: Agent): void {
    for (const item of searchResults) {
      if (item.type === 'account' && item.label) {
        result.entities.push({
          address: item.address || item.pubkey,
          name: item.label || item.name,
          type: this.categorizeEntity(item.label),
          confidence: 90,
          labels: item.tags || [],
          source: 'search',
        });
      }
    }
  }

  /**
   * Categorize entity type from label
   */
  private categorizeEntity(label: string): IdentifiedEntity['type'] {
    const lower = label.toLowerCase();
    if (lower.includes('exchange') || lower.includes('binance') || lower.includes('coinbase')) return 'exchange';
    if (lower.includes('protocol') || lower.includes('program')) return 'protocol';
    if (lower.includes('bridge') || lower.includes('wormhole')) return 'bridge';
    if (lower.includes('mixer') || lower.includes('tornado')) return 'mixer';
    if (lower.includes('whale')) return 'whale';
    return 'unknown';
  }

  /**
   * Check for follow-up investigation opportunities
   */
  private checkFollowUpOpportunities(investigation: Investigation): void {
    if (investigation.agents.length >= investigation.config.maxAgents) return;

    // Spawn follow-ups for high-severity anomalies
    for (const anomaly of investigation.anomalies) {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        for (const address of anomaly.addresses) {
          if (address !== investigation.target && !this.hasAgentForTarget(investigation, address)) {
            this.spawnAgent(investigation, 'wallet_forensics', address, {
              depth: (investigation.config.maxDepth || 3) - 1,
              reason: `Follow-up from anomaly: ${anomaly.type}`,
            });
          }
        }
      }
    }

    // Spawn follow-ups for interesting connections
    for (const connection of investigation.connections) {
      if (connection.strength > 80) {
        const targets = [connection.from, connection.to].filter(
          t => t !== investigation.target && !this.hasAgentForTarget(investigation, t)
        );
        for (const target of targets.slice(0, 2)) {
          this.spawnAgent(investigation, 'transaction_tracer', target, {
            depth: 1,
            reason: 'Strong connection detected',
          });
        }
      }
    }
  }

  /**
   * Check if an agent already exists for a target
   */
  private hasAgentForTarget(investigation: Investigation, target: string): boolean {
    return investigation.agents.some(a => a.task.target === target);
  }

  /**
   * Calculate overall progress
   */
  private calculateProgress(investigation: Investigation): number {
    if (investigation.agents.length === 0) return 0;

    const totalProgress = investigation.agents.reduce((sum, agent) => {
      switch (agent.status) {
        case 'completed': return sum + 100;
        case 'failed': return sum + 100;
        case 'running': return sum + agent.progress;
        default: return sum;
      }
    }, 0);

    return Math.round(totalProgress / investigation.agents.length);
  }

  /**
   * Cancel pending agents
   */
  private cancelPendingAgents(investigation: Investigation): void {
    for (const agent of investigation.agents) {
      if (agent.status === 'pending') {
        agent.status = 'cancelled';
      }
    }
  }

  /**
   * Synthesize all results into final report
   */
  private async synthesizeResults(investigation: Investigation): Promise<void> {
    // Deduplicate findings
    investigation.findings = this.deduplicateFindings(investigation.findings);
    investigation.anomalies = this.deduplicateAnomalies(investigation.anomalies);
    investigation.entities = this.deduplicateEntities(investigation.entities);
    investigation.connections = this.mergeConnections(investigation.connections);

    // Calculate risk score
    investigation.riskScore = this.calculateRiskScore(investigation);

    // Sort by severity
    investigation.findings.sort((a, b) => this.severityOrder(b.severity) - this.severityOrder(a.severity));
    investigation.anomalies.sort((a, b) => this.severityOrder(b.severity) - this.severityOrder(a.severity));
  }

  /**
   * Deduplicate findings
   */
  private deduplicateFindings(findings: AgentFinding[]): AgentFinding[] {
    const seen = new Map<string, AgentFinding>();

    for (const finding of findings) {
      const key = `${finding.type}:${finding.relatedTransactions.sort().join(',')}`;
      const existing = seen.get(key);

      if (!existing || finding.confidence > existing.confidence) {
        seen.set(key, finding);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Deduplicate anomalies
   */
  private deduplicateAnomalies(anomalies: AgentAnomaly[]): AgentAnomaly[] {
    const seen = new Map<string, AgentAnomaly>();

    for (const anomaly of anomalies) {
      const key = `${anomaly.type}:${anomaly.transactions.sort().join(',')}`;
      const existing = seen.get(key);

      if (!existing || anomaly.score > existing.score) {
        seen.set(key, anomaly);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Deduplicate entities
   */
  private deduplicateEntities(entities: IdentifiedEntity[]): IdentifiedEntity[] {
    const seen = new Map<string, IdentifiedEntity>();

    for (const entity of entities) {
      const existing = seen.get(entity.address);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(entity.address, entity);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Merge overlapping connections
   */
  private mergeConnections(connections: Connection[]): Connection[] {
    const merged = new Map<string, Connection>();

    for (const conn of connections) {
      const key = `${conn.from}:${conn.to}`;
      const existing = merged.get(key);

      if (existing) {
        existing.strength = Math.max(existing.strength, conn.strength);
        existing.transactions = [...new Set([...existing.transactions, ...conn.transactions])];
        existing.totalValue = (existing.totalValue || 0) + (conn.totalValue || 0);
      } else {
        merged.set(key, { ...conn });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(investigation: Investigation): number {
    let score = 0;

    // Add points for anomalies
    for (const anomaly of investigation.anomalies) {
      switch (anomaly.severity) {
        case 'critical': score += 30; break;
        case 'high': score += 20; break;
        case 'medium': score += 10; break;
        case 'low': score += 5; break;
      }
    }

    // Add points for high-severity findings
    for (const finding of investigation.findings) {
      switch (finding.severity) {
        case 'critical': score += 25; break;
        case 'high': score += 15; break;
        case 'medium': score += 8; break;
        case 'low': score += 3; break;
      }
    }

    // Normalize to 0-100
    return Math.min(100, score);
  }

  /**
   * Convert severity to number for sorting
   */
  private severityOrder(severity: string): number {
    switch (severity) {
      case 'critical': return 5;
      case 'high': return 4;
      case 'medium': return 3;
      case 'low': return 2;
      case 'info': return 1;
      default: return 0;
    }
  }

  /**
   * Get investigation status
   */
  getInvestigation(id: string): Investigation | null {
    return this.investigations.get(id) || null;
  }

  /**
   * List all investigations
   */
  listInvestigations(): Investigation[] {
    return Array.from(this.investigations.values());
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MultiAgentOrchestrator,
  AGENT_ROLES,
  INVESTIGATION_TEMPLATES,
};
