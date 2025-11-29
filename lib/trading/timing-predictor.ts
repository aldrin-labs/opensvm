/**
 * ML-Based Timing Predictor
 *
 * Predicts optimal buy timing for AI-powered DCA strategies.
 * Phase 2 of AI-Powered Dynamic DCA system.
 */

import type { MarketConditions } from './market-analyzer';
import { fetchAvgVolume } from './market-analyzer';

export interface TimingScore {
  score: number; // 0-1 (1 = perfect time to buy)
  confidence: number; // 0-1 (model confidence)
  reasoning: string[];
  signals: {
    technical: number; // -1 to 1
    sentiment: number; // -1 to 1 (future: social media sentiment)
    momentum: number; // -1 to 1
  };
}

export interface TimingFeatures {
  // Technical indicators (normalized -1 to 1)
  rsi_normalized: number; // 0 = neutral, -1 = oversold, 1 = overbought
  price_vs_ma7: number; // % above/below MA7
  price_vs_ma30: number; // % above/below MA30
  volatility: number; // Normalized volatility
  volume_ratio: number; // Current vs average volume

  // Momentum
  change24h_normalized: number; // Normalized price change

  // Pattern detection
  is_dip: number; // 1 if dip, 0 otherwise
  is_oversold: number; // 1 if oversold, 0 otherwise
  trend: number; // 1 = bullish, -1 = bearish, 0 = neutral
}

/**
 * Extract features from market conditions
 */
export async function extractFeatures(
  asset: string,
  conditions: MarketConditions
): Promise<TimingFeatures> {
  const avgVolume = await fetchAvgVolume(asset, 30);

  return {
    // RSI normalized: 50 = neutral, <30 = oversold, >70 = overbought
    rsi_normalized: (conditions.rsi14 - 50) / 50,

    // Price vs moving averages (percentage difference)
    price_vs_ma7: (conditions.price - conditions.ma7) / conditions.ma7,
    price_vs_ma30: (conditions.price - conditions.ma30) / conditions.ma30,

    // Volatility (normalized, assuming 100% is high)
    volatility: Math.min(conditions.volatility30d / 100, 1),

    // Volume ratio (current vs 30-day average)
    volume_ratio: conditions.volume24h / avgVolume,

    // Momentum (normalize 24h change to -1 to 1 range, cap at ±10%)
    change24h_normalized: Math.max(-1, Math.min(1, conditions.change24h / 10)),

    // Binary pattern signals
    is_dip: conditions.isDip ? 1 : 0,
    is_oversold: conditions.isOversold ? 1 : 0,
    trend: conditions.trend === 'BULLISH' ? 1 : conditions.trend === 'BEARISH' ? -1 : 0,
  };
}

/**
 * Calculate technical score using rule-based model
 *
 * This is a simplified model. In production, replace with TensorFlow.js
 * trained on historical data showing good vs bad buy timing.
 */
