import { globalTransactionHistory, Transaction } from '../billing/TransactionHistory';

export interface UsageMetrics {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageResponseTime: number;
    errorRate: number;
    uniqueModelsUsed: number;
    peakHour: number;
    averageTokensPerRequest: number;
}

export interface ModelUsageStats {
    model: string;
    requests: number;
    tokens: number;
    cost: number;
    averageTokensPerRequest: number;
    errorRate: number;
}

export interface TimeSeriesData {
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    errors: number;
}

export interface UsageAnalytics {
    period: 'day' | 'week' | 'month';
    metrics: UsageMetrics;
    modelBreakdown: ModelUsageStats[];
    timeSeries: TimeSeriesData[];
    topModels: ModelUsageStats[];
    recentActivity: {
        timestamp: string;
        model: string;
        tokens: number;
        cost: number;
        status: 'success' | 'error';
    }[];
}

export class AdvancedUsageAnalytics {
    /**
     * Generate comprehensive usage analytics for a user
     */
    async generateAnalytics(userId: string, period: 'day' | 'week' | 'month'): Promise<UsageAnalytics> {
        const { startDate, endDate } = this.getPeriodDates(period);

        // Get all relevant transactions
        const transactions = await globalTransactionHistory.getTransactions({
            userId,
            type: 'deduction',
            startDate,
            endDate,
            limit: 10000
        });

        const metrics = this.calculateMetrics(transactions);
        const modelBreakdown = this.calculateModelBreakdown(transactions);
        const timeSeries = this.generateTimeSeries(transactions, period);
        const topModels = this.getTopModels(modelBreakdown, 5);
        const recentActivity = this.getRecentActivity(transactions, 10);

        return {
            period,
            metrics,
            modelBreakdown,
            timeSeries,
            topModels,
            recentActivity
        };
    }

    /**
     * Calculate overall usage metrics
     */
    private calculateMetrics(transactions: Transaction[]): UsageMetrics {
        let totalTokens = 0;
        let totalCost = 0;
        let totalResponseTime = 0;
        let errors = 0;
        const modelsUsed = new Set<string>();
        const hourlyRequests = new Array(24).fill(0);

        for (const txn of transactions) {
            // Count tokens
            if (txn.metadata?.tokens) {
                totalTokens += txn.metadata.tokens.input + txn.metadata.tokens.output;
            }

            // Count cost
            totalCost += Math.abs(txn.amount);

            // Track models
            if (txn.metadata?.model) {
                modelsUsed.add(txn.metadata.model);
            }

            // Track hourly distribution
            const hour = txn.timestamp.getHours();
            hourlyRequests[hour]++;

            // Count errors (simplified - would need more metadata)
            if (txn.status === 'failed') {
                errors++;
            }
        }

        const totalRequests = transactions.length;
        const peakHour = hourlyRequests.indexOf(Math.max(...hourlyRequests));

        return {
            totalRequests,
            totalTokens,
            totalCost,
            averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
            errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
            uniqueModelsUsed: modelsUsed.size,
            peakHour,
            averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
        };
    }

    /**
     * Calculate usage breakdown by model
     */
    private calculateModelBreakdown(transactions: Transaction[]): ModelUsageStats[] {
        const modelStats = new Map<string, {
            requests: number;
            tokens: number;
            cost: number;
            errors: number;
        }>();

        for (const txn of transactions) {
            const model = txn.metadata?.model || 'unknown';
            const stats = modelStats.get(model) || { requests: 0, tokens: 0, cost: 0, errors: 0 };

            stats.requests++;
            stats.cost += Math.abs(txn.amount);

            if (txn.metadata?.tokens) {
                stats.tokens += txn.metadata.tokens.input + txn.metadata.tokens.output;
            }

            if (txn.status === 'failed') {
                stats.errors++;
            }

            modelStats.set(model, stats);
        }

        return Array.from(modelStats.entries()).map(([model, stats]): ModelUsageStats => ({
            model,
            requests: stats.requests,
            tokens: stats.tokens,
            cost: stats.cost,
            averageTokensPerRequest: stats.requests > 0 ? stats.tokens / stats.requests : 0,
            errorRate: stats.requests > 0 ? (stats.errors / stats.requests) * 100 : 0
        }));
    }

