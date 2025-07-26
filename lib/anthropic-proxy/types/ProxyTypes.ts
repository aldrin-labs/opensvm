/**
 * Core types for Anthropic API Proxy with SVMAI billing
 */

import { AnthropicRequest, AnthropicResponse } from './AnthropicTypes';

export interface APIKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string; // Never store the actual key, only hash
  keyPrefix: string; // First 8 chars for display (sk-ant-api03-abc...)
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  usageStats: KeyUsageStats;
}

export interface KeyUsageStats {
  totalRequests: number;
  totalTokensConsumed: number;
  totalSVMAISpent: number;
  lastRequestAt?: Date;
  averageTokensPerRequest: number;
}

export interface UserBalance {
  userId: string;
  svmaiBalance: number;
  reservedBalance: number; // Reserved for ongoing requests
  availableBalance: number; // svmaiBalance - reservedBalance
  totalDeposited: number;
  totalSpent: number;
  lastUpdated: Date;
}

export interface ProxyRequest {
  keyId: string;
  userId: string;
  anthropicRequest: AnthropicRequest; // Typed Anthropic API request
  estimatedCost: number; // Estimated SVMAI cost
  timestamp: Date;
}

export interface ProxyResponse {
  keyId: string;
  userId: string;
  anthropicResponse: AnthropicResponse | null; // Typed Anthropic API response (null for streaming)
  actualCost: number; // Actual SVMAI cost based on token usage
  inputTokens: number;
  outputTokens: number;
  model: string;
  success: boolean;
  timestamp: Date;
  responseTime: number; // milliseconds
}

export interface DepositTransaction {
  id: string;
  userId: string;
  amount: number; // SVMAI amount
  solanaSignature: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
  confirmedAt?: Date;
}

export interface PricingTier {
  model: string;
  svmaiPerInputToken: number;
  svmaiPerOutputToken: number;
  minimumCharge: number;
}

// Default pricing tiers
export const DEFAULT_PRICING: PricingTier[] = [
  {
    model: 'claude-3-haiku-20240307',
    svmaiPerInputToken: 0.1,
    svmaiPerOutputToken: 0.2,
    minimumCharge: 1
  },
  {
    model: 'claude-3-sonnet-20240229',
    svmaiPerInputToken: 0.2,
    svmaiPerOutputToken: 0.4,
    minimumCharge: 2
  },
  {
    model: 'claude-3-opus-20240229',
    svmaiPerInputToken: 0.5,
    svmaiPerOutputToken: 1.0,
    minimumCharge: 5
  }
];

export interface KeyGenerationRequest {
  userId: string;
  name: string;
}

export interface KeyGenerationResult {
  keyId: string;
  apiKey: string; // Full key returned only once
  keyPrefix: string; // For display
  createdAt: Date;
}

export interface KeyValidationResult {
  isValid: boolean;
  keyId?: string;
  userId?: string;
  error?: string;
}