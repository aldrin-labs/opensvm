import { NextRequest } from 'next/server';
import { GET, POST } from '../../app/api/analytics/trending-validators/route';

// Mock dependencies
jest.mock('../../lib/cache', () => ({
  memoryCache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  }
}));

jest.mock('../../lib/rate-limiter', () => ({
  generalRateLimiter: {
    checkLimit: jest.fn()
  },
  burnRateLimiter: {
    checkLimit: jest.fn()
  }
}));

jest.mock('../../lib/utils/client-ip', () => ({
  getClientIP: jest.fn(() => '127.0.0.1')
}));

// Fix mutex mock to return proper release function
jest.mock('../../lib/mutex', () => ({
  boostMutex: {
    acquire: jest.fn(() => Promise.resolve(jest.fn())), // Return a release function
  }
}));

// Mock the actual connection module that's used
const mockConnection = {
  getTransaction: jest.fn().mockResolvedValue(null),
  getParsedAccountInfo: jest.fn().mockResolvedValue({ value: null }),
  getBlockHeight: jest.fn().mockResolvedValue(100),
  getBalance: jest.fn().mockResolvedValue(5000000000)
};

jest.mock('../../lib/solana-connection', () => ({
  getConnection: jest.fn(() => Promise.resolve(mockConnection))
}));

// Mock Solana web3.js for PublicKey
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn().mockImplementation((key) => ({
    toBase58: () => key,
    toString: () => key
  })),
  Transaction: jest.fn(),
  SystemProgram: {
    programId: { toString: () => '11111111111111111111111111111112' }
  }
}));

