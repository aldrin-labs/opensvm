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

        // 2. Log model-specific billing information
        console.log(`Processing successful billing for model: ${model}, user: ${userId}, cost: ${actualCost}`);

        // 3. Consume reserved balance with actual cost
        // We need to pass the reserved amount and actual amount - using estimatedCost as reserved amount
        const estimatedCost = proxyResponse.inputTokens + proxyResponse.outputTokens; // Approximate reserved amount
        await this.balanceManager.consumeReservedBalance(userId, estimatedCost, actualCost, keyId);
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

        // Log model-specific failure information
        console.log(`Processing failed billing for model: ${model}, user: ${userId}, releasing reserved balance`);

        // Release any reserved balance for this request. 
        // We need to estimate how much was reserved and release it
        const estimatedReservedAmount = proxyResponse.inputTokens + proxyResponse.outputTokens; // Approximate reserved amount
        await this.balanceManager.releaseReservedBalance(userId, estimatedReservedAmount, keyId);
    }

    /**
     * Reserve balance for a request
     */
    async reserveBalance(proxyRequest: ProxyRequest): Promise<void> {
        const { userId, estimatedCost, keyId, anthropicRequest } = proxyRequest;

        // Log request-specific information for billing audit
        console.log(`Reserving balance for user: ${userId}, model: ${anthropicRequest.model}, estimated cost: ${estimatedCost}`);
        console.log(`Request details - max_tokens: ${anthropicRequest.max_tokens}, messages: ${anthropicRequest.messages.length}`);

        const success = await this.balanceManager.reserveBalance(userId, estimatedCost, keyId);
        if (!success) {
            throw new Error(`Insufficient balance to reserve ${estimatedCost} tokens for ${anthropicRequest.model} request.`);
        }

        console.log(`Successfully reserved ${estimatedCost} tokens for user ${userId} using ${anthropicRequest.model}`);
    }
} 