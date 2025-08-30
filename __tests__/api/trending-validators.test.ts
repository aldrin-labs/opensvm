/**
 * Mock next/server to ensure NextResponse.json returns a simple mock Response
 * whose json() method works in this Jest environment.
 */
jest.mock('next/server', () => {
  const NextResponse = {
    json: (data: any, init?: { status?: number; statusText?: string; headers?: Record<string, string> }) => {
      const headers = Object.assign({ 'Content-Type': 'application/json' }, init?.headers || {});
      return new (global as any).Response(
        // Ensure valid JSON string body even if native Response is used
        typeof data === 'string' ? data : JSON.stringify(data),
        {
          status: init?.status || 200,
          statusText: init?.statusText,
            headers
        }
      );
    }
  };

  class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    _jsonBody: any;

    constructor(url: string, init?: { method?: string; headers?: HeadersInit }) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new (global as any).Headers(init?.headers);
      this._jsonBody = {};
    }

    json() {
      return Promise.resolve(this._jsonBody);
    }
  }

  return { NextResponse, NextRequest };
});

import { NextRequest } from 'next/server';

/**
 * Test goals:
 * - Ensure GET route returns cached data, rate limit errors, and generated data
 * - Ensure POST route validates inputs and burn verification logic
 * - Keep mocks consistent so the route (which uses alias imports "@/") receives the same mocked instances
 *
 * Root cause of earlier failures:
 * - Divergent mocks between alias "@/lib/..." and relative "../../lib/..." produced different module instances
 * - POST verification failing due to unmocked token config & on-chain verification complexity
 * - Burn verification returning 400 caused many assertions expecting 200
 *
 * Strategy:
 * - Provide unified shared mock objects for cache & rate limiters
 * - Mock token config to align with test data
 * - Short‑circuit on-chain verification by mocking getConnection and providing a successful transaction object when needed
 * - Provide helper to build NextRequest with body + ensure request.json returns parsed object (NextRequest in Jest doesn't parse automatically)
 */

// Shared mock objects (single instances reused across all module specifiers)
const memoryCacheMock = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn()
};

const generalRateLimiterMock = {
  checkLimit: jest.fn()
};

const burnRateLimiterMock = {
  checkLimit: jest.fn()
};

const boostMutexReleaseFn = jest.fn();
const boostMutexMock = {
  acquire: jest.fn(() => Promise.resolve(boostMutexReleaseFn))
};

// Mock token config to align with test assumptions
const TOKEN_MINT = 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
const TOKEN_MULTIPLIER = 1e6;
const MAX_BURN = 69000;

// Provide a flexible mock of the Solana connection
const mockConnection = {
  getTransaction: jest.fn().mockResolvedValue(null),
  getParsedAccountInfo: jest.fn().mockResolvedValue({ value: null }),
  getBlockHeight: jest.fn().mockResolvedValue(100),
  getBalance: jest.fn().mockResolvedValue(5_000_000_000)
};

// Alias mocks (the route uses these)
jest.mock('@/lib/cache', () => ({ memoryCache: memoryCacheMock }));
jest.mock('@/lib/rate-limiter', () => ({
  generalRateLimiter: generalRateLimiterMock,
  burnRateLimiter: burnRateLimiterMock
}));
jest.mock('@/lib/utils/client-ip', () => ({
  getClientIP: jest.fn(() => '127.0.0.1')
}));
jest.mock('@/lib/mutex', () => ({
  boostMutex: boostMutexMock
}));
jest.mock('@/lib/solana-connection-server', () => ({
  getConnection: jest.fn(() => Promise.resolve(mockConnection))
}));
jest.mock('@/lib/config/tokens', () => ({
  TOKEN_MINTS: { SVMAI: { toBase58: () => TOKEN_MINT } },
  TOKEN_MULTIPLIERS: { SVMAI: TOKEN_MULTIPLIER },
  MAX_BURN_AMOUNTS: { SVMAI: MAX_BURN }
}));

// Also mock potential relative imports just in case (ensure same instances)
jest.mock('../../lib/cache', () => ({ memoryCache: memoryCacheMock }));
jest.mock('../../lib/rate-limiter', () => ({
  generalRateLimiter: generalRateLimiterMock,
  burnRateLimiter: burnRateLimiterMock
}));
jest.mock('../../lib/utils/client-ip', () => ({
  getClientIP: jest.fn(() => '127.0.0.1')
}));
jest.mock('../../lib/mutex', () => ({
  boostMutex: boostMutexMock
}));
jest.mock('../../lib/solana-connection-server', () => ({
  getConnection: jest.fn(() => Promise.resolve(mockConnection))
}));

// Mock Solana web3.js PublicKey
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn().mockImplementation((k: string) => ({
    toBase58: () => k,
    toString: () => k
  })),
  Transaction: jest.fn(),
  SystemProgram: { programId: { toString: () => '11111111111111111111111111111112' } }
}));

