import { UserBalance, DepositTransaction } from '../types/ProxyTypes';
import { BalanceStorage } from '../storage/BalanceStorage';

/**
 * Manages SVMAI token balances with Qdrant database tracking
 */
export class SVMAIBalanceManager {
  private storage: BalanceStorage;

  constructor() {
    this.storage = new BalanceStorage();
  }

  /**
   * Initialize the balance manager
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /**
   * Get user's SVMAI balance
   */
  async getBalance(userId: string): Promise<UserBalance> {
    try {
      let balance = await this.storage.getBalance(userId);
      
      if (!balance) {
        // Create initial balance record
        balance = {
          userId,
          svmaiBalance: 0,
          reservedBalance: 0,
          availableBalance: 0,
          totalDeposited: 0,
          totalSpent: 0,
          lastUpdated: new Date()
        };
        
        await this.storage.storeBalance(balance);
      }

      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw new Error('Failed to get balance');
    }
  }

  /**
   * Add SVMAI tokens to user balance (from confirmed deposit)
   */
  async addBalance(userId: string, amount: number, transactionId: string): Promise<UserBalance> {
    try {
      const currentBalance = await this.getBalance(userId);
      
      const newSvmaiBalance = currentBalance.svmaiBalance + amount;
      
      const newBalance: UserBalance = {
        ...currentBalance,
        svmaiBalance: newSvmaiBalance,
        availableBalance: newSvmaiBalance - currentBalance.reservedBalance,
        totalDeposited: currentBalance.totalDeposited + amount,
        lastUpdated: new Date()
      };

      await this.storage.storeBalance(newBalance);
      
      // Log the deposit transaction
      await this.storage.logTransaction({
        id: transactionId,
        userId,
        type: 'deposit',
        amount,
        balanceAfter: newBalance.svmaiBalance,
        timestamp: new Date(),
        metadata: { source: 'solana_deposit' }
      });

      return newBalance;
    } catch (error) {
      console.error('Failed to add balance:', error);
      throw new Error('Failed to add balance');
    }
  }

  /**
   * Reserve SVMAI tokens for a request (pre-authorization)
   */
  async reserveBalance(userId: string, amount: number, requestId: string): Promise<boolean> {
    try {
      const currentBalance = await this.getBalance(userId);
      
      if (currentBalance.availableBalance < amount) {
        return false; // Insufficient balance
      }

      const newReservedBalance = currentBalance.reservedBalance + amount;
      
      const newBalance: UserBalance = {
        ...currentBalance,
        reservedBalance: newReservedBalance,
        availableBalance: currentBalance.svmaiBalance - newReservedBalance,
        lastUpdated: new Date()
      };

      await this.storage.storeBalance(newBalance);
      
      // Log the reservation
      await this.storage.logTransaction({
        id: `reserve_${requestId}`,
        userId,
        type: 'reserve',
        amount,
        balanceAfter: newBalance.svmaiBalance,
        timestamp: new Date(),
        metadata: { requestId, reserved: amount }
      });

      return true;
    } catch (error) {
      console.error('Failed to reserve balance:', error);
      return false;
    }
  }

  /**
   * Consume reserved SVMAI tokens (after successful request)
   */
  async consumeReservedBalance(
    userId: string, 
    reservedAmount: number, 
    actualAmount: number, 
    requestId: string
  ): Promise<UserBalance> {
    try {
      const currentBalance = await this.getBalance(userId);
      
      // Calculate the difference between reserved and actual
      const refundAmount = reservedAmount - actualAmount;
      
      const newSvmaiBalance = currentBalance.svmaiBalance - actualAmount;
      const newReservedBalance = currentBalance.reservedBalance - reservedAmount;
      
      const newBalance: UserBalance = {
        ...currentBalance,
        svmaiBalance: newSvmaiBalance,
        reservedBalance: newReservedBalance,
        availableBalance: newSvmaiBalance - newReservedBalance,
        totalSpent: currentBalance.totalSpent + actualAmount,
        lastUpdated: new Date()
      };

      await this.storage.storeBalance(newBalance);
      
      // Log the consumption
      await this.storage.logTransaction({
        id: `consume_${requestId}`,
        userId,
        type: 'consume',
        amount: actualAmount,
        balanceAfter: newBalance.svmaiBalance,
        timestamp: new Date(),
        metadata: { 
          requestId, 
          reserved: reservedAmount, 
          consumed: actualAmount, 
          refunded: refundAmount 
        }
      });

      return newBalance;
    } catch (error) {
      console.error('Failed to consume reserved balance:', error);
      throw new Error('Failed to consume reserved balance');
    }
  }

  /**
   * Release reserved balance (if request failed)
   */
  async releaseReservedBalance(userId: string, amount: number, requestId: string): Promise<UserBalance> {
    try {
      const currentBalance = await this.getBalance(userId);
      
      const newReservedBalance = currentBalance.reservedBalance - amount;
      
      const newBalance: UserBalance = {
        ...currentBalance,
        reservedBalance: newReservedBalance,
        availableBalance: currentBalance.svmaiBalance - newReservedBalance,
        lastUpdated: new Date()
      };

      await this.storage.storeBalance(newBalance);
      
      // Log the release
      await this.storage.logTransaction({
        id: `release_${requestId}`,
        userId,
        type: 'release',
        amount,
        balanceAfter: newBalance.svmaiBalance,
        timestamp: new Date(),
        metadata: { requestId, released: amount }
      });

      return newBalance;
    } catch (error) {
      console.error('Failed to release reserved balance:', error);
      throw new Error('Failed to release reserved balance');
    }
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<any[]> {
    try {
      return await this.storage.getTransactionHistory(userId, limit, offset);
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Get balance statistics for admin/monitoring
   */
  async getBalanceStats(): Promise<{
    totalUsers: number;
    totalBalance: number;
    totalDeposited: number;
    totalSpent: number;
    totalReserved: number;
  }> {
    try {
      return await this.storage.getBalanceStats();
    } catch (error) {
      console.error('Failed to get balance stats:', error);
      return {
        totalUsers: 0,
        totalBalance: 0,
        totalDeposited: 0,
        totalSpent: 0,
        totalReserved: 0
      };
    }
  }

  /**
   * Check if user has sufficient balance for a request
   */
  async hasSufficientBalance(userId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.getBalance(userId);
      return balance.availableBalance >= requiredAmount;
    } catch (error) {
      console.error('Failed to check balance:', error);
      return false;
    }
  }

  /**
   * Get low balance users (for notifications)
   */
  async getLowBalanceUsers(threshold: number = 10): Promise<string[]> {
    try {
      return await this.storage.getLowBalanceUsers(threshold);
    } catch (error) {
      console.error('Failed to get low balance users:', error);
      return [];
    }
  }
}