import { UsageStorage, UsageLog, KeyUsageStats } from '../storage/UsageStorage';
import { SVMAIBalanceManager } from '../billing/SVMAIBalanceManager';
import { UserBalance } from '../types/ProxyTypes';

export interface UserUsageReport {
  userId: string;
  period?: { start: number; end: number };
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  errorRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokensConsumed: number;
  totalSVMAISpent: number;
  averageResponseTime: number;
  currentSVMAIBalance: number;
  availableSVMAIBalance: number;
  topModels: Array<{ model: string; tokens: number }>;
  costBreakdownByModel: Array<{ model: string; svmaiCost: number }>;
  dailyUsage: Array<{ date: string; requests: number; tokens: number; cost: number }>;
}

export class UsageReporter {
  private usageStorage: UsageStorage;
  private balanceManager: SVMAIBalanceManager;

  constructor() {
    this.usageStorage = new UsageStorage();
    this.balanceManager = new SVMAIBalanceManager();
  }

  async initialize(): Promise<void> {
    await this.usageStorage.initialize();
    await this.balanceManager.initialize();
  }

  async generateUserReport(
    userId: string,
    startTime: number,
    endTime: number
  ): Promise<UserUsageReport> {
    const usage = await this.usageStorage.getUserUsage(userId, startTime, endTime);
    const stats = await this.usageStorage.getUsageStats(userId, startTime, endTime);
    const balance = await this.balanceManager.getBalance(userId);

    const modelTokens = new Map<string, number>();
    const modelCosts = new Map<string, number>();

    usage.forEach(log => {
      const tokens = log.totalTokens || (log.inputTokens + log.outputTokens);
      const cost = log.svmaiCost || log.cost;
      
      modelTokens.set(log.model, (modelTokens.get(log.model) || 0) + tokens);
      modelCosts.set(log.model, (modelCosts.get(log.model) || 0) + cost);
    });

    const topModels = Array.from(modelTokens.entries())
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
      
    const costBreakdownByModel = Array.from(modelCosts.entries())
      .map(([model, svmaiCost]) => ({ model, svmaiCost }));

    const totalResponseTime = usage.reduce((sum, log) => sum + (log.responseTime || log.latency || 0), 0);
    const averageResponseTime = usage.length > 0 ? totalResponseTime / usage.length : 0;

    return {
      userId,
      period: { start: startTime, end: endTime },
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests || 0,
      errorRequests: stats.totalRequests - (stats.successfulRequests || 0),
      errorRate: stats.totalRequests > 0 ? ((stats.totalRequests - (stats.successfulRequests || 0)) / stats.totalRequests) * 100 : 0,
      totalInputTokens: stats.totalInputTokens,
      totalOutputTokens: stats.totalOutputTokens,
      totalTokensConsumed: stats.totalInputTokens + stats.totalOutputTokens,
      totalSVMAISpent: stats.totalCost,
      averageResponseTime,
      currentSVMAIBalance: balance,
      availableSVMAIBalance: balance,
      topModels,
      costBreakdownByModel,
      dailyUsage: [] // Simple implementation for now
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
      existing.latency += log.latency || 0;
      userStats.set(log.userId, existing);
    });

    const topUsers = Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, requests: stats.requests, cost: stats.cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const totalLatency = allUsage.reduce((sum, log) => sum + (log.latency || 0), 0);

    return {
      totalUsers: userStats.size,
      totalRequests: allUsage.length,
      totalCost: allUsage.reduce((sum, log) => sum + log.cost, 0),
      averageLatency: allUsage.length > 0 ? totalLatency / allUsage.length : 0,
      topUsers
    };
  }

  async getKeyUsageStats(keyId: string): Promise<KeyUsageStats> {
    return await this.usageStorage.aggregateKeyUsage(keyId);
  }

  async getUserUsageReport(userId: string, period?: string): Promise<UserUsageReport> {
    // Determine time range based on period
    let startDate: Date | undefined;
    const now = new Date();
    
    if (period === 'day') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Fetch logs
    const logs = await this.usageStorage.fetchUsageLogs({
      userId,
      limit: 10000,
      startDate
    });
    
    // Filter logs by period if specified
    const filteredLogs = period ? logs.filter(log => {
      const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
      return startDate ? logDate >= startDate : true;
    }) : logs;
    
    // Get balance - handle both number and object responses
    const balanceResult = await this.balanceManager.getBalance(userId);
    const balance = typeof balanceResult === 'number' ? balanceResult : (balanceResult as any)?.svmaiBalance || 0;
    
    // Calculate statistics
    const totalRequests = filteredLogs.length;
    const successfulRequests = filteredLogs.filter(log => log.success).length;
    const errorRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    
    const totalInputTokens = filteredLogs.reduce((sum, log) => sum + log.inputTokens, 0);
    const totalOutputTokens = filteredLogs.reduce((sum, log) => sum + log.outputTokens, 0);
    const totalTokensConsumed = totalInputTokens + totalOutputTokens;
    const totalSVMAISpent = filteredLogs.reduce((sum, log) => sum + (log.svmaiCost || log.cost), 0);
    
    const totalResponseTime = filteredLogs.reduce((sum, log) => sum + (log.responseTime || log.latency || 0), 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    // Model usage analysis
    const modelTokens = new Map<string, number>();
    const modelCosts = new Map<string, number>();
    
    filteredLogs.forEach(log => {
      const tokens = log.totalTokens || (log.inputTokens + log.outputTokens);
      const cost = log.svmaiCost || log.cost;
      
      modelTokens.set(log.model, (modelTokens.get(log.model) || 0) + tokens);
      modelCosts.set(log.model, (modelCosts.get(log.model) || 0) + cost);
    });
    
    const topModels = Array.from(modelTokens.entries())
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
      
    const costBreakdownByModel = Array.from(modelCosts.entries())
      .map(([model, svmaiCost]) => ({ model, svmaiCost }));
    
    // Daily usage breakdown
    const dailyUsageMap = new Map<string, { requests: number; tokens: number; cost: number }>();
    
    filteredLogs.forEach(log => {
      const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
      const dateKey = logDate.toISOString().split('T')[0];
      
      const existing = dailyUsageMap.get(dateKey) || { requests: 0, tokens: 0, cost: 0 };
      existing.requests += 1;
      existing.tokens += log.totalTokens || (log.inputTokens + log.outputTokens);
      existing.cost += log.svmaiCost || log.cost;
      
      dailyUsageMap.set(dateKey, existing);
    });
    
    const dailyUsage = Array.from(dailyUsageMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      userId,
      totalRequests,
      successfulRequests,
      errorRequests,
      errorRate,
      totalInputTokens,
      totalOutputTokens,
      totalTokensConsumed,
      totalSVMAISpent,
      averageResponseTime,
      currentSVMAIBalance: balance,
      availableSVMAIBalance: balance,
      topModels,
      costBreakdownByModel,
      dailyUsage
    };
  }
}