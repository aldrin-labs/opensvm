import { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { validateSolanaAddress, addressesEqual } from '../utils/SolanaUtils';

export interface MultisigConfig {
    address: string;
    threshold: number;
    signers: string[];
    createdAt: Date;
    isActive: boolean;
    purpose: 'deposits' | 'treasury' | 'governance';
    metadata?: Record<string, any>;
}

export interface MultisigSigner {
    address: string;
    name?: string;
    role: 'owner' | 'admin' | 'operator';
    addedAt: Date;
    isActive: boolean;
}

export interface MultisigTransaction {
    id: string;
    multisigAddress: string;
    transaction: Transaction;
    requiredSignatures: number;
    currentSignatures: string[];
    status: 'pending' | 'approved' | 'executed' | 'rejected';
    createdAt: Date;
    executedAt?: Date;
    purpose: string;
    metadata?: Record<string, any>;
}

export class MultisigManager {
    private connection: Connection;
    private multisigConfigs: Map<string, MultisigConfig> = new Map();
    private pendingTransactions: Map<string, MultisigTransaction> = new Map();

    constructor(rpcEndpoint: string) {
        this.connection = new Connection(rpcEndpoint, 'confirmed');
    }

    /**
     * Initialize the multisig manager
     */
    async initialize(): Promise<void> {
        // Load existing multisig configurations from storage
        await this.loadMultisigConfigurations();
    }

    /**
     * Create a new multisig configuration
     */
    async createMultisigConfig(
        signers: string[],
        threshold: number,
        purpose: MultisigConfig['purpose'],
        metadata?: Record<string, any>
    ): Promise<MultisigConfig> {
        // Validate inputs
        if (threshold < 1 || threshold > signers.length) {
            throw new Error('Invalid threshold: must be between 1 and number of signers');
        }

        if (signers.length === 0) {
            throw new Error('At least one signer is required');
        }

        // Validate all signer addresses
        for (const signer of signers) {
            if (!validateSolanaAddress(signer)) {
                throw new Error(`Invalid signer address: ${signer}`);
            }
        }

        // Generate multisig address (deterministic based on signers and threshold)
        const multisigAddress = await this.generateMultisigAddress(signers, threshold);

        const config: MultisigConfig = {
            address: multisigAddress,
            threshold,
            signers: [...signers],
            createdAt: new Date(),
            isActive: true,
            purpose,
            metadata: metadata || {},
        };

        // Store the configuration
        this.multisigConfigs.set(multisigAddress, config);
        await this.saveMultisigConfiguration(config);

        console.log(`Created multisig ${multisigAddress} with ${signers.length} signers, threshold ${threshold}`);

        return config;
    }

    /**
     * Get multisig configuration by address
     */
    getMultisigConfig(address: string): MultisigConfig | null {
        return this.multisigConfigs.get(address) || null;
    }

    /**
     * List all multisig configurations
     */
    listMultisigConfigs(purpose?: MultisigConfig['purpose']): MultisigConfig[] {
        const configs = Array.from(this.multisigConfigs.values());

        if (purpose) {
            return configs.filter(config => config.purpose === purpose && config.isActive);
        }

        return configs.filter(config => config.isActive);
    }

    /**
     * Get the primary deposit multisig address
     */
    getPrimaryDepositAddress(): string | null {
        const depositConfigs = this.listMultisigConfigs('deposits');

        if (depositConfigs.length === 0) {
            return null;
        }

        // Return the first active deposit multisig
        // In production, you might have logic to select the "primary" one
        return depositConfigs[0].address;
    }

    /**
     * Add a signer to an existing multisig
     */
    async addSigner(
        multisigAddress: string,
        newSignerAddress: string,
        signerName?: string,
        role: MultisigSigner['role'] = 'operator'
    ): Promise<boolean> {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            throw new Error(`Multisig configuration not found: ${multisigAddress}`);
        }

        if (!validateSolanaAddress(newSignerAddress)) {
            throw new Error(`Invalid signer address: ${newSignerAddress}`);
        }

        // Validate signer name and role
        console.log(`Adding signer ${newSignerAddress} with name: ${signerName || 'Unknown'} and role: ${role}`);

        // Check role permissions
        if (role === 'owner' && config.signers.length > 0) {
            console.warn(`Adding owner role to ${signerName || newSignerAddress} - ensure proper authorization`);
        }

        // Validate role hierarchy
        const validRoles: MultisigSigner['role'][] = ['owner', 'admin', 'operator'];
        if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
        }

        // Check if signer already exists
        if (config.signers.includes(newSignerAddress)) {
            throw new Error(`Signer already exists: ${newSignerAddress}`);
        }

        // Add the signer
        config.signers.push(newSignerAddress);
        await this.saveMultisigConfiguration(config);

        console.log(`Added signer ${newSignerAddress} to multisig ${multisigAddress}`);
        return true;
    }

    /**
     * Remove a signer from a multisig
     */
    async removeSigner(
        multisigAddress: string,
        signerAddress: string
    ): Promise<boolean> {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            throw new Error(`Multisig configuration not found: ${multisigAddress}`);
        }

        const signerIndex = config.signers.indexOf(signerAddress);
        if (signerIndex === -1) {
            throw new Error(`Signer not found: ${signerAddress}`);
        }

        // Check if removing this signer would make threshold impossible
        if (config.signers.length - 1 < config.threshold) {
            throw new Error('Cannot remove signer: would make threshold impossible to reach');
        }

        // Remove the signer
        config.signers.splice(signerIndex, 1);
        await this.saveMultisigConfiguration(config);

        console.log(`Removed signer ${signerAddress} from multisig ${multisigAddress}`);
        return true;
    }

    /**
     * Update multisig threshold
     */
    async updateThreshold(
        multisigAddress: string,
        newThreshold: number
    ): Promise<boolean> {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            throw new Error(`Multisig configuration not found: ${multisigAddress}`);
        }

        if (newThreshold < 1 || newThreshold > config.signers.length) {
            throw new Error('Invalid threshold: must be between 1 and number of signers');
        }

        config.threshold = newThreshold;
        await this.saveMultisigConfiguration(config);

        console.log(`Updated threshold for multisig ${multisigAddress} to ${newThreshold}`);
        return true;
    }

    /**
     * Validate that an address is a known multisig
     */
    isKnownMultisig(address: string): boolean {
        return this.multisigConfigs.has(address);
    }

    /**
     * Check if an address is a signer for a multisig
     */
    isSignerForMultisig(multisigAddress: string, signerAddress: string): boolean {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            return false;
        }

        return config.signers.some(signer => addressesEqual(signer, signerAddress));
    }

    /**
     * Get multisig statistics
     */
    getMultisigStats(): {
        totalMultisigs: number;
        activeMultisigs: number;
        depositMultisigs: number;
        treasuryMultisigs: number;
        governanceMultisigs: number;
    } {
        const configs = Array.from(this.multisigConfigs.values());
        const active = configs.filter(c => c.isActive);

        return {
            totalMultisigs: configs.length,
            activeMultisigs: active.length,
            depositMultisigs: active.filter(c => c.purpose === 'deposits').length,
            treasuryMultisigs: active.filter(c => c.purpose === 'treasury').length,
            governanceMultisigs: active.filter(c => c.purpose === 'governance').length,
        };
    }

    /**
     * Deactivate a multisig (soft delete)
     */
    async deactivateMultisig(multisigAddress: string): Promise<boolean> {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            throw new Error(`Multisig configuration not found: ${multisigAddress}`);
        }

        config.isActive = false;
        await this.saveMultisigConfiguration(config);

        console.log(`Deactivated multisig ${multisigAddress}`);
        return true;
    }

    /**
     * Generate a deterministic multisig address based on signers and threshold
     * This is a simplified version - in production, use proper multisig program
     */
    private async generateMultisigAddress(
        signers: string[],
        threshold: number
    ): Promise<string> {
        // Sort signers for deterministic address generation
        const sortedSigners = [...signers].sort();

        // Create a deterministic seed from signers and threshold
        const seed = `multisig_${threshold}_${sortedSigners.join('_')}`;

        // Generate a keypair from the seed (simplified approach)
        // In production, use proper multisig program like Squads or create on-chain
        const seedBytes = new TextEncoder().encode(seed);
        
        let hash: ArrayBuffer;
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            // Use Web Crypto API if available
            hash = await crypto.subtle.digest('SHA-256', seedBytes);
        } else {
            // Fallback for test environments - simple deterministic hash
            const simpleHash = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                simpleHash[i] = (seedBytes[i % seedBytes.length] || 0) + i;
            }
            hash = simpleHash.buffer;
        }
        
        const keypair = Keypair.fromSeed(new Uint8Array(hash.slice(0, 32)));

        return keypair.publicKey.toString();
    }

    /**
     * Verify multisig address against on-chain data
     */
    async verifyMultisigOnChain(multisigAddress: string): Promise<{
        exists: boolean;
        balance: number;
        owner: string | null;
    }> {
        try {
            const publicKey = new PublicKey(multisigAddress);
            const accountInfo = await this.connection.getAccountInfo(publicKey);

            if (!accountInfo) {
                return {
                    exists: false,
                    balance: 0,
                    owner: null,
                };
            }

            const balance = await this.connection.getBalance(publicKey);

            return {
                exists: true,
                balance,
                owner: accountInfo.owner.toString(),
            };
        } catch (error) {
            console.error(`Error verifying multisig ${multisigAddress}:`, error);
            return {
                exists: false,
                balance: 0,
                owner: null,
            };
        }
    }

    /**
     * Get multisig balance information
     */
    async getMultisigBalance(multisigAddress: string): Promise<{
        solBalance: number;
        tokenBalances: Array<{
            mint: string;
            amount: number;
            decimals: number;
        }>;
    }> {
        try {
            const publicKey = new PublicKey(multisigAddress);

            // Get SOL balance
            const solBalance = await this.connection.getBalance(publicKey);

            // Get token accounts
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                publicKey,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            const tokenBalances = tokenAccounts.value.map(account => {
                const parsedInfo = account.account.data.parsed.info;
                return {
                    mint: parsedInfo.mint,
                    amount: parseFloat(parsedInfo.tokenAmount.uiAmount || '0'),
                    decimals: parsedInfo.tokenAmount.decimals,
                };
            });

            return {
                solBalance,
                tokenBalances,
            };
        } catch (error) {
            console.error(`Error getting multisig balance ${multisigAddress}:`, error);
            return {
                solBalance: 0,
                tokenBalances: [],
            };
        }
    }

    /**
     * Load multisig configurations from storage
     */
    private async loadMultisigConfigurations(): Promise<void> {
        // Load multisig configurations from storage
        // Using in-memory storage with fallback to default configuration

        // Example default configuration
        const defaultConfig: MultisigConfig = {
            address: 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP', // Example address
            threshold: 2,
            signers: [
                'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP',
                'B8Y9nOzF4RrK0QeL3sG7vW9xUz2nBdEfGhJkMnOp',
                'C9Z0pAqG5SsL1ReM4tH8wX0yVa3oCfFhIjKlNpQr',
            ],
            createdAt: new Date(),
            isActive: true,
            purpose: 'deposits',
            metadata: {
                name: 'OpenSVM SVMAI Deposit Wallet',
                description: 'Primary multisig wallet for SVMAI token deposits',
            },
        };

        this.multisigConfigs.set(defaultConfig.address, defaultConfig);
        console.log('Loaded default multisig configuration');
    }

    /**
     * Save multisig configuration to storage
     */
    private async saveMultisigConfiguration(config: MultisigConfig): Promise<void> {
        // Save multisig configuration to persistent storage
        // Currently using in-memory storage with planned database integration
        this.multisigConfigs.set(config.address, config);
        console.log(`Saved multisig configuration: ${config.address}`);
    }

    /**
     * Create emergency recovery configuration
     */
    async createEmergencyRecovery(
        multisigAddress: string,
        emergencySigners: string[],
        recoveryThreshold: number
    ): Promise<boolean> {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            throw new Error(`Multisig configuration not found: ${multisigAddress}`);
        }

        // Validate emergency signers
        for (const signer of emergencySigners) {
            if (!validateSolanaAddress(signer)) {
                throw new Error(`Invalid emergency signer address: ${signer}`);
            }
        }

        if (recoveryThreshold < 1 || recoveryThreshold > emergencySigners.length) {
            throw new Error('Invalid recovery threshold');
        }

        // Add emergency recovery metadata
        config.metadata = {
            ...config.metadata,
            emergencyRecovery: {
                signers: emergencySigners,
                threshold: recoveryThreshold,
                createdAt: new Date().toISOString(),
            },
        };

        await this.saveMultisigConfiguration(config);
        console.log(`Created emergency recovery for multisig ${multisigAddress}`);
        return true;
    }

    /**
     * Create a pending multisig transaction
     */
    async createPendingTransaction(
        multisigAddress: string,
        instructions: TransactionInstruction[],
        proposer: string
    ): Promise<string> {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            throw new Error(`Multisig configuration not found: ${multisigAddress}`);
        }

        // Create transaction with instructions
        const transaction = new Transaction();
        instructions.forEach(instruction => {
            transaction.add(instruction);
        });

        // Generate unique transaction ID
        const transactionId = `${multisigAddress}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create multisig transaction record
        const multisigTransaction: MultisigTransaction = {
            id: transactionId,
            multisigAddress,
            transaction,
            requiredSignatures: config.threshold,
            currentSignatures: [],
            status: 'pending',
            createdAt: new Date(),
            purpose: `Transaction proposed by ${proposer}`,
            metadata: {
                proposer,
                instructionCount: instructions.length
            }
        };

        // Add to pending transactions
        this.pendingTransactions.set(transactionId, multisigTransaction);
        console.log(`Created pending transaction ${transactionId} for multisig ${multisigAddress}`);

        return transactionId;
    }

    /**
     * Get pending transactions for a multisig
     */
    getPendingTransactions(multisigAddress: string): MultisigTransaction[] {
        const pending: MultisigTransaction[] = [];

        for (const [transactionId, transaction] of this.pendingTransactions.entries()) {
            if (transaction.multisigAddress === multisigAddress && transaction.status === 'pending') {
                console.log(`Found pending transaction ${transactionId} for multisig ${multisigAddress}`);
                pending.push(transaction);
            }
        }

        console.log(`Found ${pending.length} pending transactions for multisig ${multisigAddress}`);
        return pending;
    }

    /**
     * Create a system program transfer instruction
     */
    createTransferInstruction(
        fromPubkey: PublicKey,
        toPubkey: PublicKey,
        lamports: number
    ): TransactionInstruction {
        console.log(`Creating transfer instruction: ${lamports} lamports from ${fromPubkey.toString()} to ${toPubkey.toString()}`);

        return SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports
        });
    }

    /**
     * Get signing requirements for a transaction
     */
    getSigningRequirements(multisigAddress: string): {
        threshold: number;
        signers: string[];
        canSign: (signerAddress: string) => boolean;
    } | null {
        const config = this.getMultisigConfig(multisigAddress);
        if (!config) {
            return null;
        }

        return {
            threshold: config.threshold,
            signers: [...config.signers],
            canSign: (signerAddress: string) =>
                config.signers.some(signer => addressesEqual(signer, signerAddress)),
        };
    }
} 