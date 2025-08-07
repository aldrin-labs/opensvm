export interface UsageLog {
  id: string;
  userId: string;
  apiKeyId?: string;
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requestId: string;
  success: boolean;
  errorCode?: string;
  latency: number;
}

export class UsageStorage {
  private usageLogs = new Map<string, UsageLog>();
  private userLogs = new Map<string, string[]>(); // userId -> logIds

  async logUsage(usage: UsageLog): Promise<void> {
    this.usageLogs.set(usage.id, usage);
    
    // Track by user
    const userLogIds = this.userLogs.get(usage.userId) || [];
    userLogIds.push(usage.id);
    this.userLogs.set(usage.userId, userLogIds);
  }

  async getUsageById(id: string): Promise<UsageLog | null> {
    return this.usageLogs.get(id) || null;
  }

  async getUserUsage(userId: string, startTime?: number, endTime?: number): Promise<UsageLog[]> {
    const userLogIds = this.userLogs.get(userId) || [];
    const logs = userLogIds.map(id => this.usageLogs.get(id)).filter(Boolean) as UsageLog[];
    
    if (startTime || endTime) {
      return logs.filter(log => {
        if (startTime && log.timestamp < startTime) return false;
        if (endTime && log.timestamp > endTime) return false;
        return true;
      });
    }
    
    return logs;
  }

  async getUsageStats(userId: string, startTime?: number, endTime?: number): Promise<{
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
  }> {
    const logs = await this.getUserUsage(userId, startTime, endTime);
    
    const stats = {
      totalRequests: logs.length,
      totalInputTokens: logs.reduce((sum, log) => sum + log.inputTokens, 0),
      totalOutputTokens: logs.reduce((sum, log) => sum + log.outputTokens, 0),
      totalCost: logs.reduce((sum, log) => sum + log.cost, 0),
      successfulRequests: logs.filter(log => log.success).length,
      failedRequests: logs.filter(log => !log.success).length,
      averageLatency: logs.length > 0 ? logs.reduce((sum, log) => sum + log.latency, 0) / logs.length : 0
    };
    
    return stats;
  }

  async getAllUsage(startTime?: number, endTime?: number): Promise<UsageLog[]> {
    const allLogs = Array.from(this.usageLogs.values());
    
    if (startTime || endTime) {
      return allLogs.filter(log => {
        if (startTime && log.timestamp < startTime) return false;
        if (endTime && log.timestamp > endTime) return false;
        return true;
      });
    }
    
    return allLogs;
  }

  async clear(): Promise<void> {
    this.usageLogs.clear();
    this.userLogs.clear();
  }

  async deleteUserLogs(userId: string): Promise<boolean> {
    const userLogIds = this.userLogs.get(userId) || [];
    
    userLogIds.forEach(id => {
      this.usageLogs.delete(id);
    });
    
    return this.userLogs.delete(userId);
  }
}