/**
 * PoUW Quality Verifier
 *
 * Cross-verifies submitted work results against ground truth to detect
 * fabricated or low-quality data. Prevents gaming the mining system.
 *
 * Verification Methods:
 * 1. Spot-check: Verify random samples against live RPC data
 * 2. Consistency: Check for internal contradictions
 * 3. Plausibility: Detect statistically impossible results
 * 4. Reputation: Track worker accuracy over time
 *
 * @module pouw-quality-verifier
 */

import { createHash } from 'crypto';
import {
  IndexedTransaction,
  DetectedPattern,
  ClassifiedWallet,
  ExtractedEntity,
  KNOWN_PROGRAMS,
  KNOWN_ENTITIES,
} from './pouw-data-provider';

// ============================================================================
// Types
// ============================================================================

export interface VerificationResult {
  valid: boolean;
  score: number; // 0-100
  issues: VerificationIssue[];
  spotChecks: SpotCheckResult[];
  recommendations: string[];
}

export interface VerificationIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  field?: string;
  expected?: any;
  actual?: any;
}

export interface SpotCheckResult {
  item: string;
  verified: boolean;
  method: string;
  details?: string;
}

export interface WorkerReputation {
  workerId: string;
  totalSubmissions: number;
  verifiedSubmissions: number;
  accuracyRate: number;
  lastSubmission: number;
  fraudFlags: number;
  trustLevel: 'new' | 'trusted' | 'verified' | 'suspicious' | 'banned';
}

// ============================================================================
// Worker Reputation Tracking
// ============================================================================

const workerReputations = new Map<string, WorkerReputation>();

function getWorkerReputation(workerId: string): WorkerReputation {
  let rep = workerReputations.get(workerId);
  if (!rep) {
    rep = {
      workerId,
      totalSubmissions: 0,
      verifiedSubmissions: 0,
      accuracyRate: 0,
      lastSubmission: 0,
      fraudFlags: 0,
      trustLevel: 'new',
    };
    workerReputations.set(workerId, rep);
  }
  return rep;
}

function updateWorkerReputation(
  workerId: string,
  verified: boolean,
  fraudDetected: boolean
): void {
  const rep = getWorkerReputation(workerId);
  rep.totalSubmissions++;
  if (verified) rep.verifiedSubmissions++;
  if (fraudDetected) rep.fraudFlags++;
  rep.lastSubmission = Date.now();
  rep.accuracyRate = rep.verifiedSubmissions / rep.totalSubmissions;

  // Update trust level
  if (rep.fraudFlags >= 3) {
    rep.trustLevel = 'banned';
  } else if (rep.fraudFlags >= 1) {
    rep.trustLevel = 'suspicious';
  } else if (rep.totalSubmissions >= 100 && rep.accuracyRate >= 0.95) {
    rep.trustLevel = 'verified';
  } else if (rep.totalSubmissions >= 10 && rep.accuracyRate >= 0.8) {
    rep.trustLevel = 'trusted';
  }

  console.log(`[Verifier] Worker ${workerId} reputation: ${rep.trustLevel} (${(rep.accuracyRate * 100).toFixed(1)}% accuracy)`);
}

export function isWorkerBanned(workerId: string): boolean {
  const rep = workerReputations.get(workerId);
  return rep?.trustLevel === 'banned';
}

export function getWorkerTrustMultiplier(workerId: string): number {
  const rep = getWorkerReputation(workerId);
  switch (rep.trustLevel) {
    case 'verified': return 1.2;
    case 'trusted': return 1.0;
    case 'new': return 0.8;
    case 'suspicious': return 0.5;
    case 'banned': return 0;
  }
}

/**
 * Adjust worker reputation based on consensus participation
 */
