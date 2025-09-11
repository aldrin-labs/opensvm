import { getConnection } from '../../lib/solana-connection-server';
import { SolanaAgent } from '../../components/ai/core/agent';
import type {
  AgentCapability as ComponentAgentCapability,
  Message as ComponentMessage,
  ToolParams as ComponentToolParams
} from '../../components/ai/types';
import type {
  AgentCapability as LibAgentCapability,
  Message as LibMessage,
  ToolParams as LibToolParams
} from './types';
import {
  AccountCapability,
  AnomalyDetectionCapability,
  GenerativeCapability,
  NetworkCapability,
  PlanningCapability,
  SolanaAgentKitCapability,
  SonicCapability,
  TokenEstimationCapability,
  TransactionCapability,
  WalletCapability,
} from './capabilities';

// Convert component message to lib message
function convertToLibMessage(message: ComponentMessage): LibMessage {
  return {
    role: message.role,
    content: message.content,
    metadata: message.metadata ? {
      type: message.metadata.type as any,
      data: message.metadata.data,
    } : undefined,
  };
}

// Convert component context to lib context
function convertToLibContext(context: any): any {
  return {
    messages: context.messages.map(convertToLibMessage),
    networkState: context.networkState,
    activeAnalysis: context.activeAnalysis,
  };
}

// Bridge function to convert lib capabilities to component capabilities
function bridgeCapability(libCapability: LibAgentCapability): ComponentAgentCapability {
  return {
    type: libCapability.type as any,
    tools: libCapability.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      execute: async (params: ComponentToolParams) => {
        // Convert component params to lib params
        const libParams: LibToolParams = {
          message: convertToLibMessage(params.message),
          context: convertToLibContext(params.context),
        };
        return await tool.execute(libParams);
      },
      matches: tool.matches ? (message: ComponentMessage) => {
        return tool.matches!(convertToLibMessage(message));
      } : undefined,
      required: tool.required,
      dependencies: tool.dependencies,
    })),
    canHandle: (message: ComponentMessage) => {
      return libCapability.canHandle(convertToLibMessage(message));
    },
  };
}

export function createAgent() {
  const connection = getConnection();

  // Create lib capabilities
  const libCapabilities: LibAgentCapability[] = [
    new AccountCapability(connection),
    new AnomalyDetectionCapability(connection),
    new GenerativeCapability(),
    new NetworkCapability(connection),
    new PlanningCapability(connection),
    new TokenEstimationCapability(),
    new TransactionCapability(connection),
    new WalletCapability(connection),
  ];

  // Bridge them to component capabilities
  const capabilities: ComponentAgentCapability[] = libCapabilities.map(bridgeCapability);

  const agent = new SolanaAgent({
    capabilities,
    systemPrompt: 'You are a helpful Solana expert.',
    maxContextSize: 32000,
    temperature: 0.1,
  });

  return agent;
}
