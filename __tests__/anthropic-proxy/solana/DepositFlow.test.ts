import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { jest } from '@jest/globals';
import { DepositMonitor, MonitoringConfig } from '../../../lib/anthropic-proxy/solana/DepositMonitor';
import { MultisigManager, MultisigConfig } from '../../../lib/anthropic-proxy/solana/MultisigManager';
import { TransactionProcessor, ProcessingResult } from '../../../lib/anthropic-proxy/solana/TransactionProcessor';
import {
    validateSolanaAddress,
    parseTokenTransfer,
    formatSolanaAmount,
    shortenSolanaAddress,
    generateUserIdFromAddress,
    SOLANA_CONSTANTS
} from '../../../lib/anthropic-proxy/utils/SolanaUtils';

// Mock external dependencies
jest.mock('@solana/web3.js');
jest.mock('@solana/spl-token');
jest.mock('../../../lib/anthropic-proxy/billing/SVMAIBalanceManager');
jest.mock('../../../lib/anthropic-proxy/storage/BalanceStorage');

const MockedConnection = Connection as jest.MockedClass<typeof Connection>;

describe('Solana Deposit Flow Integration Tests', () => {
    let mockConnection: jest.Mocked<Connection>;
    let depositMonitor: DepositMonitor;
    let multisigManager: MultisigManager;
    let transactionProcessor: TransactionProcessor;

    const testConfig: MonitoringConfig = {
        rpcEndpoint: 'https://api.devnet.solana.com',
        multisigAddress: 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP',
        svmaiMintAddress: 'SVMAI_TEST_MINT_ADDRESS',
        pollInterval: 5000,
        confirmationRequirement: 1,
        batchSize: 10,
        maxRetries: 3,
    };

    const mockTransaction: ParsedTransactionWithMeta = {
        slot: 123456789,
        blockTime: 1640995200,
        transaction: {
            message: {
                accountKeys: [
                    { pubkey: new PublicKey('sender123'), signer: true, writable: true },
                    { pubkey: new PublicKey('A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'), signer: false, writable: true },
                ],
                instructions: [
                    {
                        program: 'spl-token',
                        programId: new PublicKey(SOLANA_CONSTANTS.TOKEN_PROGRAM_ID),
                        parsed: {
                            type: 'transferChecked',
                            info: {
                                source: 'source_token_account_123',
                                destination: 'dest_token_account_456',
                                mint: 'SVMAI_TEST_MINT_ADDRESS',
                                authority: 'sender123',
                                tokenAmount: {
                                    uiAmount: 1000,
                                    decimals: 6,
                                    amount: '1000000000',
                                },
                            },
                        },
                    },
                ],
                recentBlockhash: 'blockhash123',
            },
            signatures: ['signature123'],
        },
        meta: {
            err: null,
            fee: 5000,
            preBalances: [1000000000, 0],
            postBalances: [999995000, 5000],
            preTokenBalances: [],
            postTokenBalances: [],
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Connection
        mockConnection = {
            getAccountInfo: jest.fn(),
            getBalance: jest.fn(),
            getSignaturesForAddress: jest.fn(),
            getParsedTransaction: jest.fn(),
            getParsedTokenAccountsByOwner: jest.fn(),
        } as any;

        MockedConnection.mockImplementation(() => mockConnection);

        // Initialize components
        depositMonitor = new DepositMonitor(testConfig);
        multisigManager = new MultisigManager(testConfig.rpcEndpoint);
        transactionProcessor = new TransactionProcessor(testConfig.rpcEndpoint);
    });

    describe('SolanaUtils', () => {
        describe('address validation', () => {
            it('validates correct Solana addresses', () => {
                const validAddress = 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP';
                expect(validateSolanaAddress(validAddress)).toBe(true);
            });

            it('rejects invalid Solana addresses', () => {
                const invalidAddress = 'invalid_address';
                expect(validateSolanaAddress(invalidAddress)).toBe(false);
            });

            it('shortens addresses correctly', () => {
                const address = 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP';
                const shortened = shortenSolanaAddress(address, 4);
                expect(shortened).toBe('A7X8...mNoP');
            });
        });

        describe('amount formatting', () => {
            it('formats Solana amounts correctly', () => {
                const amount = 1000000000; // 1 SOL in lamports
                const formatted = formatSolanaAmount(amount, 9);
                expect(formatted).toBe('1.000000000');
            });

            it('generates deterministic user IDs', () => {
                const address = 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP';
                const userId1 = generateUserIdFromAddress(address);
                const userId2 = generateUserIdFromAddress(address);
                expect(userId1).toBe(userId2);
                expect(userId1).toMatch(/^user_[a-z0-9]+$/);
            });
        });

        describe('token transfer parsing', () => {
            it('parses token transfers from transaction', () => {
                const transfers = parseTokenTransfer(mockTransaction);
                expect(transfers).toHaveLength(1);
                expect(transfers[0]).toMatchObject({
                    from: 'source_token_account_123',
                    to: 'dest_token_account_456',
                    amount: 1000,
                    mint: 'SVMAI_TEST_MINT_ADDRESS',
                });
            });

            it('filters transfers by mint address', () => {
                const transfers = parseTokenTransfer(mockTransaction, 'OTHER_MINT');
                expect(transfers).toHaveLength(0);
            });
        });
    });

    describe('MultisigManager', () => {
        beforeEach(async () => {
            mockConnection.getAccountInfo.mockResolvedValue({
                data: Buffer.alloc(0),
                executable: false,
                lamports: 1000000,
                owner: new PublicKey(SOLANA_CONSTANTS.SYSTEM_PROGRAM_ID),
                rentEpoch: 0,
            });

            await multisigManager.initialize();
        });

        it('creates multisig configuration', async () => {
            const signers = [
                'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP',
                'B8Y9nOzF4RrK0QeL3sG7vW9xUz2nBdEfGhJkMnOp',
                'C9Z0pAqG5SsL1ReM4tH8wX0yVa3oCfFhIjKlNpQr',
            ];

            const config = await multisigManager.createMultisigConfig(
                signers,
                2,
                'deposits',
                { name: 'Test Deposit Wallet' }
            );

            expect(config.threshold).toBe(2);
            expect(config.signers).toEqual(signers);
            expect(config.purpose).toBe('deposits');
            expect(config.isActive).toBe(true);
        });

        it('validates threshold requirements', async () => {
            const signers = ['A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'];

            await expect(
                multisigManager.createMultisigConfig(signers, 2, 'deposits')
            ).rejects.toThrow('Invalid threshold');
        });

        it('gets primary deposit address', async () => {
            const depositAddress = multisigManager.getPrimaryDepositAddress();
            expect(depositAddress).toBeDefined();
            expect(validateSolanaAddress(depositAddress!)).toBe(true);
        });

        it('manages signers correctly', async () => {
            const config = multisigManager.getMultisigConfig(testConfig.multisigAddress);
            if (config) {
                const initialSignerCount = config.signers.length;

                await multisigManager.addSigner(
                    testConfig.multisigAddress,
                    'NewSigner123',
                    'New Signer',
                    'operator'
                );

                const updatedConfig = multisigManager.getMultisigConfig(testConfig.multisigAddress);
                expect(updatedConfig?.signers).toHaveLength(initialSignerCount + 1);
            }
        });

        it('verifies multisig on-chain', async () => {
            mockConnection.getAccountInfo.mockResolvedValue({
                data: Buffer.alloc(0),
                executable: false,
                lamports: 1000000,
                owner: new PublicKey(SOLANA_CONSTANTS.SYSTEM_PROGRAM_ID),
                rentEpoch: 0,
            });

            mockConnection.getBalance.mockResolvedValue(1000000);

            const verification = await multisigManager.verifyMultisigOnChain(testConfig.multisigAddress);

            expect(verification.exists).toBe(true);
            expect(verification.balance).toBe(1000000);
            expect(verification.owner).toBe(SOLANA_CONSTANTS.SYSTEM_PROGRAM_ID);
        });
    });

    describe('TransactionProcessor', () => {
        beforeEach(async () => {
            await transactionProcessor.initialize();
        });

        it('processes valid deposit transaction', async () => {
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            const result = await transactionProcessor.processDeposit('signature123');

            expect(result.success).toBe(true);
            expect(result.transactionSignature).toBe('signature123');
            expect(result.amount).toBe(1000);
            expect(result.userId).toBeDefined();
        });

        it('rejects already processed transactions', async () => {
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            // Process transaction first time
            await transactionProcessor.processDeposit('signature123');

            // Attempt to process again
            const result = await transactionProcessor.processDeposit('signature123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Transaction already processed');
            expect(result.retryable).toBe(false);
        });

        it('handles transaction not found', async () => {
            mockConnection.getParsedTransaction.mockResolvedValue(null);

            const result = await transactionProcessor.processDeposit('nonexistent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Transaction not found');
            expect(result.retryable).toBe(true);
        });

        it('validates minimum deposit amount', async () => {
            const lowAmountTransaction = {
                ...mockTransaction,
                transaction: {
                    ...mockTransaction.transaction,
                    message: {
                        ...mockTransaction.transaction.message,
                        instructions: [
                            {
                                ...mockTransaction.transaction.message.instructions[0],
                                parsed: {
                                    type: 'transferChecked',
                                    info: {
                                        ...mockTransaction.transaction.message.instructions[0].parsed.info,
                                        tokenAmount: {
                                            uiAmount: 5, // Below minimum
                                            decimals: 6,
                                            amount: '5000000',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            };

            mockConnection.getParsedTransaction.mockResolvedValue(lowAmountTransaction);

            const result = await transactionProcessor.processDeposit('signature123');

            expect(result.success).toBe(false);
            expect(result.error).toContain('below minimum');
        });

        it('processes batch transactions', async () => {
            const signatures = ['sig1', 'sig2', 'sig3'];

            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            const results = await transactionProcessor.processBatch(signatures);

            expect(results).toHaveLength(3);
            expect(results.every(r => r.success)).toBe(true);
        });

        it('provides processing statistics', () => {
            const stats = transactionProcessor.getProcessingStats();

            expect(stats).toHaveProperty('processedCount');
            expect(stats).toHaveProperty('queuedCount');
            expect(stats).toHaveProperty('failedCount');
            expect(typeof stats.processedCount).toBe('number');
        });
    });

    describe('DepositMonitor', () => {
        beforeEach(async () => {
            mockConnection.getAccountInfo.mockResolvedValue({
                data: Buffer.alloc(0),
                executable: false,
                lamports: 1000000,
                owner: new PublicKey(SOLANA_CONSTANTS.SYSTEM_PROGRAM_ID),
                rentEpoch: 0,
            });

            await depositMonitor.initialize();
        });

        it('initializes correctly', async () => {
            expect(mockConnection.getAccountInfo).toHaveBeenCalledWith(
                expect.any(PublicKey)
            );
        });

        it('starts and stops monitoring', async () => {
            mockConnection.getSignaturesForAddress.mockResolvedValue([]);

            await depositMonitor.startMonitoring();
            const status = depositMonitor.getMonitoringStatus();
            expect(status.isMonitoring).toBe(true);

            depositMonitor.stopMonitoring();
            const stoppedStatus = depositMonitor.getMonitoringStatus();
            expect(stoppedStatus.isMonitoring).toBe(false);
        });

        it('processes new deposits', async () => {
            const mockSignatures = [
                {
                    signature: 'sig1',
                    slot: 123456789,
                    err: null,
                    memo: null,
                    blockTime: 1640995200,
                },
            ];

            mockConnection.getSignaturesForAddress.mockResolvedValue(mockSignatures);
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            await depositMonitor.startMonitoring();

            // Wait a bit for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            const status = depositMonitor.getMonitoringStatus();
            expect(status.lastProcessedSignature).toBeDefined();
        });

        it('manually processes transactions', async () => {
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            const result = await depositMonitor.manuallyProcessTransaction('signature123');
            expect(result).toBe(true);
        });

        it('provides monitoring status', () => {
            const status = depositMonitor.getMonitoringStatus();

            expect(status).toHaveProperty('isMonitoring');
            expect(status).toHaveProperty('lastProcessedSignature');
            expect(status).toHaveProperty('multisigAddress');
            expect(status).toHaveProperty('svmaiMintAddress');
            expect(status.multisigAddress).toBe(testConfig.multisigAddress);
        });
    });

    describe('End-to-End Deposit Flow', () => {
        it('completes full deposit flow', async () => {
            // Setup mocks
            mockConnection.getAccountInfo.mockResolvedValue({
                data: Buffer.alloc(0),
                executable: false,
                lamports: 1000000,
                owner: new PublicKey(SOLANA_CONSTANTS.SYSTEM_PROGRAM_ID),
                rentEpoch: 0,
            });

            mockConnection.getSignaturesForAddress.mockResolvedValue([
                {
                    signature: 'deposit_signature_123',
                    slot: 123456789,
                    err: null,
                    memo: null,
                    blockTime: 1640995200,
                },
            ]);

            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            // Initialize all components
            await Promise.all([
                depositMonitor.initialize(),
                multisigManager.initialize(),
                transactionProcessor.initialize(),
            ]);

            // Start monitoring
            await depositMonitor.startMonitoring();

            // Manually trigger processing of a deposit
            const result = await transactionProcessor.processDeposit('deposit_signature_123');

            // Verify the full flow worked
            expect(result.success).toBe(true);
            expect(result.amount).toBe(1000);
            expect(result.userId).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.newBalance).toBeDefined();

            // Verify monitoring status
            const monitorStatus = depositMonitor.getMonitoringStatus();
            expect(monitorStatus.isMonitoring).toBe(true);

            // Verify multisig configuration
            const multisigConfig = multisigManager.getMultisigConfig(testConfig.multisigAddress);
            expect(multisigConfig).toBeDefined();
            expect(multisigConfig?.purpose).toBe('deposits');

            // Stop monitoring
            depositMonitor.stopMonitoring();
        });

        it('handles error scenarios gracefully', async () => {
            // Mock error conditions
            mockConnection.getParsedTransaction.mockRejectedValue(new Error('RPC Error'));

            await transactionProcessor.initialize();

            const result = await transactionProcessor.processDeposit('error_signature');

            expect(result.success).toBe(false);
            expect(result.error).toContain('RPC Error');
            expect(result.retryable).toBe(true);
        });

        it('prevents duplicate processing', async () => {
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            await transactionProcessor.initialize();

            // Process transaction twice
            const result1 = await transactionProcessor.processDeposit('dup_signature');
            const result2 = await transactionProcessor.processDeposit('dup_signature');

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
            expect(result2.error).toBe('Transaction already processed');
        });

        it('handles retry logic for failed transactions', async () => {
            await transactionProcessor.initialize();

            // First attempt fails
            mockConnection.getParsedTransaction.mockRejectedValueOnce(new Error('Temporary failure'));

            // Second attempt succeeds
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);

            const result1 = await transactionProcessor.processDeposit('retry_signature');
            expect(result1.success).toBe(false);
            expect(result1.retryable).toBe(true);

            // Retry should succeed
            const result2 = await transactionProcessor.reprocessTransaction('retry_signature', true);
            expect(result2.success).toBe(true);
        });
    });

    describe('Performance and Scale', () => {
        it('handles batch processing efficiently', async () => {
            const batchSize = 100;
            const signatures = Array.from({ length: batchSize }, (_, i) => `sig_${i}`);

            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);
            await transactionProcessor.initialize();

            const startTime = Date.now();
            const results = await transactionProcessor.processBatch(signatures);
            const endTime = Date.now();

            expect(results).toHaveLength(batchSize);
            expect(results.every(r => r.success)).toBe(true);
            expect(endTime - startTime).toBeLessThan(30000); // Should complete in under 30 seconds
        });

        it('maintains performance under concurrent load', async () => {
            mockConnection.getParsedTransaction.mockResolvedValue(mockTransaction);
            await transactionProcessor.initialize();

            const concurrentProcesses = Array.from({ length: 10 }, (_, i) =>
                transactionProcessor.processDeposit(`concurrent_${i}`)
            );

            const results = await Promise.all(concurrentProcesses);
            expect(results.every(r => r.success)).toBe(true);
        });
    });
}); 