/**
 * Relationship Strength Scorer
 * 
 * This service provides sophisticated scoring algorithms for transaction relationships,
 * including relationship type classification, relevance ranking, and strength assessment.
 */

import type { DetailedTransactionInfo } from './solana';
import type { 
  RelatedTransaction, 
  TransactionRelationship, 
  RelationshipType
} from './related-transaction-finder';

export interface RelationshipScore {
  overallScore: number; // 0-1 scale
  componentScores: ComponentScores;
  strengthLevel: 'weak' | 'medium' | 'strong' | 'very_strong';
  confidence: number; // 0-1 scale
  factors: ScoringFactor[];
  recommendations: string[];
}

export interface ComponentScores {
  temporal: number; // Time-based relationship strength
  structural: number; // Account/programs overlap strength
  financial: number; // Token/value flow strength
  behavioral: number; // Pattern-based relationship strength
  contextual: number; // DeFi/protocol context strength
}

export interface ScoringFactor {
  type: 'boost' | 'penalty' | 'neutral';
  factor: string;
  impact: number; // -1 to +1
  description: string;
  weight: number; // 0-1 scale
}

export interface RelationshipClassification {
  primaryType: RelationshipType;
  secondaryTypes: RelationshipType[];
  typeConfidence: number;
  isComposite: boolean; // Multiple relationship types present
  dominantPattern: string;
}

export interface RelevanceRanking {
  rank: number;
  percentile: number; // 0-100
  category: 'highly_relevant' | 'moderately_relevant' | 'weakly_relevant' | 'not_relevant';
  comparisonMetrics: ComparisonMetrics;
}

export interface ComparisonMetrics {
  betterThan: number; // percentage of other relationships
  similarTo: number; // count of similar strength relationships
  uniqueFactors: string[]; // factors that make this relationship unique
}

export interface ScoringWeights {
  temporal: number;
  structural: number;
  financial: number;
  behavioral: number;
  contextual: number;
}

export interface ScoringContext {
  sourceTransaction: DetailedTransactionInfo;
  candidateTransaction: DetailedTransactionInfo;
  allRelatedTransactions?: RelatedTransaction[];
  userPreferences?: UserScoringPreferences;
  marketContext?: MarketScoringContext;
}

export interface UserScoringPreferences {
  prioritizeRecent: boolean; // Weight recent transactions higher
  focusOnValue: boolean; // Weight high-value transactions higher
  emphasizeDeFi: boolean; // Weight DeFi relationships higher
  includeWeakRelationships: boolean; // Include low-confidence relationships
}

export interface MarketScoringContext {
  volatilityLevel: 'low' | 'medium' | 'high';
  liquidityCondition: 'high' | 'medium' | 'low';
  networkCongestion: 'low' | 'medium' | 'high';
  timeOfDay: 'peak' | 'normal' | 'off_peak';
}

class RelationshipStrengthScorer {
  // Extract all unique accounts from a transaction
  private extractAccounts(transaction: DetailedTransactionInfo): string[] {
    // Prefer details.accounts if available
    if (transaction.details && Array.isArray(transaction.details.accounts)) {
      return transaction.details.accounts.map((a: any) => {
        if (typeof a === 'string') return a;
        if (a.address) return a.address;
        if (a.pubkey) return a.pubkey;
        if (a.account) return a.account;
        return '';
      }).filter(Boolean);
    }
    // Fallback: try to extract from instructions
    if (transaction.details && Array.isArray(transaction.details.instructions)) {
      const accounts = transaction.details.instructions.flatMap((ix: any) => {
        if (Array.isArray(ix.accounts)) {
          return ix.accounts.map((acc: any) => {
            if (typeof acc === 'string') return acc;
            if (acc.address) return acc.address;
            if (acc.pubkey) return acc.pubkey;
            if (acc.account) return acc.account;
            return '';
          });
        }
        return [];
      });
      return Array.from(new Set(accounts.filter(Boolean)));
    }
    return [];
  }

