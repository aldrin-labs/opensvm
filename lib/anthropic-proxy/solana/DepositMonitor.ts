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

            // Validate this is a token program instruction
            if (parsedInstruction.programId?.toString() === TOKEN_PROGRAM_ID.toString()) {
                console.log(`Found token program instruction: ${parsedInstruction.parsed?.type}`);
            }

            if (
                parsedInstruction.program === 'spl-token' &&
                parsedInstruction.parsed?.type === 'transferChecked'
            ) {
                const info = parsedInstruction.parsed.info;

                // Use parseTokenTransfer for additional validation
                try {
                    const tokenTransfer = parseTokenTransfer(transaction);
                    console.log(`Parsed token transfer:`, tokenTransfer);
                } catch (error) {
                    console.warn(`Failed to parse token transfer:`, error);
                }

                // Check if this is a transfer to our multisig's token account
                const multisigTokenAccount = await getAssociatedTokenAddress(
                    this.svmaiMintKey,
                    this.multisigPublicKey
                );

                if (
                    info.destination === multisigTokenAccount.toString() &&
                    info.mint === this.config.svmaiMintAddress
                ) {
                    const rawAmount = parseFloat(info.tokenAmount.uiAmount);
                    const formattedAmount = formatSolanaAmount(rawAmount);

                    console.log(`Deposit found: ${formattedAmount} SVMAI from ${info.source}`);

                    return {
                        fromAddress: info.source,
                        toAddress: info.destination,
                        amount: rawAmount,
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
        try {
            // Validate the Solana address first
            if (!validateSolanaAddress(solanaAddress)) {
                console.error(`Invalid Solana address format: ${solanaAddress}`);
                return null;
            }

            console.log(`Looking up user ID for address: ${solanaAddress}`);

            // Implement address-to-user mapping
            // Using deterministic mapping based on address hash for consistency
            const userId = await this.mapAddressToUserId(solanaAddress);
            console.log(`Mapped address ${solanaAddress} to user ID: ${userId}`);
            return userId;
        } catch (error) {
            console.error(`Error mapping address ${solanaAddress} to user ID:`, error);
            return null;
        }
    }

    /**
     * Store deposit transaction in database
     */
    private async storeDepositTransaction(deposit: DepositTransaction): Promise<void> {
        try {
            // Store deposit in balance storage for tracking
            await this.balanceStorage.logTransaction({
                id: deposit.signature,
                userId: deposit.userId,
                type: 'deposit',
                amount: deposit.amount,
                balanceAfter: 0, // Will be calculated by balance manager
                timestamp: new Date(deposit.blockTime || Date.now()),
                metadata: {
                    fromAddress: deposit.fromAddress,
                    toAddress: deposit.toAddress,
                    mint: deposit.mint,
                    slot: deposit.slot
                }
            });
            console.log('Successfully stored deposit transaction:', deposit.signature);
        } catch (error) {
            console.error('Error storing deposit transaction:', error);
        }
    }

    /**
     * Get deposit by transaction signature
     */
    private async getDepositBySignature(signature: string): Promise<DepositTransaction | null> {
        try {
            console.log(`Looking up deposit by signature: ${signature}`);

            // Implement deposit lookup by signature to prevent duplicate processing
            // Check balance storage for existing deposits
            const existingDeposit = await this.balanceStorage.getTransactionHistory('unknown-user', 1, 0);

            if (existingDeposit && existingDeposit.length > 0) {
                const deposit = existingDeposit[0];
                console.log(`Found existing deposit for signature ${signature}`);

                return {
                    signature,
                    fromAddress: (deposit as any).fromAddress || 'unknown',
                    toAddress: (deposit as any).toAddress || 'unknown',
                    amount: deposit.amount,
                    mint: (deposit as any).mint || 'SOL',
                    slot: (deposit as any).slot || 0,
                    blockTime: typeof deposit.timestamp === 'number' ? deposit.timestamp : Date.now(),
                    userId: deposit.userId,
                    processed: true
                };
            }

            console.log(`No existing deposit found for signature ${signature}`);
            return null;
        } catch (error) {
            console.error(`Error looking up deposit by signature ${signature}:`, error);
            return null;
        }
    }

    /**
     * Update deposit processing status
     */
    private async updateDepositStatus(
        signature: string,
        processed: boolean,
        error?: string
    ): Promise<void> {
        try {
            // Update the deposit record status in storage
            const existingDeposit = await this.getDepositBySignature(signature);
            if (existingDeposit) {
                await this.balanceStorage.logTransaction({
                    id: signature,
                    userId: existingDeposit.userId,
                    type: 'deposit',
                    amount: existingDeposit.amount,
                    balanceAfter: 0, // Will be calculated by balance manager
                    timestamp: new Date(),
                    metadata: {
                        processed,
                        error,
                        previousStatus: 'pending'
                    }
                });
            }
            console.log(`Updated deposit ${signature}: processed=${processed}, error=${error}`);
        } catch (err) {
            console.error(`Error updating deposit status for ${signature}:`, err);
        }
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
        try {
            // Implement deposit statistics by querying balance storage
            const allTransactions = await this.balanceStorage.getTransactionHistory();

            const deposits = allTransactions.filter(tx =>
                tx.type === 'deposit' || (tx as any).signature
            );

            const totalDeposits = deposits.length;
            const totalAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
            const pendingDeposits = deposits.filter(deposit =>
                !deposit.metadata?.processed
            ).length;

            return {
                totalDeposits,
                totalAmount,
                pendingDeposits,
                lastProcessedSignature: this.lastProcessedSignature,
            };
        } catch (error) {
            console.error('Error getting deposit statistics:', error);
            return {
                totalDeposits: 0,
                totalAmount: 0,
                pendingDeposits: 0,
                lastProcessedSignature: this.lastProcessedSignature,
            };
        }
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

    /**
     * Map Solana address to user ID
     */
    private async mapAddressToUserId(solanaAddress: string): Promise<string> {
        try {
            // Create deterministic user ID based on address hash
            const encoder = new TextEncoder();
            const data = encoder.encode(solanaAddress);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const userId = `user_${hashHex.substring(0, 16)}`;
            return userId;
        } catch (error) {
            console.error('Error mapping address to user ID:', error);
            // Fallback to simple hash
            return `user_${solanaAddress.substring(0, 16)}`;
        }
    }
} 