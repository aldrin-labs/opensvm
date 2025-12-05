import { NextRequest, NextResponse } from 'next/server';
import { getAggregator } from '@/lib/prediction-markets/aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/prediction-markets/arbitrage
 * Returns cross-platform arbitrage opportunities
 */
export async function GET(request: NextRequest) {
  try {
    const aggregator = getAggregator();
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const minSpread = parseFloat(searchParams.get('minSpread') || '0.03');
    const minProfit = parseFloat(searchParams.get('minProfit') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Ensure we have data
    let metrics = aggregator.getMetrics();
    if (!metrics || Date.now() - metrics.timestamp > 60000) {
      metrics = await aggregator.aggregateMetrics();
    }

    // Filter arbitrage opportunities
    const opportunities = metrics.arbitrageOpportunities
      .filter(o => o.spread >= minSpread && o.expectedProfit >= minProfit)
      .slice(0, limit)
      .map(o => ({
        marketTitle: o.marketTitle,
        buyPlatform: o.buyPlatform,
        buyPrice: o.buyPrice,
        buyPricePercent: `${(o.buyPrice * 100).toFixed(1)}%`,
        sellPlatform: o.sellPlatform,
        sellPrice: o.sellPrice,
        sellPricePercent: `${(o.sellPrice * 100).toFixed(1)}%`,
        spread: o.spread,
        spreadPercent: `${(o.spread * 100).toFixed(1)}%`,
        expectedProfit: o.expectedProfit,
        expectedProfitDisplay: `${o.expectedProfit.toFixed(2)}%`,
        strategy: `Buy YES on ${o.buyPlatform} at ${(o.buyPrice * 100).toFixed(1)}%, Sell YES on ${o.sellPlatform} at ${(o.sellPrice * 100).toFixed(1)}%`,
      }));

    // Get cross-platform markets with price divergence
    const crossPlatformMarkets = metrics.crossPlatformMarkets
      .filter(cp => cp.hasArbitrage)
      .slice(0, 20)
      .map(cp => ({
        title: cp.title,
        priceDivergence: cp.priceDivergence,
        priceDivergencePercent: `${(cp.priceDivergence * 100).toFixed(1)}%`,
        platforms: cp.markets.map(m => ({
          platform: m.platform,
          yesPrice: m.yesPrice,
          yesPricePercent: `${(m.yesPrice * 100).toFixed(1)}%`,
          volume24h: m.volume24h,
        })),
      }));

    return NextResponse.json({
      timestamp: metrics.timestamp,
      summary: {
        totalOpportunities: metrics.arbitrageOpportunities.length,
        profitableOpportunities: opportunities.length,
        crossPlatformMarkets: metrics.crossPlatformMarkets.filter(cp => cp.hasArbitrage).length,
        avgSpread: opportunities.length > 0
          ? opportunities.reduce((sum, o) => sum + o.spread, 0) / opportunities.length
          : 0,
      },
      opportunities,
      crossPlatformMarkets,
      disclaimer: 'Arbitrage opportunities may disappear quickly. Fees vary by platform. Not financial advice.',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (error) {
    console.error('[API] Arbitrage endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch arbitrage opportunities' },
      { status: 500 }
    );
  }
}
