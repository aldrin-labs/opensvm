import { UserBalance } from '../types/ProxyTypes';

export class BalanceStorage {
  private balances = new Map<string, UserBalance>();

  async getBalance(userId: string): Promise<UserBalance | null> {
    return this.balances.get(userId) || null;
  }

  async updateBalance(userId: string, newBalance: number): Promise<void> {
    const existing = this.balances.get(userId);
    const userBalance: UserBalance = {
      userId,
      balance: newBalance,
      lastUpdated: Date.now()
    };
    
    if (existing) {
      userBalance.lastUpdated = Date.now();
    }
    
    this.balances.set(userId, userBalance);
  }

  async addToBalance(userId: string, amount: number): Promise<UserBalance> {
    const existing = await this.getBalance(userId);
    const currentBalance = existing?.balance || 0;
    const newBalance = currentBalance + amount;
    
    await this.updateBalance(userId, newBalance);
    return this.balances.get(userId)!;
  }

  async subtractFromBalance(userId: string, amount: number): Promise<UserBalance | null> {
    const existing = await this.getBalance(userId);
    if (!existing || existing.balance < amount) {
      return null;
    }
    
    const newBalance = existing.balance - amount;
    await this.updateBalance(userId, newBalance);
    return this.balances.get(userId)!;
  }

  async createUser(userId: string, initialBalance: number = 0): Promise<UserBalance> {
    const userBalance: UserBalance = {
      userId,
      balance: initialBalance,
      lastUpdated: Date.now()
    };
    
    this.balances.set(userId, userBalance);
    return userBalance;
  }

  async userExists(userId: string): Promise<boolean> {
    return this.balances.has(userId);
  }

  async getAllUsers(): Promise<UserBalance[]> {
    return Array.from(this.balances.values());
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.balances.delete(userId);
  }

  async clear(): Promise<void> {
    this.balances.clear();
  }
}