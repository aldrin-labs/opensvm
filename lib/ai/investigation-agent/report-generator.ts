/**
 * Investigation Report Generator
 *
 * Generates comprehensive reports from investigation findings,
 * including executive summary, detailed findings, and recommendations.
 */

import type {
  InvestigationState,
  InvestigationReport,
  RiskLevel,
  AnomalyFinding,
  RiskIndicator,
  Evidence,
} from './types';

import { anomalyToRiskIndicator } from './anomaly-detector';

/**
 * Generate an investigation report from state
 */
export function generateReport(state: InvestigationState): InvestigationReport {
  const title = generateTitle(state);
  const summary = generateSummary(state);
  const riskAssessment = generateRiskAssessment(state);
  const findings = generateFindings(state);
  const recommendations = generateRecommendations(state);
  const evidence = collectEvidence(state);

  return {
    id: `report_${state.id}`,
    title,
    summary,
    target: state.target,
    riskAssessment,
    findings,
    recommendations,
    evidence,
    metadata: {
      investigationType: state.type,
      duration: state.duration,
      toolCallCount: state.toolCallCount,
      transactionsAnalyzed: state.transactions.length,
      walletsExamined: state.walletProfiles.size,
      generatedAt: Date.now(),
    },
  };
}

/**
 * Generate report title
 */
function generateTitle(state: InvestigationState): string {
  const typeLabels: Record<string, string> = {
    wallet_forensics: 'Wallet Forensics Report',
    transaction_tracing: 'Transaction Tracing Report',
    token_flow_analysis: 'Token Flow Analysis Report',
    anomaly_detection: 'Anomaly Detection Report',
    connection_mapping: 'Wallet Connection Mapping Report',
    full_investigation: 'Comprehensive Investigation Report',
  };

  const label = typeLabels[state.type] || 'Investigation Report';
  const shortAddress = `${state.target.address.slice(0, 6)}...${state.target.address.slice(-4)}`;

  return `${label}: ${shortAddress}`;
}

/**
 * Generate executive summary
 */
function generateSummary(state: InvestigationState): string {
  const parts: string[] = [];

  // Opening
  parts.push(
    `Investigation of ${state.target.type} ${state.target.address.slice(0, 8)}... completed.`
  );

  // Risk level
  const riskDescriptions: Record<RiskLevel, string> = {
    low: 'LOW risk. No significant suspicious activity detected.',
    medium: 'MEDIUM risk. Some concerning patterns identified.',
    high: 'HIGH risk. Multiple suspicious patterns detected that warrant attention.',
    critical: 'CRITICAL risk. Strong indicators of malicious or fraudulent activity.',
  };
  parts.push(riskDescriptions[state.riskLevel]);

  // Key metrics
  parts.push(
    `Analyzed ${state.transactions.length} transactions across ${state.walletProfiles.size} wallet(s).`
  );

  // Anomaly summary
  if (state.anomalies.length > 0) {
    const criticalCount = state.anomalies.filter((a) => a.severity === 'critical').length;
    const highCount = state.anomalies.filter((a) => a.severity === 'high').length;
    const mediumCount = state.anomalies.filter((a) => a.severity === 'medium').length;

    const anomalyParts = [];
    if (criticalCount > 0) anomalyParts.push(`${criticalCount} critical`);
    if (highCount > 0) anomalyParts.push(`${highCount} high`);
    if (mediumCount > 0) anomalyParts.push(`${mediumCount} medium`);

    if (anomalyParts.length > 0) {
      parts.push(`Detected ${state.anomalies.length} anomalies (${anomalyParts.join(', ')}).`);
    }
  } else {
    parts.push('No anomalies detected.');
  }

  // Duration
  const durationSec = Math.round(state.duration / 1000);
  parts.push(`Investigation completed in ${durationSec}s with ${state.toolCallCount} API calls.`);

  return parts.join(' ');
}

/**
 * Generate risk assessment
 */