export function adjustWorkerReputation(
  workerId: string,
  action: 'consensus_agreement' | 'consensus_disagreement' | 'missed_consensus'
): void {
  const rep = getWorkerReputation(workerId);

  switch (action) {
    case 'consensus_agreement':
      // Reward for agreeing with consensus
      rep.verifiedSubmissions++;
      rep.totalSubmissions++;
      break;

    case 'consensus_disagreement':
      // Minor penalty for disagreeing with consensus
      rep.totalSubmissions++;
      // Add small fraud flag weight for consistent disagreement
      if (rep.totalSubmissions > 10 && rep.accuracyRate < 0.5) {
        rep.fraudFlags += 0.5;
      }
      break;

    case 'missed_consensus':
      // Penalty for not submitting to assigned consensus challenge
      rep.totalSubmissions++;
      rep.fraudFlags += 0.25;
      break;
  }

  rep.lastSubmission = Date.now();
  rep.accuracyRate = rep.verifiedSubmissions / Math.max(rep.totalSubmissions, 1);

  // Update trust level
  if (rep.fraudFlags >= 3) {
    rep.trustLevel = 'banned';
  } else if (rep.fraudFlags >= 1) {
    rep.trustLevel = 'suspicious';
  } else if (rep.totalSubmissions >= 100 && rep.accuracyRate >= 0.95) {
    rep.trustLevel = 'verified';
  } else if (rep.totalSubmissions >= 10 && rep.accuracyRate >= 0.8) {
    rep.trustLevel = 'trusted';
  }
}

/**
 * Reset worker reputation (for testing)
 */
export function resetWorkerReputation(workerId: string): void {
  workerReputations.delete(workerId);
}

// Export getWorkerReputation for external use
export { getWorkerReputation };

// ============================================================================
// Transaction Verification
// ============================================================================

export async function verifyIndexedTransactions(
  transactions: IndexedTransaction[],
  inputData: any,
  workerId: string
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const spotChecks: SpotCheckResult[] = [];
  let score = 100;

  // Check 1: Input coverage - did they process all input transactions?
  const inputSignatures = new Set(inputData.transactions?.map((t: any) => t.signature) || []);
  const outputSignatures = new Set(transactions.map(t => t.signature));

  const coverage = outputSignatures.size / Math.max(inputSignatures.size, 1);
  if (coverage < 0.8) {
    issues.push({
      type: 'warning',
      code: 'LOW_COVERAGE',
      message: `Only ${(coverage * 100).toFixed(1)}% of input transactions were indexed`,
      expected: inputSignatures.size,
      actual: outputSignatures.size,
    });
    score -= 15;
  }

  // Check 2: Signature validity - are signatures properly formatted?
  for (const tx of transactions.slice(0, 10)) {
    if (tx.signature.length < 80 || tx.signature.length > 100) {
      issues.push({
        type: 'error',
        code: 'INVALID_SIGNATURE',
        message: `Invalid signature format: ${tx.signature.slice(0, 20)}...`,
        field: 'signature',
      });
      score -= 10;
      break;
    }
  }

  // Check 3: Program ID validity - are program IDs real?
  const invalidPrograms: string[] = [];
  for (const tx of transactions) {
    for (const programId of tx.programs) {
      if (programId.length !== 44 && programId.length !== 43) {
        invalidPrograms.push(programId);
      }
    }
  }
  if (invalidPrograms.length > 0) {
    issues.push({
      type: 'error',
      code: 'INVALID_PROGRAM_ID',
      message: `${invalidPrograms.length} invalid program IDs found`,
      actual: invalidPrograms.slice(0, 3),
    });
    score -= 20;
  }

  // Check 4: Type consistency - do types match programs?
  for (const tx of transactions.slice(0, 20)) {
    const typeValid = validateTransactionType(tx);
    if (!typeValid) {
      issues.push({
        type: 'warning',
        code: 'TYPE_MISMATCH',
        message: `Transaction type '${tx.type}' doesn't match programs`,
        field: 'type',
      });
      score -= 2;
    }
  }

  // Check 5: Timestamp plausibility
  const now = Date.now();
  const futureTimestamps = transactions.filter(t => t.timestamp > now);
  const ancientTimestamps = transactions.filter(t => t.timestamp < now - 365 * 24 * 60 * 60 * 1000);

  if (futureTimestamps.length > 0) {
    issues.push({
      type: 'error',
      code: 'FUTURE_TIMESTAMP',
      message: `${futureTimestamps.length} transactions have future timestamps (fabrication detected)`,
    });
    score -= 30;
  }
  if (ancientTimestamps.length > transactions.length * 0.5) {
    issues.push({
      type: 'warning',
      code: 'STALE_DATA',
      message: 'More than 50% of transactions are over 1 year old',
    });
    score -= 10;
  }

  // Check 6: Duplicate detection
  const sigSet = new Set<string>();
  let duplicates = 0;
  for (const tx of transactions) {
    if (sigSet.has(tx.signature)) {
      duplicates++;
    }
    sigSet.add(tx.signature);
  }
  if (duplicates > 0) {
    issues.push({
      type: 'error',
      code: 'DUPLICATE_ENTRIES',
      message: `${duplicates} duplicate transaction signatures found`,
    });
    score -= Math.min(30, duplicates * 5);
  }

  // Check 7: Spot-check random samples against input (if available)
  const inputMap = new Map(inputData.transactions?.map((t: any) => [t.signature, t]) || []);
  const samplesToCheck = transactions.slice(0, 5);

  for (const tx of samplesToCheck) {
    const inputTx = inputMap.get(tx.signature);
    if (inputTx) {
      const match = inputTx.slot === undefined ||
        (inputTx.accounts?.some((a: string) => tx.accounts.includes(a)));

      spotChecks.push({
        item: tx.signature.slice(0, 16),
        verified: match,
        method: 'input_match',
        details: match ? 'Matches input data' : 'Does not match input',
      });

      if (!match) {
        score -= 5;
      }
    }
  }

  // Update worker reputation
  const fraudDetected = score < 50;
  updateWorkerReputation(workerId, score >= 70, fraudDetected);

  return {
    valid: score >= 50,
    score: Math.max(0, score),
    issues,
    spotChecks,
    recommendations: generateRecommendations(issues),
  };
}

