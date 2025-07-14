/**
 * Configurable Anomaly Detection Patterns
 * Allows loading patterns from JSON configuration for dynamic deployment
 */

import { AnomalyPattern, AnomalyContext } from './anomaly-patterns';

interface AnomalyPatternConfig {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'financial' | 'security' | 'performance' | 'behavior' | 'token_manipulation';
  enabled: boolean;
  threshold: number;
  conditions: {
    type: 'fee_spike' | 'failure_rate' | 'transaction_burst' | 'unusual_program' | 'large_transfer' | 'rapid_trades' | 'account_drain' | 'flash_loan_attack' | 'sandwich_attack' | 'wash_trading' | 'price_manipulation' | 'token_spam' | 'phishing_signature' | 'liquidity_drain' | 'arbitrage_bot' | 'governance_attack';
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'regex';
    value: any;
    field?: string;
  }[];
  metadata?: {
    tags?: string[];
    mlWeight?: number;
    confidence?: number;
    timeWindowMs?: number;
  };
}

interface AnomalyPatternConfiguration {
  version: string;
  lastUpdated: string;
  patterns: AnomalyPatternConfig[];
}

/**
 * Default anomaly pattern configurations
 * Can be overridden by remote configuration
 */
const DEFAULT_PATTERNS: AnomalyPatternConfiguration = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  patterns: [
    {
      id: 'high_fee_spike',
      name: 'High Fee Spike',
      description: 'Transaction fees significantly higher than average',
      severity: 'high',
      category: 'financial',
      enabled: true,
      threshold: 5.0,
      conditions: [
        {
          type: 'fee_spike',
          operator: 'gte',
          value: 5.0,
          field: 'fee'
        }
      ],
      metadata: {
        tags: ['fees', 'economics'],
        mlWeight: 1.2,
        confidence: 0.8,
        timeWindowMs: 300000 // 5 minutes
      }
    },
    {
      id: 'transaction_failure_burst',
      name: 'Transaction Failure Burst',
      description: 'High rate of transaction failures detected',
      severity: 'critical',
      category: 'security',
      enabled: true,
      threshold: 0.3,
      conditions: [
        {
          type: 'failure_rate',
          operator: 'gt',
          value: 0.3
        }
      ],
      metadata: {
        tags: ['failures', 'security'],
        mlWeight: 1.5,
        confidence: 0.9,
        timeWindowMs: 60000 // 1 minute
      }
    },
    {
      id: 'rapid_transaction_burst',
      name: 'Rapid Transaction Burst',
      description: 'Unusually high number of transactions from single address',
      severity: 'medium',
      category: 'behavior',
      enabled: true,
      threshold: 50,
      conditions: [
        {
          type: 'transaction_burst',
          operator: 'gte',
          value: 50,
          field: 'transactionCount'
        }
      ],
      metadata: {
        tags: ['volume', 'behavior'],
        mlWeight: 1.0,
        confidence: 0.7,
        timeWindowMs: 180000 // 3 minutes
      }
    },
    {
      id: 'large_token_transfer',
      name: 'Large Token Transfer',
      description: 'Unusually large token transfer detected',
      severity: 'high',
      category: 'financial',
      enabled: true,
      threshold: 1000000,
      conditions: [
        {
          type: 'large_transfer',
          operator: 'gte',
          value: 1000000,
          field: 'amount'
        }
      ],
      metadata: {
        tags: ['transfers', 'finance'],
        mlWeight: 1.1,
        confidence: 0.85,
        timeWindowMs: 3600000 // 1 hour
      }
    },
    {
      id: 'account_drain_detection',
      name: 'Account Drain Detection',
      description: 'Rapid depletion of account balance detected',
      severity: 'critical',
      category: 'security',
      enabled: true,
      threshold: 0.8,
      conditions: [
        {
          type: 'account_drain',
          operator: 'gte',
          value: 0.8,
          field: 'balanceChangePercent'
        }
      ],
      metadata: {
        tags: ['drain', 'security', 'theft'],
        mlWeight: 1.8,
        confidence: 0.9,
        timeWindowMs: 300000 // 5 minutes
      }
    },
    {
      id: 'flash_loan_attack_pattern',
      name: 'Flash Loan Attack',
      description: 'Potential flash loan attack pattern detected',
      severity: 'critical',
      category: 'security',
      enabled: true,
      threshold: 1,
      conditions: [
        {
          type: 'flash_loan_attack',
          operator: 'gte',
          value: 1,
          field: 'borrowRepayPattern'
        }
      ],
      metadata: {
        tags: ['flash_loan', 'attack', 'defi'],
        mlWeight: 2.0,
        confidence: 0.95,
        timeWindowMs: 30000 // 30 seconds
      }
    },
    {
      id: 'sandwich_attack_detection',
      name: 'Sandwich Attack',
      description: 'MEV sandwich attack pattern detected',
      severity: 'high',
      category: 'behavior',
      enabled: true,
      threshold: 2,
      conditions: [
        {
          type: 'sandwich_attack',
          operator: 'gte',
          value: 2,
          field: 'frontRunBackRunPattern'
        }
      ],
      metadata: {
        tags: ['mev', 'sandwich', 'frontrun'],
        mlWeight: 1.6,
        confidence: 0.8,
        timeWindowMs: 60000 // 1 minute
      }
    },
    {
      id: 'wash_trading_detection',
      name: 'Wash Trading',
      description: 'Potential wash trading activity detected',
      severity: 'medium',
      category: 'token_manipulation',
      enabled: true,
      threshold: 5,
      conditions: [
        {
          type: 'wash_trading',
          operator: 'gte',
          value: 5,
          field: 'circularTradingPattern'
        }
      ],
      metadata: {
        tags: ['wash_trading', 'manipulation', 'volume'],
        mlWeight: 1.4,
        confidence: 0.75,
        timeWindowMs: 900000 // 15 minutes
      }
    },
    {
      id: 'token_spam_detection',
      name: 'Token Spam',
      description: 'Spam token creation or distribution detected',
      severity: 'medium',
      category: 'behavior',
      enabled: true,
      threshold: 10,
      conditions: [
        {
          type: 'token_spam',
          operator: 'gte',
          value: 10,
          field: 'tokenCreationBurst'
        }
      ],
      metadata: {
        tags: ['spam', 'tokens', 'creation'],
        mlWeight: 1.2,
        confidence: 0.7,
        timeWindowMs: 600000 // 10 minutes
      }
    },
    {
      id: 'arbitrage_bot_detection',
      name: 'Arbitrage Bot Activity',
      description: 'High-frequency arbitrage bot activity detected',
      severity: 'low',
      category: 'behavior',
      enabled: true,
      threshold: 20,
      conditions: [
        {
          type: 'arbitrage_bot',
          operator: 'gte',
          value: 20,
          field: 'highFrequencyTrades'
        }
      ],
      metadata: {
        tags: ['arbitrage', 'bot', 'trading'],
        mlWeight: 1.0,
        confidence: 0.6,
        timeWindowMs: 180000 // 3 minutes
      }
    }
  ]
};

