export interface ProxyRequest {
  method: string;
  headers: Record<string, string>;
  body: any;
  userId?: string;
  apiKeyId?: string;
  estimatedCost?: number;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  userId?: string;
  keyId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  actualCost?: number;
  responseTime?: number;
  success?: boolean;
  timestamp?: Date;
  anthropicResponse?: AnthropicResponse | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface UserBalance {
  userId: string;
  balance: number;
  lastUpdated: number;
}

export interface KeyUsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  lastUsed: number;
}

export interface AnthropicResponse {
  id: string;
  content: Array<{ text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  stop_reason?: string;
}