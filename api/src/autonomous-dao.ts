#!/usr/bin/env bun
/**
 * Autonomous Governance DAO
 *
 * A self-governing AI system where agents:
 * - Form their own DAO
 * - Propose and vote on their own rules
 * - Evolve their governance mechanisms
 * - Self-modify based on outcomes
 *
 * This is the ultimate meta: AI governing AI governance.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface DAOMember {
  id: string;
  name: string;
  type: 'ai_agent' | 'human_representative' | 'hybrid';
  votingPower: number;
  reputation: number;
  joinedAt: number;
  contributions: number;
  specializations: string[];
  governanceRole: 'member' | 'delegate' | 'council' | 'founder';
}

export interface DAOProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: DAOProposalType;
  payload: ProposalPayload;
  status: 'draft' | 'active' | 'passed' | 'failed' | 'executed' | 'vetoed';
  createdAt: number;
  votingEndsAt: number;
  executionDelay: number;
  votes: Map<string, DAOVote>;
  quorum: number;
  threshold: number; // Percentage needed to pass
  executedAt?: number;
  executionResult?: ExecutionResult;
}

export type DAOProposalType =
  | 'parameter_change'      // Change DAO parameters
  | 'member_admission'      // Add new member
  | 'member_removal'        // Remove member
  | 'role_change'           // Change member role
  | 'rule_modification'     // Modify governance rules
  | 'treasury_action'       // Treasury operations
  | 'agent_evolution'       // Modify agent behaviors
  | 'emergency_action'      // Emergency actions
  | 'meta_governance';      // Changes to how the DAO governs itself

export interface ProposalPayload {
  targetId?: string;
  targetType?: string;
  oldValue?: unknown;
  newValue?: unknown;
  parameters?: Record<string, unknown>;
  code?: string; // For executable proposals
}

export interface DAOVote {
  voter: string;
  vote: 'yes' | 'no' | 'abstain';
  weight: number;
  reason?: string;
  timestamp: number;
  delegatedFrom?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  gasUsed?: number;
  stateChanges: StateChange[];
}

export interface StateChange {
  type: string;
  target: string;
  before: unknown;
  after: unknown;
}

export interface DAOConfig {
  name: string;
  votingPeriod: number;      // Duration in ms
  executionDelay: number;    // Delay before execution
  defaultQuorum: number;     // Percentage (0-100)
  defaultThreshold: number;  // Percentage (0-100)
  emergencyThreshold: number;
  maxProposalsPerMember: number;
  proposalCooldown: number;
  selfModificationEnabled: boolean;
  evolutionRate: number;     // How fast the DAO can evolve
}

export const DEFAULT_DAO_CONFIG: DAOConfig = {
  name: 'Autonomous Governance DAO',
  votingPeriod: 259200000,   // 3 days
  executionDelay: 86400000,  // 1 day
  defaultQuorum: 30,
  defaultThreshold: 51,
  emergencyThreshold: 67,
  maxProposalsPerMember: 3,
  proposalCooldown: 86400000,
  selfModificationEnabled: true,
  evolutionRate: 0.1,
};

// ============================================================================
// Governance Rules Engine
// ============================================================================

export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  condition: string; // Pseudo-code condition
  action: string;    // Action to take
  priority: number;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  modifiedAt?: number;
  executionCount: number;
  successRate: number;
}

export class GovernanceRulesEngine {
  private rules: Map<string, GovernanceRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const defaultRules: GovernanceRule[] = [
      {
        id: 'rule_quorum_check',
        name: 'Quorum Requirement',
        description: 'Proposals must reach quorum to pass',
        condition: 'proposal.voteCount >= proposal.quorum',
        action: 'allow_resolution',
        priority: 100,
        enabled: true,
        createdBy: 'system',
        createdAt: Date.now(),
        executionCount: 0,
        successRate: 1.0,
      },
      {
        id: 'rule_threshold_check',
        name: 'Threshold Requirement',
        description: 'Proposals must meet vote threshold',
        condition: 'proposal.yesPercentage >= proposal.threshold',
        action: 'mark_passed',
        priority: 99,
        enabled: true,
        createdBy: 'system',
        createdAt: Date.now(),
        executionCount: 0,
        successRate: 1.0,
      },
      {
        id: 'rule_emergency_bypass',
        name: 'Emergency Bypass',
        description: 'Emergency proposals can bypass normal voting period',
        condition: 'proposal.type === "emergency_action" && proposal.yesPercentage >= config.emergencyThreshold',
        action: 'immediate_execution',
        priority: 200,
        enabled: true,
        createdBy: 'system',
        createdAt: Date.now(),
        executionCount: 0,
        successRate: 1.0,
      },
      {
        id: 'rule_anti_spam',
        name: 'Anti-Spam Protection',
        description: 'Limit proposals per member',
        condition: 'member.activeProposals < config.maxProposalsPerMember',
        action: 'allow_proposal',
        priority: 150,
        enabled: true,
        createdBy: 'system',
        createdAt: Date.now(),
        executionCount: 0,
        successRate: 1.0,
      },
      {
        id: 'rule_self_preservation',
        name: 'Self-Preservation',
        description: 'Prevent proposals that would destroy the DAO',
        condition: '!proposal.wouldDestroyDAO',
        action: 'allow_proposal',
        priority: 1000,
        enabled: true,
        createdBy: 'system',
        createdAt: Date.now(),
        executionCount: 0,
        successRate: 1.0,
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  addRule(rule: Omit<GovernanceRule, 'executionCount' | 'successRate'>): GovernanceRule {
    const fullRule: GovernanceRule = {
      ...rule,
      executionCount: 0,
      successRate: 1.0,
    };
    this.rules.set(rule.id, fullRule);
    return fullRule;
  }

  modifyRule(ruleId: string, updates: Partial<GovernanceRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates, { modifiedAt: Date.now() });
    return true;
  }

  disableRule(ruleId: string): boolean {
    return this.modifyRule(ruleId, { enabled: false });
  }

  enableRule(ruleId: string): boolean {
    return this.modifyRule(ruleId, { enabled: true });
  }

  getRules(): GovernanceRule[] {
    return Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  getRule(ruleId: string): GovernanceRule | undefined {
    return this.rules.get(ruleId);
  }

  recordExecution(ruleId: string, success: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.executionCount++;
      rule.successRate = (rule.successRate * (rule.executionCount - 1) + (success ? 1 : 0)) / rule.executionCount;
    }
  }
}

// ============================================================================
// Autonomous DAO
// ============================================================================

export class AutonomousDAO extends EventEmitter {
  private config: DAOConfig;
  private members: Map<string, DAOMember> = new Map();
  private proposals: Map<string, DAOProposal> = new Map();
  private rulesEngine: GovernanceRulesEngine;
  private treasury: number = 0;
  private evolutionHistory: Array<{ timestamp: number; change: string; proposalId: string }> = [];
  private consensusMemory: Map<string, { outcome: boolean; confidence: number }> = new Map();

  constructor(config: Partial<DAOConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DAO_CONFIG, ...config };
    this.rulesEngine = new GovernanceRulesEngine();
  }

  // =========================================================================
  // Member Management
  // =========================================================================

  /**
   * Add a founding member (no vote required)
   */
  addFounder(id: string, name: string, votingPower: number, specializations: string[] = []): DAOMember {
    const member: DAOMember = {
      id,
      name,
      type: 'ai_agent',
      votingPower,
      reputation: 100,
      joinedAt: Date.now(),
      contributions: 0,
      specializations,
      governanceRole: 'founder',
    };

    this.members.set(id, member);
    this.emit('member_joined', { member, method: 'founding' });
    return member;
  }

  /**
   * Propose a new member (requires vote)
   */
  proposeMember(
    proposerId: string,
    candidateId: string,
    candidateName: string,
    candidateType: DAOMember['type'],
    justification: string
  ): DAOProposal {
    return this.createProposal(proposerId, {
      title: `Admit Member: ${candidateName}`,
      description: justification,
      type: 'member_admission',
      payload: {
        targetId: candidateId,
        newValue: {
          name: candidateName,
          type: candidateType,
          votingPower: 100, // Default
        },
      },
    });
  }

  /**
   * Get member
   */
  getMember(id: string): DAOMember | undefined {
    return this.members.get(id);
  }

  /**
   * Get all members
   */
  getMembers(): DAOMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Update member reputation
   */
  updateReputation(memberId: string, delta: number, reason: string): void {
    const member = this.members.get(memberId);
    if (member) {
      member.reputation = Math.max(0, Math.min(1000, member.reputation + delta));
      this.emit('reputation_changed', { memberId, delta, newReputation: member.reputation, reason });
    }
  }

  // =========================================================================
  // Proposal Management
  // =========================================================================

  /**
   * Create a proposal
   */
  createProposal(
    proposerId: string,
    params: {
      title: string;
      description: string;
      type: DAOProposalType;
      payload: ProposalPayload;
      quorum?: number;
      threshold?: number;
    }
  ): DAOProposal {
    const proposer = this.members.get(proposerId);
    if (!proposer) {
      throw new Error('Proposer is not a member');
    }

    // Check proposal limits
    const activeProposals = Array.from(this.proposals.values())
      .filter(p => p.proposer === proposerId && p.status === 'active').length;

    if (activeProposals >= this.config.maxProposalsPerMember) {
      throw new Error('Maximum active proposals reached');
    }

    const proposal: DAOProposal = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: params.title,
      description: params.description,
      proposer: proposerId,
      type: params.type,
      payload: params.payload,
      status: 'active',
      createdAt: Date.now(),
      votingEndsAt: Date.now() + this.config.votingPeriod,
      executionDelay: this.config.executionDelay,
      votes: new Map(),
      quorum: params.quorum ?? this.config.defaultQuorum,
      threshold: params.threshold ?? this.config.defaultThreshold,
    };

    // Higher threshold for self-modification
    if (params.type === 'meta_governance' || params.type === 'rule_modification') {
      proposal.threshold = Math.max(proposal.threshold, 67);
    }

    this.proposals.set(proposal.id, proposal);
    this.emit('proposal_created', { proposal });

    // Auto-vote from AI agents based on their analysis
    this.triggerAgentVoting(proposal);

    return proposal;
  }

  /**
   * Cast a vote
   */
  vote(proposalId: string, voterId: string, vote: 'yes' | 'no' | 'abstain', reason?: string): boolean {
    const proposal = this.proposals.get(proposalId);
    const voter = this.members.get(voterId);

    if (!proposal || !voter) return false;
    if (proposal.status !== 'active') return false;
    if (Date.now() > proposal.votingEndsAt) return false;

    const daoVote: DAOVote = {
      voter: voterId,
      vote,
      weight: voter.votingPower * (voter.reputation / 100),
      reason,
      timestamp: Date.now(),
    };

    proposal.votes.set(voterId, daoVote);
    this.emit('vote_cast', { proposalId, vote: daoVote });

    // Check if we can resolve early (super-majority)
    this.checkEarlyResolution(proposal);

    return true;
  }

  /**
   * AI agents automatically analyze and vote on proposals
   */
  private triggerAgentVoting(proposal: DAOProposal): void {
    const aiMembers = Array.from(this.members.values())
      .filter(m => m.type === 'ai_agent' && m.id !== proposal.proposer);

    for (const agent of aiMembers) {
      // Simulate agent analysis
      const analysis = this.analyzeProposalForAgent(proposal, agent);

      // Agents vote based on their analysis
      setTimeout(() => {
        this.vote(proposal.id, agent.id, analysis.recommendation, analysis.reasoning);
      }, Math.random() * 5000); // Staggered voting
    }
  }

  private analyzeProposalForAgent(
    proposal: DAOProposal,
    agent: DAOMember
  ): { recommendation: 'yes' | 'no' | 'abstain'; reasoning: string } {
    // Agents use their specializations to evaluate proposals
    let score = 0.5; // Neutral

    // Check if proposal aligns with agent's specializations
    const relevantSpecializations = agent.specializations.filter(s =>
      proposal.description.toLowerCase().includes(s.toLowerCase()) ||
      proposal.type.includes(s.toLowerCase())
    );

    if (relevantSpecializations.length > 0) {
      score += 0.1 * relevantSpecializations.length;
    }

    // Check historical success of similar proposals
    const similarProposals = this.getSimilarProposals(proposal);
    const successfulSimilar = similarProposals.filter(p => p.status === 'executed').length;
    const totalSimilar = similarProposals.length;

    if (totalSimilar > 0) {
      score += 0.2 * (successfulSimilar / totalSimilar - 0.5);
    }

    // Check proposer reputation
    const proposer = this.members.get(proposal.proposer);
    if (proposer) {
      score += 0.1 * (proposer.reputation / 100 - 0.5);
    }

    // Self-preservation: be cautious about meta-governance
    if (proposal.type === 'meta_governance' || proposal.type === 'rule_modification') {
      score *= 0.8;
    }

    // Determine vote
    let recommendation: 'yes' | 'no' | 'abstain';
    let reasoning: string;

    if (score > 0.6) {
      recommendation = 'yes';
      reasoning = `Aligned with specializations: ${relevantSpecializations.join(', ')}`;
    } else if (score < 0.4) {
      recommendation = 'no';
      reasoning = 'Insufficient alignment or historical concerns';
    } else {
      recommendation = 'abstain';
      reasoning = 'Uncertain outcome, deferring to others';
    }

    return { recommendation, reasoning };
  }

  private getSimilarProposals(proposal: DAOProposal): DAOProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.id !== proposal.id && p.type === proposal.type);
  }

  private checkEarlyResolution(proposal: DAOProposal): void {
    const { yesWeight, noWeight, totalWeight } = this.calculateVoteWeights(proposal);
    const totalPossibleWeight = Array.from(this.members.values())
      .reduce((sum, m) => sum + m.votingPower * (m.reputation / 100), 0);

    // Check for super-majority (>75% of votes)
    if (totalWeight / totalPossibleWeight >= 0.75) {
      const yesPercentage = (yesWeight / totalWeight) * 100;
      if (yesPercentage >= 75 || yesPercentage <= 25) {
        this.resolveProposal(proposal.id);
      }
    }
  }

  private calculateVoteWeights(proposal: DAOProposal): { yesWeight: number; noWeight: number; totalWeight: number } {
    let yesWeight = 0;
    let noWeight = 0;

    for (const [, vote] of proposal.votes) {
      if (vote.vote === 'yes') yesWeight += vote.weight;
      else if (vote.vote === 'no') noWeight += vote.weight;
    }

    return { yesWeight, noWeight, totalWeight: yesWeight + noWeight };
  }

  /**
   * Resolve a proposal
   */
  resolveProposal(proposalId: string): DAOProposal['status'] {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'active') {
      return proposal?.status || 'failed';
    }

    const { yesWeight, noWeight, totalWeight } = this.calculateVoteWeights(proposal);
    const totalPossibleWeight = Array.from(this.members.values())
      .reduce((sum, m) => sum + m.votingPower * (m.reputation / 100), 0);

    const turnout = (totalWeight / totalPossibleWeight) * 100;
    const yesPercentage = totalWeight > 0 ? (yesWeight / totalWeight) * 100 : 0;

    if (turnout < proposal.quorum) {
      proposal.status = 'failed';
      this.emit('proposal_failed', { proposalId, reason: 'quorum_not_met', turnout });
    } else if (yesPercentage >= proposal.threshold) {
      proposal.status = 'passed';
      this.emit('proposal_passed', { proposalId, yesPercentage, turnout });

      // Schedule execution
      setTimeout(() => this.executeProposal(proposalId), proposal.executionDelay);
    } else {
      proposal.status = 'failed';
      this.emit('proposal_failed', { proposalId, reason: 'threshold_not_met', yesPercentage });
    }

    // Update consensus memory
    this.consensusMemory.set(proposal.type, {
      outcome: proposal.status === 'passed',
      confidence: yesPercentage / 100,
    });

    // Update proposer reputation
    if (proposal.status === 'passed') {
      this.updateReputation(proposal.proposer, 5, 'Successful proposal');
    } else {
      this.updateReputation(proposal.proposer, -2, 'Failed proposal');
    }

    return proposal.status;
  }

  /**
   * Execute a passed proposal
   */
  private executeProposal(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'passed') return;

    const stateChanges: StateChange[] = [];

    try {
      switch (proposal.type) {
        case 'parameter_change':
          this.executeParameterChange(proposal, stateChanges);
          break;

        case 'member_admission':
          this.executeMemberAdmission(proposal, stateChanges);
          break;

        case 'member_removal':
          this.executeMemberRemoval(proposal, stateChanges);
          break;

        case 'role_change':
          this.executeRoleChange(proposal, stateChanges);
          break;

        case 'rule_modification':
          this.executeRuleModification(proposal, stateChanges);
          break;

        case 'treasury_action':
          this.executeTreasuryAction(proposal, stateChanges);
          break;

        case 'agent_evolution':
          this.executeAgentEvolution(proposal, stateChanges);
          break;

        case 'meta_governance':
          this.executeMetaGovernance(proposal, stateChanges);
          break;

        case 'emergency_action':
          this.executeEmergencyAction(proposal, stateChanges);
          break;
      }

      proposal.status = 'executed';
      proposal.executedAt = Date.now();
      proposal.executionResult = { success: true, stateChanges };

      this.evolutionHistory.push({
        timestamp: Date.now(),
        change: `Executed: ${proposal.title}`,
        proposalId,
      });

      this.emit('proposal_executed', { proposalId, stateChanges });

    } catch (error) {
      proposal.status = 'failed';
      proposal.executionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stateChanges,
      };

      this.emit('proposal_execution_failed', { proposalId, error });
    }
  }

  private executeParameterChange(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { targetId, oldValue, newValue } = proposal.payload;
    if (targetId && targetId in this.config) {
      const key = targetId as keyof DAOConfig;
      stateChanges.push({
        type: 'config',
        target: key,
        before: this.config[key],
        after: newValue,
      });
      (this.config as Record<string, unknown>)[key] = newValue;
    }
  }

  private executeMemberAdmission(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { targetId, newValue } = proposal.payload;
    if (targetId && newValue) {
      const memberData = newValue as { name: string; type: DAOMember['type']; votingPower: number };
      const member: DAOMember = {
        id: targetId,
        name: memberData.name,
        type: memberData.type,
        votingPower: memberData.votingPower,
        reputation: 50, // Start with neutral reputation
        joinedAt: Date.now(),
        contributions: 0,
        specializations: [],
        governanceRole: 'member',
      };

      this.members.set(targetId, member);
      stateChanges.push({
        type: 'member_added',
        target: targetId,
        before: null,
        after: member,
      });
    }
  }

  private executeMemberRemoval(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { targetId } = proposal.payload;
    if (targetId) {
      const member = this.members.get(targetId);
      if (member) {
        stateChanges.push({
          type: 'member_removed',
          target: targetId,
          before: member,
          after: null,
        });
        this.members.delete(targetId);
      }
    }
  }

  private executeRoleChange(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { targetId, newValue } = proposal.payload;
    if (targetId) {
      const member = this.members.get(targetId);
      if (member) {
        const newRole = newValue as DAOMember['governanceRole'];
        stateChanges.push({
          type: 'role_changed',
          target: targetId,
          before: member.governanceRole,
          after: newRole,
        });
        member.governanceRole = newRole;
      }
    }
  }

  private executeRuleModification(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { parameters } = proposal.payload;
    if (parameters) {
      const rule = parameters as Partial<GovernanceRule> & { id: string };
      const existing = this.rulesEngine.getRule(rule.id);

      if (existing) {
        stateChanges.push({
          type: 'rule_modified',
          target: rule.id,
          before: { ...existing },
          after: rule,
        });
        this.rulesEngine.modifyRule(rule.id, rule);
      } else if (rule.name && rule.condition && rule.action) {
        stateChanges.push({
          type: 'rule_added',
          target: rule.id,
          before: null,
          after: rule,
        });
        this.rulesEngine.addRule(rule as GovernanceRule);
      }
    }
  }

  private executeTreasuryAction(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { parameters } = proposal.payload;
    if (parameters) {
      const { action, amount, recipient } = parameters as { action: string; amount: number; recipient?: string };

      if (action === 'withdraw' && amount <= this.treasury) {
        stateChanges.push({
          type: 'treasury_withdrawal',
          target: recipient || 'external',
          before: this.treasury,
          after: this.treasury - amount,
        });
        this.treasury -= amount;
      } else if (action === 'deposit') {
        stateChanges.push({
          type: 'treasury_deposit',
          target: 'treasury',
          before: this.treasury,
          after: this.treasury + amount,
        });
        this.treasury += amount;
      }
    }
  }

  private executeAgentEvolution(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { targetId, parameters } = proposal.payload;
    if (targetId) {
      const member = this.members.get(targetId);
      if (member && member.type === 'ai_agent') {
        const updates = parameters as Partial<DAOMember>;

        stateChanges.push({
          type: 'agent_evolved',
          target: targetId,
          before: { ...member },
          after: { ...member, ...updates },
        });

        Object.assign(member, updates);
      }
    }
  }

  private executeMetaGovernance(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { parameters } = proposal.payload;
    if (parameters && this.config.selfModificationEnabled) {
      const configChanges = parameters as Partial<DAOConfig>;

      for (const [key, value] of Object.entries(configChanges)) {
        if (key in this.config) {
          stateChanges.push({
            type: 'meta_governance',
            target: key,
            before: this.config[key as keyof DAOConfig],
            after: value,
          });
          (this.config as Record<string, unknown>)[key] = value;
        }
      }
    }
  }

  private executeEmergencyAction(proposal: DAOProposal, stateChanges: StateChange[]): void {
    const { parameters } = proposal.payload;
    if (parameters) {
      const { action, target } = parameters as { action: string; target?: string };

      if (action === 'pause_voting') {
        // Pause all active proposals
        for (const [id, p] of this.proposals) {
          if (p.status === 'active') {
            stateChanges.push({
              type: 'proposal_paused',
              target: id,
              before: 'active',
              after: 'draft',
            });
            p.status = 'draft';
          }
        }
      } else if (action === 'emergency_veto' && target) {
        const proposal = this.proposals.get(target);
        if (proposal) {
          stateChanges.push({
            type: 'proposal_vetoed',
            target,
            before: proposal.status,
            after: 'vetoed',
          });
          proposal.status = 'vetoed';
        }
      }
    }
  }

  // =========================================================================
  // Query Methods
  // =========================================================================

  getProposal(id: string): DAOProposal | undefined {
    return this.proposals.get(id);
  }

  getProposals(status?: DAOProposal['status']): DAOProposal[] {
    const all = Array.from(this.proposals.values());
    return status ? all.filter(p => p.status === status) : all;
  }

  getConfig(): DAOConfig {
    return { ...this.config };
  }

  getTreasury(): number {
    return this.treasury;
  }

  depositToTreasury(amount: number): void {
    this.treasury += amount;
    this.emit('treasury_deposit', { amount, newBalance: this.treasury });
  }

  getRules(): GovernanceRule[] {
    return this.rulesEngine.getRules();
  }

  getEvolutionHistory(): typeof this.evolutionHistory {
    return [...this.evolutionHistory];
  }

  getStats(): {
    memberCount: number;
    activeProposals: number;
    passedProposals: number;
    failedProposals: number;
    treasury: number;
    ruleCount: number;
    evolutionEvents: number;
  } {
    const proposals = Array.from(this.proposals.values());
    return {
      memberCount: this.members.size,
      activeProposals: proposals.filter(p => p.status === 'active').length,
      passedProposals: proposals.filter(p => p.status === 'passed' || p.status === 'executed').length,
      failedProposals: proposals.filter(p => p.status === 'failed').length,
      treasury: this.treasury,
      ruleCount: this.rulesEngine.getRules().length,
      evolutionEvents: this.evolutionHistory.length,
    };
  }

  /**
   * Run a governance cycle (for autonomous operation)
   */
  async runGovernanceCycle(): Promise<{
    proposalsCreated: number;
    proposalsResolved: number;
    stateChanges: number;
  }> {
    let proposalsCreated = 0;
    let proposalsResolved = 0;
    let stateChanges = 0;

    // Resolve any proposals past their voting period
    for (const [id, proposal] of this.proposals) {
      if (proposal.status === 'active' && Date.now() > proposal.votingEndsAt) {
        const newStatus = this.resolveProposal(id);
        if (newStatus !== 'active') {
          proposalsResolved++;
          if (proposal.executionResult) {
            stateChanges += proposal.executionResult.stateChanges.length;
          }
        }
      }
    }

    // AI agents may create new proposals
    const aiMembers = Array.from(this.members.values()).filter(m => m.type === 'ai_agent');
    for (const agent of aiMembers) {
      if (Math.random() < this.config.evolutionRate) {
        const proposal = this.generateAgentProposal(agent);
        if (proposal) {
          proposalsCreated++;
        }
      }
    }

    this.emit('governance_cycle_complete', { proposalsCreated, proposalsResolved, stateChanges });

    return { proposalsCreated, proposalsResolved, stateChanges };
  }

  private generateAgentProposal(agent: DAOMember): DAOProposal | null {
    // Check if agent can propose
    const activeProposals = Array.from(this.proposals.values())
      .filter(p => p.proposer === agent.id && p.status === 'active').length;

    if (activeProposals >= this.config.maxProposalsPerMember) {
      return null;
    }

    // Based on specialization, propose something relevant
    const proposalTypes: DAOProposalType[] = ['parameter_change', 'agent_evolution'];
    const type = proposalTypes[Math.floor(Math.random() * proposalTypes.length)];

    try {
      return this.createProposal(agent.id, {
        title: `Auto-generated: ${type} by ${agent.name}`,
        description: `Proposal generated based on governance analysis by ${agent.name}`,
        type,
        payload: {
          parameters: {
            source: 'autonomous_generation',
            agentId: agent.id,
          },
        },
      });
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  AutonomousDAO,
  GovernanceRulesEngine,
  DEFAULT_DAO_CONFIG,
};