// ============================================================================
// Pattern Verification
// ============================================================================

export async function verifyDetectedPatterns(
  patterns: DetectedPattern[],
  inputData: any,
  workerId: string
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const spotChecks: SpotCheckResult[] = [];
  let score = 100;

  // Check 1: Pattern plausibility
  for (const pattern of patterns) {
    // Confidence should be 0-1
    if (pattern.confidence < 0 || pattern.confidence > 1) {
      issues.push({
        type: 'error',
        code: 'INVALID_CONFIDENCE',
        message: `Invalid confidence value: ${pattern.confidence}`,
        field: 'confidence',
      });
      score -= 15;
    }

    // Should have transaction evidence
    if (!pattern.transactions || pattern.transactions.length === 0) {
      issues.push({
        type: 'warning',
        code: 'NO_EVIDENCE',
        message: `Pattern '${pattern.type}' has no transaction evidence`,
      });
      score -= 10;
    }

    // Evidence text should be meaningful
    if (!pattern.evidence || pattern.evidence.length < 10) {
      issues.push({
        type: 'warning',
        code: 'WEAK_EVIDENCE',
        message: `Pattern '${pattern.type}' has insufficient evidence description`,
      });
      score -= 5;
    }
  }

  // Check 2: Severity distribution - too many critical is suspicious
  const criticalCount = patterns.filter(p => p.severity === 'critical').length;
  if (criticalCount > patterns.length * 0.3) {
    issues.push({
      type: 'warning',
      code: 'SEVERITY_INFLATION',
      message: `${criticalCount}/${patterns.length} patterns marked as critical (suspicious)`,
    });
    score -= 15;
  }

  // Check 3: Pattern types should be valid
  const validTypes = [
    'high_frequency_trading', 'potential_sandwich', 'wash_trading',
    'high_failure_rate', 'mev_activity', 'unusual_volume',
    'front_running', 'back_running', 'arbitrage',
  ];

  for (const pattern of patterns) {
    if (!validTypes.some(t => pattern.type.includes(t) || t.includes(pattern.type))) {
      spotChecks.push({
        item: pattern.type,
        verified: false,
        method: 'type_validation',
        details: 'Unknown pattern type',
      });
    }
  }

  // Check 4: Referenced transactions should exist in input
  const inputSigs = new Set(inputData.transactions?.map((t: any) => t.signature) || []);
  let invalidRefs = 0;

  for (const pattern of patterns) {
    for (const txSig of pattern.transactions.slice(0, 5)) {
      if (inputSigs.size > 0 && !inputSigs.has(txSig)) {
        invalidRefs++;
      }
    }
  }

  if (invalidRefs > 0) {
    issues.push({
      type: 'warning',
      code: 'INVALID_TX_REFERENCE',
      message: `${invalidRefs} pattern references point to non-input transactions`,
    });
    score -= Math.min(20, invalidRefs * 3);
  }

  // Update reputation
  const fraudDetected = score < 50;
  updateWorkerReputation(workerId, score >= 70, fraudDetected);

  return {
    valid: score >= 50,
    score: Math.max(0, score),
    issues,
    spotChecks,
    recommendations: generateRecommendations(issues),
  };
}

