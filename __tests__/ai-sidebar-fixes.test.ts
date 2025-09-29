/**
 * Integration Tests for AI Sidebar Critical Fixes
 * 
 * Tests all four major issues that were affecting 83% of queries:
 * 1. Execution Plan Deadlock
 * 2. Query Misrouting  
 * 3. Tool Execution Failures
 * 4. Account Parameter Issues
 */

import { jest } from '@jest/globals';
import { classifyQuery, shouldBypassPlanning, QueryType } from '@/lib/ai/query-classifier';
import { 
  executionMonitor, 
  monitorExecution, 
  markPlanGenerated, 
  markPlanExecuting, 
  markPlanCompleted,
  isExecutionStuck 
} from '@/lib/ai/execution-monitor';
import { 
  validateAccountAddress, 
  validateTransactionSignature, 
  extractSolanaData,
  validateAccountAnalysisParams 
} from '@/lib/ai/parameter-validator';

describe('AI Sidebar Critical Fixes Integration Tests', () => {
  
  describe('Phase 1: Execution Plan Deadlock Fixes', () => {
    
    test('Query Classifier - should correctly identify direct RPC queries', () => {
      const directQueries = [
        'What is the current TPS?',
        'current solana tps',
        'network performance',
        'what is current epoch',
        'validator count',
        'recent blocks'
      ];

      directQueries.forEach(query => {
        const classification = classifyQuery(query);
        expect(classification.type).toBe(QueryType.DIRECT_RPC);
        expect(classification.confidence).toBeGreaterThan(0.8);
        expect(shouldBypassPlanning(query)).toBe(true);
      });
    });

    test('Query Classifier - should correctly identify knowledge-based queries', () => {
      const knowledgeQueries = [
        'What is Solana?',
        'How does DeFi work?',
        'What are NFTs?',
        'explain blockchain technology',
        'what is proof of stake'
      ];

      knowledgeQueries.forEach(query => {
        const classification = classifyQuery(query);
        expect(classification.type).toBe(QueryType.KNOWLEDGE_BASED);
        expect(classification.confidence).toBeGreaterThan(0.8);
        expect(shouldBypassPlanning(query)).toBe(true);
      });
    });

    test('Query Classifier - should correctly identify complex analysis queries', () => {
      const analysisQueries = [
        'analyze account 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        'transaction analysis 5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU',
        'portfolio breakdown for DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq',
        'token analysis SVMAI',
        'detailed account info'
      ];

      analysisQueries.forEach(query => {
        const classification = classifyQuery(query);
        expect(classification.type).toBe(QueryType.COMPLEX_ANALYSIS);
        expect(classification.requiresPlan).toBe(true);
        expect(shouldBypassPlanning(query)).toBe(false);
      });
    });

    test('Execution Monitor - should track execution states correctly', () => {
      const planId = 'test-plan-123';
      
      // Start monitoring
      const state = monitorExecution(planId, 10000);
      expect(state.planId).toBe(planId);
      expect(state.planGenerated).toBe(false);
      expect(state.planExecuting).toBe(false);
      expect(state.planCompleted).toBe(false);

      // Mark plan generated
      markPlanGenerated(planId);
      const updatedState = executionMonitor.getExecutionState(planId);
      expect(updatedState?.planGenerated).toBe(true);

      // Mark plan executing
      markPlanExecuting(planId);
      const executingState = executionMonitor.getExecutionState(planId);
      expect(executingState?.planExecuting).toBe(true);

      // Complete plan
      markPlanCompleted(planId, { result: 'success' });
      const completedState = executionMonitor.getExecutionState(planId);
      expect(completedState?.planCompleted).toBe(true);
      expect(completedState?.partialData).toEqual({ result: 'success' });
    });

    test('Execution Monitor - should detect stuck executions', async () => {
      const planId = 'stuck-plan-456';
      
      // Start execution
      monitorExecution(planId, 1000); // 1 second timeout for testing
      
      // Mark plan generated but don't execute
      markPlanGenerated(planId);
      
      // Wait for stuck detection
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Should be detected as stuck
      expect(isExecutionStuck(planId)).toBe(true);
      
      const stuckExecutions = executionMonitor.getStuckExecutions();
      expect(stuckExecutions.some(e => e.planId === planId)).toBe(true);
    });

  });

  describe('Phase 2: Query Routing Improvements', () => {
    
    test('Should handle Solana address detection', () => {
      const testCases = [
        {
          query: 'analyze 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          expectedAddresses: ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU']
        },
        {
          query: 'compare wallets DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq and 8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6',
          expectedAddresses: ['DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq', '8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6']
        }
      ];

      testCases.forEach(({ query, expectedAddresses }) => {
        const classification = classifyQuery(query);
        expect(classification.type).toBe(QueryType.COMPLEX_ANALYSIS);
        
        const solanaData = extractSolanaData(query);
        expect(solanaData.addresses.map(a => a.normalized)).toEqual(expectedAddresses);
      });
    });

    test('Should handle transaction signature detection', () => {
      const testCases = [
        {
          query: 'explain transaction 5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU',
          expectedSignatures: ['5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU']
        }
      ];

      testCases.forEach(({ query, expectedSignatures }) => {
        const classification = classifyQuery(query);
        expect(classification.type).toBe(QueryType.COMPLEX_ANALYSIS);
        
        const solanaData = extractSolanaData(query);
        expect(solanaData.signatures.map(s => s.normalized)).toEqual(expectedSignatures);
      });
    });

  });

  describe('Phase 3: Tool Execution Pipeline Fixes', () => {
    
    test('Parameter Validator - should validate Solana addresses correctly', () => {
      const validAddresses = [
        'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq',
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      ];

      validAddresses.forEach(address => {
        const result = validateAccountAddress(address);
        expect(result.valid).toBe(true);
        expect(result.normalized).toBe(address);
        expect(result.type).toBe('address');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    test('Parameter Validator - should reject invalid addresses', () => {
      const invalidAddresses = [
        '',
        'invalid',
        '123',
        'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq123', // too long
        'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRq0' // invalid character
      ];

      invalidAddresses.forEach(address => {
        const result = validateAccountAddress(address);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('Parameter Validator - should validate transaction signatures correctly', () => {
      const validSignatures = [
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU',
        '3x1KQqvqKPVXK8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8k8'
      ];

      validSignatures.forEach(signature => {
        const result = validateTransactionSignature(signature);
        expect(result.valid).toBe(true);
        expect(result.normalized).toBe(signature);
        expect(result.type).toBe('signature');
      });
    });

    test('Parameter Validator - should validate account analysis parameters', () => {
      const testParams = {
        account: 'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq',
        limit: 50
      };

      const result = validateAccountAnalysisParams(testParams);
      expect(result.valid).toBe(true);
      expect(result.normalized.account).toBe(testParams.account);
      expect(result.normalized.limit).toBe(50);
      expect(result.errors.length).toBe(0);
    });

  });

  describe('Phase 4: Account Analysis Fixes', () => {
    
    test('Should extract Solana data from complex queries', () => {
      const complexQuery = 'Compare wallets DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq and 8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6 with transaction 5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU';
      
      const result = extractSolanaData(complexQuery);
      
      expect(result.addresses.length).toBe(2);
      expect(result.signatures.length).toBe(1);
      
      expect(result.addresses[0].normalized).toBe('DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq');
      expect(result.addresses[1].normalized).toBe('8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6');
      expect(result.signatures[0].normalized).toBe('5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU');
      
      result.addresses.forEach(addr => {
        expect(addr.valid).toBe(true);
        expect(addr.type).toBe('address');
      });
      
      result.signatures.forEach(sig => {
        expect(sig.valid).toBe(true);
        expect(sig.type).toBe('signature');
      });
    });

    test('Should handle well-known program addresses', () => {
      const wellKnownPrograms = [
        { address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', name: 'Token Program' },
        { address: '11111111111111111111111111111111', name: 'System Program' },
        { address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', name: 'Associated Token Account Program' }
      ];

      wellKnownPrograms.forEach(({ address, name }) => {
        const result = validateAccountAddress(address);
        expect(result.valid).toBe(true);
        expect(result.isWellKnownProgram).toBe(true);
        expect(result.programName).toBe(name);
      });
    });

  });

  describe('Phase 5: Integration Testing', () => {
    
    test('End-to-end query processing flow', async () => {
      // Test direct RPC query flow
      const directQuery = 'What is the current TPS?';
      const directClassification = classifyQuery(directQuery);
      
      expect(directClassification.type).toBe(QueryType.DIRECT_RPC);
      expect(shouldBypassPlanning(directQuery)).toBe(true);
      expect(directClassification.suggestedTools).toContain('networkStats');

      // Test complex analysis query flow
      const analysisQuery = 'analyze account DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq';
      const analysisClassification = classifyQuery(analysisQuery);
      
      expect(analysisClassification.type).toBe(QueryType.COMPLEX_ANALYSIS);
      expect(analysisClassification.requiresPlan).toBe(true);
      expect(analysisClassification.suggestedTools).toContain('accountAnalysis');

      // Validate the address in the analysis query
      const solanaData = extractSolanaData(analysisQuery);
      expect(solanaData.addresses.length).toBe(1);
      expect(solanaData.addresses[0].valid).toBe(true);
    });

    test('Execution monitoring lifecycle', () => {
      const planId = 'integration-test-789';
      
      // Start execution
      const state = monitorExecution(planId);
      expect(state.planId).toBe(planId);
      expect(state.planGenerated).toBe(false);

      // Generate plan
      markPlanGenerated(planId);
      expect(executionMonitor.getExecutionState(planId)?.planGenerated).toBe(true);

      // Start execution
      markPlanExecuting(planId);
      expect(executionMonitor.getExecutionState(planId)?.planExecuting).toBe(true);

      // Complete execution
      const resultData = { success: true, responseTime: 1500 };
      markPlanCompleted(planId, resultData);
      
      const finalState = executionMonitor.getExecutionState(planId);
      expect(finalState?.planCompleted).toBe(true);
      expect(finalState?.partialData).toEqual(resultData);
    });

    test('Parameter validation and correction', () => {
      const messyParams = {
        '  account  ': '  DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq  ',
        walletAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        limit: '25'
      };

      const accountValidation = validateAccountAnalysisParams(messyParams);
      
      expect(accountValidation.valid).toBe(true);
      expect(accountValidation.normalized.account).toBe('DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq');
      expect(accountValidation.normalized.limit).toBe(25);
      expect(accountValidation.errors.length).toBe(0);
    });

  });

  describe('Phase 6: Performance and Reliability', () => {
    
    test('Query classification performance', () => {
      const queries = [
        'What is the current TPS?',
        'analyze account DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq',
        'What is Solana?',
        'complex multi-step blockchain analysis with multiple parameters'
      ];

      const startTime = performance.now();
      
      queries.forEach(query => {
        classifyQuery(query);
      });
      
      const endTime = performance.now();
      const avgTimePerQuery = (endTime - startTime) / queries.length;
      
      // Classification should be fast (< 5ms per query)
      expect(avgTimePerQuery).toBeLessThan(5);
    });

    test('Address validation performance', () => {
      const addresses = [
        'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq',
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        '8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6',
        'invalid-address-123'
      ];

      const startTime = performance.now();
      
      addresses.forEach(address => {
        validateAccountAddress(address);
      });
      
      const endTime = performance.now();
      const avgTimePerValidation = (endTime - startTime) / addresses.length;
      
      // Validation should be fast (< 2ms per address)
      expect(avgTimePerValidation).toBeLessThan(2);
    });

    test('Execution monitor metrics tracking', () => {
      const planIds = ['metric-test-1', 'metric-test-2', 'metric-test-3'];
      
      // Start multiple executions
      planIds.forEach(planId => {
        monitorExecution(planId);
        markPlanGenerated(planId);
        markPlanExecuting(planId);
      });

      // Complete some, timeout others
      markPlanCompleted(planIds[0], { success: true });
      markPlanCompleted(planIds[1], { success: true });
      // planIds[2] will timeout

      const metrics = executionMonitor.getMetrics();
      
      expect(metrics.totalPlans).toBeGreaterThanOrEqual(3);
      expect(metrics.completedPlans).toBeGreaterThanOrEqual(2);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

  });

  describe('Regression Prevention', () => {
    
    test('Should not misclassify edge cases', () => {
      const edgeCases = [
        { query: 'What is TPS in gaming?', shouldNotBypass: true },
        { query: 'I have a balance problem', shouldNotBypass: true },
        { query: 'epoch in history', shouldNotBypass: true },
        { query: 'network of friends', shouldNotBypass: true }
      ];

      edgeCases.forEach(({ query, shouldNotBypass }) => {
        const shouldBypass = shouldBypassPlanning(query);
        if (shouldNotBypass) {
          expect(shouldBypass).toBe(false);
        }
      });
    });

    test('Should handle malformed input gracefully', () => {
      const malformedInputs = [
        '',
        '   ',
        '\n\n\n',
        '!@#$%^&*()',
        'żółć гусь 中文'
      ];

      malformedInputs.forEach(input => {
        const classification = classifyQuery(input);
        expect(classification).toBeDefined();
        expect(classification.type).toBeDefined();
        expect(classification.confidence).toBeGreaterThanOrEqual(0);
      });
    });

    test('Should validate empty and malformed addresses', () => {
      const malformedAddresses = [
        '',
        '   ',
        'too-short',
        'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq0', // invalid character
        'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqqTooLong' // too long
      ];

      malformedAddresses.forEach(address => {
        const result = validateAccountAddress(address);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

  });

});

/**
 * Mock data for testing
 */
export const TEST_DATA = {
  validAddresses: [
    'DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq',
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  ],
  validSignatures: [
    '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRCxFpoCX5oqky7y4oDDvvilojQWuFgM7UwONrVCLjU'
  ],
  queryTestCases: [
    { query: 'What is the current TPS?', type: QueryType.DIRECT_RPC, shouldBypass: true },
    { query: 'What is Solana?', type: QueryType.KNOWLEDGE_BASED, shouldBypass: true },
    { query: 'analyze account DRiP2Pd9fjUUVgLYEYkMNmvKzyWbq7dNbN4VpnQfpRqq', type: QueryType.COMPLEX_ANALYSIS, shouldBypass: false },
    { query: 'complex multi-step analysis', type: QueryType.PLAN_REQUIRED, shouldBypass: false }
  ]
};
