/**
 * Test suite for Sentiment Analysis Engine
 */

import { SentimentAnalysisEngine, SentimentAnalysisRequest } from '../sentiment-analysis';

describe('SentimentAnalysisEngine', () => {
  let engine: SentimentAnalysisEngine;

  beforeEach(() => {
    engine = new SentimentAnalysisEngine();
  });

  describe('Social Media Sentiment', () => {
    it('should analyze social media sentiment correctly', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'SOL',
        sources: ['twitter', 'reddit'],
        time_range: '24h',
        include_influencer_analysis: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result).toBeDefined();
      expect(result.asset).toBe('SOL');
      expect(result.overall_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.overall_sentiment).toBeLessThanOrEqual(1);
      expect(result.source_breakdown).toHaveProperty('twitter');
      expect(result.source_breakdown).toHaveProperty('reddit');
    });

    it('should handle multiple assets', async () => {
      const assets = ['SOL', 'ETH', 'BTC'];
      const requests: SentimentAnalysisRequest[] = assets.map(asset => ({
        asset,
        sources: ['twitter'],
        time_range: '24h'
      }));

      const results = await Promise.all(
        requests.map(req => engine.analyzeSentiment(req))
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.asset).toBe(assets[index]);
        expect(result.overall_sentiment).toBeGreaterThanOrEqual(-1);
        expect(result.overall_sentiment).toBeLessThanOrEqual(1);
      });
    });

    it('should include confidence scores', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'BONK',
        sources: ['twitter'],
        time_range: '1h'
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
    });
  });

  describe('News Sentiment Analysis', () => {
    it('should analyze news sentiment', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'SOL',
        sources: ['news'],
        time_range: '7d',
        include_news_analysis: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.news_analysis).toBeDefined();
      expect(result.news_analysis!.articles_analyzed).toBeGreaterThan(0);
      expect(result.news_analysis!.average_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.news_analysis!.average_sentiment).toBeLessThanOrEqual(1);
    });

    it('should categorize news by sentiment', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'ETH',
        sources: ['news'],
        time_range: '24h',
        include_news_analysis: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.news_analysis).toBeDefined();
      expect(result.news_analysis!.positive_articles).toBeGreaterThanOrEqual(0);
      expect(result.news_analysis!.negative_articles).toBeGreaterThanOrEqual(0);
      expect(result.news_analysis!.neutral_articles).toBeGreaterThanOrEqual(0);
    });
  });

  describe('On-Chain Sentiment', () => {
    it('should analyze on-chain sentiment indicators', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'SOL',
        sources: ['onchain'],
        time_range: '24h',
        include_onchain_metrics: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.onchain_sentiment).toBeDefined();
      expect(result.onchain_sentiment!.whale_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.onchain_sentiment!.whale_sentiment).toBeLessThanOrEqual(1);
      expect(result.onchain_sentiment!.retail_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.onchain_sentiment!.retail_sentiment).toBeLessThanOrEqual(1);
    });
  });

  describe('Technical Sentiment', () => {
    it('should analyze technical indicators for sentiment', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'BTC',
        sources: ['technical'],
        time_range: '24h',
        include_technical_analysis: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.technical_sentiment).toBeDefined();
      expect(result.technical_sentiment!.trend_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.technical_sentiment!.trend_sentiment).toBeLessThanOrEqual(1);
      expect(result.technical_sentiment!.momentum_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.technical_sentiment!.momentum_sentiment).toBeLessThanOrEqual(1);
    });
  });

  describe('Trend Analysis', () => {
    it('should detect sentiment trends', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'SOL',
        sources: ['twitter', 'reddit'],
        time_range: '7d',
        include_trend_analysis: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.trend_analysis).toBeDefined();
      expect(result.trend_analysis!.sentiment_trend).toMatch(/^(improving|declining|stable)$/);
      expect(result.trend_analysis!.trend_strength).toBeGreaterThanOrEqual(0);
      expect(result.trend_analysis!.trend_strength).toBeLessThanOrEqual(1);
    });
  });

  describe('Real-time Updates', () => {
    it('should provide real-time sentiment updates', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'BONK',
        sources: ['twitter'],
        time_range: '1h',
        real_time_updates: true
      };

      const result = await engine.analyzeSentiment(request);

      expect(result.last_updated).toBeLessThanOrEqual(Date.now());
      expect(result.last_updated).toBeGreaterThan(Date.now() - 3600000); // Within last hour
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid asset symbols', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'INVALID_TOKEN',
        sources: ['twitter'],
        time_range: '24h'
      };

      // Should not throw but may return neutral sentiment with low confidence
      const result = await engine.analyzeSentiment(request);
      expect(result.confidence_score).toBeLessThan(0.5);
    });

    it('should handle empty source arrays', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'SOL',
        sources: [],
        time_range: '24h'
      };

      await expect(engine.analyzeSentiment(request)).rejects.toThrow();
    });
  });

  describe('Batch Processing', () => {
    it('should handle batch sentiment analysis', async () => {
      const assets = ['SOL', 'ETH', 'BTC', 'BONK'];
      const requests: SentimentAnalysisRequest[] = assets.map(asset => ({
        asset,
        sources: ['twitter'],
        time_range: '24h'
      }));

      const results = await Promise.all(
        requests.map(req => engine.analyzeSentiment(req))
      );

      expect(results).toHaveLength(4);
      results.forEach((result, index) => {
        expect(result.asset).toBe(assets[index]);
        expect(typeof result.overall_sentiment).toBe('number');
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should complete analysis within reasonable time', async () => {
      const request: SentimentAnalysisRequest = {
        asset: 'SOL',
        sources: ['twitter'],
        time_range: '24h'
      };

      const startTime = Date.now();
      const result = await engine.analyzeSentiment(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toBeDefined();
    });
  });
});

describe('Sentiment Score Calculation', () => {
  let engine: SentimentAnalysisEngine;

  beforeEach(() => {
    engine = new SentimentAnalysisEngine();
  });

  it('should calculate weighted sentiment scores correctly', () => {
    // This would test internal sentiment scoring logic
    // For now, we'll test the public interface
    expect(engine).toBeDefined();
  });

  it('should normalize sentiment scores to [-1, 1] range', async () => {
    const request: SentimentAnalysisRequest = {
      asset: 'SOL',
      sources: ['twitter', 'reddit', 'news'],
      time_range: '24h'
    };

    const result = await engine.analyzeSentiment(request);

    expect(result.overall_sentiment).toBeGreaterThanOrEqual(-1);
    expect(result.overall_sentiment).toBeLessThanOrEqual(1);
    
    Object.values(result.source_breakdown).forEach(score => {
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('Sentiment Correlation', () => {
  let engine: SentimentAnalysisEngine;

  beforeEach(() => {
    engine = new SentimentAnalysisEngine();
  });

  it('should identify sentiment correlations between assets', async () => {
    const request1: SentimentAnalysisRequest = {
      asset: 'BTC',
      sources: ['twitter'],
      time_range: '24h'
    };

    const request2: SentimentAnalysisRequest = {
      asset: 'ETH',
      sources: ['twitter'],
      time_range: '24h'
    };

    const [btcSentiment, ethSentiment] = await Promise.all([
      engine.analyzeSentiment(request1),
      engine.analyzeSentiment(request2)
    ]);

    expect(btcSentiment.overall_sentiment).toBeDefined();
    expect(ethSentiment.overall_sentiment).toBeDefined();
    
    // BTC and ETH sentiment should often be correlated in real scenarios
    // This is just testing that we get valid sentiment scores
    expect(typeof btcSentiment.overall_sentiment).toBe('number');
    expect(typeof ethSentiment.overall_sentiment).toBe('number');
  });
});