export function calculateTechnicalScore(features: TimingFeatures): number {
  let score = 0;

  // RSI: Strong buy signal when oversold (<30)
  if (features.rsi_normalized < -0.4) {
    score += 0.3; // RSI < 30 (oversold)
  } else if (features.rsi_normalized < -0.2) {
    score += 0.15; // RSI 30-40 (mildly oversold)
  } else if (features.rsi_normalized > 0.4) {
    score -= 0.3; // RSI > 70 (overbought)
  } else if (features.rsi_normalized > 0.2) {
    score -= 0.15; // RSI 60-70 (mildly overbought)
  }

  // Price vs MA7: Buy below moving average (support level)
  if (features.price_vs_ma7 < -0.05) {
    score += 0.2; // 5% below MA7
  } else if (features.price_vs_ma7 < -0.02) {
    score += 0.1; // 2% below MA7
  } else if (features.price_vs_ma7 > 0.05) {
    score -= 0.1; // 5% above MA7 (resistance)
  }

  // Price vs MA30: Stronger signal on longer timeframe
  if (features.price_vs_ma30 < -0.10) {
    score += 0.3; // 10% below MA30 (strong buy)
  } else if (features.price_vs_ma30 < -0.05) {
    score += 0.15; // 5% below MA30
  } else if (features.price_vs_ma30 > 0.10) {
    score -= 0.15; // 10% above MA30 (avoid)
  }

  // Dip detection: Strong buy signal
  if (features.is_dip === 1) {
    score += 0.2;
  }

  // Oversold: Additional confirmation
  if (features.is_oversold === 1) {
    score += 0.15;
  }

  // Trend: Slight preference for buying in uptrend
  score += features.trend * 0.1;

  // Volume: Higher volume = more conviction
  if (features.volume_ratio > 1.5) {
    score += 0.1; // High volume confirms move
  } else if (features.volume_ratio < 0.5) {
    score -= 0.05; // Low volume = less confidence
  }

  // Momentum: Don't buy into falling knife
  if (features.change24h_normalized < -0.5) {
    score -= 0.1; // Strong downward momentum
  } else if (features.change24h_normalized > 0.5) {
    score -= 0.05; // Strong upward momentum (wait for pullback)
  }

  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, score));
}

/**
 * Calculate momentum score
 */
export function calculateMomentumScore(features: TimingFeatures): number {
  let score = 0;

  // Negative momentum (price falling) is good for DCA buying
  if (features.change24h_normalized < -0.3) {
    score += 0.4; // Strong drop = good buy
  } else if (features.change24h_normalized < -0.1) {
    score += 0.2; // Mild drop = decent buy
  } else if (features.change24h_normalized > 0.3) {
    score -= 0.2; // Strong rise = wait for pullback
  }

  // Trend alignment
  if (features.trend === -1) {
    score += 0.3; // Bearish trend = good DCA opportunity
  } else if (features.trend === 1) {
    score -= 0.1; // Bullish trend = less urgency
  }

  // Dip + negative momentum = strong buy
  if (features.is_dip === 1 && features.change24h_normalized < 0) {
    score += 0.3;
  }

  return Math.max(-1, Math.min(1, score));
}

/**
 * Get sentiment score (placeholder for future social media integration)
 */
export async function getSentimentScore(asset: string): Promise<number> {
  // TODO: Integrate with social media sentiment APIs
  // - Twitter/X API for crypto sentiment
  // - Reddit API for community sentiment
  // - LunarCrush or similar crypto sentiment platforms

  // For now, return neutral
  return 0;
}

/**
 * Generate reasoning for the timing score
 */
