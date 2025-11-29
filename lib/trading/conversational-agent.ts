/**
 * Conversational Trading Agent
 *
 * Handles multi-turn conversations with users to refine vague intent
 * into executable trades. This is true "vibe trading" - express intent,
 * agent handles everything else through conversation.
 */

import { analyzeIntent, generateTradeProposal, type IntentAnalysis, type TradeProposal } from './intent-analyzer';
import { executeTradeCommand } from './command-executor';

export type ConversationState =
  | 'AWAITING_INPUT'
  | 'ANALYZING_INTENT'
  | 'CLARIFYING'
  | 'PROPOSING_TRADE'
  | 'AWAITING_APPROVAL'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'ERROR';

export interface ConversationContext {
  state: ConversationState;
  intentAnalysis: IntentAnalysis | null;
  pendingQuestions: string[];
  currentQuestionIndex: number;
  collectedAnswers: Record<string, any>;
  tradeProposal: TradeProposal | null;
  messageHistory: Array<{ role: 'user' | 'agent'; content: string }>;
}

export interface AgentResponse {
  message: string;
  state: ConversationState;
  requiresInput: boolean;
  proposal?: TradeProposal;
  completed?: boolean;
}

export class ConversationalTradingAgent {
  private context: ConversationContext;

  constructor() {
    this.context = this.createInitialContext();
  }

  private createInitialContext(): ConversationContext {
    return {
      state: 'AWAITING_INPUT',
      intentAnalysis: null,
      pendingQuestions: [],
      currentQuestionIndex: 0,
      collectedAnswers: {},
      tradeProposal: null,
      messageHistory: [],
    };
  }

  /**
   * Main entry point - process user message and return agent response
   */
  async processMessage(userMessage: string, userContext: any): Promise<AgentResponse> {
    // Add to history
    this.context.messageHistory.push({ role: 'user', content: userMessage });

    // State machine
    switch (this.context.state) {
      case 'AWAITING_INPUT':
        return await this.handleInitialInput(userMessage, userContext);

      case 'CLARIFYING':
        return await this.handleClarification(userMessage, userContext);

      case 'AWAITING_APPROVAL':
        return await this.handleApproval(userMessage, userContext);

      default:
        return {
          message: 'Something went wrong. Let's start over - what would you like to do?',
          state: 'AWAITING_INPUT',
          requiresInput: true,
        };
    }
  }

  /**
   * Handle initial user input - analyze intent
   */
  private async handleInitialInput(userMessage: string, userContext: any): Promise<AgentResponse> {
    this.context.state = 'ANALYZING_INTENT';

    // Analyze intent
    const intent = await analyzeIntent(userMessage, userContext);
    this.context.intentAnalysis = intent;

    // If clarification needed, start asking questions
    if (intent.clarificationNeeded && intent.questions && intent.questions.length > 0) {
      this.context.state = 'CLARIFYING';
      this.context.pendingQuestions = intent.questions;
      this.context.currentQuestionIndex = 0;

      const firstQuestion = this.context.pendingQuestions[0];
      const response = this.buildClarificationMessage(intent, firstQuestion);

      this.context.messageHistory.push({ role: 'agent', content: response });

      return {
        message: response,
        state: 'CLARIFYING',
        requiresInput: true,
      };
    }

    // If no clarification needed, generate proposal immediately
    const proposal = await generateTradeProposal(intent, userContext);

    if (!proposal) {
      return {
        message: "I couldn't generate a trade proposal. Could you provide more details?",
        state: 'AWAITING_INPUT',
        requiresInput: true,
      };
    }

    this.context.tradeProposal = proposal;
    this.context.state = 'PROPOSING_TRADE';

    const proposalMessage = this.buildProposalMessage(proposal);
    this.context.messageHistory.push({ role: 'agent', content: proposalMessage });

    return {
      message: proposalMessage,
      state: 'AWAITING_APPROVAL',
      requiresInput: true,
      proposal,
    };
  }

  /**
   * Handle clarification responses
   */
  private async handleClarification(userMessage: string, userContext: any): Promise<AgentResponse> {
    const currentQuestion = this.context.pendingQuestions[this.context.currentQuestionIndex];

    // Store answer
    this.context.collectedAnswers[`q${this.context.currentQuestionIndex}`] = userMessage;

    // Move to next question
    this.context.currentQuestionIndex++;

    // If more questions remain, ask next
    if (this.context.currentQuestionIndex < this.context.pendingQuestions.length) {
      const nextQuestion = this.context.pendingQuestions[this.context.currentQuestionIndex];

      this.context.messageHistory.push({ role: 'agent', content: nextQuestion });

      return {
        message: nextQuestion,
        state: 'CLARIFYING',
        requiresInput: true,
      };
    }

    // All questions answered - generate proposal
    this.context.state = 'PROPOSING_TRADE';

    // Merge answers into context
    const enrichedContext = {
      ...userContext,
      clarificationAnswers: this.context.collectedAnswers,
    };

    const proposal = await generateTradeProposal(this.context.intentAnalysis!, enrichedContext);

    if (!proposal) {
      return {
        message: "I couldn't generate a trade proposal. Let's start over - what would you like to do?",
        state: 'AWAITING_INPUT',
        requiresInput: true,
      };
    }

    this.context.tradeProposal = proposal;
    this.context.state = 'AWAITING_APPROVAL';

    const proposalMessage = this.buildProposalMessage(proposal);
    this.context.messageHistory.push({ role: 'agent', content: proposalMessage });

    return {
      message: proposalMessage,
      state: 'AWAITING_APPROVAL',
      requiresInput: true,
      proposal,
    };
  }

