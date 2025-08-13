export enum ExecutionMode {
  Sequential = 'sequential',
  Parallel = 'parallel'
}
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: {
    type: CapabilityType;
    data: any;
  };
}

export interface Note {
  id: string;
  content: string;
  author: 'user' | 'assistant';
  timestamp: number;
}

export interface AgentAction {
  id: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string;
  error?: string;
  startTime?: number;
  stepIndex?: number;
  totalSteps?: number;
  retryCount?: number;
}

export interface AgentConfig {
  capabilities: AgentCapability[];
  systemPrompt: string;
  maxContextSize: number;
  temperature: number;
}

export interface AgentContext {
  messages: Message[];
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
  canHandle: (message: Message) => boolean;
}

export type CapabilityType =
  | 'general'
  | 'network'
  | 'transaction'
  | 'account'
  | 'planning'
  | 'analysis'
  | 'search'
  | 'monitoring'
  | 'research';