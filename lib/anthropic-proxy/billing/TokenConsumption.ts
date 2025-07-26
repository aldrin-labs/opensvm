import { DEFAULT_PRICING, PricingTier } from '../types/ProxyTypes';
import { AnthropicResponse } from '../types/AnthropicTypes';

/**
 * Handles SVMAI token consumption calculations and logic
 */
export class TokenConsumption {
  private pricingTiers: PricingTier[];

  constructor(customPricing?: PricingTier[]) {
    this.pricingTiers = customPricing || DEFAULT_PRICING;
  }

  /**
   * Calculate SVMAI cost for a request based on model and estimated tokens
   */
  calculateEstimatedCost(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): number {
    const pricing = this.getPricingForModel(model);
    
    const inputCost = estimatedInputTokens * pricing.svmaiPerInputToken;
    const outputCost = estimatedOutputTokens * pricing.svmaiPerOutputToken;
    const totalCost = inputCost + outputCost;
    
    // Apply minimum charge
    return Math.max(totalCost, pricing.minimumCharge);
  }

  /**
   * Calculate actual SVMAI cost from Anthropic API response
   */
  calculateActualCost(model: string, anthropicResponse: AnthropicResponse): number {
    const pricing = this.getPricingForModel(model);
    
    const inputTokens = anthropicResponse.usage.input_tokens;
    const outputTokens = anthropicResponse.usage.output_tokens;
    
    const inputCost = inputTokens * pricing.svmaiPerInputToken;
    const outputCost = outputTokens * pricing.svmaiPerOutputToken;
    const totalCost = inputCost + outputCost;
    
    // Apply minimum charge
    return Math.max(totalCost, pricing.minimumCharge);
  }

  /**
   * Estimate token usage from request content (rough estimation)
   */
  estimateTokenUsage(content: string, maxTokens: number): { inputTokens: number; outputTokens: number } {
    // Rough estimation: ~4 characters per token for English text
    const inputTokens = Math.ceil(content.length / 4);
    
    // Estimate output tokens as percentage of max_tokens (conservative estimate)
    const outputTokens = Math.min(maxTokens, Math.ceil(maxTokens * 0.8));
    
    return { inputTokens, outputTokens };
  }

  /**
   * Get pricing tier for a specific model
   */
  private getPricingForModel(model: string): PricingTier {
    const pricing = this.pricingTiers.find(p => p.model === model);
    
    if (!pricing) {
      // Default to most expensive pricing if model not found
      console.warn(`No pricing found for model ${model}, using default`);
      return this.pricingTiers.find(p => p.model === 'claude-3-opus-20240229') || this.pricingTiers[0];
    }
    
    return pricing;
  }

  /**
   * Get all available pricing tiers
   */
  getPricingTiers(): PricingTier[] {
    return [...this.pricingTiers];
  }

  /**
   * Update pricing for a model
   */
  updatePricing(model: string, pricing: Omit<PricingTier, 'model'>): void {
    const index = this.pricingTiers.findIndex(p => p.model === model);
    
    if (index >= 0) {
      this.pricingTiers[index] = { model, ...pricing };
    } else {
      this.pricingTiers.push({ model, ...pricing });
    }
  }

  /**
   * Calculate cost breakdown for display
   */
  calculateCostBreakdown(model: string, inputTokens: number, outputTokens: number): {
    model: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    minimumCharge: number;
    finalCost: number;
    pricing: PricingTier;
  } {
    const pricing = this.getPricingForModel(model);
    
    const inputCost = inputTokens * pricing.svmaiPerInputToken;
    const outputCost = outputTokens * pricing.svmaiPerOutputToken;
    const totalCost = inputCost + outputCost;
    const finalCost = Math.max(totalCost, pricing.minimumCharge);
    
    return {
      model,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost,
      minimumCharge: pricing.minimumCharge,
      finalCost,
      pricing
    };
  }

  /**
   * Validate if cost calculation is reasonable
   */
  validateCost(cost: number, inputTokens: number, outputTokens: number): boolean {
    // Basic sanity checks
    if (cost < 0) return false;
    if (inputTokens < 0 || outputTokens < 0) return false;
    
    // Check if cost is not unreasonably high (safety check)
    const maxReasonableCost = (inputTokens + outputTokens) * 2; // 2 SVMAI per token max
    if (cost > maxReasonableCost) {
      console.warn(`Cost ${cost} seems unreasonably high for ${inputTokens + outputTokens} tokens`);
      return false;
    }
    
    return true;
  }

  /**
   * Get cost estimate for display in UI
   */
  getCostEstimateForDisplay(model: string, messageContent: string, maxTokens: number): {
    estimatedCost: number;
    breakdown: string;
    warning?: string;
  } {
    const { inputTokens, outputTokens } = this.estimateTokenUsage(messageContent, maxTokens);
    const cost = this.calculateEstimatedCost(model, inputTokens, outputTokens);
    const breakdown = this.calculateCostBreakdown(model, inputTokens, outputTokens);
    
    let warning: string | undefined;
    if (cost > 50) {
      warning = 'This request may consume a significant amount of SVMAI tokens';
    }
    
    return {
      estimatedCost: cost,
      breakdown: `${breakdown.inputCost.toFixed(2)} (input) + ${breakdown.outputCost.toFixed(2)} (output) = ${cost.toFixed(2)} SVMAI`,
      warning
    };
  }
}