/**
 * Manages anomaly pattern configurations
 */
export class AnomalyPatternManager {
  private patterns: AnomalyPatternConfiguration = DEFAULT_PATTERNS;
  private lastUpdate: Date = new Date();
  private remoteConfigUrl?: string;

  constructor(remoteConfigUrl?: string) {
    this.remoteConfigUrl = remoteConfigUrl;
  }

  /**
   * Load patterns from remote configuration
   */
  async loadRemotePatterns(): Promise<void> {
    if (!this.remoteConfigUrl) {
      console.log('[AnomalyPatterns] No remote config URL provided, using defaults');
      return;
    }

    try {
      const response = await fetch(this.remoteConfigUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const remotePatterns: AnomalyPatternConfiguration = await response.json();
      
      // Validate the configuration
      const validation = this.validateConfiguration(remotePatterns);
      if (validation.valid) {
        this.patterns = remotePatterns;
        this.lastUpdate = new Date();
        console.log(`[AnomalyPatterns] Loaded ${remotePatterns.patterns.length} patterns from remote config`);
      } else {
        console.warn('[AnomalyPatterns] Invalid remote configuration, using defaults');
        console.warn('[AnomalyPatterns] Validation errors:', validation.errors);
        throw new Error(`Invalid configuration: ${validation.errors.join('; ')}`);
      }
    } catch (error) {
      console.error('[AnomalyPatterns] Failed to load remote configuration:', error);
      console.log('[AnomalyPatterns] Falling back to default patterns');
    }
  }

  /**
   * Get all enabled patterns converted to AnomalyPattern format
   */
  getEnabledPatterns(): AnomalyPattern[] {
    return this.patterns.patterns
      .filter(config => config.enabled)
      .map(config => this.convertConfigToPattern(config));
  }

  /**
   * Get pattern configuration by ID
   */
  getPatternConfig(id: string): AnomalyPatternConfig | null {
    return this.patterns.patterns.find(p => p.id === id) || null;
  }

  /**
   * Update pattern configuration with validation
   */
  updatePattern(id: string, updates: Partial<AnomalyPatternConfig>): { success: boolean; errors?: string[] } {
    const patternIndex = this.patterns.patterns.findIndex(p => p.id === id);
    if (patternIndex === -1) {
      return { success: false, errors: [`Pattern with id '${id}' not found`] };
    }

    const updatedPattern = {
      ...this.patterns.patterns[patternIndex],
      ...updates
    };

    // Validate the updated pattern
    const validation = this.validatePatternConfig(updatedPattern);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.patterns.patterns[patternIndex] = updatedPattern;
    return { success: true };
  }

  /**
   * Add new pattern configuration with validation
   */
  addPattern(config: AnomalyPatternConfig): { success: boolean; errors?: string[] } {
    // Check for duplicate ID
    if (this.patterns.patterns.some(p => p.id === config.id)) {
      return { success: false, errors: [`Pattern with id '${config.id}' already exists`] };
    }

    // Validate the pattern
    const validation = this.validatePatternConfig(config);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.patterns.patterns.push(config);
    return { success: true };
  }

  /**
   * Remove pattern by ID
   */
  removePattern(id: string): boolean {
    const patternIndex = this.patterns.patterns.findIndex(p => p.id === id);
    if (patternIndex === -1) {
      return false;
    }

    this.patterns.patterns.splice(patternIndex, 1);
    return true;
  }
  getConfigurationInfo() {
    return {
      version: this.patterns.version,
      lastUpdated: this.patterns.lastUpdated,
      localUpdate: this.lastUpdate,
      totalPatterns: this.patterns.patterns.length,
      enabledPatterns: this.patterns.patterns.filter(p => p.enabled).length,
      remoteConfigUrl: this.remoteConfigUrl
    };
  }

  /**
   * Validate pattern configuration for required fields and structure
   */
  private validatePatternConfig(config: AnomalyPatternConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!config.id || typeof config.id !== 'string') {
      errors.push('Pattern must have a valid string id');
    }

    if (!config.name || typeof config.name !== 'string') {
      errors.push('Pattern must have a valid string name');
    }

    if (!config.description || typeof config.description !== 'string') {
      errors.push('Pattern must have a valid string description');
    }

    // Severity validation
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(config.severity)) {
      errors.push(`Severity must be one of: ${validSeverities.join(', ')}`);
    }

