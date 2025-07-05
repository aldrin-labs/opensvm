import { NextRequest } from 'next/server';
import { POST } from '@/app/api/filter-transactions/route';

// Mock the environment variables and utilities
jest.mock('@/lib/transaction-constants', () => ({
  MIN_TRANSFER_SOL: 0.01,
  MAX_TRANSFER_COUNT: 10,
  isSpamAddress: jest.fn(() => false),
  isSpamToken: jest.fn(() => false),
  isDexLikeAddress: jest.fn(() => false),
  isAboveDustThreshold: jest.fn(() => true),
  AI_MODEL: 'gpt-4o-mini',
  AI_MAX_TOKENS: 500,
  AI_TEMPERATURE: 0.1,
  SPAM_TOKEN_KEYWORDS: ['SPAM', 'TEST']
}));

// Mock fetch for OpenAI API
global.fetch = jest.fn();

describe('/api/filter-transactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  const mockTransactions = [
    {
      txId: 'tx1',
      signature: 'sig1',
      from: 'address1',
      to: 'address2',
      tokenAmount: '1.5',
      tokenSymbol: 'SOL',
      transferType: 'OUT'
    },
    {
      txId: 'tx2',
      signature: 'sig2',
      from: 'address3',
      to: 'address4',
      tokenAmount: '0.5',
      tokenSymbol: 'USDC',
      transferType: 'IN'
    }
  ];

  it('should handle valid transactions with successful AI response', async () => {
    const mockAIResponse = {
      choices: [{
        message: {
          content: JSON.stringify({ validTransactions: ['tx1', 'tx2'] })
        }
      }]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockAIResponse)
    });

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: mockTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.filteredTransactions).toHaveLength(2);
    expect(data.aiAnalysis).toBe(true);
  });

  it('should handle AI API failure with fallback filtering', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: mockTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aiAnalysis).toBe(false);
    expect(data.fallback).toBe(true);
    expect(data.filteredTransactions).toBeDefined();
  });

  it('should handle malformed AI response with graceful fallback', async () => {
    const mockMalformedResponse = {
      choices: [{
        message: {
          content: 'This is not valid JSON'
        }
      }]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMalformedResponse)
    });

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: mockTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aiAnalysis).toBe(false);
    expect(data.fallback).toBe(true);
  });

  it('should handle AI response with incomplete data structure', async () => {
    const mockIncompleteResponse = {
      choices: [{
        message: {
          content: JSON.stringify({ someOtherField: 'value' })
        }
      }]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockIncompleteResponse)
    });

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: mockTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aiAnalysis).toBe(false);
    expect(data.fallback).toBe(true);
  });

  it('should handle slow AI response with timeout behavior', async () => {
    // Simulate a slow AI response
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({ validTransactions: ['tx1'] })
              }
            }]
          })
        }), 100)
      )
    );

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: mockTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.filteredTransactions).toBeDefined();
  });

  it('should handle empty transactions array', async () => {
    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: [] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.filteredTransactions).toEqual([]);
  });

  it('should handle invalid request data', async () => {
    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid transactions data');
  });

  it('should handle network errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: mockTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aiAnalysis).toBe(false);
    expect(data.fallback).toBe(true);
    expect(data.error).toBe('AI analysis failed, used basic filtering');
  });

  it('should apply pre-filtering correctly for large datasets', async () => {
    // Create a large dataset that should trigger pre-filtering
    const largeTransactions = Array.from({ length: 100 }, (_, i) => ({
      txId: `tx${i}`,
      signature: `sig${i}`,
      from: `address${i}`,
      to: `address${i + 1}`,
      tokenAmount: '1.0',
      tokenSymbol: 'SOL',
      transferType: 'OUT'
    }));

    const request = new NextRequest('http://localhost:3000/api/filter-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: largeTransactions })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.preFiltered).toBe(true);
    expect(data.limitedToTop10).toBe(true);
    expect(data.filteredTransactions.length).toBeLessThanOrEqual(10);
  });
});