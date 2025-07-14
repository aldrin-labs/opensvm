/**
 * Externalized Anomaly Detection Patterns
 * 
 * This module contains all anomaly detection patterns and unified severity logic
 * for the OpenSVM blockchain monitoring system.
 */

export interface AnomalyPattern {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  category: 'financial' | 'security' | 'performance' | 'behavior' | 'token_manipulation';
  check: (event: any, context: AnomalyContext) => boolean;
  metadata?: {
    tags?: string[];
    mlWeight?: number;
    confidence?: number;
  };
}

export interface AnomalyContext {
  recentEvents: any[];
  transactionVolume: number;
  averageFees: number;
  errorRate: number;
  timestamp: number;
  timeWindowMs?: number;
  // Enhanced statistical context
  feeStatistics: {
    mean: number;
    median: number;
    stdDev: number;
    percentiles: { p95: number; p99: number };
    movingAverage: number;
  };
  transactionStatistics: {
    volumeMovingAverage: number;
    volumeStdDev: number;
    intervalStatistics: {
      mean: number;
      stdDev: number;
      outlierThreshold: number;
    };
  };
  baselineData: {
    historicalAverageFees: number;
    historicalVolumeAverage: number;
    historicalErrorRate: number;
    dataPoints: number;
    lastUpdated: number;
  };
}

/**
 * Statistical utility functions for anomaly detection
 */
