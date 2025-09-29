import { Tool, ToolContext, ToolResult } from "./types";
import { transactionInstructionAnalysisTool } from "./transactionInstructionAnalysis";
import { transactionAnalysisTool } from "./transactionAnalysis";
import { networkAnalysisTool } from "./networkAnalysis";
import { accountAnalysisTool } from "./accountAnalysis";
import { dynamicPlanExecutionTool } from "./dynamicPlanExecution";
import { stableDynamicExecutionTool } from "./stableDynamicExecution";
import { aiPlanExecutionTool } from "./aiPlanExecution";
import { coinGeckoTool } from "./coingecko";
import { recordToolAttempt } from "@/lib/ai/execution-monitor";
import { validateAccountAnalysisParams, validateTransactionAnalysisParams, logParameterValidation } from "@/lib/ai/parameter-validator";
// import { moralisAnalysisTool } from "./moralisAnalysisNew"; // TODO: Fix moralis-api module import

// Progressive timeout configuration
const TIMEOUT_STAGES = {
  FAST: 15000,    // 15 seconds - quick operations
  MEDIUM: 30000,  // 30 seconds - standard operations  
  SLOW: 60000     // 60 seconds - complex operations
};

interface ToolExecutionResult {
  tool: string;
  result?: ToolResult;
  error?: Error;
  success: boolean;
  time: number;
  partialData?: any;
  timeoutStage: keyof typeof TIMEOUT_STAGES;
}

export class ToolRegistry {
    private tools: Tool[] = [
        // Order matters - more specific tools should come first
        coinGeckoTool, // PRIMARY: CoinGecko API for cryptocurrency market data
        aiPlanExecutionTool, // PRIMARY: AI-powered tool selection and execution
        transactionInstructionAnalysisTool,
        transactionAnalysisTool,
        // moralisAnalysisTool, // FALLBACK: Moralis API-based portfolio/token analysis (TODO: Fix import)
        dynamicPlanExecutionTool, // FALLBACK: Hardcoded planning logic
        stableDynamicExecutionTool, // FALLBACK: Stable version with hardcoded fallbacks if dynamic fails
        accountAnalysisTool, // Fallback for simpler account queries
        networkAnalysisTool, // Re-enabled as safety net
    ];

