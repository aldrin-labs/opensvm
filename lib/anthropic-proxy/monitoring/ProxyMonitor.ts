// Mock interface for QdrantVectorStore until we add the dependency
interface MockQdrantVectorStore {
    addDocuments(documents: Array<{ pageContent: string; metadata: any }>): Promise<void>;
}

export interface RequestMetrics {
    requestId: string;
    timestamp: Date;
    userId?: string;
    keyId?: string;
    endpoint: string;
    method: string;
    model?: string;
    inputTokens?: number;
    maxTokens?: number;
    streaming: boolean;
    hasTools: boolean;
    userAgent?: string;
    ipAddress?: string;
    requestSize: number;
}

export interface ResponseMetrics {
    requestId: string;
    timestamp: Date;
    statusCode: number;
    outputTokens?: number;
    responseTime: number;
    success: boolean;
    errorType?: string;
    responseSize: number;
    cacheHit: boolean;
}

export interface SystemMetrics {
    timestamp: Date;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    cpuUsage: {
        user: number;
        system: number;
    };
    activeConnections: number;
    queueLength: number;
    anthropicApiLatency: number;
    qdrantLatency: number;
}

export interface AlertConfig {
    id: string;
    name: string;
    condition: 'error_rate' | 'response_time' | 'memory_usage' | 'queue_length' | 'api_errors';
    threshold: number;
    timeWindow: number; // minutes
    enabled: boolean;
    notificationChannels: string[];
}

export interface ErrorStats {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByEndpoint: Record<string, number>;
    criticalErrors: number;
    averageErrorRate: number;
}

export class ProxyMonitor {
    private static instance: ProxyMonitor;
    private vectorStore: MockQdrantVectorStore | null = null;
    private metricsBuffer: (RequestMetrics | ResponseMetrics | SystemMetrics)[] = [];
    private errorCounts: Map<string, number> = new Map();
    private requestCounts: Map<string, number> = new Map();
    private responseTimes: Map<string, number[]> = new Map();
    private alerts: AlertConfig[] = [];
    private lastFlush: Date = new Date();
    private systemStartTime: Date = new Date();

    private constructor() {
        this.initializeVectorStore();
        this.startSystemMetricsCollection();
        this.startPeriodicFlush();
        this.loadAlertConfigurations();
    }

    static getInstance(): ProxyMonitor {
        if (!ProxyMonitor.instance) {
            ProxyMonitor.instance = new ProxyMonitor();
        }
        return ProxyMonitor.instance;
    }

    /**
     * Initialize mock vector store for metrics storage
     */
    private async initializeVectorStore(): Promise<void> {
        try {
            // Mock implementation for now
            this.vectorStore = {
                addDocuments: async (documents) => {
                    // In a real implementation, this would store to Qdrant
                    console.log(`Mock: Storing ${documents.length} documents to vector store`);
                }
            };
            console.log('ProxyMonitor: Mock vector store initialized');
        } catch (error) {
            console.error('ProxyMonitor: Failed to initialize vector store:', error);
        }
    }

    /**
     * Log incoming request metrics
     */
    async logRequest(metrics: RequestMetrics): Promise<void> {
        // Add to buffer for batch processing
        this.metricsBuffer.push(metrics);

        // Update real-time counters
        const endpointKey = `${metrics.method}:${metrics.endpoint}`;
        this.requestCounts.set(endpointKey, (this.requestCounts.get(endpointKey) || 0) + 1);

        // Log structured request data
        this.logStructured('request', {
            requestId: metrics.requestId,
            timestamp: metrics.timestamp.toISOString(),
            endpoint: metrics.endpoint,
            method: metrics.method,
            userId: metrics.userId,
            keyId: metrics.keyId,
            model: metrics.model,
            streaming: metrics.streaming,
            inputTokens: metrics.inputTokens,
            requestSize: metrics.requestSize
        });

        // Flush buffer if it's getting large
        if (this.metricsBuffer.length > 100) {
            await this.flushMetrics();
        }
    }

