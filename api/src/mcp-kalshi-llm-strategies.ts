#!/usr/bin/env bun
/**
 * LLM Strategy Generator for Kalshi Trading
 *
 * Uses Claude to analyze competition results and generate new trading strategies.
 * Features:
 * - Analyze historical competition data
 * - Generate novel strategy hypotheses
 * - Convert natural language strategies to executable code
 * - Evaluate and rank generated strategies
 * - Continuous learning from outcomes
 */

import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import type { Strategy, Signal } from './mcp-kalshi-agent.js';
import type { CompetitionResult, LeaderboardEntry } from './mcp-kalshi-competition.js';
import type { PerformanceMetrics } from './mcp-kalshi-paper-trading.js';
import type { AggregatedMarketData } from './mcp-kalshi-streaming.js';

// ============================================================================
// Types
// ============================================================================

export interface StrategyHypothesis {
  id: string;
  name: string;
  description: string;
  rationale: string;
  conditions: StrategyCondition[];
  actions: StrategyAction[];
  riskManagement: RiskRules;
  expectedEdge: number;
  confidence: number;
  generatedAt: number;
  sourceAnalysis?: string;
}

export interface StrategyCondition {
  type: 'price' | 'volume' | 'spread' | 'momentum' | 'volatility' | 'time' | 'custom';
  operator: '>' | '<' | '>=' | '<=' | '==' | 'between' | 'crosses';
  value: number | [number, number];
  timeframe?: string;
  description: string;
}

export interface StrategyAction {
  trigger: 'entry' | 'exit' | 'scale_in' | 'scale_out';
  side: 'yes' | 'no' | 'dynamic';
  sizeMethod: 'fixed' | 'percent_equity' | 'kelly' | 'signal_strength';
  sizeValue: number;
  priceMethod: 'market' | 'limit_best' | 'limit_mid' | 'limit_aggressive';
}

export interface RiskRules {
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  cooldownAfterLoss: number;
}

export interface AnalysisContext {
  competitionResults?: CompetitionResult[];
  marketConditions?: MarketConditionsSummary;
  performanceHistory?: PerformanceMetrics[];
  failedStrategies?: StrategyHypothesis[];
  successfulStrategies?: StrategyHypothesis[];
}

export interface MarketConditionsSummary {
  totalMarkets: number;
  avgSpread: number;
  avgVolume24h: number;
  volatility: number;
  trendingMarkets: string[];
  highLiquidityMarkets: string[];
  wideSpreadMarkets: string[];
}

export interface GeneratedStrategy extends Strategy {
  hypothesis: StrategyHypothesis;
  sourceCode: string;
  testResults?: {
    backtestPnl: number;
    sharpe: number;
    winRate: number;
    trades: number;
  };
}

// ============================================================================
// LLM Strategy Generator
// ============================================================================

export class LLMStrategyGenerator extends EventEmitter {
  private anthropic: Anthropic;
  private model: string;
  private generatedStrategies: Map<string, GeneratedStrategy> = new Map();
  private analysisHistory: string[] = [];
  private strategyCounter = 0;

  constructor(apiKey?: string, model: string = 'claude-sonnet-4-20250514') {
    super();
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = model;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analysis
  // ─────────────────────────────────────────────────────────────────────────

  async analyzeCompetitionResults(results: CompetitionResult[]): Promise<string> {
    const prompt = this.buildAnalysisPrompt(results);

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: `You are an expert quantitative trader analyzing prediction market competition results.
Your goal is to identify patterns, winning strategies, market inefficiencies, and opportunities.
Be specific about numbers, percentages, and actionable insights.
Focus on what separated winners from losers and what market conditions favored which strategies.`,
    });

    const analysis = response.content[0].type === 'text' ? response.content[0].text : '';
    this.analysisHistory.push(analysis);
    this.emit('analysis_complete', analysis);

