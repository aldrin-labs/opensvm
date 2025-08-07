/**
 * Advanced Predictive Analytics Engine for OpenSVM
 * 
 * Features:
 * - LSTM/GRU-style time-series forecasting
 * - Token price prediction
 * - Volatility prediction models
 * - Liquidity prediction for DEX optimization
 * - Multi-horizon forecasting
 */

import { TensorUtils, TimeSeriesTensorUtils } from './core/tensor-utils';
import type { 
  TimeSeriesPoint, 
  PredictionResult, 
  TensorData, 
  ModelConfig,
  LiquidityMetrics,
  RiskMetrics
} from './types';

export interface PricePredictionRequest {
  token: string;
  horizon: number; // prediction horizon in minutes
  confidence_level: number; // 0.95 for 95% confidence interval
  include_volatility: boolean;
  include_volume: boolean;
}

export interface PricePredictionResponse {
  token: string;
  predictions: PredictionResult[];
  confidence_interval: {
    lower: number[];
    upper: number[];
  };
  volatility_forecast?: number[];
  volume_forecast?: number[];
  risk_metrics: RiskMetrics;
  market_regime: 'trending' | 'mean_reverting' | 'volatile' | 'stable';
}

export interface VolatilityPrediction {
  token: string;
  current_volatility: number;
  predicted_volatility: number[];
  garch_params: {
    alpha: number;
    beta: number;
    omega: number;
  };
  var_95: number; // Value at Risk 95%
  var_99: number; // Value at Risk 99%
}

export interface LiquidityPrediction {
  pool_address: string;
  current_liquidity: number;
  predicted_liquidity: number[];
  optimal_trade_size: number;
  price_impact_curve: { size: number; impact: number }[];
  slippage_forecast: number[];
}

/**
 * LSTM-style Recurrent Neural Network for Time Series Prediction
 * Implemented using tensor operations for browser compatibility
 */
class SimpleLSTMCell {
  private weights: {
    forget_gate: TensorData;
    input_gate: TensorData;
    candidate_gate: TensorData;
    output_gate: TensorData;
    hidden_to_hidden: TensorData;
    bias: TensorData;
  };

  constructor(inputSize: number, hiddenSize: number) {
    // Initialize weights with Xavier initialization
    this.weights = this.initializeWeights(inputSize, hiddenSize);
  }

  private initializeWeights(inputSize: number, hiddenSize: number) {
    const xavier = (fanIn: number, fanOut: number) => {
      const limit = Math.sqrt(6 / (fanIn + fanOut));
      return Array.from({ length: fanIn * fanOut }, () => 
        (Math.random() * 2 - 1) * limit
      );
    };

    return {
      forget_gate: TensorUtils.createTensor(
        xavier(inputSize + hiddenSize, hiddenSize), 
        [inputSize + hiddenSize, hiddenSize]
      ),
      input_gate: TensorUtils.createTensor(
        xavier(inputSize + hiddenSize, hiddenSize),
        [inputSize + hiddenSize, hiddenSize]
      ),
      candidate_gate: TensorUtils.createTensor(
        xavier(inputSize + hiddenSize, hiddenSize),
        [inputSize + hiddenSize, hiddenSize]
      ),
      output_gate: TensorUtils.createTensor(
        xavier(inputSize + hiddenSize, hiddenSize),
        [inputSize + hiddenSize, hiddenSize]
      ),
      hidden_to_hidden: TensorUtils.createTensor(
        xavier(hiddenSize, hiddenSize),
        [hiddenSize, hiddenSize]
      ),
      bias: TensorUtils.createTensor(
        new Array(hiddenSize * 4).fill(0),
        [hiddenSize * 4, 1]
      )
    };
  }

  forward(input: TensorData, hiddenState: TensorData, cellState: TensorData): {
    newHidden: TensorData;
    newCell: TensorData;
  } {
    // Concatenate input and hidden state
    const combined = TensorUtils.createTensor(
      [...input.data, ...hiddenState.data],
      [input.data.length + hiddenState.data.length]
    );

    // Compute gates
    const forgetGate = this.computeGate(combined, this.weights.forget_gate, 0);
    const inputGate = this.computeGate(combined, this.weights.input_gate, 1);
    const candidateGate = this.computeGate(combined, this.weights.candidate_gate, 2);
    const outputGate = this.computeGate(combined, this.weights.output_gate, 3);

    // Update cell state
    const forgetPart = TensorUtils.multiply(cellState, forgetGate);
    const inputPart = TensorUtils.multiply(inputGate, candidateGate);
    const newCell = TensorUtils.add(forgetPart, inputPart);

    // Compute new hidden state
    const cellTanh = TensorUtils.tanh(newCell);
    const newHidden = TensorUtils.multiply(outputGate, cellTanh);

    return { newHidden, newCell };
  }

