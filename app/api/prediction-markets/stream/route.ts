import { NextRequest } from 'next/server';
import { getAggregator } from '@/lib/prediction-markets/aggregator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/prediction-markets/stream
 * Server-Sent Events stream for real-time prediction market updates
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const aggregator = getAggregator();

  // Start auto-refresh if not already running
  aggregator.startAutoRefresh(30000); // 30 second updates

  const stream = new ReadableStream({
    start(controller) {
      // Send initial metrics
      const initialMetrics = aggregator.getMetrics();
      if (initialMetrics) {
        const data = JSON.stringify({
          type: 'metrics',
          data: {
            timestamp: initialMetrics.timestamp,
            platforms: initialMetrics.platforms.map(p => ({
              platform: p.platform,
              totalMarkets: p.totalMarkets,
              totalVolume24h: p.totalVolume24h,
              avgSpread: p.avgSpread,
            })),
            arbitrageCount: initialMetrics.arbitrageOpportunities.length,
            trendingTopics: initialMetrics.trendingTopics.slice(0, 5),
          },
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Subscribe to updates
      const unsubscribe = aggregator.subscribe((metrics) => {
        try {
          const data = JSON.stringify({
            type: 'update',
            data: {
              timestamp: metrics.timestamp,
              platforms: metrics.platforms.map(p => ({
                platform: p.platform,
                totalMarkets: p.totalMarkets,
                activeMarkets: p.activeMarkets,
                totalVolume24h: p.totalVolume24h,
                totalLiquidity: p.totalLiquidity,
                avgSpread: p.avgSpread,
              })),
              summary: {
                totalMarkets: metrics.platforms.reduce((sum, p) => sum + p.totalMarkets, 0),
                totalVolume24h: metrics.platforms.reduce((sum, p) => sum + p.totalVolume24h, 0),
                crossPlatformMarkets: metrics.crossPlatformMarkets.length,
                arbitrageOpportunities: metrics.arbitrageOpportunities.length,
              },
              arbitrageOpportunities: metrics.arbitrageOpportunities.slice(0, 5).map(a => ({
                marketTitle: a.marketTitle.slice(0, 50),
                buyPlatform: a.buyPlatform,
                sellPlatform: a.sellPlatform,
                spread: a.spread,
                expectedProfit: a.expectedProfit,
              })),
              trendingTopics: metrics.trendingTopics.slice(0, 5),
              volumePoint: metrics.volumeChart.slice(-1)[0],
            },
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (e) {
          console.error('[Stream] Error encoding update:', e);
        }
      });

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
