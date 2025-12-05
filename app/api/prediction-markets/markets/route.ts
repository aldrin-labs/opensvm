import { NextRequest, NextResponse } from 'next/server';
import { getAggregator, Platform } from '@/lib/prediction-markets/aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/prediction-markets/markets
 * Returns markets from all platforms with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const aggregator = getAggregator();
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const platform = searchParams.get('platform') as Platform | null;
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort') || 'volume';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Ensure we have data
    let metrics = aggregator.getMetrics();
    if (!metrics) {
      await aggregator.aggregateMetrics();
    }

    // Get markets
    let markets = search
      ? aggregator.searchMarkets(search)
      : platform
        ? aggregator.getMarketsByPlatform(platform)
        : Array.from(aggregator.getMarketsByPlatform('kalshi'))
          .concat(aggregator.getMarketsByPlatform('polymarket'))
          .concat(aggregator.getMarketsByPlatform('manifold'))
          .concat(aggregator.getMarketsByPlatform('drift'));

    // Sort markets
    switch (sortBy) {
      case 'volume':
        markets.sort((a, b) => b.currentPrice.volume24h - a.currentPrice.volume24h);
        break;
      case 'liquidity':
        markets.sort((a, b) => b.currentPrice.liquidity - a.currentPrice.liquidity);
        break;
      case 'price':
        markets.sort((a, b) => b.currentPrice.yesPrice - a.currentPrice.yesPrice);
        break;
      case 'recent':
        markets.sort((a, b) => b.lastUpdated - a.lastUpdated);
        break;
    }

    // Paginate
    const total = markets.length;
    const paginatedMarkets = markets.slice(offset, offset + limit);

    // Format response
    const formattedMarkets = paginatedMarkets.map(m => ({
      id: m.id,
      platform: m.platform,
      ticker: m.ticker,
      title: m.title,
      description: m.description,
      category: m.category,
      yesPrice: m.currentPrice.yesPrice,
      noPrice: m.currentPrice.noPrice,
      volume24h: m.currentPrice.volume24h,
      liquidity: m.currentPrice.liquidity,
      closeTime: m.closeTime?.toISOString(),
      resolved: m.resolved,
      outcome: m.outcome,
      lastUpdated: m.lastUpdated,
      priceHistory: m.priceHistory.slice(-24).map(p => ({
        timestamp: p.timestamp,
        yesPrice: p.yesPrice,
      })),
    }));

    return NextResponse.json({
      markets: formattedMarkets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (error) {
    console.error('[API] Prediction markets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
