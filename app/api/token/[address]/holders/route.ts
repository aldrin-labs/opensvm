import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { rateLimiter, RateLimitError } from '@/lib/api/rate-limit';

// Cache for holder data
const holderCache = new Map<string, { 
  holders: Array<{
    address: string;
    balance: number;
    percentage: number;
    rank: number;
  }>;
  totalSupply: number;
  timestamp: number;
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_REFRESH_THRESHOLD = 60 * 1000; // 1 minute - trigger background refresh

// Track ongoing background updates to prevent duplicate fetches
const ongoingUpdates = new Set<string>();

// Rate limit configuration
const HOLDER_RATE_LIMIT = {
  limit: 100,
  windowMs: 60000,
  maxRetries: 2,
  initialRetryDelay: 500,
  maxRetryDelay: 2000
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Background update function
async function updateHolderCacheInBackground(mintAddress: string, mintPubkey: PublicKey) {
  // Prevent duplicate updates
  if (ongoingUpdates.has(mintAddress)) {
    console.log(`Background update already in progress for ${mintAddress}`);
    return;
  }

  ongoingUpdates.add(mintAddress);
  console.log(`Starting background cache update for ${mintAddress}`);

  try {
    const connection = await getConnection();
    const mintInfo = await getMint(connection, mintPubkey);
    const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);

    const tokenAccounts = await connection.getProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        encoding: 'base64',
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } }
        ]
      }
    );

    const holderMap = new Map<string, number>();
    
    for (const account of tokenAccounts) {
      try {
        const accountData = account.account.data;
        if (Buffer.isBuffer(accountData) && accountData.length >= 72) {
          const ownerBuffer = accountData.slice(32, 64);
          const owner = new PublicKey(ownerBuffer).toBase58();
          
          const amountBuffer = accountData.slice(64, 72);
          const amount = amountBuffer.readBigUInt64LE(0);
          const balance = Number(amount) / Math.pow(10, mintInfo.decimals);
          
          if (balance > 0) {
            const currentBalance = holderMap.get(owner) || 0;
            holderMap.set(owner, currentBalance + balance);
          }
        }
      } catch (parseError) {
        continue;
      }
    }
    
    const holders = Array.from(holderMap.entries())
      .map(([address, balance]) => ({
        address,
        balance,
        percentage: (balance / totalSupply) * 100
      }))
      .sort((a, b) => b.balance - a.balance)
      .map((holder, index) => ({
        ...holder,
        rank: index + 1
      }));
    
    // Update cache
    holderCache.set(mintAddress, {
      holders,
      totalSupply,
      timestamp: Date.now()
    });
    
    console.log(`Background cache update completed for ${mintAddress}: ${holders.length} holders`);
  } catch (error) {
    console.error(`Background cache update failed for ${mintAddress}:`, error);
  } finally {
    ongoingUpdates.delete(mintAddress);
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const baseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  const globalTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Global request timeout')), 15000); // 15s for holder data
  });

  try {
    return await Promise.race([
      (async () => {
        // Apply rate limiting
        try {
          await rateLimiter.rateLimit('TOKEN_HOLDERS', HOLDER_RATE_LIMIT);
        } catch (error) {
          if (error instanceof RateLimitError) {
            console.warn('Rate limit exceeded for TOKEN_HOLDERS');
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

        const params = await context.params;
        const { address } = params;
        const mintAddress = address;

        // Validate address format
        let mintPubkey: PublicKey;
        try {
          mintPubkey = new PublicKey(mintAddress);
        } catch (error) {
          console.error('Invalid address format:', mintAddress);
          return NextResponse.json(
            { error: 'Invalid address format' },
            { status: 400, headers: baseHeaders }
          );
        }

        // Check cache first
        const cacheKey = mintAddress;
        const cached = holderCache.get(cacheKey);
        const now = Date.now();
        
        if (cached) {
          const cacheAge = now - cached.timestamp;
          
          // If cache is still valid (< 5 minutes), return it
          if (cacheAge < CACHE_DURATION) {
            // If cache is older than 1 minute, trigger background refresh
            if (cacheAge > CACHE_REFRESH_THRESHOLD) {
              console.log(`Cache is ${Math.round(cacheAge / 1000)}s old, triggering background refresh for ${mintAddress}`);
              // Trigger background update without awaiting
              updateHolderCacheInBackground(mintAddress, mintPubkey).catch(err => 
                console.error('Background update error:', err)
              );
            }
            
            console.log(`Returning cached holder data for ${mintAddress}: ${cached.holders.length} holders (age: ${Math.round(cacheAge / 1000)}s)`);
            return NextResponse.json({
              holders: cached.holders,
              totalSupply: cached.totalSupply,
              cached: true,
              cacheAge: Math.round(cacheAge / 1000)
            }, { headers: baseHeaders });
          }
        }

        // Get connection
        const connection = await Promise.race<ReturnType<typeof getConnection>>([
          getConnection(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 2000)
          ) as Promise<ReturnType<typeof getConnection>>
        ]);

        // Get mint info to get decimals and total supply
        let mintInfo;
        try {
          mintInfo = await Promise.race([
            getMint(connection, mintPubkey),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Mint info timeout')), 2000)
            )
          ]) as Awaited<ReturnType<typeof getMint>>;
        } catch (error) {
          console.warn('Failed to get mint info:', error instanceof Error ? error.message : 'Unknown error');
          return NextResponse.json(
            {
              error: 'Not a token mint account',
              message: 'This account is not a token mint account.',
            },
            { status: 400, headers: baseHeaders }
          );
        }

        const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);

        // Fetch all token accounts for this mint
        console.log('Fetching holder data via getProgramAccounts...');
        
        const tokenAccounts = await Promise.race([
          connection.getProgramAccounts(
            TOKEN_PROGRAM_ID,
            {
              encoding: 'base64',
              filters: [
                {
                  dataSize: 165 // Size of token account
                },
                {
                  memcmp: {
                    offset: 0, // Mint is at offset 0 in token account
                    bytes: mintPubkey.toBase58()
                  }
                }
              ]
            }
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Program accounts timeout')), 10000)
          )
        ]) as Awaited<ReturnType<typeof connection.getProgramAccounts>>;
        
        if (!tokenAccounts || tokenAccounts.length === 0) {
          console.warn('No token accounts found for mint:', mintAddress);
          return NextResponse.json({
            holders: [],
            totalSupply,
            message: 'No holders found'
          }, { headers: baseHeaders });
        }

        // Parse accounts and extract holder data
        const holderMap = new Map<string, number>();
        
        for (const account of tokenAccounts) {
          try {
            const accountData = account.account.data;
            if (Buffer.isBuffer(accountData) && accountData.length >= 72) {
              // Token account structure:
              // - bytes 0-32: mint (pubkey)
              // - bytes 32-64: owner (pubkey)
              // - bytes 64-72: amount (u64 little-endian)
              
              const ownerBuffer = accountData.slice(32, 64);
              const owner = new PublicKey(ownerBuffer).toBase58();
              
              const amountBuffer = accountData.slice(64, 72);
              const amount = amountBuffer.readBigUInt64LE(0);
              const balance = Number(amount) / Math.pow(10, mintInfo.decimals);
              
              if (balance > 0) {
                // Aggregate balances by owner (in case one owner has multiple token accounts)
                const currentBalance = holderMap.get(owner) || 0;
                holderMap.set(owner, currentBalance + balance);
              }
            }
          } catch (parseError) {
            // Skip accounts that can't be parsed
            console.warn('Failed to parse token account:', parseError);
            continue;
          }
        }
        
        // Convert to array and sort by balance
        const holders = Array.from(holderMap.entries())
          .map(([address, balance]) => ({
            address,
            balance,
            percentage: (balance / totalSupply) * 100
          }))
          .sort((a, b) => b.balance - a.balance)
          .map((holder, index) => ({
            ...holder,
            rank: index + 1
          }));
        
        console.log(`Found ${holders.length} unique holders for ${mintAddress}`);
        
        // Cache the results
        holderCache.set(cacheKey, {
          holders,
          totalSupply,
          timestamp: now
        });
        
        return NextResponse.json({
          holders,
          totalSupply,
          cached: false
        }, { headers: baseHeaders });
      })(),
      globalTimeout
    ]);
  } catch (error) {
    console.error('Error fetching token holders:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408, headers: baseHeaders }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch token holders' },
      { status: 500, headers: baseHeaders }
    );
  }
}

export const maxDuration = 15; // 15 seconds for Vercel serverless function
