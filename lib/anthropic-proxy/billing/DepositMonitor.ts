import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { SVMAIBalanceManager } from './SVMAIBalanceManager';

/**
 * Monitors Solana blockchain for SVMAI token deposits to multisig address
 */
export class DepositMonitor {
  private connection: Connection;
  private balanceManager: SVMAIBalanceManager;
  private multisigAddress: PublicKey;
  private svmaiMintAddress: PublicKey;
  private isMonitoring: boolean = false;

  constructor(
    rpcUrl: string,
    multisigAddress: string,
    svmaiMintAddress: string
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.balanceManager = new SVMAIBalanceManager();
    this.multisigAddress = new PublicKey(multisigAddress);
    this.svmaiMintAddress = new PublicKey(svmaiMintAddress);
  }

  /**
   * Initialize the deposit monitor
   */
  async initialize(): Promise<void> {
    await this.balanceManager.initialize();
  }

  /**
   * Start monitoring for deposits
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Deposit monitor already running');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting deposit monitor for multisig: ${this.multisigAddress.toString()}`);

    // Subscribe to account changes for the multisig address
    this.connection.onAccountChange(
      this.multisigAddress,
      async (accountInfo, context) => {
        console.log('Multisig account changed, checking for new deposits...');
        await this.checkRecentDeposits();
      },
      'confirmed'
    );

    // Also poll periodically as backup
    this.startPeriodicCheck();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('Stopped deposit monitoring');
  }

  /**
   * Start periodic checking as backup to WebSocket
   */
  private startPeriodicCheck(): void {
    const checkInterval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(checkInterval);
        return;
      }

      try {
        await this.checkRecentDeposits();
      } catch (error) {
        console.error('Error in periodic deposit check:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check for recent deposits to the multisig address
   */
  async checkRecentDeposits(): Promise<void> {
    try {
      // Get recent transactions for the multisig address
      const signatures = await this.connection.getSignaturesForAddress(
        this.multisigAddress,
        { limit: 10 }
      );

      for (const signatureInfo of signatures) {
        await this.processTransaction(signatureInfo.signature);
      }
    } catch (error) {
      console.error('Error checking recent deposits:', error);
    }
  }

  /**
   * Process a specific transaction to check for SVMAI deposits
   */
  async processTransaction(signature: string): Promise<void> {
    try {
      const transaction = await this.connection.getParsedTransaction(
        signature,
        { maxSupportedTransactionVersion: 0 }
      );

      if (!transaction || !transaction.meta || transaction.meta.err) {
        return; // Skip failed transactions
      }

      await this.analyzeTransactionForDeposits(transaction, signature);
    } catch (error) {
      console.error(`Error processing transaction ${signature}:`, error);
    }
  }

  /**
   * Analyze transaction for SVMAI token deposits
   */
  private async analyzeTransactionForDeposits(
    transaction: ParsedTransactionWithMeta,
    signature: string
  ): Promise<void> {
    try {
      // Look for SPL token transfers to our multisig address
      const preTokenBalances = transaction.meta?.preTokenBalances || [];
      const postTokenBalances = transaction.meta?.postTokenBalances || [];

      // Find SVMAI token account for our multisig
      const multisigTokenAccount = postTokenBalances.find(
        balance => 
          balance.mint === this.svmaiMintAddress.toString() &&
          balance.owner === this.multisigAddress.toString()
      );

      if (!multisigTokenAccount) {
        return; // No SVMAI token account found
      }

      const preBalance = preTokenBalances.find(
        balance => 
          balance.accountIndex === multisigTokenAccount.accountIndex
      );

      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = multisigTokenAccount.uiTokenAmount?.uiAmount || 0;
      const depositAmount = postAmount - preAmount;

      if (depositAmount <= 0) {
        return; // No deposit detected
      }

      console.log(`Detected SVMAI deposit: ${depositAmount} tokens in tx ${signature}`);

      // Try to identify the sender (depositor)
      const depositorUserId = await this.identifyDepositor(transaction, signature);
      
      if (depositorUserId) {
        // Credit the user's balance
        await this.balanceManager.addBalance(depositorUserId, depositAmount, signature);
        console.log(`Credited ${depositAmount} SVMAI to user ${depositorUserId}`);
      } else {
        console.warn(`Could not identify depositor for transaction ${signature}`);
        // Could store unidentified deposits for manual processing
      }
    } catch (error) {
      console.error('Error analyzing transaction for deposits:', error);
    }
  }

  /**
   * Try to identify the user who made the deposit
   * This is a simplified version - in production you might need more sophisticated logic
   */
  private async identifyDepositor(
    transaction: ParsedTransactionWithMeta,
    signature: string
  ): Promise<string | null> {
    try {
      // Look for the sender in the transaction
      const message = transaction.transaction.message;
      const accountKeys = message.accountKeys;

      // The first account is usually the fee payer/sender
      if (accountKeys.length > 0) {
        const senderAddress = accountKeys[0].pubkey.toString();
        
        // In a real implementation, you would:
        // 1. Look up the sender address in your user database
        // 2. Or use a memo field in the transaction to identify the user
        // 3. Or have users pre-register their wallet addresses
        
        // For now, we'll use the sender address as the user ID
        // This should be replaced with proper user identification logic
        return senderAddress;
      }

      return null;
    } catch (error) {
      console.error('Error identifying depositor:', error);
      return null;
    }
  }

  /**
   * Manually process a specific transaction (for testing or recovery)
   */
  async manuallyProcessTransaction(signature: string, userId: string): Promise<void> {
    try {
      const transaction = await this.connection.getParsedTransaction(
        signature,
        { maxSupportedTransactionVersion: 0 }
      );

      if (!transaction || !transaction.meta || transaction.meta.err) {
        throw new Error('Transaction not found or failed');
      }

      // Analyze for deposits but with known user ID
      const preTokenBalances = transaction.meta.preTokenBalances || [];
      const postTokenBalances = transaction.meta.postTokenBalances || [];

      const multisigTokenAccount = postTokenBalances.find(
        balance => 
          balance.mint === this.svmaiMintAddress.toString() &&
          balance.owner === this.multisigAddress.toString()
      );

      if (!multisigTokenAccount) {
        throw new Error('No SVMAI token account found in transaction');
      }

      const preBalance = preTokenBalances.find(
        balance => balance.accountIndex === multisigTokenAccount.accountIndex
      );

      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = multisigTokenAccount.uiTokenAmount?.uiAmount || 0;
      const depositAmount = postAmount - preAmount;

      if (depositAmount <= 0) {
        throw new Error('No deposit detected in transaction');
      }

      // Credit the user's balance
      await this.balanceManager.addBalance(userId, depositAmount, signature);
      console.log(`Manually credited ${depositAmount} SVMAI to user ${userId}`);
    } catch (error) {
      console.error('Error manually processing transaction:', error);
      throw error;
    }
  }

  /**
   * Get deposit statistics
   */
  async getDepositStats(): Promise<{
    totalDeposits: number;
    totalAmount: number;
    recentDeposits: any[];
  }> {
    try {
      // This would need to be implemented with proper transaction tracking
      return {
        totalDeposits: 0,
        totalAmount: 0,
        recentDeposits: []
      };
    } catch (error) {
      console.error('Error getting deposit stats:', error);
      return {
        totalDeposits: 0,
        totalAmount: 0,
        recentDeposits: []
      };
    }
  }
}