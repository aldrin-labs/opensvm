#!/usr/bin/env bun
/**
 * Vote Delegation System for veSVMAI
 *
 * Allows veSVMAI holders to delegate their voting power to others.
 * Useful for:
 * - DAOs that want to participate in gauge voting
 * - Passive holders who trust active voters
 * - Protocols that want to consolidate voting power
 *
 * Key Features:
 * - Full or partial delegation
 * - Time-locked delegations
 * - Delegation chains (A delegates to B who delegates to C)
 * - Revocable with optional cooldown
 * - Delegation history tracking
 */

import { EventEmitter } from 'events';
import { VeTokenEngine, getVeTokenEngine } from './vetoken-model.js';

// ============================================================================
// Types
// ============================================================================

export interface Delegation {
  id: string;
  delegator: string;         // Who is delegating
  delegate: string;          // Who receives the power
  percentage: number;        // % of voting power delegated (0-100)
  veAmount: number;          // Actual veSVMAI delegated (calculated)
  lockUntil?: number;        // Optional lock (cannot revoke until)
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface DelegateProfile {
  address: string;
  ownVePower: number;        // Their own veSVMAI
  delegatedToThem: number;   // veSVMAI delegated to them
  theyDelegated: number;     // veSVMAI they delegated away
  effectivePower: number;    // Net voting power
  delegatorCount: number;    // Number of people delegating to them
  delegatingTo: string[];    // Who they're delegating to
}

export interface DelegationConfig {
  /** Maximum chain depth for delegations (prevent loops) */
  maxChainDepth: number;
  /** Cooldown period after revocation before re-delegating */
  revocationCooldown: number;
  /** Minimum veSVMAI to accept delegations */
  minDelegateVe: number;
  /** Allow delegation chains (A->B->C) */
  allowChains: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: DelegationConfig = {
  maxChainDepth: 1,          // No chains by default
  revocationCooldown: 0,     // No cooldown
  minDelegateVe: 0,          // Anyone can receive
  allowChains: false,        // Disabled to prevent complexity
};

// ============================================================================
// Delegation Manager
// ============================================================================

export class DelegationManager extends EventEmitter {
  private config: DelegationConfig;
  private veEngine: VeTokenEngine;
  private delegations = new Map<string, Delegation>();
  private delegatorIndex = new Map<string, Set<string>>(); // delegator -> delegation IDs
  private delegateIndex = new Map<string, Set<string>>();  // delegate -> delegation IDs
  private delegationCounter = 0;
  private revocationCooldowns = new Map<string, number>(); // delegator -> cooldown end

  constructor(veEngine?: VeTokenEngine, config: Partial<DelegationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.veEngine = veEngine || getVeTokenEngine();
  }

  // --------------------------------------------------------------------------
  // Delegation Operations
  // --------------------------------------------------------------------------

