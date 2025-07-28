/**
 * Anthropic API types matching their official specification
 * Based on https://docs.anthropic.com/claude/reference/messages_post
 */

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

export interface AnthropicContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: any;
  content?: any;
  is_error?: boolean;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  metadata?: {
    user_id?: string;
  };
  stop_sequences?: string[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  tools?: AnthropicTool[];
  tool_choice?: {
    type: 'auto' | 'any' | 'tool';
    name?: string;
  };
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicStreamChunk {
  type: 'message_start' | 'content_block_start' | 'ping' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: Partial<AnthropicResponse>;
  index?: number;
  content_block?: AnthropicContent;
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  usage?: {
    output_tokens: number;
  };
}

export interface AnthropicError {
  type: 'error';
  error: {
    type: 'invalid_request_error' | 'authentication_error' | 'permission_error' | 'not_found_error' | 'rate_limit_error' | 'api_error' | 'overloaded_error';
    message: string;
  };
}

/**
 * AnthropicAPIError class for handling API errors
 */
export class AnthropicAPIError extends Error {
  public readonly anthropicError: AnthropicError;
  public readonly status: number;

  constructor(errorData: AnthropicError, statusCode: number) {
    const message = errorData?.error?.message || 'Anthropic API error occurred';
    super(message);

    this.name = 'AnthropicAPIError';
    this.anthropicError = errorData;
    this.status = statusCode;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AnthropicAPIError.prototype);
  }
}

export interface AnthropicModel {
  id: string;
  type: 'model';
  display_name: string;
  created_at: string;
}

export interface AnthropicModelsResponse {
  data: AnthropicModel[];
  has_more: boolean;
  first_id?: string;
  last_id?: string;
}

// Standard Anthropic models
export const ANTHROPIC_MODELS: AnthropicModel[] = [
  {
    id: 'claude-3-haiku-20240307',
    type: 'model',
    display_name: 'Claude 3 Haiku',
    created_at: '2024-03-07T00:00:00Z'
  },
  {
    id: 'claude-3-sonnet-20240229',
    type: 'model',
    display_name: 'Claude 3 Sonnet',
    created_at: '2024-02-29T00:00:00Z'
  },
  {
    id: 'claude-3-opus-20240229',
    type: 'model',
    display_name: 'Claude 3 Opus',
    created_at: '2024-02-29T00:00:00Z'
  }
];

// HTTP headers for Anthropic API
export const ANTHROPIC_HEADERS = {
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'messages-2023-12-15'
} as const;

/**
 * Statistics for OpenRouter API key usage
 */
export interface KeyUsageStats {
  totalKeys: number;
  activeKeys: number;
  failedKeys: number;
  usage: {
    [keyId: string]: {
      requests: number;
      lastUsed: number | null;
      isFailed: boolean;
      keyPreview: string;
    };
  };
}

/**
 * Models list response
 */
export interface ModelsResponse {
  object: 'list';
  data: Array<{
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }>;
}

/**
 * Usage statistics response
 */
export interface UsageStatsResponse {
  model: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  requests: number;
  period: {
    start: string;
    end: string;
  };
}