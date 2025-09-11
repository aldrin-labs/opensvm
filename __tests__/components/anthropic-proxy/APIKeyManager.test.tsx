import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import APIKeyManager from '../../../components/anthropic-proxy/APIKeyManager';
import SVMAIDepositModal from '../../../components/anthropic-proxy/SVMAIDepositModal';
import BalanceDisplay from '../../../components/anthropic-proxy/BalanceDisplay';
import UsageDashboard from '../../../components/anthropic-proxy/UsageDashboard';
import IntegrationGuide from '../../../components/anthropic-proxy/IntegrationGuide';

// Mock external dependencies
jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}));

jest.mock('react-hot-toast', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('@/lib/settings', () => ({
    useSettings: jest.fn(() => ({
        font: 'Inter',
        theme: 'light'
    })),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuthContext: jest.fn(() => ({
        user: { id: 'test-user-id' },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
    })),
}));// Mock fetch for API calls
global.fetch = jest.fn();

describe('Anthropic Proxy UI Components', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockClear();
    });

    describe('APIKeyManager', () => {
        const mockApiKeys = [
            {
                keyId: 'key1',
                name: 'Test Key 1',
                keyPrefix: 'sk-ant-api03-test1...',
                createdAt: '2024-01-01T00:00:00Z',
                lastUsedAt: '2024-01-15T12:00:00Z',
                isActive: true,
                usageStats: {
                    totalRequests: 100,
                    totalTokensConsumed: 5000,
                    totalSVMAISpent: 25,
                    averageTokensPerRequest: 50,
                },
            },
        ];

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    data: { keys: mockApiKeys, total: 1 },
                }),
            });
        });

        it('renders API key list correctly', async () => {
            render(<APIKeyManager />);

            await waitFor(() => {
                expect(screen.getByText('Anthropic API Keys')).toBeInTheDocument();
                expect(screen.getByText('Test Key 1')).toBeInTheDocument();
                expect(screen.getByText('100')).toBeInTheDocument(); // Total requests
                expect(screen.getByText('5.0K')).toBeInTheDocument(); // Total tokens (formatted)
                expect(screen.getByText('25.0')).toBeInTheDocument(); // SVMAI spent
            });
        });

        it('creates new API key successfully', async () => {
            const newKeyResponse = {
                success: true,
                data: {
                    keyId: 'key2',
                    apiKey: 'sk-ant-api03-new-key-full',
                    keyPrefix: 'sk-ant-api03-new...',
                    name: 'New Test Key',
                    createdAt: '2024-01-16T00:00:00Z',
                },
            };

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true, data: { keys: mockApiKeys } }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => newKeyResponse,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true, data: { keys: [...mockApiKeys] } }),
                });

            render(<APIKeyManager />);

            await waitFor(() => {
                expect(screen.getByText('Create New API Key')).toBeInTheDocument();
            });

            // Fill in key name
            const nameInput = screen.getByPlaceholderText(/My App Integration/);
            fireEvent.change(nameInput, { target: { value: 'New Test Key' } });

            // Click create button
            const createButton = screen.getByText('Create Key');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith('/api/opensvm/anthropic-keys', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': 'current-user',
                    },
                    body: JSON.stringify({ name: 'New Test Key' }),
                });
            });
        });

        it('validates key name input', () => {
            render(<APIKeyManager />);

            const createButton = screen.getByText('Create Key');
            expect(createButton).toBeDisabled();

            const nameInput = screen.getByPlaceholderText(/My App Integration/);
            fireEvent.change(nameInput, { target: { value: 'Valid Name' } });

            expect(createButton).not.toBeDisabled();
        });

        it('deletes API key with confirmation', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true, data: { keys: mockApiKeys } }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true, data: { keys: [] } }),
                });

            // Mock window.confirm
            window.confirm = jest.fn(() => true);

            render(<APIKeyManager />);

            await waitFor(() => {
                expect(screen.getByText('Test Key 1')).toBeInTheDocument();
            });

            const deleteButton = screen.getByRole('button', { name: /delete/i });
            fireEvent.click(deleteButton);

            expect(window.confirm).toHaveBeenCalledWith(
                'Are you sure you want to delete the API key "Test Key 1"? This action cannot be undone.'
            );

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith('/api/opensvm/anthropic-keys/key1', {
                    method: 'DELETE',
                    headers: {
                        'x-user-id': 'current-user',
                    },
                });
            });
        });

        it('handles loading state', () => {
            render(<APIKeyManager />);

            // Should show loading skeleton
            expect(screen.getByTestId('loading-skeleton') || document.querySelector('.animate-pulse')).toBeInTheDocument();
        });

        it('displays integration guide correctly', async () => {
            render(<APIKeyManager />);

            await waitFor(() => {
                expect(screen.getByText('Integration Guide')).toBeInTheDocument();
                expect(screen.getByText(/Python \(anthropic library\)/)).toBeInTheDocument();
                expect(screen.getByText(/JavaScript \(@anthropic-ai\/sdk\)/)).toBeInTheDocument();
                expect(screen.getByText(/Claude CLI/)).toBeInTheDocument();
            });
        });
    });

    describe('SVMAIDepositModal', () => {
        const mockProps = {
            isOpen: true,
            onClose: jest.fn(),
            onDepositSuccess: jest.fn(),
        };

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        balance: {
                            available: 100,
                        },
                    },
                }),
            });
        });

        it('renders deposit modal correctly', async () => {
            render(<SVMAIDepositModal {...mockProps} />);

            expect(screen.getByText('Deposit SVMAI Tokens')).toBeInTheDocument();
            expect(screen.getByText('Deposit Amount (SVMAI)')).toBeInTheDocument();
            expect(screen.getByText('Quick Select')).toBeInTheDocument();
            expect(screen.getByText('Deposit Instructions')).toBeInTheDocument();
        });

        it('validates minimum deposit amount', () => {
            render(<SVMAIDepositModal {...mockProps} />);

            const amountInput = screen.getByPlaceholderText(/Enter amount/);
            const depositButton = screen.getByText('Initiate Deposit');

            // Test invalid amount
            fireEvent.change(amountInput, { target: { value: '5' } });
            expect(depositButton).toBeDisabled();

            // Test valid amount
            fireEvent.change(amountInput, { target: { value: '100' } });
            expect(depositButton).not.toBeDisabled();
        });

        it('selects quick amounts correctly', () => {
            render(<SVMAIDepositModal {...mockProps} />);

            const quickAmount = screen.getByText('1,000 SVMAI');
            fireEvent.click(quickAmount);

            const amountInput = screen.getByPlaceholderText(/Enter amount/) as HTMLInputElement;
            expect(amountInput.value).toBe('1000');
        });

        it('shows and hides QR code', () => {
            render(<SVMAIDepositModal {...mockProps} />);

            const qrButton = screen.getByRole('button', { name: /qr/i });
            fireEvent.click(qrButton);

            expect(screen.getByText('Scan to copy address')).toBeInTheDocument();
        });

        it('copies multisig address to clipboard', () => {
            const mockClipboard = {
                writeText: jest.fn(),
            };
            Object.assign(navigator, { clipboard: mockClipboard });

            render(<SVMAIDepositModal {...mockProps} />);

            const copyButton = screen.getAllByRole('button', { name: /copy/i })[0];
            fireEvent.click(copyButton);

            expect(mockClipboard.writeText).toHaveBeenCalledWith('A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP');
        });
    });

    describe('BalanceDisplay', () => {
        const mockBalanceData = {
            balance: {
                total: 1000,
                available: 800,
                reserved: 200,
                lastUpdated: '2024-01-15T12:00:00Z',
            },
            lifetime: {
                totalDeposited: 2000,
                totalSpent: 1000,
                netBalance: 1000,
            },
            monthly: {
                spending: 300,
                estimatedMonthlyBurn: 400,
                daysRemaining: 60,
            },
            warnings: {
                lowBalance: false,
                noBalance: false,
                highBurnRate: false,
            },
        };

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    data: mockBalanceData,
                }),
            });
        });

        it('renders compact variant correctly', async () => {
            render(<BalanceDisplay variant="compact" />);

            await waitFor(() => {
                expect(screen.getByText('800.0 SVMAI')).toBeInTheDocument();
            });
        });

        it('renders card variant with balance details', async () => {
            render(<BalanceDisplay variant="card" />);

            await waitFor(() => {
                expect(screen.getByText('SVMAI Balance')).toBeInTheDocument();
                expect(screen.getByText('800.0')).toBeInTheDocument();
                expect(screen.getByText('Monthly spent: 300.0')).toBeInTheDocument();
                expect(screen.getByText('Lifetime: 2.0K')).toBeInTheDocument();
            });
        });

        it('renders dashboard variant with full statistics', async () => {
            render(<BalanceDisplay variant="dashboard" />);

            await waitFor(() => {
                expect(screen.getByText('Available')).toBeInTheDocument();
                expect(screen.getByText('Reserved')).toBeInTheDocument();
                expect(screen.getByText('Total')).toBeInTheDocument();
                expect(screen.getByText('Monthly Spending')).toBeInTheDocument();
                expect(screen.getByText('Time Remaining')).toBeInTheDocument();
            });
        });

        it('shows low balance warning', async () => {
            const lowBalanceData = {
                ...mockBalanceData,
                balance: { ...mockBalanceData.balance, available: 5 },
                warnings: { ...mockBalanceData.warnings, lowBalance: true },
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({ success: true, data: lowBalanceData }),
            });

            render(<BalanceDisplay />);

            await waitFor(() => {
                expect(screen.getByText(/Low balance warning/)).toBeInTheDocument();
            });
        });

        it('refreshes balance on button click', async () => {
            render(<BalanceDisplay />);

            await waitFor(() => {
                expect(screen.getByText('SVMAI Balance')).toBeInTheDocument();
            });

            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            fireEvent.click(refreshButton);

            expect(global.fetch).toHaveBeenCalledTimes(2); // Initial load + refresh
        });
    });

    describe('UsageDashboard', () => {
        const mockUsageData = {
            period: 'week',
            summary: {
                totalRequests: 500,
                successfulRequests: 480,
                errorRequests: 20,
                errorRate: 4,
                totalTokensConsumed: 25000,
                totalSVMAISpent: 125,
                averageResponseTime: 1500,
            },
            tokenBreakdown: {
                inputTokens: 10000,
                outputTokens: 15000,
                averageTokensPerRequest: 50,
            },
            balance: {
                currentBalance: 875,
                availableBalance: 800,
                spentInPeriod: 125,
            },
            modelUsage: [
                { model: 'claude-3-haiku-20240307', tokens: 15000 },
                { model: 'claude-3-sonnet-20240229', tokens: 10000 },
            ],
            costBreakdown: [
                { model: 'claude-3-haiku-20240307', svmaiCost: 75 },
                { model: 'claude-3-sonnet-20240229', svmaiCost: 50 },
            ],
            dailyUsage: [
                { date: '2024-01-10', requests: 100, tokens: 5000, svmaiCost: 25 },
                { date: '2024-01-11', requests: 120, tokens: 6000, svmaiCost: 30 },
            ],
            apiKeys: {
                total: 3,
                active: 2,
                lastUsed: 'Development Key',
            },
            insights: [
                {
                    type: 'success' as const,
                    category: 'error_rate',
                    title: 'Excellent Error Rate',
                    description: 'Your error rate is very low at 4.0%.',
                    recommendation: 'Keep up the good work with request formatting!',
                },
            ],
        };

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    data: mockUsageData,
                }),
            });
        });

        it('renders usage analytics correctly', async () => {
            render(<UsageDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
                expect(screen.getByText('500')).toBeInTheDocument(); // Total requests
                expect(screen.getByText('25.0K')).toBeInTheDocument(); // Total tokens
                expect(screen.getByText('125.0')).toBeInTheDocument(); // SVMAI spent
                expect(screen.getByText('1.5s')).toBeInTheDocument(); // Response time
            });
        });

        it('filters by time period', async () => {
            render(<UsageDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
            });

            const periodSelect = screen.getByRole('combobox');
            fireEvent.click(periodSelect);

            const monthOption = screen.getByText('Last Month');
            fireEvent.click(monthOption);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith('/api/opensvm/usage?period=month', {
                    headers: { 'x-user-id': 'current-user' },
                });
            });
        });

        it('exports usage data', async () => {
            const mockCreateObjectURL = jest.fn();
            const mockRevokeObjectURL = jest.fn();
            global.URL.createObjectURL = mockCreateObjectURL;
            global.URL.revokeObjectURL = mockRevokeObjectURL;

            render(<UsageDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
            });

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            expect(mockCreateObjectURL).toHaveBeenCalled();
        });

        it('displays model usage breakdown', async () => {
            render(<UsageDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Model Usage')).toBeInTheDocument();
                expect(screen.getByText('haiku')).toBeInTheDocument();
                expect(screen.getByText('sonnet')).toBeInTheDocument();
            });
        });

        it('shows insights and recommendations', async () => {
            render(<UsageDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Insights & Recommendations')).toBeInTheDocument();
                expect(screen.getByText('Excellent Error Rate')).toBeInTheDocument();
                expect(screen.getByText('Keep up the good work with request formatting!')).toBeInTheDocument();
            });
        });
    });

    describe('IntegrationGuide', () => {
        it('renders integration guide with tabs', () => {
            render(<IntegrationGuide />);

            expect(screen.getByText('Integration Guide')).toBeInTheDocument();
            expect(screen.getByText('Python')).toBeInTheDocument();
            expect(screen.getByText('JavaScript')).toBeInTheDocument();
            expect(screen.getByText('CLI')).toBeInTheDocument();
            expect(screen.getByText('cURL')).toBeInTheDocument();
        });

        it('switches between tabs correctly', () => {
            render(<IntegrationGuide />);

            // Default to Python tab
            expect(screen.getByText('Python SDK Integration')).toBeInTheDocument();

            // Switch to JavaScript tab
            const jsTab = screen.getByText('JavaScript');
            fireEvent.click(jsTab);
            expect(screen.getAllByText('JavaScript/TypeScript SDK')[0]).toBeInTheDocument();

            // Switch to CLI tab
            const cliTab = screen.getByText('CLI');
            fireEvent.click(cliTab);
            expect(screen.getByText('Claude CLI')).toBeInTheDocument();
        });

        it('copies code examples to clipboard', () => {
            const mockClipboard = {
                writeText: jest.fn(),
            };
            Object.assign(navigator, { clipboard: mockClipboard });

            render(<IntegrationGuide />);

            const copyButton = screen.getAllByRole('button', { name: /copy/i })[0];
            fireEvent.click(copyButton);

            expect(mockClipboard.writeText).toHaveBeenCalled();
        });

        it('shows API key in examples when provided', () => {
            const testApiKey = 'sk-ant-api03-test-key-123';
            render(<IntegrationGuide apiKey={testApiKey} />);

            expect(screen.getByText(/sk-ant-api03-test/)).toBeInTheDocument();
        });

        it('displays troubleshooting section', () => {
            render(<IntegrationGuide />);

            expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
            expect(screen.getByText('Authentication Error (401)')).toBeInTheDocument();
            expect(screen.getByText('Payment Required (402)')).toBeInTheDocument();
            expect(screen.getByText('Rate Limit Error (429)')).toBeInTheDocument();
        });

        it('shows best practices', () => {
            render(<IntegrationGuide />);

            expect(screen.getByText('Best Practices')).toBeInTheDocument();
            expect(screen.getByText('Use environment variables for API keys')).toBeInTheDocument();
            expect(screen.getByText("Don't hardcode API keys in your source code")).toBeInTheDocument();
        });
    });
}); 