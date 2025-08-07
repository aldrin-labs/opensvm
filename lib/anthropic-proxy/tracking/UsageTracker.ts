import { UsageStorage, UsageLog, KeyUsageStats } from '../storage/UsageStorage';
import { ProxyResponse } from '../types/ProxyTypes';
import { calculateSVMAICost } from '../utils/PricingCalculator';
import { v4 as uuidv4 } from 'uuid';

export class UsageTracker {
  private usageStorage: UsageStorage;

  constructor() {
    this.usageStorage = new UsageStorage();
  }

  async initialize(): Promise<void> {
    await this.usageStorage.initialize();
  }

  async trackUsage(
    userId: string,
    apiKeyId: string | undefined,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    latency: number,
    success: boolean = true,
    errorCode?: string,
    requestId?: string
  ): Promise<void> {
    const usage: UsageLog = {
      id: requestId || this.generateId(),
      userId,
      keyId: apiKeyId,
      apiKeyId,
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      svmaiCost: cost,
      requestId: requestId || this.generateId(),
      success,
      errorCode,
      latency,
      responseTime: latency,
      endpoint: '/v1/messages'
    };

    await this.usageStorage.logUsage(usage);
  }

  async trackResponse(
    userIdOrResponse: string | ProxyResponse,
    apiKeyId?: string | undefined,
    model?: string,
    response?: ProxyResponse,
    latency?: number,
    requestId?: string
  ): Promise<void> {
    // Handle overloaded method - either single ProxyResponse or multiple parameters
    if (typeof userIdOrResponse === 'object') {
      // Single ProxyResponse parameter
      const proxyResponse = userIdOrResponse as ProxyResponse;
      
      // Extract tokens from anthropic response if available
      let inputTokens = proxyResponse.inputTokens || 0;
      let outputTokens = proxyResponse.outputTokens || 0;
      
      if (proxyResponse.anthropicResponse?.usage) {
        inputTokens = proxyResponse.anthropicResponse.usage.input_tokens;
        outputTokens = proxyResponse.anthropicResponse.usage.output_tokens;
      }
      
      // Calculate SVMAI cost
      const svmaiCost = calculateSVMAICost(proxyResponse.model || 'claude-3-haiku-20240307', inputTokens, outputTokens);
      
      const usage: UsageLog = {
        id: uuidv4(),
        keyId: proxyResponse.keyId || '',
        userId: proxyResponse.userId || '',
        endpoint: '/v1/messages',
        model: proxyResponse.model || 'unknown',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        svmaiCost,
        cost: svmaiCost,
        responseTime: proxyResponse.responseTime || 0,
        success: proxyResponse.success || false,
        errorType: proxyResponse.success ? undefined : 'anthropic_error',
        timestamp: proxyResponse.timestamp || new Date()
      };
      
      await this.usageStorage.logUsage(usage);
    } else {
      // Multiple parameters (original signature)
      const userId = userIdOrResponse as string;
      const usage = response?.usage;
      if (!usage) {
        return;
      }

      await this.trackUsage(
        userId,
        apiKeyId || '',
        model || 'unknown',
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        0, // Cost calculated elsewhere
        latency || 0,
        (response?.status || 0) < 400,
        (response?.status || 0) >= 400 ? `HTTP_${response.status}` : undefined,
        requestId
      );
    }
  }

  async getUserStats(userId: string, startTime?: number, endTime?: number) {
    return await this.usageStorage.getUsageStats(userId, startTime, endTime);
  }

  async getUserUsage(userId: string, startTime?: number, endTime?: number): Promise<UsageLog[]> {
    return await this.usageStorage.getUserUsage(userId, startTime, endTime);
  }

  async getAllUsage(startTime?: number, endTime?: number): Promise<UsageLog[]> {
    return await this.usageStorage.getAllUsage(startTime, endTime);
  }

  async getKeyUsageStats(keyId: string): Promise<KeyUsageStats> {
    return await this.usageStorage.aggregateKeyUsage(keyId);
  }

  async getUserUsageLogs(userId: string, limit?: number, offset?: number): Promise<UsageLog[]> {
    return await this.usageStorage.fetchUsageLogs({
      userId,
      limit,
      offset
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const usageTracker = new UsageTracker();