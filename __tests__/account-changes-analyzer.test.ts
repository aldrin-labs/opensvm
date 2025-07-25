import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { accountChangesAnalyzer } from '../lib/account-changes-analyzer';
import type { 
  AccountChange, 
  AccountChangesAnalysis, 
  TokenChange 
} from '../lib/account-changes-analyzer';
import type { DetailedTransactionInfo } from '../lib/solana';

// Mock the transaction analysis cache
jest.mock('../lib/transaction-analysis-cache', () => ({
  transactionAnalysisCache: {
    getCachedAccountChanges: jest.fn(() => Promise.resolve(null)),
    cacheAccountChanges: jest.fn(() => Promise.resolve())
  }
}));

describe('AccountChangesAnalyzer', () => {
  let mockTransaction: DetailedTransactionInfo;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a comprehensive mock transaction
    mockTransaction = {
      signature: 'test-signature-123',
      slot: 123456789,
      blockTime: Date.now(),
      success: true,
      details: {
        accounts: [
          { pubkey: 'account1', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'account2', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'token_account1', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { pubkey: 'token_account2', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
        ],
        preBalances: [2000000000, 1000000000, 2039280, 2039280], // 2 SOL, 1 SOL, rent-exempt amounts
        postBalances: [1500000000, 1495000000, 2039280, 2039280], // 1.5 SOL, 1.495 SOL (after fees)
        preTokenBalances: [
          {
            accountIndex: 2,
            mint: 'token_mint_1',
            owner: 'account1',
            uiTokenAmount: {
              amount: '1000000000',
              decimals: 9,
              uiAmount: 1000,
              uiAmountString: '1000'
            }
          }
        ],
        postTokenBalances: [
          {
            accountIndex: 2,
            mint: 'token_mint_1',
            owner: 'account1',
            uiTokenAmount: {
              amount: '500000000',
              decimals: 9,
              uiAmount: 500,
              uiAmountString: '500'
            }
          },
          {
            accountIndex: 3,
            mint: 'token_mint_1',
            owner: 'account2',
            uiTokenAmount: {
              amount: '500000000',
              decimals: 9,
              uiAmount: 500,
              uiAmountString: '500'
            }
          }
        ]
      }
    };
  });

  describe('analyzeTransaction', () => {
    it('should analyze a successful transaction with SOL and token changes', async () => {
      const analysis = await accountChangesAnalyzer.analyzeTransaction(mockTransaction);

      expect(analysis).toBeDefined();
      expect(analysis.totalAccounts).toBe(4);
      expect(analysis.changedAccounts).toBe(2); // Only accounts with significant changes
      
      // SOL changes analysis
      expect(analysis.solChanges.totalSolChange).toBe(-10000000); // Net loss due to fees
      expect(analysis.solChanges.positiveChanges).toBe(0);
      expect(analysis.solChanges.negativeChanges).toBe(2);
      expect(analysis.solChanges.largestDecrease).toBeDefined();
      expect(analysis.solChanges.largestDecrease?.balanceChange).toBe(-500000000);

      // Token changes analysis
      expect(analysis.tokenChanges.totalTokensAffected).toBe(2); // Transfer from account2 to account3
      expect(analysis.tokenChanges.uniqueTokens).toContain('token_mint_1');
      expect(analysis.tokenChanges.significantChanges.length).toBeGreaterThan(0);

      // Risk assessment
      expect(analysis.riskAssessment.level).toBe('low'); // Normal transfer
      expect(analysis.riskAssessment.factors).toBeDefined();
      expect(analysis.riskAssessment.recommendations).toBeDefined();
    });

    it('should handle failed transactions correctly', async () => {
      const failedTransaction = {
        ...mockTransaction,
        success: false,
        details: {
          ...mockTransaction.details!,
          postBalances: mockTransaction.details!.preBalances // No changes due to failure
        }
      };

      const analysis = await accountChangesAnalyzer.analyzeTransaction(failedTransaction);

      expect(analysis.riskAssessment.factors).toContain('Transaction failed');
      expect(analysis.riskAssessment.level).toBe('low'); // Failed transaction with no changes
    });

    it('should detect high-risk transactions with large transfers', async () => {
      const highValueTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [100000000000, 1000000000, 2039280, 2039280], // 100 SOL
          postBalances: [1000000000, 99995000000, 2039280, 2039280] // Transfer 99 SOL
        }
      };

      const analysis = await accountChangesAnalyzer.analyzeTransaction(highValueTransaction);

      expect(analysis.riskAssessment.level).toBe('medium'); // Large SOL transfer
      expect(analysis.riskAssessment.factors).toContain('Large SOL transfers detected');
      expect(analysis.solChanges.largestIncrease?.balanceChange).toBe(98995000000);
    });

    it('should handle transactions with no account changes', async () => {
      const noChangeTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [1000000000, 1000000000, 2039280, 2039280],
          postBalances: [1000000000, 1000000000, 2039280, 2039280],
          preTokenBalances: [],
          postTokenBalances: []
        }
      };

      const analysis = await accountChangesAnalyzer.analyzeTransaction(noChangeTransaction);

      expect(analysis.changedAccounts).toBe(0);
      expect(analysis.solChanges.totalSolChange).toBe(0);
      expect(analysis.tokenChanges.totalTokensAffected).toBe(0);
      expect(analysis.riskAssessment.level).toBe('low');
    });
  });

  describe('calculateAccountChanges', () => {
    it('should calculate detailed account changes correctly', () => {
      const changes = accountChangesAnalyzer.calculateAccountChanges(mockTransaction);

      expect(changes).toHaveLength(4);
      
      // First account (sender)
      expect(changes[0].pubkey).toBe('account1');
      expect(changes[0].preBalance).toBe(2000000000);
      expect(changes[0].postBalance).toBe(1500000000);
      expect(changes[0].balanceChange).toBe(-500000000);
      
      // Second account (receiver)
      expect(changes[1].pubkey).toBe('account2');
      expect(changes[1].preBalance).toBe(1000000000);
      expect(changes[1].postBalance).toBe(1495000000);
      expect(changes[1].balanceChange).toBe(495000000);

      // Token accounts should have token changes
      expect(changes[2].tokenChanges).toHaveLength(1);
      expect(changes[2].tokenChanges[0].change).toBe(-500); // Lost 500 tokens
      expect(changes[3].tokenChanges).toHaveLength(1);
      expect(changes[3].tokenChanges[0].change).toBe(500); // Gained 500 tokens
    });

    it('should handle missing balance data gracefully', () => {
      const incompleteTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [1000000000], // Missing balances
          postBalances: [1000000000, 2000000000] // Different length
        }
      };

      const changes = accountChangesAnalyzer.calculateAccountChanges(incompleteTransaction);

      expect(changes).toHaveLength(4); // Should still process all accounts
      expect(changes[0].balanceChange).toBe(0); // Default to 0 for missing data
      expect(changes[1].balanceChange).toBe(2000000000); // Only post balance available
    });
  });

  describe('token change analysis', () => {
    it('should calculate token changes correctly', () => {
      const changes = accountChangesAnalyzer.calculateAccountChanges(mockTransaction);
      const tokenAccount1 = changes[2];
      const tokenAccount2 = changes[3];

      expect(tokenAccount1.tokenChanges).toHaveLength(1);
      expect(tokenAccount1.tokenChanges[0].mint).toBe('token_mint_1');
      expect(tokenAccount1.tokenChanges[0].preAmount).toBe(1000);
      expect(tokenAccount1.tokenChanges[0].postAmount).toBe(500);
      expect(tokenAccount1.tokenChanges[0].change).toBe(-500);
      expect(tokenAccount1.tokenChanges[0].changePercent).toBe(-50);

      expect(tokenAccount2.tokenChanges).toHaveLength(1);
      expect(tokenAccount2.tokenChanges[0].mint).toBe('token_mint_1');
      expect(tokenAccount2.tokenChanges[0].preAmount).toBe(0);
      expect(tokenAccount2.tokenChanges[0].postAmount).toBe(500);
      expect(tokenAccount2.tokenChanges[0].change).toBe(500);
      expect(tokenAccount2.tokenChanges[0].changePercent).toBe(100);
    });

    it('should assess token change significance correctly', () => {
      const changes = accountChangesAnalyzer.calculateAccountChanges(mockTransaction);
      const tokenChange = changes[2].tokenChanges[0];

      expect(tokenChange.significance).toBe('high'); // 500 token change is significant
    });

    it('should handle multiple token types', () => {
      const multiTokenTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preTokenBalances: [
            {
              accountIndex: 2,
              mint: 'token_mint_1',
              owner: 'account1',
              uiTokenAmount: { amount: '1000000000', decimals: 9, uiAmount: 1000, uiAmountString: '1000' }
            },
            {
              accountIndex: 2,
              mint: 'token_mint_2',
              owner: 'account1',
              uiTokenAmount: { amount: '2000000000', decimals: 9, uiAmount: 2000, uiAmountString: '2000' }
            }
          ],
          postTokenBalances: [
            {
              accountIndex: 2,
              mint: 'token_mint_1',
              owner: 'account1',
              uiTokenAmount: { amount: '500000000', decimals: 9, uiAmount: 500, uiAmountString: '500' }
            },
            {
              accountIndex: 2,
              mint: 'token_mint_2',
              owner: 'account1',
              uiTokenAmount: { amount: '1500000000', decimals: 9, uiAmount: 1500, uiAmountString: '1500' }
            }
          ]
        }
      };

      const changes = accountChangesAnalyzer.calculateAccountChanges(multiTokenTransaction);
      const tokenAccount = changes[2];

      expect(tokenAccount.tokenChanges).toHaveLength(2);
      expect(tokenAccount.tokenChanges.map(tc => tc.mint)).toContain('token_mint_1');
      expect(tokenAccount.tokenChanges.map(tc => tc.mint)).toContain('token_mint_2');
    });
  });

  describe('risk assessment', () => {
    it('should assess low risk for normal transactions', async () => {
      const analysis = await accountChangesAnalyzer.analyzeTransaction(mockTransaction);

      expect(analysis.riskAssessment.level).toBe('low');
      expect(analysis.riskAssessment.factors.length).toBeLessThan(3);
      expect(analysis.riskAssessment.recommendations).toContain('Transaction appears to have standard risk profile');
    });

    it('should assess medium risk for moderately complex transactions', async () => {
      const mediumRiskTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [5000000000, 1000000000, 2039280, 2039280], // 5 SOL transfer
          postBalances: [1000000000, 4995000000, 2039280, 2039280],
          accounts: Array.from({ length: 12 }, (_, i) => ({ // Many accounts
            pubkey: `account${i}`,
            executable: false,
            owner: '11111111111111111111111111111111'
          }))
        }
      };

      const analysis = await accountChangesAnalyzer.analyzeTransaction(mediumRiskTransaction);

      expect(analysis.riskAssessment.level).toBe('medium');
      expect(analysis.riskAssessment.factors).toContain('Large SOL transfers detected');
      expect(analysis.riskAssessment.factors).toContain('High number of account interactions');
    });

    it('should assess high risk for complex transactions with ownership changes', async () => {
      const highRiskTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [50000000000, 1000000000, 2039280, 2039280], // 50 SOL
          postBalances: [1000000000, 49995000000, 2039280, 2039280]
        }
      };

      // Mock ownership changes by simulating data changes
      const originalCalculateChanges = accountChangesAnalyzer.calculateAccountChanges;
      jest.spyOn(accountChangesAnalyzer, 'calculateAccountChanges').mockImplementation((transaction) => {
        const changes = originalCalculateChanges.call(accountChangesAnalyzer, transaction);
        // Simulate ownership change
        changes[0].ownerChange = {
          hasChanged: true,
          preOwner: '11111111111111111111111111111111',
          postOwner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        };
        return changes;
      });

      const analysis = await accountChangesAnalyzer.analyzeTransaction(highRiskTransaction);

      expect(analysis.riskAssessment.level).toBe('high');
      expect(analysis.riskAssessment.factors).toContain('Large SOL transfers detected');
      expect(analysis.riskAssessment.factors).toContain('Account ownership changes detected');
      expect(analysis.riskAssessment.recommendations).toContain('Carefully review all account changes before proceeding');

      jest.restoreAllMocks();
    });

    it('should provide appropriate recommendations based on risk factors', async () => {
      const analysis = await accountChangesAnalyzer.analyzeTransaction(mockTransaction);

      expect(analysis.riskAssessment.recommendations).toBeDefined();
      expect(analysis.riskAssessment.recommendations.length).toBeGreaterThan(0);
      expect(typeof analysis.riskAssessment.recommendations[0]).toBe('string');
    });
  });

  describe('data change analysis', () => {
    it('should detect account data changes', () => {
      const changes = accountChangesAnalyzer.calculateAccountChanges(mockTransaction);
      
      // Token accounts should have data changes detected
      const tokenAccount = changes[2];
      expect(tokenAccount.dataChange).toBeDefined();
      expect(tokenAccount.dataChange?.hasChanged).toBe(true);
      expect(tokenAccount.dataChange?.significance).toBeDefined();
    });

    it('should classify data change significance correctly', () => {
      const changes = accountChangesAnalyzer.calculateAccountChanges(mockTransaction);
      const tokenAccount = changes[2];

      expect(tokenAccount.dataChange?.significance).toBeOneOf(['low', 'medium', 'high']);
      expect(tokenAccount.dataChange?.dataType).toBe('token_account');
    });
  });

  describe('rent exempt status analysis', () => {
    it('should calculate rent exempt status correctly', () => {
      const changes = accountChangesAnalyzer.calculateAccountChanges(mockTransaction);
      
      // Token accounts with 2039280 lamports should be rent exempt
      const tokenAccount = changes[2];
      expect(tokenAccount.rentExemptStatus?.preRentExempt).toBe(true);
      expect(tokenAccount.rentExemptStatus?.postRentExempt).toBe(true);
      expect(tokenAccount.rentExemptStatus?.changed).toBe(false);
    });

    it('should detect rent exempt status changes', () => {
      const rentChangeTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [2000000000, 1000000000, 500000, 2039280], // Below rent exempt
          postBalances: [1500000000, 1495000000, 2039280, 2039280] // Now rent exempt
        }
      };

      const changes = accountChangesAnalyzer.calculateAccountChanges(rentChangeTransaction);
      const account = changes[2];

      expect(account.rentExemptStatus?.preRentExempt).toBe(false);
      expect(account.rentExemptStatus?.postRentExempt).toBe(true);
      expect(account.rentExemptStatus?.changed).toBe(true);
    });
  });

  describe('utility functions', () => {
    it('should format SOL amounts correctly', () => {
      const { formatSolAmount } = require('../lib/account-changes-analyzer');
      
      expect(formatSolAmount(1000000000)).toBe('1.000000000 SOL');
      expect(formatSolAmount(500000000)).toBe('0.500000000 SOL');
      expect(formatSolAmount(1)).toBe('0.000000001 SOL');
    });

    it('should format token amounts correctly', () => {
      const { formatTokenAmount } = require('../lib/account-changes-analyzer');
      
      expect(formatTokenAmount(1000, 9, 'USDC')).toBe('1,000 USDC');
      expect(formatTokenAmount(1500.5, 6, 'USDT')).toBe('1,500.5 USDT');
      expect(formatTokenAmount(1000000, 9)).toBe('1,000,000');
    });

    it('should determine change direction correctly', () => {
      const { getChangeDirection } = require('../lib/account-changes-analyzer');
      
      expect(getChangeDirection(100)).toBe('increase');
      expect(getChangeDirection(-100)).toBe('decrease');
      expect(getChangeDirection(0)).toBe('none');
    });

    it('should provide appropriate colors for changes', () => {
      const { getChangeColor, getRiskColor } = require('../lib/account-changes-analyzer');
      
      expect(getChangeColor(100)).toContain('green');
      expect(getChangeColor(-100)).toContain('red');
      expect(getChangeColor(0)).toContain('muted');
      
      expect(getRiskColor('low')).toContain('green');
      expect(getRiskColor('medium')).toContain('yellow');
      expect(getRiskColor('high')).toContain('red');
    });
  });

  describe('performance and edge cases', () => {
    it('should handle transactions with many accounts efficiently', async () => {
      const manyAccountsTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          accounts: Array.from({ length: 50 }, (_, i) => ({
            pubkey: `account${i}`,
            executable: false,
            owner: '11111111111111111111111111111111'
          })),
          preBalances: Array.from({ length: 50 }, () => 1000000000),
          postBalances: Array.from({ length: 50 }, (_, i) => 1000000000 + (i * 1000000))
        }
      };

      const startTime = Date.now();
      const analysis = await accountChangesAnalyzer.analyzeTransaction(manyAccountsTransaction);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(analysis.totalAccounts).toBe(50);
      expect(analysis.changedAccounts).toBeGreaterThan(0);
    });

    it('should handle malformed transaction data gracefully', async () => {
      const malformedTransaction = {
        ...mockTransaction,
        details: {
          accounts: null,
          preBalances: undefined,
          postBalances: [],
          preTokenBalances: null,
          postTokenBalances: undefined
        }
      } as any;

      const analysis = await accountChangesAnalyzer.analyzeTransaction(malformedTransaction);

      expect(analysis).toBeDefined();
      expect(analysis.totalAccounts).toBe(0);
      expect(analysis.changedAccounts).toBe(0);
      expect(analysis.riskAssessment.level).toBe('low');
    });

    it('should handle transactions with extreme values', async () => {
      const extremeTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          preBalances: [Number.MAX_SAFE_INTEGER, 0, 2039280, 2039280],
          postBalances: [0, Number.MAX_SAFE_INTEGER - 5000, 2039280, 2039280]
        }
      };

      const analysis = await accountChangesAnalyzer.analyzeTransaction(extremeTransaction);

      expect(analysis).toBeDefined();
      expect(analysis.solChanges.totalSolChange).toBe(-5000);
      expect(analysis.riskAssessment.level).toBe('high'); // Extreme values should trigger high risk
    });
  });

  describe('caching behavior', () => {
    it('should use cached results when available', async () => {
      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      
      const cachedResult: AccountChangesAnalysis = {
        totalAccounts: 4,
        changedAccounts: 2,
        solChanges: {
          totalSolChange: -10000000,
          positiveChanges: 0,
          negativeChanges: 2,
          largestIncrease: null,
          largestDecrease: null
        },
        tokenChanges: {
          totalTokensAffected: 0,
          uniqueTokens: [],
          significantChanges: []
        },
        dataChanges: {
          accountsWithDataChanges: 0,
          significantDataChanges: []
        },
        ownershipChanges: {
          accountsWithOwnershipChanges: 0,
          ownershipTransfers: []
        },
        riskAssessment: {
          level: 'low',
          factors: [],
          recommendations: ['Cached result']
        }
      };

      transactionAnalysisCache.getCachedAccountChanges.mockResolvedValueOnce(cachedResult);

      const analysis = await accountChangesAnalyzer.analyzeTransaction(mockTransaction);

      expect(analysis).toEqual(cachedResult);
      expect(transactionAnalysisCache.getCachedAccountChanges).toHaveBeenCalledWith(mockTransaction.signature);
      expect(transactionAnalysisCache.cacheAccountChanges).not.toHaveBeenCalled();
    });

    it('should cache new analysis results', async () => {
      const analysis = await accountChangesAnalyzer.analyzeTransaction(mockTransaction);

      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      expect(transactionAnalysisCache.cacheAccountChanges).toHaveBeenCalledWith(
        mockTransaction.signature,
        analysis
      );
    });
  });
});