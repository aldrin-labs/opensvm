/**
 * SVMAI Tokenomics - Governance Module
 *
 * DAO governance system for $SVMAI token holders:
 * - Proposal creation and management
 * - Voting with staked tokens
 * - Timelock execution
 * - Parameter changes
 */

import {
  GovernanceProposal,
  Vote,
  TokenAmount,
  toTokenAmount,
  fromTokenAmount,
  AccessTier,
} from './types';
import { getWalletTotalStaked } from './staking';

// ============================================================================
// Governance Configuration
// ============================================================================

export interface GovernanceConfig {
  // Proposal thresholds
  proposalThreshold: number; // Min tokens to create proposal (default: 1000)
  quorumPercentage: number; // Percentage of total staked required (default: 10%)

  // Voting periods
  votingDelayBlocks: number; // Delay before voting starts (default: 1 day)
  votingPeriodBlocks: number; // How long voting is open (default: 3 days)

  // Execution
  timelockDelayBlocks: number; // Delay before execution (default: 2 days)
  gracePeriodBlocks: number; // Time to execute after timelock (default: 7 days)

  // Voting power
  votingPowerSource: 'staked' | 'balance' | 'both';
  quadraticVoting: boolean;
}

export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  proposalThreshold: 1000,
  quorumPercentage: 10,
  votingDelayBlocks: 43200, // ~1 day at 2s blocks
  votingPeriodBlocks: 129600, // ~3 days
  timelockDelayBlocks: 86400, // ~2 days
  gracePeriodBlocks: 302400, // ~7 days
  votingPowerSource: 'staked',
  quadraticVoting: false,
};

// ============================================================================
// Proposal Types
// ============================================================================

export type ProposalType =
  | 'parameter' // Change system parameters
  | 'treasury' // Treasury spend
  | 'upgrade' // Contract upgrade
  | 'feature' // Enable/disable features
  | 'emergency' // Emergency actions (faster execution)
  | 'text'; // Non-binding signal

export interface ProposalAction {
  target: string; // Contract/module to call
  function: string; // Function to call
  params: Record<string, any>; // Parameters
  value?: TokenAmount; // Token value to send
}

export interface ProposalDetails extends GovernanceProposal {
  type: ProposalType;
  actions: ProposalAction[];
  discussionUrl?: string;
  snapshotBlock: number;
  votingStartBlock: number;
  votingEndBlock: number;
  executionETA?: number;
  executedAt?: number;
  cancelledAt?: number;
  cancelledBy?: string;
}

export interface VoteRecord extends Vote {
visibilityReason?: string;
  votingPower: TokenAmount; // Actual voting power used
}

// ============================================================================
// In-Memory Storage
// ============================================================================

const proposals: Map<string, ProposalDetails> = new Map();
const votes: Map<string, VoteRecord[]> = new Map(); // proposalId -> votes
const delegations: Map<string, string> = new Map(); // delegator -> delegatee

let proposalCounter = 0;
let currentBlock = 0;

// Simulate block progression
setInterval(() => {
  currentBlock++;
}, 2000);

// ============================================================================
// Voting Power Calculation
// ============================================================================

/**
 * Get voting power for a wallet
 */
export function getVotingPower(
  wallet: string,
  config: GovernanceConfig = DEFAULT_GOVERNANCE_CONFIG
): TokenAmount {
  const stakeInfo = getWalletTotalStaked(wallet);

  // Check for delegation
  const delegatedPower = getDelegatedPower(wallet);

  let basePower: TokenAmount;

  switch (config.votingPowerSource) {
    case 'staked':
      basePower = stakeInfo.effective;
      break;
    case 'balance':
      // In production, get from on-chain
      basePower = BigInt(0);
      break;
    case 'both':
      basePower = stakeInfo.effective; // + balance
      break;
    default:
      basePower = stakeInfo.effective;
  }

  const totalPower = basePower + delegatedPower;

  // Apply quadratic voting if enabled
  if (config.quadraticVoting) {
    return BigInt(Math.floor(Math.sqrt(Number(totalPower))));
  }

  return totalPower;
}

/**
 * Get power delegated to a wallet
 */
function getDelegatedPower(wallet: string): TokenAmount {
  let total = BigInt(0);

  for (const [delegator, delegatee] of delegations.entries()) {
    if (delegatee === wallet) {
      const stakeInfo = getWalletTotalStaked(delegator);
      total += stakeInfo.effective;
    }
  }

  return total;
}

