/**
 * Advanced NLP Conversational AI Engine for OpenSVM
 * 
 * Features:
 * - Natural language blockchain query processing
 * - Entity extraction (addresses, tokens, amounts, protocols)
 * - Intent classification and routing
 * - Context-aware conversation handling
 * - Intelligent response generation with visualizations
 * - Multi-turn conversation support
 */

import type { 
  NLPQuery, 
  NLPEntity, 
  NLPResponse, 
  VisualizationSpec, 
  RecommendedAction,
  TensorData
} from './types';

export interface ConversationContext {
  session_id: string;
  user_id?: string;
  conversation_history: ConversationTurn[];
  active_entities: Map<string, NLPEntity>;
  current_focus: string; // Current topic/wallet/token being discussed
  preferences: UserPreferences;
}

export interface ConversationTurn {
  timestamp: number;
  user_query: string;
  parsed_query: NLPQuery;
  ai_response: NLPResponse;
  context_updates: string[];
}

export interface UserPreferences {
  preferred_timeframes: string[];
  favorite_tokens: string[];
  risk_tolerance: 'low' | 'medium' | 'high';
  notification_preferences: string[];
  visualization_preferences: string[];
}

export interface QueryIntent {
  primary: string;
  secondary: string[];
  confidence: number;
  parameters: Record<string, any>;
}

export interface BlockchainEntity {
  type: 'wallet_address' | 'token_address' | 'transaction_hash' | 'block_number' | 'program_id';
  value: string;
  confidence: number;
  metadata: Record<string, any>;
}

/**
 * Entity Recognition Engine for Blockchain-specific entities
 */
class BlockchainEntityExtractor {
  private patterns: Map<string, RegExp>;
  private tokenRegistry: Map<string, string>; // symbol -> address
  private protocolRegistry: Map<string, string>; // name -> program_id

  constructor() {
    this.initializePatterns();
    this.initializeRegistries();
  }