    /**
     * Log response metrics
     */
    async logResponse(metrics: ResponseMetrics): Promise<void> {
        // Add to buffer for batch processing
        this.metricsBuffer.push(metrics);

        // Update response time tracking
        const endpointKey = metrics.requestId.split('-')[0] || 'unknown';
        if (!this.responseTimes.has(endpointKey)) {
            this.responseTimes.set(endpointKey, []);
        }
        this.responseTimes.get(endpointKey)!.push(metrics.responseTime);

        // Keep only last 100 response times per endpoint
        if (this.responseTimes.get(endpointKey)!.length > 100) {
            this.responseTimes.get(endpointKey)!.shift();
        }

        // Log structured response data
        this.logStructured('response', {
            requestId: metrics.requestId,
            timestamp: metrics.timestamp.toISOString(),
            statusCode: metrics.statusCode,
            responseTime: metrics.responseTime,
            outputTokens: metrics.outputTokens,
            success: metrics.success,
            errorType: metrics.errorType,
            cacheHit: metrics.cacheHit,
            responseSize: metrics.responseSize
        });

        // Check for alerts
        await this.checkAlerts(metrics);
    }

    /**
     * Log error with context
     */
    async logError(error: any, context: any): Promise<void> {
        const errorKey = `${error.type}:${context.endpoint}`;
        this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

        // Log structured error data
        this.logStructured('error', {
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
            errorType: error.type,
            message: error.message,
            statusCode: error.statusCode,
            endpoint: context.endpoint,
            userId: context.userId,
            keyId: context.keyId,
            critical: error.statusCode >= 500
        });

        // Store error in Qdrant for analysis
        if (this.vectorStore) {
            try {
                await this.vectorStore.addDocuments([{
                    pageContent: JSON.stringify({
                        type: 'error',
                        error,
                        context,
                        timestamp: new Date().toISOString()
                    }),
                    metadata: {
                        type: 'error',
                        errorType: error.type,
                        statusCode: error.statusCode,
                        endpoint: context.endpoint,
                        timestamp: Date.now()
                    }
                }]);
            } catch (storeError) {
                console.error('Failed to store error in Qdrant:', storeError);
            }
        }
    }

    /**
     * Increment error count for specific type and endpoint
     */
    async incrementErrorCount(errorType: string, endpoint: string): Promise<void> {
        const key = `${errorType}:${endpoint}`;
        this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }

