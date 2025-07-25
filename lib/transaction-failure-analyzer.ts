/**
 * Transaction Failure Analyzer
 * 
 * Analyzes failed Solana transactions to identify root causes, provide detailed
 * explanations, and suggest remediation strategies.
 */

import type { DetailedTransactionInfo } from './solana';

// Failure analysis interfaces
export interface TransactionFailureAnalysis {
  signature: string;
  isFailure: boolean;
  
  // Error Classification
  errorClassification: ErrorClassification;
  
  // Root Cause Analysis
  rootCause: RootCauseAnalysis;
  
  // Impact Assessment
  impact: FailureImpact;
  
  // Recovery Analysis
  recovery: RecoveryAnalysis;
  
  // Prevention Strategies
  prevention: PreventionStrategy[];
  
  // Retry Recommendations
  retryRecommendations: RetryRecommendation[];
  
  // Similar Failures
  similarFailures: SimilarFailure[];
  
  // Overall Assessment
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverability: 'immediate' | 'with_changes' | 'difficult' | 'impossible';
  confidence: number; // 0-100 confidence in analysis
}

export interface ErrorClassification {
  primaryCategory: ErrorCategory;
  secondaryCategories: ErrorCategory[];
  errorCode: string | null;
  errorMessage: string;
  technicalDescription: string;
  userFriendlyDescription: string;
  
  // Error hierarchy
  isSystemError: boolean;
  isProgramError: boolean;
  isUserError: boolean;
  isNetworkError: boolean;
  
  // Error characteristics
  isTransient: boolean; // Can be retried
  isDeterministic: boolean; // Will always fail with same inputs
  isResourceRelated: boolean; // Related to compute/fee limits
  isDataRelated: boolean; // Related to account data/state
}

export type ErrorCategory = 
  | 'insufficient_funds'
  | 'compute_budget_exceeded'
  | 'account_not_found'
  | 'account_data_size_exceeded'
  | 'account_already_in_use'
  | 'invalid_account_data'
  | 'invalid_instruction_data'
  | 'program_error'
  | 'custom_program_error'
  | 'blockhash_not_found'
  | 'fee_calculation_error'
  | 'signature_verification_failed'
  | 'duplicate_signature'
  | 'account_in_use'
  | 'account_loaded_twice'
  | 'account_not_executable'
  | 'loader_call_chain_too_deep'
  | 'missing_required_signature'
  | 'readonly_account_modified'
  | 'readonly_lamport_change'
  | 'duplicate_account_index'
  | 'executable_modified'
  | 'rent_not_exempt'
  | 'unsupported_sysvar'
  | 'illegal_owner'
  | 'max_seed_length_exceeded'
  | 'address_lookup_table_not_found'
  | 'invalid_address_lookup_table_owner'
  | 'invalid_address_lookup_table_data'
  | 'address_lookup_table_index_out_of_bounds'
  | 'invalid_address_lookup_table_index'
  | 'call_depth_exceeded'
  | 'missing_account'
  | 'arithmetic_overflow'
  | 'unsupported_instruction'
  | 'incorrect_program_id'
  | 'missing_required_signatures'
  | 'account_borrow_failed'
  | 'max_instruction_trace_length_exceeded'
  | 'builtin_programs_must_consume_compute_units'
  | 'invalid_account_owner'
  | 'program_execution_temporarily_restricted'
  | 'invalid_rent_paying_account'
  | 'insufficient_funds_for_rent'
  | 'max_accounts_data_allocations_exceeded'
  | 'max_accounts_exceeded'
  | 'compute_budget_instruction_not_supported'
  | 'insufficient_funds_for_fee'
  | 'invalid_writable_account'
  | 'too_many_account_locks'
  | 'slot_hashes_sysvar_not_found'
  | 'recent_blockhashes_sysvar_not_found'
  | 'missing_sysvar_account'
  | 'invalid_program_for_execution'
  | 'call_chain_too_deep'
  | 'missing_signature_for_fee'
  | 'transaction_address_table_lookup_uses_an_invalid_index'
  | 'invalid_loaded_accounts_data_size_limit'
  | 'snapshot_not_found'
  | 'unsupported_version'
  | 'unknown_error';

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: ContributingFactor[];
  
  // Context analysis
  accountStateIssues: AccountStateIssue[];
  instructionIssues: InstructionIssue[];
  resourceIssues: ResourceIssue[];
  timingIssues: TimingIssue[];
  
  // Failure point
  failurePoint: {
    instructionIndex: number | null;
    programId: string | null;
    accountIndex: number | null;
    specificOperation: string | null;
  };
  
  // Chain of events leading to failure
  failureChain: FailureEvent[];
}

export interface ContributingFactor {
  factor: string;
  description: string;
  impact: 'major' | 'moderate' | 'minor';
  category: 'resource' | 'data' | 'logic' | 'timing' | 'external';
}

export interface AccountStateIssue {
  accountAddress: string;
  issue: string;
  expectedState: string;
  actualState: string;
  impact: string;
}

export interface InstructionIssue {
  instructionIndex: number;
  programId: string;
  issue: string;
  description: string;
  suggestedFix: string;
}

export interface ResourceIssue {
  resource: 'compute_units' | 'lamports' | 'account_data' | 'stack_depth';
  required: number;
  available: number;
  deficit: number;
  impact: string;
}

export interface TimingIssue {
  issue: 'blockhash_expired' | 'account_locked' | 'network_congestion' | 'slot_timing';
  description: string;
  timeframe: string;
  suggestion: string;
}

export interface FailureEvent {
  step: number;
  description: string;
  component: 'runtime' | 'program' | 'account' | 'instruction';
  timestamp: number | null;
  details: Record<string, any>;
}

export interface FailureImpact {
  // Financial impact
  feesLost: number; // lamports
  feesLostUSD: number | null;
  
  // Operational impact
  transactionFailed: boolean;
  partialExecution: boolean;
  accountsAffected: string[];
  
  // User experience impact
  userImpact: 'none' | 'minor' | 'moderate' | 'severe';
  businessImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  
  // Recovery cost
  estimatedRecoveryCost: number; // lamports
  estimatedRecoveryTime: string;
  
  // Downstream effects
  cascadingFailures: CascadingFailure[];
}

export interface CascadingFailure {
  type: 'dependent_transaction' | 'account_state' | 'program_state' | 'user_flow';
  description: string;
  affectedComponents: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface RecoveryAnalysis {
  isRecoverable: boolean;
  recoveryComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  
  // Recovery options
  immediateActions: RecoveryAction[];
  shortTermActions: RecoveryAction[];
  longTermActions: RecoveryAction[];
  
  // Recovery requirements
  requiredResources: {
    additionalFunds: number; // lamports
    computeUnits: number;
    accountChanges: string[];
    timeRequired: string;
  };
  
  // Recovery success probability
  successProbability: number; // 0-100
  riskFactors: string[];
}

export interface RecoveryAction {
  action: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedCost: number; // lamports
  estimatedTime: string;
  prerequisites: string[];
  risks: string[];
  successRate: number; // 0-100
}

export interface PreventionStrategy {
  strategy: string;
  description: string;
  implementation: string;
  effectiveness: number; // 0-100
  cost: 'free' | 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'validation' | 'resource_management' | 'error_handling' | 'monitoring' | 'design';
}

export interface RetryRecommendation {
  shouldRetry: boolean;
  retryStrategy: 'immediate' | 'with_delay' | 'with_modifications' | 'not_recommended';
  
