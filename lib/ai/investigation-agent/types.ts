/**
 * Investigation Agent Types
 *
 * Type definitions for the autonomous blockchain investigation agent
 */

export type InvestigationType =
  | 'wallet_forensics'
  | 'transaction_tracing'
  | 'token_flow_analysis'
  | 'anomaly_detection'
  | 'connection_mapping'
  | 'full_investigation';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type InvestigationStatus =
  | 'idle'
  | 'planning'
  | 'gathering_data'
  | 'analyzing'
  | 'detecting_anomalies'
  | 'tracing_connections'
  | 'generating_report'
  | 'completed'
  | 'failed';

export interface InvestigationTarget {
  type: 'wallet' | 'transaction' | 'token' | 'program';
  address: string;
  label?: string;
}

export interface InvestigationConfig {
  maxDepth: number;
  maxTransactions: number;
  timeRangeHours: number;
  enableAnomalyDetection: boolean;
  enableConnectionMapping: boolean;
  followTokenFlows: boolean;
  riskThreshold: RiskLevel;
}

export interface WalletProfile {
  address: string;
  solBalance: number;
  tokenCount: number;
  totalValueUsd: number | null;
  transactionCount: number;
  firstSeen: number | null;
  lastActive: number | null;
  labels: string[];
  riskIndicators: RiskIndicator[];
}

export interface TransactionSummary {
  signature: string;
  timestamp: number;
  type: string;
  success: boolean;
  involvedPrograms: string[];
  solTransferred: number;
  tokenTransfers: TokenTransfer[];
  riskScore: number;
  flags: string[];
}

export interface TokenTransfer {
  mint: string;
  symbol: string;
  amount: number;
  from: string;
  to: string;
  valueUsd: number | null;
}

export interface RiskIndicator {
  type: string;
  severity: RiskLevel;
  description: string;
  evidence: string[];
  score: number;
}

export interface ConnectionPath {
  source: string;
  target: string;
  path: string[];
  transfers: string[];
  totalHops: number;
  totalValue: number;
}

export interface AnomalyFinding {
  id: string;
  type: string;
  severity: RiskLevel;
  description: string;
  affectedEntities: string[];
  evidence: Evidence[];
  confidence: number;
  timestamp: number;
}

export interface Evidence {
  type: 'transaction' | 'pattern' | 'timing' | 'volume' | 'connection';
  description: string;
  data: any;
  weight: number;
}

export interface InvestigationStep {
  id: string;
  tool: string;
  params: Record<string, any>;
  purpose: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  duration?: number;
}

export interface InvestigationPlan {
  id: string;
  type: InvestigationType;
  target: InvestigationTarget;
  steps: InvestigationStep[];
  estimatedDuration: number;
  createdAt: number;
}

export interface InvestigationState {
  id: string;
  status: InvestigationStatus;
  type: InvestigationType;
  target: InvestigationTarget;
  config: InvestigationConfig;
  plan: InvestigationPlan | null;
  currentStep: number;

  // Gathered data
  walletProfiles: Map<string, WalletProfile>;
  transactions: TransactionSummary[];
  tokenFlows: TokenTransfer[];
  connections: ConnectionPath[];

  // Analysis results
  anomalies: AnomalyFinding[];
  riskScore: number;
  riskLevel: RiskLevel;

  // Metadata
  startedAt: number;
  completedAt: number | null;
  duration: number;
  toolCallCount: number;
  errors: string[];
}

export interface InvestigationReport {
  id: string;
  title: string;
  summary: string;
  target: InvestigationTarget;
  riskAssessment: {
    overallScore: number;
    level: RiskLevel;
    factors: RiskIndicator[];
  };
  findings: {
    anomalies: AnomalyFinding[];
    suspiciousPatterns: string[];
    connections: ConnectionPath[];
  };
  recommendations: string[];
  evidence: Evidence[];
  metadata: {
    investigationType: InvestigationType;
    duration: number;
    toolCallCount: number;
    transactionsAnalyzed: number;
    walletsExamined: number;
    generatedAt: number;
  };
}

export interface ToolCallResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface AgentContext {
  investigation: InvestigationState;
  apiBaseUrl: string;
  timeout: number;
}

/**
 * Stream event types for real-time investigation updates
 */
export type StreamEventType =
  | 'start'
  | 'planning'
  | 'progress'
  | 'tool_call'
  | 'tool_result'
  | 'anomaly'
  | 'finding'
  | 'analysis'
  | 'report'
  | 'complete'
  | 'error'
  // Graph visualization events
  | 'graph_node'
  | 'graph_edge'
  | 'graph_update'
  | 'graph_highlight'
  | 'graph_layout'
  // Narration events
  | 'narration';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  investigationId: string;
  data: any;
}

export type StreamCallback = (event: StreamEvent) => void;

/**
 * Graph visualization types for real-time rendering
 */
export type GraphNodeType =
  | 'wallet'
  | 'transaction'
  | 'token'
  | 'program'
  | 'unknown';

export type GraphNodeStatus =
  | 'normal'
  | 'suspicious'
  | 'flagged'
  | 'highlighted'
  | 'source'
  | 'target';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  status: GraphNodeStatus;
  metadata?: {
    address?: string;
    signature?: string;
    symbol?: string;
    balance?: number;
    valueUsd?: number;
    riskScore?: number;
    [key: string]: any;
  };
  position?: {
    x: number;
    y: number;
  };
}

export type GraphEdgeType =
  | 'transfer'
  | 'interaction'
  | 'token_flow'
  | 'program_call'
  | 'related';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
  weight?: number;
  metadata?: {
    amount?: number;
    symbol?: string;
    valueUsd?: number;
    timestamp?: number;
    signature?: string;
    [key: string]: any;
  };
  animated?: boolean;
}

export interface GraphState {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  focusNodeId?: string;
  layout?: GraphLayoutType;
}

/**
 * Graph layout types optimized for different investigation patterns
 */
export type GraphLayoutType =
  | 'force'        // General purpose, good for exploring connections
  | 'dagre'        // Directed acyclic graph, good for transaction flows
  | 'hierarchical' // Top-down hierarchy, good for token holder analysis
  | 'circular'     // Circular layout, good for connection mapping
  | 'radial'       // Radial from center, good for wallet forensics
  | 'timeline';    // Time-based horizontal layout

export interface GraphLayoutConfig {
  type: GraphLayoutType;
  direction?: 'TB' | 'BT' | 'LR' | 'RL';  // For dagre/hierarchical
  spacing?: number;
  animate?: boolean;
  centerNodeId?: string;  // For radial/force layouts
}

/**
 * Layout recommendations based on investigation type
 */
export const LAYOUT_RECOMMENDATIONS: Record<string, GraphLayoutConfig> = {
  wallet_forensics: {
    type: 'radial',
    animate: true,
    // Center on target wallet
  },
  transaction_tracing: {
    type: 'dagre',
    direction: 'LR',
    animate: true,
  },
  token_flow_analysis: {
    type: 'hierarchical',
    direction: 'TB',
    animate: true,
  },
  anomaly_detection: {
    type: 'force',
    animate: true,
    // Suspicious nodes will cluster together
  },
  connection_mapping: {
    type: 'circular',
    animate: true,
  },
  full_investigation: {
    type: 'force',
    animate: true,
  },
};

/**
 * Narration event for AI-powered graph storytelling
 */
export interface NarrationEvent {
  text: string;
  emphasis?: 'normal' | 'important' | 'critical';
  relatedNodeIds?: string[];
  relatedEdgeIds?: string[];
  timestamp: number;
}
