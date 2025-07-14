import type { 
  AgentConfig, 
  AgentContext, 
  Message, 
  Tool, 
  ToolParams,
  CapabilityType,
  AgentAction,
  AgentCapability
} from '../types';
import { NETWORK_PERFORMANCE_KNOWLEDGE } from './knowledge';
import { generateSecureActionId } from '@/lib/crypto-utils';

export class SolanaAgent {
  private config: AgentConfig;
  private context: AgentContext;

  constructor(config: AgentConfig) {
    this.config = config;
    this.context = {
      messages: [{
        role: 'system',
        content: config.systemPrompt
      }]
    };
  }

  private extractActionsFromResponse(response: string): AgentAction[] {
    const actionMatches = response.match(/\[ACTION\](.*?)\[\/ACTION\]/g) || [];
    return actionMatches.map(match => {
      const actionContent = match.replace('[ACTION]', '').replace('[/ACTION]', '').trim();
      const firstColonIndex = actionContent.indexOf(':');
      if (firstColonIndex === -1) {
        throw new Error('Invalid action format: missing type delimiter');
      }
      const type = actionContent.slice(0, firstColonIndex).trim();
      const description = actionContent.slice(firstColonIndex + 1).trim();
      return {
        id: generateSecureActionId(),
        type: type as AgentAction['type'],
        status: 'pending' as const,
        description
      };
    });
  }

  async processMessage(message: Message): Promise<Message> {
    // Add message to context
    this.context.messages.push(message);

    // If this is a planning request (system message), generate action plan
    if (message.role === 'system') {
      const planningResponse = {
        role: 'assistant' as const,
        content: await this.generateActionPlan(message.content),
        metadata: {
          type: 'planning' as CapabilityType,
          data: null
        }
      };
      this.context.messages.push(planningResponse);
      return planningResponse;
    }

    // For user messages, determine capability and execute
    const capability = this.config.capabilities.find(cap => cap.canHandle(message));
    
    if (!capability) {
      return this.createErrorResponse('I apologize, but I\'m not sure how to handle that request.');
    }

    try {
      // Get the last assistant message which should contain the action plan
      const lastAssistantMessage = [...this.context.messages]
        .reverse()
        .find(m => m.role === 'assistant') || null;
      
      // Extract actions from the last assistant message if it exists
      const actions = lastAssistantMessage 
        ? this.extractActionsFromResponse(lastAssistantMessage.content)
        : [];
      
      // Execute actions if present, otherwise use capability directly
      const result = actions.length > 0 
        ? await this.executeActions(actions)
        : await this.executeCapability(capability, message);
      
      // Generate response using result
      const response = this.createResponse(capability.type, result);

      // Add response to context
      this.context.messages.push(response);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing message:', errorMessage);
      return this.createErrorResponse('I encountered an error while processing your request.');
    }
  }

  private async generateActionPlan(prompt: string): Promise<string> {
    // Extract the user's request from the prompt
    const requestMatch = prompt.match(/handle this request: "(.*?)" using available methods/i);
    if (!requestMatch?.[1]) return 'No actions needed';
    
    const request = requestMatch[1].toLowerCase();
    
    // Define action patterns with type safety
    interface ActionPattern {
      keywords: string[];
      actions: string[];
    }

    const patterns: ActionPattern[] = [
      {
        keywords: ['tps', 'transactions per second', 'performance'],
        actions: [
          '[ACTION]network.analyzeNetworkLoad:Get current TPS and network load metrics[/ACTION]'
        ]
      },
      {
        keywords: ['network status', 'network health'],
        actions: [
          '[ACTION]network.getNetworkStatus:Get current network status[/ACTION]',
          '[ACTION]network.analyzeNetworkLoad:Get network performance metrics[/ACTION]'
        ]
      },
      {
        keywords: ['validator', 'validators'],
        actions: [
          '[ACTION]network.getValidatorInfo:Get validator information[/ACTION]'
        ]
      },
      {
        keywords: ['transaction', 'tx'],
        actions: [
          '[ACTION]transaction.getTransaction:Get transaction details[/ACTION]'
        ]
      },
      {
        keywords: ['balance', 'account'],
        actions: [
          '[ACTION]account.getAccountInfo:Get account information[/ACTION]',
          '[ACTION]account.getBalance:Get account balance[/ACTION]'
        ]
      },
      {
        keywords: ['wallet path', 'path between', 'path finding', 'connect wallets', 'wallet connection'],
        actions: [
          '[ACTION]wallet_path_finding:Find path between wallets by tracking transfers[/ACTION]'
        ]
      }
    ];
    
    // Find matching pattern
    const matchingPattern = patterns.find(pattern =>
      pattern.keywords.some(keyword => request.includes(keyword))
    );
    
    if (matchingPattern) {
      return matchingPattern.actions.join('\n');
    }
    
    // If no specific pattern matches, extract methods from prompt
    const methodsMatch = prompt.match(/available methods: (.*?)(?:\.|$)/i);
    const methods = methodsMatch?.[1]?.split(', ').filter(Boolean) ?? [];
    const actionsList = methods
      .map(method => `[ACTION]${method}:Execute ${method}[/ACTION]`)
      .join('\n');
    
    return actionsList || 'No actions needed';
  }

