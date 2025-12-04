/**
 * Anomaly Detection Module
 *
 * Detects suspicious patterns and anomalies in blockchain data:
 * - Timing anomalies (bot activity, coordinated transactions)
 * - Volume anomalies (unusual amounts, spikes)
 * - Flow anomalies (circular flows, layering)
 * - Behavioral anomalies (deviation from typical patterns)
 */

import type {
  InvestigationState,
  AnomalyFinding,
  RiskIndicator,
  RiskLevel,
  Evidence,
  TransactionSummary,
  TokenTransfer,
} from './types';

/**
 * Detection thresholds
 */
const THRESHOLDS = {
  // Timing
  RAPID_TX_INTERVAL_MS: 1000, // Transactions faster than 1s
  SUSPICIOUS_REGULARITY_VARIANCE: 0.1, // Too regular timing (bots)

  // Volume
  LARGE_TRANSFER_USD: 100000, // Over $100k
  VOLUME_SPIKE_MULTIPLIER: 10, // 10x average

  // Patterns
  CIRCULAR_FLOW_MIN_HOPS: 2,
  CIRCULAR_FLOW_MAX_HOPS: 10,
  WASH_TRADE_THRESHOLD: 0.8, // 80% of value returns

  // Risk
  HIGH_FAILURE_RATE: 0.3, // 30% failure rate
  DORMANT_THEN_ACTIVE_HOURS: 720, // 30 days dormant
};

/**
 * Main anomaly detection function
 */
export function detectAnomalies(state: InvestigationState): AnomalyFinding[] {
  const anomalies: AnomalyFinding[] = [];

  // Run all detectors
  anomalies.push(...detectTimingAnomalies(state));
  anomalies.push(...detectVolumeAnomalies(state));
  anomalies.push(...detectFlowAnomalies(state));
  anomalies.push(...detectBehavioralAnomalies(state));
  anomalies.push(...detectKnownPatterns(state));

  // Sort by severity
  anomalies.sort((a, b) => getSeverityScore(b.severity) - getSeverityScore(a.severity));

  return anomalies;
}

/**
 * Detect timing-based anomalies
 */
function detectTimingAnomalies(state: InvestigationState): AnomalyFinding[] {
  const anomalies: AnomalyFinding[] = [];
  const transactions = state.transactions;

  if (transactions.length < 2) return anomalies;

  // Sort by timestamp
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  // 1. Detect rapid transactions (possible bot activity)
  const rapidIntervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (interval < THRESHOLDS.RAPID_TX_INTERVAL_MS && interval > 0) {
      rapidIntervals.push(interval);
    }
  }

  if (rapidIntervals.length >= 3) {
    anomalies.push({
      id: `timing_rapid_${Date.now()}`,
      type: 'rapid_transactions',
      severity: rapidIntervals.length >= 10 ? 'high' : 'medium',
      description: `Detected ${rapidIntervals.length} rapid transactions (< 1s apart). Possible bot activity.`,
      affectedEntities: [state.target.address],
      evidence: [
        {
          type: 'timing',
          description: `Average interval: ${Math.round(rapidIntervals.reduce((a, b) => a + b, 0) / rapidIntervals.length)}ms`,
          data: { intervals: rapidIntervals.slice(0, 10) },
          weight: 0.8,
        },
      ],
      confidence: Math.min(0.95, 0.5 + rapidIntervals.length * 0.05),
      timestamp: Date.now(),
    });
  }

  // 2. Detect suspiciously regular timing (automated trading)
  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
  }

  if (intervals.length >= 5) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intervals.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    if (coefficientOfVariation < THRESHOLDS.SUSPICIOUS_REGULARITY_VARIANCE && mean < 60000) {
      anomalies.push({
        id: `timing_regular_${Date.now()}`,
        type: 'suspicious_regularity',
        severity: 'medium',
        description: `Transaction timing is suspiciously regular (CV: ${coefficientOfVariation.toFixed(3)}). Indicates automated/programmatic trading.`,
        affectedEntities: [state.target.address],
        evidence: [
          {
            type: 'timing',
            description: `Mean interval: ${Math.round(mean / 1000)}s, Coefficient of variation: ${coefficientOfVariation.toFixed(3)}`,
            data: { mean, variance, cv: coefficientOfVariation },
            weight: 0.7,
          },
        ],
        confidence: 0.75,
        timestamp: Date.now(),
      });
    }
  }

  // 3. Detect burst activity after dormancy
  if (sorted.length > 0) {
    const firstTx = sorted[0];
    const latestTx = sorted[sorted.length - 1];
    const now = Date.now();

    // Check for dormant period followed by sudden activity
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
      const gapHours = gap / (1000 * 60 * 60);

      if (gapHours > THRESHOLDS.DORMANT_THEN_ACTIVE_HOURS) {
        // Count transactions after the dormant period
        const activityAfterDormancy = sorted.length - i;

        if (activityAfterDormancy >= 5) {
          anomalies.push({
            id: `timing_reactivation_${Date.now()}`,
            type: 'dormant_reactivation',
            severity: 'medium',
            description: `Wallet dormant for ${Math.round(gapHours / 24)} days, then ${activityAfterDormancy} transactions. Could indicate compromised wallet or coordinated activity.`,
            affectedEntities: [state.target.address],
            evidence: [
              {
                type: 'timing',
                description: `Dormancy: ${Math.round(gapHours)} hours, Activity after: ${activityAfterDormancy} txs`,
                data: { dormancyHours: gapHours, activityCount: activityAfterDormancy },
                weight: 0.6,
              },
            ],
            confidence: 0.65,
            timestamp: Date.now(),
          });
          break; // Only report the first significant dormancy
        }
      }
    }
  }

  return anomalies;
}