  // Retry parameters
  recommendedDelay: number; // milliseconds
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  
  // Required modifications
  requiredChanges: RequiredChange[];
  
  // Success probability
  retrySuccessProbability: number; // 0-100
  
  // Conditions for retry
  retryConditions: string[];
  
  // Monitoring recommendations
  monitoringPoints: string[];
}

export interface RequiredChange {
  type: 'increase_fee' | 'increase_compute' | 'modify_accounts' | 'change_instruction_data' | 'wait_for_confirmation' | 'update_blockhash';
  description: string;
  specificChange: string;
  impact: string;
  cost: number; // additional lamports if applicable
}

export interface SimilarFailure {
  signature: string;
  similarity: number; // 0-100
  errorCategory: ErrorCategory;
  resolution: string | null;
  timeToResolve: string | null;
  successfulRetry: boolean;
  lessons: string[];
}

// Configuration for failure analysis
export interface FailureAnalyzerConfig {
  includeHistoricalData: boolean;
  includeSimilarFailures: boolean;
  maxSimilarFailures: number;
  confidenceThreshold: number;
  
  // Analysis depth
  deepAnalysis: boolean;
  includePreventionStrategies: boolean;
  includeRecoveryAnalysis: boolean;
  
  // External data sources
  solPriceUSD?: number;
  networkConditions?: 'normal' | 'congested' | 'degraded';
  
  // Thresholds
  thresholds: {
    highImpactFee: number; // lamports
    criticalComputeUsage: number; // percentage
    maxRetryAttempts: number;
  };
}

// Error pattern interface
interface ErrorPattern {
  category: ErrorCategory;
  secondaryCategories?: ErrorCategory[];
  technicalDescription: string;
  userFriendlyDescription: string;
  isSystemError: boolean;
  isProgramError: boolean;
  isUserError: boolean;
  isNetworkError: boolean;
  isTransient: boolean;
  isDeterministic: boolean;
  isResourceRelated: boolean;
  isDataRelated: boolean;
  errorCodes?: string[];
  messagePatterns?: string[];
}

// Default configuration
const DEFAULT_CONFIG: FailureAnalyzerConfig = {
  includeHistoricalData: true,
  includeSimilarFailures: true,
  maxSimilarFailures: 5,
  confidenceThreshold: 70,
  deepAnalysis: true,
  includePreventionStrategies: true,
  includeRecoveryAnalysis: true,
  solPriceUSD: 100,
  networkConditions: 'normal',
  thresholds: {
    highImpactFee: 100000, // 0.1 SOL
    criticalComputeUsage: 90,
    maxRetryAttempts: 3
  }
};

export class TransactionFailureAnalyzer {
  private config: FailureAnalyzerConfig;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private failureHistory: Map<string, TransactionFailureAnalysis> = new Map();

  constructor(config: Partial<FailureAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeErrorPatterns();
  }

  /**
   * Analyze a failed transaction
   */
  async analyzeFailure(transaction: DetailedTransactionInfo): Promise<TransactionFailureAnalysis> {
    // Check if transaction actually failed
    const isFailure = this.isTransactionFailure(transaction);
    
    if (!isFailure) {
      return this.createSuccessAnalysis(transaction);
    }

    const analysis: TransactionFailureAnalysis = {
      signature: transaction.signature,
      isFailure: true,
      
      errorClassification: await this.classifyError(transaction),
      rootCause: await this.analyzeRootCause(transaction),
      impact: await this.assessImpact(transaction),
      recovery: await this.analyzeRecovery(transaction),
      prevention: await this.generatePreventionStrategies(transaction),
      retryRecommendations: await this.generateRetryRecommendations(transaction),
      similarFailures: await this.findSimilarFailures(transaction),
      
      severity: 'medium', // Will be calculated
      recoverability: 'with_changes', // Will be calculated
      confidence: 0 // Will be calculated
    };

    // Calculate derived fields
    analysis.severity = this.calculateSeverity(analysis);
    analysis.recoverability = this.calculateRecoverability(analysis);
    analysis.confidence = this.calculateConfidence(analysis);

    // Cache the analysis
    this.failureHistory.set(transaction.signature, analysis);
    
    return analysis;
  }

  /**
   * Check if transaction is a failure
   */
  private isTransactionFailure(transaction: DetailedTransactionInfo): boolean {
    return !transaction.success;
  }

  /**
   * Create analysis for successful transaction
   */
  private createSuccessAnalysis(transaction: DetailedTransactionInfo): TransactionFailureAnalysis {
    return {
      signature: transaction.signature,
      isFailure: false,
      errorClassification: {} as ErrorClassification,
      rootCause: {} as RootCauseAnalysis,
      impact: {} as FailureImpact,
      recovery: {} as RecoveryAnalysis,
      prevention: [],
      retryRecommendations: [],
      similarFailures: [],
      severity: 'low',
      recoverability: 'immediate',
      confidence: 100
    };
  }

  /**
   * Classify the error
   */
  private async classifyError(transaction: DetailedTransactionInfo): Promise<ErrorClassification> {
    // For failed transactions, we need to infer the error type from available data
    // Since DetailedTransactionInfo doesn't have meta.err, we'll create a mock error for analysis
    const mockError = this.inferErrorFromTransaction(transaction);

    // Parse error information
    const errorInfo = this.parseError(mockError);
    const pattern = this.matchErrorPattern(errorInfo);
    
    return {
      primaryCategory: pattern.category,
      secondaryCategories: pattern.secondaryCategories || [],
      errorCode: errorInfo.code,
      errorMessage: errorInfo.message,
      technicalDescription: pattern.technicalDescription,
      userFriendlyDescription: pattern.userFriendlyDescription,
      
      isSystemError: pattern.isSystemError,
      isProgramError: pattern.isProgramError,
      isUserError: pattern.isUserError,
      isNetworkError: pattern.isNetworkError,
      
      isTransient: pattern.isTransient,
      isDeterministic: pattern.isDeterministic,
      isResourceRelated: pattern.isResourceRelated,
      isDataRelated: pattern.isDataRelated
    };
  }

