#!/usr/bin/env bun
/**
 * Auto-Exit Bot for LP Positions
 *
 * Autonomous agent that monitors LP positions and executes exits
 * when configurable rules trigger. Features:
 *
 * 1. Rule Engine - Flexible condition builder with AND/OR logic
 * 2. Position Monitoring - Real-time tracking of all LP positions
 * 3. Execution Engine - Paper exits, notifications, or transaction prep
 * 4. Safety Features - Circuit breakers, cooldowns, daily limits
 * 5. Audit Trail - Complete history of rule triggers and actions
 */

import {
  LPAnalytics,
  type LPPosition,
  type Chain,
  type DeFiProtocol,
} from './prediction-defi.js';
import { LPStrategyAdvisor } from './prediction-lp-advisor.js';

// ============================================================================
// Types
// ============================================================================

export type RuleOperator =
  | 'gt'       // greater than
  | 'gte'      // greater than or equal
  | 'lt'       // less than
  | 'lte'      // less than or equal
  | 'eq'       // equal
  | 'neq'      // not equal
  | 'between'  // between two values
  | 'outside'; // outside two values

export type RuleField =
  | 'impermanentLoss'
  | 'pnlPercent'
  | 'apy'
  | 'feesEarned'
  | 'totalValue'
  | 'daysHeld'
  | 'yesPrice'
  | 'noPrice'
  | 'priceDeviation' // distance from 0.5
  | 'feesVsIL';      // fees earned / IL in dollars

export type ActionType =
  | 'exit_full'           // Exit entire position
  | 'exit_partial'        // Exit percentage of position
  | 'reduce_to_breakeven' // Reduce to cover IL with remaining
  | 'alert_only'          // Just send notification
  | 'pause_monitoring';   // Stop monitoring this position

export type LogicOperator = 'AND' | 'OR';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: number;
  value2?: number; // For 'between' and 'outside' operators
}

export interface ExitRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Lower = higher priority
  conditions: RuleCondition[];
  logic: LogicOperator;
  action: ActionType;
  actionParams?: {
    exitPercent?: number;      // For exit_partial
    notifyChannels?: string[]; // webhook URLs, etc.
  };
  filters?: {
    chains?: Chain[];
    protocols?: DeFiProtocol[];
    minValue?: number;
    positionIds?: string[];
  };
  cooldownMs: number; // Min time between triggers for same position
  createdAt: number;
  lastTriggeredAt?: number;
}

export interface RuleTrigger {
  id: string;
  ruleId: string;
  ruleName: string;
  positionId: string;
  timestamp: number;
  conditions: {
    field: RuleField;
    expected: string;
    actual: number;
    passed: boolean;
  }[];
  action: ActionType;
  executed: boolean;
  executionResult?: {
    success: boolean;
    message: string;
    txSignature?: string;
  };
}

export interface BotConfig {
  enabled: boolean;
  checkIntervalMs: number;
  maxActionsPerDay: number;
  maxActionsPerHour: number;
  globalCooldownMs: number;
  circuitBreakerThreshold: number; // Stop if this many actions in an hour
  dryRun: boolean; // If true, only log actions, don't execute
  notifyOnTrigger: boolean;
  webhookUrl?: string;
}

export interface BotStats {
  running: boolean;
  rulesCount: number;
  enabledRulesCount: number;
  positionsMonitored: number;
  triggersToday: number;
  triggersThisHour: number;
  lastCheck: number;
  circuitBreakerTripped: boolean;
  uptime: number;
}

// ============================================================================
// Rule Engine
// ============================================================================

export class RuleEngine {
  private rules: Map<string, ExitRule> = new Map();

  // Add a new rule
  addRule(rule: Omit<ExitRule, 'id' | 'createdAt'>): ExitRule {
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullRule: ExitRule = {
      ...rule,
      id,
      createdAt: Date.now(),
    };
    this.rules.set(id, fullRule);
    return fullRule;
  }

  // Get rule by ID
  getRule(id: string): ExitRule | null {
    return this.rules.get(id) || null;
  }

