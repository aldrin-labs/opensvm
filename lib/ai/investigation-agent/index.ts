/**
 * Investigation Agent
 *
 * Autonomous blockchain forensics agent that chains MCP tools
 * to perform self-directed investigations.
 *
 * Features:
 * - Wallet forensics
 * - Transaction tracing
 * - Token flow analysis
 * - Anomaly detection
 * - Connection mapping
 * - Comprehensive report generation
 */

export * from './types';
export * from './strategies';
export * from './orchestrator';
export * from './anomaly-detector';
export * from './report-generator';

// Re-export main classes and functions
export {
  InvestigationOrchestrator,
  createInvestigationAgent,
  investigate,
} from './orchestrator';

export {
  createInvestigationPlan,
  selectStrategy,
  DEFAULT_CONFIG,
} from './strategies';

export {
  detectAnomalies,
  calculateRiskScore,
  categorizeRisk,
} from './anomaly-detector';

export {
  generateReport,
  formatReportAsMarkdown,
  formatReportAsJSON,
} from './report-generator';