function generateRiskAssessment(state: InvestigationState): {
  overallScore: number;
  level: RiskLevel;
  factors: RiskIndicator[];
} {
  const factors: RiskIndicator[] = state.anomalies.map(anomalyToRiskIndicator);

  // Add wallet-based risk factors
  for (const [address, profile] of state.walletProfiles) {
    // High value wallet
    if (profile.totalValueUsd && profile.totalValueUsd > 1000000) {
      factors.push({
        type: 'high_value_target',
        severity: 'medium',
        description: `High-value wallet ($${profile.totalValueUsd.toLocaleString()})`,
        evidence: [`Portfolio value: $${profile.totalValueUsd.toLocaleString()}`],
        score: 15,
      });
    }

    // Many risk indicators
    if (profile.riskIndicators.length >= 3) {
      factors.push({
        type: 'multiple_risk_indicators',
        severity: 'high',
        description: `${profile.riskIndicators.length} risk indicators on wallet`,
        evidence: profile.riskIndicators.map((r) => r.description),
        score: 25,
      });
    }
  }

  return {
    overallScore: state.riskScore,
    level: state.riskLevel,
    factors,
  };
}

/**
 * Generate detailed findings
 */
function generateFindings(state: InvestigationState): {
  anomalies: AnomalyFinding[];
  suspiciousPatterns: string[];
  connections: typeof state.connections;
} {
  // Extract suspicious patterns from anomalies
  const suspiciousPatterns: string[] = [];

  for (const anomaly of state.anomalies) {
    if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
      suspiciousPatterns.push(anomaly.description);
    }
  }

  // Add pattern summaries
  const transactionFlags = new Map<string, number>();
  for (const tx of state.transactions) {
    for (const flag of tx.flags) {
      transactionFlags.set(flag, (transactionFlags.get(flag) || 0) + 1);
    }
  }

  for (const [flag, count] of transactionFlags) {
    if (count >= 3) {
      suspiciousPatterns.push(`${count} transactions flagged for: ${flag.replace(/_/g, ' ')}`);
    }
  }

  return {
    anomalies: state.anomalies,
    suspiciousPatterns,
    connections: state.connections,
  };
}

/**
 * Generate recommendations based on findings
 */
function generateRecommendations(state: InvestigationState): string[] {
  const recommendations: string[] = [];

  // Base recommendations on risk level
  if (state.riskLevel === 'critical') {
    recommendations.push('URGENT: Consider blocking/flagging this address immediately.');
    recommendations.push('Escalate to compliance/security team for manual review.');
    recommendations.push('Preserve all evidence for potential legal/regulatory action.');
  } else if (state.riskLevel === 'high') {
    recommendations.push('Monitor this address closely for continued suspicious activity.');
    recommendations.push('Consider enhanced due diligence before interacting.');
    recommendations.push('Review connected wallets for additional risk exposure.');
  }

  // Specific recommendations based on anomaly types
  const anomalyTypes = new Set(state.anomalies.map((a) => a.type));

  if (anomalyTypes.has('circular_flow') || anomalyTypes.has('potential_wash_trading')) {
    recommendations.push(
      'Investigate token flow patterns for wash trading or market manipulation.'
    );
  }

  if (anomalyTypes.has('rapid_transactions') || anomalyTypes.has('suspicious_regularity')) {
    recommendations.push(
      'Likely automated/bot activity. Review for MEV extraction or exploit attempts.'
    );
  }

  if (anomalyTypes.has('dormant_reactivation')) {
    recommendations.push(
      'Wallet reactivation after dormancy. Verify ownership has not been compromised.'
    );
  }

  if (anomalyTypes.has('large_transfers')) {
    recommendations.push(
      'Large value movements detected. Verify legitimacy and destination wallets.'
    );
  }

  if (anomalyTypes.has('dusting_attack')) {
    recommendations.push(
      'Potential dusting attack. Avoid interacting with dust tokens to prevent tracking.'
    );
  }

  if (anomalyTypes.has('potential_mev')) {
    recommendations.push(
      'MEV activity indicators present. Consider using MEV protection for future transactions.'
    );
  }

  // Connection-based recommendations
  if (state.connections.length > 0) {
    recommendations.push(
      `${state.connections.length} wallet connection(s) found. Review for sybil or related party activity.`
    );
  }

  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push('No immediate action required based on investigation findings.');
    recommendations.push('Continue standard monitoring procedures.');
  }

  return recommendations;
}

/**
 * Collect all evidence from investigation
 */