export class AnomalyStatistics {
  static calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  static calculateStdDev(values: number[], mean?: number): number {
    if (values.length <= 1) return 0;
    const actualMean = mean ?? this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  static calculateMovingAverage(values: number[], windowSize: number = 20): number {
    if (values.length === 0) return 0;
    const window = values.slice(-windowSize);
    return this.calculateMean(window);
  }

  static isStatisticalOutlier(value: number, mean: number, stdDev: number, threshold: number = 3): boolean {
    if (stdDev === 0) return false;
    const zScore = Math.abs(value - mean) / stdDev;
    return zScore > threshold;
  }

  static detectTrendAnomaly(values: number[], windowSize: number = 10): { isAnomaly: boolean; trendStrength: number } {
    if (values.length < windowSize) return { isAnomaly: false, trendStrength: 0 };
    
    const recent = values.slice(-windowSize);
    const correlationCoeff = this.calculateTrendCorrelation(recent);
    
    // Strong trend (positive or negative) with sudden change indicates anomaly
    const isAnomaly = Math.abs(correlationCoeff) > 0.7 && recent.length > 5;
    return { isAnomaly, trendStrength: Math.abs(correlationCoeff) };
  }

  private static calculateTrendCorrelation(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  }
}

/**
 * Enhanced severity logic with statistical analysis
 */
export function calculateSeverity(
  pattern: AnomalyPattern, 
  event: any, 
  context: AnomalyContext,
  confidenceScore: number = 1.0
): 'low' | 'medium' | 'high' | 'critical' {
  const baseSeverity = pattern.severity;
  const mlWeight = pattern.metadata?.mlWeight || 1.0;
  const eventFrequency = context.recentEvents.length / (context.timeWindowMs || 60000) * 1000;
  
  let adjustedScore = 0;
  
  switch (baseSeverity) {
    case 'low': adjustedScore = 1; break;
    case 'medium': adjustedScore = 2; break;
    case 'high': adjustedScore = 3; break;
    case 'critical': adjustedScore = 4; break;
  }
  
  // Enhanced statistical adjustments
  adjustedScore *= confidenceScore * mlWeight;
  
  // Statistical deviation adjustments
  if (pattern.type === 'suspicious_fee_spike' && context.feeStatistics) {
    const feeValue = event.data?.fee || 0;
    if (AnomalyStatistics.isStatisticalOutlier(feeValue, context.feeStatistics.mean, context.feeStatistics.stdDev, 2)) {
      adjustedScore += 0.5; // Statistical outlier adds severity
    }
  }
  
  // Trend analysis adjustments
  if (context.transactionStatistics && eventFrequency > 1) {
    const volumeValues = context.recentEvents
      .filter(e => e.type === 'transaction')
      .map(e => e.timestamp)
      .slice(-20);
    
    const trendAnalysis = AnomalyStatistics.detectTrendAnomaly(volumeValues);
    if (trendAnalysis.isAnomaly) {
      adjustedScore += trendAnalysis.trendStrength * 0.5;
    }
  }
  
  // Baseline deviation adjustments
  if (context.baselineData && context.baselineData.dataPoints > 50) {
    const currentErrorRate = context.errorRate;
    const baselineErrorRate = context.baselineData.historicalErrorRate;
    
    if (currentErrorRate > baselineErrorRate * 2) {
      adjustedScore += 0.3; // Significant deviation from baseline
    }
  }
  
  if (eventFrequency > 10) adjustedScore += 1;
  if (pattern.category === 'security') adjustedScore += 0.5;
  if (pattern.category === 'financial') adjustedScore += 0.3;
  
  // Convert back to severity levels
  if (adjustedScore >= 4.5) return 'critical';
  if (adjustedScore >= 3.0) return 'high';
  if (adjustedScore >= 2.0) return 'medium';
  return 'low';
}

/**
 * Enhanced core anomaly detection patterns with statistical analysis
 */
export const CORE_PATTERNS: AnomalyPattern[] = [
  {
    type: 'high_failure_rate',
    description: 'Statistically significant spike in transaction failure rate',
    severity: 'high',
    threshold: 0.3,
    category: 'performance',
    check: (_event, context) => {
      // Enhanced statistical analysis for failure rate
      if (!context.baselineData || context.baselineData.dataPoints < 30) {
        return context.errorRate > 0.3; // Fallback to simple threshold
      }
      
      const currentErrorRate = context.errorRate;
      const historicalMean = context.baselineData.historicalErrorRate;
      
      // Calculate recent error rates for standard deviation
      const recentTxs = context.recentEvents.filter(e => e.type === 'transaction');
      const recentWindowSize = Math.min(50, recentTxs.length);
      const recentErrorRates = [];
      
      // Calculate rolling error rates
      for (let i = 10; i <= recentWindowSize; i += 5) {
        const window = recentTxs.slice(-i);
        const failures = window.filter(e => e.data.err !== null).length;
        recentErrorRates.push(failures / window.length);
      }
      
      if (recentErrorRates.length > 3) {
        const stdDev = AnomalyStatistics.calculateStdDev(recentErrorRates);
        return AnomalyStatistics.isStatisticalOutlier(currentErrorRate, historicalMean, stdDev, 2.5);
      }
      
      return currentErrorRate > historicalMean * 3; // 3x historical average
    },
    metadata: { tags: ['performance', 'errors', 'statistical'], mlWeight: 1.3 }
  },
  {
    type: 'suspicious_fee_spike',
    description: 'Statistically anomalous transaction fee spike detected',
    severity: 'medium',
    threshold: 5.0,
    category: 'financial',
    check: (event, context) => {
      if (event.type !== 'transaction' || !event.data.fee) return false;
      
      const currentFee = event.data.fee;
      
      // Enhanced statistical fee analysis
      if (context.feeStatistics) {
        const { mean, stdDev, percentiles } = context.feeStatistics;
        
        // Multiple criteria for fee anomaly
        const isStatOutlier = AnomalyStatistics.isStatisticalOutlier(currentFee, mean, stdDev, 3);
        const exceedsP99 = currentFee > percentiles.p99 * 1.5;
        const exceedsMovingAvg = currentFee > context.feeStatistics.movingAverage * 5;
        
        return isStatOutlier || exceedsP99 || exceedsMovingAvg;
      }
      
      // Fallback to simple threshold
      return currentFee > (context.averageFees * 5);
    },
    metadata: { tags: ['fees', 'financial', 'statistical'], mlWeight: 1.2 }
  },
  {
    type: 'rapid_transaction_burst',
    description: 'Statistically anomalous burst of transactions from address',
    severity: 'high',
    threshold: 10,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      
      const currentSender = event.data.accountKeys?.[0] || event.data.signer || null;
      if (!currentSender) return false;
      
      // Enhanced burst detection with time intervals
      const senderTxs = context.recentEvents
        .filter(e => e.type === 'transaction' && 
                    e.timestamp > Date.now() - 300000 && // 5 minute window
                    (e.data.accountKeys?.[0] === currentSender || e.data.signer === currentSender))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (senderTxs.length < 5) return false;
      
      // Calculate time intervals between transactions
      const intervals = [];
      for (let i = 1; i < senderTxs.length; i++) {
        intervals.push(senderTxs[i].timestamp - senderTxs[i-1].timestamp);
      }
      
      // Statistical analysis of intervals
      const meanInterval = AnomalyStatistics.calculateMean(intervals);
      
      // Burst detected if intervals are consistently very short
      const shortIntervals = intervals.filter(interval => interval < 5000).length; // < 5 seconds
      const burstRatio = shortIntervals / intervals.length;
      
      // Transaction frequency analysis
      const avgTxPerMinute = senderTxs.length / 5; // 5 minute window
      
      return (burstRatio > 0.7 && senderTxs.length > 10) || 
             (avgTxPerMinute > 15) || 
             (meanInterval < 3000 && senderTxs.length > 8);
    },
    metadata: { tags: ['burst', 'behavior', 'statistical'], mlWeight: 1.4 }
  },
  {
    type: 'unusual_program_activity',
    description: 'Statistical anomaly in program interaction patterns',
    severity: 'medium',
    threshold: 100,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      
      // Enhanced program activity analysis
      const currentPrograms = event.data.accountKeys?.slice(1) || [];
      if (currentPrograms.length === 0) return false;
      
      // Analyze historical program usage patterns
      const allPrograms = context.recentEvents
        .filter(e => e.type === 'transaction' && e.data.accountKeys)
        .flatMap(e => e.data.accountKeys.slice(1));
      
      const programFreq = new Map<string, number>();
      allPrograms.forEach(program => {
        programFreq.set(program, (programFreq.get(program) || 0) + 1);
      });
      
      const totalUsage = allPrograms.length;
      
      // Check for interactions with rarely used programs
      const rarePrograms = currentPrograms.filter((program: string) => {
        const usage = programFreq.get(program) || 0;
        const frequency = totalUsage > 0 ? usage / totalUsage : 0;
        return frequency < 0.01 && usage < 3; // < 1% frequency and < 3 total uses
      });
      
      // Error pattern analysis
      if (event.data.logs) {
        const suspiciousPatterns = ['error', 'failed', 'insufficient', 'unauthorized', 'revert', 'panic'];
        const errorCount = event.data.logs.filter((log: string) => 
          suspiciousPatterns.some(pattern => log.toLowerCase().includes(pattern))
        ).length;
        
        const hasSignificantErrors = errorCount > 2 || 
          (errorCount > 0 && event.data.logs.length > 0 && errorCount / event.data.logs.length > 0.5);
        
        return rarePrograms.length > 0 && hasSignificantErrors;
      }
      
      return rarePrograms.length > 1; // Multiple rare programs in single transaction
    },
    metadata: { tags: ['programs', 'errors', 'statistical'], mlWeight: 1.1 }
  }
];

