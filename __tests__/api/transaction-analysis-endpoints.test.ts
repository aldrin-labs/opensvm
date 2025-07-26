import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as analysisGET } from '@/app/api/transaction/[signature]/analysis/route';
import { GET as relatedGET } from '@/app/api/transaction/[signature]/related/route';
import { GET as explainGET } from '@/app/api/transaction/[signature]/explain/route';
import { GET as metricsGET } from '@/app/api/transaction/[signature]/metrics/route';
import { POST as batchPOST } from '@/app/api/transaction/batch/route';

// Mock dependencies
jest.mock('@/lib/solana', () => ({
  getTransactionDetails: jest.fn()
}));

jest.mock('@/lib/instruction-parser-service', () => ({
  parseInstructions: jest.fn()
}));

jest.mock('@/lib/account-changes-analyzer', () => ({
  analyzeAccountChanges: jest.fn()
}));

jest.mock('@/lib/transaction-metrics-calculator', () => ({
  calculateTransactionMetrics: jest.fn()
}));

jest.mock('@/lib/transaction-failure-analyzer', () => ({
  analyzeTransactionFailure: jest.fn()
}));

jest.mock('@/lib/related-transaction-finder', () => ({
  findRelatedTransactions: jest.fn()
}));

jest.mock('@/lib/relationship-strength-scorer', () => ({
  scoreRelationshipStrength: jest.fn()
}));

jest.mock('@/lib/ai-transaction-analyzer', () => ({
  analyzeTransactionWithAI: jest.fn()
}));

jest.mock('@/lib/transaction-cache', () => ({
  cacheHelpers: {
    getTransaction: jest.fn(),
    setTransaction: jest.fn(),
    getRelatedTransactions: jest.fn(),
    setRelatedTransactions: jest.fn(),
    getAIExplanation: jest.fn(),
    setAIExplanation: jest.fn(),
    getMetrics: jest.fn(),
    setMetrics: jest.fn()
  }
}));

const mockTransaction = {
  signature: '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW',
  slot: 123456789,
  blockTime: 1703123456,
  meta: {
    err: null,
    fee: 5000,
    computeUnitsConsumed: 150
  },
  transaction: {
    message: {
      instructions: [{
        programIdIndex: 0,
        accounts: [1, 2],
        data: 'test'
      }],
      accountKeys: [
        '11111111111111111111111111111111',
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        '8WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWN'
      ]
    }
  }
};

const validSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';

