/**
 * Intent Analyzer - Level 2 Agentic Trading
 *
 * Goes beyond pattern matching to understand vague trading intent.
 * Uses LLM to extract meaning from conversational input.
 */

import Anthropic from '@anthropic-ai/sdk';

export type TradingIntent =
  | 'BUY'
  | 'SELL'
  | 'HOLD'
  | 'TAKE_PROFIT'
  | 'CUT_LOSS'
  | 'REBALANCE'
  | 'SEEK_ALPHA'
  | 'REDUCE_RISK'
  | 'MAXIMIZE_YIELD'
  | 'UNKNOWN';

export interface IntentAnalysis {
  intent: TradingIntent;
  asset?: string;
  confidence: number; // 0-1
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'uncertain';
  urgency: 'immediate' | 'flexible' | 'scheduled';
  clarificationNeeded: boolean;
  questions?: string[]; // Follow-up questions to ask user
  reasoning: string;
}

interface UserContext {
  portfolio: {
    assets: { symbol: string; amount: number; usdValue: number }[];
    totalValue: number;
  };
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  recentActivity: string[];
}

/**
 * Analyze vague user input to extract trading intent
 */
export async function analyzeIntent(
  userMessage: string,
  context: UserContext
): Promise<IntentAnalysis> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  const systemPrompt = `You are an expert trading intent analyzer. Your job is to understand what users REALLY want to do, even if they're vague.

User Portfolio:
${context.portfolio.assets.map(a => `- ${a.symbol}: ${a.amount} ($${a.usdValue})`).join('\n')}
Total Value: $${context.portfolio.totalValue}
Risk Profile: ${context.riskProfile}

Extract:
1. Primary intent (BUY, SELL, HOLD, TAKE_PROFIT, CUT_LOSS, REBALANCE, SEEK_ALPHA, REDUCE_RISK, MAXIMIZE_YIELD)
2. Asset (if mentioned)
3. Sentiment (bullish/bearish/neutral/uncertain)
4. Urgency (immediate/flexible/scheduled)
5. Whether clarification is needed
6. Follow-up questions (if clarification needed)

Examples:

Input: "I think SOL looks good"
Output: {
  "intent": "BUY",
  "asset": "SOL",
  "confidence": 0.7,
  "sentiment": "bullish",
  "urgency": "flexible",
  "clarificationNeeded": true,
  "questions": [
    "How much SOL do you want to buy?",
    "Do you want to buy now or wait for a dip?",
    "Any stop loss preference?"
  ],
  "reasoning": "User expressed positive sentiment about SOL but didn't specify amount or timing"
}

Input: "Take some profits on my ETH"
Output: {
  "intent": "TAKE_PROFIT",
  "asset": "ETH",
  "confidence": 0.85,
  "sentiment": "neutral",
  "urgency": "flexible",
  "clarificationNeeded": true,
  "questions": [
    "What percentage of your ETH would you like to sell? You hold $1,200 worth.",
    "Sell at market or set a limit order?"
  ],
  "reasoning": "User wants to realize gains on ETH but 'some' is ambiguous (20%? 50%?)"
}

Input: "I'm worried about a crash"
Output: {
  "intent": "REDUCE_RISK",
  "confidence": 0.9,
  "sentiment": "bearish",
  "urgency": "immediate",
  "clarificationNeeded": false,
  "questions": [
    "Should I convert risky assets to stablecoins?",
    "Or would you prefer to set stop losses?"
  ],
  "reasoning": "User expressing fear, likely wants to protect capital. Immediate action recommended."
}

Return JSON only, no markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze this trading message: "${userMessage}"`,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const analysis = JSON.parse(content.text) as IntentAnalysis;
    return analysis;
  } catch (error) {
    console.error('Intent analysis failed:', error);
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      sentiment: 'uncertain',
      urgency: 'flexible',
      clarificationNeeded: true,
      questions: ['Could you be more specific about what you want to do?'],
      reasoning: 'Failed to analyze intent',
    };
  }
}

/**
 * Generate clarifying questions based on incomplete intent
 */
export function generateClarifyingQuestions(analysis: IntentAnalysis): string[] {
  if (!analysis.clarificationNeeded) {
    return [];
  }

  // Return AI-generated questions if available
  if (analysis.questions && analysis.questions.length > 0) {
    return analysis.questions;
  }

  // Fallback: Template-based questions
  const questions: string[] = [];

  if (!analysis.asset) {
    questions.push('Which token are you interested in?');
  }

  if (analysis.intent === 'BUY') {
    questions.push('How much do you want to invest?');
    questions.push('Do you want to buy immediately or wait for a better price?');
  }

  if (analysis.intent === 'SELL') {
    questions.push('What percentage of your holdings do you want to sell?');
    questions.push('Sell at market price or set a limit?');
  }

  if (analysis.intent === 'REDUCE_RISK') {
    questions.push('Should I increase your stablecoin allocation?');
    questions.push('Or set stop losses on risky positions?');
  }

  return questions;
}

/**
 * Convert intent analysis into actionable trade proposal
 */
export interface TradeProposal {
  action: 'BUY' | 'SELL' | 'TRANSFER' | 'STAKE' | 'LEND';
  asset: string;
  amount: number; // Token amount
  usdValue: number;
  reasoning: string;
  risks: string[];
  expectedOutcome: string;
  confidence: number;
  requiresApproval: boolean;
}

export async function generateTradeProposal(
  analysis: IntentAnalysis,
  context: UserContext
): Promise<TradeProposal | null> {
  // If clarification needed, can't generate proposal yet
  if (analysis.clarificationNeeded) {
    return null;
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  const systemPrompt = `You are a trading strategy advisor. Based on user intent and portfolio, propose optimal trades.

Portfolio:
${context.portfolio.assets.map(a => `- ${a.symbol}: ${a.amount} ($${a.usdValue})`).join('\n')}
Total: $${context.portfolio.totalValue}
Risk Profile: ${context.riskProfile}

Rules:
1. Conservative users: Max 10% portfolio per trade
2. Moderate users: Max 20% portfolio per trade
3. Aggressive users: Max 30% portfolio per trade
4. Always maintain 20%+ stablecoin buffer
5. Suggest stop losses for risky trades

Return JSON with this structure:
{
  "action": "BUY" | "SELL" | "TRANSFER" | "STAKE" | "LEND",
  "asset": "SOL",
  "amount": 2.5,
  "usdValue": 500,
  "reasoning": "Why this trade makes sense",
  "risks": ["Risk 1", "Risk 2"],
  "expectedOutcome": "What could happen",
  "confidence": 0.75,
  "requiresApproval": true
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Generate trade proposal for intent: ${JSON.stringify(analysis)}`,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const proposal = JSON.parse(content.text) as TradeProposal;
    return proposal;
  } catch (error) {
    console.error('Trade proposal generation failed:', error);
    return null;
  }
}