/**
 * Detect volume-based anomalies
 */
function detectVolumeAnomalies(state: InvestigationState): AnomalyFinding[] {
  const anomalies: AnomalyFinding[] = [];

  // 1. Large transfers
  const largeTransfers = state.tokenFlows.filter(
    (t) => t.valueUsd && t.valueUsd > THRESHOLDS.LARGE_TRANSFER_USD
  );

  if (largeTransfers.length > 0) {
    const totalValue = largeTransfers.reduce((sum, t) => sum + (t.valueUsd || 0), 0);

    anomalies.push({
      id: `volume_large_${Date.now()}`,
      type: 'large_transfers',
      severity: totalValue > 1000000 ? 'high' : 'medium',
      description: `${largeTransfers.length} large transfer(s) totaling $${totalValue.toLocaleString()}`,
      affectedEntities: [state.target.address],
      evidence: largeTransfers.map((t) => ({
        type: 'volume' as const,
        description: `${t.amount} ${t.symbol} ($${t.valueUsd?.toLocaleString()})`,
        data: t,
        weight: 0.8,
      })),
      confidence: 0.9,
      timestamp: Date.now(),
    });
  }

  // 2. Volume spikes
  if (state.transactions.length >= 10) {
    const volumes = state.transactions.map((t) => t.solTransferred);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    const spikes = state.transactions.filter(
      (t) => t.solTransferred > avgVolume * THRESHOLDS.VOLUME_SPIKE_MULTIPLIER
    );

    if (spikes.length > 0) {
      anomalies.push({
        id: `volume_spike_${Date.now()}`,
        type: 'volume_spike',
        severity: 'medium',
        description: `${spikes.length} transaction(s) with volume ${THRESHOLDS.VOLUME_SPIKE_MULTIPLIER}x+ above average`,
        affectedEntities: spikes.map((t) => t.signature),
        evidence: [
          {
            type: 'volume',
            description: `Average volume: ${avgVolume.toFixed(4)} SOL`,
            data: { avgVolume, spikes: spikes.map((t) => t.solTransferred) },
            weight: 0.7,
          },
        ],
        confidence: 0.75,
        timestamp: Date.now(),
      });
    }
  }

  return anomalies;
}

/**
 * Detect flow-based anomalies (circular flows, layering)
 */
