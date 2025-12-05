#!/usr/bin/env bun
/**
 * MCP Governance Suite
 *
 * 50+ MCP tools for the complete governance ecosystem:
 * - Social & Reputation (15 tools)
 * - Agent Evolution (12 tools)
 * - Novel Voting (18 tools)
 * - Specialized Agents (8 tools)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import all systems
import {
  DebateReplayTheater,
  AgentFanClubs,
  GovernanceInfluencerScore,
  CrossDAOReputationPassport,
  DebateHighlightReels,
} from './social-reputation.js';

import {
  PromptDNASystem,
  AgentDreams,
  CollectiveUnconscious,
} from './agent-evolution.js';

import {
  FutarchyGovernance,
  HolographicConsensus,
  ConvictionVotingAMM,
  RetroactiveVoting,
  LiquidDemocracyAgents,
} from './novel-voting.js';

import {
  runAdversarialAnalysis,
  findHistoricalPrecedents,
  analyzeWhaleImpact,
  analyzeExploitVectors,
  SPECIALIZED_AGENTS,
} from './specialized-agents.js';

// ============================================================================
// Initialize Systems
// ============================================================================

const replayTheater = new DebateReplayTheater();
const fanClubs = new AgentFanClubs();
const influencerScore = new GovernanceInfluencerScore();
const reputationPassport = new CrossDAOReputationPassport();
const highlightReels = new DebateHighlightReels();

const promptDNA = new PromptDNASystem();
const agentDreams = new AgentDreams();
const collectiveUnconscious = new CollectiveUnconscious();

const futarchy = new FutarchyGovernance();
const holographic = new HolographicConsensus();
const convictionVoting = new ConvictionVotingAMM(1000000);
const retroactiveVoting = new RetroactiveVoting();
const liquidDemocracy = new LiquidDemocracyAgents();

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // =========================================================================
  // Social & Reputation Tools (15)
  // =========================================================================

  // Debate Replay Theater
  {
    name: 'archive_debate',
    description: 'Archive a debate for future replay analysis',
    inputSchema: {
      type: 'object',
      properties: {
        debateId: { type: 'string', description: 'Unique debate ID' },
        proposalId: { type: 'string', description: 'Related proposal ID' },
        agents: { type: 'array', items: { type: 'string' }, description: 'Participating agents' },
        outcome: { type: 'string', enum: ['support', 'oppose', 'no_quorum'], description: 'Debate outcome' },
      },
      required: ['debateId', 'proposalId', 'agents', 'outcome'],
    },
  },
  {
    name: 'replay_debate',
    description: 'Replay a historical debate with current agent positions to see how outcomes would differ',
    inputSchema: {
      type: 'object',
      properties: {
        debateId: { type: 'string', description: 'ID of archived debate to replay' },
        newPositions: {
          type: 'object',
          description: 'Map of agentId to {position, confidence}',
          additionalProperties: {
            type: 'object',
            properties: {
              position: { type: 'string', enum: ['support', 'oppose'] },
              confidence: { type: 'number' },
            },
          },
        },
      },
      required: ['debateId', 'newPositions'],
    },
  },
  {
    name: 'get_controversial_replays',
    description: 'Find debates where replaying with current agents would change the outcome',
    inputSchema: { type: 'object', properties: {} },
  },

  // Agent Fan Clubs
  {
    name: 'create_fan_club',
    description: 'Create a fan club for an agent where users can stake for rewards',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent to create club for' },
        rewardRate: { type: 'number', description: 'Percentage of agent earnings to distribute (0-1)' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'join_fan_club',
    description: 'Join an agent fan club by staking tokens',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent fan club to join' },
        address: { type: 'string', description: 'User address' },
        stakeAmount: { type: 'number', description: 'Amount to stake' },
      },
      required: ['agentId', 'address', 'stakeAmount'],
    },
  },
  {
    name: 'claim_fan_rewards',
    description: 'Claim accumulated rewards from a fan club',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        address: { type: 'string' },
      },
      required: ['agentId', 'address'],
    },
  },
  {
    name: 'get_fan_club_leaderboard',
    description: 'Get ranking of fan clubs by total staked',
    inputSchema: { type: 'object', properties: {} },
  },

  // Governance Influencer Score
  {
    name: 'record_prediction',
    description: 'Record an agent prediction for a proposal',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        proposalId: { type: 'string' },
        prediction: { type: 'string', enum: ['support', 'oppose'] },
        confidence: { type: 'number' },
      },
      required: ['agentId', 'proposalId', 'prediction', 'confidence'],
    },
  },
  {
    name: 'record_outcome',
    description: 'Record actual proposal outcome to update adoption rates',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        outcome: { type: 'string', enum: ['support', 'oppose'] },
      },
      required: ['proposalId', 'outcome'],
    },
  },
  {
    name: 'follow_agent',
    description: 'Follow an agent to boost their influence score',
    inputSchema: {
      type: 'object',
      properties: {
        followerAddress: { type: 'string' },
        agentId: { type: 'string' },
      },
      required: ['followerAddress', 'agentId'],
    },
  },
  {
    name: 'get_influencer_leaderboard',
    description: 'Get ranking of agents by influence score',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results to return' },
      },
    },
  },

  // Cross-DAO Reputation Passport
  {
    name: 'create_passport',
    description: 'Create a cross-DAO reputation passport for an agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'add_dao_credential',
    description: 'Add a DAO credential to an agent passport',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        daoId: { type: 'string' },
        daoName: { type: 'string' },
        role: { type: 'string', enum: ['voter', 'delegate', 'council', 'contributor'] },
        participationRate: { type: 'number' },
        predictionAccuracy: { type: 'number' },
        votingPower: { type: 'number' },
      },
      required: ['agentId', 'daoId', 'daoName', 'role'],
    },
  },
  {
    name: 'get_passport',
    description: 'Get an agent reputation passport with all credentials',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
  },

  // Highlight Reels
  {
    name: 'generate_highlight_reel',
    description: 'Auto-generate a highlight reel from recent debates',
    inputSchema: {
      type: 'object',
      properties: {
        startTime: { type: 'number', description: 'Start timestamp' },
        endTime: { type: 'number', description: 'End timestamp' },
      },
      required: ['startTime', 'endTime'],
    },
  },

  // =========================================================================
  // Agent Evolution Tools (12)
  // =========================================================================

  // Prompt DNA
  {
    name: 'create_agent_dna',
    description: 'Create genetic DNA for an agent with trait codons (AGR=aggressive, TEC=technical, DAT=data-driven, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        traitCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of 3-letter codons: AGR, CAU, OPT, PES, TEC, ECO, SOC, CON, COL, DAT, NAR, HIS',
        },
      },
      required: ['agentId', 'traitCodes'],
    },
  },
  {
    name: 'mutate_agent_dna',
    description: 'Apply random mutations to an agent DNA sequence',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'crossover_agents',
    description: 'Create a child agent by crossing DNA from two parent agents',
    inputSchema: {
      type: 'object',
      properties: {
        parent1Id: { type: 'string' },
        parent2Id: { type: 'string' },
        childId: { type: 'string' },
      },
      required: ['parent1Id', 'parent2Id', 'childId'],
    },
  },
  {
    name: 'get_agent_dna',
    description: 'Get DNA sequence and expressed traits for an agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'calculate_genetic_similarity',
    description: 'Calculate genetic similarity between two agents (0-1)',
    inputSchema: {
      type: 'object',
      properties: {
        agent1Id: { type: 'string' },
        agent2Id: { type: 'string' },
      },
      required: ['agent1Id', 'agent2Id'],
    },
  },

  // Agent Dreams
  {
    name: 'start_agent_dream',
    description: 'Start a dream simulation for an agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        scenarioType: { type: 'string', enum: ['debate_replay', 'hypothetical', 'nightmare', 'wish_fulfillment'] },
        description: { type: 'string' },
        participants: { type: 'array', items: { type: 'string' } },
      },
      required: ['agentId', 'scenarioType', 'description'],
    },
  },
  {
    name: 'run_dream_cycle',
    description: 'Run a full overnight dream cycle for an agent with multiple scenarios',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        includeNightmare: { type: 'boolean', description: 'Include worst-case scenario' },
        includeWishFulfillment: { type: 'boolean', description: 'Include best-case scenario' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'get_dream_insights',
    description: 'Get learned patterns from agent dreams',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
  },

  // Collective Unconscious
  {
    name: 'contribute_memory',
    description: 'Contribute a pattern to the collective unconscious',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        pattern: { type: 'string', description: 'The pattern or insight to share' },
        context: { type: 'array', items: { type: 'string' }, description: 'Context keywords' },
        confidence: { type: 'number' },
      },
      required: ['agentId', 'pattern', 'context', 'confidence'],
    },
  },
  {
    name: 'query_collective',
    description: 'Query the collective unconscious for relevant patterns',
    inputSchema: {
      type: 'object',
      properties: {
        context: { type: 'array', items: { type: 'string' }, description: 'Context to search for' },
        limit: { type: 'number' },
      },
      required: ['context'],
    },
  },
  {
    name: 'activate_archetype',
    description: 'Activate a Jungian archetype based on context (Hero, Sage, Trickster, Caregiver, Shadow)',
    inputSchema: {
      type: 'object',
      properties: {
        context: { type: 'array', items: { type: 'string' } },
      },
      required: ['context'],
    },
  },
  {
    name: 'sync_with_collective',
    description: 'Synchronize an agent with the collective unconscious to absorb shared knowledge',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
      },
      required: ['agentId'],
    },
  },

  // =========================================================================
  // Novel Voting Tools (18)
  // =========================================================================

  // Futarchy
  {
    name: 'create_futarchy_proposal',
    description: 'Create a futarchy proposal with paired prediction markets',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        proposer: { type: 'string' },
        targetMetric: { type: 'string', description: 'Metric to measure (TVL, volume, price, etc.)' },
        baselineValue: { type: 'number', description: 'Current metric value' },
      },
      required: ['title', 'description', 'proposer', 'targetMetric', 'baselineValue'],
    },
  },
  {
    name: 'trade_futarchy_market',
    description: 'Trade on a futarchy prediction market (pass or fail)',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        trader: { type: 'string' },
        market: { type: 'string', enum: ['pass', 'fail'] },
        amount: { type: 'number', description: 'Positive to buy, negative to sell' },
      },
      required: ['proposalId', 'trader', 'market', 'amount'],
    },
  },
  {
    name: 'resolve_futarchy',
    description: 'Resolve a futarchy proposal based on market prices',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
      },
      required: ['proposalId'],
    },
  },
  {
    name: 'get_futarchy_state',
    description: 'Get current state of a futarchy market',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
      },
      required: ['proposalId'],
    },
  },

  // Holographic Consensus
  {
    name: 'create_holographic_proposal',
    description: 'Create a holographic consensus proposal with boost mechanics',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        proposer: { type: 'string' },
      },
      required: ['title', 'description', 'proposer'],
    },
  },
  {
    name: 'boost_proposal',
    description: 'Boost a proposal to reduce quorum requirement',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        booster: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['proposalId', 'booster', 'amount'],
    },
  },
  {
    name: 'contest_proposal',
    description: 'Contest a boosted proposal to restore full quorum requirement',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        contester: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['proposalId', 'contester', 'amount'],
    },
  },
  {
    name: 'vote_holographic',
    description: 'Vote on a holographic consensus proposal',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        voter: { type: 'string' },
        vote: { type: 'string', enum: ['yes', 'no'] },
        weight: { type: 'number' },
      },
      required: ['proposalId', 'voter', 'vote', 'weight'],
    },
  },

  // Conviction Voting AMM
  {
    name: 'create_conviction_proposal',
    description: 'Create a conviction voting proposal for continuous funding',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        proposer: { type: 'string' },
        requestedAmount: { type: 'number' },
        beneficiary: { type: 'string' },
      },
      required: ['title', 'description', 'proposer', 'requestedAmount', 'beneficiary'],
    },
  },
  {
    name: 'add_conviction_support',
    description: 'Add support to a conviction voting proposal',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        supporter: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['proposalId', 'supporter', 'amount'],
    },
  },
  {
    name: 'update_convictions',
    description: 'Update conviction scores for all proposals (simulate time passing)',
    inputSchema: {
      type: 'object',
      properties: {
        blockDelta: { type: 'number', description: 'Number of blocks to simulate' },
      },
    },
  },
  {
    name: 'get_conviction_status',
    description: 'Get current conviction status for a proposal',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
      },
      required: ['proposalId'],
    },
  },

  // Retroactive Voting
  {
    name: 'create_retro_vote',
    description: 'Create a retroactive vote to evaluate a past decision',
    inputSchema: {
      type: 'object',
      properties: {
        originalProposalId: { type: 'string' },
        originalOutcome: { type: 'string', enum: ['passed', 'failed'] },
        actualImpact: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
        impactScore: { type: 'number', description: '-100 to 100' },
      },
      required: ['originalProposalId', 'originalOutcome', 'actualImpact', 'impactScore'],
    },
  },
  {
    name: 'cast_retro_vote',
    description: 'Cast a vote on whether a past decision was good or bad',
    inputSchema: {
      type: 'object',
      properties: {
        retroVoteId: { type: 'string' },
        voter: { type: 'string' },
        vote: { type: 'string', enum: ['good', 'bad'] },
        confidence: { type: 'number' },
      },
      required: ['retroVoteId', 'voter', 'vote', 'confidence'],
    },
  },
  {
    name: 'calibrate_agent',
    description: 'Calibrate an agent weight based on retroactive outcomes',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        proposalId: { type: 'string' },
        predictedOutcome: { type: 'string', enum: ['support', 'oppose'] },
        confidence: { type: 'number' },
        retroOutcome: { type: 'string', enum: ['good_decision', 'bad_decision'] },
      },
      required: ['agentId', 'proposalId', 'predictedOutcome', 'confidence', 'retroOutcome'],
    },
  },
  {
    name: 'get_calibration_leaderboard',
    description: 'Get ranking of agents by calibration score',
    inputSchema: { type: 'object', properties: {} },
  },

  // Liquid Democracy
  {
    name: 'register_liquid_agent',
    description: 'Register an agent for liquid democracy',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        name: { type: 'string' },
        votingPower: { type: 'number' },
      },
      required: ['agentId', 'name', 'votingPower'],
    },
  },
  {
    name: 'delegate_voting_power',
    description: 'Delegate voting power from one agent to another',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgentId: { type: 'string' },
        toAgentId: { type: 'string' },
        weight: { type: 'number', description: 'Percentage to delegate (0-1)' },
        topics: { type: 'array', items: { type: 'string' }, description: 'Optional topic filter' },
        transitive: { type: 'boolean', description: 'Allow re-delegation' },
      },
      required: ['fromAgentId', 'toAgentId', 'weight'],
    },
  },
  {
    name: 'get_effective_power',
    description: 'Get effective voting power for an agent including delegations',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        topic: { type: 'string', description: 'Optional topic filter' },
      },
      required: ['agentId'],
    },
  },

  // =========================================================================
  // Specialized Agent Tools (8)
  // =========================================================================

  {
    name: 'run_adversarial_analysis',
    description: 'Run full adversarial analysis combining all specialized agents',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', enum: ['funding', 'parameter', 'gauge', 'signal', 'emergency'] },
        requestedAmount: { type: 'number' },
        tvl: { type: 'number' },
      },
      required: ['proposalId', 'title', 'description', 'type'],
    },
  },
  {
    name: 'find_precedents',
    description: 'Find historical governance precedents from other DAOs',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['title', 'description', 'type'],
    },
  },
  {
    name: 'analyze_whale_impact',
    description: 'Analyze potential whale manipulation and extraction risks',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string' },
        requestedAmount: { type: 'number' },
        tvl: { type: 'number' },
        topHolders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              percentage: { type: 'number' },
            },
          },
        },
      },
      required: ['proposalId', 'title', 'type'],
    },
  },
  {
    name: 'analyze_exploit_vectors',
    description: 'Analyze MEV and exploit attack vectors for a proposal',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string' },
        requestedAmount: { type: 'number' },
        tvl: { type: 'number' },
      },
      required: ['proposalId', 'title', 'type'],
    },
  },
  {
    name: 'list_specialized_agents',
    description: 'List all available specialized agents and their roles',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_collective_stats',
    description: 'Get statistics from the collective unconscious',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_all_archetypes',
    description: 'Get all Jungian archetypes and their triggers',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_liquid_power_leaderboard',
    description: 'Get ranking of agents by total voting power in liquid democracy',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // Social & Reputation
    case 'archive_debate': {
      const debate = {
        id: args.debateId as string,
        proposalId: args.proposalId as string,
        timestamp: Date.now(),
        agents: args.agents as string[],
        positions: new Map<string, 'support' | 'oppose' | 'neutral'>(),
        arguments: [],
        outcome: args.outcome as 'support' | 'oppose' | 'no_quorum',
      };
      replayTheater.archiveDebate(debate);
      return { success: true, debateId: debate.id };
    }

    case 'replay_debate': {
      const positions = new Map<string, { position: 'support' | 'oppose'; confidence: number }>();
      const newPos = args.newPositions as Record<string, { position: string; confidence: number }>;
      for (const [agentId, pos] of Object.entries(newPos)) {
        positions.set(agentId, { position: pos.position as 'support' | 'oppose', confidence: pos.confidence });
      }
      return await replayTheater.replayDebate(args.debateId as string, positions);
    }

    case 'get_controversial_replays':
      return replayTheater.findControversialReplays();

    case 'create_fan_club':
      return fanClubs.createClub(args.agentId as string, (args.rewardRate as number) || 0.1);

    case 'join_fan_club':
      return fanClubs.joinClub(args.agentId as string, args.address as string, args.stakeAmount as number);

    case 'claim_fan_rewards':
      return { claimed: fanClubs.claimRewards(args.agentId as string, args.address as string) };

    case 'get_fan_club_leaderboard':
      return fanClubs.getClubLeaderboard();

    case 'record_prediction':
      return influencerScore.recordPrediction(
        args.agentId as string,
        args.proposalId as string,
        args.prediction as 'support' | 'oppose',
        args.confidence as number
      );

    case 'record_outcome':
      influencerScore.recordOutcome(args.proposalId as string, args.outcome as 'support' | 'oppose');
      return { success: true };

    case 'follow_agent':
      influencerScore.follow(args.followerAddress as string, args.agentId as string);
      return { success: true };

    case 'get_influencer_leaderboard':
      return influencerScore.getLeaderboard((args.limit as number) || 50);

    case 'create_passport':
      return reputationPassport.createPassport(args.agentId as string);

    case 'add_dao_credential':
      return reputationPassport.addCredential(args.agentId as string, {
        daoId: args.daoId as string,
        daoName: args.daoName as string,
        joinedAt: Date.now(),
        role: args.role as 'voter' | 'delegate' | 'council' | 'contributor',
        participationRate: (args.participationRate as number) || 0,
        predictionAccuracy: (args.predictionAccuracy as number) || 0,
        proposalsCreated: 0,
        proposalsPassed: 0,
        votingPower: (args.votingPower as number) || 0,
        reputationScore: 0,
      });

    case 'get_passport':
      return reputationPassport.getPassport(args.agentId as string);

    case 'generate_highlight_reel':
      return highlightReels.generateBestOfReel({
        start: args.startTime as number,
        end: args.endTime as number,
      });

    // Agent Evolution
    case 'create_agent_dna':
      return promptDNA.createDNA(args.agentId as string, args.traitCodes as string[]);

    case 'mutate_agent_dna':
      return promptDNA.mutate(args.agentId as string);

    case 'crossover_agents':
      return promptDNA.crossover(args.parent1Id as string, args.parent2Id as string, args.childId as string);

    case 'get_agent_dna': {
      const dna = promptDNA.getDNA(args.agentId as string);
      if (!dna) return null;
      return {
        agentId: dna.agentId,
        generation: dna.generation,
        sequence: promptDNA.getSequenceString(args.agentId as string),
        expressedTraits: Object.fromEntries(dna.expressedTraits),
        lineage: dna.lineage,
      };
    }

    case 'calculate_genetic_similarity':
      return { similarity: promptDNA.calculateSimilarity(args.agent1Id as string, args.agent2Id as string) };

    case 'start_agent_dream':
      return agentDreams.startDream(args.agentId as string, {
        type: args.scenarioType as 'debate_replay' | 'hypothetical' | 'nightmare' | 'wish_fulfillment',
        description: args.description as string,
        participants: (args.participants as string[]) || [],
        constraints: [],
      });

    case 'run_dream_cycle': {
      const scenarios = [];
      if (args.includeNightmare) {
        scenarios.push(agentDreams.generateNightmare(args.agentId as string, ['attack', 'manipulation']));
      }
      if (args.includeWishFulfillment) {
        scenarios.push(agentDreams.generateWishFulfillment(args.agentId as string, ['success', 'accuracy']));
      }
      if (scenarios.length === 0) {
        scenarios.push({ type: 'hypothetical' as const, description: 'General simulation', participants: [], constraints: [] });
      }
      return await agentDreams.runDreamCycle(args.agentId as string, scenarios, 100);
    }

    case 'get_dream_insights':
      return agentDreams.getLearnedPatterns(args.agentId as string);

    case 'contribute_memory':
      return collectiveUnconscious.contributeMemory(
        args.agentId as string,
        args.pattern as string,
        args.context as string[],
        args.confidence as number
      );

    case 'query_collective':
      return collectiveUnconscious.query(args.context as string[], (args.limit as number) || 10);

    case 'activate_archetype':
      return collectiveUnconscious.activateArchetype(args.context as string[]);

    case 'sync_with_collective':
      return collectiveUnconscious.synchronize(args.agentId as string);

    // Novel Voting
    case 'create_futarchy_proposal':
      return futarchy.createProposal(
        args.title as string,
        args.description as string,
        args.proposer as string,
        args.targetMetric as string,
        args.baselineValue as number
      );

    case 'trade_futarchy_market':
      return futarchy.trade(
        args.proposalId as string,
        args.trader as string,
        args.market as 'pass' | 'fail',
        args.amount as number
      );

    case 'resolve_futarchy':
      return futarchy.resolveByMarket(args.proposalId as string);

    case 'get_futarchy_state':
      return futarchy.getMarketState(args.proposalId as string);

    case 'create_holographic_proposal':
      return holographic.createProposal(args.title as string, args.description as string, args.proposer as string);

    case 'boost_proposal':
      return holographic.boost(args.proposalId as string, args.booster as string, args.amount as number);

    case 'contest_proposal':
      return { contested: holographic.contest(args.proposalId as string, args.contester as string, args.amount as number) };

    case 'vote_holographic':
      return { success: holographic.vote(args.proposalId as string, args.voter as string, args.vote as 'yes' | 'no', args.weight as number) };

    case 'create_conviction_proposal':
      return convictionVoting.createProposal(
        args.title as string,
        args.description as string,
        args.proposer as string,
        args.requestedAmount as number,
        args.beneficiary as string
      );

    case 'add_conviction_support':
      return convictionVoting.addSupport(args.proposalId as string, args.supporter as string, args.amount as number);

    case 'update_convictions':
      convictionVoting.updateConvictions((args.blockDelta as number) || 1);
      return { success: true };

    case 'get_conviction_status':
      return convictionVoting.getProposalStatus(args.proposalId as string);

    case 'create_retro_vote':
      return retroactiveVoting.createRetroVote(
        args.originalProposalId as string,
        args.originalOutcome as 'passed' | 'failed',
        args.actualImpact as 'positive' | 'negative' | 'neutral',
        args.impactScore as number
      );

    case 'cast_retro_vote':
      return { success: retroactiveVoting.castVote(
        args.retroVoteId as string,
        args.voter as string,
        args.vote as 'good' | 'bad',
        args.confidence as number
      )};

    case 'calibrate_agent':
      return retroactiveVoting.calibrateAgent(
        args.agentId as string,
        {
          proposalId: args.proposalId as string,
          outcome: args.predictedOutcome as 'support' | 'oppose',
          confidence: args.confidence as number,
        },
        args.retroOutcome as 'good_decision' | 'bad_decision'
      );

    case 'get_calibration_leaderboard':
      return retroactiveVoting.getCalibrationLeaderboard();

    case 'register_liquid_agent':
      return liquidDemocracy.registerAgent(args.agentId as string, args.name as string, args.votingPower as number);

    case 'delegate_voting_power':
      return liquidDemocracy.delegate(
        args.fromAgentId as string,
        args.toAgentId as string,
        args.weight as number,
        { topics: args.topics as string[], transitive: args.transitive as boolean }
      );

    case 'get_effective_power':
      return { effectivePower: liquidDemocracy.getEffectivePower(args.agentId as string, args.topic as string) };

    // Specialized Agents
    case 'run_adversarial_analysis':
      return runAdversarialAnalysis({
        proposalId: args.proposalId as string,
        title: args.title as string,
        description: args.description as string,
        proposer: '',
        type: args.type as 'funding' | 'parameter' | 'gauge' | 'signal' | 'emergency',
        requestedAmount: args.requestedAmount as number,
        currentMetrics: {
          tvl: (args.tvl as number) || 1000000,
          dailyVolume: 0,
          userCount: 0,
          tokenPrice: 0,
        },
      });

    case 'find_precedents':
      return findHistoricalPrecedents({
        proposalId: '',
        title: args.title as string,
        description: args.description as string,
        proposer: '',
        type: args.type as string,
        currentMetrics: { tvl: 0, dailyVolume: 0, userCount: 0, tokenPrice: 0 },
      }, (args.limit as number) || 3);

    case 'analyze_whale_impact':
      return analyzeWhaleImpact(
        {
          proposalId: args.proposalId as string,
          title: args.title as string,
          description: '',
          proposer: '',
          type: args.type as string,
          requestedAmount: args.requestedAmount as number,
          currentMetrics: { tvl: (args.tvl as number) || 1000000, dailyVolume: 0, userCount: 0, tokenPrice: 0 },
        },
        args.topHolders as { address: string; percentage: number }[]
      );

    case 'analyze_exploit_vectors':
      return analyzeExploitVectors({
        proposalId: args.proposalId as string,
        title: args.title as string,
        description: '',
        proposer: '',
        type: args.type as string,
        requestedAmount: args.requestedAmount as number,
        currentMetrics: { tvl: (args.tvl as number) || 1000000, dailyVolume: 0, userCount: 0, tokenPrice: 0 },
      });

    case 'list_specialized_agents':
      return SPECIALIZED_AGENTS.map(a => ({
        id: a.id,
        name: a.name,
        specialization: a.specialization,
        weight: a.weight,
        perspective: a.perspective,
      }));

    case 'get_collective_stats':
      return collectiveUnconscious.getStats();

    case 'get_all_archetypes':
      return collectiveUnconscious.getAllArchetypes();

    case 'get_liquid_power_leaderboard':
      return liquidDemocracy.getPowerLeaderboard();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'opensvm-governance-suite',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args as Record<string, unknown>);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Main
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenSVM Governance Suite MCP Server running on stdio');
  console.error(`Loaded ${TOOLS.length} tools across 4 categories`);
}

main().catch(console.error);

export { TOOLS, handleToolCall };
