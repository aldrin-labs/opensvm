import { SVMAIBalanceManager } from '../billing/SVMAIBalanceManager';
import { TokenConsumption } from '../billing/TokenConsumption';
import { AnthropicRequest } from '../types/AnthropicTypes';

/**
 * Middleware for checking SVMAI balance before processing requests
 */
export class BalanceCheck {
  private balanceManager: SVMAIBalanceManager;
  private tokenConsumption: TokenConsumption;

  constructor() {
    this.balanceManager = new SVMAIBalanceManager();
    this.tokenConsumption = new TokenConsumption();
  }

  /**
   * Initialize the balance check middleware
   */
  async initialize(): Promise<void> {
    await this.balanceManager.initialize();
  }

  /**
   * Check if user has sufficient balance for a request
   */
  async checkBalance(
    userId: string,
    anthropicRequest: AnthropicRequest
  ): Promise<BalanceCheckResult> {
    try {
      // Get current balance
      const balance = await this.balanceManager.getBalance(userId);

      // Estimate cost of the request
      const estimatedCost = this.estimateRequestCost(anthropicRequest);

      // Check if sufficient balance available
      if (balance.availableBalance < estimatedCost) {
        return {
          success: false,
          error: 'Insufficient SVMAI balance',
          errorType: 'payment_required',
          currentBalance: balance.availableBalance,
          requiredAmount: estimatedCost,
          shortfall: estimatedCost - balance.availableBalance
        };
      }

      return {
        success: true,
        currentBalance: balance.availableBalance,
        estimatedCost,
        reservationId: null // Will be set if reservation is made
      };
    } catch (error) {
      console.error('Error checking balance:', error);
      return {
        success: false,
        error: 'Failed to check balance',
        errorType: 'api_error'
      };
    }
  }

  /**
   * Reserve balance for a request
   */
  async reserveBalance(
    userId: string,
    amount: number,
    requestId: string
  ): Promise<ReservationResult> {
    try {
      const success = await this.balanceManager.reserveBalance(userId, amount, requestId);

      if (!success) {
        const balance = await this.balanceManager.getBalance(userId);
        return {
          success: false,
          error: 'Insufficient balance for reservation',
          currentBalance: balance.availableBalance,
          requestedAmount: amount
        };
      }

      return {
        success: true,
        reservationId: requestId,
        reservedAmount: amount
      };
    } catch (error) {
      console.error('Error reserving balance:', error);
      return {
        success: false,
        error: 'Failed to reserve balance'
      };
    }
  }

  /**
   * Release reserved balance (if request fails)
   */
  async releaseReservation(
    userId: string,
    amount: number,
    requestId: string
  ): Promise<void> {
    try {
      await this.balanceManager.releaseReservedBalance(userId, amount, requestId);
    } catch (error) {
      console.error('Error releasing reservation:', error);
      // Don't throw error as this is cleanup
    }
  }

  /**
   * Consume reserved balance (after successful request)
   */
  async consumeReservation(
    userId: string,
    reservedAmount: number,
    actualAmount: number,
    requestId: string
  ): Promise<void> {
    try {
      await this.balanceManager.consumeReservedBalance(
        userId,
        reservedAmount,
        actualAmount,
        requestId
      );
    } catch (error) {
      console.error('Error consuming reservation:', error);
      throw error; // This is critical for billing accuracy
    }
  }

  /**
   * Estimate cost of a request
   */
  private estimateRequestCost(request: AnthropicRequest): number {
    // Estimate input tokens from request content
    let totalContent = '';

    if (request.system) {
      totalContent += request.system;
    }

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        totalContent += message.content;
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            totalContent += content.text;
          }
        }
      }
    }

    const { inputTokens, outputTokens } = this.tokenConsumption.estimateTokenUsage(
      totalContent,
      request.max_tokens
    );

    return this.tokenConsumption.calculateEstimatedCost(
      request.model,
      inputTokens,
      outputTokens
    );
  }

  /**
   * Create balance check middleware function
   */
  createMiddleware() {
    return async (
      userId: string,
      anthropicRequest: AnthropicRequest
    ): Promise<BalanceCheckResult> => {
      return await this.checkBalance(userId, anthropicRequest);
    };
  }

  /**
   * Create payment required error response
   */
  createPaymentRequiredResponse(balanceResult: BalanceCheckResult): Response {
    const errorResponse = {
      type: 'error',
      error: {
        type: 'payment_required',
        message: balanceResult.error || 'Insufficient SVMAI balance',
        details: {
          current_balance: balanceResult.currentBalance,
          required_amount: balanceResult.requiredAmount,
          shortfall: balanceResult.shortfall
        }
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 402, // Payment Required
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get balance status for user
   */
  async getBalanceStatus(userId: string): Promise<BalanceStatus> {
    try {
      const balance = await this.balanceManager.getBalance(userId);

      return {
        available: balance.availableBalance,
        reserved: balance.reservedBalance,
        total: balance.svmaiBalance,
        totalDeposited: balance.totalDeposited,
        totalSpent: balance.totalSpent,
        lastUpdated: balance.lastUpdated,
        status: this.getBalanceStatusLevel(balance.availableBalance)
      };
    } catch (error) {
      console.error('Error getting balance status:', error);
      throw error;
    }
  }

  /**
   * Determine balance status level
   */
  private getBalanceStatusLevel(availableBalance: number): 'healthy' | 'low' | 'critical' {
    if (availableBalance >= 50) {
      return 'healthy';
    } else if (availableBalance >= 10) {
      return 'low';
    } else {
      return 'critical';
    }
  }

  /**
   * Get cost estimate for display
   */
  getCostEstimate(request: AnthropicRequest): {
    estimatedCost: number;
    breakdown: string;
    warning?: string;
  } {
    const totalContent = this.extractContentFromRequest(request);
    return this.tokenConsumption.getCostEstimateForDisplay(
      request.model,
      totalContent,
      request.max_tokens
    );
  }

  /**
   * Extract text content from request for estimation
   */
  private extractContentFromRequest(request: AnthropicRequest): string {
    let totalContent = '';

    if (request.system) {
      totalContent += request.system;
    }

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        totalContent += message.content;
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            totalContent += content.text;
          }
        }
      }
    }

    return totalContent;
  }
}

/**
 * Balance check result
 */
export interface BalanceCheckResult {
  success: boolean;
  error?: string;
  errorType?: string;
  currentBalance?: number;
  estimatedCost?: number;
  requiredAmount?: number;
  shortfall?: number;
  reservationId?: string | null;
}

/**
 * Balance reservation result
 */
export interface ReservationResult {
  success: boolean;
  error?: string;
  reservationId?: string;
  reservedAmount?: number;
  currentBalance?: number;
  requestedAmount?: number;
}

/**
 * Balance status information
 */
export interface BalanceStatus {
  available: number;
  reserved: number;
  total: number;
  totalDeposited: number;
  totalSpent: number;
  lastUpdated: Date;
  status: 'healthy' | 'low' | 'critical';
}