// Mock TOKEN_PROGRAM_ID constant
jest.mock('@solana/spl-token', () => ({
  TOKEN_PROGRAM_ID: { toString: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
}));

describe('/api/analytics/trending-validators', () => {
  // Move validBurnRequest to module level so it's accessible everywhere
  const validBurnRequest = {
    voteAccount: 'validator1',
    burnAmount: 2000,
    burnSignature: 'test_signature_123',
    burnerWallet: 'burner_wallet_123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/trending-validators', () => {
    it('should return cached trending validators', async () => {
      const mockTrendingValidators = [
        {
          voteAccount: 'validator1',
          validatorName: 'Test Validator 1',
          totalBurned: 5000,
          boostEndTime: Date.now() + 3600000,
          trendingScore: 100
        }
      ];

      const { memoryCache } = require('../../lib/cache');
      const { generalRateLimiter } = require('../../lib/rate-limiter');

      // Mock rate limiter to allow request
      generalRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60000
      });

      // Mock cache hit
      memoryCache.get.mockReturnValue(mockTrendingValidators);

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockTrendingValidators);
    });

    it('should return rate limit error when exceeded', async () => {
      const { generalRateLimiter } = require('../../lib/rate-limiter');

      // Mock rate limiter to deny request
      generalRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 30
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('should generate trending validators when cache is empty', async () => {
      const { memoryCache } = require('../../lib/cache');
      const { generalRateLimiter } = require('../../lib/rate-limiter');

      // Mock rate limiter to allow request
      generalRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60000
      });

      // Mock cache miss
      memoryCache.get.mockReturnValue(null);

      // Mock fetch for validators API
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: {
            validators: [
              {
                voteAccount: 'validator1',
                name: 'Test Validator 1',
                commission: 5,
                activatedStake: 1000000000000,
                uptimePercent: 99.5
              },
              {
                voteAccount: 'validator2',
                name: 'Test Validator 2',
                commission: 7,
                activatedStake: 2000000000000,
                uptimePercent: 98.5
              }
            ]
          }
        })
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(memoryCache.set).toHaveBeenCalled(); // Should cache the result
    });
  });

  describe('POST /api/analytics/trending-validators (Burn Boost)', () => {
    it('should accept valid burn transaction', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');
      const { memoryCache } = require('../../lib/cache');
      const { boostMutex } = require('../../lib/mutex');

      // Mock rate limiter to allow request
      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      // Mock successful transaction verification
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preTokenBalances: [{
            accountIndex: 0,
            mint: 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump',
            uiTokenAmount: { amount: '5000000000', decimals: 6 }
          }],
          postTokenBalances: [{
            accountIndex: 0,
            mint: 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump',
            uiTokenAmount: { amount: '3000000000', decimals: 6 }
          }]
        },
        transaction: {
          message: {
            instructions: [{
              programIdIndex: 0,
              data: [8, 0, 0, 0, 0, 0, 0, 0, 128, 150, 152, 0, 0, 0, 0, 0], // Burn instruction
              accounts: [0, 1, 2]
            }],
            accountKeys: [
              { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { toBase58: () => 'token_account' },
              { toBase58: () => 'owner' }
            ],
            header: { numRequiredSignatures: 1 }
          }
        }
      });

      // Mock token account info
      mockConnection.getParsedAccountInfo.mockResolvedValue({
        value: {
          data: {
            parsed: {
              type: 'account',
              info: {
                mint: 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump',
                owner: 'burner_wallet_123'
              }
            }
          }
        }
      });

      // Mock cache for used signatures and trending data
      memoryCache.get.mockImplementation((key) => {
        if (key.includes('used_signatures')) return new Set();
        if (key.includes('validator_boosts')) return [];
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(validBurnRequest);

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(validBurnRequest);

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(validBurnRequest);

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(validBurnRequest);

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(validBurnRequest);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('Successfully burned');
      expect(boostMutex.acquire).toHaveBeenCalled();
    });

    it('should reject invalid burn amount', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      const invalidRequest = {
        ...validBurnRequest,
        burnAmount: 500 // Below minimum of 1000
      };

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(invalidRequest);

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(invalidRequest);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('minimum burn amount');
    });

    it('should reject burn amount exceeding maximum', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      const invalidRequest = {
        ...validBurnRequest,
        burnAmount: 70000 // Above maximum of 69k
      };

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('maximum burn amount');
    });

    it('should reject duplicate signatures', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');
      const { memoryCache } = require('../../lib/cache');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      // Mock used signatures set containing our signature
      const usedSignatures = new Set(['test_signature_123']);
      memoryCache.get.mockImplementation((key) => {
        if (key.includes('used_signatures')) return usedSignatures;
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(validBurnRequest);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already been used');
    });

    it('should reject failed transactions', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');
      const { memoryCache } = require('../../lib/cache');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      // Mock failed transaction
      mockConnection.getTransaction.mockResolvedValue({
        meta: { err: { InstructionError: [0, 'Custom'] } }, // Transaction failed
        transaction: {
          message: {
            instructions: [],
            accountKeys: [],
            header: { numRequiredSignatures: 1 }
          }
        }
      });

      memoryCache.get.mockImplementation((key) => {
        if (key.includes('used_signatures')) return new Set();
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('failed on-chain');
    });

    it('should reject wrong token mint', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');
      const { memoryCache } = require('../../lib/cache');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      // Mock transaction with wrong mint
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preTokenBalances: [{
            accountIndex: 0,
            mint: 'wrong_mint_address',
            uiTokenAmount: { amount: '5000000000', decimals: 6 }
          }],
          postTokenBalances: [{
            accountIndex: 0,
            mint: 'wrong_mint_address',
            uiTokenAmount: { amount: '3000000000', decimals: 6 }
          }]
        },
        transaction: {
          message: {
            instructions: [{
              programIdIndex: 0,
              data: [8, 0, 0, 0, 0, 0, 0, 0, 128, 150, 152, 0, 0, 0, 0, 0],
              accounts: [0, 1, 2]
            }],
            accountKeys: [
              { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { toBase58: () => 'token_account' },
              { toBase58: () => 'owner' }
            ],
            header: { numRequiredSignatures: 1 }
          }
        }
      });

      mockConnection.getParsedAccountInfo.mockResolvedValue({
        value: {
          data: {
            parsed: {
              type: 'account',
              info: {
                mint: 'wrong_mint_address',
                owner: 'burner_wallet_123'
              }
            }
          }
        }
      });

      memoryCache.get.mockImplementation((key) => {
        if (key.includes('used_signatures')) return new Set();
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('wrong token mint');
    });

    it('should handle missing required fields', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      const incompleteRequest = {
        voteAccount: 'validator1',
        // Missing burnAmount, burnSignature, burnerWallet
      };

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(incompleteRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock the request.json() method to return the expected body
      request.json = jest.fn().mockResolvedValue(incompleteRequest);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required parameters');
    });

    it('should handle rate limiting for burn operations', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');

      // Mock rate limiter to deny request
      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 30,
        burstRemaining: 0
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Rate limit exceeded for burn operations');
      expect(response.headers.get('Retry-After')).toBe('30');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock the request.json() method to throw an error for malformed JSON
      request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should handle Solana RPC errors gracefully', async () => {
      const { burnRateLimiter } = require('../../lib/rate-limiter');
      const { memoryCache } = require('../../lib/cache');

      burnRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      });

      // Mock RPC error
      mockConnection.getTransaction.mockRejectedValue(new Error('RPC Error'));

      memoryCache.get.mockImplementation((key) => {
        if (key.includes('used_signatures')) return new Set();
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('verification failed');
    });
  });
});