function generateReasoning(
  conditions: MarketConditions,
  features: TimingFeatures,
  signals: TimingScore['signals']
): string[] {
  const reasoning: string[] = [];

  // RSI signals
  if (conditions.isOversold) {
    reasoning.push(`✅ RSI (${conditions.rsi14.toFixed(1)}) indicates oversold - strong buy signal`);
  } else if (conditions.isOverbought) {
    reasoning.push(`❌ RSI (${conditions.rsi14.toFixed(1)}) indicates overbought - avoid buying`);
  } else if (conditions.rsi14 < 50) {
    reasoning.push(`➡️ RSI (${conditions.rsi14.toFixed(1)}) below neutral - decent buy opportunity`);
  }

  // Dip detection
  if (conditions.isDip) {
    reasoning.push('✅ Price dipped >5% from recent high - buy the dip');
  }

  // Moving average signals
  if (features.price_vs_ma7 < -0.05) {
    reasoning.push(`✅ Price ${Math.abs(features.price_vs_ma7 * 100).toFixed(1)}% below 7-day MA - potential support level`);
  } else if (features.price_vs_ma7 > 0.05) {
    reasoning.push(`❌ Price ${(features.price_vs_ma7 * 100).toFixed(1)}% above 7-day MA - resistance zone`);
  }

  if (features.price_vs_ma30 < -0.10) {
    reasoning.push(`✅ Price ${Math.abs(features.price_vs_ma30 * 100).toFixed(1)}% below 30-day MA - strong buy opportunity`);
  } else if (features.price_vs_ma30 > 0.10) {
    reasoning.push(`❌ Price ${(features.price_vs_ma30 * 100).toFixed(1)}% above 30-day MA - overextended`);
  }

  // Trend signals
  if (conditions.trend === 'BEARISH') {
    reasoning.push('➡️ Bearish trend detected - good DCA opportunity (buy low)');
  } else if (conditions.trend === 'BULLISH') {
    reasoning.push('⚠️ Bullish trend - consider waiting for pullback');
  }

  // Momentum signals
  if (features.change24h_normalized < -0.3) {
    reasoning.push(`✅ Price down ${Math.abs(conditions.change24h).toFixed(1)}% in 24h - buy the dip`);
  } else if (features.change24h_normalized > 0.3) {
    reasoning.push(`⚠️ Price up ${conditions.change24h.toFixed(1)}% in 24h - FOMO risk, wait for pullback`);
  }

  // Volume confirmation
  if (features.volume_ratio > 1.5) {
    reasoning.push('✅ High volume confirms price action');
  } else if (features.volume_ratio < 0.5) {
    reasoning.push('⚠️ Low volume - less conviction in move');
  }

  // Overall signal strength
  const avgSignal = (signals.technical + signals.sentiment + signals.momentum) / 3;
  if (avgSignal > 0.5) {
    reasoning.push('🎯 Strong buy signals across multiple indicators');
  } else if (avgSignal < -0.5) {
    reasoning.push('🛑 Weak signals - consider waiting for better entry');
  }

  return reasoning;
}

/**
 * Predict optimal timing for buying
 *
 * Main entry point for timing prediction
 */
export async function predictOptimalTiming(
  asset: string,
  conditions: MarketConditions
): Promise<TimingScore> {
  // Extract features
  const features = await extractFeatures(asset, conditions);

  // Calculate individual signal scores
  const technicalScore = calculateTechnicalScore(features);
  const momentumScore = calculateMomentumScore(features);
  const sentimentScore = await getSentimentScore(asset);

  // Weighted ensemble (can be tuned based on backtesting)
  const weights = {
    technical: 0.5,
    sentiment: 0.2, // Lower weight until we have real sentiment data
    momentum: 0.3,
  };

  const rawScore =
    technicalScore * weights.technical +
    sentimentScore * weights.sentiment +
    momentumScore * weights.momentum;

  // Normalize to 0-1 range (from -1 to 1)
  const normalizedScore = (rawScore + 1) / 2;

  // Calculate confidence based on signal agreement
  const signalAgreement = Math.abs(technicalScore - momentumScore);
  const confidence = 1 - (signalAgreement / 2); // High agreement = high confidence

  // Generate reasoning
  const signals = {
    technical: technicalScore,
    sentiment: sentimentScore,
    momentum: momentumScore,
  };

  const reasoning = generateReasoning(conditions, features, signals);

  return {
    score: Number(normalizedScore.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    reasoning,
    signals,
  };
}

/**
 * Backtest timing predictor on historical data
 *
 * Returns performance metrics for a given period
 */
export interface BacktestResult {
  totalBuys: number;
  avgBuyScore: number;
  avgPriceAtBuy: number;
  avgPriceAfter7d: number;
  avgReturn7d: number;
  percentProfitable: number;
}

export async function backtestTimingPredictor(
  asset: string,
  startDate: Date,
  endDate: Date,
  minBuyScore: number = 0.7
): Promise<BacktestResult> {
  // TODO: Implement backtesting
  // 1. Fetch historical prices for period
  // 2. For each day, calculate timing score
  // 3. Simulate buys when score > threshold
  // 4. Measure 7-day forward returns
  // 5. Calculate aggregate metrics

  throw new Error('Backtesting not yet implemented');
}
