export enum ExecutionMode {
  Sequential = 'sequential',
  Parallel = 'parallel'
}

export type CapabilityType = 'transaction' | 'account' | 'network' | 'general' | 'anomaly_detection';

export interface Note {
  id: string;
  content: string;
  author: 'user' | 'assistant' | 'agent';
  timestamp: number;
}

export interface AgentAction {
  id: string;
  type: 
    | 'fetch_transaction'
    | 'fetch_account' 
    | 'fetch_token'
    | 'analyze_wallet'
    | 'track_program'
    | 'rank_wallets'
    | 'pumpfun_listen'
    | 'pumpfun_buy'
    | 'pumpfun_sell'
    | 'pumpfun_track'
    | 'wallet_path_finding';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string;
  error?: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'agent';

export interface Message {
  role: MessageRole;
  content: string;
  metadata?: {
    type?: CapabilityType;
    data?: any;
  };
}

export interface AgentContext {
  messages: Message[];
  networkState?: NetworkState;
  activeAnalysis?: Analysis;
}

export interface NetworkState {
  currentSlot?: number;
  tps?: number;
  blockTime?: number;
  validatorCount?: number;
}

export interface Analysis {
  type: CapabilityType;
  status: 'pending' | 'complete' | 'error';
  data: any;
}

export interface Tool {
  name: string;
  description: string;
  execute: (params: ToolParams) => Promise<any>;
  matches?: (message: Message) => boolean;
  required?: boolean;
  dependencies?: string[];
}

export interface ToolParams {
  message: Message;
  context: AgentContext;
}

export interface AgentCapability {
  type: CapabilityType;
  tools: Tool[];
  executionMode?: ExecutionMode;
  canHandle: (message: Message) => boolean;
}

export interface AgentConfig {
  capabilities: AgentCapability[];
  systemPrompt: string;
  maxContextSize?: number;
  temperature?: number;
}
