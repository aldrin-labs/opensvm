/**
 * Cross-chain wallet clustering and relationship detection
 * 
 * This module provides advanced analytics for identifying relationships
 * between wallets across different blockchain networks through various
 * clustering algorithms and pattern analysis techniques.
 */

import {
  ChainId,
  UnifiedTransaction,
  UnifiedAccount,
  RelatedAddress,
  TokenTransfer,
  DeFiInteraction
} from './types';

// Clustering configuration
interface ClusteringConfig {
  minSimilarityThreshold: number; // 0-1, minimum similarity for clustering
  timeWindow: number; // Time window in milliseconds for transaction analysis
  minTransactionCount: number; // Minimum transactions required for analysis
  addressPatternWeight: number; // Weight for address pattern similarity
  behaviorPatternWeight: number; // Weight for behavior pattern similarity
  timingPatternWeight: number; // Weight for timing pattern similarity
  valuePatternWeight: number; // Weight for value pattern similarity
}

const DEFAULT_CONFIG: ClusteringConfig = {
  minSimilarityThreshold: 0.7,
  timeWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  minTransactionCount: 10,
  addressPatternWeight: 0.3,
  behaviorPatternWeight: 0.4,
  timingPatternWeight: 0.2,
  valuePatternWeight: 0.1
};

// Wallet relationship types with evidence
export interface WalletRelationship {
  address1: { chainId: ChainId; address: string };
  address2: { chainId: ChainId; address: string };
  relationshipType: 'same_owner' | 'frequent_interaction' | 'bridge_pair' | 'similar_pattern' | 'potential_bot';
  confidence: number; // 0-1
  evidence: Evidence[];
  firstDetected: number;
  lastUpdated: number;
  strength: number; // Relationship strength 0-100
}

export interface Evidence {
  type: 'timing_pattern' | 'value_pattern' | 'bridge_activity' | 'defi_pattern' | 'address_pattern' | 'token_flow';
  description: string;
  weight: number;
  data: any;
  timestamp: number;
}

// Cluster of related addresses
export interface AddressCluster {
  id: string;
  addresses: Array<{ chainId: ChainId; address: string }>;
  clusterType: 'same_owner' | 'exchange' | 'protocol' | 'bot_network' | 'bridge_network';
  confidence: number;
  evidence: Evidence[];
  metadata: {
    totalValue: number; // USD
    totalTransactions: number;
    activeChains: ChainId[];
    firstActivity: number;
    lastActivity: number;
    riskScore: number;
  };
  created: number;
  updated: number;
}

// Main wallet clustering class
export class WalletClusterer {
  private config: ClusteringConfig;
  private addressCache: Map<string, AddressAnalysis> = new Map();
  private relationshipCache: Map<string, WalletRelationship[]> = new Map();

