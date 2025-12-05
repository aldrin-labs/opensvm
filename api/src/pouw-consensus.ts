/**
 * PoUW Cross-Worker Consensus
 *
 * Implements Byzantine fault tolerance for PoUW verification.
 * Multiple workers independently verify the same data,
 * and consensus is reached when 2/3+ workers agree.
 *
 * Key Features:
 * - Challenge distribution to multiple workers
 * - Result aggregation and comparison
 * - Byzantine fault tolerance (requires 2/3 agreement)
 * - Reputation adjustment based on consensus participation
 *
 * @module pouw-consensus
 */

import { createHash } from 'crypto';
import { emitChallengeCreated, emitChallengeCompleted } from './mcp-mining-events';
import { getWorkerReputation, adjustWorkerReputation, getWorkerTrustMultiplier } from './pouw-quality-verifier';
import {
  assessDifficulty,
  slash,
  queueSlashing,
  getStakeInfo,
  isCurrentValidator,
  recordChallengeProcessed,
} from './pouw-staking';

// ============================================================================
// Configuration
// ============================================================================

// Minimum workers required for consensus (can be overridden by difficulty)
const MIN_WORKERS_FOR_CONSENSUS = 3;

// Maximum workers to assign per challenge (can be overridden by difficulty)
const MAX_WORKERS_PER_CHALLENGE = 15;

// Default consensus threshold (2/3 majority, can be overridden by difficulty)
const DEFAULT_CONSENSUS_THRESHOLD = 0.67;

// Enable staking integration
const USE_STAKING = true;

// Time window for workers to submit results (ms)
const SUBMISSION_WINDOW_MS = 60000; // 1 minute

// Similarity threshold for result comparison
const RESULT_SIMILARITY_THRESHOLD = 0.85;

// ============================================================================
// Types
// ============================================================================

export interface ConsensusChallenge {
  id: string;
  workType: string;
  inputData: any;
  assignedWorkers: string[];
  submissions: Map<string, ConsensusSubmission>;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'voting' | 'consensus_reached' | 'consensus_failed' | 'expired';
  consensusResult?: any;
  consensusConfidence: number;
  // Difficulty scaling
  difficultyLevel: string;
  requiredWorkers: number;
  consensusThreshold: number;
  rewardMultiplier: number;
}

export interface ConsensusSubmission {
  workerId: string;
  result: any;
  hash: string;
  submittedAt: number;
  votedBy: Set<string>;
  voteAgainst: Set<string>;
}

export interface ConsensusResult {
  achieved: boolean;
  result: any;
  confidence: number;
  agreementRatio: number;
  participatingWorkers: string[];
  dissentingWorkers: string[];
  reason?: string;
}

export interface WorkerConsensusStats {
  workerId: string;
  challengesParticipated: number;
  consensusAgreements: number;
  consensusDisagreements: number;
  agreementRate: number;
}

// ============================================================================
// State
// ============================================================================

// Active consensus challenges
const activeChallenges = new Map<string, ConsensusChallenge>();

// Worker availability (which workers are online)
const workerAvailability = new Map<string, { lastSeen: number; load: number }>();

// Worker consensus stats
const workerConsensusStats = new Map<string, WorkerConsensusStats>();

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Register worker as available for consensus challenges
 */
export function registerWorkerAvailability(workerId: string): void {
  workerAvailability.set(workerId, {
    lastSeen: Date.now(),
    load: 0,
  });
}

/**
 * Update worker's last seen timestamp
 */
export function heartbeat(workerId: string): void {
  const worker = workerAvailability.get(workerId);
  if (worker) {
    worker.lastSeen = Date.now();
  } else {
    registerWorkerAvailability(workerId);
  }
}

/**
 * Get available workers for consensus
 */
function getAvailableWorkers(): string[] {
  const now = Date.now();
  const staleThreshold = 30000; // 30 seconds

  const available: string[] = [];
  for (const [workerId, info] of workerAvailability.entries()) {
    if (now - info.lastSeen < staleThreshold && info.load < 3) {
      available.push(workerId);
    }
  }

  // Sort by trust level (prefer more trusted workers)
  return available.sort((a, b) => {
    const trustA = getWorkerTrustMultiplier(a);
    const trustB = getWorkerTrustMultiplier(b);
    return trustB - trustA;
  });
}

// ============================================================================
// Challenge Creation
// ============================================================================

/**
 * Create a consensus challenge
 * Assigns the challenge to multiple workers for independent verification
 * Uses dynamic difficulty scaling based on work type and data sensitivity
 */
