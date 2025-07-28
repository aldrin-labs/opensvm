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

jest.mock('../../lib/mutex', () => ({
  boostMutex: {
    acquire: jest.fn(() => Promise.resolve()),
    release: jest.fn()
  }
}));

// Mock Solana connection
const mockConnection = {
  getTransaction: jest.fn(),
  getParsedAccountInfo: jest.fn()
};

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(() => mockConnection),
  PublicKey: jest.fn().mockImplementation((key) => ({ toBase58: () => key }))
}));

describe('/api/analytics/trending-validators', () => {
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
      expect(data.validators).toEqual(mockTrendingValidators);
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

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.validators)).toBe(true);
      expect(memoryCache.set).toHaveBeenCalled(); // Should cache the result
    });
  });

  describe('POST /api/analytics/trending-validators (Burn Boost)', () => {
    const validBurnRequest = {
      voteAccount: 'validator1',
      burnAmount: 2000,
      burnSignature: 'test_signature_123',
      burnerWallet: 'burner_wallet_123'
    };

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
        meta: { err: null },
        transaction: {
          message: {
            instructions: [{
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              data: Buffer.from([8, 0, 0, 0, 0, 0, 0, 0, 128, 150, 152, 0, 0, 0, 0, 0]), // Burn instruction
              accounts: [0, 1, 2]
            }],
            accountKeys: ['token_account', 'mint', 'owner'],
            header: { numRequiredSignatures: 1 }
          }
        },
        meta: {
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
        if (key.includes('trending')) return [];
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        body: JSON.stringify(validBurnRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Boost added successfully');
      expect(boostMutex.acquire).toHaveBeenCalled();
      expect(boostMutex.release).toHaveBeenCalled();
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
        burnAmount: 200000000 // Above maximum
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
      const { boostMutex } = require('../../lib/mutex');

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

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already been used');
      expect(boostMutex.release).toHaveBeenCalled(); // Should release mutex even on error
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
        transaction: { message: { instructions: [] } }
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
      expect(data.error).toContain('Transaction failed');
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
        meta: { err: null },
        transaction: {
          message: {
            instructions: [{
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              data: Buffer.from([8, 0, 0, 0, 0, 0, 0, 0, 128, 150, 152, 0, 0, 0, 0, 0]),
              accounts: [0, 1, 2]
            }],
            accountKeys: ['token_account', 'wrong_mint', 'owner'],
            header: { numRequiredSignatures: 1 }
          }
        },
        meta: {
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

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
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

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});