  // Get all rules
  getAllRules(): ExitRule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority);
  }

  // Get enabled rules
  getEnabledRules(): ExitRule[] {
    return this.getAllRules().filter(r => r.enabled);
  }

  // Update rule
  updateRule(id: string, updates: Partial<ExitRule>): ExitRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;
    const updated = { ...rule, ...updates, id, createdAt: rule.createdAt };
    this.rules.set(id, updated);
    return updated;
  }

  // Delete rule
  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  // Enable/disable rule
  toggleRule(id: string, enabled: boolean): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  // Evaluate a single condition
  private evaluateCondition(condition: RuleCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'eq':
        return Math.abs(value - condition.value) < 0.0001;
      case 'neq':
        return Math.abs(value - condition.value) >= 0.0001;
      case 'between':
        return value >= condition.value && value <= (condition.value2 || condition.value);
      case 'outside':
        return value < condition.value || value > (condition.value2 || condition.value);
      default:
        return false;
    }
  }

  // Get field value from position
  private getFieldValue(position: LPPosition, field: RuleField): number {
    const daysHeld = (Date.now() - position.createdAt) / (1000 * 60 * 60 * 24);
    const ilInDollars = position.totalValue * (position.impermanentLoss / 100);

    switch (field) {
      case 'impermanentLoss':
        return position.impermanentLoss;
      case 'pnlPercent':
        return position.pnlPercent;
      case 'apy':
        return position.apy;
      case 'feesEarned':
        return position.feesEarned;
      case 'totalValue':
        return position.totalValue;
      case 'daysHeld':
        return daysHeld;
      case 'yesPrice':
        return position.currentYesPrice;
      case 'noPrice':
        return position.currentNoPrice;
      case 'priceDeviation':
        return Math.abs(0.5 - position.currentYesPrice);
      case 'feesVsIL':
        return ilInDollars > 0 ? position.feesEarned / ilInDollars : Infinity;
      default:
        return 0;
    }
  }

  // Check if position matches rule filters
  private matchesFilters(position: LPPosition, rule: ExitRule): boolean {
    if (!rule.filters) return true;

    const { chains, protocols, minValue, positionIds } = rule.filters;

    if (chains && chains.length > 0 && !chains.includes(position.chain)) {
      return false;
    }
    if (protocols && protocols.length > 0 && !protocols.includes(position.protocol)) {
      return false;
    }
    if (minValue !== undefined && position.totalValue < minValue) {
      return false;
    }
    if (positionIds && positionIds.length > 0 && !positionIds.includes(position.id)) {
      return false;
    }

    return true;
  }

  // Evaluate rule against position
  evaluateRule(rule: ExitRule, position: LPPosition): {
    triggered: boolean;
    conditions: RuleTrigger['conditions'];
  } {
    if (!rule.enabled) {
      return { triggered: false, conditions: [] };
    }

    if (!this.matchesFilters(position, rule)) {
      return { triggered: false, conditions: [] };
    }

    const results: RuleTrigger['conditions'] = [];

    for (const condition of rule.conditions) {
      const actualValue = this.getFieldValue(position, condition.field);
      const passed = this.evaluateCondition(condition, actualValue);

      let expected: string;
      switch (condition.operator) {
        case 'gt':
          expected = `> ${condition.value}`;
          break;
        case 'gte':
          expected = `>= ${condition.value}`;
          break;
        case 'lt':
          expected = `< ${condition.value}`;
          break;
        case 'lte':
          expected = `<= ${condition.value}`;
          break;
        case 'eq':
          expected = `= ${condition.value}`;
          break;
        case 'neq':
          expected = `!= ${condition.value}`;
          break;
        case 'between':
          expected = `${condition.value} - ${condition.value2}`;
          break;
        case 'outside':
          expected = `< ${condition.value} or > ${condition.value2}`;
          break;
        default:
          expected = String(condition.value);
      }

      results.push({
        field: condition.field,
        expected,
        actual: actualValue,
        passed,
      });
    }

    // Apply logic operator
    const triggered = rule.logic === 'AND'
      ? results.every(r => r.passed)
      : results.some(r => r.passed);

    return { triggered, conditions: results };
  }

  // Create common preset rules
  createPresetRules(): ExitRule[] {
    const presets: Omit<ExitRule, 'id' | 'createdAt'>[] = [
      {
        name: 'High IL Emergency Exit',
        description: 'Exit when IL exceeds 15% and fees have not covered it',
        enabled: false,
        priority: 1,
        conditions: [
          { field: 'impermanentLoss', operator: 'gt', value: 15 },
          { field: 'feesVsIL', operator: 'lt', value: 1 },
        ],
        logic: 'AND',
        action: 'exit_full',
        cooldownMs: 3600000, // 1 hour
      },
      {
        name: 'Sustained IL Warning',
        description: 'Alert when IL > 8% for positions held > 7 days',
        enabled: false,
        priority: 2,
        conditions: [
          { field: 'impermanentLoss', operator: 'gt', value: 8 },
          { field: 'daysHeld', operator: 'gt', value: 7 },
        ],
        logic: 'AND',
        action: 'alert_only',
        cooldownMs: 86400000, // 24 hours
      },
      {
        name: 'Take Profit',
        description: 'Exit 50% when PnL exceeds 30%',
        enabled: false,
        priority: 3,
        conditions: [
          { field: 'pnlPercent', operator: 'gt', value: 30 },
        ],
        logic: 'AND',
        action: 'exit_partial',
        actionParams: { exitPercent: 50 },
        cooldownMs: 86400000,
      },
      {
        name: 'Low APY Exit',
        description: 'Exit positions with APY < 5% held over 30 days',
        enabled: false,
        priority: 4,
        conditions: [
          { field: 'apy', operator: 'lt', value: 5 },
          { field: 'daysHeld', operator: 'gt', value: 30 },
        ],
        logic: 'AND',
        action: 'exit_full',
        cooldownMs: 604800000, // 7 days
      },
      {
        name: 'Extreme Price Deviation',
        description: 'Alert when price moves > 40% from 50/50',
        enabled: false,
        priority: 2,
        conditions: [
          { field: 'priceDeviation', operator: 'gt', value: 0.4 },
        ],
        logic: 'AND',
        action: 'alert_only',
        cooldownMs: 3600000,
      },
    ];

    return presets.map(preset => this.addRule(preset));
  }
}

