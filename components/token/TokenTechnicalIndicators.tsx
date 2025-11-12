'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, Activity, BarChart3, 
  Gauge, Target, AlertTriangle, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: any;
  price?: number;
  priceChange?: number;
}

export function TokenTechnicalIndicators({ data, price = 0, priceChange = 0 }: Props) {
  // Calculate technical indicators
  const calculateIndicators = () => {
    const prices = data?.data?.items?.map((i: any) => i.c) || [];
    const volumes = data?.data?.items?.map((i: any) => i.v) || [];
    
    if (prices.length === 0) {
      return {
        rsi: 50,
        macd: { value: 0, signal: 0, histogram: 0 },
        ma7: price,
        ma25: price,
        volumeTrend: 'neutral',
        momentum: 0,
        volatility: 0,
        support: price * 0.95,
        resistance: price * 1.05,
        trend: 'neutral'
      };
    }
    
    // RSI Calculation
    const calculateRSI = (data: number[], period = 14) => {
      if (data.length < period + 1) return 50;
      
      let gains = 0;
      let losses = 0;
      
      for (let i = data.length - period; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      
      const avgGain = gains / period;
      const avgLoss = losses / period;
      
      if (avgLoss === 0) return 100;
      
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };
    
    const rsi = calculateRSI(prices);
    
    // MACD from data
    const macdData = data?.indicators?.macd;
    const macdLine = macdData?.line?.slice(-1)[0] || 0;
    const macdSignal = macdData?.signal?.slice(-1)[0] || 0;
    const macdHistogram = macdData?.histogram?.slice(-1)[0] || 0;
    
    // Moving Averages
    const ma7 = data?.indicators?.ma7?.slice(-1)[0] || price;
    const ma25 = data?.indicators?.ma25?.slice(-1)[0] || price;
    
    // Volume Trend
    const recentVolume = volumes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5;
    const olderVolume = volumes.slice(-10, -5).reduce((a: number, b: number) => a + b, 0) / 5;
    const volumeTrend = recentVolume > olderVolume * 1.2 ? 'increasing' : 
                       recentVolume < olderVolume * 0.8 ? 'decreasing' : 'neutral';
    
    // Momentum
    const momentum = prices.length > 10 ? 
      ((prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10]) * 100 : 0;
    
    // Volatility (simplified)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;
    
    // Support and Resistance
    const recentLows = prices.slice(-20).sort((a: number, b: number) => a - b);
    const recentHighs = prices.slice(-20).sort((a: number, b: number) => b - a);
    const support = recentLows[Math.floor(recentLows.length * 0.1)] || price * 0.95;
    const resistance = recentHighs[Math.floor(recentHighs.length * 0.1)] || price * 1.05;
    
    // Overall Trend
    const trend = ma7 > ma25 && price > ma7 ? 'bullish' :
                 ma7 < ma25 && price < ma7 ? 'bearish' : 'neutral';
    
    return {
      rsi,
      macd: { value: macdLine, signal: macdSignal, histogram: macdHistogram },
      ma7,
      ma25,
      volumeTrend,
      momentum,
      volatility,
      support,
      resistance,
      trend
    };
  };
  
  const indicators = calculateIndicators();
  
  // Determine signal strength
  const getSignalStrength = () => {
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (indicators.rsi < 30) bullishSignals++;
    if (indicators.rsi > 70) bearishSignals++;
    if (indicators.macd.histogram > 0) bullishSignals++;
    if (indicators.macd.histogram < 0) bearishSignals++;
    if (price > indicators.ma7) bullishSignals++;
    if (price < indicators.ma7) bearishSignals++;
    if (indicators.momentum > 5) bullishSignals++;
    if (indicators.momentum < -5) bearishSignals++;
    
    const total = bullishSignals + bearishSignals;
    if (total === 0) return { type: 'neutral', strength: 0 };
    
    if (bullishSignals > bearishSignals) {
      return { type: 'bullish', strength: (bullishSignals / 4) * 100 };
    } else if (bearishSignals > bullishSignals) {
      return { type: 'bearish', strength: (bearishSignals / 4) * 100 };
    }
    return { type: 'neutral', strength: 50 };
  };
  
  const signal = getSignalStrength();
  
  const getRSIStatus = (value: number) => {
    if (value > 70) return { label: 'Overbought', color: 'text-red-500' };
    if (value < 30) return { label: 'Oversold', color: 'text-green-500' };
    return { label: 'Neutral', color: 'text-yellow-500' };
  };
  
  const rsiStatus = getRSIStatus(indicators.rsi);
  
  return (
    <div className="space-y-4">
      {/* Overall Signal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overall Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {signal.type === 'bullish' ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : signal.type === 'bearish' ? (
                <TrendingDown className="h-5 w-5 text-red-500" />
              ) : (
                <Activity className="h-5 w-5 text-yellow-500" />
              )}
              <span className={cn(
                "text-lg font-bold capitalize",
                signal.type === 'bullish' ? 'text-green-500' :
                signal.type === 'bearish' ? 'text-red-500' : 'text-yellow-500'
              )}>
                {signal.type}
              </span>
            </div>
            <Badge variant="outline">{signal.strength.toFixed(0)}%</Badge>
          </div>
          <Progress value={signal.strength} className="h-2" />
        </CardContent>
      </Card>
      
      {/* Key Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Key Indicators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* RSI */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">RSI (14)</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{indicators.rsi.toFixed(1)}</span>
                <Badge variant="outline" className={rsiStatus.color}>
                  {rsiStatus.label}
                </Badge>
              </div>
            </div>
            <div className="relative">
              <Progress value={indicators.rsi} className="h-2" />
              <div className="absolute top-0 left-[30%] h-full w-px bg-yellow-500" />
              <div className="absolute top-0 left-[70%] h-full w-px bg-yellow-500" />
            </div>
          </div>
          
          {/* MACD */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">MACD</span>
              <Badge variant={indicators.macd.histogram > 0 ? 'default' : 'destructive'}>
                {indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
              <div>
                <span className="text-muted-foreground">Line: </span>
                <span>{indicators.macd.value.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Signal: </span>
                <span>{indicators.macd.signal.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Hist: </span>
                <span className={indicators.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'}>
                  {indicators.macd.histogram.toFixed(6)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Moving Averages */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Moving Averages</span>
              <Badge variant="outline">
                {price > indicators.ma7 ? 'Above' : 'Below'} MA7
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
              <div>
                <span className="text-muted-foreground">MA7: </span>
                <span>${indicators.ma7.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">MA25: </span>
                <span>${indicators.ma25.toFixed(6)}</span>
              </div>
            </div>
          </div>
          
          {/* Momentum */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Momentum (10)</span>
              <span className={cn(
                "text-sm font-medium",
                indicators.momentum > 0 ? 'text-green-500' : 'text-red-500'
              )}>
                {indicators.momentum > 0 ? '+' : ''}{indicators.momentum.toFixed(2)}%
              </span>
            </div>
          </div>
          
          {/* Volatility */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Volatility</span>
              <Badge variant={indicators.volatility > 5 ? 'destructive' : 'secondary'}>
                {indicators.volatility > 5 ? 'High' : indicators.volatility > 2 ? 'Medium' : 'Low'}
              </Badge>
            </div>
            <Progress value={Math.min(indicators.volatility * 10, 100)} className="h-2 mt-1" />
          </div>
        </CardContent>
      </Card>
      
      {/* Support & Resistance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Support & Resistance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Resistance</span>
              <span className="text-sm font-medium">${indicators.resistance.toFixed(6)}</span>
            </div>
            
            <div className="relative h-8">
              <div className="absolute inset-0 bg-muted rounded" />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded"
                style={{ 
                  left: `${((price - indicators.support) / (indicators.resistance - indicators.support)) * 100}%` 
                }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Support</span>
              <span className="text-sm font-medium">${indicators.support.toFixed(6)}</span>
            </div>
            
            <div className="text-center">
              <span className="text-xs text-muted-foreground">Current Price</span>
              <div className="text-lg font-bold">${price.toFixed(6)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Volume Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Volume Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Volume Trend</span>
            </div>
            <Badge variant={
              indicators.volumeTrend === 'increasing' ? 'default' :
              indicators.volumeTrend === 'decreasing' ? 'destructive' : 'secondary'
            }>
              {indicators.volumeTrend}
            </Badge>
          </div>
          {indicators.volumeTrend === 'increasing' && priceChange > 0 && (
            <p className="text-xs text-green-500 mt-2">
              ✓ Volume confirms price movement
            </p>
          )}
          {indicators.volumeTrend === 'decreasing' && Math.abs(priceChange) > 5 && (
            <p className="text-xs text-yellow-500 mt-2">
              ⚠️ Low volume on price movement
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Trading Recommendation */}
      <Card className="border-blue-500/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Technical Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {signal.type === 'bullish' ? 
              `Technical indicators are showing bullish signals with ${signal.strength.toFixed(0)}% strength. ` :
             signal.type === 'bearish' ?
              `Technical indicators are showing bearish signals with ${signal.strength.toFixed(0)}% strength. ` :
              'Technical indicators are showing mixed signals. '}
            {indicators.rsi < 30 ? 'RSI indicates oversold conditions. ' : 
             indicators.rsi > 70 ? 'RSI indicates overbought conditions. ' : ''}
            {indicators.trend === 'bullish' ? 'Overall trend is bullish.' :
             indicators.trend === 'bearish' ? 'Overall trend is bearish.' :
             'Market is ranging.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