/**
 * Delegate voting power to another wallet
 */
export function delegate(from: string, to: string): void {
  if (from === to) {
    throw new Error('Cannot delegate to self');
  }

  // Check for delegation loops
  let current = to;
  while (delegations.has(current)) {
    current = delegations.get(current)!;
    if (current === from) {
      throw new Error('Delegation would create a loop');
    }
  }

  delegations.set(from, to);
}

/**
 * Remove delegation
 */
export function undelegate(from: string): void {
  delegations.delete(from);
}

/**
 * Get delegation info
 */
export function getDelegation(wallet: string): {
  delegatedTo?: string;
  delegatedFrom: string[];
  totalDelegatedPower: TokenAmount;
} {
  const delegatedTo = delegations.get(wallet);
  const delegatedFrom: string[] = [];

  for (const [delegator, delegatee] of delegations.entries()) {
    if (delegatee === wallet) {
      delegatedFrom.push(delegator);
    }
  }

  return {
    delegatedTo,
    delegatedFrom,
    totalDelegatedPower: getDelegatedPower(wallet),
  };
}

// ============================================================================
// Proposal Management
// ============================================================================

/**
 * Create a new proposal
 */
export function createProposal(
  proposer: string,
  params: {
    title: string;
    description: string;
    type: ProposalType;
    actions: ProposalAction[];
    discussionUrl?: string;
  },
  config: GovernanceConfig = DEFAULT_GOVERNANCE_CONFIG
): ProposalDetails {
  // Check proposer has enough voting power
  const votingPower = getVotingPower(proposer, config);
  if (fromTokenAmount(votingPower) < config.proposalThreshold) {
    throw new Error(
      `Insufficient voting power. Need ${config.proposalThreshold}, have ${fromTokenAmount(votingPower)}`
    );
  }

  const id = `SVMAI-${++proposalCounter}`;
  const now = Date.now();

  // Calculate voting period
  const snapshotBlock = currentBlock;
  const votingStartBlock = currentBlock + config.votingDelayBlocks;
  const votingEndBlock = votingStartBlock + config.votingPeriodBlocks;

  // Calculate quorum based on total staked
  // In production, get from on-chain
  const totalStaked = toTokenAmount(10000000); // Mock 10M staked
  const quorum = BigInt(Math.floor(Number(totalStaked) * (config.quorumPercentage / 100)));

  const proposal: ProposalDetails = {
    id,
    title: params.title,
    description: params.description,
    proposer,
    type: params.type,
    actions: params.actions,
    discussionUrl: params.discussionUrl,
    status: 'pending',
    votesFor: BigInt(0),
    votesAgainst: BigInt(0),
    quorum,
    startTime: now + config.votingDelayBlocks * 2000,
    endTime: now + (config.votingDelayBlocks + config.votingPeriodBlocks) * 2000,
    snapshotBlock,
    votingStartBlock,
    votingEndBlock,
  };

  proposals.set(id, proposal);
  votes.set(id, []);

  return proposal;
}

/**
 * Get proposal by ID
 */
export function getProposal(proposalId: string): ProposalDetails | undefined {
  const proposal = proposals.get(proposalId);
  if (proposal) {
    updateProposalStatus(proposal);
  }
  return proposal;
}

/**
 * Get all proposals
 */
export function getAllProposals(options?: {
  status?: GovernanceProposal['status'];
  type?: ProposalType;
  proposer?: string;
}): ProposalDetails[] {
  let result = Array.from(proposals.values());

  // Update statuses
  result.forEach(updateProposalStatus);

  if (options?.status) {
    result = result.filter(p => p.status === options.status);
  }
  if (options?.type) {
    result = result.filter(p => p.type === options.type);
  }
  if (options?.proposer) {
    result = result.filter(p => p.proposer === options.proposer);
  }

  return result.sort((a, b) => Number(b.id.split('-')[1]) - Number(a.id.split('-')[1]));
}

/**
 * Update proposal status based on current block
 */
