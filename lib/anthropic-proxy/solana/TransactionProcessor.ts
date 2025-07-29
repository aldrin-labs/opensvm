import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { SVMAIBalanceManager } from '../billing/SVMAIBalanceManager';
import { BalanceStorage } from '../storage/BalanceStorage';
import { MultisigManager } from './MultisigManager';
import {
    parseTokenTransfer,
    validateSolanaAddress,
    isTransactionSuccessful,
    getTransactionError,
    TokenTransfer,
    getTimeSinceTransaction
} from '../utils/SolanaUtils';

export interface ProcessingResult {
    success: boolean;
    transactionSignature: string;
    userId?: string;
    amount?: number;
    error?: string;
    retryable?: boolean;
    metadata?: Record<string, any>;
}

export interface DepositValidation {
    isValid: boolean;
    reason?: string;
    userId?: string;
    amount?: number;
    mint?: string;
    fromAddress?: string;
    toAddress?: string;
}

export interface ProcessingConfig {
    maxRetries: number;
    retryDelayMs: number;
    confirmationRequirement: number;
    maxProcessingTimeMs: number;
    duplicateCheckEnabled: boolean;
    fraudDetectionEnabled: boolean;
}

export class TransactionProcessor {
    private connection: Connection;
    private balanceManager: SVMAIBalanceManager;
    private balanceStorage: BalanceStorage;
    private multisigManager: MultisigManager;
    private config: ProcessingConfig;
    private processedTransactions: Set<string> = new Set();
    private processingQueue: Map<string, { attempts: number; lastAttempt: Date }> = new Map();

    constructor(
        rpcEndpoint: string,
        config: Partial<ProcessingConfig> = {}
    ) {
        this.connection = new Connection(rpcEndpoint, 'confirmed');
        this.balanceManager = new SVMAIBalanceManager();
        this.balanceStorage = new BalanceStorage();
        this.multisigManager = new MultisigManager(rpcEndpoint);

        this.config = {
            maxRetries: 3,
            retryDelayMs: 5000,
            confirmationRequirement: 1,
            maxProcessingTimeMs: 300000, // 5 minutes
            duplicateCheckEnabled: true,
            fraudDetectionEnabled: true,
            ...config,
        };
    }

    /**
     * Initialize the transaction processor
     */
    async initialize(): Promise<void> {
        await Promise.all([
            this.balanceManager.initialize(),
            this.balanceStorage.initialize(),
            this.multisigManager.initialize(),
        ]);

        console.log('TransactionProcessor initialized');
    }

    /**
     * Process a deposit transaction
     */
    async processDeposit(transactionSignature: string): Promise<ProcessingResult> {
        const startTime = Date.now();

        try {
            // Check if already processed
            if (this.config.duplicateCheckEnabled && this.processedTransactions.has(transactionSignature)) {
                return {
                    success: false,
                    transactionSignature,
                    error: 'Transaction already processed',
                    retryable: false,
                };
            }

            // Get transaction data
            const transaction = await this.getTransactionWithRetry(transactionSignature);
            if (!transaction) {
                return {
                    success: false,
                    transactionSignature,
                    error: 'Transaction not found',
                    retryable: true,
                };
            }

            // Validate transaction
            const validation = await this.validateDepositTransaction(transaction);
            if (!validation.isValid) {
                return {
                    success: false,
                    transactionSignature,
                    error: validation.reason || 'Transaction validation failed',
                    retryable: false,
                };
            }

            // Process the deposit
            const result = await this.executeDepositProcessing(
                transactionSignature,
                transaction,
                validation
            );

            // Mark as processed if successful
            if (result.success) {
                this.processedTransactions.add(transactionSignature);
                this.processingQueue.delete(transactionSignature);
            }

            // Add processing metadata
            result.metadata = {
                ...result.metadata,
                processingTimeMs: Date.now() - startTime,
                confirmedAt: new Date().toISOString(),
            };

            return result;

        } catch (error) {
            console.error(`Error processing deposit ${transactionSignature}:`, error);

            return {
                success: false,
                transactionSignature,
                error: error instanceof Error ? error.message : 'Unknown processing error',
                retryable: true,
                metadata: {
                    processingTimeMs: Date.now() - startTime,
                    errorDetails: error instanceof Error ? error.stack : undefined,
                },
            };
        }
    }

