import { NextRequest, NextResponse } from 'next/server';
import { getAggregator } from '@/lib/prediction-markets/aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/prediction-markets/metrics
 * Returns aggregated metrics from all prediction market platforms
 */
export async function GET(request: NextRequest) {
  try {
    const aggregator = getAggregator();

    // Check if we have cached metrics
    let metrics = aggregator.getMetrics();

    // If no cached metrics or stale (> 2 minutes), fetch fresh
    if (!metrics || Date.now() - metrics.timestamp > 120000) {
      metrics = await aggregator.aggregateMetrics();
    }

    // Parse optional filters
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const includeArbitrage = searchParams.get('arbitrage') !== 'false';
    const includeVolumeHistory = searchParams.get('volumeHistory') !== 'false';

    // Filter by platform if specified
    if (platform) {
      const validPlatforms = ['kalshi', 'polymarket', 'manifold', 'drift'];
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json(
          { error: 'Invalid platform. Must be one of: kalshi, polymarket, manifold, drift' },
          { status: 400 }
        );
      }

      const platformMetrics = metrics.platforms.find(p => p.platform === platform);
      return NextResponse.json({
        timestamp: metrics.timestamp,
        platform: platformMetrics,
        trendingTopics: metrics.trendingTopics,
      });
    }

    // Build response
    const response = {
      timestamp: metrics.timestamp,
      platforms: metrics.platforms.map(p => ({
        platform: p.platform,
        totalMarkets: p.totalMarkets,
        activeMarkets: p.activeMarkets,
        totalVolume24h: p.totalVolume24h,
        totalLiquidity: p.totalLiquidity,
        avgSpread: p.avgSpread,
        topMarkets: p.topMarkets.slice(0, 5).map(m => ({
          id: m.id,
          title: m.title,
          yesPrice: m.currentPrice.yesPrice,
          volume24h: m.currentPrice.volume24h,
        })),
        lastUpdated: p.lastUpdated,
      })),
      summary: {
        totalMarkets: metrics.platforms.reduce((sum, p) => sum + p.totalMarkets, 0),
        totalVolume24h: metrics.platforms.reduce((sum, p) => sum + p.totalVolume24h, 0),
        totalLiquidity: metrics.platforms.reduce((sum, p) => sum + p.totalLiquidity, 0),
        crossPlatformMarkets: metrics.crossPlatformMarkets.length,
        arbitrageOpportunities: metrics.arbitrageOpportunities.length,
      },
      trendingTopics: metrics.trendingTopics.slice(0, 10),
      ...(includeArbitrage && {
        arbitrageOpportunities: metrics.arbitrageOpportunities.slice(0, 10),
      }),
      ...(includeVolumeHistory && {
        volumeChart: metrics.volumeChart.slice(-48), // Last 4 hours
      }),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('[API] Prediction markets metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prediction market metrics' },
      { status: 500 }
    );
  }
}
