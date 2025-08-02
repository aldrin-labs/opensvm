import { Connection } from '@solana/web3.js';

// Use Connection for AI agent Solana integration
export type AIConnection = Connection;

export type CapabilityType = 'transaction' | 'account' | 'network' | 'general' | 'utility';

export type ToolType = 
    | 'fetch_transaction'
    | 'fetch_account'
    | 'fetch_block'
    | 'fetch_token'
    | 'analyze_wallet'
    | 'estimate_token_usage';

export interface Tool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

export interface AgentCapability {
  type: CapabilityType;
  tools: Tool[];
  canHandle(message: { content: string }): boolean;
}

export interface AgentConfig {
  capabilities: AgentCapability[];
  systemPrompt?: string;
  maxContextSize?: number;
  temperature?: number;
}