function updateProposalStatus(proposal: ProposalDetails): void {
  if (proposal.status === 'executed' || proposal.status === 'rejected') {
    return;
  }

  const now = currentBlock;

  if (now < proposal.votingStartBlock) {
    proposal.status = 'pending';
  } else if (now <= proposal.votingEndBlock) {
    proposal.status = 'active';
  } else {
    // Voting ended - check results
    const totalVotes = proposal.votesFor + proposal.votesAgainst;

    if (totalVotes < proposal.quorum) {
      proposal.status = 'rejected'; // Failed quorum
    } else if (proposal.votesFor > proposal.votesAgainst) {
      proposal.status = 'passed';
    } else {
      proposal.status = 'rejected';
    }
  }
}

/**
 * Cancel a proposal (only proposer or emergency)
 */
export function cancelProposal(proposalId: string, caller: string): void {
  const proposal = proposals.get(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  if (proposal.status === 'executed') {
    throw new Error('Cannot cancel executed proposal');
  }

  if (proposal.proposer !== caller) {
    throw new Error('Only proposer can cancel');
  }

  proposal.cancelledAt = Date.now();
  proposal.cancelledBy = caller;
  proposal.status = 'rejected';
}

// ============================================================================
// Voting
// ============================================================================

/**
 * Cast a vote
 */
export function castVote(
  proposalId: string,
  voter: string,
  support: boolean,
  reason?: string,
  config: GovernanceConfig = DEFAULT_GOVERNANCE_CONFIG
): VoteRecord {
  const proposal = proposals.get(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  updateProposalStatus(proposal);

  if (proposal.status !== 'active') {
    throw new Error(`Cannot vote on proposal with status: ${proposal.status}`);
  }

  // Check if already voted
  const existingVotes = votes.get(proposalId) || [];
  if (existingVotes.some(v => v.voter === voter)) {
    throw new Error('Already voted on this proposal');
  }

  // Get voting power at snapshot
  const votingPower = getVotingPower(voter, config);
  if (votingPower === BigInt(0)) {
    throw new Error('No voting power');
  }

  const vote: VoteRecord = {
    proposalId,
    voter,
    amount: votingPower,
    support,
    timestamp: Date.now(),
    visibilityReason: reason,
    votingPower,
  };

  // Update vote tallies
  if (support) {
    proposal.votesFor += votingPower;
  } else {
    proposal.votesAgainst += votingPower;
  }

  existingVotes.push(vote);
  votes.set(proposalId, existingVotes);

  return vote;
}

/**
 * Get votes for a proposal
 */
export function getProposalVotes(proposalId: string): VoteRecord[] {
  return votes.get(proposalId) || [];
}

/**
 * Check if wallet has voted
 */
export function hasVoted(proposalId: string, voter: string): boolean {
  const proposalVotes = votes.get(proposalId) || [];
  return proposalVotes.some(v => v.voter === voter);
}

/**
 * Get vote receipt
 */
export function getVoteReceipt(proposalId: string, voter: string): VoteRecord | undefined {
  const proposalVotes = votes.get(proposalId) || [];
  return proposalVotes.find(v => v.voter === voter);
}

// ============================================================================
// Execution
// ============================================================================

/**
 * Queue a passed proposal for execution
 */
export function queueProposal(
  proposalId: string,
  config: GovernanceConfig = DEFAULT_GOVERNANCE_CONFIG
): number {
  const proposal = proposals.get(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  updateProposalStatus(proposal);

  if (proposal.status !== 'passed') {
    throw new Error('Proposal has not passed');
  }

  // Calculate ETA
  const timelockDelay = proposal.type === 'emergency'
    ? Math.floor(config.timelockDelayBlocks / 4) // Faster for emergencies
    : config.timelockDelayBlocks;

  proposal.executionETA = Date.now() + timelockDelay * 2000;

  return proposal.executionETA;
}

/**
 * Execute a queued proposal
 */
export function executeProposal(proposalId: string, caller: string): {
  success: boolean;
  results: Array<{ action: ProposalAction; success: boolean; error?: string }>;
} {
  const proposal = proposals.get(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  if (proposal.status !== 'passed') {
    throw new Error('Proposal has not passed');
  }

  if (!proposal.executionETA) {
    throw new Error('Proposal not queued');
  }

  if (Date.now() < proposal.executionETA) {
    throw new Error('Timelock not expired');
  }

  // Execute actions
  const results: Array<{ action: ProposalAction; success: boolean; error?: string }> = [];

  for (const action of proposal.actions) {
    try {
      // In production, this would actually execute the action
      executeAction(action);
      results.push({ action, success: true });
    } catch (error) {
      results.push({
        action,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const allSuccess = results.every(r => r.success);

  if (allSuccess) {
    proposal.status = 'executed';
    proposal.executedAt = Date.now();
    proposal.executionTime = Date.now();
  }

  return { success: allSuccess, results };
}

/**
 * Execute a single action (mock implementation)
 */
function executeAction(action: ProposalAction): void {
  console.log(`Executing action: ${action.target}.${action.function}`, action.params);

  // In production, this would:
  // 1. Validate the target contract/module
  // 2. Encode the function call
  // 3. Execute via timelock controller
  // 4. Emit events

  switch (action.target) {
    case 'tokenomics':
      handleTokenomicsAction(action);
      break;
    case 'treasury':
      handleTreasuryAction(action);
      break;
    case 'staking':
      handleStakingAction(action);
      break;
    default:
      throw new Error(`Unknown target: ${action.target}`);
  }
}

function handleTokenomicsAction(action: ProposalAction): void {
  // Handle parameter changes, tier updates, etc.
  console.log('Tokenomics action:', action);
}

function handleTreasuryAction(action: ProposalAction): void {
  // Handle treasury spends
  console.log('Treasury action:', action);
}

function handleStakingAction(action: ProposalAction): void {
  // Handle staking parameter changes
  console.log('Staking action:', action);
}

// ============================================================================
// Governance Statistics
// ============================================================================

export function getGovernanceStats(): {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  rejectedProposals: number;
  executedProposals: number;
  totalVotesCast: number;
  uniqueVoters: number;
  averageParticipation: number;
} {
  const allProposals = Array.from(proposals.values());
  allProposals.forEach(updateProposalStatus);

  const allVotes = Array.from(votes.values()).flat();
  const uniqueVoters = new Set(allVotes.map(v => v.voter)).size;

  const completedProposals = allProposals.filter(
    p => p.status === 'passed' || p.status === 'rejected' || p.status === 'executed'
  );

  let totalParticipation = 0;
  for (const proposal of completedProposals) {
    const totalVotes = proposal.votesFor + proposal.votesAgainst;
    const participation = Number(totalVotes) / Number(proposal.quorum);
    totalParticipation += participation;
  }

  return {
    totalProposals: allProposals.length,
    activeProposals: allProposals.filter(p => p.status === 'active').length,
    passedProposals: allProposals.filter(p => p.status === 'passed').length,
    rejectedProposals: allProposals.filter(p => p.status === 'rejected').length,
    executedProposals: allProposals.filter(p => p.status === 'executed').length,
    totalVotesCast: allVotes.length,
    uniqueVoters,
    averageParticipation: completedProposals.length > 0
      ? totalParticipation / completedProposals.length
      : 0,
  };
}

// ============================================================================
// Proposal Templates
// ============================================================================

export const PROPOSAL_TEMPLATES = {
  parameterChange: (target: string, param: string, value: any) => ({
    type: 'parameter' as ProposalType,
    actions: [{
      target,
      function: 'setParameter',
      params: { param, value },
    }],
  }),

  treasurySpend: (recipient: string, amount: TokenAmount, reason: string) => ({
    type: 'treasury' as ProposalType,
    actions: [{
      target: 'treasury',
      function: 'transfer',
      params: { recipient, reason },
      value: amount,
    }],
  }),

  featureToggle: (feature: string, enabled: boolean) => ({
    type: 'feature' as ProposalType,
    actions: [{
      target: 'features',
      function: 'setEnabled',
      params: { feature, enabled },
    }],
  }),

  emergencyPause: (module: string) => ({
    type: 'emergency' as ProposalType,
    actions: [{
      target: module,
      function: 'pause',
      params: {},
    }],
  }),
};

// ============================================================================
// Exports
// ============================================================================

export default {
  // Config
  DEFAULT_GOVERNANCE_CONFIG,
  PROPOSAL_TEMPLATES,

  // Voting Power
  getVotingPower,
  delegate,
  undelegate,
  getDelegation,

  // Proposals
  createProposal,
  getProposal,
  getAllProposals,
  cancelProposal,

  // Voting
  castVote,
  getProposalVotes,
  hasVoted,
  getVoteReceipt,

  // Execution
  queueProposal,
  executeProposal,

  // Stats
  getGovernanceStats,
};
