import { AnthropicClient } from './AnthropicClient';

let anthropicClientInstance: AnthropicClient | null = null;

export function getAnthropicClient(apiKey?: string): AnthropicClient {
  if (!anthropicClientInstance) {
    if (!apiKey) {
      throw new Error('API key required for first initialization');
    }
    anthropicClientInstance = new AnthropicClient(apiKey);
  } else if (apiKey) {
    anthropicClientInstance.setApiKey(apiKey);
  }
  return anthropicClientInstance;
}

export function resetAnthropicClient(): void {
  anthropicClientInstance = null;
}

export function hasAnthropicClient(): boolean {
  return anthropicClientInstance !== null;
}