  private computeGate(input: TensorData, weights: TensorData, biasOffset: number): TensorData {
    // Simplified gate computation (in practice, this would be matrix multiplication)
    const result = input.data.map((x, i) => {
      const weightIndex = i % weights.shape[1];
      return TensorUtils.sigmoid(TensorUtils.createTensor([x * weights.data[weightIndex]], [1])).data[0];
    });

    return TensorUtils.createTensor(result, [result.length]);
  }
}

/**
 * Main Predictive Analytics Engine
 */
export class PredictiveAnalyticsEngine {
  private models: Map<string, SimpleLSTMCell> = new Map();
  private dataCache: Map<string, TimeSeriesPoint[]> = new Map();
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * Predict token price using LSTM model
   */
  async predictTokenPrice(request: PricePredictionRequest): Promise<PricePredictionResponse> {
    try {
      // Get historical data
      const historicalData = await this.getHistoricalData(request.token);
      if (historicalData.length < 100) {
        throw new Error(`Insufficient data for ${request.token}: ${historicalData.length} points`);
      }

      // Prepare features
      const features = this.prepareFeatures(historicalData, {
        include_volume: request.include_volume,
        include_volatility: request.include_volatility
      });

      // Get or create model
      const model = this.getOrCreateModel(request.token, features.shape[1]);

      // Generate predictions
      const predictions = await this.generatePredictions(
        model,
        features,
        request.horizon,
        request.confidence_level
      );

      // Calculate confidence intervals
      const confidence_interval = this.calculateConfidenceIntervals(
        predictions,
        request.confidence_level
      );

      // Predict volatility if requested
      let volatility_forecast: number[] | undefined;
      if (request.include_volatility) {
        volatility_forecast = await this.predictVolatility(historicalData, request.horizon);
      }

      // Predict volume if requested
      let volume_forecast: number[] | undefined;
      if (request.include_volume) {
        volume_forecast = await this.predictVolume(historicalData, request.horizon);
      }

      // Calculate risk metrics
      const risk_metrics = this.calculateRiskMetrics(historicalData, predictions);

      // Determine market regime
      const market_regime = this.determineMarketRegime(historicalData);

      return {
        token: request.token,
        predictions,
        confidence_interval,
        volatility_forecast,
        volume_forecast,
        risk_metrics,
        market_regime
      };

    } catch (error) {
      console.error('Error predicting token price:', error);
      throw error;
    }
  }

  /**
   * Predict market volatility using GARCH-like model
   */
  async predictVolatility(
    historicalData: TimeSeriesPoint[],
    horizon: number
  ): Promise<VolatilityPrediction> {
    const prices = historicalData.map(p => p.value);
    const returns = this.calculateReturns(prices);
    
    // Simple GARCH(1,1) implementation
    const garchParams = this.estimateGARCHParameters(returns);
    const volatilityForecast = this.forecastGARCH(returns, garchParams, horizon);
    
    // Calculate VaR
    const currentVol = this.calculateVolatility(returns.slice(-30)); // Last 30 periods
    const var_95 = -1.645 * currentVol; // 95% VaR
    const var_99 = -2.326 * currentVol; // 99% VaR

    return {
      token: 'TOKEN', // This would be passed from the caller
      current_volatility: currentVol,
      predicted_volatility: volatilityForecast,
      garch_params: garchParams,
      var_95,
      var_99
    };
  }

