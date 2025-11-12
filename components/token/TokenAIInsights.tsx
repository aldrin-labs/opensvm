'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEffect, useState } from 'react';
import { 
  Brain, TrendingUp, TrendingDown, AlertTriangle, 
  Shield, Zap, RefreshCw, Sparkles, ChartBar,
  Activity, Target, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mint: string;
  tokenData: any;
  marketData: any;
}

interface AIAnalysis {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  riskLevel: 'low' | 'medium' | 'high';
  signals: Signal[];
  summary: string;
  predictions: Prediction[];
  patterns: Pattern[];
  recommendations: string[];
}

interface Signal {
  type: 'buy' | 'sell' | 'hold';
  strength: number;
  reason: string;
  indicator: string;
}

interface Prediction {
  timeframe: string;
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  target?: number;
}

interface Pattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  description: string;
  reliability: number;
}

export function TokenAIInsights({ mint, tokenData, marketData }: Props) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Perform AI analysis
  const analyzeToken = async () => {
    setRefreshing(true);
    try {
      // Calculate technical indicators
      const price = tokenData?.price || 0;
      const priceChange = tokenData?.priceChange24h || 0;
      const volume = tokenData?.volume24h || 0;
      const liquidity = tokenData?.liquidity || 0;
      const holders = tokenData?.holders || 0;
      
      // Analyze MACD
      const macdData = marketData?.indicators?.macd;
      const macdSignal = macdData?.histogram?.slice(-1)[0] || 0;
      const macdTrend = macdData?.histogram?.slice(-5).reduce((a: number, b: number) => a + b, 0) || 0;
      
      // Analyze Moving Averages
      const ma7 = marketData?.indicators?.ma7?.slice(-1)[0] || price;
      const ma25 = marketData?.indicators?.ma25?.slice(-1)[0] || price;
      const maCrossover = ma7 > ma25;
      
      // Calculate RSI (simplified)
      const prices = marketData?.data?.items?.map((i: any) => i.c) || [];
      const rsi = calculateRSI(prices);
      
      // Volume analysis
      const avgVolume = marketData?.data?.items?.slice(-30).reduce((sum: number, item: any) => sum + item.v, 0) / 30 || volume;
      const volumeRatio = volume / avgVolume;
      
      // Holder concentration risk
      const concentrationRisk = tokenData?.top10Balance ? 
        (tokenData.top10Balance > 60 ? 'high' : tokenData.top10Balance > 40 ? 'medium' : 'low') : 'unknown';
      
      // Generate signals
      const signals: Signal[] = [];
      
      // MACD Signal
      if (macdSignal > 0 && macdTrend > 0) {
        signals.push({
          type: 'buy',
          strength: Math.min(macdSignal * 10, 100),
          reason: 'MACD histogram positive and rising',
          indicator: 'MACD'
        });
      } else if (macdSignal < 0 && macdTrend < 0) {
        signals.push({
          type: 'sell',
          strength: Math.min(Math.abs(macdSignal) * 10, 100),
          reason: 'MACD histogram negative and falling',
          indicator: 'MACD'
        });
      }
      
      // MA Crossover Signal
      if (maCrossover && price > ma7) {
        signals.push({
          type: 'buy',
          strength: 75,
          reason: 'Price above MA7 and MA7 above MA25',
          indicator: 'Moving Averages'
        });
      } else if (!maCrossover && price < ma7) {
        signals.push({
          type: 'sell',
          strength: 75,
          reason: 'Price below MA7 and MA7 below MA25',
          indicator: 'Moving Averages'
        });
      }
      
      // RSI Signal
      if (rsi < 30) {
        signals.push({
          type: 'buy',
          strength: 80,
          reason: 'RSI indicates oversold conditions',
          indicator: 'RSI'
        });
      } else if (rsi > 70) {
        signals.push({
          type: 'sell',
          strength: 80,
          reason: 'RSI indicates overbought conditions',
          indicator: 'RSI'
        });
      }
      
      // Volume Signal
      if (volumeRatio > 2 && priceChange > 0) {
        signals.push({
          type: 'buy',
          strength: 60,
          reason: 'High volume with positive price action',
          indicator: 'Volume'
        });
      } else if (volumeRatio > 2 && priceChange < 0) {
        signals.push({
          type: 'sell',
          strength: 60,
          reason: 'High volume with negative price action',
          indicator: 'Volume'
        });
      }
      
      // Determine overall sentiment
      const buySignals = signals.filter(s => s.type === 'buy');
      const sellSignals = signals.filter(s => s.type === 'sell');
      const sentiment = buySignals.length > sellSignals.length ? 'bullish' :
                       sellSignals.length > buySignals.length ? 'bearish' : 'neutral';
      
      // Risk assessment
      const riskFactors = [];
      if (concentrationRisk === 'high') riskFactors.push('high');
      if (liquidity < 100000) riskFactors.push('low liquidity');
      if (holders < 100) riskFactors.push('low holder count');
      if (Math.abs(priceChange) > 20) riskFactors.push('high volatility');
      
      const riskLevel = riskFactors.includes('high') ? 'high' :
                       riskFactors.length > 1 ? 'medium' : 'low';
      
      // Pattern detection
      const patterns: Pattern[] = [];
      
      // Check for common patterns
      if (maCrossover && macdSignal > 0) {
        patterns.push({
          name: 'Golden Cross',
          type: 'bullish',
          description: 'Short-term MA crossed above long-term MA with positive MACD',
          reliability: 75
        });
      }
      
      if (!maCrossover && macdSignal < 0) {
        patterns.push({
          name: 'Death Cross',
          type: 'bearish',
          description: 'Short-term MA crossed below long-term MA with negative MACD',
          reliability: 75
        });
      }
      
      if (rsi < 30 && volumeRatio > 1.5) {
        patterns.push({
          name: 'Oversold Bounce',
          type: 'bullish',
          description: 'RSI oversold with increasing volume',
          reliability: 70
        });
      }
      
      // Generate predictions
      const predictions: Prediction[] = [
        {
          timeframe: '1 Hour',
          direction: sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'sideways',
          confidence: Math.min(buySignals.length * 20 + sellSignals.length * 20, 85),
          target: price * (sentiment === 'bullish' ? 1.02 : sentiment === 'bearish' ? 0.98 : 1)
        },
        {
          timeframe: '24 Hours',
          direction: patterns.some(p => p.type === 'bullish') ? 'up' : 
                    patterns.some(p => p.type === 'bearish') ? 'down' : 'sideways',
          confidence: Math.min(patterns.length * 25, 75),
          target: price * (patterns.some(p => p.type === 'bullish') ? 1.05 : 
                         patterns.some(p => p.type === 'bearish') ? 0.95 : 1)
        }
      ];
      
      // Generate recommendations
      const recommendations = [];
      
      if (sentiment === 'bullish' && riskLevel !== 'high') {
        recommendations.push('Consider accumulating on dips');
        recommendations.push('Set stop-loss at recent support levels');
      } else if (sentiment === 'bearish') {
        recommendations.push('Consider taking profits if in position');
        recommendations.push('Wait for reversal signals before entering');
      } else {
        recommendations.push('Monitor for breakout from current range');
        recommendations.push('Wait for clearer directional signals');
      }
      
      if (riskLevel === 'high') {
        recommendations.push('⚠️ High risk detected - trade with caution');
        recommendations.push('Consider reducing position size');
      }
      
      if (liquidity < 100000) {
        recommendations.push('⚠️ Low liquidity - use limit orders');
      }
      
      // Generate summary
      const summary = `The token is showing ${sentiment} sentiment with ${signals.length} active signals. ` +
                     `Technical indicators suggest ${predictions[0].direction} movement in the short term with ${predictions[0].confidence}% confidence. ` +
                     `${patterns.length > 0 ? `Key patterns detected: ${patterns.map(p => p.name).join(', ')}. ` : ''}` +
                     `Risk level is assessed as ${riskLevel}${riskFactors.length > 0 ? ` due to ${riskFactors.join(', ')}` : ''}.`;
      
      setAnalysis({
        sentiment,
        riskLevel,
        signals,
        summary,
        predictions,
        patterns,
        recommendations
      });
      
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate RSI
  const calculateRSI = (prices: number[], period = 14): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  useEffect(() => {
    analyzeToken();
  }, [mint, tokenData, marketData]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-500';
      case 'bearish': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  if (loading || !analysis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Analyzing token data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Market Analysis
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={analyzeToken} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{analysis.summary}</AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Sentiment</p>
              <p className={cn("text-lg font-bold capitalize", getSentimentColor(analysis.sentiment))}>
                {analysis.sentiment}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className={cn("text-lg font-bold capitalize", getRiskColor(analysis.riskLevel))}>
                {analysis.riskLevel}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Signals</p>
              <p className="text-lg font-bold">{analysis.signals.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Patterns</p>
              <p className="text-lg font-bold">{analysis.patterns.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trading Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.signals.map((signal, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {signal.type === 'buy' ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : signal.type === 'sell' ? (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  ) : (
                    <Shield className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium capitalize">{signal.type} Signal</p>
                    <p className="text-sm text-muted-foreground">{signal.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={signal.type === 'buy' ? 'default' : signal.type === 'sell' ? 'destructive' : 'secondary'}>
                    {signal.strength}% strength
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{signal.indicator}</p>
                </div>
              </div>
            ))}
            {analysis.signals.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No clear signals detected</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pattern Recognition */}
      {analysis.patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5" />
              Pattern Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.patterns.map((pattern, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{pattern.name}</h4>
                    <Badge variant={pattern.type === 'bullish' ? 'default' : pattern.type === 'bearish' ? 'destructive' : 'secondary'}>
                      {pattern.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{pattern.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pattern.reliability}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{pattern.reliability}% reliability</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Price Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.predictions.map((prediction, index) => (
              <div key={index} className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{prediction.timeframe}</span>
                  <Badge variant="outline">{prediction.confidence}% confidence</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {prediction.direction === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : prediction.direction === 'down' ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <Activity className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="capitalize">{prediction.direction}</span>
                  {prediction.target && (
                    <span className="text-sm text-muted-foreground">
                      Target: ${prediction.target.toFixed(6)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <Zap className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