    return analysis;
  }

  private buildAnalysisPrompt(results: CompetitionResult[]): string {
    const summaries = results.map(r => `
Competition: ${r.name}
Duration: ${Math.round(r.duration / 60000)} minutes
Winner: ${r.winner.name} (${r.winner.pnlPercent.toFixed(2)}% return, ${r.winner.sharpe.toFixed(2)} Sharpe)

Leaderboard:
${r.finalLeaderboard.map((e, i) =>
  `${i + 1}. ${e.name}: ${e.pnlPercent.toFixed(2)}% return, ${e.winRate.toFixed(1)}% win rate, ${e.trades} trades`
).join('\n')}

Market Activity:
${r.marketsSummary.map(m =>
  `- ${m.ticker}: ${m.totalVolume} volume, ${m.priceChange > 0 ? '+' : ''}${m.priceChange.toFixed(1)}c change`
).join('\n')}

Aggregate Stats:
- Total trades: ${r.statistics.totalTrades}
- Average return: ${r.statistics.avgReturn.toFixed(2)}%
- Best return: ${r.statistics.bestReturn.toFixed(2)}%
- Worst return: ${r.statistics.worstReturn.toFixed(2)}%
`).join('\n---\n');

    return `Analyze these prediction market trading competition results:

${summaries}

Please provide:
1. What patterns separated winning strategies from losing ones?
2. Which market conditions (volume, spread, volatility) correlated with profitable trades?
3. What strategy improvements would you suggest based on this data?
4. Are there any unexploited opportunities visible in the data?
5. What risk management practices differentiated top performers?`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Generation
  // ─────────────────────────────────────────────────────────────────────────

  async generateStrategy(context: AnalysisContext): Promise<StrategyHypothesis> {
    const prompt = this.buildGenerationPrompt(context);

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: `You are an expert quantitative strategy developer for prediction markets.
Generate novel, executable trading strategies based on the analysis provided.
Your strategies should be:
1. Specific and quantifiable (exact thresholds, not vague conditions)
2. Risk-aware with clear stop-losses and position limits
3. Based on observable market data (price, volume, spread, momentum)
4. Novel - not just copies of standard strategies
5. Explainable - clear rationale for why it should work

Output your strategy as JSON matching the StrategyHypothesis schema.`,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract strategy JSON from LLM response');
    }

    const hypothesis: StrategyHypothesis = JSON.parse(jsonMatch[0]);
    hypothesis.id = `LLM-${++this.strategyCounter}-${Date.now()}`;
    hypothesis.generatedAt = Date.now();

    this.emit('strategy_generated', hypothesis);
    return hypothesis;
  }

  private buildGenerationPrompt(context: AnalysisContext): string {
    let prompt = 'Generate a novel prediction market trading strategy.\n\n';

    if (context.competitionResults?.length) {
      prompt += `Recent competition analysis shows:\n`;
      const latest = context.competitionResults[context.competitionResults.length - 1];
      prompt += `- Winning strategy achieved ${latest.winner.pnlPercent.toFixed(2)}% return\n`;
      prompt += `- Average return was ${latest.statistics.avgReturn.toFixed(2)}%\n`;
      prompt += `- ${latest.statistics.totalTrades} total trades occurred\n\n`;
    }

    if (context.marketConditions) {
      prompt += `Current market conditions:\n`;
      prompt += `- Average spread: ${context.marketConditions.avgSpread.toFixed(1)} cents\n`;
      prompt += `- Average 24h volume: ${context.marketConditions.avgVolume24h.toFixed(0)} contracts\n`;
      prompt += `- High liquidity markets: ${context.marketConditions.highLiquidityMarkets.join(', ')}\n`;
      prompt += `- Wide spread opportunities: ${context.marketConditions.wideSpreadMarkets.join(', ')}\n\n`;
    }

    if (context.failedStrategies?.length) {
      prompt += `Strategies that didn't work (avoid similar approaches):\n`;
      context.failedStrategies.slice(-3).forEach(s => {
        prompt += `- ${s.name}: ${s.description}\n`;
      });
      prompt += '\n';
    }

    if (context.successfulStrategies?.length) {
      prompt += `Successful strategies to build upon:\n`;
      context.successfulStrategies.slice(-3).forEach(s => {
        prompt += `- ${s.name}: ${s.description} (${s.expectedEdge}% expected edge)\n`;
      });
      prompt += '\n';
    }

    prompt += `Generate a strategy that:
1. Has a clear, quantifiable edge
2. Works in current market conditions
3. Is different from failed approaches
4. Has specific entry/exit rules

Return as JSON with this schema:
{
  "name": "string",
  "description": "string",
  "rationale": "string explaining why this should work",
  "conditions": [
    {
      "type": "price|volume|spread|momentum|volatility",
      "operator": ">|<|>=|<=|==|between|crosses",
      "value": number or [min, max],
      "description": "human readable condition"
    }
  ],
  "actions": [
    {
      "trigger": "entry|exit|scale_in|scale_out",
      "side": "yes|no|dynamic",
      "sizeMethod": "fixed|percent_equity|kelly|signal_strength",
      "sizeValue": number,
      "priceMethod": "market|limit_best|limit_mid|limit_aggressive"
    }
  ],
  "riskManagement": {
    "maxPositionSize": number,
    "stopLossPercent": number,
    "takeProfitPercent": number,
    "maxDailyLoss": number,
    "maxDrawdown": number,
    "cooldownAfterLoss": number
  },
  "expectedEdge": number (percent),
  "confidence": number (0-100)
}`;

    return prompt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Compilation
  // ─────────────────────────────────────────────────────────────────────────

  compileStrategy(hypothesis: StrategyHypothesis): GeneratedStrategy {
    const analyzeFunction = this.generateAnalyzeFunction(hypothesis);

    const strategy: GeneratedStrategy = {
      name: hypothesis.name,
      description: hypothesis.description,
      analyze: analyzeFunction,
      hypothesis,
      sourceCode: this.generateSourceCode(hypothesis),
    };

    this.generatedStrategies.set(hypothesis.id, strategy);
    this.emit('strategy_compiled', strategy);

    return strategy;
  }

  private generateAnalyzeFunction(hypothesis: StrategyHypothesis): Strategy['analyze'] {
    return (market: AggregatedMarketData, positions: any[]): Signal | null => {
      // Check if we already have a position in this market
      const existingPosition = positions.find(p => p.ticker === market.ticker);

      // Evaluate all conditions
      const conditionResults = hypothesis.conditions.map(condition => {
        return this.evaluateCondition(condition, market);
      });

      // All conditions must be true for entry
      const allConditionsMet = conditionResults.every(r => r);

      if (!allConditionsMet) {
        return null;
      }

      // Don't enter if already positioned (unless scaling)
      if (existingPosition && !hypothesis.actions.some(a => a.trigger === 'scale_in')) {
        return null;
      }

      // Find entry action
      const entryAction = hypothesis.actions.find(a => a.trigger === 'entry');
      if (!entryAction) return null;

      // Determine side
      let side: 'yes' | 'no';
      if (entryAction.side === 'dynamic') {
        // Dynamic side based on market conditions
        side = market.orderbook.midPrice < 50 ? 'yes' : 'no';
      } else {
        side = entryAction.side;
      }

      // Calculate signal strength from conditions
      const strength = Math.min(100, hypothesis.confidence * (conditionResults.filter(r => r).length / conditionResults.length));

      return {
        type: 'buy',
        ticker: market.ticker,
        side,
        strength,
        confidence: hypothesis.confidence,
        reason: `${hypothesis.name}: ${hypothesis.rationale}`,
        expectedValue: hypothesis.expectedEdge / 100,
        riskReward: hypothesis.expectedEdge / hypothesis.riskManagement.stopLossPercent,
      };
    };
  }

  private evaluateCondition(condition: StrategyCondition, market: AggregatedMarketData): boolean {
    let value: number;

    switch (condition.type) {
      case 'price':
        value = market.orderbook.midPrice;
        break;
      case 'volume':
        value = market.volume1m;
        break;
      case 'spread':
        value = market.orderbook.spread;
        break;
      case 'momentum':
        value = market.priceChange1m;
        break;
      case 'volatility':
        // Approximate volatility from recent trades
        if (market.trades.length < 2) return false;
        const prices = market.trades.map(t => t.price);
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        value = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length);
        break;
      default:
        return false;
    }

    const threshold = condition.value;

    switch (condition.operator) {
      case '>':
        return value > (threshold as number);
      case '<':
        return value < (threshold as number);
      case '>=':
        return value >= (threshold as number);
      case '<=':
        return value <= (threshold as number);
      case '==':
        return Math.abs(value - (threshold as number)) < 0.01;
      case 'between':
        const [min, max] = threshold as [number, number];
        return value >= min && value <= max;
      case 'crosses':
        // Would need historical data to implement properly
        return false;
      default:
        return false;
    }
  }

  private generateSourceCode(hypothesis: StrategyHypothesis): string {
    return `// Generated Strategy: ${hypothesis.name}
// Generated at: ${new Date(hypothesis.generatedAt).toISOString()}
// Expected Edge: ${hypothesis.expectedEdge}%
// Confidence: ${hypothesis.confidence}%

/*
Rationale: ${hypothesis.rationale}

Conditions:
${hypothesis.conditions.map(c => `- ${c.description}`).join('\n')}

Actions:
${hypothesis.actions.map(a => `- ${a.trigger}: ${a.side} side, ${a.sizeMethod} sizing`).join('\n')}

Risk Management:
- Max Position: ${hypothesis.riskManagement.maxPositionSize} contracts
- Stop Loss: ${hypothesis.riskManagement.stopLossPercent}%
- Take Profit: ${hypothesis.riskManagement.takeProfitPercent}%
- Max Daily Loss: $${hypothesis.riskManagement.maxDailyLoss / 100}
- Max Drawdown: ${hypothesis.riskManagement.maxDrawdown}%
*/

export const ${hypothesis.name.replace(/[^a-zA-Z0-9]/g, '_')}: Strategy = {
  name: '${hypothesis.name}',
  description: '${hypothesis.description}',
  analyze: (market, positions) => {
    // Implementation generated from hypothesis
    ${this.generateConditionCode(hypothesis.conditions)}

    if (!allConditionsMet) return null;

    return {
      type: 'buy',
      ticker: market.ticker,
      side: '${hypothesis.actions[0]?.side || 'yes'}',
      strength: ${hypothesis.confidence},
      confidence: ${hypothesis.confidence},
      reason: '${hypothesis.name}',
      expectedValue: ${hypothesis.expectedEdge / 100},
      riskReward: ${hypothesis.expectedEdge / hypothesis.riskManagement.stopLossPercent},
    };
  },
};`;
  }

  private generateConditionCode(conditions: StrategyCondition[]): string {
    const checks = conditions.map((c, i) => {
      const varName = `condition${i}`;
      let getValue = '';

      switch (c.type) {
        case 'price': getValue = 'market.orderbook.midPrice'; break;
        case 'volume': getValue = 'market.volume1m'; break;
        case 'spread': getValue = 'market.orderbook.spread'; break;
        case 'momentum': getValue = 'market.priceChange1m'; break;
        default: getValue = '0';
      }

      let comparison = '';
      switch (c.operator) {
        case '>': comparison = `${getValue} > ${c.value}`; break;
        case '<': comparison = `${getValue} < ${c.value}`; break;
        case '>=': comparison = `${getValue} >= ${c.value}`; break;
        case '<=': comparison = `${getValue} <= ${c.value}`; break;
        case 'between':
          const [min, max] = c.value as [number, number];
          comparison = `${getValue} >= ${min} && ${getValue} <= ${max}`;
          break;
        default: comparison = 'false';
      }

      return `const ${varName} = ${comparison}; // ${c.description}`;
    });

    checks.push(`const allConditionsMet = ${conditions.map((_, i) => `condition${i}`).join(' && ')};`);
    return checks.join('\n    ');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Improvement
  // ─────────────────────────────────────────────────────────────────────────

  async improveStrategy(
    strategy: GeneratedStrategy,
    performanceData: PerformanceMetrics
  ): Promise<StrategyHypothesis> {
    const prompt = `Improve this trading strategy based on its performance:

Strategy: ${strategy.hypothesis.name}
Description: ${strategy.hypothesis.description}

Current Performance:
- Total Return: ${performanceData.totalReturnPercent.toFixed(2)}%
- Sharpe Ratio: ${performanceData.sharpeRatio.toFixed(2)}
- Win Rate: ${performanceData.winRate.toFixed(1)}%
- Max Drawdown: ${performanceData.maxDrawdownPercent.toFixed(1)}%
- Total Trades: ${performanceData.totalTrades}
- Avg Win: $${(performanceData.avgWin / 100).toFixed(2)}
- Avg Loss: $${(performanceData.avgLoss / 100).toFixed(2)}

Current Conditions:
${strategy.hypothesis.conditions.map(c => `- ${c.type} ${c.operator} ${c.value}: ${c.description}`).join('\n')}

Current Risk Management:
- Stop Loss: ${strategy.hypothesis.riskManagement.stopLossPercent}%
- Take Profit: ${strategy.hypothesis.riskManagement.takeProfitPercent}%

What specific improvements would make this strategy more profitable?
Consider:
1. Tightening or loosening conditions
2. Adjusting position sizing
3. Modifying stop loss / take profit levels
4. Adding new filters

Return an improved strategy as JSON with the same schema.`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a quantitative strategy optimizer. Suggest specific, data-driven improvements.',
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract improved strategy JSON');
    }

    const improved: StrategyHypothesis = JSON.parse(jsonMatch[0]);
    improved.id = `${strategy.hypothesis.id}-improved-${Date.now()}`;
    improved.generatedAt = Date.now();
    improved.sourceAnalysis = `Improved from ${strategy.hypothesis.name} based on ${performanceData.totalTrades} trades`;

    this.emit('strategy_improved', { original: strategy.hypothesis, improved });
    return improved;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────

  getGeneratedStrategies(): GeneratedStrategy[] {
    return Array.from(this.generatedStrategies.values());
  }

  getStrategy(id: string): GeneratedStrategy | undefined {
    return this.generatedStrategies.get(id);
  }

  getAnalysisHistory(): string[] {
    return this.analysisHistory;
  }
}

