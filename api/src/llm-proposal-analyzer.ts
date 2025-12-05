#!/usr/bin/env bun
/**
 * LLM-Powered Proposal Analyzer
 *
 * Replaces naive keyword matching with actual LLM analysis.
 * Uses Claude/OpenAI to understand proposal intent, predict impact,
 * and generate actionable recommendations.
 *
 * Features:
 * - Structured output parsing
 * - Confidence calibration
 * - Historical context injection
 * - Fallback to keyword analysis
 * - Rate limiting and caching
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type MetricType = 'tvl' | 'volume' | 'fees' | 'users' | 'token_price' | 'apy';

export interface ProposalContext {
  title: string;
  description: string;
  type: 'funding' | 'parameter' | 'signal' | 'gauge' | 'emergency';
  requestedAmount?: number;
  currentMetrics: {
    tvl: number;
    volume24h: number;
    fees24h: number;
    activeUsers: number;
    tokenPrice: number;
    avgApy: number;
  };
  historicalContext?: string;
  similarProposals?: Array<{
    title: string;
    outcome: 'passed' | 'failed';
    actualImpact: Record<MetricType, number>;
  }>;
}

export interface LLMAnalysisResult {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impactPredictions: Record<MetricType, {
    change: number;        // Predicted % change
    confidence: number;    // 0-1
    reasoning: string;
  }>;
  risks: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation?: string;
  }>;
  opportunities: string[];
  recommendation: 'support' | 'oppose' | 'abstain';
  recommendationReasoning: string;
  overallConfidence: number;
  suggestedQuestions: string[];  // Questions to ask proposer
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'together';
  model: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retries: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307',
  maxTokens: 2000,
  temperature: 0.3,  // Low temperature for consistent analysis
  timeout: 30000,
  retries: 2,
  cacheEnabled: true,
  cacheTTL: 3600000,  // 1 hour cache
};

// ============================================================================
// Prompt Templates
// ============================================================================

const ANALYSIS_SYSTEM_PROMPT = `You are a DeFi governance analyst AI. Your job is to analyze governance proposals and predict their impact on protocol health metrics.

You must provide structured analysis in JSON format. Be honest about uncertainty - if you can't predict something, say so with low confidence.

Key metrics to analyze:
- TVL (Total Value Locked): Liquidity in the protocol
- Volume: Trading/transaction volume
- Fees: Protocol revenue
- Users: Active user count
- Token Price: Native token value
- APY: Average yield for liquidity providers

Consider:
1. Direct effects (what the proposal explicitly does)
2. Second-order effects (behavioral changes it might cause)
3. Risks (what could go wrong)
4. Historical precedent (similar proposals in DeFi)`;

const ANALYSIS_USER_PROMPT = (context: ProposalContext) => `
Analyze this governance proposal:

**Title:** ${context.title}

**Description:** ${context.description}

**Type:** ${context.type}
${context.requestedAmount ? `**Requested Amount:** ${context.requestedAmount.toLocaleString()} tokens` : ''}

**Current Protocol Metrics:**
- TVL: $${context.currentMetrics.tvl.toLocaleString()}
- 24h Volume: $${context.currentMetrics.volume24h.toLocaleString()}
- 24h Fees: $${context.currentMetrics.fees24h.toLocaleString()}
- Active Users: ${context.currentMetrics.activeUsers.toLocaleString()}
- Token Price: $${context.currentMetrics.tokenPrice.toFixed(4)}
- Average APY: ${(context.currentMetrics.avgApy * 100).toFixed(2)}%

${context.historicalContext ? `**Historical Context:** ${context.historicalContext}` : ''}

${context.similarProposals?.length ? `
**Similar Past Proposals:**
${context.similarProposals.map(p => `- "${p.title}" (${p.outcome}): TVL ${p.actualImpact.tvl > 0 ? '+' : ''}${p.actualImpact.tvl}%, Volume ${p.actualImpact.volume > 0 ? '+' : ''}${p.actualImpact.volume}%`).join('\n')}
` : ''}

Respond with a JSON object containing your analysis. The JSON must have this exact structure:
{
  "summary": "1-2 sentence summary of the proposal",
  "sentiment": "positive" | "negative" | "neutral",
  "impactPredictions": {
    "tvl": { "change": <number>, "confidence": <0-1>, "reasoning": "<string>" },
    "volume": { "change": <number>, "confidence": <0-1>, "reasoning": "<string>" },
    "fees": { "change": <number>, "confidence": <0-1>, "reasoning": "<string>" },
    "users": { "change": <number>, "confidence": <0-1>, "reasoning": "<string>" },
    "token_price": { "change": <number>, "confidence": <0-1>, "reasoning": "<string>" },
    "apy": { "change": <number>, "confidence": <0-1>, "reasoning": "<string>" }
  },
  "risks": [{ "description": "<string>", "severity": "low"|"medium"|"high", "mitigation": "<string>" }],
  "opportunities": ["<string>"],
  "recommendation": "support" | "oppose" | "abstain",
  "recommendationReasoning": "<string>",
  "overallConfidence": <0-1>,
  "suggestedQuestions": ["<string>"]
}`;

// ============================================================================
// LLM Clients
// ============================================================================

interface LLMClient {
  analyze(systemPrompt: string, userPrompt: string): Promise<string>;
}

class AnthropicClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}

class OpenAIClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4-turbo-preview',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

class TogetherClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.config.apiKey || process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error('TOGETHER_API_KEY not configured');
    }

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// ============================================================================
// Fallback Keyword Analyzer
// ============================================================================

function keywordFallbackAnalysis(context: ProposalContext): LLMAnalysisResult {
  const text = `${context.title} ${context.description}`.toLowerCase();

  const impactPredictions: Record<MetricType, { change: number; confidence: number; reasoning: string }> = {
    tvl: { change: 0, confidence: 0.3, reasoning: 'Keyword-based estimate' },
    volume: { change: 0, confidence: 0.3, reasoning: 'Keyword-based estimate' },
    fees: { change: 0, confidence: 0.3, reasoning: 'Keyword-based estimate' },
    users: { change: 0, confidence: 0.3, reasoning: 'Keyword-based estimate' },
    token_price: { change: 0, confidence: 0.3, reasoning: 'Keyword-based estimate' },
    apy: { change: 0, confidence: 0.3, reasoning: 'Keyword-based estimate' },
  };

  // TVL keywords
  if (text.includes('liquidity') || text.includes('pool')) {
    impactPredictions.tvl.change = text.includes('add') || text.includes('increase') ? 5 : -3;
  }
  if (text.includes('reward') || text.includes('incentive')) {
    impactPredictions.tvl.change += 3;
  }

  // Volume keywords
  if (text.includes('trading') || text.includes('swap')) {
    impactPredictions.volume.change = 5;
  }

  // User keywords
  if (text.includes('user') || text.includes('community') || text.includes('growth')) {
    impactPredictions.users.change = 3;
  }

  // Token price keywords
  if (text.includes('burn') || text.includes('buyback')) {
    impactPredictions.token_price.change = 5;
  }
  if (text.includes('emission') || text.includes('mint')) {
    impactPredictions.token_price.change = -3;
  }

  const totalChange = Object.values(impactPredictions).reduce((sum, p) => sum + p.change, 0);

  return {
    summary: `Keyword analysis of: ${context.title}`,
    sentiment: totalChange > 0 ? 'positive' : totalChange < 0 ? 'negative' : 'neutral',
    impactPredictions,
    risks: [{ description: 'Analysis based on keywords only - low accuracy', severity: 'medium' }],
    opportunities: [],
    recommendation: totalChange > 5 ? 'support' : totalChange < -5 ? 'oppose' : 'abstain',
    recommendationReasoning: 'Based on keyword matching (LLM fallback)',
    overallConfidence: 0.3,
    suggestedQuestions: ['What are the expected outcomes?', 'What metrics will you track?'],
  };
}

// ============================================================================
// LLM Proposal Analyzer
// ============================================================================

export class LLMProposalAnalyzer extends EventEmitter {
  private config: LLMConfig;
  private client: LLMClient;
  private cache = new Map<string, { result: LLMAnalysisResult; timestamp: number }>();
  private requestCount = 0;
  private errorCount = 0;

  constructor(config: Partial<LLMConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = this.createClient();
  }

  private createClient(): LLMClient {
    switch (this.config.provider) {
      case 'anthropic':
        return new AnthropicClient(this.config);
      case 'openai':
        return new OpenAIClient(this.config);
      case 'together':
        return new TogetherClient(this.config);
      default:
        return new AnthropicClient(this.config);
    }
  }

  /**
   * Analyze a proposal using LLM
   */
  async analyze(context: ProposalContext): Promise<LLMAnalysisResult> {
    const cacheKey = this.getCacheKey(context);

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.emit('cache_hit', { cacheKey });
        return cached.result;
      }
    }

    // Try LLM analysis with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        this.requestCount++;
        const startTime = Date.now();

        const response = await this.client.analyze(
          ANALYSIS_SYSTEM_PROMPT,
          ANALYSIS_USER_PROMPT(context)
        );

        const result = this.parseResponse(response);
        const duration = Date.now() - startTime;

        // Cache result
        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, { result, timestamp: Date.now() });
        }

        this.emit('analysis_complete', {
          proposalTitle: context.title,
          duration,
          recommendation: result.recommendation,
          confidence: result.overallConfidence,
        });

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.errorCount++;

        this.emit('analysis_error', {
          attempt,
          error: lastError.message,
          proposalTitle: context.title,
        });

        // Wait before retry (exponential backoff)
        if (attempt < this.config.retries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    // Fallback to keyword analysis
    this.emit('fallback_used', {
      reason: lastError?.message || 'Unknown error',
      proposalTitle: context.title,
    });

    return keywordFallbackAnalysis(context);
  }

  private getCacheKey(context: ProposalContext): string {
    return `${context.title}:${context.description.slice(0, 100)}:${context.type}`;
  }

  private parseResponse(response: string): LLMAnalysisResult {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in response
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return this.validateAndNormalize(parsed);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error}`);
    }
  }

  private validateAndNormalize(data: unknown): LLMAnalysisResult {
    const d = data as Record<string, unknown>;

    // Ensure all required fields exist with defaults
    const metrics: MetricType[] = ['tvl', 'volume', 'fees', 'users', 'token_price', 'apy'];
    const impactPredictions: Record<MetricType, { change: number; confidence: number; reasoning: string }> = {} as Record<MetricType, { change: number; confidence: number; reasoning: string }>;

    const rawImpact = (d.impactPredictions || {}) as Record<string, unknown>;
    for (const metric of metrics) {
      const raw = (rawImpact[metric] || {}) as Record<string, unknown>;
      impactPredictions[metric] = {
        change: typeof raw.change === 'number' ? raw.change : 0,
        confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5,
        reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : 'No reasoning provided',
      };
    }

    const rawRisks = Array.isArray(d.risks) ? d.risks : [];
    const risks = rawRisks.map((r: unknown) => {
      const risk = r as Record<string, unknown>;
      return {
        description: String(risk.description || 'Unknown risk'),
        severity: (['low', 'medium', 'high'].includes(String(risk.severity))
          ? String(risk.severity)
          : 'medium') as 'low' | 'medium' | 'high',
        mitigation: risk.mitigation ? String(risk.mitigation) : undefined,
      };
    });

    const rawOpportunities = Array.isArray(d.opportunities) ? d.opportunities : [];
    const opportunities = rawOpportunities.map((o: unknown) => String(o));

    const rawQuestions = Array.isArray(d.suggestedQuestions) ? d.suggestedQuestions : [];
    const suggestedQuestions = rawQuestions.map((q: unknown) => String(q));

    return {
      summary: String(d.summary || 'No summary provided'),
      sentiment: (['positive', 'negative', 'neutral'].includes(String(d.sentiment))
        ? String(d.sentiment)
        : 'neutral') as 'positive' | 'negative' | 'neutral',
      impactPredictions,
      risks,
      opportunities,
      recommendation: (['support', 'oppose', 'abstain'].includes(String(d.recommendation))
        ? String(d.recommendation)
        : 'abstain') as 'support' | 'oppose' | 'abstain',
      recommendationReasoning: String(d.recommendationReasoning || 'No reasoning provided'),
      overallConfidence: typeof d.overallConfidence === 'number'
        ? Math.min(1, Math.max(0, d.overallConfidence))
        : 0.5,
      suggestedQuestions,
    };
  }

  /**
   * Batch analyze multiple proposals
   */
  async analyzeBatch(contexts: ProposalContext[]): Promise<Map<string, LLMAnalysisResult>> {
    const results = new Map<string, LLMAnalysisResult>();

    // Analyze in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < contexts.length; i += concurrency) {
      const batch = contexts.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(ctx => this.analyze(ctx).then(r => ({ title: ctx.title, result: r })))
      );

      for (const { title, result } of batchResults) {
        results.set(title, result);
      }
    }

    return results;
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    requestCount: number;
    errorCount: number;
    cacheSize: number;
    errorRate: number;
    provider: string;
    model: string;
  } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      cacheSize: this.cache.size,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      provider: this.config.provider,
      model: this.config.model,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cache_cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    this.client = this.createClient();
    this.emit('config_updated', config);
  }
}

// ============================================================================
// Exports
// ============================================================================

let analyzerInstance: LLMProposalAnalyzer | null = null;

export function getLLMProposalAnalyzer(
  config?: Partial<LLMConfig>
): LLMProposalAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new LLMProposalAnalyzer(config);
  }
  return analyzerInstance;
}

export {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_PROMPT,
  keywordFallbackAnalysis,
};

export default {
  LLMProposalAnalyzer,
  getLLMProposalAnalyzer,
  DEFAULT_CONFIG,
};
