import { SVMAIBalanceManager } from './SVMAIBalanceManager';
import { UsageTracker } from '../tracking/UsageTracker';
import { ProxyResponse, ProxyRequest } from '../types/ProxyTypes';

/**
 * Handles post-request SVMAI token deduction and billing.
 */
export class BillingProcessor {
    private balanceManager: SVMAIBalanceManager;
    private usageTracker: UsageTracker;

    constructor() {
        this.balanceManager = new SVMAIBalanceManager();
        this.usageTracker = new UsageTracker();
    }

    /**
     * Initialize required components.
     */
    async initialize(): Promise<void> {
        await this.balanceManager.initialize();
        await this.usageTracker.initialize();
    }

    /**
     * Processes a successful API response:
     * 1. Tracks usage.
     * 2. Deducts actual cost from user's balance.
     * 3. Releases any reserved balance for this request.
     *
     * @param proxyResponse The completed proxy response.
     */
    async processSuccessfulResponse(proxyResponse: ProxyResponse): Promise<void> {
        const { keyId, userId, actualCost, model } = proxyResponse;

        // 1. Track usage
        await this.usageTracker.trackResponse(proxyResponse);

        // 2. Deduct actual cost from user's balance
        // Assuming a method to deduct the final cost exists that also handles reserved amount
        await this.balanceManager.deductBalance(userId, actualCost, keyId, model);
    }

    /**
     * Processes a failed API response (e.g., Anthropic error, network issue):
     * 1. Logs the failure (optionally).
     * 2. Releases any reserved balance for this request.
     *    No deduction if request failed before token consumption.
     *
     * @param proxyResponse The failed proxy response.
     */
    async processFailedResponse(proxyResponse: ProxyResponse): Promise<void> {
        const { keyId, userId, model } = proxyResponse;

        // Log usage even for failed requests (e.g., 0 tokens used, but still a request)
        await this.usageTracker.trackResponse(proxyResponse);

        // Release any reserved balance for this request. 
        // The `deductBalance` method should handle this intelligently,
        // or a separate `releaseReservedBalance` method might be needed if no deduction occurs.
        // For now, assuming deductBalance with 0 cost for failed requests releases reservation.
        await this.balanceManager.releaseReservedBalance(userId, keyId, model);
    }

    /**
     * Reserve balance for a request
     */
    async reserveBalance(proxyRequest: ProxyRequest): Promise<void> {
        const { userId, estimatedCost, keyId, anthropicRequest } = proxyRequest;
        const success = await this.balanceManager.reserveBalance(userId, estimatedCost, keyId, anthropicRequest.model);
        if (!success) {
            throw new Error('Insufficient balance to reserve tokens.');
        }
    }
} 