// ============================================================================
// Auto-Exit Bot
// ============================================================================

export class AutoExitBot {
  private lpAnalytics: LPAnalytics;
  private advisor: LPStrategyAdvisor;
  private ruleEngine: RuleEngine;
  private config: BotConfig;
  private triggers: RuleTrigger[] = [];
  private lastTriggerByPosition: Map<string, Map<string, number>> = new Map(); // positionId -> ruleId -> timestamp
  private checkInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private actionsToday: number = 0;
  private actionsThisHour: number = 0;
  private lastHourReset: number = 0;
  private lastDayReset: number = 0;
  private circuitBreakerTripped: boolean = false;

  constructor(
    lpAnalytics: LPAnalytics,
    advisor: LPStrategyAdvisor,
    config?: Partial<BotConfig>
  ) {
    this.lpAnalytics = lpAnalytics;
    this.advisor = advisor;
    this.ruleEngine = new RuleEngine();
    this.config = {
      enabled: false,
      checkIntervalMs: 60000, // 1 minute
      maxActionsPerDay: 20,
      maxActionsPerHour: 5,
      globalCooldownMs: 30000, // 30 seconds between any action
      circuitBreakerThreshold: 10,
      dryRun: true, // Safe default
      notifyOnTrigger: true,
      ...config,
    };
  }

