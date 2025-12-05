import { NextRequest, NextResponse } from 'next/server';
import { getAggregator } from '@/lib/prediction-markets/aggregator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const TOGETHER_MODEL = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';

interface AnalysisRequest {
  type: 'overview' | 'market' | 'arbitrage' | 'trending';
  marketId?: string;
  platform?: string;
}

/**
 * POST /api/prediction-markets/analysis
 * AI-powered market analysis using Together AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalysisRequest;
    const { type, marketId, platform } = body;

    const aggregator = getAggregator();
    let metrics = aggregator.getMetrics();

    if (!metrics) {
      metrics = await aggregator.aggregateMetrics();
    }

    // Build context based on analysis type
    let context = '';
    let prompt = '';

    switch (type) {
      case 'overview':
        context = buildOverviewContext(metrics);
        prompt = `Analyze the current state of prediction markets across platforms. Provide insights on:
1. Overall market sentiment and activity
2. Notable trends or patterns
3. Platform comparison
4. Key opportunities or risks

Be concise but insightful. Format with clear sections.`;
        break;

      case 'market':
        if (!marketId || !platform) {
          return NextResponse.json(
            { error: 'marketId and platform required for market analysis' },
            { status: 400 }
          );
        }
        const market = aggregator.getMarket(platform as any, marketId);
        if (!market) {
          return NextResponse.json(
            { error: 'Market not found' },
            { status: 404 }
          );
        }
        context = buildMarketContext(market, metrics);
        prompt = `Analyze this prediction market and provide insights on:
1. Current probability and what it suggests
2. Market dynamics (volume, liquidity, spread)
3. Comparison with similar markets on other platforms (if available)
4. Key factors to watch

Be direct and actionable.`;
        break;

      case 'arbitrage':
        context = buildArbitrageContext(metrics);
        prompt = `Analyze the cross-platform arbitrage opportunities in prediction markets:
1. Most promising opportunities and their risks
2. Platform-specific considerations
3. Execution strategy suggestions
4. Warning about potential pitfalls

Focus on practical insights for traders.`;
        break;

      case 'trending':
        context = buildTrendingContext(metrics);
        prompt = `Analyze the trending topics in prediction markets:
1. What's driving interest in these topics
2. Correlation between topics
3. Market sentiment by topic
4. Emerging trends to watch

Provide forward-looking insights.`;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid analysis type' },
          { status: 400 }
        );
    }

    // Call Together AI
    if (!TOGETHER_API_KEY) {
      // Return mock analysis if no API key
      return NextResponse.json({
        analysis: getMockAnalysis(type),
        type,
        timestamp: Date.now(),
        model: 'mock',
      });
    }

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
            content: `You are an expert prediction market analyst. Analyze market data and provide actionable insights. Be concise, data-driven, and highlight the most important patterns. Use markdown formatting for readability. Never provide financial advice - only analysis of probabilities and market dynamics.`,
          },
          {
            role: 'user',
            content: `Here is the current prediction market data:\n\n${context}\n\n${prompt}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      console.error('[AI Analysis] Together API error:', await aiResponse.text());
      return NextResponse.json({
        analysis: getMockAnalysis(type),
        type,
        timestamp: Date.now(),
        model: 'fallback',
      });
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || getMockAnalysis(type);

    return NextResponse.json({
      analysis,
      type,
      timestamp: Date.now(),
      model: TOGETHER_MODEL,
    });

  } catch (error) {
    console.error('[AI Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}

function buildOverviewContext(metrics: any): string {
  const platforms = metrics.platforms.map((p: any) =>
    `${p.platform}: ${p.activeMarkets} active markets, $${formatNumber(p.totalVolume24h)} 24h volume, ${(p.avgSpread * 100).toFixed(2)}% avg spread`
  ).join('\n');

  const trending = metrics.trendingTopics.slice(0, 10).map((t: any) =>
    `- ${t.topic}: ${t.marketCount} markets, $${formatNumber(t.totalVolume)} volume, ${(t.avgProbability * 100).toFixed(0)}% avg probability`
  ).join('\n');

  const arbitrage = metrics.arbitrageOpportunities?.slice(0, 5).map((a: any) =>
    `- ${a.marketTitle.slice(0, 50)}: Buy on ${a.buyPlatform} @ ${(a.buyPrice * 100).toFixed(0)}%, Sell on ${a.sellPlatform} @ ${(a.sellPrice * 100).toFixed(0)}%, ${(a.spread * 100).toFixed(1)}% spread`
  ).join('\n') || 'None detected';

  return `
PLATFORM OVERVIEW:
${platforms}

Total Markets: ${metrics.summary?.totalMarkets || 0}
Total 24h Volume: $${formatNumber(metrics.summary?.totalVolume24h || 0)}
Cross-Platform Markets: ${metrics.summary?.crossPlatformMarkets || 0}
Arbitrage Opportunities: ${metrics.summary?.arbitrageOpportunities || 0}

TRENDING TOPICS:
${trending}

TOP ARBITRAGE OPPORTUNITIES:
${arbitrage}
`;
}

function buildMarketContext(market: any, metrics: any): string {
  const crossPlatform = metrics.crossPlatformMarkets?.find((cp: any) =>
    cp.markets.some((m: any) => m.marketId === market.id)
  );

  let comparison = 'No cross-platform data available';
  if (crossPlatform) {
    comparison = crossPlatform.markets.map((m: any) =>
      `${m.platform}: ${(m.yesPrice * 100).toFixed(1)}% YES price, $${formatNumber(m.volume24h)} volume`
    ).join('\n');
  }

  return `
MARKET: ${market.title}
Platform: ${market.platform}
Category: ${market.category || 'Unknown'}

CURRENT PRICES:
- YES: ${(market.currentPrice.yesPrice * 100).toFixed(1)}%
- NO: ${(market.currentPrice.noPrice * 100).toFixed(1)}%
- Spread: ${((1 - market.currentPrice.yesPrice - market.currentPrice.noPrice) * 100).toFixed(2)}%

ACTIVITY:
- 24h Volume: $${formatNumber(market.currentPrice.volume24h)}
- Liquidity: $${formatNumber(market.currentPrice.liquidity)}
- Close Time: ${market.closeTime ? new Date(market.closeTime).toISOString() : 'N/A'}

CROSS-PLATFORM COMPARISON:
${comparison}
`;
}

function buildArbitrageContext(metrics: any): string {
  const opportunities = metrics.arbitrageOpportunities?.slice(0, 10).map((a: any) =>
    `
Market: ${a.marketTitle}
- Buy: ${a.buyPlatform} @ ${(a.buyPrice * 100).toFixed(1)}%
- Sell: ${a.sellPlatform} @ ${(a.sellPrice * 100).toFixed(1)}%
- Spread: ${(a.spread * 100).toFixed(1)}%
- Expected Profit: ${a.expectedProfit.toFixed(2)}%`
  ).join('\n') || 'No significant opportunities detected';

  const crossPlatform = metrics.crossPlatformMarkets?.slice(0, 5).map((cp: any) =>
    `${cp.title}: ${cp.priceDivergence * 100}% divergence across ${cp.markets.length} platforms`
  ).join('\n') || 'None';

  return `
ARBITRAGE OPPORTUNITIES:
${opportunities}

CROSS-PLATFORM PRICE DIVERGENCE:
${crossPlatform}

PLATFORM FEE ESTIMATES:
- Kalshi: ~1-2% per trade
- Polymarket: ~1% per trade
- Manifold: Play money (no real fees)
- Drift: ~0.1% per trade
`;
}

function buildTrendingContext(metrics: any): string {
  const topics = metrics.trendingTopics?.slice(0, 15).map((t: any, i: number) =>
    `${i + 1}. ${t.topic}
   - Markets: ${t.marketCount}
   - Volume: $${formatNumber(t.totalVolume)}
   - Avg Probability: ${(t.avgProbability * 100).toFixed(0)}%`
  ).join('\n') || 'No trending topics detected';

  return `
TRENDING TOPICS IN PREDICTION MARKETS:

${topics}

DATA TIMESTAMP: ${new Date(metrics.timestamp).toISOString()}
`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function getMockAnalysis(type: string): string {
  const analyses: Record<string, string> = {
    overview: `## Market Overview

**Overall Activity**: Prediction markets are showing moderate activity across platforms. Polymarket leads in volume, while Manifold has the highest market count due to its play-money nature.

**Key Trends**:
- Political markets continue to dominate volume
- Crypto-related markets showing increased interest
- Economic indicators markets gaining traction

**Platform Comparison**:
- **Kalshi**: Best for regulated, US-focused markets
- **Polymarket**: Highest liquidity for major events
- **Manifold**: Most diverse market coverage

**Opportunities**: Cross-platform price divergences exist in several political markets, though fees may eat into profits.`,

    market: `## Market Analysis

**Current State**: The market shows balanced trading with reasonable liquidity. The YES price suggests moderate confidence in the outcome.

**Key Observations**:
- Spread is within normal range for this market type
- Volume indicates active interest
- Price has been relatively stable

**Considerations**:
- Watch for news events that could move prices
- Liquidity depth should be verified before large positions
- Compare with similar markets on other platforms`,

    arbitrage: `## Arbitrage Analysis

**Top Opportunities**: Several markets show price divergence across platforms, but execution requires careful consideration.

**Key Factors**:
1. **Fees**: Platform fees (1-2%) can eliminate small spreads
2. **Timing**: Prices can converge quickly
3. **Liquidity**: May not be able to execute at quoted prices

**Strategy Notes**:
- Focus on spreads > 5% to account for fees
- Use limit orders when possible
- Consider settlement timing differences`,

    trending: `## Trending Topics Analysis

**What's Hot**:
- Political markets leading volume as expected
- Crypto/DeFi topics showing resurgence
- AI-related markets gaining attention

**Emerging Themes**:
- Increased interest in economic indicator markets
- Growing speculation on tech company announcements
- Climate-related markets expanding

**Watch List**:
- Major policy decisions upcoming
- Tech earnings season approaching
- Global event risks`,
  };

  return analyses[type] || analyses.overview;
}