/**
 * Pump/Chan token manipulation patterns
 */
export const PUMP_CHAN_PATTERNS: AnomalyPattern[] = [
  {
    type: 'pump_token_creation_burst',
    description: 'Suspicious burst of token creation with pump-like characteristics',
    severity: 'high',
    threshold: 5,
    category: 'token_manipulation',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      const logs = event.data.logs || [];
      const hasPumpSignatures = logs.some((log: string) => 
        log.includes('mint') && (log.includes('pump') || log.includes('chan')));
      const recentPumpCreations = context.recentEvents
        .filter(e => e.type === 'transaction' && 
                    e.timestamp > Date.now() - 300000 &&
                    (e.data.logs || []).some((log: string) => 
                      log.includes('mint') && (log.includes('pump') || log.includes('chan'))))
        .length;
      return hasPumpSignatures && recentPumpCreations > 5;
    },
    metadata: { tags: ['pump', 'token', 'creation'], mlWeight: 1.5 }
  },
  {
    type: 'pump_rapid_minting',
    description: 'Rapid minting of tokens with pump-like mint addresses',
    severity: 'critical',
    threshold: 20,
    category: 'token_manipulation',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      const logs = event.data.logs || [];
      const isPumpMint = logs.some((log: string) => 
        log.toLowerCase().includes('mint') && 
        (log.includes('pump') || log.includes('chan')));
      
      if (!isPumpMint) return false;
      
      const recentPumpMints = context.recentEvents
        .filter(e => e.type === 'transaction' && 
                    e.timestamp > Date.now() - 120000 &&
                    (e.data.logs || []).some((log: string) => 
                      log.toLowerCase().includes('mint') && 
                      (log.includes('pump') || log.includes('chan'))))
        .length;
      
      return recentPumpMints > 20;
    },
    metadata: { tags: ['pump', 'mint', 'rapid'], mlWeight: 1.8 }
  },
  {
    type: 'pump_liquidity_manipulation',
    description: 'Potential liquidity manipulation in pump tokens',
    severity: 'critical',
    threshold: 3,
    category: 'token_manipulation',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      const logs = event.data.logs || [];
      
      const isPumpToken = logs.some((log: string) => 
        (log.includes('pump') || log.includes('chan')) &&
        (log.includes('swap') || log.includes('trade') || log.includes('exchange')));
      
      if (!isPumpToken) return false;
      
      // Check for rapid back-and-forth trades (wash trading indicator)
      const sameAddressSwaps = context.recentEvents
        .filter(e => e.type === 'transaction' && 
                    e.timestamp > Date.now() - 60000 &&
                    e.data.accountKeys?.[0] === event.data.accountKeys?.[0] &&
                    (e.data.logs || []).some((log: string) => 
                      log.includes('swap') || log.includes('trade')))
        .length;
      
      return sameAddressSwaps > 3;
    },
    metadata: { tags: ['pump', 'liquidity', 'manipulation'], mlWeight: 2.0 }
  },
  {
    type: 'pump_rug_pull_indicator',
    description: 'Potential rug pull pattern in pump tokens',
    severity: 'critical',
    threshold: 1,
    category: 'security',
    check: (event, _context) => {
      if (event.type !== 'transaction') return false;
      const logs = event.data.logs || [];
      
      // Look for large withdrawals from pump token pools
      const isLargeWithdrawal = logs.some((log: string) => 
        (log.includes('pump') || log.includes('chan')) &&
        (log.includes('withdraw') || log.includes('remove_liquidity')) &&
        (log.includes('100%') || log.includes('all') || log.includes('drain')));
      
      return isLargeWithdrawal;
    },
    metadata: { tags: ['pump', 'rug_pull', 'security'], mlWeight: 2.5 }
  }
];

