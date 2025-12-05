#!/usr/bin/env bun
/**
 * Governance Timelock System
 *
 * Adds execution delays for governance actions with multi-sig override.
 * Prevents flash loan attacks and gives community time to react.
 *
 * Key Features:
 * - Configurable delays based on action severity
 * - Multi-sig emergency cancel/expedite
 * - Grace period for execution
 * - Action batching
 * - Event logging for transparency
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'parameter_change'      // Change protocol parameters
  | 'gauge_creation'        // Create new gauge
  | 'gauge_removal'         // Remove/deactivate gauge
  | 'emission_change'       // Modify emission rates
  | 'fee_change'            // Change fee structure
  | 'treasury_spend'        // Spend treasury funds
  | 'upgrade'               // Protocol upgrade
  | 'emergency';            // Emergency actions

export type ActionStatus =
  | 'queued'
  | 'ready'
  | 'executed'
  | 'cancelled'
  | 'expired';

export interface TimelockAction {
  id: string;
  actionType: ActionType;
  target: string;              // Contract/module target
  data: Record<string, unknown>;
  proposer: string;
  queuedAt: number;
  eta: number;                 // Estimated Time of Arrival (execution time)
  expiresAt: number;           // After this, action expires
  status: ActionStatus;
  executedAt?: number;
  executedBy?: string;
  cancelledAt?: number;
  cancelledBy?: string;
  description: string;
  batch?: string;              // Batch ID if part of batch
}

export interface MultiSigConfig {
  signers: string[];
  threshold: number;           // Required signatures
}

export interface SignatureRecord {
  actionId: string;
  signer: string;
  signedAt: number;
  action: 'approve' | 'cancel' | 'expedite';
}

export interface TimelockConfig {
  /** Delays by action type (ms) */
  delays: Record<ActionType, number>;
  /** Grace period after ETA before expiry (ms) */
  gracePeriod: number;
  /** Multi-sig configuration */
  multiSig: MultiSigConfig;
  /** Minimum delay for any action (ms) */
  minDelay: number;
  /** Maximum delay for any action (ms) */
  maxDelay: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const DEFAULT_CONFIG: TimelockConfig = {
  delays: {
    parameter_change: 2 * DAY,
    gauge_creation: 1 * DAY,
    gauge_removal: 3 * DAY,
    emission_change: 3 * DAY,
    fee_change: 2 * DAY,
    treasury_spend: 3 * DAY,
    upgrade: 7 * DAY,
    emergency: 6 * HOUR,
  },
  gracePeriod: 3 * DAY,
  multiSig: {
    signers: [],
    threshold: 2,
  },
  minDelay: 1 * HOUR,
  maxDelay: 30 * DAY,
};

// ============================================================================
// Timelock Controller
// ============================================================================

export class TimelockController extends EventEmitter {
  private config: TimelockConfig;
  private actions = new Map<string, TimelockAction>();
  private signatures = new Map<string, SignatureRecord[]>(); // actionId -> signatures
  private actionCounter = 0;
  private batchCounter = 0;

