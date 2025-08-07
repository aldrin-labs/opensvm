import { UsageStorage, UsageLog } from '../storage/UsageStorage';
import { SVMAIBalanceManager } from '../billing/SVMAIBalanceManager';
import { UserBalance, KeyUsageStats } from '../types/ProxyTypes';

export interface UserUsageReport {
  userId: string;
  period: { start: number; end: number };
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
  averageLatency: number;
  modelUsage: Record<string, number>;
  costBreakdown: Record<string, number>;
  balance: UserBalance | null;
}

export class UsageReporter {
  private usageStorage: UsageStorage;
  private balanceManager: SVMAIBalanceManager;

  constructor() {
    this.usageStorage = new UsageStorage();
    this.balanceManager = new SVMAIBalanceManager();
  }

  async generateUserReport(
    userId: string,
    startTime: number,
    endTime: number
  ): Promise<UserUsageReport> {
    const usage = await this.usageStorage.getUserUsage(userId, startTime, endTime);
    const stats = await this.usageStorage.getUsageStats(userId, startTime, endTime);
    const balance = await this.balanceManager.getUserBalance(userId);

    const modelUsage: Record<string, number> = {};
    const costBreakdown: Record<string, number> = {};

    usage.forEach(log => {
      modelUsage[log.model] = (modelUsage[log.model] || 0) + 1;
      costBreakdown[log.model] = (costBreakdown[log.model] || 0) + log.cost;
    });

    return {
      userId,
      period: { start: startTime, end: endTime },
      totalRequests: stats.totalRequests,
      totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
      totalCost: stats.totalCost,
      successRate: stats.totalRequests > 0 ? stats.successfulRequests / stats.totalRequests : 0,
      averageLatency: stats.averageLatency,
      modelUsage,
      costBreakdown,
      balance
    };
  }

  async generateSystemReport(
    startTime: number,
    endTime: number
  ): Promise<{
    totalUsers: number;
    totalRequests: number;
    totalCost: number;
    averageLatency: number;
    topUsers: Array<{ userId: string; requests: number; cost: number }>;
  }> {
    const allUsage = await this.usageStorage.getAllUsage(startTime, endTime);
    const userStats = new Map<string, { requests: number; cost: number; latency: number }>();

    allUsage.forEach(log => {
      const existing = userStats.get(log.userId) || { requests: 0, cost: 0, latency: 0 };
      existing.requests += 1;
      existing.cost += log.cost;
      existing.latency += log.latency;
      userStats.set(log.userId, existing);
    });

    const topUsers = Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, requests: stats.requests, cost: stats.cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const totalLatency = allUsage.reduce((sum, log) => sum + log.latency, 0);

    return {
      totalUsers: userStats.size,
      totalRequests: allUsage.length,
      totalCost: allUsage.reduce((sum, log) => sum + log.cost, 0),
      averageLatency: allUsage.length > 0 ? totalLatency / allUsage.length : 0,
      topUsers
    };
  }

  async getKeyUsageStats(apiKeyId: string, startTime?: number, endTime?: number): Promise<KeyUsageStats> {
    const allUsage = await this.usageStorage.getAllUsage(startTime, endTime);
    const keyUsage = allUsage.filter(log => log.apiKeyId === apiKeyId);

    return {
      totalRequests: keyUsage.length,
      totalTokens: keyUsage.reduce((sum, log) => sum + log.inputTokens + log.outputTokens, 0),
      totalCost: keyUsage.reduce((sum, log) => sum + log.cost, 0),
      lastUsed: keyUsage.length > 0 ? Math.max(...keyUsage.map(log => log.timestamp)) : 0
    };
  }
}