export function createConsensusChallenge(
  workType: string,
  inputData: any,
  requiredWorkers?: number
): ConsensusChallenge | null {
  // Assess difficulty based on work type and input data
  const difficulty = assessDifficulty(workType, inputData);

  const availableWorkers = getAvailableWorkers();

  // Filter workers - if staking enabled, prefer validators and stakers
  let eligibleWorkers = availableWorkers;
  if (USE_STAKING) {
    // Prioritize staked workers, but allow non-staked if not enough
    const stakedWorkers = availableWorkers.filter(w => {
      const stake = getStakeInfo(w);
      return stake && stake.stakedAmount > BigInt(0);
    });

    if (stakedWorkers.length >= difficulty.requiredWorkers) {
      eligibleWorkers = stakedWorkers;
    }
  }

  // Calculate required workers from difficulty or override
  const numWorkers = Math.min(
    requiredWorkers || difficulty.requiredWorkers,
    MAX_WORKERS_PER_CHALLENGE,
    eligibleWorkers.length
  );

  if (numWorkers < MIN_WORKERS_FOR_CONSENSUS) {
    console.warn(`[PoUW Consensus] Not enough workers for consensus: ${eligibleWorkers.length}/${MIN_WORKERS_FOR_CONSENSUS} (difficulty: ${difficulty.level})`);
    return null;
  }

  // Select workers (prioritize by trust and stake, but include some random selection)
  const selectedWorkers = selectWorkersForConsensus(eligibleWorkers, numWorkers);

  // Create challenge
  const challengeId = createHash('sha256')
    .update(`${workType}_${Date.now()}_${Math.random()}`)
    .digest('hex')
    .slice(0, 16);

  const challenge: ConsensusChallenge = {
    id: challengeId,
    workType,
    inputData,
    assignedWorkers: selectedWorkers,
    submissions: new Map(),
    createdAt: Date.now(),
    expiresAt: Date.now() + SUBMISSION_WINDOW_MS,
    status: 'pending',
    consensusConfidence: 0,
    // Difficulty scaling fields
    difficultyLevel: difficulty.level,
    requiredWorkers: numWorkers,
    consensusThreshold: difficulty.consensusThreshold,
    rewardMultiplier: difficulty.rewardMultiplier,
  };

  activeChallenges.set(challengeId, challenge);

  // Update worker loads
  for (const workerId of selectedWorkers) {
    const worker = workerAvailability.get(workerId);
    if (worker) worker.load++;
  }

  console.log(`[PoUW Consensus] Created challenge ${challengeId} with ${selectedWorkers.length} workers (${difficulty.level} difficulty, ${(difficulty.consensusThreshold * 100).toFixed(0)}% threshold)`);

  // Emit event
  emitChallengeCreated({
    challengeId,
    workType,
    reward: BigInt(0), // Consensus challenges have deferred rewards
    difficulty: numWorkers,
    expiresAt: challenge.expiresAt,
    inputData,
    metadata: {
      consensusRequired: true,
      workers: selectedWorkers.length,
      difficultyLevel: difficulty.level,
      consensusThreshold: difficulty.consensusThreshold,
      rewardMultiplier: difficulty.rewardMultiplier,
    },
  });

  return challenge;
}

/**
 * Select workers for consensus using weighted random selection
 */
function selectWorkersForConsensus(availableWorkers: string[], count: number): string[] {
  if (availableWorkers.length <= count) {
    return [...availableWorkers];
  }

  const selected: string[] = [];
  const remaining = [...availableWorkers];

  // Select 60% by trust (top workers), 40% randomly
  const byTrustCount = Math.ceil(count * 0.6);
  const randomCount = count - byTrustCount;

  // Add top trusted workers
  for (let i = 0; i < byTrustCount && remaining.length > 0; i++) {
    selected.push(remaining.shift()!);
  }

  // Add random workers from the rest
  for (let i = 0; i < randomCount && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(idx, 1)[0]!);
  }

  return selected;
}

// ============================================================================
// Result Submission
// ============================================================================

/**
 * Submit a result for a consensus challenge
 */