  /**
   * Predict liquidity for DEX optimization
   */
  async predictLiquidity(poolAddress: string, horizon: number): Promise<LiquidityPrediction> {
    const liquidityData = await this.getLiquidityData(poolAddress);
    
    // Simple trend extrapolation for liquidity prediction
    const liquidity_values = liquidityData.map(l => l.value);
    const trend = this.calculateTrend(liquidity_values);
    
    const predicted_liquidity = Array.from({ length: horizon }, (_, i) => {
      const lastValue = liquidity_values[liquidity_values.length - 1];
      return lastValue + trend * (i + 1);
    });

    // Calculate optimal trade size
    const current_liquidity = liquidity_values[liquidity_values.length - 1];
    const optimal_trade_size = current_liquidity * 0.01; // 1% of pool size

    // Generate price impact curve
    const price_impact_curve = Array.from({ length: 10 }, (_, i) => {
      const size = optimal_trade_size * (i + 1);
      const impact = this.calculatePriceImpact(size, current_liquidity);
      return { size, impact };
    });

    // Predict slippage
    const slippage_forecast = predicted_liquidity.map(liq => 
      this.calculateSlippage(optimal_trade_size, liq)
    );

    return {
      pool_address: poolAddress,
      current_liquidity,
      predicted_liquidity,
      optimal_trade_size,
      price_impact_curve,
      slippage_forecast
    };
  }

  /**
   * Multi-asset correlation prediction
   */
  async predictCorrelations(tokens: string[], horizon: number): Promise<{
    correlation_matrix: number[][];
    predicted_correlations: number[][][]; // Time series of correlation matrices
  }> {
    const historicalData = await Promise.all(
      tokens.map(token => this.getHistoricalData(token))
    );

    // Calculate current correlation matrix
    const returns = historicalData.map(data => 
      this.calculateReturns(data.map(p => p.value))
    );

    const current_correlations = this.calculateCorrelationMatrix(returns);

    // Predict future correlations using DCC-GARCH approach (simplified)
    const predicted_correlations = this.forecastCorrelations(returns, horizon);

    return {
      correlation_matrix: current_correlations,
      predicted_correlations
    };
  }

  // Helper Methods

  private async getHistoricalData(token: string): Promise<TimeSeriesPoint[]> {
    // Check cache first
    if (this.dataCache.has(token)) {
      const cached = this.dataCache.get(token)!;
      // Return if data is less than 5 minutes old
      if (Date.now() - cached[cached.length - 1].timestamp < 300000) {
        return cached;
      }
    }

    // In production, this would fetch from price APIs
    // For now, generate mock data
    const data = this.generateMockPriceData(token, 1000);
    this.dataCache.set(token, data);
    return data;
  }

  private async getLiquidityData(poolAddress: string): Promise<TimeSeriesPoint[]> {
    // Mock liquidity data generation
    return this.generateMockLiquidityData(poolAddress, 200);
  }

  private generateMockPriceData(token: string, points: number): TimeSeriesPoint[] {
    const data: TimeSeriesPoint[] = [];
    let price = 100; // Starting price
    let volume = 1000000; // Starting volume
    const startTime = Date.now() - points * 60000; // 1-minute intervals

    for (let i = 0; i < points; i++) {
      // Simulate price movement with trend and noise
      const trend = Math.sin(i / 100) * 0.001;
      const noise = (Math.random() - 0.5) * 0.02;
      price *= (1 + trend + noise);

      // Simulate volume changes
      volume *= (1 + (Math.random() - 0.5) * 0.1);

      data.push({
        timestamp: startTime + i * 60000,
        value: price,
        volume: volume,
        metadata: { token }
      });
    }

    return data;
  }

  private generateMockLiquidityData(poolAddress: string, points: number): TimeSeriesPoint[] {
    const data: TimeSeriesPoint[] = [];
    let liquidity = 5000000; // Starting liquidity $5M
    const startTime = Date.now() - points * 300000; // 5-minute intervals

    for (let i = 0; i < points; i++) {
      // Simulate liquidity changes
      const change = (Math.random() - 0.5) * 0.05;
      liquidity *= (1 + change);

      data.push({
        timestamp: startTime + i * 300000,
        value: liquidity,
        metadata: { poolAddress }
      });
    }

    return data;
  }