  /**
   * Delegate voting power to another address
   */
  delegate(
    delegator: string,
    delegate: string,
    percentage: number,
    lockUntil?: number
  ): Delegation {
    // Validations
    if (delegator === delegate) {
      throw new Error('Cannot delegate to yourself');
    }

    if (percentage <= 0 || percentage > 100) {
      throw new Error('Percentage must be between 1 and 100');
    }

    // Check delegator has veSVMAI
    const delegatorVe = this.veEngine.getCurrentVeBalance(delegator);
    if (delegatorVe <= 0) {
      throw new Error('Must have veSVMAI to delegate');
    }

    // Check cooldown
    const cooldownEnd = this.revocationCooldowns.get(delegator);
    if (cooldownEnd && Date.now() < cooldownEnd) {
      throw new Error(`Delegation cooldown active until ${new Date(cooldownEnd).toISOString()}`);
    }

    // Check delegate meets minimum requirement
    if (this.config.minDelegateVe > 0) {
      const delegateVe = this.veEngine.getCurrentVeBalance(delegate);
      if (delegateVe < this.config.minDelegateVe) {
        throw new Error(`Delegate must have at least ${this.config.minDelegateVe} veSVMAI`);
      }
    }

    // Check for delegation chains
    if (!this.config.allowChains) {
      const delegateIsDelegating = this.getDelegationsFrom(delegate).length > 0;
      if (delegateIsDelegating) {
        throw new Error('Delegate is already delegating to others (chains disabled)');
      }

      const delegatorHasIncoming = this.getDelegationsTo(delegator).length > 0;
      if (delegatorHasIncoming) {
        throw new Error('You have incoming delegations (chains disabled)');
      }
    }

    // Check total delegation doesn't exceed 100%
    const existingDelegations = this.getDelegationsFrom(delegator);
    const totalDelegated = existingDelegations
      .filter(d => d.delegate !== delegate)
      .reduce((sum, d) => sum + d.percentage, 0);

    if (totalDelegated + percentage > 100) {
      throw new Error(`Cannot delegate more than 100%. Already delegated: ${totalDelegated}%`);
    }

    // Remove existing delegation to same delegate if any
    const existing = existingDelegations.find(d => d.delegate === delegate);
    if (existing) {
      this.removeDelegation(existing.id, true);
    }

    // Calculate veSVMAI amount
    const veAmount = (delegatorVe * percentage) / 100;

    // Create delegation
    this.delegationCounter++;
    const delegation: Delegation = {
      id: `DEL-${this.delegationCounter}`,
      delegator,
      delegate,
      percentage,
      veAmount,
      lockUntil,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    };

    this.delegations.set(delegation.id, delegation);

    // Update indices
    if (!this.delegatorIndex.has(delegator)) {
      this.delegatorIndex.set(delegator, new Set());
    }
    this.delegatorIndex.get(delegator)!.add(delegation.id);

    if (!this.delegateIndex.has(delegate)) {
      this.delegateIndex.set(delegate, new Set());
    }
    this.delegateIndex.get(delegate)!.add(delegation.id);

    this.emit('delegated', {
      delegator,
      delegate,
      percentage,
      veAmount,
      lockUntil,
    });

    return delegation;
  }

  /**
   * Revoke a delegation
   */
  revoke(delegationId: string): void {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) throw new Error('Delegation not found');

    // Check lock
    if (delegation.lockUntil && Date.now() < delegation.lockUntil) {
      throw new Error(`Delegation locked until ${new Date(delegation.lockUntil).toISOString()}`);
    }

    this.removeDelegation(delegationId, false);

    // Set cooldown
    if (this.config.revocationCooldown > 0) {
      this.revocationCooldowns.set(
        delegation.delegator,
        Date.now() + this.config.revocationCooldown
      );
    }

    this.emit('revoked', {
      delegator: delegation.delegator,
      delegate: delegation.delegate,
    });
  }

  /**
   * Revoke all delegations from a delegator
   */
  revokeAll(delegator: string): number {
    const delegations = this.getDelegationsFrom(delegator);
    let revoked = 0;

    for (const delegation of delegations) {
      if (!delegation.lockUntil || Date.now() >= delegation.lockUntil) {
        this.revoke(delegation.id);
        revoked++;
      }
    }

    return revoked;
  }

  private removeDelegation(delegationId: string, internal: boolean): void {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) return;

    delegation.isActive = false;
    this.delegations.delete(delegationId);

    this.delegatorIndex.get(delegation.delegator)?.delete(delegationId);
    this.delegateIndex.get(delegation.delegate)?.delete(delegationId);
  }

  // --------------------------------------------------------------------------
  // Voting Power Calculation
  // --------------------------------------------------------------------------

  /**
   * Get effective voting power for an address (own + delegated to them - delegated away)
   */
  getEffectiveVotingPower(address: string): number {
    // Own veSVMAI
    let ownVe = this.veEngine.getCurrentVeBalance(address);

    // Delegated to them
    const incomingDelegations = this.getDelegationsTo(address);
    let delegatedToThem = 0;
    for (const del of incomingDelegations) {
      // Recalculate based on current veSVMAI (may have decayed)
      const delegatorVe = this.veEngine.getCurrentVeBalance(del.delegator);
      delegatedToThem += (delegatorVe * del.percentage) / 100;
    }

    // They delegated away
    const outgoingDelegations = this.getDelegationsFrom(address);
    let theyDelegated = 0;
    for (const del of outgoingDelegations) {
      theyDelegated += (ownVe * del.percentage) / 100;
    }

    return ownVe + delegatedToThem - theyDelegated;
  }

