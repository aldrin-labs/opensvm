import { QdrantClient } from '@qdrant/js-client-rest';
import { UserBalance } from '../types/ProxyTypes';

/**
 * Qdrant-based storage for SVMAI balances and transactions
 */

const BALANCE_COLLECTION = 'svmai_balances';
const TRANSACTION_COLLECTION = 'svmai_transactions';

export interface TransactionLog {
  id: string;
  userId: string;
  type: 'deposit' | 'consume' | 'reserve' | 'release';
  amount: number;
  balanceAfter: number;
  timestamp: Date;
  metadata?: any;
}

export class BalanceStorage {
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY
    });
  }

  /**
   * Initialize collections
   */
  async initialize(): Promise<void> {
    // Skip initialization during build time or when Qdrant is not available
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      console.log('Skipping BalanceStorage initialization during build');
      return;
    }

    try {
      const collections = await this.client.getCollections();
      const existingCollections = collections.collections.map(c => c.name);

      // Create balance collection if it doesn't exist
      if (!existingCollections.includes(BALANCE_COLLECTION)) {
        await this.client.createCollection(BALANCE_COLLECTION, {
          vectors: {
            size: 1,
            distance: 'Cosine'
          }
        });
      }

      // Create transaction collection if it doesn't exist
      if (!existingCollections.includes(TRANSACTION_COLLECTION)) {
        await this.client.createCollection(TRANSACTION_COLLECTION, {
          vectors: {
            size: 1,
            distance: 'Cosine'
          }
        });
      }
    } catch (error) {
      // Handle connection errors gracefully during build or when Qdrant is unavailable
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch failed') ||
        error.message.includes('Connection refused')
      )) {
        console.warn('BalanceStorage: Qdrant not available, skipping initialization:', error.message);
        return;
      }
      
      console.error('Failed to initialize BalanceStorage:', error);
      throw error;
    }
  }

  /**
   * Store user balance
   */
  async storeBalance(balance: UserBalance): Promise<void> {
    try {
      await this.client.upsert(BALANCE_COLLECTION, {
        wait: true,
        points: [
          {
            id: balance.userId,
            vector: [0],
            payload: {
              userId: balance.userId,
              svmaiBalance: balance.svmaiBalance,
              reservedBalance: balance.reservedBalance,
              availableBalance: balance.availableBalance,
              totalDeposited: balance.totalDeposited,
              totalSpent: balance.totalSpent,
              lastUpdated: balance.lastUpdated.toISOString()
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to store balance:', error);
      throw error;
    }
  }

  /**
   * Get user balance
   */
  async getBalance(userId: string): Promise<UserBalance | null> {
    try {
      const result = await this.client.retrieve(BALANCE_COLLECTION, {
        ids: [userId],
        with_payload: true
      });

      if (result.length === 0) {
        return null;
      }

      const payload = result[0].payload as any;
      return {
        userId: payload.userId,
        svmaiBalance: payload.svmaiBalance,
        reservedBalance: payload.reservedBalance,
        availableBalance: payload.availableBalance,
        totalDeposited: payload.totalDeposited,
        totalSpent: payload.totalSpent,
        lastUpdated: new Date(payload.lastUpdated)
      };
    } catch (error) {
      console.error('Failed to get balance:', error);
      return null;
    }
  }

  /**
   * Log transaction
   */
  async logTransaction(transaction: TransactionLog): Promise<void> {
    try {
      await this.client.upsert(TRANSACTION_COLLECTION, {
        wait: true,
        points: [
          {
            id: transaction.id,
            vector: [0],
            payload: {
              userId: transaction.userId,
              type: transaction.type,
              amount: transaction.amount,
              balanceAfter: transaction.balanceAfter,
              timestamp: transaction.timestamp.toISOString(),
              metadata: transaction.metadata || {}
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to log transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<TransactionLog[]> {
    try {
      const result = await this.client.scroll(TRANSACTION_COLLECTION, {
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: userId }
            }
          ]
        },
        limit,
        offset,
        with_payload: true
      });

      return result.points.map(point => {
        const payload = point.payload as any;
        return {
          id: point.id as string,
          userId: payload.userId,
          type: payload.type,
          amount: payload.amount,
          balanceAfter: payload.balanceAfter,
          timestamp: new Date(payload.timestamp),
          metadata: payload.metadata
        };
      });
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Get balance statistics
   */
  async getBalanceStats(): Promise<{
    totalUsers: number;
    totalBalance: number;
    totalDeposited: number;
    totalSpent: number;
    totalReserved: number;
  }> {
    try {
      // Get all balances (this could be optimized with aggregation)
      const result = await this.client.scroll(BALANCE_COLLECTION, {
        limit: 10000, // Adjust based on expected user count
        with_payload: true
      });

      let totalBalance = 0;
      let totalDeposited = 0;
      let totalSpent = 0;
      let totalReserved = 0;

      result.points.forEach(point => {
        const payload = point.payload as any;
        totalBalance += payload.svmaiBalance;
        totalDeposited += payload.totalDeposited;
        totalSpent += payload.totalSpent;
        totalReserved += payload.reservedBalance;
      });

      return {
        totalUsers: result.points.length,
        totalBalance,
        totalDeposited,
        totalSpent,
        totalReserved
      };
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
   * Get users with low balance
   */
  async getLowBalanceUsers(threshold: number): Promise<string[]> {
    try {
      const result = await this.client.scroll(BALANCE_COLLECTION, {
        filter: {
          must: [
            {
              key: 'availableBalance',
              range: {
                lt: threshold
              }
            }
          ]
        },
        limit: 1000,
        with_payload: true
      });

      return result.points.map(point => point.payload?.userId as string).filter(Boolean);
    } catch (error) {
      console.error('Failed to get low balance users:', error);
      return [];
    }
  }

  /**
   * Get all balances (for admin)
   */
  async getAllBalances(limit: number = 100, offset: number = 0): Promise<UserBalance[]> {
    try {
      const result = await this.client.scroll(BALANCE_COLLECTION, {
        limit,
        offset,
        with_payload: true
      });

      return result.points.map(point => {
        const payload = point.payload as any;
        return {
          userId: payload.userId,
          svmaiBalance: payload.svmaiBalance,
          reservedBalance: payload.reservedBalance,
          availableBalance: payload.availableBalance,
          totalDeposited: payload.totalDeposited,
          totalSpent: payload.totalSpent,
          lastUpdated: new Date(payload.lastUpdated)
        };
      });
    } catch (error) {
      console.error('Failed to get all balances:', error);
      return [];
    }
  }

  /**
   * Delete user balance (for cleanup/testing)
   */
  async deleteBalance(userId: string): Promise<void> {
    try {
      await this.client.delete(BALANCE_COLLECTION, {
        wait: true,
        points: [userId]
      });
    } catch (error) {
      console.error('Failed to delete balance:', error);
      throw error;
    }
  }
}