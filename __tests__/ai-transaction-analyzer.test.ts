import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { aiTransactionAnalyzer } from '../lib/ai-transaction-analyzer';
import type { 
  TransactionExplanation, 
  AIAnalysisContext 
} from '../lib/ai-transaction-analyzer';
import type { DetailedTransactionInfo } from '../lib/solana';

// Mock dependencies
jest.mock('../lib/account-changes-analyzer', () => ({
  accountChangesAnalyzer: {
    analyzeTransaction: jest.fn(() => Promise.resolve({
      totalAccounts: 4,
      changedAccounts: 2,
      solChanges: {
        totalSolChange: -5000,
        positiveChanges: 1,
        negativeChanges: 1,
        largestIncrease: null,
        largestDecrease: null
      },
      tokenChanges: {
        totalTokensAffected: 2,
        uniqueTokens: ['token_mint_1'],
        significantChanges: []
      },
      dataChanges: {
        accountsWithDataChanges: 0,
        significantDataChanges: []
      },
      ownershipChanges: {
        accountsWithOwnershipChanges: 0,
        ownershipTransfers: []
      },
      riskAssessment: {
        level: 'low' as const,
        factors: [],
        recommendations: ['Standard transaction']
      }
    }))
  }
}));

jest.mock('../lib/instruction-parser-service', () => ({
  instructionParserService: {
    parseInstruction: jest.fn(() => Promise.resolve({
      programId: '11111111111111111111111111111111',
      programName: 'System Program',
      instructionType: 'transfer',
      description: 'Transfer 0.5 SOL',
      category: 'system',
      accounts: [],
      parameters: [],
      riskLevel: 'low'
    }))
  }
}));

jest.mock('../lib/defi-transaction-analyzer', () => ({
  defiTransactionAnalyzer: {
    analyzeDeFiTransaction: jest.fn(() => Promise.resolve({
      isDefi: false,
      protocols: [],
      actions: [],
      riskAssessment: {
        overallRisk: 'low',
        riskScore: 2,
        protocolRisks: []
      },
      financialImpact: {
        totalValueIn: 0,
        totalValueOut: 0,
        netValue: 0
      },
      recommendations: []
    }))
  }
}));

jest.mock('../lib/transaction-analysis-cache', () => ({
  transactionAnalysisCache: {
    getCachedAIExplanation: jest.fn(() => Promise.resolve(null)),
    cacheAIExplanation: jest.fn(() => Promise.resolve())
  }
}));