    // Category validation
    const validCategories = ['financial', 'security', 'performance', 'behavior', 'token_manipulation'];
    if (!validCategories.includes(config.category)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }

    // Threshold validation
    if (typeof config.threshold !== 'number' || config.threshold < 0) {
      errors.push('Threshold must be a non-negative number');
    }

    // Conditions validation
    if (!Array.isArray(config.conditions) || config.conditions.length === 0) {
      errors.push('Pattern must have at least one condition');
    } else {
      config.conditions.forEach((condition, index) => {
        if (!condition.type) {
          errors.push(`Condition ${index}: type is required`);
        }

        const validTypes = ['fee_spike', 'failure_rate', 'transaction_burst', 'unusual_program', 'large_transfer', 'rapid_trades', 'account_drain', 'flash_loan_attack', 'sandwich_attack', 'wash_trading', 'price_manipulation', 'token_spam', 'phishing_signature', 'liquidity_drain', 'arbitrage_bot', 'governance_attack'];
        if (!validTypes.includes(condition.type)) {
          errors.push(`Condition ${index}: type must be one of: ${validTypes.join(', ')}`);
        }

        const validOperators = ['gt', 'lt', 'eq', 'gte', 'lte', 'contains', 'regex'];
        if (!validOperators.includes(condition.operator)) {
          errors.push(`Condition ${index}: operator must be one of: ${validOperators.join(', ')}`);
        }

        if (condition.value === undefined || condition.value === null) {
          errors.push(`Condition ${index}: value is required`);
        }

        // Regex validation
        if (condition.operator === 'regex' && typeof condition.value === 'string') {
          try {
            new RegExp(condition.value);
          } catch (regexError) {
            errors.push(`Condition ${index}: invalid regex pattern: ${condition.value}`);
          }
        }
      });
    }

