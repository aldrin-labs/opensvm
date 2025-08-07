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
      const hasBalance = await this.balanceManager.hasSufficientBalance(userId, cost);
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
    return await this.balanceManager.hasSufficientBalance(userId, estimatedCost);
  }

  async refundTransaction(userId: string, cost: number): Promise<boolean> {
    try {
      await this.balanceManager.addBalance(userId, cost);
      return true;
    } catch (error) {
      return false;
    }
  }

  async initialize(): Promise<void> {
    await this.balanceManager.initialize();
    await this.usageTracker.initialize();
  }

  async reserveBalance(request: ProxyRequest): Promise<void> {
    // Check if user has sufficient balance for the estimated cost
    const estimatedCost = request.estimatedCost || 1;
    const hasBalance = await this.balanceManager.hasSufficientBalance(request.userId || '', estimatedCost);
    if (!hasBalance) {
      throw new Error(`Insufficient balance to reserve ${estimatedCost} tokens for ${request.body?.model || 'unknown'} request.`);
    }
    // Note: In a production system, you might want to actually reserve/lock the balance
    // For now, we just check availability
  }

  async processSuccessfulResponse(response: ProxyResponse): Promise<void> {
    try {
      // Track usage statistics
      await this.usageTracker.trackResponse(response);

      // Consume reserved balance
      const estimatedCost = (response.inputTokens || 0) + (response.outputTokens || 0);
      await this.balanceManager.consumeReservedBalance(
        response.userId || '',
        estimatedCost,
        response.actualCost || 0,
        response.keyId || ''
      );

      console.log(`Successfully processed response for user ${response.userId || 'unknown'}`);
    } catch (error) {
      console.error('Error processing successful response:', error);
    }
  }

  async processFailedResponse(response: ProxyResponse): Promise<void> {
    try {
      // Track the failed request for analytics (no cost deduction for failed requests)
      await this.usageTracker.trackResponse(response);

      // Release reserved balance
      const estimatedAmount = (response.inputTokens || 0) + (response.outputTokens || 0);
      await this.balanceManager.releaseReservedBalance(
        response.userId || '',
        estimatedAmount,
        response.keyId || ''
      );

      console.log(`Processed failed response for user ${response.userId || 'unknown'}`);
    } catch (error) {
      console.error('Error processing failed response:', error);
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
      const usage = response.usage as any;
      return {
        inputTokens: usage.input_tokens || usage.inputTokens || 0,
        outputTokens: usage.output_tokens || usage.outputTokens || 0
      };
    }
    return null;
  }
}