// Mock fetch for AI service calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AITransactionAnalyzer', () => {
  let mockTransaction: DetailedTransactionInfo;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransaction = {
      signature: 'test-signature-ai-123',
      slot: 123456789,
      blockTime: Date.now(),
      success: true,
      details: {
        accounts: [
          { pubkey: 'account1', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'account2', executable: false, owner: '11111111111111111111111111111111' }
        ],
        instructions: [
          {
            program: 'System Program',
            programId: '11111111111111111111111111111111',
            instructionType: 'transfer',
            accounts: ['account1', 'account2'],
            data: '00000002'
          }
        ],
        preBalances: [2000000000, 1000000000],
        postBalances: [1500000000, 1495000000]
      }
    };

    // Setup default successful AI response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: JSON.stringify({
          summary: 'Transfer 0.5 SOL from account1 to account2',
          mainAction: {
            type: 'transfer',
            description: 'SOL transfer between two accounts',
            participants: ['account1', 'account2'],
            amounts: [{ token: 'SOL', amount: '0.5', usdValue: 75 }]
          },
          secondaryEffects: [
            {
              type: 'fee_payment',
              description: 'Transaction fees were paid',
              significance: 'low'
            }
          ],
          riskAssessment: {
            level: 'low',
            score: 2,
            factors: ['Standard SOL transfer'],
            recommendations: ['Verify recipient address']
          },
          technicalDetails: {
            programsUsed: ['System Program'],
            instructionCount: 1,
            accountsAffected: 2,
            fees: {
              total: 5000,
              breakdown: [{ type: 'transaction', amount: 5000 }]
            }
          },
          confidence: 0.95
        })
      })
    });
  });

  describe('analyzeTransaction', () => {
    it('should generate comprehensive AI explanation for a transaction', async () => {
      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.summary).toContain('Transfer');
      expect(explanation.mainAction.type).toBe('transfer');
      expect(explanation.mainAction.participants).toContain('account1');
      expect(explanation.mainAction.participants).toContain('account2');
      expect(explanation.secondaryEffects).toHaveLength(1);
      expect(explanation.riskAssessment.level).toBe('low');
      expect(explanation.technicalDetails.programsUsed).toContain('System Program');
      expect(explanation.confidence).toBeGreaterThan(0.9);
      expect(explanation.generatedAt).toBeDefined();
    });

    it('should handle AI service failures gracefully with fallback', async () => {
      mockFetch.mockRejectedValue(new Error('AI service unavailable'));

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.summary).toContain('Transaction with');
      expect(explanation.mainAction.type).toBe('unknown');
      expect(explanation.confidence).toBeLessThan(0.5); // Low confidence for fallback
      expect(explanation.riskAssessment).toBeDefined();
    });

    it('should retry AI service calls on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              summary: 'Successful after retries',
              mainAction: { type: 'transfer', description: 'Test', participants: [], amounts: [] },
              secondaryEffects: [],
              riskAssessment: { level: 'low', score: 1, factors: [], recommendations: [] },
              technicalDetails: { programsUsed: [], instructionCount: 1, accountsAffected: 2, fees: { total: 5000, breakdown: [] } },
              confidence: 0.8
            })
          })
        });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation.summary).toBe('Successful after retries');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial call + 2 retries
    });

    it('should handle malformed AI responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: 'Invalid JSON response'
        })
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.confidence).toBeLessThan(0.5); // Should fall back to low confidence
      expect(explanation.mainAction.type).toBe('unknown');
    });

    it('should handle AI service timeout', async () => {
      jest.useFakeTimers();
      
      mockFetch.mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ response: '{}' })
          }), 35000); // Longer than timeout
        })
      );

      const analysisPromise = aiTransactionAnalyzer.analyzeTransaction(mockTransaction);
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(35000);
      
      const explanation = await analysisPromise;

      expect(explanation).toBeDefined();
      expect(explanation.confidence).toBeLessThan(0.5); // Fallback due to timeout
      
      jest.useRealTimers();
    });

    it('should use different detail levels correctly', async () => {
      const basicExplanation = await aiTransactionAnalyzer.analyzeTransaction(
        mockTransaction,
        { detailLevel: 'basic' }
      );

      const technicalExplanation = await aiTransactionAnalyzer.analyzeTransaction(
        mockTransaction,
        { detailLevel: 'technical' }
      );

      expect(basicExplanation).toBeDefined();
      expect(technicalExplanation).toBeDefined();
      
      // Both should have the same structure but potentially different content
      expect(basicExplanation.technicalDetails).toBeDefined();
      expect(technicalExplanation.technicalDetails).toBeDefined();
    });

    it('should focus on specified areas when provided', async () => {
      const explanation = await aiTransactionAnalyzer.analyzeTransaction(
        mockTransaction,
        { focusAreas: ['security', 'fees'] }
      );

      expect(explanation).toBeDefined();
      expect(explanation.riskAssessment).toBeDefined();
      expect(explanation.technicalDetails.fees).toBeDefined();
    });
  });

  describe('DeFi transaction enhancement', () => {
    it('should enhance explanation with DeFi analysis when applicable', async () => {
      const { defiTransactionAnalyzer } = require('../lib/defi-transaction-analyzer');
      defiTransactionAnalyzer.analyzeDeFiTransaction.mockResolvedValueOnce({
        isDefi: true,
        protocols: [{ name: 'Jupiter', category: 'dex' }],
        actions: [{ type: 'token_swap', protocol: { name: 'Jupiter' } }],
        riskAssessment: {
          overallRisk: 'medium',
          riskScore: 5,
          protocolRisks: ['Slippage risk']
        },
        financialImpact: {
          totalValueIn: 1000,
          totalValueOut: 950,
          netValue: -50
        },
        yieldAnalysis: {
          currentApr: 12.5,
          projectedReturns: { yearly: 125 }
        },
        recommendations: ['Check slippage tolerance']
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation.defiAnalysis).toBeDefined();
      expect(explanation.defiAnalysis?.isDefi).toBe(true);
      expect(explanation.summary).toContain('Jupiter');
      expect(explanation.secondaryEffects.some(effect => 
        effect.type === 'defi_interaction'
      )).toBe(true);
      expect(explanation.riskAssessment.level).toBe('medium'); // Enhanced by DeFi risk
    });

    it('should add financial impact information for DeFi transactions', async () => {
      const { defiTransactionAnalyzer } = require('../lib/defi-transaction-analyzer');
      defiTransactionAnalyzer.analyzeDeFiTransaction.mockResolvedValueOnce({
        isDefi: true,
        protocols: [{ name: 'Raydium' }],
        actions: [],
        riskAssessment: { overallRisk: 'low', riskScore: 2, protocolRisks: [] },
        financialImpact: {
          totalValueIn: 5000,
          totalValueOut: 4950,
          netValue: -50
        },
        recommendations: []
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      const financialEffect = explanation.secondaryEffects.find(effect => 
        effect.type === 'financial_impact'
      );
      expect(financialEffect).toBeDefined();
      expect(financialEffect?.description).toContain('5,000');
      expect(financialEffect?.description).toContain('4,950');
      expect(financialEffect?.description).toContain('loss');
    });

    it('should add yield information when available', async () => {
      const { defiTransactionAnalyzer } = require('../lib/defi-transaction-analyzer');
      defiTransactionAnalyzer.analyzeDeFiTransaction.mockResolvedValueOnce({
        isDefi: true,
        protocols: [{ name: 'Solend' }],
        actions: [],
        riskAssessment: { overallRisk: 'low', riskScore: 2, protocolRisks: [] },
        financialImpact: { totalValueIn: 0, totalValueOut: 0, netValue: 0 },
        yieldAnalysis: {
          currentApr: 8.5,
          projectedReturns: { yearly: 850 }
        },
        recommendations: []
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      const yieldEffect = explanation.secondaryEffects.find(effect => 
        effect.type === 'yield_opportunity'
      );
      expect(yieldEffect).toBeDefined();
      expect(yieldEffect?.description).toContain('8.50%');
      expect(yieldEffect?.description).toContain('850.00');
    });
  });

  describe('risk assessment enhancement', () => {
    it('should enhance risk assessment with high-risk warnings', async () => {
      const { accountChangesAnalyzer } = require('../lib/account-changes-analyzer');
      accountChangesAnalyzer.analyzeTransaction.mockResolvedValueOnce({
        totalAccounts: 4,
        changedAccounts: 2,
        solChanges: { totalSolChange: -50000000000, positiveChanges: 0, negativeChanges: 1, largestIncrease: null, largestDecrease: null },
        tokenChanges: { totalTokensAffected: 0, uniqueTokens: [], significantChanges: [] },
        dataChanges: { accountsWithDataChanges: 0, significantDataChanges: [] },
        ownershipChanges: { accountsWithOwnershipChanges: 0, ownershipTransfers: [] },
        riskAssessment: {
          level: 'high' as const,
          factors: ['Extremely large SOL transfer'],
          recommendations: ['Verify transaction carefully']
        }
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation.riskAssessment.level).toBe('high');
      expect(explanation.riskAssessment.recommendations[0]).toContain('high-risk transaction');
    });

    it('should provide security warnings for suspicious patterns', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: JSON.stringify({
            summary: 'Suspicious transaction pattern detected',
            mainAction: { type: 'unknown', description: 'Unknown operation', participants: [], amounts: [] },
            secondaryEffects: [],
            riskAssessment: {
              level: 'high',
              score: 9,
              factors: ['Unknown program interaction', 'Large value transfer'],
              recommendations: ['Do not proceed without verification']
            },
            technicalDetails: { programsUsed: ['UnknownProgram'], instructionCount: 1, accountsAffected: 2, fees: { total: 5000, breakdown: [] } },
            confidence: 0.6
          })
        })
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation.riskAssessment.level).toBe('high');
      expect(explanation.riskAssessment.factors).toContain('Unknown program interaction');
      expect(explanation.riskAssessment.recommendations).toContain('Do not proceed without verification');
    });
  });

  describe('caching behavior', () => {
    it('should use cached explanations when available', async () => {
      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      
      const cachedExplanation: TransactionExplanation = {
        summary: 'Cached explanation',
        mainAction: { type: 'transfer', description: 'Cached transfer', participants: [], amounts: [] },
        secondaryEffects: [],
        riskAssessment: { level: 'low', score: 1, factors: [], recommendations: [] },
        technicalDetails: { programsUsed: [], instructionCount: 1, accountsAffected: 2, fees: { total: 5000, breakdown: [] } },
        confidence: 0.9,
        generatedAt: Date.now()
      };

      transactionAnalysisCache.getCachedAIExplanation.mockResolvedValueOnce(cachedExplanation);

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation).toEqual(cachedExplanation);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(transactionAnalysisCache.cacheAIExplanation).not.toHaveBeenCalled();
    });

    it('should cache new explanations', async () => {
      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      expect(transactionAnalysisCache.cacheAIExplanation).toHaveBeenCalledWith(
        mockTransaction.signature,
        explanation,
        undefined
      );
    });

    it('should cache explanations with options', async () => {
      const options = { detailLevel: 'technical' as const, focusAreas: ['security'] };
      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction, options);

      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      expect(transactionAnalysisCache.cacheAIExplanation).toHaveBeenCalledWith(
        mockTransaction.signature,
        explanation,
        options
      );
    });
  });

  describe('prompt generation', () => {
    it('should generate comprehensive analysis prompts', async () => {
      // Mock the AI service to capture the prompt
      let capturedPrompt = '';
      mockFetch.mockImplementation(async (url, options) => {
        const body = JSON.parse(options.body);
        capturedPrompt = body.message;
        return {
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              summary: 'Test response',
              mainAction: { type: 'transfer', description: 'Test', participants: [], amounts: [] },
              secondaryEffects: [],
              riskAssessment: { level: 'low', score: 1, factors: [], recommendations: [] },
              technicalDetails: { programsUsed: [], instructionCount: 1, accountsAffected: 2, fees: { total: 5000, breakdown: [] } },
              confidence: 0.8
            })
          })
        };
      });

      await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(capturedPrompt).toContain('TRANSACTION OVERVIEW');
      expect(capturedPrompt).toContain('INSTRUCTIONS');
      expect(capturedPrompt).toContain('ACCOUNT CHANGES');
      expect(capturedPrompt).toContain('RISK FACTORS');
      expect(capturedPrompt).toContain(mockTransaction.signature);
    });
  });

  describe('utility functions', () => {
    it('should format confidence levels correctly', () => {
      const { formatConfidenceLevel } = require('../lib/ai-transaction-analyzer');
      
      expect(formatConfidenceLevel(0.95)).toBe('Very High');
      expect(formatConfidenceLevel(0.8)).toBe('High');
      expect(formatConfidenceLevel(0.6)).toBe('Medium');
      expect(formatConfidenceLevel(0.4)).toBe('Low');
      expect(formatConfidenceLevel(0.2)).toBe('Very Low');
    });

    it('should provide appropriate action type icons', () => {
      const { getActionTypeIcon } = require('../lib/ai-transaction-analyzer');
      
      expect(getActionTypeIcon('transfer')).toBe('💸');
      expect(getActionTypeIcon('swap')).toBe('🔄');
      expect(getActionTypeIcon('mint')).toBe('🪙');
      expect(getActionTypeIcon('burn')).toBe('🔥');
      expect(getActionTypeIcon('unknown')).toBe('❓');
    });

    it('should provide appropriate risk level colors', () => {
      const { getRiskLevelColor } = require('../lib/ai-transaction-analyzer');
      
      expect(getRiskLevelColor('low')).toContain('green');
      expect(getRiskLevelColor('medium')).toContain('yellow');
      expect(getRiskLevelColor('high')).toContain('red');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle transactions with no instructions', async () => {
      const noInstructionsTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          instructions: []
        }
      };

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(noInstructionsTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.technicalDetails.instructionCount).toBe(0);
      expect(explanation.confidence).toBeLessThan(0.9); // Lower confidence for unusual transactions
    });

    it('should handle transactions with missing block time', async () => {
      const noBlockTimeTransaction = {
        ...mockTransaction,
        blockTime: null
      };

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(noBlockTimeTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.summary).toBeDefined();
    });

    it('should handle AI service returning non-200 status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.confidence).toBeLessThan(0.5); // Should fall back
      expect(explanation.mainAction.type).toBe('unknown');
    });

    it('should handle partial AI responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: JSON.stringify({
            summary: 'Partial response',
            // Missing other required fields
          })
        })
      });

      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);

      expect(explanation).toBeDefined();
      expect(explanation.summary).toBe('Partial response');
      expect(explanation.mainAction.type).toBe('unknown'); // Should use defaults
      expect(explanation.riskAssessment).toBeDefined();
    });
  });

  describe('performance considerations', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      const explanation = await aiTransactionAnalyzer.analyzeTransaction(mockTransaction);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(explanation).toBeDefined();
    });

    it('should handle concurrent analysis requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        aiTransactionAnalyzer.analyzeTransaction({
          ...mockTransaction,
          signature: `concurrent-test-${i}`
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
      });
    });
  });
});