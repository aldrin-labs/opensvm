import { UserBalance } from '../types/ProxyTypes';

export class BalanceStorage {
  private balances = new Map<string, UserBalance>();

  async initialize(): Promise<void> {
    // Initialize the storage system - for in-memory storage, this is a no-op
    // but could be used for database connections, file system setup, etc.
  }

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

  // Transaction logging methods
  private transactions: Map<string, any> = new Map();

  async logTransaction(transaction: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    timestamp: Date;
    metadata?: Record<string, any>;
  }): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async getTransactionHistory(userId: string): Promise<any[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return userTransactions;
  }

  async getTransactionById(transactionId: string): Promise<any | null> {
    return this.transactions.get(transactionId) || null;
  }
}