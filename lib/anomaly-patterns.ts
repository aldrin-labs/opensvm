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
}

/**
 * Unified severity logic based on multiple factors
 */
export function calculateSeverity(
  pattern: AnomalyPattern, 
  event: any, 
  context: AnomalyContext,
  confidenceScore: number = 1.0
): 'low' | 'medium' | 'high' | 'critical' {
  const baseSeverity = pattern.severity;
  const mlWeight = pattern.metadata?.mlWeight || 1.0;
  const eventFrequency = context.recentEvents.length / (context.timeWindowMs || 60000) * 1000; // events per second
  
  // Adjust severity based on frequency and confidence
  let adjustedScore = 0;
  
  switch (baseSeverity) {
    case 'low': adjustedScore = 1; break;
    case 'medium': adjustedScore = 2; break;
    case 'high': adjustedScore = 3; break;
    case 'critical': adjustedScore = 4; break;
  }
  
  // Apply ML confidence and frequency adjustments
  adjustedScore *= confidenceScore * mlWeight;
  
  if (eventFrequency > 10) adjustedScore += 1; // High frequency events are more severe
  if (pattern.category === 'security') adjustedScore += 0.5; // Security patterns get priority
  if (pattern.category === 'financial') adjustedScore += 0.3; // Financial patterns get slight priority
  
  // Convert back to severity levels
  if (adjustedScore >= 4.5) return 'critical';
  if (adjustedScore >= 3.0) return 'high';
  if (adjustedScore >= 2.0) return 'medium';
  return 'low';
}

/**
 * Core anomaly detection patterns
 */
export const CORE_PATTERNS: AnomalyPattern[] = [
  {
    type: 'high_failure_rate',
    description: 'Unusually high transaction failure rate',
    severity: 'high',
    threshold: 0.3,
    category: 'performance',
    check: (event, context) => context.errorRate > 0.3,
    metadata: { tags: ['performance', 'errors'], mlWeight: 1.2 }
  },
  {
    type: 'suspicious_fee_spike',
    description: 'Sudden spike in transaction fees',
    severity: 'medium',
    threshold: 5.0,
    category: 'financial',
    check: (event, context) => {
      if (event.type !== 'transaction' || !event.data.fee) return false;
      return event.data.fee > (context.averageFees * 5);
    },
    metadata: { tags: ['fees', 'financial'], mlWeight: 1.1 }
  },
  {
    type: 'rapid_transaction_burst',
    description: 'Rapid burst of transactions from same address',
    severity: 'high',
    threshold: 10,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      
      const currentSender = event.data.accountKeys?.[0] || event.data.signer || null;
      if (!currentSender) return false;
      
      const recentFromSameAddress = context.recentEvents
        .filter(e => e.type === 'transaction' && 
                    e.timestamp > Date.now() - 60000 &&
                    (e.data.accountKeys?.[0] === currentSender || e.data.signer === currentSender))
        .length;
      return recentFromSameAddress > 10;
    },
    metadata: { tags: ['burst', 'behavior'], mlWeight: 1.3 }
  },
  {
    type: 'unusual_program_activity',
    description: 'Unusual activity in lesser-known programs',
    severity: 'medium',
    threshold: 100,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction' || !event.data.logs) return false;
      const suspiciousPatterns = ['error', 'failed', 'insufficient', 'unauthorized'];
      return event.data.logs.some((log: string) => 
        suspiciousPatterns.some(pattern => log.toLowerCase().includes(pattern))
      );
    },
    metadata: { tags: ['programs', 'errors'], mlWeight: 1.0 }
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
    check: (event, context) => {
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
 * ML-Enhanced Patterns using simple pattern recognition
 */
export const ML_ENHANCED_PATTERNS: AnomalyPattern[] = [
  {
    type: 'ml_anomalous_transaction_timing',
    description: 'ML-detected anomalous transaction timing patterns',
    severity: 'medium',
    threshold: 0.7,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction') return false;
      
      // Simple ML-like analysis: detect transactions that occur at unusual intervals
      const recentTxTimes = context.recentEvents
        .filter(e => e.type === 'transaction')
        .map(e => e.timestamp)
        .sort((a, b) => a - b);
      
      if (recentTxTimes.length < 5) return false;
      
      // Calculate intervals between transactions
      const intervals = [];
      for (let i = 1; i < recentTxTimes.length; i++) {
        intervals.push(recentTxTimes[i] - recentTxTimes[i-1]);
      }
      
      // Simple outlier detection: if current interval is much different from average
      const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
      const currentInterval = event.timestamp - recentTxTimes[recentTxTimes.length - 1];
      
      // Flag if current interval is more than 3 standard deviations from mean
      const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      return Math.abs(currentInterval - avgInterval) > (3 * stdDev);
    },
    metadata: { tags: ['ml', 'timing', 'pattern'], mlWeight: 1.4, confidence: 0.8 }
  },
  {
    type: 'ml_program_interaction_anomaly',
    description: 'ML-detected unusual program interaction patterns',
    severity: 'high',
    threshold: 0.8,
    category: 'behavior',
    check: (event, context) => {
      if (event.type !== 'transaction' || !event.data.accountKeys) return false;
      
      // Analyze program interaction patterns
      const programInteractions = context.recentEvents
        .filter(e => e.type === 'transaction' && e.data.accountKeys)
        .map(e => e.data.accountKeys.slice(1)) // Skip the sender
        .flat();
      
      // Count frequency of each program
      const programFreq = new Map<string, number>();
      programInteractions.forEach(program => {
        programFreq.set(program, (programFreq.get(program) || 0) + 1);
      });
      
      // Check if current transaction interacts with rarely used programs
      const currentPrograms = event.data.accountKeys.slice(1);
      const rareProgramInteraction = currentPrograms.some(program => {
        const freq = programFreq.get(program) || 0;
        const totalInteractions = programInteractions.length;
        return totalInteractions > 10 && freq / totalInteractions < 0.05; // Less than 5% frequency
      });
      
      return rareProgramInteraction;
    },
    metadata: { tags: ['ml', 'programs', 'rare'], mlWeight: 1.6, confidence: 0.75 }
  }
];

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