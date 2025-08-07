import { UsageReporter, UserUsageReport } from '../../../lib/anthropic-proxy/reporting/UsageReporter';
import { UsageStorage, UsageLog } from '../../../lib/anthropic-proxy/storage/UsageStorage';
import { SVMAIBalanceManager } from '../../../lib/anthropic-proxy/billing/SVMAIBalanceManager';
import { UserBalance, KeyUsageStats } from '../../../lib/anthropic-proxy/types/ProxyTypes';

// Mock dependencies
jest.mock('../../../lib/anthropic-proxy/storage/UsageStorage');
jest.mock('../../../lib/anthropic-proxy/billing/SVMAIBalanceManager');

// Mock the pricing calculator to use test values that match exactly
jest.mock('../../../lib/anthropic-proxy/utils/PricingCalculator', () => ({
    calculateSVMAICost: jest.fn((model: string, inputTokens: number, outputTokens: number) => {
        // Return specific costs that match the test logs exactly
        const totalTokens = inputTokens + outputTokens;
        
        // Map specific token amounts to expected costs based on test data
        switch (totalTokens) {
            case 30: return 3; // haiku test log 1 (10+20=30 tokens -> 3 cost)
            case 40: return 4; // sonnet test log 2 (15+25=40 tokens -> 4 cost)
            case 15: return 2; // haiku test log 3 (5+10=15 tokens -> 2 cost)
            case 50: return 6; // opus test log 4 (20+30=50 tokens -> 6 cost)
            case 20: return 2; // period test logs (10+10=20 tokens -> 2 cost)
            default: return 1; // fallback
        }
    })
}));

const MockedUsageStorage = UsageStorage as jest.MockedClass<typeof UsageStorage>;
const MockedSVMAIBalanceManager = SVMAIBalanceManager as jest.MockedClass<typeof SVMAIBalanceManager>;

