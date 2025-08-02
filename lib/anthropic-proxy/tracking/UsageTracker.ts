import { ProxyResponse, KeyUsageStats } from '../types/ProxyTypes';
import { UsageStorage, UsageLog } from '../storage/UsageStorage';
import { calculateSVMAICost } from '../utils/PricingCalculator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages the extraction, calculation, and tracking of token usage
 * from Anthropic API responses.
 */
export class UsageTracker {
    private usageStorage: UsageStorage;

    constructor() {
        this.usageStorage = new UsageStorage();
    }

    /**
     * Initialize the usage storage collection.
     */
    async initialize(): Promise<void> {
        await this.usageStorage.initialize();
    }

    /**
     * Extracts token usage from an Anthropic API response,
     * calculates SVMAI cost, and logs the usage.
     *
     * @param proxyResponse The full proxy response object.
     */
    async trackResponse(proxyResponse: ProxyResponse): Promise<void> {
        const { keyId, userId, anthropicResponse, responseTime, success, model } = proxyResponse;

        const inputTokens = anthropicResponse?.usage?.input_tokens || 0;
        const outputTokens = anthropicResponse?.usage?.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;

        const svmaiCost = calculateSVMAICost(model, inputTokens, outputTokens);

        const usageLog: UsageLog = {
            id: uuidv4(),
            keyId,
            userId,
            endpoint: '/v1/messages', // Assuming this is for messages endpoint
            model,
            inputTokens,
            outputTokens,
            totalTokens,
            svmaiCost,
            responseTime,
            success,
            errorType: success ? undefined : 'anthropic_error', // Simplified error type
            timestamp: new Date(),
        };

        await this.usageStorage.logUsage(usageLog);

        // Note: APIKey usage stats are updated in BillingProcessor for consistency
    }

    /**
     * Retrieves aggregated usage statistics for a specific API key.
     *
     * @param keyId The ID of the API key.
     * @returns Aggregated usage statistics.
     */
    async getKeyUsageStats(keyId: string): Promise<KeyUsageStats> {
        return this.usageStorage.aggregateKeyUsage(keyId);
    }

    /**
     * Retrieves raw usage logs for a user.
     *
     * @param userId The ID of the user.
     * @param limit Maximum number of logs to retrieve.
     * @param offset Offset for pagination.
     * @returns An array of usage logs.
     */
    async getUserUsageLogs(userId: string, limit?: number, offset?: number): Promise<UsageLog[]> {
        return this.usageStorage.fetchUsageLogs({ userId, limit, offset });
    }
} 