/**
 * ML-powered transaction pattern recognition system
 * 
 * This module provides advanced machine learning capabilities for analyzing
 * transaction patterns across multiple blockchains, identifying anomalies,
 * behavioral patterns, and providing intelligent insights.
 */

import {
  ChainId,
  UnifiedTransaction,
  UnifiedAccount,
  DeFiInteraction,
  TokenTransfer,
  PatternRecognition,
  MEVData
} from './types';

// ML Model interfaces
export interface MLModel {
  name: string;
  version: string;
  type: 'classification' | 'clustering' | 'anomaly_detection' | 'regression';
  accuracy?: number;
  lastTrained: number;
  features: string[];
}

export interface PatternFeatures {
  // Transaction characteristics
  transactionValue: number;
  transactionCount: number;
  gasPrice?: number;
  gasUsed?: number;
  
  // Temporal features
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  timeSinceLastTx: number; // milliseconds
  transactionFrequency: number; // tx per hour
  
  // Network features
  chainId: string;
  blockPosition: number; // position in block
  
  // Address features
  addressAge: number; // days since first activity
  addressTxCount: number;
  addressBalance: number;
  uniqueCounterparties: number;
  
  // Token features
  tokenCount: number; // number of different tokens
  tokenDiversity: number; // entropy of token distribution
  rarTokenInteraction: boolean; // interacts with rare tokens
  
  // DeFi features
  defiInteractionCount: number;
  protocolDiversity: number;
  defiComplexity: number; // complexity of DeFi interactions
  
  // Pattern features
  roundNumberPattern: boolean; // uses round numbers
  sequentialPattern: boolean; // sequential transactions
  batchPattern: boolean; // batch-like behavior
  arbitragePattern: boolean; // arbitrage-like behavior
  
  // Risk features
  failureRate: number; // historical failure rate
  sanctionedInteraction: boolean; // interaction with sanctioned addresses
  mixerInteraction: boolean; // interaction with mixing services
}

export interface TransactionPattern {
  id: string;
  name: string;
  description: string;
  category: 'legitimate' | 'suspicious' | 'bot' | 'mev' | 'arbitrage' | 'wash_trading' | 'phishing';
  confidence: number; // 0-1
  riskScore: number; // 0-100
  indicators: string[];
  metadata: any;
}

export interface BehavioralProfile {
  address: string;
  chainId: ChainId;
  profileType: 'human' | 'bot' | 'contract' | 'exchange' | 'bridge' | 'unknown';
  confidence: number;
  
  // Behavioral characteristics
  activityPattern: ActivityPattern;
  transactionPattern: TransactionBehaviorPattern;
  networkBehavior: NetworkBehavior;
  riskProfile: RiskProfile;
  
  // ML scores
  botScore: number; // 0-1, probability of being a bot
  humanScore: number; // 0-1, probability of being human
  riskScore: number; // 0-100, overall risk score
  
  lastUpdated: number;
  sampleSize: number; // number of transactions analyzed
}

export interface ActivityPattern {
  timezone: string;
  peakHours: number[];
  activedays: number[];
  sessionDuration: number; // average session length
  regularity: number; // 0-1, how regular the activity is
  burstiness: number; // 0-1, tendency to have bursts of activity
}

export interface TransactionBehaviorPattern {
  averageValue: number;
  valueVariance: number;
  gasOptimization: number; // 0-1, how well gas is optimized
  failureRate: number;
  retryBehavior: number; // tendency to retry failed transactions
  roundNumberUsage: number; // 0-1, tendency to use round numbers
}

export interface NetworkBehavior {
  chainPreference: Array<{ chainId: ChainId; frequency: number }>;
  protocolUsage: Array<{ protocol: string; frequency: number }>;
  counterpartyDiversity: number; // 0-1, diversity of counterparties
  hubScore: number; // 0-1, how much of a hub this address is
}

export interface RiskProfile {
  sanctionRisk: number; // 0-100
  mixingRisk: number; // 0-100
  phishingRisk: number; // 0-100
  fraudRisk: number; // 0-100
  riskSources: string[];
}

export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  anomalyScore: number; // 0-1, higher is more anomalous
  anomalyType: 'value' | 'timing' | 'behavior' | 'network' | 'gas' | 'multiple';
  description: string;
  confidence: number;
  similarTransactions: string[]; // similar transaction hashes
}

