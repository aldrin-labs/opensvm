/**
 * MCP Tool Analytics
 *
 * Tracks tool usage metrics across all MCP servers.
 * Provides insights for optimization and feature prioritization.
 */

// ============================================================================
// Types
// ============================================================================

export interface ToolCall {
  id: string;
  serverId: string;
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  errorType?: string;
  inputSize: number;
  outputSize: number;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ToolMetrics {
  toolName: string;
  serverId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  avgInputSize: number;
  avgOutputSize: number;
  errorRate: number;
  lastUsed: number;
  firstUsed: number;
  uniqueUsers: number;
  uniqueSessions: number;
}

export interface ServerMetrics {
  serverId: string;
  serverName: string;
  totalTools: number;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  activeTools: number;
  topTools: { name: string; calls: number }[];
  errorBreakdown: Record<string, number>;
  hourlyUsage: number[];
  dailyUsage: number[];
}

export interface AnalyticsDashboard {
  overview: {
    totalCalls: number;
    totalServers: number;
    totalTools: number;
    avgSuccessRate: number;
    avgLatency: number;
    uniqueUsers: number;
    uniqueSessions: number;
  };
  servers: ServerMetrics[];
  topTools: ToolMetrics[];
  recentErrors: {
    toolName: string;
    errorType: string;
    timestamp: number;
    count: number;
  }[];
  trends: {
    period: string;
    calls: number;
    successRate: number;
    avgLatency: number;
  }[];
}

export interface TimeRange {
  start: number;
  end: number;
}

// ============================================================================
// In-Memory Storage (Replace with persistent storage in production)
// ============================================================================

class AnalyticsStore {
  private calls: ToolCall[] = [];
  private metrics: Map<string, ToolMetrics> = new Map();
  private maxCalls = 100000; // Keep last 100K calls in memory
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Flush metrics every minute
    this.flushInterval = setInterval(() => this.computeMetrics(), 60000);
  }

  recordCall(call: ToolCall): void {
    this.calls.push(call);

    // Evict oldest calls if over limit
    if (this.calls.length > this.maxCalls) {
      this.calls = this.calls.slice(-this.maxCalls);
    }

    // Update real-time metrics
    this.updateMetrics(call);
  }

