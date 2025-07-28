import { QdrantClient } from '@qdrant/js-client-rest';
import { KeyUsageStats } from '../types/ProxyTypes';

/**
 * Qdrant-based storage for usage logs.
 * Each point represents a single completed Anthropic request.
 */

const USAGE_COLLECTION = 'anthropic_usage_logs';

export interface UsageLog {
    id: string;
    keyId: string;
    userId: string;
    endpoint: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    svmaiCost: number;
    responseTime: number; // ms
    success: boolean;
    errorType?: string;
    timestamp: Date;
}

export class UsageStorage {
    private client: QdrantClient;

    constructor() {
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY
        });
    }

    /**
     * Ensure usage collection exists.
     */
    async initialize(): Promise<void> {
        const collections = await this.client.getCollections();
        const exists = collections.collections.find(c => c.name === USAGE_COLLECTION);
        if (!exists) {
            await this.client.createCollection(USAGE_COLLECTION, {
                vectors: { size: 1, distance: 'Cosine' }
            });
        }
    }

    /**
     * Persist a usage log entry.
     */
    async logUsage(entry: UsageLog): Promise<void> {
        await this.client.upsert(USAGE_COLLECTION, {
            wait: true,
            points: [
                {
                    id: entry.id,
                    vector: [0],
                    payload: {
                        keyId: entry.keyId,
                        userId: entry.userId,
                        endpoint: entry.endpoint,
                        model: entry.model,
                        inputTokens: entry.inputTokens,
                        outputTokens: entry.outputTokens,
                        totalTokens: entry.totalTokens,
                        svmaiCost: entry.svmaiCost,
                        responseTime: entry.responseTime,
                        success: entry.success,
                        errorType: entry.errorType,
                        timestamp: entry.timestamp.toISOString()
                    }
                }
            ]
        });
    }

    /**
     * Fetch raw usage logs for a user or key.
     */
    async fetchUsageLogs(options: {
        userId?: string;
        keyId?: string;
        limit?: number;
        offset?: number;
    }): Promise<UsageLog[]> {
        const { userId, keyId, limit = 100, offset = 0 } = options;

        const mustFilters = [] as any[];
        if (userId) {
            mustFilters.push({ key: 'userId', match: { value: userId } });
        }
        if (keyId) {
            mustFilters.push({ key: 'keyId', match: { value: keyId } });
        }

        const scroll = await this.client.scroll(USAGE_COLLECTION, {
            filter: mustFilters.length ? { must: mustFilters } : undefined,
            limit,
            offset,
            with_payload: true
        });

        return scroll.points.map(p => {
            const payload = p.payload as any;
            return {
                id: p.id as string,
                keyId: payload.keyId,
                userId: payload.userId,
                endpoint: payload.endpoint,
                model: payload.model,
                inputTokens: payload.inputTokens,
                outputTokens: payload.outputTokens,
                totalTokens: payload.totalTokens,
                svmaiCost: payload.svmaiCost,
                responseTime: payload.responseTime,
                success: payload.success,
                errorType: payload.errorType,
                timestamp: new Date(payload.timestamp)
            } as UsageLog;
        });
    }

    /**
     * Aggregate simple stats for a key.
     */
    async aggregateKeyUsage(keyId: string): Promise<KeyUsageStats> {
        const logs = await this.fetchUsageLogs({ keyId, limit: 1000 });
        const totalRequests = logs.length;
        const totalTokens = logs.reduce((acc, l) => acc + l.totalTokens, 0);
        const totalCost = logs.reduce((acc, l) => acc + l.svmaiCost, 0);
        const avgTokens = totalRequests ? totalTokens / totalRequests : 0;

        return {
            totalRequests,
            totalTokensConsumed: totalTokens,
            totalSVMAISpent: totalCost,
            lastRequestAt: logs[0]?.timestamp,
            averageTokensPerRequest: avgTokens
        } as KeyUsageStats;
    }
} 