jest.mock('@solana/spl-token', () => ({
  TOKEN_PROGRAM_ID: { toString: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
}));

// Import route after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET, POST } = require('../../app/api/analytics/trending-validators/route');

// Helper to create a NextRequest with a controllable json() implementation
function buildRequest(url: string, init?: { method?: string; bodyObj?: any }) {
  const req = new NextRequest(url, { method: init?.method || 'GET' }) as any;
  req._jsonBody = init?.bodyObj !== undefined ? init.bodyObj : {};
  // Provide an overridable json mock
  req.json = jest.fn().mockImplementation(() => Promise.resolve(req._jsonBody));
  return req;
}

// Robust response JSON extractor handling environments where res.json() may return null
async function getJSON(res: any) {
  if (!res) return null;
  try {
    const data = await res.json();
    if (data !== null && data !== undefined) return data;
  } catch (_) {
    // fall through to text parsing
  }
  if (typeof res.text === 'function') {
    try {
      const txt = await res.text();
      if (!txt) return null;
      return JSON.parse(txt);
    } catch (_) {
      return null;
    }
  }
  return null;
}

describe('/api/analytics/trending-validators', () => {
  const validBurnRequest = {
    // Use valid base58 strings for PublicKey (32-44 chars) and signature (88 chars)
    voteAccount: '11111111111111111111111111111111',
    burnAmount: 2000,
    burnSignature: '5'.repeat(88),
    burnerWallet: '3se1f1g7JH9kLmNoPqrSTUvWXyZaBCDefGhijkLmNoP' // 44-char base58-like
  };

  beforeEach(() => {
    jest.clearAllMocks();
    memoryCacheMock.get.mockReset();
    memoryCacheMock.set.mockReset();
    memoryCacheMock.delete.mockReset();
    generalRateLimiterMock.checkLimit.mockReset();
    burnRateLimiterMock.checkLimit.mockReset();
    boostMutexMock.acquire.mockClear();
    boostMutexReleaseFn.mockClear();
    mockConnection.getTransaction.mockReset().mockResolvedValue(null);
    mockConnection.getParsedAccountInfo.mockReset().mockResolvedValue({ value: null });
  });

  describe('GET /api/analytics/trending-validators', () => {
    it('returns cached trending validators', async () => {
      const mockTrending = [
        {
          voteAccount: 'validator1',
          name: 'Test Validator 1',
            commission: 5,
          activatedStake: 1_000_000_000_000,
          trendingScore: 100,
          rank: 1
        }
      ];
      generalRateLimiterMock.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60_000
      });
      memoryCacheMock.get.mockImplementation((key: string) =>
        key === 'trending_validators' ? mockTrending : null
      );

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators');
      const res = await GET(req);
      const body = await getJSON(res);

      expect(res.status).toBe(200);
      expect(body).not.toBeNull();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockTrending);
      expect(body.cached).toBe(true);
    });

    it('returns rate limit error', async () => {
      generalRateLimiterMock.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60_000,
        retryAfter: 30
      });

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators');
      const res = await GET(req);
      const body = await getJSON(res);

      expect(res.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Rate limit exceeded');
    });

    it('generates trending validators on cache miss', async () => {
      generalRateLimiterMock.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60_000
      });
      memoryCacheMock.get.mockReturnValue(null);

      // Mock fetch to validators endpoint
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              validators: [
                {
                  voteAccount: 'validator1',
                  name: 'Val 1',
                  commission: 5,
                  activatedStake: 1_000_000_000_000,
                  uptimePercent: 99.5,
                  apy: 0.07,
                  performanceScore: 50
                },
                {
                  voteAccount: 'validator2',
                  name: 'Val 2',
                  commission: 7,
                  activatedStake: 2_000_000_000_000,
                  uptimePercent: 98.5,
                  apy: 0.065,
                  performanceScore: 60
                }
              ]
            }
          })
      });

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators');
      const res = await GET(req);
      const body = await getJSON(res);

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(memoryCacheMock.set).toHaveBeenCalled();
    });
  });

  describe('POST /api/analytics/trending-validators', () => {
    function mockSuccessfulBurnTransaction(burnAmount: number) {
      // Simulate an SPL burn instruction & token balance delta
      const rawAmount = BigInt(Math.round(burnAmount * TOKEN_MULTIPLIER));
      const amountBytes = Buffer.alloc(8);
      amountBytes.writeBigUInt64LE(rawAmount);
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preTokenBalances: [
            {
              accountIndex: 0,
              mint: TOKEN_MINT,
              uiTokenAmount: { amount: String(5_000_000_000), decimals: 6 }
            }
          ],
          postTokenBalances: [
            {
              accountIndex: 0,
              mint: TOKEN_MINT,
              uiTokenAmount: { amount: String(5_000_000_000 - Number(rawAmount)), decimals: 6 }
            }
          ]
        },
        transaction: {
          message: {
            instructions: [
              {
                programIdIndex: 0,
                data: [8, ...Array.from(amountBytes), 0, 0, 0, 0, 0], // simplified
                accounts: [1, 2, 3]
              }
            ],
            accountKeys: [
              { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { toBase58: () => 'token_account' },
              { toBase58: () => validBurnRequest.burnerWallet },
              { toBase58: () => 'other' }
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
                mint: TOKEN_MINT,
                owner: validBurnRequest.burnerWallet
              }
            }
          }
        }
      });
    }

    it('accepts valid burn transaction', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60_000
      });
      memoryCacheMock.get.mockImplementation((key: string) => {
        if (key === 'used_burn_signatures') return new Set();
        if (key === 'validator_boosts') return [];
        return null;
      });

      mockSuccessfulBurnTransaction(validBurnRequest.burnAmount);

      const req = buildRequest(
        'http://localhost:3000/api/analytics/trending-validators',
        { method: 'POST', bodyObj: validBurnRequest }
      );

      const res = await POST(req);
      const body = await getJSON(res);

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toContain('Successfully burned');
      expect(boostMutexMock.acquire).toHaveBeenCalled();
      expect(memoryCacheMock.delete).toHaveBeenCalledWith('trending_validators');
    });

    it('rejects invalid (below minimum) burn amount', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });

      const invalid = { ...validBurnRequest, burnAmount: 500 };
      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: invalid
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Minimum burn amount');
    });

    it('rejects burn amount exceeding maximum', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });

      const invalid = { ...validBurnRequest, burnAmount: MAX_BURN + 1 };
      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: invalid
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Maximum burn amount');
    });

    it('rejects duplicate signatures', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });

      // Provide a successful on-chain burn so we reach duplicate signature logic
      mockSuccessfulBurnTransaction(validBurnRequest.burnAmount);

      const usedSet = new Set([validBurnRequest.burnSignature]);
      memoryCacheMock.get.mockImplementation((key: string) => {
        if (key === 'used_burn_signatures') return usedSet;
        if (key === 'validator_boosts') return [];
        return null;
      });

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: validBurnRequest
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('already been used');
    });

    it('rejects failed on-chain transaction', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
      mockConnection.getTransaction.mockResolvedValue({
        meta: { err: { InstructionError: [0, 'Custom'] } },
        transaction: { message: { instructions: [], accountKeys: [], header: { numRequiredSignatures: 1 } } }
      });

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: validBurnRequest
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('failed on-chain');
    });

    it('rejects wrong token mint', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
      // Provide transaction with different mint but valid burn instruction
      const rawAmount = Buffer.alloc(8);
      rawAmount.writeBigUInt64LE(BigInt(validBurnRequest.burnAmount * TOKEN_MULTIPLIER));
      mockConnection.getTransaction.mockResolvedValue({
        meta: {
          err: null,
          preTokenBalances: [{
            accountIndex: 0,
            mint: 'WRONG_MINT',
            uiTokenAmount: { amount: '5000000000', decimals: 6 }
          }],
          postTokenBalances: [{
            accountIndex: 0,
            mint: 'WRONG_MINT',
            uiTokenAmount: { amount: '3000000000', decimals: 6 }
          }]
        },
        transaction: {
          message: {
            instructions: [{
              programIdIndex: 0,
              data: [8, ...Array.from(rawAmount), 0, 0, 0, 0, 0],
              accounts: [1]
            }],
            accountKeys: [
              // MUST be exact token program id so verification inspects burn instruction
              { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { toBase58: () => 'token_account' },
              { toBase58: () => validBurnRequest.burnerWallet }
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
              info: { mint: 'WRONG_MINT', owner: validBurnRequest.burnerWallet }
            }
          }
        }
      });

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: validBurnRequest
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('wrong token mint');
    });

    it('handles missing required fields (burnAmount first)', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
      const incomplete = { voteAccount: 'validator1' };
      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: incomplete
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('burnAmount');
    });

    it('handles rate limit for burn operations', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60_000,
        retryAfter: 30,
        burstRemaining: 0
      });
      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: validBurnRequest
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Rate limit exceeded');
    });
  });

  describe('Error Handling', () => {
    it('handles malformed JSON', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: undefined
      });
      // Force request.json to throw
      req.json.mockRejectedValue(new Error('Invalid JSON'));

      const res = await POST(req);
      const body = await getJSON(res);
      // Route treats JSON parse failure as 400 with error message
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid JSON');
    });

    it('handles Solana RPC errors gracefully', async () => {
      burnRateLimiterMock.checkLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
      mockConnection.getTransaction.mockRejectedValue(new Error('RPC Error'));

      const req = buildRequest('http://localhost:3000/api/analytics/trending-validators', {
        method: 'POST',
        bodyObj: validBurnRequest
      });
      const res = await POST(req);
      const body = await getJSON(res);
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('verification failed');
    });
  });
});