  // Get rule engine
  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }

  // Get/set config
  getConfig(): BotConfig {
    return { ...this.config };
  }

  setConfig(updates: Partial<BotConfig>): BotConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  // Start monitoring
  start(): void {
    if (this.checkInterval) return;

    this.config.enabled = true;
    this.startTime = Date.now();
    this.lastHourReset = Date.now();
    this.lastDayReset = Date.now();
    this.circuitBreakerTripped = false;

    this.checkInterval = setInterval(() => {
      this.runCheck();
    }, this.config.checkIntervalMs);

    console.error('[AutoExitBot] Started');
  }

  // Stop monitoring
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.config.enabled = false;
    console.error('[AutoExitBot] Stopped');
  }

  // Get stats
  getStats(): BotStats {
    return {
      running: this.config.enabled && this.checkInterval !== null,
      rulesCount: this.ruleEngine.getAllRules().length,
      enabledRulesCount: this.ruleEngine.getEnabledRules().length,
      positionsMonitored: this.lpAnalytics.getAllPositions().length,
      triggersToday: this.actionsToday,
      triggersThisHour: this.actionsThisHour,
      lastCheck: this.startTime,
      circuitBreakerTripped: this.circuitBreakerTripped,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  // Get trigger history
  getTriggerHistory(limit: number = 50): RuleTrigger[] {
    return this.triggers.slice(-limit);
  }

  // Reset circuit breaker
  resetCircuitBreaker(): void {
    this.circuitBreakerTripped = false;
    this.actionsThisHour = 0;
    console.error('[AutoExitBot] Circuit breaker reset');
  }

  // Check if action is allowed
  private canTakeAction(): boolean {
    // Reset hourly counter
    if (Date.now() - this.lastHourReset > 3600000) {
      this.actionsThisHour = 0;
      this.lastHourReset = Date.now();
    }

    // Reset daily counter
    if (Date.now() - this.lastDayReset > 86400000) {
      this.actionsToday = 0;
      this.lastDayReset = Date.now();
    }

    // Check circuit breaker
    if (this.circuitBreakerTripped) {
      return false;
    }

    // Check limits
    if (this.actionsThisHour >= this.config.maxActionsPerHour) {
      return false;
    }

    if (this.actionsToday >= this.config.maxActionsPerDay) {
      return false;
    }

    return true;
  }

  // Check cooldown for specific position/rule combo
  private isOnCooldown(positionId: string, rule: ExitRule): boolean {
    const positionTriggers = this.lastTriggerByPosition.get(positionId);
    if (!positionTriggers) return false;

    const lastTrigger = positionTriggers.get(rule.id);
    if (!lastTrigger) return false;

    return Date.now() - lastTrigger < rule.cooldownMs;
  }

  // Record trigger
  private recordTrigger(positionId: string, ruleId: string): void {
    if (!this.lastTriggerByPosition.has(positionId)) {
      this.lastTriggerByPosition.set(positionId, new Map());
    }
    this.lastTriggerByPosition.get(positionId)!.set(ruleId, Date.now());
  }

  // Execute action
  private async executeAction(
    rule: ExitRule,
    position: LPPosition,
    conditionResults: RuleTrigger['conditions']
  ): Promise<RuleTrigger['executionResult']> {
    // Record the trigger
    const trigger: RuleTrigger = {
      id: `trigger_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      positionId: position.id,
      timestamp: Date.now(),
      conditions: conditionResults,
      action: rule.action,
      executed: !this.config.dryRun,
    };

    this.actionsThisHour++;
    this.actionsToday++;

    // Check circuit breaker
    if (this.actionsThisHour >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerTripped = true;
      console.error('[AutoExitBot] Circuit breaker tripped!');
    }

    // Notify
    if (this.config.notifyOnTrigger) {
      await this.sendNotification(trigger, position);
    }

    // Execute based on action type
    let result: RuleTrigger['executionResult'];

    if (this.config.dryRun) {
      result = {
        success: true,
        message: `[DRY RUN] Would execute ${rule.action} for ${position.id}`,
      };
    } else {
      switch (rule.action) {
        case 'exit_full':
          result = await this.executePaperExit(position, 100);
          break;
        case 'exit_partial':
          result = await this.executePaperExit(
            position,
            rule.actionParams?.exitPercent || 50
          );
          break;
        case 'reduce_to_breakeven':
          result = await this.executeReduceToBreakeven(position);
          break;
        case 'alert_only':
          result = {
            success: true,
            message: 'Alert sent successfully',
          };
          break;
        case 'pause_monitoring':
          // Remove from monitoring (disable rule for this position)
          result = {
            success: true,
            message: `Paused monitoring for ${position.id}`,
          };
          break;
        default:
          result = {
            success: false,
            message: `Unknown action: ${rule.action}`,
          };
      }
    }

    trigger.executionResult = result;
    this.triggers.push(trigger);

    // Keep only last 1000 triggers
    if (this.triggers.length > 1000) {
      this.triggers = this.triggers.slice(-1000);
    }

    this.recordTrigger(position.id, rule.id);

    return result;
  }

  // Paper exit (for simulation)
  private async executePaperExit(
    position: LPPosition,
    percent: number
  ): Promise<RuleTrigger['executionResult']> {
    // In paper trading, we'd update the position
    // For now, just return success
    const exitValue = position.totalValue * (percent / 100);
    return {
      success: true,
      message: `Paper exit ${percent}% of position. Value: $${exitValue.toFixed(2)}`,
    };
  }

  // Reduce to breakeven
  private async executeReduceToBreakeven(
    position: LPPosition
  ): Promise<RuleTrigger['executionResult']> {
    const ilInDollars = position.totalValue * (position.impermanentLoss / 100);
    const toKeep = position.totalValue - ilInDollars;
    const exitPercent = (ilInDollars / position.totalValue) * 100;

    return {
      success: true,
      message: `Reduced position by ${exitPercent.toFixed(1)}% to cover IL. Remaining: $${toKeep.toFixed(2)}`,
    };
  }

  // Send notification
  private async sendNotification(
    trigger: RuleTrigger,
    position: LPPosition
  ): Promise<void> {
    const message = {
      type: 'auto_exit_trigger',
      timestamp: new Date(trigger.timestamp).toISOString(),
      rule: trigger.ruleName,
      action: trigger.action,
      position: {
        id: position.id,
        chain: position.chain,
        protocol: position.protocol,
        market: position.marketTitle,
        value: `$${position.totalValue.toFixed(2)}`,
        il: `${position.impermanentLoss.toFixed(2)}%`,
        pnl: `${position.pnlPercent.toFixed(2)}%`,
      },
      conditions: trigger.conditions,
      dryRun: this.config.dryRun,
    };

    console.error('[AutoExitBot] Trigger:', JSON.stringify(message, null, 2));

    // Send to webhook if configured
    if (this.config.webhookUrl) {
      try {
        await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(5000),
        });
      } catch (e) {
        console.error('[AutoExitBot] Webhook failed:', e);
      }
    }
  }

  // Main check loop
  private async runCheck(): Promise<void> {
    if (!this.config.enabled || this.circuitBreakerTripped) return;

    const positions = this.lpAnalytics.getAllPositions();
    const rules = this.ruleEngine.getEnabledRules();

    for (const position of positions) {
      for (const rule of rules) {
        // Check cooldown
        if (this.isOnCooldown(position.id, rule)) {
          continue;
        }

        // Check if we can take action
        if (!this.canTakeAction()) {
          return; // Stop checking if limits reached
        }

        // Evaluate rule
        const { triggered, conditions } = this.ruleEngine.evaluateRule(rule, position);

        if (triggered) {
          console.error(`[AutoExitBot] Rule "${rule.name}" triggered for ${position.id}`);
          await this.executeAction(rule, position, conditions);
        }
      }
    }
  }

  // Manual trigger for testing
  async testRule(ruleId: string, positionId: string): Promise<{
    wouldTrigger: boolean;
    conditions: RuleTrigger['conditions'];
    action?: ActionType;
  }> {
    const rule = this.ruleEngine.getRule(ruleId);
    const position = this.lpAnalytics.getPosition(positionId);

    if (!rule || !position) {
      return { wouldTrigger: false, conditions: [] };
    }

    const { triggered, conditions } = this.ruleEngine.evaluateRule(rule, position);

    return {
      wouldTrigger: triggered,
      conditions,
      action: triggered ? rule.action : undefined,
    };
  }

  // Create preset rules
  createPresets(): ExitRule[] {
    return this.ruleEngine.createPresetRules();
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createAutoExitBot(
  lpAnalytics: LPAnalytics,
  advisor: LPStrategyAdvisor,
  config?: Partial<BotConfig>
): AutoExitBot {
  return new AutoExitBot(lpAnalytics, advisor, config);
}