  /**
   * Analyze root cause of failure
   */
  private async analyzeRootCause(transaction: DetailedTransactionInfo): Promise<RootCauseAnalysis> {
    const mockError = this.inferErrorFromTransaction(transaction);
    const instructions = transaction.details?.instructions || [];
    const accounts = transaction.details?.accounts || [];
    
    // Determine failure point
    const failurePoint = this.determineFailurePoint(transaction);
    
    // Analyze contributing factors
    const contributingFactors = this.analyzeContributingFactors(transaction);
    
    // Analyze account state issues
    const accountStateIssues = await this.analyzeAccountStateIssues(transaction);
    
    // Analyze instruction issues
    const instructionIssues = this.analyzeInstructionIssues(transaction);
    
    // Analyze resource issues
    const resourceIssues = this.analyzeResourceIssues(transaction);
    
    // Analyze timing issues
    const timingIssues = this.analyzeTimingIssues(transaction);
    
    // Build failure chain
    const failureChain = this.buildFailureChain(transaction);
    
    return {
      primaryCause: this.determinePrimaryCause(mockError, contributingFactors),
      contributingFactors,
      accountStateIssues,
      instructionIssues,
      resourceIssues,
      timingIssues,
      failurePoint,
      failureChain
    };
  }

  /**
   * Assess failure impact
   */
  private async assessImpact(transaction: DetailedTransactionInfo): Promise<FailureImpact> {
    // Estimate fee based on transaction complexity since we don't have meta.fee
    const fee = this.estimateTransactionFee(transaction);
    const feeUSD = this.config.solPriceUSD ? (fee / 1e9) * this.config.solPriceUSD : null;
    
    const accounts = transaction.details?.accounts?.map(acc => acc.pubkey) || [];
    
    // Determine user and business impact
    const userImpact = this.assessUserImpact(transaction);
    const businessImpact = this.assessBusinessImpact(transaction);
    
    // Estimate recovery cost
    const estimatedRecoveryCost = this.estimateRecoveryCost(transaction);
    const estimatedRecoveryTime = this.estimateRecoveryTime(transaction);
    
    // Analyze cascading failures
    const cascadingFailures = await this.analyzeCascadingFailures(transaction);
    
    return {
      feesLost: fee,
      feesLostUSD: feeUSD,
      transactionFailed: true,
      partialExecution: this.hasPartialExecution(transaction),
      accountsAffected: accounts,
      userImpact,
      businessImpact,
      estimatedRecoveryCost,
      estimatedRecoveryTime,
      cascadingFailures
    };
  }

  /**
   * Analyze recovery options
   */
  private async analyzeRecovery(transaction: DetailedTransactionInfo): Promise<RecoveryAnalysis> {
    const errorClassification = await this.classifyError(transaction);
    
    const isRecoverable = this.isRecoverable(errorClassification);
    const recoveryComplexity = this.assessRecoveryComplexity(transaction, errorClassification);
    
    // Generate recovery actions
    const immediateActions = this.generateImmediateActions(transaction, errorClassification);
    const shortTermActions = this.generateShortTermActions(transaction, errorClassification);
    const longTermActions = this.generateLongTermActions(transaction, errorClassification);
    
    // Calculate required resources
    const requiredResources = this.calculateRequiredResources(transaction, errorClassification);
    
    // Assess success probability
    const successProbability = this.calculateRecoverySuccessProbability(transaction, errorClassification);
    const riskFactors = this.identifyRecoveryRiskFactors(transaction, errorClassification);
    
    return {
      isRecoverable,
      recoveryComplexity,
      immediateActions,
      shortTermActions,
      longTermActions,
      requiredResources,
      successProbability,
      riskFactors
    };
  }

  /**
   * Generate prevention strategies
   */
  private async generatePreventionStrategies(transaction: DetailedTransactionInfo): Promise<PreventionStrategy[]> {
    const errorClassification = await this.classifyError(transaction);
    const rootCause = await this.analyzeRootCause(transaction);
    
    const strategies: PreventionStrategy[] = [];
    
    // Add category-specific strategies
    switch (errorClassification.primaryCategory) {
      case 'insufficient_funds':
        strategies.push({
          strategy: 'Pre-flight Balance Check',
          description: 'Verify account has sufficient funds before transaction submission',
          implementation: 'Add balance validation in client code before sending transaction',
          effectiveness: 95,
          cost: 'free',
          difficulty: 'easy',
          category: 'validation'
        });
        break;
        
      case 'compute_budget_exceeded':
        strategies.push({
          strategy: 'Compute Budget Management',
          description: 'Set appropriate compute unit limits and monitor usage',
          implementation: 'Use ComputeBudgetProgram instructions to set limits',
          effectiveness: 90,
          cost: 'low',
          difficulty: 'medium',
          category: 'resource_management'
        });
        break;
        
      case 'account_not_found':
        strategies.push({
          strategy: 'Account Existence Validation',
          description: 'Verify all required accounts exist before transaction',
          implementation: 'Use getAccountInfo RPC calls for validation',
          effectiveness: 98,
          cost: 'free',
          difficulty: 'easy',
          category: 'validation'
        });
        break;
    }
    
    // Add general strategies based on contributing factors
    rootCause.contributingFactors.forEach(factor => {
      if (factor.category === 'resource') {
        strategies.push({
          strategy: 'Resource Monitoring',
          description: 'Implement comprehensive resource usage monitoring',
          implementation: 'Add monitoring for compute units, fees, and account limits',
          effectiveness: 80,
          cost: 'medium',
          difficulty: 'medium',
          category: 'monitoring'
        });
      }
    });
    
    return strategies;
  }

  /**
   * Generate retry recommendations
   */
  private async generateRetryRecommendations(transaction: DetailedTransactionInfo): Promise<RetryRecommendation[]> {
    const errorClassification = await this.classifyError(transaction);
    const recommendations: RetryRecommendation[] = [];
    
    const shouldRetry = errorClassification.isTransient && !errorClassification.isDeterministic;
    
    if (shouldRetry) {
      const retryStrategy = this.determineRetryStrategy(errorClassification);
      const requiredChanges = this.determineRequiredChanges(transaction, errorClassification);
      
      recommendations.push({
        shouldRetry: true,
        retryStrategy,
        recommendedDelay: this.calculateRetryDelay(errorClassification),
        maxRetries: this.config.thresholds.maxRetryAttempts,
        backoffStrategy: 'exponential',
        requiredChanges,
        retrySuccessProbability: this.calculateRetrySuccessProbability(errorClassification),
        retryConditions: this.generateRetryConditions(errorClassification),
        monitoringPoints: this.generateMonitoringPoints(errorClassification)
      });
    } else {
      recommendations.push({
        shouldRetry: false,
        retryStrategy: 'not_recommended',
        recommendedDelay: 0,
        maxRetries: 0,
        backoffStrategy: 'fixed',
        requiredChanges: [],
        retrySuccessProbability: 0,
        retryConditions: ['Error is not recoverable through retry'],
        monitoringPoints: []
      });
    }
    
    return recommendations;
  }