/**
 * Enhanced ML patterns using advanced statistical analysis and pattern recognition
 */
export const ML_ENHANCED_PATTERNS: AnomalyPattern[] = [
  {
    type: 'ml_anomalous_transaction_timing',
    description: 'ML-detected anomalous transaction timing patterns using statistical analysis',
    severity: 'medium',
    threshold: 0.7,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      
      const recentTxTimes = context.recentEvents
        .filter(e => e.type === 'transaction')
        .map(e => e.timestamp)
        .sort((a, b) => a - b);
      
      if (recentTxTimes.length < 10) return false;
      
      // Calculate intervals between transactions
      const intervals = [];
      for (let i = 1; i < recentTxTimes.length; i++) {
        intervals.push(recentTxTimes[i] - recentTxTimes[i-1]);
      }
      
      // Advanced statistical analysis
      const mean = AnomalyStatistics.calculateMean(intervals);
      const stdDev = AnomalyStatistics.calculateStdDev(intervals, mean);
      const median = AnomalyStatistics.calculateMedian(intervals);
      
      // Current interval analysis
      const currentInterval = event.timestamp - recentTxTimes[recentTxTimes.length - 1];
      
      // Multiple anomaly detection criteria
      const isOutlier = AnomalyStatistics.isStatisticalOutlier(currentInterval, mean, stdDev, 2.5);
      const isExtremeDeviation = Math.abs(currentInterval - median) > median * 3;
      
      // Trend analysis for timing patterns
      const recentIntervals = intervals.slice(-10);
      const trendAnalysis = AnomalyStatistics.detectTrendAnomaly(recentIntervals);
      
      // Detect periodic patterns (potential automated behavior)
      const periodicPattern = MLHelpers.detectPeriodicPattern(intervals);
      
      return isOutlier || isExtremeDeviation || trendAnalysis.isAnomaly || periodicPattern.isDetected;
    },
    metadata: { tags: ['ml', 'timing', 'pattern', 'statistical'], mlWeight: 1.5, confidence: 0.85 }
  },
  {
    type: 'ml_program_interaction_anomaly',
    description: 'ML-detected unusual program interaction patterns using graph analysis',
    severity: 'high',
    threshold: 0.8,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction' || !event.data.accountKeys) return false;
      
      // Build program interaction graph
      const interactionGraph = new Map<string, Set<string>>();
      const programUsageFreq = new Map<string, number>();
      
      context.recentEvents
        .filter(e => e.type === 'transaction' && e.data.accountKeys)
        .forEach(e => {
          const programs = e.data.accountKeys.slice(1);
          programs.forEach((program: string) => {
            programUsageFreq.set(program, (programUsageFreq.get(program) || 0) + 1);
            
            // Build co-occurrence graph
            programs.forEach((otherProgram: string) => {
              if (program !== otherProgram) {
                if (!interactionGraph.has(program)) {
                  interactionGraph.set(program, new Set());
                }
                interactionGraph.get(program)!.add(otherProgram);
              }
            });
          });
        });
      
      const currentPrograms = event.data.accountKeys.slice(1);
      const totalTransactions = context.recentEvents.filter(e => e.type === 'transaction').length;
      
      // Analyze current transaction for anomalies
      let anomalyScore = 0;
      
      for (const program of currentPrograms) {
        const usage = programUsageFreq.get(program) || 0;
        const frequency = usage / totalTransactions;
        
        // Rare program usage
        if (frequency < 0.05 && usage < 5) {
          anomalyScore += 0.3;
        }
        
        // Unusual co-occurrence patterns
        const expectedCoOccurrences = interactionGraph.get(program) || new Set();
        const actualCoOccurrences = currentPrograms.filter((p: string) => p !== program);
        
        const unexpectedCoOccurrences = actualCoOccurrences.filter((p: string) =>
          !expectedCoOccurrences.has(p) && (programUsageFreq.get(p) || 0) > 0);
        
        if (unexpectedCoOccurrences.length > 0) {
          anomalyScore += unexpectedCoOccurrences.length * 0.2;
        }
      }
      
      // Program chain complexity analysis
      const complexity = MLHelpers.calculateProgramComplexity(currentPrograms, interactionGraph);
      if (complexity.isUnusual) {
        anomalyScore += 0.4;
      }
      
      return anomalyScore > 0.6;
    },
    metadata: { tags: ['ml', 'programs', 'graph', 'rare'], mlWeight: 1.7, confidence: 0.8 }
  },
  {
    type: 'ml_volume_pattern_anomaly',
    description: 'ML-detected anomalous transaction volume patterns',
    severity: 'medium',
    threshold: 0.75,
    category: 'behavior',
    check: (_event, context) => {
      if (!context.transactionStatistics) return false;
      
      const { volumeMovingAverage, volumeStdDev } = context.transactionStatistics;
      
      // Multi-timeframe analysis
      const timeframes = [60000, 300000, 900000]; // 1min, 5min, 15min
      let anomalyCount = 0;
      
      timeframes.forEach(timeframe => {
        const windowEvents = context.recentEvents.filter(e => 
          e.type === 'transaction' && e.timestamp > Date.now() - timeframe
        );
        
        const windowVolume = windowEvents.length;
        const expectedVolume = volumeMovingAverage * (timeframe / (context.timeWindowMs || 300000));
        
        // Statistical anomaly detection for each timeframe
        if (volumeStdDev > 0) {
          const zScore = Math.abs(windowVolume - expectedVolume) / volumeStdDev;
          if (zScore > 2.5) {
            anomalyCount++;
          }
        }
      });
      
      // Pattern analysis - detect if this is part of a larger pattern
      const volumeHistory = MLHelpers.getVolumeHistory(context.recentEvents, 20);
      const patternAnalysis = AnomalyStatistics.detectTrendAnomaly(volumeHistory, 10);
      
      return anomalyCount >= 2 || patternAnalysis.trendStrength > 0.8;
    },
    metadata: { tags: ['ml', 'volume', 'pattern', 'multi-timeframe'], mlWeight: 1.3, confidence: 0.75 }
  },
  {
    type: 'ml_behavioral_fingerprint_anomaly',
    description: 'ML-detected deviation from established behavioral fingerprints',
    severity: 'high',
    threshold: 0.8,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      
      const sender = event.data.accountKeys?.[0] || event.data.signer;
      if (!sender) return false;
      
      // Build behavioral fingerprint for this address
      const senderHistory = context.recentEvents
        .filter(e => e.type === 'transaction' && 
                    (e.data.accountKeys?.[0] === sender || e.data.signer === sender));
      
      if (senderHistory.length < 5) return false; // Need history to establish pattern
      
      // Analyze behavioral patterns
      const fingerprint = MLHelpers.buildBehavioralFingerprint(senderHistory);
      const currentBehavior = MLHelpers.analyzeBehavior(event);
      
      // Compare current behavior against established fingerprint
      const deviation = MLHelpers.calculateBehavioralDeviation(fingerprint, currentBehavior);
      
      return deviation > 0.7; // Significant deviation from established pattern
    },
    metadata: { tags: ['ml', 'behavioral', 'fingerprint', 'deviation'], mlWeight: 1.8, confidence: 0.9 }
  }
];

