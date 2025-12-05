/**
 * MCP Federation Proof-of-Useful-Work (PoUW)
 *
 * Replaces arbitrary SHA256 puzzles with useful computation that benefits
 * the network. Miners earn $OMCP by contributing real value:
 *
 * Work Types:
 * 1. INDEX_TRANSACTIONS - Index and classify blockchain transactions
 * 2. ANALYZE_PATTERNS - Detect patterns and anomalies in on-chain data
 * 3. VALIDATE_DATA - Verify and cross-reference blockchain data
 * 4. COMPUTE_ANALYTICS - Calculate network statistics and metrics
 * 5. CLASSIFY_WALLETS - Label and categorize wallet addresses
 * 6. EXTRACT_ENTITIES - Identify known entities from transaction patterns
 *
 * Benefits:
 * - Mining contributes to network intelligence
 * - Results are stored and benefit all users
 * - More valuable work = higher rewards
 * - Creates a decentralized data processing network
 *
 * @module api/src/mcp-federation-pouw
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type WorkType =
  | 'index_transactions'
  | 'analyze_patterns'
  | 'validate_data'
  | 'compute_analytics'
  | 'classify_wallets'
  | 'extract_entities';

export interface UsefulWorkChallenge {
  id: string;
  serverId: string;
  workType: WorkType;
  difficulty: number;           // Complexity level 1-10
  inputData: WorkInput;
  timestamp: number;
  expiresAt: number;
  baseReward: bigint;
  qualityMultiplier: number;    // 0.5x to 3x based on result quality
  completed: boolean;
  result?: WorkResult;
}

export interface WorkInput {
  // Common fields
  dataHash: string;             // Hash of input data for verification

  // Type-specific inputs
  transactions?: TransactionInput[];
  addresses?: string[];
  timeRange?: { start: number; end: number };
  targetMetrics?: string[];
  queryParams?: Record<string, any>;
}

export interface TransactionInput {
  signature: string;
  slot: number;
  blockTime?: number;
  accounts: string[];
  programIds: string[];
  data?: string;                // Base64 encoded instruction data
}

export interface WorkResult {
  // Verification
  resultHash: string;
  proofOfWork: string;          // Cryptographic proof of computation

  // Results by type
  indexedTransactions?: IndexedTransaction[];
  detectedPatterns?: DetectedPattern[];
  validationResults?: ValidationResult[];
  computedMetrics?: ComputedMetric[];
  classifiedWallets?: ClassifiedWallet[];
  extractedEntities?: ExtractedEntity[];

  // Meta
  computeTimeMs: number;
  confidence: number;           // 0-100 confidence score
  workerId: string;
}

export interface IndexedTransaction {
  signature: string;
  type: string;                 // transfer, swap, stake, nft_mint, etc.
  category: string;             // defi, nft, gaming, governance, etc.
  involvedPrograms: string[];
  tokenMints?: string[];
  value?: number;               // Estimated value in USD
  tags: string[];
}

export interface DetectedPattern {
  patternType: string;          // wash_trading, mev, sandwich, etc.
  confidence: number;
  involvedAddresses: string[];
  involvedTransactions: string[];
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationResult {
  dataId: string;
  valid: boolean;
  discrepancies: string[];
  crossReferences: string[];
}

export interface ComputedMetric {
  metric: string;
  value: number | string;
  timestamp: number;
  aggregationType: string;
}

export interface ClassifiedWallet {
  address: string;
  labels: string[];
  type: string;                 // exchange, dex, whale, bot, etc.
  confidence: number;
  evidence: string[];
}

export interface ExtractedEntity {
  address: string;
  name?: string;
  type: string;
  source: string;
  confidence: number;
  metadata: Record<string, any>;
}

export interface PoUWConfig {
  // Work generation
  workBatchSize: number;        // Transactions per batch
  minDifficulty: number;
  maxDifficulty: number;

  // Rewards
  baseRewards: Record<WorkType, bigint>;
  qualityThresholds: {
    excellent: number;          // Confidence >= this = 2x reward
    good: number;               // Confidence >= this = 1.5x reward
    acceptable: number;         // Confidence >= this = 1x reward
  };

  // Verification
  verificationSampleRate: number; // % of results to verify
  minConfidence: number;        // Minimum confidence to accept

  // Rate limiting
  challengeCooldownMs: number;
  maxPendingChallenges: number;
  challengeExpiryMs: number;
}

export interface PoUWStats {
  totalChallengesIssued: number;
  totalChallengesCompleted: number;
  totalUsefulWork: number;
  workByType: Record<WorkType, number>;
  averageQuality: number;
  totalRewardsDistributed: bigint;
  topContributors: Array<{
    serverId: string;
    contributions: number;
    totalRewards: bigint;
  }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: PoUWConfig = {
  workBatchSize: 50,
  minDifficulty: 1,
  maxDifficulty: 10,

  baseRewards: {
    index_transactions: 500n * 10n ** 9n,      // 500 OMCP
    analyze_patterns: 2000n * 10n ** 9n,       // 2000 OMCP (high value)
    validate_data: 300n * 10n ** 9n,           // 300 OMCP
    compute_analytics: 1000n * 10n ** 9n,      // 1000 OMCP
    classify_wallets: 1500n * 10n ** 9n,       // 1500 OMCP
    extract_entities: 1200n * 10n ** 9n,       // 1200 OMCP
  },

  qualityThresholds: {
    excellent: 90,
    good: 75,
    acceptable: 50,
  },

  verificationSampleRate: 0.1,  // 10%
  minConfidence: 50,

  challengeCooldownMs: 30000,   // 30 seconds
  maxPendingChallenges: 5,
  challengeExpiryMs: 1800000,   // 30 minutes
};

// Work type descriptions
const WORK_DESCRIPTIONS: Record<WorkType, string> = {
  index_transactions: 'Classify and index transactions by type, category, and involved programs',
  analyze_patterns: 'Detect suspicious patterns like wash trading, MEV, or sandwich attacks',
  validate_data: 'Cross-reference and validate blockchain data for accuracy',
  compute_analytics: 'Calculate network metrics like TPS, TVL changes, and activity stats',
  classify_wallets: 'Label wallet addresses by their behavior and purpose',
  extract_entities: 'Identify known entities (exchanges, protocols) from on-chain activity',
};

// ============================================================================
// Proof-of-Useful-Work System
// ============================================================================

export class FederationPoUW {
  private config: PoUWConfig;
  private challenges = new Map<string, UsefulWorkChallenge>();
  private completedWork = new Map<string, WorkResult>();
  private contributions = new Map<string, {
    count: number;
    totalRewards: bigint;
    lastWork: number;
  }>();
  private stats: PoUWStats = {
    totalChallengesIssued: 0,
    totalChallengesCompleted: 0,
    totalUsefulWork: 0,
    workByType: {
      index_transactions: 0,
      analyze_patterns: 0,
      validate_data: 0,
      compute_analytics: 0,
      classify_wallets: 0,
      extract_entities: 0,
    },
    averageQuality: 0,
    totalRewardsDistributed: 0n,
    topContributors: [],
  };
  private qualityScores: number[] = [];

  // Simulated blockchain data source
  private dataSource: DataSource;

  constructor(config: Partial<PoUWConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataSource = new DataSource();
  }

  // ==========================================================================
  // Challenge Generation
  // ==========================================================================

  /**
   * Create a useful work challenge
   */
  async createChallenge(
    serverId: string,
    preferredWorkType?: WorkType
  ): Promise<UsefulWorkChallenge> {
    // Check rate limit
    const contrib = this.contributions.get(serverId);
    if (contrib) {
      const timeSince = Date.now() - contrib.lastWork;
      if (timeSince < this.config.challengeCooldownMs) {
        throw new Error(
          `Rate limited. Wait ${Math.ceil((this.config.challengeCooldownMs - timeSince) / 1000)}s`
        );
      }
    }

    // Check pending
    const pending = this.getPendingChallenges(serverId);
    if (pending.length >= this.config.maxPendingChallenges) {
      throw new Error(`Maximum pending challenges (${this.config.maxPendingChallenges}) reached`);
    }

    // Select work type
    const workType = preferredWorkType || this.selectWorkType();

    // Generate work based on type
    const { inputData, difficulty } = await this.generateWork(workType);

    const challenge: UsefulWorkChallenge = {
      id: `pouw_${Date.now()}_${randomBytes(4).toString('hex')}`,
      serverId,
      workType,
      difficulty,
      inputData,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.challengeExpiryMs,
      baseReward: this.config.baseRewards[workType],
      qualityMultiplier: 1.0,
      completed: false,
    };

    this.challenges.set(challenge.id, challenge);
    this.stats.totalChallengesIssued++;

    console.log(`[PoUW] Created ${workType} challenge ${challenge.id} (difficulty ${difficulty})`);

    return challenge;
  }

  /**
   * Select work type based on network needs
   */
  private selectWorkType(): WorkType {
    // Prioritize work types with least recent completion
    const workTypes: WorkType[] = [
      'index_transactions',
      'analyze_patterns',
      'validate_data',
      'compute_analytics',
      'classify_wallets',
      'extract_entities',
    ];

    // Weight by inverse of completion count
    const weights = workTypes.map(type => {
      const count = this.stats.workByType[type];
      return 1 / (count + 1);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < workTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return workTypes[i];
      }
    }

    return 'index_transactions';
  }

  /**
   * Generate work data for a challenge
   */
  private async generateWork(workType: WorkType): Promise<{
    inputData: WorkInput;
    difficulty: number;
  }> {
    switch (workType) {
      case 'index_transactions':
        return this.generateIndexingWork();

      case 'analyze_patterns':
        return this.generatePatternAnalysisWork();

      case 'validate_data':
        return this.generateValidationWork();

      case 'compute_analytics':
        return this.generateAnalyticsWork();

      case 'classify_wallets':
        return this.generateClassificationWork();

      case 'extract_entities':
        return this.generateEntityExtractionWork();

      default:
        return this.generateIndexingWork();
    }
  }

  private async generateIndexingWork(): Promise<{ inputData: WorkInput; difficulty: number }> {
    const transactions = this.dataSource.getRandomTransactions(this.config.workBatchSize);
    const dataHash = this.hashData(transactions);

    return {
      inputData: {
        dataHash,
        transactions,
      },
      difficulty: Math.min(Math.ceil(transactions.length / 10), this.config.maxDifficulty),
    };
  }

  private async generatePatternAnalysisWork(): Promise<{ inputData: WorkInput; difficulty: number }> {
    const transactions = this.dataSource.getRandomTransactions(this.config.workBatchSize * 2);
    const addresses = [...new Set(transactions.flatMap(t => t.accounts))];

    return {
      inputData: {
        dataHash: this.hashData(transactions),
        transactions,
        addresses: addresses.slice(0, 20),
        timeRange: {
          start: Date.now() - 24 * 60 * 60 * 1000,
          end: Date.now(),
        },
      },
      difficulty: 7, // Pattern analysis is harder
    };
  }

  private async generateValidationWork(): Promise<{ inputData: WorkInput; difficulty: number }> {
    const transactions = this.dataSource.getRandomTransactions(30);

    return {
      inputData: {
        dataHash: this.hashData(transactions),
        transactions,
      },
      difficulty: 3,
    };
  }

  private async generateAnalyticsWork(): Promise<{ inputData: WorkInput; difficulty: number }> {
    return {
      inputData: {
        dataHash: randomBytes(16).toString('hex'),
        timeRange: {
          start: Date.now() - 60 * 60 * 1000,
          end: Date.now(),
        },
        targetMetrics: ['tps', 'active_wallets', 'transaction_volume', 'fee_stats'],
      },
      difficulty: 5,
    };
  }

  private async generateClassificationWork(): Promise<{ inputData: WorkInput; difficulty: number }> {
    const addresses = this.dataSource.getRandomAddresses(20);

    return {
      inputData: {
        dataHash: this.hashData(addresses),
        addresses,
      },
      difficulty: 6,
    };
  }

  private async generateEntityExtractionWork(): Promise<{ inputData: WorkInput; difficulty: number }> {
    const transactions = this.dataSource.getRandomTransactions(this.config.workBatchSize);
    const addresses = [...new Set(transactions.flatMap(t => t.accounts))];

    return {
      inputData: {
        dataHash: this.hashData({ transactions, addresses }),
        transactions,
        addresses,
      },
      difficulty: 8, // Entity extraction is complex
    };
  }

  // ==========================================================================
  // Result Submission
  // ==========================================================================

  /**
   * Submit work result
   */
  async submitResult(
    challengeId: string,
    result: WorkResult
  ): Promise<{
    accepted: boolean;
    reward?: bigint;
    qualityScore?: number;
    feedback?: string;
    error?: string;
  }> {
    const challenge = this.challenges.get(challengeId);

    if (!challenge) {
      return { accepted: false, error: 'Challenge not found' };
    }

    if (challenge.completed) {
      return { accepted: false, error: 'Challenge already completed' };
    }

    if (Date.now() > challenge.expiresAt) {
      return { accepted: false, error: 'Challenge expired' };
    }

    // Verify proof of work
    if (!this.verifyProof(challenge, result)) {
      return { accepted: false, error: 'Invalid proof of work' };
    }

    // Validate result quality
    const quality = this.evaluateQuality(challenge, result);

    if (quality.confidence < this.config.minConfidence) {
      return {
        accepted: false,
        error: `Quality too low: ${quality.confidence}%. Minimum: ${this.config.minConfidence}%`,
        qualityScore: quality.confidence,
        feedback: quality.feedback,
      };
    }

    // Calculate reward
    const qualityMultiplier = this.getQualityMultiplier(quality.confidence);
    const difficultyMultiplier = 1 + (challenge.difficulty - 1) * 0.2;
    const reward = BigInt(
      Math.floor(Number(challenge.baseReward) * qualityMultiplier * difficultyMultiplier)
    );

    // Mark complete
    challenge.completed = true;
    challenge.result = result;
    challenge.qualityMultiplier = qualityMultiplier;

    // Store useful work
    this.completedWork.set(challengeId, result);

    // Update stats
    this.stats.totalChallengesCompleted++;
    this.stats.totalUsefulWork++;
    this.stats.workByType[challenge.workType]++;
    this.stats.totalRewardsDistributed += reward;
    this.qualityScores.push(quality.confidence);
    this.stats.averageQuality =
      this.qualityScores.reduce((a, b) => a + b, 0) / this.qualityScores.length;

    // Update contributor
    const contrib = this.contributions.get(challenge.serverId) || {
      count: 0,
      totalRewards: 0n,
      lastWork: 0,
    };
    contrib.count++;
    contrib.totalRewards += reward;
    contrib.lastWork = Date.now();
    this.contributions.set(challenge.serverId, contrib);

    this.updateTopContributors();

    console.log(
      `[PoUW] ${challenge.workType} completed by ${challenge.serverId}. ` +
      `Quality: ${quality.confidence}%, Reward: ${reward}`
    );

    return {
      accepted: true,
      reward,
      qualityScore: quality.confidence,
      feedback: quality.feedback,
    };
  }

  /**
   * Verify cryptographic proof of computation
   */
  private verifyProof(challenge: UsefulWorkChallenge, result: WorkResult): boolean {
    // Verify result hash matches actual result
    const computedHash = this.hashData(result);
    if (computedHash !== result.resultHash) {
      return false;
    }

    // Verify proof includes input data hash
    const proofData = `${challenge.inputData.dataHash}:${result.resultHash}:${result.workerId}`;
    const expectedProof = createHash('sha256').update(proofData).digest('hex');

    // Allow some flexibility in proof format
    return result.proofOfWork.includes(expectedProof.slice(0, 16));
  }

  /**
   * Evaluate result quality
   */
  private evaluateQuality(
    challenge: UsefulWorkChallenge,
    result: WorkResult
  ): { confidence: number; feedback: string } {
    let confidence = result.confidence;
    let feedback = '';

    switch (challenge.workType) {
      case 'index_transactions':
        const indexed = result.indexedTransactions || [];
        const inputCount = challenge.inputData.transactions?.length || 0;

        if (indexed.length < inputCount * 0.8) {
          confidence -= 20;
          feedback += 'Incomplete indexing. ';
        }
        if (indexed.some(t => !t.type || !t.category)) {
          confidence -= 10;
          feedback += 'Missing classifications. ';
        }
        break;

      case 'analyze_patterns':
        const patterns = result.detectedPatterns || [];
        if (patterns.length === 0) {
          confidence -= 10;
          feedback += 'No patterns detected (may be legitimate). ';
        }
        if (patterns.some(p => !p.evidence || p.evidence.length === 0)) {
          confidence -= 15;
          feedback += 'Patterns lack evidence. ';
        }
        break;

      case 'classify_wallets':
        const classified = result.classifiedWallets || [];
        if (classified.some(w => w.labels.length === 0)) {
          confidence -= 15;
          feedback += 'Some wallets not classified. ';
        }
        break;

      case 'extract_entities':
        const entities = result.extractedEntities || [];
        if (entities.length === 0) {
          confidence -= 5;
          feedback += 'No entities found (may be expected). ';
        }
        break;
    }

    // Penalize very fast submissions (likely low effort)
    if (result.computeTimeMs < 1000) {
      confidence -= 20;
      feedback += 'Suspiciously fast completion. ';
    }

    feedback = feedback || 'Good quality submission.';

    return { confidence: Math.max(0, Math.min(100, confidence)), feedback };
  }

  /**
   * Get quality multiplier for rewards
   */
  private getQualityMultiplier(confidence: number): number {
    if (confidence >= this.config.qualityThresholds.excellent) return 2.0;
    if (confidence >= this.config.qualityThresholds.good) return 1.5;
    if (confidence >= this.config.qualityThresholds.acceptable) return 1.0;
    return 0.5;
  }

  // ==========================================================================
  // Query Useful Work Results
  // ==========================================================================

  /**
   * Get indexed transaction data
   */
  getIndexedTransactions(filters?: {
    type?: string;
    category?: string;
    limit?: number;
  }): IndexedTransaction[] {
    const results: IndexedTransaction[] = [];

    for (const work of this.completedWork.values()) {
      if (work.indexedTransactions) {
        for (const tx of work.indexedTransactions) {
          if (filters?.type && tx.type !== filters.type) continue;
          if (filters?.category && tx.category !== filters.category) continue;
          results.push(tx);
        }
      }
    }

    return filters?.limit ? results.slice(0, filters.limit) : results;
  }

  /**
   * Get detected patterns
   */
  getDetectedPatterns(filters?: {
    type?: string;
    minSeverity?: string;
    address?: string;
  }): DetectedPattern[] {
    const results: DetectedPattern[] = [];
    const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];

    for (const work of this.completedWork.values()) {
      if (work.detectedPatterns) {
        for (const pattern of work.detectedPatterns) {
          if (filters?.type && pattern.patternType !== filters.type) continue;
          if (filters?.minSeverity) {
            const minIdx = severityOrder.indexOf(filters.minSeverity);
            const patternIdx = severityOrder.indexOf(pattern.severity);
            if (patternIdx < minIdx) continue;
          }
          if (filters?.address && !pattern.involvedAddresses.includes(filters.address)) continue;
          results.push(pattern);
        }
      }
    }

    return results;
  }

  /**
   * Get classified wallets
   */
  getClassifiedWallets(addresses?: string[]): ClassifiedWallet[] {
    const results: ClassifiedWallet[] = [];

    for (const work of this.completedWork.values()) {
      if (work.classifiedWallets) {
        for (const wallet of work.classifiedWallets) {
          if (addresses && !addresses.includes(wallet.address)) continue;
          results.push(wallet);
        }
      }
    }

    return results;
  }

  /**
   * Get extracted entities
   */
  getExtractedEntities(type?: string): ExtractedEntity[] {
    const results: ExtractedEntity[] = [];

    for (const work of this.completedWork.values()) {
      if (work.extractedEntities) {
        for (const entity of work.extractedEntities) {
          if (type && entity.type !== type) continue;
          results.push(entity);
        }
      }
    }

    return results;
  }

  // ==========================================================================
  // Statistics & Helpers
  // ==========================================================================

  getStats(): PoUWStats {
    return { ...this.stats, totalRewardsDistributed: this.stats.totalRewardsDistributed };
  }

  getPendingChallenges(serverId: string): UsefulWorkChallenge[] {
    const now = Date.now();
    return Array.from(this.challenges.values()).filter(
      c => c.serverId === serverId && !c.completed && c.expiresAt > now
    );
  }

  getWorkDescription(workType: WorkType): string {
    return WORK_DESCRIPTIONS[workType];
  }

  private hashData(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private updateTopContributors(): void {
    const entries = Array.from(this.contributions.entries())
      .map(([serverId, data]) => ({
        serverId,
        contributions: data.count,
        totalRewards: data.totalRewards,
      }))
      .sort((a, b) => {
        const diff = b.totalRewards - a.totalRewards;
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      })
      .slice(0, 10);

    this.stats.topContributors = entries;
  }

  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, challenge] of this.challenges) {
      if (!challenge.completed && challenge.expiresAt < now) {
        this.challenges.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ============================================================================
// Simulated Data Source
// ============================================================================

class DataSource {
  private programIds = [
    '11111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  ];

  private transactionTypes = [
    'transfer', 'swap', 'stake', 'unstake', 'mint', 'burn',
    'create_account', 'close_account', 'nft_transfer', 'nft_mint',
  ];

  getRandomTransactions(count: number): TransactionInput[] {
    const transactions: TransactionInput[] = [];

    for (let i = 0; i < count; i++) {
      transactions.push({
        signature: this.randomSignature(),
        slot: Math.floor(Math.random() * 1000000) + 250000000,
        blockTime: Date.now() - Math.floor(Math.random() * 86400000),
        accounts: this.randomAddresses(Math.floor(Math.random() * 5) + 2),
        programIds: this.randomPrograms(Math.floor(Math.random() * 3) + 1),
        data: randomBytes(Math.floor(Math.random() * 100) + 20).toString('base64'),
      });
    }

    return transactions;
  }

  getRandomAddresses(count: number): string[] {
    return this.randomAddresses(count);
  }

  private randomSignature(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private randomAddresses(count: number): string[] {
    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      addresses.push(this.randomAddress());
    }
    return addresses;
  }

  private randomAddress(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private randomPrograms(count: number): string[] {
    const selected: string[] = [];
    for (let i = 0; i < count; i++) {
      selected.push(this.programIds[Math.floor(Math.random() * this.programIds.length)]);
    }
    return [...new Set(selected)];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalPoUW: FederationPoUW | null = null;

export function getFederationPoUW(): FederationPoUW {
  if (!globalPoUW) {
    globalPoUW = new FederationPoUW();
  }
  return globalPoUW;
}

export function createFederationPoUW(config?: Partial<PoUWConfig>): FederationPoUW {
  globalPoUW = new FederationPoUW(config);
  return globalPoUW;
}

// ============================================================================
// API Handler
// ============================================================================

export function createPoUWHandler(pouw: FederationPoUW) {
  return {
    /**
     * POST /pouw/challenge
     */
    createChallenge: async (serverId: string, workType?: WorkType) => {
      const challenge = await pouw.createChallenge(serverId, workType);
      return {
        id: challenge.id,
        workType: challenge.workType,
        description: pouw.getWorkDescription(challenge.workType),
        difficulty: challenge.difficulty,
        inputData: challenge.inputData,
        expiresAt: challenge.expiresAt,
        baseReward: challenge.baseReward.toString(),
      };
    },

    /**
     * POST /pouw/submit
     */
    submitResult: async (challengeId: string, result: WorkResult) => {
      const response = await pouw.submitResult(challengeId, result);
      return {
        ...response,
        reward: response.reward?.toString(),
      };
    },

    /**
     * GET /pouw/stats
     */
    getStats: () => {
      const stats = pouw.getStats();
      return {
        ...stats,
        totalRewardsDistributed: stats.totalRewardsDistributed.toString(),
        topContributors: stats.topContributors.map(c => ({
          ...c,
          totalRewards: c.totalRewards.toString(),
        })),
      };
    },

    /**
     * GET /pouw/work-types
     */
    getWorkTypes: () => {
      return Object.entries(WORK_DESCRIPTIONS).map(([type, description]) => ({
        type,
        description,
        baseReward: DEFAULT_CONFIG.baseRewards[type as WorkType].toString(),
      }));
    },

    /**
     * GET /pouw/indexed
     */
    getIndexedTransactions: (filters?: any) => pouw.getIndexedTransactions(filters),

    /**
     * GET /pouw/patterns
     */
    getPatterns: (filters?: any) => pouw.getDetectedPatterns(filters),

    /**
     * GET /pouw/wallets
     */
    getClassifiedWallets: (addresses?: string[]) => pouw.getClassifiedWallets(addresses),

    /**
     * GET /pouw/entities
     */
    getEntities: (type?: string) => pouw.getExtractedEntities(type),
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  FederationPoUW,
  getFederationPoUW,
  createFederationPoUW,
  createPoUWHandler,
  WORK_DESCRIPTIONS,
};