  private initializePatterns() {
    this.patterns = new Map([
      // Solana addresses (base58, 32-44 chars)
      ['solana_address', /[1-9A-HJ-NP-Za-km-z]{32,44}/g],
      
      // Transaction signatures (base58, ~88 chars)
      ['transaction_hash', /[1-9A-HJ-NP-Za-km-z]{87,88}/g],
      
      // Numbers with crypto formatting
      ['crypto_amount', /\d+(?:\.\d+)?(?:\s*[kKmMbBtT])?(?:\s*(?:SOL|USDC|USDT|BTC|ETH|tokens?))?/gi],
      
      // Time expressions
      ['time_expression', /(?:last|past|previous)?\s*(?:\d+\s*)?(?:minute|hour|day|week|month|year)s?\s*(?:ago)?|today|yesterday|this\s+(?:week|month|year)/gi],
      
      // Percentages
      ['percentage', /\d+(?:\.\d+)?%/g],
      
      // Price expressions
      ['price', /\$\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|usd|dollars?)/gi]
    ]);
  }

  private initializeRegistries() {
    // Common token symbols to addresses
    this.tokenRegistry = new Map([
      ['SOL', 'So11111111111111111111111111111111111111112'],
      ['USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
      ['USDT', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'],
      ['mSOL', 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'],
      ['stSOL', '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj'],
      ['BONK', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'],
      ['WIF', 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm']
    ]);

    // Protocol names to program IDs
    this.protocolRegistry = new Map([
      ['jupiter', 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB'],
      ['raydium', '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'],
      ['orca', 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'],
      ['solend', 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'],
      ['mango', '4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg'],
      ['marinade', 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'],
      ['lido', 'CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi']
    ]);
  }

  extractEntities(text: string): NLPEntity[] {
    const entities: NLPEntity[] = [];

    // Extract blockchain addresses
    const addresses = Array.from(text.matchAll(this.patterns.get('solana_address')!));
    for (const match of addresses) {
      const value = match[0];
      const isTransactionHash = value.length >= 87;
      
      entities.push({
        type: isTransactionHash ? 'transaction_hash' : 'address',
        value,
        start: match.index!,
        end: match.index! + value.length,
        confidence: 0.95
      });
    }

    // Extract amounts
    const amounts = Array.from(text.matchAll(this.patterns.get('crypto_amount')!));
    for (const match of amounts) {
      entities.push({
        type: 'amount',
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        confidence: 0.9
      });
    }

    // Extract time expressions
    const times = Array.from(text.matchAll(this.patterns.get('time_expression')!));
    for (const match of times) {
      entities.push({
        type: 'time',
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        confidence: 0.8
      });
    }

    // Extract token symbols
    const lowerText = text.toLowerCase();
    for (const [symbol, address] of this.tokenRegistry) {
      const regex = new RegExp(`\\b${symbol.toLowerCase()}\\b`, 'gi');
      const matches = Array.from(lowerText.matchAll(regex));
      
      for (const match of matches) {
        entities.push({
          type: 'token',
          value: symbol,
          start: match.index!,
          end: match.index! + match[0].length,
          confidence: 0.85
        });
      }
    }

    // Extract protocol names
    for (const [protocol, programId] of this.protocolRegistry) {
      const regex = new RegExp(`\\b${protocol}\\b`, 'gi');
      const matches = Array.from(lowerText.matchAll(regex));
      
      for (const match of matches) {
        entities.push({
          type: 'protocol',
          value: protocol,
          start: match.index!,
          end: match.index! + match[0].length,
          confidence: 0.8
        });
      }
    }

    // Sort by position and remove overlaps
    return this.resolveEntityOverlaps(entities);
  }

  private resolveEntityOverlaps(entities: NLPEntity[]): NLPEntity[] {
    if (entities.length === 0) return entities;

    // Sort by start position
    entities.sort((a, b) => a.start - b.start);

    const resolved: NLPEntity[] = [];
    let lastEnd = -1;

    for (const entity of entities) {
      if (entity.start >= lastEnd) {
        resolved.push(entity);
        lastEnd = entity.end;
      } else {
        // Handle overlap - keep entity with higher confidence
        const lastEntity = resolved[resolved.length - 1];
        if (entity.confidence > lastEntity.confidence) {
          resolved[resolved.length - 1] = entity;
          lastEnd = entity.end;
        }
      }
    }

    return resolved;
  }

  resolveTokenAddress(symbol: string): string | null {
    return this.tokenRegistry.get(symbol.toUpperCase()) || null;
  }

  resolveProtocolId(name: string): string | null {
    return this.protocolRegistry.get(name.toLowerCase()) || null;
  }
}

/**
 * Intent Classification Engine
 */
class IntentClassifier {
  private intentPatterns: Map<string, {
    patterns: RegExp[];
    confidence_boost: number;
    required_entities: string[];
    optional_entities: string[];
  }>;

  constructor() {
    this.initializeIntentPatterns();
  }

  private initializeIntentPatterns() {
    this.intentPatterns = new Map([
      ['wallet_analysis', {
        patterns: [
          /analyze.*wallet/i,
          /wallet.*analysis/i,
          /show.*transactions.*wallet/i,
          /wallet.*activity/i,
          /check.*address/i
        ],
        confidence_boost: 0.9,
        required_entities: ['address'],
        optional_entities: ['time', 'amount']
      }],

      ['token_analysis', {
        patterns: [
          /analyze.*token/i,
          /token.*analysis/i,
          /price.*of/i,
          /how.*performing/i,
          /token.*metrics/i
        ],
        confidence_boost: 0.8,
        required_entities: ['token'],
        optional_entities: ['time', 'protocol']
      }],

      ['defi_transactions', {
        patterns: [
          /defi.*transactions/i,
          /show.*defi/i,
          /swap.*history/i,
          /liquidity.*provider/i,
          /yield.*farming/i
        ],
        confidence_boost: 0.85,
        required_entities: ['address', 'protocol'],
        optional_entities: ['token', 'time']
      }],

      ['mev_analysis', {
        patterns: [
          /mev.*opportunities/i,
          /arbitrage.*opportunities/i,
          /sandwich.*attacks/i,
          /front.*running/i,
          /mev.*bot/i
        ],
        confidence_boost: 0.9,
        required_entities: [],
        optional_entities: ['token', 'protocol', 'amount']
      }],

      ['portfolio_optimization', {
        patterns: [
          /optimize.*portfolio/i,
          /rebalance.*portfolio/i,
          /portfolio.*suggestions/i,
          /investment.*advice/i,
          /allocation.*recommendation/i
        ],
        confidence_boost: 0.85,
        required_entities: ['address'],
        optional_entities: ['amount', 'token']
      }],

      ['market_sentiment', {
        patterns: [
          /market.*sentiment/i,
          /how.*people.*feeling/i,
          /social.*sentiment/i,
          /bullish.*bearish/i,
          /market.*mood/i
        ],
        confidence_boost: 0.8,
        required_entities: ['token'],
        optional_entities: ['time']
      }],

      ['price_prediction', {
        patterns: [
          /predict.*price/i,
          /price.*forecast/i,
          /where.*price.*going/i,
          /future.*value/i,
          /price.*target/i
        ],
        confidence_boost: 0.85,
        required_entities: ['token'],
        optional_entities: ['time', 'amount']
      }],

      ['transaction_lookup', {
        patterns: [
          /show.*transaction/i,
          /lookup.*tx/i,
          /transaction.*details/i,
          /what.*happened.*transaction/i
        ],
        confidence_boost: 0.95,
        required_entities: ['transaction_hash'],
        optional_entities: []
      }],

      ['risk_analysis', {
        patterns: [
          /risk.*analysis/i,
          /how.*risky/i,
          /safety.*score/i,
          /compliance.*check/i,
          /security.*audit/i
        ],
        confidence_boost: 0.8,
        required_entities: ['address'],
        optional_entities: ['token', 'protocol']
      }],

      ['general_help', {
        patterns: [
          /help/i,
          /what.*can.*do/i,
          /how.*use/i,
          /commands/i,
          /features/i
        ],
        confidence_boost: 0.7,
        required_entities: [],
        optional_entities: []
      }]
    ]);
  }

  classifyIntent(query: string, entities: NLPEntity[]): QueryIntent {
    const entityTypes = new Set(entities.map(e => e.type));
    let bestMatch: { intent: string; confidence: number } = { intent: 'general_help', confidence: 0.1 };

    for (const [intent, config] of this.intentPatterns) {
      let confidence = 0;

      // Pattern matching
      for (const pattern of config.patterns) {
        if (pattern.test(query)) {
          confidence = Math.max(confidence, config.confidence_boost);
        }
      }

      // Entity requirements check
      const hasRequiredEntities = config.required_entities.every(req => 
        entityTypes.has(req as any)
      );

      if (!hasRequiredEntities && config.required_entities.length > 0) {
        confidence *= 0.5; // Penalize missing required entities
      }

      // Bonus for optional entities
      const optionalEntityCount = config.optional_entities.filter(opt => 
        entityTypes.has(opt as any)
      ).length;
      confidence += optionalEntityCount * 0.1;

      if (confidence > bestMatch.confidence) {
        bestMatch = { intent, confidence };
      }
    }

    // Extract parameters based on intent
    const parameters = this.extractParameters(bestMatch.intent, query, entities);

    return {
      primary: bestMatch.intent,
      secondary: this.getRelatedIntents(bestMatch.intent),
      confidence: bestMatch.confidence,
      parameters
    };
  }

  private extractParameters(intent: string, query: string, entities: NLPEntity[]): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract common parameters
    for (const entity of entities) {
      if (entity.type === 'address') {
        params.wallet_address = entity.value;
      } else if (entity.type === 'token') {
        params.token_symbol = entity.value;
      } else if (entity.type === 'amount') {
        params.amount = this.parseAmount(entity.value);
      } else if (entity.type === 'time') {
        params.timeframe = this.parseTimeframe(entity.value);
      } else if (entity.type === 'protocol') {
        params.protocol = entity.value;
      } else if (entity.type === 'transaction_hash') {
        params.transaction_hash = entity.value;
      }
    }

    // Intent-specific parameter extraction
    switch (intent) {
      case 'wallet_analysis':
        params.include_defi = /defi/i.test(query);
        params.include_nft = /nft/i.test(query);
        break;

      case 'mev_analysis':
        params.opportunity_type = this.extractMEVType(query);
        params.min_profit = this.extractMinProfit(query);
        break;

      case 'portfolio_optimization':
        params.risk_level = this.extractRiskLevel(query);
        params.objective = this.extractOptimizationObjective(query);
        break;

      case 'market_sentiment':
        params.sources = this.extractSentimentSources(query);
        break;
    }

    return params;
  }

  private getRelatedIntents(primary: string): string[] {
    const relations: Record<string, string[]> = {
      'wallet_analysis': ['defi_transactions', 'risk_analysis', 'portfolio_optimization'],
      'token_analysis': ['market_sentiment', 'price_prediction'],
      'defi_transactions': ['wallet_analysis', 'mev_analysis'],
      'mev_analysis': ['defi_transactions', 'risk_analysis'],
      'portfolio_optimization': ['wallet_analysis', 'risk_analysis'],
      'market_sentiment': ['token_analysis', 'price_prediction'],
      'price_prediction': ['token_analysis', 'market_sentiment'],
      'transaction_lookup': ['wallet_analysis', 'risk_analysis'],
      'risk_analysis': ['wallet_analysis', 'portfolio_optimization']
    };

    return relations[primary] || [];
  }

  private parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/[^\d.kKmMbBtT]/g, '');
    const number = parseFloat(cleaned.replace(/[kKmMbBtT]/g, ''));
    
    const multipliers: Record<string, number> = {
      'k': 1000, 'K': 1000,
      'm': 1000000, 'M': 1000000,
      'b': 1000000000, 'B': 1000000000,
      't': 1000000000000, 'T': 1000000000000
    };

    const suffix = amountStr.match(/[kKmMbBtT]/)?.[0];
    return suffix ? number * multipliers[suffix] : number;
  }

  private parseTimeframe(timeStr: string): string {
    const lower = timeStr.toLowerCase();
    
    if (lower.includes('minute')) return '1h';
    if (lower.includes('hour')) return '24h';
    if (lower.includes('day') || lower.includes('today') || lower.includes('yesterday')) return '7d';
    if (lower.includes('week')) return '30d';
    if (lower.includes('month')) return '90d';
    if (lower.includes('year')) return '1y';
    
    return '24h'; // Default
  }

  private extractMEVType(query: string): string[] {
    const types: string[] = [];
    const lower = query.toLowerCase();
    
    if (lower.includes('arbitrage')) types.push('arbitrage');
    if (lower.includes('sandwich')) types.push('sandwich');
    if (lower.includes('front') && lower.includes('run')) types.push('front_run');
    if (lower.includes('back') && lower.includes('run')) types.push('back_run');
    if (lower.includes('liquidation')) types.push('liquidation');
    
    return types.length > 0 ? types : ['all'];
  }

  private extractMinProfit(query: string): number {
    const amounts = query.match(/\$?\d+(?:\.\d+)?/g);
    return amounts ? parseFloat(amounts[0].replace('$', '')) : 10; // Default $10 min profit
  }

  private extractRiskLevel(query: string): 'low' | 'medium' | 'high' {
    const lower = query.toLowerCase();
    
    if (lower.includes('low risk') || lower.includes('conservative') || lower.includes('safe')) {
      return 'low';
    }
    if (lower.includes('high risk') || lower.includes('aggressive') || lower.includes('risky')) {
      return 'high';
    }
    return 'medium';
  }

  private extractOptimizationObjective(query: string): string {
    const lower = query.toLowerCase();
    
    if (lower.includes('maximize') && lower.includes('return')) return 'maximize_return';
    if (lower.includes('minimize') && lower.includes('risk')) return 'minimize_risk';
    if (lower.includes('sharpe')) return 'maximize_sharpe';
    if (lower.includes('yield') || lower.includes('income')) return 'maximize_yield';
    
    return 'maximize_sharpe'; // Default
  }

  private extractSentimentSources(query: string): string[] {
    const sources: string[] = [];
    const lower = query.toLowerCase();
    
    if (lower.includes('social') || lower.includes('twitter') || lower.includes('reddit')) {
      sources.push('social');
    }
    if (lower.includes('chain') || lower.includes('whale') || lower.includes('holder')) {
      sources.push('on_chain');
    }
    if (lower.includes('technical') || lower.includes('chart') || lower.includes('indicator')) {
      sources.push('technical');
    }
    if (lower.includes('news') || lower.includes('media') || lower.includes('article')) {
      sources.push('news');
    }
    
    return sources.length > 0 ? sources : ['social', 'on_chain', 'technical'];
  }
}

/**
 * Response Generation Engine
 */
class ResponseGenerator {
  generateResponse(
    query: NLPQuery,
    results: any,
    context: ConversationContext
  ): NLPResponse {
    const { intent } = query;

    switch (intent.primary) {
      case 'wallet_analysis':
        return this.generateWalletAnalysisResponse(results, context);
      
      case 'token_analysis':
        return this.generateTokenAnalysisResponse(results, context);
      
      case 'defi_transactions':
        return this.generateDeFiTransactionsResponse(results, context);
      
      case 'mev_analysis':
        return this.generateMEVAnalysisResponse(results, context);
      
      case 'portfolio_optimization':
        return this.generatePortfolioOptimizationResponse(results, context);
      
      case 'market_sentiment':
        return this.generateMarketSentimentResponse(results, context);
      
      case 'price_prediction':
        return this.generatePricePredictionResponse(results, context);
      
      case 'transaction_lookup':
        return this.generateTransactionLookupResponse(results, context);
      
      case 'risk_analysis':
        return this.generateRiskAnalysisResponse(results, context);
      
      case 'general_help':
        return this.generateHelpResponse(context);
      
      default:
        return this.generateDefaultResponse(query, context);
    }
  }

  private generateWalletAnalysisResponse(results: any, context: ConversationContext): NLPResponse {
    const { summary, transactions, risk_score } = results;
    
    const answer = `## Wallet Analysis Results

**Address**: ${summary.address}
**Total Balance**: $${summary.total_balance.toLocaleString()}
**Transaction Count**: ${summary.transaction_count}
**Risk Score**: ${risk_score}/100

### Key Findings:
• **Activity Level**: ${summary.activity_level}
• **Primary Activities**: ${summary.primary_activities.join(', ')}
• **Favorite Protocols**: ${summary.favorite_protocols.join(', ')}
• **Average Transaction Size**: $${summary.avg_transaction_size.toLocaleString()}

### Recent Activity:
${transactions.slice(0, 5).map((tx: any) => 
  `• ${tx.type} - ${tx.amount} ${tx.token} (${new Date(tx.timestamp).toLocaleDateString()})`
).join('\n')}

Would you like me to analyze any specific aspect in more detail?`;

    const visualizations: VisualizationSpec[] = [
      {
        type: 'chart',
        config: {
          type: 'line',
          title: 'Balance History',
          x_axis: 'Time',
          y_axis: 'Balance (USD)'
        },
        data: results.balance_history || []
      },
      {
        type: 'chart',
        config: {
          type: 'pie',
          title: 'Transaction Types',
        },
        data: results.transaction_breakdown || []
      }
    ];

    const actions: RecommendedAction[] = [
      {
        type: 'analysis',
        description: 'Analyze DeFi positions and yield opportunities',
        parameters: { address: summary.address, focus: 'defi' },
        confidence: 0.8,
        risk_level: 'low'
      }
    ];

    return {
      answer,
      confidence: 0.9,
      sources: ['on_chain_analysis', 'defi_protocol_data'],
      visualizations,
      actions
    };
  }

  private generateTokenAnalysisResponse(results: any, context: ConversationContext): NLPResponse {
    const { token_data, metrics, predictions } = results;
    
    const answer = `## ${token_data.symbol} Token Analysis

**Current Price**: $${token_data.price.toFixed(6)}
**24h Change**: ${token_data.change_24h > 0 ? '+' : ''}${token_data.change_24h.toFixed(2)}%
**Market Cap**: $${(token_data.market_cap / 1e6).toFixed(1)}M
**Volume (24h)**: $${(token_data.volume_24h / 1e6).toFixed(1)}M

### Technical Metrics:
• **RSI (14)**: ${metrics.rsi.toFixed(1)} ${this.getRSISignal(metrics.rsi)}
• **Volatility**: ${(metrics.volatility * 100).toFixed(1)}%
• **Liquidity Score**: ${metrics.liquidity_score}/10

### Price Prediction (7 days):
• **Predicted Price**: $${predictions.price_7d.toFixed(6)}
• **Confidence**: ${(predictions.confidence * 100).toFixed(1)}%
• **Support Level**: $${predictions.support.toFixed(6)}
• **Resistance Level**: $${predictions.resistance.toFixed(6)}

${this.generateTradingRecommendation(token_data, metrics, predictions)}`;

    const visualizations: VisualizationSpec[] = [
      {
        type: 'chart',
        config: {
          type: 'candlestick',
          title: `${token_data.symbol} Price Chart`,
          timeframe: '24h'
        },
        data: results.price_history || []
      }
    ];

    return {
      answer,
      confidence: 0.85,
      sources: ['price_data', 'technical_analysis', 'ml_predictions'],
      visualizations
    };
  }

  private generateMEVAnalysisResponse(results: any, context: ConversationContext): NLPResponse {
    const { opportunities, total_value, top_strategies } = results;
    
    const answer = `## MEV Opportunities Analysis

**Total Available Value**: $${total_value.toLocaleString()}
**Active Opportunities**: ${opportunities.length}

### Top Opportunities:
${opportunities.slice(0, 5).map((opp: any, i: number) => 
  `${i + 1}. **${opp.type}** - Profit: $${opp.profit.toFixed(2)} (${opp.tokens.join('/')}) - Confidence: ${(opp.confidence * 100).toFixed(0)}%`
).join('\n')}

### Strategy Breakdown:
${top_strategies.map((strategy: any) => 
  `• **${strategy.name}**: ${strategy.count} opportunities, avg profit $${strategy.avg_profit.toFixed(2)}`
).join('\n')}

⚠️ **Risk Warning**: MEV strategies require technical expertise and carry execution risks. Always test with small amounts first.`;

    const visualizations: VisualizationSpec[] = [
      {
        type: 'chart',
        config: {
          type: 'bar',
          title: 'MEV Opportunities by Type'
        },
        data: results.opportunity_breakdown || []
      }
    ];

    const actions: RecommendedAction[] = [
      {
        type: 'monitoring',
        description: 'Set up MEV opportunity alerts',
        parameters: { strategies: top_strategies.map((s: any) => s.name) },
        confidence: 0.9,
        risk_level: 'high'
      }
    ];

    return {
      answer,
      confidence: 0.8,
      sources: ['mev_detection', 'dex_analytics'],
      visualizations,
      actions
    };
  }

  private generateMarketSentimentResponse(results: any, context: ConversationContext): NLPResponse {
    const { sentiment, breakdown, trend, key_drivers } = results;
    
    const sentimentEmoji = sentiment.score > 0.5 ? '🚀' : 
                          sentiment.score > 0 ? '📈' : 
                          sentiment.score > -0.5 ? '😐' : '📉';
    
    const answer = `## Market Sentiment Analysis ${sentimentEmoji}

**Overall Sentiment**: ${this.getSentimentLabel(sentiment.score)} (${(sentiment.score * 100).toFixed(0)}/100)
**Confidence**: ${(sentiment.confidence * 100).toFixed(0)}%

### Sentiment Breakdown:
• **Social Media**: ${this.getSentimentLabel(breakdown.social)} (${(breakdown.social * 100).toFixed(0)})
• **On-Chain**: ${this.getSentimentLabel(breakdown.onChain)} (${(breakdown.onChain * 100).toFixed(0)})
• **Technical**: ${this.getSentimentLabel(breakdown.technical)} (${(breakdown.technical * 100).toFixed(0)})

### Key Drivers:
${key_drivers.map((driver: any) => 
  `• **${driver.type}**: ${driver.description} (Impact: ${(driver.impact * 100).toFixed(0)})`
).join('\n')}

### Trend: ${trend.direction === 'up' ? '📈' : trend.direction === 'down' ? '📉' : '➡️'} ${trend.description}`;

    return {
      answer,
      confidence: sentiment.confidence,
      sources: ['social_media', 'on_chain_data', 'technical_indicators'],
      visualizations: [
        {
          type: 'chart',
          config: {
            type: 'line',
            title: 'Sentiment Trend (7 days)'
          },
          data: results.sentiment_history || []
        }
      ]
    };
  }

  private generateHelpResponse(context: ConversationContext): NLPResponse {
    const answer = `# OpenSVM AI Assistant Help

I can help you with blockchain analysis and DeFi insights! Here are some things you can ask me:

## 🔍 **Wallet Analysis**
• "Analyze wallet [address]"
• "Show me DeFi transactions from this wallet"
• "What's the risk score for [address]?"

## 📊 **Token Analysis**
• "Analyze SOL token"
• "What's the sentiment for BONK?"
• "Predict USDC price for next week"

## 💰 **MEV & Trading**
• "Show MEV opportunities"
• "Find arbitrage opportunities for SOL/USDC"
• "Optimize my portfolio"

## 📈 **Market Insights**
• "What's the market sentiment for Solana?"
• "Show me trending tokens"
• "Analyze recent whale activity"

## 🔒 **Risk & Compliance**
• "Check compliance score for [address]"
• "Is this transaction risky?"
• "Audit this DeFi protocol"

Just ask me anything about blockchain data - I understand natural language and can work with wallet addresses, transaction hashes, token symbols, and more!`;

    return {
      answer,
      confidence: 1.0,
      sources: ['built_in_capabilities']
    };
  }

  private generateDefaultResponse(query: NLPQuery, context: ConversationContext): NLPResponse {
    return {
      answer: `I understand you're asking about "${query.text}", but I'm not quite sure how to help with that specific request. Could you try rephrasing your question or ask me for help to see what I can do?`,
      confidence: 0.3,
      sources: []
    };
  }

  // Helper methods for response generation
  private getRSISignal(rsi: number): string {
    if (rsi > 70) return '(Overbought ⚠️)';
    if (rsi < 30) return '(Oversold 💰)';
    return '(Neutral)';
  }

  private getSentimentLabel(score: number): string {
    if (score > 0.6) return 'Very Bullish';
    if (score > 0.2) return 'Bullish';
    if (score > -0.2) return 'Neutral';
    if (score > -0.6) return 'Bearish';
    return 'Very Bearish';
  }

  private generateTradingRecommendation(tokenData: any, metrics: any, predictions: any): string {
    if (predictions.confidence < 0.6) {
      return "\n⚠️ **Trading Recommendation**: Low confidence prediction - monitor closely before making decisions.";
    }

    const priceChange = (predictions.price_7d - tokenData.price) / tokenData.price;
    
    if (priceChange > 0.1) {
      return "\n📈 **Trading Recommendation**: Strong bullish signals detected. Consider accumulating on dips.";
    } else if (priceChange < -0.1) {
      return "\n📉 **Trading Recommendation**: Bearish signals present. Consider taking profits or waiting for better entry.";
    } else {
      return "\n➡️ **Trading Recommendation**: Sideways movement expected. Good for range trading strategies.";
    }
  }

  // Additional helper methods for other response types would go here...
  private generateDeFiTransactionsResponse(results: any, context: ConversationContext): NLPResponse {
    // Implementation for DeFi transactions response
    return { answer: "DeFi analysis complete", confidence: 0.8, sources: [] };
  }

  private generatePortfolioOptimizationResponse(results: any, context: ConversationContext): NLPResponse {
    // Implementation for portfolio optimization response
    return { answer: "Portfolio optimization complete", confidence: 0.8, sources: [] };
  }

  private generatePricePredictionResponse(results: any, context: ConversationContext): NLPResponse {
    // Implementation for price prediction response
    return { answer: "Price prediction complete", confidence: 0.8, sources: [] };
  }

  private generateTransactionLookupResponse(results: any, context: ConversationContext): NLPResponse {
    // Implementation for transaction lookup response
    return { answer: "Transaction lookup complete", confidence: 0.9, sources: [] };
  }

  private generateRiskAnalysisResponse(results: any, context: ConversationContext): NLPResponse {
    // Implementation for risk analysis response
    return { answer: "Risk analysis complete", confidence: 0.8, sources: [] };
  }
}

/**
 * Main NLP Conversational AI Engine
 */
export class NLPEngine {
  private entityExtractor: BlockchainEntityExtractor;
  private intentClassifier: IntentClassifier;
  private responseGenerator: ResponseGenerator;
  private conversationContexts: Map<string, ConversationContext> = new Map();

  constructor() {
    this.entityExtractor = new BlockchainEntityExtractor();
    this.intentClassifier = new IntentClassifier();
    this.responseGenerator = new ResponseGenerator();
  }

  /**
   * Process a natural language query
   */
  async processQuery(
    text: string,
    sessionId: string,
    userId?: string
  ): Promise<NLPResponse> {
    try {
      // Get or create conversation context
      const context = this.getOrCreateContext(sessionId, userId);
      
      // Extract entities
      const entities = this.entityExtractor.extractEntities(text);
      
      // Classify intent
      const intent = this.intentClassifier.classifyIntent(text, entities);
      
      // Create query object
      const query: NLPQuery = {
        text,
        intent: intent.primary,
        entities,
        confidence: intent.confidence,
        context: intent.parameters
      };

      // Update conversation context
      context.current_focus = this.updateCurrentFocus(query, context);
      
      // Execute the query (this would call appropriate analysis functions)
      const results = await this.executeQuery(query, context);
      
      // Generate response
      const response = this.responseGenerator.generateResponse(query, results, context);
      
      // Update conversation history
      context.conversation_history.push({
        timestamp: Date.now(),
        user_query: text,
        parsed_query: query,
        ai_response: response,
        context_updates: []
      });

      // Keep only last 10 conversation turns
      if (context.conversation_history.length > 10) {
        context.conversation_history = context.conversation_history.slice(-10);
      }

      return response;

    } catch (error) {
      console.error('Error processing NLP query:', error);
      return {
        answer: "I encountered an error processing your request. Please try rephrasing your question or ask for help.",
        confidence: 0.1,
        sources: []
      };
    }
  }

  /**
   * Get conversation context for a session
   */
  getConversationContext(sessionId: string): ConversationContext | null {
    return this.conversationContexts.get(sessionId) || null;
  }

  /**
   * Clear conversation context
   */
  clearConversationContext(sessionId: string): void {
    this.conversationContexts.delete(sessionId);
  }

  private getOrCreateContext(sessionId: string, userId?: string): ConversationContext {
    if (!this.conversationContexts.has(sessionId)) {
      this.conversationContexts.set(sessionId, {
        session_id: sessionId,
        user_id: userId,
        conversation_history: [],
        active_entities: new Map(),
        current_focus: '',
        preferences: {
          preferred_timeframes: ['24h', '7d'],
          favorite_tokens: [],
          risk_tolerance: 'medium',
          notification_preferences: [],
          visualization_preferences: ['charts', 'tables']
        }
      });
    }

    return this.conversationContexts.get(sessionId)!;
  }

  private updateCurrentFocus(query: NLPQuery, context: ConversationContext): string {
    // Update focus based on primary entity in query
    const addressEntity = query.entities.find(e => e.type === 'address');
    const tokenEntity = query.entities.find(e => e.type === 'token');
    const protocolEntity = query.entities.find(e => e.type === 'protocol');

    if (addressEntity) return addressEntity.value;
    if (tokenEntity) return tokenEntity.value;
    if (protocolEntity) return protocolEntity.value;

    return context.current_focus; // Keep existing focus
  }

  private async executeQuery(query: NLPQuery, context: ConversationContext): Promise<any> {
    // Mock query execution - in production, this would call the appropriate analysis engines
    // based on the query intent and parameters
    
    switch (query.intent) {
      case 'wallet_analysis':
        return this.mockWalletAnalysisResults(query.context);
      
      case 'token_analysis':
        return this.mockTokenAnalysisResults(query.context);
      
      case 'mev_analysis':
        return this.mockMEVAnalysisResults(query.context);
      
      case 'market_sentiment':
        return this.mockMarketSentimentResults(query.context);
      
      default:
        return {};
    }
  }

  // Mock result generators (would be replaced with real analysis calls)
  private mockWalletAnalysisResults(params: any): any {
    return {
      summary: {
        address: params.wallet_address || 'Demo Address',
        total_balance: 125430.50,
        transaction_count: 1247,
        activity_level: 'High',
        primary_activities: ['DeFi Trading', 'Yield Farming', 'Token Swaps'],
        favorite_protocols: ['Jupiter', 'Raydium', 'Orca'],
        avg_transaction_size: 2340.75
      },
      transactions: [
        { type: 'Swap', amount: '500', token: 'SOL', timestamp: Date.now() - 3600000 },
        { type: 'Add Liquidity', amount: '1000', token: 'USDC', timestamp: Date.now() - 7200000 }
      ],
      risk_score: 25
    };
  }

  private mockTokenAnalysisResults(params: any): any {
    return {
      token_data: {
        symbol: params.token_symbol || 'SOL',
        price: 98.45,
        change_24h: 3.2,
        market_cap: 45000000000,
        volume_24h: 2100000000
      },
      metrics: {
        rsi: 65.4,
        volatility: 0.45,
        liquidity_score: 8.5
      },
      predictions: {
        price_7d: 105.30,
        confidence: 0.78,
        support: 92.10,
        resistance: 108.70
      }
    };
  }

  private mockMEVAnalysisResults(params: any): any {
    return {
      opportunities: [
        { type: 'Arbitrage', profit: 245.30, tokens: ['SOL', 'USDC'], confidence: 0.89 },
        { type: 'Sandwich', profit: 89.50, tokens: ['BONK', 'SOL'], confidence: 0.76 }
      ],
      total_value: 15420.80,
      top_strategies: [
        { name: 'DEX Arbitrage', count: 23, avg_profit: 156.40 },
        { name: 'Liquidation', count: 8, avg_profit: 892.30 }
      ]
    };
  }

  private mockMarketSentimentResults(params: any): any {
    return {
      sentiment: { score: 0.68, confidence: 0.84 },
      breakdown: { social: 0.72, onChain: 0.61, technical: 0.71 },
      trend: { direction: 'up', description: 'Strengthening bullish momentum' },
      key_drivers: [
        { type: 'Social Volume', description: 'Increased Twitter mentions', impact: 0.3 },
        { type: 'Whale Activity', description: 'Large accumulation detected', impact: 0.4 }
      ]
    };
  }
}

// Export singleton instance
export const nlpEngine = new NLPEngine();

// Utility functions
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function isValidTransactionHash(hash: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(hash);
}

export function formatEntityForDisplay(entity: NLPEntity): string {
  switch (entity.type) {
    case 'address':
      return `${entity.value.slice(0, 4)}...${entity.value.slice(-4)}`;
    case 'amount':
      return entity.value;
    case 'token':
      return entity.value.toUpperCase();
    default:
      return entity.value;
  }
}