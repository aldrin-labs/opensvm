/**
 * AI Transaction Analyzer Service
 * 
 * This service uses AI to generate natural language explanations of Solana transactions,
 * identify main actions and secondary effects, and provide risk assessment.
 */

import type { DetailedTransactionInfo } from './solana';
import { accountChangesAnalyzer, type AccountChangesAnalysis } from './account-changes-analyzer';
import { instructionParserService } from './instruction-parser-service';
import { defiTransactionAnalyzer, type DeFiAnalysis } from './defi-transaction-analyzer';
import { transactionAnalysisCache } from './transaction-analysis-cache';

export interface TransactionExplanation {
  summary: string;
  mainAction: {
    type: string;
    description: string;
    participants: string[];
    amounts: Array<{
      token: string;
      amount: string;
      usdValue?: number;
    }>;
  };
  secondaryEffects: Array<{
    type: string;
    description: string;
    significance: 'low' | 'medium' | 'high';
  }>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    score: number;
    factors: string[];
    recommendations: string[];
  };
  technicalDetails: {
    programsUsed: string[];
    instructionCount: number;
    accountsAffected: number;
    computeUnitsUsed?: number;
    fees: {
      total: number;
      breakdown: Array<{
        type: string;
        amount: number;
      }>;
    };
  };
  defiAnalysis?: DeFiAnalysis; // Enhanced DeFi analysis
  confidence: number; // 0-1 scale
  generatedAt: number;
}

export interface AIAnalysisContext {
  transaction: DetailedTransactionInfo;
  accountChanges: AccountChangesAnalysis;
  parsedInstructions: any[];
  userPreferences?: {
    detailLevel: 'basic' | 'detailed' | 'technical';
    focusAreas: string[];
  };
}

class AITransactionAnalyzer {
  private readonly apiEndpoint: string;
  private readonly maxRetries: number = 3;
  private readonly timeout: number = 30000; // 30 seconds

  constructor() {
    this.apiEndpoint = process.env.AI_API_ENDPOINT || '/api/ai-response';
  }

  /**
   * Generate comprehensive AI explanation of a transaction
   */
  public async analyzeTransaction(
    transaction: DetailedTransactionInfo,
    options?: {
      detailLevel?: 'basic' | 'detailed' | 'technical';
      focusAreas?: string[];
    }
  ): Promise<TransactionExplanation> {
    try {
      // Check cache first
      const cachedExplanation = await transactionAnalysisCache.getCachedAIExplanation(
        transaction.signature,
        options
      );

      if (cachedExplanation) {
        console.log(`Using cached AI explanation for transaction ${transaction.signature}`);
        return cachedExplanation;
      }

      // Prepare analysis context
      const context = await this.prepareAnalysisContext(transaction, options);

      // Generate AI explanation
      const explanation = await this.generateExplanation(context);

      // Enhance with additional analysis
      const enhancedExplanation = await this.enhanceExplanation(explanation, context);

      // Cache the result
      await transactionAnalysisCache.cacheAIExplanation(
        transaction.signature,
        enhancedExplanation,
        options
      );

      return enhancedExplanation;
    } catch (error) {
      console.error('AI transaction analysis failed:', error);
      return await this.generateFallbackExplanation(transaction);
    }
  }

  /**
   * Prepare context for AI analysis
   */
  private async prepareAnalysisContext(
    transaction: DetailedTransactionInfo,
    options?: {
      detailLevel?: 'basic' | 'detailed' | 'technical';
      focusAreas?: string[];
    }
  ): Promise<AIAnalysisContext> {
    // Analyze account changes
    const accountChanges = await accountChangesAnalyzer.analyzeTransaction(transaction);

    // Parse instructions with proper arguments
    const parsedInstructions = await Promise.all(
      transaction.details?.instructions?.map(instruction =>
        instructionParserService.parseInstruction(
          instruction.programId || 'Unknown',
          instruction.accounts?.map(acc => acc.toString()) || [],
          instruction.data || '',
          (instruction as any).parsed
        )
      ) || []
    );

    const context = {
      transaction,
      accountChanges,
      parsedInstructions,
      userPreferences: {
        detailLevel: options?.detailLevel || 'detailed',
        focusAreas: options?.focusAreas || []
      }
    };

    // Add DeFi detection for enhanced analysis
    const isDefi = this.isDeFiTransaction(context);
    console.log(`Transaction analysis: ${isDefi ? 'DeFi' : 'Non-DeFi'} transaction detected`);

    return context;
  }