export function submitConsensusResult(
  challengeId: string,
  workerId: string,
  result: any
): { accepted: boolean; reason?: string } {
  const challenge = activeChallenges.get(challengeId);

  if (!challenge) {
    return { accepted: false, reason: 'Challenge not found' };
  }

  if (!challenge.assignedWorkers.includes(workerId)) {
    return { accepted: false, reason: 'Worker not assigned to this challenge' };
  }

  if (Date.now() > challenge.expiresAt) {
    return { accepted: false, reason: 'Challenge expired' };
  }

  if (challenge.submissions.has(workerId)) {
    return { accepted: false, reason: 'Already submitted' };
  }

  // Generate hash of result for comparison
  const resultHash = hashResult(result);

  const submission: ConsensusSubmission = {
    workerId,
    result,
    hash: resultHash,
    submittedAt: Date.now(),
    votedBy: new Set([workerId]), // Worker votes for their own result
    voteAgainst: new Set(),
  };

  challenge.submissions.set(workerId, submission);

  // Update worker load
  const worker = workerAvailability.get(workerId);
  if (worker) worker.load--;

  // Check if we have enough submissions to evaluate consensus
  if (challenge.submissions.size >= MIN_WORKERS_FOR_CONSENSUS) {
    challenge.status = 'voting';
    evaluateConsensus(challengeId);
  }

  console.log(`[PoUW Consensus] Submission from ${workerId} for challenge ${challengeId}`);

  return { accepted: true };
}

/**
 * Generate a deterministic hash of a result for comparison
 */
