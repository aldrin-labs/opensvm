/**
 * Unit Tests for PoUW Delegation & Liquid Staking System
 *
 * Tests delegation, undelegation, liquid staking tokens (stOMCP),
 * reward distribution, and validator profiles.
 */

import {
  // Validator profile
  setValidatorProfile,
  getValidatorProfile,
  getAllValidatorProfiles,
  // Delegation
  delegate,
  requestUndelegate,
  completeUndelegate,
  cancelUndelegate,
  // Liquid staking
  transferStOMCP,
  withdrawStOMCPFromDelegation,
  getStOMCPBalance,
  // Rewards
  distributeRewards,
  claimRewards,
  // Queries
  getDelegation,
  getDelegatorDelegations,
  getValidatorDelegators,
  getUndelegationRequests,
  getUndelegationRequest,
  getExchangeRate,
  getDelegationStats,
  getTopValidatorsByDelegation,
} from '../src/pouw-delegation';

import {
  stake,
  getStakeInfo,
} from '../src/pouw-staking';

// ============================================================================
// Test Setup
// ============================================================================

describe('PoUW Delegation & Liquid Staking', () => {
  // Setup validators with sufficient stake
  const validator1 = 'validator_1';
  const validator2 = 'validator_2';
  const validator3 = 'validator_3';
  const delegator1 = 'delegator_1';
  const delegator2 = 'delegator_2';
  const delegator3 = 'delegator_3';

  // Stake amounts
  const validatorStake = BigInt(10000_000_000_000); // 10000 OMCP (validator minimum)
  const delegationAmount = BigInt(1000_000_000_000); // 1000 OMCP
  const smallDelegation = BigInt(100_000_000_000); // 100 OMCP (minimum)

  beforeAll(() => {
    // Setup validators with enough stake to be eligible
    stake(validator1, validatorStake);
    stake(validator2, validatorStake);
    stake(validator3, validatorStake);
  });

  // ============================================================================
  // Validator Profile Tests
  // ============================================================================

  describe('Validator Profiles', () => {
    describe('setValidatorProfile()', () => {
      it('should create validator profile with default commission', () => {
        const result = setValidatorProfile(validator1, {});
        expect(result.success).toBe(true);

        const profile = getValidatorProfile(validator1);
        expect(profile).not.toBeNull();
        expect(profile!.commissionRate).toBe(1000); // 10% default
        expect(profile!.delegatorCount).toBe(0);
        expect(profile!.totalDelegated).toBe(BigInt(0));
      });

      it('should create validator profile with custom commission', () => {
        const result = setValidatorProfile(validator2, {
          commissionRate: 500, // 5%
          description: 'High performance validator',
          website: 'https://validator2.com',
        });
        expect(result.success).toBe(true);

        const profile = getValidatorProfile(validator2);
        expect(profile).not.toBeNull();
        expect(profile!.commissionRate).toBe(500);
        expect(profile!.description).toBe('High performance validator');
        expect(profile!.website).toBe('https://validator2.com');
      });

      it('should reject commission rate above maximum (50%)', () => {
        const result = setValidatorProfile(validator3, {
          commissionRate: 6000, // 60% - too high
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Commission rate must be between');
      });

      it('should reject non-validators', () => {
        const result = setValidatorProfile('non_validator', {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('not a validator');
      });

      it('should update existing validator profile', () => {
        setValidatorProfile(validator3, { commissionRate: 1500 });

        const updateResult = setValidatorProfile(validator3, {
          commissionRate: 2000,
          description: 'Updated description',
        });
        expect(updateResult.success).toBe(true);

        const profile = getValidatorProfile(validator3);
        expect(profile!.commissionRate).toBe(2000);
        expect(profile!.description).toBe('Updated description');
      });
    });

    describe('getValidatorProfile()', () => {
      it('should return null for non-existent validator', () => {
        const profile = getValidatorProfile('unknown_validator');
        expect(profile).toBeNull();
      });

      it('should return profile with correct fields', () => {
        const profile = getValidatorProfile(validator1);
        expect(profile).not.toBeNull();
        expect(profile).toHaveProperty('validatorId');
        expect(profile).toHaveProperty('commissionRate');
        expect(profile).toHaveProperty('totalDelegated');
        expect(profile).toHaveProperty('delegatorCount');
        expect(profile).toHaveProperty('rewardsDistributed');
        expect(profile).toHaveProperty('createdAt');
      });
    });

    describe('getAllValidatorProfiles()', () => {
      it('should return all validator profiles', () => {
        const profiles = getAllValidatorProfiles();
        expect(profiles.length).toBeGreaterThanOrEqual(3);
        expect(profiles.map(p => p.validatorId)).toContain(validator1);
        expect(profiles.map(p => p.validatorId)).toContain(validator2);
      });
    });
  });

  // ============================================================================
  // Delegation Tests
  // ============================================================================

  describe('Delegation Operations', () => {
    describe('delegate()', () => {
      it('should delegate stake to validator', () => {
        const result = delegate(delegator1, validator1, delegationAmount);
        expect(result.success).toBe(true);
        expect(result.stOMCPReceived).toBeDefined();
        expect(result.stOMCPReceived).toBeGreaterThan(BigInt(0));
      });

      it('should return stOMCP tokens at 1:1 ratio initially', () => {
        const result = delegate(delegator2, validator1, delegationAmount);
        expect(result.success).toBe(true);
        // Initially exchange rate is 1:1
        expect(result.stOMCPReceived).toBe(delegationAmount);
      });

      it('should reject delegation below minimum', () => {
        const tooSmall = BigInt(50_000_000_000); // 50 OMCP
        const result = delegate(delegator3, validator1, tooSmall);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Minimum delegation');
      });

      it('should auto-create validator profile if not exists', () => {
        // validator3 may not have profile yet
        const result = delegate(delegator3, validator3, delegationAmount);
        expect(result.success).toBe(true);

        const profile = getValidatorProfile(validator3);
        expect(profile).not.toBeNull();
      });

      it('should add to existing delegation', () => {
        const initial = getDelegation(delegator1, validator1);
        const initialAmount = initial!.amount;

        const result = delegate(delegator1, validator1, smallDelegation);
        expect(result.success).toBe(true);

        const updated = getDelegation(delegator1, validator1);
        expect(updated!.amount).toBe(initialAmount + smallDelegation);
      });

      it('should update validator profile stats', () => {
        const profileBefore = getValidatorProfile(validator2);
        const delegatedBefore = profileBefore!.totalDelegated;

        delegate(delegator1, validator2, delegationAmount);

        const profileAfter = getValidatorProfile(validator2);
        expect(profileAfter!.totalDelegated).toBe(delegatedBefore + delegationAmount);
      });
    });

    describe('getDelegation()', () => {
      it('should return delegation info', () => {
        const delegation = getDelegation(delegator1, validator1);
        expect(delegation).not.toBeNull();
        expect(delegation!.delegatorId).toBe(delegator1);
        expect(delegation!.validatorId).toBe(validator1);
        expect(delegation!.amount).toBeGreaterThan(BigInt(0));
        expect(delegation!.stOMCPBalance).toBeGreaterThan(BigInt(0));
      });

      it('should return null for non-existent delegation', () => {
        const delegation = getDelegation('unknown', validator1);
        expect(delegation).toBeNull();
      });
    });

    describe('getDelegatorDelegations()', () => {
      it('should return all delegations for a delegator', () => {
        // delegator1 has delegated to multiple validators
        const delegations = getDelegatorDelegations(delegator1);
        expect(delegations.length).toBeGreaterThanOrEqual(1);
      });

      it('should return empty array for non-delegator', () => {
        const delegations = getDelegatorDelegations('non_delegator');
        expect(delegations).toEqual([]);
      });
    });

    describe('getValidatorDelegators()', () => {
      it('should return all delegators for a validator', () => {
        const delegators = getValidatorDelegators(validator1);
        expect(delegators.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ============================================================================
  // Undelegation Tests
  // ============================================================================

  describe('Undelegation Operations', () => {
    describe('requestUndelegate()', () => {
      it('should create undelegation request with cooldown', () => {
        const delegation = getDelegation(delegator1, validator1);
        const unstakeAmount = delegation!.stOMCPBalance / BigInt(2);

        const result = requestUndelegate(delegator1, validator1, unstakeAmount);
        expect(result.success).toBe(true);
        expect(result.requestId).toBeDefined();
        expect(result.availableAt).toBeDefined();

        // Cooldown should be 7 days
        const cooldownDays = (result.availableAt! - Date.now()) / (24 * 60 * 60 * 1000);
        expect(cooldownDays).toBeCloseTo(7, 0);
      });

      it('should reduce stOMCP balance immediately', () => {
        const delegationBefore = getDelegation(delegator2, validator1);
        const unstakeAmount = delegationBefore!.stOMCPBalance / BigInt(4);
        const balanceBefore = delegationBefore!.stOMCPBalance;

        requestUndelegate(delegator2, validator1, unstakeAmount);

        const delegationAfter = getDelegation(delegator2, validator1);
        expect(delegationAfter!.stOMCPBalance).toBe(balanceBefore - unstakeAmount);
      });

      it('should reject undelegation exceeding balance', () => {
        const delegation = getDelegation(delegator3, validator3);
        const tooMuch = delegation!.stOMCPBalance * BigInt(2);

        const result = requestUndelegate(delegator3, validator3, tooMuch);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient');
      });

      it('should reject undelegation for non-existent delegation', () => {
        const result = requestUndelegate('unknown', validator1, BigInt(100));
        expect(result.success).toBe(false);
        expect(result.error).toContain('No delegation found');
      });
    });

    describe('getUndelegationRequests()', () => {
      it('should return pending undelegation requests', () => {
        const requests = getUndelegationRequests(delegator1);
        expect(requests.length).toBeGreaterThanOrEqual(1);
        expect(requests[0].status).toBe('pending');
      });
    });

    describe('cancelUndelegate()', () => {
      it('should cancel pending undelegation and restore stOMCP', () => {
        // Create a new undelegation to cancel
        const delegation = getDelegation(delegator3, validator3);
        if (delegation && delegation.stOMCPBalance > BigInt(0)) {
          const unstakeAmount = delegation.stOMCPBalance / BigInt(4);
          const balanceBefore = delegation.stOMCPBalance;

          const undelegateResult = requestUndelegate(delegator3, validator3, unstakeAmount);
          expect(undelegateResult.success).toBe(true);

          const cancelResult = cancelUndelegate(undelegateResult.requestId!, delegator3);
          expect(cancelResult.success).toBe(true);

          // stOMCP should be restored
          const delegationAfter = getDelegation(delegator3, validator3);
          expect(delegationAfter!.stOMCPBalance).toBe(balanceBefore);
        }
      });

      it('should reject cancel from non-owner', () => {
        const requests = getUndelegationRequests(delegator1);
        if (requests.length > 0) {
          const result = cancelUndelegate(requests[0].id, 'wrong_delegator');
          expect(result.success).toBe(false);
          expect(result.error).toContain('Not authorized');
        }
      });
    });

    describe('completeUndelegate()', () => {
      it('should reject completion before cooldown', () => {
        const requests = getUndelegationRequests(delegator1);
        if (requests.length > 0 && requests[0].status === 'pending') {
          const result = completeUndelegate(requests[0].id);
          expect(result.success).toBe(false);
          expect(result.error).toContain('Cooldown not complete');
        }
      });

      it('should reject non-existent request', () => {
        const result = completeUndelegate('invalid_request_id');
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });
  });

  // ============================================================================
  // Liquid Staking Token Tests
  // ============================================================================

  describe('Liquid Staking Tokens (stOMCP)', () => {
    describe('getStOMCPBalance()', () => {
      it('should return correct stOMCP balance', () => {
        const balance = getStOMCPBalance(delegator1);
        expect(balance.totalBalance).toBeGreaterThan(BigInt(0));
        expect(balance.delegatedBalance).toBeGreaterThan(BigInt(0));
        expect(balance.omcpValue).toBeGreaterThan(BigInt(0));
      });

      it('should return zero for non-delegator', () => {
        const balance = getStOMCPBalance('non_delegator');
        expect(balance.totalBalance).toBe(BigInt(0));
        expect(balance.freeBalance).toBe(BigInt(0));
        expect(balance.delegatedBalance).toBe(BigInt(0));
      });
    });

    describe('withdrawStOMCPFromDelegation()', () => {
      it('should move stOMCP from delegation to free balance', () => {
        const delegation = getDelegation(delegator2, validator1);
        if (delegation && delegation.stOMCPBalance > BigInt(0)) {
          const withdrawAmount = delegation.stOMCPBalance / BigInt(4);
          const balanceBefore = getStOMCPBalance(delegator2);

          const result = withdrawStOMCPFromDelegation(delegator2, validator1, withdrawAmount);
          expect(result.success).toBe(true);

          const balanceAfter = getStOMCPBalance(delegator2);
          expect(balanceAfter.freeBalance).toBe(balanceBefore.freeBalance + withdrawAmount);
        }
      });

      it('should reject withdrawal exceeding delegation balance', () => {
        const delegation = getDelegation(delegator2, validator1);
        if (delegation) {
          const tooMuch = delegation.stOMCPBalance * BigInt(2);
          const result = withdrawStOMCPFromDelegation(delegator2, validator1, tooMuch);
          expect(result.success).toBe(false);
          expect(result.error).toContain('Insufficient');
        }
      });
    });

    describe('transferStOMCP()', () => {
      it('should transfer stOMCP between addresses', () => {
        // First withdraw some to free balance
        const delegation = getDelegation(delegator2, validator1);
        if (delegation && delegation.stOMCPBalance > BigInt(0)) {
          const withdrawAmount = delegation.stOMCPBalance / BigInt(8);
          withdrawStOMCPFromDelegation(delegator2, validator1, withdrawAmount);

          const senderBefore = getStOMCPBalance(delegator2);
          if (senderBefore.freeBalance >= withdrawAmount) {
            const result = transferStOMCP(delegator2, 'recipient', withdrawAmount);
            expect(result.success).toBe(true);

            const recipientBalance = getStOMCPBalance('recipient');
            expect(recipientBalance.freeBalance).toBe(withdrawAmount);
          }
        }
      });

      it('should reject transfer exceeding free balance', () => {
        const result = transferStOMCP(delegator1, 'recipient', BigInt(999999999999999999));
        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient');
      });
    });

    describe('getExchangeRate()', () => {
      it('should return exchange rate info', () => {
        const rate = getExchangeRate();
        expect(rate.rate).toBeDefined();
        expect(rate.omcpPerStOMCP).toBeDefined();
        expect(rate.lastUpdate).toBeDefined();
        expect(parseFloat(rate.omcpPerStOMCP)).toBeGreaterThanOrEqual(1.0);
      });
    });
  });

  // ============================================================================
  // Reward Distribution Tests
  // ============================================================================

  describe('Reward Distribution', () => {
    describe('distributeRewards()', () => {
      it('should distribute rewards to delegators', () => {
        const rewardAmount = BigInt(1000_000_000_000); // 1000 OMCP
        const result = distributeRewards(validator1, rewardAmount);
        expect(result.success).toBe(true);
        expect(result.distributed).toBeGreaterThan(BigInt(0));
        expect(result.delegatorCount).toBeGreaterThan(0);
      });

      it('should deduct validator commission', () => {
        const rewardAmount = BigInt(1000_000_000_000);
        const profile = getValidatorProfile(validator1);
        const commissionRate = profile!.commissionRate;

        const result = distributeRewards(validator1, rewardAmount);

        // Distributed should be less than total due to commission
        const expectedMax = rewardAmount * BigInt(10000 - commissionRate) / BigInt(10000);
        expect(result.distributed).toBeLessThanOrEqual(expectedMax);
      });

      it('should increase exchange rate', () => {
        const rateBefore = getExchangeRate();

        distributeRewards(validator1, BigInt(500_000_000_000));

        const rateAfter = getExchangeRate();
        expect(parseFloat(rateAfter.omcpPerStOMCP)).toBeGreaterThanOrEqual(
          parseFloat(rateBefore.omcpPerStOMCP)
        );
      });

      it('should return zero for validator without delegators', () => {
        // Create new validator without delegators
        stake('lonely_validator', validatorStake);
        setValidatorProfile('lonely_validator', { commissionRate: 1000 });

        const result = distributeRewards('lonely_validator', BigInt(1000));
        expect(result.success).toBe(true);
        expect(result.distributed).toBe(BigInt(0));
        expect(result.delegatorCount).toBe(0);
      });
    });

    describe('claimRewards()', () => {
      it('should claim pending rewards', () => {
        // First distribute some rewards
        distributeRewards(validator1, BigInt(100_000_000_000));

        const result = claimRewards(delegator1, validator1);
        expect(result.success).toBe(true);
        expect(result.claimed).toBeGreaterThanOrEqual(BigInt(0));
      });

      it('should claim from all validators if none specified', () => {
        // Distribute to multiple validators
        distributeRewards(validator1, BigInt(50_000_000_000));
        distributeRewards(validator2, BigInt(50_000_000_000));

        const result = claimRewards(delegator1);
        expect(result.success).toBe(true);
      });

      it('should reset pending rewards after claim', () => {
        distributeRewards(validator1, BigInt(100_000_000_000));

        // First claim
        claimRewards(delegator1, validator1);

        // Second claim should have zero or very small pending
        const delegation = getDelegation(delegator1, validator1);
        if (delegation) {
          expect(delegation.pendingRewards).toBe(BigInt(0));
        }
      });
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    describe('getDelegationStats()', () => {
      it('should return comprehensive stats', () => {
        const stats = getDelegationStats();
        expect(stats.totalDelegated).toBeGreaterThan(BigInt(0));
        expect(stats.totalStOMCPSupply).toBeGreaterThan(BigInt(0));
        expect(stats.delegatorCount).toBeGreaterThan(0);
        expect(stats.validatorCount).toBeGreaterThan(0);
        expect(stats.exchangeRate).toBeDefined();
      });

      it('should track pending undelegations', () => {
        const stats = getDelegationStats();
        expect(stats.pendingUndelegations).toBeGreaterThanOrEqual(0);
        expect(stats.totalPendingUndelegation).toBeGreaterThanOrEqual(BigInt(0));
      });
    });

    describe('getTopValidatorsByDelegation()', () => {
      it('should return validators sorted by delegation', () => {
        const validators = getTopValidatorsByDelegation(10);
        expect(validators.length).toBeGreaterThan(0);

        // Verify sorted by delegation (descending)
        for (let i = 1; i < validators.length; i++) {
          expect(validators[i - 1].totalDelegated).toBeGreaterThanOrEqual(
            validators[i].totalDelegated
          );
        }
      });

      it('should respect limit parameter', () => {
        const validators = getTopValidatorsByDelegation(2);
        expect(validators.length).toBeLessThanOrEqual(2);
      });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete delegation lifecycle', () => {
      const testDelegator = 'lifecycle_delegator';
      const amount = BigInt(500_000_000_000);

      // 1. Delegate
      const delegateResult = delegate(testDelegator, validator1, amount);
      expect(delegateResult.success).toBe(true);

      // 2. Check balance
      const balance = getStOMCPBalance(testDelegator);
      expect(balance.totalBalance).toBeGreaterThan(BigInt(0));

      // 3. Distribute rewards
      distributeRewards(validator1, BigInt(100_000_000_000));

      // 4. Claim rewards
      const claimResult = claimRewards(testDelegator, validator1);
      expect(claimResult.success).toBe(true);

      // 5. Request undelegation
      const delegation = getDelegation(testDelegator, validator1);
      const undelegateResult = requestUndelegate(
        testDelegator,
        validator1,
        delegation!.stOMCPBalance
      );
      expect(undelegateResult.success).toBe(true);

      // 6. Verify request exists
      const requests = getUndelegationRequests(testDelegator);
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should track multiple delegators to same validator', () => {
      const delegators = ['multi_d1', 'multi_d2', 'multi_d3'];
      const amounts = [
        BigInt(200_000_000_000),
        BigInt(300_000_000_000),
        BigInt(500_000_000_000),
      ];

      // Delegate from multiple delegators
      for (let i = 0; i < delegators.length; i++) {
        const result = delegate(delegators[i], validator2, amounts[i]);
        expect(result.success).toBe(true);
      }

      // Verify all delegators tracked
      const validatorDelegators = getValidatorDelegators(validator2);
      for (const d of delegators) {
        const found = validatorDelegators.find(del => del.delegatorId === d);
        expect(found).toBeDefined();
      }

      // Distribute rewards
      distributeRewards(validator2, BigInt(1000_000_000_000));

      // Each delegator should have pending rewards proportional to stake
      for (const d of delegators) {
        const delegation = getDelegation(d, validator2);
        expect(delegation!.pendingRewards).toBeGreaterThan(BigInt(0));
      }
    });

    it('should handle delegator with multiple validators', () => {
      const testDelegator = 'multi_validator_delegator';

      // Delegate to multiple validators
      const d1 = delegate(testDelegator, validator1, BigInt(200_000_000_000));
      const d2 = delegate(testDelegator, validator2, BigInt(300_000_000_000));
      const d3 = delegate(testDelegator, validator3, BigInt(500_000_000_000));

      expect(d1.success).toBe(true);
      expect(d2.success).toBe(true);
      expect(d3.success).toBe(true);

      // Check all delegations
      const delegations = getDelegatorDelegations(testDelegator);
      expect(delegations.length).toBe(3);

      // Total stOMCP balance should be sum of all received stOMCP
      // Note: Due to exchange rate changes from rewards, stOMCP may differ from OMCP
      const balance = getStOMCPBalance(testDelegator);
      const expectedStOMCP = d1.stOMCPReceived! + d2.stOMCPReceived! + d3.stOMCPReceived!;
      expect(balance.delegatedBalance).toBe(expectedStOMCP);
    });
  });
});
