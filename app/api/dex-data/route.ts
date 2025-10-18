import { NextRequest, NextResponse } from 'next/server';
import { aggregateDEXData, detectArbitrageOpportunities } from '@/lib/dex-integration';
import { rateLimit, RateLimitError } from '@/lib/rate-limit';

const DEX_RATE_LIMIT = {
  limit: 10,
  windowMs: 60000, // 1 minute
  maxRetries: 3,
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

export async function GET(request: NextRequest) {
  const baseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  try {
    // Apply rate limiting
    try {
      await rateLimit('dex-data', DEX_RATE_LIMIT);
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

    const { searchParams } = new URL(request.url);
    const tokensParam = searchParams.get('tokens');
    const includeArbitrage = searchParams.get('arbitrage') === 'true';
    
    // Parse token mints if provided
    let tokenMints: string[] | undefined;
    if (tokensParam) {
      try {
        tokenMints = tokensParam.split(',').map(t => t.trim()).filter(Boolean);
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid tokens parameter format' },
          { status: 400, headers: baseHeaders }
        );
      }
    }

    // Fetch aggregated DEX data
    const dexData = await aggregateDEXData(tokenMints);
    
    // Detect arbitrage opportunities if requested
    let arbitrageOpportunities = [];
    if (includeArbitrage && dexData.prices.length > 0) {
      arbitrageOpportunities = detectArbitrageOpportunities(dexData.prices);
    }

    const response = {
      ...dexData,
      arbitrageOpportunities,
      metadata: {
        timestamp: Date.now(),
        priceCount: dexData.prices.length,
        poolCount: dexData.pools.length,
        arbitrageCount: arbitrageOpportunities.length,
      }
    };

    return NextResponse.json(response, { headers: baseHeaders });
  } catch (error) {
    console.error('Error fetching DEX data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DEX data' },
      { status: 500, headers: baseHeaders }
    );
  }
}