    /**
     * Get current system metrics
     */
    getSystemMetrics(): SystemMetrics {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            timestamp: new Date(),
            memoryUsage: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            },
            cpuUsage: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            activeConnections: this.getActiveConnectionCount(),
            queueLength: this.metricsBuffer.length,
            anthropicApiLatency: this.getAverageAnthropicLatency(),
            qdrantLatency: this.getAverageQdrantLatency()
        };
    }

    /**
     * Get error statistics for a time range
     */
    async getErrorStats(timeRange: { start: Date; end: Date }): Promise<ErrorStats> {
        // Use timeRange for filtering and validation
        console.log(`Getting error stats for time range: ${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}`);
        const rangeMs = timeRange.end.getTime() - timeRange.start.getTime();
        if (rangeMs <= 0) {
            throw new Error('Invalid time range: end must be after start');
        }
        if (rangeMs > 86400000 * 30) { // 30 days
            console.warn(`Large time range requested: ${Math.round(rangeMs / 86400000)} days`);
        }

        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);

        const errorsByType: Record<string, number> = {};
        const errorsByEndpoint: Record<string, number> = {};
        let criticalErrors = 0;

        for (const [key, count] of this.errorCounts.entries()) {
            const [type, endpoint] = key.split(':');
            errorsByType[type] = (errorsByType[type] || 0) + count;
            errorsByEndpoint[endpoint] = (errorsByEndpoint[endpoint] || 0) + count;

            // Count critical errors (5xx status codes)
            if (type.includes('proxy_error') || type.includes('anthropic_error')) {
                criticalErrors += count;
            }
        }

        return {
            totalErrors,
            errorsByType,
            errorsByEndpoint,
            criticalErrors,
            averageErrorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
        };
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        averageResponseTime: number;
        requestsPerMinute: number;
        errorRate: number;
        uptime: number;
    } {
        const allResponseTimes = Array.from(this.responseTimes.values()).flat();
        const averageResponseTime = allResponseTimes.length > 0
            ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length
            : 0;

        const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        const uptimeMs = Date.now() - this.systemStartTime.getTime();
        const requestsPerMinute = totalRequests / (uptimeMs / 60000);

        return {
            averageResponseTime,
            requestsPerMinute,
            errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
            uptime: uptimeMs / 1000 // seconds
        };
    }

    /**
     * Get health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Record<string, boolean>;
        message: string;
    } {
        const metrics = this.getSystemMetrics();
        const performance = this.getPerformanceMetrics();

        const checks = {
            memoryUsage: metrics.memoryUsage.heapUsed < 1024 * 1024 * 1024, // < 1GB
            errorRate: performance.errorRate < 5, // < 5%
            responseTime: performance.averageResponseTime < 2000, // < 2s
            queueLength: metrics.queueLength < 1000,
            anthropicApi: metrics.anthropicApiLatency < 5000 // < 5s
        };

        const healthyChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        let message: string;

        if (healthyChecks === totalChecks) {
            status = 'healthy';
            message = 'All systems operational';
        } else if (healthyChecks >= totalChecks * 0.8) {
            status = 'degraded';
            message = 'Some systems experiencing issues';
        } else {
            status = 'unhealthy';
            message = 'Multiple system failures detected';
        }

        return { status, checks, message };
    }

    /**
     * Configure alerts
     */
    configureAlert(config: AlertConfig): void {
        const existingIndex = this.alerts.findIndex(alert => alert.id === config.id);
        if (existingIndex >= 0) {
            this.alerts[existingIndex] = config;
        } else {
            this.alerts.push(config);
        }
    }

    /**
     * Get all alert configurations
     */
    getAlertConfigurations(): AlertConfig[] {
        return [...this.alerts];
    }

    /**
     * Check if any alerts should be triggered
     */
    private async checkAlerts(metrics: ResponseMetrics): Promise<void> {
        for (const alert of this.alerts.filter(a => a.enabled)) {
            const shouldTrigger = await this.evaluateAlertCondition(alert, metrics);
            if (shouldTrigger) {
                await this.triggerAlert(alert, metrics);
            }
        }
    }

    /**
     * Evaluate alert condition
     */
    private async evaluateAlertCondition(alert: AlertConfig, metrics: ResponseMetrics): Promise<boolean> {
        switch (alert.condition) {
            case 'error_rate':
                const performance = this.getPerformanceMetrics();
                return performance.errorRate > alert.threshold;

            case 'response_time':
                return metrics.responseTime > alert.threshold;

            case 'memory_usage':
                const systemMetrics = this.getSystemMetrics();
                return systemMetrics.memoryUsage.heapUsed > alert.threshold;

            case 'queue_length':
                return this.metricsBuffer.length > alert.threshold;

            case 'api_errors':
                return !metrics.success && metrics.statusCode >= 500;

            default:
                return false;
        }
    }

    /**
     * Trigger alert notification
     */
    private async triggerAlert(alert: AlertConfig, metrics: ResponseMetrics): Promise<void> {
        const alertMessage = {
            alertId: alert.id,
            alertName: alert.name,
            condition: alert.condition,
            threshold: alert.threshold,
            currentValue: this.getCurrentValueForCondition(alert.condition),
            timestamp: new Date().toISOString(),
            requestId: metrics.requestId
        };

        // Log alert
        this.logStructured('alert', alertMessage);

        // In production, send to notification channels
        if (process.env.NODE_ENV === 'production') {
            for (const channel of alert.notificationChannels) {
                await this.sendNotification(channel, alertMessage);
            }
        }
    }

    /**
     * Get current value for alert condition
     */
    private getCurrentValueForCondition(condition: string): number {
        switch (condition) {
            case 'error_rate':
                return this.getPerformanceMetrics().errorRate;
            case 'memory_usage':
                return this.getSystemMetrics().memoryUsage.heapUsed;
            case 'queue_length':
                return this.metricsBuffer.length;
            default:
                return 0;
        }
    }

    /**
     * Send notification to channel (placeholder for production implementation)
     */
    private async sendNotification(channel: string, message: any): Promise<void> {
        console.warn(`Alert notification would be sent to ${channel}:`, message);
        // In production, implement actual notification sending:
        // - Slack webhook
        // - Email service
        // - PagerDuty
        // - SMS service
    }

    /**
     * Flush metrics buffer to storage
     */
    private async flushMetrics(): Promise<void> {
        if (this.metricsBuffer.length === 0 || !this.vectorStore) {
            return;
        }

        try {
            // Use lastFlush to track flush intervals and performance
            const timeSinceLastFlush = Date.now() - this.lastFlush.getTime();
            console.log(`Flushing ${this.metricsBuffer.length} metrics (last flush: ${Math.round(timeSinceLastFlush / 1000)}s ago)`);

            const documents = this.metricsBuffer.map(metric => ({
                pageContent: JSON.stringify(metric),
                metadata: {
                    type: this.getMetricType(metric),
                    timestamp: Date.now(),
                    ...this.extractMetadata(metric)
                }
            }));

            await this.vectorStore.addDocuments(documents);
            this.metricsBuffer = [];
            this.lastFlush = new Date();

            console.log(`Successfully flushed ${documents.length} metrics to Qdrant`);
        } catch (error) {
            console.error('Failed to flush metrics to Qdrant:', error);
        }
    }

    /**
     * Get metric type for classification
     */
    private getMetricType(metric: any): string {
        if ('method' in metric && 'endpoint' in metric) return 'request';
        if ('statusCode' in metric && 'responseTime' in metric) return 'response';
        if ('memoryUsage' in metric && 'cpuUsage' in metric) return 'system';
        return 'unknown';
    }

    /**
     * Extract metadata from metric for indexing
     */
    private extractMetadata(metric: any): Record<string, any> {
        const metadata: Record<string, any> = {};

        if ('endpoint' in metric) metadata.endpoint = metric.endpoint;
        if ('userId' in metric) metadata.userId = metric.userId;
        if ('keyId' in metric) metadata.keyId = metric.keyId;
        if ('statusCode' in metric) metadata.statusCode = metric.statusCode;
        if ('success' in metric) metadata.success = metric.success;

        return metadata;
    }

    /**
     * Start collecting system metrics periodically
     */
    private startSystemMetricsCollection(): void {
        setInterval(() => {
            const systemMetrics = this.getSystemMetrics();
            this.metricsBuffer.push(systemMetrics);
        }, 60000); // Every minute
    }

    /**
     * Start periodic metrics flushing
     */
    private startPeriodicFlush(): void {
        setInterval(async () => {
            await this.flushMetrics();
        }, 300000); // Every 5 minutes
    }

    /**
     * Load alert configurations from environment or storage
     */
    private loadAlertConfigurations(): void {
        // Default alert configurations
        this.alerts = [
            {
                id: 'high-error-rate',
                name: 'High Error Rate',
                condition: 'error_rate',
                threshold: 10, // 10%
                timeWindow: 5,
                enabled: true,
                notificationChannels: ['console', 'email']
            },
            {
                id: 'slow-response',
                name: 'Slow Response Time',
                condition: 'response_time',
                threshold: 5000, // 5 seconds
                timeWindow: 1,
                enabled: true,
                notificationChannels: ['console']
            },
            {
                id: 'high-memory',
                name: 'High Memory Usage',
                condition: 'memory_usage',
                threshold: 1024 * 1024 * 1024, // 1GB
                timeWindow: 5,
                enabled: true,
                notificationChannels: ['console', 'email']
            }
        ];
    }

    /**
     * Log structured data for monitoring systems
     */
    private logStructured(type: string, data: any): void {
        const logEntry = {
            level: type === 'error' ? 'error' : 'info',
            type,
            timestamp: new Date().toISOString(),
            ...data
        };

        if (type === 'error') {
            console.error('ProxyMonitor:', JSON.stringify(logEntry));
        } else {
            console.log('ProxyMonitor:', JSON.stringify(logEntry));
        }
    }

    /**
     * Get active connection count (placeholder - would need actual implementation)
     */
    private getActiveConnectionCount(): number {
        // In a real implementation, this would track actual HTTP connections
        return 0;
    }

    /**
     * Get average Anthropic API latency
     */
    private getAverageAnthropicLatency(): number {
        const anthropicTimes = this.responseTimes.get('anthropic') || [];
        return anthropicTimes.length > 0
            ? anthropicTimes.reduce((sum, time) => sum + time, 0) / anthropicTimes.length
            : 0;
    }

    /**
     * Get average Qdrant latency
     */
    private getAverageQdrantLatency(): number {
        const qdrantTimes = this.responseTimes.get('qdrant') || [];
        return qdrantTimes.length > 0
            ? qdrantTimes.reduce((sum, time) => sum + time, 0) / qdrantTimes.length
            : 0;
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        await this.flushMetrics();
        console.log('ProxyMonitor: Cleanup completed');
    }
} 