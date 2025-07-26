import { PricingTier, DEFAULT_PRICING } from '../types/ProxyTypes';

/**
 * Utility functions for SVMAI pricing calculations
 */

/**
 * Simple SVMAI to token conversion rates
 * These can be adjusted based on market conditions
 */
export const CONVERSION_RATES = {
  // Base rates (SVMAI per Anthropic token)
  INPUT_TOKEN_RATE: 0.1,   // 0.1 SVMAI per input token
  OUTPUT_TOKEN_RATE: 0.2,  // 0.2 SVMAI per output token
  
  // Model multipliers
  HAIKU_MULTIPLIER: 1.0,   // Cheapest model
  SONNET_MULTIPLIER: 2.0,  // Mid-tier model  
  OPUS_MULTIPLIER: 5.0,    // Most expensive model
  
  // Minimum charges
  MIN_CHARGE_HAIKU: 1,
  MIN_CHARGE_SONNET: 2,
  MIN_CHARGE_OPUS: 5
} as const;

/**
 * Get pricing tier for a model
 */
export function getPricingTier(model: string): PricingTier {
  const pricing = DEFAULT_PRICING.find(p => p.model === model);
  
  if (pricing) {
    return pricing;
  }
  
  // Fallback pricing based on model name
  if (model.includes('haiku')) {
    return {
      model,
      svmaiPerInputToken: CONVERSION_RATES.INPUT_TOKEN_RATE * CONVERSION_RATES.HAIKU_MULTIPLIER,
      svmaiPerOutputToken: CONVERSION_RATES.OUTPUT_TOKEN_RATE * CONVERSION_RATES.HAIKU_MULTIPLIER,
      minimumCharge: CONVERSION_RATES.MIN_CHARGE_HAIKU
    };
  }
  
  if (model.includes('sonnet')) {
    return {
      model,
      svmaiPerInputToken: CONVERSION_RATES.INPUT_TOKEN_RATE * CONVERSION_RATES.SONNET_MULTIPLIER,
      svmaiPerOutputToken: CONVERSION_RATES.OUTPUT_TOKEN_RATE * CONVERSION_RATES.SONNET_MULTIPLIER,
      minimumCharge: CONVERSION_RATES.MIN_CHARGE_SONNET
    };
  }
  
  if (model.includes('opus')) {
    return {
      model,
      svmaiPerInputToken: CONVERSION_RATES.INPUT_TOKEN_RATE * CONVERSION_RATES.OPUS_MULTIPLIER,
      svmaiPerOutputToken: CONVERSION_RATES.OUTPUT_TOKEN_RATE * CONVERSION_RATES.OPUS_MULTIPLIER,
      minimumCharge: CONVERSION_RATES.MIN_CHARGE_OPUS
    };
  }
  
  // Default to Opus pricing (most expensive) for unknown models
  return {
    model,
    svmaiPerInputToken: CONVERSION_RATES.INPUT_TOKEN_RATE * CONVERSION_RATES.OPUS_MULTIPLIER,
    svmaiPerOutputToken: CONVERSION_RATES.OUTPUT_TOKEN_RATE * CONVERSION_RATES.OPUS_MULTIPLIER,
    minimumCharge: CONVERSION_RATES.MIN_CHARGE_OPUS
  };
}

/**
 * Calculate SVMAI cost for given tokens
 */
export function calculateSVMAICost(
  model: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  const pricing = getPricingTier(model);
  
  const inputCost = inputTokens * pricing.svmaiPerInputToken;
  const outputCost = outputTokens * pricing.svmaiPerOutputToken;
  const totalCost = inputCost + outputCost;
  
  return Math.max(totalCost, pricing.minimumCharge);
}

/**
 * Estimate tokens from text content (rough approximation)
 */
export function estimateTokensFromText(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is a simplified version - in production you might want to use
  // a proper tokenizer like tiktoken
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost with buffer for estimation
 */
export function calculateEstimatedCostWithBuffer(
  model: string,
  inputText: string,
  maxOutputTokens: number,
  bufferMultiplier: number = 1.2
): number {
  const inputTokens = estimateTokensFromText(inputText);
  const estimatedOutputTokens = Math.min(maxOutputTokens, inputTokens * 2); // Rough estimate
  
  const baseCost = calculateSVMAICost(model, inputTokens, estimatedOutputTokens);
  
  // Add buffer for estimation uncertainty
  return Math.ceil(baseCost * bufferMultiplier);
}

/**
 * Format SVMAI amount for display
 */
export function formatSVMAIAmount(amount: number): string {
  if (amount < 0.01) {
    return '< 0.01 SVMAI';
  }
  
  if (amount < 1) {
    return `${amount.toFixed(2)} SVMAI`;
  }
  
  if (amount < 100) {
    return `${amount.toFixed(1)} SVMAI`;
  }
  
  return `${Math.round(amount)} SVMAI`;
}

/**
 * Get cost comparison between models
 */
export function getModelCostComparison(inputTokens: number, outputTokens: number): {
  model: string;
  cost: number;
  formattedCost: string;
}[] {
  const models = ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
  
  return models.map(model => {
    const cost = calculateSVMAICost(model, inputTokens, outputTokens);
    return {
      model,
      cost,
      formattedCost: formatSVMAIAmount(cost)
    };
  });
}

/**
 * Calculate savings compared to most expensive model
 */
export function calculateSavings(
  selectedModel: string,
  inputTokens: number,
  outputTokens: number
): { savings: number; percentage: number } {
  const selectedCost = calculateSVMAICost(selectedModel, inputTokens, outputTokens);
  const opusCost = calculateSVMAICost('claude-3-opus-20240229', inputTokens, outputTokens);
  
  const savings = opusCost - selectedCost;
  const percentage = opusCost > 0 ? (savings / opusCost) * 100 : 0;
  
  return { savings, percentage };
}

/**
 * Validate pricing configuration
 */
export function validatePricingTier(pricing: PricingTier): boolean {
  if (pricing.svmaiPerInputToken < 0 || pricing.svmaiPerOutputToken < 0) {
    return false;
  }
  
  if (pricing.minimumCharge < 0) {
    return false;
  }
  
  if (!pricing.model || pricing.model.trim() === '') {
    return false;
  }
  
  return true;
}

/**
 * Get recommended model based on cost and quality trade-off
 */
export function getRecommendedModel(
  inputTokens: number,
  outputTokens: number,
  budget: number
): { model: string; reason: string } | null {
  const costs = getModelCostComparison(inputTokens, outputTokens);
  
  // Find models within budget
  const affordableModels = costs.filter(c => c.cost <= budget);
  
  if (affordableModels.length === 0) {
    return null; // No models within budget
  }
  
  // Recommend the best model within budget
  if (affordableModels.some(m => m.model.includes('opus'))) {
    return { model: 'claude-3-opus-20240229', reason: 'Best quality within budget' };
  }
  
  if (affordableModels.some(m => m.model.includes('sonnet'))) {
    return { model: 'claude-3-sonnet-20240229', reason: 'Good balance of quality and cost' };
  }
  
  return { model: 'claude-3-haiku-20240307', reason: 'Most cost-effective option' };
}