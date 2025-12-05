import { NextRequest, NextResponse } from 'next/server';
import { getAggregator, Platform } from '@/lib/prediction-markets/aggregator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const TOGETHER_MODEL = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';

interface CorrelatedPair {
  market1: {
    platform: Platform;
    id: string;
    title: string;
    yesPrice: number;
    volume24h: number;
  };
  market2: {
    platform: Platform;
    id: string;
    title: string;
    yesPrice: number;
    volume24h: number;
  };
  similarity: number;
  priceDivergence: number;
  hasArbitrage: boolean;
  arbitrageDirection?: string;
  analysis?: string;
}

interface CorrelationCluster {
  topic: string;
  markets: Array<{
    platform: Platform;
    id: string;
    title: string;
    yesPrice: number;
    volume24h: number;
  }>;
  avgPrice: number;
  priceRange: number;
  avgVolume: number;
  arbitrageOpportunities: number;
}

/**
 * GET /api/prediction-markets/correlation
 * Find correlated markets across platforms and analyze divergence
 */
export async function GET(request: NextRequest) {
  try {
    const aggregator = getAggregator();
    const searchParams = request.nextUrl.searchParams;

    const minSimilarity = parseFloat(searchParams.get('minSimilarity') || '0.5');
    const minDivergence = parseFloat(searchParams.get('minDivergence') || '0.03');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Ensure we have data
    let metrics = aggregator.getMetrics();
    if (!metrics || Date.now() - metrics.timestamp > 120000) {
      metrics = await aggregator.aggregateMetrics();
    }

    // Get all markets
    const allMarkets = [
      ...aggregator.getMarketsByPlatform('kalshi'),
      ...aggregator.getMarketsByPlatform('polymarket'),
      ...aggregator.getMarketsByPlatform('manifold'),
      ...aggregator.getMarketsByPlatform('drift'),
    ];

    // Find correlated pairs
    const correlatedPairs = findCorrelatedPairs(allMarkets, minSimilarity, minDivergence);

    // Group into clusters
    const clusters = groupIntoClusters(correlatedPairs, allMarkets);

    // Calculate summary stats
    const totalArbitrageOpps = correlatedPairs.filter(p => p.hasArbitrage).length;
    const avgDivergence = correlatedPairs.length > 0
      ? correlatedPairs.reduce((sum, p) => sum + p.priceDivergence, 0) / correlatedPairs.length
      : 0;

    return NextResponse.json({
      timestamp: Date.now(),
      summary: {
        totalCorrelatedPairs: correlatedPairs.length,
        arbitrageOpportunities: totalArbitrageOpps,
        avgPriceDivergence: avgDivergence,
        clusters: clusters.length,
      },
      correlatedPairs: correlatedPairs.slice(0, limit),
      clusters: clusters.slice(0, 20),
      topArbitrageOpportunities: correlatedPairs
        .filter(p => p.hasArbitrage)
        .sort((a, b) => b.priceDivergence - a.priceDivergence)
        .slice(0, 10)
        .map(p => ({
          market1: {
            platform: p.market1.platform,
            title: p.market1.title.slice(0, 60),
            price: `${(p.market1.yesPrice * 100).toFixed(1)}%`,
          },
          market2: {
            platform: p.market2.platform,
            title: p.market2.title.slice(0, 60),
            price: `${(p.market2.yesPrice * 100).toFixed(1)}%`,
          },
          priceDivergence: `${(p.priceDivergence * 100).toFixed(1)}%`,
          direction: p.arbitrageDirection,
        })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });

  } catch (error) {
    console.error('[Correlation API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze correlations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prediction-markets/correlation
 * AI-powered correlation analysis for specific markets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketIds, platforms } = body;

    if (!marketIds || !Array.isArray(marketIds) || marketIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 market IDs required' },
        { status: 400 }
      );
    }

    const aggregator = getAggregator();

    // Fetch the specific markets
    const markets = marketIds
      .map((id: string, i: number) => {
        const platform = platforms?.[i] || 'kalshi';
        return aggregator.getMarket(platform, id);
      })
      .filter(Boolean);

    if (markets.length < 2) {
      return NextResponse.json(
        { error: 'Could not find enough markets' },
        { status: 404 }
      );
    }

    // Build context for AI
    const context = markets.map((m, i) => `
Market ${i + 1}: ${m.title}
- Platform: ${m.platform}
- YES Price: ${(m.currentPrice.yesPrice * 100).toFixed(1)}%
- 24h Volume: $${formatNumber(m.currentPrice.volume24h)}
- Liquidity: $${formatNumber(m.currentPrice.liquidity)}
`).join('\n');

    // Calculate basic correlation metrics
    const prices = markets.map(m => m.currentPrice.yesPrice);
    const priceDivergence = Math.max(...prices) - Math.min(...prices);

    // If no API key, return basic analysis
    if (!TOGETHER_API_KEY) {
      return NextResponse.json({
        markets: markets.map(m => ({
          platform: m.platform,
          id: m.id,
          title: m.title,
          yesPrice: m.currentPrice.yesPrice,
        })),
        priceDivergence,
        hasArbitrage: priceDivergence > 0.05,
        analysis: generateBasicAnalysis(markets, priceDivergence),
      });
    }

    // Get AI analysis
    const aiResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TOGETHER_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert prediction market analyst specializing in cross-platform arbitrage and market correlation. Analyze markets for:
1. Whether they are asking the same underlying question
2. Price divergence and potential arbitrage opportunities
3. Differences in how the question is framed
4. Risk factors in exploiting any price differences

Be concise and actionable. Use markdown formatting.`,
          },
          {
            role: 'user',
            content: `Analyze the correlation between these prediction markets:\n\n${context}\n\nPrice divergence: ${(priceDivergence * 100).toFixed(1)}%\n\nProvide analysis on whether these are truly correlated and if there's an arbitrage opportunity.`,
          },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    let analysis = '';
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      analysis = aiData.choices?.[0]?.message?.content || '';
    }

    if (!analysis) {
      analysis = generateBasicAnalysis(markets, priceDivergence);
    }

    return NextResponse.json({
      markets: markets.map(m => ({
        platform: m.platform,
        id: m.id,
        title: m.title,
        yesPrice: m.currentPrice.yesPrice,
        volume24h: m.currentPrice.volume24h,
      })),
      priceDivergence,
      hasArbitrage: priceDivergence > 0.05,
      analysis,
    });

  } catch (error) {
    console.error('[Correlation API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze correlation' },
      { status: 500 }
    );
  }
}