function collectEvidence(state: InvestigationState): Evidence[] {
  const evidence: Evidence[] = [];

  // Evidence from anomalies
  for (const anomaly of state.anomalies) {
    evidence.push(...anomaly.evidence);
  }

  // Transaction evidence
  for (const tx of state.transactions.slice(0, 20)) {
    // Limit to 20 most relevant
    if (tx.flags.length > 0) {
      evidence.push({
        type: 'transaction',
        description: `Transaction ${tx.signature.slice(0, 8)}... flagged: ${tx.flags.join(', ')}`,
        data: {
          signature: tx.signature,
          flags: tx.flags,
          type: tx.type,
        },
        weight: 0.5,
      });
    }
  }

  // Connection evidence
  for (const conn of state.connections) {
    evidence.push({
      type: 'connection',
      description: `Path from ${conn.source.slice(0, 8)}... to ${conn.target.slice(0, 8)}... (${conn.totalHops} hops)`,
      data: conn,
      weight: 0.7,
    });
  }

  // Sort by weight
  evidence.sort((a, b) => b.weight - a.weight);

  return evidence;
}

/**
 * Format report as Markdown
 */
export function formatReportAsMarkdown(report: InvestigationReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`**Generated:** ${new Date(report.metadata.generatedAt).toISOString()}`);
  lines.push(`**Target:** \`${report.target.address}\` (${report.target.type})`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(report.summary);
  lines.push('');

  // Risk Assessment
  lines.push('## Risk Assessment');
  lines.push('');
  lines.push(`**Overall Risk Score:** ${report.riskAssessment.overallScore}/100`);
  lines.push(`**Risk Level:** ${report.riskAssessment.level.toUpperCase()}`);
  lines.push('');

  if (report.riskAssessment.factors.length > 0) {
    lines.push('### Risk Factors');
    lines.push('');
    for (const factor of report.riskAssessment.factors) {
      lines.push(
        `- **${factor.type}** (${factor.severity}): ${factor.description}`
      );
    }
    lines.push('');
  }

  // Findings
  lines.push('## Findings');
  lines.push('');

  if (report.findings.anomalies.length > 0) {
    lines.push('### Anomalies Detected');
    lines.push('');
    for (const anomaly of report.findings.anomalies) {
      lines.push(`#### ${anomaly.type} (${anomaly.severity})`);
      lines.push(anomaly.description);
      lines.push(`*Confidence: ${(anomaly.confidence * 100).toFixed(0)}%*`);
      lines.push('');
    }
  }

  if (report.findings.suspiciousPatterns.length > 0) {
    lines.push('### Suspicious Patterns');
    lines.push('');
    for (const pattern of report.findings.suspiciousPatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  if (report.findings.connections.length > 0) {
    lines.push('### Wallet Connections');
    lines.push('');
    for (const conn of report.findings.connections) {
      lines.push(
        `- ${conn.source.slice(0, 8)}... -> ${conn.target.slice(0, 8)}... (${conn.totalHops} hops)`
      );
    }
    lines.push('');
  }

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  for (let i = 0; i < report.recommendations.length; i++) {
    lines.push(`${i + 1}. ${report.recommendations[i]}`);
  }
  lines.push('');

  // Metadata
  lines.push('## Investigation Metadata');
  lines.push('');
  lines.push(`- **Investigation Type:** ${report.metadata.investigationType}`);
  lines.push(`- **Duration:** ${(report.metadata.duration / 1000).toFixed(1)}s`);
  lines.push(`- **API Calls:** ${report.metadata.toolCallCount}`);
  lines.push(`- **Transactions Analyzed:** ${report.metadata.transactionsAnalyzed}`);
  lines.push(`- **Wallets Examined:** ${report.metadata.walletsExamined}`);
  lines.push('');

  // Evidence (abbreviated)
  if (report.evidence.length > 0) {
    lines.push('## Evidence Summary');
    lines.push('');
    const topEvidence = report.evidence.slice(0, 10);
    for (const ev of topEvidence) {
      lines.push(`- [${ev.type}] ${ev.description}`);
    }
    if (report.evidence.length > 10) {
      lines.push(`- ... and ${report.evidence.length - 10} more items`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Report generated by OpenSVM Investigation Agent*');

  return lines.join('\n');
}

/**
 * Format report as JSON (for API responses)
 */
export function formatReportAsJSON(report: InvestigationReport): string {
  return JSON.stringify(report, null, 2);
}
