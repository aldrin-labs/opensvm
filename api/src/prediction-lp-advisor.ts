#!/usr/bin/env bun
/**
 * AI-Powered LP Strategy Advisor
 *
 * Uses multi-agent debate system to analyze LP positions and provide:
 * 1. Entry/Exit Recommendations - When to add/remove liquidity
 * 2. IL Risk Assessment - Real-time impermanent loss analysis
 * 3. Fee vs IL Optimization - Balance fee earnings against IL risk
 * 4. Market Timing - Best times to enter/exit based on volatility
 * 5. Portfolio Rebalancing - Optimal allocation across markets
 */

import {
  LPAnalytics,
  type LPPosition,
  type Chain,
  type DeFiProtocol,
} from './prediction-defi.js';

// ============================================================================
// Types
// ============================================================================

export type RecommendationType =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'reduce'
  | 'exit'
  | 'urgent_exit';

export interface PositionAnalysis {
  positionId: string;
  recommendation: RecommendationType;
  confidence: number; // 0-1
  reasoning: string;
  bullCase: string;
  bearCase: string;
  riskScore: number; // 1-10
  expectedAPY: number;
  ilRisk: 'low' | 'medium' | 'high' | 'extreme';
  timeHorizon: string;
  actionItems: string[];
}

export interface MarketConditions {
  volatility: 'low' | 'medium' | 'high';
  trend: 'bullish' | 'neutral' | 'bearish';
  volume24hChange: number;
  liquidityDepth: number;
  timeToResolution?: number; // days
}

export interface PortfolioRecommendation {
  totalPositions: number;
  healthScore: number; // 1-100
  recommendations: PositionAnalysis[];
  portfolioActions: string[];
  rebalancingSuggestions: {
    from: string;
    to: string;
    amount: number;
    reason: string;
  }[];
  riskExposure: {
    byChain: Record<Chain, number>;
    byProtocol: Record<DeFiProtocol, number>;
    concentration: number; // 0-1, higher = more concentrated
  };
}

export interface EntryAnalysis {
  market: string;
  chain: Chain;
  protocol: DeFiProtocol;
  recommendation: 'enter' | 'wait' | 'avoid';
  confidence: number;
  optimalAmount: number;
  expectedAPY: number;
  ilRiskAtEntry: number;
  breakEvenDays: number;
  bullCase: string;
  bearCase: string;
  synthesis: string;
}

// ============================================================================
// AI LP Strategy Advisor
// ============================================================================

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const TOGETHER_MODEL = 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';

export class LPStrategyAdvisor {
  private lpAnalytics: LPAnalytics;

  constructor(lpAnalytics: LPAnalytics) {
    this.lpAnalytics = lpAnalytics;
  }

  // Call Together AI for LLM analysis
  private async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    if (!TOGETHER_API_KEY) {
      return this.generateFallbackAnalysis(prompt);
    }

