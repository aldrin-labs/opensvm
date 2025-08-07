export interface UsageLog {
  id: string;
  userId: string;
  keyId?: string;
  apiKeyId?: string;
  timestamp: Date | number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  svmaiCost: number;
  requestId?: string;
  success: boolean;
  errorCode?: string;
  errorType?: string;
  latency?: number;
  responseTime?: number;
  endpoint?: string;
}

export interface KeyUsageStats {
  totalRequests: number;
  totalTokensConsumed: number;
  totalSVMAISpent: number;
  lastRequestAt: Date;
  averageTokensPerRequest: number;
}

export interface FetchUsageLogsOptions {
  userId?: string;
  keyId?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export class UsageStorage {
  private usageLogs = new Map<string, UsageLog>();
  private userLogs = new Map<string, string[]>(); // userId -> logIds
  private keyLogs = new Map<string, string[]>(); // keyId -> logIds

  async initialize(): Promise<void> {
    // Initialize storage connections, databases, etc.
    // For in-memory implementation, this is a no-op
  }

  async logUsage(usage: UsageLog): Promise<void> {
    this.usageLogs.set(usage.id, usage);
    
    // Track by user
    const userLogIds = this.userLogs.get(usage.userId) || [];
    userLogIds.push(usage.id);
    this.userLogs.set(usage.userId, userLogIds);
    
    // Track by key
    if (usage.keyId) {
      const keyLogIds = this.keyLogs.get(usage.keyId) || [];
      keyLogIds.push(usage.id);
      this.keyLogs.set(usage.keyId, keyLogIds);
    }
  }

  async getUsageById(id: string): Promise<UsageLog | null> {
    return this.usageLogs.get(id) || null;
  }

  async getUserUsage(userId: string, startTime?: number, endTime?: number): Promise<UsageLog[]> {
    const userLogIds = this.userLogs.get(userId) || [];
    const logs = userLogIds.map(id => this.usageLogs.get(id)).filter(Boolean) as UsageLog[];
    
    if (startTime || endTime) {
      return logs.filter(log => {
        const logTime = log.timestamp instanceof Date ? log.timestamp.getTime() : log.timestamp;
        if (startTime && logTime < startTime) return false;
        if (endTime && logTime > endTime) return false;
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
      averageLatency: logs.length > 0 ? logs.reduce((sum, log) => sum + (log.latency || log.responseTime || 0), 0) / logs.length : 0
    };
    
    return stats;
  }

  async getAllUsage(startTime?: number, endTime?: number): Promise<UsageLog[]> {
    const allLogs = Array.from(this.usageLogs.values());
    
    if (startTime || endTime) {
      return allLogs.filter(log => {
        const logTime = log.timestamp instanceof Date ? log.timestamp.getTime() : log.timestamp;
        if (startTime && logTime < startTime) return false;
        if (endTime && logTime > endTime) return false;
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

  async fetchUsageLogs(options: FetchUsageLogsOptions): Promise<UsageLog[]> {
    let logs = Array.from(this.usageLogs.values());
    
    // Filter by user
    if (options.userId) {
      const userLogIds = this.userLogs.get(options.userId) || [];
      logs = logs.filter(log => userLogIds.includes(log.id));
    }
    
    // Filter by key
    if (options.keyId) {
      logs = logs.filter(log => log.keyId === options.keyId);
    }
    
    // Filter by date range
    if (options.startDate || options.endDate) {
      logs = logs.filter(log => {
        const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
        if (options.startDate && logDate < options.startDate) return false;
        if (options.endDate && logDate > options.endDate) return false;
        return true;
      });
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => {
      const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : a.timestamp;
      const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : b.timestamp;
      return dateB - dateA;
    });
    
    // Apply pagination
    if (options.offset) {
      logs = logs.slice(options.offset);
    }
    if (options.limit) {
      logs = logs.slice(0, options.limit);
    }
    
    return logs;
  }

  async aggregateKeyUsage(keyId: string): Promise<KeyUsageStats> {
    const keyLogIds = this.keyLogs.get(keyId) || [];
    const logs = keyLogIds.map(id => this.usageLogs.get(id)).filter(Boolean) as UsageLog[];
    
    if (logs.length === 0) {
      return {
        totalRequests: 0,
        totalTokensConsumed: 0,
        totalSVMAISpent: 0,
        lastRequestAt: new Date(0),
        averageTokensPerRequest: 0
      };
    }
    
    const totalRequests = logs.length;
    const totalTokensConsumed = logs.reduce((sum, log) => sum + (log.totalTokens || log.inputTokens + log.outputTokens), 0);
    const totalSVMAISpent = logs.reduce((sum, log) => sum + (log.svmaiCost || log.cost), 0);
    const averageTokensPerRequest = totalTokensConsumed / totalRequests;
    
    // Find the most recent timestamp
    const timestamps = logs.map(log => log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp));
    const lastRequestAt = new Date(Math.max(...timestamps.map(d => d.getTime())));
    
    return {
      totalRequests,
      totalTokensConsumed,
      totalSVMAISpent,
      lastRequestAt,
      averageTokensPerRequest
    };
  }
}