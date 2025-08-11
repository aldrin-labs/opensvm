export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { rateLimiter, RateLimitError } from '@/lib/rate-limit';
import { getConnection } from '@/lib/solana-connection-server';
import { sanitizeSearchQuery, isValidSolanaAddress, formatNumber } from '@/lib/utils';

// Rate limit configuration for account search
const SEARCH_RATE_LIMIT = {
  limit: 1000,         // 10 requests
  windowMs: 60000,   // per minute
  maxRetries: 5,     // Allow 2 retries
  initialRetryDelay: 10,
  maxRetryDelay: 5000
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  // Add CORS headers to all responses
  const baseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };
  try {
    // Apply rate limiting with retries
    try {
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
      await rateLimiter.rateLimit(`SEARCH_ACCOUNT_${ip}`, SEARCH_RATE_LIMIT);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          {
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(error.retryAfter / 1000)
          },
          {
            status: 429,
            headers: {
              ...baseHeaders,
              'Retry-After': Math.ceil(error.retryAfter / 1000).toString()
            }
          }
        );
      }
      throw error;
    }

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get('q');
    const query = sanitizeSearchQuery(rawQuery || '');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        {
          status: 400,
          headers: baseHeaders
        }
      );
    }

    // Get connection from pool with timeout
    const connection = await Promise.race<ReturnType<typeof getConnection>>([
      getConnection(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      ) as Promise<ReturnType<typeof getConnection>>
    ]);

    // First validate the query format
    if (query.length > 30 && !isValidSolanaAddress(query)) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        {
          status: 400,
          headers: baseHeaders
        }
      );
    }

    // Check if query is a valid public key
    let accounts = [];
    try {
      // Additional validation before creating PublicKey
      if (query.length >= 32) {
        const pubkey = new PublicKey(query);
        const [account, balance] = await Promise.all([
          connection.getAccountInfo(pubkey),
          connection.getBalance(pubkey)
        ]);

        if (account) {
          accounts.push({
            address: pubkey.toString(),
            balance: formatNumber(balance / 1e9), // Convert lamports to SOL and format
            executable: account.executable,
            owner: account.owner.toString()
          });
        }
      }
    } catch (e) {
      // Not a valid public key, could implement fuzzy search here
      console.log('Not a valid public key:', e);
    }

    return NextResponse.json(accounts, { headers: baseHeaders });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      {
        status: 500,
        headers: baseHeaders
      }
    );
  }
}
