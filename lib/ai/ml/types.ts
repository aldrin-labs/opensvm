/**
 * Advanced AI/ML Types for OpenSVM
 */

import type { Connection, PublicKey } from '@solana/web3.js';

// Core ML Types
export interface TensorData {
  shape: number[];
  data: number[];
  dtype: 'float32' | 'int32' | 'uint8';
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  volume?: number;
  metadata?: Record<string, any>;
}

export interface PredictionResult {
  value: number;
  prediction: number; // Keep for backward compatibility
  confidence: number;
  timestamp: number;
  horizon: number; // prediction horizon in milliseconds
  model: string;
  metadata?: Record<string, any>;
}

// Market Analysis Types
export interface MarketSentiment {
  score: number; // -1 to 1 (bearish to bullish)
  confidence: number; // 0 to 1
  sources: SentimentSource[];
  timestamp: number;
  breakdown: {
    social: number;
    onChain: number;
    technical: number;
    fundamental: number;
  };
}

export interface SentimentSource {
  source: 'twitter' | 'discord' | 'reddit' | 'on_chain' | 'news' | 'technical';
  score: number;
  weight: number;
  data: any;
  timestamp: number;
}

// Computer Vision Types
export interface ChartPattern {
  type: 'head_and_shoulders' | 'double_top' | 'double_bottom' | 'triangle' | 'wedge' | 'flag' | 'pennant' | 'support' | 'resistance';
  confidence: number;
  coordinates: { x: number; y: number }[];
  timeframe: string;
  prediction: 'bullish' | 'bearish' | 'neutral';
  target?: number;
  stopLoss?: number;
}

export interface VisualAnomaly {
  type: 'volume_spike' | 'price_gap' | 'unusual_pattern' | 'liquidity_drain';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  description: string;
  timestamp: number;
}

// Behavioral Analysis Types
export interface WalletBehaviorProfile {
  address: string;
  risk_score: number;
  behavior_class: 'retail' | 'whale' | 'arbitrageur' | 'mev_bot' | 'wash_trader' | 'normal' | 'suspicious';
  features: {
    transaction_frequency: number;
    average_transaction_size: number;
    time_pattern_score: number;
    program_diversity: number;
    network_centrality: number;
    profit_consistency: number;
  };
  patterns: BehavioralPattern[];
  last_updated: number;
}

export interface BehavioralPattern {
  type: 'sandwiching' | 'front_running' | 'wash_trading' | 'pump_dump' | 'arbitrage' | 'normal_trading';
  confidence: number;
  frequency: number;
  profitability: number;
  risk_level: 'low' | 'medium' | 'high';
  examples: string[]; // transaction signatures
}

// MEV Detection Types
export interface MEVOpportunity {
  type: 'arbitrage' | 'sandwich' | 'liquidation' | 'front_run' | 'back_run';
  profitability: number; // in USD
  gas_cost: number;
  net_profit: number;
  confidence: number;
  complexity: 'simple' | 'medium' | 'complex';
  time_sensitivity: number; // seconds until opportunity expires
  required_capital: number;
  pools: string[];
  tokens: string[];
  execution_path: ExecutionStep[];
}

export interface ExecutionStep {
  action: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'borrow' | 'repay' | 'flashloan';
  protocol: string;
  input_token: string;
  output_token: string;
  amount: number;
  estimated_gas: number;
}

// Portfolio Optimization Types
export interface PortfolioOptimizationRequest {
  wallet_address: string;
  objective: 'maximize_return' | 'minimize_risk' | 'maximize_sharpe' | 'maximize_yield';
  constraints: {
    max_risk: number;
    min_liquidity: number;
    max_positions: number;
    excluded_tokens: string[];
    preferred_protocols: string[];
  };
  time_horizon: number; // in days
}

export interface OptimizedPortfolio {
  allocations: PortfolioAllocation[];
  expected_return: number;
  expected_risk: number;
  sharpe_ratio: number;
  diversification_score: number;
  rebalancing_frequency: number;
  estimated_costs: {
    gas: number;
    slippage: number;
    fees: number;
  };
}

export interface PortfolioAllocation {
  token: string;
  symbol: string;
  percentage: number;
  amount: number;
  usd_value: number;
  strategy: 'hold' | 'stake' | 'lend' | 'provide_liquidity' | 'farm';
  protocol?: string;
  expected_apy: number;
  risk_score: number;
}

// NLP Engine Types
export interface NLPQuery {
  text: string;
  intent: string;
  entities: NLPEntity[];
  confidence: number;
  context?: Record<string, any>;
}

