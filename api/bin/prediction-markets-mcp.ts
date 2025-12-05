#!/usr/bin/env bun
/**
 * Multi-Platform Prediction Markets MCP Server
 *
 * Exposes 25 tools for AI agents to:
 * - Trade across Kalshi, Polymarket, Manifold
 * - Manage paper trading portfolios
 * - Set alerts and run automated strategies
 * - Find arbitrage opportunities
 *
 * Usage:
 *   bun run bin/prediction-markets-mcp.ts
 *
 * Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "prediction-markets": {
 *       "command": "bun",
 *       "args": ["run", "/path/to/opensvm/api/bin/prediction-markets-mcp.ts"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  PredictionMarketsTradingSystem,
  getTradingSystem,
  Platform,
  AlertType,
  Market,
} from '../src/mcp-prediction-markets.js';

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'prediction-markets-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// Get singleton trading system
const system = getTradingSystem();

// ============================================================================
// Tool Definitions (25 tools)
// ============================================================================

const TOOLS = [
  // ----------------------------------------------------------------------------
  // Paper Trading Tools
  // ----------------------------------------------------------------------------
  {
    name: 'paper_create_account',
    description: 'Create a paper trading account with virtual funds. Default $10,000 starting balance.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Unique account ID' },
        initial_balance: { type: 'number', description: 'Starting balance in USD (default: 10000)' },
      },
      required: ['account_id'],
    },
  },
  {
    name: 'paper_deposit',
    description: 'Deposit funds into a paper trading account',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
        amount: { type: 'number', description: 'Amount to deposit in USD' },
      },
      required: ['account_id', 'amount'],
    },
  },
  {
    name: 'paper_buy',
    description: 'Buy YES or NO contracts in a market (paper trading)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'], description: 'Trading platform' },
        market_id: { type: 'string', description: 'Market ticker/ID' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Side to buy' },
        quantity: { type: 'number', description: 'Number of contracts' },
        price: { type: 'number', description: 'Price per contract (0-1). If not provided, uses market price.' },
      },
      required: ['account_id', 'platform', 'market_id', 'side', 'quantity'],
    },
  },
  {
    name: 'paper_sell',
    description: 'Sell YES or NO contracts from your position (paper trading)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'], description: 'Trading platform' },
        market_id: { type: 'string', description: 'Market ticker/ID' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Side to sell' },
        quantity: { type: 'number', description: 'Number of contracts' },
        price: { type: 'number', description: 'Price per contract (0-1). If not provided, uses market price.' },
      },
      required: ['account_id', 'platform', 'market_id', 'side', 'quantity'],
    },
  },
  {
    name: 'paper_get_portfolio',
    description: 'Get portfolio value, positions, and PnL for a paper trading account',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
      },
      required: ['account_id'],
    },
  },
  {
    name: 'paper_get_positions',
    description: 'Get all open positions for a paper trading account',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
      },
      required: ['account_id'],
    },
  },
  {
    name: 'paper_get_trades',
    description: 'Get trade history for a paper trading account',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
        limit: { type: 'number', description: 'Max trades to return (default: 50)' },
      },
      required: ['account_id'],
    },
  },
  {
    name: 'paper_leaderboard',
    description: 'Get leaderboard of all paper trading accounts ranked by PnL',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ----------------------------------------------------------------------------
  // Market Data Tools
  // ----------------------------------------------------------------------------
  {
    name: 'markets_list',
    description: 'List prediction markets from one or more platforms',
    inputSchema: {
      type: 'object',
      properties: {
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'] },
          description: 'Platforms to fetch from (default: all)',
        },
        limit: { type: 'number', description: 'Max markets per platform (default: 50)' },
      },
    },
  },
  {
    name: 'markets_search',
    description: 'Search for markets by keyword across platforms',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'] },
          description: 'Platforms to search (default: all)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'markets_best_prices',
    description: 'Find best YES/NO prices across platforms for a market (arbitrage finder)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Market search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'markets_stats',
    description: 'Get aggregated statistics across all platforms',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ----------------------------------------------------------------------------
  // Alert Tools
  // ----------------------------------------------------------------------------
  {
    name: 'alert_create',
    description: 'Create a price or volume alert for a market',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'], description: 'Platform' },
        market_id: { type: 'string', description: 'Market ticker/ID' },
        type: {
          type: 'string',
          enum: ['price_above', 'price_below', 'volume_spike', 'spread_narrow'],
          description: 'Alert type',
        },
        threshold: { type: 'number', description: 'Threshold value (0-1 for prices, absolute for volume)' },
      },
      required: ['platform', 'market_id', 'type', 'threshold'],
    },
  },
  {
    name: 'alert_remove',
    description: 'Remove an alert by ID',
    inputSchema: {
      type: 'object',
      properties: {
        alert_id: { type: 'string', description: 'Alert ID' },
      },
      required: ['alert_id'],
    },
  },
  {
    name: 'alert_list_active',
    description: 'List all active (not yet triggered) alerts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'alert_list_triggered',
    description: 'List all triggered alerts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'alert_check',
    description: 'Manually check all alerts against current market prices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ----------------------------------------------------------------------------
  // Strategy Tools
  // ----------------------------------------------------------------------------
  {
    name: 'strategy_create_arbitrage',
    description: 'Create a cross-platform arbitrage strategy',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Strategy name' },
        min_spread: { type: 'number', description: 'Minimum price spread to trade (e.g., 0.05 = 5%)' },
        max_position: { type: 'number', description: 'Maximum USD per position' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'] },
          description: 'Platforms to arbitrage across',
        },
      },
      required: ['name', 'min_spread', 'max_position', 'platforms'],
    },
  },
  {
    name: 'strategy_create_mean_reversion',
    description: 'Create a mean reversion strategy (buy when price deviates from 50%)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Strategy name' },
        threshold: { type: 'number', description: 'Deviation threshold (e.g., 0.3 = trade when < 20% or > 80%)' },
        position_size: { type: 'number', description: 'USD per trade' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'] },
          description: 'Platforms to trade on',
        },
      },
      required: ['name', 'threshold', 'position_size', 'platforms'],
    },
  },
  {
    name: 'strategy_enable',
    description: 'Enable a strategy for automated trading',
    inputSchema: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', description: 'Strategy ID' },
      },
      required: ['strategy_id'],
    },
  },
  {
    name: 'strategy_disable',
    description: 'Disable a strategy',
    inputSchema: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', description: 'Strategy ID' },
      },
      required: ['strategy_id'],
    },
  },
  {
    name: 'strategy_run_arbitrage',
    description: 'Run arbitrage scan and optionally execute trades',
    inputSchema: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', description: 'Arbitrage strategy ID' },
        account_id: { type: 'string', description: 'Paper trading account for trades' },
      },
      required: ['strategy_id', 'account_id'],
    },
  },
  {
    name: 'strategy_run_mean_reversion',
    description: 'Run mean reversion scan and optionally execute trades',
    inputSchema: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', description: 'Mean reversion strategy ID' },
        account_id: { type: 'string', description: 'Paper trading account for trades' },
      },
      required: ['strategy_id', 'account_id'],
    },
  },
  {
    name: 'strategy_list',
    description: 'List all strategies and their performance',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'strategy_performance',
    description: 'Get performance summary for all strategies',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Prompts
// ============================================================================

const PROMPTS = [
  {
    name: 'find_arbitrage',
    description: 'Find and analyze arbitrage opportunities across prediction markets',
    arguments: [
      { name: 'category', description: 'Market category (e.g., politics, crypto, sports)', required: false },
    ],
  },
  {
    name: 'portfolio_analysis',
    description: 'Analyze a paper trading portfolio and suggest improvements',
    arguments: [
      { name: 'account_id', description: 'Paper trading account ID', required: true },
    ],
  },
  {
    name: 'market_research',
    description: 'Research a prediction market and provide trading recommendation',
    arguments: [
      { name: 'query', description: 'Market topic to research', required: true },
    ],
  },
];

// ============================================================================
// Tool Handler
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Paper Trading
      case 'paper_create_account': {
        const account = system.paper.createAccount(
          args.account_id as string,
          args.initial_balance as number | undefined
        );
        result = {
          success: true,
          account: {
            id: account.id,
            balance: account.balance,
            initialBalance: account.initialBalance,
            createdAt: new Date(account.createdAt).toISOString(),
          },
        };
        break;
      }

      case 'paper_deposit': {
        const newBalance = system.paper.deposit(args.account_id as string, args.amount as number);
        result = { success: true, newBalance };
        break;
      }

      case 'paper_buy':
      case 'paper_sell': {
        const action = name === 'paper_buy' ? 'buy' : 'sell';

        // Fetch current market data
        const markets = await system.aggregator.fetchAllMarkets({
          platforms: [args.platform as Platform],
          limit: 100,
        });

        const market = markets.find(m => m.id === args.market_id || m.ticker === args.market_id);
        if (!market) {
          throw new Error(`Market ${args.market_id} not found on ${args.platform}`);
        }

        const trade = system.paper.executeTrade(
          args.account_id as string,
          market,
          args.side as 'yes' | 'no',
          action,
          args.quantity as number,
          args.price as number | undefined
        );

        result = {
          success: true,
          trade: {
            id: trade.id,
            platform: trade.platform,
            marketId: trade.marketId,
            side: trade.side,
            action: trade.action,
            quantity: trade.quantity,
            price: trade.price,
            total: trade.total,
            fee: trade.fee,
            mode: trade.mode,
            timestamp: new Date(trade.timestamp).toISOString(),
          },
        };
        break;
      }

      case 'paper_get_portfolio': {
        const portfolio = system.paper.getPortfolioValue(args.account_id as string);
        result = {
          accountId: args.account_id,
          cash: portfolio.cash,
          positions: portfolio.positions,
          total: portfolio.total,
          pnl: portfolio.pnl,
          pnlPercent: portfolio.pnlPercent,
        };
        break;
      }

      case 'paper_get_positions': {
        const account = system.paper.getAccount(args.account_id as string);
        if (!account) throw new Error('Account not found');

        result = Array.from(account.positions.values()).map(p => ({
          id: p.id,
          platform: p.platform,
          marketId: p.marketId,
          side: p.side,
          quantity: p.quantity,
          avgPrice: p.avgPrice,
          currentPrice: p.currentPrice,
          unrealizedPnl: p.unrealizedPnl,
        }));
        break;
      }

      case 'paper_get_trades': {
        const account = system.paper.getAccount(args.account_id as string);
        if (!account) throw new Error('Account not found');

        const limit = (args.limit as number) || 50;
        result = account.trades.slice(-limit).reverse().map(t => ({
          id: t.id,
          platform: t.platform,
          marketId: t.marketId,
          side: t.side,
          action: t.action,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
          fee: t.fee,
          pnl: t.pnl,
          timestamp: new Date(t.timestamp).toISOString(),
        }));
        break;
      }

      case 'paper_leaderboard': {
        result = system.paper.getLeaderboard();
        break;
      }

      // Market Data
      case 'markets_list': {
        const markets = await system.aggregator.fetchAllMarkets({
          platforms: args.platforms as Platform[] | undefined,
          limit: args.limit as number | undefined,
        });
        result = markets.map(m => ({
          id: m.id,
          platform: m.platform,
          ticker: m.ticker,
          title: m.title,
          yesPrice: m.yesPrice,
          noPrice: m.noPrice,
          volume24h: m.volume24h,
          liquidity: m.liquidity,
          resolved: m.resolved,
        }));
        break;
      }

      case 'markets_search': {
        const markets = await system.aggregator.searchMarkets(
          args.query as string,
          args.platforms as Platform[] | undefined
        );
        result = markets.map(m => ({
          id: m.id,
          platform: m.platform,
          title: m.title,
          yesPrice: m.yesPrice,
          noPrice: m.noPrice,
          volume24h: m.volume24h,
        }));
        break;
      }

      case 'markets_best_prices': {
        result = await system.aggregator.getBestPrices(args.query as string);
        break;
      }

      case 'markets_stats': {
        result = await system.aggregator.getStats();
        break;
      }

      // Alerts
      case 'alert_create': {
        const alert = system.alerts.createAlert(
          args.platform as Platform,
          args.market_id as string,
          args.type as AlertType,
          args.threshold as number
        );
        result = {
          success: true,
          alert: {
            id: alert.id,
            platform: alert.platform,
            marketId: alert.marketId,
            type: alert.type,
            threshold: alert.threshold,
            createdAt: new Date(alert.createdAt).toISOString(),
          },
        };
        break;
      }

      case 'alert_remove': {
        const removed = system.alerts.removeAlert(args.alert_id as string);
        result = { success: removed };
        break;
      }

      case 'alert_list_active': {
        result = system.alerts.getActiveAlerts().map(a => ({
          id: a.id,
          platform: a.platform,
          marketId: a.marketId,
          type: a.type,
          threshold: a.threshold,
          createdAt: new Date(a.createdAt).toISOString(),
        }));
        break;
      }

      case 'alert_list_triggered': {
        result = system.alerts.getTriggeredAlerts().map(a => ({
          id: a.id,
          platform: a.platform,
          marketId: a.marketId,
          type: a.type,
          threshold: a.threshold,
          triggeredAt: a.triggeredAt ? new Date(a.triggeredAt).toISOString() : null,
        }));
        break;
      }

      case 'alert_check': {
        const triggered = await system.alerts.checkAlerts();
        result = {
          checked: system.alerts.getActiveAlerts().length + triggered.length,
          triggered: triggered.map(a => ({
            id: a.id,
            platform: a.platform,
            marketId: a.marketId,
            type: a.type,
          })),
        };
        break;
      }

      // Strategies
      case 'strategy_create_arbitrage': {
        const strategy = system.strategies.createArbitrageStrategy(args.name as string, {
          minSpread: args.min_spread as number,
          maxPosition: args.max_position as number,
          platforms: args.platforms as Platform[],
        });
        result = {
          success: true,
          strategy: {
            id: strategy.id,
            name: strategy.name,
            type: strategy.type,
            enabled: strategy.enabled,
            platforms: strategy.platforms,
          },
        };
        break;
      }

      case 'strategy_create_mean_reversion': {
        const strategy = system.strategies.createMeanReversionStrategy(args.name as string, {
          threshold: args.threshold as number,
          positionSize: args.position_size as number,
          platforms: args.platforms as Platform[],
        });
        result = {
          success: true,
          strategy: {
            id: strategy.id,
            name: strategy.name,
            type: strategy.type,
            enabled: strategy.enabled,
            platforms: strategy.platforms,
          },
        };
        break;
      }

      case 'strategy_enable': {
        system.strategies.enableStrategy(args.strategy_id as string);
        result = { success: true, enabled: true };
        break;
      }

      case 'strategy_disable': {
        system.strategies.disableStrategy(args.strategy_id as string);
        result = { success: true, enabled: false };
        break;
      }

      case 'strategy_run_arbitrage': {
        const arbResult = await system.strategies.runArbitrage(
          args.strategy_id as string,
          args.account_id as string
        );
        result = {
          opportunities: arbResult.opportunities,
          tradesExecuted: arbResult.trades.length,
          trades: arbResult.trades.map(t => ({
            id: t.id,
            platform: t.platform,
            marketId: t.marketId,
            side: t.side,
            action: t.action,
            quantity: t.quantity,
            price: t.price,
          })),
        };
        break;
      }

      case 'strategy_run_mean_reversion': {
        const mrResult = await system.strategies.runMeanReversion(
          args.strategy_id as string,
          args.account_id as string
        );
        result = {
          signals: mrResult.signals.map(s => ({
            market: s.market.title,
            platform: s.market.platform,
            currentPrice: s.market.yesPrice,
            signal: s.signal,
            reason: s.reason,
          })),
          tradesExecuted: mrResult.trades.length,
          trades: mrResult.trades.map(t => ({
            id: t.id,
            platform: t.platform,
            marketId: t.marketId,
            side: t.side,
            quantity: t.quantity,
            price: t.price,
          })),
        };
        break;
      }

      case 'strategy_list': {
        result = system.strategies.getAllStrategies().map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          enabled: s.enabled,
          platforms: s.platforms,
          performance: s.performance,
        }));
        break;
      }

      case 'strategy_performance': {
        result = system.strategies.getPerformance();
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Prompts Handler
// ============================================================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'find_arbitrage':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Find arbitrage opportunities in prediction markets${args?.category ? ` related to "${args.category}"` : ''}.

Steps:
1. Use markets_list to get markets from all platforms
2. Use markets_best_prices to find price discrepancies
3. Identify markets where YES + NO prices across platforms total less than $1
4. Report opportunities with expected profit margins

Focus on markets with:
- High liquidity (easier to execute)
- Significant spread (> 5%)
- Clear resolution criteria`,
            },
          },
        ],
      };

    case 'portfolio_analysis':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze paper trading portfolio "${args?.account_id}".

Steps:
1. Use paper_get_portfolio to see overall performance
2. Use paper_get_positions to see open positions
3. Use paper_get_trades to review trade history
4. Compare performance to paper_leaderboard

Provide:
- Current portfolio value and PnL
- Risk assessment of open positions
- Suggestions for rebalancing
- Comparison to other traders`,
            },
          },
        ],
      };

    case 'market_research':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Research prediction markets about "${args?.query}".

Steps:
1. Use markets_search to find relevant markets
2. Use markets_best_prices to compare odds across platforms
3. Analyze price differences and liquidity

Provide:
- Summary of available markets
- Current probability assessments
- Platform comparison (which offers best prices)
- Trading recommendation (buy YES/NO, which platform)`,
            },
          },
        ],
      };

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ============================================================================
// Server Start
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Prediction Markets server started');
  console.error('[MCP] 25 tools available for multi-platform trading');
}

main().catch(console.error);