describe('Transaction Analysis Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Analysis Endpoint', () => {
    it('should return transaction analysis for valid signature', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { parseInstructions } = require('@/lib/instruction-parser-service');
      const { analyzeAccountChanges } = require('@/lib/account-changes-analyzer');
      const { calculateTransactionMetrics } = require('@/lib/transaction-metrics-calculator');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      parseInstructions.mockResolvedValue([{
        programId: '11111111111111111111111111111111',
        programName: 'System Program',
        instructionType: 'transfer',
        description: 'Transfer SOL'
      }]);
      analyzeAccountChanges.mockResolvedValue({
        changes: [{
          account: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          type: 'balance_change',
          balanceChange: -1000000,
          significance: 'high'
        }]
      });
      calculateTransactionMetrics.mockResolvedValue({
        totalFee: 5000,
        feeBreakdown: { baseFee: 5000, priorityFee: 0 },
        computeUnitsUsed: 150,
        computeUnitsRequested: 200000,
        computeEfficiency: 0.075,
        performanceScore: 85,
        recommendations: ['Test recommendation']
      });
      cacheHelpers.getTransaction.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/analysis`);
      const response = await analysisGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.signature).toBe(validSignature);
      expect(data.data.analysis.instructions).toBeDefined();
      expect(data.data.analysis.accountChanges).toBeDefined();
      expect(data.data.analysis.metrics).toBeDefined();
    });

    it('should return 400 for invalid signature', async () => {
      const request = new NextRequest('http://localhost/api/transaction/invalid/analysis');
      const response = await analysisGET(request, { params: { signature: 'invalid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should return 404 for non-existent transaction', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { cacheHelpers } = require('@/lib/transaction-cache');
      
      getTransactionDetails.mockResolvedValue(null);
      cacheHelpers.getTransaction.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/analysis`);
      const response = await analysisGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('should return cached data when available', async () => {
      const { cacheHelpers } = require('@/lib/transaction-cache');
      
      const cachedData = {
        ...mockTransaction,
        analysis: {
          instructions: { parsed: [], summary: { totalInstructions: 0, programsInvolved: [], instructionTypes: {} } }
        }
      };
      cacheHelpers.getTransaction.mockReturnValue(cachedData);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/analysis`);
      const response = await analysisGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.cached).toBe(true);
    });
  });

  describe('Related Transactions Endpoint', () => {
    it('should return related transactions for valid signature', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { findRelatedTransactions } = require('@/lib/related-transaction-finder');
      const { scoreRelationshipStrength } = require('@/lib/relationship-strength-scorer');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      findRelatedTransactions.mockResolvedValue([{
        transaction: { ...mockTransaction, signature: 'related-signature' },
        relationshipType: 'account_overlap'
      }]);
      scoreRelationshipStrength.mockResolvedValue({
        score: 0.85,
        explanation: 'Shares accounts',
        details: { sharedAccounts: ['test-account'] }
      });
      cacheHelpers.getRelatedTransactions.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/related`);
      const response = await relatedGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relatedTransactions).toHaveLength(1);
      expect(data.data.relatedTransactions[0].relationship.score).toBe(0.85);
    });
  });

  describe('AI Explanation Endpoint', () => {
    it('should return AI explanation for valid signature', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { analyzeTransactionWithAI } = require('@/lib/ai-transaction-analyzer');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      analyzeTransactionWithAI.mockResolvedValue({
        summary: 'This is a SOL transfer transaction',
        mainAction: 'Transfer SOL',
        secondaryEffects: ['Balance changes'],
        riskLevel: 'low',
        recommendations: ['Transaction looks good']
      });
      cacheHelpers.getAIExplanation.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/explain`);
      const response = await explainGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.explanation.summary).toBe('This is a SOL transfer transaction');
      expect(data.data.explanation.mainAction).toBe('Transfer SOL');
    });

    it('should handle different explanation levels', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { analyzeTransactionWithAI } = require('@/lib/ai-transaction-analyzer');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      analyzeTransactionWithAI.mockResolvedValue({
        summary: 'Advanced explanation',
        mainAction: 'Transfer SOL',
        secondaryEffects: [],
        technicalDetails: { programsUsed: [] },
        relatedConcepts: []
      });
      cacheHelpers.getAIExplanation.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/explain?level=advanced&focus=technical`);
      const response = await explainGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.metadata.level).toBe('advanced');
      expect(data.data.metadata.focus).toBe('technical');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return transaction metrics for valid signature', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { calculateTransactionMetrics } = require('@/lib/transaction-metrics-calculator');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      calculateTransactionMetrics.mockResolvedValue({
        totalFee: 5000,
        feeBreakdown: { baseFee: 5000, priorityFee: 0 },
        computeUnitsUsed: 150,
        computeUnitsRequested: 200000,
        computeEfficiency: 0.075,
        performanceScore: 85,
        recommendations: ['Optimize compute units']
      });
      cacheHelpers.getMetrics.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/metrics`);
      const response = await metricsGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.metrics.fees.total).toBe(5000);
      expect(data.data.metrics.compute.efficiency).toBe(0.075);
      expect(data.data.metrics.performance.score).toBe(85);
    });
  });

  describe('Batch Processing Endpoint', () => {
    it('should process multiple transactions in batch', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      cacheHelpers.getTransaction.mockReturnValue(null);

      const requestBody = {
        signatures: [validSignature, 'another-valid-signature'],
        includeInstructions: false,
        includeAccountChanges: false,
        priority: 'medium'
      };

      const request = new NextRequest('http://localhost/api/transaction/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await batchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.transactions).toHaveLength(2);
      expect(data.data.summary.total).toBe(2);
    });

    it('should validate batch request parameters', async () => {
      const requestBody = {
        signatures: [], // Empty array should fail validation
        priority: 'invalid'
      };

      const request = new NextRequest('http://localhost/api/transaction/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await batchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle batch size limits', async () => {
      const signatures = Array(51).fill(validSignature); // Exceeds max of 50
      const requestBody = {
        signatures,
        priority: 'medium'
      };

      const request = new NextRequest('http://localhost/api/transaction/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await batchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { cacheHelpers } = require('@/lib/transaction-cache');
      
      getTransactionDetails.mockRejectedValue(new Error('Service unavailable'));
      cacheHelpers.getTransaction.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/analysis`);
      const response = await analysisGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ANALYSIS_ERROR');
    });

    it('should handle AI service rate limits', async () => {
      const { getTransactionDetails } = require('@/lib/solana');
      const { analyzeTransactionWithAI } = require('@/lib/ai-transaction-analyzer');
      const { cacheHelpers } = require('@/lib/transaction-cache');

      getTransactionDetails.mockResolvedValue(mockTransaction);
      analyzeTransactionWithAI.mockRejectedValue(new Error('rate limit exceeded'));
      cacheHelpers.getAIExplanation.mockReturnValue(null);

      const request = new NextRequest(`http://localhost/api/transaction/${validSignature}/explain`);
      const response = await explainGET(request, { params: { signature: validSignature } });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});