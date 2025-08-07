export interface AnthropicRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
}

export interface AnthropicResponse {
  id: string;
  content: Array<{ text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  stop_reason?: string;
}

export class AnthropicAPIError extends Error {
  public status: number;
  public code: string;

  constructor(message: string, status: number = 500, code: string = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'AnthropicAPIError';
    this.status = status;
    this.code = code;
  }
}