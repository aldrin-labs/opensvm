/**
 * VibeMeterWidget
 *
 * Displays real-time "vibe" analysis for a trading pair.
 * Combines social sentiment, meme velocity, influencer buzz, and community energy
 * into a single "vibe score" that predicts market momentum.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Users, Image, Twitter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type VibeSentiment = 'DESPAIR' | 'FEAR' | 'NEUTRAL' | 'HOPE' | 'EUPHORIC';

interface VibeMetrics {
  overallVibe: number; // 0-10
  socialSentiment: VibeSentiment;
  memeVelocity: number; // memes/hour
  influencerBuzz: number; // 0-10
  communityEnergy: number; // 0-10
  fomoLevel: number; // 0-10
  prediction: string;
  confidence: number; // 0-1
  historicalAccuracy: number; // 0-1
  trendDirection: 'up' | 'down' | 'neutral';
  vibeChange24h: number; // -10 to +10
}

interface VibeMeterWidgetProps {
  market: string;
}

// Mock data generator (replace with real API in production)
function generateMockVibeData(market: string): VibeMetrics {
  const token = market.split('/')[0];
  const baseVibe = Math.random() * 10;

  const sentimentMap: Record<number, VibeSentiment> = {
    0: 'DESPAIR',
    2: 'FEAR',
    4: 'NEUTRAL',
    6: 'HOPE',
    8: 'EUPHORIC',
  };

  const sentiment = sentimentMap[Math.floor(baseVibe / 2) * 2] || 'NEUTRAL';

  const predictions = [
    'Peak euphoria detected. Consider taking profits.',
    'Rising momentum. Early entry opportunity.',
    'Declining meme velocity suggests cooling interest.',
    'Strong community energy. Momentum building.',
    'Influencer attention increasing. Watch for breakout.',
    'FOMO levels critical. Possible local top.',
  ];

  return {
    overallVibe: baseVibe,
    socialSentiment: sentiment,
    memeVelocity: Math.random() * 15,
    influencerBuzz: Math.random() * 10,
    communityEnergy: Math.random() * 10,
    fomoLevel: Math.random() * 10,
    prediction: predictions[Math.floor(Math.random() * predictions.length)],
    confidence: 0.65 + Math.random() * 0.25,
    historicalAccuracy: 0.68 + Math.random() * 0.15,
    trendDirection: baseVibe > 6 ? 'up' : baseVibe < 4 ? 'down' : 'neutral',
    vibeChange24h: (Math.random() - 0.5) * 4,
  };
}

export default function VibeMeterWidget({ market }: VibeMeterWidgetProps) {
  const [vibeData, setVibeData] = useState<VibeMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setIsLoading(true);
    const timeout = setTimeout(() => {
      setVibeData(generateMockVibeData(market));
      setIsLoading(false);
    }, 500);

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      setVibeData(generateMockVibeData(market));
    }, 120000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [market]);

  if (isLoading || !vibeData) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p className="text-xs text-muted-foreground">Analyzing vibes...</p>
        </div>
      </div>
    );
  }

  const sentimentEmoji = {
    DESPAIR: '😱',
    FEAR: '😰',
    NEUTRAL: '😐',
    HOPE: '🙂',
    EUPHORIC: '😍',
  };

  const sentimentColor = {
    DESPAIR: 'text-destructive',
    FEAR: 'text-warning',
    NEUTRAL: 'text-muted-foreground',
    HOPE: 'text-info',
    EUPHORIC: 'text-success',
  };

  const vibeStars = '🚀'.repeat(Math.floor(vibeData.overallVibe / 2)) + '⚪'.repeat(5 - Math.floor(vibeData.overallVibe / 2));

  const TrendIcon = vibeData.trendDirection === 'up' ? TrendingUp : vibeData.trendDirection === 'down' ? TrendingDown : Zap;

  return (
    <div className="flex flex-col h-full p-4 bg-background overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-primary">VIBE METER</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          BETA
        </Badge>
      </div>

      {/* Token */}
      <div className="mb-4">
        <div className="text-xs text-muted-foreground mb-1">Token</div>
        <div className="text-lg font-bold">{market.split('/')[0]}</div>
      </div>

      {/* Overall Vibe Score */}
      <div className="mb-4 p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Overall Vibe</span>
          <div className="flex items-center gap-1">
            <TrendIcon size={14} className={vibeData.trendDirection === 'up' ? 'text-success' : vibeData.trendDirection === 'down' ? 'text-destructive' : 'text-muted-foreground'} />
            <span className={`text-xs font-medium ${vibeData.vibeChange24h > 0 ? 'text-success' : vibeData.vibeChange24h < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {vibeData.vibeChange24h > 0 ? '+' : ''}{vibeData.vibeChange24h.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="text-2xl font-bold mb-2">
          {vibeData.overallVibe.toFixed(1)}/10
        </div>
        <div className="text-lg mb-2">{vibeStars}</div>
        <Progress value={vibeData.overallVibe * 10} className="h-2" />
      </div>

      {/* Metrics Grid */}
      <div className="space-y-3 mb-4">
        {/* Social Sentiment */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Twitter size={12} />
              <span>Social Sentiment</span>
            </div>
            <span className={`text-xs font-semibold ${sentimentColor[vibeData.socialSentiment]}`}>
              {vibeData.socialSentiment} {sentimentEmoji[vibeData.socialSentiment]}
            </span>
          </div>
        </div>

        {/* Meme Velocity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Image size={12} />
              <span>Meme Velocity</span>
            </div>
            <span className="text-xs font-medium">
              {vibeData.memeVelocity.toFixed(1)} memes/hr
            </span>
          </div>
          <Progress value={(vibeData.memeVelocity / 15) * 100} className="h-1.5" />
        </div>

        {/* Influencer Buzz */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap size={12} />
              <span>Influencer Buzz</span>
            </div>
            <span className="text-xs font-medium">
              {vibeData.influencerBuzz.toFixed(1)}/10
            </span>
          </div>
          <Progress value={vibeData.influencerBuzz * 10} className="h-1.5" />
        </div>

        {/* Community Energy */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users size={12} />
              <span>Community Energy</span>
            </div>
            <span className="text-xs font-medium">
              {vibeData.communityEnergy.toFixed(1)}/10
            </span>
          </div>
          <Progress value={vibeData.communityEnergy * 10} className="h-1.5" />
        </div>

        {/* FOMO Level */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle size={12} />
              <span>FOMO Level</span>
            </div>
            <span className={`text-xs font-semibold ${vibeData.fomoLevel > 8 ? 'text-destructive' : vibeData.fomoLevel > 6 ? 'text-warning' : 'text-success'}`}>
              {vibeData.fomoLevel > 8 ? '⚠️ CRITICAL' : vibeData.fomoLevel > 6 ? 'HIGH' : 'MODERATE'}
            </span>
          </div>
          <Progress value={vibeData.fomoLevel * 10} className="h-1.5" />
        </div>
      </div>

      {/* AI Prediction */}
      <div className="p-3 bg-info/10 border border-info/20 rounded-lg mb-4">
        <div className="flex items-start gap-2">
          <Zap size={14} className="text-info mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-info mb-1">
              Vibe Prediction ({Math.round(vibeData.confidence * 100)}% confidence)
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {vibeData.prediction}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-auto pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Historical Accuracy</span>
          <span className="font-semibold text-success">
            {Math.round(vibeData.historicalAccuracy * 100)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-muted-foreground">Last Updated</span>
          <span className="font-medium">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded text-xs text-warning text-center">
        🚧 Demo Mode: Using simulated data
      </div>
    </div>
  );
}
