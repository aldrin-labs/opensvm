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
