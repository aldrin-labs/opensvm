import { SVMAIBalanceManager } from '../../../lib/anthropic-proxy/billing/SVMAIBalanceManager';
import { BalanceStorage } from '../../../lib/anthropic-proxy/storage/BalanceStorage';
import { UserBalance } from '../../../lib/anthropic-proxy/types/ProxyTypes';

// Unmock the global SVMAIBalanceManager mock for this test
jest.unmock('../../../lib/anthropic-proxy/billing/SVMAIBalanceManager');

describe('SVMAIBalanceManager', () => {
  let balanceManager: SVMAIBalanceManager;
  let mockStorage: jest.Mocked<BalanceStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a proper mock with all required methods
    mockStorage = {
      initialize: jest.fn(),
      getBalance: jest.fn(),
      updateBalance: jest.fn(),
      addToBalance: jest.fn(),
      subtractFromBalance: jest.fn(),
      createUser: jest.fn(),
      userExists: jest.fn(),
      getAllUsers: jest.fn(),
      deleteUser: jest.fn(),
      clear: jest.fn(),
      logTransaction: jest.fn(),
      getTransactionHistory: jest.fn(),
      getTransactionById: jest.fn()
    } as unknown as jest.Mocked<BalanceStorage>;
    
    balanceManager = new SVMAIBalanceManager();
    (balanceManager as any).balanceStorage = mockStorage;
  });

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      const userId = 'user123';
      const mockBalance: UserBalance = {
        userId,
        balance: 100,
        lastUpdated: Date.now()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.getBalance(userId);

      expect(result).toBe(100);
      expect(mockStorage.getBalance).toHaveBeenCalledWith(userId);
    });

    it('should return 0 for new user', async () => {
      const userId = 'newuser';
      
      mockStorage.getBalance.mockResolvedValue(null);

      const result = await balanceManager.getBalance(userId);

      expect(result).toBe(0);
    });
  });

  describe('addBalance', () => {
    it('should add balance successfully', async () => {
      const userId = 'user123';
      const amount = 50;
      
      const mockBalance: UserBalance = {
        userId,
        balance: 150,
        lastUpdated: Date.now()
      };

      mockStorage.addToBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.addBalance(userId, amount);

      expect(result).toEqual(mockBalance);
      expect(mockStorage.addToBalance).toHaveBeenCalledWith(userId, amount);
    });

    it('should throw error for negative amount', async () => {
      const userId = 'user123';
      const amount = -10;

      await expect(balanceManager.addBalance(userId, amount)).rejects.toThrow('Amount must be positive');
    });
  });

  describe('subtractBalance', () => {
    it('should subtract balance successfully', async () => {
      const userId = 'user123';
      const amount = 25;
      
      const mockBalance: UserBalance = {
        userId,
        balance: 75,
        lastUpdated: Date.now()
      };

      mockStorage.subtractFromBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.subtractBalance(userId, amount);

      expect(result).toBe(true);
      expect(mockStorage.subtractFromBalance).toHaveBeenCalledWith(userId, amount);
    });

    it('should return false when subtraction fails', async () => {
      const userId = 'user123';
      const amount = 100;

      mockStorage.subtractFromBalance.mockResolvedValue(null);

      const result = await balanceManager.subtractBalance(userId, amount);

      expect(result).toBe(false);
    });
  });

  describe('reserveBalance', () => {
    it('should reserve balance when sufficient funds available', async () => {
      const userId = 'user123';
      const amount = 20;
      const requestId = 'req123';
      
      const mockBalance: UserBalance = {
        userId,
        balance: 100,
        lastUpdated: Date.now()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.reserveBalance(userId, amount, requestId);

      expect(result).toBe(true);
    });

    it('should reject reservation when insufficient funds', async () => {
      const userId = 'user123';
      const amount = 100;
      const requestId = 'req123';
      
      const mockBalance: UserBalance = {
        userId,
        balance: 50,
        lastUpdated: Date.now()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.reserveBalance(userId, amount, requestId);

      expect(result).toBe(false);
    });
  });

  describe('consumeReservedBalance', () => {
    it('should consume reserved balance and refund difference', async () => {
      const userId = 'user123';
      const reservedAmount = 30;
      const actualAmount = 25;
      const requestId = 'req123';
      
      const mockBalance: UserBalance = {
        userId,
        balance: 75,
        lastUpdated: Date.now()
      };

      mockStorage.subtractFromBalance.mockResolvedValue(mockBalance);
      mockStorage.addToBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.consumeReservedBalance(
        userId, 
        reservedAmount, 
        actualAmount, 
        requestId
      );

      expect(result).toBe(true);
      expect(mockStorage.subtractFromBalance).toHaveBeenCalledWith(userId, actualAmount);
      expect(mockStorage.addToBalance).toHaveBeenCalledWith(userId, 5); // refund
    });
  });

  describe('releaseReservedBalance', () => {
    it('should release reserved balance back to available', async () => {
      const userId = 'user123';
      const amount = 20;
      const requestId = 'req123';

      const result = await balanceManager.releaseReservedBalance(userId, amount, requestId);

      expect(result).toBe(true);
    });
  });

  describe('hasSufficientBalance', () => {
    it('should return true when balance is sufficient', async () => {
      const userId = 'user123';
      const requiredAmount = 50;
      
      const mockBalance: UserBalance = {
        userId,
        balance: 100,
        lastUpdated: Date.now()
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
        balance: 50,
        lastUpdated: Date.now()
      };

      mockStorage.getBalance.mockResolvedValue(mockBalance);

      const result = await balanceManager.hasSufficientBalance(userId, requiredAmount);

      expect(result).toBe(false);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return empty transaction history', async () => {
      const userId = 'user123';

      const result = await balanceManager.getTransactionHistory(userId);

      expect(result).toEqual([]);
    });
  });
});