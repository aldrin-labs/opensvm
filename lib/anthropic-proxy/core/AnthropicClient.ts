import { AnthropicRequest, AnthropicResponse, AnthropicAPIError } from '../types/AnthropicTypes';

export class AnthropicClient {
  private apiKey: string;
  private baseURL: string = 'https://api.anthropic.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw AnthropicAPIError.fromResponse(response, error);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AnthropicAPIError) {
        throw error;
      }
      throw new AnthropicAPIError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async streamMessage(request: AnthropicRequest): Promise<ReadableStream> {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ ...request, stream: true })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw AnthropicAPIError.fromResponse(response, error);
    }

    return response.body!;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  getApiKey(): string {
    return this.apiKey;
  }
}

export { AnthropicAPIError };