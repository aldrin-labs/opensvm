#!/usr/bin/env bun
/**
 * MCP Server for Governance Timelock
 *
 * Provides tools for AI agents to participate in governance workflows:
 * - Queue governance actions
 * - Sign for multi-sig operations
 * - Execute ready actions
 * - Monitor pending/ready actions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  TimelockController,
  ActionType,
  ActionStatus,
  TimelockAction,
} from './governance-timelock.js';

// ============================================================================
// Timelock Controller Instance
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const timelockController = new TimelockController({
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
    signers: ['guardian1', 'guardian2', 'guardian3', 'guardian4', 'guardian5'],
    threshold: 3,
  },
  minDelay: 1 * HOUR,
  maxDelay: 30 * DAY,
});

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // --- Action Management ---
  {
    name: 'timelock_queue_action',
    description: 'Queue a governance action for execution after timelock delay. Returns action details including ETA.',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['parameter_change', 'gauge_creation', 'gauge_removal', 'emission_change', 'fee_change', 'treasury_spend', 'upgrade', 'emergency'],
          description: 'Type of governance action',
        },
        target: {
          type: 'string',
          description: 'Target contract/module for the action',
        },
        data: {
          type: 'object',
          description: 'Action parameters (varies by action type)',
        },
        proposer: {
          type: 'string',
          description: 'Address of the proposer',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of the action',
        },
      },
      required: ['action_type', 'target', 'data', 'proposer', 'description'],
    },
  },
  {
    name: 'timelock_queue_batch',
    description: 'Queue multiple actions as a batch (all execute together or none). Uses longest delay.',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action_type: { type: 'string' },
              target: { type: 'string' },
              data: { type: 'object' },
              description: { type: 'string' },
            },
            required: ['action_type', 'target', 'data', 'description'],
          },
          description: 'Array of actions to batch together',
        },
        proposer: {
          type: 'string',
          description: 'Address of the proposer',
        },
      },
      required: ['actions', 'proposer'],
    },
  },
  {
    name: 'timelock_execute',
    description: 'Execute a queued action after its timelock has expired',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'ID of the action to execute',
        },
        executor: {
          type: 'string',
          description: 'Address executing the action',
        },
      },
      required: ['action_id', 'executor'],
    },
  },
  {
    name: 'timelock_execute_batch',
    description: 'Execute all actions in a batch atomically',
    inputSchema: {
      type: 'object',
      properties: {
        batch_id: {
          type: 'string',
          description: 'ID of the batch to execute',
        },
        executor: {
          type: 'string',
          description: 'Address executing the batch',
        },
      },
      required: ['batch_id', 'executor'],
    },
  },

  // --- Multi-Sig Operations ---
  {
    name: 'timelock_sign',
    description: 'Sign an action for multi-sig approval, cancellation, or expediting',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'ID of the action to sign',
        },
        signer: {
          type: 'string',
          description: 'Address of the signer (must be authorized)',
        },
        sign_action: {
          type: 'string',
          enum: ['approve', 'cancel', 'expedite'],
          description: 'Type of signature: approve, cancel (veto), or expedite (reduce delay)',
        },
      },
      required: ['action_id', 'signer', 'sign_action'],
    },
  },
  {
    name: 'timelock_get_signatures',
    description: 'Get all signatures for an action',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'ID of the action',
        },
        sign_action: {
          type: 'string',
          enum: ['approve', 'cancel', 'expedite'],
          description: 'Filter by signature type (optional)',
        },
      },
      required: ['action_id'],
    },
  },

  // --- Queries ---
  {
    name: 'timelock_get_action',
    description: 'Get details of a specific action by ID',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'ID of the action',
        },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'timelock_get_actions_by_status',
    description: 'Get all actions with a specific status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['queued', 'ready', 'executed', 'cancelled', 'expired'],
          description: 'Status to filter by',
        },
      },
      required: ['status'],
    },
  },
  {
    name: 'timelock_get_ready_actions',
    description: 'Get all actions ready for execution (timelock expired, not yet expired)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'timelock_get_pending_actions',
    description: 'Get all pending actions (queued but timelock not yet expired)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'timelock_is_ready',
    description: 'Check if a specific action is ready for execution',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'ID of the action',
        },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'timelock_time_until_ready',
    description: 'Get time remaining until an action can be executed',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'ID of the action',
        },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'timelock_get_batch_actions',
    description: 'Get all actions in a batch',
    inputSchema: {
      type: 'object',
      properties: {
        batch_id: {
          type: 'string',
          description: 'ID of the batch',
        },
      },
      required: ['batch_id'],
    },
  },

  // --- Statistics & Configuration ---
  {
    name: 'timelock_get_stats',
    description: 'Get overall timelock statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'timelock_get_config',
    description: 'Get current timelock configuration (delays, multi-sig settings)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // --- Admin Operations ---
  {
    name: 'timelock_expire_stale',
    description: 'Expire all stale actions (past grace period)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatAction(action: TimelockAction) {
  const now = Date.now();
  return {
    ...action,
    timeUntilReady: action.eta > now ? action.eta - now : 0,
    timeUntilExpiry: action.expiresAt > now ? action.expiresAt - now : 0,
    etaFormatted: new Date(action.eta).toISOString(),
    expiresAtFormatted: new Date(action.expiresAt).toISOString(),
    isReady: now >= action.eta && now <= action.expiresAt && action.status === 'queued',
  };
}

function formatDuration(ms: number): string {
  if (ms < HOUR) return `${Math.round(ms / 60000)} minutes`;
  if (ms < DAY) return `${(ms / HOUR).toFixed(1)} hours`;
  return `${(ms / DAY).toFixed(1)} days`;
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  {
    name: 'governance-timelock-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // --- Action Management ---
      case 'timelock_queue_action': {
        const action = timelockController.queueAction(
          args.action_type as ActionType,
          args.target as string,
          args.data as Record<string, unknown>,
          args.proposer as string,
          args.description as string
        );
        result = {
          success: true,
          action: formatAction(action),
          message: `Action queued. Executable after ${formatDuration(action.eta - Date.now())}`,
        };
        break;
      }

      case 'timelock_queue_batch': {
        const actions = timelockController.queueBatch(
          (args.actions as Array<{
            action_type: ActionType;
            target: string;
            data: Record<string, unknown>;
            description: string;
          }>).map(a => ({
            actionType: a.action_type as ActionType,
            target: a.target,
            data: a.data,
            description: a.description,
          })),
          args.proposer as string
        );
        result = {
          success: true,
          batchId: actions[0]?.batch,
          actions: actions.map(formatAction),
          message: `Batch of ${actions.length} actions queued`,
        };
        break;
      }

      case 'timelock_execute': {
        const action = timelockController.execute(
          args.action_id as string,
          args.executor as string
        );
        result = {
          success: true,
          action: formatAction(action),
          message: 'Action executed successfully',
        };
        break;
      }

      case 'timelock_execute_batch': {
        const actions = timelockController.executeBatch(
          args.batch_id as string,
          args.executor as string
        );
        result = {
          success: true,
          executedCount: actions.length,
          actions: actions.map(formatAction),
          message: `Batch executed: ${actions.length} actions`,
        };
        break;
      }

      // --- Multi-Sig Operations ---
      case 'timelock_sign': {
        const sig = timelockController.sign(
          args.action_id as string,
          args.signer as string,
          args.sign_action as 'approve' | 'cancel' | 'expedite'
        );

        const action = timelockController.getAction(args.action_id as string);
        const allSigs = timelockController.getSignatures(args.action_id as string, args.sign_action as 'approve' | 'cancel' | 'expedite');
        const config = timelockController.getConfig();

        result = {
          success: true,
          signature: sig,
          currentSignatures: allSigs.length,
          requiredSignatures: config.multiSig.threshold,
          actionStatus: action?.status,
          message: allSigs.length >= config.multiSig.threshold
            ? `Threshold reached! Action ${args.sign_action}d.`
            : `Signature recorded. ${config.multiSig.threshold - allSigs.length} more needed.`,
        };
        break;
      }

      case 'timelock_get_signatures': {
        const sigs = timelockController.getSignatures(
          args.action_id as string,
          args.sign_action as 'approve' | 'cancel' | 'expedite' | undefined
        );
        const config = timelockController.getConfig();
        result = {
          signatures: sigs,
          count: sigs.length,
          threshold: config.multiSig.threshold,
        };
        break;
      }

      // --- Queries ---
      case 'timelock_get_action': {
        const action = timelockController.getAction(args.action_id as string);
        if (!action) {
          result = { success: false, error: 'Action not found' };
        } else {
          result = { success: true, action: formatAction(action) };
        }
        break;
      }

      case 'timelock_get_actions_by_status': {
        const actions = timelockController.getActionsByStatus(args.status as ActionStatus);
        result = {
          count: actions.length,
          actions: actions.map(formatAction),
        };
        break;
      }

      case 'timelock_get_ready_actions': {
        const actions = timelockController.getReadyActions();
        result = {
          count: actions.length,
          actions: actions.map(formatAction),
          message: actions.length > 0
            ? `${actions.length} action(s) ready for execution`
            : 'No actions ready for execution',
        };
        break;
      }

      case 'timelock_get_pending_actions': {
        const actions = timelockController.getPendingActions();
        result = {
          count: actions.length,
          actions: actions.map(a => ({
            ...formatAction(a),
            timeUntilReadyFormatted: formatDuration(a.eta - Date.now()),
          })),
        };
        break;
      }

      case 'timelock_is_ready': {
        const isReady = timelockController.isReady(args.action_id as string);
        const action = timelockController.getAction(args.action_id as string);
        result = {
          actionId: args.action_id,
          isReady,
          status: action?.status,
          message: isReady ? 'Action is ready for execution' : 'Action is not ready',
        };
        break;
      }

      case 'timelock_time_until_ready': {
        const timeMs = timelockController.getTimeUntilReady(args.action_id as string);
        result = {
          actionId: args.action_id,
          timeUntilReadyMs: timeMs,
          timeUntilReadyFormatted: timeMs > 0 ? formatDuration(timeMs) : 'Ready now',
          isReady: timeMs === 0,
        };
        break;
      }

      case 'timelock_get_batch_actions': {
        const actions = timelockController.getBatchActions(args.batch_id as string);
        result = {
          batchId: args.batch_id,
          count: actions.length,
          actions: actions.map(formatAction),
        };
        break;
      }

      // --- Statistics & Configuration ---
      case 'timelock_get_stats': {
        const stats = timelockController.getStats();
        result = {
          ...stats,
          avgExecutionTimeFormatted: formatDuration(stats.avgExecutionTime),
        };
        break;
      }

      case 'timelock_get_config': {
        const config = timelockController.getConfig();
        result = {
          ...config,
          delaysFormatted: Object.fromEntries(
            Object.entries(config.delays).map(([k, v]) => [k, formatDuration(v)])
          ),
          gracePeriodFormatted: formatDuration(config.gracePeriod),
          minDelayFormatted: formatDuration(config.minDelay),
          maxDelayFormatted: formatDuration(config.maxDelay),
        };
        break;
      }

      // --- Admin Operations ---
      case 'timelock_expire_stale': {
        const expired = timelockController.expireStale();
        result = {
          expiredCount: expired,
          message: expired > 0 ? `Expired ${expired} stale action(s)` : 'No stale actions to expire',
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
  console.error('Governance Timelock MCP Server running on stdio');
}

main().catch(console.error);

export { server, timelockController };