  /**
   * Find similar failures
   */
  private async findSimilarFailures(transaction: DetailedTransactionInfo): Promise<SimilarFailure[]> {
    if (!this.config.includeSimilarFailures) {
      return [];
    }
    
    // In a real implementation, this would query a database
    // For now, return mock similar failures
    return [
      {
        signature: 'similar-failure-1',
        similarity: 85,
        errorCategory: 'insufficient_funds',
        resolution: 'Added sufficient funds and retried',
        timeToResolve: '5 minutes',
        successfulRetry: true,
        lessons: ['Always check balance before transaction', 'Add buffer for fees']
      }
    ];
  }

  // Helper methods for error analysis
  private parseError(error: any): { code: string | null; message: string; details: any } {
    if (typeof error === 'string') {
      return { code: null, message: error, details: {} };
    }
    
    if (typeof error === 'object') {
      // Handle different error formats
      if (error.InstructionError) {
        const [index, instructionError] = error.InstructionError;
        return {
          code: `InstructionError:${index}`,
          message: this.formatInstructionError(instructionError),
          details: { instructionIndex: index, error: instructionError }
        };
      }
      
      if (error.InsufficientFundsForFee) {
        return {
          code: 'InsufficientFundsForFee',
          message: 'Insufficient funds to pay transaction fee',
          details: error
        };
      }
      
      if (error.BlockhashNotFound) {
        return {
          code: 'BlockhashNotFound',
          message: 'Blockhash not found - transaction may be too old',
          details: error
        };
      }
      
      // Handle other error types
      const errorType = Object.keys(error)[0];
      return {
        code: errorType,
        message: this.getErrorMessage(errorType, error[errorType]),
        details: error
      };
    }
    
    return {
      code: 'UnknownError',
      message: 'Unknown error occurred',
      details: error
    };
  }

  private formatInstructionError(instructionError: any): string {
    if (typeof instructionError === 'string') {
      return instructionError;
    }
    
    if (typeof instructionError === 'object') {
      const errorType = Object.keys(instructionError)[0];
      return `${errorType}: ${JSON.stringify(instructionError[errorType])}`;
    }
    
    return 'Instruction execution failed';
  }

  private getErrorMessage(errorType: string, errorData: any): string {
    const errorMessages: Record<string, string> = {
      'InsufficientFundsForFee': 'Account has insufficient funds to pay the transaction fee',
      'BlockhashNotFound': 'The blockhash is not found or has expired',
      'DuplicateSignature': 'A transaction with this signature has already been processed',
      'AccountInUse': 'Account is currently locked by another transaction',
      'AccountLoadedTwice': 'Account appears multiple times in the transaction',
      'AccountNotFound': 'Referenced account does not exist',
      'ProgramAccountNotFound': 'Program account does not exist',
      'InsufficientFundsForRent': 'Insufficient funds to maintain rent exemption',
      'InvalidAccountForFee': 'Invalid account specified for fee payment',
      'InvalidProgramForExecution': 'Program is not executable or invalid',
      'MissingRequiredSignature': 'Transaction is missing required signatures',
      'InvalidSignature': 'One or more signatures are invalid',
      'CallChainTooDeep': 'Cross-program invocation call chain is too deep',
      'MissingAccount': 'Required account is missing from transaction',
      'InvalidInstructionData': 'Instruction data is invalid or malformed',
      'InvalidAccountData': 'Account data is invalid or corrupted',
      'AccountDataSizeChanged': 'Account data size changed unexpectedly',
      'InvalidRealloc': 'Invalid account reallocation',
      'ComputeBudgetExceeded': 'Transaction exceeded compute unit limit',
      'MaxSeedLengthExceeded': 'Seed length exceeds maximum allowed',
      'AddressLookupTableNotFound': 'Address lookup table not found',
      'InvalidAddressLookupTableIndex': 'Invalid index in address lookup table'
    };
    
    return errorMessages[errorType] || `${errorType}: ${JSON.stringify(errorData)}`;
  }

  private matchErrorPattern(errorInfo: { code: string | null; message: string; details: any }): ErrorPattern {
    // Try to match against known patterns
    const patterns = Array.from(this.errorPatterns.entries());
    for (const [patternKey, pattern] of patterns) {
      if (this.matchesPattern(errorInfo, pattern)) {
        return pattern;
      }
    }
    
    // Return default pattern for unknown errors
    return this.getDefaultErrorPattern(errorInfo);
  }

  private matchesPattern(errorInfo: { code: string | null; message: string; details: any }, pattern: ErrorPattern): boolean {
    if (pattern.errorCodes && errorInfo.code) {
      return pattern.errorCodes.includes(errorInfo.code);
    }
    
    if (pattern.messagePatterns) {
      return pattern.messagePatterns.some(msgPattern => 
        errorInfo.message.toLowerCase().includes(msgPattern.toLowerCase())
      );
    }
    
    return false;
  }

  private getDefaultErrorPattern(errorInfo: { code: string | null; message: string; details: any }): ErrorPattern {
    return {
      category: 'unknown_error',
      secondaryCategories: [],
      technicalDescription: `Unknown error: ${errorInfo.message}`,
      userFriendlyDescription: 'An unexpected error occurred during transaction processing',
      isSystemError: true,
      isProgramError: false,
      isUserError: false,
      isNetworkError: false,
      isTransient: false,
      isDeterministic: true,
      isResourceRelated: false,
      isDataRelated: false,
      errorCodes: errorInfo.code ? [errorInfo.code] : [],
      messagePatterns: []
    };
  }

  // Initialize error patterns
  private initializeErrorPatterns(): void {
    // Define common error patterns
    this.errorPatterns.set('insufficient_funds', {
      category: 'insufficient_funds',
      secondaryCategories: [],
      technicalDescription: 'Account does not have sufficient lamports to pay transaction fee',
      userFriendlyDescription: 'Your account does not have enough SOL to pay for this transaction',
      isSystemError: false,
      isProgramError: false,
      isUserError: true,
      isNetworkError: false,
      isTransient: false,
      isDeterministic: true,
      isResourceRelated: true,
      isDataRelated: false,
      errorCodes: ['InsufficientFundsForFee'],
      messagePatterns: ['insufficient funds']
    });
    
    this.errorPatterns.set('blockhash_not_found', {
      category: 'blockhash_not_found',
      secondaryCategories: [],
      technicalDescription: 'Transaction blockhash is not found in recent block history',
      userFriendlyDescription: 'Transaction is too old and needs to be recreated with a fresh blockhash',
      isSystemError: false,
      isProgramError: false,
      isUserError: true,
      isNetworkError: false,
      isTransient: true,
      isDeterministic: false,
      isResourceRelated: false,
      isDataRelated: false,
      errorCodes: ['BlockhashNotFound'],
      messagePatterns: ['blockhash not found']
    });
    
    this.errorPatterns.set('compute_budget_exceeded', {
      category: 'compute_budget_exceeded',
      secondaryCategories: [],
      technicalDescription: 'Transaction exceeded the compute unit limit',
      userFriendlyDescription: 'Transaction is too complex and needs to be simplified or split',
      isSystemError: false,
      isProgramError: false,
      isUserError: true,
      isNetworkError: false,
      isTransient: false,
      isDeterministic: true,
      isResourceRelated: true,
      isDataRelated: false,
      errorCodes: ['ComputeBudgetExceeded'],
      messagePatterns: ['compute budget exceeded']
    });
  }