export interface NLPEntity {
  type: 'address' | 'token' | 'amount' | 'time' | 'protocol' | 'action' | 'transaction_hash';
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface NLPResponse {
  answer: string;
  confidence: number;
  sources: string[];
  visualizations?: VisualizationSpec[];
  actions?: RecommendedAction[];
}

export interface VisualizationSpec {
  type: 'chart' | 'graph' | 'table' | 'metric';
  config: Record<string, any>;
  data: any[];
}

export interface RecommendedAction {
  type: 'transaction' | 'analysis' | 'monitoring' | 'optimization';
  description: string;
  parameters: Record<string, any>;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
}

// Compliance Types
export interface ComplianceScore {
  overall_score: number; // 0-100
  risk_level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  factors: ComplianceFactor[];
  recommendations: string[];
  last_updated: number;
}

export interface ComplianceFactor {
  category: 'aml' | 'sanctions' | 'kyc' | 'transaction_patterns' | 'geographical' | 'volume_analysis';
  score: number;
  weight: number;
  description: string;
  evidence: any[];
}

// Model Training Types
export interface ModelTrainingConfig {
  model_type: 'lstm' | 'gru' | 'transformer' | 'cnn' | 'random_forest' | 'gradient_boosting';
  features: string[];
  target: string;
  window_size: number;
  batch_size: number;
  epochs: number;
  learning_rate: number;
  validation_split: number;
  callbacks: TrainingCallback[];
}

export interface TrainingCallback {
  type: 'early_stopping' | 'lr_scheduler' | 'checkpoint' | 'tensorboard';
  config: Record<string, any>;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  mse?: number;
  mae?: number;
  r2?: number;
  auc_roc?: number;
}

// Feature Engineering Types
export interface FeatureExtractor {
  name: string;
  extract(data: any[]): number[];
  dependencies: string[];
  window_size: number;
}

export interface TechnicalIndicator {
  name: string;
  calculate(prices: number[], params?: Record<string, number>): number[];
  type: 'trend' | 'momentum' | 'volatility' | 'volume';
}

// Utility Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export interface ModelPipeline {
  preprocessing: PreprocessingStep[];
  model: MLModel;
  postprocessing: PostprocessingStep[];
}

export interface PreprocessingStep {
  name: string;
  transform(data: any): any;
  inverse_transform?(data: any): any;
}

export interface PostprocessingStep {
  name: string;
  transform(predictions: any): any;
}

export interface MLModel {
  name: string;
  version: string;
  predict(input: TensorData): Promise<TensorData>;
  train?(data: TensorData[], labels: TensorData[]): Promise<ModelMetrics>;
  save?(path: string): Promise<void>;
  load?(path: string): Promise<void>;
}

// Event Types for Real-time Processing
export interface MarketEvent {
  type: 'price_change' | 'volume_spike' | 'new_listing' | 'delisting' | 'protocol_update';
  token?: string;
  protocol?: string;
  data: any;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProcessingResult {
  event: MarketEvent;
  predictions: PredictionResult[];
  sentiment: MarketSentiment;
  opportunities: MEVOpportunity[];
  alerts: Alert[];
  timestamp: number;
}

export interface Alert {
  id: string;
  type: 'price_alert' | 'risk_alert' | 'opportunity_alert' | 'compliance_alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data: any;
  timestamp: number;
  expires_at?: number;
}

// Configuration Types
export interface MLConfig {
  models: {
    price_prediction: ModelConfig;
    sentiment_analysis: ModelConfig;
    mev_detection: ModelConfig;
    behavioral_analysis: ModelConfig;
  };
  data_sources: DataSourceConfig[];
  features: FeatureConfig;
  processing: ProcessingConfig;
}

export interface ModelConfig {
  enabled: boolean;
  model_path: string;
  update_frequency: number; // in milliseconds
  confidence_threshold: number;
  max_batch_size: number;
}

export interface DataSourceConfig {
  name: string;
  url: string;
  api_key?: string;
  rate_limit: number;
  timeout: number;
  retry_attempts: number;
}

export interface FeatureConfig {
  technical_indicators: string[];
  on_chain_metrics: string[];
  sentiment_sources: string[];
  lookback_periods: number[];
}

export interface ProcessingConfig {
  max_concurrent_requests: number;
  cache_ttl: number;
  batch_processing_interval: number;
  real_time_processing: boolean;
}

// Advanced Analytics Types
export interface RiskMetrics {
  value_at_risk: number; // VaR at 95% confidence
  conditional_value_at_risk: number; // CVaR
  expected_shortfall: number; // Same as CVaR
  maximum_drawdown: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  beta: number;
  alpha: number;
  correlation_matrix: number[][];
}

export interface LiquidityMetrics {
  bid_ask_spread: number;
  market_depth: number;
  slippage_1_percent: number;
  slippage_5_percent: number;
  volume_weighted_price: number;
  price_impact: number;
}

// Prediction Request Types
export interface PredictionRequest {
  asset: string;
  prediction_type: 'price' | 'volatility' | 'volume' | 'sentiment';
  time_horizon: '1hour' | '1day' | '1week' | '1month';
  confidence_level: number;
  include_risk_metrics?: boolean;
  include_scenarios?: boolean;
  include_market_sentiment?: boolean;
  include_model_metrics?: boolean;
}

export interface PredictionResponse {
  asset: string;
  prediction_type: string;
  predictions: PredictionResult[];
  risk_metrics?: RiskMetrics;
  market_context?: {
    sentiment_score: number;
    sentiment_impact: number;
    volatility_regime: string;
    liquidity_conditions: string;
  };
  model_metrics?: ModelMetrics;
  scenarios?: PredictionScenario[];
}

export interface PredictionScenario {
  name: string;
  probability: number;
  prediction: number;
  conditions: string[];
}