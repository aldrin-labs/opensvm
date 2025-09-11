import type {
  AgentConfig,
  AgentContext,
  Message,
  Tool,
  ToolParams,
  CapabilityType,
  AgentAction,
  AgentCapability,
  ProgressEvent
} from '../types';
import { NETWORK_PERFORMANCE_KNOWLEDGE } from './knowledge';

export class SolanaAgent {
  private config: AgentConfig;
  private context: AgentContext;
  private progressCallback?: (event: ProgressEvent) => void;

  constructor(config: AgentConfig) {
    this.config = config;

    // Use NETWORK_PERFORMANCE_KNOWLEDGE for agent initialization
    const knowledgeKeys = Object.keys(NETWORK_PERFORMANCE_KNOWLEDGE);
    console.log(`Initializing Solana agent with network performance knowledge: ${knowledgeKeys.length} categories (${knowledgeKeys.join(', ')})`);

    this.context = {
      messages: [{
        role: 'system',
        content: config.systemPrompt
      }]
    };
  }

  public setProgressCallback(callback: (event: ProgressEvent) => void) {
    this.progressCallback = callback;
  }

  private emitProgress(event: ProgressEvent) {
    this.progressCallback?.(event);
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
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type as AgentAction['type'],
        status: 'pending' as const,
        description
      };
    });
  }

  async processMessage(message: Message): Promise<Message> {
    // Check for mock mode
    const isMockMode = typeof window !== 'undefined' && (
      window.location.search.includes('aimock=1') ||
      window.location.search.includes('ai=1')
    );

    if (isMockMode) {
      // Add minimum delay to ensure processing indicator stays visible for at least 400ms as required by E2E tests
      await new Promise(resolve => setTimeout(resolve, 450));

      // Return mock responses for E2E testing
      const mockResponse = this.getMockResponse(message.content);
      const response = {
        role: 'assistant' as const,
        content: mockResponse,
        metadata: {
          type: 'network' as CapabilityType,
          data: { mock: true }
        }
      };
      this.context.messages.push(message, response);
      return response;
    }

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
      // If no capability found, try to parse it as a direct query and generate actions
      const queryLower = message.content.toLowerCase();
      if (queryLower.includes('tps') || queryLower.includes('transactions per second')) {
        // Generate action for TPS query
        this.emitProgress({ type: 'step_start', toolName: 'analyzeNetworkLoad', message: 'Analyzing network TPS...' });
        const actionPlan = '[ACTION]network.analyzeNetworkLoad:Get current TPS and network load metrics[/ACTION]';
        const actions = this.extractActionsFromResponse(actionPlan);

        if (actions.length > 0) {
          const results = await this.executeActions(actions);
          this.emitProgress({ type: 'step_complete', toolName: 'analyzeNetworkLoad', message: 'TPS analysis complete' });
          return this.createResponse('network' as CapabilityType, results);
        }
      }

      return this.createResponse('network', 'I can help you explore Solana blockchain data. Try asking about network status, transaction details, or account information.');
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

      // Provide more helpful error responses
      if (errorMessage.includes('fetch')) {
        return this.createResponse('network', 'I had trouble connecting to the Solana network. Please try again in a moment.');
      } else if (errorMessage.includes('timeout')) {
        return this.createResponse('network', 'The request timed out. The network might be busy - please try again.');
      } else {
        return this.createResponse('network', 'Something went wrong with your request. Please try rephrasing or ask about something else.');
      }
    }
  }

  private getMockResponse(content: string): string {
    const query = content.toLowerCase();

    // TPS queries
    if (query.includes('tps') || query.includes('transactions per second')) {
      return `Based on current network analysis, Solana is processing approximately 2,847 TPS (transactions per second) with a network load of 68%. The network is performing well with active validators maintaining consensus.

**Network Performance Metrics:**
- Current TPS: 2,847
- Network Load: 68%
- Block Time: ~400ms
- Active Validators: 1,924
- Stake Weight: 94.2%`;
    }

    // Account info queries
    if (query.includes('account') || query.includes('balance') || query.includes('11111111111111111111111111111111')) {
      return `Account analysis for address: 11111111111111111111111111111111

**Account Details:**
- Balance: 0.00253 SOL
- Account Type: System Program Account
- Owner: 11111111111111111111111111111111
- Executable: Yes
- Rent Epoch: 361

This is the System Program account, which is owned by the Solana runtime and handles core system operations like account creation and lamport transfers.`;
    }

    // Transaction queries
    if (query.includes('transaction') || query.includes('explain this transaction')) {
      return `Transaction Analysis Complete

**Transaction Overview:**
- Signature: 5j7s...example (mock)
- Status: Success ✅
- Slot: 234,567,890
- Block Time: 2024-01-15 10:30:45 UTC
- Fee: 0.000005 SOL

**Instructions:**
1. System Transfer - Transferred 1.5 SOL from sender to recipient
2. Token Program - Updated token account balances

This appears to be a standard SOL transfer transaction that completed successfully.`;
    }

    // Program research queries
    if (query.includes('program') || query.includes('research')) {
      return `Program Research Results

**Program Analysis:**
- Program ID: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
- Type: SPL Token Program
- Verification: ✅ Verified Program
- Upgrade Authority: Disabled (Immutable)

**Key Functions:**
- Token account creation and management
- Token minting and burning
- Transfer operations
- Account freezing capabilities

This is a core Solana program used for SPL token operations across the ecosystem.`;
    }

    // Logs subscription queries
    if (query.includes('logs') || query.includes('subscribe')) {
      return `Logs Subscription Active

**Recent Program Logs:**
\`\`\`
[2024-01-15 10:30:45] Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]
[2024-01-15 10:30:45] Program log: Instruction: Transfer
[2024-01-15 10:30:45] Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 4645 of 200000 compute units
[2024-01-15 10:30:45] Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success
\`\`\`

**Subscription Details:**
- Status: Active
- Filter: All program logs
- Connection: WebSocket established`;
    }

    // Default response
    return `I'm currently running in test mode. I can help you with:

**Network Analysis:**
- Current TPS and performance metrics
- Network status and validator information
- Block time and consensus data

**Account Research:**
- Account balances and ownership
- Program account analysis
- Token holdings and metadata

**Transaction Analysis:**
- Transaction details and status
- Instruction breakdown
- Fee analysis and optimization

**Program Research:**
- Program verification and metadata
- Function analysis and capabilities
- Upgrade history and authority

Ask me about any of these topics and I'll provide detailed analysis!`;
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

    // If nothing explicitly matched, fall back to all tools so capabilities
    // without "matches" still execute in their declared order
    const initialTools = relevantTools.length > 0 ? relevantTools : tools;

    // Create a map of completed tools
    const completedTools = new Set<string>();

    // Keep track of tools left to execute
    let remainingTools = [...initialTools];

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

      // Update active analysis context for downstream tools in the same capability
      try {
        (this.context as any).activeAnalysis = {
          tool: tool.name,
          data: (result && (result as any).result) ?? result
        };
      } catch {
        // noop
      }

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


  private generateResponse(result: any): string {
    if (!result) {
      return "I wasn't able to retrieve any data for your request. This might be due to network issues or the data not being available.";
    }

    // Handle array of results from multiple tools
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return "I processed your request but didn't find any specific data to show.";
      }

      // Special handling: if any tool result contains a plan array, aggregate and format
      const planSteps: Array<{ tool: string; reason?: string; input?: string }> = [];
      for (const item of result) {
        const maybePlanObj = item?.result;
        if (maybePlanObj && typeof maybePlanObj === 'object' && Array.isArray(maybePlanObj.plan)) {
          for (const step of maybePlanObj.plan) {
            if (step && typeof step === 'object' && typeof step.tool === 'string') {
              planSteps.push({ tool: step.tool, reason: step.reason, input: step.input });
            }
          }
        }
      }
      if (planSteps.length > 0) {
        const formatted = planSteps.map((step, i) => {
          const parts = [`${i + 1}. ${step.tool}`];
          if (step.reason) parts.push(`- ${step.reason}`);
          if (step.input) parts.push(`input: ${typeof step.input === 'string' ? step.input : JSON.stringify(step.input)}`);
          return parts.join(' ');
        }).join('\n');
        return `📋 Execution Plan (${planSteps.length} step${planSteps.length !== 1 ? 's' : ''})\n\n${formatted}\n\n(Plan generated; executing tools or refining analysis will produce detailed results.)`;
      }

      // Process each result and combine into a coherent response
      const responses = result.map((item: any) => {
        if (item.status === 'failed') {
          return `Operation failed: ${item.error}`;
        }

        // Extract the actual result data
        const data = item.result?.result || item.result;

        if (!data) {
          return null;
        }

        // Handle custom actions
        if (data.actionName && typeof data.params === 'object') {
          return `Processing ${data.actionName} with the provided parameters...`;
        }

        // Handle network data
        if (data.tps || data.networkLoad || data.validators) {
          const parts = [];
          if (data.tps) parts.push(`Current TPS: ${data.tps}`);
          if (data.networkLoad) parts.push(`Network Load: ${data.networkLoad}%`);
          if (data.validators) parts.push(`Active Validators: ${data.validators}`);
          return parts.join('\n');
        }

        // Handle transaction data
        if (data.signature || data.slot) {
          const parts = [];
          if (data.signature) parts.push(`Transaction: ${data.signature}`);
          if (data.slot) parts.push(`Slot: ${data.slot}`);
          if (data.status) parts.push(`Status: ${data.status}`);
          return parts.join('\n');
        }

        // Handle account data
        if (data.balance !== undefined || data.owner) {
          const parts = [];
          if (data.balance !== undefined) parts.push(`Balance: ${data.balance} SOL`);
          if (data.owner) parts.push(`Owner: ${data.owner}`);
          return parts.join('\n');
        }

        // Generic object handling
        if (typeof data === 'object') {
          const details = Object.entries(data)
            .filter(([key]) => !['id', '_id', 'type', 'status'].includes(key))
            .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
            .join('\n');
          return details || 'Operation completed successfully';
        }

        return String(data);
      }).filter(response => response && response !== null);

      return responses.length > 0 ? responses.join('\n\n') : "I processed your request but the results were empty.";
    }

    // Handle single result
    if (typeof result === 'object') {
      // Special handling: capability/tool returned a planning object with plan array
      if (result.plan && Array.isArray(result.plan) && result.plan.every((s: any) => s && typeof s === 'object')) {
        const steps = result.plan as Array<{ tool: string; reason?: string; input?: string }>;
        const formatted = steps.map((step, i) => {
          const parts = [`${i + 1}. ${step.tool}`];
          if (step.reason) parts.push(`- ${step.reason}`);
          if (step.input) parts.push(`input: ${typeof step.input === 'string' ? step.input : JSON.stringify(step.input)}`);
          return parts.join(' ');
        }).join('\n');
        return `📋 Execution Plan (${steps.length} step${steps.length !== 1 ? 's' : ''})\n\n${formatted}\n\n(Plan generated; executing tools or refining analysis will produce detailed results.)`;
      }
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
