/**
 * Enhanced Plan Dispatcher
 * Maps plan.actions to concrete in-app tools (Solana RPC + OpenSVM APIs)
 * Only triggers when Agent mode is active
 */

import { 
  ALL_API_METHODS, 
  INFORMATION_PATTERNS, 
  findRelevantPatterns, 
  getMethodByName,
  findMethodsByInformationType,
  type APIMethod,
  type InformationPattern,
  type APICall
} from './api-knowledge';

export interface DispatchContext {
  isAgentModeActive: boolean;
  userQuery: string;
  extractedEntities?: {
    addresses?: string[];
    signatures?: string[];
    tokens?: string[];
    programs?: string[];
  };
}

export interface DispatchedAction {
  id: string;
  type: 'solana-rpc' | 'opensvm-api' | 'composite';
  method: string;
  endpoint?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  parameters: Record<string, any>;
  reason: string;
  priority: number; // Execution order
  dependencies: string[]; // IDs of actions this depends on
  informationTypes: string[];
  originalPlanAction?: any; // Original action from plan
}

export interface DispatchResult {
  success: boolean;
  actions: DispatchedAction[];
  patterns: InformationPattern[];
  reasoning: string;
  errors?: string[];
}

export class PlanDispatcher {
  private static instance: PlanDispatcher;
  private actionCounter = 0;

  static getInstance(): PlanDispatcher {
    if (!PlanDispatcher.instance) {
      PlanDispatcher.instance = new PlanDispatcher();
    }
    return PlanDispatcher.instance;
  }

