/**
 * Test suite for Predictive Analytics Engine
 */

import { PredictiveAnalyticsEngine, PredictionRequest } from '../predictive-analytics';
import { TensorUtils } from '../core/tensor-utils';

describe('PredictiveAnalyticsEngine', () => {
  let engine: PredictiveAnalyticsEngine;

  beforeEach(() => {
    engine = new PredictiveAnalyticsEngine();
  });

  describe('Price Prediction', () => {
    it('should generate price predictions for valid input', async () => {
      const request: PredictionRequest = {
        asset: 'SOL',
        prediction_type: 'price',
        time_horizon: '1day',
        confidence_level: 0.95,
        include_scenarios: true
      };

      const prediction = await engine.generatePrediction(request);

      expect(prediction).toBeDefined();
      expect(prediction.asset).toBe('SOL');
      expect(prediction.prediction_type).toBe('price');
      expect(prediction.predictions).toHaveLength(1);
      expect(prediction.predictions[0].value).toBeGreaterThan(0);
      expect(prediction.predictions[0].confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.predictions[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should handle multiple time horizons', async () => {
      const request: PredictionRequest = {
        asset: 'ETH',
        prediction_type: 'price',
        time_horizon: '1week',
        confidence_level: 0.90
      };

      const prediction = await engine.generatePrediction(request);

      expect(prediction.predictions).toHaveLength(1);
      expect(prediction.predictions[0].timestamp).toBeGreaterThan(Date.now());
    });

    it('should include risk metrics when requested', async () => {
      const request: PredictionRequest = {
        asset: 'BTC',
        prediction_type: 'price',
        time_horizon: '1day',
        confidence_level: 0.95,
        include_risk_metrics: true
      };

      const prediction = await engine.generatePrediction(request);

      expect(prediction.risk_metrics).toBeDefined();
      expect(prediction.risk_metrics!.value_at_risk).toBeDefined();
      expect(prediction.risk_metrics!.expected_shortfall).toBeDefined();
      expect(prediction.risk_metrics!.maximum_drawdown).toBeDefined();
    });
  });

  describe('Volatility Prediction', () => {
    it('should predict volatility correctly', async () => {
      const request: PredictionRequest = {
        asset: 'SOL',
        prediction_type: 'volatility',
        time_horizon: '1day',
        confidence_level: 0.95
      };

      const prediction = await engine.generatePrediction(request);

      expect(prediction.prediction_type).toBe('volatility');
      expect(prediction.predictions[0].value).toBeGreaterThan(0);
      expect(prediction.predictions[0].value).toBeLessThan(2); // Reasonable volatility range
    });
  });

  describe('Market Sentiment Integration', () => {
    it('should incorporate market sentiment in predictions', async () => {
      const request: PredictionRequest = {
        asset: 'BONK',
        prediction_type: 'price',
        time_horizon: '1day',
        confidence_level: 0.95,
        include_market_sentiment: true
      };

      const prediction = await engine.generatePrediction(request);

      expect(prediction.market_context).toBeDefined();
      expect(prediction.market_context!.sentiment_score).toBeDefined();
      expect(prediction.market_context!.sentiment_impact).toBeDefined();
    });
  });

  describe('Batch Predictions', () => {
    it('should handle batch prediction requests', async () => {
      const assets = ['SOL', 'ETH', 'BTC'];
      const requests = assets.map(asset => ({
        asset,
        prediction_type: 'price' as const,
        time_horizon: '1day' as const,
        confidence_level: 0.95
      }));

      const predictions = await Promise.all(
        requests.map(req => engine.generatePrediction(req))
      );

      expect(predictions).toHaveLength(3);
      predictions.forEach((prediction, index) => {
        expect(prediction.asset).toBe(assets[index]);
        expect(prediction.predictions).toHaveLength(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid asset symbols', async () => {
      const request: PredictionRequest = {
        asset: 'INVALID_TOKEN',
        prediction_type: 'price',
        time_horizon: '1day',
        confidence_level: 0.95
      };

      await expect(engine.generatePrediction(request)).rejects.toThrow();
    });

    it('should validate confidence levels', async () => {
      const request: PredictionRequest = {
        asset: 'SOL',
        prediction_type: 'price',
        time_horizon: '1day',
        confidence_level: 1.5 // Invalid confidence level
      };

      await expect(engine.generatePrediction(request)).rejects.toThrow();
    });
  });

  describe('Model Performance', () => {
    it('should return reasonable prediction accuracy', async () => {
      const request: PredictionRequest = {
        asset: 'SOL',
        prediction_type: 'price',
        time_horizon: '1hour',
        confidence_level: 0.95,
        include_model_metrics: true
      };

      const prediction = await engine.generatePrediction(request);

      expect(prediction.model_metrics).toBeDefined();
      expect(prediction.model_metrics!.accuracy).toBeGreaterThan(0.3); // Reasonable minimum accuracy
      expect(prediction.model_metrics!.mae).toBeGreaterThan(0);
      expect(prediction.model_metrics!.mse).toBeGreaterThan(0);
    });
  });
});

describe('TensorUtils', () => {
  describe('Basic Operations', () => {
    it('should create tensors correctly', () => {
      const data = [1, 2, 3, 4];
      const shape = [2, 2];
      const tensor = TensorUtils.createTensor(data, shape);

      expect(tensor.data).toEqual(data);
      expect(tensor.shape).toEqual(shape);
    });

    it('should add tensors correctly', () => {
      const tensor1 = TensorUtils.createTensor([1, 2, 3, 4], [2, 2]);
      const tensor2 = TensorUtils.createTensor([2, 3, 4, 5], [2, 2]);

      const result = TensorUtils.add(tensor1, tensor2);

      expect(result.data).toEqual([3, 5, 7, 9]);
      expect(result.shape).toEqual([2, 2]);
    });

    it('should multiply tensors correctly', () => {
      const tensor1 = TensorUtils.createTensor([1, 2, 3, 4], [2, 2]);
      const tensor2 = TensorUtils.createTensor([2, 0, 1, 2], [2, 2]);

      const result = TensorUtils.matmul(tensor1, tensor2);

      expect(result.data).toEqual([4, 4, 10, 8]);
      expect(result.shape).toEqual([2, 2]);
    });
  });

  describe('Activation Functions', () => {
    it('should calculate ReLU correctly', () => {
      const input = [-2, -1, 0, 1, 2];
      const expected = [0, 0, 0, 1, 2];

      const result = input.map(x => TensorUtils.relu(x));

      expect(result).toEqual(expected);
    });

    it('should calculate sigmoid correctly', () => {
      const input = [0];
      const result = input.map(x => TensorUtils.sigmoid(x));

      expect(result[0]).toBeCloseTo(0.5, 5);
    });

    it('should calculate tanh correctly', () => {
      const input = [0];
      const result = input.map(x => TensorUtils.tanh(x));

      expect(result[0]).toBeCloseTo(0, 5);
    });
  });

  describe('Time Series Operations', () => {
    it('should create rolling windows correctly', () => {
      const data = [1, 2, 3, 4, 5, 6];
      const windowSize = 3;

      const windows = TensorUtils.createRollingWindows(data, windowSize);

      expect(windows).toHaveLength(4);
      expect(windows[0]).toEqual([1, 2, 3]);
      expect(windows[3]).toEqual([4, 5, 6]);
    });

    it('should calculate moving averages correctly', () => {
      const data = [1, 2, 3, 4, 5, 6];
      const windowSize = 3;

      const movingAvg = TensorUtils.movingAverage(data, windowSize);

      expect(movingAvg).toHaveLength(4);
      expect(movingAvg[0]).toBeCloseTo(2, 5); // (1+2+3)/3
      expect(movingAvg[3]).toBeCloseTo(5, 5); // (4+5+6)/3
    });
  });

  describe('Statistical Functions', () => {
    it('should calculate standard deviation correctly', () => {
      const data = [1, 2, 3, 4, 5];
      const std = TensorUtils.std(data);

      expect(std).toBeCloseTo(1.5811, 4);
    });

    it('should calculate correlation correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      const correlation = TensorUtils.correlation(x, y);

      expect(correlation).toBeCloseTo(1, 5); // Perfect positive correlation
    });
  });

  describe('Error Handling', () => {
    it('should handle tensor shape mismatches', () => {
      const tensor1 = TensorUtils.createTensor([1, 2], [1, 2]);
      const tensor2 = TensorUtils.createTensor([1, 2, 3], [1, 3]);

      expect(() => TensorUtils.add(tensor1, tensor2)).toThrow();
    });

    it('should handle empty arrays', () => {
      expect(() => TensorUtils.createTensor([], [0])).not.toThrow();
    });
  });
});