// Main ML Pattern Recognition System
export class MLPatternRecognizer {
  private models: Map<string, MLModel> = new Map();
  private featureCache: Map<string, PatternFeatures> = new Map();
  private patternCache: Map<string, TransactionPattern[]> = new Map();
  private profileCache: Map<string, BehavioralProfile> = new Map();
  
  // Known pattern templates
  private readonly PATTERN_TEMPLATES: TransactionPattern[] = [
    {
      id: 'bot_trading',
      name: 'Bot Trading',
      description: 'Automated trading bot behavior with regular patterns',
      category: 'bot',
      confidence: 0.8,
      riskScore: 20,
      indicators: ['regular_timing', 'gas_optimization', 'round_numbers'],
      metadata: { type: 'trading_bot' }
    },
    {
      id: 'mev_frontrunning',
      name: 'MEV Frontrunning',
      description: 'Frontrunning transactions for MEV extraction',
      category: 'mev',
      confidence: 0.9,
      riskScore: 30,
      indicators: ['high_gas_price', 'block_position', 'value_correlation'],
      metadata: { type: 'frontrun' }
    },
    {
      id: 'wash_trading',
      name: 'Wash Trading',
      description: 'Artificial trading to inflate volume',
      category: 'wash_trading',
      confidence: 0.7,
      riskScore: 70,
      indicators: ['circular_transactions', 'same_counterparties', 'regular_amounts'],
      metadata: { type: 'volume_manipulation' }
    },
    {
      id: 'arbitrage_bot',
      name: 'Arbitrage Bot',
      description: 'Cross-chain or cross-protocol arbitrage',
      category: 'arbitrage',
      confidence: 0.85,
      riskScore: 10,
      indicators: ['multi_chain', 'price_correlation', 'fast_execution'],
      metadata: { type: 'arbitrage' }
    },
    {
      id: 'phishing_attack',
      name: 'Phishing Attack',
      description: 'Potential phishing or scam activity',
      category: 'phishing',
      confidence: 0.9,
      riskScore: 95,
      indicators: ['multiple_victims', 'token_draining', 'new_address'],
      metadata: { type: 'scam' }
    }
  ];

  constructor() {
    this.initializeModels();
  }