  private prepareFeatures(data: TimeSeriesPoint[], options: {
    include_volume: boolean;
    include_volatility: boolean;
  }): TensorData {
    const prices = data.map(d => d.value);
    const returns = this.calculateReturns(prices);
    
    let features: number[][] = [returns];

    if (options.include_volume && data[0].volume !== undefined) {
      const volumes = data.map(d => d.volume!);
      const volumeReturns = this.calculateReturns(volumes);
      features.push(volumeReturns);
    }

    if (options.include_volatility) {
      const volatility = this.calculateRollingVolatility(returns, 20);
      features.push(volatility);
    }

    // Add technical indicators
    const sma20 = this.calculateSMA(prices, 20);
    const rsi = this.calculateRSI(prices, 14);
    
    features.push(sma20.slice(-returns.length));
    features.push(rsi.slice(-returns.length));

    // Transpose to get [time, features] format
    const featureMatrix = [];
    const minLength = Math.min(...features.map(f => f.length));
    
    for (let i = 0; i < minLength; i++) {
      const row = features.map(feature => feature[i]);
      featureMatrix.push(...row);
    }

    return TensorUtils.createTensor(featureMatrix, [minLength, features.length]);
  }

  private getOrCreateModel(token: string, inputSize: number): SimpleLSTMCell {
    if (!this.models.has(token)) {
      this.models.set(token, new SimpleLSTMCell(inputSize, 64)); // 64 hidden units
    }
    return this.models.get(token)!;
  }

  private async generatePredictions(
    model: SimpleLSTMCell,
    features: TensorData,
    horizon: number,
    confidence_level: number
  ): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    const sequenceLength = 60; // Use last 60 time steps
    
    // Get the last sequence for prediction
    const lastSequence = this.getLastSequence(features, sequenceLength);
    
    // Initialize hidden states
    let hiddenState = TensorUtils.createTensor(new Array(64).fill(0), [64]);
    let cellState = TensorUtils.createTensor(new Array(64).fill(0), [64]);

    // Generate predictions for each horizon step
    for (let step = 0; step < horizon; step++) {
      const input = step === 0 ? lastSequence : 
        TensorUtils.createTensor([predictions[step - 1].prediction], [1]);

      const { newHidden } = model.forward(input, hiddenState, cellState);
      
      // Simple prediction extraction (in practice, this would use an output layer)
      const prediction = newHidden.data.reduce((a, b) => a + b, 0) / newHidden.data.length;
      const confidence = Math.max(0.5, 1 - step * 0.1); // Decreasing confidence over time

      predictions.push({
        prediction,
        confidence,
        timestamp: Date.now() + step * 60000, // 1 minute steps
        horizon: step + 1,
        model: 'SimpleLSTM'
      });

      hiddenState = newHidden;
    }

