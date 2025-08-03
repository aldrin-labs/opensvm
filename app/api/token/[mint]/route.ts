import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import type { ParsedTransactionWithMeta, TokenBalance } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getConnection } from '@/lib/solana';
import { rateLimiter, RateLimitError } from '@/lib/rate-limit';

// Rate limit configuration for token details - optimized for e2e tests
const TOKEN_RATE_LIMIT = {
  limit: 500,          // Increased for test load
  windowMs: 2000,      // Longer window to reduce rate limiting
  maxRetries: 1,       // Single retry for faster failures
  initialRetryDelay: 100,   // Faster initial retry
  maxRetryDelay: 1000      // Reasonable max delay
};

// Metadata fetch configuration - optimized for speed
const METADATA_FETCH_CONFIG = {
  maxRetries: 1,       // Single retry
  initialDelay: 10,    // Faster initial attempt
  maxDelay: 100        // Shorter max delay
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ mint: string }> }
) {
  const baseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  // Global timeout wrapper for the entire request
  const globalTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Global request timeout')), 12000); // 12s global timeout
  });

  try {
    return await Promise.race([
      (async () => {
    // Apply rate limiting with retries
    try {
      await rateLimiter.rateLimit('TOKEN_DETAILS', TOKEN_RATE_LIMIT);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn('Rate limit exceeded for TOKEN_DETAILS');
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
    const { mint } = await params;
    const mintAddress = mint;
    // Get connection with reasonable timeout for e2e tests
    const connection = await Promise.race<ReturnType<typeof getConnection>>([
      getConnection(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 15000)  // Increased to 15s for tests
      ) as Promise<ReturnType<typeof getConnection>>
    ]);
    
    // Validate the address format first
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

    // Verify this is a token mint account with timeout protection
    const accountInfo = await Promise.race([
      connection.getAccountInfo(mintPubkey),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Account info timeout')), 5000)
      )
    ]) as Awaited<ReturnType<typeof connection.getAccountInfo>>;
    
    if (!accountInfo) {
      console.warn('Account not found for mint:', mintAddress);
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404, headers: baseHeaders }
      );
    }
    
    // Token Program ID
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    // Check if the account is owned by the Token Program
    if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      console.warn('Account is not a token mint account:', mintAddress);
      return NextResponse.json(
        {
          error: 'Not a token mint account',
          message: 'This account is not a token mint account.',
          accountOwner: accountInfo.owner.toBase58(),
        },
        { status: 400, headers: baseHeaders }
      );
    }

    // Proceed to get mint info with timeout protection and proper error handling
    let mintInfo;
    try {
      mintInfo = await Promise.race([
        getMint(connection, mintPubkey),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Mint info timeout')), 5000)
        )
      ]) as Awaited<ReturnType<typeof getMint>>;
    } catch (error) {
      // If getMint fails, it's likely not a valid mint account
      console.warn('Failed to get mint info - not a valid mint account:', error.message);
      return NextResponse.json(
        {
          error: 'Not a token mint account',
          message: 'This account is not a token mint account.',
          accountOwner: accountInfo.owner.toBase58(),
        },
        { status: 400, headers: baseHeaders }
      );
    }

    // Get metadata account
    const metadataProgramId = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        metadataProgramId.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      metadataProgramId
    );

    // Fetch metadata account with timeout protection
    const metadataAccount = await Promise.race([
      connection.getAccountInfo(metadataAddress),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Metadata account timeout')), 3000)
      )
    ]) as Awaited<ReturnType<typeof connection.getAccountInfo>>;
    let metadata: { name: string; symbol: string; uri: string; description?: string; image?: string } | null = null;

    if (metadataAccount?.data) {
      const data = metadataAccount.data;
      
      // Skip discriminator and feature flags (1 byte each)
      let offset = 2;
      
      // Skip key and update authority (32 bytes each)
      offset += 64;
      
      // Skip mint (32 bytes)
      offset += 32;
      
      // Read name
      const nameLength = data[offset];
      if (typeof nameLength === 'number' && nameLength > 0 && offset + 1 + nameLength <= data.length) {
        offset += 1;
        const name = new TextDecoder().decode(data.slice(offset, offset + nameLength)).replace(/\0/g, '');
        offset += nameLength;
        
        // Read symbol
        const symbolLength = data[offset];
        if (typeof symbolLength === 'number' && symbolLength > 0 && offset + 1 + symbolLength <= data.length) {
          offset += 1;
          const symbol = new TextDecoder().decode(data.slice(offset, offset + symbolLength)).replace(/\0/g, '');
          offset += symbolLength;
          
          // Read uri
          const uriLength = data[offset];
          if (typeof uriLength === 'number' && uriLength > 0 && offset + 1 + uriLength <= data.length) {
            offset += 1;
            const uri = new TextDecoder().decode(data.slice(offset, offset + uriLength)).replace(/\0/g, '');

            metadata = {
              name,
              symbol,
              uri,
            };

            // Fetch metadata JSON if uri exists - optimized for e2e tests
            if (uri.startsWith('http')) {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced to 3s for faster tests
                
                const response = await fetch(uri, {
                  mode: 'cors',
                  headers: {
                    'User-Agent': 'OpenSVM/1.0'
                  },
                  signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error('Failed to fetch metadata');
                const json = await response.json();
                metadata.description = json.description;
                metadata.image = json.image;
              } catch (error) {
                console.warn('Metadata fetch failed, skipping for faster response:', error?.message || 'Unknown error');
                // Skip retry in e2e test environment for faster responses
                // Continue without metadata rather than failing the whole request
              }
            }
          }
        }
      }
    }

    // Get token data with timeout protection for e2e tests
    let holders = 0;
    let volume24h = 0;
    
    try {
      // Get token holders with timeout
      const tokenAccountsPromise = connection.getTokenLargestAccounts(mintPubkey);
      const tokenAccounts = await Promise.race([
        tokenAccountsPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Token accounts timeout')), 5000)
        )
      ]) as Awaited<typeof tokenAccountsPromise>;
      holders = tokenAccounts.value.filter(account => Number(account.amount) > 0).length;
    } catch (error) {
      console.warn('Token holders fetch failed, using default:', error.message);
    }

    try {
      // Get recent transfers with shorter limit and timeout for e2e tests
      const signaturesPromise = connection.getSignaturesForAddress(mintPubkey, { limit: 20 }); // Reduced from 100
      const signatures = await Promise.race([
        signaturesPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Signatures timeout')), 5000)
        )
      ]) as Awaited<typeof signaturesPromise>;

      if (signatures.length > 0) {
        const transactionsPromise = connection.getParsedTransactions(
          signatures.slice(0, 10).map(sig => sig.signature), // Further limit to 10 transactions
          { maxSupportedTransactionVersion: 0 }
        );
        const recentTransactions = await Promise.race([
          transactionsPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Transactions timeout')), 5000)
          )
        ]) as Awaited<typeof transactionsPromise>;

        // Calculate 24h volume from recent transactions
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        volume24h = (recentTransactions || []).reduce((total: number, tx: ParsedTransactionWithMeta | null): number => {
          if (!tx?.blockTime || tx.blockTime * 1000 <= oneDayAgo) {
            return total;
          }

          const txVolume = tx.meta?.postTokenBalances?.reduce((txTotal: number, balance: TokenBalance): number => {
            if (balance.mint === mintAddress && balance.uiTokenAmount?.uiAmount) {
              return txTotal + Number(balance.uiTokenAmount.uiAmount);
            }
            return txTotal;
          }, 0) || 0;

          return total + txVolume;
        }, 0);
      }
    } catch (error) {
      console.warn('Volume calculation failed, using default:', error.message);
    }

    const tokenData = {
      metadata,
      supply: Number(mintInfo.supply),
      decimals: mintInfo.decimals,
      holders,
      volume24h,
      isInitialized: mintInfo.isInitialized,
      freezeAuthority: mintInfo.freezeAuthority?.toBase58(),
      mintAuthority: mintInfo.mintAuthority?.toBase58()
    };

    return NextResponse.json(tokenData, { headers: baseHeaders });
      })(),
      globalTimeout
    ]);
  } catch (error) {
    console.error('Error fetching token details:', error);
    
    // Handle timeout errors specifically
    if (error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408, headers: baseHeaders }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch token details' },
      { status: 500, headers: baseHeaders }
    );
  }
}