  // Helper method to infer error from transaction data
  private inferErrorFromTransaction(transaction: DetailedTransactionInfo): any {
    // Since we don't have meta.err, we need to infer the error type
    // This is a simplified approach - in a real implementation, we'd have more sophisticated logic
    
    if (!transaction.success) {
      // Check for common failure patterns based on available data
      const instructions = transaction.details?.instructions || [];
      const accounts = transaction.details?.accounts || [];
      
      // If transaction has no instructions, it might be a system error
      if (instructions.length === 0) {
        return { InsufficientFundsForFee: {} };
      }
      
      // If transaction has many instructions, it might be compute budget exceeded
      if (instructions.length > 10) {
        return { ComputeBudgetExceeded: {} };
      }
      
      // Default to insufficient funds for failed transactions
      return { InsufficientFundsForFee: {} };
    }
    
    return null;
  }

  // Helper method to estimate transaction fee
  private estimateTransactionFee(transaction: DetailedTransactionInfo): number {
    const instructions = transaction.details?.instructions || [];
    const accounts = transaction.details?.accounts || [];
    
    // Base fee (5000 lamports) + instruction fees
    const baseFee = 5000;
    const instructionFee = instructions.length * 1000;
    const accountFee = accounts.length * 100;
    
    return baseFee + instructionFee + accountFee;
  }

  // Placeholder methods - these would be implemented with full logic
  private determineFailurePoint(transaction: DetailedTransactionInfo): RootCauseAnalysis['failurePoint'] {
    return {
      instructionIndex: null,
      programId: null,
      accountIndex: null,
      specificOperation: null
    };
  }

  private analyzeContributingFactors(transaction: DetailedTransactionInfo): ContributingFactor[] {
    const factors: ContributingFactor[] = [];
    const instructions = transaction.details?.instructions || [];
    const accounts = transaction.details?.accounts || [];
    
    // Analyze instruction count
    if (instructions.length > 10) {
      factors.push({
        factor: 'High instruction count',
        description: `Transaction contains ${instructions.length} instructions, which may contribute to compute limit issues`,
        impact: 'moderate',
        category: 'resource'
      });
    }
    
    // Analyze account count
    if (accounts.length > 20) {
      factors.push({
        factor: 'High account count',
        description: `Transaction references ${accounts.length} accounts, which may impact processing`,
        impact: 'minor',
        category: 'resource'
      });
    }
    
    return factors;
  }

  private async analyzeAccountStateIssues(transaction: DetailedTransactionInfo): Promise<AccountStateIssue[]> {
    const issues: AccountStateIssue[] = [];
    const accounts = transaction.details?.accounts || [];
    
    // In a real implementation, this would check actual account states
    // For now, return mock issues based on transaction failure
    if (!transaction.success && accounts.length > 0) {
      issues.push({
        accountAddress: accounts[0].pubkey,
        issue: 'Insufficient balance',
        expectedState: 'Balance >= transaction fee',
        actualState: 'Balance < transaction fee',
        impact: 'Transaction cannot be processed'
      });
    }
    
    return issues;
  }

  private analyzeInstructionIssues(transaction: DetailedTransactionInfo): InstructionIssue[] {
    const issues: InstructionIssue[] = [];
    const instructions = transaction.details?.instructions || [];
    
    // Analyze each instruction for potential issues
    instructions.forEach((instruction, index) => {
      if ('programId' in instruction) {
        // Check for common problematic program IDs or patterns
        if (instruction.programId === 'unknown' || !instruction.programId) {
          issues.push({
            instructionIndex: index,
            programId: instruction.programId || 'unknown',
            issue: 'Unknown program',
            description: 'Instruction references an unknown or invalid program',
            suggestedFix: 'Verify program ID and ensure program is deployed'
          });
        }
      }
    });
    
    return issues;
  }

  private analyzeResourceIssues(transaction: DetailedTransactionInfo): ResourceIssue[] {
    const issues: ResourceIssue[] = [];
    const mockError = this.inferErrorFromTransaction(transaction);
    
    // Analyze compute budget issues
    if (this.isComputeBudgetError(mockError)) {
      issues.push({
        resource: 'compute_units',
        required: 1400000, // Estimated
        available: 200000, // Estimated
        deficit: 1200000,
        impact: 'Transaction cannot complete execution'
      });
    }
    
    // Analyze lamport issues
    if (this.isInsufficientFundsError(mockError)) {
      const fee = this.estimateTransactionFee(transaction);
      issues.push({
        resource: 'lamports',
        required: fee,
        available: 0, // Would need to check actual balance
        deficit: fee,
        impact: 'Cannot pay transaction fee'
      });
    }
    
    return issues;
  }

  private analyzeTimingIssues(transaction: DetailedTransactionInfo): TimingIssue[] {
    const issues: TimingIssue[] = [];
    const mockError = this.inferErrorFromTransaction(transaction);
    
    if (mockError && typeof mockError === 'object' && mockError.BlockhashNotFound) {
      issues.push({
        issue: 'blockhash_expired',
        description: 'Transaction blockhash has expired',
        timeframe: 'Blockhashes expire after ~2 minutes',
        suggestion: 'Use a more recent blockhash and submit transaction quickly'
      });
    }
    
    return issues;
  }

  private buildFailureChain(transaction: DetailedTransactionInfo): FailureEvent[] {
    const chain: FailureEvent[] = [];
    const mockError = this.inferErrorFromTransaction(transaction);
    
    // Build a simplified failure chain
    chain.push({
      step: 1,
      description: 'Transaction submitted to network',
      component: 'runtime',
      timestamp: transaction.timestamp,
      details: { signature: transaction.signature }
    });
    
    chain.push({
      step: 2,
      description: 'Transaction validation started',
      component: 'runtime',
      timestamp: transaction.timestamp,
      details: {}
    });
    
    if (mockError) {
      chain.push({
        step: 3,
        description: 'Transaction execution failed',
        component: this.getFailureComponent(mockError),
        timestamp: transaction.timestamp,
        details: { error: mockError }
      });
    }
    
    return chain;
  }

  private getFailureComponent(error: any): FailureEvent['component'] {
    if (typeof error === 'object' && error.InstructionError) {
      return 'program';
    }
    return 'runtime';
  }

  private determinePrimaryCause(error: any, contributingFactors: ContributingFactor[]): string {
    if (typeof error === 'object') {
      if (error.InsufficientFundsForFee) {
        return 'Insufficient funds to pay transaction fee';
      }
      if (error.BlockhashNotFound) {
        return 'Transaction blockhash has expired';
      }
      if (error.InstructionError) {
        return 'Program instruction execution failed';
      }
    }
    
    return 'Unknown transaction failure';
  }