  private async executeActions(actions: AgentAction[]): Promise<any[]> {
    const results = [];
    for (const action of actions) {
      try {
        // Parse action type to extract capability
        const capabilityInfo = this.parseActionType(action.type);
        if (!capabilityInfo?.capabilityType) {
          throw new Error(`Invalid action type: ${action.type}`);
        }

        const { capabilityType } = capabilityInfo;

        // Find matching capability
        const capability = this.config.capabilities.find(cap => 
          this.matchesCapability(cap.type, capabilityType)
        );

        if (!capability) {
          throw new Error(`No capability found for type: ${capabilityType}`);
        }

        const result = await this.executeCapability(capability, {
          role: 'user',
          content: action.description
        });

        results.push({ 
          action, 
          result, 
          status: 'completed' as const,
          capabilityType: capability.type 
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ 
          action, 
          error: errorMessage,
          status: 'failed' as const
        });
      }
    }
    return results;
  }

  private parseActionType(actionType: string): { capabilityType: string } | null {
    // Handle various action type formats:
    // 1. capability.action (e.g., network.getStatus)
    // 2. capability/action (e.g., network/getStatus)
    // 3. capability_action (e.g., network_getStatus)
    // 4. capabilityAction (e.g., networkGetStatus)
    // 5. simple_action (e.g., getStatus)
    
    // First try to match capability.action format
    const dotMatch = actionType.match(/^([a-z]+)\.([a-z]+)/i);
    if (dotMatch?.[1]) {
      return { capabilityType: dotMatch[1].toLowerCase() };
    }

    // Try capability/action format
    const slashMatch = actionType.match(/^([a-z]+)\/([a-z]+)/i);
    if (slashMatch?.[1]) {
      return { capabilityType: slashMatch[1].toLowerCase() };
    }

    // Try capability_action format
    const underscoreMatch = actionType.match(/^([a-z]+)_([a-z]+)/i);
    if (underscoreMatch?.[1]) {
      return { capabilityType: underscoreMatch[1].toLowerCase() };
    }

    // Try camelCase format (e.g., networkGetStatus)
    const camelMatch = actionType.match(/^([a-z]+)([A-Z][a-z]+)/);
    if (camelMatch?.[1]) {
      return { capabilityType: camelMatch[1].toLowerCase() };
    }

    // For simple actions, try to infer capability from the action
    const simpleMatch = actionType.match(/^([a-z]+)$/i);
    if (simpleMatch?.[1]) {
      const action = simpleMatch[1].toLowerCase();
      // Map common actions to capabilities
      const actionToCapability: Record<string, string> = {
        'analyze': 'network',
        'get': 'network',
        'fetch': 'network',
        'monitor': 'network'
      };
      return { capabilityType: actionToCapability[action] || action };
    }

    return null;
  }

  private matchesCapability(capabilityType: string, actionCapabilityType: string): boolean {
    // Normalize both types for comparison
    const normalizedCapability = capabilityType.toLowerCase();
    const normalizedAction = actionCapabilityType.toLowerCase();

    // Direct match
    if (normalizedCapability === normalizedAction) {
      return true;
    }

    // Handle plural forms (e.g., "transaction" matches "transactions")
    if (normalizedCapability.replace(/s$/, '') === normalizedAction.replace(/s$/, '')) {
      return true;
    }

    // Handle common capability aliases
    const capabilityAliases: Record<string, string[]> = {
      'network': ['net', 'performance', 'status', 'metrics'],
      'transaction': ['tx', 'transactions'],
      'account': ['accounts', 'wallet', 'balance']
    };

    // Check if the action type matches any alias for the capability
    return capabilityAliases[normalizedCapability]?.includes(normalizedAction) || false;
  }