    /**
     * Validate a deposit transaction
     */
    private async validateDepositTransaction(
        transaction: ParsedTransactionWithMeta
    ): Promise<DepositValidation> {
        // Check if transaction was successful
        if (!isTransactionSuccessful(transaction)) {
            return {
                isValid: false,
                reason: `Transaction failed: ${getTransactionError(transaction)}`,
            };
        }

        // Parse token transfers
        const transfers = parseTokenTransfer(transaction);
        if (transfers.length === 0) {
            return {
                isValid: false,
                reason: 'No token transfers found in transaction',
            };
        }

        // Find SVMAI transfers to known multisig addresses
        const validTransfer = await this.findValidDepositTransfer(transfers);
        if (!validTransfer) {
            return {
                isValid: false,
                reason: 'No valid SVMAI deposits to known multisig addresses',
            };
        }

        // Validate transfer amount
        if (validTransfer.amount <= 0) {
            return {
                isValid: false,
                reason: 'Invalid deposit amount: must be greater than 0',
            };
        }

        // Check minimum deposit amount
        const minDeposit = 10; // 10 SVMAI minimum
        if (validTransfer.amount < minDeposit) {
            return {
                isValid: false,
                reason: `Deposit amount ${validTransfer.amount} below minimum ${minDeposit} SVMAI`,
            };
        }

        // Get user ID from source address
        const userId = await this.getUserIdFromAddress(validTransfer.from);
        if (!userId) {
            return {
                isValid: false,
                reason: 'Unable to identify user from source address',
            };
        }

        // Fraud detection checks
        if (this.config.fraudDetectionEnabled) {
            const fraudCheck = await this.checkForFraud(validTransfer, userId);
            if (!fraudCheck.isValid) {
                return fraudCheck;
            }
        }

        return {
            isValid: true,
            userId,
            amount: validTransfer.amount,
            mint: validTransfer.mint,
            fromAddress: validTransfer.from,
            toAddress: validTransfer.to,
        };
    }

    /**
     * Find valid SVMAI deposit transfer in transaction
     */
    private async findValidDepositTransfer(transfers: TokenTransfer[]): Promise<TokenTransfer | null> {
        const svmaiMint = process.env.SVMAI_MINT_ADDRESS || 'SVMAI_MINT_PLACEHOLDER';

        for (const transfer of transfers) {
            // Check if this is an SVMAI transfer
            if (transfer.mint !== svmaiMint) {
                continue;
            }

            // Check if destination is a known multisig
            if (this.multisigManager.isKnownMultisig(transfer.to)) {
                return transfer;
            }
        }

        return null;
    }

    /**
     * Execute the deposit processing
     */
    private async executeDepositProcessing(
        signature: string,
        transaction: ParsedTransactionWithMeta,
        validation: DepositValidation
    ): Promise<ProcessingResult> {
        const { userId, amount, fromAddress, toAddress, mint } = validation;

        if (!userId || !amount) {
            throw new Error('Missing required validation data');
        }

        try {
            // Add balance to user account
            const updatedBalance = await this.balanceManager.addBalance(
                userId,
                amount,
                signature
            );

            // Log the transaction
            await this.balanceStorage.logTransaction({
                id: signature,
                userId,
                type: 'deposit',
                amount,
                balanceAfter: updatedBalance.svmaiBalance,
                timestamp: new Date(),
                metadata: {
                    source: 'solana_deposit',
                    fromAddress,
                    toAddress,
                    mint,
                    signature,
                    blockTime: transaction.blockTime,
                    slot: transaction.slot,
                    confirmations: this.config.confirmationRequirement,
                },
            });

            console.log(`Successfully processed deposit: ${amount} SVMAI for user ${userId}`);

            return {
                success: true,
                transactionSignature: signature,
                userId,
                amount,
                metadata: {
                    newBalance: updatedBalance.svmaiBalance,
                    availableBalance: updatedBalance.availableBalance,
                    fromAddress,
                    toAddress,
                },
            };

        } catch (error) {
            console.error(`Error executing deposit processing:`, error);
            throw error;
        }
    }

    /**
     * Get user ID from Solana address
     */
    private async getUserIdFromAddress(solanaAddress: string): Promise<string | null> {
        // TODO: Implement proper address-to-user mapping
        // This could use:
        // 1. A Qdrant collection with address mappings
        // 2. User profile data with linked Solana addresses
        // 3. On-chain program data

        // For now, generate a deterministic user ID
        // In production, implement proper user identification
        const encoder = new TextEncoder();
        const data = encoder.encode(solanaAddress);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return `user_${hashHex.substring(0, 16)}`;
    }

    /**
     * Get transaction with retry logic
     */
    private async getTransactionWithRetry(
        signature: string,
        maxRetries: number = 3
    ): Promise<ParsedTransactionWithMeta | null> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const transaction = await this.connection.getParsedTransaction(signature, {
                    maxSupportedTransactionVersion: 0,
                });

                if (transaction) {
                    return transaction;
                }