// Helper functions

function findCorrelatedPairs(
  markets: any[],
  minSimilarity: number,
  minDivergence: number
): CorrelatedPair[] {
  const pairs: CorrelatedPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const m1 = markets[i];
      const m2 = markets[j];

      // Skip same platform
      if (m1.platform === m2.platform) continue;

      // Calculate similarity
      const similarity = calculateSimilarity(m1.title, m2.title);
      if (similarity < minSimilarity) continue;

      // Avoid duplicates
      const pairKey = [m1.id, m2.id].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const priceDivergence = Math.abs(m1.currentPrice.yesPrice - m2.currentPrice.yesPrice);
      const hasArbitrage = priceDivergence >= minDivergence;

      let arbitrageDirection = undefined;
      if (hasArbitrage) {
        const buyMarket = m1.currentPrice.yesPrice < m2.currentPrice.yesPrice ? m1 : m2;
        const sellMarket = m1.currentPrice.yesPrice < m2.currentPrice.yesPrice ? m2 : m1;
        arbitrageDirection = `Buy YES on ${buyMarket.platform} @ ${(buyMarket.currentPrice.yesPrice * 100).toFixed(1)}%, Sell on ${sellMarket.platform} @ ${(sellMarket.currentPrice.yesPrice * 100).toFixed(1)}%`;
      }

      pairs.push({
        market1: {
          platform: m1.platform,
          id: m1.id,
          title: m1.title,
          yesPrice: m1.currentPrice.yesPrice,
          volume24h: m1.currentPrice.volume24h,
        },
        market2: {
          platform: m2.platform,
          id: m2.id,
          title: m2.title,
          yesPrice: m2.currentPrice.yesPrice,
          volume24h: m2.currentPrice.volume24h,
        },
        similarity,
        priceDivergence,
        hasArbitrage,
        arbitrageDirection,
      });
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

function groupIntoClusters(
  pairs: CorrelatedPair[],
  allMarkets: any[]
): CorrelationCluster[] {
  const clusters: Map<string, Set<string>> = new Map();
  const marketMap = new Map(allMarkets.map(m => [`${m.platform}:${m.id}`, m]));

  // Union-find to group correlated markets
  pairs.forEach(pair => {
    const key1 = `${pair.market1.platform}:${pair.market1.id}`;
    const key2 = `${pair.market2.platform}:${pair.market2.id}`;

    // Find existing cluster
    let clusterKey = null;
    for (const [topic, members] of clusters) {
      if (members.has(key1) || members.has(key2)) {
        clusterKey = topic;
        break;
      }
    }

    if (clusterKey) {
      clusters.get(clusterKey)!.add(key1);
      clusters.get(clusterKey)!.add(key2);
    } else {
      // Create new cluster
      const topic = extractTopic(pair.market1.title);
      clusters.set(topic, new Set([key1, key2]));
    }
  });

  // Convert to cluster objects
  const result: CorrelationCluster[] = [];

  clusters.forEach((members, topic) => {
    const markets = Array.from(members)
      .map(key => marketMap.get(key))
      .filter(Boolean)
      .map(m => ({
        platform: m.platform,
        id: m.id,
        title: m.title,
        yesPrice: m.currentPrice.yesPrice,
        volume24h: m.currentPrice.volume24h,
      }));

    if (markets.length < 2) return;

    const prices = markets.map(m => m.yesPrice);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const priceRange = Math.max(...prices) - Math.min(...prices);
    const avgVolume = markets.reduce((sum, m) => sum + m.volume24h, 0) / markets.length;

    // Count arbitrage opportunities within cluster
    let arbOpps = 0;
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        if (Math.abs(markets[i].yesPrice - markets[j].yesPrice) > 0.05) {
          arbOpps++;
        }
      }
    }

    result.push({
      topic,
      markets,
      avgPrice,
      priceRange,
      avgVolume,
      arbitrageOpportunities: arbOpps,
    });
  });

  return result.sort((a, b) => b.arbitrageOpportunities - a.arbitrageOpportunities);
}