  private async executeCapability(capability: AgentCapability, message: Message): Promise<any> {
    // Get all tools for this capability
    const tools = capability.tools;
    const results = [];

    // Filter tools based on relevance to the message
    const relevantTools = tools.filter(tool => {
      // Check if tool matches message intent or keywords
      const toolMatches = tool.matches?.(message) ?? false;
      // Check if tool is required by capability
      const isRequired = tool.required ?? false;
      return toolMatches || isRequired;
    });

    if (relevantTools.length === 0) {
      return [];
    }

    // Create a map of completed tools
    const completedTools = new Set<string>();

    // Keep track of tools left to execute
    let remainingTools = [...relevantTools];

    // Execute tools respecting dependencies
    while (remainingTools.length > 0) {
      // Find tools that can be executed (all dependencies satisfied)
      const executableTools = remainingTools.filter(tool => {
        const dependencies = (tool.dependencies || []) as string[];
        return dependencies.every(dep => completedTools.has(dep));
      });

      if (executableTools.length === 0 && remainingTools.length > 0) {
        throw new Error('Circular dependency detected in tools');
      }

      // Execute the current batch of tools
      const batchResults = await Promise.all(
        executableTools.map(async tool => {
          const result = await this.executeTool(tool, message);
          return {
            ...result,
            status: 'completed' as const
          };
        })
      );

      // Add results and mark tools as completed
      results.push(...batchResults);
      executableTools.forEach(tool => completedTools.add(tool.name));

      // Remove executed tools from remaining
      remainingTools = remainingTools.filter(tool => 
        !executableTools.includes(tool)
      );
    }

    return results;
  }

  private async executeTool(tool: Tool, message: Message): Promise<any> {
    const params: ToolParams = {
      message,
      context: this.context
    };

    try {
      const result = await tool.execute(params);
      return {
        tool: tool.name,
        result
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error executing tool ${tool.name}:`, errorMessage);
      throw error;
    }
  }

  private createResponse(type: CapabilityType, data: any): Message {
    return {
      role: 'assistant',
      content: this.generateResponse(data),
      metadata: {
        type,
        data
      }
    };
  }

  private createErrorResponse(content: string): Message {
    return {
      role: 'assistant',
      content,
      metadata: {
        type: 'general' as CapabilityType,
        data: null
      }
    };
  }

  private generateResponse(result: any): string {
    if (!result) {
      return "I wasn't able to get any results for your request.";
    }

    // Handle array of results from multiple tools
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return "I completed the operation but there were no results to report.";
      }

      // Process each result and combine into a coherent response
      const responses = result.map((item: any) => {
        if (item.status === 'failed') {
          return `Error: ${item.error}`;
        }

        // Extract the actual result data
        const data = item.result?.result || item.result;
        
        if (!data) {
          return null;
        }

        // Handle custom actions
        if (data.actionName && typeof data.params === 'object') {
          return `I'll find the path between these wallets for you. Processing...`;
        }

        // Handle network performance data
        if (item.tool === 'analyzeNetworkLoad' && typeof data === 'object') {
          const { averageTps, maxTps, load, loadDescription, tpsRange } = data;
          return `The current TPS is ${averageTps} (${tpsRange}). Peak TPS: ${maxTps}. Network load is ${load} (${loadDescription}).`;
        }

        // Handle different types of data
        if (typeof data === 'object') {
          if (data.message) {
            return data.message;
          }
          // Convert meaningful object properties to natural text
          const details = Object.entries(data)
            .filter(([key]) => !['id', '_id', 'type', 'status'].includes(key))
            .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
            .join('\n');
          return details || null;
        }

        return String(data);
      }).filter(Boolean);

      return responses.join('\n');
    }

    // Handle single result
    if (typeof result === 'object') {
      if (result.message) {
        return result.message;
      } else if (result.error) {
        return `Error: ${result.error}`;
      } else {
        // Convert object to readable text
        const details = Object.entries(result)
          .filter(([key]) => !['id', '_id', 'type', 'status'].includes(key))
          .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
          .join('\n');
        return details || 'Operation completed successfully.';
      }
    }

    return String(result);
  }

  // Utility methods
  public getContext(): AgentContext {
    return this.context;
  }

  public clearContext() {
    this.context = {
      messages: [{
        role: 'system',
        content: this.config.systemPrompt
      }]
    };
  }
}