function hashResult(result: any): string {
  // Normalize result for comparison
  const normalized = JSON.stringify(result, Object.keys(result).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

// ============================================================================
// Consensus Evaluation
// ============================================================================

/**
 * Evaluate consensus for a challenge
 * Uses dynamic consensus threshold from difficulty scaling
 * Applies slashing for dissenting workers when consensus is reached
 */
function evaluateConsensus(challengeId: string): ConsensusResult {
  const challenge = activeChallenges.get(challengeId)!;

  // Group submissions by similarity
  const groups = groupSimilarSubmissions(challenge.submissions);

  // Find the largest group
  const sortedGroups = [...groups].sort((a, b) => b[1].length - a[1].length);
  const largestGroup = sortedGroups[0];

  if (!largestGroup) {
    challenge.status = 'consensus_failed';
    return {
      achieved: false,
      result: null,
      confidence: 0,
      agreementRatio: 0,
      participatingWorkers: [],
      dissentingWorkers: Array.from(challenge.submissions.keys()),
      reason: 'No submissions',
    };
  }

  const [dominantHash, agreeingWorkers] = largestGroup;
  const totalWorkers = challenge.submissions.size;
  const agreementRatio = agreeingWorkers.length / totalWorkers;

  // Use challenge's dynamic threshold (from difficulty scaling)
  const threshold = challenge.consensusThreshold || DEFAULT_CONSENSUS_THRESHOLD;
  const consensusAchieved = agreementRatio >= threshold;

  // Get the result from the dominant group
  const dominantSubmission = Array.from(challenge.submissions.values())
    .find(s => s.hash === dominantHash);

  // Calculate confidence based on agreement ratio and worker trust
  const confidence = calculateConsensusConfidence(agreeingWorkers, agreementRatio);

  // Find dissenting workers
  const dissentingWorkers = Array.from(challenge.submissions.keys())
    .filter(w => !agreeingWorkers.includes(w));

  // Update challenge status
  challenge.status = consensusAchieved ? 'consensus_reached' : 'consensus_failed';
  challenge.consensusResult = consensusAchieved ? dominantSubmission?.result : null;
  challenge.consensusConfidence = confidence;

  // Update worker reputations
  updateWorkerReputations(agreeingWorkers, dissentingWorkers, consensusAchieved);

  // Apply slashing for dissenting workers if staking enabled
  if (USE_STAKING && consensusAchieved && dissentingWorkers.length > 0) {
    applySlashingForDissent(challengeId, dissentingWorkers, challenge.difficultyLevel);
  }

  // Record challenge in current epoch
  if (USE_STAKING && consensusAchieved) {
    const baseReward = BigInt(1000000); // Base reward
    const scaledReward = BigInt(Math.floor(Number(baseReward) * (challenge.rewardMultiplier || 1)));
    recordChallengeProcessed(scaledReward);
  }

  // Emit completion event
  if (consensusAchieved) {
    emitChallengeCompleted({
      challengeId,
      workerId: agreeingWorkers[0] || 'consensus',
      result: dominantSubmission?.result,
      qualityScore: Math.round(confidence * 100),
      processingTimeMs: Date.now() - challenge.createdAt,
      reward: BigInt(0), // Rewards distributed separately
      metadata: {
        consensusAchieved: true,
        agreementRatio,
        participatingWorkers: totalWorkers,
        difficultyLevel: challenge.difficultyLevel,
        thresholdUsed: threshold,
        dissentingWorkers: dissentingWorkers.length,
      },
    });
  }

  console.log(`[PoUW Consensus] Challenge ${challengeId}: consensus ${consensusAchieved ? 'ACHIEVED' : 'FAILED'} (${(agreementRatio * 100).toFixed(1)}% agreement, ${(threshold * 100).toFixed(0)}% required, ${challenge.difficultyLevel} difficulty)`);

  return {
    achieved: consensusAchieved,
    result: dominantSubmission?.result,
    confidence,
    agreementRatio,
    participatingWorkers: agreeingWorkers,
    dissentingWorkers,
    reason: consensusAchieved ? undefined : `Agreement ratio ${(agreementRatio * 100).toFixed(1)}% below threshold`,
  };
}

/**
 * Group submissions by result similarity
 */
function groupSimilarSubmissions(
  submissions: Map<string, ConsensusSubmission>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const [workerId, submission] of submissions) {
    // Find existing group with similar hash
    let foundGroup = false;

    for (const [groupHash, members] of groups) {
      if (submission.hash === groupHash || areResultsSimilar(submission.hash, groupHash)) {
        members.push(workerId);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(submission.hash, [workerId]);
    }
  }

  return groups;
}

/**
 * Check if two results are similar enough
 * For now, we use exact hash matching. In production,
 * this could use fuzzy comparison for numeric results.
 */
function areResultsSimilar(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}

/**
 * Calculate consensus confidence based on worker trust and agreement
 */
function calculateConsensusConfidence(agreeingWorkers: string[], agreementRatio: number): number {
  // Base confidence from agreement ratio
  let confidence = agreementRatio;

  // Adjust by average trust of agreeing workers
  const totalTrust = agreeingWorkers.reduce((sum, workerId) => {
    return sum + getWorkerTrustMultiplier(workerId);
  }, 0);
  const avgTrust = agreeingWorkers.length > 0 ? totalTrust / agreeingWorkers.length : 1;

  // Weight by trust (trust multiplier can be 0.5 to 1.5)
  confidence *= avgTrust;

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Update worker reputations based on consensus outcome
 */
function updateWorkerReputations(
  agreeingWorkers: string[],
  dissentingWorkers: string[],
  consensusAchieved: boolean
): void {
  // Reward workers who agreed with consensus
  for (const workerId of agreeingWorkers) {
    if (consensusAchieved) {
      adjustWorkerReputation(workerId, 'consensus_agreement');
      updateWorkerConsensusStats(workerId, true);
    }
  }

  // Penalize workers who disagreed
  for (const workerId of dissentingWorkers) {
    if (consensusAchieved) {
      adjustWorkerReputation(workerId, 'consensus_disagreement');
      updateWorkerConsensusStats(workerId, false);
    }
  }
}

/**
 * Update worker consensus stats
 */
function updateWorkerConsensusStats(workerId: string, agreed: boolean): void {
  let stats = workerConsensusStats.get(workerId);

  if (!stats) {
    stats = {
      workerId,
      challengesParticipated: 0,
      consensusAgreements: 0,
      consensusDisagreements: 0,
      agreementRate: 0,
    };
    workerConsensusStats.set(workerId, stats);
  }

  stats.challengesParticipated++;
  if (agreed) {
    stats.consensusAgreements++;
  } else {
    stats.consensusDisagreements++;
  }
  stats.agreementRate = stats.consensusAgreements / stats.challengesParticipated;
}

/**
 * Apply slashing for workers who disagreed with consensus
 * Slashing amount scales with difficulty level
 */
function applySlashingForDissent(
  challengeId: string,
  dissentingWorkers: string[],
  difficultyLevel: string
): void {
  // Only slash workers who have stakes
  for (const workerId of dissentingWorkers) {
    const stake = getStakeInfo(workerId);

    if (!stake || stake.stakedAmount === BigInt(0)) {
      // No stake to slash - reputation penalty already applied
      continue;
    }

    // Determine if this is a validator (higher accountability)
    const isValidator = isCurrentValidator(workerId);

    // Check worker's consensus history
    const stats = workerConsensusStats.get(workerId);
    const isRepeatedOffender = stats && stats.consensusDisagreements >= 3 && stats.agreementRate < 0.5;

    // Determine violation type based on severity
    let violationType: 'consensus_disagreement' | 'fraud_detected' | 'repeated_violations';

    if (isRepeatedOffender) {
      violationType = 'repeated_violations';
    } else if (difficultyLevel === 'maximum' || difficultyLevel === 'critical') {
      // Higher difficulty = higher stakes = stricter penalties
      violationType = isValidator ? 'fraud_detected' : 'consensus_disagreement';
    } else {
      violationType = 'consensus_disagreement';
    }

    // Apply slash
    const result = slash(
      workerId,
      violationType,
      challengeId,
      `Disagreed with ${difficultyLevel} difficulty consensus on challenge ${challengeId}`
    );

    if (result.slashed) {
      console.log(`[PoUW Consensus] Slashed ${workerId} for ${result.amount} lamports (${violationType}, ${difficultyLevel} difficulty)`);
    }
  }
}

// ============================================================================
// Challenge Management
// ============================================================================

/**
 * Get challenge by ID
 */
export function getConsensusChallenge(challengeId: string): ConsensusChallenge | null {
  return activeChallenges.get(challengeId) || null;
}

/**
 * Get challenges assigned to a worker
 */
export function getWorkerChallenges(workerId: string): ConsensusChallenge[] {
  const challenges: ConsensusChallenge[] = [];

  for (const challenge of activeChallenges.values()) {
    if (challenge.assignedWorkers.includes(workerId) && challenge.status === 'pending') {
      challenges.push(challenge);
    }
  }

  return challenges;
}

/**
 * Get consensus result for a challenge
 */
export function getConsensusResult(challengeId: string): ConsensusResult | null {
  const challenge = activeChallenges.get(challengeId);

  if (!challenge || challenge.status === 'pending' || challenge.status === 'voting') {
    return null;
  }

  const submissions = Array.from(challenge.submissions.values());
  const agreeingWorkers = submissions
    .filter(s => s.hash === submissions[0]?.hash)
    .map(s => s.workerId);

  return {
    achieved: challenge.status === 'consensus_reached',
    result: challenge.consensusResult,
    confidence: challenge.consensusConfidence,
    agreementRatio: agreeingWorkers.length / submissions.length,
    participatingWorkers: agreeingWorkers,
    dissentingWorkers: Array.from(challenge.submissions.keys()).filter(w => !agreeingWorkers.includes(w)),
  };
}

/**
 * Clean up expired challenges
 */
export function cleanupExpiredChallenges(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [challengeId, challenge] of activeChallenges.entries()) {
    if (now > challenge.expiresAt && challenge.status === 'pending') {
      challenge.status = 'expired';

      // Penalize workers who didn't submit
      for (const workerId of challenge.assignedWorkers) {
        if (!challenge.submissions.has(workerId)) {
          adjustWorkerReputation(workerId, 'missed_consensus');
        }
      }

      // Keep for history but mark as expired
      cleaned++;
    }

    // Remove very old challenges (1 hour+)
    if (now - challenge.createdAt > 3600000) {
      activeChallenges.delete(challengeId);
    }
  }

  return cleaned;
}

/**
 * Get worker consensus stats
 */
export function getWorkerConsensusStats(workerId: string): WorkerConsensusStats | null {
  return workerConsensusStats.get(workerId) || null;
}

/**
 * Get overall consensus statistics
 */
export function getConsensusStats(): {
  activeChallenges: number;
  completedChallenges: number;
  consensusRate: number;
  averageParticipation: number;
  availableWorkers: number;
} {
  let completed = 0;
  let consensusAchieved = 0;
  let totalParticipation = 0;

  for (const challenge of activeChallenges.values()) {
    if (challenge.status === 'consensus_reached' || challenge.status === 'consensus_failed') {
      completed++;
      totalParticipation += challenge.submissions.size;
      if (challenge.status === 'consensus_reached') {
        consensusAchieved++;
      }
    }
  }

  return {
    activeChallenges: Array.from(activeChallenges.values())
      .filter(c => c.status === 'pending' || c.status === 'voting').length,
    completedChallenges: completed,
    consensusRate: completed > 0 ? consensusAchieved / completed : 0,
    averageParticipation: completed > 0 ? totalParticipation / completed : 0,
    availableWorkers: getAvailableWorkers().length,
  };
}

// ============================================================================
// Periodic Cleanup
// ============================================================================

// Run cleanup every 30 seconds
setInterval(() => {
  const cleaned = cleanupExpiredChallenges();
  if (cleaned > 0) {
    console.log(`[PoUW Consensus] Cleaned up ${cleaned} expired challenges`);
  }
}, 30000);

// ============================================================================
// Exports
// ============================================================================

export default {
  // Worker management
  registerWorkerAvailability,
  heartbeat,

  // Challenge management
  createConsensusChallenge,
  submitConsensusResult,
  getConsensusChallenge,
  getWorkerChallenges,
  getConsensusResult,

  // Stats
  getWorkerConsensusStats,
  getConsensusStats,
  cleanupExpiredChallenges,
};