  // Extract all unique programs from a transaction
  private extractPrograms(transaction: DetailedTransactionInfo): string[] {
    if (transaction.details && Array.isArray(transaction.details.instructions)) {
      // Collect all programId and program fields
      const programs = transaction.details.instructions.map((ix: any) => {
        if (ix.programId) return ix.programId;
        if (ix.program) return ix.program;
        return '';
      }).filter(Boolean);
      return Array.from(new Set(programs));
    }
    return [];
  }

  // Identify secondary relationship types based on shared elements and type
  private identifySecondaryTypes(relationship: TransactionRelationship, _context: ScoringContext): RelationshipType[] {
    // Only use _context if needed in future
    void _context;
    const secondary: RelationshipType[] = [];
    // Example logic: if multiple shared elements, infer additional types
    if (relationship.sharedElements) {
      if (relationship.sharedElements.tokens?.length && relationship.type !== 'token_flow') {
        secondary.push('token_flow' as RelationshipType);
      }
      if (relationship.sharedElements.programs?.length && relationship.type !== 'defi_protocol') {
        secondary.push('defi_protocol' as RelationshipType);
      }
      // Only add 'structural' if it's a valid RelationshipType for this project
      if (relationship.sharedElements.accounts?.length && String(relationship.type) !== 'structural') {
        secondary.push('structural' as RelationshipType);
      }
      if (relationship.sharedElements.timeWindow !== undefined && relationship.type !== 'temporal_cluster') {
        secondary.push('temporal_cluster' as RelationshipType);
      }
    }
    // Remove duplicates and the primary type
    return Array.from(new Set(secondary.filter(t => t !== relationship.type)));
  }