  // Assessment methods
  private assessUserImpact(transaction: DetailedTransactionInfo): FailureImpact['userImpact'] {
    const fee = this.estimateTransactionFee(transaction);
    
    if (fee > this.config.thresholds.highImpactFee) {
      return 'severe';
    }
    if (fee > 50000) {
      return 'moderate';
    }
    if (fee > 10000) {
      return 'minor';
    }
    return 'none';
  }

  private assessBusinessImpact(transaction: DetailedTransactionInfo): FailureImpact['businessImpact'] {
    // This would be customized based on business logic
    const instructions = transaction.details?.instructions || [];
    
    if (instructions.length > 10) {
      return 'high'; // Complex transactions likely have higher business impact
    }
    if (instructions.length > 5) {
      return 'medium';
    }
    return 'low';
  }

  private estimateRecoveryCost(transaction: DetailedTransactionInfo): number {
    const baseFee = 5000; // Base transaction fee
    const originalFee = this.estimateTransactionFee(transaction);
    
    // Estimate additional cost for retry with higher fee
    return baseFee + Math.max(originalFee * 1.5, 10000);
  }

  private estimateRecoveryTime(transaction: DetailedTransactionInfo): string {
    const mockError = this.inferErrorFromTransaction(transaction);
    
    if (this.isTransientError(mockError)) {
      return '1-5 minutes';
    }
    if (this.requiresAccountChanges(mockError)) {
      return '10-30 minutes';
    }
    if (this.requiresCodeChanges(mockError)) {
      return '1-24 hours';
    }
    
    return 'Unknown';
  }

  private async analyzeCascadingFailures(transaction: DetailedTransactionInfo): Promise<CascadingFailure[]> {
    const failures: CascadingFailure[] = [];
    
    // Analyze potential downstream effects
    const accounts = transaction.details?.accounts || [];
    if (accounts.length > 1) {
      failures.push({
        type: 'account_state',
        description: 'Account states may be inconsistent due to partial execution',
        affectedComponents: accounts.map(acc => acc.pubkey),
        severity: 'medium'
      });
    }
    
    return failures;
  }

  // Recovery analysis methods
  private isRecoverable(errorClassification: ErrorClassification): boolean {
    return errorClassification.isTransient || !errorClassification.isDeterministic;
  }