    return predictions;
  }

  private getLastSequence(features: TensorData, sequenceLength: number): TensorData {
    const [timeSteps, featureCount] = features.shape;
    const startIdx = Math.max(0, timeSteps - sequenceLength) * featureCount;
    const endIdx = timeSteps * featureCount;
    
    return TensorUtils.createTensor(
      features.data.slice(startIdx, endIdx),
      [Math.min(sequenceLength, timeSteps), featureCount]
    );
  }

  private calculateConfidenceIntervals(
    predictions: PredictionResult[],
    confidence_level: number
  ): { lower: number[]; upper: number[] } {
    const z_score = confidence_level === 0.95 ? 1.96 : 2.58; // 95% or 99%
    
    const lower = predictions.map(p => {
      const uncertainty = (1 - p.confidence) * Math.abs(p.prediction) * 0.1;
      return p.prediction - z_score * uncertainty;
    });

    const upper = predictions.map(p => {
      const uncertainty = (1 - p.confidence) * Math.abs(p.prediction) * 0.1;
      return p.prediction + z_score * uncertainty;
    });

    return { lower, upper };
  }

  // Statistical Helper Methods

  private calculateReturns(prices: number[]): number[] {
    return prices.slice(1).map((price, i) => 
      Math.log(price / prices[i])
    );
  }

  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateRollingVolatility(returns: number[], window: number): number[] {
    const volatility: number[] = [];
    
    for (let i = window - 1; i < returns.length; i++) {
      const windowReturns = returns.slice(i - window + 1, i + 1);
      volatility.push(this.calculateVolatility(windowReturns));
    }
    
    return volatility;
  }

  private calculateSMA(prices: number[], period: number): number[] {
    return TimeSeriesTensorUtils.movingAverage(
      TensorUtils.createTensor(prices, [prices.length]),
      period
    ).data;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    return TimeSeriesTensorUtils.rsi(
      TensorUtils.createTensor(prices, [prices.length]),
      period
    ).data;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = values.reduce((a, b) => a + b, 0) / n;
    
    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (values[i] - meanY), 0);
    const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculatePriceImpact(tradeSize: number, liquidity: number): number {
    return tradeSize / liquidity; // Simplified linear impact
  }

  private calculateSlippage(tradeSize: number, liquidity: number): number {
    return Math.sqrt(tradeSize / liquidity) * 0.01; // Square root impact model
  }

  private calculateRiskMetrics(
    historicalData: TimeSeriesPoint[],
    predictions: PredictionResult[]
  ): RiskMetrics {
    const prices = historicalData.map(d => d.value);
    const returns = this.calculateReturns(prices);
    
    // Calculate various risk metrics
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var_95_idx = Math.floor(returns.length * 0.05);
    const var_99_idx = Math.floor(returns.length * 0.01);
    
    const value_at_risk = -sortedReturns[var_95_idx];
    const conditional_value_at_risk = -sortedReturns.slice(0, var_95_idx + 1)
      .reduce((a, b) => a + b, 0) / (var_95_idx + 1);

    // Calculate max drawdown
    let peak = prices[0];
    let maxDrawdown = 0;
    
    for (const price of prices) {
      if (price > peak) peak = price;
      const drawdown = (peak - price) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const volatility = this.calculateVolatility(returns);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const sharpe_ratio = volatility > 0 ? meanReturn / volatility : 0;

    // Sortino ratio (downside deviation)
    const downside_returns = returns.filter(r => r < 0);
    const downside_deviation = Math.sqrt(
      downside_returns.reduce((sum, r) => sum + r * r, 0) / downside_returns.length
    );
    const sortino_ratio = downside_deviation > 0 ? meanReturn / downside_deviation : 0;

    const calmar_ratio = maxDrawdown > 0 ? meanReturn / maxDrawdown : 0;

    return {
      value_at_risk,
      conditional_value_at_risk,
      max_drawdown: maxDrawdown,
      sharpe_ratio,
      sortino_ratio,
      calmar_ratio,
      beta: 1, // Would calculate against market benchmark
      alpha: 0, // Would calculate against market benchmark
      correlation_matrix: [[1]] // Single asset
    };
  }

  private determineMarketRegime(data: TimeSeriesPoint[]): 'trending' | 'mean_reverting' | 'volatile' | 'stable' {
    const prices = data.map(d => d.value);
    const returns = this.calculateReturns(prices);
    
    const volatility = this.calculateVolatility(returns.slice(-30));
    const trend = this.calculateTrend(prices.slice(-30));
    
    if (volatility > 0.3) return 'volatile';
    if (Math.abs(trend) > 0.1) return 'trending';
    if (volatility < 0.1) return 'stable';
    return 'mean_reverting';
  }

  private estimateGARCHParameters(returns: number[]): { alpha: number; beta: number; omega: number } {
    // Simplified GARCH parameter estimation
    const volatility = this.calculateVolatility(returns);
    return {
      alpha: 0.1, // Typical values
      beta: 0.85,
      omega: volatility * volatility * 0.05
    };
  }

  private forecastGARCH(
    returns: number[],
    params: { alpha: number; beta: number; omega: number },
    horizon: number
  ): number[] {
    const { alpha, beta, omega } = params;
    const forecast: number[] = [];
    
    // Initial variance estimate
    let variance = this.calculateVolatility(returns.slice(-20)) ** 2;
    
    for (let i = 0; i < horizon; i++) {
      variance = omega + alpha * variance + beta * variance;
      forecast.push(Math.sqrt(variance));
    }
    
    return forecast;
  }

  private calculateCorrelationMatrix(returns: number[][]): number[][] {
    const n = returns.length;
    const correlations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          correlations[i][j] = 1;
        } else {
          correlations[i][j] = TensorUtils.correlation(
            TensorUtils.createTensor(returns[i], [returns[i].length]),
            TensorUtils.createTensor(returns[j], [returns[j].length])
          );
        }
      }
    }
    
    return correlations;
  }

  private forecastCorrelations(returns: number[][], horizon: number): number[][][] {
    // Simplified correlation forecasting - assume constant correlations
    const currentCorr = this.calculateCorrelationMatrix(returns);
    return Array(horizon).fill(currentCorr);
  }
}

// Export singleton instance
export const predictiveAnalytics = new PredictiveAnalyticsEngine({
  enabled: true,
  model_path: '/models/price_prediction',
  update_frequency: 60000, // 1 minute
  confidence_threshold: 0.7,
  max_batch_size: 1000
});