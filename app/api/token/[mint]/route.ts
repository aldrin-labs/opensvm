import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import type { ParsedTransactionWithMeta, TokenBalance } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getConnection } from '@/lib/solana';
import { rateLimiter, RateLimitError } from '@/lib/rate-limit';

// Rate limit configuration for token details
const TOKEN_RATE_LIMIT = {
  limit: 5,          // 5 requests
  windowMs: 500,    // per 5 seconds
  maxRetries: 10,     // Allow 10 retries
  initialRetryDelay: 10,
  maxRetryDelay: 3000
};

// Metadata fetch configuration
const METADATA_FETCH_CONFIG = {
  maxRetries: 3,
  initialDelay: 10,
  maxDelay: 50
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

  try {
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
    // Get connection with timeout
    const connection = await Promise.race<ReturnType<typeof getConnection>>([
      getConnection(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 30000)
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

    // Verify this is a token mint account
    const accountInfo = await connection.getAccountInfo(mintPubkey);
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

    // Proceed to get mint info
    const mintInfo = await getMint(connection, mintPubkey);

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

    // Fetch metadata account
    const metadataAccount = await connection.getAccountInfo(metadataAddress);
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

            // Fetch metadata JSON if uri exists
            if (uri.startsWith('http')) {
              try {
                const response = await fetch(uri, {
                  mode: 'cors',
                  headers: {
                    'User-Agent': 'OpenSVM/1.0'
                  }
                });
                if (!response.ok) throw new Error('Failed to fetch metadata');
                const json = await response.json();
                metadata.description = json.description;
                metadata.image = json.image;
              } catch (error) {
                console.error('Error fetching metadata JSON:', error);
                // Enhanced retry logic with exponential backoff
                let delay = METADATA_FETCH_CONFIG.initialDelay;
                for (let attempt = 1; attempt <= METADATA_FETCH_CONFIG.maxRetries; attempt++) {
                  try {
                    // Add jitter to prevent thundering herd
                    const jitter = Math.random() * 200;
                    await new Promise(resolve => setTimeout(resolve, delay + jitter));
                    
                    const retryResponse = await fetch(uri, {
                      mode: 'cors',
                      headers: {
                        'User-Agent': 'OpenSVM/1.0'
                      }
                    });
                    
                    if (retryResponse.ok) {
                      const json = await retryResponse.json();
                      metadata.description = json.description;
                      metadata.image = json.image;
                      break;
                    }
                    
                    // If we get a rate limit response, honor the Retry-After header
                    if (retryResponse.status === 429) {
                      const retryAfter = retryResponse.headers.get('Retry-After');
                      if (retryAfter) {
                        delay = Math.min(
                          parseInt(retryAfter) * 1000,
                          METADATA_FETCH_CONFIG.maxDelay
                        );
                      }
                    }
                  } catch (retryError) {
                    console.error(
                      `Metadata fetch retry failed (${attempt}/${METADATA_FETCH_CONFIG.maxRetries}):`,
                      retryError
                    );
                  }
                  
                  // Exponential backoff
                  delay = Math.min(delay * 2, METADATA_FETCH_CONFIG.maxDelay);
                }
              }
            }
          }
        }
      }
    }

    // Get token holders
    const tokenAccounts = await connection.getTokenLargestAccounts(mintPubkey);
    const holders = tokenAccounts.value.filter(account => Number(account.amount) > 0).length;

    // Get recent token transfers
    const signatures = await connection.getSignaturesForAddress(mintPubkey, { limit: 100 });
    const recentTransactions = await connection.getParsedTransactions(
      signatures.map(sig => sig.signature),
      { maxSupportedTransactionVersion: 0 }
    );

    // Calculate 24h volume from recent transactions
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const volume24h = (recentTransactions || []).reduce((total: number, tx: ParsedTransactionWithMeta | null): number => {
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
  } catch (error) {
    console.error('Error fetching token details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token details' },
      { status: 500, headers: baseHeaders }
    );
  }
}