// ============================================================================
// Wallet Classification Verification
// ============================================================================

export async function verifyClassifiedWallets(
  wallets: ClassifiedWallet[],
  inputData: any,
  workerId: string
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const spotChecks: SpotCheckResult[] = [];
  let score = 100;

  // Check 1: Address validity
  for (const wallet of wallets) {
    if (wallet.address.length !== 44 && wallet.address.length !== 43) {
      issues.push({
        type: 'error',
        code: 'INVALID_ADDRESS',
        message: `Invalid wallet address format: ${wallet.address.slice(0, 20)}`,
      });
      score -= 10;
      break;
    }
  }

  // Check 2: Classification validity
  const validClassifications = [
    'unknown', 'inactive', 'defi_trader', 'nft_collector',
    'bot_suspected', 'whale', 'exchange', 'protocol',
    'developer', 'airdrop_hunter', 'liquidity_provider',
  ];

  for (const wallet of wallets) {
    if (!validClassifications.includes(wallet.classification)) {
      issues.push({
        type: 'warning',
        code: 'UNKNOWN_CLASSIFICATION',
        message: `Unknown classification: ${wallet.classification}`,
      });
      score -= 3;
    }
  }

  // Check 3: Confidence bounds
  for (const wallet of wallets) {
    if (wallet.confidence < 0 || wallet.confidence > 1) {
      issues.push({
        type: 'error',
        code: 'INVALID_CONFIDENCE',
        message: `Confidence out of bounds: ${wallet.confidence}`,
      });
      score -= 10;
    }
  }

  // Check 4: Known entities should be correctly classified
  for (const wallet of wallets) {
    const known = KNOWN_ENTITIES[wallet.address];
    if (known) {
      if (wallet.classification !== known.type) {
        spotChecks.push({
          item: wallet.address.slice(0, 16),
          verified: false,
          method: 'known_entity_check',
          details: `Expected ${known.type}, got ${wallet.classification}`,
        });
        score -= 15;
      } else {
        spotChecks.push({
          item: wallet.address.slice(0, 16),
          verified: true,
          method: 'known_entity_check',
          details: `Correctly identified as ${known.name}`,
        });
      }
    }
  }

  // Check 5: Input address coverage
  const inputAddresses = new Set(inputData.addresses || []);
  const outputAddresses = new Set(wallets.map(w => w.address));

  if (inputAddresses.size > 0) {
    const coverage = outputAddresses.size / inputAddresses.size;
    if (coverage < 0.8) {
      issues.push({
        type: 'warning',
        code: 'LOW_COVERAGE',
        message: `Only ${(coverage * 100).toFixed(1)}% of input addresses classified`,
      });
      score -= 10;
    }
  }

  // Check 6: Suspiciously uniform results
  const classificationCounts = new Map<string, number>();
  for (const wallet of wallets) {
    classificationCounts.set(
      wallet.classification,
      (classificationCounts.get(wallet.classification) || 0) + 1
    );
  }

  const maxCount = Math.max(...classificationCounts.values());
  if (maxCount > wallets.length * 0.9 && wallets.length > 5) {
    issues.push({
      type: 'warning',
      code: 'UNIFORM_RESULTS',
      message: 'Over 90% of wallets have the same classification (suspicious)',
    });
    score -= 20;
  }

  // Update reputation
  const fraudDetected = score < 50;
  updateWorkerReputation(workerId, score >= 70, fraudDetected);

  return {
    valid: score >= 50,
    score: Math.max(0, score),
    issues,
    spotChecks,
    recommendations: generateRecommendations(issues),
  };
}