  /**
   * Main dispatch method - maps plan actions to concrete API calls
   */
  async dispatch(planActions: any[], context: DispatchContext): Promise<DispatchResult> {
    // Guard: Only operate in Agent mode
    if (!context.isAgentModeActive) {
      return {
        success: false,
        actions: [],
        patterns: [],
        reasoning: 'Plan dispatcher only operates when Agent mode is active',
        errors: ['Agent mode not active']
      };
    }

    try {
      // Reset counter for this dispatch session
      this.actionCounter = 0;

      // Extract information patterns from user query
      const relevantPatterns = findRelevantPatterns(context.userQuery);

      // If we have matching patterns, use them as a starting point
      let dispatchedActions: DispatchedAction[] = [];
      let reasoning = '';

      if (relevantPatterns.length > 0) {
        // Use pattern-based dispatch
        const patternResult = await this.dispatchFromPatterns(relevantPatterns, context);
        dispatchedActions = patternResult.actions;
        reasoning = `Using ${relevantPatterns.length} matching information pattern(s): ${relevantPatterns.map(p => p.name).join(', ')}. `;
      } else if (planActions.length > 0) {
        // Fallback to plan action dispatch
        const planResult = await this.dispatchFromPlanActions(planActions, context);
        dispatchedActions = planResult.actions;
        reasoning = `Mapping ${planActions.length} plan action(s) to concrete API calls. `;
      } else {
        // Intelligent dispatch based on query analysis
        const intelligentResult = await this.intelligentDispatch(context);
        dispatchedActions = intelligentResult.actions;
        reasoning = `Analyzed query and selected optimal API sequence. `;
      }

      // Sort by priority and resolve dependencies
      const orderedActions = this.resolveDependencies(dispatchedActions);

      return {
        success: true,
        actions: orderedActions,
        patterns: relevantPatterns,
        reasoning: reasoning + `Generated ${orderedActions.length} concrete API call(s).`
      };

    } catch (error) {
      return {
        success: false,
        actions: [],
        patterns: [],
        reasoning: 'Error during plan dispatch',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Dispatch using pre-defined information patterns
   */
  private async dispatchFromPatterns(patterns: InformationPattern[], context: DispatchContext): Promise<{ actions: DispatchedAction[] }> {
    const actions: DispatchedAction[] = [];

    // Use the most specific pattern (usually first in relevance)
    const primaryPattern = patterns[0];
    
    for (let i = 0; i < primaryPattern.apiSequence.length; i++) {
      const apiCall = primaryPattern.apiSequence[i];
      const method = getMethodByName(apiCall.method);
      
      if (!method) {
        console.warn(`Unknown method in pattern: ${apiCall.method}`);
        continue;
      }

      const action = await this.createDispatchedAction(
        method,
        apiCall,
        context,
        i + 1, // Priority based on sequence
        i > 0 ? [this.getActionId(i - 1)] : [] // Dependency on previous action
      );

      if (action) {
        actions.push(action);
      }
    }

    return { actions };
  }

  /**
   * Dispatch from explicit plan actions (legacy support)
   */
  private async dispatchFromPlanActions(planActions: any[], context: DispatchContext): Promise<{ actions: DispatchedAction[] }> {
    const actions: DispatchedAction[] = [];

    for (let i = 0; i < planActions.length; i++) {
      const planAction = planActions[i];
      const methodName = this.extractMethodName(planAction);
      const method = getMethodByName(methodName);

      if (!method) {
        // Try to find similar methods
        const similarMethods = this.findSimilarMethods(methodName);
        if (similarMethods.length > 0) {
          const bestMatch = similarMethods[0];
          const action = await this.createDispatchedAction(
            bestMatch,
            { method: bestMatch.name, reason: planAction.description || planAction.reason },
            context,
            i + 1,
            [],
            planAction
          );
          if (action) actions.push(action);
        }
        continue;
      }

      const action = await this.createDispatchedAction(
        method,
        { method: method.name, reason: planAction.description || planAction.reason },
        context,
        i + 1,
        [],
        planAction
      );

      if (action) {
        actions.push(action);
      }
    }

    return { actions };
  }

  /**
   * Intelligent dispatch based on query analysis
   */
  private async intelligentDispatch(context: DispatchContext): Promise<{ actions: DispatchedAction[] }> {
    const actions: DispatchedAction[] = [];
    const query = context.userQuery.toLowerCase();

    // Analyze query for key information types needed
    const informationNeeds = this.analyzeInformationNeeds(query);
    
    // Find relevant methods for each information need
    for (let i = 0; i < informationNeeds.length; i++) {
      const need = informationNeeds[i];
      const methods = findMethodsByInformationType(need.type);
      
      if (methods.length > 0) {
        // Pick the most appropriate method
        const bestMethod = this.selectBestMethod(methods, context);
        
        const action = await this.createDispatchedAction(
          bestMethod,
          { method: bestMethod.name, reason: need.reason },
          context,
          i + 1,
          need.dependencies
        );

        if (action) {
          actions.push(action);
        }
      }
    }

    // If no specific needs identified, use general analysis pattern
    if (actions.length === 0 && context.extractedEntities?.addresses?.length) {
      const address = context.extractedEntities.addresses[0];
      const generalMethods = ['getAccountInfo', 'getBalance', 'getSignaturesForAddress'];
      
      for (let i = 0; i < generalMethods.length; i++) {
        const method = getMethodByName(generalMethods[i]);
        if (method) {
          const action = await this.createDispatchedAction(
            method,
            { method: method.name, reason: `General analysis of address ${address}` },
            context,
            i + 1,
            i > 0 ? [this.getActionId(i - 1)] : []
          );
          if (action) actions.push(action);
        }
      }
    }

    return { actions };
  }

  /**
   * Create a dispatched action from an API method
   */
  private async createDispatchedAction(
    method: APIMethod,
    apiCall: APICall,
    context: DispatchContext,
    priority: number,
    dependencies: string[] = [],
    originalPlanAction?: any
  ): Promise<DispatchedAction | null> {
    try {
      // Generate parameters based on method requirements and context
      const parameters = await this.generateParameters(method, context, apiCall.input);

      const action: DispatchedAction = {
        id: this.getActionId(this.actionCounter++),
        type: method.type,
        method: method.name,
        endpoint: method.endpoint,
        httpMethod: method.method,
        parameters,
        reason: apiCall.reason,
        priority,
        dependencies,
        informationTypes: method.informationTypes,
        originalPlanAction
      };

      return action;

    } catch (error) {
      console.warn(`Failed to create action for method ${method.name}:`, error);
      return null;
    }
  }

  /**
   * Generate parameters for API method based on context
   */
  private async generateParameters(method: APIMethod, context: DispatchContext, input?: string): Promise<Record<string, any>> {
    const parameters: Record<string, any> = {};

    // Extract relevant entities from context
    const entities = context.extractedEntities || {};

    for (const param of method.parameters) {
      if (param.required) {
        switch (param.name) {
          case 'pubkey':
          case 'address':
            parameters[param.name] = entities.addresses?.[0] || this.extractAddressFromQuery(context.userQuery);
            break;
          case 'signature':
            parameters[param.name] = entities.signatures?.[0] || this.extractSignatureFromQuery(context.userQuery);
            break;
          case 'mint':
            parameters[param.name] = entities.tokens?.[0] || this.extractTokenFromQuery(context.userQuery);
            break;
          case 'slot':
            parameters[param.name] = this.extractSlotFromQuery(context.userQuery);
            break;
          case 'sourceWallet':
            parameters[param.name] = entities.addresses?.[0];
            break;
          case 'targetWallet':
            parameters[param.name] = entities.addresses?.[1];
            break;
          case 'logs':
            // For transaction analysis, we'll need to get logs from a previous getTransaction call
            parameters[param.name] = [];
            break;
        }
      } else {
        // Set reasonable defaults for optional parameters
        switch (param.name) {
          case 'commitment':
            parameters[param.name] = 'confirmed';
            break;
          case 'encoding':
            parameters[param.name] = 'base64';
            break;
          case 'limit':
            parameters[param.name] = input && input.includes('limit=') ? 
              parseInt(input.split('limit=')[1].split(/\s|,/)[0]) : 10;
            break;
        }
      }
    }

    // Handle input parameter overrides
    if (input) {
      const inputParams = this.parseInputParameters(input);
      Object.assign(parameters, inputParams);
    }

    return parameters;
  }

  /**
   * Analyze query to determine information needs
   */
  private analyzeInformationNeeds(query: string): Array<{ type: string; reason: string; dependencies: string[] }> {
    const needs: Array<{ type: string; reason: string; dependencies: string[] }> = [];

    // Network performance queries
    if (query.includes('tps') || query.includes('performance') || query.includes('network')) {
      needs.push({
        type: 'performance-metrics',
        reason: 'Query asks about network performance/TPS',
        dependencies: []
      });
    }

    // Balance queries
    if (query.includes('balance') || query.includes('sol')) {
      needs.push({
        type: 'balance',
        reason: 'Query asks about balance',
        dependencies: []
      });
    }

    // Transaction analysis
    if (query.includes('transaction') || query.includes('tx')) {
      needs.push({
        type: 'transaction-details',
        reason: 'Query asks about transaction',
        dependencies: []
      });
    }

    // Token analysis
    if (query.includes('token') || query.includes('spl')) {
      needs.push({
        type: 'token-balance',
        reason: 'Query asks about tokens',
        dependencies: []
      });
    }

    // Wallet analysis
    if (query.includes('wallet') || query.includes('address')) {
      needs.push({
        type: 'account-data',
        reason: 'Query asks about wallet/address',
        dependencies: []
      });
    }

    return needs;
  }

  /**
   * Utility methods
   */
  private getActionId(index: number): string {
    return `action_${index}`;
  }

  private extractMethodName(planAction: any): string {
    if (typeof planAction === 'string') return planAction;
    if (planAction.type) return planAction.type;
    if (planAction.method) return planAction.method;
    if (planAction.tool) return planAction.tool;
    return 'unknown';
  }

  private findSimilarMethods(methodName: string): APIMethod[] {
    const nameLower = methodName.toLowerCase();
    return ALL_API_METHODS.filter(method => 
      method.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(method.name.toLowerCase()) ||
      method.informationTypes.some(type => nameLower.includes(type.toLowerCase()))
    ).slice(0, 3); // Top 3 matches
  }

  private selectBestMethod(methods: APIMethod[], context: DispatchContext): APIMethod {
    // Prefer OpenSVM APIs for enhanced analytics when available
    const opensvmMethods = methods.filter(m => m.type === 'opensvm-api');
    if (opensvmMethods.length > 0) return opensvmMethods[0];
    
    // Otherwise return the first Solana RPC method
    return methods[0];
  }

  private resolveDependencies(actions: DispatchedAction[]): DispatchedAction[] {
    // Simple topological sort by priority for now
    return actions.sort((a, b) => a.priority - b.priority);
  }

  private extractAddressFromQuery(query: string): string | undefined {
    // Look for Solana address pattern (base58, 32-44 chars)
    const addressPattern = /[A-HJ-NP-Za-km-z1-9]{32,44}/g;
    const matches = query.match(addressPattern);
    return matches?.[0];
  }

  private extractSignatureFromQuery(query: string): string | undefined {
    // Look for transaction signature pattern (base58, ~88 chars)
    const sigPattern = /[A-HJ-NP-Za-km-z1-9]{80,90}/g;
    const matches = query.match(sigPattern);
    return matches?.[0];
  }

  private extractTokenFromQuery(query: string): string | undefined {
    // Similar to address pattern but context suggests it's a token
    if (query.toLowerCase().includes('token')) {
      return this.extractAddressFromQuery(query);
    }
    return undefined;
  }

  private extractSlotFromQuery(query: string): number | undefined {
    const slotPattern = /slot[:\s]+(\d+)/i;
    const match = query.match(slotPattern);
    return match ? parseInt(match[1]) : undefined;
  }

  private parseInputParameters(input: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Parse key=value pairs
    const pairs = input.split(/[,&\s]+/);
    for (const pair of pairs) {
      if (pair.includes('=')) {
        const [key, value] = pair.split('=');
        params[key.trim()] = isNaN(Number(value)) ? value.trim() : Number(value);
      }
    }
    
    return params;
  }
}

// Export singleton instance
export const planDispatcher = PlanDispatcher.getInstance();
