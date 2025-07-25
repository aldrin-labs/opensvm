import { TransactionFailureAnalyzer, createFailureAnalyzer } from '@/lib/transaction-failure-analyzer';
import type { DetailedTransactionInfo } from '@/lib/solana';

// Mock transaction data for testing
const mockFailedTransaction: DetailedTransactionInfo = {
  signature: 'test-failed-signature',
  slot: 123456789,
  blockTime: Date.now(),
  meta: {
    err: {
      InsufficientFundsForFee: {}
    },
    fee: 5000,
    preBalances: [1000000, 2000000],
    postBalances: [1000000, 2000000], // No change due to failure
    preTokenBalances: [],
    postTokenBalances: [],
    logMessages: [],
    innerInstructions: [],
    computeUnitsConsumed: 0
  },
  transaction: {
    message: {
      accountKeys: ['account1', 'account2'],
      instructions: [
        {
          programIdIndex: 0,
          accounts: [0, 1],
          data: 'test-instruction-data'
        }
      ],
      recentBlockhash: 'test-blockhash'
    },
    signatures: ['test-signature']
  }
};

const mockSuccessfulTransaction: DetailedTransactionInfo = {
  ...mockFailedTransaction,
  signature: 'test-success-signature',
  meta: {
    ...mockFailedTransaction.meta!,
    err: null
  }
};

describe('TransactionFailureAnalyzer', () => {
  let analyzer: TransactionFailureAnalyzer;

  beforeEach(() => {
    analyzer = new TransactionFailureAnalyzer();
  });

  describe('analyzeFailure', () => {
    it('should identify a failed transaction correctly', async () => {
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

      expect(analysis.signature).toBe('test-failed-signature');
      expect(analysis.isFailure).toBe(true);
      expect(analysis.errorClassification.primaryCategory).toBe('insufficient_funds');
      expect(analysis.errorClassification.userFriendlyDescription).toContain('not have enough SOL');
    });

    it('should handle successful transactions', async () => {
      const analysis = await analyzer.analyzeFailure(mockSuccessfulTransaction);

      expect(analysis.signature).toBe('test-success-signature');
      expect(analysis.isFailure).toBe(false);
      expect(analysis.severity).toBe('low');
      expect(analysis.recoverability).toBe('immediate');
      expect(analysis.confidence).toBe(100);
    });

    it('should classify insufficient funds error correctly', async () => {
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

      expect(analysis.errorClassification.primaryCategory).toBe('insufficient_funds');
      expect(analysis.errorClassification.isResourceRelated).toBe(true);
      expect(analysis.errorClassification.isUserError).toBe(true);
      expect(analysis.errorClassification.isTransient).toBe(false);
      expect(analysis.errorClassification.isDeterministic).toBe(true);
    });

    it('should provide recovery recommendations for insufficient funds', async () => {
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

      expect(analysis.recovery.isRecoverable).toBe(true);
      expect(analysis.retryRecommendations).toHaveLength(1);
      expect(analysis.retryRecommendations[0].shouldRetry).toBe(false); // Insufficient funds is not transient
    });

    it('should generate prevention strategies', async () => {
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

      expect(analysis.prevention).toHaveLength(1);
      expect(analysis.prevention[0].strategy).toBe('Pre-flight Balance Check');
      expect(analysis.prevention[0].effectiveness).toBe(95);
      expect(analysis.prevention[0].cost).toBe('free');
    });

    it('should calculate impact correctly', async () => {
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

      expect(analysis.impact.feesLost).toBe(5000);
      expect(analysis.impact.transactionFailed).toBe(true);
      expect(analysis.impact.userImpact).toBe('minor'); // Based on fee amount
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = analyzer.getConfig();

      expect(config.includeHistoricalData).toBe(true);
      expect(config.includeSimilarFailures).toBe(true);
      expect(config.maxSimilarFailures).toBe(5);
      expect(config.confidenceThreshold).toBe(70);
      expect(config.deepAnalysis).toBe(true);
    });

    it('should allow configuration updates', () => {
      analyzer.updateConfig({
        maxSimilarFailures: 10,
        confidenceThreshold: 80
      });

      const config = analyzer.getConfig();
      expect(config.maxSimilarFailures).toBe(10);
      expect(config.confidenceThreshold).toBe(80);
      expect(config.includeHistoricalData).toBe(true); // Should preserve other settings
    });

    it('should create analyzer with custom configuration', () => {
      const customAnalyzer = createFailureAnalyzer({
        deepAnalysis: false,
        includePreventionStrategies: false,
        thresholds: {
          highImpactFee: 50000,
          criticalComputeUsage: 95,
          maxRetryAttempts: 5
        }
      });

      const config = customAnalyzer.getConfig();
      expect(config.deepAnalysis).toBe(false);
      expect(config.includePreventionStrategies).toBe(false);
      expect(config.thresholds.highImpactFee).toBe(50000);
      expect(config.thresholds.maxRetryAttempts).toBe(5);
    });
  });

  describe('error pattern matching', () => {
    it('should handle blockhash not found error', async () => {
      const blockhashErrorTx: DetailedTransactionInfo = {
        ...mockFailedTransaction,
        meta: {
          ...mockFailedTransaction.meta!,
          err: { BlockhashNotFound: {} }
        }
      };

      const analysis = await analyzer.analyzeFailure(blockhashErrorTx);

      expect(analysis.errorClassification.primaryCategory).toBe('blockhash_not_found');
      expect(analysis.errorClassification.isTransient).toBe(true);
      expect(analysis.errorClassification.isDeterministic).toBe(false);
      expect(analysis.retryRecommendations[0].shouldRetry).toBe(true);
    });

    it('should handle compute budget exceeded error', async () => {
      const computeErrorTx: DetailedTransactionInfo = {
        ...mockFailedTransaction,
        meta: {
          ...mockFailedTransaction.meta!,
          err: { ComputeBudgetExceeded: {} }
        }
      };

      const analysis = await analyzer.analyzeFailure(computeErrorTx);

      expect(analysis.errorClassification.primaryCategory).toBe('compute_budget_exceeded');
      expect(analysis.errorClassification.isResourceRelated).toBe(true);
      expect(analysis.prevention).toContainEqual(
        expect.objectContaining({
          strategy: 'Compute Budget Management'
        })
      );
    });

    it('should handle unknown errors gracefully', async () => {
      const unknownErrorTx: DetailedTransactionInfo = {
        ...mockFailedTransaction,
        meta: {
          ...mockFailedTransaction.meta!,
          err: { UnknownCustomError: { code: 42 } }
        }
      };

      const analysis = await analyzer.analyzeFailure(unknownErrorTx);

      expect(analysis.errorClassification.primaryCategory).toBe('unknown_error');
      expect(analysis.errorClassification.isSystemError).toBe(true);
      expect(analysis.confidence).toBeLessThan(90); // Should have lower confidence for unknown errors
    });
  });

  describe('cache management', () => {
    it('should cache analysis results', async () => {
      const analysis1 = await analyzer.analyzeFailure(mockFailedTransaction);
      const analysis2 = await analyzer.analyzeFailure(mockFailedTransaction);

      expect(analysis1).toEqual(analysis2);
    });

    it('should clear cache when requested', async () => {
      await analyzer.analyzeFailure(mockFailedTransaction);
      analyzer.clearHistory();

      // After clearing, should still work but might have different timestamps
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);
      expect(analysis.signature).toBe('test-failed-signature');
    });
  });

  describe('severity and recoverability calculation', () => {
    it('should calculate severity based on multiple factors', async () => {
      const highImpactTx: DetailedTransactionInfo = {
        ...mockFailedTransaction,
        meta: {
          ...mockFailedTransaction.meta!,
          fee: 200000 // High fee
        }
      };

      const analysis = await analyzer.analyzeFailure(highImpactTx);
      
      // Should consider high fee in severity calculation
      expect(['medium', 'high', 'critical']).toContain(analysis.severity);
    });

    it('should determine recoverability correctly', async () => {
      const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

      // Insufficient funds should be recoverable with changes
      expect(analysis.recoverability).toBe('with_changes');
      expect(analysis.recovery.isRecoverable).toBe(true);
    });
  });
});

