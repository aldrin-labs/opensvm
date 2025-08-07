import { SVMAIBalanceManager } from './SVMAIBalanceManager';
import { UsageTracker } from '../tracking/UsageTracker';
import { ProxyRequest, ProxyResponse, AnthropicResponse } from '../types/ProxyTypes';
import { calculateSVMAICost } from '../utils/PricingCalculator';

export class BillingProcessor {
  private balanceManager: SVMAIBalanceManager;
  private usageTracker: UsageTracker;

  constructor() {
    this.balanceManager = new SVMAIBalanceManager();
    this.usageTracker = new UsageTracker();
  }

  async processRequest(
    userId: string,
    apiKeyId: string | undefined,
    request: ProxyRequest,
    response: ProxyResponse | AnthropicResponse
  ): Promise<{ success: boolean; cost: number; remainingBalance: number }> {
    try {
      // Extract model and token usage
      const model = this.extractModel(request);
      const usage = this.extractUsage(response);
      
      if (!usage) {
        return { success: true, cost: 0, remainingBalance: 0 };
      }

      // Calculate cost
      const cost = calculateSVMAICost(model, usage.inputTokens, usage.outputTokens);

      // Check balance
      const hasBalance = await this.balanceManager.hasBalance(userId, cost);
      if (!hasBalance) {
        throw new Error('Insufficient SVMAI balance');
      }

      // Deduct balance
      const deductSuccess = await this.balanceManager.subtractBalance(userId, cost);
      if (!deductSuccess) {
        throw new Error('Failed to deduct balance');
      }

      // Track usage
      await this.usageTracker.trackUsage(
        userId,
        apiKeyId,
        model,
        usage.inputTokens,
        usage.outputTokens,
        cost,
        0, // latency - would be calculated in real implementation
        true
      );

      const remainingBalance = await this.balanceManager.getBalance(userId);

      return { success: true, cost, remainingBalance };
    } catch (error) {
      return { success: false, cost: 0, remainingBalance: 0 };
    }
  }

  async preflightCheck(userId: string, estimatedCost: number = 1): Promise<boolean> {
    return await this.balanceManager.hasBalance(userId, estimatedCost);
  }

  async refundTransaction(userId: string, cost: number): Promise<boolean> {
    try {
      await this.balanceManager.addBalance(userId, cost);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserBalance(userId: string): Promise<number> {
    return await this.balanceManager.getBalance(userId);
  }

  private extractModel(request: ProxyRequest): string {
    if (request.body && typeof request.body === 'object' && request.body.model) {
      return request.body.model;
    }
    return 'claude-3-haiku-20240307'; // default
  }

  private extractUsage(response: ProxyResponse | AnthropicResponse): { inputTokens: number; outputTokens: number } | null {
    if ('usage' in response && response.usage) {
      return {
        inputTokens: response.usage.input_tokens || response.usage.inputTokens || 0,
        outputTokens: response.usage.output_tokens || response.usage.outputTokens || 0
      };
    }
    return null;
  }
}