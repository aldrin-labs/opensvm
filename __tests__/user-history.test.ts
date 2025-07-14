/**
 * User History Service Tests
 * Tests for the user history tracking functionality
 */

import { UserHistoryService } from '@/lib/user-history';
import { UserHistoryEntry } from '@/types/user-history';

// Mock localStorage for testing
const mockLocalStorage: {
  data: Record<string, string>;
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  clear: () => void;
  length: number;
  key: (index?: number) => string | null;
} = {
  data: {} as Record<string, string>,
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.data[key] = value;
  }),
  getItem: jest.fn((key: string): string | null => {
    return mockLocalStorage.data[key] || null;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.data[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.data = {};
  }),
  length: 0,
  key: jest.fn()
};

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('UserHistoryService', () => {
  const testWallet = '11111111111111111111111111111111';
  
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('addHistoryEntry', () => {
    it('should add a history entry successfully', () => {
      const entry: UserHistoryEntry = {
        id: 'test-id',
        walletAddress: testWallet,
        timestamp: Date.now(),
        path: '/test-path',
        pageType: 'transaction',
        pageTitle: 'Test Transaction',
        metadata: {
          transactionId: 'test-tx-id'
        }
      };

      UserHistoryService.addHistoryEntry(entry);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `opensvm_user_history_${testWallet}`,
        expect.stringContaining(entry.path)
      );
    });
  });

  describe('getUserHistory', () => {
    it('should return empty array for non-existent user', () => {
      const history = UserHistoryService.getUserHistory('non-existent-wallet');
      expect(history).toEqual([]);
    });

    it('should return stored history for existing user', () => {
      const testHistory: UserHistoryEntry[] = [
        {
          id: 'test-1',
          walletAddress: testWallet,
          timestamp: Date.now(),
          path: '/test-1',
          pageType: 'transaction',
          pageTitle: 'Test 1'
        }
      ];

      mockLocalStorage.data[`opensvm_user_history_${testWallet}`] = JSON.stringify(testHistory);

      const history = UserHistoryService.getUserHistory(testWallet);
      expect(history).toEqual(testHistory);
    });
  });

  describe('exportUserHistoryAsCSV', () => {
    it('should generate CSV with proper headers', () => {
      const testHistory: UserHistoryEntry[] = [
        {
          id: 'test-1',
          walletAddress: testWallet,
          timestamp: 1672531200000, // 2023-01-01
          path: '/tx/test-signature',
          pageType: 'transaction',
          pageTitle: 'Test Transaction',
          metadata: {
            transactionId: 'test-signature'
          },
          userAgent: 'Test Agent',
          referrer: 'https://test.com'
        }
      ];

      mockLocalStorage.data[`opensvm_user_history_${testWallet}`] = JSON.stringify(testHistory);

      const csv = UserHistoryService.exportUserHistoryAsCSV(testWallet);
      
      expect(csv).toContain('Timestamp,Date,Time,Page Type');
      expect(csv).toContain('1672531200000');
      expect(csv).toContain('transaction');
      expect(csv).toContain('Test Transaction');
      expect(csv).toContain('test-signature');
    });

    it('should handle empty history gracefully', () => {
      const csv = UserHistoryService.exportUserHistoryAsCSV('empty-wallet');
      
      expect(csv).toContain('Timestamp,Date,Time,Page Type');
      // Should have headers but no data rows
      const lines = csv.split('\n');
      expect(lines.length).toBe(2); // Header + empty line
    });
  });

  describe('clearUserHistory', () => {
    it('should remove user data from localStorage', () => {
      // Add some test data first
      mockLocalStorage.data[`opensvm_user_history_${testWallet}`] = '[]';
      mockLocalStorage.data[`opensvm_user_profiles_${testWallet}`] = '{}';

      UserHistoryService.clearUserHistory(testWallet);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`opensvm_user_history_${testWallet}`);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`opensvm_user_profiles_${testWallet}`);
    });
  });
});

// Export for manual testing
export { mockLocalStorage };
