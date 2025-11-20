import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, RateLimitError } from '@/lib/api/rate-limit';
import MoralisAPI from '@/lib/external-apis/moralis-api';

// Rate limit configuration for portfolio data
const PORTFOLIO_RATE_LIMIT = {
  limit: 100,
  windowMs: 60000, // 1 minute
  maxRetries: 2,
  initialRetryDelay: 1000,
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const baseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  // Timeout for the entire request
  const globalTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Global request timeout')), 30000); // 30 seconds
  });

  try {
    return await Promise.race([
      (async () => {
        // Apply rate limiting
        try {
          await rateLimiter.rateLimit('PORTFOLIO_DATA', PORTFOLIO_RATE_LIMIT);
        } catch (error) {
          if (error instanceof RateLimitError) {
            console.warn('Rate limit exceeded for PORTFOLIO_DATA');
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

        // Validate address format
        if (!address || address.length < 32 || address.length > 44) {
          return NextResponse.json(
            { error: 'Invalid address format' },
            { status: 400, headers: baseHeaders }
          );
        }

        console.log(`Fetching portfolio data for address: ${address}`);

        // Get comprehensive portfolio data from Moralis
        const [nativeBalance, tokenBalances] = await Promise.all([
          MoralisAPI.getNativeBalance(address, 'mainnet').catch(error => {
            console.warn('Failed to fetch native balance:', error);
            return null;
          }),
          MoralisAPI.getTokenBalances(address, 'mainnet').catch(error => {
            console.warn('Failed to fetch token balances:', error);
            return null;
          })
        ]);

        const result: any = {
          address,
          timestamp: new Date().toISOString(),
          data: {
            native: {
              balance: 0,
              symbol: 'SOL',
              name: 'Solana',
              decimals: 9,
              price: null,
              value: null,
              change24h: null
            },
            tokens: [],
            totalValue: null,
            totalTokens: 0,
            summary: {
              hasData: false,
              dataSource: 'moralis',
              pricesAvailable: false
            }
          }
        };

        // Process native SOL balance
        if (nativeBalance && nativeBalance.lamports) {
          result.data.native.balance = nativeBalance.lamports / 1e9; // Convert lamports to SOL
          
          // Try to get SOL price
          try {
            const solPrice = await MoralisAPI.getTokenPrice('So11111111111111111111111111111111111111112', 'mainnet');
            if (solPrice && solPrice.usdPrice) {
              result.data.native.price = solPrice.usdPrice;
              result.data.native.value = result.data.native.balance * solPrice.usdPrice;
              result.data.native.change24h = solPrice.change24h || 0;
              result.data.summary.pricesAvailable = true;
            }
          } catch (error) {
            console.warn('Failed to fetch SOL price:', error);
          }
        }

        // Process token balances
        if (tokenBalances && tokenBalances.result && Array.isArray(tokenBalances.result)) {
          const tokens = [];
          const pricePromises = [];

          for (const token of tokenBalances.result) {
            if (!token.mint || !token.amount) continue;

            const tokenData: any = {
              mint: token.mint,
              balance: parseFloat(token.amount) / Math.pow(10, token.decimals || 9),
              symbol: token.symbol || token.name || 'Unknown',
              name: token.name || 'Unknown Token',
              decimals: token.decimals || 9,
              price: null,
              value: null,
              change24h: null,
              logo: token.logo || null
            };

            tokens.push(tokenData);

            // Queue price fetch for this token
            pricePromises.push(
              MoralisAPI.getTokenPrice(token.mint, 'mainnet')
                .then(priceData => {
                  if (priceData && priceData.usdPrice) {
                    tokenData.price = priceData.usdPrice;
                    tokenData.value = tokenData.balance * priceData.usdPrice;
                    tokenData.change24h = priceData.change24h || 0;
                    result.data.summary.pricesAvailable = true;
                  }
                  return tokenData;
                })
                .catch(error => {
                  console.warn(`Failed to fetch price for token ${token.mint}:`, error);
                  return tokenData;
                })
            );
          }

          // Wait for all price fetches to complete (with timeout)
          try {
            await Promise.race([
              Promise.all(pricePromises),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Price fetch timeout')), 15000)
              )
            ]);
          } catch (error) {
            console.warn('Some price fetches timed out or failed:', error);
          }

          result.data.tokens = tokens;
          result.data.totalTokens = tokens.length;
        }

        // Calculate total portfolio value if we have prices
        if (result.data.summary.pricesAvailable) {
          let totalValue = 0;
          
          if (result.data.native.value) {
            totalValue += result.data.native.value;
          }
          
          for (const token of result.data.tokens) {
            if (token.value) {
              totalValue += token.value;
            }
          }
          
          result.data.totalValue = totalValue;
        }

        result.data.summary.hasData = result.data.native.balance > 0 || result.data.tokens.length > 0;

        console.log(`Portfolio data fetched for ${address}: ${result.data.totalTokens} tokens, total value: ${result.data.totalValue || 'unknown'}`);

        return NextResponse.json(result, { headers: baseHeaders });

      })(),
      globalTimeout
    ]);
  } catch (error) {
    console.error('Error fetching portfolio data:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408, headers: baseHeaders }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch portfolio data',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500, headers: baseHeaders }
    );
  }
}