// Helper methods for ML analysis (would be implemented as static methods)
// @ts-ignore - Used in pattern check functions above
const MLHelpers = {
  detectPeriodicPattern(intervals: number[]): { isDetected: boolean; period?: number } {
    if (intervals.length < 6) return { isDetected: false };
    
    // Simple autocorrelation for periodic detection
    const maxLag = Math.min(intervals.length / 2, 10);
    let maxCorrelation = 0;
    let detectedPeriod = 0;
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < intervals.length - lag; i++) {
        correlation += intervals[i] * intervals[i + lag];
        count++;
      }
      
      correlation /= count;
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        detectedPeriod = lag;
      }
    }
    
    // Threshold for periodic behavior detection
    return {
      isDetected: maxCorrelation > 0.8,
      period: detectedPeriod
    };
  },

  calculateProgramComplexity(programs: string[], graph: Map<string, Set<string>>): { isUnusual: boolean; complexity: number } {
    const connections = programs.reduce((total, program) => {
      const connections = graph.get(program)?.size || 0;
      return total + connections;
    }, 0);
    
    const avgConnections = programs.length > 0 ? connections / programs.length : 0;
    const complexity = programs.length * avgConnections;
    
    return {
      isUnusual: complexity > 50 || (programs.length > 5 && avgConnections < 1),
      complexity
    };
  },

  getVolumeHistory(events: any[], buckets: number): number[] {
    const now = Date.now();
    const bucketSize = 60000; // 1 minute buckets
    const history: number[] = [];
    
    for (let i = 0; i < buckets; i++) {
      const bucketStart = now - (i + 1) * bucketSize;
      const bucketEnd = now - i * bucketSize;
      
      const bucketCount = events.filter(e => 
        e.type === 'transaction' && 
        e.timestamp >= bucketStart && 
        e.timestamp < bucketEnd
      ).length;
      
      history.unshift(bucketCount);
    }
    
    return history;
  },

  buildBehavioralFingerprint(history: any[]): any {
    // Extract behavioral features
    const features = {
      avgTimeBetweenTxs: 0,
      programUsagePattern: new Map<string, number>(),
      feePattern: { mean: 0, stdDev: 0 },
      timeOfDayPattern: new Map<number, number>(),
      txSizePattern: { mean: 0, stdDev: 0 }
    };
    
    // Calculate timing patterns
    const timestamps = history.map(h => h.timestamp).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    features.avgTimeBetweenTxs = AnomalyStatistics.calculateMean(intervals);
    
    // Program usage patterns
    history.forEach(tx => {
      if (tx.data.accountKeys) {
        tx.data.accountKeys.slice(1).forEach((program: string) => {
          features.programUsagePattern.set(program, 
            (features.programUsagePattern.get(program) || 0) + 1);
        });
      }
    });
    
    return features;
  },

  analyzeBehavior(event: any): any {
    return {
      programs: event.data.accountKeys?.slice(1) || [],
      fee: event.data.fee || 0,
      timeOfDay: new Date(event.timestamp).getHours(),
      size: JSON.stringify(event.data).length
    };
  },

  calculateBehavioralDeviation(fingerprint: any, current: any): number {
    let deviation = 0;
    
    // Program usage deviation
    const usedPrograms = current.programs;
    const knownPrograms = Array.from(fingerprint.programUsagePattern.keys());
    const unknownPrograms = usedPrograms.filter((p: string) => !knownPrograms.includes(p));
    
    if (unknownPrograms.length > 0) {
      deviation += unknownPrograms.length * 0.3;
    }
    
    // Fee deviation (simplified)
    if (fingerprint.feePattern.stdDev > 0) {
      const feeZScore = Math.abs(current.fee - fingerprint.feePattern.mean) / fingerprint.feePattern.stdDev;
      if (feeZScore > 2) {
        deviation += 0.2;
      }
    }
    
    return Math.min(deviation, 1.0);
  }
};

/**
 * Get all patterns combined
 */
export function getAllPatterns(): AnomalyPattern[] {
  return [...CORE_PATTERNS, ...PUMP_CHAN_PATTERNS, ...ML_ENHANCED_PATTERNS];
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: string): AnomalyPattern[] {
  return getAllPatterns().filter(pattern => pattern.category === category);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): AnomalyPattern[] {
  return getAllPatterns().filter(pattern => pattern.severity === severity);
}