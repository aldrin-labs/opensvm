import { SVMAIBalanceManager } from '../../../lib/anthropic-proxy/billing/SVMAIBalanceManager';
import { BalanceStorage } from '../../../lib/anthropic-proxy/storage/BalanceStorage';
import { UserBalance } from '../../../lib/anthropic-proxy/types/ProxyTypes';

// Mock the BalanceStorage
jest.mock('../../../lib/anthropic-proxy/storage/BalanceStorage');

const MockedBalanceStorage = BalanceStorage as jest.MockedClass<typeof BalanceStorage>;

describe('SVMAIBalanceManager', () => {
  let balanceManager: SVMAIBalanceManager;
  let mockStorage: jest.Mocked<BalanceStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = new MockedBalanceStorage() as jest.Mocked<BalanceStorage>;
    balanceManager = new SVMAIBalanceManager();
    (balanceManager as any).storage = mockStorage;
  });

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      const userId = 'user123';
      const mockBalance: UserBalance = {
        userId,
        svmaiBalance: 100,
        reservedBalance: 10,
        availableBalance: 90,
        totalDeposited: 150,
        totalSpent: 50,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.getBalance(userId);

      expect(result).toEqual(mockBalance);
      expect(mockStorage.getBalance).toHaveBeenCalledWith(userId);
    });

    it('should create initial balance for new user', async () => {
      const userId = 'newuser';
      
      mockStorage.getBalance.mockResolvedValue(null);
      mockStorage.storeBalance.mockResolvedValue();

      const result = await balanceManager.getBalance(userId);

      expect(result).toEqual({
        userId,
        svmaiBalance: 0,
        reservedBalance: 0,
        availableBalance: 0,
        totalDeposited: 0,
        totalSpent: 0,
        lastUpdated: expect.any(Date)
      });

      expect(mockStorage.storeBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          svmaiBalance: 0,
          reservedBalance: 0,
          availableBalance: 0
        })
      );
    });
  });

  describe('addBalance', () => {
    it('should add balance and log transaction', async () => {
      const userId = 'user123';
      const amount = 50;
      const transactionId = 'tx123';
      
      const currentBalance: UserBalance = {
        userId,
        svmaiBalance: 100,
        reservedBalance: 10,
        availableBalance: 90,
        totalDeposited: 100,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(currentBalance);
      mockStorage.storeBalance.mockResolvedValue();
      mockStorage.logTransaction.mockResolvedValue();

      const result = await balanceManager.addBalance(userId, amount, transactionId);

      expect(result).toEqual({
        userId,
        svmaiBalance: 150,
        reservedBalance: 10,
        availableBalance: 140,
        totalDeposited: 150,
        totalSpent: 0,
        lastUpdated: expect.any(Date)
      });

      expect(mockStorage.storeBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          svmaiBalance: 150,
          availableBalance: 140,
          totalDeposited: 150
        })
      );

      expect(mockStorage.logTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: transactionId,
          userId,
          type: 'deposit',
          amount
        })
      );
    });
  });

  describe('reserveBalance', () => {
    it('should reserve balance when sufficient funds available', async () => {
      const userId = 'user123';
      const amount = 20;
      const requestId = 'req123';
      
      const currentBalance: UserBalance = {
        userId,
        svmaiBalance: 100,
        reservedBalance: 10,
        availableBalance: 90,
        totalDeposited: 100,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(currentBalance);
      mockStorage.storeBalance.mockResolvedValue();
      mockStorage.logTransaction.mockResolvedValue();

      const result = await balanceManager.reserveBalance(userId, amount, requestId);

      expect(result).toBe(true);
      expect(mockStorage.storeBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          reservedBalance: 30,
          availableBalance: 70
        })
      );
    });

    it('should reject reservation when insufficient funds', async () => {
      const userId = 'user123';
      const amount = 100;
      const requestId = 'req123';
      
      const currentBalance: UserBalance = {
        userId,
        svmaiBalance: 50,
        reservedBalance: 10,
        availableBalance: 40,
        totalDeposited: 50,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(currentBalance);

      const result = await balanceManager.reserveBalance(userId, amount, requestId);

      expect(result).toBe(false);
      expect(mockStorage.storeBalance).not.toHaveBeenCalled();
    });
  });

  describe('consumeReservedBalance', () => {
    it('should consume reserved balance and refund difference', async () => {
      const userId = 'user123';
      const reservedAmount = 30;
      const actualAmount = 25;
      const requestId = 'req123';
      
      const currentBalance: UserBalance = {
        userId,
        svmaiBalance: 100,
        reservedBalance: 30,
        availableBalance: 70,
        totalDeposited: 100,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(currentBalance);
      mockStorage.storeBalance.mockResolvedValue();
      mockStorage.logTransaction.mockResolvedValue();

      const result = await balanceManager.consumeReservedBalance(
        userId, 
        reservedAmount, 
        actualAmount, 
        requestId
      );

      expect(result).toEqual({
        userId,
        svmaiBalance: 75, // 100 - 25
        reservedBalance: 0, // 30 - 30
        availableBalance: 75, // 75 (svmaiBalance) - 0 (reservedBalance)
        totalDeposited: 100,
        totalSpent: 25,
        lastUpdated: expect.any(Date)
      });

      expect(mockStorage.logTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'consume',
          amount: actualAmount,
          metadata: expect.objectContaining({
            reserved: reservedAmount,
            consumed: actualAmount,
            refunded: 5
          })
        })
      );
    });
  });

  describe('releaseReservedBalance', () => {
    it('should release reserved balance back to available', async () => {
      const userId = 'user123';
      const amount = 20;
      const requestId = 'req123';
      
      const currentBalance: UserBalance = {
        userId,
        svmaiBalance: 100,
        reservedBalance: 20,
        availableBalance: 80,
        totalDeposited: 100,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(currentBalance);
      mockStorage.storeBalance.mockResolvedValue();
      mockStorage.logTransaction.mockResolvedValue();

      const result = await balanceManager.releaseReservedBalance(userId, amount, requestId);

      expect(result).toEqual({
        userId,
        svmaiBalance: 100,
        reservedBalance: 0,
        availableBalance: 100,
        totalDeposited: 100,
        totalSpent: 0,
        lastUpdated: expect.any(Date)
      });

      expect(mockStorage.logTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'release',
          amount,
          metadata: expect.objectContaining({
            released: amount
          })
        })
      );
    });
  });

  describe('hasSufficientBalance', () => {
    it('should return true when balance is sufficient', async () => {
      const userId = 'user123';
      const requiredAmount = 50;
      
      const mockBalance: UserBalance = {
        userId,
        svmaiBalance: 100,
        reservedBalance: 10,
        availableBalance: 90,
        totalDeposited: 100,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.hasSufficientBalance(userId, requiredAmount);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient', async () => {
      const userId = 'user123';
      const requiredAmount = 100;
      
      const mockBalance: UserBalance = {
        userId,
        svmaiBalance: 50,
        reservedBalance: 10,
        availableBalance: 40,
        totalDeposited: 50,
        totalSpent: 0,
        lastUpdated: new Date()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.hasSufficientBalance(userId, requiredAmount);

      expect(result).toBe(false);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history', async () => {
      const userId = 'user123';
      const mockHistory = [
        {
          id: 'tx1',
          userId,
          type: 'deposit',
          amount: 100,
          balanceAfter: 100,
          timestamp: new Date(),
          metadata: {}
        }
      ];

      mockStorage.getTransactionHistory.mockResolvedValue(mockHistory);

      const result = await balanceManager.getTransactionHistory(userId);

      expect(result).toEqual(mockHistory);
      expect(mockStorage.getTransactionHistory).toHaveBeenCalledWith(userId, 50, 0);
    });
  });
});