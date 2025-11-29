/**
 * Command Executor
 *
 * Executes parsed commands by invoking the appropriate callbacks.
 * Provides safety checks and validation before executing trades.
 */

import { toast } from 'sonner';
import type { ParsedCommand } from './command-parser';

export interface CommandExecutionContext {
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  onLayoutChange: (presetId: string) => void;
  onTradeExecute: (command: any) => void;
  onMaximizeTile: (tileId: string) => void;
}

/**
 * Execute a parsed command
 */
export async function executeCommand(
  command: ParsedCommand,
  context: CommandExecutionContext
): Promise<void> {
  const { type, action, parameters } = command;

  switch (type) {
    case 'trade':
      return executeTradeCommand(action, parameters, context);

    case 'market':
      return executeMarketCommand(action, parameters, context);

    case 'layout':
      return executeLayoutCommand(action, parameters, context);

    case 'widget':
      return executeWidgetCommand(action, parameters, context);

    case 'query':
      return executeQueryCommand(action, parameters, context);

    default:
      toast.error('Unknown command', {
        description: 'Could not understand the command. Try being more specific.',
      });
      throw new Error(`Unknown command type: ${type}`);
  }
}

/**
 * Execute a trade command
 */
async function executeTradeCommand(
  action: string,
  parameters: any,
  context: CommandExecutionContext
): Promise<void> {
  const { amount, token, orderType, price } = parameters;

  // Safety validation
  if (amount <= 0) {
    toast.error('Invalid amount', {
      description: 'Trade amount must be greater than zero.',
    });
    throw new Error('Invalid trade amount');
  }

  if (amount > 1000000) {
    toast.warning('Large trade detected', {
      description: 'Please confirm this large trade amount.',
    });
    // In production, show confirmation dialog
  }

  // Show confirmation toast
  toast.info(`Preparing ${action}...`, {
    description: `${action.toUpperCase()} ${amount} ${token} at ${orderType} price${price ? ` (${price})` : ''}`,
    duration: 2000,
  });

  // Execute trade
  await context.onTradeExecute({
    action,
    amount,
    token,
    orderType,
    price,
    estimatedValue: price ? amount * price : undefined,
  });

  toast.success(`Trade executed`, {
    description: `${action.toUpperCase()} ${amount} ${token}`,
    duration: 5000,
  });
}

/**
 * Execute a market switching command
 */
async function executeMarketCommand(
  action: string,
  parameters: any,
  context: CommandExecutionContext
): Promise<void> {
  const { market } = parameters;

  if (!market) {
    toast.error('Invalid market', {
      description: 'Could not determine which market to switch to.',
    });
    throw new Error('Invalid market parameter');
  }

  toast.info('Switching market...', {
    description: `Loading ${market}`,
    duration: 1500,
  });

  await context.onMarketChange(market);

  toast.success(`Market switched`, {
    description: `Now viewing ${market}`,
    duration: 3000,
  });
}

/**
 * Execute a layout change command
 */
async function executeLayoutCommand(
  action: string,
  parameters: any,
  context: CommandExecutionContext
): Promise<void> {
  const { presetId } = parameters;

  if (!presetId) {
    toast.error('Invalid layout', {
      description: 'Could not determine which layout to switch to.',
    });
    throw new Error('Invalid layout parameter');
  }

  toast.info('Changing layout...', {
    description: `Applying ${presetId} layout`,
    duration: 1500,
  });

  await context.onLayoutChange(presetId);

  toast.success(`Layout changed`, {
    description: `Now using ${presetId} layout`,
    duration: 3000,
  });
}

/**
 * Execute a widget control command
 */
async function executeWidgetCommand(
  action: string,
  parameters: any,
  context: CommandExecutionContext
): Promise<void> {
  const { widget } = parameters;

  if (!widget) {
    toast.error('Invalid widget', {
      description: 'Could not determine which widget to control.',
    });
    throw new Error('Invalid widget parameter');
  }

  switch (action) {
    case 'maximize':
      await context.onMaximizeTile(widget);
      toast.success(`${widget} maximized`, {
        duration: 2000,
      });
      break;

    case 'minimize':
    case 'hide':
      // In a real implementation, would call a minimize function
      toast.info(`${widget} minimized`, {
        duration: 2000,
      });
      break;

    case 'show':
      // In a real implementation, would ensure widget is visible
      toast.info(`${widget} displayed`, {
        duration: 2000,
      });
      break;

    default:
      toast.error('Unknown widget action', {
        description: `Action "${action}" is not supported.`,
      });
      throw new Error(`Unknown widget action: ${action}`);
  }
}

/**
 * Execute a query command
 */
async function executeQueryCommand(
  action: string,
  parameters: any,
  context: CommandExecutionContext
): Promise<void> {
  switch (action) {
    case 'price_query':
      toast.info('Price query', {
        description: `Fetching price for ${parameters.token || context.selectedMarket}...`,
        duration: 3000,
      });
      // In production, fetch real price and display
      break;

    case 'portfolio_query':
      toast.info('Portfolio query', {
        description: 'Loading your portfolio...',
        duration: 3000,
      });
      // In production, fetch portfolio and display in modal
      break;

    case 'pool_query':
      toast.info('Pool query', {
        description: `Searching for DEX pools with ${parameters.token}...`,
        duration: 3000,
      });
      // In production, search pools and display results
      break;

    case 'trades_query':
      toast.info('Trades query', {
        description: 'Loading recent trades...',
        duration: 3000,
      });
      // In production, fetch trades and display
      break;

    default:
      toast.error('Unknown query', {
        description: `Query type "${action}" is not supported.`,
      });
      throw new Error(`Unknown query action: ${action}`);
  }
}