  constructor(config: Partial<ClusteringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze relationships between a set of addresses across chains
   */
  async analyzeRelationships(
    addresses: Array<{ chainId: ChainId; address: string }>,
    transactions: UnifiedTransaction[]
  ): Promise<WalletRelationship[]> {
    const relationships: WalletRelationship[] = [];

    // Build address analysis profiles
    const addressAnalyses = await this.buildAddressAnalyses(addresses, transactions);

    // Compare each pair of addresses
    for (let i = 0; i < addresses.length; i++) {
      for (let j = i + 1; j < addresses.length; j++) {
        const addr1 = addresses[i];
        const addr2 = addresses[j];
        
        const analysis1 = addressAnalyses.get(this.getAddressKey(addr1));
        const analysis2 = addressAnalyses.get(this.getAddressKey(addr2));

        if (!analysis1 || !analysis2) continue;

        const relationship = await this.analyzeAddressPair(addr1, addr2, analysis1, analysis2);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    return relationships.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create clusters from a set of addresses and their relationships
   */
  async createClusters(
    addresses: Array<{ chainId: ChainId; address: string }>,
    transactions: UnifiedTransaction[]
  ): Promise<AddressCluster[]> {
    // First analyze relationships
    const relationships = await this.analyzeRelationships(addresses, transactions);

    // Build address analysis profiles
    const addressAnalyses = await this.buildAddressAnalyses(addresses, transactions);

    // Create clusters using graph-based clustering
    const clusters = await this.performGraphClustering(addresses, relationships, addressAnalyses);

    return clusters;
  }

  /**
   * Find potential same-owner addresses across chains
   */
  async findSameOwnerAddresses(
    addresses: Array<{ chainId: ChainId; address: string }>,
    transactions: UnifiedTransaction[]
  ): Promise<Array<{
    addresses: Array<{ chainId: ChainId; address: string }>;
    confidence: number;
    evidence: Evidence[];
  }>> {
    const relationships = await this.analyzeRelationships(addresses, transactions);
    
    // Filter for high-confidence same-owner relationships
    const sameOwnerRelationships = relationships.filter(
      rel => rel.relationshipType === 'same_owner' && rel.confidence > 0.8
    );

    // Build connected components
    const components = this.buildConnectedComponents(addresses, sameOwnerRelationships);

    return components.map(component => ({
      addresses: component.addresses,
      confidence: component.avgConfidence,
      evidence: component.combinedEvidence
    }));
  }

  /**
   * Detect bridge-related address relationships
   */
  async detectBridgeNetworks(
    addresses: Array<{ chainId: ChainId; address: string }>,
    transactions: UnifiedTransaction[]
  ): Promise<Array<{
    sourceChain: ChainId;
    targetChain: ChainId;
    addresses: Array<{ source: string; target: string; confidence: number }>;
    totalVolume: number;
    transactionCount: number;
  }>> {
    const bridgeNetworks: any[] = [];

    // Group transactions by bridge patterns
    const bridgeTransactions = transactions.filter(tx => 
      tx.analytics?.category === 'bridge'
    );

    // Analyze bridge transaction patterns
    const chainPairs = new Map<string, any>();

    bridgeTransactions.forEach(tx => {
      // This would be expanded to analyze cross-chain bridge patterns
      const key = `${tx.chainId}`;
      if (!chainPairs.has(key)) {
        chainPairs.set(key, {
          transactions: [],
          addresses: new Set(),
          volume: 0
        });
      }
      
      const pair = chainPairs.get(key)!;
      pair.transactions.push(tx);
      pair.addresses.add(tx.from);
      if (tx.to) pair.addresses.add(tx.to);
      pair.volume += parseFloat(tx.value);
    });

    return bridgeNetworks;
  }

  /**
   * Identify potential bot networks
   */
  async detectBotNetworks(
    addresses: Array<{ chainId: ChainId; address: string }>,
    transactions: UnifiedTransaction[]
  ): Promise<Array<{
    botType: 'arbitrage' | 'mev' | 'trading' | 'spam' | 'unknown';
    addresses: Array<{ chainId: ChainId; address: string }>;
    confidence: number;
    patterns: string[];
    evidence: Evidence[];
  }>> {
    const botNetworks: any[] = [];
    
    const addressAnalyses = await this.buildAddressAnalyses(addresses, transactions);

    // Look for bot-like patterns
    const potentialBots: Array<{
      address: { chainId: ChainId; address: string };
      analysis: AddressAnalysis;
      botScore: number;
      patterns: string[];
    }> = [];

    for (const [key, analysis] of addressAnalyses) {
      const botScore = this.calculateBotScore(analysis);
      if (botScore > 0.6) {
        const address = this.parseAddressKey(key);
        potentialBots.push({
          address,
          analysis,
          botScore,
          patterns: this.identifyBotPatterns(analysis)
        });
      }
    }

    // Group potential bots by similarity
    const botClusters = await this.clusterBotAddresses(potentialBots);

    return botClusters.map(cluster => ({
      botType: this.determineBotType(cluster),
      addresses: cluster.addresses,
      confidence: cluster.confidence,
      patterns: cluster.patterns,
      evidence: cluster.evidence
    }));
  }

  // Private helper methods

  private async buildAddressAnalyses(
    addresses: Array<{ chainId: ChainId; address: string }>,
    transactions: UnifiedTransaction[]
  ): Promise<Map<string, AddressAnalysis>> {
    const analyses = new Map<string, AddressAnalysis>();

    for (const addr of addresses) {
      const key = this.getAddressKey(addr);
      
      if (this.addressCache.has(key)) {
        analyses.set(key, this.addressCache.get(key)!);
        continue;
      }

      const addressTxs = transactions.filter(tx => 
        tx.from === addr.address || tx.to === addr.address
      );

      const analysis = await this.analyzeAddress(addr, addressTxs);
      analyses.set(key, analysis);
      this.addressCache.set(key, analysis);
    }

    return analyses;
  }

  private async analyzeAddress(
    address: { chainId: ChainId; address: string },
    transactions: UnifiedTransaction[]
  ): Promise<AddressAnalysis> {
    const now = Date.now();
    const timeWindow = now - this.config.timeWindow;
    
    const recentTxs = transactions.filter(tx => tx.timestamp > timeWindow);

    // Calculate various patterns
    const timingPattern = this.analyzeTimingPattern(recentTxs);
    const valuePattern = this.analyzeValuePattern(recentTxs);
    const tokenPattern = this.analyzeTokenPattern(recentTxs);
    const defiPattern = this.analyzeDeFiPattern(recentTxs);
    const gasPattern = this.analyzeGasPattern(recentTxs, address.chainId);

    // Calculate behavior metrics
    const avgTimeBetweenTxs = this.calculateAvgTimeBetweenTxs(recentTxs);
    const transactionFrequency = recentTxs.length / (this.config.timeWindow / (24 * 60 * 60 * 1000)); // per day
    const uniqueCounterparties = new Set([
      ...recentTxs.map(tx => tx.to).filter(Boolean),
      ...recentTxs.filter(tx => tx.from !== address.address).map(tx => tx.from)
    ]).size;

    return {
      address,
      transactionCount: recentTxs.length,
      totalValue: recentTxs.reduce((sum, tx) => sum + parseFloat(tx.value), 0),
      timingPattern,
      valuePattern,
      tokenPattern,
      defiPattern,
      gasPattern,
      behaviorMetrics: {
        avgTimeBetweenTxs,
        transactionFrequency,
        uniqueCounterparties,
        avgTxValue: recentTxs.reduce((sum, tx) => sum + parseFloat(tx.value), 0) / recentTxs.length,
        failureRate: recentTxs.filter(tx => tx.status === 'failed').length / recentTxs.length
      },
      riskScore: this.calculateAddressRiskScore(recentTxs),
      labels: this.generateAddressLabels(recentTxs, address.chainId),
      lastAnalyzed: now
    };
  }

  private async analyzeAddressPair(
    addr1: { chainId: ChainId; address: string },
    addr2: { chainId: ChainId; address: string },
    analysis1: AddressAnalysis,
    analysis2: AddressAnalysis
  ): Promise<WalletRelationship | null> {
    const evidence: Evidence[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Timing pattern similarity
    const timingSimilarity = this.calculateTimingSimilarity(analysis1.timingPattern, analysis2.timingPattern);
    if (timingSimilarity > 0.5) {
      evidence.push({
        type: 'timing_pattern',
        description: `Similar transaction timing patterns (${(timingSimilarity * 100).toFixed(1)}% match)`,
        weight: this.config.timingPatternWeight,
        data: { similarity: timingSimilarity },
        timestamp: Date.now()
      });
      totalScore += timingSimilarity * this.config.timingPatternWeight;
    }
    maxScore += this.config.timingPatternWeight;

    // Value pattern similarity
    const valueSimilarity = this.calculateValueSimilarity(analysis1.valuePattern, analysis2.valuePattern);
    if (valueSimilarity > 0.5) {
      evidence.push({
        type: 'value_pattern',
        description: `Similar transaction value patterns (${(valueSimilarity * 100).toFixed(1)}% match)`,
        weight: this.config.valuePatternWeight,
        data: { similarity: valueSimilarity },
        timestamp: Date.now()
      });
      totalScore += valueSimilarity * this.config.valuePatternWeight;
    }
    maxScore += this.config.valuePatternWeight;

    // DeFi pattern similarity
    const defiSimilarity = this.calculateDeFiSimilarity(analysis1.defiPattern, analysis2.defiPattern);
    if (defiSimilarity > 0.5) {
      evidence.push({
        type: 'defi_pattern',
        description: `Similar DeFi interaction patterns (${(defiSimilarity * 100).toFixed(1)}% match)`,
        weight: this.config.behaviorPatternWeight,
        data: { similarity: defiSimilarity },
        timestamp: Date.now()
      });
      totalScore += defiSimilarity * this.config.behaviorPatternWeight;
    }
    maxScore += this.config.behaviorPatternWeight;

    // Address pattern similarity (for cross-chain analysis)
    const addressSimilarity = this.calculateAddressSimilarity(addr1, addr2);
    if (addressSimilarity > 0.3) {
      evidence.push({
        type: 'address_pattern',
        description: `Similar address patterns or formats`,
        weight: this.config.addressPatternWeight,
        data: { similarity: addressSimilarity },
        timestamp: Date.now()
      });
      totalScore += addressSimilarity * this.config.addressPatternWeight;
    }
    maxScore += this.config.addressPatternWeight;

    const confidence = maxScore > 0 ? totalScore / maxScore : 0;

    if (confidence < this.config.minSimilarityThreshold || evidence.length === 0) {
      return null;
    }

    // Determine relationship type
    let relationshipType: WalletRelationship['relationshipType'] = 'similar_pattern';
    
    if (confidence > 0.9 && timingSimilarity > 0.8 && valueSimilarity > 0.7) {
      relationshipType = 'same_owner';
    } else if (defiSimilarity > 0.8) {
      relationshipType = 'similar_pattern';
    }

    return {
      address1: addr1,
      address2: addr2,
      relationshipType,
      confidence,
      evidence,
      firstDetected: Date.now(),
      lastUpdated: Date.now(),
      strength: Math.min(confidence * 100, 100)
    };
  }

  private performGraphClustering(
    addresses: Array<{ chainId: ChainId; address: string }>,
    relationships: WalletRelationship[],
    addressAnalyses: Map<string, AddressAnalysis>
  ): AddressCluster[] {
    const clusters: AddressCluster[] = [];

    // Build adjacency list
    const graph = new Map<string, Set<string>>();
    const relationshipMap = new Map<string, WalletRelationship>();

    addresses.forEach(addr => {
      const key = this.getAddressKey(addr);
      graph.set(key, new Set());
    });

    relationships.forEach(rel => {
      const key1 = this.getAddressKey(rel.address1);
      const key2 = this.getAddressKey(rel.address2);
      
      graph.get(key1)?.add(key2);
      graph.get(key2)?.add(key1);
      
      relationshipMap.set(`${key1}-${key2}`, rel);
      relationshipMap.set(`${key2}-${key1}`, rel);
    });

    // Find connected components using DFS
    const visited = new Set<string>();
    
    for (const [startKey] of graph) {
      if (visited.has(startKey)) continue;

      const component: string[] = [];
      const stack = [startKey];

      while (stack.length > 0) {
        const currentKey = stack.pop()!;
        if (visited.has(currentKey)) continue;

        visited.add(currentKey);
        component.push(currentKey);

        for (const neighbor of graph.get(currentKey) || []) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }

      if (component.length > 1) {
        const cluster = this.buildClusterFromComponent(component, relationshipMap, addressAnalyses);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private buildConnectedComponents(
    addresses: Array<{ chainId: ChainId; address: string }>,
    relationships: WalletRelationship[]
  ) {
    // Implementation for connected components analysis
    return [];
  }

  private calculateBotScore(analysis: AddressAnalysis): number {
    let score = 0;

    // High transaction frequency
    if (analysis.behaviorMetrics.transactionFrequency > 100) score += 0.3;

    // Regular timing patterns
    if (analysis.timingPattern.regularity > 0.8) score += 0.4;

    // Low failure rate (bots are usually efficient)
    if (analysis.behaviorMetrics.failureRate < 0.05) score += 0.2;

    // Few unique counterparties relative to transaction count
    const counterpartyRatio = analysis.behaviorMetrics.uniqueCounterparties / analysis.transactionCount;
    if (counterpartyRatio < 0.1) score += 0.3;

    return Math.min(score, 1.0);
  }

  private identifyBotPatterns(analysis: AddressAnalysis): string[] {
    const patterns: string[] = [];

    if (analysis.timingPattern.regularity > 0.8) patterns.push('regular-timing');
    if (analysis.behaviorMetrics.transactionFrequency > 50) patterns.push('high-frequency');
    if (analysis.behaviorMetrics.failureRate < 0.02) patterns.push('high-success-rate');

    return patterns;
  }

  private async clusterBotAddresses(potentialBots: any[]): Promise<any[]> {
    // Implementation for clustering bot addresses
    return [];
  }

  private determineBotType(cluster: any): 'arbitrage' | 'mev' | 'trading' | 'spam' | 'unknown' {
    // Analyze cluster patterns to determine bot type
    return 'unknown';
  }

  // Pattern analysis helper methods
  private analyzeTimingPattern(transactions: UnifiedTransaction[]): TimingPattern {
    if (transactions.length < 2) {
      return { regularity: 0, intervals: [], peakHours: [], avgInterval: 0 };
    }

    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const intervals = [];
    
    for (let i = 1; i < sortedTxs.length; i++) {
      intervals.push(sortedTxs[i].timestamp - sortedTxs[i-1].timestamp);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const regularity = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval));

    // Analyze peak hours
    const hourCounts = new Array(24).fill(0);
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    const maxCount = Math.max(...hourCounts);
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > maxCount * 0.7)
      .map(({ hour }) => hour);

    return {
      regularity,
      intervals,
      peakHours,
      avgInterval
    };
  }

  private analyzeValuePattern(transactions: UnifiedTransaction[]): ValuePattern {
    const values = transactions.map(tx => parseFloat(tx.value)).filter(v => v > 0);
    
    if (values.length === 0) {
      return { distribution: [], commonValues: [], avgValue: 0, valueVariance: 0 };
    }

    const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
    const valueVariance = values.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / values.length;

    // Find common values (within 5% tolerance)
    const valueGroups = new Map<number, number>();
    values.forEach(value => {
      const rounded = Math.round(value * 20) / 20; // Round to nearest 0.05
      valueGroups.set(rounded, (valueGroups.get(rounded) || 0) + 1);
    });

    const commonValues = Array.from(valueGroups.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    return {
      distribution: values,
      commonValues,
      avgValue,
      valueVariance
    };
  }

  private analyzeTokenPattern(transactions: UnifiedTransaction[]): TokenPattern {
    const tokenCounts = new Map<string, number>();
    
    transactions.forEach(tx => {
      tx.tokenTransfers.forEach(transfer => {
        const key = `${transfer.symbol}-${transfer.tokenAddress}`;
        tokenCounts.set(key, (tokenCounts.get(key) || 0) + 1);
      });
    });

    const topTokens = Array.from(tokenCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      uniqueTokens: tokenCounts.size,
      topTokens: topTokens.map(([token, count]) => ({ token, count })),
      tokenDiversity: tokenCounts.size / Math.max(transactions.length, 1)
    };
  }

  private analyzeDeFiPattern(transactions: UnifiedTransaction[]): DeFiPattern {
    const protocolCounts = new Map<string, number>();
    const interactionTypes = new Map<string, number>();

    transactions.forEach(tx => {
      tx.defiInteractions.forEach(interaction => {
        protocolCounts.set(interaction.protocol, (protocolCounts.get(interaction.protocol) || 0) + 1);
        interactionTypes.set(interaction.type, (interactionTypes.get(interaction.type) || 0) + 1);
      });
    });

    return {
      protocols: Array.from(protocolCounts.entries()).map(([protocol, count]) => ({ protocol, count })),
      interactionTypes: Array.from(interactionTypes.entries()).map(([type, count]) => ({ type, count })),
      defiRatio: transactions.filter(tx => tx.defiInteractions.length > 0).length / Math.max(transactions.length, 1)
    };
  }

  private analyzeGasPattern(transactions: UnifiedTransaction[], chainId: ChainId): GasPattern {
    if (chainId === 'bitcoin' || chainId === 'solana') {
      return { avgGasPrice: 0, gasVariance: 0, maxGasPrice: 0, gasOptimization: 0 };
    }

    const gasPrices = transactions
      .map(tx => tx.gasPrice ? parseFloat(tx.gasPrice) : 0)
      .filter(price => price > 0);

    if (gasPrices.length === 0) {
      return { avgGasPrice: 0, gasVariance: 0, maxGasPrice: 0, gasOptimization: 0 };
    }

    const avgGasPrice = gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length;
    const gasVariance = gasPrices.reduce((sum, price) => sum + Math.pow(price - avgGasPrice, 2), 0) / gasPrices.length;
    const maxGasPrice = Math.max(...gasPrices);
    
    // Gas optimization score (lower variance indicates better optimization)
    const gasOptimization = Math.max(0, 1 - (Math.sqrt(gasVariance) / avgGasPrice));

    return {
      avgGasPrice,
      gasVariance,
      maxGasPrice,
      gasOptimization
    };
  }

  private calculateTimingSimilarity(pattern1: TimingPattern, pattern2: TimingPattern): number {
    // Compare regularity
    const regularityDiff = Math.abs(pattern1.regularity - pattern2.regularity);
    const regularityScore = 1 - regularityDiff;

    // Compare average intervals
    const intervalDiff = Math.abs(pattern1.avgInterval - pattern2.avgInterval);
    const maxInterval = Math.max(pattern1.avgInterval, pattern2.avgInterval);
    const intervalScore = maxInterval > 0 ? 1 - (intervalDiff / maxInterval) : 1;

    // Compare peak hours
    const commonPeakHours = pattern1.peakHours.filter(hour => pattern2.peakHours.includes(hour));
    const peakHourScore = commonPeakHours.length / Math.max(pattern1.peakHours.length, pattern2.peakHours.length, 1);

    return (regularityScore * 0.4 + intervalScore * 0.4 + peakHourScore * 0.2);
  }

  private calculateValueSimilarity(pattern1: ValuePattern, pattern2: ValuePattern): number {
    // Compare average values
    const avgDiff = Math.abs(pattern1.avgValue - pattern2.avgValue);
    const maxAvg = Math.max(pattern1.avgValue, pattern2.avgValue);
    const avgScore = maxAvg > 0 ? 1 - (avgDiff / maxAvg) : 1;

    // Compare variance (similar spending patterns)
    const varianceDiff = Math.abs(pattern1.valueVariance - pattern2.valueVariance);
    const maxVariance = Math.max(pattern1.valueVariance, pattern2.valueVariance);
    const varianceScore = maxVariance > 0 ? 1 - (varianceDiff / maxVariance) : 1;

    return (avgScore * 0.6 + varianceScore * 0.4);
  }

  private calculateDeFiSimilarity(pattern1: DeFiPattern, pattern2: DeFiPattern): number {
    // Compare protocol usage
    const protocols1 = new Set(pattern1.protocols.map(p => p.protocol));
    const protocols2 = new Set(pattern2.protocols.map(p => p.protocol));
    const commonProtocols = [...protocols1].filter(p => protocols2.has(p));
    const protocolScore = commonProtocols.length / Math.max(protocols1.size, protocols2.size, 1);

    // Compare interaction types
    const types1 = new Set(pattern1.interactionTypes.map(t => t.type));
    const types2 = new Set(pattern2.interactionTypes.map(t => t.type));
    const commonTypes = [...types1].filter(t => types2.has(t));
    const typeScore = commonTypes.length / Math.max(types1.size, types2.size, 1);

    // Compare DeFi ratio
    const ratioDiff = Math.abs(pattern1.defiRatio - pattern2.defiRatio);
    const ratioScore = 1 - ratioDiff;

    return (protocolScore * 0.4 + typeScore * 0.4 + ratioScore * 0.2);
  }

  private calculateAddressSimilarity(
    addr1: { chainId: ChainId; address: string },
    addr2: { chainId: ChainId; address: string }
  ): number {
    // Very basic address similarity - could be enhanced
    if (addr1.chainId === addr2.chainId) {
      return 0.1; // Same chain gives small bonus
    }
    
    // Cross-chain similarity is harder to detect
    return 0.0;
  }

  private calculateAvgTimeBetweenTxs(transactions: UnifiedTransaction[]): number {
    if (transactions.length < 2) return 0;
    
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const intervals = [];
    
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].timestamp - sorted[i-1].timestamp);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private calculateAddressRiskScore(transactions: UnifiedTransaction[]): number {
    let score = 0;
    
    // High failure rate
    const failureRate = transactions.filter(tx => tx.status === 'failed').length / transactions.length;
    score += failureRate * 30;
    
    // High risk transactions
    const highRiskTxs = transactions.filter(tx => (tx.riskScore || 0) > 50);
    score += (highRiskTxs.length / transactions.length) * 40;
    
    // Large transactions
    const largeValueTxs = transactions.filter(tx => parseFloat(tx.value) > 100000); // Adjust threshold
    score += (largeValueTxs.length / transactions.length) * 20;
    
    return Math.min(score, 100);
  }

  private generateAddressLabels(transactions: UnifiedTransaction[], chainId: ChainId): string[] {
    const labels: string[] = [];
    
    // High activity
    if (transactions.length > 1000) labels.push('high-activity');
    
    // DeFi user
    const defiTxs = transactions.filter(tx => tx.analytics?.category === 'defi');
    if (defiTxs.length / transactions.length > 0.5) labels.push('defi-user');
    
    // Bridge user
    const bridgeTxs = transactions.filter(tx => tx.analytics?.category === 'bridge');
    if (bridgeTxs.length > 5) labels.push('bridge-user');
    
    return labels;
  }

  private buildClusterFromComponent(
    component: string[],
    relationshipMap: Map<string, WalletRelationship>,
    addressAnalyses: Map<string, AddressAnalysis>
  ): AddressCluster {
    const addresses = component.map(key => this.parseAddressKey(key));
    
    // Aggregate evidence from relationships
    const allEvidence: Evidence[] = [];
    let totalConfidence = 0;
    let relationshipCount = 0;

    for (let i = 0; i < component.length; i++) {
      for (let j = i + 1; j < component.length; j++) {
        const key = `${component[i]}-${component[j]}`;
        const relationship = relationshipMap.get(key);
        if (relationship) {
          allEvidence.push(...relationship.evidence);
          totalConfidence += relationship.confidence;
          relationshipCount++;
        }
      }
    }

    const avgConfidence = relationshipCount > 0 ? totalConfidence / relationshipCount : 0;

    // Calculate metadata
    const analyses = component.map(key => addressAnalyses.get(key)).filter(Boolean) as AddressAnalysis[];
    const totalValue = analyses.reduce((sum, analysis) => sum + analysis.totalValue, 0);
    const totalTransactions = analyses.reduce((sum, analysis) => sum + analysis.transactionCount, 0);
    const activeChains = [...new Set(addresses.map(addr => addr.chainId))];
    const riskScore = analyses.reduce((sum, analysis) => sum + analysis.riskScore, 0) / analyses.length;

    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addresses,
      clusterType: this.determineClusterType(allEvidence, addresses),
      confidence: avgConfidence,
      evidence: allEvidence,
      metadata: {
        totalValue,
        totalTransactions,
        activeChains,
        firstActivity: Math.min(...analyses.map(a => a.lastAnalyzed)),
        lastActivity: Math.max(...analyses.map(a => a.lastAnalyzed)),
        riskScore
      },
      created: Date.now(),
      updated: Date.now()
    };
  }

  private determineClusterType(evidence: Evidence[], addresses: Array<{ chainId: ChainId; address: string }>): AddressCluster['clusterType'] {
    const evidenceTypes = evidence.map(e => e.type);
    
    if (evidenceTypes.includes('bridge_activity') && addresses.length > 1) {
      return 'bridge_network';
    }
    
    if (evidenceTypes.includes('timing_pattern') && evidenceTypes.includes('value_pattern')) {
      return 'same_owner';
    }
    
    return 'same_owner';
  }

  private getAddressKey(address: { chainId: ChainId; address: string }): string {
    return `${address.chainId}:${address.address}`;
  }

  private parseAddressKey(key: string): { chainId: ChainId; address: string } {
    const [chainId, address] = key.split(':');
    return { chainId: chainId as ChainId, address };
  }
}

// Supporting interfaces
interface AddressAnalysis {
  address: { chainId: ChainId; address: string };
  transactionCount: number;
  totalValue: number;
  timingPattern: TimingPattern;
  valuePattern: ValuePattern;
  tokenPattern: TokenPattern;
  defiPattern: DeFiPattern;
  gasPattern: GasPattern;
  behaviorMetrics: BehaviorMetrics;
  riskScore: number;
  labels: string[];
  lastAnalyzed: number;
}

interface TimingPattern {
  regularity: number; // 0-1, how regular the timing is
  intervals: number[]; // Time intervals between transactions
  peakHours: number[]; // Hours of day with most activity
  avgInterval: number; // Average time between transactions
}

interface ValuePattern {
  distribution: number[]; // All transaction values
  commonValues: Array<{ value: number; count: number }>; // Frequently used values
  avgValue: number;
  valueVariance: number;
}

interface TokenPattern {
  uniqueTokens: number;
  topTokens: Array<{ token: string; count: number }>;
  tokenDiversity: number; // Unique tokens per transaction
}

interface DeFiPattern {
  protocols: Array<{ protocol: string; count: number }>;
  interactionTypes: Array<{ type: string; count: number }>;
  defiRatio: number; // Percentage of transactions involving DeFi
}

interface GasPattern {
  avgGasPrice: number;
  gasVariance: number;
  maxGasPrice: number;
  gasOptimization: number; // How well gas is optimized (0-1)
}

interface BehaviorMetrics {
  avgTimeBetweenTxs: number;
  transactionFrequency: number; // Transactions per day
  uniqueCounterparties: number;
  avgTxValue: number;
  failureRate: number;
}