  private updateMetrics(call: ToolCall): void {
    const key = `${call.serverId}:${call.toolName}`;
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        toolName: call.toolName,
        serverId: call.serverId,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        avgDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        avgInputSize: 0,
        avgOutputSize: 0,
        errorRate: 0,
        lastUsed: call.timestamp,
        firstUsed: call.timestamp,
        uniqueUsers: 0,
        uniqueSessions: 0,
      };
    }

    // Update counters
    metrics.totalCalls++;
    if (call.success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }

    // Update running averages
    const n = metrics.totalCalls;
    metrics.avgDuration = metrics.avgDuration + (call.duration - metrics.avgDuration) / n;
    metrics.avgInputSize = metrics.avgInputSize + (call.inputSize - metrics.avgInputSize) / n;
    metrics.avgOutputSize = metrics.avgOutputSize + (call.outputSize - metrics.avgOutputSize) / n;
    metrics.errorRate = metrics.failedCalls / metrics.totalCalls;
    metrics.lastUsed = Math.max(metrics.lastUsed, call.timestamp);

    this.metrics.set(key, metrics);
  }

  private computeMetrics(): void {
    // Recompute percentiles and unique counts
    const now = Date.now();
    const recentCalls = this.calls.filter(c => now - c.timestamp < 3600000); // Last hour

    for (const [key, metrics] of this.metrics) {
      const toolCalls = recentCalls.filter(
        c => `${c.serverId}:${c.toolName}` === key
      );

      if (toolCalls.length === 0) continue;

      // Compute percentiles
      const durations = toolCalls.map(c => c.duration).sort((a, b) => a - b);
      metrics.p50Duration = durations[Math.floor(durations.length * 0.5)] || 0;
      metrics.p95Duration = durations[Math.floor(durations.length * 0.95)] || 0;
      metrics.p99Duration = durations[Math.floor(durations.length * 0.99)] || 0;

      // Unique users and sessions
      const users = new Set(toolCalls.filter(c => c.userId).map(c => c.userId));
      const sessions = new Set(toolCalls.filter(c => c.sessionId).map(c => c.sessionId));
      metrics.uniqueUsers = users.size;
      metrics.uniqueSessions = sessions.size;

      this.metrics.set(key, metrics);
    }
  }

  getCalls(timeRange?: TimeRange): ToolCall[] {
    if (!timeRange) return this.calls;
    return this.calls.filter(
      c => c.timestamp >= timeRange.start && c.timestamp <= timeRange.end
    );
  }

  getMetrics(serverId?: string): ToolMetrics[] {
    const allMetrics = Array.from(this.metrics.values());
    if (!serverId) return allMetrics;
    return allMetrics.filter(m => m.serverId === serverId);
  }

  getServerMetrics(): ServerMetrics[] {
    const serverMap = new Map<string, ServerMetrics>();

    for (const metrics of this.metrics.values()) {
      let server = serverMap.get(metrics.serverId);
      if (!server) {
        server = {
          serverId: metrics.serverId,
          serverName: metrics.serverId,
          totalTools: 0,
          totalCalls: 0,
          successRate: 0,
          avgLatency: 0,
          activeTools: 0,
          topTools: [],
          errorBreakdown: {},
          hourlyUsage: new Array(24).fill(0),
          dailyUsage: new Array(7).fill(0),
        };
      }

      server.totalTools++;
      server.totalCalls += metrics.totalCalls;
      server.avgLatency = (server.avgLatency * (server.totalTools - 1) + metrics.avgDuration) / server.totalTools;

      if (metrics.lastUsed > Date.now() - 86400000) {
        server.activeTools++;
      }

      server.topTools.push({ name: metrics.toolName, calls: metrics.totalCalls });
      serverMap.set(metrics.serverId, server);
    }

    // Sort and limit top tools
    for (const server of serverMap.values()) {
      server.topTools.sort((a, b) => b.calls - a.calls);
      server.topTools = server.topTools.slice(0, 10);
      server.successRate = this.getSuccessRate(server.serverId);
    }

    return Array.from(serverMap.values());
  }

  private getSuccessRate(serverId: string): number {
    const serverCalls = this.calls.filter(c => c.serverId === serverId);
    if (serverCalls.length === 0) return 0;
    const successful = serverCalls.filter(c => c.success).length;
    return successful / serverCalls.length;
  }

  getDashboard(timeRange?: TimeRange): AnalyticsDashboard {
    const calls = this.getCalls(timeRange);
    const metrics = this.getMetrics();
    const servers = this.getServerMetrics();

    // Compute unique users and sessions
    const users = new Set(calls.filter(c => c.userId).map(c => c.userId));
    const sessions = new Set(calls.filter(c => c.sessionId).map(c => c.sessionId));

    // Top tools by calls
    const topTools = [...metrics].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 20);

    // Recent errors
    const errorCalls = calls.filter(c => !c.success && c.errorType);
    const errorMap = new Map<string, { count: number; timestamp: number }>();
    for (const call of errorCalls) {
      const key = `${call.toolName}:${call.errorType}`;
      const existing = errorMap.get(key) || { count: 0, timestamp: call.timestamp };
      existing.count++;
      existing.timestamp = Math.max(existing.timestamp, call.timestamp);
      errorMap.set(key, existing);
    }
    const recentErrors = Array.from(errorMap.entries())
      .map(([key, value]) => {
        const [toolName, errorType] = key.split(':');
        return { toolName, errorType, ...value };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    // Compute trends (last 7 days)
    const trends = this.computeTrends(calls);

    return {
      overview: {
        totalCalls: calls.length,
        totalServers: servers.length,
        totalTools: metrics.length,
        avgSuccessRate: metrics.reduce((sum, m) => sum + (1 - m.errorRate), 0) / Math.max(1, metrics.length),
        avgLatency: metrics.reduce((sum, m) => sum + m.avgDuration, 0) / Math.max(1, metrics.length),
        uniqueUsers: users.size,
        uniqueSessions: sessions.size,
      },
      servers,
      topTools,
      recentErrors,
      trends,
    };
  }

  private computeTrends(calls: ToolCall[]): AnalyticsDashboard['trends'] {
    const now = Date.now();
    const dayMs = 86400000;
    const trends: AnalyticsDashboard['trends'] = [];

    for (let i = 6; i >= 0; i--) {
      const start = now - (i + 1) * dayMs;
      const end = now - i * dayMs;
      const dayCalls = calls.filter(c => c.timestamp >= start && c.timestamp < end);

      const date = new Date(end);
      trends.push({
        period: date.toISOString().split('T')[0],
        calls: dayCalls.length,
        successRate: dayCalls.length > 0
          ? dayCalls.filter(c => c.success).length / dayCalls.length
          : 0,
        avgLatency: dayCalls.length > 0
          ? dayCalls.reduce((sum, c) => sum + c.duration, 0) / dayCalls.length
          : 0,
      });
    }

    return trends;
  }

  clear(): void {
    this.calls = [];
    this.metrics.clear();
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

// ============================================================================
// Analytics Manager
// ============================================================================

export class MCPAnalytics {
  private store: AnalyticsStore;
  private enabled: boolean = true;

  constructor() {
    this.store = new AnalyticsStore();
  }

  /**
   * Record a tool call
   */
  recordToolCall(params: {
    serverId: string;
    toolName: string;
    duration: number;
    success: boolean;
    errorType?: string;
    inputSize: number;
    outputSize: number;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }): void {
    if (!this.enabled) return;

    const call: ToolCall = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...params,
    };

    this.store.recordCall(call);
  }

  /**
   * Wrap a tool execution function with analytics
   */
  wrapToolExecution<T>(
    serverId: string,
    toolName: string,
    fn: () => Promise<T>,
    options?: { userId?: string; sessionId?: string }
  ): Promise<T> {
    const start = Date.now();
    let inputSize = 0;

    return fn()
      .then(result => {
        const outputSize = JSON.stringify(result).length;
        this.recordToolCall({
          serverId,
          toolName,
          duration: Date.now() - start,
          success: true,
          inputSize,
          outputSize,
          userId: options?.userId,
          sessionId: options?.sessionId,
        });
        return result;
      })
      .catch(error => {
        this.recordToolCall({
          serverId,
          toolName,
          duration: Date.now() - start,
          success: false,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          inputSize,
          outputSize: 0,
          userId: options?.userId,
          sessionId: options?.sessionId,
        });
        throw error;
      });
  }

  /**
   * Get analytics dashboard
   */
  getDashboard(timeRange?: TimeRange): AnalyticsDashboard {
    return this.store.getDashboard(timeRange);
  }

  /**
   * Get metrics for a specific tool
   */
  getToolMetrics(serverId: string, toolName: string): ToolMetrics | undefined {
    return this.store.getMetrics(serverId).find(m => m.toolName === toolName);
  }

  /**
   * Get all metrics for a server
   */
  getServerMetrics(serverId: string): ToolMetrics[] {
    return this.store.getMetrics(serverId);
  }

  /**
   * Get raw call data (for export)
   */
  exportCalls(timeRange?: TimeRange): ToolCall[] {
    return this.store.getCalls(timeRange);
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.store.destroy();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const analytics = new MCPAnalytics();

// ============================================================================
// Analytics API Handler (for HTTP endpoints)
// ============================================================================

export function createAnalyticsHandler() {
  return {
    // GET /api/mcp/analytics
    async getDashboard(timeRange?: TimeRange) {
      return analytics.getDashboard(timeRange);
    },

    // GET /api/mcp/analytics/tools/:serverId/:toolName
    async getToolMetrics(serverId: string, toolName: string) {
      return analytics.getToolMetrics(serverId, toolName);
    },

    // GET /api/mcp/analytics/servers/:serverId
    async getServerMetrics(serverId: string) {
      return analytics.getServerMetrics(serverId);
    },

    // GET /api/mcp/analytics/export
    async exportData(timeRange?: TimeRange) {
      return {
        exportedAt: new Date().toISOString(),
        calls: analytics.exportCalls(timeRange),
      };
    },

    // POST /api/mcp/analytics/record
    async recordCall(call: Omit<ToolCall, 'id' | 'timestamp'>) {
      analytics.recordToolCall(call);
      return { success: true };
    },
  };
}

// ============================================================================
// Integration with MCP Tools
// ============================================================================

/**
 * Higher-order function to add analytics to any tool handler
 */
export function withAnalytics<T extends (...args: any[]) => Promise<any>>(
  serverId: string,
  toolName: string,
  handler: T,
  options?: { userId?: string; sessionId?: string }
): T {
  return (async (...args: Parameters<T>) => {
    const start = Date.now();
    const inputSize = JSON.stringify(args).length;

    try {
      const result = await handler(...args);
      const outputSize = JSON.stringify(result).length;

      analytics.recordToolCall({
        serverId,
        toolName,
        duration: Date.now() - start,
        success: true,
        inputSize,
        outputSize,
        userId: options?.userId,
        sessionId: options?.sessionId,
      });

      return result;
    } catch (error) {
      analytics.recordToolCall({
        serverId,
        toolName,
        duration: Date.now() - start,
        success: false,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        inputSize,
        outputSize: 0,
        userId: options?.userId,
        sessionId: options?.sessionId,
      });
      throw error;
    }
  }) as T;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MCPAnalytics,
  analytics,
  createAnalyticsHandler,
  withAnalytics,
};