  /**
   * Handle approval/rejection of trade proposal
   */
  private async handleApproval(userMessage: string, userContext: any): Promise<AgentResponse> {
    const approval = this.parseApproval(userMessage);

    if (approval === 'approved') {
      this.context.state = 'EXECUTING';

      // Execute the trade
      const proposal = this.context.tradeProposal!;

      try {
        await executeTradeCommand(
          proposal.action.toLowerCase(),
          {
            amount: proposal.amount,
            token: proposal.asset,
            orderType: 'market',
          },
          {
            selectedMarket: `${proposal.asset}/USDC`,
            onMarketChange: () => {},
            onLayoutChange: () => {},
            onTradeExecute: () => {},
            onMaximizeTile: () => {},
          }
        );

        this.context.state = 'COMPLETED';

        const successMessage = this.buildSuccessMessage(proposal);
        this.context.messageHistory.push({ role: 'agent', content: successMessage });

        // Reset for next conversation
        this.context = this.createInitialContext();

        return {
          message: successMessage,
          state: 'COMPLETED',
          requiresInput: false,
          completed: true,
        };
      } catch (error) {
        this.context.state = 'ERROR';

        const errorMessage = `Failed to execute trade: ${error}. Let's try again - what would you like to do?`;
        this.context.messageHistory.push({ role: 'agent', content: errorMessage });

        // Reset for next conversation
        this.context = this.createInitialContext();

        return {
          message: errorMessage,
          state: 'AWAITING_INPUT',
          requiresInput: true,
        };
      }
    } else if (approval === 'rejected') {
      const rejectionMessage = "Understood. Trade cancelled. What else can I help you with?";
      this.context.messageHistory.push({ role: 'agent', content: rejectionMessage });

      // Reset for next conversation
      this.context = this.createInitialContext();

      return {
        message: rejectionMessage,
        state: 'AWAITING_INPUT',
        requiresInput: true,
      };
    } else if (approval === 'modify') {
      const modifyMessage = "What would you like to change about the proposal?";
      this.context.messageHistory.push({ role: 'agent', content: modifyMessage });

      // Go back to clarifying
      this.context.state = 'CLARIFYING';
      this.context.pendingQuestions = ["What changes would you like to make?"];
      this.context.currentQuestionIndex = 0;

      return {
        message: modifyMessage,
        state: 'CLARIFYING',
        requiresInput: true,
      };
    } else {
      const clarifyMessage = "I didn't understand. Do you want to approve, reject, or modify this trade?";
      this.context.messageHistory.push({ role: 'agent', content: clarifyMessage });

      return {
        message: clarifyMessage,
        state: 'AWAITING_APPROVAL',
        requiresInput: true,
        proposal: this.context.tradeProposal!,
      };
    }
  }

  /**
   * Build clarification message
   */
  private buildClarificationMessage(intent: IntentAnalysis, question: string): string {
    return `I understand you want to **${intent.intent}**${intent.asset ? ` ${intent.asset}` : ''}.\n\n${question}`;
  }

  /**
   * Build trade proposal message
   */
  private buildProposalMessage(proposal: TradeProposal): string {
    return `## 📊 Trade Proposal

**Action:** ${proposal.action}
**Asset:** ${proposal.asset}
**Amount:** ${proposal.amount} ${proposal.asset} (~$${proposal.usdValue.toFixed(2)})

**Reasoning:** ${proposal.reasoning}

**Expected Outcome:** ${proposal.expectedOutcome}

**Risks:**
${proposal.risks.map(r => `• ${r}`).join('\n')}

**Confidence:** ${Math.round(proposal.confidence * 100)}%

---

Do you want to **approve**, **reject**, or **modify** this trade?`;
  }

  /**
   * Build success message
   */
  private buildSuccessMessage(proposal: TradeProposal): string {
    return `✅ **Trade Executed Successfully!**

${proposal.action} ${proposal.amount} ${proposal.asset} at market price.

I'll continue monitoring this position. Is there anything else you'd like to do?`;
  }

  /**
   * Parse user's approval/rejection
   */
  private parseApproval(message: string): 'approved' | 'rejected' | 'modify' | 'unclear' {
    const lower = message.toLowerCase().trim();

    const approvalTerms = ['yes', 'approve', 'approved', 'do it', 'execute', 'go', 'ok', 'okay', 'confirm', 'confirmed'];
    const rejectionTerms = ['no', 'reject', 'rejected', 'cancel', 'cancelled', 'stop', 'don\'t', 'nope'];
    const modifyTerms = ['modify', 'change', 'edit', 'adjust', 'different'];

    if (approvalTerms.some(term => lower.includes(term))) {
      return 'approved';
    }

    if (rejectionTerms.some(term => lower.includes(term))) {
      return 'rejected';
    }

    if (modifyTerms.some(term => lower.includes(term))) {
      return 'modify';
    }

    return 'unclear';
  }

  /**
   * Get conversation history (for debugging/logging)
   */
  getHistory(): Array<{ role: 'user' | 'agent'; content: string }> {
    return this.context.messageHistory;
  }

  /**
   * Reset conversation
   */
  reset(): void {
    this.context = this.createInitialContext();
  }
}

// Singleton instance
export const conversationalAgent = new ConversationalTradingAgent();
