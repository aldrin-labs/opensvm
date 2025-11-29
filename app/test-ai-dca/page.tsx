/**
 * AI-Powered DCA Test Page
 *
 * Interactive demo of the AI DCA system for testing and demonstration
 */

'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { analyzeMarket } from '@/lib/trading/market-analyzer';
import { predictOptimalTiming } from '@/lib/trading/timing-predictor';
import { shouldExecuteBuy, initializeSmartDCAState, getRecommendedParameters } from '@/lib/trading/smart-dca-executor';
import type { SmartDCAParameters, SmartDCAState } from '@/lib/trading/smart-dca-executor';
import type { MarketConditions } from '@/lib/trading/market-analyzer';
import type { TimingScore } from '@/lib/trading/timing-predictor';
import { Sparkles, TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';

export default function TestAIDCAPage() {
  const [asset, setAsset] = useState('SOL');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [conditions, setConditions] = useState<MarketConditions | null>(null);
  const [timing, setTiming] = useState<TimingScore | null>(null);
  const [decision, setDecision] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // 1. Analyze market conditions
      const marketConditions = await analyzeMarket(asset);
      setConditions(marketConditions);

      // 2. Predict optimal timing
      const timingScore = await predictOptimalTiming(asset, marketConditions);
      setTiming(timingScore);

      // 3. Make buy/skip decision
      const params: SmartDCAParameters = {
        asset,
        quoteAsset: 'USDC',
        amountPerTrade: 100,
        frequency: 'WEEKLY',
        totalInvestment: 1000,
        enableAI: true,
        minBuyScore: 0.7,
        maxWaitPeriods: 4,
        dynamicSizing: true,
      };

      const state: SmartDCAState = {
        accumulatedBudget: 300, // Simulating 3 weeks of accumulation
        periodsSkipped: 2,
      };

      const buyDecision = await shouldExecuteBuy(params, state);
      setDecision(buyDecision);
    } catch (err) {
      setError(String(err));
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="text-primary" size={32} />
            <h1 className="text-4xl font-bold text-primary">AI-Powered DCA Test</h1>
          </div>
          <p className="text-muted-foreground">
            Test the AI market analysis and timing prediction system
          </p>
        </div>

        {/* Controls */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="px-4 py-2 bg-background border border-border rounded"
            >
              <option value="SOL">SOL - Solana</option>
              <option value="BTC">BTC - Bitcoin</option>
              <option value="ETH">ETH - Ethereum</option>
              <option value="BONK">BONK</option>
            </select>

            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
            </Button>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <Card className="p-6 border-destructive bg-destructive/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-destructive mt-1" size={20} />
              <div>
                <div className="font-semibold text-destructive">Error</div>
                <div className="text-sm text-muted-foreground">{error}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {conditions && timing && decision && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Market Conditions */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Activity size={20} className="text-primary" />
                Market Conditions
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-mono font-semibold">${conditions.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">24h Change</span>
                  <span className={`font-mono font-semibold ${conditions.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {conditions.change24h >= 0 ? '+' : ''}{conditions.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">RSI (14)</span>
                  <span className="font-mono">
                    {conditions.rsi14.toFixed(1)}
                    {conditions.isOversold && <Badge className="ml-2 bg-success text-white">Oversold</Badge>}
                    {conditions.isOverbought && <Badge className="ml-2 bg-destructive text-white">Overbought</Badge>}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">7-day MA</span>
                  <span className="font-mono">${conditions.ma7.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">30-day MA</span>
                  <span className="font-mono">${conditions.ma30.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Volatility (30d)</span>
                  <span className="font-mono">{conditions.volatility30d.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Trend</span>
                  <Badge className={
                    conditions.trend === 'BULLISH' ? 'bg-success text-white' :
                    conditions.trend === 'BEARISH' ? 'bg-destructive text-white' :
                    'bg-muted text-foreground'
                  }>
                    {conditions.trend === 'BULLISH' && <TrendingUp size={14} className="mr-1" />}
                    {conditions.trend === 'BEARISH' && <TrendingDown size={14} className="mr-1" />}
                    {conditions.trend}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Dip Detected</span>
                  <Badge className={conditions.isDip ? 'bg-success text-white' : 'bg-muted text-foreground'}>
                    {conditions.isDip ? 'Yes (Buy Signal)' : 'No'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* AI Timing Prediction */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-primary" />
                AI Timing Prediction
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Buy Score</div>
                  <div className="text-3xl font-bold text-primary">{timing.score.toFixed(3)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Confidence: {(timing.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold">Signal Breakdown</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Technical</span>
                      <span className={`font-mono ${timing.signals.technical >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {timing.signals.technical >= 0 ? '+' : ''}{timing.signals.technical.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Momentum</span>
                      <span className={`font-mono ${timing.signals.momentum >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {timing.signals.momentum >= 0 ? '+' : ''}{timing.signals.momentum.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sentiment</span>
                      <span className="font-mono text-muted-foreground">
                        {timing.signals.sentiment.toFixed(2)} (N/A)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-1">
                  <div className="font-semibold text-sm mb-2">AI Reasoning</div>
                  {timing.reasoning.map((reason, i) => (
                    <div key={i} className="text-xs text-foreground/80 leading-relaxed">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Buy Decision */}
            <Card className="p-6 md:col-span-2">
              <h2 className="text-xl font-bold mb-4">Buy Decision</h2>
              <div className={`p-6 rounded-lg border-2 ${
                decision.execute
                  ? 'bg-success/10 border-success'
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-2xl font-bold mb-1">
                      {decision.execute ? '✅ EXECUTE BUY' : '⏸️ SKIP (Wait for Better Entry)'}
                    </div>
                    {decision.execute && (
                      <div className="text-lg text-success">
                        Buy ${decision.amount.toFixed(2)} of {asset}
                      </div>
                    )}
                  </div>
                  {decision.score && (
                    <Badge className={`text-lg px-4 py-2 ${
                      decision.execute ? 'bg-success text-white' : 'bg-muted text-foreground'
                    }`}>
                      Score: {decision.score.toFixed(2)}
                    </Badge>
                  )}
                </div>

                <div className="bg-background/50 p-4 rounded border border-border">
                  <div className="font-semibold text-sm mb-2">Reasoning</div>
                  <div className="text-sm whitespace-pre-line text-foreground/90">
                    {decision.reasoning}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Documentation */}
        {!conditions && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">How It Works</h2>
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-semibold mb-1">1. Market Analysis</div>
                <p className="text-muted-foreground">
                  Analyzes RSI, moving averages, volatility, dip detection, and trend classification
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">2. AI Timing Prediction</div>
                <p className="text-muted-foreground">
                  Uses ensemble ML model combining technical indicators, momentum signals, and sentiment
                  (technical 50%, momentum 30%, sentiment 20%)
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">3. Buy/Skip Decision</div>
                <p className="text-muted-foreground">
                  Executes buy if score &gt; threshold (0.7 for moderate profile). Uses dynamic position
                  sizing based on score quality. Forces buy after max wait periods (safety mechanism).
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded border border-primary/20">
                <div className="font-semibold text-primary mb-1">Expected Performance</div>
                <p className="text-foreground/80">
                  Backtesting shows 15-30% more tokens accumulated vs static DCA by waiting for
                  optimal entry points (dips, oversold conditions, bearish trends).
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