describe('UsageReporter', () => {
    let usageReporter: UsageReporter;
    let mockUsageStorage: jest.Mocked<UsageStorage>;
    let mockBalanceManager: jest.Mocked<SVMAIBalanceManager>;

    const mockUserId = 'user123';
    const mockKeyId = 'key456';

    const createMockLog = (date: Date, input: number, output: number, cost: number, success: boolean, model: string = 'claude-3-haiku-20240307', responseTime: number = 100): UsageLog => ({
        id: `log-${Math.random()}`,
        keyId: mockKeyId,
        userId: mockUserId,
        endpoint: '/v1/messages',
        model,
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output,
        svmaiCost: cost,
        responseTime,
        success,
        errorType: success ? undefined : 'anthropic_error',
        timestamp: date,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockUsageStorage = new MockedUsageStorage() as jest.Mocked<UsageStorage>;
        mockBalanceManager = new MockedSVMAIBalanceManager() as jest.Mocked<SVMAIBalanceManager>;

        usageReporter = new UsageReporter();
        (usageReporter as any).usageStorage = mockUsageStorage;
        (usageReporter as any).balanceManager = mockBalanceManager;

        mockUsageStorage.initialize.mockResolvedValue(undefined);
        mockBalanceManager.initialize.mockResolvedValue(undefined);

        mockBalanceManager.getBalance.mockResolvedValue({
            userId: mockUserId,
            svmaiBalance: 500,
            reservedBalance: 0,
            availableBalance: 500,
            totalDeposited: 1000,
            totalSpent: 500,
            lastUpdated: new Date(),
        });
    });

    it('should initialize its dependencies', async () => {
        await usageReporter.initialize();
        expect(mockUsageStorage.initialize).toHaveBeenCalledTimes(1);
        expect(mockBalanceManager.initialize).toHaveBeenCalledTimes(1);
    });

    describe('getUserUsageReport', () => {
        it('should generate a comprehensive report for all time', async () => {
            const logs: UsageLog[] = [
                createMockLog(new Date('2024-03-01T10:00:00Z'), 10, 20, 3, true, 'claude-3-haiku-20240307', 150),
                createMockLog(new Date('2024-03-01T11:00:00Z'), 15, 25, 4, true, 'claude-3-sonnet-20240229', 200),
                createMockLog(new Date('2024-03-02T12:00:00Z'), 5, 10, 2, false, 'claude-3-haiku-20240307', 50),
                createMockLog(new Date('2024-03-03T13:00:00Z'), 20, 30, 6, true, 'claude-3-opus-20240229', 300),
            ];
            mockUsageStorage.fetchUsageLogs.mockResolvedValue(logs);

            const report = await usageReporter.getUserUsageReport(mockUserId);

            expect(mockUsageStorage.fetchUsageLogs).toHaveBeenCalledWith({ userId: mockUserId, limit: 10000 });
            expect(report.userId).toBe(mockUserId);
            expect(report.totalRequests).toBe(4);
            expect(report.successfulRequests).toBe(3);
            expect(report.errorRequests).toBe(1);
            expect(report.errorRate).toBe(25); // 1 error out of 4 requests
            expect(report.totalInputTokens).toBe(50);
            expect(report.totalOutputTokens).toBe(85);
            expect(report.totalTokensConsumed).toBe(135);
            expect(report.totalSVMAISpent).toBe(15);
            expect(report.averageResponseTime).toBe(700 / 4); // (150+200+50+300)/4 = 175
            expect(report.currentSVMAIBalance).toBe(500);
            expect(report.availableSVMAIBalance).toBe(500);
            expect(report.topModels).toEqual([
                { model: 'claude-3-haiku-20240307', tokens: 30 + 15 }, // 45
                { model: 'claude-3-opus-20240229', tokens: 50 },
                { model: 'claude-3-sonnet-20240229', tokens: 40 },
            ].sort((a, b) => b.tokens - a.tokens));
            expect(report.costBreakdownByModel).toEqual([
                { model: 'claude-3-haiku-20240307', svmaiCost: 3 + 2 }, // 5
                { model: 'claude-3-sonnet-20240229', svmaiCost: 4 },
                { model: 'claude-3-opus-20240229', svmaiCost: 6 },
            ]);
            expect(report.dailyUsage.length).toBe(3);
        });

        it('should filter logs by "day" period', async () => {
            const now = new Date();
            const logs: UsageLog[] = [
                createMockLog(new Date(now.getTime() - 1000 * 60 * 60 * 2), 10, 10, 2, true), // 2 hours ago
                createMockLog(new Date(now.getTime() - 1000 * 60 * 60 * 25), 10, 10, 2, true), // 25 hours ago (should be excluded)
            ];
            mockUsageStorage.fetchUsageLogs.mockResolvedValue(logs);

            const report = await usageReporter.getUserUsageReport(mockUserId, 'day');
            expect(report.totalRequests).toBe(1);
            expect(report.totalTokensConsumed).toBe(20);
            expect(report.totalSVMAISpent).toBe(2);
        });

        it('should filter logs by "week" period', async () => {
            const now = new Date();
            const logs: UsageLog[] = [
                createMockLog(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3), 10, 10, 2, true), // 3 days ago
                createMockLog(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 8), 10, 10, 2, true), // 8 days ago (should be excluded)
            ];
            mockUsageStorage.fetchUsageLogs.mockResolvedValue(logs);

            const report = await usageReporter.getUserUsageReport(mockUserId, 'week');
            expect(report.totalRequests).toBe(1);
            expect(report.totalTokensConsumed).toBe(20);
            expect(report.totalSVMAISpent).toBe(2);
        });

        it('should filter logs by "month" period', async () => {
            const now = new Date();
            const logs: UsageLog[] = [
                createMockLog(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 15), 10, 10, 2, true), // 15 days ago
                createMockLog(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 35), 10, 10, 2, true), // 35 days ago (should be excluded)
            ];
            mockUsageStorage.fetchUsageLogs.mockResolvedValue(logs);

            const report = await usageReporter.getUserUsageReport(mockUserId, 'month');
            expect(report.totalRequests).toBe(1);
            expect(report.totalTokensConsumed).toBe(20);
            expect(report.totalSVMAISpent).toBe(2);
        });
    });

    describe('getKeyUsageStats', () => {
        it('should retrieve aggregated key usage stats', async () => {
            const mockKeyUsageStats: KeyUsageStats = {
                totalRequests: 10,
                totalTokensConsumed: 500,
                totalSVMAISpent: 75,
                lastRequestAt: new Date(),
                averageTokensPerRequest: 50,
            };
            mockUsageStorage.aggregateKeyUsage.mockResolvedValue(mockKeyUsageStats);

            const stats = await usageReporter.getKeyUsageStats(mockKeyId);

            expect(mockUsageStorage.aggregateKeyUsage).toHaveBeenCalledWith(mockKeyId);
            expect(stats).toEqual(mockKeyUsageStats);
        });
    });
}); 