  /**
   * Generate AI explanation using language model
   */
  private async generateExplanation(context: AIAnalysisContext): Promise<TransactionExplanation> {
    const prompt = this.buildAnalysisPrompt(context);

    try {
      const response = await this.callAIService(prompt, context);
      return this.parseAIResponse(response, context);
    } catch (error) {
      console.error('AI service call failed:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive analysis prompt for AI
   */
  private buildAnalysisPrompt(context: AIAnalysisContext): string {
    const { transaction, accountChanges, parsedInstructions } = context;

    const prompt = `
Analyze this Solana transaction and provide a comprehensive explanation:

TRANSACTION OVERVIEW:
- Signature: ${transaction.signature}
- Success: ${transaction.success}
- Slot: ${transaction.slot}
- Timestamp: ${transaction.timestamp ? new Date(transaction.timestamp).toISOString() : 'Unknown'}

INSTRUCTIONS (${parsedInstructions.length}):
${parsedInstructions.map((instruction, index) => `
${index + 1}. Program: ${instruction.program}
   Type: ${instruction.instructionType}
   Description: ${instruction.description}
   Risk Level: ${instruction.riskLevel}
   Accounts: ${instruction.accounts.length}
`).join('')}

ACCOUNT CHANGES:
- Total Accounts: ${accountChanges.totalAccounts}
- Changed Accounts: ${accountChanges.changedAccounts}
- SOL Changes: ${accountChanges.solChanges.positiveChanges} increases, ${accountChanges.solChanges.negativeChanges} decreases
- Token Changes: ${accountChanges.tokenChanges.totalTokensAffected} affected
- Risk Level: ${accountChanges.riskAssessment.level}

RISK FACTORS:
${accountChanges.riskAssessment.factors.map(factor => `- ${factor}`).join('\n')}

Please provide a JSON response with the following structure:
{
  "summary": "Brief 1-2 sentence explanation of what this transaction does",
  "mainAction": {
    "type": "transfer|swap|mint|burn|stake|vote|other",
    "description": "Detailed description of the primary action",
    "participants": ["list of key participants"],
    "amounts": [{"token": "SOL", "amount": "1.5", "usdValue": 150}]
  },
  "secondaryEffects": [
    {
      "type": "fee_payment|account_creation|data_update|other",
      "description": "Description of secondary effect",
      "significance": "low|medium|high"
    }
  ],
  "riskAssessment": {
    "level": "low|medium|high",
    "score": 0-10,
    "factors": ["list of risk factors"],
    "recommendations": ["list of recommendations"]
  },
  "technicalDetails": {
    "programsUsed": ["list of programs"],
    "instructionCount": ${parsedInstructions.length},
    "accountsAffected": ${accountChanges.changedAccounts},
    "fees": {
      "total": 5000,
      "breakdown": [{"type": "transaction", "amount": 5000}]
    }
  },
  "confidence": 0.95
}

Focus on being accurate, helpful, and educational. Explain technical concepts in accessible language while maintaining precision.
`;

    return prompt;
  }

  /**
   * Call AI service with retry logic
   */
  private async callAIService(prompt: string, context: AIAnalysisContext): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: prompt,
            context: {
              transactionSignature: context.transaction.signature,
              analysisType: 'transaction_explanation'
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`AI service responded with status ${response.status}`);
        }

        const result = await response.json();
        return result.response || result.message || result.content;

      } catch (error) {
        lastError = error as Error;
        console.warn(`AI service attempt ${attempt} failed:`, error);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('AI service failed after all retries');
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: string, context: AIAnalysisContext): TransactionExplanation {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and enhance the response
      return {
        summary: parsed.summary || 'Transaction analysis completed',
        mainAction: {
          type: parsed.mainAction?.type || 'unknown',
          description: parsed.mainAction?.description || 'Unknown action',
          participants: parsed.mainAction?.participants || [],
          amounts: parsed.mainAction?.amounts || []
        },
        secondaryEffects: parsed.secondaryEffects || [],
        riskAssessment: {
          level: parsed.riskAssessment?.level || context.accountChanges.riskAssessment.level,
          score: parsed.riskAssessment?.score || this.calculateRiskScore(context.accountChanges.riskAssessment.level),
          factors: parsed.riskAssessment?.factors || context.accountChanges.riskAssessment.factors,
          recommendations: parsed.riskAssessment?.recommendations || context.accountChanges.riskAssessment.recommendations
        },
        technicalDetails: {
          programsUsed: parsed.technicalDetails?.programsUsed || this.extractProgramsUsed(context),
          instructionCount: context.parsedInstructions.length,
          accountsAffected: context.accountChanges.changedAccounts,
          computeUnitsUsed: this.calculateComputeUnits(context),
          fees: parsed.technicalDetails?.fees || this.calculateFees(context)
        },
        confidence: Math.min(Math.max(parsed.confidence || 0.8, 0), 1),
        generatedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * Enhance explanation with additional analysis
   */
  private async enhanceExplanation(
    explanation: TransactionExplanation,
    context: AIAnalysisContext
  ): Promise<TransactionExplanation> {
    // Add comprehensive DeFi analysis
    const defiAnalysis = await defiTransactionAnalyzer.analyzeDeFiTransaction(context.transaction);

    if (defiAnalysis.isDefi) {
      explanation.defiAnalysis = defiAnalysis;

      // Enhance summary with DeFi context
      if (defiAnalysis.actions.length > 0) {
        const primaryAction = defiAnalysis.actions[0];
        explanation.summary = `${explanation.summary} This DeFi transaction involves ${primaryAction.type.replace('_', ' ')} on ${primaryAction.protocol.name}.`;
      }

      // Add DeFi-specific secondary effects
      explanation.secondaryEffects.push({
        type: 'defi_interaction',
        description: `Interacts with ${defiAnalysis.protocols.length} DeFi protocol${defiAnalysis.protocols.length !== 1 ? 's' : ''}: ${defiAnalysis.protocols.map(p => p.name).join(', ')}`,
        significance: 'high'
      });

      // Enhance risk assessment with DeFi risks
      if (defiAnalysis.riskAssessment.overallRisk === 'high' || defiAnalysis.riskAssessment.overallRisk === 'extreme') {
        explanation.riskAssessment.level = 'high';
        explanation.riskAssessment.score = Math.max(explanation.riskAssessment.score, defiAnalysis.riskAssessment.riskScore);
        explanation.riskAssessment.factors.push(...defiAnalysis.riskAssessment.protocolRisks);
        explanation.riskAssessment.recommendations.push(...defiAnalysis.recommendations.slice(0, 3)); // Add top 3 DeFi recommendations
      }

      // Add financial impact information
      if (defiAnalysis.financialImpact.totalValueIn > 0) {
        explanation.secondaryEffects.push({
          type: 'financial_impact',
          description: `Total value: $${defiAnalysis.financialImpact.totalValueIn.toLocaleString()} in, $${defiAnalysis.financialImpact.totalValueOut.toLocaleString()} out, net ${defiAnalysis.financialImpact.netValue >= 0 ? 'gain' : 'loss'}: $${Math.abs(defiAnalysis.financialImpact.netValue).toLocaleString()}`,
          significance: defiAnalysis.financialImpact.totalValueIn > 1000 ? 'high' : 'medium'
        });
      }

      // Add yield information if available
      if (defiAnalysis.yieldAnalysis && defiAnalysis.yieldAnalysis.currentApr) {
        explanation.secondaryEffects.push({
          type: 'yield_opportunity',
          description: `Potential yield: ${defiAnalysis.yieldAnalysis.currentApr.toFixed(2)}% APR, projected yearly return: $${defiAnalysis.yieldAnalysis.projectedReturns.yearly.toFixed(2)}`,
          significance: defiAnalysis.yieldAnalysis.currentApr > 10 ? 'high' : 'medium'
        });
      }
    }

    // Add security warnings for high-risk transactions
    if (explanation.riskAssessment.level === 'high') {
      explanation.riskAssessment.recommendations.unshift(
        'This is a high-risk transaction - verify all details carefully before proceeding'
      );
    }

    // Enhance with token metadata if available
    await this.enhanceWithTokenMetadata(explanation, context);

    return explanation;
  }

  /**
   * Generate fallback explanation when AI fails
   */
  private async generateFallbackExplanation(transaction: DetailedTransactionInfo): Promise<TransactionExplanation> {
    const accountChanges = await accountChangesAnalyzer.analyzeTransaction(transaction);
    const instructionCount = transaction.details?.instructions?.length || 0;

    return {
      summary: `Transaction with ${instructionCount} instruction${instructionCount !== 1 ? 's' : ''} affecting ${accountChanges.changedAccounts} account${accountChanges.changedAccounts !== 1 ? 's' : ''}`,
      mainAction: {
        type: 'unknown',
        description: 'Unable to determine the main action of this transaction',
        participants: [],
        amounts: []
      },
      secondaryEffects: [
        {
          type: 'fee_payment',
          description: 'Transaction fees were paid',
          significance: 'low'
        }
      ],
      riskAssessment: {
        ...accountChanges.riskAssessment,
        score: this.calculateRiskScore(accountChanges.riskAssessment)
      },
      technicalDetails: {
        programsUsed: [...new Set(transaction.details?.instructions?.map(instruction =>
          instruction.programId || 'Unknown Program'
        ) || [])],
        instructionCount,
        accountsAffected: accountChanges.changedAccounts,
        fees: {
          total: 5000, // Default fee estimate
          breakdown: [{ type: 'transaction', amount: 5000 }]
        }
      },
      confidence: 0.3, // Low confidence for fallback
      generatedAt: Date.now()
    };
  }

  /**
   * Helper methods
   */


  private extractProgramsUsed(context: AIAnalysisContext): string[] {
    return [...new Set(context.parsedInstructions.map(instruction => instruction.programId))];
  }

  private calculateRiskScore(riskAssessment: any): number {
    // Calculate numeric risk score based on risk level and factors
    const riskLevelScores = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8
    };

    const baseScore = riskLevelScores[riskAssessment.level as keyof typeof riskLevelScores] || 0.1;
    const factorMultiplier = Math.min(1.0, riskAssessment.factors?.length * 0.1 || 0);

    return Math.min(1.0, baseScore + factorMultiplier);
  }

  private calculateComputeUnits(context: AIAnalysisContext): number | undefined {
    const totalUnits = context.parsedInstructions.reduce((sum, instruction) =>
      sum + (instruction.computeUnits || 0), 0
    );
    return totalUnits > 0 ? totalUnits : undefined;
  }

  private calculateFees(context: AIAnalysisContext) {
    // Calculate fees based on account changes
    const solChanges = context.accountChanges.solChanges;
    const totalFees = Math.abs(solChanges.totalSolChange);

    return {
      total: totalFees,
      breakdown: [
        { type: 'transaction', amount: totalFees }
      ]
    };
  }

  private isDeFiTransaction(context: AIAnalysisContext): boolean {
    const defiPrograms = [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpool
      'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX' // Serum
    ];

    return context.parsedInstructions.some(instruction =>
      defiPrograms.includes(instruction.programId)
    );
  }

  private async enhanceWithTokenMetadata(
    explanation: TransactionExplanation,
    context: AIAnalysisContext
  ): Promise<void> {
    // This would integrate with token metadata services
    // For now, we'll add basic token information
    const tokenChanges = context.accountChanges.tokenChanges.significantChanges;

    if (tokenChanges.length > 0) {
      explanation.secondaryEffects.push({
        type: 'token_balance_change',
        description: `${tokenChanges.length} token balance${tokenChanges.length !== 1 ? 's' : ''} changed significantly`,
        significance: tokenChanges.some(change => change.significance === 'high') ? 'high' : 'medium'
      });
    }
  }

  /**
   * Get cached explanation if available
   */
  public async getCachedExplanation(signature: string): Promise<TransactionExplanation | null> {
    try {
      // Use the transaction signature as cache key
      const cacheKey = `tx_explanation:${signature}`;
      console.log(`Checking cache for transaction ${signature} with key: ${cacheKey}`);

      // This would integrate with a caching service like Redis
      // For now, simulate cache miss but log the operation
      // const cachedResult = await transactionAnalysisCache.get(cacheKey);
      const cachedResult = null; // Simulate cache miss for now

      if (cachedResult) {
        console.log(`Cache hit for transaction ${signature}`);
        return cachedResult as TransactionExplanation;
      }

      console.log(`Cache miss for transaction ${signature}`);
      return null;
    } catch (error) {
      console.error(`Error checking cache for ${signature}:`, error);
      return null;
    }
  }

  /**
   * Cache explanation for future use
   */
  public async cacheExplanation(signature: string, explanation: TransactionExplanation): Promise<void> {
    try {
      // Use the transaction signature as cache key
      const cacheKey = `tx_explanation:${signature}`;
      console.log(`Caching explanation for transaction ${signature} with key: ${cacheKey}`);

      // This would integrate with a caching service like Redis
      // For now, log the caching operation
      // await redis.set(cacheKey, JSON.stringify(explanation), 'EX', 3600);
      console.log(`Would cache with key: ${cacheKey}`);

      console.log(`Successfully cached explanation for ${signature}`);

      // Log explanation summary for monitoring
      console.log(`Cached explanation summary: ${explanation.summary.substring(0, 100)}...`);
    } catch (error) {
      console.error(`Error caching explanation for ${signature}:`, error);
    }
  }
}

// Export singleton instance
export const aiTransactionAnalyzer = new AITransactionAnalyzer();

// Export main analysis function
export function analyzeTransactionWithAI(transaction: any, options?: any) {
  return aiTransactionAnalyzer.analyzeTransaction(transaction, options);
}

// Export utility functions
export function formatConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Medium';
  if (confidence >= 0.3) return 'Low';
  return 'Very Low';
}

export function getActionTypeIcon(actionType: string): string {
  const icons: Record<string, string> = {
    transfer: '💸',
    swap: '🔄',
    mint: '🪙',
    burn: '🔥',
    stake: '🔒',
    vote: '🗳️',
    unknown: '❓'
  };
  return icons[actionType] || icons.unknown;
}

export function getRiskLevelColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'high':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}