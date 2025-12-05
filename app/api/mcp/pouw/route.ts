/**
 * Proof-of-Useful-Work API
 *
 * GET /api/mcp/pouw - Get stats, work types, completed work
 * POST /api/mcp/pouw - Create challenges, submit results
 *
 * @module app/api/mcp/pouw
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import {
  emitPoUWCreated,
  emitPoUWAccepted,
  emitPoUWRejected,
  miningEvents,
} from '../../../../api/src/mcp-mining-events';
import {
  generateWorkInputData,
  indexTransactions,
  analyzePatterns,
  classifyWallets,
  extractEntities,
  WorkType as DataWorkType,
} from '../../../../api/src/pouw-data-provider';
import { indexedStorage } from '../../../../api/src/pouw-indexed-storage';
import {
  verifyWorkResult,
  isWorkerBanned,
  getWorkerTrustMultiplier,
} from '../../../../api/src/pouw-quality-verifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Use real data (set to false for testing with simulated data)
const USE_REAL_DATA = process.env.POUW_USE_REAL_DATA !== 'false';

// Enable strict verification (set to false for testing)
const STRICT_VERIFICATION = process.env.POUW_STRICT_VERIFICATION !== 'false';

// Work type definitions
type WorkType =
  | 'index_transactions'
  | 'analyze_patterns'
  | 'validate_data'
  | 'compute_analytics'
  | 'classify_wallets'
  | 'extract_entities';

const WORK_TYPES: Record<WorkType, {
  description: string;
  baseReward: string;
  baseRewardUi: number;
  difficulty: number;
  estimatedTimeMs: number;
}> = {
  index_transactions: {
    description: 'Classify and index transactions by type, category, and involved programs',
    baseReward: '500000000000',
    baseRewardUi: 500,
    difficulty: 5,
    estimatedTimeMs: 30000,
  },
  analyze_patterns: {
    description: 'Detect suspicious patterns like wash trading, MEV, or sandwich attacks',
    baseReward: '2000000000000',
    baseRewardUi: 2000,
    difficulty: 7,
    estimatedTimeMs: 120000,
  },
  validate_data: {
    description: 'Cross-reference and validate blockchain data for accuracy',
    baseReward: '300000000000',
    baseRewardUi: 300,
    difficulty: 3,
    estimatedTimeMs: 15000,
  },
  compute_analytics: {
    description: 'Calculate network metrics like TPS, TVL changes, and activity stats',
    baseReward: '1000000000000',
    baseRewardUi: 1000,
    difficulty: 5,
    estimatedTimeMs: 60000,
  },
  classify_wallets: {
    description: 'Label wallet addresses by their behavior and purpose',
    baseReward: '1500000000000',
    baseRewardUi: 1500,
    difficulty: 6,
    estimatedTimeMs: 90000,
  },
  extract_entities: {
    description: 'Identify known entities (exchanges, protocols) from on-chain activity',
    baseReward: '1200000000000',
    baseRewardUi: 1200,
    difficulty: 8,
    estimatedTimeMs: 120000,
  },
};

// Quality thresholds
const QUALITY_THRESHOLDS = {
  excellent: { min: 90, multiplier: 2.0 },
  good: { min: 75, multiplier: 1.5 },
  acceptable: { min: 50, multiplier: 1.0 },
  poor: { min: 0, multiplier: 0.5 },
};

// In-memory state
interface Challenge {
  id: string;
  serverId: string;
  workType: WorkType;
  difficulty: number;
  inputData: any;
  timestamp: number;
  expiresAt: number;
  baseReward: string;
  completed: boolean;
  result?: any;
  qualityScore?: number;
  reward?: string;
}

interface CompletedWork {
  challengeId: string;
  workType: WorkType;
  serverId: string;
  timestamp: number;
  qualityScore: number;
  reward: string;
  resultSummary: any;
}

interface WorkerStats {
  serverId: string;
  challengesCompleted: number;
  totalRewards: bigint;
  averageQuality: number;
  workByType: Record<WorkType, number>;
  lastActivity: number;
}

const challenges = new Map<string, Challenge>();
const completedWork: CompletedWork[] = [];
const workerStats = new Map<string, WorkerStats>();

let totalChallengesIssued = 0;
let totalChallengesCompleted = 0;
let totalRewardsDistributed = 0n;

// Simulated data source
const programIds = [
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
];

/**
 * GET /api/mcp/pouw
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';
    const serverId = searchParams.get('serverId');
    const workType = searchParams.get('workType') as WorkType | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'stats':
        return NextResponse.json({
          totalChallengesIssued,
          totalChallengesCompleted,
          completionRate: totalChallengesIssued > 0
            ? ((totalChallengesCompleted / totalChallengesIssued) * 100).toFixed(1) + '%'
            : '0%',
          totalRewardsDistributed: totalRewardsDistributed.toString(),
          totalRewardsDistributedUi: Number(totalRewardsDistributed) / 1e9,
          activeWorkers: workerStats.size,
          workByType: getWorkByType(),
          averageQuality: getAverageQuality(),
          topContributors: getTopContributors(10),
          timestamp: Date.now(),
        });

      case 'work-types':
        return NextResponse.json({
          types: Object.entries(WORK_TYPES).map(([type, info]) => ({
            type,
            ...info,
          })),
          qualityThresholds: QUALITY_THRESHOLDS,
        });

      case 'challenges':
        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }
        const pending = getPendingChallenges(serverId);
        return NextResponse.json({
          serverId,
          pending: pending.map(c => ({
            id: c.id,
            workType: c.workType,
            difficulty: c.difficulty,
            expiresAt: c.expiresAt,
            baseReward: c.baseReward,
            baseRewardUi: Number(BigInt(c.baseReward)) / 1e9,
            inputDataHash: createHash('sha256').update(JSON.stringify(c.inputData)).digest('hex').slice(0, 16),
          })),
        });

      case 'worker':
        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }
        const stats = workerStats.get(serverId);
        if (!stats) {
          return NextResponse.json({
            serverId,
            challengesCompleted: 0,
            totalRewards: '0',
            totalRewardsUi: 0,
            averageQuality: 0,
            workByType: {},
          });
        }
        return NextResponse.json({
          serverId: stats.serverId,
          challengesCompleted: stats.challengesCompleted,
          totalRewards: stats.totalRewards.toString(),
          totalRewardsUi: Number(stats.totalRewards) / 1e9,
          averageQuality: stats.averageQuality,
          workByType: stats.workByType,
          lastActivity: stats.lastActivity,
        });

      case 'completed':
        let work = completedWork.slice().reverse(); // Most recent first
        if (workType) {
          work = work.filter(w => w.workType === workType);
        }
        if (serverId) {
          work = work.filter(w => w.serverId === serverId);
        }
        return NextResponse.json({
          count: work.length,
          work: work.slice(0, limit).map(w => ({
            challengeId: w.challengeId,
            workType: w.workType,
            serverId: w.serverId,
            timestamp: w.timestamp,
            qualityScore: w.qualityScore,
            reward: w.reward,
            rewardUi: Number(BigInt(w.reward)) / 1e9,
          })),
        });

      case 'leaderboard':
        return NextResponse.json({
          leaderboard: getTopContributors(limit),
          totalWorkers: workerStats.size,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/pouw
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, serverId, workType, challengeId, result } = body;

    switch (action) {
      case 'create':
        return await handleCreateChallenge(serverId, workType);

      case 'submit':
        return await handleSubmitResult(challengeId, result);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handler functions

async function handleCreateChallenge(serverId: string, requestedType?: WorkType): Promise<NextResponse> {
  if (!serverId) {
    return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
  }

  // Check pending limit
  const pending = getPendingChallenges(serverId);
  if (pending.length >= 5) {
    return NextResponse.json({
      error: 'Maximum pending challenges (5) reached',
      pending: pending.length,
    }, { status: 429 });
  }

  // Select work type
  const workType = requestedType && WORK_TYPES[requestedType]
    ? requestedType
    : selectWorkType();

  const typeInfo = WORK_TYPES[workType];

  // Generate input data (may fetch from real blockchain)
  const inputData = await generateInputData(workType);

  const challenge: Challenge = {
    id: `pouw_${Date.now()}_${randomBytes(4).toString('hex')}`,
    serverId,
    workType,
    difficulty: typeInfo.difficulty,
    inputData,
    timestamp: Date.now(),
    expiresAt: Date.now() + 1800000, // 30 minutes
    baseReward: typeInfo.baseReward,
    completed: false,
  };

  challenges.set(challenge.id, challenge);
  totalChallengesIssued++;

  // Emit PoUW challenge created event
  emitPoUWCreated(challenge.id, serverId, workType, typeInfo.baseReward);

  return NextResponse.json({
    success: true,
    challenge: {
      id: challenge.id,
      workType: challenge.workType,
      description: typeInfo.description,
      difficulty: challenge.difficulty,
      inputData: challenge.inputData,
      expiresAt: challenge.expiresAt,
      baseReward: challenge.baseReward,
      baseRewardUi: typeInfo.baseRewardUi,
      estimatedTimeMs: typeInfo.estimatedTimeMs,
    },
    instructions: getWorkInstructions(workType),
  });
}

async function handleSubmitResult(challengeId: string, result: any): Promise<NextResponse> {
  if (!challengeId || !result) {
    return NextResponse.json({ error: 'Missing challengeId or result' }, { status: 400 });
  }

  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  if (challenge.completed) {
    return NextResponse.json({ error: 'Challenge already completed' }, { status: 400 });
  }

  if (Date.now() > challenge.expiresAt) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  // Check if worker is banned
  if (isWorkerBanned(challenge.serverId)) {
    return NextResponse.json({
      accepted: false,
      error: 'Worker has been banned due to repeated fraud',
      qualityScore: 0,
    }, { status: 403 });
  }

  // Run verification on the submitted work
  let verificationResult = null;
  if (STRICT_VERIFICATION) {
    verificationResult = await verifyWorkResult(
      challenge.workType,
      result,
      challenge.inputData,
      challenge.serverId
    );

    if (!verificationResult.valid) {
      console.log(`[PoUW] Verification failed for ${challengeId}: ${verificationResult.issues.map(i => i.message).join(', ')}`);
      emitPoUWRejected(challengeId, challenge.serverId, verificationResult.issues[0]?.message || 'Verification failed', verificationResult.score);

      return NextResponse.json({
        accepted: false,
        qualityScore: verificationResult.score,
        feedback: verificationResult.issues.map(i => i.message).join('; '),
        issues: verificationResult.issues,
        recommendations: verificationResult.recommendations,
        error: `Verification failed: ${verificationResult.score}%`,
      });
    }
  }

  // Evaluate basic quality
  const quality = evaluateQuality(challenge, result);

  // Combine verification score with basic quality
  const combinedScore = verificationResult
    ? Math.round((quality.score + verificationResult.score) / 2)
    : quality.score;

  if (combinedScore < 50) {
    emitPoUWRejected(challengeId, challenge.serverId, quality.feedback, combinedScore);

    return NextResponse.json({
      accepted: false,
      qualityScore: combinedScore,
      feedback: quality.feedback,
      verificationScore: verificationResult?.score,
      issues: verificationResult?.issues,
      error: `Quality too low: ${combinedScore}%. Minimum: 50%`,
    });
  }

  // Calculate reward with trust multiplier
  const qualityMultiplier = getQualityMultiplier(combinedScore);
  const trustMultiplier = getWorkerTrustMultiplier(challenge.serverId);
  const baseReward = BigInt(challenge.baseReward);
  const reward = BigInt(Math.floor(Number(baseReward) * qualityMultiplier * trustMultiplier));

  // Mark complete
  challenge.completed = true;
  challenge.result = result;
  challenge.qualityScore = combinedScore;
  challenge.reward = reward.toString();

  totalChallengesCompleted++;
  totalRewardsDistributed += reward;

  // Store completed work
  completedWork.push({
    challengeId: challenge.id,
    workType: challenge.workType,
    serverId: challenge.serverId,
    timestamp: Date.now(),
    qualityScore: quality.score,
    reward: reward.toString(),
    resultSummary: summarizeResult(challenge.workType, result),
  });

  // Store indexed results for permanent value
  storeIndexedResults(challenge.workType, result, challenge.serverId);

  // Update worker stats
  updateWorkerStats(challenge.serverId, challenge.workType, quality.score, reward);

  // Emit acceptance event
  emitPoUWAccepted(challengeId, challenge.serverId, reward.toString(), quality.score);

  // Check for worker milestones
  const stats = workerStats.get(challenge.serverId);
  if (stats) {
    const milestones = [10, 50, 100, 500, 1000];
    if (milestones.includes(stats.challengesCompleted)) {
      miningEvents.emit('worker_milestone', {
        serverId: challenge.serverId,
        milestone: stats.challengesCompleted,
        totalRewards: stats.totalRewards.toString(),
        totalRewardsUi: Number(stats.totalRewards) / 1e9,
        averageQuality: stats.averageQuality,
        message: `Worker reached ${stats.challengesCompleted} completed challenges!`,
      }, { serverId: challenge.serverId });
    }
  }

  return NextResponse.json({
    accepted: true,
    qualityScore: combinedScore,
    qualityLevel: getQualityLevel(combinedScore),
    verificationScore: verificationResult?.score,
    basicQualityScore: quality.score,
    qualityMultiplier,
    trustMultiplier,
    reward: reward.toString(),
    rewardUi: Number(reward) / 1e9,
    feedback: quality.feedback,
    spotChecks: verificationResult?.spotChecks,
    message: `Work accepted! Earned ${Number(reward) / 1e9} OMCP (${getQualityLevel(combinedScore)} quality, ${(trustMultiplier * 100).toFixed(0)}% trust)`,
  });
}

// Helper functions

function selectWorkType(): WorkType {
  const types = Object.keys(WORK_TYPES) as WorkType[];
  const workCounts = getWorkByType();

  // Prioritize less-done work
  const weights = types.map(type => 1 / ((workCounts[type] || 0) + 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < types.length; i++) {
    random -= weights[i];
    if (random <= 0) return types[i];
  }

  return 'index_transactions';
}

async function generateInputDataReal(workType: WorkType): Promise<any> {
  try {
    console.log(`[PoUW] Fetching real data for ${workType}...`);
    const data = await generateWorkInputData(workType as DataWorkType);
    console.log(`[PoUW] Got real data: ${JSON.stringify(data).slice(0, 200)}...`);
    return {
      ...data,
      dataSource: 'real',
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error('[PoUW] Error fetching real data, falling back to simulated:', error);
    return generateInputDataSimulated(workType);
  }
}

function generateInputDataSimulated(workType: WorkType): any {
  switch (workType) {
    case 'index_transactions':
    case 'analyze_patterns':
      return {
        transactions: generateTransactions(50),
        timeRange: { start: Date.now() - 86400000, end: Date.now() },
        dataSource: 'simulated',
      };

    case 'validate_data':
      return {
        transactions: generateTransactions(30),
        referenceSource: 'solana_rpc',
        dataSource: 'simulated',
      };

    case 'compute_analytics':
      return {
        timeRange: { start: Date.now() - 3600000, end: Date.now() },
        metrics: ['tps', 'active_wallets', 'transaction_volume', 'fee_stats'],
        dataSource: 'simulated',
      };

    case 'classify_wallets':
      return {
        addresses: generateAddresses(20),
        lookbackPeriod: 86400000,
        dataSource: 'simulated',
      };

    case 'extract_entities':
      return {
        transactions: generateTransactions(50),
        addresses: generateAddresses(10),
        dataSource: 'simulated',
      };

    default:
      return { data: 'generic', dataSource: 'simulated' };
  }
}

async function generateInputData(workType: WorkType): Promise<any> {
  if (USE_REAL_DATA) {
    return generateInputDataReal(workType);
  }
  return generateInputDataSimulated(workType);
}

function generateTransactions(count: number): any[] {
  const transactions = [];
  for (let i = 0; i < count; i++) {
    transactions.push({
      signature: randomBytes(44).toString('base64').slice(0, 88),
      slot: Math.floor(Math.random() * 1000000) + 250000000,
      blockTime: Date.now() - Math.floor(Math.random() * 86400000),
      accounts: generateAddresses(Math.floor(Math.random() * 5) + 2),
      programIds: [programIds[Math.floor(Math.random() * programIds.length)]],
    });
  }
  return transactions;
}

function generateAddresses(count: number): string[] {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const addresses = [];
  for (let i = 0; i < count; i++) {
    let addr = '';
    for (let j = 0; j < 44; j++) {
      addr += chars[Math.floor(Math.random() * chars.length)];
    }
    addresses.push(addr);
  }
  return addresses;
}

function evaluateQuality(challenge: Challenge, result: any): { score: number; feedback: string } {
  let score = result.confidence || 70;
  let feedback = '';

  // Basic validation
  if (!result.resultHash || !result.workerId) {
    score -= 20;
    feedback += 'Missing required fields. ';
  }

  // Work-specific validation
  switch (challenge.workType) {
    case 'index_transactions':
      const indexed = result.indexedTransactions || [];
      const inputCount = challenge.inputData.transactions?.length || 0;
      if (indexed.length < inputCount * 0.8) {
        score -= 15;
        feedback += 'Incomplete indexing. ';
      }
      break;

    case 'analyze_patterns':
      const patterns = result.detectedPatterns || [];
      if (patterns.length === 0) {
        score -= 5;
        feedback += 'No patterns found (may be legitimate). ';
      }
      break;

    case 'classify_wallets':
      const classified = result.classifiedWallets || [];
      if (classified.length === 0) {
        score -= 20;
        feedback += 'No wallets classified. ';
      }
      break;
  }

  // Penalize suspiciously fast completion
  if (result.computeTimeMs && result.computeTimeMs < 1000) {
    score -= 20;
    feedback += 'Suspiciously fast completion. ';
  }

  feedback = feedback || 'Good quality work!';
  return { score: Math.max(0, Math.min(100, score)), feedback };
}

function getQualityMultiplier(score: number): number {
  if (score >= 90) return 2.0;
  if (score >= 75) return 1.5;
  if (score >= 50) return 1.0;
  return 0.5;
}

function getQualityLevel(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'acceptable';
  return 'poor';
}

function getPendingChallenges(serverId: string): Challenge[] {
  const now = Date.now();
  return Array.from(challenges.values()).filter(
    c => c.serverId === serverId && !c.completed && c.expiresAt > now
  );
}

function getWorkByType(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const work of completedWork) {
    counts[work.workType] = (counts[work.workType] || 0) + 1;
  }
  return counts;
}

function getAverageQuality(): number {
  if (completedWork.length === 0) return 0;
  const total = completedWork.reduce((sum, w) => sum + w.qualityScore, 0);
  return Math.round(total / completedWork.length);
}

function getTopContributors(limit: number): any[] {
  return Array.from(workerStats.values())
    .sort((a, b) => {
      const diff = b.totalRewards - a.totalRewards;
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    })
    .slice(0, limit)
    .map((s, i) => ({
      rank: i + 1,
      serverId: s.serverId,
      challengesCompleted: s.challengesCompleted,
      totalRewards: s.totalRewards.toString(),
      totalRewardsUi: Number(s.totalRewards) / 1e9,
      averageQuality: s.averageQuality,
    }));
}

function updateWorkerStats(serverId: string, workType: WorkType, quality: number, reward: bigint): void {
  let stats = workerStats.get(serverId);
  if (!stats) {
    stats = {
      serverId,
      challengesCompleted: 0,
      totalRewards: 0n,
      averageQuality: 0,
      workByType: {} as Record<WorkType, number>,
      lastActivity: Date.now(),
    };
    workerStats.set(serverId, stats);
  }

  stats.challengesCompleted++;
  stats.totalRewards += reward;
  stats.averageQuality = Math.round(
    (stats.averageQuality * (stats.challengesCompleted - 1) + quality) / stats.challengesCompleted
  );
  stats.workByType[workType] = (stats.workByType[workType] || 0) + 1;
  stats.lastActivity = Date.now();
}

function summarizeResult(workType: WorkType, result: any): any {
  switch (workType) {
    case 'index_transactions':
      return { transactionsIndexed: result.indexedTransactions?.length || 0 };
    case 'analyze_patterns':
      return { patternsDetected: result.detectedPatterns?.length || 0 };
    case 'classify_wallets':
      return { walletsClassified: result.classifiedWallets?.length || 0 };
    case 'extract_entities':
      return { entitiesFound: result.extractedEntities?.length || 0 };
    default:
      return { completed: true };
  }
}

function getWorkInstructions(workType: WorkType): string {
  switch (workType) {
    case 'index_transactions':
      return 'Classify each transaction by type (transfer, swap, stake, etc.) and category (defi, nft, gaming). Return indexedTransactions array.';
    case 'analyze_patterns':
      return 'Analyze transaction patterns for suspicious activity (wash trading, MEV, sandwiches). Return detectedPatterns array with evidence.';
    case 'validate_data':
      return 'Cross-reference transaction data with RPC source. Return validationResults with any discrepancies.';
    case 'compute_analytics':
      return 'Calculate the requested metrics for the time range. Return computedMetrics array.';
    case 'classify_wallets':
      return 'Label each address by behavior (whale, bot, exchange, etc.). Return classifiedWallets with confidence scores.';
    case 'extract_entities':
      return 'Identify known entities from addresses and patterns. Return extractedEntities with evidence.';
    default:
      return 'Complete the assigned work and return results.';
  }
}

/**
 * Store indexed results from completed work for permanent value
 */
