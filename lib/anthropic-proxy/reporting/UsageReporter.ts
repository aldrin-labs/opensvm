import { UsageStorage, UsageLog } from '../storage/UsageStorage';
import { UserBalance, KeyUsageStats, DEFAULT_PRICING, PricingTier } from '../types/ProxyTypes';
import { calculateSVMAICost } from '../utils/PricingCalculator';
import { SVMAIBalanceManager } from '../billing/SVMAIBalanceManager';

/**
 * Generates various usage reports and statistics for Anthropic API proxy.
 */
export class UsageReporter {
    private usageStorage: UsageStorage;
    private balanceManager: SVMAIBalanceManager;

    constructor() {
        this.usageStorage = new UsageStorage();
        this.balanceManager = new SVMAIBalanceManager();
    }

    /**
     * Initialize required components.
     */
    async initialize(): Promise<void> {
        await this.usageStorage.initialize();
        await this.balanceManager.initialize();
    }

    /**
     * Get comprehensive usage statistics for a specific user.
     *
     * @param userId The ID of the user.
     * @param period Optional: 'day', 'week', 'month' for time-based filtering. Defaults to all time.
     */
    async getUserUsageReport(userId: string, period?: 'day' | 'week' | 'month'): Promise<UserUsageReport> {
        const allUserLogs = await this.usageStorage.fetchUsageLogs({ userId, limit: 10000 }); // Fetch substantial amount

        let filteredLogs = allUserLogs;
        const now = new Date();
        if (period === 'day') {
            const oneDayAgo = new Date(now.setDate(now.getDate() - 1));
            filteredLogs = allUserLogs.filter(log => log.timestamp > oneDayAgo);
        } else if (period === 'week') {
            const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
            filteredLogs = allUserLogs.filter(log => log.timestamp > oneWeekAgo);
        } else if (period === 'month') {
            const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
            filteredLogs = allUserLogs.filter(log => log.timestamp > oneMonthAgo);
        }

        const totalRequests = filteredLogs.length;
        const totalInputTokens = filteredLogs.reduce((acc, log) => acc + log.inputTokens, 0);
        const totalOutputTokens = filteredLogs.reduce((acc, log) => acc + log.outputTokens, 0);
        const totalTokensConsumed = totalInputTokens + totalOutputTokens;
        const totalSVMAISpent = filteredLogs.reduce((acc, log) => acc + log.svmaiCost, 0);
        const successfulRequests = filteredLogs.filter(log => log.success).length;
        const errorRequests = totalRequests - successfulRequests;
        const errorRate = totalRequests ? (errorRequests / totalRequests) * 100 : 0;
        const averageResponseTime = totalRequests ? filteredLogs.reduce((acc, log) => acc + log.responseTime, 0) / totalRequests : 0;

        const modelUsage: { [model: string]: number } = {};
        filteredLogs.forEach(log => {
            modelUsage[log.model] = (modelUsage[log.model] || 0) + log.totalTokens;
        });
        const topModels = Object.entries(modelUsage)
            .sort(([, tokensA], [, tokensB]) => tokensB - tokensA)
            .map(([model, tokens]) => ({ model, tokens }));

        const balance = await this.balanceManager.getBalance(userId);

        return {
            userId,
            totalRequests,
            successfulRequests,
            errorRequests,
            errorRate,
            totalTokensConsumed,
            totalInputTokens,
            totalOutputTokens,
            totalSVMAISpent,
            averageResponseTime,
            currentSVMAIBalance: balance?.svmaiBalance || 0,
            availableSVMAIBalance: balance?.availableBalance || 0,
            topModels,
            costBreakdownByModel: this.getCostBreakdownByModel(filteredLogs),
            dailyUsage: this.getDailyUsage(filteredLogs)
        };
    }

    /**
     * Get detailed usage statistics for a specific API key.
     *
     * @param keyId The ID of the API key.
     */
    async getKeyUsageStats(keyId: string): Promise<KeyUsageStats> {
        return this.usageStorage.aggregateKeyUsage(keyId);
    }

    private getCostBreakdownByModel(logs: UsageLog[]): { model: string; svmaiCost: number; }[] {
        const breakdown: { [model: string]: number } = {};
        logs.forEach(log => {
            breakdown[log.model] = (breakdown[log.model] || 0) + log.svmaiCost;
        });
        return Object.entries(breakdown).map(([model, svmaiCost]) => ({ model, svmaiCost }));
    }

    private getDailyUsage(logs: UsageLog[]): { date: string; requests: number; tokens: number; svmaiCost: number; }[] {
        const dailyData: { [date: string]: { requests: number; tokens: number; svmaiCost: number; } } = {};
        logs.forEach(log => {
            const date = log.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
            if (!dailyData[date]) {
                dailyData[date] = { requests: 0, tokens: 0, svmaiCost: 0 };
            }
            dailyData[date].requests++;
            dailyData[date].tokens += log.totalTokens;
            dailyData[date].svmaiCost += log.svmaiCost;
        });

        return Object.entries(dailyData)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, data]) => ({ date, ...data }));
    }
}

export interface UserUsageReport {
    userId: string;
    totalRequests: number;
    successfulRequests: number;
    errorRequests: number;
    errorRate: number;
    totalTokensConsumed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalSVMAISpent: number;
    averageResponseTime: number;
    currentSVMAIBalance: number;
    availableSVMAIBalance: number;
    topModels: { model: string; tokens: number; }[];
    costBreakdownByModel: { model: string; svmaiCost: number; }[];
    dailyUsage: { date: string; requests: number; tokens: number; svmaiCost: number; }[];
} 