describe('Error Classification', () => {
  let analyzer: TransactionFailureAnalyzer;

  beforeEach(() => {
    analyzer = new TransactionFailureAnalyzer();
  });

  it('should classify instruction errors correctly', async () => {
    const instructionErrorTx: DetailedTransactionInfo = {
      ...mockFailedTransaction,
      meta: {
        ...mockFailedTransaction.meta!,
        err: {
          InstructionError: [0, { Custom: 42 }]
        }
      }
    };

    const analysis = await analyzer.analyzeFailure(instructionErrorTx);

    expect(analysis.errorClassification.errorCode).toBe('InstructionError:0');
    expect(analysis.errorClassification.errorMessage).toContain('Custom');
  });

  it('should handle string errors', async () => {
    const stringErrorTx: DetailedTransactionInfo = {
      ...mockFailedTransaction,
      meta: {
        ...mockFailedTransaction.meta!,
        err: 'Simple string error'
      }
    };

    const analysis = await analyzer.analyzeFailure(stringErrorTx);

    expect(analysis.errorClassification.errorCode).toBeNull();
    expect(analysis.errorClassification.errorMessage).toBe('Simple string error');
  });
});

describe('Integration Tests', () => {
  it('should provide comprehensive analysis for a typical failed transaction', async () => {
    const analyzer = createFailureAnalyzer({
      solPriceUSD: 150,
      networkConditions: 'congested'
    });

    const analysis = await analyzer.analyzeFailure(mockFailedTransaction);

    // Should have all required sections
    expect(analysis.errorClassification).toBeDefined();
    expect(analysis.rootCause).toBeDefined();
    expect(analysis.impact).toBeDefined();
    expect(analysis.recovery).toBeDefined();
    expect(analysis.prevention).toBeDefined();
    expect(analysis.retryRecommendations).toBeDefined();
    expect(analysis.similarFailures).toBeDefined();

    // Should calculate USD values
    expect(analysis.impact.feesLostUSD).toBeCloseTo(0.00075, 5); // 5000 lamports at $150/SOL

    // Should have reasonable confidence
    expect(analysis.confidence).toBeGreaterThan(50);
    expect(analysis.confidence).toBeLessThanOrEqual(100);

    // Should provide actionable recommendations
    expect(analysis.prevention.length).toBeGreaterThan(0);
    expect(analysis.recovery.immediateActions).toBeDefined();
  });
});