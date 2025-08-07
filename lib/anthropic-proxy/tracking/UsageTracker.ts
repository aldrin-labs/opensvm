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
    userId: string,
    apiKeyId: string | undefined,
    model: string,
    response: ProxyResponse,
    latency: number,
    requestId?: string
  ): Promise<void> {
    const usage = response.usage;
    if (!usage) {
      return;
    }

    await this.trackUsage(
      userId,
      apiKeyId,
      model,
      usage.inputTokens,
      usage.outputTokens,
      0, // Cost calculated elsewhere
      latency,
      response.status < 400,
      response.status >= 400 ? `HTTP_${response.status}` : undefined,
      requestId
    );
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

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const usageTracker = new UsageTracker();