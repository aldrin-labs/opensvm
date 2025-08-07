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
}