  private assessRecoveryComplexity(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAnalysis['recoveryComplexity'] {
    if (errorClassification.isTransient && !errorClassification.isResourceRelated) {
      return 'simple';
    }
    if (errorClassification.isResourceRelated) {
      return 'moderate';
    }
    if (errorClassification.isProgramError) {
      return 'complex';
    }
    return 'very_complex';
  }

  private generateImmediateActions(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    if (errorClassification.primaryCategory === 'insufficient_funds') {
      actions.push({
        action: 'Add funds to account',
        description: 'Transfer sufficient SOL to cover transaction fee',
        priority: 'critical',
        complexity: 'simple',
        estimatedCost: 10000, // Minimum additional funds
        estimatedTime: '1-2 minutes',
        prerequisites: ['Access to funding source'],
        risks: ['Market price volatility'],
        successRate: 95
      });
    }
    
    if (errorClassification.primaryCategory === 'blockhash_not_found') {
      actions.push({
        action: 'Update blockhash and retry',
        description: 'Get fresh blockhash and resubmit transaction',
        priority: 'high',
        complexity: 'simple',
        estimatedCost: 0,
        estimatedTime: '30 seconds',
        prerequisites: ['RPC access'],
        risks: ['Network congestion'],
        successRate: 90
      });
    }
    
    return actions;
  }

  private generateShortTermActions(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    if (errorClassification.primaryCategory === 'compute_budget_exceeded') {
      actions.push({
        action: 'Optimize transaction structure',
        description: 'Reduce instruction complexity or split into multiple transactions',
        priority: 'high',
        complexity: 'moderate',
        estimatedCost: 5000, // Additional transaction fees
        estimatedTime: '15-30 minutes',
        prerequisites: ['Development resources'],
        risks: ['Logic complexity'],
        successRate: 80
      });
    }
    
    return actions;
  }

  private generateLongTermActions(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    if (errorClassification.isProgramError) {
      actions.push({
        action: 'Review and update program logic',
        description: 'Analyze program code for bugs and implement fixes',
        priority: 'medium',
        complexity: 'complex',
        estimatedCost: 0,
        estimatedTime: '1-7 days',
        prerequisites: ['Program upgrade authority', 'Development team'],
        risks: ['Breaking changes', 'Testing requirements'],
        successRate: 70
      });
    }
    
    return actions;
  }

  private calculateRequiredResources(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAnalysis['requiredResources'] {
    const baseFee = this.estimateTransactionFee(transaction);
    
    return {
      additionalFunds: errorClassification.primaryCategory === 'insufficient_funds' ? baseFee * 2 : 0,
      computeUnits: errorClassification.primaryCategory === 'compute_budget_exceeded' ? 200000 : 0,
      accountChanges: errorClassification.isDataRelated ? ['Account data updates required'] : [],
      timeRequired: this.estimateRecoveryTime(transaction)
    };
  }

  private calculateRecoverySuccessProbability(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): number {
    let probability = 50; // Base probability
    
    if (errorClassification.isTransient) probability += 30;
    if (!errorClassification.isDeterministic) probability += 20;
    if (errorClassification.isResourceRelated) probability += 10;
    if (errorClassification.isProgramError) probability -= 20;
    if (errorClassification.isSystemError) probability -= 10;
    
    return Math.max(0, Math.min(100, probability));
  }

  private identifyRecoveryRiskFactors(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): string[] {
    const risks: string[] = [];
    
    if (errorClassification.isProgramError) {
      risks.push('Program logic may have fundamental issues');
    }
    if (errorClassification.isResourceRelated) {
      risks.push('Resource constraints may persist');
    }
    if (errorClassification.isNetworkError) {
      risks.push('Network conditions may not improve');
    }
    
    return risks;
  }

  // Retry recommendation methods
  private determineRetryStrategy(errorClassification: ErrorClassification): RetryRecommendation['retryStrategy'] {
    if (!errorClassification.isTransient) {
      return 'not_recommended';
    }
    if (errorClassification.isResourceRelated) {
      return 'with_modifications';
    }
    if (errorClassification.isNetworkError) {
      return 'with_delay';
    }
    return 'immediate';
  }

  private determineRequiredChanges(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RequiredChange[] {
    const changes: RequiredChange[] = [];
    
    if (errorClassification.primaryCategory === 'insufficient_funds') {
      changes.push({
        type: 'increase_fee',
        description: 'Increase transaction fee to ensure processing',
        specificChange: 'Add 50% to current fee',
        impact: 'Higher cost but better success probability',
        cost: this.estimateTransactionFee(transaction) * 0.5
      });
    }
    
    if (errorClassification.primaryCategory === 'compute_budget_exceeded') {
      changes.push({
        type: 'increase_compute',
        description: 'Increase compute unit limit',
        specificChange: 'Set compute limit to 400,000 units',
        impact: 'Higher fee but allows transaction completion',
        cost: 2000
      });
    }
    
    if (errorClassification.primaryCategory === 'blockhash_not_found') {
      changes.push({
        type: 'update_blockhash',
        description: 'Use fresh blockhash',
        specificChange: 'Get recent blockhash from RPC',
        impact: 'Transaction will be accepted by network',
        cost: 0
      });
    }
    
    return changes;
  }

  private calculateRetryDelay(errorClassification: ErrorClassification): number {
    if (errorClassification.isNetworkError) {
      return 5000; // 5 seconds for network issues
    }
    if (errorClassification.primaryCategory === 'account_in_use') {
      return 2000; // 2 seconds for account locks
    }
    return 1000; // 1 second default
  }

  private calculateRetrySuccessProbability(errorClassification: ErrorClassification): number {
    if (!errorClassification.isTransient) {
      return 0;
    }
    
    let probability = 60; // Base retry probability
    
    if (errorClassification.primaryCategory === 'blockhash_not_found') probability = 95;
    if (errorClassification.primaryCategory === 'account_in_use') probability = 80;
    if (errorClassification.primaryCategory === 'insufficient_funds') probability = 90;
    if (errorClassification.isProgramError) probability = 20;
    
    return probability;
  }

  private generateRetryConditions(errorClassification: ErrorClassification): string[] {
    const conditions: string[] = [];
    
    if (errorClassification.primaryCategory === 'insufficient_funds') {
      conditions.push('Ensure account has sufficient balance');
    }
    if (errorClassification.primaryCategory === 'blockhash_not_found') {
      conditions.push('Use fresh blockhash');
    }
    if (errorClassification.primaryCategory === 'account_in_use') {
      conditions.push('Wait for account to be unlocked');
    }
    
    return conditions;
  }

  private generateMonitoringPoints(errorClassification: ErrorClassification): string[] {
    const points: string[] = [];
    
    points.push('Transaction confirmation status');
    points.push('Account balance changes');
    
    if (errorClassification.isResourceRelated) {
      points.push('Compute unit usage');
      points.push('Fee adequacy');
    }
    
    if (errorClassification.isNetworkError) {
      points.push('Network congestion levels');
      points.push('RPC response times');
    }
    
    return points;
  }

  // Calculation methods
  private calculateSeverity(analysis: TransactionFailureAnalysis): TransactionFailureAnalysis['severity'] {
    let severityScore = 0;
    
    // Impact factors
    if (analysis.impact.userImpact === 'severe') severityScore += 3;
    else if (analysis.impact.userImpact === 'moderate') severityScore += 2;
    else if (analysis.impact.userImpact === 'minor') severityScore += 1;
    
    if (analysis.impact.businessImpact === 'critical') severityScore += 3;
    else if (analysis.impact.businessImpact === 'high') severityScore += 2;
    else if (analysis.impact.businessImpact === 'medium') severityScore += 1;
    
    // Recovery factors
    if (!analysis.recovery.isRecoverable) severityScore += 2;
    if (analysis.recovery.recoveryComplexity === 'very_complex') severityScore += 2;
    else if (analysis.recovery.recoveryComplexity === 'complex') severityScore += 1;
    
    // Error type factors
    if (analysis.errorClassification.isProgramError) severityScore += 1;
    if (analysis.errorClassification.isSystemError) severityScore += 1;
    
    if (severityScore >= 7) return 'critical';
    if (severityScore >= 5) return 'high';
    if (severityScore >= 3) return 'medium';
    return 'low';
  }

  private calculateRecoverability(analysis: TransactionFailureAnalysis): TransactionFailureAnalysis['recoverability'] {
    if (!analysis.recovery.isRecoverable) {
      return 'impossible';
    }
    
    if (analysis.recovery.recoveryComplexity === 'simple' && analysis.recovery.successProbability > 80) {
      return 'immediate';
    }
    
    if (analysis.recovery.recoveryComplexity === 'moderate' || analysis.recovery.successProbability > 60) {
      return 'with_changes';
    }
    
    return 'difficult';
  }

  private calculateConfidence(analysis: TransactionFailureAnalysis): number {
    let confidence = 70; // Base confidence
    
    // Increase confidence for well-known error patterns
    if (analysis.errorClassification.primaryCategory !== 'unknown_error') {
      confidence += 20;
    }
    
    // Increase confidence if we have similar failures
    if (analysis.similarFailures.length > 0) {
      confidence += 10;
    }
    
    // Decrease confidence for complex scenarios
    if (analysis.rootCause.contributingFactors.length > 3) {
      confidence -= 10;
    }
    
    if (analysis.errorClassification.isProgramError) {
      confidence -= 5;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }

  // Utility methods
  private isComputeBudgetError(error: any): boolean {
    return error && typeof error === 'object' && 
           (error.ComputeBudgetExceeded || 
            (error.InstructionError && 
             typeof error.InstructionError[1] === 'object' && 
             error.InstructionError[1].ComputeBudgetExceeded));
  }

  private isInsufficientFundsError(error: any): boolean {
    return error && typeof error === 'object' && 
           (error.InsufficientFundsForFee || error.InsufficientFundsForRent);
  }

  private isTransientError(error: any): boolean {
    if (!error) return false;
    
    const transientErrors = [
      'BlockhashNotFound',
      'AccountInUse',
      'TooManyAccountLocks',
      'NetworkError',
      'RpcError'
    ];
    
    if (typeof error === 'object') {
      return transientErrors.some(transientError => error[transientError] !== undefined);
    }
    
    return false;
  }

  private requiresAccountChanges(error: any): boolean {
    if (!error) return false;
    
    const accountChangeErrors = [
      'InsufficientFundsForFee',
      'InsufficientFundsForRent',
      'AccountNotFound',
      'InvalidAccountData'
    ];
    
    if (typeof error === 'object') {
      return accountChangeErrors.some(changeError => error[changeError] !== undefined);
    }
    
    return false;
  }

  private requiresCodeChanges(error: any): boolean {
    if (!error) return false;
    
    return typeof error === 'object' && error.InstructionError;
  }

  private hasPartialExecution(transaction: DetailedTransactionInfo): boolean {
    // Check if any account balances changed despite the error
    const preBalances = transaction.details?.preBalances || [];
    const postBalances = transaction.details?.postBalances || [];
    
    for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
      if (preBalances[i] !== postBalances[i]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get configuration
   */
  getConfig(): FailureAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FailureAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear failure history cache
   */
  clearHistory(): void {
    this.failureHistory.clear();
  }
}

// Export utility functions
export const transactionFailureAnalyzer = new TransactionFailureAnalyzer();

export function createFailureAnalyzer(config?: Partial<FailureAnalyzerConfig>): TransactionFailureAnalyzer {
  return new TransactionFailureAnalyzer(config);
} === 0) {
        return { InsufficientFundsForFee: {} };
      }
      
      // If transaction has many instructions, it might be compute budget exceeded
      if (instructions.length > 10) {
        return { ComputeBudgetExceeded: {} };
      }
      
      // Default to insufficient funds for failed transactions
      return { InsufficientFundsForFee: {} };
    }
    
    return null;
  }

  // Helper method to estimate transaction fee
  private estimateTransactionFee(transaction: DetailedTransactionInfo): number {
    const instructions = transaction.details?.instructions || [];
    const accounts = transaction.details?.accounts || [];
    
    // Base fee (5000 lamports) + instruction fees
    const baseFee = 5000;
    const instructionFee = instructions.length * 1000;
    const accountFee = accounts.length * 100;
    
    return baseFee + instructionFee + accountFee;
  }

  // Placeholder methods - these would be implemented with full logic
  private determineFailurePoint(transaction: DetailedTransactionInfo): RootCauseAnalysis['failurePoint'] {
    return {
      instructionIndex: null,
      programId: null,
      accountIndex: null,
      specificOperation: null
    };
  }

  private analyzeContributingFactors(transaction: DetailedTransactionInfo): ContributingFactor[] {
    const factors: ContributingFactor[] = [];
    const instructions = transaction.details?.instructions || [];
    const accounts = transaction.details?.accounts || [];
    
    // Analyze instruction count
    if (instructions.length > 10) {
      factors.push({
        factor: 'High instruction count',
        description: `Transaction contains ${instructions.length} instructions, which may contribute to compute limit issues`,
        impact: 'moderate',
        category: 'resource'
      });
    }
    
    // Analyze account count
    if (accounts.length > 20) {
      factors.push({
        factor: 'High account count',
        description: `Transaction references ${accounts.length} accounts, which may impact processing`,
        impact: 'minor',
        category: 'resource'
      });
    }
    
    return factors;
  }

  private async analyzeAccountStateIssues(transaction: DetailedTransactionInfo): Promise<AccountStateIssue[]> {
    const issues: AccountStateIssue[] = [];
    const accounts = transaction.details?.accounts || [];
    
    // In a real implementation, this would check actual account states
    // For now, return mock issues based on transaction failure
    if (!transaction.success && accounts.length > 0) {
      issues.push({
        accountAddress: accounts[0].pubkey,
        issue: 'Insufficient balance',
        expectedState: 'Balance >= transaction fee',
        actualState: 'Balance < transaction fee',
        impact: 'Transaction cannot be processed'
      });
    }
    
    return issues;
  }

  private analyzeInstructionIssues(transaction: DetailedTransactionInfo): InstructionIssue[] {
    const issues: InstructionIssue[] = [];
    const instructions = transaction.details?.instructions || [];
    
    // Analyze each instruction for potential issues
    instructions.forEach((instruction, index) => {
      if ('programId' in instruction) {
        // Check for common problematic program IDs or patterns
        if (instruction.programId === 'unknown' || !instruction.programId) {
          issues.push({
            instructionIndex: index,
            programId: instruction.programId || 'unknown',
            issue: 'Unknown program',
            description: 'Instruction references an unknown or invalid program',
            suggestedFix: 'Verify program ID and ensure program is deployed'
          });
        }
      }
    });
    
    return issues;
  }

  private analyzeResourceIssues(transaction: DetailedTransactionInfo): ResourceIssue[] {
    return [];
  }

  private analyzeTimingIssues(transaction: DetailedTransactionInfo): TimingIssue[] {
    return [];
  }

  private buildFailureChain(transaction: DetailedTransactionInfo): FailureEvent[] {
    return [];
  }

  private determinePrimaryCause(error: any, contributingFactors: ContributingFactor[]): string {
    return 'Transaction failed';
  }

  private assessUserImpact(transaction: DetailedTransactionInfo): FailureImpact['userImpact'] {
    return 'minor';
  }

  private assessBusinessImpact(transaction: DetailedTransactionInfo): FailureImpact['businessImpact'] {
    return 'low';
  }

  private estimateRecoveryCost(transaction: DetailedTransactionInfo): number {
    return 5000;
  }

  private estimateRecoveryTime(transaction: DetailedTransactionInfo): string {
    return '5-10 minutes';
  }

  private async analyzeCascadingFailures(transaction: DetailedTransactionInfo): Promise<CascadingFailure[]> {
    return [];
  }

  private isRecoverable(errorClassification: ErrorClassification): boolean {
    return errorClassification.isTransient || !errorClassification.isDeterministic;
  }

  private assessRecoveryComplexity(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAnalysis['recoveryComplexity'] {
    return 'moderate';
  }

  private generateImmediateActions(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAction[] {
    return [];
  }

  private generateShortTermActions(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAction[] {
    return [];
  }

  private generateLongTermActions(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAction[] {
    return [];
  }

  private calculateRequiredResources(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RecoveryAnalysis['requiredResources'] {
    return {
      additionalFunds: 0,
      computeUnits: 0,
      accountChanges: [],
      timeRequired: '5 minutes'
    };
  }

  private calculateRecoverySuccessProbability(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): number {
    return 70;
  }

  private identifyRecoveryRiskFactors(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): string[] {
    return [];
  }

  private determineRetryStrategy(errorClassification: ErrorClassification): RetryRecommendation['retryStrategy'] {
    return errorClassification.isTransient ? 'with_delay' : 'not_recommended';
  }

  private determineRequiredChanges(transaction: DetailedTransactionInfo, errorClassification: ErrorClassification): RequiredChange[] {
    return [];
  }

  private calculateRetryDelay(errorClassification: ErrorClassification): number {
    return 1000;
  }

  private calculateRetrySuccessProbability(errorClassification: ErrorClassification): number {
    return errorClassification.isTransient ? 70 : 0;
  }

  private generateRetryConditions(errorClassification: ErrorClassification): string[] {
    return [];
  }

  private generateMonitoringPoints(errorClassification: ErrorClassification): string[] {
    return ['Transaction confirmation status'];
  }

  private calculateSeverity(analysis: TransactionFailureAnalysis): TransactionFailureAnalysis['severity'] {
    return 'medium';
  }

  private calculateRecoverability(analysis: TransactionFailureAnalysis): TransactionFailureAnalysis['recoverability'] {
    return 'with_changes';
  }

  private calculateConfidence(analysis: TransactionFailureAnalysis): number {
    return 75;
  }

  private hasPartialExecution(transaction: DetailedTransactionInfo): boolean {
    return false;
  }

  /**
   * Get configuration
   */
  getConfig(): FailureAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FailureAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear failure history cache
   */
  clearHistory(): void {
    this.failureHistory.clear();
  }
}

// Export utility functions
export const transactionFailureAnalyzer = new TransactionFailureAnalyzer();

export function createFailureAnalyzer(config?: Partial<FailureAnalyzerConfig>): TransactionFailureAnalyzer {
  return new TransactionFailureAnalyzer(config);
}