    // Metadata validation
    if (config.metadata) {
      if (config.metadata.mlWeight !== undefined && (typeof config.metadata.mlWeight !== 'number' || config.metadata.mlWeight < 0 || config.metadata.mlWeight > 1)) {
        errors.push('Metadata mlWeight must be a number between 0 and 1');
      }

      if (config.metadata.confidence !== undefined && (typeof config.metadata.confidence !== 'number' || config.metadata.confidence < 0 || config.metadata.confidence > 1)) {
        errors.push('Metadata confidence must be a number between 0 and 1');
      }

      if (config.metadata.timeWindowMs !== undefined && (typeof config.metadata.timeWindowMs !== 'number' || config.metadata.timeWindowMs <= 0)) {
        errors.push('Metadata timeWindowMs must be a positive number');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate entire configuration structure
   */
  private validateConfiguration(config: AnomalyPatternConfiguration): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.version || typeof config.version !== 'string') {
      errors.push('Configuration must have a valid version string');
    }

    if (!config.lastUpdated || typeof config.lastUpdated !== 'string') {
      errors.push('Configuration must have a valid lastUpdated timestamp');
    } else {
      // Validate ISO timestamp
      const date = new Date(config.lastUpdated);
      if (isNaN(date.getTime())) {
        errors.push('Configuration lastUpdated must be a valid ISO timestamp');
      }
    }

    if (!Array.isArray(config.patterns)) {
      errors.push('Configuration must have a patterns array');
    } else {
      // Check for duplicate IDs
      const ids = config.patterns.map(p => p.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push(`Duplicate pattern IDs found: ${duplicateIds.join(', ')}`);
      }

      // Validate each pattern
      config.patterns.forEach((pattern, index) => {
        const patternValidation = this.validatePatternConfig(pattern);
        if (!patternValidation.valid) {
          errors.push(`Pattern ${index} (${pattern.id || 'unknown'}): ${patternValidation.errors.join('; ')}`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }
  private convertConfigToPattern(config: AnomalyPatternConfig): AnomalyPattern {
    return {
      type: config.id,
      description: config.description,
      severity: config.severity,
      threshold: config.threshold,
      category: config.category,
      check: (event: any, context: AnomalyContext) => this.evaluateConditions(config.conditions, event, context),
      metadata: config.metadata
    };
  }

  /**
   * Evaluate pattern conditions against event and context
   */
  private evaluateConditions(conditions: AnomalyPatternConfig['conditions'], event: any, context: AnomalyContext): boolean {
    return conditions.every(condition => {
      const value = condition.field ? event[condition.field] : this.getContextValue(condition.type, context);
      
      switch (condition.operator) {
        case 'gt': return value > condition.value;
        case 'gte': return value >= condition.value;
        case 'lt': return value < condition.value;
        case 'lte': return value <= condition.value;
        case 'eq': return value === condition.value;
        case 'contains': return String(value).includes(String(condition.value));
        case 'regex': return new RegExp(condition.value).test(String(value));
        default: return false;
      }
    });
  }

  /**
   * Get value from context based on condition type
   */
  private getContextValue(type: string, context: AnomalyContext): any {
    switch (type) {
      case 'fee_spike':
        return context.averageFees;
      case 'failure_rate':
        return context.errorRate;
      case 'transaction_burst':
      case 'rapid_trades':
      case 'arbitrage_bot':
        return context.recentEvents.length;
      case 'large_transfer':
      case 'account_drain':
      case 'liquidity_drain':
        return context.transactionVolume;
      case 'flash_loan_attack':
      case 'sandwich_attack':
      case 'wash_trading':
      case 'price_manipulation':
        return context.recentEvents.filter(e => e.type === 'transaction').length;
      case 'token_spam':
      case 'phishing_signature':
        return context.recentEvents.filter(e => e.type === 'transaction' && e.data?.logs?.length > 0).length;
      case 'governance_attack':
        return context.recentEvents.filter(e => e.type === 'transaction' && e.data?.accountKeys?.length > 5).length;
      case 'unusual_program':
        return context.recentEvents.filter(e => e.type === 'transaction' && e.data?.err !== null).length;
      default:
        return 0;
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfiguration(config: any): config is AnomalyPatternConfiguration {
    if (!config || typeof config !== 'object') return false;
    if (!config.version || !config.patterns || !Array.isArray(config.patterns)) return false;
    
    return config.patterns.every((pattern: any) => {
      return pattern.id && pattern.name && pattern.description && 
             pattern.severity && pattern.category && 
             typeof pattern.enabled === 'boolean' &&
             typeof pattern.threshold === 'number' &&
             Array.isArray(pattern.conditions);
    });
  }
}

// Global pattern manager instance
let patternManager: AnomalyPatternManager | null = null;

/**
 * Get or create global pattern manager
 */
export function getAnomalyPatternManager(remoteConfigUrl?: string): AnomalyPatternManager {
  if (!patternManager) {
    patternManager = new AnomalyPatternManager(remoteConfigUrl);
  }
  return patternManager;
}

/**
 * Load patterns with remote configuration support
 */
export async function loadAnomalyPatterns(remoteConfigUrl?: string): Promise<AnomalyPattern[]> {
  const manager = getAnomalyPatternManager(remoteConfigUrl);
  await manager.loadRemotePatterns();
  return manager.getEnabledPatterns();
}