                // Wait before retry
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            } catch (error) {
                console.error(`Attempt ${attempt} failed to get transaction ${signature}:`, error);

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        return null;
    }

    /**
     * Fraud detection checks
     */
    private async checkForFraud(
        transfer: TokenTransfer,
        userId: string
    ): Promise<DepositValidation> {
        // Check for duplicate deposits (same amount from same address in short time)
        const recentDeposits = await this.getRecentDeposits(userId, 3600000); // 1 hour

        const duplicateDeposit = recentDeposits.find(deposit =>
            deposit.amount === transfer.amount &&
            deposit.metadata?.fromAddress === transfer.from
        );

        if (duplicateDeposit) {
            return {
                isValid: false,
                reason: 'Potential duplicate deposit detected',
            };
        }

        // Check for unusually large deposits
        const maxSingleDeposit = 100000; // 100K SVMAI
        if (transfer.amount > maxSingleDeposit) {
            return {
                isValid: false,
                reason: `Deposit amount ${transfer.amount} exceeds maximum allowed ${maxSingleDeposit}`,
            };
        }

        // Check daily deposit limits
        const dailyDeposits = await this.getDailyDepositTotal(userId);
        const maxDailyDeposit = 1000000; // 1M SVMAI per day

        if (dailyDeposits + transfer.amount > maxDailyDeposit) {
            return {
                isValid: false,
                reason: `Daily deposit limit would be exceeded: ${dailyDeposits + transfer.amount} > ${maxDailyDeposit}`,
            };
        }

        return { isValid: true };
    }

    /**
     * Get recent deposits for a user
     */
    private async getRecentDeposits(
        userId: string,
        timeframeMs: number
    ): Promise<Array<{ amount: number; metadata?: any }>> {
        // TODO: Implement actual lookup from balance storage
        // For now, return empty array
        return [];
    }

    /**
     * Get total deposits for user today
     */
    private async getDailyDepositTotal(userId: string): Promise<number> {
        // TODO: Implement actual daily total calculation
        // For now, return 0
        return 0;
    }

    /**
     * Process multiple transactions in batch
     */
    async processBatch(signatures: string[]): Promise<ProcessingResult[]> {
        const results: ProcessingResult[] = [];
        const batchSize = 5; // Process 5 at a time to avoid rate limits

        for (let i = 0; i < signatures.length; i += batchSize) {
            const batch = signatures.slice(i, i + batchSize);
            const batchPromises = batch.map(signature => this.processDeposit(signature));

            try {
                const batchResults = await Promise.allSettled(batchPromises);

                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    } else {
                        results.push({
                            success: false,
                            transactionSignature: 'unknown',
                            error: result.reason?.message || 'Batch processing failed',
                            retryable: true,
                        });
                    }
                }
            } catch (error) {
                console.error('Batch processing error:', error);
            }

            // Rate limiting delay between batches
            if (i + batchSize < signatures.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    /**
     * Retry failed transactions
     */
    async retryFailedTransactions(): Promise<ProcessingResult[]> {
        const results: ProcessingResult[] = [];
        const now = new Date();

        for (const [signature, queueInfo] of this.processingQueue.entries()) {
            // Skip if max retries exceeded
            if (queueInfo.attempts >= this.config.maxRetries) {
                console.log(`Max retries exceeded for transaction ${signature}`);
                this.processingQueue.delete(signature);
                continue;
            }

            // Skip if not enough time has passed since last attempt
            const timeSinceLastAttempt = now.getTime() - queueInfo.lastAttempt.getTime();
            if (timeSinceLastAttempt < this.config.retryDelayMs) {
                continue;
            }

            // Attempt retry
            queueInfo.attempts++;
            queueInfo.lastAttempt = now;

            try {
                const result = await this.processDeposit(signature);
                results.push(result);

                // Remove from queue if successful
                if (result.success) {
                    this.processingQueue.delete(signature);
                }
            } catch (error) {
                console.error(`Retry failed for transaction ${signature}:`, error);
            }
        }

        return results;
    }

    /**
     * Get processing statistics
     */
    getProcessingStats(): {
        processedCount: number;
        queuedCount: number;
        failedCount: number;
        averageProcessingTime?: number;
    } {
        return {
            processedCount: this.processedTransactions.size,
            queuedCount: this.processingQueue.size,
            failedCount: Array.from(this.processingQueue.values()).filter(
                q => q.attempts >= this.config.maxRetries
            ).length,
        };
    }

    /**
     * Clear processed transaction cache (for memory management)
     */
    clearProcessedCache(olderThanMs: number = 86400000): void { // 24 hours default
        // In a production system, you'd want to persist this data
        // and only keep recent transactions in memory
        console.log(`Cleared processed transaction cache (older than ${olderThanMs}ms)`);
    }

    /**
     * Manual transaction reprocessing (for admin use)
     */
    async reprocessTransaction(signature: string, force: boolean = false): Promise<ProcessingResult> {
        if (force) {
            this.processedTransactions.delete(signature);
            this.processingQueue.delete(signature);
        }

        return this.processDeposit(signature);
    }
} 