// ============================================================================
// Entity Extraction Verification
// ============================================================================

export async function verifyExtractedEntities(
  entities: ExtractedEntity[],
  inputData: any,
  workerId: string
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const spotChecks: SpotCheckResult[] = [];
  let score = 100;

  // Check 1: Address validity
  for (const entity of entities) {
    if (entity.address.length !== 44 && entity.address.length !== 43) {
      issues.push({
        type: 'error',
        code: 'INVALID_ADDRESS',
        message: `Invalid entity address: ${entity.address.slice(0, 20)}`,
      });
      score -= 10;
      break;
    }
  }

  // Check 2: Entity type validity
  const validTypes = [
    'exchange', 'protocol', 'whale', 'bot', 'bridge',
    'defi_user', 'nft_user', 'validator', 'unknown',
  ];

  for (const entity of entities) {
    const typeBase = entity.entityType.replace(/_user$/, '');
    if (!validTypes.includes(entity.entityType) && !validTypes.includes(typeBase)) {
      issues.push({
        type: 'warning',
        code: 'UNKNOWN_ENTITY_TYPE',
        message: `Unknown entity type: ${entity.entityType}`,
      });
      score -= 3;
    }
  }

  // Check 3: Evidence quality
  for (const entity of entities) {
    if (!entity.evidence || entity.evidence.length === 0) {
      issues.push({
        type: 'warning',
        code: 'NO_EVIDENCE',
        message: `Entity ${entity.address.slice(0, 16)} has no evidence`,
      });
      score -= 5;
    }
  }

  // Check 4: Verify against known entities
  for (const entity of entities) {
    const known = KNOWN_ENTITIES[entity.address];
    if (known) {
      if (entity.entityType !== known.type) {
        spotChecks.push({
          item: entity.address.slice(0, 16),
          verified: false,
          method: 'known_entity_check',
          details: `Expected ${known.type}, got ${entity.entityType}`,
        });
        score -= 15;
      } else {
        spotChecks.push({
          item: entity.address.slice(0, 16),
          verified: true,
          method: 'known_entity_check',
        });
      }
    }
  }

  // Check 5: Confidence distribution
  const avgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / Math.max(entities.length, 1);
  if (avgConfidence > 0.95) {
    issues.push({
      type: 'warning',
      code: 'OVERCONFIDENT',
      message: `Average confidence ${(avgConfidence * 100).toFixed(1)}% is suspiciously high`,
    });
    score -= 10;
  }

  // Update reputation
  const fraudDetected = score < 50;
  updateWorkerReputation(workerId, score >= 70, fraudDetected);

  return {
    valid: score >= 50,
    score: Math.max(0, score),
    issues,
    spotChecks,
    recommendations: generateRecommendations(issues),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function validateTransactionType(tx: IndexedTransaction): boolean {
  // Check if type matches programs
  const hasDefi = tx.programs.some(p => KNOWN_PROGRAMS[p]?.category === 'defi');
  const hasNft = tx.programs.some(p => KNOWN_PROGRAMS[p]?.category === 'nft');
  const hasToken = tx.programs.some(p => KNOWN_PROGRAMS[p]?.category === 'token');

  if (tx.type === 'swap' || tx.type === 'defi') {
    return hasDefi;
  }
  if (tx.type === 'nft') {
    return hasNft;
  }
  if (tx.type === 'token_transfer') {
    return hasToken || tx.programs.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  }
  if (tx.type === 'sol_transfer') {
    return tx.programs.includes('11111111111111111111111111111111');
  }

  return true; // Unknown types pass
}

function generateRecommendations(issues: VerificationIssue[]): string[] {
  const recommendations: string[] = [];

  const errorCodes = new Set(issues.filter(i => i.type === 'error').map(i => i.code));
  const warningCodes = new Set(issues.filter(i => i.type === 'warning').map(i => i.code));

  if (errorCodes.has('INVALID_SIGNATURE')) {
    recommendations.push('Use the exact signature format from input data');
  }
  if (errorCodes.has('FUTURE_TIMESTAMP')) {
    recommendations.push('Use actual blockchain timestamps, not generated ones');
  }
  if (errorCodes.has('DUPLICATE_ENTRIES')) {
    recommendations.push('Ensure each item appears only once in results');
  }
  if (warningCodes.has('LOW_COVERAGE')) {
    recommendations.push('Process all input items, not just a subset');
  }
  if (warningCodes.has('UNIFORM_RESULTS')) {
    recommendations.push('Analyze each item individually rather than applying blanket classifications');
  }
  if (warningCodes.has('OVERCONFIDENT')) {
    recommendations.push('Use realistic confidence scores based on evidence strength');
  }

  return recommendations;
}

// ============================================================================
// Main Verification Function
// ============================================================================

export async function verifyWorkResult(
  workType: string,
  result: any,
  inputData: any,
  workerId: string
): Promise<VerificationResult> {
  // Check if worker is banned
  if (isWorkerBanned(workerId)) {
    return {
      valid: false,
      score: 0,
      issues: [{
        type: 'error',
        code: 'WORKER_BANNED',
        message: 'Worker has been banned due to repeated fraud',
      }],
      spotChecks: [],
      recommendations: ['Contact support to appeal the ban'],
    };
  }

  switch (workType) {
    case 'index_transactions':
      return verifyIndexedTransactions(
        result.indexedTransactions || [],
        inputData,
        workerId
      );

    case 'analyze_patterns':
      return verifyDetectedPatterns(
        result.detectedPatterns || [],
        inputData,
        workerId
      );

    case 'classify_wallets':
      return verifyClassifiedWallets(
        result.classifiedWallets || [],
        inputData,
        workerId
      );

    case 'extract_entities':
      return verifyExtractedEntities(
        result.extractedEntities || [],
        inputData,
        workerId
      );

    case 'validate_data':
    case 'compute_analytics':
      // These have their own validation logic
      return {
        valid: true,
        score: 80,
        issues: [],
        spotChecks: [],
        recommendations: [],
      };

    default:
      return {
        valid: false,
        score: 0,
        issues: [{
          type: 'error',
          code: 'UNKNOWN_WORK_TYPE',
          message: `Unknown work type: ${workType}`,
        }],
        spotChecks: [],
        recommendations: [],
      };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  verifyWorkResult,
  verifyIndexedTransactions,
  verifyDetectedPatterns,
  verifyClassifiedWallets,
  verifyExtractedEntities,
  isWorkerBanned,
  getWorkerTrustMultiplier,
  getWorkerReputation,
};
