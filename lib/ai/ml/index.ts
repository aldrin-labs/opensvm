/**
 * OpenSVM AI/ML Engine - Main Export Module
 * 
 * This module serves as the primary entry point for all AI/ML functionality
 * in the OpenSVM blockchain analytics platform.
 */

// Core utilities and types
export * from './types';
export { TensorUtils } from './core/tensor-utils';

// Main engines - singleton instances
export { predictiveAnalyticsEngine } from './predictive-analytics';
export { sentimentAnalysisEngine } from './sentiment-analysis';
export { nlpEngine } from './nlp-engine';
export { computerVisionEngine } from './computer-vision';
export { behavioralModelsEngine } from './behavioral-models';
export { portfolioOptimizationEngine } from './portfolio-optimization';
export { automatedResearchEngine } from './automated-research';

// Engine classes for custom instantiation
export { 
  PredictiveAnalyticsEngine,
  type PredictionRequest,
  type PredictionResult
} from './predictive-analytics';

export {
  SentimentAnalysisEngine,
  type SentimentAnalysisRequest,
  type SentimentAnalysisResult
} from './sentiment-analysis';

export {
  NLPEngine,
  type ConversationRequest,
  type ConversationResponse
} from './nlp-engine';

export {
  ComputerVisionEngine,
  type ChartAnalysisRequest,
  type ChartAnalysisResult
} from './computer-vision';

export {
  BehavioralModelsEngine,
  type WalletAnalysisRequest,
  type WalletAnalysisResult,
  type MEVDetectionRequest,
  type MEVDetectionResult
} from './behavioral-models';

export {
  PortfolioOptimizationEngine,
  type PortfolioAnalysisRequest,
  type PortfolioOptimizationResult
} from './portfolio-optimization';

export {
  AutomatedResearchEngine,
  type AutomatedResearchRequest,
  type ComprehensiveResearchReport
} from './automated-research';

// Utility functions and helpers
export {
  formatCurrency,
  formatPercentage,
  getRiskColor,
  getStrategyIcon
} from './portfolio-optimization';

export {
  calculateResearchConfidence,
  consolidateResearchReports,
  generateResearchAlerts,
  formatResearchSummary,
  mockResearchData
} from './automated-research';

// Main integration orchestrator
export { AIMLOrchestrator } from './orchestrator';
export type { 
  AIMLConfig,
  EngineStatus,
  SystemHealth,
  IntegratedAnalysisRequest,
  IntegratedAnalysisResult
} from './orchestrator';

// Version info
export const AI_ML_VERSION = '1.0.0';
export const AI_ML_BUILD_DATE = new Date().toISOString();

// Feature flags
export const AI_ML_FEATURES = {
  PREDICTIVE_ANALYTICS: true,
  SENTIMENT_ANALYSIS: true,
  NLP_ENGINE: true,
  COMPUTER_VISION: true,
  BEHAVIORAL_MODELS: true,
  PORTFOLIO_OPTIMIZATION: true,
  AUTOMATED_RESEARCH: true,
  REAL_TIME_PROCESSING: true,
  MEV_DETECTION: true,
  WALLET_CLUSTERING: true,
  INTEGRATED_ORCHESTRATION: true
};

// Default configuration
export const DEFAULT_CONFIG = {
  enableRealTimeUpdates: true,
  maxConcurrentAnalyses: 10,
  cacheTimeout: 300000, // 5 minutes
  confidenceThreshold: 0.7,
  riskThreshold: 0.8,
  updateInterval: 60000, // 1 minute
  orchestration: {
    enableCrossEngineCorrelation: true,
    enableSmartCaching: true,
    enablePerformanceOptimization: true,
    maxRetries: 3,
    timeoutMs: 30000
  }
};

/**
 * Initialize the complete AI/ML system
 * @param config Optional configuration overrides
 * @returns Configured AIMLOrchestrator instance
 */
export function initializeAIML(config?: Partial<typeof DEFAULT_CONFIG>): AIMLOrchestrator {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return new AIMLOrchestrator(finalConfig);
}

/**
 * Get system health and status
 * @returns Current status of all AI/ML engines
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const orchestrator = new AIMLOrchestrator();
  return await orchestrator.getSystemHealth();
}

/**
 * Quick setup for common use cases
 */
export const QuickSetup = {
  /**
   * Setup for trading/investment analysis
   */
  forTrading: () => initializeAIML({
    enableRealTimeUpdates: true,
    confidenceThreshold: 0.8,
    updateInterval: 30000, // 30 seconds
    orchestration: {
      enableCrossEngineCorrelation: true,
      enableSmartCaching: true,
      enablePerformanceOptimization: true,
      maxRetries: 2,
      timeoutMs: 15000
    }
  }),

  /**
   * Setup for research and compliance
   */
  forResearch: () => initializeAIML({
    enableRealTimeUpdates: false,
    confidenceThreshold: 0.9,
    updateInterval: 300000, // 5 minutes
    orchestration: {
      enableCrossEngineCorrelation: true,
      enableSmartCaching: true,
      enablePerformanceOptimization: false,
      maxRetries: 5,
      timeoutMs: 60000
    }
  }),

  /**
   * Setup for real-time monitoring
   */
  forMonitoring: () => initializeAIML({
    enableRealTimeUpdates: true,
    confidenceThreshold: 0.7,
    updateInterval: 10000, // 10 seconds
    orchestration: {
      enableCrossEngineCorrelation: false,
      enableSmartCaching: true,
      enablePerformanceOptimization: true,
      maxRetries: 1,
      timeoutMs: 5000
    }
  }),

  /**
   * Setup for development/testing
   */
  forDevelopment: () => initializeAIML({
    enableRealTimeUpdates: false,
    confidenceThreshold: 0.5,
    updateInterval: 60000,
    orchestration: {
      enableCrossEngineCorrelation: true,
      enableSmartCaching: false,
      enablePerformanceOptimization: false,
      maxRetries: 1,
      timeoutMs: 10000
    }
  })
};