    /**
     * Executes a tool with progressive timeout strategy
     */
    private async executeToolWithProgressiveTimeout(
        tool: Tool,
        context: ToolContext,
        planId?: string
    ): Promise<ToolExecutionResult> {
        const toolStart = Date.now();
        const toolName = tool.name;
        
        // Record tool attempt for monitoring
        if (planId) {
            recordToolAttempt(planId, toolName);
        }

        // Determine timeout stage based on tool type
        let timeoutStage: keyof typeof TIMEOUT_STAGES = 'MEDIUM';
        if (toolName === 'coingecko' || toolName === 'networkAnalysis') {
            timeoutStage = 'FAST'; // API calls should be quick
        } else if (toolName === 'aiPlanExecution' || toolName === 'accountAnalysis') {
            timeoutStage = 'SLOW'; // Complex analysis needs more time
        }

        const timeout = TIMEOUT_STAGES[timeoutStage];
        
        console.log(`🔧 Executing ${toolName} with ${timeoutStage} timeout (${timeout}ms)`);

        try {
            const toolTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Tool ${toolName} execution timeout after ${timeout}ms`));
                }, timeout);
            });

            const toolPromise = tool.execute(context);
            const result = await Promise.race([toolPromise, toolTimeout]);

            const toolTime = Date.now() - toolStart;
            console.log(`✅ Tool ${toolName} completed in ${toolTime}ms`);

            return {
                tool: toolName,
                result,
                success: true,
                time: toolTime,
                timeoutStage
            };
        } catch (error) {
            const toolTime = Date.now() - toolStart;
            console.error(`❌ Tool ${toolName} failed after ${toolTime}ms:`, error);

            // Try to extract partial data
            let partialData = null;
            try {
                if ((error as any).partialData) {
                    partialData = (error as any).partialData;
                    console.log(`📦 Extracted partial data from ${toolName}`);
                }
            } catch (extractError) {
                // Ignore errors when extracting partial data
            }

            return {
                tool: toolName,
                error: error as Error,
                success: false,
                time: toolTime,
                partialData,
                timeoutStage
            };
        }
    }

    async executeTools(context: ToolContext): Promise<ToolResult & { partialData?: any }> {
        const toolExecutionStart = Date.now();
        let partialData: any = {};
        let hasPartialData = false;

        // Separate primary tools from fallback tools
        const primaryTools = this.tools.filter(tool =>
            tool.name === 'coingecko' ||
            tool.name === 'aiPlanExecution' ||
            tool.name === 'transactionInstructionAnalysis' ||
            tool.name === 'transactionAnalysis'
        );

        const fallbackTools = this.tools.filter(tool =>
            !primaryTools.includes(tool)
        );

        console.log(`🔧 Attempting ${primaryTools.length} primary tools first, then ${fallbackTools.length} fallback tools in parallel`);

        // Phase 1: Try primary tools sequentially with progressive timeouts
        for (const tool of primaryTools) {
            if (tool.canHandle(context)) {
                console.log(`🎯 Executing primary tool: ${tool.name}`);
                
                const toolResult = await this.executeToolWithProgressiveTimeout(
                    tool, 
                    context, 
                    (context as any).planId
                );

                if (toolResult.success && toolResult.result && toolResult.result.handled) {
                    console.log(`🎯 Total tool selection time: ${Date.now() - toolExecutionStart}ms`);
                    return toolResult.result;
                }

                // Collect partial data
                if (toolResult.partialData) {
                    partialData[tool.name] = toolResult.partialData;
                    hasPartialData = true;
                }
            }
        }

        console.log(`⚡ Primary tools completed, trying ${fallbackTools.length} fallback tools in parallel`);

        // Phase 2: Try fallback tools in parallel
        const applicableTools = fallbackTools.filter(tool => tool.canHandle(context));

        if (applicableTools.length === 0) {
            console.warn(`⚠️ No tools can handle request: "${context.question}"`);
            return hasPartialData ? { handled: false, partialData } : { handled: false };
        }

        console.log(`🚀 Running ${applicableTools.length} fallback tools in parallel: ${applicableTools.map(t => t.name).join(', ')}`);

        // Execute all applicable tools in parallel with progressive timeouts
        const toolPromises = applicableTools.map(async (tool) => {
            console.log(`🔧 Starting parallel execution: ${tool.name}`);
            
            const toolResult = await this.executeToolWithProgressiveTimeout(
                tool,
                context,
                (context as any).planId
            );

            // Convert to expected format for compatibility
            return {
                tool: tool.name,
                result: toolResult.result,
                success: toolResult.success,
                time: toolResult.time,
                error: toolResult.error,
                partialData: toolResult.partialData
            };
        });

        // Wait for all tools to complete (or timeout)
        const results = await Promise.allSettled(toolPromises);

        // Process results
        for (const promiseResult of results) {
            if (promiseResult.status === 'fulfilled') {
                const toolResult = promiseResult.value;

                if (toolResult.success && toolResult.result && toolResult.result.handled) {
                    console.log(`🎯 Parallel tool ${toolResult.tool} succeeded! Total time: ${Date.now() - toolExecutionStart}ms`);
                    return toolResult.result;
                }

                // Collect partial data from successful but non-handled results
                if (toolResult.partialData) {
                    partialData[toolResult.tool] = toolResult.partialData;
                    hasPartialData = true;
                }
            } else {
                console.error(`Promise failed:`, promiseResult.reason);
            }
        }        // If we get here, no tool could handle the request completely
        console.warn(`⚠️ No tool could handle request completely: "${context.question}"`);

        // Return partial data if we have any
        if (hasPartialData) {
            console.log(`📊 Returning partial data from ${Object.keys(partialData).length} tools`);
            return { handled: false, partialData };
        }

        return { handled: false };
    } getAvailableTools(): Tool[] {
        return [...this.tools];
    }

    addTool(tool: Tool): void {
        this.tools.push(tool);
    }

    removeTool(toolName: string): boolean {
        const index = this.tools.findIndex(tool => tool.name === toolName);
        if (index > -1) {
            this.tools.splice(index, 1);
            return true;
        }
        return false;
    }
}