function storeIndexedResults(workType: WorkType, result: any, workerId: string): void {
  try {
    switch (workType) {
      case 'index_transactions':
        if (result.indexedTransactions?.length > 0) {
          const stored = indexedStorage.storeTransactions(result.indexedTransactions, workerId);
          console.log(`[PoUW] Stored ${stored.stored} indexed transactions from ${workerId}`);
        }
        break;

      case 'analyze_patterns':
        if (result.detectedPatterns?.length > 0) {
          const stored = indexedStorage.storePatterns(result.detectedPatterns, workerId);
          console.log(`[PoUW] Stored ${stored.stored} detected patterns from ${workerId}`);
        }
        break;

      case 'classify_wallets':
        if (result.classifiedWallets?.length > 0) {
          const stored = indexedStorage.storeWallets(result.classifiedWallets, workerId);
          console.log(`[PoUW] Stored ${stored.stored} classified wallets from ${workerId}`);
        }
        break;

      case 'extract_entities':
        if (result.extractedEntities?.length > 0) {
          const stored = indexedStorage.storeEntities(result.extractedEntities, workerId);
          console.log(`[PoUW] Stored ${stored.stored} extracted entities from ${workerId}`);
        }
        break;

      case 'validate_data':
      case 'compute_analytics':
        // These don't produce indexed data, just validation/metrics
        console.log(`[PoUW] ${workType} completed by ${workerId} (no indexed data)`);
        break;
    }
  } catch (error) {
    console.error('[PoUW] Error storing indexed results:', error);
  }
}
