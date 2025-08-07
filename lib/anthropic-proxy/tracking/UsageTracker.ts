import { UsageStorage, UsageLog } from '../storage/UsageStorage';
import { ProxyResponse } from '../types/ProxyTypes';

export class UsageTracker {
  private usageStorage: UsageStorage;

  constructor() {
    this.usageStorage = new UsageStorage();
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
      apiKeyId,
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      cost,
      requestId: requestId || this.generateId(),
      success,
      errorCode,
      latency
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
      await this.trackUsage(
        proxyResponse.userId || '',
        proxyResponse.keyId || '',
        proxyResponse.model || 'unknown',
        proxyResponse.inputTokens || 0,
        proxyResponse.outputTokens || 0,
        proxyResponse.actualCost || 0,
        proxyResponse.responseTime || 0,
        proxyResponse.success || false,
        undefined,
        requestId
      );
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

  async initialize(): Promise<void> {
    // Initialize the usage storage if needed
    // UsageStorage doesn't have an initialize method, so this is a no-op
  }

  async getKeyUsageStats(keyId: string): Promise<any> {
    // Return usage stats for a specific API key
    // For now, return empty stats - would implement key-specific stats in production
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      lastUsed: 0
    };
  }

  async getUserUsageLogs(userId: string): Promise<UsageLog[]> {
    // Return raw usage logs for a user
    return await this.getUserUsage(userId);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const usageTracker = new UsageTracker();