// ============================================================================
// MCP Tools
// ============================================================================

export const LLM_STRATEGY_TOOLS = [
  {
    name: 'llm_analyze_competition',
    description: 'Use Claude to analyze competition results and identify patterns',
    inputSchema: {
      type: 'object',
      properties: {
        competition_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Competition IDs to analyze',
        },
      },
    },
  },
  {
    name: 'llm_generate_strategy',
    description: 'Generate a new trading strategy using Claude',
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Additional context for strategy generation',
        },
        market_focus: {
          type: 'string',
          description: 'Specific market type to focus on (optional)',
        },
      },
    },
  },
  {
    name: 'llm_compile_strategy',
    description: 'Compile a strategy hypothesis into executable code',
    inputSchema: {
      type: 'object',
      properties: {
        hypothesis_id: { type: 'string', description: 'Strategy hypothesis ID' },
      },
      required: ['hypothesis_id'],
    },
  },
  {
    name: 'llm_improve_strategy',
    description: 'Use Claude to improve a strategy based on performance data',
    inputSchema: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', description: 'Strategy ID to improve' },
      },
      required: ['strategy_id'],
    },
  },
  {
    name: 'llm_list_strategies',
    description: 'List all LLM-generated strategies',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'llm_get_strategy_code',
    description: 'Get the generated source code for a strategy',
    inputSchema: {
      type: 'object',
      properties: {
        strategy_id: { type: 'string', description: 'Strategy ID' },
      },
      required: ['strategy_id'],
    },
  },
];

// ============================================================================
// Factory
// ============================================================================

export function createLLMStrategyGenerator(apiKey?: string): LLMStrategyGenerator {
  return new LLMStrategyGenerator(apiKey);
}