  // Calculate instruction similarity between two transactions (Jaccard index of programIds)
  private calculateInstructionSimilarity(txA: DetailedTransactionInfo, txB: DetailedTransactionInfo): number {
    const progsA = new Set(this.extractPrograms(txA));
    const progsB = new Set(this.extractPrograms(txB));
    if (progsA.size === 0 && progsB.size === 0) return 1;
    const intersection = Array.from(progsA).filter(p => progsB.has(p));
    const union = new Set([...progsA, ...progsB]);
    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  // Get market context adjustment (example: adjust based on volatility and liquidity)
  private getMarketContextAdjustment(relationship: TransactionRelationship, marketContext: MarketScoringContext): number {
    let adjustment = 0;
    if (!marketContext) return 0;
    // Example: boost for high volatility and high liquidity
    if (marketContext.volatilityLevel === 'high') adjustment += 0.05;
    if (marketContext.liquidityCondition === 'high') adjustment += 0.05;
    if (marketContext.networkCongestion === 'high') adjustment -= 0.05;
    if (marketContext.timeOfDay === 'peak') adjustment += 0.02;
    // Type-specific: boost for DeFi in high liquidity
    if (relationship.type === 'defi_protocol' && marketContext.liquidityCondition === 'high') adjustment += 0.05;
    return adjustment;
  }
  // Calculate the total value of a transaction (sum of all token changes)
  private calculateTransactionValue(transaction: DetailedTransactionInfo): number {
    // If details or tokenChanges are missing, return 0
    if (!transaction.details || !Array.isArray(transaction.details.tokenChanges)) return 0;
    // If tokenChanges have usdValue, sum those; otherwise, sum the absolute value of change
    return transaction.details.tokenChanges.reduce((sum: number, t: any) => {
      if (typeof t.usdValue === 'number') {
        return sum + Math.abs(t.usdValue);
      } else if (typeof t.uiAmount === 'number') {
        // If uiAmount is present, use it as a proxy for value
        return sum + Math.abs(t.uiAmount);
      } else if (typeof t.change === 'number') {
        return sum + Math.abs(t.change);
      }
      return sum;
    }, 0);
  }

  // Count the number of distinct evidence types present in a relationship
  private countEvidenceTypes(relationship: TransactionRelationship): number {
    let count = 0;
    if (relationship.sharedElements) {
      if (Array.isArray(relationship.sharedElements.accounts) && relationship.sharedElements.accounts.length > 0) count++;
      if (Array.isArray(relationship.sharedElements.programs) && relationship.sharedElements.programs.length > 0) count++;
      if (Array.isArray(relationship.sharedElements.tokens) && relationship.sharedElements.tokens.length > 0) count++;
      if (typeof relationship.sharedElements.timeWindow === 'number') count++;
    }
    if (relationship.type) count++;
    return count;
  }
  private defaultWeights: ScoringWeights = {
    temporal: 0.2,
    structural: 0.3,
    financial: 0.25,
    behavioral: 0.15,
    contextual: 0.1
  };

  /**
   * Calculate comprehensive relationship strength score
   */
  public calculateRelationshipScore(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): RelationshipScore {
    // Calculate component scores
    const componentScores = this.calculateComponentScores(relationship, context);
    
    // Apply weights to get overall score
    const weights = this.getAdjustedWeights(context);
    const overallScore = this.calculateWeightedScore(componentScores, weights);
    
    // Determine strength level
    const strengthLevel = this.determineStrengthLevel(overallScore);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(relationship, componentScores, context);
    
    // Identify scoring factors
    const factors = this.identifyScoringFactors(relationship, componentScores, context);
    
    // Generate recommendations
    const recommendations = this.generateScoringRecommendations(
      relationship, 
      componentScores, 
      strengthLevel,
      context
    );

    return {
      overallScore,
      componentScores,
      strengthLevel,
      confidence,
      factors,
      recommendations
    };
  }

  /**
   * Classify relationship type with confidence scoring
   */
  public classifyRelationship(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): RelationshipClassification {
    const primaryType = relationship.type;
    const secondaryTypes = this.identifySecondaryTypes(relationship, context);
    const typeConfidence = this.calculateTypeConfidence(relationship, context);
    const isComposite = secondaryTypes.length > 0;
    const dominantPattern = this.identifyDominantPattern(relationship, context);

    return {
      primaryType,
      secondaryTypes,
      typeConfidence,
      isComposite,
      dominantPattern
    };
  }

  /**
   * Rank relationship relevance compared to others
   */
  public rankRelevance(
    targetRelationship: RelatedTransaction,
    allRelationships: RelatedTransaction[]
  ): RelevanceRanking {
    // Sort all relationships by relevance score
    const sorted = [...allRelationships].sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Find target relationship rank
    const rank = sorted.findIndex(r => r.signature === targetRelationship.signature) + 1;
    const percentile = ((sorted.length - rank + 1) / sorted.length) * 100;
    
    // Determine category
    const category = this.determineRelevanceCategory(percentile);
    
    // Calculate comparison metrics
    const comparisonMetrics = this.calculateComparisonMetrics(
      targetRelationship,
      allRelationships
    );

    return {
      rank,
      percentile,
      category,
      comparisonMetrics
    };
  }

  /**
   * Calculate component scores for different aspects of the relationship
   */
  private calculateComponentScores(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): ComponentScores {
    return {
      temporal: this.calculateTemporalScore(relationship, context),
      structural: this.calculateStructuralScore(relationship, context),
      financial: this.calculateFinancialScore(relationship, context),
      behavioral: this.calculateBehavioralScore(relationship, context),
      contextual: this.calculateContextualScore(relationship, context)
    };
  }

  /**
   * Calculate temporal relationship strength
   */
  private calculateTemporalScore(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): number {
    const timeWindow = relationship.sharedElements.timeWindow;
    let score = 0;

    // Base score based on time proximity
    if (timeWindow <= 60) { // 1 minute
      score = 1.0;
    } else if (timeWindow <= 300) { // 5 minutes
      score = 0.8;
    } else if (timeWindow <= 1800) { // 30 minutes
      score = 0.6;
    } else if (timeWindow <= 3600) { // 1 hour
      score = 0.4;
    } else if (timeWindow <= 86400) { // 24 hours
      score = 0.2;
    } else {
      score = 0.1;
    }

    // Apply modifiers
    const modifiers = this.getTemporalModifiers(relationship, context);
    return Math.max(0, Math.min(1, score + modifiers));
  }

  /**
   * Calculate structural relationship strength (accounts/programs)
   */
  private calculateStructuralScore(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): number {
    const sharedAccounts = relationship.sharedElements.accounts.length;
    const sharedPrograms = relationship.sharedElements.programs.length;
    
    const sourceAccounts = this.extractAccounts(context.sourceTransaction).length;
    const candidateAccounts = this.extractAccounts(context.candidateTransaction).length;
    const sourcePrograms = this.extractPrograms(context.sourceTransaction).length;
    const candidatePrograms = this.extractPrograms(context.candidateTransaction).length;

    // Account overlap score
    const accountOverlapRatio = sharedAccounts / Math.max(sourceAccounts, candidateAccounts);
    const accountScore = Math.min(1, accountOverlapRatio * 1.5); // Boost account overlap

    // Program overlap score
    const programOverlapRatio = sharedPrograms / Math.max(sourcePrograms, candidatePrograms);
    const programScore = Math.min(1, programOverlapRatio * 1.2);

    // Combined structural score (weighted average)
    const structuralScore = (accountScore * 0.6) + (programScore * 0.4);

    // Apply structural modifiers
    const modifiers = this.getStructuralModifiers(relationship, context);
    return Math.max(0, Math.min(1, structuralScore + modifiers));
  }

  /**
   * Calculate financial relationship strength (token flows/values)
   */
  private calculateFinancialScore(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): number {
    let score = 0;

    // Token flow connections
    if (relationship.type === 'token_flow') {
      score = 0.8; // High base score for direct token flows
    }

    // Shared tokens
    const sharedTokens = relationship.sharedElements.tokens.length;
    if (sharedTokens > 0) {
      score += Math.min(0.4, sharedTokens * 0.1);
    }

    // Value-based scoring
    const sourceValue = this.calculateTransactionValue(context.sourceTransaction);
    const candidateValue = this.calculateTransactionValue(context.candidateTransaction);
    
    if (sourceValue > 0 && candidateValue > 0) {
      const valueRatio = Math.min(sourceValue, candidateValue) / Math.max(sourceValue, candidateValue);
      score += valueRatio * 0.3; // Boost for similar transaction values
    }

    // Apply financial modifiers
    const modifiers = this.getFinancialModifiers(relationship, context);
    return Math.max(0, Math.min(1, score + modifiers));
  }

  /**
   * Calculate behavioral relationship strength (patterns)
   */
  private calculateBehavioralScore(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): number {
    let score = 0;

    // Pattern-based scoring
    switch (relationship.type) {
      case 'multi_step':
        score = 0.7; // High score for multi-step patterns
        break;
      case 'arbitrage_pattern':
        score = 0.8; // Very high score for arbitrage
        break;
      case 'batch_operation':
        score = 0.6; // Good score for batch operations
        break;
      case 'wallet_activity':
        score = 0.5; // Medium score for wallet patterns
        break;
      default:
        score = 0.3; // Base score for other patterns
    }

    // Instruction similarity
    const instructionSimilarity = this.calculateInstructionSimilarity(
      context.sourceTransaction,
      context.candidateTransaction
    );
    score += instructionSimilarity * 0.3;

    // Apply behavioral modifiers
    const modifiers = this.getBehavioralModifiers(relationship, context);
    return Math.max(0, Math.min(1, score + modifiers));
  }

  /**
   * Calculate contextual relationship strength (DeFi/protocol context)
   */
  private calculateContextualScore(
    relationship: TransactionRelationship,
    context: ScoringContext
  ): number {
    let score = 0;

    // DeFi protocol relationships
    if (relationship.type === 'defi_protocol') {
      score = 0.7; // High base score for DeFi relationships
      
      // Boost for multiple shared DeFi protocols
      const sharedPrograms = relationship.sharedElements.programs.length;
      score += Math.min(0.2, (sharedPrograms - 1) * 0.1);
    }

    // Contract interaction patterns
    if (relationship.type === 'contract_interaction') {
      score = 0.6;
    }

    // Market context adjustments
    if (context.marketContext) {
      score += this.getMarketContextAdjustment(relationship, context.marketContext);
    }

    // Apply contextual modifiers
    const modifiers = this.getContextualModifiers(relationship, context);
    return Math.max(0, Math.min(1, score + modifiers));
  }

  /**
   * Get adjusted weights based on context and user preferences
   */
  private getAdjustedWeights(context: ScoringContext): ScoringWeights {
    let weights = { ...this.defaultWeights };

    // Adjust based on user preferences
    if (context.userPreferences) {
      if (context.userPreferences.prioritizeRecent) {
        weights.temporal += 0.1;
        weights.structural -= 0.05;
        weights.behavioral -= 0.05;
      }

      if (context.userPreferences.focusOnValue) {
        weights.financial += 0.15;
        weights.temporal -= 0.05;
        weights.contextual -= 0.05;
        weights.behavioral -= 0.05;
      }

      if (context.userPreferences.emphasizeDeFi) {
        weights.contextual += 0.15;
        weights.structural -= 0.05;
        weights.temporal -= 0.05;
        weights.behavioral -= 0.05;
      }
    }

    // Normalize weights to sum to 1
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(weights).forEach(key => {
      weights[key as keyof ScoringWeights] /= total;
    });

    return weights;
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(
    componentScores: ComponentScores,
    weights: ScoringWeights
  ): number {
    return (
      componentScores.temporal * weights.temporal +
      componentScores.structural * weights.structural +
      componentScores.financial * weights.financial +
      componentScores.behavioral * weights.behavioral +
      componentScores.contextual * weights.contextual
    );
  }

  /**
   * Determine strength level from overall score
   */
  private determineStrengthLevel(score: number): 'weak' | 'medium' | 'strong' | 'very_strong' {
    if (score >= 0.8) return 'very_strong';
    if (score >= 0.6) return 'strong';
    if (score >= 0.4) return 'medium';
    return 'weak';
  }

  /**
   * Calculate confidence in the relationship score
   */
  private calculateConfidence(
    relationship: TransactionRelationship,
    componentScores: ComponentScores,
    context: ScoringContext
  ): number {
    void context; // Not used in current implementation
    let confidence = relationship.confidence || 0.5;

    // Boost confidence for consistent component scores
    const scores = Object.values(componentScores);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const consistency = 1 - Math.min(1, variance * 2); // Lower variance = higher consistency
    
    confidence += consistency * 0.2;

    // Boost confidence for multiple evidence types
    const evidenceTypes = this.countEvidenceTypes(relationship);
    confidence += Math.min(0.2, evidenceTypes * 0.05);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Identify factors that influenced the scoring
   */
  private identifyScoringFactors(
    relationship: TransactionRelationship,
    componentScores: ComponentScores,
    context: ScoringContext
  ): ScoringFactor[] {
    void context; // Not used in current implementation
    const factors: ScoringFactor[] = [];

    // Temporal factors
    if (componentScores.temporal > 0.7) {
      factors.push({
        type: 'boost',
        factor: 'temporal_proximity',
        impact: 0.3,
        description: 'Transactions occurred very close in time',
        weight: 0.8
      });
    } else if (componentScores.temporal < 0.3) {
      factors.push({
        type: 'penalty',
        factor: 'temporal_distance',
        impact: -0.2,
        description: 'Transactions are far apart in time',
        weight: 0.6
      });
    }

    // Structural factors
    if (componentScores.structural > 0.6) {
      factors.push({
        type: 'boost',
        factor: 'high_overlap',
        impact: 0.25,
        description: 'High overlap in accounts or programs',
        weight: 0.7
      });
    }

    // Financial factors
    if (componentScores.financial > 0.7) {
      factors.push({
        type: 'boost',
        factor: 'token_flow',
        impact: 0.3,
        description: 'Direct token flow connection detected',
        weight: 0.9
      });
    }

    // Behavioral factors
    if (relationship.type === 'arbitrage_pattern') {
      factors.push({
        type: 'boost',
        factor: 'arbitrage_pattern',
        impact: 0.4,
        description: 'Part of potential arbitrage sequence',
        weight: 0.8
      });
    }

    // Contextual factors
    if (relationship.type === 'defi_protocol') {
      factors.push({
        type: 'boost',
        factor: 'defi_context',
        impact: 0.2,
        description: 'Related through DeFi protocol usage',
        weight: 0.6
      });
    }

    return factors;
  }

  /**
   * Generate scoring-based recommendations
   */
  private generateScoringRecommendations(
    relationship: TransactionRelationship,
    componentScores: ComponentScores,
    strengthLevel: 'weak' | 'medium' | 'strong' | 'very_strong',
    context: ScoringContext
  ): string[] {
    void context; // Not used in current implementation
    const recommendations: string[] = [];

    // Strength-based recommendations
    switch (strengthLevel) {
      case 'very_strong':
        recommendations.push('This relationship is highly significant and should be investigated further');
        break;
      case 'strong':
        recommendations.push('Strong relationship detected - likely part of related activity');
        break;
      case 'medium':
        recommendations.push('Moderate relationship - may be worth investigating');
        break;
      case 'weak':
        recommendations.push('Weak relationship - consider filtering out if focusing on strong connections');
        break;
    }

    // Component-specific recommendations
    if (componentScores.temporal > 0.8) {
      recommendations.push('Very close timing suggests coordinated or automated activity');
    }

    if (componentScores.financial > 0.7) {
      recommendations.push('Strong financial connection - monitor for value flow patterns');
    }

    if (componentScores.behavioral > 0.6) {
      recommendations.push('Behavioral pattern detected - may be part of larger strategy');
    }

    // Type-specific recommendations
    if (relationship.type === 'defi_protocol') {
      recommendations.push('DeFi relationship - consider protocol-specific risks and opportunities');
    }

    if (relationship.type === 'arbitrage_pattern') {
      recommendations.push('Potential arbitrage detected - analyze for profit opportunities');
    }

    return recommendations;
  }

  /**
   * Helper methods for scoring calculations
   */
  private getTemporalModifiers(
    relationship: TransactionRelationship,
    _context: ScoringContext
  ): number {
    let modifier = 0;

    // Same block bonus
    if (Math.abs(_context.sourceTransaction.slot - _context.candidateTransaction.slot) <= 1) {
      modifier += 0.2;
    }

    // User preference for recent transactions
    if (_context.userPreferences?.prioritizeRecent) {
      const timeWindow = relationship.sharedElements.timeWindow;
      if (timeWindow <= 300) { // 5 minutes
        modifier += 0.1;
      }
    }

    return modifier;
  }

  private getStructuralModifiers(
    relationship: TransactionRelationship,
    _context: ScoringContext
  ): number {
    let modifier = 0;

    // Exact program match bonus
    const sourcePrograms = this.extractPrograms(_context.sourceTransaction);
    const candidatePrograms = this.extractPrograms(_context.candidateTransaction);
    
    if (sourcePrograms.length === candidatePrograms.length && 
        sourcePrograms.every((p: string) => candidatePrograms.includes(p))) {
      modifier += 0.15;
    }

    // Add missing dependencies warning fix: use relationship and context if needed in future
    void relationship;
    void _context;

    return modifier;
  }

  private getFinancialModifiers(
    _relationship: TransactionRelationship,
    _context: ScoringContext
  ): number {
    let modifier = 0;

    // High-value transaction bonus
    const sourceValue = this.calculateTransactionValue(_context.sourceTransaction);
    const candidateValue = this.calculateTransactionValue(_context.candidateTransaction);
    
    if (sourceValue > 10000 || candidateValue > 10000) { // $10k+
      modifier += 0.1;
    }

    // User preference for value focus
    if (_context.userPreferences?.focusOnValue && (sourceValue > 1000 || candidateValue > 1000)) {
      modifier += 0.15;
    }

    // Add missing dependencies warning fix: use _relationship if needed in future
    void _relationship;

    return modifier;
  }

  private getBehavioralModifiers(
    _relationship: TransactionRelationship,
    _context: ScoringContext
  ): number {
    let modifier = 0;

    // Complex transaction bonus (many instructions)
    const sourceInstructions = _context.sourceTransaction.details?.instructions?.length || 0;
    const candidateInstructions = _context.candidateTransaction.details?.instructions?.length || 0;
    
    if (sourceInstructions > 3 || candidateInstructions > 3) {
      modifier += 0.1;
    }

    // Add missing dependencies warning fix: use _relationship if needed in future
    void _relationship;

    return modifier;
  }

  private getContextualModifiers(
    _relationship: TransactionRelationship,
    _context: ScoringContext
  ): number {
    let modifier = 0;

    // DeFi emphasis bonus
    if (_context.userPreferences?.emphasizeDeFi && _relationship.type === 'defi_protocol') {
      modifier += 0.2;
    }

    // Add missing dependencies warning fix: use _relationship and _context if needed in future
    void _relationship;
    void _context;

    return modifier;
  }

  private calculateTypeConfidence(
    _relationship: TransactionRelationship,
    _context: ScoringContext
  ): number {
    // Base confidence from relationship
    let confidence = _relationship.confidence || 0.5;
    
    // Boost confidence based on evidence strength
    const evidenceTypes = this.countEvidenceTypes(_relationship);
    confidence += evidenceTypes * 0.1;
    
    // Type-specific confidence adjustments
    switch (_relationship.type) {
      case 'token_flow':
        if (_relationship.sharedElements.tokens.length > 0) confidence += 0.2;
        break;
      case 'defi_protocol':
        if (_relationship.sharedElements.programs.length > 1) confidence += 0.15;
        break;
      case 'temporal_cluster':
        if (_relationship.sharedElements.timeWindow < 60) confidence += 0.2;
        break;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  private identifyDominantPattern(
    _relationship: TransactionRelationship,
    _context: ScoringContext
  ): string {
    const componentScores = this.calculateComponentScores(_relationship, _context);
    
    // Find the highest scoring component
    const maxScore = Math.max(...Object.values(componentScores));
    const dominantComponent = Object.entries(componentScores)
      .find(([_, score]) => score === maxScore)?.[0];
    
    // Map component to pattern description
    const patternMap: Record<string, string> = {
      temporal: 'Time-based coordination',
      structural: 'Account/program overlap',
      financial: 'Token flow connection',
      behavioral: 'Activity pattern',
      contextual: 'Protocol relationship'
    };
    
    return patternMap[dominantComponent || 'structural'] || 'Mixed pattern';
  }

  private determineRelevanceCategory(percentile: number): 'highly_relevant' | 'moderately_relevant' | 'weakly_relevant' | 'not_relevant' {
    if (percentile >= 80) return 'highly_relevant';
    if (percentile >= 60) return 'moderately_relevant';
    if (percentile >= 40) return 'weakly_relevant';
    return 'not_relevant';
  }

  private calculateComparisonMetrics(
    targetRelationship: RelatedTransaction,
    allRelationships: RelatedTransaction[]
  ): ComparisonMetrics {
    const targetScore = targetRelationship.relevanceScore;
    
    // Calculate how many relationships this one is better than
    const betterThan = allRelationships.filter(r => r.relevanceScore < targetScore).length;
    const betterThanPercentage = (betterThan / allRelationships.length) * 100;
    
    // Find relationships with similar scores (within 0.1)
    const similarTo = allRelationships.filter(r => 
      Math.abs(r.relevanceScore - targetScore) <= 0.1 && r.signature !== targetRelationship.signature
    ).length;
    
    // Identify unique factors
    const uniqueFactors = this.identifyUniqueFactors(targetRelationship, allRelationships);
    
    return {
      betterThan: betterThanPercentage,
      similarTo,
      uniqueFactors
    };
  }

  private identifyUniqueFactors(
    targetRelationship: RelatedTransaction,
    allRelationships: RelatedTransaction[]
  ): string[] {
    const uniqueFactors: string[] = [];
    
    // Check for unique relationship type
    const sameTypeCount = allRelationships.filter(r => 
      r.relationship.type === targetRelationship.relationship.type
    ).length;
    
    if (sameTypeCount <= 2) {
      uniqueFactors.push(`Rare relationship type: ${targetRelationship.relationship.type}`);
    }
    
    // Check for unique strength level
    const sameStrengthCount = allRelationships.filter(r => 
      r.relationship.strength === targetRelationship.relationship.strength
    ).length;
    
    if (sameStrengthCount <= 3 && targetRelationship.relationship.strength === 'strong') {
      uniqueFactors.push('Strong relationship strength');
    }
    
    // Check for high token transfer values
    const hasHighValue = targetRelationship.tokenTransfers?.some(t => (t.usdValue || 0) > 5000);
    if (hasHighValue) {
      uniqueFactors.push('High-value token transfers');
    }
    
    return uniqueFactors;
  }

  /**
   * Public utility methods
   */
  public getDefaultWeights(): ScoringWeights {
    return { ...this.defaultWeights };
  }

  public setDefaultWeights(weights: Partial<ScoringWeights>): void {
    this.defaultWeights = { ...this.defaultWeights, ...weights };
  }

  public createScoringContext(
    sourceTransaction: DetailedTransactionInfo,
    candidateTransaction: DetailedTransactionInfo,
    options?: {
      allRelatedTransactions?: RelatedTransaction[];
      userPreferences?: UserScoringPreferences;
      marketContext?: MarketScoringContext;
    }
  ): ScoringContext {
    return {
      sourceTransaction,
      candidateTransaction,
      allRelatedTransactions: options?.allRelatedTransactions,
      userPreferences: options?.userPreferences,
      marketContext: options?.marketContext
    };
  }
}

// Export singleton instance
export const relationshipStrengthScorer = new RelationshipStrengthScorer();

// Export main scoring function
export function scoreRelationshipStrength(
  relationship: TransactionRelationship,
  context: ScoringContext
): RelationshipScore {
  return relationshipStrengthScorer.calculateRelationshipScore(relationship, context);
}

// Export utility functions
export function formatStrengthLevel(level: 'weak' | 'medium' | 'strong' | 'very_strong'): string {
  const formatted = level.replace('_', ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getStrengthLevelColor(level: 'weak' | 'medium' | 'strong' | 'very_strong'): string {
  const colors = {
    weak: 'text-gray-500 dark:text-gray-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    strong: 'text-green-600 dark:text-green-400',
    very_strong: 'text-emerald-600 dark:text-emerald-400'
  };
  
  return colors[level];
}

export function formatComponentScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

export function getRelevanceCategoryColor(category: 'highly_relevant' | 'moderately_relevant' | 'weakly_relevant' | 'not_relevant'): string {
  const colors = {
    highly_relevant: 'text-green-600 dark:text-green-400',
    moderately_relevant: 'text-blue-600 dark:text-blue-400',
    weakly_relevant: 'text-yellow-600 dark:text-yellow-400',
    not_relevant: 'text-gray-500 dark:text-gray-400'
  };
  
  return colors[category];
}