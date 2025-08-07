import { BalanceStorage } from '../storage/BalanceStorage';
import { UserBalance } from '../types/ProxyTypes';

export class SVMAIBalanceManager {
  private balanceStorage: BalanceStorage;

  constructor() {
    this.balanceStorage = new BalanceStorage();
  }

  async getBalance(userId: string): Promise<number> {
    const balance = await this.balanceStorage.getBalance(userId);
    return balance?.balance || 0;
  }

  async addBalance(userId: string, amount: number): Promise<UserBalance> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    return await this.balanceStorage.addToBalance(userId, amount);
  }

  async subtractBalance(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    const result = await this.balanceStorage.subtractFromBalance(userId, amount);
    return result !== null;
  }

  async hasBalance(userId: string, requiredAmount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= requiredAmount;
  }

  async createUser(userId: string, initialBalance: number = 0): Promise<UserBalance> {
    return await this.balanceStorage.createUser(userId, initialBalance);
  }

  async transferBalance(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const hasEnough = await this.hasBalance(fromUserId, amount);
    if (!hasEnough) {
      return false;
    }

    const subtracted = await this.balanceStorage.subtractFromBalance(fromUserId, amount);
    if (!subtracted) {
      return false;
    }

    await this.balanceStorage.addToBalance(toUserId, amount);
    return true;
  }

  async getUserBalance(userId: string): Promise<UserBalance | null> {
    return await this.balanceStorage.getBalance(userId);
  }

  async getAllUserBalances(): Promise<UserBalance[]> {
    return await this.balanceStorage.getAllUsers();
  }

  async userExists(userId: string): Promise<boolean> {
    return await this.balanceStorage.userExists(userId);
  }

  async deleteUser(userId: string): Promise<boolean> {
    return await this.balanceStorage.deleteUser(userId);
  }

  async initialize(): Promise<void> {
    // Initialize the balance storage if needed
    // BalanceStorage doesn't have an initialize method, so this is a no-op
  }

  async reserveBalance(userId: string, amount: number, requestId: string): Promise<boolean> {
    // Check if user has sufficient balance
    const hasEnough = await this.hasBalance(userId, amount);
    if (!hasEnough) {
      return false;
    }

    // For now, we'll simulate reservation by checking balance
    // In a production system, you'd implement actual balance reservation
    return true;
  }

  async consumeReservedBalance(userId: string, reservedAmount: number, actualAmount: number, requestId: string): Promise<boolean> {
    // Consume the actual amount and refund the difference if any
    const success = await this.subtractBalance(userId, actualAmount);
    if (success && actualAmount < reservedAmount) {
      // Refund the difference
      const refundAmount = reservedAmount - actualAmount;
      await this.addBalance(userId, refundAmount);
    }
    return success;
  }

  async releaseReservedBalance(userId: string, amount: number, requestId: string): Promise<boolean> {
    // In a real implementation, this would release reserved funds
    // For now, we'll just return true since we don't actually reserve
    return true;
  }

  async hasSufficientBalance(userId: string, requiredAmount: number): Promise<boolean> {
    return await this.hasBalance(userId, requiredAmount);
  }

  async getTransactionHistory(userId: string): Promise<any[]> {
    // Return empty array for now - would implement transaction history in production
    return [];
  }

  async storeBalance(balance: UserBalance): Promise<void> {
    // Store balance - implement as needed
    await this.balanceStorage.updateBalance(balance.userId, balance.balance);
  }

  async logTransaction(transaction: any): Promise<void> {
    // Log transaction - implement as needed
    console.log('Transaction logged:', transaction);
  }
}