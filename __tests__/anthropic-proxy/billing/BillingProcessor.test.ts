import { BillingProcessor } from '../../../lib/anthropic-proxy/billing/BillingProcessor';
import { SVMAIBalanceManager } from '../../../lib/anthropic-proxy/billing/SVMAIBalanceManager';
import { UsageTracker } from '../../../lib/anthropic-proxy/tracking/UsageTracker';
import { ProxyRequest, ProxyResponse, AnthropicResponse } from '../../../lib/anthropic-proxy/types/ProxyTypes';

// Mock dependencies
jest.mock('../../../lib/anthropic-proxy/billing/SVMAIBalanceManager');
jest.mock('../../../lib/anthropic-proxy/tracking/UsageTracker');

const MockedSVMAIBalanceManager = SVMAIBalanceManager as jest.MockedClass<typeof SVMAIBalanceManager>;
const MockedUsageTracker = UsageTracker as jest.MockedClass<typeof UsageTracker>;

describe('BillingProcessor', () => {
    let billingProcessor: BillingProcessor;
    let mockBalanceManager: jest.Mocked<SVMAIBalanceManager>;
    let mockUsageTracker: jest.Mocked<UsageTracker>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create proper mock objects with all required methods
        mockBalanceManager = {
            initialize: jest.fn().mockResolvedValue(undefined),
            consumeReservedBalance: jest.fn().mockResolvedValue(undefined),
            releaseReservedBalance: jest.fn().mockResolvedValue(undefined),
            reserveBalance: jest.fn().mockResolvedValue(true),
            getBalance: jest.fn().mockResolvedValue(1000),
            hasSufficientBalance: jest.fn().mockResolvedValue(true),
        } as any;

        mockUsageTracker = {
            initialize: jest.fn().mockResolvedValue(undefined),
            trackResponse: jest.fn().mockResolvedValue(undefined),
            trackRequest: jest.fn().mockResolvedValue(undefined),
            incrementUsage: jest.fn().mockResolvedValue(undefined),
        } as any;

        billingProcessor = new BillingProcessor();
        // Manually inject the mocked instances
        (billingProcessor as any).balanceManager = mockBalanceManager;
        (billingProcessor as any).usageTracker = mockUsageTracker;
    });

    it('should initialize both balance manager and usage tracker', async () => {
        await billingProcessor.initialize();
        expect(mockBalanceManager.initialize).toHaveBeenCalledTimes(1);
        expect(mockUsageTracker.initialize).toHaveBeenCalledTimes(1);
    });

    describe('processSuccessfulResponse', () => {
        const mockAnthropicResponse: AnthropicResponse = {
            id: 'msg_success',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Response' }],
            model: 'claude-3-haiku-20240307',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
        };

        const mockProxyResponse: ProxyResponse = {
            keyId: 'key1',
            userId: 'user1',
            anthropicResponse: mockAnthropicResponse,
            actualCost: 50, // This is the final calculated cost
            inputTokens: 10,
            outputTokens: 20,
            model: 'claude-3-haiku-20240307',
            success: true,
            timestamp: new Date(),
            responseTime: 100,
        };

        it('should track usage and consume reserved balance for a successful response', async () => {
            await billingProcessor.processSuccessfulResponse(mockProxyResponse);

            expect(mockUsageTracker.trackResponse).toHaveBeenCalledWith(mockProxyResponse);
            // Implementation calls consumeReservedBalance with estimated cost and actual cost
            const expectedEstimatedCost = mockProxyResponse.inputTokens + mockProxyResponse.outputTokens; // 10 + 20 = 30
            expect(mockBalanceManager.consumeReservedBalance).toHaveBeenCalledWith(
                mockProxyResponse.userId,
                expectedEstimatedCost,
                mockProxyResponse.actualCost,
                mockProxyResponse.keyId
            );
        });
    });

    describe('processFailedResponse', () => {
        const mockProxyResponse: ProxyResponse = {
            keyId: 'key2',
            userId: 'user2',
            anthropicResponse: null, // Indicates a failed request before full response
            actualCost: 0, // No cost for failed request
            inputTokens: 0,
            outputTokens: 0,
            model: 'claude-3-sonnet-20240229',
            success: false,
            timestamp: new Date(),
            responseTime: 50,
        };

        it('should track usage and release reserved balance for a failed response', async () => {
            await billingProcessor.processFailedResponse(mockProxyResponse);

            expect(mockUsageTracker.trackResponse).toHaveBeenCalledWith(mockProxyResponse);
            // Implementation calls releaseReservedBalance with estimated amount
            const expectedEstimatedAmount = mockProxyResponse.inputTokens + mockProxyResponse.outputTokens; // 0 + 0 = 0
            expect(mockBalanceManager.releaseReservedBalance).toHaveBeenCalledWith(
                mockProxyResponse.userId,
                expectedEstimatedAmount,
                mockProxyResponse.keyId
            );
        });
    });

    describe('reserveBalance', () => {
        const mockProxyRequest: ProxyRequest = {
            keyId: 'key3',
            userId: 'user3',
            anthropicRequest: {
                model: 'claude-3-opus-20240229',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'hi' }],
            },
            estimatedCost: 75,
            timestamp: new Date(),
        };

        it('should reserve balance for a valid request', async () => {
            await billingProcessor.reserveBalance(mockProxyRequest);

            expect(mockBalanceManager.reserveBalance).toHaveBeenCalledWith(
                mockProxyRequest.userId,
                mockProxyRequest.estimatedCost,
                mockProxyRequest.keyId
            );
        });

        it('should throw an error if balance reservation fails', async () => {
            mockBalanceManager.reserveBalance.mockResolvedValue(false);

            await expect(billingProcessor.reserveBalance(mockProxyRequest)).rejects.toThrow(
                'Insufficient balance to reserve 75 tokens for claude-3-opus-20240229 request.'
            );
        });
    });
}); 