import { Connection, PublicKey, ParsedTransactionWithMeta, ParsedInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { SVMAIBalanceManager } from '../billing/SVMAIBalanceManager';
import { BalanceStorage } from '../storage/BalanceStorage';
import { validateSolanaAddress, parseTokenTransfer, formatSolanaAmount } from '../utils/SolanaUtils';

export interface DepositTransaction {
    signature: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
    mint: string;
    slot: number;
    blockTime: number;
    userId?: string;
    processed: boolean;
    error?: string;
}

export interface MonitoringConfig {
    rpcEndpoint: string;
    multisigAddress: string;
    svmaiMintAddress: string;
    pollInterval: number; // milliseconds
    confirmationRequirement: number; // blocks
    batchSize: number;
    maxRetries: number;
}

export class DepositMonitor {
    private connection: Connection;
    private config: MonitoringConfig;
    private balanceManager: SVMAIBalanceManager;
    private balanceStorage: BalanceStorage;
    private multisigPublicKey: PublicKey;
    private svmaiMintKey: PublicKey;
    private isMonitoring: boolean = false;
    private lastProcessedSignature: string | null = null;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(config: MonitoringConfig) {
        this.config = config;
        this.connection = new Connection(config.rpcEndpoint, 'confirmed');
        this.balanceManager = new SVMAIBalanceManager();
        this.balanceStorage = new BalanceStorage();

        // Validate and parse addresses
        if (!validateSolanaAddress(config.multisigAddress)) {
            throw new Error(`Invalid multisig address: ${config.multisigAddress}`);
        }
        if (!validateSolanaAddress(config.svmaiMintAddress)) {
            throw new Error(`Invalid SVMAI mint address: ${config.svmaiMintAddress}`);
        }

        this.multisigPublicKey = new PublicKey(config.multisigAddress);
        this.svmaiMintKey = new PublicKey(config.svmaiMintAddress);
    }

    /**
     * Initialize the deposit monitor
     */
    async initialize(): Promise<void> {
        await Promise.all([
            this.balanceManager.initialize(),
            this.balanceStorage.initialize(),
        ]);

        // Verify the multisig account exists
        try {
            const accountInfo = await this.connection.getAccountInfo(this.multisigPublicKey);
            if (!accountInfo) {
                console.warn(`Multisig account ${this.config.multisigAddress} not found on blockchain`);
            }
        } catch (error) {
            console.error('Error verifying multisig account:', error);
            throw new Error('Failed to verify multisig account');
        }
    }

    /**
     * Start monitoring for deposits
     */
    async startMonitoring(): Promise<void> {
        if (this.isMonitoring) {
            console.log('Deposit monitoring is already running');
            return;
        }

        console.log(`Starting deposit monitoring for multisig: ${this.config.multisigAddress}`);
        this.isMonitoring = true;

        // Get the associated token account for SVMAI tokens
        const multisigTokenAccount = await getAssociatedTokenAddress(
            this.svmaiMintKey,
            this.multisigPublicKey
        );

        // Start polling for new transactions
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.processNewDeposits(multisigTokenAccount);
            } catch (error) {
                console.error('Error during deposit monitoring:', error);
            }
        }, this.config.pollInterval);

        // Process any existing unprocessed transactions
        await this.processNewDeposits(multisigTokenAccount);
    }

    /**
     * Stop monitoring for deposits
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        console.log('Stopping deposit monitoring');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Process new deposits to the multisig token account
     */
    private async processNewDeposits(tokenAccount: PublicKey): Promise<void> {
        try {
            // Get recent transactions for the token account
            const signatures = await this.connection.getSignaturesForAddress(
                tokenAccount,
                {
                    limit: this.config.batchSize,
                    before: this.lastProcessedSignature || undefined,
                }
            );

            if (signatures.length === 0) {
                return;
            }

            // Process signatures in reverse order (oldest first)
            const sortedSignatures = signatures.reverse();

            for (const signatureInfo of sortedSignatures) {
                if (signatureInfo.err) {
                    // Skip failed transactions
                    console.log(`Skipping failed transaction: ${signatureInfo.signature}`);
                    continue;
                }

                try {
                    await this.processTransaction(signatureInfo.signature);
                    this.lastProcessedSignature = signatureInfo.signature;
                } catch (error) {
                    console.error(`Error processing transaction ${signatureInfo.signature}:`, error);
                }
            }
        } catch (error) {
            console.error('Error fetching new deposits:', error);
        }
    }

    /**
     * Process a specific transaction
     */
    private async processTransaction(signature: string): Promise<void> {
        // Check if we've already processed this transaction
        const existingDeposit = await this.getDepositBySignature(signature);
        if (existingDeposit) {
            return;
        }

        // Get the parsed transaction
        const transaction = await this.connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
        });

        if (!transaction) {
            console.warn(`Transaction ${signature} not found`);
            return;
        }

        // Check confirmation status
        if (!this.isTransactionConfirmed(transaction)) {
            console.log(`Transaction ${signature} not yet confirmed, skipping`);
            return;
        }

        // Parse the transaction for SVMAI deposits
        const depositData = await this.parseDepositTransaction(transaction);
        if (!depositData) {
            return; // Not a relevant transaction
        }

        // Store the deposit record
        await this.storeDepositTransaction({
            signature,
            fromAddress: depositData.fromAddress,
            toAddress: depositData.toAddress,
            amount: depositData.amount,
            mint: depositData.mint,
            slot: transaction.slot,
            blockTime: transaction.blockTime || Date.now() / 1000,
            processed: false,
        });

        // Process the deposit (update user balance)
        await this.processDepositForUser(signature, depositData);
    }

    /**
     * Parse a transaction to extract deposit information
     */
    private async parseDepositTransaction(
        transaction: ParsedTransactionWithMeta
    ): Promise<{
        fromAddress: string;
        toAddress: string;
        amount: number;
        mint: string;
    } | null> {
        if (!transaction.transaction.message.instructions) {
            return null;
        }

        // Look for SPL token transfer instructions
        for (const instruction of transaction.transaction.message.instructions) {
            const parsedInstruction = instruction as ParsedInstruction;

            if (
                parsedInstruction.program === 'spl-token' &&
                parsedInstruction.parsed?.type === 'transferChecked'
            ) {
                const info = parsedInstruction.parsed.info;

                // Check if this is a transfer to our multisig's token account
                const multisigTokenAccount = await getAssociatedTokenAddress(
                    this.svmaiMintKey,
                    this.multisigPublicKey
                );

                if (
                    info.destination === multisigTokenAccount.toString() &&
                    info.mint === this.config.svmaiMintAddress
                ) {
                    return {
                        fromAddress: info.source,
                        toAddress: info.destination,
                        amount: parseFloat(info.tokenAmount.uiAmount),
                        mint: info.mint,
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check if transaction has sufficient confirmations
     */
    private isTransactionConfirmed(transaction: ParsedTransactionWithMeta): boolean {
        if (!transaction.slot) {
            return false;
        }

        // For now, we trust 'confirmed' commitment level
        // In production, you might want to wait for more confirmations
        return true;
    }

    /**
     * Process a deposit for a specific user
     */
    private async processDepositForUser(
        signature: string,
        depositData: {
            fromAddress: string;
            toAddress: string;
            amount: number;
            mint: string;
        }
    ): Promise<void> {
        try {
            // Determine the user ID from the source address
            // This requires a mapping of Solana addresses to user IDs
            const userId = await this.getUserIdFromAddress(depositData.fromAddress);
            if (!userId) {
                console.warn(`No user found for deposit from ${depositData.fromAddress}`);
                await this.updateDepositStatus(signature, false, 'User not found');
                return;
            }

            // Add balance to the user's account
            const updatedBalance = await this.balanceManager.addBalance(
                userId,
                depositData.amount,
                signature
            );

            // Log the transaction in balance storage
            await this.balanceStorage.logTransaction({
                id: signature,
                userId,
                type: 'deposit',
                amount: depositData.amount,
                balanceAfter: updatedBalance.svmaiBalance,
                timestamp: new Date(),
                metadata: {
                    source: 'solana_deposit',
                    fromAddress: depositData.fromAddress,
                    toAddress: depositData.toAddress,
                    mint: depositData.mint,
                    signature,
                },
            });

            // Mark deposit as processed
            await this.updateDepositStatus(signature, true);

            console.log(
                `Processed deposit: ${depositData.amount} SVMAI for user ${userId} (tx: ${signature})`
            );

        } catch (error) {
            console.error(`Error processing deposit for user:`, error);
            await this.updateDepositStatus(signature, false, error instanceof Error ? error.message : 'Unknown error');
        }
    }

    /**
     * Get user ID from Solana address
     * This would typically query a user mapping table
     */
    private async getUserIdFromAddress(solanaAddress: string): Promise<string | null> {
        // TODO: Implement address-to-user mapping
        // This could be done through:
        // 1. A Qdrant collection mapping Solana addresses to user IDs
        // 2. A separate database table
        // 3. User profile metadata

        // For now, return a placeholder
        // In production, implement proper address mapping
        return 'demo-user-id';
    }

    /**
     * Store deposit transaction in database
     */
    private async storeDepositTransaction(deposit: DepositTransaction): Promise<void> {
        // TODO: Implement deposit storage in Qdrant or database
        // This would store the deposit record for tracking and reconciliation
        console.log('Storing deposit transaction:', deposit);
    }

    /**
     * Get deposit by transaction signature
     */
    private async getDepositBySignature(signature: string): Promise<DepositTransaction | null> {
        // TODO: Implement deposit lookup by signature
        // This prevents duplicate processing of the same transaction
        return null;
    }

    /**
     * Update deposit processing status
     */
    private async updateDepositStatus(
        signature: string,
        processed: boolean,
        error?: string
    ): Promise<void> {
        // TODO: Update the deposit record status
        console.log(`Updating deposit ${signature}: processed=${processed}, error=${error}`);
    }

    /**
     * Get deposit statistics
     */
    async getDepositStats(): Promise<{
        totalDeposits: number;
        totalAmount: number;
        pendingDeposits: number;
        lastProcessedSignature: string | null;
    }> {
        // TODO: Implement deposit statistics
        return {
            totalDeposits: 0,
            totalAmount: 0,
            pendingDeposits: 0,
            lastProcessedSignature: this.lastProcessedSignature,
        };
    }

    /**
     * Manually process a specific transaction (for troubleshooting)
     */
    async manuallyProcessTransaction(signature: string): Promise<boolean> {
        try {
            await this.processTransaction(signature);
            return true;
        } catch (error) {
            console.error(`Error manually processing transaction ${signature}:`, error);
            return false;
        }
    }

    /**
     * Get current monitoring status
     */
    getMonitoringStatus(): {
        isMonitoring: boolean;
        lastProcessedSignature: string | null;
        multisigAddress: string;
        svmaiMintAddress: string;
    } {
        return {
            isMonitoring: this.isMonitoring,
            lastProcessedSignature: this.lastProcessedSignature,
            multisigAddress: this.config.multisigAddress,
            svmaiMintAddress: this.config.svmaiMintAddress,
        };
    }
} 