function calculateSimilarity(title1: string, title2: string): number {
  const normalize = (s: string) => s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const words1 = new Set(normalize(title1));
  const words2 = new Set(normalize(title2));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function extractTopic(title: string): string {
  // Extract key topic from title
  const keywords = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !['will', 'when', 'what', 'where', 'which'].includes(w))
    .slice(0, 3);

  return keywords.join(' ') || title.slice(0, 30);
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function generateBasicAnalysis(markets: any[], priceDivergence: number): string {
  const platforms = markets.map(m => m.platform).join(' vs ');
  const prices = markets.map(m => `${m.platform}: ${(m.currentPrice.yesPrice * 100).toFixed(1)}%`).join(', ');

  if (priceDivergence < 0.02) {
    return `## Correlation Analysis

**Markets appear well-aligned** across ${platforms}.

Current prices: ${prices}

The ${(priceDivergence * 100).toFixed(1)}% price difference is within normal market noise and likely reflects minor timing differences or liquidity variations.

**Recommendation:** No significant arbitrage opportunity. Monitor for future divergence.`;
  }

  if (priceDivergence < 0.05) {
    return `## Correlation Analysis

**Moderate price divergence** detected between ${platforms}.

Current prices: ${prices}

The ${(priceDivergence * 100).toFixed(1)}% spread may offer a small edge but likely won't cover trading fees on most platforms.

**Considerations:**
- Platform fees typically range 1-2%
- Execution risk may eliminate edge
- Monitor for larger divergence`;
  }

  const sorted = [...markets].sort((a, b) => a.currentPrice.yesPrice - b.currentPrice.yesPrice);
  const buyPlatform = sorted[0].platform;
  const sellPlatform = sorted[sorted.length - 1].platform;

  return `## Correlation Analysis

**Significant arbitrage opportunity** detected!

Current prices: ${prices}

Price divergence: **${(priceDivergence * 100).toFixed(1)}%**

**Strategy:**
1. Buy YES on ${buyPlatform} at ${(sorted[0].currentPrice.yesPrice * 100).toFixed(1)}%
2. Sell YES on ${sellPlatform} at ${(sorted[sorted.length - 1].currentPrice.yesPrice * 100).toFixed(1)}%
3. Expected gross profit: ~${(priceDivergence * 100).toFixed(1)}% minus fees

**Risk factors:**
- Ensure markets resolve to the same outcome
- Check settlement terms match
- Consider platform withdrawal times
- Account for trading fees (~2-4% round trip)`;
}
