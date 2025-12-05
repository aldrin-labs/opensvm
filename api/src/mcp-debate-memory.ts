#!/usr/bin/env bun
/**
 * MCP Server for Debate Memory Operations
 *
 * Provides tools for AI agents to:
 * - Query past debates and outcomes
 * - Record outcomes for learning
 * - Get learning insights
 * - Track agent performance
 * - Manage memory persistence
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  AgentMemoryManager,
  getAgentMemoryManager,
  DebateMemory,
} from './agent-memory.js';
import { MemoryPersistence, getMemoryPersistence } from './memory-persistence.js';

// ============================================================================
// Memory Instance
// ============================================================================

const memory = getAgentMemoryManager();
let persistence: MemoryPersistence | null = null;

// Try to load persisted memory
try {
  persistence = getMemoryPersistence();
  const loaded = persistence.load();
  if (loaded) {
    memory.import(loaded);
    console.error(`Loaded ${(memory.getStats() as any).totalMemories} memories from disk`);
  }
} catch {
  console.error('Persistence not available, using in-memory storage');
}

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // --- Memory Queries ---
  {
    name: 'search_debate_memories',
    description: 'Search for similar past debates given a proposal context',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Proposal title to search for' },
        description: { type: 'string', description: 'Proposal description' },
        type: {
          type: 'string',
          enum: ['funding', 'parameter', 'signal', 'gauge', 'emergency'],
          description: 'Type of proposal',
        },
        max_results: { type: 'number', description: 'Maximum results (default 5)' },
      },
      required: ['title', 'description', 'type'],
    },
  },
  {
    name: 'get_debate_memory',
    description: 'Get a specific debate memory by ID',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'ID of the memory' },
      },
      required: ['memory_id'],
    },
  },
  {
    name: 'list_debate_memories',
    description: 'List all stored debate memories with filtering',
    inputSchema: {
      type: 'object',
      properties: {
        recommendation: {
          type: 'string',
          enum: ['support', 'oppose', 'abstain'],
        },
        with_outcomes: { type: 'boolean', description: 'Only with recorded outcomes' },
        limit: { type: 'number', description: 'Maximum results' },
      },
    },
  },

  // --- Outcome Recording ---
  {
    name: 'record_debate_outcome',
    description: 'Record the actual outcome of a proposal for agent learning',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'ID of the debate memory' },
        implemented: { type: 'boolean', description: 'Whether proposal was implemented' },
        success: {
          type: 'string',
          enum: ['positive', 'negative', 'neutral'],
          description: 'Overall outcome',
        },
        tvl_change: { type: 'number', description: 'Measured TVL change (%)' },
        volume_change: { type: 'number', description: 'Measured volume change (%)' },
        user_change: { type: 'number', description: 'Measured user count change (%)' },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['memory_id', 'implemented'],
    },
  },

  // --- Learning Insights ---
  {
    name: 'get_learning_insights',
    description: 'Get learning insights from accumulated debate history',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_debate_patterns',
    description: 'Get detected patterns from past debates',
    inputSchema: {
      type: 'object',
      properties: {
        min_frequency: { type: 'number', description: 'Minimum pattern frequency' },
      },
    },
  },

  // --- Agent Performance ---
  {
    name: 'get_debate_agent_stats',
    description: 'Get performance statistics for a specific debate agent',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'ID of the agent' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'get_all_debate_agent_stats',
    description: 'Get performance statistics for all debate agents',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_top_debate_agents',
    description: 'Get the best performing debate agents',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number to return (default 3)' },
      },
    },
  },
  {
    name: 'get_weight_suggestions',
    description: 'Get suggested weight adjustments based on performance',
    inputSchema: { type: 'object', properties: {} },
  },

  // --- Memory Management ---
  {
    name: 'get_debate_memory_stats',
    description: 'Get overall debate memory statistics',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'save_debate_memory',
    description: 'Persist debate memory to disk',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'clear_debate_memory',
    description: 'Clear all debate memories (use with caution)',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to confirm' },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'export_debate_memory',
    description: 'Export debate memory state as JSON',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  { name: 'debate-memory-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // --- Memory Queries ---
      case 'search_debate_memories': {
        const context = {
          title: args.title as string,
          description: args.description as string,
          type: args.type as any,
          currentMetrics: { tvl: 0, volume24h: 0, fees24h: 0, activeUsers: 0, tokenPrice: 1, avgApy: 0 },
        };
        const similar = memory.findSimilar(context, (args.max_results as number) || 5);
        result = {
          count: similar.length,
          memories: similar.map(m => ({
            id: m.id,
            title: m.proposal.title,
            type: m.proposal.type,
            recommendation: m.result.finalRecommendation,
            consensus: `${(m.result.consensusStrength * 100).toFixed(0)}%`,
            similarity: `${((m.similarity || 0) * 100).toFixed(0)}%`,
            hasOutcome: !!m.actualOutcome,
            outcome: m.actualOutcome?.success,
          })),
        };
        break;
      }

      case 'get_debate_memory': {
        const data = memory.export() as any;
        const memories = new Map(data.memories);
        const mem = memories.get(args.memory_id as string) as DebateMemory | undefined;
        if (!mem) {
          result = { success: false, error: 'Memory not found' };
        } else {
          result = {
            success: true,
            memory: {
              id: mem.id,
              timestamp: new Date(mem.timestamp).toISOString(),
              proposal: { title: mem.proposal.title, type: mem.proposal.type },
              result: {
                recommendation: mem.result.finalRecommendation,
                consensus: `${(mem.result.consensusStrength * 100).toFixed(0)}%`,
                reasoning: mem.result.majorityReasoning,
              },
              outcome: mem.actualOutcome,
            },
          };
        }
        break;
      }

      case 'list_debate_memories': {
        const data = memory.export() as any;
        let memories = data.memories as Array<[string, DebateMemory]>;
        if (args.recommendation) {
          memories = memories.filter(([, m]) => m.result.finalRecommendation === args.recommendation);
        }
        if (args.with_outcomes) {
          memories = memories.filter(([, m]) => !!m.actualOutcome);
        }
        memories = memories.slice(-((args.limit as number) || 20));
        result = {
          total: memories.length,
          memories: memories.map(([id, m]) => ({
            id,
            title: m.proposal.title,
            type: m.proposal.type,
            recommendation: m.result.finalRecommendation,
            hasOutcome: !!m.actualOutcome,
          })),
        };
        break;
      }

      // --- Outcome Recording ---
      case 'record_debate_outcome': {
        const success = memory.recordOutcome(args.memory_id as string, {
          implemented: args.implemented as boolean,
          success: args.success as 'positive' | 'negative' | 'neutral' | undefined,
          measuredImpact: {
            tvlChange: args.tvl_change as number | undefined,
            volumeChange: args.volume_change as number | undefined,
            userChange: args.user_change as number | undefined,
          },
          notes: args.notes as string | undefined,
          recordedAt: Date.now(),
        });
        if (success && persistence) persistence.save(memory.export());
        result = { success, message: success ? 'Outcome recorded' : 'Memory not found' };
        break;
      }

      // --- Learning Insights ---
      case 'get_learning_insights': {
        result = { insights: memory.generateInsights() };
        break;
      }

      case 'get_debate_patterns': {
        const data = memory.export() as any;
        let patterns = data.patterns || [];
        if (args.min_frequency) {
          patterns = patterns.filter((p: any) => p.frequency >= args.min_frequency);
        }
        result = {
          count: patterns.length,
          patterns: patterns.map((p: any) => ({
            description: p.description,
            frequency: p.frequency,
            reliability: `${(p.reliability * 100).toFixed(0)}%`,
          })),
        };
        break;
      }

      // --- Agent Performance ---
      case 'get_debate_agent_stats': {
        const stats = memory.getAgentPerformance(args.agent_id as string);
        if (!stats) {
          result = { success: false, error: 'Agent not found' };
        } else {
          result = {
            success: true,
            stats: {
              agentId: stats.agentId,
              totalDebates: stats.totalDebates,
              accuracy: `${(stats.accuracy * 100).toFixed(0)}%`,
              calibration: `${(stats.calibration * 100).toFixed(0)}%`,
              bias: stats.biases.overallBias,
              strengths: stats.strengthAreas,
              weaknesses: stats.weaknessAreas,
            },
          };
        }
        break;
      }

      case 'get_all_debate_agent_stats': {
        const allStats = memory.getAllPerformance();
        result = {
          count: allStats.length,
          agents: allStats.map(s => ({
            id: s.agentId,
            debates: s.totalDebates,
            accuracy: `${(s.accuracy * 100).toFixed(0)}%`,
            bias: s.biases.overallBias,
          })),
        };
        break;
      }

      case 'get_top_debate_agents': {
        const topAgents = memory.getTopAgents((args.count as number) || 3);
        result = {
          topAgents: topAgents.map(s => ({
            id: s.agentId,
            accuracy: `${(s.accuracy * 100).toFixed(0)}%`,
            debates: s.totalDebates,
          })),
        };
        break;
      }

      case 'get_weight_suggestions': {
        const adjustments = memory.suggestWeightAdjustments();
        result = {
          suggestions: Object.fromEntries(
            Array.from(adjustments.entries()).map(([id, adj]) => [
              id,
              { adjustment: adj > 0 ? `+${(adj * 100).toFixed(1)}%` : `${(adj * 100).toFixed(1)}%` },
            ])
          ),
        };
        break;
      }

      // --- Memory Management ---
      case 'get_debate_memory_stats': {
        result = memory.getStats();
        break;
      }

      case 'save_debate_memory': {
        if (!persistence) {
          result = { success: false, error: 'Persistence not available' };
        } else {
          persistence.save(memory.export());
          result = { success: true, message: 'Memory saved to disk' };
        }
        break;
      }

      case 'clear_debate_memory': {
        if (!args.confirm) {
          result = { success: false, error: 'Must confirm=true to clear' };
        } else {
          memory.clear();
          if (persistence) persistence.save(memory.export());
          result = { success: true, message: 'Memory cleared' };
        }
        break;
      }

      case 'export_debate_memory': {
        result = memory.export();
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
  console.error('Debate Memory MCP Server running on stdio');
}

main().catch(console.error);

export { server, memory, persistence };
