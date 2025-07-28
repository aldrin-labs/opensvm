import { UsageTracker } from '../../../lib/anthropic-proxy/tracking/UsageTracker';
import { UsageStorage, UsageLog } from '../../../lib/anthropic-proxy/storage/UsageStorage';
import { calculateSVMAICost } from '../../../lib/anthropic-proxy/utils/PricingCalculator';
import { ProxyResponse } from '../../../lib/anthropic-proxy/types/ProxyTypes';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../../lib/anthropic-proxy/storage/UsageStorage');
jest.mock('../../../lib/anthropic-proxy/utils/PricingCalculator', () => ({
    calculateSVMAICost: jest.fn(),
}));
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid'),
}));

const MockedUsageStorage = UsageStorage as jest.MockedClass<typeof UsageStorage>;
const mockCalculateSVMAICost = calculateSVMAICost as jest.Mock;

describe('UsageTracker', () => {
    let usageTracker: UsageTracker;
    let mockUsageStorage: jest.Mocked<UsageStorage>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUsageStorage = new MockedUsageStorage() as jest.Mocked<UsageStorage>;
        usageTracker = new UsageTracker();
        // Manually inject the mocked storage instance
        (usageTracker as any).usageStorage = mockUsageStorage;

        mockUsageStorage.initialize.mockResolvedValue(undefined);
        mockUsageStorage.logUsage.mockResolvedValue(undefined);
        mockCalculateSVMAICost.mockReturnValue(10);
    });

    it('should initialize the usage storage', async () => {
        await usageTracker.initialize();
        expect(mockUsageStorage.initialize).toHaveBeenCalledTimes(1);
    });

    describe('trackResponse', () => {
        it('should correctly extract and log usage for a successful response', async () => {
            const mockProxyResponse: ProxyResponse = {
                keyId: 'test-key-id',
                userId: 'test-user-id',
                anthropicResponse: {
                    id: 'msg_123',
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'text', text: 'hello' }],
                    model: 'claude-3-haiku-20240307',
                    stop_reason: 'end_turn',
                    usage: {
                        input_tokens: 10,
                        output_tokens: 20,
                    },
                },
                actualCost: 5, // This will be recalculated
                inputTokens: 0, // This will be recalculated
                outputTokens: 0, // This will be recalculated
                model: 'claude-3-haiku-20240307',
                success: true,
                timestamp: new Date(),
                responseTime: 150,
            };

            await usageTracker.trackResponse(mockProxyResponse);

            expect(mockCalculateSVMAICost).toHaveBeenCalledWith(
                'claude-3-haiku-20240307',
                10,
                20
            );

            const expectedUsageLog: UsageLog = {
                id: 'mock-uuid',
                keyId: 'test-key-id',
                userId: 'test-user-id',
                endpoint: '/v1/messages',
                model: 'claude-3-haiku-20240307',
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
                svmaiCost: 10, // Mocked value
                responseTime: 150,
                success: true,
                errorType: undefined,
                timestamp: expect.any(Date),
            };
            expect(mockUsageStorage.logUsage).toHaveBeenCalledWith(expectedUsageLog);
        });

        it('should correctly log usage for a failed response', async () => {
            const mockProxyResponse: ProxyResponse = {
                keyId: 'test-key-id-fail',
                userId: 'test-user-id-fail',
                anthropicResponse: null, // No response for failure
                actualCost: 0,
                inputTokens: 0,
                outputTokens: 0,
                model: 'claude-3-sonnet-20240229',
                success: false,
                timestamp: new Date(),
                responseTime: 50,
            };

            await usageTracker.trackResponse(mockProxyResponse);

            expect(mockCalculateSVMAICost).toHaveBeenCalledWith(
                'claude-3-sonnet-20240229',
                0,
                0
            );

            const expectedUsageLog: UsageLog = {
                id: 'mock-uuid',
                keyId: 'test-key-id-fail',
                userId: 'test-user-id-fail',
                endpoint: '/v1/messages',
                model: 'claude-3-sonnet-20240229',
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                svmaiCost: 10, // Mocked value (minimum charge might apply, but mock simplifies)
                responseTime: 50,
                success: false,
                errorType: 'anthropic_error',
                timestamp: expect.any(Date),
            };
            expect(mockUsageStorage.logUsage).toHaveBeenCalledWith(expectedUsageLog);
        });
    });

    describe('getKeyUsageStats', () => {
        it('should retrieve aggregated usage stats for a key', async () => {
            const mockKeyUsageStats = {
                totalRequests: 5,
                totalTokensConsumed: 100,
                totalSVMAISpent: 50,
                lastRequestAt: new Date(),
                averageTokensPerRequest: 20,
            };
            mockUsageStorage.aggregateKeyUsage.mockResolvedValue(mockKeyUsageStats);

            const stats = await usageTracker.getKeyUsageStats('some-key-id');
            expect(mockUsageStorage.aggregateKeyUsage).toHaveBeenCalledWith('some-key-id');
            expect(stats).toEqual(mockKeyUsageStats);
        });
    });

    describe('getUserUsageLogs', () => {
        it('should retrieve raw usage logs for a user', async () => {
            const mockUsageLogs: UsageLog[] = [
                // ... sample logs ...
                {
                    id: 'log1', keyId: 'k1', userId: 'u1', endpoint: '/v1/messages',
                    model: 'haiku', inputTokens: 5, outputTokens: 10, totalTokens: 15,
                    svmaiCost: 1.5, responseTime: 100, success: true, timestamp: new Date(),
                },
            ];
            mockUsageStorage.fetchUsageLogs.mockResolvedValue(mockUsageLogs);

            const logs = await usageTracker.getUserUsageLogs('some-user-id', 10, 0);
            expect(mockUsageStorage.fetchUsageLogs).toHaveBeenCalledWith({
                userId: 'some-user-id',
                limit: 10,
                offset: 0,
            });
            expect(logs).toEqual(mockUsageLogs);
        });
    });
}); 