#!/usr/bin/env bun
/**
 * MCP Server for Multi-Agent Debate System
 *
 * Provides tools for AI agents to:
 * - Trigger governance debates
 * - Query debate results
 * - Manage debate agents
 * - Access debate history
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  MultiAgentDebateEngine,
  DebateResult,
  DebateAgent,
} from './multi-agent-debate.js';
import { ProposalContext } from './llm-proposal-analyzer.js';

// ============================================================================
// Debate Engine Instance
// ============================================================================

const debateEngine = new MultiAgentDebateEngine({
  rounds: 2,
  minConsensus: 0.8,
  enableCrossExamination: true,
  enableRebuttals: true,
  agentTimeout: 30000,
});

// Debate history storage
const debateHistory = new Map<string, DebateResult>();
let debateCounter = 0;

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // --- Debate Execution ---
  {
    name: 'debate_proposal',
    description: 'Run a full multi-agent debate on a governance proposal. Multiple AI agents with different perspectives analyze and debate the proposal.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the proposal to debate',
        },
        description: {
          type: 'string',
          description: 'Full description of the proposal',
        },
        type: {
          type: 'string',
          enum: ['funding', 'parameter', 'signal', 'gauge', 'emergency'],
          description: 'Type of proposal',
        },
        requested_amount: {
          type: 'number',
          description: 'Amount requested (for funding proposals)',
        },
        tvl: {
          type: 'number',
          description: 'Current TVL in USD',
        },
        volume_24h: {
          type: 'number',
          description: 'Current 24h volume in USD',
        },
        fees_24h: {
          type: 'number',
          description: 'Current 24h fees in USD',
        },
        active_users: {
          type: 'number',
          description: 'Number of active users',
        },
        token_price: {
          type: 'number',
          description: 'Current token price in USD',
        },
        avg_apy: {
          type: 'number',
          description: 'Average APY (0-1)',
        },
      },
      required: ['title', 'description', 'type'],
    },
  },
  {
    name: 'quick_debate',
    description: 'Run a quick single-round debate without cross-examination (faster but less thorough)',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the proposal',
        },
        description: {
          type: 'string',
          description: 'Description of the proposal',
        },
        type: {
          type: 'string',
          enum: ['funding', 'parameter', 'signal', 'gauge', 'emergency'],
        },
      },
      required: ['title', 'description', 'type'],
    },
  },

  // --- Results & History ---
  {
    name: 'get_debate_result',
    description: 'Get the result of a completed debate by ID',
    inputSchema: {
      type: 'object',
      properties: {
        debate_id: {
          type: 'string',
          description: 'ID of the debate to retrieve',
        },
      },
      required: ['debate_id'],
    },
  },
  {
    name: 'list_debates',
    description: 'List all debates in history with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        recommendation: {
          type: 'string',
          enum: ['support', 'oppose', 'abstain'],
          description: 'Filter by final recommendation',
        },
        min_consensus: {
          type: 'number',
          description: 'Minimum consensus strength (0-1)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
        },
      },
    },
  },
  {
    name: 'get_debate_summary',
    description: 'Get a concise summary of a debate suitable for reporting',
    inputSchema: {
      type: 'object',
      properties: {
        debate_id: {
          type: 'string',
          description: 'ID of the debate',
        },
      },
      required: ['debate_id'],
    },
  },

  // --- Agent Management ---
  {
    name: 'list_agents',
    description: 'List all debate agents and their configurations',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_custom_agent',
    description: 'Add a custom debate agent with a specific perspective',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique ID for the agent',
        },
        name: {
          type: 'string',
          description: 'Display name',
        },
        perspective: {
          type: 'string',
          description: 'Agent perspective (e.g., "security", "legal")',
        },
        system_prompt: {
          type: 'string',
          description: 'System prompt defining agent behavior',
        },
        weight: {
          type: 'number',
          description: 'Voting weight (0-1)',
        },
      },
      required: ['id', 'name', 'perspective', 'system_prompt', 'weight'],
    },
  },
  {
    name: 'remove_agent',
    description: 'Remove an agent from the debate panel',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'ID of agent to remove',
        },
      },
      required: ['agent_id'],
    },
  },

  // --- Analysis ---
  {
    name: 'get_agent_positions',
    description: 'Get all agent positions from a debate',
    inputSchema: {
      type: 'object',
      properties: {
        debate_id: {
          type: 'string',
          description: 'ID of the debate',
        },
      },
      required: ['debate_id'],
    },
  },
  {
    name: 'get_points_of_contention',
    description: 'Get the main points where agents disagreed',
    inputSchema: {
      type: 'object',
      properties: {
        debate_id: {
          type: 'string',
          description: 'ID of the debate',
        },
      },
      required: ['debate_id'],
    },
  },
  {
    name: 'compare_debates',
    description: 'Compare outcomes of multiple debates',
    inputSchema: {
      type: 'object',
      properties: {
        debate_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of debates to compare',
        },
      },
      required: ['debate_ids'],
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function buildContext(args: Record<string, unknown>): ProposalContext {
  return {
    title: args.title as string,
    description: args.description as string,
    type: args.type as 'funding' | 'parameter' | 'signal' | 'gauge' | 'emergency',
    requestedAmount: args.requested_amount as number | undefined,
    currentMetrics: {
      tvl: (args.tvl as number) || 10000000,
      volume24h: (args.volume_24h as number) || 500000,
      fees24h: (args.fees_24h as number) || 5000,
      activeUsers: (args.active_users as number) || 1000,
      tokenPrice: (args.token_price as number) || 1.0,
      avgApy: (args.avg_apy as number) || 0.1,
    },
  };
}

function formatDebateResult(result: DebateResult) {
  return {
    recommendation: result.finalRecommendation,
    consensusStrength: `${(result.consensusStrength * 100).toFixed(1)}%`,
    score: result.aggregatedScore.toFixed(1),
    confidence: `${(result.aggregatedConfidence * 100).toFixed(1)}%`,
    agreement: result.pointsOfAgreement,
    disagreement: result.pointsOfDisagreement,
    concerns: result.unresolvedConcerns,
    reasoning: result.majorityReasoning,
    dissent: result.dissent,
    rounds: result.debateRounds,
    duration: `${(result.duration / 1000).toFixed(1)}s`,
  };
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  {
    name: 'debate-mcp',
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
    let result: unknown;

    switch (name) {
      // --- Debate Execution ---
      case 'debate_proposal': {
        const context = buildContext(args as Record<string, unknown>);

        debateCounter++;
        const debateId = `DEBATE-${debateCounter}`;

        const debateResult = await debateEngine.debate(context);
        debateHistory.set(debateId, debateResult);

        result = {
          success: true,
          debateId,
          ...formatDebateResult(debateResult),
        };
        break;
      }

      case 'quick_debate': {
        const context = buildContext(args as Record<string, unknown>);

        debateCounter++;
        const debateId = `DEBATE-${debateCounter}`;

        const debateResult = await debateEngine.quickDebate(context);
        debateHistory.set(debateId, debateResult);

        result = {
          success: true,
          debateId,
          ...formatDebateResult(debateResult),
          note: 'Quick debate - single round, no cross-examination',
        };
        break;
      }

      // --- Results & History ---
      case 'get_debate_result': {
        const debateId = args.debate_id as string;
        const debate = debateHistory.get(debateId);

        if (!debate) {
          result = { success: false, error: 'Debate not found' };
        } else {
          result = {
            success: true,
            debateId,
            ...formatDebateResult(debate),
          };
        }
        break;
      }

      case 'list_debates': {
        const recommendation = args.recommendation as string | undefined;
        const minConsensus = args.min_consensus as number | undefined;
        const limit = (args.limit as number) || 20;

        let debates = Array.from(debateHistory.entries());

        if (recommendation) {
          debates = debates.filter(([, d]) => d.finalRecommendation === recommendation);
        }

        if (minConsensus !== undefined) {
          debates = debates.filter(([, d]) => d.consensusStrength >= minConsensus);
        }

        debates = debates.slice(-limit);

        result = {
          total: debates.length,
          debates: debates.map(([id, d]) => ({
            id,
            title: d.proposalTitle,
            recommendation: d.finalRecommendation,
            consensus: `${(d.consensusStrength * 100).toFixed(1)}%`,
          })),
        };
        break;
      }

      case 'get_debate_summary': {
        const debateId = args.debate_id as string;
        const debate = debateHistory.get(debateId);

        if (!debate) {
          result = { success: false, error: 'Debate not found' };
        } else {
          result = {
            title: debate.proposalTitle,
            recommendation: debate.finalRecommendation.toUpperCase(),
            consensus: `${(debate.consensusStrength * 100).toFixed(0)}%`,
            summary: debate.majorityReasoning,
            keyPoints: [
              ...debate.pointsOfAgreement.slice(0, 2).map(p => `[+] ${p}`),
              ...debate.unresolvedConcerns.slice(0, 2).map(c => `[!] ${c}`),
            ],
          };
        }
        break;
      }

      // --- Agent Management ---
      case 'list_agents': {
        const agents = debateEngine.getAgents();
        result = {
          count: agents.length,
          agents: agents.map(a => ({
            id: a.id,
            name: a.name,
            perspective: a.perspective,
            weight: a.weight,
          })),
        };
        break;
      }

      case 'add_custom_agent': {
        const agent: DebateAgent = {
          id: args.id as string,
          name: args.name as string,
          perspective: args.perspective as any,
          systemPrompt: args.system_prompt as string,
          weight: args.weight as number,
        };

        debateEngine.addAgent(agent);
        result = {
          success: true,
          message: `Agent "${agent.name}" added`,
          agentId: agent.id,
        };
        break;
      }

      case 'remove_agent': {
        const removed = debateEngine.removeAgent(args.agent_id as string);
        result = {
          success: removed,
          message: removed ? 'Agent removed' : 'Agent not found',
        };
        break;
      }

      // --- Analysis ---
      case 'get_agent_positions': {
        const debateId = args.debate_id as string;
        const debate = debateHistory.get(debateId);

        if (!debate) {
          result = { success: false, error: 'Debate not found' };
        } else {
          const positions = debate.rounds[0]?.analyses.map(a => ({
            agent: a.agentId,
            perspective: a.perspective,
            recommendation: a.analysis.recommendation,
            confidence: `${(a.confidence * 100).toFixed(0)}%`,
            keyArguments: a.keyArguments.slice(0, 3),
          })) || [];

          result = { positions };
        }
        break;
      }

      case 'get_points_of_contention': {
        const debateId = args.debate_id as string;
        const debate = debateHistory.get(debateId);

        if (!debate) {
          result = { success: false, error: 'Debate not found' };
        } else {
          result = {
            disagreements: debate.pointsOfDisagreement,
            unresolvedConcerns: debate.unresolvedConcerns,
            dissent: debate.dissent.map(d => ({
              agent: d.agentId,
              view: d.dissent,
            })),
          };
        }
        break;
      }

      case 'compare_debates': {
        const ids = args.debate_ids as string[];
        const debates = ids.map(id => ({
          id,
          debate: debateHistory.get(id),
        })).filter(d => d.debate);

        result = {
          count: debates.length,
          comparison: debates.map(d => ({
            id: d.id,
            title: d.debate!.proposalTitle,
            recommendation: d.debate!.finalRecommendation,
            consensus: d.debate!.consensusStrength,
            score: d.debate!.aggregatedScore,
          })),
          summary: {
            supportCount: debates.filter(d => d.debate!.finalRecommendation === 'support').length,
            opposeCount: debates.filter(d => d.debate!.finalRecommendation === 'oppose').length,
            abstainCount: debates.filter(d => d.debate!.finalRecommendation === 'abstain').length,
            avgConsensus: debates.reduce((sum, d) => sum + d.debate!.consensusStrength, 0) / debates.length,
          },
        };
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
      isError: true,
    };
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Debate MCP Server running on stdio');
}

main().catch(console.error);

export { server, debateEngine, debateHistory };
