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
import { generateSecureActionId } from '../../../lib/crypto-utils';

export class SolanaAgent {
  private config: AgentConfig;
  private context: AgentContext;
  private isAgentModeActive: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
    
    // Simple system context - detailed API knowledge is now applied server-side in getAnswer.ts
    this.context = {
      messages: [{
        role: 'system',
        content: config.systemPrompt
      }]
    };
  }

  /**
   * Set agent mode status
   */
  public setAgentMode(isActive: boolean): void {
    this.isAgentModeActive = isActive;
    console.log(`Agent mode ${isActive ? 'activated' : 'deactivated'}`);
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

    // If this is a planning request (system message), generate action plan (legacy support)
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
      // Always honor explicit [ACTION] tags from previous assistant replies (back-compat)
      const lastAssistantMessage = [...this.context.messages]
        .reverse()
        .find(m => m.role === 'assistant') || null;
      const legacyActions = lastAssistantMessage
        ? this.extractActionsFromResponse(lastAssistantMessage.content)
        : [];

      if (legacyActions.length > 0) {
        const legacyResults = await this.executeActions(legacyActions);
        const legacyResponse = this.createResponse(capability.type, legacyResults);
        this.context.messages.push(legacyResponse);
        return legacyResponse;
      }

      // New flow: If the chosen capability is planning, generate a plan, render it, then execute it.
      if (capability.type === 'planning') {
        const planningResults = await this.executeCapability(capability, message);
        const plan = this.extractPlanFromResult(planningResults);

        // Render plan for the user (no arbitrary 3-step cap)
        const planText = plan && plan.length ? this.formatPlan(plan) : 'No actionable steps were identified for this request.';
        const planMessage: Message = {
          role: 'assistant',
          content: planText,
          metadata: { type: 'planning', data: { plan } }
        };
        this.context.messages.push(planMessage);

        // Execute the plan steps if any
        if (plan && plan.length) {
          const executionResults = await this.executePlanSteps(plan, message);
          const finalText = this.generateResponse(executionResults);
          const finalMessage: Message = {
            role: 'assistant',
            content: finalText,
            metadata: { type: 'general', data: executionResults }
          };
          this.context.messages.push(finalMessage);
          return finalMessage;
        }

        // Nothing to execute; return the plan itself
        return planMessage;
      }

      // Non-planning capabilities: execute directly
      const result = await this.executeCapability(capability, message);
      const response = this.createResponse(capability.type, result);
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
    const results: any[] = [];
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
      'account': ['accounts', 'wallet', 'balance', 'addy', 'acc', 'address']
    };

    // Check if the action type matches any alias for the capability
    return capabilityAliases[normalizedCapability]?.includes(normalizedAction) || false;
  }

  private async executeCapability(capability: AgentCapability, message: Message): Promise<any> {
    // Get all tools for this capability
    const tools = capability.tools;
    const results: any[] = [];

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

  // Extract a plan array from a capability result (handles several shapes)
  private extractPlanFromResult(result: any): Array<{ tool: string; reason?: string; input?: string }> | null {
    try {
      // Case 1: Array of tool execution results with 'plan' payload
      if (Array.isArray(result)) {
        for (const item of result) {
          const data = item?.result?.result ?? item?.result ?? item;
          if (data && typeof data === 'object' && Array.isArray((data as any).plan)) {
            return (data as any).plan as Array<{ tool: string; reason?: string; input?: string }>;
          }
        }
      }
      // Case 2: Object with plan
      if (result && typeof result === 'object' && Array.isArray((result as any).plan)) {
        return (result as any).plan as Array<{ tool: string; reason?: string; input?: string }>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatPlan(plan: Array<{ tool: string; reason?: string; input?: string }>): string {
    const lines: string[] = ['📋 **Action Plan**', ''];

    if (!plan || plan.length === 0) {
      return 'No actionable steps identified.';
    }

    plan.forEach((step, idx) => {
      const parts: string[] = [];

      // Format the tool name nicely
      const toolDisplay = step.tool
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      lines.push(`**Step ${idx + 1}: ${toolDisplay}**`);

      if (step.reason) {
        lines.push(`   📝 ${step.reason}`);
      }

      if (step.input) {
        // Truncate long inputs for readability
        const inputDisplay = step.input.length > 100
          ? step.input.substring(0, 97) + '...'
          : step.input;
        lines.push(`   📥 Input: \`${inputDisplay}\``);
      }

      lines.push(''); // Add spacing between steps
    });

    return lines.join('\n').trim();
  }

  private findToolByName(toolName: string): { capability: AgentCapability; tool: Tool } | null {
    const nameLc = (toolName || '').toLowerCase();
    for (const cap of this.config.capabilities) {
      for (const tool of cap.tools) {
        if (tool.name.toLowerCase() === nameLc) {
          return { capability: cap, tool };
        }
      }
    }
    return null;
  }

  private async executePlanSteps(
    plan: Array<{ tool: string; reason?: string; input?: string }>,
    originalMessage: Message
  ): Promise<any[]> {
    // If agent mode is active, use the enhanced plan dispatcher
    if (this.isAgentModeActive) {
      return this.executeWithPlanDispatcher(plan, originalMessage);
    }

    // Legacy execution flow for non-agent mode
    const out: any[] = [];
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const found = this.findToolByName(step.tool);
      if (!found) {
        out.push({
          action: { type: step.tool, description: step.reason || '' },
          status: 'failed',
          error: `No matching tool found for "${step.tool}"`
        });
        continue;
      }
      try {
        const paramsMessage: Message = {
          role: 'user',
          content: step.input?.trim() ? step.input : originalMessage.content
        };
        const res = await this.executeTool(found.tool, paramsMessage);
        out.push({
          tool: found.tool.name,
          result: res,
          status: 'completed' as const
        });
      } catch (e) {
        out.push({
          tool: found.tool.name,
          status: 'failed' as const,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }
    return out;
  }

  /**
   * Execute plan using simplified approach - complex API knowledge is now server-side
   */
  private async executeWithPlanDispatcher(
    plan: Array<{ tool: string; reason?: string; input?: string }>,
    originalMessage: Message
  ): Promise<any[]> {
    // Fallback to legacy execution since dispatcher logic moved to server-side
    return this.executePlanStepsLegacy(plan, originalMessage);
  }

  /**
   * Legacy plan execution (now the main execution path)
   */
  private async executePlanStepsLegacy(
    plan: Array<{ tool: string; reason?: string; input?: string }>,
    originalMessage: Message
  ): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const found = this.findToolByName(step.tool);
      if (!found) {
        out.push({
          action: { type: step.tool, description: step.reason || '' },
          status: 'failed',
          error: `No matching tool found for "${step.tool}"`
        });
        continue;
      }
      try {
        const paramsMessage: Message = {
          role: 'user',
          content: step.input?.trim() ? step.input : originalMessage.content
        };
        const res = await this.executeTool(found.tool, paramsMessage);
        out.push({
          tool: found.tool.name,
          result: res,
          status: 'completed' as const
        });
      } catch (e) {
        out.push({
          tool: found.tool.name,
          status: 'failed' as const,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }
    return out;
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

    const formatAnyObject = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);

      // Handle objects by trying to extract meaningful information
      if (typeof v === 'object' && v !== null) {
        // If it's an array, try to format each element
        if (Array.isArray(v)) {
          if (v.length === 0) return '[]';
          
          // Check if it looks like a plan array
          if (v.some(item => item && typeof item === 'object' && (item.tool || item.action || item.step))) {
            return this.formatPlanSafely(v);
          }
          
          // Format as a list
          return v.map((item, idx) => `${idx + 1}. ${formatAnyObject(item)}`).join('\n');
        }

        // For objects, extract key-value pairs meaningfully
        try {
          const entries = Object.entries(v);
          if (entries.length === 0) return '{}';
          
          // Check for plan-like properties
          if (v.tool || v.action || v.step || v.method) {
            return this.formatPlanSafely([v]);
          }
          
          // Format as key-value pairs
          return entries
            .filter(([key]) => !['id', '_id', '__typename'].includes(key))
            .map(([key, value]) => {
              const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
              return `${cleanKey}: ${formatAnyObject(value)}`;
            })
            .join('\n');
        } catch {
          return '[Complex Object]';
        }
      }

      return String(v);
    };

    // Check if the entire result is a plan
    if (Array.isArray(result) && result.some(item => item && typeof item === 'object' && (item.tool || item.action))) {
      return this.formatPlanSafely(result);
    }

    // Check for plan in result properties
    if (typeof result === 'object' && result !== null) {
      if (Array.isArray((result as any).plan)) {
        return this.formatPlanSafely((result as any).plan);
      }
      if (Array.isArray((result as any).actions)) {
        return this.formatPlanSafely((result as any).actions);
      }
    }

    // Handle array of tool results
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return "I completed the operation but there were no results to report.";
      }

      const lines: string[] = [];
      for (const item of result) {
        if (item?.status === 'failed') {
          lines.push(`❌ ${item.tool ?? 'Step'} failed: ${item.error}`);
          continue;
        }

        const data = item?.result?.result ?? item?.result ?? item;
        
        // Check if this item contains a plan
        if (data && typeof data === 'object' && Array.isArray(data.plan)) {
          lines.push(this.formatPlanSafely(data.plan));
          continue;
        }

        // Special case: network performance
        if (item?.tool === 'analyzeNetworkLoad' && data && typeof data === 'object') {
          const { averageTps, maxTps, load, loadDescription, tpsRange } = data as any;
          if (averageTps) {
            lines.push(`📊 Network Performance: ${averageTps} TPS (${tpsRange || 'current'}), Peak: ${maxTps}, Load: ${load} (${loadDescription})`);
            continue;
          }
        }

        // Handle message responses
        if (data && typeof data === 'object' && 'message' in data) {
          lines.push(`✅ ${item.tool ?? 'Result'}: ${data.message}`);
          continue;
        }

        // Generic formatting
        const formatted = formatAnyObject(data);
        if (formatted && formatted !== '[Complex Object]') {
          lines.push(`📋 ${item.tool ?? 'Result'}:\n${formatted}`);
        } else {
          lines.push(`✅ ${item.tool ?? 'Step'} completed`);
        }
      }
      return lines.join('\n\n');
    }

    // Single result formatting
    return formatAnyObject(result);
  }

  /**
   * Safe plan formatting that handles any plan-like structure
   */
  private formatPlanSafely(plan: any[]): string {
    if (!Array.isArray(plan) || plan.length === 0) {
      return 'No actionable steps identified.';
    }

    const lines: string[] = ['📋 **Execution Plan**', ''];

    plan.forEach((step, idx) => {
      if (!step || typeof step !== 'object') {
        lines.push(`${idx + 1}. ${String(step)}`);
        return;
      }

      // Extract step information from various possible formats
      const tool = step.tool || step.action || step.method || step.name || 'Unknown Step';
      const reason = step.reason || step.description || step.purpose || '';
      const input = step.input || step.params || step.data || '';

      // Format the tool name nicely
      const toolDisplay = String(tool)
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      lines.push(`**Step ${idx + 1}: ${toolDisplay}**`);

      if (reason) {
        lines.push(`   📝 ${reason}`);
      }

      if (input) {
        // Truncate long inputs for readability
        const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
        const inputDisplay = inputStr.length > 100
          ? inputStr.substring(0, 97) + '...'
          : inputStr;
        lines.push(`   📥 Input: \`${inputDisplay}\``);
      }

      lines.push(''); // Add spacing between steps
    });

    return lines.join('\n').trim();
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