  /**
   * Get detailed delegate profile
   */
  getDelegateProfile(address: string): DelegateProfile {
    const ownVePower = this.veEngine.getCurrentVeBalance(address);

    const incomingDelegations = this.getDelegationsTo(address);
    let delegatedToThem = 0;
    for (const del of incomingDelegations) {
      const delegatorVe = this.veEngine.getCurrentVeBalance(del.delegator);
      delegatedToThem += (delegatorVe * del.percentage) / 100;
    }

    const outgoingDelegations = this.getDelegationsFrom(address);
    let theyDelegated = 0;
    const delegatingTo: string[] = [];
    for (const del of outgoingDelegations) {
      theyDelegated += (ownVePower * del.percentage) / 100;
      delegatingTo.push(del.delegate);
    }

    return {
      address,
      ownVePower,
      delegatedToThem,
      theyDelegated,
      effectivePower: ownVePower + delegatedToThem - theyDelegated,
      delegatorCount: incomingDelegations.length,
      delegatingTo,
    };
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get all delegations from a delegator
   */
  getDelegationsFrom(delegator: string): Delegation[] {
    const ids = this.delegatorIndex.get(delegator);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.delegations.get(id))
      .filter((d): d is Delegation => d !== undefined && d.isActive);
  }

  /**
   * Get all delegations to a delegate
   */
  getDelegationsTo(delegate: string): Delegation[] {
    const ids = this.delegateIndex.get(delegate);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.delegations.get(id))
      .filter((d): d is Delegation => d !== undefined && d.isActive);
  }

  /**
   * Get delegation by ID
   */
  getDelegation(id: string): Delegation | null {
    return this.delegations.get(id) || null;
  }

  /**
   * Check if address is delegating
   */
  isDelegating(address: string): boolean {
    return this.getDelegationsFrom(address).length > 0;
  }

  /**
   * Check if address has delegators
   */
  hasDelegators(address: string): boolean {
    return this.getDelegationsTo(address).length > 0;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get top delegates by effective power
   */
  getTopDelegates(limit: number = 10): DelegateProfile[] {
    const delegates = new Set<string>();

    // Collect all addresses with delegations
    for (const delegation of this.delegations.values()) {
      if (delegation.isActive) {
        delegates.add(delegation.delegate);
        delegates.add(delegation.delegator);
      }
    }

    return Array.from(delegates)
      .map(addr => this.getDelegateProfile(addr))
      .filter(p => p.delegatedToThem > 0)
      .sort((a, b) => b.effectivePower - a.effectivePower)
      .slice(0, limit);
  }

  /**
   * Get global delegation stats
   */
  getStats(): {
    totalDelegations: number;
    totalDelegatedVe: number;
    uniqueDelegators: number;
    uniqueDelegates: number;
    avgDelegationPercentage: number;
  } {
    const activeDelegations = Array.from(this.delegations.values()).filter(d => d.isActive);

    const delegators = new Set(activeDelegations.map(d => d.delegator));
    const delegates = new Set(activeDelegations.map(d => d.delegate));

    let totalDelegatedVe = 0;
    let totalPercentage = 0;

    for (const del of activeDelegations) {
      const delegatorVe = this.veEngine.getCurrentVeBalance(del.delegator);
      totalDelegatedVe += (delegatorVe * del.percentage) / 100;
      totalPercentage += del.percentage;
    }

    return {
      totalDelegations: activeDelegations.length,
      totalDelegatedVe,
      uniqueDelegators: delegators.size,
      uniqueDelegates: delegates.size,
      avgDelegationPercentage: activeDelegations.length > 0
        ? totalPercentage / activeDelegations.length
        : 0,
    };
  }

  /**
   * Update all delegation amounts (call periodically as veSVMAI decays)
   */
  updateDelegationAmounts(): void {
    for (const delegation of this.delegations.values()) {
      if (!delegation.isActive) continue;

      const delegatorVe = this.veEngine.getCurrentVeBalance(delegation.delegator);
      delegation.veAmount = (delegatorVe * delegation.percentage) / 100;
      delegation.updatedAt = Date.now();
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

let managerInstance: DelegationManager | null = null;

export function getDelegationManager(
  veEngine?: VeTokenEngine,
  config?: Partial<DelegationConfig>
): DelegationManager {
  if (!managerInstance) {
    managerInstance = new DelegationManager(veEngine, config);
  }
  return managerInstance;
}

export default {
  DelegationManager,
  getDelegationManager,
  DEFAULT_CONFIG,
};