function detectFlowAnomalies(state: InvestigationState): AnomalyFinding[] {
  const anomalies: AnomalyFinding[] = [];

  // 1. Circular flows (funds returning to origin)
  if (state.connections.length > 0) {
    for (const conn of state.connections) {
      // Check if path forms a circle back to source
      if (
        conn.path.length >= THRESHOLDS.CIRCULAR_FLOW_MIN_HOPS &&
        conn.path.length <= THRESHOLDS.CIRCULAR_FLOW_MAX_HOPS
      ) {
        // Check if source appears later in path (circular)
        const sourceIndex = conn.path.indexOf(conn.source);
        if (sourceIndex > 0) {
          anomalies.push({
            id: `flow_circular_${Date.now()}`,
            type: 'circular_flow',
            severity: 'high',
            description: `Circular flow detected: funds return to origin through ${conn.totalHops} hops. Strong indicator of wash trading or money laundering.`,
            affectedEntities: conn.path,
            evidence: [
              {
                type: 'connection',
                description: `Path: ${conn.path.slice(0, 5).join(' -> ')}${conn.path.length > 5 ? '...' : ''}`,
                data: conn,
                weight: 0.9,
              },
            ],
            confidence: 0.85,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  // 2. Token flow concentration
  const flowsByMint = new Map<string, TokenTransfer[]>();
  for (const flow of state.tokenFlows) {
    const existing = flowsByMint.get(flow.mint) || [];
    existing.push(flow);
    flowsByMint.set(flow.mint, existing);
  }

  for (const [mint, flows] of flowsByMint) {
    if (flows.length >= 5) {
      // Calculate in/out balance
      const inflows = flows.filter((f) => f.to === state.target.address);
      const outflows = flows.filter((f) => f.from === state.target.address);

      const inTotal = inflows.reduce((sum, f) => sum + f.amount, 0);
      const outTotal = outflows.reduce((sum, f) => sum + f.amount, 0);

      // Check if roughly equal (wash trading indicator)
      if (inTotal > 0 && outTotal > 0) {
        const ratio = Math.min(inTotal, outTotal) / Math.max(inTotal, outTotal);
        if (ratio > THRESHOLDS.WASH_TRADE_THRESHOLD) {
          anomalies.push({
            id: `flow_wash_${mint}_${Date.now()}`,
            type: 'potential_wash_trading',
            severity: 'high',
            description: `Symmetric in/out flows for ${flows[0]?.symbol || mint} (${(ratio * 100).toFixed(1)}% balance). Potential wash trading.`,
            affectedEntities: [state.target.address, mint],
            evidence: [
              {
                type: 'volume',
                description: `In: ${inTotal}, Out: ${outTotal}, Ratio: ${ratio.toFixed(3)}`,
                data: { mint, inTotal, outTotal, ratio },
                weight: 0.85,
              },
            ],
            confidence: 0.8,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * Detect behavioral anomalies
 */
function detectBehavioralAnomalies(state: InvestigationState): AnomalyFinding[] {
  const anomalies: AnomalyFinding[] = [];

  // 1. High transaction failure rate
  const totalTx = state.transactions.length;
  const failedTx = state.transactions.filter((t) => !t.success).length;

  if (totalTx >= 5 && failedTx / totalTx > THRESHOLDS.HIGH_FAILURE_RATE) {
    anomalies.push({
      id: `behavioral_failure_${Date.now()}`,
      type: 'high_failure_rate',
      severity: 'medium',
      description: `High transaction failure rate: ${failedTx}/${totalTx} (${((failedTx / totalTx) * 100).toFixed(1)}%). Could indicate attempted exploits, MEV activity, or problematic interactions.`,
      affectedEntities: [state.target.address],
      evidence: [
        {
          type: 'pattern',
          description: `${failedTx} failed out of ${totalTx} transactions`,
          data: {
            total: totalTx,
            failed: failedTx,
            rate: failedTx / totalTx,
          },
          weight: 0.7,
        },
      ],
      confidence: 0.75,
      timestamp: Date.now(),
    });
  }

  // 2. Unusual program interactions
  const programCounts = new Map<string, number>();
  for (const tx of state.transactions) {
    for (const program of tx.involvedPrograms) {
      programCounts.set(program, (programCounts.get(program) || 0) + 1);
    }
  }

  // Check for concentration on single program
  const topProgram = Array.from(programCounts.entries())
    .sort((a, b) => b[1] - a[1])[0];

  if (topProgram && topProgram[1] > totalTx * 0.8 && totalTx >= 10) {
    anomalies.push({
      id: `behavioral_program_concentration_${Date.now()}`,
      type: 'program_concentration',
      severity: 'low',
      description: `${((topProgram[1] / totalTx) * 100).toFixed(1)}% of transactions use program ${topProgram[0].slice(0, 8)}... Could indicate targeted activity.`,
      affectedEntities: [state.target.address, topProgram[0]],
      evidence: [
        {
          type: 'pattern',
          description: `${topProgram[1]} of ${totalTx} transactions`,
          data: { program: topProgram[0], count: topProgram[1] },
          weight: 0.5,
        },
      ],
      confidence: 0.6,
      timestamp: Date.now(),
    });
  }

  return anomalies;
}

/**
 * Detect known suspicious patterns
 */
function detectKnownPatterns(state: InvestigationState): AnomalyFinding[] {
  const anomalies: AnomalyFinding[] = [];

  // 1. Dusting attack pattern (many small transfers)
  const smallTransfers = state.tokenFlows.filter(
    (t) => t.valueUsd !== null && t.valueUsd < 0.01
  );

  if (smallTransfers.length >= 10) {
    anomalies.push({
      id: `pattern_dusting_${Date.now()}`,
      type: 'dusting_attack',
      severity: 'low',
      description: `${smallTransfers.length} micro-transfers detected (< $0.01 each). Possible dusting attack for wallet tracking.`,
      affectedEntities: [state.target.address],
      evidence: [
        {
          type: 'pattern',
          description: `${smallTransfers.length} dust transfers`,
          data: { count: smallTransfers.length },
          weight: 0.6,
        },
      ],
      confidence: 0.7,
      timestamp: Date.now(),
    });
  }

  // 2. MEV-like patterns (sandwich, frontrun indicators)
  // Look for transactions in rapid succession with similar values
  const sorted = [...state.transactions].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 1; i < sorted.length - 1; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const next = sorted[i + 1];

    // Check for sandwich pattern: same programs, rapid timing
    const rapidSequence =
      curr.timestamp - prev.timestamp < 2000 && next.timestamp - curr.timestamp < 2000;

    if (rapidSequence) {
      const samePrograms =
        prev.involvedPrograms.some((p) => next.involvedPrograms.includes(p));

      if (samePrograms) {
        anomalies.push({
          id: `pattern_mev_${Date.now()}`,
          type: 'potential_mev',
          severity: 'medium',
          description: `Potential MEV activity detected: rapid transaction sequence with related programs.`,
          affectedEntities: [prev.signature, curr.signature, next.signature],
          evidence: [
            {
              type: 'pattern',
              description: 'Sandwich-like transaction pattern',
              data: {
                timestamps: [prev.timestamp, curr.timestamp, next.timestamp],
              },
              weight: 0.7,
            },
          ],
          confidence: 0.65,
          timestamp: Date.now(),
        });
        break; // Only report once
      }
    }
  }

  return anomalies;
}

/**
 * Calculate overall risk score (0-100)
 */
export function calculateRiskScore(state: InvestigationState): number {
  let score = 0;

  // Base score from anomaly count and severity
  for (const anomaly of state.anomalies) {
    switch (anomaly.severity) {
      case 'critical':
        score += 30;
        break;
      case 'high':
        score += 20;
        break;
      case 'medium':
        score += 10;
        break;
      case 'low':
        score += 5;
        break;
    }
  }

  // Weighted by confidence
  const confidenceWeighted = state.anomalies.reduce(
    (sum, a) => sum + getSeverityScore(a.severity) * a.confidence,
    0
  );

  score = Math.round((score * 0.6 + confidenceWeighted * 0.4));

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Categorize risk level from score
 */
export function categorizeRisk(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Get numeric severity score
 */
function getSeverityScore(severity: RiskLevel): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

/**
 * Create risk indicator from anomaly
 */
export function anomalyToRiskIndicator(anomaly: AnomalyFinding): RiskIndicator {
  return {
    type: anomaly.type,
    severity: anomaly.severity,
    description: anomaly.description,
    evidence: anomaly.evidence.map((e) => e.description),
    score: getSeverityScore(anomaly.severity) * anomaly.confidence * 25,
  };
}