    /**
     * Generate time series data
     */
    private generateTimeSeries(transactions: Transaction[], period: 'day' | 'week' | 'month'): TimeSeriesData[] {
        const groupBy = period === 'day' ? 'hour' : period === 'week' ? 'day' : 'day';
        const dataPoints = new Map<string, {
            requests: number;
            tokens: number;
            cost: number;
            errors: number;
        }>();

        for (const txn of transactions) {
            let key: string;

            if (groupBy === 'hour') {
                key = `${txn.timestamp.getFullYear()}-${String(txn.timestamp.getMonth() + 1).padStart(2, '0')}-${String(txn.timestamp.getDate()).padStart(2, '0')} ${String(txn.timestamp.getHours()).padStart(2, '0')}:00`;
            } else {
                key = `${txn.timestamp.getFullYear()}-${String(txn.timestamp.getMonth() + 1).padStart(2, '0')}-${String(txn.timestamp.getDate()).padStart(2, '0')}`;
            }

            const stats = dataPoints.get(key) || { requests: 0, tokens: 0, cost: 0, errors: 0 };

            stats.requests++;
            stats.cost += Math.abs(txn.amount);

            if (txn.metadata?.tokens) {
                stats.tokens += txn.metadata.tokens.input + txn.metadata.tokens.output;
            }

            if (txn.status === 'failed') {
                stats.errors++;
            }

            dataPoints.set(key, stats);
        }

        return Array.from(dataPoints.entries())
            .map(([date, stats]) => ({
                date,
                requests: stats.requests,
                tokens: stats.tokens,
                cost: stats.cost,
                errors: stats.errors
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get top models by usage
     */
    private getTopModels(modelBreakdown: ModelUsageStats[], limit: number): ModelUsageStats[] {
        return modelBreakdown
            .sort((a, b) => b.requests - a.requests)
            .slice(0, limit);
    }

    /**
     * Get recent activity
     */
    private getRecentActivity(transactions: Transaction[], limit: number): UsageAnalytics['recentActivity'] {
        return transactions
            .slice(0, limit)
            .map(txn => ({
                timestamp: txn.timestamp.toISOString(),
                model: txn.metadata?.model || 'unknown',
                tokens: txn.metadata?.tokens ?
                    txn.metadata.tokens.input + txn.metadata.tokens.output : 0,
                cost: Math.abs(txn.amount),
                status: txn.status === 'completed' ? 'success' as const : 'error' as const
            }));
    }

    /**
     * Get date range for period
     */
    private getPeriodDates(period: 'day' | 'week' | 'month'): { startDate: Date; endDate: Date } {
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case 'day':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
        }

        return { startDate, endDate };
    }

    /**
     * Generate usage forecast based on historical data
     */
    async generateForecast(userId: string, days: number = 7): Promise<{
        estimatedRequests: number;
        estimatedCost: number;
        estimatedTokens: number;
        confidence: number;
    }> {
        // Get last 30 days of data for forecasting
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const transactions = await globalTransactionHistory.getTransactions({
            userId,
            type: 'deduction',
            startDate: thirtyDaysAgo,
            limit: 10000
        });

        if (transactions.length === 0) {
            return {
                estimatedRequests: 0,
                estimatedCost: 0,
                estimatedTokens: 0,
                confidence: 0
            };
        }

        // Simple linear forecast based on recent trend
        const dailyAverage = {
            requests: transactions.length / 30,
            cost: transactions.reduce((sum, txn) => sum + Math.abs(txn.amount), 0) / 30,
            tokens: transactions.reduce((sum, txn) => {
                if (txn.metadata?.tokens) {
                    return sum + txn.metadata.tokens.input + txn.metadata.tokens.output;
                }
                return sum;
            }, 0) / 30
        };

        // Calculate confidence based on data consistency
        const confidence = Math.min(100, (transactions.length / 30) * 10); // Higher confidence with more data

        return {
            estimatedRequests: Math.round(dailyAverage.requests * days),
            estimatedCost: Math.round(dailyAverage.cost * days),
            estimatedTokens: Math.round(dailyAverage.tokens * days),
            confidence: Math.round(confidence)
        };
    }
}

// Global analytics instance
export const globalUsageAnalytics = new AdvancedUsageAnalytics(); 