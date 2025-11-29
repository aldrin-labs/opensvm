/**
 * Natural Language Command Parser
 *
 * Parses natural language commands into structured command objects.
 * Uses pattern matching and intent classification to understand user input.
 */

export type CommandType = 'trade' | 'market' | 'layout' | 'widget' | 'query' | 'unknown';
export type TradeAction = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';

export interface ParsedCommand {
  type: CommandType;
  action: string;
  confidence: number;
  parameters?: Record<string, any>;
  originalInput: string;
}

// Trading patterns
const TRADE_PATTERNS = [
  // Buy patterns
  { pattern: /buy\s+(\d+\.?\d*)\s+(\w+)(?:\s+at\s+(market|limit))?(?:\s+(\d+\.?\d*))?/i, action: 'buy' },
  { pattern: /long\s+(\d+\.?\d*)\s+(\w+)(?:\s+at\s+(\d+\.?\d*))?/i, action: 'buy' },
  { pattern: /purchase\s+(\d+\.?\d*)\s+(\w+)/i, action: 'buy' },

  // Sell patterns
  { pattern: /sell\s+(\d+\.?\d*)\s+(\w+)(?:\s+at\s+(market|limit))?(?:\s+(\d+\.?\d*))?/i, action: 'sell' },
  { pattern: /short\s+(\d+\.?\d*)\s+(\w+)(?:\s+at\s+(\d+\.?\d*))?/i, action: 'sell' },
  { pattern: /dump\s+(\d+\.?\d*)\s+(\w+)/i, action: 'sell' },
];

// Market switching patterns
const MARKET_PATTERNS = [
  { pattern: /(?:show|display|switch to|go to|open)\s+(\w+)[\/\-](\w+)/i },
  { pattern: /(\w+)[\/\-](\w+)\s+(?:chart|pair|market)/i },
  { pattern: /show me\s+(\w+)/i },
  { pattern: /chart for\s+(\w+)/i },
];

// Layout patterns
const LAYOUT_PATTERNS = [
  { pattern: /(?:switch|change|set)\s+(?:to\s+)?(\w+)\s+layout/i },
  { pattern: /use\s+(\w+)\s+layout/i },
  { pattern: /layout\s+(\w+)/i },
];

// Widget control patterns
const WIDGET_PATTERNS = [
  { pattern: /(?:maximize|max|expand|fullscreen)\s+(chart|orderbook|trades|positions|aichat|depth|news|performance)/i, action: 'maximize' },
  { pattern: /(?:minimize|min|collapse|hide)\s+(chart|orderbook|trades|positions|aichat|depth|news|performance)/i, action: 'minimize' },
  { pattern: /(?:show|display|open)\s+(chart|orderbook|trades|positions|aichat|depth|news|performance)/i, action: 'show' },
  { pattern: /(?:close|hide)\s+(chart|orderbook|trades|positions|aichat|depth|news|performance)/i, action: 'hide' },
];