    try {
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: TOGETHER_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Together API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.error('LLM call failed:', e);
      return this.generateFallbackAnalysis(prompt);
    }
  }

  // Fallback analysis without LLM
  private generateFallbackAnalysis(context: string): string {
    return 'Analysis based on quantitative metrics only (AI unavailable).';
  }

  // Multi-agent debate for position analysis
  private async debatePosition(position: LPPosition): Promise<{
    bullCase: string;
    bearCase: string;
    synthesis: string;
    recommendation: RecommendationType;
    confidence: number;
  }> {
    const context = `
LP Position Analysis:
- Market: ${position.marketTitle}
- Chain: ${position.chain} / Protocol: ${position.protocol}
- Current Value: $${position.totalValue.toFixed(2)}
- P&L: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)} (${position.pnlPercent.toFixed(2)}%)
- Impermanent Loss: ${position.impermanentLoss.toFixed(2)}%
- Fees Earned: $${position.feesEarned.toFixed(2)}
- Current APY: ${position.apy.toFixed(1)}%
- Entry YES Price: ${(position.entryYesPrice * 100).toFixed(1)}%
- Current YES Price: ${(position.currentYesPrice * 100).toFixed(1)}%
- Days Held: ${((Date.now() - position.createdAt) / (1000 * 60 * 60 * 24)).toFixed(1)}
`;

    // Bull Agent
    const bullPrompt = `You are an optimistic LP analyst. Make the strongest case for HOLDING or ADDING to this position.
Focus on: fee potential, APY sustainability, IL recovery potential, market fundamentals.
${context}
Provide a concise bullish analysis in 2-3 sentences.`;

    // Bear Agent
    const bearPrompt = `You are a risk-focused LP analyst. Make the strongest case for REDUCING or EXITING this position.
Focus on: IL risks, market resolution timing, opportunity cost, volatility concerns.
${context}
Provide a concise bearish analysis in 2-3 sentences.`;

    // Synthesizer Agent
    const synthesizerSystemPrompt = `You are a balanced LP strategy advisor who weighs both bull and bear cases to make a final recommendation.
You must output JSON in this exact format:
{
  "recommendation": "strong_buy|buy|hold|reduce|exit|urgent_exit",
  "confidence": 0.0-1.0,
  "synthesis": "brief explanation"
}`;

    const [bullCase, bearCase] = await Promise.all([
      this.callLLM(bullPrompt, 'You are an optimistic LP analyst.'),
      this.callLLM(bearPrompt, 'You are a risk-focused LP analyst.'),
    ]);

    // Synthesizer makes final call
    const synthesisPrompt = `
${context}

BULL CASE: ${bullCase}

BEAR CASE: ${bearCase}

Based on both perspectives and the quantitative data, provide your final recommendation.
Consider: IL vs fees, time held, APY sustainability, market timing.
Output JSON only.`;

    const synthesisResponse = await this.callLLM(synthesisPrompt, synthesizerSystemPrompt);

    // Parse synthesis
    let recommendation: RecommendationType = 'hold';
    let confidence = 0.5;
    let synthesis = 'Hold position while monitoring IL.';

    try {
      const jsonMatch = synthesisResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendation = parsed.recommendation || 'hold';
        confidence = Math.min(1, Math.max(0, parsed.confidence || 0.5));
        synthesis = parsed.synthesis || synthesis;
      }
    } catch {
      // Use quantitative fallback
      if (position.impermanentLoss > 10) {
        recommendation = position.feesEarned > position.totalValue * 0.1 ? 'hold' : 'exit';
        confidence = 0.7;
        synthesis = `IL at ${position.impermanentLoss.toFixed(1)}% - ${recommendation === 'exit' ? 'exit recommended' : 'fees offsetting IL'}.`;
      } else if (position.pnlPercent > 20) {
        recommendation = 'reduce';
        confidence = 0.6;
        synthesis = 'Consider taking partial profits.';
      }
    }

    return { bullCase, bearCase, synthesis, recommendation, confidence };
  }

  // Analyze a single position
  async analyzePosition(positionId: string): Promise<PositionAnalysis | null> {
    const position = this.lpAnalytics.getPosition(positionId);
    if (!position) return null;

    const debate = await this.debatePosition(position);

    // Calculate risk score (1-10)
    let riskScore = 3; // Base risk
    if (position.impermanentLoss > 5) riskScore += 2;
    if (position.impermanentLoss > 10) riskScore += 2;
    if (position.apy < 10) riskScore += 1;
    if (position.totalValue > 10000) riskScore += 1;
    riskScore = Math.min(10, riskScore);

    // Determine IL risk level
    let ilRisk: 'low' | 'medium' | 'high' | 'extreme' = 'low';
    if (position.impermanentLoss > 15) ilRisk = 'extreme';
    else if (position.impermanentLoss > 8) ilRisk = 'high';
    else if (position.impermanentLoss > 3) ilRisk = 'medium';

    // Generate action items
    const actionItems: string[] = [];
    if (debate.recommendation === 'exit' || debate.recommendation === 'urgent_exit') {
      actionItems.push('Remove liquidity from this position');
      actionItems.push('Consider redeploying to a market closer to 50/50');
    } else if (debate.recommendation === 'reduce') {
      actionItems.push('Remove 30-50% of liquidity');
      actionItems.push('Monitor IL daily');
    } else if (debate.recommendation === 'buy' || debate.recommendation === 'strong_buy') {
      actionItems.push('Consider adding more liquidity');
      actionItems.push('Set IL alert at 10%');
    } else {
      actionItems.push('Continue monitoring position');
      actionItems.push('Review in 7 days or if price moves >10%');
    }

    return {
      positionId: position.id,
      recommendation: debate.recommendation,
      confidence: debate.confidence,
      reasoning: debate.synthesis,
      bullCase: debate.bullCase,
      bearCase: debate.bearCase,
      riskScore,
      expectedAPY: position.apy,
      ilRisk,
      timeHorizon: this.getTimeHorizon(position),
      actionItems,
    };
  }

  // Get time horizon recommendation
  private getTimeHorizon(position: LPPosition): string {
    const daysHeld = (Date.now() - position.createdAt) / (1000 * 60 * 60 * 24);
    const dailyFeeRate = position.feesEarned / Math.max(1, daysHeld);
    const ilInDollars = position.totalValue * (position.impermanentLoss / 100);

    if (dailyFeeRate <= 0) return 'Exit immediately - no fee generation';
    const daysToBreakeven = ilInDollars / dailyFeeRate;

    if (daysToBreakeven <= 0) return 'Already profitable - hold for continued yield';
    if (daysToBreakeven < 7) return `Short term (${Math.ceil(daysToBreakeven)} days to breakeven)`;
    if (daysToBreakeven < 30) return `Medium term (${Math.ceil(daysToBreakeven)} days to breakeven)`;
    return `Long term (${Math.ceil(daysToBreakeven)}+ days to breakeven) - consider exit`;
  }

  // Analyze entire portfolio
  async analyzePortfolio(): Promise<PortfolioRecommendation> {
    const positions = this.lpAnalytics.getAllPositions();
    const stats = this.lpAnalytics.getPortfolioStats();

    // Analyze each position
    const recommendations: PositionAnalysis[] = [];
    for (const position of positions) {
      const analysis = await this.analyzePosition(position.id);
      if (analysis) recommendations.push(analysis);
    }

    // Calculate health score
    let healthScore = 100;
    const avgIL = stats.avgImpermanentLoss;
    if (avgIL > 5) healthScore -= 20;
    if (avgIL > 10) healthScore -= 20;
    if (stats.totalPnlPercent < 0) healthScore -= 15;
    const exitCount = recommendations.filter(r => r.recommendation === 'exit' || r.recommendation === 'urgent_exit').length;
    healthScore -= exitCount * 10;
    healthScore = Math.max(0, healthScore);

    // Generate portfolio actions
    const portfolioActions: string[] = [];
    if (exitCount > 0) {
      portfolioActions.push(`Exit ${exitCount} position(s) with high IL risk`);
    }
    if (avgIL > 5) {
      portfolioActions.push('Reduce exposure to positions far from 50/50 pricing');
    }
    if (stats.totalValue > 0 && stats.positionCount < 3) {
      portfolioActions.push('Consider diversifying across more markets');
    }

    // Calculate concentration risk
    const byChain: Record<Chain, number> = { solana: 0, polygon: 0, ethereum: 0, arbitrum: 0 };
    const byProtocol: Record<DeFiProtocol, number> = { drift: 0, polymarket: 0, omen: 0, augur: 0 };

    for (const pos of positions) {
      byChain[pos.chain] += pos.totalValue;
      byProtocol[pos.protocol] += pos.totalValue;
    }

    const chainValues = Object.values(byChain).filter(v => v > 0);
    const maxChainShare = chainValues.length > 0 ? Math.max(...chainValues) / stats.totalValue : 0;

    // Rebalancing suggestions
    const rebalancingSuggestions: PortfolioRecommendation['rebalancingSuggestions'] = [];

    if (maxChainShare > 0.7 && positions.length > 1) {
      const dominantChain = Object.entries(byChain).find(([_, v]) => v === Math.max(...chainValues))?.[0];
      const otherChains = Object.keys(byChain).filter(c => c !== dominantChain && byChain[c as Chain] < stats.totalValue * 0.2);
      if (dominantChain && otherChains.length > 0) {
        rebalancingSuggestions.push({
          from: dominantChain,
          to: otherChains[0],
          amount: stats.totalValue * 0.2,
          reason: `Reduce ${dominantChain} concentration (${(maxChainShare * 100).toFixed(0)}% of portfolio)`,
        });
      }
    }

    return {
      totalPositions: positions.length,
      healthScore,
      recommendations,
      portfolioActions,
      rebalancingSuggestions,
      riskExposure: {
        byChain,
        byProtocol,
        concentration: maxChainShare,
      },
    };
  }

  // Analyze potential entry into a new market
  async analyzeEntry(
    market: string,
    chain: Chain,
    protocol: DeFiProtocol,
    currentYesPrice: number,
    currentNoPrice: number,
    dailyVolume: number,
    totalLiquidity: number,
    proposedAmount: number
  ): Promise<EntryAnalysis> {
    // Simulate the position
    const simulation = this.lpAnalytics.simulateAddLiquidity(
      proposedAmount,
      currentYesPrice,
      currentNoPrice,
      dailyVolume,
      totalLiquidity + proposedAmount
    );

    // Calculate entry risk
    const priceDeviation = Math.abs(0.5 - currentYesPrice);
    const ilRiskAtEntry = priceDeviation * 100; // Higher deviation = higher IL risk

    const context = `
New LP Entry Analysis:
- Market: ${market}
- Chain: ${chain} / Protocol: ${protocol}
- Current YES Price: ${(currentYesPrice * 100).toFixed(1)}%
- Current NO Price: ${(currentNoPrice * 100).toFixed(1)}%
- Price Deviation from 50/50: ${(priceDeviation * 100).toFixed(1)}%
- Daily Volume: $${dailyVolume.toLocaleString()}
- Total Liquidity: $${totalLiquidity.toLocaleString()}
- Proposed Entry: $${proposedAmount}
- Estimated APY: ${simulation.estimatedAPY.toFixed(1)}%
- Estimated Daily Fees: $${simulation.estimatedDailyFees.toFixed(2)}
- Break-even Days: ${simulation.breakEvenDays}
- IL Risk at Entry: ${ilRiskAtEntry.toFixed(1)}%
`;

    // Run debate
    const bullPrompt = `You are an optimistic LP analyst. Make the case FOR entering this position.
${context}
Provide 2-3 sentences on why this is a good entry.`;

    const bearPrompt = `You are a risk-focused LP analyst. Make the case AGAINST entering this position.
${context}
Provide 2-3 sentences on the risks of entering.`;

    const [bullCase, bearCase] = await Promise.all([
      this.callLLM(bullPrompt, 'You are an optimistic LP analyst.'),
      this.callLLM(bearPrompt, 'You are a risk-focused LP analyst.'),
    ]);

    // Determine recommendation
    let recommendation: 'enter' | 'wait' | 'avoid' = 'wait';
    let confidence = 0.5;

    if (priceDeviation < 0.15 && simulation.estimatedAPY > 20 && simulation.breakEvenDays < 30) {
      recommendation = 'enter';
      confidence = 0.7;
    } else if (priceDeviation > 0.35 || simulation.estimatedAPY < 5) {
      recommendation = 'avoid';
      confidence = 0.7;
    }

    const synthesis = recommendation === 'enter'
      ? `Good entry opportunity with ${simulation.estimatedAPY.toFixed(0)}% APY and manageable IL risk.`
      : recommendation === 'avoid'
        ? `High IL risk (${ilRiskAtEntry.toFixed(0)}%) or low APY makes this unattractive.`
        : `Wait for price to move closer to 50/50 for better entry.`;

    return {
      market,
      chain,
      protocol,
      recommendation,
      confidence,
      optimalAmount: proposedAmount,
      expectedAPY: simulation.estimatedAPY,
      ilRiskAtEntry,
      breakEvenDays: simulation.breakEvenDays,
      bullCase,
      bearCase,
      synthesis,
    };
  }

  // Get quick recommendation without full debate
  getQuickRecommendation(position: LPPosition): {
    action: RecommendationType;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  } {
    // Quantitative-only fast analysis
    if (position.impermanentLoss > 15 && position.feesEarned < position.totalValue * 0.1) {
      return {
        action: 'urgent_exit',
        reason: `Critical IL (${position.impermanentLoss.toFixed(1)}%) exceeds fee earnings`,
        urgency: 'high',
      };
    }

    if (position.impermanentLoss > 10) {
      return {
        action: 'exit',
        reason: `High IL (${position.impermanentLoss.toFixed(1)}%) - consider exiting`,
        urgency: 'medium',
      };
    }

    if (position.pnlPercent > 30) {
      return {
        action: 'reduce',
        reason: `Strong gains (${position.pnlPercent.toFixed(0)}%) - consider taking profits`,
        urgency: 'low',
      };
    }

    if (position.apy > 50 && position.impermanentLoss < 3) {
      return {
        action: 'strong_buy',
        reason: `High APY (${position.apy.toFixed(0)}%) with low IL - consider adding`,
        urgency: 'low',
      };
    }

    return {
      action: 'hold',
      reason: 'Position within normal parameters',
      urgency: 'low',
    };
  }
}