  constructor(config: Partial<TimelockConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      delays: { ...DEFAULT_CONFIG.delays, ...config.delays },
      multiSig: { ...DEFAULT_CONFIG.multiSig, ...config.multiSig },
    };
  }

  // --------------------------------------------------------------------------
  // Action Queue
  // --------------------------------------------------------------------------

  /**
   * Queue an action for execution after timelock delay
   */
  queueAction(
    actionType: ActionType,
    target: string,
    data: Record<string, unknown>,
    proposer: string,
    description: string
  ): TimelockAction {
    const delay = this.config.delays[actionType];
    const now = Date.now();

    this.actionCounter++;
    const action: TimelockAction = {
      id: `ACTION-${this.actionCounter}`,
      actionType,
      target,
      data,
      proposer,
      queuedAt: now,
      eta: now + delay,
      expiresAt: now + delay + this.config.gracePeriod,
      status: 'queued',
      description,
    };

    this.actions.set(action.id, action);
    this.signatures.set(action.id, []);

    this.emit('action_queued', {
      actionId: action.id,
      actionType,
      eta: action.eta,
      proposer,
    });

    return action;
  }

  /**
   * Queue multiple actions as a batch (all or nothing execution)
   */
  queueBatch(
    actions: Array<{
      actionType: ActionType;
      target: string;
      data: Record<string, unknown>;
      description: string;
    }>,
    proposer: string
  ): TimelockAction[] {
    this.batchCounter++;
    const batchId = `BATCH-${this.batchCounter}`;

    // Use longest delay in batch
    const maxDelay = Math.max(
      ...actions.map(a => this.config.delays[a.actionType])
    );

    const now = Date.now();
    const queued: TimelockAction[] = [];

    for (const actionDef of actions) {
      this.actionCounter++;
      const action: TimelockAction = {
        id: `ACTION-${this.actionCounter}`,
        actionType: actionDef.actionType,
        target: actionDef.target,
        data: actionDef.data,
        proposer,
        queuedAt: now,
        eta: now + maxDelay,
        expiresAt: now + maxDelay + this.config.gracePeriod,
        status: 'queued',
        description: actionDef.description,
        batch: batchId,
      };

      this.actions.set(action.id, action);
      this.signatures.set(action.id, []);
      queued.push(action);
    }

    this.emit('batch_queued', {
      batchId,
      actionCount: queued.length,
      eta: now + maxDelay,
      proposer,
    });

    return queued;
  }

  // --------------------------------------------------------------------------
  // Execution
  // --------------------------------------------------------------------------

  /**
   * Execute a queued action (after timelock expires)
   */
  execute(actionId: string, executor: string): TimelockAction {
    const action = this.actions.get(actionId);
    if (!action) throw new Error('Action not found');

    if (action.status !== 'queued') {
      throw new Error(`Action is ${action.status}, cannot execute`);
    }

    const now = Date.now();

    if (now < action.eta) {
      throw new Error(`Timelock not expired. ETA: ${new Date(action.eta).toISOString()}`);
    }

    if (now > action.expiresAt) {
      action.status = 'expired';
      throw new Error('Action has expired');
    }

    // If part of batch, check all batch actions are ready
    if (action.batch) {
      const batchActions = this.getBatchActions(action.batch);
      for (const ba of batchActions) {
        if (ba.status === 'cancelled') {
          throw new Error('Batch contains cancelled action');
        }
        if (ba.status !== 'queued') {
          throw new Error(`Batch action ${ba.id} is ${ba.status}`);
        }
      }
    }

    action.status = 'executed';
    action.executedAt = now;
    action.executedBy = executor;

    this.emit('action_executed', {
      actionId: action.id,
      actionType: action.actionType,
      executor,
      data: action.data,
    });

    return action;
  }

  /**
   * Execute all actions in a batch
   */
  executeBatch(batchId: string, executor: string): TimelockAction[] {
    const batchActions = this.getBatchActions(batchId);
    if (batchActions.length === 0) {
      throw new Error('Batch not found');
    }

    const executed: TimelockAction[] = [];
    for (const action of batchActions) {
      executed.push(this.execute(action.id, executor));
    }

    this.emit('batch_executed', {
      batchId,
      actionCount: executed.length,
      executor,
    });

    return executed;
  }

  // --------------------------------------------------------------------------
  // Multi-Sig Operations
  // --------------------------------------------------------------------------

  /**
   * Add a signature for an action (approve, cancel, or expedite)
   */
  sign(
    actionId: string,
    signer: string,
    signAction: 'approve' | 'cancel' | 'expedite'
  ): SignatureRecord {
    const action = this.actions.get(actionId);
    if (!action) throw new Error('Action not found');

    if (!this.config.multiSig.signers.includes(signer)) {
      throw new Error('Not authorized signer');
    }

    const existing = this.signatures.get(actionId) || [];

    // Check for duplicate signature for same action type
    if (existing.some(s => s.signer === signer && s.action === signAction)) {
      throw new Error('Already signed');
    }

    const record: SignatureRecord = {
      actionId,
      signer,
      signedAt: Date.now(),
      action: signAction,
    };

    existing.push(record);
    this.signatures.set(actionId, existing);

    this.emit('action_signed', record);

    // Check if threshold reached for cancel or expedite
    const signType = existing.filter(s => s.action === signAction);
    if (signType.length >= this.config.multiSig.threshold) {
      if (signAction === 'cancel') {
        this.cancelByMultiSig(actionId);
      } else if (signAction === 'expedite') {
        this.expediteByMultiSig(actionId);
      }
    }

    return record;
  }

  private cancelByMultiSig(actionId: string): void {
    const action = this.actions.get(actionId);
    if (!action || action.status !== 'queued') return;

    action.status = 'cancelled';
    action.cancelledAt = Date.now();
    action.cancelledBy = 'multisig';

    this.emit('action_cancelled', {
      actionId,
      reason: 'Multi-sig cancel',
    });

    // Cancel entire batch if part of one
    if (action.batch) {
      const batchActions = this.getBatchActions(action.batch);
      for (const ba of batchActions) {
        if (ba.status === 'queued') {
          ba.status = 'cancelled';
          ba.cancelledAt = Date.now();
          ba.cancelledBy = 'multisig_batch';
        }
      }
    }
  }

  private expediteByMultiSig(actionId: string): void {
    const action = this.actions.get(actionId);
    if (!action || action.status !== 'queued') return;

    // Reduce ETA to minimum delay
    const newEta = action.queuedAt + this.config.minDelay;
    const now = Date.now();

    if (newEta < now) {
      // Can execute immediately
      action.eta = now;
    } else {
      action.eta = newEta;
    }

    action.expiresAt = action.eta + this.config.gracePeriod;

    this.emit('action_expedited', {
      actionId,
      newEta: action.eta,
    });
  }

  /**
   * Get signature count for an action
   */
  getSignatures(actionId: string, signAction?: 'approve' | 'cancel' | 'expedite'): SignatureRecord[] {
    const sigs = this.signatures.get(actionId) || [];
    if (signAction) {
      return sigs.filter(s => s.action === signAction);
    }
    return sigs;
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get action by ID
   */
  getAction(actionId: string): TimelockAction | null {
    return this.actions.get(actionId) || null;
  }

  /**
   * Get all actions in a batch
   */
  getBatchActions(batchId: string): TimelockAction[] {
    return Array.from(this.actions.values())
      .filter(a => a.batch === batchId);
  }

  /**
   * Get actions by status
   */
  getActionsByStatus(status: ActionStatus): TimelockAction[] {
    return Array.from(this.actions.values())
      .filter(a => a.status === status);
  }

  /**
   * Get actions ready for execution
   */
  getReadyActions(): TimelockAction[] {
    const now = Date.now();
    return Array.from(this.actions.values())
      .filter(a =>
        a.status === 'queued' &&
        now >= a.eta &&
        now <= a.expiresAt
      );
  }

  /**
   * Get pending actions (queued but not yet executable)
   */
  getPendingActions(): TimelockAction[] {
    const now = Date.now();
    return Array.from(this.actions.values())
      .filter(a => a.status === 'queued' && now < a.eta);
  }

  /**
   * Check if action is ready for execution
   */
  isReady(actionId: string): boolean {
    const action = this.actions.get(actionId);
    if (!action) return false;

    const now = Date.now();
    return action.status === 'queued' && now >= action.eta && now <= action.expiresAt;
  }

  /**
   * Get time until action is ready
   */
  getTimeUntilReady(actionId: string): number {
    const action = this.actions.get(actionId);
    if (!action) return -1;

    const now = Date.now();
    if (action.status !== 'queued') return -1;
    if (now >= action.eta) return 0;

    return action.eta - now;
  }

  // --------------------------------------------------------------------------
  // Admin Functions
  // --------------------------------------------------------------------------

  /**
   * Update multi-sig configuration
   */
  updateMultiSig(signers: string[], threshold: number): void {
    if (threshold > signers.length) {
      throw new Error('Threshold cannot exceed signer count');
    }
    if (threshold < 1) {
      throw new Error('Threshold must be at least 1');
    }

    this.config.multiSig = { signers, threshold };

    this.emit('multisig_updated', { signers, threshold });
  }

  /**
   * Update delay for action type
   */
  updateDelay(actionType: ActionType, delay: number): void {
    if (delay < this.config.minDelay) {
      throw new Error(`Delay must be at least ${this.config.minDelay}ms`);
    }
    if (delay > this.config.maxDelay) {
      throw new Error(`Delay cannot exceed ${this.config.maxDelay}ms`);
    }

    this.config.delays[actionType] = delay;

    this.emit('delay_updated', { actionType, delay });
  }

  /**
   * Expire stale actions (housekeeping)
   */
  expireStale(): number {
    const now = Date.now();
    let expired = 0;

    for (const action of this.actions.values()) {
      if (action.status === 'queued' && now > action.expiresAt) {
        action.status = 'expired';
        expired++;
      }
    }

    if (expired > 0) {
      this.emit('actions_expired', { count: expired });
    }

    return expired;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get timelock statistics
   */
  getStats(): {
    totalActions: number;
    queuedActions: number;
    readyActions: number;
    executedActions: number;
    cancelledActions: number;
    expiredActions: number;
    pendingBatches: number;
    avgExecutionTime: number;
  } {
    const actions = Array.from(this.actions.values());
    const executed = actions.filter(a => a.status === 'executed');
    const batches = new Set(actions.filter(a => a.batch && a.status === 'queued').map(a => a.batch));

    let totalExecutionTime = 0;
    for (const a of executed) {
      if (a.executedAt) {
        totalExecutionTime += a.executedAt - a.queuedAt;
      }
    }

    return {
      totalActions: actions.length,
      queuedActions: actions.filter(a => a.status === 'queued').length,
      readyActions: this.getReadyActions().length,
      executedActions: executed.length,
      cancelledActions: actions.filter(a => a.status === 'cancelled').length,
      expiredActions: actions.filter(a => a.status === 'expired').length,
      pendingBatches: batches.size,
      avgExecutionTime: executed.length > 0 ? totalExecutionTime / executed.length : 0,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): TimelockConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Exports
// ============================================================================

let controllerInstance: TimelockController | null = null;

export function getTimelockController(
  config?: Partial<TimelockConfig>
): TimelockController {
  if (!controllerInstance) {
    controllerInstance = new TimelockController(config);
  }
  return controllerInstance;
}

export default {
  TimelockController,
  getTimelockController,
  DEFAULT_CONFIG,
};