// Query patterns
const QUERY_PATTERNS = [
  { pattern: /(?:what's|what is|show me)\s+(?:the\s+)?price\s+(?:of\s+)?(\w+)/i, action: 'price_query' },
  { pattern: /(?:what's|what is|show)\s+(?:my\s+)?(?:portfolio|positions|balance)/i, action: 'portfolio_query' },
  { pattern: /(?:find|search|lookup)\s+(?:all\s+)?(?:dex\s+)?pools?\s+(?:for\s+)?(\w+)/i, action: 'pool_query' },
  { pattern: /(?:show|display)\s+(?:recent\s+)?trades?\s+(?:for\s+)?(\w+)?/i, action: 'trades_query' },
];

/**
 * Parse a natural language command into a structured command object
 */
export function parseNaturalLanguageCommand(input: string): ParsedCommand {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      type: 'unknown',
      action: 'empty',
      confidence: 0,
      originalInput: input,
    };
  }

  // Try to match trade commands
  for (const { pattern, action } of TRADE_PATTERNS) {
    const match = trimmedInput.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const token = match[2].toUpperCase();
      const orderTypeStr = match[3] || 'market';
      const price = match[4] ? parseFloat(match[4]) : undefined;

      // Validate token symbol (basic check)
      if (!/^[A-Z]{2,10}$/.test(token)) {
        continue;
      }

      return {
        type: 'trade',
        action,
        confidence: 0.95,
        parameters: {
          action: action as TradeAction,
          amount,
          token,
          orderType: orderTypeStr as OrderType,
          price,
        },
        originalInput: input,
      };
    }
  }

  // Try to match market switching commands
  for (const { pattern } of MARKET_PATTERNS) {
    const match = trimmedInput.match(pattern);
    if (match) {
      let baseToken: string;
      let quoteToken: string;

      if (match[2]) {
        // Has both base and quote (e.g., "SOL/USDC")
        baseToken = match[1].toUpperCase();
        quoteToken = match[2].toUpperCase();
      } else {
        // Only base token specified, assume /USDC
        baseToken = match[1].toUpperCase();
        quoteToken = 'USDC';
      }

      return {
        type: 'market',
        action: 'switch',
        confidence: 0.9,
        parameters: {
          market: `${baseToken}/${quoteToken}`,
          baseToken,
          quoteToken,
        },
        originalInput: input,
      };
    }
  }

  // Try to match layout commands
  for (const { pattern } of LAYOUT_PATTERNS) {
    const match = trimmedInput.match(pattern);
    if (match) {
      const layoutName = match[1].toLowerCase();

      // Map common aliases to preset IDs
      const layoutMap: Record<string, string> = {
        beginner: 'beginner',
        basic: 'beginner',
        simple: 'beginner',
        intermediate: 'intermediate',
        standard: 'intermediate',
        normal: 'intermediate',
        daytrader: 'dayTrader',
        'day trader': 'dayTrader',
        fast: 'dayTrader',
        scalper: 'scalper',
        scalping: 'scalper',
        quick: 'scalper',
        analyst: 'analyst',
        analysis: 'analyst',
        pro: 'analyst',
        maxchart: 'maxChart',
        'max chart': 'maxChart',
        chart: 'maxChart',
      };

      const presetId = layoutMap[layoutName] || layoutName;

      return {
        type: 'layout',
        action: 'change',
        confidence: 0.85,
        parameters: {
          presetId,
        },
        originalInput: input,
      };
    }
  }

  // Try to match widget control commands
  for (const { pattern, action } of WIDGET_PATTERNS) {
    const match = trimmedInput.match(pattern);
    if (match) {
      const widgetName = match[1].toLowerCase();

      return {
        type: 'widget',
        action,
        confidence: 0.9,
        parameters: {
          widget: widgetName,
        },
        originalInput: input,
      };
    }
  }

  // Try to match query commands
  for (const { pattern, action } of QUERY_PATTERNS) {
    const match = trimmedInput.match(pattern);
    if (match) {
      return {
        type: 'query',
        action,
        confidence: 0.8,
        parameters: {
          token: match[1]?.toUpperCase(),
        },
        originalInput: input,
      };
    }
  }

  // No match found
  return {
    type: 'unknown',
    action: 'unrecognized',
    confidence: 0,
    originalInput: input,
  };
}

/**
 * Get command suggestions based on partial input
 */
export function getCommandSuggestions(partialInput: string): string[] {
  const input = partialInput.toLowerCase().trim();

  if (!input) {
    return [
      'buy 10 SOL at market',
      'sell 5 BONK at limit 0.0001',
      'show me JUP/USDC',
      'switch to day trader layout',
      'maximize chart',
      'what is the price of SOL',
    ];
  }

  const suggestions: string[] = [];

  // Trading suggestions
  if (input.includes('buy') || input.includes('long') || input.includes('purchase')) {
    suggestions.push(
      'buy 10 SOL at market',
      'buy 100 BONK at limit 0.0001',
      'buy 5 JUP at market'
    );
  }

  if (input.includes('sell') || input.includes('short') || input.includes('dump')) {
    suggestions.push(
      'sell 10 SOL at market',
      'sell 100 BONK at limit 0.0001',
      'sell 5 JUP at market'
    );
  }

  // Market switching suggestions
  if (input.includes('show') || input.includes('switch') || input.includes('chart')) {
    suggestions.push(
      'show me SOL/USDC',
      'show me BONK/SOL',
      'switch to JUP/USDC',
      'chart for WIF'
    );
  }

  // Layout suggestions
  if (input.includes('layout')) {
    suggestions.push(
      'switch to beginner layout',
      'switch to day trader layout',
      'switch to analyst layout',
      'use scalper layout'
    );
  }

  // Widget control suggestions
  if (input.includes('maximize') || input.includes('expand') || input.includes('fullscreen')) {
    suggestions.push(
      'maximize chart',
      'maximize orderbook',
      'maximize positions'
    );
  }

  return suggestions.slice(0, 5);
}
