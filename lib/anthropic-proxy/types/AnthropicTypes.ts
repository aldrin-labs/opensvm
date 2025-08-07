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
  private errorData: any;

  constructor(messageOrData: string | any, status: number = 500, code: string = 'UNKNOWN_ERROR') {
    if (typeof messageOrData === 'string') {
      super(messageOrData);
      this.errorData = null;
    } else {
      super(messageOrData?.error?.message || 'Unknown error');
      this.errorData = messageOrData;
    }
    this.name = 'AnthropicAPIError';
    this.status = status;
    this.code = code;
  }

  static fromResponse(response: Response, errorData: any): AnthropicAPIError {
    return new AnthropicAPIError(errorData, response.status);
  }

  getErrorType(): string {
    return this.errorData?.error?.type || 'unknown_error';
  }

  isRetryable(): boolean {
    const retryableTypes = ['rate_limit_error', 'server_error'];
    return retryableTypes.includes(this.getErrorType()) || this.status >= 500;
  }

  getRetryDelay(): number {
    if (this.getErrorType() === 'rate_limit_error') {
      return 60000; // 1 minute
    }
    return 5000; // 5 seconds for other retryable errors
  }

  toJSON(): any {
    return this.errorData || { message: this.message, status: this.status, code: this.code };
  }
}