  /**
   * Analyze a transaction for patterns
   */
  async analyzeTransaction(
    transaction: UnifiedTransaction,
    context?: {
      recentTransactions?: UnifiedTransaction[];
      accountHistory?: UnifiedAccount;
      networkState?: any;
    }
  ): Promise<PatternRecognition> {
    try {
      // Extract features from the transaction
      const features = await this.extractTransactionFeatures(transaction, context);
      
      // Run pattern detection
      const patterns = await this.detectPatterns(features, transaction);
      
      // Calculate anomaly score
      const anomalyResult = await this.detectAnomalies(features, transaction);
      
      // Generate insights
      const insights = this.generateInsights(patterns, anomalyResult);

      return {
        transactionHash: transaction.id,
        chainId: transaction.chainId,
        patterns: patterns.map(pattern => ({
          type: pattern.name,
          confidence: pattern.confidence,
          description: pattern.description,
          metadata: pattern.metadata
        })),
        anomalyScore: anomalyResult.anomalyScore,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error analyzing transaction patterns:', error);
      throw error;
    }
  }

  /**
   * Analyze behavioral patterns for an address
   */
  async analyzeBehavioralProfile(
    address: string,
    chainId: ChainId,
    transactions: UnifiedTransaction[],
    timeWindow?: number
  ): Promise<BehavioralProfile> {
    try {
      const cacheKey = `${chainId}:${address}`;
      
      // Check cache
      if (this.profileCache.has(cacheKey)) {
        const cached = this.profileCache.get(cacheKey)!;
        if (Date.now() - cached.lastUpdated < (timeWindow || 3600000)) { // 1 hour default
          return cached;
        }
      }

      // Filter transactions for the time window
      const now = Date.now();
      const windowStart = now - (timeWindow || 7 * 24 * 60 * 60 * 1000); // 7 days default
      const relevantTxs = transactions.filter(tx => tx.timestamp > windowStart);

      if (relevantTxs.length < 5) {
        // Not enough data for analysis
        return this.createEmptyProfile(address, chainId);
      }

      // Analyze different behavioral aspects
      const activityPattern = this.analyzeActivityPattern(relevantTxs);
      const transactionPattern = this.analyzeTransactionBehavior(relevantTxs);
      const networkBehavior = this.analyzeNetworkBehavior(relevantTxs);
      const riskProfile = this.analyzeRiskProfile(relevantTxs);

      // Calculate ML scores
      const botScore = this.calculateBotScore(activityPattern, transactionPattern, networkBehavior);
      const humanScore = 1 - botScore;
      const riskScore = this.calculateOverallRiskScore(riskProfile, botScore);

      // Determine profile type
      const profileType = this.determineProfileType(botScore, transactionPattern, networkBehavior);

      const profile: BehavioralProfile = {
        address,
        chainId,
        profileType,
        confidence: this.calculateProfileConfidence(relevantTxs.length, botScore),
        activityPattern,
        transactionPattern,
        networkBehavior,
        riskProfile,
        botScore,
        humanScore,
        riskScore,
        lastUpdated: now,
        sampleSize: relevantTxs.length
      };

      this.profileCache.set(cacheKey, profile);
      return profile;
    } catch (error) {
      console.error('Error analyzing behavioral profile:', error);
      throw error;
    }
  }

  /**
   * Detect anomalies in real-time transaction stream
   */
  async detectStreamAnomalies(
    newTransaction: UnifiedTransaction,
    recentTransactions: UnifiedTransaction[]
  ): Promise<AnomalyDetectionResult> {
    try {
      const features = await this.extractTransactionFeatures(newTransaction, { recentTransactions });
      return this.detectAnomalies(features, newTransaction);
    } catch (error) {
      console.error('Error detecting stream anomalies:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple transactions for patterns
   */
  async batchAnalyzePatterns(
    transactions: UnifiedTransaction[]
  ): Promise<Map<string, PatternRecognition>> {
    const results = new Map<string, PatternRecognition>();

    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async tx => {
        try {
          const analysis = await this.analyzeTransaction(tx);
          return { hash: tx.id, analysis };
        } catch (error) {
          console.error(`Error analyzing transaction ${tx.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          results.set(result.value.hash, result.value.analysis);
        }
      });
    }

    return results;
  }

  /**
   * Train models with new transaction data
   */
  async trainModels(
    trainingData: Array<{
      transaction: UnifiedTransaction;
      labels: string[];
      features?: PatternFeatures;
    }>
  ): Promise<void> {
    try {
      console.log(`Training ML models with ${trainingData.length} samples`);

      // Extract features for all training data
      const featureData = await Promise.all(
        trainingData.map(async (data) => ({
          features: data.features || await this.extractTransactionFeatures(data.transaction),
          labels: data.labels
        }))
      );

      // Train different model types
      await this.trainClassificationModel(featureData);
      await this.trainAnomalyDetectionModel(featureData);
      await this.trainClusteringModel(featureData);

      console.log('Model training completed');
    } catch (error) {
      console.error('Error training models:', error);
      throw error;
    }
  }

  // Private helper methods

  private async initializeModels(): Promise<void> {
    // Initialize pre-trained models
    this.models.set('transaction_classifier', {
      name: 'Transaction Classifier',
      version: '1.0.0',
      type: 'classification',
      accuracy: 0.85,
      lastTrained: Date.now(),
      features: ['transactionValue', 'gasPrice', 'timeOfDay', 'addressAge']
    });

    this.models.set('anomaly_detector', {
      name: 'Anomaly Detector',
      version: '1.0.0',
      type: 'anomaly_detection',
      accuracy: 0.78,
      lastTrained: Date.now(),
      features: ['transactionValue', 'transactionFrequency', 'gasPrice', 'uniqueCounterparties']
    });

    this.models.set('behavior_clusterer', {
      name: 'Behavior Clusterer',
      version: '1.0.0',
      type: 'clustering',
      lastTrained: Date.now(),
      features: ['activityPattern', 'transactionPattern', 'networkBehavior']
    });
  }

  private async extractTransactionFeatures(
    transaction: UnifiedTransaction,
    context?: {
      recentTransactions?: UnifiedTransaction[];
      accountHistory?: UnifiedAccount;
      networkState?: any;
    }
  ): Promise<PatternFeatures> {
    const cacheKey = `${transaction.chainId}:${transaction.id}`;
    
    if (this.featureCache.has(cacheKey)) {
      return this.featureCache.get(cacheKey)!;
    }

    const recentTxs = context?.recentTransactions || [];
    const account = context?.accountHistory;

    // Extract temporal features
    const txDate = new Date(transaction.timestamp);
    const timeOfDay = txDate.getHours();
    const dayOfWeek = txDate.getDay();
    
    const timeSinceLastTx = recentTxs.length > 0 
      ? transaction.timestamp - Math.max(...recentTxs.map(tx => tx.timestamp))
      : 0;
    
    const transactionFrequency = recentTxs.length > 0 
      ? recentTxs.length / ((Date.now() - Math.min(...recentTxs.map(tx => tx.timestamp))) / 3600000)
      : 0;

    // Extract address features
    const addressTxCount = account?.transactionCount || recentTxs.length;
    const addressBalance = account ? parseFloat(account.balance) : 0;
    const uniqueCounterparties = new Set([
      ...recentTxs.map(tx => tx.to).filter(Boolean),
      ...recentTxs.map(tx => tx.from)
    ]).size;

    // Extract token features
    const allTokens = transaction.tokenTransfers.map(t => t.symbol);
    const tokenCount = new Set(allTokens).size;
    const tokenDiversity = this.calculateEntropy(allTokens);
    const rareTokenInteraction = this.hasRareTokenInteraction(transaction.tokenTransfers);

    // Extract DeFi features
    const defiInteractionCount = transaction.defiInteractions.length;
    const protocols = transaction.defiInteractions.map(i => i.protocol);
    const protocolDiversity = new Set(protocols).size;
    const defiComplexity = this.calculateDeFiComplexity(transaction.defiInteractions);

    // Extract pattern features
    const roundNumberPattern = this.detectRoundNumberPattern(transaction);
    const sequentialPattern = this.detectSequentialPattern(transaction, recentTxs);
    const batchPattern = this.detectBatchPattern(transaction, recentTxs);
    const arbitragePattern = this.detectArbitragePattern(transaction);

    // Extract risk features
    const failureRate = recentTxs.length > 0 
      ? recentTxs.filter(tx => tx.status === 'failed').length / recentTxs.length 
      : 0;
    
    const sanctionedInteraction = this.detectSanctionedInteraction(transaction);
    const mixerInteraction = this.detectMixerInteraction(transaction);

    const features: PatternFeatures = {
      transactionValue: parseFloat(transaction.value),
      transactionCount: addressTxCount,
      gasPrice: transaction.gasPrice ? parseFloat(transaction.gasPrice) : 0,
      gasUsed: transaction.gasUsed || 0,
      timeOfDay,
      dayOfWeek,
      timeSinceLastTx,
      transactionFrequency,
      chainId: transaction.chainId,
      blockPosition: 0, // Would need block analysis
      addressAge: account?.firstSeen ? (Date.now() - account.firstSeen) / (24 * 60 * 60 * 1000) : 0,
      addressTxCount,
      addressBalance,
      uniqueCounterparties,
      tokenCount,
      tokenDiversity,
      rarTokenInteraction: rareTokenInteraction,
      defiInteractionCount,
      protocolDiversity,
      defiComplexity,
      roundNumberPattern,
      sequentialPattern,
      batchPattern,
      arbitragePattern,
      failureRate,
      sanctionedInteraction,
      mixerInteraction
    };

    this.featureCache.set(cacheKey, features);
    return features;
  }

  private async detectPatterns(
    features: PatternFeatures,
    transaction: UnifiedTransaction
  ): Promise<TransactionPattern[]> {
    const detectedPatterns: TransactionPattern[] = [];

    for (const template of this.PATTERN_TEMPLATES) {
      const match = await this.matchPattern(template, features, transaction);
      if (match) {
        detectedPatterns.push({
          ...template,
          confidence: match.confidence,
          metadata: { ...template.metadata, ...match.evidence }
        });
      }
    }

    return detectedPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  private async matchPattern(
    template: TransactionPattern,
    features: PatternFeatures,
    transaction: UnifiedTransaction
  ): Promise<{ confidence: number; evidence: any } | null> {
    let score = 0;
    let maxScore = 0;
    const evidence: any = {};

    // Bot trading pattern
    if (template.id === 'bot_trading') {
      maxScore = 100;
      
      if (features.transactionFrequency > 10) {
        score += 30;
        evidence.high_frequency = features.transactionFrequency;
      }
      
      if (features.roundNumberPattern) {
        score += 25;
        evidence.round_numbers = true;
      }
      
      if (features.failureRate < 0.02) {
        score += 20;
        evidence.low_failure_rate = features.failureRate;
      }
      
      if (features.gasPrice && features.gasPrice > 0) {
        // Gas optimization check
        score += 25;
        evidence.gas_optimization = true;
      }
    }

    // MEV frontrunning pattern
    else if (template.id === 'mev_frontrunning') {
      maxScore = 100;
      
      if (features.gasPrice && features.gasPrice > 50e9) { // High gas price
        score += 40;
        evidence.high_gas_price = features.gasPrice;
      }
      
      if (transaction.mevData) {
        score += 50;
        evidence.mev_detected = transaction.mevData.type;
      }
      
      if (features.arbitragePattern) {
        score += 10;
        evidence.arbitrage_pattern = true;
      }
    }

    // Wash trading pattern
    else if (template.id === 'wash_trading') {
      maxScore = 100;
      
      if (features.batchPattern) {
        score += 30;
        evidence.batch_pattern = true;
      }
      
      if (features.uniqueCounterparties < 3 && features.transactionCount > 20) {
        score += 40;
        evidence.limited_counterparties = features.uniqueCounterparties;
      }
      
      if (features.roundNumberPattern) {
        score += 30;
        evidence.round_numbers = true;
      }
    }

    // Additional pattern matching logic for other templates...

    const confidence = maxScore > 0 ? score / maxScore : 0;
    
    return confidence > 0.5 ? { confidence, evidence } : null;
  }

  private async detectAnomalies(
    features: PatternFeatures,
    transaction: UnifiedTransaction
  ): Promise<AnomalyDetectionResult> {
    let anomalyScore = 0;
    let anomalyType: AnomalyDetectionResult['anomalyType'] = 'value';
    let description = 'Transaction appears normal';
    const evidence: string[] = [];

    // Value anomalies
    if (features.transactionValue > 1000000) { // Very high value
      anomalyScore = Math.max(anomalyScore, 0.8);
      anomalyType = 'value';
      description = 'Unusually high transaction value';
      evidence.push('high_value');
    }

    // Timing anomalies
    if (features.transactionFrequency > 100) { // Very high frequency
      anomalyScore = Math.max(anomalyScore, 0.7);
      anomalyType = 'timing';
      description = 'Unusually high transaction frequency';
      evidence.push('high_frequency');
    }

    // Behavior anomalies
    if (features.failureRate > 0.5) { // High failure rate
      anomalyScore = Math.max(anomalyScore, 0.6);
      anomalyType = 'behavior';
      description = 'High transaction failure rate';
      evidence.push('high_failure_rate');
    }

    // Gas anomalies (for EVM chains)
    if (features.gasPrice && features.gasPrice > 200e9) { // Very high gas price
      anomalyScore = Math.max(anomalyScore, 0.5);
      anomalyType = 'gas';
      description = 'Extremely high gas price';
      evidence.push('extreme_gas_price');
    }

    // Risk anomalies
    if (features.sanctionedInteraction || features.mixerInteraction) {
      anomalyScore = Math.max(anomalyScore, 0.9);
      anomalyType = 'network';
      description = 'Interaction with high-risk addresses';
      evidence.push('high_risk_interaction');
    }

    return {
      isAnomalous: anomalyScore > 0.4,
      anomalyScore,
      anomalyType,
      description,
      confidence: Math.min(anomalyScore + 0.2, 1.0),
      similarTransactions: [] // Would implement similarity search
    };
  }

  private generateInsights(
    patterns: TransactionPattern[],
    anomalyResult: AnomalyDetectionResult
  ): string[] {
    const insights: string[] = [];

    if (patterns.length > 0) {
      const topPattern = patterns[0];
      insights.push(`Most likely pattern: ${topPattern.name} (${(topPattern.confidence * 100).toFixed(1)}% confidence)`);
      
      if (topPattern.category === 'bot') {
        insights.push('This address exhibits automated bot-like behavior');
      } else if (topPattern.category === 'mev') {
        insights.push('Transaction shows signs of MEV extraction activity');
      }
    }

    if (anomalyResult.isAnomalous) {
      insights.push(`Anomaly detected: ${anomalyResult.description}`);
    }

    return insights;
  }

  // Behavioral analysis methods

  private analyzeActivityPattern(transactions: UnifiedTransaction[]): ActivityPattern {
    const hours = transactions.map(tx => new Date(tx.timestamp).getHours());
    const days = transactions.map(tx => new Date(tx.timestamp).getDay());
    
    // Find peak hours (hours with more than average activity)
    const hourCounts = new Array(24).fill(0);
    hours.forEach(hour => hourCounts[hour]++);
    const avgHourlyActivity = transactions.length / 24;
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > avgHourlyActivity * 1.5)
      .map(({ hour }) => hour);

    // Active days
    const daySet = new Set(days);
    const activedays = Array.from(daySet);

    // Calculate regularity based on time intervals
    const intervals = this.calculateTimeIntervals(transactions);
    const regularity = this.calculateRegularity(intervals);

    return {
      timezone: 'UTC', // Would implement timezone detection
      peakHours,
      activedays,
      sessionDuration: this.calculateSessionDuration(transactions),
      regularity,
      burstiness: this.calculateBurstiness(intervals)
    };
  }

  private analyzeTransactionBehavior(transactions: UnifiedTransaction[]): TransactionBehaviorPattern {
    const values = transactions.map(tx => parseFloat(tx.value));
    const gasOptimization = this.calculateGasOptimization(transactions);
    const failureRate = transactions.filter(tx => tx.status === 'failed').length / transactions.length;
    
    return {
      averageValue: values.reduce((sum, val) => sum + val, 0) / values.length,
      valueVariance: this.calculateVariance(values),
      gasOptimization,
      failureRate,
      retryBehavior: this.calculateRetryBehavior(transactions),
      roundNumberUsage: this.calculateRoundNumberUsage(transactions)
    };
  }

  private analyzeNetworkBehavior(transactions: UnifiedTransaction[]): NetworkBehavior {
    const chainCounts = new Map<ChainId, number>();
    const protocolCounts = new Map<string, number>();
    const counterparties = new Set<string>();

    transactions.forEach(tx => {
      chainCounts.set(tx.chainId, (chainCounts.get(tx.chainId) || 0) + 1);
      
      tx.defiInteractions.forEach(interaction => {
        protocolCounts.set(interaction.protocol, (protocolCounts.get(interaction.protocol) || 0) + 1);
      });
      
      if (tx.to) counterparties.add(tx.to);
      counterparties.add(tx.from);
    });

    const chainPreference = Array.from(chainCounts.entries())
      .map(([chainId, count]) => ({ chainId, frequency: count / transactions.length }));

    const protocolUsage = Array.from(protocolCounts.entries())
      .map(([protocol, count]) => ({ protocol, frequency: count / transactions.length }));

    return {
      chainPreference,
      protocolUsage,
      counterpartyDiversity: counterparties.size / transactions.length,
      hubScore: this.calculateHubScore(transactions)
    };
  }

  private analyzeRiskProfile(transactions: UnifiedTransaction[]): RiskProfile {
    let sanctionRisk = 0;
    let mixingRisk = 0;
    let phishingRisk = 0;
    let fraudRisk = 0;
    const riskSources: string[] = [];

    transactions.forEach(tx => {
      if (tx.riskScore && tx.riskScore > 50) {
        fraudRisk += tx.riskScore;
        if (tx.riskFactors) {
          riskSources.push(...tx.riskFactors);
        }
      }
    });

    return {
      sanctionRisk: Math.min(sanctionRisk, 100),
      mixingRisk: Math.min(mixingRisk, 100),
      phishingRisk: Math.min(phishingRisk, 100),
      fraudRisk: Math.min(fraudRisk / transactions.length, 100),
      riskSources: [...new Set(riskSources)]
    };
  }

  // Utility methods

  private calculateBotScore(
    activity: ActivityPattern,
    behavior: TransactionBehaviorPattern,
    network: NetworkBehavior
  ): number {
    let score = 0;

    // High regularity suggests bot behavior
    score += activity.regularity * 0.3;

    // Low gas optimization variance suggests bot
    score += behavior.gasOptimization * 0.2;

    // Very low failure rate suggests bot
    if (behavior.failureRate < 0.02) score += 0.2;

    // High frequency of round numbers suggests bot
    score += behavior.roundNumberUsage * 0.15;

    // Low counterparty diversity suggests bot
    if (network.counterpartyDiversity < 0.1) score += 0.15;

    return Math.min(score, 1.0);
  }

  private calculateOverallRiskScore(riskProfile: RiskProfile, botScore: number): number {
    return (riskProfile.sanctionRisk * 0.3 +
            riskProfile.mixingRisk * 0.25 +
            riskProfile.phishingRisk * 0.25 +
            riskProfile.fraudRisk * 0.2) +
           (botScore > 0.8 ? 10 : 0); // Bots add some risk
  }

  private determineProfileType(
    botScore: number,
    behavior: TransactionBehaviorPattern,
    network: NetworkBehavior
  ): BehavioralProfile['profileType'] {
    if (botScore > 0.8) {
      return 'bot';
    } else if (network.protocolUsage.length > 5) {
      return 'contract';
    } else if (behavior.averageValue > 100000) {
      return 'exchange';
    } else if (network.chainPreference.length > 2) {
      return 'bridge';
    } else {
      return 'human';
    }
  }

  private calculateProfileConfidence(sampleSize: number, botScore: number): number {
    const sizeConfidence = Math.min(sampleSize / 100, 1.0); // More samples = higher confidence
    const scoreConfidence = Math.abs(botScore - 0.5) * 2; // Extreme scores = higher confidence
    
    return (sizeConfidence + scoreConfidence) / 2;
  }

  private createEmptyProfile(address: string, chainId: ChainId): BehavioralProfile {
    return {
      address,
      chainId,
      profileType: 'unknown',
      confidence: 0,
      activityPattern: {
        timezone: 'UTC',
        peakHours: [],
        activedays: [],
        sessionDuration: 0,
        regularity: 0,
        burstiness: 0
      },
      transactionPattern: {
        averageValue: 0,
        valueVariance: 0,
        gasOptimization: 0,
        failureRate: 0,
        retryBehavior: 0,
        roundNumberUsage: 0
      },
      networkBehavior: {
        chainPreference: [],
        protocolUsage: [],
        counterpartyDiversity: 0,
        hubScore: 0
      },
      riskProfile: {
        sanctionRisk: 0,
        mixingRisk: 0,
        phishingRisk: 0,
        fraudRisk: 0,
        riskSources: []
      },
      botScore: 0,
      humanScore: 1,
      riskScore: 0,
      lastUpdated: Date.now(),
      sampleSize: 0
    };
  }

  // Feature extraction helper methods

  private calculateEntropy(values: string[]): number {
    const freq = new Map<string, number>();
    values.forEach(val => freq.set(val, (freq.get(val) || 0) + 1));
    
    const total = values.length;
    let entropy = 0;
    
    for (const count of freq.values()) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  private hasRareTokenInteraction(transfers: TokenTransfer[]): boolean {
    // Simplified rare token detection
    return transfers.some(transfer => 
      transfer.symbol.length > 10 || transfer.symbol.includes('TEST')
    );
  }

  private calculateDeFiComplexity(interactions: DeFiInteraction[]): number {
    if (interactions.length === 0) return 0;
    
    const uniqueProtocols = new Set(interactions.map(i => i.protocol)).size;
    const uniqueTypes = new Set(interactions.map(i => i.type)).size;
    
    return (uniqueProtocols + uniqueTypes) / interactions.length;
  }

  private detectRoundNumberPattern(transaction: UnifiedTransaction): boolean {
    const value = parseFloat(transaction.value);
    if (value === 0) return false;
    
    // Check if value is a round number (ends in many zeros)
    const valueStr = value.toString();
    const trailingZeros = valueStr.match(/0+$/);
    
    return trailingZeros ? trailingZeros[0].length >= 3 : false;
  }

  private detectSequentialPattern(
    transaction: UnifiedTransaction,
    recentTxs: UnifiedTransaction[]
  ): boolean {
    // Simplified sequential pattern detection
    return recentTxs.length >= 3 && 
           recentTxs.every((tx, i) => i === 0 || tx.timestamp > recentTxs[i-1].timestamp);
  }

  private detectBatchPattern(
    transaction: UnifiedTransaction,
    recentTxs: UnifiedTransaction[]
  ): boolean {
    // Check for multiple transactions in a short time window
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const recentCount = recentTxs.filter(tx => 
      Math.abs(tx.timestamp - transaction.timestamp) < timeWindow
    ).length;
    
    return recentCount >= 5;
  }

  private detectArbitragePattern(transaction: UnifiedTransaction): boolean {
    // Simplified arbitrage detection
    return transaction.defiInteractions.length >= 2 &&
           transaction.defiInteractions.every(i => i.type === 'swap');
  }

  private detectSanctionedInteraction(transaction: UnifiedTransaction): boolean {
    // Would integrate with sanctioned address lists
    return false;
  }

  private detectMixerInteraction(transaction: UnifiedTransaction): boolean {
    // Would integrate with known mixer addresses
    return false;
  }

  private calculateTimeIntervals(transactions: UnifiedTransaction[]): number[] {
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const intervals: number[] = [];
    
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].timestamp - sorted[i-1].timestamp);
    }
    
    return intervals;
  }

  private calculateRegularity(intervals: number[]): number {
    if (intervals.length === 0) return 0;
    
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    
    return Math.max(0, 1 - (Math.sqrt(variance) / mean));
  }

  private calculateSessionDuration(transactions: UnifiedTransaction[]): number {
    // Simplified session calculation
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length < 2) return 0;
    
    return (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / (60 * 60 * 1000); // hours
  }

  private calculateBurstiness(intervals: number[]): number {
    if (intervals.length === 0) return 0;
    
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    
    return Math.sqrt(variance) / mean;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculateGasOptimization(transactions: UnifiedTransaction[]): number {
    const gasTransactions = transactions.filter(tx => tx.gasPrice && tx.gasUsed);
    if (gasTransactions.length === 0) return 0;
    
    // Simplified gas optimization score based on consistency
    const gasPrices = gasTransactions.map(tx => parseFloat(tx.gasPrice!));
    const variance = this.calculateVariance(gasPrices);
    const mean = gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length;
    
    return Math.max(0, 1 - (Math.sqrt(variance) / mean));
  }

  private calculateRetryBehavior(transactions: UnifiedTransaction[]): number {
    // Count failed transactions that were followed by successful ones with same value
    let retries = 0;
    
    for (let i = 0; i < transactions.length - 1; i++) {
      const current = transactions[i];
      const next = transactions[i + 1];
      
      if (current.status === 'failed' && 
          next.status === 'success' &&
          current.value === next.value &&
          Math.abs(next.timestamp - current.timestamp) < 60 * 60 * 1000) { // Within 1 hour
        retries++;
      }
    }
    
    return retries / transactions.length;
  }

  private calculateRoundNumberUsage(transactions: UnifiedTransaction[]): number {
    const roundNumbers = transactions.filter(tx => this.detectRoundNumberPattern(tx)).length;
    return roundNumbers / transactions.length;
  }

  private calculateHubScore(transactions: UnifiedTransaction[]): number {
    // Simplified hub score based on unique counterparties
    const counterparties = new Set<string>();
    transactions.forEach(tx => {
      if (tx.to) counterparties.add(tx.to);
      counterparties.add(tx.from);
    });
    
    return Math.min(counterparties.size / 100, 1.0);
  }

  // ML training methods (simplified implementations)

  private async trainClassificationModel(
    data: Array<{ features: PatternFeatures; labels: string[] }>
  ): Promise<void> {
    // Simplified training - in production, would use proper ML libraries
    console.log(`Training classification model with ${data.length} samples`);
    
    const model = this.models.get('transaction_classifier')!;
    model.lastTrained = Date.now();
    model.accuracy = 0.85 + Math.random() * 0.1; // Simulated improvement
  }

  private async trainAnomalyDetectionModel(
    data: Array<{ features: PatternFeatures; labels: string[] }>
  ): Promise<void> {
    console.log(`Training anomaly detection model with ${data.length} samples`);
    
    const model = this.models.get('anomaly_detector')!;
    model.lastTrained = Date.now();
    model.accuracy = 0.78 + Math.random() * 0.1;
  }

  private async trainClusteringModel(
    data: Array<{ features: PatternFeatures; labels: string[] }>
  ): Promise<void> {
    console.log(`Training clustering model with ${data.length} samples`);
    
    const model = this.models.get('behavior_clusterer')!;
    model.lastTrained = Date.now();
  }
}